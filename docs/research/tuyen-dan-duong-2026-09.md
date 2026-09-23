# Hồ sơ: đưa kho hải đồ vào TÍNH TUYẾN và DẪN ĐƯỜNG (2026-09-04)

> Chủ dự án 2026-09-04: *"xem lại chỗ thuật toán tính đường và dẫn đường, bây giờ đã có info nhiều hơn về phao đèn vật cản bãi ngầm rạn độ sâu các kiểu, đưa hết vô thuật toán tính đường và dẫn đường, cảnh báo khi đến gần các chướng ngại, làm toàn diện"* — tổ chức team agent: nghiên cứu → đề xuất → phản biện → kế hoạch → code → đánh giá → chạy thử.

Quy trình đã chạy: 2 agent kiểm kê (thuật toán tuyến · dẫn đường + API 20 kho) → 2 nhóm đề xuất độc lập (A: VISIR/nghiệp vụ hàng hải · B: sản phẩm mobile/offline/an toàn) → 1 phản biện độc lập chấm 12 tiêu chí (A 33 / B 44) → điều phối chốt → 5 agent code theo đợt không chồng file.

## 1. Hiện trạng trước khi sửa (kiểm kê, có trích dòng)

- `planRoute` (`src/lib/route-plan.ts`): lưới đều ≥4 km, trần 7.500 nút, 16 hướng, **Dijkstra time-dependent xấp xỉ**, chi phí = **lít dầu**; chặn cứng sóng ≥4 m / gió ≥62 km/h / đất ngoài 5 km / rất cạn ngoài 12 km; phạt mềm 1,15–1,5; kéo căng dây có kiểm chi phí; trần vòng 1,3; ~120k lượt `legCost`, 3–4 s máy yếu, chạy trong Web Worker.
- Ràng buộc tĩnh chỉ có **lưới độ sâu 2 bit** (ETOPO+GEBCO+mặt nạ rạn OSM) và **bão** (200 km). Geofence KHÔNG dùng khi tính tuyến.
- **13 kho hải đồ có trong máy nhưng thuật toán không đọc**: xác tàu, giàn khoan, vùng cấm, cáp/ống, phao/tiêu (5.851 + 1.447), đèn biển, số đo sâu chính thức (394), độ sâu luồng (22 đoạn), bãi cạn có tên (1.372), thuỷ triều (11 trạm), khu trú bão (51), chất đáy, địa danh ngầm. `boat.draftM` được nhập nhưng **không dòng nào đọc**.
- Dẫn đường live chỉ có 2 cảnh báo: lệch tuyến (2/5/10/20 km) và ranh giới VMS (15/10/6/3 hl). **Không có cảnh báo chướng ngại/độ sâu phía trước.**
- `src/lib/spatial-index.ts` (lưới ô CSR, `queryCorridor` trả `alongKm`, 24 test) đã viết xong nhưng **chưa nơi nào dùng**.

## 2. Phát hiện khi đo (bench mới `src/lib/__tests__/route-bench.test.ts`, `BENCH=1`)

**Lưới độ sâu gọi NƯỚC là ĐẤT ở cửa lạch bùn.** Dò dọc đường thẳng từ Rạch Giá: lớp 0 ("đất", z > −2 m) ở km 8–12 ngoài khơi; đối chiếu `vn-coast.v1.json` thì 4 điểm đó đều KHÔNG nằm trong đa giác bờ. Mẫu 0,1° toàn vùng: **257/19.865 ô nước bị gán đất** (vịnh Bắc Bộ 3,7 %, Đông Nam 1,3 %). Hệ quả: **Rạch Giá → Côn Đảo không tính được tuyến nào** (kể cả nới khung 200 km), vì `classify` trộn "đất" với "nước nông <2 m ở mực trung bình".

Thêm: mọi tuyến xuất phát từ cảng đều bật cờ `hasNearLandLeg`/`hasVeryShallowLeg` (do luật nới 5/12 km "nới cho đi nhưng phải cắm cờ") ⇒ hai mục ĐỎ trên thẻ tuyến gần như luôn hiện, mất giá trị phân biệt.

## 3. Quyết định chốt (điều phối, sau phản biện)

| # | Chốt | Lý do |
|---|---|---|
| 1 | Hiểm hoạ vào Dijkstra bằng **chỉ mục theo đoạn** (`anyWithinSegment`, đo điểm→đoạn), KHÔNG raster overlay | Overlay đọc tại mẫu 2 km làm vòng 300–930 m lọt khe; overlay khung 420 km = 6,4–10,9 M ô, clone MB vào worker đúng chỗ OS từng giết worker |
| 2 | **Triều KHÔNG vào Dijkstra**, chỉ hậu kiểm tại ETA | Đồ thị thành non-FIFO và không có nước đi "đợi" ⇒ máy trả đường vòng thay vì câu đúng "chờ nước lên" |
| 3 | Ranh giới VMS: **không phạt, không chặn**, chỉ cờ + câu | Luật "an toàn = ràng buộc cứng, không nhân tử"; app không kết tội ai |
| 4 | **Chặn cứng**: xác tàu/chướng ngại (r = max(bán kính TBHH, 500 m), ×2 khi tin vừa), giàn khoan 1 km, phao hiểm hoạ cô lập 300 m, lồng bè 200 m, vùng cấm-vào (đệm 500 m — xem ghi chú §7 về cỡ vùng). Trong 5 km quanh hai đầu → hạ thành cờ | Vòng 500 m quanh công trình là luật; `direct` đi qua cùng `legCost` nên nhánh "trần vòng" không thể trả đường thẳng xuyên xác tàu |
| 5 | **Chỉ hậu kiểm/cảnh báo**: cáp, ống, cấm neo/đánh bắt, luồng, phao thường, đèn, số đo sâu, bãi cạn có tên, ranh giới | Cáp cấm NEO chứ không cấm chạy qua; COLREG 9/10: tàu cá không ưu tiên luồng |
| 6 | **Không dùng**: chất đáy, hình rạn ACA 8 MB, địa danh ngầm, soundings-cangvu | Rạn đã nướng vào lưới; đọc 8 MB vào RAM là ca máy 2 GB bị giết |
| 7 | **Lưới độ sâu sinh lại 4 bit** cùng đường dẫn: 0 đất (trong đa giác bờ HOẶC cả hai mô hình nói z > 0) · 1 mặt nạ rạn/đá/xác · 2 nước <2 m · 3 **2–4 m** · 4 4–12 m · 5 sâu | Tách "đất" khỏi "nước rất nông"; dải 2–4 m là chỗ tàu mớn 1–2 m làm nghề hằng ngày |
| 8 | Dải 2–4 m **chỉ mở khi khai mớn** và `mớn + 0,5 + ½·min(Hs,3) ≤ 2,0 m`; chưa khai mớn thì đóng | Luật "vắng số không phải là số" — không đoán mớn trung bình rồi vẽ tuyến qua chỗ 2 m |
| 9 | Live: ngưỡng = `max(sàn, tốc độ × phút) + sai số GPS`; vàng 10 phút/2 km, đỏ 3 phút/500 m; 4 bậc; mỗi vật ≤2 lần; chuông ≤1/20 s; im khi neo >5 phút; GPS >150 m hạ đỏ→vàng, >500 m im | Tàu 4 hl và 10 hl khác nhau 2,5 lần thời gian phản ứng; chuông kêu vì phao là dạy tai coi thường chuông xác tàu |
| 10 | Chỉ mục: tuyến — lọc bbox ở main → mảng số phẳng → dựng trong worker; live — dựng 1 lần lúc bật dẫn đường, main thread | `PosFn` không clone được; worker chết không `onerror` = mất cảnh báo tính mạng trong im lặng |

**Không làm**: tự tính lại tuyến, giọng đọc, heading-up, lọc Kalman, push nền, đổi mốc lệch tuyến/ranh giới cũ.

## 4. Kết quả đo sau Đợt 0 (lưới 4 bit)

Lưới sinh lại từ nguồn thật (ETOPO `.dods` 38 băng + GEBCO 90/90 ô, phủ 100 %, 227 s), file 8,53 MB cùng đường dẫn — **qua sóng chỉ ~0,14 MB** (gzip 0,14 / Brotli 0,13 MB, đo 2026-09-04; Vercel nén sẵn), nên KHÔNG đáng đổi định dạng lưu để "bớt MB": cái nặng là 8,5 MB trong kho service worker của máy, không phải lượt tải.

| Đổi lớp | Số ô |
|---|---|
| "đất" → nước <2 m | **74.904** |
| rất cạn → dải 2–4 m tách ra | **49.428** |
| nước → đất (đa giác bờ giản lược, lớn nhất là phá Tam Giang) | 6.473 |

| Tuyến | trước | sau | ghi chú |
|---|---|---|---|
| Rạch Giá → nam Côn Đảo, chưa khai mớn | không có tuyến | không có tuyến | đúng luật 6 |
| Rạch Giá → nam Côn Đảo, **mớn 1,2 m** | — | **414 km, 35 ms** | mở được, vòng mũi Cà Mau |
| Vũng Tàu → Côn Đảo | 26 ms | 9 ms | hình tuyến không đổi |
| Nha Trang → Trường Sa Lớn | 32 ms | 35 ms | ×1,01 chim bay |

Cổng "nước bị coi là đất" (dải 102–110°Đ): 1,61 % → **0,79 %**. Phần dư là đảo thật mà `vn-coast` giản lược đã cắt (Hạ Long, Côn Đảo, Cù Lao Chàm) và bờ nước ngoài — muốn thấp hơn phải bổ sung đảo vào đường bờ, việc riêng.

## 5. Số từ dữ liệu thật (2026-09)

285 vật chặn **khi chưa khai mớn** (284 khi đã khai: một xác tàu có "nước trên vật" ≥ mức tàu cần chuyển sang `passable`, chỉ đưa tin): xác tàu 36 · chướng ngại 7 · giàn khoan 41 · phao hiểm hoạ cô lập 65 · lồng bè 136 · 1 vùng cấm-vào dạng Polygon (16 đỉnh) + **5 ranh cấm-vào dạng đường HỞ** (gộp thành **1 nhãn** sau khi khử trùng tên — con số "1" ghi ở bản trước là số nhãn, không phải số ranh). 15/43 xác tàu bị đánh "tin vừa" (vị trí theo phao hoặc tin >3 năm) nên nới vòng ×2.

Hiệu năng: `anyWithinSegment` 120.000 chặng × 285 vật = **53 ms** (0,44 µs/chặng); `auditRoute` Vũng Tàu→Côn Đảo đủ 11 kho = **20,7 ms**; `evaluateNavHazards` **0,035 ms/fix** (trần 2 ms).

## 6. Việc còn mở / cần chủ dự án chốt

1. Tàu **chưa khai mớn** có được vẽ tuyến qua dải 2–4 m không (mặc định: KHÔNG, hiện lời mời khai mớn).
2. Công thức nước cần: mớn + 0,5 m + ½ chiều cao sóng (trần 3 m) — con số kỹ thuật, chưa có nguồn VN.
3. Mốc cảnh báo live 10 phút / 3 phút, sàn 2 km / 500 m; giàn 1 km; xác tàu 500 m; phao cô lập 300 m.
4. Xác tàu tin cũ >3 năm: chặn với vòng ×2 (mặc định) hay chỉ cảnh báo.
5. Gộp hai mục đỏ "Bãi rất cạn"/"Đè lên bờ" ở cảng thành một dòng vàng (mặc định: có).
6. Luồng có độ sâu khống chế: chỉ đưa tin (mặc định) hay ưu tiên đi trong luồng.
7. Rung cho cảnh báo tài sản/lưới — mặc định bật, tắt được trong HUD.
8. Bổ sung đảo vào `vn-coast.v1.json` để hạ nốt 0,79 % ô nước bị coi là đất.

## 7. Bản vá sau review đợt 4 (2026-09-04)

| # | Chỗ hỏng | Sửa |
|---|---|---|
| C1 | **Vùng cấm vào lọt khe mẫu.** `legCost` kiểm điểm-trong-đa-giác tại mẫu **2 km**, mà đa giác `cam-vao` duy nhất trong kho rộng **0,2 × 0,2 km** ⇒ chỉ bắt được ~10 % số lần chặng cắt qua; "đệm 500 m" chốt ở §3 hàng 4 thì mới chỉ nới HỘP LỌC, chưa hề nới phép quyết định | Vùng có đường chéo hộp bao **≤ bước mẫu** quy về **vật điểm** (tâm hộp bao, `rKm` = bán kính ngoại tiếp + 500 m), đi chung `anyWithinSegment` — đo điểm→đoạn nên hết khe, và đệm 500 m ở nhánh này là đệm THẬT. Vùng lớn giữ đường cũ; ở đó đệm vẫn chỉ là hộp lọc, dải sát ranh do `auditRoute` gọi tên. **Trần còn lại** (marker nợ trong mã): dải hẹp-mà-dài (300 m × 30 km) vẫn lọt — kho chưa có hình nào như vậy; nâng cấp bằng `buildSegmentIndex` trên cạnh vùng. Đo lại: 6 tuyến bench **không đổi một km nào**, tỉ lệ ×1,08–1,12 (trần 1,15) |
| N1 | Hậu kiểm ném ⇒ thẻ đặt `audit = null`, mà `null` đọc ra y hệt "đã soi và sạch" ⇒ thẻ IM | `catch` để lại `{hits: [], missing: […, "hau-kiem"]}`; thêm tên tiếng Việt cho mã đó |
| N2 | `NAV_QUERY_KM` cứng 3,7 km, trong khi ngưỡng vàng chạy theo tốc độ ⇒ tàu trên ~12 hl/h bị hỏi thiếu tầm, mốc 10 phút tụt còn ~6,7 phút | `navQueryKm(thr) = max(3,7 km, thr + 1,5 km)`; biên 1,5 km = vòng chặn lớn nhất trong kho + một ô lưới, vì ngưỡng đo tới MÉP còn chỉ mục tra theo TÂM |
| N3 | Mất GPS thì không còn fix nào gọi bộ não ⇒ hạn giữ câu 10 phút không bao giờ tới, câu đỏ đứng vô hạn | `NAV_LOST_TICK_MS` 30 s: interval đánh thức, CHỈ khi `status !== "tracking"` |
| N4 | `await` chín kho đứng trước vòng nở khung ⇒ nút "Tính đường" có thể đứng thêm 20 s | `Promise.race` trần **5 s**; hết giờ thì tính ngay với `hazards: null` và gọi tên kho vắng |
| N5 | `scripts/verify-soundings.mjs` còn giải mã **2 bit/ô** trên lưới đã 4 bit (không ném, chỉ ghi lớp sai); chú thích viện dẫn một guard KHÔNG tồn tại | Script sang 4 bit/6 lớp; test `soundings-verify` nay chạy hàm của script trên `depth-grid.v1.bin` thật và so **từng ô** với `depthClassAt` của lib (3.600 toạ độ). `bench-render.mjs` sửa theo; `bench-map-method.mjs` mang marker nợ + cổng cỡ file (thà bỏ qua phần đo còn hơn in bảng sai) |
| G1 | `mergeLegPlans` cộng `hoursAt` đúng nhưng không một dòng test | Thêm ca độ dài / tăng dần / ETA tại chỗ ghé / ba chặng, và ba ca cho luật `nearPortOnly` khi nối |
| G2 | Gói hiểm hoạ méo (mảng số ngắn hơn `ids`) ⇒ máy KHÔNG chặn gì nhưng `hazardChecked` vẫn `true` ⇒ thẻ nói "đã đối chiếu" sai; `route-hazards` in "nước trên vật 0 m" khi thiếu số | `hazardChecked = có gói VÀ đọc trọn (hazardN === ids.length)`; xác tàu "qua được" thiếu số nước → bỏ dòng, không bịa 0 m. Test đổi kỳ vọng gói méo → `false` + ca "thiếu số → không dòng" |
| G3 | `console.debug` lọt bản production (hậu kiểm, nav-context); `nav-hazards` lấy `pointInRing` qua module bão; chu trình import `route-plan ↔ spatial-index` | Gate `NODE_ENV !== "production"`; import thẳng từ `spatial-index`; tách module lá `src/lib/geo.ts` (`LatLon`, `haversineKm`), `route-plan` re-export nên 30+ chỗ gọi cũ giữ nguyên |
| B1 | Console dev báo deps của `useEffect` đánh giá cảnh báo đổi kích thước giữa hai render | Đã soi: mảng deps trong code là CỐ ĐỊNH (`navLostTick` luôn có mặt, fishing-map-view ~:3266); cảnh báo là dấu vết hot-reload khi bản cũ (không có phần tử này) đổi sang bản mới — reload trọn trang không tái hiện. Không sửa code |
| B2 | `navigator.vibrate` gọi trước khi người dùng chạm khung → Chrome chặn + in lỗi | `vibratePattern` kiểm `navigator.userActivation.hasBeenActive` trước khi gọi |
| O1 tối ưu | `legCost` hỏi BỐN chỉ mục mỗi chặng (vật chặn · vật sát cảng · vùng-cấm-nhỏ chặn · sát cảng); `route-hazards` `indexOf` trong vòng kết quả | Gộp về MỘT chỉ mục `dotIx` (mức trên từng phần tử) + `spatial-index.maskWithinSegment` một lượt quét, dừng sớm khi thấy bit chặn, loại theo khung cả chỉ mục trước khi tính ô, ô nhớ một mục trước WeakMap; đo 41 lượt/tuyến: phần thêm của lớp hiểm hoạ 1,1–2,9 ms → 0,6–1,8 ms/tuyến, micro 100k chặng 2×any 20–25 ms → 1×mask 9–11 ms; bảng km/wp/cờ giống hệt. `indexOf` → Map dựng một lần. `nav-hazards` soi xong: không có cấp phát thừa đáng sửa ở 0,035 ms/fix |

Chi tiết đầy đủ (kiểm kê từng kho, hai bản đề xuất, bảng chấm 12 tiêu chí, sai sót kỹ thuật từng bản) nằm trong hồ sơ làm việc của phiên; phần đã chốt được ghi vào [02-architecture](../app-map/02-architecture.md), [07-design-spec](../app-map/07-design-spec.md), [04-data-model](../app-map/04-data-model.md).
