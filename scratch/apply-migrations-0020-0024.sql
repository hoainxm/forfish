-- SDFish — APPLY 5 migration mới (reconcile base + admin chung) lên prod
-- Ref: znzgugvfhgmiszqgjulk. IDEMPOTENT — chạy lại được (0023 fix drop policy).

-- ═══════════════════ 0020_vms_zones ═══════════════════
-- SDFish — VÙNG BIỂN VMS do ADMIN quản lý (2026-07-28). Thay dữ liệu tĩnh
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
  ('a1000000-0000-4000-8000-000000000001', 'Ranh giới ngoài khơi (được phép)', '#dc2626', 'line-dashed', true, true, '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ten":"Ranh giới ngoài khơi (vùng được phép)"},"geometry":{"type":"LineString","coordinates":[[108.0873,21.4843],[108.0175,21.4905],[108.0451,21.508],[108.0206,21.511],[108.0404,21.5168],[108.0317,21.5311],[108.049,21.5268],[108.037,21.5459],[108.0099,21.5471],[108.0279,21.5491],[108.0712,21.5347],[108.0953,21.4967],[108.1347,21.2756],[108.2086,21.2097],[108.3792,20.4014],[107.9297,19.9592],[107.5278,19.6592],[107.35,19.4239],[107.2119,19.4239],[107.1897,19.2678],[107.1594,19.2153],[107.1594,18.7144],[107.5667,18.2303],[107.6525,18.0703],[107.9667,17.7833],[108.0165,17.8333],[108.4447,17.4784],[108.8405,17.2168],[109.415,16.9172],[109.7755,16.7725],[110.2543,16.6352],[111.1115,16.4547],[110.9829,15.7953],[110.9866,15.7417],[111.0215,15.6622],[111.0696,15.6139],[111.1375,15.582],[111.2306,15.5756],[112.5811,15.8241],[112.6504,15.8478],[112.7453,15.9127],[112.7975,15.9785],[112.8527,16.1962],[113.1675,16.5091],[113.4398,16.8605],[114.2208,18.136],[114.4787,18.4823],[114.9166,18.5764],[115.3519,18.7193],[117.2204,19.5403],[116.9565,18.5037],[116.5819,17.6262],[116.4701,17.3251],[116.3762,16.9623],[116.3105,16.5459],[116.2909,16.0316],[116.3051,15.6893],[116.5717,13.8454],[116.5206,13.3017],[115.8521,12.0004],[115.1197,11.2853],[115.0001,11.3007],[114.8876,11.2425],[114.8423,11.1845],[114.8185,11.1191],[114.8184,11.0462],[114.8425,10.9787],[114.6287,10.7082],[114.5808,10.8056],[114.4441,10.9158],[114.4856,10.984],[114.4975,11.0664],[114.4751,11.1475],[114.4236,11.2127],[114.1628,11.2244],[114.0974,11.1479],[114.0171,11.1345],[113.9435,11.0909],[113.8857,11.0218],[113.8594,10.9615],[113.8577,10.8695],[113.898,10.7852],[113.9903,10.7192],[114.1113,10.7071],[114.1351,10.6007],[114.2133,10.5206],[114.1758,10.4713],[114.1538,10.4046],[114.0657,10.3451],[114.0189,10.2549],[114.0659,10.0703],[114.1269,10.0218],[114.1614,10.0075],[114.2604,10.0438],[114.3091,10.2802],[114.4207,10.2795],[114.4289,10.518],[114.4912,10.5296],[114.6227,10.6088],[114.7322,10.5551],[114.7857,10.4683],[114.7905,10.3657],[114.7445,10.2713],[114.6619,10.2132],[114.5774,10.1938],[114.5652,10.1124],[114.3872,10.0269],[114.4181,9.8553],[114.515,9.7677],[114.5813,10.1074],[114.6874,10.0666],[114.7388,10.0103],[114.7681,9.9262],[114.759,9.8361],[114.7211,9.7689],[114.6416,9.7117],[114.5607,9.6967],[114.5216,9.639],[114.455,9.5927],[114.3138,9.7819],[114.2126,9.7213],[114.0706,9.6781],[114.0478,9.7823],[113.8726,9.4568],[113.7572,9.1732],[113.8499,9.1229],[113.9012,9.0419],[114.0826,9.0172],[114.335,8.8883],[114.3814,8.8237],[114.4065,8.735],[114.4081,8.6633],[114.3901,8.6058],[114.2989,8.5097],[114.2069,8.4741],[114.1537,8.4742],[114.0596,8.512],[114.0045,8.5742],[113.9275,8.587],[113.7904,8.6538],[113.7396,8.6985],[113.7101,8.7494],[113.6463,8.7395],[113.5621,8.7538],[113.4776,8.8179],[113.0993,8.4597],[112.7835,8.053],[112.9138,8.094],[113.0232,8.0663],[113.0538,8.1844],[113.2076,8.4178],[113.3107,8.4811],[113.4144,8.4802],[113.4907,8.4406],[113.5344,8.3907],[113.5601,8.3281],[113.5637,8.2555],[113.5392,8.1434],[113.4943,8.0588],[113.3566,7.9147],[113.2493,7.872],[113.1989,7.8724],[113.1231,7.8999],[113.103,7.8036],[113.0665,7.7514],[112.9939,7.7034],[112.8946,7.6918],[112.8014,7.7293],[112.7483,7.7873],[112.7223,7.8553],[112.7264,7.9634],[112.562,7.6619],[112.317,7.5369],[112.0637,7.3788],[111.8397,7.2103],[111.6242,7.0173],[111.3189,6.6778],[111.0243,6.2499],[110.2781,6.0334],[109.8414,5.8527],[109.6433,6.3033],[109.6433,6.869],[109.3112,7.0053],[108.5309,6.9365],[107.6921,6.7231],[106.6453,6.4152],[106.0351,6.2161],[105.82,6.0967],[103.8667,7.05],[103.3167,7.5667],[102.9667,7.7],[102.9512,7.7122],[103.0417,7.8167],[102.1998,8.7839],[103.1685,9.5863],[102.8917,9.9167],[102.95,9.9083],[103.8,10.4017],[103.82,10.4267],[103.7918,10.5054]]}}]}'::jsonb, 0),
  ('a1000000-0000-4000-8000-000000000002', 'Cần chú ý khi đánh bắt', '#eab308', 'line', true, true, '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ten":"Khu vực cần chú ý khi đánh bắt"},"geometry":{"type":"MultiPolygon","coordinates":[[[[113.5857,6.7344],[113.5044,6.7489],[113.4404,6.7879],[113.3903,6.8555],[113.3714,6.9324],[113.3838,7.016],[113.4265,7.0873],[113.495,7.1365],[113.5706,7.1536],[113.655,7.1384],[113.7224,7.0939],[113.7718,7.028],[113.7913,6.9492],[113.7791,6.8709],[113.7347,6.8],[113.6671,6.7528],[113.5857,6.7344]]],[[[114.8281,8.2004],[114.8353,8.1377],[114.8152,8.0556],[114.7877,8.0135],[114.7128,7.9578],[114.5725,7.9121],[114.482,7.9104],[114.3926,7.9488],[114.3294,8.0275],[114.2545,7.9366],[114.1477,7.8956],[114.1257,7.8387],[114.0814,7.7856],[114.1518,7.6871],[114.1556,7.5708],[114.1176,7.4942],[114.0464,7.4344],[114.0444,7.3132],[113.9771,7.2175],[113.8933,7.174],[113.8025,7.1642],[113.6996,7.1921],[113.6302,7.247],[113.5883,7.3373],[113.595,7.4369],[113.6488,7.5214],[113.7261,7.5669],[113.7257,7.6888],[113.7924,7.7893],[113.7077,7.889],[113.6782,7.9778],[113.6935,8.0755],[113.7592,8.1614],[113.8466,8.2024],[113.9438,8.2013],[114.0189,8.2834],[114.1228,8.317],[114.1852,8.3127],[114.2487,8.2876],[114.3302,8.1962],[114.3741,8.26],[114.433,8.3062],[114.6206,8.3528],[114.6863,8.345],[114.7489,8.3147],[114.7981,8.2647],[114.8281,8.2004]]],[[[115.2878,8.1473],[115.1159,8.1689],[115.0373,8.2256],[114.9858,8.2935],[114.9694,8.3446],[114.9766,8.4467],[115.0305,8.5307],[115.0745,8.5624],[115.1863,8.5916],[115.2488,8.5841],[115.3724,8.5392],[115.4488,8.4649],[115.4784,8.3697],[115.4578,8.2691],[115.3872,8.1866],[115.2878,8.1473]]],[[[112.8469,8.6528],[112.7834,8.6606],[112.6916,9.0286],[112.7912,9.0711],[112.8691,9.0676],[112.9706,9.0273],[113.0286,8.966],[113.0579,8.8846],[113.05,8.7956],[113.0074,8.722],[112.9344,8.6705],[112.8469,8.6528]]],[[[112.9041,9.3381],[112.8013,9.3515],[112.7302,9.399],[112.6916,9.4547],[112.6732,9.5527],[112.7063,9.6515],[112.7594,9.7101],[112.8154,9.7469],[112.9,9.7649],[112.9535,9.7577],[113.0409,9.7082],[113.0785,9.6629],[113.1086,9.5664],[113.0982,9.4919],[113.0608,9.4262],[112.9892,9.3682],[112.9041,9.3381]]],[[[114.2846,9.4986],[114.21,9.5098],[114.1424,9.5479],[114.0932,9.6083],[114.0705,9.6781],[114.2126,9.7213],[114.3138,9.7819],[114.455,9.5926],[114.3804,9.5253],[114.2846,9.4986]]],[[[114.5813,10.1074],[114.515,9.7677],[114.4181,9.8553],[114.3872,10.0269],[114.5663,10.1129],[114.5813,10.1074]]],[[[115.552,9.6714],[115.4513,9.6876],[115.3813,9.7246],[115.3253,9.791],[115.2963,9.8751],[115.302,9.9657],[115.3385,10.0436],[115.4035,10.1045],[115.4884,10.1346],[115.6016,10.1234],[115.6839,10.0884],[115.7501,10.021],[115.7809,9.9338],[115.7751,9.8464],[115.7339,9.7697],[115.6472,9.6973],[115.552,9.6714]]],[[[115.8323,10.5307],[115.7502,10.5347],[115.6796,10.5677],[115.615,10.6457],[115.5962,10.7376],[115.6235,10.8747],[115.6614,10.9456],[115.7327,11.0023],[115.8193,11.0234],[115.9018,11.009],[115.9699,10.9656],[116.0127,10.9064],[116.0321,10.8298],[116.0056,10.6933],[115.9608,10.6017],[115.9219,10.5663],[115.8323,10.5307]]],[[[114.4738,11.1499],[114.4963,11.0288],[114.4441,10.9158],[114.6015,10.7778],[114.6302,10.6999],[114.6252,10.6133],[114.4912,10.5296],[114.4289,10.518],[114.4207,10.2795],[114.3091,10.2802],[114.2604,10.0438],[114.1614,10.0075],[114.0659,10.0703],[114.0189,10.2549],[114.0657,10.3451],[114.1538,10.4046],[114.1758,10.4713],[114.2133,10.5206],[114.1351,10.6007],[114.1113,10.7071],[113.9903,10.7192],[113.898,10.7852],[113.8577,10.8695],[113.8609,10.9671],[113.9435,11.0909],[114.0171,11.1345],[114.0974,11.1479],[114.1628,11.2244],[114.4236,11.2127],[114.4738,11.1499]]],[[[115.0311,10.8744],[114.9452,10.8889],[114.8769,10.9337],[114.8297,11.0056],[114.8153,11.0867],[114.8344,11.1693],[114.8876,11.2425],[114.9563,11.2883],[115.0419,11.3035],[115.1188,11.2858],[115.1877,11.2358],[115.228,11.1679],[115.2391,11.0921],[115.2199,11.0089],[115.173,10.939],[115.1064,10.8922],[115.0311,10.8744]]],[[[114.4993,11.306],[114.1853,11.574],[114.2018,11.5935],[114.273,11.6429],[114.3587,11.6614],[114.4394,11.647],[114.5064,11.6043],[114.556,11.5297],[114.5689,11.4517],[114.5483,11.3697],[114.4993,11.306]]]]}},{"type":"Feature","properties":{"ten":"Khu vực cần chú ý khi đánh bắt"},"geometry":{"type":"MultiPolygon","coordinates":[[[[111.5263,17.3223],[112.3513,17.1732],[112.4309,17.1378],[112.8937,16.807],[112.9438,16.7241],[112.9474,16.6137],[112.8142,16.0261],[112.7975,15.9785],[112.7453,15.9127],[112.6504,15.8478],[112.5811,15.8241],[111.2306,15.5756],[111.1148,15.5895],[111.032,15.6485],[110.9866,15.7417],[110.986,15.8193],[111.2507,17.1541],[111.2777,17.2075],[111.3546,17.2761],[111.5263,17.3223]]]]}}]}'::jsonb, 1),
  ('a1000000-0000-4000-8000-000000000003', 'Chỉ đánh được cá đáy', '#f97316', 'line', true, true, '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ten":"Khu vực chỉ được pháp đánh bắt cá đáy, sau khi Hiệp định phân định vùng ĐQKT Việt Nam - Indonesia có hiệu lực"},"geometry":{"type":"MultiPolygon","coordinates":[[[[109.6433,6.3033],[109.2869,6.8375],[106.6605,6.35],[106.3169,6.25],[106.2,6.25],[105.82,6.0967],[106.0351,6.2161],[106.6453,6.4152],[107.6921,6.7231],[108.5309,6.9365],[109.3112,7.0053],[109.6433,6.869],[109.6433,6.3033]]]]}}]}'::jsonb, 2)
on conflict (id) do nothing;

-- ═══════════════════ 0021_sell_contacts ═══════════════════
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

-- ═══════════════════ 0022_app_config ═══════════════════
-- SDFish — CẤU HÌNH ỨNG DỤNG trong DB (2026-07-28). Thay cho việc lệ thuộc env
-- máy chủ deploy (Vercel): admin dán khoá/cấu hình vào đây (VD khoá VAPID Web
-- Push) là áp dụng NGAY, KHÔNG cần set env + redeploy. Đọc DB-trước, thiếu thì
-- rơi về env cùng tên (di trú êm: env cũ vẫn chạy, DB đè lên khi có).
--
-- BẢO MẬT: bảng chứa SECRET (VD vapid_private_key) → RLS bật, **KHÔNG policy** =
-- chỉ service-role đọc/ghi. Client KHÔNG đọc trực tiếp. Khoá công khai (vd
-- vapid_public_key) chỉ lộ qua API riêng /api/push/vapid-public-key. Ghi/xem
-- qua /api/admin/app-config (requireAdmin) — GET che giá trị secret.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.app_config (
  key         text primary key,
  value       text not null default '',
  updated_by  text,                                  -- SĐT admin sửa gần nhất
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- KHÔNG có policy — chỉ service-role (route /api/admin/app-config, requireAdmin).

-- ═══════════════════ 0023_price_history ═══════════════════
-- SDFish — KHO LỊCH SỬ GIÁ CÁ tích luỹ (2026-07-29).
--
-- Vì sao: biểu đồ giá (kiểu chứng khoán) ở Trục 2 cần chuỗi giá tuần dài. Kho
-- bản tin VASEP chỉ giữ ~13 tuần gần nhất trên trang danh sách; muốn lịch sử
-- dài dần thì phải LƯU lại. Cron /api/cron/snapshot-prices (GitHub Actions,
-- tuần 1 lần) gom các tuần VASEP rồi UPSERT vào bảng này (idempotent theo khoá
-- (week_end, species_id)). Tuần cũ rơi khỏi listing VASEP vẫn còn ở đây → lịch
-- sử chỉ dài thêm, không bao giờ ngắn lại.
--
-- Dữ liệu là GIÁ THAM KHẢO CÔNG KHAI (không cá nhân) → RLS bật + policy SELECT
-- cho mọi người đọc; GHI chỉ qua service-role (cron server-to-server, bypass
-- RLS). Chưa apply migration / chưa cấu hình env → lib degrade êm, route lùi về
-- gom kho VASEP trực tiếp = hành vi trước khi có DB.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.price_history (
  week_end    date not null,            -- NGÀY CUỐI tuần bản tin (trục thời gian)
  species_id  text not null,            -- id loài trong app (khớp data/port-prices)
  min_vnd     integer not null,
  max_vnd     integer not null,
  province    text,                     -- tỉnh bản tin, vd "Khánh Hòa"
  source      text not null default 'vasep',
  created_at  timestamptz not null default now(),
  primary key (week_end, species_id)
);

alter table public.price_history enable row level security;

-- Giá tham khảo công khai — ai cũng đọc được (kể cả chưa đăng nhập)
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history
  for select using (true);

-- Truy vấn biểu đồ hay lọc theo loài rồi sắp theo tuần
create index if not exists price_history_species_idx
  on public.price_history (species_id, week_end);

-- ═══════════════════ 0024_shared_admin ═══════════════════
-- SDFish — TÀI KHOẢN ADMIN CHUNG (sdvico 2026-07-30). Thay vì gán SĐT CÁ NHÂN
-- vào env ADMIN_PHONES (không đúng logic — admin gắn với 1 người), lập 1 tài
-- khoản admin DÙNG CHUNG: customers.role='admin' (= full-admin ngang env, xem
-- admin-auth.ts requireStaff). Env ADMIN_PHONES giữ 1 SĐT bootstrap break-glass
-- phòng khi DB hỏng.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).
--
-- LƯU Ý: migration này CHỈ lập HỒ SƠ (customers row). ĐĂNG NHẬP (auth.users) phải
-- provision RIÊNG: admin hiện tại vào /quan-tri → "Tạo tài khoản" → chọn
-- "Admin — toàn quyền", SĐT 0900000001, mật khẩu tạm sd123456 (app bắt đổi lần
-- đầu). Form upsert lại đúng row này (idempotent theo phone) + tạo auth user.

insert into public.customers (phone, name, role, updated_at)
values ('0900000001', 'Quản trị SDVICO', 'admin', now())
on conflict (phone) do update set role = 'admin', updated_at = now();

