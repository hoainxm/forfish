-- 0075 — KAIROS TRA CỨU DANH SÁCH TRONG FILE ĐÍNH KÈM THÔNG BÁO (2026-10-26, anh Long: "các tin dạng này cho click
-- tra cứu tên tàu hoặc chủ tàu để show luôn đoạn đó cho nhanh"). Spec 14 §21b.
--
-- Máy thu (GPU) đọc PDF danh sách (pdftotext) thành từng dòng tàu rồi gửi PUT /api/kairos/dinh-kem (khoá ingest);
-- máy chủ THAY cả bộ dòng của (bài, file). Bà con tra ở thẻ bài: GET /api/kairos/posts/[id]/tra?q= (số đăng ký /
-- tên chủ tàu, cột *_norm) hoặc app tự so số đăng ký tàu trong sổ. CCCD trong dòng đã che ở máy thu (3 số đầu + 3 cuối).
-- Khuôn 0063/0065: RLS bật, KHÔNG policy, revoke anon/authenticated — chỉ route server (service role) đọc/ghi. Chạy lại an toàn.

create table if not exists public.kairos_dinh_kem_dong (
  id          bigserial primary key,
  post_id     uuid not null references public.kairos_posts(id) on delete cascade,
  url_hash    text not null check (char_length(url_hash) <= 64),      -- băm link file đính kèm (lien-ket.urlHash)
  stt         integer not null default 0 check (stt between 0 and 99999),
  ten         text not null default '' check (char_length(ten) <= 80),  -- họ tên chủ tàu (ô đầu dòng)
  ten_norm    text not null default '' check (char_length(ten_norm) <= 80),
  reg         text not null check (char_length(reg) <= 20),            -- số đăng ký "BĐ-93333-TS"
  reg_norm    text not null check (char_length(reg_norm) <= 20),       -- "BD93333TS"
  noi_dung    text not null check (char_length(noi_dung) between 1 and 400),  -- cả dòng, CCCD đã che
  page        integer not null default 1 check (page between 1 and 9999),
  created_at  timestamptz not null default now()
);

create index if not exists kairos_dinh_kem_dong_post_idx on public.kairos_dinh_kem_dong (post_id, url_hash);
create index if not exists kairos_dinh_kem_dong_reg_idx on public.kairos_dinh_kem_dong (post_id, reg_norm);

alter table public.kairos_dinh_kem_dong enable row level security;
revoke all on table public.kairos_dinh_kem_dong from anon, authenticated;
revoke all on sequence public.kairos_dinh_kem_dong_id_seq from anon, authenticated;
