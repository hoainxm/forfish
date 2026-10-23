# 16 — Bước 16 "Bãi đang ăn": đội tàu tuần trước có dự báo được chỗ đánh tuần tới không?

**Load khi / Load when**: trước khi đưa "chỗ đội tàu đang đánh" vào dự báo cá, trước khi bàn kênh VMS gần thời gian thực, hoặc khi ai đó nói "cứ theo tàu tuần trước là ra cá". Bảng số gốc: `16b-bai-dang-an-bang-so.md`.

> Chỉ đọc dữ liệu, không sửa nhãn, mô hình hay app. Chạy ở PC GPU (nhãn DataLake không rời máy đó). Script `scripts/dong-dan/buoc16-bai-dang-an.mjs`; bảng chuyến dùng chung `bang-chuyen.mjs` (chỉ thêm hai trường `dep`, `arr` vào dòng chuyến — bước 0, B không đọc hai trường này). Kết quả thô ở `$SDFISH_DATA_DIR/dong-dan/buoc16/` (không có mã tàu trong doc này).

## 0. Kết luận (đọc nếu chỉ có 1 phút)

> **Phản biện độc lập (`18-phan-bien-15-17.md`): GIỮ kết luận "thói quen, không phải cá", kèm ba chỉnh:** (i) trên chuyến mới, cổng chính trượt ngưỡng +0,01 (chênh +0,004…+0,017); (ii) đích kg của W−1 trượt theo luật đăng ký — bản đầu chưa ghi; (iii) theo kg, D2 − B2 = +0,019…+0,030 AUCeff, tức phần làm mượt lân cận có đóng góp mà so sánh giờ đánh che mất. Số đã sửa theo kết quả thô: cận trên CI D2 0,862; β log −8,9 % và −18,4 %.

**Cổng đăng ký trước: QUA về mặt hình thức. Ý "bãi đang ăn tuần trước": KHÔNG QUA. Thứ đo được là dự báo THÓI QUEN đội tàu, không phải dự báo cá.**

1. **Cổng chính qua**: đối thủ D2 (giờ đánh 28 ngày gần nhất, giảm dần theo tuổi, làm mượt lân cận) đoán chỗ đội tàu đánh tuần tới tốt hơn tháng-lịch trước (B1): AUC giờ 0,854 so 0,826, chênh +0,020…+0,035 (CI 90 %); dương ở cả hai nửa năm; giờ của tàu lạ cũng thắng (+0,029…+0,048).
2. **Nhưng phần thắng không đến từ "tuần trước".** Đối thủ đơn giản hơn, **30 ngày gần nhất (B2)**, ngang D2 ở mọi tầm (chênh D2 − B2: −0,003…+0,002 ở tuần tới). W−1 trần (C1) **thua** 30 ngày gần nhất (−0,017…−0,007) và thua cả tháng-lịch trước khi chỉ tính **chuyến mới** đi sau ngày phát (−0,029…−0,005). Cái thắng thật là "cửa sổ trượt 30 ngày thay cho tháng-lịch" — dữ liệu tươi hơn ~2 tuần — chứ không phải tín hiệu tuần.
3. **Con số nói với bà con** (tuần tới, mọi nghề): 10 % ô được chọn chứa **~55 %** giờ đánh tuần tới với 30 ngày gần nhất hoặc D2, so **~51 %** với tháng-lịch trước và 10 % nếu chọn bừa. Với chuyến mới: 59 % so 56 %.
4. **Cá hay thói quen → thói quen.** (i) Tàu lạ (chưa từng đánh ô đó) đến ô do đội tàu gần đây chỉ hơn hẳn chọn bừa (AUC 0,81) — nhưng đó là thông tin "tàu khác đang ở đâu", không chứng minh có cá. (ii) Trong cùng một tàu, chuyến nào đánh nhiều giờ hơn trong "ô nóng tuần trước của tàu khác" thì kg/giờ **không cao hơn** (−2,5 % [−6,3 %, +0,6 %] khi đã tính nền tĩnh; −8,9 % [−13 %, −6 %] nếu đứng riêng); ô nóng nền tĩnh còn thấp hơn (−18,4 %). Chỗ đông tàu không phải chỗ năng suất cao hơn.
5. **Đích kg (AUCeff trong-nghề, nối với 0,809/0,813)**: D2 thắng tháng-lịch trước +0,020…+0,037 nhưng chỉ ngang nền tĩnh cộng dồn (D2 − A1: +0,001…+0,015 cả kỳ; −0,011…0,000 ở nửa 6–9). Giá trị tuyệt đối ở đây (0,65–0,69) **không so thẳng được** với 0,809/0,813 (khác cửa sổ đo, khác lưới nhãn, không làm mượt tháng kề) — chỉ đọc chênh trong cùng bảng.
6. **Khả thi ở production: hiện KHÔNG.** Kịch bản `vms` cần nguồn VMS gần thời gian thực; hiện app chỉ có lưới đội tàu dựng từ snapshot DataLake kéo tay (đường hầm chết, dữ liệu đứng ở 11/10 — `ops/fish-train-review-2026-10-18/report-pipeline-ops.md`). Ở kịch bản thực tế hơn `ve` (chỉ biết chuyến đã về + 3 ngày), D2 ngang tháng-lịch trước trên mọi giờ (−0,003…+0,008) và W−1 trần sụp còn 0,69 (tuần trước phần lớn chưa về bến).

## ĐĂNG KÝ TRƯỚC (ghi 2026-10-23, trước khi chạy phân tích)

Phần này viết trước khi có bất kỳ con số nào; các mục sau không được sửa nó.

**Dữ liệu.** Bảng chuyến v3(a) (`bang-chuyen.mjs`, như bước 0/B). Mỗi đoạn giờ đánh VMS gộp về (chuyến, ngày giờ VN, ô 0,25°) → số giờ đánh. Kg của chuyến chia đều theo giờ đánh (giống `dl-build-labels`) — chỉ dùng cho đích phụ.

**Ngày phát và tầm.** Ngày phát T mỗi 7 ngày từ 2/2/2026; đích là giờ đánh của nhóm nghề g trong ba cửa sổ: L1 = [T+1, T+7], L2 = [T+8, T+14], L3 = [T+15, T+21]. Bỏ đích sau 20/9/2026 (chuyến chưa về tới 11/10 thì chưa có nhật ký → giờ đánh cuối kỳ bị thiếu).

**Kịch bản dữ liệu (kiểm rò).** Dự báo phát ngày T chỉ dùng dòng có ngày ≤ T và:
- `vms`: biết vị trí ngay (VMS gần thời gian thực) — mọi đoạn đánh có ngày ≤ T;
- `ve`: chỉ biết sau khi chuyến về và nhật ký lên server: ngày về + độ trễ nhật ký ≤ T (độ trễ = trung vị đo được từ `submittedAt` − ngày về; nếu trường đó vô nghĩa thì dùng 3 ngày và ghi rõ).
Kg (đích phụ) chỉ có ở kịch bản `ve`.

**Đối thủ** (điểm ô cho nhóm nghề g; với đích kg thì cùng công thức trên kg loài s):
| Mã | Đối thủ |
|---|---|
| R0 | ngẫu nhiên (kiểm tự thân, phải ≈ 0,5) |
| A1 | **nền tĩnh**: cộng dồn mọi giờ đánh từ đầu dữ liệu tới T |
| A1x | nền tĩnh CẢ NĂM, kể cả tương lai (rò có chủ ý — chỉ để tham khảo trần) |
| B1 | **tháng-lịch trước** (tháng trước tháng của T — giống baseline 0,813) |
| B2 | 30 ngày gần nhất [T−29, T] |
| C1 | **W−1** [T−6, T] |
| C2 | W−2 [T−13, T−7] |
| C3 | trung bình tuần 2–4 [T−27, T−7] |
| D1 | W−1 làm mượt lân cận (ô + 0,5 × 8 ô kề) |
| D2 | giảm dần theo tuổi (nửa đời 7 ngày, 28 ngày) + làm mượt lân cận |
| E1 | ghép: 0,5 × tỉ phần D2 + 0,5 × tỉ phần A1 |

**Metric.**
1. **Đích chính — AUC giờ**: P(điểm ô của 1 giờ đánh nghề g trong cửa sổ đích > điểm của 1 ô ngẫu nhiên trong "vũ trụ" nghề g), hoà tính ½. Vũ trụ nghề g = các ô 0,25° nghề g có đánh ít nhất 1 giờ trong cả dữ liệu 2026 (như nhau cho mọi đối thủ). Điểm đổi sang hạng phân vị 0..100 như `dl-eval-honest.pctRank`. Gộp nghề: trung bình có trọng số theo giờ đích.
2. **Top 10 %**: phần giờ đánh tuần đích rơi vào 10 % ô vũ trụ có điểm cao nhất (ô hoà ở ngưỡng chia phần).
3. **Đích phụ — AUCeff trong-nghề** (đúng định nghĩa `dl-eval.mjs`/`dl-eval-honest.mjs`): loài s, nghề g ∈ nghề bắt ≥ 10 % kg loài: pos = kg loài s nghề g ở ô, neg = giờ nghề g ở ô; Σ_g w_g·AUC, w_g = kg; TB theo kg các loài chiếm ≥ 1 % kg (tối đa 15 loài). Điểm = kg loài s (mọi nghề) theo cùng các cửa sổ. Kịch bản `ve`.
4. **CI 90 %**: bootstrap khối = ngày phát (một tuần), B = 1000, cho từng số và cho CHÊNH CẶP với A1 và B1. Tách nửa năm: ngày phát 2–5 / 6–9.

**Kiểm "thói quen" (4).** (i) tàu lạ: lặp metric 1–2 chỉ trên giờ đích của cặp (tàu, ô) mà tàu đó CHƯA từng đánh trước T. (ii) Theo chuyến: log(kg/giờ đánh) theo phần giờ của chuyến nằm trong "ô nóng W−1 do tàu KHÁC tạo ra" (top 10 % W−1 của nghề, [ngày đi −7, ngày đi −1], trừ phần của chính tàu) và phần giờ trong "ô nóng nền tĩnh"; hiệu ứng cố định tàu, nghề × tuần đi; kiểm soát log giờ đánh; CI bootstrap cụm tuần.

**Cổng QUA (một phép thử chính, chọn trước):** D2 thắng B1 trên AUC giờ, L1, kịch bản `vms`, với cận dưới CI 90 % của chênh cặp > +0,01, VÀ điểm ước dương ở cả hai nửa năm, VÀ trên giờ của tàu lạ chênh vẫn dương (cận dưới CI > 0). Mọi so sánh khác là phụ, đọc như mô tả. Đích kg: "qua" chỉ khi đối thủ kiểu W−1 thắng B1 trên AUCeff trong-nghề (cận dưới CI > 0) — đây là chỗ nối với con số 0,809/0,813.

**Câu trả lời "cá hay thói quen" sẽ đọc thế này:** W−1 thắng mạnh ở giờ đánh nhưng (i) gần bằng nền ở tàu lạ VÀ (ii) ô nóng W−1 không cho kg/giờ cao hơn ⇒ **thói quen/đi theo nhau**. Thắng ở tàu lạ và kg/giờ cao hơn ⇒ có thông tin về cá (vẫn không loại được "đi theo nhau" vì tàu lạ có thể theo bạn tàu).

**Thêm SAU đăng ký (ghi thật):** (a) tập con **chuyến mới** — chỉ giờ của chuyến đi SAU ngày phát — thêm sau lần chạy thử trên 20 000 nhật ký, trước khi có số đầy đủ: giờ đích tuần tới chứa cả chuyến đang ở biển lúc phát, W−1 "đoán trúng" chỉ vì cùng một chuyến đánh tiếp tại chỗ; (b) chênh cặp so **B2** — thêm SAU khi thấy số đầy đủ (D2 ≈ B2). Hai mục này không đổi cổng chính, nhưng đổi cách đọc nó (§0.2).

## 1. Cách đo (đã làm)

- **Dữ liệu**: 102 100 chuyến 2026 (tới 11/10) qua lọc của bảng chuyến v3(a); 2,2 triệu dòng chuyến × ngày × ô 0,25°; 1 876 ô. Giờ đánh chỉ từ chuyến CÓ nhật ký kg > 0 và có VMS (tàu ≥ 15 m) — không phải toàn bộ VMS.
- **Ngày phát**: 30 lần (2/2 → 24/8/2026), mỗi 7 ngày; nửa 2–5: 17 lần, nửa 6–9: 13 lần.
- **Độ trễ nhật ký**: trường `submittedAt` đứng TRƯỚC ngày về VMS ở 97 % nhật ký điện tử (trung vị −4,6 ngày), nên nó không phải "lúc lên server" — có lẽ là lúc khai/kê. Không đo được độ trễ thật từ dữ liệu này; kịch bản `ve` dùng 3 ngày như đã đăng ký.
- Còn lại như khối đăng ký trước. Bảng đầy đủ: 16b.

## 2. Kết quả chính — đích chính: chỗ đội tàu đánh (kịch bản `vms`, cả kỳ)

AUC giờ [CI 90 %]; chênh là CI 90 % của chênh cặp. "Mới" = chỉ chuyến đi sau ngày phát.

| Đối thủ | Tuần tới (1–7 ngày) | 8–14 ngày | 15–21 ngày | Tuần tới, chuyến mới | Top 10 % tuần tới (mọi · mới) |
|---|---|---|---|---|---|
| R0 ngẫu nhiên | 0,499 | — | — | 0,497 | 10 % · 10 % |
| A1 nền tĩnh cộng dồn | 0,830 [0,822, 0,839] | 0,818 | 0,810 | 0,851 | 52 % · 56 % |
| B1 tháng-lịch trước | 0,826 [0,813, 0,838] | 0,815 | 0,801 | 0,851 | 51 % · 56 % |
| B2 30 ngày gần nhất | 0,854 | 0,837 | 0,829 | 0,865 | 56 % · 59 % |
| C1 W−1 | 0,843 | 0,808 | 0,802 | 0,834 | 54 % · 53 % |
| C2 W−2 | 0,808 | 0,802 | 0,807 | 0,834 | 49 % · 54 % |
| C3 TB tuần 2–4 | 0,835 | 0,829 | 0,819 | 0,859 | 53 % · 58 % |
| D1 W−1 mượt | 0,847 | 0,816 | 0,812 | 0,840 | 53 % · 53 % |
| **D2 giảm dần + mượt** | **0,854 [0,844, 0,862]** | 0,834 | 0,829 | 0,861 | 55 % · 57 % |
| E1 D2 ghép nền tĩnh | 0,852 | 0,835 | 0,829 | 0,864 | 55 % · 58 % |
| A1x nền cả năm (rò, trần) | 0,853 | 0,854 | 0,854 | 0,884 | 56 % · 63 % |

**Chênh cặp quan trọng (tuần tới, `vms`):**

| So sánh | Mọi giờ | Tàu lạ | Chuyến mới |
|---|---|---|---|
| D2 − B1 (cổng chính) | **+0,020…+0,035** | +0,029…+0,048 | +0,004…+0,017 |
| D2 − B2 | −0,003…+0,002 | +0,007…+0,015 | −0,009…−0,001 |
| C1 − B2 | −0,017…−0,007 | −0,024…−0,008 | −0,041…−0,023 |
| E1 − B2 | −0,004…0,000 | −0,002…+0,004 | −0,004…+0,002 |

**Hai nửa năm** (D2 − B1, tuần tới): nửa 2–5 +0,028…+0,047; nửa 6–9 +0,009…+0,020. Tháng-lịch trước yếu nhất ở mùa đổi gió (2–5), đúng chỗ dữ liệu cũ 2–6 tuần lạc hậu nhất. D2 − B2 ≈ 0 ở cả hai nửa.

**Tầm xa**: lợi thế so tháng-lịch trước giữ nguyên ở 8–21 ngày (+0,011…+0,037) — dấu hiệu nó là "tươi hơn", không phải "đàn cá tuần này".

**Theo nghề** (tuần tới, D2 / B2 / B1): vây 0,846 / 0,849 / 0,821 · câu 0,839 / 0,840 / 0,811 · rê 0,871 / 0,872 / 0,854 · kéo 0,864 / 0,868 / 0,836 · chụp 0,886 / 0,876 / 0,840 · khác 0,823 / 0,827 / 0,786. Ở mọi nghề D2 ≈ 30 ngày gần nhất > tháng-lịch trước (16b).

**Kịch bản `ve`** (chỉ biết chuyến đã về + 3 ngày): D2 − B1 mọi giờ −0,003…+0,008; chuyến mới +0,012…+0,026; D2 − B2 ≈ 0. C1 0,689, D1 0,741 — tuần trước gần như chưa có dữ liệu.

## 3. Kiểm "thói quen"

**(i) Tàu lạ.** Giờ đích của cặp (tàu, ô) mà tàu đó chưa từng đánh trước ngày phát: mọi đối thủ đều thấp hơn (0,74–0,81 so 0,81–0,85) nhưng vẫn xa ngẫu nhiên. D2 nhỉnh hơn 30 ngày gần nhất một chút (+0,007…+0,015) — tàu mới đến ô theo chỗ đội tàu vừa làm. Điều này nhất quán với cả "có cá" lẫn "đi theo bạn tàu / nghe bộ đàm"; tự nó không phân định được.

**(ii) Kg/giờ ở ô nóng.** 87 776 chuyến, 12 971 tàu, 34 tuần đi; cố định tàu và nghề × lớp dài × tuần đi; kiểm soát log giờ đánh. Trung bình 49 % giờ của một chuyến nằm trong ô nóng W−1 do tàu khác tạo ra (53 % trong ô nóng nền tĩnh).

| Biến (phần giờ chuyến trong ô nóng, 0→1) | β log(kg/giờ) [CI 90 %] |
|---|---|
| ô nóng W−1 của tàu khác (cùng mô hình với nền tĩnh) | −0,025 [−0,063, +0,006] |
| ô nóng nền tĩnh | −0,203 [−0,233, −0,175] |
| ô nóng W−1, đứng riêng | −0,093 [−0,131, −0,059] |

Đến chỗ đông tàu **không** làm năng suất chuyến cao hơn, kể cả so với chính tàu đó ở chuyến khác. Chiều âm có thể là chia sẻ đàn cá (nhiều tàu cùng khai thác một chỗ), hoặc chuyến "an toàn" ở bãi quen. Kết luận cho câu hỏi của bước: **đây là dự báo thói quen đội tàu**. Nó trả lời "tuần tới tàu sẽ ở đâu", không trả lời "tuần tới cá ở đâu".

## 4. Giới hạn trung thực

- **Một năm** (2026, El Niño), 30 ngày phát; CI theo ngày phát không bắt được dao động giữa các năm.
- **Vũ trụ ô dựng từ cả năm** (ô nghề đó từng đánh) — như nhau cho mọi đối thủ, nhưng làm số tuyệt đối cao hơn thực tế; chỉ đọc chênh.
- **Giờ đánh chỉ từ chuyến có nhật ký kg > 0** (102 nghìn / 365 nghìn nhật ký); tàu < 15 m không có. Đội tàu thật đông hơn, nhưng cùng định nghĩa giờ đánh với nhãn đang dùng.
- **Kg chia đều theo giờ** trong chuyến (N1 của báo cáo eval): kiểm (ii) chỉ dùng được ở mức chuyến; không nói được ô nào trong chuyến ra cá. AUCeff TB theo kg bị cá tạp (26 % kg) chi phối.
- **Độ trễ dữ liệu thật chưa đo được** (`submittedAt` không phải mốc lên server). 3 ngày là giả định; nếu thực tế 7–14 ngày thì kịch bản `ve` còn kém hơn.
- **Hai mục thêm sau đăng ký** (chuyến mới, so B2) — ghi ở khối đăng ký; chúng làm kết luận khắt khe hơn, không dễ hơn.

## 5. Đề nghị (chỉ đề xuất, không sửa `src/`)

1. **Không làm kênh "bãi đang ăn" theo tuần.** W−1 không thêm gì so với 30 ngày gần nhất, và ở dữ liệu có độ trễ thì sụp.
2. **Nếu (và chỉ nếu) có nguồn VMS đều đặn**: đổi kênh đội tàu (`src/lib/fleet-effort.ts`) từ "tháng-trong-năm ± tháng kề" sang **cửa sổ trượt 30 ngày tính tới hôm qua**, làm mới hằng tuần. Tham số đề xuất: cửa sổ 30 ngày (hoặc nửa đời 7 ngày trên 28 ngày + làm mượt 0,5 × 8 ô kề — tương đương), ô 0,25°, theo nhóm nghề. Lợi ích kỳ vọng +0,02–0,03 AUC giờ, +4–5 điểm "top 10 %". Không có nguồn VMS thì giữ nguyên lưới hiện tại.
3. **Gọi đúng tên**: lớp này trình bày như "**chỗ tàu đang làm**" (thông tin đội tàu), KHÔNG như "chỗ có cá" — đo được rằng đông tàu không cao năng suất hơn (§3). Gắn chữ "cá" là hứa độ chính xác nguồn không đảm bảo (CLAUDE.md, KHÔNG ĐƯỢC). Cũng cần cân nhắc: kéo bà con về chỗ đông tàu có thể làm năng suất mỗi tàu giảm (β âm).
4. **Việc chặn**: (a) nguồn VMS gần thời gian thực hoặc kéo DataLake hằng tuần (README §5 mục 3) — không có thì đề nghị 2 vô nghĩa; (b) mốc thời gian nhật ký lên server (để đo độ trễ thật); (c) năm nhãn thứ hai để thử "cùng tháng năm ngoái" — A1x (nền cả năm, rò) ngang D2 ở tuần tới và hơn ở tầm 15–21 ngày, gợi ý nền mùa nhiều năm có thể là đối thủ mạnh nhất về lâu dài.
