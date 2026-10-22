# 12 — Mắt xích gió → mồi, và bước C2 làm lại với gió CMEMS đủ 4 hộp (đo 2026-10-22)

**Load khi / Load when**: trước khi đưa "mồi", "nước trồi" hay "chlorophyll" vào bất kỳ dự báo nào, hoặc trước khi dùng kết luận "gió mùa vào muộn" của 10. **Sửa một phần 10.** Bảng số gốc: `12b-gio-moi-bang-so.md` (mắt xích gió → mồi) và `12c-c2-cmems-bang-so.md` (C2 với gió CMEMS).

> Chỉ đọc nguồn công khai, không sửa app. Gió: CMEMS `WIND_GLO_PHY_L4_MY_012_006` theo giờ, đọc ẩn danh từ kho Zarr của Copernicus Marine, 0,25° (1/6/1994 → 31/10/2009) nối 0,125° (11/1/2007 → 20/6/2026), 1 700 ô thuộc 5 hộp. Chlorophyll: ESA OC-CCI v6.0 theo 8 ngày qua ERDDAP NOAA PIFSC, 4/9/1997 → 26/6/2026, lưới ≈0,125°. Hộp: `scripts/dong-dan/hop.mjs` (giả định theo Herrmann 2023). Script: `tai-gio-cmems.mjs`, `tai-chl-occi.mjs`, `phan-tich-ekman.mjs --gio cmems`, `phan-tich-gio-moi.mjs`. Chạy lại trên Mac ra giống hệt bản PC GPU.

## 0. Kết luận (đọc nếu chỉ có 1 phút)

| Câu hỏi | Trả lời | Mức tin |
|---|---|---|
| **Gió có đẩy mồi (thực vật phù du) không?** | **Có, mạnh.** Giữa các năm, gió dọc bờ hè (6–9) giải thích phần lớn chl hè: SCU r **0,82** [CI 90 % 0,68–0,92], OFU 0,82 [0,60–0,91], MKU 0,76 [0,59–0,86]. Trong mùa, chl phản ứng sau **0–16 ngày** (SCU, MKU đỉnh 0–8 ngày; OFU đỉnh 8–16 ngày), tắt sau ~24 ngày; mọi hệ số vượt ngưỡng xáo năm | Cao — mắt xích MẠNH NHẤT cả nghiên cứu |
| **NCU (bắc Khánh Hoà) có theo gió không?** | **Không**, và giữa các năm còn **ngược** (r −0,40): gió thuận cho SCU/OFU/MKU thì bất lợi cho NCU — đúng như Herrmann 2023 | Cao |
| **ENSO có đi tới tận mồi không?** | **Có chiều, không có mức.** ONI T12–2 ↔ chl hè: SCU r −0,57, OFU −0,52 (trong mẫu). Sau El Niño, chl hè SCU rơi nhóm thấp **4/4 năm** (p 0,012), OFU **3/3** (p 0,04); sau La Niña **0/4**. Nhưng hồi quy bỏ-từng-năm: skill +0,12 [−0,08…+0,27], CI chạm 0 | Vừa (dạng xác suất); không nói mức |
| **Mắt xích yếu nằm ở đâu?** | **ENSO → gió**, không phải gió → mồi. ONI T12–2 ↔ gió hè chỉ r −0,33…−0,36 (cả ERA5 lẫn CMEMS), hồi quy bỏ-từng-năm skill ≈ 0 ở mọi hộp | Cao |
| **"Gió mùa vào muộn sau El Niño" (10) còn đứng không?** | **Hạ xuống "vừa".** Ngày gió vào nhạy với nguồn: ERA5 và CMEMS chỉ khớp r 0,66; năm 1998 ERA5 nói giữa tháng 9, CMEMS nói đầu tháng 6. Trên 4 năm sau El Niño mà CMEMS có, muộn 3/4 (p 0,11). Chiều "gió hè yếu hơn" thì chắc: hai nguồn cùng r −0,35 với ONI | Vừa |
| **Mồi vào mùa muộn theo gió không?** | OFU, MKU: ngày chl đạt mức hè theo sát ngày gió (r 0,66 và 0,76), **chậm hơn gió 16–24 ngày** (trung vị). SCU: không đo được (r 0,07, chỉ số ngày ở SCU nhiễu) | Vừa (OFU, MKU) |

**Ý nghĩa cho phương pháp:**
1. Hướng đáng đầu tư nhất **không phải tầng cổng hay ENSO**, mà là **gió dự báo → mồi 1–3 tuần tới**: gió dự báo 10–15 ngày (ECMWF, PHY_001_024) đã khá tốt, mồi theo gió với độ trễ 0–16 ngày đã đo được. Đây là cách duy nhất kéo dài tầm dự báo mồi lên 2–4 tuần với số đo hiện có. Còn phải kiểm "mồi → cá" (bước B, trên nhãn chuyến) trước khi nói gì về cá.
2. Tầng khí hậu (ENSO) chỉ cho được **một câu xác suất theo mùa**, và giờ câu đó có thêm vế mồi: *"năm sau El Niño, gió mùa ở Nam Trung Bộ thường yếu hơn, nước ven bờ ấm hơn, và nước ít mồi hơn mọi năm"*. Không nói con số.
3. **Không dùng chung một câu cho cả bờ biển.** NCU đi ngược SCU/OFU/MKU.

**Dự báo khoá trước hè 2027** (bổ sung 09, 10; kiểm tháng 10/2027): El Niño 2026 đang đạt đỉnh (ONI T7–9 = +2,16), mùa đông 2026/27 gần như chắc ≥ 1.
1. **Chl hè 2027 (6–9) ở SCU rơi vào nhóm thấp** (tercile dưới 1998–2025). Lịch sử 4/4. Mô hình ONI T7–9 năm trước cho dị thường −0,135 log10 (≈ −27 %), ngưỡng nhóm thấp −0,007.
2. **Chl hè 2027 ở OFU rơi vào nhóm thấp.** Lịch sử 3/3. Mô hình cho −0,096.
3. **NCU: không khoá gì** (không có quan hệ).

## 1. Trong mùa: chl phản ứng với gió sau bao lâu (chl 5–10, dị thường theo khe 8 ngày, 29 năm)

r giữa dị thường gió trung bình 8 ngày **trước** k cửa sổ và dị thường log10 chl. In đậm = vượt ngưỡng 95 % của phép xáo năm **và** CI 90 % (bootstrap theo năm) loại 0.

| Hộp · gió | 0 ngày | 8 ngày | 16 ngày | 24 ngày | 32 ngày |
|---|---|---|---|---|---|
| SCU · ứng suất đông | **0,38** | **0,40** | **0,21** | 0,08 | 0,11 |
| SCU · vận chuyển Ekman ra khơi | **0,35** | **0,34** | **0,15** | 0,03 | 0,06 |
| OFU · ứng suất đông | **0,22** | **0,38** | **0,36** | **0,24** | **0,16** |
| OFU · bơm Ekman | **0,14** | **0,23** | **0,25** | **0,19** | **0,15** |
| MKU · ứng suất đông | **0,51** | **0,45** | **0,23** | 0,07 | 0,09 |
| NCU · ứng suất bắc / Ekman | −0,03 | −0,03 | 0,01 | −0,05 | −0,06 |

Đọc: ven bờ (SCU, MKU) mồi lên gần như ngay trong cùng tuần gió, tắt sau ~3 tuần. Ngoài khơi (OFU, do bơm Ekman) chậm hơn một tuần và kéo dài hơn. Khớp chuyển vị "gió → chl 3–7 ngày" của 03 ở ven bờ. Bơm Ekman ven bờ (SCU, MKU) cho r gần hằng số mọi trễ với CI rất rộng ⇒ chuỗi đó có vấn đề (xem §4), không dùng.

## 2. Liên năm, ENSO, thời điểm

**Gió hè ↔ chl hè** (dị thường 6–9, 27–28 năm): SCU 0,82 · OFU 0,82 · MKU 0,76 · NCU −0,40 (ứng suất bắc).

**ENSO → chl hè** (28 năm; phân nhóm theo ONI T12–2):

| Hộp | r trong mẫu (ONI T12–2) | r bỏ-từng-năm | skill MAE [CI 90 %] | Sau El Niño: chl nhóm thấp | Sau La Niña |
|---|---|---|---|---|---|
| SCU | −0,57 | 0,45 | +0,12 [−0,08…+0,27] | **4/4** (1998, 2010, 2016, 2024; p 0,012) | 0/4 |
| OFU | −0,52 | 0,38 | +0,07 [−0,17…+0,24] | **3/3** (p 0,04) | 0/4 |
| MKU | −0,43 | 0,24 | −0,11 | 3/4 (p 0,11) | 2/4 |
| NCU | −0,04 | — | ≤ 0 | 3/4 | 1/4 |

Lưu ý: 2016 và 2024 chỉ thấp nhẹ (−0,03, −0,02 log10), sát ngưỡng nhóm thấp; hai năm mạnh là 1998 và 2010 (−0,23, −0,16). Hè thấp nhất ngoài El Niño: 2020 (gió yếu nhất chuỗi, ONI T12–2 chỉ 0,71) — mồi theo **gió**, không theo ENSO.

**Thời điểm**: ngày chl đạt mức hè trễ hơn ngày gió đạt mức hè 16 ngày (SCU, MKU) đến 24 ngày (OFU), trung vị. Sau El Niño, chl vào muộn 3/4 năm ở cả ba hộp (1998 rất muộn: tháng 11–12).

## 3. C2 làm lại với gió CMEMS (1994–2025)

- **Gió ↔ nước lạnh ven bờ** (đồng thời, 6–9): SCU r −0,65 với SST ven bờ; OFU, MKU tương tự (−0,63, −0,64); NCU không (+0,09). Mạnh hơn bản ERA5 3 điểm.
- **ONI → gió**: hồi quy bỏ-từng-năm không có skill ở hộp nào (SCU, OFU, MKU đều ≈ 0). Phân nhóm sau El Niño chỉ còn 4 năm (CMEMS bắt đầu 6/1994): gió yếu 2–3/4, vào muộn 3/4 — không đủ cho p < 0,05.
- **ERA5 và CMEMS cùng giai đoạn 1995–2025**: gió hè SCU khớp r 0,94–0,96; tương quan với ONI như nhau (−0,33…−0,36). Kết luận C2 về **chiều** không phụ thuộc nguồn; kết luận về **ngày vào** thì có (§0).

## 4. Giới hạn trung thực

- **Chl mặt biển ≠ mồi của cá.** Đây là thực vật phù du ở mặt; động vật phù du, cá mồi, cá chưa đo. Cực đại dưới mặt 65–85 m (03 §4) vệ tinh không thấy.
- **Mây**: phủ trung bình 61–73 % ô mỗi mốc 8 ngày; mốc < 30 % ô bị bỏ; mùa có < 60 % mốc bị bỏ (1999–2001, 2013 thiếu ở một số hộp).
- **MKU sát châu thổ Mê Kông**: chl có thể lẫn phù sa/nước sông; quan hệ với gió vẫn mạnh nên không phải nhiễu thuần.
- **Nối hai bộ gió**: hai bộ khớp theo ngày (r 0,86–0,999) nhưng lệch mức, rõ nhất ở bơm Ekman ven bờ (SCU 0,14 so với 0,36 m/ngày). Đã cộng độ lệch theo tháng đo trên khúc chồng 2007–2009 (`noi-bo.json`). Bơm Ekman ven bờ SCU, MKU vẫn cho quan hệ gần hằng số theo trễ với CI rất rộng ⇒ còn bậc/xu thế, **không dùng** hai chuỗi đó.
- **n nhỏ ở đuôi ENSO**: 4 năm sau El Niño có chl; p của phân nhóm chưa hiệu chỉnh đa phép thử (thử ~8 tổ hợp hộp × ONI).
- Ứng suất tự tính từ gió (công thức khối, Cd hằng) vì ứng suất có sẵn của CMEMS quá thô (0,01 N/m²).

## 5. Việc tiếp theo đề xuất

1. **Kiểm "mồi → cá" (bước B)** trên nhãn chuyến: đặc trưng chl 0–16 ngày trước và gió 0–8 ngày trước, cho cá nổi nhỏ và mực xà ở SCU/MKU. Đây là mắt xích quyết định có làm sản phẩm dự báo mồi hay không.
2. **Thử dự báo mồi 1–3 tuần**: thay gió quan sát bằng gió dự báo đã lưu trữ (ECMWF hoặc PHY_001_024), đo skill chl ở trễ 8/16 ngày so với quán tính.
3. Tách chỉ số bơm Ekman ven bờ khỏi phép nối (dùng riêng bộ 0,125° từ 2007) nếu cần.
