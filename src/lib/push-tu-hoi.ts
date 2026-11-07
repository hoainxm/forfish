/**
 * TỰ HỎI QUYỀN THÔNG BÁO (2026-11-07, anh Long: "cho tự động bật thông báo cả đi").
 *
 * Đo 07/11: 15.279 tin S-Tracking tới 1.859 chủ tàu mà KHÔNG máy nào nhận được — chưa ai bật thông báo, vì cách bật
 * duy nhất là hàng "Bật chuông" cuối Trang chủ (≤3 lần) hay công tắc trong Tài khoản. Trình duyệt KHÔNG cho tự cấp
 * quyền: hộp xin quyền chỉ được bật ra từ một cú chạm của người dùng (iPhone bắt buộc, Chrome thì hạ thành biểu tượng
 * chuông nhỏ nếu hỏi không cớ). Nên "tự động" = hộp xin quyền hiện ở CÚ CHẠM ĐẦU TIÊN bà con chạm vào app.
 *
 * Luật (thuần, có test):
 *  · chỉ khi quyền còn "default" — "denied" là bà con đã chặn, hỏi nữa trình duyệt cũng không cho;
 *  · không hỏi khi bà con TỰ TẮT công tắc (`pushUserOff`) — tôn trọng lựa chọn;
 *  · cần sóng (đăng ký phải tới máy chủ Apple/Google);
 *  · bấm đóng hộp không chọn ⇒ cách TU_HOI_GAP_MS mới hỏi lại (Chrome tự chặn hẳn sau vài lần bị đóng liền);
 *  · không hỏi ở web quản trị `/quan-tri` (nhân viên, không phải bà con).
 */

export const TU_HOI_KEY = "forfish.push.tuHoi.v1";
/** Hai lần tự hỏi cách nhau ít nhất 3 ngày. */
export const TU_HOI_GAP_MS = 3 * 24 * 60 * 60 * 1000;

export type TrangThaiTuHoi = {
  hoTro: boolean;
  quyen: string | undefined;
  userOff: boolean;
  online: boolean;
  lanHoiTruoc: number | null;
  now: number;
  path: string;
};

export function nenTuHoiQuyen(t: TrangThaiTuHoi): boolean {
  if (!t.hoTro || t.quyen !== "default") return false;
  if (t.userOff || !t.online) return false;
  if (t.path.startsWith("/quan-tri")) return false;
  if (t.lanHoiTruoc != null && t.now - t.lanHoiTruoc < TU_HOI_GAP_MS) return false;
  return true;
}

export function docLanHoi(): number | null {
  try {
    const n = Number(localStorage.getItem(TU_HOI_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function ghiLanHoi(now: number): void {
  try {
    localStorage.setItem(TU_HOI_KEY, String(now));
  } catch {
    /* chế độ riêng tư — tệ nhất là hỏi lại lần mở sau */
  }
}
