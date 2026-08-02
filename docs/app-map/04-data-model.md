# 04 — Data model: schema, RLS, logic giấy tờ

> **Mục đích / Purpose**: Nguồn canonical về database (Supabase) và domain logic Trục 4 (tủ giấy tờ + trạng thái hạn).

**Load khi / Load when**: đụng DB/migration/RLS, sửa `src/lib/documents.ts`, nối vault với Supabase, hoặc thêm bảng mới.

covers: supabase/migrations, src/lib/documents.ts, src/lib/owned-assets.ts, src/lib/sdwork-webhook.ts, src/lib/phone.ts
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
| `supplies` | `customer_phone`, `name`, `qty` (numeric, thập phân OK), `unit` (cái/cuộn/kg/m), `order_code`, `sdwork_ref` (unique) | SELECT `using (customer_phone = current_phone())` |
| `support_requests` | `owner_id`→auth.users, `phone`, `summary`, `status` | owner-only `for all (auth.uid()=owner_id)` (KH tự tạo) |

- **`current_phone()`** (SQL stable, security definer): `split_part(auth.jwt()->>'email','@','1')` — SĐT từ email ảo `{SĐT}@sdvico.local`.
- Ghi customers/devices/supplies + **provision auth user** (SĐT+mật khẩu) CHỈ qua **admin client** (`src/lib/supabase/admin.ts`, service-role) trong route webhook — KHÔNG cho client ghi.
- Idempotent: upsert theo `sdwork_ref` (`onConflict`).
- 🔴 Migration AUTHOR sẵn, **CHƯA apply prod** — bước duyệt riêng. App degrade gracefully nếu bảng chưa có (`/api/me/sdvico` → `no_link` → UI local).

### Phân hạng tài khoản — migration [`0003_account_tier.sql`](../../supabase/migrations/0003_account_tier.sql) (2026-07-26)

Premium mở **dự báo cá** + **dự báo thời tiết quá 3 ngày** (basic/chưa đăng nhập bị khoá — xem [01-product](01-product.md)). KHÔNG có luồng thanh toán trong app.

| Cột mới trên `customers` | Nghĩa |
|---|---|
| `tier text not null default 'basic'` (check `basic\|premium`) | hạng tài khoản |
| `premium_until timestamptz` | hạn premium; `null` = không hạn; hết hạn → coi như basic |

- **Luật hạng hiệu lực** ở `src/lib/tier.ts` (`resolveTier` — thuần, có test): client (`use-tier.ts`), middleware (chặn `/api/fish-forecast`) và admin health dùng CHUNG; fail-closed (giá trị lạ/ngày hỏng/lỗi query → basic). DB **không cần cron** hạ hạng.
- **Nguồn gán hạng** (2 đường, không đè nhau): webhook SDWork (customer event kèm `tier`/`premiumUntil` — VẮNG field thì upsert KHÔNG đụng hạng hiện có) và web quản trị `/quan-tri` (PATCH `/api/admin/accounts`, service-role).
- KH đọc hạng của mình qua policy SELECT own-phone sẵn có (0002) — không cần policy mới.
- **Admin ≠ hạng trong DB**: SĐT trong env `ADMIN_PHONES` (`src/lib/admin.ts`) — được vào `/quan-tri` + xem dự báo cá như premium (middleware).

### Tài khoản quản lý + log cấp premium — migration [`0004_premium_grants.sql`](../../supabase/migrations/0004_premium_grants.sql) (2026-07-26, đợt 2)

| Thay đổi | Nghĩa |
|---|---|
| `customers.role text default 'customer'` (check `customer\|manager`) | **QUẢN LÝ** (đại lý/sales, admin tạo ở `/quan-tri`): vào được `/quan-tri` với quyền THEO BẢNG PHÂN QUYỀN (migration `0017` — mặc định 5 tab: Tài khoản/Sản phẩm/Thuyền viên/Thông báo/Chỗ bán) |
| `customers.premium_activated_at timestamptz` | mốc kích hoạt gần nhất (hạn ở `premium_until`) |
| bảng `premium_grants` | LOG mỗi lần cấp: `customer_phone` · `granted_by` (SĐT người thao tác) · `action` (`activate\|renew\|downgrade`) · `activated_at` · `premium_until` (hạn SAU thao tác) — đếm được mỗi quản lý đang quản bao nhiêu premium. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi |

- **KỲ HẠN: 1 lần kích = 1 NĂM** (`PREMIUM_TERM_DAYS`/`nextPremiumUntil` trong `src/lib/tier.ts`, có test): còn hạn thì gia hạn CỘNG NỐI vào hạn cũ, hết hạn thì tính 1 năm từ hiện tại. Server tự tính — client không gửi hạn tay nữa.
- **Phân quyền staff** (`lib/admin-auth.ts` + `lib/staff-permissions.ts`): admin (env) = toàn quyền; manager (DB) = **theo bảng phân quyền** (xem migration `0017` bên dưới). Log cấp premium hỏng KHÔNG chặn thao tác nhưng trả cờ `logged:false` — UI nói thật để đối soát.

### Snapshot dự báo cá (precompute) — migration [`0005_fish_snapshot.sql`](../../supabase/migrations/0005_fish_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `fish_forecast_snapshot` | 1 dòng singleton `id='latest'`: `payload jsonb` (y hệt payload `/api/fish-forecast`) · `target_date` · `data_quality real` · `generated_at` · `updated_at`. **CRON tính sẵn** (`/api/cron/refresh-fish`, GitHub Actions 6h + Vercel cron) rồi ghi; `/api/fish-forecast` chỉ ĐỌC (nhanh, không phụ thuộc nguồn nặng/hay-treo ERDDAP/HYCOM/Copernicus). Chưa có snapshot → route tự tính fallback. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi (`lib/fish-snapshot.ts`) |

- **KÍCH HOẠT (sau khi apply 0005)**: đặt env `CRON_SECRET` trên Vercel (Vercel Cron tự gắn `Authorization: Bearer` header đó) + GitHub Secret `CRON_SECRET` trùng + GitHub Variable `APP_BASE_URL` = URL prod. `SUPABASE_SERVICE_ROLE_KEY` đã có sẵn. Ghi đè snapshot theo `shouldReplaceSnapshot` (`lib/fish-snapshot-policy.ts`, thuần, có test): không lùi ngày, không thay bản tốt bằng bản hỏng.

### Snapshot thời tiết Open-Meteo (LƯỚI AN TOÀN) — migration [`0006_weather_snapshot.sql`](../../supabase/migrations/0006_weather_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `weather_snapshot` | Nhiều khoá 1 bảng: `id text pk` (`sea:<port>` 10 cảng đủ 16 ngày · `grid:d3` lưới Windy CHỈ khung miễn phí) · `payload jsonb` · `updated_at`. **KHÁC snapshot cá**: đây chỉ là **fallback** — client vẫn gọi **LIVE Open-Meteo là chính** (nhanh, tải phân tán theo IP từng máy — tốt rate-limit); snapshot chỉ dùng khi live lỗi + máy chưa có localStorage. Cron `/api/cron/refresh-weather` ghi; client đọc qua `/api/weather-snapshot?id=` (`lib/weather-snapshot.ts`, service-role). RLS bật, **KHÔNG policy**. Khung lưới >3 ngày (premium) KHÔNG snapshot công khai kẻo lộ |

- **KÍCH HOẠT**: dùng CHUNG `CRON_SECRET` với refresh-fish (đã có). Vercel cron `30 2 * * *` (lệch 30′ sau fish). Khoá whitelist ở `lib/weather-snapshot-id.ts` (thuần, có test) — chặn `/api/weather-snapshot` thành proxy đọc bảng tuỳ ý.

### Cảnh báo THUYỀN VIÊN chéo (CCCD HOẶC SĐT) — migration [`0007_crew_reports.sql`](../../supabase/migrations/0007_crew_reports.sql) + [`0009_crew_reports_phone.sql`](../../supabase/migrations/0009_crew_reports_phone.sql) (2026-07-27) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `crew_reports` | Chủ tàu **premium** báo cáo vấn đề của thuyền viên; chủ tàu khác tra trước khi thuê thấy cảnh báo **đã kiểm duyệt**. **Định danh = CCCD HOẶC SĐT (1 trong 2, 0009)**: khoá tra `subject_cccd_hash` = SHA-256(pepper+CCCD) và/hoặc `subject_phone_hash` = SHA-256(pepper+"phone:"+SĐT) — cả hai NULLABLE, check `crew_reports_identity_check` bắt buộc ≥1. Env `CREW_CCCD_PEPPER` (không dò/duyệt được danh sách). `subject_cccd`/`subject_phone`/`subject_name` (thô, CHỈ admin) · `reporter_phone`/`reporter_boat` (ẩn với người tra; ="SDVICO" khi staff tự thêm) · `category` (bo_tau/trom_cap/gay_roi/chat_kich_thich/no_ung/khac) · `detail` · `status` (pending→approved/rejected/withdrawn) · `moderated_by`/`at` · `subject_response`/`at` · `created_at`. RLS bật, **KHÔNG policy** = chỉ service-role (`lib/crew-report.ts` thuần + `lib/crew-report-hash.ts` server: `hashCccd`/`hashPhone`/`subjectIdentity`) |
| RLS + quyền | Client KHÔNG đọc/ghi trực tiếp. Qua route (gác **premium** + kiểm duyệt): `POST /api/crew-reports` (chủ tàu nộp→pending), `GET /api/crew-reports/lookup?cccd=&phone=` (chỉ approved, ẩn người báo, khớp CCCD **hoặc** SĐT), `/api/admin/crew-reports` **GET** (staff xem đủ) · **POST** (staff TỰ THÊM → thẳng `approved`) · **PATCH** (duyệt/từ chối/rút + phản hồi) · **DELETE** `?id=` (xóa hẳn khỏi danh sách). Premium chốt ở `lib/premium-guard.ts` |

- ✅ **ĐÃ APPLY prod 2026-07-27** (ref znzgugvfhgmiszqgjulk, qua Supabase MCP — cả 0007 và 0009; advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). Env `CREW_CCCD_PEPPER` (≥16 ký tự) đã đặt trên Vercel → tính năng LIVE; thiếu pepper thì route trả 503 `cccd_pepper_missing` (fail-closed).
- **Pháp lý (NĐ 13/2023)**: CCCD/SĐT là dữ liệu cá nhân → chốt với chủ dự án: **kiểm duyệt bắt buộc** (trừ staff tự thêm = thẩm quyền SDVICO, duyệt luôn) + người bị ghi được phản hồi; khoá tra là hash (không lộ danh sách); người báo ẩn với người tra.

### Chợ TIN MUA/BÁN — migration [`0008_market_listings.sql`](../../supabase/migrations/0008_market_listings.sql) (2026-07-27) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `market_listings` | Chủ tàu tự đăng **tin bán** (`side='ban'`) / **tin mua** (`side='mua'`) trong `/tien` mục Tin mua/bán. Cột: `owner_id`→auth.users (NULL = tin từ webhook thu mua) · `side` · `poster_kind` (ngu-dan/nau/vua/nha-may/cho) · `poster_name` · `species` · `quantity`/`price_text`/`province`/`phone`/`note` (chữ tự do) · `status` (open/closed) · `sdwork_ref` (unique, idempotent upsert từ app thu mua sau này). Ghi/đọc client qua `lib/market-listings.ts` (helper `validateDraft`/`rowToListing` thuần, có test) |
| RLS | **ĐỌC**: user đã đăng nhập xem mọi tin `open` + tin của mình (`status='open' and auth.uid() is not null` **or** `auth.uid()=owner_id`) — chưa đăng nhập KHÔNG thấy tin thật, client rơi về `DEMO_LISTINGS` TIN MẪU. **GHI/SỬA/XÓA**: chỉ chủ tin (`auth.uid()=owner_id`). Webhook bên thu mua ghi tin cần mua qua **service-role** (bypass RLS) như customers/devices |

- ✅ **ĐÃ APPLY lên prod** (ref znzgugvfhgmiszqgjulk) qua Supabase MCP 2026-07-27, RLS + 4 policy đã kiểm (advisor không cảnh báo bảng này). Trên máy chưa cấu hình env → `fetchListings` trả null → UI hiện TIN MẪU, đăng tin báo lỗi mềm.
- **Lộ trình**: app riêng cho bên thu mua sẽ đăng tin cần mua đổ về bảng này qua webhook (`sdwork_ref`, `owner_id` NULL) — khi làm cần bổ sung [contract SDWork](../contracts/sdwork-assets.contract.md).

### Danh mục sản phẩm ADMIN quản lý — migration [`0010_product_catalog.sql`](../../supabase/migrations/0010_product_catalog.sql) (2026-07-28) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_listings` | Thay mảng cứng `data/sdvico-showcase.ts` làm nguồn cho khu "Cửa hàng" tab Sản phẩm `/tau` (`sdvico-catalog.tsx`). Admin ẩn/hiện/xóa/thêm ở `/quan-tri` tab "Sản phẩm" — **áp dụng NGAY, không cần build/deploy lại app**. Cột: `vendor_kind` (`sdvico`\|`external`) · `vendor_name` (bắt buộc khi `external` — đơn vị NGOÀI SDWork) · `title`/`category`/`description`/`features` (jsonb mảng chuỗi)/`price_text`/`image_url` · `contact_phone`/`contact_note` (liên hệ riêng cho vendor ngoài) · `line` (nối nhóm SKU CRM để nhận diện "đang dùng", chỉ áp dụng sdvico) · `visible`/`sort_order` · `created_by`. Seed sẵn 6 sản phẩm showcase cũ (giữ nội dung khi apply, admin sửa/ẩn/thêm tiếp từ đó) |
| RLS | **ĐỌC**: công khai, chỉ hàng `visible = true` (tab Sản phẩm là nội dung public — xem §7). **GHI/SỬA/XÓA**: KHÔNG có policy — chỉ service-role qua `/api/admin/products` — **phân quyền** `requirePermission("san-pham", …)`: GET=view·POST=create·PATCH=edit·DELETE=delete (xem 0017) |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — user xác nhận apply; advisor không cảnh báo gì mới cho bảng này). Trước khi apply, app chạy bằng `SDVICO_SHOWCASE` tĩnh (client `fetchProductListings()` trả `null` khi bảng chưa tồn tại/chưa cấu hình → fallback, không crash) — hành vi fallback này vẫn giữ nguyên cho các môi trường (vd local dev) chưa apply.

### Yêu cầu hỏi mua/tư vấn — migration [`0011_product_inquiries.sql`](../../supabase/migrations/0011_product_inquiries.sql) (2026-07-28, Phase 2) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_inquiries` | Bà con "Để lại yêu cầu" từ danh mục sản phẩm — bảng RIÊNG của SDFish, **KHÔNG dùng chung `consultation_requests` bên CRM SDWork** (user chốt). **Phạm vi (quyết định thiết kế)**: sản phẩm `vendor_kind='sdvico'` vẫn giữ nguyên nút "Hỏi mua" cũ → `/api/sdvico/request` → CRM (kênh bán hàng SDWork đang theo dõi thật — KHÔNG đụng để tránh rớt lead); bảng này phục vụ cái GAP thật là sản phẩm **đơn vị NGOÀI SDWork** (trước đây chỉ hiện SĐT, không nơi nào ghi lại). Cột: `listing_id`→`product_listings` (nullable, `on delete set null`) · `listing_title`/`vendor_kind` (chụp lại tại thời điểm hỏi, phòng listing bị xóa/sửa) · `customer_phone`(bắt buộc)/`customer_name`/`message` · `status` (`moi`→`da_lien_he`→`xong`) · `handled_by`/`handled_at`/`note` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. GHI qua `POST /api/product-inquiries` (công khai, cho phép khách CHƯA đăng nhập, giống `/api/sdvico/request`) dùng service-role. ĐỌC/SỬA/XÓA qua `/api/admin/product-inquiries` (**`requireAdmin` — admin-only cứng**, xem 0017) — UI ở `/quan-tri` tab "Yêu cầu" |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role).

### Web Push — đăng ký nhận thông báo — migration [`0012_push_subscriptions.sql`](../../supabase/migrations/0012_push_subscriptions.sql) (2026-07-28, Phase 3) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `push_subscriptions` | Admin gửi thông báo cho TỪNG user (theo SĐT) hoặc TOÀN BỘ user đã bấm "Bật thông báo" trong app (sheet Tài khoản → `hero-account.tsx`) — qua PWA service worker (`public/sw.js`), **không cần app store update**, không SMS/Zalo. Cột: `customer_phone` (nullable — null = ẩn danh, chỉ nhận broadcast toàn bộ, KHÔNG nhận thông báo nhắm theo SĐT) · `endpoint` (unique, định danh máy đăng ký) · `p256dh`/`auth_key` (khoá mã hoá Web Push chuẩn) · `user_agent` · `created_at`/`last_seen_at` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. Đăng ký/hủy qua `POST`/`DELETE /api/push/subscribe` (công khai, dùng service-role, gắn SĐT từ session nếu đã đăng nhập). Gửi qua `POST /api/admin/push` (**phân quyền** `requirePermission("thong-bao", …)`: GET=view·POST=create) — endpoint chết (404/410 khi gửi) tự xóa khỏi bảng, không cần cron dọn riêng |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). ⚠️ **Tính năng CHƯA chạy được thật cho tới khi set đủ env VAPID** trên Vercel (xem dưới) rồi redeploy — thiếu thì nút "Bật thông báo" tự ẩn, `/api/admin/push` trả `503`.
- **Cần env** (server): `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (tạo 1 lần bằng `npx web-push generate-vapid-keys`) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client, PHẢI TRÙNG `VAPID_PUBLIC_KEY`) — thiếu thì nút "Bật thông báo" tự ẩn (`hero-account.tsx` check `isPushSupported()` + biến env trước khi hiện) và `/api/admin/push` trả `503 vapid_not_configured`.
- **Gửi thật**: `src/lib/push-send.ts` (server-only, dùng npm `web-push`) — `sendPush()` trả `gone:true` khi endpoint 404/410, route admin tự xóa subscription đó.

### Vùng biển VMS — admin quản lý — migration [`0013_vms_zones.sql`](../../supabase/migrations/0013_vms_zones.sql) (2026-07-28) — 🔴 CHƯA apply prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `vms_zones` | Vùng biển VMS hiện trên bản đồ Ra khơi (`/ngu-truong`) do admin **thêm/bớt/ẩn** + đặt **hiển thị mặc định trên app ngư dân** ngay trong `/quan-tri` tab "Vùng biển" — áp dụng NGAY, không build lại app. Thay dữ liệu tĩnh `data/vms-zones.json`. Cột: `name` · `color` (#rrggbb) · `style` (`fill`/`line`/`line-dashed`) · `default_on` (toggle app ngư dân mặc định bật — bà con vẫn tắt được, lưu override localStorage `forfish.mapPrefs.v1` → `vmsOverrides`) · `visible` (admin ẩn/hiện vùng) · `geojson` (jsonb, FeatureCollection **đã giản lược server-side** Douglas–Peucker ~1km khi tải lên) · `sort_order` · `created_by`. Nhập hình vùng bằng **TẢI FILE GeoJSON** (như 3 file SDVico) — client parse (`parseUploadedGeoJSON`) + server giản lược (`simplifyFeatureCollection` ≤200k điểm input). |
| RLS | ĐỌC công khai `visible=true` (vùng tham khảo là nội dung public — app đọc qua `lib/vms-zones.ts` `fetchPublicVmsZones`, lỗi/chưa cấu hình → fallback `STATIC_VMS_ZONES` = 3 vùng mặc định từ `data/vms-zones.json`). GHI/SỬA/XÓA **KHÔNG có policy** — chỉ service-role qua `/api/admin/vms-zones` (**`requireAdmin` — admin-only cứng**, xem 0017). |

- 🔴 **CHƯA apply prod** — chạy migration `0013_vms_zones.sql` (đã seed sẵn 3 vùng mặc định để app không mất vùng đang có). Trước khi apply app vẫn chạy bằng fallback tĩnh (không lỗi).
- Migration seed sinh bởi `scripts/gen-vms-zones-migration.py` từ `data/vms-zones.json`; cung ngoài khơi "được phép" tách bởi `scripts/derive-allowed-offshore.py` — KHÔNG sửa 2 file sinh ra (`vms-zones.json`, migration) bằng tay.

### Danh bạ "Bán ở đâu" — admin quản lý — migration [`0014_sell_contacts.sql`](../../supabase/migrations/0014_sell_contacts.sql) (2026-07-28) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `sell_contacts` | Danh bạ 3 mục CÔNG KHAI của trục Giao dịch (`/tien` → "Bán ở đâu"): **Nậu vựa · Chợ đầu mối · Nhà máy** — admin sửa/ẩn/hiện/xóa/thêm ngay trong `/quan-tri` tab "Chỗ bán", áp dụng NGAY cho app. Thay 3 bộ tĩnh (`data/wholesalers`, `market-channels`, `seafood-buyers`). Cột: `kind` (`vua`/`cho`/`nhamay`) · `name` · `sub_label` (nhãn phụ loại vựa) · `province`/`address`/`phone`/`hours` · `species`/`markets` (jsonb string[]) · `website` · `direct` (nhà máy mua trực tiếp) · `visible` · `sort_order` · `created_by`. **"Mối quen"** (mục thứ 4) vẫn là **localStorage `forfish.buyers.v1` RIÊNG của bà con — KHÔNG vào bảng này.** |
| RLS | ĐỌC công khai `visible=true` (app đọc qua `lib/sell-contacts.ts` `fetchPublicSellContacts`; lỗi/chưa cấu hình/**bảng rỗng** → fallback `STATIC_SELL_CONTACTS` = gộp 3 bộ tĩnh, giữ nguyên hành vi cũ). GHI/SỬA/XÓA **KHÔNG có policy** — chỉ service-role qua `/api/admin/sell-contacts` (**phân quyền** `requirePermission("cho-ban", …)`: GET=view·POST/seed=create·PATCH=edit·DELETE=delete). |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`) — bảng tạo RỖNG, **KHÔNG seed trong SQL** (~143 đầu mối nằm ở `data/*.ts`). App chạy bằng fallback tĩnh cho tới khi admin bấm **"Nạp danh bạ mặc định"** (`POST /api/admin/sell-contacts {action:"seed"}` — chỉ chạy khi bảng rỗng) để đổ dữ liệu tĩnh vào bảng rồi quản lý tiếp.
- **Lộ trình** (thứ tự user chốt 2026-07-28: danh mục → yêu cầu tư vấn → **thông báo** — ĐỦ 3 phần): mở rộng SMS/Zalo là việc SAU nếu cần (chưa yêu cầu).

### Cấu hình ứng dụng (thay env máy chủ) — migration [`0015_app_config.sql`](../../supabase/migrations/0015_app_config.sql) (2026-07-28) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `app_config` (`key` PK, `value`, `updated_by`, `updated_at`) | Cấu hình lưu DB để **KHÔNG lệ thuộc env máy chủ deploy** (Vercel): admin dán khoá trong `/quan-tri` tab **Hệ thống → Cấu hình ứng dụng**, áp dụng NGAY, không cần set env + redeploy. Khoá hiện có (`lib/app-config-keys.ts` `CONFIG_KEYS`): `vapid_public_key` · `vapid_private_key` (secret) · `vapid_subject`. Đọc **DB-TRƯỚC rồi rơi về env cùng tên** (`lib/app-config.ts` `getConfigValue`/`getVapidConfig`, cache 30s) — env cũ vẫn chạy, DB đè lên. `push-send.ts` (`isPushConfigured`/`sendPush`) đọc VAPID qua đây. |
| RLS | Bật, **KHÔNG policy** — chỉ service-role. Client KHÔNG đọc trực tiếp (bảng chứa secret). Xem/ghi qua `/api/admin/app-config` (**`requireAdmin`**, GET che giá trị secret). Khoá PUBLIC lộ riêng qua `GET /api/push/vapid-public-key` (client fetch runtime thay vì nhúng `NEXT_PUBLIC_VAPID_PUBLIC_KEY` lúc build). |

- ✅ **ĐÃ APPLY prod 2026-07-28** — bảng RỖNG (không seed). Chưa dán khoá → `getConfigValue` rơi về env; cả env lẫn DB đều trống → Web Push báo "chưa cấu hình". Helper thuần `resolveConfigCell`/`isConfigKey` (`app-config-keys.ts`) có test.
- **Vì sao đẻ ra**: env VAPID trên Vercel set rồi mà app vẫn báo thiếu (nhiều lần redeploy vẫn lỗi → gần như chắc env không gán đúng môi trường Production / sai tên). Bảng này gỡ hẳn phụ thuộc đó.

### Lịch sử giá cá TÍCH LUỸ — migration [`0016_price_history.sql`](../../supabase/migrations/0016_price_history.sql) (2026-07-29) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `price_history` (PK **`(week_end, species_id)`**; `min_vnd int` · `max_vnd int` · `province` · `source` default `'vasep'` · `created_at`) | KHO lịch sử giá tuần cho **biểu đồ giá kiểu chứng khoán** (Trục 2). Kho bản tin VASEP chỉ giữ ~13 tuần trên listing → muốn lịch sử dài dần phải LƯU. Cron `/api/cron/snapshot-prices` (**Vercel cron `vercel.json` `0 3 * * 6`, thứ Bảy**) gom các tuần VASEP rồi **UPSERT** (idempotent theo PK); tuần cũ rơi khỏi listing vẫn còn ở đây → lịch sử chỉ dài thêm. Ghi qua service-role (`lib/price-history-store.ts` `saveWeeksToDb`); gom nguồn `lib/port-price-archive.ts` `gatherArchiveWeeks` (dùng chung với route fallback). Transform thuần `rowsToWeeks`/`weeksToRows` (`lib/port-price-history.ts`) có test. |
| RLS | Bật + **policy SELECT `using(true)`** — giá THAM KHẢO công khai, ai cũng đọc (kể cả chưa đăng nhập); GHI chỉ service-role. `/api/port-prices/history` ĐỌC kho DB trước (`loadHistoryFromDb`, REST + revalidate 6h), **<2 điểm thì LÙI** về gom kho VASEP trực tiếp → demo mode / chưa apply vẫn có biểu đồ. |

- ✅ **ĐÃ APPLY prod 2026-07-29** (ref `znzgugvfhgmiszqgjulk`) — bảng RỖNG (chưa backfill). Chưa chạy cron → `loadHistoryFromDb` trả rỗng, route lùi về gom kho VASEP trực tiếp = hành vi trước khi có DB (biểu đồ vẫn chạy, chỉ không dài quá ~13 tuần).
- **KÍCH HOẠT còn thiếu**: cron dùng chung env `CRON_SECRET` với refresh-fish (đã có); `SUPABASE_SERVICE_ROLE_KEY` đã có. Chạy trên **Vercel cron** (`vercel.json`, thứ Bảy) — Vercel Cron tự gắn `Authorization: Bearer CRON_SECRET`. ⚠️ Đây là cron THỨ 3 → **Hobby chỉ cho 2 cron/dự án**, cần Pro (hoặc chờ đến thứ Bảy đầu tiên để backfill; muốn ngay thì gọi tay endpoint với header Bearer).

### Phân quyền tài khoản quản lý — migration [`0017_staff_permissions.sql`](../../supabase/migrations/0017_staff_permissions.sql) (2026-07-30) — ⚠️ CHƯA APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| `customers.staff_permissions jsonb` (nullable) | Bảng quyền của một **QUẢN LÝ** (`role='manager'`): `{tab: {view,create,edit,delete}}` trên **5 tab được phép** — `tai-khoan · san-pham · canh-bao · thong-bao · cho-ban`. **NULL = preset mặc định** (quản lý mới: xem+tạo+sửa, KHÔNG xóa). Chỉ service-role (`/api/admin/staff`) ghi. |

- **Vai trò nâng cấp** từ nhị phân → **tab × hành động**. Luật THUẦN (client-safe, có test) ở [`src/lib/staff-permissions.ts`](../../src/lib/staff-permissions.ts): `MANAGER_TABS`, `PERM_ACTIONS` (view/create/edit/delete), `DEFAULT_MANAGER_PERMISSIONS`, `normalizePermissions` (fail-closed: thiếu tab/cờ → false; null/rác → preset), `can`, `visibleTabs`.
- **4 tab admin-only CỨNG** (không nằm trong bảng quyền, không bao giờ hiện cho quản lý): `yeu-cau` (product-inquiries) · `vung-bien` (vms-zones) · `du-lieu` · `he-thong`. Hai route product-inquiries + vms-zones đổi `requireStaff`→`requireAdmin`.
- **Chốt thật SERVER**: mỗi route `/api/admin/*` gọi `requirePermission(tab, action)` (`lib/admin-auth.ts`) — admin bỏ qua, manager tra bảng. Map: accounts GET=view · POST(khách)=create · PATCH grant=edit · DELETE=delete (downgrade + reset-password + tạo tài khoản QUẢN LÝ vẫn **admin-only cứng**); products/crew-reports/sell-contacts GET=view·POST=create·PATCH=edit·DELETE=delete; push GET=view·POST=create.
- **Soạn quyền**: tab **Phân quyền** trong `/quan-tri` (admin-only) → `/api/admin/staff` **GET** (liệt kê quản lý + bảng quyền chuẩn hoá) · **PATCH** `{phone, permissions}` (ghi bảng). UI ẩn/hiện tab + nút theo `me.permissions` từ `/api/admin/health`.
- **Chưa apply cột thì AN TOÀN**: `requireStaff` tra `staff_permissions` trong try/catch riêng → cột chưa có ⇒ quản lý vẫn vào được với **preset mặc định** (không bị coi là "không phải staff"). Ghi quyền (`PATCH /api/admin/staff`) khi cột chưa có → trả `migration_needed`, UI báo cần apply 0017.
- ✅ **ĐÃ APPLY prod 2026-07-30** (ref `znzgugvfhgmiszqgjulk`). Trước khi apply: quản lý cũ chạy theo preset mặc định; tab Phân quyền hiện cảnh báo `migrationNeeded`.

### Ghi chú theo dõi onboarding khách — migration [`0018_customer_staff_notes.sql`](../../supabase/migrations/0018_customer_staff_notes.sql) (2026-07-30) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| `customers.staff_used boolean default false` | Khách **ĐÃ SỬ DỤNG** app hay chưa (staff đánh dấu) |
| `customers.staff_guided boolean default false` | SDVICO đã **HƯỚNG DẪN TRỰC TIẾP** chưa |
| `customers.staff_note_by text` · `staff_note_at timestamptz` | SĐT staff + mốc cập nhật cờ gần nhất (đối soát) |

- Cờ theo dõi NỘI BỘ của SDVICO — **không đụng luồng khách/premium**. Đọc trong `GET /api/admin/accounts` (map `staffUsed`/`staffGuided`/`noteBy`/`noteAt`); ghi qua `PATCH action='set-flags'` (`{used?,guided?}`) cần cờ **`tai-khoan:edit`** — chỉ vá cờ được gửi, ghi kèm `staff_note_by`/`staff_note_at`, **KHÔNG đụng `updated_at`** (khỏi làm sai nhịp webhook). UI: 2 chip bật/tắt mỗi hàng khách trong tab Tài khoản (sửa được khi có edit; chỉ xem thì hiện badge trạng thái).
- Cột đọc được qua RLS bởi chính chủ (customers self-select) nhưng KHÔNG nhạy cảm (tình trạng onboarding của chính họ); app khách không hiển thị.

### Nhật ký hoạt động admin — migration [`0019_admin_activity_log.sql`](../../supabase/migrations/0019_admin_activity_log.sql) (2026-07-30) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `admin_activity_log` (`id` · `actor_phone` · `actor_role` · `action` · `target` · `detail jsonb` · `created_at`; index theo created_at desc / actor / action) | LOG **APPEND-ONLY** mọi thao tác GHI/XÓA của staff trên `/quan-tri` → soát "ai làm gì, lúc nào" (chống thao tác bậy). RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi |

- **Mã hành động + nhãn**: `src/lib/admin-activity.ts` (THUẦN, client-safe, có test) — `ADMIN_ACTIONS` (`account.create/grant/downgrade/reset-password/set-flags/delete` · `product.*` · `crew.*` · `sell.*` · `push.send` · `inquiry.*` · `zone.*` · `staff.set-permissions`), `ACTION_LABEL` (test bắt buộc mọi mã có nhãn), `isDangerAction` (xóa/reset/hạ hạng/đổi quyền → UI tô đỏ).
- **Ghi log**: helper `src/lib/admin-activity-log.ts` `logActivity(admin, {...})` — log hỏng KHÔNG chặn thao tác chính, nhưng **KHÔNG im lặng** (sửa 2026-07-31): đọc `{ error }` của supabase-js, `console.error("[activity-log] …")` (thấy ở Vercel Logs) và trả boolean. ⚠️ Bản đầu chỉ `await insert()` trong try/catch — supabase-js KHÔNG ném lỗi mà TRẢ error, nên mọi lần ghi hỏng biến mất không dấu vết (prod 31/7: 2 lượt cấp premium mà bảng vẫn 0 dòng; DB đã loại trừ — probe insert bằng service_role chạy được, grants/policy giống hệt `premium_grants`). Gọi ở MỌI mutation của `/api/admin/*` sau khi thành công. **KHÔNG log bí mật** (mật khẩu/token; crew: không log CCCD/SĐT — chỉ loại vấn đề).
- **Đọc**: `GET /api/admin/activity` (**`requireAdmin`** — chỉ quản trị viên) trả tối đa 300 dòng mới nhất, lọc `?actor=` (khớp SĐT) & `?action=`; đọc hỏng → rỗng + `migrationNeeded` + `error{code,message,hint}` THẬT. **`POST`** (requireAdmin) = GHI THỬ một dòng `system.log-probe` rồi đếm lại → nút "Kiểm tra ghi nhật ký" ở tab Nhật ký (biết log câm hay không mà không phải đợi thao tác thật). UI: tab **Nhật ký** (admin-only) — tìm theo SĐT/tên thao tác + chọn loại + nút "Chỉ xóa/nhạy cảm".
- ✅ **ĐÃ APPLY prod 2026-07-30** (ref `znzgugvfhgmiszqgjulk`).

### Hộp thư + biên nhận thông báo — migration [`0023_push_messages_receipts.sql`](../../supabase/migrations/0023_push_messages_receipts.sql) (2026-08-01) — ✅ ĐÃ APPLY prod

| Bảng | Nghĩa |
|---|---|
| `push_messages` (`id` · `title` · `body` · `url` · `target` `all\|account` · `target_phone` · `sent_by` · `devices` · `sent` · `created_at`) | MỘT DÒNG mỗi lần gửi. Ghi **TRƯỚC khi đẩy** nên tin vẫn còn kể cả đẩy hụt |
| `push_receipts` (`message_id` × `endpoint` · `account_phone` · `delivered_at` · `opened_at`) | Biên nhận THẬT từ máy bà con |

- **Vì sao**: (a) thông báo vuốt tắt là MẤT — ngư dân tay ướt dễ vuốt nhầm, tin bão biến mất không dấu vết; (b) trước chỉ biết "đã đẩy tới Apple/Google", không biết máy có nhận không.
- **Biên nhận đo bằng gì**: service worker CHẠY THẬT trên máy — nhánh `push` gọi `POST /api/push/ack` (`delivered`), `notificationclick` gọi (`opened`, ghi cả hai mốc vì bấm được nghĩa là đã nhận). Không đòi đăng nhập (tin tới lúc app đóng, không chắc có phiên); khoá là cặp `(messageId, endpoint)`, biết endpoint máy khác cũng chỉ đánh dấu hộ, không đọc được nội dung.
- **Hộp thư**: `GET /api/me/messages` (lọc phía SERVER theo phiên) trả tin `target='all'` + tin nhắm đúng tài khoản, ≤50 tin mới nhất. **KHÔNG cho SW cache** (route gắn danh tính, không nằm trong `API_CACHE_ALLOW`); bản offline ở `localStorage forfish.inbox.v1` **mang theo SĐT chủ nhân**, SĐT lệch → coi như trống, và **xoá khi đăng xuất** — máy dùng chung trên tàu.
- **UI**: trang chủ mục **Thông báo** ngay dưới "Bốn việc chính" — 3 tin gần nhất, bấm mở tin cũ hơn; tự ẩn khi chưa đăng nhập/chưa có tin. `/quan-tri` tab Thông báo có **10 tin gần nhất + cột máy · đẩy · nhận · đọc**.
- ✅ **ĐÃ APPLY prod 2026-08-01** (ref `znzgugvfhgmiszqgjulk`).

### Đọc trong app cũng là đọc — migration [`0024_push_reads.sql`](../../supabase/migrations/0024_push_reads.sql) (2026-08-01) — ✅ ĐÃ APPLY prod

| Bảng | Nghĩa |
|---|---|
| `push_reads` (`message_id` × `reader` · `account_phone` · `read_at`) | Bà con đã ĐỌC tin, đếm theo **người** |

- **Vì sao**: 0023 chỉ ghi `opened_at` ở nhánh `notificationclick` ⇒ **chỉ** đếm khi bấm vào banner. Nhưng đường đọc phổ biến nhất là liếc trên màn khoá rồi vuốt tắt, hoặc mở app xem mục Thông báo — cả hai không ghi gì, nên `/quan-tri` hiện **"đọc 0" vĩnh viễn** dù tin đã tới mắt. Số dối hại hơn không có số: người gửi tin bão sẽ tưởng tin không tới mà gửi lại, hoặc kết luận sai là bà con không quan tâm.
- **Đơn vị đếm — cố ý khác nhau**: `push_receipts` đếm theo **MÁY** (đo việc *giao tin*), `push_reads` đếm theo **NGƯỜI** (đo việc *đọc*) — một người hai máy đọc một tin vẫn là một người đọc. Khoá `reader` = `sdt:<SĐT>` khi đã đăng nhập (máy chủ tự lấy từ phiên), `may:<endpoint>` khi chưa (hộp thư mở cho cả khách). `/api/admin/push` **GỘP** hai nguồn về cùng dạng khoá rồi đếm số khoá khác nhau, nên bấm banner xong lại mở app đọc chỉ tính một.
- **Mốc đọc đo ở đâu**: `POST /api/me/messages/read` — `InboxSection` quan sát bằng `IntersectionObserver`, thẻ tin lọt ≥50% vào màn hình thì tính là tới mắt (thẻ hiện sẵn cả nội dung, không có gì để "mở ra"; tin sau nút "Xem N tin cũ hơn" chưa vẽ nên không bị tính). Gom 1,2 s một cú. Ghi bằng `upsert ignoreDuplicates` — **lần đầu** đọc mới là mốc có nghĩa.
- **Lỗi kèm theo đã sửa**: `notificationclick` trong `public/sw.js` bắn ack **ngoài** `event.waitUntil` ⇒ trình duyệt được phép giết service worker ngay khi mở xong cửa sổ, cắt request đang bay (iOS giết SW rất mạnh lúc PWA lên foreground) — bà con CÓ bấm mà cột "đọc" vẫn không lên. Nay `waitUntil(Promise.all([focus, ack]))`, test đọc thẳng `sw.js` chống tái phát.
- **⚠️ ẢNH HƯỞNG OFFLINE**: biên nhận là **thống kê**, không phải dữ liệu bà con cần. Client bỏ qua hẳn khi `navigator.onLine === false`, timeout 8 s, nuốt mọi lỗi, và **chỉ ghi vào bản lưu khi máy chủ đã xác nhận** ⇒ hỏng thì lần mở app sau có sóng báo lại, không mất luôn. Không đụng `SHELL`/danh sách cache; route là POST nên SW vốn bỏ qua. Khoá mới `forfish.inbox.read.v1` mang theo SĐT chủ nhân và bị `clearInbox()` xoá lúc đăng xuất — cùng luật cách ly tài khoản với `forfish.inbox.v1`.
- **Đường lùi nếu bảng chưa có**: supabase-js **trả** `error` chứ không ném ⇒ `reads` về rỗng, cột "đọc" tụt về đúng nguồn bấm-banner như cũ; app phía bà con không hỏng gì (route read trả 500, client nuốt lỗi và báo lại lần sau).
- ✅ **ĐÃ APPLY prod 2026-08-01** (ref `znzgugvfhgmiszqgjulk`) — kiểm lại sau khi chạy: bảng có · `rls=true` · **0 policy** (chỉ service-role) · 0 dòng.

### Đo thật việc dùng app — migration [`0021_customer_app_usage.sql`](../../supabase/migrations/0021_customer_app_usage.sql) (2026-08-01) — ✅ ĐÃ APPLY prod

| Cột mới trên `customers` | Nghĩa |
|---|---|
| `pwa_last_open_at` | Lần cuối mở ở **chế độ đã cài** (standalone). **NULL = chưa bao giờ mở bản cài** — đây là con số đáng nhìn nhất |
| `web_last_open_at` | Lần cuối mở trong tab trình duyệt thường |
| `offline_ready_at` | Lần cuối máy tự báo ĐỦ ĐỒ ĐI BIỂN = vỏ app cài đủ (`shell-ready`) **và** mọi lớp dữ liệu đã tải (`savedCoverage.allSaved`) |
| `data_until` (migration [`0025_customer_data_until.sql`](../../supabase/migrations/0025_customer_data_until.sql), 2026-08-02 — ✅ ĐÃ APPLY prod) | **Dữ liệu đi biển trong máy phủ tới NGÀY NÀO** (`date`). Ba cột trên chỉ nói "đã từng mở / đã từng đủ"; cột này trả lời câu người trực tổng đài cần nhất: *máy này ra khơi ngày mai thì trong tay bà con có dự báo tới đâu*. NULL = chưa bao giờ báo được |

- **Vì sao**: chip "đã/chưa sử dụng" (0018) là nhân viên TỰ TICK — niềm tin, không phải số đo. Thứ cần biết là **ai đã cài mà chưa bao giờ mở BẢN CÀI**: trên iPhone kho của bản A2HS tách riêng với Safari, nhóm đó ra khơi với máy trắng tay (ca TC-13 trong [ops/qa-offline-acceptance.md](ops/qa-offline-acceptance.md)). Danh sách để GỌI ĐIỆN NHẮC.
- **Ghi**: `POST /api/me/heartbeat` (đăng nhập mới ghi; chưa đăng nhập → `recorded:false`, KHÔNG lỗi). Chỉ ghi MỐC + CHẾ ĐỘ — **không vị trí, không thao tác**. KHÔNG đụng `updated_at` (cột đó là mốc dữ liệu khách đổi; heartbeat ghi vào là mọi tài khoản trông như vừa sửa mỗi lần mở app).
- **Client** `src/lib/heartbeat.ts` + luật thuần dùng chung hai phía `src/lib/heartbeat-policy.ts` — hàng rào offline: mất sóng thì KHÔNG gọi · đồng hồ chặn 5 giây qua `timeoutSignal` (`lib/abort.ts` — **không** gọi thẳng `AbortSignal.timeout`: Safari 15 ném `TypeError` ngay trong `try`, nhịp chết câm mà vẫn trả đủ giá quét kho) + `.catch` nuốt sạch · gọi trong `useEffect` sau 3s, không `await` ở đường vẽ màn. Là POST nên service worker bỏ qua hẳn.
- ⚠️ **CỔNG RẺ TRƯỚC, QUÉT KHO SAU** (sửa 2026-08-02e): chỗ gọi phải dựng đủ payload trước khi hỏi `sendHeartbeat`, mà hai mảnh của payload (`isShellReady()` = 34 lượt `caches.match`; `savedCoverage()` = 11 lượt `loadAll` + 9 lượt `bytesUnder`, riêng `bytesUnder("")` dựng lại toàn bộ chuỗi) đều **quét sạch kho offline trên LUỒNG CHÍNH** — trong khi mọi hàng rào lại nằm BÊN TRONG `sendHeartbeat` và gần như luôn chặn. Kết quả: mỗi lần mở/quay lại app là ~33 MB `JSON.parse` rồi vứt đi, Android rẻ khoá màn 0,5–1,5 giây. Nay `heartbeatNeedsScan` (thuần, có test) trả lời trước bằng **ba mảnh RẺ của chữ ký** (tài khoản · web/bản cài · mã máy), `false` thì hẹn lại rồi thôi. **Đánh đổi chủ dự án chấp nhận**: sự kiện *"vừa đủ đồ đi biển"* (mảnh đắt) trễ tối đa 30 phút; ba sự kiện còn lại vẫn đi ngay. Cùng lúc: `visibilitychange`/`online` cũng đi qua độ trễ 3 giây (trước gọi thẳng, bỏ qua chính độ trễ file đó đặt ra — mà bản cài PWA không remount nên đó là đường vào phổ biến nhất), và có cờ `inFlight` chống hai lượt quét chạy chồng.
- ⚠️ **CẦU DAO KHI MÁY CHỦ NỔ 5xx** (thêm 2026-08-02e): 5xx không ghi chữ ký ⇒ `pending` mãi true ⇒ nhịp mãi là "sự kiện" ⇒ bám 5 phút/lần **vĩnh viễn**; và mỗi lần đổi khuôn chữ ký (gần nhất: thêm `|deviceId`) là TOÀN BỘ máy đang chạy vào trạng thái "có sự kiện chờ" ngay sau deploy ⇒ máy chủ nổ lần nữa = 717 máy × 12 request/giờ. Nay đếm riêng 5xx liên tiếp (`forfish.heartbeat.5xx.v1`); quá `EVENT_5XX_GIVEUP` = 5 thì `eventDegradedToState` hạ nhịp sự kiện về **nhịp định kỳ** (trần 30 phút). **Tin không mất** — chữ ký vẫn chưa ghi, chỉ chậm lại; máy chủ trả lời được một lần là nhả cầu dao.
- ⚠️ **ROUTE KHÔNG ĐƯỢC NUỐT LỖI CÂM** (sửa 2026-08-02e): route này từng có **0 dòng `console`** — `write_failed` trả HTTP 200, và `upsert` vào `customer_devices` vứt luôn `error` (supabase-js **không ném** với lỗi Postgres/RLS, nó *trả về* `{ error }`) ⇒ bảng chưa tồn tại / cột lạ / RLS chặn đều im lặng tuyệt đối, đường phát hiện duy nhất là chủ dự án tình cờ mở /quan-tri. Nay cả hai chỗ `console.error`. **Vẫn giữ HTTP 200** cho `write_failed`: client đọc `recorded`/`need` chứ không đọc status, đổi sang 5xx là đẩy chính client vào nhánh cầu dao ở trên. Cổng chặn khuôn: `src/lib/__tests__/api-silent-catch.test.ts` (cấm `catch {}` không có `console` trong mọi route).
- ⚠️ **HAI LOẠI NHỊP, KHÔNG PHẢI MỘT CỬA THỜI GIAN** (chủ dự án chốt 2026-08-02d). **Mất sóng → không có nhịp nào**: đây là luồng RIÊNG, chạy độc lập, KHÔNG cần heartbeat, KHÔNG cần máy chủ; có sóng lại thì nhịp mới bắt đầu. **Có sóng** thì tách đôi theo BẢN CHẤT: ① **nhịp SỰ KIỆN** (đổi tài khoản · web→bản cài · vừa đủ đồ đi biển · **đổi mã máy**) gửi NGAY rồi **bám 30 giây → 3 phút → 5 phút cho tới khi máy chủ xác nhận GÁN ĐƯỢC**; ② **nhịp ĐỊNH KỲ** 30 phút báo trạng thái hiện giờ (gồm `data_until`), lỡ lượt thì lượt sau bù, thang lùi 1→5→15→30 phút và không bao giờ thưa hơn nhịp khoẻ. Cửa 12 giờ cũ bỏ hẳn — nó sinh ra từ nỗi lo tốn sóng ngoài biển, mà nỗi lo đó nay do luồng offline gánh (*"4G 5G khắp nơi rồi, heartbeat thì nhẹ"*).
- ⚠️ **MÁY CHỦ PHẢI TRẢ LỜI CÓ THỂ HÀNH ĐỘNG ĐƯỢC** — chặn vòng lặp vô ích: `attached` (đã gán vào hàng khách chưa) + `need` (`retry` bám tiếp · `login` chưa có phiên nên DỪNG bám · `wait_admin` không có hàng khách mang SĐT này, việc của người ở bờ nên DỪNG bám · `none` xong) + `nextInMs` (máy chủ xếp lịch, máy **kẹp về [30 giây, 6 giờ]** trước khi nghe). `nextInMs` là chiều ngược DUY NHẤT của kênh này — một con số điều tiết, KHÔNG phải kênh lệnh.
- ⚠️ **`data_until` chỉ đi theo nhịp ĐỊNH KỲ, cố ý KHÔNG vào chữ ký sự kiện**: ngày này đổi sau mỗi lượt tải, đưa vào chữ ký là biến mọi lượt tải thành một "sự kiện" và máy bắn nhịp liên tục. Client khai gì máy chủ cũng ép qua `normalizeDataUntil` (thuần, có test) — chuỗi rác lọt xuống cột `date` là **cả lệnh update hỏng**, mất luôn 3 mốc đang chạy tốt (đúng khuôn lỗi cột 0022 đã dính một lần).
- ⚠️ **`data_until` đo HAI LỚP CỐT LÕI, không phải một** (sửa 2026-08-02e): client trước đây gửi lên `savedCoverage().untilIso`, mà trường đó chỉ duyệt lớp **điểm ghim**. Sai cả hai chiều và cả hai chiều đều sai về phía NGUY HIỂM — (a) lưới CẢ VÙNG bị dọn mà điểm ghim còn ⇒ /quan-tri báo "tới 18/08" trong khi thứ bà con mở ra giữa biển đã mất; (b) lớp `point` là **bậc hy sinh đầu tiên** khi máy hết chỗ nên nó bị dọn trước ⇒ `untilIso = null` ⇒ route bỏ qua (`if (savedUntil)`) ⇒ cột **giữ nguyên con số cũ đã lỗi thời**. Nay client gửi `coreSavedUntil(savedGridUntil(), cov.untilIso)` (`lib/heartbeat.ts`, thuần, có test): ngày **SỚM NHẤT** giữa lưới cả vùng và điểm ghim, `null` khi thiếu một trong hai. `cov.untilIso` KHÔNG đổi nghĩa — chip màn Ra khơi vẫn dùng nó đúng nghĩa "điểm ghim".
- ⚠️ **CỬA 12 GIỜ CHỈ ĐÓNG KHI GHI ĐƯỢC THẬT** (sửa 2026-08-01g): bản đầu ghi dấu TRƯỚC khi gửi và không ai đọc `recorded` ⇒ một lần hỏng là im nửa ngày, và hỏng vĩnh viễn cũng im lặng. Hai lỗi ghép lại: (a) client coi "gửi đi" = "ghi được"; (b) route coi `update().eq()` **khớp 0 hàng** = thành công (Supabase trả `error = null`) nên SĐT không khớp `customers.phone` là hỏng mãi mà vẫn báo ổn. Nay route `.select("phone")` để đếm hàng thật và trả `reason` (`no_session` · `no_customer_row` · `write_failed`, KHÔNG kèm SĐT); client chỉ ghi mốc thành công khi `recorded === true`. Mức hoãn tách sang `forfish.heartbeat.retry.v1` + bộ đếm `forfish.heartbeat.fails.v1`: mất sóng thì vẫn KHÔNG gửi gì; máy đang online mà không nghe được máy chủ trong **5 giây** → thang lùi **30 giây → 3 phút → 5 phút → 12 giờ** (`netBackoffMs`, thuần, có test) và `UsageHeartbeat` tự hẹn giờ thử lại theo thang; máy chủ có trả lời mà chưa ghi được → 30 phút.
- ⚠️ **TIN MỚI ĐI NGAY, KHÔNG CHỜ CỬA 12 GIỜ** (sửa 2026-08-01h): cửa 12 giờ gác theo *thời gian* nhưng thứ cần báo là *trạng thái đã đổi*, nên nó chặn nhầm đúng hai chuyển biến quan trọng — **web → bản cài** (trên Android bản cài dùng chung kho với Chrome ⇒ mở web rồi mở bản cài ngay sau đó thì `pwa_last_open_at` mãi `null`) và **chưa đủ đồ → đủ đồ đi biển** (tải xong lúc 15:00 thì `offline_ready_at` trống tới 03:00 sáng hôm sau — cột an toàn). Nay `beatSignature` (thuần, có test) rút nhịp thành `w-`/`wr`/`p-`/`pr`; khác chữ ký lần ghi được gần nhất thì gửi ngay. Mất sóng và mức hoãn-vì-mạng vẫn chặn trước — tin mới KHÔNG vượt được hai hàng rào đó.
- **Đọc**: `/quan-tri` tab Tài khoản, chip `AppUsage` cạnh chip staff: **"Bản cài · <giờ>"** (xanh) hoặc **"CHƯA mở bản cài"** (vàng, tooltip giải thích kho A2HS tách riêng), + **"Đủ đồ đi biển · <giờ>"**.
- ⚠️ **THANG MỘT CHIỀU: web → bản cài → tải đủ** (siết 2026-08-01j, chủ dự án chốt: *"1 chiều thôi… nếu không PWA thì nó cứ nằm ở Web để đảm bảo họ có PWA"*). `offline_ready_at` **chỉ ghi khi nhịp gửi TỪ BẢN CÀI, mọi nền** — luật ở `src/lib/app-usage.ts` `countsAsOfflineReady` (thuần, có test). Gốc: iOS cho bản A2HS kho RIÊNG tách Safari nên tải đủ trong Safari không chứng minh gì cho bản cài (2026-08-01f). Bản đó **miễn cho Android** vì bản cài ở Android dùng chung kho với Chrome — xét về DỮ LIỆU thì đúng, nhưng thang này là **danh sách GỌI ĐIỆN**: người Android tải đủ trong tab nhảy thẳng lên bậc cao nhất (`usageCallPriority` 3 "yên tâm nhất") và rơi khỏi danh sách nhắc cài, dù màn hình chưa có icon nào — mà tab Chrome dễ bị dọn hơn bản cài và `persist()` cũng khó được cấp hơn. Nay bậc "đủ đồ" **không có đường tắt**. Cờ `ios` đã BỎ khỏi payload (thừa — `platform` mang thông tin đó).

### Máy của khách + lịch sử đổi máy — migration [`0022_customer_device_platform.sql`](../../supabase/migrations/0022_customer_device_platform.sql) (2026-08-01) — ✅ **ĐÃ APPLY prod 2026-08-01** (ref `znzgugvfhgmiszqgjulk`; advisor: `customer_devices` báo `rls_enabled_no_policy` mức INFO — ĐÚNG THIẾT KẾ, sổ nội bộ chỉ service-role, y như `premium_grants`/`admin_activity_log`)

| Cột/bảng | Nghĩa |
|---|---|
| `customers.device_platform` | Loại máy ĐANG dùng: `ios` \| `android` \| `khac`. Chip ở /quan-tri để nhân viên gọi điện chỉ ĐÚNG bước cài (iPhone: Chia sẻ → Thêm vào Màn hình chính; Android: Cài ứng dụng) |
| `customers.device_id` | Mã máy ĐANG dùng (app tự sinh, `forfish.device.v1`). Nhịp đến từ mã KHÁC ⇒ server **xoá `pwa/web/offline_ready`** rồi ghi lại theo máy mới |
| bảng `customer_devices` | **LỊCH SỬ**: mỗi `(customer_phone × device_id)` một hàng — `platform` · `first_seen_at` · `last_seen_at` + 3 mốc RIÊNG của máy đó. RLS bật, **KHÔNG policy** = chỉ service-role (y như `premium_grants` 0004) |
| `customer_devices.data_until` (0025) | Ngày phủ dữ liệu của **riêng máy đó**. ⚠️ **NÓI THẬT: cột này ĐƯỢC GHI (từ 2026-08-02e) nhưng CHƯA CÓ MÀN NÀO ĐỌC** — `GET /api/admin/accounts` chưa join `customer_devices`, nên lời hứa của migration 0025 (*"đổi điện thoại vẫn tra được máy cũ tải tới đâu"*) mới xong một nửa. Trước 2026-08-02e thì cột này **không ai ghi và cũng không ai đọc**: upsert trong route heartbeat quên hẳn trường đó, `grep data_until src/` chỉ ra 6 chỗ và đều đọc trên `customers`. Đừng để doc hứa một tính năng chưa có |

- **Vì sao `device_id`**: 3 cột mốc của 0021 nằm trên `customers` nên tích luỹ theo **TÀI KHOẢN, không theo MÁY**. Đổi từ iPhone (đã mở bản cài) sang Android (chỉ mở web) thì `pwa_last_open_at` cũ vẫn nằm đó ⇒ /quan-tri báo "Đã mở bản cài" cho cái máy **chưa bao giờ** mở bản cài.
- **KHÔNG phải dấu vân tay**: `device_id` do app sinh NGẪU NHIÊN rồi cất trong máy — không phải IMEI/serial, không suy từ user-agent/màn hình/phần cứng; xoá dữ liệu web là mất, và không nhận ra được máy đó ở trang nào khác. `device_platform` chỉ 3 giá trị thô — **không** user-agent, model, độ phân giải, RAM (ghép lại là nhận diện được từng máy). Vẫn không vị trí, không thao tác.
- **Đường lùi khi cột chưa có** (giữ lại, vẫn cần cho bản deploy cũ đang chạy dở và cho môi trường chưa migrate): route heartbeat thử ghi kèm cột mới, lỗi thì ghi lại **bộ cũ** (nhét cột chưa tồn tại vào là hỏng CẢ lệnh ⇒ mất luôn 3 mốc đang chạy tốt); `GET /api/admin/accounts` cũng thử `device_platform` rồi lùi về bộ cột cũ (hỏng câu select là mất trắng danh sách 700+ khách vì một chip phụ); ghi `customer_devices` bọc `try/catch` — sổ phụ hỏng KHÔNG được làm hỏng nhịp.
- `deviceId` rỗng (storage bị chặn / chế độ riêng tư) → **KHÔNG reset gì**: thà số liệu cũ còn hơn xoá mốc mỗi lần mở app. Kiểm hình dạng bằng `isValidDeviceId` (thuần, có test) trước khi cho xuống DB.
- **Đọc thành BẬC THANG**: `usageStage()` → `chua-ghi-nhan` (chưa gửi nhịp — KHÔNG có nghĩa chưa dùng app) → `moi-vo-web` (mở web, chưa mở bản cài — **nhóm gọi điện trước tiên**) → `da-mo-ban-cai` → `du-do-di-bien`. `usageCallPriority()` xếp ai gọi trước. Cột `staff_used` (0018) vẫn còn trong DB nhưng ĐÃ GỠ khỏi màn — máy đo thật thay cho nhân viên tự tick.
- ✅ **ĐÃ APPLY prod 2026-08-01** (ref `znzgugvfhgmiszqgjulk`).

### Quản trị viên nguồn DB — migration [`0020_role_admin.sql`](../../supabase/migrations/0020_role_admin.sql) (2026-07-31) — ⚠️ CHƯA APPLY (prod đã sẵn đúng, file này để đồng bộ repo)

| Thay đổi | Nghĩa |
|---|---|
| `customers_role_check` nới thành `('customer','manager','admin')` | `role='admin'` **là quản trị viên thật** từ 2026-07-31 (`requireStaff` đọc, toàn quyền, `permissions=null`) — trước đó giá trị này vô tác dụng vì code chỉ đọc `'manager'` |

- **HAI NGUỒN ADMIN** (user chốt 2026-07-31): env `ADMIN_PHONES` **HOẶC** `customers.role='admin'`. Nguồn DB để thêm/bớt quản trị viên ngay trên web (đổi là ăn ngay, không deploy); **env giữ lại làm CỬA CỨU HỘ** — web KHÔNG hạ được admin từ env, phòng khi DB bị hạ nhầm hết (không thì phải vào Supabase chạy SQL tay).
- **Luật thuần** (`src/lib/admin.ts`, có test): `mergeAdmins(env, db)` (gộp không trùng, env thắng) · `checkDemoteAdmin` chặn 3 ca — `self` (tự hạ mình) · `env_admin` (web không sửa env) · `last_admin` (hạ mất người cuối = khoá cửa cả nhà) · `checkSetRole` = luật đầy đủ cho một lần đổi vai: **NÂNG lên admin LUÔN được** kể cả SĐT đang lấy quyền từ env — đó là ĐƯỜNG DI CƯ env → DB (ghi quyền vào tài khoản, kiểm tra vào được, rồi mới xoá khỏi `ADMIN_PHONES`); chỉ HẠ mới qua 3 chốt.
- **Nâng/hạ**: `PATCH /api/admin/staff` `{action:"set-role", phone, role}` (**`requireAdmin`**), ghi nhật ký `staff.set-role` (đánh dấu nhạy cảm). UI: tab **Phân quyền** → khối "Quản trị viên · toàn quyền" (mỗi người ghi rõ nguồn `từ env` / `từ tài khoản`, nút Hạ chỉ hiện với nguồn DB) + ô nhập SĐT "Nâng lên quản trị viên", cả hai qua `ConfirmDialog`.
- ⚠️ **LỆCH SCHEMA đã có từ trước**: prod được sửa tay nên ràng buộc thật đã nhận `'admin'` (hàng `0900000001` đang mang giá trị này) trong khi `0004` trong repo chỉ có 2 giá trị. `0020` kéo repo về đúng prod; chạy trên prod là no-op.

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

- **Đăng nhập**: SĐT + mật khẩu — `supabase.auth.signInWithPassword({ email: {SĐT}@sdvico.local, password })` trên project SDFish (`/login`). Lần đầu (`user_metadata.must_change_password=true` do webhook đặt) → ép `/doi-mat-khau`. KHÔNG OTP, KHÔNG email confirm, KHÔNG SSO-CRM. SĐT helper thuần `src/lib/phone.ts` (tách `auth-form.tsx`). **1 TÀI KHOẢN = 1 MÁY (2026-07-29)**: đăng nhập xong gọi `signOut({ scope: 'others' })` thu hồi phiên mọi máy khác — máy cũ rớt ở lần `getUser()`/refresh kế (middleware + `use-auth` đều gọi getUser nên rớt ngay lần mở app sau); lỗi thu hồi KHÔNG chặn đăng nhập.
- **Đổi mật khẩu** (`/doi-mat-khau`, sửa 2026-07-29): 2 ngả — ÉP lần đầu (không hỏi mật khẩu hiện tại, khách vừa gõ ở /login) + TỰ NGUYỆN từ sheet Tài khoản (xác thực lại mật khẩu hiện tại bằng `signInWithPassword` rồi mới cho đổi). Đổi = `updateUser({ password, data: { must_change_password: false } })` — tắt cờ NGAY TRÊN user_metadata (fix bug cũ ghi vào bảng `profiles` KHÔNG TỒN TẠI → cờ không bao giờ tắt, bị ép đổi mãi). Đổi xong cũng `signOut({ scope: 'others' })`.
- **Provision tài khoản**: webhook customer event kèm `password` → `admin.auth.admin.createUser({email, password, email_confirm:true, user_metadata:{must_change_password:true}})`. ĐÃ tồn tại → bỏ qua (KHÔNG ghi đè mk KH đã đổi). Mật khẩu KHÔNG lưu bảng `customers` (chỉ set trên auth user, Supabase hash). **Reset mật khẩu (LÀM 2026-07-29)**: `/api/admin/accounts` PATCH `action='reset-password'` — CHỈ admin (`requireAdmin`), `admin.auth.admin.updateUserById` về mật khẩu tạm cố định **sd123456** (`lib/temp-password.ts`, user chốt) + bật lại `must_change_password` (giữ nguyên metadata khác — updateUserById ghi đè cả object nên phải spread). Phiên cũ của khách không thu hồi được từ server (supabase-js chưa có admin signOut theo id) — lần đăng nhập mới của khách tự đá.
- **Nạp dữ liệu**: `POST /api/sdwork/webhook` — verify **HMAC SHA-256** (header `x-sdwork-signature`, env `SDWORK_WEBHOOK_SECRET`) trên raw body → upsert customers/devices/supplies bằng admin client. Map thuần `src/lib/sdwork-webhook.ts` (`toCustomerRow/toDeviceRow/toSupplyRow`, chuẩn hoá SĐT, idempotent `sdwork_ref`) — có test. Response trả `results[]` per-event (`ref`, `ok`, `code?`, `provisioned?`) + `applied` count → SDWork đối soát chính xác từng event, không câm khi 1 hàng lỗi.
- **Đọc**: `/api/me/sdvico` đọc **bảng SDFish** (RLS theo `current_phone()`) thay `fetchOwnedAssets` gọi CRM. `use-sdvico-assets` giữ interface (4 nấc + `OwnedAssets`).
- **Hợp đồng webhook**: [sdwork-sso-contract.md](../integration/sdwork-sso-contract.md) (event types/payload/HMAC + password).
- **Ngoài Đợt 1**: apply migration prod 🔴 · bật webhook + cron đối soát · ~~reset mật khẩu~~ (ĐÃ LÀM 2026-07-29 qua `/quan-tri`, xem bullet Provision) · retire §6 (gateway live-read + `/api/auth/sso`).

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

Quy ước: tính năng khóa MỚI → bọc `components/login-gate.tsx` (UI) **và** kiểm session ở API (thật). Hook trạng thái: `lib/use-auth.ts`. Khi Supabase chưa cấu hình (demo mode dev) thì KHÔNG khóa — giữ invariant demo mode §"Demo mode".

## 8. Cross-references

- Demo mode pattern: [02-architecture.md](02-architecture.md)
- Màu trạng thái: [03-design-system.md](03-design-system.md)
- Trục 4 trong bức tranh sản phẩm: [01-product.md](01-product.md)

---

**Last updated**: 2026-07-28
<!-- re-verified: 2026-07-28 — bảng `product_listings` (0010, 🔴 chưa apply prod) — danh mục sản phẩm/dịch vụ admin quản lý cho tab Sản phẩm /tau, đọc công khai (RLS visible=true), ghi chỉ qua /api/admin/products (requireStaff). Kế hoạch tiếp: product_inquiries riêng + push_subscriptions (Web Push) — chưa có migration. -->
<!-- re-verified: 2026-06-18 — 0002 supplies +unit; webhook route trả results[] per-event (ref/ok/code/provisioned) — khớp khảo sát SDWork -->
<!-- re-verified: 2026-06-16 — bảng customers/devices/supplies/support_requests (0002) + auth SĐT+mật khẩu (webhook provision, KHÔNG email/OTP) + webhook ingest (§5b); §6 gateway live-read chuyển tiếp -->

### Chuỗi cứng theo máy — migration [`0026_device_tokens.sql`](../../supabase/migrations/0026_device_tokens.sql) (2026-08-02) — ✅ ĐÃ APPLY prod

Thay phiên Supabase làm danh tính của **app ngư dân** (`/quan-tri` giữ nguyên Supabase Auth — nhân viên ngồi ở bờ, sóng tốt, không có lý do kéo vào cùng rủi ro).

**Vì sao**: phiên Supabase = JWT ngắn hạn + refresh token tự xoay. Ngoài biển, một lượt xoay mà phản hồi không về là máy giữ token cũ; dùng lại quá `reuse interval` (10 giây) bị GoTrue coi là token bị lộ ⇒ **thu hồi cả phiên**. Bà con văng khỏi tài khoản mà không ai đăng nhập ở đâu. Đo trên prod trước khi sửa: 48/63 hàng `auth.refresh_tokens` đã revoked, mỗi phiên là chuỗi 5–12 token.

| Cột | Nghĩa |
|---|---|
| `token_hash` (PK) | SHA-256 hex của chuỗi thô. **KHÔNG lưu chuỗi thô** — bảng rò ra ngoài thì kẻ đọc được vẫn không đăng nhập thay bà con được |
| `customer_phone` | SĐT đã chuẩn hoá. Không có khoá ngoại (tài khoản có thể chưa về qua webhook) |
| `device_id` / `platform` | mã máy (0022) + loại máy, để `/quan-tri` tra cứu |
| `created_at` / `last_used_at` | `last_used_at` ghi THƯA (≥1 giờ/lượt) — ghi mỗi request là biến bảng chuỗi thành bảng log |
| `revoked_at` / `revoked_reason` | **NULL = đang hiệu lực**. `new_login` \| `user_signout` \| `admin` |

**RLS: bật, KHÔNG policy nào** ⇒ chỉ service key đụng được. Kèm `revoke all ... from anon, authenticated` làm lớp khoá thứ hai: Supabase cấp sẵn quyền bảng cho hai role đó khi tạo bảng trong `public`, nên nếu sau này ai lỡ tắt RLS thì bảng hở ngay. Máy khách không có đường đọc bảng chuỗi của bất kỳ ai, kể cả của chính mình.

**Luật 1 tài khoản 1 máy** nằm gọn ở một chỗ: `revokeTokensOfPhone(phone, 'new_login')` chạy **TRƯỚC** khi cấp chuỗi mới trong `POST /api/auth/token`. Đảo thứ tự là có khoảnh khắc hai chuỗi cùng hiệu lực; thu hồi hỏng thì **không cấp** chuỗi mới (503) chứ không đi tiếp.

⚠️ **MẤT RLS THÌ ROUTE PHẢI TỰ LỌC.** Trước đây `current_phone()` của Postgres chặn hộ kể cả khi route viết ẩu. Nay các route của app ngư dân dùng service key và tự lọc bằng ĐÚNG SĐT vừa xác thực từ chuỗi — không nhận SĐT từ body, query, hay bất cứ thứ gì máy khách nói ra. Cổng chung: [`src/lib/api-identity.ts`](../../src/lib/api-identity.ts).

⚠️ **OFFLINE**: bảng này không có đường nào chạy ngược về máy để tải/xoá/đổi dữ liệu. Máy bị thu hồi chỉ mất TÀI KHOẢN, giữ nguyên dự báo/bản đồ đã tải (chủ dự án chốt: *"máy nào tải rồi thì cứ dùng thôi"*).



### Dữ liệu tới ngày nào — TÁCH KHO BẢN CÀI / KHO WEB — migration [`0027_data_until_web.sql`](../../supabase/migrations/0027_data_until_web.sql) (2026-08-02) — ✅ ĐÃ APPLY prod

**Lỗi đã sửa — /quan-tri đang mô tả NHẦM KHO.** Cột `data_until` (0025) được ghi từ MỌI nhịp. Trên iOS kho của bản Thêm-vào-Màn-hình-chính **tách riêng** với Safari, nên ca này có thật và hoàn toàn im lặng: bà con tải đủ trong bản cài (data_until = 17/08), mấy hôm sau mở app bằng Safari → nhịp web **ghi đè** bằng con số của kho Safari → bảng báo về cái kho sẽ KHÔNG ra khơi. Chiều ngược lại sai y hệt.

| Cột | Nghĩa |
|---|---|
| `customers.data_until` | kho **BẢN CÀI** — kho sẽ ra khơi. Giữ tên của 0025, nhưng từ 0027 **chỉ nhịp bản cài mới ghi** |
| `customers.data_until_web` | kho **WEB** |
| `customer_devices.data_until_web` | như trên, theo từng máy |

Android dùng chung kho nên hai cột trùng nhau — vô hại. iOS thì lệch, và chỗ lệch đó chính là thứ người trực tổng đài cần thấy.

**KHÔNG backfill**: giá trị `data_until` đang có là hỗn hợp hai kho, không tách ngược được. Để nguyên rồi nhịp sau ghi đúng.

**KHÔNG có cột `last_online_at`** — cố ý. "Lần cuối máy còn sóng" chính là `pwa_last_open_at` / `web_last_open_at`: nhịp chỉ gửi được khi có sóng. Thêm cột mới là chép lại dữ liệu đã có rồi phải giữ hai chỗ đồng bộ. Luật gộp chip ở [`src/lib/app-usage.ts`](../../src/lib/app-usage.ts) (`readinessChip`, thuần, có test).



### Một tài khoản một chuỗi sống — migration [`0028_device_tokens_one_live.sql`](../../supabase/migrations/0028_device_tokens_one_live.sql) (2026-08-02) — ✅ ĐÃ APPLY prod

`POST /api/auth/token` thu hồi chuỗi cũ rồi cấp chuỗi mới bằng **hai truy vấn rời**. Hai lượt đăng nhập chạy sát nhau xen kẽ được:

```
A: revoke → B: revoke (no-op) → A: insert (sống) → B: insert (CŨNG sống)
```

⇒ hai máy cùng hiệu lực, tức luật "1 tài khoản 1 máy" thủng đúng ở ca nó sinh ra để chặn. Không hiếm: bà con bấm Đăng nhập hai lần vì mạng chậm.

Không vá bằng cách viết code cẩn thận hơn — đây là **ràng buộc**, phải nằm chỗ không ai lách được. `create unique index … on device_tokens (customer_phone) where revoked_at is null` thay index thường của 0026. Lượt insert thua cuộc ném `23505`; route thu hồi lại rồi cấp lại **đúng một lần** → người đăng nhập SAU thắng. Fail-closed: xấu nhất là một lượt đăng nhập phải bấm lại.



### Máy bà con còn bao nhiêu chỗ — migration [`0029_device_storage.sql`](../../supabase/migrations/0029_device_storage.sql) (2026-08-02) — ⏳ CHỜ APPLY prod

**Vì sao** (chủ dự án chốt): cả một ngày soát offline được xây trên con số *"localStorage 5 MB"* mà **không ai đo**. Đo thật trên Chromium: localStorage chạm trần **99,88 MB**, quota cả origin **1.425 MB** — sai hẳn về mức độ. Không thể quyết kiến trúc lưu trữ bằng phỏng đoán, mà cũng không đo được iOS từ máy dev.

⚠️ **BẢNG DƯỚI ĐÂY ĐÃ ĐÍNH CHÍNH 2026-08-02k** (tài liệu WebKit chủ dự án đưa). Bản đầu viết sai hai chỗ, và cả hai đều dẫn người sau đi nhầm đường: (a) IndexedDB **không có** hạn mức riêng "15–60% đĩa trống" — nó dùng **chung hạn ngạch origin**, tính theo **tổng dung lượng THIẾT BỊ**; (b) luật ITP 7 ngày **không** chỉ quét Cache API mà quét **mọi kho JavaScript ghi được**, kể cả IndexedDB và cả **đăng ký service worker** — nên dời sang IndexedDB **không** thoát được luật đó.

| Kho | Hạn mức trên iOS/WebKit | Rủi ro thật |
|---|---|---|
| localStorage | **~5 MB/origin** — hạn mức RIÊNG, nhỏ hơn hẳn hạn ngạch origin, không co giãn theo máy (UTF-16 ⇒ ~2,5 triệu ký tự là chạm) | **iOS 16: chạm hạn mức là XOÁ SẠCH localStorage** (WebKit #245479) ⇒ mất luôn chuỗi đăng nhập, dấu hạng, tủ giấy tờ |
| Cache Storage | chung hạn ngạch origin | bị chính `sw.js` (`reclaimRoom`, đổi tên kho lúc deploy) dọn |
| IndexedDB | chung hạn ngạch origin | như trên |
| **Hạn ngạch origin** | Safari/PWA màn hình chính: tối đa ~**60% tổng dung lượng thiết bị**/origin · tất cả origin cộng lại ~**80%** · WKWebView không phải trình duyệt mặc định: ~**15%** | mức TRẦN, không phải lời hứa |

**Miễn luật 7 ngày**: chỉ **PWA đã thêm vào màn hình chính** (domain chính). Đó là hàng rào duy nhất, và app đã làm (`components/install-prompt.tsx`).

⇒ Hệ quả cho mọi quyết định sau này: **dời dữ liệu giữa IndexedDB và Cache Storage KHÔNG làm origin nhẹ đi một byte nào** (cùng một túi), và **chép thêm bản "cho chắc" là ăn GẤP ĐÔI hạn ngạch** — đẩy origin tới gần vòng thu hồi LRU hơn, tức bản dự phòng đi gây ra đúng cái nó định phòng. Bản dự phòng THẬT phải nằm **ngoài** origin: tệp bà con tự xuất ra máy.

| Cột (trên cả `customers` và `customer_devices`) | Nghĩa |
|---|---|
| `storage_quota_mb` | `navigator.storage.estimate().quota` — TRẦN kho của cả origin. NULL = trình duyệt cũ không có Storage API |
| `storage_used_mb` | `.usage` — app đang chiếm bao nhiêu. Tiến sát quota = sắp không lưu thêm được ⇒ đáng gọi nhắc dọn bớt ảnh/video **trước khi ra khơi** |

Nhịp 30 phút chở hai số này lên; `/quan-tri` hiện `kho X/Y MB`. Sau một ngày là có số THẬT của cả đội tàu, **tách theo nền** (`device_platform`, 0022) — lúc đó mới quyết được có phải dời `forfish.fc.*` sang IndexedDB không.

⚠️ **KHÔNG đo bằng cách ghi thử.** Cách duy nhất biết trần chính xác là ghi tới lúc ném — trên máy bà con thì đó là đổ vài chục MB rác vào kho và có cửa đẩy chính dữ liệu đi biển ra. `estimate()` là số trình duyệt tự khai, không ghi một byte.

⚠️ Client khai sai chỉ hỏng thống kê của chính máy đó, KHÔNG mở được quyền gì — nhưng vẫn ép qua `normalizeStorageMb` (thuần, có test): một chuỗi lạ / số âm / `Infinity` xuống thẳng cột `integer` là **cả lệnh UPDATE hỏng**, mất luôn mấy mốc thời gian đang chạy tốt (đúng khuôn lỗi cột 0022 đã dính).

### Đã lưu ở đâu · đủ chỗ không · chắc chạy offline chưa — migration [`0030_storage_breakdown.sql`](../../supabase/migrations/0030_storage_breakdown.sql) (2026-08-02) — ✅ ĐÃ APPLY prod 2026-08-03 (6 cột `customers` + 6 cột `customer_devices`, `storage_persisted` kiểu `boolean`)

**Vì sao** (chủ dự án chốt): *"heartbeat và web quản trị cần có các info này để nắm rõ đã lưu ở đâu, lưu bản dữ liệu tới ngày nào, dung lượng storage đủ không, có đảm bảo chạy tốt 100% offline chưa."*

0029 chở về **một con số tổng**. Số đó không trả lời được câu đang cần, vì theo bảng đã đính chính ở trên các kho **không bình đẳng**: localStorage có trần riêng ~5 MB (và iOS 16 chạm trần là xoá sạch nó), còn IndexedDB/Cache dùng chung hạn ngạch origin. Gộp lại là mất đúng thông tin để biết **kho nào sắp chật**.

| Câu hỏi | Cột trả lời |
|---|---|
| ① đã lưu ở đâu | `storage_backend` (`'idb'` = đã dời xong · `'ls'` = còn kẹt thùng 5 MB ⇒ **đáng gọi điện**) + `storage_ls_mb` / `storage_idb_mb` / `storage_cache_mb` |
| ② dữ liệu tới ngày nào | `data_until` (bản cài) / `data_until_web` — đã có từ 0025/0027 |
| ③ dung lượng đủ không | `storage_available_mb` (`quota − usage`); gần 0 = sắp không giữ nổi gói đi biển |
| ④ chắc chạy offline chưa | `offline_ready_at` (đã có) + `storage_persisted` |

`storage_persisted` = `navigator.storage.persisted()` — **hàng rào duy nhất** chống vòng thu hồi LRU khi máy đầy. App vẫn gọi `persist()` lúc mở app nhưng trước đây **vứt kết quả**, nên không ai biết máy bà con có được cấp hay không. Tổ hợp đáng lo nhất: `storage_available_mb` nhỏ **và** `storage_persisted = false`.

⚠️ `storage_cache_mb` là **ƯỚC LƯỢNG** (`tổng − ls − idb`), gộp cả mã service worker và phụ trội trình duyệt — chỉ dùng SO ĐỘ LỚN. Đo thật phải tải lại từng ô bản đồ: vài chục MB đọc đĩa mỗi nhịp, đắt hơn giá trị nó mang lại. Hai cột kia thì chính xác.

⚠️ Cột có thể CHƯA tồn tại (chủ dự án tự apply) ⇒ `/api/admin/accounts` thử **ba nấc** select rộng → hẹp; `/api/me/heartbeat` giữ nguyên khuôn "hỏng thì ghi lại bộ cũ". Một chip phụ không được làm mất trắng danh sách 700+ khách.


<!-- re-verified: 2026-06-14 — schema 0001 boats/documents + §6 gateway khớp code -->
<!-- re-verified earlier baseline -->

