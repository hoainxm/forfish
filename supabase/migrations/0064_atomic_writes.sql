-- SDFish — GHI NGUYÊN TỬ: ĐỒNG BỘ SỔ + ĐƠN HÀNG + YÊU CẦU ĐẶT (2026-10-18, rà Codex)
--
-- Rà kiến trúc (Codex 2026-10-18) chỉ ra ba cửa sổ ghi dở dang — từng câu đúng,
-- cả quy trình vẫn để lại dữ liệu sai khi mất mạng hoặc hai request sát nhau:
--   1. /api/me/sync: đọc → gộp ở Node → upsert, KHÔNG kiểm bản vừa đọc. Hai máy
--      cùng đọc rev N rồi lần lượt ghi ⇒ phần thêm của máy ghi trước bị đè mất.
--   2. Huỷ đơn: đổi status xong mới gọi market_restock_order; RPC hỏng chỉ ghi log
--      ⇒ đơn đã huỷ mà hàng chưa về kho.
--   3. Nhận báo giá: đổi yêu cầu → tạo đơn → ghi order_id là ba câu; tiến trình
--      chết giữa chừng ⇒ yêu cầu "đã đặt" không có đơn, rollback tay không chạy.
--   (+) Timeline đơn/yêu cầu đọc-rồi-ghi cả mảng ⇒ hai cập nhật sát nhau mất sự kiện.
--
-- Cách vá:
--   1. user_docs.rev — số phiên bản do SERVER cấp. Route ghi có điều kiện
--      `where rev = <rev vừa đọc>`; trượt ⇒ đọc lại, gộp lại, thử lại (≤ 3).
--      Không đụng giao thức với app: máy cũ ngoài biển gửi y như trước.
--   2. market_transition_order: MỘT câu UPDATE (điều kiện status cũ) + append
--      timeline tại DB (`timeline || entry`) + hoàn kho NGAY trong cùng giao dịch
--      khi sang da_huy. Hoàn kho lỗi ⇒ cả cú huỷ rollback, không có đơn huỷ-mà-chưa-hoàn.
--   3. market_patch_request: như (2) cho yêu cầu đặt hàng.
--   4. market_accept_request: chuyển yêu cầu da_bao_gia → da_dat + tạo đơn + ghi
--      order_id trong MỘT giao dịch. Mã đơn trùng (23505 market_orders_code_key) ⇒
--      cả giao dịch rollback, adapter sinh mã mới gọi lại. Cùng client_ref ⇒ trả đơn cũ.
--
-- Auth: khuôn 0037/0060 — security definer, revoke public/anon/authenticated; chỉ
-- route service-role gọi (đã xác thực owner/admin ở TS trước khi gọi).
-- Lỗi nghiệp vụ: P0001 message = mã (not_found · bad_transition) — adapter map MarketError.
-- Tương thích: cột mới có default, hàm mới; code cũ vẫn chạy nguyên trên DB này.
-- ✅ ĐÃ APPLY prod 2026-10-19 (ref znzgugvfhgmiszqgjulk, chủ dự án duyệt "viết và apply luôn"; schema_migrations
--    20261019061252). Đã chạy rồi thì ĐỪNG sửa file này — vá bằng migration mới.
-- Xem docs/app-map/04-data-model.md mục "GHI NGUYÊN TỬ".

-- ── 1. user_docs.rev ──────────────────────────────────────────────────────
alter table public.user_docs
  add column if not exists rev bigint not null default 0;
comment on column public.user_docs.rev is
  'Phiên bản do server cấp, +1 mỗi lần ghi. /api/me/sync ghi có điều kiện rev = rev đã đọc (CAS) — trượt thì đọc lại gộp lại.';

-- ── 2. Chuyển trạng thái đơn — nguyên tử, kèm hoàn kho ───────────────────
-- p_patch: object chỉ chứa khoá cần đổi (snake_case cột). Khoá vắng ⇒ giữ nguyên.
-- p_entry: một sự kiện timeline {status, at, by, note} hoặc null.
create or replace function public.market_transition_order(
  p_id     uuid,
  p_expect text,
  p_patch  jsonb,
  p_entry  jsonb
) returns public.market_orders
language plpgsql security definer set search_path = public as $$
declare
  o public.market_orders;
begin
  update public.market_orders m set
    status         = case when p_patch ? 'status'         then p_patch->>'status'                     else m.status end,
    payment_status = case when p_patch ? 'payment_status' then p_patch->>'payment_status'             else m.payment_status end,
    cancel_by      = case when p_patch ? 'cancel_by'      then p_patch->>'cancel_by'                  else m.cancel_by end,
    cancel_reason  = case when p_patch ? 'cancel_reason'  then p_patch->>'cancel_reason'              else m.cancel_reason end,
    needs_refund   = case when p_patch ? 'needs_refund'   then (p_patch->>'needs_refund')::boolean    else m.needs_refund end,
    seller_note    = case when p_patch ? 'seller_note'    then p_patch->>'seller_note'                else m.seller_note end,
    carrier        = case when p_patch ? 'carrier'        then p_patch->>'carrier'                    else m.carrier end,
    tracking_code  = case when p_patch ? 'tracking_code'  then p_patch->>'tracking_code'              else m.tracking_code end,
    delivered_at   = case when p_patch ? 'delivered_at'   then (p_patch->>'delivered_at')::timestamptz else m.delivered_at end,
    completed_at   = case when p_patch ? 'completed_at'   then (p_patch->>'completed_at')::timestamptz else m.completed_at end,
    eta_from       = case when p_patch ? 'eta_from'       then (p_patch->>'eta_from')::date           else m.eta_from end,
    eta_to         = case when p_patch ? 'eta_to'         then (p_patch->>'eta_to')::date             else m.eta_to end,
    timeline       = case when p_entry is not null then m.timeline || jsonb_build_array(p_entry) else m.timeline end
  where m.id = p_id and m.status = p_expect
  returning * into o;
  if not found then
    if exists (select 1 from public.market_orders where id = p_id) then
      raise exception 'bad_transition' using errcode = 'P0001';
    end if;
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- Cùng giao dịch: hoàn kho lỗi ⇒ cả cú huỷ rollback.
  if o.status = 'da_huy' then
    perform public.market_restock_order(p_id);
    select * into o from public.market_orders where id = p_id;
  end if;
  return o;
end $$;
revoke all on function public.market_transition_order(uuid, text, jsonb, jsonb) from public, anon, authenticated;

-- ── 3. Vá yêu cầu đặt hàng — nguyên tử, append timeline tại DB ───────────
create or replace function public.market_patch_request(
  p_id     uuid,
  p_expect text,
  p_patch  jsonb,
  p_entry  jsonb
) returns public.market_requests
language plpgsql security definer set search_path = public as $$
declare
  r public.market_requests;
begin
  update public.market_requests q set
    status        = case when p_patch ? 'status'        then p_patch->>'status'               else q.status end,
    quote         = case when p_patch ? 'quote'         then p_patch->'quote'                 else q.quote end,
    quote_shop_id = case when p_patch ? 'quote_shop_id' then (p_patch->>'quote_shop_id')::uuid else q.quote_shop_id end,
    reject_reason = case when p_patch ? 'reject_reason' then p_patch->>'reject_reason'        else q.reject_reason end,
    order_id      = case when p_patch ? 'order_id'      then (p_patch->>'order_id')::uuid      else q.order_id end,
    timeline      = case when p_entry is not null then q.timeline || jsonb_build_array(p_entry) else q.timeline end
  where q.id = p_id and q.status = p_expect
  returning * into r;
  if not found then
    if exists (select 1 from public.market_requests where id = p_id) then
      raise exception 'bad_transition' using errcode = 'P0001';
    end if;
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return r;
end $$;
revoke all on function public.market_patch_request(uuid, text, jsonb, jsonb) from public, anon, authenticated;

-- ── 4. Đồng ý báo giá: yêu cầu → đơn → liên kết, MỘT giao dịch ───────────
-- p_order: các cột của đơn (code, shop_id, items, subtotal_vnd, shipping_vnd, total_vnd,
--          bank_snapshot, buyer_note, timeline, eta_from, eta_to). buyer_phone, address,
--          payment_method, request_id, client_ref lấy từ CHÍNH yêu cầu trong DB — không tin TS.
-- Trả {request, order} (jsonb hai bản ghi).
create or replace function public.market_accept_request(
  p_id    uuid,
  p_patch jsonb,
  p_entry jsonb,
  p_order jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.market_requests;
  o public.market_orders;
begin
  -- Đã đồng ý trước đó (bấm hai lần / máy gửi lại) ⇒ trả đơn cũ, không sinh đơn thứ hai.
  select * into r from public.market_requests where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if r.order_id is not null then
    select * into o from public.market_orders where id = r.order_id;
    return jsonb_build_object('request', to_jsonb(r), 'order', to_jsonb(o));
  end if;

  r := public.market_patch_request(p_id, 'da_bao_gia', p_patch, p_entry);

  insert into public.market_orders (
    code, buyer_phone, shop_id, items, subtotal_vnd, shipping_vnd, total_vnd,
    payment_method, payment_status, bank_snapshot, status, address, buyer_note, timeline,
    eta_from, eta_to, request_id, client_ref
  ) values (
    p_order->>'code', r.buyer_phone, (p_order->>'shop_id')::uuid, p_order->'items',
    (p_order->>'subtotal_vnd')::integer, (p_order->>'shipping_vnd')::integer, (p_order->>'total_vnd')::integer,
    r.payment_method, 'chua_thanh_toan', nullif(p_order->'bank_snapshot', 'null'::jsonb), 'da_xac_nhan',
    r.address, nullif(p_order->>'buyer_note', ''), p_order->'timeline',
    (p_order->>'eta_from')::date, (p_order->>'eta_to')::date, r.id, 'yc:' || r.id::text
  ) returning * into o;

  update public.market_requests set order_id = o.id where id = p_id returning * into r;
  return jsonb_build_object('request', to_jsonb(r), 'order', to_jsonb(o));
end $$;
revoke all on function public.market_accept_request(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
