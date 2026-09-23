# Đánh giá lớp "Hải đồ chi tiết" — 2026-09-03

> Reviewer: hải đồ (ký hiệu IHO INT1 / IALA vùng A, quen C-MAP & Navionics). Phạm vi: CHỈ ĐỌC mã + dữ liệu thật trong repo, không sửa. Mọi kết luận trỏ `file:dòng` hoặc số đo tính từ giá trị thật trong mã; chỗ nào phải nhìn màn hình mới chốt thì ghi rõ **[cần xem bằng mắt]**.
>
> Nền so sánh: hải đồ giấy VN (theo INT1) và C-MAP MAX/Navionics+ ở chế độ "Nautical".

## A. Chuẩn hải đồ

### A.0 Tóm tắt điểm

| # | Hạng mục | Kết luận | Một câu |
|---|---|---|---|
| 1 | Logic hiển thị theo zoom (SCAMIN) + thứ tự vẽ | **MỘT PHẦN** | Lớp chấm đã gate tốt (z7/8/9/11/13, đúng tinh thần C-MAP); nhưng **4 lớp đường của `sea-lanes` không có `minzoom`** (cáp/ống/vùng cấm/luồng/phân luồng vẽ từ z0), **giàn khoan bị vẽ HAI LẦN** từ hai nguồn (41/41 trùng toạ độ), ký hiệu hiểm hoạ OSM nằm **dưới** chấm đo sâu. |
| 2 | Phân màu | **MỘT PHẦN** | Phao IALA vùng A **ĐẠT** (đỏ-trụ trái, lục-nón phải, phương vị đen-vàng + chóp nón, cô lập, nước an toàn, chuyên dùng — đúng và có test pixel). Nhưng **cáp 2,44:1 và vùng cấm 2,43:1** trên nền biển (dưới sàn 3:1 chính repo đặt cho đẳng sâu), hai màu này **bằng nhau về độ sáng (1,00:1)** — dưới nắng/mù màu là một; chất đáy @0,5 chỉ **1,4–2,1:1**. |
| 3 | Cáp · ống khí · giàn khoan | **CHƯA ĐẠT** | Cáp quang và ống dẫn **gộp chung một `kind: "cap"`, vẽ một kiểu, không chạm được** → không phân biệt được thứ nguy hiểm hơn khi thả neo. 10 điểm cập bờ cáp là **chấm 1 px @0,6** — coi như không có. Vòng cấm neo 500 m chỉ nhìn ra từ ~z12 nhưng không có nhãn. |
| 4 | Rạn · bãi · đá · bãi ngầm — dễ hiểu | **MỘT PHẦN** | Dữ liệu CÓ `type` (bãi 650 · đá 390 · cồn 293 · rạn 41) nhưng lớp **không đọc `type`** — tất cả là chấm teal cùng cỡ; phân biệt duy nhất là chữ đầu tên. 27 tên **trùng giữa `vn-islands` (navy) và `coral-reefs` (teal)** → một chỗ hai chấm hai màu. Hình rạn ACA gần như vô hình (fill 1,11:1, viền 1,89:1). |
| 5 | Phân biệt bằng HÌNH | **MỘT PHẦN** | Bộ sprite tự vẽ 64 hình là điểm mạnh thật (phao/tiêu/đèn/xác tàu/chướng ngại/giàn/bè/cảng…). Còn **5 lớp là chấm tròn trơn**: đảo, rạn (×2), chất đáy, số đo sâu. **Vi phạm sàn 16 px do chính repo đặt**: xác tàu 14,4 px ở z8, đèn biển 13,2 px ở z7. Thiếu hình: đá ngầm riêng, cồn/bãi, điểm cập bờ cáp, ống dẫn, mũi tên phân luồng. |
| 6 | So với C-MAP | **MỘT PHẦN** | Hơn C-MAP: tên Việt + chủ quyền, offline thật, số đo sâu tô theo mớn + cũ/mới rỗng-đặc, tra ngược thông báo nhà nước, khu trú bão, đèn hiện từ z7. Thua C-MAP: chất đáy bằng CHỮ, dải độ sâu nhiều nấc + đường an toàn đậm, vùng cấm tô/hatch, mũi tên TSS, đặc tính đèn in cạnh đèn, chú giải ký hiệu trong app. |

---

### A.1 Kiểm kê lớp (thứ tự vẽ thật — dưới lên trên)

Nguồn: `src/components/fishing-map-view.tsx` (JSX sau = đè trên) và `src/lib/ocean-map.ts` (style nền + spec lớp). `CHART_ICON_SIZE` = 0,7→0,83→1,0 × 24 px tại z9/11/13 (`chart-symbols.ts:91-101`); MapLibre **kẹp** giá trị ngoài dải ⇒ dưới z9 vẫn 16,8 px.

| Thứ tự | Layer id | Type | minzoom | Màu / icon | Nguồn dữ liệu | Dòng |
|---|---|---|---|---|---|---|
| 0a | `isobath-du-nuoc` | fill | 5 | `#f2f8fa` @0,65 (vùng ≥10 m) | isobaths.v1.json k=vung | ocean-map.ts:809-819 |
| 0b | `isobath-lines` | line | 5 (gate theo mức: 5/10 m→z10, 20 m→z9, 50/100→z7, ≥200→z5) | `#3d6e96` @0,85 | isobaths k=duong | :820-858, gate :220-238 |
| 0c | `isobath-labels` | symbol | 6 (+1 nấc so với đường) | 11 px `#14324f` | — | :859-879 |
| 1 | `sea-lane-cap` | line | **không** | `#7c3aed` 1 px dash [0,5;2,5] @0,6 | sea-lanes kind=cap (113) | fishing-map-view.tsx:4116-4127 |
| 2 | `sea-lane-vungcam` | line | **không** | `#c2620c` 1,4 px dash [2,2] @0,75 | kind=vungcam (15) | :4129-4140 |
| 3 | `sea-lane-osm` | line | **không** | `#4a5a70` 1,4 px dash [1,5;1,5] @0,7 | luong 66 + phanluong 108 | :4142-4153 |
| 4 | `sea-lane-tuyen` | line | **không** | `#4a5a70` 1,6→2,6 px dash [3,2] @0,8 | tuyen (5, vẽ tay) | :4155-4166 |
| 5 | `sea-lane-gian` | symbol | 8 | icon `platform`, anchor center | giankhoan (41, OSM) | :4168-4180 |
| 6 | `sea-lane-label` | symbol | 4,5 | 11 px dọc đường | tuyen | :4182-4200 |
| 7 | `dia-danh-ngam-label` | symbol | 5 | 9→12,5 px teal `#0b5e66` | 184 tên TT 33/2024 | :4210-4229 |
| 8 | `island-dot` | circle | **không** | navy `#0f2f4d` r 1,4→3,4 | vn-islands (103) | :4242-4252 |
| 9 | `island-label` | symbol | không | bold 10→15 px, sort=rank | — | :4253-4272 |
| 10 | `reef-fill` | fill | không (tile) | `#4bbdc7` @0,18 | ACA pmtiles (reef+shoal, KHÔNG lọc kind) | :4296-4304 |
| 11 | `reef-outline` | line | không | `#0e7c86` 0,4→1,2 px @0,5 | — | :4305-4314 |
| 12 | `chat-day-dot` | circle | 9 (kho tile) | 6 màu `CHAT_DAY_COLORS` r 1,1→3 @0,5 | chat-day pmtiles 362K điểm | :4327-4346 |
| 13 | `reef-hazard` | symbol | 8 | `wreck` / `obstruction` | reef-shapes OSM rock 45 + wreck 42 | :4362-4374 |
| 14 | `depth-line` | line | 9 | 3 màu theo dải, 1,6→3,4 px @0,8 | fairway-depths (13 đoạn) | ocean-map.ts:411-422 |
| 15 | `sounding-dot` | circle | 11 | 3 màu; cũ = rỗng ruột | soundings (379) | :437-456 |
| 16 | `sounding-label` | symbol | 12,5 | 12→16 px, bên phải chấm | — | :503-521 |
| 17 | `seamark-far` | symbol | 9 | icon `ic` (light_major, light_vessel, virtual_aton, **platform**, landmark) | seamarks OSM 5.851 | fishing-map-view.tsx:4404-4437, danh sách :192-208 |
| 18 | `seamark-mid` | symbol | 11 | light_minor, light_float, buoy_cardinal, iso_danger, safe_water, marine_farm, anchorage, **harbour** | — | — |
| 19 | `seamark-near` | symbol | 13 | mọi loại còn lại (buoy_lateral **1.868**, special 612, mooring 349, gate 162…) | — | — |
| 20 | `reef-dot` | circle | 7 | teal `#0e7c86` r 1,6→3,6 | coral-reefs group≠ven-bo (149) | :4454-4466 |
| 21 | `reef-dot-venbo` | circle | 8 | teal r 2,2→4 | ven-bo (1.225) | :4467-4479 |
| 22 | `reef-label` | symbol | **không** | bold 10→15 px teal | ngoài khơi | :4480-4500 |
| 23 | `reef-label-venbo` | symbol | 8 | bold 11→13 px | ven bờ | :4501-4522 |
| 24 | `vn-aid` | symbol | 9 | icon `ic` (chartSymbolId + câu tác dụng) | vn-aids Cục HH (1.447 bản ghi) | :4545-4556 |
| 25 | `xac-tau` | symbol | 8 | `wreck`/`wreck-depth`/`obstruction`, icon-size **0,6**→0,95→1,2 | xac-tau (43) | ocean-map.ts:358-385 |
| 26 | `den-bien` | symbol | 7 | `lighthouse`, icon-size **0,55**→0,95→1,25 | den-bien (105 bản ghi / 90 ngọn) | :466-479 |
| 27 | `den-bien-ten` | symbol | 9 | bold 11→15 px magenta | — | :483-501 |
| 28 | `khu-tru-bao-dot` | symbol | 5 | icon **`harbour`** (trùng icon OSM harbour) | khu-tru-bao (51) | fishing-map-view.tsx:4588-4599 |
| 29 | `sel-halo-*` | circle | — | vòng chọn xanh | — | :4606-4631 |
| 30 | nhãn chủ quyền | HTML Marker | — | trên cùng | — | :4635+ |

Chạm được (`hitLayers`, :2704-2730): seamark-far/mid/near, sounding-dot, den-bien, khu-tru-bao-dot, xac-tau, vn-aid, chat-day. **KHÔNG chạm được**: mọi lớp `sea-lane-*` (cáp/ống/giàn/vùng cấm), reef-hazard, reef-dot, island-dot, dia-danh-ngam.

---

### A.2 Hạng mục 1 — SCAMIN và thứ tự vẽ: **MỘT PHẦN**

**Đạt (chắc chắn từ mã):**
- Bậc thang zoom cho vật thể điểm là hợp lý và giống cách C-MAP giãn lược: đèn biển z7 (tầm hiệu lực xa) → hiểm hoạ/giàn z8 → phao chính + báo hiệu nhà nước z9 → phao phụ z11 → phao luồng/chuyên dùng z13; số đo sâu z11, số z12,5 (`ocean-map.ts:321-338, 355`; `fishing-map-view.tsx:185-208`). Đẳng sâu gate theo mức nông/sâu (`ocean-map.ts:220-238`) là đúng bài hải đồ giấy.
- Số đo sâu + đường luồng đã đưa xuống **dưới** ký hiệu điều hướng (sửa 2026-09-03, :4383-4400) — đúng nguyên tắc "số là chỗ nước, ký hiệu là vật phải tránh".
- Nhãn đảo vẽ sau nhãn địa danh ngầm và nhãn tuyến ⇒ tên đảo thắng va chạm (:4204-4207).

**Chưa đạt (chắc chắn từ mã):**

1. **Bốn lớp đường của `sea-lanes` không có `minzoom`** (:4116-4166). Ở z4–6 (toàn cảnh cả nước) vẫn vẽ 113 đoạn cáp/ống (có tuyến 76 đỉnh trong vịnh Thái Lan), 15 vòng vùng cấm, 174 đoạn luồng/phân luồng. Điều này **mâu thuẫn thẳng với spec đã chốt** *"zoom xa CHỈ hiện bờ + đèn lớn + đẳng sâu + nhãn chủ quyền"* (`07-design-spec.md:586`). Vì nét 1–1,4 px mờ 0,6–0,75 nên ở toàn cảnh nó thành "sợi rác" — nhìn thấy là nhiễu, không đọc ra là tin. **[cần xem bằng mắt]** mức độ rối thực tế ở z5–6 quanh Vũng Tàu và vịnh Bắc Bộ (nơi cáp/luồng dày).
   - *Sửa:* `sea-lane-cap` minzoom 8, `sea-lane-vungcam` 8, `sea-lane-osm` 9 (luồng cảng chỉ có nghĩa khi áp bờ), `sea-lane-tuyen` giữ (5 tuyến lớn, là mốc vùng). Nhỏ.

2. **Giàn khoan vẽ HAI LẦN từ hai nguồn.** `sea-lane-gian` (z8, icon `platform`, anchor **center**, :4168-4180) và `seamark-far` (z9, `SEAMARK_FAR` chứa `platform`, anchor **bottom**, :192-198 + :4434). Cả hai đều lấy từ OSM `seamark:type=platform` (`generate-sea-lanes.mjs:113-114, 150`). Kiểm dữ liệu thật: **41/41 điểm `giankhoan` nằm trong 50 m của một `platform` trong `seamarks.v1.json`**. Từ z9 mỗi giàn có hai ký hiệu lệch nhau ~12 px theo trục dọc (anchor khác nhau). Cùng bệnh nhẹ hơn với đèn biển: 9/105 bản ghi `den-bien` nằm trong 300 m một `light_major` OSM ⇒ từ z9 có 9 ngọn mang cả hình `lighthouse` (sao + tia) lẫn `light-major` (tháp).
   - *Sửa:* bỏ `platform` khỏi `SEAMARK_FAR` và lọc `t != platform` ở `seamark-near` (hoặc ngược lại bỏ `sea-lane-gian` và chuyển giàn khoan về nguồn seamarks có `-lit`). Với đèn: lọc `light_major` OSM trong bán kính 300 m của `den-bien` lúc sinh dữ liệu (`generate-seamarks.mjs`). Nhỏ–vừa.

3. **Ký hiệu hiểm hoạ OSM (`reef-hazard`, đá ngầm + xác tàu) vẽ DƯỚI số đo sâu, phao, chấm rạn** (:4362 trước :4390-4523). Trên hải đồ, đá ngầm/xác tàu là lớp "vật phải tránh" — đứng cùng bậc với `xac-tau` chính thức (đang ở :4571, gần trên cùng). Một đá ngầm OSM ở luồng Vũng Tàu (nơi 135 chấm đo sâu) sẽ bị chấm đo sâu đè. **[cần xem bằng mắt]** đã có ảnh 2026-09-03 chứng minh cùng lỗi cho phao.
   - *Sửa:* dời khối `reef-hazards` xuống ngay trước `xac-tau-src`. Nhỏ.

4. **`khu-tru-bao-dot` hiện từ z5 với `icon-allow-overlap: true`** (:4591-4596) và `CHART_ICON_SIZE` kẹp ở 0,7 ⇒ 51 icon 16,8 px "mỏ neo trong vòng" phủ dọc bờ ngay ở toàn cảnh, không né nhau. Cùng mâu thuẫn với spec :586. Ý "bến an toàn phải thấy sớm" là đúng, nhưng z5 là cả nước — chưa ai chọn bến ở tỉ lệ đó.
   - *Sửa:* minzoom 7 (cùng nấc đèn biển — cùng lý do "định hướng vùng"). Nhỏ.

5. **`reef-dot` z7 nhưng `reef-label` không gate** (:4457 vs :4480-4494): dưới z7, 149 tên ngoài khơi treo lơ lửng với `text-anchor: top, offset 0,55` mà không có chấm bên trên. Spec :586 chủ ý giữ tên làm mốc chủ quyền — chấp nhận được, nhưng nên đổi anchor thành `center` khi z<7 để chữ không "chừa chỗ" cho một chấm không có. Nhỏ, thẩm mỹ.

6. **Nhãn số đo sâu/đẳng sâu 11 px cố định** (`ocean-map.ts:871`, `fishing-map-view.tsx:4191`) và địa danh ngầm **9 px ở z5** (:4217). Đây là chữ nội dung bản đồ nên không bị luật 18 px của UI, nhưng 9–11 px trên tàu lắc dưới nắng là dưới ngưỡng "20 px làm việc" chính repo tính ra cho ký hiệu (`chart-symbols.ts:62-81`). Vừa — cân với mật độ.

---

### A.3 Hạng mục 2 — Phân màu: **MỘT PHẦN**

**IALA vùng A — ĐẠT, có bằng chứng:**
- Trái luồng = **trụ đỏ** `CAN`+`RED`, phải luồng = **nón xanh lục** `CONE`+`GREEN` (`build-chart-sprite.mjs:294-295`); chuyển hướng luồng chính đúng băng đỏ-lục-đỏ / lục-đỏ-lục (:297-302); phương vị đen-vàng đúng bốn kiểu + chóp nón chỉ về phía đen (:312-323, `chart-symbols.ts:210-227`); cô lập đen-đỏ-đen + 2 cầu (:343-345); nước an toàn sọc dọc đỏ-trắng + cầu đỏ (:348-350); chuyên dùng vàng chữ X (:353). Bên luồng suy từ **câu tác dụng của Cục Hàng hải** trước, màu thân sau, màu đèn cuối (`chart-symbols.ts:303-334`) — đúng thứ tự tin cậy. Không rõ thì vẽ biến thể `-unknown` thay vì đoán (:31-36) — đúng tinh thần an toàn.
- Test pixel đối chiếu bảng màu và sàn tương phản viền (`chart-symbols.test.ts:447-513`).
- Magenta cho "có đèn" đúng quy ước giấy (`ocean-map.ts:256-263`).

**Chưa đạt — số đo tương phản (tính từ hex + opacity thật trong mã, nền `SEA_MASK_COLOR #d5e8eb`; nền "đủ nước" sau phủ `#f2f8fa`@0,65 = `#e8f2f5`):**

| Lớp | Màu @ độ mờ | Tương phản nền biển | Trên dải "đủ nước" | Sàn repo 3:1 |
|---|---|---|---|---|
| cáp/ống `sea-lane-cap` | `#7c3aed` @0,6 | **2,44** | 2,56 | ✗ |
| vùng cấm `sea-lane-vungcam` | `#c2620c` @0,75 | **2,43** | 2,61 | ✗ |
| luồng/phân luồng | `#4a5a70` @0,7 | 3,00 | 3,19 | sát sàn |
| viền rạn `reef-outline` | `#0e7c86` @0,5 | **1,89** | 1,97 | ✗ |
| nền rạn `reef-fill` | `#4bbdc7` @0,18 | **1,11** | 1,13 | ✗ (chủ ý mờ, nhưng mờ tới mức không thấy) |
| chất đáy Cát / San hô / Vụn / Cỏ / Rong / Đá | @0,5 | **1,39 / 1,64 / 1,71 / 1,69 / 1,64 / 2,11** | +0,06 | ✗ tất cả |
| chấm rạn `reef-dot` @0,9 | `#0e7c86` | 3,36 | 3,69 | ✓ |
| hiểm hoạ `#b45309` · xác tàu `#5b2333` · đảo navy | đặc | 3,96 · 9,56 · 8,25 | ✓ | ✓ |
| đẳng sâu (đối chứng) | `#3d6e96` @0,85 | 3,32 | 3,59 | ✓ (đã có cổng test :390) |

Repo đã tự rút bài học *"màu chọn không sai, độ mờ mới là thủ phạm"* cho đẳng sâu (`ocean-map.ts:846-856`) và dựng cổng test — nhưng **cổng đó chỉ soi lớp trong `buildMapStyle`**; mọi lớp viết trong JSX (cáp, vùng cấm, rạn, chất đáy) đứng ngoài cổng, và tất cả đều rơi dưới sàn. Chính comment `ocean-map.ts:400-410` đã cảnh báo đúng chuyện này.

- **Cáp tím vs vùng cấm cam: tương phản độ sáng giữa hai màu = 1,00:1.** Hai nét chỉ khác nhau bằng hue. Dưới nắng chói (mất bão hoà) hoặc với ~8 % đàn ông mù màu đỏ-lục, "cáp" và "cấm neo" là **một màu xám**. Tím `#7c3aed` tự nó không sai (magenta của hải đồ giấy đã bị lớp "có đèn" chiếm, tránh là đúng), nhưng phải khác **về nét** chứ không chỉ về hue — xem A.4.
- **Đỏ độ sâu `#b3261e` vs đỏ ranh giới `#b42318`** (`ocean-map.ts:306` vs quy ước :522) — gần như cùng hex, trong khi đầu file tuyên bố cam-đỏ độc quyền cho ranh giới. Cứu được nhờ hình (chấm nhỏ vs đường dài), nhưng ở z11 chấm đo sâu <4 m nằm sát đường ranh vùng lộng là cùng màu. Ghi nhận, không phải lỗi chặn.
- **San hô chất đáy `#e2674a`** (cam-đỏ) lấn kênh cam của hiểm hoạ `#b45309` / vùng cấm `#c2620c`. Chất đáy là "thông tin nền" nhưng lại mang màu của nhóm "cảnh báo". C-MAP để chất đáy **không màu** (chữ) đúng vì lý do này.
- Teal rạn `#0e7c86` vs xanh trú bão `#0e8a5f`: 1,14:1 — chỉ hình cứu (chấm vs icon mỏ neo). Chấp nhận.

---

### A.4 Hạng mục 3 — Cáp biển · ống dẫn · giàn khoan: **CHƯA ĐẠT**

| Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|
| Có hiện chưa? | Có: 78 cáp + 25 ống (OSM) + 10 điểm cập bờ cáp quang VN; 41 giàn; 8 khu hạn chế + 7 vòng cấm neo 500 m | `vn-sea-lanes.v1.json` đếm thật; `generate-sea-lanes.mjs:27, 351-364, 391-416` |
| Dễ thấy chưa? | **Không.** 1 px, dash [0,5;2,5] (nét 0,5 px, hở 2,5 px = 17 % nét), @0,6 ⇒ 2,44:1 | `fishing-map-view.tsx:4121-4126` |
| Cáp quang vs ống dẫn phân biệt được không? | **Không.** `osmKind()` gộp `cable_submarine` + `pipeline_submarine` → một `kind: "cap"` (:149); lớp lọc `kind == cap` vẽ một kiểu; khác nhau chỉ còn trong chuỗi `ten` ("Cáp ngầm biển…" / "Ống ngầm biển…") — mà lớp **không nằm trong `hitLayers`** (:2704-2730) nên chuỗi này không bao giờ tới mắt bà con | `generate-sea-lanes.mjs:146-154, 169-172`; `fishing-map-view.tsx:4119` |
| Giàn khoan có hình + vòng 500 m nhìn ra không? | Hình `platform` (khối trên 4 chân) tự vẽ, rõ, từ z8 — **ĐẠT** (nhưng bị vẽ đôi, xem A.2-2). Vòng 500 m: bán kính 500 m ở z8 ≈ 0,8 px, z10 ≈ 3 px, **z12 mới ≈ 13 px** — dưới z12 là một chấm; không nhãn, không hình "cấm neo", không tô | `build-chart-sprite.mjs:435-441`; `generate-sea-lanes.mjs:351-364`; :4129-4140 |
| Điểm cập bờ cáp (LineString độ dài 0) hiện thành gì? | Hai đỉnh trùng + `line-cap: round` + width 1 ⇒ **một chấm đường kính ~1 px @0,6** — bằng một hạt bụi trên màn. Comment trong script tự thừa nhận "chấm nhỏ" | `generate-sea-lanes.mjs:406-414`; :4120-4124 |

**Vì sao đây là lỗi an toàn chứ không phải thẩm mỹ:** hải đồ INT1 vẽ cáp (L30-L32) và ống dẫn (L40-L44) **khác nhau** vì hệ quả khác nhau — kéo lưới/neo trúng cáp quang là bồi thường; trúng ống dẫn khí là cháy nổ. Vùng Bạch Hổ–Rồng–Nam Côn Sơn (25 ống trong dữ liệu) là đúng ngư trường tàu giã cào Bà Rịa.

**Sửa cụ thể:**
1. `generate-sea-lanes.mjs:149`: tách `kind: "ong"` cho `pipeline_submarine` (giữ `cap` cho cáp). Cập nhật test bất biến `islands.test.ts` nếu đếm theo kind. Nhỏ.
2. Hai lớp: `sea-lane-cap` (cáp) nét 1,8 px, dash [4,2] @0,9 tím; `sea-lane-ong` (ống) nét 2,2 px **liền** kèm lớp symbol `symbol-placement: line` dán chữ "ỐNG DẪN" (Noto Sans Bold 11) mỗi 400 px từ z9. Tương phản mục tiêu ≥3:1 sau pha mờ — thêm hai màu này vào cổng test tương phản (dời spec lớp về `ocean-map.ts` như đã làm với `DEPTH_LINE_LAYER` để cổng soi được). Vừa.
3. Điểm cập bờ: sinh thành **Point** riêng (`kind: "cap-bo"`) và vẽ bằng icon sprite mới `cable-landing` (tự vẽ: nửa vòng tròn + tia chấm xuống nước), minzoom 8. Bỏ mẹo LineString-0 (hợp lệ về test nhưng vô hình về hiển thị). Nhỏ–vừa.
4. Vòng cấm neo 500 m: thêm lớp symbol tâm vòng với icon mới `no-anchor` (mỏ neo gạch chéo, tự vẽ) từ z10, và fill cam @0,08 trong vòng để "vùng" đọc ra là vùng. Nhỏ.
5. Đưa `sea-lane-cap`/`-ong`/`-vungcam`/`-gian` vào `hitLayers` để chạm ra `ten`. Nhỏ.

---

### A.5 Hạng mục 4 — Rạn · bãi cạn · đá · bãi ngầm · đảo nổi: **MỘT PHẦN**

**Dữ liệu thật:**
- `coral-reefs.v1.json` 1.374 điểm, thuộc tính `type` ∈ {bai 650, da 390, con 293, ran 41}, `group` ∈ {ven-bo 1.225, truong-sa 106, hoang-sa 28, them-luc-dia 15}, `rank` 2/3.
- `vn-islands.v1.json` 103 điểm, `type` ∈ {dao 60, quan-dao 7, **da 22, bai 10, con 4**}.
- `reef-shapes.v1.json` (OSM): rock 45, wreck 42 (điểm); reef/shoal polygon+line — nhưng lớp `reef-hazard` chỉ vẽ rock+wreck (:4366); polygon OSM không vẽ (thay bằng ACA pmtiles).
- ACA pmtiles: `kind` reef/shoal — lớp `reef-fill`/`reef-outline` **không lọc kind** ⇒ rạn san hô và bãi cạn cùng một màu tô.

**Người nhìn phân biệt được gì?**

| Đối tượng | Hiện thành | Phân biệt được với thứ bên cạnh? |
|---|---|---|
| Đảo nổi (`dao`) | chấm navy + tên bold navy | ✓ với rạn (navy vs teal) |
| Đá / bãi / cồn trong `vn-islands` (36 điểm) | **chấm navy như đảo** | ✗ — "Đá Lớn" trông y như một hòn đảo lên được |
| Đá (390) trong `coral-reefs` | chấm teal r 2,2–4 | ✗ với bãi/cồn/rạn — cùng chấm, cùng cỡ, cùng màu; `type` không được đọc ở bất kỳ lớp nào (:4454-4522) |
| Bãi (650) — gồm cả **bãi cạn** (nguy hiểm) lẫn **bãi ngầm** (ngư trường) | chấm teal | ✗ — dữ liệu không tách hai nghĩa; chữ "Bãi" không nói ngập hay không |
| Cồn (293) | chấm teal | ✗ |
| Rạn (41) + hình ACA | chấm teal + fill 1,11:1 | hình gần như không thấy |
| Đá ngầm OSM (45) | icon `obstruction` (+ trong vòng chấm) | ✓ khác chấm teal — nhưng **cùng icon với chướng ngại/vật chìm** của `xac-tau` (`chart-symbols.ts:359-365`; :4368) ⇒ "đá" và "vật chìm nhân tạo" là một |

Phân biệt duy nhất đang có là **chữ đầu của tên** ("Đá …", "Bãi …", "Cồn …", "Rạn …"). Với bà con đó là tiếng Việt đời thường nên **không tệ** — nhưng chỉ hoạt động khi nhãn thắng va chạm; ở z8 với 1.225 tên ven bờ cùng `rank: 3` (không ai ưu tiên ai), chỗ dày (Khánh Hoà, Kiên Giang) nhãn rụng hàng loạt và chỉ còn chấm teal câm. **[cần xem bằng mắt]** mật độ rụng nhãn ở z8–9 quanh vịnh Nha Trang / Hà Tiên.

**Trùng giữa hai nguồn (đếm thật):** 27 tên có trong cả `vn-islands` lẫn `coral-reefs` (Đá Lớn, Đá Nam, Đá Đông, Đá Lát, Bãi Thuỷ Tề, Cồn Cát Nam…). Cùng một vị trí có **chấm navy + tên navy** (lớp islands, không gate) và **chấm teal + tên teal** (lớp reefs, z7). Hai nhãn bold cùng anchor `top` offset 0,55 ⇒ chồng đúng chỗ; collision sẽ giấu một cái nhưng cái nào thắng là tuỳ thứ tự — tức màu của cùng một Đá Lớn đổi theo zoom. Chắc chắn từ dữ liệu; hình dạng thật **[cần xem bằng mắt]**.

**Sửa cụ thể:**
1. `coral-reefs` — đọc `type` ở lớp: tách `reef-dot*` thành symbol với icon theo `type`: `da` → icon mới **`rock`** (dấu × đậm/asterisk tự vẽ, INK — "đá = nguy hiểm"), `bai`/`con` → icon **`bank`** (nửa elip chấm — "bãi = cạn, có thể ngập"), `ran` → icon **`reef`** (răng cưa nhỏ). Ba hình, một màu teal. Vừa (cần vẽ 3 icon + test sprite).
2. `generate-coral-reefs.mjs`: khử trùng với `vn-islands` theo tên+khoảng cách <2 km — giữ bản islands cho `dao`, giữ bản reefs cho `da/bai/con` (và bỏ 36 điểm không phải đảo khỏi islands, hoặc ngược lại). Nhỏ.
3. `reef-fill` 0,18→0,30 và `reef-outline` @0,5→0,85 (mục tiêu viền ≥3:1); lọc `kind == shoal` vẽ viền chấm khác rạn. Nhỏ; đưa vào cổng tương phản.
4. `reef-hazard` rock → icon `rock` riêng (không dùng chung `obstruction`). Nhỏ sau khi có icon ở (1).
5. `symbol-sort-key` cho ven-bo: ưu tiên `type == da` (nguy hiểm) thắng va chạm trước `bai`/`con`. Nhỏ.

---

### A.6 Hạng mục 5 — Phân biệt bằng HÌNH: **MỘT PHẦN**

**Điểm mạnh thật:** sprite 64 ô tự vẽ (`chart-sprite.json`), phủ 100 % loại seamark + vn-aids (test :191, :246), biến thể `-lit` nướng sẵn, hình xác tàu / chướng ngại / hải đăng tự sáng tác và có test bóng khác ≥61 % (`ocean-map.ts:351-353`). Trụ-vs-nón được khoá bằng test (`chart-symbols.ts:135`). Đây là chỗ app **đúng chất hải đồ hơn nhiều app "nautical" trên store**.

**Còn là chấm tròn màu đơn thuần (chắc chắn từ mã):**

| Lớp | Vì sao chấm chưa đủ |
|---|---|
| `island-dot` | 36/103 không phải đảo (đá/bãi/cồn) mà vẫn là chấm navy như đảo |
| `reef-dot`, `reef-dot-venbo` | 4 loại một chấm (A.5) |
| `chat-day-dot` | 6 màu @0,5, tương phản 1,4–2,1 — không có hình, không có chữ; phải mở chú giải mới hiểu (chính chủ dự án đã hỏi "cái này là cái gì", :5197) |
| `sounding-dot` | chấp nhận được — hải đồ giấy cũng chỉ là số; rỗng/đặc cho cũ/mới là ý hay |
| điểm cập bờ cáp | 1 px, không hình (A.4) |

**Vi phạm sàn cỡ do chính repo đặt (`CHART_ICON_MIN_PX = 16`, `chart-symbols.ts:63-81`):**
- `WRECK_LAYER` icon-size **0,6 ở z8** ⇒ 14,4 px (`ocean-map.ts:364`).
- `LIGHTHOUSE_LAYER` icon-size **0,55 ở z7** ⇒ 13,2 px (:472).
- Test "mọi nấc zoom của icon-size đều trên sàn" (`chart-symbols.test.ts:669`) chỉ soi `CHART_ICON_SIZE`, không soi hai spec này. Đúng nấc mà hai lớp này được cho hiện sớm "vì quan trọng" lại là nấc chúng nhỏ hơn sàn.
  - *Sửa:* nâng về 0,7 (16,8 px) ở nấc thấp nhất; thêm hai spec vào test sàn. Nhỏ.

**Icon trong sprite chưa dùng / nên có:**
- Chưa dùng (không loại nào ánh xạ tới trong dữ liệu hiện có): `installation`/`installation-lit` (`buoy_installation` không có trong 21 loại của seamarks.v1.json), `light-vessel` (0 bản ghi VN — không sao), `bcn-safe-water`, `bcn-special`, `bcn-iso-danger` (hiếm). Không cần gỡ.
- **Thiếu, nên thêm** (đều tự vẽ, cùng luật viền INK): `rock` (đá ngầm), `bank` (bãi/cồn), `reef` (rạn), `cable-landing`, `no-anchor` (cấm neo), `tss-arrow` (mũi tên phân luồng, dùng `symbol-placement: line`), `fishing-port` (cảng cá — tách khỏi `harbour` để khu trú bão không trùng hình với 279 harbour OSM, trong đó 91 ở bờ VN, cùng hiện ở z11).

---

### A.7 Hạng mục 6 — So với C-MAP: **MỘT PHẦN**

**SDFish làm TỐT HƠN C-MAP/Navionics (với ngư dân VN):**
1. Tên tiếng Việt cho 1.374 rạn/bãi + 184 địa danh ngầm + 103 đảo + nhãn chủ quyền — C-MAP dùng tên quốc tế và tên Trung Quốc ở Hoàng Sa/Trường Sa.
2. Offline thật: mọi lớp là asset cùng-origin trong SW; C-MAP cần mua tải vùng.
3. Số đo sâu **tô theo mớn tàu cá** (đỏ <4 m) và **cũ/mới bằng rỗng-đặc** — C-MAP không cho biết tuổi khảo sát.
4. Tra ngược **số thông báo hàng hải** khi chạm phao/xác tàu (`vn-aid`, `xac-tau`) — C-MAP không có.
5. Khu tránh trú bão + sức chứa; con nước gắn vào số đo sâu ("chờ nước lên hãy qua").
6. Đèn biển hiện từ z7 với tia magenta — sớm và rõ hơn C-MAP ở mức vùng.
7. Bên luồng của phao suy từ câu tác dụng nhà nước, và "chưa rõ" thì vẽ chưa rõ — trung thực hơn nhiều app.

**C-MAP làm mà SDFish CHƯA:**

| Thứ C-MAP có | SDFish hiện tại | Đề xuất |
|---|---|---|
| Chất đáy bằng **chữ** (S, M, Co, R, Sh…) in cạnh số đo sâu, không màu | 362K chấm màu @0,5 + chú giải góc | Từ z12: lớp symbol `text-field` mã chữ tiếng Việt ngắn ("C" cát · "Đ" đá · "Sh" san hô · "V" vụn · "Cỏ") màu INK 11 px, `symbol-spacing` thưa; chấm màu chỉ giữ z9–12. Vừa |
| **Dải độ sâu nhiều nấc** (0–2, 2–5, 5–10, 10–20 m) + **đường an toàn** do người dùng đặt, vẽ đậm | Một dải: ≥10 m sáng (`isobath-du-nuoc`), nét 0,5–1,1 px đồng đều | `isobaths` đã có `k=vung` 8 mức từ 10 m ⇒ thêm dải 20 m (sáng hơn nữa) không tốn dữ liệu; **đường 5 m vẽ đậm 2 px** như "safety contour" cho mớn 2–3 m. Nhỏ–vừa |
| Vùng cấm/hạn chế **tô hatch** + ký hiệu trong vùng | Viền đứt 1,4 px @0,75 | Fill @0,08 + icon `no-anchor` tâm vùng (A.4-4). Nhỏ |
| Cáp và ống **hai ký hiệu khác nhau**, chữ "Cable"/"Pipeline" dọc tuyến | Một nét tím mảnh | A.4-1/2. Vừa |
| **Mũi tên** hướng đi trong phân luồng (TSS) | 108 đoạn `phanluong` là nét đứt không hướng | Icon `tss-arrow` `symbol-placement: line`, z≥9. Nhỏ (OSM `separation_lane` có hướng theo chiều vẽ way) |
| **Đặc tính đèn in cạnh đèn** ("Fl(2) 10s 25M") | Chỉ khi chạm (`den-bien-ten` chỉ có tên) | z≥11: dòng 2 của nhãn = câu tiếng Việt ngắn có sẵn trong `den-bien.ts` ("Chớp 2 · 10 s · 20 hl"). Nhỏ |
| **Chú giải ký hiệu** trong app | Chỉ có chú giải chất đáy (:5197-5225) | Sheet "Chú giải hải đồ" trong `ra-khoi-controls.tsx` dưới công tắc "Hải đồ chi tiết": 12 hình sprite + 1 câu mỗi hình. Vừa |
| Đá ngầm phân loại (ngập / lộ theo triều / luôn chìm có độ sâu) | Một icon `obstruction` cho cả đá lẫn vật chìm | A.5-1/4 |
| Vùng bãi triều (foreshore) tô lục | Không | ACA có lớp intertidal nhưng chưa dùng — cân nhắc sau, ít cấp bách |

---

### A.8 TOP 8 việc sửa ưu tiên

| # | Việc | File | Đổi gì | Cỡ |
|---|---|---|---|---|
| 1 | **Tách cáp ↔ ống dẫn**, vẽ hai kiểu, chạm được | `scripts/generate-sea-lanes.mjs:149`; `fishing-map-view.tsx:4116-4127, 2704-2730` | `kind: "ong"` riêng; lớp ống nét liền 2,2 px + chữ "ỐNG DẪN" dọc tuyến từ z9; lớp cáp 1,8 px dash [4,2]; cả hai @≥0,9; đưa vào `hitLayers` | Vừa |
| 2 | **Gate zoom cho 4 lớp đường `sea-lane-*`** + `khu-tru-bao` z7 | `fishing-map-view.tsx:4116-4166, 4591` | `minzoom` cáp/ống 8 · vùng cấm 8 · luồng/phân luồng 9 · khu trú bão 7 | Nhỏ |
| 3 | **Khử vẽ đôi giàn khoan** (41/41) và 9 đèn biển trùng OSM | `fishing-map-view.tsx:192-198`; `scripts/generate-seamarks.mjs` | bỏ `platform` khỏi `SEAMARK_FAR` và loại `t=platform` ở `seamark-near`; lọc `light_major` OSM trong 300 m của `den-bien` lúc sinh | Nhỏ–vừa |
| 4 | **Nâng tương phản lớp JSX lên sàn 3:1 và đưa vào cổng test** | `fishing-map-view.tsx:4121-4140, 4300-4313, 4344`; `src/lib/ocean-map.ts` + `ocean-map.test.ts` | dời spec cáp/ống/vùng cấm/rạn/chất đáy về `ocean-map.ts` như `DEPTH_LINE_LAYER`; opacity: vùng cấm 0,9, viền rạn 0,85, fill rạn 0,3, chất đáy 0,75; cổng đo sau pha mờ như :390 | Vừa |
| 5 | **Ba hình cho đá / bãi-cồn / rạn** thay chấm teal; đá ngầm OSM dùng `rock` | `scripts/build-chart-sprite.mjs`; `fishing-map-view.tsx:4454-4479, 4368`; `chart-symbols.ts` | thêm `rock`/`bank`/`reef` (tự vẽ, test bóng); `reef-dot*` → symbol `icon-image` match `type`; sort-key ưu tiên `da` | Vừa |
| 6 | **Khử trùng 27 tên giữa islands ↔ coral-reefs** | `scripts/generate-coral-reefs.mjs` / `generate-islands.mjs` | quy ước: `dao`/`quan-dao` ở islands; `da`/`bai`/`con` chỉ ở reefs; test đếm giao = 0 | Nhỏ |
| 7 | **Sàn 16 px cho xác tàu và đèn biển** + đưa vào test | `ocean-map.ts:364, 472`; `chart-symbols.test.ts:669` | nấc thấp nhất 0,55/0,6 → 0,7; test quét cả `WRECK_LAYER`, `LIGHTHOUSE_LAYER` | Nhỏ |
| 8 | **Điểm cập bờ cáp thành icon + vòng cấm neo có hình** + dời `reef-hazards` lên trên số đo sâu | `generate-sea-lanes.mjs:406-414, 351-364`; `build-chart-sprite.mjs`; `fishing-map-view.tsx:4361` | Point `kind: "cap-bo"` + icon `cable-landing` z8; icon `no-anchor` tâm vòng z10 + fill @0,08; khối `reef-hazards` chuyển xuống ngay trước `xac-tau-src` | Nhỏ–vừa |

Sau TOP 8 (đợt 2, để "ngang C-MAP"): chất đáy bằng chữ từ z12 · dải 20 m + đường 5 m đậm · mũi tên TSS · đặc tính đèn cạnh đèn từ z11 · sheet chú giải ký hiệu.

### A.9 Những gì cần xem bằng mắt mới chốt (không có ảnh màn hình trong review này)

1. Mức rối thật của cáp/luồng ở z5–6 (A.2-1) — dự đoán "sợi rác mờ", cần ảnh vịnh Bắc Bộ + Vũng Tàu.
2. Hai icon giàn khoan lệch 12 px có thực sự đọc thành "hai giàn" không (A.2-2).
3. Tỷ lệ rụng nhãn ven bờ ở z8–9 nơi dày (A.5) — quyết định có cần tăng `rank` cho `da`.
4. Chấm chất đáy @0,5 dưới nắng ngoài trời thật (số 1,4–2,1:1 nói là mất, nhưng mật độ chấm có thể cứu ở z≥11).
5. 27 điểm trùng islands/reefs: nhãn nào thắng ở z7, z9, z11.

### A.10 Ràng buộc đã tuân thủ trong đề xuất
- Không đề xuất sao chép S-52/INT1/OpenCPN; mọi icon mới (`rock`, `bank`, `reef`, `cable-landing`, `no-anchor`, `tss-arrow`, `fishing-port`) vẽ mới trong `build-chart-sprite.mjs` theo luật viền INK + test bóng sẵn có.
- Không gỡ dữ liệu nguồn ngoài (giữ OSM rock/wreck, ACA) — chỉ đổi cách vẽ và khử trùng.
- Không đụng nguồn/giấy phép; không thêm request mạng; mọi sửa là asset tĩnh + style ⇒ không ảnh hưởng offline ngoài việc bump sprite (đã nằm trong SHELL).

## B. Mắt ngư dân (reviewer 2, 2026-09-03) — 2/6 ĐẠT · 4/6 CHƯA

> Góc nhìn: ngư dân 40–60, ít rành công nghệ, nắng chói, tay ướt. Chấm trên mã thật, có file:dòng tại thời điểm review (trước đợt sửa). Mọi mục CHƯA dưới đây ĐÃ được xử trong đợt tái thiết kế cùng ngày — xem `07-design-spec` mục SCAMIN/ba nhóm/chú giải.

| # | Hạng mục | Chấm | Bằng chứng nặng nhất |
|---|---|---|---|
| 1 | 3 nhóm công tắc | CHƯA | Bật "Hải đồ chi tiết" thì radio Lớp nền thành câm (chọn vệ tinh không đổi, vẫn tô đang chọn). Khu trú bão nằm dưới "Tên & nơi trú" → tắt Tên = mất chỗ chạy bão. Công tắc con không mờ khi tổng tắt. |
| 2 | Tự hiểu không cần chỉ | CHƯA | Chỉ chất đáy có chú giải; phao đỏ/xanh, số đo sâu 3 màu + rỗng = cũ, vùng cấm, cáp, giàn, xác tàu đều câm. |
| 3 | Chữ & tương phản | CHƯA | Sub-text 11px mờ 65%, chú giải 12px, dòng nguồn 12–13px @45%; địa danh ngầm 9px z5; icon đèn 13,2px / xác tàu 14,4px dưới sàn 16px của chính repo. |
| 4 | Jargon | ĐẠT (còn vụn) | Bộ dịch seamarks/den-bien/xac-tau tốt. Sót: "Ô khá thuần ~90%", "Allen Coral Atlas", "cấp vùng/cấp tỉnh", "QĐ 582/2024", "(PFZ)"; thẻ xác tàu in số Thông báo hai lần. |
| 5 | Chạm được | CHƯA | Bắt chạm đúng điểm ngón, không đệm: vùng chạm = cỡ vẽ (chất đáy 2–6px, đo sâu 5–10px). Hụt → xoá điểm xem / bung sheet gió. Tên rạn/đảo/vùng cấm/cáp/giàn không chạm được. Tốt: CloseButton 56px, vòng chọn. |
| 6 | Rối / hiểu sai nguy hiểm | CHƯA | "Đá" đảo (21) vs "Đá" ngầm (390), "Bãi" đảo vs "Bãi cạn" (651): cùng font/cỡ, chỉ khác navy/teal. Trống chất đáy = "chưa có mẫu" không nói. Điểm cập bờ cáp = đốm 1px vô nghĩa. Thẻ phao không nói bên nào luồng. |

### B.8 TOP 8 sửa (đã thực hiện 2026-09-03)
1. Chọn vệ tinh ⇒ tự tắt chartDetailOn — ĐÃ LÀM.
2. Đệm chạm ±28px + chọn vật gần nhất; thêm vùng cấm/giàn/đá/cáp/ống/cập bờ vào hitLayers — ĐÃ LÀM.
3. Nút "Ký hiệu là gì?" mở sheet chú giải (icon thật từ sprite) — ĐÃ LÀM.
4. Khu trú bão sang nhóm "Báo hiệu & nguy hiểm" — ĐÃ LÀM.
5. Thẻ phao nói "để phao bên TRÁI/PHẢI" (`huongDiQuaPhao`) — ĐÃ LÀM.
6. Đá/bãi/rạn phân biệt bằng ICON theo `type` (rock-awash/bank/coral-reef) + khử 31 cặp tên trùng đảo↔rạn — ĐÃ LÀM.
7. Vùng cấm: nền + nhãn + icon cấm neo + chạm được — ĐÃ LÀM.
8. Chữ phụ 11→13px, mờ ≥/75; icon-size nấc đầu 0,7; bỏ dòng Thông báo lặp; bỏ jargon % / tổ chức / QĐ — ĐÃ LÀM.

### B.9 Cần nhìn màn hình thật mới chốt
Halo 1,2–1,6px ngoài nắng; rạn teal trên dải nông; chú giải chất đáy `bottom-2 left-2` có bị sheet peek che; cụm ký hiệu dày quanh Hải Phòng/Vũng Tàu z9–10; 1.225 icon rạn ven bờ ở z8.

---

## A.11 Chấm lại sau sửa (2026-09-03) — reviewer hải đồ

> Cùng kỷ luật A.0: chỉ đọc mã + dữ liệu sau khi đội sửa (working tree, chưa commit), mọi số đo tính lại từ giá trị mới; hành vi MapLibre kiểm thẳng trong `node_modules/maplibre-gl/dist/maplibre-gl-dev.js`. Không tin mô tả của Lead — chỗ nào mô tả lệch mã ghi rõ.

### A.11.0 Bảng điểm mới

| # | Hạng mục | Trước | **Sau** | Vì sao chưa ĐẠT hẳn |
|---|---|---|---|---|
| 1 | SCAMIN + thứ tự vẽ | MỘT PHẦN | **MỘT PHẦN (tiến rõ)** | Gate xong, hiểm hoạ đã lên trên số đo sâu; nhưng **giàn khoan vẫn vẽ đôi** (41/41) và 9 đèn vẫn trùng — Lead tự nhận, mã xác nhận |
| 2 | Phân màu | MỘT PHẦN | **ĐẠT** | Mọi nét/điểm ≥3,25:1 trên cả 4 dải độ sâu, có cổng test; ba hạ tầng tách nhau cả sắc lẫn độ sáng |
| 3 | Cáp · ống · giàn | CHƯA ĐẠT | **MỘT PHẦN** | Cáp/ống tách hẳn, chạm được, điểm cập bờ có icon — tốt. Nhưng **icon cấm neo + nhãn vùng cấm đặt SAI CHỖ** (ở đỉnh đầu tiên trên vành, không ở tâm) và **nền vùng cấm tô được là nhờ hành vi không tài liệu hoá** của MapLibre trên LineString |
| 4 | Rạn · bãi · đá | MỘT PHẦN | **MỘT PHẦN (tiến rõ)** | Ba hình theo `type`, khử trùng sạch (0 tên chung). Còn: đá OSM vẫn dùng `obstruction` (hai icon cho một khái niệm "đá"); **14 bãi NGẦM thềm lục địa (DK1) bị gắn hình + câu "có thể ngập, nhìn con nước"** — sai sự thật ở nơi sâu 20–50 m |
| 5 | Phân biệt bằng hình | MỘT PHẦN | **ĐẠT (có điều kiện mắt)** | 80 icon, sàn 16 px giữ ở mọi spec, chú giải trong app. Điều kiện: 1.225 icon 16,8 px ven bờ ở z8 với `icon-allow-overlap: true` — phải nhìn thật |
| 6 | So C-MAP | MỘT PHẦN | **MỘT PHẦN (tiến rõ)** | Có dải 4 nấc + đường an toàn 10 m + chú giải + vùng cấm tô/nhãn. Chưa: chất đáy bằng chữ, mũi tên TSS, đặc tính đèn cạnh đèn, dedupe nguồn |

**Hồi quy / lỗi mới phát hiện: 3 (mục A.11.7)** — một cái chắc chắn từ mã MapLibre (icon cấm neo lệch tâm), một cái là rủi ro lớp (dải độ sâu `fill-opacity: 1` đè lên bờ trong máy + đảo nhỏ), một cái là câu chữ sai nghiệp vụ (bãi ngầm DK1).

### A.11.1 Hạng mục 1 — SCAMIN, thứ tự vẽ: **MỘT PHẦN (tiến rõ)**

Đã đúng (chắc chắn từ mã):
- Bốn lớp đường có nấc: cáp/ống/cập bờ/vùng cấm z8, luồng-phân luồng z9, tuyến lớn không gate (`ocean-map.ts:381-385`; áp ở `fishing-map-view.tsx:4276, 4290, 4303, 4316, 4332, 4346, 4362, 4381, 4395`). Khớp spec §586.
- Khu trú bão z7 (`KHU_TRU_BAO_MINZOOM`, :403; áp :4864) và dời sang nhóm `groupNavOn` — spec đã cập nhật đồng bộ (`07-design-spec.md:581-582`).
- `reef-hazards` nay khai SAU `soundings` (:4642-4658 sau :4632-4637) — đá ngầm/xác tàu OSM nổi trên chấm đo sâu. Đúng như đề xuất.
- `isobath-safety` (10 m đậm) vẽ đè `isobath-lines`, minzoom 7 (`ocean-map.ts:1008-1020`).

Chưa đạt (chắc chắn từ mã):
1. **Giàn khoan vẫn vẽ hai lần**: `SEAMARK_FAR` vẫn chứa `"platform"` (`fishing-map-view.tsx:215-221`) → `seamark-far` z9 anchor **bottom** (:4692); `sea-lane-gian` z8 anchor **center** (:4420-4430). Dữ liệu chưa đổi: 41/41 `giankhoan` nằm trong 50 m một `platform` OSM. Từ z9 mỗi giàn là hai hình lệch ~12 px dọc. Lead đã ghi nhận — chấm theo thực tế: **chưa sửa**.
2. 9/105 đèn biển trùng `light_major` OSM — chưa sửa (`generate-seamarks.mjs` chưa lọc).
3. `reef-dot-venbo` từ circle 4,4 px thành **symbol 16,8 px** ở z8 (`CHART_ICON_SIZE` kẹp 0,7), `icon-allow-overlap: true` + `icon-ignore-placement: true` (:4735-4752) cho **1.225 điểm**. Mật độ hình tăng ~15 lần diện tích so với trước ở đúng nấc mà nhãn của chúng cũng vừa bật (z8). **[cần xem bằng mắt]** Nha Trang / Hà Tiên / Cát Bà z8–9. Nếu rối: ven bờ giữ z8 cho `da` (nguy hiểm) và lùi `bai`/`con` về z9, hoặc tắt `icon-allow-overlap` cho ven bờ với `symbol-sort-key` ưu tiên `da`.

### A.11.2 Hạng mục 2 — Phân màu: **ĐẠT**

Tính lại từ mã mới (`ocean-map.ts:350-371, 415-424, 268-285, 309-312`), nền = 4 dải `DEPTH_BANDS`:

| Lớp | Màu @ mờ | 0–10 m `#d5e8eb` | 10–20 `#e2f0f3` | 20–50 `#eef6f8` | ≥50 `#f8fbfc` |
|---|---|---|---|---|---|
| cáp `#6d28d9`@0,9 | | **4,83** | 5,15 | 5,43 | 5,68 |
| ống `#1f2933`@0,95 | | **10,17** | 11,00 | 11,73 | 12,19 |
| vùng cấm viền `#b85a00`@0,9 | | **3,25** | 3,48 | 3,66 | 3,84 |
| viền rạn `#0b6b74`@0,85 | | **3,75** | 4,01 | 4,21 | 4,37 |
| đường an toàn `#2c5a80`@0,95 | | **5,19** | 5,55 | 5,90 | 6,22 |
| chất đáy 7 màu @0,8 | | **3,28–4,78** | 3,50–5,08 | 3,66–5,30 | 3,79–5,48 |
| đẳng sâu `#3d6e96`@0,85 (đối chứng) | | 3,32 | 3,51 | 3,72 | 3,87 |

- Giữa ba hạ tầng (đã pha mờ): cáp–vùng cấm **1,49**, cáp–ống **2,11**, vùng cấm–ống **3,13** — không còn cặp 1,00 nào; kèm ba dash khác nhau (`[4,2]` / `[7,2.5,1.5,2.5]` / `[2,2]`). Mù màu vẫn tách được bằng độ sáng + nhịp nét. Khớp số Lead ghi trong comment :336-340 (tôi tính độc lập, trùng).
- Cổng test mới đo đúng các hằng này sau pha mờ (`ocean-map.test.ts:475-497`) — lớp JSX không còn đứng ngoài cổng vì hằng đã dời về `ocean-map.ts`. Đúng đề xuất A.8-4.
- San hô chất đáy kéo về `#a3452a`: vs viền vùng cấm còn 1,06 về độ sáng nhưng khác hue và khác hình (chấm 1–3 px dày đặc vs nét đứt) — ghi nhận, không chặn.
- Fill rạn 0,3 → 1,19:1 và nền vùng cấm 0,1 → 1,13:1: diện, chủ ý dưới sàn để không che số — chấp nhận, đúng cách hải đồ giấy tô nhạt. **[cần xem bằng mắt]** dưới nắng hai diện này có còn nhận ra không (số 1,13–1,19 là sát ngưỡng nhận biết 1,15 mà chính repo dùng).
- Bước giữa 4 dải: 1,09 / 1,07 / 1,05 — nấc cuối chỉ 1,05, vừa chạm ngưỡng "nhận ra". **[cần xem bằng mắt]** ranh 20→50 m có đọc ra là một bậc không.

### A.11.3 Hạng mục 3 — Cáp · ống · giàn: **MỘT PHẦN**

Đã đúng (mã + dữ liệu):
- `osmKind()` tách `cable_submarine → cap`, `pipeline_submarine → ong` (`generate-sea-lanes.mjs:168-171`); `loai` đọc từ tag OSM (:181-200). Dữ liệu thật: `cap` 78 (quang 27 · điện 40 · chưa rõ 11), `ong` 25 (khí 7 · xả thải 12 · nhiên liệu 3 · dầu 1 · nước 1 · chưa rõ 1), `cap-bo` 10 **Point** (`tram` Vũng Tàu/Đà Nẵng/Quy Nhơn).
- Ống: nét mực 2 px vạch-chấm 10,17:1 + icon `pipeline-mark` lặp dọc tuyến 140 px, `symbol-placement: line` nên icon xoay theo ống (:4300-4326). Đây là cách tách đúng tinh thần INT1 L30/L40 mà không chép hình.
- Điểm cập bờ: icon `cable-landing` z8 anchor bottom (:4329-4341). Hết "đốm 1 px".
- Chạm được: `sea-lane-gian`, `cap-bo`, `camneo`, `vungcam-fill`, `cap`, `ong` trong `hitLayers` (:2815); hộp chạm ±28 px, điểm ưu tiên trước đường (:3502-3534); thẻ `laneInfo` nói việc cần làm bằng lời đời thường (:5687-5739).

**Chưa đạt — hai lỗi kỹ thuật, chắc chắn từ mã MapLibre:**

1. **Icon cấm neo và nhãn vùng cấm KHÔNG nằm ở tâm vòng.** Dữ liệu `vungcam` (15 feature, gồm 7 vòng 500 m) vẫn là **LineString** (`generate-sea-lanes.mjs:445-452`; đếm thật: `vungcam|*|LineString` 15, không có Polygon). Hai lớp `sea-lane-camneo` (:4378-4390) và `sea-lane-vungcam-label` (:4359-4377) dùng `symbol-placement` mặc định `point`. Với LineString, MapLibre đặt symbol tại **đỉnh đầu tiên của từng đoạn sau khi cắt ô** — mã: `else if (feature.type === 'LineString') { for (const line of feature.geometry) { ... addSymbolAtAnchor(subdividedLine, new Anchor(subdividedLine[0].x, subdividedLine[0].y, 0)); } }` (`maplibre-gl-dev.js` ~dòng 43600, kèm link issue mapbox #3808). Hệ quả: mỏ-neo-gạch-chéo nằm **trên vành**, cách giàn 500 m, và khi vòng cắt qua biên ô thì mỗi mảnh có một icon riêng (icon `allow-overlap: true` nên không bị gộp). Comment trong mã nói "tâm vòng 500 m" (:4357, `chart-symbols.ts:397`) — **sai so với thứ sẽ vẽ**.
2. **Nền vùng cấm tô được là "may".** `sea-lane-vungcam-fill` (:4273-4282) là lớp `fill` trên LineString. `FillBucket.addFeature` không kiểm `feature.type`, ném thẳng hình vào `classifyRings` + earcut (`maplibre-gl-dev.js` ~29086-29087) nên **vành kín được tô như đa giác**, nhưng đây là hành vi không tài liệu hoá; và đường bị geojson-vt cắt theo luật ĐƯỜNG (không phải luật đa giác) nên mảnh qua biên ô được khép bằng dây cung — vòng tròn lồi thì hai nửa ghép lại vẫn ra đĩa, nhưng 8 khu hạn chế OSM hình lõm sẽ lộ mảng tô sai ở biên ô. **[cần xem bằng mắt]** Khu hạn chế Hải Phòng/Vũng Tàu ở z10–12 khi vùng nằm vắt qua biên ô.

   **Một sửa cho cả hai** (nhỏ, chỉ script + test): `generate-sea-lanes.mjs` xuất `vungcam` thành **Polygon** (vòng 500 m đã kín; khu OSM là `way` kín → `[ring]`). Khi đó (a) `fill` cắt ô đúng luật đa giác, (b) `symbol-placement: point` trên Polygon đặt tại **pole of inaccessibility = tâm** (mã MapLibre ~43593: `findPoleOfInaccessibility(polygon, 16)`), icon và nhãn tự về giữa, mỗi vùng một cái. Giữ lớp `sea-lane-vungcam` (line) — MapLibre vẽ viền Polygon bằng lớp line bình thường. Cập nhật bất biến trong `islands.test.ts` nếu đang đòi LineString.

3. Giàn vẽ đôi — xem A.11.1-1.

### A.11.4 Hạng mục 4 — Rạn · bãi · đá: **MỘT PHẦN (tiến rõ)**

Đã đúng:
- `reef-dot`/`reef-dot-venbo` thành symbol, `icon-image` match `type`: `da → rock-awash`, `ran → coral-reef`, còn lại `bank` (:4721-4727, :4740-4746); cùng bảng với `reefSymbolId` (`chart-symbols.ts:420-425`) và có test đối chiếu sprite (`chart-symbols.test.ts:669-691`).
- Khử trùng: `coral-reefs` 1.372, `vn-islands` 72; giao theo tên = **0** (đếm lại). 5 điểm không-phải-đảo còn trong islands (4 cồn cát Hoàng Sa + Hòn Tháp) là vật nổi thật — chấp nhận.
- Viền rạn ACA 3,75:1, fill 0,3.
- Thẻ `reefInfo` nói loại bằng lời (:5652-5684).

Chưa đạt:
1. **Bãi NGẦM thềm lục địa bị nói là "có thể ngập".** Dữ liệu: `them-luc-dia|bai|2` = **14 điểm** (Tư Chính, Phúc Nguyên, Huyền Trân, Quế Đường… — nơi đặt nhà giàn DK1, đỉnh bãi sâu 20–50 m). Lớp gán icon `bank` ("đụn cát dưới gợn nước") và thẻ in *"Bãi cạn — có thể ngập, nhìn con nước"* (:5675); chú giải cũng ghi vậy (:5523). Với ngư dân câu khơi, đây là **ngư trường**, không phải chỗ mắc cạn — câu chữ sai nghiệp vụ, và làm loãng chữ "cạn" cho những bãi thật sự cạn. Cột `group` đã có sẵn để tách: `group == "them-luc-dia"` (và các `bai` rank 2 ở Trường Sa cần rà tay: Bãi Cỏ Mây/Cỏ Rong là rạn ngập triều, Bãi Vũng Mây/Ba Kè là bãi ngầm sâu). *Sửa:* nhánh `them-luc-dia` → icon `bank` biến thể chìm (thêm 1 icon `bank-deep`: đụn không có gợn nước, hoặc dùng `coral-reef`?) + câu *"Bãi ngầm — sâu, ngư trường; có nhà giàn"*; nhỏ.
2. **Hai icon cho một khái niệm "đá"**: đá OSM (`reef-hazard`, 45 điểm) vẫn `obstruction` (:4650), trong khi đá của danh mục nhà nước là `rock-awash`. Chú giải liệt kê cả hai như hai thứ khác nhau (:5515-5516) — bà con sẽ hỏi "chướng ngại vật" khác "đá ngầm" chỗ nào khi trên biển là cùng một hòn đá. *Sửa:* :4650 `"rock" → CHART_FEATURE_ICON.rockAwash`; giữ `obstruction` cho `chuong-ngai`/`vat-chim` nhân tạo. Nhỏ.
3. `symbol-sort-key` cho nhãn ven bờ vẫn `rank` (tất cả = 3, :4786) — `da` chưa được ưu tiên thắng va chạm trước `bai`/`con` (đề xuất A.5-5, chưa làm). Nhỏ.
4. `reef-hazard` vẫn không nằm trong `hitLayers` (:2784-2818) — chạm đá OSM không ra gì. Nhỏ.

### A.11.5 Hạng mục 5 — Phân biệt bằng hình: **ĐẠT (có điều kiện mắt)**

- Sprite 80 ô (74 cũ + 6 mới: `rock-awash`, `bank`, `coral-reef`, `no-anchor`, `cable-landing`, `pipeline-mark` — `chart-sprite.json` đếm lại). Sáu hình tự vẽ (`build-chart-sprite.mjs:481-521`), đúng luật viền INK; `rock-awash` = sao 6 gai ĐỎ + lõi INK — đúng ý "nguy hiểm, nổi hơn bãi". Không chép S-52.
- Sàn 16 px: `WRECK_LAYER` nấc đầu 0,7 (`ocean-map.ts:503`), `LIGHTHOUSE_LAYER` 0,7 (:612); test nay import cả hai spec (`ocean-map.test.ts:38-39`). Đúng đề xuất A.8-7.
- Lớp chấm tròn trơn còn lại: `island-dot` (đảo — chấp nhận, đảo là đất), `chat-day-dot` (chấp nhận ở z9–12 vì có chú giải góc), `sounding-dot` (đúng hải đồ giấy). Không còn chấm nào mang nghĩa "nguy hiểm".
- Chú giải trong app: sheet "Ký hiệu trên hải đồ" (`fishing-map-view.tsx:5485-5575`), icon cắt từ chính sprite (`bieuTuong`), nút mở ở `ra-khoi-controls.tsx:852-855`. Câu chữ đời thường, đúng hướng đi qua phao. **Lỗi nhỏ trong chú giải**: dòng `["harbour", "Khu neo đậu tránh trú bão"]` (:5529) — cùng icon `harbour` còn vẽ 279 cảng/bến OSM ở z11 (`SEAMARK_MID`, :230; 91 cái trên bờ VN) nên chú giải đang gọi mọi bến OSM là "khu tránh trú bão". Sửa bằng icon riêng `storm-shelter` (mỏ neo trong vòng + mái) cho `khu-tru-bao-dot`, hoặc bỏ `harbour` khỏi `SEAMARK_MID`. Nhỏ.
- Điều kiện: A.11.1-3 (1.225 icon ven bờ z8) — **[cần xem bằng mắt]**.

### A.11.6 Hạng mục 6 — So C-MAP: **MỘT PHẦN (tiến rõ)**

| Thứ C-MAP có | Trước | **Sau** |
|---|---|---|
| Dải độ sâu nhiều nấc | 1 dải | **4 nấc** `DEPTH_BANDS` (`ocean-map.ts:268-273`, lớp :955-964), nông→sâu sáng dần, đúng chiều giấy |
| Đường an toàn đậm | không | **10 m đậm** 1,4→2,6 px `#2c5a80` (:280-285, :1008-1020). 10 m là mức nông nhất ETOPO còn tin được (lý do ghi :243-247, hợp lý) |
| Vùng cấm tô + nhãn + ký hiệu | viền đứt câm | có (nhưng lệch tâm — A.11.3-1) |
| Cáp ≠ ống, nhãn dọc tuyến | không | **có** (icon lặp thay chữ — chấp nhận được, thậm chí đọc nhanh hơn chữ dưới nắng) |
| Chú giải ký hiệu | không | **có** |
| Chất đáy bằng CHỮ ở zoom sâu | không | chưa |
| Mũi tên TSS | không | chưa (108 đoạn `phanluong` vẫn nét đứt vô hướng, :4392-4404) |
| Đặc tính đèn cạnh đèn (z≥11) | không | chưa |
| Dedupe đèn/giàn hai nguồn | không | chưa |

### A.11.7 Hồi quy / lỗi mới (không có trong A.0)

| # | Lỗi | Bằng chứng | Mức |
|---|---|---|---|
| R1 | **Icon cấm neo + nhãn vùng cấm ở đỉnh đầu vành, không ở tâm; nhân bản theo ô** | `fishing-map-view.tsx:4359-4390` (`symbol-placement` point) × dữ liệu LineString × mã MapLibre `feature.type === 'LineString' → Anchor(subdividedLine[0])` | Chắc chắn từ mã. Sửa: A.11.3 (Polygon) |
| R2 | **Dải độ sâu `fill-opacity: 1` đè lên bờ trong máy và đảo nhỏ.** Bốn lớp fill (:955-964) đứng trên `basemapGeom` và trên mốc `OFFLINE_COAST_BEFORE_ID` (:733-757) — tức trên cả lớp bờ offline `offline-coast-fill`. Đa giác "≥10 m" sinh từ ETOPO 1/48° (~2,3 km) nên ở đảo nhỏ hơn ô (Trường Sa Lớn ~0,15 km², Song Tử Tây, Hòn Mun…) và bờ dốc, đa giác ≥10/≥50 m **phủ trùm lên đất**. Trước @0,65 đất chỉ nhạt đi; nay 1,0 là **đất biến mất** dưới màu `#f8fbfc`. Riêng lúc mất sóng, bờ vẽ từ `vn-coast.v1.json` nằm dưới các lớp này | Thứ tự lớp chắc chắn từ mã; **mức độ phủ [cần xem bằng mắt]**: Trường Sa Lớn / Song Tử Tây z8–10, Cù Lao Chàm z9, và ca offline vịnh Hạ Long. Sửa nếu xác nhận: hạ về 0,85–0,9, hoặc chèn 4 lớp fill TRƯỚC `basemapGeom` (dưới đất) — cách sau đúng bản chất hơn: nước ở dưới đất | 
| R3 | **14 bãi ngầm thềm lục địa (DK1) gắn câu "có thể ngập, nhìn con nước"** | :5675, :5523; dữ liệu `them-luc-dia|bai|2` = 14 | Sai nghiệp vụ, sửa nhỏ (A.11.4-1) |
| R4 | Mật độ icon ven bờ z8 tăng ~15× diện tích so với chấm cũ | :4735-4752 | Rủi ro, **[cần xem bằng mắt]** |

### A.11.8 TOP việc còn lại (theo thứ tự)

| # | Việc | File | Cỡ |
|---|---|---|---|
| 1 | `vungcam` → **Polygon** trong generator (sửa cả R1 lẫn nền tô "may"); cập nhật test bất biến | `scripts/generate-sea-lanes.mjs:445-452` + khối OSM restricted_area; `src/lib/__tests__/islands.test.ts` | Nhỏ |
| 2 | Kiểm mắt R2; nếu đúng, chèn 4 lớp `isobath-du-nuoc`/`isobath-dai-*` **trước** `...basemapGeom` (hoặc opacity 0,85) | `src/lib/ocean-map.ts:733-757, 955-964` | Nhỏ |
| 3 | Bỏ `platform` khỏi `SEAMARK_FAR` + lọc `t != platform` ở `seamark-near`; lọc `light_major` OSM trong 300 m `den-bien` lúc sinh | `fishing-map-view.tsx:215-221, 4666-4674`; `scripts/generate-seamarks.mjs` | Nhỏ–vừa |
| 4 | Bãi ngầm `them-luc-dia`: icon/câu riêng "bãi ngầm — sâu, ngư trường" | `fishing-map-view.tsx:4721-4746, 5669-5675, 5523`; `chart-symbols.ts:420-425`; sprite +1 | Nhỏ |
| 5 | Đá OSM → `rock-awash`; `reef-hazard` vào `hitLayers`; sort-key ưu tiên `da` ven bờ | `fishing-map-view.tsx:4650, 2784-2818, 4786` | Nhỏ |
| 6 | Icon riêng cho khu trú bão (hoặc bỏ `harbour` OSM khỏi `SEAMARK_MID`) để chú giải không gọi nhầm 279 bến OSM | `fishing-map-view.tsx:230, 4866, 5529`; sprite +1 | Nhỏ |
| 7 | Kiểm mắt R4; nếu rối, `bai`/`con` ven bờ lùi z9 hoặc tắt `icon-allow-overlap` ven bờ | `fishing-map-view.tsx:4735-4752` | Nhỏ |
| 8 | Đợt 2 C-MAP: mũi tên TSS (`tss-arrow`, `symbol-placement: line` trên `phanluong`) · đặc tính đèn dòng 2 nhãn z≥11 · chất đáy chữ z≥12 | `fishing-map-view.tsx:4392-4404`; `ocean-map.ts:623-641`; sprite +1 | Vừa |

### A.11.9 Cần xem bằng mắt mới chốt (đợt 2)
1. R2 — đảo nhỏ Trường Sa / Cù Lao Chàm dưới dải `#f8fbfc` @1,0; ca offline vịnh Hạ Long.
2. R4 — 1.225 icon 16,8 px ven bờ z8 (Nha Trang, Hà Tiên, Cát Bà).
3. Nền vùng cấm khu OSM hình lõm vắt qua biên ô (Hải Phòng/Vũng Tàu z10–12) — mảng tô sai theo dây cung.
4. Bước 20→50 m (1,05) và fill rạn/nền vùng cấm (1,13–1,19) dưới nắng.
5. Icon `pipeline-mark` xoay theo ống có bị lộn ngược đọc khó không (`icon-keep-upright` đang mặc định false).

### B.10 Chấm lại sau sửa (2026-09-03) — 4/6 ĐẠT · 2/6 ĐẠT MỘT PHẦN

> Chấm trên cây làm việc sau đợt sửa (chưa commit), dòng số theo mã MỚI. Tôi kiểm từng khai báo của Lead trong mã, không tin lời khai. Kết quả: 8/8 việc TOP đều có mã thật, nhưng 3 việc làm **chưa hết** và có 2 lỗi mới.

| # | Hạng mục | Trước | Sau | Bằng chứng MỚI | Còn lại |
|---|---|---|---|---|---|
| 1 | 3 nhóm công tắc | CHƯA | **ĐẠT MỘT PHẦN** | Radio hết câm: `fishing-map-view.tsx:6179 if (id !== "bathymetry") setChartDetailOn(false)`. Khu trú bão đã sang nhóm 2: gate lớp `:4859 groupNavOn && khuTruBaoGeo`, chạm `:2800`, nhãn `ra-khoi-controls.tsx:828–829`. Nhóm 3 đổi "Tên địa danh ngầm" (`:839–840`) — đúng nghĩa. | (a) **Công tắc con vẫn không mờ/khoá khi tổng tắt** — `:812–848` không đọc `chartDetailOn`; bật con mà không thấy gì đổi, y như cũ. (b) **Panel vẫn tự thu sau 3 s** (`:68 AUTO_HIDE_MS = 3000`) mà nay panel dài hơn: 4 radio + 4 công tắc (dòng phụ nhóm 2 dài 90 ký tự ở 13px trong cột ~150px ⇒ **4–5 dòng**, `:829`) + nút chú giải — đọc chưa hết đã mất. (c) Chiều ngược: đang ở ảnh vệ tinh, bật "Hải đồ chi tiết" thì nền nhảy về hải đồ mà radio vẫn tô "Nước nóng lạnh" (`buildMapStyle` `:2683` không đổi, radio `active` vẫn theo `layerId`) — câm nửa kia. |
| 2 | Tự hiểu, không cần chỉ | CHƯA | **ĐẠT** | Sheet "Ký hiệu trên hải đồ" `fishing-map-view.tsx:5485–5615`: 4 nhóm icon **cắt từ sprite thật** (`bieuTuong` `:1421–1437`, sprite có đủ `rock-awash / bank / coral-reef / no-anchor / cable-landing / pipeline-mark` — kiểm `public/icons/chart-sprite.json`), thêm đường cáp/ống/vùng cấm, **3 màu độ sâu + "rỗng ruột = cũ"** (`:5571–5588`), chất đáy + "Chỗ trống là chưa có ảnh, không phải đáy sạch" (`chat-day.ts:177–179`, in ở `:5608` và ngay dưới chú giải nổi `:5645–5647`). Vùng cấm nay có nền `:4274–4282` + nhãn tên `:4360–4377` + icon cấm neo `:4379`. Nút mở 56px (`ra-khoi-controls.tsx:856 min-h-[3.5rem]`). Câu chữ đúng giọng: "Phao ĐỎ (mạn trái): vào luồng để nó bên TRÁI tàu", "Dưới 4 m — ĐỪNG VÀO". | Sheet chú giải là **lớp `absolute inset-x-2 top-16 bottom-2 z-50`** trong khung bản đồ (`:5487`) — nó có nằm TRÊN rail phải và sheet đáy không, và có bị dock che phần cuối không: **cần nhìn thật**. Không có nền mờ phía sau, chỉ đóng bằng X — chấp nhận được. Chú giải nổi chất đáy vẫn hiện từ **z≥9** (`:5620`) trong khi chấm ở z9 vẫn bán kính 1,1px (`:4583`) — chú giải cho thứ chưa thấy, chưa sửa. |
| 3 | Chữ & tương phản | CHƯA | **ĐẠT MỘT PHẦN** | Dòng phụ 13px, /75 (`ra-khoi-controls.tsx:1525`); nhãn rail 13px (`:491,509,532,565,607,637`); chú giải nổi 13px /80 (`:5638`); dòng nguồn thẻ 13px /60 (`:5677,5732,5785,5836`); icon đèn 16,8px z7 (`ocean-map.ts:612` 0,7) và xác tàu 16,8px z8 (`:503`) — hết thủng sàn 16 của repo; chất đáy mờ 0,8 + bảng màu sẫm hơn (`:415–424`). | (a) **Địa danh ngầm vẫn 9px ở z5** (`fishing-map-view.tsx:4464,4468` — không đổi). (b) Nhãn vùng cấm mới **12px cứng** (`:4367`), nhãn tuyến 11px (`:4442`). (c) Thân sheet chú giải **15px** (`:5495 text-[0.9375rem]`), thẻ rạn/hạ tầng thân 15px (`:5665,5712`) — dưới sàn 18px cho "nội dung chính đọc ngoài nắng" (03 §3); đây là chữ bà con đọc để quyết định "đâm là thủng / đừng thả neo", không phải chữ phụ. (d) Ghi chú "Ảnh vệ tinh, không phải thời gian thực…" còn 12px /70 (`ra-khoi-controls.tsx:788`). (e) Công tắc vẫn `min-h-[3.25rem]` = 52px (`:1517`), rail 52px — dưới sàn 56 (nợ cũ, không thuộc đợt này). |
| 4 | Jargon | ĐẠT (vụn) | **ĐẠT** | "Gần như toàn san hô" / "Lẫn nhiều loại đáy" (`:5780–5782`, `chat-day.ts:159–169`); "Theo ảnh vệ tinh — tham khảo" (`:5786`); "khu lớn (đón tàu nhiều tỉnh) / khu tỉnh" (`khu-tru-bao.ts:86–89`); "theo quy hoạch nhà nước" (`:5837`); `moTaXacTau` bỏ số thông báo, nói "tin tháng 2/2026" (`xac-tau.ts:204–206`). Câu chỉ đường phao bằng lời người lái: `seamarks.ts:369–397` + `LATERAL_PHRASE`. | Còn "(PFZ)" ở panel Ngư trường và "SSHA" ở Thời tiết (ngoài phạm vi hải đồ). Câu "Luồng rẽ đôi: luồng chính nằm bên PHẢI phao — đi luồng chính thì để phao bên TRÁI tàu" dài 2 dòng — đúng nhưng nặng; chấp nhận vì hiếm. |
| 5 | Chạm được | CHƯA | **ĐẠT** | Hộp ±28px = 56px quanh ngón, sắp theo khoảng cách pixel, đường/vùng xếp cuối (`fishing-map-view.tsx:3509–3534`); `hitLayers` thêm `reef-dot(-venbo)`, `sea-lane-gian/cap-bo/camneo/vungcam-fill/cap/ong` (`:2813–2815`); thẻ `reefInfo` (`:5652–5684`) và `laneInfo` (`:5687–5739`) có `CloseButton` 56px. Chạm hụt không còn xoá điểm xem oan khi trong 56px có vật. | (a) **Ưu tiên theo LỚP thắng ưu tiên theo KHOẢNG CÁCH**: chuỗi `:3556–3685` vẫn `find` theo thứ tự lớp, nên một phao cách ngón 27px cướp cú chạm nhắm vào chấm đo sâu ngay dưới ngón 2px. Trước đây không xảy ra vì chỉ bắt đúng điểm. Đề xuất: lấy vật gần nhất trong mọi lớp điểm; chỉ dùng thứ tự lớp khi hai vật cách nhau <12px. (b) Thẻ phao **tự tắt sau 8 s** (`:1438–1442`, `notify.ts:14`) trong khi nay có thêm câu chỉ đường 2 dòng; thẻ đèn/xác tàu/rạn không tự tắt — không nhất quán, và 8 s là ít cho mắt 40–60 ngoài nắng. (c) Vẫn không có "gần đây còn N vật" khi hộp 56px trúng nhiều thứ. |
| 6 | Rối / hiểu sai nguy hiểm | CHƯA | **ĐẠT** | Đá ngầm = sao gai đỏ, rạn = nhánh san hô, bãi/cồn = đụn cát theo `type` (`:4721–4727`, `chart-symbols.ts:420–425`, dữ liệu `coral-reefs.v1.json` có `type` da 390 / ran 41 / bai 650 / con 291); 31 tên trùng đảo↔rạn loại ở generator (`scripts/generate-islands.mjs:172–177`, `vn-islands` còn 72 tên). Thẻ rạn nói thẳng "Đá ngầm — đâm là thủng, tránh xa" màu danger (`:5669–5670`). Cáp cập bờ thành icon riêng z≥8 (`:4330–4341`), ống tách khỏi cáp (`:4301–4326`). "Chỗ trống là chưa có ảnh" in 2 chỗ. Thẻ phao có `huongDiQuaPhao` (`:5375–5385`). | **Lỗi mới**: thẻ hạ tầng gán `loai: "cam-vao"` (6 vùng trong dữ liệu) vào nhánh mặc định **"Khu hạn chế — xem quy định trước khi vào"** (`:5726–5730` chỉ xử `cam-neo`, `cam-danh-bat`) — dữ liệu nói **CẤM VÀO**, thẻ nói "hạn chế": làm nhẹ một lệnh cấm là hiểu sai nguy hiểm đúng nghĩa. Nhãn `reef-label` vẫn cùng font/cỡ/gần màu với `island-label` (`:4754–4772` vs `:4505–4522`) — nay icon gánh phần phân biệt, chấp nhận được nhưng ở z<7 chỉ có chữ (icon rạn `minzoom` 7, `:4715`). |

### B.11 Hồi quy / lỗi mới phát hiện

1. **`cam-vao` → "Khu hạn chế"** (`fishing-map-view.tsx:5726–5730`): thêm nhánh `laneInfo.loai === "cam-vao"` → "Khu CẤM VÀO — không đi vào vùng này" màu danger. Dữ liệu còn `loai: "chua-ro"` (12) rơi về "Khu hạn chế…" là đúng. **Nhỏ, sửa trước khi commit.**
2. **Vật xa cướp cú chạm** (`:3556–3685`): hộp 56px + ưu tiên lớp cứng. Cần "gần nhất thắng" trong nhóm lớp ĐIỂM. **Vừa.**
3. **Nửa kia của radio câm** (`:2683`, `ra-khoi-controls.tsx:738`): bật lại "Hải đồ chi tiết" khi đang ở vệ tinh → nền đổi, radio không đổi. Sửa: `onChartDetail(true)` ⇒ `setLayerId("bathymetry")` (đối xứng với `:6179`). **Nhỏ.**
4. **Công tắc con không mờ khi tổng tắt** (`ra-khoi-controls.tsx:812–848`) — chưa làm dù nằm trong B.1 đợt trước. **Nhỏ.**
5. **Thẻ phao tự tắt 8 s** trong khi có thêm 2 dòng chỉ đường (`:1438–1442`) — bỏ auto-hide cho thẻ phao (các thẻ hải đồ khác đều không tự tắt). **Nhỏ.**
6. Panel Hải đồ dài hơn nhưng vẫn **auto-hide 3 s** (`ra-khoi-controls.tsx:68`) — hoãn/tắt auto-hide khi `open === "hai-do"`. **Nhỏ.**
7. Địa danh ngầm **9px z5** chưa động (`:4464,4468`). **Nhỏ.**
8. Thân sheet chú giải + thẻ rạn/hạ tầng **15px** (`:5495,5665,5712`) — nội dung an toàn nên lên 1.125rem. **Nhỏ.**

### B.12 TOP việc còn lại (sau đợt sửa)

| # | Việc | Cỡ |
|---|---|---|
| 1 | Nhánh `cam-vao` trong thẻ hạ tầng (B.11-1) | nhỏ |
| 2 | Chạm: gần nhất thắng trong lớp điểm, lớp chỉ phân xử khi <12px (B.11-2) | vừa |
| 3 | Đối xứng radio↔công tắc + con mờ khi tổng tắt (B.11-3, 4) | nhỏ |
| 4 | Bỏ auto-hide thẻ phao; hoãn auto-hide panel Hải đồ (B.11-5, 6) | nhỏ |
| 5 | Địa danh ngầm `minzoom` 7 + cỡ sàn 11; nhãn vùng cấm 12→13px; thân sheet/thẻ 15→18px (B.11-7, 8) | nhỏ |
| 6 | Chú giải nổi chất đáy lùi về z≥11 (khớp lúc chấm ≥2px) | nhỏ |

### B.13 Cần nhìn màn hình thật (bổ sung)
- Sheet chú giải `z-50 top-16 bottom-2` có đè rail phải / bị sheet đáy hoặc dock che phần "Chất đáy" ở cuối không.
- Icon cắt từ sprite 1x trong sheet (`bieuTuong`) trên máy DPR 2 có mờ không.
- Dòng phụ nhóm 2 (90 ký tự) chiếm mấy dòng thật trong panel 16,5rem.
- 1.372 icon rạn/bãi ở z8 ven bờ + `icon-allow-overlap: true` (`:4729–4730`) có thành đám không.

## A.12 Bảng SCAMIN đối chiếu Navionics (2026-09-03c — chủ dự án: "icon cần logic ở mức zoom nào thấy cái gì, xem các app khác mà làm")

Ảnh chủ dự án gửi: Navionics vùng Vũng Tàu ở hai mức. Mức xa (~1:300k ≈ z9): bờ, dải độ sâu, số đo sâu thưa, đèn lớn (sao), phao luồng, xác tàu (⊕), TSS + vùng hạn chế magenta đứt, tên vùng. Mức gần (~z12): mọi phao có quạt đèn, "WK 7.8MT" (độ sâu trên xác tàu), "VUNG TAU HARBOUR LIMIT", và **vòng "+6"** gom phao chồng nhau. Bài học rút ra không phải "sao chép nấc", mà là hai luật: (1) xếp vật theo GIÁ TRỊ Ở KHOẢNG CÁCH ĐÓ, không theo nguồn; (2) chỗ dày thì GOM chứ không giấu.

| Vật | Navionics (ước) | SDFish trước | SDFish nay (`CHART_TIER`) | Ghi chú |
|---|---|---|---|---|
| Bờ, dải độ sâu, tên vùng/đảo | luôn | luôn | **LUÔN** z5 | dải 4 nấc + đường 10 m đậm (XA) |
| Tên địa hình ngầm | luôn (đặt thưa) | z5 | **LUÔN** z5 | icon mặt cắt + tên, tự né nhau |
| Đèn biển lớn | ~z6–7 | z7 (VN) / **z9** (OSM `light_major`) | **XA** z7 (cả hai) | tên đèn VỪA |
| Xác tàu / chướng ngại | ~z8 (hình), số sâu ~z11 | z8, số cùng lúc | hình **XA** z7, số **VỪA** z9 | `text-field` step theo zoom |
| Đá ngầm / rạn / bãi ngoài khơi | ~z8 | z7 | **XA** z7 | mốc chủ quyền, tên luôn hiện |
| Giàn khoan + cấm neo | ~z7 | z8 | **XA** z7 | 41 giàn, không rối |
| Khu trú bão | (không có lớp này) | z7 | **XA** z7 | chọn bến là việc mức vùng |
| Phao/tiêu luồng đỏ-xanh, hướng, nguy hiểm, nước sâu | ~z9–10 | z9 (Cục HH) / **z13** (OSM lateral) | **VỪA** z9 mọi nguồn | hết lệch theo nguồn |
| Đèn nhỏ, bến cảng | ~z9 | z11 | **VỪA** z9 | |
| Cáp / ống / vùng cấm / luồng | ~z9–10 | z8 / z9 | **VỪA** z9 | Navionics vẽ cáp từ ~1:150k |
| Rạn / bãi ven bờ | ~z9 | tên z8, icon z9 | **VỪA** z9 cả hai | trước tên hiện trước icon |
| Phao chuyên dùng, lồng bè, phao neo, cọc | ~z11–12 | z11 / z13 | **SÁT** z11 | |
| Số đo sâu | ~z10 thưa → z12 đủ | chấm z11, số z12,5 | **SÁT** z11, số z12,5 | giữ (số dày, thà thưa) |
| Chất đáy (chữ S/R/Co) | ~z12 | z9 chấm, chú giải z10 | **SÁT** z11 cả hai | trả B.12-6 |
| Chồng nhau | **vòng "+N"**, chạm phóng tới | giấu tới z13 | **vòng "+N"** tầng VỪA/SÁT, chạm phóng +2 nấc | 3 nguồn theo tầng để cụm chỉ gồm vật đã tới nấc |

**Chưa ngang Navionics (nói thật)**: quạt chiếu sáng của đèn (light sectors) · "HARBOUR LIMIT" vẽ nét + chữ (ta có vùng cấm/khu hạn chế từ OSM, chưa có ranh cảng vụ) · chữ đặc tính đèn cạnh đèn (ta để trong thẻ chạm) · số đo sâu thưa ở mức xa (Navionics chọn lọc một ít số từ z9; ta z11 mới có vì dữ liệu chỉ 379 điểm luồng — bày ở xa là một vũng mực ở cửa Vũng Tàu và trắng mọi nơi khác).

**Cổng giữ luật** (`ocean-map.test.ts` "BA TẦNG HIỆN"): mọi `*_MINZOOM` phải trỏ về `CHART_TIER`; JSX map-view không có `minzoom={số}`; 3 nguồn cluster + lớp icon lọc `KHONG_PHAI_CUM`; cụm tan đúng SÁT−1 / SÁT+1; số sâu xác tàu step tại `WRECK_DEPTH_MINZOOM`.
## A.13 Rà từng ký hiệu chú giải — VẼ THẬT hay chưa (2026-09-03c, sau sự cố sprite)

**Sự cố**: `sprite: "/icons/chart-sprite"` tương đối → MapLibre v5 `Invalid sprite URL … must be absolute` → `map.listImages()` = 0 → **không một icon nào vẽ từ 2026-09-01 tới 09-03**; `onError` map-view nuốt lỗi nên không ai thấy; cảnh báo "Image X could not be loaded" chính là triệu chứng (agent từng gán cho "khung đầu"). Sửa: `chartSpriteUrl()` tuyệt đối + `onError` in lỗi + cổng test. Sau sửa: 87 ảnh nạp tự động khi mở trang.

**Cách rà** (không chụp màn, hỏi thẳng MapLibre): lấy handle map qua fiber React của `.maplibregl-map`, `jumpTo` tới điểm mẫu, chờ `idle`, `queryRenderedFeatures` trên mọi lớp symbol có `icon-image` → suy ra id icon của từng vật ĐÃ ĐƯỢC VẼ (symbol bị va chạm giấu thì không trả về). 13 điểm mẫu: luồng Vũng Tàu (z9,5 · z11,5), Hải Phòng, Quy Nhơn, Đà Nẵng (z11,5), Kê Gà (z9,5), Trường Sa Đá Lát (z9), DK1 (z8), địa hình ngầm Ninh Thuận (z7), rạn `type=ran` (11,21°B 108,89°Đ z9), giàn VN vịnh Bắc Bộ (20,12°B 109,13°Đ z9,5), phao nguy hiểm + ống dẫn (dữ liệu vùng Lôi Châu/HK trong kho, z11,5/z10).

| Ký hiệu chú giải | Vẽ thật? | Thấy ở | Ghi chú |
|---|---|---|---|
| Đèn biển lớn `lighthouse` | ✓ | Vũng Tàu ×3, Kê Gà ×2, Trường Sa ×3, Ninh Thuận ×18 | |
| Đèn nhỏ `light-minor` | ✓ | Vũng Tàu ×3, Ninh Thuận, Lôi Châu ×28 | |
| Xác tàu `wreck` | ✓ | Vũng Tàu ×9 (z9,5), Ninh Thuận ×4 | số sâu step z9 |
| Chướng ngại `obstruction` | ✓ | Vũng Tàu ×2, HK ×13 | |
| Đá ngầm `rock-awash` | ✓ | Hải Phòng, Trường Sa ×2, Kê Gà ×2 | |
| Rạn `coral-reef` | ✓ | rạn Ninh Thuận ×3, Kê Gà ×1 | 41 điểm `ran` cả nước |
| Bãi cạn `bank` | ✓ | Vũng Tàu ×30, DK1 ×4, Hải Phòng ×8 | |
| Giàn khoan `platform` | ✓ | giàn vịnh Bắc Bộ, Lôi Châu | |
| Cấm neo `no-anchor` | ✓ | giàn vịnh Bắc Bộ, Lôi Châu | 8 vòng |
| Khu trú bão `anchorage` | ✓ | Vũng Tàu, Trường Sa ×2, Ninh Thuận ×8 | |
| Bến `harbour` | ✓ | Hải Phòng ×5, Vũng Tàu, Trường Sa | |
| Phao đỏ/xanh `lat-port`/`lat-stbd` (+lit, pref) | ✓ | Vũng Tàu ×16/×16, Hải Phòng ×17/×29, Đà Nẵng | |
| Phao hướng `card-*` | ✓ | Hải Phòng (S, W), Đà Nẵng (N, W), Đá Lát | |
| Phao nguy hiểm `iso-danger` | ✓ | Lôi Châu (iso-danger-lit, bcn-iso-danger-lit) | 65 cái trong kho, không có ở luồng mẫu VN |
| Phao nước sâu `safe-water` | ✓ | Vũng Tàu, Quy Nhơn, Đà Nẵng (lit) | |
| Phao chuyên dùng `special` | ✓ | Quy Nhơn ×16, Vũng Tàu ×12 | |
| Lồng bè `marine-farm` | ✓ (ngoài VN) | chỉ ở Borneo/HK — **0 điểm trong vùng biển VN** (136 OSM) | giữ dòng chú giải, nói thật |
| Phao neo `mooring` | ✓ | Trường Sa 7,37°B 113,81°Đ | |
| Điểm cáp cập bờ `cable-landing` | ✓ | Vũng Tàu ×5 | |
| Dấu ống dẫn `pipeline-mark` | ✓ | HK ×10 | VN chưa có ống trong OSM (đã ghi ở §10) |
| 7 icon địa hình ngầm | ✓ | DK1: seamount 9 · knoll 15 · ridge · guyot · deep · valley 2 · escarpment; Ninh Thuận đủ 7 | |
| Vòng "+N" | ✓ | Vũng Tàu z9,5 ×42, Kê Gà, giàn vịnh Bắc Bộ ×7 | tan ở z11 (mid) / z13 (near) |
| Nét đường (cáp/ống/luồng/vùng cấm/10 m), dải độ sâu, chấm đo sâu, chất đáy | ✓ | lớp line/fill/circle — không qua sprite, chưa từng hỏng | |

**Kết luận**: sau sửa sprite, **mọi ký hiệu trong sheet chú giải đều vẽ thật** ở ít nhất một nơi có dữ liệu; hai ký hiệu (lồng bè, dấu ống dẫn) chỉ có dữ liệu ngoài vùng biển VN — là thiếu NGUỒN, không phải lỗi vẽ. Lưu ý kỹ thuật: rà bằng `queryRenderedFeatures` ngay sau `jumpTo` phải chờ tile về (Kê Gà lần 1 trả rỗng, lần 2 ×2).

