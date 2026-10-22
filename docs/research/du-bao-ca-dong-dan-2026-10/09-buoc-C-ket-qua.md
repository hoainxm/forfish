# 09 — Bước C: triển vọng nước trồi Nam Trung Bộ theo mùa từ ONI, thuần vật lý (đo 2026-10-22)

**Load khi / Load when**: trước khi làm thẻ "triển vọng vụ theo vùng", hoặc khi ai đó định nói với bà con "năm El Niño thì nước trồi yếu" — load để biết câu nào dữ liệu 44 năm đỡ được, câu nào không. Bảng số gốc: `09b-buoc-C-bang-so.md`.

> Chỉ đọc nguồn công khai, không sửa code. Dữ liệu: **OISST v2.1** theo ngày 1982-01-01 → 2026-10-20 (NCEI THREDDS, hộp 10,875–13,375°N × 108,625–114,375°E, 264 ô, 16 364 ngày, đủ 100 %); **ERA5** gió 10 m theo giờ (Open-Meteo archive) 3 điểm 12°N 110°E · 11°N 110,5°E · 13°N 109,75°E; **ONI** (CPC), **PDO** (NCEI ERSSTv5). Chl: **không lấy được** (CoastWatch ERDDAP và PSL đều nghẽn suốt phiên) — xem §5. Script và dữ liệu thô ở scratchpad của phiên (`buocC/`), không vào git.

## 0. Kết luận (đọc nếu chỉ có 1 phút)

| Câu định nói với bà con | Dữ liệu 44 năm nói gì | Dùng được không |
|---|---|---|
| "Sau mùa đông El Niño, **nước mặt** vùng Nam Trung Bộ hè sau **ấm hơn bình thường**" | **Có.** ONI DJF → dị thường SST ven bờ JJA: r bỏ-từng-năm 0,58, skill MAE +0,17 [CI 90 % +0,01…+0,31], đúng dấu 72 % năm lớn; thêm dấu PDO: 0,64 / +0,22 [+0,06…+0,34], đúng dấu 79 % | **Dùng được**, lead 5 tháng (phát tháng 3 cho hè). Mức: +0,33 °C mỗi 1 °C ONI |
| "…biết trước từ mùa thu năm trước" | ONI SON−1: r 0,54, skill +0,14 [−0,02…+0,27]; ONI JAS−1: 0,47 / +0,11 [−0,03…+0,23] — CI chạm 0 | **Chỉ nói "có xu hướng"**, không nói mức |
| "…nên **nước trồi yếu**" (ven bờ bớt lạnh hơn khơi) | **Không.** Độ tương phản ven bờ − khơi JJA: mọi mô hình skill ≤ 0 (ONI DJF −0,02; ngay cả gió JJA đồng thời −0,01). Năm 2026 đang El Niño (ONI JJA +1,8) mà tương phản **mạnh hơn** thường (−0,48 °C) | **Không được nói** với dữ liệu này |
| "…và **muộn hơn**" (khởi phát lùi sang tháng 8) | **Không đo được** bằng SST: bờ đã lạnh hơn khơi tới mức "hè điển hình" ngay 1/5 ở 36/45 năm; năm muộn thật chỉ 2010 (doy 213), 2026 (149), 1982, 2019 (148). Không biến nào dự báo được (mọi skill ≤ 0) | **Không được nói**; cần chỉ số từ gió/chl, không từ SST |
| Đỉnh nước trồi (15 ngày lạnh nhất, 6–9) | Không dự báo được (mọi skill ≤ +0,04, CI chứa 0) | Không |

> **ĐÃ SỬA bởi `10-buoc-C2-ekman.md` (cùng ngày):** đo bằng chỉ số gió thay SST, câu "gió mùa vào muộn sau El Niño" có cơ sở mạnh (6/7 năm) và "ít nước lạnh" có cơ sở vừa (5/7). Hai dòng "Không được nói" ở bảng trên chỉ đúng cho thước đo SST. Đọc 10 trước khi dùng file này.

**Quyết của bước C:** thẻ triển vọng theo vùng **chỉ được phép nói một câu**: *"Hè này nước vùng Nam Trung Bộ có thể ấm hơn / lạnh hơn mọi năm (theo El Niño mùa đông)"*, kèm mức tin "vừa" và năm tham chiếu. Không nói "nước trồi yếu", không nói "muộn". Câu đó có giá trị gì cho cá là việc của tầng cá (bước B), chưa chứng minh — bước 0 cho thấy nhiệt mặt biển gần như không còn biến thiên trong tháng×vùng ở thang chuyến, nhưng **giữa các năm** thì có (sd 0,56 °C), và đây là tầng mà bước 0 không đo.

**Dự báo khoá trước hè 2027** (ghi hôm nay, kiểm tháng 9/2027): ONI JAS 2026 = +2,16, PDO JAS 2026 = −1,87 ⇒ mô hình ONI JAS−1 cho **S_JJA 2027 = +0,92 °C ± 0,61 (khoảng 80 %)**, tức hè 2027 nước mặt NTB **ấm hơn khí hậu ~1,6 độ lệch chuẩn**. Mô hình ONI DJF (phát tháng 3/2027) sẽ cập nhật con số này. Đối chiếu các năm sau El Niño mạnh: 1998 dự +0,67 / thật +1,22; 2016 dự +0,83 / thật **+0,26** (trượt); 2024 dự +0,50 / thật +0,81; 1983 dự ≈ +0,4 / thật 0,00 (trượt). **Về nước trồi yếu/muộn: không khoá dự báo nào**, vì không có skill.

## 1. Chỉ số và cách kiểm

- **S** = dị thường SST ven bờ (hộp 11,125–12,875°N × 108,875–110,375°E, 43 ô biển) so khí hậu ngày-trong-năm 1982–2025 (trơn ±15 ngày). **S_JJA** = trung bình 6–8. Dương = ấm = (giả thuyết) trồi yếu.
- **D** = SST ven bờ − SST khơi (112,625–114,375°E, 64 ô); **D_JJA** = dị thường mùa hè. Âm hơn = tương phản mạnh = trồi mạnh. Đây là thước đo "nước trồi" đúng nghĩa hơn S, vì S lẫn cả nóng lên toàn vùng do El Niño.
- **Khởi phát** = ngày đầu ≥ 1/5 mà trung bình trượt 15 ngày của D thô xuống tới mức khí hậu JJA (−0,37 °C, rút từ khí hậu, không đặt tay). **Đỉnh** = trung bình 15 ngày thấp nhất của D trong 6–9.
- **Gió** = ứng suất dọc bờ (trục 25° đông-bắc, dương = gió tây nam thuận trồi), trung bình 3 điểm, dị thường theo ngày-trong-năm; gộp MAM, tháng 5, JJA.
- **Kiểm**: bỏ-từng-năm (LOYO) trên 44 năm 1983–2026, hồi quy tuyến tính, không chọn tham số trên năm giữ ra; bootstrap 2 000 lần theo năm cho CI 90 % của r và skill MAE = 1 − MAE/MAE_khí hậu. Đối thủ: khí hậu (0) và quán tính (S năm trước). Mô hình "[trần]" dùng biến đồng thời JJA — không phải dự báo, chỉ để biết trần.

## 2. Kết quả chính (đo, LOYO, 44 năm)

**Đích S_JJA** (dị thường SST ven bờ hè):

| Mô hình (phát khi) | r LOYO [CI 90 %] | skill MAE [CI 90 %] | đúng dấu / 29 năm lớn |
|---|---|---|---|
| Khí hậu | — | 0 | — |
| Quán tính (năm trước) | −0,61 | −0,03 [−0,05…−0,01] | 0,17 |
| ONI JAS−1 (tháng 10 năm trước) | 0,47 [0,31…0,64] | +0,11 [−0,03…+0,23] | 0,79 |
| ONI SON−1 (tháng 12) | 0,54 [0,38…0,69] | +0,14 [−0,02…+0,27] | 0,79 |
| **ONI DJF (tháng 3)** | **0,58 [0,43…0,73]** | **+0,17 [+0,01…+0,31]** | 0,72 |
| ONI MAM (tháng 6) | 0,43 [0,24…0,60] | +0,11 [−0,02…+0,23] | 0,69 |
| **ONI DJF × dấu PDO MAM** | **0,64 [0,52…0,75]** | **+0,22 [+0,06…+0,34]** | **0,79** |
| Gió xuân MAM | 0,05 | +0,02 [−0,04…+0,08] | 0,59 |
| Gió tháng 5 | −0,65 | −0,03 | 0,10 |
| [trần] gió JJA đồng thời | 0,45 [0,21…0,65] | +0,11 [−0,05…+0,24] | 0,76 |
| [trần] ONI JJA đồng thời | −0,36 | −0,04 | 0,34 |

Đọc: (1) ENSO mùa đông dự báo hè sau tốt hơn ENSO **đồng thời** — khớp y văn "nước trồi yếu ở hè *sau* El Niño" (02 §2) về **dấu và độ trễ**, nhưng chỉ ở mức SST. (2) PDO pha lạnh làm ENSO "ăn" mạnh hơn (01 §2.1, Wu 2013): mô hình tương tác thắng rõ. (3) Quán tính năm trước **phản tác dụng** (r −0,61): không có "nhớ" liên năm; đừng dùng "năm ngoái thế nào năm nay thế ấy". (4) Gió xuân không báo trước gì; gió JJA đồng thời chỉ giải thích được như ONI DJF — chỉ số gió 3 điểm của tôi yếu hơn chỉ số Ekman của Herrmann 2023 (r 0,64–0,71) nhiều, nên đừng kết luận "gió không quan trọng".

**Đích D_JJA** (tương phản ven bờ − khơi): mọi mô hình skill ≤ +0,04, r LOYO âm; đặc biệt ONI DJF r **−0,47**, tức ép ONI vào D chỉ sinh sai số. Ngay cả gió JJA đồng thời + ONI JJA chỉ +0,07 [−0,04…+0,17]. **Kết luận: với 44 năm SST, không chứng minh được ENSO đổi cường độ nước trồi; nó đổi nền nhiệt cả vùng.**

**Khởi phát / đỉnh**: không mô hình nào có skill; khởi phát theo SST gần như hằng số (121–125) trừ 4 năm.

## 3. Bảng năm đáng chú ý (đo; S, D °C; ONI °C; τ ×10⁻³ N/m²)

| Năm | S_JJA | D_JJA | khởi phát | ONI JAS−1 | ONI DJF | ONI JJA | PDO MAM | τ JJA |
|---|---|---|---|---|---|---|---|---|
| 1983 (sau El Niño 82/83) | 0,00 | −0,01 | 142 | 0,99 | 2,14 | 0,25 | 1,33 | −10,5 |
| 1998 (sau 97/98) | **+1,22** | −0,01 | 121 | 1,79 | 2,22 | −0,63 | 0,16 | −17,0 |
| 2010 (sau 09/10) | **+1,24** | +0,27 | **213** | 0,56 | 1,47 | −0,98 | −0,13 | −16,0 |
| 2016 (sau 15/16) | +0,26 | −0,40 | 122 | 1,73 | 2,50 | −0,19 | 1,63 | −1,8 |
| 2020 | +1,13 | −0,29 | 122 | 0,20 | 0,71 | −0,29 | −1,20 | −19,4 |
| 2024 (sau 23/24) | +0,81 | −0,09 | 123 | 1,25 | 1,84 | 0,06 | −2,21 | −4,2 |
| 2026 (đang El Niño) | +0,33 | **−0,48** | 149 | −0,26 | −0,39 | 1,80 | −1,57 | +20,2 |

Đọc: ba hè ấm nhất (1998, 2010, 2020) đều có **gió tây nam yếu** (τ JJA −16…−19) và hai trong ba là sau El Niño; 2016 sau El Niño rất mạnh nhưng PDO dương mạnh (+1,63) → hè gần bình thường, đúng cơ chế PDO điều biến. 2026: El Niño đang phát triển, gió tây nam mạnh nhất chuỗi (+20,2), tương phản ven bờ mạnh — nước trồi tốt *trong* năm El Niño, chỉ yếu *năm sau*.

## 4. Giới hạn trung thực

- **SST là thước đo gián tiếp của nước trồi.** D (ven bờ − khơi) nhiễu bởi xoáy khơi và dòng ấm; chỉ số đúng là Ekman từ gió (Herrmann 2023) hoặc chl. Vì vậy "không dự báo được D" ≠ "không dự báo được nước trồi"; nó nghĩa là **phép đo này không chứng minh được**.
- **Chỉ số gió 3 điểm, trục bờ 25°** là giả định; chưa so với Ekman index chuẩn. Có thể vì thế gió xuân/gió JJA tỏ ra yếu.
- **Chl không có** (hai máy chủ NOAA nghẽn). Thiếu mắt xích "nhiệt → mồi", nên bước C chưa nói được gì về sinh học.
- **n = 44 năm, 3 El Niño ≥ +2 trong chuỗi** (1983, 1998, 2016; 2024 ≈ +2): hệ số ở đầu cực đoan như 2026 (+2,16) là **ngoại suy**. Khoảng 80 % ± 0,61 °C là theo phần dư trong mẫu, thực tế rộng hơn.
- Hồi quy tuyến tính đơn; không thử phi tuyến hay tổ hợp nhiều biến vì n nhỏ, cố ý tránh dò.
- OISST ven bờ ≤ 25 km có ô trộn đất; hộp ven bờ chỉ 43 ô.

## 5. Việc tiếp theo nếu muốn thẻ triển vọng

1. Thay D bằng **chỉ số Ekman** theo Herrmann 2023 (hộp SCU/MKU, ERA5 lưới, không 3 điểm) và lấy **chl L4** khi CoastWatch/CMEMS mở lại; đo lại cổng "ONI → nước trồi" đúng nghĩa. Nếu vẫn ≤ 0, bỏ hẳn chữ "nước trồi" khỏi thẻ.
2. Thẻ phát tháng 3 từ ONI DJF × PDO: một câu, mức tin "vừa", hiện 2 năm tương tự gần nhất để bà con tự đối chiếu. Phát tháng 10 năm trước chỉ dạng "xu hướng".
3. Mở rộng cùng phép đo cho **vịnh Bắc Bộ (mùa đông lạnh)** và **Tây Nam Bộ**: cùng script, đổi hộp.
4. Kiểm dự báo khoá 2027 vào tháng 9/2027; ghi vào file này dù trúng hay trượt.
