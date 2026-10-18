# ADR 0013 — Chợ vật tư tàu cá: sàn ĐA NGƯỜI BÁN tách bảng mới, kho qua adapter, định danh SĐT theo chuỗi cứng, không thanh toán online

**Status**: Proposed
**Date**: 2026-09-06
**Deciders**: Long (chủ dự án) · Lead (tech lead) · Kiến trúc sư (ADR này)

---

## Context / Bối cảnh

Chủ dự án muốn một "Chợ vật tư tàu cá" trong SDFish theo mô hình Shopee giản lược: nhiều hãng/đại lý tự mở shop, tự đăng sản phẩm, tự xử lý đơn; ngư dân tìm → xem → giỏ nhiều shop → đặt → theo dõi → nhận → đánh giá. SDVICO chỉ là **một** shop trong đó (chủ sàn, seed sẵn).

Repo đã có một luồng đặt hàng **một nhà cung cấp** (2026-08-11): `product_listings` (0016/0045) + `catalog_orders` (0046/0047), route `/api/me/orders*` + `/api/admin/orders*`, giỏ `forfish.cart.v1`, chip trạng thái `moi→da_nhan→dang_giao→da_giao|da_huy`. Luồng này gắn chặt vào giả định "một NCC = SDVICO = staff `/quan-tri`": không có khái niệm shop, không có tồn kho, không có phí ship, không có phương thức thanh toán, không có đánh giá, quyền xử lý đơn là `requirePermission("don-hang")` của staff chứ không phải chủ shop.

Ràng buộc kiến trúc đã chốt trước đó và KHÔNG được phá:

- Định danh app ngư dân = **chuỗi cứng theo máy → SĐT** (`identityFromRequest`, 0037/0039). `auth.uid()` luôn NULL ⇒ mọi bảng mới **RLS bật, không policy, revoke anon/authenticated**, route dùng service-role và **tự lọc theo SĐT đã xác thực**.
- Máy dev: **không Docker, không Supabase CLI, không `SUPABASE_SERVICE_ROLE_KEY`** ⇒ route service-role trả 503 ở local; **cấm apply migration lên prod** (ref `znzgugvfhgmiszqgjulk`) mà không có lệnh của chủ dự án.
- Offline: ghi = online-only; đọc phải có nhánh bản đã lưu khi có thể; mọi fetch có đồng hồ chặn `timeoutSignal`.
- Web quản trị `/quan-tri` cùng deploy/DB, độc lập giao diện.

## Decision / Quyết định

Xây sàn đa người bán bằng **BỐN BẢNG MỚI** (`shops`, `shop_products`, `market_orders`, `product_reviews` — migration `0060_marketplace.sql`), **không đụng** `product_listings`/`catalog_orders`; kho dữ liệu đi qua **một interface `MarketStore`** với hai bản cài (`supabase-store` cho prod, `file-store` JSON cho dev — chỉ bật khi `MARKET_STORE=file` và không phải Vercel/production, sai điều kiện thì ném lỗi lúc khởi tạo); **cả người mua lẫn người bán** định danh bằng **SĐT từ chuỗi cứng** (chủ shop = `shops.owner_phone`); **kênh người bán `/ban-hang` cùng deploy** với app ngư dân (không app riêng, không domain riêng); **không cổng thanh toán** — COD + chuyển khoản tay (shop khai STK, người mua bấm "đã chuyển", shop xác nhận). Logic nghiệp vụ (máy trạng thái, tính tiền, validate, mã đơn, mã chống trùng) là **hàm thuần** trong `src/lib/market/*.ts`, có test Vitest, **không** nằm trong adapter. Trừ tồn kho **nguyên tử** bằng một hàm plpgsql `market_place_order` (một giao dịch: kiểm shop `hoat_dong`/không `paused` + giá + trừ kho + ghi đơn; một dòng hết hàng là hoàn lại toàn bộ đơn của shop đó; giữa các shop độc lập, trả `results[]`). Bản 1.1 (hợp nhất sau phản biện, LEAD-BRIEF §4/§5) thêm: `shops.paused`, `market_orders.needs_refund`/`bank_snapshot`, `shop_products.admin_hidden`/`deleted_at` (xoá mềm), `product_reviews.hidden`, tự hoàn thành lười khi đọc (`settleOverdue`), khách lạ xem chợ, admin xử lý đơn thay mọi shop (`by=admin:<sđt>`), chủ shop SDVICO prod = sentinel + admin gán.

Thiết kế chi tiết (schema nguyên văn, interface, route, trang, kế hoạch pha): [`docs/app-map/12-kien-truc-san-thuong-mai.md`](../app-map/12-kien-truc-san-thuong-mai.md).

## Alternatives considered / Phương án đã cân nhắc

### Option A: Mở rộng `product_listings` + `catalog_orders` cũ (thêm cột `shop_id`, `stock`, `payment_*`…)
- ✅ Ưu: ít bảng hơn; tab Sản phẩm `/tau` và `/quan-tri` tab Đơn hàng dùng lại được ngay.
- ❌ Nhược: hai bảng cũ có **RLS đọc công khai `visible=true`** cho `product_listings` (client đọc thẳng qua anon key) — thêm `shop_id`/`stock`/`sold_count` là lộ số liệu kinh doanh của từng shop qua anon; `catalog_orders` có `boat_name/boat_ref/dealer_note/handled_by` — khái niệm của luồng NCC-nội-bộ, không có chỗ cho `shop_id`, phí ship, thanh toán, timeline; máy trạng thái 5 nấc cũ (`moi/da_nhan/…`) khác máy 6 nấc mới, đổi check constraint là phải migrate dữ liệu đơn đang có. 0045–0047 **chưa apply prod SDVICO** nên "dùng lại" cũng không tiết kiệm được lượt apply nào. Ghép hai mô hình vào một bảng là đổi một luồng đang chạy để lấy một luồng chưa có.

### Option B: Bốn bảng mới + adapter `MarketStore` ← chosen / đã chọn
- ✅ Ưu: bảng cũ nguyên vẹn (luồng NCC nội bộ vẫn chạy tới khi chủ dự án quyết gộp); mô hình dữ liệu khớp nghiệp vụ sàn (shop, kho, ship, thanh toán, timeline, review); RLS khoá kín theo đúng khuôn 0037; logic thuần test được không cần DB; dev local chạy được toàn bộ luồng mua–bán–duyệt mà không có service key.
- ❌ Nhược: thêm một interface + hai bản cài phải giữ khớp nhau (hợp đồng ghi ở 12 §3, test hợp đồng chạy trên file-store); có hai "cửa hàng" trong app một thời gian (tab Sản phẩm `/tau` cũ + `/cho` mới) — lối vào cũ chỉ còn là chip trỏ sang `/cho` (LEAD-BRIEF §2), gộp hẳn là quyết định sau.

### Option C: Supabase branch / project dev riêng cho local
- ✅ Ưu: dev chạy đúng Postgres thật, RPC/constraint thật, không cần file-store.
- ❌ Nhược: máy dev không có CLI/Docker; branch Supabase là tính năng trả phí theo giờ compute và cần Git integration; mỗi agent build song song cần service key riêng — key nằm trong `.env.local` của từng máy = tăng bề mặt rò rỉ đúng lúc đang siết bảo mật (ADR 0007). Không giải quyết được "test logic thuần không cần DB".

### Option D: PGlite / SQLite nhúng cho dev
- ✅ Ưu: SQL thật, chạy được migration.
- ❌ Nhược: thêm dependency mới (nguyên tắc 15 bậc 5: cấm thêm dep cho việc có thể làm bằng cái đang có); PGlite chưa chắc chạy hàm plpgsql + `gen_random_uuid()` + trigram y hệt Supabase ⇒ "xanh ở local, đỏ ở prod"; SQLite thì khác dialect hẳn (jsonb, `on conflict`, `timestamptz`). File JSON là bậc 3–4 (Node `fs` chuẩn), đủ cho vài trăm bản ghi seed, và ép logic nghiệp vụ phải ở tầng TS thuần — đúng thứ muốn.

### Option E: localStorage-only (không server, không migration)
- ✅ Ưu: không cần Supabase, không cần migration, chạy offline hoàn toàn.
- ❌ Nhược: sàn là chỗ **nhiều người** gặp nhau — người mua ở tàu, người bán ở đại lý; dữ liệu nằm trên máy một người thì không có sàn. Chỉ hợp cho giỏ/địa chỉ/yêu thích/bản lưu đơn (và đúng là bốn khoá đó vẫn ở localStorage: `forfish.mcart.v1`, `forfish.maddr.v1`, `forfish.mfav.v1`, `forfish.morders.v1`).

### Về định danh người bán: tài khoản riêng vs SĐT SDFish
- Loại phương án "tài khoản người bán riêng (email/mật khẩu Supabase Auth)": app đã bỏ phiên Supabase (0037) — thêm một loại phiên thứ hai là dựng lại đúng con bug đã diệt (JWT xoay hỏng ngoài biển), và người bán ở đại lý cũng có SĐT, cũng được SDVICO cấp tài khoản theo đúng đường hiện có. Chọn: **chủ shop = SĐT SDFish**, `shops.owner_phone unique`.

### Về thanh toán: cổng thanh toán vs COD + chuyển khoản tay
- Loại cổng thanh toán (VNPay/MoMo/ZaloPay): cần pháp nhân trung gian thanh toán, hợp đồng, webhook, đối soát, hoàn tiền — sàn chưa có giao dịch nào để biện minh; ngư dân quen COD/chuyển khoản đọc từ STK. Chọn: **COD + chuyển khoản**, `payment_status` ba nấc, không ví, không escrow. Ghi nợ: cổng thanh toán khi có ≥ N đơn/tháng (chủ dự án quyết).

## Consequences / Hệ quả

- **Tích cực**: bảng cũ và luồng NCC nội bộ không đổi một dòng; logic sàn test được 100% không cần DB (`npm test` xanh trên CI Node 20); ba agent build song song trên ba tập file rời nhau, cùng một hợp đồng `MarketStore`; dev local chạy đủ vòng mua–bán–duyệt bằng persona (`/dev`), không cần service key trên máy dev; prod chỉ cần apply 0060 + tạo bucket `market-media`.
- **Đánh đổi**: (1) hai bản cài kho phải giữ khớp — hợp đồng có test chạy trên file-store, bản supabase chỉ kiểm được sau khi apply 0060 lên một project thật (staging hoặc prod theo lệnh chủ dự án); (2) file-store KHÔNG mô phỏng được ràng buộc DB (unique, check, trigram) — adapter file phải tự kiểm trong TS, và bảng kiểm ở 12 §5 liệt kê đúng những gì nó mô phỏng; (3) nhánh dev identity trong `api-identity.ts`/`admin-auth.ts` là mã chỉ chạy khi `MARKET_STORE=file` — có cổng ba điều kiện + throw ở prod, nhưng vẫn là một nhánh nữa trong cửa chung, phải có test canh (12 §6); (4) tồn kho theo **sản phẩm**, không theo biến thể (nợ ghi ở 12 §12); (5) tự hoàn thành đơn sau 7 ngày làm **LƯỜI KHI ĐỌC** (`settleOverdue` thuần, chạy ở mọi route đọc đơn/thống kê — LEAD-BRIEF §4 #3, 2026-09-06): không cron, không lệch hai bên, đổi lại đơn không ai đọc thì treo (vô hại) và thống kê phải quét trước khi tính (trần 200 đơn/lượt, quá ⇒ cron ngày 1 lần theo ADR 0006).
- **Trung tính**: khu `/cho` cần mạng để đọc (không precache, đúng ADR 0004 "ở-bờ chỉ cần không treo") — có màn "cần có mạng" + bản lưu đơn đã tải; `/api/cho/*`, `/api/ban-hang/*`, `/api/admin/cho/*`, `/api/dev/*` **không** vào `API_CACHE_ALLOW` của service worker (gắn danh tính), không phải sửa `public/sw.js`.

## References

- Thiết kế kỹ thuật: `docs/app-map/12-kien-truc-san-thuong-mai.md`
- BA spec: `docs/app-map/11-ba-spec-san-thuong-mai.md` (Phase 1, agent BA; 1.1 hợp nhất)
- Phản biện + đối chiếu: `docs/app-map/_generated/phan-bien-san-thuong-mai-2026-09-06.md`
- App-map liên quan: `02-architecture.md` §2/§3, `04-data-model.md` (0037, 0045–0047), `03-design-system.md` §"Đặt hàng", `ops/state-registry.md`
- ADR liên quan: 0004 (phạm vi offline), 0006 (cron > 1 lần/ngày), 0007 (bảo mật sau mật khẩu chung)
- Khung lead: `LEAD-BRIEF.md` (scratchpad phiên 2026-09-06)

## History

- **2026-09-06**: Proposed (Kiến trúc sư, Phase 1)
- **2026-09-06 (1.1)**: hợp nhất sau phản biện — quyết định bổ sung của lead (LEAD-BRIEF §4/§5) ghi vào Decision/Consequences; 11 và 12 đồng bộ bản 1.1.
