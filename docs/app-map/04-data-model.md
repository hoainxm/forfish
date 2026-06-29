# 04 — Data model: schema, RLS, logic giấy tờ

> **Mục đích / Purpose**: Nguồn canonical về database (Supabase) và domain logic Trục 4 (tủ giấy tờ + trạng thái hạn).

**Load khi / Load when**: đụng DB/migration/RLS, sửa `src/lib/documents.ts`, nối vault với Supabase, hoặc thêm bảng mới.

covers: supabase/migrations, src/lib/documents.ts, src/lib/owned-assets.ts, src/lib/sdwork-webhook.ts, src/lib/sdwork-outbound.ts, src/lib/phone.ts
last_verified: 2026-06-16
ttl_days: 180

---

## 1. Supabase project

- Project ref: **`znzgugvfhgmiszqgjulk`** · Region: **ap-northeast-2**
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (xem `.env.local.example`)
- Env trống → client trả `null` → **demo mode** (localStorage). Chi tiết: [02-architecture.md](02-architecture.md)
- 🔴 **Pre-flight**: mọi thay đổi schema/RLS phải hỏi user trước, KHÔNG tự apply migration lên remote. Migration đã apply là bất biến — sửa bằng migration mới.

## 2. Tables — migration [`supabase/migrations/0001_init.sql`](../../supabase/migrations/0001_init.sql)

### `public.boats` — tàu của ngư dân
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid → `auth.users` | cascade delete |
| `name` | text not null | tên tàu chủ đặt |
| `registration` | text | số đăng ký, vd "BV-1234-TS" |
| `length_m` | numeric | chiều dài (m) |
| `created_at` | timestamptz | default now() |

### `public.documents` — giấy tờ (Trục 4)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `boat_id` | uuid → `boats` | cascade; index `documents_boat_id_idx` |
| `owner_id` | uuid → `auth.users` | denormalized cho RLS |
| `kind` | text not null | xem DocumentKind dưới |
| `label` | text not null | nhãn hiển thị tiếng Việt |
| `number` | text | số hiệu |
| `issued_on` / `expires_on` | date | `expires_on` null = không hết hạn; index theo `expires_on` |
| `note` | text | |
| `created_at` | timestamptz | |

### RLS — owner-only (cả 2 bảng)
```sql
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id)
```
Invariant: mọi bảng user-data mới đều bật RLS owner-only theo pattern này. KHÔNG bypass RLS từ client.

### Bảng khách hàng SDFish — migration [`0002_customers.sql`](../../supabase/migrations/0002_customers.sql) (Đợt 1, 2026-06-16)

App khách hàng độc lập (tách SDWork): DB RIÊNG giữ KH · thiết bị · vật tư. Dữ liệu do **webhook SDWork nạp** (service-role, bypass RLS); KH chỉ **ĐỌC** hàng của mình.

| Bảng | Cột chính | RLS |
|---|---|---|
| `customers` | `phone` (unique, định danh), `name`, `sdwork_ref` (unique) | SELECT `using (phone = current_phone())` |
| `devices` | `customer_phone`, `name`, `serial`, `model`, `purchased_on`, `warranty_until`, `order_code`, `sdwork_ref` (unique) | SELECT `using (customer_phone = current_phone())` |
| `supplies` | `customer_phone`, `name`, `qty` (numeric, thập phân OK), `unit` (cái/cuộn/kg/m — migration [`0004`](../../supabase/migrations/0004_supplies_unit_column.sql) fix drift prod 2026-06-25), `order_code`, `sdwork_ref` (unique) | SELECT `using (customer_phone = current_phone())` |
| `support_requests` | `owner_id`→auth.users, `phone`, `summary`, `status` | owner-only `for all (auth.uid()=owner_id)` (KH tự tạo) |

- **`current_phone()`** (SQL stable, security definer): `split_part(auth.jwt()->>'email','@','1')` — SĐT từ email ảo `{SĐT}@sdvico.local`.
- Ghi customers/devices/supplies + **provision auth user** (SĐT+mật khẩu) CHỈ qua **admin client** (`src/lib/supabase/admin.ts`, service-role) trong route webhook — KHÔNG cho client ghi.
- Idempotent: upsert theo `sdwork_ref` (`onConflict`).
- 🔴 Migration AUTHOR sẵn, **CHƯA apply prod** — bước duyệt riêng. App degrade gracefully nếu bảng chưa có (`/api/me/sdvico` → `no_link` → UI local).

## 3. Domain logic — `src/lib/documents.ts`

### DocumentKind (giữ sync với cột `kind`)
`dang_kiem` · `giay_phep_khai_thac` · `an_toan_thuc_pham` · `bao_hiem` · `chung_chi_thuyen_truong` · `khac` — label tiếng Việt trong `DOCUMENT_KINDS`.

### Expiry status — `getExpiryStatus(doc, today)`
- **`SOON_DAYS = 30`** — ngưỡng "sắp hết hạn"
- Tính ngày theo **UTC** (`daysUntil`) để tránh lệch timezone
- Levels → màu UI (xem [03-design-system.md](03-design-system.md)):

| Level | Điều kiện | Màu | Label mẫu |
|---|---|---|---|
| `expired` | days < 0 | 🔴 đỏ | "Đã quá hạn N ngày" |
| `soon` | 0 ≤ days ≤ 30 | 🟡 vàng | "Còn N ngày" / "Hết hạn hôm nay" |
| `ok` | days > 30 | 🟢 xanh | "Còn N ngày" |
| `none` | không có `expiresOn` | — | "Không có hạn" |

- `byUrgency(today)` — sort gấp nhất lên đầu (expired trước, rồi gần hạn nhất; không hạn xuống cuối)
- `demoDocuments(today)` — seed demo mode, offset ngày tương đối so với today để luôn có đủ 3 trạng thái

### Camel ↔ snake mapping (khi nối Supabase)
TS dùng camelCase (`expiresOn`), DB dùng snake_case (`expires_on`) — khi wire vault lên Supabase phải map rõ ràng, không đổi shape của `BoatDocument`.

## 4. Demo mode storage

- localStorage key: **`forfish.documents.v1`** (versioned — đổi shape thì bump v2 + migrate/seed lại)
- Corrupt JSON / storage bị chặn → fall back demo seed, không crash

## 5. Việc sắp tới / Implementation status

| # | Item | Status |
|---|---|---|
| 1 | Schema boats + documents + RLS | ✅ Done (`0001_init.sql`) |
| 2 | Vault chạy demo mode (localStorage) | ✅ Done |
| 3 | Đăng nhập SĐT + mật khẩu (không email/OTP) | 🟡 Đợt 1: `/login` + provision qua webhook xong; apply migration + bật webhook sau (§5b) |
| 3b | DB khách hàng riêng + webhook ingest | 🟡 Đợt 1: schema `0002` + webhook route + đọc bảng riêng xong; apply prod + bật webhook sau |
| 4 | Chuyển vault localStorage → Supabase | ❌ Chưa (schema đã sẵn) |
| 5 | Nhắc hạn push / Zalo | ❌ Chưa |

## 5b. Auth OTP riêng + webhook ingest (Đợt 1, 2026-06-16) — THAY mô hình §6

**Quyết định user (2026-06-16)**: SDFish thành **app khách hàng độc lập**, **tách SDWork** — KHÔNG đọc-live CRM lúc KH mở app. **Auth chỉ hướng TÀI KHOẢN: SĐT + MẬT KHẨU, KHÔNG email/OTP** (user quản cả 2 project). Mô hình §6 (gateway đọc-live) **chuyển tiếp**, retire sau.

- **Đăng nhập**: SĐT + mật khẩu — `supabase.auth.signInWithPassword({ email: {SĐT}@sdvico.local, password })` trên project SDFish (`/login`). Lần đầu (`user_metadata.must_change_password=true` do webhook đặt) → ép `/doi-mat-khau`. KHÔNG OTP, KHÔNG email confirm, KHÔNG SSO-CRM. SĐT helper thuần `src/lib/phone.ts` (tách `auth-form.tsx`).
- **Đồng bộ mật khẩu 2 chiều** (1 credential đăng nhập CẢ 2 app — `syncAuthPassword` trong webhook route):
  - **Inbound SDWork→SDFish**: customer event kèm `password`. Chưa có user → `createUser({email_confirm:true, user_metadata:{must_change_password:true}})`. ĐÃ tồn tại + **KHÔNG** `resetPassword` → bỏ qua (không ghi đè mk KH tự đổi). ĐÃ tồn tại + `resetPassword:true` (SDWork chủ động đặt lại) → tra id qua RPC **`auth_user_id_by_phone`** (migration [`0003_auth_password_sync.sql`](../../supabase/migrations/0003_auth_password_sync.sql), security-definer, revoke public) → `updateUserById({password, user_metadata:{must_change_password:true}})`. Mật khẩu KHÔNG lưu `customers` (chỉ trên auth user, Supabase hash). Intent thuần `passwordSyncIntent` (test).
  - **Outbound SDFish→SDWork**: KH đổi mk ở `/doi-mat-khau` → `POST /api/sdwork/password-sync` (SĐT lấy từ **session**, không tin client; HMAC `SDWORK_WEBHOOK_SECRET` → `SDWORK_SYNC_URL`). Best-effort (đổi tại SDFish đã xong; lỗi đẩy ngược không chặn KH). Signer thuần `src/lib/sdwork-outbound.ts` (test). SDWork phải dựng endpoint nhận (hợp đồng §7).
  - **Fix**: `/doi-mat-khau` tắt `must_change_password` trong **`user_metadata`** (qua `updateUser({data})`), KHÔNG phải bảng `profiles` (không tồn tại) — trước đây ghi nhầm nên KH bị ép đổi mỗi lần đăng nhập.
- **Nạp dữ liệu**: `POST /api/sdwork/webhook` — verify **HMAC SHA-256** (header `x-sdwork-signature`, env `SDWORK_WEBHOOK_SECRET`) trên raw body → upsert customers/devices/supplies bằng admin client. Map thuần `src/lib/sdwork-webhook.ts` (`toCustomerRow/toDeviceRow/toSupplyRow`, chuẩn hoá SĐT, idempotent `sdwork_ref`) — có test. Response trả `results[]` per-event (`ref`, `ok`, `code?`, `provisioned?`) + `applied` count → SDWork đối soát chính xác từng event, không câm khi 1 hàng lỗi.
- **Đọc**: `/api/me/sdvico` đọc **bảng SDFish** (RLS theo `current_phone()`) thay `fetchOwnedAssets` gọi CRM. `use-sdvico-assets` giữ interface (4 nấc + `OwnedAssets`).
- **Hợp đồng webhook**: [sdwork-sso-contract.md](../integration/sdwork-sso-contract.md) (event types/payload/HMAC + password).
- **Đồng bộ mật khẩu 2 chiều (Đợt 2, 2026-06-19)**: reset inbound (`resetPassword`) + đẩy outbound (`/api/sdwork/password-sync`) + RPC `0003` — **code+test xong**. Còn lại: apply migration `0002`+`0003` prod 🔴 · cấu hình `SDWORK_SYNC_URL` + endpoint nhận phía SDWork · cron đối soát · retire §6 (gateway live-read + `/api/auth/sso`).

## 6. Đồng bộ đồ mua từ SDWork CRM (Trục 3, 2026-06-10) — ⚠️ ĐANG CHUYỂN TIẾP, thay bởi §5b

Bối cảnh (user chốt): khách mua hàng → SDWork tạo account + đơn + dịch vụ,
nhưng KHÔNG cấp quyền vào SDWork (app nội bộ/CTV/đại lý); tài khoản đó tách
thành tài khoản ForFish. ForFish hiển thị + nhắc: bảo hành, kỳ dịch vụ, cước.

### Chuỗi nối (đọc-chỉ, qua adapter)
```
SĐT đăng nhập ForFish (SSO) → profiles.sdwork_customer_ref (= auth.users.id phía CRM)
  → CRM accounts.owner_user_id (fallback: login_phone/phone = SĐT)  [type customer|sub]
  → warranty_cards (serial, activated_at, expires_at, products.name, orders.code)
  → service_instances (service_name, service_type, status, next_due_date)
  → orders có debt_amount > 0 (code, debt_amount, debt_due_date) — thu cước/công nợ
```

### Cách thực thi (2026-06-10, đổi sang GATEWAY — không cần phát key nào)
- **Edge Function `forfish-gateway` chạy BÊN TRONG project CRM** (`exueouggmbjtjvsvpfya`, deploy qua Supabase MCP): dùng service key TỰ CẤP của CRM (không key bí mật nào rời Supabase). Chỉ phục vụ 3 action: `assets` (lọc nghiêm theo account đúng khách) / `catalog` / `request`. Cổng vào: API key công khai của CRM (anon JWT cũ hoặc `sb_publishable_` mới — `verify_jwt` không nhận định dạng publishable nên function tự kiểm trong code).
- **ForFish gọi gateway** bằng `SDWORK_SUPABASE_URL` + `SDWORK_SUPABASE_ANON_KEY` — đúng 2 env SSO đang dùng sẵn (local + Vercel), KHÔNG cần thêm env nào.
- **Types trung lập vendor**: `src/lib/owned-assets.ts` (`OwnedProduct/OwnedService/OwedPayment` + `getServiceDueStatus`, SOON = 14 ngày) — UI chỉ biết types này.
- **Adapter**: `src/lib/sdwork-assets.ts` (server-only) — `callGateway` + mapping thuần `mapCrmAssets` test ở `__tests__/owned-assets.test.ts`. Đổi vendor = viết adapter mới, types không đổi.
- **Route**: `GET /api/me/sdvico` — account CRM SUY TỪ SESSION ForFish, không bao giờ nhận id từ client; chưa đăng nhập/chưa cấu hình/CRM lỗi → `ok:false`, UI quay về dữ liệu local. Cache `private, max-age=600`.
- ⚠️ Hardening sau: key công khai của CRM nằm trong tay người dùng nội bộ SDWork (vốn đã thấy dữ liệu khách trong app của họ) — muốn chặt hơn thì cấp secret riêng cho ForFish trong code gateway + env mới.
- 🔴 KHÔNG migration nào trên CRM — gateway chỉ ĐỌC các bảng sẵn có, TRỪ một bảng GHI duy nhất bên dưới. Đã kiểm chứng end-to-end 2026-06-10 (catalog 203 món / 9 dòng; request ghi vào `consultation_requests` rồi xóa bản test).

### Kênh CSKH 2 chiều (user chốt 2026-06-10: "ForFish = kênh CSKH của SDVICO")
- **Catalog gợi ý**: `GET /api/sdvico/catalog` đọc CRM `products` (is_active) → nhóm theo TIỀN TỐ SKU (`src/lib/sdvico-catalog.ts`: LN_=lọc nước, GS_=giám sát, WF_=wifi, LD_=lọc dầu, NHOT_/NG_=nhớt, SONPV_=sơn, AQ_/TL_=điện-lái; DV_=dịch vụ → loại khỏi gợi ý). Cache 1h trong process. CRM không có cột phân loại — SKU prefix là phân loại nội bộ (xác minh trên dữ liệu thật).
- **Yêu cầu từ khách → SDWork**: `POST /api/sdvico/request` → gateway INSERT `consultation_requests` (full_name, phone, message dạng `[ForFish] Chủ đề · sản phẩm — chi tiết`, `source_page='forfish'`, status mặc định `'pending'`). Bảng có policy "Service role manages consultation requests" — đúng cổng nhận yêu cầu kênh ngoài. Dùng được CẢ KHI CHƯA đăng nhập (khách mới = mối bán hàng) — bắt buộc SĐT VN hợp lệ; đăng nhập rồi thì route tự điền tên/SĐT từ profiles.
- **Catalog hiển thị theo DÒNG sản phẩm, KHÔNG phô model** (user chốt): 9 dòng — máy lọc nước biển (LN_) · xử lý dầu (LD_) · dầu nhớt (NHOT_) · phụ gia diesel (NG_) · giám sát hành trình (GS_) · điện thoại vệ tinh (GS_VSS_, ưu tiên tiền tố dài) · internet vệ tinh (WF_) · sơn tàu (SONPV_) · điện & lái (AQ_/TL_). Model cụ thể là chuyện lúc mua, nhân viên tư vấn.
- **Tab Sản phẩm TÁCH ĐÔI: "Đang dùng" / "Khuyến nghị" (user chốt 2026-06-11)**: Khuyến nghị = **thẻ kiểu app shop, CHỈ sản phẩm CHÍNH** — `data/sdvico-showcase.ts` (6 sản phẩm trích nguyên văn showcase sdvico.vn: SEA-40, S-Tracking, Thuraya MNB-01, XT-Pro, SF-50, Nano Graphene; ảnh tải về `public/sdvico/` vì asset site là hash Vite đổi theo build). Thẻ: ảnh 4:3 + chip loại + tên + mô tả + tính năng + nút Hỏi mua + **Gọi ngay hotline 1900 23 23 49** (lấy từ sdvico.vn). KHÔNG đổ phụ kiện/vật tư lẻ — CRM catalog chỉ còn để NHẬN DIỆN dòng đang dùng (thẻ gắn nhãn xanh, xếp lên đầu, nút thành "Mua thêm / vật tư thay"). Form Gọi SDVICO có thêm dòng "Gấp? Gọi ngay 1900 23 23 49". Test ép showcase nối đúng dòng SKU + đủ ảnh/mô tả.
- **Tối ưu "tức thì" (2026-06-10)**: (1) đăng nhập rồi thì form Gọi SDVICO TỰ ĐIỀN tên + SĐT (gửi = 1 chạm); (2) gateway `assets` trả thêm 5 `consultation_requests` gần nhất theo SĐT (`source_page='forfish'`) → tab Dịch vụ có mục "Yêu cầu đã gửi" kèm trạng thái lời thường (`requestStatusVN`: pending→"Đã nhận — chờ gọi lại", done/resolved→"Đã xử lý xong"); (3) nhắc SDVICO (nợ/cước, bảo hành sắp hết, kỳ dịch vụ) GỘP vào "Việc cần làm ngay" ở trang chủ (`urgent-strip.tsx`, tag SDVICO); (4) mỗi món đã mua có chip "Gọi bảo hành món này" (kèm serial); (5) chưa đăng nhập → nút "Đăng nhập để thấy đồ/dịch vụ của mình" trong cả 2 tab.
- ⚠️ Phía SDWork phải có người THEO DÕI `consultation_requests` (hiện 0 hàng — xác nhận với team SDWork quy trình xử lý + đổi status), kẻo yêu cầu của bà con rơi vào im lặng.

## 7. Phân quyền tính năng — public vs CẦN ĐĂNG NHẬP (user chốt 2026-06-10)

App yêu cầu đăng nhập (tài khoản đồng bộ SDWork) cho tính năng GIÁ TRỊ CAO; phần còn lại public để bà con dùng ngay không rào cản:

| Tính năng | Quyền | Chặn ở đâu |
|---|---|---|
| **Dự báo cá (PFZ)** | 🟢 teaser → 🔒 chi tiết | **TEASER (user chốt 2026-06-11)**: `GET /api/fish-forecast` CÔNG KHAI (bỏ gate 401) → lớp cá heatmap + điểm nóng HIỆN cho mọi người (thu hút). Xem CHI TIẾT một điểm (loài gì, khả năng bao nhiêu, đi hướng nào) mới khoá: `fishing-map-view` dùng `useAuthUser`+`isSupabaseConfigured` → `fishLocked` (đã cấu hình Supabase + chưa login) → thẻ cá trong sheet thành nút "Đăng nhập để xem chi tiết dự báo cá" (→/login) thay readout. Heatmap/chọn loài vẫn xem được (làm mồi). Demo mode = mở hết. (Lý do đổi từ "khoá API" cũ: lớp cá biến mất hẳn → không hấp dẫn được khách đăng ký) |
| **Nhu cầu mua cá ("Ai cần mua")** | 🔒 đăng nhập | `LoginGate` quanh `buy-board.tsx`; nguồn API thật sau này PHẢI kiểm session như fish-forecast |
| **Đồ SDVICO của tôi / dịch vụ / cước / yêu cầu đã gửi** | 🔒 (bản chất) | `/api/me/sdvico` suy khách từ session — chưa đăng nhập tự ok:false. **Nguồn thiết bị (2026-06-11)**: gateway `forfish-gateway` v4 (CRM) gộp `warranty_cards` (theo account) + `vw_imported_serials` (import Excel, chủ yếu giám sát hành trình Viettel) khớp theo **SĐT chuẩn hoá 9 số cuối** (0xxx/84xxx/+84 — trước lệch định dạng nên thiết bị import không hiện) qua RPC CRM-side `forfish_imported_serials` (xem [contract](../contracts/sdwork-assets.contract.md)). Khách chỉ có serial import (chưa account) VẪN thấy đồ. Thiết bị import không có hạn BH → hiện tên+serial, không bịa bảo hành |
| Bản đồ + gió sóng + bão + hải đồ + cá MÙA VỤ · giá cá · bán ở đâu · catalog SDVICO + nút Gọi SDVICO · sổ tự ghi (giấy tờ/bảo dưỡng/thuyền viên/lãi lỗ/chia tiền) · mức phạt | 🌐 public | không chặn — gửi yêu cầu khi chưa đăng nhập = mối bán hàng mới |

Quy ước: tính năng khóa MỚI → bọc `components/login-gate.tsx` (UI) **và** kiểm session ở API (thật). Hook trạng thái: `lib/use-auth.ts`. Khi Supabase chưa cấu hình (demo mode dev) thì KHÔNG khóa — giữ invariant demo mode §"Demo mode".

## 8. Cross-references

- Demo mode pattern: [02-architecture.md](02-architecture.md)
- Màu trạng thái: [03-design-system.md](03-design-system.md)
- Trục 4 trong bức tranh sản phẩm: [01-product.md](01-product.md)

---

**Last updated**: 2026-06-18
<!-- re-verified: 2026-06-18 — 0002 supplies +unit; webhook route trả results[] per-event (ref/ok/code/provisioned) — khớp khảo sát SDWork -->
<!-- re-verified: 2026-06-16 — bảng customers/devices/supplies/support_requests (0002) + auth SĐT+mật khẩu (webhook provision, KHÔNG email/OTP) + webhook ingest (§5b); §6 gateway live-read chuyển tiếp -->
<!-- re-verified: 2026-06-14 — schema 0001 boats/documents + §6 gateway khớp code -->
<!-- re-verified earlier baseline -->

