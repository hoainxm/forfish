# Báo cáo nhóm mực & bạch tuộc (cephalopod) — hồ sơ loài dự báo cá SDFish

**Load khi / Load when**: nguồn sinh thái mực — load khi sửa hồ sơ nhóm cephalopod.

Ngày: 2026-10-03 · Agent: nghiên cứu sinh thái loài · Nguồn hồ sơ đối chiếu: `profiles-current.json` (5 mục `category: "cephalopod"`).
Ngân sách tra cứu: ~22 lượt WebSearch/WebFetch (dưới trần 25). Nhiều trang (ResearchGate, tandfonline, sealifebase.ca) chặn 403 — đã dùng bản mirror (sealifebase.se, pmc.ncbi.nlm.nih.gov) hoặc trích PDF về đọc bằng `pdftotext`.

Ký hiệu độ tin: **cao** = ≥2 nguồn độc lập hoặc khảo sát ở Biển Đông/VN · **vừa** = 1 nguồn tốt hoặc nguồn vùng lân cận (Vịnh Thái Lan, Biển Hoa Đông) · **thấp** = báo chí / trang thương mại / suy luận.

Quy ước đọc trường trong hồ sơ (theo BRIEF): `sst [a,b,c,d]` trapezoid °C; `chlLog [lo,hi]` dải log10 mg/m³ ưa thích; `offshore/inshore [a,b]` cổng độ sâu đáy (m); `w` trọng số cơ chế soft-OR.

---

## 0. Định danh chung — Nghị định 37/2024/NĐ-CP Phụ lục V (mục 4, loài hải sản)

Trích từ bản PDF Phụ lục V (fisheryprogress.org lưu bản 04/04/2024):

| # | Tên VN trong NĐ | Tên khoa học trong NĐ | Cỡ tối thiểu |
|---|---|---|---|
| 1 | Mực ống | *Loligo edulis*, *Loligo chinensis* | ML 80 mm |
| 2 | Mực ống beka | *Loligo beka* | ML 170 mm (ghi trong bảng; có thể là lỗi dòng của PDF — cần đối chiếu bản gốc) |
| 3 | Mực lá | *Sepioteuthis lessoniana* | ML 60 mm |
| 4 | Mực nang vân hổ | *Sepia pharaonis* | ML (ô trống trong PDF) |
| 5 | Mực nang lửa | *Sepiella inermis* | L 120 mm |

Nguồn: https://fisheryprogress.org/sites/default/files/indicators-documents/Action%202.2-240404-Decree%2037-Appendix%205-Minimum%20permitted%20size%20of%20fishery%20species.pdf — lưu ý NĐ 309/2025/NĐ-CP đã **tạm dừng** hiệu lực cỡ tối thiểu một số loài (trong đó có "Squid Loligo chinensis & Loligo edulis") (https://thuvienphapluat.vn/van-ban/Linh-vuc-khac/Nghi-dinh-309-2025-ND-CP-sua-doi-Nghi-dinh-26-2019-ND-CP-682620.aspx). **Mực xà và bạch tuộc KHÔNG có trong Phụ lục V** → định danh theo tên ngư dân + tài liệu RIMF.

Tên hiện đại (WoRMS/SeaLifeBase): *Loligo chinensis* = *Uroteuthis (Photololigo) chinensis*; *L. edulis* = *U. edulis*; *L. duvaucelii* = *U. duvaucelii*; *L. beka* = *Loliolus (Nipponololigo) beka*; *Sepia pharaonis* = *Acanthosepion pharaonis*.

---

## 1. MỰC XÀ — *Sthenoteuthis oualaniensis* (mực đại dương, purpleback flying squid)

### 1.1 Định danh
Tên ngư dân: mực xà, mực đại dương, mực ma (Quảng Nam–Quảng Ngãi). Một loài duy nhất nhưng ở Biển Đông có **ba dạng kích cỡ** (dwarf / middle-sized / X3, theo đốm phát quang lưng) và ba dòng di truyền (https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2022.891236/full). Không nằm trong NĐ 37 Phụ lục V.

### 1.2 Nhiệt độ (nhiệt MẶT — mọi mô hình HSI/CPUE ở Biển Đông đều dùng SST)
| Nguồn / vùng | Mùa khảo sát | Dải SST | Ghi chú |
|---|---|---|---|
| Bắc–Trung Biển Đông (trong đó có vùng khơi Trung Bộ – Hoàng Sa), khảo sát tháng 3–5 — Yu et al., PMC6351058 | xuân | SST nơi có mực 25–28,5; **tập trung 26,5–28,5**; ảnh hưởng dương lên CPUE 24–28, **âm 28–29,5**; CPUE đỉnh tháng 5 | https://pmc.ncbi.nlm.nih.gov/articles/PMC6351058/ |
| Khơi Trường Sa ("Nansha"), 5–16°N 109–119°E, 2013–2017, mô hình HSI đa tỉ lệ — PMC12190060 | 4 mùa | SST tối ưu: **xuân 28,1 · hè 30,2 · thu 29,0 · đông 28,8**; dải thích nghi ≥0,6: xuân 30,4–30,9 · **hè 30,05–30,35** · thu 28,9–29,15 · đông 27,1–27,6 | https://pmc.ncbi.nlm.nih.gov/articles/PMC12190060/ ; tàu đông nhất tháng 6 (1.056 tàu, 74 % tổng mùa hè) |
| Biển Đông mở, HSI (Yu et al. 2019) | — | **27,4–30,7** | https://www.researchgate.net/publication/332405725 (chỉ đọc được abstract qua kết quả tìm kiếm) |
| Tổng quát loài | — | 16–32 °C, thường >20–22, **rộ >27** | Fishes 2025 10:184 §1 (https://doi.org/10.3390/fishes10040184); SeaLifeBase |
| Nhiệt độ nở (25 m, suy từ statolith) | — | đàn đông 28,05–28,88 (nam Biển Đông); đàn hè–thu 27,38–27,92 (bắc Biển Đông) | https://pmc.ncbi.nlm.nih.gov/articles/PMC10525311/ |

**Kết luận**: loài ấm, mùa hè Trường Sa SST 30–31 vẫn là vùng thích nghi cao (hè 30,05–30,35; xuân ở Nansha 30,4–30,9). Trần 30 °C trong hồ sơ hiện tại bắt đầu phạt đúng khi vào vụ chính tháng 6–8 ở Trường Sa — **cùng kiểu lỗi ngừ ồ**. Nhưng ở phía bắc (Hoàng Sa, tháng 3–5) mực rộ ở 26,5–28,5 và CPUE giảm khi >28 → dải phải RỘNG, không phải dịch lên.

### 1.3 Độ sâu & khoảng cách bờ
- Nghề VN: "cách bờ **trên 150 hải lý**, độ sâu **trên 800 m** nước" — RIMF, Thực trạng nghề câu mực xà (https://www.rimf.org.vn/bantin/chitiet/ThuctrangnghecaumucxaoVietNam và https://www.rimf.org.vn/baibaocn/chitiet/tinid-2181).
- Sinh thái: "sống ở vùng nước mở trên nền đáy sâu **>200–400 m**" (SeaLifeBase/FAO qua kết quả tìm kiếm https://sealifebase.org/summary/SpeciesSummary.php?id=57569).
- Phân bố thẳng đứng: ban ngày **>300 m** (có tài liệu 800–1.200 m), đêm lên **0–200 m** ăn trong lớp xáo trộn/tầng nhiệt; khi câu đèn đêm đàn mực tụ ở **>50 m** rồi mới lên; lưới chụp hiệu quả tới 50 m (Fishes 2025 §1, §4; PMC10525311).
- Hàm ý cho cổng độ sâu: `offshore [80, 250]` hiện tại cho điểm cao ngay trên thềm 80–250 m — **mâu thuẫn trực tiếp** với "trên 800 m". Thềm miền Trung dốc nên cổng này đang kéo mực xà về sát bờ (đúng lỗi "cá khơi hiện sát bờ" trong BRIEF).

### 1.4 Mồi / chl-a
- Vùng nước **nghèo** (oligotrophic): chl-a 0,10–0,35 mg/m³ ảnh hưởng dương, 0,05–0,20 âm; đỉnh CPUE tháng 5 đi sau đỉnh chl-a tháng 3 khoảng 6 bước 10 ngày (~2 tháng) — PMC6351058.
- HSI Trường Sa: chl thích nghi xuân 0,06–0,08; hè 0,21–0,25; thu 0,09–0,19; đông 0,18–0,19 mg/m³ (PMC12190060). Vùng câu chính Ấn Độ Dương: chl 0–0,2 mg/m³, tương quan dương với CPUE (Fishes 2025 abstract).
- log10: 0,06 → −1,22 · 0,10 → −1,0 · 0,25 → −0,60 · 0,35 → −0,46. Dải hiện tại `[-1, -0.1]` (0,10–0,79 mg/m³) **lệch về phía nước giàu**: nửa trên (0,35–0,79) không có bằng chứng, còn vùng 0,06–0,10 (xuân Trường Sa) bị loại. Săn cá nhỏ/chaetognath trong lớp xáo trộn — lệ thuộc chl gián tiếp, có trễ ~2 tháng.

### 1.5 Cơ chế gom cá — bằng chứng
| Cơ chế | Bằng chứng | Hướng |
|---|---|---|
| **Xoáy / SSH** | SSH là biến giải thích mạnh nhất (30,1 % phương sai), CPUE cao nhất quanh SSH ≈ 0 và **phía xoáy lạnh ở nơi hội lưu xoáy lạnh–nóng**; mô hình tối ưu SSH + EKE (34,9 %) — Fishes 2025 (Ấn Độ Dương xích đạo). Ở Biển Đông, ấu trùng phát triển trong **hoàn lưu xoáy nghịch (nóng) quy mô vừa** — PMC10525311 | Giữ `eddy` cao; cả hai phía xoáy đều có vai trò (rìa) |
| **Tầng nhiệt / gradient 5–50 m** | Yan Lei et al. (Biển Đông, trích trong Fishes 2025 §4): gradient nhiệt thẳng đứng 5–50 m là yếu tố ảnh hưởng nhất; sản lượng **giảm khi gradient tăng vào xuân, tăng khi gradient tăng vào thu**; ST100 tương quan âm với CPUE | Giữ `thermo`; dấu đổi theo mùa — mô hình hiện không tách được, ghi nợ |
| Front nhiệt | Không tìm được bài định lượng riêng về front cho loài này ở Biển Đông (SST, SSH, chl là ba biến chính) | Giữ, hạ nhẹ |
| Nước trồi | 2008 La Niña tăng nước trồi/gió TN → nước lạnh hơn, chl cao hơn nhưng **mực ít hơn** (PMC6351058) | `upw` thấp là đúng |
| Hội tụ dòng | EKE (năng lượng xoáy dòng) vào mô hình tối ưu — phát tán trứng/ấu trùng + gom mồi | Giữ |

### 1.6 Mùa vụ VN theo vùng
- RIMF: hoạt động **giữa tháng 12 → cuối tháng 9** năm sau; "vụ chính tháng 4–9" (Wikipedia tiếng Việt trích RIMF; https://vi.wikipedia.org/wiki/M%E1%BB%B1c_x%C3%A0).
- Báo: tàu Bình Chánh (Quảng Ngãi) xuất bến hàng loạt **16–20 tháng Giêng âm lịch** (≈ tháng 2), mỗi chuyến **~3 tháng**, **3 chuyến/năm**, ngư trường Trường Sa & Hoàng Sa (VOV 2019 https://vov.vn/kinh-te/ngu-dan-quang-ngai-khoi-dong-mua-cau-muc-moi-879037.vov ; Dân Việt 2024 https://danviet.vn/muc-xa-la-loai-muc-gi-ma-cu-tau-cap-bo-la-ngu-dan-hon-ho-mot-xa-bien-thu-hang-tram-ty-dong-20240610152256033-d1166241.html ; Báo Văn hoá https://baovanhoa.vn/doi-song/quang-ngai-ngu-dan-lang-cau-muc-thu-tien-ti-sau-phien-bien-dau-nam-2077.html). Câu bằng thúng + đèn, 16h → sáng; đêm tối trời (không trăng) hiệu quả nhất.
- Mùa sinh học: 4 đàn nở theo mùa; vụ xuân–hè khai thác đàn hè–thu năm trước; vụ thu–đông khai thác đàn đông–xuân (PMC10525311). Ở Trường Sa tàu đông nhất **tháng 6** (PMC12190060). Ở bắc–trung Biển Đông CPUE đỉnh **tháng 5** (PMC6351058).
- Đối chiếu vùng của app: `hoang-sa`, `truong-sa-dk1` đúng. Không có nguồn cho mực xà ở `trung-bo`/`nam-trung-bo` theo nghĩa ven bờ (ngư trường >150 hải lý) — nếu ô 0,25° khơi Trung Bộ sâu >800 m được gắn vùng `trung-bo` thì cần cho phép; đây là việc của lớp gán vùng, không phải hồ sơ.

### 1.7 Đối chiếu hồ sơ → đề xuất
| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| `sst` | [25, 26.5, 30, 31] | **[24, 26.5, 30.5, 32]** | Hè–xuân Trường Sa thích nghi ≥0,6 tới 30,35–30,9 °C; trần 30 đang phạt đúng vụ chính. Đáy 24 theo "ảnh hưởng dương 24–28" | PMC12190060; PMC6351058; RG 332405725 (27,4–30,7) | vừa–cao |
| `chlLog` | [-1, -0.1] | **[-1.2, -0.5]** (0,06–0,32 mg/m³) | Loài nước nghèo; dương 0,10–0,35; xuân Trường Sa 0,06–0,08 | PMC6351058; PMC12190060 | vừa |
| `offshore` | [80, 250] | **[300, 800]** (hoặc tối thiểu a ≥ 300) | Nghề câu ở đáy >800 m, >150 hải lý; loài sống trên nền >200–400 m | RIMF; SeaLifeBase | **cao** |
| `seasons[0].months` | 4–9 (HS, TS) | **2–9 chính** + thêm mục phụ **12–1** (trọng số thấp) nếu schema cho phép | Tàu ra khơi từ tháng 2 (âm 16–20/1), hoạt động 12→9; CPUE đỉnh 5 (bắc) và 6 (Trường Sa) | RIMF; VOV; PMC | cao (2–9) / vừa (12–1) |
| `w.eddy` | 0.3 | **0.35** | SSH mạnh nhất (30,1 %); SSH+EKE tối ưu | Fishes 2025; PMC10525311 | vừa |
| `w.thermo` | 0.25 | giữ 0.25–0.3 | gradient 5–50 m là yếu tố nhất (Yan Lei), nhưng dấu đổi theo mùa | Fishes 2025 §4 | vừa |
| `w.thermFront` | 0.3 | **0.2** | Không tìm được bằng chứng định lượng riêng cho front SST ở loài này | — | thấp |
| `w.upw` | 0.05 | giữ | Nước trồi mạnh ↔ ít mực (2008) | PMC6351058 | vừa |
| `coldCore` | false | giữ **false**, ghi nợ | Ấn Độ Dương: phía xoáy lạnh có lợi; Biển Đông: ấu trùng trong xoáy nghịch (nóng). Mô hình "rìa xoáy" hiện có là đủ | Fishes 2025; PMC10525311 | thấp |
| `tempSource` | (surface mặc định) | giữ **surface** | Ăn đêm trong lớp xáo trộn; mọi HSI dùng SST | PMC | cao |
| `surfaceSignal` | high | giữ | | | — |
| `depthBand` (text) | "tầng nước 10–50 m đêm, xa bờ" | "đêm 0–200 m (đàn tụ >50 m), ngày >300 m; đáy >800 m" | mô tả đúng hơn | Fishes 2025; RIMF | cao |

---

## 2. MỰC ỐNG — *Uroteuthis chinensis* (mực ống Trung Hoa), *U. duvaucelii* (mực ống Ấn Độ), *U. edulis*, *Loliolus beka*

### 2.1 Định danh
Tên "mực ống" **gộp nhiều loài**: NĐ 37 ghi *Loligo edulis*, *L. chinensis*, *L. beka*. Vịnh Bắc Bộ: 8 loài Loliginidae, **L. chinensis và L. beka chiếm ưu thế** (RIMF https://www.rimf.org.vn/baibaocn/chitiet/tinid-783). Phía nam/Vịnh Thái Lan: *U. chinensis* là loliginid nhiều nhất, *U. duvaucelii* đi kèm (Asian Fisheries Science 30(2017):262–273, https://doi.org/10.33997/j.afs.2017.30.4.004).

### 2.2 Nhiệt độ
- *U. chinensis*: SeaLifeBase ghi **21–29 °C**, tầng 15–170 m, "thường 40–150 m" (https://www.sealifebase.se/summary/Uroteuthis-chinensis.html) — nhiệt tầng sống, không hẳn là SST.
- *U. duvaucelii*: tổng quan 28–32 °C (Wikipedia/FAO qua tìm kiếm); khảo sát Biển Hoa Đông–Hoàng Hải: nhiệt **đáy** 24,5–27,0 hè, 20,0–22,8 thu (PMC12189684 — vùng ôn đới hơn VN, chỉ dùng tham khảo).
- Vịnh Thái Lan (tháng 4–7/2015, lưới kéo đáy 10–50 m): nhiệt đáy trung bình 29,5 ± 0,9 °C ở tất cả tầng — mực ống vẫn dồi dào (ASFS 2017, Table 2).
- **Vịnh Bắc Bộ, lưới chụp 2018–2023 (GAM)**: SST **không có ý nghĩa thống kê** với CPUE; pha trăng > năm > tháng (Tạp chí KH-CN Thủy sản ĐH Nha Trang, https://jfst.vn/index.php/ntu/article/view/592).
→ Cổng nhiệt với mực ống nên **rộng và mềm**; nhiệt mặt không phải biến quyết định ở VBB.

### 2.3 Độ sâu & khoảng cách bờ
- VBB: mực "tập trung đều quanh **đường đẳng sâu 30 m**", phân bố **2–35 m nước**, ba khu: Cát Bà–Cô Tô, Bạch Long Vĩ, và khu "Mê Mát" (theo bản tin RIMF); năng suất cao nhất khơi cửa Ba Lạt 72,44 kg/h (RIMF tinid-783).
- Vịnh Thái Lan: *U. chinensis* **tăng theo độ sâu, cao nhất 41–50 m**; *U. duvaucelii* đều từ 10–50 m (ASFS 2017 Table 4, §Discussion).
- Tổng quát: *U. chinensis* 15–170 m; *U. duvaucelii* 3–170 m, lên mặt ban đêm, hướng quang (SeaLifeBase https://www.sealifebase.se/summary/Uroteuthis-duvaucelii.html).
→ Loài **thềm lục địa 5–170 m**, không bao giờ ở nước sâu >500 m. Hồ sơ hiện **không có cổng độ sâu** → cùng lỗi "cá đáy điểm cao trên nước >1000 m".

### 2.4 Mồi / chl-a
Săn cá nhỏ, giáp xác, mực (ăn thịt đồng loại phổ biến — SeaLifeBase). Không tìm được bài định lượng chl-a–CPUE cho mực ống ở Biển Đông; vùng VBB ven bờ chl cao hơn khơi. Dải hiện tại `[-0.7, 0.5]` (0,2–3,2 mg/m³) hợp lý về mặt định tính — **giữ**, không có nguồn để tinh chỉnh.

### 2.5 Cơ chế gom cá
- **Pha trăng**: yếu tố mạnh nhất, CPUE cao gần **trăng non** (jfst 592) — không có trong mô hình; nếu app có lịch trăng (đã có cho con nước), nên thành biến điều biến cho cả nhóm câu/chụp đèn (mực ống, mực xà, mực lá).
- **Đẳng sâu 30 m / nền đáy** (RIMF) — tức cổng độ sâu đáy quan trọng hơn cơ chế mặt.
- Front/xoáy/nước trồi: không tìm được bằng chứng riêng; VBB nông nên "xoáy SSHA" gần như không áp dụng → `w.eddy 0.25` thiếu cơ sở.

### 2.6 Mùa vụ VN theo vùng
| Vùng | Tháng rộ | Nguồn | Độ tin |
|---|---|---|---|
| Vịnh Bắc Bộ | Mùa khai thác **5–11**, mạnh nhất 7–10; năng suất mực ống đỉnh **8–10**, cao nhất **tháng 9** (32,96 kg/h) | RIMF tinid-783 | cao |
| Vịnh Bắc Bộ (lưới chụp 2018–2023) | CPUE cao nhất **tháng 9–10** | jfst 592 | cao |
| Trung Bộ | không tìm được nguồn riêng | — | — |
| Đông Nam Bộ / Tây Nam Bộ | hồ sơ ghi 11–4 (mùa khô) — không tìm được nguồn xác nhận; tham chiếu gần nhất là Vịnh Thái Lan dồi dào tháng 4–7 (ASFS 2017) → chưa đủ để sửa | — | thấp |

### 2.7 Đối chiếu hồ sơ → đề xuất
| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | **[5, 150]** (thêm) | Loài thềm 2–170 m; VBB tụ quanh đẳng sâu 30 m; không có ở nước sâu | RIMF; ASFS 2017; SeaLifeBase | **cao** |
| `seasons[0].months` (VBB, TB) | 5–9 | **5–11** (VBB), đỉnh 8–10 | Mùa 5–11, năng suất đỉnh 8–10, tháng 9 cao nhất; hồ sơ hiện **cắt đúng tháng đỉnh** | RIMF tinid-783; jfst 592 | **cao** |
| `sst` | [22, 24.5, 29.5, 31] | **[20, 23, 30.5, 32]** | SST không có ý nghĩa ở VBB; mực ống dồi dào ở nhiệt đáy 29,5±0,9 (Vịnh Thái Lan); dải loài 21–29 là nhiệt tầng sống. Cổng nên mềm, không phạt mùa hè 29,5–30,5 | jfst 592; ASFS 2017; SeaLifeBase | vừa |
| `w.eddy` | 0.25 | **0.1** | VBB/ven bờ nông, không có bằng chứng xoáy | — (suy luận từ độ sâu) | thấp |
| `w.thermFront` | 0.25 | giữ | không có bằng chứng thêm/bớt | — | — |
| `tempSource` | (surface) | giữ **surface**, ghi chú "nhiệt không quyết định" | GAM VBB | cao |
| `surfaceSignal` | medium | giữ | hướng quang, lên mặt đêm | SeaLifeBase | — |
| `seasons[1]` (TNB, ĐNB 11–4) | 11–4 | **giữ**, đánh dấu "chưa có nguồn" | không tìm được | — | — |
| (mới) điều biến pha trăng | — | ghi nợ: trăng non → ×1,2; trăng tròn → ×0,8 cho nghề đèn | yếu tố mạnh nhất trong GAM | jfst 592 | vừa (hướng), thấp (hệ số) |

---

## 3. MỰC LÁ — *Sepioteuthis lessoniana* (bigfin reef squid)

### 3.1 Định danh
NĐ 37: "Mực lá — *Sepioteuthis lessoniana*" (ML 60 mm). Một loài (phức hợp loài ẩn ở Ấn Độ–Tây Thái Bình Dương nhưng VN dùng một tên). Bài VN gần đây gọi "mực lá đại dương" (Tạp chí Khí tượng Thủy văn 2025, http://tapchikttv.vn/data/article/3869/1.%20Proofreading.pdf — **không tải được**: chứng chỉ SSL tự ký, ResearchGate 403; chỉ biết tiêu đề qua kết quả tìm kiếm).

### 3.2 Nhiệt độ
- Dải sống rộng 16–34 °C (tổng quan qua tìm kiếm, Animal Diversity/Grokipedia — thấp).
- Bãi đẻ (Malaysia, nuôi bán thâm canh): 2–10 hải lý từ bờ, sâu 5–10 m, **nước 26–31 °C**, mùa đẻ 10–1 (USM, https://erepo.usm.my/items/70ff4836-c204-4bfc-9e4d-f1a8e323962d) — nguồn ngoài VN.
- Tăng trưởng: 27 °C đạt 10 g sau 45 ngày, 20 °C cần ~100 ngày (Frontiers 2020 https://www.frontiersin.org/articles/10.3389/fmars.2020.00249/full).
- Không có bài CPUE–SST ở VN. Nhiệt quyết định là nhiệt **tầng nước nông ven rạn** — ở <50 m gần như trùng SST.

### 3.3 Độ sâu & khoảng cách bờ
- "Từ mặt đến **~100 m**, nền đáy cỏ biển và rạn san hô"; đẻ ở **<50 m**; ngư dân Côn Đảo & Phú Quốc câu đêm bằng lưỡi giả, **cách bờ không quá 10 km** (PMC10643773 https://pmc.ncbi.nlm.nih.gov/articles/PMC10643773/).
- SeaLifeBase: 0–100 m, rạn đá, rong, cửa sông; đêm lên nông, ngày ra sâu hơn hoặc bám rạn/cỏ (https://www.sealifebase.se/summary/Sepioteuthis-lessoniana.html).
→ Loài **ven bờ tuyệt đối**; mọi ô >100 m đáy phải bằng 0. Hồ sơ hiện không có cổng.

### 3.4 Mồi / chl-a
Ăn cá, tôm, nhuyễn thể; không lệ thuộc plankton. Không tìm được dải chl. `[-0.5, 0.3]` (0,3–2 mg/m³) hợp với nước ven bờ — **giữ**.

### 3.5 Cơ chế gom cá
Bằng chứng duy nhất là **sinh cảnh đáy** (rạn san hô, cỏ biển, rạn đá) + đèn đêm + đẻ ven bờ. Front/xoáy/nước trồi: **không có bằng chứng**. Trọng số hiện `conv 0.5, thermFront 0.4, chlFront 0.3, eddy 0.2, upw 0.2` là cao nhất nhóm mà không có cơ sở → nên hạ đều, để cổng độ sâu + mùa quyết định. Lớp rạn/đẳng sâu đã có trong kho hải đồ của app — nếu mô hình có biến "gần rạn" thì đây là loài hưởng lợi nhất.

### 3.6 Mùa vụ VN theo vùng
- Phân bố: VBB, Nam Trung Bộ, Đông Nam Bộ, Tây Nam Bộ; **Côn Đảo và Phú Quốc là hai ngư trường chính**; mẫu thu tháng 10/2020 (PMC10643773).
- Tháng rộ ở VN: **không tìm được nguồn định lượng** (bài TCKTTV 2025 có thể có nhưng không tải được). Hồ sơ ghi 3–10 — giữ, đánh dấu chưa kiểm. Tham chiếu ngoài: Malaysia đẻ 10–1 (USM).

### 3.7 Đối chiếu hồ sơ → đề xuất
| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | **[0, 100]** (thêm; nếu cổng cần a>0 thì [2, 100]) | Loài 0–100 m, câu <10 km bờ | PMC10643773; SeaLifeBase | **cao** |
| `sst` | [22, 24, 29, 32] | **[22, 25, 30.5, 33]** | Bãi đẻ 26–31 °C; trần 29 phạt mùa hè ven bờ 29,5–30,5 | USM; Frontiers 2020 | vừa |
| `w.*` | conv 0.5 / thermFront 0.4 / chlFront 0.3 / eddy 0.2 / upw 0.2 | **conv 0.2 / thermFront 0.2 / chlFront 0.2 / eddy 0.05 / upw 0.1** | Không có bằng chứng cơ chế mặt; loài bám sinh cảnh đáy | — | thấp (hướng đúng, hệ số là phán đoán) |
| `surfaceSignal` | medium | **low** | Ô 0,25° ven bờ nhiễm đất/độ đục; tín hiệu vệ tinh không nói gì về rạn/cỏ biển | suy luận | vừa |
| `seasons[0].regions` | ĐNB, TNB, NTB | **thêm `vinh-bac-bo`** (cùng tháng, trọng số thấp) | Loài có mặt VBB, nằm trong 8 loài Loliginidae VBB | PMC10643773; RIMF tinid-783 | vừa (có mặt) / thấp (tháng) |
| `seasons[0].months` | 3–10 | giữ, ghi "chưa có nguồn VN" | — | — | — |
| `tempSource` | (surface) | giữ surface | nông <50 m | | cao |

---

## 4. MỰC NANG — *Sepia pharaonis* (vân hổ), *S. aculeata*, *S. esculenta*, *S. lycidas*, *Sepiella inermis* (nang lửa)

### 4.1 Định danh
"Mực nang" **gộp ≥7 loài Sepiidae ở VBB**; **S. aculeata và S. esculenta phổ biến nhất** ở VBB (RIMF tinid-783); NĐ 37 ghi *S. pharaonis* (vân hổ) và *Sepiella inermis* (nang lửa). *S. pharaonis* có mặt cả ba vùng VBB–Trung–Nam, tập trung quanh đảo Cái Chiên, Cô Tô, Bạch Long Vĩ, Cát Bà (bản tin RIMF https://www.rimf.org.vn/bantin/chitiet/Th224nhphanlo224iv224sanluongmuckhaith225coVinhBacBo — đọc qua trích dẫn tìm kiếm).

### 4.2 Nhiệt độ (nhiệt ĐÁY mới quyết định — loài sống đáy)
- *S. pharaonis*: AquaMaps ưa thích **24,6–29,1 °C, trung bình 28,1** (SeaLifeBase qua kết quả tìm kiếm https://www.sealifebase.ca/summary/57301); nuôi: 28 °C tăng trưởng nhanh hơn 23 °C.
- *S. aculeata*: 22–27 °C (reeflex.net — trang cảnh quan, thấp).
- *S. esculenta*: ưa nước **~20 °C** ổn định (Biển Hoa Đông, PMC11117227) — loài ôn đới–cận nhiệt, giải thích vì sao VBB rộ **tháng 1–2** khi nước lạnh nhất.
→ Cổng hiện `[22, 25, 29, 31]` **tắt ngúm đúng vụ chính VBB** (tháng 1–2, SST bắc vịnh thường dưới 22–23 °C — cần kiểm trên chính lưới SST của app; đây là giả định của agent, chưa có số đo trong nguồn). Mùa đó nhiệt đáy còn lạnh hơn/ổn định hơn mặt.

### 4.3 Độ sâu & khoảng cách bờ
- VBB: mực nang **tập trung 30–50 m**; vùng sống chung "50–200 m" (bản tin RIMF); đẻ mùa xuân **tháng 1–3 di cư vào bờ** (RIMF); Cát Bà–Cô Tô lưới kéo đáy 17,6–30,9 kg/h.
- *S. pharaonis*: 0–130 m, thường ≤40 m, đẻ theo đàn **≤20 m**, nền cát & cỏ biển; di cư mùa giữa thềm và ven bờ (https://www.sealifebase.se/summary/Acanthosepion-pharaonis.html ; FAO).
- *S. aculeata*: 0–60 m, thường 5–20 m (https://www.sealifebase.se/summary/Sepia-aculeata.html).
→ Cổng đáy **0–130 m**; trọng tâm 20–60 m.

### 4.4 Mồi / chl-a
Ăn giáp xác, cá nhỏ, mực (SeaLifeBase). Không có nguồn chl–CPUE. `[-0.3, 0.5]` giữ.

### 4.5 Cơ chế gom cá
Chỉ có bằng chứng về **di cư đẻ vào bờ nông** (mùa) và **nền đáy cát/cỏ biển**. Không có bằng chứng front/xoáy/nước trồi. `eddy 0.1` nên về 0.05; còn lại giữ thấp.

### 4.6 Mùa vụ VN theo vùng
| Vùng | Tháng rộ | Nguồn | Độ tin |
|---|---|---|---|
| Vịnh Bắc Bộ | Năng suất & tỉ lệ mực nang tăng về cuối năm, **đỉnh 1–2**; đẻ 1–3 vào bờ | RIMF tinid-783 + bản tin RIMF | cao |
| Trung Bộ, ĐNB, TNB | Không tìm được nguồn | — | — |

### 4.7 Đối chiếu hồ sơ → đề xuất
| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | **[0, 130]** (thêm) | 0–130 m, tụ 30–50 m | SeaLifeBase; RIMF | **cao** |
| `tempSource` | (surface) | **bottom** | Loài đáy; cùng cách xử lý các mục demersal đã có `tempSource: bottom` | sinh thái loài | vừa |
| `sst` | [22, 25, 29, 31] | **[17, 20, 29, 31]** | S. esculenta ưa ~20 °C; vụ chính VBB tháng 1–2 nước lạnh; S. pharaonis 24,6–29,1 | PMC11117227; AquaMaps; RIMF | vừa–cao |
| `seasons[0].months` | 1, 2, 11, 12 | **11–3** cho VBB (đỉnh 1–2); tách ĐNB/TNB/TB thành mục riêng đánh dấu "chưa có nguồn" | đẻ 1–3 vào bờ | RIMF | cao (VBB) |
| `w.eddy` | 0.1 | 0.05 | không bằng chứng | — | thấp |
| `surfaceSignal` | low | giữ | | | — |

---

## 5. BẠCH TUỘC — *Amphioctopus aegina* (= *Octopus membranaceus*/*O. aegina*), *A. marginatus*, *A. neglectus* (ruốc), *Cistopus indicus*, *Octopus dollfusi*, *O. vulgaris*

### 5.1 Định danh
Không có trong NĐ 37 Phụ lục V. VN ~17 loài, chủ yếu Trung và Nam Bộ; tên thương mại thường gặp *Octopus membranaceus*, *O. dollfusi*, *O. vulgaris* (trang công ty Hải Nam, https://www.hainam.com.vn/products/octopus.html — thấp). Quảng Ninh "ruốc" = bạch tuộc nhỏ, nghiên cứu hình thái *Amphioctopus neglectus* Hạ Long 5/2022 (vjol.info.vn/most/article/download/110513 — không tải được, 500).

### 5.2 Nhiệt độ (nhiệt ĐÁY)
Không tìm được bài CPUE–nhiệt cho bạch tuộc VN/Biển Đông. Dải hiện `[23, 26, 30, 32]` không có nguồn; vì loài đáy, nhiệt đáy thềm 20–100 m mùa hè VN thấp hơn SST vài độ → nếu chuyển `tempSource: bottom` thì cần hạ `a` xuống ~20. Đề xuất mức vừa.

### 5.3 Độ sâu & khoảng cách bờ
- *A. aegina*: **30–120 m**, cát & cát bùn, thềm lục địa, sống hang, hoạt động chạng vạng (https://www.sealifebase.se/summary/Amphioctopus-aegina.html).
- *Cistopus indicus*: **0–50 m**, nền mềm, vùng triều san hô (https://www.sealifebase.se/summary/Cistopus-indicus.html); *Cistopus* spp. 25–720 m bùn (FAO Catalogue Vol.1 https://www.fao.org/4/ac479e/AC479E35.pdf — trích pdftotext: "benthic, 25 to about 720 m on muddy bottoms").
- Nghề VN: Phú Quốc **bẫy vỏ ốc** dây dài (12 dây × 1.000 vỏ), thả 16–17h, thu 5h sáng, 60–70 kg/chuyến, ~400 hộ Dương Đông (Thủy sản VN https://thuysanvietnam.com.vn/kien-giang-cau-bach-tuoc-tren-dao-ngoc-phu-quoc/) — không ghi độ sâu; chuyến trong đêm ⇒ ven bờ. Phần lớn sản lượng còn lại là **phụ phẩm lưới kéo đáy** (Hải Nam; FAO).
→ Cổng đáy **0–120 m**, trọng tâm <60 m.

### 5.4 Mồi / chl-a
Ăn giáp xác, nhuyễn thể đáy. Không có nguồn chl. Giữ.

### 5.5 Cơ chế gom cá
Chỉ **nền đáy** (cát bùn, hang, rạn) và chu kỳ sống ngắn. Không có bằng chứng cơ chế mặt. Trọng số hiện đã thấp — giữ.

### 5.6 Mùa vụ VN theo vùng
| Vùng | Tháng | Nguồn | Độ tin |
|---|---|---|---|
| "Vụ Bắc 1–4, vụ Nam 6–9", chủ yếu tàu lưới kéo | khớp hồ sơ hiện tại | Hải Nam (trang công ty) | thấp |
| Quảng Ninh (ruốc, VBB) | mùa bắt đầu **đầu tháng 8** | Vietnam News https://ovietnam.vietnamnews.vn/baby-octopus-season-is-approaching-so-get-ready-for-delicious-dishes-post405492.html | thấp (báo) |
| Phú Quốc (bẫy ốc) | không ghi tháng | Thủy sản VN | — |

### 5.7 Đối chiếu hồ sơ → đề xuất
| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | **[0, 120]** (thêm) | A. aegina 30–120 m; Cistopus 0–50 m; nghề ven bờ | SeaLifeBase; FAO; TSVN | **cao** |
| `tempSource` | (surface) | **bottom** | loài đáy thuần | sinh thái | vừa |
| `sst` | [23, 26, 30, 32] | **[20, 24, 30, 32]** nếu chuyển bottom | nhiệt đáy thấp hơn mặt; không có nguồn định lượng | suy luận | thấp |
| `seasons` | 1–4, 6–9 (TNB, ĐNB, NTB) | giữ; **thêm `vinh-bac-bo` 8–11** trọng số thấp | ruốc Quảng Ninh từ tháng 8 | VNS (báo) | thấp |
| `surfaceSignal` | low | giữ | | | — |

---

## 6. Trả lời các câu hỏi trọng tâm (a)–(e)

**(a) Mực xà**: SST vùng câu 25–30,9 tuỳ mùa/vĩ độ (bắc xuân 26,5–28,5; Trường Sa hè 30,05–30,35); đáy vùng câu **>800 m** (RIMF), loài sống trên nền >200–400 m; liên hệ chặt với **SSH/xoáy** (biến mạnh nhất) và **gradient nhiệt 5–50 m** (dấu đổi theo mùa); vụ chính VN **4–9** (RIMF), thực tế tàu đi từ tháng 2, hoạt động 12→9.

**(b) Mực ống / mực lá**: ven bờ–thềm. Mực ống VBB tụ quanh đẳng sâu **30 m** (2–35 m), tổng quát 5–170 m, Vịnh Thái Lan cao nhất 41–50 m; mùa VBB **5–11, đỉnh 8–10**. Mực lá **0–100 m**, câu <10 km bờ, đẻ <50 m; tháng rộ VN chưa có nguồn.

**(c) Mực nang / bạch tuộc**: `surfaceSignal: low` là **đúng**. Cổng độ sâu hợp: mực nang **[0,130]** (tụ 30–50 m VBB), bạch tuộc **[0,120]**. Ảnh vệ tinh mặt biển chỉ còn vai trò qua mùa + nhiệt đáy; với nhóm này, cổng độ sâu + mùa + (nếu có) lớp nền đáy/rạn của hải đồ quyết định gần hết.

**(d) tempSource**: mực xà **surface** (ăn đêm trong lớp xáo trộn, mọi HSI dùng SST; ghi nợ gradient 5–50 m); mực ống **surface nhưng nhiệt không phải biến quyết định** (GAM VBB: không ý nghĩa); mực lá surface (nông <50 m); mực nang & bạch tuộc **bottom**.

**(e) Có nên thêm cổng `inshore`?** **Có, cho cả 4 loài ven bờ.** Số liệu độ sâu thực tế: lưới kéo VBB 2–35 m dọc đẳng sâu 30 m (mực ống), 30–50 m (mực nang); lưới kéo Vịnh Thái Lan 10–50 m; câu mực lá <10 km bờ (0–100 m); bẫy ốc bạch tuộc Phú Quốc trong một đêm (ven bờ). Không có loài nào trong 4 loài này sống ở đáy >200 m. Lưu ý kỹ thuật: ô 0,25° ven bờ chứa cả đất — cổng phải dùng độ sâu **nhỏ nhất/trung vị phần nước** của ô, không phải trung bình cả ô, nếu không ô sát bờ sẽ bị loại oan.

---

## Top 5 sửa đáng làm nhất của nhóm (tác động × độ tin)

1. **Mực xà `offshore [80,250] → [300,800]`** — nghề câu ở đáy >800 m, >150 hải lý; cổng hiện kéo mực xà về thềm 80–250 m sát bờ miền Trung. Tác động rất lớn (loài có doanh thu hàng trăm tỷ/xã), độ tin **cao** (RIMF + SeaLifeBase).
2. **Thêm cổng `inshore` cho mực ống [5,150], mực lá [0,100], mực nang [0,130], bạch tuộc [0,120]** — xoá hàng trăm ô điểm cao trên nước sâu (cùng lỗi cá rạn/đáy). Độ tin **cao** về dải độ sâu.
3. **Mực ống VBB mùa 5–9 → 5–11 (đỉnh 8–10)** — hồ sơ hiện cắt đúng tháng 9–10 là tháng CPUE cao nhất theo cả khảo sát RIMF và GAM 2018–2023. Độ tin **cao**.
4. **Mực xà `sst` [25,26.5,30,31] → [24,26.5,30.5,32] + `chlLog` → [-1.2,-0.5] + mùa 2–9** — trần 30 phạt đúng vụ chính Trường Sa (thích nghi tới 30,35–30,9); dải chl lệch về nước giàu. Độ tin **vừa–cao**.
5. **Mực nang: `tempSource: bottom`, `sst` [22,25,29,31] → [17,20,29,31], VBB mùa 11–3** — vụ chính VBB tháng 1–2 (nước lạnh nhất, S. esculenta ưa ~20 °C) đang bị cổng nhiệt 22 °C tắt. Độ tin **vừa–cao** (RIMF + PMC11117227; ngưỡng SST VBB tháng 1–2 cần kiểm trên lưới của app).

Việc phụ đáng ghi nợ: điều biến **pha trăng** cho nghề đèn (mực ống/xà/lá) — yếu tố mạnh nhất trong GAM VBB; hạ trọng số cơ chế mặt của mực lá (hiện cao nhất nhóm mà không có cơ sở).

---

## Điều KHÔNG tìm được

- **Mực lá ở VN**: bài "Nghiên cứu đặc điểm sinh học và phân bố ngư trường mực lá đại dương ở vùng biển Việt Nam" (TC Khí tượng Thủy văn 2025) không tải được (SSL tự ký / ResearchGate 403) — đây là nguồn tốt nhất cho tháng rộ, nhiệt, độ sâu của mực lá; **nên tải tay**. Tháng rộ 3–10 hiện tại chưa có nguồn.
- **Mực ống ở Trung Bộ, ĐNB, TNB**: không có nguồn mùa vụ; mục 11–4 phía nam giữ nguyên "chưa kiểm".
- **Mực nang ngoài VBB**: không có nguồn mùa vụ; AquaMaps *S. pharaonis* chỉ đọc được qua trích tìm kiếm (sealifebase.ca 403).
- **Bạch tuộc**: không có bài CPUE–môi trường nào ở Biển Đông; mùa "vụ Bắc 1–4 / vụ Nam 6–9" chỉ có nguồn trang công ty; độ sâu thả bẫy ốc Phú Quốc không ghi; bài *A. neglectus* Hạ Long (vjol) lỗi 500.
- **Mực xà**: bài "Climate-related changes in seasonal habitat pattern of S. oualaniensis in the SCS" (Ecosystem Health & Sustainability 2021) và Water 2020 (Growth, Resources, Environment) đều 403 — hai bài này có thể cho bản đồ mùa theo vùng (Hoàng Sa vs Trường Sa) chính xác hơn. Không có số đo gradient tầng nhiệt tối ưu (chỉ biết dấu đổi theo mùa). Không có bài front SST định lượng.
- **Nhiệt SST thực tế VBB tháng 1–2** để kiểm ngưỡng 22 °C của mực nang — chưa tra, đề nghị kiểm trực tiếp trên lưới SST của app.
- **NĐ 37 Phụ lục V** chỉ đọc được từ bản PDF tiếng Anh của fisheryprogress; cột "cỡ tối thiểu" bị lệch dòng — không dùng con số đó cho việc gì ngoài định danh.
