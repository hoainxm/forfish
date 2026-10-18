-- SDFish — KHOÁ `search_path` CHO HAI HÀM CỦA SÀN (2026-09-07).
--
-- Sinh ra ngay sau khi apply 0060 + 0061: bộ soi của Supabase (`get_advisors`)
-- báo WARN `function_search_path_mutable` cho đúng hai hàm này. Mọi hàm khác của
-- sàn (`market_place_order`, `market_restock_order`, `market_add_review`,
-- `market_recount_rating`, `market_set_review_hidden`) đã có `set search_path`
-- sẵn trong 0060 — chỉ hai hàm dưới đây bị sót.
--
-- Vì sao phải khoá: hàm không ghim `search_path` sẽ tra tên theo đường dẫn của
-- NGƯỜI GỌI. Ai tạo được một schema đứng trước `public` là chèn được hàm/toán tử
-- trùng tên rồi cướp quyền thực thi — `market_set_updated_at` lại là trigger chạy
-- trên MỌI lần ghi của bốn bảng sàn.
--
-- Đặt `search_path = ''` (rỗng) chứ không phải `= public`: thân hai hàm chỉ dùng
-- hàm dựng sẵn (`now`, `trim`, `lower`, `translate`, `repeat`, `regexp_replace`)
-- — chúng nằm ở `pg_catalog`, luôn được tra kể cả khi đường dẫn rỗng. Không có
-- tên nào của schema `public` trong thân hàm nên rỗng là chặt nhất mà vẫn chạy.
--
-- KHÔNG sửa thẳng vào 0060/0061: hai file đó đã apply lên prod, lịch sử migration
-- phải khớp thứ đã chạy. Vá bằng một bước mới.
-- ✅ ĐÃ APPLY prod 2026-09-07 (ref znzgugvfhgmiszqgjulk).
-- Xem docs/app-map/04-data-model.md §7f.

create or replace function public.market_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.market_fold_vn(s text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(regexp_replace(
    translate(
      lower(s),
      'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
      repeat('a', 17) || repeat('e', 11) || repeat('i', 5) ||
      repeat('o', 17) || repeat('u', 11) || repeat('y', 5) || 'd'
    ),
    '[^a-z0-9]+', ' ', 'g'))
$$;

comment on function public.market_fold_vn(text) is
  'Bỏ dấu + thường hoá, khớp foldVn() ở src/lib/market/text.ts. Dùng để ghi shop_products.search_text trong migration. search_path khoá rỗng (0062).';
