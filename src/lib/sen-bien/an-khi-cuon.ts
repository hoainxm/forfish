/*
  NÚT NỔI SEN BIỂN ẨN KHI CUỘN XUỐNG, HIỆN KHI CUỘN LÊN (rà bố cục 2026-10-22, anh Long:
  "xử lý theo các app hiện đại nhất, đông user nhất" — Gmail, Facebook, Material "hide on
  scroll"). Icon nổi ở mép phải đè nút trong nội dung (+ Thêm, Gọi, chevron dòng giá…);
  bà con đang cuộn tìm thứ khác thì icon lùi đi, vừa kéo ngược lên là nó quay lại.

  THUẦN để test: nhận vị trí cuộn cũ/mới, trả trạng thái ẩn mới.
*/
/** Bỏ qua rung tay — dưới ngưỡng này coi như không cuộn. */
export const NGUONG_CUON_PX = 8;
/** Gần đầu trang thì luôn hiện (chưa có gì để che). */
export const DAU_TRANG_PX = 48;

export function anKhiCuon(yCu: number, yMoi: number, dangAn: boolean): boolean {
  if (yMoi <= DAU_TRANG_PX) return false;
  const d = yMoi - yCu;
  if (d > NGUONG_CUON_PX) return true;
  if (d < -NGUONG_CUON_PX) return false;
  return dangAn;
}
