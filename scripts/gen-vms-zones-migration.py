# Sinh supabase/migrations/0013_vms_zones.sql: bang vms_zones + RLS + seed 3 vung
# mac dinh tu src/data/vms-zones.json (allowedOffshore / caution / bottomOnly).
# Chay lai khi doi 3 vung mac dinh. KHONG sua migration bang tay.
import json, os

REPO = r"C:\Code\ForFish"
ZONES = os.path.join(REPO, "src", "data", "vms-zones.json")
OUT = os.path.join(REPO, "supabase", "migrations", "0013_vms_zones.sql")

z = json.load(open(ZONES, encoding="utf-8"))

def gj(key):
    return json.dumps(z[key], ensure_ascii=False, separators=(",", ":")).replace("'", "''")

SEED = [
    ("a1000000-0000-4000-8000-000000000001", "Ranh giới ngoài khơi (được phép)",
     "#dc2626", "line-dashed", "allowedOffshore", 0),
    ("a1000000-0000-4000-8000-000000000002", "Cần chú ý khi đánh bắt",
     "#eab308", "line", "caution", 1),
    ("a1000000-0000-4000-8000-000000000003", "Chỉ đánh được cá đáy",
     "#f97316", "line", "bottomOnly", 2),
]

rows = ",\n".join(
    f"  ('{i}', '{name}', '{color}', '{style}', true, true, '{gj(key)}'::jsonb, {so})"
    for i, name, color, style, key, so in SEED
)

sql = f"""-- SDFish — VÙNG BIỂN VMS do ADMIN quản lý (2026-07-28). Thay dữ liệu tĩnh
-- data/vms-zones.json: admin thêm/bớt/ẩn vùng + đặt "hiển thị mặc định trên app
-- ngư dân" ngay trong /quan-tri (tab Vùng biển), áp dụng NGAY — không build lại.
-- Nhập hình vùng bằng TẢI FILE GeoJSON (server giản lược trước khi lưu).
--
-- Auth: đọc CÔNG KHAI (visible=true) — vùng biển tham khảo là nội dung public.
-- GHI chỉ qua service-role trong /api/admin/vms-zones (requireStaff) — client
-- KHÔNG có policy ghi. Giống pattern product_listings/crew_reports.
--
-- Seed = 3 vùng mặc định (sinh bởi scripts/gen-vms-zones-migration.py từ
-- data/vms-zones.json) để chạy migration xong app KHÔNG mất 3 vùng đang có.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.vms_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#0d9488',      -- màu viền/nền (#rrggbb)
  style       text not null default 'line'
                check (style in ('fill', 'line', 'line-dashed')),
  default_on  boolean not null default true,         -- toggle app ngư dân mặc định bật
  visible     boolean not null default true,         -- admin ẩn/hiện vùng
  geojson     jsonb not null,                        -- FeatureCollection đã giản lược
  sort_order  integer not null default 0,
  created_by  text,                                  -- SĐT staff tạo/sửa gần nhất
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists vms_zones_visible_idx
  on public.vms_zones (visible, sort_order);

alter table public.vms_zones enable row level security;

-- ĐỌC: công khai, chỉ vùng đang hiện.
drop policy if exists "vms zones readable when visible" on public.vms_zones;
create policy "vms zones readable when visible" on public.vms_zones
  for select using (visible = true);

-- GHI/SỬA/XÓA: KHÔNG có policy — chỉ service-role (route /api/admin/vms-zones).

-- Seed 3 vùng mặc định (idempotent qua id cố định).
insert into public.vms_zones
  (id, name, color, style, default_on, visible, geojson, sort_order)
values
{rows}
on conflict (id) do nothing;
"""

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(sql)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
