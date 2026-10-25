// KAIROS — ĐẦU MÀN /kairos (E K3-03, rà FB 2026-10-25). THUẦN — luật hiện/ẩn hai thứ đứng TRƯỚC bài đầu:
//  · Câu phụ dưới tiêu đề ("Kết nối bà con đi biển…"): câu đúng (anh Long 24/10) nhưng chỉ có giá trị lúc CHƯA
//    có gì để đọc — FB dạy "dưới tên app là ô 'Bạn đang nghĩ gì' rồi bài"; mỗi px trước bài đầu là một px bà con
//    cuộn mỗi ngày. Hiện khi khách chưa đăng nhập hoặc dòng tin trống (không bài, không bản lưu).
//  · Pill "Tải tin mang đi" (14 §19): một hàng cùng khuôn "Có N bài mới" — chữ ngắn + nút + × góc, KHÔNG tự tải
//    (Safari không cho biết Wi-Fi hay 4G; 100 bài ≈ 400 KB vào kho có trần — bà con quyết, một chạm).

import { NHAN } from "@/lib/labels";

/** Trạng thái pill (kairos-feed `GoiY`): `an` không vẽ · `hien` mời · `dang` đang tải · `loi` trang đầu hỏng. */
export type PillGoiY = "an" | "hien" | "dang" | "loi";

/**
 * Có hiện câu phụ không. `trong` = dòng tin trống (null = dòng tin chưa đọc xong máy ⇒ coi là có bài để header
 * không nhảy). Chưa biết đăng nhập hay chưa (`authReady` false) cũng coi là đã đăng nhập — thà thiếu một câu giới
 * thiệu một nhịp còn hơn chớp hiện rồi biến.
 */
export function hienCauPhu(o: { authReady: boolean; signedIn: boolean; trong: boolean | null }): boolean {
  if (o.authReady && !o.signedIn) return true;
  return o.trong === true;
}

/** Chữ + nút của pill theo trạng thái; `an` ⇒ null (không vẽ). × (Để sau) chỉ khi còn mời/lỗi — đang tải không huỷ được. */
export function pillTaiMangDi(k: PillGoiY): { chu: string; nut: string | null; dangTai: boolean; x: boolean } | null {
  switch (k) {
    case "hien":
      return { chu: "Tải bài đọc trên biển", nut: NHAN.tai, dangTai: false, x: true };
    case "dang":
      return { chu: "Đang tải…", nut: null, dangTai: true, x: false };
    case "loi":
      return { chu: "Chưa tải được", nut: NHAN.thuLai, dangTai: false, x: true };
    default:
      return null;
  }
}

/** Câu toast khi Tải xong / máy đầy (14 §19). `n` = bài vừa tải CÒN trong bản lưu sau khi cắt trần. */
export function toastTaiMangDi(r: { kind: "xong"; n: number } | { kind: "day" }): { text: string; loai: "tot" | "xau" } {
  if (r.kind === "day") return { text: "Máy đầy, chưa lưu được bài mang đi.", loai: "xau" };
  return r.n > 0 ? { text: `Đã tải ${r.n} bài — mất sóng vẫn đọc được`, loai: "tot" } : { text: "Chưa lưu được bài nào vào máy.", loai: "xau" };
}
