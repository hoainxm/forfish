# Rà pipeline HUẤN LUYỆN dự báo cá — tổng hợp team agent 2026-10-18

**Load khi / Load when**: trước khi fit lại hồ sơ loài, đổi nhãn eCDT×VMS, đổi cách kiểm định, hay dựng runner train — load để biết số 0,736 đang chứng minh được gì và chưa chứng minh được gì.

> **Trạng thái: CHƯA ÁP gì.** 4 agent (Sonnet) rà song song 4 khâu, chỉ đọc code + đọc dữ liệu thật trên PC GPU (không ghi). Báo cáo gốc cùng thư mục: `report-data-labels.md` · `report-eval-protocol.md` · `report-fit-method.md` · `report-pipeline-ops.md`. Số nào agent tự đo ghi "đo", số ước ghi "ước" — giữ nguyên quy ước đó khi trích.

## 0. Kết luận của lead (đọc nếu chỉ có 2 phút)

**Số 0,736 AUCeff (§11 của `fish-validate-positions.md`) chưa chứng minh được là "cá", vì ba lý do hội tụ từ ba agent độc lập:**

| # | Phát hiện | Bằng chứng | Hệ quả |
|---|---|---|---|
| 1 | **Nhãn không phân giải trong chuyến**: kg loài của chuyến chia đều theo giờ VMS (`dl-build-labels.mjs:275`) ⇒ mọi ô trong một chuyến cùng kg/giờ | đọc code; cả agent nhãn lẫn agent kiểm định bắt độc lập | AUCeff chỉ đo "chuyến năng suất cao đi đâu" = cơ cấu đội tàu, KHÔNG đo "ô nào hôm nay có cá". Δdyn ≈ 0 gần như được đảm bảo bởi nhãn, dù mô hình tốt đến đâu |
| 2 | **AUCeff lẫn địa lý nghề**: mẫu số = giờ của MỌI nghề ≥10 % kg loài, nghề kéo áp đảo | `dl-eval.mjs:83`; bước nhảy lớn nhất khi thêm kênh tĩnh là cá nục 0,549→0,758, cá tráo 0,529→0,739 | kênh đội tàu/sản lượng được thưởng vì "biết nghề vây làm ở đâu", chưa chắc vì năng suất |
| 3 | **Siêu tham số và hồ sơ chọn trên chính 61 ngày kiểm**: 15 hồ sơ fit lại trên cả 8+9; `FLEET_SCALE`, `CATCH_SCALE`, `CATCH_FULL_KG` dò trên cùng 61 ngày; `dl-fit-profiles` còn fit mô hình KHÔNG có hai kênh tĩnh (`:127-135`) và trên điểm đã làm tròn + cắt KEEP_MIN | đọc code | giữ-tháng-ra chỉ che nội dung lưới, không che việc chọn tham số; mọi số "cả kỳ" trong §9 là trong-mẫu |

Cộng hai lỗi nhãn đo được trên dữ liệu thật (agent nhãn): **dải tốc độ nhảy theo cửa sổ** (Rê: 1–1,5 → 0,3–3,5 → 0–1 → 0,3–1 → 0–1; giờ/chuyến 46 → 122) vì `haulCount` chỉ có ở 2,7 % nhật ký; **`vmin = 0` đếm tàu nằm ở cảng khác vào giờ đánh** (Rê: 74 % giờ "đánh" < 0,3 kn, trong mẫu có haulCount 56 % giờ đó nằm trong 10 km một cảng).

Hai tin tốt: (a) **độ phủ không phải nút nghẽn** — "43 % nhật ký dùng được" là theo số nhật ký, theo kg nhãn phủ ~77 %; tàu không VMS chỉ 11,6 % kg (đo). (b) **Fit đang chậm 100× vô ích** — 85 % thời gian mỗi lượt dò là tính lại `spatialAnomaly` không đổi theo tham số (đo trên Mac: 67/80 ms); cache đặc trưng ô-ngày đưa 17 phút/loài xuống ~30 giây mà không đổi dạng mô hình.

**Quyết của lead:** GIỮ dạng mô hình HSI (không hộp đen, đúng tiêu chí "giải thích được cho bà con"). ĐO TRƯỚC KHI SỬA: tuần 1 không đổi mô hình, chỉ dựng bộ đo trung thực; mọi "+0,0x" hiện tại coi là cận trên lạc quan cho tới khi qua bộ đo mới.

## 1. Lộ trình 3 đợt (mỗi việc có cổng số)

### Đợt 1 — Đo trước khi sửa (không đổi mô hình, ~3 ngày máy + người) — **ĐÃ ĐO 2026-10-18, kết quả ở §6**

| # | Việc | Cổng / số kiểm | Báo cáo gốc |
|---|---|---|---|
| 1.1 | **AUCeff-trong-nghề** (Σ_g w_g·AUC(pos_{s,g}, neg_g)) + `n_eff` + TB macro theo loài, chạy lại bảng §10–§11 | nếu cá nục/cá tráo về ≈0,55 ⇒ lợi ích kênh tĩnh chủ yếu là địa lý nghề | eval §1 |
| 1.2 | **Baseline còn thiếu**: x-sản-lượng thuần (tháng kề lặp lại), x-đội-tàu thuần, tĩnh (sâu+bờ+vĩ), khí hậu mô hình (bỏ ảnh), ngẫu nhiên mượt — cùng `evaluate()` | nếu x thuần ≥0,70 ⇒ vệ tinh đóng góp ≤0,02 trên đỉnh | eval §4 |
| 1.3 | **4 phép kiểm rò** (giữ ±1 tháng · tách theo tàu · baseline M−1 · triệt tiêu năng suất tàu bằng trung vị kg/giờ theo nghề×lớp dài) | ablation ≥0,70 ⇒ kênh sản lượng là cơ cấu đội tàu | nhãn Q6 |
| 1.4 | **Bootstrap khối 7 ngày + CI chênh cặp** (lưu histogram theo ngày trong `dl-eval-fleet`) | thay `MIN_GAIN 0,01` bằng cận dưới CI 90 % > 0 + Benjamini–Hochberg q = 0,1 | eval §6–§7 |
| 1.5 | **Kiểm nhận-oan**: chạy đúng quy trình `dl-fit-profiles` trên nhãn dịch ≥15 ngày cho 25 loài | ≥2 loài vẫn "NHẬN" ⇒ ngưỡng hiện tại không bảo vệ gì | fit §1.5 |
| 1.6 | **Bảng độ tin cậy CPUE theo bậc điểm** (0–24 / 25–49 / 50–74 / ≥75) trên dữ liệu giữ-ra | "Cao" không cao hơn "TB" có ý nghĩa ⇒ UI đang nói dối — ưu tiên trên mọi tối ưu AUC | fit §5 |

### Đợt 2 — Nhãn v2 + fit nhanh và đúng (~1 tuần)

| # | Việc | Cổng / số kiểm | Báo cáo gốc |
|---|---|---|---|
| 2.1 | **Nhãn v2**: MỘT bảng dải tốc độ cố định cả năm (ước trên ~6 600 chuyến có haulCount, bootstrap CI); bỏ `vmin = 0` trừ vây ánh sáng; loại giờ trong 10 km quanh MỌI cảng (`catalog-ports` + `tk.c`, tái dùng lưới cảng của `build-fleet-effort-grid`); thêm cột băm chuyến/tàu (không PII) | giờ/chuyến 5 cửa sổ chênh <20 %; % giờ Rê ≤6 km cảng <2 %; ρ(đợt, haulCount) không tụt; AUCeff cùng 61 ngày không tụt >0,01 | nhãn Q1, Q8#1 |
| 2.2 | **Gán nghề cho tàu NULL** (Naive Bayes loài+dài+công suất thuần JS, đo 68 % đúng 6 lớp, 73 % theo kg, Kéo↔Vây nhầm ≤2 %; giữ posterior ≥0,7, cờ `gear_src`) + **tách carrier (1 317 tàu, 15,7 % kg) và cặp kéo đôi (79 % chuyến một tàu khai 0)** khỏi nhãn vị trí | kg "?" 44 % → ≤12 %; ρ của tàu NULL −0,02 → ≥0,35 | nhãn Q2, Q5 |
| 2.3 | **Bỏ hệ số tin cậy vô tác dụng** (×0,5 chạm 0,1 % kg vì 100 % chuyến có kg đều `landingMonitored`; ×0,3 phạt chuyến giấy nhỏ số tròn); thay bằng Huber trên log(kg) ~ log(giờ trong dải) theo nghề×lớp dài | ablation hệ số = 1 vs hiện tại: chênh <0,003 ⇒ bỏ | nhãn Q4 |
| 2.4 | **Fit rẻ**: memo `spatialAnomaly`/`coastDistanceKm` (WeakMap, ~6×) → tách `buildCellFeatures`/`scoreCell` trong `buildFishForecast` (MỘT nguồn công thức, test snapshot "y hệt bản cũ" 3 ngày) → cache Float32Array ~54 MB/300 ngày (~100–170×) | 1 loài/61 ngày: 17 phút → ~30 giây | fit §1, §6 |
| 2.5 | **Fit đúng**: điểm liên tục không làm tròn/không KEEP_MIN khi fit; hai kênh tĩnh BẬT ở chế độ giữ-tháng-ra; `δchl` toàn cục trước (25/25 loài dừng ở mép −0,4 = lệch hệ thống, không phải 25 sự thật riêng) rồi mới tinh loài với prior phạt `((θ−θ0)/σ)²`, luật `keepWarm` tay → ràng buộc hộp | 15 loài "đã áp" chạy lại: bao nhiêu sống sót qua CI + kiểm nhận-oan | fit §1.2–1.4, §7 |
| 2.6 | **Mở rộng 10 tháng**: tải thêm 223 ngày lưới ERDDAP (~13 phút, ước); 5 fold 2 tháng đệm 15 ngày + chuỗi tiến (tháng M chỉ dùng <M); giữ-tàu-ra cho mọi kênh có lưới | F3 thấp hơn giữ-tháng-ra >0,02 ⇒ số chốt hiện tại bị tô hồng | eval §2–§3 |

### Đợt 3 — Vận hành + câu hỏi còn mở (song song, không chặn 1–2)

| # | Việc | Ghi chú |
|---|---|---|
| 3.1 | **Push nhánh `Data`** (AI-Assistant, 6 commit kéo DataLake) + **đưa `dl-adapt-local.mjs` vào `scripts/`** (bỏ đường dẫn cứng `C:/Code/AI Assistant/...`, nhận `--src`) + một biến `SDFISH_DATA_DIR` thay `~/sdfish-data` ↔ `/mnt/c/Users/admin/sdfish-data` | hiện nguồn thô + bộ chuyển đều KHÔNG có bản thứ hai; snapshot 11/10 không kéo lại được vì đường hầm chết |
| 3.2 | **Sao lưu** snapshot DataLake (5,1 GB) + `sdfish-data` (7 GB) sang ổ khác; kiểm vhdx WSL nằm ổ nào; `track/` không để trên ổ có đồng bộ đám mây | ops §3 |
| 3.3 | **Runner `scripts/train/run.mjs`** stage + cache theo hash + `runs/<ngày>-<sha>/manifest.json` + `--resume`; `npm run train:*`; dời 17 script thí nghiệm doc-0 sang `scripts/_archive/` | WSL đã bật systemd user (5 timer sẵn) ⇒ thêm `sdfish-train.timer` qua trọng tài `gpu-lich`; 6 cổng chặn không mở PR (ops §4) |
| 3.4 | **Tách hồ sơ loài máy ghi** ra `src/data/species-profiles.fit.v1.json` + `profile-sanity.test.ts` (dải nhiệt trong biên sinh học, cổng độ sâu ≥0, ô thực địa vàng không tụt) ⇒ bỏ bước tay duy nhất | làm SAU 3.3 |
| 3.5 | **Kiểm định tiến cứu**: đóng băng `FISH_ALGO_REV`, `forecast-archive` (từ 10/10) + kéo nhãn hằng tuần; ≥60 ngày (~giữa 12/2026) mới có bộ test không bị chọn tham số chạm tới | kiểm xem `fish_forecast_snapshot` lưu một tầm hay nhiều tầm ngày |
| 3.6 | **w(d) bằng cá thật**: dùng khung `aucFor(s, prep, pairing)` của `dl-eval.mjs` với `pairing = i − d` thay "sự thật" = bản đồ của chính mô hình (`fit-fish-blend-weights`); CI block-bootstrap | kết quả có thể w* = 0 ở nhiều loài — là kết quả trung thực, UI phải nói đúng mức |
| 3.7 | **Thí nghiệm tầng residual logistic có khoá dấu** (ngừ vằn = đối chứng dương, cá nục = đối chứng âm; A/B/C; thắng nếu Δdyn giữ-ra ≥ +0,02 p<0,05 và điểm nóng không phình >2 điểm %) | chỉ làm sau 2.4–2.5; thua thì KHÔNG thêm tầng |

## 2. Cần anh Long chốt (nghiệp vụ, không phải kỹ thuật)

| # | Câu hỏi | Nếu không chốt |
|---|---|---|
| Q1 | **Xin Data Lake toạ độ mẻ** (góp ý GY-473e65c9 đang chờ) — chỉ 4 % chuyến (~9 700) có toạ độ là đủ dựng bộ nhãn "vàng" đo thẳng "giờ đánh suy luận nằm trong 5 km mẻ thật" | Δdyn mãi không đo được; mọi kết luận về vị trí chỉ là ρ gián tiếp |
| Q2 | **Xin nhãn 2025** (nhật ký + VMS) để có leave-year-out — production dùng lưới "cùng tháng năm trước", chưa phép đo nào cho tình huống đó | giữ-tháng-ra chỉ chứng minh "không học thuộc tháng", không chứng minh "bền qua năm" |
| Q3 | **Đường hầm/token DataLake ổn định** + ai chịu trách nhiệm kéo snapshot (README hứa 06:00 hằng ngày nhưng không có lịch; dữ liệu đứng ở 11/10) | pipeline tự động vô nghĩa khi đầu vào chết |
| Q4 | **Chấp nhận nhãn chỉ nói về tàu ≥15 m** (tàu nhỏ không VMS: 50 % nhật ký, 11,6 % kg) — đúng nhóm người dùng app nhưng không bịa vị trí được | ghi thẳng vào §11; nếu muốn nhãn yếu 0,25° cho tàu nhỏ phải tách riêng, không dùng kiểm định |
| Q5 | **"Cao" phải có CPUE cao hơn "Trung bình" có ý nghĩa** (việc 1.6) là cổng sản phẩm, đứng trên mọi tối ưu AUC? | nếu không, AUC chỉ đo thứ hạng, UI vẫn có thể nói quá |

## 3. Model nào cho việc nào (tiết kiệm token)

| Loại việc | Model | Ví dụ |
|---|---|---|
| Chạy script, dọn script, `package.json`, manifest, dời `_archive`, rsync sao lưu | **Haiku** | 3.1–3.3 phần cơ khí |
| Viết/sửa script đo, thêm baseline, bootstrap, nhãn v2, cache đặc trưng (có cổng số rõ, có test snapshot) | **Sonnet** | 1.1–1.6, 2.1–2.6 |
| Đọc bảng kết quả rồi quyết (hồ sơ nào sống sót, có thêm tầng residual không), đổi định nghĩa nhãn có tính nghiệp vụ, viết doc kết luận | Opus/Fable (lead) | sau mỗi đợt, một lần |
| Duyệt PR + merge | anh Long | — |

Toàn bộ "train" là script Node thuần, không cần LLM lúc chạy; LLM chỉ cần ở lúc viết script và lúc đọc kết quả.

## 4. Chỗ các agent KHÔNG thống nhất (lead chốt)

- Gập dữ liệu: eval đề 5 fold 2 tháng; fit đề leave-one-month-out ≥5 nếp → **chốt 5 fold 2 tháng đệm 15 ngày + chuỗi tiến** (ít lượt dựng lưới hơn, tháng kề không lọt vào train).
- Giờ đứng yên của tàu vây: nhãn hiện loại (vmin 0,6) còn `build-fleet-effort-grid` đếm 0–4,5 kn vì "tàu đèn giữ đàn là đứng yên" → **một định nghĩa "giờ đánh" dùng chung cho nhãn và lưới**, vây ánh sáng giữ đứng yên ban đêm cách cảng >10 km.
- Tầng học thống kê: fit đề thí nghiệm nhỏ; eval cảnh báo nhãn chưa phân giải trong chuyến nên Δdyn không đo được → **chỉ làm 3.7 sau khi 1.3 cho thấy kênh sản lượng không thuần là cơ cấu đội tàu**, và sau khi có nhãn v2.

## 5. Giới hạn của lần rà này

- Không chạy lại bất kỳ eval nào; mọi số là đọc code + đo thống kê trực tiếp trên dữ liệu thô (nhãn) hoặc đo thời gian trên Mac (fit). Các ước lượng tốc độ "100×", CI "±0,01–0,02", rò "0,01–0,03" đều chưa đo.
- Chưa có toạ độ mẻ nên KHÔNG kết luận nào về chất lượng vị trí có thước thật.
- Snapshot DataLake chỉ tới 11/10; VMS thiếu ~8,6 nghìn tàu từ 15/09 — tháng 9–10 phải dựng lại nhãn khi Data Lake bù xong.

---

## 6. Kết quả đợt 1 (ngày) — chạy 2026-10-18 trên PC GPU

> **Trạng thái: ĐÃ ĐO, CHƯA SỬA GÌ.** Không đổi mô hình, không đổi `SPECIES_PROFILES`; chỉ thêm phép đo. Số thô + bảng đầy đủ: thư mục ghi chú của phiên (`dot1-honest-eval.json`, `dot1-honest-tables.md`), KHÔNG vào git (luật dữ liệu). Bộ đo tái hiện đúng số cũ trước khi dùng: HEAD **0,621** · đội tàu **0,672** · bản chốt **0,736** (cột "AUCeff cũ, TB kg") — khớp §10–§11 của `fish-validate-positions.md` đến 3 chữ số.

### 6.0 Đọc kết quả thẳng thắn (5 dòng)

1. **Địa lý nghề KHÔNG phải nguồn chính của 0,736.** Tính trong từng nghề, bản chốt còn **0,726** (cũ 0,736, chỉ −0,010); cá nục 0,758 → 0,725, cá tráo 0,756 → 0,709 — xa mức ≈0,55 mà cổng 1.1 coi là "chỉ là địa lý nghề". Nhưng "trong cùng nghề" vẫn chỉ là *chỗ tàu cùng nghề hay làm*, chưa phải mật độ cá (nhãn chia kg đều theo giờ trong chuyến — N1, phần 0 phía trên).
2. **Ảnh vệ tinh của NGÀY hôm nay đóng góp ≈ 0.** Lấy điểm của chính bản chốt rồi thay bằng trung bình tháng (bỏ biến động ngày): **0,739** vs 0,736 (cũ); trong-nghề 0,727 vs 0,726, Δ +0,001 [−0,002…+0,004]; với HEAD, bản trung bình tháng còn CAO hơn bản theo ngày (trong-nghề 0,631 vs 0,617, Δ +0,013 [+0,004…+0,023]) — biến động ngày là nhiễu đối với phép đo này. (Không có nghĩa vệ tinh vô dụng: nhãn không phân giải được "ô nào hôm nay có cá", xem dòng 5.)
3. **0,736 là "bản đồ bãi theo mùa", và bản đồ đơn giản hơn thắng nó.** Không cần mô hình: tĩnh sâu+bờ+vĩ (fit trên tháng kia) **0,809**, kg tháng trước ÷ giờ tháng trước (M−1) **0,813**, x-sản-lượng thuần **0,786** — đều CAO HƠN bản chốt, chênh trong-nghề +0,045…+0,066, CI 90 % loại 0. Cổng 1.2 ("x thuần ≥ 0,70 ⇒ vệ tinh đóng góp ≤ 0,02 trên đỉnh") **đạt**; mô hình hiện đang làm LOÃNG tín hiệu x. Cổng M−1 (≥ 0,70) cũng đạt.
4. **Rò theo tàu/tháng gần bằng 0, nhưng kênh sản lượng chủ yếu là cơ cấu đội tàu.** Tàu lạ 0,723 vs tàu quen 0,727 (−0,004); bỏ M−1/M/M+1, dùng tháng cách ≥ 2: 0,728 (−0,008). Song **triệt tiêu năng suất tàu vẫn 0,706 (≥ 0,70: chạm cổng 1.3)** — ~74 % mức tăng HEAD → bản chốt (0,085/0,115) còn nguyên khi kg mỗi chuyến bị san về trung vị nghề × lớp dài ⇒ kênh sản lượng học "nghề nào, loài nào, ở bãi nào", không học "ô nào năng suất cao hơn".
5. **Còn bao nhiêu là "cá"?** Phần *chứng minh được* là +0,109 [+0,100…+0,116] (HEAD → bản chốt, trong-nghề) và nó gần như toàn bộ là địa lý/mùa vụ bền (qua tháng, qua tàu, qua nghề); phần *"vệ tinh hôm nay chỉ ra cá"* đo được là 0 ± 0,003 — nhưng bằng nhãn này thì **không đo được** (N1), nên KHÔNG kết luận "vệ tinh vô dụng", chỉ kết luận **"0,736 không phải bằng chứng cho dự báo cá"**: nên đọc là bản đồ bãi cá theo mùa. Thêm: quy trình fit hồ sơ vẫn NHẬN 3/10 loài (hồ sơ hiện tại) và 8/10 (hồ sơ gốc) ngay cả khi nhãn lệch 15 ngày (6.3) ⇒ mọi "+0,0x" của 15 hồ sơ đã áp cần xem lại; và 1.6 cho thấy HEAD (không kênh) CPUE ở bậc ≥ 75 **thấp hơn** bậc 50–74 (0,39×); bản chốt thì tăng đơn điệu (×4,05) nhưng phần lớn là kênh sản lượng.

*Chú ý đọc:* (a) 61 ngày 8–9/2026, nhãn `dl-trk0809` (chỉ tàu có VMS); HEAD đã chứa 15 hồ sơ fit trên chính 61 ngày này (N2) ⇒ mọi số mô hình là cận trên lạc quan; baseline "tĩnh" và "M−1" KHÔNG qua bước chọn tham số nào trên 61 ngày (tĩnh fit trên tháng còn lại, M−1 không fit) ⇒ so sánh này nghiêng về phía có lợi cho mô hình, không phải ngược lại. (b) 9 khối ngày ⇒ CI rộng ở loài nhỏ; macro* = TB đều trên **26/34 loài có n_eff ≥ 200** (n_eff = Kish (Σkg)²/Σkg² trên kg ô-ngày; ⚠ = n_eff < 200: chỉ vàng 139, cá sòng 93, ghẹ xanh, cá bơn, mực lá, ngừ mắt to, tôm bạc). (c) AUCarea/số "TB kg" bị cá nục + ngừ vằn + ngừ ồ + cá cơm + mực xà ≈ 62 % trọng số (N3) — đã báo macro cạnh đó.

### 6.1 Bảng kết quả — mọi cấu hình (B = 500 bootstrap khối 7 ngày; [CI 90 %]; Δ cùng mẫu khối)

`AUCeff CŨ` = pos mọi nghề vs giờ hợp các nghề ≥ 10 % kg loài (số §10–§11). `TRONG-NGHỀ` = Σ_g w_g·AUC(pos_{s,g}, neg_g), w_g = kg loài s của nghề g (g ∈ nghề ≥ 10 % kg), chuẩn lại trên nghề đo được. TB kg = trọng số kg; macro* = TB đều trên 26 loài n_eff ≥ 200. Cấu hình rò: xem ghi chú dưới bảng.

| cấu hình | AUCeff CŨ (TB kg) | AUCeff TRONG-NGHỀ (TB kg) | TRONG-NGHỀ macro* | Δ trong-nghề so HEAD (kg) | Δ so bản chốt `prod` (kg) | Δ so bản chốt (macro) |
|---|---|---|---|---|---|---|
| **Mô hình (giữ-tháng-ra)** | | | | | | |
| HEAD — không kênh | 0.621 [0.605–0.635] | 0.617 [0.603–0.632] | 0.610 [0.603–0.617] | — | -0.109 [-0.116…-0.100] | -0.068 [-0.073…-0.064] |
| đội tàu (giữ-tháng-ra) | 0.672 [0.657–0.685] | 0.660 [0.646–0.675] | 0.638 [0.631–0.647] | +0.043 [+0.040…+0.045] | -0.066 [-0.073…-0.058] | -0.039 [-0.044…-0.036] |
| sản lượng, không đội tàu | 0.736 [0.724–0.750] | 0.728 [0.716–0.744] | 0.675 [0.667–0.685] | +0.111 [+0.101…+0.120] | +0.003 [+0.000…+0.005] | -0.003 [-0.006…+0.000] |
| đội tàu + sản lượng (bản chốt 0,736) | 0.736 [0.724–0.749] | 0.726 [0.714–0.741] | 0.678 [0.671–0.687] | +0.109 [+0.100…+0.116] | — | — |
| **1.2 Baseline cùng `evaluate()`** | | | | | | |
| x-sản-lượng thuần (tháng kề) | 0.786 [0.777–0.799] | 0.771 [0.761–0.784] | 0.739 [0.728–0.757] | +0.153 [+0.135…+0.173] | +0.045 [+0.034…+0.059] | +0.062 [+0.052…+0.075] |
| x-đội-tàu thuần (tháng kề) | 0.495 [0.488–0.499] | 0.488 [0.483–0.494] | 0.492 [0.488–0.499] | -0.129 [-0.148…-0.113] | -0.237 [-0.252…-0.224] | -0.185 [-0.192…-0.177] |
| tĩnh: sâu+bờ+vĩ (fit tháng kia) | 0.809 [0.802–0.818] | 0.777 [0.770–0.785] | 0.764 [0.755–0.774] | +0.160 [+0.148…+0.174] | +0.051 [+0.042…+0.062] | +0.086 [+0.081…+0.092] |
| khí hậu của HEAD (TB tháng) | 0.640 [0.631–0.650] | 0.631 [0.620–0.645] | 0.617 [0.608–0.626] | +0.013 [+0.004…+0.023] | -0.095 [-0.107…-0.084] | -0.061 [-0.067…-0.056] |
| khí hậu của bản chốt (TB tháng) | 0.739 [0.727–0.751] | 0.727 [0.713–0.743] | 0.679 [0.673–0.689] | +0.110 [+0.102…+0.117] | +0.001 [-0.002…+0.004] | +0.002 [-0.000…+0.004] |
| ngẫu nhiên mượt 3×3 | 0.498 [0.492–0.503] | 0.499 [0.493–0.505] | 0.502 [0.496–0.505] | -0.118 [-0.137…-0.102] | -0.227 [-0.244…-0.214] | -0.176 [-0.189…-0.167] |
| M−1: kg tháng trước (thuần) | 0.784 [0.774–0.791] | 0.769 [0.759–0.776] | 0.736 [0.726–0.748] | +0.152 [+0.130…+0.169] | +0.043 [+0.028…+0.056] | +0.059 [+0.047…+0.069] |
| M−1: kg/giờ tháng trước | 0.813 [0.805–0.819] | 0.791 [0.782–0.799] | 0.743 [0.733–0.756] | +0.174 [+0.156…+0.193] | +0.066 [+0.048…+0.081] | +0.066 [+0.055…+0.076] |
| **1.3 Bốn phép kiểm rò** | | | | | | |
| rò#1 cách ≥2 tháng: đội tàu+sản lượng | 0.728 [0.718–0.737] | 0.715 [0.707–0.726] | 0.668 [0.662–0.675] | +0.098 [+0.091…+0.107] | -0.010 [-0.018…-0.004] | -0.009 [-0.014…-0.006] |
| rò#1 cách ≥2 tháng: x-sản-lượng thuần | 0.761 [0.752–0.767] | 0.744 [0.735–0.752] | 0.721 [0.714–0.729] | +0.127 [+0.106…+0.146] | +0.018 [-0.000…+0.034] | +0.043 [+0.036…+0.050] |
| rò#2 tách tàu: lưới nửa này → nhãn nửa KIA (tàu lạ) | 0.723 [0.712–0.734] | 0.715 [0.705–0.727] | 0.664 [0.656–0.675] | +0.097 [+0.089…+0.106] | -0.011 [-0.015…-0.007] | -0.014 [-0.016…-0.012] |
| rò#2 đối chứng: lưới nửa này → nhãn nửa NÀY (tàu quen) | 0.727 [0.717–0.738] | 0.718 [0.709–0.730] | 0.667 [0.660–0.677] | +0.101 [+0.093…+0.109] | -0.007 [-0.012…-0.004] | -0.011 [-0.012…-0.009] |
| rò#4 triệt tiêu năng suất: đội tàu + sản lượng-null | 0.706 [0.693–0.721] | 0.698 [0.684–0.715] | 0.663 [0.657–0.673] | +0.081 [+0.072…+0.089] | -0.028 [-0.030…-0.025] | -0.015 [-0.016…-0.013] |
| rò#4: sản lượng-null, không đội tàu | 0.698 [0.684–0.713] | 0.690 [0.675–0.708] | 0.656 [0.649–0.664] | +0.073 [+0.060…+0.084] | -0.036 [-0.042…-0.030] | -0.022 [-0.025…-0.019] |
| rò#4: x-sản-lượng-null thuần | 0.726 [0.714–0.740] | 0.710 [0.696–0.727] | 0.699 [0.688–0.714] | +0.092 [+0.071…+0.111] | -0.016 [-0.029…-0.004] | +0.021 [+0.012…+0.034] |

**Cách dựng từng dòng** (cùng `evaluate()`: cùng lưới ô 0,25° của payload, cùng nhãn, điểm nguyên 0..100, ô bị `KEEP_MIN` cắt = 0):
- *x-sản-lượng / x-đội-tàu thuần*: điểm = 100·x của lưới giữ-tháng-ra (tháng kề), x = 1 − e^(−kg30/8000) (sản lượng) hoặc 1 − e^(−giờ30/60) (đội tàu), đúng hàm `fleetPresenceLookup` của production, tắt cả mô hình.
- *tĩnh*: bảng lift CPUE theo độ sâu (11 bậc) + cách bờ (9 bậc) + vĩ độ (1°), shrinkage 50 giờ, cộng log-lift 3 biến, xếp phân vị; **fit trên tháng còn lại** (tháng 8 ← 9 và ngược lại), không dùng ảnh vệ tinh.
- *khí hậu*: điểm trung bình theo tháng, theo ô × loài, của chính cấu hình đó (bỏ biến động ngày; chỉ dùng điểm mô hình, không dùng nhãn).
- *ngẫu nhiên mượt*: trường ngẫu nhiên mỗi ngày làm mượt bằng nhân 3×3 của kênh x; kỳ vọng 0,5 (đạt: 0,498).
- *M−1*: lưới tháng trước (tháng 8 ← 7, tháng 9 ← 8) từ lưới "full" (không có lưới tháng nào của tương lai); "kg/giờ" = kg30 sản lượng ÷ giờ30 đội tàu của nghề mục tiêu, ô không có số liệu = 0.
- *rò#1*: **không thể bỏ M−1/M/M+1 đúng nghĩa đen** — cửa sổ vụ của `fleetPresenceGrid` chỉ đọc đúng ba tháng đó, bỏ cả ba ra lưới rỗng ≡ HEAD. Thay bằng: gộp các tháng cách tháng chấm 2–3 tháng (tháng 8 ← 5, 6, 10; tháng 9 ← 6, 7), gắn nhãn lại thành "tháng chấm". Đo: lưới của MÙA KHÁC còn nâng điểm không?
- *rò#2*: tàu chia 2 nửa theo băm FNV-1a mã tàu (`scripts/vessel-bucket.mjs`, 10 xô, A = 0–4, B = 5–9; không PII). Lưới đội tàu + sản lượng dựng chỉ từ nửa H (cũng giữ-tháng-ra, cổng ≥ 3 tàu đếm trong nửa), chấm nhãn nửa KIA ("tàu lạ") và nhãn nửa H ("tàu quen", đối chứng cùng lượng thông tin). Chênh quen − lạ = trí nhớ theo tàu; chốt − quen = phần mất vì chỉ còn một nửa đội tàu.
- *rò#4*: kg mỗi chuyến → trung vị kg/giờ (đã kẹp p99) của (nghề × lớp dài <12/12–15/15–24/≥24 m) × giờ đánh; cơ cấu loài của chuyến và trọng số tin cậy giữ nguyên; chuẩn lại để TỔNG kg bằng bản thật (hệ số chuẩn lại ×1,04–1,19 theo từng khúc nhãn) ⇒ mức bão hoà 8000 kg giữ nghĩa. Lưới dựng lại giữ-tháng-ra từ 5 khúc nhãn.

**Đọc bảng:** 
- *Cổng 1.1*: cá nục / cá tráo trong-nghề 0,725 / 0,709 (HEAD 0,544 / 0,519) — KHÔNG về ≈0,55 ⇒ lợi ích của hai kênh không chủ yếu là địa lý nghề (xem 6.2). Nhưng baseline tĩnh trong-nghề (0,777) vẫn thắng bản chốt.
- *Cổng 1.3*: rò#2 = −0,004 (cũ) / −0,003 (trong-nghề) quen → lạ: không đáng kể; rò#1 −0,008; rò#4 = 0,706 ≥ 0,70 ⇒ **kênh sản lượng là cơ cấu đội tàu** theo đúng định nghĩa cổng.
- *Cổng 1.4*: HEAD → đội tàu +0,043 [+0,040…+0,045]; đội tàu → bản chốt cộng thêm +0,066 [+0,058…+0,073] (trong-nghề, kg); mọi cái CI loại 0. Cái KHÔNG loại 0: sản lượng-không-đội-tàu vs bản chốt (+0,003 [0,000…+0,005]) — kênh đội tàu không thêm gì sau khi đã có kênh sản lượng; khí hậu bản chốt vs bản chốt (+0,001 [−0,002…+0,004]).
- Số loài có Δ trong-nghề (bản chốt − HEAD) CI 90 % > 0: **24/34**, < 0: **3/34** (cá chim, cá sòng, ruốc). x-sản-lượng thuần vs HEAD: 26 dương / 5 âm.

### 6.2 Theo loài — AUCeff cũ → trong-nghề (n_eff, các baseline chính)

Chỉ loài ≥ 500 tấn; đủ 34 loài + CI từng loài trong `dot1-honest-eval.json`.

| loài | tấn | n_eff | HEAD cũ→TN | bản chốt cũ→TN | x-sản-lượng cũ→TN | tĩnh cũ→TN | M−1 kg/giờ cũ→TN | rò#4 null cũ→TN | Δ TN (chốt − HEAD) [CI 90 %] |
|---|---|---|---|---|---|---|---|---|---|
| cá nục | 23,372 | 1673 | 0.549→0.544 | 0.758→0.725 | 0.816→0.782 | 0.809→0.753 | 0.841→0.801 | 0.712→0.684 | +0.180 [+0.157…+0.196] |
| ngừ vằn | 11,029 | 8190 | 0.734→0.725 | 0.806→0.793 | 0.748→0.723 | 0.858→0.835 | 0.859→0.836 | 0.768→0.759 | +0.068 [+0.055…+0.086] |
| ngừ ồ | 6,761 | 1319 | 0.626→0.635 | 0.728→0.735 | 0.720→0.726 | 0.740→0.743 | 0.754→0.762 | 0.695→0.702 | +0.101 [+0.081…+0.122] |
| cá cơm | 5,561 | 259 | 0.677→0.681 | 0.753→0.768 | 0.868→0.874 | 0.858→0.840 | 0.888→0.888 | 0.740→0.755 | +0.087 [+0.064…+0.110] |
| mực xà | 3,930 | 943 | 0.587→0.599 | 0.603→0.619 | 0.840→0.815 | 0.860→0.836 | 0.849→0.823 | 0.599→0.616 | +0.020 [-0.003…+0.047] |
| cá mối | 3,170 | 1184 | 0.583→0.603 | 0.724→0.724 | 0.812→0.781 | 0.810→0.721 | 0.808→0.755 | 0.697→0.699 | +0.121 [+0.106…+0.137] |
| cá đổng | 2,825 | 2122 | 0.618→0.590 | 0.726→0.698 | 0.767→0.749 | 0.812→0.746 | 0.748→0.712 | 0.689→0.653 | +0.108 [+0.097…+0.120] |
| ngừ chù | 2,469 | 1009 | 0.616→0.566 | 0.716→0.679 | 0.755→0.732 | 0.760→0.697 | 0.774→0.741 | 0.687→0.647 | +0.113 [+0.088…+0.144] |
| bạch tuộc | 2,343 | 748 | 0.744→0.743 | 0.793→0.798 | 0.794→0.796 | 0.757→0.729 | 0.774→0.771 | 0.770→0.773 | +0.054 [+0.029…+0.083] |
| chỉ vàng | 2,192 | 139⚠ | 0.784→0.769 | 0.887→0.891 | 0.901→0.896 | 0.927→0.909 | 0.882→0.886 | 0.865→0.869 | +0.122 [+0.075…+0.148] |
| mực ống | 2,190 | 2399 | 0.575→0.602 | 0.641→0.670 | 0.686→0.699 | 0.712→0.699 | 0.640→0.653 | 0.632→0.662 | +0.069 [+0.053…+0.085] |
| mực nang | 2,113 | 1398 | 0.602→0.615 | 0.666→0.674 | 0.678→0.672 | 0.731→0.694 | 0.606→0.540 | 0.632→0.635 | +0.059 [+0.040…+0.078] |
| bạc má | 1,923 | 352 | 0.776→0.771 | 0.836→0.839 | 0.828→0.826 | 0.840→0.828 | 0.821→0.807 | 0.821→0.819 | +0.068 [+0.050…+0.093] |
| ngừ chấm | 1,903 | 663 | 0.583→0.604 | 0.757→0.798 | 0.815→0.836 | 0.802→0.839 | 0.834→0.860 | 0.747→0.787 | +0.193 [+0.162…+0.246] |
| cá hố | 1,834 | 808 | 0.542→0.511 | 0.543→0.499 | 0.805→0.824 | 0.807→0.826 | 0.829→0.847 | 0.542→0.496 | -0.012 [-0.025…+0.004] |
| ngừ vây vàng | 1,355 | 3167 | 0.670→0.676 | 0.721→0.746 | 0.739→0.783 | 0.814→0.833 | 0.809→0.826 | 0.713→0.744 | +0.070 [+0.063…+0.077] |
| cá trích | 756 | 233 | 0.625→0.593 | 0.650→0.614 | 0.807→0.793 | 0.853→0.829 | 0.804→0.791 | 0.647→0.610 | +0.021 [+0.005…+0.038] |
| cá chim | 725 | 458 | 0.398→0.317 | 0.350→0.264 | 0.701→0.679 | 0.733→0.757 | 0.749→0.764 | 0.355→0.265 | -0.053 [-0.063…-0.034] |
| nục heo | 720 | 704 | 0.621→0.627 | 0.660→0.657 | 0.588→0.569 | 0.686→0.678 | 0.697→0.691 | 0.656→0.652 | +0.029 [+0.017…+0.044] |
| cá tráo | 690 | 570 | 0.529→0.519 | 0.756→0.709 | 0.818→0.783 | 0.862→0.798 | 0.854→0.811 | 0.738→0.694 | +0.190 [+0.175…+0.212] |
| cá ngân | 601 | 240 | 0.714→0.687 | 0.802→0.791 | 0.831→0.840 | 0.814→0.798 | 0.768→0.765 | 0.788→0.776 | +0.103 [+0.086…+0.117] |
| cá thu | 561 | 1274 | 0.589→0.560 | 0.650→0.598 | 0.706→0.682 | 0.762→0.744 | 0.738→0.717 | 0.658→0.612 | +0.038 [+0.026…+0.052] |

### 6.3 Kiểm nhận-oan (việc 1.5) — `dl-fit-profiles` đúng quy trình trên nhãn dịch +15 ngày

Dự báo ngày d chấm bằng nhãn ngày d+15 (cá của ngày khác hẳn; ngày cuối tháng 9 thiếu nhãn bị bỏ), 10 loài nhiều kg, còn lại **y nguyên** quy trình: gập tháng 8 ↔ 9, dò toạ độ 2 vòng, NHẬN khi cả hai chiều ≥ −0,005 và TB tăng ≥ `MIN_GAIN` 0,01. Hai nền hồ sơ: hiện tại (đã áp bản fit 10/10) và GỐC (`src` của `c0062be5^`, trước khi áp 15 hồ sơ — nền mà lần fit thật đã chạy). Δ = AUCeff (cũ) trên tháng đo, sau − trước.

| loài | hồ sơ HIỆN TẠI (đã fit 10/10), nhãn dịch +15 ngày | hồ sơ GỐC (trước c0062be5, chưa fit), nhãn dịch +15 ngày |
|---|---|---|
| cá nục | **NHẬN** (Δ tháng 8 +0.017 · tháng 9 +0.019; TB +0.018) {"chlShift": -0.2, "depthScale": 0.75} | **NHẬN** (Δ tháng 8 +0.099 · tháng 9 +0.090; TB +0.094) {"chlShift": -1, "depthScale": 0.75} |
| ngừ vằn | giữ (Δ tháng 8 +0.000 · tháng 9 +0.000; TB +0.000) | **NHẬN** (Δ tháng 8 +0.023 · tháng 9 +0.037; TB +0.030) {"chlShift": -0.6} |
| ngừ ồ | giữ (Δ tháng 8 +0.005 · tháng 9 +0.004; TB +0.004) | **NHẬN** (Δ tháng 8 +0.112 · tháng 9 +0.266; TB +0.189) {"chlShift": -0.8, "depthScale": 0.75} |
| cá cơm | giữ (Δ tháng 8 +0.000 · tháng 9 -0.000; TB -0.000) | **NHẬN** (Δ tháng 8 +0.022 · tháng 9 +0.007; TB +0.015) {"sstShift": 2, "sstWidth": 0.6, "chlShift": -0.4, "food": 0, "depthScale": 0.75} |
| mực xà | giữ (Δ tháng 8 +0.002 · tháng 9 -0.014; TB -0.006) | giữ (Δ tháng 8 +0.002 · tháng 9 -0.014; TB -0.006) |
| cá mối | giữ (Δ tháng 8 +0.051 · tháng 9 -0.014; TB +0.019) | giữ (Δ tháng 8 +0.061 · tháng 9 -0.011; TB +0.025) |
| cá đổng | giữ (Δ tháng 8 +0.013 · tháng 9 -0.024; TB -0.006) | **NHẬN** (Δ tháng 8 +0.111 · tháng 9 +0.007; TB +0.059) {"chlShift": -1, "depthScale": 0.75, "sstShift": -1} |
| ngừ chù | **NHẬN** (Δ tháng 8 +0.027 · tháng 9 +0.019; TB +0.023) {"sstShift": 2, "sstWidth": 0.8, "chlShift": 0.2, "depthScale": 0.5} | **NHẬN** (Δ tháng 8 +0.026 · tháng 9 -0.004; TB +0.011) {"sstShift": 2, "sstWidth": 0.6, "chlShift": 0.2, "depthScale": 0.5} |
| bạch tuộc | giữ (Δ tháng 8 +0.007 · tháng 9 +0.003; TB +0.005) | **NHẬN** (Δ tháng 8 +0.073 · tháng 9 +0.055; TB +0.064) {"chlShift": -0.2, "food": 0} |
| chỉ vàng | **NHẬN** (Δ tháng 8 +0.068 · tháng 9 +0.132; TB +0.100) {"sstShift": 2, "sstWidth": 0.6, "chlShift": -1, "depthScale": 0.75} | **NHẬN** (Δ tháng 8 +0.068 · tháng 9 +0.132; TB +0.100) {"sstShift": 2, "sstWidth": 0.6, "chlShift": -1, "depthScale": 0.75} |
| **số loài NHẬN** | **3/10** | **8/10** |

**Kết quả: 3/10 loài vẫn NHẬN với hồ sơ hiện tại và 8/10 với hồ sơ gốc ⇒ cổng 1.5 (≥ 2 loài) ĐẠT — ngưỡng `MIN_GAIN` + gập 8↔9 không bảo vệ khỏi "nhận oan".** Mức tăng trên nhãn sai ngày của hồ sơ gốc còn LỚN hơn mức báo trên nhãn thật ở §9 (cá nục +0,094 vs +0,067; ngừ ồ +0,189 vs +0,141 — số §9 là "cả kỳ", trong-mẫu): phần lớn cái "fit hồ sơ" học là địa lý/mùa vụ chung của cả hai tháng, không phải "cá hôm đó". Chưa kết luận hồ sơ nào sai: 15 hồ sơ đã áp có thể vẫn có phần thật; điều đo được là *quy trình nhận* không phân biệt được. Giới hạn: dịch 15 ngày trong cùng mùa gió; nền "gốc" chạy trên MÃ trước `c0062be5` (khác mã hiện tại ở các commit 10/10–11/10); chưa chạy đối chứng nhãn thật (dịch 0) trên nền gốc vì hết giờ máy — lần fit thật đã ghi 15/17 loài NHẬN (§9).


### 6.4 Bảng CPUE theo bậc điểm (việc 1.6) — dữ liệu giữ-ra, 61 ngày

kg/giờ của **nhóm nghề mục tiêu** của loài (mẫu số = giờ đánh của các nghề ≥ 10 % kg loài, cùng mẫu số AUCeff) trong ô thuộc từng bậc điểm; "gộp mọi loài" = Σ kg ÷ Σ giờ qua 34 loài (giờ của nghề dùng chung được đếm theo từng loài ⇒ tuyệt đối không so với số ngoài bảng, chỉ so tỉ số giữa bậc). Bậc 0–24 gồm cả ô bị `KEEP_MIN` cắt.

**Câu hỏi cổng 1.6: "Cao" có cao hơn "Trung bình" có ý nghĩa không?** — bản chốt: **CÓ** (gộp ×4,05 [3,85–4,23]; từng loài ×1,0…×8,2, CI loại 1 ở 11/12 loài lớn, riêng mực ống ×1,01 [0,85–1,17]). HEAD không kênh: **KHÔNG** — bậc ≥ 75 thấp hơn bậc 50–74 (×0,39 [0,33–0,46]; cá nục ×0,49, cá cơm/ngừ ồ/mực xà không có ô ≥ 75). **Hai cảnh báo trước khi coi đây là "UI không nói dối":** (1) bậc của bản chốt đến phần lớn từ kênh sản lượng/đội tàu, mà kênh đó dựng từ chính nhãn tàu-chuyến cùng loại (N1; rò#4 cho thấy 74 % mức tăng còn khi san phẳng năng suất) ⇒ "Cao" nghĩa là "bãi mà mùa này tàu cùng nghề bắt được nhiều", chưa phải "hôm nay cá nhiều"; (2) bậc 25–49 / 0–24 KHÔNG đơn điệu ở cá cơm (0,78×), mực xà (0,31×): ở hai loài này bậc thấp nhất cao hơn bậc kề.

**bản chốt (đội tàu + sản lượng)** — kg/giờ của nhóm nghề mục tiêu; tỉ số bậc trên / bậc liền dưới [CI 90 %]

| loài | 0–24 | 25–49 | 50–74 | 75–100 | 25–49 ÷ 0–24 | 50–74 ÷ 25–49 | ≥75 ÷ 50–74 |
|---|---|---|---|---|---|---|---|
| **gộp mọi loài** | 0.8 | 1.3 | 3.8 | 15.5 | 1.68 [1.35–2.18] | 2.84 [2.50–3.12] | 4.05 [3.85–4.23] |
| cá nục | 1.9 | 13.3 | 15.4 | 54.6 | 6.86 [3.01–15.18] | 1.16 [0.53–2.54] | 3.54 [2.86–4.42] |
| ngừ vằn | 1.7 | 4.5 | 21.9 | 38.1 | 2.62 [2.22–3.08] | 4.87 [4.23–5.56] | 1.74 [1.56–1.96] |
| ngừ ồ | 0.6 | 2.7 | 10.4 | 20.2 | 4.62 [3.66–6.13] | 3.80 [3.31–4.77] | 1.93 [1.54–2.33] |
| cá cơm | 3.0 | 2.3 | 7.7 | 34.8 | 0.78 [0.36–1.74] | 3.26 [1.81–5.97] | 4.54 [3.63–6.66] |
| mực xà | 4.0 | 1.2 | 2.8 | 23.0 | 0.31 [0.23–0.39] | 2.27 [0.74–6.09] | 8.15 [4.33–24.21] |
| cá mối | 0.6 | 2.2 | 5.6 | 9.9 | 3.89 [3.15–5.21] | 2.52 [1.93–3.07] | 1.77 [1.62–1.97] |
| cá đổng | 0.3 | 1.8 | 3.1 | 6.7 | 5.20 [3.96–6.75] | 1.75 [1.39–2.28] | 2.19 [1.70–3.18] |
| ngừ chù | 0.5 | 1.1 | 1.2 | 4.1 | 2.34 [1.63–3.09] | 1.15 [0.98–1.50] | 3.38 [3.05–3.78] |
| bạch tuộc | 0.8 | 17.5 | 8.4 | 20.7 | 22.30 [10.41–32.73] | 0.48 [0.26–1.14] | 2.46 [1.83–3.17] |
| chỉ vàng | 0.3 | 1.1 | 8.5 | 23.1 | 3.91 [2.45–6.75] | 7.59 [3.95–12.57] | 2.72 [1.80–4.30] |
| mực ống | 1.0 | 5.8 | 6.9 | 7.0 | 5.69 [4.42–7.42] | 1.20 [1.06–1.36] | 1.01 [0.85–1.17] |
| mực nang | 2.4 | 7.2 | 13.6 | 42.9 | 2.95 [2.54–3.47] | 1.89 [1.44–2.47] | 3.16 [1.75–4.86] |

**HEAD (không kênh)** — kg/giờ của nhóm nghề mục tiêu; tỉ số bậc trên / bậc liền dưới [CI 90 %]

| loài | 0–24 | 25–49 | 50–74 | 75–100 | 25–49 ÷ 0–24 | 50–74 ÷ 25–49 | ≥75 ÷ 50–74 |
|---|---|---|---|---|---|---|---|
| **gộp mọi loài** | 1.7 | 6.1 | 5.4 | 2.1 | 3.50 [3.08–3.88] | 0.89 [0.81–1.01] | 0.39 [0.33–0.46] |
| cá nục | 22.2 | 40.1 | 28.0 | 13.6 | 1.80 [1.39–2.29] | 0.70 [0.51–0.97] | 0.49 [0.41–0.59] |
| ngừ vằn | 3.8 | 29.2 | 28.4 | 25.8 | 7.62 [6.83–8.76] | 0.97 [0.65–1.36] | 0.91 [0.69–1.25] |
| ngừ ồ | 3.4 | 10.0 | 9.6 | — | 2.92 [2.20–3.78] | 0.96 [0.41–1.68] | — |
| cá cơm | 4.1 | 28.6 | 4.1 | — | 7.05 [3.96–11.70] | 0.14 [0.06–0.31] | — |
| mực xà | 4.1 | 6.7 | 29.3 | — | 1.64 [0.78–2.62] | 4.37 [2.06–10.32] | — |
| cá mối | 1.7 | 5.6 | 4.8 | — | 3.20 [2.65–4.10] | 0.86 [0.52–1.28] | — |
| cá đổng | 0.7 | 4.9 | 4.8 | — | 6.89 [6.20–7.72] | 0.97 [0.87–1.14] | — |
| ngừ chù | 0.6 | 2.1 | 2.3 | 7.1 | 3.68 [2.80–4.88] | 1.08 [0.76–1.51] | 3.05 [0.00–6.94] |
| bạch tuộc | 0.9 | 17.5 | 21.8 | — | 20.46 [16.86–25.24] | 1.25 [1.04–1.52] | — |
| chỉ vàng | 0.4 | 16.3 | 2.3 | 1.5 | 37.75 [13.56–79.82] | 0.14 [0.07–0.43] | 0.67 [0.20–1.66] |
| mực ống | 3.1 | 6.7 | 5.9 | — | 2.15 [1.87–2.42] | 0.88 [0.62–1.10] | — |
| mực nang | 3.7 | 12.7 | — | — | 3.40 [2.77–4.20] | — | — |

### 6.5 Tệp đã sửa / thêm, cách chạy lại

Chỉ `scripts/` + README này (không đụng `src/`, không đụng mô hình, không commit):

| tệp | thay đổi |
|---|---|
| `scripts/dl-eval.mjs` | `attachDay` thêm `kgG` (kg theo nghề); hàm thuần mới `recMetrics` (AUCeff cũ + TRONG-NGHỀ + AUCarea từ histogram), `aucHist`, `kishNeff`, `ci90`, `blockResamples`, `quantile`, `makeRng`; selftest mở rộng |
| `scripts/dl-eval-honest.mjs` (mới) | toàn bộ bộ đo đợt 1 (cấu hình, baseline, 4 phép rò, bootstrap khối, bảng CPUE); selftest `--selftest` |
| `scripts/dl-eval-fleet.mjs` | cờ `--honest` (+ `--boot B`) gọi bộ đo trên; không đổi đường chạy cũ |
| `scripts/vessel-bucket.mjs` (mới) | băm mã tàu → 10 xô (A/B), selftest |
| `scripts/dl-build-labels.mjs` | `--out`, `--vessel-hash` (cột `vh`), `--null-prod` (ghi `catch-null.csv`); `lenClass`, `median`; mặc định giữ đúng byte cũ |
| `scripts/build-fleet-effort-grid.mjs` | `--vessel-half A` hoặc `B` |
| `scripts/build-species-catch-grid.mjs` | `--vessel-half A` hoặc `B`, `--catch-file`; luật đếm tàu chuyển sang đếm theo (khúc × mã ASFIS) rồi MAX — **kiểm: chạy trên nhãn cũ ra file giống từng byte với bản cũ; trên nhãn `vh` lệch 2/72 564 ô** |
| `scripts/dl-fit-profiles.mjs` | `--label-shift N` (kiểm nhận-oan) |

Dữ liệu dựng thêm (NGOÀI repo, trên PC GPU `/mnt/c/Users/admin/sdfish-data/`): `dl-trk0809/labels-vh/` (nhãn kiểm định + cột `vh`; tổng kg/giờ khớp bản cũ), `dl-all/labels-vh-<khúc>/` (5 khúc, thêm `vh` + `catch-null.csv`), `fleet/fleet-ex-<tháng>-A|B.json`, `catch/catch-ex-<tháng>-A|B.json`, `catch/catch-null-ex-<tháng>.json`; thư mục chạy `~/fish-eval-r1/` (script copy + `tools/` chứa `tsx` cài riêng để không đụng `~/ForFish`; `src` là symlink về `~/ForFish/src` ở nhánh `feat/sen-bien-ranh-tay`, `prefit/` = `src` của `c0062be5^`).

```bash
# nhãn (~5 phút/khúc)
node --max-old-space-size=9000 scripts/dl-build-labels.mjs --dir $D/dl-trk0809 --from 2026-08-01 --to 2026-09-30 --vessel-hash --out $D/dl-trk0809/labels-vh
node --max-old-space-size=9000 scripts/dl-build-labels.mjs --dir $D/dl-all --from 2026-01-01 --to 2026-10-11 --window <a>,<b> --vessel-hash --null-prod --out $D/dl-all/labels-vh-<a>
# lưới nửa tàu / null (giữ-tháng-ra)
node scripts/build-fleet-effort-grid.mjs --exclude-month 2026-08 --vessel-half A --out $D/fleet/fleet-ex-2026-08-A.json   # (và B, 2026-09)
node scripts/build-species-catch-grid.mjs --labels <5 labels-vh> --exclude-month 2026-08 --vessel-half A --out $D/catch/catch-ex-2026-08-A.json
node scripts/build-species-catch-grid.mjs --labels <5 labels-vh> --exclude-month 2026-08 --catch-file catch-null.csv --out $D/catch/catch-null-ex-2026-08.json
# đo (~5 phút, 20 cấu hình × B=500)
npx tsx scripts/dl-eval-fleet.mjs --honest --grids $D/fc-full/grids --labels $D/dl-trk0809/labels-vh --fleet-dir $D/fleet --catch-dir $D/catch --out <dir> --boot 500
# nhận-oan (~8–16 phút/loài)
npx tsx scripts/dl-fit-profiles.mjs --grids $D/fc-full/grids --labels $D/dl-trk0809/labels --label-shift 15 --species "cá nục" --out <dir>
```

### 6.6 Giới hạn & việc tiếp theo

- *Chưa* đo (không thuộc đợt 1): F3 chuỗi tiến cho cả 10 tháng, giữ-tàu-ra cho kênh đội tàu riêng lẻ, Benjamini–Hochberg (mới có CI; cần đợt 2 để thay `MIN_GAIN`). Bootstrap chỉ 9 khối ⇒ CI loài nhỏ rộng (n_eff < 200 đừng dùng).
- rò#2: lưới nửa tàu có ít tàu hơn nên gate ≥ 3 tàu cắt nhiều ô hơn ⇒ so với bản chốt (đủ tàu) phải đọc cặp quen/lạ, không đọc quen/chốt.
- rò#4: giữ cơ cấu loài của từng chuyến nên không loại được "chuyến nào bắt loài nào"; đó chính là điều đo (cơ cấu đội tàu), không phải sai sót.
- Định nghĩa "x thuần" dùng đúng `fleetPresenceLookup` của production (cửa sổ M−1/M/M+1 có tháng kề trọng số ½); các tháng 8–9 trong lưới full là cửa sổ chấm-trúng-chính-nó nên chỉ dùng lưới giữ-tháng-ra ở mọi dòng trừ M−1 và rò#1.
- Gợi ý cho lead (không làm trong đợt này, chờ chốt): vì x thuần, M−1 và tĩnh đều > bản chốt, câu hỏi đợt 2 đáng đặt trước là "**mô hình HSI có thêm được gì trên nền x/tĩnh không?**" (đúng ý 3.7: tầng residual có khoá dấu), và dừng dùng "AUCeff 0,736" làm số tiêu đề.

## 7. Kế hoạch ĐỢT 2 — hướng chốt 2026-10-18 (chủ dự án)

> **Chốt:** NỀN của lớp cá = **bản đồ bãi cá theo mùa** (x-sản-lượng loài + x-đội-tàu + tĩnh sâu/bờ/vĩ + mùa vụ). **HSI/vệ tinh = lớp cộng thêm, phải tự chứng minh** bằng số trên nền đó. **Dừng dùng 0,736 làm số tiêu đề** (đã gắn cảnh báo ở 01-product, fish-validate-positions §11, chú thích `CATCH_SCALE` trong fish-predict.ts). Kế hoạch mục 1 (đợt 2 cũ) vẫn dùng, nhưng cổng số giờ so với NỀN (≈0,81 trong-nghề), không so với HEAD (0,62).

### 7.0 Câu hỏi trung tâm của đợt 2

**"HSI/vệ tinh có thêm được gì trên nền x + tĩnh không?"** — đo bằng Δ AUCeff trong-nghề của (nền + lớp) so với nền, trên chuỗi tiến (F3) và 5 fold 2 tháng, CI bootstrap khối 7 ngày. Vì AUC toàn lưới kém nhạy với dịch chuyển trong bãi (eval §5), thêm hai số phụ bắt buộc: **AUC cục bộ 1°×1°** và **Spearman dị thường ngày × ô** (điểm trừ trung bình tháng vs CPUE trừ trung bình ô). Lớp nào không qua cả ba thì KHÔNG nâng điểm — chỉ được hiển thị như "dấu hiệu hôm nay".

### 7.1 Sáu mảnh, phụ thuộc và cổng

| # | Mảnh | Vào / ra | Cổng số | Phụ thuộc | Model |
|---|---|---|---|---|---|
| **2A** | **Nền mới "bãi theo mùa"** — `scripts/fish-base-*.mjs` + `src/lib/fish-base.ts`: điểm nền từ x-sản-lượng (theo loài, K_s theo loài = trung vị kg ô dương), x-đội-tàu (theo nghề), tĩnh sâu/bờ/vĩ, mùa vụ; gộp bằng ≤5 hệ số/nhóm loài fit trên fold khác (logistic IRLS thuần JS hoặc rank-combine, chọn cái qua cổng với ít hệ số hơn). Tháng 11–12 (chưa có kg loài): chỉ đội tàu + tĩnh, nói rõ trong payload | lưới `public/data` hiện có + nhãn `dl-trk0809` / `labels-vh-*` → lưới nền theo tháng (≤1 MB, cùng shape) + bảng kết quả | (i) trong-nghề trên F3 ≥ max(tĩnh 0,809; M−1 0,813) − 0,01, CI loại 0 so bản chốt 0,726; (ii) CPUE theo bậc 25/50/75 **đơn điệu**, bậc ≥75 ≥ 2× bậc 50–74; (iii) % ô ≥50 ≤ hiện tại + 2 điểm; (iv) tàu lạ/quen chênh ≤ 0,01; (v) offline: lưới đi cùng bundle như hai lưới hiện có, không thêm request | không (nhãn hiện có đủ) | Sonnet |
| **2B** | **Bộ đo cho lớp cộng thêm**: memo `spatialAnomaly`/`coastDistanceKm` → tách `buildCellFeatures`/`scoreCell` (MỘT nguồn công thức, test snapshot y hệt 3 ngày) → cache Float32Array ô-ngày; backfill lưới ERDDAP 01–07/2026 (~13 phút ước); F3 chuỗi tiến + 5 fold 2 tháng đệm 15 ngày; AUC cục bộ 1° + Spearman dị thường; BH q=0,1 thay `MIN_GAIN` | `fc-full/grids` 61 → ~284 ngày; `scripts/fish-features-cache.mjs`; `dl-fit-profiles` chạy trên cache | 1 loài/61 ngày: 17 phút → ≤ 1 phút; snapshot test xanh; kiểm nhận-oan trên nhãn lệch 15 ngày: ≤ 1/10 loài NHẬN | không | Sonnet |
| **2C** | **Nhãn v2** (mục 1 đợt 2 cũ 2.1–2.3): một bảng dải tốc độ cố định cả năm (CI bootstrap trên ~6 600 chuyến có haulCount); bỏ `vmin = 0` trừ vây ánh sáng ban đêm cách cảng >10 km; loại giờ trong 10 km quanh MỌI cảng (`catalog-ports` + `tk.c`); gán nghề tàu NULL (Naive Bayes loài+dài+công suất, posterior ≥0,7, cờ `gear_src`); tách carrier + cặp kéo đôi; bỏ ×0,5/×0,3/×0,7, thay Huber log(kg)~log(giờ); cột `vh`/băm chuyến mặc định; một định nghĩa "giờ đánh" dùng chung nhãn ↔ lưới đội tàu | `dl-build-labels.mjs`, `build-fleet-effort-grid.mjs`, `build-species-catch-grid.mjs` → `labels-v2-*` trên PC GPU | giờ/chuyến 5 cửa sổ chênh <20 %; % giờ Rê ≤6 km cảng <2 %; kg "?" 44 % → ≤12 %; ρ(đợt, haulCount) tàu NULL ≥0,35; nền 2A đo lại trên nhãn v2 không tụt >0,01 | không | Sonnet |
| **2D** | **Thí nghiệm quyết định** — trên nền 2A, bộ đo 2B, nhãn v2 (2C): thêm (a) HSI hiện tại noisy-OR, (b) residual logistic khoá dấu trên đặc trưng vệ tinh *dị thường theo khí hậu tháng* (cấm vĩ/kinh/sâu/bờ), (c) chỉ front/SST/chl dị thường. Loài: ngừ vằn (đối chứng dương, Δdyn +0,018 p 0,003 cũ), cá nục (đối chứng âm), bạc má, cá cơm | 3 nhánh × 4 loài × F3 | THẮNG = Δ trong-nghề ≥ +0,01 CI loại 0 trên F3 **VÀ** AUC cục bộ tăng **VÀ** Spearman dị thường > 0 p<0,05 **VÀ** % ô ≥50 ≤ +2 điểm. THUA = vệ tinh chỉ hiển thị "dấu hiệu", không nâng điểm; UI nói đúng mức | 2A + 2B + 2C | lead đọc kết quả |
| **2E** | **Sản phẩm + doc**: 01-product (lời hứa Trục 1 viết lại: "bãi cá theo mùa + dấu hiệu hôm nay"), 07 design-spec (hai lớp tách bạch trên UI, chữ "vì sao" chỉ nói điều đã chứng minh), tier.ts (cái bán vẫn là lớp cá — ghi rõ nền + dấu hiệu), fish-validate-positions §9 ghi nợ "15 hồ sơ chưa qua kiểm nhận-oan" | doc + copy UI | BA/anh Long duyệt chữ | sau 2A có số | lead + anh Long |
| **2F** | **Vận hành** (mục 1 đợt 3: 3.1–3.3): push nhánh `Data`; `dl-adapt-local.mjs` vào `scripts/`; `SDFISH_DATA_DIR`; sao lưu snapshot + `sdfish-data`; runner `scripts/train/run.mjs` tới stage eval; `npm run train:*`; dời 17 script cũ `_archive/` | — | chạy lại một lệnh trên máy sạch ra `report.json` giống byte | không | Haiku (cơ khí) / Sonnet (runner) |

**Thứ tự:** 2A ‖ 2B ‖ 2C ‖ 2F chạy song song (file không trùng: 2A = `scripts/fish-base-*`, `src/lib/fish-base.ts`, `dl-eval-honest.mjs`; 2B = `src/lib/fish-predict.ts` (chỉ tách hàm), `fish-validate-run.mjs`, `dl-fit-profiles.mjs`, cache mới; 2C = `dl-build-labels.mjs`, hai `build-*-grid.mjs`, `vessel-bucket.mjs`; 2F = `scripts/train/`, `package.json`, `_archive/`). 2D sau cả ba. 2E sau 2A. Cùng checkout, không worktree (luật repo), không commit khi chưa được bảo.

### 7.2 Việc nghiệp vụ song song (anh Long)

- **Q1 toạ độ mẻ** (GY-473e65c9) — có thì 2D đo được thẳng "giờ đánh suy luận ≤5 km mẻ thật"; không có thì 2D chỉ đo được qua ρ gián tiếp và kết quả "thua" vẫn không được đọc là "vệ tinh vô dụng".
- **Q2 nhãn 2025** — nền 2A ở production dùng "cùng tháng năm trước"; chưa có phép đo nào cho tình huống đó.
- **Q3 đường hầm/token DataLake + ai kéo snapshot** — nền 2A sống bằng dữ liệu tháng mới; đầu vào chết thì nền đứng ở 10/2026.
- **Q5** đã chốt ngầm qua cổng (ii) của 2A: "Cao" phải có CPUE cao hơn "Trung bình".

### 7.3 Điều KHÔNG làm trong đợt 2

- Không đổi `SPECIES_PROFILES` tay; không fit lại 34 loài trước khi 2B xong (fit cũ nhận oan 3–8/10).
- Không gỡ 15 hồ sơ đã áp (holdout không tụt) — chỉ ghi nợ.
- Không thêm thư viện ML; mọi thứ thuần JS, chạy trên PC GPU hoặc Mac.
- Không dùng `fit-fish-blend-weights` (sự thật giả) cho w(d); đo bằng cá thật (mục 1 đợt 3.6) chỉ sau khi 2D có kết quả.
