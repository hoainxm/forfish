# SDWork → SDFish — Webhook ingest (tách riêng)

> **Cập nhật 2026-06-16**: SDFish thành **app khách hàng độc lập** — DB riêng (KH·thiết bị·vật tư), KHÔNG đọc-live SDWork. Đơn vẫn nhập ở SDWork; SDWork **đẩy webhook** sang SDFish khi tạo/đổi → SDFish upsert vào bảng riêng. Auth là **OTP riêng** trên project SDFish (không SSO vào CRM nữa).
>
> Tài liệu cũ (SSO magic-link / signInWithPassword thẳng CRM) **đã bỏ** — auth-gateway/SSO chỉ còn đường mật khẩu PHỤ, chuyển tiếp, sẽ retire.

## 1. Luồng

```
[Sale tạo/đổi đơn ở SDWork]
        │  trigger (đơn / KH / thiết bị / vật tư thay đổi)
        ▼  POST https://<sdfish>/api/sdwork/webhook   (HMAC ký)
[SDFish webhook] → verify HMAC → upsert bảng SDFish (service-role)
        ▼
[customers · devices · supplies]  ← KH đăng nhập (SĐT+OTP) đọc của mình (RLS)
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
      "data": { "phone": "0901234567", "name": "Nguyễn Văn A" } },
    { "entity": "device", "action": "upsert", "ref": "<id SDWork>",
      "data": { "customerPhone": "0901234567", "name": "Anten vệ tinh SF-50",
                "serial": "SF50-001", "model": "SF-50",
                "purchasedOn": "2026-06-01", "warrantyUntil": "2028-06-01",
                "orderCode": "DH-123" } },
    { "entity": "supply", "action": "upsert", "ref": "<id>",
      "data": { "customerPhone": "0901234567", "name": "Lõi lọc nước", "qty": 2,
                "orderCode": "DH-123" } },
    { "entity": "device", "action": "delete", "ref": "<id>" }
  ]
}
```

- `entity`: `customer` | `device` | `supply`. `action`: `upsert` | `delete`.
- `ref`: id bên SDWork — **bắt buộc**, dùng idempotent (`onConflict: sdwork_ref`) + để delete.
- SĐT định dạng nào cũng được — SDFish chuẩn hoá về `0xxxxxxxxx` (`normalizeVnPhone`).
- Map → hàng bảng: `toCustomerRow` / `toDeviceRow` / `toSupplyRow` (`src/lib/sdwork-webhook.ts`, có test). Thiếu field bắt buộc (phone/name) → bỏ qua hàng đó.

## 4. Map khoá

| SDWork | SDFish |
|---|---|
| customer id | `customers.sdwork_ref` (unique) |
| SĐT khách | `customers.phone` (chuẩn hoá) = `devices.customer_phone` |
| order/serial id | `devices.sdwork_ref` / `supplies.sdwork_ref` (unique) |

## 5. Auth (SDFish riêng — KHÔNG SSO CRM)

- SĐT + **OTP** (`/api/auth/otp/{request,verify}`) trên project SDFish (`znzgugvfhgmiszqgjulk`). User email ảo `{SĐT}@sdvico.local` (handle nội bộ).
- Mật khẩu là đường PHỤ (chuyển tiếp); `/api/auth/sso` (verify CRM) **giữ tạm**, retire sau khi webhook ổn.
- KH đăng nhập thấy thiết bị của mình vì RLS lọc `current_phone()` = SĐT từ email — khớp `devices.customer_phone` webhook đã nạp.

## 6. Cấu hình (.env SDFish)

```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...            # admin client: webhook upsert + OTP verify
SDWORK_WEBHOOK_SECRET=...                # HMAC chung với SDWork
OTP_PROVIDER=                            # trống = stub; cắm zalo/sms sau
OTP_PEPPER=                              # muối hash OTP (tuỳ chọn)
```

## 7. Việc phía SDWork (Đợt 0, ngoài repo)

- Cấu hình **trigger/webhook**: khi đơn/KH/thiết bị/vật tư tạo-đổi-xoá → POST `events[]` (HMAC ký) tới `/api/sdwork/webhook`.
- Chốt **secret** + retry (webhook lẻ dễ rớt → SDFish có cron đối soát dự phòng ở Đợt 2).
- KHÔNG sửa schema CRM từ SDFish.

## 8. Còn lại (Đợt 2+)

- Apply migration `0002` lên prod 🔴 · OTP provider thật (Zalo ZNS/SMS) · cron đối soát backfill · retire đọc-live SDWork (gateway `forfish-gateway` + `/api/auth/sso`).

---

**Last updated**: 2026-06-16 (đổi từ SSO magic-link → webhook ingest + OTP riêng)
