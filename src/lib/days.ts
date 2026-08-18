// NGÀY & NGƯỠNG "SẮP HẾT" DÙNG CHUNG cho mọi thứ có hạn (giấy tờ, bảo hiểm /
// chứng chỉ thuyền viên, bảo hành, kỳ dịch vụ SDVICO, bảo dưỡng tự ghi).
//
// Vì sao có file này (audit thông báo 2026-08-18, N1 + T4): `daysUntil` từng
// được CHÉP 6 lần (documents/crew/products/owned-assets/compliance +
// maintenance-reminders + urgent-strip), tất cả tính theo NGÀY UTC. Ở Việt Nam
// (+07:00) từ 00h tới 07h sáng, "hôm nay" theo UTC vẫn là HÔM QUA ⇒ giấy hết
// hạn hôm nay hiện "Còn 1 ngày", nợ đến hạn hôm qua chưa đỏ tới 7h sáng. Ngưỡng
// "sắp hết" cũng mỗi nơi một số (30/30/30/14/7).
//
// Nay: MỘT hàm, tính theo ngày lịch Việt Nam cố định (không lấy theo múi giờ
// máy — máy đặt sai giờ thì hạn giấy vẫn phải đúng với lịch bà con nhìn), và
// HAI ngưỡng chung (chốt 2026-08-18, xem 07-design-spec §8):
//   · SOON_DAYS_DOCS    = 30 — giấy tờ tàu, bảo hiểm/chứng chỉ thuyền viên, bảo hành
//   · SOON_DAYS_SERVICE = 14 — bảo dưỡng tự ghi + kỳ dịch vụ/cước SDVICO
// `days === 0` (hết hạn HÔM NAY) = ĐÃ HẾT HẠN — đỏ, không vàng.

import { isoDateVN } from "@/lib/day-labels";

const DAY_MS = 86_400_000;

/** Ngưỡng "sắp hết" cho giấy tờ, bảo hiểm/chứng chỉ, bảo hành (ngày). */
export const SOON_DAYS_DOCS = 30;
/** Ngưỡng "sắp tới kỳ" cho bảo dưỡng tự ghi + dịch vụ/cước SDVICO (ngày). */
export const SOON_DAYS_SERVICE = 14;

/** "YYYY-MM-DD" của HÔM NAY theo lịch Việt Nam (+07:00). */
export function todayIsoVN(now: Date | number = Date.now()): string {
  return isoDateVN(typeof now === "number" ? now : now.getTime());
}

/**
 * Số ngày (có dấu) từ HÔM NAY (lịch VN) tới `isoDate` ("YYYY-MM-DD").
 *  · 0 = hôm nay · âm = đã qua · dương = còn N ngày
 *  · `today` nhận Date / epoch ms (đổi sang ngày VN) hoặc chuỗi "YYYY-MM-DD" đã
 *    là ngày VN sẵn.
 *  · Ngày không đọc được → NaN (không giả vờ 0 = "hết hạn hôm nay").
 */
export function daysUntil(
  isoDate: string,
  today: Date | number | string,
): number {
  const base = typeof today === "string" ? today : todayIsoVN(today);
  const a = Date.parse(`${base}T00:00:00Z`);
  const b = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / DAY_MS);
}

/** `iso` cộng `n` ngày (âm = lùi) → "YYYY-MM-DD". Ngày hỏng thì trả nguyên. */
export function addDaysIso(iso: string, n: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + n * DAY_MS).toISOString().slice(0, 10);
}
