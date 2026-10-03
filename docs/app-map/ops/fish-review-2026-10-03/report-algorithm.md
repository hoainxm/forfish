# Rà soát THUẬT TOÁN dự báo vùng cá (PFZ) của SDFish so với thế giới — 2026-10-03

> Phạm vi: `src/lib/fish-predict.ts` (`buildFishForecast`, `softOrHabitat`, `trapezoid`, `chlFit`, `foodGate`, `thermoFit`, `deepWaterFit`/`shallowWaterFit`, `coastDistanceKm`, `spatialAnomaly`, `frontStrength`/`gradientStrength`, hằng `SOFTOR_SCALE 0.4 · AGG_FLOOR 0 · NEUTRAL_AGG 0.6 · FOOD_FLOOR 0.45 · SURFACE_CONF {1/0.6/0.25} · UPW_SCALE 0.55 · COLD_SCALE 0.09 · THERMO_BAND_DEFAULT [-4,-23] · DEPTH_UNKNOWN_FIT 0.5`) và `seasonPrior` (`src/data/fish-seasons.ts`, PAD 1 tháng, TAPER 2 tháng). Chỉ đọc, không sửa. Chỗ nào chỉ đọc được tóm tắt (không toàn văn) ghi rõ.

## Công thức SDFish đang chạy (đọc từ mã)

```
fit = tFit · foodLimiter · habitat · depthFit · sW
tFit        = trapezoid(T_tầng, a,b,c,d)                     — cổng nhiệt NHÂN, 0 ngoài [a,d] → loài bị bỏ
foodLimiter = 1 − dep + dep·(0.45 + 0.55·chlFit)             — mồi là giới hạn MỀM, không về 0
habitat     = conf·agg + (1−conf)·0.6                         — conf theo surfaceSignal
agg         = 1 − Π_k (1 − 0.4·(w_k/wMax)·x_k)                 — SOFT-OR 6 cơ chế
depthFit    = deepWaterFit(đáy)·deepWaterFit(cách bờ 20→50 km) — hoặc shallowWaterFit / 1
sW          = seasonPrior ∈ {1, 0.5, 0}
```
x_k: |∇SST| (bão hoà 2 °C/độ ≈ 0,018 °C/km), |∇log10 chl| (1/độ), |∇SSHA| (0,16 m/độ), dị thường KHÔNG GIAN âm của SST-anomaly (p90 → 0,55 °C), của SSHA (0,09 m), hội tụ dòng (0,8 m/s/độ), dị thường KHÔNG GIAN D20 (dải [p50,p90] từng phía).

---

## (A) Bảng so sánh SDFish với 6 hệ / bài báo

| Hệ | Biến đầu vào | Cách TỔ HỢP | Cách CHUẨN HOÁ từng biến | Kiểm định |
|---|---|---|---|---|
| **SDFish** | SST (hoặc nhiệt đáy/250 m HYCOM), chl-a, ∇SST, ∇chl, SSHA (∇ + lõm cục bộ), SST-anomaly cục bộ, hội tụ dòng Copernicus, D20 cục bộ, độ sâu ETOPO, cách bờ, tháng | **Nhân** 4 cổng với **soft-OR** cơ chế gom cá; mồi sàn 0,45; loài đáy kéo về 0,6 | Nhiệt/mồi: dải **sinh học cố định** (FishBase/FAO); cơ chế: **p90 phân bố nước thật** | **Chỉ nội bộ**: %điểm nóng, trung vị, std không gian, Jaccard chéo loài. **Không có CPUE/vị trí đánh bắt** |
| **INCOIS (Ấn Độ)** | SST, chl-a, xoáy (Chelton 2011/Mason 2014; ngưỡng 400 km, 5 cm), gió/Ekman; nền **độ sâu** từ 2002; dòng chảy 2013; vây vàng thêm Kd_490 | **Bậc thang AND**: front nhiệt/chl đơn lẻ = Thấp; front + xoáy hoặc chl > 0,3 mg/m³ = Trung bình; front + xoáy + chl > 0,3 = Cao | Front nhiệt: **Cayula–Cornillon 1992**; front chl: **Canny** — phát hiện CẤU TRÚC, không chuẩn hoá độ lớn gradient | CPUE trong/ngoài PFZ: vây +102%, vây rút +335%, rê +172%, **kéo đáy +52%**, câu vàng +87%; thời gian dò giảm 60–70% |
| **Indonesia (BROL/LAPAN)** | SST GHRSST, chl MODIS | Giao front nhiệt với **mesotrophic chl 0,2–0,5** | Front: **SIED** | Đối chiếu CPUE theo mùa |
| **Zainuddin (Indonesia, ngừ vằn) 2017/2023** | SST, SSHA, chl; 2023 + GAM/KDE, front chl, xoáy | **Trung bình cộng** PHI = (PI_CPUE + PI_tần suất)/2; điểm nóng = **PHI > Q3** | SI = CPUE lớp / CPUE lớp max — **thực nghiệm theo vùng** (SST 29,75–31,25, tâm 30,5; chl 0,15–0,35, đỉnh 0,2; **SSHA DƯƠNG 0–12,5 cm**) | R² 0,62 (2017), 0,70 (2023) |
| **Đài Loan — Hsu 2021 (ngừ vằn WCPO); Yen 2012 (vây vàng)** | SST, **∇SST**, SSH, SSS, **MLD**, chl, FSLE (Hsu); SST, SSH, chl, SSS (Yen) | Hsu: **GMM**, HSI ≥ 0,6 = tiềm năng. Yen: **AMM** | SI từ tần suất nỗ lực; dải tốt ∇SST **0,01–0,11 °C/km** (gradient THẤP) | Hsu: 68,3% vị trí đánh bắt trong 5 km của HSI ≥ 0,6; 94,9% trong 50 km. Yen: đúng 71,9% |
| **Trung Quốc — Chen 2010 (mực bay); Zhou 2022 (ngừ chù *Auxis thazard*, Biển Đông)** | SST, SSS, SSHA, chl (Chen); chl (xuân), SST + SSH (hè) sau sàng GAM (Zhou) | Chen: **AMM vs GMM bằng AIC → AMM thắng**. Zhou: **AMM**, ≥ 0,6 hợp, ≥ 0,8 tối ưu | Zhou: SI Gauss (**hè SST 30,4 °C, dải 29,8–31,0; SSH 0,74 m**; xuân chl 0,155) | Zhou: đúng 72–100%, **TB 86%** |
| **Việt Nam — RIMF: Hướng & cs. 2023 (ngừ vằn HSI); đề tài Nguyễn Duy Thành** | SST, SSS, chl, **tốc độ dòng**, SSH; lưới 0,5°. Đề tài: SST, SSH, Chla, **EKE** | HSI (trích Chen 2008/2009) | SI theo vùng VN: SST 21,5–31, **tập trung 28,5–29,5**; SSS 33,0–33,4; chl 0,1–0,2; SSH 0,6–0,9 m; dòng 10–100 cm/s | "Độ chính xác 60–95%" (không rõ định nghĩa); trễ 2 ngày |
| **Nhật — JAFIC** | SST đa vệ tinh, đo tàu | **So mẫu ảnh** ngày trúng; ngư trường bám **front ấm** | Không công bố | Không công bố |
| **Mugo 2010 (Hokkaido, ngừ vằn)** | SST, chl, SSHA, EKE | **GAM** | **SSHA 0 → +50 cm**, chl nghèo 0,08–0,18 | r² 0,64; SST giải thích nhiều nhất |

Nguồn: INCOIS <https://mosdac.gov.in/pfz/assets/documents/pfz.pdf>; kiểm định INCOIS <https://pmc.ncbi.nlm.nih.gov/articles/PMC13377866/>; BROL <https://journal.ugm.ac.id/ijg/article/download/51668/28434>, <https://www.sciencedirect.com/science/article/pii/S230741082300175X>; Zainuddin 2017 <https://pmc.ncbi.nlm.nih.gov/articles/PMC5624707/>; 2023 <https://doi.org/10.3390/rs15051268>; Hsu 2021 <https://doi.org/10.3390/rs13050861>; Yen 2012 <https://doi.org/10.1080/01431161.2012.685973> (tóm tắt); Chen 2010 <https://spo.nmfs.noaa.gov/sites/default/files/pdf-content/2010/1081/chen.pdf>; Zhou 2022 <https://doi.org/10.3390/fishes7050218>; Hướng 2023 <http://tapchikttv.vn/article/3638>; RIMF <https://vista.gov.vn/news/ket-qua-nghien-cuu-trien-khai/nghien-cuu-cac-giai-phap-ky-thuat-nang-cao-chat-luong-du-bao-ngu-truong-khai-thac-ca-ngu-dai-duong-o-vung-bien-viet-nam-4285.html>; JAFIC <https://earth.jaxa.jp/conseo/en/casestudy/pdf/UC_JAFIC_1_e.pdf>, <https://patents.google.com/patent/US7818280>; Mugo <https://www.lib.hokudai.ac.jp/gakui/2010/9998_mugo.pdf>.

---

## (B) 8 điểm SDFish làm KHÁC số đông

**B1. Tổ hợp NHÂN các cổng thay vì trung bình cộng.** Số đông (Yen, Chen, Zhou, Hướng, Zainuddin) dùng AMM; Hsu dùng GMM; Chen 2010 đo AMM thắng GMM. Ngược lại Fukuda & cs. 2011 (Ecol. Modelling 222:1401) so AMM/GMM/tích/min → **tích cho MSE, AUC tốt nhất** (<https://ideas.repec.org/a/eee/ecomod/v222y2011i8p1401-1413.html>); INCOIS bản chất là cổng AND. → **Có lý, không phải lỗi.** Rủi ro thật: dải nhiệt/mồi sai thì loài tắt cả vùng (đúng lỗi ngừ ồ/thu/ngừ chấm). Mồi đã có đệm `FOOD_FLOOR`, **nhiệt chưa có đệm** (`tFit === 0 → continue`).

**B2. SOFT-OR cho cơ chế gom cá — chưa thấy ai trong ngành cá dùng.** Chỉ có fuzzy OR/noisy-OR trong mạng Bayes. **Phát hiện khi đọc mã**: với `SOFTOR_SCALE 0,4`, MỘT cơ chế mạnh đơn lẻ cho `agg = 0,4` ⇒ **điểm tối đa 40** — **dưới sàn 50**. Hai cơ chế đầy → 0,64. Thực tế hiển thị SDFish **đòi ≥2 cơ chế trùng chỗ** — giống bậc thang INCOIS — **trái với chú thích "chỉ cần MỘT cơ chế mạnh là đủ"**. Toán chấp nhận được; chú thích/doc sai.

**B3. Front = |gradient| tuyến tính trên lưới 0,25°.** Số đông: Cayula–Cornillon/SIED/Canny trên ảnh 1–4 km. RIMF định front ≥ **0,2 °C/10 km = 0,02 °C/km** (<http://tapchikttv.vn/article/983>) — SDFish bão hoà 0,018 °C/km, **cùng bậc**, tốt. Nhưng sai phân giữa ô 0,25° đo chênh trên 56 km → làm mờ front 1–10 km, nhạy nhiễu (repo đã dính và sửa đúng lỗi này ở hội tụ Copernicus). Hsu 2021: ngừ vằn gắn gradient **thấp 0,01–0,11 °C/km** trong nước > 29 °C. → **Hướng đúng, độ phân giải sai chỗ.**

**B4. Mồi: cao nguyên neo đầu GIÀU.** Cá ngừ tối ưu chl 0,15–0,35 (Zainuddin), 0,1–0,2 ở VN (Hướng), 0,08–0,18 (Mugo); INCOIS > 0,3; BROL 0,2–0,5. SDFish vây vàng `chlLog [-1,1; -0,1]` → cao nguyên **0,25–0,79 mg/m³ đều = 1** — ô đục ven bờ 0,8 được điểm mồi bằng ô 0,25, cao hơn ô 0,15 tối ưu. → **Hợp cho cá nổi nhỏ/đáy; lệch nhẹ cho cá ngừ**, sửa rẻ.

**B5. SSHA: cá nổi lớn chỉ dùng |∇SSHA|, bỏ dấu.** Ngừ vằn ưa **SSHA DƯƠNG** ở 4 nghiên cứu độc lập (Zainuddin 0–12,5 cm; Mugo 0→+50 cm; Hsu SSH 0,60–0,71; Zhou 0,62–0,86 m). Đã có `slaSpatial`, thêm `warmStrength` gương `coldStrength` là xong. → **Thiếu, không sai.**

**B6. Chuẩn hoá cơ chế theo p90 nước thật, nhưng dải nhiệt/mồi cố định.** Số đông xây SI từ **tần suất CPUE của chính vùng**; Druon định biên bằng phân vị môi trường tại điểm có cá (chưa đọc toàn văn). SDFish không có CPUE nên p90 của nước là thế thân có lý. **Cảnh báo**: chuẩn hoá SST theo phân vị nước sẽ tạo điểm nóng ở mọi tháng dù cả vùng ngoài dải chịu đựng — Hsu/Zhou giữ ngưỡng tuyệt đối. Hướng 2023 ngừ vằn VN 21,5–31, tập trung 28,5–29,5 — SDFish [23, 25, 29,5, 31] khớp mép trên, **cận dưới 23 cao hơn 21,5 thực đo**. → lai (C3).

**B7. Loài đáy/rạn: trung tính 0,6 + nhiệt đáy, không có lớp nền đáy.** Tổng quan PLOS ONE 2021: loài đáy cần **độ sâu, nhiệt đáy, trầm tích**; cá rạn cần **độ phức tạp nền** (<https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0251818>). INCOIS vẫn cho kéo đáy +52% từ PFZ mặt. SDFish làm đúng hai việc (nhiệt đáy HYCOM; `low` → trung tính + UI nói rõ) nhưng **cá rạn không có cổng nền** → lỗi "hàng trăm ô > 1000 m". Repo **đã có lớp rạn trong `public/data/`** chưa dùng làm cổng.

**B8. Kiểm định chỉ nội bộ.** Mọi hệ khác kiểm bằng CPUE hoặc **vị trí đánh bắt** (Hsu: % vị trí trong 5/50 km của HSI ≥ 0,6 — **không cần CPUE**). SDFish đo **khả năng phân biệt**, không đo **độ đúng**. Nguồn vị trí: VMS Cục Thuỷ sản (~30.000 tàu, GFW hỗ trợ VN <https://globalfishingwatch.org/our-work-in-vietnam/>); AIS GFW phủ VN **tốt hơn từ 1/2024** (<https://globalfishingwatch.org/dataset-and-code-fishing-effort/>). → **Khoảng cách lớn nhất với thế giới.**

---

## (C) Đề xuất — xếp theo tác động × công sức

| # | Đề xuất | Sửa ở đâu | Kiểm bằng số | Tác động | Công |
|---|---|---|---|---|---|
| **C1** | **Kiểm định bằng VỊ TRÍ đánh bắt** (chuẩn Hsu). Nguồn: (a) GFW apparent fishing effort 0,01°/ngày, lọc nghề vây/câu/rê trong EEZ VN; (b) VMS qua SDVICO/Cục Thuỷ sản; (c) nhật ký chuyến trong app | Script mới `scripts/fish-validate-positions.mjs`; **không sửa `fish-predict.ts`** | **Lift** = mật độ giờ đánh bắt trong ô ≥ 50 / mật độ nền (kỳ vọng > 1,5); so với hoán vị ngày 200 lần (p < 0,05). So **AMM vs soft-OR vs weighted-sum** cùng lift → chốt B1/B2 bằng số | Rất cao | Vừa–cao |
| **C2** | **Front trên lưới gốc độ phân giải cao rồi gộp khối** (SST CRW 0,05° đã có; chl MODIS 4 km) — mẫu đã làm cho hội tụ | `buildFishForecast`: `thermFront`, `chlFront` tính trên lưới gốc → `blockMeanAt` về 0,25° | Tự tương quan không gian `fThermFront`; std ≥ 0,1; đối chiếu khí hậu front VN (Hướng) | Cao | Vừa |
| **C3** | **Dải nhiệt lai**: giữ [a,d] sinh học, đặt cao nguyên [b,c] theo **khí hậu vùng–tháng** (p25–p75 SST trong vùng/mùa, kẹp trong [a,d]); hạ cận dưới ngừ vằn 23 → 21,5 (RIMF) | Hàm mới cạnh `trapezoid` (`seasonalThermalBand`) đọc `fish-climatology.v1.json`; gọi ở `tFit` | std(tFit) ≥ 0,1, satFrac ≤ 0,9; "không loài nào 0 ô trong chính vụ"; %điểm nóng Δ ≤ 2 | Cao | Vừa |
| **C4** | **Mồi hình chuông cho cá ngừ**: cao nguyên 0,15–0,35, dốc xuống trên ~0,5; giữ "giàu là tốt" cho cá nổi nhỏ/đáy | `chlFit` thêm `chlMode: "dome"` trong `SpeciesProfile` | Ô vây vàng/vằn ≥ 50 có chl > 0,5 giảm; trung vị cách bờ điểm nóng tăng; Δ ≤ 2 | Vừa | Thấp |
| **C5** | **Xoáy ấm cho `coldCore=false`**: `eddyTerm = max(fEddy, warmStrength)`, `warmStrength = clamp(+slaAnom/COLD_SCALE)` | Nhánh `eddyTerm`; dùng lại `slaSpatial` | std `eddyTerm` tăng; Δ ≤ 2 | Vừa | Thấp |
| **C6** | **Cổng nền rạn** cho hồng/mú/kẽm: không có rạn trong 1 ô → ×0 (lớp không tải được → `DEPTH_UNKNOWN_FIT`) | Cổng `reefFit` cạnh `depthFit`, trường `requiresReef`; nạp qua `data-fetch.ts` | Ô cá rạn ≥ 50 trên đáy > 200 m → 0; ô ≥ 50 còn ≥ 30% số cũ trong chính vụ | Vừa–cao | Thấp–vừa |
| **C7** | **Sửa chú thích soft-OR**: "một cơ chế đơn lẻ tối đa 40; ≥2 cơ chế mới qua sàn 50" hoặc nâng `SOFTOR_SCALE` — chốt bằng C1 | Comment `softOrHabitat`; 01-product | Thống kê số cơ chế x ≥ 0,5 trong ô ≥ 50 | Trung thực | Rất thấp |
| **C8** | **Đệm cổng nhiệt** như mồi: ngoài [a,d] một đoạn δ cho sàn 0,2 thay vì bỏ hẳn | Nơi tính `tFit`, thêm `TEMP_FLOOR` | Loài "0 ô trong chính vụ" → 0; Δ ≤ 2 | Vừa | Thấp |
| C9 | Hồ sơ `w` theo mùa (Zhou: xuân chl, hè SST+SSH) | `SpeciesProfile.w` theo mùa | Chỉ sau C1 | Thấp–vừa | Cao |

---

## (D) Điều KHÔNG tìm được
1. Ngưỡng gradient số của INCOIS; bài kiểm định 2007 bị chặn 403.
2. Công thức JAFIC — chỉ mô tả "so mẫu ảnh".
3. Bài HSI vây vàng/vằn Biển Đông của Trung Quốc so AMM/GMM/min — chỉ Chen 2008 (qua trích dẫn) và Zhou 2022; MaxEnt *Thunnus* bắc Biển Đông 2025 bị 403.
4. Bài "Fishes 2023 tầng nhiệt cá ngừ Biển Đông" mà mã trích — không xác định DOI; chỉ trích đoạn: CPUE cao khi nóc nêm 27–28 °C ở 70–90 m, đáy nêm 250–280 m.
5. Bất kỳ bài PFZ/HSI nào dùng soft-OR — không có.
6. Cách tổ hợp và định nghĩa "60–95%" của RIMF — PDF toàn văn không tải được.
7. CPUE–môi trường loài ĐÁY ở biển VN — không có; chỉ cá hố Đông Hải (nhiệt đáy 23,8 °C, 72 m).
8. Toàn văn Druon và Yen 2012 — chỉ tóm tắt.
9. Số % độ phủ AIS/VMS tàu VN sau 1/2024.
