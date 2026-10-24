-- 0071 — KAIROS NHẮC TÊN (@tag) kiểu Facebook (2026-10-24, anh Long: "các hành vi comment tag tên nhau đăng bài kèm
-- tag thì sao? ko thấy có, hệ thống 2000 ấy").
-- Chỉ CỘNG THÊM cột `mentions` cho bài + bình luận: mảng [{id: profileId, ten: tên gọi LÚC TAG}] — chữ "@tên" vẫn nằm
-- trong body (đọc được dù thiếu cột), cột chỉ nói đoạn "@tên" nào là người nào (đổi tên sau vẫn trỏ đúng trang).
-- Route server mới ghi (lọc: profile có thật, "@tên" có trong chữ, không tự tag, không tag người chặn mình/mình chặn,
-- ≤10). Không đụng RLS (bảng vẫn revoke all). Chạy lại an toàn.

alter table public.kairos_posts
  add column if not exists mentions jsonb not null default '[]'::jsonb;
alter table public.kairos_comments
  add column if not exists mentions jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kairos_posts_mentions_chk') then
    alter table public.kairos_posts
      add constraint kairos_posts_mentions_chk check (jsonb_typeof(mentions) = 'array' and jsonb_array_length(mentions) <= 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kairos_comments_mentions_chk') then
    alter table public.kairos_comments
      add constraint kairos_comments_mentions_chk check (jsonb_typeof(mentions) = 'array' and jsonb_array_length(mentions) <= 10);
  end if;
end $$;
