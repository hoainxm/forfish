# Báo cáo nhóm cá đáy + cá rạn (11 loài) — hồ sơ loài cho dự báo cá SDFish

Ngày: 2026-10-03 · Agent: nghiên cứu sinh thái nhóm `demersal` + `reef`
Loài: cá hố · cá mối · cá đổng · cá phèn · cá đù · cá khoai · cá chim · cá bơn · cá hồng · cá mú · cá kẽm
Lượt tìm đã dùng: 24/25 (WebSearch) + ~20 WebFetch.

> Quy ước cổng độ sâu đề xuất: `inshore [a, b]` = độ sâu ĐÁY ô ≤ a m thì hợp đủ (×1), ≥ b m thì loại (×0), giữa a–b giảm tuyến tính. Số a/b là đề xuất kỹ thuật suy từ dải phân bố có nguồn, không phải số đo trực tiếp — độ tin ghi riêng từng dòng.

---

## 0. Phát hiện chung cho cả nhóm (đọc trước)

### 0.1 Cổng độ sâu — lỗi lớn nhất, sửa được ngay
Cả 11 hồ sơ không có `inshore`/`offshore`. Mọi loài trong nhóm đều bắt bằng lưới kéo đáy / lưới rê đáy / câu đáy trên **thềm lục địa ≤ 200 m**; các khảo sát nguồn lợi cá đáy của Viện Nghiên cứu Hải sản (RIMF) chia dải độ sâu `<20 · 20–30 · 30–50 · 50–100 · 100–200 m` và dừng ở 200 m (Trần Nhật Anh & Trần Văn Cường 2019, VJMST 19(4), https://doi.org/10.15625/1859-3097/19/4/14924; RIMF "Đa dạng loài nhóm cá đáy ở biển Việt Nam", https://www.rimf.org.vn/bantin/chitiet/dADANGLOAINHOMCAdAYOBIENVIETNAMPhanI). Riêng vùng đánh cá chung Vịnh Bắc Bộ, khảo sát lưới kéo đáy đặt lưới theo 4 dải 0–100 m (https://munin.uit.no/handle/10037/242). **Không có loài nào trong nhóm được khảo sát/đánh bắt trên nền đáy >200 m** ⇒ một cổng chung "đáy ≥ 250–300 m loại hẳn" là an toàn cho cả nhóm, kể cả khi chưa tinh từng loài.

### 0.2 Cá rạn giữa biển sâu (Trường Sa/Hoàng Sa) — cổng độ sâu ĐÁY trung bình ô 0,25° KHÔNG bắt được rạn
- Ô 0,25° ≈ 27 × 27 km. Rạn/đảo chìm ở Trường Sa là chóp san hô nhô từ nền 1.000–2.000 m; hồ (lagoon) trong rạn sâu 5–40 m (báo Pháp Luật, https://baophapluat.vn/nao-dau-xa-truong-sa-ky-iv-post75220.html). Độ sâu TRUNG BÌNH ô chứa rạn vẫn >1.000 m ⇒ cổng theo trung bình sẽ loại luôn vùng câu thật.
- Ngư dân câu ở Trường Sa thả dây ~200 m, câu đáy ở ~150 m sát rạn và đảo chìm, câu đêm (SGGP "Câu cá ở Trường Sa", https://www.sggp.org.vn/cau-ca-o-truong-sa-post122961.html) ⇒ vùng câu rạn thật nằm ở **sườn rạn 20–150 m**, không phải mặt rạn 0–5 m.
- **Ghi nhận, không giải trong báo cáo này**: cần một trong hai cách thay thế: (i) dùng **độ sâu NHỎ NHẤT** (hoặc % diện tích đáy <200 m) trong ô thay cho trung bình; (ii) dùng **lớp rạn có sẵn trong repo** (CLAUDE.md nhắc "lớp rạn 76 MB", `public/data/**`) làm cờ `hasReef` theo ô để cho cá rạn đi qua cổng độ sâu. Cách (ii) đúng sinh thái hơn vì bắt được cả rạn ven bờ miền Trung trên thềm dốc.

### 0.3 Nhiệt độ ĐÁY vs MẶT — khi nào SST đủ dùng
- Mùa đông (gió Đông Bắc) cột nước thềm Bắc Biển Đông xáo trộn đều: quanh Hải Nam tháng 12/2023 nước ven bờ mặt 23,7–25,0 °C / đáy 23,6–24,9 °C; nước khơi mặt 25,9–27,2 / đáy 25,9–27,2 °C — **mặt ≈ đáy** (Animals 2026, https://pmc.ncbi.nlm.nih.gov/articles/PMC12985263/). Front nhiệt Vịnh Bắc Bộ xuất hiện tháng 12, mạnh nhất tháng 1, tan hết tháng 5 (SPIE 4892, https://biomedicaloptics.spiedigitallibrary.org/conference-proceedings-of-spie/4892/0000/Seasonal-and-interannual-variability-of-thermal-fronts-in-the-Tonkin/10.1117/12.466879.full).
- Mùa hè phân tầng rõ ở ngoài đường đẳng sâu 30 m Vịnh Bắc Bộ (nghiên cứu tốc độ âm, Water 2024, https://www.mdpi.com/2073-4441/16/20/2943) ⇒ **từ tháng 5–10, ở đáy >30 m, SST cao hơn nhiệt đáy vài °C**. Hậu quả cho mô hình: nếu `tempSource: bottom` nhưng nguồn chỉ có SST, thì **trần nhiệt (mốc c, d) của cá đáy phải nới lên** (SST ven bờ Nam Bộ mùa hè 30–31,5 °C) để không tắt loài đúng vụ Nam — đúng kiểu lỗi ngừ ồ trong BRIEF.
- Khuyến nghị `tempSource`: **bottom** cho mối, đổng, phèn, đù, khoai, bơn, chim, hồng, mú, kẽm; **surface** (giữ) cho cá hố (cá lớn ăn gần mặt ban ngày — FishBase). Bằng chứng nhiệt đáy chi phối cấu trúc cá đáy: Vịnh Bắc Bộ "thay đổi cấu trúc quần xã cá chủ yếu liên quan biến động nhiệt độ đáy theo mùa; mùa đông cá nhiệt đới di cư rời ven bờ ra vùng sâu" (Fishes 8(11):559, https://doi.org/10.3390/fishes8110559; Frontiers 2023, https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2023.1133462/full).

### 0.4 Mùa vụ cá đáy theo vùng — bằng chứng RIMF
- Toàn biển VN: cá đáy mùa gió **Đông Bắc > Tây Nam** cả về số loài (685 vs 598) và sản lượng; sinh khối cá đáy: Vịnh Bắc Bộ 121.775 t · Trung Bộ 363.526 t · Đông Nam Bộ 231.375 t · Tây Nam Bộ 77.151 t (RIMF, VJMST, https://vjs.ac.vn/index.php/jmst/article/view/6236).
- Vịnh Bắc Bộ (vùng đánh cá chung 2015–2019, 20 chuyến lưới kéo đáy): CPUE TB 52,18 kg/h; nhóm ưu thế = cá đù, cá cơm, cá phèn, cá mối, cá kẽm, cá úc, cá đổng; **dải 30–50 m sinh khối cao hơn mùa Tây Nam, dải 50–100 m cao hơn mùa Đông Bắc** (Tạp chí KH ĐH Cần Thơ 56(4) 2020, https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/3592; CPUE tháng 11–12/2001 đạt 76,8 kg/h — RIMF). ⇒ Mùa đông cá đáy dồn ra dải 50–100 m: đây là lý lẽ để cổng độ sâu KHÔNG cắt dưới 100 m ở Vịnh Bắc Bộ.
- Đông Nam Bộ: lưới kéo chiếm 58,2% cường lực và 55,9% sản lượng vùng khơi (Cục Thông tin KH&CN, https://vista.gov.vn/vi/news/ket-qua-nghien-cuu-trien-khai/nghien-cuu-bien-dong-va-phan-bo-cuong-luc-khai-thac-hai-san-o-vung-bien-xa-bo-dong-nam-bo-7833.html). **Không tìm được** bảng tháng rộ cá đáy riêng cho Đông Nam Bộ từ RIMF/Tổng cục trong ngân sách tìm — xem mục "Điều không tìm được".

---

## 1. Cá hố — *Trichiurus lepturus*

1. **Định danh**: NĐ 37/2024 Phụ lục V ghi cá hố = *Trichiurus lepturus* (xác nhận qua trích dẫn Nghị định trên báo chí, https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/99531/toan-van-nghi-dinh-309-2025-nd-cp-ngung-hieu-luc-quy-dinh-kich-thuoc-toi-thieu-duoc-phep-khai-thac-mot-so-loai-thuy-san). Tên gộp: ở VN "cá hố" còn gồm *T. japonicus*/*Lepturacanthus savala* (cá hố răng) — không kiểm chứng được trong lượt tìm.
2. **Nhiệt độ**: FishBase không cho envelope số; phân bố 49°N–54°S, cận nhiệt–nhiệt đới (https://fishbase.se/summary/1288). Không có bài CPUE–SST ở VN trong lượt tìm. Hồ sơ hiện tại [22,24,29,31] không có cơ sở bác bỏ nhưng trần 31 có nguy cơ tắt vụ hè ven bờ Nam Bộ (xem 0.3).
3. **Độ sâu**: FishBase 0–589 m, **thường 100–350 m**, benthopelagic; nhưng cũng sống đáy bùn ven bờ, vào cửa sông. **Di cư thẳng đứng ngày–đêm**: cá lớn ăn gần mặt ban ngày, xuống đáy ban đêm; cá nhỏ ban ngày thành đàn cách đáy ~100 m, đêm lên gần mặt. Ở VN: là loài chỉ thị trong khảo sát lưới kéo đáy Vịnh Bắc Bộ 0–100 m, sinh khối 3.600 → 2.600 t giữa hai đợt (https://munin.uit.no/handle/10037/242); Lý Sơn: "cá hố mùa này các bãi ngang ven biển trúng đậm", đánh đêm–rạng sáng cách đảo 3–5 hải lý (SGGP, https://www.sggp.org.vn/tranh-thu-nang-am-ngu-dan-quang-ngai-ra-khoi-ca-day-khoang-post711103.html). Nghề: lưới kéo, câu vàng, lưới rê, vây.
4. **Mồi**: cá lớn ăn cá nhỏ/mực; cá non ăn euphausiid, giáp xác phù du (FishBase) ⇒ liên hệ gián tiếp với nước giàu chl qua cá mồi; `chlLog [-0.6, 0.6]` hợp lý.
5. **Cơ chế gom**: không có bằng chứng riêng ở VN. Ở Bắc Biển Đông được xếp "loài khai thác chính" cả nhóm cá nổi và đáy (Fishes 8(11):559). Giữ trọng số hiện tại.
6. **Mùa vụ**: không tìm được bảng tháng theo vùng từ RIMF. Bằng chứng gián tiếp: cá đáy Vịnh Bắc Bộ Đông Bắc > Tây Nam (0.4). Hồ sơ hiện tại 3–7 Trung Bộ + VBB: **không có nguồn xác nhận cũng không bác**.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[200, 500]` | benthopelagic, thường 100–350 m; đánh bắt VN trên thềm ≤100 m nhưng loài có mặt tới sườn thềm | FishBase 1288; munin 10037/242 | vừa |
| `tempSource` | (mặc định surface) | giữ `surface` | cá lớn ăn gần mặt ban ngày | FishBase | vừa |
| `sst` | [22,24,29,31] | [22,24,30,32] | nới trần để không tắt vụ hè ven bờ (0.3) | suy luận từ 0.3 | thấp |
| `seasons` | 3–7 (TB, VBB) | giữ + thêm `dong-nam-bo` 10–3 (gió Đông Bắc) | cá đáy toàn vùng ĐB>TN; ĐNB là vùng kéo đáy lớn | RIMF 6236; vista.gov.vn | thấp |
| `depthBand` | "tầng đáy–giữa 20–100 m" | "tầng giữa–đáy, thường 100–350 m; ven bờ bùn 20–100 m" | | FishBase | cao |

---

## 2. Cá mối — *Saurida tumbil*, *S. undosquamis* (+ *S. elongata*, *Trachinocephalus myops*)

1. **Định danh**: RIMF danh mục cá kinh tế xa bờ: "cá mối thường/vảy to *Saurida tumbil*", "cá mối vạch *S. undosquamis*" (https://www.rimf.org.vn/bantin/chitiet/danh-muc-cac-loai-ca-kinh-te-thuong-gap-o-vung-bien-xa-bo). Tên gộp nhiều loài cùng họ Synodontidae.
2. **Nhiệt độ**: không có envelope số ở VN. Quanh Hải Nam, *S. undosquamis* là loài ưu thế mùa xuân (tháng 4) chiếm vùng nước pha trộn, nhiệt đáy 25,9–29,0 °C (PMC12985263). Weizhou (Bắc Vịnh Bắc Bộ) nhiệt nước năm 19–30 °C, cá vẫn hiện diện cả năm (Frontiers 2023). Hồ sơ [18,23,29,31] chấp nhận được; trần nên nới (0.3).
3. **Độ sâu**: FishBase *S. tumbil* **thường 20–60 m** (tới 700), đáy bùn, bãi kéo lưới (https://www.fishbase.se/summary/Saurida-tumbil); RIMF ghi 20–60 m. Ưu thế lưới kéo đáy Vịnh Bắc Bộ (CTU 3592).
4. **Mồi**: săn cá, giáp xác, mực (FishBase) ⇒ không lệ thuộc trực tiếp chl; `surfaceSignal: low` đúng.
5. **Cơ chế gom**: nền đáy bùn–cát; dồn ra dải 50–100 m mùa đông (0.4). Không có bằng chứng front/xoáy.
6. **Mùa vụ**: Vịnh Bắc Bộ: quanh năm, Đông Bắc cao hơn (CTU 3592; RIMF). Hồ sơ hiện tại 10–4 toàn vùng: phù hợp.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[80, 150]` | thường 20–60 m; khảo sát/đánh bắt ≤100 m | FishBase; RIMF; CTU 3592 | cao |
| `tempSource` | bottom | giữ | | 0.3 | cao |
| `sst` | [18,23,29,31] | [18,22,30,32] | nới trần hè khi chỉ có SST | 0.3 | thấp |
| `seasons` | 10–4 | giữ | ĐB > TN | CTU 3592 | vừa |

---

## 3. Cá đổng (cá lượng) — *Nemipterus* spp.

1. **Định danh**: họ Nemipteridae ở VN 23 loài, 4 giống; giống *Nemipterus* 13 loài chiếm 75–88% sản lượng họ. **Loài ưu thế theo vùng**: Vịnh Bắc Bộ *N. japonicus* 50,67%; Trung Bộ *N. bathybius* 58,97%, *N. virgatus* 19,24%; Đông Nam Bộ *N. nemurus* 38,34%, *N. aurora* 13,39%, *N. bathybius* 11,83%; Tây Nam Bộ *Scolopsis taeniopterus* 30,72%, *N. mesoprion* 25,69%, *N. nemurus* 24,91% (Trần Nhật Anh & Trần Văn Cường 2019, VJMST 19(4):579–588). "Cá đổng" vì thế là **tên gộp ≥5 loài, khác loài theo vùng**.
2. **Nhiệt độ**: không có envelope ở VN. *N. japonicus* ưu thế Vịnh Bắc Bộ nơi nhiệt đáy mùa đông xuống ~19–24 °C (Weizhou 19–30 °C; Hải Nam ven bờ 23,6–24,9 °C) và CPUE mùa Đông Bắc cao hơn ⇒ **sàn 24 °C của hồ sơ hiện tại là quá cao**, sẽ tắt Vịnh Bắc Bộ đúng vụ Đông Bắc.
3. **Độ sâu**: phân bố **khắp 0–200 m**; số loài nhiều nhất ở 50–100 m (25 loài) nhưng **CPUE theo dải (TB 2012–13): <20 m cao nhất 2,22 kg/h, 50–100 m thấp nhất 1,43 kg/h**; mật độ mùa Đông Bắc thấp nhất ở 50–100 m (9,36 kg/km²), mùa Tây Nam cao nhất <20 m (15,04). CPUE theo vùng: VBB 2,6 · TB 0,97 · ĐNB 1,78 · TNB 1,27 kg/h. Sinh khối ĐB 2012 = 12.229 t, TN 2013 = 7.534 t. ⇒ Câu chú thích hồ sơ "đàn đông ở dải 50–100 m" **không đúng với số liệu CPUE** (đó là số loài, không phải sản lượng).
4. **Mồi**: ăn đáy (giáp xác, cá nhỏ) — không lệ thuộc chl mặt; `surfaceSignal: low` đúng.
5. **Cơ chế gom**: nền đáy bùn–cát; mùa đông dồn 50–100 m ở VBB (0.4). Không bằng chứng front.
6. **Mùa vụ**: Đông Bắc > Tây Nam toàn biển; VBB và ĐNB là 2 vùng CPUE cao. Hồ sơ 10–3 phù hợp. Vùng `hoang-sa` trong hồ sơ: khảo sát RIMF không có trạm trên 200 m ⇒ không có bằng chứng, nên bỏ (rạn Hoàng Sa cũng không phải bãi kéo đáy).
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[120, 250]` | khảo sát tới 100–200 m vẫn có CPUE 2,26 kg/h; không có ngoài 200 m | VJMST 14924 | cao |
| `sst` | [24,25,29,30] | [19,22,30,32] | ưu thế VBB, vụ Đông Bắc, nhiệt đáy mùa đông ~19–24 °C; trần 30 tắt hè | VJMST 14924; PMC12985263; Frontiers 2023 | vừa |
| `tempSource` | bottom | giữ | | 0.3 | cao |
| `seasons.regions` | gồm `hoang-sa` | bỏ `hoang-sa` | không có khảo sát/nghề kéo đáy ở rạn giữa biển | VJMST 14924 | vừa |
| `depthBand` | "đáy bùn cát 50–100 m" | "đáy bùn cát 10–200 m, CPUE cao <50 m, mùa đông ra 50–100 m" | | VJMST 14924 | cao |

---

## 4. Cá phèn — *Upeneus* spp. (Mullidae)

1. **Định danh**: *U. japonicus* (ưu thế Vịnh Bắc Bộ), *U. sulphureus*, *U. moluccensis*, *U. margarethae* (VJMST 8052, https://vjs.ac.vn/index.php/jmst/article/download/8052/8768/38608; fishsource 3657). Tên gộp nhiều loài. Tên Việt từng loài chưa đối chiếu được với Phụ lục V.
2. **Nhiệt độ**: *U. margarethae* đẻ quanh năm ở Trung Bộ nhưng **ngừng đẻ mùa đông ở Bắc Bộ** (VJMST 8052) ⇒ nhạy lạnh hơn cá đổng/cá mối; sàn 22 °C hợp lý. FishBase *U. japonicus* cận nhiệt, 4–90 m (https://www.fishbase.se/summary/Upeneus-japonicus).
3. **Độ sâu**: *U. japonicus* VN: phân bố <200 m, **chủ yếu <100 m**, tập trung Vịnh Bắc Bộ; FishBase 4–90 m. Là mục tiêu chính lưới kéo đáy vùng đánh cá chung (VJMST 8052; CTU 3592).
4. **Mồi**: ăn đáy bằng râu (benthic) — không lệ thuộc chl mặt; nền cát.
5. **Cơ chế gom**: nền cát; không bằng chứng front.
6. **Mùa vụ**: quanh năm; VBB Đông Bắc cao hơn. Hồ sơ 3–6 + 9–11 không có nguồn xác nhận riêng; không bác.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[80, 150]` | chủ yếu <100 m, FishBase 4–90 | VJMST 8052; FishBase | cao |
| `sst` | [22,25,30,32] | giữ | ngừng đẻ mùa đông Bắc Bộ ⇒ sàn 22 ổn; trần 32 đủ | VJMST 8052 | vừa |
| `seasons` | 3–6, 9–11 | giữ (không có nguồn) | | — | thấp |

---

## 5. Cá đù (cá sủ) — họ Sciaenidae

1. **Định danh**: tên gộp cả họ: *Johnius* spp. (cá đù), *Pennahia* spp. (cá đù bạc), *Otolithes ruber* (cá đù sóc/cá nạng), *Larimichthys* (cá đù vàng, VBB), cá sủ = *Protonibea diacanthus*/*Boesemania microlepis* (cá sủ vàng, cá sủ kép). Cửa sông Tây Cà Mau ghi nhận 10 loài (CTU 3683, https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/3683). Tên Việt–khoa học từng loài chưa đối chiếu được với Phụ lục V.
2. **Nhiệt độ**: nhóm cá đù (*Johnius taiwanensis*, *Pennahia macrocephalus*, *Chrysochir aureus*) ở Tây Đài Loan gắn với nhiệt đáy thu–đông **23,8–25,3 °C**, "tụ ở cửa sông đục" (Sci Rep 2023, https://pmc.ncbi.nlm.nih.gov/articles/PMC10656438/); *J. taiwanensis* là loài chỉ thị khối nước ven bờ mùa đông quanh Hải Nam, đáy 23,6–24,9 °C (PMC12985263). ⇒ Sàn 20–22 °C hợp lý; trần 30 tắt hè Nam Bộ.
3. **Độ sâu**: cửa sông–ven bờ; khảo sát Đài Loan 15–35 m; VBB ưu thế lưới kéo đáy (CTU 3592) ở 30–100 m. Cà Mau: mật độ cao ở phía cửa sông/biển (Cửa Lớn tăng ra phía biển 2,89→27,66 g/ha).
4. **Mồi**: nước đục, phù sa cửa sông — gắn với **chl cao/độ đục**; `chlLog [0, 1.4]` đúng hướng; `surfaceSignal: medium` chấp nhận.
5. **Cơ chế gom**: front độ mặn/độ đục cửa sông (không phải front nhiệt khơi); mùa đông dồn ven bờ (chỉ thị khối nước ven bờ).
6. **Mùa vụ**: Cà Mau: **mùa mưa** mật độ cao nhất (Sa Phô 31,16 g/ha) (CTU 3683); VBB: cá đù ưu thế, ĐB > TN. Hồ sơ 3–5, 9–11 chưa phủ mùa mưa Tây Nam Bộ (6–10).
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[50, 100]` | cửa sông–ven bờ; khảo sát 15–35 m; VBB ≤100 m | PMC10656438; CTU 3683; CTU 3592 | cao |
| `sst` | [20,22,28,30] | [20,22,30,32] | trần 28–30 tắt vụ mưa Nam Bộ (SST 30–31) | 0.3 | vừa |
| `seasons` | 3–5, 9–11 | thêm `{months:[6,7,8,9,10], regions:[tay-nam-bo, dong-nam-bo]}` | mùa mưa mật độ cao ở cửa sông Cà Mau | CTU 3683 | vừa |
| `w.thermFront` | 0.2 | 0.1 | gom theo front đục/mặn cửa sông, không phải front nhiệt khơi | suy luận | thấp |

---

## 6. Cá khoai — *Harpadon nehereus*

1. **Định danh**: *Harpadon nehereus* (Synodontidae), tên duy nhất, không gộp (FishBase 260, https://fishbase.net.br/summary/260).
2. **Nhiệt độ**: không có envelope. Loài nhiệt đới Ấn Độ–Tây Thái Bình Dương; **vụ chính VN rơi vào mùa lạnh** (xem 6) ở Thái Bình–Quảng Bình nơi SST tháng 12–2 ≈ 19–23 °C ⇒ **sàn 24/26 °C hiện tại tắt loài đúng vụ** — lỗi cùng kiểu ngừ ồ nhưng ngược chiều.
3. **Độ sâu**: benthopelagic, phần lớn năm ở nước sâu hơn ngoài khơi đáy cát bùn (~50 m), **mùa gió mùa vào cửa sông/châu thổ thành đàn lớn để ăn**; ghi nhận bắt ở 26–28 m (FishBase). VN: lưới rê/kéo ven bờ các tỉnh Thái Bình, Nam Định, Thanh Hóa, Quảng Bình, Vũng Tàu, Trà Vinh–Cà Mau (báo).
4. **Mồi**: ăn cá nhỏ, giáp xác ở vùng cửa sông giàu dinh dưỡng ⇒ `chlLog [0.2, 1.4]` đúng hướng.
5. **Cơ chế gom**: dồn đàn vào cửa sông theo gió mùa (FishBase) — cơ chế mặn/đục, không phải front nhiệt khơi.
6. **Mùa vụ (báo chí — chỉ dùng cho tháng rộ)**: **tháng 9–12 âm lịch (≈ tháng 10–1 dương), có nơi kéo tới tháng 2 âm** ở Thái Bình, Nam Định, Thanh Hóa, Quảng Bình, Vũng Tàu; **miền Nam rộ tháng 3–4 âm (≈ tháng 4–5 dương)** (VietNamNet, https://vietnamnet.vn/mon-ca-tron-tuon-tuot-mem-nhu-chao-khach-nha-giau-cung-kho-ma-mua-789340.html). **Hồ sơ hiện tại 5–10 là NGƯỢC mùa** cho Bắc–Trung Bộ.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `seasons` | 5–10 (VBB, ĐNB, TNB) | `{months:[10,11,12,1,2,3], regions:[vinh-bac-bo, trung-bo, dong-nam-bo]}` + `{months:[4,5], regions:[tay-nam-bo, dong-nam-bo]}` | vụ chính mùa lạnh Bắc–Trung; Nam rộ tháng 3–4 âm | VietNamNet (báo) | vừa (báo, 2 bài cùng nói) |
| `sst` | [24,26,30,32] | [18,21,30,32] | vụ chính khi SST Bắc Bộ 19–23 °C | suy từ mùa vụ + nhiệt mùa đông (PMC12985263, Frontiers 2023) | vừa |
| `inshore` | không có | `[40, 80]` | cửa sông–ven bờ, bắt ở 26–28 m, ≤~50 m | FishBase 260 | cao |
| `tempSource` | bottom | giữ (ven bờ nông: mặt ≈ đáy) | | 0.3 | cao |

---

## 7. Cá chim — *Pampus argenteus* (chim trắng) + *Parastromateus niger* (chim đen)

1. **Định danh**: tên gộp **hai họ khác nhau**: cá chim trắng *Pampus argenteus* (Stromateidae) và cá chim đen *Parastromateus niger* (Carangidae); còn *Pampus chinensis* (chim Trung Hoa). Gộp chấp nhận được vì cùng tầng/đáy (xem 3).
2. **Nhiệt độ**: *P. argenteus* "loài nổi gần bờ ôn–nhiệt đới ấm" (PMC12649313) — không có envelope số ở VN. Hồ sơ [22,24,29,31] không bác được; trần cần nới (0.3).
3. **Độ sâu**: *P. argenteus* **5–110 m**, benthopelagic, đáy cát–bùn (FishBase 491, https://www.fishbase.se/summary/491); *P. niger* **15–105 m** (Wikipedia/FishBase). ⇒ cổng ~100 m.
4. **Mồi**: *P. argenteus* ăn sứa, giáp xác nhỏ, động vật phù du (FishBase) ⇒ **có liên hệ với nước giàu phù du**; `chlLog [-0.3, 0.8]` nên nâng cận trên lên ~1.0. `surfaceSignal: medium` hợp.
5. **Cơ chế gom**: nền đáy bùn ven bờ; không bằng chứng front ở VN.
6. **Mùa vụ**: *P. niger* Sóc Trăng–Cà Mau **đẻ tháng 6–10, đỉnh tháng 8**, GSI cao nhất tháng 8 (CTU 2130, https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/2130) ⇒ đàn tụ ven bờ Tây Nam Bộ mùa mưa; hồ sơ 3–9 nên kéo tới tháng 10 cho TNB. Không có số liệu tháng cho VBB.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[80, 150]` | 5–110 m / 15–105 m | FishBase 491; P. niger | cao |
| `seasons` | 3–9 | 3–10 (thêm tháng 10 cho `tay-nam-bo`) | đẻ 6–10, đỉnh 8 | CTU 2130 | vừa |
| `chlLog` | [-0.3, 0.8] | [-0.3, 1.0] | ăn phù du/sứa ven bờ | FishBase 491 | thấp |
| `sst` | [22,24,29,31] | [22,24,30,32] | nới trần hè | 0.3 | thấp |

---

## 8. Cá bơn — Psettodidae / Cynoglossidae / Bothidae

1. **Định danh**: tên gộp: cá bơn ngộ *Psettodes erumei* (Psettodidae), cá bơn lưỡi trâu *Cynoglossus* spp. (Cynoglossidae), cá bơn vỉ Bothidae. Không đối chiếu được Phụ lục V.
2. **Nhiệt độ**: không có envelope. Loài dẹt nhiệt đới tầng đáy; Tây Đài Loan nhóm cá dẹt (*Arnoglossus tenuis*) thuộc nhóm "ưa >24 °C quanh năm, 26,6–28,5 °C" trong khi *Tarphops*, *Liachirus* rộng nhiệt <24 → >28 °C (PMC10656438). Hồ sơ [26,27,29,31] **quá hẹp** (sàn 26 tắt cả Vịnh Bắc Bộ mùa đông, nơi hồ sơ lại ghi vụ 10–3) — mâu thuẫn nội tại.
3. **Độ sâu**: *Cynoglossus arel* **9–125 m** đáy bùn cát thềm, vào cửa sông (FishBase, https://www.fishbase.se/summary/Cynoglossus-arel); *Psettodes erumei* **1–100 m** (FishBase/Wikipedia, https://en.wikipedia.org/wiki/Psettodes_erumei); bắt phụ trong lưới kéo đáy đa loài và lưới rê.
4. **Mồi**: ăn động vật đáy ⇒ không lệ thuộc chl mặt; `surfaceSignal: low` đúng.
5. **Cơ chế gom**: nền đáy mềm; không có bằng chứng front. Trọng số hiện tại đều 0.05–0.1 là đúng.
6. **Mùa vụ**: không tìm được nguồn VN riêng; bằng chứng gián tiếp ĐB > TN cho cá đáy (0.4). Hồ sơ 10–3 giữ.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[80, 150]` | 1–125 m thềm | FishBase | cao |
| `sst` | [26,27,29,31] | [20,23,30,32] | hồ sơ ghi vụ 10–3 ở VBB nhưng sàn 26 tắt VBB mùa đông; nhóm dẹt có loài rộng nhiệt <24 °C | PMC10656438; mâu thuẫn nội tại | vừa |
| `seasons` | 10–3 | giữ | | RIMF 6236 (gián tiếp) | thấp |

---

## 9. Cá hồng — *Lutjanus* spp. (chủ yếu *L. malabaricus*, *L. erythropterus*, *L. argentimaculatus*, *L. johnii*)

1. **Định danh**: tên gộp giống *Lutjanus* (>100 loài họ Lutjanidae); loài kinh tế ven bờ Bắc Trung Bộ là *L. malabaricus* (Tạp chí KHCN Nhiệt đới, https://tapchikhcnnd.mod.gov.vn/index.php/tckhcnnd/article/view/146).
2. **Nhiệt độ**: không có envelope số ở VN. Nghệ An–Hà Tĩnh: CPUE **cao hơn mùa gió Đông Bắc** (10–4) khi SST VBB 19–24 °C ⇒ sàn 23–25 °C hiện tại sẽ loại chính vùng có nghiên cứu.
3. **Độ sâu**: FishBase *L. malabaricus* **12–100 m**, rạn ven bờ và khơi, cả **đáy bùn cứng** (Arafura), cá non ở rừng ngập mặn/cỏ biển, cá lớn ra sâu (https://www.fishbase.se/summary/Lutjanus-malabaricus). VN: Nghệ An–Hà Tĩnh **6–67 m**, nền cát, cát bùn, đá, san hô; trung bình 5–6 kg/chuyến, cá 25–60 cm. Trường Sa: câu đáy ~150 m sát rạn/đảo chìm (SGGP). ⇒ dải thực tế 6–150 m.
4. **Mồi**: săn cá nhỏ, giáp xác, mực **về đêm** (FishBase) ⇒ không lệ thuộc chl; nước trong hay đục đều có (bùn cứng Arafura). `chlLog [-1, 0.2]` hơi hẹp về phía đục — nới lên 0.5 cho rạn ven bờ Bắc Trung Bộ.
5. **Cơ chế gom**: **nền đáy cứng/rạn** là cơ chế chính; không có bằng chứng front/xoáy. Trọng số cơ chế đều 0.05 là hợp lý; thứ thiếu là cổng độ sâu + cờ rạn (0.2).
6. **Mùa vụ**: Nghệ An–Hà Tĩnh mùa khai thác **tháng 4–10** nhưng CPUE cao hơn mùa Đông Bắc — hai mệnh đề trong cùng bài, ghi cả hai. Ấu trùng cá hồng/mú/dìa ở rạn Sơn Trà quanh năm, tập trung **4–9** (ResearchGate 289499200). Hồ sơ 4–10 phù hợp; **thiếu vùng `vinh-bac-bo`** dù có nghiên cứu riêng ở đó.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[100, 200]` + **bypass khi ô có rạn** (0.2) | 12–100 m; VN 6–67 m; câu Trường Sa ~150 m | FishBase; KHCN Nhiệt đới 146; SGGP | cao (dải) / vừa (b) |
| `seasons.regions` | TB, HS, NTB, TS, ĐNB | thêm `vinh-bac-bo` | nghiên cứu Nghệ An–Hà Tĩnh | KHCN Nhiệt đới 146 | cao |
| `sst` | [23,25,29,31] | [20,23,30,32] | CPUE cao mùa Đông Bắc ở VBB; nới trần hè | KHCN Nhiệt đới 146; 0.3 | vừa |
| `chlLog` | [-1, 0.2] | [-1, 0.5] | sống cả đáy bùn cứng/ven bờ đục | FishBase | thấp |
| `tempSource` | (surface) | `bottom` | cá đáy 12–100 m, phân tầng hè | 0.3 | vừa |
| `depthBand` | "rạn & đáy cứng 12–100 m" | "rạn & đáy cứng 6–150 m" | | như trên | cao |

---

## 10. Cá mú (cá song) — *Epinephelus* spp. (+ *Plectropomus*, *Cephalopholis*)

1. **Định danh**: tên gộp; loài kinh tế VN: *E. coioides* (mú chấm cam/song chấm nâu), *E. bleekeri*, *E. fuscoguttatus* (song hổ — Sách Đỏ VN, http://vnredlist.vast.vn/epinephelus-fuscoguttatus/), *E. malabaricus*, *Plectropomus leopardus* (mú đỏ/mú sao — Côn Đảo).
2. **Nhiệt độ**: FishBase *E. coioides* "cận nhiệt", không envelope số; không có bài CPUE–SST ở VN. Hồ sơ [24,25,29,31] không bác được; trần nên nới (0.3) vì mú ven bờ/cửa sông Nam Bộ sống trong nước 30–31 °C mùa hè.
3. **Độ sâu**: *E. coioides* **1–100 m**, rạn ven bờ **nước đục**, cửa sông, đáy bùn–vụn (https://www.fishbase.se/summary/Epinephelus-coioides); *E. fuscoguttatus* tụ đẻ ở lạch, rạn, chóp đá ngầm **3–70 m** (vnredlist). Côn Đảo: mú đỏ "sống ở dải san hô ngầm, càng xa bờ càng nhiều" (mia.vn — báo du lịch, chỉ tham khảo).
4. **Mồi**: ăn cá nhỏ, tôm, cua; không lệ thuộc chl. *E. coioides* **ưa nước đục** ⇒ `chlLog [-1.2, 0.1]` (nước trong) **lệch** với loài ven bờ chính; nới cận trên.
5. **Cơ chế gom**: nền rạn/đáy cứng + tụ đẻ theo tuần trăng (vnredlist) — không có front/xoáy. Giữ trọng số 0.05.
6. **Mùa vụ**: ấu trùng rạn Sơn Trà tập trung 4–9; không có bảng tháng theo vùng. Hồ sơ 4–9 phù hợp; thiếu `vinh-bac-bo` và `tay-nam-bo` (Phú Quốc) — không có nguồn số, ghi "giữ".
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[60, 150]` + bypass rạn (0.2) | 1–100 m; tụ đẻ 3–70 m | FishBase; vnredlist | cao |
| `chlLog` | [-1.2, 0.1] | [-1.2, 0.5] | *E. coioides* ưa rạn đục, cửa sông | FishBase | vừa |
| `sst` | [24,25,29,31] | [23,25,30,32] | nới trần hè ven bờ | 0.3 | thấp |
| `tempSource` | (surface) | `bottom` | | 0.3 | vừa |

---

## 11. Cá kẽm — Haemulidae: *Diagramma pictum* (= *Plectorhinchus pictus*), *Plectorhinchus* spp.

1. **Định danh**: cá kẽm hoa/kẽm bông = *Diagramma pictum* (Thunberg 1792), đồng danh *Plectorhinchus pictus* (FAO/FishBase, https://marinebiodiversity.org.bd/species/diagramma-pictum/); các *Plectorhinchus* khác (kẽm sọc, kẽm chấm). Tên gộp. Cá kẽm cũng nằm trong nhóm ưu thế lưới kéo đáy Vịnh Bắc Bộ (CTU 3592) ⇒ **không chỉ cá rạn nước trong**.
2. **Nhiệt độ**: không có envelope. Hồ sơ [26,27,29,31] rất hẹp; loài có mặt ở VBB (lưới kéo) nơi mùa đông 19–24 °C ⇒ sàn 26 sai.
3. **Độ sâu**: *D. pictum* **1–170 m, thường 1–50 m**, "đơn lẻ hoặc theo nhóm, **thường trong nước đục**, trên đáy bùn/cát/bột trong vịnh kín, cửa sông, quanh mỏm đá, xác tàu" (https://www.fishbase.se/summary/Diagramma-pictum). FAO: rạn và ven bờ tới 80 m.
4. **Mồi**: ăn động vật đáy, cá nhỏ; không lệ thuộc chl; **không phải loài nước trong** ⇒ `chlLog [-1.2, 0]` sai hướng.
5. **Cơ chế gom**: đáy cứng/mỏm đá/xác tàu + nền mềm vịnh kín; không có front.
6. **Mùa vụ**: không tìm được nguồn VN; hồ sơ 3–10 "giữ".
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | không có | `[50, 100]` + bypass rạn | thường 1–50 m, tới 80 m | FishBase; FAO | cao |
| `chlLog` | [-1.2, 0] | [-0.8, 0.6] | "often in turbid water", vịnh kín, cửa sông; có trong lưới kéo VBB | FishBase; CTU 3592 | vừa |
| `sst` | [26,27,29,31] | [21,24,30,32] | có mặt VBB mùa Đông Bắc | CTU 3592 | vừa |
| `depthBand` | "rạn nước trong 2–25 m" | "rạn, mỏm đá và đáy mềm vịnh kín 1–50 m, có khi 80 m" | | FishBase | cao |
| `seasons.regions` | TB, HS, NTB, TS | thêm `vinh-bac-bo` | ưu thế lưới kéo đáy VBB | CTU 3592 | vừa |
| `tempSource` | (surface) | `bottom` | | 0.3 | vừa |

---

## Top 5 sửa đáng làm nhất của nhóm (tác động × độ tin)

1. **Thêm cổng độ sâu `inshore` cho CẢ 11 loài** (mối/phèn/chim/bơn `[80,150]`, đổng `[120,250]`, đù `[50,100]`, khoai `[40,80]`, hồng `[100,200]`, mú `[60,150]`, kẽm `[50,100]`, hố `[200,500]`). Tác động: xoá hàng trăm ô điểm cao trên nước >1.000 m. Độ tin cao — toàn nhóm được khảo sát/đánh bắt ≤200 m (RIMF VJMST 14924, 6236; FishBase).
2. **Cá khoai: đảo mùa vụ** 5–10 → 10–3 (Bắc–Trung–ĐNB) + 4–5 (TNB), và hạ sàn nhiệt 24 → 18 °C. Hiện tại loài tắt đúng vụ chính Thái Bình–Quảng Bình. Độ tin vừa (báo chí, hai bài nhất quán; FishBase xác nhận cơ chế dồn cửa sông theo gió mùa).
3. **Hạ sàn nhiệt cho cá đổng (24→19), cá bơn (26→20), cá kẽm (26→21), cá hồng (23→20)** — bốn loài có bằng chứng hiện diện/ưu thế ở Vịnh Bắc Bộ mùa gió Đông Bắc (RIMF; CTU 3592; Nghệ An–Hà Tĩnh) nhưng sàn hiện tại loại cả vịnh mùa đông. Độ tin vừa–cao.
4. **Cờ rạn thay cho (hoặc bypass) cổng độ sâu trung bình ở ô có rạn** cho hồng/mú/kẽm — nếu không, cổng mới (mục 1) sẽ xoá sạch Trường Sa/Hoàng Sa, nơi ngư dân thật câu ở sườn rạn 20–150 m. Độ tin cao về vấn đề; cách giải (min-depth trong ô hay lớp rạn trong repo) để team quyết.
5. **Nới trần nhiệt (mốc d) lên 32 °C cho toàn nhóm `tempSource: bottom` khi nguồn chỉ có SST** (mối, đổng, đù, chim, hồng, mú, kẽm hiện trần 30–31). Mùa hè SST ven bờ Nam Bộ 30–31,5 °C trong khi nhiệt đáy >30 m thấp hơn vài độ — trần theo SST sẽ tắt vụ Nam. Độ tin vừa (cơ chế phân tầng có nguồn; con số 32 là biên an toàn, không phải đo).

Ưu tiên phụ: thêm `vinh-bac-bo` vào vùng của cá hồng và cá kẽm; bỏ `hoang-sa` khỏi cá đổng; cá đù thêm mùa mưa 6–10 Tây Nam Bộ; cá kẽm/mú nới `chlLog` vì loài chính ưa nước đục.

## Điều KHÔNG tìm được

- **Bảng tháng rộ cá đáy theo vùng của RIMF/Tổng cục Thủy sản** (đặc biệt Đông Nam Bộ, Tây Nam Bộ): chỉ có mức "mùa Đông Bắc > Tây Nam" toàn biển và vài con số Vịnh Bắc Bộ. Mùa vụ cá hố, cá mối, cá phèn, cá bơn, cá mú, cá kẽm ở VN → **không có nguồn tháng**; đề xuất "giữ".
- **Envelope nhiệt số (FishBase/AquaMaps) cho từng loài**: FishBase các trang đã đọc không ghi dải nhiệt; AquaMaps không truy cập trong lượt tìm. Mọi đề xuất `sst` ở trên là suy từ sự có mặt theo mùa + nhiệt đáy đo được ở Hải Nam/Weizhou, không phải envelope loài.
- **Nhiệt đáy mùa đông Vịnh Bắc Bộ phía VN (Quảng Ninh–Thanh Hóa)**: chỉ có Weizhou (năm 19–30 °C) và Hải Nam (ven bờ 23,6–24,9 °C tháng 12). Phía bắc vịnh VN có thể lạnh hơn — chưa có số.
- **Phụ lục V NĐ 37/2024 toàn văn**: chỉ xác nhận được cá hố = *T. lepturus*; tên khoa học chính thức VN cho cá đổng/phèn/đù/khoai/chim/bơn/kẽm chưa đối chiếu được với Phụ lục.
- **Độ sâu thật của bãi câu rạn Trường Sa theo từng bãi** (Tư Chính, Phúc Tần…): chỉ có mức chung "~150 m, dây 200 m, hồ rạn 5–40 m".
- **Cá hố di cư thẳng đứng ở VN**: chỉ có FishBase (toàn cầu). Chưa có bằng chứng CPUE–SST/front cho cá hố Biển Đông trong lượt tìm.
- Bài Fishes 8(11):559 (quan hệ sản lượng–môi trường Vịnh Bắc Bộ theo loài) và Biology 14(2):207 (cấu trúc theo gradient độ sâu) **bị 403 khi tải** — chỉ dùng được phần tóm tắt qua kết quả tìm.
