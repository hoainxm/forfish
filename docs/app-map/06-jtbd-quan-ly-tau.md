# 06 — JTBD: App quản lý toàn bộ tàu cá

> **Mục đích / Purpose**: Định nghĩa canonical về định vị mở rộng của ForFish — từ "bốn lời hứa" sang **app quản lý toàn bộ tàu cá**: chân dung người dùng cập nhật, bảng JTBD hợp nhất từ 4 nghiên cứu, ba khoảng trống vàng, mốc pháp lý cứng, nguyên tắc thiết kế, và map nhóm việc → module.

**Load khi / Load when**: quyết định ưu tiên feature mới, thiết kế module quanh object "con tàu" (chuyến biển / thuyền viên / tiền / giấy tờ), cần biết JTBD hoặc deadline pháp lý nào đang chi phối roadmap, hoặc viết copy theo chân dung người dùng.

Nguồn gốc: tổng hợp từ 4 nghiên cứu trong `docs/research/` — [01 kinh tế chuyến biển](../research/01-kinh-te-chuyen-bien.md) · [02 lao động trên tàu](../research/02-lao-dong-tren-tau.md) · [03 pháp lý IUU](../research/03-phap-ly-iuu.md) · [04 chuỗi giá trị & app](../research/04-chuoi-gia-tri-va-app.md). Cột "Nguồn" trong bảng JTBD trỏ về các file này.

---

## 1. Định vị mới: CON TÀU là trung tâm

Bốn lời hứa (đánh bắt tốt hơn, bán đắt hơn, vận hành rẻ hơn, tuân thủ dễ hơn — xem [01-product.md](01-product.md)) **vẫn là ngôn ngữ giá trị** khi nói chuyện với bà con. Nhưng object model của app chuyển từ "4 trục feature" sang **CON TÀU**:

```
TÀU ──┬── CHUYẾN BIỂN (tổn, nhật ký, lãi/lỗ)
      ├── THUYỀN VIÊN (hồ sơ, ứng tiền, chia phần, giấy tờ)
      ├── TIỀN (công nợ nậu/đại lý dầu, báo cáo năm)
      └── GIẤY TỜ (đăng kiểm, giấy phép, VMS, bảo hiểm, eCDT)
```

Lý do từ nghiên cứu: mọi pain point của chủ tàu đều xoay quanh **một con tàu cụ thể với chuyến biển, con người, dòng tiền và nghĩa vụ giấy tờ của nó** — không xoay quanh "trục thông tin". Chuỗi nghiên cứu 01–04 cho thấy phần "tiền" (tổn, công nợ với nậu, chia bạn, lãi/lỗ chuyến) hiện **chưa có app nào ở VN đụng tới** ([04 §3](../research/04-chuoi-gia-tri-va-app.md)).

## 2. Chân dung người dùng (cập nhật từ nghiên cứu)

| Ai | Đặc điểm chính | Nguồn |
|---|---|---|
| **Chủ tàu / thuyền trưởng** (người dùng chính) | 40–60 tuổi, ít rành công nghệ; quản lý tổn 100–800 triệu/chuyến bằng sổ tay + trí nhớ; thường không biết chuyến vừa rồi lời hay lỗ cho đến khi đã chia xong tiền | 01 |
| **Thuyền viên ("bạn thuyền")** | Lực lượng già hóa: >40% ở tuổi 41–60, ~12% mù chữ, thu nhập bình quân ~9,2 triệu đ/tháng ([SGGP](https://www.sggp.org.vn/chu-tau-ca-do-mat-tim-ban-di-bien-post833344.html)); thay đổi từng chuyến, quan hệ với chủ tàu 100% thỏa thuận miệng | 02 |
| **Người đại diện trên bờ — vợ/con chủ tàu** (người dùng thứ hai, RẤT quan trọng) | Người thực sự thao tác smartphone: vận hành livestream bán cá, có thể khai eCDT hộ từ bờ, nhận cảnh báo hạn giấy tờ/VMS khi chồng đang ngoài khơi không sóng | 04 |

**Bài học Aruna (Indonesia) — "Local Hero"**: chìa khóa thành công của Aruna không phải app mà là mô hình tuyển người trẻ địa phương (con em gia đình ngư dân, rành smartphone) thao tác hộ — nhập liệu, chụp ảnh cá, chốt giá; thu nhập ngư dân tăng 2–3 lần, >40.000 ngư dân ([CNBC](https://www.cnbc.com/2022/05/27/indonesias-fishermen-rake-in-bigger-incomes-thanks-to-aruna-app.html)). Kết luận cho ForFish: **ngư dân lớn tuổi không phải end-user trực tiếp duy nhất — thiết kế cho "người trung gian tin cậy" trong gia đình/làng chài** ([04 §3, §5](../research/04-chuoi-gia-tri-va-app.md)).

## 3. Bảng JTBD hợp nhất

Hợp nhất + khử trùng lặp từ 4 bảng JTBD của nghiên cứu 01–04, nhóm theo **6 nhóm việc** của một con tàu. Cột Nguồn: số file nghiên cứu.

### Nhóm A — ĐI BIỂN

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| Quyết định đi/nằm bờ bằng cảm tính + tin đồn; một quyết định sai mất 50–200 triệu | Ước được tổn và điểm hòa vốn TRƯỚC khi đổ dầu | Giá dầu DO + lịch điều hành 2 tuần/lần; dự báo thời tiết biển 7–10 ngày; mức hỗ trợ dầu QĐ 48 đủ điều kiện | **Máy tính chuyến biển**: nhập số ngày + nghề + mức tiêu hao dầu → tổn dự kiến + "cần đánh tối thiểu X tấn giá Y mới hòa vốn" | 01 |
| Kinh nghiệm ngư trường nằm trong trí nhớ thuyền trưởng | Quay lại đúng tọa độ trúng cá mùa trước; truyền nghề cho con | Bản đồ riêng tư các điểm đánh bắt cũ kèm sản lượng/mùa; lớp dự báo ngư trường công khai | Nhật ký mẻ lưới offline: 1 nút "đánh dấu điểm này" + voice note, tự gắn GPS/giờ, đồng bộ khi về bờ | 04 |
| Chạy tàu theo kinh nghiệm, không nhìn thấy ranh giới ven bờ/lộng/khơi hay ranh giới nước ngoài | Biết tàu sắp ra khỏi vùng được phép TRƯỚC khi vượt | Bản đồ phân vùng NĐ 26/2019 Đ.42–43 theo đúng cỡ tàu/giấy phép | **Geofence cảnh báo sớm** (còn X hải lý tới ranh); còi báo vùng cấm/chồng lấn; log hành trình làm bằng chứng khi bị xác minh oan | 03 |
| Icom + smartphone nhưng ngoài khơi không sóng | Tin thời tiết/áp thấp kịp thời; người nhà biết tàu ở đâu | Bản tin thời tiết biển tải sẵn trước khi đi; vị trí tàu (từ VMS) hiển thị cho người nhà trên bờ | Chế độ offline toàn phần; gói "trước giờ ra khơi" 1 chạm: tải dự báo 7 ngày + checklist an toàn | 04 |

### Nhóm B — BÁN CÁ

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| Cá đầy hầm phải bán ngay khi cập cảng, chỉ biết giá do chính nậu của mình báo | Giá tham chiếu để mặc cả, biết mình đang bị ép bao nhiêu đ/kg | Bảng giá theo loài/cỡ/cảng/ngày (crowdsourced + nguồn công khai); lịch sử giá theo mùa | Nhập giá bán thực tế → so với giá tham chiếu, cảnh báo "bán thấp hơn mặt bằng X đ/kg"; chụp ảnh mẻ cá + chào bán lên nhóm Zalo/người mua đã lưu 1 chạm | 01, 04 |
| Bán cho thương lái, không hiểu vì sao nhà máy ép giá khi hồ sơ không đủ | Hiểu chuỗi nhật ký → biên nhận → SC/CC → xuất EU để bán được giá tốt hơn | Giải thích thẻ vàng IUU: 100% container xuất EU bị kiểm tra, thông quan 2–3 tuần — vì sao cá "hồ sơ sạch" được trả giá cao hơn | Gói **"hồ sơ chuyến biển" xuất PDF/QR** (nhật ký + biên nhận + giám sát sản lượng) đưa người mua, chứng minh lô cá đủ điều kiện truy xuất | 03 |

### Nhóm C — TIỀN NONG

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| Sổ tay ghi tổn (dầu 40–60%, đá, lương thực) hay thiếu sót; mỗi chuyến 100–800 triệu | Biết chuyến này **lời hay lỗ bao nhiêu trước khi chia tiền** | Giá dầu hôm nay + lịch điều hành; mẫu "tổn chuẩn" theo nghề + cỡ tàu từ các chuyến trước | **Sổ chuyến biển**: ghi chi phí siêu nhanh (icon dầu/đá/gạo + nói số tiền), nhập tiền bán cá → tự tính lãi/lỗ | 01, 04 |
| Nợ dầu ghi tay với đại lý, thỏa thuận miệng với nậu — chỉ nậu giữ sổ | Nắm chính xác nợ ai bao nhiêu, đã trừ những gì, không bị trừ oan khi bán cá | Tổng dư nợ theo từng chủ nợ (đại lý dầu, nậu, ngân hàng); lịch sử ứng–trừ qua các chuyến | **Sổ công nợ đa đối tượng**: ghi nhanh khoản ứng (voice/ảnh hóa đơn), đối chiếu sau mỗi chuyến, xuất bảng kê hai bên cùng xác nhận | 01, 04 |
| Tiền tàu và tiền nhà lẫn một túi | Biết cả năm nghề biển lời hay lỗ, có nên vay thêm/bán tàu không | Báo cáo tổng doanh thu, tổng tổn, lãi ròng theo tháng/quý/năm | Tự tổng hợp từ sổ chuyến biển; biểu đồ chuyến lời/lỗ theo nghề, ngư trường, mùa vụ để rút kinh nghiệm | 01, 04 |

### Nhóm D — THUYỀN VIÊN

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| Danh sách bạn thuyền trong đầu + Zalo, gọi từng người, qua "cò" mất phí; tàu trễ chuyến 7–10 ngày vì thiếu người | Chốt đủ định biên trước ngày xuất bến | Định biên tối thiểu theo nhóm tàu I–IV (TT 22/2018) | **Sổ thuyền viên số**: hồ sơ từng bạn (CCCD, SĐT, chức danh), danh sách chuyến + trạng thái xác nhận đi/không đi | 02 |
| Ứng 10–25 triệu/người chỉ nhớ miệng; bị "xù" hàng chục đến >100 triệu/năm | Không mất trắng tiền ứng, có bằng chứng; giữ được bạn tốt chuyến sau | Mặt bằng mức ứng theo nghề/vùng; lịch sử đi/bỏ chuyến từng bạn | **Sổ ứng tiền – công nợ từng bạn**: ghi ứng, tự trừ vào phần chia cuối chuyến, xuất bảng đối chiếu có xác nhận | 01, 02 |
| Chia "miệng": trừ tổn rồi chia 50/50–70/30, ai thắc mắc thì cãi nhau | Chia minh bạch, nhanh, không tranh chấp, không mất người | Mẫu công thức ăn chia phổ biến theo nghề (50/50, 6/4, hệ số tài công 1,5–2 phần) | **Máy tính chia tiền**: nhập doanh thu + chi phí chung → tự chia theo tỉ lệ & hệ số từng người, gửi phiếu chia qua Zalo cả tàu | 01, 02, 04 |
| Bảo hiểm thuyền viên mua khi nhớ, có chuyến quên/mua thiếu người | Đủ bảo hiểm đúng số người thực tế mỗi chuyến (phạt lũy tiến 5–20 triệu theo NĐ 38/2024) | Loại bảo hiểm bắt buộc, mức phạt theo số người, chính sách hỗ trợ phí | Trạng thái bảo hiểm gắn từng thuyền viên + cảnh báo trước giờ xuất bến "2 người chưa có bảo hiểm"; nhắc hạn tái tục | 02 |
| Đánh giá bạn mới bằng cảm tính ("nông dân làm ngư phủ"), không biết ai làm được việc gì | Biết bạn mới từng đi nghề gì, có "tiền sử xù ứng" không | — | Hồ sơ kinh nghiệm thuyền viên (nghề từng đi, số chuyến trên app, xác nhận từ chủ tàu cũ) — nền tảng "chợ lao động đi biển" về sau | 02 |
| Khi có tai nạn: tự xoay xở sơ cứu, gọi về bờ, thương lượng bồi thường | Phản ứng đúng quy trình, có hồ sơ để bảo hiểm chi trả thay vì tự đền | Quy trình khi có tai nạn (sơ cứu, báo ai, số VMRCC/biên phòng), trách nhiệm pháp lý chủ tàu | Nút khẩn cấp + mẫu khai báo tai nạn lao động; lưu hồ sơ sự cố (ảnh, thời gian, vị trí) phục vụ claim bảo hiểm | 02 |

### Nhóm E — GIẤY TỜ & TUÂN THỦ

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| 5–7 loại giấy tờ tàu (đăng ký, đăng kiểm, giấy phép, ATTP, bảo hiểm), mỗi cái một ngày hết hạn, nhớ bằng đầu | Biết trước giấy nào sắp hết hạn để không bị chặn xuất bến hay vào danh sách IUU | Tủ giấy tờ số hiện hạn còn lại; mốc "giấy phép quá hạn 10 ngày = vào danh sách nguy cơ cao" | Nhắc hạn 30/15/3 ngày (cả Zalo/SMS cho vợ ở nhà); **checklist trước chuyến tự sinh theo Lmax tàu** (6/12/15/24m); đèn xanh-đỏ "đủ điều kiện xuất bến" | 01, 03, 04 |
| Nhật ký khai thác giấy, ghi gộp cuối chuyến ("hồi ký"), hay lệch với cân tại cảng | Ghi đúng từng mẻ không tốn thời gian, khớp nghĩa vụ NKKT khi bắt buộc (7/2026–1/2027) | Lộ trình nhật ký điện tử theo cỡ tàu (TT 81/2025) bằng lời thường; vì sao nhật ký sai = mất xác nhận nguồn gốc = mất giá bán | ⛔ **NGOÀI PHẠM VI ForFish** — khai báo NKKT/eCDT là nghiệp vụ với hệ thống nhà nước, đã có sản phẩm NKKT riêng của hệ sinh thái. ForFish chỉ NHẮC mốc bắt buộc theo cỡ tàu | 01, 03 |
| Nghe nói phải khai eCDT ra/vào cảng nhưng không rành thao tác (75% tàu chưa làm) | Khai đúng, đủ, nhanh tại cảng — không bị giữ tàu/từ chối bốc dỡ | Nhắc "tàu cỡ này, trước khi cập/rời cảng phải khai báo" + chỉ tới kênh chính thức / sản phẩm NKKT | ⛔ **NGOÀI PHẠM VI ForFish** (quyết định 2026-06-10, xem [01-product.md §7](01-product.md)) — không wizard khai hộ, không tích hợp hệ thống nhà nước | 03, 04 |
| VMS lắp đúng quy định nhưng mất kết nối lúc nào không biết (499 lượt vi phạm >6h chỉ trong 4 tháng tại TP.HCM) | Biết NGAY khi mất tín hiệu và biết phải làm gì trong 6 giờ / 10 ngày | Quy tắc NĐ 26/2019 Đ.44 bằng ngôn ngữ ngư dân: "mất tín hiệu → báo 6 giờ/lần → về cảng trong 10 ngày" | **Cảnh báo VMS**: đẩy khi mất kết nối >1 giờ; đếm ngược mốc 6 giờ/10 ngày; nút "ghi vị trí thủ công" + mẫu tin nhắn báo về trạm bờ | 03 |
| Sổ danh bạ thuyền viên giấy không khớp người thực tế; chứng chỉ thuyền trưởng/máy trưởng không nhớ hạn/hạng | Khi biên phòng kiểm tra, danh sách khớp sổ (phạt 1–2 triệu/người); chứng chỉ đúng hạng (phạt 5–10 triệu) | Quy định giấy tờ theo chức danh; hạng chứng chỉ theo nhóm tàu I–IV + nơi học/cấp gần nhất | Tạo "danh sách thuyền viên chuyến này" 1 chạm → xuất PDF khớp mẫu sổ danh bạ; cảnh báo "tàu 16m nhưng máy trưởng chỉ có hạng III" / chứng chỉ sắp hết hạn | 02, 03 |
| Không biết tàu mình có trong danh sách "nguy cơ cao IUU" của tỉnh hay không | Biết trạng thái tàu trong mắt cơ quan quản lý và cách thoát khỏi danh sách | Tiêu chí vào/ra danh sách (giấy phép quá hạn ≥10 ngày, mất VMS kéo dài, sai vùng); tỉnh công bố hàng tuần | Theo dõi "điểm rủi ro IUU" của tàu; hướng dẫn từng bước khắc phục để được rút khỏi danh sách | 03 |

### Nhóm F — VẬN HÀNH TÀU

| Tôi (chủ tàu) có gì | Tôi cần gì | App cấp INFO | App cấp CÔNG CỤ | Nguồn |
|---|---|---|---|---|
| Một mình lo hết: dầu, đá, người, giấy tờ trước giờ xuất bến | Chuẩn bị chuyến nhanh, không sót khoản nào | Mẫu "tổn chuẩn" theo nghề + cỡ tàu của chính mình (lấy từ chuyến trước) | Checklist chuẩn bị chuyến tự sinh từ chuyến gần nhất (số cây đá, lít dầu, danh sách bạn) — 1 nút sao chép chuyến cũ thành chuyến mới | 01 |
| Mua vật tư (dầu nhớt, lọc, ngư cụ hao hụt) trôi nổi, sửa máy lặt vặt theo sự cố | Giữ tàu chạy bền, tốn ít tiền hơn, không hỏng máy giữa biển | Lịch bảo dưỡng theo giờ máy/chuyến; danh mục vật tư chính hãng | Nhắc bảo dưỡng + chợ vật tư in-app (đã có — Trục 3, xem [01-product.md](01-product.md)) | 01* |

\* Hàng thứ hai nhóm F là mapping với Trục 3 hiện có; nghiên cứu 01 chỉ ghi nhận chi phí ngư cụ/sửa máy là cấu phần tổn, không có JTBD row riêng.

## 4. Ba khoảng trống vàng + mốc pháp lý cứng

### Ba khoảng trống vàng (từ [nghiên cứu 04 §4](../research/04-chuoi-gia-tri-va-app.md))

1. **Sổ tiền của tàu** — tổn, công nợ với nậu/đại lý dầu, chia bạn, lãi/lỗ chuyến: hiện nằm trong sổ tay của nậu và trí nhớ chủ tàu; **không app nào ở VN đụng tới phần "tiền"** (eCDT là tuân thủ nhà nước, VMS là hạ tầng nghĩa vụ, Biển Việt là tiện ích hàng hải đơn lẻ). Đây là gốc rễ của ép giá, ép cân — và là wedge khác biệt hóa của ForFish.
2. ~~**Lớp UX trên nghĩa vụ eCDT**~~ — **ĐÃ LOẠI KHỎI PHẠM VI** (quyết định user 2026-06-10: eCDT/NKKT là nghiệp vụ với hệ thống nhà nước, hệ sinh thái đã có sản phẩm NKKT riêng; ForFish chỉ NHẮC mốc trong checklist xuất bến). Bối cảnh thị trường giữ lại để tham khảo: eCDT bắt buộc khai báo ra/vào cảng từ **01/3/2026** nhưng đến 3/2026 mới **24,65%** (19.806/80.346) tàu thực hiện ([SGGP](https://www.sggp.org.vn/truy-xuat-thuy-san-tren-he-thong-dien-tu-moi-dat-2465-post845939.html), [Báo Chính phủ](https://baochinhphu.vn/trien-khai-he-thong-truy-xuat-nguon-goc-thuy-san-khai-thac-dien-tu-102260402171022493.htm)). Khoảng trống cho lớp "điền hộ/điền dễ" hợp pháp bên trên nghĩa vụ khai báo — kể cả người nhà khai hộ từ bờ.
3. **Ví giấy tờ + nhắc hạn** — hạn đăng kiểm, giấy phép (gắn kỳ hạn ngạch 60 tháng, mỗi tàu một ngày hết hạn khác nhau), chứng chỉ, phí VMS: quản lý bằng giấy + trí nhớ, quên hạn là bị phạt hoặc nằm bờ. ForFish đã có document-vault (Trục 4) — cần nâng thành checklist xuất bến chủ động.

### Mốc lộ trình pháp lý cứng (từ [nghiên cứu 03 §3](../research/03-phap-ly-iuu.md), TT 81/2025/TT-BNNMT)

| Mốc | Nghĩa vụ | Tàu áp dụng |
|---|---|---|
| **01/3/2026** | eCDT bắt buộc khai báo ra/vào cảng + biên nhận bốc dỡ | Tất cả (đã hiệu lực, tuân thủ mới 24,65%) |
| **01/7/2026** | Nhật ký khai thác điện tử bắt buộc | ≥ 24m |
| **01/9/2026** | Nhật ký điện tử bắt buộc | 15 – <24m |
| **01/1/2027** | Nhật ký điện tử bắt buộc | 12 – <15m |

Kèm theo: NĐ 301/2025/NĐ-CP (hiệu lực 17/11/2025) tăng mạnh mức phạt — không ghi nhật ký tới 500–700 triệu với tàu vùng khơi ([Tuổi Trẻ](https://tuoitre.vn/tau-ca-khong-ghi-nhat-ky-khai-thac-thuy-san-bi-phat-toi-700-trieu-dong-20251118202952361.htm)). EC dự kiến đánh giá thẻ vàng tiếp vào cuối 2026; Thủ tướng đặt mục tiêu gỡ thẻ vàng trong năm 2026. **Mỗi mốc trên là một làn sóng nhu cầu tự nhiên cho ForFish.**

## 5. Nguyên tắc thiết kế rút từ nghiên cứu

1. **Offline-first là bắt buộc** — ra khỏi vùng phủ sóng là smartphone vô dụng; mọi tính năng dùng trên biển phải ghi local, đồng bộ khi về bờ (eCDT và Biển Việt đều phải làm vậy) ([04 §2, §5](../research/04-chuoi-gia-tri-va-app.md)).
2. **Voice/ảnh thắng bàn phím** — ~12% thuyền viên mù chữ, chủ tàu lớn tuổi; giao diện giọng nói + chụp ảnh hóa đơn + nút to + icon vượt trội so với gõ text (bằng chứng VideoKheti, Farmer.Chat) ([02 §1](../research/02-lao-dong-tren-tau.md), [04 §5](../research/04-chuoi-gia-tri-va-app.md)).
3. **Thiết kế cho người đại diện trên bờ** — Aruna (Local Hero), eCDT (cán bộ cầm tay chỉ việc), livestream (con cái vận hành): cùng một mẫu hình "một người trẻ tin cậy thao tác hộ". App cần vai trò "người nhà / thư ký tàu" chính danh, với quyền xem/khai hộ từ bờ ([04 §3, §5](../research/04-chuoi-gia-tri-va-app.md)).
4. **Minh bạch hóa trước — thay thế nậu sau** — nậu vựa là ngân hàng + bảo hiểm + logistics phi chính thức; app "cắt nậu" ngay sẽ thất bại vì không thay được chức năng vốn. Bước 1 là minh bạch số liệu (giá, cân, công nợ) để tăng vị thế đàm phán ([04 §1](../research/04-chuoi-gia-tri-va-app.md)).
5. **Không hứa quá nguồn dữ liệu** — kế thừa adapter rule của [01-product.md §5](01-product.md); cộng thêm bài học eFishery: số liệu "trên app" và thực tế dưới cảng dễ vênh — dữ liệu ngư dân tự khai cần cơ chế đối chứng (ảnh, xác nhận 2 phía) ([04 §3](../research/04-chuoi-gia-tri-va-app.md)).

## 6. Map nhóm việc → module

| Nhóm việc | Module HIỆN CÓ | ĐANG XÂY | CẦN XÂY |
|---|---|---|---|
| A. ĐI BIỂN | sea-forecast (điểm đi biển), fishing-map (bản đồ ngư trường), trip-log (một phần), **trip-estimator (máy tính chuyến biển: tổn dự kiến + hoà vốn)** | — | geofence vùng biển (ranh ven bờ/lộng/khơi + chồng lấn nước ngoài); nhật ký mẻ lưới riêng tư |
| B. BÁN CÁ | price-board (giá theo loài tại cảng) | — | hồ sơ chuyến PDF/QR (chứng minh truy xuất cho người mua); chào bán Zalo 1 chạm |
| C. TIỀN NONG | trip-log (sổ lãi/lỗ chuyến biển), **trip-report (báo cáo lời/lỗ năm)**, **trip-estimator (ước tổn/hoà vốn)**, sổ ứng + máy chia tiền (crew module) | — | **sổ công nợ đa đối tượng** (đại lý dầu, nậu, ngân hàng) |
| D. THUYỀN VIÊN | — | **crew module `/thuyen-vien`**: hồ sơ thuyền viên + chứng chỉ/bảo hiểm + sổ ứng tiền + máy tính chia tiền | hồ sơ kinh nghiệm/uy tín (nền "chợ lao động đi biển"); hồ sơ sự cố tai nạn |
| E. GIẤY TỜ & TUÂN THỦ | document-vault (tủ giấy tờ + nhắc hạn), fines-lookup (tra mức phạt) | — | **checklist xuất bến tự sinh theo Lmax** (gồm NHẮC mốc khai báo eCDT/NKKT — khai báo thật thuộc hệ thống nhà nước/sản phẩm NKKT, ⛔ ngoài phạm vi); **cảnh báo VMS** (mất kết nối, đếm ngược 6h/10 ngày); điểm rủi ro IUU |
| F. VẬN HÀNH TÀU | supply-catalog (chợ vật tư), maintenance-reminders (nhắc bảo dưỡng) | — | checklist chuẩn bị chuyến (sao chép chuyến cũ — chung nền với checklist xuất bến) |

Thứ tự ưu tiên build các mục CẦN XÂY: xem [01-product.md §7 — Lộ trình](01-product.md).

## 7. Cross-references

- Bốn lời hứa, adapter rule, lộ trình đợt phát triển: [01-product.md](01-product.md)
- Routes/components (mount module mới vào đâu): [02-architecture.md](02-architecture.md)
- UI cho ngư dân (nút to, voice, offline): [03-design-system.md](03-design-system.md)
- Schema giấy tờ/hạn + mở rộng cho thuyền viên, chuyến biển, công nợ: [04-data-model.md](04-data-model.md)
- Nghiên cứu gốc: [docs/research/](../research/)

---

**Last updated**: 2026-06-10
