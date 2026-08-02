-- 0030 — ĐÃ LƯU Ở ĐÂU, ĐỦ CHỖ KHÔNG, ĐÃ CHẮC CHẠY OFFLINE CHƯA
--
-- Vì sao (chủ dự án chốt 2026-08-02k): *"heartbeat và web quản trị cần có các
-- info này để nắm rõ đã lưu ở đâu, lưu bản dữ liệu tới ngày nào, dung lượng
-- storage đủ không, có đảm bảo chạy tốt 100% offline chưa."*
--
-- 0029 đã chở về MỘT con số tổng (`storage_used_mb`). Số đó KHÔNG trả lời được
-- câu đang cần, vì trên WebKit các kho KHÔNG bình đẳng:
--   · localStorage có trần RIÊNG ~5 MB/origin — và trên iOS 16, chạm trần đó thì
--     localStorage **bị xoá sạch** (WebKit #245479), kéo theo chuỗi đăng nhập.
--   · IndexedDB · Cache Storage · Service Worker · File System dùng CHUNG hạn
--     ngạch origin (tới ~60% tổng dung lượng thiết bị cho Safari/PWA).
-- Gộp cả hai loại vào một con số là mất đúng thông tin để biết KHO NÀO sắp chật.
--
-- Bốn câu hỏi ↔ bốn cột:
--   ① đã lưu ở đâu          → `storage_backend` ('idb' = đã dời xong · 'ls' =
--                              còn kẹt thùng 5 MB, máy này ĐÁNG GỌI ĐIỆN)
--   ② dữ liệu tới ngày nào  → `data_until` / `data_until_web` (đã có, 0025/0027)
--   ③ dung lượng đủ không   → `storage_ls_mb` · `storage_idb_mb` ·
--                              `storage_cache_mb` · `storage_available_mb`
--   ④ chắc chạy offline chưa→ `offline_ready_at` (đã có) + `storage_persisted`
--                              (hàng rào duy nhất chống thu hồi LRU khi máy đầy)
--
-- LUẬT KHÔNG ĐỔI: chỉ ghi MỐC + SỐ ĐO. Không vị trí, không thao tác, không nội
-- dung. Dung lượng kho là số của MÁY, không suy ra được bà con đang ở đâu.
--
-- ⚠️ OFFLINE: mọi cột chảy MỘT CHIỀU máy → máy chủ, và chỉ khi máy CÓ SÓNG.
-- Không có đường nào chạy ngược về máy.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (CLAUDE.md, ref znzgugvfhgmiszqgjulk).

alter table public.customers
  add column if not exists storage_ls_mb integer,
  add column if not exists storage_idb_mb integer,
  add column if not exists storage_cache_mb integer,
  add column if not exists storage_available_mb integer,
  add column if not exists storage_persisted boolean,
  add column if not exists storage_backend text;

comment on column public.customers.storage_ls_mb is
  'localStorage đang chiếm (MB) — đo CHÍNH XÁC bằng cách cộng độ dài khoá+giá trị. Trần WebKit ~5 MB/origin: tiến sát 5 là sắp dính lỗi iOS 16 xoá sạch localStorage.';
comment on column public.customers.storage_idb_mb is
  'IndexedDB đang chiếm (MB) — phần APP tự cất (kho dự báo). Đây là nơi gói 16 ngày phải nằm.';
comment on column public.customers.storage_cache_mb is
  'Cache Storage + phụ trội, ƯỚC LƯỢNG bằng phần dư (tổng − ls − idb). Chỉ dùng SO ĐỘ LỚN, đừng dùng làm số quyết định — đo thật phải tải lại từng ô bản đồ.';
comment on column public.customers.storage_available_mb is
  'Còn ghi thêm được bao nhiêu (quota − usage). Gần 0 = máy sắp không giữ nổi gói đi biển.';
comment on column public.customers.storage_persisted is
  'navigator.storage.persisted() — true = origin được MIỄN vòng thu hồi LRU khi máy thiếu chỗ. false/null trên máy sắp đầy là tổ hợp đáng gọi điện nhất.';
comment on column public.customers.storage_backend is
  '''idb'' = kho dự báo đã nằm ở IndexedDB (đúng thiết kế) · ''ls'' = máy KHÔNG mở nổi IndexedDB nên còn chở ~4 MB trong thùng localStorage 5 MB — sát mép lỗi iOS 16.';

-- Theo TỪNG MÁY (0022) — đổi điện thoại vẫn tra được máy cũ, và để so iOS/Android.
alter table public.customer_devices
  add column if not exists storage_ls_mb integer,
  add column if not exists storage_idb_mb integer,
  add column if not exists storage_cache_mb integer,
  add column if not exists storage_available_mb integer,
  add column if not exists storage_persisted boolean,
  add column if not exists storage_backend text;

comment on column public.customer_devices.storage_backend is
  'Như customers.storage_backend nhưng theo từng máy — chỗ tra "máy nào chưa dời được kho sang IndexedDB".';
