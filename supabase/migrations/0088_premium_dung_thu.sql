-- 0088 — DÙNG THỬ PREMIUM THEO NGÀY (2026-11-12, ba-spec 20). Nhân sự muốn mở premium 3–5 ngày cho bà con xem thử
-- trước khi mua; hôm nay kỳ hạn nhỏ nhất là 1 tháng và mọi lượt cấp đều bị đếm là LƯỢT BÁN (`isSaleGrant`).
--
-- Chỉ NỚI ràng buộc `action` của nhật ký cấp để nhận thêm `'trial'`. Không thêm cột, không đổi dữ liệu cũ.
-- Lượt `trial` KHÔNG phải lượt bán (báo cáo + "đang quản" chỉ đếm activate/renew) và là bằng chứng
-- "khách này đã dùng thử" (mỗi khách một lần — R4 ba-spec 20).
--
-- Chưa apply mà code mới đã chạy: lượt dùng thử ghi nhật ký TRƯỚC khi đổi hạng ⇒ ghi hỏng thì trả 503,
-- không mở premium (không có lượt dùng thử nào lọt mà không để lại dấu). Idempotent.

alter table public.premium_grants
  drop constraint if exists premium_grants_action_check;

alter table public.premium_grants
  add constraint premium_grants_action_check
  check (action in ('activate', 'renew', 'downgrade', 'trial'));

-- MỖI KHÁCH MỘT LẦN, chặn ở DB (không chỉ ở route): hai nhân sự bấm cùng lúc thì lượt sau vấp 23505
-- ⇒ route trả 409 trial_used. Chỉ áp cho hàng `trial`, các loại khác không đụng.
create unique index if not exists premium_grants_one_trial_idx
  on public.premium_grants (customer_phone)
  where action = 'trial';

comment on column public.premium_grants.action is
  'activate | renew | downgrade | trial (dùng thử theo ngày — không phải lượt bán, mỗi khách tối đa 1 lần; 0088).';
