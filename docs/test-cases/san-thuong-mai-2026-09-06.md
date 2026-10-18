# Bộ kịch bản test — Chợ vật tư tàu cá (sàn đa người bán)

> Ngày: 2026-09-06 · Nhánh: `feat/san-thuong-mai` · Oracle: [11-ba-spec §11 — 77 mã AC](../app-map/11-ba-spec-san-thuong-mai.md) · Route: [12-kien-truc §7](../app-map/12-kien-truc-san-thuong-mai.md)
>
> Dùng cho **người test tay** (tester) và cho việc đối chiếu bộ tự động `tests/e2e/san/**`.
> Câu chữ ở cột "Kết quả mong đợi" là **copy nguyên văn** của 11 §3–§9 — thấy khác một chữ cũng là FAIL (bà con đọc ngoài nắng, chữ khác là nghĩa khác).

---

## 0. Chuẩn bị môi trường (làm 1 lần trước mỗi lượt test)

| Bước | Lệnh / thao tác | Kỳ vọng |
|---|---|---|
| 0.1 | Xoá kho dev cũ: `rm -rf .local/market-dev.json .local/market-uploads` | Kho sạch — mỗi lượt test bắt đầu từ seed 12 §5.3 |
| 0.2 | `npm run dev:cho` (mặc định cổng 3020; `npm run dev:cho -- -p 3031` nếu cổng bận) | Server chạy ở **kho file** (`MARKET_STORE=file`) |
| 0.3 | Mở `/dev` | 7 persona: Anh Ba `0901000001` · Chị Tư `0901000002` · Cô Năm `0901000003` (chưa có shop) · SDVICO `0902000001` · Hải Đăng `0902000002` · Phương Nam `0902000003` (chờ duyệt) · Admin `0909000000` |
| 0.4 | Bấm **Đăng nhập** ở persona cần dùng | Vào thẳng `/cho` (buyer) · `/ban-hang` (seller) · `/quan-tri` (admin) |
| 0.5 | Bộ tự động | `SAN_APP_DIR=<thư mục app> npm run e2e:san` (hoặc `--project=api` / `--project=mobile`) |

**Dữ liệu seed hay dùng**: shop SDVICO (Khánh Hòa, phí giao 0, **KHÔNG có STK** ⇒ ép trả khi nhận) · Hải Đăng (Gia Lai, phí giao 30.000đ, miễn phí từ 2.000.000đ, có STK) · món "Lọc dầu diesel máy tàu" tồn 2 · "Bộ đàm hàng hải Icom IC-M25" tồn 0 · "Lưới kéo mắt nhỏ 2a=10mm" bị admin gỡ · "Mì gói thùng 30 gói" bị ẩn · "Bạt cũ thanh lý" đã xoá · đơn `SD260825H8ZN` đã giao **9 ngày** trước.

**Mức**: **P0** = hỏng là chặn phát hành (mất tiền, mất đơn, lộ dữ liệu) · **P1** = sai nghiệp vụ thấy được · **P2** = trau chuốt.

---

## 1. TC-A — API (chạy bằng bộ tự động `--project=api`, hoặc `curl` kèm header `x-sdfish-token`)

| Mã | AC | Tiền điều kiện | Bước | Kết quả mong đợi | Mức |
|---|---|---|---|---|---|
| TC-A-01 | AC-02 | Kho seed, KHÔNG gửi chuỗi | `GET /api/cho/san-pham?pageSize=50` | 200. Có "Bộ đàm hàng hải Icom IC-M25" (hết hàng vẫn hiện). KHÔNG có món bị gỡ / bị ẩn / đã xoá / của shop chưa duyệt | P0 |
| TC-A-02 | AC-03 | — | `GET /api/cho/san-pham?q=loc dau` | Trả "Lọc dầu diesel máy tàu" (tìm không dấu). `q` rỗng ⇒ danh sách mới nhất | P0 |
| TC-A-03 | AC-04, AC-67 | — | `sort=ban_chay`, `sort=gia_tang`, `category=may-dong-co`, `category=may_dong_co` | Bán chạy giảm dần theo đã bán; giá tăng dần; gạch-ngang 200; **gạch dưới ⇒ 400 `invalid`** | P1 |
| TC-A-04 | AC-05 | — | `page=1` · `pageSize=200` · `page=26` | 20 món/trang + `total`; `pageSize` bị hạ về 50; trang quá xa trả `items: []`, KHÔNG lỗi | P1 |
| TC-A-05 | AC-08 | — | `GET /api/cho/san-pham?province=Gia Lai` | Chỉ món của shop tỉnh đó | P1 |
| TC-A-06 | AC-08b | Hải Đăng bật `paused` | `GET /api/cho/san-pham` và `/api/cho/san-pham/[id]` | Vẫn 200, món vẫn hiện, cờ `shopPaused=true` / `shop.paused=true` | P1 |
| TC-A-07 | AC-13, AC-17 | — | `POST /api/cho/gio/tinh` với 1 món SDVICO + 10 "Đá cây 50kg"; rồi 60 "Đá cây 50kg" | 2 nhóm theo shop; Hải Đăng phí giao 30.000đ; qua 2.000.000đ ⇒ phí giao 0; `total = tiền hàng + giao` | P0 |
| TC-A-08 | AC-16 | Đăng nhập Anh Ba | `POST /api/cho/don` với 2 shop | `results[]` 2 phần tử `ok:true`, **2 đơn, mỗi đơn 1 shop**, mã `SDyymmddXXXX`, trạng thái `cho_xac_nhan`, tồn trừ + đã bán cộng ngay | P0 |
| TC-A-09 | AC-18 | — | Gửi `expectedTotalVnd` sai | `{ok:false, code:"price_changed", quote}`; **không tạo đơn**, tồn không đổi | P0 |
| TC-A-10 | AC-19 | — | Gửi 2 lần cùng `clientRef` | Lần 2 `ok:true, duplicate:true`, **cùng `id`**; tồn chỉ trừ 1 lần | P0 |
| TC-A-11 | AC-21 | Đặt tồn món = 1 | 2 người mua gửi cùng lúc, mỗi người qty 1 | Đúng **1** thành công; người kia `line_unavailable` + `available = {id: 0}`; tồn cuối 0 | P0 |
| TC-A-12 | AC-22 | — | Đặt 2 shop, shop B có món vượt tồn | Shop A tạo được đơn; shop B `line_unavailable` kèm `productIds` | P0 |
| TC-A-13 | AC-23, AC-55 | Admin khoá Hải Đăng giữa chừng | `GET /api/cho/san-pham` · `GET /api/cho/shop/dai-ly-hai-dang` · `POST /api/cho/don` | Món biến khỏi chợ ngay; trang shop 403 `shop_not_active` ⇒ màn nói **"Shop này đang tạm đóng."**; đặt trả `shop_not_active`, tồn không đổi | P0 |
| TC-A-14 | AC-23, AC-53b | Seller bật "Tạm nghỉ bán" | `POST /api/cho/don` | Trả `shop_paused`; món **vẫn hiện** trên chợ; tắt tạm nghỉ ⇒ đặt được | P1 |
| TC-A-15 | AC-24 | Giỏ có shop SDVICO (không STK) | `POST /api/cho/don` với `paymentMethod=chuyen_khoan` | 400 `invalid` + **"Shop SDVICO chỉ nhận tiền mặt — chọn Trả khi nhận hàng cho cả lần đặt."** | P0 |
| TC-A-16 | AC-25 | — | 21 dòng cho 1 shop; 6 shop trong 1 lần đặt | 400 **"Mỗi đơn tối đa 20 món — tách bớt sang lần đặt sau."** / **"Mỗi lần đặt tối đa 5 shop — tách bớt sang lần đặt sau."** | P1 |
| TC-A-17 | AC-26 | — | Gửi 2 request đặt hàng **song song**, cùng nội dung | Chỉ 1 đơn được tạo; cả 2 lần trả `ok:true` (lần sau `duplicate:true`) | P0 |
| TC-A-18 | AC-29b | Đơn chuyển khoản với Hải Đăng | Shop xoá STK sau khi có đơn → `GET /api/cho/don/[id]` | Đơn vẫn trả **`bankSnapshot` cũ** (STK lúc đặt) | P0 |
| TC-A-19 | AC-31 | Đơn `cho_xac_nhan` | Seller `PATCH …/don/[id] {status:"da_huy"}` không lý do, rồi 4 chữ, rồi đủ lý do | 400 `invalid` **"Ghi lý do cho người mua biết."** hai lần đầu; lần ba `da_huy` + **hoàn tồn + trừ lại đã bán** | P0 |
| TC-A-20 | AC-32 | — | Buyer huỷ ở `da_xac_nhan`; buyer huỷ ở `cho_xac_nhan`; huỷ lần 2 | 409 `bad_transition` ⇒ **"Đơn đã sang bước khác rồi — kéo để tải lại."**; ở `cho_xac_nhan` OK + hoàn tồn; huỷ lần 2 ⇒ 409 | P0 |
| TC-A-21 | AC-33 | Đơn `da_giao`, COD | `POST /api/cho/don/[id]/da-nhan` | `hoan_thanh`, có `completedAt`, `paymentStatus=da_thanh_toan`, **đã bán KHÔNG đổi** | P0 |
| TC-A-22 | AC-34 | Vừa bấm Đã nhận | Bấm lần 2 | 409 `bad_transition` | P1 |
| TC-A-23 | AC-35 | Đơn COD | `POST …/bao-chuyen`; P3 không lý do | COD ⇒ 400; P3 thiếu lý do ⇒ 400 | P1 |
| TC-A-24 | AC-36 | Đơn CK đã `bao_da_chuyen` | Seller (hoặc admin, hoặc buyer) huỷ | `needsRefund=true`; buyer thấy **"Shop cần hoàn tiền cho bà con — gọi shop {SĐT}"**; đơn COD huỷ ⇒ `false` | P0 |
| TC-A-25 | AC-37 | Đơn `dang_giao` | Admin `PATCH /api/admin/cho/don/[id]` huỷ có lý do; rồi thử huỷ đơn `da_giao` | `da_huy` + hoàn tồn, `cancelBy=admin`, timeline `by="admin:<sđt>"`; đơn `da_giao` ⇒ 409 | P0 |
| TC-A-26 | AC-38 | — | Mọi lần đổi trạng thái / thanh toán | Timeline thêm đúng 1 dòng `{status, at, by}` mỗi lần | P1 |
| TC-A-27 | AC-38c | Đơn seed `SD260825H8ZN` (đã giao 9 ngày) | `GET /api/cho/don` (hoặc `/api/ban-hang/don`, `/thong-ke`, `/api/admin/cho/don`) | Đơn về `hoan_thanh` ngay lượt đọc, `by="system"`, `completedAt = deliveredAt + 7 ngày`, **không thông báo nào được gửi** | P0 |
| TC-A-28 | AC-39 | 2 persona mua | Chị Tư đọc đơn của Anh Ba | 404 (không lộ tồn tại) | P0 |
| TC-A-29 | AC-42 | Đơn `da_giao` rồi `hoan_thanh` | Đánh giá lúc `da_giao`; lúc `hoan_thanh`; lần 2 cùng món | 409 `review_not_allowed` **"Chỉ đánh giá được khi đã nhận hàng."** → 201 → 409 `already_reviewed` **"Món này bà con đã đánh giá rồi."** | P1 |
| TC-A-30 | AC-43 | 1 đánh giá 4★ + 1 đánh giá 2★ | Đọc món và shop | `ratingAvg=3`, `ratingCount=2` trên cả món lẫn shop | P1 |
| TC-A-31 | AC-43 | Có đánh giá không ẩn | Admin `PATCH /api/admin/cho/danh-gia/[id] {hidden:true}` | Điểm tính lại **không gồm** đánh giá ẩn; `GET …/danh-gia` không trả nó nữa | P1 |
| TC-A-32 | AC-44 | Cô Năm chưa có shop | Đăng ký tên trùng "SDVICO"; rồi tên riêng; rồi đăng ký lần 2 | 409 `slug_taken` **"Tên shop này đã có người dùng — chọn tên khác."** → 201 `cho_duyet` → 409 **"Số này đã có shop rồi. Vào Kênh người bán để xem."** | P0 |
| TC-A-33 | AC-44b | Shop `tu_choi` | Gửi lại `POST /api/ban-hang/shop` | **Cùng `id`**, status về `cho_duyet`, không tạo hàng mới | P1 |
| TC-A-34 | AC-45 | Shop `cho_duyet` | Thêm sản phẩm → xem chợ → admin duyệt → xem chợ | 201; món **chưa** lên chợ; duyệt xong **tự** hiện, seller không phải làm gì | P0 |
| TC-A-35 | AC-46, AC-67 | Chủ shop | Gửi món: tên 2 chữ · giá 999 · giá gạch ≤ giá · 1 biến thể · 11 biến thể · 2 biến thể trùng nhãn khác dấu · 7 ảnh · `category` gạch dưới | Mỗi ca 400 `invalid` + đúng câu tiếng Việt 11 §3.2 | P0 |
| TC-A-36 | AC-47 | Chủ shop | Upload JPEG 2 KB · JPEG 600 KB · tệp chữ khai `image/jpeg` · PNG thật tên `.jpg` | 200 + `url` → 413 `bad_size` → 415 `bad_type` → 200 (là PNG thật) | P0 |
| TC-A-37 | AC-48 | Có đơn treo chứa món X | Seller đổi giá món X | `items[].priceVnd` của đơn **không đổi** (R3) | P0 |
| TC-A-38 | AC-49 | — | Seller xoá món; đọc lại danh sách; xoá lần 2 | Xoá mềm (`deletedAt`), biến khỏi danh sách shop + chợ, đơn cũ vẫn đủ `items`; xoá lần 2 ⇒ 404 | P1 |
| TC-A-39 | AC-51 | Shop `tam_khoa`, có đơn treo | Thêm món; xử lý đơn treo (T1/T2/T3/T6, P2/P3) | Thêm món 403 `shop_not_active`; **đơn treo vẫn xử lý được** (không bỏ rơi người mua) | P0 |
| TC-A-40 | AC-52 | Có đơn hoàn thành trong kỳ | `GET /api/ban-hang/thong-ke?range=7d` | Doanh thu = tổng `totalVnd` đơn `hoan_thanh` có `completedAt` trong kỳ; đơn `da_giao` chưa 7 ngày KHÔNG tính; quá 7 ngày ĐƯỢC tính | P1 |
| TC-A-41 | AC-53 | Đơn đang xử lý | Seller ghi `sellerNote` | Buyer thấy ghi chú ở `/cho/don/[id]`; buyer không có đường sửa nó | P1 |
| TC-A-42 | AC-56 | Shop `cho_duyet` | Từ chối / khoá / gỡ món **không lý do** hoặc < 5 chữ | 400 `invalid` **"Ghi lý do cho shop biết."** | P1 |
| TC-A-43 | AC-56b | — | Admin gán `ownerPhone` cho shop; rồi gán SĐT đã là chủ shop khác | Gán được (persona đó vào `/ban-hang` thấy shop); SĐT trùng ⇒ 400 `invalid` **"Số này đã có shop"** | P1 |
| TC-A-44 | AC-56c | Đơn bất kỳ | Admin làm T1 trên đơn của shop khác | `da_xac_nhan`, timeline `by="admin:<sđt>"`, ghi `logActivity action="market.order-update"` | P0 |
| TC-A-45 | AC-57 | — | Đặt đơn mới → xem `GET /api/dev/notifications?phone=<chủ shop>` | Có tin "Đơn mới {mã}" với `pushOs:true` cho **người bán**; T1 tới buyer `pushOs:false`; T2/T3/T6/T7/P3 buyer `pushOs:true`; duyệt/từ chối/khoá tới seller `pushOs:true` | P1 |
| TC-A-46 | AC-58 | Mock `notifyAccount` ném lỗi (unit) | Đổi trạng thái đơn | Vẫn 200 — thông báo best-effort, không bao giờ làm hỏng việc chính | P1 |

---

## 2. TC-E — Màn hình (điện thoại thật hoặc trình duyệt khổ máy)

| Mã | AC | Tiền điều kiện | Bước | Kết quả mong đợi | Mức |
|---|---|---|---|---|---|
| TC-E-01 | AC-01 | **Chưa đăng nhập** | Mở `/cho` | Thấy danh sách món, ô tìm, chip 9 nhóm, nút Giỏ + Đơn hàng — không bị đá về màn đăng nhập | P0 |
| TC-E-02 | AC-08 | Máy đã biết tỉnh cảng nhà | Mở `/cho` | Có khối **"Gần bà con — {tỉnh}"** trên "Món mới lên chợ"; máy chưa biết tỉnh ⇒ **ẩn khối, không báo lỗi** | P1 |
| TC-E-03 | AC-02 | 0 sản phẩm toàn sàn | Mở `/cho` | **"Chợ chưa có món nào. SDVICO đang mời các đại lý lên sàn."** (KHÔNG mời ngư dân đăng bán) | P2 |
| TC-E-04 | AC-06 | Món "Dây thừng PP tàu cá" | Mở trang món, chưa chọn loại | Nút Thêm vào giỏ **vô hiệu** + "Chọn loại"; chọn Ø12 ⇒ giá đổi theo, **tồn không đổi** (kho chung) | P1 |
| TC-E-05 | AC-07 | Món tồn 0 | Mở trang món | Nút **"Hết hàng"** vô hiệu; nút ♡ vẫn dùng được | P1 |
| TC-E-06 | AC-08b | Shop bật tạm nghỉ | Mở trang món của shop đó | Băng vàng **"Shop đang tạm nghỉ, mở lại sau"** + nút Thêm vào giỏ vô hiệu; ♡ vẫn dùng | P1 |
| TC-E-07 | AC-01 | Chưa đăng nhập | Bấm ♡ trên trang món | `LoginGate` **tại chỗ**, KHÔNG chuyển trang | P1 |
| TC-E-08 | AC-01 | Chưa đăng nhập, giỏ có món | Bấm **"Đặt hàng (1)"** ở giỏ | **Bottom sheet** (`role="dialog"`) đè lên ngay chỗ đang nhìn — tiêu đề "Cần tài khoản", câu **"Đăng nhập để đặt hàng"** + **"Tài khoản do SDVICO cấp — gọi SDVICO để được mở."** + nút "Để sau". Phải **thấy được trong tầm mắt** (F-01: bản cũ vẽ thẻ inline dưới đáy ⇒ bấm xong màn không đổi gì, bà con tưởng nút hỏng). Vẫn ở `/cho/gio` | P0 |
| TC-E-09 | AC-14 | Món trong giỏ bị admin gỡ | Mở lại `/cho/gio` | Thẻ mờ **"Món này không còn trên chợ"**, không tính vào tổng, nút Đặt hàng vẫn bấm được nếu còn món khác | P0 |
| TC-E-10 | AC-15 | Giỏ đã tra giá 1 lần, tắt mạng | Mở `/cho/gio` | Hiện bản tra gần nhất + **"giá lúc HH:MM"**; nút **"Đặt hàng (n)"** **vô hiệu** + **"Đặt hàng cần có sóng. Giỏ vẫn giữ nguyên."** | P0 |
| TC-E-11 | AC-15b | Giỏ có món của shop tạm nghỉ | Mở `/cho/gio` | Dòng mờ **"Shop đang tạm nghỉ, mở lại sau"**, không tính tổng | P1 |
| TC-E-12 | AC-16 | Giỏ 2 shop | Mở `/cho/thanh-toan` | Dòng chốt **"Sẽ tạo 2 đơn cho 2 shop · Tổng: …"** | P1 |
| TC-E-13 | AC-26 | Màn Đặt hàng | Bấm **Đặt hàng** hai lần thật nhanh | Nút đổi "Đang gửi…" và vô hiệu ⇒ **đúng 1 request**, đúng 1 đơn | P0 |
| TC-E-14 | AC-27 | Đặt xong, cách trả = Chuyển khoản | Xem màn kết quả | Mỗi đơn 1 thẻ [mã · shop · tổng · cách trả]; khối STK từ `bankSnapshot`, **nội dung CK = mã đơn**, nút "Sao chép số TK"; đơn hiện ở `/cho/don` tab Đang xử lý; giỏ chỉ xoá dòng đã đặt được — **dòng đang bỏ chọn giữ nguyên** | P0 |
| TC-E-15 | AC-40 | Đã mở `/cho/don` khi có sóng | Tắt mạng, mở lại màn | **"Đang xem đơn đã lưu trong máy (N phút trước) — có sóng sẽ tự tải mới"**; bật lại sóng ⇒ **tự** tải, không phải bấm Thử lại | P0 |
| TC-E-16 | AC-41 | Máy dùng chung: đăng nhập SĐT A xem đơn, đăng xuất, đăng nhập SĐT B | Mở `/cho/don` bằng SĐT B | KHÔNG thấy đơn của A (ngăn theo SĐT) | P0 |
| TC-E-17 | AC-53c | 2 persona: có shop / chưa có shop | Mở sheet Tài khoản | Có shop ⇒ dòng **"Kênh người bán"**; chưa có ⇒ dòng mờ **"Bà con có bán vật tư? Đăng ký shop"**; mất sóng và chưa có cờ ⇒ **không dòng nào** | P1 |
| TC-E-18 | AC-59 | Chặn mạng cho `/api/cho/*` (DevTools throttle "offline" sau khi bấm) | Bấm một nút gọi server | Ra nhánh lỗi trong ≤ 21 s (upload ≤ 61 s), **không treo "Đang gửi…"**, có nút Thử lại | P0 |
| TC-E-19 | AC-60 | Mở DevTools → Network | Mở `/`, `/tau`, `/tien` | **Không** có request nào tới `/api/cho/*` hay `/api/ban-hang/*`; sheet Tài khoản chỉ gọi khi mở sheet | P0 |
| TC-E-20 | AC-61 | Form sản phẩm đang gõ dở | Tắt mạng rồi bấm Lưu | **"Chưa lưu được — cần sóng. Nội dung vẫn ở trên màn."** — form KHÔNG bị xoá | P0 |
| TC-E-21 | AC-63 | Trang món / chi tiết đơn | Tắt mạng | Nút **Gọi shop** (`tel:`) **vẫn hiện**; lời mời đăng nhập thì ẩn | P0 |
| TC-E-22 | LEAD §5 #10 | **Bản cài PWA** trên điện thoại (Add to Home Screen), đã cài rồi mở lại | Mở `/cho`, `/cho/sp/[id]` | **Ảnh sản phẩm hiện đủ**, không ô trống — service worker không chặn ảnh (kể cả ảnh khác tên miền) | P0 |
| TC-E-23 | 03 §design-system | Màn `/cho`, `/cho/sp/[id]`, `/cho/gio`, `/cho/don` và `/ban-hang`, `/ban-hang/san-pham`, `/ban-hang/don`, `/ban-hang/cai-dat` | Đo mọi `button` · `a` · ô đánh dấu đang hiện | Mọi vùng chạm ≥ 56px, trừ **ba ngoại lệ có chủ đích**: (a) dock `nav[aria-label="Điều hướng chính"]` 70×55px — chủ dự án chốt bớt 5px; (b) ♡ trên thẻ lưới 2.75rem (LEAD F-04 — nút đè lên ảnh lớn, không cạnh nút nào khác); (c) ô đánh dấu gốc của máy nằm trong `<label>` cao ≥ 3.5rem. Ngoài ba cái đó là FAIL. Chữ nội dung ≥ 18px ở gốc 16px; đọc được ngoài nắng; vòng focus không bị xoá | P1 |
| TC-E-24 | AC-24 | Giỏ có SDVICO (không STK) | Mở `/cho/thanh-toan` | Chip **Chuyển khoản hiện MỜ (vô hiệu), KHÔNG ẩn** — F-16: ẩn hẳn làm người quen CK tưởng app không có — kèm dòng nhỏ ngay dưới **"Shop SDVICO chỉ nhận tiền mặt — lần đặt này trả khi nhận hàng."** | P1 |
| TC-E-25 | AC-38 | Đơn đã đi vài bước | Mở `/cho/don/[id]` | Dòng thời gian đủ mốc giờ; mục thanh toán xen kẽ; `by=admin:…` hiện **"SDVICO đã xử lý thay"** | P1 |

### 2b. TC-E — ô chọn trong giỏ + màn Kênh người bán (vòng fix UX 2026-09-06)

| Mã | AC | Tiền điều kiện | Bước | Kết quả mong đợi | Mức |
|---|---|---|---|---|---|
| TC-E-26 | AC-09 (F-05) | Giỏ có món của **2 shop**, mặc định chọn hết | Bỏ chọn ô của **cả shop A** | Nhãn nút đổi từ **"Đặt hàng (2)"** sang **"Đặt hàng (1)"**; tổng tạm chỉ tính dòng đang chọn; ô "Chọn tất cả" sang trạng thái **nửa vời** (`aria-checked="mixed"`), không phải bỏ trắng; dòng shop A **mờ đi nhưng vẫn nằm trong giỏ** | P0 |
| TC-E-27 | AC-16 (F-05) | Tiếp TC-E-26 | Bấm Đặt hàng → điền địa chỉ → đặt → quay lại `/cho/gio` | Màn Đặt hàng nói **"Sẽ tạo 1 đơn cho 1 shop"**; kết quả **"Đã đặt 1 đơn"**; về giỏ: dòng shop B biến mất, **dòng bỏ chọn của shop A còn nguyên và vẫn đang bỏ chọn**, thanh đáy nói **"Chọn ít nhất một món để đặt."** | P0 |
| TC-E-28 | AC-29 (F-11) | Máy chưa có địa chỉ nào | Mở `/cho/thanh-toan` | Sheet **form** tự mở (chỉ khi danh tính đã rõ mà vẫn chưa có địa chỉ — F-02); **Tỉnh là ô chọn của máy (`<select>`)**, không còn 34 chip cuộn ngang. Đã có địa chỉ ⇒ bấm "Đổi" ra sheet **danh sách**, phải bấm **"+ Thêm địa chỉ mới"** mới sang form | P1 |
| TC-E-29 | AC-52 | Chủ shop SDVICO (`0902000001`) | Mở `/ban-hang` | Ba ô số việc-cần-làm: **Chờ xác nhận · Đang giao · Báo đã CK**, mỗi ô có con số và dẫn tới đúng tab (`/ban-hang/don?tab=…`); dưới là ba mục **Sản phẩm · Đơn hàng · Cài đặt shop** | P1 |
| TC-E-30 | AC-46, AC-48 | Chủ shop, món đang bán | `/ban-hang/san-pham` → gõ tên vào ô "Tìm món trong shop" → **Sửa** → đổi ô "Số lượng còn trong kho" → **Lưu thay đổi** | Về danh sách kèm **"Đã lưu {tên món}"**; dòng món hiện **"Tồn {số mới} {đơn vị}"**; đọc lại `/api/ban-hang/san-pham` thấy đúng số mới (màn đổi vì DỮ LIỆU đổi, không phải đổi suông) | P0 |
| TC-E-31 | AC-30, AC-38 | Đơn `cho_xac_nhan` của shop | Mở `/ban-hang/don` (tab mặc định Chờ xác nhận) → mở đơn → **Xác nhận đơn** → hộp `alertdialog` **"Xác nhận đơn này?"** → **Đồng ý** | Chip trạng thái đổi thành **"Đã xác nhận"**; nút chính thành **"Giao hàng"**; nút "Xác nhận đơn" biến mất (một câu hỏi lại, không phải hai) | P0 |
| TC-E-32 | AC-53 (F-26) | Đơn bất kỳ của shop | Mở đơn, chưa gõ gì; rồi gõ vào ô "Ghi chú cho người mua"; rồi lưu | Chưa đổi ⇒ **KHÔNG có nút "Lưu ghi chú"** nằm chờ; vừa gõ ⇒ nút hiện; lưu xong ⇒ **"Đã lưu ghi chú."** và nút rút đi | P1 |
| TC-E-33 | AC-44 (F-11) | Persona **chưa có shop** (seed: Cô Năm `0901000003`) | `/ban-hang` → **Đăng ký gian hàng** → điền tên · SĐT (điền sẵn) · **Tỉnh bằng `<select>`** · địa chỉ → **Gửi đăng ký** | Về `/ban-hang` với băng **"Shop {tên} đang chờ SDVICO duyệt (1–2 ngày). Bà con vẫn thêm sản phẩm trước được…"** + nút **"Thêm món"** vẫn dùng được | P0 |
| TC-E-34 | F-08/F-09 | — | Mở mọi màn con của chợ (`/cho/**`) và của kênh bán (`/ban-hang/**`) | Đầu màn luôn có nút `aria-label="Quay lại"` — dock chỉ về 5 trục, không phải "trang trước"; back của trình duyệt thì bà con không tìm | P1 |
| TC-E-35 | AC-54 | Admin, mục **Đơn** ở `/quan-tri` | Mở mục Đơn | Bộ lọc trạng thái mặc định là **"Tất cả"** (không phải một trạng thái lẻ) — admin vào là thấy toàn cảnh | P2 |

---

## 3. TC-U — Dữ liệu trong máy (localStorage, ngăn theo SĐT)

| Mã | AC | Tiền điều kiện | Bước | Kết quả mong đợi | Mức |
|---|---|---|---|---|---|
| TC-U-01 | AC-09 | — | Thêm cùng món cùng loại 2 lần; thêm khác loại; đặt số lượng 0 và 1000 | Cộng dồn 1 dòng; khác `variantLabel` là dòng khác; số lượng kẹp về 1..999 | P1 |
| TC-U-02 | AC-10 | Giỏ đã 50 dòng | Thêm dòng thứ 51 | Bị từ chối (`gio_day`), giỏ không đổi, câu **"Giỏ đầy rồi — tối đa 50 món. Bớt món hay đặt bớt trước giúp."** | P1 |
| TC-U-03 | AC-11 | Máy dùng chung | SĐT A lưu giỏ → đọc giỏ bằng SĐT B → ngược lại | Mỗi ngăn một giỏ; ngăn của người khác ⇒ giỏ rỗng | P0 |
| TC-U-04 | AC-12 | Giả lập máy hết chỗ (chặn `setItem`) | Thêm món vào giỏ | Băng đỏ **"Máy hết chỗ — CHƯA lưu được giỏ"**, badge giỏ **KHÔNG** tăng | P0 |
| TC-U-05 | AC-17 | `npm test` | `market-pricing.test.ts` | `total = tiền hàng + phí giao`; miễn phí khi `freeShipFromVnd != null && subtotal ≥ ngưỡng`; `null` ⇒ luôn tính phí | P1 |
| TC-U-06 | AC-20 | `npm test` | `market-order-ref.test.ts` | Đổi số lượng / biến thể / địa chỉ / cách trả / ghi chú / shop ⇒ mã khác; **đổi thứ tự món ⇒ mã giống** | P0 |
| TC-U-07 | AC-29 | `npm test` | `market-validate.test.ts` | `isPort=true` thiếu chi tiết ⇒ **"Ghi tên cảng / bến nhận hàng."**; `isPort=false` chi tiết 4 chữ ⇒ **"Ghi địa chỉ đủ để người giao tìm được."** | P1 |
| TC-U-08 | AC-30 | `npm test` | `market-order-state.test.ts` | Buyer KHÔNG chuyển `da_xac_nhan→da_huy`; seller KHÔNG chuyển `dang_giao→da_huy`; admin CÓ; không ai ra khỏi `hoan_thanh`/`da_huy` | P0 |
| TC-U-09 | AC-38b | `npm test` | `settleOverdue` | 6 ngày 23 giờ ⇒ `null`; 7 ngày ⇒ `hoan_thanh`, `by="system"`, `completedAt = deliveredAt + 7 ngày`, COD ⇒ `da_thanh_toan` | P0 |
| TC-U-10 | AC-62 | `npm test` | `offline-backup.test.ts` | `NEVER_BACKUP_PREFIXES` có đủ 5 khoá `forfish.mcart.` · `maddr.` · `mfav.` · `morders.` · `mshop.` | P0 |

---

## 4. TC-X — An toàn, quyền, môi trường

| Mã | AC | Tiền điều kiện | Bước | Kết quả mong đợi | Mức |
|---|---|---|---|---|---|
| TC-X-01 | AC-28 | Đăng nhập Anh Ba | `POST /api/cho/don` với body nhét thêm `buyerPhone: "0999999999"` | Đơn tạo ra có `buyerPhone` = SĐT **đã đăng nhập**; `address.phone` giữ nguyên là SĐT người nhận | P0 |
| TC-X-02 | AC-39 | 2 persona | Chị Tư gọi `GET /api/cho/don?buyerPhone=<của Anh Ba>` | Chỉ trả đơn của **Chị Tư** — SĐT lọc không bao giờ lấy từ query/body | P0 |
| TC-X-03 | AC-50 | Chủ shop A | Đọc `/api/ban-hang/don/[id đơn của shop B]`; người mua (chưa có shop) gọi `/api/ban-hang/don` | 404; người chưa có shop ⇒ 404 `no_shop` | P0 |
| TC-X-04 | AC-54 | — | Gọi `/api/admin/cho/*` bằng: không chuỗi · chuỗi lạ · chuỗi người mua · chuỗi người bán | 401 · 401 · 403 · 403 (staff manager cũng 403) | P0 |
| TC-X-05 | AC-64 | `npm test` | `market-dev-mode.test.ts` | `{MARKET_STORE:"file"}` + `VERCEL` ⇒ false; + `NODE_ENV=production` ⇒ false; thiếu `MARKET_STORE` ⇒ false; env prod thì `identityFromRequest` **không hề** gọi `getMarketStore` | P0 |
| TC-X-06 | AC-65 | Kho file | `GET /api/dev/uploads/..%2F..%2Fpackage.json` · `/a..b.jpg` · `/tep.txt` · tên hợp lệ | Ba ca đầu 404; tên hợp lệ 200 kèm đúng `Content-Type` | P0 |
| TC-X-07 | AC-66 | Chạy **không** có `MARKET_STORE=file` (vd `npm run dev`) | `POST /api/dev/login`; mở `/dev` | 404; trang hiện **"Chỉ dùng khi chạy `MARKET_STORE=file npm run dev`"** | P0 |
| TC-X-08 | R16 | — | Đọc mã nguồn route/adapter | Không có nhánh `if (shop === SDVICO)` — SDVICO là một shop như mọi shop | P2 |

---

## 5. Ma trận truy vết AC → TC (77/77 AC đều có ít nhất 1 TC)

| AC | TC | AC | TC | AC | TC |
|---|---|---|---|---|---|
| AC-01 | TC-E-01, E-07, E-08 | AC-27 | TC-E-14 | AC-49 | TC-A-38 |
| AC-02 | TC-A-01, E-03 | AC-28 | TC-X-01 | AC-50 | TC-X-03 |
| AC-03 | TC-A-02 | AC-29 | TC-U-07, E-28 | AC-51 | TC-A-39 |
| AC-04 | TC-A-03 | AC-29b | TC-A-18 | AC-52 | TC-A-40, E-29 |
| AC-05 | TC-A-04 | AC-30 | TC-U-08, E-31 | AC-53 | TC-A-41, E-32 |
| AC-06 | TC-E-04 | AC-31 | TC-A-19 | AC-53b | TC-A-14 |
| AC-07 | TC-E-05 | AC-32 | TC-A-20 | AC-53c | TC-E-17 |
| AC-08 | TC-A-05, E-02 | AC-33 | TC-A-21 | AC-54 | TC-X-04, E-35 |
| AC-08b | TC-A-06, E-06 | AC-34 | TC-A-22 | AC-55 | TC-A-13 |
| AC-09 | TC-U-01, E-26 | AC-35 | TC-A-23 | AC-56 | TC-A-42 |
| AC-10 | TC-U-02 | AC-36 | TC-A-24 | AC-56b | TC-A-43 |
| AC-11 | TC-U-03 | AC-37 | TC-A-25 | AC-56c | TC-A-44 |
| AC-12 | TC-U-04 | AC-38 | TC-A-26, E-25, E-31 | AC-57 | TC-A-45 |
| AC-13 | TC-A-07 | AC-38b | TC-U-09 | AC-58 | TC-A-46 |
| AC-14 | TC-E-09 | AC-38c | TC-A-27 | AC-59 | TC-E-18 |
| AC-15 | TC-E-10 | AC-39 | TC-A-28, X-02 | AC-60 | TC-E-19 |
| AC-15b | TC-E-11 | AC-40 | TC-E-15 | AC-61 | TC-E-20 |
| AC-16 | TC-A-08, E-12, E-27 | AC-41 | TC-E-16 | AC-62 | TC-U-10 |
| AC-17 | TC-A-07, U-05 | AC-42 | TC-A-29 | AC-63 | TC-E-21 |
| AC-18 | TC-A-09 | AC-43 | TC-A-30, A-31 | AC-64 | TC-X-05 |
| AC-19 | TC-A-10 | AC-44 | TC-A-32, E-33 | AC-65 | TC-X-06 |
| AC-20 | TC-U-06 | AC-44b | TC-A-33 | AC-66 | TC-X-07 |
| AC-21 | TC-A-11 | AC-45 | TC-A-34 | AC-67 | TC-A-03, A-35 |
| AC-22 | TC-A-12 | AC-46 | TC-A-35, E-30 | — | — |
| AC-23 | TC-A-13, A-14 | AC-47 | TC-A-36 | — | — |
| AC-24 | TC-A-15, E-24 | AC-48 | TC-A-37, E-30 | — | — |
| AC-25 | TC-A-16 | — | — | — | — |
| AC-26 | TC-A-17, E-13 | — | — | — | — |

**Không có AC nào bỏ trống — vẫn đủ 77/77.** Mười TC mới của vòng fix UX (TC-E-26…E-35) không đẻ AC mới: chúng đo MÀN của những AC đã có, chỗ mà bản cũ mới chỉ đo route.

**Không có AC nào bỏ trống.** (11 §11 tự ghi "78 AC" ở dòng History nhưng đếm thật trong tài liệu là **77 mã** — chênh 1 ở phần đánh số, không phải thiếu ca; BA nên sửa con số cho khỏi lệch.)

---

## 6. Ca nào **chưa** chạy tự động được (và vì sao)

| TC | Vì sao chưa tự động | Cách kiểm hiện nay |
|---|---|---|
| TC-E-22 (ảnh trên PWA) | Cần bản cài trên máy thật (service worker + ảnh khác tên miền); Chromium đội lốt iPhone **không** phải bằng chứng cho WebKit | Test tay trên iPhone + Android đã cài |
| TC-E-15 tải lại khi mất sóng | `next dev` không có service worker ⇒ tải lại lúc offline là `ERR_INTERNET_DISCONNECTED`, không phải lỗi sản phẩm | Bộ tự động kiểm phần **giữ bản lưu + không xoá trắng**; phần tải-lại-offline test trên bản build đã cài |
| TC-E-23 (a11y) | Phần **đo được** đã tự động: `tapViolations` (helpers) quét mọi `button`/`a`/ô đánh dấu ở 4 màn mua + 4 màn bán, kèm đúng ba ngoại lệ. Phần "đọc ngoài nắng" và vòng focus thì phải người nhìn | Tự động: `ui.cho.spec.ts` + `ui.ban-hang.spec.ts` mục "sàn chạm 56px". Tương phản/focus: đo tay |
| TC-A-46 (AC-58) | Cần mock `notifyAccount` ném lỗi ⇒ thuộc unit test của Core, không phải e2e | `npm test` (Core) |
| TC-X-07 (AC-66) | Phải chạy server **không** ở kho file — khác môi trường của cả bộ | Chạy tay `npm run dev` rồi gọi `POST /api/dev/login` |
| TC-U-05…U-10 | Là logic thuần ⇒ đúng chỗ của Vitest, không nên e2e | `npm test` |

---

## 7. Bộ tự động — bản đồ tệp

| Tệp | Ca | Ghi chú |
|---|---|---|
| `playwright.san.config.ts` | 2 project: `api` (không cần trình duyệt) · `mobile` (chromium khổ iPhone, **không quay video**) | `webServer` = `node scripts/dev-market.mjs -p 3031`, `cwd` = `SAN_APP_DIR` |
| `tests/e2e/san/global-setup.ts` | Xoá `.local/market-dev.json` + `market-uploads` trước mỗi lượt | Kho file **chưa** có biến môi trường trỏ đường dẫn (xem §8) |
| `tests/e2e/san/helpers.ts` | Đăng nhập persona, gọi route, tìm món seed, ảnh giả cho upload | Dùng `marketOrderClientRef` **thật** của `src/lib/market/order-ref.ts` |
| `api.mua.spec.ts` | Vòng lõi mua: danh sách, tìm, giỏ, đặt 2 shop, chống trùng, huỷ, hoàn kho | |
| `api.dat-hang-loi.spec.ts` | 8 ca lỗi: giá đổi, một phần hỏng, ca đua hết hàng, bấm đúp, mất mạng lúc gửi, shop tạm nghỉ, shop bị khoá, huỷ CK ⇒ needsRefund, ép COD, trần 20 món/5 shop | |
| `api.ban-hang.spec.ts` | Đăng ký shop → duyệt → CRUD món → upload ảnh → chuyển trạng thái → đánh giá → thống kê → shop bị khoá | Chạy `serial` (ca sau dựa ca trước) |
| `api.admin.spec.ts` | Quyền, KPI, duyệt/từ chối/khoá, gán chủ, xử lý đơn thay shop, gỡ món, ẩn đánh giá, thông báo | |
| `api.an-toan.spec.ts` | 401/403/404, SĐT không lấy từ query, đường dẫn ảnh không ra khỏi thư mục | |
| `api.settle.spec.ts` | Tự hoàn thành sau 7 ngày khi ĐỌC | |
| `ui.cho.spec.ts` | Màn người mua: `/cho`, `/cho/tim`, giỏ trống, chip nhóm hàng, `/dev` đăng nhập, lời mời đăng nhập ở giỏ, nút Gọi shop khi mất sóng + **sàn chạm 56px** 4 màn mua | Ca cần service worker để `test.fixme`, **không xoá** |
| `ui.don.spec.ts` | `/cho/don` + bản lưu trong máy + ba nhánh mất sóng | |
| `ui.gio-chon.spec.ts` | **Ô chọn trong giỏ (F-05)**: giỏ 2 shop → bỏ chọn 1 shop → "Đặt hàng (1)" → 1 đơn, dòng bỏ chọn còn nguyên. Kèm ca khách lạ: sheet mời đăng nhập phải **`toBeInViewport`** | Đi qua màn Đặt hàng thật (điền địa chỉ, tỉnh bằng `selectOption`) |
| `ui.ban-hang.spec.ts` | **Màn người bán**: 3 ô số Tổng quan · sửa tồn kho → danh sách đổi · xác nhận đơn qua `ConfirmDialog` → chip đổi · nút "Lưu ghi chú" chỉ hiện khi ô đổi · Quay lại ở mọi `/ban-hang/**` · đăng ký gian hàng → màn chờ duyệt · **sàn chạm 56px** 4 màn bán | Có **1 ca ĐỎ CÓ CHỦ ĐÍCH**: SĐT liên hệ không điền sẵn (xem §9) |
| `helpers.ts` (bổ sung) | `tapViolations` / `tapViolationsOfPages` (một luật sàn chạm cho cả ba bộ ca màn) · `addToCartViaUi` (dựng giỏ qua MÀN, không nhét localStorage) | Ba ngoại lệ sàn chạm ghi ngay tại chỗ đo, không rải trong từng ca |

---

## 8. Việc cần đội khác làm (QA không tự sửa)

| Việc | Cho ai | Vì sao |
|---|---|---|
| ~~Thêm biến `MARKET_STORE_FILE` cho `devLocalDir()`~~ — **XONG** | Core | `file-store.ts` đã đọc `MARKET_STORE_FILE`; bộ test dùng kho riêng `.local/e2e/market-dev.json`, không đụng kho dev gõ tay |
| Sửa con số "78 AC" ở History của 11 (đếm thật 77) | **BA** | Người sau đếm lại sẽ tưởng mất 1 ca |
| Ca `TC-E-22` (ảnh trên PWA) cần bản build cài được | **Lead** | Chỉ chạy được sau khi có bản deploy/preview |

---

## 9. Ca ĐỎ đang giữ — lỗi thật, không được nới ca

> **Cập nhật 2026-09-06 (lead)**: ca đỏ dưới đây ĐÃ SỬA ở `shop-register.tsx` (effect chép SĐT tài khoản vào ô khi ô còn trống, vì `useAuthUser().phone` về sau lần render đầu). Bảng giữ lại làm hồ sơ lỗi; ca test giữ nguyên làm cổng hồi quy.

> Quy ước: bộ tự động **không bao giờ** được xanh bằng cách sửa kỳ vọng. Ca dưới đây đang đỏ vì sản phẩm sai; nới nó là mất trí nhớ của bộ test.

| Ca đỏ | Lỗi | Bằng chứng | Hậu quả cho bà con | Sửa ở đâu |
|---|---|---|---|---|
| `ui.ban-hang.spec.ts` › "SĐT liên hệ ở form đăng ký phải ĐIỀN SẴN theo tài khoản" | Ô **"Số điện thoại bà con gọi shop"** ở `/ban-hang/dang-ky` **luôn trống**, trái 11 §6.1 (*"tên shop · SĐT liên hệ (điền sẵn) · tỉnh · địa chỉ…"*) | Playwright đo lại **24 lượt trong 10 s**, `<input value="">` không đổi ⇒ **không phải chạy đua thời gian**. Gốc: `shop-register.tsx` dựng form bằng `useState(() => emptyShopForm(phone))` — hàm khởi tạo LƯỜI chỉ chạy ở lần vẽ đầu, mà `useAuthUser().phone` (`use-auth.ts:70,201`) đọc sổ danh tính **trong effect** nên lần vẽ đầu luôn `null`. Effect chạy xong thì `form` đã chốt, không ai chép lại ⇒ `emptyShopForm(phone)` là **mã chết**, không phụ thuộc đường đăng nhập (`/login` hay `/dev`) | `validateShopDraft` **cho phép `phone` rỗng** ⇒ bà con để trống là shop lên sàn **không có số gọi**. Trang món khi đó bỏ nút **"Gọi shop"**, chỉ còn "Xem shop" (`product-detail.tsx`) — cắt đúng đường liên lạc mà bán hàng ngoài bến sống bằng | **Core/màn người bán**: chép SĐT xuống form khi `useAuthUser` báo `ready` mà ô còn rỗng (đừng đè lên số bà con đã tự gõ). Cân nhắc thêm: có nên bắt buộc `phone` ở `validateShopDraft` không — **hỏi BA**, không tự chốt |

---

## History
- 2026-09-06: khởi tạo — 46 TC-A + 25 TC-E + 10 TC-U + 8 TC-X = **89 TC**, phủ đủ 77 AC của 11 §11; kèm bộ tự động `tests/e2e/san/**`: **56 ca API** (xanh hết trên bản working tree 2026-09-06) + **15 ca màn hình** (7 chạy thật, 8 `test.fixme` chờ UI/PWA).
- 2026-09-06 (vòng 2, sau fix UX): cập nhật TC-E theo màn mới — nút **"Đặt hàng (n)"**, lời mời đăng nhập là **bottom sheet** phải thấy trong tầm mắt, chip Chuyển khoản **mờ chứ không ẩn**, ba ngoại lệ của sàn chạm. Thêm **10 TC-E mới** (E-26…E-35: ô chọn trong giỏ, sheet địa chỉ hai bước, và toàn bộ màn Kênh người bán) ⇒ **99 TC**, ma trận vẫn **77/77 AC**. Bộ tự động thêm `ui.gio-chon.spec.ts` + `ui.ban-hang.spec.ts`, phép đo sàn chạm dọn về `helpers.tapViolations` dùng chung. Kết quả lượt chạy đầy đủ: **78 xanh · 2 `fixme` (cần PWA/service worker) · 1 ĐỎ CÓ CHỦ ĐÍCH** (§9 — SĐT liên hệ không điền sẵn).
