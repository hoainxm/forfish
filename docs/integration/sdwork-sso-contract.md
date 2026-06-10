# SSO ForFish ↔ SDWork — Hợp đồng API

> **Mục đích**: ForFish KHÔNG copy/seed user. Khách dùng đúng SĐT + mật khẩu
> bên SDWork để đăng nhập ForFish. Hai bên giao tiếp qua **một endpoint xác thực
> ở SDWork**. ForFish phía Supabase chỉ giữ "user ảo" để có session + RLS, KHÔNG
> lưu mật khẩu SDWork.
>
> **Last updated**: 2026-06-10

## 1. Tổng quan luồng

```
[bà con]
   │ SĐT + mật khẩu (SDWork)
   ▼
[ForFish /login] ──POST /api/auth/sso──► [ForFish server]
                                              │ POST {phone,password}
                                              ▼
                                       [SDWork verify endpoint]
                                              │ {ok, sdworkCustomerId, fullName}
                                              ▼
                                       [ForFish server]
                                              │ tạo user Supabase (lần đầu),
                                              │ upsert profiles.sdwork_customer_ref,
                                              │ sinh magic-link
                                              ▼
                                       [ForFish client]
                                              │ window.location = actionLink
                                              ▼
                                       [Supabase set session → / ]
```

ForFish KHÔNG biết mật khẩu SDWork. Mọi xác thực do SDWork quyết.

## 2. Endpoint SDWork CẦN làm

### POST `/auth/verify-fisherman` (tên ví dụ; URL chính xác do SDWork chốt)

**Headers**
- `Content-Type: application/json`
- `X-Api-Key: <shared-secret>` — bí mật chia sẻ với ForFish, set ở env `SDWORK_VERIFY_KEY`. Đề nghị rotate được; chỉ dùng cho server-to-server.

**Body**
```json
{ "phone": "84901234567", "password": "<plain>" }
```
- `phone` đã chuẩn hóa về **`84` + 9-10 chữ số** (ForFish lo bước này).
- `password` plain text qua HTTPS (như mọi flow form login chuẩn). Yêu cầu HTTPS + cert hợp lệ ở SDWork.

**Response 200 OK — đúng**
```json
{
  "ok": true,
  "sdworkCustomerId": "CUS-000123",
  "fullName": "Nguyễn Văn A",
  "phone": "84901234567"
}
```

**Response 401 — sai SĐT/mật khẩu**
```json
{ "ok": false }
```

**Response 404 — SĐT không phải khách SDWork** (ForFish sẽ fallback sang đăng ký nội bộ)
```json
{ "ok": false, "code": "not_a_customer" }
```

**Response 5xx / timeout** — ForFish coi là service_unavailable.

**Latency**: ForFish timeout **7 giây**. Khuyến nghị < 1s p95.

## 3. Phía ForFish làm gì sau khi SDWork OK

1. Tìm user Supabase theo email ảo `{phone}@phone.forfish.app`.
2. Lần đầu → admin tạo user (`email_confirm: true`), `user_metadata.sdwork_customer_id`.
3. Upsert bảng `profiles`:
   - `phone = phone`
   - `sdwork_customer_ref = sdworkCustomerId`
   - `full_name = fullName`
   - `must_change_password = false`
4. `admin.generateLink({ type: 'magiclink', email })` → trả `actionLink` cho client.
5. Client redirect tới `actionLink` → Supabase set cookie session → về `/`.

ForFish KHÔNG bao giờ lưu mật khẩu SDWork.

## 4. Bảo mật

- Endpoint xác thực dùng **API key chia sẻ** + HTTPS. Tuyệt đối không gọi từ trình duyệt.
- Server ForFish dùng **`SUPABASE_SERVICE_ROLE_KEY`** chỉ trong route handler `src/app/api/auth/sso/route.ts`, không bao giờ rò ra client.
- Rate limit ở SDWork (đề nghị 5 lần/phút mỗi SĐT/IP). ForFish chưa rate-limit phía mình — sẽ bổ sung khi gọi rộng.
- Đăng xuất phía ForFish chỉ huỷ session Supabase (không huỷ phiên SDWork).

## 5. Mã liên kết & xóa khách

- Khóa link 2 bên = **`profiles.sdwork_customer_ref`** trong DB ForFish.
- Khi SDWork khóa/xóa khách: ForFish KHÔNG tự biết. Cần kèm hook ngược (xem mục mở rộng).

## 6. (Tương lai) Webhook SDWork → ForFish

Khi cần đồng bộ sản phẩm bảo hành / khóa khách:
- `POST /api/sdwork/webhook` với `X-Sdwork-Signature` (HMAC SHA-256, chung secret).
- Event types: `customer.disabled`, `product.warranty_updated`.

Đây là mở rộng đợt 2 — chưa làm trong commit này.

## 7. Phía ForFish — cấu hình

`.env`:
```
SUPABASE_SERVICE_ROLE_KEY=...
SDWORK_VERIFY_URL=https://api.sdwork.example.com/v1/auth/verify-fisherman
SDWORK_VERIFY_KEY=<shared-secret>
```

Khi 2 biến SDWORK_* trống → `/api/auth/sso` trả 503, /login tự fallback sang
xác thực nội bộ ForFish (`signInWithPassword` qua email ảo) — đăng ký ở `/dang-ky`.

## 8. Test bằng tay

```sh
curl -X POST https://forfish.vercel.app/api/auth/sso \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0901234567","password":"<sdwork-pw>"}'
```
- 200 + `actionLink` → mở bằng trình duyệt: nên về `/` đã đăng nhập.
- 401/404/503 → đúng các trường hợp lỗi ở mục 2.
