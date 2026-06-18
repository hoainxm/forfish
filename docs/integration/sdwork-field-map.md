# SDWork → SDFish — Field map (nguồn SDWork → payload webhook)

> Load khi: SDWork build webhook/outbox, hoặc cần biết cột SDWork nào nuôi field payload nào. Chốt từ khảo sát SDWork 2026-06-18. Payload shape canonical: [sdwork-sso-contract.md](sdwork-sso-contract.md).

**Last updated**: 2026-06-18

---

## Entity nguồn (SDWork = Supabase Postgres)

| Đích SDFish | Bảng SDWork | Filter | ref (UUID PK) |
|---|---|---|---|
| customer | `public.accounts` | `type='customer'` | `accounts.id` |
| customer auth | `public.temp_credentials` (+ provision `auth.users`) | `context='create_customer'` | — |
| device | `order_item_serials ⋈ products ⋈ orders ⋈ accounts` | `order_id NOT NULL`, `accounts.type='customer'` | `order_item_serials.id` |
| warranty | `warranty_cards` (canonical) / `warranties` (legacy) | `status='active'` | (order_id, product_id, serial) |
| supply | `order_items ⋈ products ⋈ orders ⋈ accounts` | `products.track_by_serial=false` + filter customer | `order_items.id` |

`ref` luôn = UUID PK bảng nguồn → bất biến → upsert idempotent theo `(entity, ref)`.

## Map field → payload

### customer
| payload key | nguồn SDWork | bắt buộc | ghi chú |
|---|---|---|---|
| `phone` | `accounts.login_phone` | ✅ | đã normalize `0xxxxxxxxx`. **KHÔNG dùng `accounts.phone` raw** (bẩn: +84/space/dot). Legacy NULL → SKIP event đến khi backfill |
| `name` | `accounts.name` | — | |
| `password` | `temp_credentials.temp_password` | lần đầu | plain để sale báo; **chỉ emit lúc INSERT đầu**. SDFish set vào auth user (hash), KHÔNG lưu plain. Reset sau → KHÔNG emit (SDFish có flow riêng) |

Delete: `accounts.status → inactive` (soft delete) → emit `action:delete`.

### device
| payload key | nguồn SDWork | bắt buộc | ghi chú |
|---|---|---|---|
| `customerPhone` | `accounts.login_phone` (qua `orders.customer_id`) | ✅ | |
| `name` | `products.name` (qua `order_item_serials.product_id`) | ✅ | |
| `serial` | `order_item_serials.serial_number` | — | |
| `model` | `products.sku` | — | không có cột model riêng → dùng sku |
| `purchasedOn` | `orders.delivery_confirmed_at` → fallback `orders.confirmed_at` | — | timestamptz → `YYYY-MM-DD` |
| `warrantyUntil` | `warranty_cards.expires_at` → fallback `purchasedOn + products.warranty_months` | — | compute nếu chưa activate warranty_card |
| `orderCode` | `orders.code` | — | |

Delete: RMA đổi serial (`device_replacements`) hoặc xoá `order_item_serials` → ref cũ `delete` + ref mới `upsert`.

### supply
| payload key | nguồn SDWork | bắt buộc | ghi chú |
|---|---|---|---|
| `customerPhone` | `accounts.login_phone` (qua `orders.customer_id`) | ✅ | |
| `name` | `products.name` (qua `order_items.product_id`) | ✅ | |
| `qty` | `order_items.qty` | — | numeric, **thập phân OK** (1.5) |
| `unit` | `products.unit` | — | cái/cuộn/kg/m (thêm 2026-06-18) |
| `orderCode` | `orders.code` | — | |

## Cơ chế phát event (SDWork build — chưa có)

Transactional outbox: trigger `AFTER INSERT/UPDATE/DELETE` trên accounts/order_item_serials/order_items/warranty_cards → bảng `sdfish_outbox(id serial, entity, action, ref, payload jsonb, sent_at, attempts)` → edge fn cron ~30s POST sang SDFish, ký HMAC, set `sent_at`.

- `action`: `TG_OP IN (INSERT,UPDATE)` → `upsert`; `DELETE` / `status→inactive` → `delete`.
- Thứ tự: gửi theo `outbox.id` tăng dần.
- Đánh dấu `sent_at` theo `results[].ok` từ response SDFish (xem contract §Response), KHÔNG dựa applied count.
- Retry: `ok:false` → để lại outbox, backoff, max N attempts → alert.

## Dữ liệu bẩn / khoảng trống đã xử

| Vấn đề | Xử lý |
|---|---|
| `accounts.phone` raw nhiều format | dùng `login_phone` đã normalize |
| Legacy `login_phone IS NULL` | chạy `migrate-external-login-phones` + backfill XONG mới bật incremental |
| Duplicate phone giữa accounts cũ | dedupe + chọn 1 chính trước backfill |
| `orders.customer_id` = đại lý (distributor/regional/sub) | filter cứng `accounts.type='customer'`; đại lý mua hộ → `customer_profiles` mapping = **Đợt 2** |
| `order_item_serials.order_id IS NULL` (nhập kho chưa bán) | filter `order_id NOT NULL` |
| `password` plain | HTTPS + HMAC; SDFish set ngay vào auth user, không lưu plain |

## Backfill (1 lần, trước incremental)

1. Chạy `migrate-external-login-phones` (lấp NULL login_phone) + dedupe phone.
2. Full snapshot customer → device → supply theo batch (idempotent upsert → replay an toàn).
3. Bật trigger/outbox incremental.

## Checklist SDFish đã chốt (2026-06-18)

- Endpoint: `POST /api/sdwork/webhook` · HMAC-SHA256 header `x-sdwork-signature` (raw body) · secret `SDWORK_WEBHOOK_SECRET`. Không Bearer.
- Batch `{events:[...]}`. Response `{ok, applied, results[]}` (per-event).
- qty thập phân: ✅. `supply.unit`: ✅ thêm.
- Chỉ `type=customer`. RMA: cũ delete + mới upsert ✅.
- password chỉ lần tạo đầu; reset = flow SDFish.
- SLA: ~30–60s outbox, không realtime.
