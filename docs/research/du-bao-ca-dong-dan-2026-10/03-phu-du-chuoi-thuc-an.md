# 03 — Phù du và chuỗi thức ăn: độ trễ dinh dưỡng cho dự báo cá ForFish

Vai: nhà sinh thái phù du / hải dương sinh học. Ngày: 2026-10-22. Chỉ nghiên cứu, không sửa code.

Ký hiệu: **[KC]** = đã kiểm chứng, có nguồn đọc được. **[CV]** = chuyển vị từ vùng biển khác. **[ƯỚC]** = ước lượng hoặc giả định của tôi, cần thử lại trên dữ liệu Biển Đông.

Ghi chú chủ quyền: các bài tiếng Anh dùng tên "South China Sea"; ở đây gọi là **Biển Đông**. Hoàng Sa, Trường Sa thuộc Việt Nam. Tôi chỉ dùng **số liệu khoa học** của các bài, không dùng bản đồ hay địa danh trong đó. Một bài của Tạp chí Khoa học Thủy sản Nam Hải, Trung Quốc (schinafish.cn, 2016) có số liệu về độ sâu cực đại chl nhưng thuộc nhóm nguồn có thể kèm bản đồ "đường chín đoạn". Tôi **không dùng** bài này và thay bằng Zhao et al. 2018 (PLOS ONE). Hai bài của Zhao/Chen (Đại học Hải dương Quảng Đông) chỉ được lấy số liệu; phải soát lại hình bản đồ trong bài trước khi trích dẫn ra ngoài.

---

## 1. Độ trễ theo từng mắt xích

### 1a. Gió / nước trồi → đỉnh chl (ngày)

| Bối cảnh | Độ trễ | Loại |
|---|---|---|
| Nước trồi Nam Trung Bộ, mùa gió tây nam | Chl tăng từ **đầu tháng 6**, đạt ≈0,5 mg·m⁻³, đỉnh **tháng 8**, tan vào tháng 9. Kéo dài ≈4 tháng. Tương quan chl với vận chuyển Ekman là 0,62, với bơm Ekman là 0,61, với SST là −0,71 (số liệu tháng, cùng kỳ, **không tính độ trễ**) (Chen, Shi & Zhao 2021) | [KC], mức mùa |
| Năm 2007, Đông Nam Việt Nam | Gió đổi đột ngột cuối tháng 7, chl tăng vọt từ cuối tháng 7 tới giữa tháng 8. Nước trồi đỉnh ≈6 m/ngày, nâng nước lên hơn 40 m. Tương quan chl với bơm Ekman là 0,73. Bài **không nêu độ trễ tính bằng ngày** (Zhao et al. 2018) | [KC] định tính |
| Bão và áp thấp nhiệt đới ở Biển Đông | Đỉnh chl mặt biển **ngày 2–7 sau khi bão qua**, hay gặp nhất là 5–6 ngày. Bão Nakri: SST chạm đáy sau 1–2 ngày, chl trễ **4–5 ngày**, bloom kéo dài ≈3 tuần. Bloom dưới mặt có thể kéo dài ≥3 tuần. Chuỗi bão liên tiếp cho bloom thứ hai quanh **ngày 30** | [KC] Biển Đông |
| Dòng hải lưu California (Bodega) | Cần **3–7 ngày gió lặng** sau đợt trồi để chl tích tụ. Cả chu trình từ trồi tới cạn dinh dưỡng mất 5–7 ngày (Wilkerson et al. 2006) | [CV] |

Kết luận cho Biển Đông: phản ứng **chl so với ép gió hoặc bão là 3–7 ngày**. Ép gió theo mùa và đỉnh chl theo mùa lệch nhau **≈1–2 tháng**: gió tây nam lập từ tháng 5–6, chl đỉnh tháng 8. [KC cho bão; ƯỚC cho nước trồi ven bờ, vì chưa có bài nào đo độ trễ theo ngày ở Nam Trung Bộ.]

Chen et al. 2021 còn lưu ý dòng chảy lên phía bắc **đẩy bloom lệch khỏi tâm nước trồi**. Vì vậy cần cộng thêm độ trễ **không gian**, không chỉ độ trễ thời gian.

Lưu ý thêm: Ngo et al. 2021 (JGR) thấy nước trồi mạnh lên khi **gió tây nam ở nam Biển Đông và cặp lưỡng cực rotor gió ngoài khơi đông Việt Nam yếu đi**. Gió không phải yếu tố duy nhất: dòng dọc bờ và dòng phản lưu (jet) hướng đông cũng điều khiển.

### 1b. Chl → động vật phù du (tuần)

- **3–4 tuần**: Druon et al. 2019 (Sci. Rep.) báo cáo động vật phù du phát triển trễ ≈3–4 tuần so với lúc front chl hình thành. Số này rút từ mẫu tần suất theo mùa, toàn cầu. [KC, toàn cầu]
- Messié & Chavez 2017 (GRL) dựng mô hình Lagrange: nitrate do gió cấp, dòng mặt vệ tinh mang đi, phù du tăng trưởng và bị ăn. Cực đại chân chèo nằm **cách bờ 50–100 km**, khớp với khảo sát CalCOFI. Cực đại động vật phù du nằm **giữa** vùng tảo silic ven bờ và vùng phù du pico xa bờ. [CV, California, Peru, Tây Bắc Phi, Benguela]
- Thời gian thế hệ chân chèo giảm mạnh theo nhiệt độ. Huntley & Lopez 1992 đưa công thức dạng D ≈ 128,8·e^(−0,12·T) ngày; **tôi trích từ trí nhớ, chưa đối chiếu bản gốc**. Ở 28 °C công thức cho ≈5 ngày mỗi thế hệ, nên ở vùng nhiệt đới độ trễ chl → động vật phù du có thể **ngắn hơn**, khoảng **1–3 tuần** thay vì 3–6 tuần như ở vùng ôn đới. [ƯỚC]

### 1c. Động vật phù du → cá nổi nhỏ (tuần–tháng)

- Cá nục (scad) với chl: tương quan 0,6 ở **độ trễ 1 tháng** (Indonesia, JGEET). [CV gần, nhiệt đới]
- Cá mòi Monterey: sản lượng phản ứng với môi trường trễ **2 tháng** (r với chl = 0,57; nguồn thứ cấp, Lanz et al., CalCOFI Rep. 50). [CV]
- Cá cơm Catalan: độ trễ 15–18 tháng. Đây là độ trễ **tuyển quân**, không phải độ trễ tụ đàn. [CV, khác cơ chế]
- **Phải tách hai cơ chế.** (i) **Tụ đàn và di cư tới mồi**, vài ngày tới vài tuần: hợp với dự báo theo ngày. (ii) **Tuyển quân và tăng trưởng**, nhiều tháng tới vài năm: hợp với dự báo mùa vụ. Không có bài nào định lượng mắt xích này cho Biển Đông. [ƯỚC]

### 1d. → cá ngừ (tháng)

- Cá ngừ vằn và cá ngừ vây vàng: tương quan với chl là 0,62 ở **độ trễ 4 tháng** (Indonesia, JGEET). [CV gần]
- Cá ngừ vây vàng nam Lombok: sản lượng cá trưởng thành đỉnh **≈3 tháng sau đỉnh chl** (Wiryawan et al. 2020, Fishes). Bài trích các nghiên cứu khác báo **3–5 tháng** ở nhiệt đới Thái Bình Dương và **3–7 tháng** ở chỗ khác. [CV]
- Việt Nam: câu vàng cá ngừ chỉ có ở Khánh Hoà, Bình Định, Phú Yên. Vụ chính từ tháng 11 tới tháng 7, sản lượng tháng 4–7 cao hơn mùa đông (WCPFC). Như vậy **đỉnh chl tháng 8 không khớp vụ cá ngừ ngay sau đó**. Có hai khả năng: độ trễ dài (đỉnh chl tháng 8 dự báo vụ năm sau?), hoặc cá ngừ ăn theo front và hội tụ chứ không theo chl tích luỹ. Đây là **giả thuyết cần thử**, chưa có kết luận. [ƯỚC]

---

## 2. Biến đo được từ vệ tinh và mô hình

| Biến | Nguồn | Tần suất / độ phân giải | Độ trễ phát hành | Ghi chú |
|---|---|---|---|---|
| Chl-a mặt biển L3 và L4 không lỗ | CMEMS `OCEANCOLOUR_GLO_BGC_L4_NRT_009_102` (ACRI-ST) | Hằng ngày, 4 km. Một số biến có bản lấp lỗ không–thời gian | Chưa xác minh; NRT thường ~1 ngày [ƯỚC] | [KC] độ phân giải. Kèm **PFT**: tảo silic, tảo giáp, haptophyte, nano, pico... Bản lấp lỗ có thể không áp cho PFT |
| PFT / thành phần cộng đồng | Như trên; NASA PACE OCI (L3 NRT phytoplankton carbon, IOP; từ 03/2024) | Hằng ngày | Chưa rõ | Chưa thấy sản phẩm "community composition" L3 dạng NRT của PACE [KC là không tìm thấy] |
| Phytoplankton carbon (`phyc`), chl, NPP, NO₃, PO₄, Si, Fe, O₂ | CMEMS `GLOBAL_ANALYSISFORECAST_BGC_001_028` (PISCES, chạy theo vật lý 001_024) | **Hằng ngày + dự báo 10 ngày**, cập nhật 12:00 UTC mỗi ngày, ¼°, 50 tầng | Hằng ngày | [KC]. Có **dự báo** nên kéo được lead time thêm 10 ngày |
| Động vật phù du `zooc` | Cùng sản phẩm 001_028 | ¼°, 50 tầng. Bản ERDDAP tôi thấy là **theo tháng**; GEE có bộ PLANKTON (`zooc_depth1`) | — | [KC] có biến; **chưa xác minh có bản hằng ngày** |
| Micronekton (mồi của cá ngừ) | SEAPODYM-LMTL (CLS/Lehodey), tái phân tích CMEMS ở một số vùng | Theo tuần hoặc ngày tuỳ bản | — | Thời gian phát triển phụ thuộc nhiệt độ; công thức chưa trích được [KC cấu trúc] |
| NPP (VGPM, CbPM, Eppley) | Oregon State Ocean Productivity | 8 ngày / tháng | Chưa xác minh | Dùng cho hồi cứu, ít hợp với chạy hằng ngày |
| MLD, D20, nhiệt và dòng 3D | CMEMS `GLOBAL_ANALYSISFORECAST_PHY_001_024` | Hằng ngày + dự báo 10 ngày, 1/12° | Hằng ngày | D20 = độ sâu đẳng nhiệt 20 °C, nội suy từ profile nhiệt |
| Dòng địa chuyển (cho FSLE, tuổi nước) | CMEMS SEALEVEL L4 NRT | Hằng ngày, ¼° (bản 1/8° tuỳ sản phẩm) | ~1 ngày [ƯỚC] | Tew Kai 2009 dùng ¼° nội suy lên 1/40° |
| Ứng suất gió, bơm Ekman | ERA5, GFS, Open-Meteo (repo đã dùng) | Theo giờ | Gần thời gian thực | Bơm Ekman w_E = curl(τ/ρf) |

---

## 3. Đặc trưng sinh thái gợi ý (công thức)

Gọi C(x,t) là chl L4 hằng ngày, lấy log: c = log10 C. Mùa khí hậu cùng ngày trong năm là c̄(x, doy), làm trơn ±15 ngày. Dị thường c′ = c − c̄.

**F1. Tiền sử mồi có trọng số trễ (chl tích luỹ).**
P_k(x,t) = Σ_{τ=7}^{42} w(τ)·c′(x, t−τ), với w(τ) ∝ τ^(α−1)·e^(−τ/β) (nhân gamma), chuẩn hoá Σw = 1.
Khởi tạo: đỉnh trọng số ở **14–21 ngày** cho cá nổi nhỏ, tức α≈4, β≈5. Với cá ngừ, kéo cửa sổ ra 60–120 ngày. Ước α, β bằng kiểm chứng chéo (mục 5). Chỉ dùng ngày có quan sát thật, hoặc ghi cờ "lấp lỗ" cho ngày nội suy. [ƯỚC]

**F2. Tiền sử mồi theo Lagrange (tuổi khối nước + chl dọc quỹ đạo).**
Thả hạt lùi thời gian từ (x,t) theo dòng mặt u (địa chuyển + Ekman) trong 30–45 ngày. Tính:
- Tuổi nước kể từ lần gần nhất đi qua vùng trồi (SST′ < −1 °C hoặc w_E > ngưỡng): A(x,t).
- Chl tích luỹ dọc quỹ đạo: L(x,t) = Σ_τ w(τ)·C(X(t−τ), t−τ).

Ý sinh học: một khối nước "chín" khi **A ≈ 2–4 tuần**. Lúc đó động vật phù du đạt đỉnh, nằm giữa pha tảo silic và pha pico (Messié & Chavez 2017). Gangrade et al. 2024 (L&O) cũng thấy cộng đồng phù du ở front thay đổi theo tiền sử Lagrange của khối nước trồi. [CV]

**F3. Hội tụ / front Lagrange (FSLE lùi thời gian).**
λ(x,t) = (1/τ)·ln(δ_f/δ₀). Theo Tew Kai et al. 2009: δ₀ = 1/40°, δ_f = 1°, tích phân lùi tối đa 200 ngày, ridge khi |λ| > 0,1 ngày⁻¹, tính hằng tuần. Đặc trưng: λ tại điểm, và khoảng cách tới ridge gần nhất. [KC phương pháp; mối liên hệ với cá ngừ ở Biển Đông chưa kiểm]

**F4. Chỉ số habitat động vật phù du theo front chl (Druon 2019).**
g = |∇C| (cửa sổ 3×3, quy đổi theo km). H = 0 nếu C ∉ [0,097; 11,246] mg·m⁻³ hoặc g < 0,00022. H = 1 nếu g > 0,0115. Ở giữa: H = 1 + [ln g − ln 0,0115] / [ln 0,0115 − ln 0,00022]. Lấy composite 3 ngày. Sau đó **trễ 21–28 ngày** (tần suất H trong cửa sổ t−35…t−14) để đại diện cho động vật phù du đã lớn. [KC công thức; độ trễ là ƯỚC từ con số 3–4 tuần trong bài]

**F5. Tỉ lệ bloom mới / cũ.**
R(x,t) = mean(c, t−7…t) − mean(c, t−35…t−8). R > 0 nghĩa là bloom mới: nhiều tảo, mồi bậc cao chưa tới. R < 0 sau một đỉnh nghĩa là bloom già: có thể đang là pha động vật phù du và cá mồi. Kết hợp thêm **tỉ lệ micro/(nano+pico)** từ PFT: micro cao + bloom trẻ là chuỗi ngắn, hiệu suất cao. [ƯỚC]

**Phụ trợ**:
- Bơm Ekman tích luỹ 7–14 ngày, làm tín hiệu sớm trước chl 3–7 ngày.
- MLD, D20: D20 nông thì nêm nhiệt nâng, cá ngừ bị nén lên gần mặt.
- `zooc` và `phyc` của PISCES, kèm dự báo 10 ngày.

---

## 4. Giới hạn

1. **Mây mùa mưa.** Khi mây che, chl L3 thiếu nhiều ngày. L4 lấp lỗ bằng nội suy, nên F1 và F5 dễ "học" tín hiệu nội suy. Cách xử lý: thêm đặc trưng **tỉ lệ ngày có quan sát thật** trong cửa sổ, và dùng `phyc`/chl của PISCES làm phương án dự phòng. Bài báo về bão Mujigae (BGC-Argo) còn ghi nhận **mây hạn chế ánh sáng làm chậm tăng trưởng thêm 3–5 ngày**. Tôi không có số % điểm ảnh bị che ở Việt Nam; cần đo trên dữ liệu.
2. **Cực đại chl dưới mặt (DCM).** Ngoài khơi Biển Đông, cực đại chl thường nằm ở **65–85 m**, tầng có ánh sáng tới khoảng 120 m (Zhao et al. 2018). Vệ tinh không thấy tầng này. Bloom dưới mặt sau bão có thể kéo dài ≥3 tuần mà mặt biển không thấy. Thuật toán OC chuẩn còn **ước cao** chl mặt ở Biển Đông, do CDOM và sai số hiệu chỉnh khí quyển (Tang 2008; Pan 2010, qua NASA MODIS abstracts). Cách xử lý: dùng chl của PISCES theo tầng (tích phân 0–100 m), D20 và MLD.
3. **Tảo độc và tảo không làm mồi.** *Phaeocystis globosa* nở hoa ven biển Ninh Thuận, Bình Thuận vào tháng 6–9, đi cùng nước trồi mùa gió tây nam, và từng gây chết cá nuôi (Hai et al.; bài của Viện Hải dương học). Chl cao **không đồng nghĩa có mồi**. Cách xử lý: dùng PFT haptophyte làm cờ, hoặc tách đỉnh chl > ngưỡng ở vùng ven bờ.
4. **Sông làm chl cao giả.** Ở cửa Mê Kông, sông Hồng và vịnh Bắc Bộ, CDOM và phù sa làm thuật toán OC ước cao chl (cơ chế đã ghi nhận ở vùng sông khác: Chile, vịnh Ả Rập). Chen et al. 2021 loại vùng nước nông hơn 200 m vì lý do này. Cách xử lý: mặt nạ theo độ sâu và độ đục (Rrs 667 hoặc 670), hoặc dùng sản phẩm "coastal/case-2".
5. **Bloom bị đẩy lệch.** Dòng chảy lên phía bắc đẩy bloom khỏi tâm nước trồi. Vì vậy cần đặc trưng Lagrange (F2) thay vì chỉ dùng độ trễ tại chỗ.

---

## 5. Phép kiểm: chl trễ k tuần có thật sự dự báo sản lượng?

1. **Loại mùa vụ trước.** Trừ khí hậu theo ngày trong năm ở **cả hai phía**: biến môi trường (c′) và sản lượng. Sản lượng phải tính trên nỗ lực khai thác (CPUE), vì nỗ lực cũng theo mùa: gió mùa ngăn tàu ra khơi. Có thể thêm hiệu ứng cố định theo tháng × vùng × nghề.
2. **Tiền làm trắng (prewhitening).** Khớp mô hình AR(p) cho c′, lọc cả hai chuỗi bằng cùng bộ lọc đó, rồi mới tính tương quan chéo theo độ trễ k = 0…26 tuần. Kiểm định ý nghĩa bằng **bậc tự do hiệu dụng** (Pyper & Peterman 1998, CJFAS 55:2127): N_eff ≈ N / (1 + 2Σ ρ_xx(j)·ρ_yy(j)).
3. **Chống "câu" độ trễ.** Quét nhiều k sẽ sinh tương quan giả. Hiệu chỉnh đa so sánh (Bonferroni hoặc FDR), hoặc **chọn k trên tập huấn luyện, khoá k, rồi kiểm trên năm giữ lại**.
4. **Mô hình lồng nhau, kiểm theo khối năm.** M0 gồm mùa + SST + gió hiện tại. M1 = M0 + F1(k). Chỉ nhận F1 khi M1 thắng M0 ở **kiểm chứng chéo bỏ-một-năm** (leave-one-year-out), đo bằng deviance, AUC hoặc CRPS. Đừng dùng k-fold ngẫu nhiên, vì tự tương quan sẽ làm lộ dữ liệu.
5. **Kiểm giả (placebo).** (i) Hoán vị năm của chuỗi chl, giữ nguyên mùa; tương quan phải biến mất. (ii) Dùng độ trễ "âm" (chl tương lai); không được có sức dự báo. (iii) Lấy chl của vùng xa không liên quan; không được thắng.
6. **Kiểm cơ chế.** Nếu độ trễ thật là trophic thì k tối ưu phải **tăng theo bậc dinh dưỡng**: cá nục < cá ngừ, và phải **ngắn hơn khi nước ấm**. Nếu k giống nhau cho mọi loài thì nghi đó là tín hiệu mùa hoặc nỗ lực còn sót.
7. **Thử theo sự kiện.** Ghép các bão và đợt gió mạnh lại (superposed epoch), vẽ CPUE quanh ngày 0, so với các ngày ngẫu nhiên cùng mùa.

---

## Nguồn

- Chen, Shi & Zhao 2021, Front. Mar. Sci. 8:740130 — https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.740130/full
- Zhao et al. 2018, PLOS ONE 13(1):e0189926 — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0189926
- Ngo et al. 2021, JGR Oceans — https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2020JC016892
- Xie et al. 2003, JGR — https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2003JC001867
- Bão và chl ở Biển Đông: Wang 2020 JGR https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2020JC016243 ; Nakri https://pmc.ncbi.nlm.nih.gov/articles/PMC12491603/ ; bão liên tiếp https://link.springer.com/article/10.1007/s00343-020-9266-7 ; Cimaron https://www.intechopen.com/chapters/51288 ; BGC-Argo https://www.researchgate.net/publication/394516649
- Wilkerson et al. 2006 (CoOP WEST) — https://www.sciencedirect.com/science/article/abs/pii/S0967064506002232
- Druon et al. 2019, Sci. Rep. 9:4732 — https://pmc.ncbi.nlm.nih.gov/articles/PMC6427021/
- Messié & Chavez 2017, GRL — https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2017GL074322 ; MBARI https://www.mbari.org/news/new-model-predicts-locations-of-biological-hotspots-in-the-ocean/
- Gangrade et al. 2024, L&O — https://aslopubs.onlinelibrary.wiley.com/doi/10.1002/lno.12654
- Tew Kai et al. 2009, PNAS — https://pmc.ncbi.nlm.nih.gov/articles/PMC2677090
- Cá nục và cá ngừ trễ chl (Indonesia) — https://journal.uir.ac.id/index.php/JGEET/article/download/21643/8117
- Wiryawan et al. 2020, Fishes 5(3):28 — https://www.mdpi.com/2410-3888/5/3/28
- Lanz et al., CalCOFI Rep. 50 — https://calcofi.com/publications/calcofireports/v50/134-146_Lanz.pdf
- WCPFC, hồ sơ nghề cá ngừ Việt Nam — https://wcpfc.int/sites/default/files/2025-08/PLI-VNM-03-[Consultancy-report-(Y3)-Vietnam-Tuna-Fishery-Profile-Nov2012].pdf
- CMEMS BGC 001_028 — https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_BGC_001_028/description ; zooc https://erddap.marine.usf.edu/erddap/info/cmems_biogeochem_zoo/index.html
- CMEMS OC L4 009_102 — https://data.marine.copernicus.eu/product/OCEANCOLOUR_GLO_BGC_L4_NRT_009_102
- *Phaeocystis* ở Việt Nam — https://science.whoi.edu/users/olga/GEOHAB_modeling/manuscripts/hai_et_al_MARSYS-S-09-00234.pdf
- Ước cao chl bằng OC ở Biển Đông — https://modarch.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=01478 ; https://modarch.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=03696
- Pyper & Peterman 1998, CJFAS 55(9):2127–2140 (trích qua tài liệu thứ cấp)
- Đã loại: schinafish.cn (2016), vì là nguồn có thể kèm bản đồ xuyên tạc chủ quyền; đã thay bằng Zhao et al. 2018.
