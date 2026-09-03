# Nguồn số đo sâu — mở rộng ra cả nước, 2026-08-31

> **Câu hỏi của chủ dự án**: *"Tại sao chỉ có Hải Phòng? Tìm dữ liệu cho đủ, rà các nguồn khác nhau."*
>
> Mọi con số dưới đây là **tự đo trong phiên này**, ngày truy cập **2026-08-31**.
> Mã dò để ngoài repo (`%TEMP%`), không thêm file nào vào `src/` hay `scripts/`.
> Tài liệu này **không lặp lại** phép đo của [thong-bao-hang-hai-2026-08.md](thong-bao-hang-hai-2026-08.md)
> — nó trả lời phần *tại sao* và *còn chỗ nào khác*, và ở hai điểm nó **lật lại**
> kết luận cũ (ghi rõ ở §1).

---

## 1. Kết luận thẳng

**Hải Phòng không "nhiều dữ liệu hơn". Hải Phòng chỉ **được lưu trữ lâu hơn**.**

Kho `vmsa.vn` là website cũ của Tổng công ty Bảo đảm an toàn hàng hải **miền Bắc**,
được đổi tên sau hợp nhất. Nó mang theo **20 năm lưu trữ của miền Bắc** (từ 2006) và
**chỉ mang theo 15 tháng của miền Nam** (từ 05/2025). Miền Nam không ít khảo sát hơn —
kho khảo sát của miền Nam **nằm ở chỗ khác, và vẫn lấy được**.

Ba con số quyết định:

| Đo cái gì | Miền Bắc | Miền Nam | Ghi chú |
|---|---:|---:|---|
| **Toàn kho vmsa.vn** | 7.563 (94,3%) | 459 (**5,7%**) | trông như miền Nam trống rỗng |
| **Riêng 12 tháng gần nhất** | 522 (62%) | 320 (**38%**) | thực tế gần cân bằng |
| **Mục cũ nhất mỗi vùng** | **2006** | **05/2025** | đây là toàn bộ lời giải thích |

**Hai điều lật lại tài liệu trước:**

1. **"Chỉ ~11% thông báo cho ra bảng toạ độ"** — đúng với mẫu cũ, **sai với cả nước**.
   Lọc theo *tiêu đề* trước khi tải PDF, mẫu 45 thông báo độ sâu miền Nam cho
   **23 có bảng toạ độ (51%)**, tất cả đều ghi WGS-84, tổng **956** lần bắt được toạ độ
   độ-phút-giây. Cổ chai #3 phần lớn là **cổ chai của bộ lọc**, không phải của kho.
2. **"~47% PDF là ảnh scan"** — đúng ở Hải Phòng, **không đúng ở nơi khác**.
   Mẫu miền Nam: **32/35 PDF có lớp chữ (91%)**, chỉ 3 là ảnh. Tỷ lệ scan cao là
   **đặc sản của một cảng vụ**, không phải của cả nước, và nó **giảm dần theo năm**
   (xem §4: 2012–2018 scan hết, từ 2020 có chữ hết).

**Và một thứ chưa ai tìm ra: thông báo hàng hải có kèm link tới BÌNH ĐỒ ĐỘ SÂU.**
27/63 thông báo độ sâu (43%) trỏ ra ngoài, tới trang của cảng vụ tỉnh, nơi treo file
**bình đồ khảo sát** — bản vẽ đo sâu gốc, hàng nghìn số đo mỗi tờ, đúng thứ Navionics
hiển thị. Tin xấu: bình đồ là **ảnh raster**, và ở độ phân giải đang phát hành thì
**OCR không cứu được** (§5).

---

## 2. VIỆC 1 — Vì sao Hải Phòng 2.649 mà Cà Mau 21

Bốn giả thuyết trong đề bài. Kiểm từng cái, **không chọn cái nghe hợp lý nhất**.

### 2.1. Bằng chứng đóng đinh: số ID của chuyên mục

Rút toàn bộ slug vùng biển từ `https://vmsa.vn/thong-bao-hang-hai-247`:

```
252 Quảng Ninh   256 Thanh Hoá   260 Quảng Trị        264 Quảng Ngãi
253 Hải Phòng    257 Nghệ An     261 Thừa Thiên Huế   265 Vùng biển khác
254 Thái Bình    258 Hà Tĩnh     262 Đà Nẵng
255 Nam Định     259 Quảng Bình  263 Quảng Nam
---------------------------------------------------------------- đứt quãng ~185 số
449 Gia Lai      452 TP.HCM      455 Cà Mau      457 Lâm Đồng
450 Đắk Lắk      453 Đồng Tháp   456 An Giang    459 Cần Thơ
451 Khánh Hoà    454 Vĩnh Long                   460 Đồng Nai
```

**Khối 252–265 liền mạch, không thiếu số nào** — và trải đúng **Quảng Ninh → Quảng Ngãi**,
tức đúng địa bàn của Bảo đảm an toàn hàng hải **miền Bắc**. Khối miền Nam bắt đầu từ
**449**, cách khối cũ gần 185 số, tức được **tạo sau, một lượt**. Chúng còn mang **tên
tỉnh sau sáp nhập 2025** (Gia Lai gồm Quy Nhơn, Đắk Lắk gồm Phú Yên, Lâm Đồng gồm Bình
Thuận, An Giang gồm Kiên Giang, Đồng Tháp gồm Tiền Giang) — nghĩa là chuyên mục miền Nam
sinh ra **sau tháng 7/2025**.

### 2.2. Bằng chứng thứ hai: ngày của mục cũ nhất mỗi vùng

Lấy trang cuối của từng vùng, đọc ngày dòng cuối:

| Vùng (khối Bắc) | Tổng | Cũ nhất | | Vùng (khối Nam) | Tổng | Cũ nhất |
|---|---:|---|---|---|---:|---|
| Hải Phòng | 2.640 | **08/2006** | | TP. Hồ Chí Minh | 183 | **07/2025** |
| Quảng Ninh | 760 | 2006 | | Vĩnh Long | 55 | **05/2025** |
| Nghệ An | 561 | **08/2006** | | Cần Thơ | 46 | **05/2025** |
| Thừa Thiên Huế | 560 | 2006 | | Đồng Nai | 36 | **07/2025** |
| Thanh Hoá | 540 | 2006 | | Gia Lai | 35 | **08/2025** |
| Quảng Ngãi | 440 | 2006 | | Lâm Đồng | 31 | **05/2025** |
| Quảng Bình | 421 | **09/2006** | | An Giang (Kiên Giang) | 26 | **07/2025** |
| Quảng Trị | 400 | 2006 | | Cà Mau | 21 | **08/2025** |
| Đà Nẵng | 360 | 2006 | | Khánh Hoà | 21 | **07/2025** |
| Hà Tĩnh | 280 | 2006 | | Đồng Tháp | 3 | **10/2025** |
| Nam Định | 181 | **06/2007** | | Đắk Lắk | 2 | **04/2026** |

Không một vùng miền Nam nào có mục trước **05/2025**. Không một vùng miền Bắc nào
bắt đầu sau **2007**. Đây không phải xu hướng — đây là **một đường cắt**.

### 2.3. Kiểm chéo: nhịp công bố 12 tháng gần nhất

Nếu miền Nam thật sự "luồng ổn định, ít thông báo" thì cắt về cùng cửa sổ thời gian
độ lệch vẫn còn. Đếm số mục có ngày ≥ 09/2025:

```
Hải Phòng 159 · TP.HCM 90 · Quảng Ninh 61 · Quảng Trị 59 · Nghệ An 49 ·
Vĩnh Long 45 · Thừa Thiên Huế 45 · Vùng biển khác 37 · Cần Thơ 36 ·
Thanh Hoá 34 · Đồng Nai 33 · Gia Lai 31 · Đà Nẵng 25 · Quảng Ngãi 24 ·
Lâm Đồng 23 · An Giang 21 · Cà Mau 20 · Khánh Hoà 16 · Nam Định 12 ·
Hà Tĩnh 11 · Thái Bình 6 · Đồng Tháp 3 · Đắk Lắk 2 · Quảng Bình 0 · Quảng Nam 0
```

Tỷ trọng miền Nam nhảy từ **5,7% → 38%**. Cà Mau từ 21 mục *toàn thời gian* thành
20 mục *trong một năm* — tức Cà Mau vẫn đang công bố đều, chỉ là kho không có quá khứ.

### 2.4. Phán quyết từng giả thuyết

| Giả thuyết | Phán quyết | Bằng chứng |
|---|---|---|
| **"Miền Nam công bố ở trang khác"** | ✅ **ĐÚNG — và là nguyên nhân chính** | ID chuyên mục đứt quãng; miền Nam bắt đầu 05/2025; **2.105 PDF của `vms-south.vn` còn nằm trong Wayback** (§4.1) |
| **"Hải Phòng bồi lắng nên phải khảo sát liên tục"** | ✅ **ĐÚNG một phần — giải thích phần dư** | Hải Phòng vẫn dẫn đầu 159/842 (**18,9%**) ngay trong cửa sổ 12 tháng, gấp ~1,8 lần TP.HCM. Luồng Lạch Huyện: nạo vét ban đầu 40 triệu m³, **duy tu ~1,5 triệu m³/năm**; gói duy tu Hải Phòng ~244 tỷ đồng; báo chí dẫn nghiên cứu nói sa bồi Hải Phòng **gấp đôi sau mỗi 10 năm** |
| **"Cảng vụ mỗi vùng công bố ở nơi khác nhau, vmsa gom một phần"** | ✅ **ĐÚNG — và mở ra nguồn mới** | **18/22** tên miền cảng vụ tỉnh còn sống, mỗi trang có mục Thông báo hàng hải riêng (§3.2). Bình đồ độ sâu **chỉ** treo ở đó, không có trên vmsa |
| **"Miền Nam luồng ổn định hơn nên ít thông báo"** | ❌ **SAI** | Cắt về cùng 12 tháng, miền Nam chiếm 38%. Chênh lệch còn lại nằm ở Hải Phòng, không phải ở "miền Nam ít" |

**Tóm lại**: độ lệch 32% : 0,3% là **hiện vật của việc gộp website**, cộng thêm một
phần thật do Hải Phòng bồi lắng. Dữ liệu miền Nam **có tồn tại**.

---

## 3. VIỆC 2 — Rà nguồn khác

### 3.1. Cái đã chết (đừng mất công nữa)

| Nơi | Trạng thái đo 2026-08-31 |
|---|---|
| `vms-north.vn`, `www.vms-north.vn` | ❌ DNS không phân giải |
| `vms-south.vn`, `www.vms-south.vn` | ❌ DNS không phân giải — **nhưng Wayback còn (§4.1)** |
| `vmscom.vn` | ❌ chứng thư hết hạn + HTTP **404** |
| `viwa.gov.vn`, `viwa-s.gov.vn` (Cục Đường thuỷ nội địa) | ❌ DNS không phân giải — Cục ĐTNĐ đã **nhập vào Cục Hàng hải và Đường thuỷ VN**; mục "Thông báo luồng" biến mất cùng tên miền |
| `cangvuhanghaivungtau / camau / mytho / quangbinh .gov.vn` | ❌ không phân giải (đã sáp nhập vào cảng vụ khác) |

> Kết quả tìm kiếm vẫn trả về `www.vms-south.vn/thong-bao-hang-hai/page/4`. Đó là
> **chỉ mục cũ của công cụ tìm kiếm**, không phải trang sống. Đã kiểm bằng DNS.

### 3.2. Mạng cảng vụ tỉnh — 18 trang sống, **đây là chỗ treo bình đồ**

Dò thẳng bằng HTTP:

| Tên miền | HTTP | Có mục TBHH | Ghi chú đo được |
|---|---|---|---|
| `cangvuhanghaikiengiang.gov.vn` | 200 | ✅ `?page=news&cat=15` | **Tốt nhất.** Trang chi tiết `?page=detail&id=N`, đính kèm **cả** `...signed.pdf` **và** `BINH_DO_KHAO_SAT.pdf` |
| `cangvuhaiphong.gov.vn` | 200 | ✅ `/chuyen-muc/thong-bao-hang-hai/` | **25 trang** phân trang; PDF `.signed.pdf` **có lớp chữ** (đo: 2 trang, 3.144 ký tự, 16 toạ độ) — nấp sau plugin `pdfjs-viewer-shortcode`, phải bóc tham số `file=` |
| `cangvuhanghaibinhthuan.gov.vn` | 200 | ✅ `/chuyen-muc/thong-bao-hang-hai/` | **21 trang**, ~10 mục/trang |
| `cangvuhanghaiquangninh.gov.vn` | 200 | ✅ `?page=news&cat=15` | 15 trang |
| `cangvuhanghaidanang.gov.vn` | 200 | ✅ `/vi/chuyen-muc/thong-bao-hang-hai` | được TBHH trỏ tới đích danh |
| `cangvuhanghaidongnai.gov.vn` | 200 | ✅ (trỏ về trang chủ) | 3/4 TBHH Đồng Nai trỏ về đây |
| `cangvuhanghaicantho.gov.vn` | 200 | ⚠️ có, nhưng **cũ từ 2017** | coi như chết về nội dung |
| `cangvuhanghaitphcm / nghean / thanhhoa / hatinh / quangtri / thuathienhue / quynhon / nhatrang / thaibinh / dongthap / qni .gov.vn` | 200/303 | chưa dò từng trang | còn sống, chưa đo sâu |

> **Đây là câu trả lời cho "cảng vụ mỗi tỉnh có trang riêng không?" — có, và chúng
> giữ thứ mà kho trung ương không giữ.**

### 3.3. Cổng quốc gia mới — `vimawa.gov.vn`

Cục Hàng hải VN + Cục Đường thuỷ nội địa đã hợp nhất thành **Cục Hàng hải và Đường
thuỷ Việt Nam**. Dấu vết đo được: số hiệu thông báo kiểu **`/TBHH-CHHĐTVN`** và
**`/TBHH-CVĐTNĐIV`** (Cảng vụ Đường thuỷ nội địa khu vực IV) **đã xuất hiện lẫn trong
dòng thông báo hàng hải** ở các vùng Đồng Tháp, Vĩnh Long, Đồng Nai, Lâm Đồng.

- `https://vimawa.gov.vn/vi/thong-bao-hang-hai` — **200**, là cổng chính danh, nhiều
  TBHH trỏ về đây.
- **Nhưng**: danh sách dựng phía trình duyệt, `?page=N` trả cùng nội dung với mọi N
  (đã thử N = 1, 5, 20, 50, 100 → luôn 4–8 mục). **Không rút được kho hàng loạt.**
- `vinamarine.gov.vn` vẫn 200 nhưng là **trang tin cũ**, không phải kho TBHH.
- ⇒ Giá trị: **xác thực / tra một mục**, không phải nguồn quét.

### 3.4. Đường thuỷ nội địa (cửa sông, cửa lạch)

Đây là chỗ bà con hay vào, và đây là **tin xấu rõ ràng**:

- Cổng `viwa.gov.vn/thong-bao-luong` mà tài liệu pháp luật còn dẫn — **tên miền không
  còn phân giải**.
- Nội dung ĐTNĐ nay chảy vào cùng dòng TBHH (thấy `CVĐTNĐIV`), **nhưng chỉ vài mục**:
  Đồng Tháp 3, Vĩnh Long 55 — không phải kho luồng ĐTNĐ đầy đủ.
- **Không tra được** một cổng thay thế nào đăng "thông báo luồng ĐTNĐ" cả nước.

### 3.5. Chi cục Thuỷ sản / cảng cá — **không tra được**

Đã tìm bằng tiếng Việt. Không tìm ra **bất kỳ** cổng nào của ngành thuỷ sản công bố
**thông số độ sâu luồng vào cảng cá** dạng có thể quét. Thứ tìm được chỉ là bài báo và
đề tài nghiên cứu lẻ (ví dụ một bài về mái dốc luồng vào bến cá Cống Họng). **Ghi là
không tra được, không suy đoán.**

### 3.6. Báo cáo nạo vét — có, nhưng là văn bản dự án

Có công bố (ví dụ báo cáo ĐTM luồng Lạch Huyện trên cổng tham vấn môi trường
`thamvan.mae.gov.vn`), cho **khối lượng và cao độ thiết kế**, hữu ích để *hiểu nhịp
bồi lắng* — nhưng **không phải bảng số đo sâu**. Giá trị nền, không phải nguồn điểm.

### 3.7. Bình đồ độ sâu — phát hiện lớn nhất phiên này

Bóc chú thích link (`/Annots → /URI`) trong 63 PDF thông báo độ sâu: **27 có link ra
ngoài (43%)**. Đích đến:

| Kiểu đích | Ví dụ đo được |
|---|---|
| Trang cảng vụ tỉnh, **link sâu tới đúng mục** | `cangvuhanghaikiengiang.gov.vn/index.aspx?page=detail&id=2642` |
| Trang cảng vụ tỉnh, chỉ trang chủ | `cangvuhanghaidongnai.gov.vn/`, `cangvuhaiphong.gov.vn` |
| Cổng quốc gia | `vimawa.gov.vn/vi/thong-bao-hang-hai` |
| **Google Drive** (!) | `byvn.net/hTbw` → `drive.google.com/file/d/19dBx…`; `q.me-qr.com/o0l0tcko` → thư mục Drive *"TBHH cty cp Nhà Rồng"* chứa `ban ve khao sat.pdf` |

Mở thử đích tốt nhất — TBHH 969/TBHH-CVHHKG, *luồng hàng hải Năm Căn – Bồ Đề năm 2026*:

```
Số liệu Bình đồ độ sâu được đăng tải tại đường link sau đây:
https://cangvuhanghaikiengiang.gov.vn/index.aspx?page=detail&id=2642
hoặc quét mã QR đính kèm:
```

→ `BINH_DO_KHAO_SAT.pdf`, **4,8 MB, 13 trang** (khớp đúng ký hiệu tờ `NC_072026_01_13`
… `NC_072026_13_13` ghi trong thông báo). Nội dung: **bình đồ khảo sát thuỷ đạc thật**
của *Xí nghiệp Khảo sát Bảo đảm an toàn hàng hải miền Nam* — số đo sâu dày đặc theo
tuyến đo, **đường đẳng sâu vẽ sẵn**, lưới toạ độ có dấu chữ thập, ghi chú máy hồi âm
200 kHz, và cả ghi chú **"fish traps"** (đăng đáy cá) — đúng thứ ngư dân cần.

**Đây là mỏ dữ liệu đúng nghĩa.** Vì sao vẫn chưa khai được: §5.

---

## 4. Kho trước 2025 nằm ở đâu

### 4.1. Wayback Machine giữ nguyên kho miền Nam — **2.105 PDF**

Truy vấn CDX (`web.archive.org/cdx/search/cdx?url=vms-south.vn*&filter=mimetype:application/pdf`):

- **2.105** URL PDF riêng biệt, trong đó **1.733 URL có chuỗi `TBHH`**
- Đường dẫn kiểu WordPress `/wp-content/uploads/<năm>/<tháng>/…`, nên **suy được năm
  ngay từ URL**, không cần mở file
- Phân bố theo năm:

| 2011 | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 23 | 39 | 54 | 87 | 184 | 132 | 229 | **284** | 277 | 266 | 180 | 172 | 170 | 5 |

Đối chiếu: `vms-north.vn` chỉ còn **112** PDF trong Wayback — nhưng không sao, nội dung
miền Bắc **đã** chuyển sống sang vmsa.vn. Mất mát nằm đúng ở miền Nam, và Wayback vá được.

### 4.2. Chất lượng theo năm — ranh giới scan/chữ là **năm, không phải vùng**

Lấy mẫu 1 file/năm qua `web.archive.org/web/<ts>id_/<url>`:

| Năm | Kết quả | | Năm | Kết quả |
|---|---|---|---|---|
| 2012 | ❌ SCAN (0 ký tự) | | 2020 | ✅ TEXT 884 kt, 8 toạ độ |
| 2013 | ❌ SCAN | | 2021 | ✅ TEXT 4.746 kt (`.signed.pdf`) |
| 2014 | ✅ TEXT 3.850 kt, 4 toạ độ | | 2022 | ✅ TEXT, **16 toạ độ** |
| 2015 | ❌ SCAN | | 2023 | ✅ TEXT, 8 toạ độ |
| 2016 | ❌ SCAN | | 2024 | ✅ TEXT, **216 toạ độ** ← bảng lớn |
| 2017 | ❌ SCAN | | 2025 | ✅ TEXT (`…-Signed.pdf`) |
| 2018 | ❌ SCAN | | | |

**6/6 mẫu 2012–2018 là ảnh · 6/6 mẫu 2020–2025 có lớp chữ.** Bước ngoặt trùng thời điểm
ngành chuyển sang **ký số** (`.signed.pdf`). Hệ quả thực dụng:

> Phần đáng lấy của kho Wayback miền Nam là **2019–2025 ≈ 1.354 PDF**, gần như toàn bộ
> có lớp chữ. Phần 2011–2018 (≈ 751 PDF) là ảnh — và §5 nói vì sao đừng đụng vào.

---

## 5. VIỆC 3 — 47% ảnh scan: OCR có đáng làm không?

**Trả lời ngắn: KHÔNG, và lý do không phải "OCR yếu".**

### 5.1. Tesseract tiếng Việt có tồn tại

`vie.traineddata` là gói chính thức trong kho tessdata, dùng được. Tài liệu cộng đồng
Việt nêu ngưỡng ~97% *trên ảnh thí nghiệm sạch*, đồng thời nói thẳng ba điểm yếu:
**bảng nhiều cột**, **chữ xoay góc**, **ảnh chụp thực tế**. Ba điểm yếu đó trùng khít
với ba đặc tính của thứ ta cần bóc.

*(Máy hiện tại chưa cài tesseract — `tesseract --version` không có. Nhận định dưới đây
dựa trên **hình học đo được của ảnh**, không dựa trên một lần chạy thử.)*

### 5.2. Với BÌNH ĐỒ: chết ở độ phân giải, đo được

`BINH_DO_KHAO_SAT.pdf` (Năm Căn – Bồ Đề), đo từng trang:

- 13/13 trang: **0 ký tự chữ, 0 font, đúng 1 `/Image` `/DCTDecode`** → raster thuần
- Ảnh **3400 × 2889 px**; khổ trang **2592 × 2202 pt = 914 × 777 mm** (khổ A0 dẹt)
- ⇒ **3,72 px/mm**

Chữ số đo sâu trên bình đồ khảo sát thường cao **2–2,5 mm** ⇒ **7–9 px**. Chữ số
**hàng phân mét viết nhỏ hạ thấp** còn ~1,2–1,5 mm ⇒ **4,5–5,6 px**.
Ngưỡng Tesseract cần cho chữ số đáng tin là **≥ 20 px**. Ta đang thiếu **2–4 lần**.

### 5.3. Ba cái khó cộng thêm — mỗi cái đủ để hỏng riêng

1. **Quy ước chỉ số dưới.** Trên bình đồ, `18₈` nghĩa là **18,8 m**; `9₉` = 9,9 m.
   OCR thường sẽ đọc ra `188` hoặc `18 8` và **không biết chữ số nào là phần phân mét**.
   Đoán sai một lần là ra **188 m** hoặc **1,88 m** thay vì 18,8 m. Đúng cái mà đề bài
   cảnh báo: *sai một chữ số là sai độ sâu.*
2. **Chữ xoay theo tuyến đo.** Số đo bám theo đường chạy máy hồi âm, mỗi tuyến một góc.
   Không có góc chung để nắn thẳng.
3. **Số đè lên đường đẳng sâu.** Nét đẳng sâu cắt ngang chữ số; ở 7–9 px thì nét bản đồ
   và nét chữ **cùng độ dày**.

### 5.4. Có cách kiểm chéo không? — Có, nhưng nó chỉ *chặn*, không *cứu*

Hai cái kiểm rẻ, đều rút từ chính thông báo:

- **Độ sâu khống chế theo đoạn.** Thông báo cho câu kiểu *"Đoạn luồng từ phao số 8 đến
  phao số 12 +1.000 m … độ sâu đạt 1,8 m"*. Đó là **giá trị nhỏ nhất** của đoạn ⇒ mọi
  số OCR được trong đoạn đó phải **≥ 1,8 m**. Bắt được lỗi kiểu `1,88 → 188`.
- **Đường đẳng sâu kẹp hai bên.** Mỗi số nằm giữa hai đường đẳng sâu đã vẽ ⇒ chặn trên
  và chặn dưới.

Nhưng cả hai chỉ **loại bỏ** số sai, không **sửa** được. Ở tỷ lệ sai cao do thiếu điểm
ảnh, kết quả là **bỏ gần hết** — tốn công mà thu ít.

### 5.5. Với PDF THÔNG BÁO scan: OCR chạy được, nhưng rơi đúng chỗ vô ích

PDF thông báo là văn bản A4, chữ ~12pt, thẳng hàng — Tesseract `vie` xử lý được thật.
**Vấn đề là chỗ nó rơi vào:**

- Tỷ lệ scan cao tập trung ở **Hải Phòng** (12/25 theo đo lần trước) — mà Hải Phòng lại
  viết theo khuôn **"đoạn giữa hai phao"**, gần như **không có bảng toạ độ** để bóc.
- Miền Nam nơi *có* bảng toạ độ thì **91% đã có lớp chữ sẵn**, không cần OCR.

> **Công OCR đổ đúng vào nơi hình dạng dữ liệu tệ nhất.** Đó là lý do bỏ, không phải vì
> Tesseract kém.

### 5.6. Ước công sức

| Việc | Công | Thu về ước tính |
|---|---|---|
| OCR bình đồ raster ở 94 dpi | **rất cao** (phải tự huấn luyện bộ nhận chỉ số dưới + nắn xoay + nắn lưới toạ độ từng tờ) | thấp và **không đáng tin** |
| OCR PDF thông báo scan | trung bình (tesseract `vie` + hậu kiểm) | **gần bằng 0 điểm toạ độ** (§5.5) |
| **Xin/tìm bình đồ ở độ phân giải cao hơn** | **thấp — một lá thư** | mở khoá toàn bộ §3.7 |

**Khuyến nghị: đừng viết OCR. Đi đường 3.7 và đường "hỏi xin bản gốc" trước.**
Bình đồ vốn là bản vẽ số (plot ra), nên **bản nét gốc chắc chắn tồn tại** — thứ đang
phát hành chỉ là ảnh nén lại. Đây là việc *hỏi*, không phải việc *bóc*.

---

## 6. VIỆC 4 — Xếp hạng nguồn

Ước lượng dưới đây suy từ mẫu đã đo, **không phải chạy đủ**. Cột "thu về" tính theo
**đoạn luồng có độ sâu** và **điểm toạ độ**, vì §7 cho thấy đó mới là hình dạng thật.

| # | Nguồn | Thu về ước tính | Công | Độ tươi | Phủ vùng |
|---|---|---|---|---|---|
| **1** | **vmsa.vn — lọc theo TIÊU ĐỀ rồi mới tải** (`thông số kỹ thuật` + `luồng hàng hải`) | **51%** thông báo độ sâu có bảng toạ độ (23/45); mẫu 45 file cho **956** lượt toạ độ | **Thấp** — đường ống đã có, chỉ đổi bộ lọc | **≤ 3 tháng** | **Cả nước**, 25 vùng |
| **2** | **Wayback `vms-south.vn` 2019–2025** | **≈ 1.354** PDF, gần như toàn bộ có lớp chữ | **Thấp–TB** — CDX cho sẵn danh sách + năm | Lịch sử 2019–2025 | **Toàn miền Nam** — vá đúng lỗ thủng |
| **3** | **Bình đồ trên trang cảng vụ tỉnh** (Kiên Giang tốt nhất) | **Hàng nghìn số/tờ × 13 tờ/luồng** — cao nhất về lượng | **Rất cao** (raster, §5) trừ khi xin được bản nét | ≤ 3 tháng | Nơi nào TBHH có link (43%) |
| **4** | **`cangvuhaiphong.gov.vn`** (25 trang, `.signed.pdf` có chữ) | Vá đúng vùng scan nặng nhất | TB — phải bóc `file=` khỏi plugin pdfjs | ≤ 1 tháng | Hải Phòng + có cả TBHH tỉnh khác |
| **5** | Google Drive của doanh nghiệp cảng | Lẻ tẻ, mỗi bến một thư mục | TB — link ngắn, không có chỉ mục | thất thường | Rời rạc |
| **6** | `vimawa.gov.vn` | Không quét hàng loạt được (§3.3) | — | ≤ 1 ngày | Cả nước, dùng để **đối chiếu** |
| **7** | Báo cáo nạo vét / ĐTM | Không có bảng số đo | Cao | Theo dự án | Vài luồng lớn |
| **8** | OCR ảnh scan | ~0 điểm toạ độ (§5.5) | Cao | — | — |
| **✗** | `viwa.gov.vn` ĐTNĐ · Chi cục Thuỷ sản / cảng cá | **không tra được** | — | — | — |

**Xếp theo giá trị / công: 1 → 2 → 4 → 3.**

---

## 7. Hình dạng thật của dữ liệu — và vùng nào vẫn trắng

### 7.1. Không phải "điểm rời". Là **tim luồng + độ sâu theo đoạn**

Mở bảng toạ độ lớn nhất bắt được (Cà Mau, luồng Năm Căn – Bồ Đề, 156 lượt toạ độ):

```
Tên     Hệ toạ độ VN-2000              Hệ toạ độ WGS-84
điểm    Vĩ độ         Kinh độ          Vĩ độ          Kinh độ
T2      08°45'45,76"N 105°12'44,44"E   08°45'42,12"N  105°12'50,84"E
T2-1    08°46'05,70"N 105°12'23,10"E   08°46'02,06"N  105°12'29,50"E
…                                     (36 hàng đọc trọn vẹn)
```

**Bảng này không có cột độ sâu** — nó là **tim tuyến khảo sát**. Độ sâu nằm ở văn xuôi
ngay trên/dưới, **theo đoạn**:

> *Đoạn luồng từ phao BHHH số "0" đến phao số "4" +120 m … độ sâu đạt **4,5 m**.*
> *… từ phao "8" đến phao "12" +1.000 m … độ sâu đạt **1,8 m**.*

⇒ Ghép lại được **đường tim luồng gắn thuộc tính độ sâu từng đoạn**. Với bà con đi
biển, **một đường có độ sâu còn dùng được hơn một đám chấm rời** — và nó khớp đúng
hướng mà [thong-bao-hang-hai §6](thong-bao-hang-hai-2026-08.md) đã chỉ. Kiểu Vũng Tàu
(có cột độ sâu → cho điểm rời thật) là **thiểu số**.

**Cảnh báo kỹ thuật giữ nguyên**: bảng luôn in **hai hệ cạnh nhau**, phải đọc cột từ
dòng tiêu đề. **23/23** thông báo có bảng đều ghi rõ WGS-84 — tin tốt, nhưng vẫn phải
đọc tiêu đề, không mặc định.

### 7.2. Vịnh Thái Lan / Tây Nam Bộ — **KHÔNG trắng.** Chủ dự án đoán sai chỗ này

Nghi ngờ trong đề bài là hợp lý nhưng số liệu bác bỏ. Bắt được thật, đều có bảng toạ độ
WGS-84, đều trong 12 tháng:

| Nơi | Thông báo |
|---|---|
| **Năm Căn – Bồ Đề (Cà Mau)** | 156 lượt toạ độ + độ sâu 5 đoạn + **bình đồ 13 tờ** |
| **Rạch Giá** | *Thông số kỹ thuật luồng hàng hải Rạch Giá năm 2026* — 28 lượt, có link bình đồ |
| **An Thới (Phú Quốc)** | *…luồng hàng hải An Thới năm 2026* — 48 lượt, có link bình đồ |
| **Hà Tiên** | 24 lượt toạ độ |
| **Trạm kiểm ngư Phú Quốc** | 16 lượt |

Cà Mau công bố **20 mục/12 tháng**, Kiên Giang (An Giang) **21 mục**. Vùng vịnh Thái Lan
**đang được khảo sát và công bố đều** — nó chỉ *trông* trắng vì kho không có quá khứ.

### 7.3. Vùng thật sự trắng

| Vùng trắng | Mức | Vì sao |
|---|---|---|
| **Ngư trường xa bờ** | 🔴 **Trắng hoàn toàn** | **Toàn bộ** nguồn trong tài liệu này là *luồng hàng hải và vũng quay tàu*. Không nguồn nào cho số đo sâu ngoài khơi. Ngoài luồng, app vẫn chỉ có ETOPO |
| **Cửa lạch / cảng cá** | 🔴 **Trắng** | Không thuộc luồng hàng hải; cổng ĐTNĐ `viwa.gov.vn` đã chết; ngành thuỷ sản **không tra được** nguồn nào. **Đây là lỗ đau nhất** — cảng nhà của bà con nằm đúng ở đây |
| **Đắk Lắk (biển Phú Yên cũ)** | 🟠 Rất mỏng | **2** mục toàn kho |
| **Đồng Tháp (biển Tiền Giang cũ)** | 🟠 Rất mỏng | **3** mục toàn kho |
| **Thái Bình** | 🟠 Mỏng | 6 mục/12 tháng |
| **Quảng Bình · Quảng Nam** | ⚠️ **Trắng giả** | **0** mục trong 12 tháng — **không phải biển im lặng**: sau sáp nhập 2025, Quảng Bình gộp vào **Quảng Trị** (vọt lên 59) và Quảng Nam gộp vào **Đà Nẵng**. Nếu gom theo tên tỉnh sẽ tưởng hai vùng này mất dữ liệu |

> ⚠️ **Bẫy đặt sẵn cho người làm sau**: chuyên mục vmsa dùng **tên tỉnh sau sáp nhập
> 2025**. `an-giang-456` thực chất là **Kiên Giang** (số hiệu `CVHHKG`); `gia-lai-449`
> là **Quy Nhơn** (`CVHHQN`); `lam-dong-457` là **Bình Thuận** (`CVHHBT`);
> `tp.-ho-chi-minh-452` gồm cả **Vũng Tàu**. Gán nhãn theo slug mà không tra số hiệu
> cảng vụ sẽ **đặt Kiên Giang lên An Giang** — một tỉnh không có biển giáp Rạch Giá.
> Nguồn đúng để gán vùng là **số hiệu `TBHH-CVHHxx`**, không phải slug.

---

## 8. Ba nguồn nên làm trước

**1. Đổi bộ lọc trên vmsa.vn — công thấp nhất, hiệu quả cao nhất.**
Không sửa gì trong bộ bóc PDF. Chỉ lọc **tiêu đề** trước khi tải: lấy mục chứa
`thông số kỹ thuật` **và** (`luồng hàng hải` | `khu nước` | `vũng quay tàu`), bỏ hẳn
mục về phao/báo hiệu/thi công. Mẫu đo: tỷ lệ có bảng toạ độ đi từ **8% → 51%**.
Thêm nữa: nhận **cả hai** hình dạng — *(a)* bảng có cột độ sâu → điểm rời;
*(b)* bảng tim tuyến + độ sâu theo đoạn ở văn xuôi → **đường có độ sâu** (§7.1).
Hình dạng (b) là đa số, hiện đang bị vứt vào `boSot`.

**2. Kéo kho Wayback `vms-south.vn` 2019–2025 — vá đúng lỗ thủng miền Nam.**
CDX đã cho sẵn 2.105 URL kèm năm trong đường dẫn; cắt lấy **≈1.354** file từ 2019 trở đi
(khoảng cắt lấy từ §4.2, không đoán). Đây là cách duy nhất tìm được để có **chiều sâu
lịch sử của miền Nam** — thứ mà vmsa.vn vĩnh viễn không có. Nhớ giữ `prov.origin` trỏ
về URL gốc **và** dấu thời gian Wayback.

**3. `cangvuhaiphong.gov.vn` — vá đúng vùng tệ nhất.**
Hải Phòng là 32% kho và cũng là nơi scan nặng nhất. Trang riêng của cảng vụ có **25
trang** thông báo và phát **`.signed.pdf` có lớp chữ** (đã đo: 3.144 ký tự, 16 toạ độ).
Đây là cách **né OCR mà vẫn lấy được Hải Phòng**. Lưu ý kỹ thuật: URL PDF nằm trong
tham số `file=` của `pdfjs-viewer-shortcode`, phải bóc ra rồi tải thẳng.

**Việc thứ tư, không phải kỹ thuật, nhưng đòn bẩy lớn nhất**: bình đồ độ sâu (§3.7) là
mỏ thật — hàng nghìn số mỗi tờ, có sẵn đẳng sâu, có sẵn lưới toạ độ. Thứ đang chặn chỉ
là **ảnh nén 94 dpi**. Bản nét gốc chắc chắn tồn tại ở Xí nghiệp Khảo sát BĐATHH.
**Hỏi xin rẻ hơn viết OCR rất nhiều lần** — và đó là việc của người, không phải của code.

---

## Assumptions

- **Ước "≈1.354 PDF 2019–2025"** cộng từ phân bố năm trong URL Wayback (284+277+266+180+172+170+5).
  Đây là **số URL PDF riêng biệt**, chưa trừ bản trùng kiểu `_1`, `_11`. Con số thật có
  thể thấp hơn ~10–15%.
- **Tổng theo vùng phiên này cộng ra ≈8.022**, lệch ~141 so với **8.163** đo lần trước.
  Nguyên nhân: cách đo ở đây là *offset cuối + số mục trang cuối*, mà widget phân trang
  không phải lúc nào cũng lộ offset cuối thật. Con số **8.163** vẫn là con số nên dùng;
  **tỷ trọng** Bắc/Nam không đổi vì lệch rải đều.
- **"Chữ số đo sâu cao 2–2,5 mm"** là quy ước in bình đồ khảo sát, **không đo trực tiếp
  từ file** (ảnh không có thang mm). Kết luận OCR đứng vững cả khi chữ cao 3 mm
  (⇒ 11 px, vẫn dưới ngưỡng 20 px).
- **Chưa cài tesseract** trên máy này, nên §5 là **phân tích hình học**, không phải kết
  quả chạy thử. Muốn chắc thì chạy một tờ bình đồ với `--psm 11 -c tessedit_char_whitelist=0123456789`
  và đếm tỷ lệ khớp so với số đọc tay trên một ô lưới.
- **10/22 trang cảng vụ chỉ mới dò HTTP 200**, chưa dò cấu trúc mục thông báo và chưa
  đo chất lượng PDF (§3.2 hàng cuối). Có thể còn nguồn tốt chưa lộ.
- **Tỷ lệ 51% có bảng toạ độ** đo trên **45 thông báo miền Nam đã lọc theo tiêu đề**.
  Chưa kiểm lại trên miền Bắc với cùng bộ lọc — Hải Phòng nhiều khả năng vẫn thấp hơn
  hẳn vì khuôn viết "đoạn giữa hai phao".
