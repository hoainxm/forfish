# 17 — Sản lượng nhiều năm theo tỉnh, và kiểm "năm mồi kém → năm cá kém" (2026-10-23)

**Load khi / Load when**: trước khi nói "năm gió mùa yếu / ít mồi thì năm đó ít cá", trước khi dùng số sản lượng thống kê tỉnh làm nhãn cho bất kỳ mô hình nào, hoặc trước khi đi xin số liệu sản lượng (mục §6 là danh sách xin cụ thể). Bảng số gốc: `17b-san-luong-bang-so.md`.

> Chỉ đọc nguồn công khai, không sửa app, nhãn hay mô hình. Dữ liệu tải về `$SDFISH_DATA_DIR/hindcast-ntb/san-luong/` (ngoài git). Script tải `tai-san-luong.mjs`, phân tích `buoc17-san-luong.mjs` (cùng thư mục `scripts/dong-dan/`), chạy ~2 giây trên PC GPU (Windows), không cần khoá RAM. Giả thuyết và luật quyết **đăng ký trước** ở §2, viết trước khi tính tương quan nào.

## 0. Kết luận (đọc nếu chỉ có 1 phút)

1. **Có chuỗi nhiều năm — và lấy được bằng máy.** Cục Thống kê có kho PxWeb `pxweb.nso.gov.vn` (không tài khoản, không CAPTCHA) với bảng **"Sản lượng cá biển khai thác phân theo địa phương"** 1995 → sơ bộ 2025 (**31 năm**, 29 tỉnh ven biển cũ, nghìn tấn), "Sản lượng thủy sản khai thác phân theo địa phương" (31 năm, 63 tỉnh), và **tổng công suất tàu ≥ 90 CV theo tỉnh** 2010 → 2025. Sổ 11 mục 6 nói "nso.gov.vn chỉ có định nghĩa" — sai chỗ: số nằm ở PxWeb. Nhưng chỉ có **năm × tỉnh**, không có tháng, không có loài.
2. **Kiểm liên năm KHÔNG QUA — cả 6/6 phép thử chính.** Sản lượng cá biển (đã khử xu thế) của nhóm Ninh Thuận + Bình Thuận và nhóm sáu tỉnh mặt biển Mê Kông **không đi theo** gió hè, chl hè hay ONI mùa đông trước, ở mức đủ phân biệt với ngẫu nhiên. Mạnh nhất: SCU ~ ONI theo sai phân năm r **−0,42** [CI 90 % −0,63…−0,08], SCU ~ gió hè theo sai phân r **+0,33** [+0,11…+0,52] — đúng chiều, nhưng chỉ ở 1/3 cách khử, khử tuyến tính chỉ còn −0,17 và +0,09, không qua BH. Nhóm Mê Kông: mọi |r| ≤ 0,17.
3. **Lý do tin nhất là CHUỖI THỐNG KÊ quá trơn, không phải biển không có tín hiệu.** Sản lượng nhóm SCU tăng đều ~4,5 %/năm, chỉ **giảm 4 lần trong 30 năm**; ba hè ít mồi nhất sau 1998 (2020, 2010, 2022 — chl hè thấp ngang 1998) sản lượng vẫn **tăng** +1,5 %, +3,8 %, +5,9 %. Duy nhất **1998** (El Niño mạnh, chl hè thấp nhất chuỗi) sản lượng nhóm SCU rơi −18,3 % (riêng Bình Thuận −20 %). Số tỉnh là số báo cáo/ước gộp cả năm, cả đội tàu, mọi loài — loại thước đo gần như không thể thấy một mùa nước trồi kém.
4. **Công suất thống kê**: n = 26–28 năm ⇒ chỉ loại được quan hệ mạnh (r ≳ 0,5). Không qua ở đây **không** chứng minh "mồi không ảnh hưởng cá"; nó nói **số thống kê tỉnh-năm không dùng được để kiểm câu đó**.
5. **Hệ quả**: câu hỏi "năm mồi kém → năm cá kém" vẫn chưa kiểm được, và thêm một kênh bị đóng. Muốn kiểm phải có **sản lượng theo tháng × nhóm loài (cá nổi nhỏ)** đo ở cảng — §6 liệt kê nơi xin, mẫu biểu, ưu tiên.

## 1. Nguồn đã thử (2026-10-23, curl/WebFetch từ PC GPU)

| Nguồn | Kết quả | Dùng được? |
|---|---|---|
| **NSO PxWeb** `https://pxweb.nso.gov.vn/pxweb/vi/` → "Nông, lâm nghiệp và thủy sản" | **Chạy.** Trang chọn biến là form ASP.NET; gửi lại form với "chọn tất cả" + định dạng JSON-stat trả file (4–17 KB) — script `scripts/dong-dan/tai-san-luong.mjs`. API `/api/v1/vi/` chỉ liệt kê 8 kho (công nghiệp, doanh nghiệp, dân số…), **không có** kho nông nghiệp ⇒ phải qua form. Tải: `V06.59` số tàu ≥ 90 CV · `V06.60` tổng công suất (2010→) · `V06.61` tàu theo chiều dài (2021→) · `V06.62`, `V06.64` cả nước 1990→ · `V06.63`, `V06.65` sản lượng (khai thác) theo tỉnh 1995→ · **`V06.66` cá biển khai thác theo tỉnh 1995→2025** · `V07.05` sản phẩm công nghiệp (có **nước mắm cả nước**, triệu lít, 1995→) | **Có** — năm × tỉnh. Số Nhà nước công bố công khai (CLAUDE.md: không cần dè chừng). 2025 là sơ bộ |
| NSO PxWeb, nhánh `PLV06` | Cùng bảng nhưng theo **34 tỉnh mới** (sau sáp nhập 7/2025) | Không dùng — tỉnh cũ chi tiết hơn |
| NSO trang chỉ tiêu "Sản lượng thủy sản khai thác biển … hằng tháng" | Định nghĩa: nguồn = "điều tra thủy sản và chế độ báo cáo thống kê", phân tổ "loại thủy sản chủ yếu và tỉnh", kỳ **hằng tháng**. **Không** có bảng số tháng theo tỉnh công khai | Số tháng × tỉnh **có tồn tại** trong hệ thống — xin được (§6) |
| gso.gov.vn, pxweb.gso.gov.vn | HTTP 000 (tên miền cũ chết) | — |
| Cục thống kê tỉnh (đoán tên miền `thongkebinhthuan.gov.vn`, `cucthongke.khanhhoa.gov.vn`, `ctk.binhdinh.gov.vn`, `thongkekiengiang.gov.vn`) | Không phân giải (sau sáp nhập, thống kê tỉnh thuộc NSO) | Niên giám tỉnh: phải xin (§6) |
| Tìm kiếm báo, tạp chí (cá cơm Bình Thuận/Phú Quốc, niên giám tỉnh PDF, Stolephorus + nước trồi) | Chỉ có số rời một năm, lời kể "thiếu cá cơm", tổng quan hệ sinh thái nước trồi (VJMST) không có chuỗi năm | Không |
| World Bank `ER.FSH.CAPT.MT` (từ FAO) | Chạy (đã ghi ở 11) | Chỉ quốc gia |
| FAO FishStat (`fao.org/fishery/statistics-query`) | Trang 200 nhưng là ứng dụng JS; bản tải CSV bị Cloudflare chặn máy (11) | Chỉ quốc gia × loài; VN báo phần lớn "cá biển khác" — không giúp |
| Sea Around Us (EEZ 704) | Trang 200; số là **tái dựng mô hình** cấp quốc gia, giấy phép chưa đọc | Không dùng làm nhãn |

## 2. Đăng ký trước (viết 2026-10-23, TRƯỚC khi tính bất kỳ tương quan nào)

> Ghi rõ để khỏi tự lừa: lúc viết mục này đã nhìn **mức** sản lượng thô (bảng tỉnh × năm in ra để kiểm tải đúng), **chưa** tính tương quan, chưa khử xu thế, chưa ghép với gió/chl/ONI. Không sửa mục này sau khi chạy; sai lệch nào so với nó sẽ ghi ở §5.

**Dữ liệu đích**: bảng NSO PxWeb `V06.66` "Sản lượng cá biển khai thác phân theo địa phương" (nghìn tấn, năm, 1995 → sơ bộ 2025, tỉnh CŨ trước sáp nhập 7/2025). Phụ: `V06.65` "Sản lượng thủy sản khai thác phân theo địa phương" (tấn, gồm cả tôm, mực, nội địa). Năm 2025 là **sơ bộ** — giữ, nhưng chạy lại bỏ 2025 ở phần độ vững.

**Nhóm tỉnh ↔ hộp** (hộp ở `scripts/dong-dan/hop.mjs`):

| Nhóm | Tỉnh (cộng sản lượng) | Hộp | Biến gió | Chiều kỳ vọng |
|---|---|---|---|---|
| **SCU** (chính) | Ninh Thuận + Bình Thuận | SCU | `SCU_tE` hè 6–9 | gió +, chl +, ONI T12–2 − |
| **MKU** (chính) | Bà Rịa–Vũng Tàu + Tiền Giang + Bến Tre + Trà Vinh + Sóc Trăng + Bạc Liêu (mặt Biển Đông) | MKU | `MKU_tE` hè 6–9 | gió +, chl +, ONI − |
| NCU (thăm dò) | Khánh Hoà + Phú Yên + Bình Định | NCU | `NCU_tN` hè 6–9 | chl + ; gió: không đặt chiều (12: NCU đi ngược) |
| Giả — tỉnh xa | Vịnh Bắc Bộ (Quảng Ninh + Hải Phòng + Thái Bình + Nam Định + Ninh Bình + Thanh Hoá + Nghệ An + Hà Tĩnh) và Kiên Giang (vịnh Thái Lan) | ghép với chỉ số **SCU** | | r ≈ 0 |

**Ba cách khử xu thế** (đội tàu, công suất, cách thống kê đổi theo năm — bắt buộc): (a) phần dư của log sản lượng sau hồi quy tuyến tính theo năm; (b) sai phân năm của log, Δlog = log Cₜ − log Cₜ₋₁ (chỉ số cũng lấy sai phân); (c) log tỉ lệ so trung bình 5 năm TRƯỚC, log(Cₜ / mean(Cₜ₋₅…Cₜ₋₁)) (chỉ số giữ nguyên dị thường). Thêm (d) khử bậc hai — chỉ để xem độ nhạy, không tính vào luật quyết.

**Chỉ số vật lý** (dị thường so khí hậu 1998–2025, như 12): gió hè 6–9 trung bình hộp (CMEMS, `chiso-ngay.json`); chl hè 6–9 log10 trung bình hộp (OC-CCI 8 ngày, cùng hàm với 12); ONI T12–2 đầu năm t (CPC).

**Cửa sổ năm**: chính 1998–2025 (chl có từ 9/1997) cho cả ba chỉ số để cùng n = 28 (cách (c) bắt đầu 2003 vì cần 5 năm trước ⇒ n = 23). Phụ: gió và ONI 1995–2025.

**Trễ**: chính = cùng năm (gió/chl hè năm t ↔ sản lượng năm t; cá nổi nhỏ đời ngắn, vụ nam tháng 4–9 trùng mùa nước trồi). Phụ = sản lượng năm t+1 (đường tuyển quân).

**Sáu phép thử chính** (họ BH q = 0,1): P1 SCU ~ gió SCU (+) · P2 SCU ~ chl SCU (+) · P3 SCU ~ ONI (−) · P4 MKU ~ gió MKU (+) · P5 MKU ~ chl MKU (+) · P6 MKU ~ ONI (−).

**Luật quyết — một phép thử "QUA" khi đủ cả bốn:**
1. đúng chiều kỳ vọng với CI 90 % bootstrap (theo năm, 2 000 lần) loại 0 ở **≥ 2/3** cách khử (a, b, c);
2. bỏ-từng-năm: r nhỏ nhất (về độ lớn) vẫn đúng chiều ở cách (a);
3. kiểm giả thời gian — chỉ số của năm **t+1** ghép sản lượng năm t: |r| nhỏ hơn |r thật| ở cách (a);
4. kiểm giả không gian — tỉnh xa (Vịnh Bắc Bộ, Kiên Giang) với chỉ số SCU: |r| nhỏ hơn |r thật| của P1–P3 ở cách (a).

Và p (hoán vị năm, 5 000 lần, hai phía) qua BH q = 0,1 trong họ sáu phép thử ở cách (a).

**Công suất thống kê nói trước**: n = 28 ⇒ |r| ≥ 0,37 mới có p < 0,05; muốn công suất 80 % thì r thật phải ≈ 0,5. Sau khử xu thế, phần dư còn tự tương quan ⇒ n hiệu dụng nhỏ hơn. Nghĩa là: **không qua ≠ không có quan hệ**; chỉ loại được quan hệ mạnh (r ≳ 0,5) ở thang tỉnh-năm.

**Phụ (không vào luật quyết)**: từng tỉnh riêng lẻ; trễ +1 năm; cửa sổ gió/ONI 1995–2025; bỏ năm sơ bộ 2025; đích V06.65; "CPUE thô" = sản lượng / tổng công suất tàu ≥ 90 CV (`V06.60`, chỉ 2010–2025, n = 16); nước mắm cả nước (`V07.05`) ~ chl SCU (proxy cá cơm, rất thô).

## 3. Kết quả

### 3.1 Sáu phép thử chính (cửa sổ 1998–2025; r [CI 90 %], đầy đủ ở 17b)

| | Nhóm ~ chỉ số (chiều kỳ vọng) | (a) tuyến tính | (b) sai phân năm | (c) so TB 5 năm trước | Bỏ-từng-năm (a) | Giả t+1 (a) | Kết |
|---|---|---|---|---|---|---|---|
| P1 | SCU ~ gió hè SCU (+) | +0,09 [−0,19, +0,40] | **+0,33 [+0,11, +0,52]** | +0,15 [−0,14, +0,43] | +0,01…+0,20 | −0,12 (lớn hơn r thật) | KHÔNG |
| P2 | SCU ~ chl hè SCU (+) | +0,15 [−0,11, +0,41] | +0,28 [−0,02, +0,54] | +0,14 [−0,07, +0,36] | +0,07…+0,26 | +0,01 | KHÔNG |
| P3 | SCU ~ ONI T12–2 (−) | −0,17 [−0,45, +0,10] | **−0,42 [−0,63, −0,08]** | +0,06 [−0,27, +0,42] | −0,25…−0,07 | −0,00 | KHÔNG |
| P4 | MKU ~ gió hè MKU (+) | −0,01 [−0,33, +0,32] | −0,09 | −0,08 | −0,16…+0,08 | −0,14 | KHÔNG |
| P5 | MKU ~ chl hè MKU (+) | +0,11 [−0,30, +0,49] | −0,07 | −0,16 | −0,13…+0,24 | −0,05 | KHÔNG |
| P6 | MKU ~ ONI T12–2 (−) | −0,09 [−0,43, +0,32] | −0,03 | −0,17 | −0,16…+0,08 | +0,16 | KHÔNG |

Không phép nào đạt luật 1 (CI đúng chiều ở ≥ 2/3 cách khử); không p nào qua BH q = 0,1 ở cách (a) (nhỏ nhất 0,38). Khử bậc hai (d) cho kết quả gần (a).

**Kiểm giả không gian** (tỉnh xa ~ chỉ số SCU, cách a): Vịnh Bắc Bộ ~ chl SCU **+0,19**, Kiên Giang ~ chl SCU +0,12 — cỡ ngang P2 thật (+0,15). Ở cách (c), Kiên Giang ~ gió SCU +0,24 và ~ chl SCU +0,25, CI loại 0 — **lớn hơn** SCU thật. Tức là mức tương quan quanh 0,1–0,3 trong bộ số này là nhiễu chung (xu thế đội tàu, kinh tế cả nước), không phải nước trồi.

### 3.2 Năm cực trị (đọc bằng mắt, không thay luật quyết)

| Năm | Vì sao đáng xem | chl hè SCU (dị thường log10) | Sản lượng SCU so năm trước |
|---|---|---|---|
| 1998 | El Niño 1997/98, hè ít mồi nhất | −0,235 | **−18,3 %** (99,4 → 81,2 nghìn tấn; riêng Bình Thuận 73 → 58, −20 %) |
| 2020 | gió hè yếu thứ hai chuỗi | −0,180 | +1,5 % |
| 2010 | sau El Niño 2009/10, gió hè yếu nhất chuỗi | −0,163 | +3,8 % |
| 2022 | hè ít mồi | −0,116 | +5,9 % |
| 2016 | sau El Niño 2015/16 | −0,026 | +8,9 % |
| 2024 | sau El Niño 2023/24 | −0,023 | −2,8 % |

Một trúng (1998), ba trượt rõ. Cả chuỗi 30 năm nhóm SCU chỉ có 4 năm giảm (1998 −18,3 %, 2002 −0,7 %, 2003 −1,3 %, 2024 −2,8 %); độ lệch chuẩn của tăng trưởng năm 6,8 %, gần hết là tốc độ tăng đội tàu. Nhóm Mê Kông giảm 2022–2023 (−4 %, −6 %) trùng thời gian siết khai thác IUU và giá dầu cao — chính sách, không phải biển.

### 3.3 Phụ (không vào luật quyết)

- **Đích "tổng khai thác" (V06.65, gồm mực, tôm)**: SCU ~ chl hè r +0,42 (a), +0,45 (b), p ≈ 0,03; SCU ~ ONI −0,53 (b). Mạnh hơn đích "cá biển". Có thể vì mực theo nước trồi (14 §0.4 cũng thấy gió ↔ mực SCU), có thể chỉ là 1998 (thử nhiều đích ⇒ không tin trước khi kiểm lại). Ghi làm giả thuyết cho dữ liệu tháng × loài.
- **"CPUE thô"** (sản lượng ÷ tổng công suất tàu ≥ 90 CV, 2011–2025, n = 15): không có gì (|r| ≤ 0,2 ở cách a). Mẫu quá ngắn, và tàu ≥ 90 CV không phải đội tàu ven bờ đánh cá cơm.
- **Từng tỉnh**: không tỉnh nào qua luật. Bình Định ~ chl NCU **ngược** (−0,41 / −0,51) — một trong ~60 phép thử, coi là ngẫu nhiên.
- **Trễ +1 năm** (đường tuyển quân): mọi |r| ≤ 0,25.
- **Nước mắm cả nước** (proxy cá cơm) ~ chl SCU, MKU: ≈ 0. Nước mắm là sản phẩm chế biến, cá cơm mua từ nhiều vùng, có cả tồn kho — đúng như dự đoán, vô dụng.

## 4. Cách đo

- **Đích**: `V06.66` cộng theo nhóm tỉnh (§2), log; ba cách khử a/b/c (+ d). Không chia theo đội tàu ở phép chính vì số công suất chỉ có từ 2010.
- **Chỉ số**: như 12 — gió CMEMS chỉ số ngày theo hộp (`SCU_tE`, `MKU_tE`, `NCU_tN`) → cửa sổ 8 ngày → dị thường theo khe → trung bình 6–9 (cần ≥ 85 % mốc); chl OC-CCI 8 ngày → log10 trung bình hộp → dị thường theo khe → trung bình 6–9 (cần ≥ 60 % mốc); ONI T12–2 (CPC). Bảng năm in ở 17b khớp bảng năm của 12.
- **Thống kê**: r Pearson; CI 90 % bootstrap theo năm (2 000 lần, hạt cố định); p hoán vị hai phía (5 000); bỏ-từng-năm; n hiệu dụng theo tự tương quan bậc 1 của hai chuỗi; BH q = 0,1 trên 6 p chính ở cách (a).

## 5. Giới hạn trung thực và chỗ lệch so với đăng ký

- **Lệch đăng ký**: §2 ghi cách (c) "bắt đầu 2003, n = 23" — tính sai; sản lượng có từ 1995 nên (c) chạy được 2000–2025, n = 26. Đã chạy theo dữ liệu, không đổi gì khác. Luật 4 (giả không gian) chỉ áp cho P1–P3 như đã ghi.
- **Số thống kê tỉnh không phải số cân**: nguồn là "điều tra thủy sản và chế độ báo cáo thống kê" (NSO); cách ước cụ thể ở cấp huyện/xã (theo số tàu × năng suất bình quân, hay theo cảng) **chưa kiểm** [GĐ]. Độ trơn của chuỗi (§3.2) gợi ý phần lớn là ước theo đội tàu.
- **Gộp cả năm, cả đội tàu, mọi loài cá**: cá nổi nhỏ (nhóm theo nước trồi) chỉ là một phần; tàu xa bờ của Bình Thuận đánh khắp Biển Đông, ghi sản lượng về tỉnh nhà. Tỉnh ≠ hộp.
- **Sản lượng là bắt, không phải nguồn lợi**: khi cá kém, bà con đi xa hơn, đánh lâu hơn ⇒ sản lượng giữ được. Không phân định được nếu không có nỗ lực (ngày biển, số chuyến).
- **Tỉnh cũ**: bảng theo 63 tỉnh cũ tới 2025; từ 2026 NSO công bố theo 34 tỉnh mới — nối tiếp phải cộng lại (Bình Thuận vào Lâm Đồng, Ninh Thuận vào Khánh Hoà…).
- **Nhiều phép thử**: ~80 hệ số (chính + phụ + từng tỉnh); vài CI loại 0 ở phần phụ là bình thường.

## 6. Đề nghị — việc anh Long / SDVICO nên xin (theo thứ tự đáng giá)

| # | Xin ai | Cái gì (tên bảng / mẫu) | Vì sao |
|---|---|---|---|
| 1 | **Ban quản lý cảng cá** Phan Thiết, La Gi, Phú Quý, Cà Ná (Ninh Thuận), Hòn Rớ (Nha Trang), Cát Lở (Vũng Tàu) — qua Sở NN&MT tỉnh mới | **Sản lượng thủy sản bốc dỡ qua cảng theo tháng**, tách nhóm loài (cá cơm, cá nục, cá trích, bạc má, mực, cá ngừ), càng nhiều năm càng tốt (≥ 2010). Mẫu báo cáo sản lượng qua cảng theo quy định về cảng cá (TT 21/2018/TT-BNNPTNT và văn bản thay thế — cần đối chiếu bản hiện hành) | Số **cân/ghi tại cảng**, theo tháng, theo loài — đúng thứ kiểm được "vụ cá cơm/cá nục kém năm gió yếu". Cảng ở ngay bờ hộp SCU |
| 2 | **Cục Thống kê (NSO), Vụ Thống kê Nông, Lâm nghiệp và Thủy sản** | Chuỗi chỉ tiêu "Sản lượng thủy sản khai thác biển hằng tháng" phân tổ **tỉnh × tháng × loại thủy sản chủ yếu** (cá/tôm/mực/khác), 2010 → nay — chỉ tiêu này có trong hệ thống chỉ tiêu, kỳ hằng tháng, nhưng không có bảng công khai | Cùng nguồn với chuỗi năm đã có ⇒ nối được; tháng cho phép tách vụ nam (4–9) |
| 3 | **Cục Thủy sản và Kiểm ngư** (Bộ NN&MT) | Sản lượng theo **nhật ký khai thác / eCDT** tổng hợp theo tỉnh × tháng × loài, các năm trước 2026 (2024–2025 nếu có); và **nhãn chuyến 2025** (đã nêu ở README §5) | Nhãn cấp chuyến cho năm thứ hai ⇒ kiểm lại bước B và khoá giả thuyết mực SCU |
| 4 | **Viện Nghiên cứu Hải sản (RIMF, Hải Phòng)** | Số liệu **giám sát sản lượng nghề cá thương phẩm** và CPUE theo nghề (vây, mành, lưới rê) vùng Nam Trung Bộ, các đợt điều tra nguồn lợi (2000s, 2011–2015, 2016–2020) | Có **nỗ lực** (CPUE) — tách được "cá kém" khỏi "đánh ít" |
| 5 | **Thống kê tỉnh Lâm Đồng (cũ Bình Thuận), Khánh Hoà (cũ Ninh Thuận)** | **Niên giám thống kê tỉnh** các năm 2000–2024 (bảng sản lượng khai thác phân theo nhóm: cá, tôm, mực…; theo huyện nếu có) — PDF/xlsx | Tách mực khỏi cá (§3.3 gợi mực mạnh hơn) |
| 6 | **Hiệp hội nước mắm Phan Thiết, Phú Quốc**; vài nhà thùng lớn | **Lượng cá cơm thu mua theo tháng** và giá mua, nhiều năm | Proxy cá cơm trực tiếp nhất ngoài cảng; giá cá cơm tháng là proxy thứ hai (giá cao ⇔ khan) |

**Proxy dùng tạm khi chưa xin được**: (a) giá cá cơm / cá nục tại chợ đầu mối theo tháng (cần nguồn có chuỗi dài — chưa tìm); (b) tin báo địa phương "trúng/thất vụ cá cơm" theo năm — có thể mã hoá tay 15–20 năm thành biến nhị phân, nhưng thiên lệch đưa tin (chỉ báo khi lạ) ⇒ chỉ dùng để gợi ý, không để kiểm.

**Không nên làm tiếp với số tỉnh-năm**: thêm biến hay mô hình trên 28 điểm trơn sẽ chỉ khai thác nhiễu (kiểm giả tỉnh xa đã cho r cỡ bằng tỉnh thật). Chuỗi năm vẫn có ích làm **nền xu thế** (đội tàu tăng bao nhiêu mỗi năm) khi có số tháng.

## Assumptions

- Nhóm tỉnh ↔ hộp (§2) là giả định của bước này, dựa vị trí hộp trong `hop.mjs`; tàu xa bờ không đánh trong hộp tỉnh nhà.
- Tên mẫu biểu cảng cá (TT 21/2018) chưa đối chiếu văn bản hiện hành sau NĐ 41/2026 — kiểm trước khi gửi công văn xin.
