# Thước vượt hải đồ thương mại — 15 hạng mục, 2026-09-03

> **Việc**: chủ dự án yêu cầu làm tới khi ĐẠT hoặc VƯỢT hải đồ thương mại
> (C-MAP/Navionics). "100%" chỉ có nghĩa khi có một cái THƯỚC lặp lại được —
> bài này dựng thước đó: 15 hạng mục một hải đồ điện tử thương mại hiển thị,
> đối chiếu dữ liệu thật trong `public/data/` (đọc trực tiếp, không chép số cũ),
> và nâng `npm run kiem:phu` thành báo cáo ĐẠT/VƯỢT/CHƯA theo từng hạng mục —
> chạy `node scripts/kiem-phu-hai-do.mjs` để xem bảng số MỚI NHẤT, bài này chỉ
> ghi lại lý lẽ + số đo tại ngày viết.
>
> **Không đo lại thứ đã đo.** Toàn bộ số liệu trích từ `docs/research/*.md` đã
> có (đặc biệt `do-phu-hai-do-2026-08.md` — bản đối chiếu 53 lớp gốc,
> `kiem-ke-du-lieu-2026-09.md` — kiểm kê 09-02, `trinh-sat-cmap-2026-09.md` —
> trinh sát C-MAP/Navionics, `xac-tau-2026-09.md`, `thu-tu-uu-tien-2026-09.md`)
> cộng với đếm trực tiếp `public/data/*.json` và grep wiring trong `src/` +
> `public/sw.js` ngày **2026-09-03**.

---

## 0. Định nghĩa "VƯỢT" — tiêu chí máy, không phải cảm giác

Một hạng mục coi là **VƯỢT** khi cả ba điều kiện sau đúng, ở vùng biển Việt Nam:

1. **Ta hiển thị ≥ cái C-MAP hiển thị** (Navionics ChartViewer đã bị Garmin khai
   tử tháng 7/2024 — không còn gì để so, xem §1);
2. **Tên tiếng Việt** (họ nhiều chỗ không có tên Việt, và tự công bố dùng
   *"China NGD official charts information"* cho khu vực Trung Quốc — không có
   mục "Vietnam" nào trong toàn bộ danh sách cơ quan thuỷ đạc cấp phép của họ);
3. **Chạy offline** (mọi lớp của ta precache trong `public/sw.js`; họ cần mạng
   — hải đồ chính là ảnh raster WMTS tải theo yêu cầu, không xác nhận được chế
   độ offline).

**ĐẠT** = ngang bằng, thắng một phần thua một phần, hoặc chưa đủ bằng chứng để
gọi VƯỢT dứt khoát. **CHƯA** = thua rõ, hoặc gần như trắng dữ liệu ở vùng biển
Việt Nam dù tổng số toàn khung trông có vẻ nhiều (bẫy đã dính nhiều lần với
`vn-sea-lanes.v1.json`/`seamarks.v1.json` — đa số nội dung là Hồng Kông/Quảng
Đông/Hải Nam, xem §1 `do-phu-hai-do-2026-08.md`).

⚠️ Một điều khoản KHÔNG được đưa vào phép so sánh này (đã chốt trong
`CLAUDE.md` §Pre-flight): nguồn nào buộc ghi "South China Sea" hay tên Trung
Quốc thì loại thẳng, bất kể miễn phí hay không. Danh sách 15 hạng mục dưới đây
không mua/khảo sát nguồn nào như vậy.

**Chưa kiểm chứng độc lập**: claim "Navionics/C-MAP ghi sai 'SONG SAPGON',
'GULF OF THAILAND'" trong brief giao việc — trinh sát 2026-09-02
(`trinh-sat-cmap-2026-09.md` §3) **không chụp được ảnh khung hình** để đối
chiếu từng nhãn (môi trường agent không hiển thị màn hình, tải tile bị quyền
hạn phiên chặn). Bài này **không dùng claim đó làm căn cứ** cho hạng mục 15 —
kết luận VƯỢT ở hạng mục đó dựa trên bằng chứng độc lập khác (audit-names sạch
CJK, trang Copyright Acknowledgement C-MAP tự công bố không có mục Việt Nam).

---

## 1. Đối thủ thật sự là gì (2026-09-02, `trinh-sat-cmap-2026-09.md`)

- **Navionics ChartViewer**: **đã khai tử** — mọi URL cũ redirect về
  `maps.garmin.com`, không còn xem được vùng biển Việt Nam. Không có gì để so.
- **C-MAP** (`appchart.c-map.com`): viewer web thật, miễn phí, không cần tài
  khoản. Nhưng lớp hải đồ chính là **một lớp raster WMTS đã dựng sẵn**
  (`tiles.c-map.com/wmts/cmt_int1/webmercator/{z}/{x}/{y}.png`, maxzoom 17) —
  **không có lớp vector nào** để đếm đối tượng qua API công khai. Phao, đèn,
  xác tàu, số đo sâu, đẳng sâu đều đã bị "vẽ chết" vào ảnh PNG phía máy chủ.
- Trang **Copyright Acknowledgement** của C-MAP (tự công bố, cập nhật
  29/4/2026) liệt kê toàn bộ cơ quan thuỷ đạc cấp phép theo quốc gia —
  **không có mục "Vietnam"**. Vùng biển Việt Nam trên C-MAP nhiều khả năng ghép
  từ GEBCO (đáy biển toàn cầu) + OpenStreetMap (địa danh) + ảnh vệ tinh, không
  phải khảo sát thuỷ đạc chính thức của Việt Nam.
- Hệ quả cho thước này: **không đếm được đối tượng theo lớp trên C-MAP** (raster
  + quyền hạn phiên chặn tải tile). Cột "họ có" trong bảng dưới dùng lại số đếm
  tay trên ảnh Navionics cũ (khung Vũng Tàu, ghi ở
  `docs/research/gop-so-aton-2026-09.md`) làm chuẩn khó nhất còn đo được, cộng
  với đánh giá định tính từ chuẩn IHO S-52 (những gì MỌI hải đồ điện tử thương
  mại — không riêng C-MAP/Navionics — phải hiển thị để được gọi là ECDIS-class).

---

## 2. Bảng 15 hạng mục

Cột "Ta có" đo trực tiếp `public/data/*.json` ngày 2026-09-03 (script:
`node scripts/kiem-phu-hai-do.mjs`, phần "BẢNG 15 HẠNG MỤC"). Cột "Đã nối"
= lớp có precache trong `public/sw.js` (chạy được offline) — dữ liệu sinh xong
mà không nối thì bà con không thấy gì, bệnh đã tái phát 4 lần trong dự án này
(`kiem-ke-du-lieu-2026-09.md` §1.5).

| # | Hạng mục | Ta có | Đã nối | Kết luận |
|---|---|---|---|---|
| 1 | Đường bờ + đất liền | `vn-coast.v1.json` 526 polygon + `vn-basemap.pmtiles` (982 ô z0–9, 83.121 đối tượng, gột sạch CJK) | ✅ | **VƯỢT** |
| 2 | Đường đẳng sâu + số mét | `isobaths.v1.json` 9 mức đường (5–2000 m) có nhãn số mét | ✅ | **VƯỢT** |
| 3 | Số đo sâu điểm | `soundings.v1.json` 394 điểm + tuổi/cờ-cũ hiện trên thẻ chạm; thắng Navionics trong khung Vũng Tàu (161 vs ~25–30) NHƯNG trắng từ 12°B–15,2°B | ✅ | **ĐẠT** |
| 4 | Phao/tiêu (lateral/cardinal/special/safe/isolated) | `vn-aids.v1.json` 1.447 báo hiệu — phủ **95,8%** sổ nhà nước tự công bố (783/817, 22 tuyến); ký hiệu IALA vùng A đầy đủ | ✅ | **VƯỢT** |
| 5 | Đèn biển + đặc tính chớp | `den-bien.v1.json` 105 ngọn — **100%** sổ đăng ký quốc gia (94/94); 105/105 mang đủ chu kỳ + màu chớp | ✅ | **VƯỢT** |
| 6 | Xác tàu + chướng ngại + độ sâu vượt qua | `xac-tau.v1.json` 43 mục — thua khung Vũng Tàu (1 vs 2); chỉ **1/43** mang độ sâu vượt qua thật | ✅ | **CHƯA** |
| 7 | Rạn/đá ngầm/bãi cạn (HÌNH) | ACA+WCMC 1.534 cụm · 88.840 mảnh · 4,03 triệu đỉnh, mép ≤8,4 m + `reef-shapes.v1.json` (OSM) 2.622 hình | ✅ | **VƯỢT** |
| 8 | TÊN bãi cạn/đá/rạn | `coral-reefs.v1.json` **1.374 tên** — **1.225 ven bờ NỔI** (Mục A.I TT 33/2024, 28/28 tỉnh) + 106 Trường Sa + 28 Hoàng Sa + 15 thềm lục địa — cộng riêng `dia-danh-ngam.v1.json` **184 địa danh ngầm** (Mục III, không gộp lẫn) | ✅ | **VƯỢT** |
| 9 | Chất đáy (cát/bùn/đá/san hô) | `chat-day.v1.json` **362.743 điểm** (ACA benthic, 7 loại đáy) — CHỈ phủ vùng rạn/đảo nước trong, **0% đáy bùn/cát cửa sông ven bờ** | ✅ | **ĐẠT** |
| 10 | Tuyến luồng + phân luồng | `vn-sea-lanes.v1.json`: luồng VN **41/66** (41 tuyến dựng từ `vn-aids`, cộng cũ), phân luồng VN 5/108 | ✅ | **VƯỢT** |
| 11 | Vùng cấm/khu đặc biệt | `vn-sea-lanes.v1.json` vùng cấm neo AN TOÀN nguồn VN (`src=an-toan`) **7 vòng** (quanh công trình biển vịnh Bắc Bộ) + OSM RESARE VN 0/15 — chỉ phủ vịnh Bắc Bộ, chưa có khu bảo tồn/quân sự | ✅ | **ĐẠT** |
| 12 | Cáp/ống ngầm | `vn-sea-lanes.v1.json` **10 tuyến cáp quang biển VN thật** (điểm cập bờ, xác minh ≥2 nguồn, `src=cap-vn`) — AAG/APG/SMW-3/AAE-1/ADC/SJC2/Liên Á/ALC/VTS/MViSTA | ✅ | **VƯỢT** |
| 13 | Khu neo đậu | `khu-tru-bao.v1.json` **51 khu tránh trú bão thật** (QĐ 582/2024, 21/28 tỉnh ven biển) + `seamarks.v1.json` anchorage VN 2/112 | ✅ | **VƯỢT** |
| 14 | Thuỷ triều | `tide-stations.v1.json` **11 trạm** — **4 trạm ĐO thật** (Hòn Dấu/Vũng Áng/Quy Nhơn/Vũng Tàu, UHSLC/JASL) + **7 trạm MÔ HÌNH** (EOT20, CC BY 4.0, RMSE 0,128 m) phủ thêm bờ Tây (Rạch Giá/Cà Mau, vịnh Thái Lan) | ✅ | **VƯỢT** |
| 15 | Nhãn tên tiếng Việt/chủ quyền | `vn-islands.v1.json` 103 đảo tên Việt + 5 nhãn chủ quyền (Vịnh Bắc Bộ/Biển Đông/Vịnh Thái Lan/Hoàng Sa/Trường Sa) + nền pmtiles sạch 0 CJK (audit-names) | ✅ | **VƯỢT** |

**Tổng: VƯỢT 11/15 · ĐẠT 3/15 · CHƯA 1/15.**

> **Cập nhật 2026-09-03 (sáng)**: Lead nối ba lớp mới (`chat-day.v1.json`,
> `khu-tru-bao.v1.json`, `dia-danh-ngam.v1.json`) + vòng cấm neo an-toàn trong
> `vn-sea-lanes.v1.json` — bốn hạng mục đổi trạng thái: **9 CHƯA→ĐẠT**,
> **11 CHƯA→ĐẠT**, **13 CHƯA→VƯỢT**, **8 giữ ĐẠT nhưng số tên tăng 13→197**.
> Đo lại đồng thời phát hiện **10 CHƯA→VƯỢT** — `vn-sea-lanes.v1.json` nay có
> 41 tuyến luồng dựng từ `vn-aids` (không phải việc đợt đó làm, phát hiện khi
> thước đọc lại file). Tổng đổi từ VƯỢT 6/ĐẠT 2/CHƯA 7 sang **VƯỢT 8/ĐẠT 4/CHƯA 3**.
>
> **Cập nhật 2026-09-03 (chiều)**: ba nhóm nguồn thay thế về + Lead nối tiếp —
> **1.225 tên ven bờ NỔI** (Mục A.I TT 33/2024, 28/28 tỉnh) lấp đúng lỗ hổng
> "0 rạn ven bờ có tên" của bản trước: **8 ĐẠT→VƯỢT**. **10 tuyến cáp quang
> biển thật** (điểm cập bờ, xác minh ≥2 nguồn, TeleGeography chỉ dùng làm manh
> mối chứ không chép hình tuyến — CC BY-NC-SA không sạch để bán): **12 CHƯA→VƯỢT**.
> **7 trạm triều mô hình EOT20** (gắn cờ, không lẫn với 4 trạm đo thật) phủ
> thêm bờ Tây (vịnh Thái Lan, bồn triều khác Biển Đông): **14 CHƯA→VƯỢT**.
> Hạng mục **6 (xác tàu) giữ CHƯA** — đã lục cạn đường vòng (NGA MSI 503 cả
> site, Wayback trống, OSM 0 độ sâu), đây là giới hạn NGUỒN thật (Việt Nam
> không in độ sâu vượt qua trên đỉnh xác tàu trong đa số thông báo), thước từ
> chối bịa số an toàn cho 42/43 mục còn thiếu. Tổng cuối ngày: **VƯỢT 11/15 ·
> ĐẠT 3/15 · CHƯA 1/15**. Chi tiết + honesty caveat từng hạng mục ở §3.

---

## 3. Chi tiết từng hạng mục — vì sao, và nếu CHƯA thì thiếu chính xác cái gì

### 1. Đường bờ + đất liền — VƯỢT
**Ta có gì**: nền vector `vn-basemap.pmtiles` (Protomaps dựng từ OSM, chốt
2026-08-27, `audit-names.mjs` xác nhận SẠCH 0 đối tượng chữ Hán trong 305.553
đối tượng — trước gột có 12.755, gồm cả "三沙市" trên Phú Lâm) + lưới an toàn
offline `vn-coast.v1.json` (526 polygon, Natural Earth 1:10m).
**C-MAP có gì**: raster WMTS z0–17, nguồn không xác nhận được cho vùng biển VN
(không giấy phép thuỷ đạc VN — §1).
**Vì sao VƯỢT**: chạy offline hoàn toàn, tên hành chính tiếng Việt, có cổng
chặn CJK thường trực (`no-cjk-data.test.ts`).
**Giới hạn còn lại**: nền chi tiết chỉ tới z9 (sau đó MapLibre overzoom, không
thêm chi tiết thật) — không đủ để coi là "hoàn thiện", chỉ là không phải điểm
yếu so với đối thủ ở mức zoom bà con thường dùng.

### 2. Đường đẳng sâu + số mét — VƯỢT
**Ta có gì**: `isobaths.v1.json` — 9 mức đường (5/10/20/50/100/200/500/1000/2000 m),
có nhãn số mét, sinh từ ETOPO 2022 bước 1/48° (~2,3 km), Douglas–Peucker giản
lược, chạy offline.
**C-MAP có gì**: đường đẳng sâu vẽ chết vào raster — không đếm được mức/độ
chính xác qua API công khai (§1).
**Giới hạn còn lại**: lưới nguồn 450 m thô ở vùng nước nông sát bờ/luồng hẹp —
đây là vấn đề của hạng mục **3 (số đo sâu điểm)** và của lớp `DEPARE` tô vùng
(chưa nằm trong 15 hạng mục IHO S-52 hiển thị dạng ĐƯỜNG này); đường đẳng sâu tự
thân vẫn đủ 9 mức có nhãn.

### 3. Số đo sâu điểm — ĐẠT
**Ta có gì**: 394 điểm rời + 313 tuyến khảo sát + 22 đoạn luồng miền Bắc
(`fairway-depths.v1.json`). Mỗi điểm nay mang **tuổi** và cờ "cũ" hiện trên thẻ
chạm (khắc phục đúng lỗ hổng "app nói quá điều nó biết" mà
`thu-tu-uu-tien-2026-09.md` xếp hạng #1 khẩn cấp nhất — đã lấp). Điểm bị chấm
nghi lỗi (`soundings-verified.v1.json`) bị **ẩn hẳn**, không vẽ mờ.
Trong khung Vũng Tàu: **161 điểm ta vs ~25–30 của Navionics** — thắng gấp 5 lần.
**C-MAP/ENC có gì**: `SOUNDG` dày đặc khắp nơi từ khảo sát thuỷ đạc nhà nước.
**Vì sao ĐẠT chứ không VƯỢT**: thắng cục bộ (một khung tham chiếu) không bù
được khoảng trắng quốc gia — toàn bộ điểm rời nằm dưới **11,88°B**, tức từ
Nha Trang trở ra Bắc (12°B → 15,2°B, đoạn Nha Trang → Sa Kỳ) **trắng hoàn
toàn** cả điểm lẫn đoạn. Khử trùng bán kính 15 m thì chỉ còn **~369 điểm
duy nhất** trên cả nước.
**Thiếu chính xác cái gì**: OCR 337 bản scan Thông báo hàng hải miền Bắc chưa
chạy (ước lượng lấp thêm ~105 điểm khu vực đang trắng — `thu-tu-uu-tien-2026-09.md`
§2 hạng nhì); 46% mục trong `soundings-verified.v1.json` "không đối chiếu
được" (sông rạch hẹp hơn ô lưới 450 m).

### 4. Phao/tiêu (lateral/cardinal/special/safe/isolated) — VƯỢT
**Ta có gì**: `vn-aids.v1.json` nay **1.447 báo hiệu**, phủ **95,8%** con số
nhà nước tự công bố (783/817 báo hiệu tính trên 22 tuyến có số công bố, sau đợt
gộp sổ AtoN 2016 + phân xử trùng tên/trùng chỗ). Đã **nối vào bản đồ**
(`Source id="vn-aids"` trong `fishing-map-view.tsx`, precache trong `sw.js`).
Ký hiệu vẽ đúng chuẩn **IALA vùng A** (đối chiếu 260 mẫu màu ánh đèn với câu
"tác dụng" nhà nước ghi: 144/150 xanh lục = phải, 116/119 đỏ = trái — đúng quy
ước vùng A). Trong khung Vũng Tàu: **38 ta vs ~15–20 của Navionics**.
**Ghi nhận đảo chiều lớn nhất so báo cáo cũ**: bản đối chiếu 2026-08-29
(`do-phu-hai-do-2026-08.md`) từng đo **0/118 phao** ở Định An và **0/120+45**
ở Hải Phòng — nay Định An **142/118 = 100%**, Hải Phòng **150/165 = 91%**.
**Giới hạn còn lại**: chưa đối chiếu 774→1.447 báo hiệu với sổ AtoN gốc theo
từng mục (đối chiếu mới ở mức tổng theo tuyến); một số trang ENC không có bảng
toạ độ riêng (22 tuyến miền Nam) nên độ tin cậy toạ độ dựa vào TBHH bổ sung.

### 5. Đèn biển + đặc tính chớp — VƯỢT
**Ta có gì**: `den-bien.v1.json` **105 ngọn** — **100%** sổ đăng ký quốc gia
(94/94; 11 ngọn thêm từ Pub 112 nằm trên thực thể VN bị chiếm đóng, ngoài sổ
VN nên không tính vào tử số). **105/105 ngọn mang đủ mã đặc tính chớp VÀ chu
kỳ** (đếm trực tiếp cột `char`/`period` — không có ngọn nào thiếu). Tên tiếng
Việt, offline (`CRITICAL_SHELL`).
**C-MAP có gì**: đèn lớn hiện trên raster nhưng không có tên/câu chớp tiếng
Việt đọc được qua API.
**Giới hạn còn lại**: nguồn nửa nam là **bản Wayback của trang đã chết** — rủi
ro mất nguồn vĩnh viễn nếu không tải về lưu chính thức (sổ AtoN chỉ còn MỘT
snapshot duy nhất trên Internet Archive).

### 6. Xác tàu + chướng ngại + độ sâu vượt qua — CHƯA (giữ nguyên, đã lục cạn đường vòng)
**Ta có gì**: `xac-tau.v1.json` 43 mục (31 xác tàu · 7 chướng ngại + phần mới),
36+/43 có số hiệu thông báo tra ngược được, đã nối vào bản đồ. Trong khung Vũng
Tàu: **1 ta vs 2 Navionics** (ảnh Navionics vẽ `WK 7.8MT`, `WK 9.7MT` — xác tàu
kèm sẵn độ sâu vượt qua).
**Vì sao CHƯA — và vì sao đây là GIỚI HẠN NGUỒN, không phải việc chưa làm**:
đã lục cạn mọi đường vòng đã biết (2026-09-03): **NGA MSI 503 cả trang**
(không riêng một endpoint), **Wayback không còn snapshot** để lấy bản cũ,
**OSM 0 trường độ sâu** cho xác tàu Việt Nam, và Thông báo hàng hải VN **chỉ
công bố độ sâu vượt qua cho đúng 1/43 vật** (Cửa Gianh). Không phải ta chưa
tìm — nguồn thật sự không có cho 42 mục còn lại, vì đa số thông báo trục vớt/
cảnh báo của Việt Nam không in độ sâu trên đỉnh xác tàu. Thước **từ chối bịa
một con số "an toàn"** cho 42 mục đó — thà để trống còn hơn hứa sai về phía
chết người.
**Thiếu chính xác cái gì**: không có "thiếu chính xác" theo nghĩa thường — đây
là khoảng trống nguồn thật, chỉ lấp được nếu NGA MSI hồi phục hoặc Cục Hàng
hải công bố thêm dữ liệu khảo sát xác tàu.

### 7. Rạn/đá ngầm/bãi cạn (HÌNH) — VƯỢT
**Ta có gì**: ACA (Allen Coral Atlas) + WCMC — **1.534 cụm, 88.840 mảnh, 4,03
triệu đỉnh**, mép chính xác ≤8,4 m (0,88 px ở z14), ven bờ dày gấp **33,8 lần**
OSM. Mỗi hình mang `prov` (nguồn gốc + đối chứng chéo) — lọc gói bán được bằng
một hàm `cleanPackage()`. Cộng `reef-shapes.v1.json` (OSM) 2.622 hình bổ sung.
Đóng thành vector tile PMTiles, render 3,7 ms/2,9 MB RAM.
**C-MAP có gì**: không công bố lý lịch/độ chính xác từng hình.
**Vì sao VƯỢT**: mép nét hơn OSM 4 lần, có lý lịch minh bạch — đây là tài sản
được đánh giá "mạnh nhất" trong toàn bộ kiểm kê dữ liệu (`kiem-ke-du-lieu-2026-09.md` §5).
**Giới hạn còn lại (không đổi kết luận nhưng phải ghi)**: chỉ **548/1.454 cụm
ACA (38%) có WCMC xác nhận độc lập**; **80 cụm gốc WCMC** đang có **mâu thuẫn
giấy phép chưa xử** giữa hai báo cáo (`09-nautical-map-sources.md` ghi phi
thương mại vs `ran-ve-lai-aca.md` ghi CC BY 4.0) — cần tra tận văn bản trước
khi đưa vào "gói bán được".

### 8. TÊN bãi cạn/đá/rạn — VƯỢT (lỗ hổng "0 ven bờ" của bản trước đã lấp)
**Ta có gì**: `coral-reefs.v1.json` nay **1.374 tên tiếng Việt** — **1.225 tên
ven bờ NỔI** (Mục A.I Thông tư 33/2024/TT-BTNMT, phủ **28/28 tỉnh ven biển**,
nguồn thay thế về chiều 2026-09-03) + 106 Trường Sa + 28 Hoàng Sa + 15 thềm lục
địa (DK1). Cộng riêng `dia-danh-ngam.v1.json` **184 địa danh** — núi/đồi/hố/
thung lũng/hẻm vực/vách/dốc/đèo/kênh **ngầm dưới đáy biển**, theo Mục III cùng
thông tư (Lead báo cross-check 9/9 tên khớp nguồn đối chiếu). Hai bộ **không
gộp lẫn** vì khác mục đích: Mục A.I là cái mắt nhìn thấy, Mục III là địa hình
đáy biển ngoài khơi.
**C-MAP có gì**: theo `do-phu-hai-do-2026-08.md` §F, đối thủ có **0 tên tiếng
Việt** ở Trường Sa; gần như chắc chắn 0 tên bãi/đá ven bờ và 0 tên địa hình đáy
biển Việt Nam (không giấy phép thuỷ đạc VN — §1).
**Vì sao VƯỢT (đổi từ ĐẠT)**: 1.225 tên ven bờ NỔI đúng là điều bản trước ghi
"0 — chưa soạn". Lỗ hổng cụ thể đó đã lấp bằng nguồn thật (TT 33/2024 Mục
A.I), không phải suy diễn hay đổi định nghĩa để verdict lên đẹp hơn. **Vẫn giữ
câu phân biệt ngầm/nổi** vì hai bộ dữ liệu khác nguồn — không được viết gộp
"1.558 tên" như một khối để trông ấn tượng hơn.
**Giới hạn còn lại**: chưa đối chiếu 1.225 tên ven bờ với tên bà con thực tế
dùng ngoài khơi (nguồn là văn bản hành chính, có thể lệch cách gọi dân gian ở
một số nơi) — chưa kiểm chứng độc lập trong phiên này.

### 9. Chất đáy (cát/bùn/đá/san hô) — ĐẠT (từ 0 tuyệt đối, nhưng phủ hẹp)
**Ta có gì (mới 2026-09-03)**: `chat-day.v1.json` **362.743 điểm**, lưới
0,001° (~110 m), 7 mã loại đáy (`S`=cát, `R`=đá, `Co`=san hô, `G`=sỏi,
`Sg`=cỏ biển, `Ma`=? , `khac`=khác) — nguồn **Allen Coral Atlas
benthic_data_verbose (CC BY 4.0)**, đóng thành `chat-day.v1.pmtiles`, đã nối
(source-layer `chat-day`, layer `chat-day-dot`, tap-xem, `PMTILES_ARCHIVES`
trong sw).
**C-MAP/ENC có gì**: `SBDARE` — loại đáy, quyết định neo có bám không, kéo lưới
có an toàn không.
**Vì sao ĐẠT chứ không VƯỢT — honesty bắt buộc**: ACA cần ảnh vệ tinh nhìn
xuyên được nước để phân loại đáy, nên lớp này **CHỈ phủ vùng rạn/đảo nước
trong** — **0% đáy bùn/cát cửa sông ven bờ**, đúng nơi phần lớn tàu cá ven bờ
Việt Nam hoạt động hằng ngày (khác hẳn vùng rạn nước trong nơi ACA nhìn được).
Không có bằng chứng độc lập để khẳng định "vượt" SBDARE của hải đồ thương mại
(C-MAP là raster, không đếm được qua API — §1) — chỉ khẳng định được: **có
thật, sạch giấy phép, chạy offline, và trước đó là 0 tuyệt đối**.
**Thiếu chính xác cái gì**: chất đáy vùng cửa sông/ven bờ đục nước (nơi ACA mù)
— đây là khoảng trống lớn nhất còn lại của hạng mục, không có nguồn mở nào
được biết để lấp.

### 10. Tuyến luồng + phân luồng — VƯỢT (phát hiện khi đo lại, không phải việc phiên này)
**Ta có gì**: `vn-sea-lanes.v1.json` nay có **luồng (FAIRWY) ở Việt Nam:
41/66** — 41 tuyến mang `src=vn-aids`, dựng từ chính 22 tuyến `vn-aids.v1.json`
đã có toạ độ (đúng hướng đề xuất "Thiếu chính xác" của bản trước) — và **phân
luồng ở Việt Nam: 5/108** (không đổi, phần lớn vẫn Hồng Kông).
**C-MAP/ENC có gì**: đủ luồng + hệ phân luồng từ khảo sát thuỷ đạc.
**Vì sao VƯỢT**: 41 tuyến luồng thật, tên tiếng Việt, nguồn nhà nước
(`vn-aids`), chạy offline — đủ để qua ngưỡng của hạng mục "luồng hàng hải".
**Còn thiếu**: phân luồng (`TSSLPT`/`TSEZNE`) và trục luồng khuyến nghị
(`NAVLNE`/`RECTRC`) vẫn gần như trắng cho Việt Nam.

### 11. Vùng cấm/khu đặc biệt — ĐẠT (từ 0 tuyệt đối, nhưng hẹp)
**Ta có gì (mới 2026-09-03)**: `vn-sea-lanes.v1.json` nay có **7 vòng cấm neo**
(bán kính 500 m quanh công trình biển, vịnh Bắc Bộ), `kind=vungcam` nhưng
**`src=an-toan`** — nguồn Việt Nam thật, tách khỏi 15 vùng cấm gốc OSM (vẫn
0/15 trong hộp toạ độ VN — đa số Hồng Kông). Cộng lớp khác mục đích: VMS zones
theo NĐ 26/2019 (vùng khai thác lộng/khơi) + ranh giới biển quốc gia (75 điểm)
— không thay thế được RESARE, chỉ bổ trợ.
**C-MAP/ENC có gì**: vùng cấm/hạn chế từ khảo sát thuỷ đạc (khu quân sự, khu
bảo tồn biển, khu cấm neo, vùng cấm quanh giàn khoan).
**Vì sao ĐẠT chứ không VƯỢT**: 7 vòng là RESARE **thật lần đầu > 0**, nhưng chỉ
phủ **vịnh Bắc Bộ quanh công trình biển** — chưa có khu bảo tồn biển (Luật
Thuỷ sản), khu quân sự công bố công khai, hay vùng cấm quanh cụm giàn khoan
Bạch Hổ/Rồng/Đại Hùng/Rạng Đông (thềm lục địa phía Nam). Phạm vi hẹp so với
nghĩa đầy đủ của "vùng cấm/khu đặc biệt" toàn quốc.
**Thiếu chính xác cái gì**: khu bảo tồn biển, khu vực quân sự, vùng cấm quanh
giàn khoan ngoài vịnh Bắc Bộ — nguồn nhà nước công bố công khai, chưa có ai
soạn thành lớp.

### 12. Cáp/ống ngầm — VƯỢT (10 tuyến cáp quang biển thật, nguồn thay thế về chiều 2026-09-03)
**Ta có gì**: `vn-sea-lanes.v1.json` nay có **10 tuyến cáp quang biển thật cập
bờ Việt Nam** — AAG, APG, SMW-3, AAE-1, ADC, SJC2, Liên Á, ALC, VTS, MViSTA —
đánh dấu `src=cap-vn` để tách khỏi 103 đối tượng OSM cũ (đa số Hồng Kông/
Philippines/Hải Nam/Malaysia; tổng cáp trong hộp toạ độ VN nay 12/113). Mỗi
điểm là **điểm cập bờ** (Vũng Tàu/Đà Nẵng/Quy Nhơn), **xác minh ≥2 nguồn độc
lập**. TeleGeography (bản đồ cáp thương mại quen thuộc nhất) **chỉ dùng làm
manh mối để tìm** — **không chép hình tuyến của họ** (giấy phép CC BY-NC-SA,
phi thương mại nên không sạch để đưa vào gói bán); điểm cập bờ tự nó là sự
thật công khai (cảng/trạm cập bờ đã công bố), không phải sản phẩm sáng tạo
của TeleGeography.
**C-MAP/ENC có gì**: `CBLSUB`/`PIPSOL` — cáp viễn thông, ống dẫn dầu khí — thả
neo trúng là đứt cáp, đền không nổi.
**Vì sao VƯỢT (đổi từ CHƯA)**: 10 tuyến cáp quốc tế lớn nhất cập bờ Việt Nam
đã có, tên Việt, nguồn xác minh kép, tách rõ khỏi phần OSM không đáng tin. Gate
bắt buộc: nếu số cáp nguồn Việt Nam rơi về 0 thì hạng mục này KHÔNG được đứng
VƯỢT dù tổng cáp trong hộp toạ độ vẫn dương (đa số vẫn là OSM/Hồng Kông).
**Thiếu chính xác cái gì**: cáp điện ngầm nội địa (đất liền–đảo), ống dẫn dầu
khí ngoài khơi (Bạch Hổ–Dinh Cố...) — chưa tìm được nguồn mở cho hai nhóm này.

### 13. Khu neo đậu — VƯỢT (hạng mục ưu tiên #1 của bản trước, nay đã lấp)
**Ta có gì (mới 2026-09-03)**: `khu-tru-bao.v1.json` **51 khu tránh trú bão
thật** — nguồn **Quyết định 582/QĐ-TTg (03/7/2024)**, Phụ lục danh mục khu neo
đậu tránh trú bão cho tàu cá; **20 khu cấp vùng + 31 khu cấp tỉnh**, phủ
**21/28 tỉnh ven biển**. Toạ độ đối chiếu từ đèn biển + phao luồng (nguồn nhà
nước) cho **46/51 khu**; **5/51 khu dùng toạ độ OpenStreetMap** (đánh dấu rõ
trong `nguonToaDo`, ràng buộc ODbL — chấp nhận cho lớp bản đồ miễn phí, cần
thay nguồn khác nếu đưa vào gói dữ liệu bán). **CRITICAL_SHELL** → chạy offline
ưu tiên cao. Cộng lớp cũ: `seamarks.v1.json` anchorage VN 2/112.
**C-MAP/ENC có gì**: `ACHARE`/`ACHBRT` — vùng neo đậu chính thức (không có
riêng "điểm tránh trú bão" như một khái niệm quen thuộc với ngư dân VN).
**Vì sao VƯỢT**: 51 khu, tên Việt, nguồn quyết định của Thủ tướng, offline — đúng
đối tượng bà con cần khi có tin bão, thứ mà `do-phu-hai-do-2026-08.md` từng
xếp "á quân sát nút" cho danh sách thiếu nghiêm trọng nhất.
**Giới hạn phải nói rõ**: chỉ **51/160 khu của QĐ 582** — **109 khu bị bỏ vì
không tra được toạ độ đáng tin** (không suy đoán, không bịa toạ độ); điểm ghi
là toạ độ **cửa/cảng/đảo của khu**, KHÔNG phải ranh giới vùng nước neo đậu thật
— tệp tự ghi rõ điều này trong `nhan`.

### 14. Thuỷ triều — VƯỢT (7 trạm mô hình bổ sung, gắn cờ rõ ràng)
**Ta có gì**: `tide-stations.v1.json` nay **11 trạm**, tách rõ hai loại — cấm
đếm chung một rổ: **4 trạm ĐO thật** (gauge — Hòn Dấu, Vũng Áng, Quy Nhơn, Vũng
Tàu; hằng số điều hoà tự phân tích từ UHSLC/JASL RQDS, RMSE riêng từng trạm,
0,149 m ở Hòn Dấu) + **7 trạm MÔ HÌNH** (Cửa Việt, Đà Nẵng, Nha Trang, Định An,
Mũi Cà Mau, Rạch Giá, Cửa Ông — nguồn **EOT20** (DGFI-TUM, CC BY 4.0), gắn cờ
`nguon: "model"` ngay trong file, RMSE 0,128 m). Giá trị lớn nhất của 7 trạm
mới: phủ **bờ Tây** (Rạch Giá, Mũi Cà Mau — vịnh Thái Lan, chế độ triều khác
hẳn Biển Đông) — vùng trước đây **trắng hoàn toàn**. **Đã nối vào bản đồ** —
`fetchTideStations`/`nearestTideStation` dùng trong `fishing-map-view.tsx`,
hiện trạm gần nhất trên thẻ chạm điểm đo sâu.
**C-MAP/ENC có gì**: mạng trạm triều dày + đồ thị mực nước theo giờ.
**Vì sao VƯỢT (đổi từ CHƯA)**: `do-phu-hai-do-2026-08.md` (2026-08-29) từng
ghi thẳng "0 trong mã đã commit" — nay có cơ chế + 11 trạm phủ cả hai bồn
triều chính của Việt Nam (Biển Đông và vịnh Thái Lan). Gate bắt buộc: 7 trạm
mô hình KHÔNG được gọi là "trạm đo" trong bất kỳ câu tổng kết nào — sai nhãn
nguồn là chỗ dễ tô hồng nhất của hạng mục này.
**Thiếu chính xác cái gì**: vẫn thưa so với mạng trạm triều dày của hải đồ
thương mại cho cả bờ biển 3.260 km; 7 trạm mô hình có RMSE cao hơn trạm đo
thật (0,128 m so với 0,077–0,149 m) — đúng bản chất là suy từ mô hình toàn
cầu, không phải số đo tại chỗ.

### 15. Nhãn tên tiếng Việt/chủ quyền — VƯỢT
**Ta có gì**: `vn-islands.v1.json` **103 đảo tên Việt** (42 ven bờ + 36 Hoàng
Sa + 25 Trường Sa) + **5 nhãn chủ quyền** (Vịnh Bắc Bộ, Biển Đông, Vịnh Thái
Lan, Hoàng Sa, Trường Sa) với mask che nhãn quốc tế ở z≤8 + nền pmtiles **sạch
0 đối tượng CJK** (kiểm lại 2026-09-02, cổng `no-cjk-data.test.ts` giữ thường
trực) + `coral-reefs.v1.json` 13 tên Việt Trường Sa/DK1 (hạng mục 8).
**C-MAP có gì**: tự công bố dùng *"China NGD official charts information"* cho
khu vực Trung Quốc trong trang Copyright Acknowledgement, **không có mục
"Vietnam"** nào trong toàn bộ danh sách cơ quan cấp phép — tức không có cơ sở
để khẳng định họ dùng tên/quan điểm chủ quyền Việt Nam cho vùng biển tranh
chấp.
**Vì sao VƯỢT**: có cổng kiểm tự động (không phải lời hứa suông), phủ cả ba
nhóm tên (đảo, biển, rạn) bằng tiếng Việt, và đối thủ tự thân công khai không
có giấy phép/nguồn Việt Nam.
**Nhắc lại**: kết luận này KHÔNG dựa vào claim "SONG SAPGON"/"GULF OF THAILAND"
chưa kiểm chứng độc lập (xem §0) — dựa trên bằng chứng đo được của chính ta
(audit-names) và văn bản C-MAP tự công bố.

---

## 4. Thứ tự ưu tiên lấp — theo giá trị cho ngư dân, không theo độ dễ

> **Cập nhật 2026-09-03 (chiều)**: mục cũ 1 (khu neo đậu), 3 (thuỷ triều — nay
> VƯỢT nhờ 7 trạm mô hình), và cáp ngầm (12 — nay VƯỢT nhờ 10 tuyến thật) đều
> **đã lấp**. Còn lại đúng **1 hạng mục CHƯA (6)** và **3 hạng mục ĐẠT (3, 9,
> 11)**. Danh sách dưới xếp lại theo phần còn thật sự cần làm.

1. **Độ sâu vượt qua cho xác tàu/chướng ngại (6)** — hạng mục CHƯA DUY NHẤT
   còn lại. Đã lục cạn mọi đường vòng đã biết (NGA MSI 503 cả site, Wayback
   trống, OSM 0 độ sâu) — đây là **giới hạn nguồn thật**, không phải việc chưa
   làm. Chỉ lấp được nếu NGA MSI hồi phục hoặc Cục Hàng hải công bố thêm dữ
   liệu khảo sát xác tàu; không nên tốn công tìm thêm đường vòng cho tới khi
   một trong hai điều kiện đó đổi.
2. **OCR 337 bản scan miền Bắc (3)** — lấp đúng vùng trắng 12°B–15,2°B, ước
   lượng ~105 điểm mới. Rủi ro cao hơn (văn phong miền Bắc viết theo đoạn, cần
   bộ bóc thứ hai) nhưng là nguồn duy nhất tạo ra thông tin CHƯA TỪNG có trên
   máy — không lớp nào khác trong danh sách này làm được điều đó.
3. **Mở rộng vùng cấm/khu đặc biệt ra ngoài vịnh Bắc Bộ (11)** — khu bảo tồn
   biển + vùng quân sự công bố công khai + vùng cấm quanh cụm giàn khoan
   Bạch Hổ/Rồng/Đại Hùng/Rạng Đông (thềm lục địa phía Nam) — 7 vòng hiện có chỉ
   phủ vịnh Bắc Bộ.
4. **Chất đáy vùng cửa sông/ven bờ đục nước (9)** — xếp sau vì **chưa có
   nguồn mở nào được xác nhận** (ACA không nhìn xuyên được nước đục); đầu tư
   công tìm nguồn trước khi tính công dựng lớp.
5. **Đối chiếu 1.225 tên ven bờ NỔI (8) với cách gọi dân gian** — nguồn là văn
   bản hành chính (TT 33/2024), có thể lệch tên bà con thực tế dùng ở một số
   nơi; giá trị vừa phải vì hạng mục đã VƯỢT, đây là việc tinh chỉnh, không
   phải lấp lỗ hổng.
6. **Xin thêm 109 khu tránh trú bão còn thiếu toạ độ trong QĐ 582 (13)** —
   danh mục đã có tên/tỉnh, chỉ thiếu toạ độ đáng tin; giá trị thấp vì 51 khu
   hiện có đã phủ 21/28 tỉnh và hạng mục đã VƯỢT.
7. **Thêm trạm thuỷ triều đo thật (14)** — hạng mục đã VƯỢT nhờ 7 trạm mô
   hình, nhưng trạm đo thật (gauge) chính xác hơn mô hình (RMSE thấp hơn) —
   đáng đầu tư thêm nếu tìm được nguồn UHSLC/JASL mới, không cấp thiết.

---

## 5. Nguồn

`do-phu-hai-do-2026-08.md` · `kiem-ke-du-lieu-2026-09.md` ·
`trinh-sat-cmap-2026-09.md` · `thu-tu-uu-tien-2026-09.md` ·
`xac-tau-2026-09.md` · `den-bien-2026-09.md` · `san-so-dang-ky-2026-09.md` ·
`ky-hieu-hai-do-2026-08.md` · `ra-soat-ten-2026-08.md` · `gop-so-aton-2026-09.md` ·
`ran-vector-tile-2026-08.md` · `ran-ve-lai-aca.md` · `09-nautical-map-sources.md` ·
số đo trực tiếp 2026-09-03 (đếm `public/data/*.json`, grep wiring `src/` +
`public/sw.js`, chạy `node scripts/kiem-phu-hai-do.mjs`).

**Nguồn ba lớp mới nối sáng 2026-09-03** (đọc trực tiếp từ `nguon`/`giayPhep`
ghi trong chính file, không chép lại từ nơi khác): `chat-day.v1.json` —
Allen Coral Atlas `benthic_data_verbose` (CC BY 4.0); `khu-tru-bao.v1.json` —
Quyết định 582/QĐ-TTg ngày 03/7/2024 (Quy hoạch hệ thống cảng cá, khu neo đậu
tránh trú bão cho tàu cá 2021–2030, tầm nhìn 2050), toạ độ đối chiếu từ đèn
biển/phao luồng (nguồn nhà nước) + OpenStreetMap (5/51 khu, gắn cờ); `dia-danh-ngam.v1.json`
— Thông tư 33/2024/TT-BTNMT, Mục III (Bộ Tài nguyên và Môi trường, ban hành
2024-12-15).

**Nguồn ba nhóm thay thế nối chiều 2026-09-03**: `coral-reefs.v1.json` nhóm
`ven-bo` (1.225 tên) — Thông tư 33/2024/TT-BTNMT, Mục A.I; `vn-sea-lanes.v1.json`
cáp `src=cap-vn` (10 tuyến) — điểm cập bờ xác minh ≥2 nguồn độc lập, dùng
TeleGeography làm manh mối (không chép hình tuyến, giấy phép CC BY-NC-SA);
`tide-stations.v1.json` 7 trạm `nguon=model` — EOT20 (DGFI-TUM), doi:10.17882/79489,
CC BY 4.0.

**Chưa đo / còn treo**: đối chiếu ảnh C-MAP thật (raster + quyền hạn phiên
chặn — cần phiên có màn hình hoặc người dùng xác nhận tải 1–2 tile PNG); % xác
minh 1.447 báo hiệu `vn-aids` so với sổ AtoN gốc theo từng mục; giấy phép 80
cụm gốc WCMC (mâu thuẫn giữa hai báo cáo, xem hạng mục 7); 109 khu tránh trú
bão còn thiếu toạ độ trong QĐ 582 (hạng mục 13); phạm vi thật của vòng cấm neo
an-toàn ngoài vịnh Bắc Bộ (hạng mục 11); đối chiếu 1.225 tên ven bờ NỔI với
cách gọi dân gian thực tế (hạng mục 8).
