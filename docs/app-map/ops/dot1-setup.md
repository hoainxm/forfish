# Ops — Hướng dẫn THỦ CÔNG bật Đợt 1 (đăng nhập OTP + DB khách hàng)

> Các bước phải làm NGOÀI code (Supabase dashboard, Vercel, đội SDWork, nhà cung cấp OTP) để Đợt 1 chạy thật. Làm theo THỨ TỰ. Mỗi bước có cách kiểm chứng.
> Project SDFish: **`znzgugvfhgmiszqgjulk`** · Repo đã có sẵn code (commit `6ef2e33`).

**Load khi**: triển khai/đi vận hành đăng nhập OTP + webhook khách hàng.

---

## Bước 1 — Apply migration `0002` lên Supabase 🔴

Tạo bảng `customers/devices/supplies/support_requests/otp_codes` + RLS. **Chỉ làm khi đã review** (CLAUDE.md: không tự apply).

### Cách A — Dashboard (đơn giản, khuyến nghị)
1. Mở https://supabase.com/dashboard → chọn project **`znzgugvfhgmiszqgjulk`**.
2. Menu trái → **SQL Editor** → **New query**.
3. Mở file `supabase/migrations/0002_customers.sql` trong repo, **copy toàn bộ** → dán vào editor.
4. Bấm **Run** (Ctrl/Cmd+Enter). Báo "Success" là xong.

### Cách B — Supabase CLI (nếu quen dòng lệnh)
```bash
npm i -g supabase
supabase link --project-ref znzgugvfhgmiszqgjulk   # nhập DB password (Dashboard → Settings → Database)
supabase db push
```

### Kiểm chứng
- SQL Editor chạy: `select tablename from pg_tables where schemaname='public' and tablename in ('customers','devices','supplies','support_requests','otp_codes');` → đủ 5 dòng.
- `select proname from pg_proc where proname='current_phone';` → 1 dòng.

> ⚠️ Migration đã apply là BẤT BIẾN — sửa = viết migration `0003` mới, KHÔNG sửa `0002`.

---

## Bước 2 — Bật Email provider trong Supabase Auth (cho luồng OTP)

OTP verify dùng `generateLink` kiểu **magiclink** → cần Email provider BẬT (app KHÔNG gửi email thật, chỉ tạo token).

1. Dashboard → **Authentication** → **Providers** → **Email**: để **Enabled**.
2. **Authentication → Providers → Email**: tắt "Confirm email" KHÔNG bắt buộc (admin tạo user đã `email_confirm:true`). Để mặc định cũng được.
3. Không cần cấu hình SMTP (app không gửi mail — token đăng nhập sinh server-side).

### Kiểm chứng: làm sau ở Bước 5 (test đăng nhập OTP).

---

## Bước 3 — Set biến môi trường (local + Vercel)

Lấy **service_role key**: Dashboard → **Project Settings → API** → mục **service_role** (secret) → copy.

### Local (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...        # Settings → API → anon/publishable
SUPABASE_SERVICE_ROLE_KEY=eyJ...                        # service_role — TUYỆT MẬT, chỉ server
SDWORK_WEBHOOK_SECRET=<chuỗi-ngẫu-nhiên-dài>            # tự sinh, chia sẻ cho đội SDWork
OTP_PEPPER=<chuỗi-ngẫu-nhiên>                           # muối hash OTP (tuỳ chọn)
OTP_PROVIDER=                                           # để TRỐNG lúc dev (stub log mã)
```
Sinh secret ngẫu nhiên: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Vercel (production)
Dashboard Vercel → Project → **Settings → Environment Variables** → thêm CÙNG tập biến trên.
- `SUPABASE_SERVICE_ROLE_KEY`, `SDWORK_WEBHOOK_SECRET`, `OTP_PEPPER`: **KHÔNG** tích "Expose to browser" (server-only).
- Sau khi thêm → **Redeploy** để env có hiệu lực.

> ⚠️ TUYỆT ĐỐI không commit `.env.local` / không dán service_role vào client/chat công khai.

---

## Bước 4 — Phối hợp đội SDWork dựng webhook

Đội SDWork cấu hình hệ của họ: khi **đơn / KH / thiết bị / vật tư** tạo-đổi-xoá → POST sang SDFish.

### Thông tin gửi đội SDWork
- **URL**: `https://<domain-sdfish>/api/sdwork/webhook` (vd `https://sdfish.vercel.app/api/sdwork/webhook`).
- **Method**: POST · **Content-Type**: `application/json`.
- **Header chữ ký**: `x-sdwork-signature: <hex>` với `<hex> = HMAC_SHA256(raw_body, SDWORK_WEBHOOK_SECRET)`.
- **Secret**: `SDWORK_WEBHOOK_SECRET` (gửi đội SDWork qua kênh an toàn, KHÔNG email thường).
- **Body** (xem `docs/integration/sdwork-sso-contract.md` §3):
```jsonc
{ "events": [
  { "entity":"customer","action":"upsert","ref":"<id SDWork>","data":{"phone":"0901234567","name":"Nguyễn Văn A"} },
  { "entity":"device","action":"upsert","ref":"<id>","data":{"customerPhone":"0901234567","name":"Anten SF-50","serial":"SF50-001","warrantyUntil":"2028-06-01","orderCode":"DH-1"} }
]}
```
- `ref` bắt buộc (idempotent). `action`: `upsert` | `delete`.

### Kiểm chứng (tự test trước, KHÔNG cần đội SDWork)
Chạy ở máy có `SDWORK_WEBHOOK_SECRET` (đổi URL cho đúng):
```bash
node -e "
const c=require('crypto');
const body=JSON.stringify({events:[{entity:'customer',action:'upsert',ref:'test-1',data:{phone:'0901234567',name:'KH Test'}},{entity:'device',action:'upsert',ref:'dev-1',data:{customerPhone:'0901234567',name:'Anten SF-50',serial:'SF50-001',warrantyUntil:'2028-06-01'}}]});
const sig=c.createHmac('sha256',process.env.SDWORK_WEBHOOK_SECRET).update(body).digest('hex');
console.log('BODY='+body); console.log('SIG='+sig);
"
```
Lấy BODY + SIG ở trên rồi:
```bash
curl -X POST https://<domain>/api/sdwork/webhook \
  -H "Content-Type: application/json" \
  -H "x-sdwork-signature: <SIG>" \
  --data '<BODY>'
```
- `{"ok":true,"applied":2}` → thành công. Vào Dashboard → Table Editor → `customers`/`devices` thấy hàng test.
- `401 bad_signature` → sai secret/sig. `503 not_configured` → chưa set `SDWORK_WEBHOOK_SECRET`.
- Dọn test: xoá hàng `ref` bắt đầu `test-`/`dev-` trong Table Editor.

---

## Bước 5 — Cắm nhà cung cấp OTP (Zalo ZNS hoặc SMS)

Hiện `OTP_PROVIDER` trống = **stub** (dev log mã ra console, prod KHÔNG gửi). Để gửi mã thật:

### 5a. Đăng ký (ngoài code)
- **Zalo ZNS** (khuyến nghị VN): tạo Zalo Official Account → đăng ký ZNS → tạo **template OTP** (duyệt 1–2 ngày) → lấy `access_token`/`app_id`/`template_id`.
- **HOẶC SMS brandname** (eSMS/SpeedSMS/FPT): đăng ký brandname → lấy API key.

### 5b. Cắm vào code (`src/lib/otp/provider.ts`)
Thêm 1 provider theo interface có sẵn rồi bật bằng env. Ví dụ ZNS:
```ts
const zaloZns: OtpProvider = {
  async send(phone, code) {
    const r = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: process.env.ZALO_ACCESS_TOKEN! },
      body: JSON.stringify({
        phone: phone.replace(/^0/, "84"),          // ZNS cần 84xxxxxxxxx
        template_id: process.env.ZALO_TEMPLATE_ID!,
        template_data: { otp: code },
      }),
    });
    if (!r.ok) throw new Error("zns_failed");
  },
};
// trong getOtpProvider(): case "zalo": return zaloZns;
```
Rồi set env: `OTP_PROVIDER=zalo`, `ZALO_ACCESS_TOKEN=...`, `ZALO_TEMPLATE_ID=...` (Vercel + local). Redeploy.

### Kiểm chứng đăng nhập OTP (sau Bước 1–3)
- **Local (stub)**: `npm run dev` → mở `/login` → nhập SĐT → "Gửi mã" → mã hiện ở **console terminal** (`[otp:stub] 0901... → 123456`) → nhập mã → vào `/`.
- **Prod (provider thật)**: nhập SĐT thật → nhận mã qua Zalo/SMS → vào.
- Đăng nhập xong, nếu SĐT đó đã có trong `customers`/`devices` (Bước 4) → vào tab Tàu thấy thiết bị/bảo hành của mình (RLS chỉ thấy của mình).

---

## Bước 6 — Kiểm RLS (đúng người thấy đúng đồ)

Dashboard → SQL Editor (chạy với vai authenticated giả lập khó; kiểm nhanh bằng app):
- Đăng nhập 2 SĐT khác nhau (2 trình duyệt) → mỗi người chỉ thấy `devices` của SĐT mình.
- Hoặc Table Editor xem `devices.customer_phone` khớp `customers.phone`.

---

## Thứ tự tối thiểu để CHẠY ĐƯỢC
1. Bước 1 (migration) → 2 (email provider) → 3 (env) → test đăng nhập OTP stub (Bước 5 local).
2. Bước 4 (webhook, tự test curl) → bật với đội SDWork khi sẵn sàng.
3. Bước 5 (provider thật) khi có hợp đồng Zalo/SMS.

## Khi nào AN TOÀN bỏ luồng cũ (Đợt 2)
Sau khi webhook chạy ổn + dữ liệu KH về đủ → mới retire `/api/auth/sso` + gateway đọc-live SDWork (báo lại để xoá code).

---

**Last updated**: 2026-06-16
