-- 0072 — PHIẾU KHÁCH HỎI SẢN PHẨM SDVICO (2026-10-25, anh Long: "tổ chức luôn 1 agent để trực trên sdfish, nếu có người
-- hỏi thăm về sản phẩm hoặc đặt thì nhận và sau đó chuyển vào Zalo công ty nhắn cho nhóm KD SDVico (cấu hình sau trên AI
-- Assistant)… trước đó bot phải làm rõ được các thông số cơ bản như sđt, số tàu, lắp ở cảng nào").
--
-- Một dòng = một lần khách để lại thông tin (phiếu riêng trong app — SĐT KHÔNG xin công khai dưới bình luận). AI Assistant
-- (máy nhà) lấy phiếu `moi` qua GET /api/sdvico/khach-hoi (khoá `sdvico_lead_key`), nhắn nhóm Zalo KD, rồi báo lại
-- POST …/da-bao ⇒ `da_bao`. RLS bật + revoke all, KHÔNG policy: chỉ route server (service role) đọc/ghi.

create table if not exists public.sdvico_khach_hoi (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nguon         text not null check (nguon in ('kairos', 'san-pham', 'sen-bien')),
  san_pham      text check (san_pham is null or char_length(san_pham) between 1 and 120),
  ten           text not null check (char_length(btrim(ten)) between 1 and 80),
  phone         text not null check (phone ~ '^0[0-9]{9}$'),
  so_tau        text not null check (char_length(btrim(so_tau)) between 3 and 30),
  cang          text not null check (char_length(btrim(cang)) between 2 and 80),
  loi_nhan      text check (loi_nhan is null or char_length(loi_nhan) <= 500),
  -- bình luận Kairos dẫn tới phiếu (nếu có) — để KD xem khách đã hỏi gì
  kairos_post_id    uuid,
  kairos_comment_id uuid,
  -- SĐT tài khoản gửi phiếu (null = khách chưa đăng nhập) — đếm trần chống gửi ồ ạt
  nguoi_gui     text,
  trang_thai    text not null default 'moi' check (trang_thai in ('moi', 'da_bao')),
  bao_luc       timestamptz,
  bao_lan       integer not null default 0 check (bao_lan >= 0)
);

create index if not exists sdvico_khach_hoi_moi_idx on public.sdvico_khach_hoi (created_at) where trang_thai = 'moi';
create index if not exists sdvico_khach_hoi_phone_idx on public.sdvico_khach_hoi (phone, created_at desc);

alter table public.sdvico_khach_hoi enable row level security;
revoke all on table public.sdvico_khach_hoi from anon, authenticated;
