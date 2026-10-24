// KAIROS — "TẢI TIN MANG ĐI" (14 §19, 2026-10-24). Facebook không biết bà con sắp mất sóng nhiều ngày;
// Kairos thì biết: đang có sóng tốt mà bản lưu dòng tin cũ (>6 giờ) hoặc mỏng (<40 bài) ⇒ một dòng gợi ý
// ở đầu /kairos "Sắp ra khơi? Tải 100 bài mới để đọc trên biển" + Tải / Để sau.
//
// · CHỈ CHẠY KHI BẤM Tải (luật không gửi ngầm): tối đa 5 trang qua `fetchFeedPage` có sẵn (đồng hồ, không
//   ném), gộp vào `forfish.kairos.v1` (trần 200 bài / 400 KB — đầy thì cắt bài Kairos cũ, KHÔNG đụng
//   `forfish.fc.*`).
// · "Để sau" ⇒ ẩn 24 giờ, nhớ trong máy `forfish.kairos.taimangdi.v1` = { an: ms }. Không mang gì của
//   tài khoản; hỏng/xoá ⇒ gợi ý hiện lại, không mất gì.
// · Chỉ dòng tin chung — không ở Bến, không đụng màn Ra khơi (Trục 1).

import type { FeedPage, NetResult } from "./feed-client";
import type { KairosPost } from "./types";

export const TAI_MANG_DI_KEY = "forfish.kairos.taimangdi.v1";
export const TMD_TRANG = 5;
export const TMD_CU_MS = 6 * 3600_000;
export const TMD_IT_BAI = 40;
export const TMD_AN_MS = 24 * 3600_000;

/** Thông tin mạng trình duyệt cho (Network Information API — Safari không có ⇒ chỉ dựa onLine). */
export interface NavMang {
  onLine?: boolean;
  connection?: { effectiveType?: string; saveData?: boolean };
}

/**
 * "Sóng tốt": máy không báo mất sóng, không bật tiết kiệm dữ liệu, và (nếu trình duyệt cho biết) không phải
 * 2G. 3G vẫn được — 5 trang chỉ chữ ~200–400 KB.
 */
export function songTot(nav: NavMang | null | undefined): boolean {
  if (!nav || nav.onLine === false) return false;
  const c = nav.connection;
  if (c?.saveData) return false;
  return !(c?.effectiveType && /(^|-)2g$/.test(c.effectiveType));
}

/**
 * Có hiện gợi ý không. `savedAt` = giờ bản lưu LÚC MỞ MÀN (trước khi trang đầu ghi đè — không thì bản lưu
 * luôn "vừa xong"); `soBai` = số bài trong bản lưu bây giờ; `anDen` = mốc "Để sau".
 */
export function nenGoiY(o: { songTot: boolean; savedAt: number | null; soBai: number; anDen: number; now: number }): boolean {
  if (!o.songTot || o.now < o.anDen) return false;
  const cu = o.savedAt == null || o.now - o.savedAt > TMD_CU_MS;
  return cu || o.soBai < TMD_IT_BAI;
}

/** Đọc mốc "Để sau". Hỏng / không có ⇒ 0 (hiện được). */
export function parseAnDen(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const j = JSON.parse(raw) as { an?: unknown };
    return typeof j?.an === "number" && Number.isFinite(j.an) ? j.an : 0;
  } catch {
    return 0;
  }
}

export const serializeAnDen = (now: number) => JSON.stringify({ an: now + TMD_AN_MS });

export type TaiNhieu = { kind: "ok"; posts: KairosPost[]; trang: number; het: boolean } | { kind: "offline" } | { kind: "error"; status: number };

/**
 * Tải liền tối đa `max` trang theo con trỏ. Trang ĐẦU hỏng ⇒ trả lỗi đó; trang sau hỏng ⇒ giữ những trang
 * đã có (mất sóng giữa chừng vẫn được phần đã tải). Bài trùng id (ghim lọt trang sau) chỉ giữ một.
 */
export async function taiNhieuTrang(
  layTrang: (cursor: string | null) => Promise<NetResult<FeedPage>>,
  max = TMD_TRANG,
): Promise<TaiNhieu> {
  const byId = new Map<string, KairosPost>();
  let cursor: string | null = null;
  let trang = 0;
  for (; trang < max; ) {
    const r = await layTrang(cursor);
    if (r.kind !== "ok") {
      if (trang === 0) return r;
      break;
    }
    trang++;
    for (const p of [...r.value.pinned, ...r.value.posts]) if (!byId.has(p.id)) byId.set(p.id, p);
    cursor = r.value.next;
    if (!cursor) return { kind: "ok", posts: [...byId.values()], trang, het: true };
  }
  return { kind: "ok", posts: [...byId.values()], trang, het: false };
}

/** Số bài vừa tải CÒN nằm trong bản lưu sau khi gộp + cắt trần (để báo thật "Đã tải N bài"). */
export function soBaiConLuu(taiVe: readonly KairosPost[], banLuu: readonly KairosPost[]): number {
  const ids = new Set(banLuu.map((p) => p.id));
  return taiVe.filter((p) => ids.has(p.id)).length;
}
