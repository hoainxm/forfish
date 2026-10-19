/*
  CÔNG TẮC SEN BIỂN (chủ dự án 2026-10-19): Sen Biển còn là bản DEMO — đã lỡ đẩy lên
  prod, tạm ẩn tới đợt release. Luật "tính năng demo không lên prod": ops/sync-base-flow.md §0b.

  Đọc lúc BUILD (`NEXT_PUBLIC_*` Next nhúng thẳng vào bundle):
    · "1" ⇒ bật · "0" ⇒ tắt
    · không khai ⇒ chỉ bật khi `next dev` — build prod/Android mặc định TẮT, quên cờ là an toàn.
  Mở lại khi release: khai `NEXT_PUBLIC_SEN_BIEN=1` ở môi trường build prod rồi deploy lại.
  Tắt chỉ ẩn điểm vào + không tải mô hình; KHÔNG xoá kho mô hình hay mẫu câu nói đã có trong máy.
*/
export function senBienBat(co: string | undefined, nodeEnv: string | undefined): boolean {
  if (co === "1") return true;
  if (co === "0") return false;
  return nodeEnv === "development";
}

export const SEN_BIEN_BAT = senBienBat(process.env.NEXT_PUBLIC_SEN_BIEN, process.env.NODE_ENV);
