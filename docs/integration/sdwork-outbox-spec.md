# Spec — Outbox/Trigger phía SDWork (đẩy dữ liệu + credential sang SDFish)

> Phần này **dựng bên SDWork** (producer). SDFish chỉ *nhận* (`/api/sdwork/webhook`,
> đã xong). Không có outbox này → không dữ liệu nào chảy sang SDFish.
> Hợp đồng payload: [sdwork-sso-contract.md](sdwork-sso-contract.md) §3. Mục tiêu:
> KH tạo/đổi ở SDWork → SDFish thấy, và **1 mật khẩu đăng nhập cả 2 app**.

## 1. Khi nào bắn (sự kiện nguồn → event)

| Thay đổi ở SDWork | Event gửi SDFish |
|---|---|
| Tạo khách (sale đặt mật khẩu khởi tạo) | `customer` `upsert` + `data.password` (mk khởi tạo) |
| Sửa tên/SĐT khách | `customer` `upsert` (KHÔNG password) |
| Nhân viên **đặt lại mật khẩu** khách | `customer` `upsert` + `data.password` + `data.resetPassword: true` |
| Tạo/sửa thiết bị (đơn, serial, bảo hành) | `device` `upsert` |
| Xoá thiết bị | `device` `delete` (chỉ cần `ref`) |
| Tạo/sửa/xoá vật tư | `supply` `upsert` / `delete` |

`ref` = **id bản ghi nguồn SDWork** (PK, bất biến) — dùng idempotent + để delete.

## 2. Cơ chế: Transactional Outbox (KHÔNG gọi HTTP trực tiếp trong transaction)

```
[Ghi đơn/KH/...] ──(cùng 1 transaction)──> INSERT vào bảng `sdfish_outbox`
                                                   │
[Worker: cron mỗi 30-60s / pg trigger → pg_net]   │ đọc hàng chưa gửi
                                                   ▼
        gộp ≤100 event → POST /api/sdwork/webhook (HMAC ký) → đọc results[]
                                                   ▼
        results[i].ok=true → đánh dấu sent · ok=false → giữ lại, retry
```

Lý do outbox: webhook lẻ dễ rớt (mạng/deploy). Ghi outbox CÙNG transaction nghiệp
vụ → không mất event; worker đẩy + retry tách biệt.

### Bảng `sdfish_outbox` (gợi ý)
```sql
create table sdfish_outbox (
  id          bigserial primary key,
  entity      text not null,            -- customer|device|supply
  action      text not null,            -- upsert|delete
  ref         text not null,            -- id nguồn SDWork
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,              -- null = chưa gửi
  attempts    int not null default 0,
  last_error  text
);
create index on sdfish_outbox (sent_at) where sent_at is null;
```

## 3. Gửi (worker)

- Lấy `... where sent_at is null order by id limit 100`.
- Body: `{ "events": [ { entity, action, ref, data }, ... ] }`.
- Header `x-sdwork-signature` = **HMAC-SHA256 hex của RAW body** với `SDWORK_WEBHOOK_SECRET` (giống secret SDFish).
- Timeout ~10s.

## 4. Xử lý response (theo `results[]`, KHÔNG theo `applied`)

| Kết quả | Hành động |
|---|---|
| `results[i].ok = true` | đánh dấu `sent_at = now()` cho event `ref` đó |
| `results[i].ok = false`, `code` ∈ `upsert_failed/delete_failed/missing_required/bad_event` | giữ chưa gửi, `attempts++`, retry (xem §5) |
| `results[i].provisioned = false` (customer có password) | upsert dữ liệu OK nhưng **tạo/đặt auth user lỗi → KH chưa đăng nhập được** → **ALERT** nhân viên |
| HTTP `401 bad_signature` | secret 2 bên LỆCH → DỪNG, alert (đừng retry mù) |
| HTTP `503 not_configured` | SDFish thiếu env → retry sau (backoff dài) |
| HTTP `400 bad_json` | lỗi build body phía SDWork → sửa code, không retry |
| timeout/mạng | retry backoff |

## 5. Retry + dead-letter

- Backoff luỹ thừa: 1m, 5m, 30m, 2h… cap `attempts` (vd 8).
- Quá ngưỡng → để `sent_at` null + cờ dead-letter + alert; người xử tay.
- Idempotent theo `ref` (`onConflict: sdwork_ref`) → retry trùng KHÔNG hỏng.

## 6. Thứ tự

- Gửi `customer` TRƯỚC `device/supply` của khách đó (để khách đăng nhập + RLS khớp). Nếu gộp 1 batch: xếp customer lên đầu mảng `events`.

## 7. Đồng bộ mật khẩu — chống echo-loop ⚠️

Chiều ngược (SDFish→SDWork) gọi edge function `sdfish-password-in` đặt lại mk bên CRM.
Nếu CRM có trigger "đổi mk → ghi outbox", thì:
```
SDFish đổi mk → sdfish-password-in set mk CRM → trigger ghi outbox
  → webhook resetPassword về SDFish → SDFish set lại ĐÚNG mk đó (dừng)
```
Dừng sau 1 nhịp (SDFish set qua webhook, không qua UI nên không đẩy tiếp). Nhưng
gây 1 vòng thừa. **Khuyến nghị:** khi mk đổi đến TỪ `sdfish-password-in` (đánh dấu
nguồn = 'sdfish', vd cột `updated_via` hoặc bỏ qua trong function đó) thì **KHÔNG
ghi outbox** → sạch, không bounce.

## 8. Mật khẩu khởi tạo

- Lúc tạo khách, sale đặt mật khẩu → đính `data.password` trong customer event đầu tiên (SDFish provision, bật `must_change_password` → lần đầu KH bị ép đổi).
- Cấp lại sau: gửi `password` + `resetPassword: true`.

## 9. Bảo mật

- **KHÔNG log `data.password`** trong outbox/worker/log.
- Outbox lưu password plaintext tạm trong `data` jsonb là rủi ro → cân nhắc: với customer-có-password, đẩy NGAY (không qua outbox) hoặc xoá `password` khỏi row sau khi `sent_at`. Tối thiểu: hạn chế quyền đọc bảng outbox.
- Secret `SDWORK_WEBHOOK_SECRET` trong secrets manager, không hardcode.

## 10. Checklist dựng

- [ ] Tạo bảng `sdfish_outbox`.
- [ ] Trigger/app-code: mọi thay đổi KH/thiết bị/vật tư → INSERT outbox (cùng transaction).
- [ ] Worker (cron `pg_cron`/edge `pg_net`/job ngoài) đọc → POST webhook → cập nhật `sent_at`/`attempts`.
- [ ] Map cột CRM → payload key (xem [sdwork-field-map.md](sdwork-field-map.md)).
- [ ] HMAC ký + xử lý `results[]` + alert `provisioned:false`.
- [ ] Chống echo-loop mật khẩu (§7).
- [ ] Backfill khách hiện hữu: bơm 1 lượt customer/device/supply vào outbox.
