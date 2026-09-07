# 0011 — Gộp "Cửa hàng" vào Chợ vật tư: một cửa hàng, SDVICO là một gian hàng

- **Status**: Accepted
- **Ngày**: 2026-09-07
- **Bối cảnh**: nợ do [ADR 0008](0008-san-thuong-mai-da-nguoi-ban.md) để lại — LEAD §5 #11 *"Hai cửa hàng song song → chỉ đổi lối vào, gộp = ADR sau"*. Đây là "ADR sau".

## Context

Chủ dự án mở tab **Tàu cá → Sản phẩm → Cửa hàng** và hỏi thẳng: *"cái cửa hàng và chợ bản chất là 1? tại sao click vào chia 2 luồng nó rối"*.

Câu hỏi đúng. Trong máy đang có **hai cửa hàng** cho cùng một việc là mua đồ cho tàu:

| | Cửa hàng (2026-07-28 → 08-11) | Chợ vật tư (2026-09-06) |
|---|---|---|
| Bảng | `product_listings` + `catalog_orders` | `shops` + `shop_products` + `market_orders` |
| Người bán | một mình SDVICO, admin tự nhập | nhiều đại lý, shop tự đăng |
| Giỏ | `cart-sheet` | `lib/market/cart` |
| Xem đơn | tab "Đơn của tôi" trong `/tau` | `/cho/don` |
| Quản trị | `/quan-tri` tab Sản phẩm · Đơn hàng | `/quan-tri` tab Chợ vật tư |

Khi làm chợ, đội chỉ **thêm một tấm thẻ dẫn sang chợ** ngay bên trên cửa hàng cũ để kịp ra mắt. Kết quả đúng như chủ dự án thấy: bấm vào "Cửa hàng" thì gặp *một cửa hàng nữa nằm trong cửa hàng*. Với bà con 40–60 tuổi, đó là hai giỏ hàng, hai chỗ xem đơn, và cùng một món hàng SDVICO nằm hai nơi có thể hai giá.

**Số đo thật trên prod ngày 07/09/2026** (ref `znzgugvfhgmiszqgjulk`) là thứ quyết định chọn đường nào:

- `product_listings`: **13 món, đều đang hiện, 7 món có giá số, 0 món của vendor ngoài**.
- `catalog_orders`: **1 đơn thật** của một khách hàng thật (không phải đơn thử), 150.000đ, đặt 28/08, tới nay **vẫn ở trạng thái "Mới" — chưa ai xử lý**.
- Bảng của chợ (`shops`…): **chưa tồn tại** — 0054 chưa apply.

Nói cách khác: cửa hàng cũ đang chạy thật với bà con nhưng chỉ có 13 món; chợ thì code xong mà chưa lên. **Đây là thời điểm rẻ nhất để gộp** — càng để lâu, số đơn phải chuyển càng nhiều.

## Decision

**Chợ là cửa hàng duy nhất. SDVICO là một gian hàng trong đó, không phải một cửa hàng riêng.**

1. **`/tau` tab Sản phẩm chỉ còn việc của nó**: đồ đang dùng trên tàu (đồng bộ SDVICO + đồ tự ghi, nhắc bảo hành). Ba chip "Đang dùng · Cửa hàng · Đơn của tôi" bỏ. Chỗ hai chip cũ đứng nay là **một thẻ hai hàng**: "Mua đồ cho tàu — Chợ vật tư" và "Đơn hàng của tôi" (→ `/cho/don`), để tay quen của bà con vẫn chạm trúng.
2. **Dữ liệu chuyển sang chợ** bằng migration `0055`: 13 món → gian hàng SDVICO, 1 đơn → `market_orders`. Bảng cũ giữ nguyên dữ liệu, chỉ ghi `comment` là ĐÃ NGHỈ.
3. **Thêm bậc "Liên hệ báo giá"** cho sản phẩm chợ (`price_vnd` cho phép `null`).
4. **Màn quản trị cũ** (`/quan-tri` tab Sản phẩm · Đơn hàng) giữ nguyên quyền, nhưng mở đầu bằng băng cảnh báo nói thẳng: app không còn đọc bảng này, sửa ở đây bà con không thấy, sang tab Chợ vật tư mà làm.

### Vì sao phải có "Liên hệ báo giá" — chỗ dễ bị cắt nhất

6 trong 13 món (máy lọc nước biển SEA-40, GSHT Viettel, Thuraya, điện thoại vệ tinh XT-Pro, lọc dầu SF-50, nhớt PV ENGINE) **chưa bao giờ có giá số** — SDVICO báo giá theo từng tàu. Mô hình chợ lại bắt `price_vnd` **NOT NULL từ 1.000đ**. Ba đường đi:

- **Bịa giá** — không được, sai với khách.
- **Ẩn 6 món đi** cho tới khi SDVICO đặt giá — mất trắng phần giới thiệu thiết bị lớn, đúng thứ sinh ra tab Cửa hàng.
- **Cho phép món chưa niêm yết giá** — chọn đường này.

Đây không phải chiều SDVICO: đại lý bán máy tàu nào cũng báo giá theo chiếc. Bậc này là của cả sàn, không phải ngoại lệ cho một shop — đúng luật "core không `if (shop === SDVICO)`" của ADR 0008.

Món liên hệ báo giá: **không giá gạch, không loại/cỡ, không vào giỏ, không lên đơn**. Chặn ở ba tầng độc lập — `validateMarketProductDraft`, `isPurchasable`/`buildMarketLines`, và chính RPC `market_place_order` (so `price_vnd = (it->>'priceVnd')::integer` không bao giờ khớp `null`). Màn món đổi hẳn thanh đáy thành **"Gọi hỏi giá"**, không để một nút "Thêm vào giỏ" mờ đứng cạnh — nút mờ là hướng dẫn mù (R-03).

## Alternatives

| Phương án | Vì sao loại |
|---|---|
| **Chỉ gỡ tấm thẻ dẫn sang chợ** khỏi tab Cửa hàng | Hết cảnh "cửa hàng trong cửa hàng" ngay, nhưng vẫn hai giỏ, hai chỗ xem đơn, hàng SDVICO hai nơi. Chữa triệu chứng, không chữa bệnh |
| **Giữ hai cửa hàng, đồng bộ hai chiều** | Đắt nhất mà vẫn hai giỏ. Đồng bộ tồn kho/giá hai bảng là nguồn lỗi vô tận cho đúng 13 món |
| **Bỏ chợ, mở rộng cửa hàng cũ thành đa người bán** | Chợ đã có đủ tồn kho, biến thể, đánh giá, kênh người bán, tab admin. Cửa hàng cũ không có gì trong số đó. Đi ngược là làm lại từ đầu |
| **Xoá luôn bảng + mã cũ trong cùng đợt** | 0054/0055 CHƯA apply prod. Xoá bây giờ là tự cắt đường lùi trong lúc chưa có gì thay thế chạy thật. Giữ lại, có `// nợ:` ghi trần |

## Consequences

**Được**

- Một cửa hàng, một giỏ, một chỗ xem đơn. Bà con hết phải hiểu hai luồng.
- Hàng SDVICO nằm cùng chỗ với hàng đại lý khác nên **so giá được** — đúng lời hứa trục 2.
- Cả sàn có thêm bậc "liên hệ báo giá", dùng được cho mọi shop bán thiết bị lớn.
- Quản trị còn một chỗ xử lý đơn thay vì hai.

**Mất / phải trả**

- 🔴 **Bắt buộc apply 0054 rồi 0055 CÙNG MỘT ĐỢT, TRƯỚC khi deploy nhánh này.** Deploy trước khi apply là bà con mất cả hai cửa hàng: màn cũ đã gỡ, màn chợ chưa có bảng để đọc.
- Tồn kho 7 món chuyển sang đặt **99** để giữ nguyên hành vi "luôn đặt được" của bảng cũ (bảng cũ không có tồn kho). **Không phải số thật** — SDVICO phải vào `/ban-hang` sửa.
- Địa chỉ của đơn cũ chuyển sang **để tỉnh rỗng** vì bảng cũ không có cột tỉnh. Không bịa. Nhân viên phải gọi lại hỏi bà con.
- Mã cũ (`sdvico-catalog.tsx`, `cart-sheet.tsx`, `my-orders.tsx`, `catalog-orders.ts`, `product-catalog.ts` + 4 route) thành **mã chết có chủ ý**, mỗi file một `// nợ:` ghi trần: xoá khi 0054+0055 đã apply và chợ chạy êm một tuần.
- Khoá máy khách `forfish.orders.v1` thành vô dụng, gỡ cùng đợt xoá mã chết.

**Việc còn mở — cần chủ dự án chốt (🔴 Auth, không tự làm)**

Tài khoản **quản lý** (manager) hiện có quyền hai tab `san-pham` và `don-hang` — hai tab vừa nghỉ. Tab `cho-vat-tu` thì **admin-only** (nợ đã ghi ở 12 §12). Nên sau đợt này quản lý không còn màn nào để bán hàng. Sửa đúng là cho `cho-vat-tu` vào `MANAGER_TABS` và chuyển quyền cũ sang, nhưng đó là thay đổi phân quyền — theo luật pre-flight của repo thì **dừng lại hỏi**, không tự đổi.
