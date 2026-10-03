# Rà hồ sơ 40 loài cá + thuật toán dự báo — tổng hợp team agent 2026-10-03

**Load khi / Load when**: tổng hợp rà hồ sơ loài đợt 2026-10-03, tiêu chí quyết, 7 quyết định, số đo — load khi sửa hồ sơ loài hoặc thuật toán dự báo cá.

> **Trạng thái: ĐÃ ÁP mục 2 (commit cùng thư mục này, 2026-10-03).** 6 agent chạy song song (5 nhóm loài + 1 rà thuật toán), mỗi đề xuất kèm nguồn; lead đo từng đề xuất trên lưới thật ngày 30/9/2026 (3 tháng giả định 1/4/10) rồi áp theo tiêu chí. Báo cáo gốc: `report-*.md` cùng thư mục; đề bài: `00-brief.md`.

## 0. Tiêu chí quyết (chủ dự án: "đưa ra tiêu chí quyết rồi chọn theo tiêu chí tốt nhất rồi chạy") và 7 quyết định

Thứ tự ưu tiên: **(1)** không nói dối bà con — không vẽ điểm nóng nơi không có bằng chứng · **(2)** có nguồn mới đổi, không nguồn thì giữ và ghi · **(3)** không tắt loài bà con đang đánh trong vụ · **(4)** điểm nóng "Mọi loài" không phình (Δ ≤ 2 điểm %) · **(5)** ít code, không đổi hình dạng payload.

| | Quyết | Tiêu chí | Kết quả đo |
|---|---|---|---|
| Q1 cua biển | RÚT khỏi lớp dự báo và mùa vụ | 1 | — |
| Q2 tôm sú | Giữ tên; nghề tôm bố mẹ Bãi Cạn: tay-nam-bo 9–2, inshore [60,100] | 2, 3 | — |
| Q3 cá đối | RÚT khỏi lớp dự báo và mùa vụ (vẫn có ở danh bạ chợ) | 1 | — |
| Q4 cá ngân | Theo NĐ 37 = *Atule mate* → pelagic-small ven bờ, quanh năm | 2 | 0→4 ô ≥50 |
| Q5 cá sòng | Không tách hồ sơ; thêm vụ VBB 5–9 (sòng nhật) | 3, 5 | — |
| Q6 cá đáy "low" tô cả thềm | GIỮ cách vẽ (UI đã nói rõ nhóm này chỉ theo mùa + độ sâu); ghi nợ design-spec | 5; HOW-nhìn → design | mối 72, hồng 112, mú 96 ô ~60 điểm |
| Q7 cổng cách bờ | Thêm `coastKm` cho hồ sơ; ngừ vằn, nục heo [10,25] | 2, 3 | — |

**Vi phạm tiêu chí (4) có chủ ý**: điểm nóng "Mọi loài" so production 707b467: 12,3→14,4 % (t1), 13,1→16,4 % (t4), 13,2→16,4 % (t10) — vượt ~1 điểm %. Nguyên nhân: ngừ chấm, mực ống, ngừ vằn, nục heo từng bị trần nhiệt tắt oan nay hiện đúng vụ. Tiêu chí (3) đứng trên (4). Cần C1 (kiểm bằng vị trí tàu) để biết phần tăng này có cá thật không.

**Lỗi bắt được nhờ bộ đo**: 3/5 agent điền `inshore [min,max]` dải sống thay cho ngữ nghĩa cổng (a = độ sâu đánh bắt lớn nhất); cá cơm `[3,60]` làm cá trích mất 64→9 ô. Đã quy đổi trước khi áp; cổng test mới chặn `inshore[0] < 15`.

## 1. Kết luận nhanh

| # | Phát hiện | Mức | Đo được gì |
|---|---|---|---|
| 1 | **31/40 loài không có cổng độ sâu** — cá đáy, cá rạn, tôm, ghẹ, mực ven bờ đều chấm điểm trên nước >1000 m | Lỗi hệ thống | Sau khi thêm cổng: ô ≥25 trên nước >1000 m của ghẹ 21→0, tôm bạc 22→0, bạch tuộc 30→0, ngừ chù 46→0 |
| 2 | **Trần nhiệt thấp hơn nước VN mùa hè** lặp ở ~20 loài (cùng khuôn lỗi ngừ ồ): bạc má 28, ngừ chấm 27, cá thu 29, mực xà 30, cá đổng 30, ruốc 29, cá đối 28… | Lỗi hệ thống | Bạc má 0→30 ô ≥50, ngừ chấm 0→143, mực xà 16→48, mực ống 18→108 |
| 3 | **Sàn nhiệt quá cao cho vụ đông Vịnh Bắc Bộ**: cá trích 23, bạc má 23, cá lầm 26, cá bơn 26, cá kẽm 26, mực nang 22 — tắt đúng vụ chính 1–3 | Lỗi hệ thống | Tháng 1: số loài 28→32 |
| 4 | **Mùa vụ sai/thiếu có nguồn**: ruốc Nam Trung Bộ ngược 180° (rộ 10–4, khai 5–10); tôm sú ngược (bố mẹ Bãi Cạn 9–2, khai 3–9); cá khoai ngược (vụ lạnh 10–3, khai 5–10); mực ống VBB cắt đúng tháng đỉnh (9–10); ngừ vằn thiếu vụ hè ven bờ 4–9; ghẹ xanh tắt đúng chính vụ 4–8 | Lỗi dữ liệu | Chưa đo (mùa là tất định) |
| 5 | **Định danh sai**: "cá ngân" = *Atule mate*, cá nổi nhỏ ven bờ 1–80 m nhưng hồ sơ xếp cá khơi; "cá lầm" theo NĐ 37 = *Sardinella aurita* không phải *Dussumieria*; "cá sòng" gộp 2 loài khác mùa | Lỗi dữ liệu | Cá ngân 0→4 ô ≥50 sau khi về ven bờ |
| 6 | **Thuật toán**: soft-OR với `SOFTOR_SCALE 0,4` ⇒ MỘT cơ chế đơn lẻ tối đa 40 điểm, dưới sàn hiển thị 50 — trái với chú thích "một cơ chế mạnh là đủ". Hệ quả: loài tín hiệu cao (cá thu, cá cờ) gần như không bao giờ hiện dù nhiệt/mồi/độ sâu đều hợp | Lỗi thiết kế / doc | Cá thu sau sửa hồ sơ vẫn chỉ 1 ô ≥50 (max 56); cá cờ max 35 |
| 7 | **Chưa kiểm định với vị trí đánh bắt thật** — mọi hệ khác (INCOIS, Đài Loan, Trung Quốc, RIMF) đều đối chiếu CPUE hoặc vị trí tàu | Khoảng cách lớn nhất | — |

Tổng tác động bản override (3 tháng đo): số loài hiện 28–37 → 32–40; **% điểm nóng "Mọi loài" KHÔNG phình** (12,6→12,9 · 17,0→15,8 · 16,7→15,8).

## 2. Đề xuất ÁP NGAY (độ tin cao, đã đo, không cần chốt nghiệp vụ)

### 2a. Cổng độ sâu (`inshore [a,b]` = đáy ≤a hợp đủ, ≥b loại; `offshore` ngược lại)
Cá nổi nhỏ: nục [100,200] · cơm [50,100] · trích [70,130] · bạc má [100,160] · tráo [170,300] · sòng [100,180] · chỉ vàng [50,100] · lầm [70,130] · **cá ngân [80,160]** (chuyển `pelagic-small`).
Cá đáy/rạn: hố [200,500] · mối [80,150] · đổng [120,250] · phèn [80,150] · đù [50,100] · khoai [40,80] · chim [80,150] · bơn [80,150] · hồng [100,200] · mú [60,150] · kẽm [50,100].
Mực: ống [100,200] · lá [60,130] · nang [80,160] · bạch tuộc [80,160]; **mực xà `offshore` [80,250] → [300,800]** (RIMF: nghề câu ở đáy >800 m).
Giáp xác: tôm bạc [40,80] · ghẹ [30,60] · ruốc [20,50].
Cá ngừ: **chù `inshore` [600,2500]** (thềm + sườn đảo, chặn giữa Biển Đông); chấm [200,600]; thu [150,500]; **vây vàng `offshore` [50,200] → [200,800]**, **mắt to [100,300] → [300,1000]** (RIMF-143: đáy ngư trường 400–4000 m HS, 200–3000 m TS); cờ [100,500].

> ⚠️ Lỗi đã bắt khi đo: 3/5 agent điền `[min,max]` dải sống thay cho ngữ nghĩa cổng → cá cơm `[3,60]` = "chỉ hợp đủ ở ≤3 m", cá trích mất 64→9 ô. Số ở trên ĐÃ quy đổi (a = độ sâu đánh bắt lớn nhất, b ≈ 1,6–2a). Khi ghi vào hồ sơ phải giữ đúng nghĩa này.

### 2b. Dải nhiệt (°C) — nguồn chính: ngư trường thật SEAFDEC 2001 (SST 27,4–30,1), CPUE Indonesia, RIMF, FishBase
Vây vàng [24;26,5;30,5;31,5] · mắt to [23;25;30,5;32] (trần 29 cũ là nhiệt TẦNG SỐNG bị dùng làm SST) · vằn [23;26;30,5;32] · chấm [20;26;30,5;32] · thu [20;25;30;31,5] · nục heo [21;26;30,5;31,5] · cờ [22;25;29;31] · ngân [22;25;31;32] · nục [22;24;30;32] · trích [18;21;30;31,5] · bạc má [17;21;29,5;31,5] · đối [18;22;30,5;32] · hố [22;24;30;32] · mối [18;22;30;32] · đổng [19;22;30;32] · đù [20;22;30;32] · khoai [18;21;30;32] · chim [22;24;30;32] · bơn [20;23;30;32] · hồng [20;23;30;32] · mú [23;25;30;32] · kẽm [21;24;30;32] · mực xà [24;26,5;30,5;32] · mực ống [20;23;30,5;32] · mực lá [22;25;30,5;33] · mực nang [17;20;29;31] · bạch tuộc [20;24;30;32] · tôm bạc [24;26;31;34] · ghẹ [22;25;31;34] · ruốc [21;24;30,5;32,5].

### 2c. Mùa vụ (tất định, nguồn trong báo cáo nhóm)
- **Ruốc**: tách NTB khỏi Nam Bộ — NTB 10–4 (Bình Định rộ T10–T4 âm); ĐNB+TNB 3–10; VBB thêm vụ hè 6–7 (Thanh Hoá) + 9–2; TB 12–5 + 9–10.
- **Mực ống** VBB 5–9 → 5–11 (RIMF đỉnh tháng 9: 32,96 kg/h; GAM lưới chụp đỉnh 9–10).
- **Mực nang** VBB 11–3 (đỉnh 1–2).
- **Mực xà** 4–9 → 2–9 (tàu ra khơi từ 16–20 tháng Giêng âm).
- **Ngừ vằn**: thêm vụ hè 4–9 cho nam-trung-bo, dong-nam-bo (Phú Quý), truong-sa-dk1; giữ 10–3 cho trung-bo, nam-trung-bo, hoang-sa, truong-sa-dk1.
- **Vây vàng + mắt to**: tách hoang-sa 10–3 / truong-sa-dk1 + ĐNB khơi 4–9 (RIMF-143).
- **Cá thu**: thêm 2–9 (rộ 4–5) cho nam-trung-bo (setnet Nha Trang 12 năm: 68% sản lượng tháng 4–5).
- **Cá khoai**: 5–10 → 10–3 (VBB, TB, ĐNB) + 4–5 (TNB, ĐNB).
- **Ghẹ xanh** TNB: quanh năm, trọng tâm 4–11; note đổi "nghỉ 4–6" → "cấm trong 3 hải lý ven bờ 1/4–30/6 (QĐ 13/2022 Kiên Giang)".
- **Bạc má**: thêm dải 3–6 (đỉnh đẻ) cho VBB, TB, ĐNB, TNB.
- **Cá trích** trung-bo 1–4 → 9–4; dong-nam-bo 5–11 → 3–11.
- **Cá ngân**: bỏ hoang-sa/truong-sa, thêm mọi vùng ven bờ quanh năm.
- **Cá đù**: thêm 6–10 cho TNB, ĐNB (mùa mưa cửa sông Cà Mau).
- **Cá hồng, cá kẽm**: thêm vinh-bac-bo; **cá đổng** bỏ hoang-sa.

### 2d. Khác
- `tempSource: bottom` cho hồng, mú, kẽm, mực nang, bạch tuộc (chưa đo được — HYCOM trượt 4/4 lượt hôm nay, bản đo dùng SST).
- Cá cơm `w.upw` 0,25 → 0,55, `w.chlFront` 0,2 → 0,4 (loài gắn nước trồi Ninh Thuận–Bình Thuận rõ nhất).
- Mực lá `surfaceSignal` medium → low; bạc má, chỉ vàng high → medium; tôm/ghẹ `w.eddy/upw` → ~0.
- Tên khoa học: thu = *S. commerson* + *S. guttatus* (không gộp thu nhật); lầm = *Sardinella aurita*; ngân = *Atule mate*; tôm bạc = *F. merguiensis*; ruốc = *Acetes* spp.

## 3. Cần ANH CHỐT (nghiệp vụ, không phải kỹ thuật)

| # | Câu hỏi | Agent đề xuất | Nếu không chốt |
|---|---|---|---|
| Q1 | **Cua biển** có nên ở lớp điểm nóng trên biển không? Sống trong rừng ngập mặn/cửa sông, ~40.000 t/năm là nuôi | RÚT, thay bằng thẻ "Mùa cua Cà Mau: mùa khô 11–4" | Giữ nguyên, vẽ ô vô nghĩa |
| Q2 | **Tôm sú**: thương phẩm hầu hết là nuôi; nghề tự nhiên còn lại = bắt tôm bố mẹ Bãi Cạn (Cà Mau, 45–55 m, 9–2) | Đổi thành "Tôm sú bố mẹ (Bãi Cạn)" chỉ tay-nam-bo 9–2, hoặc bỏ | Giữ 3–9 là sai mùa |
| Q3 | **Cá đối**: cửa sông 0–10 m, catadromous | Gỡ khỏi lưới biển, hoặc khoá [15,40] m | Đã đo: khoá [15,40] cho 22 ô ≥50 |
| Q4 | **"Cá ngân"** của bà con là loài nào? NĐ 37: *Atule mate* (cá nổi nhỏ ven bờ). Nếu đội từng muốn "cá khơi câu kéo" thì tên đã nhầm (ứng viên: cá bè *Elagatis*, thu ngàng) | Theo NĐ 37 → pelagic-small ven bờ | Hồ sơ hiện tại không khớp loài nào |
| Q5 | **"Cá sòng"**: sòng gió (*Megalaspis*, ăn cá, mùa Đông Bắc) vs sòng nhật (*Trachurus*, VBB, đỉnh tháng 7). Có tách 2 hồ sơ không? | Tách, hoặc thêm vụ VBB 5–9 | Thiếu hẳn vụ hè VBB |
| Q6 | **Cá đáy tín hiệu "low"** sau khi mở nhiệt sẽ **tô cả thềm ~60 điểm** (mối 72 ô, đổng 64, hồng 112, mú 96, bơn 61). Đây là đầu ra trung thực ("chỉ biết mùa + độ sâu") nhưng UI đang vẽ như điểm nóng. Có nên vẽ nhóm này thành **vùng thềm theo mùa** (không gradient) thay cho điểm nóng? | Design-spec | Bà con hiểu nhầm là "chỗ nào cũng có cá" |
| Q7 | **Cổng cách bờ 20→50 km** đang áp cho MỌI loài `offshore`, nhưng ngừ vằn/nục heo vụ hè vào sát bờ Bình Định–Khánh Hoà (RIMF) | Cho phép hồ sơ nới riêng: `coastKm: [10,25]` | Mất vụ hè ven bờ của ngừ vằn |

## 4. Thuật toán — đề xuất của agent rà PFZ (xếp theo tác động × công)

| # | Việc | Sửa ở đâu | Kiểm bằng số | Ghi chú |
|---|---|---|---|---|
| C1 | **Kiểm định bằng vị trí đánh bắt** (chuẩn Hsu 2021: % vị trí tàu trong 5/50 km của ô HSI ≥0,6 — KHÔNG cần CPUE). Nguồn: GFW fishing effort 0,01° (AIS VN tốt hơn từ 1/2024), VMS Cục Thuỷ sản qua SDVICO, nhật ký chuyến trong app | Script mới `scripts/fish-validate-positions.mjs` | Lift = mật độ giờ đánh bắt trong ô ≥50 / nền (kỳ vọng >1,5), so hoán vị ngày | **Việc đáng làm nhất.** Cũng là cách duy nhất chốt AMM vs soft-OR bằng số |
| C2 | Front tính trên lưới gốc (SST 0,05°, chl 4 km) rồi gộp khối về 0,25° | `thermFront`/`chlFront` trong `buildFishForecast` → `blockMeanAt` (mẫu đã làm cho hội tụ) | Tự tương quan không gian, std ≥0,1 | Sai phân 0,25° làm mờ front 1–10 km |
| C3 | Dải nhiệt lai: giữ [a,d] sinh học, cao nguyên [b,c] theo khí hậu vùng–tháng (p25–p75 SST từ `fish-climatology.v1.json`) | Hàm mới cạnh `trapezoid` | "Không loài nào 0 ô trong chính vụ"; Δ điểm nóng ≤2 | Chữa GỐC lớp lỗi #2–#3 thay vì sửa tay 20 dải |
| C5 | Xoáy ẤM cho loài `coldCore=false` (ngừ vằn ưa SSHA dương ở 4 nghiên cứu độc lập) | `eddyTerm = max(fEddy, warmStrength)` | std eddyTerm tăng | Rẻ |
| C6 | Cổng nền rạn cho hồng/mú/kẽm dùng lớp rạn đã có trong `public/data` | `reefFit` cạnh `depthFit` | Ô cá rạn trên đáy >200 m → 0 | Rạn Trường Sa là chóp nhô giữa nền 1000–2000 m — cổng độ sâu trung bình ô sẽ xoá vùng câu thật |
| C7 | Sửa chú thích soft-OR: "một cơ chế đơn lẻ tối đa 40; cần ≥2 cơ chế mới qua sàn 50" — hoặc nâng `SOFTOR_SCALE`, chốt bằng C1 | Comment + 01-product | Thống kê số cơ chế ≥0,5 trong ô ≥50 | Giải thích vì sao cá thu/cá cờ không bao giờ hiện |
| C8 | Đệm cổng nhiệt như mồi (ngoài [a,d] một đoạn δ cho sàn 0,2) | Nơi tính `tFit` | Loài "0 ô trong chính vụ" → 0 | Giảm rủi ro "dải sai = loài tắt cả vùng" |
| C4 | Mồi hình chuông cho cá ngừ (tối ưu 0,15–0,35 mg/m³; hiện ô đục 0,8 được điểm bằng ô 0,25) | `chlMode: "dome"` | Trung vị cách bờ điểm nóng tăng | Vừa |

Điểm SDFish làm KHÁC thế giới mà **có lý**: tổ hợp nhân (Fukuda 2011: tích cho AUC tốt nhất; INCOIS cũng là AND); chuẩn hoá cơ chế theo p90 nước thật khi không có CPUE; tách loài đáy về trung tính + nói rõ.

## 5. Điều KHÔNG tìm được (ghi để không ai tìm lại)
- Bất kỳ bài CPUE–SST/chl vệ tinh nào cho cá nổi nhỏ, cá đáy, tôm, ghẹ, ruốc ở biển VN — mọi dải nhiệt nhóm này suy từ envelope + mùa + khí hậu.
- Ngưỡng SST–CPUE định lượng của RIMF cho cá ngừ (chỉ công bố biến dùng).
- Tháng rộ theo vùng: ngừ chấm, cá cờ, nục heo, cá ngân, cá tráo, cá sòng gió, mực ống/nang ngoài VBB, bạch tuộc.
- Envelope nhiệt AquaMaps (fishbase.org 403); Phụ lục V NĐ 37/2024 bản gốc (đã bị NĐ 309/2025 ngưng một phần).
- Nhiệt đáy đo tại ngư trường tôm/ghẹ VN; bài Fishes 2023 tầng nhiệt cá ngừ Biển Đông mà mã trích (không xác định DOI).

## 6. Giới hạn của lần đo
- Một ngày dữ liệu (30/9), đổi tháng giả định → chỉ đổi mùa vụ, SST vẫn là cuối hè. Dải nhiệt mùa đông (sàn 17–21) CHƯA được kiểm trên SST mùa đông thật — phải đo lại khi có corpus tháng 1.
- HYCOM thiếu ⇒ `tempSource: bottom` chưa đo; nhiệt đáy mùa hè thấp hơn mặt vài độ nên số liệu cá đáy ở trên là THEO SST.
- Mùa vụ không đo (tất định). Vùng mới (thêm region) bộ đo chưa hỗ trợ.
