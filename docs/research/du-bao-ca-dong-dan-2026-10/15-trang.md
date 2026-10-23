# 15 — Trăng và sản lượng: pha trăng có đáng thành hệ số nhân trong dự báo cá không? (đo 2026-10-23)

**Load khi / Load when**: trước khi đưa pha trăng / độ sáng trăng vào dự báo cá (`fish-predict.ts`, `model-params`), trước khi nói với bà con "đêm tối đánh được hơn", hoặc khi một bước khác cần kiểm soát chu kỳ 29,5 ngày. Bảng số gốc: `15b-trang-bang-so.md`.

> Chỉ đọc dữ liệu, không sửa nhãn, mô hình hay app. Chạy ở gpu-desktop (nhãn DataLake không rời máy đó). Nhãn: bảng chuyến v3(a) cả năm 2026 (tới 11/10), 92 114 chuyến có ≥ 3 giờ đánh ban đêm (9 986 chuyến bị bỏ vì gần như không đánh đêm). Vị trí Mặt Trời / Mặt Trăng tự tính (`trang-thien-van.mjs`, sai ~0,5–1°, đã kiểm trên trăng tròn 3/3/2026 và trăng non 17/2/2026). Script `buoc15-trang.mjs`; bảng chuyến dùng chung `bang-chuyen.mjs` (thêm móc tuỳ chọn `segAny`, bước 0/B không đổi). Kết quả thô: `$SDFISH_DATA_DIR/dong-dan/buoc15/`.

## 0. Kết luận (đọc nếu chỉ có 1 phút)

> **Phản biện độc lập (`18-phan-bien-15-17.md`) HẠ MỨC bước này: từ "QUA" xuống "giả thuyết, chưa loại được lịch âm".** Đường hệ số theo độ lệch pha không có dạng cos (lệch 7 ngày cho −0,27, lệch 22 ngày cho +0,26, lớn hơn hệ số thật −0,23; 20/29 độ lệch cho |β| lớn hơn mốc đúng); khe pha cùng độ rọi nhưng ngược dấu (trăng lên/xuống quan trọng hơn sáng/tối); Tết 17/2 rơi đúng trăng non và hiệu ứng nằm trọn tháng 1–5; bootstrap cụm tuần × vùng trong khi pha trăng chung mọi vùng ⇒ CI quá hẹp. **Chưa đưa hệ số trăng vào `model-params`** cho tới khi qua 7 điều kiện ở 18. Phần dưới giữ nguyên chữ của người đo.

**Bước 15 QUA — nhưng HẸP: chỉ cho lưới chụp (ánh sáng).** Năm điều đăng ký trước đều qua ở lưới chụp; câu mực thì KHÔNG qua.

1. **Lưới chụp: đêm rằm ít hơn đêm không trăng 13–18 % kg chuyến** [đo]: −12,9 % [CI 90 %: −18,4; −7,4] (tháng × vùng) và −18,0 % [−23,3; −12,5] (nửa tháng × vùng), sau khi khử tàu, nghề × lớp dài, thời gian × vùng 0,5°, giờ đánh, giờ chuyến. 10 209 chuyến, 1 228 tàu.
2. **Kiểm giả đều đúng chiều** [đo]: lệch ngẫu nhiên từng chuyến — 0/100 lần cho hệ số lớn bằng hệ số thật; lệch nửa chu kỳ (14,77 ngày) — hệ số **đổi dấu** (−0,23 → +0,44); lưới kéo (đối chứng) ≈ 0 (+0,2 % [−3,8; +4,0] ở bản tháng); hai nửa năm cùng dấu âm.
3. **Câu mực không thấy gì** [đo]: +3 % [−4; +12], hai nửa năm ngược dấu. Mực tính theo loài trong nghề đèn cũng ≈ 0. Đây là điều bất ngờ nhất, và có thể do cách tách nghề / giờ đánh hơn là do sinh học (§3).
4. **Ngoài cổng, có tín hiệu lớn nhưng chưa được khoá trước** [đo, chỉ là mô tả]: cá nục trong tàu vây cá nổi nhỏ −19 % đêm rằm; cá cơm cùng nhóm tàu lại **+21–24 %**; tổng kg vây cá nổi nhỏ ≈ 0. Nghĩa là trăng có thể đổi **cơ cấu loài** chứ không đổi tổng.

**Hệ quả cho dự báo cá:** đủ cơ sở để đề xuất **một** hệ số nhân theo pha trăng cho **lưới chụp**, biên độ khoảng ±5–8 % quanh trung bình (§4). Không đưa cho câu mực, vây, kéo, rê. Đây là đề xuất trong doc, chưa sửa `src/`.

## 1. Đăng ký trước (viết 2026-10-23 TRƯỚC khi chạy phân tích chính, giữ nguyên chữ)

Đã biết trước khi viết: bước 0 (08 §thăm dò) thấy hệ số sin trăng −0,26 trên log kg mực xà và cos +0,13 ở ngừ vằn, chưa có tàu cố định, chưa kiểm giả. Đó là lý do làm bước này, cũng là lý do phải đăng ký trước.

**Đặc trưng chính**: độ rọi trăng tương đối trung bình trong các giờ đánh ban đêm của chuyến (Mặt Trời dưới −6°), độ rọi = phần mặt trăng sáng × sin(độ cao trăng), 0 khi trăng lặn. Phụ: cos/sin pha trăng trung bình giờ đêm; độ rọi trên MỌI giờ đêm trên biển (không chỉ giờ đánh).

**Chiều kỳ vọng** (log kg chuyến, có log giờ đánh, log giờ chuyến; tàu cố định, nghề × lớp dài, tháng × vùng 0,5°):

| Nhóm | Kỳ vọng | Vì sao |
|---|---|---|
| Lưới chụp (ánh sáng) | **âm** (trăng sáng → kg thấp) | đèn kém hút khi trăng sáng |
| Câu mực (tàu câu có ≥ 50 % kg cả năm là mực) | **âm** | như trên |
| Vây cá nổi nhỏ (≥ 50 % kg cả năm là cơm/nục/trích/bạc má/chỉ vàng) | **âm**, yếu hơn | một phần vây ánh sáng, một phần vây ngày |
| Mực (theo loài, nghề đèn gộp) | **âm** | |
| Lưới kéo (đối chứng) | **≈ 0** | kéo đáy không dùng đèn |
| Rê | không đăng ký chiều | lưới rê có thể bị cá nhìn thấy dưới trăng (âm), nhưng không phải cơ chế đèn |
| Câu ngừ, vây ngừ, cá nục / cá cơm / ngừ theo loài | chỉ báo cáo, không làm cổng | |

**Cổng QUA** (cả năm điều, xét trên chụp HOẶC câu mực — hai nhóm cơ chế rõ nhất):
1. Hệ số độ rọi âm, CI 90 % (bootstrap cụm tuần × vùng) loại 0, ở CẢ tháng × vùng và nửa tháng × vùng.
2. Hai nửa năm (tháng 1–5, tháng 6–10) cùng dấu âm.
3. Kiểm giả lệch ngẫu nhiên (mỗi chuyến lệch một số ngày ngẫu nhiên 0–29): hệ số thật lớn hơn ≥ 95 % hệ số giả (trị tuyệt đối). Lệch 14,8 ngày: hệ số phải **đổi dấu** (rằm ↔ không trăng).
4. Kéo: CI chứa 0, hoặc |hệ số kéo| < 1/3 |hệ số nghề đèn|.
5. Đủ lớn để bà con thấy: chênh "đêm tối hẳn" so với "đêm rằm" ≥ 10 % kg.

Số phép thử chính: 2 nhóm cổng × 2 kiểu hiệu ứng thời gian. Các ô còn lại chỉ là mô tả.

## 2. Cách đo

- **Chuyến**: bảng chuyến v3(a) (bước 0). Trên **từng đoạn giờ đánh**, chia bước ≤ 1 giờ; một giờ là "đêm" khi Mặt Trời dưới −6°. Độ rọi trăng = phần sáng × sin(độ cao trăng), 0 khi trăng lặn (1 = trăng tròn ở thiên đỉnh, trời quang). Đặc trưng chuyến = trung bình độ rọi trên các giờ đánh đêm. Phụ: cùng đại lượng trên **mọi** giờ đêm trên biển (đánh + ngoài dải tốc độ), phòng khi dải tốc độ bỏ sót giờ thả neo câu/chụp.
- **Đổi ra %**: độ rọi trung bình giờ đêm ở 12°N 110°E [đo, thiên văn]: đêm quanh trăng non 0,000, quanh rằm 0,605. "Rằm/tối" = e^(β × 0,605) − 1.
- **Nghề con theo TÀU** (kg cả năm của tàu, không theo chuyến để khỏi dính chính sản lượng chuyến): câu → câu mực / câu ngừ / câu khác (≥ 50 % kg là mực / ngừ); vây → vây ngừ / vây cá nổi nhỏ / vây khác; lưới chụp, kéo, rê giữ nguyên.
- **Đích**: log kg chuyến (tổng theo nghề; theo nhóm loài khi chuyến có loài đó). **Kiểm soát**: tàu cố định (≥ 2 chuyến), nghề × lớp dài, tháng × vùng 0,5° (hoặc nửa tháng × vùng), log giờ đánh, log giờ chuyến. Tầng thời gian × vùng < 5 chuyến bị bỏ.
- **CI 90 %**: bootstrap 300 lần theo cụm tuần × vùng. **Kiểm giả**: (a) mỗi chuyến lấy độ rọi của một ngày lệch ngẫu nhiên 0–29 ngày, 100 lần; (a') đường β theo độ lệch Δ = 0…29 ngày + 14,77 ngày — thật thì có dạng cos, đổi dấu ở nửa chu kỳ; (b) lưới kéo; (c) hai nửa năm.

## 3. Kết quả

### 3.1 Theo nghề — log kg tổng chuyến [đo]

"Rằm/tối" = % kg chuyến đánh toàn đêm rằm so với toàn đêm không trăng. T = tháng × vùng; NT = nửa tháng × vùng.

| Nghề (n chuyến T) | Rằm/tối T [CI 90 %] | Rằm/tối NT [CI 90 %] | Giả ngẫu nhiên p (T / NT) | β lệch 14,77 ngày (T / NT) | β nửa năm 1–5 / 6–10 (T) |
|---|---|---|---|---|---|
| **Lưới chụp** (10 209) | **−12,9 %** [−18,4; −7,4] | **−18,0 %** [−23,3; −12,5] | 0,00 / 0,00 | +0,44 / +0,41 | −0,50 [−0,64; −0,34] / −0,01 [−0,17; +0,14] |
| Câu mực (2 811) | +3,3 % [−4,0; +12,3] | +3,8 % [−4,8; +13,2] | 0,47 / 0,57 | +0,22 / +0,49 | −0,10 / **+0,35** |
| Vây cá nổi nhỏ (8 097) | −1,9 % [−7,2; +4,7] | −3,9 % [−11,5; +4,2] | 0,47 / 0,14 | +0,21 / +0,13 | +0,15 / −0,19 |
| **Kéo — đối chứng** (9 593) | +0,2 % [−3,8; +4,0] | −3,8 % [−8,0; +0,4] | 0,95 / 0,11 | +0,01 / +0,11 | 0,00 / −0,03 |
| Rê (19 348) | −1,2 % [−4,0; +1,5] | −1,6 % [−5,0; +1,4] | 0,39 / 0,35 | +0,05 / +0,02 | −0,01 / −0,02 |
| Câu ngừ (7 872) | −5,3 % [−13,0; +2,3] | −9,6 % [−17,4; −1,5] | 0,04 / 0,00 | −0,08 / −0,08 | −0,13 / −0,33 |
| Vây ngừ (1 482) | −16,8 % [−29,3; −5,4] | −25,9 % [−40,1; −11,0] | 0,03 / 0,00 | +0,11 / +0,25 | −0,33 / −0,53 |

Lưới chụp, nửa tháng: hai nửa năm −0,47 [−0,66; −0,32] / −0,18 [−0,36; −0,03]. Độ rọi trên **mọi** giờ đêm trên biển cho cùng kết luận (chụp β −0,38 / −0,44, CI loại 0). Biến thiên độ rọi còn lại sau khử: 52–64 % ở chụp — không thiếu biến thiên để học.

**Chấm cổng (lưới chụp)**: (1) âm, CI loại 0 ở cả T và NT — qua. (2) hai nửa năm cùng dấu âm — qua, nhưng nửa sau ở bản T chỉ −0,01 (≈ 0). (3) p = 0/100 ở cả hai; lệch 14,77 ngày đổi dấu — qua. (4) kéo CI chứa 0 ở cả hai; |kéo NT| 0,064 < 1/3 × 0,328 — qua. (5) 12,9 % / 18,0 % ≥ 10 % — qua theo ước điểm (cận dưới CI bản T là 7,4 %). Câu mực trượt ngay điều 1.

### 3.2 Theo nhóm loài — log kg loài [đo, chỉ mô tả, không phải cổng]

| Loài · nghề (n T) | Rằm/tối T [CI] | Rằm/tối NT [CI] |
|---|---|---|
| Mực · nghề đèn gộp (11 143) | +2,2 % [−3,9; +9,1] | +2,9 % [−4,0; +10,2] |
| Mực · kéo (4 323) | +10,9 % [+2,8; +18,2] | +7,3 % [−0,6; +15,7] |
| Cá nục · vây cá nổi nhỏ (4 847) | −18,7 % [−24,7; −13,0] | −19,0 % [−25,7; −12,2] |
| Cá nục · mọi nghề (10 792) | −17,8 % [−22,8; −12,9] | −19,6 % [−24,8; −13,0] |
| Cá cơm · vây cá nổi nhỏ (1 538) | **+24,3 %** [+12,4; +37,0] | **+21,5 %** [+8,4; +34,2] |
| Cá ngừ · mọi nghề (22 934) | −12,1 % [−16,7; −7,6] | −12,5 % [−17,2; −7,2] |
| Cá ngừ · câu ngừ + vây ngừ (9 552) | +0,5 % [−8,5; +10,1] | −3,9 % [−13,6; +5,2] |

Đáng chú ý: lưới chụp giảm rõ nhưng **mực** trong nghề đèn thì không. Nếu đúng, phần giảm của chụp đến từ cá (nục…) đi kèm, không phải mực — trái với hình dung "chụp mực". Chưa tách mực riêng trong lưới chụp; đó là việc phải đo trước khi viết câu nào cho bà con.

### 3.3 Hình dạng theo pha [đo]

Khe pha (lưới chụp, β so khe trăng non, bản T): khe 1–5 (trăng lưỡi liềm đầu tháng → rằm → sau rằm) −0,07 … −0,16, khe 6–7 (cuối tháng) ≈ 0 / dương. Đường β theo độ lệch có dạng cos rõ, nhưng đáy ở Δ ≈ 2 ngày (−0,40) chứ không đúng Δ = 0 (−0,23): mô hình độ rọi hơi lệch pha so với dữ liệu, có thể do trung bình cả chuyến làm nhoè, hoặc do bà con nghỉ/bán theo lịch âm.

## 4. Đề xuất bảng hệ số nhân (CHỈ đề xuất, chưa vào `model-params`, chưa sửa `src/`)

Từ β độ rọi: hệ số khe = e^(β × (độ rọi khe − độ rọi trung bình)), trung bình các khe ≈ 1. Khe 0 = quanh trăng non (±1,8 ngày), khe 4 = quanh rằm. [ước — suy từ một hệ số tuyến tính, không phải ước riêng từng khe]

| Lưới chụp | khe 0 (non) | 1 | 2 | 3 | 4 (rằm) | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Bản T (đề xuất, thận trọng) | 1,05 | 1,05 | 1,02 | 0,95 | 0,92 | 0,95 | 1,02 | 1,05 |
| Bản NT | 1,08 | 1,07 | 1,03 | 0,93 | 0,88 | 0,93 | 1,03 | 1,07 |
| Khoảng CI 90 % bản T | 1,03–1,08 | 1,03–1,07 | 1,01–1,03 | 0,93–0,97 | 0,88–0,95 | 0,93–0,97 | 1,01–1,03 | 1,03–1,07 |

Dạng gợi ý cho `model-params` sau này (chưa áp): `moon: { gear: { chup: [1.05, 1.05, 1.02, 0.95, 0.92, 0.95, 1.02, 1.05] }, slot: "8 khe, khe 0 tâm trăng non", src: "buoc15 2026-10-23" }`, mọi nghề khác = 1. Biên độ ±5–8 % là **nhỏ** so với khác biệt giữa vùng/mùa; chỉ nên là hệ số tinh chỉnh, không nên đổi màu bản đồ hay câu chữ chính.

## 5. Giới hạn trung thực

- **Một năm nhãn (2026).** Pha trăng là hàm của ngày; với một năm, mọi thứ lặp theo lịch âm đều có thể nhập vào: bà con nghỉ, cúng, bán, giá cá theo rằm / mùng một. Lưới kéo ở bản nửa tháng cũng có một vệt dạng cos nhỏ (đỉnh +0,10 ở lệch 19 ngày, β thật −0,06) — khoảng 1/5–1/3 hiệu ứng của chụp có thể là phần "lịch âm chung" đó [ước].
- **Nửa sau năm yếu.** Lưới chụp tháng 6–10 ở bản tháng ≈ 0. Hiệu ứng có thể theo mùa (gió mùa tây nam, vùng đánh khác) mà một năm không đủ để chắc.
- **Câu mực trượt có thể vì cách đo.** Tàu "câu mực" tách theo ≥ 50 % kg là mực (chỉ 640 tàu); giờ đánh lấy theo dải tốc độ 0,6–5 hải lý/giờ, nên giờ thả trôi/thả neo dưới đèn có thể bị bỏ — tỉ lệ giờ đánh đêm của câu mực chỉ 0,47, thấp lạ. Độ rọi trên mọi giờ đêm trên biển cũng ≈ 0, nên không chắc đây là toàn bộ lý do.
- **Nhãn là cả chuyến** (trung vị ~11 ngày). Một chuyến trộn nhiều pha; hệ số tuyến tính theo độ rọi trung bình vẫn đúng nếu tác động theo đêm là tuyến tính, nhưng khe pha (§3.3) bị nhoè.
- **Có điều kiện trên việc ra khơi.** Tàu chụp đánh ở độ rọi trung bình 0,13, thấp hơn kéo (0,22): bà con đã né trăng sáng. Số đo là "đã ra khơi thì kém bao nhiêu", không phải "nên đi hay không".
- **Trời quang giả định.** Mây che trăng không được tính; độ rọi thật thấp hơn, làm hệ số bị kéo về 0.
- **Nhiều phép thử.** ~19 nhóm × 2 kiểu hiệu ứng thời gian; chỉ 2 × 2 là cổng. Các kết quả loài (cá cơm +, mực kéo +, ngừ −) có thể có cái do ngẫu nhiên.
- **Nhóm "cá nục" ban đầu lẫn cá nục heo** (cá dũa — loài khác hẳn); đã sửa regex sau lần chạy đầu, chạy lại. Các dòng theo nghề không đổi; bản đầu giữ ở `dong-dan/buoc15/*-v1-nucheo.*`.
- **Chỉ tàu ≥ 15 m có VMS.** Phần lớn câu mực, chụp ven bờ là tàu nhỏ, không có trong nhãn.
- **Tên nghề thô.** "Lưới chụp" được coi là nghề ánh sáng; sổ tàu không ghi có đèn hay không.

## 6. Đề nghị

1. **Chưa đưa vào app ngay.** Hệ số ±5–8 % cho một nghề không đổi được quyết định nào của bà con. Nếu vẫn muốn, chỉ đưa bản T (thận trọng) cho lưới chụp, kèm cờ tắt được.
2. **Khoá trước cho năm nhãn 2027**: "lưới chụp, độ rọi trăng giờ đánh đêm, β < 0, rằm/tối ≤ −10 %, kéo ≈ 0" — chạy đúng `buoc15-trang.mjs`, không đổi gì.
3. **Đo tiếp hai câu hỏi trước khi viết câu nào cho bà con:** (a) mực riêng trong lưới chụp (§3.2 gợi ý phần giảm là cá chứ không phải mực); (b) câu mực với định nghĩa giờ đánh cho cả lúc thả trôi dưới đèn.
4. **Dùng trăng làm biến kiểm soát** ở mọi bước sau (cos/sin hoặc độ rọi), vì nó có thật ở lưới chụp và cá nục — thiếu nó các kiểm trễ sẽ nhặt nhầm chu kỳ 29,5 ngày (07 §6.1).
5. Cá cơm tăng / cá nục giảm dưới trăng sáng trong cùng tàu vây là giả thuyết đáng khoá cho 2027, không dùng bây giờ.
