# Go-live — đồng bộ mật khẩu 2 chiều SDWork ↔ SDFish

> Hướng dẫn bật tính năng "1 mật khẩu đăng nhập cả 2 app" lên thật. Code đã xong
> (branch `feat/sdwork-password-sync`); đây là phần cấu hình hạ tầng (DB + env +
> endpoint SDWork) — KHÔNG tự động hoá được vì đụng prod + project CRM.
>
> Hợp đồng kỹ thuật: [../sdwork-sso-contract.md](../sdwork-sso-contract.md) §5b.

File kèm trong thư mục này:
- `sdfish-migration-combined.sql` — gộp 0002+0003, paste 1 lần vào SDFish DB.
- `sdwork-rpc.sql` — RPC tra user, paste vào CRM DB.
- `sdwork-edge-function.ts` — endpoint CRM nhận mật khẩu đổi từ SDFish.

---

## Thứ tự

```
Bước 1 (SDFish DB)  ─┐
Bước 3 (SDWork)     ─┼─→ Bước 2 (env, điền SDWORK_SYNC_URL từ Bước 3) ─→ Test
                     ┘
```

---

## Bước 1 — Apply migration (SDFish DB `znzgugvfhgmiszqgjulk`)

1. supabase.com/dashboard → project `znzgugvfhgmiszqgjulk` → **SQL Editor → New query**.
2. Paste TOÀN BỘ `sdfish-migration-combined.sql` → **Run**. (Idempotent.)
3. Verify (Run đoạn cuối file) → đủ 4 bảng `customers/devices/supplies/support_requests` + 2 function `current_phone/auth_user_id_by_phone`.

## Bước 2 — Env

`SDWORK_WEBHOOK_SECRET`: sinh 1 lần `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — dùng GIỐNG HỆT ở SDFish + SDWork.

Khóa Supabase: Dashboard `znzgugvfhgmiszqgjulk` → Settings → API → `anon public` + `service_role secret`.

**`.env.local`** (local — `npm run dev` đọc):
```env
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>      # 🔴 tối mật, server-only
SDWORK_WEBHOOK_SECRET=<hex 32>
SDWORK_SYNC_URL=<URL Bước 3 — trống = tắt đẩy ngược>
```

**Vercel** (bản thật — Settings → Environment Variables, cùng 5 biến, Production, rồi Redeploy). *Skip nếu chưa có quyền — chỉ ảnh hưởng bản deploy, local vẫn chạy.*

## Bước 3 — Endpoint SDWork (CRM `exueouggmbjtjvsvpfya`)

```bash
npm install -g supabase
supabase login                                  # gõ "! supabase login" trong phiên để login tương tác
# trong repo CRM SDWork:
supabase functions new sdfish-password-in       # rồi dán nội dung sdwork-edge-function.ts vào
supabase functions deploy sdfish-password-in --project-ref exueouggmbjtjvsvpfya
supabase secrets set SDWORK_WEBHOOK_SECRET=<hex 32 Bước 2> --project-ref exueouggmbjtjvsvpfya
```
CRM SQL Editor → paste `sdwork-rpc.sql` → Run.
URL → `SDWORK_SYNC_URL` = `https://exueouggmbjtjvsvpfya.functions.supabase.co/sdfish-password-in`

---

## Test (local, Git Bash)

**Inbound — provision tài khoản:**
```bash
SECRET='<hex trong .env.local>'
BODY='{"events":[{"entity":"customer","action":"upsert","ref":"test-c1","data":{"phone":"0901234567","name":"Khach Test","password":"matkhau123"}}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -s -X POST http://localhost:3000/api/sdwork/webhook \
  -H "content-type: application/json" -H "x-sdwork-signature: $SIG" -d "$BODY"
# → {"ok":true,"applied":1,"results":[{...,"ok":true,"provisioned":true}]}
```

**Inbound — reset mật khẩu** (đặt lại mk khách hiện hữu): thêm `"resetPassword":true` vào `data`, đổi `password` → đăng nhập mk mới được.

**Đăng nhập:** `localhost:3000/login` → `0901234567` / `matkhau123` → ép `/doi-mat-khau` → đổi → vào app; đăng nhập lại KHÔNG bị ép đổi nữa.

**Outbound** (cần Bước 3 + `SDWORK_SYNC_URL`): sau khi đổi mk ở SDFish → đăng nhập SDWork bằng mk mới.

**Endpoint SDWork riêng:**
```bash
SECRET='<hex>'; BODY='{"phone":"0901234567","password":"test123456"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -s -X POST https://exueouggmbjtjvsvpfya.functions.supabase.co/sdfish-password-in \
  -H "content-type: application/json" -H "x-sdfish-signature: $SIG" -d "$BODY"
# → {"ok":true}  (bad_signature = secret lệch; user_not_found = endpoint OK, SĐT test không có)
```

---

## Lưu ý

- 🔴 Inbound thật từ SDWork cần SDFish có URL public (Vercel) — `localhost` SDWork cloud không gọi tới. Chưa deploy thì test inbound bằng curl local như trên.
- 🔐 Mật khẩu đi plaintext trên kênh HMAC+TLS (đối xứng 2 chiều). KHÔNG log password 2 đầu. Secret lộ → rotate cả 2 nơi.
- Nếu CRM lưu khách KHÔNG ở `auth.users` → sửa `sdwork-edge-function.ts` đoạn đặt mật khẩu cho đúng schema CRM.
