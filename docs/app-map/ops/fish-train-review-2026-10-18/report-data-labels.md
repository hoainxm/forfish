# Review khâu DỮ LIỆU + NHÃN — pipeline dự báo cá SDFish (2026-10-18)

Phạm vi: `scripts/dl-build-labels.mjs`, `dl-collect.mjs`, `build-species-catch-grid.mjs`, `build-fleet-effort-grid.mjs`, `fish-validate-positions.mjs` §9–§11, và dữ liệu thật trên gpu-desktop (chỉ đọc, mọi phép đo chạy bằng `node -` qua stdin, không ghi gì).
Ghi chú độ tin: số nào do em tự đo hôm nay thì ghi "đo". Số nào suy luận, chưa đo thì ghi "giả thuyết".

## 0. Bốn phát hiện lớn (đọc nếu chỉ có 1 phút)

1. **"43% nhật ký dùng được" là đo theo SỐ NHẬT KÝ, không phải theo kg.** Theo kg thì nhãn đang phủ khoảng 77% (tổng `report.species` 5 cửa sổ = 580 triệu kg / 752 triệu kg trong logbooks-all). Tàu không VMS chiếm 50% số nhật ký nhưng chỉ ~11,6% kg (tàu 12–15 m: 31,5% nhật ký, 7,1% kg; tàu <12 m: 18,1% nhật ký, 2,2% kg). Nút cổ chai không phải tỉ lệ phủ.
2. **Dải tốc độ tự chỉnh bằng Spearman với `haulCount` là một thước đo yếu và không ổn định.** `haulCount` chỉ có ở 9.723/364.788 nhật ký (2,7%), 70% là điện tử. Dải chọn ra nhảy theo cửa sổ (Rê: 1–1,5 → 0,3–3,5 → 0–1 → 0,3–1 → 0–1). Làm tổng giờ đánh bắt nhảy theo: cửa sổ 05–06 có 4,98 triệu giờ trên 40,6 nghìn chuyến (122 giờ/chuyến), cửa sổ 07–08 có 2,25 triệu giờ trên 37,7 nghìn chuyến (60 giờ/chuyến).
3. **Dải `vmin = 0` đếm cả tàu nằm yên/ở cảng khác vào "giờ đánh".** Với dải Rê [0,1]: 74% giờ "đánh" có tốc độ <0,3 kn, và trong mẫu chuyến có haulCount thì 56% giờ này nằm trong 10 km quanh một cảng trong danh mục. `PORT_KM = 5` chỉ so với điểm đầu/cuối chuyến, không so với mọi cảng.
4. **Kg gán theo tàu, không theo mẻ ⇒ nhãn không nói được "ô nào giàu cá hơn ô khác trong cùng chuyến"**. Mọi ô trong một chuyến có cùng kg/giờ. Vì vậy AUCeff 0,736 có thể phần lớn là "tàu năng suất cao thường tới ô nào", tức cơ cấu đội tàu, không phải mật độ cá. Chưa ai đo thành phần nào. Xem Q6.

---

## Q1. Nhãn vị trí theo giờ đánh suy từ tốc độ VMS

### Phát hiện (kèm số đo)

| # | Lỗi hệ thống | Bằng chứng |
|---|---|---|
| a | **Tốc độ chord phụ thuộc nhịp VMS.** Nhịp trung vị: Vishipel 120 phút, Viettel 90, Zunibal 60 (`profiles/vms-providers.json`). `kn = chord/dt` đánh giá thấp tốc độ thật khi tàu đổi hướng giữa hai điểm | Đo trên 9.000 tàu tháng 8: thưa hoá về 2 giờ làm tỉ lệ giờ rơi vào dải tăng từ 7,0% → 9,5% (Kéo, +36% tương đối), 36,9% → 39,6% (Vây). Số tập tin ngoài dải đều do nhịp khác nhau theo nhà cung cấp, mà nhà cung cấp lại tập trung theo tỉnh ⇒ sai lệch có cấu trúc không gian |
| b | **GAP_H = 4 bỏ giờ ở tàu nhịp 2 giờ**: giờ rơi ngoài là 5–15% giờ trên biển (tàu "?" nhịp 2 giờ: 14,6%; Vây 6,1%; Kéo 5,7%; Câu 4,8%) so với 0,4–3% ở nhịp 1 giờ | Đo. Kg không mất (chia theo H) nhưng dồn vào các ô còn tín hiệu |
| c | **Số đợt (episodes) ≠ số mẻ.** Trung bình số đợt / số mẻ khai: Rê 11–14 / 3,1 (gấp 4 lần), Vây 14–27 / 3,5, Câu 17–21 / 5, Kéo 11–15 / 8 | Đo trên 6.600 chuyến có haulCount. Spearman chỉ xếp hạng nên dải lệch hẳn vẫn "đạt" ρ |
| d | **Kéo: dải 1,5–2 kn chỉ bắt 16% giờ**; 44% giờ không ở sát cảng có tốc độ 2–4 kn bị loại. Bootstrap 30 lần: 1,5–2 thắng 17 lần, 2–2,5 thắng 13 lần, tức hai dải kề nhau gần như hoà. Metric "giờ trong dải" (thay vì số đợt) chọn 1,5–2,5 (ρ 0,51 so với 0,48) | Đo. Kéo gặp sóng chạy chậm 0,5 kn là đủ để dịch giữa các dải |
| e | **Vây loại giờ đứng yên** (vmin 0,6). 38% giờ của tàu vây ở <0,3 kn. Trong khi `build-fleet-effort-grid.mjs` (comment đầu file) nói rõ "tàu đèn/vây ánh sáng giữ đàn là đứng yên" và đếm 0–4,5 kn. Hai định nghĩa "giờ đánh" trong cùng repo mâu thuẫn | Đo + đọc code |
| f | **Câu**: 63% giờ trong dải rơi vào đêm (18–06 giờ VN) và ρ vô dụng: Câu nhịp ≤70 phút ρ = **−0,02**, nhịp >70 phút ρ = 0,41; gộp 0,25 (đúng cỡ baseline ρ(giờ chuyến, số mẻ) = 0,15). Cửa sổ 05–06 chọn dải Câu 0–1 với n = 44 mà Câu gánh 2,37 triệu giờ, 48% tổng giờ | Đo |
| g | **Rê/Khác/"?" không có tín hiệu**: ρ(đợt, mẻ) gộp cả năm: Rê 0,41 (baseline giờ chuyến 0,22), Lưới chụp 0,17 (0,06), **Khác 0,07 (baseline 0,24, tệ hơn chỉ dùng độ dài chuyến)**, **"?" −0,02**. "?" chiếm 44% kg | Đo |
| h | **`tk.c` (port-calls) bộ chuyển ghi ra nhưng `dl-build-labels` không bao giờ đọc.** Không bắt được ghé cảng giữa chuyến, neo ở đảo/vịnh trú bão. Chuyến KSTC kéo tới 60 ngày (nhiều chuyến biển ghép lại) nên điểm đầu/cuối không phải cảng nào cả | Đọc code (dòng 211–213 chỉ dùng `tk.p`, `tk.hasVms`) |

### Đề xuất, xếp theo tác động/công

1. **Cố định MỘT bảng dải theo nghề cho cả năm** (ước lượng trên toàn bộ ~6.600 chuyến có haulCount, không chia cửa sổ), kèm khoảng tin cậy bootstrap. Dải gộp cả năm đã ổn định ở Rê (0–1: 30/30 lần), Lưới chụp (0,3–1: 29/30), Câu (0–1: 27/30). Công: 20 dòng.
2. **Bỏ `vmin = 0` ngoại trừ nghề cố ý (vây ánh sáng) và loại giờ nằm trong 10 km quanh BẤT KỲ cảng nào** trong `catalog-ports` (đúng luật `MIN_PORT_KM` của fleet grid). Dùng `tk.c`: cắt chuyến ở lần IN/OUT thật. Công: ~30 dòng, lưới cảng 0,5° đã có sẵn trong `build-fleet-effort-grid.mjs`, tái dùng.
3. **Chuẩn hoá nhịp**: thưa mọi track về lưới 2 giờ trước khi tính tốc độ (làm mọi tàu giống nhau, mất thông tin của tàu nhịp 1 giờ nhưng bỏ sai lệch theo nhà cung cấp), hoặc chọn dải theo lớp nhịp (≤70 / 70–100 / >100 phút).
4. **Phân đoạn hành vi 3 trạng thái (nghỉ / đánh / chạy), thuần JS ~60 dòng**, thay cho ngưỡng cứng. Quan sát: tốc độ chord, góc quay giữa hai đoạn liền, giờ trong ngày; chuyển trạng thái có "phạt" (dwell tối thiểu). Fit không giám sát bằng EM hoặc Viterbi với emission Gauss theo nhóm nghề; chọn thang bằng ρ với haulCount và tỉ lệ đợt/mẻ về gần 1. Không cần thư viện: 3 trạng thái, 3 đặc trưng, Viterbi là vài chục dòng. **Lý do không dùng ngưỡng tốc độ**: ngưỡng cứng không dùng được ngữ cảnh (đứng yên giữa biển ban đêm với đứng yên ở bến).
5. **Câu mực/ánh sáng**: dùng giờ đêm làm điều kiện cộng (đứng yên/trôi 0–1,5 kn, 18–06 giờ, cách cảng >10 km). Giả thuyết, cần đo.

### Cách đo

- ρ(đợt, haulCount) theo nghề và theo nhịp, bootstrap 100 lần: **mục tiêu ρ ≥ baseline +0,15** cho mọi nghề; hiện Khác/"?" dưới baseline.
- Tỉ lệ đợt/mẻ về [0,7–1,5] (hiện Rê 4×).
- Tỉ lệ giờ trong dải nằm ≤6 km một cảng: **Rê hiện 12% (cửa sổ 05–06) → <2%**; 56% trong mẫu có haulCount với dải [0,1].
- Giờ/chuyến giữa 5 cửa sổ chênh nhau **<20%** (hiện 46 → 122).
- Hạ nguồn: AUCeff `dl-eval-fleet` trên nhãn mới, cùng 61 ngày lưới.
- **Phép đo cứng thật sự**: xin Data Lake toạ độ mẻ (GY-473e65c9 đang chờ trong README). Chỉ cần 4% chuyến (~9.700) có toạ độ là có thể đo tỉ lệ "giờ đánh suy luận nằm trong 5 km của một mẻ thật" thay cho ρ gián tiếp. Đây là việc đáng xin nhất.

---

## Q2. Nghề "?" chiếm 33–54% kg

### Nguồn gốc (đo)

`vessels.gear` null ở chỉ 3.789/80.005 tàu (4,7%), nhưng nhóm này là tàu LỚN: 31.682 nhật ký (8,7%) mà **316 triệu kg = 42% tổng kg**. Cộng 6.093 nhật ký tàu không có trong sổ (14,5 triệu kg) ra 44%. Trung vị 1.363 kg/chuyến, p90 32 tấn. Thành phần loài: Cá Tạp 26%, Cá Xô 13%, Nục thuôn 10% (kiểu Kéo + Vây).

Ngoài ra: 1.317 tàu `likelyCarrier` (theo `encounters/vessels.json`) chiếm 118 triệu kg = **15,7% tổng kg**, trong đó 90 triệu kg thuộc nhóm gear NULL (28% kg của "?"). Tức một phần "?" là tàu thu mua trên biển, kg là cá mua lại, không phải cá chính tàu đánh. Xem Q5.

Registry lịch sử không cứu: `vessels-asof-*` chỉ điền thêm được 8/3.789 tàu.

### Suy nghề từ đâu: đã thử, 1 mô hình đơn giản

Naive Bayes thuần JS (không thư viện), đặc trưng = tỉ trọng 80 loài hàng đầu theo kg của TÀU (gộp mọi nhật ký) + dải chiều dài + dải công suất. Huấn luyện trên tàu có nghề, giữ 20% tàu để kiểm (chia theo hash mã tàu), 6 lớp:

| Chỉ số | Giá trị |
|---|---|
| Độ chính xác 6 lớp (so với đoán lớp đông nhất 27%) | **68%**; có trọng số kg 73% |
| Ngưỡng posterior ≥0,7 | phủ 71% tàu, đúng 77% |
| Ngưỡng ≥0,9 | phủ 38% tàu, đúng 86,5% |
| Kéo ↔ Vây nhầm nhau | ≤2% (1/…, 10/516) |
| Áp lên 1.562 tàu NULL đủ ≥500 kg | theo kg: **Kéo 54%, Vây 37%**, Rê 5%, Lưới chụp 3%; 77% kg đạt posterior ≥0,7 (Kéo 53%, Vây 45%) |

Hạn chế khi đọc con số: (1) chưa tinh chỉnh, chia 80/20 một lần; (2) độ đúng đo trên tàu có nghề, chưa kiểm trên chính tàu NULL (khác phân bố: tàu lớn). Cách kiểm là bước dưới; (3) loài "Cá Tạp/Xô" vốn mơ hồ giữa Kéo và Rê.

### Bao nhiêu % kéo về nghề thật

Ước lượng: ~70–75% kg "?" (≈ 220–235 triệu kg) về đúng một nghề tại ngưỡng 0,5–0,7, khoảng 77% kg với độ đúng kỳ vọng ~77%. Phần còn lại giữ "?" (gán nhãn lớp riêng "không rõ").

### Đề xuất

1. Điền `gear_inferred` cho tàu NULL bằng bộ phân loại trên, ghi cờ nguồn (`gear_src = registry | inferred`) vào nhãn, giữ posterior ≥0,7.
2. Thêm đặc trưng từ VMS (phổ tốc độ của tàu theo giờ ban đêm, tỉ lệ đứng yên, đặc trưng cặp từ `encounters` PAIRED) sẽ tăng độ đúng, nhưng bắt đầu với bản chỉ dùng loài.
3. Tách riêng carrier (Q5) khỏi "?".
4. Cap p99 của "?" hiện 26–51 TẤN/giờ nên vô tác dụng (Kéo 1–4 t/h): cap nên tính theo nghề đã suy, không theo "?".

### Cách đo

- ρ(đợt, haulCount) cho tàu NULL sau khi gán nghề, so với hiện tại **−0,02** (n = 183 chuyến có haulCount). Nếu ρ lên ≥0,35 ở nhóm gán Kéo/Vây thì đúng.
- Tỉ lệ kg "?" sau gán: 44% → ≤12%.
- AUCeff theo loài trên phần kg đã được gán lại.

---

## Q3. Tăng tỉ lệ nhật ký dùng được

### Phân rã (đo)

Tách theo kg, không theo số nhật ký (toàn bộ 2026):

| Lớp tàu | % nhật ký | % kg | Có VMS? |
|---|---|---|---|
| 15–24 m | 45,8% | 63,8% | 97,7% có |
| 24+ m | 4,6% | 26,9% | 97,7% có |
| 12–15 m | 31,5% | 7,1% | gần như 0% (130/114.869 có) |
| <12 m | 18,1% | 2,2% | không |

Tàu nhỏ không bắt buộc VMS (≥15 m mới có). Vậy "bỏ" nhóm không VMS mất ~11,6% kg và gần như toàn bộ **tàu nhỏ ven bờ**: đúng nhóm người dùng của ứng dụng (ngư dân tàu nhỏ), nhưng nhãn hiện chỉ học từ tàu ≥15 m. Đây là lệch đại diện sản phẩm chứ không phải lệch dung lượng.

Lý do thiếu giờ rời/cập (chuyến trong 08–10/2026, 113.351 nhật ký):

| Loại | Số | % |
|---|---|---|
| Có `vms.departedAt/arrivedAt` | 39.192 | 34,6% |
| Chỉ có giờ KSTC dùng được | 52.779 | 46,6% |
| **Mở, chưa có giờ cập** | 17.392 | 15,3% |
| KSTC >60 ngày (nối sai, vd 6.192 giờ, cờ KHONG_CO_THIET_BI) | 3.770 | 3,3% |
| Không có giờ rời | 218 | 0,2% |

### Câu trả lời

- **Tàu không VMS: nên bỏ khỏi nhãn huấn luyện ở 0,05°, không nên bịa vị trí.** Gán thô "cảng rời + bán kính + nghề + dài" sẽ sinh ra ô giống hệt lưới đội tàu sẵn có (vòng lặp tự xác nhận). Nếu muốn dùng thì chỉ như **nhãn yếu 0,25° tách riêng** (gắn cờ `weak`), phân phối kg theo lưới đội tàu cùng tỉnh+nghề+tháng; không được dùng cho kiểm định AUCeff. Ước lượng không có số, giả thuyết.
- **Chuyến mở (15,3%)**: đây chủ yếu là chuyến chưa cập tại thời điểm chụp (cắt cụt dữ liệu, tự nhiên), và có thể khôi phục giờ cập từ chính track (lần đầu về trong 5 km cảng `landingPort`, có lat/lng trong `catalog-ports`) cho các tàu có VMS. Ước lượng thu hồi tối đa ~15% × (tỉ lệ có VMS 50%) ≈ +7% số nhật ký, nhưng bị chặn bởi khoảng trống VMS sau 15/09 (8,6 nghìn tàu). Cần đo.
- **Port-calls không giúp nhiều**: với chuyến mở, chỉ 7.076/17.392 có đúng một sự kiện cảng (thường là OUT); port-calls chỉ có từ 08/2026.
- **KSTC >60 ngày**: bỏ là đúng (cặp sai).

### Đề xuất / cách đo

1. Báo cáo độ phủ theo **kg và theo lớp tàu**, không theo số nhật ký (sửa `report.json` thêm `kgUsed / kgTotal`). Đo: ghi số đã tính 77% ở đây vào báo cáo.
2. Suy giờ cập từ track cho chuyến mở. Đo: số chuyến thêm vào `used` và AUCeff trên 09–10.
3. Giữ tàu <15 m ngoài nhãn; ghi thẳng giới hạn này vào §11 ("nhãn chỉ nói về tàu ≥15 m").

---

## Q4. Trọng số tin cậy (×0,5 / ×0,3 / ×0,7 / cap p99)

**Kết luận: các hệ số được đặt tay, và trên dữ liệu thật hầu như không có tác dụng lên kg.**

| Hệ số | Bằng chứng (đo, toàn bộ 2026) |
|---|---|
| ×0,5 "không giám sát" (`landingMonitored !== true \|\| landedKg <= 0`) | Trong 233.901 chuyến có kg>0 thì **100%** có `landingMonitored === true` và landedKg>0; số chuyến "không giám sát có kg" chỉ **271 / 315.000** (0,1%). Hàng nghìn chuyến "tự khai" trong report (5–10 nghìn/cửa sổ) là chuyến landedKg=0 và không có loài ⇒ không có kg để nhân. Hệ số **vô tác dụng** |
| ×0,3 "lặp y hệt" (`catchPrint = mã:kg làm tròn`) | 6,7% chuyến kg>0 bị gắn cờ, nhưng 14.710/15.400 là **giấy, 1 loài**, trung vị 109 kg (không lặp: 330 kg). Số tròn kiểu "Cá Tạp:200" trùng nhau là chuyện thường. Hạ trọng số các chuyến nhỏ này không đổi gì đáng kể (chuyến cờ ~ <1% kg), và có thể đang trừng phạt người khai trung thực |
| ×0,7 "khai thác ≠ bốc dỡ >2 lần" | `catchKg>0` chỉ ở 7.801 nhật ký (2,1%); 6.968 có cả hai. Mẫu quá nhỏ để có ý nghĩa với tổng kg |
| Cap p99 kg/giờ | Cap 26–51 tấn/giờ cho "?" nghĩa là không cap; cap 0,1–4 t/h cho nghề khác. Chỉ 121–295 chuyến/cửa sổ bị kéo |

Vậy chuỗi tin cậy hiện mô hình hoá sai chỗ. Chỗ rủi ro thực lại không có hệ số:

- **Tàu thu mua (carrier)**: 15,7% kg (Q5).
- **Tàu ghép đôi (pair trawl)**: 3.190 tàu trong cặp một-đối-một; trong 1.954 chuyến cùng ngày cập của cặp thì 1.544 (79%) chỉ MỘT tàu khai kg, tàu kia khai 0. 410 chuyến cả hai >0, trung vị tỉ lệ 1,52, 35 chuyến giống nhau (<5% chênh). Giờ đánh của tàu kia vẫn tính vào effort ⇒ kg/giờ bị chia đôi.
- Nhãn lẫn "Cá Tạp/Cá Xô" làm loài kém tin ở Kéo (46% kg Kéo là Cá Tạp).

### Đề xuất ước lượng, đo được

1. **Hồi quy sức mạnh**: với từng nghề × lớp dài, log(kg) ~ log(giờ trong dải) + log(giờ chuyến) trên chuyến có VMS; trọng số = Huber hoặc `1/(1+(residual/σ)²)`. VMS độc lập với lời khai ⇒ đây là phép so duy nhất khách quan có sẵn. Đo ρ(kg, giờ) hiện chưa ai đo.
2. **Đo từng hệ số bằng ablation**: dựng nhãn với hệ số = 1 và = giá trị đặt tay, so AUCeff lưới `dl-eval-fleet` (đã có chế độ `--trust monitored`). Nếu AUCeff đổi <0,003 thì bỏ hệ số cho gọn (CLAUDE.md bậc 1).
3. Thay ×0,3 bằng cờ "lặp" chỉ khi ≥2 loài và tổng kg ≥1 tấn (trùng tự nhiên rất khó).
4. Chuyển trọng số carrier và pair sang bước nhận diện bằng `encounters/vessels.json` (có sẵn trên PC GPU).

---

## Q5. Dùng kg BỐC DỠ thay kg KHAI THÁC

Số đo: `landedKg>0` ở 247.567 nhật ký (68%); `catchKg>0` chỉ 7.801 (2%); cả hai 6.968. Nên không có phương án "dùng kg khai thác" ngoài 2% đó. Vậy `landedOf` đúng là quyết định thực dụng duy nhất. Các lệch:

| Lệch | Hướng | Mức (đo hoặc giả thuyết) |
|---|---|---|
| **Tàu thu mua**: kg bốc dỡ = cá mua lại | kg gán vào giờ của tàu thu mua, vị trí sai | 1.317 tàu, **118 triệu kg = 15,7%**, trong đó 90 triệu thuộc gear NULL |
| **Bán/chuyển tải trên biển** của tàu đánh | kg bốc dỡ < kg đánh được; ô thực bị đánh giá thấp | 44% kg thuộc tàu có ≥1 sự kiện nghi chuyển tải (định nghĩa rộng, `suspectedTransshipments ≥ 1`), chưa biết bao nhiêu thật |
| **Cá tạp gộp** | Mất loài đích | Kéo 46% kg là "Cá Tạp", "?" 26% Cá Tạp + 13% Cá Xô; lưới sản lượng theo loài của kéo kém ý nghĩa |
| **Ghép đôi** | Một tàu khai cho cả cặp | 79% chuyến cặp có một tàu khai 0 |
| **Mã loài** | Mã không chuẩn mất loài | Bảng loài có mã = tên ("Mực thước"), rơi khỏi `ASFIS_TO_SHORT` (nhỏ: 141 kg) |
| **Nhật ký đối loài** | Catch/landed lệch loài trong cùng một nhật ký | mẫu thấy: catch `END` 500 kg, landed `OCZ` 0 kg |

### Đề xuất / đo

1. Gắn cờ `carrier` từ `encounters` và đưa kg sang nhóm "không có vị trí", không phân vào giờ của chính nó. Đo: AUCeff trước/sau, tỉ lệ kg đổi.
2. Với cặp: gộp kg của hai tàu và chia theo giờ trong dải của CẢ HAI. Đo: số chuyến đổi, giảm kg/giờ lệch.
3. Loại "Cá Tạp"/"Cá Xô" khỏi lưới theo loài nhưng giữ trong tổng nghề. Đo: số loài còn ≥20 tấn.

---

## Q6. Rò rỉ nhãn ↔ lưới đội tàu / sản lượng

Cách giữ-tháng-ra hiện tại: bản lưới "rò" (có tháng kiểm) chỉ hơn bản giữ-ra +0,001 (đội tàu) và +0,011 (sản lượng), nên không phải học thuộc tháng đó. Nhưng bài kiểm đó **không bắt** các loại sau (liệt kê theo mức quan trọng):

1. **Kg/giờ hằng định trong chuyến** (`dl-build-labels.mjs` dòng 275: `x.kg * scale * r.w * s.dtH / H`). Trong một chuyến mọi ô có cùng mật độ kg/giờ, nên AUCeff chỉ đo sự khác nhau **giữa các chuyến** (năng suất tàu), không phải **giữa các ô**. Lưới sản lượng loài nhận từ nhãn này sẽ học "tàu nào hay ra đâu", nên AUCeff tăng mạnh khi thêm kênh tàu/sản lượng (0,621 → 0,736) mà không chứng minh gì về cá.
2. **Gần nhau theo tháng và tàu**: giữ-tháng-ra không loại tàu. Tháng 7 và 9 trong lưới vẫn chứa cùng các tàu của tháng 8 (ngư dân quay lại cùng ngư trường), tức "ổn định" theo tàu. Cổng ≥3 tàu/ô cũng đếm trùng tàu qua tháng (lấy MAX giữa các khúc nhưng không phân biệt).
3. **Điểm nóng đứng yên bền vững**: nơi neo đậu, đảo trú bão, vùng trôi. Chúng xuất hiện trong nhãn (vmin 0) và trong lưới đội tàu (0–4,5 kn, kể cả đứng yên) ở mọi tháng, nên mô hình được thưởng vì dự đoán ra chúng. Khoảng 8–12% giờ Rê gần cảng là bằng chứng gián tiếp.
4. Nhãn kiểm định `dl-trk0809` dựng bằng pipeline/dải khác với 5 cửa sổ dùng cho lưới (dải mỗi cửa sổ một khác). Hai định nghĩa "giờ đánh" lệch nhau.

### Cách đo (4 phép, đều rẻ)

- **Giữ ±1 tháng** (bỏ M−1, M, M+1) khi chấm tháng M; AUCeff tụt >0,03 ⇒ phần lớn là tính bền theo tàu/tháng.
- **Tách theo tàu**: chia tàu theo hash thành 2 nửa; dựng lưới từ nửa A, chấm nhãn nửa B. Đo chênh với số hiện tại.
- **Đường cơ sở bền vững**: điểm ô = kg/giờ ô đó ở tháng M−1, không dùng vệ tinh. Nếu đạt ≥0,70 thì 0,736 hầu như là "đừng thay đổi gì cả".
- **Triệt tiêu năng suất tàu (ablation)**: thay kg của mỗi chuyến bằng trung vị kg/giờ của (nghề × lớp dài), dựng lại lưới sản lượng, chấm AUCeff. Nếu vẫn ≈0,73 thì kênh sản lượng chỉ là cơ cấu đội tàu, không phải cá.

---

## Q7. Luồng dữ liệu và riêng tư

| Vấn đề | Chi tiết | Mức |
|---|---|---|
| Mặc định đường dẫn lệch | `dl-collect.mjs` ghi `~/sdfish-data/dl`; doc §9–§11 dùng `~/sdfish-data/dl-all`; dữ liệu thật ở `/mnt/c/Users/admin/sdfish-data/dl-all` (ổ Windows, cạnh `tools/`). Hai tên cho cùng một thư mục tuỳ shell WSL/Windows | Trung bình, tái lập bằng lời |
| **Bộ chuyển `dl-adapt-local.mjs` ngoài repo, không version** | Lệnh chạy trong doc §11 trỏ vào nó; mặc định `--src "C:/Code/AI Assistant/..."`; chỉ một bản trên PC. Mất ổ ⇒ nhãn không dựng lại được. Đồng thời `dl-collect.mjs` (đường hầm trycloudflare đã hết hạn) là mã chết, doc §9 vẫn ghi chuỗi này | **Cao** cho tái lập |
| Không ghim phiên bản dữ liệu | `report.json` không ghi snapshot (`2026-10-11`), hash script, hash adapter. `--snap` mặc định cứng trong adapter | Cao: hai lần dựng cùng lệnh có thể ra nhãn khác khi snapshot đổi |
| Sổ tàu "mới nhất" áp cho chuyến cũ | `vessels.json` chỉ lấy `vessels.ndjson` hiện tại; tàu đổi nghề/đã xoá đăng ký (6.093 nhật ký) → "?" | Trung bình |
| PII | Adapter đã bỏ chủ tàu/số đăng ký/SĐT (tốt). Nhưng `track/<vesselId>.json` + `logbooks` giữ `vessel.id` Vxxxx và `ecdtRef`, `landingPort`: là **bút danh, không phải ẩn danh** (khoá nối về sổ tàu có chủ tàu tồn tại cùng máy). Nhãn CSV (`date,lat,lon,hours`) sạch; `catch-vessels-025.csv` chỉ đếm | Thấp-trung bình, chỉ cần dữ liệu không rời máy PC |
| Copy trên ổ Windows | `/mnt/c/...` là ổ có thể đồng bộ OneDrive/backup, nên có nguy cơ rời máy. Cần kiểm | Cần kiểm |
| Kiểm thử | `selftest()` trong script tự dựng cho segment/spearman/trust; không có vitest cho `dl-build-labels`, `build-species-catch-grid`. Doc/Test sync không bắt được | Thấp |

### Đề xuất

1. Đưa `dl-adapt-local.mjs` vào `scripts/` (khoảng 150 dòng, đã loại PII), nhận `SDVICO_DATALAKE_ROOT` và `SDFISH_DATA` từ env (đã có mẫu ở `build-fleet-effort-grid.mjs`). Cùng quy tắc "dữ liệu không vào git" vẫn đứng nguyên. Đo: chạy lại trên máy sạch cho ra `labels-*/report.json` giống byte với bản hiện có.
2. Ghi `report.json`: `snapshot`, `gitSha` của script, `adapterSha`, số dòng nhật ký vào. Đo: tái lập hai lần cùng hash.
3. Xoá hoặc đánh dấu `dl-collect.mjs` là kế thừa (đường hầm hết hạn) và sửa chuỗi ở §9.
4. Không để `track/` trên ổ có đồng bộ đám mây (kiểm tay).

---

## Q8. Năm việc đáng làm nhất ở khâu nhãn

Xếp theo (tác động lên chất lượng nhãn) ÷ (công). Mỗi việc ghi số kiểm.

| Hạng | Việc | Công | Vì sao | Kiểm bằng số |
|---|---|---|---|---|
| **1** | **Một bảng dải tốc độ cố định cho cả năm, bỏ vmin = 0 ngoại trừ vây ánh sáng, loại giờ trong 10 km quanh MỌI cảng bằng `catalog-ports` + `tk.c`** | ~½ ngày | Sửa đồng thời lỗi 2 và 3 của §0: giờ/chuyến 46–122 → ổn định; giờ gần cảng của Rê 12% (mẫu haulCount 56%) → <2% | (i) giờ/chuyến 5 cửa sổ chênh <20%; (ii) % giờ Rê ≤6 km cảng <2%; (iii) ρ(đợt, haulCount) không tụt; (iv) AUCeff `dl-eval-fleet` cùng 61 ngày không tụt quá 0,01 |
| **2** | **Kiểm định cứng (không cần nhãn mới): 4 phép của Q6** (±1 tháng, tách theo tàu, đường cơ sở bền vững, triệt tiêu năng suất tàu) | ~½ ngày, dùng script sẵn | Quyết định 0,736 có phải cá hay là cơ cấu đội tàu. Không đo thì mọi cải thiện nhãn sau đều mù | AUCeff giữ-±1-tháng, tách-theo-tàu, baseline M−1, ablation; ngưỡng cảnh báo: baseline ≥0,70 hoặc ablation ≥0,70 |
| **3** | **Gán nghề cho tàu NULL bằng bộ phân loại loài+dài+công suất (Q2) và tách carrier/pair khỏi nhãn vị trí (Q5)** | ~1 ngày | "?" 44% kg, ρ = −0,02 (không tín hiệu); carrier 15,7% kg có vị trí sai bản chất | kg "?" 44% → ≤12%; ρ(đợt, haulCount) của tàu NULL ≥0,35; AUCeff theo loài trên phần kg đổi; % kg carrier ra khỏi nhãn vị trí |
| **4** | **Thay ngưỡng cứng bằng phân đoạn hành vi 3 trạng thái (+ chuẩn hoá nhịp + giờ đêm cho Câu) và xin toạ độ mẻ (GY-473e65c9) để có thước thật** | 1–2 ngày (+ chờ bên Data Lake) | Đợt/mẻ Rê 4×, Kéo bỏ 44% giờ ở 2–4 kn, Câu ρ ≈ 0, chênh nhịp 36% | tỉ lệ đợt/mẻ ∈ [0,7–1,5]; ρ theo nghề ≥ baseline +0,15; với toạ độ mẻ: % giờ suy ra nằm ≤5 km mẻ thật |
| **5** | **Thay trọng số đặt tay bằng hồi quy bền Huber trên log(kg) ~ log(giờ trong dải) và bỏ hệ số vô tác dụng (×0,5, ×0,3, ×0,7)** | ~½ ngày | Theo đo, ×0,5 đụng 0,1% kg; ×0,3 đụng chuyến nhỏ tròn số; bỏ giúp code gọn, thêm trọng số thật sự có nghĩa | ablation AUCeff với hệ số =1 vs hiện tại (nếu chênh <0,003 thì bỏ); ρ(kg, giờ) trước/sau; % chuyến bị hạ trọng số có kg lớn bất thường |

Việc phụ nhưng rẻ: báo cáo độ phủ theo kg (Q3), ghim snapshot/hash vào `report.json` và đưa adapter vào repo (Q7, ~2 giờ).

---

## Phụ lục: phép đo đã chạy (gpu-desktop, chỉ đọc)

Tất cả chạy bằng `node -` qua stdin, không ghi file. Mẫu: logbooks-all.ndjson 364.788 dòng (không lọc), `dl-all/logbooks_2026-01-01_2026-10-11.json` + `trips` + `track/` cho phép đo cần VMS, `tracks/2026-08.ndjson.gz` 9.000 tàu đầu cho phép đo nhịp.

- Phân bố nghề trong sổ tàu: Rê 28.616 · Câu 19.186 · Kéo 11.032 · Khác 10.463 · Vây 4.870 · NULL 3.789 · Lưới chụp 2.045.
- Mẫu có haulCount, VMS tốt: 6.600 chuyến (Rê 2.817, Kéo 1.365, Vây 788, Lưới chụp 731, Câu 533, Khác 183, "?" 183).
- Giới hạn các phép đo trên: (a) dải/nghề dùng cho phép đo gần cảng là dải đã chọn ở cửa sổ 05–06 và 09–10, áp lên toàn bộ năm, tức chỉ để chỉ mức độ nặng, không thay cho nhãn thật; (b) phép đo nhịp dựa trên tàu-tháng không cắt chuyến, "đứng yên" gồm cả neo ở cảng khác; (c) phân loại nghề dùng tỉ trọng loài của chính nhật ký, có thể nhiễm nếu nghề quyết định loài cho "Cá Tạp"; (d) không có bản mẻ có toạ độ nên chưa có thước thật cho bất kỳ kết luận nào về chất lượng vị trí.
