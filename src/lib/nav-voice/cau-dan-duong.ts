// CÂU ĐỌC CỦA CHUYẾN DẪN ĐƯỜNG (rà Vietmap 2026-11-02) — gom một chỗ để
// `scripts/sen-bien-giong/lap_manh.mjs` (NGUON) quét ra mảnh giọng Mỹ Duyên.
// Câu chọn theo mảnh ĐÃ CÓ khi được (cổng ghep-giong.test.ts); câu còn thiếu
// mảnh đọc giọng máy cả câu theo luật "một câu một giọng" (nợ ghi trong test).

import { formatHoursVN } from "@/lib/route-plan";
import { dirSpeech, distSpeech, type SpeechUnit } from "@/lib/nav-voice/phrases";

/** lời dặn quan trọng nhất của tấm "Bắt đầu chạy" — tấm có thể không bao giờ hiện */
export const CAU_TAT_MAN = "Tắt màn hình là máy ngừng đọc.";
/** tới nơi + đứng yên đủ lâu ⇒ máy tự thôi dẫn */
export const CAU_TU_DUNG = "Đã tới gần điểm đến. Đã dừng dẫn đường.";
/** lượt thử lại nạp đủ kho hải đồ (bản tin mở đầu đã nói "chưa đủ") */
export const CAU_DU_HAI_DO = "Máy đang canh độ sâu, rạn và chướng ngại phía trước.";

/** Câu lúc bấm Bắt đầu: quãng · giờ · hướng đầu + lời dặn tắt màn. */
export function cauBatDau(distKm: number, hours: number, huongDauDeg: number | null, unit: SpeechUnit): string {
  const huong = huongDauDeg != null && Number.isFinite(huongDauDeg) ? ` Đi về phía ${dirSpeech(huongDauDeg)}.` : "";
  return `Bắt đầu dẫn đường. Còn chừng ${distSpeech(distKm, unit)}, chừng ${formatHoursVN(hours)}.${huong} ${CAU_TAT_MAN}`;
}
