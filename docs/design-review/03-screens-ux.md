# 03 — Per-screen UX & Information Hierarchy

> Góc nhìn: review TỪNG màn theo việc thật của ngư dân 40–60 tuổi, đọc dưới nắng chói, tay ướt, "một việc một màn".
> Phương pháp: khung `design:design-critique` (ấn tượng đầu → việc chính → thứ tự thông tin → quá tải/thiếu → đề xuất ưu tiên).
> Read-only — không sửa code. Mọi trích dẫn là `file:line`.

---

## Màn 0 — Trang chủ (`src/app/page.tsx`)

### Việc chính (góc ngư dân)
"Mở app — có gì gấp tôi phải lo không? Nếu không, cho tôi vào đúng 1 trong 5 việc." Đây là màn phân luồng, không phải màn làm việc.

### Ấn tượng đầu / việc chính có nổi không?
Có. Khi có giấy tờ sắp hết hạn, "Việc cần làm ngay" lên trên cùng, viền đỏ, chấm trạng thái + chữ to (`page.tsx:67-113`). Bốn nút lớn 2 cột, icon + 2-3 chữ + 1 dòng phụ (`page.tsx:119-146`). Đây là màn làm tốt nhất app.

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại: Urgent strip → "Chọn việc cần làm" (4 pillar) → thẻ Thuyền viên → câu chúc. Thứ tự đã đúng (gấp trước, chọn việc sau).
- Vấn đề lớn: **urgent strip CHỈ lấy từ giấy tờ** (`page.tsx:53-56`). Bão sắp tới, bảo dưỡng quá hạn, bảo hiểm bạn thuyền hết hạn — những thứ "gấp" thật sự của các trục khác — không bao giờ lên được đây. Với ngư dân, tin bão gấp hơn giấy tờ. "Việc cần làm ngay" đang nói dối về phạm vi.

### Quá tải / thiếu / rối
- **Thiếu nhất quán điều hướng:** Home có 5 cửa (4 pillar + thẻ Thuyền viên `page.tsx:149`), nhưng `BottomNav` chỉ có 4 trục + Trang chủ, **không có Thuyền viên** (`bottom-nav.tsx:17-23`). Vào màn Thuyền viên xong, người dùng mất đường quay lại trừ khi về Home. Một việc chính (chia tiền — chống cãi nhau) bị giấu.
- Tên không khớp: Home gọi "Vật tư & máy" (`page.tsx:38`), nav gọi "Vật tư" (`bottom-nav.tsx:21`). Nhỏ nhưng người ít dùng app sẽ phân vân "có phải cùng chỗ không".
- Câu chúc cuối (`page.tsx:172-174`) vô hại nhưng chiếm 1 dòng cuộn không có việc.

### Đề xuất (cao → thấp)
1. **[CAO] Mở rộng urgent strip ra mọi trục.** Gom cảnh báo gấp từ bão (`storms`), bảo dưỡng quá hạn, bảo hiểm/chứng chỉ bạn thuyền hết hạn vào cùng 1 danh sách "Việc cần làm ngay", sắp theo độ gấp. Đây là lý do số 1 để mở app mỗi sáng.
2. **[CAO] Đưa Thuyền viên vào bottom nav** hoặc đổi nav thành 5 trục thật. Việc đang bị cụt đường về.
3. **[TB] Đồng bộ nhãn** "Vật tư & máy" giữa Home và nav.
4. **[THẤP]** Bỏ/giảm câu chúc, hoặc gộp vào header.

---

## Màn 1 — Đánh bắt (`src/app/ngu-truong/page.tsx`) — MÀN QUÁ TẢI NHẤT

### Việc chính (góc ngư dân)
"Hôm nay đi biển được không?" — một câu hỏi, một câu trả lời. Tiêu đề màn nói đúng vậy (`ngu-truong/page.tsx:13`).

### Ấn tượng đầu / việc chính có nổi không?
Nửa đầu màn xuất sắc: StormBanner an toàn-trước (`page.tsx:18`) → điểm đi biển 72px một con số một màu (`sea-forecast.tsx:117-128`). Trong 3 giây trả lời được câu hỏi chính. **Nhưng màn không dừng ở đó** — nó kéo dài qua 5 công cụ.

### 5 công cụ đang xếp chồng trên 1 trang
1. StormBanner — cảnh báo bão (`storm-banner.tsx`)
2. SeaForecast — điểm đi biển theo cảng + 7 ngày tới (`sea-forecast.tsx`)
3. FishingMapView — bản đồ vệ tinh + 4 lớp ảnh (SST/diệp lục/độ sâu/mây) + nhãn chủ quyền + ranh giới IUU (`fishing-map-view.tsx:203-357`)
4. Dự báo theo điểm chạm — điểm/gió/sóng/3 ngày + cảnh báo ranh giới biển (`fishing-map-view.tsx:360-535`)
5. RoutePlanner — dẫn đường tiết kiệm dầu, form nhập tốc độ tàu + lít/giờ (`route-planner.tsx:241-408`)

Một `FishingMapView` đơn lẻ nhồi **chọn lớp ảnh + bản đồ + dự báo điểm + route planner**. Đây là 3-4 việc trong 1 component, vi phạm thẳng "một việc một màn".

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại: an toàn → điểm hôm nay → 7 ngày → (cuộn dài) → chọn lớp bản đồ → bản đồ → điểm chạm → route. Người chỉ cần "đi được không" phải cuộn qua một màn bản đồ kỹ thuật họ không hỏi.
- Nên: 3 giây đầu chỉ cần **Bão? + Điểm hôm nay + nút "Xem 7 ngày tới"**. Mọi thứ bản đồ/route là tác vụ chủ động, nên ở màn phụ.

### Quá tải / thiếu / rối — đề xuất cắt/gom/tách
- **Chọn lớp ảnh vệ tinh (SST, diệp lục, độ sâu, mây)** (`fishing-map-view.tsx:203-243`): khái niệm "nước nóng lạnh / vùng nhiều mồi" là kiến thức nâng cao, không phải câu hỏi sáng sớm. Quá tải với người 40-60 ít công nghệ.
- **RoutePlanner nhập tốc độ tàu + lít/giờ** (`route-planner.tsx:271-300`): hai ô số kỹ thuật giữa luồng "đi được không". Đây là tính năng tối ưu dầu — việc riêng.
- **Hai khối điểm đi biển trùng nhau:** điểm theo cảng (`sea-forecast.tsx:105-154`) và điểm theo điểm chạm (`fishing-map-view.tsx:418-447`) dùng cùng thang nhưng hiển thị hai kiểu khác nhau → người dùng dễ hỏi "sao có 2 điểm khác nhau?".
- **Cảnh báo ranh giới IUU** (`fishing-map-view.tsx:371-387`) rất quan trọng (phạt nặng) nhưng đang chôn dưới đáy bản đồ, chỉ hiện sau khi chạm.

Đề xuất tách màn:
- Màn chính `/ngu-truong` = Bão + Điểm hôm nay + 7 ngày (chỉ `StormBanner` + `SeaForecast`).
- Màn phụ `/ngu-truong/ban-do` = Bản đồ + lớp ảnh + dự báo điểm chạm + cảnh báo ranh giới.
- Màn phụ `/ngu-truong/dan-duong` = RoutePlanner (nhập thông số tàu một lần, app nhớ).

### Đề xuất (cao → thấp)
1. **[CAO] Tách bản đồ + route ra (các) màn phụ.** Để `/ngu-truong` trả lời đúng 1 câu hỏi. Thêm 2 nút lớn "Mở bản đồ biển" / "Dẫn đường tiết kiệm dầu" dẫn sang màn phụ.
2. **[CAO] Đưa cảnh báo ranh giới IUU lên sớm** (ngay khi vào bản đồ, không đợi chạm) — đây là rủi ro phạt nặng nhất.
3. **[TB] Gộp/giải thích 2 loại điểm** hoặc đặt cùng kiểu thẻ để không gây hoang mang.
4. **[THẤP] Mặc định lớp bản đồ về "mây/thật"** dễ hiểu nhất; lớp SST/diệp lục để sau nút "Xem thêm lớp".

---

## Màn 2 — Bán cá (`src/app/gia-ca/page.tsx`)

### Việc chính (góc ngư dân)
Hai việc: (a) "Giá cá hôm nay bao nhiêu để khỏi bị ép giá" và (b) "Chuyến vừa rồi lời hay lỗ". Cả hai đều chính đáng và bổ trợ nhau.

### Ấn tượng đầu / việc chính có nổi không?
Có. Bảng giá lên trước (việc tra cứu nhanh, làm trước khi bán), sổ lãi lỗ sau (`gia-ca/page.tsx:18-30`). Mỗi loại cá 1 thẻ, khoảng giá to, xu hướng luôn icon + chữ ("đang lên/xuống/đứng giá") (`price-board.tsx:78-109`) — chuẩn cho người mù màu và nắng chói.

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại đúng: tra giá (đọc) trước, ghi sổ (nhập) sau.
- Nhỏ: `TripLog` để nút "Ghi chuyến biển mới" (`trip-log.tsx:152-161`) TRÊN cả thẻ tổng kết khi đã có dữ liệu. Với người đã có chuyến, "lãi 3 chuyến gần nhất" (`trip-log.tsx:127-150`) là thứ họ muốn thấy trước — nên thẻ tổng đang đúng vị trí trên nút, ổn.

### Quá tải / thiếu / rối
- **Hai việc rất khác bản chất chung 1 màn:** tra giá = đọc, công khai, cập nhật hàng ngày; sổ lãi lỗ = nhập liệu, riêng tư, lưu localStorage. Không sai khi gộp (đều "kinh tế chuyến biển"), nhưng tiêu đề màn "Giá cá & sổ lãi lỗ" (`gia-ca/page.tsx:13`) đang phải gánh 2 ý.
- Bảng giá không có thời điểm/ngày nổi bật ngoài dòng disclaimer xám (`price-board.tsx:52-55`); người dùng có thể không rõ giá "hôm nay" là ngày nào nếu data cũ.
- Sổ lãi lỗ thiếu liên kết tới chia tiền (Thuyền viên) — cùng là tiền chuyến nhưng hai nơi nhập "tiền bán cá" tách rời.

### Đề xuất (cao → thấp)
1. **[TB] Làm rõ tách đôi trong màn:** giữ 1 màn nhưng dùng 2 section header mạnh hơn + khoảng cách rõ (đã có `mt-8` `gia-ca/page.tsx:25`); cân nhắc dòng dẫn "Bán xong rồi? Ghi vào sổ lãi lỗ ↓".
2. **[TB] Nổi bật ngày của bảng giá** (badge ngày cạnh tiêu đề "Giá cá hôm nay").
3. **[THẤP] Bắc cầu sang chia tiền:** từ một chuyến trong sổ, gợi ý "Chia tiền chuyến này" sang màn Thuyền viên.

---

## Màn 3 — Vật tư & máy (`src/app/van-hanh/page.tsx`)

### Việc chính (góc ngư dân)
"Tới lúc bảo dưỡng gì chưa, và mua đồ đó giá bao nhiêu." Nhắc bảo dưỡng (chủ động cảnh báo) + bảng giá vật tư (tra cứu).

### Ấn tượng đầu / việc chính có nổi không?
Có. Nhắc bảo dưỡng lên trước (`van-hanh/page.tsx:17-22`), mỗi việc 1 thẻ với banner trạng thái màu (quá hạn/đến hạn/còn X ngày) là thứ mắt chạm đầu tiên (`maintenance-reminders.tsx:219-226`). Nút "Vừa làm xong hôm nay" ngay trên thẻ — đúng tác vụ thường nhất (`maintenance-reminders.tsx:245-255`). Rất tốt.

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại đúng: việc gấp (bảo dưỡng quá hạn) trước, danh mục giá tra cứu sau.
- Thẻ bảo dưỡng đã sắp theo độ gấp (`maintenance-reminders.tsx:149-155`) — quá hạn lên đầu. Chuẩn.

### Quá tải / thiếu / rối
- Quan hệ giữa 2 phần lỏng: note demo có gợi ý "xem bảng giá bên dưới" (`maintenance-reminders.tsx:91`) nhưng không có liên kết thật từ một việc bảo dưỡng (vd "Thay lọc dầu") tới đúng mục lọc trong bảng giá. Người dùng phải tự cuộn tìm.
- `SupplyCatalog` mở đầu bằng note "Đặt hàng qua đại lý sẽ có trong bản tới" (`supply-catalog.tsx:38-44`) — hứa hẹn tính năng chưa có, hơi nhiễu trên màn làm việc.
- Bảng giá chỉ để xem, không có ô tìm theo tên (khác với màn giá cá có search) — không nhất quán; với danh mục dài, lọc theo chip (`supply-catalog.tsx:46-71`) là đủ nhưng tìm "kẽm" nhanh hơn cuộn.

### Đề xuất (cao → thấp)
1. **[TB] Nối bảo dưỡng → bảng giá:** từ thẻ "Thay lọc dầu", thêm link "Xem giá lọc" nhảy xuống lọc đã lọc sẵn category. Biến 2 việc rời thành 1 luồng "nhắc → mua".
2. **[TB] Bỏ/làm nhẹ lời hứa "bản tới"** trong note vật tư, hoặc chuyển thành dòng phụ rất nhỏ.
3. **[THẤP] Thêm ô tìm cho bảng giá vật tư** để nhất quán với màn Bán cá.

---

## Màn 4 — Giấy tờ (`src/app/giay-to/page.tsx`)

### Việc chính (góc ngư dân)
"Giấy nào sắp hết hạn để khỏi bị phạt." Phụ: tra mức phạt khi cần.

### Ấn tượng đầu / việc chính có nổi không?
Có. `DocumentVault` mỗi giấy 1 thẻ, banner trạng thái màu + icon + chữ (`document-vault.tsx:133-140`), sắp theo độ gấp (`document-vault.tsx:70`). Cùng "ngôn ngữ thẻ" với bảo dưỡng và thuyền viên → học một lần dùng mọi nơi. Đây là điểm mạnh hệ thống.

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại: Tủ giấy tờ trước → Tra mức phạt sau (`giay-to/page.tsx:18-22`). Đúng — quản lý giấy của mình (chủ động) quan trọng hơn tra phạt (thỉnh thoảng).
- Nút "Thêm giấy tờ mới" (`document-vault.tsx:91-100`) nằm trên danh sách; với người đã có giấy, danh sách trạng thái nên là thứ thấy trước. Cân nhắc đưa nút xuống dưới hoặc thành nút nổi — nhưng đây là tranh luận nhỏ vì nút thêm cũng cần dễ thấy.

### Quá tải / thiếu / rối
- Hai việc khác bản chất gộp 1 màn nhưng hợp lý (đều thuộc "tuân thủ giấy tờ"). Không quá tải.
- `FinesLookup` lặp lại tiêu đề "Tra mức phạt" bên trong (`fines-lookup.tsx:63`) trong khi màn không có section header riêng cho nó — header màn chỉ nói "Tủ giấy tờ". Hơi lệch: phần phạt tự giới thiệu mình, phần vault dựa vào header màn.
- Thiếu cầu nối: một giấy "đăng kiểm" hết hạn không link sang mức phạt tương ứng khi đi biển không đăng kiểm.

### Đề xuất (cao → thấp)
1. **[TB] Thêm section header nhất quán** cho cả hai khối (vd "Giấy tờ của tàu" + "Tra mức phạt") để cấu trúc màn rõ ràng, không để component tự đặt tiêu đề lệch cấp.
2. **[THẤP] Bắc cầu giấy ↔ phạt:** thẻ giấy quá hạn gợi ý "Đi biển thiếu giấy này bị phạt bao nhiêu?" mở sẵn kết quả tra phạt.
3. **[THẤP] Cân nhắc nút thêm dạng nổi** để danh sách trạng thái lên ngay đầu màn.

---

## Màn 5 — Thuyền viên (`src/app/thuyen-vien/page.tsx`)

### Việc chính (góc ngư dân)
Hai việc nặng ký: (a) "Bạn thuyền của tôi đã đủ bảo hiểm/chứng chỉ chưa trước khi biên phòng kiểm" và (b) "Chia tiền chuyến cho đúng, khỏi cãi nhau" — theo chính comment nghiên cứu trong code (`crew-list.tsx:24-28`, `trip-split.tsx:8-13`).

### Ấn tượng đầu / việc chính có nổi không?
Có. `CrewList` mở bằng 3 ô tổng quan (số bạn thuyền / chưa bảo hiểm / đang ứng) (`crew-list.tsx:135-156`), rồi mỗi người 1 thẻ với banner cảnh báo (`crew-list.tsx:190-196`). Chia tiền ở dưới với máy tính trừ-tổn-chia-phần tự trừ tiền ứng (`trip-split.tsx`). Việc chính nổi rõ.

### Thứ tự thông tin: hiện tại vs nên thế nào
- Hiện tại: tổng quan → danh sách bạn thuyền → chia tiền. Hợp lý: phải có người trước mới chia được (chính `TripSplit` cảnh báo điều này `trip-split.tsx:82-86`).
- Ô tổng quan "Đang ứng" dùng cỡ chữ nhỏ hơn (`crew-list.tsx:151` 17px) so với 2 ô kia (24px) vì số tiền dài — gây lệch thị giác, ô quan trọng về tiền lại trông yếu nhất.

### Quá tải / thiếu / rối
- **Màn này KHÔNG nằm trong bottom nav** (`bottom-nav.tsx:17-23`) — chỉ vào được từ thẻ Home. Một trong hai việc giá trị nhất app (chia tiền chống tranh chấp) bị khó tìm. Đây là vấn đề điều hướng cấp app, lộ rõ nhất ở màn này.
- Chia tiền nhập lại "Tiền bán cá cả chuyến" (`trip-split.tsx:35-46`) trong khi Sổ lãi lỗ (màn Bán cá) cũng nhập "Tiền bán cá" — hai nơi nhập cùng con số, không liên thông, dễ lệch.
- Thẻ bạn thuyền có 3 nút hành động (Ứng tiền / Sửa / Xóa) chia 3 cột (`crew-list.tsx:238-263`) — với tay ướt, 3 nút sát nhau trên 1 hàng dễ bấm nhầm; "Xóa" cạnh "Sửa" rủi ro.

### Đề xuất (cao → thấp)
1. **[CAO] Đưa Thuyền viên vào điều hướng chính** (sửa `bottom-nav.tsx`) — không thì việc chống-cãi-nhau này gần như vô hình.
2. **[TB] Giãn/đổi nhóm 3 nút thẻ bạn thuyền:** tách "Xóa" ra (vd đưa vào trong form Sửa, hoặc cần gạt) để tay ướt không xóa nhầm. "Ứng tiền" là việc thường → cho nổi hơn.
3. **[TB] Đồng nhất cỡ chữ 3 ô tổng quan** hoặc rút gọn số tiền (vd "12 tr") để "Đang ứng" không yếu thế.
4. **[THẤP] Liên thông số tiền bán cá** giữa Sổ lãi lỗ và Chia tiền (chọn một chuyến đã ghi để tự điền).

---

## Bảng tổng hợp — màn → vấn đề lớn nhất → fix ưu tiên #1

| Màn | Vấn đề lớn nhất | Fix ưu tiên #1 | Cite |
|-----|-----------------|----------------|------|
| Trang chủ | "Việc cần làm ngay" chỉ lấy từ giấy tờ, bỏ sót bão/bảo dưỡng/bảo hiểm | Gom cảnh báo gấp từ MỌI trục vào urgent strip | `page.tsx:53-56` |
| Đánh bắt | 5 công cụ chồng 1 trang; 1 component nhồi bản đồ+lớp ảnh+điểm chạm+route | Tách bản đồ & dẫn đường ra màn phụ; `/ngu-truong` chỉ Bão + Điểm hôm nay + 7 ngày | `ngu-truong/page.tsx:18-31`, `fishing-map-view.tsx:203-535` |
| Bán cá | 2 việc khác bản chất (tra giá đọc / sổ nhập liệu) chung 1 tiêu đề | Tách rõ 2 section + dẫn luồng "bán xong → ghi sổ" | `gia-ca/page.tsx:13-31` |
| Vật tư & máy | Nhắc bảo dưỡng và bảng giá rời rạc, không nối nhau | Link từ việc bảo dưỡng → đúng mục trong bảng giá | `maintenance-reminders.tsx:91`, `supply-catalog.tsx` |
| Giấy tờ | Tiêu đề màn chỉ phủ vault; phần Tra phạt tự đặt header lệch cấp | Thêm section header nhất quán cho cả 2 khối | `giay-to/page.tsx:18-22`, `fines-lookup.tsx:63` |
| Thuyền viên | Không có trong bottom nav → 1 trong 2 việc giá trị nhất bị giấu | Đưa Thuyền viên vào điều hướng chính | `bottom-nav.tsx:17-23` |
