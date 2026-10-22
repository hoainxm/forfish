# 08 — Bước 0: bảng chuyến v3(a) có gì để học không? (đo 2026-10-22)

**Load khi / Load when**: trước khi fit bất kỳ mô hình "thềm → cá" nào trên nhãn chuyến, hoặc khi cần biết vì sao tầng cá của "Dòng Dẫn" bị cắt còn tối thiểu. Bảng số gốc: `08b-buoc-0-bang-so.md`.

> Chỉ đọc dữ liệu, không sửa nhãn, không sửa mô hình. Chạy trên PC GPU, đọc `dl-all` (nhật ký + chuyến + track VMS, snapshot 11/10/2026) và cache đặc trưng vệ tinh `fc-full/features` (289 ngày 2026, lưới 0,25°). Script `buoc0-chuyen.mjs` ở `~/.local/forlife/train/buoc0-chuyen/` trên gpu-desktop, ngoài git. Số nào máy đo ghi "đo", số suy ghi "ước".

## 0. Kết luận (đọc nếu chỉ có 1 phút)

| Câu hỏi bước 0 | Trả lời | Hệ quả |
|---|---|---|
| (i) Sau khi trừ nghề×lớp dài và tháng×vùng 0,5°, đặc trưng vệ tinh gộp theo dấu vết chuyến còn bao nhiêu biến thiên? | **Nhiệt mặt biển: còn 4–5 %** (gần như toàn mùa vụ + vùng). **Chl 33 %, front 22–31 %, xoáy 39 %, nước trồi 38 %**; thêm hiệu ứng tàu còn **18–33 %** | Có biến thiên để học cho chl/front/xoáy/trồi. **Dải nhiệt loài không học được ở thang chuyến** — nó đã nằm trong tháng×vùng |
| (ii) ICC tàu trên phần dư năng suất | **0,51** (cả năm; 0,52 nửa đầu, 0,59 nửa sau). R² của log kg: 0,55 không tàu → 0,86 có tàu | Một nửa phần dư là "tàu nào". Mô hình nào cũng **phải có hiệu ứng tàu cố định**; không có là học nhầm thuyền trưởng giỏi thành "chỗ tốt" |
| (iii) ρ nhỏ nhất phát hiện được (α 0,05, công suất 0,8) với n hiệu dụng theo cụm tuần×vùng (Kish) | **Toàn bộ 0,06** · cá nục 0,08 · ngừ vằn 0,11 · mực xà 0,13 · cá cơm 0,24 | Cổng 07 ("ρ phát hiện được > 0,1 thì dừng"): **toàn bộ + cá nục qua**, ba nhóm loài còn lại **thiếu công suất** ở mức loài |
| Thăm dò (không phải cổng): tương quan trong-tàu giữa đặc trưng và phần dư | **Mọi \|ρ\| ≤ 0,08**; lớn nhất: nhiệt ↔ cá cơm −0,13, xoáy ↔ ngừ vằn +0,07, front chl ↔ ngừ vằn −0,08. Ba đặc trưng **đổi dấu** giữa hai nửa năm | Trần của "vệ tinh hôm nay giải thích chuyến này" ở thang chuyến là **R² < 1 %**, dù dấu có đúng. Đúng như 07 §2a cảnh báo: nhãn chuyến chỉ đổi đơn vị |

**Quyết của bước 0: ĐI TIẾP CÓ ĐIỀU KIỆN, không phải "đi".**
1. Bước B (tầm 1–14 ngày) chỉ chạy trên **tổng kg theo nhóm nghề** và **cá nục**, với hiệu ứng tàu cố định, pha trăng, bỏ nhiệt mặt biển khỏi đặc trưng học. Mực xà, ngừ vằn, cá cơm: chỉ báo cáo, không làm cổng.
2. Kỳ vọng phải hạ: tín hiệu thăm dò ≤ 0,08 nghĩa là ngay cả khi B "qua cổng", phần vệ tinh thêm vào nền mùa + tàu ở thang chuyến là **rất nhỏ**. Giá trị thật của dữ liệu này nằm ở **toạ độ mẻ** (Q1), không ở mô hình.
3. Bước C (triển vọng nước trồi theo mùa, thuần vật lý) **không phụ thuộc** kết quả này và vẫn là phần đáng làm nhất.

## 1. Bảng chuyến dựng được (đo)

| | Số | Ghi chú |
|---|---|---|
| Nhật ký đọc | 364 788 | cả năm 01/01–11/10/2026 |
| Mất vì không VMS | 162 724 | tàu nhỏ (<15 m) gần như không có — nhãn chỉ nói về tàu ≥15 m |
| Mất vì thiếu giờ rời/cập | 41 452 | |
| Mất vì kg = 0 | 41 713 | gồm tàu thứ hai của cặp kéo đôi khai 0 (07, 05) — bước 0 **chưa ghép cặp** |
| Tàu thu mua loại | 9 928 | theo `encounters/vessels.json` |
| **Chuyến dùng** | **102 100** | có giờ đánh v2 > 0 và kg > 0 |
| Chuyến có đặc trưng vệ tinh | 101 280 | 97 % giờ đánh rơi vào ô có đặc trưng |
| Độ dài chuyến trung vị | 11 ngày | giờ đánh trung vị 81 h |
| Chuyến "gọn" (≤72 h đánh, bán kính ≤0,25°) | 27,7 % chuyến · 30,5 % kg | đủ lớn để làm tập kiểm "gần ô-ngày" (05 C1b nói nếu <10 % kg thì chỉ kiểm) |
| Theo nhóm nghề | vây 19 698 · câu 26 295 · rê 25 080 · kéo 14 452 · chụp 11 471 · khác 5 104 | |
| Theo tháng | 1: 9 288 · 2: 5 765 · 3: 10 421 · 4: 12 265 · 5: 14 966 · 6: 12 196 · 7: 13 691 · 8: 10 933 · 9: 10 611 · 10: 139 · 12: 1 825 | tháng 10–11 gần như trống ⇒ mùa gió đông bắc chỉ có T1–3 + T12 |
| Tàu | 14 493 | ≥15 m: 93 414 chuyến; ≥24 m: 8 661 |

Loài theo kg (top): Cá Tạp 125 nghìn tấn · Cá Xô 41 · cá nục thuôn 23 · **ngừ vằn 23** · **mực xà 19** · ngừ vây vàng 14 · cá cơm con 13 · cá mối 13 · mực giã 10. Hai mã "Cá Tạp/Cá Xô" chiếm phần lớn kg ⇒ phân tích theo loài chỉ phủ một phần sản lượng.

## 2. Mô hình đo

Trên từng chuyến i: `log kg_i = nghề×lớp dài + tháng×vùng 0,5° + β₁·log(giờ đánh) + β₂·log(giờ chuyến) + β₃·cos(trăng) + β₄·sin(trăng) + ε_i` (mô hình A), và thêm **tàu cố định** (mô hình B). Ước bằng chiếu luân phiên (within-transform), tầng tháng×vùng < 5 chuyến bị bỏ (2 931 chuyến). Đặc trưng chuyến = trung bình theo giờ đánh của đặc trưng ô-ngày dọc dấu vết (SST `t`, log10 chl `c`, front nhiệt, front chl, xoáy, lạnh/ấm dị thường, nước trồi). ICC tàu = ANOVA một chiều trên ε_A. n hiệu dụng: số chuyến, số tàu, số cụm tuần×vùng, và Kish trên cụm. ρ_min theo Fisher z. Thăm dò: Pearson giữa ε_B và đặc trưng đã khử cùng ba nhân tố; CI 90 % bootstrap 300 lần theo cụm tuần×vùng.

Theo đúng sửa đổi 4 của 07: đích là **log kg**, giờ đánh và giờ chuyến là biến kiểm soát. Kết quả xác nhận vì sao: **β(log giờ đánh) ≈ −0,01** trên log kg — kg gần như **không tăng theo giờ đánh đo từ VMS**; đổi đích sang log(kg/giờ) chỉ là trừ thêm log H nhiễu (ở đó β = −1,01).

## 3. (i) Phương sai còn lại của đặc trưng (đo, cả năm, n ≈ 98 nghìn)

| Đặc trưng | sd | còn lại sau nghề×lớp + tháng×vùng | còn lại sau + tàu |
|---|---|---|---|
| Nhiệt mặt biển `t` | 2,32 °C | **4,6 %** | 4,0 % |
| log10 chl `c` | 1,07 | 32,9 % | 23,9 % |
| Front nhiệt | 0,21 | 30,8 % | 25,8 % |
| Front chl | 0,27 | 22,5 % | 18,2 % |
| Xoáy (SSHA) | 0,24 | 39,3 % | 32,5 % |
| Dị thường lạnh | 0,27 | 30,5 % | 26,3 % |
| Dị thường ấm | 0,24 | 36,0 % | 30,5 % |
| Nước trồi | 0,27 | 38,1 % | 32,6 % |
| Hội tụ dòng, D20 | — | **không có trong cache** (05 A2 đã ghi) | |

Đọc: nhiệt mặt biển ở thang chuyến×tháng×vùng gần như là hằng số của mùa; "hợp nhiệt loài" của HSI hiện tại vì thế **không phân biệt được chuyến này với chuyến kia** trong cùng tháng–vùng. Các đặc trưng động (chl, front, xoáy, trồi) còn 1/5–1/3 phương sai — đủ để một mô hình có thể nhận diện, nên bước 0 **không dừng vì thiếu biến thiên**.

## 4. (ii) ICC tàu và (iii) công suất (đo)

| Tập | n chuyến | tàu | ICC tàu | R² A → B | n_eff Kish cụm | ρ_min (cụm) | ρ_min (tàu Kish) |
|---|---|---|---|---|---|---|---|
| Tổng kg, cả năm | 99 169 | 14 493 | **0,511** | 0,55 → 0,86 | 2 161 | **0,060** | 0,033 |
| Nửa đầu T1–5 | 51 137 | 12 375 | 0,524 | 0,55 → 0,88 | 1 174 | 0,082 | 0,033 |
| Nửa sau T6–10 | 48 032 | 11 414 | 0,586 | 0,56 → 0,89 | 1 013 | 0,088 | 0,037 |
| Cá nục | 22 786 | 5 661 | 0,383 | 0,70 → 0,89 | 1 155 | 0,082 | 0,054 |
| Mực xà | 15 037 | 3 933 | 0,555 | 0,58 → 0,94 | 487 | **0,127** | 0,050 |
| Ngừ vằn | 4 203 | 971 | 0,354 | 0,57 → 0,85 | 695 | **0,106** | 0,125 |
| Cá cơm | 4 191 | 818 | 0,236 | 0,38 → 0,65 | 136 | **0,238** | 0,157 |
| Cá ngừ mọi loại | 24 120 | 5 211 | 0,340 | 0,39 → 0,75 | 1 169 | 0,082 | 0,049 |

Đọc: ICC 0,35–0,59 ở mọi tập — "tàu nào" giải thích nhiều hơn mọi thứ vệ tinh cộng lại. Công suất theo cụm tuần×vùng (cách đếm bảo thủ, vì các chuyến cùng tuần cùng vùng chia sẻ cùng môi trường) đủ cho tổng kg và cá nục; **không đủ cho mực xà, ngừ vằn, cá cơm** nếu tín hiệu thật ở cỡ 0,05–0,1.

## 5. Thăm dò: tín hiệu có không, dấu có bền không (đo, KHÔNG phải cổng)

ρ trong-tàu giữa đặc trưng và phần dư log kg; in đậm = CI 90 % loại 0.

| Đặc trưng | Cả năm | T1–5 | T6–10 | Cá nục | Mực xà | Ngừ vằn | Cá cơm |
|---|---|---|---|---|---|---|---|
| Nhiệt | **−0,030** | **−0,020** | **−0,028** | +0,004 | **−0,033** | +0,011 | **−0,130** |
| log chl | **−0,024** | **−0,025** | **−0,012** | **−0,032** | **+0,029** | **−0,053** | −0,016 |
| Front nhiệt | **−0,009** | **−0,013** | +0,003 | **−0,017** | +0,017 | +0,001 | +0,008 |
| Front chl | **−0,041** | **−0,064** | **−0,031** | **−0,018** | **−0,043** | **−0,083** | −0,028 |
| Xoáy | +0,010 | −0,005 | **+0,023** | +0,008 | +0,007 | **+0,072** | +0,012 |
| Dị thường lạnh | **−0,010** | **−0,036** | **+0,013** | −0,013 | +0,019 | +0,017 | **−0,054** |
| Dị thường ấm | −0,006 | +0,011 | **−0,029** | −0,012 | −0,006 | +0,025 | **+0,049** |
| Nước trồi | 0,000 | −0,003 | +0,005 | **−0,017** | **+0,036** | +0,020 | **+0,046** |
| Pha trăng (β sin / cos trên log kg) | −0,045 / 0,00 | | | −0,08 / +0,04 | **−0,26** / −0,05 | −0,07 / +0,13 | −0,09 / −0,07 |

Đọc thẳng:
- **Độ lớn**: mọi tương quan ≤ 0,08, tức ≤ 0,6 % phương sai phần dư. Đây là trần của "ảnh hôm nay giải thích chuyến này" khi nhãn là cả chuyến 11 ngày. Khớp với kết quả ô-ngày 2026-10-18 (ảnh ngày đóng góp ≈ 0) nhưng đo bằng cách khác, không dính lỗi chia kg đều.
- **Dấu đổi giữa hai nửa năm**: dị thường lạnh (−0,036 → +0,013), dị thường ấm (+0,011 → −0,029), front nhiệt. Theo cổng "giải thích được" của 06 §5, ba thành phần này **không được ship**.
- **Front chl âm ở mọi tập** (−0,02…−0,08): ngược cơ chế HSI đang dùng (front = tụ cá). Hai cách hiểu, chưa phân định: (a) ngư dân đã chọn chỗ front rồi nên biến thiên còn lại là "front yếu hơn thường mà vẫn đánh" — lựa chọn chỗ đánh làm lệch (07 §6.3); (b) chl L4 đã lấp mây, front chl ở nơi mây nhiều là nội suy (03 §4). Cần kiểm bằng tập chuyến gọn + cờ tỉ lệ quan sát thật.
- **Có vài tín hiệu đúng cơ chế và bền**: xoáy ↔ ngừ vằn +0,07; nước trồi ↔ mực xà +0,036 và cá cơm +0,046; nhiệt ↔ cá cơm −0,13 (cá cơm ưa nước lạnh trồi — mạnh nhất bảng, nhưng cá cơm thiếu công suất và nhiệt gần như không còn biến thiên).
- **Pha trăng**: hệ số sin trăng −0,26 trên log kg mực xà (câu đèn), cos +0,13 ở ngừ vằn. Đúng dự đoán 07 §6.1; thiếu biến này thì mọi phép kiểm trễ nhặt nhầm chu kỳ 29,5 ngày.

## 6. Giới hạn của chính phép đo này

- Chưa ghép cặp kéo đôi, chưa áp Huber/điểm tin cậy v2: tàu thứ hai khai 0 kg bị loại (nằm trong 41 713 "kg = 0"), tàu thứ nhất gánh cả kg ⇒ ICC tàu có thể cao hơn thật một chút [ước].
- Cache đặc trưng chỉ chứa ô "có vùng + loài trong vụ" và không có dòng chảy/D20/nhiệt đáy; đặc trưng gộp dọc dấu vết là trung bình làm phẳng mạnh (07 §2a).
- Tầng tháng×vùng ước trên toàn năm, chưa tách nếp train/test — bước 0 chỉ đo biến thiên, không chấm skill.
- Cụm tuần×vùng là một cách đếm n hiệu dụng; ρ_min theo tàu Kish nhỏ hơn 2 lần. Sự thật ở giữa.
- Dữ liệu một năm El Niño mạnh; tháng 10–11 trống.
