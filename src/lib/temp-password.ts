// Mật khẩu tạm khi admin ĐẶT LẠI mật khẩu cho khách (/api/admin/accounts
// action='reset-password') — CỐ ĐỊNH "sd123456" (user chốt 2026-07-29) để
// sale/admin báo miệng cho khách 40–60 tuổi không cần đọc từng số ngẫu nhiên.
// Đủ an toàn vì: chỉ sống tới lần đăng nhập kế (must_change_password bắt tự
// đổi ngay) + Supabase rate-limit đăng nhập sai. KHÔNG phải secret hệ thống.
export const TEMP_RESET_PASSWORD = "sd123456";
