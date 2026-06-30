// Mật khẩu: bỏ khoảng trắng ĐẦU/CUỐI (bàn phím di động, dán từ tin nhắn hay tự
// thêm dấu cách → KH gõ đúng vẫn báo sai). Giữ khoảng trắng GIỮA (mật khẩu cụm
// từ vẫn hợp lệ). Áp dụng ĐỒNG NHẤT cả lúc ĐẶT lẫn lúc KIỂM TRA để một mật khẩu
// khớp ở mọi nơi: đăng nhập, đổi mật khẩu, đăng ký, đồng bộ SDWork. THUẦN — dùng
// cả client lẫn server. Lỗi DN-001 (báo cáo test tuần).
export function normalizePassword(raw: string): string {
  return raw.trim();
}
