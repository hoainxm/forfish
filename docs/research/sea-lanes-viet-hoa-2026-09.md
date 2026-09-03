# Việt hoá + xác minh lớp `vn-sea-lanes.v1.json` (2026-09-03)

> Chỉ đạo chủ dự án: *"kết hợp các nguồn, verify lại, đặt tên việt nam, không
> cần tự hạn chế… Trung Quốc vẽ thì nó là 1 dữ liệu, mình gán mác việt nam lại
> cho chuẩn, biến nó thành dữ liệu VN."* → KHÔNG gỡ dữ liệu nước ngoài (ngư dân
> gần biên giới cần thấy giàn khoan/cáp thật để né); thay vào đó **verify** là
> thật, **gán nhãn tiếng Việt theo loại đối tượng + vùng biển**, biến thành dữ
> liệu của mình.

Nguồn thay đổi: `scripts/generate-sea-lanes.mjs` (viết lại), file sinh lại
`public/data/vn-sea-lanes.v1.json`. Test cổng: `src/lib/__tests__/sea-lanes.test.ts`
(mới) + cập nhật khối cũ trong `islands.test.ts`.

## 1. Kết quả tổng

| | Trước | Sau |
|---|---|---|
| Tổng feature | 290 | **338** (+48) |
| Có `ten` tiếng Việt | 5 (chỉ tuyến vẽ tay) | **338 / 338** |
| Chữ Hán / tên nước ngoài | 0 (đã bỏ name lúc sinh) | **0** (audit SẠCH) |
| Cỡ file | 80 KB | **107 KB** (≤ 20 MB) |

`kind` KHÔNG đổi (vẫn `tuyen/luong/phanluong/cap/vungcam/giankhoan`) → bản đồ
`fishing-map-view.tsx` đọc được ngay, **không cần Lead sửa layer**. Thêm 1
property mới `src` (`van-tay|osm|vn-aids|an-toan`) cho truy nguồn — map chỉ đọc
`kind`+`ten` nên không ảnh hưởng.

## 2. Phần 1 — Xác minh nguồn OSM (từng loại)

Chạy lại đúng truy vấn Overpass của script (bbox 4–24N, 102–118E) ngày
2026-09-03, **giữ tag** để đối chiếu (bản thô để ngoài repo). Số lượng **trùng
khớp tuyệt đối** file đang phát → dữ liệu THẬT, không rác:

| kind file | seamark:type OSM | Đếm OSM | Khớp file |
|---|---|---|---|
| `cap` | `cable_submarine` (78) + `pipeline_submarine` (25) | 103 | ✓ 103 |
| `phanluong` | `separation_lane/boundary/zone/line` (105) + `navigation_line` (2) + `recommended_track` (1) | 108 | ✓ 108 |
| `giankhoan` | `platform` (node+way→tâm) | 41 | ✓ 41 |
| `vungcam` (OSM) | `restricted_area` | 8 | ✓ 8 |
| `luong` (OSM) | `fairway` | 25 | ✓ 25 |

**15/285 phần tử OSM còn tag `name`** — đúng là bằng chứng vì sao bản cũ phải bỏ
name (script GIỮ nguyên nguyên tắc: **không copy name gốc vào file**):

- Chữ Hán/HK: `馬灣航道 Ma Wan Fairway`, `太白海鮮舫 Tai Pak Floating Restaurant`,
  `海底排水/進水管道`, `淨化海港計劃擴散管` (Harbour Area Treatment Scheme).
- **Lỗi phân loại OSM**: "Tai Pak Floating Restaurant" là **nhà hàng nổi** ở HK
  (114,16/22,24) bị gắn `seamark:type=platform` → trong file là 1 `giankhoan`
  nằm trong cụm HK (lat>21,2), KHÔNG dựng vùng cấm neo cho nó (xem §4).
- Cáp thật, tên Latin: `FLAG Europe-Asia`, `Southeast Asia-Japan Cable` (SJC ×6
  đoạn), `TKO Express`, `Ultra Express Link`.

### Việt hoá — quy tắc nhãn
`ten` = **loại đối tượng (tiếng Việt) — vùng biển (tên chủ quyền VN)**. Vùng
biển suy từ toạ độ, chỉ dùng tên VN trung tính (`vịnh Bắc Bộ` / `vịnh Thái Lan`
/ `Biển Đông (bắc|giữa|nam)`) → cổng `audit-names` SẠCH, không đụng 5 nhãn chủ
quyền trong `vn-islands`. Ví dụ: `Cáp ngầm biển — Biển Đông (giữa)`,
`Giàn khoan / công trình biển — vịnh Bắc Bộ`, `Phân luồng giao thông — Biển Đông (bắc)`.
Phân biệt `cable_submarine`→"Cáp ngầm biển" vs `pipeline_submarine`→"Ống ngầm biển".

### Phân bố trong/gần VN vs nước ngoài (ước lượng thô, loại cụm HK/Quảng Đông)
Xác nhận nhận định 89% hạ tầng nước ngoài:

| kind | OSM tổng | trong/gần VN | ngoài (HK/QĐ/xa) |
|---|---|---|---|
| cap | 103 | ~13 | ~90 |
| phanluong | 108 | ~14 | ~94 |
| giankhoan | 41 | ~9 | ~32 |
| vungcam (OSM) | 8 | 0 | 8 |
| luong (OSM) | 25 | 1 | 24 |

## 3. Phần 2 — Hạ tầng VN nhà nước, bổ sung được

### (C) Trục luồng hàng hải VN — **41 tuyến** (trước: 0 trong VN)
Nguồn: **báo hiệu chính thức Cục Hàng hải** đã có trong repo
(`public/data/vn-aids.v1.json`, 1.447 báo hiệu / 209 tuyến — nhà nước công bố
công khai, Điều 15 Luật SHTT loại "văn bản hành chính"+"số liệu" khỏi bảo hộ →
**không viết câu dè chừng**). Dựng trục luồng bằng **PCA**: gom báo hiệu theo
tuyến (cột `rt`), tìm hướng trục chính, sắp theo hình chiếu, chia đoạn (~1 đỉnh/
6 km), lấy **tâm từng đoạn** làm đỉnh → khử lệch trái–phải của cặp phao. Toạ độ
**suy từ dữ liệu nhà nước, không bịa**.

Lọc: chỉ 2 dải tên **sạch** (index `0–20` "Tuyến luồng…" bắc/trung + `183–208`
"Luồng hàng hải…" nam) — bỏ khoảng 21–182 nhiều OCR rác/mảnh. Điều kiện tin:
≥4 báo hiệu, trải ≥1 km, khử trùng tên. **21 tuyến bắc/trung + 20 tuyến nam =
41**, phủ toàn dải bờ (Hải Phòng → Hà Tiên/Năm Căn/Phú Quý/Côn Đảo). `kind=luong`
→ hiện ngay ở layer luồng. `luong` tổng: 25 (OSM, ngoài) → **66** (25 + 41 VN).

Bỏ (không đủ tin, không dựng): các index có <4 báo hiệu hoặc trải <1 km
(vd Vũng Rô, Lagi, Sa Đéc, Bến Đầm–Côn Đảo — chỉ 1–3 phao).

### (D) Vùng cấm neo 500 m — **7 vùng**
Quanh 7 công trình biển ngoài khơi **lat<21,2** (loại cụm HK/Quảng Đông + nhà
hàng nổi). Vòng 16 đỉnh, bán kính 500 m — **quy tắc an toàn phổ quát
(SOLAS/COLREG)** quanh mọi công trình biển; toạ độ vòng **suy hình học từ tâm
thật**, không bịa. `kind=vungcam` → hiện ngay. **Lưu ý trung thực**: đây là
vùng an toàn quanh công trình (đa số là giàn khí Trung Quốc phía tây Hải Nam,
lon 109–111,6), KHÔNG tuyên bố là công trình VN — mục đích để bà con **né khi
câu gần biên giới vịnh Bắc Bộ**. `vungcam` tổng: 8 → **15**.

### Chưa làm — **thiếu nguồn, không bịa**
- **Khu bảo tồn biển VN** (16 khu, QĐ 742/QĐ-TTg): có tên + vị trí xấp xỉ công
  bố công khai, **nhưng không có toạ độ đường bao (polygon) chính thức**. Đặt 1
  điểm cho "khu" là sai bản chất, vẽ polygon là bịa toạ độ → **cần nguồn ranh
  giới có thẩm quyền** mới dựng. Layer `vungcam` là LineString outline, đã sẵn.
- **Khu vực quân sự công bố**: chưa có nguồn toạ độ.
- **Giàn khoan dầu khí VN thật** (Bạch Hổ, Rồng, Nam Côn Sơn…): **OSM gần như
  không map** — 41 `platform` toàn TQ/HK. Cần nguồn khác (PVN công bố) mới thêm.

## 4. Phần 3 — Xác minh vị trí (spot-check nguồn 2)

Đối tượng xa (HK/Quảng Đông) **giữ, không verify từng cái** (carry-over). Các
đối tượng có tên trong/gần VN đã đối chiếu nguồn 2 (submarinenetworks.com):

- **FLAG Europe-Asia (FEA)**: cáp toàn cầu **có thật**, ~28.000 km, 18 nước.
  OSM biểu diễn là way **thô 6 đỉnh** (HK 113,9/22,2 → vịnh Thái Lan 100,6/7,2,
  tâm 108,5/13,9) — **không** cập bờ VN trong dữ liệu này (đính chính: SMW3 mới
  là cáp cập **Trạm Đà Nẵng**, không phải FEA). ✓ đối tượng THẬT.
- **Southeast Asia-Japan Cable (SJC)**: cáp thật, kéo tới Nhật (~140,7E/35N) —
  giải thích vì sao toạ độ file vượt khung VN (OSM `out geom` trả trọn hình học
  way). Test toạ độ nới dải Á–TBD cho đúng thực tế này. ✓ THẬT.
- **Trục luồng VN (C)**: đối chiếu trực quan tên tuyến ↔ vị trí cửa cảng
  (Hải Phòng 106,8/20,8; Đà Nẵng 108,2/16,1; Sài Gòn–Vũng Tàu 106,7–107/10,4–10,8;
  Định An–Cần Thơ 105,7–106,4/9,5–10,1…) — khớp cửa sông/cảng tương ứng.

## 5. Ảnh hưởng offline (bắt buộc trả lời theo CLAUDE.md)
- (a) **Không thêm request mạng runtime** — mọi fetch (Overpass) chỉ chạy
  build-time; `vn-aids` đọc từ đĩa. (b) **Không đụng** `sw.js`/SHELL/cache-list/
  khoá `forfish.*` — đường dẫn `/data/vn-sea-lanes.v1.json` **giữ nguyên** nên
  SW cache lại đúng URL khi bump. (c) **Không đè/mất dữ liệu bà con** (file
  asset tĩnh, không phải sổ người dùng). (d) map đã có nhánh đọc bản cache khi
  mất sóng. → **offline không đổi, chỉ dữ liệu dày hơn**.

## 6. Nghiệm thu
`npm test` (khối sea-lanes + islands): xanh · `npx tsc --noEmit`: sạch ·
`node scripts/audit-names.mjs --file …vn-sea-lanes.v1.json`: SẠCH ·
`sh .githooks/pre-commit --self-test`: PASS · file 107 KB ≤ 20 MB ·
**KHÔNG git add/commit/push**.

> ⚠️ 2 test đỏ khác trong suite (`sw-basemap-range` + `chat-day-*`) là do lớp
> `chat-day.v1.pmtiles` của **agent khác** (WIP, sw.js chưa cập nhật) — KHÔNG
> liên quan sea-lanes, KHÔNG thuộc quyền sửa của tôi.

## 7. Gợi ý cho Lead
`ten` nay có trên MỌI feature (không chỉ `tuyen`). Layer `sea-lane-label` hiện
chỉ hiện nhãn cho `kind=tuyen`. Nếu muốn bà con chạm xem "Cáp ngầm / Giàn khoan
/ Luồng …", Lead có thể thêm popup/nhãn cho các kind khác dùng `["get","ten"]`.
Trục luồng VN (`src=vn-aids`) và vùng cấm neo (`src=an-toan`) đã dùng `kind`
sẵn nên hiện ngay không cần đổi map.

---

## 8. Tách ỐNG DẪN khỏi CÁP + điểm cập bờ thành Point (2026-09-03, review A.4 / A.8-1, -8)

> Review `danh-gia-hai-do-2026-09.md` A.4: `osmKind()` gộp `cable_submarine`
> (78) + `pipeline_submarine` (25) thành một `kind: "cap"` → bà con không phân
> biệt được ống dẫn khí/dầu (neo/lưới trúng = **cháy nổ**, hải đồ INT1 vẽ L40–L44
> KHÁC cáp L30–L32) với cáp quang (trúng = bồi thường). Điểm cập bờ mã hoá
> LineString độ-dài-0 thì "hợp test nhưng vô hình" (chấm 1 px).

### 8.1 Schema mới (`generate-sea-lanes.mjs`, `src/lib/islands.ts` `LANE_KINDS`)

| `kind` | Hình | `src` | `loai` (mới) | `ten` |
|---|---|---|---|---|
| `cap` | LineString | osm | `quang` · `dien` · `chua-ro` | "Cáp quang biển — …" / "Cáp điện ngầm — …" / "Cáp ngầm biển — …" |
| `ong` **(mới)** | LineString | osm | `khi` · `dau` · `nhien-lieu` · `nuoc` · `xa-thai` · `chua-ro` | "Ống dẫn khí — …" / "Ống dẫn dầu — …" / "Ống dẫn nhiên liệu — …" / "Ống dẫn nước ngầm — …" / "Ống xả / lấy nước ngầm — …" / "Ống dẫn ngầm — …" |
| `cap-bo` **(mới)** | **Point** | cap-vn | `quang` + **`tram`** ("Vũng Tàu" / "Đà Nẵng" / "Quy Nhơn") | "Cáp quang biển AAG — cập bờ Vũng Tàu" (giữ nguyên) |
| `vungcam` | LineString | osm / an-toan | `cam-neo` · `cam-danh-bat` · `cam-vao` · `han-che` | OSM: "Khu cấm neo / cấm đánh bắt / cấm vào / hạn chế hàng hải — …"; an-toan: giữ "Vùng cấm neo quanh công trình biển (bán kính 500 m) — …" |
| `tuyen` `luong` `phanluong` `giankhoan` | như cũ | | (không có `loai`) | như cũ |

`loai` đọc từ tag OSM thật (không copy `name`): cáp
`seamark:cable_submarine:category` (fibre_optic/optical → quang; power hoặc
`power=cable` → dien); ống `substance` hoặc
`seamark:pipeline_submarine:product` (gas/oil/fuel/water/stormwater/sewage) +
`…:category` (outfall/intake/sewer → xa-thai); khu hạn chế
`seamark:restricted_area:restriction` (no_anchoring / no_fishing /
entry_prohibited|no_entry|restricted_entry).

### 8.2 Đếm sau khi sinh lại (Overpass 2026-09-03, 348 feature, 110 KB)

| kind | Số | Chia theo `loai` |
|---|---:|---|
| `cap` | **78** | quang 27 · điện 40 · chưa rõ 11 |
| `ong` | **25** | khí 7 · dầu 1 · nhiên liệu (Jet A-1 sân bay) 3 · nước 1 · xả thải/cống 12 · chưa rõ 1 |
| `cap-bo` | **10** Point | 5 Vũng Tàu · 3 Đà Nẵng · 2 Quy Nhơn — đúng 3 trạm thật |
| `vungcam` | 15 | an-toan **7 cam-neo** (vòng 500 m) + OSM 8 (cam-neo 1 · cam-danh-bat 1 · cam-vao 6) |
| `giankhoan` 41 · `phanluong` 108 · `luong` 66 · `tuyen` 5 | | không đổi |

Tổng vẫn 348 (cáp 103 → 78 + 25; cap-vn 10 đổi hình, không đổi số).

### 8.3 Sự thật cần nói thẳng — 25 ống này KHÔNG phải Bạch Hổ / Nam Côn Sơn

Review A.4 viết "Vùng Bạch Hổ–Rồng–Nam Côn Sơn (25 ống trong dữ liệu) là đúng
ngư trường tàu giã cào Bà Rịa". Kiểm tag từng ống: **cả 25 đều ở Hồng Kông /
Quảng Đông** (nguồn `hydro.gov.hk` NtM, `China MSA Notice`): ống khí Hải Nam–
Quảng Đông, ống Jet A-1 sân bay Chek Lap Kok, cống xả HATS… OSM **không map**
ống dầu khí VN (Bạch Hổ–Dinh Cố, Nam Côn Sơn 1/2, PM3–Cà Mau) — đã ghi ở §3
vòng trước ("giàn khoan VN thật: OSM gần như không map"). Việc tách kind là
**đúng và cần** (ngư dân câu gần biên giới vịnh Bắc Bộ vẫn gặp 7 ống khí thật),
nhưng **lỗ hổng an toàn ở ngư trường Bà Rịa vẫn còn** → cần nguồn Thông báo
hàng hải VMS-South / PVN có toạ độ hành lang ống mới bổ sung, KHÔNG bịa.

### 8.4 Ảnh hưởng tới map (Lead)

- `fishing-map-view.tsx` lớp `sea-lane-cap` lọc `kind == "cap"` → 25 ống và 10
  điểm cập bờ **tạm biến mất** khỏi map cho tới khi Lead thêm lớp `sea-lane-ong`
  (nét liền + chữ "ỐNG DẪN") và symbol `cap-bo` (icon `cable-landing`, nhãn
  `tram`). Đây là hệ quả chủ ý của review A.8-1/-8, không phải rơi dữ liệu.
- Vòng cấm neo: lọc `loai == "cam-neo"` để đặt icon `no-anchor` + nhãn "CẤM
  NEO"; khu hạn chế OSM khác dùng `ten` ("Khu cấm vào — …").
- Offline: đường dẫn file giữ nguyên, không thêm request runtime, không đụng
  `sw.js`/khoá `forfish.*` — SW cache lại đúng URL.

### 8.4b R1 — vùng cấm là **Polygon**, không phải LineString (review MapLibre, cùng ngày)

Reviewer chỉ ra bằng mã MapLibre: lớp symbol `sea-lane-camneo` (icon cấm neo)
+ `sea-lane-vungcam-label` dùng `symbol-placement: point` — trên **LineString**
MapLibre đặt symbol ở **đỉnh đầu của từng mảnh sau khi cắt ô** → icon nằm trên
vành cách giàn 500 m và nhân bản ở biên ô, không phải tâm. Lớp
`sea-lane-vungcam-fill` tô được chỉ vì `FillBucket` không kiểm `feature.type`
(hành vi không tài liệu). Một sửa cho cả hai: `kind=vungcam` xuất **Polygon**
(`coordinates: [ring]`, ring khép kín đỉnh đầu == đỉnh cuối).

| Nguồn | Kết quả | Ghi chú |
|---|---|---|
| 7 vòng cấm neo 500 m (`src=an-toan`) | **Polygon** 17 đỉnh khép kín | `circle500m` đã sinh đỉnh 0 == đỉnh 16 |
| 2 way OSM `restricted_area` khép kín (cam-danh-bat 7 đỉnh · cam-vao 16 đỉnh) | **Polygon** | đỉnh đầu == cuối trong dữ liệu OSM |
| 6 way OSM **hở** (cam-vao ×5: 2·2·21·4·13 đỉnh · cam-neo ×1: 11 đỉnh) | **giữ LineString + `hoDang: true`** | KHÔNG tự khép: hai way chỉ 2 đỉnh không thành đa giác; khép way 21 đỉnh là bịa diện tích cấm không có trong nguồn. Lead: lớp fill/icon lọc `["!=", ["get","hoDang"], true]` hoặc chấp nhận symbol ở đỉnh đầu cho 6 nét viền này (đều ở HK/Quảng Đông, xa ngư trường VN) |

Đếm không đổi (348: cap 78 · ong 25 · cap-bo 10 · vungcam 15 · giankhoan 41 ·
luong 66 · phanluong 108 · tuyen 5). `src/lib/islands.ts` thêm
`LANE_POLYGON_KINDS = ["vungcam"]`; thước `kiem-phu-hai-do.mjs` (`coDiemVN`)
đệ quy toạ độ nên đọc Polygon không cần sửa.

### 8.5 Cổng test
`sea-lanes.test.ts`: cap ≥78 · ong ≥20 · cap-bo = 10 Point tại 3 trạm, có `tram`
· an-toan = 7 với `loai=cam-neo` · mọi `vungcam` có `loai` hợp lệ · `ten` cáp
bắt đầu "Cáp", ống bắt đầu "Ống", `loai` đúng bộ · ≥5 ống khí/dầu/nhiên liệu.
`islands.test.ts`: bất biến hình học đổi thành `LANE_POINT_KINDS`
(giankhoan + cap-bo = Point, còn lại LineString ≥2 đỉnh); OSM phải có cả `cap`
lẫn `ong`.
