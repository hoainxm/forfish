-- SDFish — PHÂN HẠNG TÀI KHOẢN (2026-07-26): 'basic' | 'premium'.
-- Premium mở: dự báo cá (PFZ) + dự báo thời tiết quá 3 ngày. Basic/chưa đăng
-- nhập: không xem được hai thứ đó (3 ngày đầu thời tiết vẫn mở cho mọi người).
-- Nguồn gán DUY NHẤT: webhook SDWork (sales/CSKH gán bên CRM, đẩy kèm customer
-- event) — app chỉ ĐỌC, không có luồng thanh toán trong app.
-- premium_until: hạn premium; NULL = không hạn. Hết hạn → coi như basic
-- (luật ở src/lib/tier.ts — client/server dùng chung, DB không cần cron hạ hạng).
-- KH đọc hạng của CHÍNH MÌNH qua policy "customers readable by owner phone"
-- (0002) — không cần policy mới. Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists tier text not null default 'basic'
    constraint customers_tier_check check (tier in ('basic', 'premium')),
  add column if not exists premium_until timestamptz;
