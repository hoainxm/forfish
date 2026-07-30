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
                "password": "<mk khởi tạo, tuỳ chọn>",       // có password → provision tài khoản đăng nhập
                "tier": "premium",                            // tuỳ chọn: "basic" | "premium" (2026-07-26)
                "premiumUntil": "2027-01-31T23:59:59+07:00" } }, // hạn premium; vắng/null = không hạn
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
- **`customer.tier` (2026-07-26, additive — không breaking)**: `"basic"` | `"premium"` mở dự báo cá + thời tiết >3 ngày bên SDFish. **VẮNG field / giá trị lạ → upsert KHÔNG đụng hạng hiện có** (admin SDFish gán tay ở `/quan-tri` không bị webhook ghi đè ngoài ý muốn; muốn hạ hạng phải gửi `"tier": "basic"` tường minh). `premiumUntil` chỉ có nghĩa khi đi kèm `tier: "premium"`; hết hạn SDFish tự coi là basic (không cần event hạ hạng đúng ngày).

### Response (đối soát outbox)

```jsonc
200 { "ok": true, "applied": 3,
  "results": [
    { "ref": "<id>", "entity": "customer", "action": "upsert", "ok": true, "provisioned": true },
    { "ref": "<id>", "entity": "device",   "action": "upsert", "ok": true },
    { "ref": "<id>", "entity": "supply",   "action": "upsert", "ok": false, "code": "upsert_failed",
      "detail": "23505 (trùng khoá duy nhất (vd 2 account CRM dùng chung SĐT)) — duplicate key value violates unique constraint \"customers_phone_key\"" }
  ] }
```

- `results[]` 1 phần tử / event (cùng thứ tự gửi). SDWork **đánh dấu outbox theo `results[].ok`** — KHÔNG dựa `applied` count (event lỗi không câm).
- `code`: `bad_event` | `missing_required` | `upsert_failed` | `delete_failed`. `ok:false` → SDWork retry event đó.
- `detail` (**thêm 2026-07-21, optional — KHÔNG breaking**, worker cũ bỏ qua field lạ): lỗi DB rút gọn ≤200 ký tự (`code` Postgres + nghĩa nghiệp vụ + message), chỉ có khi `ok:false`. Trước đây route nuốt lỗi thật → worker log hàng loạt `upsert_failed` mà không ai biết vì sao (sự cố 21/07: mở phạm vi sang `sub` làm 2 account CRM dùng chung SĐT đụng ràng buộc `customers.phone` UNIQUE). Rút gọn thuần `src/lib/db-error.ts` (có test). **KHÔNG bao giờ kèm `password`** — chỉ lấy message/code của DB.
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
- **Provision**: customer event kèm `password` → webhook tạo auth user (SĐT+mk, `email_confirm:true`, `user_metadata.must_change_password:false`). ĐÃ tồn tại + KHÔNG `resetPassword` → bỏ qua (KHÔNG ghi đè mk KH đã đổi). Sale báo KH "SĐT + mật khẩu".
- **Provision KHÔNG kèm password** (chính sách 2026-07-21): customer event không có `password` + SĐT di động VN hợp lệ (`isValidVnPhone`) + CHƯA có auth user → webhook tạo với mật khẩu mặc định **`sd123456`**. Đã có user → giữ nguyên. Số bàn 02x / số sai định dạng → chỉ upsert hồ sơ, không tạo login. Nhờ vậy đồng bộ định kỳ (`sdfish_dong_bo_lai` phía SDWork) tự lành khách thiếu tài khoản.
- **KHÔNG ép đổi mật khẩu lần đầu** (chính sách 2026-07-21): webhook không còn bật `must_change_password` ở mọi nhánh (trước đây 627/632 KH kẹt ở màn ép đổi, chỉ 6 người từng vào app).
- KH đăng nhập thấy thiết bị của mình vì RLS lọc `current_phone()` = SĐT từ email — khớp `devices.customer_phone` webhook đã nạp.

## 5b. Đồng bộ mật khẩu 2 chiều (1 credential — đăng nhập được CẢ 2 app)

- **Inbound (SDWork → SDFish) RESET**: customer event `data.resetPassword:true` + `password` → SDFish `updateUserById` đặt lại mk auth user + XÓA cờ `must_change_password` còn sót (chính sách 2026-07-21: không ép đổi). Tra id qua RPC `auth_user_id_by_phone` (migration `0003`). `provisioned:true` = đặt lại OK.
- **Outbound (SDFish → SDWork)**: KH đổi mk ở `/doi-mat-khau` → SDFish `POST {SDWORK_SYNC_URL}` body `{ phone, password }` (SĐT lấy từ **session**, không tin client), header **`x-sdfish-signature`** = HMAC-SHA256(raw, `SDWORK_WEBHOOK_SECRET`). **Best-effort**: đổi tại SDFish đã xong, lỗi đẩy ngược KHÔNG chặn KH; cron đối soát/đẩy lại = sau.
- **SDWork phải dựng endpoint nhận** (xem §7): verify `x-sdfish-signature` → đặt mk khách bên CRM = `password`. Nếu không dựng → mk chỉ đổi ở SDFish, đăng nhập SDWork vẫn mk cũ.
- 🔐 Mật khẩu đi **plaintext** trên kênh HMAC+TLS (đối xứng inbound vốn cũng gửi plaintext). KHÔNG log password 2 đầu.
- ⚠️ **2026-07-30**: hướng SDWork-master 1 chiều đã BỎ outbound password-sync `/api/sdwork/password-sync` (§8 ✅ cũ HẾT HIỆU LỰC); chỉ còn inbound. §5b giữ để tham chiếu lịch sử.

## 5c. Trace tiền — MÃ CK (ba-spec 10 NV4/NV5, 2026-07-30)

Ngư dân trả tiền premium → đại lý/nhân viên nhập **MÃ CK** ở SDFish `/quan-tri` (chỉ mã, KHÔNG số tiền — tiền thật + đối soát ở SDWork). SDFish CHUYỂN mã sang SDWork để đối chiếu sao kê; SDWork xác nhận đã nhận → SDFish đánh dấu "đã đối chiếu".

- **Outbound (SDFish → SDWork)** — cron `/api/cron/trace-payments` (hàng giờ): mỗi payment chưa bắn → `POST {SDWORK_TRACE_URL}` body `{ code, phone, agent, recordedAt }`, header **`x-sdfish-signature`** = HMAC-SHA256(raw, `SDWORK_WEBHOOK_SECRET`). SDFish set `traced_at` khi HTTP 2xx (không bắn lại); lỗi → giữ, cron sau thử lại.
- **SDWork phải dựng endpoint nhận** ở `SDWORK_TRACE_URL`: verify `x-sdfish-signature` → lưu mã + tra sao kê ngân hàng theo `code` → khi thấy khớp, **bắn webhook xác nhận về** SDFish.
- **Inbound xác nhận (SDWork → SDFish)** — tái dùng `/api/sdwork/webhook`: gửi event `{ "entity": "payment", "action": "reconciled", "ref": "<code>" }` (cùng HMAC `x-sdwork-signature`). SDFish set `payments.reconciled_status='reconciled'` cho mã đó (response `ok:false code:'code_not_found'` nếu mã lạ).
- Thiếu `SDWORK_TRACE_URL` → cron no-op (SDFish vẫn ghi mã local, chỉ chưa bắn).
- `/api/auth/sso` (verify CRM) **LEGACY** — login không còn gọi, retire sau.

## 6. Cấu hình (.env SDFish)

```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...            # admin client: webhook upsert + provision/reset auth user
SDWORK_WEBHOOK_SECRET=...                # HMAC chung 2 chiều (inbound verify + outbound ký)
SDWORK_SYNC_URL=https://<sdwork>/...     # (HẾT DÙNG 2026-07-30 — password-sync outbound đã bỏ)
SDWORK_TRACE_URL=https://<sdwork>/...     # endpoint SDWork nhận MÃ CK trace tiền (§5c); trống = cron trace no-op
CRON_SECRET=...                          # Bearer cho cron /api/cron/trace-payments (+ các cron khác)
```

## 7. Việc phía SDWork (user quản CẢ 2 project — tự cấu hình)

- Cấu hình **trigger/webhook** trên SDWork: khi đơn/KH/thiết bị/vật tư tạo-đổi-xoá → POST `events[]` (HMAC ký) tới `/api/sdwork/webhook`. Customer event đính `password` khởi tạo để provision tài khoản; đặt lại mk thì gửi thêm `resetPassword:true`.
- **Dựng endpoint nhận mk đổi từ SDFish** (đồng bộ 2 chiều, §5b): verify header `x-sdfish-signature` = HMAC-SHA256(raw, `SDWORK_WEBHOOK_SECRET`) → set mk khách bên CRM theo `{phone, password}`. KHÔNG dựng = đăng nhập SDWork giữ mk cũ sau khi KH đổi ở SDFish.
- Tự sinh + giữ **secret** `SDWORK_WEBHOOK_SECRET` (cùng giá trị 2 nơi) + retry (webhook lẻ dễ rớt → cron đối soát dự phòng Đợt 2).
- KHÔNG sửa schema CRM từ SDFish.
- **Field map chi tiết** (cột SDWork → payload key, outbox, backfill, dữ liệu bẩn): [sdwork-field-map.md](sdwork-field-map.md).
- **Spec outbox/trigger phía SDWork** (khi nào bắn, retry, chống echo-loop, checklist dựng): [sdwork-outbox-spec.md](sdwork-outbox-spec.md).

## 8. Còn lại (Đợt 2+)

- 🔴 **Outbox + trigger phía SDWork** (đơn/KH mới → tự bắn webhook) — mảnh còn thiếu duy nhất để "đơn mới tạo user SDFish" chạy. Artifact dán-là-chạy: [go-live/sdwork-outbox.sql](go-live/sdwork-outbox.sql) + [go-live/sdwork-outbox-worker.ts](go-live/sdwork-outbox-worker.ts) (go-live README Bước 4).
- Cron đối soát backfill + đẩy lại mk lỗi · retire đọc-live SDWork (gateway `forfish-gateway` + `/api/auth/sso`).
- ✅ Đã xong (2026-06-30): apply migration `0002`+`0003`+`0004` prod · Edge Function CRM `sdfish-password-in` + RPC CRM · bulk provision 630 account · verify 2 chiều end-to-end.
- ✅ Đã xong (code+test, 2026-06-19): reset mk inbound (`resetPassword`) · đẩy mk outbound (`/api/sdwork/password-sync`) · RPC `auth_user_id_by_phone` (`0003`) · fix `must_change_password` ở `user_metadata`.

---

**Last updated**: 2026-07-21 (bỏ ép đổi mk lần đầu; provision mặc định sd123456 cho event không kèm password — đồng bộ định kỳ tự lành khách thiếu tài khoản)
