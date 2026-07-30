-- SDFish — TÀI KHOẢN ADMIN CHUNG (sdvico 2026-07-30). Thay vì gán SĐT CÁ NHÂN
-- vào env ADMIN_PHONES (không đúng logic — admin gắn với 1 người), lập 1 tài
-- khoản admin DÙNG CHUNG: customers.role='admin' (= full-admin ngang env, xem
-- admin-auth.ts requireStaff). Env ADMIN_PHONES giữ 1 SĐT bootstrap break-glass
-- phòng khi DB hỏng.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).
--
-- LƯU Ý: migration này CHỈ lập HỒ SƠ (customers row). ĐĂNG NHẬP (auth.users) phải
-- provision RIÊNG: admin hiện tại vào /quan-tri → "Tạo tài khoản" → chọn
-- "Admin — toàn quyền", SĐT 0900000001, mật khẩu tạm sd123456 (app bắt đổi lần
-- đầu). Form upsert lại đúng row này (idempotent theo phone) + tạo auth user.

insert into public.customers (phone, name, role, updated_at)
values ('0900000001', 'Quản trị SDVICO', 'admin', now())
on conflict (phone) do update set role = 'admin', updated_at = now();
