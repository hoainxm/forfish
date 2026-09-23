# Báo Cáo Bóc Tách Bản Tin Chỉnh Lý Hải Đồ - VMSA.vn
**Thực hiện:** 02/09/2026 (Tuần 36)  
**Nguồn:** https://vmsa.vn/thuy-dac-428/cap-nhat-hai-do-giay-433

---

## Tóm Tắt Kết Quả

| Chỉ Số | Giá Trị |
|--------|--------|
| **Tổng bài viết (bản tin tuần)** | 149 |
| **Tổng PDF tải về** | 160 |
| **Tổng dung lượng PDF** | 90 MB |
| **Phạm vi thời gian** | 01/01/2024 – 24/08/2026 |
| **Số tuần phủ** | 62 tuần duy nhất |
| **Số hải đồ duy nhất** | ~95–100 |
| **Tần suất cập nhật** | Hằng tuần |

---

## 1. Danh Mục Bản Tin

### Địa chỉ danh mục
`https://vmsa.vn/thuy-dac-428/cap-nhat-hai-do-giay-433`

### Phân trang
- **Trang 1** (offset 0): Items 1–20
- **Trang 2** (offset 20): Items 21–40
- **Trang 3** (offset 40): Items 41–60
- **Trang 4** (offset 60): Items 61–80
- **Trang 5** (offset 80): Items 81–100
- **Trang 6** (offset 100): Items 101–120
- **Trang 7** (offset 120): Items 121–140
- **Trang 8** (offset 140): Items 141–149

**Tổng cộng: 149 bài viết (bản tin tuần)**

---

## 2. Phạm Vi Thời Gian

### Khoảng phủ chính
| Năm | Tuần Đầu | Tuần Cuối | Bản Tin |
|-----|----------|-----------|---------|
| 2024 | Tuần 01 (01/01) | Tuần 27 (nửa năm) | ~26 |
| 2025 | Tuần 01 (01/01) | Tuần 48 (12/2025) | ~36 |
| 2026 | Tuần 06 (02/02) | Tuần 35 (24/08) | ~30–40 |

### Bản tin gần nhất
- **Ngày:** 24/08/2026
- **Tuần:** 35
- **Tiêu đề:** "CẬP NHẬT HẢI ĐỒ GIẤY NGÀY 24/08/2026 (TUẦN 35)"

---

## 3. PDF và Hải Đồ

### Thống kê file
- **Tổng file:** 160 PDF
- **Kích thước tổng:** 90 MB
- **Kích thước trung bình:** 586 KB
- **Phạm vi:** 140 KB – 8.2 MB

### Hải đồ được cập nhật
Số hải đồ từ tên file:
- 2025: Số 18–112 (và các biến thể)
- Các hậu tố: (T) Tentative, (P) Preliminary, _NEW_EDITION, (1), (2)...
- **Ước tính:** 95–100 hải đồ duy nhất

---

## 4. Hạn Chế Phân Tích: PDF Là Scanned Documents

**NHẬN ĐỊNH:** Tất cả 160 PDF đều là scanned documents (hải đồ giấy được quét thành ảnh).
- Không có text layer
- Không bóc được text bằng pdftotext, pdfjs-dist
- **Yêu cầu OCR (Tesseract) để đọc text**

### Thay Thế: Phân Tích Metadata
Phân tích dựa trên:
1. Tên file PDF (số hải đồ, năm, hậu tố)
2. Danh sách bài viết từ web (ngày, tuần)
3. Kích thước file

---

## 5. Phân Loại Hải Đồ

### Phân Bố Hậu Tố
| Loại | Số Lượng | Tỷ Lệ | Ý Nghĩa |
|------|----------|-------|---------|
| Không hậu tố | 114 | 71% | Bản tiêu chuẩn |
| (T) Tentative | 18 | 11% | Bản tạm (chưa xác nhận) |
| (P) Preliminary | 2 | 1% | Bản sơ bộ |
| _NEW_EDITION | 2 | 1% | Phát hành lại |
| (1), (2), (3)... | 24 | 15% | Biến thể, bản sửa |
| **Tổng** | **160** | **100%** | |

---

## 6. Tần Suất Cập Nhật

**Chu kỳ:** Hằng tuần  
**Phương thức:** Một bài viết trên web = Một bản tin tuần

### Số Lượng Bản Tin Theo Năm
```
2024: ~26 bản
2025: ~36 bản
2026: ~87 bản (từ tuần 6 đến 35)
──────────────
Tổng: ~149 bản
```

---

## 7. Cấu Trúc Mục Chỉnh Lý (Dự Kiến - Cần OCR)

Một mục chỉnh lý điển hình gồm:
```
Hải đồ số: [NUMBER]
Hành động: [THÊM | XÓA | ĐỔI]
Loại đối tượng: [PHAO | ĐÈN | ĐỘ SÂU | CHƯỚNG NGẠI | LUỒNG | XÁC TÀU]
Toạ độ: [LAT LONG]
Tham chiếu TBHH: [NOTICE NUMBER]
Ghi chú: [DETAILS]
```

### Phân Loại Thô (Ước Tính)
- **Phao & Đèn:** ~40–50%
- **Độ Sâu:** ~15–20%
- **Chướng Ngại:** ~15–20%
- **Khác:** ~10–15%

---

## 8. Dữ Liệu Đã Thu Thập

### Vị Trí Lưu Trữ
`C:\Users\admin\AppData\Local\Temp\claude\C--Code-ForFish\cc39577e-d7ad-4ca7-ae7d-395ebed5f0d5\scratchpad\ban-tin-tuan\`

### Các File
- `article_links_unique.txt`: 149 URL bài viết
- `pdf_links_all_unique.txt`: 160 URL PDF
- `pdfs/`: 160 file PDF (90 MB)
- `analysis_report.txt`: Phân tích metadata

---

## 9. Hạn Chế và Giải Pháp

### Hạn Chế Hiện Tại
1. PDF image-based → không bóc text
2. Không bóc được danh sách mục → cần OCR
3. Không trích được toạ độ → cần OCR + parsing
4. Phân loại thô → dựa vào dự đoán

### Giải Pháp
**OCR:** Cài Tesseract, chạy trên 160 PDF, parse output

---

## 10. Lộ Trình Tách Hoàn Chỉnh

### Bước 1: Thu Thập (✅ ĐÃ LÀM)
- ✅ Dò danh mục (149 bài viết)
- ✅ Tải 160 PDF (90 MB)
- ✅ Phân tích metadata

### Bước 2: Bóc Chữ (⏳ CẦN OCR)
- Cài tesseract-ocr
- Chạy OCR trên 160 PDF

### Bước 3: Cấu Trúc Hóa (📋 CÓ KHẢ NĂNG)
- Parse OCR → trích số hải đồ, hành động, loại đối tượng, toạ độ

### Bước 4: Phân Loại (📊)
- Phân loại theo từ khóa, hành động
- Tạo bảng thống kê

---

## 11. Tóm Tắt Đếm

| Chỉ Số | Con Số | Ghi Chú |
|--------|--------|---------|
| Bản tin tuần tổng | 149 | Từ 01/01/2024 – 24/08/2026 |
| PDF tải về | 160 | 90 MB tổng cộng |
| Tuần phủ | 62 | Tuần duy nhất |
| Hải đồ duy nhất | ~95–100 | Ước tính từ tên file |
| Mục chỉnh lý | TBD | Cần OCR |

---

## Kết Luận

VMSA.vn phát hành **bản tin chỉnh lý hải đồ giấy hằng tuần** với:
- 149 bài viết trên web
- 160 file PDF (scanned documents)
- Khoảng 95–100 hải đồ được cập nhật

Để tách **chi tiết danh sách mục chỉnh lý**, cần **OCR** trên 160 PDF rồi parse output.

---

**Báo cáo lập:** 02/09/2026  
**Trạng thái:** Giai đoạn 1 hoàn tất (thu thập + phân tích metadata)

---

# PHẦN II — OCR VÀ ĐỌC + ĐẾM + CẤU TRÚC (teammate OCR, 2026-09-02)

> Phần I ở trên là báo cáo thu thập của teammate trước, GIỮ NGUYÊN — kể cả các
> ước tính "cần OCR" của họ, để thấy được cái gì đoán đúng cái gì không. Phần
> này chạy chính bước OCR mà Phần I chỉ ra, bằng đường ống EasyOCR vi+en hai
> lượt đọc (chữ + số) trên GPU đã dựng cho Thông báo hàng hải
> ([ocr-mien-bac-2026-09.md](ocr-mien-bac-2026-09.md)).
>
> **CHƯA sinh dữ liệu phát hành nào** — đây là đọc + đếm + cấu trúc, chờ Lead
> quyết bước ghép vào kho sự kiện. Kho chữ nằm NGOÀI repo
> (`…\ban-tin-tuan\ocr\`, cạnh kho PDF).

## 12. OCR chạy được bao nhiêu

**160/160 file ra chữ đọc được, 0 lỗi** (231 trang, ~4 giây/trang GPU, DPI 300).

Trong 160 file: **156 là thông báo chỉnh lý** và **4 là BẢN TỔNG HỢP QUÝ**
(`SUMMARY_OF_NOTICES_TO_MARINERS Quarterly`) — bản gộp T&P đang hiệu lực, KHÔNG
phải mục mới, loại khỏi mọi con đếm dưới đây.

Sửa lại một nhận định của Phần I sau khi đọc được chữ: tên file dạng `2025_101`
**không phải số hải đồ** — đó là **SỐ THÔNG BÁO** (`101/2025`), đánh liên tục
trong năm. Số hải đồ nằm trong thân văn bản (`VN50016`, `VN4TB0512`…). Ước tính
"95–100 hải đồ" của Phần I vì vậy đo nhầm trục: 160 file phủ **153 mục thông
báo** và các mục ấy nhắc ~70 số hải đồ khác nhau.

## 13. Cấu trúc một mục chỉnh lý — đo trên chữ thật

Mỗi thông báo là MỘT mục, in **song ngữ hai nửa lặp nhau** (Anh trước, Việt
sau — đúng khuôn Notices to Mariners của Anh). Khung:

```
<SỐ>(P|T)?/<NĂM>  VIET NAM - <VÙNG BIỂN> - <NƠI>  <Đối tượng>.
Source: <cảng vụ>, Notice No. <số>/TBHH-<mã cơ quan>     ← tham chiếu TBHH
Chart VNxxxxx [previous update <số>/<năm>]               ← số hải đồ + mục trước
<động từ chỉnh lý> <đối tượng> <toạ độ...>
(All positions are referred to WGS84 Datum)
— rồi nguyên khối đó lặp lại bằng tiếng Việt —
```

Động từ chỉnh lý gặp thật: `Insert/Chèn` · `Replace … with …/Thay … bằng …` ·
`Move … from … to …/Chuyển … từ … tới …` · `Delete/Xoá` · `Amend/Sửa`.

**Toạ độ là ĐỘ + PHÚT THẬP PHÂN** (`17°56.19'`), KHÔNG phải độ-phút-giây như
bảng TBHH — bộ đọc toạ độ của soundings không dùng lại thẳng được, phải có bộ
tách riêng (đã viết trong script dò, ngoài repo).

### Ba ví dụ nguyên văn (chữ OCR, chưa sửa tay)

**(a) Độ sâu — `101/2025`, Quảng Ninh** (kiểu "vá số đo sâu trên hải đồ"):

```
101/2025 VIET NAM - NORTH EAST COAST QUANG NINH Depths.
Source: Maritime Administration Of Quang Ninh, Notice No. 1153/TBHH-CVHHQN
Chart VNsOOO6 [previous update 60/2024]
Insert depth, 21900.18'1 107922.21'5
Replace depth; 86 = with depth, 85 21901.34'1 107922.37'5
```

(`VNsOOO6` = VN50006 — chữ O đội lốt số 0; `21900.18'` = 21°00.18′ — ký tự độ
thành 9/0, cùng nhiễu đã đo ở đợt TBHH. `depth, 86` = 8₆ tức 8,6 m — hải đồ
viết số lẻ dạng chỉ số dưới.)

**(b) Dời phao — `104/2025`, Dung Quất:**

```
Move HP2 from: 15924.46'1 108947.545
to: 15024.42'1 108947.63'5
```

**(c) Xác tàu — `71(T)/2025`, Nghệ An:**

```
1.A wreck exists in position 18947.83N, 105945.67E
2. Mariners are advised to navigate with caution in the adjacent area.
Chart affected VN4OO14
```

## 14. Đếm toàn kho (153 mục, 156 file thông báo)

| | |
|---|---|
| mục có **số hải đồ** | 143 (93%) |
| mục có **tham chiếu TBHH** | 141 (92%) |
| mục có **toạ độ đọc được** | 105 (69%) |
| tổng cặp toạ độ (đã khử trùng nửa Anh/Việt) | **572** |
| mục có toạ độ văng >50 km khỏi cụm (cắt đỉnh lạc) | 2 |

Phân loại theo header (một mục một nhãn, ưu tiên xác tàu > chướng ngại > độ sâu > đèn > phao/tiêu):

| loại | mục | ghi chú |
|---|---|---|
| độ sâu (kể cả nạo vét) | 63 | Phần I đoán 15–20% — thực tế **41%**, nhóm LỚN NHẤT |
| phao / tiêu | 31 | Phần I đoán 40–50% — thực tế 20% |
| **xác tàu** | **7** | header ghi `Wreck` / `Tàu đắm` |
| chướng ngại | 2 | |
| đèn | 2 | |
| luồng / khác | 48 | trong đó: TB dạng khối 9 · phiên bản mới 8 · bắn đạn thật 6 · AIS 3 · cấm 2 · cầu 1 · còn lại 19 |

Phân bố theo số mục (mục đánh số liên tục trong năm — số thiếu = mục chưa có
trong kho tải về):

| năm | mục có | dải số | thiếu |
|---|---|---|---|
| 2024 | **0** | — | kho tải về không có PDF 2024 nào (bài viết 2024 của Phần I không đính PDF còn sống) |
| 2025 | 79 | 18–112 | 16 số (19–32 liền mạch, 48, 87) |
| 2026 | 74 | 32–139 | 34 số (33–57 gần như liền mạch…) |

⚠️ Hai khối thủng **liền mạch** (19–32/2025, 33–57/2026) trông giống *đợt bài
viết không còn link PDF sống* hơn là mất lẻ tẻ — muốn vá thì quay lại danh mục
đối chiếu `article_links_unique.txt`, không phải OCR thêm.

## 15. Ứng viên xác tàu / chướng ngại — 8 mục, 12 toạ độ

Gom vào `…\ban-tin-tuan\xac-tau-ung-vien.json` (NGOÀI repo, **chưa rà tay,
không phải dữ liệu phát hành**):

| mục | loại | hải đồ | toạ độ (WGS84) |
|---|---|---|---|
| 34/2025 | xác tàu (Hải Phòng) | VN50003 | 20,7127°B 107,0398°Đ |
| 40/2025 | chướng ngại (Q.Bình) | VN50017 | 3 điểm quanh 17,71°B 106,49°Đ |
| 106/2025 | chướng ngại (Q.Bình) | — | 3 điểm quanh 17,71°B 106,50°Đ |
| 41(T)/2025 | xác tàu (Hà Tĩnh) | VN40015 | 18,1147°B 106,5083°Đ |
| 71(T)/2025 | xác tàu (Nghệ An) | VN40014 | 18,7972°B 105,7612°Đ |
| 65/2026 | xác tàu (Q.Bình) | VN50017, VN30008 | 17,7583°B 106,5045°Đ |
| 69(T)/2026 | xác tàu (Vũng Tàu) | VN50033, VN30025 | 10,4408°B 106,9387°Đ |
| 83(T)/2026 | xác tàu (Vũng Tàu) | VN50033 | 10,4955°B 106,9487°Đ |

Cả 12 toạ độ nằm trong khung biển VN và sát bờ đúng vùng cảng — qua cổng
khung-biển + cụm-láng-giềng. Mỗi mục kèm `dong` (dòng OCR nguyên văn) để người
rà tay đối chiếu.

Một cái bẫy đã dính NGAY trong lúc gom, ghi lại vì nó sẽ cắn người sau: bộ lọc
ứng viên bản đầu dùng một regex RIÊNG (không có chữ `đắm`) thay vì dùng lại bộ
phân loại — và `34/2025`, một xác tàu THẬT ở Hải Phòng có toạ độ, rơi ra ngoài
im lặng. Một bộ phân loại = một bản duy nhất.

## 16. Đề xuất một câu

**Bắt đầu ghép từ lớp XÁC TÀU/CHƯỚNG NGẠI** (8 mục đã cấu trúc sẵn ở trên, giá
trị an toàn cao nhất trên mỗi mục và teammate lớp xác tàu đang cần đúng nó);
lớp "độ sâu" tuy lớn nhất (63 mục) nhưng trùng vai với đường TBHH → soundings
đã chạy, chỉ đáng ghép sau khi đối chiếu xem bản tin có gì mà TBHH gốc không có.
