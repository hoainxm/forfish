# SSO ForFish ↔ SDWork — Supabase ↔ Supabase trực tiếp

> **Cập nhật 2026-06-10**: SDWork CRM (project `exueouggmbjtjvsvpfya`) lưu khách
> dưới dạng email ảo `{SĐT}@sdvico.local` ngay trên Supabase Auth (688/689
> user). ForFish dùng đúng pattern đó → **không cần SDWork build endpoint
> custom**; ForFish verify mật khẩu khách bằng `signInWithPassword` thẳng vào
> CRM Supabase, OK thì cấp session phía ForFish.

## 1. Luồng

```
[bà con]
   │ SĐT + mật khẩu (SDWork)
   ▼
[ForFish /login] ──POST /api/auth/sso──► [ForFish server]
                                              │ supabase.auth.signInWithPassword(
                                              │   { email: "{sdt}@sdvico.local", password }
                                              │ )  ── client trỏ vào CRM SDViCo
                                              ▼
                                       [CRM Supabase Auth] → user.id + metadata
                                              ▼
                                       [ForFish admin]
                                              │ tạo/tìm user ForFish cùng email,
                                              │ upsert profiles.sdwork_customer_ref,
                                              │ generateLink(magiclink)
                                              ▼
                                       [ForFish client]
                                              │ window.location = actionLink
                                              ▼
                                       [Supabase ForFish set session → / ]
```

ForFish **không bao giờ lưu mật khẩu SDWork**. Toàn bộ xác thực do CRM quyết.

## 2. Chuẩn hóa SĐT

CRM lưu mostly đầu `0` (514 user), một số ít đầu `84` (5 user). ForFish thử
`0xxxxxxxxx` trước, fail thì thử `84xxxxxxxxx` — gói trong `verifyWithSdwork`
(`src/lib/sso-sdwork.ts`).

User chỉ gõ SĐT bất kỳ định dạng: `0901234567` / `+84 901 234 567` / `84901234567`
— ForFish chuẩn hóa.

## 3. Map user 2 bên

| Phía CRM SDViCo | Phía ForFish |
|---|---|
| `auth.users.id` (UUID) | `profiles.sdwork_customer_ref` |
| `auth.users.email = "{sdt}@sdvico.local"` | `auth.users.email = "{sdt}@sdvico.local"` (cùng email — 2 project độc lập, không conflict) |
| `auth.users.user_metadata.full_name` | `profiles.full_name` |

Lần đầu khách đăng nhập ForFish:
1. Tạo user ForFish qua admin API (`email_confirm:true`, password = random UUID
   không dùng tới).
2. Upsert `profiles` với `sdwork_customer_ref = CRM user.id`.

## 4. Cấu hình (.env)

```env
# ForFish project (đã có)
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# SERVER ONLY — để /api/auth/sso tạo user + magic-link
SUPABASE_SERVICE_ROLE_KEY=...

# CRM SDViCo — để verify mật khẩu khách (anon key đủ, signInWithPassword)
SDWORK_SUPABASE_URL=https://exueouggmbjtjvsvpfya.supabase.co
SDWORK_SUPABASE_ANON_KEY=sb_publishable_...
```

Khi 2 biến `SDWORK_*` trống → `/api/auth/sso` trả 503, `/login` fallback sang
`signInWithPassword` nội bộ ForFish (đăng ký `/dang-ky` cho khách không phải
SDWork).

## 5. Bảo mật

- ForFish dùng **anon key** của CRM (không phải service-role) để verify — chỉ
  được phép gọi `signInWithPassword`, không đụng bảng nào khác. Đây cùng cấp
  quyền với app SDWork chính.
- Sau khi verify xong, ForFish gọi `auth.signOut()` để không giữ token CRM
  trên server.
- `SUPABASE_SERVICE_ROLE_KEY` (của ForFish, không phải CRM) chỉ dùng trong
  route handler `/api/auth/sso` để tạo user + magic-link, không bao giờ rò ra
  client.
- Đăng xuất phía ForFish chỉ huỷ session ForFish, không huỷ phiên SDWork.

## 6. Rủi ro & xử lý

- **Khách đổi mật khẩu SDWork** → ForFish vẫn dùng được (mật khẩu Forfish
  local đã set random, không liên quan; lần đăng nhập sau verify lại với
  CRM, OK là tiếp tục dùng session ForFish cũ hoặc mới).
- **SDWork khóa khách** → CRM trả invalid_credentials → ForFish login fail
  (đúng). Nhưng session ForFish hiện tại của khách KHÔNG bị khóa ngay —
  chỉ hết khi cookie expire. Sửa sau: webhook CRM → ForFish.
- **SĐT trùng + suffix `_timestamp`** (kiểu `0707252627_1757904849852@sdvico.local`):
  ForFish hiện chỉ thử dạng chuẩn `0xxxxxxxxx@sdvico.local`. Khách có suffix
  sẽ verify fail → cần CRM gửi reset/merge nếu là duplicate. Hiếm.

## 7. Test bằng tay (sau khi set env)

```sh
curl -X POST https://forfish.vercel.app/api/auth/sso \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0901234567","password":"<sdwork-pw>"}'
```

- 200 + `actionLink` → mở bằng trình duyệt, sẽ về `/` đã đăng nhập ForFish.
- 401 → sai mật khẩu (CRM từ chối).
- 503 → chưa cấu hình env hoặc CRM down.

## 8. Mở rộng (sau)

- **Webhook CRM → ForFish**: khi khách bị khóa / sản phẩm bảo hành cập nhật,
  CRM POST `/api/sdwork/webhook` (HMAC SHA-256 shared secret) — ForFish kích
  hoạt khóa session / sync `boat_products`.
- **Đồng bộ sản phẩm**: hôm nay `boat_products` là localStorage. Khi có
  webhook + scoped read trên CRM, kéo `orders/order_items` của khách → tự
  điền tab "Sản phẩm" cho từng tàu.

(Cả 2 mở rộng chưa làm trong commit này.)
