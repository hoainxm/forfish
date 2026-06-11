// Định dạng dùng chung — gộp các bản copy-paste rải rác (formatVnDate ×6,
// tiền VND nhiều nơi). Một nguồn duy nhất để hiển thị nhất quán.

/** ISO yyyy-mm-dd → dd/mm/yyyy (lịch VN). */
export function formatVnDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Số tiền đồng, có dấu phân cách nghìn kiểu VN: 12500000 → "12.500.000 đ". */
export function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

/** Tiền gọn cho ô thống kê: 12_500_000 → "12,5 tr"; <1tr giữ nguyên số. */
export function formatVndShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const m = value / 1_000_000;
    return `${(m % 1 === 0 ? m : Number(m.toFixed(1))).toLocaleString("vi-VN")} tr`;
  }
  return value.toLocaleString("vi-VN");
}

/** Đọc chuỗi người dùng gõ vào ô tiền → số nguyên đồng (bỏ ký tự không phải số). */
export function parseVnd(input: string): number {
  return parseInt(input.replace(/\D/g, ""), 10) || 0;
}

/* Ô NHẬP TIỀN (chuyển từ trip-log ra dùng chung, hội đồng UX 2026-06-11):
   state giữ CHUỖI SỐ THÔ ("45000000"), hiển thị có chấm nghìn, cap 12 số
   — chặn lỗi thừa/thiếu một số 0 làm lãi/lỗ lệch 10 lần. */

/** "12500000" → "12.500.000" khi đang gõ; rỗng giữ rỗng. */
export function formatDigits(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

/** Lọc input về chuỗi số thô, tối đa 12 chữ số (999 tỷ — quá đủ). */
export function parseDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 12);
}

/** Dòng đọc-lại cho ô tiền ≥ 1 triệu: 45000000 → "45 triệu đồng". */
export function readbackVnd(value: number): string | null {
  if (value < 1_000_000) return null;
  const m = value / 1_000_000;
  const mStr = (m % 1 === 0 ? m : Number(m.toFixed(1))).toLocaleString("vi-VN");
  return `${mStr} triệu đồng`;
}
