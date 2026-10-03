# Báo cáo nhóm GIÁP XÁC — tôm bạc · tôm sú · ghẹ xanh · cua biển · ruốc

**Load khi / Load when**: nguồn sinh thái tôm ghẹ ruốc — load khi sửa hồ sơ crustacean.

Ngày: 2026-10-03 · Đầu vào: `BRIEF.md`, `profiles-current.json` (5 mục `category: "crustacean"`). Ngân sách: ~28 WebSearch + ~25 WebFetch (4 PDF đọc bằng pdftotext tại máy).

## 0. Kết luận chung (đọc trước)

1. **4/5 loài là loài ĐÁY ven bờ/cửa sông** (tôm bạc, tôm sú, ghẹ xanh, cua biển). Không tìm được MỘT nghiên cứu nào ở Biển Đông/VN nối CPUE của chúng với SST/chl‑a vệ tinh. Giữ `surfaceSignal: low`; thứ thực sự dự báo được là **độ sâu đáy + nền đáy + mùa** → **cổng `inshore` phải là cổng chính**.
2. **Cua biển nên RÚT khỏi dự báo biển** — thay bằng thẻ mùa + vùng.
3. **Tôm sú tự nhiên hầu như chỉ còn nghề bắt tôm bố mẹ ở Bãi Cạn (Cà Mau, 45–55 m), rộ T9–T2** — NGƯỢC với hồ sơ (T3–9).
4. **Ghẹ xanh Kiên Giang: chính vụ T4–T8** (CPUE lồng đỉnh T5, lưới rê đỉnh T7); hồ sơ tắt T4–6. Lệnh cấm 1/4–30/6 chỉ áp **≤3 hải lý ven bờ**.
5. **Ruốc**: mùa **sai ở Nam Trung Bộ** (Bình Định rộ T10–T4, không phải T5–10) và **thiếu vụ hè Vịnh Bắc Bộ** (Thanh Hoá chính vụ cuối T6).

---

## 1. TÔM BẠC

**1.1 Định danh.** *Fenneropenaeus merguiensis* (= *Penaeus merguiensis*), banana prawn; Tepbac: "Tôm bạc thẻ", tên khác tôm bạc gân/tép bạc; phân bố chủ yếu Nam Bộ (Cửa Lớn, Bảy Háp, Ông Đốc, Hòn Chông, Hà Tiên…) — [Tepbac](https://tepbac.com/species/full/45/tom-bac-the.htm). **"Tôm he" là tên HỌ Penaeidae** (Quảng Ngãi: 33 loài/7 giống — Nguyễn Văn Thuận & Cao Thị Thanh Hà, TC KH ĐH Huế 49/2008, [PDF](https://hueuni.edu.vn/portal/data/doc/tapchi/49_20.pdf)). Ven bờ HP–QN lẫn *P. semisulcatus, P. merguiensis, P. indicus, P. monodon, P. japonicus, Metapenaeus ensis* — [VJAS 1087](https://vie.vjas.vn/index.php/vjasvn/article/view/1087). ⇒ hồ sơ gộp nhiều loài, chấp nhận được nhưng ghi rõ trong `note`. Phụ lục V NĐ 37/2024 không tải được; đã bị NĐ 309/2025 ngưng một phần ([mae.gov.vn](https://mae.gov.vn/ngung-hieu-luc-thi-hanh-quy-dinh-kich-thuoc-toi-thieu-duoc-phep-khai-thac-mot-so-loai-thuy-san-20498.htm)).

**1.2 Nhiệt.** SEAFDEC factsheet (SeaLifeBase/AquaMaps): tropical, **preferred 28 °C** — [FR‑FS01 PDF](https://fisheries-refugia.org/resources/Species_Factsheets/FR-SpeicesFS_Banana%20prawn-Fenneropenaeus%20merguiensis.pdf). Staples & Heales: lột xác 15–35 °C → **tối ưu 25–30 °C**, phụ thuộc nhiệt không phụ thuộc mặn — [SEAFDEC repo](https://repository.seafdec.org.ph/handle/10862/936). Khảo sát VN T3/2005–06 nước **28,4–31,5 °C**, *P. merguiensis* >50 % mẫu — [WorldFish/CABI 2010](https://digitalarchive.worldfishcenter.org/server/api/core/bitstreams/3f8ac038-15a3-4282-9545-ed9c6e72ff1f/content) → vẫn ưu thế ở ≥31 °C. Nhiệt tầng đáy nông ≈ SST (mục 6).

**1.3 Độ sâu.** Factsheet: benthic/brackish **10–55 m, thường ≤20 m**, bùn/cát‑bùn, cửa sông–vịnh nước đục, trưởng thành "gom đàn ngoài khơi"; Tepbac 2–90 m. Nghề: lưới kéo, rê, đăng, te, lưới đáy. ⇒ **`inshore [2, 40]` m**, cách bờ ≤40 km.

**1.4 Chl.** Ăn tạp đáy, thích nước đục → liên hệ chl gián tiếp (phù sa). Giữ `chlLog [0, 1.4]`.

**1.5 Cơ chế.** Không bằng chứng front/xoáy/nước trồi; yếu tố thật là xả sông mùa mưa + nền đáy. `w.eddy/upw` hiện tại không có nguồn → hạ về ~0.

**1.6 Mùa.** VBB: năng suất lưới kéo tôm **mùa Tây Nam cao hơn Đông Bắc**, TB 7,31 kg/giờ; trữ lượng 2.494 t (ĐB) vs **5.116 t (TN)** — VJAS 1087 → **5–9**. Nam Bộ: RIMF 2007–08 (7 chuyến, 60 loài) tôm con mùa ĐB ở Vũng Tàu, Bến Tre, Nam Du–Bà Lụa; mùa TN ở Bình Thuận, Bến Tre→Cà Mau, Nam Du, Hòn Chuối — [CTU 149](https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/149); SEAFDEC: "fishing season June–September" → có cả hai mùa; **không xác nhận được "chính vụ ĐB"** của hồ sơ.

**1.7 Đối chiếu**

| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| species/note | "Tôm bạc (tôm he)" | "Tôm bạc thẻ (*F. merguiensis*; gộp tôm he ven bờ)" | tôm he = tên họ | Tepbac; ĐH Huế 2008 | cao |
| sst | [24,26,30,33] | **[24,26,31,34]** | preferred 28, tối ưu 25–30, vẫn ưu thế 31,5 | SEAFDEC; Staples; WorldFish | vừa |
| inshore | chưa có | **[2,40] m**, ≤40 km | 10–55 m thường ≤20 | SEAFDEC; Tepbac | cao |
| w.eddy / w.upw | 0.05 / 0.15 | **0 / 0.05** | không bằng chứng | — | vừa |
| seasons | 11–4 @ TNB, ĐNB, NTB | **thêm 5–9 @ vinh-bac-bo, tay-nam-bo, dong-nam-bo**; giữ 11–4 ghi "chưa xác nhận" | VBB mùa TN gấp đôi; Nam Bộ 2 mùa | VJAS; CTU 149 | vừa |
| surfaceSignal / tempSource | low / bottom | giữ | — | — | cao |

---

## 2. TÔM SÚ BIỂN

**2.1** *Penaeus monodon*. **2.2 Nhiệt.** SeaLifeBase: 17–38 °C, "preferred 24" (envelope toàn cầu — không dùng cho VN) — [SeaLifeBase 25353](https://sealifebase.ca/summary/25353). Bài Frontiers không đo nhiệt.

**2.3 Độ sâu — mấu chốt.** SeaLifeBase 0–150 m, thường ~60 m. **Nghề tự nhiên ở VN gần như chỉ còn bắt tôm BỐ MẸ**: Bãi Cạn **7°00'–8°45'N, 103–105°E, ~15.000 km², sâu 45–55 m**, đáy cát–bùn–đá, lưới rê ba lớp quét, 16 tàu (2009: 28), 5.900 ± 1.283 con/tàu/năm, **đỉnh T9–T2**; nghề cũ ở Khánh Hoà/Ninh Thuận đã cạn, dời về Cà Mau; ngành nuôi phụ thuộc ~69,6 % bố mẹ tự nhiên — [Frontiers Mar. Sci. 2024](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2024.1434255/full). Tôm sú thương phẩm hầu hết là nuôi (Cà Mau 278.365 ha — [Tepbac](https://tepbac.com/tin-tuc/full/hai-tinh-dien-hinh-tom-rung-va-tom-lua-36372.html)).

**2.4–2.5** Không liên hệ chl, không front/xoáy; gom ở bãi đẻ sâu theo mùa.

**2.6 Mùa.** TNB (Bãi Cạn) **T9–T2**; NTB đã cạn; VBB/ĐNB không có số liệu.

**2.7 Đối chiếu**

| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| Có nên dự báo? | loài thương phẩm | **BỎ, hoặc đổi thành "Tôm sú bố mẹ (Bãi Cạn)" chỉ `tay-nam-bo`** | thương phẩm = nuôi | Frontiers 2024 | cao |
| seasons | 3–9 @ TNB, ĐNB, NTB | **9–2 @ tay-nam-bo** | đỉnh T9–T2; miền Trung cạn | Frontiers 2024 | cao |
| inshore | chưa có (text 10–80) | **[30,70] m** (bố mẹ) / [5,60] nếu giữ thương phẩm | 45–55 m; ~60 m | Frontiers; SeaLifeBase | cao/vừa |
| sst | [22,25,30,34] | giữ (có thể 30→31) | không có CPUE–nhiệt | — | thấp |
| w.eddy/upw | 0.05/0.15 | → ~0 | không bằng chứng | — | vừa |

---

## 3. GHẸ XANH

**3.1** *Portunus pelagicus*; Kiên Giang dày nhất cả nước; lưới kéo RIMF thấy từ VBB tới TNB nhưng tỷ lệ thấp. Nguồn chính: **Vũ Việt Hà & cs. (RIMF/WWF) Stock assessment BSC Kiên Giang 2013** — [PDF](https://fisheryprogress.org/sites/default/files/documents_tasks/2013%20-%20STOCK%20ASSESSMENT%20OF%20BLUE%20SWIMMING%20CRAB%20IN%20KIENGIANG%20-%20REVISE.pdf); **Seafood Watch 2023** — [PDF](https://www.seafoodwatch.org/globalassets/sfw-data-blocks/reports/c/seafood-watch-blue-swimming-crab-vietnam-27948.pdf).

**3.2 Nhiệt.** Nhiệt nước TB Kiên Giang **28,7 °C** (RIMF). Ấu trùng tối ưu **30 °C/30 ppt** ([SJST‑PSU 2016](https://doi.nrct.go.th/ListDoi/listDetail/10.14456%2Fsjst-psu.2016.11)); nuôi 24/28/32 °C: **sống sót giảm ở 32** ([UMT](https://umt-ir.umt.edu.my/handle/123456789/14862)); CTMax 39–44, CTMin 13–19 ([NTOU](https://scholars.ntou.edu.tw/handle/123456789/6514)). Trần 30 quá thấp (vịnh Thái Lan T4–5 mặt 30–31 đúng đầu vụ) → **[22,25,31,34]**.

**3.3 Độ sâu.** Triều → 50 m (RIMF)/70 m (SFW), **tập trung 5–25 m**; **ngư trường Kiên Giang ven bờ tới 30 m**: Kiên Lương, Hàm Ninh–Bãi Bổn, An Thới→Nam Du, Hải Tặc, Hòn Tre–Hòn Rái, nam vịnh Rạch Giá (RIMF §3.3.2). ⇒ **`inshore [3,30]`**.

**3.4** Zoea ăn phù du, trôi tới 80 km; trưởng thành săn đáy; không CPUE–chl. **3.5** Không front/xoáy; ghẹ ra sâu đẻ; Quảng Ninh: gom về đáy bùn‑cát **sau biển động** ([Báo Quảng Ninh](https://baoquangninh.vn/bay-ghe-khoi-xa-2208962.html)).

**3.6 Mùa.** Kiên Giang quanh năm, **chính vụ T4–T8**; 2013: CPUE lồng <20CV đỉnh **T5 (7,13 kg/100 lồng)**, đáy T1 (2,7); lưới rê đỉnh **T7 (0,58 kg/tấm)**; tổng sản lượng cao T6–7, T9, T11. Sinh sản quanh năm, chính **T2–4 đỉnh T3**, phụ T8, T10–11. **Quy định**: cấm ghẹ 1/4–30/6 ven bờ, CW ≥100 mm (Poseidon 2015 trong SFW); QĐ 23/2015 Kiên Giang nâng mắt lưới; QĐ 13/2022 thay thế: vùng cấm ven bờ = **bờ ra 3 hải lý** (đảo 1 hải lý), cấm có thời hạn 1/4–30/6 & 1–30/11 theo vùng Bộ công bố ([bản dịch PDF](https://fisheryprogress.org/sites/default/files/documents_actions/Decision%2013_2022_QD-UBND%20managing%20exploitation%20activities%20of%20Kien%20Giang%20aquatic%20resources.pdf)). ⇒ cấm theo VÙNG, không tắt cả nghề. VBB: lồng bẫy Quảng Ninh giá đỉnh T4–5; Hải Phòng có lồng trụ tròn ([JFST 2/2022](https://jfst.vn/index.php/ntu/article/download/86/66/105)) — không CPUE theo tháng.

**3.7 Đối chiếu**

| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| seasons | 7–3, note "nghỉ T4–6" | **tay-nam-bo: quanh năm, trọng tâm [4..11]**; thêm vinh-bac-bo [4..10] (thấp) | chính vụ T4–8; cấm chỉ ≤3 hải lý | RIMF 2013; SFW; QĐ 13/2022 | cao (TNB)/thấp (VBB) |
| sst | [23,26,30,32] | **[22,25,31,34]** | TB 28,7; đầu vụ SST 30–31; chỉ giảm sống ở 32 | RIMF; UMT; NTOU | vừa |
| inshore | chưa có (text 4–40) | **[3,30] m** | ngư trường tới 30 m | RIMF 2013 | cao |
| note | "nghỉ sinh sản T4–6" | "Cấm 1/4–30/6 trong 3 hải lý ven bờ KG; ngoài vùng cấm là chính vụ" | tránh hiểu nhầm | QĐ 13/2022 | cao |
| w.upw/eddy | 0.15/0.05 | → ~0 | không bằng chứng | — | vừa |

---

## 4. CUA BIỂN

**4.1** *Scylla paramamosain* — CDĐL "Cua Cà Mau" ([Bộ Công Thương](https://moit.gov.vn/tu-hao-hang-viet-nam/cua-ca-mau-san-vat-co-gia-tri-dinh-duong-cao-lua-chon-cua-cac-ba-noi-tro-viet.html)). **4.2** Cà Mau nhiệt TB 27,1 °C.

**4.3 Lý do rút.** Sống **trong rừng ngập mặn/kênh rạch cửa sông**: cua con định cư rìa rừng giữa rễ thở, cua lớn vào sâu trong rừng (Vũ Ngọc Út, Bangor 2002, [PDF](https://research.bangor.ac.uk/portal/files/71795621/VU_NGOC_UT_PhD_2002_-_OCR.pdf)). Nguồn cung: **~386.000 ha nuôi, ~40.000 t/năm** ([Nhân Dân 18/11/2025](https://nhandan.vn/cua-ca-mau-tu-ke-pha-hoai-den-khat-vong-thuong-hieu-quoc-gia-post923988.html)); bắt tự nhiên bằng câu/rập/móc hang trong rừng — không phải nghề đi biển. Ô 0,25° ngoài biển không chứa sinh cảnh.

**4.5–4.6** Yếu tố thật là **độ mặn**: quần thể cửa sông Mê Kông quanh năm, **đỉnh mùa KHÔ khi mặn 15–20 ppt** (Le Vay, Ut & Jones 2001, Hydrobiologia 449:231–239, [Bangor](https://research.bangor.ac.uk/portal/en/researchoutputs/seasonal-abundance-and-recruitment-in-an-estuarine-population-of-mud-crabs-scylla-paramamosain-in-the-mekong-delta-vietnam(5a394530-e8ad-413b-bbec-fc0713bba59f)/export.html)) → TNB ≈ T11–T4.

**4.7 Đối chiếu**

| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| Có nên dự báo? | điểm nóng trên biển | **RÚT; thay thẻ "Mùa cua Cà Mau: mùa khô T11–T4, rừng ngập mặn & cửa sông" (mùa + vùng, không vẽ ô)** | sinh cảnh trong rừng | Le Vay 2001; Út 2002; Nhân Dân | cao |
| seasons | 10–5 @ TNB, ĐNB | 11–4 @ tay-nam-bo (thẻ mùa) | đỉnh mùa khô | Le Vay 2001 | vừa |
| sst/chlLog/w | có | bỏ | vô nghĩa sinh thái | — | cao |

---

## 5. RUỐC

**5.1** *Acetes* spp. (tép moi/moi/khuyếc); hai loài chính *A. indicus* & *A. japonicus* ([Wikipedia VN](https://vi.wikipedia.org/wiki/Ru%E1%BB%91c_(%C4%91%E1%BB%99ng_v%E1%BA%ADt))). Nghiên cứu VN: Lê Văn Tâm & Trần Văn Việt 2014, TC KH ĐH Cần Thơ 33:116–121 — [CTU 167](https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/167). Ghi "Acetes spp." trong hồ sơ.

**5.2 Nhiệt.** SeaLifeBase *A. japonicus* "preferred 23 °C" (toàn cầu, không dùng) — [25421](https://www.sealifebase.ca/summary/25421). Ấn Độ (ICAR, kết quả tìm): chl‑a + nhiệt quan trọng nhất, 27,25 °C "giới hạn" (vùng khác). Miri, Sarawak 2021: bloom T2–4; Granger với DO, mặn; chl‑a bloom **4,5–7,3 mg/m³** — [Malays. Appl. Biol. 50(3)](https://jms.mabjournal.com/index.php/mab/article/download/2215/598/1418). *A. erythraeus*: **hai đỉnh — đầu gió mùa TN & cuối gió mùa ĐB** (Mar. Ecol. 45(5) e12822) — khớp "vụ T3 & T8 âm" Quảng Ngãi. Thực tế Nam Bộ rộ T3–8 khi SST 29,5–31 → trần 29 hiện tại **tắt vụ Nam Bộ** → **[21,24,30.5,32.5]** (suy luận, độ tin vừa).

**5.3 Độ sâu/cách bờ.** Quảng Ngãi **2–4 hải lý**, biển lặng nắng ([TSVN 21/02/2025](https://thuysanvietnam.com.vn/ngu-dan-vung-bien-quang-ngai-trung-mua-ruoc/)); Bình Định **sâu 5–7 m** ven gành ([TSVN 06/07/2020](https://thuysanvietnam.com.vn/binh-dinh-mua-ruoc/)); Thanh Hoá bè mảng **5–10 hải lý** ([VietnamPlus](https://www.vietnamplus.vn/ngu-dan-cac-xa-ven-bien-thanh-hoa-ron-rang-vao-mua-moi-bien-post960204.vnp)); ĐBSCL lưới đáy **xa bờ 1,5–10 km cho năng suất cao hơn** (CTU 2014); Cà Mau biển Tây te đẩy trong 1 km ([Báo Pháp luật](https://baophapluat.vn/loc-troi-xu-bien-tay-nam-post362889.html)). ⇒ **`inshore [0,30]`, ≤20 km**; giữ `surfaceSignal: medium`.

**5.4** Phù du; `chlLog` trần có thể nâng 0.9→1.1 (Miri). **5.5 Cơ chế.** Nhất quán: **nổi sau bão/áp thấp, biển lặng lại, nước trong** (T8 âm — [Vietnam News](https://vietnamnews.vn/society/505153/lunar-new-year-is-kind-to-fishermen.html); Cà Mau "sau biển động") → gần tín hiệu "chl tăng sau bão + sóng giảm". `upw 0.25`/`coldCore` không có nguồn nối nước trồi–ruốc (Ninh Thuận rộ T8 âm = cuối nước trồi) → hạ 0.15, ghi "chưa kiểm chứng". Ruốc là chỉ dấu mùa cá nục/trích/mực cơm (Huế, [VnExpress 27/03/2020](https://vnexpress.net/ngu-dan-duoc-mua-ruoc-bien-4075174.html)).

**5.6 Mùa theo vùng (báo; âm→dương ≈ +1 tháng)**

| Vùng | Nguồn | Âm | ≈ Dương |
|---|---|---|---|
| VBB (Thanh Hoá→Nghệ An, Hải Phòng) | vụ chiêm T6–7 âm, vụ mùa cuối T8 âm→Giêng (tapchivietnamhuongsac); chính vụ cuối T6 (VietnamPlus); "tháng 12 mùa moi về" ([Báo Thanh Hoá 2019](https://baothanhhoa.vn/mua-san-moi-bien-111852.htm)) | 6–7; 8–1 | **6–7; 9–2** |
| Trung Bộ (Q.Bình, Huế, Q.Ngãi) | Q.Bình T4–8 âm; Huế cuối T3; Q.Ngãi đầu T11→hết T4 âm + Tịnh Khê 2 vụ T3 & T8 âm ([Dân Việt 07/10/2025](https://danviet.vn/con-ruoc-noi-ven-bien-quang-ngai-la-con-gi-ma-dan-ra-xuc-day-vot-hang-ta-ban-hut-hang-d1368379.html)) | 11–4; 8 | **12–5; 9–10** |
| NTB (Bình Định, Ninh Thuận; Khánh Hoà không nguồn) | Nhơn Lý **T9–10 âm→T2–3 âm**; Ninh Thuận/Bình Định trúng T8 âm sau bão | 9–3; 8 | **10–4; 9** |
| ĐNB/TNB | CTU 2014 **T3–T8**; Bạc Liêu vụ sớm T3/2015 ([Thanh Niên](https://thanhnien.vn/ngu-dan-trung-mua-ruoc-185453604.htm)); Cà Mau tới T9 âm | — | **3–10** |

**5.7 Đối chiếu**

| Trường | Hiện tại | Đề xuất | Lý do | Nguồn | Độ tin |
|---|---|---|---|---|---|
| seasons[0] | 10–3 @ VBB, TB | **VBB [6,7,9,10,11,12,1,2]; TB [12,1,2,3,4,5,9,10]** | thiếu vụ hè VBB; TB rộ tới T4–5 âm | Thanh Hoá ×3; Q.Ngãi ×2; Huế | vừa |
| seasons[1] | 5–10 @ NTB, ĐNB, TNB | **NTB [9..4]** (tách); **ĐNB+TNB [3..10]** | Bình Định rộ T10–T4, không phải hè | TSVN 2020; CTU 2014; Báo PL | **cao** |
| sst | [22,24,29,31] | **[21,24,30.5,32.5]** | vụ Nam Bộ nước 29,5–31 bị cắt | suy luận mùa+khí hậu | vừa |
| chlLog | [-0.3,0.9] | [-0.3,1.1] | bloom 4–7+ mg/m³ | Miri 2021 | vừa |
| inshore | chưa có | **[0,30] m, ≤20 km** | 5–7 m; 2–10 hải lý | BĐ, QN, TH | cao |
| w.upw/coldCore | 0.25/true | 0.15/giữ "chưa kiểm chứng" | không nguồn | — | thấp |
| surfaceSignal | medium | giữ | đàn nổi, chl liên hệ | Miri; ICAR | vừa |
| note | "rộ T7–8 âm" | + "nổi dày sau bão khi biển lặng lại; 1–10 hải lý" | cơ chế nhất quán | Vietnam News; Báo PL | vừa |

---

## 6. Nhiệt ĐÁY vs MẶT (câu e)

VBB: SST hè 27–29 đồng nhất; đông 17 (ĐB)→25 (TN) (Tang et al. 2003, [RSE](https://www.sciencedirect.com/science/article/abs/pii/S003442570300049X)); cột nước <30 m mùa đông xáo trộn hoàn toàn (SST = đáy); mùa hè dải ≤20–30 m sát bờ chịu triều mạnh, chênh ≤1–2 °C. Vịnh Thái Lan nông, TB 28,7; T4–5 mặt 30–31, đáy mát hơn 1–2. **Hệ quả**: dùng SST làm proxy cho loài đáy ven bờ chấp nhận được, NHƯNG **nới trần +1 °C** so với số sinh lý và không để trần ≤30 cho nghề mùa hè Nam Bộ — đúng lỗi "ngừ ồ" lặp ở 4/5 hồ sơ nhóm. Không có nhiệt đáy đo tại ngư trường tôm/ghẹ VN.

---

## 7. TOP 5 SỬA ĐÁNG LÀM NHẤT

1. **Ruốc — tách NTB khỏi Nam Bộ và đảo mùa**: NTB **T10–T4** (hồ sơ T5–10, sai ~180°); Nam Bộ T3–T10; VBB thêm vụ hè T6–7. 6 bài nhất quán. *Tác động cao, tin cao.*
2. **Tôm sú — mùa T3–9 → T9–2, thu về TNB (Bãi Cạn 45–55 m), hoặc bỏ hẳn**: nghề tự nhiên duy nhất còn lại là tôm bố mẹ. *Cao/cao.*
3. **Thêm cổng `inshore` cho 4 loài đáy** — tôm bạc [2,40], tôm sú [30,70]/[5,60], ghẹ [3,30], ruốc [0,30]; hạ `w.eddy/upw` ~0 cho tôm/ghẹ. Cổng duy nhất có số đo (RIMF, SEAFDEC). *Cao/cao.*
4. **Ghẹ xanh — mở chính vụ T4–T8 thay vì tắt**; "nghỉ T4–6" → cảnh báo pháp lý "cấm trong 3 hải lý 1/4–30/6". *Cao/cao.*
5. **Nâng trần nhiệt +1 °C cả nhóm** (tôm bạc 30→31, ghẹ 30→31, ruốc 29→30,5) + **rút cua biển khỏi lớp điểm nóng** (thẻ mùa khô T11–T4). *Vừa–cao / vừa (nhiệt), cao (cua).*

## 8. ĐIỀU KHÔNG TÌM ĐƯỢC

- Phụ lục V NĐ 37/2024 bản gốc (tên VN chính thức); chỉ biết NĐ 309/2025 ngưng một phần.
- Bất kỳ nghiên cứu CPUE–SST/chl vệ tinh cho tôm he, ghẹ, cua, ruốc ở Biển Đông/VN — mọi đề xuất nhiệt là suy từ envelope + mùa + khí hậu.
- Nhiệt đáy đo tại ngư trường tôm/ghẹ VN.
- Mùa tôm bạc TNB theo tháng (chứng cho "chính vụ ĐB" của hồ sơ).
- Ruốc Khánh Hoà riêng; dùng Bình Định + Ninh Thuận đại diện NTB.
- Ghẹ xanh ngoài Kiên Giang (CPUE theo tháng VBB/TB/ĐNB).
- Thành phần loài *Acetes* theo vùng VN.
- Cua: tỷ lệ tự nhiên/nuôi, mùa cua gạch có nguồn khoa học (chỉ Le Vay 2001).
- SeaLifeBase *P. merguiensis*/*P. pelagicus* trả 403 — lấy qua SEAFDEC factsheet (cùng nguồn gốc).
