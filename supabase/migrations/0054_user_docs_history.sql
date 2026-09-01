-- SDFish — LỊCH SỬ SỔ ĐỒNG BỘ: server GIỮ LẠI bản cũ thay vì đè mất
-- (chủ dự án chốt 2026-09-01: *"phía server ko cần xoá, mà lưu lại ở server kèm
-- trạng thái đã xoá, để có thể phân tích hành vi người dùng sau này"*).
--
-- VÌ SAO CÓ BẢNG RIÊNG chứ không thêm cột vào `user_docs`: `user_docs` giữ ĐÚNG
-- MỘT dòng cho mỗi (owner_phone, kind) và cả cuốn sổ là một khối JSON — không có
-- dòng riêng cho từng việc để đánh dấu "đã xoá". Muốn biết bà con đã bỏ cái gì
-- thì phải giữ BẢN TRƯỚC rồi so hai bản. Đây là bảng chỉ-thêm (append-only).
--
-- Chủ dự án cũng đã cân nhắc và LOẠI phương án đánh dấu `deletedAt` ngay trong
-- sổ: cách đó biết ngay xoá cái gì nhưng làm sổ TRONG MÁY phình dần, mà máy chật
-- chính là gốc của lỗi "việc đã xoá sống lại" vừa vá 2026-09-01
-- (docs/specs/dong-bo-so-per-may.md). Máy bà con không được nặng thêm vì việc
-- phân tích của công ty.
--
-- RIÊNG TƯ — QUAN TRỌNG: bảng này chứa BẢN SAO của mọi thứ `user_docs` chứa, kể
-- cả CCCD thuyền viên (kind='crew') và metadata giấy tờ (kind='documents'), và
-- GIỮ MÃI (chủ dự án chốt). Nên RLS ĐÓNG HẲN y như bảng gốc: không policy cho
-- anon/authenticated, chỉ service-role đụng được. Đã khai trong
-- /quyen-rieng-tu — bà con muốn xoá hẳn thì gọi SDVICO.
--
-- Xem docs/app-map/04-data-model.md + docs/specs/dong-bo-so-per-may.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.user_docs_history (
  id                bigserial primary key,
  owner_phone       text  not null,
  kind              text  not null
                      check (kind in ('boats','crew','documents','maintenance','materials')),
  -- BẢN CŨ (thứ sắp bị đè). So với bản mới trong user_docs để biết đã bỏ gì.
  data              jsonb not null,
  -- mốc client của CHÍNH bản cũ này
  client_updated_at bigint not null default 0,
  -- lúc bản này bị thay (giờ server) — trục thời gian để phân tích hành vi
  replaced_at       timestamptz not null default now()
);

-- Tra theo một chủ tàu, theo thứ tự thời gian — đúng cách đọc lúc phân tích.
create index if not exists user_docs_history_owner_idx
  on public.user_docs_history (owner_phone, kind, replaced_at desc);

alter table public.user_docs_history enable row level security;

-- KHÔNG policy cho anon/authenticated: đây là dữ liệu riêng tư ĐÃ BỊ XOÁ khỏi
-- màn của bà con, tuyệt đối không để client nào đọc lại được. Chỉ service-role.
