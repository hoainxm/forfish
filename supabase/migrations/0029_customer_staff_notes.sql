-- SDFish — GHI CHÚ STAFF THEO KHÁCH (2026-07-30). Cho phép admin/quản lý đánh
-- dấu tình trạng onboarding từng khách ngay trong tab Tài khoản của /quan-tri:
-- · staff_used    boolean — khách ĐÃ SỬ DỤNG app hay chưa
-- · staff_guided  boolean — SDVICO đã HƯỚNG DẪN TRỰC TIẾP chưa
-- · staff_note_by / staff_note_at — SĐT staff + mốc cập nhật gần nhất (đối soát)
-- Chỉ service-role ghi (qua /api/admin/accounts, cần quyền tai-khoan:edit).
-- KHÔNG đụng luồng khách/premium — chỉ là cờ theo dõi nội bộ của SDVICO.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists staff_used    boolean not null default false,
  add column if not exists staff_guided  boolean not null default false,
  add column if not exists staff_note_by text,
  add column if not exists staff_note_at timestamptz;
