# SDWork → SDFish — Webhook ingest (tách riêng)

> **Cập nhật 2026-06-18**: SDFish thành **app khách hàng độc lập** — DB riêng (KH·thiết bị·vật tư), KHÔNG đọc-live SDWork. Đơn vẫn nhập ở SDWork; SDWork **đẩy webhook** sang SDFish khi tạo/đổi → SDFish upsert vào bảng riêng. Auth là **SĐT + MẬT KHẨU** trên project SDFish (KHÔNG email/OTP, không SSO vào CRM nữa) — provision qua webhook (customer event kèm `password`).
>
> Tài liệu cũ (SSO magic-link / signInWithPassword thẳng CRM) **đã bỏ** — auth-gateway/SSO chỉ còn đường mật khẩu PHỤ, chuyển tiếp, sẽ retire.

## 1. Luồng

```
[Sale tạo/đổi đơn ở SDWork]
        │  trigger (đơn / KH / thiết bị / vật tư thay đổi)
        ▼  POST https://<sdfish>/api/sdwork/webhook   (HMAC ký)
[SDFish webhook] → verify HMAC → upsert bảng SDFish (service-role)
        ▼
[customers · devices · supplies]  ← KH đăng nhập (SĐT+mật khẩu) đọc của mình (RLS)
```

SDFish KHÔNG gọi ngược SDWork lúc KH mở app → SDWork chết app vẫn xem được (dữ liệu đã ở SDFish).

## 2. Bảo mật webhook

- **HMAC SHA-256** trên **raw body**, header `x-sdwork-signature` = hex digest, secret chung `SDWORK_WEBHOOK_SECRET` (env SDFish; SDWork giữ bản sao).
- Sai chữ ký → 401. Thiếu secret → 503.
- Verify: `src/lib/sdwork-webhook.ts` `verifyWebhookSignature` (so an toàn thời gian).

## 3. Shape payload

```jsonc
POST /api/sdwork/webhook
{
  "events": [
    { "entity": "customer", "action": "upsert", "ref": "<id SDWork>",
      "data": { "phone": "0901234567", "name": "Nguyễn Văn A",
                "password": "<mk khởi tạo, tuỳ chọn>",
                "resetPassword": false } },   // password → tạo tài khoản; resetPassword:true → ĐẶT LẠI mk hiện hữu
    { "entity": "device", "action": "upsert", "ref": "<id SDWork>",
      "data": { "customerPhone": "0901234567", "name": "Anten vệ tinh SF-50",
                "serial": "SF50-001", "model": "SF-50",
                "purchasedOn": "2026-06-01", "warrantyUntil": "2028-06-01",
                "orderCode": "DH-123" } },
    { "entity": "supply", "action": "upsert", "ref": "<id>",
      "data": { "customerPhone": "0901234567", "name": "Cáp đồng trục RG-58",
                "qty": 1.5, "unit": "m", "orderCode": "DH-123" } },
    { "entity": "device", "action": "delete", "ref": "<id>" }
  ]
}
```

- `entity`: `customer` | `device` | `supply`. `action`: `upsert` | `delete`.
- `ref`: id bên SDWork (UUID PK bảng nguồn) — **bắt buộc**, bất biến, dùng idempotent (`onConflict: sdwork_ref`) + để delete.
- SĐT định dạng nào cũng được — SDFish chuẩn hoá về `0xxxxxxxxx` (`normalizeVnPhone`). SDWork nên gửi sẵn `login_phone` đã normalize.
- `supply.qty`: number, **chấp nhận thập phân** (`1.5`). `supply.unit`: đơn vị (cái/cuộn/kg/m), optional.
- `device`: `model` = `products.sku`; `warrantyUntil` = `warranty_cards.expires_at` hoặc compute `purchasedOn + warranty_months` (xem [field-map](sdwork-field-map.md)).
- Map → hàng bảng: `toCustomerRow` / `toDeviceRow` / `toSupplyRow` (`src/lib/sdwork-webhook.ts`, có test). Thiếu field bắt buộc (phone/name) → bỏ qua hàng đó.

### Response (đối soát outbox)

```jsonc
200 { "ok": true, "applied": 3,
  "results": [
    { "ref": "<id>", "entity": "customer", "action": "upsert", "ok": true, "provisioned": true },
    { "ref": "<id>", "entity": "device",   "action": "upsert", "ok": true },
    { "ref": "<id>", "entity": "supply",   "action": "upsert", "ok": false, "code": "upsert_failed" }
  ] }
```

- `results[]` 1 phần tử / event (cùng thứ tự gửi). SDWork **đánh dấu outbox theo `results[].ok`** — KHÔNG dựa `applied` count (event lỗi không câm).
- `code`: `bad_event` | `missing_required` | `upsert_failed` | `delete_failed`. `ok:false` → SDWork retry event đó.
- `provisioned` (chỉ customer có `password`): `true` tạo được tài khoản; `false` = upsert dữ liệu OK nhưng **tạo auth user lỗi → KH chưa đăng nhập được**, cần alert.
- Lỗi toàn cục (không per-event): `401 bad_signature` · `503 not_configured` · `400 bad_json`.

## 4. Map khoá

| SDWork | SDFish |
|---|---|
| customer id | `customers.sdwork_ref` (unique) |
| SĐT khách | `customers.phone` (chuẩn hoá) = `devices.customer_phone` |
| order/serial id | `devices.sdwork_ref` / `supplies.sdwork_ref` (unique) |

## 5. Auth (SDFish riêng — hướng TÀI KHOẢN, KHÔNG email/OTP)

- **SĐT + MẬT KHẨU**: `signInWithPassword({ email: {SĐT}@sdvico.local, password })` trên project SDFish (`znzgugvfhgmiszqgjulk`). Email ảo chỉ là handle nội bộ; KHÔNG gửi email, KHÔNG OTP.
- **Provision**: customer event kèm `password` → webhook tạo auth user (SĐT+mk, `email_confirm:true`, `user_metadata.must_change_password:true`). ĐÃ tồn tại + KHÔNG `resetPassword` → bỏ qua (KHÔNG ghi đè mk KH đã đổi). Sale báo KH "SĐT + mật khẩu"; lần đầu app ép đổi mk.
- KH đăng nhập thấy thiết bị của mình vì RLS lọc `current_phone()` = SĐT từ email — khớp `devices.customer_phone` webhook đã nạp.

## 5b. Đồng bộ mật khẩu 2 chiều (1 credential — đăng nhập được CẢ 2 app)

- **Inbound (SDWork → SDFish) RESET**: customer event `data.resetPassword:true` + `password` → SDFish `updateUserById` đặt lại mk auth user + bật `must_change_password` (lần sau ép đổi). Tra id qua RPC `auth_user_id_by_phone` (migration `0003`). `provisioned:true` = đặt lại OK.
- **Outbound (SDFish → SDWork)**: KH đổi mk ở `/doi-mat-khau` → SDFish `POST {SDWORK_SYNC_URL}` body `{ phone, password }` (SĐT lấy từ **session**, không tin client), header **`x-sdfish-signature`** = HMAC-SHA256(raw, `SDWORK_WEBHOOK_SECRET`). **Best-effort**: đổi tại SDFish đã xong, lỗi đẩy ngược KHÔNG chặn KH; cron đối soát/đẩy lại = sau.
- **SDWork phải dựng endpoint nhận** (xem §7): verify `x-sdfish-signature` → đặt mk khách bên CRM = `password`. Nếu không dựng → mk chỉ đổi ở SDFish, đăng nhập SDWork vẫn mk cũ.
- 🔐 Mật khẩu đi **plaintext** trên kênh HMAC+TLS (đối xứng inbound vốn cũng gửi plaintext). KHÔNG log password 2 đầu.
- `/api/auth/sso` (verify CRM) **LEGACY** — login không còn gọi, retire sau.

## 6. Cấu hình (.env SDFish)

```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...            # admin client: webhook upsert + provision/reset auth user
SDWORK_WEBHOOK_SECRET=...                # HMAC chung 2 chiều (inbound verify + outbound ký)
SDWORK_SYNC_URL=https://<sdwork>/...     # endpoint SDWork nhận mk đổi từ SDFish (outbound); trống = tắt đẩy ngược
```

## 7. Việc phía SDWork (user quản CẢ 2 project — tự cấu hình)

- Cấu hình **trigger/webhook** trên SDWork: khi đơn/KH/thiết bị/vật tư tạo-đổi-xoá → POST `events[]` (HMAC ký) tới `/api/sdwork/webhook`. Customer event đính `password` khởi tạo để provision tài khoản; đặt lại mk thì gửi thêm `resetPassword:true`.
- **Dựng endpoint nhận mk đổi từ SDFish** (đồng bộ 2 chiều, §5b): verify header `x-sdfish-signature` = HMAC-SHA256(raw, `SDWORK_WEBHOOK_SECRET`) → set mk khách bên CRM theo `{phone, password}`. KHÔNG dựng = đăng nhập SDWork giữ mk cũ sau khi KH đổi ở SDFish.
- Tự sinh + giữ **secret** `SDWORK_WEBHOOK_SECRET` (cùng giá trị 2 nơi) + retry (webhook lẻ dễ rớt → cron đối soát dự phòng Đợt 2).
- KHÔNG sửa schema CRM từ SDFish.
- **Field map chi tiết** (cột SDWork → payload key, outbox, backfill, dữ liệu bẩn): [sdwork-field-map.md](sdwork-field-map.md).

## 8. Còn lại (Đợt 2+)

- Apply migration `0002`+`0003` lên prod 🔴 · cấu hình `SDWORK_SYNC_URL` + dựng endpoint nhận phía SDWork (§5b/§7) · cron đối soát backfill + đẩy lại mk lỗi · retire đọc-live SDWork (gateway `forfish-gateway` + `/api/auth/sso`).
- ✅ Đã xong (code+test, 2026-06-19): reset mk inbound (`resetPassword`) · đẩy mk outbound (`/api/sdwork/password-sync`) · RPC `auth_user_id_by_phone` (`0003`) · fix `must_change_password` ở `user_metadata`.

---

**Last updated**: 2026-06-19 (đồng bộ mật khẩu 2 chiều: reset inbound + đẩy outbound + RPC 0003)
