-- SDFish — DANH BẠ "BÁN Ở ĐÂU" do ADMIN quản lý (2026-07-28). Gộp 3 mục công
-- khai của trục Giao dịch (/tien → "Bán ở đâu"): Nậu vựa · Chợ đầu mối · Nhà
-- máy — thay 3 bộ dữ liệu tĩnh. Admin sửa/ẩn/hiện/xóa/thêm trong /quan-tri tab
-- "Chỗ bán", áp dụng NGAY cho app. ("Mối quen" của bà con vẫn là localStorage
-- riêng, KHÔNG vào bảng này.)
--
-- Auth: đọc CÔNG KHAI (visible=true). GHI chỉ service-role qua
-- /api/admin/sell-contacts (requireStaff) — client KHÔNG có policy ghi. Giống
-- pattern product_listings/vms_zones.
--
-- KHÔNG seed trong SQL (danh bạ ~143 đầu mối nằm ở data/*.ts) — admin bấm "Nạp
-- danh bạ mặc định" (POST action=seed) để đổ dữ liệu tĩnh vào bảng. Trước khi
-- nạp, app vẫn chạy bằng fallback tĩnh (bảng rỗng = coi như chưa nạp).
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.sell_contacts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('vua', 'cho', 'nhamay')),
  name        text not null,
  sub_label   text,                                  -- nhãn phụ (loại vựa/nhà máy)
  province    text,
  address     text,
  phone       text,
  hours       text,                                  -- giờ họp (chợ)
  species     jsonb not null default '[]'::jsonb,    -- string[]
  markets     jsonb not null default '[]'::jsonb,    -- string[] thị trường bán đi (nhà máy)
  website     text,
  direct      boolean not null default false,        -- nhà máy mua trực tiếp
  note        text,
  visible     boolean not null default true,
  sort_order  integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sell_contacts_visible_idx
  on public.sell_contacts (visible, kind, sort_order);

alter table public.sell_contacts enable row level security;

-- ĐỌC: công khai, chỉ đầu mối đang hiện.
drop policy if exists "sell contacts readable when visible" on public.sell_contacts;
create policy "sell contacts readable when visible" on public.sell_contacts
  for select using (visible = true);

-- GHI/SỬA/XÓA: KHÔNG có policy — chỉ service-role (/api/admin/sell-contacts).
