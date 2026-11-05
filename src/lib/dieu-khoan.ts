// ĐỒNG Ý ĐIỀU KHOẢN + CHÍNH SÁCH (2026-11-05, anh Long: "chỉ cần có 1 cái là click là đồng ý").
//
// Căn cứ: Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026) + Nghị định 356/2025/NĐ-CP
// (Điều 6 — phương thức đồng ý) + Nghị định 330/2026/NĐ-CP (phạt). Ba điều buộc cách làm ở đây:
//   1. Im lặng / không phản hồi KHÔNG phải đồng ý ⇒ câu "Đăng nhập tức là đồng ý" cũ không đủ;
//      phải có MỘT HÀNH ĐỘNG chủ động (bấm "Đồng ý" / tick ô).
//   2. Không đặt sẵn đồng ý ⇒ ô tick ở /dang-ky luôn để TRỐNG lúc mở.
//   3. Đồng ý phải KIỂM CHỨNG được (ai · lúc nào · bản nào) và bên kiểm soát dữ liệu chịu trách nhiệm
//      chứng minh ⇒ ghi lên máy chủ (bảng `dong_y_dieu_khoan`, migration 0083), máy chỉ giữ bản sao.
//
// OFFLINE: bấm Đồng ý giữa biển vẫn được — ghi vào máy với `daGui:false`, có sóng thì gửi bù
// (`guiDongYConTreo`). Không bao giờ chặn bà con vì chưa gửi được.
//
// ĐỔI NỘI DUNG /dieu-khoan hoặc /quyen-rieng-tu theo hướng THÊM mục đích / THÊM loại dữ liệu ⇒ tăng
// `DIEU_KHOAN_BAN` ⇒ mọi tài khoản được hỏi lại một lần. Sửa câu chữ không đổi nghĩa thì KHÔNG tăng.

import { normalizeVnPhone } from "@/lib/phone";

/** Bản điều khoản hiện hành (ngày chốt nội dung). */
export const DIEU_KHOAN_BAN = "2026-11-05";
export const DONG_Y_KEY = "forfish.dongY.v1";

export interface DongYGhi {
  ban: string;
  /** ISO, mốc bấm trên máy */
  luc: string;
  /** đã ghi được lên máy chủ chưa */
  daGui: boolean;
}
export type SoDongY = Record<string, DongYGhi>;

/** Đọc sổ thô — hỏng/không có ⇒ sổ rỗng (an toàn: hỏi lại, không coi như đã đồng ý). */
export function docSo(raw: string | null): SoDongY {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: SoDongY = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const g = v as Partial<DongYGhi> | null;
      if (g && typeof g.ban === "string" && typeof g.luc === "string") {
        out[k] = { ban: g.ban, luc: g.luc, daGui: g.daGui === true };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Khoá sổ của một danh tính: SĐT chuẩn hoá (0901…/+84901… là một người); tên đăng nhập admin tổng (không phải số)
 *  giữ nguyên chữ thường. Rỗng ⇒ null. */
export function khoaSo(id: string | null | undefined): string | null {
  const k = (id ?? "").trim();
  if (!k) return null;
  return /^\+?\d[\d\s.]*$/.test(k) ? normalizeVnPhone(k) : k.toLowerCase();
}

/** Tài khoản này còn phải hỏi đồng ý bản hiện hành không. Không có danh tính (khách lạ) ⇒ không hỏi. */
export function canHoi(so: SoDongY, phone: string | null, ban = DIEU_KHOAN_BAN): boolean {
  const p = khoaSo(phone);
  if (!p) return false;
  return so[p]?.ban !== ban;
}

export function ghiVaoSo(
  so: SoDongY,
  phone: string,
  luc: string,
  daGui: boolean,
  ban = DIEU_KHOAN_BAN,
): SoDongY {
  const p = khoaSo(phone);
  if (!p) return so;
  return { ...so, [p]: { ban, luc, daGui } };
}

/** Các mục bấm rồi mà chưa lên máy chủ — để gửi bù khi có sóng. */
export function conTreo(so: SoDongY): { phone: string; ghi: DongYGhi }[] {
  return Object.entries(so)
    .filter(([, g]) => !g.daGui)
    .map(([phone, ghi]) => ({ phone, ghi }));
}

/** Máy chủ nhận mốc client — chặn mốc bịa quá xa (ranh giới input). */
export function lucHopLe(luc: unknown, now = Date.now()): string | null {
  if (typeof luc !== "string") return null;
  const t = Date.parse(luc);
  if (!Number.isFinite(t)) return null;
  // trước ngày luật có hiệu lực hoặc vượt giờ máy chủ quá 1 ngày ⇒ không tin
  if (t < Date.parse("2026-01-01T00:00:00Z") || t > now + 86_400_000) return null;
  return new Date(t).toISOString();
}

// ── localStorage (chỉ chạy ở máy) ─────────────────────────────────────────────

function doc(): SoDongY {
  try {
    return docSo(window.localStorage.getItem(DONG_Y_KEY));
  } catch {
    return {};
  }
}
function ghi(so: SoDongY): boolean {
  try {
    window.localStorage.setItem(DONG_Y_KEY, JSON.stringify(so));
    return true;
  } catch {
    return false;
  }
}

export function canHoiMay(phone: string | null): boolean {
  return canHoi(doc(), phone);
}

/** Bà con vừa bấm Đồng ý. Trả mốc đã ghi. */
export function ghiDongYMay(phone: string, daGui = false, luc = new Date().toISOString()): string {
  ghi(ghiVaoSo(doc(), phone, luc, daGui));
  return luc;
}

export function conTreoMay(): { phone: string; ghi: DongYGhi }[] {
  return conTreo(doc());
}
