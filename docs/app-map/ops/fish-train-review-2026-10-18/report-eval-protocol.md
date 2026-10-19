# Review khâu KIỂM ĐỊNH — pipeline dự báo cá SDFish (2026-10-18)

Phạm vi đọc: `scripts/dl-eval.mjs`, `dl-eval-fleet.mjs`, `dl-fit-profiles.mjs`, `fit-fish-blend-weights.mjs`, `dl-build-labels.mjs` (phần chia kg), `build-species-catch-grid.mjs` (đầu file), `fish-validate-positions.md` §1/§4/§9–11, `report-algorithm.md` B8/C1, `fish-predict.ts` (CATCH_SCALE, FISH_LEVEL_BANDS), `forecast-archive.ts`. Số liệu eval cũ lấy từ `~/sdfish-data/eval-head-labels-monitored.txt`. Chỉ đọc, không chạy lại. Chỗ nào là ước lượng của tôi thì ghi "ước".

## Phát hiện nền (ảnh hưởng gần như mọi câu)

**N1. Nhãn không có phân giải trong-chuyến.** `dl-build-labels.mjs:275`: `kg = x.kg·scale·w·dtH / H` — kg loài của chuyến chia đều theo GIỜ VMS. Hệ quả: trong một chuyến, kg/giờ là HẰNG SỐ ở mọi ô. Nhãn chỉ chứa thông tin "chuyến nào có CPUE cao × chuyến đó nằm ở ô nào ngày nào". Nó KHÔNG chứa "trong chuyến, ô nào ra cá". AUCeff vì vậy đo tương quan giữa điểm ô và CPUE-cấp-chuyến (lẫn kỹ năng tàu, cỡ tàu, tuyến), không đo "ô này hôm nay cá nhiều hơn ô bên cạnh".

**N2. Tham số đã "nhìn thấy" nhãn kiểm.** Số 0,621 (HEAD) đã gồm 15 hồ sơ loài fit lại trên CẢ HAI tháng 8–9 (`dl-fit-profiles.mjs:185`, nhận thì fit lại trên allD). Các bảng "cả kỳ" trong §9 (ngừ ồ 0,447→0,588…) là trong-mẫu. Sau đó FLEET_SCALE (0,3/0,5/0,7), FLEET_FULL_HOURS, CATCH_SCALE (0,5…1), CATCH_FULL_KG (500…50000) chọn trên chính 61 ngày đó. Giữ-tháng-ra chỉ che NỘI DUNG lưới, không che việc chọn siêu tham số. Ngoài ra bảng ASFIS_TO_SHORT dựng từ chính 107k nhật ký 8–9 (`dl-eval.mjs:27`), `MIN_SPECIES_T` (≥20 t) tính trên cả kỳ gồm tháng kiểm.

**N3. TB theo kg bị 5 loài thống trị.** Từ eval cũ: cá nục 11,6 + ngừ vằn 5,5 + ngừ ồ 3,3 + cá cơm 3,0 + mực xà 1,9 = 25,3 / 41,1 kt ≈ 62 % trọng số. Con số tiêu đề "+0,017" / "0,736" thực chất là 5 loài.

## 1. AUCeff có đo "năng suất trên giờ" không?

**Phát hiện.** Đo đúng khái niệm CPUE-phân-phối (pos = kg-weighted, neg = giờ-weighted, `dl-eval.mjs:205-206`), và phép "trộn cả chuyến không bắt được s vào mẫu số" là đúng. Nhưng có 3 lỗ:

1. **Gộp nghề → nhiễu địa lý nghề.** `targetGears` (`dl-eval.mjs:83`) lấy mọi nghề ≥10 % kg loài s. Cá nục = vây + kéo + vó…; giờ của kéo (60 % giờ VNM, §4) áp đảo mẫu số. Khi đó neg ≈ "bãi cá đáy", pos ≈ "bãi vây", và AUC lớn chỉ vì mô hình/kênh biết nghề vây làm ở đâu — không liên quan năng suất. Kênh đội tàu và kênh sản lượng (khoá = nghề/loài) khai thác đúng điều này. Nghi ngờ trực tiếp: cá nục 0,549→0,656→0,758; cá tráo 0,529→0,739 (§10–11) là các bước nhảy lớn nhất.
2. **Không có số "trong cùng nghề".** `catch.csv` có cột `gear`, nên tính được ngay không cần dữ liệu mới.
3. **Vài chuyến lớn thống trị?** Không kiểm được: nhãn đã cộng theo ô-ngày, mất mã chuyến/tàu. Chỉ có trần p99 kg/giờ theo nghề (`dl-build-labels.mjs:250-269`), không trần theo tổng kg chuyến.

**Rủi ro.** AUCeff cao có thể là "đúng nghề đúng bãi" chứ không phải "đúng chỗ năng suất cao". Điểm cuối 0,736 chưa chứng minh được điều đó.

**Đề xuất.**
- Số chính mới: **AUCeff-trong-nghề** = Σ_g w_g·AUC(pos_{s,g}, neg_{g}), w_g = kg loài s của nghề g (g ∈ nghề ≥10 %). Báo song song AUCeff cũ để thấy phần "địa lý nghề".
- Thêm `n_eff = (Σw)²/Σw²` và phần kg của top 1 % ô-ngày cho mỗi loài (tính từ catch.csv, 1 phút). Nếu n_eff < ~200 thì loài đó không dùng để chọn tham số.
- Ghi mã chuyến băm (không PII) vào catch.csv/effort.csv, để bootstrap theo chuyến và gập theo tàu (Q2, Q6).

**Cách kiểm.** Chạy lại bảng §11 với AUCeff-trong-nghề. Kỳ vọng nếu kênh thật sự ăn năng suất: bước nhảy 0,621→0,736 co lại nhưng vẫn dương. Nếu cá nục/cá tráo về ≈0,55 thì lợi ích chủ yếu là địa lý nghề. Chi phí: sửa ~25 dòng ở `prepare`/`prep`, không tải thêm.

## 2. Tự tương quan không gian + tàu lặp lại

**Phát hiện.**
- Lưới giữ-tháng-ra tháng 8 vẫn chứa tháng 7 và tháng 9 với trọng số ½ (`fleet-effort.ts`, `FLEET_NEIGHBOR_MONTH_W`, `wSum` chỉ cộng tháng có mặt). Vì chỉ có **một năm** nhãn, tháng M chấm bằng lưới "chỉ còn tháng kề" ⇒ thực chất đo **"tháng kề lặp lại" làm mịn**. Đây là phép đo hợp lệ cho production tháng sau, nhưng:
  - Tháng 8 dùng tháng 9 (TƯƠNG LAI). Production không có. Chỉ tháng 9 dùng tháng 8 là nhân quả.
  - Lưới ex-08 vẫn chứa phần cuối chuyến rời bến tháng 8 nhưng cập bến tháng 9 (loại theo ngày dòng, không theo chuyến) ⇒ rò ở biên tháng. Chuyến trung bình dài hàng chục ngày ⇒ ước 1–2 tuần đầu tháng kế bị ảnh hưởng.
- Cùng tàu, cùng ô, tháng 8 và 9: **chưa có phép đo nào chặn**. Đo rò hiện tại: lưới rò − lưới giữ-ra = +0,001 (đội tàu) và +0,011 (sản lượng). Con số này chỉ cho biết "bản thân tháng M" thêm ít so với tháng kề; nó **không** đo được trí nhớ theo tàu (tháng kề đã mang trí nhớ đó). Bằng chứng tốt hơn bằng 0 nhưng không phải bằng chứng.
- `dl-fit-profiles` gập 2 tháng kề nhau: cùng tàu, cùng bãi, cùng gió Tây Nam, nhiều chuyến vắt qua ranh. Hai "fold" không độc lập; chỉ chứng minh được "ổn định trong mùa", đúng như caveat đã ghi.

**Rủi ro.** Kênh sản lượng (x lấy tối đa 0,7 vào điểm cuối) có thể phần lớn là "tàu hôm nay quay lại ô tàu hôm qua"; ngưỡng ≥3 tàu (`MIN_VESSELS`) giảm nhưng không loại tương quan này.

**Đề xuất (giao thức gập, xếp từ nhẹ đến nặng).**
- **F1 gập theo tàu** (rẻ nhất, làm trước): chia tàu thành K=5 nhóm theo băm id; dựng lưới bằng 4 nhóm kia, chấm nhóm còn lại; thêm cờ `--exclude-vessel-fold k/K` cho `build-fleet-effort-grid.mjs` và `build-species-catch-grid.mjs`. Báo 3 số: (a) giữ-tháng-ra như cũ, (b) giữ-tàu-ra (cùng tháng), (c) giữ cả hai. Độ chênh (a)−(c) = ước lượng "rò theo tàu×thời gian". Với lưới ô 0,25° và ≥3 tàu, ước của tôi: 0,01–0,03 AUCeff (chưa đo).
- **F2 gập theo khối không gian–thời gian** cho `dl-fit-profiles` (tham số hồ sơ là toàn cục, nên cần chứng minh qua vùng): khối = 4 vùng (Vịnh Bắc Bộ, miền Trung 12–17°N, Đông Nam Bộ, Trường Sa/khơi) × nửa tháng, đệm 7 ngày giữa train và test (đủ cho tự tương quan SST và chuyến dài). Mỗi lượt giữ 1 khối vùng×tháng.
- **F3 chuỗi tiến**: tháng M chấm bằng tháng <M, không dùng tương lai (M=2…10; 9 lượt). Đây mới là số để so với production. Loại chuyến vắt ranh bằng mã chuyến (đệm 15 ngày).

**Cách kiểm.** So (a) với (c) và F3 với (a). Nếu F3 thấp hơn (a) quá 0,02 thì số chốt hiện tại bị tô hồng.

## 3. Bộ kiểm định 10 tháng

**Phát hiện.** Nhãn `dl-all` có 01→10/2026 (track 2025-12 → 2026-10, §11), lưới sản lượng đã dựng từ cả 5 cửa sổ; chỉ lưới vệ tinh ngày bị giới hạn ở 8–9. Mô hình kiểm hiện nay thiếu HYCOM/Copernicus (payload dựng lại), nên kiểm định **không phải bản production**.

**Chi phí tải (ước từ 3,5 phút/61 ngày ≈ 3,4 s/ngày).** 01/01→11/10 = 284 ngày; đã có 61 ⇒ cần thêm 223 ngày ≈ **13 phút**, ~vài trăm MB đĩa tại `~/sdfish-data/fc-full/grids` (cache sẵn theo tên `sst-YYYY-MM-DD.json`; script chỉ đọc file có tên đó nên bước tải là một lượt, cắm tiếp). Rủi ro thật là ERDDAP NRT không còn ngày xa (chl VIIRS DINEOF, SLA) ⇒ vài ngày thiếu, `dl-eval-fleet` đã lọc `x.sst && x.chl`.
- Chi phí chấm (không fit): `dl-eval-fleet` ~ 0,1–0,2 s/ngày/cấu hình (ước) ⇒ 284 ngày × 10 cấu hình ≈ 5–10 phút.
- Chi phí fit hồ sơ (`dl-fit-profiles`): hiện ≈20 phút/loài trên 61 ngày × (2 fold + 1 lượt cuối). Với 284 ngày × 5 fold ≈ 6 giờ/loài nếu dùng nguyên ngày. Cắt: lấy mỗi 3 ngày (SST/chl tự tương quan cao, mất ít thông tin) ⇒ ~1 giờ/loài; hoặc chỉ dò 2 nút quan trọng nhất (`chlShift`, `food`).

**Thiết kế đề xuất.**
- **5 fold 2 tháng liền** (01–02, 03–04, 05–06, 07–08, 09–10), đệm 15 ngày ở ranh, vì 2 tháng đủ lớn cho >1 mùa gió/chuyến dài và cho ra 5 con số để lấy trung bình ± SE. Giữ-tháng-ra luân phiên 10 lượt đẹp hơn nhưng lưới tháng kề của tháng M luôn nằm trong train ⇒ hầu như không đo được khả năng khái quát, chỉ đo "tháng kề lặp lại".
- Báo số **theo tháng** để lộ mùa (01–04 gió Đông Bắc, 08–09 Tây Nam): hồ sơ fit chỉ trên Tây Nam có thể tụt mạnh ở Đông Bắc.
- Cache: lưới vệ tinh `~/sdfish-data/fc-full/grids` (đã có), nhãn `~/sdfish-data/dl-all/labels-*`, lưới giữ-ra `~/sdfish-data/{fleet,catch}/…-ex-<fold>.json`. Thêm file `manifest.json` ghi hash nhãn + phiên bản thuật toán để biết cache cũ.

**Kho `forecast-archive`.** CHƯA dùng được để kiểm định hồi cứu: chỉ có từ 10/10 (≈8 ngày đến 18/10), và nhãn dl chỉ kéo đến ~11/10. Dùng được cho **kiểm định tương lai/tiến cứu**: đóng băng một `FISH_ALGO_REV`, mỗi ngày lưu bản đồ production + lưới đầu vào (đã có `fish-inputs/`), kéo lại nhãn mỗi tuần, tích luỹ AUCeff từng ngày. Sau ~60 ngày (≈ giữa 12/2026) sẽ có bộ test **không dính vào bất kỳ lần chọn tham số nào** — đây là bộ kiểm định thật duy nhất. Cần xác minh: bảng `fish_forecast_snapshot` là bản hiện tại hay nhiều tầm ngày (không thấy trong `fish-forecast-run.ts`); nếu chỉ ngày 0 thì không đo được tầm xa.

## 4. Baseline

Đang có (`dl-eval-fleet.mjs:129-143`): không kênh (HEAD) · đội tàu (nhiều scale) · +sản lượng · sản lượng không đội tàu · rò (trần). `dl-eval.mjs` có AUC ngày-khác (hoán vị).

Còn thiếu — theo thứ tự quan trọng:
1. **Điểm = x của kênh sản lượng thuần** (tắt toàn bộ mô hình vệ tinh, score = lưới kg tháng kề làm mịn). Đây là baseline "tháng trước lặp lại". Nếu ≈0,72–0,75 thì mô hình vệ tinh đóng góp ≤0,02 trên đỉnh và sản phẩm chủ yếu là "bản đồ tháng trước". Doc §11 tự thừa nhận 1,0 → 0,754 là "bản đồ năm trước".
2. **Điểm = đội tàu x thuần** (không loài) và **Điểm = x tháng trước (chuỗi tiến)**.
3. **Baseline tĩnh**: độ sâu / khoảng cách bờ / vĩ độ một biến (hoặc cây quyết định 3 biến tĩnh). Vì AUCeff tách thất bại nghề–bãi (Q1), baseline tĩnh cho biết phần "địa lý nghề" miễn phí là bao nhiêu.
4. **Khí hậu thuần**: `public/data/fish-climatology.v1.json` hoặc điểm trung bình theo tháng của chính mô hình (ảnh vệ tinh bị bỏ). Là cận dưới của Δdyn.
5. **Ngẫu nhiên có cấu trúc**: điểm ngẫu nhiên làm mượt không gian cùng kernel 3×3 để AUC≠0,5 chỉ vì hình học. AUCeff của ngẫu nhiên thuần trên lý thuyết ~0,5, nên rẻ nhưng là phép kiểm tự thân (sanity), nên có trong selftest.
Mọi baseline phải đi qua cùng `evaluate()` để cùng lưới ô, cùng nhãn, cùng tie-handling (điểm nguyên 0..100, nhiều ô bằng 0 do `KEEP_MIN`).

## 5. Δdyn ≈ 0: mô hình, nhãn hay metric?

**Cả ba, nhưng nhãn là nút cổ chai chính.**
- **Nhãn (N1):** kg/giờ hằng trong chuyến ⇒ tín hiệu ngày chỉ đến từ "hôm nay tàu đứng ở ô nào" (nơi ngư dân đã chọn theo kinh nghiệm/ cá hôm qua), không phải "cá ở đâu". Hơn nữa chuyến dài nhiều ngày ⇒ CPUE hằng qua nhiều ngày. Δdyn ≈ 0 hầu như được đảm bảo bởi nhãn này, dù mô hình tốt đến đâu.
- **Mô hình:** điểm do tĩnh áp đảo (độ sâu, bờ, mùa vụ, hồ sơ, kênh tháng). Sau khi thêm kênh đội tàu/sản lượng và mùa vụ ngày xa, Δdyn ngừ vằn giảm 0,012→0,001 (doc §9). Tức mô hình càng giàu tĩnh, càng ít phụ thuộc ảnh hôm nay. Phương sai điểm giữa các ngày << phương sai trong ngày.
- **Metric (hoán vị):** `derange()` ghép ngày ngẫu nhiên, trung bình cách nhau ~20 ngày nhưng cả 61 ngày cùng mùa cùng bãi ⇒ lưới ngày khác vẫn là một ảnh gần như tương đương. Δdyn chỉ nhạy cái "dịch chuyển lớn so với trung bình mùa". AUC toàn lưới trộn thang tỉnh (cả biển) và thang nhỏ (cùng bãi), rất kém nhạy với dịch chuyển 20–50 km.

**Đề xuất metric bổ sung (xếp ưu tiên).**
1. **AUC cục bộ**: chỉ so cặp pos/neg trong cùng khối 1°×1° (≈110 km) cùng ngày/tuần, rồi trung bình khối theo trọng số kg. Triệt tiêu địa lý lớn, chỉ còn "ô nào trong bãi này tốt hơn".
2. **Dị thường**: trừ điểm trung bình của ô trong tháng khỏi điểm ngày (`sc_dev = sc − mean_tháng(sc)`), và CPUE-ô-ngày trừ CPUE trung bình ô; Spearman theo ngày × ô (ô-ngày có ≥ H giờ, ví dụ ≥6 giờ để CPUE ổn định). Đây là "động" thuần.
3. **Top-k theo ngày**: tỉ lệ kg ngày d rơi vào top 10/20 % ô điểm cao nhất ngày d (so với top 10/20 % ô có giờ đánh). Dễ hiểu cho BA.
4. **Hiệu chuẩn theo mức hiển thị**: kg/giờ trung bình tại `FISH_LEVEL_BANDS` (Thấp 40–60, TB 60–75, Cao ≥75). Là câu hỏi sản phẩm thật: "đỏ có cho CPUE gấp mấy lần xanh?".
5. **Nhãn mịn hơn cho 1 tập con**: kiểm tra eCDT có toạ độ từng mẻ (trường `haulCount` đã dùng để chỉnh dải tốc độ; nếu kèm toạ độ/giờ mẻ). Nếu có, dựng bộ "vàng" trên tàu có nhật ký điện tử đủ mẻ, rồi mới kết luận về Δdyn. Không có thì phải ghi thẳng: "Δdyn không đo được bằng nhãn này", đừng diễn giải thành "ảnh vệ tinh vô dụng".
Thêm: hoán vị chỉ ghép ngày cách ≥ 7 ngày (loại ghép ngày kề tương quan).

## 6. Khoảng tin cậy

**Phát hiện.** Có p hoán vị (300, `dl-eval.mjs:235`), không có CI. 61 ngày × hàng trăm nghìn cặp (ô, giờ) nhưng N hiệu dụng chỉ cỡ số chuyến/khối không gian-thời gian độc lập, ước ~vài chục tuần-vùng; còn xa 61. Chênh "0,017" (HEAD→bản chốt) và các "+0,05" trên từng loài chưa có thước nhiễu. Hoán vị p chỉ trả lời "điểm ngày d có khác điểm ngày khác" — không phải "thắng baseline bao nhiêu".

**Cách ra CI rẻ (không tải thêm).**
- **Bootstrap theo khối ngày**: mỗi (ngày, loài) giữ 3 histogram 101 ô (hp, hn, ha) — đúng cái `aucFor` đã dựng (`dl-eval.mjs:197`). Lấy mẫu có hoàn lại các khối 7 ngày (61 ngày ≈ 9 khối) B=500 lần, cộng histogram, tính AUC. Mỗi lần ~101 phép cộng × số ngày ⇒ vài trăm ms cho cả 35 loài.
- **CI cho CHÊNH CẶP** giữa hai cấu hình (HEAD vs đội tàu vs +sản lượng): dùng CÙNG mẫu khối, tính AUC_A − AUC_B mỗi lần, lấy 5–95 %. Hẹp hơn nhiều so với CI từng số, vì nhiễu ngày dùng chung.
- Cần lưu hp/hn/ha theo ngày vào JSON kết quả (hiện `dl-eval-fleet` chỉ gộp P/N toàn kỳ, `evaluate()` ở `:102-126` ⇒ phải đổi thành giữ histogram theo ngày).
- Khi có mã chuyến (Q1): bootstrap theo chuyến cho cấp loài; trung bình-lớn-nhất (theo kg và macro theo loài) bootstrap chung.
- Báo thêm TB macro (đều loài) bên cạnh TB theo kg (N3), CI cho cả hai.

**Kỳ vọng (ước, chưa đo).** CI 90 % cho TB-theo-kg cỡ ±0,01–0,02 ⇒ "+0,017" HEAD→bản chốt có thể chạm ngưỡng, "+0,05" (đội tàu) và "+0,064" (+sản lượng) rất có thể đủ, các loài <1 kt thì thường không.

## 7. Ngưỡng nhận tham số (TB ≥ 0,01, cả hai chiều ≥ −0,005)

**Phát hiện.** `dl-fit-profiles.mjs:184`. Ngưỡng cố định, không liên hệ với nhiễu của AUC. Số phép so sánh: lưới `GRID` = 6+4+7+4+4+3 = 28 giá trị, 2 vòng, nhận mọi bước >+0,002 ngay (không phải best-of) ⇒ ≤56 cấu hình/fold/loài, 35–43 loài trong `SPECIES_PROFILES` (grep `short:` = 43), lượt đã chạy 17 loài. Hai fold chỉ có 2 điểm, mà hai tháng kề nhau ⇒ cực tương quan.
- Nếu nhiễu hiệu AUC giữa hai cấu hình gần giống nhau là σ≈0,01 mỗi tháng (ước), trung bình hai tháng có σ≈0,007; ngưỡng 0,01 ≈ 1,4σ ⇒ xác suất qua ngưỡng khi KHÔNG có hiệu thật ≈ 8 % (sai, chưa tính ràng buộc "cả hai chiều"), tức kỳ vọng **1–3 loài nhận oan** trong 17–35 loài. Quan sát 15/17 nhận cho thấy phần lớn là tín hiệu thật (chl lệch cao hệ thống: 13/16 dừng ở mép −0,4, rồi 5 loài dừng ở mép −1,0) — nhưng chính điều này nói mô hình mồi chung sai thang chứ không phải 15 sự thật loài-độc-lập.
- Các số "cả kỳ" trong bảng §9 là trong-mẫu (N2); đừng so với tháng đo.
- Dừng ở mép lưới dò = hồ sơ không-xác-định, không phải tối ưu.

**Đề xuất.**
- Chuyển sang quy tắc theo thống kê: nhận khi **cận dưới 90 % của chênh trung bình tháng-đo** > 0 (bootstrap khối ngày trên tháng đo), VÀ thắng ≥ 2/2 lượt trong F2/F3 (Q2), VÀ áp Benjamini–Hochberg trên loài (q=0,1) ⇒ loài ít kg (n_eff nhỏ) tự động bị loại.
- **Gộp tham số**: `chlShift` dùng CHUNG một giá trị cho nhóm (nhóm nổi nhỏ, nhóm đáy) rồi mới tinh loài; ngưỡng nhận cho hiệu chỉnh chung chỉ đếm 1 giả thuyết, không đếm 15.
- Không nhận khi tham số nằm sát mép lưới dò mà chưa mở rộng.
- Báo **tăng ròng sau chọn lọc**: nếu 15 loài nhận mà AUCeff mới ghi trên tháng-giữ-ra TB chỉ +0,02 trong khi cả kỳ ghi +0,08, dùng số +0,02 làm "kỳ vọng thật".

**Về `fit-fish-blend-weights.mjs`.** Gập `i % 4` trên 12 mốc gốc (`pickOrigins`: năm 2022–2025 × tháng 1/4/7/10, ngày 10) tình cờ = **giữ-mùa-ra**, tốt. Nhưng "sự thật" là bản đồ của chính mô hình ở ngày T+d (`scoreMap(target, m)`), nên w(d) tối ưu hoá "bản đồ ngày xa giống bản đồ ngày gần thế nào", KHÔNG phải "bắt cá". RMSE còn thưởng việc kéo về trung bình (tự thừa nhận ở dòng 138–142); top-100 hit cũng so với "top-100 của bản đồ chính nó". Hạng mục kèm theo: thay sự thật bằng nhãn thật: dùng `dl-eval.mjs aucFor` với `pairing[i] = i − d` (ảnh ngày T chấm nhãn ngày T+d) ⇒ đường AUCeff theo tầm ngày d=0…16, rồi fit w(d) tối đa AUCeff. Rẻ: lưới đã cache, chỉ cần khoảng ngày liên tục 01–10/2026 từ Q3.

## 8. Giao thức kiểm định chuẩn đề xuất (1 trang)

**Tách dữ liệu.**
- Nhãn `dl-all` 01→10/2026 (ghi băm mã chuyến, băm tàu).
- *Tuning set* (chọn siêu tham số, fit hồ sơ): 5 fold 2 tháng (F2) với đệm 15 ngày; lưới đội tàu/sản lượng dựng không có fold kiểm VÀ không có chuyến vắt ranh.
- *Chuỗi tiến* (F3, 9 lượt): số báo cáo cho "tháng sau".
- *Giữ-tàu-ra* (F1) cho mọi kênh có lưới.
- *Tập khoá tiến cứu*: ngày ≥ 10/10 từ `forecast-archive`, đóng băng thuật toán theo `FISH_ALGO_REV`, chỉ chấm, không bao giờ dùng chọn tham số. ≥60 ngày mới kết luận.

**Metric.**
- Chính: AUCeff-trong-nghề, TB macro theo loài (cạnh TB theo kg) cho tập loài có n_eff đủ lớn.
- Phụ: AUCeff cũ (để so lịch sử), AUCarea (chỉ để cảnh báo), AUC cục bộ 1°, kg/giờ theo mức hiển thị (Thấp/TB/Cao), top-k theo ngày, Spearman dị thường ngày × ô.
- Δdyn: chỉ báo cáo kèm cảnh báo N1 cho đến khi có nhãn mịn; hoán vị ghép ngày cách ≥7.

**Baseline bắt buộc** cùng `evaluate()`: tháng-trước-lặp-lại (x thuần), đội tàu thuần, tĩnh (độ sâu+bờ+vĩ), khí hậu mô hình (bỏ ảnh), ngẫu nhiên mượt, mô hình không kênh (HEAD).

**CI.** Bootstrap khối-7-ngày (B=500, histogram lưu theo ngày), CI 90 % cho từng số và cho CHÊNH CẶP giữa cấu hình. Khi có mã chuyến thêm bootstrap theo chuyến.

**Nhận / từ chối.**
- Kênh hoặc tham số mới được nhận khi: (i) cận dưới 90 % của chênh AUCeff-trong-nghề so với baseline mạnh nhất (x thuần hoặc HEAD) > +0,01 trên chuỗi tiến F3; (ii) không tụt >0,01 trên giữ-tàu-ra (F1); (iii) không loài nào có n_eff ≥ ngưỡng tụt >0,02 (cho phép ghi nợ); (iv) với tham số hồ sơ theo loài: BH q=0,1 trên các loài + thắng ≥ 2/2 fold khối; (v) không dừng ở mép dò.
- Khi chọn siêu tham số (scale, kg bão hoà) trên tuning set: chốt giá trị rồi chạy MỘT lần trên tập tiến cứu; thừa nhận mọi số "0,736" là cận trên lạc quan.

**Chi phí chạy.**
- Tải lưới vệ tinh thêm: ~13 phút một lần.
- Dựng lưới giữ-ra: đội tàu ~4 phút/lượt, sản lượng ~vài phút/lượt (ước) × (5 fold-khối + 5 fold-tàu + 9 chuỗi tiến) ≈ 1–2 giờ, chạy nền được.
- Chấm cấu hình (không fit): 5–10 phút cho bộ 10 cấu hình + bootstrap < 1 phút.
- Fit hồ sơ loài: ~1 giờ/loài (mỗi 3 ngày, 5 fold); 15 loài ≈ 15 giờ máy, nên chạy qua đêm và chỉ cho loài có n_eff đủ lớn.

### 5 việc xếp theo tác động × công

| # | Việc | Tác động | Công | Ghi chú |
|---|---|---|---|---|
| 1 | AUCeff-trong-nghề + n_eff + TB macro, chạy lại bảng §10–§11 | Rất cao (có thể đổi kết luận "0,736") | Thấp (~½ ngày, không tải thêm) | Dùng sẵn cột `gear` |
| 2 | Baseline `x` thuần (tháng-trước-lặp-lại), `x` đội tàu thuần, baseline tĩnh (sâu/bờ/vĩ) | Rất cao (cho biết mô hình vệ tinh đóng góp bao nhiêu) | Thấp (~½ ngày) | Điều kiện tiên quyết để đọc mọi số khác |
| 3 | Bootstrap khối-7-ngày + CI cho chênh cặp; lưu histogram theo ngày | Cao (biết +0,017 có thật không; thay MIN_GAIN cố định bằng cận dưới CI + BH) | Thấp–vừa (~1 ngày) | Không cần dữ liệu mới |
| 4 | Mã chuyến/tàu vào nhãn → gập-theo-tàu (F1), purge chuyến vắt ranh, chuỗi tiến (F3); loại việc dùng tháng tương lai | Cao (định lượng rò thật) | Vừa (1–2 ngày, dựng lại nhãn+lưới ~vài giờ) | `dl-build-labels` thêm 1 cột, 2 builder thêm cờ |
| 5 | Mở rộng 10 tháng (tải ~13 phút) + 5 fold-khối; bật kiểm định tiến cứu bằng `forecast-archive` (đóng băng ALGO_REV, kéo nhãn hằng tuần) | Cao về dài hạn (bộ test không bị chọn tham số chạm tới) | Vừa–cao (1–2 ngày + chờ 60 ngày) | Việc đo tầm xa dùng `pairing=i−d` thay `fit-fish-blend-weights` |

Không xếp vào top-5 nhưng cần ghi nợ: kiểm tra eCDT có toạ độ mẻ để dựng bộ nhãn "vàng" cho Δdyn (N1/Q5) — nếu có, tác động rất cao và nên lên #2–3.
