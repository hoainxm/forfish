-- 0074 — KAIROS TIN CHÍNH SÁCH (2026-10-26, anh Long: "trong Kairos tổ chức thêm 1 tab tin chính sách, lấy thông tin từ
-- các tên miền gov, theo hướng thông báo của nhà nước cho bà con, đọc và tóm tắt cho bà con; link thông báo hỗ trợ tiền
-- dầu của Gia Lai (Bình Định cũ) có danh sách bà con được duyệt theo các đợt"). Spec: 14-ba-spec-kairos §21.
--
-- Hai việc, đều CỘNG THÊM, chạy lại an toàn, không đụng RLS (bảng vẫn revoke all):
--   1. Chủ đề mới 'chinh-sach' cho kairos_sources.topic + kairos_posts.topic (check inline của 0065 tên mặc định
--      `<bảng>_topic_check`): bài báo từ nguồn *.gov.vn, kind vẫn 'bao' (có url/title), chỉ máy thu gắn.
--   2. kairos_posts.attachments jsonb — file đính kèm của thông báo [{title, url}] ≤10 (PDF danh sách tàu được duyệt
--      theo đợt…); máy chủ chỉ nhận link trên tên miền *.gov.vn (lib/kairos/chinh-sach.mjs kiemDinhKem).

alter table public.kairos_sources drop constraint if exists kairos_sources_topic_check;
alter table public.kairos_sources
  add constraint kairos_sources_topic_check
  check (topic in ('nghe-ca','thoi-su','phap-luat','doi-song','the-thao','giai-tri','kinh-te','chinh-sach'));

alter table public.kairos_posts drop constraint if exists kairos_posts_topic_check;
alter table public.kairos_posts
  add constraint kairos_posts_topic_check
  check (topic in ('nghe-ca','thoi-su','phap-luat','doi-song','the-thao','giai-tri','kinh-te','chinh-sach'));

alter table public.kairos_posts
  add column if not exists attachments jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kairos_posts_attachments_chk') then
    alter table public.kairos_posts
      add constraint kairos_posts_attachments_chk check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10);
  end if;
end $$;
