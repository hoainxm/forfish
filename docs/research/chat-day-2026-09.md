# Chất đáy (nature of seabed) — dò nguồn + dựng lớp, 2026-09-03

> **Việc**: dựng lớp CHẤT ĐÁY cho Trục 1 — hạng mục mọi hải đồ thương mại có
> (S cát, M bùn, R đá, Co san hô, G sỏi…) mà app chưa có. Ngư dân cần để (1)
> thả neo — neo không bám được đá, và (2) tìm cá đáy theo chất đáy (cá mú/cá
> hồng quanh đá-san hô, cá đáy mềm ở nền bùn cát).
>
> **Công cụ**: `scripts/generate-chat-day.mjs` · **Đầu ra**:
> `public/data/chat-day.v1.json` · **Cổng nghiệm thu**:
> `src/lib/__tests__/chat-day.test.ts` · **Giải mã + câu cho bà con**:
> `src/lib/chat-day.ts`.
>
> ⚠️ **CHƯA nối vào bản đồ** — theo đúng phạm vi việc: dữ liệu + lib + test +
> script sinh. Lead tự nối lớp + ký hiệu + bộ tự kiểm khi ghép vào
> `ocean-map.ts`/`fishing-map-view.tsx`.

---

## 1. Dò nguồn — theo đúng thứ tự trong việc giao

1. **Thông báo hàng hải** (`scripts/lib/tbhh-doc.mjs`): kho chữ hiện có phục
   vụ báo hiệu (đèn/phao) + xác tàu/chướng ngại. Chưa thấy mục nào ghi thẳng
   "đáy cát/bùn" trong các bản tin đã bóc — mô tả khảo sát luồng tập trung vào
   độ sâu/toạ độ, không phải chất đáy. **Không dùng được cho lớp này** (không
   phải vì thiếu công cụ đọc — công cụ đã có sẵn và dùng chung được — mà vì
   nội dung nguồn không có trường chất đáy).
2. **Allen Coral Atlas — layer `benthic_data_verbose`** ✅ **CÓ, VÀ LÀ NGUỒN
   GHI THẲNG** (không phải suy diễn). Chi tiết ở §2.
3. **GEBCO/EMODnet**: đúng như dự đoán trong việc giao — không có chất đáy,
   chỉ có độ sâu.
4. **dbSEABED**: chưa cần tới — mục 2 đã đủ nguồn phủ đúng vùng cần (rạn/ven
   bờ), và dbSEABED chủ yếu phủ thềm lục địa các nước có khảo sát trầm tích
   công khai (Mỹ/Úc/EU) — rủi ro phủ rất mỏng cho biển VN, để dành nếu sau này
   cần chất đáy vùng KHÔNG có rạn (thềm lục địa sâu hơn, ngoài phạm vi ACA).
5. **Hải đồ giấy**: không tra được trong phạm vi việc này (không có kho số hoá).

## 2. Nguồn chốt — ACA `benthic_data_verbose`

`generate-reef-shapes-aca.mjs` (đã có trong repo, dùng layer
`geomorphic_data_verbose` — phân VÙNG địa mạo rạn, Reef Crest/Slope/Flat/
Lagoon) khiến việc giao đoán "suy san hô/đá từ hình rạn ACA" là đường duy
nhất. Nhưng dò `GetCapabilities` của cùng máy chủ:

```
https://allencoralatlas.org/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities
→ <Name>coral-atlas:benthic_data_verbose</Name>
→ <Name>coral-atlas:geomorphic_data_verbose</Name>
```

Có MỘT layer riêng phân loại chất đáy trực tiếp. Mẫu thật tại Trường Sa
(9,3–9,8°B / 112,5–113,2°Đ, 2026-09-03): `class_name` trả về gồm **Sand,
Rubble, Coral/Algae, Seagrass** — đúng nhóm "sand/rubble/rock/coral" nêu trong
việc giao. Đây là **kết quả tốt hơn dự kiến**: không cần đi đường suy diễn từ
geomorphic (rạn → "san hô/đá", độ tin thấp hơn) vì có nguồn ghi CHẤT ĐÁY
THẲNG. Không có điểm nào trong file cuối cùng mang cờ "suy" — toàn bộ là quan
sát trực tiếp từ ảnh vệ tinh đã phân loại.

**Giấy phép**: CC BY 4.0 — GIỐNG hệt layer geomorphic đã đăng ký sẵn
`SOURCES.aca` trong `src/lib/provenance.ts` (ghi công, KHÔNG share-alike).
Không cần đăng ký nguồn mới; dùng lại nguyên `source: "aca"`.

**Phương pháp đo**: `remote-sensing` (ảnh PlanetScope 5 m qua ML) — cùng hạng
tin cậy đã gán cho ACA trong `provenance.ts`, sai số ước lượng được bằng GSD
ảnh, khác hẳn kiểu sai của survey-compilation (TBHH).

## 3. Phủ sóng — CHỈ nơi ACA phân loại được, KHÔNG nội suy

ACA chỉ phân loại được nơi có ảnh vệ tinh đủ độ phân giải VÀ nước đủ trong để
thấy đáy — về cơ bản là **rạn nông** (Trường Sa, Hoàng Sa, ven bờ có rạn như
Phú Quốc/Côn Đảo/Cù Lao Chàm/Lý Sơn/Nha Trang…). Phần lớn thềm lục địa sâu +
biển khơi **KHÔNG có điểm nào** — đây LÀ vùng trắng thật, không phải lỗi.

Để khỏi quét lại 233/337 ô 1°×1° biển trống (đã đo trong lúc dựng lớp rạn ACA
song song — xem `scripts/generate-reef-shapes-aca.mjs`), script này tải benthic
CHỈ cho 88 ô đã biết có dữ liệu geomorphic (footprint benthic ⊆ footprint
geomorphic vì cùng quy trình ảnh của ACA, cùng đơn vị rạn). Cờ `--full-sweep`
quét lại TOÀN khung VN nếu cần xác nhận ACA có thêm vùng mới.

## 4. Cách dựng: GOM Ô, không dò biên đa giác

Khác `generate-reef-shapes-aca.mjs` (dò biên → đa giác), lớp chất đáy xuất
**ĐIỂM** theo đúng khuôn việc giao ("bảng tra + mảng số"):

1. Mỗi mảnh ACA (polygon nhỏ ~5–25 m, bằng đơn vị pixel ảnh đã dissolve) →
   lấy TÂM (trung bình đỉnh vòng ngoài) + `area_sqkm` sẵn có từ nguồn.
2. Gom theo lưới `CELL` = 0,001° (≈111 m ở xích đạo).
3. Trong mỗi ô: loại chiếm NHIỀU DIỆN TÍCH NHẤT thắng; ghi thêm % diện tích
   của loại thắng (độ THUẦN của ô) + số mảnh gộp (độ dày mẫu).
4. Ô KHÔNG có mảnh ACA nào → KHÔNG xuất điểm. Không nội suy giữa hai ô có mẫu
   — đúng nguyên tắc "thà chấm điểm rời có mẫu thật" trong việc giao.

## 5. Bảng mã

| Mã | Nhãn tiếng Việt | ACA `class_name` |
|---|---|---|
| `S` | Cát | Sand |
| `R` | Đá | Rock |
| `Co` | San hô | Coral/Algae |
| `G` | Vụn san hô, đá vụn | Rubble |
| `Sg` | Cỏ biển | Seagrass |
| `Ma` | Thảm rong tảo | Microalgal Mats |
| `khac` | Chưa rõ loại | (class lạ chưa gặp — script CẢNH BÁO ra console, không ném lỗi) |

## 6. Kết quả — đo thật, chạy xong 2026-09-03

`node scripts/generate-chat-day.mjs` — 88/88 ô tải xong, KHÔNG lỗi, KHÔNG ô
nào phải bỏ qua.

- **926.874 mảnh ACA thô** (WFS `benthic_data_verbose`, cả 88 ô).
- Gộp vào lưới 0,001° (≈111 m) → **362.743 ô có mẫu thật** = 362.743 điểm xuất.
- File: **9,04 MB** — dưới trần 20 MB (data-budget CLAUDE.md), không cần gộp ô
  thưa hơn (0,002°).
- `public/data` tổng phần git gánh: 50,5 MB — dưới trần 120 MB.

**Theo loại** (% trên tổng điểm):

| Mã | Nhãn | Số điểm | % |
|---|---|---:|---:|
| `Co` | San hô | 91.734 | 25,3% |
| `R` | Đá | 73.932 | 20,4% |
| `G` | Vụn san hô, đá vụn | 69.678 | 19,2% |
| `S` | Cát | 69.023 | 19,0% |
| `Sg` | Cỏ biển | 47.821 | 13,2% |
| `Ma` | Thảm rong tảo | 10.555 | 2,9% |
| `khac` | (loại lạ) | 0 | 0% — bảng mã đủ, không có `class_name` nào ngoài 6 loại đã biết |

**Theo dải vĩ độ** (số điểm mỗi dải 1°, cho thấy VÙNG PHỦ THẬT — trắng ở dải
nào nghĩa là không có rạn ACA phân loại được ở đó, KHÔNG nghĩa là "đáy biển
trống"):

| Dải vĩ độ | Điểm | Vùng tương ứng |
|---|---:|---|
| 4–6°N | 18.680 | Nam Trường Sa / thềm lục địa phía Nam (DK1) |
| 6–9°N | 139.529 | **Trường Sa** (đậm nhất — cụm rạn lớn Đá Chữ Thập, Đá Ba Đầu…) |
| 9–13°N | 50.762 | Trường Sa Bắc + ven bờ Nam Trung Bộ (Phú Quý, Nha Trang) |
| 13–15°N | 4.263 | vùng thưa giữa Trường Sa và Hoàng Sa |
| 15–17°N | 31.470 | **Hoàng Sa** + Cù Lao Chàm/Lý Sơn ven bờ |
| 17–19°N | 11.434 | ven bờ Bắc Trung Bộ (rải rác) |
| 19–23°N | 106.605 | **Vịnh Bắc Bộ** — Cát Bà/Bạch Long Vĩ/Cô Tô (karst + rạn đá, dải 20–21°N
riêng đã 43.133 điểm) |

Khung toạ độ điểm: kinh độ 102,02–118,00°Đ, vĩ độ 4,00–22,84°B — phủ đúng khung
biển VN đã đăng ký (`trongKhungBienVN`), không có điểm lọt ra ngoài.

**Nguồn ghi thẳng vs suy diễn**: **100% ghi thẳng.** Không một điểm nào trong
file mang cờ "suy từ hình rạn" — mọi điểm đến từ `class_name` của ACA
`benthic_data_verbose`, phân loại ảnh vệ tinh trực tiếp cho CHẤT ĐÁY (không
phải phân vùng địa mạo geomorphic).

## 7. Giới hạn — nói thẳng, không tô hồng

- **Đây là "chất đáy VÙNG RẠN", KHÔNG PHẢI chất đáy toàn bộ đáy biển VN.** ACA
  chỉ phân loại được nơi có rạn nông + nước đủ trong để ảnh vệ tinh thấy đáy —
  Trường Sa, Hoàng Sa, và các cụm ven bờ có rạn/karst (Phú Quốc, Côn Đảo, Cù
  Lao Chàm, Lý Sơn, Cát Bà/Bạch Long Vĩ/Cô Tô…). **Đáy bùn/cát vùng CỬA SÔNG
  VEN BỜ (đồng bằng sông Cửu Long, sông Hồng, các cửa lạch dọc bờ) HOÀN TOÀN
  KHÔNG có trong lớp này** — nước đục phù sa, ACA không nhìn xuyên qua được,
  và đó cũng không phải "rạn" nên ACA không có lý do phân loại ở đó. Nếu app
  hiện lớp này lên bản đồ, PHẢI ghi rõ "chất đáy vùng rạn/đảo" chứ không được
  gọi chung là "chất đáy" — bà con đọc "chất đáy" trần trụi sẽ hiểu lầm là phủ
  hết vùng đánh bắt, kể cả vùng ven bờ cửa sông họ hay thả neo.
- **Toàn bộ vùng biển khơi xa rạn** (đáy sâu, nước đục vì lý do khác cửa sông)
  cũng TRẮNG — cùng lý do viễn thám quang học ở trên.
- **`tyLeThuanPhanTram` đo độ thuần của Ô, không phải độ tin của phép đo.** Ô
  thấp (gần 100/n loại) nằm ở RANH GIỚI hai chất đáy — dữ liệu vẫn đúng, chỉ là
  vị trí đó thật sự là vùng chuyển tiếp.
- **Không phải khảo sát đáy biển trực tiếp** (giã cào lấy mẫu, lặn quan sát) —
  là phân loại ảnh vệ tinh tự động. Nhãn "tham khảo" trong file KHÔNG được bỏ.
- **`Rubble` dịch "Vụn san hô, đá vụn"** thay vì ép vào mã `G` (sỏi) truyền
  thống của hải đồ — chọn nhãn mô tả đúng thực chất ACA quan sát (mảnh san hô
  vỡ, không phải sỏi trầm tích) hơn là ép khớp bảng chữ hải đồ giấy.

## 8. Vector tile — `public/data/chat-day.v1.pmtiles` (2026-09-03)

362.743 điểm nhồi thẳng vào MapLibre kiểu `type: "geojson"` lặp lại đúng bài
học đã trả giá ở lớp rạn (4 triệu đỉnh, xem `docs/research/ran-vector-tile-2026-08.md`)
— máy yếu của bà con bị hệ điều hành giết tab trước khi vẽ được chấm đầu tiên.
`scripts/chat-day-to-pmtiles.mjs` cắt sẵn LÚC BUILD, cùng pipeline
`reef-to-pmtiles.mjs` (geojson-vt + vt-pbf + bộ đóng gói PMTiles v3 viết tay,
KHÔNG thêm dependency).

- **File**: `public/data/chat-day.v1.pmtiles`, **8,11 MB** (dưới trần 20 MB).
- **`source-layer`**: `chat-day`.
- **Thuộc tính mỗi điểm** (đọc thẳng bằng `queryRenderedFeatures`, không cần
  tải lại JSON): `ma` (String — mã chất đáy đã giải, "S"/"R"/"Co"/"G"/"Sg"/"Ma"/
  "khac"), `tyLe` (Number — % thuần, 0-100), `soManh` (Number — số mảnh ACA gộp).
- **Zoom**: `minzoom=9` (chốt theo yêu cầu Lead — lớp chi tiết không cần hiện ở
  toàn cảnh z4-8, giảm nhiễu + kích thước), `maxzoom=12` (đo thật: độ chính xác
  NGUỒN chỉ tới mức ô lưới gom 0,001° làm tròn 4 số thập phân ≈11 m; lưới MVT ở
  z12 ≈4,7 m/đơn vị đã mịn hơn — thêm z13 như lớp rạn là số thập phân không có
  thật, đúng lý do reef-to-pmtiles.mjs tự bỏ z14).
- **Khác lớp rạn về BẢN CHẤT lợi ích**: geojson-vt KHÔNG rút bớt ĐIỂM theo zoom
  (không có "đỉnh" để Douglas-Peucker như đa giác) — z9 (136 ô, 1,82 MB) và z12
  (1.072 ô, 2,28 MB) nặng cùng bậc, không chênh 300 lần như lớp rạn. Cái
  PMTiles cho lớp điểm là NẠP THEO VÙNG ĐANG XEM (vài ô, không phải 362K điểm
  một lượt), không phải "zoom thấp tự nhiên nhẹ hơn". Đã ghi rõ trong test
  (`chat-day-pmtiles.test.ts`) để không ai hiểu nhầm sau này.
- **Cổng tự kiểm lúc build**: (a) không mất điểm — đếm bằng SET định danh nguồn
  (khớp toạ độ), KHÔNG cộng thẳng `layer.length` (geojson-vt nhân đôi điểm sát
  biên ô vào dải `buffer` để vẽ liền mạch — đếm thẳng ra thừa, đã dính thật lúc
  build: 386.782 "điểm vẽ" cho 362.743 điểm nguồn); (b) lệch toạ độ tối đa đo
  được **1,67 m** (trần 6 m); (c) trần 20 MB/file; (d) đọc lại bằng đúng gói
  `pmtiles` app dùng.
- **`chat-day.v1.json` GIỮ LẠI** (không gitignore) — cả hai file cộng lại
  17,15 MB, `public/data` tổng phần git gánh 58,3 MB, đều dưới trần tương ứng
  (20 MB/file, 120 MB/thư mục) nên không cần đánh đổi.
- **CHƯA nối vào bản đồ.** `public/sw.js` (`PMTILES_ARCHIVES`), `ocean-map.ts`
  (Source/Layer), `fishing-map-view.tsx` — Lead tự nối + tự thêm cache/self-check
  cho service worker. Hệ quả: `src/lib/__tests__/sw-basemap-range.test.ts`
  (cổng chống quên đăng ký pmtiles mới vào SW) sẽ ĐỎ cho tới khi Lead thêm
  đúng một dòng `"/data/chat-day.v1.pmtiles"` vào `PMTILES_ARCHIVES` — đây là
  hệ quả CHỦ ĐÍCH của việc không đụng sw.js, không phải lỗi của bộ này.
