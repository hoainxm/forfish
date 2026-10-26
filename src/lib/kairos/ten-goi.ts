// KAIROS — LUẬT TÊN GỌI (14 §3.7, AC12). THUẦN — route /api/kairos/me và khung sửa tên dùng chung.
//
// Tên gọi kiểu Facebook: tự chọn, 2–20 ký tự, KHÔNG TRÙNG theo khoá chuẩn hoá (thường + bỏ
// dấu + gộp khoảng trắng — "Bà Con" và "ba  con" là một). Khoá chuẩn hoá = cột `handle_norm`
// (unique trong 0065) — tra trùng ở DB, hàm này chỉ tính khoá.
// Cấm giả danh: tên báo, cơ quan nhà nước, SDVICO/app. Đổi tối đa 1 lần/30 ngày.

import { foldVi } from "./lien-ket.mjs";
import { badWordHit } from "./loc-chu";
import { chuQuyenFlag } from "./chu-quyen.mjs";
import { chongPhaFlag } from "./chong-pha.mjs";
import { LIMITS, type Checked } from "./types";

export const HANDLE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Khoá so trùng — cột `handle_norm`. */
export function handleNorm(handle: string): string {
  return foldVi(handle);
}

/** Cụm cấm (đã bỏ dấu), so theo ranh giới từ ở BẤT KỲ đâu trong tên. */
const RESERVED_ANYWHERE = [
  // app + chủ app
  "sdvico", "sdfish", "forfish", "for fish", "kairos", "quan tri", "admin", "ban quan tri", "chinh thuc",
  // báo nguồn (scripts/kairos-nguon.json) + báo lớn
  "vnexpress", "vn express", "tuoi tre", "thanh nien", "bao nong nghiep", "nong nghiep va moi truong",
  "thuy san viet nam", "tap chi thuy san", "dan tri", "vietnamnet", "vtv", "vov", "nhan dan",
  // KHÔNG cấm "bao" trần: bỏ dấu là cả "Bảo" — tên người rất phổ biến.
  // cơ quan nhà nước
  "ubnd", "uy ban", "bien phong", "bo doi bien phong", "kiem ngu", "canh sat bien", "cong an", "hai quan",
  "quan doi", "chinh phu", "quoc hoi", "nha nuoc", "thu tuong", "chu tich", "chi cuc", "tong cuc",
];
/** Từ cơ quan MỘT TIẾNG — bỏ dấu sẽ trùng chữ lành ("bộ"/"bò", "sở"/"sơ", "cục"/"cúc"),
 *  nên so ĐÚNG DẤU, và chỉ khi đứng đầu tên ("Bộ Nông nghiệp", "Sở Thủy sản", "Cục Kiểm ngư"). */
const RESERVED_HEAD_ACCENTED = /^(bộ|sở|cục|phòng|ban|đồn|trạm)\s/u;

/**
 * Kiểm một tên gọi bà con gõ. Trả tên đã làm sạch (NFC, gộp khoảng trắng) + khoá chuẩn hoá.
 * KHÔNG tra trùng (việc của DB) và KHÔNG tra thời hạn đổi (xem `canChangeHandle`).
 */
export function validateHandle(raw: unknown): Checked<{ handle: string; norm: string }> {
  if (typeof raw !== "string") return { ok: false, code: "handle_short" };
  const handle = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  const len = [...handle].length;
  if (len < LIMITS.handleMin) return { ok: false, code: "handle_short" };
  if (len > LIMITS.handleMax) return { ok: false, code: "handle_long" };
  // chữ (mọi dấu tiếng Việt), số, khoảng trắng, . - _ ; phải có ít nhất một chữ cái
  if (!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(handle) || !/\p{L}/u.test(handle)) return { ok: false, code: "handle_chars" };
  const norm = handleNorm(handle);
  if (!norm) return { ok: false, code: "handle_chars" };
  const bad = badWordHit(handle);
  if (bad) return { ok: false, code: "bad_words", term: bad };
  const sov = chuQuyenFlag(handle);
  if (sov) return { ok: false, code: "sovereignty", term: sov };
  const cp = chongPhaFlag(handle);
  if (cp) return { ok: false, code: "anti_state", term: cp };
  const hay = ` ${norm} `;
  const reserved = RESERVED_ANYWHERE.find((w) => hay.includes(` ${w} `));
  if (reserved) return { ok: false, code: "handle_reserved", term: reserved };
  if (RESERVED_HEAD_ACCENTED.test(handle.toLowerCase())) return { ok: false, code: "handle_reserved" };
  return { ok: true, value: { handle, norm } };
}

/**
 * Được đổi tên chưa. `changedAt` = lần ĐỔI gần nhất (null = chưa đổi lần nào — lần đặt đầu
 * không tính). Giờ lỗi/tương lai ⇒ coi như vừa đổi (an toàn: chặn).
 */
export function canChangeHandle(
  changedAt: string | number | Date | null | undefined,
  now: number,
): { ok: true } | { ok: false; nextAt: string } {
  if (changedAt == null) return { ok: true };
  let t = new Date(changedAt).getTime();
  if (!Number.isFinite(t) || t > now) t = now;
  const next = t + HANDLE_COOLDOWN_MS;
  return now >= next ? { ok: true } : { ok: false, nextAt: new Date(next).toISOString() };
}

/**
 * Tên mặc định khi hồ sơ được tạo: `customers.name` nếu hợp lệ và chưa ai dùng, không thì
 * "Bà con " + 4 số cuối SĐT; trùng ⇒ thêm số " 2", " 3"…
 * `isTaken(norm)` do bên gọi tra (DB). Hết đường (≥100 lần trùng) ⇒ null — route trả 503.
 */
export function defaultHandle(
  customerName: string | null | undefined,
  phone: string,
  isTaken: (norm: string) => boolean,
): string | null {
  const fromName = customerName ? validateHandle(customerName) : null;
  if (fromName?.ok && !isTaken(fromName.value.norm)) return fromName.value.handle;
  const digits = String(phone ?? "").replace(/\D/g, "");
  const base = `Bà con ${digits.slice(-4) || "mới"}`;
  for (let i = 1; i < 100; i++) {
    const h = i === 1 ? base : `${base} ${i}`;
    if (!isTaken(handleNorm(h))) return h;
  }
  return null;
}

/**
 * Dòng phụ dưới tên: "Cảng X" theo cảng nhà, không thì tên cơ sở bên mua, không thì "".
 * Tên cảng trong danh mục có khi đã mang chữ "Cảng cá…" ⇒ không lặp "Cảng Cảng cá".
 */
export function sublineFor(input: { portName?: string | null; businessName?: string | null }): string {
  const port = input.portName?.trim();
  if (port) {
    const s = /^(cảng|bến|đảo|knđ|khu neo đậu)\b/iu.test(port) ? port : `Cảng ${port}`;
    return s.slice(0, 40);
  }
  return (input.businessName?.trim() ?? "").slice(0, 40);
}
