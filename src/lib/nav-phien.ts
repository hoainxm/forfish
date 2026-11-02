// DẪN ĐƯỜNG — PHIÊN ĐANG CHẠY, ĐỂ TIẾP TỤC KHI MỞ LẠI APP (test: nav-phien.test.ts).
//
// Học từ VietMap Live (dịch ngược 3.4.4, 2026-11-02): app bị tắt giữa chuyến,
// mở lại thì hỏi "Bạn có muốn tiếp tục dẫn đường tới …". Ngoài biển chuyện này
// xảy ra thường hơn trên bờ: máy nóng, hết pin, hệ điều hành dọn app chạy nền.
// Trước đây mở lại là mất tuyến đang chạy — phải vẽ lại, tính lại (cần sóng để
// tải dự báo) trong khi đang lênh đênh.
//
// Khoá `forfish.nav.phien.v1` — CHỈ của máy này (EXCLUDED trong
// offline-backup.test.ts): chép sang máy khác là máy đó hỏi tiếp tục một chuyến
// nó không chạy.
//
// ⚠️ KHÁC `saved-routes.ts` (cố ý KHÔNG lưu số đã tính vì là dự báo của hôm
// ấy): ở đây lưu NGUYÊN tuyến đã tính, vì đây là chuyến ĐANG chạy và hạn dùng
// chỉ NAV_PHIEN_HAN_MS. Thẻ hỏi phải nói tuyến tính lúc mấy giờ.

import type { LatLon } from "@/lib/geo";
import { saveUserJson } from "@/lib/user-store";
import { readUserRecord } from "@/lib/user-list-store";

export const NAV_PHIEN_KEY = "forfish.nav.phien.v1";
/** Quá ngần này kể từ lần ghi cuối thì coi như chuyến đã xong — không hỏi nữa */
export const NAV_PHIEN_HAN_MS = 12 * 60 * 60 * 1000;

/** Hình dạng tối thiểu của tuyến đang dẫn — đúng phần `PlannedRoute` mà dẫn đường đọc. */
export type TuyenLuu = {
  plan: { waypoints: LatLon[] };
  stops: LatLon[];
  stopWpIdx: number[];
  legBoundsKm: number[];
};

export type NavPhien<R extends TuyenLuu = TuyenLuu> = {
  v: 1;
  route: R;
  /** tên chỗ đến bà con đặt (nếu có) — để thẻ hỏi nói "tới Hòn Mê" thay vì toạ độ */
  tenDich: string | null;
  /** lúc bấm Bắt đầu dẫn đường (ms) */
  batDau: number;
  /** lần ghi cuối (ms) — tính hạn từ đây */
  capNhat: number;
};

const soHuuHan = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const laToaDo = (p: unknown): p is LatLon => {
  const q = p as LatLon;
  return !!q && soHuuHan(q.lat) && soHuuHan(q.lon) && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180;
};

/** Đọc + kiểm bản ghi. Hỏng / thiếu / quá hạn ⇒ null (không ném). */
export function docPhien<R extends TuyenLuu>(raw: unknown, now: number): NavPhien<R> | null {
  const x = raw as NavPhien<R> | null;
  if (!x || typeof x !== "object" || x.v !== 1) return null;
  if (!soHuuHan(x.batDau) || !soHuuHan(x.capNhat)) return null;
  if (now - x.capNhat > NAV_PHIEN_HAN_MS || x.capNhat - now > 5 * 60_000) return null;
  const r = x.route;
  if (!r || !r.plan || !Array.isArray(r.plan.waypoints) || r.plan.waypoints.length < 2) return null;
  if (!r.plan.waypoints.every(laToaDo)) return null;
  if (!Array.isArray(r.stops) || r.stops.length < 1 || !r.stops.every(laToaDo)) return null;
  if (!Array.isArray(r.stopWpIdx) || !r.stopWpIdx.every(soHuuHan)) return null;
  if (!Array.isArray(r.legBoundsKm) || !r.legBoundsKm.every(soHuuHan)) return null;
  return { ...x, tenDich: typeof x.tenDich === "string" && x.tenDich.trim() ? x.tenDich.trim() : null };
}

export function taoPhien<R extends TuyenLuu>(route: R, tenDich: string | null, now: number): NavPhien<R> {
  return { v: 1, route, tenDich: tenDich?.trim() || null, batDau: now, capNhat: now };
}

/** Chữ giờ "7:05" theo giờ máy — thẻ hỏi nói tuyến tính lúc nào. */
export function gioPhut(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── đọc/ghi kho (máy) ──────────────────────────────────────────────────── */

export function napPhien<R extends TuyenLuu>(now: number = Date.now()): NavPhien<R> | null {
  const r = readUserRecord<NavPhien<R>>(NAV_PHIEN_KEY);
  return r.ok ? docPhien<R>(r.value, now) : null;
}

/** Ghi phiên. Hết chỗ ⇒ false (không xoá gì của bà con để lấy chỗ — luật saveUserJson). */
export function luuPhien(p: NavPhien): boolean {
  return saveUserJson(NAV_PHIEN_KEY, p);
}

export function xoaPhien(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NAV_PHIEN_KEY);
  } catch {
    /* kho bị chặn — không có gì để xoá */
  }
}
