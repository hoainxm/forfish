# Dự báo cá theo chuỗi hải lưu toàn cầu → Biển Đông ("Dòng Dẫn") — tổng hợp team agent 2026-10-22

**Load khi / Load when**: trước khi đầu tư thêm vào dự báo cá (tầng cổng, tầm dài 7–60 ngày, nhãn chuyến), hoặc khi ai đó đề xuất "lấy dòng hải lưu nóng lạnh dự báo cá" — load để biết cái gì đã có cơ sở, cái gì chỉ là ước, và bước đo rẻ nào phải làm trước.

> **Trạng thái: NGHIÊN CỨU, CHƯA ÁP gì vào code.** 7 agent (5 chuyên gia Opus chạy song song, 1 trưởng nhóm đề xuất, 1 phản biện độc lập) chỉ đọc code, đọc tài liệu khoa học, không ghi dữ liệu. Báo cáo gốc cùng thư mục: `01-hai-duong-hoc` · `02-sinh-thai-ca` · `03-phu-du-chuoi-thuc-an` · `04-nguon-quan-sat` · `05-khoa-hoc-du-lieu` · `06-de-xuat-phuong-phap` · `07-phan-bien`. Mỗi báo cáo tự đánh dấu [KC] = có nguồn, [CV] = chuyển vị từ vùng biển khác, [ƯỚC]/[GT] = ước hoặc giả định — giữ nguyên quy ước đó khi trích.

Nền đã biết trước khi bắt đầu (ops/fish-train-review-2026-10-18): mô hình HSI hiện tại 0,736 AUCeff chỉ là bản đồ bãi theo mùa; baseline tĩnh 0,809 và tháng-trước 0,813 thắng nó; ảnh vệ tinh của ngày hôm nay đóng góp ≈0; nhãn eCDT×VMS chia kg đều theo giờ nên không phân giải "ô nào hôm nay có cá".

## 0. Kết luận của lead (đọc nếu chỉ có 2 phút)

1. **Ý tưởng "dòng hải lưu mang cá vào VN" phải sửa thành "dòng hải lưu mang KHỐI NƯỚC vào VN".** Cá ngừ vằn ở Biển Đông là nhiều quần thể địa phương gần như độc lập; cá ở Philippines, Indonesia do quần thể tại chỗ đẻ ra (02 §0, CFRA 2022, FAO). Vậy quan sát ở cổng chỉ dự báo được **môi trường sống** ở thềm Việt Nam, rồi từ môi trường mới suy ra cá. Đây là thay đổi quan trọng nhất so với đề bài.
2. **Chuỗi nhân quả có hai mắt xích mạnh và nhiều mắt xích yếu.** Mạnh, đã kiểm trên số liệu Việt Nam: gió tây nam → nước trồi Nam Trung Bộ (tương quan 0,64–0,71, lead vài ngày tới 1 tuần, 01 §2.3); El Niño → nước trồi hè năm sau yếu và lệch bắc (ONI → SST trễ 3 tháng, r² 0,65; 02 §2). Yếu: độ trễ Luzon → thềm Trung Bộ 3–8 tháng là phép chia quãng đường cho tốc độ trôi, chưa ai đo (01 §2.7); 4/6 cổng không có nghiên cứu độ trễ; mọi mắt xích chl → động vật phù du → cá đều chuyển vị từ California, Indonesia, Lombok (03 §1).
3. **Không có trạm quan sát nào ở cổng phát công khai hằng ngày.** Phao neo ở Luzon, Đài Loan, Karimata đều là dự án nghiên cứu; HF radar Đài Loan không công khai. "Quan sát cổng" phải tự tính từ mặt cắt của CMEMS: GLORYS12 30 năm để học, PHY_001_024 cho hiện tại và 10 ngày tới (04 §0–§2). May là pipeline CMEMS đã có sẵn trong app.
4. **Nút cổ chai vẫn là nhãn cá, không phải vật lý.** Dữ liệu nhãn chỉ có ~10 tháng 2026, toàn tàu ≥15 m, nằm trọn trong một năm El Niño mạnh (ONI quý 7–9/2026 = +2,16, PDO 9/2026 = −1,55; 04 §0.4). Tầm dài không cứu được một tầng cá chưa thắng nền mùa ở tầm 0 ngày (05 C6).
5. **Quyết của lead: NÊN LÀM BẢN TỐI THIỂU theo phản biện (07 §7), không làm bản 4 tầng × 6 cổng của 06.** Thứ tự: đo xem nhãn còn biến thiên để học không (1 tuần) → tầm ngắn 1–14 ngày trên nhãn chuyến → thẻ "triển vọng nước trồi theo mùa" thuần vật lý. Đa cổng, Lagrange (F2/F3) hoãn tới khi có ≥2 năm nhãn.
6. **Bước 0 ĐÃ ĐO 2026-10-22** (`08-buoc-0-ket-qua.md`): 102 100 chuyến; đặc trưng động (chl/front/xoáy/trồi) còn 18–33 % phương sai sau nghề×lớp + tháng×vùng + tàu, **nhiệt mặt biển chỉ còn 4 %**; ICC tàu **0,51**; công suất đủ cho tổng kg và cá nục, **thiếu cho mực xà, ngừ vằn, cá cơm**. Thăm dò: mọi tương quan trong-tàu ≤ 0,08 (trần R² < 1 %), ba đặc trưng đổi dấu giữa hai nửa năm, front chl âm ở mọi tập. **Quyết: đi tiếp có điều kiện** — bước B chỉ trên tổng kg theo nghề + cá nục, có tàu cố định + pha trăng, bỏ nhiệt; kỳ vọng thấp; giá trị thật nằm ở toạ độ mẻ (Q1); bước C không phụ thuộc kết quả này.
7. **Bước C ĐÃ ĐO 2026-10-22** (`09-buoc-C-ket-qua.md`, OISST 44 năm + ERA5 + ONI/PDO, bỏ-từng-năm): ONI mùa đông dự báo **nhiệt mặt biển hè** Nam Trung Bộ (r 0,58, skill +0,17 CI loại 0; thêm dấu PDO 0,64 / +0,22), lead 5–8 tháng; quán tính năm trước phản tác dụng. Nhưng **tương phản ven bờ − khơi, ngày khởi phát, đỉnh nước trồi đều KHÔNG dự báo được** (mọi skill ≤ 0, kể cả gió đồng thời). **Quyết**: thẻ triển vọng chỉ được nói "hè này nước ấm/lạnh hơn mọi năm", KHÔNG nói "nước trồi yếu/muộn". Dự báo khoá trước hè 2027: S_JJA +0,92 ± 0,61 °C (ấm hơn ~1,6 sd); không khoá gì về nước trồi.
8. **Bước C2 ĐÃ ĐO 2026-10-22** (`10-buoc-C2-ekman.md`, gió ERA5 lưới 0,5° hộp SCU, chỉ số theo Herrmann 2023) — **sửa một phần 09**: sau mùa đông El Niño, gió mùa tây nam ở Nam Trung Bộ **vào muộn 6/7 năm** (tỉ lệ gốc 1/3, p ≈ 0,7 %; trung bình 14/7 so với 19/6) và **ít nước lạnh 5/7 năm**; **không năm nào có hè gió mạnh**. Hồi quy mức độ vẫn không có skill. **Quyết**: thẻ triển vọng được nói câu xác suất "gió mùa thường vào muộn, nước ven bờ ít lạnh hơn" kèm năm tương tự; không nói con số. Khoá thêm 3 dự báo cho 2027. Chỉ có hộp SCU (Open-Meteo giới hạn lượt).

## 1. Kết quả từng vai (một dòng mỗi vai)

| Vai | Phát hiện cốt lõi | Mức tin |
|---|---|---|
| 01 Hải dương học | Nước trồi NTB do gió quyết định (6–7 % nội tại ven bờ, 18–37 % ngoài khơi); ENSO cho lead 3–9 tháng nhưng chỉ "ăn" khi PDO pha lạnh (Wu 2013); Kuroshio tách xoáy chủ yếu tháng 12–3, trôi tây 5–10 cm/s | gió→trồi: cao · ENSO: cao · Luzon→thềm: ước |
| 02 Sinh thái cá | Qua cổng là khối nước, không phải đàn cá; mực xà có số công bố chl đỉnh T3 → CPUE đỉnh T5; cá nổi nhỏ NTB theo chuỗi ONI → gió mùa → nước trồi; cá đáy/rạn/mực lá/tôm ghẹ không theo dòng | mực xà, cá nổi nhỏ NTB: có nguồn · ngừ vây vàng/mắt to: không tìm được số |
| 03 Phù du | Chưa có bài nào đo độ trễ theo ngày cho nước trồi NTB; chỉ có số sau bão (chl đỉnh 5–6 ngày sau); 5 đặc trưng mồi có công thức (chl tích luỹ gamma, tuổi khối nước, FSLE, front chl Druon, bloom mới/cũ); chl mặt không thấy cực đại dưới mặt 65–85 m | gió/bão→chl: có nguồn Biển Đông · còn lại: chuyển vị |
| 04 Nguồn dữ liệu | Top 10 nguồn sạch giấy phép thương mại: CMEMS (GLORYS, PHY, SEALEVEL, OC L4, MULTIOBS, Argo), NOAA (OISST, CPC ONI/PDO, CFSv2), ERA5 + ECMWF Open Data (CC-BY), C3S hệ châu Âu. **Loại**: Global Fishing Watch (CC BY-NC), BoM MJO (cấm thương mại), IRI, HF radar Đài Loan, mọi nguồn Trung Quốc (chủ quyền) | đã mở link, trừ 4 việc chưa kiểm (04 §5) |
| 05 Khoa học dữ liệu | Kiểm kê: 155 nghìn chuyến 2026, 76,7 nghìn tàu, 289 ngày ảnh; kho `fish-inputs` production chỉ có 1 ngày vì cron refresh-fish chết từ 11/10; đề xuất nhãn v3 theo chuyến (mô hình hỗn hợp, phần dư ε là đích), kiến trúc hai tầng (cổng→thềm trên hindcast 30 năm; thềm→cá trên nhãn ngắn), giao thức đánh giá khoá trước | đọc từ code, có file:dòng |
| 06 Đề xuất | "Dòng Dẫn": 4 tầng Khí hậu → Cổng (6 mặt cắt) → Thềm → Cá; đợt 1 bác bỏ nhanh bằng dữ liệu đang có; điều kiện bác bỏ rõ; dự báo khoá trước hè 2027 | thiết kế đủ để kỹ sư làm, nhưng quá tham (xem 07) |
| 07 Phản biện | Khoa học 2/5 · Thống kê 2/5 · Khả thi 2/5 · Giá trị 2/5 · Tuân thủ 4/5 → **nên làm có sửa, cắt mạnh** | lập luận chỉ ra được chỗ cụ thể |

## 2. Sáu phê bình của phản biện mà lead chấp nhận

1. **Nhãn v3 theo chuyến chỉ đổi đơn vị**, không sinh thông tin vị trí mới: chuyến kéo 8–14 ngày, dấu vết trải nhiều ô; hệ số đúng ở thang chuyến không bảo đảm đúng ở thang ô 0,25° (07 §2a). Và sau khi trừ tháng×vùng, có thể không còn đủ biến thiên để học (07 §2b) — **phải đo trước**.
2. **"Đối chứng dương" mực xà 60 ngày là lệch pha hai đỉnh mùa**, không phải trễ của dị thường; sau khi khử mùa thì không có lý do kỳ vọng nó còn (07 §1). Bỏ.
3. **Thiếu pha trăng.** Câu mực đèn và vây ánh sáng là hai nghề chính của nhóm loài "mạnh nhất"; trăng dự báo hoàn hảo ở mọi tầm; thiếu nó thì ε chứa chu kỳ 29,5 ngày và mọi kiểm trễ nhặt nhầm (07 §6.1). `fish-predict.ts` hiện không có gì về trăng.
4. **Thiếu đối thủ đơn giản ở từng tầm**: nền 2A + gió dự báo ECMWF 10–15 ngày + nước trồi từ gió; W−1 (tuần trước); nền + ONI theo vùng. Nếu các đối thủ này lấy hết skill thì tầng cổng không có lý do tồn tại ở thang ô (07 §6.2).
5. **Tầng cổng học "quán tính của GLORYS"** nếu cả đầu vào lẫn đích đều từ GLORYS (D20, S150 ở Biển Đông có rất ít Argo). Đích phải lấy từ quan sát: OISST, altimetry L4, chl L4 (07 §2f).
6. **Không bán bản đồ ô ở tầm >14 ngày.** Điểm là hạng phân vị trong lưới của ngày nên dị thường quy mô vùng gần như triệt tiêu khi xếp hạng; ở L >10–15 ngày bản đồ hội tụ về nền mùa. Tầm dài phải ra **thẻ triển vọng vụ theo vùng** (3–5 hộp), nhãn "Theo mùa" mặc định (07 §4). Bán bản đồ chi tiết ở tầm đó là hứa độ chính xác nguồn không bảo đảm (CLAUDE.md, KHÔNG ĐƯỢC).

## 3. Bản tối thiểu khả thi — lộ trình đề nghị (~4–5 tuần người, ước của 07)

| Bước | Việc | Cổng dừng/đi | Cần anh Long |
|---|---|---|---|
| **0. Đo rẻ** — **ĐÃ ĐO 2026-10-22** (`08-buoc-0-ket-qua.md`) | Dựng bảng chuyến v3(a) từ `dl-all`; báo (i) % phương sai đặc trưng trung bình dấu vết còn lại sau tháng×vùng, (ii) ICC tàu, (iii) công suất: ρ nhỏ nhất phát hiện được với n chuyến hiện có | ρ phát hiện được > 0,1 ⇒ **dừng phía cá**, dồn sức xin toạ độ mẻ. **Kết quả**: tổng kg 0,06 và cá nục 0,08 qua; mực xà 0,13, ngừ vằn 0,11, cá cơm 0,24 **không qua** ở mức loài | dời `$SDFISH_DATA_DIR` khỏi ổ C (79 % đầy); duyệt Python offline trên PC GPU (bước 0 chạy thuần Node, không cần) |
| **B. Tầm ngắn 1–14 ngày** | Trên chuyến v3(a): nền 2A + {gió/nước trồi ERA5→ECMWF, pha trăng, chl tích luỹ F1, bloom mới/cũ F5}; đích log kg với độ dài chuyến và giờ đánh làm biến kiểm soát; tàu cố định hoặc Mundlak; γ ước trong từng nếp train; đăng ký trước dấu mọi thành phần | so nền 2A, W−1, nền+gió; metric chuyến, bootstrap khối 7 ngày, hai nửa năm; chỉ ship thành phần qua cổng, có câu "vì sao" | sửa cron refresh-fish; kéo DataLake lại hằng tuần |
| **C. Triển vọng nước trồi NTB theo mùa** — **ĐÃ ĐO 2026-10-22** (`09-buoc-C-ket-qua.md`) | ONI (+ chỉ số xâm nhập Luzon từ ADT mùa đông nếu qua kiểm) → cường độ và ngày bắt đầu nước trồi; học trên OISST/chl L4/ERA5 1993→, bỏ-từng-năm-ra; đích từ quan sát, đối thủ persistence + khí hậu + gió | thắng đối thủ với CI loại 0 ở ≥1 hộp. **Kết quả**: qua cho **SST hè** (ONI DJF skill +0,17, ×PDO +0,22, CI loại 0); **trượt** cho tương phản nước trồi, khởi phát, đỉnh. Dự báo khoá hè 2027 chỉ cho SST (+0,92 ± 0,61 °C); câu "nước trồi yếu, lùi tháng 8" **không khoá** vì không có skill | chl chưa lấy được (NOAA nghẽn); chỉ số Ekman chuẩn thay chỉ số gió 3 điểm |
| Hoãn | Đa cổng (Đài Loan, Mindoro, Karimata, hai cửa vịnh, S150, DMI), Lagrange F2/F3, tầng cá ở tầm 30–60 ngày | chỉ khi B qua **và** có ≥2 năm nhãn | xin nhãn 2025, toạ độ mẻ, sản lượng tỉnh nhiều năm |

Giao thức đánh giá đầy đủ (AUCeff trong-nghề, bootstrap khối, đối chứng động ±15 ngày, BH q=0,1, kiểm rò tàu lạ/quen, CPUE theo bậc điểm, cổng lead-time SS_L, cổng "giải thích được") ở 06 §5 và 05 C4; thêm hai kiểm giả của 07 §2i: cổng giả (mặt cắt không nối Biển Đông) và xáo tàu.

## 4. Những gì chắc chắn dùng được ngay, bất kể phương pháp

- **Sản phẩm "triển vọng vụ theo vùng" (bước C)**: cơ sở có nguồn trên số liệu Việt Nam, bà con dùng để chuẩn bị vụ, không cần nhãn cá, không hứa ô nào có cá. Đây là thứ rẻ và kiểm được nhất của cả nghiên cứu.
- **Pha trăng** vào mô hình tầm ngắn: dự báo hoàn hảo, nghề đèn phụ thuộc rõ.
- **Danh sách nguồn + giấy phép** (04): dùng được cho mọi việc sau này; GFW chỉ cho lớp bản đồ miễn phí, không cho dữ liệu huấn luyện của tính năng bán.
- **Mở khung thu dữ liệu** ra 3°S–25°N, 99–125°E ở cron server (~0,4 MB/ngày + mặt cắt ~50 KB/ngày, ngoài git) để 6–12 tháng sau có chuỗi dài; app không thêm request nào lúc mở.

## 5. Việc chặn, cần anh Long chốt (không tự quyết)

1. Có cho dùng **Python/boosting offline** trên PC GPU không (chỉ fit, chưng cất bảng về `model-params`, app không thêm dep)?
2. **Sửa cron refresh-fish** (kho `fish-inputs` production chỉ có 1 ngày từ 11/10) — việc vận hành, chặn cả đợt B.
3. Kênh **kéo DataLake lại** hằng tuần (đường hầm API đã chết), xin **toạ độ mẻ** và **nhãn 2025**, xin **sản lượng tỉnh nhiều năm** — nghiệp vụ, không phải kỹ thuật.
4. Có duyệt sản phẩm **thẻ triển vọng theo vùng** thay cho bản đồ ô ở tầm >14 ngày không (ảnh hưởng gói premium).

9. **Mắt xích gió → mồi ĐÃ ĐO 2026-10-22** (`12-gio-moi.md`, gió CMEMS đủ 4 hộp + chl OC-CCI 1997–2026): **mắt xích mạnh nhất cả nghiên cứu** — gió hè ↔ chl hè r 0,76–0,82 ở SCU/OFU/MKU, chl phản ứng sau 0–16 ngày; NCU đi ngược. Sau El Niño chl hè SCU thấp 4/4, OFU 3/3 (dạng xác suất; hồi quy mức độ không có skill). Mắt xích yếu là **ENSO → gió**, không phải gió → mồi. "Gió mùa vào muộn" của 10 **hạ xuống mức vừa** (ngày vào nhạy với nguồn gió). Hướng đáng làm nhất: **gió dự báo → mồi 1–3 tuần**, rồi kiểm mồi → cá trên nhãn chuyến. Khoá thêm: chl hè 2027 thấp ở SCU và OFU.

10. **Thử dự báo mồi 1–3 tuần ĐÃ ĐO 2026-10-22** (`13-du-bao-moi.md`, gió dự báo thật ECMWF IFS 2024–2026, 51 lần phát): **lần đầu có dự báo tầm 1–3 tuần thắng đối thủ trên dữ liệu chưa thấy.** MKU (thềm Mê Kông – Côn Đảo) thắng quán tính +0,32 / +0,35 / +0,12 ở tầm 8 / 16 / 24 ngày (CI loại 0), gần bằng trần biết trước gió; SCU +0,16 ở tầm 8 ngày; OFU không thêm gì. Mẫu nhỏ (kho dự báo chỉ có từ 2024); vẫn là mồi, chưa phải cá — bước B quyết định.

11. **Bước B (mồi → cá) ĐÃ ĐO 2026-10-22 — KHÔNG QUA** (`14-buoc-B-moi-ca.md`, 18 269 chuyến 2026 trong 4 hộp, chl lấp mây hằng ngày + gió CMEMS nối tới 10/2026): chl và gió 0–16 ngày trước chuyến **không giải thích năng suất chuyến theo cách đúng cơ chế và vững** — kiểm giả (chl/gió 30–38 ngày SAU chuyến) cho tín hiệu ngang hoặc hơn; cá nổi nhỏ còn ngược chiều (chl cao → kg thấp); R² thêm 0,1–0,2 % cho tổng kg. Một giả thuyết duy nhất đáng khoá cho nhãn 2027: gió tây nam → mực SCU (+6 %/sd). **Hệ quả**: dự báo mồi (13) không được gọi là dự báo cá; câu hỏi đáng hỏi nhất ("năm mồi kém thì năm cá kém?") cần **sản lượng nhiều năm** — vẫn là việc chặn số một.

12. **Vòng 2 (team 3 agent + 1 phản biện, 2026-10-23, chạy ở PC GPU)** — thêm ba nhánh logic mà vòng 1 đánh giá "đáng làm nhưng chưa đo". Phản biện độc lập: `18-phan-bien-15-17.md`.
    - **Bước 15 — trăng** (`15-trang.md`, 92 114 chuyến): người đo chấm QUA hẹp cho **lưới chụp** (đêm rằm −13…−18 % kg, lưới kéo đối chứng ≈ 0), câu mực không thấy gì. **Phản biện HẠ MỨC xuống "giả thuyết"**: đường hệ số theo độ lệch pha không có dạng cos, khe cùng độ rọi ngược dấu, Tết rơi đúng trăng non, CI quá hẹp. **Chưa đưa vào `model-params`**; 18 ghi 7 điều kiện tối thiểu. Phát hiện phụ đáng giữ: cá cơm **+21–24 %** đêm rằm trong tàu vây cá nổi nhỏ — ngược với câu chữ hiện có trong `src/lib/moon.ts` ("mực, cá cơm kém ăn đèn" khi trăng sáng).
    - **Bước 16 — "bãi đang ăn"** (`16-bai-dang-an.md`, VMS giờ đánh theo ô 0,25° × tuần): cửa sổ trượt 30 ngày đoán chỗ đội tàu đánh tuần tới tốt hơn tháng-lịch trước (AUC giờ 0,854 so 0,826; 10 % ô chứa ~55 % giờ đánh so ~51 %), nhưng **W−1 không thêm gì** và trong cùng tàu, ô "nóng tuần trước" **không** cho kg/giờ cao hơn (−2,5 % [−6,3; +0,6]) ⇒ **dự báo thói quen đội tàu, không phải dự báo cá**. Production chưa làm được: cần VMS gần thời gian thực (DataLake đứng ở 11/10). Phản biện: GIỮ.
    - **Bước 17 — sản lượng nhiều năm** (`17-san-luong-nhieu-nam.md`): **tìm được** kho PxWeb của Cục Thống kê (`pxweb.nso.gov.vn`, máy đọc được, không tài khoản) — cá biển khai thác theo tỉnh **1995 → 2025** (sửa ghi chú cũ ở 11 mục 6 "nso.gov.vn chỉ có định nghĩa"). Kiểm "năm mồi kém → năm cá kém" **KHÔNG QUA 6/6**; tỉnh xa cho r cỡ tỉnh thật; chuỗi tỉnh quá trơn (30 năm giảm 4 lần) — nhiều khả năng là số ước theo đội tàu. Câu hỏi vẫn mở, cần số **tháng × loài**: sản lượng qua cảng (Phan Thiết, La Gi, Phú Quý, Cà Ná, Hòn Rớ, Cát Lở), chỉ tiêu tháng của Cục Thống kê, eCDT/nhãn 2025, CPUE của Viện Nghiên cứu Hải sản, cá cơm thu mua của hiệp hội nước mắm (17 §6). Phản biện: GIỮ, đã sửa vài số mô tả.
    - **Hệ quả**: sau 17 bước, chưa có tín hiệu nào trong năm (vệ tinh, mồi, gió, trăng, đội tàu) cho thêm skill **dự báo cá** đứng vững trên nền mùa + tàu. Thứ duy nhất có giá trị chắc là **triển vọng môi trường theo mùa** (C, C2, 12, 13). Việc chặn số một vẫn là **nhãn nhiều năm theo tháng × loài**.

13. **Lớp chuỗi thức ăn vào production (2026-10-23, `19-lop-chuoi-thuc-an.md`)** — anh Long chốt: giữ là dự báo cá, chỗ nào khoa học chứng minh tốt hơn thì áp, mọi thông số lưu để tối ưu. `src/lib/fish-chain.ts` + đầu vào ngày (ONI, PDO, ΔADT eo Luzon, phù du/nhiệt theo hộp) lưu mỗi ngày vào kho `drivers/`; mỗi thành phần có cổng `ap`/`quaCong`. Sau khi viết lại phép đo trăng theo cổng chặt của 18 (bỏ Tết, ngoài mẫu T1–5 → T6–10, giả khối tuần, đỉnh ổn định), **chỉ trăng của cá nục được áp** (±13 %, đỉnh ~3,5 ngày trước trăng non); bản fit đầu (áp ba nhóm + ba loài) đã bị rút. Phù du, gió, ENSO, Luzon: thu đầu vào, chưa áp.

## 6. Dữ liệu và script để chạy lại (cất 2026-10-22)

- **Script**: `scripts/dong-dan/` (README ở đó: thứ tự chạy, nguồn chạy/không chạy, cách tải tiếp). Bước C và C2 chạy lại từ bản trong repo ra **giống hệt** số trong 09b/10b; bước 0 chạy lại trên gpu-desktop bằng đường dẫn mặc định.
- **Dữ liệu** (ngoài git, `$SDFISH_DATA_DIR`): `hindcast-ntb/` 277 MB — OISST theo ngày 1982 → 2026-10-20, gió ERA5 lưới 0,5° hộp SCU (20/120 điểm), gió 3 điểm, ONI/Niño/PDO — có ở **cả Mac (`~/sdfish-data`) và PC GPU**. Kết quả bước 0 ở `dong-dan/buoc0/` chỉ trên PC GPU (dữ liệu DataLake không rời máy đó).
- **Còn thiếu**: lưới gió 100/120 điểm (OFU/MKU/NCU) vì hạn mức Open-Meteo; chl lịch sử. Nguồn thay thế: `11-so-nguon.md`.
- **Đã bù (cùng ngày, `12-gio-moi.md`)**: gió CMEMS 1994 → 6/2026 cho đủ 5 hộp (`hindcast-ntb/cmems-gio/`: chỉ số ngày theo hộp 6,5 MB ở cả Mac và PC GPU; lưới ngày từng ô ~730 MB chỉ ở PC GPU) và chl OC-CCI 8 ngày 9/1997 → 6/2026 (`hindcast-ntb/chl-occi/`, 31 MB, cả hai máy).

## 7. Sổ nguồn (thử thật 2026-10-22, `11-so-nguon.md`)

- **Không cần đăng ký tài khoản nào** cho các nhu cầu 1–5: kho Zarr của Copernicus Marine đọc ẩn danh được, kể cả bộ tái phân tích nhiều năm (lead đã tự thử lại).
- **Chl** (chỗ hỏng hôm trước): ESA OC-CCI v6.0 8 ngày/tháng 1997 → 6/2026 qua ERDDAP NOAA Hawaii (`oceanwatch.pifsc.noaa.gov`), ~180 MB cho hộp NTB; bản hằng ngày đã lấp mây 1997 → 14/10/2026 trong kho Copernicus Marine.
- **Gió lưới** (thay Open-Meteo bị chặn 429): CMEMS `WIND_GLO_PHY_L4_MY_012_006` theo giờ 1994 → 6/2026, có sẵn curl gió và curl ứng suất.
- **Mặt cắt cổng, D20, dòng chảy, SSH**: GLORYS12 `GLOBAL_MULTIYEAR_PHY_001_030` 1993 → 22/9/2026 (bẫy: trục độ sâu đảo, ô trống trả 403).
- **DMI, MJO**: file nhỏ từ PSL (trang tĩnh vẫn chạy) và CPC.
- **Điểm nghẽn thật: sản lượng/nhãn cá nhiều năm.** Không có nguồn mở máy đọc được theo tỉnh/loài; FAO FishStat chặn máy, nso.gov.vn chỉ có định nghĩa chỉ tiêu. Cần anh Long xin số liệu tỉnh × tháng (Cục Thống kê, Cục Thủy sản và Kiểm ngư, hoặc SDWork) — đây là việc duy nhất mở được kiểm định liên năm cho tầng cá.

## Assumptions

- Ước thời gian "4–5 tuần người" là của phản biện (07), "3 tuần" của 06 bị cho là lạc quan; chưa ai đo.
- Danh mục vùng cấm trong 02 §5.4 dựa TT 19/2018; phải đối chiếu NĐ 41/2026 trước khi dùng.
- Mọi độ trễ sinh học trong 03 là chuyển vị; dùng để **kiểm**, không để đặt tay.
