# 07 — Phản biện độc lập đề xuất "Dòng Dẫn" (06)

Người phản biện: vai nhà thống kê hải dương–nghề cá, 2026-10-22. Chỉ đọc 01–06 và repo (README fish-train-review-2026-10-18, fish-validate-positions, dl-build-labels.mjs, dl-eval-fleet.mjs). Không tra mạng, không sửa gì.
Ký hiệu: **[CHẮC]** = suy ra thẳng từ văn bản/mã; **[NGHI]** = nghi ngờ có lý do, cần đo.

---

## 1. Tính đúng đắn khoa học — 2/5

Ý khung đúng: "qua cổng là khối nước, không phải đàn cá" (02 §0) và tách vật lý–vật lý khỏi thềm→cá (05 C6). Phần còn lại có nhiều mắt xích yếu được trình bày ngang hàng với mắt xích mạnh.

- **[CHẮC] Mắt xích dài nhất là ước, không phải kiểm chứng.** Bảng §4 của 06 ghi "Xoáy/SSH Luzon → thềm VN 3–8 tháng" với nguồn "01 §2.7 (ƯỚC)". 01 tự nói đây là phép chia quãng đường cho tốc độ trôi. Không có bài nào đo trễ này tới thềm VN. Đề xuất vẫn xây cả tầng C quanh nó.
- **[CHẮC] Bốn trên sáu cổng không có cơ sở độ trễ.** 01 §3: Đài Loan "Thấp", Mindoro "[ƯỚC], chưa có nghiên cứu độ trễ", cửa vịnh Bắc Bộ, vịnh Thái Lan "[ƯỚC]". 01 §7 ghi thẳng: các trễ này là ước. S150/MSW chỉ có "[KC, tóm tắt]". Đưa 6 cổng × 3 biến vào DLNM là mở rộng không gian tìm kiếm, không phải dùng kiến thức.
- **[CHẮC] Kênh Luzon chạm VN chủ yếu qua lưỡi lạnh mùa đông theo gió mùa đông bắc** (02 §3, VJES 2017). Nghĩa là tín hiệu cổng trùng phần lớn với gió, thứ tầng T đã có. Phần cổng "thêm vào" sau khi đã biết gió + ONI có thể rất nhỏ.
- **[CHẮC] "Đối chứng dương" mực xà bị dùng sai.** 06 §6 (1C) lấy "chl trễ ~60 ngày" (02 §2, PLOS ONE 2019) làm đối chứng dương. Con số đó là **lệch pha chu kỳ mùa** (chl đỉnh tháng 3, CPUE đỉnh tháng 5, 2006–2010), không phải tương quan **dị thường** trễ 60 ngày. Sau khi khử mùa đúng như §4 bước 1 đòi, không có lý do kỳ vọng tín hiệu đó còn. Trượt kiểm này không nói gì; qua kiểm này có thể chỉ là mùa vụ sót.
- **[CHẮC] Khâu chl → cá gần như toàn chuyển vị.** 03 §1c–1d: nục (Indonesia), mòi (California), ngừ (Lombok), tất cả là [CV]. 03 §1d còn chỉ ra đỉnh chl tháng 8 **không khớp** vụ ngừ VN. 02 §0: tầng ngày–tuần "chưa có số nào đo ở Biển Đông cho cá".
- **[CHẮC] Trộn hai cơ chế.** 03 §1c tách "tụ đàn (ngày–tuần)" và "tuyển quân (tháng–năm)". Kiến trúc chỉ dùng f_j đồng thời/trễ ngắn ở tầng F, nên trễ dài của cá ngừ 3–4 tháng (tuyển quân/tăng trưởng) không được mô hình nào trong 06 bắt đúng; nó chỉ có mặt trong bảng "kỳ vọng".
- **[NGHI] Chl mặt là đầu vào kém ở đúng nơi cần.** 03 §4: DCM 65–85 m ngoài khơi, OC ước cao chl ở Biển Đông, *Phaeocystis* NTB 6–9, chl giả cửa sông. Đề xuất có cờ, nhưng F1/F4/F5 vẫn là ba đặc trưng đợt 1, và đều là chl mặt.
- **Mắt xích nên bỏ khỏi mô hình hoá**: cổng Đài Loan, Mindoro/Balabac, Karimata, Quỳnh Châu, DMI/IOD (02 §3: IOD là "hệ quả cùng nguồn"), S150. **Nên giữ**: gió → nước trồi SCU/MKU (r 0,64–0,71, KC), ENSO → nước trồi hè NTB (KC trên VN), chỉ số xâm nhập Luzon từ ADT (TB, chỉ mùa đông).

## 2. Thống kê — 2/5

Giao thức đánh giá (§5) cẩn thận hơn mức thường thấy. Lõi thống kê thì có lỗ.

**2a. Nhãn v3 giải N1 tới đâu.** [CHẮC] Nó **đổi đơn vị**, không tạo ra thông tin vị trí mới. ε_i nói "chuyến này khá hơn thường"; chuyến kéo 182–326 giờ (README §7.6, dòng 370), tức 8–14 ngày, dấu vết thường trải nhiều ô 0,5°. Đặc trưng "trung bình theo giờ trên dấu vết" là trung bình làm phẳng mạnh, nên hồi quy là ở **thang chuyến**, rồi §3.5 áp f_j lên ô 0,25° trên bản đồ. Đây là suy diễn chéo thang (ecological inference): hệ số đúng ở thang chuyến không bảo đảm đúng ở thang ô.

**2b. γ_{m×r} ăn mất phần lớn biến thiên đặc trưng.** [NGHI, rất có khả năng] Sau khi trừ tháng × vùng 0,5°, phần biến thiên còn lại của "đặc trưng trung bình dấu vết" chỉ là dao động **trong tháng** ở thang chuyến. Chưa ai đo nó còn bao nhiêu. Nếu còn <10–20 % phương sai, cổng 1B gần như chắc trượt vì thiếu biến thiên nhận diện, không phải vì sinh học sai. Phải đo trước khi làm gì khác.

**2c. α_v ngẫu nhiên.** [CHẮC về giả định] Hiệu ứng ngẫu nhiên giả định α_v độc lập với đặc trưng. Thuyền trưởng giỏi chủ động tìm front/nước trồi, nên α_v tương quan với x. Hệ quả: ước lệch, thường là hút một phần tín hiệu "đi đúng chỗ" vào α_v. Phải dùng hiệu ứng cố định theo tàu hoặc Mundlak (thêm trung bình đặc trưng theo tàu), và so hai cách.

**2d. δ·log H dựa trên H đo sai.** [CHẮC] README §7.6 dòng 379: ρ(giờ trong dải, haulCount) chỉ 0,21–0,45; câu 0,21 "gần mức đường cơ sở 0,15"; dòng 383: ở kéo/khác "hệ số của log(giờ chuyến) ≈ 0,6–1,1 còn của log(giờ trong dải) âm: kg đi theo độ dài chuyến hơn theo giờ đánh". Vậy log(kg/H) có mẫu số nhiễu, gây pha loãng hồi quy và tương quan giả giữa ε và mọi thứ ảnh hưởng tới H (gió, bão rút ngắn giờ đánh). Nên dùng log kg làm đích, độ dài chuyến và H làm biến kiểm soát riêng.

**2e. Cổng 1B tự mâu thuẫn.** [CHẮC] Cổng đòi **cả** ρ(dự báo, ε) > 0 **và** Δ AUCeff ≥ +0,01 so nền 2A. AUCeff ô-ngày vẫn dựng trên nhãn chia đều (N1), mà README §0 dòng 13 viết "Δdyn ≈ 0 gần như được đảm bảo bởi nhãn". Tức vế thứ hai gần như không qua được theo cấu trúc, bất kể mô hình. Hoặc bỏ vế đó khỏi 1B, hoặc thay bằng metric chuyến so với nền 2A gộp theo dấu vết.

**2f. Học "quán tính mô hình" trên GLORYS.** [NGHI] Tầng C dùng GLORYS cho cả đầu vào (Q, S150) lẫn đích (SSHA, D20 thềm). SSH được altimetry khống chế; D20 và S150 ở Biển Đông có rất ít Argo (04 §1: "vài chục profile/tháng"), nên phần lớn là động lực mô hình. Tương quan trễ cổng→D20 có thể là thời gian truyền **trong mô hình**. Sửa: đích chỉ lấy từ quan sát (OISST, altimetry L4, chl L4), GLORYS chỉ làm đầu vào. Thêm nữa, tái phân tích có dữ liệu trễ (Argo delayed-mode, altimetry reprocessed) mà hệ vận hành PHY_001_024 không có, nên skill hindcast là cận trên. "Hiệu chỉnh nối chuỗi bằng trừ chênh trung bình" (06 §3.1) chỉ sửa trung bình, không sửa phương sai và độ trễ.

**2g. n thật.** [CHẮC]
- Tầng C: GLORYS 1993–2025 ≈ 33 năm. Với tín hiệu mùa (tách xoáy 12–3) và trễ 3–8 tháng, n độc lập ≈ 33 sự kiện mỗi cổng. LOYO trên 33 điểm cho CI rộng; sau BH trên 6 cổng × 3 biến × nhiều hộp × 4 trễ (≥ vài trăm phép thử) thì công suất thấp. Kết quả "≥1 cặp cổng–hộp qua" (cổng 1A) gần như chắc có **một** cặp qua vì may, nếu BH không áp đúng số phép thử thật.
- Tương tác ENSO×PDO: PDO chủ yếu âm từ ~1999. Hệ số tương tác bị lẫn với thời kỳ. El Niño ≥ +2 trong GLORYS: 1997, 2015, 2023 → n = 3 (06 §7 đã thừa nhận).
- Tầng F: 1 năm, mùa đông bắc chỉ có tháng 1–3 (lưới sản lượng 2026-01→10; 11–12 "catchSameMonth = false"). Cổng "cả hai mùa gió" chỉ có một nửa mùa đông bắc. L = 60 còn ~8 tháng thử, bootstrap khối 7 ngày cho ~35 khối.

**2h. Rò còn sót.** [CHẮC/NGHI]
- [CHẮC] Khí hậu chl c̄(doy) phải tính từ năm train, nhưng chl L4 NRT 2026 và bản reprocessed nhiều năm là hai sản phẩm khác nhau; lệch hệ thống giữa hai bản sẽ thành "dị thường" giả cho cả 2026.
- [CHẮC] γ_{m×r} ước trên toàn 10 tháng gồm cả tháng thử thì ε của tháng thử đã bị khử bằng thông tin chính tháng đó. Phải ước γ trong từng nếp train.
- [NGHI] f_j "khoá dấu theo cơ chế" nhưng dấu được chọn sau khi đọc y văn lẫn đã thấy kết quả 2B/2D. Phải ghi dấu vào file đăng ký trước, như §4 bước 4 làm cho trễ.
- [NGHI] "SS_L phải giảm đơn điệu, tăng lại = rò" không đúng tuyệt đối: chính bảng §4 có trễ vật lý 6–8 tháng, nên đường SS_L có thể có bướu thật. Dùng như cờ soát, không làm luật bác bỏ.

**2i. Kiểm giả thiếu hai phép.** (1) **Cổng giả**: một mặt cắt ngoài biển không nối Biển Đông, cùng tự tương quan, phải không thắng. (2) **Xáo tàu**: hoán vị α_v/nhãn giữa các tàu cùng nghề × tháng. Ba kiểm của 03 §5.5 là cần, nhưng chưa đủ.

## 3. Khả thi — 2/5

- [CHẮC] **Đầu vào đứng.** DataLake: "đường hầm API đã chết", snapshot dừng 11/10 (05 A1). Cron refresh-fish chết từ 11/10, kho fish-inputs có 1 ngày (05 A2). Cổng đợt 2 đòi "chuỗi tiến có ≥1 tháng mới chưa từng thấy": không có nhãn mới thì không thể chấm.
- [CHẮC] **Q1 toạ độ mẻ** đã treo từ trước 18/10 (README Q1 "đang chờ"). **Q2 nhãn 2025**, **sản lượng tỉnh** (1D) chưa có kênh xin. Tôi ước xác suất có đủ cả ba trong 3 tháng là thấp; xác suất có ít nhất Q3 (kéo DataLake lại) là trung bình.
- [NGHI] **"0,5 GB" hợp lý, "3 tuần người" thì không.** Mặt cắt 6 cổng ~300 điểm × 50 tầng × 3 biến × 4 B × 11 700 ngày ≈ 2 GB thô, nén còn cỡ GB. Tải được. Nhưng đợt 1 gồm: dựng lại nhãn với băm tàu ổn định (hiện `vh` chỉ 10 xô), bảng chuyến × dấu vết, REML trên ~150 nghìn chuyến với hàng nghìn mức γ bằng JS thuần, DLNM (chưa có thư viện; Python chưa được duyệt, 05 tóm tắt mục 2), bộ đánh giá chuyến chưa tồn tại, ERA5 qua hàng đợi CDS. Ước thực tế của tôi: 6–8 tuần người cho 1A + 1B.
- [CHẮC] Ổ C PC GPU 79 % đầy (05 A1), mà dl-build-labels đã cần 9 GB RAM mỗi khúc (README dòng 265). Dời dữ liệu là việc **trước** đợt 1, không phải đợt 2.

## 4. Giá trị cho ngư dân — 2/5

- [CHẮC] **Điểm là hạng phân vị trong lưới của ngày** (06 §3.5). Tầng K và C cho dị thường **quy mô hộp/vùng**. Một dị thường đều trên cả vùng gần như **triệt tiêu khi xếp hạng**. Thông tin dài hạn chỉ sống sót ở chỗ nó **phân biệt vùng với vùng** (NTB vs Bắc Bộ vs Tây Nam Bộ). Như vậy sản phẩm 30–60 ngày thật ra là "triển vọng vụ theo vùng", vài hộp, không phải bản đồ ô 0,25°.
- [CHẮC] Ở L > 10–15 ngày, tầng T "giảm dần về khí hậu theo L" (06 §2), nên f_j(x) → f_j(khí hậu) và bản đồ hội tụ về **nền 2A**. Bán bản đồ 7–60 ngày (06 §8: "tầm 7–60 ngày nằm trọn trong vùng bán") khi chi tiết ô thực chất là nền mùa là rủi ro **hứa độ chính xác nguồn không bảo đảm** (CLAUDE.md, mục KHÔNG ĐƯỢC). Nhãn "Theo mùa" giảm rủi ro này, nhưng chỉ khi UI thật sự không vẽ khác đi.
- Lợi ích biên: nền 0,81 thắng mọi thứ đã thử; 2D: 0/30 tổ hợp vệ tinh thắng nền. Cổng 1B chỉ đòi +0,01. Ba tuần đến ba tháng công cho kỳ vọng +0,01 AUC ở L = 0 là chi phí lớn nếu không làm bước đo rẻ trước (xem §7).

## 5. Tuân thủ luật repo — 4/5

Đạt: mô hình cộng tính, khoá dấu, có câu "vì sao" chỉ cho thành phần đã qua cổng (05 C3, 2E); không thêm dep ML vào app; dữ liệu thô ngoài git, tham số qua `model-params.v1.json` (SDF2) có cổng test; cron server, app không thêm request; loại GFW, BoM RMM, IRI, nguồn TQ đúng luật "non-commercial chặn ở phần bán"; chủ quyền chỉ lấy lưới số.
Trừ điểm:
- Python/DLNM offline **chưa được duyệt** mà kế hoạch đợt 1 phụ thuộc vào nó (06 §8 tự ghi "chờ anh Long chốt").
- C3S "Additional licence to use non European contributions" chưa đọc (04 §5 mục 1). Đề xuất đã hạn chế "chỉ hệ châu Âu", ổn.
- "Không chỉ điểm nóng vào vùng cấm" dựa trên TT 19/2018; 02 §5.4 ghi chưa đối chiếu NĐ 41/2026. Phải dùng văn bản hiện hành.
- Offline: nhãn độ tin và dự báo dài hạn lưu kèm bản cũ là đúng; nhưng cần nói rõ khi bản lưu cũ hơn L ngày thì nhãn độ tin phải hạ, không giữ "Cao".

## 6. Thiếu sót

1. **Pha trăng.** [CHẮC là thiếu; `fish-predict.ts` không có gì về trăng.] Câu mực xà dùng đèn và vây ánh sáng là hai nghề chính của nhóm "mạnh nhất" trong 06 (mực xà, cá nổi nhỏ). CPUE của nghề dùng đèn theo chu kỳ trăng là hiện tượng ngành ai cũng biết, và trăng **dự báo được hoàn hảo ở mọi tầm**. Nếu thiếu biến này, ε sẽ chứa chu kỳ 29,5 ngày và các kiểm trễ sẽ nhặt nhầm nó.
2. **Đối thủ "đơn giản" chưa có.** Phải so ở từng L với: (a) nền 2A + gió dự báo ECMWF 10–15 ngày + nước trồi từ gió; (b) **W−1**: CPUE/mật độ đội tàu tuần trước (M−1 đã 0,813, W−1 có thể mạnh hơn ở L = 7); (c) nền 2A + ONI theo vùng. Nếu (a)+(b) đã lấy hết skill thì tầng C/K không có lý do tồn tại ở thang ô.
3. **Cường lực và lựa chọn chỗ đánh.** Ngư dân đánh ở nơi họ tin có cá (lấy mẫu ưu tiên). Đặc trưng trung bình dấu vết là đặc trưng **nơi đã chọn**, không phải nơi ngẫu nhiên. ε có điều kiện trên lựa chọn, nên quan hệ f_j có thể thấp hơn thật (đã chọn chỗ tốt rồi) hoặc lệch dấu. Cần mô hình hai bước: chọn chỗ (dùng giờ đội tàu) rồi sản lượng có điều kiện.
4. **Giá cá và nhắm loài.** Hurdle P(có loài trong chuyến) chủ yếu đo **chủ đích nhắm loài**, mà chủ đích theo giá và đơn hàng thu mua. Không có giá trong mô hình, nên tín hiệu môi trường lẫn với kinh tế. Ít nhất phải thêm hiệu ứng tháng × nghề × loài và kiểm độ nhạy.
5. **Thời tiết cắt chuyến.** Bão, gió mùa mạnh làm ngắn chuyến và giảm giờ đánh; cũng chính gió đó là đầu vào nước trồi. Một tương quan gió–ε có thể chỉ là "gió to, chuyến ngắn, log(kg/H) đổi". Phải kiểm riêng.
6. **Tàu < 15 m.** 49,6 % nhật ký, 9,3 % kg, không có VMS (05 A1). Bà con dùng app phần lớn là tàu nhỏ ven bờ [NGHI, chưa có số người dùng theo cỡ tàu]. Mọi kết quả chỉ đúng cho tàu ≥15 m; ghi "suy rộng, chưa kiểm" là chưa đủ nếu sản phẩm bán cho đúng nhóm không có trong nhãn.
7. **Tầm 3 ngày đã là premium** (`tier.ts`) nhưng đề xuất không đo skill ở L = 1–3, nơi có quyết định thật (đi hay không, đi đâu) và gió dự báo tốt nhất.

## 7. Kết luận: NÊN LÀM CÓ SỬA — cắt mạnh, bản gốc quá tham

Bản gốc có giao thức đánh giá tốt và trung thực về rủi ro (06 §7), nhưng đặt 4 tầng, 6 cổng, 5 đặc trưng mồi lên một tầng F chưa từng thắng nền, với 1 năm nhãn, đầu vào đang chết. Đúng như 05 C6.2 tự nói: "C1 vẫn là nút cổ chai". Thứ tự phải là **đo xem có biến thiên để học không** trước khi xây gì.

### Sửa đổi theo thứ tự tác động
1. **Bước 0 (đo rẻ, 1 tuần):** dựng bảng chuyến v3(a), rồi báo (i) % phương sai đặc trưng trung bình dấu vết còn lại sau γ_{m×r}; (ii) ICC tàu; (iii) phân tích công suất: với n chuyến và phương sai còn lại, ρ nhỏ nhất phát hiện được là bao nhiêu. Nếu ρ phát hiện được > 0,1 thì dừng phía cá.
2. **Bỏ vế "Δ AUCeff ≥ +0,01" khỏi cổng 1B** (bị N1 chặn theo cấu trúc), thay bằng metric chuyến so với nền 2A gộp theo dấu vết.
3. **Thêm pha trăng, W−1, gió dự báo làm đối thủ/đầu vào bắt buộc**, đo ở L ∈ {1, 3, 7, 14}.
4. **Đích:** log kg với độ dài chuyến và log H làm biến kiểm soát; α_v cố định hoặc Mundlak; γ ước trong nếp train.
5. **Cắt tầng C còn đúng một cổng (Luzon, ADT, mùa đông)**, đích chỉ từ quan sát (OISST, altimetry, chl L4), đối thủ persistence + khí hậu + ONI + **gió**. Bỏ Đài Loan, Mindoro, Karimata, hai cửa vịnh, S150, DMI.
6. **Không bán bản đồ ô ở L > 14.** Tầm dài ra thành **thẻ triển vọng vụ theo vùng** (3–5 hộp), nhãn "Theo mùa" mặc định.
7. **Bỏ "đối chứng dương" mực xà 60 ngày** hoặc chỉ dùng sau khi chứng minh trên dị thường hindcast chl × CPUE (không có), vì đó là lệch pha mùa.
8. **Đăng ký trước dấu của mọi f_j** và tổng số phép thử, trước khi chạm dữ liệu 2026.
9. **Việc chặn đưa lên trước:** sửa cron, kéo DataLake lại, dời dữ liệu khỏi ổ C, xin duyệt Python offline. Không có những việc này thì đợt 2 không chấm được.
10. **Ghi dự báo khoá trước hè 2027** (nước trồi NTB yếu, lùi sang tháng 8) ngay hôm nay. Đây là phần rẻ và kiểm được nhất của cả đề xuất.

### Bản tối thiểu khả thi (~4–5 tuần người)
- **A. Bước 0** như sửa đổi 1. Cổng dừng/đi.
- **B. Tầm ngắn L = 1–14** trên chuyến v3(a): nền 2A + {gió/nước trồi ERA5→ECMWF, pha trăng, F1, F5} so với nền 2A, W−1, nền+gió. Chấm theo metric chuyến, bootstrap khối, hai nửa năm. Chỉ ship thành phần qua cổng, có câu "vì sao".
- **C. Triển vọng nước trồi NTB theo mùa**, thuần vật lý: ONI (+ chỉ số Luzon mùa đông nếu qua kiểm) → cường độ/ngày bắt đầu nước trồi, học trên OISST/chl/ERA5 1993→, LOYO. Không cần nhãn cá. Ra app dưới dạng một câu theo vùng, ví dụ "hè năm nay nước trồi có thể yếu và muộn hơn mọi năm", có mức tin và năm tham chiếu. Đây là thứ có cơ sở KC trên VN (02 §2, r² 0,65) và bà con dùng được để chuẩn bị vụ.
- Tầng C đầy đủ, F2/F3 Lagrange, đa cổng: hoãn tới khi B qua **và** có ≥2 năm nhãn.
