# Review PHƯƠNG PHÁP HỌC — pipeline dự báo cá SDFish (2026-10-18)

Chỉ đọc code, không sửa repo. Có CHẠY đo thời gian thật trên Mac (script nằm ở scratchpad, không trong repo): lưới 8–9/2026 ở `~/sdfish-data/fc-full/grids` (Mac có 31 ngày cách ngày, PC có 61). Số "ước" ghi rõ là ước.

## 0. Ba phát hiện lớn nhất (đọc cái này nếu bận)

1. **Cách fit đang tốn công vô ích: ~85 % thời gian mỗi lượt dò là tính lại thứ KHÔNG đổi theo tham số.** Đo trên Mac, 1 ngày lưới 69×65 (3 215 ô biển): `buildFishForecast` 1 loài = **80 ms**, cả 38 loài = **110 ms**. Trong 80 ms đó riêng `spatialAnomaly(anom)` = **67 ms** (sla 3 ms, front mịn 2 ms). Tức chi phí theo loài chỉ ~0,8 ms/ngày, phần còn lại là dựng lại đặc trưng ô giống hệt ở mọi lượt. Fit thật tốn 548–1459 s/loài (TB 1002 s, `~/sdfish-data/fit/*.json`, 25 loài = 25 056 s ≈ 7 giờ). Có thể xuống **vài chục giây/loài** mà KHÔNG đổi dạng mô hình (mục 1, 6).
2. **Fit đang đo sai thứ và có nhiều chỗ dễ học thuộc**: (a) `dl-fit-profiles.mjs:127-135` dựng dự báo KHÔNG truyền `fleet`/`catchGrid` nên tham số hồ sơ được fit cho mô hình khác với production (production có hai kênh tĩnh, cộng vào điểm cuối); (b) điểm bị làm tròn nguyên + cắt KEEP_MIN=25 về 0 (`fish-predict.ts:1702-1703`, `dl-fit-profiles.mjs:135` "ô bị KEEP_MIN cắt = 0") nên AUC mù ở nửa dưới thang điểm, hàm mục tiêu có bậc thang; (c) hai nếp gập cạnh nhau (tháng 8/9), mỗi nếp ~15 ngày tự tương quan ⇒ chừng 3 mẫu độc lập; nghiệm hai nếp thường NGƯỢC nhau (mực nang: nếp 8 `chlShift +0,4, sstShift +2`, nếp 9 `chlShift −0,4, sstShift −0,5`; cá sòng sstShift +1 vs −2) mà vẫn "NHẬN" vì luật chỉ đòi cả hai nếp không tệ đi.
3. **Chưa có phép đo nào cho tham số "quyết định mọi thứ"**: 228 số `w{thermFront,chlFront,eddy,upw,conv,thermo}` của 38 loài, `SURFACE_CONF`, `NEUTRAL_AGG`, `SOFTOR_SCALE`, các hằng chuẩn hoá front (mục 5). Dò hiện tại chỉ chạm 6 nút: dải nhiệt, dải mồi, foodDependence, độ sâu, cách bờ.

---

## 1. Dò toạ độ từng loài — rủi ro và cách fit rẻ hơn, đúng hơn

**Phát hiện (kèm dòng):**
- `dl-fit-profiles.mjs:144-152` GRID: 6 nút (sstShift 6 mức, sstWidth 4, chlShift 7, food 4, depthScale 4, coastScale 3) = 28 giá trị. `fit()` (L155-166) tối đa 2 vòng ⇒ ≤ ~57 lượt `evaluate`, gọi 3 lần (nếp 8, nếp 9, cả kỳ) ⇒ **≤ ~170 lượt/loài**, mỗi lượt dựng lại 15–31 ngày. Quan sát: ~1000 s ⇒ ~5,9 s/lượt (≈0,28 s/ngày-dự báo; Mac đo 0,08 s/ngày, phần chênh là máy PC + dựng `Map`/mảng nhãn mỗi lượt).
- Chọn tốt nhất trong 170 lượt trên 2 nếp ⇒ **thiên lệch người thắng** (winner's curse). `fitted.aucEff` trong file là trong-mẫu (cá cơm 0,600→0,676; bạc má 0,681→0,769) — số trung thực là điểm nếp giữ-ra (cá cơm +0,076/+0,057; ngừ vằn +0,056/−0,004). Ngưỡng `MIN_GAIN = 0,01` (L35, L184) không có phép chứng minh nó chặn được nhiễu: chưa ai đo tỉ lệ nhận-oan khi nhãn bị xáo.
- Cả 25/25 loài dừng ở `chlShift = −0,4` (mép lượt 1) và 5 loài còn ở mép −1,0 lượt 2 (§9 doc) ⇒ đây là **một độ lệch HỆ THỐNG của dải mồi** (khác sản phẩm phù du với tài liệu gốc), không phải 25 sự thật riêng. Fit 25 lần riêng rẻ tiêu bậc tự do vô ích.
- `sstShift` ±2 °C là bậc tự do rất tự do cho dải nhiệt đã dẫn nguồn; phải vá bằng luật nghiệp vụ tay (L88-104 `keepWarm`) — dấu hiệu tham số chưa có prior.
- Dữ liệu CHỈ MỘT mùa gió Tây Nam (caveat L199 file tự ghi) trong khi nhãn thật có 01→10/2026 (155 nghìn chuyến) — đặc trưng vệ tinh mới là cổ chai, không phải nhãn.

**Đề xuất (xếp theo lợi/chi phí):**
1. **Tính trước đặc trưng ô-ngày MỘT lần** (nhanh nhất, ít rủi ro): tách thân vòng lặp ô trong `buildFishForecast` (L1484-1700) thành `buildCellFeatures(grids) → mảng ô {lat,lon,region,mon, t,tBottom,tDeep,c, fThermFront,fChlFront,fEddy,coldStr,warmStr,upwTerm,convTerm,thermoAnomM, depthM,coastKm,hasReef, fleetX[sp], catchX[sp]}` và `scoreCell(F, profile, month, consts)` (đoạn L1556-1690 ~130 dòng). `buildFishForecast` gọi cả hai ⇒ một nguồn logic, KHÔNG nhân đôi công thức (nếu script tự chép công thức sẽ lệch production, đúng lỗi "haversineKm 2 bản" của CLAUDE.md). Cache Float32Array ~14 đặc trưng × 3 215 ô × 300 ngày ≈ **54 MB**. Lượt dò = vòng `scoreCell` trên ô trong mùa (ngừ vằn chỉ 1 299/3 215 ô) + AUC histogram.
2. **Điểm liên tục, không làm tròn, không KEEP_MIN** khi fit: thêm cờ `extra.rawScores` (hoặc `scoreCell` trả số thực); AUC dùng histogram 2 048 ngăn (sai số < 0,001). Hết bậc thang, hết "vượt ngưỡng 25 để ăn điểm".
3. **Fit chung rồi co về prior, không fit 34 lần rời**: một `δchl` toàn cục (+ lệch riêng loài bị phạt `λ·(δ_s)²`), `sstShift/width` phạt `((θ−θ0)/σ)²` với σ ~ 1 °C (tài liệu), thay luật `keepWarm` tay bằng ràng buộc hộp. Giảm tham số tự do từ 25×6 xuống ~1 + 25×3.
4. **Bộ tối ưu**: tọa độ hiện tại đủ tốt sau khi rẻ; thay `GRID` rời rạc bằng bước liên tục (golden-section/Nelder–Mead ~60 dòng JS thuần, không dep) trên 5–8 nút. Random search không cần.
5. **Kiểm tra nhận-oan**: chạy đúng quy trình trên nhãn dịch ngày ≥15 ngày (hoán vị có sẵn trong `dl-eval.mjs`) cho 25 loài; nếu ≥ 2 loài vẫn "NHẬN" thì `MIN_GAIN=0,01` không bảo vệ gì ⇒ đổi sang block-bootstrap (khối 7 ngày) và đòi CI 90 % của gain > 0.
6. **Fit với hai kênh tĩnh BẬT ở chế độ giữ-tháng-ra** (`dl-eval-fleet.mjs` đã có thư mục lưới `fleet-ex-<tháng>`, `catch-ex-<tháng>`): mới đo "đóng góp tăng thêm của vệ tinh".

**Ước tốc độ** (ước; mô hình dựa trên đo Mac 80 ms/ngày cho đường hiện tại):
| Cách | /lượt, 61 ngày | /loài (≈170 lượt) |
|---|---|---|
| hiện tại (PC quan sát 0,28 s/ngày) | ~17 s | ~17 phút (khớp log) |
| chỉ memo `spatialAnomaly(anom)` (3 dòng WeakMap) | ~2,5–3 s trên Mac (13/80 ms) | ~7 phút/loài |
| cache đặc trưng + `scoreCell` | **~0,1–0,2 s** (200k ô-ngày × ~0,5–1 µs) | **~20–35 s** |
| như trên, 300 ngày, Nelder–Mead 800 lượt, trong mùa | 0,3–0,5 s/lượt | 4–7 phút/loài-nếp; 38 loài × 6 nếp / 8 worker ≈ 1–1,5 giờ |
Tức ~100–170 lần nhanh hơn ở cùng dạng mô hình. Bước memo nhanh nhất làm được trong 10 phút và đã cho ~6×.

---

## 2. Thêm tầng học thống kê nhẹ trên nền HSI?

**Phát hiện:** nhãn đủ lớn (catch.csv 1,67 triệu dòng ở 8–9; ~9,2 triệu cả năm; gộp ô 0,25°×ngày còn ~10⁵–10⁶ dòng/loài tuỳ loài), đặc trưng ~12; hồi quy trọng số bằng IRLS với ma trận 12×12 chạy < 2 giây/loài, ~80–120 dòng JS, không dep. Vấn đề không nằm ở tính toán mà ở **hai bẫy**:
- Δdyn ≈ 0 ở đa số loài (§9 doc) — tức tín hiệu "hôm nay" từ ảnh vệ tinh chưa đo được; gain AUCeff hiện tại (0,621→0,736) phần lớn đến từ hai kênh TĨNH (đội tàu, sản lượng tháng). Một tầng học nếu đưa vào độ sâu/cách bờ/vĩ độ sẽ học lại chính "chỗ tàu hay đi" ⇒ trùng kênh sản lượng, AUC giữ-tháng-ra tăng giả.
- Phá bất biến: `tFit=0 ⇒ 0`, "thiếu tín hiệu ⇒ điểm không tăng" (monotonic test). Hồi quy cộng logit không tự giữ được.

**Thiết kế đề xuất (nếu làm): residual logistic CÓ KHOÁ**
- Nền: `h = tFit·depthFit·sW·…` giữ nguyên (cổng cứng). Bên trong cổng: `logit(p) = logit(clip(fit0)) + β0 + Σ βk·zk`, zk = nhiệt chuẩn hoá theo khí hậu tháng (không phải toạ độ), logChl, thermFront, chlFront, |eddy|, upw, conv, thermoAnom; **cấm vĩ/kinh/độ sâu/cách bờ** (đã có cổng); dấu βk ràng buộc theo dấu hồ sơ (front ≥0…), ridge λ; thiếu đặc trưng ⇒ zk = 0 và `β·z` bị kẹp `min(0,·)` để giữ monotonic.
- Dạng quan sát: use-availability (dương = kg, âm = giờ đánh nhóm nghề) — cùng cấu trúc AUCeff.
- Giải thích được: "vì sao" = các `βk·zk` lớn nhất, đổi thành chữ nhiệt/mồi/front như UI hiện nay.
- Tham số ≤ 13 số/loài vào `model-params.v1.json`; chạy ở SERVER (không lộ ra bundle), snapshot đã tính sẵn ⇒ app offline không đổi.

**So 5 tiêu chí:**
| Tiêu chí | HSI + dò tham số (nay) | + residual logistic |
|---|---|---|
| 1 Không nói dối | điểm không hiệu chuẩn, nhưng mọi nấc có lý do vật lý | β học được có thể ngược chiều; cần khoá dấu |
| 2 Có số mới đổi | có (AUC giữ-ra) | có, thêm CI/bootstrap dễ vì rẻ |
| 3 Không tắt loài đang vụ | cổng sW sàn 0,6 | cùng cổng; không đụng |
| 4 Điểm nóng không phình | softOR kiểm soát | residual dễ kéo cả bản đồ lên; ép lại bằng tái chuẩn hoá p90 hoặc kẹp |
| 5 Ít code | 0 | +~150 dòng (IRLS + export + vài test) |

**Thí nghiệm nhỏ nhất (1 ngày công):** 1 loài **ngừ vằn** (nhiều nhãn, có Δdyn dương +0,018 p 0,003 làm đối chứng dương) + 1 loài **cá nục** (11,6 nghìn t, Δdyn ≈ 0, đối chứng âm). Dữ liệu 61 ngày PC (hoặc 300 ngày sau backfill, mục 7). Chạy 3 nhánh trên cùng đặc trưng cache: A = HSI nay, B = HSI + Nelder–Mead có prior, C = A + residual. Leave-one-month-out.
**Thắng nếu CẢ BỐN:** (i) Δdyn giữ-ra (hoán vị ngày 300 lần) tăng ≥ +0,02 so A và p<0,05; (ii) AUCeff giữ-ra ≥ A+0,01 ở cả hai nếp; (iii) %diện tích điểm ≥50 tăng ≤ 2 điểm %; (iv) số ô ≥50 tháng chính vụ không giảm > 5 %. Nếu C thua B/A ở (i) thì dừng — không thêm tầng.

---

## 3. Hằng 0,7 toàn cục của kênh sản lượng

**Phát hiện:**
- `CATCH_SCALE=0,7` (L113) và `CATCH_FULL_KG=8000` (L121) dò tay trên 4–5 giá trị trên bảng gộp theo kg (§11 doc). **Một `catchFullKg` cho cả 34 loài** (`fish-predict.ts:1350`, `fleetPresenceLookup` nhận 1 `fullHours`): loài tổng chỉ vài chục tấn (ngừ chấm, cá hố) x gần 0 ở mọi ô ⇒ kênh chết; cá nục hàng nghìn tấn x bão hoà cả vùng ⇒ phẳng. Doc tự thấy: AUCeff tăng tới `scale=1,0` (0,754) — tức AUC chọn "bản đồ chỗ năm trước", nên AUC không phải mục tiêu đúng để chọn hằng này; chốt 0,7 đang là luật sản phẩm (< ngưỡng Cao 75) chứ không do dữ liệu.
- Đo giữ-tháng-ra dùng tháng KỀ (§10-11), còn production dùng **cùng tháng năm trước** (hoặc tháng gần nhất) — chưa phép đo nào cho tình huống đó; bản rò chỉ hơn +0,011 là bằng chứng "không học thuộc tháng" chứ không phải bằng chứng "bền qua năm".

**Đề xuất:**
- Chuẩn hoá theo loài, không fit: `x = 1 − exp(−kg / K_s)` với `K_s` = trung vị kg của ô dương loài s (một thống kê, ghi vào file lưới lúc build). Thay 1 hằng tay bằng 34 số tính từ dữ liệu.
- `CATCH_SCALE` theo **nhóm** (4 nhóm `category`: pelagic-large/small, cephalopod, demersal) trong khoảng [0 ; 0,74] (cứng: sản lượng một mình < Cao 75) bằng quét 1 chiều, rẻ khi có cache. Mục tiêu **không phải AUCeff thuần** mà `AUCeff giữ-ra − μ·hạn` hoặc tách: chọn scale lớn nhất mà **Δdyn không tụt quá 0,005** (giữ vai trò vệ tinh).
- Cách "Bayes" gọn, TÁI DÙNG cùng bộ IRLS của mục 2: `logit P = a_c + b_c·logit(fitSat) + g_c·log1p(kg/K_s)` mỗi nhóm 3 số (12 số toàn bộ) — prior = sản lượng, likelihood = vệ tinh; hệ số `b_c` nhỏ ⇒ vệ tinh vô ích ở nhóm đó (trung thực để nói). Ràng buộc `g_c` để `fitSat=0, x=1 → P ≤ 0,74`. Nếu không muốn đổi dạng: giữ noisy-OR, chỉ làm hai bước đầu.
- Đo: leave-month-out với `catch-ex-*` có sẵn; THÊM leave-year-out ngay khi có nhãn 2025 (xin DataLake tải 2025: quan trọng nhất trong cả đề xuất này, vì đó mới là tình huống production).

---

## 4. Đo w(d) bằng cá thật

**Phát hiện:** `fit-fish-blend-weights.mjs:14-16` w* = Σ(a·b)/Σ(a²), a = persist−clim, b = **truth−clim với truth = dự báo từ ảnh ngày T+d** (L208-232). Nó đo "bản đồ hôm nay khớp bản đồ ngày d bao nhiêu", tức độ bền của chính trường vật lý do mô hình tạo ra, không bao giờ bằng cá; file tự ghi caveat (L567 và `fish-blend-weights.json.caveat`). Hệ quả: w cao do SST/chl bền hơn cá. Nhãn thật làm được.

**Thiết kế đo bằng nhãn eCDT×VMS:**
1. Với gốc T (mọi ngày có lưới), loài s, tầm d ∈ {1,2,3,5,8,11,16}: `persist_T` (điểm từ ảnh T, tháng đích = month(T+d), liên tục, từ cache), `clim_{T+d}` = bản mùa vụ/sản lượng **giữ-tháng-ra** (không dùng `fish-climatology.v1.json` do mô hình tự sinh nếu mục tiêu là cá; dùng `catch-ex-<tháng>` × mùa vụ).
2. `S_w = w·persist + (1−w)·clim`, w ∈ {0…1 bước 0,1}; chấm **AUCeff của S_w với nhãn ngày T+d** (đúng hàm `weightedAuc` sẵn). Chọn w*(d, nhóm) = argmax, ép không tăng theo d.
3. CI: block-bootstrap theo gốc T khối 7 ngày, 500 lần. Cần so w=0 (chỉ clim) và w=1 (chỉ persist).
4. Chi phí: 34 loài × ~300 gốc × 7 tầm × 11 w ≈ 8×10⁵ bản đồ × ô trong mùa ⇒ ~10⁹ phép nhân, ~vài phút với cache. Dùng lại đúng khung của `dl-eval.mjs` "ghép nhãn ngày i với lưới ngày j" (`aucFor(s, prep, pairing)`, L196) — chỉ đổi pairing thành `i ↔ i−d`.
5. Lưu ý: Mac chỉ có lưới cách ngày ⇒ d lẻ không đo được; PC (61 ngày) hoặc backfill đủ ngày mới đo d=1,3,5.
6. **Rủi ro kết quả**: nếu Δdyn ở d=0 đã ≈ 0 (§9) thì w*(d) từ cá thật sẽ = 0 ở hầu hết loài-nhóm (vệ tinh không hơn bản mùa vụ). Đó là kết quả trung thực; quyết sản phẩm: giữ w proxy làm CHẶN TRÊN, chỉ hạ khi CI nói rõ; UI không được nói "vì sao có cá" mạnh hơn bằng chứng.

---

## 5. Tham số CHƯA TỪNG đo bằng cá thật — xếp theo độ nhạy (ước, chưa đo)

Cách đo độ nhạy trong 1 giờ khi có cache: chấn ±25 % từng hằng, ghi ΔAUCeff, Δ%diện tích ≥50, Δ số ô loài đang vụ ≥50 (bảng "tornado").

| # | Tham số | Nơi | Nguồn gốc | Nhạy (ước) |
|---|---|---|---|---|
| 1 | `w{thermFront…thermo}` 38 loài (228 số) + `wMax` | hồ sơ L389-433; `SPECIES_WMAX` L728 | tài liệu/phán đoán | **cao** — quyết cơ chế nào kéo điểm; softOR chia cho wMax nên đổi 1 số đổi cả hệ |
| 2 | `SURFACE_CONF` (1/0,6/0,25) + `NEUTRAL_AGG` 0,6 | L62-66, L126 | phán đoán | **cao** cho loài medium/low (đa số loài nhỏ, đáy): `aggSat = conf·agg + (1−conf)·0,6` cộng ~0,24 phẳng ở medium, làm phẳng tương phản |
| 3 | `SOFTOR_SCALE` 0,4 / 0,6 (cá nổi lớn) | L88, L96 | chọn theo %diện tích điểm nóng + phản hồi thực địa, không theo AUC | trung–cao (đặt mức tuyệt đối so ngưỡng 50/75) |
| 4 | `SEASON_OFF_FLOOR` 0,6 + dốc `seasonPrior` | `fish-seasons.ts:627` | chủ dự án 10/10 | trung–cao; nhãn tháng×loài×vùng cho đo trực tiếp (nhật ký đã có) |
| 5 | Chuẩn hoá: `THERM_FRONT_FULL_PER_DEG` 2,0, `CHL_FRONT_FULL_PER_DEG` 1,0, `EDDY_FULL_PER_DEG` 0,16, `CONV_FULL_PER_DEG` 0,8, `FRONT_FINE_FULL_SCALE` 1,3, `UPW_SCALE` 0,55, `COLD_SCALE` 0,09, `SPATIAL_RADIUS_DEG` 2,5 | L878-957, 134-148 | p90 phân bố (không phải cá) | trung (đổi tỉ trọng tương đối giữa các cơ chế trong softOR) |
| 6 | Mốc hiển thị `KEEP_MIN` 25, `FISH_LEVEL_BANDS` 50/75 | L130 | trình bày | không đổi xếp hạng, nhưng **quyết điều bà con đọc**: chưa ai kiểm "Cao" có CPUE cao hơn "Trung bình" thật không (xem dưới) |
| 7 | `FOOD_FLOOR` 0,45, độ dốc `chlFit` ±0,45 | L128, L537-543 | phán đoán (foodDependence mới fit) | thấp–trung |
| 8 | `REEF_HABITAT_FLOOR` 0,7, `REEF_ABSENT_FIT` 0,5, `DEPTH_UNKNOWN_FIT` 0,5 | L185-213 | phán đoán | thấp (loài rạn/đáy, một phần mất nguồn) |
| 9 | `CATCH_FULL_KG`, `FLEET_FULL_HOURS` | mục 3 | dò 3–5 giá trị trên 2 tháng | thấp (±0,001–0,02 AUC) |

**Thứ tự fit đề xuất:** (1) hằng #5+#2 chung toàn cục (ít số, nhạy cao); (2) `w{}` theo NHÓM category rồi mới theo loài với prior = giá trị hiện tại; (3) `SEASON` từ nhãn; (4) #3. Cuối: **hiệu chuẩn thang điểm** bằng bảng độ tin cậy: CPUE (kg/giờ nhóm nghề) trung bình theo ngăn điểm 0–24/25–49/50–74/≥75 trên dữ liệu giữ-ra; nếu "Cao" không cao hơn "Trung bình" có ý nghĩa thì UI đang nói dối — đây là phép đo ưu tiên cao hơn mọi tối ưu AUC vì AUC chỉ đo thứ hạng.

---

## 6. Chi phí tính toán thực tế

- Đo thật (Mac, Node 24, 1 ngày 69×65): all-species **110 ms**, 1 loài **80 ms**; `coastDistanceKm` 8 ms (chạy lại mỗi lần gọi, L1295), `spatialAnomaly(anom)` **67 ms** (bán kính 2,5° trên lưới anom — hàm trung vị lân cận; sla chỉ 3 ms), `frontStrength` 0,1, `fineFrontOnto` 0,7 + 1,2 ms.
- Một lượt "dựng + chấm" 61 ngày, 1 loài: 61 × 80 = **4,9 s** (Mac) + tạo Map/AUC; PC thực tế ~17 s. Cả 38 loài cùng lúc: 61 × 110 = 6,7 s. 300 ngày: 24 s / 33 s.
- Tốn nhất: (1) `spatialAnomaly(anom)` ~84 %, bất biến theo tham số; (2) vòng ô × `FISH_SEASONS.find` + `SPECIES_PROFILES.find` mỗi ô × loài (tìm tuyến tính L1514-1556, L1558); (3) `new Map(fc.cells.map(...))` mỗi lượt, mảng pos/neg dựng lại mỗi lượt (`dl-fit-profiles.mjs:131-139`).
- Server: 110 ms CPU/lần tính trên khoảng 3 200 ô; chặn là mạng (ERDDAP 20 s/nguồn, HYCOM/Copernicus 12 s, `maxDuration` 60 s route, 90 s cron) — **không có ràng buộc CPU cho tầng thống kê nhẹ**; chạy 2–3 lần nhanh hơn cũng không đổi gì ở production. Nên tối ưu offline, không vì Vercel.
- Cache giảm chi phí: (a) memo `spatialAnomaly`/`coastDistanceKm`/front theo tham chiếu lưới (WeakMap, 3 dòng) ⇒ ~6×; (b) cache đặc trưng ô-ngày (mục 1) ⇒ ~100–170×; (c) nhãn gộp sẵn theo (ngày, loài) thành Float32Array chỉ số ô (hiện `prep` Map chuỗi khoá "lat,lon", L98-124, tốn băm chuỗi mỗi lượt); (d) bảng `seasonW` theo (vùng,tháng) tính 1 lần.

---

## 7. Phương pháp train v2 (1 trang)

**Dạng mô hình — GIỮ:** HSI tri thức `tFit·foodLimiter·habitat·depthFit·sW`, soft-OR cơ chế, hai kênh tĩnh noisy-OR, mọi cổng cứng và test bất biến. **Không** thay bằng hộp đen.

**Học gì:**
- Tầng A (toàn cục, ~15 số): `δchl`, các hằng chuẩn hoá front/xoáy/upw, `SURFACE_CONF`, `NEUTRAL_AGG`.
- Tầng B (theo nhóm 4 category → theo loài, co về nhóm): dải nhiệt (hộp quanh prior), dải mồi, `foodDependence`, ngưỡng độ sâu/cách bờ, `w{}` (6 số) bước 2.
- Tầng C (4 nhóm): `CATCH_SCALE`, `K_s` theo loài tính từ dữ liệu.
- Tầng D (tuỳ, chỉ nếu thí nghiệm mục 2 thắng): residual logistic ≤ 13 số/loài, khoá dấu.
- Hiệu chuẩn: bảng CPUE theo bậc điểm; chỉ để kiểm "không nói dối", không đổi điểm.

**Mục tiêu:** `AUCeff` giữ-ra (kg dương vs giờ đánh nhóm nghề) **cộng** ràng buộc cứng: Δdyn không tụt, %diện tích ≥50 không tăng quá 2 điểm, số ô loài đang vụ ≥50 không giảm; phạt prior `Σ((θ−θ0)/σ)²`.

**Cách fit:** cache đặc trưng ô-ngày 300 ngày (backfill ERDDAP 01–07/2026 bằng `fish-validate-run.mjs --features full`); điểm liên tục; Nelder–Mead/tọa độ liên tục; hai kênh tĩnh BẬT giữ-tháng-ra; leave-one-month-out nhiều nếp (≥5) thay 2 nếp; nhận nếu CI bootstrap khối 7 ngày > 0 và vượt kiểm nhận-oan trên nhãn xáo.

**Chi phí:** dựng cache 1 lần ~10–15 phút + tải lưới ~1 260 request; mỗi lượt 0,3–0,5 s/300 ngày; cả 38 loài × 6 nếp ≈ 1–1,5 giờ song song 8 worker (so ~11 giờ cho 38 loài × 61 ngày hiện nay, và chỉ 6 nút). Chạy trên Mac hoặc PC GPU được, KHÔNG cần GPU/thư viện ML. Nếu thí nghiệm mục 2 buộc phải có tối ưu hoá lồi lớn hơn, vẫn thuần JS (IRLS 12×12); không có lý do kỹ thuật cho Python/XGBoost ở quy mô này.

**Đổi / giữ so với nay:**
- ĐỔI: điểm liên tục khi fit; fit chung có prior; đo kênh tĩnh BẬT; K_s theo loài; w(d) bằng cá; thêm kiểm nhận-oan và bảng CPUE.
- GIỮ: dạng HSI, luật nghiệp vụ trần nhiệt (nhưng thành ràng buộc hộp), `scripts/build-model-params.mjs`, cổng `model-params.test.ts`, phát qua `model-params.v1.json` (SDF2).
- Lưu ý khớp bất biến: tham số hồ sơ hiện sống trong **code** (`SPECIES_PROFILES`), không trong `model-params.v1.json` (mới chứa blend + skill, `build-model-params.mjs:25-41`). Tham số học v2 nên chuyển sang JSON (có phiên bản + nguồn + ngày fit + CI) để fit lại KHÔNG sửa `fish-predict.ts` 2 067 dòng và để cổng test bắt lệch.

**3 bước đầu làm trong 1 tuần:**
1. *(Ngày 1)* Memo `spatialAnomaly(anom)`/`coastDistanceKm` theo tham chiếu lưới; thêm `fleet`/`catchGrid` (giữ-tháng-ra) vào `evaluate`; cờ điểm liên tục. Đo lại 3 loài đã fit (ngừ vằn, cá nục, bạc má): so gain cũ với gain khi kênh tĩnh bật, và chạy kiểm nhận-oan (nhãn dịch ngày). Quyết định: bao nhiêu trong 15 loài "đã áp" sống sót.
2. *(Ngày 2–4)* Tách `buildCellFeatures`/`scoreCell` (có test snapshot "kết quả y hệt bản cũ" trên 3 ngày lưới), dựng cache 61 ngày (PC) rồi backfill đến 300 ngày; bảng tornado mục 5; bảng độ tin cậy CPUE theo bậc điểm (trả lời "Cao có thật sự cao?").
3. *(Ngày 5)* Thí nghiệm mục 2 (ngừ vằn + cá nục, ba nhánh A/B/C) và đo w(d) bằng cá (mục 4) trên cache. Viết 1 trang kết luận kèm số, rồi mới quyết dựng tầng D.

**Cảnh báo kiểm soát sai lệch train–serve:** lưới 8–9 trong `fc-full` dựng lại thiếu HYCOM/Copernicus (caveat L199) và có thể là bản reprocessed; production dùng NRT + HYCOM. Loài `tempSource` bottom/deep (cá đáy, ngừ mắt to) CHƯA fit đúng được cho tới khi `forecast-archive` (từ 10/10) tích đủ ngày; fit chúng khi đó, không fit trên dữ liệu thiếu rồi áp.
