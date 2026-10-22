# 05 — Khoa học dữ liệu: kiểm kê, bộ đo, đề xuất phương pháp dự báo cá mới (cổng → phù du → cá)

Người viết: vai Nhà khoa học dữ liệu, team nghiên cứu ForFish, 2026-10-22. **Chỉ đọc repo** (nhánh `feat/toi-uu-codex`), không chạy fit, không mạng.
Quy ước: **[đo]** = số đã đo, ghi trong doc/code có dẫn nguồn; **[đọc]** = đọc thẳng từ code/file; **[ước]** = ước của tôi, chưa đo.

---

## A. Dữ liệu đang có

### A1. Nhãn DataLake (eCDT × VMS)

**Nhãn là gì** [đọc]
- Đơn vị: ô **0,05° × ngày (giờ VN)**. Hằng `CELL = 0.05`, `GAP_H = 4`, `PORT_KM = 5` (`scripts/dl-build-labels.mjs:40-42`).
- Ba tệp ra (`dl-build-labels.mjs:17-22`):
  - `effort.csv`: date, lat, lon, hours, geartype.
  - `catch.csv`: date, lat, lon, species (mã ASFIS), gear, kg.
  - `catch-vessels-025.csv`: số tàu theo tháng × ô 0,25° × loài. Đây là cổng riêng tư, chỉ giữ ô có ≥3 tàu.
- Cách xác định "giờ đánh": đoạn VMS có tốc độ nằm trong dải của nghề. Dải tốc độ chọn bằng Spearman giữa số đợt đánh tìm được và `haulCount` tàu khai (`:6-11`). Bản v2 dùng **một bảng dải cố định cả năm** (`scripts/fishing-bands.v2.json`, `scripts/fishing-def.mjs`), chỉ cho `vmin = 0` với tàu vây ban đêm, và loại mọi giờ trong vòng 10 km quanh bất kỳ cảng nào (README fish-train-review §7.6).
- **Kg chia đều theo giờ đánh trong chuyến**: `kg = x.kg * scale * r.w * s.dtH / H` (`dl-build-labels.mjs:336`; README cũ ghi `:275`, mã đã dời dòng). Code ghi rõ "mẻ có toạ độ … chưa có trường đó" (`:14-15`). Hệ quả: mọi ô trong cùng một chuyến có cùng kg/giờ.

**Khoảng thời gian và quy mô** [đo, theo doc]
- **Bộ kiểm định** `dl-trk0809`: 61 ngày, 01/08–30/09/2026, 107.109 nhật ký × track VMS của 27.578 tàu (`ops/fish-validate-positions.md` §9). Lượt chấm 31 ngày có 36.569 chuyến và 2,28 triệu giờ đánh.
- **Bộ cả năm** `dl-all`: chia 5 khúc, 01/01–11/10/2026, 155 nghìn chuyến (§11).
  - Lưới đội tàu dựng từ snapshot 2026-10-11: **76.723 tàu, 328.072 nhật ký**, phủ 11 tháng từ 2025-12 đến 2026-10 (`src/data/fleet-effort-025.v1.json` → `builtFrom`).
  - Lưới sản lượng: 10 tháng 2026-01→10. Bản v2 có 33 loài, v1 có 34 loài. Bản v1 gồm 80,4 nghìn ô và 274 nghìn tấn (§11).
- **Độ phủ** (report-data-labels Q3):
  - Theo số nhật ký: 43 % dùng được. Theo kg: ~77 %.
  - Tàu ≥15 m có VMS 97,7 %. Tàu <15 m gần như không có VMS: chiếm 49,6 % số nhật ký nhưng chỉ 9,3 % kg.
  - **Nhãn chỉ nói về tàu ≥15 m.**
- Loài đủ mẫu (Kish n_eff ≥ 200): 26/34 loài trên nhãn cũ, 21/34 trên nhãn v2 (README §6.0, §7.4b).

**Lỗi nhãn đã biết** [đo]

| # | Lỗi | Trạng thái |
|---|---|---|
| N1 | Kg chia đều theo giờ trong chuyến ⇒ nhãn không phân giải được ô nào giàu cá hơn ô nào trong cùng chuyến | **Chưa sửa được.** Chỉ toạ độ mẻ (Q1) mới sửa được |
| — | `vmin = 0`: 74 % giờ "đánh" của nghề rê có tốc độ <0,3 kn | v2 đã sửa: giờ rê nằm trong 6 km quanh cảng còn 0 % |
| — | Dải tốc độ nhảy theo cửa sổ (giờ đánh/chuyến dao động 46→122) | v2: chênh 16 % sau khi chuẩn hoá. Số thô chưa đạt |
| — | Nghề "?" chiếm 44 % kg | v2 còn 2,3–3,7 % (suy nghề bằng Naive Bayes). **Nhưng** ρ(số đợt, haulCount) của tàu suy nghề = −0,33 ⇒ vị trí giờ đánh của tàu lớn **chưa kiểm chứng được** |
| — | Tàu thu mua (13–19 % kg) và cặp kéo đôi (79 % chuyến có một tàu khai 0) | v2 đã tách |
| — | Khai sai có chủ đích | v2 có điểm tin cậy theo chuyến (6 tín hiệu). Nhãn sẽ nghiêng về tàu khai thật |
| — | VMS thiếu ~8,6 nghìn tàu từ 15/09; snapshot dừng ở 11/10; đường hầm API đã chết (`dl-collect.mjs:2`) | **Đầu vào đang đứng.** Nguồn thật bây giờ là snapshot local qua `dl-adapt-local.mjs:1-20` |

**Nơi lưu** [đọc]. Không gì trong số này vào git:
- PC GPU: `$SDFISH_DATA_DIR` = `/mnt/c/Users/admin/sdfish-data`, tức ổ C, đã đầy 79 %.
  - Nhãn: `dl-all/labels-v2-*`, `dl-trk0809/labels-v2`.
  - Lưới giữ-tháng-ra: `fleet-v2/`, `catch-v2/`.
  - Lưới vệ tinh và cache đặc trưng: `fc-full/`.
- Nguồn thô: repo AI-Assistant `sdvico-data/data-local/datalake-iuu` (gitignored); snapshot 5,1 GB.
- Bản sao lưu: `/mnt/e/sdfish-backup/2026-10-19/`, 16 GB (README §7.10).
- Trong git chỉ có tham số và lưới tổng hợp: `src/data/{fleet-effort,species-catch}-025.v1.json`, `fish-base.v1.json`.

### A2. Đặc trưng vệ tinh hằng ngày

| Kho | Nội dung | Từ khi nào / bao nhiêu ngày | Dẫn chứng |
|---|---|---|---|
| Production lấy trực tiếp mỗi lần chạy | SST blended (lưới 0,05°, stride 5 ⇒ 0,25°), chl VIIRS DINEOF, SSHA, dị thường SST CRW, dòng chảy NRT, HYCOM (D20, nhiệt đáy, nhiệt 250 m), Copernicus u/v, front mịn | Chỉ ngày hiện tại; **khung 5–22°N, 102–118°E** | `fish-predict.ts:2130-2213`, `fish-forecast-run.ts:319-357` |
| `forecast-archive/fish-inputs/` (bucket Supabase riêng tư) | Mọi lưới đầu vào ở trên, gzip JSON | Có từ 10/10, nhưng **chỉ có 1 ngày** vì cron refresh-fish chết từ 11/10. Đã thêm vào `cron-prod.yml`, chưa có số đo mới [đo 19/10] | `forecast-archive.ts:1-14`; `refresh-fish/route.ts:36-46`; 04 §0058 dòng 39 |
| `forecast-archive/weather/`, `fish/` | Mọi hàng snapshot thời tiết và bản đồ cá | Từ 10/10 | 04 §0058 |
| `forecast-archive/actual/` | ERA5 thực tế của 10 cảng (gió, giật, mưa, sóng) | Từ 19/10, ~2 KB/ngày | `sea-actual.ts:1-12` |
| Bảng `sea_daily` | Dự báo 10 cảng × 10 ngày, có `lead_days` | Từ 07/07/2026 | `collect/sea-daily/route.ts:1-7`, `sea-actual.ts:2-3` |
| Bảng `fish_forecast_daily` | Chỉ ô có điểm ≥60 | Từ 07/2026 | như trên |
| PC GPU `fc-full/grids` (backfill ERDDAP, bản reprocessed) | SST, chl, SSHA, dị thường, front mịn | **289/290 ngày, 01/01–17/10/2026**. Không có dòng chảy, D20, nhiệt đáy | README §7.5; `fish-features-cache.mjs:9-13` |
| PC GPU `fc-full/features` | Cache Float32 với 20 đặc trưng/ô (`FEATURE_FIELDS`) | 289 ngày, 56 MB | `fish-features-cache.mjs:25-28` |
| `.cache/fish-corpus` | Bản đồ cá tính lại theo ngày, 2022–2025, mốc tháng 1/4/7/10 | Không có trên Mac này | `fish-corpus-build.mjs:23-24` |

Kết luận A2:
- Chuỗi đặc trưng vệ tinh dùng được cho fit là **~10 tháng của 2026, chỉ gồm các trường mặt biển**.
- Dòng chảy và D20 lịch sử **không có**.
- Chuỗi đầu vào đúng bản production gần như trống.
- Khung lưới không chứa eo Luzon (~120–122°E) hay Karimata (~1–3°S).

### A3. Dữ liệu khí hậu và tĩnh

| Tệp | Là gì | Dẫn chứng |
|---|---|---|
| `sst-climatology.v1.json` (11 KB) | Phân vị SST theo 7 vùng × 12 tháng. Nguồn `noaacrwsstDaily`, năm 2021–2025, bước 10 ngày. Dùng cho dải nhiệt lai | khoá `years`, `source` |
| `reef-grid-025.v1.json` (14 KB) | Có rạn hay không theo ô 0,25°: 554/5.120 ô có rạn (Allen Coral Atlas + OSM) | `stats` |
| `fleet-effort-025.v1.json` (598 KB) | Giờ đánh VMS theo tháng × nghề (6 nghề) × ô 0,25°, chỉ ô ≥3 tàu, nhãn v2 | `rule`, `builtFrom` |
| `species-catch-025.v1.json` (892 KB) | Kg theo tháng × loài (33 loài) × ô 0,25°, ≥3 tàu, loài ≥20 tấn | `rule` |
| `fish-base.v1.json` (13 KB) | Nền "bãi theo mùa": K_s 32 loài, hệ số logistic 4 nhóm × 5, bảng log-lift tĩnh 34 loài, `hotShare` 0,157, `catchSameMonth` (tháng 11–12 = false). Fit trên 08–09/2026 | `builtFrom.fitMonths` |
| `fish-blend-weights.json` | w(d) cho tầm 1–16 ngày. **"Sự thật" ở đây là bản đồ cá của chính mô hình, không phải sản lượng** | khoá `caveat` |

---

## B. Mô hình và bộ đo hiện tại

### B1. Công thức

**HSI (`fish-predict.ts`)** [đọc]
- Điểm loài tại ô (`scoreCell`, `:1673-1736`):
  `fitSat = cổngNhiệt(trapezoid, dải lai theo khí hậu vùng–tháng) × mồi(chlFit → foodGate mềm) × habitat × cổngĐộSâu × mùaVụ`.
- `habitat = AGG_FLOOR + (1−AGG_FLOOR)·aggEff` (`cellHabitat`, `:1575-1636`).
  - `aggEff` là soft-OR của các cơ chế: front nhiệt, front mồi, xoáy, nước trồi, hội tụ dòng, tầng nhiệt.
  - Kéo về trung tính theo `SURFACE_CONF` của loài.
  - Kênh đội tàu gộp vào bằng soft-OR: `FLEET_SCALE` 0,5 (`:105`).
- Kênh sản lượng gộp sau cùng: `1−(1−fitSat)(1−0,7·cx)` (`CATCH_SCALE`, `:118`).

**Nền 2A (`fish-base.ts`), đang chạy production từ `FISH_ALGO_REV = 2`** (`fish-predict.ts:2071`)
- Bốn đặc trưng:
  - xc = 1−e^(−kg30/K_s)
  - xf = giờ30/60
  - stat = log-lift theo độ sâu + cách bờ + vĩ độ
  - season = prior mùa vụ
- Logistic IRLS với ≤5 hệ số cho mỗi nhóm loài (`baseRaw`, `:189-193`; `irlsLogistic`, `:131`). Đổi sang điểm bằng xếp hạng và `hotShare` (`scoreBase`, `:224`).
- HSI tách ra thành `hint` ("dấu hiệu hôm nay") và **không nâng điểm**.
- Cổng lịch mùa vụ theo vùng **tắt** (`BASE_SEASON_LIST_GATE = false`, `:1953`) vì bật nó làm tụt −0,033.

**Blend (`fish-blend.ts`)**: `w(d)·ảnh + (1−w(d))·khí hậu`; tắt khi có `baseMode` (`:9-12`). Trần đo được +1,4 điểm % top-100, "sự thật" là bản đồ của chính mô hình (09 §5h).

### B2. Bộ đo trung thực 2026-10-18 [đo, README §6–§7.9]

**Kết quả chính**
- 0,736 chỉ là **bản đồ bãi theo mùa**. Các baseline đơn giản thắng nó:
  - Baseline tĩnh 0,809.
  - M−1 (kg/giờ tháng trước) 0,813.
  - Bản chốt 0,736, tính trong nghề còn 0,726.
- Thay ảnh ngày bằng trung bình tháng: 0,739 so với 0,736, Δ trong-nghề +0,001 [−0,002…+0,004]. Tức **ảnh của ngày ≈ 0**.

**Các phép thử thêm vệ tinh lên nền**
- 2B: 0/10 loài qua đối chứng động, cả trên 61 ngày lẫn 10 tháng. AUC cục bộ 1° chỉ 0,51–0,60. |ρ| dị thường ≤ 0,043.
- 2D: **0/30 tổ hợp thắng** khi thêm lớp vệ tinh lên nền. HSI gộp kiểu noisy-OR còn **làm hại** nền: Δ −0,002…−0,076, và ô ≥50 phình từ 11 % lên 38 %.
- Bộ đo không mù: đối chứng dương (oracle) cho Δ +0,050, Δ động +0,136.

**Production hiện tại**
- Nền trên nhãn v2: 0,810 trong-nghề. Production mới 0,802 (B = 20, cần chạy lại B = 500).
- Ngang baseline tĩnh v2 (0,806, Δ −0,004 CI chạm 0). Hơn M−1 +0,009.
- Nói cách khác: **"tĩnh được hiệu chỉnh", chưa phải dự báo**.

### B3. Cổng bắt buộc cho MỌI phương pháp mới (đã có code)

1. **AUCeff TRONG-NGHỀ**: Σ_g w_g·AUC(pos_{s,g}, neg_g).
   - Báo cả TB theo kg và macro trên loài có n_eff ≥ 200.
   - Code: `dl-eval.mjs` `weightedAuc :54`, `recMetrics :130`, `kishNeff :145`.
2. **Bootstrap khối 7 ngày** với B = 500, CI 90 % (`blockResamples :171`, `ci90 :165`). Δ phải tính cặp trên cùng mẫu khối.
3. **Sơ đồ gập**:
   - Giữ-tháng-ra cho mọi lưới x.
   - 5 nếp 2 tháng, đệm 15 ngày.
   - **F3 chuỗi tiến thuần**: lưới `fwd-<M>`, train chỉ dùng ngày ≤ đầu tháng M−15.
4. **Luật nhận = đối chứng ĐỘNG**: Δ trên nhãn thật trừ Δ trên nhãn lệch ±15 ngày, CI dưới > 0, rồi Benjamini–Hochberg q = 0,1 (`dl-fit-profiles.mjs:35,71,462`).
5. **AUC cục bộ 1°×1°** và **Spearman dị thường ngày × ô** (`fish-metrics-local.mjs:124,162,189`).
6. **CPUE theo bậc 0–24/25–49/50–74/≥75**: phải đơn điệu, bậc ≥75 ≥ 2× bậc 50–74. Thêm % ô ≥50 ≤ nền + 2 điểm.
7. **Kiểm rò**:
   - Tàu lạ/quen chênh ≤ 0,01.
   - Cách ≥ 2 tháng.
   - Triệt tiêu năng suất tàu (`--null-prod`).
   - Đối chứng dương `--oracle` phải THẮNG (`fish-2d-experiment.mjs:411`).
8. **Đích để so**: nền 2A, tĩnh v2 và M−1 v2 trên **cùng `evaluate`**. Không so với HEAD 0,62.

---

## C. Đề xuất khoa học dữ liệu cho phương pháp mới

Ràng buộc gốc: **mọi tín hiệu "động" đều chết ở bức tường N1**. Vì vậy C1 (nhãn) đứng trước C2–C3 (đặc trưng và mô hình). Không có nhãn phân giải được, lead time dài hơn chỉ là dự báo dài hơn một thứ không đo được.

### C1. Nhãn v3: đo được "ô/chuyến nào hôm nay khá hơn mức thường"

**Nguyên tắc**: đơn vị quan sát phải trùng với đơn vị thông tin thật có. Không có toạ độ mẻ thì đơn vị thật là **CHUYẾN** (kg tổng × dấu vết giờ đánh VMS), không phải ô-ngày. Tôi đề xuất ba tầng nhãn, dùng song song.

**(a) Nhãn chuyến, khử hiệu ứng (làm ngay, không cần dữ liệu mới)**

Mô hình hỗn hợp trên từng chuyến i, tàu v, nghề g, lớp dài ℓ, tháng m, vùng r:

```
log(kg_i / H_i) = α_v(ngẫu nhiên) + β_{g×ℓ} + γ_{m×r(0,5°, trọng tâm dấu vết)} + δ·log H_i + ε_i
```

- **ε_i là mục tiêu dự báo**, tức "chuyến này khá hơn mức thường của chính tàu này, đúng mùa này, ở vùng này".
- Ước bằng REML (thuần JS là được; số cột ~ nghìn).
- Hoặc dùng Huber/Student-t để chống khai thổi. Không cần trust weight tay vì 2C đã nhân sẵn vào kg.
- Đặc trưng đầu vào cho chuyến i là **trung bình theo giờ đánh trên dấu vết** của từng đặc trưng ô-ngày. Nhờ đó kg không bao giờ bị chia đều, mà đặc trưng được gộp theo đúng cách nhãn sinh ra.
- Loài: dùng hurdle. P(loài có trong chuyến) × E[log kg | có].
- Yêu cầu dữ liệu:
  - Mã băm tàu ổn định theo từng tàu. Hiện `vh` chỉ là 10 xô (`vessel-bucket.mjs`); `trust-trips.csv` mới có băm chuyến.
  - Giờ đánh và trọng tâm dấu vết theo chuyến.
  - Nghề (đã có cả nghề suy, `gs`).
- Cỡ mẫu [ước]: ~36 nghìn chuyến/tháng-cặp × 10 tháng ⇒ ~150 nghìn chuyến. Đủ cho 4 nhóm loài × ≤20 hệ số.

**(b) Nhãn "gần ô-ngày" bằng chuyến gọn**

- Lấy tập con các chuyến có dấu vết giờ đánh gọn: tổng giờ đánh ≤ 3 ngày **và** bán kính hồi chuyển ≤ 0,25°. Tàu 15–24 m đi ngắn hay rơi vào nhóm này.
- Với các chuyến này, ε_i xấp xỉ "ô-ngày đó khá hơn thường". Trọng số tỉ lệ nghịch với độ trải.
- Phải đo % chuyến và % kg rơi vào tập này trước. Nếu <10 % kg thì chỉ dùng để kiểm, không dùng để fit [ước].

**(c) Nghịch đảo chồng lấn (tomography)**

- Nhiều chuyến cắt qua cùng ô-tuần với tổ hợp khác nhau, nên có thể giải trường mật độ d(c,w) trên ô 0,25° × tuần:

```
E[kg_i] = q_v · Σ_{s∈i} h_s · d(c_s, w_s)
```

- Dạng Poisson/Tweedie GLM, có phạt Laplacian không gian–thời gian và q_v ngẫu nhiên.
- Đây là cách duy nhất rút được tương phản **trong** chuyến khi không có toạ độ mẻ.
- Kiểm bằng giữ-chuyến-ra: dự đoán kg của chuyến chưa thấy phải tốt hơn mô hình chỉ có γ_{m×r}.
- Rủi ro: nhận diện yếu khi tàu cùng nghề luôn đi theo đàn. Phải báo số chuyến hiệu dụng mỗi ô-tuần, và chỉ dùng ô có ≥5 chuyến độc lập [ước].

**(d) Thước vàng**
- Q1 toạ độ mẻ: ~4 % chuyến ≈ 9.700 chuyến (report-data-labels).
- Không dùng để fit. Chỉ dùng để **hiệu chỉnh** (a)–(c): giờ đánh suy luận có nằm trong 5 km quanh mẻ thật không, và ε từ (b)/(c) có tương quan với CPUE mẻ không.

**Nhãn phụ không dùng làm sự thật**: dị thường mật độ đội tàu theo ngày so với trung bình tháng (ngư dân "biết" chỗ có cá). Chỉ dùng làm biến phụ trợ hoặc đối chứng, vì đây là dự báo **hành vi**, và nó vòng lặp với kênh xf.

### C2. Kiến trúc đặc trưng theo độ trễ (cổng → phù du → cá)

**Chuỗi nhân quả và độ trễ cần thử** [giả thuyết sinh học; lag phải học từ dữ liệu, không đặt tay]

| Khâu | Tín hiệu | Độ trễ thử |
|---|---|---|
| Cổng vào Biển Đông | Vận chuyển qua eo Luzon (chênh SSHA hai bờ eo, vận tốc địa chuyển), chỉ số xâm nhập Kuroshio; Đài Loan; Mindoro/Balabac; Karimata (chênh SSHA, gió mùa) | t−0…−90 ngày |
| Ép buộc khí hậu | ENSO (Niño3.4/ONI), IOD (DMI), chỉ số gió mùa Biển Đông, PDO; theo tháng | t−1…−6 tháng |
| Vật lý thềm VN | Chỉ số nước trồi Nam Trung Bộ (Ekman từ gió JJA), lưu lượng/chùm Mekong, tầng nhiệt (D20) | t−0…−30 ngày |
| Phù du | **chl tích luỹ** Σ_{k=1..K} chl(t−k) với K ∈ {15, 30, 60, 90}, dị thường so khí hậu nhiều năm | t−15…−90 ngày (phù du → động vật phù du → cá nổi nhỏ) |
| Cá | ε_i (C1) theo nhóm loài | đích |

**Cách tìm độ trễ**
1. **Khử mùa bằng khí hậu NHIỀU NĂM**: trừ trung bình theo ngày-trong-năm (làm trơn) và xu hướng. Dùng hindcast ≥20 năm, không dùng chính chuỗi 2026.
   - Lưu ý: 2D đã lấy trung bình tháng trên toàn chuỗi cache, gồm cả ngày thử, ghi ở giới hạn (e). Đó là rò.
2. **Làm trắng trước (prewhitening)** bằng AR(p) fit trên đầu vào, áp cùng bộ lọc lên đích, rồi mới tính cross-correlation. Không làm bước này thì tự tương quan (SST và chl có nhớ hàng tuần) sinh tương quan giả ở mọi lag.
   - Bậc tự do hiệu dụng: dùng Bretherton (n_eff = n·(1−r₁r₂)/(1+r₁r₂)).
3. **Mô hình trễ phân bố (DLNM)** với cơ sở spline trên lag, phạt độ trơn. Không chọn lag đơn có ρ cao nhất, vì chọn đỉnh trong 90 lag là hái quả.
4. **Hai tầng** (xem C6): học lag cổng → đại dương thềm VN trên hindcast 20–30 năm, nơi n lớn. Lag đại dương → cá chỉ học ở khâu cuối, với ≤ vài tham số.

**Chống rò thời gian (bắt buộc)**
- **Purged + embargoed CV theo khối thời gian**: bỏ khỏi train mọi ngày có cửa sổ đặc trưng (tới t−90) chồng lên khoảng thử, rồi đệm thêm ≥ max(lag dài nhất, độ dài tự tương quan nhãn ~15 ngày).
  - Hệ quả: với K = 90 ngày, đệm 15 ngày hiện tại **không đủ**.
- Mọi thống kê chuẩn hoá (khí hậu, z-score, K_s, bảng tĩnh, chọn lag, chọn λ) phải tính **chỉ trên train**. Dùng CV lồng nhau cho siêu tham số.
- Lưới x (fleet/catch) dùng `fwd-<M>`. Lưới giữ-tháng-ra chứa tháng sau.
- Đặc trưng chỉ được dùng dữ liệu **có sẵn tại thời điểm phát dự báo**. Ví dụ ERA5 trễ 5 ngày (`sea-actual.ts:15`), NRT trễ 1–2 ngày (ngày 17/10 thiếu SST, README §7.5). Mỗi trường phải mang dấu "ngày phát hành", không chỉ "ngày dữ liệu".

### C3. Họ mô hình, theo thứ tự (dừng ở bậc đầu tiên qua cổng)

| Bậc | Mô hình | Vì sao ở đây | Điều kiện để lên bậc sau |
|---|---|---|---|
| (i) | **Nền 2A + M−1 + tĩnh** | Đang đứng đầu (0,802–0,810). Mọi thứ khác cộng lên nó | — |
| (ii) | **Mô hình cộng tính giải thích được trên ε** (C1): GAM/penalized logistic với spline đơn điệu, khoá dấu theo cơ chế (như 2D-b), cộng các thành phần DLNM. ≤ 10–20 bậc tự do mỗi nhóm loài | Mỗi thành phần ↔ một câu "vì sao" (đã có hạ tầng `hint.why`). Hệ số đọc được, kiểm được dấu sinh học | Qua đủ cổng B3 + C4 ở ≥2 nhóm loài |
| (iii) | **Gradient boosting có ràng buộc đơn điệu + ràng buộc tương tác** (cây nông, độ sâu ≤3), giải thích bằng SHAP, chưng cất thành bảng tra hoặc GAM để ship | Bắt được tương tác (nhiệt × chl × lag) mà GAM bỏ sót | Chỉ khi (ii) thắng nhưng phần dư còn cấu trúc. **Mâu thuẫn luật repo §7.3 "không thêm thư viện ML"**: đề xuất chạy offline trên PC GPU (ngoài repo), app chỉ nhận tham số hoặc bảng. **Cần anh Long chốt** |
| (iv) | **Không-thời gian**: ST-GP / INLA-SPDE cho d(c,w), ConvLSTM | Chỉ khi nhãn ≥ 1 năm liên tục (đủ 2 mùa gió) và ≥ 3 năm cho câu hỏi liên năm | ConvLSTM cần nhãn dày hơn nhiều so với hiện có [ước]. Hộp đen trái với yêu cầu giải thích được cho bà con |

**Vì sao ưu tiên giải thích được**: lead đã chốt "không hộp đen, giải thích được cho bà con" (README §0); n hiệu dụng nhỏ (9 khối tuần/61 ngày) nên ít tham số có phương sai thấp hơn (2D: 9 hệ số đã học rất ít); khoá dấu là prior chống học cơ cấu đội tàu; câu "vì sao" trên UI chỉ được nói điều đã chứng minh (2E).

### C4. Giao thức đánh giá (khoá trước khi chạy, như pre-registration)

**Thắng trên nowcast** (cập nhật bộ cổng 2D, áp cho nhãn v3). Phải đạt **TẤT CẢ**:
1. Δ AUCeff trong-nghề so nền 2A ≥ +0,01, CI 90 % (bootstrap khối 7 ngày, B = 500) có cận dưới > 0, trên **F3 chuỗi tiến** **và** trên 5 nếp.
2. Δ động (nhãn thật − nhãn lệch ±15 ngày) có CI loại 0. Thêm BH q = 0,1 trên số loài và nhánh đã thử.
3. AUC cục bộ 1° tăng, CI loại 0. Spearman dị thường > 0 với p < 0,05.
4. CPUE bậc: đơn điệu; bậc ≥75 ÷ bậc 50–74 không tụt so với nền (nền hiện 2,19–2,30). Thêm % ô ≥50 ≤ nền + 2 điểm.
5. **Metric mới cho nhãn chuyến**: ρ Spearman(dự báo trung bình dấu vết, ε_i) trên chuyến giữ-ra > 0 với CI khối loại 0. R² ngoài mẫu của ε > 0 so với mô hình chỉ γ_{m×r}.
6. Đối chứng dương `--oracle` THẮNG; tàu lạ/quen ≤ 0,01.

**Thắng về lead time** (mục tiêu chính của team)
- Với mỗi tầm L ∈ {0, 7, 14, 30, 60} ngày: **đóng băng mọi đặc trưng tại t−L** (dùng dấu "ngày phát hành"), rồi chấm nhãn ngày t.
- **Đối thủ đúng ở tầm dài là nền mùa vụ của tháng đích** (nền 2A biết trước hoàn toàn), không phải "ảnh hôm nay".
- Skill score: SS_L = (AUC_mô hình − AUC_nền)/(1 − AUC_nền), CI khối.
- Tuyên bố "có lead time L" khi SS_L > 0 với CI loại 0 ở **≥ 2 mùa gió** (TB và ĐB) **và** ở cả F3.
- Vẽ đường SS_L theo L. Nếu đường **không giảm đơn điệu** theo L, đó là dấu hiệu rò.
- Cảnh báo: hiện chỉ có 10 tháng, nên L = 60 chỉ còn ~8 tháng thử. CI sẽ rộng; phải báo n_eff khối.

**Không được tuyên bố**: Δ chỉ trên AUCeff cũ (lẫn địa lý nghề); số "cả kỳ" trong mẫu; chọn lag hay công thức tốt nhất mà không hiệu chỉnh đa kiểm định.

### C5. Kế hoạch dữ liệu (bắt đầu ngay để 6–12 tháng sau có chuỗi)

**Việc 0, chặn mọi thứ khác**
- Sửa và kiểm cron refresh-fish. Kho `fish-inputs` mới có 1 ngày (04 dòng 39).
- Q3: đường hầm/snapshot DataLake **hằng tuần**, có người chịu trách nhiệm.
- Q1: toạ độ mẻ. Q2: nhãn 2025.

**Thu hằng ngày mới** [dung lượng ước, gzip JSON]

| Dữ liệu | Khung / độ phân giải | Ước/ngày | Ước/năm |
|---|---|---|---|
| SSHA + vận tốc địa chuyển L4, SST L4, chl L4 gap-free, gió bề mặt | **Mở khung 3°S–25°N, 99–125°E** (chứa Luzon, Karimata, Mindoro), 0,25° ≈ 112×104 ô | ~4 trường × ~100 KB ≈ 0,4 MB | ~150 MB |
| Mặt cắt ngang các cổng (Luzon 120,5–121,5°E; Karimata; Mindoro): u, v, nhiệt theo tầng (Copernicus/HYCOM) | Vài trăm điểm × 10 tầng | ~50 KB | ~20 MB |
| D20, nhiệt đáy, dòng chảy (đã có trong `fish-inputs`, chỉ cần cron chạy) | Khung hiện tại | ~1–3 MB | ~0,5–1 GB |
| Chỉ số khí hậu tháng (ONI, DMI, PDO, gió mùa Biển Đông), lưu lượng Mekong nếu có nguồn mở | Chuỗi | <1 KB | — |
| Snapshot DataLake hằng tuần (nhật ký + VMS) | — | — | ~10–20 GB (đối chiếu: 5,1 GB snapshot + 1,8 GB track cho ~10 tháng) |

**Hindcast một lần (cho C6)**
- GLORYS12 reanalysis 1993→nay. OISST 1982→. Chl CMEMS L4 1997→. ERA5.
- Khung mở rộng, gộp về 0,25°, ngày.
- Dung lượng: ~5 trường × 10⁴ ô × 4 B × 365 × 30 năm ≈ **2–3 GB** [ước]. Nếu giữ 1/12° thì ×9.
- Giấy phép: lớp này phục vụ **dự báo cá (bán)**, nên theo CLAUDE.md phải kiểm điều khoản *thương mại* của từng nguồn. Copernicus Marine và ERA5 cho dùng thương mại có ghi nguồn; vẫn phải xác minh.
- Chủ quyền: loại nguồn bắt ghi "South China Sea" vào sản phẩm.

**Nơi lưu**: **không vào git** (luật "chống phình" §5).
- Bản đầu vào đúng production: bucket `forecast-archive` (đã có).
- Bản nghiên cứu: `$SDFISH_DATA_DIR` trên PC GPU, nên dời sang ổ D hoặc E vì ổ C đã 79 % đầy, và rsync sang E:.
- Mỗi tệp ghim nguồn, ngày phát hành và sha.
- Trong git chỉ có tham số đã fit, vài chục KB, đi qua `model-params.v1.json` (SDF2).

### C6. Rủi ro thống kê và cách vượt

1. **Mẫu ngắn.**
   - Nhãn chỉ có 10 tháng của **một** năm. ENSO có chu kỳ 2–7 năm.
   - Với một năm, mọi "teleconnection liên năm" có n = 1. **Không thể ước, chỉ có thể giả định.**
   - Ngay cả lag theo mùa (gió mùa) cũng chỉ có 1 lần lặp mỗi mùa.
2. **Cách vượt: tách hai tầng, học mỗi tầng ở nơi có dữ liệu.**
   - **Tầng A, vật lý–vật lý trên hindcast 20–30 năm**: trạng thái cổng(t−L) → đại dương thềm VN(t) (SST, chl, SSHA, nước trồi, D20). Có hàng nghìn ngày × 30 năm.
     - Học được lag và độ lợi bằng DLNM hoặc hồi quy tuyến tính phạt (hoặc LIM/phân tích EOF).
     - Kiểm bằng **leave-one-year-out** và chuỗi tiến theo năm.
     - Đầu ra: **dự báo trạng thái đại dương thềm VN ở tầm L**, kèm độ bất định.
   - **Tầng B, đại dương → cá trên nhãn ngắn**: chỉ quan hệ **đồng thời hoặc trễ ngắn** (habitat), ít tham số, khoá dấu, fit trên ε (C1). Đây là thứ 10 tháng nhãn có thể ước.
   - **Ghép**: cá(t | t−L) = TầngB(TầngA(cổng(t−L))). Tính lan truyền bất định bằng Monte Carlo.
   - Lead time đến từ tầng A (có dữ liệu dài). Tầng B không cần chuỗi dài.
   - Trung thực: nếu tầng B tự nó không thắng ở L = 0 (hiện 2B/2D nói là KHÔNG), thì ghép với A cũng không thắng ở L > 0. **C1 vẫn là nút cổ chai.**
3. **Sản lượng thống kê nhiều năm** (sản lượng tỉnh theo năm/tháng, nếu xin được): nhãn yếu để kiểm tầng A ở thang tỉnh × năm, gộp bằng Bayes phân tầng (prior từ hindcast, cập nhật bằng eCDT). Cần anh Long xin nguồn.
4. **Đa kiểm định**: loài × lag × trường × sơ đồ rất lớn ⇒ bắt buộc BH, khai số phép thử, đăng ký trước đường đi chính (bài học 09 §5h: +1,46 sau 7 công thức ⇒ p family-wise 0,088).
5. **Phi dừng, nhiễu hành vi, lệch đại diện**: giá, lệnh cấm, khai sai có chủ đích (§7.2b) ⇒ hiệu ứng ngẫu nhiên tàu, điểm tin cậy, kiểm ổn định hệ số theo nửa năm; nhãn chỉ có tàu ≥15 m ⇒ kết quả cho tàu nhỏ ghi "suy rộng, chưa kiểm".
6. **Kết luận âm cũ** ("năm tương tự", "gió/sóng", 09 §5h) đo bằng **bản đồ của chính mô hình**, không phải cá thật ⇒ không phản bác được teleconnection, nhưng đừng kỳ vọng nhiều.

---

## Tóm tắt điều cần chốt (nghiệp vụ / luật repo)
1. Q1 toạ độ mẻ, Q2 nhãn 2025, Q3 kéo DataLake hằng tuần. Không có Q3 thì C5 vô nghĩa.
2. Cho phép thư viện ML offline ngoài repo (bậc iii) hay giữ thuần JS.
3. Mở khung thu dữ liệu ra ngoài 5–22°N/102–118°E (mới, liên quan offline: chỉ cron server, không thêm request ở app).
