# Style MapLibre & chi phí vẽ mỗi khung hình — kiểm kê đo thật

> **Ngày đo**: 2026-08-30 · **Nhánh**: `feat/nen-ban-do-pmtiles` · **Người đo**: teammate STYLE & RENDER
> **Câu hỏi**: bản đồ Ra khơi chạy trên điện thoại phổ thông rẻ tiền, nhìn dưới nắng chói trên tàu lắc — chỗ nào đang trả tiền mà không nhận được gì?
> **Nguyên tắc**: **đo, không đoán**. Mọi con số dưới đây do `node scripts/audit-style.mjs` in ra từ file thật trong repo. Chỗ nào phải mở trình duyệt mới đo được thì ghi thẳng là **không đo được ở Node** — không bịa.
> **Ràng buộc không đánh đổi** (CLAUDE.md §KHÔNG ĐƯỢC): chữ ≥18px, tap ≥56px, tương phản cao cho nắng chói. Đề xuất nào làm bản đồ **khó đọc hơn** thì loại thẳng, dù nhanh tới đâu.

**Chạy lại**:

```bash
node scripts/audit-style.mjs          # bảng gọn (ẩn bớt lớp roads_* của nền)
node scripts/audit-style.mjs --full   # in đủ 61 lớp
node scripts/audit-style.mjs --json   # máy đọc (CI / so sánh trước-sau)
```

Script nạp thẳng `buildMapStyle` từ `src/lib/ocean-map.ts` (bundle bằng `rolldown` đã có sẵn theo vite/vitest — **không thêm dependency mới**), quét **toàn bộ 982 ô** của `public/data/vn-basemap.pmtiles` bằng một bộ đọc MVT tối thiểu viết tay, và quét `<Layer>` khai bằng JSX trong `fishing-map-view.tsx` + `route-planner.tsx`.

---

## 0. Tóm tắt một trang

| Con số | Giá trị đo được |
|---|---|
| Lớp trong style lúc mở app (hải đồ + báo hiệu) | **61** — 54 của nền Protomaps + 7 của app |
| Lớp app khai bằng JSX (ngoài `buildMapStyle`) | **49** (sàn — có 1 khai báo động bung thành nhiều lớp lúc chạy) |
| ⇒ Trần thực tế khi bật hết lớp | **≥ 110 lớp** |
| **Lớp KHÔNG BAO GIỜ vẽ ra gì** | **30 / 61 — 49%** |
| Phép lọc để dựng bucket cho một ô z9 điển hình | **1.591** (ô đông nhất: **19.266**) |
| Nền `vn-basemap.pmtiles` | 13,8 MB, zoom 0–9, 982 ô, **83.121 feature**, 19,3 MB sau giải nén |
| Trong đó là chi tiết ĐẤT LIỀN (landuse + roads + places + pois) | **72.797 feature (87,6%)**, 14,8 MB giải nén (77%) |
| Asset GeoJSON app tự vẽ, nặng nhất | `isobaths.v1.json` — 5.110 đường, **53.524 đỉnh**, 1,27 MB |
| Báo hiệu | 5.851 điểm, 3 lớp `circle` đọc chung một nguồn |

**Ba việc đáng làm nhất** (chi tiết ở §6): ① bỏ 30 lớp chết → 61 lớp còn 31, −34% phép lọc/ô, **0 thay đổi hình ảnh**; ② bỏ nhóm `landuse` (10 lớp) → còn 21 lớp, −88% phép lọc/ô so với hiện tại, và bản đồ **dễ đọc hơn** (đất phẳng một tông đúng chất hải đồ); ③ tính sẵn nấc zoom vào dữ liệu → báo hiệu 3 lớp còn 1, đẳng sâu 4 phép/đối-tượng còn 2.

---

## 1. VIỆC 1 — Kiểm kê chi phí từng lớp

### 1.1 Số lớp theo tổ hợp

| Tổ hợp lớp bản đồ | Tổng | Nền | App | symbol | fill | line |
|---|---|---|---|---|---|---|
| Hải đồ + báo hiệu (**MẶC ĐỊNH lúc mở app**) | 61 | 54 | 7 | 1 | 16 | 40 |
| Hải đồ, tắt báo hiệu | 60 | 54 | 6 | 1 | 16 | 40 |
| Nước nóng lạnh (sst) | 59 | 54 | 5 | 0 | 16 | 39 |
| Vùng nhiều mồi (chlorophyll) | 59 | 54 | 5 | 0 | 16 | 39 |
| Chỉ nền (`layerId = null`) | 58 | 54 | 4 | 0 | 16 | 39 |

**Nhận xét**: đổi lớp bản đồ gần như không đổi số lớp — 54/61 là nền, không đụng được bằng công tắc trong UI. Muốn nhẹ thì phải cắt ở `buildMapStyle`.

### 1.2 Nền `vn-basemap.pmtiles` — có gì thật trong file

Quét **toàn bộ 982 ô**, không lấy mẫu:

| source-layer | khai (z) | feature | đỉnh | KB (giải nén) | feature/ô ở z9 | ô đông nhất |
|---|---|---|---|---|---|---|
| `landuse` | 2–15 | **49.532** | **3.781.188** | **8.855** | 86,5 | 847 |
| `roads` | 3–15 | 9.298 | 2.370.237 | 5.565 | 16,3 | 240 |
| `water` | 0–15 | 9.458 | 1.641.581 | 3.757 | 12,0 | 351 |
| `places` | 1–15 | 13.339 | 13.339 | 750 | 28,9 | 157 |
| `landcover` | 0–7 | 215 | 178.826 | 390 | 0 | 7 |
| `earth` | 0–15 | 651 | 162.844 | 367 | 1,2 | 9 |
| `pois` | 5–15 | 628 | 628 | 33 | 1,7 | 16 |
| `buildings` | 11–15 | **0** | 0 | 0 | 0 | 0 |

Ba sự thật rút ra:

1. **`buildings` khai trong metadata nhưng KHÔNG có một ô nào** — file dừng ở z9, mà `buildings` chỉ có từ z11. Lớp style `buildings` là lớp chết chắc chắn.
2. **`places` (13.339) + `pois` (628) nằm trong file mà KHÔNG lớp style nào dùng** — `buildMapStyle` lọc sạch lớp `symbol` của Protomaps, nên hai source-layer này chỉ để tải về rồi vứt: **783 KB giải nén, 13.967 feature**. (Việc nén lại file là mảng của teammate nền bản đồ — ở đây chỉ ghi nhận con số.)
3. **`landuse` chiếm 60% số feature và 45% số byte của cả nền** — công viên, trường học, bệnh viện, ruộng, sân bay. Trên một app đi biển.

### 1.3 Chi phí lọc khi nạp một ô

MapLibre dựng **bucket riêng cho mỗi lớp style**, và mỗi lớp phải chạy bộ lọc của nó trên **mọi đối tượng** của source-layer đó trong ô (đọc thẳng `maplibre-gl-dev.js`: `populate()` → `this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), …)` cho từng feature).

| source-layer | số lớp style | đối tượng/ô z9 | **phép lọc/ô** | ô tệ nhất |
|---|---|---|---|---|
| `landuse` | 11 | 86,5 | **951** | 9.317 |
| `roads` | 37 | 16,3 | **602** | 8.880 |
| `water` | 3 | 12,0 | 36 | 1.053 |
| `earth` | 1 | 1,2 | 1 | 9 |
| `landcover` | 1 | 0 | 0 | 7 |
| `buildings` | 1 | 0 | 0 | 0 |
| **Tổng** | 54 | | **1.591** | **19.266** |

Đây **không phải chi phí mỗi khung hình** (bucket dựng một lần mỗi ô mỗi mức zoom) — nhưng nó chạy trên **worker**, và đúng lúc bà con kéo bản đồ thì worker nghẽn = ô về chậm = màn hình trống lâu. Trên máy yếu đây là thứ cảm nhận được rõ nhất.

### 1.4 Lớp `symbol` — đắt nhất

`symbol` phải bố trí nhãn, đo hộp va chạm, tránh chồng chữ. Khi bật hết có **6 lớp symbol**:

| Lớp | Nguồn | Số đối tượng | Ghi chú |
|---|---|---|---|
| `isobath-labels` | `/data/isobaths.v1.json` | **5.110 đường** | `symbol-placement: "line"` — đắt nhất trong 6 cái: phải chạy dọc từng đường tìm chỗ đặt số mét |
| `island-label` | `vn-islands.v1.json` | 103 điểm | có `symbol-sort-key` (sort thêm một lượt) |
| `reef-label` | `coral-reefs.v1.json` | 13 điểm | như trên |
| `sea-lane-label` | `vn-sea-lanes.v1.json` | 249 đường (lọc `kind=tuyen`) | `symbol-placement: "line"` |
| `map-grid-label` | lưới toạ độ dựng runtime | theo khung nhìn | `symbol-placement: "line"` |
| `storm-moc-label` | bản tin bão | vài chục mốc | chỉ khi có bão |

`isobath-labels` là lớp symbol nặng nhất của app và **không được đụng vào cỡ chữ/halo** — số mét chính là lý do tồn tại của hải đồ. Cách giảm chi phí nó nằm ở dữ liệu (§4), không ở kiểu chữ.

### 1.5 Tô trong suốt (overdraw)

**11 lớp `fill` tô trong suốt** trong nhóm JSX. Ở ngoài khơi, bật nhiều lớp cùng lúc thì một pixel biển có thể bị vẽ đè: `sea-bg` → `water`/`earth` → `sea-mask` → `ocean-data` (raster 0,85–1,0) → `vms-<zone>-fill` (0,1 × N vùng admin bật) → `vung-long-fill` (0,06) → `fish-grid-fill` (0,6) → `reef-fill` (0,18) → `storm-*-fill` (0,16 / 0,12 / 0,1). Trường hợp thật tệ ≈ **8–10 lượt tô toàn màn**.

Đây là chỗ **chi phí và độ đọc đi CÙNG chiều**, không đánh đổi: chồng 8 lớp trong suốt vừa tốn fill-rate GPU vừa làm mọi màu đục lại dưới nắng — bà con nhìn ra một màn xám xanh không phân biệt được gì. Xem §7.

### 1.6 Asset GeoJSON app tự vẽ

| File | KB | feature | đỉnh | hình học |
|---|---|---|---|---|
| `/data/isobaths.v1.json` | 1.303 | **5.110** | **53.524** | LineString ×5.110 |
| `/data/reef-shapes.v1.json` | 765 | 2.622 | 29.242 | Polygon ×2.328, LineString ×207, Point ×87 |
| `/data/vn-coast.v1.json` | 215 | 526 | 10.759 | Polygon ×526 |
| `/data/seamarks.v1.json` | 184 | 5.851 điểm | — | định dạng nén riêng (không phải FeatureCollection) |
| `/data/vn-sea-lanes.v1.json` | 78 | 290 | 2.759 | LineString ×249, Point ×41 |
| `/data/vn-islands.v1.json` | 18 | 103 | 103 | Point ×103 |
| `/data/coral-reefs.v1.json` | 3 | 13 | 13 | Point ×13 |

---

## 2. Lớp KHÔNG BAO GIỜ VẼ RA GÌ — 30/61 (49%)

Không suy đoán: mỗi lớp dưới đây có một điều kiện **bắt buộc** trong bộ lọc tham chiếu tới thuộc tính hoặc giá trị **không tồn tại ở bất kỳ ô nào** trong `vn-basemap.pmtiles`.

| Nhóm | Số lớp | Bằng chứng đo được |
|---|---|---|
| `roads_tunnels_*` | 10 | Bộ lọc đòi `["has","is_tunnel"]`. Danh sách thuộc tính thật của source-layer `roads` trong cả 982 ô: `is_link, kind, kind_detail, min_zoom, sort_rank` — **không có `is_tunnel`**. |
| `roads_bridges_*` | 10 | Bộ lọc đòi `["has","is_bridge"]` — **không có `is_bridge`** (cùng danh sách trên). |
| `roads_minor*` (4) + `roads_other` + `roads_rail` + `roads_pier` + `roads_taxiway` | 8 | Giá trị `minor_road` / `other` / `path` / `rail` / `pier` / `taxiway` **không xuất hiện trong bất kỳ giá trị chữ nào** của `roads`. Giá trị thật có: `aeroway, alley, drive-through, driveway, highway, major_road, motorway, motorway_link, parking_aisle, primary, primary_link, runway, secondary, secondary_link, tertiary, tertiary_link, trunk, trunk_link`. |
| `landuse_pier` | 1 | Giá trị `pier` không có trong `landuse`. |
| `buildings` | 1 | source-layer `buildings` **không có một ô nào** (khai z11–15, file dừng z9). |
| **Tổng** | **30** | |

**Cắt 30 lớp này**: style 61 → **31 lớp**; phép lọc mỗi ô z9 **1.591 → 1.049 (−34%)**; **0 pixel thay đổi trên màn hình**.

⚠️ **Điều kiện nâng cấp phải ghi lại**: mấy lớp này chết vì `vn-basemap.pmtiles` hiện dừng ở z9 và không mang `is_bridge`/`is_tunnel`. Nếu sau này sinh lại nền sâu hơn (z12–14) thì `roads_bridges_*` sẽ có việc trở lại. Vậy nên **cắt bằng danh sách trắng sinh từ audit, không bằng danh sách đen chép tay**, và chạy lại `scripts/audit-style.mjs` **mỗi lần sinh lại nền** — script chính là cái chốt chặn đó.

### Lớp trùng việc / gộp được

| Chỗ trùng | Đo được | Đề nghị |
|---|---|---|
| `offline-coast-*` (2 lớp, source `offline-coast`) và `overlay-coast-*` (2 lớp, source `overlay-coast`) | **Cùng đọc `/data/vn-coast.v1.json`** — 526 polygon / 10.759 đỉnh — nhưng là **hai geojson source riêng**, nên MapLibre cắt ô + dựng bucket **hai lần** cho cùng một hình bờ. Điều kiện bật (`offlineBase` và `anyExclusiveOverlay`) **có thể đúng cùng lúc** (mất sóng + đang bật lớp dự báo) ⇒ bờ vẽ hai lần chồng nhau. | Gộp về **một source**, hai bộ lớp `beforeId` khác nhau. Tiết kiệm 1 lượt cắt ô + 1 bucket cho 526 polygon. |
| 3 lớp `seamark-far/mid/near` | Cùng một source 5.851 điểm, cùng paint, chỉ khác `minzoom` + bộ lọc `match` trên `t`. Phân bố thật: far **552** (9,4%), mid **2.071** (35,4%), near **3.228** (55,2%). | Gộp còn **1 lớp** bằng thuộc tính `minz` tính sẵn — xem §4.1. 3 bucket → 1. |
| `island-dot`+`island-label` và `reef-dot`+`reef-label` | Hai source, tổng **116 điểm**, cùng khuôn symbol (`sort-key`, halo, offset), chỉ khác màu. | Gộp được (1 source, thuộc tính `kind` chọn màu) → bớt 2 lớp + 1 source. **Giá trị thấp** (116 điểm) — chỉ làm nếu đằng nào cũng đụng vào chỗ đó. |
| `roads_major_casing_early` (maxzoom 12) / `roads_major_casing_late` (minzoom 12) — và cặp `highway` tương ứng | Protomaps tách đôi để xếp thứ tự vẽ ở z cao. Nền dừng z9 nên cặp `*_late` chỉ vẽ từ ô phóng to. | Gộp được **chừng nào nền còn dừng ở z9**. Giá trị thấp, và sẽ sai nếu nền được sinh sâu hơn. **Không đề xuất.** |
| `storm-moc-qua` / `storm-moc-toi` | Hai lớp circle lọc cùng một thuộc tính, chỉ vài chục mốc. Mã có ghi rõ là **cố ý tách cho dễ đọc**. | **Để nguyên** — gộp lại không tiết kiệm gì đo được, chỉ làm mã khó đọc (nguyên tắc 15: không sửa để mà sửa). |

---

## 3. Chi tiết đất liền trên một app đi biển

Không phải "lớp chết", mà là "lớp sống mà vẽ thứ không ai nhìn". Sau khi bỏ 30 lớp chết, **24 lớp nền còn sống**:

| Nhóm còn sống | Số lớp | Vẽ cái gì | Phép lọc/ô z9 |
|---|---|---|---|
| `landuse_*` | 10 | công viên, sân trường, bệnh viện, khu công nghiệp, bãi biển, **sở thú**, sân bay, đường băng, phố đi bộ, cây xanh đô thị | **865** |
| `roads_*` | 9 | đường lớn / cao tốc / nhánh nối + casing của chúng, đường băng | 147 |
| `water*` | 3 | mặt nước, sông, suối | 36 |
| `earth`, `landcover` | 2 | khối đất, lớp phủ (rừng/ruộng/đô thị) | 1 |

`landuse` một mình chiếm **82,5% chi phí lọc còn lại**, để vẽ những mảng màu nằm **trên đất liền** cho người đang ở ngoài biển. Xem đề xuất §6.2.

---

## 4. VIỆC 2 — Biểu thức lọc

### 4.1 Đáng tính sẵn lúc sinh dữ liệu

**(a) Báo hiệu — 3 lớp `match` → 1 lớp `>=`.** Hiện tại (`fishing-map-view.tsx`):

```
seamark-far  minzoom  9  filter ["match", ["get","t"], SEAMARK_FAR, true, false]
seamark-mid  minzoom 11  filter ["match", ["get","t"], SEAMARK_MID, true, false]
seamark-near minzoom 13  filter ["all", ["!",["match",…FAR…]], ["!",["match",…MID…]]]
```

Ba lớp đọc **chung một nguồn 5.851 điểm** ⇒ mỗi ô bị lọc **ba lần** trên đúng tập điểm của nó, và MapLibre dựng **ba bucket** thay vì một. Tính sẵn một thuộc tính số `minz` (9 / 11 / 13) lúc sinh `seamarks.v1.json` rồi dùng **một lớp** với `filter: [">=", ["zoom"], ["get","minz"]]` → **3 bucket còn 1, 3 lượt lọc còn 1**, hình ảnh không đổi một pixel.

> ⚠️ Đính chính một hiểu lầm hay gặp: **`["match"]` trên mảng dài KHÔNG đắt.** Đọc thẳng `node_modules/maplibre-gl/dist/maplibre-gl-dev.js` `class Match.evaluate()`: nó dựng bảng băm `cases` lúc parse rồi tra `this.cases[input]` — **O(1)**, không phải so tuyến tính. Nới danh sách `SEAMARK_MID` từ 8 lên 20 loại **không** làm chậm thêm. Cái đắt ở đây là **ba lớp / ba bucket**, không phải bề rộng của `match`. Đừng đi "tối ưu" nhầm chỗ.

**(b) Đẳng sâu — thay bậc thang `case` bằng một số tính sẵn.** `ocean-map.ts` hiện dùng:

```
filter: [">=", ["zoom"], ["case",
   ["<=", ["get","d"], 10], 10+off,
   ["<=", ["get","d"], 20],  9+off,
   ["<=", ["get","d"],100],  7+off,
                             5+off]]
```

`["case"]` **là** tuyến tính (đọc `class Case` cùng file: duyệt nhánh tới khi đúng), nên mỗi đối tượng tốn tới **1 `get` + 3 phép `<=`**, chạy trên **5.110 đường** cho **cả hai lớp** (`isobath-lines` và `isobath-labels`), **lặp lại mỗi khi ô được cắt ở một mức zoom nguyên khác** — mà nguồn geojson bị cắt lại ở từng nấc từ z5 lên z10+.

Tính sẵn hai thuộc tính trong `scripts/generate-isobaths.mjs`: `mz` (nấc hiện đường) và `lz` (nấc hiện số mét, = `mz + 1`), rồi:

```
isobath-lines : filter [">=", ["zoom"], ["get","mz"]]
isobath-labels: filter [">=", ["zoom"], ["get","lz"]]
```

**4 phép/đối-tượng → 2**, trên 5.110 đối tượng × 2 lớp × mỗi nấc zoom. Bonus: luật "đường nông thì đòi zoom gần" nằm thẳng trong dữ liệu, đọc file JSON là thấy, không phải giải mã biểu thức.

### 4.2 `["zoom"]` nằm TRONG `filter`

Chỉ **2 lớp** dính (`isobath-lines`, `isobath-labels`) — chính hai lớp ở §4.1b. Các lớp Protomaps dùng `["zoom"]` trong `paint`, không phải `filter` (đã kiểm riêng từng chỗ; bản audit đầu tiên báo nhầm 40+ lớp vì gộp `filter`/`paint`/`layout` làm một — đã sửa).

Cần nói rõ để không ai "tối ưu" sai: `["zoom"]` trong `filter` **không** khiến MapLibre lọc lại mỗi khung hình. Bản 5.24 đánh giá bộ lọc lúc `populate()` với `new EvaluationParameters(this.zoom)` — tức **một lần mỗi ô mỗi mức zoom nguyên**, đúng như chú thích trong `ocean-map.ts`. Cái tốn là: nguồn GeoJSON bị **cắt ô lại** ở từng nấc, nên toàn bộ 5.110 đường phải chạy lại bộ lọc ở mỗi nấc từ z5 lên. Rút `case` xuống `get` (§4.1b) là cách rẻ nhất để giảm chỗ đó mà không đổi hành vi.

### 4.3 Biểu thức data-driven mà giá trị thật ra là hằng số

Soát cả 61 lớp style + 49 lớp JSX. **Không tìm thấy trường hợp rõ ràng nào.** Vài chỗ đáng ghi nhận, kèm phán quyết:

| Chỗ | Đánh giá |
|---|---|
| `scalar-field-fill` dùng `"fill-color": ["get","color"]` | **Đúng bài** — màu đã tính sẵn (kèm alpha) lúc dựng dữ liệu, chỉ còn một lần `get`. Đây là mẫu nên chép cho chỗ khác, không phải chỗ cần sửa. |
| `seamark-*` dùng `["case", ["==",["get","lit"],1], magenta, thép]` | 1 phép so sánh/đối-tượng. **Để nguyên** — tính sẵn màu vào dữ liệu sẽ đưa hex ra khỏi `ocean-map.ts` (nơi quy ước màu hải đồ được ghi và bảo vệ), đổi một khoản tiết kiệm không đo nổi lấy một chỗ dễ hỏng. |
| `isobath-lines` `"line-width"` có `["case"]` **bên trong** `["interpolate"]` theo zoom | Biến thuộc tính paint từ "chỉ theo zoom" (uniform GPU) thành "theo đối tượng" (phải nạp buffer thuộc tính mỗi đỉnh). Về lý là đắt hơn. Nhưng gỡ nó phải tách thành **2 lớp** (nông/sâu) — đổi 1 lớp lấy 1 lớp. **Không đề xuất** khi chưa đo được ở trình duyệt. |
| `fuel-route-line` dùng 3 cái `["match"]` trên `state` cho màu/dày/mờ | Tuyến chỉ có vài chặng. Tra O(1). **Để nguyên.** |
| `landuse_park` `["in","kind", …10 giá trị]` | Bộ lọc cũ được MapLibre biên dịch thành `match` ⇒ tra O(1). **Không phải chỗ nghẽn.** Lớp này đáng bỏ vì nó vẽ công viên trên đất, không phải vì bộ lọc. |

---

## 5. VIỆC 3 — Tham số MapLibre

Hiện `<MapGL>` trong `fishing-map-view.tsx` chỉ đặt: `initialViewState`, `minZoom` (2, hoặc 4 khi có lớp dự báo), `style`, `attributionControl={false}`, `mapStyle`, `interactiveLayerIds`, và các handler. **Mọi tham số hiệu năng đang để mặc định.** Mặc định đọc thẳng từ `maplibre-gl-dev.js`; `@vis.gl/react-maplibre` khai `MapInitOptions = Omit<MapOptions, 'style'|'container'|'bounds'|'fitBoundsOptions'|'center'>` nên **mọi tham số dưới đây truyền thẳng qua prop được**.

| Tham số | Mặc định | Đề nghị | Vì sao / đánh đổi |
|---|---|---|---|
| `validateStyle` | `true` | **`false`** | App gọi `setStyle` mỗi lần đổi lớp bản đồ (hải đồ ↔ nhiệt ↔ mồi) và mỗi lần bật/tắt báo hiệu. Mỗi lần là một lượt **kiểm tra hợp lệ 61 lớp** — vô ích khi style do chính mã ta sinh ra. **Đánh đổi**: báo lỗi kém rõ nếu style hỏng — bù bằng 2.507 ca test + `scripts/audit-style.mjs`. **0 pixel đổi.** |
| `refreshExpiredTiles` | `true` | **`false`** | MapLibre tự xin lại ô đang hiện khi `Cache-Control` của nó hết hạn. Ô ảnh NASA GIBS có hạn ngắn ⇒ bà con ngồi yên không thao tác gì mà máy vẫn phát request. **🟡 ĐÂY LÀ MỘT THẮNG LỢI OFFLINE**: bớt request nền lúc sóng chập chờn ngoài khơi. **Đánh đổi**: ô giữ nguyên tới khi style dựng lại — mà app vốn dựng lại style khi đổi ngày/đổi lớp, nên không có gì cũ đi theo cách bà con thấy được. |
| `fadeDuration` | `300` ms | **`0`** | Sau **mỗi** ô về, MapLibre ép vẽ thêm khung suốt 300 ms để chuyển mờ nhãn/icon. Lúc kéo bản đồ, ô về liên tục ⇒ dòng khung ép vẽ liên tục trên máy yếu. **Đánh đổi**: nhãn "nhảy" ra thay vì hiện dần. Trạng thái cuối y hệt ⇒ **không mất độ đọc**, chỉ mất mượt. `raster-fade-duration: 150` trong `ocean-map.ts` là chuyện riêng của lớp ảnh, không đụng. |
| `antialias` | `false` | **GIỮ `false`** | Bật MSAA trên GPU điện thoại rẻ là lỗi kinh điển. **Đừng đụng vào.** |
| `preserveDrawingBuffer` | `false` | **GIỮ `false`** | `true` bắt trình duyệt giữ framebuffer ⇒ tốn bộ nhớ + chậm. Chỉ cần khi chụp ảnh canvas — app không làm việc đó. |
| `renderWorldCopies` | `true` | **KHÔNG đổi** | Có lý thuyết nói tắt đi thì nhanh. Đo thử: `minZoom` của app là 2, mà bề rộng thế giới ở z2 = `512 × 2² = 2048 px` — **rộng hơn mọi màn điện thoại**, nên không bao giờ vẽ bản sao thứ hai. Tắt đi **không tiết kiệm gì**. Không đổi để khỏi thêm một dòng phải giải thích. |
| `maxTileCacheSize` | tự tính theo khung nhìn | **KHÔNG đổi khi chưa đo ở trình duyệt** | Nâng lên = tốn RAM trên máy rẻ (dễ bị hệ điều hành giết tab). Hạ xuống = phải phân tích lại ô đã bỏ (không tốn mạng vì service worker vẫn giữ, nhưng tốn worker). Hai chiều đều có giá, **không đo được ở Node**. Đây đúng kiểu nút người ta hay vặn bừa. |
| `maxZoom` | `22` | cân nhắc **`15`** | Dữ liệu sâu nhất thật sự có: nền z9, hải đồ EMODnet z12, ảnh OpenSeaMap z18. Trên z14 chỉ còn ô phóng to mờ. Chặn ở 15 **không mất thông tin nào**. Lợi hiệu năng **nhỏ**; lợi UX vừa (đỡ zoom lạc vào vùng mờ trắng). **Ưu tiên thấp.** |
| `pixelRatio` | `devicePixelRatio` | **KHÔNG hạ về 1. Chỉ được cân nhắc chặn trần 2, và phải thử máy thật trước.** | Đây là đòn bẩy fill-rate mạnh nhất: máy Android rẻ hay báo DPR 2,75–3 ⇒ hạ về 1 là cắt ~8 lần số pixel phải tô. **Nhưng nó làm nhoè chữ số mét và nét mảnh của hải đồ**, đâm thẳng vào ràng buộc "mắt 40–60, nắng chói" — **loại**. Chặn trần 2 chỉ ảnh hưởng máy DPR > 2 và về lý vẫn ở mức "retina", nhưng **chưa ai đo trên máy thật**, nên không đề xuất mù. |
| `dragRotate` / `pitchWithRotate` / `touchPitch` | bật | **cân nhắc tắt cả ba** | Lợi hiệu năng: giữ `bearing = 0`, `pitch = 0` cố định ⇒ hộp va chạm nhãn luôn thẳng trục, không phải bố trí lại nhãn khi xoay. Lợi **an toàn** còn lớn hơn: tay ướt trên tàu lắc rất dễ vô tình xoay hai ngón, mà **hải đồ bị xoay khỏi hướng bắc là chuyện nguy hiểm**, không phải chuyện thẩm mỹ. Đã soát mã: app **không dùng `bearing`/`pitch`** ở đâu (chỉ có hàm `bearingDeg` tự tính hướng, không liên quan camera). **Đánh đổi**: mất khả năng xoay bản đồ — mà app chưa từng dùng. **Đây là quyết định nghiệp vụ/thiết kế, không phải quyết định hiệu năng** ⇒ phải hỏi chủ dự án. |

### `fill-antialias` — nút riêng cho từng lớp, không phải tham số map

Mặc định `fill-antialias: true` ⇒ MapLibre chạy **thêm một lượt vẽ viền** cho mỗi lớp `fill` (đọc painter: `if (renderPass === 'translucent' && layer.paint.get('fill-antialias')) …`). Trong 11 lớp fill trong suốt của app, **chỉ `scalar-field-fill` đã tắt**. Các lớp còn lại — `fish-grid-fill`, `sea-scalar-fill`, `reef-fill`, `vung-long-fill`, `vms-<zone>-fill`, ba lớp `storm-*-fill` — đều **đã có lớp `line` riêng vẽ viền sắc nét đè lên**, nên lượt antialias kia không thêm gì cho mắt. Tắt = bớt **một lượt vẽ mỗi lớp mỗi ô**, **không mất độ đọc**. Rẻ, gọn, an toàn.

---

## 6. VIỆC 5 — Ba đề xuất đáng làm nhất

### 6.1 ① Bỏ 30 lớp chết khỏi `buildMapStyle` — giá trị cao, công sức thấp, rủi ro ~0

- **Tiết kiệm đo được**: style **61 → 31 lớp**; phép lọc mỗi ô z9 **1.591 → 1.049 (−34%)**; ô đông nhất **19.266 → 11.692**. Bớt 30 bucket, 30 lượt duyệt danh sách lớp mỗi khung.
- **Ảnh hưởng hình ảnh**: **không một pixel nào**. Đã chứng minh bằng dữ liệu, không bằng suy đoán (§2).
- **Công sức**: sửa bộ lọc `basemapGeom` trong `ocean-map.ts`, thêm một mảng id được giữ lại (danh sách trắng). ~15 dòng.
- **Rủi ro**: **có một cái, phải ghi lại** — nếu sau này sinh nền sâu hơn z9 (có `is_bridge`/`is_tunnel`) thì mấy lớp này sống lại và ta đang thiếu. Chốt chặn: chạy `node scripts/audit-style.mjs` mỗi lần sinh lại nền; ghi bước đó vào runbook nền bản đồ.
- **Đụng thứ cấm đánh đổi?** Không.

### 6.2 ② Bỏ nhóm `landuse` (10 lớp còn sống) — giá trị cao nhất, cần chủ dự án gật

- **Tiết kiệm đo được**: phép lọc mỗi ô z9 **1.049 → 184** (tức **1.591 → 184, −88%** so với hiện tại); style **31 → 21 lớp**. Quan trọng hơn: MapLibre **thôi hẳn việc phân tích source-layer `landuse`** — **86,5 feature / ~3.700 đỉnh mỗi ô z9**, cao điểm **847 feature một ô**. Đây là khoản nặng nhất trên worker.
- **Nói cho đúng**: byte vẫn nằm trong file cho tới khi nền được sinh lại (8,86 MB giải nén, 45% dung lượng nền) — **việc nén file là mảng của teammate nền bản đồ**. Phần style tiết kiệm là phân tích + dựng bucket + vẽ, không phải mạng.
- **Ảnh hưởng hình ảnh**: đất liền thành **một tông phẳng** (`earth` + `landcover`) thay vì các mảng công viên / trường / bệnh viện / ruộng.
- **Đụng thứ cấm đánh đổi?** **Không — và còn đi ngược lại: dễ đọc HƠN.** Hải đồ giấy vẽ đất một tông đúng là vì lý do này: mắt không bị mảng màu trên bờ kéo đi, ranh đất–nước hằn rõ hơn dưới nắng chói. Không đụng cỡ chữ, tap target, hay tương phản của bất cứ thứ gì.
- **Rủi ro**: đây là **thay đổi hình ảnh thấy được** ⇒ phải chủ dự án / chủ thiết kế gật, và cập nhật `01-product.md` + `03-design-system.md` + `07-design-spec.md` **cùng commit** (invariant doc-sync trong CLAUDE.md).
- **Biến thể nhẹ hơn nếu chưa muốn cắt hết**: giữ `landuse_beach` + `landuse_pedestrian` (mốc nhìn ven bờ), bỏ 8 lớp còn lại (`park`, `urban_green`, `hospital`, `industrial`, `school`, `zoo`, `aerodrome`, `runway`) — vẫn cắt được ~80% chi phí `landuse`.

### 6.3 ③ Tính sẵn nấc zoom vào dữ liệu — giá trị vừa, công sức vừa, rủi ro thấp

- **Báo hiệu**: thêm `minz` (9/11/13) lúc sinh `seamarks.v1.json` → **3 lớp `circle` còn 1**, **3 bucket còn 1**, mỗi ô lọc **1 lần thay vì 3** trên 5.851 điểm (far 552 / mid 2.071 / near 3.228).
- **Đẳng sâu**: thêm `mz` + `lz` lúc sinh `isobaths.v1.json` → bộ lọc từ `[">=", zoom, ["case", 3 nhánh]]` xuống `[">=", zoom, ["get","mz"]]`: **4 phép/đối-tượng → 2**, trên **5.110 đường × 2 lớp × mỗi nấc zoom** từ z5 lên z10+.
- **Ảnh hưởng hình ảnh**: **không đổi một pixel** — cùng luật, chỉ chuyển chỗ tính từ lúc vẽ sang lúc sinh dữ liệu.
- **Công sức**: sửa 2 script sinh dữ liệu + sinh lại 2 asset + sửa lớp trong `ocean-map.ts`/`fishing-map-view.tsx`, kèm test cho hàm tính `mz`/`lz`.
- **Rủi ro**: asset phải sinh lại đồng bộ với mã đọc nó; nếu file cũ còn trong service worker của máy bà con thì thiếu `mz` ⇒ **phải có đường lùi** (`["coalesce", ["get","mz"], <case cũ>]`) hoặc bump tên file lên `v2`. **Đây chạm vào offline — phải trả lời bốn câu hỏi soi của CLAUDE.md trong commit message.**

### Rẻ tới mức làm kèm luôn

- `validateStyle={false}` + `refreshExpiredTiles={false}` + `fadeDuration={0}` (§5) — ba dòng, không đổi pixel, và `refreshExpiredTiles` còn là điểm cộng offline.
- `"fill-antialias": false` cho 8 lớp fill trong suốt đã có `line` riêng (§5) — bớt một lượt vẽ mỗi lớp mỗi ô.
- Gộp `offline-coast` + `overlay-coast` về một source (§2) — bớt một lượt cắt ô cho 526 polygon.

---

## 7. Loại thẳng — nhanh nhưng làm bản đồ khó đọc hơn

| Ý tưởng | Tiết kiệm | Vì sao **LOẠI** |
|---|---|---|
| `pixelRatio = 1` | Lớn nhất trong tất cả (~8× số pixel phải tô trên máy DPR 3) | Nhoè số mét đẳng sâu và nét mảnh hải đồ. Người dùng là mắt 40–60 dưới nắng chói. **Cấm.** |
| Bỏ `text-halo-*` của nhãn | Bớt một lượt vẽ mỗi nhãn | Halo trắng chính là thứ giữ cho chữ đọc được trên mọi nền (nước, ảnh vệ tinh, mảng màu). Bỏ = chữ chìm. **Cấm.** |
| Giảm `text-size`, hoặc bỏ hẳn `isobath-labels` | Bỏ được lớp symbol nặng nhất | Số mét **là** hải đồ. Bỏ đi thì lớp "Hải đồ độ sâu" hết lý do tồn tại. **Cấm.** |
| `text-allow-overlap: true` để bỏ bước tránh chồng chữ | Bỏ hẳn bước bố trí va chạm — khoản đắt nhất của symbol | Chữ chồng lên nhau = không đọc được gì. **Cấm.** |
| Gộp `fuel-route-casing` vào `fuel-route-line` | Bớt 1 lớp line | Viền trắng dày dưới tuyến là **một trong ba thứ** giữ cho tuyến đỏ/cam không bị nhầm với ranh giới biển ("không được vượt, phạt nặng") — ghi rõ trong `ocean-map.ts`. Nhầm chỗ này là chuyện tiền phạt, không phải chuyện đẹp xấu. **Cấm.** |
| Hạ `line-opacity` đẳng sâu từ 0,85 xuống cho "nhẹ" | Không đo được là có tiết kiệm gì | 0,85 là **kết quả đo tương phản có ghi án lệ** trong `ocean-map.ts`: 0,55 cho ra 2,06:1, **dưới ngưỡng WCAG 3:1**. Hạ lại là đi lùi một lần sửa lỗi đã có bằng chứng. **Cấm.** |
| Bỏ `island-label` / `reef-label` cho nhẹ symbol | 2 lớp symbol | 103 + 13 điểm — tiết kiệm không đáng, mà nhãn tiếng Việt là **nội dung chủ quyền**, không phải trang trí. **Cấm.** |

Riêng chuyện **chồng lớp tô trong suốt** (§1.5): đây không phải chỗ cắt bằng tay dao style, mà là câu hỏi thiết kế — *"có nên cho bật cùng lúc 4 lớp tô nền không?"*. App đã có `anyExclusiveOverlay` khoá một phần. Đề nghị đưa cho chủ thiết kế, vì cắt bớt ở đây vừa nhanh hơn **vừa** dễ đọc hơn — hiếm khi hai thứ đi cùng chiều như vậy.

---

## 8. Không đo được ở Node — phải mở trình duyệt thật

Mọi số ở trên là **đầu vào của chi phí** (bao nhiêu lớp, bao nhiêu đối tượng, bao nhiêu phép tính mỗi đối tượng). Chúng **không phải** thời gian vẽ.

> Phần thời gian CPU/RAM đo được **ở Node** (JSON.parse, cắt ô geojson-vt, structured-clone, đọc PMTiles) là của bộ đo tổng — `scripts/bench-render.mjs` + [`toc-do-hien-thi-2026-08.md`](toc-do-hien-thi-2026-08.md). Không chép lại ở đây. Hai tài liệu **thống nhất** về ranh giới "không đo được ở Node" dưới đây.

Những thứ sau bắt buộc phải đo trên máy thật / trình duyệt thật, và **chưa ai đo**:

| Cần đo | Đo bằng gì | Vì sao không suy ra được |
|---|---|---|
| ms/khung hình khi kéo và zoom | DevTools Performance, CPU throttle 4–6× (giả lập máy rẻ) | Phụ thuộc GPU, driver, độ phân giải màn — không có công thức từ số lớp ra ms |
| Số lệnh vẽ GPU mỗi khung | spector.js / WebGL Insights | MapLibre gộp bucket theo cách phụ thuộc dữ liệu từng ô |
| Thời gian worker phân tích một ô MVT | Performance → track Worker | Phụ thuộc tốc độ CPU đơn nhân của máy |
| Thời gian bố trí nhãn symbol | Chỉ hiện trong trace | Chi phí va chạm nhãn phụ thuộc mật độ nhãn **thật sự chồng nhau** ở khung nhìn đó |
| Bộ nhớ VRAM / texture của lớp raster | `WEBGL_debug_renderer_info` + about:gpu | Không quan sát được từ file |
| **Trước–sau của cả ba đề xuất §6** | Cùng một kịch bản kéo/zoom, đo 3 lần, lấy trung vị | **Bắt buộc trước khi tuyên bố "nhanh hơn X%"** |

**Kịch bản đo đề nghị** (để lần sau ai đo cũng ra số so sánh được): mở `/ngu-truong` ở khung mặc định (110,8 E / 12,8 N / z4,6) → kéo dọc bờ từ Đà Nẵng vào Nha Trang → zoom lên z9 tại cửa Nha Trang → bật lớp "Vùng nhiều mồi" → tắt. Ghi ms/khung trung vị và số khung >32 ms cho từng đoạn, trên máy thật có DPR ≥ 2,5, CPU throttle 4×.

---

## 9. Việc KHÔNG thuộc mảng này (đã thấy, để lại cho đúng người)

- **Nén lại `vn-basemap.pmtiles`** — bỏ hẳn `places` (13.339 feature) + `pois` (628) mà không lớp nào dùng, và cân nhắc bỏ `landuse` khỏi file: → teammate **nền bản đồ**.
- **`reef-shapes.v1.json`** (2.622 feature, 29.242 đỉnh, vẽ bởi `reef-fill`/`reef-outline`/`reef-hazard`). Cạnh nó trong `public/data/` còn ba bản của cùng một bộ ACA: `.bin` 8,4 MB (bản mã đang đọc), `.pmtiles` 12,0 MB, và **`.json` 78,8 MB không thấy mã nào đọc** — nếu nó chỉ là bản trung gian lúc sinh thì đang nằm nhầm chỗ (`public/` được phục vụ ra ngoài). → teammate **lớp rạn**.
- **Bộ đo tổng / benchmark end-to-end**: → teammate **bộ đo**. Phần §8 ở trên là danh sách đặt hàng cho họ, không phải việc tự làm.
