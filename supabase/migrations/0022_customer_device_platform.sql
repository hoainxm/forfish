-- SDFish — MÁY CỦA KHÁCH: loại máy, máy ĐANG dùng, và LỊCH SỬ đổi máy
-- (2026-08-01, chủ dự án chốt phương án B + log).
--
-- ── Vì sao ────────────────────────────────────────────────────────────────
-- (1) LOẠI MÁY. /quan-tri đã biết "đã mở bản cài chưa" (0021) nhưng không biết
--     iPhone hay Android — mà hướng dẫn cài của hai nền KHÁC HẲN, và bản cài
--     trên iOS còn có kho RIÊNG tách Safari. Nhân viên gọi điện nhắc mà không
--     biết máy gì thì chỉ sai bước, bà con làm theo xong vẫn ra khơi tay trắng.
--
-- (2) ĐỔI MÁY LÀM SỐ LIỆU NÓI DỐI. Ba cột mốc của 0021 nằm trên `customers`
--     nên chúng tích luỹ theo TÀI KHOẢN, không theo MÁY:
--         máy cũ (iPhone) mở bản cài  → pwa_last_open_at = 10/07
--         đổi sang Android, chỉ mở web → web_last_open_at = 01/08
--                                        pwa_last_open_at VẪN 10/07
--         ⇒ chip báo "Đã mở bản cài" cho cái máy CHƯA BAO GIỜ mở bản cài.
--     Nay `customers.device_id` giữ MÁY ĐANG DÙNG; nhịp gửi từ máy có id khác
--     thì server XOÁ ba mốc rồi ghi lại từ đầu — số liệu luôn tả đúng cái máy
--     bà con đang cầm.
--
-- (3) LỊCH SỬ. Bảng `customer_devices` giữ mỗi (khách × máy) một hàng, để biết
--     một tài khoản đã đi qua những máy nào — dùng khi bà con gọi lên nói "tôi
--     đổi điện thoại rồi", hoặc khi cần lần lại vì sao mốc nhảy lung tung.
--
-- ── Không lưu gì ──────────────────────────────────────────────────────────
-- `device_id` là mã NGẪU NHIÊN do chính app sinh ra và lưu trong máy — KHÔNG
-- phải IMEI, serial hay dấu vân tay trình duyệt; xoá dữ liệu web là mất, và nó
-- không nhận ra được máy đó ở bất kỳ trang nào khác.
-- `device_platform` chỉ ba giá trị thô. KHÔNG user-agent, KHÔNG model, KHÔNG
-- độ phân giải, KHÔNG RAM — ghép mấy thứ đó lại là nhận diện được từng máy, mà
-- app của ngư dân không được biến thành thứ theo dõi bà con (luật của 0021).
-- Vẫn KHÔNG vị trí, KHÔNG thao tác, KHÔNG nội dung.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

-- ── customers: loại máy + máy ĐANG dùng ───────────────────────────────────
alter table public.customers
  add column if not exists device_platform text
    constraint customers_device_platform_check
      check (device_platform in ('ios', 'android', 'khac')),
  -- mã máy đang dùng; nhịp từ mã KHÁC ⇒ reset 3 mốc của 0021
  add column if not exists device_id text;

comment on column public.customers.device_platform is
  'Loại máy ĐANG dùng: ios | android | khac. Máy tự báo qua heartbeat. Chỉ loại thô, KHÔNG user-agent.';
comment on column public.customers.device_id is
  'Mã ngẫu nhiên của MÁY ĐANG DÙNG (app tự sinh, lưu forfish.device.v1). Đổi mã = đổi máy ⇒ server xoá pwa/web/offline_ready rồi ghi lại. KHÔNG phải IMEI/serial.';

-- ── customer_devices: LỊCH SỬ mỗi (khách × máy) ───────────────────────────
create table if not exists public.customer_devices (
  id             uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  device_id      text not null,
  platform       text
    constraint customer_devices_platform_check
      check (platform in ('ios', 'android', 'khac')),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- mốc RIÊNG của máy này (khác 3 cột trên customers = máy đang dùng)
  pwa_last_open_at timestamptz,
  web_last_open_at timestamptz,
  offline_ready_at timestamptz,
  constraint customer_devices_uniq unique (customer_phone, device_id)
);

create index if not exists customer_devices_phone_idx
  on public.customer_devices (customer_phone, last_seen_at desc);

comment on table public.customer_devices is
  'LỊCH SỬ máy theo khách — mỗi (SĐT × device_id) một hàng. Ghi bằng service-role từ /api/me/heartbeat. Chỉ mốc thời gian + loại máy thô.';

-- Log NỘI BỘ: bật RLS nhưng KHÔNG policy nào — chỉ service-role (bypass RLS)
-- đọc/ghi được, y như premium_grants (0004). Khách KHÔNG cần đọc bảng này.
alter table public.customer_devices enable row level security;
