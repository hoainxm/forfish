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
- **Ghi log**: helper `src/lib/admin-activity-log.ts` `logActivity(admin, {...})` — **FIRE-AND-FORGET** (try/catch, log hỏng KHÔNG chặn thao tác chính; bảng chưa có cũng nuốt lỗi). Gọi ở MỌI mutation của `/api/admin/*` sau khi thành công. **KHÔNG log bí mật** (mật khẩu/token; crew: không log CCCD/SĐT — chỉ loại vấn đề).
- **Đọc**: `GET /api/admin/activity` (**`requireAdmin`** — chỉ quản trị viên) trả tối đa 300 dòng mới nhất, lọc `?actor=` (khớp SĐT) & `?action=`; bảng chưa có → trả rỗng + `migrationNeeded`. UI: tab **Nhật ký** (admin-only) — tìm theo SĐT/tên thao tác + chọn loại + nút "Chỉ xóa/nhạy cảm".
- ✅ **ĐÃ APPLY prod 2026-07-30** (ref `znzgugvfhgmiszqgjulk`).

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
<!-- re-verified: 2026-06-14 — schema 0001 boats/documents + §6 gateway khớp code -->
<!-- re-verified earlier baseline -->

