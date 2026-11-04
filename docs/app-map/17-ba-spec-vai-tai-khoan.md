# 17 — BA-SPEC VAI TÀI KHOẢN + VIỆC LÀM

> **Load khi**: đụng vai người dùng (ngư dân · chủ tàu · thu mua · đại lý), dock/trang chủ theo vai, màn chọn vai sau đăng ký, đổi vai, tính năng Việc làm (tin tuyển + hồ sơ tìm tàu), lọc khách theo vai ở `/quan-tri`. **Nguồn đúng duy nhất** cho agent build phần này.


covers: src/lib/vai.ts, src/lib/vai-store.ts, src/lib/dock-nav.ts, src/lib/viec.ts, src/lib/vua-profile.ts, src/app/chon-vai, src/app/viec, src/app/api/viec, src/app/api/me/vai
last_verified: 2026-11-03
ttl_days: 90
<!-- re-verified: 2026-11-04 — `lib/dock-nav.ts` đổi vì CHẾ ĐỘ HẢI ĐỒ (cd261049, d08eabea), KHÔNG đổi luật vai: (1) khu ô "Bản đồ" thêm `/hai-do` (màn hải đồ thuần sáng đúng ô Bản đồ); (2) `boHaiDoKhiBam` — đang ở `/hai-do` bấm ô Bản đồ ⇒ tắt `moHaiDo`, về bản đồ thường. Ai có ô Bản đồ vẫn theo §4.1/§11 (`dockTheoVai`); `/hai-do` bọc `BanDoTheoVai` như `/ngu-truong` ⇒ vai không có ô Bản đồ cũng không vào được hải đồ. §11 không đổi. -->
<!-- re-verified: 2026-11-03 — BẢN NHÁP chờ anh Long duyệt. Chốt của anh 03/11: (1) MỖI SĐT MỘT VAI, (2) vai tự chọn, chỉ gác ở chỗ quan trọng, (3) việc làm HAI CHIỀU, liên hệ thẳng (Gọi/Zalo, không nhắn trong app), (4) spec + mockup trước, duyệt rồi mới build. ĐÃ BUILD 03/11 (anh Long: "Theo đề xuất, build" — 7 câu mở lấy đúng đề xuất), migration 0079 ĐÃ APPLY prod 2026-11-03 (510 tài khoản suy ra Chủ tàu, 470 chưa chọn). Bổ sung cùng ngày: §11 ô dock × vai × hạng, §12 bảng đủ màn từng vai (16 màn mới, 15 màn sửa). Chốt thêm: chủ tàu giữ nguyên; đi bạn/thu mua/đại lý chỉ premium mới có ô Bản đồ (§4.1, §11, §11.1); KHÔNG làm màn bão riêng — đi bạn/thu mua/đại lý free bấm tin bão về băng bão chữ ở trang chủ; chủ tàu KHÔNG phải khai tàu, tạm chấp nhận kẽ hở đổi vai (§11.2). -->

Yêu cầu gốc (anh Long, 03/11): *"tổ chức hệ thống account đi, rồi xây UI/UX cho từng loại account, user ko có tàu (ngư dân) vô kiếm việc, tham khảo các thông tin, tham gia sen biển, user đại lý thiết bị, bán thiết bị, user thu mua cá, user chủ tàu, xem luôn cách phân nhóm user như thế nào tổ chức sao"*.

## 1. Vấn đề

Hôm nay app chưa biết người đang dùng là ai, nên ai cũng thấy chung một dock (Trang chủ · Kairos · Bản đồ · **Tàu tôi** · Chợ cá · Vật tư) và một trang chủ dựng cho chủ tàu (giấy tờ sắp hết hạn, bảo dưỡng).
- Bạn thuyền chưa có tàu mở "Tàu tôi" thì thấy một sổ trống. Thứ họ cần là **việc làm**, mà app chưa có.
- Vựa thu mua cần **tin bán cá mới**, nhưng tin đó nằm ở tầng thứ hai của Chợ cá.
- Đại lý cần **đơn chờ xác nhận**, nhưng đơn đó nằm ở Vật tư › kênh người bán, sau ba lần chạm.

Thông tin về "vai" đang nằm rải rác ở 4 chỗ không nối với nhau:

| Dấu hiệu | Ở đâu | Nói được gì |
|---|---|---|
| có gian hàng | `shops.owner_phone`, `status` | người bán vật tư (đã duyệt hay chưa) |
| có tàu trong sổ | kho máy + đồng bộ sổ | chủ tàu |
| nghề trên hồ sơ Kairos | `kairos_profiles.nghe` (có `thu-mua`) | tự khai, chỉ để hiện ở Kairos |
| người đăng tin chợ cá | `market_listings.poster_kind` (ngu-dan/nau/vua/nha-may/cho) | tự khai theo từng tin |

## 2. Mô hình tài khoản: năm thứ tách bạch

Không gộp các khái niệm khác nhau vào một cột. Mỗi trục trả lời một câu hỏi riêng và đổi theo luật riêng:

| Trục | Câu hỏi | Cột | Ai đổi | Tác dụng |
|---|---|---|---|---|
| Định danh | là ai | `customers.phone` (SĐT, email ảo) | đăng ký | khoá mọi thứ khác |
| Kiểu | thật hay thử | `account_kind` real/test/demo/reviewer (0056) | admin, `scripts/test-account.mjs` | hạn chuỗi, loại khỏi thông báo hàng loạt |
| Quyền | làm được gì trong quản trị | `role` + `staff_accounts` (0019/0056) | admin | mở `/quan-tri` theo tab |
| Hạng | đã trả gì | `tier` + `premium_until` (0006) | SDWork webhook, `/quan-tri` | mở dự báo cá, lớp gói, dẫn đường (`tier.ts`) |
| **Vai (MỚI)** | **làm nghề gì trong chuỗi** | `customers.vai` | **chính người dùng** | **dock, trang chủ, thứ tự màn** |

Luật:
- Hai trục **Vai** và **Hạng** độc lập với nhau. Ngư dân, vựa hay đại lý đều có thể mua premium. Vai không mở khoá lớp bản đồ nào.
- Vai chỉ **đổi giao diện**, không khoá dữ liệu. Mọi màn vẫn mở được bằng link, thông báo đẩy, Sen Biển hay ô tìm. Vai quyết định thứ gì nằm **ngay tay**, chứ không quyết định thứ gì **được phép**.
- Chỗ cần gác thật (§5) gác ở máy chủ theo **bằng chứng** (gian hàng đã duyệt, dấu xác minh), không chỉ theo vai tự chọn.
- **Offline chỉ bắt buộc với vai Chủ tàu** (anh Long 03/11: *"vai chủ tàu mới cần offline, các vai khác thì đều đang online mà"*). Chủ tàu (và khách / chưa chọn vai — dùng chung giao diện chủ tàu) giữ đủ luật offline của CLAUDE.md. Màn chỉ của Đi bạn / Thu mua / Đại lý (Việc làm, Giấy tờ của tôi, hồ sơ vựa, báo giá, trang chủ 3 vai) chỉ cần trạng thái **mất sóng = câu + Thử lại** (ma trận trạng thái vẫn bắt buộc), KHÔNG bản lưu offline, KHÔNG vào `SHELL` của `sw.js`, KHÔNG cất SĐT người khác trong máy. Riêng dock + vai vẫn đọc kho máy (vẽ đúng ngay lúc mở app).

### 2.1 Bốn vai

| Mã `vai` | Tên hiện cho bà con | Là ai | Việc chính |
|---|---|---|---|
| `ngu-dan` | Đi bạn | bạn thuyền, thuyền viên **chưa có tàu riêng** | kiếm tàu đi, xem giá cá, tin chính sách, Kairos, Sen Biển |
| `chu-tau` | Chủ tàu | có tàu, lo giấy tờ, bạn thuyền, chuyến biển | như app hôm nay + tuyển người |
| `thu-mua` | Thu mua | vựa, nậu, nhà máy, người thu mua ở chợ cá | tìm cá đang bán, đăng giá thu mua, giữ mối |
| `dai-ly` | Đại lý | đại lý thiết bị / vật tư (gồm SDVICO và đối tác) | nhận đơn, báo giá món chợ chưa có, quản lý hàng |

`null` = chưa chọn. Khách chưa đăng nhập không có vai.

**Một SĐT một vai, chọn MỘT LẦN, không đổi** (anh Long 03/11: *"ko cho đổi sau khi đã đk tránh dữ liệu bị rối, ngư dân + tàu = chủ tàu, cửa hàng và thu mua độc lập, ko đổi vai đc"*). Đường đi tiếp duy nhất: **Đi bạn có tàu trong sổ ⇒ tự thành Chủ tàu**. Đại lý và Thu mua đứng riêng, không đổi sang vai nào (kể cả khi có tàu). Chọn nhầm ⇒ nhân viên sửa ở `/quan-tri`, app không có nút đổi. Luật: `lib/vai.ts lyDoKhongDoiVai`, `nenLenChuTau`.

### 2.2 Nhóm khách cho SDVICO (phân nhóm, không lưu cứng)

Ngoài năm trục lưu ở trên, **nhóm** là phép lọc tính khi cần (CDP nội bộ, giống Đo Kairos — [14 §22](14-ba-spec-kairos.md)), không thêm cột:

`vai` × `hạng` × tỉnh/cảng nhà (`kairos_profiles.home_port`, `que_tinh`) × nghề (`kairos_profiles.nghe`) × hoạt động (`customers` app_usage 0031) × đã mua thiết bị (`devices`, SDWork).

Ví dụ nhóm dùng thật: "chủ tàu Quảng Ngãi chưa premium, mở app 7 ngày qua" (gọi bán gói), "đi bạn cảng Sa Huỳnh đang tìm tàu" (báo khi có tin tuyển mới), "đại lý chờ duyệt quá 2 ngày" (nhân viên gọi).

## 3. Luồng chọn vai

### 3.1 Lần đầu: màn "Bà con làm nghề gì?"

- **Khi nào hiện**: ngay sau đăng ký xong, hoặc lần đầu mở app sau bản này với tài khoản có `vai = null`, **trừ** khi suy được vai (§3.2).
- **Bố cục**: tiêu đề một dòng + 4 thẻ dọc, mỗi thẻ gồm icon, tên vai và một dòng phụ ngắn:
  - Đi bạn: "Tìm tàu đi, xem giá, tin tức"
  - Chủ tàu: "Giấy tờ, bạn thuyền, chuyến biển"
  - Thu mua: "Tìm cá bán, đăng giá mua"
  - Đại lý: "Bán thiết bị, vật tư"
- Chạm một thẻ là xong, không có nút "Tiếp". Chọn **Đại lý** mà chưa có gian hàng thì sang luôn `/ban-hang/dang-ky`.
- Có lối "Để sau" (chữ nhỏ dưới cùng). Để sau thì giữ **dock hôm nay** (dock chủ tàu), trang chủ có thẻ một hàng "Bà con làm nghề gì?" cho tới khi chọn.
- Mất sóng: ghi vai vào máy (`forfish.vai.v1`) và đổi giao diện ngay, có sóng thì gửi lên. Không bao giờ chặn người dùng chờ mạng.

### 3.2 Suy vai cho tài khoản cũ (không hỏi lại)

Chạy một lần ở máy chủ khi migration vào, và mỗi lần đọc `vai` đang `null`. Theo thứ tự, gặp điều kiện đầu tiên thì dừng:

1. có `shops` trạng thái `hoat_dong` hoặc `cho_duyet` ⇒ `dai-ly`
2. có `devices` (đã mua thiết bị SDVICO qua SDWork) hoặc có tàu trong sổ đã đồng bộ ⇒ `chu-tau`
3. `kairos_profiles.nghe = 'thu-mua'` ⇒ `thu-mua`
4. còn lại ⇒ `null` (hỏi)

Vai suy ra là vai THẬT (đã khoá như vai tự chọn). Sheet Tài khoản hiện "Vai: Chủ tàu" (chỉ xem). Tài khoản chưa suy ra được (null) thấy hàng mời "Bà con làm nghề gì?" ở Trang chủ và Tài khoản, chọn một lần.

### 3.3 Khoá vai (thay "Đổi vai", anh Long 03/11)

- Sheet Tài khoản: vai là chip (chỉ xem), không nút Đổi. **Nhân viên** sửa vai ở `/quan-tri` › Tài khoản (ô chọn vai trên dòng khách + Lưu vai, `PATCH /api/admin/accounts/vai`, quyền tai-khoan edit, nhật ký `account.doi-vai`); máy bà con hỏi lại vai tối đa 12 giờ/lần khi mở app có sóng (`vai-store HOI_LAI_MS`) nên vai sửa sẽ về máy. Chưa có vai ⇒ hàng "Bà con làm nghề gì? · Chọn" sang `/chon-vai`. `/chon-vai` khi đã có vai ⇒ tự về chỗ cũ.
- Máy chủ (`PUT /api/me/vai`): chưa có vai ⇒ ghi (có điều kiện `vai is null`, hai máy cùng chọn thì máy sau 409); có rồi ⇒ 409 `da_co_vai`; Đi bạn ⇒ Chủ tàu chỉ khi sổ tàu ĐÃ ĐỒNG BỘ có ≥1 tàu chưa xoá, chưa có ⇒ 409 `chua_co_tau`.
- App: sổ tàu trong máy có ≥1 tàu mà vai là Đi bạn hoặc chưa chọn ⇒ tự lên Chủ tàu (ghi máy ngay, gửi lên; `chua_co_tau` ⇒ giữ cờ chờ, lần mở sau gửi lại). 409 `da_co_vai` ⇒ app nhận vai của máy chủ.
- Màn đăng tin tuyển với vai khác Chủ tàu: Đi bạn ⇒ câu + nút Thêm (sang `/tau`); Thu mua / Đại lý ⇒ chỉ câu báo.
- **Gian hàng là tài khoản Đại lý riêng**: `POST /api/ban-hang/shop` (mở mới) chỉ cho vai `dai-ly` hoặc chưa có vai — chưa có vai mở xong thành Đại lý; vai khác ⇒ 403 `vai`. Màn `/ban-hang/dang-ky` báo ngay cho vai khác (dùng SĐT khác); menu Tài khoản chỉ mời "Đăng ký shop" cho Đại lý / chưa có vai.
- **Vai hiển thị** = chip (icon vai + tên) ngay dưới số điện thoại trong menu Tài khoản — khuôn trang "Tôi" của Imou/TPLink-Installer.

## 4. Giao diện theo vai

### 4.1 Dock

Giữ tối đa 6 ô. Tên ô lấy từ `labels.ts`, mỗi tên ≤2 chữ. Sen Biển vẫn là icon nổi ở mọi vai.

**Ô Bản đồ theo vai và hạng** (anh Long chốt 03/11: *"chủ tàu thì giữ nguyên như hiện tại, còn ngư dân, thu mua, đại lý mới chia premium và free"*):
- **Chủ tàu, khách, chưa chọn vai**: giữ nguyên hôm nay. Có ô Bản đồ; trong bản đồ, phần free/premium chia như `tier.ts` hiện tại.
- **Đi bạn, Thu mua, Đại lý**: ô Bản đồ **chỉ hiện khi có premium**.

| Vai | Dock free | Dock premium |
|---|---|---|
| chưa đăng nhập | Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư | — (khách không có gói) |
| `null` (chưa chọn vai) | Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư | như free |
| `chu-tau` | Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư | như free (= hôm nay) |
| `ngu-dan` | Trang chủ · Kairos · **Việc làm** · Chợ cá · Vật tư | + Bản đồ sau Kairos |
| `thu-mua` | Trang chủ · Kairos · **Chợ cá** · Vật tư | + Bản đồ ở ô 3 |
| `dai-ly` | Trang chủ · Kairos · **Bán hàng** · Vật tư | + Bản đồ ở ô 3 |

**Bản đồ luôn là ô thứ 3** khi có, ở mọi vai (khuôn tab bar cố định của Imou/TPLink — lên Chủ tàu hay mua gói không phải học lại chỗ ô; đồng bộ design 03/11).

Hạng để quyết định dock lấy từ **dấu hạng trong máy** (`effectivePremiumMark`, có 7 ngày ân hạn — `tier.ts`), không chờ mạng. Lúc dấu hạng còn đang tra ("checking"), dock giữ đúng bản lần trước, không nhấp nháy thêm/bớt ô. Gói hết hạn giữa biển vẫn còn 7 ngày ân hạn như luật hiện có.

Ô bị bỏ khỏi dock vẫn mở được (route giữ nguyên). Badge giữ luật [dock-nav](../../src/lib/dock-nav.ts): ô Bán hàng nhận số `donChoBan`; ô Việc làm **không** có badge (tránh thêm số đỏ — thông báo việc mới đi qua hộp thư).

### 4.2 Trang chủ

Tin bão luôn đứng đầu ở **mọi vai** (tin tính mạng, giữ luật cũ). Phần dưới tin bão đổi theo vai:

| Vai | Thứ tự khối dưới tin bão |
|---|---|
| `chu-tau` | **giữ nguyên như cũ** (anh Long 03/11): Biển hôm nay · Việc cần làm (giấy tờ, bảo dưỡng) · Ưu đãi · Thông báo · Con nước. **Thêm**: nếu có tin tuyển đang mở ⇒ một hàng "Tin tuyển · còn N ngày · Xem" |
| `ngu-dan` | *"Hôm nay có tàu nào cần người như mình không?"* — Biển hôm nay + Việc cần làm (giấy tờ của tôi sắp hết hạn) · **Tàu cần người hợp với bà con**: ≤3 tin xếp theo khớp hồ sơ tìm tàu (nghề 3 · vị trí 2 · cảng muốn đi 2 — `home-vai.viecHop`), nhãn "Hợp nghề"; tìm ở tỉnh cảng đầu tiên của hồ sơ, chưa có thì tỉnh cảng nhà · chưa có hồ sơ ⇒ một hàng "Lập hồ sơ tìm tàu"; hồ sơ đang tắt ⇒ "Hồ sơ tìm tàu đang tắt" · Xem hết tin tuyển · Thông báo · Con nước |
| `thu-mua` | *"Hôm nay ai bán đúng loài mình mua, giá ra sao?"* — chưa có hồ sơ vựa ⇒ "Lập hồ sơ vựa" (ghi loài mua); hồ sơ chờ duyệt / bị từ chối / khoá ⇒ một hàng trạng thái · **Đang bán đúng loài bà con mua**: ≤5 tin bán, loài khớp hồ sơ vựa lên trước (so không dấu — `khopLoai`), rồi cùng tỉnh, rồi mới; nhãn "Đúng loài" · **Giá tuần này** (VASEP): ≤4 loài, loài mình mua trước, khoảng giá + mũi tên lên/xuống · Tin mua của tôi · Thông báo |
| `dai-ly` | *"Có việc gì phải xử lý ngay?"* — chưa có gian hàng ⇒ "Mở gian hàng"; chưa hoạt động ⇒ một hàng trạng thái · **Việc cần làm**: CHỈ việc có số (`viecDaiLy`): N đơn chờ xác nhận · N khách báo đã chuyển khoản · N khách cần món chợ chưa có · N món sắp hết; không có ⇒ "Không có việc cần làm" · 7 ngày qua: số đơn + tiền đã giao xong (`/api/ban-hang/thong-ke`) · Thông báo |

Thẻ Biển hôm nay và Con nước bỏ ở vai thu mua và đại lý (người trên bờ). Tin bão vẫn giữ, vì bão quyết định tàu có về và có hàng bán hay không.

### 4.3 Sen Biển theo vai

Sen Biển nổi ở mọi vai. Vai được gửi kèm ngữ cảnh để gợi ý câu đầu hợp vai:
- Đi bạn: "Có tàu nào ở Sa Huỳnh tuyển không?"
- Thu mua: "Hôm nay ai bán cá ngừ?"
- Đại lý: "Có đơn mới không?"

Ý hỏi mới cho kho hỏi–đáp đi theo vòng train hiện có ([sen-bien-vong-train]), **không** nằm trong đợt build này.

## 5. Gác quyền: chỗ nào cần bằng chứng

| Hành động | Điều kiện máy chủ | Vì sao |
|---|---|---|
| Đăng bán vật tư | gian hàng `hoat_dong` (đã có, 0060) | giữ nguyên |
| Dấu "Đã xác minh" bên cạnh tin mua của vựa | `customers.vai_xac_minh_at` not null, chỉ nhân viên gán ở `/quan-tri` | bà con biết vựa thật |
| Đăng tin tuyển | `vai = 'chu-tau'` | tin tuyển phải của người có tàu; sai vai ⇒ 403 `vai`; Đi bạn được mời thêm tàu (tự lên Chủ tàu), vai khác chỉ thấy câu báo |
| Xem SĐT trong hồ sơ tìm tàu | đã đăng nhập **và** `vai = 'chu-tau'` | SĐT ngư dân không hiện cho người lạ (chống quấy, chống lừa môi giới) |
| Xem SĐT trong tin tuyển | đã đăng nhập (mọi vai) | tin tuyển là tin công khai của chủ tàu |
| Đăng hồ sơ tìm tàu | đã đăng nhập (mọi vai, thường là `ngu-dan`) | một SĐT một hồ sơ |

## 6. Việc làm (MỚI)

Mục tiêu: bạn thuyền tìm được tàu, chủ tàu tìm được người, **liên hệ thẳng** bằng Gọi hoặc Zalo. Đợt này không có ứng tuyển, nhắn tin hay duyệt trong app.

**Không làm đợt này**: nhắn trong app · ứng tuyển/duyệt · tự thêm vào sổ thuyền viên · đánh giá chủ tàu/bạn thuyền · thu phí đăng tin · nối với tra cảnh báo chéo CCCD (`crew_reports`).

### 6.1 Tin tuyển (`job_posts`) — chủ tàu đăng

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| nghề | ✓ | mã `NGHE` dùng chung với Kairos (`lib/kairos/ho-so.ts`) |
| cảng xuất bến | ✓ | id `fishing-ports` |
| vị trí cần | ✓ | danh sách cố định: Thuyền viên · Thuyền trưởng · Máy trưởng · Máy phụ · Nấu ăn · Thợ lặn (dùng nhiều chọn) |
| số người | ✓ | 1–30 |
| ngày đi dự kiến | | ngày |
| chuyến dài | | số ngày, 1–120 |
| công | | chữ ≤80 ký tự do chủ tàu ghi ("chia phần", "lương chuyến"...). App **không** tự tính tiền và không so sánh công |
| giấy cần có | | Chứng chỉ thuyền trưởng · Chứng chỉ máy trưởng · Sổ thuyền viên (nhiều chọn) |
| ghi chú | | ≤300 ký tự |
| số hiệu tàu | | lấy từ sổ tàu, chủ tàu bật mới hiện (giống `show_boat` Kairos) |

- Hạn tin **14 ngày** thì tự ẩn. Chủ tàu có thể "Gia hạn" (thêm 14 ngày) hoặc "Đủ người" (đóng tin).
- Trần **5 tin đang mở** mỗi SĐT.
- Kiểm chữ dùng chung bộ lọc Kairos (`validate.contentFlag`): chữ bậy, chống phá, chủ quyền. Thêm luật **cấm thu phí**: ghi chú có "phí", "đặt cọc", "chuyển khoản trước" thì trả 400 `phi`, với câu báo "Tin tuyển không được thu tiền của người đi bạn.".
- Bấm Báo xấu ⇒ vào hàng trực `/quan-tri` (cùng khuôn báo xấu Kairos).

### 6.2 Hồ sơ tìm tàu (`job_seekers`) — một SĐT một hồ sơ

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| tên gọi | ✓ | lấy tên Kairos (`kairos_profiles.handle`), không hỏi thêm |
| nghề đã làm | ✓ | nhiều chọn `NGHE` |
| số năm đi biển | | 0–50 |
| vị trí muốn làm | ✓ | danh sách như §6.1 |
| cảng muốn đi | ✓ | 1–3 cảng |
| giấy đang có | | như §6.1 |
| sẵn sàng từ | | ngày |
| ghi chú | | ≤150 ký tự |
| đang tìm | ✓ | bật/tắt; tắt thì ẩn khỏi danh sách nhưng không xoá |

Hồ sơ không bật lại trong **30 ngày** thì tự tắt, có thông báo đẩy "Bà con còn tìm tàu không?" kèm nút "Còn tìm".

### 6.3 Màn `/viec`

- Route mới `/viec` (dock "Việc làm" của vai `ngu-dan`). Chủ tàu vào qua Tàu tôi › Bạn thuyền › **Tuyển người**.
- Hai tab: **Tìm tàu** (danh sách tin tuyển) · **Tìm người** (danh sách hồ sơ, chỉ mở cho `chu-tau`; vai khác thấy tab này chỉ khi đã đổi sang Chủ tàu, nên mặc định ẩn).
- Lọc: cảng (mặc định cảng nhà, chip "Gần tôi | Cả nước | Đổi" theo khuôn tab Chính sách Kairos) · nghề · vị trí.
- Thẻ tin tuyển: nghề · vị trí · số người · cảng · ngày đi · công (nếu có), chân thẻ có nút **Gọi** và **Zalo**. Chưa đăng nhập thì bấm Gọi mời đăng nhập.
- Nút **Đăng tin** (chủ tàu) và **Hồ sơ của tôi** (mọi vai) đặt ở đầu màn.

### 6.4 Ma trận trạng thái (bắt buộc trong code)

| Trạng thái | Hành vi |
|---|---|
| Đang tải | khung chờ 3 thẻ giữ chỗ |
| Trống | "Chưa có tàu tuyển ở <cảng>." + nút "Cả nước" |
| Lỗi | câu + Thử lại |
| Mất sóng | `OfflineLine` + Thử lại. Bản lưu `forfish.viec.v1` (≤100 tin, KHÔNG SĐT) chỉ để vẽ ngay lúc mở màn. Gọi/Zalo cần sóng (máy không cất số người khác — §2 luật offline theo vai); Đăng tin giữ nháp ở máy |
| Tin hết hạn | ẩn khỏi danh sách; chủ tàu thấy trong "Tin của tôi" với nhãn "Hết hạn · Gia hạn" |
| Bị cấm đăng | 403 dùng chung luật `banned_until` Kairos |

## 7. Dữ liệu — migration `0079_vai_viec_lam.sql` (đã apply prod 2026-11-03)

- `customers.vai text null check (vai in ('ngu-dan','chu-tau','thu-mua','dai-ly'))` · `vai_doi_luc timestamptz` · `vai_xac_minh_at timestamptz`
- `job_posts` (id, owner_phone, nghe, port_id, vi_tri text[], so_nguoi, ngay_di, so_ngay, cong, giay text[], ghi_chu, boat_reg, show_boat, status `mo`/`du`/`an`, expires_at, created_at, updated_at)
- `job_seekers` (phone unique, nghe text[], so_nam, vi_tri text[], ports text[], giay text[], san_sang, ghi_chu, dang_tim, bat_luc, updated_at)
- RLS bật, **client không chạm bảng**: mọi đọc/ghi qua route service-role (khuôn Kairos 0065). SĐT không bao giờ trả trong danh sách, chỉ trả qua `GET /api/viec/tin/[id]/lien-he` theo luật §5.
- Vai đi kèm phản hồi đăng nhập và nhịp `/api/me/heartbeat` (giống hạng — `tier.ts` `writePremiumMark`), lưu ở `forfish.vai.v1`. Lỗi mạng ⇒ giữ bản lưu, **không** xoá vai.

Migration là cờ đỏ (CLAUDE.md): anh Long duyệt "Chạy migration" 03/11, đã apply lên `znzgugvfhgmiszqgjulk` (chi tiết 04-data-model § 0079).

## 8. Quản trị (`/quan-tri`)

- Danh sách khách: thêm cột và bộ lọc **Vai**; ô đếm theo vai ở đầu trang.
- Nút "Xác minh thu mua" trên dòng khách vai `thu-mua`, có ghi nhật ký `admin-activity`.
- Tab **Việc làm**: tin bị báo xấu, ẩn/hiện, cấm đăng (dùng lại khuôn Kairos).

## 9. Ảnh hưởng offline

Luật (§2): offline chỉ bắt buộc với chủ tàu. (a) Request mới lúc mở app: chỉ GET vai một lần khi máy chưa có bản + PUT khi đổi vai (trần 8 s, nuốt lỗi); trang chủ chủ tàu KHÔNG thêm request. (b) Không đụng `sw.js`/SHELL; khoá mới `forfish.vai.v1`, `forfish.viec.*` (không SĐT). (c) Không xoá dữ liệu nào; đổi vai không đụng sổ; giấy riêng nằm chung kho, không chuyển giấy cũ. (d) Màn của chủ tàu giữ nhánh bản lưu như cũ; màn của 3 vai kia chỉ có trạng thái mất sóng = câu + Thử lại.

## 10. Acceptance criteria

### AC-01 · Đăng ký mới hỏi vai · Test: manual
- Given tài khoản vừa đăng ký xong ở `/dang-ky`
- When máy cất được chuỗi đăng nhập
- Then app chuyển sang `/chon-vai`; chạm "Đi bạn" ⇒ dock có Việc làm, không có Tàu tôi
- Assert: đường dẫn sau đăng ký == `/chon-vai`; số ô dock vai `ngu-dan` không gói == 5

### AC-02 · Đại lý cũ không bị hỏi · Test: unit
- Given hàng khách có gian hàng `hoat_dong`, không có thiết bị
- When suy vai theo §3.2
- Then vai là `dai-ly`, dock có ô Bán hàng nhận số đơn chờ
- Assert: `suyVai({coShop:true,…}) == "dai-ly"`; `dockBadge("ban-hang", {donChoBan:3}) == 3`

### AC-03 · Vai chọn lúc mất sóng không bị máy chủ đè · Test: unit
- Given vai đã đổi ở máy khi mất sóng (bản lưu có cờ chờ gửi)
- When máy chủ trả về vai cũ
- Then bản trong máy không bị đè; có sóng lại thì gửi lên
- Assert: `nenNhanVaiMayChu({cho:true,…}, "chu-tau") == false`

### AC-04 · Đi bạn không đăng được tin tuyển · Test: integration
- Given tài khoản vai `ngu-dan` đã đăng nhập
- When gửi `POST /api/viec`
- Then máy chủ từ chối
- Assert: status == 403, code == "vai"

### AC-05 · Chỉ chủ tàu lấy được SĐT người tìm tàu · Test: integration
- Given hồ sơ tìm tàu đang bật
- When vai `thu-mua` gọi `GET /api/viec/ho-so/[id]/lien-he`
- Then bị từ chối; vai `chu-tau` gọi thì nhận SĐT
- Assert: status vai thu-mua == 403; status vai chu-tau == 200

### AC-06 · Tin tuyển không được thu phí · Test: unit
- Given ghi chú tin tuyển có chữ "đặt cọc"
- When kiểm tin bằng `validateTin`
- Then tin bị từ chối với câu tiếng Việt
- Assert: code == "phi"

### AC-07 · Tin quá hạn rời danh sách · Test: unit
- Given tin đăng 15 ngày trước, chưa gia hạn
- When tính trạng thái tin
- Then tin là hết hạn, chỉ còn ở "Tin của tôi"
- Assert: `trangThaiTin(...) == "het-han"`

### AC-08 · Việc làm mất sóng · Test: manual
- Given vai `ngu-dan`, máy mất sóng
- When mở `/viec` rồi chạm Gọi
- Then có dòng Mất sóng + Thử lại; Gọi báo cần sóng; máy không cất SĐT người khác
- Assert: bản lưu `forfish.viec.v1` không chứa trường `sdt`

### AC-09 · Tin bão đứng đầu mọi vai · Test: manual
- Given lần lượt 4 vai
- When mở Trang chủ
- Then khối tin bão là khối đầu tiên dưới tiêu đề
- Assert: vị trí khối tin bão == 1 ở cả 4 vai

### AC-10 · Lọc khách theo vai ở quản trị · Test: manual
- Given danh sách khách có tài khoản `account_kind` khác `real`
- When chọn chip một vai ở tab Tài khoản
- Then số trên chip chỉ đếm khách thật
- Assert: số trên chip == count(khách real có vai đó, không phải nhân sự)

### AC-11 · Dock theo vai và gói · Test: unit
- Given vai `thu-mua` không có gói
- When dựng dock bằng `dockTheoVai`
- Then dock có 4 ô, không có Bản đồ; có gói thì Bản đồ chen vào ô thứ 3
- Assert: số ô == 4 khi không gói; == 5 khi có gói

### AC-12 · Chủ tàu giữ bản đồ như cũ · Test: unit
- Given vai `chu-tau` hoặc chưa chọn vai, không có gói
- When kiểm cổng lớp bản đồ free
- Then không bị chặn
- Assert: `chanBanDoFree("chu-tau", false) == false`; `coBanDo(null, false) == true`

### AC-14 · Vai đã khoá · Test: unit
- Given tài khoản đã có vai `thu-mua`
- When xin đổi sang `dai-ly` hoặc `chu-tau`
- Then bị từ chối; Đi bạn sang Chủ tàu chỉ được khi có tàu trong sổ
- Assert: `lyDoKhongDoiVai("thu-mua","dai-ly",false) == "da_co_vai"`; `lyDoKhongDoiVai("ngu-dan","chu-tau",false) == "chua_co_tau"`; `lyDoKhongDoiVai("ngu-dan","chu-tau",true) == null`

### AC-15 · Mọi màn của ô dock đều có dock · Test: unit
- Given dock theo vai có ô Việc làm / Bán hàng mà dock mặc định không có
- When mở `/viec`, `/viec/giay`, `/ban-hang/yeu-cau`
- Then thanh dock hiện (có đường về); màn đăng nhập / chọn vai vẫn không dock
- Assert: `dockActive("/viec", MOI_O_DOCK) != null`; `dockActive("/chon-vai", MOI_O_DOCK) == null`

### AC-13 · Ba vai cần gói bị chặn lớp bản đồ free · Test: unit
- Given vai `ngu-dan`, `thu-mua` hoặc `dai-ly`, không có gói
- When kiểm cổng lớp bản đồ free
- Then bị chặn; có gói thì mở
- Assert: `chanBanDoFree("ngu-dan", false) == true`; `chanBanDoFree("dai-ly", true) == false`

## 11. Ô dock mở gì — theo VAI và theo HẠNG

Luật (anh Long 03/11: *"icon bottom menu nó mở theo các loại acc khác nhau, các quyền free và premium khác nhau?"* ⇒ *"premium mới thấy tab bản đồ"* ⇒ *"chủ tàu thì giữ nguyên như hiện tại, còn ngư dân, thu mua, đại lý mới chia premium và free"*):

1. **Vai quyết định các ô** trên dock (§4.1).
2. **Chủ tàu (và khách, chưa chọn vai): không đổi gì so với hôm nay.** Ô Bản đồ luôn có; bên trong, free được nền + phao đèn + rạn + đẳng sâu + đi tới điểm + điểm đã lưu + thời tiết hôm nay, còn premium được thêm dự báo cá, lớp gói, dẫn đường, thời tiết nhiều ngày, tự báo trước chuyến. Tàu tôi có tra CCCD premium như cũ.
3. **Đi bạn, Thu mua, Đại lý: hạng quyết định ô Bản đồ có hiện hay không.** Có premium thì thấy ô Bản đồ với **đủ** phần premium; không có thì ô không hiện. Các ô khác của ba vai này giống nhau giữa free và premium.

| Ô dock | Khách | Chủ tàu free | Chủ tàu premium | Đi bạn / Thu mua / Đại lý free | Đi bạn / Thu mua / Đại lý premium |
|---|---|---|---|---|---|
| Trang chủ | tin bão, giá cá, mời đăng nhập | khối theo vai | như free | khối theo vai | như free |
| Kairos | đọc | đủ | đủ | đủ | đủ |
| **Bản đồ** | như hôm nay (bão, thời tiết cảng hôm nay) | **như hôm nay**: bản đồ free | **như hôm nay**: + dự báo cá, lớp gói, dẫn đường, thời tiết nhiều ngày | **không có ô** | có ô, đủ như chủ tàu premium |
| Tàu tôi | mời đăng nhập | như hôm nay + Tuyển người | + tra CCCD | — (không có ô) | — |
| Việc làm *(đi bạn)* | xem tin, Gọi ⇒ đăng nhập | — | — | Gọi/Zalo, hồ sơ, giấy tờ của tôi | như free |
| Chợ cá | giá tham khảo | đủ | đủ | đủ (thu mua, đi bạn) | như free |
| Vật tư | xem chợ | đủ | đủ | đủ | như free |
| Bán hàng *(đại lý)* | — | — | — | gian hàng, sản phẩm, đơn, báo giá | như free |

Lớp Tàu xung quanh (AIS) và Mật độ tàu vẫn mở theo từng SĐT (chỉ tài khoản 0938635689), nằm trong Bản đồ.

### 11.1 Đi bạn / Thu mua / Đại lý free mở link tới bản đồ thì sao

Hôm nay có nhiều lối dẫn thẳng vào `/ngu-truong`: thông báo bão (`storm-push`, hộp thư `inbox`), thẻ Biển hôm nay (`sea-today-card`), Sen Biển ("mở bản đồ", chỉ đường), link chia sẻ điểm (`ban-do-link`), kết quả lộ trình. Luật:

Chủ tàu và khách: **không đổi**, link vẫn mở bản đồ như hôm nay. Bảng dưới chỉ áp cho ba vai Đi bạn, Thu mua, Đại lý khi **chưa có gói**:

| Lối vào | Thấy gì |
|---|---|
| **Tin bão** (thông báo đẩy, hộp thư, băng bão trang chủ) | **Trang chủ**, cuộn tới băng tin bão: tin **chữ** (tên bão, vị trí, hướng, sức gió, giờ tin, nguồn) như băng hiện có — **không có màn bản đồ bão riêng** (anh Long 03/11: không cần màn `/bao`). Mất sóng ⇒ tin lưu cuối + tuổi tin như luật băng bão hiện có |
| Thẻ Biển hôm nay, con nước | mở `/cang` (thời tiết + con nước cảng **hôm nay**) — giữ miễn phí như hôm nay |
| Sen Biển "mở bản đồ", chỉ đường, link chia sẻ điểm, lộ trình | **Màn giới thiệu gói** (`premium-gate`): một câu nói bản đồ có gì + nút liên hệ mua gói. Không trả 404, không màn trắng |
| Gõ thẳng `/ngu-truong`, `/lo-trinh` | như dòng trên |

Máy chủ: `data-route-rules` thêm một điều kiện cho các lớp bản đồ đang mở cho tài khoản thường (nền, phao đèn, rạn, đẳng sâu, thời tiết lưới hôm nay): **mở khi có premium, hoặc khi `vai` là `chu-tau`/`null`** (như hôm nay). Vai `ngu-dan`/`thu-mua`/`dai-ly` free ⇒ 403 `goi`. Dữ liệu bão (`/api/storms`) và thời tiết cảng (`sea:*`, `/cang`) vẫn mở cho mọi người theo luật hiện có. Lớp premium giữ nguyên luật.

⚠️ **Sửa một quyết định đã ghi**: CLAUDE.md và [01-product](01-product.md) đang ghi *"Bản đồ MIỄN PHÍ cho tài khoản"* (chốt 2026-10-27). Nay thành *"miễn phí cho chủ tàu; đi bạn/thu mua/đại lý cần gói"*. Commit build phải sửa cả hai chỗ cùng lúc. Bản đồ đã tải về máy của người đổi sang vai cần gói chỉ bị ẩn, **không xoá**.

### 11.2 Kẽ hở đổi vai — ĐÃ ĐÓNG nhờ khoá vai (03/11)

Trước: vai tự đổi được ⇒ Đi bạn free đổi sang "Chủ tàu" là có bản đồ free (tạm chấp nhận). Nay vai KHOÁ (§3.3): Đi bạn chỉ lên Chủ tàu khi có tàu trong sổ — đúng là chủ tàu thật — nên kẽ hở không còn. Chủ tàu + chưa chọn vai vẫn không phải khai tàu để dùng bản đồ (giữ nguyên như cũ, khách SDWork đều có tàu ⇒ suy ra Chủ tàu).

## 12. Đủ màn cho từng vai (kiểm 03/11)

Có sẵn = route/màn đang chạy · **Sửa** = màn có, phải đổi theo vai · **MỚI** = chưa có. Mọi màn MỚI phải đủ ma trận trạng thái (trống, đang tải, lỗi, mất sóng, cực đoan — CLAUDE.md quy tắc 4).

### 12.1 Chung mọi vai

| Màn | Route / chỗ | Tình trạng |
|---|---|---|
| Đăng ký / đăng nhập / quên mật khẩu | `/dang-ky` `/login` `/quen-mat-khau` | có sẵn |
| **Chọn vai** (4 thẻ, Để sau) | `/chon-vai` (sau đăng ký, `?next=`) | **MỚI** |
| Sheet Tài khoản: hàng **Vai: …** chỉ xem (chưa có ⇒ Chọn) | `hero-account` | **Sửa** |
| Trang chủ khi chưa chọn vai | `/` + thẻ "Bà con làm nghề gì?" | **Sửa** |
| Kairos (dòng tin, bài, trang người, Bến) | `/kairos/**` | có sẵn |
| Sen Biển (icon nổi) | toàn app | **Sửa**: câu gợi ý đầu theo vai (§4.3) |
| Thông báo (hộp thư) | trang chủ | có sẵn |
| Bản đồ | `/ngu-truong` | có sẵn — **Sửa**: chủ tàu/khách như cũ; đi bạn, thu mua, đại lý chỉ premium thấy ô, free vào link ⇒ màn giới thiệu gói (§11.1) |
| Cảng, con nước hôm nay | `/cang` | có sẵn (miễn phí) |
| Màn giới thiệu gói khi chạm link bản đồ | `premium-gate` | **Sửa** |
| Vật tư (người mua) | `/cho/**` | có sẵn |

### 12.2 Đi bạn (`ngu-dan`) — dock: Trang chủ · Kairos · Bản đồ · Việc làm · Chợ cá · Vật tư

| Màn | Route | Tình trạng |
|---|---|---|
| Trang chủ bản Đi bạn | `/` | **Sửa** (§4.2) |
| Việc làm — tab Tìm tàu (danh sách + lọc) | `/viec` | **MỚI** |
| Chi tiết tin tuyển (Gọi · Zalo · Báo xấu) | `/viec/tin/[id]` | **MỚI** (đường dẫn có `/tin/` vì cổng `api-routes-structure` cấm `[id]` đứng cạnh thư mục tên cố định) |
| Hồ sơ tìm tàu của tôi (tạo/sửa, bật/tắt) | `/viec/ho-so` | **MỚI** |
| **Giấy tờ của tôi** (chứng chỉ thuyền viên, sổ thuyền viên, CCCD — ảnh + hạn, nhắc hạn) | `/viec/giay` | **MỚI** — dùng lại `document-vault` với chủ = người, không gắn tàu |
| Tin đã lưu (đánh dấu tin tuyển để gọi sau, máy) | trong `/viec` | **MỚI** (khoá `forfish.viec.luu.v1`) |
| Chợ cá — giá + tin mua/bán + đầu mối | `/tien` | có sẵn |

Vì sao có Giấy tờ của tôi: không có tàu thì tủ giấy tờ (gắn tàu) bỏ trống, mà người đi bạn vẫn có giấy riêng sắp hết hạn, và chủ tàu hỏi tới khi tuyển.

### 12.3 Chủ tàu (`chu-tau`) — dock không đổi

| Màn | Route | Tình trạng |
|---|---|---|
| Trang chủ bản Chủ tàu (+ hàng tin tuyển) | `/` | **Sửa** |
| Hồ sơ tàu, giấy tờ, dịch vụ, thiết bị | `/tau` | có sẵn |
| Bạn thuyền | `/nguoi` | **Sửa**: thêm lối **Tuyển người** |
| Tuyển người — Tin của tôi (đang mở / hết hạn / đủ người; Gia hạn · Đủ người · Sửa) | `/viec/cua-toi` | **MỚI** |
| Đăng / sửa tin tuyển (điền sẵn tàu, cảng nhà, nghề) | `/viec/dang` | **MỚI** |
| Tìm người — danh sách hồ sơ + lọc | `/viec?tab=nguoi` | **MỚI** |
| Chi tiết hồ sơ (Gọi · Zalo — chỉ vai chủ tàu thấy SĐT) | `/viec/ho-so/[id]` | **MỚI** |

### 12.4 Thu mua (`thu-mua`) — dock: Trang chủ · Kairos · Chợ cá · Bản đồ · Vật tư

| Màn | Route | Tình trạng |
|---|---|---|
| Trang chủ bản Thu mua | `/` | **Sửa** (§4.2) |
| Chợ cá mở thẳng tab **Mua bán**, lọc sẵn "Tin bán" gần cảng | `/tien?muc=tin` | **Sửa** (mặc định theo vai; hôm nay mặc định tab Giá cá) |
| Tin mua của tôi (Đã xong · Mở lại · Xoá) | trong `market-board` | có sẵn |
| Đăng tin mua (loài, số lượng, giá thu mua, cảng) | trong `market-board` | có sẵn — **Sửa**: điền sẵn `poster_kind` theo hồ sơ vựa |
| **Hồ sơ vựa** (tên, loại vựa/nậu/nhà máy/chợ, địa chỉ, loài mua, giờ, SĐT) — để hiện trong Đầu mối | `/tien/vua` | **MỚI**. Hôm nay danh bạ Đầu mối (`sell_contacts`) chỉ admin nạp; vựa không tự đưa mình lên được |
| Dấu "Đã xác minh" trên hồ sơ vựa và tin mua | `market-board`, Đầu mối | **MỚI** (hiển thị) |
| Mối quen (tàu hay bán cho mình) | Đầu mối · Thêm mối | có sẵn |

### 12.5 Đại lý (`dai-ly`) — dock: Trang chủ · Kairos · Bán hàng · Vật tư · Bản đồ

| Màn | Route | Tình trạng |
|---|---|---|
| Trang chủ bản Đại lý | `/` | **Sửa** (§4.2) |
| Đăng ký gian hàng / chờ duyệt / bị từ chối, khoá | `/ban-hang/dang-ky`, 11 §6.2 | có sẵn |
| Tổng quan gian hàng | `/ban-hang` | có sẵn |
| Sản phẩm (danh sách, thêm/sửa, tồn kho, giá liên hệ) | `/ban-hang/san-pham/**` | có sẵn |
| Đơn hàng (danh sách, chi tiết, xác nhận + hẹn giao) | `/ban-hang/don/**` | có sẵn |
| Cài đặt gian hàng | `/ban-hang/cai-dat` | có sẵn |
| **Yêu cầu đặt món chợ chưa có — đại lý tự báo giá** | `/ban-hang/yeu-cau` | **MỚI**. Hôm nay chỉ nhân viên báo giá **thay** shop ở `/quan-tri` (11 §7b). Đại lý cần thấy yêu cầu trong tỉnh mình và gửi báo giá; chỉ gian hàng `hoat_dong` |
| Hàng sắp hết (lọc tồn ≤ 3) | `/ban-hang/san-pham?loc=sap-het` | **Sửa** (thêm bộ lọc) |

### 12.6 Quản trị (`/quan-tri`)

| Màn | Tình trạng |
|---|---|
| Danh sách khách: cột + lọc **Vai**, ô đếm theo vai | **Sửa** |
| Xác minh thu mua (nút + nhật ký) | **MỚI** |
| Tab **Việc làm** (báo xấu, ẩn/hiện, cấm đăng) | **MỚI** |
| Duyệt **hồ sơ vựa** trước khi lên Đầu mối (khuôn duyệt gian hàng) | **MỚI** |
| Yêu cầu đặt: thấy báo giá của đại lý bên cạnh báo giá SDVICO | **Sửa** |

### 12.7 Đếm

MỚI: **16 màn** (chọn vai 1 · Đi bạn 5 · Chủ tàu 4 · Thu mua 2 · Đại lý 1 · quản trị 3, không đếm trùng màn `/viec` dùng chung). Sửa: **15 màn**. Có sẵn giữ nguyên: phần còn lại.

Thứ tự build đề nghị: (1) cột vai + chọn vai + dock/trang chủ theo vai → (2) Việc làm (Đi bạn + Chủ tàu dùng chung) → (3) Giấy tờ của tôi → (4) Hồ sơ vựa + xác minh → (5) Đại lý tự báo giá → (6) quản trị.

## 13. Câu hỏi còn mở (cần anh Long chốt trước khi build)

1. ~~Thu mua có cần Bản đồ?~~ Hết hỏi: với thu mua, ô Bản đồ theo gói (§11).
2. Đại lý có cần thấy **Chợ cá** (giá cá) không? Spec đang bỏ.
3. Ô "công" trong tin tuyển: để chữ tự do (như spec) hay bắt buộc ghi số tiền?
4. Hồ sơ tìm tàu: chỉ chủ tàu thấy SĐT (spec) hay ai đăng nhập cũng thấy?
5. Tên hiển thị vai `ngu-dan`: "Đi bạn" (spec) hay "Ngư dân" / "Bạn thuyền"?
6. Có bán gói riêng cho vựa/đại lý không (§11)? Hiện với ba vai này, gói = có ô Bản đồ.
7. Đại lý tự báo giá yêu cầu đặt (§12.5): mở cho mọi gian hàng đã duyệt, hay vẫn chỉ SDVICO báo giá?
8. Hồ sơ vựa có cần nhân viên duyệt trước khi lên Đầu mối (spec: có) không?
9. ~~Màn bão miễn phí~~ Chốt 03/11: không làm; tin bão của đi bạn/thu mua/đại lý free mở băng bão chữ ở trang chủ (§11.1).
10. ~~Kẽ hở đổi vai~~ Đã đóng nhờ khoá vai (§3.3, §11.2).

## 14. Đã build (2026-11-03) — chỗ lệch spec + nợ

- Đường dẫn chi tiết: `/viec/tin/[id]` (không phải `/viec/[id]`), API `/api/viec/tin/[id]`.
- **Lọc vị trí** theo TỈNH (khuôn "Gần <Tỉnh> | Cả nước | Đổi" của Chợ cá), API nhận cả `port`.
- **Gia hạn** = 14 ngày tính từ lúc bấm (bấm nhiều lần không cộng dồn), mở lại cả tin "Đủ người" (tính vào trần 5).
- **Tự ẩn** tin bị 5 người khác nhau báo xấu. Trần: báo xấu 20/ngày, đăng 20/ngày, lấy số 60/10 phút.
- **Hồ sơ tắt sau 30 ngày** áp lúc đọc danh sách; màn hồ sơ có "Mở lại". `// nợ: chưa có thông báo đẩy "Bà con còn tìm tàu không?", nâng khi bật việc định kỳ (cron + push) cho Việc làm`.
- **Đại lý báo giá** thấy yêu cầu mọi tỉnh (chưa lọc tỉnh shop) — nợ ghi ở 11 §6.7.
- **Sen Biển theo vai** (§4.3) chưa làm — cần ý hỏi mới, đi theo vòng train.
- Trang chủ chủ tàu: hàng "Tin tuyển đang mở" đọc bản lưu máy, không gọi mạng ⇒ chỉ hiện sau khi đã mở /viec hoặc trang chủ Đi bạn một lần.
- **Offline theo vai** (anh Long 03/11, §2): gỡ `/viec`, `/viec/giay`, `/ban-hang` khỏi `SHELL` (sw.js về nguyên), gỡ SĐT khỏi bản lưu Việc làm, gỡ bản lưu "Cá đang bán" của trang chủ Thu mua.
- Cổng bản đồ: tệp `public/data/**` vẫn giải được bằng khoá dữ liệu của mọi tài khoản. `// nợ: vai cần gói vẫn rút được lớp tĩnh qua khoá dữ liệu, nâng khi tách khoá theo hạng/vai ở /api/data-key`.
- **Khoá vai** (anh Long 03/11, §3.3): bỏ nút Đổi vai ở Tài khoản + nút "Đổi sang Chủ tàu" ở màn đăng tin; Đi bạn / chưa chọn có tàu tự lên Chủ tàu.
- **Đường về** (anh Long 03/11 "làm sao quay về?"): app-shell chỉ vẽ dock cho route của dock MẶC ĐỊNH ⇒ `/viec/**` không có dock lẫn nút "‹". Nay app-shell xét `MOI_O_DOCK` (mọi ô của mọi vai); `/viec` có "‹" cho vai không có ô Việc làm; `/viec/giay` đổi sang `MarketHeader` (có "‹"). Rà cả app: 6 màn không dock (đăng nhập, đăng ký, quên/đổi mật khẩu, quyền riêng tư, chọn vai) đều có lối thoát.
