# OSM làm manh mối — chạy quy trình "đi tìm → xác minh độc lập → của mình" lần đầu ở quy mô thật (2026-09-02)

> Quy trình chốt ở [phuong-an-tu-chu-du-lieu.md §1-#3](../formaps/phuong-an-tu-chu-du-lieu.md):
> với nguồn mang điều khoản tập hợp (ODbL của OSM), dùng làm **manh mối đi tìm**,
> xác minh bằng nguồn độc lập không-ODbL, ghi lý lịch theo **nguồn xác minh** —
> chuỗi dẫn xuất đứt. Tài liệu này là số đo của lần chạy đầu tiên, trên toàn dải
> bờ Việt Nam, nhắm vào 57 báo hiệu còn thiếu của các tuyến hụt và dải trống
> 12–15,2°B. Công cụ: `scripts/osm-manh-moi.mjs` (mới) → kho
> `<tmp>/sdfish-osm-manh-moi/xac-minh.json` → NGUỒN E của
> `scripts/generate-vn-aids.mjs`.

## 0. Kết luận một đoạn

**Quy trình chạy được và chuỗi ODbL đứt đúng thiết kế — nhưng OSM gần như KHÔNG
có manh mối ở chỗ ta thiếu.** 5.851 điểm seamark của snapshot cộng 121 điểm
Overpass tươi (kể cả vét thêm trường phái `man_made=lighthouse|beacon` mà file
snapshot chưa từng thấy) chỉ còn **79 manh mối thật** sau khi trừ phần đã phát;
trong 79 đó, 47 điểm là bè nuôi Hạ Long + phao ven đảo Hải Nam (Trung Quốc) +
bờ Campuchia — tức OSM "vùng biển VN" phần lớn **không phải báo hiệu của VN**.
Chỉ **1 mục** qua được xác minh và vào lớp (Phao 1 luồng Sài Gòn – Vũng Tàu,
án lệ đáng giá hơn con số — xem §3). Phủ tổng nhích 93,0% → **93,1%** (760→761/817),
không tuyến nào tụt. Con đường thật sự tới 57 báo hiệu còn thiếu KHÔNG đi qua
OSM — nó nằm ở ~30 mục sổ AtoN 2016 đang bị cổng trùng-tên/trùng-chỗ của nguồn C
giữ lại, cần một quyết định nghiệp vụ (việc treo, §6).

## 1. Phễu — đếm và in, kể cả số xấu

Chạy `node scripts/osm-manh-moi.mjs --overpass` (2026-09-02):

| Bậc phễu | Số | Ghi chú |
|---|---:|---|
| Điểm OSM snapshot (`seamarks.v1.json`, 2026-08-29) | 5.851 | quá nửa là Hồng Kông – Châu Giang |
| Overpass tươi thêm (cách snapshot ≥50 m) | +121 | gồm 125 điểm `man_made=*` không mang `seamark:type` — snapshot mù trường phái này |
| Trong dải bờ VN (lọc thô) | 278 | |
| Là loại báo hiệu (bỏ cảng/neo/lồng bè/cột mốc) | 164 | bỏ thêm 10 đèn biển lớn — lớp `den-bien` của nhóm khác |
| Đã có trong lớp (<150 m so với vn-aids + den-bien) | 85 | OSM độc lập ĐỒNG THUẬN với 85 vị trí đã phát — nguyên liệu `crossChecks` tương lai |
| **MANH MỐI THẬT** | **79** | |
| Gặp bằng chứng đường a (kho TBHH, ±500 m phao / ±150 m tiêu) | 0 | §4 giải thích vì sao 0 |
| Gặp bằng chứng đường b (sổ AtoN 2016) | 1 | |
| Xác minh được → vào kho nguồn E | **1** | |
| … trong đó cứu hàng toạ độ mập mờ nhờ giả thuyết manh mối | 0 | máy móc có sẵn, chưa gặp ca |
| Manh mối LỖI THỜI (nhà nước đã GỠ, OSM còn vẽ) | 0 | |
| Manh mối treo (không nguồn độc lập nào trong bán kính) | 78 | danh sách in ra mỗi lần chạy |
| Qua cổng generate (nhường chỗ/tên, mồ côi, CJK, vân tay) → **vào lớp** | **1** | |

**Tỉ lệ chốt cho phương án: 79 manh mối → 1 xác minh → 1 vào lớp (1,3%).**
Con số thấp này là DỮ LIỆU, không phải thất bại của quy trình: nó đo đúng độ
phủ thật của OSM trên vùng biển VN — khớp với chẩn đoán cũ ở đầu
`generate-vn-aids.mjs` ("OSM chưa từng theo dõi Việt Nam").

78 manh mối treo, gom theo cụm:

| Cụm | Số | Bản chất |
|---|---:|---|
| Vịnh Hạ Long 20,71–20,76°B | 28 | cọc/bè nuôi trồng + phao du lịch — không phải báo hiệu Cục HH, không cơ quan nào công bố toạ độ |
| Ven đảo Hải Nam 108,6°Đ · 18,5–19,6°B | 19 | **phao luồng Trung Quốc** — OSM gắn chúng vào cùng bể "biển Đông"; chép thẳng là ăn nguyên rác chủ quyền |
| Bờ Campuchia (Kep/Sihanoukville) | 4+1 | ngoài phạm vi |
| Sông nội thuỷ Nam Định/Ninh Bình | 4 | báo hiệu đường thuỷ nội địa (VIWA), không thuộc lớp hàng hải |
| Vũng Tàu–Ngã Bảy | 4 | phao thật khả nghi nhưng kho TBHH không có tin trong 500 m |
| Đà Nẵng (sông Hàn) 2 · Cửa Lò 2 · Cam Ranh 1 · Côn Đảo 1 · Quy Nhơn/Phú Yên 2 · Lý Sơn 4 · lẻ khác 8 | 20 | gần nhất cách bằng chứng 200–700 m — ngoài bán kính dò, không đoán |

## 2. Thước kiem:phu — TRƯỚC / SAU

| Chỉ số | Trước | Sau |
|---|---|---|
| Phủ tổng sổ nhà nước | 93,0% (760/817) | **93,1% (761/817)** |
| Sài Gòn – Vũng Tàu | 109/112 (97%) | **110/112 (98%)** |
| 9 tuyến hụt còn lại (Đồng Nai, Hà Tiên, An Thới, Nha Trang, Phú Quý, Năm Căn, QCB, Bến Đầm, Côn Đảo, Sông Dừa) | — | **không đổi — OSM không có một manh mối nào trong bán kính dò của chúng** (đo thật, §1) |
| Đèn biển | 94/94 | 94/94 |
| Tuyến nào tụt | — | không |

Ghi chú lần sinh lại: trang ENC #4 (Hòn Gai – Cái Lân) giữa hai lần đọc **mất
toạ độ** của hàng "ĐT Hòn Miều" (ô trống) — bộ lọc `badCoord` bắt được và loại,
tổng của thước không đổi vì tuyến đó không nằm trong 22 hàng có số công bố.
Nguồn ENC là trang sống, đổi không báo — thêm một lý do cho nhịp cập nhật
theo lớp của phương án.

## 3. Mục vào lớp duy nhất — và vì sao nó đáng giá hơn con số 1

**Phao 1, luồng Sài Gòn – Vũng Tàu** `[10,413222 / 107,02075]`:

- Sổ AtoN 2016 có "Buoy 1" của tuyến này (trang sổ, `Fl (2+1) G 10s`), nhưng
  **cổng trùng-số-hiệu của nguồn C đã vứt nó**: "Phao 1" luồng **Sông Dinh**
  đứng cách 3,45 km, và luật "<5 km cùng tên = cùng vật" không phân biệt được
  hai cửa luồng chung một vịnh.
- Manh mối OSM (`buoy_lateral`) đứng cách vị trí sổ **226 m** — nguồn thứ hai,
  độc lập, đồng ý rằng ở đó có một phao thật.
- Vào lớp với `prov.origin = vms-south-aton-list` (toạ độ, tên, đặc tính đèn
  **của sổ**), `crossChecks = [{source:"osm", agreed:true, offsetM:226}]`,
  mang cờ tuổi "vị trí theo sổ 2016" như mọi mục gốc sổ.

Luật rút ra, đã thành mã ở NGUỒN E của `generate-vn-aids.mjs`: trùng số hiệu
<5 km **cùng tuyến** vẫn chặn như cũ; **khác tuyến** thì cho qua KHI VÀ CHỈ KHI
mục đó qua xác minh kép (nguồn nhà nước + OSM đồng thuận vị trí). Đây không
phải nới cổng đại trà — vòng chạy này chỉ đúng 1 mục hưởng luật đó.

## 4. Vì sao đường a (kho TBHH) ra 0

Không phải kho rỗng: bộ đọc chung (`scripts/lib/tbhh-doc.mjs`, tách từ nguồn B)
bóc được 258 tin báo hiệu → **664 hàng toạ độ rõ + 7 hàng mập mờ**, phủ từ 7°B
tới 21°B. Đo khoảng cách từ 78 manh mối treo tới bằng chứng gần nhất (mọi
đường): 44 điểm cách **>5 km**, chỉ 3 điểm lọt vào 200–500 m và đều trượt vì
đúng luật — ví dụ manh mối `light_minor` Cửa Lò cách "Phao B-NI" (LẬP 2025)
413 m: quá bán kính tiêu (150 m) và **sai dạng vật** (phao ≠ đèn). Bộ so khớp
có kiểm dạng vật (`dangKhop`) chính vì vòng chạy đầu suýt tính "Front A1"
(chập tiêu) là xác minh cho một manh mối PHAO.

Máy phân xử hàng mập mờ (≥2 cách đọc do chữ số bị chẻ → chọn cách đọc duy nhất
rơi vào bán kính manh mối) đã dựng và test, nhưng 7 hàng mập mờ của kho đều
nằm xa mọi manh mối — **chưa có ca thật nào dùng tới**. Giữ máy: nó là phần
tái dùng được cho mọi nguồn giả thuyết sau này (không riêng OSM).

## 5. Đường d — Sentinel-2: thử 9 ô, 0/5 ứng viên đạt

Chuỗi kỹ thuật **chạy được, không cần khoá**: STAC `earth-search` (element84)
→ COG TCI công khai trên S3 → cắt ô ±170 m. Chín ô đã cắt và soi mắt
(2026-09-02, cảnh 2026-04→08, mây <15%):

| Ô | Kết quả |
|---|---|
| Chứng dương 1 — ĐT A Phà Rừng (chập tiêu trên bờ) | KHÔNG kết luận được: tiêu lẫn trong nhà cửa ven sông |
| Chứng dương 2+3 — Tiêu 9/12 kênh Quan Chánh Bố | thấy RÕ **đê chắn cát** (công trình dạng tuyến, sáng, dài); tiêu đơn lẻ trên đê **không tách được** khỏi đê |
| Chứng âm — biển mở 20,6°B/107,3°Đ | sạch, không giả-dương |
| 5 ứng viên (Hạ Long ×2, Cam Ranh, Côn Đảo, Cửa Lò) | 0/5 có "khối sáng đúng chỗ" tách bạch — nền là bè nuôi, bờ xây dựng, hoặc mây |

Kết luận cho phương án (khớp và **chặt hơn** §3.2 của
[phuong-phap-nha-san-xuat-2026-09.md](phuong-phap-nha-san-xuat-2026-09.md)):
ở 10 m/px, Sentinel-2 xác minh được **công trình ≥2 pixel đứng một mình giữa
nước** (đê, giàn, đảo nổi, đèn biển trên mỏm trơ trọi) — còn đăng tiêu/đèn
luồng cỡ vài mét, hoặc đứng trong bối cảnh bờ/bè, thì KHÔNG. Mục 4-#5 của
phương án ("xác minh Sentinel-2 cho 90 đèn + đăng tiêu") nên hạ kỳ vọng xuống
đúng nhóm đèn biển trơ trọi; phần còn lại đi đường giấy chéo nhau.

## 6. Việc treo — con đường THẬT tới 57 báo hiệu còn thiếu

Chẩn đoán bằng chính vòng chạy này (đối chiếu sổ AtoN với lớp, từng tuyến hụt):
phần lớn số thiếu **đã nằm trong sổ 2016** và đang bị hai cổng của nguồn C giữ:

| Tuyến hụt | Thiếu | Mục sổ đang bị cổng giữ | Cổng nào |
|---|---:|---:|---|
| Đồng Nai | 10 | 17 phao + 2 tiêu cùng mang tên đợt "QG151" + 1 signpost | trùng-tên <5 km (một TÊN ĐỢT dán cho cả dãy phao — luật "cùng tên = cùng vật" sai ở đây) |
| Hà Tiên | 4 | 3 (Phao 2/6/10) | trùng-chỗ <150 m với phao SỔ đứng cạnh (cặp phao đối xứng cửa luồng hẹp cách nhau ~120–140 m) |
| An Thới | 2 | 3 | như trên + 1 "Beacon, South" |
| Nha Trang | 3 | 2 (Phao 2/4) | trùng-tên cùng tuyến — có thể là phao ĐÃ DỊCH (cần TBHH phân xử) |
| Phú Quý | 2 | 2 (mất tên) | trùng-chỗ <150 m |
| Năm Căn | 2 | 2 | trùng-tên với tin TBHH NGƯNG + trùng-chỗ |
| QCB | 10 | 0 | sổ chỉ có 65, đã vào 55 — phần thiếu nằm ở tin TBHH chưa bóc được bảng |

Đây là **quyết định nghiệp vụ**, không phải việc kỹ thuật: cổng trùng-tên/trùng-chỗ
của nguồn C tồn tại để chặn OCR rác và phao-dịch-chuyển đếm đôi; mở nó cho các
ca trên cần một luật tường minh (ví dụ: cặp phao đối xứng — cùng tuyến, khác
màu đèn, <150 m — là HAI vật; tên đợt "QG151" không phải số hiệu). Không tự
quyết trong nhiệm vụ này — **đừng nới cổng để đạt số**. Chuyển Lead cùng số đo.

Việc treo nhỏ hơn: 85 điểm OSM đồng thuận vị trí với lớp đã phát (<150 m) —
có thể quay lại thành `crossChecks {source:"osm"}` gắn lên từng mục đã có,
tăng `confidenceOf` mà không đổi một toạ độ nào.

## 7. Lỗi im lặng bắt được trong vòng chạy

1. **Pipeline không lũy đẳng** (đã sửa): sau một lần generate, mục nguồn E nằm
   trong lớp; chạy lại `osm-manh-moi.mjs` thấy nó "đã phát" → ghi kho RỖNG →
   lần generate kế tiếp âm thầm rút mục khỏi bản đồ. Sửa: tập "đã phát" loại
   các tuyến `xm-*` (không tự nhìn vết chân mình); test
   `vn-aids: nguồn E … có mặt` chặn tái phát.
2. **"Biển VN" của OSM chứa phao Trung Quốc**: 19 manh mối 18,5–19,6°B/108,6°Đ
   là luồng ven Hải Nam. Mọi đường tắt "chép OSM cho nhanh" sẽ ăn nguyên cụm
   này — bằng chứng sống cho luật manh-mối-phải-xác-minh.
3. **Snapshot seamark mù một nửa OSM**: 125 công trình `man_made=lighthouse|beacon`
   không mang `seamark:type`, `generate-seamarks.mjs` không hề thấy. Manh mối
   giờ hỏi cả hai trường phái tag.
4. **Suýt xác minh chéo dạng vật**: "Front A1" (tiêu) làm chứng cho manh mối
   PHAO cách 398 m — chặn bằng luật `dangKhop` (phao chứng cho phao, tiêu cho tiêu).
5. **Nguồn ENC đổi giữa hai lần đọc** (ĐT Hòn Miều mất toạ độ) — xem §2.
6. Overpass trả **406** cho client thiếu `User-Agent` và **504** lúc tải nặng —
   khai danh + ba gương (cùng danh sách `generate-seamarks.mjs`).

## 8. Sở hữu / cách chạy lại

```
node scripts/osm-manh-moi.mjs --overpass   # phễu + ghi <tmp>/sdfish-osm-manh-moi/xac-minh.json
node scripts/generate-vn-aids.mjs          # nguồn A(mạng) + B + C + E → public/data/vn-aids.v1.json
npm run kiem:phu                           # thước phủ — không được tụt
```

Kho vào/ra đều NGOÀI repo (luật chống phình #5). Bộ đọc kho TBHH dùng chung
nằm ở `scripts/lib/tbhh-doc.mjs` (tách từ nguồn B, không chép — cùng lý do
`scripts/lib/pdf-text.mjs`). Test giữ luật: `src/lib/__tests__/vn-aids.test.ts`
khối "nguồn E" — origin không bao giờ là OSM/ODbL, crossCheck OSM ≤500 m,
nghĩa vụ cờ tuổi/trạng thái đi theo nguồn xác minh.

## Assumptions

- Bán kính dò ±500 m (phao) / ±150 m (tiêu) lấy nguyên văn từ brief của chủ
  dự án; chưa có căn cứ để nới, và §4 cho thấy nới cũng không đổi kết quả
  (bậc kế tiếp của phân bố khoảng cách là >5 km).
- Ngày manh mối snapshot ghi theo ngày chốt file `seamarks.v1.json`
  (2026-08-29); crossCheck ghi ngày CHẠY xác minh.
- Điểm `man_made=lighthouse` không kèm `seamark:type` nhận vai `light_minor`
  (đèn nhỏ/tiêu) khi làm manh mối — nếu thực chất là đèn biển lớn, nó nằm
  cạnh lớp den-bien và bị lọc "đã có" trước khi tới bước xác minh.
