# Nguồn độ sâu dạng LƯỚI mịn hơn / đo thật hơn GEBCO 15″ cho vùng biển VN — rà soát 2026-10-22 (nhóm A)

> Ngày truy cập mọi nguồn: **2026-10-22**. "đo" = tự fetch/tải/đếm được hôm nay; "ước" = suy từ tài liệu. Tiếp nối `docs/research/nguon-do-sau-2026-08.md` (§1, §2, §4) — KHÔNG lặp lại phần đã viết ở đó, chỉ (a) kiểm lại nguồn cũ còn sống không, (b) thêm nguồn mới.
>
> Hộp khảo sát: 5–23°B, 102–118°Đ. Tiêu chí: lưới hoặc sản phẩm độ sâu đã công bố, **mịn hơn 450 m** hoặc **đo thật** hơn GEBCO/ETOPO.

## 0. Kết luận thẳng (đọc 1 phút)

1. **Lần đầu đo được "GEBCO ở VN thật tới đâu"** bằng lưới TID của GEBCO_2026 (đo): trên **toàn hộp biển VN, 80,1 % ô là nội suy từ trọng lực vệ tinh** (TID 40/44), chỉ 19,9 % là đo thật. Ở dải **0–50 m ven bờ** (nơi bà con đánh bắt) còn tệ hơn: **88,8 % nội suy, 11,2 % đo thật**. Vịnh Bắc Bộ 0–50 m: **1,08 % đo thật**. Tức là độ sâu ETOPO/GEBCO mà SDFish đang vẽ ở Vịnh Bắc Bộ gần như **100 % là mô hình**, không có một điểm đo nào.
2. **Hai nguồn mới 10 m cho đảo/rạn, CC BY 4.0, chưa có trong doc 08/2026**: **SCSBathy10** (Zenodo 2026-03, 126 MB; đo: 66 rạn, 35,8 triệu pixel, RMSE 0,67 m, có Đá Tây/Sinh Tồn/Nam Yết/Tốc Tan, **0 pixel ven bờ VN**) và **LGMM-SDB** (Zenodo 2026-09, 2×779 MB, có **khoảng tin cậy 95 % theo từng pixel**). Cả hai đều là tác giả Trung Quốc, dùng tên Trung Quốc cho đảo → **cắm cờ chủ quyền**, chủ dự án quyết.
3. **Thềm ven bờ VN (khúc giữa) vẫn KHÔNG có lưới mở nào mịn hơn 450 m.** Rà Zenodo/PANGAEA/SEANOE với đủ từ khoá Vietnam/Tonkin/Beibu/Mekong/Nha Trang: **0 bộ dữ liệu lưới ven bờ VN** (đo). PANGAEA chỉ có multibeam **thô** của RV Sonne SO221/SO269 nằm ở bắc Biển Đông (112–117°Đ, 17,7–22,3°B), ngoài thềm VN.
4. **Nguồn cũ**: HHU24SWDSCS còn sống, không có phiên bản mới (đo). ATL24 **đã lên V2** (21/5/2026), V1 bị gỡ ~11/2026 — code đang dùng V1 phải đổi. Allen Coral Atlas còn sống, vẫn CC BY 4.0, lớp bathymetry vẫn tải được. SRTM15+ **V2.7** (4/2025) kèm **SID_V2.7** là bản mở tương đương TID; GEBCO_2026 dựng trên V2.8 (chưa phát hành riêng).
5. **Thương mại**: EOMAP có sản phẩm SDB 15 m cho "250+ thực thể Biển Đông" từ 2015 (giá không công khai, web chặn bot); TCarta G-SDB toàn cầu từ Sentinel-2/ICESat-2 — đều phải xin báo giá. Taiwan ODB: dữ liệu thô **không mở cho người nước ngoài**.

---

## 1. Kiểm lại nguồn đã có trong doc 08/2026

| Nguồn | Còn sống? (đo 2026-10-22) | Thay đổi | Việc phải làm |
|---|---|---|---|
| **HHU24SWDSCS** | ✅ Zenodo 13852568 trả 200, `HHU24SWDSCS.nc` 88 203 093 byte, CC BY 4.0, chỉ 1 phiên bản (2024-09-28; bản 13852497 là bản ghi song song cùng ngày, cùng file) | Không có bản mới | Giữ như doc cũ. Nay có 2 nguồn cùng loại để **đối chiếu chéo** (§2.1, §2.2) |
| **ATL24** | ✅ | 🔴 **V2 phát hành 21/5/2026** (DOI `10.5067/ATLAS/ATL24.002`, CMR `C4085168939-NSIDC_CPRD`). Mới: thuật toán mật độ loại false positive ở mặt nước/cột nước; bỏ biến `profile`/`stats`; thêm `atl24` metadata phiên bản. **V1 bị gỡ khỏi NSIDC ~6 tháng sau = khoảng 11/2026.** Đo CMR hộp ven bờ 105–112°Đ, 8–18°B: **V2 = 1 186 granule, V1 = 1 187** → số "2 373" trong doc 08/2026 chính là tổng V1+V2 | Mọi script `earthaccess`/SlideRule phải ghim `version=002`. Lọc lại điểm đáy vùng đục (cửa Mekong 19 173 điểm) bằng V2 — kỳ vọng **giảm** vì V2 gắt hơn với nhiễu cột nước |
| **Allen Coral Atlas** | ✅ allencoralatlas.org trả 200; trang Resources vẫn ghi *"Bathymetry data is available for download only"* và *"© 2018-2023 Allen Coral Atlas Partnership and Arizona State University and licensed CC BY 4.0"* | Lớp dữ liệu nay do **DataMERMAID** host; không có thông báo đóng dự án | Như doc cũ |
| **GEBCO_2026** | ✅ công bố 23/4/2026; NetCDF 7,0 GB; **TID grid 3,5 GB** (nén 94 MB) | Dựng trên **SRTM15+ V2.8** (SWOT + học máy) | **Lấy TID** — xem §2.3, đây là phát hiện chính của đợt này |
| **GMRT / EMODnet / IHO CSB** | Không kiểm lại | EMODnet DTM 2024 (115 m) "mở rộng toàn cầu" nhưng phần ngoài châu Âu **lấp bằng GEBCO 2024** → không có gì mới ở VN | Vẫn loại |
| **S2Shores 1 km** | Không kiểm lại | — | Vẫn loại |

---

## 2. Nguồn MỚI (chưa có trong doc 08/2026)

### 2.1. SCSBathy10 — 10 m, đảo/rạn Biển Đông, 2026 ⚠️🇨🇳

| Mục | Giá trị |
|---|---|
| Tổ chức | Wang Zijia, Nie Sheng (không ghi affiliation trên Zenodo; tên gọi Xisha/Dongsha/Zhongsha/Nansha → **Trung Quốc**) |
| Phủ VN (đo, đã tải và đọc 66 file .nc) | **66 đảo/rạn**, lon **111,19–117,71°Đ**, lat 4,96–20,78°B; **35 772 621 pixel** có độ sâu (~3 577 km² ở 10 m) — nhiều hơn HHU24 (29,4 triệu điểm). **Ven bờ VN (lon < 110°): 0 file.** Có các thực thể VN đang giữ: Đá Tây (West Reef, 446 779 px), Đá Lát (Ladd), Phan Vinh (Pearson), Tốc Tan (Alison, 802 452 px), Tiên Nữ (Tennent), Thuyền Chài (Barque Canada, 632 980 px), cụm Sinh Tồn (Union Banks, 1,14 triệu px), cụm Nam Yết–Sơn Ca (Tizard Bank, 1,41 triệu px). **Thiếu**: Trường Sa Lớn, Song Tử Tây, An Bang, Núi Le, Đá Đông (có trong CSV nhưng không có file). Có cả Scarborough ("Huangyan") và Pratas ("Dongsha", 4,4 triệu px — file lớn nhất) |
| Độ phân giải | **8,98e-05° ≈ 10 m** (đo geotransform), độ sâu dương xuống, dải đo **0,0–28,7 m** |
| Loại | SDB (ICESat-2 + Sentinel-2 đa thời + thuỷ triều), "adaptive domain transfer" cho rạn thiếu mẫu |
| Datum | File **không có attribute datum** (đo: chỉ `Conventions=CF-1.4`, `created_by=R ncdf4/terra`, CRS EPSG:4326); mô tả nói có hiệu chỉnh thuỷ triều → **ước MSL**. Phải hỏi tác giả hoặc so với ATL24 trước khi vẽ đẳng sâu 0,5 m |
| Sai số công bố | RMSE trung bình **0,674 m**, R² 0,94 (so lidar hàng không + ICESat-2 độc lập) |
| Giấy phép | **CC BY 4.0** (Zenodo `license.id = cc-by-4.0`, đo) |
| Tải | https://zenodo.org/records/19148819 · `Products.zip` **126,5 MB → giải nén 800 MB, 66 `.nc`** (biến `depth_prediction`, `longitude`, `latitude`, `crs`) + `Island Name.csv` (ID, tên quốc tế, **tên Trung Quốc**; không có tên VN) · DOI 10.5281/zenodo.19148819 · 2026-03-21 (đo: tải mất ~9 phút, Zenodo ~250 KB/s, dùng `curl -C -`) |
| Chi phí | 0 |
| **CỜ CHỦ QUYỀN** | 🚩 Nguồn TQ; bảng tên có cột tên TQ. CC BY buộc ghi tên tác giả, **không buộc dùng tên đảo của họ** → thay toàn bộ nhãn bằng tên VN như đã làm với HHU24. Chủ dự án quyết có nhận hay không |
| Bài báo | Chưa tìm thấy bài kèm theo (search "SCSBathy10", "SAI-Path" = 0 kết quả) → **chưa qua peer review**, chỉ có số liệu tự công bố |

### 2.2. LGMM-SDB — 10 m + khoảng tin cậy 95 % từng pixel, 82 rạn Biển Đông, 2026 ⚠️🇨🇳

| Mục | Giá trị |
|---|---|
| Tổ chức | Luo Yifeng, **Jiangxi University of Finance and Economics** (Trung Quốc) |
| Phủ VN | 82 rạn/cụm rạn Biển Đông (danh sách chưa đếm — file 779 MB chưa tải); ven bờ VN: 0 (ước — cùng lớp rạn với SCSBathy10/HHU24) |
| Độ phân giải | 10 m |
| Loại | SDB (Lyzenga + Gaussian Mixture, hai biến thể LGMM / LGMM-A có thêm băng red-edge), **conformal prediction** → mỗi pixel có cận dưới/cận trên 95 % |
| Datum | Chưa rõ |
| Giấy phép | **CC BY 4.0** (đo); mã nguồn https://github.com/Luoyifeng123/LGMM-SDB |
| Tải | https://zenodo.org/records/22787173 · `lgmm_depth_uncertainty.nc` **779,2 MB** + `lgmm_a_depth_uncertainty.nc` 779,1 MB (đo) · 2026-09-16 |
| Chi phí | 0 |
| **CỜ CHỦ QUYỀN** | 🚩 Nguồn TQ (cờ, chưa loại) |
| Giá trị riêng | Là bộ **duy nhất có dải sai số từng điểm** → cho phép SDFish vẽ "chỗ này chắc / chỗ này mơ hồ", đúng tinh thần "không hứa độ chính xác" trong CLAUDE.md |

### 2.3. GEBCO_2026 **TID grid** — biết ô nào đo thật, ô nào bịa 🆕 (đo đầy đủ)

Không mịn hơn, nhưng là **bản đồ độ tin cậy** cho chính lớp nền SDFish đang dùng. Đọc qua COG trên source.coop (bản sao GeoTIFF của GEBCO, cùng giấy phép), cắt hộp 102–118°Đ, 5–23°B = 4 320×3 840 ô, ~2,27 triệu km² biển.

**Toàn hộp biển (11,35 triệu ô)** — đo:

| TID | Nghĩa | % |
|---|---|---|
| 40 | Dự đoán từ trọng lực vệ tinh | **78,32 %** |
| 11 | Multibeam | 15,24 % (hầu hết lòng chảo sâu) |
| 17 | Kết hợp các phương pháp đo trực tiếp | 4,08 % |
| 44 | Đa nguồn nội suy có trọng lực dẫn | 1,77 % |
| 16 | **Cảm biến quang (SDB)** | 0,39 % |
| 14 | Sounding từ **ENC** | 0,18 % |
| 10 | Single-beam | 0,02 % |
| | **Đo thật (10–39) tổng** | **19,91 %** |

**Dải 0 → −50 m (2,2 triệu ô ≈ 441 000 km²)** — đo: nội suy 85,45 % + 3,34 % = **88,8 %**; đo thật **11,21 %** (TID 17 chiếm 8,87 %, SDB 1,70 %, ENC 0,43 %).

**Theo vùng, dải 0 → −50 m** — đo:

| Vùng | Ô | **% đo thật** | Ghi chú |
|---|---|---|---|
| Vịnh Bắc Bộ (105,5–109°Đ, 17–21,5°B) | 359 914 | **1,08 %** | 96,7 % là TID 40. Gần như trắng |
| Thềm Mekong / Tây Nam (103–108°Đ, 7–10,5°B) | 728 334 | **17,90 %** | TID 17 = 17,73 % — có một khối "đo kết hợp" đáng tra nguồn |
| Nam Trung Bộ ven bờ (108–110,5°Đ, 10–16°B) | 74 691 | **36,28 %** | TID 17 = 35,5 % — vùng ven bờ VN có tỉ lệ đo thật cao nhất |
| Trường Sa (111–117°Đ, 6–12°B) | 105 185 | 21,02 % | TID 16 (SDB) 16,2 % — GEBCO đã nạp SDB rạn |
| Hoàng Sa (111–113°Đ, 15,5–17,5°B) | 9 083 | 44,19 % | TID 16 = 43,4 % |

**Ý nghĩa cho SDFish**: (a) có thể **tô mờ/khác màu** đẳng sâu ở ô TID 40/44 ("độ sâu ước tính") và tô rõ ở ô đo thật — một việc 1–2 ngày, không cần dữ liệu mới; (b) Vịnh Bắc Bộ là nơi **mọi lưới mở đều mù** → ưu tiên Thông báo hàng hải + ATL24 ở đó; (c) khối TID 17 ở Nam Trung Bộ/Mekong gợi ý GEBCO đã nhận dữ liệu khảo sát qua EAHC — không tra được nguồn gốc, nhưng độ sâu GEBCO ở đó **đáng tin hơn hẳn** Vịnh Bắc Bộ.

- Giấy phép (trích nguyên văn PDF `GEBCO_Grid_terms_of_use.pdf`, đo): *"The GEBCO Grid is placed in the public domain and may be used free of charge… Users are free to: Copy, publish, distribute and transmit The GEBCO Grid · Adapt The GEBCO Grid · Commercially exploit The GEBCO Grid…"* · *"The GEBCO Grid should NOT be used for navigation or for any other purpose involving safety at sea."* → disclaimer trong app là bắt buộc (đã nói ở doc 08).
- Tải: chính thức https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid (netCDF TID 94,4 MB nén / GeoTIFF 91,7 MB) hoặc COG range-request không cần tải cả file: `https://data.source.coop/giswqs/gebco-bathymetry/gebco_2026_tid/gebco_2026_tid_n90.0_s0.0_w90.0_e180.0.tif` (23,4 MB, đo) + độ sâu `…/gebco_2026/gebco_2026_n90.0_s0.0_w90.0_e180.0.tif` (626 MB, nhưng chỉ đọc cửa sổ).
- Datum: MSL (GEBCO). Cờ chủ quyền: không — lưới số thuần.

### 2.4. SRTM15+ V2.7 + SID_V2.7 — bản "gốc" của GEBCO, có nhãn nguồn riêng

| Mục | Giá trị |
|---|---|
| Tổ chức | Scripps (UCSD), Sandwell group |
| Phiên bản | **V2.7 — 14/2/2025, sửa 9–14/4/2025** (đo README). V2.8 chưa phát hành công khai (chỉ nằm trong GEBCO_2026). Mới ở V2.7: trọng lực **SWOT**, học máy dự đoán độ sâu, thêm điểm Deep ARGO |
| Phủ / độ phân giải | Toàn cầu 15″ — **không mịn hơn**. Giá trị: `SID_V2.7.nc` (254 MB) là **mã nguồn theo từng cruise** (v_max 65 506) chi tiết hơn TID của GEBCO (TID chỉ phân loại) |
| Loại | Đo thật + dự đoán trọng lực |
| Giấy phép | 🟡 **Không phải public domain**: trích UCSD *"permission to copy, modify and distribute… for educational, research and non-profit purposes, without fee"*; *"those desiring to incorporate this global bathymetry into commercial products… should contact the Technology Transfer & Intellectual Property Services, UCSD"*. → Dùng **GEBCO** (public domain) cho lớp hiển thị; SRTM15+/SID chỉ để phân tích nội bộ |
| Tải | `https://topex.ucsd.edu/pub/srtm15_plus/SRTM15_V2.7.nc` (6,1 GB) · `SID_V2.7.nc` (254 MB) · `README_V2.7.txt` (đo, cert TLS của topex lỗi → `curl -k`) |
| Chi phí | 0 |
| Cờ chủ quyền | Không |

### 2.5. SYNBATH V2.0 — tổng hợp seamount, không dùng cho ven bờ

- Scripps, 7/2023, 6,2 GB, 15″. Thêm 8 600 seamount "sắc nét" + đồi vực thẳm **tổng hợp** (synthetic) — là mô hình thống kê cho vùng sâu, **vô nghĩa ở 0–50 m**. Cùng điều khoản UCSD như SRTM15+. Ghi để người sau khỏi tìm lại. URL `https://topex.ucsd.edu/pub/synbath/SYNBATH_V2.0.nc` (đo listing).

### 2.6. SYSU_Topo (1′, SWOT) và BPGGM_BAT (SCS) — thô hơn GEBCO, chỉ để tham khảo vùng sâu

- **SYSU_Topo v1.0**: Sun Yat-sen Univ. (TQ) + NYCU (Đài Loan), Zenodo 17958545, 2025-12-17, **1 arc-minute (~1,85 km)**, CC BY 4.0, 349 MB. Tự nhận "tốt nhất ở Biển Đông, SD 132 m" — là sai số vùng sâu. **Thô hơn GEBCO 4 lần → loại cho mục tiêu ven bờ.** 🚩 TQ.
- **BPGGM_BAT / SWOT_BAT**: Zenodo 13861508 & 13709606 (Chen Xiaodong, 2024), hộp 105–122°Đ 0–26°B và 112–118°Đ 10–18°B, file `.grd` 5,7 MB → độ phân giải ~1–2′. Loại cùng lý do. 🚩 TQ.

### 2.7. PANGAEA — multibeam thô RV Sonne ở bắc Biển Đông

- **SO221 (2012, EM120)** PANGAEA 965072: hộp 113,2–116,3°Đ, 18,4–20,2°B. **SO269 (2019, EM122 + EM710)** PANGAEA 945591/945593: hộp 112,1–116,8°Đ, 17,7–22,3°B. CC BY 4.0, **dữ liệu thô** chưa xử lý (thiếu SVP → có artefact). Nằm **ngoài thềm VN**, phần lớn nước sâu phía bắc Hoàng Sa. Giá trị cho ngư dân ven bờ: ~0. Ghi lại vì là multibeam mở duy nhất tìm thấy gần hộp (đo qua JSON-LD).
- Rà cùng từ khoá: **0 bộ** cho Vietnam shelf / Tonkin / Mekong shelf (chỉ có DEM sông Tiền 1 m — PANGAEA 909665 — và hồ Biển Hồ). SEANOE API không trả kết quả.

### 2.8. Thương mại / hạn chế

| Nguồn | Có gì | Giá | Cờ |
|---|---|---|---|
| **EOMAP** (Đức) | SDB "250+ thực thể Biển Đông", lưới 15 m (2 m theo yêu cầu), tới đường 25 m, công bố 6/2015; nay bán qua EOStore / SDB-Online pay-per-use. Web chặn bot (403) — không lấy được giá | Báo giá | Thông cáo dùng "South China Sea"; tên đảo chưa kiểm được |
| **TCarta** (Mỹ) | G-SDB toàn cầu Sentinel-2 + ICESat-2 (140 triệu điểm ICESat-2), 10 m; bán qua DHI/TCarta Bathymetrics portal theo km² | Theo km² (không công khai) | Không |
| **Taiwan ODB** | API GEBCO subset + dữ liệu tàu; raw *"currently not available to foreign nationals"* (đo) | — | Loại (không truy cập được) |
| **JAMSTEC / KIOST** | Không tìm thấy bộ nào ở vùng VN | — | — |
| **Google Earth Engine** | Không có dataset SDB ven biển toàn cầu trong catalog (chỉ GLOBathy hồ 30 m, ACA habitat). Li et al. 2021 là **phương pháp**, không phát hành asset | — | — |

### 2.9. Việt Nam — bài báo có, dữ liệu không

- Nha Trang MPA SDB bằng **PlanetScope 3–5 m**, −0,5 → −40 m (VJES, DOI 10.15625/2615-9783/24020, 2026): **không có dữ liệu kèm**. Nhật Lệ (VJMST 22634): tương tự. Đầu mối: Trung tâm Nhiệt đới Việt–Nga (chi nhánh ven biển) — có thể xin.

---

## 3. Xếp hạng 5 nguồn đáng lấy nhất — (giá trị cho ngư dân ven bờ 0–50 m) ÷ (công sức)

| # | Nguồn | Giá trị 0–50 m | Công sức | Bước tải ĐẦU TIÊN (chạy được ngay) |
|---|---|---|---|---|
| **1** | **GEBCO_2026 TID** (lớp độ tin cậy cho nền hiện có) | ★★★★☆ — không thêm độ sâu nhưng nói thật với bà con chỗ nào là ước tính; Vịnh Bắc Bộ 98,9 % ước tính | **1–2 ngày** | `pip install rasterio` rồi đọc cửa sổ: `rasterio.open("https://data.source.coop/giswqs/gebco-bathymetry/gebco_2026_tid/gebco_2026_tid_n90.0_s0.0_w90.0_e180.0.tif").read(1, window=from_bounds(102,5,118,23, src.transform))` (script mẫu đã chạy: `tid_vn.py` trong scratchpad phiên này) |
| **2** | **ATL24 V2** (thay V1 trước 11/2026) | ★★★★☆ — nguồn đo thật duy nhất chạm thềm ven bờ VN | **2–3 ngày** đổi version + lọc lại | `curl -I "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL24&version=002&bounding_box=105,8,112,18"` → 1 186 granule; tải bằng `earthaccess.search_data(short_name="ATL24", version="002", bounding_box=(105,8,112,18))` |
| **3** | **SCSBathy10** 🚩 | ★★★☆☆ — chỉ đảo/rạn, nhưng 126 MB gọn, RMSE 0,67 m, 35,8 triệu px (hơn HHU24), đã đọc được bằng `netCDF4` không trục trặc (khác HHU24 có bẫy lat/lon) | **2 ngày** (đổi tên VN theo bảng 66 dòng, hợp nhất với HHU24, kiểm datum bằng ATL24) | `curl -L -o Products.zip "https://zenodo.org/api/records/19148819/files/Products.zip/content"` (126,5 MB; đo: Zenodo chậm ~100 KB/s, cần `-C -` để nối) |
| **4** | **Allen Coral Atlas bathymetry** (kiểm lại, vẫn CC BY) | ★★★☆☆ — rạn ven bờ VN (Phú Quốc, Côn Đảo, Cù Lao Chàm, Nha Trang) mà HHU24/SCSBathy10 **không có** | 3–5 ngày (cần tài khoản) | Đăng nhập https://allencoralatlas.org/atlas → vẽ vùng → gói "Bathymetry" GeoTIFF |
| **5** | **LGMM-SDB** 🚩 | ★★☆☆☆ — cùng vùng rạn với #3 nhưng có **dải sai số** từng pixel; nặng 1,56 GB | 3–4 ngày | `curl -L -C - -o lgmm.nc "https://zenodo.org/api/records/22787173/files/lgmm_depth_uncertainty.nc/content"` (779 MB) |

**Không vào top 5 nhưng nên biết**: SRTM15+ SID_V2.7 (giấy phép UCSD phi thương mại — chỉ phân tích nội bộ, lớp hiển thị dùng GEBCO); SYSU_Topo/BPGGM (thô hơn GEBCO); PANGAEA SO221/SO269 (ngoài thềm); EOMAP/TCarta (xin báo giá — đáng gõ cửa nếu chủ dự án muốn mua lớp 10–15 m cho **thềm ven bờ**, vì đó là chỗ **không nguồn mở nào lấp được**).

## 4. Việc không tra được (để người sau khỏi tìm lại)

- Giá EOMAP/TCarta cho vùng VN (web chặn bot; phải email).
- Danh sách 82 rạn của LGMM-SDB (chưa tải 779 MB).
- Datum thẳng đứng của SCSBathy10 (file không ghi).
- Nguồn gốc khối TID 17 ở Nam Trung Bộ / thềm Mekong trong GEBCO_2026 (GEBCO không phát hành dữ liệu gốc).
- Bài báo đi kèm SCSBathy10 (không tồn tại tới 2026-10-22).
- ScienceDB / NESSDC (kho dữ liệu TQ): không rà được bằng công cụ tìm kiếm phương Tây; nếu chủ dự án không loại nguồn TQ thì cần rà trực tiếp bằng tiếng Trung.

## Phụ lục — lệnh đã dùng (đo)

```bash
# Zenodo tìm theo tiêu đề (q= thường trả rác, phải dùng field query)
curl -G https://zenodo.org/api/records --data-urlencode \
 'q=title:bathymetry AND (Vietnam OR Tonkin OR Beibu OR Mekong OR Spratly OR Nansha OR Paracel OR Xisha OR "South China Sea")'
# PANGAEA
curl -G https://ws.pangaea.de/es/pangaea/panmd/_search --data-urlencode 'q=bathymetry AND (Vietnam OR Tonkin OR Mekong OR Spratly OR "South China Sea")'
curl -H 'Accept: application/json' 'https://doi.pangaea.de/10.1594/PANGAEA.965072?format=metadata_jsonld'
# ATL24 V1 vs V2
curl -sI 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL24&version=002&bounding_box=105,8,112,18' | grep -i cmr-hits
# GEBCO 2026 COG listing
curl https://data.source.coop/giswqs/gebco-bathymetry/
# SRTM15+ (cert lỗi)
curl -k https://topex.ucsd.edu/pub/srtm15_plus/README_V2.7.txt
```
