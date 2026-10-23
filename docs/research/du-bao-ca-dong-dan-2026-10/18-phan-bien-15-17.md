# 18 — Phản biện độc lập bước 15 (trăng), 16 (bãi đang ăn), 17 (sản lượng nhiều năm) (2026-10-23)

**Load khi / Load when**: trước khi đưa hệ số trăng vào `model-params` / `fish-predict.ts`, trước khi trích kết luận của 15, 16, 17 ra ngoài thư mục nghiên cứu, hoặc trước khi chạy lại ba bước đó trên năm nhãn 2027.

> Người phản biện: vai thống kê nghề cá + kỹ sư dữ liệu, cùng chuẩn khó tính với 07. Đọc doc 15/15b, 16/16b, 17/17b, **mã** `buoc15-trang.mjs`, `trang-thien-van.mjs`, `buoc16-bai-dang-an.mjs`, `buoc17-san-luong.mjs`, `tai-san-luong.mjs`, `git diff bang-chuyen.mjs`, và kết quả thô ở `$SDFISH_DATA_DIR/dong-dan/buoc15|16|17/*.json`. Đã chạy `trang-thien-van.mjs --selftest` (6/6 OK). Không chạy lại gì đọc `dl-all`, không sửa mã hay doc khác.
> Ký hiệu: **[CHẮC]** = suy ra thẳng từ mã hoặc số thô; **[NGHI]** = có lý do nghi, cần đo.

## 0. Phán quyết 1 phút

| Bước | Doc tự nói | Phán quyết | Khoa học | Thống kê | Code | Giá trị cho bà con |
|---|---|---|---|---|---|---|
| 15 trăng | QUA hẹp (lưới chụp) | **HẠ MỨC → "giả thuyết, chưa loại được lịch âm"**. Chưa đủ để vào `model-params` | 2/5 | 2/5 | 4/5 | 2/5 |
| 16 bãi đang ăn | Cổng QUA hình thức, ý "tuần trước" KHÔNG QUA | **GIỮ** (đọc đúng), kèm 3 chỉnh: cổng chính trượt ngưỡng ở chuyến mới; đích kg W−1 trượt cần ghi rõ; D2 vs B2 lẫn hiệu ứng làm mượt | 4/5 | 3/5 | 4/5 | 3/5 |
| 17 sản lượng | KHÔNG QUA 6/6 | **GIỮ**. Vài số mô tả lệch nhỏ, một nhãn sai ("gió hè yếu nhất") | 4/5 | 3/5 | 4/5 | 3/5 |

`bang-chuyen.mjs`: **không đổi kết quả bước 0/B** [CHẮC]. `fishingVerdict` vẫn gọi đúng một lần mỗi đoạn, cùng nhánh `continue`; `segAny?.()` là gọi tuỳ chọn; `dep`, `arr` chỉ thêm trường, `buoc0-chuyen.mjs`/`buoc-b-moi-ca.mjs` không đọc hai tên đó và không duyệt khoá của dòng (đã grep).

Mã tàu trong doc 15–17: **không có** (grep mẫu số đăng ký). Nguồn bước 17 (NSO PxWeb) là số liệu Nhà nước công bố, không vướng chủ quyền/giấy phép; Sea Around Us, FAO không dùng làm nhãn — đúng luật repo.

---

## 1. Bước 15 — trăng: "QUA" là quá tay

### 1.1 Lỗi nặng: dữ liệu nói "chu kỳ lịch âm", không nói "ánh trăng"

**(a) Đường β theo độ lệch KHÔNG có dạng cos** [CHẮC, `buoc15.json` → `nghe.chụp.lech`]. Doc 15 dòng 89 viết "Đường β theo độ lệch có dạng cos rõ". Số thô (lưới chụp, bản tháng), Δ = 0…29 ngày:

`−0,23 −0,36 −0,40 −0,38 −0,35 −0,31 −0,29 −0,27 −0,25 −0,24 −0,23 −0,21 −0,18 −0,11 0,00 +0,14 +0,25 +0,30 +0,32 +0,31 +0,29 +0,28 +0,26 +0,25 +0,24 +0,23 +0,20 +0,15 +0,05 −0,11`

- Độ rọi trung bình giờ đêm theo pha là một quả chuông hẹp (khe 0…7: 0,000 · 0,016 · 0,153 · 0,435 · 0,605 · 0,438 · 0,151 · 0,016). Tự tương quan của nó ở độ lệch một phần tư chu kỳ ≈ −0,06 (tôi tính từ 8 khe). Nếu kg đi theo **ánh trăng**, β(Δ ≈ 7) và β(Δ ≈ 22) phải ≈ 0. Thực tế β(7) = **−0,27** và β(22) = **+0,26** — lớn hơn cả β thật (−0,23).
- Có **20/29** độ lệch chung cho |β(Δ)| ≥ |β(0)|. Mốc thiên văn đúng (Δ = 0) không phải mốc khớp nhất; đường có dạng "nửa chu kỳ âm – nửa chu kỳ dương" (gần sóng vuông lệch ~4–5 ngày), đúng hình của một hiệu ứng **theo nửa tháng âm lịch**, không phải theo độ sáng.
- "β lệch 14,77 ngày đổi dấu (−0,23 → +0,44)" (doc dòng 12) không phải bằng chứng thuận: biên độ ở nửa chu kỳ **gấp đôi** ở mốc thật, cũng là dấu hiệu lệch pha.

**(b) Hai khe cùng độ rọi cho kết quả ngược nhau** [CHẮC, `nghe.chụp.khe`]. Khe 2 (trăng thượng huyền, độ rọi 0,153) β = **−0,097**; khe 6 (hạ huyền, độ rọi 0,151) β = **+0,056** — chênh 0,15 log-kg với cùng ánh sáng. Bản nửa tháng: −0,089 / +0,060. Khe 4 (rằm, sáng nhất) −0,086 còn nhỏ hơn khe 3 (−0,159): không có liều–đáp ứng đơn điệu. Hệ số pha cũng nói vậy: **sin −0,080 [−0,106; −0,057] lớn hơn cos +0,064** — thành phần "trăng lên hay trăng xuống" mạnh hơn thành phần "sáng hay tối". Mô hình độ rọi đối xứng (khe 2 = khe 6) không giải thích được điều này, và bảng hệ số nhân §4 (dòng 97: khe 2 = khe 6 = 1,02) **mâu thuẫn với chính khe pha của cùng lần chạy**.

**(c) Tết Nguyên Đán nằm đúng chỗ hiệu ứng** [NGHI mạnh]. Tết 2026 = 17/2 = trăng non; rằm tháng Giêng = 3/3. Hiệu ứng chụp ở bản tháng nằm **trọn trong nửa 1–5** (−0,50) còn nửa 6–10 bằng **−0,01** [−0,17; +0,14]. Hiệu ứng tháng × vùng gộp cả chuyến trước Tết (nửa sau tháng Chạp, trăng xuống) và sau Tết (nửa đầu tháng Giêng, trăng lên) vào một mức tháng 2 — đúng kiểu tạo ra hệ số sin âm. Ngoài Tết, mùng 1 / rằm hằng tháng (cúng, nghỉ, bán) cũng khoá theo lịch âm. Doc §5 có nhắc "lịch âm chung" nhưng chỉ ước 1/5–1/3; bằng chứng (a)(b) cho thấy có thể là phần lớn.

**(d) Phép kiểm giả "lệch ngẫu nhiên từng chuyến" quá dễ** [CHẮC, `buoc15-trang.mjs:148`]. Mỗi chuyến lấy một độ lệch riêng ⇒ phá cấu trúc chung theo ngày, nên phân phối giả hẹp hơn nhiều so với độ bất định thật (mọi chuyến cùng ngày chung một giá trị trăng). p = 0/100 chỉ nói "có thành phần 29,5 ngày nào đó", **không** phân biệt được ánh trăng với lịch âm của người. Đối chứng đúng là đường lệch CHUNG (đã có, và nó trượt — điểm a).

**(e) CI quá hẹp vì cụm sai** [CHẮC, `buoc15-trang.mjs:106`]. Cụm bootstrap = tuần × vùng 0,5° (1 414 cụm ở chụp). Nhưng biến thử là hàm của **ngày**: mọi vùng trong cùng tuần chia chung pha trăng và chung cú sốc lịch âm. Số đơn vị độc lập thật là cỡ **~10 chu kỳ trăng** trong năm, không phải 1 414. Thêm nữa FE được khử một lần trên toàn mẫu rồi mới bootstrap (dòng 105, 110–116) — xấp xỉ chấp nhận được, nhưng cũng kéo CI hẹp. Hệ quả: CI 90 % [−18,4; −7,4] % gần như chắc chắn hẹp hơn thật; với nửa năm sau ≈ 0, CI đúng (cụm theo tuần hoặc theo nửa tháng âm) rất có thể chứa 0.

**(f) Chấm cổng nới tay** [CHẮC, doc dòng 71]. Điều 2 "hai nửa năm cùng dấu âm" qua nhờ −0,0096 — tức bằng 0; đọc đúng tinh thần là **trượt** ở bản tháng. Điều 5 (≥ 10 %) qua theo ước điểm, cận dưới 7,4 %. Doc §0 dòng 9 "Năm điều đăng ký trước đều qua" phải sửa thành "qua 3 điều rõ, 2 điều qua sát vạch".

**(g) Đăng ký trước không kiểm chứng được** [CHẮC]. File chưa commit; đã có lần chạy `buoc15-v1-nucheo` lúc 14:56 trước bản cuối. Không nghi gian, nhưng "viết TRƯỚC khi chạy" phải có mốc git mới có giá trị cho 2027.

### 1.2 Lỗi code nhỏ (không đổi kết luận chính) — ghi lại, KHÔNG sửa

- `buoc15-trang.mjs:51` — chú thích "không ở cảng/mất tín hiệu", nhưng `fishingVerdict` (`scripts/fishing-def.mjs:115–118`) xét dải tốc độ **trước** cảng: tàu neo trong cảng (≈ 0 hải lý/giờ) trả `"band"`, không phải `"port"`/`"inport"`. Vậy độ rọi "mọi giờ đêm trên biển" (`LS`, `luxBien`) có lẫn đêm neo cảng giữa chuyến. Có thể là nguồn của số lạ **câu ngừ β −1,06** ở thước đo này (15b) — doc không nhắc số này.
- `buoc15-trang.mjs:31` và `:43` tự viết lại độ rọi trong khi `trang-thien-van.mjs:35` đã export `moonLux` — trùng nghĩa (CLAUDE.md quy tắc 3).
- `buoc15-trang.mjs:140` — khe pha của chuyến lấy từ hướng vectơ (cos, sin) trung bình; chuyến ~11 ngày trải hơn nửa chu kỳ thì vectơ ngắn, góc gần như ngẫu nhiên ⇒ bảng khe nhoè (doc đã nói "nhoè" nhưng không nói cơ chế).
- `buoc15-trang.mjs:74–79` — nghề con theo kg cả năm của tàu gồm cả chuyến đang xét (rò nhẹ y vào phân tầng; nhỏ).
- `trang-thien-van.mjs`: đối chiếu với công thức suncalc — mốc ngày, giờ sao, toạ độ trăng, phần sáng đều đúng; bỏ thị sai trăng (~1°) chấp nhận được. Múi giờ: toàn bộ tính theo giây Unix UTC, `vnDate` +7 chỉ dùng cho nhãn ngày — không lỗi.

### 1.3 Số trong doc 15

Mọi số trong bảng §3.1, §3.2, §4 khớp `buoc15*.json` (đã đối từng ô). Không có số sai; chỉ có **lời diễn giải sai** ở dòng 12 ("đều đúng chiều"), 71 (chấm điều 2, 5), 89 ("dạng cos rõ"), và bỏ sót: kéo bản nửa tháng nửa 6–10 = −0,131 [−0,222; −0,039] (đối chứng có CI loại 0), câu ngừ `luxBien` −1,06.

### 1.4 Giá trị cho bà con — một phát hiện quan trọng hơn hệ số

- **App đang nói ngược với dữ liệu.** `src/lib/moon.ts:22` "Tối trời cả đêm — đánh đèn (mực, cá cơm) thuận" và `:30` "Sáng trăng suốt đêm — mực, cá cơm kém ăn đèn". Bước 15 đo: mực trong nghề đèn **+2 %** [−4; +9], câu mực **+3 %**, cá cơm trong tàu vây **+24 %** dưới trăng sáng. Câu chữ hiện tại là hứa điều nguồn không bảo đảm (CLAUDE.md, KHÔNG ĐƯỢC) — đáng sửa trước cả việc thêm hệ số (đề nghị: bỏ tên loài, chỉ giữ mô tả trăng sáng/tối; quyết thuộc anh Long).
- **Hệ số nhân đồng đều theo ngày có thể vô tác dụng trên bản đồ.** Nếu điểm cá là hạng phân vị trong lưới của ngày (07 §4, README §6), nhân cả lưới một nghề với 0,92 không đổi thứ hạng ô nào. Hệ số chỉ có nghĩa ở chỗ so **giữa các ngày** (lịch đi biển, "hôm nay so với mai"). Phải nói rõ nó vào đâu trước khi bàn biên độ.

### 1.5 Điều kiện TỐI THIỂU trước khi đưa hệ số trăng vào `model-params`

Phải đạt **tất cả**:

1. **Loại Tết và lịch âm**: chạy lại `buoc15-trang.mjs` (a) bỏ chuyến có giờ đánh trong 1/2–10/3/2026, (b) thêm hiệu ứng cố định "ngày âm lịch của ngày đi / ngày về" hoặc biến giả "chuyến chứa mùng 1 / rằm". β chụp vẫn âm, CI loại 0.
2. **Kiểm đối xứng**: khe 2 và khe 6 (cùng độ rọi) không khác nhau (CI chênh chứa 0); hoặc mô hình độ rọi thắng mô hình cos+sin theo tiêu chí ngoài mẫu. Nếu sin vẫn trội ⇒ cơ chế không phải ánh sáng ⇒ không dùng "độ rọi" làm biến.
3. **Đường lệch chung đúng hình**: cực trị trong ±1 ngày quanh Δ = 0; |β(7,4)| và |β(22,1)| < 1/3 |β(0)|.
4. **CI theo cụm đúng**: bootstrap theo khối thời gian chung mọi vùng (tuần, hoặc nửa tháng âm), CI vẫn loại 0 ở cả bản tháng và nửa tháng; nửa năm sau phải âm với CI loại 0 ở ít nhất một bản.
5. **Ngoài mẫu**: khoá đăng ký 2027 **bằng một commit** trước khi có nhãn 2027 (dòng 119 của 15 là đúng hướng); chạy y nguyên script; hoặc kiểm trên nhãn 2025 nếu xin được (README §5).
6. **Có chỗ dùng**: chỉ ra màn hình/biến nào của app hệ số làm đổi (không phải bản đồ hạng phân vị trong ngày), và đo nó cải thiện metric chuyến ngoài mẫu (không chỉ β trong mẫu).
7. **Tách mực khỏi cá trong lưới chụp** (doc 15 §6.3a) trước khi viết bất kỳ câu nào cho bà con có tên loài.

Chưa đạt 1–4 thì ngay cả bản "T thận trọng" cũng không nên vào app, kể cả có cờ tắt.

---

## 2. Bước 16 — bãi đang ăn: đọc trung thực, giữ

### 2.1 Kiểm rò, múi giờ, tầm [CHẮC]

- Ngày VN: `dayOf = floor((t + 7h)/86400)` (`buoc16-bai-dang-an.mjs:23`) — đúng; ngày phát, tầm `[T+1, T+7]`… đúng; cửa sổ dự báo dùng `d ≤ T` (dòng 128) tức coi bản tin phát **cuối ngày T** — chấp nhận được, nên ghi.
- Kịch bản `ve`: lọc `rowKnown = ngày về + LAG > T` trước mọi cộng dồn (dòng 86, 129) — không rò. `submittedAt` âm 97 % ⇒ dùng 3 ngày như đăng ký (dòng 76) — đúng.
- "Tàu lạ" dùng ngày đánh đầu tiên trên toàn dữ liệu (dòng 105, 170) — đúng định nghĩa "chưa từng trước T".
- Kiểm (ii): cửa sổ W−1 trượt [D−7, D−1] (dòng 275–276) đúng; trừ giờ của chính tàu (dòng 284) đúng; cụm bootstrap theo tuần đi (dòng 295) — đúng chỗ bước 15 làm sai.
- Vũ trụ ô dựng cả năm (dòng 91–93) và tập chuyến chọn theo "có nhật ký, kg > 0" — rò nhẹ, như nhau mọi đối thủ, doc §4 đã nói.

### 2.2 Ba chỉnh cần ghi vào doc 16

1. **Cổng chính chỉ qua nhờ chuyến đang ở biển** [CHẮC, 16b / `buoc16.json`]. D2 − B1 ở **chuyến mới** = +0,004…+0,017 — cận dưới **< +0,01**, tức trượt đúng ngưỡng đã đăng ký nếu bỏ phần "cùng chuyến đánh tiếp tại chỗ". Doc có số trong bảng (dòng 89) nhưng §0.1 (dòng 11) chỉ viết "Cổng chính qua". Nên viết: "qua hình thức trên mọi giờ; trên chuyến mới thì trượt ngưỡng +0,01".
2. **Đích kg theo luật đăng ký là KHÔNG QUA** [CHẮC]. Khối đăng ký (dòng 54) đòi "đối thủ kiểu W−1 thắng B1 trên AUCeff". C1 (W−1) AUCeff 0,536 so B1 ~0,66 — thua xa. §0.5 chỉ báo D2. Cần một câu "đích kg: W−1 trượt; D2 (28 ngày giảm dần) thắng B1".
3. **D2 vs B2 lẫn hai thay đổi** [NGHI có căn cứ, `buoc16-bai-dang-an.mjs:142,147`]. D2 = giảm dần **+ làm mượt lân cận**; B2 = 30 ngày **không mượt**. Ở giờ đánh chúng ngang nhau, nhưng ở AUCeff kịch bản `ve` D2 − B2 = **+0,019…+0,030** (CI loại 0, không có trong doc). Với vũ trụ `UALL` (1 876 ô, nhiều ô điểm 0 hoà nhau), làm mượt tự nó nâng AUC. Kết luận "cái thắng là cửa sổ 30 ngày, không phải tín hiệu tuần" vẫn đứng ở giờ đánh, nhưng thiếu đối thủ "B2 làm mượt" để quy công sạch — thêm khi chạy lại.

### 2.3 Số lệch nhỏ trong doc 16

- Dòng 81: D2 tuần tới "[0,844, **0,864**]" — số thô [0,8436, **0,8619**] ⇒ 0,862.
- Dòng 14: "−2,5 % [−6,3 %, +0,6 %]", "−9 % [−13 %, −6 %]", "−20 %" là **β log** đọc như %. Đổi đúng: −2,5 % [−6,1; +0,6]; −8,9 % [−12,3; −5,7]; −18,4 %. Không đổi kết luận.
- Dòng 75: top 10 % chuyến mới của B1 là 0,555 ⇒ "55 %" (doc 56 %); §0.3 "59 % so 56 %" là B2 so B1 (D2 chỉ 57 %).
- Bootstrap theo ngày phát (dòng 249) coi 30 tuần độc lập — tuần liền nhau tự tương quan (mùa vụ đội tàu); CI hơi hẹp, chênh cặp vẫn đáng tin hơn số tuyệt đối.

### 2.4 Giá trị

Kết luận "đây là dự báo thói quen đội tàu, không phải cá" và đề nghị §5.3 "gọi là chỗ tàu đang làm" đúng và có ích. Câu "Đến chỗ đông tàu không làm năng suất chuyến cao hơn" (dòng 114) nên hạ từ giọng nhân quả xuống tương quan (chọn chỗ đánh là nội sinh: chuyến đang kém có thể chủ động tìm chỗ đông tàu).

---

## 3. Bước 17 — sản lượng nhiều năm: giữ

### 3.1 Code [CHẮC]

- ONI: khoá `${YR}-${SEAS}`, `DJF` của năm t = T12(t−1)–T2(t) — đúng "đầu năm t" (`buoc17-san-luong.mjs:56,58`).
- Ba cách khử: (a) phần dư tuyến tính, (b) sai phân cả hai chuỗi, (c) so TB 5 năm trước — đúng như đăng ký (dòng 70–79). Không rò tương lai: (c) chỉ dùng t−5…t−1.
- Luật quyết mã hoá đúng §2 (dòng 109–125). BH đúng.
- Yếu: bootstrap và hoán vị coi năm độc lập (dòng 87–88); `neff` được tính (dòng 90) nhưng **không dùng** vào CI hay p. Với kết luận "không qua" thì điều này chỉ làm phép thử dễ qua hơn — không đổi kết luận, nhưng các CI "loại 0" ở phần phụ (V06.65 ~ chl, Bình Định) còn yếu hơn doc gợi ý.
- `tai-san-luong.mjs:14` ghim cứng `RXID` (mã phiên trang chủ PxWeb) — không phải bí mật, nhưng sẽ gãy khi NSO đổi; đã có `timeout` và báo lỗi đúng.

### 3.2 Số lệch trong doc 17 (đối với `buoc17.json → nam`)

| Dòng | Doc | Số thô | Ghi chú |
|---|---|---|---|
| 87, 11 | 1998 SCU **−20 %** | **−18,3 %** (99,4 → 81,2 nghìn tấn) | −20 % là riêng Bình Thuận; cột ghi "Sản lượng SCU" |
| 88 | 2020 "gió hè yếu nhất chuỗi" | 2010 yếu nhất (−0,0209), 2020 thứ hai (−0,0189) | sửa nhãn |
| 90 | 2022 +5,7 % | +5,9 % | nhỏ |
| 91 | 2016 +8,5 % | +8,9 % | nhỏ |
| 94 | "4 năm giảm (1998 −20 %…)" | 1998 −18,3 %, 2002 −0,7 %, 2003 −1,3 %, 2024 −2,8 % | sửa 1998 |
| 99 | CPUE thô "|r| ≤ 0,2 ở cách a" | đúng, nhưng cách (b): P6 +0,50 (p 0,05), P4 −0,42, P5 −0,43 | nên nhắc, n = 15 |

Bảng sáu phép thử chính, kiểm giả không gian, §3.3 V06.65, Bình Định, trễ +1: **khớp**.

### 3.3 Diễn giải

"Lý do tin nhất là chuỗi thống kê quá trơn" (dòng 11) nên gắn [NGHI]/[GĐ] như chính §5 dòng 113 đã làm — đó là giả thuyết về cách NSO ước số, chưa kiểm. Danh sách xin số §6 là phần có giá trị nhất của bước; giữ.

---

## 4. Việc còn thiếu chung

- `docs/research/du-bao-ca-dong-dan-2026-10/README.md` **chưa có mục cho 15, 16, 17** (mục cuối là bước B, số 11). Doc index phải cập nhật cùng commit.
- Khi commit, khoá đăng ký 2027 của bước 15 phải nằm trong commit trước mọi lần chạy trên nhãn mới (điểm 1.1g).

## 5. Tóm tắt việc sửa đề nghị (không tự sửa)

| Ưu tiên | File | Việc |
|---|---|---|
| 1 | `15-trang.md` §0, §3.1 dòng 71, §3.3 dòng 89, §4 | Hạ "QUA" thành "giả thuyết chưa loại lịch âm"; nêu sóng vuông, khe 2 ≠ khe 6, sin > cos, Tết; bảng hệ số §4 ghi "mâu thuẫn khe pha, không dùng" |
| 1 | `src/lib/moon.ts:22,30` (quyết của anh Long, không thuộc nghiên cứu) | Câu "mực, cá cơm kém ăn đèn" không có cơ sở trong dữ liệu 2026 |
| 2 | `buoc15-trang.mjs:106,148,51` | Cụm theo thời gian chung; kiểm giả lệch chung; tách `band` ở cảng khỏi "đêm trên biển" |
| 2 | `16-bai-dang-an.md` §0.1, §0.5, dòng 14, 81 | Ghi cổng trượt ở chuyến mới; đích kg W−1 trượt; sửa CI, đổi log→% |
| 3 | `buoc16-bai-dang-an.mjs:147` | Thêm đối thủ "B2 làm mượt" |
| 3 | `17-san-luong-nhieu-nam.md` dòng 11, 87, 88, 90, 91, 94 | Sửa số 1998, 2016, 2022, nhãn "gió yếu nhất" |
| 3 | `README.md` thư mục nghiên cứu | Thêm mục 15, 16, 17 |
