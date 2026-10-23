-- SDFish — KAIROS: ĐỌC BÁO + MẠNG XÃ HỘI CỦA BÀ CON (2026-10-23)
--
-- Chủ dự án chốt 2026-10-23: thêm MỘT tab "Kairos" — dòng tin trộn bài báo tóm tắt (5 báo,
-- thu trên máy GPU nhà), bài Chính thức của SDVICO và bài bà con (chữ + ≤5 ảnh, Hay, bình
-- luận 1 cấp, đăng lại, theo dõi, chặn, báo xấu, Bến theo cảng). Hành vi: 14-ba-spec-kairos.md.
--
-- Auth: khuôn 0037/0060/0063 — RLS bật, KHÔNG policy, revoke anon/authenticated trên MỌI bảng.
-- Mọi đọc/ghi qua route service-role: /api/kairos/* (identityFromRequest), /api/admin/kairos/*
-- (staff), /api/kairos/nhap (khoá ingest). Client KHÔNG chạm bảng.
-- SĐT (`*_phone`) đã normalizeVnPhone, lấy từ chuỗi cứng — KHÔNG BAO GIỜ từ body, KHÔNG BAO
-- GIỜ ra client: route trả `kairos_profiles.id` (uuid) làm danh tính công khai.
--
-- ⛔ CHƯA APPLY. Không áp lên remote khi anh Long chưa duyệt. Thứ tự: apply 0065 → deploy.
-- Xem docs/app-map/04-data-model.md mục "KAIROS" + 14-ba-spec-kairos.md §6.

-- ── 1. Hồ sơ tên gọi ─────────────────────────────────────────────────────
-- id là danh tính CÔNG KHAI (URL /kairos/u/[id]); phone chỉ ở máy chủ.
-- handle_norm = thường + bỏ dấu + đ→d + dấu câu thành khoảng trắng + gộp khoảng trắng
-- (lib/kairos/ten-goi.ts handleNorm) — unique ⇒ "Bà Con" và "ba  con" là một tên.
create table if not exists public.kairos_profiles (
  id                 uuid primary key default gen_random_uuid(),
  phone              text not null unique,
  handle             text not null check (char_length(handle) between 2 and 20),
  handle_norm        text not null unique check (char_length(handle_norm) between 1 and 40),
  handle_changed_at  timestamptz,                       -- null = chưa đổi lần nào (lần đặt đầu không tính)
  avatar_path        text check (avatar_path is null or char_length(avatar_path) <= 200),
  show_boat          boolean not null default false,    -- số hiệu tàu chỉ hiện khi chủ bật
  official           boolean not null default false,    -- dấu "Chính thức" — chỉ SDVICO
  rules_accepted_at  timestamptz,                       -- null ⇒ ghi bài trả 409 rules
  banned_until       timestamptz,                       -- > now() ⇒ ghi trả 403 banned (vẫn đọc)
  ban_reason         text check (ban_reason is null or char_length(ban_reason) <= 300),
  created_at         timestamptz not null default now()
);
comment on table public.kairos_profiles is 'Kairos: tên gọi + trạng thái của một SĐT. id là danh tính công khai; phone không ra client.';

-- Hồ sơ SDVICO: phone là SENTINEL (khuôn shop SDVICO 0060) — không hardcode số thật của ai.
-- Bài kind=chinh-thuc ghi author_phone = 'sdvico:chinh-thuc'.
insert into public.kairos_profiles (phone, handle, handle_norm, official, rules_accepted_at)
values ('sdvico:chinh-thuc', 'SDVICO', 'sdvico', true, now())
on conflict (phone) do nothing;

-- ── 2. Nguồn báo ─────────────────────────────────────────────────────────
-- id = mã nguồn trong scripts/kairos-nguon.json (vd 'vnexpress-thoi-su'). /api/kairos/nhap
-- upsert last_ok_at/last_error mỗi lượt.
create table if not exists public.kairos_sources (
  id          text primary key check (char_length(id) between 2 and 60),
  outlet      text not null check (char_length(outlet) between 2 and 60),   -- tên báo hiện trên thẻ
  feed_url    text not null check (char_length(feed_url) <= 500),
  section     text not null check (char_length(section) <= 40),           -- mục RSS: thoi-su, thuy-san…
  topic       text not null check (topic in ('nghe-ca','thoi-su','phap-luat','doi-song','the-thao','giai-tri','kinh-te')),
  enabled     boolean not null default true,
  last_ok_at  timestamptz,
  last_error  text check (last_error is null or char_length(last_error) <= 500)
);

-- ── 3. Bài ───────────────────────────────────────────────────────────────
-- Ba loại chung một bảng (một dòng tin, một cursor): bao (máy thu tin) · chinh-thuc (SDVICO)
-- · ba-con. images = mảng đường kho kairos-media '<profileId>/<uuid>.jpg' (≤5).
create table if not exists public.kairos_posts (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('bao','chinh-thuc','ba-con')),
  author_phone   text,                                  -- null với bao
  source_id      text,                                  -- kairos_sources.id (không FK: nhập không chờ nguồn)
  outlet         text check (outlet is null or char_length(outlet) <= 60),
  url            text check (url is null or char_length(url) <= 1000),    -- link gốc đã chuẩn hoá
  url_hash       text unique,                           -- sha256(url chuẩn hoá) — trùng link bỏ VĨNH VIỄN
  title          text check (title is null or char_length(title) <= 300),
  title_norm     text check (title_norm is null or char_length(title_norm) <= 300),
  body           text not null default '' check (char_length(body) <= 2000),
  summary        text check (summary is null or char_length(summary) <= 1000),
  summary_by     text check (summary_by is null or summary_by in ('ai','rss')),
  cover_url      text check (cover_url is null or char_length(cover_url) <= 1000),  -- ảnh RSS, không tải về kho
  images         jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 5),
  topic          text not null default 'nghe-ca'
                   check (topic in ('nghe-ca','thoi-su','phap-luat','doi-song','the-thao','giai-tri','kinh-te')),
  regions        text[] not null default '{}',          -- vinh-bac-bo · mien-trung · dong-nam-bo · tay-nam-bo · hoang-sa-truong-sa · ca-nuoc
  provinces      text[] not null default '{}',          -- mã 34 tỉnh sau sáp nhập (lib/kairos/khu-vuc.ts)
  ports          text[] not null default '{}',          -- id trong src/data/fishing-ports.ts
  reshare_of     uuid references public.kairos_posts (id) on delete set null,   -- gốc xoá ⇒ "Bài gốc không còn"
  pinned_until   timestamptz,                           -- chỉ chinh-thuc
  hidden         boolean not null default false,
  hidden_reason  text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  -- Kiểm duyệt tự động (AC24, §8b): bao vào 'cho-kiem' và CHỈ lên dòng tin khi 'dat';
  -- chinh-thuc/ba-con vào 'cho-kiem' nhưng HIỆN NGAY (đã qua lọc chữ ở route), agent quét sau.
  mod_state      text not null default 'cho-kiem' check (mod_state in ('cho-kiem','dat','nghi','chan')),
  mod_checked_at timestamptz,
  hay_count      integer not null default 0 check (hay_count >= 0),       -- trigger §9
  comment_count  integer not null default 0 check (comment_count >= 0),   -- trigger §9
  published_at   timestamptz not null default now(),    -- bài báo: giờ báo đăng; còn lại = created_at
  -- Giờ bài LÊN dòng tin — khoá xếp + cursor + "Có N bài mới". Bài báo: đặt lại lúc agent/người
  -- trực cho 'dat' lần đầu (giờ báo đăng có thể cũ hơn nhiều so với lúc bà con thấy được bài).
  feed_at        timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  constraint kairos_posts_kind_shape check (
    (kind = 'bao' and author_phone is null and url is not null and url_hash is not null and title is not null)
    or (kind <> 'bao' and author_phone is not null)
  ),
  constraint kairos_posts_pin_official check (pinned_until is null or kind = 'chinh-thuc')
);
-- Cursor (feed_at, id) — lib/kairos/cursor.ts. Partial: dòng tin không bao giờ đọc bài ẩn.
-- Dòng tin lọc thêm `(kind <> 'bao' or mod_state = 'dat')` — bài báo chưa qua agent không lên.
create index if not exists kairos_posts_feed_idx on public.kairos_posts (feed_at desc, id desc) where not hidden;
create index if not exists kairos_posts_ports_gin on public.kairos_posts using gin (ports);
create index if not exists kairos_posts_provinces_gin on public.kairos_posts using gin (provinces);
create index if not exists kairos_posts_regions_gin on public.kairos_posts using gin (regions);
create index if not exists kairos_posts_author_idx on public.kairos_posts (author_phone, created_at desc);
create index if not exists kairos_posts_reshare_idx on public.kairos_posts (reshare_of) where reshare_of is not null;
create index if not exists kairos_posts_pinned_idx on public.kairos_posts (pinned_until) where pinned_until is not null;
create index if not exists kairos_posts_modq_idx on public.kairos_posts (created_at) where mod_state = 'cho-kiem';
create index if not exists kairos_posts_title_idx on public.kairos_posts (title_norm, published_at desc) where title_norm is not null;

-- ── 4. Bình luận — trả lời đúng 1 cấp ─────────────────────────────────────
create table if not exists public.kairos_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.kairos_posts (id) on delete cascade,
  parent_id     uuid references public.kairos_comments (id) on delete cascade,   -- xoá gốc ⇒ xoá cả trả lời
  author_phone  text not null,
  body          text not null check (char_length(btrim(body)) between 1 and 1000),
  hay_count     integer not null default 0 check (hay_count >= 0),
  hidden        boolean not null default false,
  mod_state     text not null default 'cho-kiem' check (mod_state in ('cho-kiem','dat','nghi','chan')),
  mod_checked_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists kairos_comments_top_idx on public.kairos_comments (post_id, hay_count desc);
create index if not exists kairos_comments_page_idx on public.kairos_comments (post_id, created_at, id);
create index if not exists kairos_comments_parent_idx on public.kairos_comments (parent_id) where parent_id is not null;
create index if not exists kairos_comments_modq_idx on public.kairos_comments (created_at) where mod_state = 'cho-kiem';
create index if not exists kairos_comments_author_idx on public.kairos_comments (author_phone, created_at desc);

-- Trả lời phải trỏ vào bình luận GỐC của CÙNG bài (route đã quy trả-lời-của-trả-lời về gốc;
-- trigger là lưới cuối — gọi thẳng DB cũng không tạo được cấp 2).
create or replace function public.kairos_comment_one_level()
returns trigger
language plpgsql
set search_path = ''
as $$
declare p record;
begin
  if new.parent_id is null then return new; end if;
  select c.post_id, c.parent_id into p from public.kairos_comments c where c.id = new.parent_id;
  if not found then raise exception 'parent_not_found' using errcode = 'P0001'; end if;
  if p.parent_id is not null then raise exception 'reply_depth' using errcode = 'P0001'; end if;
  if p.post_id <> new.post_id then raise exception 'parent_other_post' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists kairos_comments_one_level on public.kairos_comments;
create trigger kairos_comments_one_level before insert or update of parent_id, post_id on public.kairos_comments
  for each row execute function public.kairos_comment_one_level();

-- ── 5. Hay — một kiểu, chống bấm trùng bằng PK ───────────────────────────
create table if not exists public.kairos_post_hay (
  post_id     uuid not null references public.kairos_posts (id) on delete cascade,
  phone       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, phone)
);
create table if not exists public.kairos_comment_hay (
  comment_id  uuid not null references public.kairos_comments (id) on delete cascade,
  phone       text not null,
  created_at  timestamptz not null default now(),
  primary key (comment_id, phone)
);

-- ── 6. Theo dõi (một chiều) + chặn ───────────────────────────────────────
create table if not exists public.kairos_follows (
  follower_phone  text not null,
  followee_phone  text not null,
  created_at      timestamptz not null default now(),
  primary key (follower_phone, followee_phone),
  check (follower_phone <> followee_phone)
);
create index if not exists kairos_follows_followee_idx on public.kairos_follows (followee_phone);
create index if not exists kairos_follows_rate_idx on public.kairos_follows (follower_phone, created_at desc);

create table if not exists public.kairos_blocks (
  blocker_phone  text not null,
  blocked_phone  text not null,
  created_at     timestamptz not null default now(),
  primary key (blocker_phone, blocked_phone),
  check (blocker_phone <> blocked_phone)
);
create index if not exists kairos_blocks_rate_idx on public.kairos_blocks (blocker_phone, created_at desc);

-- ── 7. Báo xấu ───────────────────────────────────────────────────────────
-- Một người một đích một lần (unique). ≥5 người khác nhau ⇒ route tự ẩn (A7, audit he-thong).
create table if not exists public.kairos_reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     text not null check (target_type in ('post','comment')),
  target_id       uuid not null,
  reporter_phone  text not null,
  reason          text not null check (reason in ('lua-dao','bay-ba','sai-su-that','xuc-pham','quang-cao','khac')),
  note            text check (note is null or char_length(note) <= 200),
  status          text not null default 'moi' check (status in ('moi','da-an','bo-qua')),
  handled_by      text,
  handled_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (target_type, target_id, reporter_phone)
);
create index if not exists kairos_reports_queue_idx on public.kairos_reports (status, created_at desc);
create index if not exists kairos_reports_target_idx on public.kairos_reports (target_type, target_id);
create index if not exists kairos_reports_rate_idx on public.kairos_reports (reporter_phone, created_at desc);

-- ── 8. Chặn trùng + cờ chủ quyền của máy thu tin ──────────────────────────
-- Mọi link máy thu đã thấy, kể cả bài bị loại — để lượt sau không xét lại.
create table if not exists public.kairos_seen (
  url_hash       text primary key,
  title_norm     text,
  source_id      text,
  outcome        text not null check (outcome in ('nhan','trung-tieu-de','loai-chu-quyen','loi')),
  flag_term      text check (flag_term is null or char_length(flag_term) <= 100),   -- cụm trúng khi loai-chu-quyen
  first_seen_at  timestamptz not null default now()
);
create index if not exists kairos_seen_title_idx on public.kairos_seen (title_norm, first_seen_at);
create index if not exists kairos_seen_flag_idx on public.kairos_seen (first_seen_at desc) where outcome = 'loai-chu-quyen';

-- ── 8b. Quyết định kiểm duyệt (AC24) ─────────────────────────────────────
-- Agent kiểm duyệt (scripts/kairos-kiem.mjs trên GPU, gói Claude) và người trực ghi CÙNG một
-- bảng. Mỗi quyết định giữ lý do + điểm + phiên bản bộ luật (lib/kairos/luat-kiem-duyet) + mô
-- hình. Người trực đảo lại = THÊM một dòng decided_by='staff' trỏ `overrides` về dòng agent —
-- không sửa dòng cũ (lịch sử đầy đủ). Trạng thái hiện hành nằm ở `mod_state` của bài/bình luận.
create table if not exists public.kairos_mod_decisions (
  id             bigserial primary key,
  target_type    text not null check (target_type in ('post','comment')),
  target_id      uuid not null,
  decided_by     text not null check (decided_by in ('agent','staff')),
  actor          text not null check (char_length(actor) between 2 and 80),   -- 'agent' / 'staff:<sđt>'
  verdict        text not null check (verdict in ('dat','nghi','chan')),
  reason         text check (reason is null or char_length(reason) <= 500),
  score          numeric(4,3) check (score is null or (score >= 0 and score <= 1)),  -- 1 = chắc vi phạm
  rules_version  text check (rules_version is null or char_length(rules_version) <= 40),
  model          text check (model is null or char_length(model) <= 60),
  overrides      bigint references public.kairos_mod_decisions (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists kairos_mod_target_idx on public.kairos_mod_decisions (target_type, target_id, created_at desc);
create index if not exists kairos_mod_queue_idx on public.kairos_mod_decisions (created_at desc)
  where decided_by = 'agent' and verdict in ('nghi','chan');

-- ── 9. Bộ đếm Hay / bình luận — trigger (khuôn ghi nguyên tử 0064) ────────
-- Đếm tại DB trong cùng giao dịch với cú ghi ⇒ không có cửa sổ đọc-rồi-ghi ở Node.
-- Cascade xoá bài ⇒ trigger chạy trên bài đã xoá ⇒ update 0 dòng, vô hại.
create or replace function public.kairos_count_post_hay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.kairos_posts set hay_count = hay_count + 1 where id = new.post_id;
  else
    update public.kairos_posts set hay_count = greatest(hay_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists kairos_post_hay_count on public.kairos_post_hay;
create trigger kairos_post_hay_count after insert or delete on public.kairos_post_hay
  for each row execute function public.kairos_count_post_hay();

create or replace function public.kairos_count_comment_hay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.kairos_comments set hay_count = hay_count + 1 where id = new.comment_id;
  else
    update public.kairos_comments set hay_count = greatest(hay_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists kairos_comment_hay_count on public.kairos_comment_hay;
create trigger kairos_comment_hay_count after insert or delete on public.kairos_comment_hay
  for each row execute function public.kairos_count_comment_hay();

create or replace function public.kairos_count_comments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.kairos_posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.kairos_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists kairos_comments_count on public.kairos_comments;
create trigger kairos_comments_count after insert or delete on public.kairos_comments
  for each row execute function public.kairos_count_comments();

-- ── 10. Dấu gộp thông báo — 1 tin/bài/người nhận/giờ ──────────────────────
create table if not exists public.kairos_notify_marks (
  post_id  uuid not null references public.kairos_posts (id) on delete cascade,
  phone    text not null,
  last_at  timestamptz not null default now(),
  primary key (post_id, phone)
);

-- ── 11. Nhật ký thao tác — GIỮ ≥ 2 NĂM (NĐ 147/2024, 14 §11) ─────────────
-- Chỉ thêm. Sửa bị chặn; xoá dòng chưa đủ 2 năm bị chặn — dọn định kỳ chỉ xoá được dòng cũ.
-- Cũng là sổ đếm tần suất cho việc không có bảng riêng (upload ảnh: action='upload').
create table if not exists public.kairos_audit (
  id           bigserial primary key,
  actor        text not null,                           -- SĐT / 'staff:<sđt>' / 'he-thong' / 'may-thu'
  actor_kind   text not null check (actor_kind in ('ba-con','staff','he-thong')),
  action       text not null check (char_length(action) between 2 and 40),
  target_type  text,
  target_id    text,
  detail       jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  ip           text,
  at           timestamptz not null default now()
);
create index if not exists kairos_audit_at_idx on public.kairos_audit (at desc);
create index if not exists kairos_audit_target_idx on public.kairos_audit (target_type, target_id);
create index if not exists kairos_audit_actor_idx on public.kairos_audit (actor, action, at desc);

create or replace function public.kairos_audit_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'kairos_audit_append_only' using errcode = 'P0001';
  end if;
  if old.at > now() - interval '2 years' then
    raise exception 'kairos_audit_keep_2y' using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists kairos_audit_guard on public.kairos_audit;
create trigger kairos_audit_guard before update or delete on public.kairos_audit
  for each row execute function public.kairos_audit_guard();

-- ── 12. RLS — khuôn 0063: bật, KHÔNG policy, revoke ──────────────────────
alter table public.kairos_profiles     enable row level security;
alter table public.kairos_sources      enable row level security;
alter table public.kairos_posts        enable row level security;
alter table public.kairos_comments     enable row level security;
alter table public.kairos_post_hay     enable row level security;
alter table public.kairos_comment_hay  enable row level security;
alter table public.kairos_follows      enable row level security;
alter table public.kairos_blocks       enable row level security;
alter table public.kairos_reports      enable row level security;
alter table public.kairos_seen         enable row level security;
alter table public.kairos_notify_marks enable row level security;
alter table public.kairos_audit        enable row level security;
alter table public.kairos_mod_decisions enable row level security;
revoke all on table public.kairos_profiles, public.kairos_sources, public.kairos_posts,
  public.kairos_comments, public.kairos_post_hay, public.kairos_comment_hay, public.kairos_follows,
  public.kairos_blocks, public.kairos_reports, public.kairos_seen, public.kairos_notify_marks,
  public.kairos_audit, public.kairos_mod_decisions
  from anon, authenticated;
revoke all on sequence public.kairos_audit_id_seq, public.kairos_mod_decisions_id_seq from anon, authenticated;
revoke all on function public.kairos_comment_one_level(), public.kairos_count_post_hay(),
  public.kairos_count_comment_hay(), public.kairos_count_comments(), public.kairos_audit_guard()
  from public, anon, authenticated;

-- ── 13. Bucket ảnh — ĐỌC CÔNG KHAI, ghi chỉ service-role (khuôn market-media 0060) ──
-- /k/[id] cho người chưa có app cần xem ảnh không đăng nhập (A10). Đường <profileId>/<uuid>.jpg
-- — không SĐT trong URL. 524288 = 512 KB (A2). KHÔNG tạo policy ghi cho anon/authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kairos-media', 'kairos-media', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── 14. Cờ bật/tắt tab (14 §11, A13) ─────────────────────────────────────
insert into public.app_config (key, value) values ('kairos_enabled', 'true')
on conflict (key) do nothing;
-- Khoá ingest `kairos_ingest_key` (AC17/AC21) KHÔNG seed ở đây: secret không nằm trong git.
-- Admin đặt ở /quan-tri tab Hệ thống (hoặc env KAIROS_INGEST_KEY đè). Thiếu cả hai ⇒ route
-- /api/kairos/nhap + route kiểm duyệt trả 503 — không bao giờ mở cửa.
