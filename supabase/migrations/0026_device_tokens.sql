-- 0026 — CHUỖI CỨNG THEO MÁY (thay phiên Supabase cho app ngư dân)
--
-- Vì sao có (chủ dự án chốt 2026-08-02): phiên Supabase là JWT ngắn hạn + refresh
-- token tự xoay. Ngoài biển, một lượt xoay mà phản hồi không về là máy giữ chuỗi
-- cũ, lần sau dùng lại bị coi là "token bị lộ" ⇒ **thu hồi cả phiên**. Bà con bị
-- đá ra khỏi tài khoản mà KHÔNG ai đăng nhập ở đâu cả. Đó là lỗi gốc; mọi bản vá
-- phía màn hình chỉ đỡ được phần ngọn.
--
-- Luật mới, đúng một câu: **đăng nhập là vô luôn, giữ vĩnh viễn, chỉ mất khi có
-- máy khác đăng nhập cùng số.**
--
--   · đăng nhập đúng SĐT+mật khẩu → sinh MỘT chuỗi cứng, trả về máy, máy giữ mãi
--   · chuỗi KHÔNG hết hạn, KHÔNG xoay, KHÔNG gia hạn — không có gì để hỏng
--   · máy khác đăng nhập cùng số → thu hồi mọi chuỗi cũ NGAY tại lượt đăng nhập
--   · máy cũ gửi request kế tiếp (lúc có sóng) → mọi cửa chặn → máy tự gỡ tài khoản
--
-- ⚠️ KHÔNG LƯU CHUỖI THÔ. Chỉ lưu SHA-256. Bảng này rò ra ngoài thì kẻ đọc được
-- vẫn không đăng nhập thay bà con được. Chuỗi thô chỉ tồn tại đúng một lần trong
-- phản hồi của POST /api/auth/token.
--
-- ⚠️ OFFLINE: bảng này KHÔNG có đường nào chạy ngược về máy để tải/xoá/đổi dữ
-- liệu. Máy bị thu hồi chỉ mất TÀI KHOẢN, giữ nguyên dự báo/bản đồ đã tải —
-- bị đá giữa biển mà mất luôn dự báo là chuyện an toàn tính mạng.
--
-- ✅ ĐÃ APPLY prod 2026-08-02 (chủ dự án ra lệnh "apply đi"). Kiểm sau khi apply:
--    8 cột · RLS bật · 0 policy · anon/authenticated KHÔNG còn quyền bảng ·
--    service_role đủ SELECT/INSERT/UPDATE · 2 index (pkey + partial live-phone).

create table if not exists public.device_tokens (
  token_hash     text primary key,             -- SHA-256 hex của chuỗi thô
  customer_phone text not null,                -- đã chuẩn hoá 0xxxxxxxxx
  device_id      text,                         -- mã máy app tự sinh (0022) — để tra cứu
  platform       text,                         -- ios | android | khac
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,                  -- lượt qua cửa gần nhất
  revoked_at     timestamptz,                  -- null = ĐANG HIỆU LỰC
  revoked_reason text                          -- new_login | user_signout | admin
);

-- Cửa nóng nhất: "SĐT này còn chuỗi nào hiệu lực không" (chạy ở mỗi lượt đăng
-- nhập để thu hồi máy cũ). Partial index vì hàng đã thu hồi không bao giờ được hỏi.
create index if not exists device_tokens_live_phone_idx
  on public.device_tokens (customer_phone)
  where revoked_at is null;

comment on table public.device_tokens is
  'Chuỗi cứng theo máy cho app ngư dân — không hết hạn, chỉ mất khi máy khác đăng nhập cùng SĐT. Chỉ lưu SHA-256, không lưu chuỗi thô.';
comment on column public.device_tokens.revoked_at is
  'NULL = đang hiệu lực. Đặt giá trị = máy đó bị đá; mọi cửa chặn ngay ở request kế tiếp.';

-- ── RLS: KHOÁ KÍN, KHÔNG POLICY NÀO ───────────────────────────────────────
-- Cố ý không viết policy: bảng này CHỈ service key được đụng (route đăng nhập +
-- cổng kiểm chuỗi). Máy khách không có đường đọc bảng chuỗi của bất kỳ ai, kể cả
-- của chính mình. Bật RLS mà không policy = từ chối tất cả với anon/authenticated.
alter table public.device_tokens enable row level security;

-- LỚP KHOÁ THỨ HAI (thêm lúc apply, 2026-08-02): RLS đã chặn, nhưng Supabase
-- vẫn CẤP SẴN quyền bảng cho anon/authenticated khi tạo bảng trong `public`.
-- Ai lỡ tắt RLS một nhát là bảng hở ngay — mà nội dung nó là cặp SĐT ↔ băm
-- chuỗi. Gỡ quyền đi thì có tắt RLS cũng không ai đọc được.
-- `service_role` KHÔNG dính: nó bypass RLS và có grant riêng.
revoke all on public.device_tokens from anon, authenticated;
