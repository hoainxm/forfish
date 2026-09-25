// Mật khẩu: bỏ khoảng trắng ĐẦU/CUỐI (bàn phím di động, dán từ tin nhắn hay tự
// thêm dấu cách → KH gõ đúng vẫn báo sai). Giữ khoảng trắng GIỮA (mật khẩu cụm
// từ vẫn hợp lệ). Áp dụng ĐỒNG NHẤT cả lúc ĐẶT lẫn lúc KIỂM TRA để một mật khẩu
// khớp ở mọi nơi: đăng nhập, đổi mật khẩu, đăng ký, đồng bộ SDWork. THUẦN — dùng
// cả client lẫn server. Lỗi DN-001 (báo cáo test tuần).
export function normalizePassword(raw: string): string {
  return raw.trim();
}

// LUẬT MẬT KHẨU DUY NHẤT (chủ dự án chốt 2026-09-25): đặt TỰ DO — KHÔNG bắt
// buộc chữ hoa/thường/chữ số/ký tự đặc biệt. Điều kiện duy nhất là TỐI THIỂU 6
// ký tự. Ngư dân 40–60 tuổi gõ trên tàu lắc, tay ướt: luật càng ít càng đỡ kẹt.
export const PASSWORD_MIN_LENGTH = 6;

// Kiểm mật khẩu theo LUẬT DUY NHẤT trên. Đếm sau khi bỏ khoảng trắng đầu/cuối
// (khớp normalizePassword — thứ được áp cả lúc ĐẶT lẫn lúc đăng nhập), nên "6
// dấu cách" không tính là hợp lệ. Trả câu nhắc tiếng bà con nếu CHƯA đạt, `null`
// nếu ĐẠT. THUẦN — client (nhãn kiểm tra tại chỗ + chặn submit) và server
// (route signup) dùng CHUNG để một luật nằm một chỗ, không lệch nhau.
export function passwordProblem(raw: string): string | null {
  if (normalizePassword(raw).length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  return null;
}

// NHÃN KIỂM TRA TẠI CHỖ cho ô đặt mật khẩu mới (user 2026-09-25: "chưa có label
// verify chính xác… chỉ báo lỗi"). Trả trạng thái + câu nói ĐÚNG luật hiện tại
// để hiện NGAY khi gõ (không đợi submit): chưa gõ = mời + nói luật; đang gõ mà
// thiếu = đếm rõ còn thiếu; đủ = báo đạt kèm số ký tự. THUẦN để test được logic
// nhãn không cần render (suite chỉ chạy *.test.ts). `ok` để component tô màu.
export function passwordRuleHint(
  raw: string,
  minLength: number = PASSWORD_MIN_LENGTH,
): { ok: boolean; text: string } {
  const len = normalizePassword(raw).length;
  if (len >= minLength) {
    return { ok: true, text: `✓ Được rồi — mật khẩu đủ dài (${len} ký tự).` };
  }
  if (len === 0) {
    return {
      ok: false,
      text: `Đặt mật khẩu tự do, chỉ cần ít nhất ${minLength} ký tự.`,
    };
  }
  return { ok: false, text: `Cần ít nhất ${minLength} ký tự — đang có ${len}.` };
}
