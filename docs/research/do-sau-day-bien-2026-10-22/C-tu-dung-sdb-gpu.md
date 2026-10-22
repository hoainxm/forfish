# Phương án C — ForFish tự dựng độ sâu ven bờ 0–30 m bằng Sentinel-2 + ICESat-2 (SDB)

> Nghiên cứu phương pháp, 2026-10-22. Nền: `docs/research/nguon-do-sau-2026-08.md` §4.1 (HHU24SWDSCS), §4.4 (ATL24), §4.6 (SDB tự làm), §5 (pháp lý). Mỗi con số ghi rõ **đo** (tự chạy trên repo/máy), **ước** (suy luận), hay **theo bài báo** (kèm DOI/URL). Máy chạy: RTX 3060 12 GB, WSL2, 23 GB RAM.

## 0. Kết luận một đoạn

Làm được, nhưng chỉ cho **nước trong**. Công thức đã được chứng minh ở quy mô Biển Đông (HHU24SWDSCS, ESSD 2025): điểm đáy ICESat-2 làm nhãn, Sentinel-2 L2A làm ảnh, hồi quy tuyến tính trên log phản xạ → lưới 10 m, RMSE 0,82 m, tới ~30 m. Từ 4/2025 NASA đã phát hành **ATL24** — chính là bước khó nhất (phân loại photon đáy, hiệu chỉnh khúc xạ) đã làm sẵn, nên ForFish chỉ còn phần ảnh + hồi quy, là việc một GPU phổ thông chạy không người trông được. Chỗ **không làm được** là nước đục (cửa sông Hồng, cửa Mekong, Tây Nam bùn): ánh sáng không tới đáy, không bài báo nào trong 2023–2026 vượt được rào này bằng quang học; ở đó chỉ còn vệt ATL24 thưa, tin được tới cỡ **1 độ sâu Secchi** (theo bài báo).

## 1. Phương pháp SDB hiện đại — nước trong và nước đục

**Ba họ thuật toán**

| Họ | Cách | Khi nào dùng |
|---|---|---|
| Stumpf log-ratio (2003) | `z = m1·ln(nπR_lam)/ln(nπR_lục) − m0`, 2 hệ số | Đáy một kiểu, nước trong, ít nhãn; chịu đáy đổi màu tốt hơn Lyzenga |
| Lyzenga / **LBM tuyến tính** | `z = h0 + Σ hi·ln(R(λi) − R∞(λi))`, 3 băng B2 B3 B4, trừ phản xạ nước sâu R∞ | **Chính HHU24SWDSCS dùng họ này** (theo bài báo, DOI 10.5194/essd-17-2463-2025): hồi quy đa biến, không ML, lọc tương quan Pearson < 0,4 |
| Học máy (RF / XGBoost / CNN) | Đầu vào: tỉ số băng, NDWI, red-edge B5–B7, (tuỳ) SAR + triều | Nhiều nhãn ATL24, đáy hỗn hợp. XGBoost + Bayesian opt đạt RMSE 0,45 m, R² 0,97 **so với chính ATL24** (Langebaan Lagoon, Frontiers Rem. Sens. 2026, DOI 10.3389/frsen.2026.1751006) — con số này KHÔNG so với đo độc lập, tác giả tự nói rõ |

**Bốn bước tiền xử lý quyết định chất lượng**, rút từ các bài trên:
1. *Hiệu chỉnh khí quyển*: L2A (Sen2Cor) đủ cho HHU24SWDSCS; bài Langebaan dùng **ACOLITE DSF** + khử loé mặt trời bằng B11/B12. Bắt đầu bằng L2A, nâng lên ACOLITE nếu RMSE xấu.
2. *Mặt nạ*: SCL (mây/bóng/sóng bạc) + NDWI + mặt nạ nước sâu từ GEBCO (>100 m làm R∞, theo HHU).
3. *Tổng hợp nhiều ảnh*: hai cách — hợp ảnh (median composite) rồi hồi quy một lần; hay hồi quy từng ảnh rồi **trung bình bản đồ độ sâu** (Langebaan: 16 cảnh). Bài so sánh chuyển vùng (arXiv 2606.02764) kết luận median theo nhiều lượt chụp giảm nhiễu góc nắng/khí quyển/triều.
4. *Nhãn*: ATL24 lọc `class_ph = 40` (đáy), `confidence > 0,8`, bỏ điểm có `sigma` lớn; Parrish et al. 2025 (Earth & Space Sci., DOI 10.1029/2025EA004391) đo 8 vùng: ATL24 **lệch sâu 9–10 cm** hệ thống, và có điểm nhận nhầm mặt biển thành đáy sai tới **21,5 m** khi biển động → lọc theo trạng thái biển là bắt buộc. Kiểm độc lập bằng MBES: RMSD 0,34 / 0,78 / 0,89 m ở 5–25 m (3 vùng, Ireland/NZ/Úc).

**Sai số kỳ vọng theo độ sâu (theo bài báo, nước trong, 10 m)**

| Dải | RMSE | Nguồn |
|---|---|---|
| 0–3 m | 0,26–0,5 m | arXiv 2606.02764 (≤3 m: 0,26 m); Langebaan 0,36–0,57 |
| 0–20 m toàn dải, cùng vùng huấn luyện | **1,15–1,92 m** | arXiv 2606.02764 (Pratas + GBR, RF và 4 CNN) |
| 0–30 m, Biển Đông | 0,82 m toàn vùng; 0,53–1,24 theo tiểu vùng; >90 % ô có RMSE < 5 % độ sâu tối đa | HHU24SWDSCS |
| **Chuyển sang vùng khác không huấn luyện lại** | RF nhảy 1,53 → **2,99–3,78 m**; CNN 2,46–2,98 m | arXiv 2606.02764 → phải huấn luyện **theo vùng** |
| Nha Trang (PlanetScope, RF) | 2,66 m, R² 0,85 | Vietnam J. Earth Sci. 2025, vjs.ac.vn/jse/article/view/24020 |

**Nước đục — cái gì có, cái gì không**
- Xie et al. 2023 (Front. Earth Sci., DOI 10.3389/feart.2023.1111817): RF trên ICESat-2 + S2 ở nước đục, RMSE **1,31–1,36 m**, nhưng chỉ ở dải nông còn nhìn thấy đáy.
- Tổng quan ISPRS JPRS 2025 (sciencedirect pii S0924271625001145): khung đa nguồn thêm SAR + triều cho RMSE **1,64 m nước trong / 2,32 m nước đục**.
- Bảy cảng Biển Đông (Remote Sens. 2024, DOI 10.3390/rs16234349): S2 hơn Landsat-8 ở độ đục 36–203; không rút được RMSE (trang chặn).
- **Không tìm được bài nào** làm SDB quang học ở cửa Mekong hay sông Hồng 2023–2026 (đã tra 3 lượt). Lý do vật lý: SDB thấy được tới ~1,5–2 lần độ Secchi; plume cửa sông Secchi ~0,5–2 m (ước) → trần hữu dụng **3–5 m**, thấp hơn cả ngưỡng tàu cá cần.
- ICESat-2 cũng dừng ở **≈1 Secchi** (Parrish et al. 2019, DOI 10.3390/rs11141634: Kd(490) 0,05–0,12 m⁻¹; Baltic 0,87 Secchi). Nên 19 173 "điểm đáy" ở cửa Mekong (đo trong §4.4 cũ, chưa lọc) phần lớn là phù sa lơ lửng hoặc đáy rất nông <3 m — **phải lọc lại trước khi tin**.
- Thứ duy nhất không sợ đục là nghịch đảo sóng (S2Shores, 1 km; Copernicus Marine COASTAL_L4 11/2025, 100 m, "not for navigation", chưa rõ licence) — thô, chỉ làm lớp hiệu chỉnh GEBCO.

## 2. Mã nguồn mở chạy được ngay

| Repo | Licence | Ngôn ngữ · vào → ra | Tái lập HHU-kiểu? |
|---|---|---|---|
| **ATL24** (NSIDC, qua `earthaccess`/Harmony hoặc `sliderule` `atl24x`) | NASA mở; `earthaccess` MIT, `sliderule` client BSD-3 | Python; hộp toạ độ → điểm (lat, lon, ortho_h, class_ph, confidence, sigma) | **Thay toàn bộ bước photon của HHU** — đây là lý do làm được bây giờ mà 2024 chưa |
| C-SHELPh (github.com/nmt28/C-SHELPh, `pip install cshelph`) | **Apache-2.0** (kiểm trang repo) | Python; ATL03 .h5 + laser + ngưỡng mật độ → photon đáy, đã hiệu chỉnh khúc xạ + EGM2008 | Chỉ cần khi ATL24 bỏ sót vệt (ATL24 bản thân có cshelph trong bộ phân loại) |
| sliderule-atl24 (SlideRuleEarth) | BSD-3-Clause | C++/Python; thuật toán ATL24 (coastnet, qtrees, openoceans++, cshelph, bathypathfinder, ensemble) | Tham chiếu cách lọc; không cần chạy lại |
| icepyx | BSD-3 | Python; truy vấn/tải ICESat-2 | Thay thế cho earthaccess |
| **ACOLITE** (github.com/acolite/acolite, bản 20260421) | **GPL-3.0 ⚠️** | Python; L1C → Rrs NetCDF, khử loé; **không có mô-đun SDB** (kiểm repo) | Dùng như công cụ ngoài, sinh file dữ liệu → GPL không lan vào mã ForFish; cắm cờ, không `import` |
| DL_bathy (github.com/buckai-observatory/DL_bathy, arXiv 2606.02764) | Chưa xem được LICENSE ⚠️ | PyTorch; patch S2 → độ sâu, có trọng số sẵn | Kiến trúc CNN tham khảo cho tuần 3 |
| OpenOceans (jonm3D), ICEBath (PyPI), Bathymetrix-AI (QGIS) | Chưa xác nhận licence ⚠️ (plugin QGIS thường GPL) | Python | Không cần |
| GEE scripts (Traganos 2018; Thomas 2021 GRL) | Mã mở, nhưng **Earth Engine thương mại phải trả phí Google Cloud** | JS/Python | Bỏ — SDVICO là pháp nhân thương mại; chạy GPU nhà rẻ hơn và không vướng điều khoản |
| HHU24SWDSCS | Dữ liệu CC BY; **không công bố mã** (kiểm bài báo) | — | Tái lập được bằng tay: LBM 3 băng là 10 dòng `numpy.linalg.lstsq` |

Kết luận §2: toàn bộ chuỗi làm được với licence sạch (MIT/BSD/Apache) **trừ ACOLITE** (GPL, chỉ dùng như binary ngoài, tuỳ chọn).

## 3. Đường ống trên GPU cho Việt Nam

**Dữ liệu vào**
- *Sentinel-2 L2A*: CDSE quota người dùng thường (kiểm trang Quotas): **12 TB/30 ngày**, 4 kết nối × 20 MB/s, S3 2 000 req/phút, Sentinel Hub 10 000 PU/tháng. Đọc **S3 từng băng** (B2 B3 B4 B8 B11 B12 + SCL) **cắt theo mặt nạ 0–30 m** từ GEBCO (đệm 5 km) — không tải cả tile. Ước: bờ VN chạm ~38 tile S2, lấy 25–30 cảnh ít mây/tile (2019–2026) → **~700–1 100 cảnh**, mỗi cảnh sau cắt 150–400 MB → **120–250 GB** đĩa; thời gian tải 2–4 ngày ở 20–60 MB/s.
- *ATL24*: 2 373 granule hộp VN (đo CMR 8/2026); qua `atl24x` chỉ lấy điểm → **<3 GB**, vài giờ.
- *Triều*: 83 trạm điều hoà + 4 đo thật trong `tide-stations.v1.json` (§4).
- *Kiểm chứng*: 394 điểm + 313 tuyến TBHH (`soundings.v1.json`, lấy 2026-09-01), 178 điểm cảng vụ, HHU24SWDSCS ở Đá Tây/Song Tử Tây (0,41–0,64 triệu điểm) cho kiểm chéo ngoài khơi.

**Chia ô và vùng** — ô 1°×1° (ước 24 ô chạm bờ), gom thành 3 mô hình vùng theo kết luận "chuyển vùng là mất 2 m" (arXiv 2606.02764):
- **Bắc Bộ đục** (Móng Cái → Ninh Bình; riêng Hạ Long–Cát Bà–Cô Tô tách thành tiểu vùng nước trong hơn),
- **Trung trong** (Thanh Hoá → Bình Thuận + Cồn Cỏ, Lý Sơn, Phú Quý),
- **Tây Nam bùn** (Vũng Tàu → Kiên Giang; Phú Quốc, Thổ Chu, Côn Đảo tách riêng vì trong).

**Các bước mỗi ô (không người trông, Python, log ra file)**
1. Lọc ATL24: class 40, confidence > 0,8, sigma < 0,5 m, bỏ granule biển động (sea-state từ ATL24 `surface_h` phương sai), trừ lệch 0,10 m hệ thống (Parrish 2025). Ghim thời điểm từng photon.
2. Quy mọi độ sâu về **số 0 hải đồ** (§4).
3. Với mỗi cảnh S2: mặt nạ SCL + NDWI + glint B11/B12 + ngưỡng đục (B4 cao, tỉ số B4/B2) → đặc trưng: ln(B2−R∞), ln(B3−R∞), ln(B4−R∞), B2/B3, B2/B4, B3/B8, B5–B7, triều lúc chụp.
4. Mô hình A: LBM (HHU) làm baseline. Mô hình B: **XGBoost GPU** (`device=cuda`) — vài triệu điểm nhãn, **phút**. Mô hình C (tuỳ, tuần 3): U-Net nhỏ, patch 256², **2–6 giờ/vùng** trên 3060 (ước).
5. Dự đoán từng cảnh → median theo cảnh → lưới 10 m + bản đồ **độ bất định** (độ lệch giữa các cảnh + khoảng tin cậy mô hình). Ô nào bất định > 2 m hoặc < 5 cảnh hợp lệ → **không phát hành**.

**Kiểm định** — giữ-ra theo **RGT ICESat-2** (cả tuyến, không trộn điểm) 20 % + giữ-ra theo **khối không gian liền** (bài học arXiv 2606.02764); báo RMSE theo dải 0–3 / 3–10 / 10–20 / 20–30 m. Đối chiếu TBHH: lưu ý 394 điểm nằm ở **luồng nạo vét trong cảng đục** — là bài kiểm cho vùng SDB *yếu nhất*, lệch sẽ lớn; dùng để vẽ ranh "không tin SDB" chứ không phải để chấm điểm mô hình.

**Kết quả mong đợi (ước, suy từ bảng §1)**: Trung trong 0–10 m RMSE 0,6–1,0 m; 10–20 m 1–2 m; 20–30 m 2–4 m hoặc không hội tụ. Bắc Bộ/Tây Nam: chỉ dải 0–4 m có tín hiệu, RMSE 1–2,3 m, không phát hành lưới.

**Chỗ KHÔNG làm được — ghi để khỏi hứa hão**: (a) nước đục Secchi < 2 m (ước: toàn plume sông Hồng, cửa Mekong tới ~20 km ra khơi mùa lũ, Cà Mau–Kiên Giang bùn) — không lưới, chỉ vệt ATL24 đã lọc; (b) sâu > 25–30 m dù nước trong — phản xạ đáy tắt; (c) mùa gió mùa Đông Bắc (10–2) ít cảnh sạch ở Trung; (d) đáy đổi mùa (cửa sông bồi xói, luồng nạo vét) — lưới tổng hợp 7 năm là *đáy trung bình*, không phải đáy hôm nay; (e) đây là SDB, không phải khảo sát: không thay hải đồ, không dùng dẫn luồng — nhãn trong app phải nói đúng vậy.

## 4. Datum — ảnh chụp lúc triều nào, quy về số 0 hải đồ thế nào

- ATL24 cho `ortho_h` (EGM2008) của mặt biển và đáy tại **giây chụp**; độ sâu tức thời = mặt − đáy. S2 bay qua VN ~10:30 giờ địa phương, ICESat-2 bất kỳ giờ nào → hai nguồn lệch triều có thể tới 2–3 m (nhật triều Bắc Bộ biên độ 3–4 m).
- Quy trình: với mỗi nhãn ATL24, tính triều `η(t_ICESat)` tại trạm gần nhất (hoặc nội suy 2 trạm dọc bờ) từ bộ điều hoà → `z_MSL = z_tức_thời − η`; với mỗi cảnh S2 tính `η(t_S2)` → đưa nhãn về triều của *chính cảnh đó* trước khi hồi quy (vì phản xạ đo cột nước lúc chụp); sau khi dự đoán, cộng ngược về MSL rồi về **số 0 hải đồ**: `z_HĐ = z_MSL + z0`, với `z0` là độ cao MSL trên số 0 hải đồ của trạm (vd Hòn Dấu `z0 = 1,97 m` trong `tide-stations.v1.json`, đo).
- Sai số datum (ước, cộng bình phương): dự báo điều hoà ~0,15 m (Hòn Dấu `rmseM 0,149`, đo; trạm ít hằng số có thể 0,3) ⊕ nội suy giữa trạm cách 50–100 km 0,2–0,3 m ⊕ `z0` suy từ nguồn thứ cấp 0,1–0,3 m ⊕ EGM2008 ven bờ VN 0,1–0,2 m → **0,3–0,5 m**. Nhỏ hơn RMSE SDB ở 10–20 m nhưng **ngang với RMSE ở 0–3 m** — nghĩa là ở bãi cạn, datum là nguồn sai số chính. Cách giảm: ở 4 trạm đo thật dùng số đo thật; so `η` điều hoà với mặt biển ATL24 (`surface_h`) ngay trên vệt để hiệu chuẩn pha từng trạm — miễn phí, nên làm ở tuần 1.

## 5. Luật ghép nguồn

- **Sentinel-2**: Copernicus "free, full and open"; cho sửa, ghép, bán dẫn xuất; **bắt buộc ghi** "Contains modified Copernicus Sentinel data [2019–2026]".
- **ICESat-2 / ATL24**: dữ liệu NASA, không hạn chế thương mại; ghi "NASA ICESat-2 ATL24 (NSIDC)". Chưa tìm thấy điều khoản riêng cấm bán dẫn xuất.
- **Allen Coral Atlas**: CC BY 4.0 — không share-alike → dẫn xuất được phát hành độc quyền, miễn ghi nguồn + ghi "đã chỉnh sửa".
- **HHU24SWDSCS**: CC BY, nhưng chỉ dùng để *kiểm chứng* ngoài khơi; không trộn vào lớp phát hành (tránh nghĩa vụ ghi "Hohai University" trong app, xem §4.1 cũ).
- **ACOLITE GPL**: chỉ chạy như công cụ, đầu ra là dữ liệu → không ảnh hưởng LICENSE.
- Ghép tất cả rồi phát hành dưới LICENSE SDVICO: **được**, với điều kiện phần "Dữ liệu bên thứ ba" của LICENSE thêm ba dòng ghi nguồn trên và màn Bản đồ hiển thị credit (giống credit OSM hiện có). Lớp mã hoá SDF2 không vi phạm điều khoản nào trong ba nguồn.
- ⚠️ Rào trong nước giữ nguyên như §5.2 doc cũ: QĐ 562/QĐ-TTg xếp bản đồ địa hình đáy biển quần đảo/bãi ngầm vào mật — SDB ven bờ đất liền 10 m, nguồn vệ tinh công khai, nhãn "tham khảo" là vùng xám; **hỏi tư vấn pháp lý trước khi phát hành**, không phải trước khi thử nghiệm.

## 6. Kế hoạch 4 tuần trên GPU

| Tuần | Làm gì (không người trông = ⏱) | Cổng số qua / không qua |
|---|---|---|
| **1 — Nhãn + datum** | ⏱ `atl24x` toàn hộp VN → lọc class/confidence/sigma/sea-state; ⏱ tính triều điều hoà cho từng photon; hiệu chuẩn pha trạm bằng `surface_h`; dựng mặt nạ 0–30 m từ GEBCO; chạy LBM thử ở 1 ô Nha Trang với 10 cảnh L2A | Qua nếu: ≥ 200 000 điểm đáy sạch ở Trung; lệch `η` điều hoà – ATL24 mặt biển RMSE < 0,3 m ở ≥ 60 trạm; LBM Nha Trang hold-out-RGT RMSE < 1,5 m (0–20 m). Không qua → dừng, viết lại §0 |
| **2 — Tải + XGBoost toàn bờ** | ⏱ tải S2 cắt theo mặt nạ cho 24 ô (2–4 ngày); ⏱ sinh đặc trưng; XGBoost GPU 3 vùng; dự đoán median; bản đồ bất định | Qua nếu: Trung trong hold-out RMSE ≤ 1,2 m (0–10 m) và ≤ 2 m (10–20 m); ≥ 70 % diện tích 0–20 m vùng Trung có ≥ 5 cảnh hợp lệ. Bắc/Tây Nam: ghi nhận trần độ sâu còn tín hiệu (kỳ vọng 3–5 m) — không chấm điểm |
| **3 — Nâng cấp + kiểm chéo** | ⏱ ACOLITE cho vùng Trung (ước 3–5 phút/cảnh CPU → 30–50 h); ⏱ U-Net nhỏ 1 vùng; đối chiếu TBHH 394 điểm + 178 cảng vụ (vẽ bản đồ lệch, không chấm điểm); đối chiếu HHU ở Đá Tây | Qua nếu: ACOLITE hoặc U-Net giảm RMSE ≥ 15 % so tuần 2, nếu không giữ XGBoost+L2A (rẻ); lệch với TBHH ngoài luồng nạo vét < 1,5 m |
| **4 — Đóng gói** | Gộp lưới 10 m vùng đạt cổng + vệt ATL24 lọc cho vùng đục → định dạng delta+varint theo luật `public/data` (<20 MB/file); ghi nguồn vào LICENSE + màn Bản đồ; cập nhật 01/02/04 + external-services; chuẩn bị hồ sơ hỏi pháp lý §5 | Qua nếu: tổng file < 60 MB, test `data-codec` xanh, lớp bật/tắt offline được, nhãn "Độ sâu ước lượng từ vệ tinh — tham khảo, không thay hải đồ" hiện trên mọi ô |

**Dòng trung thực**: *Nếu mọi thứ xuôi*, ForFish có lưới 10 m dải 0–20 m, RMSE ước 1–1,5 m (theo bài báo 0,8–1,9 m), cho khoảng **50 % bờ biển** (ước: Thanh Hoá → Bình Thuận + các đảo trong), còn khoảng **40 %** (Bắc Bộ, Đông Nam Bộ, cửa Mekong, Tây Nam bùn — ước) chỉ có vệt ATL24 thưa hàng km, tin được tới ~1 Secchi (2–5 m), và ~10 % trung gian tuỳ mùa; dải 20–30 m chỉ hiện ở nơi bất định < 2 m. Không chỗ nào thay được hải đồ.
