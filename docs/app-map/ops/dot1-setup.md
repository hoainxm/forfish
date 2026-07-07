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

---

## Bước 7 — Bật kho dữ liệu Ra khơi (migration 0005 + CRON_SECRET) 🔴

> Yêu cầu Long 2026-07-02: lưu dữ liệu tab Ra khơi để predict. Code đã xong ([04 mục 4b](../04-data-model.md)) — 3 thao tác dưới đây là bật cho chạy thật.

### 7a. Apply migration 0005

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → project **znzgugvfhgmiszqgjulk** → **SQL Editor** → **New query**.
2. Dán TOÀN BỘ nội dung [`supabase/migrations/0005_sea_history.sql`](../../../supabase/migrations/0005_sea_history.sql) → **Run**.
3. Kiểm chứng: **Table Editor** thấy 3 bảng mới `sea_daily`, `fish_forecast_daily`, `storm_events` (đều RLS enabled, 0 policy — đúng chủ ý: chỉ service-role đọc/ghi).

### 7b. Set `CRON_SECRET` trên Vercel

1. Lấy giá trị: mở `.env.local` local, copy dòng `CRON_SECRET=...` (đã sinh sẵn 2026-07-02; muốn giá trị khác thì tự sinh chuỗi ngẫu nhiên ≥32 ký tự — Vercel Cron chỉ cần khớp env).
2. Vercel dashboard → project **forfish** → **Settings → Environment Variables** → Add: name `CRON_SECRET`, value vừa copy, environment **Production** (thêm Preview nếu muốn test trên preview deploy).
3. **Deploy lại** (env mới chỉ ăn vào build mới). Sau deploy, tab **Settings → Cron Jobs** phải thấy `/api/collect/sea-daily — 30 23 * * *` (23:30 UTC = 6:30 sáng VN).

### 7c. Kiểm chứng chạy thật

```bash
# chạy tay 1 lần (thay YOUR_SECRET):
curl -H "Authorization: Bearer YOUR_SECRET" https://forfish-alpha.vercel.app/api/collect/sea-daily
# kỳ vọng: {"ok":true,...,"parts":{"sea":{"ok":true,"rows":100},...}}  (100 = 10 cảng × 10 ngày)
```
- Không kèm Bearer → phải 401.
- SQL Editor: `select count(*) from sea_daily where collected_on = current_date;` → 100.
- Sáng hôm sau kiểm lại — cron tự chạy, không ai bấm gì. Test case chi tiết: sheet **RKDB** trong bộ Excel.

---

## Bước 8 — Nghiệm thu luồng KH mới SDWork → SDFish (test bằng KH thật)

> Luồng Long chốt 2026-07-02: KH mới trong SDWork (kèm cước, thiết bị, dịch vụ) → có acc SDFish → thấy lịch sử mua + thời điểm mua. Đã pass bằng webhook mô phỏng 2026-07-02 (acc demo `0900000777`/`sd123456`, ref `TEST-E2E-*`) — bước này là nghiệm thu CHÉO bằng SDWork thật.

**Phía SDWork (bác thao tác):**
1. Tạo 1 KH test với SĐT CHƯA từng dùng (vd SĐT phụ của bác) — nhớ bật gửi webhook sang SDFish.
2. Gắn cho KH đó: ≥1 **thiết bị** (có serial, ngày mua, hạn bảo hành) + ≥1 **cước/dịch vụ** + mật khẩu khởi tạo.
3. Ghi lại giờ tạo (đối chiếu log).

**Phía SDFish (kiểm chứng — theo đúng 4 ý Long):**
| # | Kiểm | Kỳ vọng |
|---|---|---|
| 1 | Webhook về | Vercel → Logs → `/api/sdwork/webhook` có POST 200, response `applied` = số event, customer `provisioned:true` |
| 2 | Có acc đăng nhập | App → Đăng nhập bằng SĐT test + mật khẩu khởi tạo → vào được, bị ép đổi mật khẩu lần đầu (đúng thiết kế) |
| 3 | Thấy lịch sử mua | Tab **Tàu → Sản phẩm**: đúng thiết bị, **ngày mua**, hạn bảo hành; tab **Dịch vụ**: đúng cước/dịch vụ |
| 4 | Không lộ chéo | Đăng nhập acc KHÁC → không thấy hàng của KH test (RLS) |

Fail ở đâu báo ở đó: (1) fail = webhook config/secret; (2) fail = provision (xem `provisioned:false` trong response); (3) fail = mapping payload (đối chiếu hợp đồng §4 ở Bước 4); (4) fail = RLS — dừng, báo ngay.

**Dọn data test mô phỏng** (khi không cần acc demo nữa): gửi webhook events `action:"delete"` với ref `TEST-E2E-CUST-1`, `TEST-E2E-DEV-1/2`, `TEST-E2E-SUP-1/2`; auth user `0900000777` xoá tay trong Supabase → Authentication.

## Đợt 2 (sau)
Cron đối soát (bắt event rớt) · reset mật khẩu qua webhook (update-by-id) · retire đọc-live SDWork (`/api/auth/sso` + gateway `forfish-gateway`).

---

**Last updated**: 2026-07-02
