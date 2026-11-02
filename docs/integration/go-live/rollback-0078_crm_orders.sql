-- ROLLBACK 0078_crm_orders.sql — chạy tay ở SQL editor SDFish (znzgugvfhgmiszqgjulk).
-- Trước khi chạy: TẮT cờ bên CRM (UPDATE sdfish_sync_flags SET enabled=false WHERE key='order_sync')
-- — nếu không, event `order` mới sẽ upsert_failed và nằm retry/dead bên CRM.
-- Mất toàn bộ đơn SDVICO đã đồng bộ (bản sao — nguồn thật vẫn ở CRM).
begin;
drop function if exists public.crm_order_delete(text, timestamptz);
drop function if exists public.crm_order_upsert(jsonb);
drop table if exists public.crm_order_tombstones;
drop table if exists public.crm_orders;
commit;
