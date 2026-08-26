-- SDFish — ĐỒNG BỘ SỔ PER-MÁY lên server theo SĐT (2026-08-26, P1 của
-- docs/specs/dong-bo-so-per-may.md).
--
-- VÌ SAO: hồ sơ tàu / bảo dưỡng / vật tư / sổ thuyền viên / tủ giấy tờ trước nay
-- CHỈ nằm localStorage per-máy (forfish.<kind>.v1) → nhập ở điện thoại không
-- thấy trên PC. Nay "gương" mỗi khoá localStorage thành MỘT dòng server keyed
-- theo (owner_phone, kind), đọc/ghi qua ROUTE service-role (/api/me/sync,
-- identityFromRequest — cùng luật market_listings/devices: app bỏ phiên Supabase
-- nên auth.uid() NULL, mọi truy cập đi service-role + lọc owner_phone).
--
-- RIÊNG TƯ: bảng này SẼ chứa CCCD (kind='crew') + metadata giấy tờ (P2) → RLS
-- ĐÓNG HẲN, KHÔNG policy cho anon/authenticated. Chỉ service-role (route, đã
-- kiểm owner theo SĐT) đụng được. Client ẩn danh không đọc được của bất kỳ ai.
--
-- Xem docs/app-map/04-data-model.md + docs/specs/dong-bo-so-per-may.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.user_docs (
  owner_phone       text  not null,
  kind              text  not null
                      check (kind in ('boats','crew','documents','maintenance','materials')),
  data              jsonb not null,
  -- mốc ghi phía CLIENT (ms). last-write-wins mức kind ở P1: bên nào ghi sau
  -- (client_updated_at lớn hơn) thắng. server updated_at chỉ để soi/dọn.
  client_updated_at bigint not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (owner_phone, kind)
);

create index if not exists user_docs_owner_idx on public.user_docs (owner_phone);

alter table public.user_docs enable row level security;

-- KHÔNG policy select/insert/update/delete cho anon/authenticated: dữ liệu riêng
-- tư, đi HẲN qua route service-role. Service-role bypass RLS. (Muốn client-direct
-- sau này thì thêm policy theo cột định danh mới, KHÔNG mở auth.uid() = NULL.)
