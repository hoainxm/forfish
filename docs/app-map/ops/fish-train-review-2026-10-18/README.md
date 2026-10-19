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

### 7.2b Luật nghiệp vụ bổ sung (anh Long, 2026-10-18): **khai sai có chủ đích**

Dữ liệu eCDT phải tính cả trường hợp ngư dân **khai sai / khai bậy có chủ đích để qua mắt nhà nước** — không phải nhiễu ngẫu nhiên, xử lý như đối thủ. Hệ quả cho 2C (thay việc 5 "bỏ hệ số, thay Huber"): dựng **điểm tin cậy theo chuyến từ tín hiệu ĐỘC LẬP với lời khai** (VMS, sổ tàu, encounters, port-calls): (a) giấu vị trí — VMS tắt giữa chuyến, `KHONG_CO_THIET_BI`, track ngoài EEZ/vùng cấm nhưng khai vùng/cảng VN ⇒ loại khỏi nhãn vị trí; (b) giấu loài — "Cá Tạp/Cá Xô" bất thường theo nghề×vùng, loài cấm vắng hệ thống ⇒ kg chuyến chỉ vào tổng nghề, không vào lưới loài; (c) giấu/thổi sản lượng — vượt sức chở/p99, lặp y hệt, số tròn, landed ≠ catch, có kg mà không có đoạn đánh, kg rửa qua carrier ⇒ hạ trọng số theo mức lệch; (d) cảng/giờ cập khai ≠ VMS. Mỗi tín hiệu phải đo % chuyến/% kg dính + ablation AUCeff trong-nghề trước khi chốt trọng số. Giới hạn ghi thẳng: nhãn sẽ nghiêng về tàu khai thật. 2A: kg không phải sự thật — K_s dùng trung vị, lưới nền đọc cột tin cậy, loài toàn "cá tạp"/loài cấm chỉ dựng nền từ đội tàu + tĩnh.

**Nhánh làm việc đợt 2:** `feat/fish-train-dot2` (tách từ 9f1ee0f6 lúc 2026-10-18 tối, sau khi folder bị chuyển sang `feat/toi-uu-codex` giữa chừng).

### 7.3 Điều KHÔNG làm trong đợt 2

- Không đổi `SPECIES_PROFILES` tay; không fit lại 34 loài trước khi 2B xong (fit cũ nhận oan 3–8/10).
- Không gỡ 15 hồ sơ đã áp (holdout không tụt) — chỉ ghi nợ.
- Không thêm thư viện ML; mọi thứ thuần JS, chạy trên PC GPU hoặc Mac.
- Không dùng `fit-fish-blend-weights` (sự thật giả) cho w(d); đo bằng cá thật (mục 1 đợt 3.6) chỉ sau khi 2D có kết quả.

### 7.4 Kết quả 2A — nền "bãi cá theo mùa" (đo 2026-10-18 trên PC GPU, B = 500, cùng nhãn `dl-trk0809/labels-vh`)

> **Trạng thái: ĐÃ ĐO, CHƯA NỐI.** Chưa đụng `buildFishForecast`, chưa ghi `public/data`. Lưới nền `fish-base.v1.json` (12,6 KB) sinh NGOÀI repo (thư mục ghi chú phiên: `dot2a/`, kèm `honest-eval.json`, `fish-base-fit.json`, `tables.md`). Nền = 4 đặc trưng/(loài, ô, tháng): x-sản-lượng với **K_s riêng loài** (trung vị kg ô-tháng dương của lưới giữ-tháng-ra) · x-đội-tàu (60 giờ) · tĩnh (log-lift sâu+bờ+vĩ) · mùa vụ (`seasonPrior`). Gộp bằng logistic IRLS use-availability (dương = kg, âm = giờ nhóm nghề), **5 hệ số × 4 nhóm** (cá nổi lớn · cá nổi nhỏ · mực/bạch tuộc · còn lại), hệ số + bảng tĩnh fit trên **tháng KHÁC tháng chấm**, lưới x giữ-tháng-ra; hàng huấn luyện dùng cross-fit chẵn/lẻ khối 7 ngày cho kênh tĩnh. Cách thứ hai: rank-combine 0 hệ số (cộng hạng phân vị xc, xf, stat).

| cấu hình | AUCeff cũ (TB kg) | TRONG-NGHỀ (TB kg) | trong-nghề macro* | Δ bản chốt (kg) | Δ tĩnh (kg) | Δ M−1 kg/giờ (kg) | ô ≥50 | bậc 25-49÷0-24 · 50-74÷25-49 · ≥75÷50-74 | tàu lạ / quen (trong-nghề) |
|---|---|---|---|---|---|---|---|---|---|
| **nền logistic ≤5 hệ số/nhóm** | **0.823** [0.816–0.832] | **0.799** [0.792–0.806] | 0.782 | **+0.073** [+0.064…+0.081] | +0.021 [+0.018…+0.024] | +0.007 [−0.001…+0.017] | 12,3 % | 7,24 · 2,36 · **3,01** | 0.796 / 0.798 |
| nền rank-combine (0 hệ số) | 0.803 [0.796–0.810] | 0.778 [0.770–0.786] | 0.761 | +0.052 [+0.042…+0.062] | +0.001 [−0.003…+0.004] | −0.013 [−0.020…−0.004] | 12,6 % | 6,49 · 3,10 · 3,43 | 0.765 / 0.769 |
| nền logistic, bỏ kênh sản lượng (chế độ chưa có kg loài) | 0.809 [0.802–0.818] | 0.778 [0.771–0.786] | 0.764 | +0.052 [+0.043…+0.062] | +0.001 [+0.000…+0.002] | −0.013 [−0.020…−0.003] | 12,3 % | 7,17 · 2,53 · 2,12 | — |
| x-sản-lượng K_s theo loài (thuần) | 0.769 | 0.753 | 0.737 | — | — | — | 5,5 % | — | — |
| *tham chiếu:* bản chốt · x-sản-lượng 8000 · tĩnh · M−1 kg/giờ | 0.736 · 0.786 · 0.809 · 0.813 | 0.726 · 0.771 · 0.777 · 0.791 | 0.678 · 0.739 · 0.764 · 0.743 | | | | 12,5 % · 1,1 % · 51 % · 6,4 % | | |

**Cổng 2A:**

| cổng | kết quả | |
|---|---|---|
| (i) AUCeff ≥ max(0,809; 0,813) − 0,01 = 0,803 và CI Δ so bản chốt loại 0 | logistic: **0,823 (thang "cũ", thang của hai mốc 0,809/0,813)** ≥ 0,803; Δ bản chốt +0,073 CI loại 0. Trên thang TRONG-NGHỀ (chặt hơn) là 0,799 — mốc 0,803 do cổng viết theo thang cũ nên đọc literal trên thang này thì **thiếu 0,004**; so cùng thang vẫn hơn tĩnh +0,021 (CI loại 0) và hơn M−1 +0,007 (CI **không** loại 0). Rank-combine: 0,803 cũ — **trượt** (0,8026) và thua M−1 | **ĐẠT** (logistic, đọc theo thang của mốc); rank trượt |
| (ii) CPUE bậc đơn điệu, ≥75 ≥ 2× bậc 50–74 | gộp mọi loài 0,29 → 2,13 → 5,05 → 15,2 kg/giờ; ≥75÷50-74 = **3,01** [2,75–3,21]. Từng loài (12 loài lớn): cả 12 đơn điệu (mọi tỉ số >1; ngừ vằn ≥75÷50-74 = 1,10 [0,98–1,27] chạm 1) nhưng 6/12 chưa đạt ≥2× ở bậc cao nhất (ngừ vằn 1,10 · cá mối 1,06 · cá đổng 1,21 · mực nang 1,22 · mực ống 1,33 · ngừ ồ 1,55) | **ĐẠT** (gộp); từng loài chỉ 6/12 đạt ≥2× |
| (iii) % ô ≥50 ≤ bản chốt + 2 điểm | 12,3 % vs 12,5 % — **do hiệu chỉnh**: ngưỡng ≥50 đặt ở phân vị 1 − 12,5 % (biến đổi đơn điệu, không đổi AUC) | **ĐẠT** (theo cấu tạo) |
| (iv) tàu lạ/quen ≤ 0,01 | 0,796 vs 0,798 (chênh 0,002); lưới x dựng từ MỘT nửa tàu, hệ số + bảng tĩnh vẫn fit mọi tàu của tháng kia | **ĐẠT** |
| (v) ≤ 1 MB, cùng bundle, không thêm request | 12,6 KB (K_s 34 loài, 4×(5+4) hệ số, bảng tĩnh 34 loài); giá trị x theo ô vẫn đọc từ HAI lưới đã có qua `lib/fleet-effort.ts`; chưa có file nào trong `public/data` | **ĐẠT** |

**Đọc kết quả (5 dòng):**
1. Nền logistic **hơn bản chốt +0,073 trong-nghề (0,726 → 0,799, CI loại 0)** và ngang/trội hơn mọi baseline đơn giản (tĩnh 0,777, M−1 0,791): hơn tĩnh có ý nghĩa, hơn M−1 chỉ +0,007 (CI chạm 0) — **nền này là "x + tĩnh được trộn hợp lý", chưa phải dự báo mới.** Rank-combine không hệ số KHÔNG qua cổng (ngang tĩnh), nên chọn logistic: 20 hệ số tổng cộng, mỗi nhóm đúng 5.
2. **K_s trung vị riêng loài KHÔNG tự nó tốt hơn 8000 chung**: x-thuần 0,769 vs 0,786 (cũ) — K_s nhỏ làm x bão hoà sớm, nhiều ô ngang 1. Cái giúp là hệ số logistic học lại thang; đừng kể "K_s theo loài" như nguồn của mức tăng.
3. Kênh đội tàu có hệ số ÂM ở cá nổi lớn/đáy (−0,5…−0,6): mẫu âm của use-availability chính là giờ đánh nên x-đội-tàu cao = nhiều tàu hơn nhiều cá — nền đang ước CPUE, không ước "tàu đông". Tháng chưa có kg loài (bỏ xc): 0,778 trong-nghề, **ngang tĩnh**, tức là chế độ 11–12 chỉ còn chắc bằng tĩnh; payload phải ghi cờ `catchSameMonth` (file có sẵn, tháng 11 và 12 = false).
4. Bậc "Cao" của nền đơn điệu ở mức gộp (3,0×) — đáp Q5 tốt hơn bản chốt (4,05×, nhưng ở bản chốt phần lớn đến từ kênh sản lượng) — nhưng 6/12 loài lớn bậc ≥75 chưa gấp đôi 50–74 (cá nổi lớn/đáy gần như phẳng ở đỉnh), và CPUE vẫn là "bãi mùa này tàu cùng nghề bắt được nhiều" (N1: nhãn chia kg đều theo giờ), không phải "hôm nay cá nhiều".
5. Giới hạn: chỉ 2 tháng (hệ số fit trên MỘT tháng, chấm tháng kia) nên chưa có F3 chuỗi tiến (2B); ngưỡng 12,3 % là hiệu chỉnh chứ không phải kết quả; cổng (i) đọc theo thang cũ; chưa đo "cùng tháng năm trước" (Q2). Chưa nối vào `buildFishForecast`: cần quyết 2B/2C xong (nhãn v2 đo lại ≤0,01) trước khi ghi `public/data/fish-base.v1.json`.

**Khai sai có chủ đích (anh Long, sau đo):** (1) K_s đã là trung vị, không dùng trung bình. (2) `dl-eval-honest.mjs --trust-col <cột>` nhân kg với trọng số tin cậy của chuyến khi nhãn v2 có (mặc định 1; nhãn v2 đã nhân sẵn điểm tin cậy vào kg nên KHÔNG cần — xem §7.4b). (3) `--fleet-only "loài,loài"` dựng nền từ đội tàu + tĩnh + mùa cho loài có kg kém tin cậy; ghi vào `fleetOnly` của tệp nền. **Danh sách hiện RỖNG**: 34 loài trong lưới đều là loài ghép mã ASFIS rõ ràng (cá tạp/cá xô không có trong lưới), và dữ liệu không cho biết loài nào cấm/hạn chế — cần anh Long hoặc 2C (điểm tin cậy theo chuyến) chốt danh sách trước khi nối.

**Tệp:** `src/lib/fish-base.ts` (+ `__tests__/fish-base.test.ts`) · `scripts/fish-base-fit.mjs` · `scripts/fish-base-build.mjs` · `scripts/dl-eval-honest.mjs` (thêm `xc_ks`, `base_irls`, `base_rank`, `base_irls_nc`, rò#2 cho nền, cột tỉ lệ ô ≥50, bảng E; đường cũ không đổi). Chạy lại:
```bash
npx tsx scripts/dl-eval-fleet.mjs --honest --grids $D/fc-full/grids --labels $D/dl-trk0809/labels-vh --fleet-dir $D/fleet --catch-dir $D/catch --out <dir> --boot 500   # ra honest-eval.json + fish-base-fit.json (~6 phút)
npx tsx scripts/fish-base-build.mjs --fit <dir>/fish-base-fit.json --catch-grid $D/catch/catch-full.json --out <dir>/fish-base.v1.json
```

### 7.6 Kết quả 2C — nhãn v2 (dựng 2026-10-18 trên PC GPU, `dl-trk0809/labels-v2` + `dl-all/labels-v2-<khúc>`)

> **Trạng thái: nhãn v2 ĐÃ DỰNG, đường cũ giữ nguyên byte** (kiểm: `dl-build-labels` không cờ ra `effort/catch/catch-vessels` giống từng byte `labels-vh`; `build-fleet-effort-grid` không `--v2` ra `fleet-ex-2026-08.json` giống từng byte bản cũ). Nhãn cũ vẫn là thước của 2A/2B; muốn đo trên v2 dùng đường dẫn ở cuối mục. **3 trong 6 cổng ĐẠT, 3 KHÔNG đạt** — số thật bên dưới, không làm tròn theo hướng có lợi.

**Cổng nhãn** (nguồn: `labels-v2*/report.json`, mục `gates`; nhãn kiểm định = 8–9/2026, 5 khúc `dl-all` = 01–10/2026):

| cổng | trước | v2 | kết |
|---|---|---|---|
| giờ đánh / chuyến, 5 cửa sổ chênh < 20 % | 46 → 122 | **thô 64 · 94 · 110 · 107 · 90** (khúc 09–10 = 64) — chênh 1,7× nếu tính cả khúc cuối; **4 khúc trọn 90–110 (chênh ~20 %)**. Chuẩn theo giờ-có-VMS của chính chuyến (giờ đánh ÷ giờ chuyến): **0,301 · 0,339 · 0,331 · 0,319 · 0,352** (chênh 16 %) | ⚠ **đạt khi chuẩn hoá, KHÔNG đạt số thô** — giờ/chuyến thô còn theo độ dài chuyến (182–326 giờ/chuyến; khúc 09–10 bị cắt cụt vì chuyến dài chưa cập trước 11/10, `noTime`) chứ không còn theo định nghĩa |
| % giờ Rê ≤ 6 km một cảng | 12 % (khúc 05–06) | **0 %** ở mọi khúc (không thể khác: luật loại 10 km quanh MỌI cảng + IN/OUT). Đã loại **3,0–5,3 %** giờ Rê nằm trong dải mà ở cảng | ✅ |
| kg nghề "?" | 44 % | **2,3 – 3,7 %** (8–9: 2,8 %), tàu thu mua (13–19 % kg) đã ra khỏi nhãn | ✅ (≤ 12 %) |
| ρ(số đợt, haulCount) tàu NULL ≥ 0,35 | −0,02 | **−0,33** (8–9, n = 85 chuyến; khúc 09–10: −0,47 n = 65; các khúc khác n ≤ 22 vô nghĩa) | ❌ **KHÔNG đạt** — xem dòng 3 |
| tỉ lệ đợt/mẻ ∈ [0,7–1,5] | Rê 4× | Rê 3,8–6,9 · vây 3,5–5,2 · câu 3,0–6,2 · kéo 1,4–10,7 · chụp 1,4–4,2 (8–9: Rê 3,9 · vây 3,8 · câu 3,1 · kéo 2,0 · chụp 1,5) | ❌ **KHÔNG đạt** — dải chọn bằng ρ(giờ, haulCount) nên không ép số đợt; đợt vẫn gấp 3–4× mẻ ở rê/vây/câu |
| AUCeff trong-nghề bản chốt (`--honest`, nhãn v2, giữ-tháng-ra dựng lại) | 0,726 [0,714–0,741] | **0,713 [0,704–0,721]** (kiểu cũ 0,736 → **0,717**; bản mặc định có điểm tin cậy §7.6b) | không đòi tăng; giải thích dòng 4 |

**Đọc kết quả (5 dòng):**

1. **Định nghĩa "giờ đánh" đã MỘT**: bảng dải cả năm `scripts/fishing-bands.v2.json` (6 600 chuyến, bootstrap 100, ρ(giờ trong dải, haulCount)): vây 0,3–1 kn (ρ 0,33 [0,29–0,38]) · câu 0,6–5 (0,21 [0,14–0,29] — yếu, gần mức đường cơ sở 0,15) · rê 0,3–2 (0,39 [0,35–0,41]) · kéo 1–2,5 (0,45 [0,41–0,48]) · chụp 0,3–1 (0,21 [0,15–0,29]) · khác = dải gộp 0,3–2,5. **Độ ổn định chọn dải thấp** (cùng dải được chọn lại 13–45 % số lần bootstrap, trừ chụp 87 %): nhiều dải sát nhau cho ρ gần như bằng nhau; CI của ρ hẹp (±0,03) nên chọn *một* dải cố định là hợp lý, chọn theo *từng cửa sổ* thì sẽ nhảy lại. vmin = 0 chỉ còn vây ban đêm 18–06 giờ VN; mọi dải bắt đầu ≥ 0,3. Lưới đội tàu `--v2` dùng chung bảng, cảng 10 km, nghề suy và bỏ thu mua.
2. **Nghề tàu NULL**: Naive Bayes thuần JS (loài 80 mã + dài + công suất), N0 = 5 chọn trên xô 6–7 để phủ kg tối đa mà độ đúng trên phần phủ ≥ ngưỡng. Kiểm trên 20 % tàu giữ ra (xô 8–9, 5 407 tàu): đúng **64,6 %** 6 lớp (72 % theo kg; đoán lớp đông nhất 28 %); ở posterior ≥ 0,7: phủ 74 % tàu / **87 % kg**, đúng 71 % (76 % theo kg). Áp lên 2 208 tàu NULL ≥ 500 kg: suy được 1 653 tàu = 295 / 331 triệu kg (Kéo 165 · Vây 115 · Rê 9 · chụp 3 · khác 2). Cột `gs` = registry | inferred ở `effort.csv`/`catch.csv`. Bản số 68 % của báo cáo nhãn là trên một lần chia 80/20 khác; con số này đo lại trên xô băm cố định.
3. **Cổng ρ tàu NULL KHÔNG đạt và đây là kết quả thật, không phải lỗi đo**: ρ(đợt, haulCount) của chính nhóm tàu suy nghề là −0,33 (n = 85), tách theo nghề suy: kéo n = 51 ρ(đợt) 0,07 / ρ(giờ) 0,05 (đường cơ sở ρ(giờ chuyến) 0,35 **cao hơn** giờ-trong-dải); vây n = 28 ρ(giờ) 0,34; khác n = 6 −0,71. Nhóm này là tàu lớn (kéo/vây ≥ 24 m): với kéo đã đăng ký ≥ 24 m dải tốt nhất cũng là 1–6 kn với ρ chỉ 0,22 (kéo 15–24 m: 1–2,5 kn ρ **0,55**), và `haulCount` của tàu NULL (khả năng là cặp kéo đôi / tàu lớn khai mẻ theo nghĩa khác) không đo cùng thứ với tàu nhỏ. Nghĩa là: *vị trí giờ đánh của tàu NULL suy ra kéo/vây là điều CHƯA kiểm chứng được bằng haulCount* — đừng đọc "kg ? 44 → 2 %" như "nhãn tàu lớn đã đúng vị trí". Việc tiếp: bảng dải theo nghề × lớp dài (≥ 24 m riêng) và thước toạ độ mẻ (Q1).
4. **AUCeff bản chốt tụt 0,013 (trong-nghề 0,726 → 0,713) và baseline tĩnh LÊN 0,777 → 0,806**: cùng 61 ngày, cùng quy trình. Hợp với giả thuyết "điểm nóng đứng yên bền vững" của báo cáo nhãn Q6.3: nhãn mới bỏ giờ ở cảng/neo (8–9: 4 % giờ rê trong dải, 22 % giờ vây trong dải — 88 nghìn giờ trong 10 km một cảng + 33 nghìn giờ giữa IN/OUT) mà kênh đội tàu/sản lượng cũ được thưởng vì đoán trúng những chỗ đó, còn bản đồ tĩnh (sâu + bờ + vĩ) sạch hơn. Các số khác: HEAD 0,617 → 0,609 · đội tàu 0,660 → 0,652 · x-sản-lượng 0,771 → 0,768 · M−1 kg/giờ 0,791 → 0,793 · ngẫu nhiên 0,497. Cổng CPUE theo bậc (≥ 75 ÷ 50–74, gộp mọi loài) của bản chốt ×4,05 → **×3,27** [3,05–3,48]. Kết luận của §6 giữ nguyên: nền x/tĩnh/M−1 vẫn cao hơn bản chốt (+0,05…+0,09, CI loại 0).
5. **Bỏ ×0,5/×0,3/×0,7: ĐÚNG, và Huber cũng không mua thêm gì (nay tắt mặc định, `--huber` bật lại; thay bằng điểm tin cậy §7.6b).** Ablation cùng lưới, tổng kg chuẩn lại bằng nhau, AUCeff trong-nghề bản chốt: hệ số cũ **0,7148** · hệ số = 1 **0,7152** · Huber (mặc định v2) **0,7140** — chênh ≤ 0,0012 ≪ 0,003 ⇒ bỏ hẳn hệ số tay. Huber hạ trọng số 0–62 % kg tuỳ nghề × lớp dài (σ log-kg 0,9–1,9; ở kéo/khác/"?" hệ số của log(giờ chuyến) ≈ 0,6–1,1 còn của log(giờ trong dải) âm: kg đi theo độ dài chuyến hơn theo giờ đánh) nhưng không đổi AUCeff; nếu muốn gọn hơn nữa, `kg = trần p99 × 1` đủ. Tách riêng: tàu thu mua 13–19 % kg (2 522 chuyến 8–9) ra khỏi nhãn vị trí; 2 340 đơn vị cặp kéo đôi (5 324 tàu trong 2 662 cặp một-đối-một) gộp kg hai tàu chia theo giờ của cả hai.

**Tệp đã sửa / thêm** (chỉ `scripts/` + `src/lib/__tests__` + doc, không đụng `src/` logic, không commit):

| tệp | thay đổi |
|---|---|
| `scripts/fishing-def.mjs` (mới) | MỘT định nghĩa giờ đánh: lưới cảng 0,5° + `nearAnyPort` (10 km, đưa ra khỏi `build-fleet-effort-grid`), `bandAt` (vmin 0 chỉ vây ban đêm), `inPortIntervals` (tk.c IN/OUT), `fishingVerdict`; selftest |
| `scripts/fishing-bands.v2.json` (mới) | bảng dải cả năm + CI + nguồn/ngày/sha; dựng bởi `dl-calibrate-bands.mjs` |
| `scripts/dl-calibrate-bands.mjs` (mới) | dò dải bằng ρ(giờ trong dải, haulCount) + bootstrap 100 + `--probe` chẩn đoán lát cắt; selftest |
| `scripts/gear-infer.mjs` (mới) | Naive Bayes suy nghề, giữ 20 % tàu theo băm, ra `gear-map.json`; selftest |
| `scripts/dl-labels-v2.mjs` (mới) | dựng nhãn v2: thu mua, cặp kéo đôi (`--pairs-prep` từ `encounters/events.ndjson`), Huber, ablation, report cổng; selftest |
| `scripts/dl-build-labels.mjs` | cờ `--v2` (+ `--ports --bands --gear-map --encounters --pairs --ablate`) chuyển sang `dl-labels-v2.mjs`; không cờ ⇒ y nguyên byte |
| `scripts/build-fleet-effort-grid.mjs` | `--v2 [--gear-map]` dùng chung định nghĩa; hàm cảng/`hav`/`gearGroup` chuyển vào `fishing-def.mjs` (re-export, không cờ ⇒ y nguyên byte) |
| `src/lib/__tests__/dl-labels-v2.test.ts` (mới) | vitest 12 ca cho các hàm thuần trên |

**Dữ liệu dựng (NGOÀI repo, PC GPU `/mnt/c/Users/admin/sdfish-data/`):** `dl-all/{gear-map,pairs,bands-report}.json` · `dl-trk0809/labels-v2/` · `dl-all/labels-v2-2026-{01,03,05,07,09}-01/` (có thêm `catch-legacy.csv`, `catch-none.csv`) · `fleet-v2/` (`fleet-ex-<tháng>[-A|B]`, `fleet-full`) · `catch-v2/` (+ `-legacy/`, `-none/`) · `eval-v2{,-legacy,-none}/honest-eval.json`. Bản sao `report.json` (tổng hợp, không PII) ở thư mục ghi chú của phiên. **Không có `catch-null-ex-*`** (null-prod chưa làm cho v2) ⇒ rò#4 không có ở bản v2.

```bash
D=/mnt/c/Users/admin/sdfish-data; R=~/forlife/sdvico-data/data-local/datalake-iuu
node scripts/dl-labels-v2.mjs --pairs-prep --events $R/encounters/events.ndjson --out $D/dl-all/pairs.json
node scripts/gear-infer.mjs --dir $D/dl-all --out $D/dl-all/gear-map.json
node scripts/dl-calibrate-bands.mjs --dir $D/dl-all --ports $R/snapshots/2026-10-11/catalog-ports.json.gz --gear-map $D/dl-all/gear-map.json --boot 100 --report $D/dl-all/bands-report.json
node --max-old-space-size=9000 scripts/dl-build-labels.mjs --v2 --dir $D/dl-all --from 2026-01-01 --to 2026-10-11 --window <a>,<b> --ablate --ports $R/snapshots/2026-10-11/catalog-ports.json.gz --encounters $R/encounters/vessels.json --gear-map $D/dl-all/gear-map.json --pairs $D/dl-all/pairs.json --out $D/dl-all/labels-v2-<a>   # ~2,5 phút/khúc; nhãn kiểm định: --dir $D/dl-trk0809 --from 2026-08-01 --to 2026-09-30 bỏ --window/--ablate
node scripts/build-fleet-effort-grid.mjs --root <datalake-iuu> --snapshot 2026-10-11 --v2 --gear-map $D/dl-all/gear-map.json --exclude-month 2026-08 --out $D/fleet-v2/fleet-ex-2026-08.json
node scripts/build-species-catch-grid.mjs --labels <5 labels-v2> --exclude-month 2026-08 --out $D/catch-v2/catch-ex-2026-08.json
# ⚠ fc-full/grids nay có 10 tháng (2B backfill) — dl-eval-fleet đòi lưới giữ-tháng-ra cho MỌI tháng có ảnh ⇒ trỏ vào thư mục chỉ có 08–09 (~/fish-eval-r1/grids-0809, symlink)
npx tsx scripts/dl-eval-fleet.mjs --honest --grids ~/fish-eval-r1/grids-0809 --labels $D/dl-trk0809/labels-v2 --fleet-dir $D/fleet-v2 --fleet-full $D/fleet-v2/fleet-full.json --catch-dir $D/catch-v2 --out $D/eval-v2 --boot 500
```

**Giới hạn:** (a) bảng dải theo nghề, chưa theo lớp dài — kéo/vây ≥ 24 m cần dải riêng (xem dòng 3); (b) `haulCount` chỉ 2,7 % nhật ký và nay còn là thước duy nhất cho dải cả năm; nhãn vẫn không phân giải trong chuyến (N1) nên cổng AUC không chứng minh vị trí; (c) chuyến dài chưa cập trước 11/10 vắng ở khúc 09–10; (d) cặp kéo đôi chỉ nối khi cả hai tàu có chuyến dùng được trong cùng khúc; (e) lưới đội tàu `--v2` chưa cắt IN/OUT (track tháng không mang tk.c), chỉ cảng 10 km; (f) khúc đầu năm có rất ít chuyến NULL có haulCount (n ≤ 22) nên ρ NULL theo khúc không đọc được, chỉ 8–9 (n = 85) và 09–10 (n = 65) có nghĩa.

### 7.5 Kết quả 2B — bộ đo cho lớp cộng thêm (2026-10-18, chưa commit, chưa fit lại hồ sơ nào để áp)

**Ba dòng đọc**
1. **Cổng tốc độ ĐẠT, cổng nhận-oan chỉ đạt khi thêm đối chứng ĐỘNG.** 1 loài × 61 ngày từ 429 s (ngừ vằn, nhãn lệch, PC, chạy 4 loài song song; TB 10 loài 628 s) xuống **2,4 s** (cả lượt gồm nạp nhãn 6,3 s); 10 loài × 264–279 ngày × 5 nếp + chuỗi tiến 415–716 s. Quy trình mới đúng-chữ-nhiệm-vụ (CI 90 % bootstrap khối 7 ngày > 0 + BH q = 0,1 trên chênh thô) vẫn **NHẬN 5/10 loài** trên 61 ngày và **4/10** trên 10 tháng khi nhãn lệch 15 ngày — hồ sơ học được *hình học bãi theo mùa* (nhãn lệch ngày cũng thấy), không phải tín hiệu ngày. Thêm điều kiện chênh **ĐỘNG** (chênh fit−gốc trên nhãn thật trừ chênh trên nhãn lệch ±15 ngày, cùng ngày thử, cùng bootstrap) thì **0/10** ở cả hai cỡ mẫu. Đối chứng động là cái tôi thêm, chưa được lead chốt: `--accept raw|dyn` (mặc định dyn).
2. **Trên nhãn THẬT, vệ tinh của ngày cũng không thêm được gì khi nền đã có hai kênh tĩnh.** 10 tháng, 5 nếp 2 tháng đệm 15 ngày: chênh thô dương ở 6/10 loài (cá đổng +0,049, ngừ chù +0,036, cá mối +0,019, chỉ vàng +0,020, cá nục +0,016, mực xà +0,004) nhưng chênh ĐỘNG CI 90 % chứa 0 ở cả 10 loài (ngừ chù +0,017 [−0,004…+0,042] là gần nhất; bạch tuộc −0,002 [−0,003…−0,000]) ⇒ **0/10 NHẬN**. Nếp 01+02 tụt mạnh (cá nục 0,639→0,531; ngừ vằn 0,743→0,559) vì hồ sơ fit trên tháng khác mùa gió. Chuỗi tiến F3 (tháng M ← các ngày trước M−15, lưới tĩnh của M vẫn có tháng sau nên là cận trên) vẫn dương ở cá nục/cá mối/cá đổng/ngừ chù (+0,01…+0,10 các tháng sau) — cùng phần "hình học bãi", không phải động.
3. **Hai số phụ của §7.0 đã chạy được và nói cùng một điều.** AUC cục bộ 1°×1° của lớp vệ tinh + hai kênh tĩnh chỉ **0,51–0,60** (ngẫu nhiên = 0,5; chỉ cá cơm 0,58→0,60 và ngừ chù 0,57→0,58 nhích), Spearman dị thường ngày × ô **|ρ| ≤ 0,043** ở cả 10 loài, nhãn thật và nhãn lệch cho cùng độ lớn (ví dụ cá nục ρ 0,015 vs −0,011) ⇒ trong một bãi, ảnh vệ tinh hôm nay không xếp được ô nào hơn ô nào bằng nhãn này (nhớ N1: kg chia đều theo giờ trong chuyến, nên đây là cận dưới; **không** đọc là "vệ tinh vô dụng").

**Bảng kết quả**

| | trước | sau | cổng |
|---|---|---|---|
| 1 loài × 61 ngày, lưới 8–9/2026 (PC GPU) | 429–980 s (TB 628 s) | 2,4 s dò + 3,9 s nạp nhãn/khởi động | ≤ 60 s ✔ |
| 1 ngày lưới, 1 loài, `buildFishForecast` lặp (Mac) | 81,7 ms | 23,0 ms (memo `spatialAnomaly`/`coastDistanceKm`/front) | — |
| 10 loài × 264–279 ngày, 5 nếp + F3 (PC) | — | 415 s (716 s kèm `--local`) | — |
| `buildFishForecast` y hệt bản cũ | — | digest 3 ngày lưới tổng hợp khớp; `npm test` 5040 xanh | ✔ |
| Nhận-oan, nhãn lệch 15 ngày, 10 loài | 3/10 (hồ sơ nay), 8/10 (hồ sơ gốc) — §6.3 | luật thô: **5/10** (61 ngày) · **4/10** (10 tháng) · luật động: **0/10** · **0/10** | ≤ 1/10: ✔ chỉ với luật động |
| Nhãn thật, 10 loài | — | thô 2/10 (61 ngày) · 6/10 (10 tháng); động 0/10 · 0/10 | — |

Ghi chú: "gốc" ở đây = HSI hiện tại CÓ hai kênh tĩnh giữ-tháng-ra, AUC trong-nghề, chỉ ô trong vụ của loài (cá nục 0,722 · ngừ vằn 0,734 · ngừ chù 0,727 trên 10 tháng; ngừ vằn 0,795 trên 8–9) — không đọc chéo với bảng §6.1; so với nền 2A phải chạy chung một `evaluate`.

**Lưới vệ tinh backfill (ERDDAP, `fish-validate-run.mjs --features full --shift 0`, 638 s):** 289/290 ngày có đủ SST + phù du + SSHA + dị thường + front mịn.

| tháng | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 (đến 17/10) |
|---|---|---|---|---|---|---|---|---|---|---|
| có / tổng | 31/31 | 28/28 | 31/31 | 30/30 | 31/31 | 30/30 | 31/31 | 31/31 | 30/30 | 16/17 |

Thiếu duy nhất: **2026-10-17** (NOAA chưa có SST — bản NRT trễ). Không bịa, không dịch ngày (`--shift 0`). Lưu ý: nguồn tháng 01–07 là bản reprocessed giống 8–9, còn production dùng NRT + HYCOM + Copernicus; hồ sơ tầng đáy/250 m vẫn chưa fit được đúng (README §7 `report-fit-method`).

**Danh sách file** (không commit; trên Mac, `src/` đồng bộ sang `~/fish-eval-r2` của PC GPU để chạy)
- `src/lib/fish-predict.ts` — tách `buildCellFeatures` / `seasonWeights` / `cellHabitat` / `scoreCell`, memo theo tham chiếu lưới, `extra.rawScores`, kiểu `FishForecastExtra`. Không đổi hành vi/payload (digest snapshot).
- `src/lib/__tests__/fish-cell-features.test.ts` (snapshot 3 ngày lưới tổng hợp + `scoreCell` = `buildFishForecast` + `rawScores`), `src/lib/__tests__/fish-fit-scripts.test.ts` (selftest các script).
- `scripts/fish-features-cache.mjs` (mới) · `scripts/fish-fit-lib.mjs` (mới) · `scripts/fish-metrics-local.mjs` (mới) · `scripts/dl-fit-profiles.mjs` (viết lại; `--label-shift` giữ nguyên nghĩa).
- Doc: `docs/app-map/02-architecture.md`, `docs/app-map/ops/fish-validate-positions.md` (§9.x), README này.
- Dữ liệu ngoài repo (PC GPU `/mnt/c/Users/admin/sdfish-data/`): `fc-full/grids` 61 → 290 ngày, `fc-full/features` (56 MB, 289 ngày), `fleet/fleet-ex-<tháng|cặp tháng>.json` + `catch/catch-ex-…` cho 10 tháng + 5 nếp (dựng bằng script dot1), `fit2/` (kết quả). Log: thư mục ghi chú của phiên.

**Chưa làm / giới hạn:** (a) chưa nối vào `dl-eval-honest.mjs` (2A giữ) nên Δ trong-nghề so nền 2A chưa có — `fish-metrics-local.mjs` và `recMetrics` của `fish-fit-lib.mjs` là hàm thuần, 2D nối được; (b) `--local` chỉ tính ô trong vụ của loài (khối lượng nhãn ở ô ngoài vụ không có toạ độ trong cache); (c) bản cũ so với bản mới cùng điểm làm tròn+cắt 25 (`--legacy-score`) lệch 0,005–0,015 AUC eff vì bản mới chỉ lấy kg của nghề mục tiêu làm pos — chưa đối chiếu chính xác từng ô; (d) lưới tĩnh F3 vẫn là `ex-<tháng M>` (có tháng sau), cần `fleet-ex-fwd-<M>` nếu muốn chuỗi tiến thuần; (e) 15 hồ sơ đã áp chưa chạy lại qua quy trình mới (đúng chỉ đạo §7.3).

### 7.6b Điểm tin cậy theo chuyến — luật "khai sai CÓ CHỦ ĐÍCH" (§7.2b), đo 2026-10-18

> **Nhãn v2 mặc định nay có điểm tin cậy** (`--v2`, không cờ thêm), dựng từ tín hiệu ĐỘC LẬP với lời khai (VMS, sổ tàu, encounters, bảng cảng, tk.c). Mỗi tín hiệu đo % chuyến / % kg dính trước, rồi ablation AUCeff trong-nghề (bản chốt, cùng lưới, tổng kg chuẩn lại) mới quyết trọng số. **Nhãn sẽ nghiêng về tàu khai thật**: kẻ khai sai khéo (không để lại dấu VMS/sổ tàu/encounters) vẫn lọt; AUCeff không "nhìn thấy" lời nói dối nên ablation chỉ cho biết một tín hiệu có làm hỏng nhãn hay không, không chứng minh nó bắt được kẻ gian.

| tín hiệu (mã) | cách dựng | % chuyến | % kg | xử lý | ablation (bản chốt − tắt tín hiệu) |
|---|---|---|---|---|---|
| **a1_gap** giấu vị trí | VMS đứt > 4 giờ ngoài khơi (không ở cảng/IN-OUT) cộng ≥ 12 giờ | 0,5–1,4 % | 0,2–1,4 % | **loại khỏi nhãn vị trí** (kg → nhóm "không có vị trí") | giữ bất kể |
| a2_flag | cờ `KHONG_CO_THIET_BI` / `MAT_TIN_TU_*` của chuyến | **0 %** (chuyến dùng được đã có VMS, cờ này nằm ở chuyến bị loại từ `noVms`) | 0 | loại nếu có | giữ bất kể |
| **a3_eez** | ≥ 6 giờ ngoài vòng vùng biển VN dựng từ `src/data/vn-maritime-border.ts` (đóng vòng qua đất liền; chỉ là phép thử SƠ — nguồn ghi rõ là tuyến cảnh báo, không phải ranh pháp lý) | 0,01–0,16 % | ≤ 0,08 % | loại khỏi nhãn vị trí | giữ bất kể |
| **b_tap** giấu loài | tỉ trọng Cá Tạp/Cá Xô/Loài Khác > p95 của nghề × lớp dài × vùng khai (sàn 0,5) | 1,3–2,0 % | 1,9–3,2 % | mã loài → `UNK`: kg chỉ vào tổng nghề, không vào lưới loài | giữ bất kể |
| c1_cap | kg/giờ > p99 nghề đã suy | 0,7 % | 4–6 % | kéo về p99 (đã có) | — |
| c6_nofish | có kg mà không có đoạn đánh | 2,6–3,5 % | 6,8–9,7 % | loại (đã có) | — |
| c2_repeat | dấu vân tay loài+kg lặp ở chuyến trước cùng tàu | 0,4–0,8 % | 0,1–0,9 % | ×1/(1+0,5·số lần lặp), sàn 0,3 | **−0,0000** ⇒ giữ (lý do nghiệp vụ: chép nhật ký là dấu hiệu rõ nhất) |
| c3_round | một loài, kg tròn trăm, ≥ 500 | 2,0–3,0 % | 2,3–6,7 % | ×0,8 | −0,0002 ⇒ giữ (lý do nghiệp vụ) |
| c4_mismatch | landed ≠ catch quá 2 lần | 0,1–0,8 % | 0,1–3,9 % | ×2/tỉ lệ, sàn 0,3 | +0,0002 ⇒ giữ (lý do nghiệp vụ) |
| d1_port | cảng bốc dỡ khai cách điểm VMS cuối > 50 km | 3,7–7,9 % | 4,2–11,9 % | ×50/km, sàn 0,3 | +0,0014 (< 0,003) ⇒ giữ (lý do nghiệp vụ: khai cảng sai) |
| **c5_carrier** | tàu có ≥ 1 nghi chuyển tải với đối tác thu mua | **13–16 %** | 20–24 % | **chỉ ghi cờ, KHÔNG hạ trọng số** | tắt tín hiệu làm AUCeff **tăng** 0,0021 (< 0,003): quá rộng để là dấu hiệu "rửa kg" (cần sức chở/biên lai — chưa có trong DataLake) |
| **d2_time** | giờ cập khai lệch giờ cập VMS > 12 giờ | **33–51 %** | 34–52 % | **chỉ ghi cờ, KHÔNG hạ trọng số** | −0,0004 ≈ 0: lệch hệ thống (đồng hồ KSTC), không phải bằng chứng khai gian |

Hiệu ứng tổng: điểm trung bình theo kg 0,67–0,77 với đủ 6 tín hiệu. Ablation (mọi biến thể chuẩn lại để TỔNG kg bằng nhau, nếu không mức bão hoà `CATCH_FULL_KG` làm lệch): không trọng số **0,7096** · 6 tín hiệu 0,7070 (−0,0026) · tắt riêng từng tín hiệu 0,7066–0,7091 (cột cuối). Bản mặc định 4 tín hiệu (c2, c3, c4, d1) đo riêng ở **0,713**, nhưng con số này KHÔNG so thẳng được với hàng trên (tổng kg khác, không chuẩn lại) — chỉ đọc là "cùng mức, trong sai số 0,01". Điểm tin cậy **không** đổi chất lượng AUC trong sai số, và đó là điều phải đọc đúng: AUCeff đo bằng nhãn có sẵn, không có "sự thật" về ai khai gian. Lý do giữ tín hiệu dựa vào bằng chứng độc lập và lý do nghiệp vụ, không dựa vào AUC.

**Chưa làm / hạn chế (nói thẳng):** (1) **vùng cấm / loài cấm hạn chế vắng hệ thống** — chưa có danh sách loài cấm theo nghề × vùng trong dữ liệu; (2) **sức chở tàu** (`vessels.ndjson`) chưa nạp — c1 dùng p99 nghề × lớp dài thay cho vượt sức chở; (3) kiểm "track ngoài EEZ" dùng tuyến cảnh báo, hàm `pointInRing` + vòng đóng qua đất liền, chưa phải EEZ pháp lý; (4) đối tác "carrier" lấy từ `topPartners` (tối đa 10), nên c5 thiếu; (5) lưới đội tàu `--v2` KHÔNG áp loại a1/a3 (dựng từ track thô, không có điểm tin cậy) — nhẹ (≤ 1,4 % chuyến); (6) nhãn nghiêng về tàu khai thật như trên. Lý do từng chuyến: `trust-trips.csv` cạnh nhãn (cột `trip` = sha256 10 hex của mã chuyến, không PII); tổng hợp ở `report.json` mục `trust` (+ `noPosition.hidden*`). Cờ: `--signals c2_repeat,c3_round,c4_mismatch,d1_port,c5_carrier,d2_time|none` · `--hide a1_gap,a2_flag,a3_eez|none` · `--huber`; `--ablate` ghi `catch-no-<tín hiệu>.csv`.

## 7.7 Kết luận lead sau 2A + 2B + 2C (2026-10-18 tối) — chờ anh Long chốt

**Ba mảnh nói cùng một điều, bằng ba đường đo độc lập:**
1. **Nền "bãi theo mùa" (2A)** là thứ tốt nhất đang có: trong-nghề 0,799 trên nhãn cũ (bản chốt 0,726; tĩnh 0,777; M−1 0,791), 5/5 cổng. Nhưng chỉ hơn M−1 +0,007 (CI chạm 0) ⇒ nó là "x + tĩnh trộn hợp lý", không phải dự báo mới. Đang đo lại trên nhãn v2 (§7.4b).
2. **Lớp vệ tinh của ngày (2B)** với nhãn hiện có: 0/10 loài qua đối chứng động trên cả 61 ngày lẫn 10 tháng; AUC cục bộ 1° chỉ 0,51–0,60; Spearman dị thường |ρ| ≤ 0,043 — nhãn thật và nhãn lệch 15 ngày cho cùng độ lớn. Quy trình fit cũ NHẬN 4–5/10 loài trên nhãn LỆCH (học hình học bãi, không học tín hiệu ngày). **Lead chốt luật nhận = đối chứng ĐỘNG (`--accept dyn`)** làm chuẩn từ nay: tham số chỉ được nhận khi thắng trên nhãn thật *hơn* mức nó thắng trên nhãn lệch ngày.
3. **Nhãn v2 (2C)** sạch hơn (kg "?" 44 → 3 %, giờ ở cảng/neo 0 %, tàu thu mua ra khỏi nhãn vị trí, điểm tin cậy theo chuyến) và lập tức làm bản chốt TỤT (0,726 → 0,713) còn tĩnh TĂNG (0,777 → 0,806): kênh đội tàu/sản lượng cũ từng được thưởng vì đoán trúng chỗ neo đậu. Hai cổng chưa đạt (ρ tàu NULL −0,33; đợt/mẻ 3–4×) nói thẳng: **vị trí giờ đánh của tàu lớn suy nghề CHƯA kiểm chứng được** bằng haulCount — chỉ toạ độ mẻ (Q1) mới trả lời.

**Hệ quả cho kế hoạch (đề xuất, chờ chốt):**
- **2D (thí nghiệm residual) BỎ ở dạng hiện tại** — 2B đã chạy đúng thí nghiệm đó trên 10 loài × 10 tháng với kết quả 0/10; làm lại với tầng residual trên cùng nhãn chỉ ra cùng số. 2D chỉ có nghĩa khi nhãn phân giải được trong chuyến (toạ độ mẻ).
- **Nối nền 2A vào production** sau khi §7.4b (nhãn v2) qua cổng và có F3 chuỗi tiến thuần (lưới `fleet-ex-fwd-<M>`): lớp cá = nền bãi theo mùa; HSI/vệ tinh giữ vai trò "dấu hiệu hôm nay" hiển thị tách bạch, **không nâng điểm** cho tới khi có bằng chứng.
- **2E (sản phẩm + doc)** làm ngay sau: 01-product (lời hứa Trục 1), 07 design-spec (hai lớp), tier.ts (cái bán), §9 ghi nợ 15 hồ sơ.
- **2F (vận hành)** chạy song song; commit toàn bộ đợt 2 lên `feat/fish-train-dot2` khi anh Long bảo.
- Nghiệp vụ: **Q1 toạ độ mẻ là việc số một** — cả ba mảnh đều dừng ở cùng bức tường N1.

### 7.4b Nền 2A trên nhãn v2 (đo 2026-10-18, cùng quy trình §7.4, B = 500)

> Nhãn `dl-trk0809/labels-v2`, lưới giữ-tháng-ra `fleet-v2`/`catch-v2`, 61 ngày 8–9/2026. Số thô: thư mục ghi chú phiên `dot2a-v2/` (`honest-eval.json`, `fish-base-fit.json`, `fish-base.v1.json` 12,5 KB, `tables.md`) — NGOÀI repo, chưa ghi `public/data`. **`--trust-col` không cần dùng:** điểm tin cậy của 2C đã nhân sẵn vào cột `kg` của `catch.csv` v2 (cột `trust-trips.csv` chỉ để tra chuyến); chạy nhãn v2 nguyên trạng. `--fleet-only` để TRỐNG (2C: không loài nào toàn cá tạp trong lưới, `UNK` đã tách). Lưới v2 có 32 loài (§7.4 là 34); n_eff ≥ 200 còn 21/34 loài đo.

| cấu hình | AUCeff cũ | TRONG-NGHỀ | trong-nghề macro* | Δ bản chốt v2 | Δ tĩnh v2 | Δ M−1 kg/giờ v2 | ô ≥50 | bậc 25-49÷0-24 · 50-74÷25-49 · ≥75÷50-74 | tàu lạ / quen |
|---|---|---|---|---|---|---|---|---|---|
| **nền logistic ≤5 hệ số/nhóm** | **0.815** [0.810–0.821] | **0.810** [0.805–0.817] | 0.787 | **+0.097** [+0.092…+0.105] | +0.004 [+0.004…+0.007] | +0.017 [+0.011…+0.027] | 11,3 % | 7,30 · 2,78 · **2,19** [1,77–2,59] | 0.809 / 0.811 |
| nền rank-combine (0 hệ số) | 0.789 | 0.778 [0.771–0.786] | 0.749 | +0.065 [+0.059…+0.071] | −0.027 [−0.031…−0.024] | −0.014 [−0.023…−0.006] | 11,5 % | 6,82 · 3,41 · 2,65 | 0.762 / 0.767 |
| nền logistic, bỏ kênh sản lượng | 0.807 | 0.803 [0.798–0.809] | 0.780 | +0.090 [+0.085…+0.097] | −0.003 [−0.004…−0.001] | +0.010 [+0.003…+0.020] | 11,3 % | 7,84 · 2,07 · 2,32 | — |
| x-sản-lượng K_s theo loài (thuần) | 0.763 | 0.755 | 0.723 | | | | 5,0 % | | |
| *tham chiếu v2:* bản chốt · tĩnh · M−1 kg/giờ · x-sản-lượng 8000 | 0.717 · 0.811 · 0.797 · 0.776 | 0.713 · 0.806 · 0.793 · 0.768 | 0.640 · 0.780 · 0.739 · 0.724 | | | | 11,5 % · 51 % · 6,0 % · 0,8 % | | |

**Cổng 2A trên nhãn v2:** (i) trong-nghề 0,810 ≥ tĩnh v2 0,806 − 0,01 và ≥ M−1 v2 0,793 − 0,01 **ĐẠT** — cùng thang, hơn tĩnh +0,004 (CI loại 0 nhưng chỉ cận 0,004) và hơn M−1 +0,017 (CI loại 0); Δ bản chốt v2 +0,097 CI loại 0. (ii) bậc đơn điệu, gộp ≥75÷50-74 = **2,19** ≥ 2 **ĐẠT** nhưng sát (CI dưới 1,77); từng loài lớn 6/12 ≥ 2× (cá nục 2,33 · mực xà 8,24 · cá cơm 3,65 · bạch tuộc 2,05 · cá hố 2,04 · bạc má 5,83), ngừ ồ 0,98 · mực nang 1,00 · cá mối 1,06 · cá đổng 1,12 phẳng ở đỉnh. (iii) 11,3 % vs 11,5 % **ĐẠT** (do hiệu chỉnh). (iv) lạ 0,809 vs quen 0,811 (0,002) **ĐẠT**. (v) 12,5 KB **ĐẠT**. Rank-combine trượt (thua tĩnh −0,027). **5/5 cổng đạt.**

**Đọc (5 dòng):**
1. Nhãn v2 làm bản chốt tụt (0,726 → 0,713) nhưng nền logistic tăng (0,799 → 0,810): nền ăn nhãn sạch tốt hơn mô hình cũ, Δ bản chốt nở từ +0,073 lên +0,097.
2. Khoảng cách với **tĩnh v2 chỉ còn +0,004** (tĩnh v2 nhảy 0,777 → 0,806 vì nhãn sạch hơn): phần "thêm" của x-sản-lượng + x-đội-tàu trên tĩnh rất mỏng; nền này về thực chất là *tĩnh có hiệu chỉnh theo mùa/tàu*. Tháng chưa có kg (bỏ xc) ngang tĩnh (−0,003, CI loại 0 về phía thua).
3. Hơn M−1 rõ hơn (+0,017 vs +0,007) vì M−1 gần phẳng (0,791 → 0,793) còn nền tăng 0,799 → 0,810.
4. Bậc "Cao" gấp 2,19× bậc dưới (§7.4: 3,01×) — đơn điệu nhưng yếu hơn, 4/12 loài lớn phẳng ở đỉnh: đừng viết "Cao = cá nhiều gấp đôi" cho từng loài. K_s theo loài vẫn kém x 8000 khi đứng một mình (0,755 vs 0,768).
5. Giới hạn như §7.4 (2 tháng, hệ số fit một tháng, ngưỡng nóng hiệu chỉnh, chưa F3 chuỗi tiến); thêm: điểm tin cậy nằm trong kg nên không tách được tác dụng riêng của nó trên nền. Chưa nối.

```bash
npx tsx scripts/dl-eval-fleet.mjs --honest --grids ~/fish-eval-r1/grids-0809 --labels $D/dl-trk0809/labels-v2 --fleet-dir $D/fleet-v2 --fleet-full $D/fleet-v2/fleet-full.json --catch-dir $D/catch-v2 --out <dir> --boot 500
```

**QUYẾT 2026-10-19 (anh Long: "hoàn thiện đi", sau 2D §7.8 — 0/30 thắng, HSI gộp noisy-OR làm HẠI nền):**
- NỐI NỀN 2A vào production: `s`/`sp` = điểm nền theo loài × ô × tháng (nhãn v2, §7.4b); HSI/vệ tinh thành `hint` ("dấu hiệu hôm nay") tách khỏi điểm, KHÔNG nâng điểm; cổng nhiệt + mùa vụ giữ làm cổng cứng; tháng chưa có kg loài ⇒ `baseMode: "fleet-static"`. Giao 2A (§7.9).
- 2F vận hành chạy song song (§7.10). 2E (01-product, 07 design-spec, tier) lead làm sau khi có hình dạng payload.
- Luật nhận tham số = đối chứng ĐỘNG; mọi lớp "hôm nay" sau này phải thắng đủ bốn tiêu chí của §7.0 trước khi được nâng điểm.
- Việc nghiệp vụ còn mở: Q1 toạ độ mẻ (thước duy nhất cho tín hiệu ngày), Q2 nhãn 2025, Q3 đường hầm DataLake.

### 7.8 Kết quả 2D — lớp vệ tinh có thêm được gì trên nền 2A? (đo 2026-10-19, PC GPU, chưa commit, không nối production)

> **Kết luận: 0/30 tổ hợp THẮNG** (3 nhánh × 5 loài × 2 sơ đồ). Không tổ hợp nào qua nổi cổng đầu (Δ trong-nghề ≥ +0,01): Δ lớn nhất của nhánh residual là +0,000. Luật nhận = đối chứng ĐỘNG (`--accept dyn` của §7.5; ở đây chênh động tính trên nhãn lệch ±15 ngày). Số thô + CI đầy đủ: `2d-result.json` (thư mục ghi chú phiên, `dot2d/`).

**Cách đo (đúng như giao, kèm các chỗ tôi phải chọn):**
- Nền 2A: bốn đặc trưng [x-sản-lượng K_s riêng loài, x-đội-tàu 60 giờ, tĩnh log-lift sâu/bờ/vĩ, mùa vụ] → logistic IRLS ≤5 hệ số × 4 nhóm loài, bảng tĩnh cross-fit chẵn/lẻ khối 7 ngày, **nhãn v2** (đã nhân điểm tin cậy), lưới giữ-tháng-ra **v2** dựng thêm cho 10 tháng + 5 nếp 2 tháng + 9 lưới tiến `fwd-<M>` (chỉ tháng < M; 28 tệp mỗi loại, lệnh ở `exv2.sh` của phiên). Chấm = hạng trong ngày của điểm tuyến tính. **Tôi dựng lại nền trong `fish-2d-experiment.mjs` từ các hàm của `fish-base.ts`** (không sửa `dl-eval-honest.mjs`) nên nền ở đây (0,73–0,92 tuỳ loài) **không đọc chéo được** với 0,810 của §7.4b (khác tập ô — chỉ ô trong cache — và pos = tổng kg nghề mục tiêu).
- Sơ đồ: **5 nếp** = cặp tháng lịch 01+02…09+10, đệm 15 ngày, fit trên các nếp còn lại; **F3** = tháng M (03…10) chấm bằng fit trên ngày ≤ đầu M−15, lưới tĩnh của cả test lẫn train là `fwd-` (không còn tháng sau).
- (a) `1 − (1 − fitSat)(1 − CATCH_SCALE·điểmNền/100)`, `fitSat = scoreCell` với HAI kênh tĩnh của HSI TẮT (nền thay chúng), hồ sơ loài hiện tại nguyên trạng. (b) logit = nền_raw + β0 + Σβk·zk, 8 dị thường theo trung bình tháng **của ô** (SST, log chl, front nhiệt, front mồi, |xoáy|, nước trồi, hội tụ, tầng nhiệt; cấm vĩ/kinh/sâu/bờ), dấu βk theo hồ sơ loài (trọng số cơ chế = 0 ⇒ loại; SST theo tâm cao nguyên so khí hậu vùng-tháng), ridge 0,01 cố định (không CV trong), zk thiếu ⇒ 0; cache lịch sử **không có dòng chảy/D20** nên hội tụ và tầng nhiệt luôn bằng 0 ⇒ thực chất 6 dị thường + β0 (≤ 9 số). (c) cùng cơ chế với 3 cột [front nhiệt, SST, log chl] + β0. Dị thường lấy trung bình tháng của ô trên **toàn bộ chuỗi cache** (không dùng nhãn nhưng có cả ngày thử).
- Số đo: Δ AUCeff trong-nghề so nền (bootstrap khối 7 ngày, B = 300), Δ động = (Δ trên nhãn thật) − (Δ trên nhãn lệch ±15 ngày), Δ AUC cục bộ 1°×1° (cặp pos/neg cùng khối cùng ngày, TB khối theo kg; Δ bootstrap khối 7 ngày), Spearman dị thường ngày × ô của chính nhánh (ô-ngày ≥ 6 giờ, ô ≥ 3 ngày; p = bootstrap khối 7 ngày, một phía), % ô ≥ 50 (nền và (b),(c): 11,3 % theo cấu tạo vì ngưỡng đặt ở phân vị; (a): đo thật trên điểm noisy-OR ≥ 0,5). THẮNG = đủ cả bốn + ô ≥50 ≤ nền + 2 điểm.

**F3 chuỗi tiến thuần (số báo cáo cho "tháng sau")**

| loài (nền trong-nghề) | nhánh | Δ vs nền [CI 90 %] | Δ ĐỘNG [CI] | Δ AUC 1° [CI] | ρ dị thường (p) | ô ≥50 | kết |
|---|---|---|---|---|---|---|---|
| ngừ vằn (0.764) | (a) nền+HSI | -0.064 [-0.081…-0.050] | -0.003 [-0.015…+0.009] | -0.006 [-0.010…-0.003] | +0.012 (0.20) | 37.8 % | thua |
| ngừ vằn (0.764) | (b) nền+residual 8 | -0.002 [-0.006…+0.001] | -0.002 [-0.005…+0.000] | -0.001 [-0.003…+0.000] | -0.002 (0.58) | 11.3 % | thua |
| ngừ vằn (0.764) | (c) nền+3 dị thường | -0.002 [-0.006…+0.001] | -0.002 [-0.005…+0.000] | -0.001 [-0.003…+0.000] | -0.001 (0.53) | 11.3 % | thua |
| cá nục (0.785) | (a) nền+HSI | -0.036 [-0.048…-0.027] | -0.006 [-0.019…+0.006] | -0.017 [-0.027…-0.006] | +0.007 (0.32) | 14.7 % | thua |
| cá nục (0.785) | (b) nền+residual 8 | -0.000 [-0.001…+0.001] | +0.001 [-0.000…+0.002] | -0.008 [-0.011…-0.004] | -0.002 (0.55) | 11.3 % | thua |
| cá nục (0.785) | (c) nền+3 dị thường | +0.000 [-0.001…+0.001] | +0.001 [+0.001…+0.002] | -0.008 [-0.011…-0.004] | +0.008 (0.25) | 11.3 % | thua |
| bạc má (0.890) | (a) nền+HSI | -0.002 [-0.006…+0.001] | -0.005 [-0.009…-0.001] | -0.026 [-0.033…-0.018] | +0.009 (0.27) | 23.1 % | thua |
| bạc má (0.890) | (b) nền+residual 8 | +0.000 [-0.000…+0.001] | +0.001 [-0.000…+0.001] | -0.006 [-0.012…-0.001] | +0.008 (0.12) | 11.3 % | thua |
| bạc má (0.890) | (c) nền+3 dị thường | +0.000 [-0.000…+0.000] | +0.000 [+0.000…+0.001] | -0.000 [-0.002…+0.001] | -0.003 (0.61) | 11.3 % | thua |
| cá cơm (0.919) | (a) nền+HSI | -0.014 [-0.020…-0.008] | +0.000 [-0.006…+0.007] | -0.011 [-0.019…-0.002] | +0.037 (0.02) | 10.6 % | thua |
| cá cơm (0.919) | (b) nền+residual 8 | -0.000 [-0.001…+0.000] | -0.001 [-0.002…+0.000] | -0.003 [-0.014…+0.007] | -0.010 (0.83) | 11.3 % | thua |
| cá cơm (0.919) | (c) nền+3 dị thường | -0.000 [-0.000…+0.000] | -0.000 [-0.001…+0.000] | -0.007 [-0.014…-0.001] | -0.008 (0.92) | 11.3 % | thua |
| ngừ chù (0.733) | (a) nền+HSI | -0.033 [-0.042…-0.024] | +0.005 [-0.009…+0.016] | -0.014 [-0.025…-0.003] | -0.003 (0.67) | 37.5 % | thua |
| ngừ chù (0.733) | (b) nền+residual 8 | -0.001 [-0.006…+0.003] | +0.001 [-0.002…+0.003] | -0.003 [-0.007…+0.000] | -0.010 (0.86) | 11.3 % | thua |
| ngừ chù (0.733) | (c) nền+3 dị thường | -0.001 [-0.005…+0.003] | -0.001 [-0.004…+0.002] | -0.004 [-0.007…-0.000] | -0.007 (0.85) | 11.3 % | thua |

**5 nếp 2 tháng (đệm 15 ngày)**

| loài (nền trong-nghề) | nhánh | Δ vs nền [CI 90 %] | Δ ĐỘNG [CI] | Δ AUC 1° [CI] | ρ dị thường (p) | ô ≥50 | kết |
|---|---|---|---|---|---|---|---|
| ngừ vằn (0.779) | (a) nền+HSI | -0.076 [-0.091…-0.060] | -0.001 [-0.019…+0.014] | -0.005 [-0.009…-0.002] | -0.001 (0.56) | 35.6 % | thua |
| ngừ vằn (0.779) | (b) nền+residual 8 | -0.000 [-0.001…+0.001] | +0.000 [-0.001…+0.001] | +0.000 [-0.001…+0.001] | +0.012 (0.07) | 11.3 % | thua |
| ngừ vằn (0.779) | (c) nền+3 dị thường | -0.000 [-0.000…+0.000] | +0.000 [-0.000…+0.000] | -0.000 [-0.001…+0.001] | +0.005 (0.30) | 11.3 % | thua |
| cá nục (0.789) | (a) nền+HSI | -0.050 [-0.061…-0.041] | -0.002 [-0.014…+0.008] | -0.013 [-0.021…-0.005] | +0.009 (0.25) | 13.8 % | thua |
| cá nục (0.789) | (b) nền+residual 8 | +0.000 [-0.000…+0.001] | +0.001 [+0.000…+0.002] | -0.007 [-0.011…-0.003] | +0.003 (0.42) | 11.3 % | thua |
| cá nục (0.789) | (c) nền+3 dị thường | +0.000 [-0.000…+0.001] | +0.001 [+0.000…+0.002] | -0.006 [-0.010…-0.003] | +0.003 (0.40) | 11.3 % | thua |
| bạc má (0.875) | (a) nền+HSI | -0.007 [-0.011…-0.003] | +0.001 [-0.004…+0.005] | -0.010 [-0.024…+0.005] | +0.012 (0.19) | 21.5 % | thua |
| bạc má (0.875) | (b) nền+residual 8 | -0.001 [-0.002…+0.000] | +0.000 [-0.001…+0.001] | -0.004 [-0.009…+0.004] | -0.007 (0.80) | 11.3 % | thua |
| bạc má (0.875) | (c) nền+3 dị thường | +0.000 [-0.001…+0.001] | +0.000 [-0.001…+0.001] | +0.001 [-0.005…+0.009] | -0.002 (0.61) | 11.3 % | thua |
| cá cơm (0.915) | (a) nền+HSI | -0.018 [-0.022…-0.013] | -0.003 [-0.008…+0.003] | -0.011 [-0.019…-0.003] | +0.045 (0.00) | 10.2 % | thua |
| cá cơm (0.915) | (b) nền+residual 8 | -0.000 [-0.001…+0.000] | -0.000 [-0.001…+0.000] | -0.005 [-0.010…+0.001] | -0.015 (1.00) | 11.3 % | thua |
| cá cơm (0.915) | (c) nền+3 dị thường | -0.000 [-0.000…+0.000] | -0.000 [-0.001…+0.000] | -0.004 [-0.010…+0.002] | -0.007 (0.96) | 11.3 % | thua |
| ngừ chù (0.749) | (a) nền+HSI | -0.039 [-0.047…-0.032] | +0.002 [-0.012…+0.014] | -0.011 [-0.019…-0.004] | -0.000 (0.49) | 33.3 % | thua |
| ngừ chù (0.749) | (b) nền+residual 8 | -0.000 [-0.001…+0.001] | +0.002 [+0.001…+0.003] | -0.001 [-0.005…+0.003] | +0.007 (0.17) | 11.3 % | thua |
| ngừ chù (0.749) | (c) nền+3 dị thường | -0.000 [-0.001…+0.001] | +0.001 [+0.000…+0.002] | +0.000 [-0.003…+0.004] | +0.006 (0.15) | 11.3 % | thua |

**Đọc kết quả (5 dòng):**
1. **0/30 thắng và không có "suýt thắng".** Δ trong-nghề của (b)/(c) nằm trong ±0,002 ở cả 10 sơ đồ×loài (CI chạm 0 hoặc 0,000); cổng cần +0,01. Chênh động CI loại 0 dương chỉ ở cá nục (c) F3 +0,001 [+0,001…+0,002], cá nục (b)(c) 5 nếp +0,001, ngừ chù (b) 5 nếp +0,002 [+0,001…+0,003], (c) +0,001 — nhỏ hơn cổng 5–10 lần và đi kèm AUC cục bộ âm hoặc ρ ≈ 0.
2. **(a) HSI gộp noisy-OR như production LÀM HẠI nền**: Δ −0,002…−0,076 (CI loại 0 âm ở 9/10), nặng nhất ở ngừ vằn (−0,064 F3 / −0,076 5 nếp) và ngừ chù (−0,033 / −0,039); đồng thời phình điểm nóng: ô ≥50 từ 11,3 % lên 33–38 % (ngừ vằn, ngừ chù), 22–23 % (bạc má), 14–15 % (cá nục). Chỉ cá cơm có ρ dương rõ (+0,037 p 0,02 F3; +0,045 p 0,005 5 nếp) nhưng Δ trong-nghề −0,014/−0,018 và AUC cục bộ âm. Khớp 2B: HSI ngày không cộng thêm được gì lên nền bãi.
3. **Residual có khoá dấu gần như không học được gì**: hệ số z học được 0,01–0,06 logit trên 1σ (tối đa ~0,2 logit ở 3σ) và nhiều hệ số bị ghim 0 vì sai dấu (cá cơm: chl loại vì `foodDependence` = 0; cá nục: SST −0,02…−0,03); nên điểm (b),(c) ≈ nền, chỉ đổi thứ hạng trong các ô gần hoà.
4. **AUC cục bộ không tăng ở đâu cả**: điểm ước ≤ +0,001 ở 30/30, không CI nào loại 0 về phía dương, CI âm hẳn ở 16/30 (chủ yếu (a); cá nục (b)(c) −0,006…−0,008); Spearman dị thường |ρ| ≤ 0,015 cho mọi (b),(c) (nền đứng yên theo tháng nên ρ của nền không xác định — mọi thành phần "động" đều đến từ nhánh). Cùng bức tranh với 2B: trong một bãi, ảnh vệ tinh của ngày không xếp được ô nào hơn ô nào.
5. **Bộ đo thấy được tín hiệu khi có**: đối chứng dương (ngừ vằn, F3, nhánh "o" cố ý rò kg của chính ngày, `--oracle`) cho Δ +0,050 [+0,042…+0,060], động +0,136, AUC 1° +0,044, ρ +0,286 ⇒ THẮNG đủ bốn. Vậy "thua" ở trên là kết quả thật **với nhãn này** (N1: kg chia đều theo giờ trong chuyến — cận dưới; vẫn **không** được đọc là "vệ tinh vô dụng", chỉ là chưa chứng minh được; toạ độ mẻ Q1 là thước còn thiếu). F3 so 5 nếp (khác tập ngày: F3 chỉ tháng 03–10): nền tụt ở 3/5 loài (ngừ vằn 0,779→0,764, ngừ chù 0,749→0,733, cá nục 0,789→0,785), tăng ở 2/5 (bạc má +0,015, cá cơm +0,004) — chênh ≤ 0,016, dưới ngưỡng 0,02 của eval §2 nên nền 5 nếp chưa bị tô hồng.

**Giới hạn:** (a) dựng lại nền + hệ số logistic ≠ `dl-eval-honest` (xem trên); (b) hàng huấn luyện của nền dùng lưới giữ-tháng-ra của CHÍNH THÁNG ngày đó nên đặc trưng x của ngày train có thể chứa nhãn tháng thử (tháng kề, trọng số ½) — rò đặc trưng không phải nhãn, chỉ ở 5 nếp (F3 dùng `fwd-` cho cả train); (c) λ ridge cố định, không CV; (d) 5 loài, không phải 34; không có `catch-null` v2; (e) dị thường dùng trung bình tháng của chính chuỗi cache nên không phải khí hậu nhiều năm; (f) `--local`/Spearman chỉ trên ô trong cache; (g) chưa chạy lại với toạ độ mẻ.

```bash
export SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data     # PC GPU; mã ở ~/fish-eval-r2 (src+scripts copy của Mac)
# lưới tĩnh v2 (28 tệp mỗi loại): tháng, cặp tháng, fwd-<M> — xem exv2.sh trong thư mục ghi chú (build-fleet-effort-grid --v2 --gear-map …; build-species-catch-grid --labels <5 labels-v2> --exclude-month …)
NODE_OPTIONS=--max-old-space-size=14000 npx tsx scripts/fish-2d-experiment.mjs --species "ngừ vằn,cá nục,bạc má,cá cơm,ngừ chù" --out $SDFISH_DATA_DIR/fit2/2d   # ~14 phút, 1 lần
npx tsx scripts/fish-2d-experiment.mjs --species "ngừ vằn" --schemes f3 --oracle --out <dir>   # đối chứng dương
npx tsx scripts/fish-2d-experiment.mjs --selftest
```

**Tệp:** `scripts/fish-2d-experiment.mjs` (mới) · `scripts/fish-metrics-local.mjs` (thêm `anomalyPairsDense`, `localAucDay`, `spearmanFromPairs`; sửa tràn ngăn xếp với mảng lớn) · `src/lib/__tests__/fish-fit-scripts.test.ts` (thêm selftest 2D). Dữ liệu ngoài repo: `fleet-v2/`, `catch-v2/` (`*-ex-<tháng|cặp|fwd-…>.json`), `fit2/2d`, `fit2/2d-oracle`. Không đụng `src/` logic, không đụng `dl-eval-honest.mjs`.

### 7.10 Kết quả 2F — vận hành (2026-10-19; chưa commit repo ForFish)

> Đã làm: nguồn dữ liệu thô có bản dự phòng, bộ chuyển vào git, một biến thư mục, runner có cache + manifest tới `eval`, dọn 15 script cũ. **Chưa làm:** fit/propose/PR trong runner, timer systemd, ablation `catch-legacy|none`.

| Việc | Kết quả |
|---|---|
| Push nhánh `Data` (AI-Assistant) | ✅ `origin` = `Long-Forfun/AI-Assistant`; 6 commit đẩy lên `origin/Data` (script kéo DataLake không còn nằm một chỗ trên GPU) |
| vhdx WSL / OneDrive | WSL `Ubuntu-24.04` ở **`D:\WSL\Ubuntu-24.04`** (ổ D, 1,6 TB trống) — KHÔNG ở ổ C; `sdfish-data` ở **ổ C** (`C:\Users\admin\sdfish-data`, 102 GB trống / 476) và **không** nằm trong OneDrive (`OneDrive\` chỉ có `desktop.ini`). Không dời gì. Ổ C còn **79 % đầy** |
| Sao lưu | ✅ rsync sang **ổ E:** (3,7 TB, ổ vật lý khác C/D): `/mnt/e/sdfish-backup/2026-10-19/` = 16 GB (`datalake-iuu/{snapshots 273M, tracks 1,8G}`, `sdfish-data/{dl-all 11G, dl-trk0809 995M, fc-full 1,5G, fleet*, catch*, tools}`), `MANIFEST.txt` (kích thước, sha256 so nguồn↔bản sao 7 file khớp, đếm file khớp 100 %). Chưa lên đám mây/NAS (theo chỉ đạo). Lệnh chạy lại: `rsync -a` cùng đường dẫn (tăng dần) |
| `dl-adapt-local.mjs` | ✅ `scripts/dl-adapt-local.mjs`: `--src` bắt buộc / `SDVICO_DATALAKE_ROOT`, `--snap` mặc định snapshot mới nhất, `--out` mặc định `$SDFISH_DATA_DIR/dl`; logic và PII-strip giữ NGUYÊN (bọc thành hàm `run`); `--selftest` + vitest kiểm tên chủ tàu/số đăng ký/số nhật ký không lọt. **Chưa chạy trên dữ liệu thật** (7 phút, ghi đè `dl-all`) — chạy qua runner khi cần |
| `SDFISH_DATA_DIR` | ✅ `scripts/lib/data-dir.mjs` (`dataDir`, `datalakeRoot`); đổi mặc định ở `dl-collect` (đánh dấu KẾ THỪA), `dl-build-labels`, `dl-eval`, `dl-eval-fleet`; `fish-features-cache` re-export; các script 2A/2B/2D đã dùng sẵn. Không đổi logic |
| Runner | ✅ `scripts/train/run.mjs`: 9 stage / 72 item (`adapt, adapt-0809, aux, labels-v2, fleet-grid-v2, catch-grid-v2, sat-grids, features-cache, eval-honest`), `--dry-run --resume --only --from-stage`, selftest + `train-runner.test.ts`. **Chạy thật trên GPU** (dữ liệu thật qua thư mục dữ liệu tạm có symlink): `eval-honest` lượt 1 = **348 s** (`grids-0809` 0,8 s + `honest` 330 s), lượt 2 = **CACHE cả hai item, 0 s**; manifest + `cache.json` ghi đúng. `package.json`: `train:dry`, `train:labels`, `train:eval` |
| Dời script cũ | ✅ `git mv` **15** file (không phải 17) vào `scripts/_archive/` — danh sách "doc 0" trong report-pipeline-ops §1 nhóm C liệt kê đúng 15 tên (fish-front ×2, fish-hypo ×10, fish-plankton ×2, copernicus-skill-backtest); chỉnh `../src`→`../../src` và `ROOT`; chỉ còn nhắc trong comment của nhau + `copernicus-tendency-skill.mjs` (không đụng). Nhóm "doc 1–2 nhắc" giữ nguyên |
| Cổng | `npm test` 5 045 xanh; 3 ca đỏ lần chạy đầy (`fish-fit-scripts`, `thermal-band`, `tides`) đều **quá 5 s** dưới tải song song và **xanh khi chạy riêng** (77/77) — không liên quan 2F; `sh .githooks/pre-commit --self-test` 0 FAIL |

**Phát hiện**
1. **Kết quả `eval-v2/honest-eval.json` cũ KHÔNG tái lập byte** với mã hiện tại: bản cũ 246 KB (18/10 22:03), chạy lại bằng mã working copy (có nền 2A + `prod2`) ra 535 KB. Khác vì mã `dl-eval-honest` đã thêm cấu hình, không phải do runner; muốn "máy sạch ra giống byte" phải ghim mã bằng commit (manifest ghi `gitsha` + `-dirty`) — **cổng "một lệnh ra `report.json` giống byte" chỉ đúng sau khi commit đợt 2**. Chưa kiểm tính tất định giữa hai lượt cùng mã (cần chạy `--force`; cache hiện che).
2. `fleet-ex-fwd-*` và nếp `a+b` trên GPU không có cờ riêng ở script: runner dựng bằng `--exclude-month` nhiều tháng (ex-fwd = mọi tháng ≥ M). **Chưa so byte** với 28 file đã có — cần chạy `fleet-grid-v2` thật (~4 phút/tệp ×29) rồi `cmp`; để ngỏ vì 2C đang dựng cùng thư mục.
3. `dl-eval-fleet` đòi lưới giữ-tháng-ra cho mọi tháng có ảnh ⇒ runner tạo `fc-full/grids-0809` (symlink 08–09 + etopo). Lần thử đã để lại thư mục này trong `fc-full` thật (vô hại, tạo lại được).
4. Ổ C (chứa `sdfish-data`) 79 % đầy; vhdx (ổ D) và bản sao (ổ E) còn rộng — nên cân nhắc dời `sdfish-data` sang D/E (`SDFISH_DATA_DIR` đã cho phép đổi một chỗ).
5. `sat-grids` là stage duy nhất cần mạng; mặc định dải ngày 01/01 → 11/10 (290 ngày), `fish-validate-run` tự bỏ qua ngày đã có.
6. Mã thử chạy ở `~/fish-train-2f` + dữ liệu tạm `~/fish-train-2f-data` trên GPU (bản sao của Mac, không phải checkout `~/ForFish`) — xoá được.

**Tệp 2F (để chèn/commit):** mới `scripts/train/run.mjs`, `scripts/dl-adapt-local.mjs`, `scripts/lib/data-dir.mjs`, `scripts/_archive/README.md`, `src/lib/__tests__/train-runner.test.ts`; sửa `package.json`, `scripts/{dl-collect,dl-build-labels,dl-eval,dl-eval-fleet,fish-features-cache}.mjs` (chỉ dòng mặc định/import), 15 `git mv` vào `scripts/_archive/`; doc `ops/fish-validate-positions.md` (§9.z + covers), `ops/runbook.md` (mục Train), `02-architecture.md` (re-verified). `.env.example` không có trong repo ⇒ không thêm.


### 7.9 Nối nền vào production (2026-10-19)

> **Trạng thái: ĐÃ NỐI trong code, CHƯA commit.** Số đo dưới đây **B = 20** (CI từ 20 mẫu khối — rộng/lỏng hơn B = 500 của §7.4b; PC GPU mất kết nối giữa chừng nên chưa chạy lại B = 500: việc còn lại, chỉ đổi con số trong bảng). Cấu hình đo "production mới" = `buildFishForecast` THẬT với `extra.base` (hệ số + bảng tĩnh fit trên tháng KHÁC tháng chấm, như §7.4) trên nhãn v2, 61 ngày 8–9/2026, lưới giữ-tháng-ra v2.

**Đã làm (hình dạng cuối):**
- `src/data/fish-base.v1.json` (13,1 KB, cạnh hai lưới, bundle server — KHÔNG `public/data`): K_s 32 loài, hệ số 4 nhóm × (5 + 4), bảng log-lift 34 loài, `hotShare` 0,157, `catchSameMonth` (11, 12 = false), `builtFrom` (nhãn `dl-trk0809/labels-v2`, `scriptSha`, ngày fit 2026-10-19, tháng fit 8–9). Sinh bằng `fish-base-build.mjs --labels-report … --hot-share 0.157`.
- `src/data/fleet-effort-025.v1.json` (598 KB) và `species-catch-025.v1.json` (892 KB) **thay bằng bản dựng từ nhãn v2** (`fleet-v2/fleet-full.json`, `catch-v2/catch-full.json`; 33 loài thay 34) — hệ số fit trên lưới v2 nên lưới sản xuất phải cùng nguồn. Đây là thay dữ liệu trong git (cùng đường dẫn, đè): **cần anh Long/lead duyệt trước khi commit**.
- `fish-predict.ts`: `extra.base` ⇒ `s`/`sp` = điểm nền; `thermalFit` tách khỏi `scoreCell` (MỘT công thức cho cổng nhiệt, cả HSI lẫn nền gọi); `cell.hint {sat, why[]}` = HSI loài tốt nhất, TÁCH khỏi `s`; `baseMode` ở cấp bản đồ; `FISH_ALGO_REV` 2; `BASE_SEASON_LIST_GATE` vào chữ ký mô hình.
- `fish-forecast-run.ts` truyền nền; `fish-snapshot.ts` băm cả file nền vào id hàng (hàng snapshot mới); `fishing-map-view.tsx`: có `baseMode` thì bỏ pha blend (`fish-blend.ts` ghi chú).
- Test: `fish-base-production.test.ts` (9 ca: hình dạng tệp, số đo, nền đọc được, tháng thiếu kg → `fleet-static`, `hint` không đổi `s`/`sp`, cổng nhiệt giữ, mất nguồn chỉ giảm, thiếu `base` = hành vi cũ, vân tay đổi). Các test cũ KHÔNG phải sửa (nhánh cũ nguyên vẹn khi không truyền `base`; chạy với hai lưới v2 thật vẫn xanh). `npm test` 5061 xanh (291 file), `tsc` sạch (trừ lỗi sẵn của `dl-labels-v2.test.ts` — 2C), eslint sạch.

**Hai quyết định lệch khỏi bản thiết kế — cần lead/anh Long xem:**
1. **Cổng "loài phải có trong lịch mùa vụ của VÙNG" TẮT trong nhánh nền** (`BASE_SEASON_LIST_GATE = false`). Đo: bật cổng thì trong-nghề **0,802 → 0,769 (−0,033)**, ô ≥50 từ 11,5 % xuống 8,8 %, tức là mất đúng mục tiêu "≈ 0,810 ± 0,005". Lý do: nhiều kg thật nằm ở (vùng, loài) mà lịch không ghi. Mùa vụ vẫn có mặt hai chỗ: đặc trưng `baseSeason` của nền (sàn 0,6 giữ; loài đang vụ không bị tắt) và lịch hiển thị cũ không đổi. Bật lại bằng một hằng số, hoặc `extra.baseGates`.
2. **`hotShare` = 0,157, không phải 0,115**: miền xếp hạng của `buildFishForecast` (chỉ ô có vùng biển) nhỏ hơn lưới đo (mọi ô SST), nên cùng phân vị cho ít ô ≥50 hơn; 0,157 chỉnh để tỉ lệ ô ≥50 trên lưới đo ≈ bản chốt (11,5 %).

**Cổng cuối (production mới, B = 20):**

| cấu hình | AUCeff cũ | TRONG-NGHỀ | Δ bản chốt v2 | Δ tĩnh v2 | Δ M−1 kg/giờ v2 | ô ≥50 | bậc 25-49÷0-24 · 50-74÷25-49 · ≥75÷50-74 |
|---|---|---|---|---|---|---|---|
| **production mới** (nền + cổng nhiệt) | 0.806 [0.800–0.817] | **0.802** [0.794–0.813] | +0.089 [+0.084…+0.098] | −0.004 [−0.006…+0.001] | +0.009 [+0.006…+0.019] | **11,5 %** | 5,59 · 2,83 · **2,30** [1,89–2,60] |
| tháng chưa có kg (`fleet-static`) | 0.799 | 0.793 [0.786–0.805] | +0.080 | −0.013 | +0.000 [−0.003…+0.009] | 11,5 % | 6,79 · 2,26 · 2,12 |
| tắt cổng nhiệt (chẩn đoán) | 0.806 | 0.802 | — | — | — | 11,5 % | 5,59 · 2,84 · 2,29 |
| BẬT cổng lịch mùa vụ theo vùng (chẩn đoán) | 0.771 | 0.769 | +0.056 | −0.036 | −0.023 | 8,8 % | 3,07 · 2,66 · 2,15 |
| *tham chiếu:* nền thuần §7.4b · tĩnh v2 · M−1 v2 · bản chốt v2 | 0.815 · 0.811 · 0.797 · 0.717 | 0.810 · 0.806 · 0.793 · 0.713 | | | | 11,3 % · 51 % · 6,0 % · 11,5 % | |

**Đọc (5 dòng):**
1. **Trong-nghề 0,802 — thiếu 0,003 so với đích "0,810 ± 0,005"** (dưới cận 0,805). Từ nền thuần 0,810 xuống 0,802 là giá của đóng gói production: miền xếp hạng chỉ gồm ô có vùng biển (ô ngoài vùng = 0), và cắt `KEEP_MIN` 25 (điểm < 25 không vào payload). Không ép; vẫn hơn bản chốt v2 +0,089 và hơn M−1 v2 (+0,009, CI loại 0), ngang tĩnh v2 (−0,004, CI chạm 0).
2. **Cổng nhiệt không mất gì** (0,802 = 0,802, ô ≥50 y nguyên): bất biến "nước ngoài dải chịu đựng không vẽ" giữ miễn phí. Ngược lại cổng lịch mùa vụ theo vùng mất 0,033 — dữ liệu không ủng hộ nó (quyết định 1).
3. **Bậc ≥75 ÷ 50-74 = 2,30** (CI dưới 1,89): đạt ngưỡng 2× ở mức gộp nhưng CI dưới < 2 với B = 20; chờ B = 500. Tháng chưa có kg loài: 2,12, ô ≥50 vẫn 11,5 %, trong-nghề 0,793 — UI phải nói "chỉ theo bãi tàu + mùa".
4. **`hint` tách hẳn khỏi điểm** (test: đổi phù du → `s`/`sp` không đổi). Chưa có số đo riêng cho `hint.sat` — 2D chỉ cho biết nó không nâng được nền; UI nên gọi nó "dấu hiệu hôm nay", không kèm lời hứa.
5. Còn nợ: chạy lại B = 500; xác nhận thay hai lưới `src/data` bằng bản v2; `fleetOnly` để trống (chờ danh sách của 2C/anh Long); 07 design-spec + 01-product (2E, lead): chữ cho `baseMode`/`hint`.

**Hình dạng payload cuối (cho lead/2E):** `FishForecast { ok, date, cells, species, baseMode?: "catch-fleet-static" | "fleet-static", …cũ }`; `FishCell { lat, lon, s, top, sp, t, c, hint?: { sat: number | null, why: string[] } }` — `s`/`sp` ∈ 0..100 là điểm NỀN; `hint.sat` ∈ 0..100 là HSI của loài đứng đầu nền (null = HSI không chấm được); `hint.why` ≤3 cụm chữ đời thường ("ranh giới nước nóng–lạnh", "ranh giới nước nhiều mồi", "xoáy nước", "nước trồi", "dòng chảy gom mồi"). Không `baseMode` = bản cũ (HSI).
