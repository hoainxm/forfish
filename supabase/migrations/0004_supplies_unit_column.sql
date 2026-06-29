-- 0004: Fix prod drift — supplies.unit column thiếu trên prod.
--
-- Bối cảnh: 0002_customers.sql VERSION SAU (2026-06-18) thêm cột `unit` cho
-- supplies (đơn vị: cái/cuộn/kg/m). Prod đã apply 0002 VERSION TRƯỚC khi cột
-- unit được thêm vào file → prod schema lệch file local.
--
-- Hệ quả: backfill SDWork → SDFish (2026-06-25) fail 308/311 supply event với
-- code=upsert_failed vì webhook map field `unit` nhưng prod column không tồn
-- tại (PG error 42703).
--
-- Fix: idempotent ADD COLUMN, không ảnh hưởng prod đã có cột (local), không
-- mất data. Sau khi apply, SDWork retry 308 supply event → pass.

alter table public.supplies add column if not exists unit text;
