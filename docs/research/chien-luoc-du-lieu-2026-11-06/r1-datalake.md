# R1 — Kiểm kê và đánh giá DataLake IUU cho ForFish (2026-11-06)

> Chỉ đọc. Mọi số dưới đây là **số tổng hợp**, không có số đăng ký, tên hay SĐT. Script đo nằm trong scratchpad của phiên (`lib.mjs`, `schema.mjs`, `trips.mjs`, `logbooks.mjs`, `misc.mjs`, `prof.mjs`, `extra.mjs`), chạy bằng `node --max-old-space-size=8000 <file>` và đọc stream từ `C:\Code\AI-Assistant\sdvico-data\data-local\datalake-iuu\snapshots\2026-10-11\*.gz`, `profiles/`, `encounters/`. WSL (`~/fish-train-2f-data` 580 KB, `~/fish-eval-r1…r3` 17–31 MB) chỉ chứa nhãn, lưới và log đã dẫn xuất. Dữ liệu thô nằm hết ở Windows.

## 0. Ba điều cần biết trước

1. **Dữ liệu đã đóng băng.** Bản chụp đủ cuối cùng là ngày 11/10/2026. Đường hầm API đã chết từ 19/10 (`scripts/dl-collect.mjs` dòng 2). Vì vậy mọi đề xuất chỉ dùng được dưới dạng **tiên nghiệm tĩnh kết tinh lúc build**. Không đề xuất nào được giả định có DataLake chạy trực tiếp.
2. **Chỉ có một năm, và không trọn năm.** Chuyến và nhật ký phủ 01–10/2026. VMS phủ 12/2025–10/10/2026. Lượt cảng chỉ từ 01/08/2026. Sổ tàu từ lô 31/08. Thiếu tháng 11–12 nên không so được năm này với năm khác.
3. **Pháp lý chưa rõ.** Đây là API "bản thử", có kèm PII (quyền `pii`), không phải thông tin nhà nước công bố công khai. Phần CLAUDE.md nói "đừng viết câu dè chừng" chỉ áp cho Thông báo hàng hải, tin bão và danh mục báo hiệu, **không** áp cho DataLake. Lớp cá premium đang dùng dẫn xuất DataLake, nên cần thoả thuận sử dụng bằng văn bản với Cục. Rủi ro này hiện **chưa có ai ghi** trong 01-product.

## 1. Kiểm kê (đo thật)

| Bảng | Bản ghi / phủ | Trường đáng giá | Chất lượng đo được |
|---|---|---|---|
| `vessels` (VNF) | 80.005 tàu. <12 m: 38.834 · 12–15: 13.650 · 15–24: 25.137 · ≥24: 2.384 | dài, CV (có ở 77.472 tàu = 96,8 %), nghề, xã, chủ | Nghề null 3.789. "Khác" 10.463. Mọi tàu đều `active` (không có trạng thái thật) |
| `trips` 01–10/2026 (đã khử trùng theo `code`) | **633.168 chuyến**, 52.405 tàu | trạng thái, giờ rời/cập, cảng, `crew` (KSTC), `vms.seaDays`, ~60 loại cờ | COMPLETE 68,2 % · **UNDECLARED 15,1 %** · MISSING_ARRIVAL 5,7 % · MISSING_DEP 4,4 % · AT_SEA 3,0 % · BEFORE_DATA 2,6 %. Cờ `KHONG_CO_THIET_BI` ở 290 nghìn chuyến (46 %) |
| `logbooks-all` eCDT | **364.788 nhật ký**, 42.576 tàu, landed **744 nghìn tấn** | loài × kg cập, cảng cập, số mẻ, vùng FAO | **Cá Tạp 24,5 % + Cá Xô 8,8 % = 33 % kg không rõ loài**. `catchKg` null 97,9 %. `haulCount` p99 = 3 (gần như không ghi mẻ). `fishingArea` có ở 1,3 %. Giấy 73 % / điện tử 7,6 %. landed = 0 hoặc null: 32 %. Kg tròn trăm một loài ≥500: 1,8 %. `submittedAt` trống 97 % |
| `port-calls` 08–10/2026 | 270.430 lượt (IN 134.623), 36.187 tàu | nguồn (eCDT/KSTC/VMS), `crew_count` (73 %), toạ độ VMS lúc cập | `vms_rule NO_DEVICE` 44 %. Giờ khai lệch giờ VMS: p50 0,47 h, **p90 6,9 h**. Giờ cập khai dồn vào **8–10 h và 14–16 h** (giờ hành chính, không phải giờ tàu vào) |
| `landing-receipts` | 50.187 biên nhận (2023-08 → 10/2026), 4.432 tàu, 220 bên mua, 53 cảng, 182 nghìn tấn | bên mua × loài × kg, giờ bốc dỡ | **Không có trường giá**. `saleForm` trống 100 %. Chủ yếu ngừ vằn (54 nghìn tấn) và ngừ vây vàng (27 nghìn tấn) |
| `catch-statements` / `catch-certificates` | SC 5.620 (93 nghìn tấn, 44.910 dòng) · CC 1.477 (18 nghìn tấn) | nước nhập (Pháp, Tây Ban Nha, Thái, Đức…), chuỗi SC → chuyến | `processingType` null 82 % |
| VMS `tracks` | 11 tháng, 1,8 GB gz, 1 dòng = tàu × tháng `[t,lat,lng]` | 26.134 tàu có thiết bị, 11 nhà cung cấp | Nhịp gửi trung vị 90 phút (p10 = 60, p90 = 120). **50,8 % tàu có ≥1 lần đứt >6 h, 39,8 % có lần đứt dài nhất ≥24 h** (số này bị thổi phồng vì GSTC nâng cấp sau 15/09, thiếu ~8,6 nghìn tàu) |
| `vessels-last-position` | 53.064 | trạng thái thiết bị | NO_VMS 26.786 · SILENT 15.475 · TRANSMITTING 10.803 |
| `encounters` (dẫn xuất) | **3,28 triệu lần gặp**, 24.704 tàu | GROUP_FISHING 1,90 tr · PAIRED 1,07 tr · MOORED 254 nghìn · **SUSPECTED_TRANSSHIPMENT 53.586** | 1.317 tàu nghi hậu cần (CAO 166, VỪA 1.151). Tuy vậy 19.257 tàu có ≥1 lần "nghi chuyển tải", nên ngưỡng này **quá rộng** (khớp kết luận c5 ở fish-train-review §7.6b) |
| `profiles/segments` | 50.377 tàu | `kgPerSeaDay`, `vsPeer`, mức đều đặn | 54 % "CHƯA ĐỦ SỐ LIỆU". THẤT THƯỜNG 16.977 · NẰM BỜ 16.817 · ĐI ĐỀU 16.583 |
| Danh mục | 203 cảng · 315 loài · 7 nghề · 385 đồn biên phòng · 10 nhà cung cấp VMS | | `establishments` chưa có toạ độ và xã |

**Số dẫn xuất mới đo trong phiên này:**
- **Độ dài chuyến COMPLETE (ngày):** p25 1,85 · p50 6,9 · p75 15,4 · p90 29.
- **Quay vòng (cập → rời chuyến sau):** p50 0,69 ngày · p75 5,2 · p90 13. Hệ số biến thiên (CV) của quay vòng theo tàu có trung vị 1,38, tức nhịp đi biển rất không đều.
- **Số chuyến COMPLETE mỗi tàu trong 10 tháng:** p50 6, p90 20.
- **Số người trên tàu:** có ở 78,4 % chuyến. p50 4 · p90 10 · p99 16.
- **Kg cập mỗi ngày biển theo cỡ tàu (trung vị):** <12 m 12,6 · 12–15 m 96 · 15–24 m 148 · ≥24 m 1.042.
- **Chênh năng suất trong cùng nhóm nghề × cỡ × tỉnh** (173 nhóm ≥10 tàu): tỉ số p75/p25 của kg/ngày biển có **trung vị 4,6 lần** (p25 2,6, p75 10,3).
- **Tàu 15–24 m, kg/ngày theo độ dài chuyến:** <2 ngày 878 · 2–5 ngày 441 · 5–10 ngày 176 · 10–20 ngày 59 · ≥20 ngày 75. Đường dốc này **bị nhiễu nặng** vì chuyến dài thường chuyển cá qua tàu hậu cần và khai thiếu. Chưa được đọc nó là "đi ngắn lời hơn".
- **Trăng:** lượt cập/ngày thấp nhất lúc trăng non (1.746), cao nhất 2.249 — ±12 %, chỉ 2,4 chu kỳ nên yếu.
- **Cảng:** 88 cảng có ≥300 lượt cập trong 71 ngày, trung vị 12 lượt/ngày, CV theo ngày 0,71. Top 10 cảng chiếm 43,6 % kg cập.

## 2. App đang dùng gì rồi, và mức đã chứng minh

| Đang dùng | Nguồn DataLake | Mức đã chứng minh | Giới hạn đã biết |
|---|---|---|---|
| **Nền bãi cá theo mùa** `fish-base.v1.json` (premium) | nhãn v2 = nhật ký eCDT × giờ đánh VMS, có điểm tin cậy theo chuyến | **AUCeff trong-nghề 0,810** (cũ 0,726). Bậc "Cao" có kg/giờ ≥2× bậc "TB" ở mức gộp, nhưng chưa đạt ở 4/12 loài | Chỉ nói "bãi mùa này", **không** nói "hôm nay cá ở đâu". Vệ tinh của ngày đóng góp ≈0 (0/30 tổ hợp qua đối chứng). Tháng 11–12 rơi về `fleet-static` |
| **Kênh đội tàu** `fleet-effort-025.v1.json` | giờ có mặt VMS 0–4,5 hải lý/giờ, ô 0,25° × tháng × 6 nghề, ≥3 tàu | AUCeff 0,621 → 0,672 (giữ-tháng-ra) | Lưới tĩnh. Chỉ tàu có VMS (phần lớn ≥15 m). Cá chim và cá sòng tụt |
| **Kênh sản lượng loài** `species-catch-025.v1.json` | 155 nghìn chuyến, 34 loài | 0,736. **Đã bỏ làm số tiêu đề** vì baseline tĩnh đạt 0,809 | Kg chia đều theo giờ nên không phân giải được mẻ |
| **Mật độ tàu dự kiến 16 ngày** `fleet-density.v1.json` | VMS theo ngày/tháng/mùa/trăng × nghề, ≥3 tàu | Chưa có đo kỹ năng dự báo riêng | Code và comment phía app không nhắc nguồn |

**Chưa dùng:** biên nhận bốc dỡ, SC/CC, số người, chu kỳ chuyến, CV máy, chất lượng VMS theo nhà cung cấp, `segments`/`classes` (năng suất nhóm), cờ tuân thủ thủ tục.

## 3. Luật ràng buộc (để đối chiếu với từng đề xuất)

- **L1 — Giao dịch không dùng DataLake.** Không một dòng eCDT, VMS, SC/CC hay sổ tàu nào được vào khu Giao dịch hay luồng mua–bán (`docs/research/kien-truc-moi-4-khu-2026-10-20.md` dòng 6, 16, 149, 242, 319).
- **L2 — Riêng tư.** Chỉ phát ra lưới **tổng** có ≥3 tàu khác nhau (`MIN_VESSELS = 3` ở `build-fleet-effort-grid.mjs` và `build-fleet-density.mjs`). Hệ quả: **không** cho chủ tàu xem hồ sơ DataLake của chính tàu mình, vì đó là dữ liệu từng tàu, dù chính chủ.
- **L3 — Không ghi nguồn ra app.** Không nhắc nguồn trong tên, code phía app hay file phát ra (02 dòng 105, 994).
- **L4 — Offline và bundle tĩnh.** Không thêm request mạng. Đi theo đường SDF2 và dataGate.
- **L5 — Không hứa độ chính xác** mà nguồn không đảm bảo.

## 4. Cơ hội — xếp theo giá trị cho bà con × khả thi

Thang 1–5.

| # | Cơ hội | Giá trị | Khả thi | Luật |
|---|---|---|---|---|
| 1 | Thước đo "tàu cùng nghề, cùng cỡ, cùng tỉnh" | 5 | 5 | Ổn nếu chỉ tổng ≥3 |
| 2 | Tiên nghiệm chu kỳ chuyến → nhắc bảo dưỡng và vật tư | 4 | 5 | Ổn |
| 3 | Hiệu chỉnh cảnh báo mất tín hiệu GSHT + bài tuân thủ khai báo | 5 | 4 | L2 nếu làm theo từng tàu |
| 4 | Kg trên lít dầu ước theo nhóm (ghép dẫn đường tiết kiệm dầu) | 5 | 3 | L5 |
| 5 | Bãi của nhóm năng suất cao (premium) | 4 | 3 | L2 |
| 6 | Lịch mùa loài × cảng cập (Trục 1) | 4 | 4 | Sát L1 |
| 7 | Số người tiêu biểu theo cỡ tàu (sổ thuyền viên) | 3 | 5 | Ổn |
| 8 | Ranh vùng biển: hiệu chỉnh, không phải nguồn | 4 | 3 | Ổn |
| 9 | Ô hay có tàu hậu cần (dầu, đá) | 3 | 3 | Vùng xám L1 |
| 10 | Dự báo nguồn cung cá về cảng | 4 | 3 | **Chặn L1** |
| 11 | Khớp giờ cập với bên mua, mạng bên mua từ biên nhận/SC | 4 | 3 | **Chặn L1** |

**1. Thước đo năng suất nhóm.** Trong cùng nghề, cùng cỡ, cùng tỉnh, tàu p75 làm gấp **4,6 lần** tàu p25 (trung vị nhóm). Đây là con số bà con hiểu ngay. Chủ tàu tự nhập kg chuyến trong app, rồi app đặt cạnh "tàu cùng loại ở tỉnh anh: thường X–Y kg mỗi ngày biển".
- *Dữ liệu:* `profiles/classes.json` (nghề × dải dài × tỉnh: trung vị kg/chuyến, kg/ngày) đã có sẵn, chỉ thêm p25/p75 và n tàu.
- *Thuật toán:* phân vị theo nhóm, có trọng số tin cậy v2. Lọc bỏ nhóm có <10 tàu. Rơi lui về nghề × cỡ toàn quốc.
- *Rủi ro:* kg khai sai, 33 % kg "Cá tạp/xô", tàu <12 m gần như không khai (<12 m chỉ 2,3 % kg). Tuyệt đối không xếp hạng tàu cụ thể (L2). Chỉ so với số chủ tàu tự nhập trong app.

**2. Chu kỳ chuyến → nhắc bảo dưỡng và vật tư.** Sổ nhắc bảo dưỡng ở Trục 3 hiện người dùng phải tự đặt chu kỳ.
- *Dữ liệu:* trips (độ dài p50 6,9 ngày, quay vòng p50 0,7 ngày, 6 chuyến/10 tháng) và CV máy (có ở 96,8 % tàu).
- *Thuật toán:* bảng mặc định theo nghề × cỡ: ngày biển mỗi tháng theo mùa → giờ máy ước → gợi ý mốc thay nhớt, lọc. Nhịp đi rất thất thường (CV 1,38) nên phải dựa trên **ngày biển theo mùa**, không dựa trên lịch cố định.
- *Rủi ro:* thấp. Giờ máy là suy diễn, ghi "ước". Shop vật tư không thuộc Giao dịch cá, nhưng nên hỏi anh Long cho chắc.

**3. Tuân thủ: tín hiệu GSHT và thủ tục.**
- *Số đo:* 15,1 % chuyến "đi không khai". Cờ `VE_BO_THU_TUC` ở 23 nghìn chuyến, `KHAI_LECH_THOI_GIAN` 3,6 nghìn. 39,8 % tàu từng mất tín hiệu ≥24 h. Nhịp gửi trung vị 90 phút, khác nhau theo nhà cung cấp.
- *Cách dùng:* (a) Dùng số tổng để **hiệu chỉnh ngưỡng** cảnh báo của S-Tracking đang làm (nguồn Viettel đại lý, không phải DataLake), ví dụ báo sau N nhịp trượt theo từng nhà cung cấp. (b) Đưa vào bài tuyên truyền Kairos: "cứ 7 chuyến thì có 1 chuyến bị ghi là đi không khai", kèm mức phạt NĐ 246/2026.
- *Rủi ro:* cảnh báo theo từng tàu bằng DataLake là vướng **L2**. Phải dùng dữ liệu thiết bị của chính khách (S-Tracking) hoặc GPS máy. Số mất tín hiệu đang bị thổi phồng vì GSTC sau 15/09.

**4. Kg trên lít dầu ước.** Dầu là chi phí lớn nhất của chuyến. App đã có "dẫn đường tiết kiệm dầu", nhưng chưa có mốc so sánh.
- *Dữ liệu:* CV, ngày biển và giờ chạy (tách bằng tốc độ VMS: >4,5 hải lý/giờ là chạy, 0,5–4,5 là đánh), kg cập.
- *Thuật toán:* lít ≈ CV × 0,7355 × hệ số tải × suất tiêu hao × giờ chạy, cộng phần giờ đánh. Ra phân vị kg/lít theo nhóm, và "tỉ lệ giờ chạy tìm cá / giờ đánh" của nhóm năng suất cao so với nhóm thấp.
- *Rủi ro:* **không có số dầu thật** nên toàn bộ là mô hình, phải ghi "ước, tham khảo" (L5). Hệ số tải chưa kiểm định. Chỉ làm được cho tàu có VMS.

**5. Bãi của nhóm năng suất cao.** Lấy tàu có `vsPeer` ≥ p75 trong nhóm, tính giờ đánh VMS theo ô × tháng (≥3 tàu), rồi so với ô của cả đội tàu. Đây là ứng viên kênh thứ ba cho lớp cá premium.
- *Thuật toán:* lift giữa hai nhóm theo ô. Kiểm bằng AUCeff giữ-tháng-ra với bộ đo hiện có (`dl-eval-honest`). Chỉ nối khi tăng ≥0,003 trong khoảng tin cậy.
- *Rủi ro:* nhiễu ở chỗ tay nghề và cỡ vốn ("thuyền giỏi", không phải "bãi tốt"). Nhãn kg chia đều theo giờ. Ô nhỏ có thể lộ tàu, nên ngoài sàn ≥3 phải thêm luật **không ô nào chỉ do một chủ tàu chiếm >50 %** (chủ nhiều tàu: `owners.ndjson` có chủ 13–17 tàu).

**6. Lịch mùa loài × cảng cập (Trục 1, Ngư trường).** Câu bà con hỏi: "tháng này tàu về cảng tôi chủ yếu đánh được gì".
- *Dữ liệu:* nhật ký theo cảng cập × loài × tháng. Phải lấy tháng theo **giờ cập của chuyến**, vì `submittedAt` trống 97 %.
- *Rủi ro:* chỉ có 1 năm. 33 % kg không rõ loài. **Sát L1:** nếu đặt ở /tien hoặc dùng để gợi ý bán ở đâu thì vi phạm. Chỉ đặt ở lớp ngư trường, và hỏi anh Long trước.

**7. Số người tiêu biểu.** Có ở 78 % chuyến (p50 4, p90 10). Dùng làm mặc định và kiểm "thiếu người" khi lập sổ thuyền viên trước khi ra bến (biên phòng đối chiếu số người).
- *Rủi ro:* thấp. Không có dữ liệu từng thuyền viên (đúng như README).

**8. Ranh vùng biển.** Vượt ranh chỉ 0,01–0,16 % chuyến, DataLake góp ít. Giá trị nằm ở hàng rào ảo offline theo `vn-maritime-border.ts`; DataLake chỉ để chọn khoảng đệm (p99 khoảng cách của chuyến hợp lệ).
- *Rủi ro:* tuyến hiện có là tuyến cảnh báo, không phải ranh pháp lý. **Không** làm lớp "nơi nhiều tàu đến gần ranh" (nhạy cảm, dễ đọc thành khuyến khích).

**9. Ô hay có tàu hậu cần.** 1.317 tàu nghi hậu cần. Lưới tổng ô × tháng nơi tàu hậu cần hay neo giúp bà con đi xa biết chỗ tiếp dầu, đá, nước.
- *Rủi ro:* ngưỡng chuyển tải hiện quá rộng (19 nghìn tàu dính). Chuyển tải trên biển phải khai báo. Nếu hiểu là "chỗ bán cá trên biển" thì rơi vào **L1**. Cần anh Long chốt "hậu cần ≠ giao dịch".

**10. Dự báo nguồn cung về cảng** (**bị L1 chặn**). Lượt cập theo cảng có CV 0,71/ngày, trăng ±12 % (yếu). Mô hình Poisson theo cảng × thứ × trăng × gió có thể dự báo "mai cảng đông tàu về", rất có giá trị cho thương lượng giá. Nhưng đây đúng là luồng mua–bán, nên **không làm** trừ khi anh Long đổi L1. Thêm nữa, giờ cập khai dồn vào giờ hành chính, phải dùng giờ VMS.

**11. Khớp giờ cập với bên mua, mạng bên mua** (**bị L1 chặn**). Biên nhận cho thấy bốc dỡ diễn ra ngay khi cập (p50 0,04 h), có 220 bên mua, nhưng **không có giá**. SC/CC cho biết thị trường xuất khẩu. Tất cả thuộc Giao dịch, nên **không làm**. Riêng nội dung giáo dục kiểu "cá đi EU cần SC/CC" thì đưa vào Kairos bằng văn bản luật công khai, không cần DataLake.

## 5. Điều kiện tiên quyết và việc nên xin Data Lake

1. **Toạ độ mẻ** (GY-473e65c9). Không có nó thì lớp cá mãi chỉ là "bãi theo mùa".
2. **Thêm năm cũ** (trước 2026), để so mùa giữa các năm (cơ hội 1, 2, 6).
3. **Sức chở tàu và danh sách loài/vùng cấm theo nghề**, để làm điểm tin cậy và nội dung tuân thủ.
4. **Văn bản cho phép dùng dẫn xuất tổng hợp trong sản phẩm thu phí.** Đây là rủi ro pháp lý số 1, đang nằm ngoài tài liệu.
5. **Kéo bù VMS sau 15/09** trước khi chốt mọi ngưỡng về mất tín hiệu.

*Giả định đo:* ngày biển = `vms.seaDays`, thiếu thì `durationHours/24`; chuyến khử trùng theo `code`; năng suất nhóm lấy `segments.kgPerSeaDay` (chưa áp điểm tin cậy v2).
