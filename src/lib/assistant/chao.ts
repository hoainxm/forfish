// LỜI CHÀO SEN BIỂN KÈM VIỆC GẤP VỀ GIẤY TỜ (2026-10-27, anh Long hỏi "sen biển đọc ?" về nhắc hạn giấy rồi chốt
// "hoàn thiện hết đi"). Trước đây Sen Biển chỉ đọc hạn giấy khi bà con HỎI; nay lúc chạm gọi, giấy nào đã hết hạn hoặc
// còn ≤ NGAY_NHAC_CHAO ngày thì Sen Biển nói trước một câu rồi mới hỏi "giúp gì". Thuần, có test.
//
// Ngưỡng 5 ngày = đúng khúc thông báo điện thoại báo HẰNG NGÀY (lib/doc-reminders) — xa hơn mà ngày nào mở Sen Biển
// cũng nghe nhắc là thành tiếng ồn, bà con sẽ bỏ gọi Sen Biển.

import type { DocSummary } from "@/lib/assistant/types";

export const CHAO_GOC = "Sen Biển giúp gì được cho bạn?";
/** Giấy còn ngần này ngày trở xuống (hoặc đã hết hạn) thì Sen Biển nói trước khi chào. */
export const NGAY_NHAC_CHAO = 5;

/** Câu chào: không có giấy gấp ⇒ câu gốc; có ⇒ nhắc giấy gấp nhất (+ đếm số giấy gấp khác) rồi câu gốc. */
export function cauChao(docs: DocSummary[] | null | undefined): string {
  const gap = (docs ?? [])
    .filter((d): d is DocSummary & { daysLeft: number } => d.daysLeft !== null && (d.level === "expired" || d.daysLeft <= NGAY_NHAC_CHAO))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  if (gap.length === 0) return CHAO_GOC;
  const d = gap[0];
  const khi = d.daysLeft < 0 ? `đã quá hạn ${-d.daysLeft} ngày` : d.daysLeft === 0 ? "hết hạn hôm nay" : `còn ${d.daysLeft} ngày là hết hạn`;
  const them = gap.length > 1 ? ` Còn ${gap.length - 1} giấy khác cũng sắp hết.` : "";
  return `${d.label} ${khi}, bà con lo gia hạn kẻo bị phạt.${them} ${CHAO_GOC}`;
}
