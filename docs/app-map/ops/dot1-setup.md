# Ops — Hướng dẫn THỦ CÔNG bật Đợt 1 (đăng nhập SĐT+mật khẩu + DB khách hàng)

**Load khi**: triển khai/vận hành đăng nhập tài khoản + webhook khách hàng.

> Các bước NGOÀI code (Supabase dashboard, Vercel, cấu hình webhook ở SDWork) để Đợt 1 chạy thật. Làm theo THỨ TỰ; mỗi bước có cách kiểm chứng. Bác **quản cả 2 project** nên tự làm cả 2 đầu.
> Project SDFish: **`znzgugvfhgmiszqgjulk`**. Đăng nhập = **SĐT + MẬT KHẨU**, KHÔNG email/OTP. Tài khoản do **webhook SDWork provision** (đẩy kèm mật khẩu).

---

## Bước 1 — Apply migration `0002` lên Supabase 🔴

Tạo bảng `customers/devices/supplies/support_requests` + RLS. Chỉ làm khi đã review.

### Cách A — Dashboard (khuyến nghị)
1. https://supabase.com/dashboard → project **`znzgugvfhgmiszqgjulk`** → **SQL Editor** → **New query**.
2. Mở `supabase/migrations/0002_customers.sql`, copy toàn bộ → dán → **Run** → "Success".

### Cách B — CLI
```bash
npm i -g supabase
supabase link --project-ref znzgugvfhgmiszqgjulk
supabase db push
```

### Kiểm chứng (SQL Editor)
```sql
select tablename from pg_tables where schemaname='public'
  and tablename in ('customers','devices','supplies','support_requests');   -- đủ 4
select proname from pg_proc where proname='current_phone';                  -- 1 dòng
```
> Migration đã apply là BẤT BIẾN — sửa = viết `0003` mới.

---

## Bước 2 — Bật Email provider (cho đăng nhập email+mật khẩu)

`signInWithPassword` dùng email ảo `{SĐT}@sdvico.local` → cần provider **Email** bật (app KHÔNG gửi mail, KHÔNG OTP).
1. Dashboard → **Authentication → Providers → Email** = **Enabled**.
2. **Confirm email**: KHÔNG cần (webhook tạo user `email_confirm:true`). Không cần SMTP.

---

## Bước 3 — Set biến môi trường (local + Vercel)

Lấy **service_role key**: Dashboard → **Project Settings → API → service_role** (secret).

### Local (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                # TUYỆT MẬT, chỉ server
SDWORK_WEBHOOK_SECRET=<chuỗi-ngẫu-nhiên-dài>    # chia sẻ cho cấu hình webhook SDWork
```
Sinh secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Vercel (production)
Settings → Environment Variables → thêm CÙNG tập biến. `SUPABASE_SERVICE_ROLE_KEY` + `SDWORK_WEBHOOK_SECRET` KHÔNG "Expose to browser". → **Redeploy**.

> ⚠️ Không commit `.env.local`; không dán service_role/secret công khai.

---

## Bước 4 — Cấu hình webhook trên SDWork (bác tự làm phía SDWork)

Khi **đơn / KH / thiết bị / vật tư** tạo-đổi-xoá ở SDWork → POST sang SDFish.

- **URL**: `https://<domain-sdfish>/api/sdwork/webhook`
- **Method** POST · **Content-Type** `application/json`
- **Header**: `x-sdwork-signature: <hex>` = `HMAC_SHA256(raw_body, SDWORK_WEBHOOK_SECRET)`
- **Body** (xem [contract](../../integration/sdwork-sso-contract.md) §3). **Customer kèm `password`** → SDFish tạo tài khoản đăng nhập:
```jsonc
{ "events": [
  { "entity":"customer","action":"upsert","ref":"<id>",
    "data":{ "phone":"0901234567","name":"Nguyễn Văn A","password":"matkhau-sale-bao" } },
  { "entity":"device","action":"upsert","ref":"<id>",
    "data":{ "customerPhone":"0901234567","name":"Anten SF-50","serial":"SF50-001","warrantyUntil":"2028-06-01","orderCode":"DH-1" } }
]}
```
- `password`: mật khẩu khởi tạo sale báo KH (lần đầu app ép đổi). Đã có user → KHÔNG ghi đè.
- `ref` bắt buộc (idempotent). `action`: `upsert` | `delete`.

### Tự test trước (không cần SDWork)
```bash
node -e "
const c=require('crypto');
const body=JSON.stringify({events:[{entity:'customer',action:'upsert',ref:'test-1',data:{phone:'0901234567',name:'KH Test',password:'test1234'}},{entity:'device',action:'upsert',ref:'dev-1',data:{customerPhone:'0901234567',name:'Anten SF-50',serial:'SF50-001',warrantyUntil:'2028-06-01'}}]});
const sig=c.createHmac('sha256',process.env.SDWORK_WEBHOOK_SECRET).update(body).digest('hex');
console.log('BODY='+body); console.log('SIG='+sig);
"
```
```bash
curl -X POST https://<domain>/api/sdwork/webhook \
  -H "Content-Type: application/json" \
  -H "x-sdwork-signature: <SIG>" \
  --data '<BODY>'
```
- `{"ok":true,"applied":2}` → Table Editor thấy `customers`/`devices`; Authentication → Users thấy `0901234567@sdvico.local`.
- `401 bad_signature` → sai secret/sig. `503 not_configured` → thiếu `SDWORK_WEBHOOK_SECRET`.
- Dọn test: xoá hàng `ref` `test-*`/`dev-*` + user test trong Authentication.

---

## Bước 5 — Test đăng nhập SĐT + mật khẩu

Sau khi webhook test (Bước 4) tạo KH `0901234567` mật khẩu `test1234`:
1. `npm run dev` (hoặc prod) → mở `/login`.
2. Nhập SĐT `0901234567` + mật khẩu `test1234` → **Đăng nhập**.
3. Lần đầu (`must_change_password`) → app chuyển `/doi-mat-khau`. Đổi xong vào `/`.
4. Vào tab **Tàu** → thấy thiết bị "Anten SF-50" + bảo hành (RLS chỉ thấy của SĐT mình).
- Sai mk → "Sai số điện thoại hoặc mật khẩu".

---

## Bước 6 — Kiểm RLS

2 SĐT khác nhau (2 trình duyệt) → mỗi người chỉ thấy `devices` của SĐT mình. Hoặc Table Editor: `devices.customer_phone` khớp `customers.phone`.

---

## Thứ tự tối thiểu chạy được
Bước 1 → 2 → 3 → 4 (tự test curl, tạo KH+mk) → 5 (đăng nhập). Bật webhook SDWork thật khi sẵn sàng.

## Đợt 2 (sau)
Cron đối soát (bắt event rớt) · reset mật khẩu qua webhook (update-by-id) · retire đọc-live SDWork (`/api/auth/sso` + gateway `forfish-gateway`).

---

**Last updated**: 2026-06-16
