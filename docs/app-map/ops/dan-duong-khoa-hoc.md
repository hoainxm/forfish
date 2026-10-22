# Dẫn đường — rà toàn bộ logic + quy trình khoa học làm–chấm–làm (2026-10-22)

**Load khi / Load when**: sửa `route-plan.ts`, `nav-progress.ts`, `use-nav-tracking.ts`, `nav-hazards.ts`, `hazards.ts`, `tides.ts` phần nối tuyến; chạy/đọc bộ chấm `npm run dan-duong:cham`; sửa vòng lặp trên máy GPU (`scripts/dan-duong/vong.sh`).

> Yêu cầu chủ dự án 2026-10-22: *"kiểm tra lại toàn bộ logic về dẫn đường và xác định waypoint… rạn biển… độ sâu an toàn… triều ra vào… tàu cần gì để chạy… tổ chức team agent xây dựng cho nó chuẩn theo đúng phương pháp khoa học, xác định tham số, xác định mô hình, cách chấm điểm, tổ chức làm rồi chấm rồi làm tới đi đạt 90 % các tiêu chí, đưa qua máy GPU chạy phần này cho nó liên tục"* + *"các yếu tố thời tiết, sóng gió, yếu tố lúc đọc được lúc không đọc được"*.

## 0. Kết luận 2 phút

- **Nền tảng tốt, không phải làm lại.** Bộ tìm đường theo VISIR (Dijkstra 16 hướng, chi phí = lít dầu theo giờ đến, Kwon, dòng chảy vector, ràng buộc tĩnh độ sâu 6 lớp + 285 vật chặn, trần đường vòng 1,3, kiểm nghiêm từng cạnh trả về) đã qua 3 đợt review độc lập (06/2026, 07/2026, 09/2026). **Cổng an toàn A: 6/6 đạt** trên bộ chấm mới.
- **Đo được bằng số lần đầu**: `npm run dan-duong:cham` → **35/51 = 69 %** (lần đầu 35/50, thêm B8 sau câu hỏi độ sâu rạn) (mục tiêu ≥ 90 %). Mười lăm chỗ hở xếp thành 5 nhóm (§3). Không chỗ nào là "thuật toán ngu"; đa số là **đầu vào chưa nối** (triều, datum, squat, két dầu, dấu lệch tuyến) và **phần dẫn đường trực tiếp còn mỏng** (lọc GPS, giọng đọc rẽ, dead-reckoning).
- **Câu hỏi rạn "nằm sâu thì không ảnh hưởng"**: hôm nay **không trả lời được bằng dữ liệu** — mọi hình rạn OSM/ACA đều **không có độ sâu**, nên máy coi mọi rạn là chướng ngại (lớp 1, nở 1 km, chặn cứng ngoài 12 km). Đó là lựa chọn an toàn đúng khi không có số; muốn "rạn sâu 30 m thì cho qua" phải có nguồn độ sâu rạn (số đo sâu TBHH / soundings) — việc dữ liệu, không phải việc thuật toán.
- **Triều**: có engine điều hoà 83 trạm (4 đo + 79 mô hình EOT20), **đã nối vào hậu kiểm** (câu "chờ nước lên") nhưng **chưa nối vào luật độ sâu lúc lập tuyến và lúc đang chạy**, và **chưa quy đổi datum** (lưới ETOPO/GEBCO là mực trung bình, triều so số 0 hải đồ). Đây là việc B4/B6 — đáng làm nhất về mặt khoa học.
- **Thời tiết lúc đọc được lúc không**: đã xử lý khá đủ ở lớp tính tuyến (lưới rỗng → theo hải đồ có cờ `noWeatherKm`; thủng một phần → đếm quãng mù; sóng null → ước từ gió; quá cửa sổ → `beyondForecastH`; 429 → `rateLimited`). Lỗ còn lại: **tuyến đã lưu không mang theo nguồn/tuổi dự báo** (C3) và **lúc đang chạy không đọc lại dự báo** (ETA chỉ theo GPS).
- **Vòng lặp trên GPU** (§6): `scripts/dan-duong/vong.sh` chạy trong tmux trên gpu-desktop, mỗi vòng: chấm → chọn tiêu chí hỏng ưu tiên cao nhất → `claude -p` sửa trong thư mục làm việc riêng → `npm test` + chấm lại → tốt hơn thì commit lên nhánh ứng viên `dan-duong/ung-vien-<ngày>` và push → lặp. **Không merge, anh Long duyệt PR.** Dừng khi ≥ 90 % và cổng A sạch.

## 1. Tham số (đầu vào của bài toán)

| Nhóm | Tham số | Nguồn hôm nay | Đơn vị / datum | Ghi chú |
|---|---|---|---|---|
| Tàu | `speedKn` (tốc độ êm) | `forfish.boat.v1` (form lập tuyến), mặc định 7 | hải lý/giờ | kẹp 2–30 |
| | `litersPerHour` | như trên, mặc định 20 | lít/giờ | giả định ga cố định |
| | `draftM` (mớn) | như trên, **mặc định null** | m | null = mọi luật mớn IM (luật 6) |
| | `lengthM` | `boats.ts` (hồ sơ tàu) | m | chỉ dùng cho ngưỡng sóng giọng đọc + vùng VMS; **chưa vào BoatProfile** |
| | két dầu (`fuelTankL`) | `forfish.boat.v1`, mặc định null (D6) | lít | có `fuelReturnCheck`, chưa nối UI; nghề: không có |
| Địa hình | lưới độ sâu 6 lớp | `depth-grid.v1.bin` (ETOPO+GEBCO 15″, min-pool, mặt nạ rạn, bờ vn-coast) | **mực trung bình (MSL)**; lớp, không còn số mét | ô 450 m; 0 đất · 1 rạn · 2 <2 m · 3 2–4 m · 4 4–12 m · 5 ≥12 m |
| | số đo sâu, luồng | `soundings`, `fairway-depth` | **số 0 hải đồ** | chỉ hậu kiểm |
| | rạn | OSM `reef-shapes` (2 622 hình, không độ sâu) → nướng vào lớp 1, nở 1 km (điểm 1,5 km) | — | ACA 5 m chỉ để vẽ + dự báo cá |
| Vật chặn | xác tàu · chướng ngại · giàn khoan · phao hiểm hoạ · lồng bè · vùng cấm vào | TBHH `xac-tau`, `seamarks`, `vn-sea-lanes` (285 vật, 6 vùng) | bán kính km (`HAZARD_R_KM`), ×2 khi tin vừa | trong 5 km quanh hai đầu: chỉ cờ |
| Triều | 33 sóng điều hoà, 83 trạm | `tide-stations.v1.json` | **số 0 hải đồ** (z0 ghi từng trạm) | trạm gần nhất, không nội suy; >120 km không in |
| Thời tiết | sóng (Hs, hướng, chu kỳ), gió, dòng mặt | lưới 0,35° server (`routegrid`), 72 giờ; lùi: lưới Windy đã lưu (~2°, không dòng/chu kỳ); cuối: rỗng | m, °, s, km/h | `source` live/grid/none + `rateLimited` |
| Bão | GDACS polygon + hành lang 200 km | `route-storm.ts` | — | không mốc giờ ⇒ chặn bảo thủ |
| GPS | lat/lon, accuracy, speed, heading, timestamp | `watchPosition` high-accuracy | m, m/s, ° thật | không lọc |

## 2. Mô hình (cách máy quyết định)

```
LẬP TUYẾN  planRouteWithDiagnostics(args)
  lưới ô ≥4 km, ≤7 500 nút, 16 hướng
  legCost(from,to,atHour): mẫu độ sâu mỗi 0,4 km · vật chặn đo điểm→đoạn · thời tiết mỗi ≤12 km
    chặn cứng: đất (ngoài vòng nới 5–12 km) · lớp 1–2 (ngoài 12 km) · lớp 3 trừ khi mớn đã khai và
               mớn+0,5+½min(Hs,3) ≤ 2,0 · vật chặn · vùng cấm · sóng ≥4 m / gió ≥62 km/h (nghiêm)
    tốc độ qua nước = êm × Kwon(Hs, góc sóng) / (1 + cản gió) ; cộng vector dòng chảy
    chi phí = lít dầu × phạt (1,15 cẩn thận · 1,5 không nên đi · 1,2 sóng đuôi ngắn · 1,15 nông · ×6 best-effort)
  Dijkstra MỘT NHÃN/nút (ADR 0003) → kéo căng dây có kiểm chi phí → walk nghiêm lại cả tuyến
  → trần vòng 1,3 (trừ best-effort / cắt đất) → RoutePlan + 14 cờ trung thực
  lượt: nghiêm → best-effort (sóng) → theo hải đồ (thiếu dự báo) → nới cảng trong sông (retry)
HẬU KIỂM  auditRoute: 11 kho + triều tại ETA (hoursAt) + ranh giới → câu đỏ/vàng/tin
ĐANG CHẠY  computeNavProgress: chiếu lên đoạn gần nhất toàn tuyến, nextWp = điểm đầu tiên sau điểm chiếu,
           tới đích ≤0,4 km, lệch tuyến >2 km (mốc 2/5/10/20), ETA = còn lại / tốc độ GPS tức thời
           evaluateNavHazards: ngưỡng vàng/đỏ = max(sàn, v×10′/3′) + sai số GPS; nón ±15°; >150 m hạ, >500 m im
```

**Luật nền tảng (giữ nguyên, có nguồn):** an toàn là RÀNG BUỘC CỨNG, không nhân tử (VISIR, audit 06/2026) · thang KTTV QĐ 18/2021 · Kwon 4 bậc · IMO MSC.1/Circ.1228 sóng đuôi · "vắng số không phải là số" (mớn null) · "nới cho đi, không nới cho im" · "chưa soi ≠ đã soi và sạch".

## 3. Lỗ hổng tìm thấy (bộ chấm 2026-10-22, 15/50 không đạt)

| Nhóm | Mã | Lỗ hổng | Vì sao quan trọng với bà con | Hướng sửa (ngắn) |
|---|---|---|---|---|
| **Độ sâu–triều** | B4 | Triều không vào luật độ sâu lúc lập tuyến | tàu mớn 1,8 m qua bãi 2–4 m được lúc nước lớn, mắc cạn lúc ròng — máy hiện trả lời giống nhau mọi giờ | `PlanArgs.tide?: {h(tMs)}`; lớp 3 xét `need ≤ 2,0 + Δh(ETA)`; KHÔNG đưa vào chi phí (giữ quyết định 09/2026). **ĐÃ SỬA 2026-10-22**: `PlanArgs.tide {z0M, departMs, heightAtMs, reserveM?}` — `legCost` lớp 3 xét `need ≤ 2,0 + (h(ETA) − z0 − reserve)`; số triều hỏng thì về trần tĩnh |
| | B6 | Chưa quy đổi datum MSL ↔ số 0 hải đồ | cộng triều "+1,5 m" vào lưới MSL là cộng thừa z0 (Vũng Tàu 2,9 m!) | `doSauLucT = zMSL + (h(t) − z0)`; trạm model ±0,2 m thêm dự trữ. **ĐÃ SỬA 2026-10-22**: hàm thuần `doSauLucT(zMslM, hTrieuM, z0M) = −zMsl + (h − z0)` ở `hazards.ts` (số hỏng ⇒ NaN); luật lớp 3 trong `route-plan` đã trừ z0 đúng phép này |
| | B5 | Không có squat theo tốc độ | tàu 10 hl ở nước 5 m lún thêm 0,2–0,4 m | Barrass đơn giản `squat ≈ Cb·V²/100` (Cb≈0,6 tàu cá), cộng vào `requiredDepthM(draft, Hs, speedKn)`. **ĐÃ SỬA 2026-10-22**: `squatM(V) = 0,6·(V²−36)/100` khi V > 6 (12 kn ≈ 0,65 m), `requiredDepthM` nhận tham số thứ 3 tuỳ chọn |
| | B8 | Rạn/xác tàu không có độ sâu | xác tàu 31 m giữa biển chặn như rạn nổi; không phân biệt rạn nổi với rạn 30 m | **Kiểm độ sâu rạn trên GPU** `scripts/dan-duong/kiem-do-sau-ran.mjs`: từng hình OSM đối chiếu GEBCO + ETOPO (ODB/ERDDAP) + lớp ACA + số đo sâu → bốn kết luận can/trung/sau/mâu-thuẫn; ứng viên `sau` (≥20 m, hai nguồn khớp, không lớp ACA cạn) đưa anh Long chốt (§7 Q3) rồi mới sinh `reef-depth.v1.json` và nối vào luật chặn. Thử 3 hình đầu 2026-10-22: xác tàu 31/32 m ⇒ `sau`; đá 4/6 m ⇒ `can`; xác tàu trong vùng ACA Reef Flat ⇒ `can` | **ĐÃ SỬA 2026-10-22 (theo đề xuất "chỉ thêm, không bớt", anh Long chốt)**: `public/data/reef-depth.v1.bin` + `lib/reef-depth.ts`; route-plan chặn thêm ô rạn nông hơn nước cần + 1,0 m sai số vệ tinh + 0,8 m ròng, KHÔNG mở mặt nạ lớp 1; tiêu chí B8 viết lại thành đo được (bậc A): rạn 3,5 m chặn, 4,5 m qua với mớn 1,5 m, mặt nạ không mở |
| **Thời tiết** | C3 | RoutePlan không mang nguồn/tuổi dự báo | tuyến đã lưu hôm qua bằng lưới cũ mà mở lại trông như mới | thêm `plan.forecast = {source, savedAt, hours}`; saved-routes lưu kèm. **ĐÃ SỬA 2026-10-22**: `RoutePlan.forecast = {source, savedAt, hours}` lấy từ lưới đã dùng; tuyến nhiều chặng gộp theo phía xấu nhất; saved-routes vẫn CỐ Ý không lưu kết quả tính nên không cần lưu kèm (Assumption) |
| | (live) | Đang chạy không đọc lại dự báo/dòng | ETA theo GPS tức thời, không biết sắp vào dải sóng | dùng `plan.hoursAt` + field đã lưu để nói "còn 2 giờ tới khúc sóng 2,5 m" |
| **Tàu/dầu** | D6 | Hồ sơ tàu rời rạc, không két dầu, không chiều dài | không kiểm "đủ dầu đi và về ×1,3"; vùng VMS theo chiều dài không vào tuyến | gộp `forfish.boat.v1` vào `boats.ts`, thêm `fuelTankL`, `lengthM` · **ĐÃ SỬA 2026-10-22**: `BoatProfile` có `fuelTankL`/`lengthM` (null = chưa khai) + `fuelReturnCheck` đi×2×1,3; chưa nối UI, chưa gộp vào `boats.ts` (Assumption) |
| **Waypoint** | E1 | 6/8 waypoint thẳng hàng (góc 0°) | bà con gõ 8 điểm vào máy định vị thay vì 2 | kéo dây không giới hạn `i+6` khi cạnh thẳng hàng; hoặc lọc góc < 3° sau walk · **ĐÃ SỬA 2026-10-22**: sau kéo dây, bỏ điểm giữa góc rẽ < 3° khi nằm trên cạnh nối (lệch < 0,05 km) và cạnh nối vẫn đi được, không đắt hơn |
| **Dẫn đường trực tiếp** | F5 | Lọc tốc độ/hướng nằm trong hook, không test được; suy tốc độ từ 2 fix không ngưỡng quãng; heading GPS nhận khi speed null | đứng neo mà la bàn quay, tốc độ nhảy 18 km/h vì GPS trôi 5 m | tách `locFix(prev, fix)` thuần: ngưỡng quãng ≥ max(15 m, 2×accuracy), EMA tốc độ τ=20 s, heading chỉ khi v ≥ 0,9 km/h. **ĐÃ SỬA 2026-10-22**: `locFix` trong `use-nav-tracking.ts` (thuần, có test `nav-tracking-loc.test.ts`), hook chỉ gọi hàm này |
| | F3 | XTE không có dấu | không nói được "lái sang phải 1,2 km" | `projectOntoRoute` trả `side` từ tích có hướng · **ĐÃ SỬA 2026-10-22**: `RouteProjection` thêm `signedKm` (dương = bên phải hướng đi) + `side` (`left`/`right`/`on`, `on` khi lệch < 10 m) từ tích có hướng; chưa gắn vào giọng/steerCue (việc F10) |
| | F4 | Chiếu toàn tuyến, không trễ | tuyến vòng về gần chính nó ⇒ "còn X km" nhảy | ưu tiên đoạn hiện tại ± 1, chỉ nhảy khi đoạn khác gần hơn 2× trong 3 fix · **ĐÃ SỬA 2026-10-22**: `projectOntoRoute(pos, wps, hintSeg = 0)` ưu tiên đoạn hintSeg ± 1, chỉ nhảy khi đoạn khác gần dưới 0,4× (`SEG_JUMP_RATIO`); `NavProgress.segIdx` ↔ `NavInput.segHint`, bản đồ giữ ref đoạn fix trước |
| | F6 | ETA tức thời | ETA nhảy theo sóng | trung vị 60 s tốc độ, hoặc trộn với tốc độ kế hoạch · **ĐÃ SỬA 2026-10-22**: `tocDoMuot(prev, mau, t)` ở `nav-progress.ts` — EMA τ=60 s riêng cho ETA (đứng ⇒ null, cách mẫu >3 phút ⇒ lấy mẫu mới); bản đồ giữ ref và đưa tốc độ mượt vào `computeNavProgress`. Chọn EMA thay trung vị (không giữ cửa sổ mẫu), chưa trộn tốc độ kế hoạch (Assumption) |
| | F9 | Không dead-reckoning | mất GPS 1 phút là cảnh báo phía trước đứng im | ước vị trí ≤ 2 phút theo hướng + tốc độ cuối, có nhãn "ước" |
| | F10 | Giọng không đọc rẽ | phải nhìn màn hình lúc lái | đọc "1 phút nữa rẽ phải, hướng Đông Bắc" từ `nextWp` + `steer` |
| **Oracle** | D4 | Chưa đo sai số rời rạc hoá | chưa biết lưới 4 km mất bao nhiêu dầu so lưới 1 km | oracle lưới mịn chạy trên GPU |
| | D5 | Chưa đo sai số một-nhãn (ADR 0003) | ADR nói "xét lại khi có số" — chưa có số | oracle (nút, khung giờ) trên lưới thời tiết thật lưu lại |
| | H5 | Chưa có tuyến chuẩn người duyệt | mọi tiêu chí đều do máy tự đặt | 10–20 tuyến quen anh Long/thuyền trưởng vẽ tay; so Fréchet |

**Đã kiểm và ĐÚNG (không sửa):** chặn đất/rạn/vật/vùng cấm (A1–A5), né dải sóng theo giờ đến (A6, C6), lưới rỗng/thủng/429 (C1, C2), ước sóng từ gió (C5), quá cửa sổ (C4), best-effort có cờ (C7), Kwon + dòng chảy (D1, D2), trần vòng (D3), hoursAt nhất quán (E2), pass-by + đi tắt (F2), ngưỡng live theo tốc độ + GPS (F7), mất GPS 10/60 s (F8), cờ trung thực (G1–G4), 12 tuyến thật ra tuyến, không xuyên đảo, trung vị 6 ms (H1–H4).

## 4. Cách chấm (giao thức)

- **Một tiêu chí = một `it`** trong `scripts/dan-duong/tieu-chi.cham.ts`, ra `{id, bậc, điểm 0–100, đạt, số đo thô, ghi}`. Không ném; bảng ghi ra `.dan-duong/bang-diem.{json,md}` (ngoài git).
- **Sự thật biết trước**: lưới độ sâu TỔNG HỢP (toàn lớp 5, tô đảo/rạn/dải cạn đúng chỗ), trường thời tiết TỔNG HỢP (dải sóng theo giờ, lưới thủng, rỗng), vật chặn cắm sẵn; cộng lưới ĐỘ SÂU THẬT + kho vật chặn THẬT cho 12 tuyến hồi quy. Không dùng mạng.
- **Ba bậc**: **A** = cổng cứng an toàn (phải đạt 100 %, bất kể tỉ lệ) · **B** = quan trọng · **C** = chất lượng. **Qua cổng** = tỉ lệ đạt ≥ 90 % **và** mọi A đạt.
- **`chua-do`** = tiêu chí có định nghĩa nhưng chưa có đường đo/oracle — **tính là không đạt** để vòng lặp phải dựng oracle, không được xoá tiêu chí cho đẹp số. Mọi tiêu chí đều ĐO ĐƯỢC từ code (gọi hàm/đọc file kết quả) — không có tiêu chí "hard-code 0" (vòng 0 trên GPU 2026-10-22 trượt B4 vì lỗi này, đã sửa). `canNguoi` = cần anh Long chốt, vòng máy không tự chọn (H5, B8).
- **Cấm "dạy tủ"**: tiêu chí chỉ được đổi khi (a) phát hiện tiêu chí sai so với nghiệp vụ (ghi lý do vào §3 cùng commit), hoặc (b) thêm tiêu chí mới. Hạ ngưỡng để qua = không hợp lệ. Vòng lặp (§6) **không được sửa file `tieu-chi.cham.ts` và `khung.ts`** trừ khi thêm tiêu chí.
- **Thước đo nghiệp vụ** (H5, khi có tuyến chuẩn): khoảng cách Fréchet rời rạc tuyến máy ↔ tuyến người ≤ 3 km và chênh km ≤ 10 %.

## 5. Mô hình đích sau vòng lặp (để agent biết đang đi về đâu)

1. `requiredDepthM(draftM, waveM, speedKn?)` = mớn + 0,5 + ½·min(Hs,3) + squat(V) — một bản, ở `hazards.ts`; squat Barrass `Cb·(V²−6²)/100` với Cb 0,6, V hải lý/giờ, chỉ cộng phần vượt 6 (Barrass nguyên bản cho 0,86 m ở 12 kn, vượt trần 0,8 của B5) (B5 đòi chênh 6→12 kn trong 0,15–0,8 m).
2. `doSauLucT(zMslM, hTrieuM, z0M) = −zMslM − (hTrieuM − z0M)`… viết đúng dấu: độ sâu nước lúc t = (độ sâu dưới MSL) + (h(t) − z0) với h, z0 cùng so số 0 hải đồ — ở `hazards.ts` (B6 kiểm `doSauLucT(-3, 1.0, 2.887) ≈ 1,113`).
3. `PlanArgs.tide?: { z0M: number; departMs: number; heightAtMs(ms: number): number }` — lớp 3 xét `need ≤ DRAFT_SHALLOW_MAX_NEED_M + (h(ETA) − z0)`; ETA = departMs + giờ cộng dồn tới mẫu; **không** vào chi phí (quyết định 09/2026); trạm `model` cộng dự trữ 0,2 m (B4).
4. `RoutePlan.forecast = { source, savedAt, hoursCovered }` đi theo tuyến lưu (C3).
5. `BoatProfile` += `lengthM`, `fuelTankL`; kiểm `fuelL × 1,3 ≤ fuelTankL` thành cờ `fuelShort`.
6. Waypoint: sau walk, gộp điểm có góc rẽ < 3°; giữ `hoursAt` tương ứng.
7. Live: `locFix()` thuần (export từ `use-nav-tracking.ts`) (ngưỡng quãng theo accuracy, EMA tốc độ, heading khi chạy), `projectOntoRoute(pos, wps, prevSeg?)` có trễ + `side`, `etaMuot` trung vị 60 s, `uocViTri()` dead-reckoning ≤ 2 phút, giọng đọc rẽ.
8. Oracle offline: `scripts/dan-duong/oracle-luoi-min.ts`, `oracle-nut-gio.ts` ghi `.dan-duong/oracle-*.json {chenhDauPhanTram, soTuyen}` (D4/D5 đọc file này); nếu D5 > 5 % thì mở lại ADR 0003.

## 6. Tổ chức team agent + vòng lặp trên máy GPU

```
                 ┌──────────────── anh Long (duyệt PR, chốt nghiệp vụ H5, B5 hệ số) ────────────────┐
                 │                                                                                   │
gpu-desktop (WSL, tmux `dan-duong`)  scripts/dan-duong/vong.sh — lặp vô hạn, nghỉ NGHI_PHUT giữa vòng
  1. fetch nhánh gốc (DD_NHANH, mặc định main) → export sạch vào ~/.local/forlife/train/dan-duong/goc (không đụng clone khác)
  2. npm ci (cache theo lockfile) → npm run dan-duong:cham → bang-diem.json
  3. qua cổng? ⇒ ghi nhật ký, ngủ 6 giờ, lặp (để bắt hồi quy khi main đổi)
  4. chọn 1 tiêu chí hỏng theo ưu tiên A > B > C, rồi theo thứ tự ở §3 → viết brief (prompt-sua.md + số đo thô)
  5. `claude -p` (Sonnet mặc định — việc có cổng số; Opus khi 2 lần Sonnet không qua) sửa trong goc/, luật:
       KHÔNG sửa tieu-chi.cham.ts / khung.ts · update doc app-map cùng commit (invariant) · npm test xanh · tiếng Việt đời thường
  6. npm test + chấm lại: tỉ lệ TĂNG và cổng A không hỏng ⇒ commit "feat(dẫn đường): <mã> …" lên nhánh dan-duong/ung-vien-<ngày>, push origin
     không tăng ⇒ reset, ghi "trượt", đổi model/đổi tiêu chí lần sau
  7. ≥ 90 % + A sạch ⇒ mở PR (gh có thì gh, không thì in link compare) → dừng sửa, chỉ còn chấm hồi quy
Nhật ký: ~/.local/forlife/train/dan-duong/nhat-ky/<ngày>.log · mỗi vòng một dòng JSON trong lich-su.jsonl
```

- **Vai trò**: lead (phiên Mac, Fable) = thiết kế + đọc kết quả + quyết đổi tiêu chí; thợ (claude -p trên GPU) = sửa đúng một tiêu chí mỗi vòng; giám khảo = `tieu-chi.cham.ts` (máy, không LLM); người = duyệt PR.
- **Vì sao một tiêu chí mỗi vòng**: diff nhỏ, người duyệt đọc nổi; trượt thì biết do đâu; cổng A chạy lại mỗi vòng nên không có "sửa F3 làm hỏng A2" lọt.
- **Chỗ chạy**: WSL tmux như vòng Sen Biển (`sen-bien-dem`) — việc không người trông, cần chạy đêm không ngủ máy. Thư mục làm việc riêng `~/.local/forlife/train/dan-duong/`, **không** đụng `~/ForFish` hay `C:\Code\ForFish`. Luật "WSL chỉ train" (2026-10-19): đây là vòng tự động không người ngồi, xếp cùng nhóm với vòng train — nếu anh Long muốn nó chạy phía Windows thì chỉ đổi `W=` trong `vong.sh`.
- **Chi phí**: mỗi vòng 1 lượt `claude -p` (~5–15 phút, vài trăm nghìn token); trần `DD_TOI_DA_VONG_NGAY` (mặc định 12) để không đốt gói.
- **Mặt nạ tin cậy GEBCO TID** (research/do-sau-day-bien-team §3 #1, không cần chốt): `scripts/dan-duong/tid-vn.py` chạy trên GPU trong venv rasterio → `depth-tid-vn.1bit` (1 bit/ô 15″, khung 102–118°Đ/5–23°B) + `tid-vn.stats.json`; bước kế: đóng gói `public/data/depth-tid.v1.bin` + cờ `depthGuessed` trong `route-plan` (tiêu chí B9 — thêm khi dữ liệu có).
- **Việc độ sâu rạn (một lần, chạy song song vòng lặp)**: tmux `kiem-do-sau` trên GPU chạy `kiem-do-sau-ran.mjs` cho 2 622 hình (~40 phút, cache từng hình, chạy lại nối tiếp). Kết quả `~/.local/forlife/train/dan-duong/kiem-do-sau/ra/kiem-do-sau-ran.md` — lead đọc, anh Long chốt Q3, rồi mới sinh dữ liệu và sửa luật (B8).
- **Khởi động**: `ssh gpu-desktop` → `bash scripts/dan-duong/cai-gpu.sh` (chép script, tạo tmux). Xem: `tmux attach -t =dan-duong` · `tail -f ~/.local/forlife/train/dan-duong/nhat-ky/$(date +%F).log`.

## 7. Câu hỏi cần anh Long chốt (nghiệp vụ)

| # | Câu hỏi | Mặc định nếu không chốt |
|---|---|---|
| Q1 | Hệ số squat tàu cá (Cb) và có cộng vào nước cần không | có, Cb = 0,6, chỉ khi `speedKn` > 6 |
| Q2 | Trạm triều mô hình (EOT20) có được dùng để MỞ dải 2–4 m không, hay chỉ để ĐÓNG | chỉ để ĐÓNG (an toàn một chiều); mở chỉ với 4 trạm đo trong 60 km |
| Q3 | Rạn không có độ sâu: giữ chặn cứng, hay cho qua khi nguồn ĐO (ATL24/ACA) gần đó ≥ 20 m. **Không hạ chỉ vì GEBCO/ETOPO nói sâu** — GEBCO TID đo 2026-10-22: dải 0–50 m ven bờ chỉ 11 % ô đo thật, Vịnh Bắc Bộ 1–3 % ([research/do-sau-day-bien-team-2026-10-22](../../research/do-sau-day-bien-team-2026-10-22.md)) | giữ chặn |
| Q6 | **CHỐT 2026-10-22 (anh Long)**: DÙNG số liệu ba bộ 10 m (HHU24SWDSCS, SCSBathy10, LGMM-SDB) cho rạn Hoàng Sa/Trường Sa, **đổi toàn bộ tên sang tiếng Việt**, ghi nguồn CC BY. Đường ống: `scripts/dan-duong/ran-10m/` (tai.sh → chi-muc.py → ten-viet.mjs ghép tên theo TOẠ ĐỘ với `coral-reefs.v1.json` + bảng tra `ten-ran-bien-dong.json`; dòng `can-nguoi` không vào sản phẩm). ⚠️ Trước khi PHÁT HÀNH lớp này phải soát QĐ 562/QĐ-TTg (địa hình đáy biển đảo/bãi ngầm có thể thuộc danh mục bí mật nhà nước — báo cáo D §1) — dữ liệu nguồn là công bố quốc tế CC BY, nhưng việc ForFish phát hành lại là chuyện pháp lý riêng | — |
| Q7–Q9 | Tài khoản Earthdata/ACA · email ENC phi-SOLAS · hồ sơ pháp lý lớp độ sâu cộng đồng — research/do-sau-day-bien-team §4 | chờ · chờ · chưa |
| Q4 | 10–20 tuyến quen để làm tuyến chuẩn (H5) — ai vẽ | chờ; H5 đứng ở "chưa đo" |
| Q5 | Vòng GPU chạy WSL (như Sen Biển) hay phía Windows | WSL tmux |

## Assumptions

- Bộ chấm dùng trường thời tiết tổng hợp 10×10 mắt (0,32°) — gần độ mịn lưới server 0,35°; dải thử rộng ≥ 0,2° để chắc chắn trúng ít nhất một mắt.
- "Đạt" mặc định = điểm ≥ 90; tiêu chí nhị phân ra 0/100.
- 12 tuyến thật là tập hồi quy do lead chọn (6 từ bench cũ + 6 cảng khác); không thay cho tuyến chuẩn người duyệt.

## Assumptions (C3, 2026-10-22)

- `RoutePlan.forecast` luôn có mặt (kể cả lưới 'none'): `source` mặc định 'live' khi lưới không ghi nguồn; `savedAt` chỉ khác null khi 'grid' có mốc lưu; `hours` = cửa sổ dài nhất có số (0 khi rỗng). UI chưa đọc trường này — chỉ dữ liệu; câu chữ "tính bằng lưới cũ" để vòng UI sau.
- Tuyến nhiều chặng gộp theo phía xấu: nguồn kém nhất (none > grid > live), `savedAt` cũ nhất, `hours` ngắn nhất. Đường lưu (`saved-routes`) vẫn không cất kết quả tính, nên mở lại luôn tính lại bằng dự báo hôm nay.

## Assumptions (B4, 2026-10-22)
- `PlanArgs.tide` chưa có chỗ gọi trong UI (route-planner chưa truyền) nên app chạy như cũ tới khi nối nguồn `tides.ts`; hàm không clone được sang worker, nối phải ở luồng chính. Mặc định an toàn: vắng/hỏng thì dùng trần tĩnh 2,0 m.
- ETA mẫu = `departMs + (atHour − departHourIdx + quãng/tốc độ êm) giờ`; triều chỉ mở/đóng lớp 3, không vào chi phí (quyết định 09/2026).

## Assumptions (F5, 2026-10-22)

- Dịch gần hơn max(15 m, 2×sai số) giữa 2 fix không có số tốc độ của máy ⇒ coi là đứng (mẫu 0), không ra tốc độ; mẫu suy > 74 km/h bị bỏ (giữ tốc độ cũ).
- Tốc độ làm mượt EMA τ=20 s; tốc độ làm mượt < 0,9 km/h ⇒ `speedKmh = null`. Hướng la bàn của máy chỉ nhận khi tàu đang chạy (trước đây nhận cả khi không có số tốc độ).

## Assumptions (E1, 2026-10-22)

- Điểm giữa chỉ bị bỏ khi góc rẽ < 3°, tổng hai cạnh dài hơn cạnh nối < 0,05 km, cạnh nối đi được ở chế độ nghiêm và chi phí không quá 1,001× hai cạnh cũ — chọn thận trọng để không cắt góc sát rạn (A2).

## Assumptions (D6, 2026-10-22)

- `BoatProfile` (route-plan.ts) có thêm `fuelTankL` (két, lít) và `lengthM` (m), cùng luật với mớn: vắng/`null` = chưa khai ⇒ im lặng, không đoán. Trần hợp lệ: két ≤ 100 000 L, chiều dài ≤ 200 m.
- `fuelReturnCheck(boat, oneWayFuelL)`: dầu cần = một chiều × 2 × 1,3 (`FUEL_RETURN_SAFETY`); chưa có két ⇒ `null`. Hàm thuần, CHƯA nối vào màn kết quả và CHƯA có ô nhập két/chiều dài trong form lập tuyến — `route-planner` chỉ đọc/giữ nguyên hai trường khi lưu `forfish.boat.v1`. Nối UI khi anh Long chốt chữ hiển thị (§7).
- Chưa gộp `forfish.boat.v1` vào `boats.ts` (đổi nơi lưu = đụng sao lưu/auth-scope); chiều dài vẫn đọc từ `boats.ts` cho giọng đọc/VMS.

## Assumptions (F4, 2026-10-22)

- Ngưỡng nhảy là 0,4× (đoạn khác phải gần hơn 2,5 lần), chặt hơn "2×" trong hướng sửa, vì bộ chấm đặt tàu đúng ở tỉ lệ 2,0 giữa hai nhánh. Chưa làm "3 fix liên tiếp": gần-hơn-hẳn đã đủ chống nhảy, thêm bộ đếm là thêm trạng thái trong hook.
- Không có gợi ý ⇒ coi tàu đang ở đầu tuyến (đoạn 0 ± 1); tàu ở xa đầu tuyến vẫn nhảy được vì đoạn gần nó gần hơn hẳn. Gợi ý lưu trong ref của bản đồ, mất khi tắt dẫn đường.

## Assumptions (B5, 2026-10-22)

- Squat = Cb·(V²−6²)/100, Cb 0,6, chỉ phần vượt 6 hải lý/giờ (dưới đó đã nằm trong 0,5 m hở đáy). Lý do: Barrass nguyên bản 12 kn = 0,86 m, quá trần 0,8 m của B5 và quá lớn cho tàu cá.
- Chưa nối tốc độ vào các nơi gọi (`route-plan`, `route-hazards`, bản đồ): không truyền `speedKn` thì squat = 0, hành vi cũ giữ nguyên. Nối khi anh Long chốt tốc độ nào tính (tốc độ kinh tế hay tốc độ thật).
