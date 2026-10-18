# 11 — ba-spec: Chợ vật tư tàu cá (sàn đa người bán)

> Load khi: task chạm `/cho/**`, `/ban-hang/**`, tab "Chợ vật tư" ở `/quan-tri`, `src/lib/market/**`, `/api/cho|ban-hang|admin/cho/**`, migration `0060_marketplace.sql`, hoặc bất kỳ câu hỏi "người mua/người bán/admin sàn được làm gì, khi nào, thấy gì".
covers: src/lib/market/, src/app/cho/, src/app/ban-hang/, src/components/market/, src/components/admin/market-admin-tab.tsx, src/components/admin/market-admin-requests.tsx, src/components/admin/market-admin-orders.tsx, src/app/api/cho/, src/app/api/ban-hang/, src/app/api/admin/cho/
last_verified: 2026-10-18
<!-- re-verified: 2026-10-18 — v1.4 "LUỒNG GIỐNG SHOPEE" (chủ dự án: "cho phép chủ tàu đặt đơn bất kỳ cái gì, nó sẽ chuyển cho chủ sàn, làm luôn luồng giống shopee như xác nhận đơn, thời gian giao"): §4.3 tự huỷ 72 giờ (thay "48 giờ không tự huỷ"), §4.4 hẹn giao, §5.9 yêu cầu đặt hàng, §6.5 xác nhận = hẹn giao + dời hẹn, §7 mục Yêu cầu đặt, §8 Y1/Y2, AC-78..AC-92. Code: lib/market/{eta,request-state,requests-cache}.ts, order-state settlePending, route-utils settleRequests, /api/cho/yeu-cau*, /api/admin/cho/yeu-cau*, components/market/shared/eta.tsx, buyer/market-requests.tsx, admin/market-admin-requests.tsx. Kiểm trình duyệt file mode 2026-10-18: gửi yêu cầu → báo giá → đồng ý → đơn "Đã xác nhận" kèm hẹn giao; chủ shop xác nhận chọn "Ngày mai". -->
<!-- re-verified: 2026-09-06 - pha 2b: /cho (8 màn), /ban-hang (7 màn), tab admin, /api/cho|ban-hang|admin/cho đã hiện thực theo §5–§7; AC 77 mã; QA e2e 63 pass / 8 fixme; khác spec: ghi chú người mua là MỘT ô chung cho cả lần đặt (Core CheckoutDraft.buyerNote), giỏ khách lạ dời sang ngăn SĐT khi ngăn đó trống -->
ttl_days: 90
<!-- DOC-STATUS: SUSPECT (2026-10-18) — code 'src/app/api/admin/cho/' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
version: v1.1 (2026-09-06) — hợp nhất sau phản biện, chưa build. 16 quyết định LEAD-BRIEF §4 + §5 đã đưa vào; tên trường/mã/route/trần số lấy NGUYÊN VĂN từ [12-kien-truc 1.1](12-kien-truc-san-thuong-mai.md) (12 = nguồn TÊN, 11 = nguồn HÀNH VI). Đối chiếu: [_generated/phan-bien-san-thuong-mai-2026-09-06.md](_generated/phan-bien-san-thuong-mai-2026-09-06.md).

> **Mục đích**: ORACLE HÀNH VI cho agent build + QA — ai được làm gì, hệ thống phản ứng ra sao, đúng-sai đo bằng AC nào. Không mô tả pixel (việc của [07-design-spec](07-design-spec.md)); không mô tả schema cột (việc của [12-kien-truc-san-thuong-mai](12-kien-truc-san-thuong-mai.md) + [04-data-model](04-data-model.md)).
>
> **Vị trí trong bốn lời hứa**: Trục 3 "Vận hành rẻ hơn" (mua vật tư đúng giá, nhiều chỗ bán cạnh tranh) + nối Trục 2 (tiền bán cá quay lại mua vật tư). Chợ **miễn phí cho mọi tài khoản** — không dính `tier` premium (premium chỉ khoá dự báo cá + thời tiết >3 ngày, [CLAUDE.md](../../CLAUDE.md)).
>
> **Từ vựng UI (cấm jargon)**: "Đặt hàng" (không "checkout") · "Tổng quan" (không "dashboard") · "Shop" giữ nguyên vì bà con đã quen từ Shopee · "Giỏ hàng" · "Đơn hàng" · "Chuyển khoản" / "Trả tiền khi nhận hàng" (không "COD" trên màn — COD chỉ là mã trong code).

---

## 1. Actor & mục tiêu

| Actor | Là ai | Muốn gì | Sợ gì | Định danh |
|---|---|---|---|---|
| **Người mua** — `buyer` | chủ tàu / ngư dân 40–60 tuổi, ít rành công nghệ, tay ướt, đọc ngoài nắng; mua vật tư cho MỘT chuyến biển (dầu, đá, lưới, phụ tùng máy) trước ngày ra khơi | tìm nhanh món quen, thấy giá số, đặt vài chạm, biết đơn đang ở đâu, gọi được người bán | đặt rồi không ai giao; bấm nhầm đặt hai lần; giá trên màn khác giá lúc nhận; mất sóng giữa chừng không biết đã đặt chưa | tài khoản SDFish (SĐT + chuỗi cứng theo máy, `identityFromRequest`) |
| **Người bán** — `seller` | hãng / đại lý vật tư, cửa hàng ở cảng; có nhân viên trực điện thoại, rành Zalo/Shopee Seller ở mức cơ bản | đăng món có ảnh, nhận đơn kèm SĐT + địa chỉ, xử lý đơn theo bước, biết đã bán được bao nhiêu | đơn ảo/đặt phá; người mua báo "đã chuyển" mà chưa thấy tiền; bán hụt vì tồn kho không khớp | tài khoản SDFish theo SĐT (SĐT chủ shop = định danh shop, `requireShopOwner`) |
| **Admin sàn** — `admin` | nhân viên SDVICO ở `/quan-tri` | duyệt shop đàng hoàng, gỡ món vi phạm, thấy toàn cảnh đơn, xử lý khiếu nại qua điện thoại | shop lừa đảo lên sàn; sản phẩm cấm (ngư cụ huỷ diệt, hoá chất) | `requireAdmin` |
| **Hệ thống** | route server + adapter `MarketStore` | giữ bất biến §10, tính lại tiền, giữ tồn kho, gửi thông báo | — | service-role |

> Một SĐT có thể **vừa là người mua vừa là chủ shop** (đại lý cũng có tàu). Hai vai dùng chung tài khoản, tách bằng route (`/cho` vs `/ban-hang`), không có "chuyển tài khoản".

---

## 2. Phạm vi "90% Shopee" — đối chiếu

| Shopee có | Bản này | Lý do (1 dòng) |
|---|---|---|
| Tìm kiếm theo chữ | **Có** — ô tìm ở `/cho`, kết quả ở `/cho/tim`, tìm theo tên + mô tả, lọc nhóm, sắp xếp 4 kiểu | key của việc mua là tìm ra món |
| Danh mục | **Có, cố định trong code** — 9 nhóm id gạch-ngang, thứ tự cố định (LEAD §4 #14, `PRODUCT_CATEGORIES`) | vật tư tàu cá ổn định, không cần bảng |
| Trang sản phẩm | **Có** — ảnh ≤6, giá + giá gạch, biến thể, tồn, đã bán, mô tả, shop, đánh giá | lõi vòng mua |
| Biến thể | **Có, 1 cấp tuỳ chọn** (vd 5L / 20L), 2..10 loại, mỗi loại giá riêng tuỳ chọn; **tồn kho chung** (LEAD §5 #5, nợ có trần) | 2 cấp (màu × cỡ) hiếm với vật tư; kho theo biến thể = RPC jsonb có khoá, gấp 3 việc |
| Giỏ nhiều shop | **Có** — giỏ local, nhóm theo shop, đặt = N đơn | mua dầu shop A + đá shop B cùng chuyến là ca thật |
| Đặt hàng (checkout) | **Có** — 1 màn: địa chỉ · cách trả tiền · tóm tắt theo shop · nút Đặt hàng | — |
| Thanh toán online / ví | **Không** — chỉ Trả khi nhận + Chuyển khoản tự khai | LEAD §1: không cổng thanh toán, không escrow; **app không hứa gì về tiền** |
| Theo dõi đơn | **Có** — 6 trạng thái + mốc giờ từng bước + mã vận chuyển tự nhập | — |
| Huỷ đơn | **Có** — buyer khi `cho_xac_nhan`; seller tới `da_xac_nhan` kèm lý do; admin tới `dang_giao`; huỷ đơn CK đã báo chuyển ⇒ cờ `needsRefund` nhắc 2 bên | — |
| Trả hàng / hoàn tiền | **Không — ghi nợ** | cần tiền đi qua sàn mới ép được; nay xử lý bằng điện thoại + admin |
| Đánh giá sản phẩm | **Có** — 1–5 sao + chữ, chỉ sau `hoan_thanh`, 1 lần/món/đơn | tín hiệu chọn shop |
| Chat | **Không** — nút **Gọi shop** / **Gọi người mua** + ghi chú 2 chiều trên đơn | bà con gọi điện, không gõ chat; chat = hạ tầng realtime ngoài phạm vi |
| Voucher / mã giảm giá | **Không** — chỉ giá gạch | LEAD §1 ghi nợ |
| Flash sale / combo | **Không** | — |
| Yêu thích | **Có, local** (`forfish.mfav.v1`, ngăn SĐT, kèm snapshot) — cần đăng nhập | rẻ, hữu ích cho "món quen mỗi chuyến" |
| Lịch sử xem | **Không** | thêm ghi mà không thêm giá trị cho ca "mua cho chuyến biển" |
| Trang shop | **Có** — `/cho/shop/[slug]`: tên, tỉnh, SĐT gọi, phí ship/ngưỡng miễn, sao trung bình, "tạm nghỉ" nếu có, danh sách món | — |
| Xem chợ không cần tài khoản | **Có** — `/cho`, `/cho/tim`, `/cho/sp`, `/cho/shop`, giỏ; đặt/đơn/đánh giá/♡/bán cần đăng nhập (LEAD §5 #8) | mồi kéo đăng ký, dữ liệu sàn vốn công khai |
| Ưu tiên gần mình | **Có** — khối "Gần bà con" ở `/cho` + chip "Gần tôi" ở `/cho/tim` theo tỉnh cảng nhà (LEAD §4 #11) | đại lý gần cảng quan trọng hơn xếp hạng |
| Shop tạm nghỉ | **Có** — công tắc `paused` (LEAD §4 #8) | đi lễ, hết mùa |
| Kênh người bán | **Có** — `/ban-hang`: Tổng quan · Sản phẩm · Đơn hàng · Cài đặt shop | — |
| Thống kê | **Có, giản lược** — hôm nay / 7 ngày / 30 ngày + top 5 bán chạy + sắp hết hàng | đủ để đại lý biết "có bán được không" |
| Admin duyệt shop | **Có** — duyệt / từ chối / khoá / mở khoá kèm lý do; gán chủ shop; **xử lý đơn thay mọi shop** (LEAD §4 #2); gỡ món; ẩn đánh giá | chống shop ma; shop SDVICO chưa gán chủ vẫn bán được |
| Thông báo | **Có** — hộp thư + push theo 07 §12, **ngoại lệ push cho người bán** (LEAD §4 #4, §8 dưới) | — |
| Tự hoàn thành đơn | **Có, lười khi đọc** — `da_giao` quá 7 ngày ⇒ `hoan_thanh` lúc bất kỳ ai đọc (LEAD §4 #3), không cron | không cần hạ tầng cron, hai bên không lệch |
| Mua ngay (bỏ qua giỏ) | **Không** | một luồng đặt hàng duy nhất |
| Gợi ý tìm / lịch sử tìm / trả lời đánh giá / theo dõi shop / hỏi đáp món | **Không** (nợ, không mở rộng đợt này) | vòng lõi trước |
| Đa tài khoản nhân viên trong 1 shop | **Không** — 1 SĐT chủ shop; admin xử lý thay khi cần | §12 #2 đã chốt: nhiều SĐT/shop = nợ có trần (12 §12) |
| Vận chuyển tích hợp (GHN/GHTK) | **Không** — shop tự giao / gửi xe / gửi ra cảng, mã vận đơn tự nhập | — |

---

## 3. Object model

Quy ước chung: id = uuid; mọi mốc giờ ISO UTC, hiện theo giờ VN; tiền = số nguyên VND; chữ người nhập được `trim()` trước khi validate; câu lỗi tiếng Việt trả từ hàm thuần `validate*` trong `src/lib/market/validate.ts` (client + server dùng chung, server là chốt). **Tên trường, mã trạng thái, trần số dưới đây là NGUYÊN VĂN của [12 §3–§4](12-kien-truc-san-thuong-mai.md)** (bản 1.1 hợp nhất) — 11 chỉ nói luật + câu chữ.

### 3.1 Shop (`shops`)

| Field | Kiểu / ràng buộc | Câu lỗi khi sai |
|---|---|---|
| `id` | uuid | — |
| `ownerPhone` | SĐT chuẩn hoá VN, **duy nhất** (1 SĐT = 1 shop, §10-R1). Shop SDVICO seed prod = sentinel `sdvico:chua-gan`, admin gán sau (LEAD §5 A2) | "Số này đã có shop rồi. Vào Kênh người bán để xem." |
| `name` + `slug` | 3–60 ký tự; `slug = toSlug(name)` **duy nhất** (⇒ tên duy nhất không phân biệt hoa/thường/dấu) | "Tên shop 3–60 chữ." / "Tên shop này đã có người dùng — chọn tên khác." (409 `slug_taken`) |
| `phone` | SĐT liên hệ hiện cho người mua (mặc định = ownerPhone, sửa được — số nhân viên trực) | "Nhập số điện thoại liên hệ hợp lệ." |
| `province` | bắt buộc, 1 trong `COASTAL_PROVINCES` (chip) | "Chọn tỉnh của shop." |
| `address` | 0–200 ký tự | "Địa chỉ tối đa 200 chữ." |
| `description` | 0–1000 ký tự | "Giới thiệu tối đa 1000 chữ." |
| `logoUrl` | tuỳ chọn, từ upload | — |
| `bankName` · `bankAccount` · `bankHolder` | tuỳ chọn; có `bankAccount` (6–20 số) thì phải có cả 2 trường kia (`bankName` 2–40, `bankHolder` 3–60). Đủ 3 = **`acceptsBankTransfer`** | "Số tài khoản 6–20 số." / "Ghi tên ngân hàng và tên chủ tài khoản." |
| `shippingFlatVnd` | 0..5.000.000 | "Phí giao từ 0 đến 5 triệu." |
| `freeShipFromVnd` | null hoặc ≥ 0; null = không miễn | "Ngưỡng miễn phí giao phải là số tiền." |
| `status` | `cho_duyet` · `hoat_dong` · `tam_khoa` · `tu_choi` (nhãn UI: Chờ duyệt · Đang hoạt động · Tạm khoá · Bị từ chối) | — |
| `statusNote` | 5–300 chữ, **bắt buộc** khi `tu_choi`/`tam_khoa` (admin ghi, seller đọc) | "Ghi lý do cho shop biết." |
| `paused` | seller tự bật "Tạm nghỉ bán" (LEAD §4 #8): món **vẫn hiện**, KHÔNG đặt được, trang shop/món nói rõ | — |
| `ratingAvg`, `ratingCount` | tính từ đánh giá **không ẩn**, cache trên shop | — |
| `createdAt`, `updatedAt`, `approvedAt` | `approvedAt` = lần đầu `hoat_dong` | — |

### 3.2 Sản phẩm (`shop_products`)

| Field | Kiểu / ràng buộc | Câu lỗi |
|---|---|---|
| `shopId` | shop tồn tại | — |
| `title` | 3–120 ký tự | "Tên món 3–120 chữ — ghi rõ loại, cỡ, hãng để bà con tìm ra." |
| `category` | 1 trong 9 id gạch-ngang `PRODUCT_CATEGORIES` (LEAD §4 #14: `may-dong-co` · `dien-tu-hang-hai` · `ngu-cu` · `dau-nhot-nhien-lieu` · `da-bao-quan` · `nhu-yeu-pham` · `an-toan` · `phu-tung` · `khac`, đúng thứ tự) | "Chọn nhóm hàng." |
| `unit` | 1–20 chữ (lít, kg, cái, bộ, cây, bao…) | "Ghi đơn vị tính (lít, cái, bao…)." |
| `priceVnd` | 1.000..1.000.000.000 — giá gốc; biến thể không có giá riêng thì dùng giá này | "Giá từ 1.000đ đến 1 tỷ." |
| `compareAtVnd` | null hoặc > `priceVnd` (giá gạch) | "Giá gạch phải cao hơn giá bán." |
| `stock` | 0..99.999 — **kho CHUNG theo sản phẩm** kể cả khi có biến thể (LEAD §5 #5, nợ có trần) | "Tồn kho là số từ 0 đến 99.999." |
| `variants[]` | 0 hoặc **2..10** phần tử `{label 1–40 chữ, priceVnd?}`; nhãn không trùng (so không dấu) | "Có loại/cỡ thì cần ít nhất 2." / "Hai loại trùng tên." / "Tối đa 10 loại." |
| `images[]` | 0–6 URL từ `/api/ban-hang/upload`; ảnh 1 = ảnh bìa | "Tối đa 6 ảnh." |
| `description` | 0–2000 chữ | "Mô tả tối đa 2000 chữ." |
| `status` | `dang_ban` · `an` (seller ẩn) · `het_hang` (tự đặt khi kho về 0, tự về `dang_ban` khi có kho — `normalizeProductStatus`) | — |
| `adminHidden` + `adminHiddenReason` | admin gỡ vì vi phạm (lý do 5–300); seller thấy băng đỏ, **KHÔNG tự bật lại được** | "Ghi lý do gỡ cho shop biết." |
| `deletedAt` | xoá mềm (LEAD §4 #12) — không hiện với ai, đơn cũ vẫn giữ snapshot, ảnh giữ | — |
| `soldCount` | **cộng lúc ĐẶT (T0)**, trừ lại khi hoàn kho (huỷ) — không đụng ở `hoan_thanh` | — |
| `ratingAvg`, `ratingCount` | cache từ đánh giá không ẩn | — |
| `createdAt`, `updatedAt` | — | — |

**"Mua được" (`isPurchasable`, 12 §4.2)** = shop `hoat_dong` ∧ ¬`shop.paused` ∧ `status=dang_ban` ∧ ¬`adminHidden` ∧ ¬`deletedAt` ∧ `stock ≥ 1`. Hàm thuần, dùng chung client + server.

### 3.3 Giỏ (local — `forfish.mcart.v1`)

- Kế thừa nguyên pattern `lib/cart.ts`: **ngăn theo SĐT chuẩn hoá** (`cartBucket`), ngăn của SĐT khác → giỏ rỗng; `saveMarketCart` trả boolean, ghi hỏng → băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ"; sự kiện in-tab chỉ bắn khi ghi được. Khách lạ (chưa đăng nhập) dùng ngăn `__khach__` — xem giỏ được, đặt thì `LoginGate`.
- Dòng: `{productId, variantLabel | undefined, qty}`; khoá dòng = `productId + variantLabel`.
- Giới hạn: ≤ **50 dòng**/giỏ (`CART_MAX_LINES`) — "Giỏ đầy rồi — tối đa 50 món. Bớt món hay đặt bớt trước giúp."; `qty` 1..999 (clamp).
- Giỏ **không lưu giá/tên** — hiện giỏ = tra lại từ server (`POST /api/cho/gio/tinh` gửi danh sách dòng → về `CartQuote`: nhóm theo shop, dòng snapshot, cờ `dropped` + lý do, `shop.acceptsBankTransfer`, `shop.paused`). Bản tra gần nhất cất trong cùng khoá (`quote.at`) — mất sóng hiện tên/giá từ đó, gắn "giá lúc HH:MM".
- Nhóm theo shop khi hiện; tổng từng shop + phí ship từng shop.

### 3.4 Địa chỉ nhận (local — `forfish.maddr.v1`, ngăn SĐT)

| Field | Ràng buộc | Câu lỗi |
|---|---|---|
| `id` | uuid client | — |
| `name` | 2–60 chữ; điền sẵn tên tài khoản | "Ghi tên người nhận." |
| `phone` | SĐT VN hợp lệ; điền sẵn SĐT đăng nhập — đây là SĐT **người nhận** (dữ liệu), không phải danh tính | "Nhập số điện thoại nhận hàng hợp lệ." |
| `province` | chip tỉnh; điền sẵn tỉnh cảng nhà (`loadHome().province`) | "Chọn tỉnh." |
| `isPort` | `true` = giao ra cảng/bến · `false` = địa chỉ nhà/kho | — |
| `detail` | `isPort` ⇒ tên cảng/bến 2–80 chữ (gợi ý từ danh bạ cảng; có thể thêm "tàu BĐ-91234, cầu cảng số 2") · ngược lại địa chỉ 5–200 chữ | "Ghi tên cảng / bến nhận hàng." / "Ghi địa chỉ đủ để người giao tìm được." |
| `isDefault` | 1 địa chỉ mặc định | — |

Tối đa **10** địa chỉ (`ADDRESS_MAX`). Đơn **chụp (snapshot)** `{name, phone, province, detail, isPort}` vào `order.address` — sửa địa chỉ trong máy không đổi đơn đã đặt.

### 3.5 Đơn (`market_orders`) — **1 đơn = 1 shop**

| Field | Ghi chú |
|---|---|
| `id`, `code` | `code` = `SD` + yymmdd (giờ VN) + 4 ký tự không nhầm (`makeOrderCode`, vd `SD260906K7PQ`) — đọc qua điện thoại "SD, 26-09-06, K7PQ"; unique |
| `shopId` + `shopName`/`shopPhone`/`shopSlug` (đính kèm khi đọc) | tên/SĐT **hiện tại** của shop (join lúc đọc) — buyer cần số gọi được hôm nay, không cần số cũ |
| `buyerPhone` | SĐT xác thực từ `identityFromRequest` — KHÔNG lấy từ body |
| `items[]` jsonb | snapshot: `{productId, variantLabel?, title, unit, image?, priceVnd, qty, lineTotalVnd}` — ≤ **20 dòng** (`ORDER_MAX_LINES`) |
| `subtotalVnd`, `shippingVnd`, `totalVnd` | server tính lại từ sản phẩm HIỆN TẠI + luật ship shop; `total = subtotal + shipping`; ship = 0 khi `freeShipFromVnd != null ∧ subtotal ≥ freeShipFromVnd` |
| `address` jsonb | snapshot §3.4 |
| `paymentMethod` | `cod` · `chuyen_khoan` — **một cách cho cả lần đặt** (LEAD §4 #9); `chuyen_khoan` chỉ khi MỌI shop trong lần đặt `acceptsBankTransfer` |
| `paymentStatus` | `chua_thanh_toan` · `bao_da_chuyen` · `da_thanh_toan` |
| `bankSnapshot` | `{bankName, bankAccount, bankHolder}` của shop **lúc đặt** (khi `chuyen_khoan`); nội dung CK = `code` |
| `needsRefund` | LEAD §4 #7: `true` khi đơn `chuyen_khoan` bị huỷ (bất kỳ ai) sau `bao_da_chuyen`/`da_thanh_toan`; hiện cả hai bên "Shop cần hoàn tiền"; app không xử lý tiền |
| `status` | §4 |
| `buyerNote` | ≤300 chữ, lúc đặt |
| `sellerNote` | ≤300 chữ, seller ghi khi xử lý, buyer thấy |
| `cancelReason`, `cancelBy` | seller/admin bắt buộc lý do 5–200; buyer tuỳ chọn; `cancelBy ∈ buyer/seller/admin` |
| `carrier`, `trackingCode` | tuỳ chọn, ≤40 chữ mỗi ô, gửi cùng cú chuyển `dang_giao` |
| `clientRef` | `marketOrderClientRef` (LEAD §4 #6): vân tay của shopId + món (id, biến thể, qty — sắp thứ tự) + địa chỉ + cách trả + ghi chú; unique `(buyerPhone, clientRef)` |
| `timeline[]` | `{status, at, by, note?}` mỗi lần chuyển trạng thái đơn **hoặc** thanh toán; `by ∈ buyer · seller · system · admin:<sđt>` (admin xử lý thay shop — LEAD §4 #2) |
| `createdAt`, `updatedAt`, `deliveredAt`, `completedAt` | `completedAt` của T4' = `deliveredAt + 7 ngày` (mốc đến hạn, không phải giờ đọc) |

### 3.6 Đánh giá (`product_reviews`)

- `orderId`, `productId`, `shopId`, `buyerPhone` (trả ra ngoài dạng che `0901***567`), `rating` 1..5, `comment` 0–500 chữ, `hidden`, `createdAt`. **Không ảnh** (LEAD §1: sao + chữ).
- Unique `(orderId, productId)` — 1 lần/món/đơn; không sửa, không xoá bởi buyer; admin **ẩn** được (`hidden`, LEAD §4 #15) ⇒ không hiện, không tính điểm — `ratingAvg/ratingCount` sản phẩm + shop tính lại từ đánh giá không ẩn.
- Chỉ tạo được khi đơn `hoan_thanh` ∧ đơn thuộc `buyerPhone` ∧ `productId` có trong `items`.
- Câu lỗi: "Chọn số sao." / "Nhận xét tối đa 500 chữ." / "Chỉ đánh giá được khi đã nhận hàng." / "Món này bà con đã đánh giá rồi."

### 3.7 Yêu thích (local — `forfish.mfav.v1`, ngăn SĐT)

`{productId, savedAt, snapshot: {title, priceVnd, image?, shopName}}` — tối đa **100** (`FAVORITES_MAX`). Snapshot chỉ để hiện khi mất sóng, có sóng thì tra lại; món không còn mua được → hiện mờ + "Món này hiện không bán". Cần đăng nhập (♡ khi chưa đăng nhập ⇒ `LoginGate`).

### 3.8 Cờ "có shop" (local — `forfish.mshop.v1`, ngăn SĐT)

`{hasShop, status?, at}` — để sheet Tài khoản chọn dạng dòng (LEAD §4 #16) mà không gọi mạng lúc mở app; cập nhật khi mở sheet có sóng (`GET /api/ban-hang/shop`) và mỗi lần vào `/ban-hang`.

---

## 4. Máy trạng thái đơn

Trạng thái (LEAD §2, một chiều): `cho_xac_nhan` → `da_xac_nhan` → `dang_giao` → `da_giao` → `hoan_thanh`; `da_huy` là đích từ `cho_xac_nhan`/`da_xac_nhan` (admin: cả `dang_giao`). Nhãn UI: Chờ xác nhận · Đã xác nhận · Đang giao · Đã giao · Hoàn thành · Đã huỷ. Bảng duy nhất: `TRANSITIONS` + `canTransitionOrder(from, to, actor)` (12 §4.1); tác dụng phụ duy nhất ở `applyTransition`/`applyPaymentTransition`.

### 4.1 Bảng chuyển

| # | Từ → Đến | Ai | Điều kiện | Side-effect (server, trong CÙNG giao dịch) |
|---|---|---|---|---|
| T0 | (tạo) → `cho_xac_nhan` | buyer | shop `hoat_dong` ∧ ¬`paused`; mọi dòng `isPurchasable`; tồn ≥ qty **kiểm atomic** (RPC `market_place_order`); `expectedTotalVnd` khớp; chưa có `(buyerPhone, clientRef)` | **trừ tồn + cộng `soldCount`** từng dòng; `paymentStatus=chua_thanh_toan`; `bankSnapshot` khi CK; timeline `by=buyer`; N1 (shop, push) |
| T1 | `cho_xac_nhan` → `da_xac_nhan` | seller / admin | — | timeline; N2 (buyer, hộp thư) |
| T2 | `da_xac_nhan` → `dang_giao` | seller / admin | `carrier`/`trackingCode` tuỳ chọn, gửi cùng request | timeline; N3 (buyer, push) |
| T3 | `dang_giao` → `da_giao` | seller / admin | — | `deliveredAt`; timeline; N4 (buyer, push) |
| T4 | `da_giao` → `hoan_thanh` | buyer ("Đã nhận hàng") / admin | — | `completedAt`; COD → `paymentStatus=da_thanh_toan`; mở đánh giá; N5 (shop, hộp thư). **KHÔNG** cộng `soldCount` (đã cộng ở T0) |
| T4' | `da_giao` → `hoan_thanh` | hệ thống — **`settleOverdue` khi ĐỌC** (LEAD §4 #3, không cron) | `deliveredAt` quá **7 × 24 giờ** | như T4, `by=system`, `completedAt = deliveredAt + 7 ngày`, note "Tự hoàn thành sau 7 ngày"; **không** thông báo. Chạy ở MỌI route đọc đơn/thống kê (12 §7 ⏱) trước khi trả |
| T5 | `cho_xac_nhan` → `da_huy` | buyer | — | **hoàn tồn + trừ `soldCount`**; `cancelBy=buyer`, lý do tuỳ chọn (chip: "Đặt nhầm" · "Đổi ý" · "Khác"); `needsRefund` theo luật chung (*); N6 (shop, hộp thư) |
| T6 | `cho_xac_nhan`/`da_xac_nhan` → `da_huy` | seller | `cancelReason` bắt buộc 5–200 | hoàn tồn; `needsRefund` (*); N7 (buyer, push) |
| T7 | `cho_xac_nhan`/`da_xac_nhan`/`dang_giao` → `da_huy` | admin | lý do bắt buộc | hoàn tồn; `needsRefund` (*); `cancelBy=admin`, timeline `by=admin:<sđt>`; N7 |
| P1 | `paymentStatus` `chua_thanh_toan` → `bao_da_chuyen` | buyer ("Tôi đã chuyển khoản") | `paymentMethod=chuyen_khoan` ∧ status ∉ {`da_huy`, `hoan_thanh`} | timeline `{status:"bao_da_chuyen"}`; N8 (shop, push) |
| P2 | `bao_da_chuyen` → `da_thanh_toan` (cũng cho `chua_thanh_toan` → `da_thanh_toan` khi shop nhận tiền không qua báo) | seller / admin ("Đã nhận tiền") | — | timeline; N9 (buyer, hộp thư) |
| P3 | `bao_da_chuyen` → `chua_thanh_toan` | seller / admin ("Chưa thấy tiền") | lý do 5–200 | timeline có note; N9' (buyer, push — cần hành động) |

(*) **Luật `needsRefund`** (LEAD §4 #7, không phụ thuộc ai huỷ): `paymentMethod=chuyen_khoan` ∧ `paymentStatus ∈ {bao_da_chuyen, da_thanh_toan}` lúc huỷ ⇒ `true`. Hiện: buyer "Shop cần hoàn tiền cho bà con — gọi shop {SĐT}"; seller băng đỏ "Cần hoàn {tổng}đ cho người mua {SĐT}"; admin thấy cột. App không chuyển tiền, không có nút "đã hoàn" (ghi nợ).

Mọi chuyển khác → **409** `bad_transition`, UI: "Đơn đã sang bước khác rồi — kéo để tải lại." Admin làm được mọi việc của seller **trên mọi shop** (LEAD §4 #2) — route `/api/admin/cho/don/[id]`, timeline `by=admin:<sđt>`.

### 4.2 Tồn kho — trừ khi nào

- **Trừ lúc TẠO đơn (T0), hoàn lúc huỷ (T5/T6/T7).** Lý do: người mua cần "đặt là chắc có hàng"; trừ lúc seller xác nhận thì hai người đặt cùng món cuối, một người bị huỷ sau khi đã tin là xong.
- **Ca đua**: 2 người mua cùng lúc, tồn còn 1. Supabase = RPC `market_place_order` (12 §2): một transaction/shop, từng dòng `UPDATE … SET stock = stock - qty WHERE id = … AND stock >= qty` (+ đúng shop, `dang_ban`, chưa xoá, không bị gỡ, giá khớp) — 0 hàng ⇒ raise ⇒ rollback cả đơn của shop đó; file-store = khoá ghi tuần tự trong process, kiểm trên bản sao rồi mới áp. Dòng nào không trừ được → **rollback cả đơn của shop đó**, trả `line_unavailable` kèm `productIds` + `available`.
- Hai request cùng `clientRef` sát nhau: cả hai qua bước "đã có chưa", request thứ hai trừ kho rồi vỡ unique `(buyerPhone, clientRef)` ⇒ **transaction đó rollback luôn phần trừ kho**, adapter đọc lại đơn cũ, trả `duplicate:true`. Không trừ đôi.
- Seller sửa tồn tay khi có đơn đang treo: cho phép (tồn là số "còn bán được", đơn treo đã trừ). Sửa tồn không đụng đơn.
- Đơn `da_huy` sau khi seller đã tăng tồn tay → hoàn tồn vẫn cộng thêm (không kiểm trần), có `// nợ:` ghi rõ (12 §12).

### 4.3 Kết thúc & thời gian

- `hoan_thanh`, `da_huy` = **đích**, không chuyển tiếp; đánh giá chỉ mở ở `hoan_thanh`.
- **Tự hoàn thành = lười khi đọc** (`settleOverdue`, LEAD §4 #3): không cron; đơn `da_giao` quá 7 ngày chuyển `hoan_thanh` ngay lượt đọc đầu tiên của bất kỳ ai (buyer, seller, admin, thống kê). Hệ quả chấp nhận: đơn không ai đọc thì treo — vô hại (không ai nhìn); thống kê luôn quét trước khi tính (12 §7 `settleOverdueForStats`).
- **TỰ HUỶ 72 GIỜ (2026-10-18, thay luật "48 giờ không tự huỷ")** — kiểu Shopee: đơn `cho_xac_nhan` quá `AUTO_CANCEL_MS` = 72 giờ ⇒ `system` huỷ (`settlePending`, gọi qua `settleOverdue`), lý do "Shop chưa xác nhận sau 3 ngày — đơn tự huỷ", hoàn kho như mọi lần huỷ, mốc ghi = `createdAt + 72h` (không phải giờ đọc). Lười khi đọc như T4' (không cron); thống kê quét `listOverduePending` trước khi đếm. Người mua nhận N7. Từ 48 giờ màn hai bên hiện đếm ngược "Còn … để xác nhận — quá hạn đơn tự huỷ" (`msUntilAutoCancel`, `AutoCancelNote`).

### 4.4 Hẹn giao (2026-10-18)

- **XÁC NHẬN = HẸN GIAO**: T1 (`cho_xac_nhan → da_xac_nhan`, shop hoặc admin) BẮT BUỘC kèm `etaFrom`/`etaTo` (ngày VN, `YYYY-MM-DD`) hoặc `etaPreset` (`hom_nay` · `ngay_mai` · `2_3_ngay` · `3_5_ngay` · `tuan_toi`). Thiếu/sai ⇒ 400 `invalid` câu của `validateEta` ("Chọn ngày giao hàng." · "không được trước hôm nay" · "tối đa 60 ngày").
- **Dời hẹn**: ở `da_xac_nhan`/`dang_giao` shop/admin gửi lại khoảng mới (không đổi trạng thái); trạng thái khác ⇒ 409.
- **Trễ hẹn** (`isLate`): `da_xac_nhan`/`dang_giao` mà `etaTo` < hôm nay ⇒ dòng đỏ "Trễ hẹn — đã hẹn giao …" ở cả hai bên. Chỉ nhắc, không tự huỷ.
- Nhãn đọc: "hôm nay" · "ngày mai" · "Thứ Năm 20/10" (trong 7 ngày) · "2/11" · khoảng "A – B" (`etaLabel`). Không giờ phút — ngoài biển giờ chính xác là lời hứa shop không giữ được.

---

## 5. Flow người mua (route theo LEAD §2 + §5 #8)

> **Quy ước đọc (vòng fix UX 2026-09-06)**: mọi chữ "SQ_BTN" trong §5–§7 đọc là **nút hành động khu chợ ≥3.5rem, chữ ≥1rem** (03 §Nút hành động mục 1b) — khu chợ KHÔNG dùng khuôn `SQ_BTN` 37px cho hành động chính/thường bấm. Mọi màn con có `MarketHeader` gọn với "‹ Quay lại". Giỏ có ô chọn dòng/shop/tất cả (§5.5); ♡ trên thẻ lưới là icon đè ảnh 2.75rem (ngoại lệ có chủ đích, 03).

Quy ước chung mọi màn `/cho/**`:
- **Đăng nhập (LEAD §5 #8, chốt)**: `/cho`, `/cho/tim`, `/cho/sp/[id]`, `/cho/shop/[slug]`, `/cho/gio` — **khách lạ XEM được**, không bọc `RequireLogin`. Cần tài khoản tại **điểm chạm**: nút Đặt hàng (giỏ) · ♡ Yêu thích · Đánh giá — hiện `LoginGate` tại chỗ ("Cần tài khoản để đặt hàng" + Đăng nhập + Gọi SDVICO, 1 lời mời/màn). `/cho/thanh-toan`, `/cho/don`, `/cho/don/[id]` bọc `RequireLogin what="đơn hàng"`. Lời mời đăng nhập **ẩn khi mất sóng** (07 §12 tầng 5).
- **Nút Gọi shop (`tel:`) KHÔNG ẩn khi mất sóng** (LEAD §4 #10 — mất data vẫn còn sóng thoại là ca thường ở bến). Chỉ lời mời đăng nhập/premium mới ẩn.
- **Mạng**: mọi fetch qua `marketGet/marketPost` (đọc 12s, ghi 20s, upload 60s) + `.catch`; màn nghe `online` tự tải lại (`useOnlineRefetch`); chip trạng thái mạng tầng 4 (`NetChip`, 1 chip/màn, tự tắt).
- **Đang tải**: skeleton/chữ "Đang tải…" (`role="status"`), **không bao giờ vẽ `null`**.
- **Lỗi máy chủ (5xx/timeout có sóng)**: "Chợ đang trục trặc, chưa tải được. Thử lại giúp." + nút Thử lại.
- **Mất sóng**: "Máy đang không có sóng — chợ cần mạng. Đơn đã đặt và giỏ vẫn xem được." (+ nút "Xem đơn của tôi"). Không hiện dữ liệu giả.
- Tiền: `formatVnd`; giá gạch chữ gạch ngang + mờ; % giảm tính tròn (`discountPercent`), chỉ hiện khi ≥5%.
- Ảnh: lazy, placeholder icon nhóm hàng khi không có ảnh/ảnh lỗi.
- Route API + tham số: nguyên văn [12 §7.1](12-kien-truc-san-thuong-mai.md) (`/api/cho/san-pham?q&category&province&sort&page`, `/api/cho/gio/tinh`, `/api/cho/don…`).

### 5.1 `/cho` — Chợ vật tư (trang chủ chợ)

- **Mục đích**: vào là tìm/chọn được ngay; nhìn thấy đơn đang chạy.
- **Key (C1)**: ô tìm (1 chạm vào bàn phím) · dải chip 9 nhóm hàng (đúng thứ tự `PRODUCT_CATEGORIES`) · nút Giỏ (badge số món) · nút Đơn hàng (badge số đơn chưa kết thúc, từ cache).
- **Nội dung**: (1) nếu có đơn ở trạng thái `dang_giao`/`da_giao` (từ cache) → 1 thẻ "Đơn đang tới: … · Đã giao — bấm Đã nhận hàng" (tối đa 1 thẻ, mới nhất); (2) "Mua lại" — tối đa 6 món từ đơn `hoan_thanh` gần nhất (từ cache đơn, không gọi thêm API); (3) **"Gần bà con — {tỉnh}"** khi máy biết tỉnh cảng nhà (`loadHome().province`): 10 món của shop cùng tỉnh, mới nhất (`province=`) — LEAD §4 #11 "cùng tỉnh trước"; (4) "Món mới lên chợ" 20 món mới nhất toàn sàn; (5) Yêu thích (nếu có).
- **Hành động → thấy ngay**: gõ + Enter/chạm nút tìm → `/cho/tim?q=`; chạm chip nhóm → `/cho/tim?category=`; chạm thẻ món → `/cho/sp/[id]`; nút "+ Giỏ" trên thẻ (món KHÔNG có biến thể) → thêm 1, nút đổi "Đã thêm (n)" 3s, badge giỏ tăng (không cần đăng nhập); món có biến thể → nút "Chọn" mở trang SP.
- **Ma trận**: **0 sản phẩm toàn sàn** → "Chợ chưa có món nào. SDVICO đang mời các đại lý lên sàn." (KHÔNG mời "đăng bán" cho ngư dân) · khối "Gần bà con" rỗng → ẩn khối, không nói gì · đang tải → skeleton 6 thẻ · lỗi/mất sóng → như quy ước, nhưng **Giỏ + Đơn hàng + Mua lại + Yêu thích vẫn bấm được** (local/cache) · 500+ sản phẩm → chỉ 20 món mới nhất, không cuộn vô tận ở trang chủ.

### 5.2 `/cho/tim` — Tìm / danh sách

- **Key**: ô tìm (giữ chữ) · chip nhóm đang chọn · **chip "Gần tôi"** (bật = lọc `province` = tỉnh cảng nhà; máy chưa biết tỉnh → chip ẩn) · nút Sắp xếp (sheet: Mới nhất · Bán chạy · Giá thấp→cao · Giá cao→thấp) · danh sách thẻ.
- **API**: `GET /api/cho/san-pham?q=&category=&province=&sort=&page=` — 20/trang, nút "Xem thêm" (không vô tận tự động — tiết kiệm pin/mạng), trả `total`.
- **Tìm**: server `ilike` trên `search_text` (không dấu, chữ thường — `foldVn`); hiện món `dang_ban` **và** `het_hang` (mờ, nhãn "Hết hàng" — để bà con biết shop có bán); món của shop `cho_duyet/tam_khoa/tu_choi`, `adminHidden`, `an`, đã xoá → **không bao giờ** xuất hiện; shop `paused` → vẫn hiện, thẻ có chip "Tạm nghỉ".
- **Ma trận**: 0 kết quả → "Không thấy món nào cho “…”. Thử chữ ngắn hơn (vd: “lọc dầu”) hay chọn nhóm hàng." (đang bật Gần tôi → thêm "hoặc tắt Gần tôi") · kết quả 1 trang → ẩn Xem thêm · 500 kết quả → "Xem thêm" 25 lần, có dòng "Đang xem 40/500" · lỗi trang 2 → giữ 20 món đã có + dòng lỗi dưới cùng + Thử lại (không xoá danh sách) · mất sóng → nếu đã có kết quả thì giữ + chip "Không có sóng — đang xem kết quả đã tải"; chưa có → màn quy ước.

### 5.3 `/cho/sp/[id]` — Trang sản phẩm

- **Key**: ảnh bìa (vuốt ngang ≤6) · tên · giá (+ giá gạch) · **chọn loại/cỡ** (chip, bắt buộc khi có biến thể; giá đổi theo, tồn CHUNG) · QtyStepper · **nút "Thêm vào giỏ"** (nút chính duy nhất → full-width theo ngoại lệ 03; **không có "Mua ngay"**) ; hàng shop [tên shop · tỉnh · ★x.x] → `/cho/shop/[slug]` (KHÔNG có nút Gọi trùng — "Gọi shop" chỉ ở thanh đáy, F-14 2026-09-06); dòng "★ x (n) / Chưa có đánh giá · Đã bán N · Còn M" ngay dưới giá, ♡ cùng hàng tiêu đề; "Đã bán N"; "Còn M {unit}" khi M ≤ 20, ngược lại "Còn hàng"; mô tả (thu gọn 4 dòng + "Xem thêm"); đánh giá (5 mới nhất + "Xem tất cả" mở sheet, không có đánh giá ẩn); nút ♡ Yêu thích ở hàng tiêu đề.
- **Hành động → thấy ngay**: chọn loại → giá đổi theo; Thêm vào giỏ → nút đổi "Đã thêm (n) · Xem giỏ" 3s, badge tăng; qty > tồn → clamp về tồn + dòng "Chỉ còn M"; ♡ → chưa đăng nhập ⇒ `LoginGate` inline; đã đăng nhập ⇒ tô đầy + "Đã lưu" (local, không cần mạng); Gọi → `tel:` (**không ẩn khi mất sóng**).
- **Ma trận**: đang tải → skeleton · 404/đã xoá/bị gỡ → "Món này không còn trên chợ." + nút Về chợ · shop `≠ hoat_dong` → "Shop này đang tạm đóng." + nút Thêm vào giỏ **ẩn** · shop `paused` → băng vàng "Shop đang tạm nghỉ, mở lại sau" + nút **vô hiệu** (♡ vẫn dùng được) · hết hàng → nút "Hết hàng" vô hiệu + gợi ý ♡ · giỏ đã 50 dòng → "Giỏ đầy rồi…" · máy hết chỗ → băng đỏ, KHÔNG tăng badge · mất sóng → nếu vào từ danh sách đã tải: hiện tên/giá/ảnh đã có trong bộ nhớ trang trước (không có thì màn quy ước); "Thêm vào giỏ" **vẫn chạy** (local) nhưng ghi "giá lúc HH:MM, sẽ tra lại khi có sóng".

### 5.4 `/cho/shop/[slug]` — Trang shop

- **Key**: tên · tỉnh + địa chỉ · ★ trung bình (N đánh giá) · "Giao: {shippingFlat}đ · miễn phí từ {freeShipFrom}đ" (hoặc "Giao: miễn phí" / "Giao: {fee}đ") · ô SQ_BTN Gọi · giới thiệu (thu gọn) · băng vàng "Shop đang tạm nghỉ, mở lại sau" khi `paused` · chip nhóm hàng của shop · danh sách món (20/trang như 5.2).
- **Ma trận**: shop `cho_duyet/tu_choi/tam_khoa` (403 `shop_not_active`) → "Shop này đang tạm đóng." (không lộ lý do) · slug lạ (404) → "Không tìm thấy shop này." · 0 món → "Shop chưa đăng món nào." · còn lại như 5.2.

### 5.5 `/cho/gio` — Giỏ hàng

- **Ô chọn (vòng fix UX 2026-09-06, F-05)**: ô chọn 3.5rem ở từng dòng · đầu mỗi shop · hàng "Chọn tất cả (n/N)"; **mặc định chọn hết**, dòng mới thêm tự được chọn. Tổng tạm, phí giao từng shop và nút **"Đặt hàng (n)"** chỉ tính dòng đang chọn; **dòng bỏ chọn giữ nguyên trong giỏ**. Phần bỏ chọn lưu cùng khoá `forfish.mcart.v1` (`off[]`, tỉa khi dòng rời giỏ). Không chọn dòng nào ⇒ nút vô hiệu + "Chọn ít nhất một món để đặt." Khách lạ bấm Đặt hàng / ♡ ⇒ lời mời đăng nhập là **BottomSheet** ("Đăng nhập để đặt hàng" / "…để lưu món") — không phải thẻ inline dưới danh sách (F-01/F-20).

- **Key**: danh sách theo **nhóm shop** [tên shop (+ chip "Tạm nghỉ")] → dòng món [ảnh · tên · loại · giá × QtyStepper · ô SQ_BTN Bỏ] → "Tiền hàng shop này: … · Giao: …" ; **thanh ghim đáy** 1 hàng: "N món · Tổng tạm: …" + SQ_BTN "Đặt hàng".
- Vào màn: `POST /api/cho/gio/tinh` tra lại toàn bộ → cập nhật giá/tồn/cờ mua được, cất `quote`; giá đổi so với lần tra trước → dòng vàng dưới món "Giá vừa đổi: 120.000đ → 125.000đ".
- **Món không mua được** (`dropped`): thẻ mờ + lý do 1 dòng (`DROP_LABEL`: "Hết hàng" · "Chỉ còn M" · "Shop đang tạm đóng" · "Shop đang tạm nghỉ, mở lại sau" · "Món này không còn trên chợ" · "Shop đã ngừng bán món này" · "Loại/cỡ này không còn") + SQ_BTN Bỏ; **không tính vào tổng**; nút Đặt hàng vẫn bấm được nếu còn ≥1 món mua được, màn Đặt hàng chỉ mang món mua được.
- **Hành động → thấy ngay**: − / + → tổng shop + tổng tạm đổi ngay; + vượt tồn → clamp + "Chỉ còn M"; Bỏ → KHÔNG ConfirmDialog cho 1 món (bấm là bỏ, dòng "Đã bỏ … · Hoàn lại" 5s); "Bỏ hết" (hàng tiêu đề) → ConfirmDialog; Đặt hàng → chưa đăng nhập ⇒ `LoginGate` ("Cần tài khoản để đặt hàng"); đã đăng nhập ⇒ `/cho/thanh-toan`.
- **Ma trận**: giỏ rỗng → EmptyState "Giỏ đang trống" + nút Đi chợ · mất sóng → hiện từ bản tra gần nhất + chip "giá lúc HH:MM — có sóng sẽ tra lại", nút **Đặt hàng vô hiệu** + câu "Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên." · chưa từng tra được → chỉ hiện số dòng + "Chưa tải được giá — máy không có sóng" · máy hết chỗ → băng đỏ tầng 2 · 50 dòng → dòng "Giỏ đã đủ 50 món" · một shop > 20 dòng → nút Đặt hàng vô hiệu + "Mỗi đơn tối đa 20 món — tách bớt sang lần đặt sau" · tất cả món không mua được → nút Đặt hàng vô hiệu + "Không còn món nào mua được trong giỏ".

### 5.6 `/cho/thanh-toan` — Đặt hàng (nhãn màn: **"Đặt hàng"**)

- **Vòng fix UX 2026-09-06**: chỉ mang **dòng đang chọn** ở giỏ (F-05); sheet địa chỉ **chỉ tự mở khi danh tính đã sẵn (`ready`) mà chưa có địa chỉ nào** (F-02 — bản cũ mở đè màn dù đã có địa chỉ); sheet tách hai bước: danh sách đã lưu → "+ Thêm địa chỉ mới" → form; tỉnh là `<select>` nền tảng, tỉnh cảng nhà đứng đầu; câu lỗi đặt ngay dưới ô sai + focus ô (F-11); tóm tắt món có ảnh 3rem + cột "× N" cố định (F-03/F-06); chip Chuyển khoản **hiện mờ (disabled)** + lý do ngay dưới khi có shop không nhận CK (F-16, thay cho ẩn hẳn); màn kết quả có thêm "Mua tiếp" (F-09). **Vòng 2 (cùng ngày)**: ghi chú **theo từng shop** thay ô chung.

- **Vào từ**: nút Đặt hàng ở giỏ (đã đăng nhập); chỉ mang dòng mua được; **không có sóng thì không vào được** (nút đã vô hiệu).
- **Key (C1)**: (1) **Địa chỉ nhận** — 1 dòng đọc-được "Nhận: {tên} · {SĐT} · {cảng/địa chỉ}, {tỉnh}" + SQ_BTN "Đổi" (mở sheet chọn/thêm địa chỉ; máy đã biết tên/SĐT/tỉnh cảng nhà (`seedAddress`) nên lần đầu chỉ cần điền **cảng hoặc địa chỉ**); (2) **Cách trả tiền** — 2 chip: "Trả khi nhận hàng" (mặc định) · "Chuyển khoản" — **một cách chung cho cả lần đặt (LEAD §4 #9)**; có shop KHÔNG `acceptsBankTransfer` ⇒ chip Chuyển khoản **ẩn** + dòng nhỏ "Shop X chỉ nhận tiền mặt — lần đặt này trả khi nhận hàng"; (3) **Tóm tắt theo shop**: thẻ mỗi shop [tên shop · k món · tiền hàng · phí giao (hoặc "Miễn phí giao") · **Thành tiền shop**] + ô **"Ghi chú cho {tên shop} (không bắt buộc)"** NGAY TRONG khối shop đó (2026-09-06: một lời dặn chung cho mọi shop là sai — mỗi shop một việc khác nhau; KHÔNG còn ô ghi chú chung); (4) **Dòng chốt**: "**Sẽ tạo N đơn cho N shop** · Tổng: …" — nói rõ vì bà con quen 1 đơn; (5) nút chính **"Đặt hàng"** full-width (nút chính duy nhất) + dòng "Không trả tiền trong app. Trả khi nhận hoặc chuyển khoản thẳng cho shop."
- **Gửi**: `POST /api/cho/don` body `CheckoutDraft = {shops: [{shopId, items[{productId, variantLabel?, qty}], clientRef, expectedTotalVnd, buyerNote?}], address, paymentMethod, buyerNote?}` — `shops[].buyerNote` = ghi chú RIÊNG của shop đó (≤ 300 chữ), thiếu thì đơn dùng `buyerNote` chung; `clientRef` = `marketOrderClientRef` tính KÈM ghi chú sẽ đi vào đơn của chính shop đó (LEAD §4 #6 — sửa lời dặn một shop chỉ sinh đơn mới cho shop đó); nút → "Đang gửi…" vô hiệu; **client không gửi lần 2 khi đang gửi**; timeout 20s.
- **Server** tạo **từng đơn shop độc lập** (đơn A thành, đơn B hết hàng thì A vẫn tạo — LEAD §4 #5). Trả `results[]` mỗi phần tử `{shopId, ok:true, order, duplicate}` | `{shopId, ok:false, code: line_unavailable|price_changed|shop_not_active|shop_paused|insert_failed, productIds, available?, quote?}`; `duplicate:true` = đã có `(buyerPhone, clientRef)` → trả đơn cũ như thành công (idempotent). Chuyển khoản mà có shop không nhận CK ⇒ **400** "Shop X chỉ nhận tiền mặt…" (lưới — client đã ẩn chip).
- **Sau khi gửi — thấy ngay** (không toast, thẻ inline như đặt hàng SDVICO):
  - Tất cả OK → màn "Đã đặt N đơn": mỗi đơn 1 thẻ [mã · shop · tổng · cách trả] + với `chuyen_khoan`: khối STK từ `order.bankSnapshot` + nội dung CK = mã đơn + nút "Sao chép số TK"; nút "Xem đơn hàng" → `/cho/don`; **xoá khỏi giỏ đúng những dòng đã đặt được** (`removeShopLines`).
  - Một phần OK → cùng màn, đơn hỏng hiện thẻ đỏ "Chưa đặt được với shop X: {lý do}" + nút "Về giỏ sửa lại"; **giỏ giữ lại dòng của shop hỏng**, cập nhật tồn/giá mới vào bản tra.
  - `price_changed` → "Giá vừa đổi ở shop X — tổng mới …đ. Xem lại rồi bấm Đặt hàng lần nữa." (server trả `quote` mới; client cập nhật `expectedTotalVnd`, KHÔNG tự đặt lại).
  - `line_unavailable` → "Shop X chỉ còn M {unit} món …" → về giỏ, qty tự hạ về `available` (0 → thẻ mờ Hết hàng).
  - `shop_not_active` / `shop_paused` → "Shop X vừa tạm đóng" / "Shop X vừa tạm nghỉ — thử lại sau".
  - Timeout/mất sóng khi gửi → "Chưa rõ đã gửi được chưa — máy mất sóng giữa chừng. Có sóng lại bà con bấm Đặt hàng lần nữa: cùng nội dung thì máy chủ **không tạo đơn đôi**." Giỏ giữ nguyên.
- **Ma trận**: chưa có địa chỉ nào → sheet địa chỉ mở sẵn, nút Đặt hàng vô hiệu tới khi có · 20+ dòng 1 shop → đã chặn từ giỏ · > 5 shop → chặn từ giỏ "Mỗi lần đặt tối đa 5 shop" · bấm đúp → 1 request (state `sending`) + `clientRef` chặn ở server.

### 5.7 `/cho/don` — Đơn hàng của tôi

- **Key**: chip lọc: Đang xử lý (`cho_xac_nhan`+`da_xac_nhan`+`dang_giao`) · Chờ nhận (`da_giao`) · Xong (`hoan_thanh`) · Đã huỷ; thẻ đơn [mã · shop · tóm tắt "Dầu DO ×2, Đá cây ×10" · tổng · chip trạng thái · mốc cập nhật] + **ô hành động tiếp theo** (SQ_BTN): `cho_xac_nhan` → "Huỷ"; `da_giao` → "Đã nhận"; `chuyen_khoan ∧ chua_thanh_toan` → "Đã CK"; khác → không nút (chừa ô).
- Server áp `settleOverdue` trước khi trả (đơn `da_giao` > 7 ngày về thẳng tab Xong).
- **Cache**: `forfish.morders.v1` ngăn SĐT (pattern `loadCachedOrders`, ≤50 đơn); mất sóng → hiện bản lưu + "Đang xem đơn đã lưu trong máy (N phút trước) — có sóng sẽ tự tải mới"; nghe `online` tự tải.
- **Ma trận**: 0 đơn → "Chưa có đơn nào" + nút Đi chợ · mất sóng chưa từng tải → 1 câu tầng 4 + Thử lại · huỷ khi mất sóng → "Chưa huỷ được — việc này cần có mạng…" (câu sẵn có) · đơn > 50 → phân trang 20 + Xem thêm, cache 50 đơn gần nhất.

### 5.8 `/cho/don/[id]` — Chi tiết đơn

- **Key**: mã đơn (to, chọn-sao-chép được) · chip trạng thái · **dòng thời gian** (Đặt 09:00 → Đã xác nhận 09:40 → Đang giao (Gửi xe Phương Trang · mã 123) → … ; mục thanh toán xen kẽ; `by=admin:…` hiện "SDVICO") · dòng hàng · tiền hàng + phí giao + **Tổng** · Nhận tại · Trả tiền: cách + trạng thái (COD: "Trả khi nhận hàng"; CK: STK từ `bankSnapshot` + nội dung + "Chưa chuyển / Đã báo chuyển — chờ shop xác nhận / Shop đã nhận tiền") · Ghi chú của tôi · Ghi chú của shop (nếu có) · hàng shop + SQ_BTN **Gọi shop** (không ẩn offline).
- **Nút hành động theo trạng thái** (mỗi hành động → ConfirmDialog nêu rõ, rồi dòng inline 8s): Huỷ đơn (`cho_xac_nhan`) → "Đã huỷ đơn …" ; Tôi đã chuyển khoản (`chuyen_khoan ∧ chua_thanh_toan`) → "Đã báo shop — shop kiểm tra rồi xác nhận" ; **Đã nhận hàng** (`da_giao`, nút chính) → "Cảm ơn bà con. Đánh giá món hàng?" + nút Đánh giá ; Đánh giá (`hoan_thanh`, món chưa đánh giá) → nút **full-width ở HÀNG RIÊNG dưới dòng món** (2026-09-06 R-01: nhét cùng hàng với ảnh + tên + thành tiền thì cột tên còn 48px và số tiền đè lên chữ) → sheet sao + chữ → "Đã gửi đánh giá".
- **Mua lại** (2026-09-06; `hoan_thanh` hoặc `da_huy`): nút chữ 3.5rem full-width — tra lại các món của đơn bằng `POST /api/cho/gio/tinh` rồi thêm **món còn bán** vào giỏ, trả lời tại chỗ "Đã thêm N món vào giỏ. M món không còn bán." + đường "Xem giỏ (n)"; giỏ đầy / máy hết chỗ nói thẳng; **mất sóng vẫn thêm** (giỏ là việc của máy) kèm câu "Chưa kiểm được món nào còn bán (mất sóng) — xem lại ở giỏ giúp."
- **Ma trận**: `da_huy` do seller/admin → khối đỏ "Shop đã huỷ: {lý do}" (+ "Shop cần hoàn tiền cho bà con — gọi shop" khi `needsRefund`) · `bao_da_chuyen` bị trả về `chua_thanh_toan` (P3) → khối vàng "Shop chưa thấy tiền: {lý do} — kiểm tra lại giao dịch hoặc gọi shop" · `cho_xac_nhan` > 48h → dòng "Shop chưa xác nhận sau 2 ngày" · 404/không phải đơn của mình → "Không tìm thấy đơn này." · mất sóng → đọc từ cache nếu có; nút ghi vô hiệu + câu quy ước.

---

### 5.9 `/cho/yeu-cau` · `/cho/yeu-cau/moi` · `/cho/yeu-cau/[id]` — ĐẶT MÓN CHỢ CHƯA CÓ (2026-10-18)

- **Lối vào**: thẻ "Cần món chợ chưa có?" ở `/cho` (trên "Gần bà con") · dòng "Không thấy đúng món? Nhờ chủ sàn tìm …" dưới kết quả `/cho/tim` (mang `?ten=`) · thẻ "Yêu cầu đặt hàng của tôi" đầu `/cho/don` · Sen Biển ("nhờ chủ sàn tìm 2 cái chân vịt…" ⇒ mở phiếu điền sẵn `?ten=&sl=&dv=`).
- **Phiếu** (`RequestForm`): tên món (3–120) · số lượng (1–9999) + đơn vị · mô tả (≤1000) · cần trước ngày (tuỳ chọn, ≥ hôm nay) · địa chỉ (CÙNG sổ địa chỉ với Đặt hàng `forfish.maddr.v1`) · cách trả. Nút **Gửi cho chủ sàn** = cú chạm xác nhận. Tối đa 10 yêu cầu đang chờ báo giá/người.
- **Máy trạng thái** (`request-state.ts`): `moi` →(admin) `da_bao_gia` | `khong_tim_duoc` · `da_bao_gia` →(admin báo lại) `da_bao_gia` · →(chủ tàu) `da_dat` | `da_huy` · `moi`→(chủ tàu) `da_huy` · hết hạn lười (`system`): báo giá quá **3 ngày** ⇒ `het_han`; yêu cầu `moi` quá **7 ngày** ⇒ `het_han` ("Chủ sàn chưa trả lời sau 7 ngày — bà con gửi lại giúp"). `da_dat`/`khong_tim_duoc`/`da_huy`/`het_han` là đích.
- **Báo giá** = tiền hàng (cả số lượng) + phí giao + hẹn giao + shop lo hàng (shop đang hoạt động do chủ sàn chọn) + lời dặn. Chủ tàu thấy tổng, hẹn giao, shop, hạn giữ giá.
- **ĐỒNG Ý ĐẶT** (ConfirmDialog nói rõ tổng + hẹn giao) ⇒ sinh MỘT đơn thường của shop đã chọn: 1 dòng hàng (`productId` = id yêu cầu — hoàn kho khi huỷ không đụng kho ai), **vào thẳng `da_xac_nhan` kèm hẹn giao của báo giá** (chủ sàn đã nhận lời lúc báo giá), `requestId`, `clientRef = yc:<id>` (bấm hai lần không ra hai đơn); rồi đi tiếp luồng đơn như mọi đơn (shop giao, buyer nhận, đánh giá). Chuyển khoản mà shop không có STK ⇒ 409 "gọi chủ sàn đổi cách trả". Shop lo hàng vừa tạm nghỉ ⇒ 409.
- **Ma trận**: đang tải (khung xương) · lỗi (ErrorBlock thử lại) · mất sóng (bản lưu `forfish.myc.v1` + tuổi bản lưu; nút gửi/đồng ý/huỷ vô hiệu kèm "cần có sóng") · trống ("Chưa có yêu cầu nào…") · hết hạn (dòng lý do + "Gửi lại" mang `?ten=`) · không tìm được (băng đỏ lý do).

## 5b. NGƯỜI MUA CHỈ CÓ BA VIỆC — Tìm món · Mua hàng · Xem đơn (chủ dự án chốt 2026-09-08)

> Nguyên văn: *"giữ sàn đầy đủ phía sau, nhưng phía người mua chỉ tập trung vào ba việc: Tìm món — Mua hàng — Xem đơn. Sen Biển hỗ trợ ngay tại chỗ để bà con đỡ phải chuyển màn."*
>
> Sàn đa người bán ở §1–§5 **giữ nguyên** (shop, duyệt, tồn kho, đơn theo shop). Mục này chỉ nói phía **người mua nhìn thấy gì** và **đi lại ra sao**.

**Thứ tự làm, do chủ dự án chốt** — ba bước đầu chữa đúng chỗ rối, chưa thêm tính năng mới:

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Giữ trạng thái danh sách + sửa điều hướng | ĐANG LÀM 2026-09-08 |
| 2 | Khung xem nhanh sản phẩm ngay trên danh sách | chưa |
| 3 | Sen Biển hiểu món và việc đang làm | chưa |
| 4 | Mua lại nhanh | chưa |

### 5b.1 Màn đầu cửa hàng — thứ tự ưu tiên

| Thứ tự | Khối | Điều kiện hiện |
|---|---|---|
| 1 | Ô lớn **"Bác cần mua gì?"**, có nút nói | luôn |
| 2 | **Đơn đang giao** | chỉ khi có đơn chưa xong |
| 3 | **Mua lại món cũ** | chỉ khi đã từng mua |
| 4 | Nhóm hàng + danh sách sản phẩm | luôn |

- **Giỏ hàng luôn dễ tìm**: có CHỮ và SỐ LƯỢNG, không phải mỗi cái icon.
- **Kênh người bán chuyển vào Tài khoản** — giao diện mua hàng chỉ còn việc mua.

### 5b.2 Giữ trạng thái — luật quan trọng nhất

> Đây là thay đổi chữa đúng cảm giác *"nhảy qua nhảy lại"*. Trước 2026-09-08, `market-search` giữ tìm/lọc/sắp xếp/số món đã tải trong `useState`: mở một món rồi Quay lại là **mất sạch**, bà con phải gõ lại chữ tìm, chọn lại nhóm, cuộn lại từ đầu.

Khi rời danh sách rồi quay lại (nút Quay lại, back của máy, đóng khung xem nhanh) phải giữ NGUYÊN:

| Giữ | Vì sao |
|---|---|
| chữ đang tìm | gõ lại trên tàu, tay ướt, là việc nặng |
| nhóm hàng + lọc gần + thứ tự sắp xếp | bà con đã chọn xong một lần |
| **số món đã tải** (đã bấm "Xem thêm" mấy lần) | tải lại từ trang 1 là tốn sóng và mất chỗ |
| **vị trí cuộn** | quay lại phải thấy đúng món vừa xem |

Phạm vi giữ: **trong một phiên** (`sessionStorage`, không sao lưu, không qua máy khác). Mở app mới = danh sách mới.

### 5b.3 Đường đi và đường về

| Luật | Chốt |
|---|---|
| Dock trong sàn | đánh dấu **Giao dịch** — không để bà con đứng trong cửa hàng mà không ô nào sáng |
| Quay lại | về màn vừa xem trong app; mở từ liên kết ngoài thì về **Cửa hàng** |
| Sau khi đặt | hiện **"Đã đặt hàng"** + nút **"Theo dõi đơn"**; Quay lại **KHÔNG** đưa về biểu mẫu đặt hàng cũ |
| Tên gọi | dùng thống nhất **"Cửa hàng"** trên mọi giao diện (2026-09-07 đã đổi 35 chỗ) |

### 5b.4 Xem nhanh sản phẩm (bước 2)

- Chạm món → **khung xem nhanh ngay trên danh sách**: ảnh, giá, loại/cỡ, số lượng, nút Thêm vào giỏ.
- Đọc mô tả hoặc đánh giá đầy đủ mới mở trang chi tiết.
- Thêm xong **giữ nguyên màn**, báo *"Đã thêm 2 chai — Xem giỏ"*, chọn tiếp món khác được ngay.

### 5b.5 Sen Biển hiểu món và việc đang làm (bước 3)

Bot phải biết: **đang xem món nào · đã chọn loại gì · đang tìm gì · vừa hỏi gì trong phiên**.

| Bà con nói | Sen Biển làm |
|---|---|
| đang xem dầu, hỏi *"có can 20 lít không?"* | tra biến thể của ĐÚNG món đang xem |
| đang tìm lưới, nói *"loại rẻ hơn"* | cập nhật kết quả ngay trên danh sách hiện tại |
| *"lấy hai cái này"* | hiện đúng món, loại, số lượng, tiền để chạm xác nhận |
| *"đơn tới đâu rồi?"* | trả trạng thái ngay trong bot; cần chi tiết mới mở đơn |
| *"mua như lần trước"* | cho chọn đơn cũ, **kiểm lại giá và tồn** rồi mới xác nhận thêm giỏ |

**Hai luật cứng**: hỏi thông tin thì **trả lời tại chỗ**, chỉ chuyển màn khi bà con bảo mở; **không tự điều hướng** giữa lúc bà con đang đọc câu trả lời. Ngữ cảnh giữ khi đóng/mở bot trong phiên, đổi món thì cập nhật theo món mới. Chưa rõ *"cái này"* là món nào thì **hỏi một câu ngắn kèm lựa chọn, không đoán**.

### 5b.6 Thông minh nhưng dễ kiểm soát

- Nhớ địa chỉ giao và lựa chọn quen, **cho sửa ngay**.
- Giá hoặc tồn đổi → **chỉ rõ MÓN NÀO đổi**, không báo chung chung.
- Mất sóng → **giữ giỏ và nội dung đang nhập**, nói rõ chưa đặt được (không nuốt lỗi im — án lệ `saveUserJson`).
- Gợi ý hàng dựa trên nhu cầu, giá và **dữ liệu sản phẩm có thật**; thiếu thông tin thì nói thiếu.

---

## 6. Flow người bán (`/ban-hang/**`)

Quy ước: cần đăng nhập (`RequireLogin what="kênh người bán"`) → tra `GET /api/ban-hang/shop` (ghi cờ `forfish.mshop.v1`) → rẽ nhánh: chưa có shop → thẻ "Mở gian hàng trên SDFish" → `/ban-hang/dang-ky`; `cho_duyet` → màn chờ; `tu_choi` → màn từ chối; `hoat_dong`/`tam_khoa` → Tổng quan. Mọi ghi = online-only. Lối vào: sheet Tài khoản (LEAD §4 #16): có shop → dòng "Kênh người bán"; chưa có → dòng mờ "Bà con có bán vật tư? Đăng ký shop"; chưa biết + mất sóng → ẩn cả hai. Route API nguyên văn [12 §7.2](12-kien-truc-san-thuong-mai.md).

### 6.1 `/ban-hang/dang-ky` — Đăng ký shop

- **Key**: tên shop · SĐT liên hệ (điền sẵn) · tỉnh (chip) · địa chỉ · giới thiệu · logo (tuỳ chọn, 1 ảnh) · **Phí giao** (MoneyField, mặc định 0) + **Miễn phí giao từ** (tuỳ chọn) · **STK ngân hàng** thu gọn sau SQ_BTN "Thêm STK" (tuỳ chọn — không có thì shop chỉ nhận tiền mặt, nói rõ 1 dòng "Không có STK thì bà con chỉ trả được khi nhận hàng") · nút chính "Gửi đăng ký" full-width + dòng "SDVICO duyệt trong 1–2 ngày làm việc, có thể gọi xác minh."
- **Validate** §3.1, lỗi inline dưới ô, cuộn tới ô lỗi đầu.
- **Gửi** `POST /api/ban-hang/shop` → 201 → màn chờ; 409 `invalid` "Số này đã có shop rồi…" → chuyển thẳng vào shop hiện có; 409 `slug_taken` → lỗi dưới ô tên "Tên shop này đã có người dùng — chọn tên khác."
- **Ma trận**: mất sóng → nút vô hiệu + "Đăng ký cần có sóng" · timeout → "Chưa gửi được — thử lại" (không mất form) · đã có shop `tu_choi` → form điền sẵn dữ liệu cũ + băng "Lần trước bị từ chối: {lý do}" → gửi lại = cùng shop, về `cho_duyet`.

### 6.2 Màn chờ duyệt / bị từ chối / bị khoá

- `cho_duyet`: "Shop **{tên}** đang chờ SDVICO duyệt. Bà con vẫn **thêm sản phẩm trước** được — món chỉ hiện lên chợ sau khi duyệt." + nút "Thêm sản phẩm" (→ 6.4; server cho `POST san-pham` ở `cho_duyet`) + Gọi SDVICO + "Sửa đăng ký". Nghe `online`/mở lại màn → tra lại trạng thái.
- `tu_choi`: "SDVICO chưa duyệt shop: {lý do}. Sửa lại rồi gửi lần nữa." + nút Sửa đăng ký + Gọi SDVICO.
- `tam_khoa`: băng đỏ trên mọi màn `/ban-hang`: "Shop đang bị tạm khoá: {lý do}. Gọi SDVICO để mở lại." — **vẫn xử lý được đơn đang treo** (T1–T3, T6, P2/P3 — route `PATCH don/[id]` không đòi `hoat_dong`) để không bỏ rơi người mua đã đặt; KHÔNG thêm/sửa/hiện sản phẩm (403 `shop_not_active`); không nhận đơn mới (server chặn T0).
- `paused` (tự bật ở 6.6): băng vàng ở Tổng quan "Shop đang tạm nghỉ — bà con không đặt được" + nút "Mở bán lại"; mọi thứ khác bình thường.

### 6.3 `/ban-hang` — Tổng quan

- **Key**: 3 ô số **cần làm ngay**: "Chờ xác nhận N" · "Đang giao N" · "Báo đã CK N" (`pendingOrders` · `shippingOrders` · `awaitingPaymentConfirm`; mỗi ô chạm → `/ban-hang/don?tab=`); dải 3 chip Hôm nay / 7 ngày / 30 ngày (`GET thong-ke?range=today|7d|30d`) → "Đơn: a · Hoàn thành: b · Doanh thu (đơn hoàn thành): …đ"; "Bán chạy" top 5 món theo số lượng trong kỳ; "Sắp hết hàng" (tồn ≤ 3); 4 lối: Sản phẩm · Đơn hàng · Cài đặt shop · Xem shop trên chợ (→ `/cho/shop/[slug]`).
- Doanh thu = `sum(totalVnd)` đơn `hoan_thanh` có `completedAt` trong kỳ (giờ VN) — **là tiền hàng + ship về tay shop, KHÔNG trừ gì**, ghi chú 1 dòng "tính theo đơn hoàn thành". Server áp `settleOverdue` toàn shop trước khi tính.
- **Ma trận**: shop mới 0 đơn → số 0 + "Chưa có đơn nào. Thêm sản phẩm để bà con thấy shop." · lỗi → Thử lại · mất sóng → "Kênh người bán cần có sóng." (không cache thống kê).

### 6.4 `/ban-hang/san-pham` + `/ban-hang/san-pham/[id]` — Sản phẩm

- **Danh sách**: chip Đang bán · Đã ẩn · Hết hàng · Bị gỡ (`adminHidden`); thẻ [ảnh · tên · giá · tồn · đã bán] + SQ_BTN "Sửa"; hàng tiêu đề SQ_BTN "Thêm". Món đã xoá không hiện.
- **Form (C1)**: key = **ảnh · tên · nhóm · giá · tồn · đơn vị**; thu gọn sau nút: giá gạch · loại/cỡ · mô tả · Ẩn/Hiện. Ảnh: chọn/chụp → client resize ≤1024px JPEG 0.8 (LEAD §2) → upload từng ảnh với thanh tiến trình, ảnh lỗi upload → thẻ đỏ + Thử lại ảnh đó (không chặn ảnh khác); >400KB sau nén → "Ảnh quá lớn, chụp lại gần hơn". Loại/cỡ: bật công tắc "Món có nhiều loại/cỡ" → danh sách [nhãn · giá riêng (tuỳ chọn)] (+ dòng), tối thiểu 2 tối đa 10; **tồn kho vẫn chung** — dòng nhỏ "Tồn kho tính chung cho mọi loại".
- **Hành động → thấy ngay**: Lưu → về danh sách, thẻ mới ở đầu, dòng "Đã lưu {tên}" 5s; Ẩn/Hiện (SQ_BTN trong form) → chip đổi; "Hết hàng" nhanh = đặt tồn 0 (SQ_BTN trên thẻ, không ConfirmDialog, có "Hoàn lại" 5s); Xoá → ConfirmDialog "Xoá {tên}? Đơn cũ vẫn giữ tên và giá lúc đặt." → xoá mềm (`deletedAt`, không hiện với ai, đơn cũ vẫn có snapshot, ảnh giữ).
- **Ma trận**: 0 món → EmptyState + nút Thêm · món `adminHidden` → thẻ có băng đỏ "SDVICO đã gỡ: {lý do}" + nút Gọi SDVICO, nút Hiện vô hiệu · shop `tam_khoa`/`tu_choi` → nút Thêm/Sửa/Xoá vô hiệu + băng 6.2 · lưu khi mất sóng → "Chưa lưu được — cần sóng. Nội dung vẫn ở trên màn." (không xoá form) · máy chủ 5xx → như trên + Thử lại · 500 món → phân trang 20 + ô tìm theo tên trong shop.

### 6.5 `/ban-hang/don` + `/ban-hang/don/[id]` — Đơn hàng

- **Danh sách**: tab theo trạng thái (Chờ xác nhận · Đã xác nhận · Đang giao · Đã giao · Hoàn thành · Đã huỷ) + badge số (`stats.byStatus`); thẻ [mã · người nhận · tỉnh/cảng · tóm tắt món · tổng · cách trả (+ "Báo đã CK" vàng khi `bao_da_chuyen`) · tuổi đơn ("2 giờ trước")]; đơn chờ >48h băng vàng.
- **Chi tiết**: mọi thứ buyer thấy (5.8) + SĐT người nhận + SQ_BTN **Gọi người mua** (không ẩn offline) + ô "Ghi chú cho người mua" (`sellerNote`, lưu độc lập bằng SQ_BTN Lưu) + **hàng hành động** theo trạng thái:
  - `cho_xac_nhan`: **Xác nhận & hẹn ngày giao** (nút chính → tấm `EtaSheet`: chip Hôm nay · Ngày mai · 2–3 ngày · 3–5 ngày · Trong 7 ngày · Chọn ngày; bấm "Xác nhận đơn" mới gửi — 2026-10-18, §4.4) · SQ_BTN "Huỷ" (→ sheet lý do bắt buộc 5–200, chip gợi ý: "Hết hàng" · "Không giao tới được" · "Không liên lạc được" · "Khác" + ô chữ).
  - `da_xac_nhan` / `dang_giao`: thêm SQ_BTN **Dời hẹn giao** (cùng `EtaSheet`, mở sẵn hẹn cũ).
  - `da_xac_nhan`: **Giao hàng** (→ sheet: chip cách giao "Tự giao" · "Gửi xe" · "Gửi ra cảng" + ô "Đơn vị / nhà xe" + ô "Mã vận đơn" — đều tuỳ chọn, gửi cùng `status:"dang_giao"`) · SQ_BTN Huỷ.
  - `dang_giao`: **Đã giao xong**.
  - `da_giao`: chỉ dòng "Chờ người mua bấm Đã nhận (tự hoàn thành sau 7 ngày)".
  - `bao_da_chuyen` (mọi status chưa kết thúc): hàng vàng "Người mua báo đã chuyển {tổng}đ · nội dung {mã}" + SQ_BTN **Đã nhận tiền** · SQ_BTN "Chưa thấy" (lý do 5–200).
- **Hành động → thấy ngay**: mỗi nút → ConfirmDialog 1 câu → chip trạng thái đổi + timeline thêm dòng + dòng inline "Đã chuyển sang {trạng thái}" 5s; 409 → "Đơn đã sang bước khác rồi — tải lại" + tự tải lại.
- **Ma trận**: tab rỗng → "Không có đơn {trạng thái}" · mất sóng → "Cần sóng để xử lý đơn" — danh sách KHÔNG cache (đơn shop đổi liên tục, và seller ở bờ) · buyer huỷ đúng lúc seller đang bấm Xác nhận → 409 như trên · `needsRefund` → băng đỏ "Cần hoàn {tổng}đ cho người mua {SĐT}" · timeline có `by=admin:…` → dòng "SDVICO đã xử lý thay" (admin xử lý thay shop — LEAD §4 #2).

### 6.6 `/ban-hang/cai-dat` — Cài đặt shop

- Form = 6.1 điền sẵn + công tắc **"Tạm nghỉ bán"** (`paused` — LEAD §4 #8, chốt: món vẫn hiện, không đặt được, trang shop nói rõ; khác `tam_khoa` của admin). Đổi tên shop sau duyệt: cho phép, slug mới phải chưa ai dùng. Lưu → "Đã lưu" 5s. Xoá STK → dòng "Shop sẽ chỉ nhận tiền mặt" (đơn CK đang treo vẫn giữ `bankSnapshot`). Không có nút xoá shop (gọi SDVICO).

---

## 7. Flow admin (`/quan-tri` tab "Chợ vật tư", `requireAdmin` — LEAD §4 #13, nợ manager)

| Việc | Màn | Hành động → hệ quả (route [12 §7.3](12-kien-truc-san-thuong-mai.md)) |
|---|---|---|
| Duyệt shop | danh sách shop lọc theo status (mặc định `cho_duyet`), thẻ [tên · SĐT chủ · tỉnh · ngày đăng ký · số món đã soạn] + SQ_BTN Xem | **Duyệt** → `hoat_dong`, `approvedAt`; N10 (seller, push). **Từ chối** → lý do bắt buộc 5–300 → `tu_choi`; N11 (seller, push) |
| Khoá / mở khoá shop | chi tiết shop | **Tạm khoá** → lý do bắt buộc → `tam_khoa`: món của shop biến khỏi chợ ngay, đơn treo vẫn xử lý (6.2); N12 (seller, push). **Mở lại** → `hoat_dong` |
| Gán chủ shop | chi tiết shop (ô SĐT) | **Gán** → `ownerPhone` (dùng cho shop SDVICO seed sentinel — LEAD §5 A2); SĐT đã là chủ shop khác → lỗi "Số này đã có shop" |
| Xử lý đơn thay shop | bảng đơn lọc theo shop / trạng thái / SĐT người mua / mã đơn → chi tiết | **mọi hành động của seller** (T1–T3, T7 huỷ tới `dang_giao` với lý do, P2/P3, ghi chú) với timeline `by=admin:<sđt>` (LEAD §4 #2) — dùng cho shop SDVICO chưa gán chủ + khiếu nại qua điện thoại |
| Gỡ / trả sản phẩm | danh sách món toàn sàn (tìm theo tên/shop), thẻ + SQ_BTN | **Gỡ** → lý do bắt buộc → `adminHidden=true`; món khỏi chợ + khỏi giỏ người mua (tra lại thấy "Món này không còn trên chợ"); đơn treo có món đó KHÔNG bị huỷ tự động; N13 (seller, hộp thư). **Trả lại** → `adminHidden=false` |
| Ẩn đánh giá | trong chi tiết món (danh sách đánh giá kể cả ẩn) | **Ẩn/Hiện** → `hidden` + tính lại `ratingAvg/ratingCount` món + shop từ đánh giá không ẩn (LEAD §4 #15) |
| KPI sàn | đầu tab (`AdminOverview`) | shop theo status · món đang bán · đơn hôm nay / 7 ngày / 30 ngày theo trạng thái · GMV đơn `hoan_thanh` theo kỳ · tỉ lệ huỷ = huỷ / (huỷ + hoàn thành) 30 ngày |

Mọi hành động admin ghi `logActivity` (`market.shop-status` · `market.shop-owner` · `market.order-update` · `market.product-hide` · `market.review-hide`) + timeline `by=admin:<sđt>`; không có hành động 1 chạm không xác nhận.

---

### 7b. Mục "Yêu cầu đặt" (tab Chợ vật tư, 2026-10-18)

Chip mục mang số đang chờ (`counts.moi`). Lọc: Chờ báo giá (mặc định) · Đã có báo giá · Đã đặt · Tất cả. Mỗi thẻ: món · số lượng · mã YC · người nhận/SĐT/tỉnh · cần trước · mô tả · báo giá đã gửi. Hành động: **Báo giá** / **Sửa báo giá** (shop lo hàng — chỉ shop đang hoạt động, SDVICO lên đầu · tiền hàng · phí giao · lời dặn → "Chọn ngày giao rồi gửi" mở `EtaSheet`) · **Không tìm được** (`ReasonDialog`, lý do 3–300, chip gợi ý). Nhật ký `market.request-quote`. Xác nhận đơn thay shop ở mục Đơn hàng cũng đi qua `EtaSheet`.

## 8. Thông báo (theo 07 §12 — đơn hàng là "chuyện ở bờ": hộp thư luôn ghi, push chỉ khi cần hành động hoặc tiền đang đi)

Kênh = `notifyMarket(phone, marketNotice(ev, ctx))` (12 §7.4) → prod `notifyAccount(admin, phone, {…, sentBy:'system:market', pushOs, tag:'mdon-<orderId>'|'mshop-<shopId>'})`; best-effort, không làm hỏng việc chính; mọi push mang `sentAt` + "TIN CŨ" khi >2h (luật sẵn có). **Ngoại lệ đã chốt (LEAD §4 #4)**: actor NGƯỜI BÁN (ở bờ, bỏ lỡ đơn = mất tiền) nhận push OS cho N1, N8, N10–N12; người mua giữ luật 07 §12 (chỉ `dang_giao`/`da_giao`/`da_huy` + P3). Admin+Docs ghi 1 dòng vào 07 §12 cùng commit.

| # | Sự kiện | Tới | Push OS? | Tiêu đề / nội dung | url |
|---|---|---|---|---|---|
| N1 | Đơn mới (T0) | shop | **Có** — cần xác nhận | "Đơn mới {mã}" / "{tên người nhận} đặt {k} món · {tổng}đ · {cách trả}" | `/ban-hang/don/{id}` |
| N2 | Shop xác nhận (T1) | buyer | Không (hộp thư) | "Shop {tên} đã xác nhận đơn {mã}" / "Sẽ giao tới {cảng/địa chỉ}." | `/cho/don/{id}` |
| N3 | Đang giao (T2) | buyer | Có | "Đơn {mã} đang giao" / "{cách giao}{ · nhà xe}{ · mã vận đơn}. Gọi shop: {SĐT}" | ↑ |
| N4 | Đã giao (T3) | buyer | Có | "Đơn {mã} đã giao" / "Nhận đủ hàng thì bấm Đã nhận hàng giúp shop." | ↑ |
| N5 | Buyer bấm Đã nhận (T4) | shop | Không | "Đơn {mã} hoàn thành" / "Người mua đã nhận hàng." | seller url |
| N6 | Buyer huỷ (T5) | shop | Không | "Đơn {mã} bị huỷ bởi người mua" / "{lý do nếu có}" | seller url |
| N7 | Shop/admin huỷ (T6/T7) | buyer | Có | "Đơn {mã} đã huỷ" / "Lý do: {lý do}.{ Shop sẽ hoàn tiền đã chuyển.}" (vế sau khi `needsRefund`) | ↑ |
| N8 | Buyer báo đã CK (P1) | shop | **Có** — tiền đang chờ | "Người mua báo đã chuyển {tổng}đ" / "Đơn {mã} · nội dung {mã}. Kiểm tra rồi bấm Đã nhận tiền." | seller url |
| N9 | Shop xác nhận tiền (P2) | buyer | Không | "Shop đã nhận tiền đơn {mã}" | ↑ |
| N9' | Shop báo chưa thấy tiền (P3) | buyer | Có — cần hành động | "Shop chưa thấy tiền đơn {mã}" / "{lý do}. Kiểm tra lại hoặc gọi shop." | ↑ |
| N10 | Duyệt shop | seller | **Có** | "Shop {tên} đã được duyệt" / "Món đã soạn nay hiện trên chợ." | `/ban-hang` |
| N11 | Từ chối shop | seller | **Có** | "Shop {tên} chưa được duyệt" / "{lý do}. Sửa rồi gửi lại." | `/ban-hang` |
| N12 | Khoá shop | seller | **Có** | "Shop {tên} bị tạm khoá" / "{lý do}. Gọi SDVICO {hotline}." | `/ban-hang` |
| N13 | Gỡ sản phẩm | seller | Không | "SDVICO đã gỡ món {tên}" / "{lý do}" | `/ban-hang/san-pham/{id}` |
| — | T4' tự hoàn thành (`settleOverdue`) | — | **không gửi** | không phải tin mới với ai | — |
| N14 | Đơn chờ >48h | shop | — | **ghi nợ** (cần cron); nay chỉ băng vàng trên màn 6.5 | — |

Trong app: badge trên nút "Đơn hàng" ở `/cho` = số đơn chưa kết thúc (từ cache); badge ở Tổng quan seller = 3 ô việc cần làm; **không badge dock** (luật hộp thư). Không toast; xác nhận sau hành động là dòng inline.

---

- **Y1** (chủ sàn báo giá → chủ tàu, `pushOs:true`): "Đã có giá: {món}" · "{tổng} cả phí giao. Mở ra bấm Đồng ý đặt trong 3 ngày." · url `/cho/yeu-cau/{id}` · tag `myc-{id}`.
- **Y2** (không tìm được → chủ tàu, `pushOs:true`): "Chưa tìm được: {món}" · lý do.
- **N2** nay đọc hẹn giao: "Hẹn giao ngày mai tới {chỗ nhận}." Đồng ý báo giá ⇒ chủ shop lo hàng nhận **N1**. Tự huỷ 72 giờ ⇒ người mua nhận **N7** (lý do tự huỷ).

## 9. Offline & mạng yếu

Nguyên tắc (01-product ⚓ + ADR 0004): chợ là **chuyện ở bờ** — không hứa offline, chỉ hứa **không treo, nói đúng lý do, có sóng tự tải lại**; chỉ lưu thứ **nhỏ và ít đổi** (giỏ + bản tra, địa chỉ, yêu thích, bản đơn của tôi, cờ có shop). KHÔNG outbox/gửi lại tự động. SW không cache `/api/cho/*`. Lúc mở app (`/`, `/tau`, `/tien`) **không** có request nào tới chợ; sheet Tài khoản chỉ gọi `/api/ban-hang/shop` khi mở sheet và có sóng.

| Màn | Mất sóng: đọc được từ máy | Phải có mạng | Câu nói với bà con |
|---|---|---|---|
| `/cho` | badge giỏ, badge đơn (cache), Yêu thích (snapshot), "Mua lại" + "Đơn đang tới" (từ cache đơn) | danh sách món, tìm | "Máy đang không có sóng — chợ cần mạng. Đơn đã đặt và giỏ vẫn xem được." |
| `/cho/tim` | kết quả đang hiện (nếu đã tải) | tìm mới, trang sau | chip tầng 4 "Không có sóng — đang xem kết quả đã tải" |
| `/cho/sp/[id]` | thông tin đã có trong bộ nhớ từ danh sách; ♡; thêm giỏ (local); **nút Gọi** | ảnh chưa tải, đánh giá, tồn mới | "Giá lúc HH:MM — có sóng sẽ tra lại" |
| `/cho/shop/[slug]` | không (không cache) — **nút Gọi vẫn dùng được nếu màn đã tải** | tất cả | màn quy ước |
| `/cho/gio` | dòng giỏ + bản tra gần nhất (`quote`) | tra giá, Đặt hàng | "Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên." |
| `/cho/thanh-toan` | không vào được (nút vô hiệu) | tất cả | — ; mất sóng GIỮA lúc gửi: câu ở 5.6 (không tạo đơn đôi nhờ `clientRef`) |
| `/cho/don`, `/cho/don/[id]` | bản lưu `forfish.morders.v1` + tuổi; **nút Gọi shop** | huỷ, Đã nhận, Đã CK, đánh giá | "Đang xem đơn đã lưu (N phút trước)…" ; nút ghi vô hiệu + "việc này cần có sóng" |
| Sheet Tài khoản | dòng Kênh người bán/Đăng ký shop theo cờ `forfish.mshop.v1`; chưa có cờ ⇒ ẩn cả hai | cập nhật cờ | — |
| `/ban-hang/**` | không cache gì (seller ở bờ, dữ liệu đổi liên tục); nút Gọi người mua nếu màn đã tải | tất cả | "Kênh người bán cần có sóng." ; form đang gõ **không mất** khi gửi hỏng |
| Sóng "sống mà chết" | — | — | mọi fetch có đồng hồ (12s đọc / 20s ghi / 60s upload ảnh) → rơi vào nhánh lỗi có nút Thử lại, KHÔNG treo |
| Có sóng lại | — | — | màn đang mở nghe `online` → tự tải lại, không bắt bấm Thử lại |

---

## 10. Quy tắc nghiệp vụ & bất biến

| # | Rule | Ghi chú / edge |
|---|---|---|
| R1 | **1 SĐT tối đa 1 shop** (unique `ownerPhone`) | đổi chủ shop = admin "Gán chủ shop" ở tab Chợ vật tư; nhiều SĐT/shop = ghi nợ (12 §12) |
| R2 | Shop `cho_duyet`/`tu_choi`/`tam_khoa` → **mọi sản phẩm không hiện** trên chợ, không tìm ra, không đặt được (server chặn T0 `shop_not_active`) | seller `cho_duyet` vẫn soạn món trước; `tam_khoa` vẫn xử lý đơn treo |
| R2' | Shop `paused` → món **vẫn hiện** (chip "Tạm nghỉ"), KHÔNG đặt được (`shop_paused`) | LEAD §4 #8 |
| R3 | **Snapshot**: đơn giữ tên/giá/ảnh/địa chỉ/STK lúc đặt; sửa/ẩn/xoá món hay đổi shop sau đó **không đổi** đơn cũ; tên/SĐT shop đính kèm lúc đọc là bản hiện tại (để gọi được) | xoá món = xoá mềm |
| R4 | **Không chặn** mua của chính shop mình ở v1 (LEAD §5 A4) | dev/test dùng persona; ghi nợ nếu thấy sao/đã bán tự thổi |
| R5 | Server **tính lại mọi số tiền** từ dữ liệu hiện tại; client gửi id + qty + `expectedTotalVnd` từng shop để đối chiếu; lệch → kết quả shop đó `price_changed` + `quote` mới | không tin giá client, giống `catalog-orders` |
| R6 | **Chống đơn đôi**: `marketOrderClientRef` theo nội dung (kèm `shopId`), unique `(buyerPhone, clientRef)`; trùng → trả đơn cũ `duplicate:true`, không lỗi | sống qua tắt/mở app; hai request sát nhau không trừ kho đôi (§4.2) |
| R7 | Tồn kho trừ T0 (+`soldCount`) / hoàn khi huỷ (−`soldCount`); kiểm atomic từng dòng trong 1 transaction/shop | §4.2 |
| R8 | Giới hạn — **một nguồn `validate.ts` (12 §4.3)**: ≤50 dòng/giỏ · qty 1..999 · ≤20 dòng/đơn-shop · ≤5 shop/lần đặt · tên món 3–120 · giá 1.000..1.000.000.000 · biến thể 0|2..10 · ≤6 ảnh ≤400KB · ≤10 địa chỉ · ≤100 yêu thích · ghi chú ≤300 · đánh giá ≤500 · tên shop 3–60 · lý do huỷ 5–200 · lý do admin 5–300 | mọi trần chặn ở **cả client lẫn server** |
| R9 | Đánh giá chỉ khi `hoan_thanh`, 1/món/đơn, không sửa; admin ẩn được, điểm tính lại từ đánh giá không ẩn | LEAD §4 #15 |
| R10 | **MÓN LIÊN HỆ BÁO GIÁ** (`priceVnd = null`, 2026-09-07 — [ADR 0014](../adr/0014-gop-cua-hang-vao-cho.md)): shop được đăng món **chưa niêm yết giá** (máy tàu, thiết bị lớn báo giá theo từng chiếc). Món kiểu này **không giá gạch · không loại/cỡ · không vào giỏ · không lên đơn**; màn món đổi thanh đáy thành **"Gọi hỏi giá"**. Không theo dõi tồn kho (`stock = 0`) và **không được hiện "Hết hàng"** | Chặn ở BA TẦNG độc lập: `validateMarketProductDraft` · `isPurchasable`/`buildMarketLines` (lý do rơi `chua_co_gia`) · RPC `market_place_order` (so `price_vnd` với `null` không bao giờ khớp). Sắp xếp theo giá: xuống **cuối cả hai chiều**. Giá `0`/âm vẫn là LỖI — chỉ `null` mới là "liên hệ" |
| R11 | **CHỦ SHOP TRA ĐƯỢC ĐƠN** (2026-09-07): ô tra ở `/ban-hang/don` nhận **mã đơn** hoặc **SĐT người mua**, và khi đang tra thì **BỎ lọc trạng thái** — bà con gọi đọc mã, người bán không biết đơn đang ở tab nào. Danh sách đơn có **"Xem thêm N đơn"**; trước đó ghim `page=1` nên đơn thứ 21 trở đi KHÔNG có đường nào mở ra | Lọc `code`/`buyerPhone` nằm ở `OrderListQuery` dùng chung nên buyer/shop/admin cùng một luật; `listShopOrders` vẫn GHIM `shopId` ở tham số bắt buộc — không có đường lọt đơn shop khác. SĐT chuẩn hoá trước khi so |
| R12 | **HÀNG ĐỢI ĐÁNH GIÁ CHO ADMIN** (2026-09-07): `/quan-tri` tab Chợ vật tư có mục **Đánh giá** liệt kê đánh giá **cả sàn**, mới nhất trước, mặc định lọc **1–2 sao**. Ẩn/hiện **KHÔNG hỏi lại** (quản trị viên được quyền — chủ dự án chốt) nhưng **BẮT BUỘC báo kết quả** bằng `NoticeBar` | Trước đó `productId` là tham số BẮT BUỘC nên muốn soát một đánh giá bậy phải đoán đúng món rồi mở ra — luật "admin ẩn đánh giá vi phạm" có trên giấy mà không có lối đi. `listReviews` là MỘT hàm cho cả ba việc (một món / một món kèm bản ẩn / cả sàn) |
| R10 | Buyer huỷ chỉ ở `cho_xac_nhan`; seller huỷ tới `da_xac_nhan` với lý do; admin huỷ tới `dang_giao` với lý do; **admin làm được mọi việc của seller trên mọi shop**, timeline `by=admin:<sđt>` | LEAD §4 #2; sau `da_giao` chỉ còn điện thoại |
| R11 | `chuyen_khoan` chỉ chọn được khi **mọi shop trong lần đặt** nhận CK; 1 cách trả tiền/lần đặt; STK snapshot vào đơn (`bankSnapshot`) | LEAD §4 #9; shop xoá STK sau đó không ảnh hưởng đơn |
| R12 | Huỷ đơn CK đã `bao_da_chuyen`/`da_thanh_toan` ⇒ `needsRefund=true`, hiện cả hai bên, app không xử lý tiền | LEAD §4 #7 |
| R13 | `da_giao` quá 7 ngày ⇒ `hoan_thanh` **khi đọc** (`settleOverdue`), `by=system`, không thông báo; không cron | LEAD §4 #3 |
| R14 | Không có hành động ghi nào chạy khi mất sóng; không outbox; `tel:` KHÔNG ẩn khi mất sóng | 01-product ⚓; LEAD §4 #10 |
| R15 | Cách ly máy dùng chung: giỏ/địa chỉ/yêu thích/cache đơn/cờ shop **theo ngăn SĐT**, ngăn khác → coi như trống; `NEVER_BACKUP_PREFIXES` gồm **5** khoá `forfish.m*.v1` | pattern `cart.ts` |
| R16 | SDVICO là **một shop như mọi shop** (seed, prod = sentinel chủ + admin gán; dev = persona có shop), core không `if (shop === SDVICO)` | LEAD §1, §5 A2 |
| R17 | Chợ **không gate premium**, không gate `unlinked`; **xem không cần đăng nhập**; đặt/đơn/đánh giá/♡/bán cần đăng nhập | LEAD §5 #8 |
| R18 | Mọi ID/SĐT dùng để lọc lấy từ `identityFromRequest`/`requireShopOwner`/`requireAdmin`, không từ body/query; SĐT trong `address` là người nhận (dữ liệu) | LEAD §0 |
| R19 | Danh mục = `PRODUCT_CATEGORIES` 9 id gạch-ngang, thứ tự cố định (LEAD §4 #14); mọi chip/lọc/validate/check constraint cùng nguồn | 12 §3.2 |

---

## 11. Acceptance Criteria — ORACLE (QA truy vết theo mã)

Mỗi AC 1 dòng kiểm được, **trong ngoặc = route/hàm chịu trách nhiệm** (đường dẫn theo 12 §4/§7). Test: **U** = unit (`src/lib/__tests__/market-*.test.ts`), **E** = e2e (`tests/e2e/san/**`, file-store + `/dev` persona), **A** = API.

**Sản phẩm & tìm**
- AC-01 (E) `/cho` khi chưa đăng nhập **vẫn hiện danh sách món** (khách lạ xem được); bấm Đặt hàng ở giỏ / ♡ → `LoginGate` tại chỗ, không chuyển trang (`/cho`, `/cho/gio`; `LoginGate`).
- AC-02 (A) `GET /api/cho/san-pham` không bao giờ trả món của shop `cho_duyet|tu_choi|tam_khoa`, món `status=an`, `adminHidden=true`, `deletedAt≠null`; **có** trả `het_hang`; shop `paused` trả kèm `shopPaused=true` (`MarketStore.listProducts`).
- AC-03 (A) Tìm "loc dau" (không dấu) ra món tên "Lọc dầu…"; tìm chuỗi rỗng = danh sách mới nhất (`foldVn`, `search_text`).
- AC-04 (A) `sort=ban_chay` sắp theo `soldCount` giảm; `sort=gia_tang` theo `priceVnd` tăng; `category` lạ → 400 `invalid` (`GET /api/cho/san-pham`).
- AC-05 (A) 500 món → trang 1 trả 20 + `total=500`; `page=26` trả rỗng không lỗi; `pageSize=200` bị hạ về 50 (`listProducts`).
- AC-06 (E) Trang SP có biến thể: chưa chọn → nút Thêm vào giỏ vô hiệu + "Chọn loại"; chọn → giá đổi theo biến thể, tồn không đổi (kho chung) (`/cho/sp/[id]`, `unitPriceFor`).
- AC-07 (E) Món tồn 0 → nút "Hết hàng" vô hiệu, ♡ vẫn dùng được (`isPurchasable`).
- AC-08 (A) `?province=Bình Định` chỉ trả món của shop tỉnh đó; `/cho` có `loadHome().province` → có khối "Gần bà con"; không có → không có khối, không lỗi (`listProducts.province`, `/cho`).
- AC-08b (A) Shop `paused=true`: `GET /api/cho/san-pham/[id]` vẫn 200 với `shop.paused=true`; UI nút Thêm vào giỏ vô hiệu + băng "tạm nghỉ" (`/api/cho/san-pham/[id]`, `/cho/sp/[id]`).

**Giỏ (local)**
- AC-09 (U) `addMarketLine` cộng dồn cùng `productId+variantLabel`; khác `variantLabel` = dòng khác; qty clamp 1..999 (`lib/market/cart.ts`).
- AC-10 (U) Dòng thứ 51 bị từ chối, trả `reason: "gio_day"`, giỏ không đổi (`addMarketLine`, `CART_MAX_LINES`).
- AC-11 (U) Một khoá = một ngăn (khớp `cart.ts`): sau khi phoneA lưu giỏ, `loadMarketCart(phoneB)` → `[]`; sau khi phoneB lưu, `loadMarketCart(phoneA)` → `[]` (`cartBucket`).
- AC-12 (E) Máy hết chỗ (mock `setItem` ném) → băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ", badge KHÔNG tăng (`saveMarketCart` trả false).
- AC-13 (E) Giỏ nhóm theo shop, tổng từng shop + phí ship đúng luật (`items ≥ freeShipFrom` → ship 0) (`POST /api/cho/gio/tinh`, `shippingFor`).
- AC-14 (E) Món trong giỏ bị admin gỡ → sau tra lại hiện mờ "Món này không còn trên chợ", không tính tổng, nút Đặt hàng vẫn bấm được nếu còn món khác (`buildMarketLines` dropped `ngung_ban`).
- AC-15 (E) Mất sóng ở giỏ → hiện bản tra gần nhất + "giá lúc HH:MM", nút Đặt hàng vô hiệu + câu "Đặt hàng cần có sóng" (`loadMarketQuote`, `/cho/gio`).
- AC-15b (E) Giỏ có shop `paused` → dòng của shop đó mờ "Shop đang tạm nghỉ, mở lại sau", không tính tổng (`buildMarketLines` dropped `shop_nghi`).

**Đặt hàng**
- AC-16 (E) Giỏ 2 shop → màn Đặt hàng hiện "Sẽ tạo 2 đơn cho 2 shop"; sau khi đặt có đúng 2 `market_orders`, mỗi đơn 1 `shopId` (`POST /api/cho/don`, `placeOrders`).
- AC-17 (U) `computeTotals(lines, shop)`: `total = subtotal + shipping`; ship = 0 khi `freeShipFromVnd != null && subtotal >= freeShipFromVnd`; `freeShipFromVnd = null` → luôn tính ship (`pricing.ts`).
- AC-18 (A) `expectedTotalVnd` lệch với server → `results[i] = {ok:false, code:"price_changed", quote}`, **không** tạo đơn shop đó, tồn không đổi; shop khác trong cùng request vẫn tạo (`POST /api/cho/don`).
- AC-19 (A) Gửi 2 request giống hệt (cùng `clientRef`) → 1 đơn duy nhất, lần 2 trả `ok:true, duplicate:true` + cùng `id`; tồn chỉ trừ 1 lần (`market_place_order` bước 0 + unique `client_ref`).
- AC-20 (U) Đổi qty / biến thể / địa chỉ / cách trả / ghi chú / shop → `marketOrderClientRef` khác; đổi thứ tự món → giống (`order-ref.ts`).
- AC-21 (A) Tồn 1, hai request đồng thời qty 1 → đúng 1 thành công, 1 trả `line_unavailable` `available=0`; tồn cuối = 0; `soldCount` +1 (`market_place_order`).
- AC-22 (A) Đặt 2 shop, shop B hết hàng → shop A tạo thành công, `results` có 1 ok + 1 `line_unavailable`; client chỉ xoá dòng shop A khỏi giỏ (`placeOrders`, `removeShopLines`).
- AC-23 (A) Shop `tam_khoa` giữa chừng → `shop_not_active`; shop `paused` → `shop_paused`; tồn không đổi (`market_place_order` bước 1).
- AC-24 (A) `paymentMethod=chuyen_khoan` với lần đặt có shop không đủ STK → 400 `invalid` + câu "Shop {tên} chỉ nhận tiền mặt…"; client ẩn chip CK từ trước (`shopsForcingCod`, `/cho/thanh-toan`).
- AC-25 (A) 21 dòng cho 1 shop → 400 `invalid` "Mỗi đơn tối đa 20 món…"; 6 shop → 400; client chặn từ giỏ trước (`validateCheckout`).
- AC-26 (E) Bấm đúp nút Đặt hàng → đúng 1 request (nút vô hiệu khi `sending`) (`/cho/thanh-toan`).
- AC-27 (E) Đặt xong → thẻ mỗi đơn có mã `SDyymmddXXXX` + tổng + cách trả; CK hiện STK từ `order.bankSnapshot` + nội dung = mã đơn; đơn hiện ở `/cho/don` tab Đang xử lý (`makeOrderCode`, `bank_snapshot`).
- AC-28 (A) Đơn tạo có `buyerPhone` = SĐT xác thực dù body có trường SĐT khác; `address.phone` là SĐT người nhận trong body (`identityFromRequest`, `POST /api/cho/don`).
- AC-29 (U) `validateAddress`: `isPort=true` thiếu `detail` → "Ghi tên cảng / bến nhận hàng."; `isPort=false` detail 4 chữ → "Ghi địa chỉ đủ để người giao tìm được." (`validate.ts`).
- AC-29b (A) Đơn CK có `bankSnapshot`; shop xoá STK sau đó → `GET /api/cho/don/[id]` vẫn trả STK cũ trong `order.bankSnapshot` (`market_place_order`, R11).

**Máy trạng thái**
- AC-30 (U) `canTransitionOrder` đúng bảng §4.1 cho cả 3 actor: buyer không chuyển được `da_xac_nhan→da_huy`; seller không chuyển `dang_giao→da_huy`; admin chuyển được `dang_giao→da_huy`; không ai chuyển ra khỏi `hoan_thanh`/`da_huy` (`TRANSITIONS`).
- AC-31 (A) Seller huỷ không lý do (hoặc 4 chữ) → 400 `invalid`; có lý do → `da_huy`, tồn hoàn đúng từng dòng, `soldCount` trừ lại (`PATCH /api/ban-hang/don/[id]`, `validateCancelReason`, `market_restock_order`).
- AC-32 (A) Buyer huỷ ở `da_xac_nhan` → 409 `bad_transition`; ở `cho_xac_nhan` → OK + tồn hoàn (`POST /api/cho/don/[id]/huy`).
- AC-33 (A) Buyer bấm Đã nhận ở `da_giao` → `hoan_thanh`, `completedAt` set, COD → `paymentStatus=da_thanh_toan`; `soldCount` KHÔNG đổi (đã cộng lúc đặt) (`applyTransition`, `POST …/da-nhan`).
- AC-34 (A) Gọi Đã nhận lần 2 → 409 (idempotent nhờ `expectStatus`) (`transitionOrder`).
- AC-35 (A) P1 chỉ khi `paymentMethod=chuyen_khoan`; COD gọi P1 → 400. P2 chỉ seller/admin; buyer gọi → 403. P3 thiếu lý do → 400 (`canTransitionPayment`, `applyPaymentTransition`).
- AC-36 (A) Huỷ đơn CK ở `bao_da_chuyen` (bởi seller, admin HOẶC buyer) → `needsRefund=true`; buyer thấy "Shop cần hoàn tiền"; huỷ đơn COD hoặc CK `chua_thanh_toan` → `false` (`applyTransition`).
- AC-37 (A) Admin huỷ `dang_giao` → `da_huy`, tồn hoàn; admin không huỷ được `da_giao` (409); timeline `by = "admin:<sđt>"` (`PATCH /api/admin/cho/don/[id]`, `timelineBy`).
- AC-38 (A) Mọi chuyển trạng thái đơn HOẶC thanh toán ghi 1 dòng `timeline {status, at, by}` (`OrderPatch.timelineAppend`).
- AC-38b (U) `settleOverdue`: `da_giao` + `deliveredAt` 6 ngày 23 giờ → null; 7 ngày → patch `hoan_thanh`, `by="system"`, `completedAt = deliveredAt + 7 ngày`, COD → `da_thanh_toan` (`order-state.ts`).
- AC-38c (A) Đơn `da_giao` 8 ngày: `GET /api/cho/don` (hoặc `/api/ban-hang/don`, `/thong-ke`, `/api/admin/cho/don`) trả đơn đã `hoan_thanh` và DB đã ghi; không có thông báo nào được gửi (`settleOverdueOrders`, `settleOverdueForStats`).

**Đơn của tôi & đánh giá**
- AC-39 (A) `GET /api/cho/don` chỉ trả đơn `buyerPhone` = SĐT xác thực; `GET /api/cho/don/{id}` của người khác → 404 (`listBuyerOrders`, `getOrder`).
- AC-40 (E) Mất sóng, đã có cache → hiện bản lưu + tuổi; chưa có cache → 1 câu + Thử lại; có sóng lại → tự tải, không bấm (`orders-cache.ts`, `useOnlineRefetch`).
- AC-41 (E) Cache đơn ngăn SĐT A không hiện cho SĐT B trên cùng máy (`loadCachedMarketOrders`).
- AC-42 (A) Đánh giá khi đơn `da_giao` → 409 `review_not_allowed` "Chỉ đánh giá được khi đã nhận hàng."; `hoan_thanh` → 201; lần 2 cùng món cùng đơn → 409 `already_reviewed` (`POST …/danh-gia`, `market_add_review`).
- AC-43 (A) Sau 1 đánh giá 4★ + 1 đánh giá 2★ → `ratingAvg=3`, `ratingCount=2` trên món và trên shop; admin ẩn đánh giá 2★ → `ratingAvg=4`, `ratingCount=1`; `GET …/danh-gia` không còn trả nó (`market_recount_rating`, `setReviewHidden`).

**Người bán**
- AC-44 (A) Đăng ký shop lần 2 cùng SĐT → 409 `invalid` "Số này đã có shop rồi…"; trùng tên (khác hoa thường/dấu) → 409 `slug_taken` (`createShop`, `toSlug`).
- AC-44b (A) Shop `tu_choi` gửi lại `POST /api/ban-hang/shop` → cùng `id`, status về `cho_duyet`, không tạo hàng mới (`POST /api/ban-hang/shop`).
- AC-45 (A) Shop `cho_duyet` thêm sản phẩm → 201, món không xuất hiện ở `/api/cho/san-pham`; sau admin duyệt → xuất hiện, không cần seller làm gì; shop `tam_khoa` thêm → 403 `shop_not_active` (`requireShopOwner allow`).
- AC-46 (U) `validateMarketProductDraft`: tên 2 chữ → lỗi; giá 999 → lỗi; giá gạch ≤ giá → lỗi; biến thể 1 phần tử → lỗi; 11 phần tử → lỗi; 2 biến thể trùng nhãn (khác dấu) → lỗi; 7 ảnh → lỗi (`validate.ts`).
- AC-47 (A) Upload ảnh > 500KB → 413 `bad_size`; file `.png` đổi tên `.jpg` với `Content-Type: image/jpeg` nhưng magic bytes PNG → vẫn 200 (là PNG thật); file text đội `image/jpeg` → 415 `bad_type` (`readImageUpload`).
- AC-48 (A) Seller sửa giá món sau khi có đơn treo → `items[].priceVnd` đơn không đổi (R3).
- AC-49 (A) Seller xoá món → `deletedAt` set, `GET /api/ban-hang/san-pham` không còn, đơn cũ vẫn trả đủ `items` snapshot; món không còn ở giỏ người khác sau tra lại; xoá lần 2 → 404 (`deleteProduct`).
- AC-50 (A) `requireShopOwner`: SĐT không phải chủ shop gọi `/api/ban-hang/don/{id}` của shop khác → 404; chưa có shop → 404 `no_shop` (`shop-auth.ts`).
- AC-51 (A) Shop `tam_khoa`: T0 bị chặn, nhưng seller vẫn làm T1/T2/T3/T6/P2/P3 trên đơn treo (`PATCH /api/ban-hang/don/[id]` không đòi `hoat_dong`).
- AC-52 (A) Thống kê `range=7d`: `revenueVnd` = tổng `totalVnd` đơn `hoan_thanh` có `completedAt` trong 7 ngày giờ VN; đơn `da_giao` chưa 7 ngày KHÔNG tính; `da_giao` quá 7 ngày ĐƯỢC tính (settle trước); `topProducts` theo qty trong kỳ (`stats`, `settleOverdueForStats`).
- AC-53 (A) Seller ghi `sellerNote` → buyer thấy trên `/cho/don/{id}`; buyer không sửa được `sellerNote` (không có route) (`PATCH /api/ban-hang/don/[id]`).
- AC-53b (A) Seller bật `paused` → `GET /api/cho/san-pham` vẫn có món (`shopPaused=true`), `POST /api/cho/don` → `shop_paused`; tắt → đặt được (`PATCH /api/ban-hang/shop`).
- AC-53c (E) Sheet Tài khoản: persona có shop → dòng "Kênh người bán"; persona chưa có shop → dòng mờ "Bà con có bán vật tư? Đăng ký shop"; offline chưa có cờ → không dòng nào (`hero-account.tsx`, `seller-flag.ts`).

**Admin & thông báo**
- AC-54 (A) Không phải admin gọi `/api/admin/cho/*` → 403 (staff manager cũng 403) (`requireAdmin`).
- AC-55 (A) Admin khoá shop → `GET /api/cho/san-pham` không còn món của shop trong cùng giây; buyer mở `/cho/shop/{slug}` → 403 `shop_not_active` → "Shop này đang tạm đóng" (`setShopStatus`).
- AC-56 (A) Từ chối/khoá/gỡ không lý do (hoặc < 5 chữ) → 400 `invalid` (`validateStatusNote`).
- AC-56b (A) Admin gán `ownerPhone` cho shop SDVICO sentinel → persona đó vào `/ban-hang` thấy shop; gán SĐT đã là chủ shop khác → 400 `invalid` (`setShopOwner`).
- AC-56c (A) Admin T1 trên đơn của shop bất kỳ → `da_xac_nhan`, `timeline[].by = "admin:<sđt>"`, `logActivity action="market.order-update"` (`PATCH /api/admin/cho/don/[id]`).
- AC-57 (A) T0 gọi `notifyMarket` cho `ownerPhone` shop với `pushOs:true`, `tag='mdon-<orderId>'`; T1 gọi cho buyer với `pushOs:false`; T2/T3/T6/T7/P3 buyer `pushOs:true`; P1 shop `pushOs:true`; duyệt/từ chối/khoá seller `pushOs:true`; owner sentinel → không gọi (`marketNotice`, `notifyMarket`).
- AC-58 (A) `notifyAccount` ném lỗi (mock) → chuyển trạng thái vẫn thành công 200 (`notifyMarket` best-effort).

**Offline / bền / an toàn**
- AC-59 (E) Mọi fetch `/api/cho/*` và `/api/ban-hang/*` có `signal` đồng hồ; mock không phản hồi → UI ra nhánh lỗi trong ≤ 21s (upload ≤ 61s), không treo "Đang gửi…" (`marketGet/marketPost/marketUpload`).
- AC-60 (E) Không có request nào tới `/api/cho/*` hay `/api/ban-hang/*` khi mở `/`, `/tau`, `/tien` (chợ chỉ gọi khi vào `/cho/**`; sheet Tài khoản chỉ gọi khi mở sheet).
- AC-61 (E) Form sản phẩm gửi hỏng vì mất sóng → nội dung form còn nguyên, câu "Chưa lưu được — cần sóng".
- AC-62 (U) `NEVER_BACKUP_PREFIXES` chứa `forfish.mcart.`, `forfish.maddr.`, `forfish.mfav.`, `forfish.morders.`, `forfish.mshop.`; cổng quét `offline-backup.test.ts` xanh (`lib/offline-backup.ts`).
- AC-63 (E) Nút Gọi shop trên `/cho/sp/[id]` và `/cho/don/[id]` **vẫn hiện** khi `navigator.onLine=false`; lời mời Đăng nhập thì ẩn (LEAD §4 #10).
- AC-64 (U) `isDevFileModeEnv`: `{MARKET_STORE:"file"}` + `VERCEL:"1"` → false; + `NODE_ENV:"production"` → false; thiếu `MARKET_STORE` → false; `identityFromRequest` với env prod không gọi `getMarketStore` (spy) (`dev-mode.ts`, `api-identity.ts`).
- AC-65 (A) `GET /api/dev/uploads/..%2F..%2Fpackage.json` và `GET /api/dev/uploads/a..b.jpg` → 404; tên hợp lệ → 200 với đúng `Content-Type` (`/api/dev/uploads/[name]`).
- AC-66 (A) Ngoài file mode, `POST /api/dev/login` → 404; `/dev` hiện câu "Chỉ dùng khi chạy `MARKET_STORE=file npm run dev`".
- AC-67 (A) Danh mục: `POST /api/ban-hang/san-pham` với `category:"may_dong_co"` (gạch dưới) → 400; `"may-dong-co"` → 201; chip ở `/cho` đúng 9 nhãn theo thứ tự LEAD §4 #14 (`isProductCategory`, `PRODUCT_CATEGORIES`).


**Luồng giống Shopee (v1.4, 2026-10-18)**
- AC-78 (U) `settleOverdue` đơn `cho_xac_nhan` < 72h ⇒ null; ≥ 72h ⇒ `{status:"da_huy", cancelBy:"system", cancelReason: AUTO_CANCEL_REASON}`, `timelineAppend.at = createdAt+72h` (`market-eta-request.test.ts`).
- AC-79 (A) Route đọc đơn của buyer/seller/admin trả đơn chờ quá 72h ở `da_huy` và đã hoàn kho; `settleOverdueForStats` quét `listOverduePending` trước khi đếm.
- AC-80 (A) `PATCH /api/ban-hang/don/[id]` `{status:"da_xac_nhan"}` thiếu hẹn ⇒ 400 "Chọn ngày giao hàng."; kèm `etaPreset:"ngay_mai"` ⇒ 200, `etaFrom = etaTo = mai`. Admin cùng luật.
- AC-81 (A) Dời hẹn ở `cho_xac_nhan` ⇒ 409; ở `da_xac_nhan`/`dang_giao` ⇒ 200, trạng thái không đổi.
- AC-82 (U) `validateEta`: quá khứ · ngược · > 60 ngày · sai khuôn ⇒ câu lỗi; `etaLabel` "hôm nay"/"ngày mai"/"Thứ Ba 20/10 – Thứ Tư 21/10"; `isLate` chỉ khi đang chờ giao và qua `etaTo`.
- AC-83 (E) Chi tiết đơn hai bên có thanh 5 bước + "Hẹn giao …" (đỏ "Trễ hẹn" khi quá) + đếm ngược tự huỷ khi chờ xác nhận.
- AC-84 (A) `POST /api/cho/yeu-cau` sai (tên < 3, qty 0, cần trước ngày quá khứ, địa chỉ thiếu) ⇒ 400 câu `validateRequestDraft`; đúng ⇒ `status:"moi"`, mã `YC…`; người thứ 11 đang chờ ⇒ 400.
- AC-85 (A) Người khác mở `/api/cho/yeu-cau/{id}` ⇒ 404.
- AC-86 (A) `PATCH /api/admin/cho/yeu-cau/{id}` `{action:"bao_gia"}` thiếu shop/tiền < 1.000/phí > 5 triệu/hẹn sai ⇒ 400; shop chưa hoạt động ⇒ 400; đúng ⇒ `da_bao_gia`, `quote.expiresAt = quotedAt + 3 ngày`, Y1 cho chủ tàu, nhật ký `market.request-quote`.
- AC-87 (A) `{action:"khong_tim_duoc"}` lý do < 3 ⇒ 400; đúng ⇒ `khong_tim_duoc` + Y2.
- AC-88 (A) Chủ tàu `{action:"dong_y"}` khi `da_bao_gia` còn hạn ⇒ 200 `{request: da_dat + orderId, order: da_xac_nhan, shopId = quoteShopId, etaFrom/etaTo = báo giá, requestId}`; N1 cho chủ shop; quá hạn ⇒ 409 "Báo giá đã hết hạn".
- AC-89 (U) Huỷ đơn sinh từ yêu cầu không đổi tồn kho món nào (`market-store-contract.test.ts`).
- AC-90 (U) Báo giá quá 3 ngày / yêu cầu `moi` quá 7 ngày ⇒ `het_han`, mốc = lúc đến hạn (`settleRequest`).
- AC-91 (E) Mất sóng ở `/cho/yeu-cau` ⇒ hiện bản lưu + tuổi; nút gửi/đồng ý/huỷ vô hiệu kèm "cần có sóng".
- AC-92 (E) Sen Biển làm được mọi thao tác sàn (doc 15 §25); việc ghi có hậu quả luôn hỏi MỘT CHẠM xác nhận trước khi gửi.

---

## 12. Phản biện với khung của lead — ĐÃ CHỐT (LEAD-BRIEF §4, 2026-09-06)

| # | Vấn đề đã nêu | Lead chốt | Ghi ở |
|---|---|---|---|
| 1 | Tồn kho trừ lúc nào | Trừ khi TẠO đơn (atomic, RPC 1 transaction/shop), hoàn khi huỷ; file-store khoá ghi tuần tự | §4.2, 12 §2 |
| 2 | Chuỗi cứng 1 máy × 1 SĐT/shop; SĐT chủ SDVICO | 1 SĐT = 1 shop (giữ). **Admin xử lý đơn thay mọi shop** (`by=admin:<sđt>`). Prod: chủ SDVICO = sentinel + admin gán (§5 A2); dev: persona có shop. Nhiều SĐT/shop = nợ | §4.1, §7, R10, R16 |
| 3 | Đơn `da_giao` treo khi chưa có cron | **`settleOverdue` thuần, chạy khi ĐỌC** ở mọi route đọc đơn/thống kê; không cron | §4.1 T4', §4.3, R13, 12 §4.1/§7 |
| 4 | Push OS cho người bán trái 07 §12 | **Ngoại lệ** cho actor người bán (N1, N8, N10–N12); người mua giữ luật cũ; ghi 1 dòng 07 §12 cùng commit | §8 |
| 5 | 1 checkout → N đơn, hỏng một phần | Từng đơn độc lập, `results[]`, giỏ chỉ xoá dòng đã đặt được | §5.6, R6 |
| 6 | `client_ref` thiếu `shopId` | `marketOrderClientRef` = shopId + món (id, biến thể, qty sắp thứ tự) + địa chỉ + cách trả + ghi chú; file `lib/market/order-ref.ts` | §3.5, R6 |
| 7 | Hoàn tiền khi huỷ đơn CK | Cột `needs_refund`; huỷ đơn CK đã `bao_da_chuyen`/`da_thanh_toan` → true; hiện 2 bên; không xử lý tiền | §4.1 (*), R12 |
| 8 | Seller không có "tạm nghỉ" | `shops.paused` — SP vẫn hiện, không đặt được, trang shop nói rõ | §3.1, §6.6, R2' |
| 9 | Cách trả tiền khi lẫn shop có/không STK | 1 cách trả chung/lần đặt; có shop không STK ⇒ ép COD toàn bộ + nói rõ | §5.6, R11 |
| 10 | `tel:` ẩn khi offline | **KHÔNG ẩn** | §5 quy ước, R14 |
| 11 | Trang chủ bày món toàn sàn | Cùng tỉnh cảng nhà trước (khối "Gần bà con"), rồi mới nhất; `?province`; chip "Gần tôi" ở `/cho/tim` | §5.1, §5.2 |
| 12 | Dọn ảnh mồ côi | Xoá mềm `deleted_at`, giữ ảnh; dọn = nợ | §3.2, §6.4 |
| 13 | Admin-only vs staff | `requireAdmin` (giữ), nợ nấc quyền `cho` cho manager | §7 |
| 14 | Danh mục chưa chốt | 9 id gạch-ngang, nhãn, thứ tự cố định — `PRODUCT_CATEGORIES` | §3.2, R19 |
| 15 | Đánh giá không moderation | `product_reviews.hidden` + admin ẩn, tính lại điểm | §3.6, §7 |
| 16 | Dòng "Kênh người bán" cho mọi người | Có shop → "Kênh người bán"; chưa có → dòng mờ "Bà con có bán vật tư? Đăng ký shop" | §6 quy ước, §3.8 |

---

## Assumptions (mục nào lead đã chốt ghi "chốt"; còn lại fail-closed — lead/chủ dự án bác thì sửa spec, không sửa code trước)

- **Chốt**: tồn kho trừ lúc tạo đơn; hoàn khi huỷ; hoàn không kiểm trần; `soldCount` cộng lúc đặt/trừ khi hoàn (không ở `hoan_thanh`) — vì `settleOverdue` chạy trên đường đọc, không được ghi sản phẩm.
- **Chốt (LEAD §5 A4)**: không chặn mua của chính shop mình v1.
- Shop `cho_duyet` được soạn sản phẩm trước; `tam_khoa` vẫn xử lý đơn treo, không nhận đơn mới, không sửa sản phẩm.
- **Chốt (LEAD §5 #5)**: biến thể 1 cấp = nhãn + giá riêng, 0 hoặc 2..10; tồn kho chung theo sản phẩm.
- **Chốt**: 1 cách trả tiền chung cho cả lần đặt; có shop không STK → ép COD toàn bộ.
- `chuyen_khoan`: nội dung CK = mã đơn; buyer tự báo "đã chuyển", seller tự xác nhận; app không kiểm tra tiền, không hứa gì về tiền; `needsRefund` chỉ nhắc.
- Buyer huỷ chỉ khi `cho_xac_nhan`; huỷ có chip lý do tuỳ chọn; seller/admin huỷ bắt buộc lý do 5–200 chữ.
- ~~Đơn `cho_xac_nhan` >48h không tự huỷ, chỉ nhắc 2 bên.~~ **Thay 2026-10-18** (chủ dự án "luồng giống Shopee"): tự huỷ sau **72 giờ** (§4.3); mốc 72 giờ là mặc định an toàn tự chọn (Shopee 1–3 ngày tuỳ ngành) — chủ dự án đổi được ở `AUTO_CANCEL_MS`.
- **2026-10-18 (tự chọn, chờ chủ dự án)**: "chủ sàn" = admin `/quan-tri` (requireAdmin); báo giá giữ **3 ngày**, yêu cầu không trả lời **7 ngày** thì hết hạn; tối đa **10** yêu cầu đang chờ/người; yêu cầu chưa đính ảnh (`// nợ:` buyer chưa có route tải ảnh — mô tả bằng chữ); đơn từ yêu cầu vào thẳng `da_xac_nhan` (không bắt shop xác nhận lần hai); một đơn = một dòng hàng giá = tiền hàng / số lượng (làm tròn).
- Đánh giá không sửa/xoá bởi buyer; không ảnh; admin ẩn được; `ratingAvg` cache trên món + shop từ đánh giá không ẩn.
- Doanh thu thống kê = tổng `totalVnd` (kể cả ship) của đơn `hoan_thanh` theo `completedAt` giờ VN.
- Danh sách: 20/trang, nút "Xem thêm", không cuộn vô tận; tìm không dấu; hết hàng vẫn hiện (mờ).
- Cache local: giỏ (+ bản tra), địa chỉ (≤10), yêu thích (≤100 kèm snapshot), 50 đơn gần nhất, cờ có shop — 5 khoá `forfish.m*.v1`, ngăn theo SĐT, cấm sao lưu.
- **Chốt (LEAD §4 #10)**: nút `tel:` trong chợ không ẩn khi offline.
- Đồng hồ fetch: đọc 12s · ghi 20s · upload ảnh 60s.
- Mã đơn hiển thị = `SD` + yymmdd + 4 ký tự (`makeOrderCode`, 12 §4.5) — thay cho "8 ký tự đầu uuid" của bản 1.0: có ngày, không nhầm 0/O/1/I, đọc qua điện thoại được.
- Không có "Mua ngay" (bỏ qua giỏ) — mọi đường mua đi qua giỏ để một luồng đặt hàng duy nhất.
- Tên shop duy nhất qua `slug` (không hậu tố): hai shop cùng tên gây nhầm cho bà con.
- `?province` là **lọc**; "cùng tỉnh trước" ở `/cho` hiện thực bằng khối "Gần bà con" đặt trên "Món mới lên chợ" (xếp hạng theo tỉnh trong một truy vấn không có ở PostgREST).
- T4' (`settleOverdue`) không gửi thông báo — không phải tin mới với ai.

**Open (chờ lead/chủ dự án)**: không còn. Mọi điểm §12 đã chốt 2026-09-06.

**Risk-tier (ai-simple #06)**: 🔴 — bảng mới + Storage bucket (migration 0060, KHÔNG tự apply remote), tiền thật giữa hai bên ngoài app, cross-trục (lối vào `/tien`, `/tau`, sheet Tài khoản), thông báo mở rộng §8, nhánh dev trong `api-identity.ts`/`admin-auth.ts`.

## History
- **v1.4 (2026-10-18) — luồng giống Shopee**: tự huỷ 72 giờ (§4.3 thay luật 48 giờ), hẹn giao bắt buộc khi xác nhận + dời hẹn + trễ hẹn (§4.4, §6.5), đặt món chợ chưa có qua chủ sàn (§5.9, §7b), Y1/Y2 (§8), AC-78..92; Sen Biển làm mọi thao tác sàn (doc 15 §25).
- v1 (2026-09-06): khởi tạo pha BA từ LEAD-BRIEF 2026-09-06; 62 AC; 16 điểm phản biện; 5 điểm chờ chốt.
- **v1.3 (2026-09-06) — Buyer, vòng fix UX 2 (ux-audit2/AUDIT2.md)**: §5.6 ghi chú **theo từng shop** (`shops[].buyerNote`, ô nằm trong khối shop, bỏ ô chung; `clientRef` tính kèm ghi chú của chính shop đó); §5.8 nút "Đánh giá" xuống hàng riêng full-width (R-01) + thêm **Mua lại** cho đơn đã kết thúc; §5.2 số kết quả "N món" ra dòng riêng dưới dải chip (R-02); §5.3 nút chính KHÔNG mờ khi chưa chọn loại — bấm là cuộn tới khối loại/cỡ + nháy viền + câu "Chọn loại/cỡ trước rồi bấm lại giúp." (R-03); §5.7 thẻ đơn: tên shop một dòng, chip trạng thái xuống dòng riêng (R-04); thẻ lưới gọn còn ~300px (R-05). Không đổi AC.
- **v1.2 (2026-09-06) — Buyer, vòng fix UX (ux-audit/AUDIT.md + LEAD §6)**: §5.5 ô chọn giỏ + "Đặt hàng (n)" + lời mời đăng nhập là sheet; §5.6 địa chỉ đợi `ready`, sheet hai bước, `<select>` tỉnh, lỗi dưới ô, ảnh + "× N", chip CK mờ, "Mua tiếp"; mọi màn `/cho/**` dùng đầu màn gọn có Quay lại (`MarketHeader`); thẻ lưới gọn chạm-cả-thẻ, bỏ "+ Giỏ"; chip sắp xếp ngang + "N món" (tìm + shop); tab đơn `grid-cols-4`; ảnh món ở thẻ đơn/chi tiết; badge giỏ = số dòng. Không đổi AC.
- **v1.1 (2026-09-06) — hợp nhất sau phản biện**: đưa đủ 16 quyết định LEAD-BRIEF §4 + §5 vào §3–§10; tên trường/mã trạng thái/route/trần số lấy NGUYÊN VĂN từ 12-kien-truc 1.1 (`cho_duyet|hoat_dong|tam_khoa|tu_choi`, `items/subtotalVnd/shippingVnd`, `address{name,phone,province,detail,isPort}`, `variantLabel`, `/api/cho/san-pham`, `/api/cho/gio/tinh`, `/cho/shop/[slug]`, mã đơn `SD…`, danh mục gạch-ngang); bỏ R4 "không mua shop mình"; thêm R2'/R12/R13/R17/R19; AC 62 → 77 (thêm AC-08/08b/15b/29b/38b/38c/44b/53b/53c/56b/56c/63–67), mỗi AC ghi route/hàm; §12 đổi thành bảng "đã chốt". Bảng đối chiếu: `_generated/phan-bien-san-thuong-mai-2026-09-06.md`.

**Last updated**: 2026-10-18 (v1.4 — luồng giống Shopee: tự huỷ 72h, hẹn giao, đặt món chợ chưa có)

Cập nhật UI 2026-09-08: ảnh chi tiết hàng dùng khung 4:3 và object-contain, giảm vùng ảnh trống và không cắt vật tư. Các thay đổi bố cục được ghi ở 07-design-spec, không thay đổi máy trạng thái đơn hoặc giao kèo API.
