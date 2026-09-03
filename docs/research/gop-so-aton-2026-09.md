# Gộp sổ AtoN 2016 ba tầng + dựng thước đo phủ — 2026-09-02

> **Việc**: [san-so-dang-ky-2026-09.md](san-so-dang-ky-2026-09.md) tìm được cả cuốn sổ
> "List of AtoN System" (VMS-South, NXB GTVT 2016, ISBN 978-604-76-1153-9) — 752 báo
> hiệu miền Nam có toạ độ. Phiên này **gộp nó vào dữ liệu đang phát** theo phương án ba
> tầng đã duyệt ([phuong-an-tu-chu-du-lieu.md §4-#2](../formaps/phuong-an-tu-chu-du-lieu.md)),
> rồi **dựng cái thước** (`npm run kiem:phu`) để câu "100% vượt hải đồ thương mại" có
> nghĩa đo được.
>
> **Kết quả một dòng** (chính là đầu ra của thước): sau đợt gộp đầu *phủ 93%*; sau đợt
> **phân xử trùng-tên/trùng-chỗ** (§9, quyết định chủ dự án 2026-09-02) — *phủ **95,8%**
> sổ nhà nước (783/817 báo hiệu, 22 tuyến có số công bố — TRƯỚC gộp: 25,6%) · đèn biển
> ≥94 · vượt Navionics ở 2/3 lớp trong khung đối chiếu.*

---

## 1. Gộp được gì — theo đúng ba tầng

| Tầng | Luật | Kết quả |
|---|---|---|
| **1 · Đèn biển (đứng yên)** | KHÔNG vào `vn-aids`; đèn đã có trong `den-bien.v1.json` thì sổ chỉ **xác nhận** (crossCheck), đèn chưa có mới **bổ sung** | 50 đèn trong sổ → **45 crossCheck** cho đèn đang có · **4 bổ sung** (Hòn Hải, Ba Kiềm, Ba Kè, Quế Đường — xem §3) · **1 mâu thuẫn ghi lại, không thêm** (Cửa Tiểu, §4). Lớp đèn: **90 → 94 ngọn** |
| **2 · Phao/tiêu (chuyển động)** | Sổ là **NỀN 2016**, nguồn mới hơn **ĐÈ**: bỏ mọi điểm cách nguồn A (ENC) / B (TBHH) dưới 150 m, hoặc trùng số hiệu trong cùng khúc luồng (<5 km). Mọi tuyến gốc sổ mang **`canhBaoTuoi`** | 702 phao/tiêu → **626 vào lớp** (giữ), 50 nhường-trùng-chỗ, 23 nhường-trùng-số-hiệu, 1 điểm mồ côi bỏ (§4), 2 nằm trong 50 đèn chuyển tầng 1. Lớp báo hiệu: **774 → 1.400** (nam 15°B: **161 → 787**) |
| **3 · Đăng ký nguồn** | `vms-south-aton-list` vào `SOURCES` của `src/lib/provenance.ts`, giấy phép `vn-official` | Cổng chống-xoá per-source của `generate-vn-aids.mjs` giờ canh cả nguồn này: lần sinh lại nào thiếu kho sổ là bị CHẶN, không ghi đè im lặng |

Vật liệu sổ (bản chữ đã bóc + PDF gốc — bản Wayback **duy nhất** còn trên internet) đã
chép về kho ngoài repo `<tmp>/sdfish-aton-2016/` (`aton-aids.json` · `aton.txt` ·
`aton.pdf`); `generate-vn-aids.mjs --kho-aton <path>` và `generate-den-bien.mjs` cùng
đọc chỗ đó. **Kho này vẫn thuộc diện "phải sao lưu ra chỗ bền"** — việc #1 của phương
án, chưa làm trong phiên này.

## 2. Bảng `kiem:phu` TRƯỚC / SAU (trục 1 — con số nhà nước tự công bố)

Cột "công bố" = ô "Số báo hiệu" trang ENC (`ChiTietTuyenLuong.aspx?ID=<n>`, đọc
2026-09-02, chép ở [san-so-dang-ky-2026-09.md §3](san-so-dang-ky-2026-09.md)); % chấm
`min(ta, công bố)/công bố` — thừa không bù cho thiếu.

| Tuyến (ENC#) | công bố | TRƯỚC | SAU | % SAU |
|---|---|---|---|---|
| Định An – Cần Thơ (33) | 118 | 29 | **140** | **100%** |
| Sài Gòn – Vũng Tàu (19) | 112 | 8 | **109** | 97% |
| Soài Rạp (21) | 73 | 3 | **77** | 100% |
| Vũng Tàu – Thị Vải (31) | 71 | 10 | **71** | 100% |
| Sông Tiền (Cửa Tiểu) (32) | 64 | 2 | **62** | 97% |
| Kênh Quan Chánh Bố (ENC chưa liệt kê; chuẩn = số đếm sổ) | 65 | 0 | **55** | 85% |
| Đồng Nai (20) | 33 | 1 | **23** | 70% |
| Sông Dinh (36) | 20 | 5 | **24** | 100% |
| Nha Trang (59) | 13 | 0 | **10** | 77% |
| Ba Ngòi (44) | 13 | 0 | **13** | 100% |
| Hà Tiên (41) | 12 | 0 | **8** | 67% |
| Sông Dừa (35) | 12 | 0 | **10** | 83% |
| Năm Căn – Bồ Đề (40) | 10 | 1 | **8** | 80% |
| Phú Quý (64) | 7 | 0 | **5** | 71% |
| An Thới (70) | 6 | 0 | **4** | 67% |
| Đồng Tranh – Tắt Bài – Tắt Cua (66) | 6 (số cũ; sổ in 29) | 0 | **28** | 100% |
| Côn Sơn – Côn Đảo (43) | 5 | 0 | **4** | 80% |
| Đầm Môn (42) | 4 | 0 | **10** | 100% |
| Vũng Rô (30) | 3 | 0 | **3** | 100% |
| Bến Đầm – Côn Đảo (65) | 3 | 0 | **2** | 67% |
| Sa Đéc (73) | 2 | 0 | **2** | 100% |
| Hải Phòng (1) — mốc miền Bắc | 165 | 150 | 150 | 91% |
| Quy Nhơn (38) | 314 ⚠️ | 14 | 30 | **LOẠI** — "300 phao" cho luồng 6 km gần chắc lỗi nhập liệu (sổ in 21); chấm theo cột chuẩn sai còn tệ hơn không chấm |
| Gò Gia (34) | — (ENC để trống cả hai ô) | 0 | 0 | — phủ dưới tên Đồng Tranh, xem §5 |
| **Đèn biển (cả nước)** | 94 | 90 | **94** | **100%** |
| **TỔNG (22 tuyến có số công bố)** | **817** | **209 (25,6%)** | **760** | **93,0%** |

Con số "94 ngọn đèn biển" là chủ dự án cung cấp theo sổ đăng ký quốc gia (brief
2026-09-02) — **chưa tra được văn bản gốc**; thước dùng nó nhưng không trình bày như
trích dẫn văn bản, và test bắt buộc câu nguồn phải giữ nguyên trạng thái đó.

## 3. Bốn ngọn đèn khôi phục — trong đó có Hòn Hải (điểm cơ sở A6)

**Có, Hòn Hải khôi phục được từ sổ.** Bản lưu vms-south chép **cùng một toạ độ** cho
hai trang (Ba Kiềm mang toạ độ Hòn Hải; Ba Kè mang toạ độ Quế Đường), cổng
`boTrungCho()` đúng luật phải bỏ cả bốn — mất luôn ngọn đèn trên điểm cơ sở A6. Sổ
giấy cho **mỗi ngọn một toạ độ riêng**, kèm số hiệu danh mục đèn quốc tế `F####`,
và cả bốn khớp địa lý thật:

| Đèn | F#### | Toạ độ theo sổ | Đối chiếu |
|---|---|---|---|
| **Hòn Hải** | F3120.7 | 9,9740°B 109,0844°Đ | đúng đảo Hòn Hải (Phú Quý) — chính là toạ độ mà trang Ba Kiềm đã chép nhầm |
| **Ba Kiềm** | F3115 | 10,5078°B 107,5096°Đ | đúng mũi Ba Kiềm (Bình Thuận) |
| **Ba Kè** | F2825.19 | 7,8749°B 111,7448°Đ | đúng bãi Ba Kè (DK1) |
| **Quế Đường** | F2825.194 | 7,8194°B 110,5009°Đ | đúng bãi Quế Đường (DK1) — toạ độ mà trang ba-kè đã chép nhầm |

Tên bốn ngọn **nhập tay** vào bảng `SACH_TEN` của `generate-den-bien.mjs` (sổ in tiếng
Anh + font cắt vụn "H o n H a i" — ghép máy là đoán); test mới trong `den-bien.test.ts`
ghim Hòn Hải đúng chỗ và giữ Ba Kè ↔ Quế Đường cách nhau >50 km làm cổng lùi.
Ba Kiềm bổ sung **không có đặc tính đèn** (bộ bóc không đọc ra ô AS của dòng F3115) —
để trống, không đoán.

## 4. Mục sổ bị loại — và vì sao thật

| Bị loại | Bao nhiêu | Vì sao |
|---|---|---|
| Nhường trùng chỗ (<150 m với ENC/TBHH) | 50 | đúng vai NỀN: nguồn mới hơn thắng |
| Nhường trùng số hiệu cùng khúc luồng (<5 km) | 23 | "Phao 5" của TBHH 2024 và "Phao 5" của sổ 2016 là MỘT cái phao đã bị dịch — vẽ cả hai là hai chấm cho một vật |
| **"Buoy BC" tuyến Vũng Rô** | 1 | điểm mồ côi: nằm ở 13,353°B 109,313°Đ — cách mọi báo hiệu Vũng Rô 56 km (gần Gành Đèn/Quy Nhơn). Khớp luôn với lệch +1 của tuyến này trong đối chiếu §3 tài liệu săn sổ. Cổng láng giềng bắt được (xem §6) |
| **Đèn Cửa Tiểu (F3060)** | 1 | sổ đặt ở 10,2096°B 106,6041°Đ, **lệch ~25 km** so với ngọn cùng tên đang có (từ bản lưu vms-south). Hai nguồn cãi nhau về vị trí, chưa có nguồn thứ ba phân giải → giữ bản đang có, ghi mâu thuẫn vào `thieu[]` của `den-bien.v1.json`, KHÔNG đoán |
| Đặc tính đèn không đọc được | 3 | "Fl (6+1) Q W 15s" kiểu ghép "Q" mập mờ — bỏ đặc tính (giữ phao), không dịch bừa |
| 85 phao + 8 đèn sổ không in số hiệu/tên | giữ vị trí | mang nhãn "Báo hiệu (chưa rõ số hiệu)" — đúng luật không bịa định danh |

## 5. Gò Gia — xác nhận, đúng như dự đoán của tài liệu săn sổ

ENC liệt Gò Gia thành tuyến #34 riêng nhưng **để trống cả ô Phao lẫn ô Tiêu** — không
có con số nào để mà thiếu. 28 báo hiệu mục "Đồng Tranh – Tắt Bài – Tắt Cua" của sổ đã
vào lớp (14 trong số đó nằm trong đoạn sông Gò Gia). Thước ghi hàng Gò Gia `công bố = —`
kèm chú thích, **không** tính là tuyến thiếu.

## 6. Lỗi im lặng mới bắt được trong phiên

1. **Gộp khoảng trắng quá tay giết 408 đặc tính đèn.** Bản đầu của bộ đọc sổ xoá MỌI
   khoảng trắng trước khi đưa vào `parseLight` — "Fl G 3s" thành "FlG3s", regex đọc ra
   mã "FlG" lạ và **im lặng bỏ đèn của gần hết 626 phao**. Bộ đếm `badLight` làm nó lộ
   ra (408 dòng); sửa thành chỉ nối **chữ số với chữ số** ("1 0 s" → "10s") thì còn
   đúng 3 ca mập mờ thật.
2. **Cổng cụm 60 km quanh tâm chém phao thật.** Áp cổng cụm của Thông báo hàng hải
   (một tin = một khúc luồng) cho CẢ tuyến thì luồng Định An dài 130,6 km bị chém 9
   phao ở hai mút — toàn phao thật. Đổi sang cổng **láng giềng gần nhất ≤15 km** (hình
   dạng đúng của tuyến là CHUỖI, trung vị khoảng phao 1,93 km): giữ đủ Định An, vẫn bắt
   được "Buoy BC" mồ côi 56 km — cái mà cổng-tâm-60-km của vòng nghiệm thu sổ **đã cho
   qua**.
3. **Đuôi "Light" trong tên sổ gây báo động giả.** So tên sổ với tên lớp đèn ra 3 cặp
   "lệch tên" (Hon Dam Light ↔ Hòn Dăm…) — đuôi "Light/Lighthouse" là LOẠI VẬT chứ
   không phải tên; gột trước khi so thì 0 cặp lệch thật.
4. **Cổng dấu-vân-tay trùng-toạ-độ đã dựng** (`generate-vn-aids.mjs`, cổng 2b): hai
   báo hiệu KHÁC TÊN trùng khít toạ độ ~1 m = một chuỗi toạ độ được tái dùng (OCR trộn
   dòng / bảng chép kéo ô — đợt dò sổ từng thấy 11 điểm như vậy) → CHẶN không ghi file.
   Dữ liệu hiện tại: 0 ca — cổng không giết nhầm ai, đúng như đặt hàng.

## 7. Trục 2 — số đếm tay trên ảnh Navionics (nơi lưu chính thức của các con số)

Khung **Vũng Tàu** (`NOI_MAU["vung-tau"]` của `kiem-ban-do.mjs`: 10,35°B 107,05°Đ,
zoom 13) — đếm tay trên ảnh Navionics chủ dự án cung cấp (brief 2026-09-02):

| Lớp | Navionics (đếm tay) | Ta (sau gộp) | |
|---|---|---|---|
| Số đo sâu rời | ~25–30 | **161** | VƯỢT |
| Phao · tiêu · đèn báo hiệu | ~15–20 | **35** (27 Cục HH + 6 OSM + 2 đèn biển; trước gộp: 15) | VƯỢT |
| Xác tàu | 2 | **0** | **chưa** — 42 xác tàu của lớp `reef-shapes` đều ngoài khung này; nguồn chính thức thay thế (NGA MSI) đang 503 |

Thước chấm bằng **biên trên** của số đếm (~30, ~20) — chuẩn khó nhất. Ô "báo hiệu Cục
HH" của `kiem:ban-do` ở các khung nam: Vũng Tàu 7 → **27** · Cà Mau 2 → **4** · Long
Tàu 5 → **43**.

> **Còn treo**: brief nhắc "khung ảnh thứ hai" nhưng repo chỉ ghi toạ độ khung Vũng Tàu
> (`NOI_MAU`). Chưa xác định được khung thứ hai là ảnh nào, đếm ở đâu — thước dựng dạng
> danh sách khung nên khi có ảnh + số đếm ghi nguồn thì thêm một phần tử
> `KHUNG_NAVIONICS` là chạy. KHÔNG bịa số cho khung chưa có.

## 8. Nghiệm thu

`npm run kiem:phu` 93% (trước 25,6%) · `npm run kiem:ban-do` ô nam tăng (§7) ·
`npm test` **3.027 + 20 mới = xanh toàn bộ** (178 file) · `lint` 0 error · `tsc` sạch ·
`audit-names` SẠCH (278 file) · `pre-commit --self-test` 55 PASS / 0 FAIL ·
`vn-aids.v1.json` 139 KB, `den-bien.v1.json` 36 KB (trần 20 MB/file; cả thư mục
`public/data` 119,5 MB — **sát trần 120 MB**, thứ gì thêm vào sau phải nhớ luật ĐỔI
ĐỊNH DẠNG trong CLAUDE.md).

Sàn ghi vào test (không được tụt): tổng ≥93% · Định An ≥100 báo hiệu · đèn biển ≥94 ·
nam 15°B ≥700 báo hiệu, ≥50 đèn · giữ VƯỢT Navionics ở số-đo-sâu và báo-hiệu khung
Vũng Tàu.

---

## 9. Phân xử ~30 mục bị cổng trùng-tên/trùng-chỗ giữ (2026-09-02, đợt hai)

Chủ dự án quyết: *"Trùng tên thì kiểm tra verify từ nhiều nguồn coi cái nào đúng,
giữ 1 cái thôi."* Thực thi TỪNG CA (không nới cổng chung), mỗi ca xác minh bằng ≥2
nguồn (sổ 2016 · kho TBHH trên đĩa qua `scripts/lib/tbhh-doc.mjs`, 256 tin / 664 hàng
toạ độ · cổng ENC), phân về một trong ba kết cục. Bản dò từng ca chạy lại được:
`<tmp>/sdfish-aton-2016/dump.mjs` (replay cổng trên nền A/B/E + bằng chứng TBHH
≤500 m). Kho sổ được VÁ có chủ ý bằng `<tmp>/sdfish-aton-2016/patch-kho.mjs`
(ghép mã QG151 từ dòng kế + tách hai mục Nha Trang — có neo kiểm, có .bak);
sinh lại kho từ PDF thì phải chạy lại bản vá, quên thì sàn 95% trong test đỏ ngay.

### 9.1 Bảng phân xử

| Ca (76 mục giữ ở cổng cũ) | Kết cục | Nguồn phân xử |
|---|---|---|
| Quy Nhơn ×4 · VT–Thị Vải ×3 (Phao 6/49/56) · Sông Tiền ×4 (Phao 12/15/27/28) · Định An ×4 (Phao U/2/4/12) · QCB ×10 (Phao 3/43/45/46/48/50/52/56/60/62) · Năm Căn Phao 0 · Bến Đầm ×1 | **1 — cùng MỘT vật, bản mới thắng** (27 ca) | tin TBHH 2019–2026 đứng **0–32 m** (LẬP/ĐỔI/NÊU/NGƯNG) — sổ 2016 nhường, đúng vai nền |
| Năm Căn "Phao 6" | **1** (1 ca) | TBHH **NGƯNG 2023** cùng tuyến, 229 m — cùng số hiệu cùng tuyến = một phao đã dịch |
| Sài Gòn – Vũng Tàu "Phao 1" | **1** (1 ca) | bản xác minh KÉP (sổ + OSM 226 m) của nguồn E đứng trước; sổ trơn nhường bản giàu lý lịch hơn — E nay chạy TRƯỚC C |
| 19 mục Đồng Nai tên đợt "QG151" (+3 tiêu QG151 tuyến khác) | **2 — tra RA số hiệu thật** (22 mục, 17 mới vào) | **chính sổ**: dòng kế của mỗi mục in mã riêng (P002, P007…, B004…) mà bộ bóc cũ đánh rơi — vá kho, tên phát hành thành "Phao QG151 P002"… TBHH chỉ có 1 tin GỠ 2019 cách 452 m, không đủ gỡ mục nào |
| Nha Trang "Phao 2"/"Phao 4" | **2 — hai vật thật** (2 ca) | **chính sổ**: hai mục "NHA TRANG FAIRWAY (NORTH)" và "(SOUTH)", mỗi luồng đánh số từ 0 — tách hai tuyến (chung mã ENC 59) |
| "Phao 1" Sông Dinh · "Phao 2" SG–VT · "Phao 8" Đồng Tranh | **2** (3 ca) | mỗi luồng đánh số từ 1 — trùng số hiệu KHÁC tuyến; cổng sửa thành trùng-tên-TRONG-CÙNG-TUYẾN |
| Cặp phao đối xứng cửa luồng hẹp: Hà Tiên ×3 (Phao 2/6/10, cách bạn sổ 115–141 m) · An Thới ×3 (Phao 2/5/9, 17–148 m) · Phú Quý ×2 · Định An CT2/CT4 (59–63 m) · SG–VT Tiêu 75 + Rear ×9 + 36B (96–149 m) · Sông Dinh Phao 4 · Quy Nhơn ×1 · Năm Căn BĐ1 · Đồng Nai Signpost ×1 · An Thới tiêu đê ×1 | **2** (≈24 ca) | **chính sổ**: mỗi dòng là một bản ghi đăng ký riêng (Front/Rear của chập tiêu, hai mép luồng G/R). Cổng cũ đưa cả sổ-đã-vào vào danh sách trùng-chỗ nên tự chém mình; sửa: cổng <150 m chỉ so với nguồn KHÁC (A/B/E) |
| "Buoy BC" Vũng Rô (13,353°B — cách mọi báo hiệu Vũng Rô 56 km) | **3 — không đủ nguồn** (1 ca) | không tin TBHH nào trong 500 m; không nguồn nào giải thích một phao Vũng Rô nằm gần Gành Đèn — ghi lại, KHÔNG vào lớp |

**Đổi cổng đi kèm (đúng phạm vi quyết định):** (a) trùng-TÊN chỉ chặn trong CÙNG tuyến
(khoá tuyến, cùng luật với nguồn E); trùng tên khác tuyến <5 km được ĐẾM và in danh sách
mỗi lần sinh (`sachTenKhacTuyen` — 5 ca, đúng bảng trên) để soát lại được; (b) trùng-CHỖ
<150 m chỉ so với nguồn khác, không so sổ-với-sổ; (c) nguồn E chuyển lên chạy TRƯỚC nguồn
C — để bản xác minh kép không bị chính bản sổ trơn của nó đè mất (test "nguồn E … có mặt"
từng đỏ đúng vì thứ tự cũ); (d) sửa bộ dịch tên: "no." chỉ cắt khi trước một mã thật —
"Beacon, North" từng thành "Tiêu rth" (rác đã phát hành, nay là "Tiêu đê Bắc Dương Đông",
nhập tay theo câu tả của sổ: North/South breakwater at Duong Dong river).

### 9.2 Thước kiem:phu TRƯỚC / SAU phân xử

| Tuyến | trước | sau |
|---|---|---|
| **TỔNG** | **93,1% (761/817)** | **95,8% (783/817)** |
| Đồng Nai | 23/33 (70%) | **41 → 100%** |
| An Thới | 4/6 (67%) | **8 → 100%** |
| Phú Quý | 5/7 (71%) | **7 → 100%** |
| Sông Dinh | 20/20 (100%) | 25 → 100% |
| Hà Tiên | 8/12 (67%) | **11 → 92%** |
| Nha Trang | 10/13 (77%) | **12 → 92%** |
| Năm Căn – Bồ Đề | 8/10 (80%) | **9 → 90%** |
| Sài Gòn – Vũng Tàu | 110/112 (98%) | **121 → 100%** |
| Đồng Tranh | 28 → 100% | 29 → 100% |
| các tuyến còn lại | — | **không tuyến nào tụt** (kiểm bằng diff: 0 mark cũ biến mất) |

### 9.3 Cổng mới có chém oan không — đo, không đoán

- **0 báo hiệu đã phát bị mất** (diff toạ độ TRƯỚC/SAU: mất 0 · thêm 46 · đổi tên 6 —
  toàn bộ đổi tên là chủ ý: mã QG151 + sửa "Tiêu rth").
- 30 mục còn giữ sau cổng mới = 29 ca kết cục 1 (đều có bằng chứng TBHH/E ≤32 m hoặc
  cùng-tuyến-cùng-số) + 1 ca kết cục 3 (Buoy BC). Không ca nào giữ mà thiếu lời giải.
- 5 ca trùng-tên-khác-tuyến được thả đều nằm trong bảng phân xử — bộ đếm
  `sachTenKhacTuyen` in danh sách mỗi lần sinh, lần sau thả thêm gì là thấy ngay.
- Lỗi bắt được trong chính đợt này: bản vá đầu của luật "no." làm "Phao CT1" thành
  "Phao no. CT1" — diff tên TRƯỚC/SAU bắt được trước khi phát (đã sửa: chỉ cắt "no."
  khi sau nó là mã `[A-ZĐ]{0,3}\d`, phép thử cố ý không mang cờ /i).

Sàn mới ghi vào test: tổng ≥95% (`kiem-phu-hai-do.test.ts`) · nam 15°B >800
(`vn-aids.test.ts`) · tên QG151 phải mang mã thật, Nha Trang phải là 2 tuyến, Hà Tiên
giữ đủ cặp Phao 1+2 (test "phân xử trùng-tên 2026-09-02 còn hiệu lực").
