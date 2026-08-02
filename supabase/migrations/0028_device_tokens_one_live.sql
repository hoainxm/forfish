-- 0028 — MỘT TÀI KHOẢN CHỈ ĐƯỢC MỘT CHUỖI SỐNG (chặn ở tầng DB)
--
-- Vì sao: `POST /api/auth/token` thu hồi chuỗi cũ rồi cấp chuỗi mới bằng HAI
-- truy vấn rời. Hai lượt đăng nhập chạy sát nhau có thể xen kẽ:
--
--   A: revoke (không còn chuỗi sống)
--   B: revoke (không có gì để thu, no-op)
--   A: insert  → sống
--   B: insert  → CŨNG sống
--
-- ⇒ hai máy cùng hiệu lực, tức luật "1 tài khoản 1 máy" bị phá đúng ở ca nó sinh
-- ra để chặn. Ca này không hiếm như nghe: bà con bấm Đăng nhập hai lần vì mạng
-- chậm, hoặc nhân viên đăng nhập hộ trên máy khác đúng lúc.
--
-- KHÔNG vá bằng cách viết code cẩn thận hơn — đây là ràng buộc, và ràng buộc thì
-- phải nằm ở chỗ không ai lách được. Index UNIQUE PARTIAL: mỗi SĐT nhiều nhất
-- MỘT hàng `revoked_at is null`. Lượt insert thua cuộc NÉM, route trả 503, máy
-- thử lại và lần đó thu hồi được chuỗi của bên kia rồi mới cấp — người đăng nhập
-- SAU thắng, đúng ý nghĩa của tính năng.
--
-- FAIL-CLOSED: xấu nhất là một lượt đăng nhập phải bấm lại. Không có nhánh nào
-- dẫn tới "hai máy cùng sống".
--
-- Thay luôn index thường của 0026 — index unique này phục vụ đúng cùng câu truy
-- vấn ("SĐT này còn chuỗi nào sống không"), giữ cả hai là thừa một index.
--
-- ⚠️ OFFLINE: không ảnh hưởng. Bảng này chỉ được đụng lúc bà con CHỦ ĐỘNG đăng
-- nhập / đăng xuất ở nơi có sóng.
--
-- ✅ ĐÃ APPLY prod 2026-08-02 (bảng đang 0 hàng nên không thể vướng dữ liệu cũ).

drop index if exists public.device_tokens_live_phone_idx;

create unique index if not exists device_tokens_one_live_idx
  on public.device_tokens (customer_phone)
  where revoked_at is null;

comment on index public.device_tokens_one_live_idx is
  'Mot SDT nhieu nhat MOT chuoi song. Rang buoc that cua luat 1-tai-khoan-1-may; xem 0028.';
