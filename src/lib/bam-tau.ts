// CAMERA BÁM TÀU trên bản đồ — luật thuần (test: bam-tau.test.ts). 07 §"Bám tàu", 2026-10-25.
//
// Anh Long: "cái bản đồ đang hay tự kéo về vị trí hiện tại (trong khi người dùng đang muốn xem thông tin ở chỗ
// khác)". Gốc: mở bản đồ là tự bật Đang chạy (Tự đọc), và camera bay về tàu MỖI fix GPS (~1 giây). Sửa theo kiểu
// Google Maps:
//   · Đang chạy TỰ BẬT lúc mở bản đồ ⇒ chỉ canh + đọc cảnh báo, KHÔNG kéo camera (bà con mở bản đồ để xem).
//   · Bấm dẫn đường theo tuyến, hoặc chạm nút vòng ngắm (về tàu) khi đang chạy ⇒ BÁM.
//   · Bà con tự kéo / phóng to-thu nhỏ bằng tay ⇒ THÔI BÁM ngay; nút vòng ngắm đổi màu cho biết, chạm là bám lại.
//   · Dừng chạy ⇒ thôi bám.
// Cảnh báo bão/ranh giới/đọc giọng KHÔNG phụ thuộc cờ này — chỉ camera.

export type SuKienBam = "bat-dan-duong" | "ve-tau" | "keo-tay" | "dung";

/** Cờ bám tàu sau một sự kiện. `ve-tau` chỉ bật bám khi đang chạy (không chạy thì nút chỉ bay tới một lần). */
export function bamSau(bam: boolean, ev: SuKienBam, dangChay: boolean): boolean {
  switch (ev) {
    case "bat-dan-duong":
      return true;
    case "ve-tau":
      return dangChay;
    case "keo-tay":
    case "dung":
      return false;
    default:
      return bam;
  }
}

/** Có bay camera theo fix GPS mới không: đang chạy + đang bám + định vị còn tốt (mất định vị ⇒ giữ khung). */
export function nenBayTheoFix(dangChay: boolean, bam: boolean, status: string, coViTri: boolean): boolean {
  return dangChay && bam && coViTri && status === "tracking";
}

/** Sự kiện kéo/zoom của bản đồ có phải TAY bà con không (MapLibre: flyTo/easeTo của app không có originalEvent). */
export const laThaoTacTay = (e: { originalEvent?: unknown } | null | undefined): boolean => !!e?.originalEvent;
