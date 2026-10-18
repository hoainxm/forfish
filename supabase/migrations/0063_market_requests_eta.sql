-- SDFish — CHỢ VẬT TƯ: HẸN GIAO + YÊU CẦU ĐẶT HÀNG "BẤT KỲ CÁI GÌ" (2026-10-18)
--
-- Chủ dự án: "cho phép chủ tàu đặt đơn bất kỳ cái gì, nó sẽ chuyển cho chủ sàn, làm
-- luôn luồng giống shopee như xác nhận đơn, thời gian giao".
--
-- 1. market_orders thêm eta_from / eta_to (ngày VN, shop hẹn lúc xác nhận) và request_id
--    (đơn sinh từ yêu cầu). Cột mới đều nullable ⇒ đơn cũ không đổi, code cũ đọc vẫn chạy.
-- 2. market_requests: chủ tàu ghi món cần (chưa có trên chợ) → chủ sàn (/quan-tri) báo giá
--    kèm shop lo hàng + hẹn giao, hoặc báo không tìm được → chủ tàu đồng ý ⇒ sinh một đơn
--    thường (status da_xac_nhan) đi tiếp luồng đơn. Luật chuyển ở lib/market/request-state.ts.
--    Tự huỷ đơn chờ 72 giờ, báo giá hết hạn 3 ngày, yêu cầu treo 7 ngày: chạy LƯỜI khi đọc,
--    không cron (khuôn settleOverdue) ⇒ migration này không thêm job nào.
--
-- Auth: khuôn 0037/0060 — RLS bật, KHÔNG policy, revoke anon/authenticated. Mọi đọc/ghi qua
-- route service-role: /api/cho/yeu-cau* (identityFromRequest), /api/admin/cho/yeu-cau*
-- (requireAdmin). Client KHÔNG chạm bảng.
-- ⚠️ CHƯA APPLY — chờ chủ dự án duyệt (CLAUDE.md: không tự apply lên remote).
-- Xem docs/app-map/04-data-model.md §7g + 11-ba-spec-san-thuong-mai.md §4.4/§5.9.

alter table public.market_orders
  add column if not exists eta_from   date,
  add column if not exists eta_to     date,
  add column if not exists request_id uuid;
do $$ begin
  alter table public.market_orders
    add constraint market_orders_eta_order check (eta_from is null or eta_to is null or eta_to >= eta_from);
exception when duplicate_object then null; end $$;
comment on column public.market_orders.eta_from is 'Hẹn giao sớm nhất (ngày VN) — shop/chủ sàn đặt lúc xác nhận. null = đơn trước 2026-10-18.';
comment on column public.market_orders.eta_to is 'Hẹn giao muộn nhất (ngày VN). Quá ngày này mà chưa giao ⇒ app hiện "trễ hẹn".';
comment on column public.market_orders.request_id is 'Đơn sinh từ yêu cầu đặt hàng (market_requests.id). items[0].productId cũng = id này — không trùng món nào nên hoàn kho không đụng kho ai.';

create table if not exists public.market_requests (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                 -- YC + yymmdd + 4 ký tự (lib/market/order-code.ts makeRequestCode)
  buyer_phone     text not null,                        -- từ chuỗi cứng, đã chuẩn hoá — KHÔNG BAO GIỜ từ body
  title           text not null check (char_length(title) between 3 and 120),
  qty             integer not null check (qty between 1 and 9999),
  unit            text not null check (char_length(unit) between 1 and 20),
  description     text check (description is null or char_length(description) <= 1000),
  images          jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),   -- ≤ 3 URL
  need_by         date,
  address         jsonb not null,
  payment_method  text not null check (payment_method in ('cod', 'chuyen_khoan')),
  status          text not null default 'moi'
                    check (status in ('moi', 'da_bao_gia', 'da_dat', 'khong_tim_duoc', 'da_huy', 'het_han')),
  quote           jsonb,                                -- {goodsVnd, shippingVnd, etaFrom, etaTo, note, quotedAt, expiresAt}
  quote_shop_id   uuid references public.shops (id),    -- shop chủ sàn giao lo hàng
  reject_reason   text check (reject_reason is null or char_length(reject_reason) <= 300),
  order_id        uuid references public.market_orders (id),
  timeline        jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists market_requests_buyer_idx on public.market_requests (buyer_phone, created_at desc);
create index if not exists market_requests_status_idx on public.market_requests (status, created_at desc);
drop trigger if exists market_requests_set_updated_at on public.market_requests;
create trigger market_requests_set_updated_at before update on public.market_requests
  for each row execute function public.market_set_updated_at();

alter table public.market_requests enable row level security;
revoke all on table public.market_requests from anon, authenticated;
