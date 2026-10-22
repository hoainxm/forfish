# 10 — Bước C2: đo lại cổng ONI → nước trồi bằng chỉ số GIÓ (Ekman), không bằng SST (đo 2026-10-22)

**Load khi / Load when**: trước khi viết bất kỳ câu nào về "nước trồi yếu/muộn năm sau El Niño" cho bà con, hoặc trước khi làm thẻ triển vọng vụ. **Sửa một phần kết luận của 09**. Bảng số gốc: `10b-buoc-C2-bang-so.md`.

> Chỉ đọc nguồn công khai, không sửa code. Gió: ERA5 10 m theo giờ qua Open-Meteo archive, **lưới 0,5° 20 điểm** phủ hộp SCU (nước trồi ven bờ Nam Trung Bộ, 10,5–12°N × 108,5–110,5°E), 1982-01-01 → 2026-10-20. SST: OISST v2.1 như 09. ONI (CPC), PDO (NCEI). Script ở scratchpad phiên (`buocC/phan-tich-ekman.mjs`), không vào git.

## 0. Kết luận (đọc nếu chỉ có 1 phút)

| Câu định nói với bà con | Chỉ số gió 44 năm nói gì | Dùng được không |
|---|---|---|
| "Sau mùa đông El Niño, **gió mùa tây nam vào muộn**" | **Có, mạnh.** Ngày gió dọc bờ đạt mức hè điển hình: sau El Niño (ONI T12–2 ≥ 1) rơi vào nhóm muộn (≥ 23/6) **6/7 năm**, tỉ lệ gốc 1/3 (năm trung tính 8/31). Xác suất do ngẫu nhiên ≈ 0,7 %. Trung bình 14/7 so với 19/6 | **Dùng được**, dạng xác suất, phát từ tháng 3. Biết từ tháng 10 năm trước (ONI T7–9 ≥ 1): 3/4 năm |
| "…nên **ít nước lạnh trồi lên** ven bờ" | **Có, vừa.** Chỉ số Herrmann (UI) rơi nhóm thấp 5/7 năm sau El Niño (gốc 1/3, p ≈ 0,05); **không năm nào sau La Niña** (0/6). Hồi quy bỏ-từng-năm: ONI T12–2 × dấu PDO skill +0,16 [CI 90 % +0,005…+0,29] | Dùng được dạng "khả năng cao ít nước lạnh" |
| "…và **gió cả hè yếu**" (trung bình 6–9) | **Yếu.** Tương quan đúng dấu (ONI T12–2 ↔ ứng suất gió dọc bờ r −0,37) nhưng chỉ nhờ 3 năm lớn (1983, 1998, 2010); nhóm gió yếu sau El Niño 3/7 ≈ tỉ lệ gốc. Hồi quy bỏ-từng-năm: skill +0,03 [−0,09…+0,13] | **Không nói** "gió cả hè yếu". Có thể nói "ít khả năng có hè gió mạnh": 0/7 năm sau El Niño rơi nhóm gió mạnh (gốc 1/3, p ≈ 0,06) |
| Mức độ (bao nhiêu ngày muộn, bao nhiêu độ lạnh) | Hồi quy tuyến tính không có skill trên MAE với mọi chỉ số gió | Không nói con số |

> **ĐÃ SỬA một phần bởi `12-gio-moi.md` (cùng ngày):** làm lại với gió CMEMS đủ 4 hộp — chiều "gió hè yếu hơn sau El Niño" đứng vững (hai nguồn cùng r −0,35 với ONI), nhưng **ngày gió vào nhạy với nguồn** (ERA5 vs CMEMS r 0,66; 1998 lệch hơn 3 tháng), nên "vào muộn 6/7" hạ xuống mức **vừa**. Câu thẻ triển vọng nên dùng bản ở 12 §0.

**Sửa kết luận 09**: 09 cấm câu "muộn" vì đo khởi phát bằng SST thì 36/45 năm bão hoà ngay 1/5. Đo bằng gió thì câu "gió mùa tây nam vào muộn sau El Niño" **có cơ sở mạnh nhất cả nghiên cứu**. Câu "nước trồi yếu" được phép ở dạng xác suất ("khả năng cao ít nước lạnh"), không ở dạng mức độ.

**Câu thẻ triển vọng đề xuất** (phát tháng 3 khi ONI T12–2 ≥ 1): *"Năm nay sau El Niño. Những năm như vậy, gió mùa tây nam ở Nam Trung Bộ thường vào muộn (6 trên 7 lần, giữa tháng 7 thay vì giữa tháng 6) và nước ven bờ ít lạnh hơn. Tham khảo, không phải lời hứa."* Kèm danh sách năm tương tự: 1983, 1987, 1992, 1998, 2010, 2016, 2024.

**Dự báo khoá trước hè 2027** (bổ sung cho 09, kiểm tháng 10/2027): El Niño 2026 đang đạt đỉnh (ONI T7–9 = +2,16), nên 2027 là năm sau El Niño. Khoá:
1. **Ngày gió dọc bờ SCU đạt mức hè điển hình ≥ 23/6** (doy ≥ 174). Xác suất theo lịch sử 6/7.
2. **Gió dọc bờ trung bình 6–9 không rơi vào nhóm mạnh** (tercile trên). Lịch sử 7/7.
3. **UI (Herrmann) 6–9 rơi vào nhóm thấp**. Lịch sử 5/7.
4. (từ 09) Nhiệt mặt biển ven bờ 6–8 ấm hơn khí hậu, +0,92 ± 0,61 °C.

## 1. Chỉ số

Theo Herrmann và cộng sự 2023 (*Ocean Science* 19, 453–467): bài dùng ba chỉ số gió trên hộp — cường độ ứng suất, thành phần đông, thành phần bắc — và chỉ số nước trồi SST `UI = T_ref − SST` chỉ ở ô có SST < T_o. Bài **không in toạ độ hộp** (chỉ có trên hình 1b) và **không cho công thức Ekman**, nên phần dưới là cách tôi dựng [GT]:

| Chỉ số | Cách tính | sd dị thường 6–9 |
|---|---|---|
| `SCU_ti` | trung bình hộp của \|τ\|, τ = ρa·Cd·\|U\|·U (ρa 1,22; Cd 1,2×10⁻³), trung bình ngày từ gió theo giờ | 13×10⁻³ N/m² |
| `SCU_tE` | thành phần đông của τ (bài: r 0,71 với nước trồi SCU theo ngày) | 12×10⁻³ N/m² |
| `SCU_Mek` | vận chuyển Ekman ra khơi = τ dọc trục bờ 25° / (ρw·f) | 0,37 m²/s |
| `SCU_wEk` | bơm Ekman = curl τ/(ρw·f), sai phân trung tâm trên lưới 0,5° | 0,46 m/ngày |
| `UI_SCU`, `UI_OFU` | UI theo bài: T_o 27,6 °C; T_ref = 28,77 °C (OISST 6–9 hộp tham chiếu 1982–2025; bài dùng 29,2 °C của mô hình) | 0,29 / 0,25 °C |
| `onsetW` | ngày đầu ≥ 1/5 mà trung bình trượt 15 ngày của `SCU_tE` đạt khí hậu 6–9 của chính nó (ngưỡng rút từ khí hậu, không đặt tay) | trung vị 18/6 |

**Kiểm chỉ số có "thấy" nước trồi không** (tương quan năm, 6–9, đồng thời): `SCU_wEk` ↔ SST ven bờ **−0,71**; `SCU_tE` ↔ SST ven bờ −0,59, ↔ UI +0,49. Gió mạnh thì nước ven bờ lạnh — chỉ số đúng vật lý, độ lớn hợp với r 0,64–0,71 theo ngày của bài.

## 2. Kết quả

**Dấu** (tương quan trong mẫu, n 44): ONI T12–2 ↔ `SCU_tE` −0,37 · ↔ `SCU_wEk` −0,39 · ↔ UI −0,50 · ↔ SST ven bờ +0,61 · ↔ ngày khởi phát gió **+0,43**. Cùng chiều với y văn: El Niño mùa đông → gió mùa tây nam hè sau yếu và muộn → ít nước trồi → nước ấm.

**Phân nhóm** (tercile trên toàn 44 năm 1983–2026):

| Kết cục | Sau El Niño (T12–2 ≥ 1, n 7) | Trung tính (n 31) | Sau La Niña (≤ −1, n 6) | Biết từ T10 năm trước (T7–9 ≥ 1, n 4) |
|---|---|---|---|---|
| Gió vào muộn (≥ 23/6) | **6/7** | 8/31 | 2/6 | 3/4 |
| UI thấp (ít nước lạnh) | **5/7** | 10/31 | **0/6** | 3/4 |
| Bơm Ekman yếu | 4/7 | 10/31 | 1/6 | 3/4 |
| Gió dọc bờ yếu | 3/7 | 10/31 | 2/6 | 2/4 |
| Gió dọc bờ **mạnh** | **0/7** | — | — | 0/4 |

Năm sau El Niño: 1983 (gió −12, vào 28/6), 1987 (−2, 18/6), 1992 (−1, 26/6), 1998 (**−22, 14/9**), 2010 (**−28, 9/8**), 2016 (−1, 6/7), 2024 (0, 24/6). Đơn vị gió ×10⁻³ N/m² dị thường.

**Hồi quy bỏ-từng-năm** (như 09): mọi chỉ số gió có r LOYO 0,2–0,3 (CI phần lớn loại 0) nhưng **skill MAE ≈ 0** (CI chứa 0). UI_SCU: ONI T12–2 × dấu PDO +0,16 [+0,005…+0,29]. UI_OFU: ONI T9–11 năm trước +0,13 [+0,03…+0,25]. Nghĩa là: biết El Niño thì biết **chiều** và **khả năng**, không biết **mức**.

Năm 2026: mùa đông trung tính (ONI T12–2 −0,39) mà gió vẫn vào muộn (2/7), gió hè mạnh (+13). Muộn không chỉ do El Niño.

## 3. Giới hạn trung thực

- **Chỉ hộp SCU.** OFU, MKU, NCU không tải được: Open-Meteo miễn phí tính lượt theo điểm × ngày, 120 điểm × 45 năm cần ~140 nghìn lượt, gấp 14 lần hạn một ngày. Hàng 12,5°N của SCU cũng bị bỏ cho đồng nhất. Muốn đủ bốn hộp: ERA5 từ Copernicus CDS (cần tài khoản, miễn phí, CC-BY) hoặc chạy tải nhiều ngày.
- **Toạ độ hộp và trục bờ là giả định**; bài gốc không in số.
- **n nhỏ ở đuôi**: 7 năm sau El Niño, 6 năm sau La Niña. p ≈ 0,7 % cho "muộn 6/7" đã tính tỉ lệ gốc 1/3, nhưng tôi thử ~5 kết cục phân nhóm; hiệu chỉnh Bonferroni vẫn < 5 % cho "muộn", **không còn** cho "UI thấp" (p ≈ 0,05) và "không có gió mạnh" (p ≈ 0,06).
- **Ngày khởi phát là định nghĩa của tôi** ("đạt mức hè điển hình"), không phải ngày bắt đầu gió mùa chính thức của khí tượng.
- ERA5 qua Open-Meteo là bản nội suy về điểm; curl trên lưới 0,5° bỏ qua cấu trúc nhỏ hơn 50 km sát bờ.
- Vẫn chưa có chl: mắt xích "gió → mồi" chưa đo.

## 4. Hệ quả cho phương pháp

- Tầng khí hậu (K) của "Dòng Dẫn" có **một đầu ra kiểm chứng được**: xác suất gió mùa tây nam vào muộn và ít nước lạnh ở Nam Trung Bộ, phát tháng 3, đúng 6/7 lần trong 44 năm. Đây là thứ đầu tiên của cả nghiên cứu đủ chuẩn đưa ra cho bà con, ở dạng một câu xác suất.
- Đầu ra này **không dùng nhãn cá** và **không nói gì về cá**. Muốn nói "vụ cá cơm / cá nục muộn", phải kiểm thêm trên nhãn chuyến (bước 0 có 102 nghìn chuyến nhưng chỉ một năm, và 2026 là năm trung tính) hoặc sản lượng tỉnh nhiều năm (Q2).
- Đề xuất tiếp: (1) tải đủ OFU/MKU/NCU qua CDS; (2) dựng thẻ ở dạng mockup để anh Long duyệt câu chữ; (3) kiểm ba dự báo khoá 2027 vào tháng 10/2027.
