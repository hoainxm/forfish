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
- ⚠️ **Sync base 2026-07-28 (đánh số lại migration)**: fork đã apply `0007_premium_grants` · `0008_fish_snapshot` · `0009_weather_snapshot` lên prod (bất biến). Khi kéo tính năng từ repo gốc (Long-Forfun), 6 migration base ĐỤNG SỐ được **đổi tên thành 0013–0018** (chừa khoảng 0010–0012): `0013_crew_reports` · `0014_market_listings` · `0015_crew_reports_phone` · `0016_product_catalog` · `0017_product_inquiries` · `0018_push_subscriptions`. **CẦN apply 0013–0018 lên Supabase prod** thì tính năng thuyền viên CCCD / chợ mua-bán / danh mục sản phẩm / Web Push mới chạy.

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

### Phân hạng tài khoản — migration [`0006_account_tier.sql`](../../supabase/migrations/0006_account_tier.sql) (2026-07-26)

Premium mở **dự báo cá** + **dự báo thời tiết quá 3 ngày** (basic/chưa đăng nhập bị khoá — xem [01-product](01-product.md)). KHÔNG có luồng thanh toán trong app.

| Cột mới trên `customers` | Nghĩa |
|---|---|
| `tier text not null default 'basic'` (check `basic\|premium`) | hạng tài khoản |
| `premium_until timestamptz` | hạn premium; `null` = không hạn; hết hạn → coi như basic |

- **Luật hạng hiệu lực** ở `src/lib/tier.ts` (`resolveTier` — thuần, có test): client (`use-tier.ts`), middleware (chặn `/api/fish-forecast`) và admin health dùng CHUNG; fail-closed (giá trị lạ/ngày hỏng/lỗi query → basic). DB **không cần cron** hạ hạng.
- **Nguồn gán hạng** (2 đường, không đè nhau): webhook SDWork (customer event kèm `tier`/`premiumUntil` — VẮNG field thì upsert KHÔNG đụng hạng hiện có) và web quản trị `/quan-tri` (PATCH `/api/admin/accounts`, service-role).
- KH đọc hạng của mình qua policy SELECT own-phone sẵn có (0002) — không cần policy mới.
- **Admin ≠ hạng trong DB**: SĐT trong env `ADMIN_PHONES` (`src/lib/admin.ts`) — được vào `/quan-tri` + xem dự báo cá như premium (middleware).

### Tài khoản quản lý + log cấp premium — migration [`0007_premium_grants.sql`](../../supabase/migrations/0007_premium_grants.sql) (2026-07-26, đợt 2)

| Thay đổi | Nghĩa |
|---|---|
| `customers.role text default 'customer'` (check `customer\|manager\|admin` — **'admin' mở ở [0019](../../supabase/migrations/0019_admin_role.sql), 2026-07-28**) | **manager** = đại lý/sales (admin tạo ở `/quan-tri`): chỉ KÍCH HOẠT/GIA HẠN premium. **admin** = FULL-ADMIN trong DB (ngang env `ADMIN_PHONES`): `requireStaff` coi `role='admin'` = toàn quyền. Bootstrap admin đầu (sau khi đăng ký ở `/dang-ky`): `insert into customers (phone,role) values ('<sđt>','admin') on conflict (phone) do update set role='admin';` |
| `customers.premium_activated_at timestamptz` | mốc kích hoạt gần nhất (hạn ở `premium_until`) |
| bảng `premium_grants` | LOG mỗi lần cấp: `customer_phone` · `granted_by` (SĐT người thao tác) · `action` (`activate\|renew\|downgrade`) · `activated_at` · `premium_until` (hạn SAU thao tác) — đếm được mỗi quản lý đang quản bao nhiêu premium. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi |

- **KỲ HẠN: 1 lần kích = 1 NĂM** (`PREMIUM_TERM_DAYS`/`nextPremiumUntil` trong `src/lib/tier.ts`, có test): còn hạn thì gia hạn CỘNG NỐI vào hạn cũ, hết hạn thì tính 1 năm từ hiện tại. Server tự tính — client không gửi hạn tay nữa.
- **Phân quyền staff** (`requireStaff` trong `lib/admin-auth.ts`): admin (env) = toàn quyền (tạo khách/quản lý, hạ hạng, xoá); manager (DB) = chỉ `PATCH action='grant'`. Log hỏng KHÔNG chặn thao tác nhưng trả cờ `logged:false` — UI nói thật để đối soát.

### Snapshot dự báo cá (precompute) — migration [`0008_fish_snapshot.sql`](../../supabase/migrations/0008_fish_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `fish_forecast_snapshot` | 1 dòng singleton `id='latest'`: `payload jsonb` (y hệt payload `/api/fish-forecast`) · `target_date` · `data_quality real` · `generated_at` · `updated_at`. **CRON tính sẵn** (`/api/cron/refresh-fish`, GitHub Actions 6h + Vercel cron) rồi ghi; `/api/fish-forecast` chỉ ĐỌC (nhanh, không phụ thuộc nguồn nặng/hay-treo ERDDAP/HYCOM/Copernicus). Chưa có snapshot → route tự tính fallback. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi (`lib/fish-snapshot.ts`) |

- **KÍCH HOẠT (sau khi apply 0005)**: đặt env `CRON_SECRET` trên Vercel (Vercel Cron tự gắn `Authorization: Bearer` header đó) + GitHub Secret `CRON_SECRET` trùng + GitHub Variable `APP_BASE_URL` = URL prod. `SUPABASE_SERVICE_ROLE_KEY` đã có sẵn. Ghi đè snapshot theo `shouldReplaceSnapshot` (`lib/fish-snapshot-policy.ts`, thuần, có test): không lùi ngày, không thay bản tốt bằng bản hỏng.

### Snapshot thời tiết Open-Meteo (LƯỚI AN TOÀN) — migration [`0009_weather_snapshot.sql`](../../supabase/migrations/0009_weather_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `weather_snapshot` | Nhiều khoá 1 bảng: `id text pk` (`sea:<port>` 10 cảng đủ 16 ngày · `grid:d3` lưới Windy CHỈ khung miễn phí) · `payload jsonb` · `updated_at`. **KHÁC snapshot cá**: đây chỉ là **fallback** — client vẫn gọi **LIVE Open-Meteo là chính** (nhanh, tải phân tán theo IP từng máy — tốt rate-limit); snapshot chỉ dùng khi live lỗi + máy chưa có localStorage. Cron `/api/cron/refresh-weather` ghi; client đọc qua `/api/weather-snapshot?id=` (`lib/weather-snapshot.ts`, service-role). RLS bật, **KHÔNG policy**. Khung lưới >3 ngày (premium) KHÔNG snapshot công khai kẻo lộ |

- **KÍCH HOẠT**: dùng CHUNG `CRON_SECRET` với refresh-fish (đã có). Vercel cron `30 2 * * *` (lệch 30′ sau fish). Khoá whitelist ở `lib/weather-snapshot-id.ts` (thuần, có test) — chặn `/api/weather-snapshot` thành proxy đọc bảng tuỳ ý.

### Cảnh báo THUYỀN VIÊN chéo (CCCD HOẶC SĐT) — migration [`0013_crew_reports.sql`](../../supabase/migrations/0013_crew_reports.sql) + [`0015_crew_reports_phone.sql`](../../supabase/migrations/0015_crew_reports_phone.sql) (2026-07-27) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `crew_reports` | Chủ tàu **premium** báo cáo vấn đề của thuyền viên; chủ tàu khác tra trước khi thuê thấy cảnh báo **đã kiểm duyệt**. **Định danh = CCCD HOẶC SĐT (1 trong 2, 0009)**: khoá tra `subject_cccd_hash` = SHA-256(pepper+CCCD) và/hoặc `subject_phone_hash` = SHA-256(pepper+"phone:"+SĐT) — cả hai NULLABLE, check `crew_reports_identity_check` bắt buộc ≥1. Env `CREW_CCCD_PEPPER` (không dò/duyệt được danh sách). `subject_cccd`/`subject_phone`/`subject_name` (thô, CHỈ admin) · `reporter_phone`/`reporter_boat` (ẩn với người tra; ="SDVICO" khi staff tự thêm) · `category` (bo_tau/trom_cap/gay_roi/chat_kich_thich/no_ung/khac) · `detail` · `status` (pending→approved/rejected/withdrawn) · `moderated_by`/`at` · `subject_response`/`at` · `created_at`. RLS bật, **KHÔNG policy** = chỉ service-role (`lib/crew-report.ts` thuần + `lib/crew-report-hash.ts` server: `hashCccd`/`hashPhone`/`subjectIdentity`) |
| RLS + quyền | Client KHÔNG đọc/ghi trực tiếp. Qua route (gác **premium** + kiểm duyệt): `POST /api/crew-reports` (chủ tàu nộp→pending), `GET /api/crew-reports/lookup?cccd=&phone=` (chỉ approved, ẩn người báo, khớp CCCD **hoặc** SĐT), `/api/admin/crew-reports` **GET** (staff xem đủ) · **POST** (staff TỰ THÊM → thẳng `approved`) · **PATCH** (duyệt/từ chối/rút + phản hồi) · **DELETE** `?id=` (xóa hẳn khỏi danh sách). Premium chốt ở `lib/premium-guard.ts` |

- ✅ **ĐÃ APPLY prod 2026-07-27** (ref znzgugvfhgmiszqgjulk, qua Supabase MCP — cả 0007 và 0009; advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). Env `CREW_CCCD_PEPPER` (≥16 ký tự) đã đặt trên Vercel → tính năng LIVE; thiếu pepper thì route trả 503 `cccd_pepper_missing` (fail-closed).
- **Pháp lý (NĐ 13/2023)**: CCCD/SĐT là dữ liệu cá nhân → chốt với chủ dự án: **kiểm duyệt bắt buộc** (trừ staff tự thêm = thẩm quyền SDVICO, duyệt luôn) + người bị ghi được phản hồi; khoá tra là hash (không lộ danh sách); người báo ẩn với người tra.

### Chợ TIN MUA/BÁN — migration [`0014_market_listings.sql`](../../supabase/migrations/0014_market_listings.sql) (2026-07-27) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `market_listings` | Chủ tàu tự đăng **tin bán** (`side='ban'`) / **tin mua** (`side='mua'`) trong `/tien` mục Tin mua/bán. Cột: `owner_id`→auth.users (NULL = tin từ webhook thu mua) · `side` · `poster_kind` (ngu-dan/nau/vua/nha-may/cho) · `poster_name` · `species` · `quantity`/`price_text`/`province`/`phone`/`note` (chữ tự do) · `status` (open/closed) · `sdwork_ref` (unique, idempotent upsert từ app thu mua sau này). Ghi/đọc client qua `lib/market-listings.ts` (helper `validateDraft`/`rowToListing` thuần, có test) |
| RLS | **ĐỌC**: user đã đăng nhập xem mọi tin `open` + tin của mình (`status='open' and auth.uid() is not null` **or** `auth.uid()=owner_id`) — chưa đăng nhập KHÔNG thấy tin thật, client rơi về `DEMO_LISTINGS` TIN MẪU. **GHI/SỬA/XÓA**: chỉ chủ tin (`auth.uid()=owner_id`). Webhook bên thu mua ghi tin cần mua qua **service-role** (bypass RLS) như customers/devices |

- ✅ **ĐÃ APPLY lên prod** (ref znzgugvfhgmiszqgjulk) qua Supabase MCP 2026-07-27, RLS + 4 policy đã kiểm (advisor không cảnh báo bảng này). Trên máy chưa cấu hình env → `fetchListings` trả null → UI hiện TIN MẪU, đăng tin báo lỗi mềm.
- **Lộ trình**: app riêng cho bên thu mua sẽ đăng tin cần mua đổ về bảng này qua webhook (`sdwork_ref`, `owner_id` NULL) — khi làm cần bổ sung [contract SDWork](../contracts/sdwork-assets.contract.md).

### Danh mục sản phẩm ADMIN quản lý — migration [`0016_product_catalog.sql`](../../supabase/migrations/0016_product_catalog.sql) (2026-07-28) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_listings` | Thay mảng cứng `data/sdvico-showcase.ts` làm nguồn cho khu "Cửa hàng" tab Sản phẩm `/tau` (`sdvico-catalog.tsx`). Admin ẩn/hiện/xóa/thêm ở `/quan-tri` tab "Sản phẩm" — **áp dụng NGAY, không cần build/deploy lại app**. Cột: `vendor_kind` (`sdvico`\|`external`) · `vendor_name` (bắt buộc khi `external` — đơn vị NGOÀI SDWork) · `title`/`category`/`description`/`features` (jsonb mảng chuỗi)/`price_text`/`image_url` · `contact_phone`/`contact_note` (liên hệ riêng cho vendor ngoài) · `line` (nối nhóm SKU CRM để nhận diện "đang dùng", chỉ áp dụng sdvico) · `visible`/`sort_order` · `created_by`. Seed sẵn 6 sản phẩm showcase cũ (giữ nội dung khi apply, admin sửa/ẩn/thêm tiếp từ đó) |
| RLS | **ĐỌC**: công khai, chỉ hàng `visible = true` (tab Sản phẩm là nội dung public — xem §7). **GHI/SỬA/XÓA**: KHÔNG có policy — chỉ service-role qua `/api/admin/products` (`requireStaff`, không phân biệt admin/manager, giống `crew_reports`) |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — user xác nhận apply; advisor không cảnh báo gì mới cho bảng này). Trước khi apply, app chạy bằng `SDVICO_SHOWCASE` tĩnh (client `fetchProductListings()` trả `null` khi bảng chưa tồn tại/chưa cấu hình → fallback, không crash) — hành vi fallback này vẫn giữ nguyên cho các môi trường (vd local dev) chưa apply.

### Yêu cầu hỏi mua/tư vấn — migration [`0017_product_inquiries.sql`](../../supabase/migrations/0017_product_inquiries.sql) (2026-07-28, Phase 2) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_inquiries` | Bà con "Để lại yêu cầu" từ danh mục sản phẩm — bảng RIÊNG của SDFish, **KHÔNG dùng chung `consultation_requests` bên CRM SDWork** (user chốt). **Phạm vi (quyết định thiết kế)**: sản phẩm `vendor_kind='sdvico'` vẫn giữ nguyên nút "Hỏi mua" cũ → `/api/sdvico/request` → CRM (kênh bán hàng SDWork đang theo dõi thật — KHÔNG đụng để tránh rớt lead); bảng này phục vụ cái GAP thật là sản phẩm **đơn vị NGOÀI SDWork** (trước đây chỉ hiện SĐT, không nơi nào ghi lại). Cột: `listing_id`→`product_listings` (nullable, `on delete set null`) · `listing_title`/`vendor_kind` (chụp lại tại thời điểm hỏi, phòng listing bị xóa/sửa) · `customer_phone`(bắt buộc)/`customer_name`/`message` · `status` (`moi`→`da_lien_he`→`xong`) · `handled_by`/`handled_at`/`note` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. GHI qua `POST /api/product-inquiries` (công khai, cho phép khách CHƯA đăng nhập, giống `/api/sdvico/request`) dùng service-role. ĐỌC/SỬA/XÓA qua `/api/admin/product-inquiries` (`requireStaff`) — UI ở `/quan-tri` tab "Yêu cầu" |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role).

### Web Push — đăng ký nhận thông báo — migration [`0018_push_subscriptions.sql`](../../supabase/migrations/0018_push_subscriptions.sql) (2026-07-28, Phase 3) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `push_subscriptions` | Admin gửi thông báo cho TỪNG user (theo SĐT) hoặc TOÀN BỘ user đã bấm "Bật thông báo" trong app (sheet Tài khoản → `hero-account.tsx`) — qua PWA service worker (`public/sw.js`), **không cần app store update**, không SMS/Zalo. Cột: `customer_phone` (nullable — null = ẩn danh, chỉ nhận broadcast toàn bộ, KHÔNG nhận thông báo nhắm theo SĐT) · `endpoint` (unique, định danh máy đăng ký) · `p256dh`/`auth_key` (khoá mã hoá Web Push chuẩn) · `user_agent` · `created_at`/`last_seen_at` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. Đăng ký/hủy qua `POST`/`DELETE /api/push/subscribe` (công khai, dùng service-role, gắn SĐT từ session nếu đã đăng nhập). Gửi qua `POST /api/admin/push` (`requireStaff`) — endpoint chết (404/410 khi gửi) tự xóa khỏi bảng, không cần cron dọn riêng |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). ⚠️ **Tính năng CHƯA chạy được thật cho tới khi set đủ env VAPID** trên Vercel (xem dưới) rồi redeploy — thiếu thì nút "Bật thông báo" tự ẩn, `/api/admin/push` trả `503`.
- **Cần env** (server): `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (tạo 1 lần bằng `npx web-push generate-vapid-keys`) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client, PHẢI TRÙNG `VAPID_PUBLIC_KEY`) — thiếu thì nút "Bật thông báo" tự ẩn (`hero-account.tsx` check `isPushSupported()` + biến env trước khi hiện) và `/api/admin/push` trả `503 vapid_not_configured`.
- **Gửi thật**: `src/lib/push-send.ts` (server-only, dùng npm `web-push`) — `sendPush()` trả `gone:true` khi endpoint 404/410, route admin tự xóa subscription đó.
- **Lộ trình** (thứ tự user chốt 2026-07-28: danh mục → yêu cầu tư vấn → **thông báo** — ĐỦ 3 phần): mở rộng SMS/Zalo là việc SAU nếu cần (chưa yêu cầu).

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
- `demoDocuments(today)` — CÒN trong lib cho unit test, **KHÔNG còn gọi trong UI (2026-07-02)**: `loadDocs()` trả rỗng khi chưa có data thật (bỏ seed vì data giả chung máy gây hiểu nhầm "dùng chung")

### Camel ↔ snake mapping (khi nối Supabase)
TS dùng camelCase (`expiresOn`), DB dùng snake_case (`expires_on`) — khi wire vault lên Supabase phải map rõ ràng, không đổi shape của `BoatDocument`.

## 4. Demo mode storage

- localStorage key: **`forfish.documents.v1`** (versioned — đổi shape thì bump v2 + migrate/seed lại)
- Corrupt JSON / storage bị chặn → coi như RỖNG (không seed demo), không crash

## 5. Việc sắp tới / Implementation status

| # | Item | Status |
|---|---|---|
| 1 | Schema boats + documents + RLS | ✅ Done (`0001_init.sql`) |
| 2 | Vault chạy demo mode (localStorage) | ✅ Done |
| 3 | Đăng nhập SĐT + mật khẩu (không email/OTP) | ✅ Done (2026-06-30): apply migration `0002+0003+0004` prod + Edge Function CRM `sdfish-password-in` + bulk provision 630 account (528 customer + 95 sub + 5 collab + 2 distributor) với mk khởi tạo `sd123456` + `must_change_password=true` |
| 3b | DB khách hàng riêng + webhook ingest | ✅ Done (2026-06-30): inbound + outbound 2 chiều verify end-to-end; còn lại = SDWork team dựng outbox + cron đối soát (Đợt 2) |
| 3c | Auth-scope localStorage (clear data KH khi user change/logout) | ✅ Done (2026-06-30, Đợt 1 vá leak; **vá thêm 2026-07-02**): `src/lib/auth-scope.ts` + hook `use-auth.ts`. Bug: clear xong nhưng state React đang mount vẫn cầm data cũ → save-effect ghi ngược (đăng xuất vẫn sửa được tàu của TK cũ). Vá: clear → đăng ký `pagehide` xoá LẦN CUỐI (chặn save-effect hồi sinh trong khe clear→reload) → `location.reload()` reset RAM. Idempotent, không loop. Xem 02 §4 |
| 4 | Chuyển vault localStorage → Supabase (boats/documents/products/maintenance/debts/trips/crew/buyers) | 🔴 Đợt 2 (kế hoạch): wire vào `boats/documents` (schema đã có 0001) + tạo thêm bảng owner_id cho 7 vault còn lại. Multi-device sync BẮT BUỘC theo quyết user 2026-06-30. Sau hoàn tất, retire `USER_SCOPED_KEYS` ở `auth-scope.ts` |
| 4b | **Lịch sử Ra khơi để predict** (yêu cầu Long 2026-07-02) | 🟡 Code xong 2026-07-02, **CHỜ apply migration [`0005_sea_history.sql`](../../supabase/migrations/0005_sea_history.sql) + set `CRON_SECRET` trên Vercel**. 3 bảng: `sea_daily` (10 cảng × 10 ngày dự báo/lần thu, kèm `lead_days` để so dự báo↔thực tế), `fish_forecast_daily` (hotspot PFZ s≥60), `storm_events`. Cron Vercel 23:30 UTC (=6:30 VN) gọi `/api/collect/sea-daily` (Bearer `CRON_SECRET`, ghi service-role; RLS bật không policy — client không đọc/ghi). Lib thuần `src/lib/sea-history.ts` (test) + builder chung `src/lib/fish-forecast-server.ts` |
| 5 | Nhắc hạn push / Zalo | ❌ Chưa |

## 5b. Auth OTP riêng + webhook ingest (Đợt 1, 2026-06-16) — THAY mô hình §6

**Quyết định user (2026-06-16)**: SDFish thành **app khách hàng độc lập**, **tách SDWork** — KHÔNG đọc-live CRM lúc KH mở app. **Auth chỉ hướng TÀI KHOẢN: SĐT + MẬT KHẨU, KHÔNG email/OTP** (user quản cả 2 project). Mô hình §6 (gateway đọc-live) **chuyển tiếp**, retire sau.

- **Đăng nhập**: SĐT + mật khẩu — `supabase.auth.signInWithPassword({ email: {SĐT}@sdvico.local, password })` trên project SDFish (`/login`). KHÔNG OTP, KHÔNG email confirm, KHÔNG SSO-CRM. SĐT helper thuần `src/lib/phone.ts` (tách `auth-form.tsx`). Mật khẩu chuẩn hoá `normalizePassword` (`src/lib/password.ts`, trim đầu/cuối) đồng nhất mọi điểm đặt & kiểm tra.
  - **CHÍNH SÁCH 2026-07-21 — BỎ ép đổi mật khẩu lần đầu**: webhook không còn bật `must_change_password` ở mọi nhánh (create + reset đều đặt `false`); toàn bộ cờ cũ trên prod đã xóa cùng đợt reset mật khẩu về `sd123456`. Lý do: 627/632 KH kẹt ở màn ép đổi, chỉ 6 người từng vào app. Cơ chế middleware ép đổi (dưới) GIỮ NGUYÊN code — chỉ còn kích hoạt nếu cờ được bật thủ công.
  - **Tách câu lỗi đăng nhập (2026-07-21)**: `/login` sai → `POST /api/auth/exists` (service-role **TÁI DÙNG** RPC `auth_user_id_by_phone` 0003 — KHÔNG DDL mới, chỉ trả boolean, SĐT trong body) → `src/lib/login-error.ts` (thuần, 8 test) chọn câu: chưa có tài khoản → chỉ đường gọi SDVICO cấp; có rồi → "mật khẩu chưa đúng — thử mk ban đầu sd123456 / Quên mật khẩu"; bị khóa (`user_banned`) / 429 / mất mạng → câu riêng; check fail → câu gộp cũ. ⚠️ **Đánh đổi chấp nhận có chủ đích**: user-enumeration + gợi ý mk mặc định cho SĐT ĐÃ đăng ký (user chốt 21/07 — username=SĐT vốn đoán được, ưu tiên kích hoạt 380 KH; route exists là chokepoint gắn rate-limit sau). Đây là NGOẠI LỆ hẹp của quy tắc "không in mật khẩu mặc định" (vá #1 dưới): chỉ hiện khi SĐT CÓ tài khoản, /dang-ky và màn công khai vẫn cấm. Lộ trình siết: [ADR 0002](../adr/0002-siet-bao-mat-sau-sd123456.md).
  - **Ép đổi mật khẩu = enforce SERVER** (báo cáo test 2026-06-30): còn cờ `must_change_password` thì **middleware** (`src/lib/supabase/middleware.ts` + `mustForcePasswordChange` thuần `src/lib/auth-guard.ts`, test) đẩy MỌI trang (trừ `/doi-mat-khau`, `/login`, `/dang-ky`, `/api`) về `/doi-mat-khau` — không lách được bằng back/gõ URL. Khách CHƯA đăng nhập KHÔNG bị gate (app vẫn công khai). Redirect của login chỉ còn là UX tức thời.
- **Đồng bộ mật khẩu 2 chiều** (1 credential đăng nhập CẢ 2 app — `syncAuthPassword` trong webhook route):
  - **Inbound SDWork→SDFish**: customer event kèm `password`. Chưa có user → `createUser({email_confirm:true, user_metadata:{must_change_password:false}})`. ĐÃ tồn tại + **KHÔNG** `resetPassword` → bỏ qua (không ghi đè mk KH tự đổi). ĐÃ tồn tại + `resetPassword:true` (SDWork chủ động đặt lại) → tra id qua RPC **`auth_user_id_by_phone`** (migration [`0003_auth_password_sync.sql`](../../supabase/migrations/0003_auth_password_sync.sql), security-definer, revoke public) → `updateUserById({password, user_metadata:{must_change_password:false}})` (reset cũng XÓA cờ ép đổi còn sót). Mật khẩu KHÔNG lưu `customers` (chỉ trên auth user, Supabase hash). Intent thuần `passwordSyncIntent` (test).
  - **Inbound KHÔNG kèm password (2026-07-21)**: SĐT di động VN hợp lệ (`isValidVnPhone`) + CHƯA có auth user → tạo với mật khẩu mặc định **`sd123456`** (không ép đổi); đã có user → giữ nguyên. Số bàn 02x / số test → chỉ upsert hồ sơ. Nhờ vậy `sdfish_dong_bo_lai()` (đồng bộ định kỳ phía CRM) tự lành khách thiếu tài khoản — đóng lỗ hổng "mất event password = vĩnh viễn không đăng nhập được".
  - **Outbound SDFish→SDWork**: KH đổi mk ở `/doi-mat-khau` → `POST /api/sdwork/password-sync` (SĐT lấy từ **session**, không tin client; HMAC `SDWORK_WEBHOOK_SECRET` → `SDWORK_SYNC_URL`). Best-effort (đổi tại SDFish đã xong; lỗi đẩy ngược không chặn KH). Signer thuần `src/lib/sdwork-outbound.ts` (test). SDWork phải dựng endpoint nhận (hợp đồng §7).
  - **Fix**: `/doi-mat-khau` tắt `must_change_password` trong **`user_metadata`** (qua `updateUser({data})`), KHÔNG phải bảng `profiles` (không tồn tại) — trước đây ghi nhầm nên KH bị ép đổi mỗi lần đăng nhập.
  - **Vá cửa ải đổi-mk-lần-đầu (2026-07-21, rà trước chiến dịch kích hoạt 380 KH)** — 3 lỗi làm KH kẹt rồi bỏ app (số liệu prod 20/07: 632 tài khoản, **chỉ 3 KH thật từng đăng nhập**; `0907905359` vào 02/07, không đổi được mk, không quay lại):
    1. UI ghi mật khẩu mặc định là `123456` trong khi bulk provision dùng chuỗi khác → **bỏ hẳn việc in mật khẩu mặc định ra màn hình** (tên đăng nhập là SĐT → in ra = mở cửa mọi tài khoản chưa đổi). Chú thích sai ở `dang-ky/page.tsx` + `auth-guard.ts` sửa theo.
    2. **Kẹt cứng**: middleware chặn mọi trang, mà nút đăng xuất chỉ có trong sheet Tài khoản ở TRANG CHỦ (bị chặn) → thêm nút **"Thoát ra, để đổi sau"** (`signOut` → `/`) + dòng hotline ngay trên màn.
    3. Mọi lỗi gộp thành 1 câu "thử lại giúp nhé" (ca hay gặp: KH gõ LẠI mk cũ → Supabase `same_password`) → tách theo nguyên nhân bằng **`src/lib/auth-error.ts`** (thuần, 8 test: trùng mk cũ · mk yếu · mk rò rỉ · phiên hết hạn · quá nhanh · mất mạng · fallback có lối thoát · không câu nào lộ mật khẩu mặc định).
- **Nạp dữ liệu**: `POST /api/sdwork/webhook` — verify **HMAC SHA-256** (header `x-sdwork-signature`, env `SDWORK_WEBHOOK_SECRET`) trên raw body → upsert customers/devices/supplies bằng admin client. Map thuần `src/lib/sdwork-webhook.ts` (`toCustomerRow/toDeviceRow/toSupplyRow`, chuẩn hoá SĐT, idempotent `sdwork_ref`) — có test. Response trả `results[]` per-event (`ref`, `ok`, `code?`, `provisioned?`) + `applied` count → SDWork đối soát chính xác từng event, không câm khi 1 hàng lỗi.
- **Đọc**: `/api/me/sdvico` đọc **bảng SDFish** (RLS theo `current_phone()`) thay `fetchOwnedAssets` gọi CRM. `use-sdvico-assets` giữ interface (4 nấc + `OwnedAssets`).
- **Hợp đồng webhook**: [sdwork-sso-contract.md](../integration/sdwork-sso-contract.md) (event types/payload/HMAC + password).
- **Đồng bộ mật khẩu 2 chiều (Đợt 2, 2026-06-19)**: reset inbound (`resetPassword`) + đẩy outbound (`/api/sdwork/password-sync`) + RPC `0003` — **code+test xong**; migration + Edge Function + env đã lên prod 2026-06-30 (xem §5 dòng 3/3b). Còn lại: **outbox phía SDWork** 🔴 (đơn/KH mới → tự bắn webhook; artifact sẵn ở [go-live](../integration/go-live/README.md) Bước 4 — thiếu nó đơn mới KHÔNG tạo user SDFish) · cron đối soát · retire §6 (gateway live-read + `/api/auth/sso`).
- **Quên mật khẩu tự phục vụ (2026-07-21) — TÁI DÙNG quy trình sẵn có của CRM, KHÔNG xây mới**: SDFish auth là SĐT+mật khẩu, email ảo `{SĐT}@sdvico.local` không nhận thư ⇒ không làm được "gửi link đặt lại". Rà CRM thì phát hiện đã có TRỌN bộ: Edge Function `request-password-reset` (v23, 15/07) + bảng `password_reset_requests` (`user_id`→`users.id`, `verification_data`, `expires_at`, `processed_by`) + `approve-password-reset`/`reject-password-reset` + `password_reset_attempts` (chống dò theo IP) + cron dọn hết hạn. Đang dùng thật (6 duyệt · 3 hết hạn).
  - **Luồng**: `/quen-mat-khau` (SĐT + họ tên) → trình duyệt KH gọi thẳng `request-password-reset` → CRM dò `users.login_phone` (ta gửi SĐT vào CẢ `username` lẫn `phone` nên khớp nhánh đầu — KH **không cần biết username CRM**) → tạo yêu cầu `pending` + báo admin → nhân viên duyệt → CRM bắn `resetPassword:true` + mật khẩu mới về `/api/sdwork/webhook` → SDFish `updateUserById` + bật `must_change_password`.
  - ⚠️ **Gọi từ CLIENT, không proxy qua server SDFish** — CRM chặn 5 yêu cầu/giờ theo `requester_ip`; qua server thì mọi KH chung 1 IP, khách thứ 6 bị từ chối oan.
  - ⚠️ **Anon key TUỲ CHỌN**: function deploy công khai (không verify JWT). Cổng Supabase **bỏ qua** khoá không đọc được nhưng **chặn 401** khoá đọc-được-sai-project ⇒ gửi khoá sai còn tệ hơn không gửi. Verify 21/07: `SDWORK_SUPABASE_ANON_KEY` ở `.env.local` trả `401 Invalid API key` — 🟡 khoá này cũng nuôi `lib/sdwork-assets.ts` (Gọi SDVICO), cần soát lại giá trị trên Vercel.
  - ✅ **ĐÃ XỬ (chiều 21/07)**: 46 account có `login_phone` nhưng KHÔNG có bản ghi `users` bên CRM (→ `request-password-reset` nuốt im lặng) — đã tạo đủ chuỗi `auth.users + identities + users + user_roles + owner_user_id` cho **41 KH** bằng SQL trực tiếp (pass `sd123456`, `must_change_password=false`; KHÔNG dùng `bulk-create-users-for-accounts` vì fn đó xóa auth user cũ + pass random + sót type customer). Verify login CRM OK (`0886181212`). 5 còn lại = 4 SĐT sai định dạng + 1 acc test — chờ nhân viên sửa SĐT.
- **Phủ tài khoản: mọi khách SDWork đều có login SDFish (yêu cầu user 2026-07-21)** — trạng thái đo lại chiều 21/07: đủ điều kiện (có `login_phone`, active) **646**, SDFish có **632** (2 acc test mồ côi `0900000777`/`0903333333` — **ĐÃ BAN 21/07** `ban_duration` ~100 năm qua admin API, không xóa cứng giữ audit trail; login trả `user_banned`). **Quét phủ chiều tối 21/07** (script đối chiếu customers ↔ auth.users): **631/631 KH SĐT di động hợp lệ ĐỀU có login — thiếu 0**; `0918389089` (Đại Lý Dư Thanh Phương) **đã tự lành** qua đồng bộ định kỳ ✓; ban thêm acc test thứ 3 `0999999999` ("Tài Trợ Quảng Cáo" — có row CRM nhưng là account kỹ thuật, chưa từng đăng nhập). Còn tồn: 17 customers số bàn/sai định dạng không có login (đúng chính sách — chờ nhân viên bổ sung SĐT thật) + 3 auth user số fake kiểu cũ CHƯA ban (`0123456789`, `0123456154` — account SHOT chụp màn hình nội bộ, `0000000000`) — chờ user quyết.
  - **Audit sức khoẻ account 21/07 (admin API, KHÔNG dò mật khẩu)**: 631 account SĐT di động — **631/631 đã confirm (đăng nhập được), 0 kẹt cờ `must_change_password`, 0 chưa confirm** → provision lành mạnh, chiến dịch bỏ ép đổi đã sạch cờ. Nhưng **chỉ 7/631 TỪNG đăng nhập** (3 hôm 21/07: `0913628397`, `0918389089`, `0302676808` — chiến dịch kích hoạt bắt đầu chạy), 624 chưa vào lần nào. Hệ quả bảo mật (định lượng cho [ADR 0002](../adr/0002-siet-bao-mat-sau-sd123456.md)): 624 account chưa ai đổi mật khẩu ⇒ vẫn mở bằng `sd123456` — ai biết SĐT đều vào được, củng cố ưu tiên Bước 1 (rate-limit). ⚠️ **Sweep live-login toàn bộ 631 account bằng sd123456 bị safety classifier chặn** (trùng pattern credential-stuffing) — dùng audit metadata thay thế; muốn verify live cần permission rule Bash hoặc chạy sample nhỏ. ⇒ thiếu **16**, nhưng chỉ **1 SĐT di động thật** (`0918389089`) — 15 còn lại là số bàn 02x/số test sai định dạng; thêm **41 khách thiếu SĐT** (35 customer + 6 sub) cần nhân viên bổ sung. Vá đã triển khai: (a) [go-live/sdwork-outbox-phu-tai-khoan.sql](../integration/go-live/sdwork-outbox-phu-tai-khoan.sql) ✅ ĐÃ apply CRM (mở type sub/collab/distributor + `sdfish_dong_bo_lai()` định kỳ) · (b) webhook tự tạo tài khoản `sd123456` cho event không kèm password (xem Inbound trên) → đồng bộ định kỳ giờ TỰ LÀNH khách thiếu · (c) khách thiếu SĐT xuất danh sách giao nhân viên, KHÔNG tự chế số.

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
| **Tin mua/bán (đăng + xem tin thật)** | 🟢 xem TIN MẪU công khai → 🔒 đăng tin & xem tin thật | `market-board.tsx`: chưa đăng nhập XEM được `DEMO_LISTINGS` (mồi) nhưng nút đăng tin → /login. Tin THẬT (`market_listings`) chỉ user đã đăng nhập đọc (RLS `auth.uid() is not null`), chỉ chủ tin ghi/sửa/xóa — chặn thật ở RLS, không lách được |
| **Đồ SDVICO của tôi / dịch vụ / cước / yêu cầu đã gửi** | 🔒 (bản chất) | `/api/me/sdvico` suy khách từ session — chưa đăng nhập tự ok:false. **Nguồn thiết bị (2026-06-11)**: gateway `forfish-gateway` v4 (CRM) gộp `warranty_cards` (theo account) + `vw_imported_serials` (import Excel, chủ yếu giám sát hành trình Viettel) khớp theo **SĐT chuẩn hoá 9 số cuối** (0xxx/84xxx/+84 — trước lệch định dạng nên thiết bị import không hiện) qua RPC CRM-side `forfish_imported_serials` (xem [contract](../contracts/sdwork-assets.contract.md)). Khách chỉ có serial import (chưa account) VẪN thấy đồ. Thiết bị import không có hạn BH → hiện tên+serial, không bịa bảo hành |
| Bản đồ + gió sóng + bão + hải đồ + cá MÙA VỤ · giá cá · bán ở đâu · catalog SDVICO + nút Gọi SDVICO · sổ tự ghi (giấy tờ/bảo dưỡng/thuyền viên) · mức phạt | 🌐 public | không chặn — gửi yêu cầu khi chưa đăng nhập = mối bán hàng mới |
| **Cảnh báo thuyền viên chéo** (tra/báo cáo theo CCCD) | 🔒 **premium** | chốt server `lib/premium-guard.ts` (route /api/crew-reports*) + khoá UI ở `crew-list.tsx` |

Quy ước: tính năng khóa MỚI → bọc `components/login-gate.tsx` (UI) **và** kiểm session ở API (thật). Hook trạng thái: `lib/use-auth.ts`. Khi Supabase chưa cấu hình (demo mode dev) thì KHÔNG khóa — giữ invariant demo mode §"Demo mode". Ngưỡng phân loại: data CÁ NHÂN (gắn tàu/user) → khóa; tham khảo dùng chung (giá, thời tiết, mức phạt) → public.

## 8. Cross-references

- Demo mode pattern: [02-architecture.md](02-architecture.md)
- Màu trạng thái: [03-design-system.md](03-design-system.md)
- Trục 4 trong bức tranh sản phẩm: [01-product.md](01-product.md)

---

**Last updated**: 2026-07-28
<!-- re-verified: 2026-07-28 — bảng `product_listings` (0010, 🔴 chưa apply prod) — danh mục sản phẩm/dịch vụ admin quản lý cho tab Sản phẩm /tau, đọc công khai (RLS visible=true), ghi chỉ qua /api/admin/products (requireStaff). Kế hoạch tiếp: product_inquiries riêng + push_subscriptions (Web Push) — chưa có migration. -->
<!-- re-verified: 2026-06-18 — 0002 supplies +unit; webhook route trả results[] per-event (ref/ok/code/provisioned) — khớp khảo sát SDWork -->
<!-- re-verified: 2026-06-16 — bảng customers/devices/supplies/support_requests (0002) + auth SĐT+mật khẩu (webhook provision, KHÔNG email/OTP) + webhook ingest (§5b); §6 gateway live-read chuyển tiếp -->
<!-- re-verified: 2026-06-14 — schema 0001 boats/documents + §6 gateway khớp code -->
<!-- re-verified earlier baseline -->

