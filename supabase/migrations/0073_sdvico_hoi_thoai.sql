-- 0073 — HỘI THOẠI SDVICO TRỰC KHÁCH (2026-10-25, anh Long: "cách agent trực hoạt động cũng phải thông minh vào, chat thân
-- thiện, vai trò tư vấn khách hàng" + "tất cả acc của app đang là sđt rồi nên ko cần hỏi lại sđt").
--
-- Một dòng = một người hỏi trên một bài (unique post + SĐT). Máy chủ ghi khi bà con hỏi mua / nhắn tiếp trong luồng
-- (`cho_tra_loi`); bộ trực trên máy GPU (scripts/kairos-truc.mjs, Claude qua gói, mỗi phút) lấy, viết câu tư vấn, gửi lại
-- ⇒ máy chủ đăng bình luận SDVICO + gộp thông tin (số tàu, cảng). Đủ số tàu + cảng ⇒ tự lập phiếu sdvico_khach_hoi (SĐT =
-- SĐT tài khoản). RLS bật + revoke all, KHÔNG policy — chỉ route server.

create table if not exists public.sdvico_hoi_thoai (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  post_id         uuid not null references public.kairos_posts (id) on delete cascade,
  -- gốc luồng nơi SDVICO trả lời (bình luận gốc của khách, hoặc bình luận đầu của SDVICO khi khách hỏi bằng bài)
  goc_comment_id  uuid,
  asker_phone     text not null,
  asker_profile_id uuid not null,
  san_pham        text check (san_pham is null or char_length(san_pham) <= 120),
  so_tau          text check (so_tau is null or char_length(btrim(so_tau)) between 3 and 30),
  cang            text check (cang is null or char_length(btrim(cang)) between 2 and 80),
  trang_thai      text not null default 'cho_tra_loi' check (trang_thai in ('cho_tra_loi', 'da_tra_loi', 'dong')),
  lan_tra_loi     integer not null default 0 check (lan_tra_loi >= 0),
  phieu_id        uuid references public.sdvico_khach_hoi (id) on delete set null,
  unique (post_id, asker_phone)
);

create index if not exists sdvico_hoi_thoai_cho_idx on public.sdvico_hoi_thoai (updated_at) where trang_thai = 'cho_tra_loi';

alter table public.sdvico_hoi_thoai enable row level security;
revoke all on table public.sdvico_hoi_thoai from anon, authenticated;
