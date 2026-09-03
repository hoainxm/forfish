# Lớp rạn: GeoJSON một cục hay vector tile? — đo thật, 2026-08-30

> **Kết luận ngắn**: vector tile (PMTiles) **thắng, và thắng cách biệt**. Thời gian tới lúc
> vẽ được ô đầu tiên **3.970 ms → 3,7 ms** (~1.070 lần). RAM giữ lại **835 MB → 2,9 MB**
> (~290 lần). Byte phải tải xong trước khi thấy cái rạn đầu tiên **4,02 MB → 19 KB**.
> Giá phải trả: file trong git **8,44 MB → 12,00 MB** (+3,56 MB) và **không mất một mảnh
> nào** (88.840/88.840 mảnh còn đủ ở mức nét đầy đủ, lệch toạ độ tối đa 0,84 m).
>
> **Đây là kết quả nghiên cứu, chưa phải một thay đổi đã lắp vào app.** File
> `public/data/reef-shapes-aca.v1.pmtiles` đã sinh ra và đã có cổng test, nhưng
> `fishing-map-view.tsx` vẫn đang dùng nguồn cũ. Việc lắp vào là quyết định của Lead —
> phần "Còn phải làm gì" ở cuối liệt kê đúng những chỗ phải đụng, có một chỗ **hỏng
> offline nếu quên**.

## 1. Câu hỏi

Bộ hình rạn Allen Coral Atlas đi đường này:

```
reef-shapes-aca.v1.bin (8,44 MB)
  → decodeReefShapes()
  → MỘT FeatureCollection: 1.534 cụm · 88.840 mảnh · 128.421 vòng · 4.030.270 đỉnh
  → <Source type="geojson"> của MapLibre
```

MapLibre không vẽ thẳng từ GeoJSON. Nhận một `geojson` source, nó **chuyển toàn bộ đống
đó sang worker** (một bản sao nữa), **dựng chỉ mục geojson-vt**, rồi **tự cắt ô ở mọi mức
zoom**. Nghi ngờ: với 4 triệu đỉnh trên điện thoại phổ thông, đây là chỗ tốn nhất. Chưa ai
đo, nên việc đầu tiên là đo — rồi mới bàn đường thay thế.

**Máy đo**: Windows 11, Node 20.20.2, dữ liệu thật trong `public/data/`. Tham số geojson-vt
lấy **đúng bộ MapLibre dùng cho nguồn geojson** (đọc ra từ `maplibre-gl.js`:
`extent 8192, buffer 128 px → 2048, tolerance 0,375 px → 6, maxZoom = maxzoom nguồn = 18,
indexMaxZoom 5, indexMaxPoints 100.000`) chứ không lấy mặc định của thư viện — sai bộ tham
số là đo một thứ MapLibre không chạy.

## 2. Đường hiện tại — số đo

| Bước | Số đo |
|---|---|
| Tải file | 8,44 MB thô · **4,02 MB qua sóng** (gzip) — phải xong **toàn bộ** mới bắt đầu bước sau |
| `decodeReefShapes` | 292–396 ms |
| Object GeoJSON nằm lại trong RAM | **323,51 MB** (heapUsed sau khi dọn rác) |
| `JSON.stringify` (nếu truyền dạng chữ) | 900 ms · 78,78 MB |
| `structuredClone` (chuyển sang worker) | **1.391–1.419 ms** — và nhân đôi RAM |
| Dựng chỉ mục geojson-vt | 1.400–2.055 ms · +71 MB |
| **Tới ô vẽ được đầu tiên (z10)** | **3.970 ms** |
| RAM giữ lại sau đó | **834,69 MB** · RSS đỉnh **1.125–1.256 MB** |

Đỉnh phải xử lý, cùng một khung nhìn (Trường Sa 114,3°Đ 9,7°B, 2×3 ô):

| Zoom | ô có dữ liệu | feature | đỉnh vẽ | **đỉnh thô phải xén** |
|---|---|---|---|---|
| z6 | 4 | 548 | 18.757 | **4.020.968** |
| z10 | 5 | 31 | 9.313 | 43.164 |
| z13 | 4 | 19 | 3.154 | 3.160 |
| z14 | 5 | 11 | 1.810 | 1.810 |

Cột cuối là chỗ đau: để vẽ một ô z6, máy phải **xén qua 4,02 triệu đỉnh** rồi mới bỏ đi
99,5% trong số đó. Việc ấy lặp lại mỗi lần mở app, trên máy của bà con, không cache được
qua phiên.

**Về máy yếu**: các con số trên đo trên máy để bàn. Điện thoại phổ thông chậm hơn khoảng
4–8 lần về JS — nhưng cái đáng lo không phải "chậm gấp 5". Ngân sách RAM một tab trình
duyệt trên máy 2–3 GB thường chỉ vài trăm MB; **835 MB giữ lại là vượt ngân sách đó**, và
khi vượt thì hệ điều hành không làm nó chậm mà **giết tab**. Người dùng thấy màn hình
trắng, không thấy cái rạn nào, không có thông báo lỗi nào.

## 3. Đường PMTiles — cách làm

`scripts/reef-to-pmtiles.mjs` sinh `public/data/reef-shapes-aca.v1.pmtiles` từ chính file
`.bin` đang có (`.bin` **không bị sửa**, chỉ đọc).

**Không thêm một dependency nào.** Ba việc nặng làm bằng thứ đã cài sẵn (đi kèm
`maplibre-gl`, có trong `package-lock.json`):

| Việc | Dùng cái gì | Trực tiếp được không |
|---|---|---|
| Cắt ô + giản lược theo zoom | `@maplibre/geojson-vt` | ✅ |
| Ô → protobuf MVT | `@maplibre/vt-pbf` | ✅ |
| Gzip từng ô | `node:zlib` | ✅ |
| Đọc lại để tự kiểm | `pmtiles`, `@mapbox/vector-tile`, `pbf` | ✅ |
| **Đóng gói PMTiles v3** | **viết tay ~120 dòng trong script** | gói `pmtiles` là bộ **ĐỌC** ("PMTiles archive decoder for browsers"), không có bộ ghi |

Chỗ duy nhất phải tự viết là bộ đóng gói: header 127 byte + hai bảng mục lục varint + đống
ô nối đuôi theo thứ tự Hilbert. Thêm một dep chỉ để ghi 127 byte header là đúng thứ nguyên
tắc 15 bậc 5 cấm. Cách đánh số ô thì **dùng lại `zxyToTileId` của gói `pmtiles`**, không tự
viết — hai bên lệch cách đánh số là hỏng cả file mà không ai thấy.

### Giản lược theo từng mức zoom

Đó là điểm mạnh thật sự của vector tile, và nó đo được:

| zoom | ô | dung lượng | đỉnh vẽ (tổng cả mức) |
|---|---|---|---|
| z3 | 1 | 0,00 MB | 77 |
| z6 | 12 | 0,02 MB | 5.536 |
| z9 | 148 | 0,27 MB | 98.954 |
| z10 | 316 | 0,67 MB | 253.525 |
| z12 | 1.344 | 2,84 MB | 1.298.993 |
| **z13** | 3.102 | 6,59 MB | **4.339.471** (nét đầy đủ) |

Cùng một lớp, z6 và z13 chênh nhau ~780 lần về số đỉnh. Bản GeoJSON một cục không làm được
điều đó: nó chỉ có **một** độ nét cho mọi zoom, và độ nét ấy là độ nét sâu nhất.

### Hai lựa chọn tham số, chọn bằng số đo

**`maxZoom = 13`, không phải 14.** Thêm mức z14 tốn thêm 7,9 MB (11,99 → 19,9 MB, sát trần
20 MB) mà **không thêm một thông tin nào**: ô z13 đã giữ đủ 100% đỉnh nguồn, phần z14 mua
thêm chỉ là lưới toạ độ mịn hơn. Mà lưới z13 (4.096 đơn vị trên ô rộng 0,0439° →
1,07·10⁻⁵°/đơn vị ≈ 1,19 m) đã mịn **ngang bước lưới của chính bộ nguồn** (10⁻⁵° ≈ 1,11 m).
MapLibre tự phóng to ô z13 cho z14+. Trả 7,9 MB cho số thập phân không có thật là vô nghĩa.

**`tolerance = 8` (một pixel), không phải 3.** `8` = `EXTENT/512`, tức "bỏ đỉnh nào lệch
dưới một pixel màn hình". Đo: 17,58 MB → 11,99 MB, **không đụng một đỉnh nào ở z13** (ở
đúng mức maxZoom geojson-vt không giản lược).

Bảng dò đầy đủ:

| maxZoom | tolerance | thuộc tính | dung lượng ô | mảnh ở mức nét đầy đủ |
|---|---|---|---|---|
| 14 | 3 | kind+pid+f | 25,65 MB | 88.840/88.840 |
| 14 | 8 | kind+pid | 18,15 MB | 88.840/88.840 |
| 13 | 3 | kind+pid | 17,58 MB | 88.840/88.840 |
| **13** | **8** | **kind+pid** | **11,99 MB** ✅ | **88.840/88.840** |
| 13 | 8 | kind | 10,66 MB | *(bỏ pid ⇒ mất cách kiểm bất biến)* |
| 12 | 8 | kind+pid | 8,52 MB | 88.840/88.840 *(mất độ nét thật)* |

`pid` (số thứ tự mảnh) tốn 1,33 MB trong 11,99 MB. Đó là tiền trả để bất biến "không mất
mảnh nào" kiểm được **trên chính file phát hành**, chứ không phải trên một bản dựng lại
trong bộ nhớ. Chỉ số cụm nguồn thì **không** kèm theo — suy ra được từ `pid` qua bảng
`partStartOfFeature` (1.534 số) nằm trong metadata của file.

## 4. Đường PMTiles — số đo

| Bước | Số đo |
|---|---|
| File | **12,00 MB** · 5.653 ô · z3–z13 · một mục lục gốc, không cần mục lục lá |
| Mở kho (header + mục lục gốc) | 43 ms · **đọc 16 KB** |
| **Tới ô vẽ được đầu tiên (z10)** | **3,7 ms** |
| RAM giữ lại sau bốn khung nhìn | **2,90 MB** · RSS 63,94 MB |
| Tổng byte đọc cho cả bốn khung nhìn | **31 KB** |

Cùng khung nhìn, cùng cách đếm:

| Zoom | ô | qua sóng | feature | đỉnh phải xử lý | thời gian |
|---|---|---|---|---|---|
| z6 | 2 | 7 KB | 339 | **2.283** | 4,9 ms |
| z10 | 2 | 3 KB | 88 | 1.116 | 3,4 ms |
| z13 | 4 | 3 KB | 40 | 1.406 | 4,1 ms |
| z14 (phóng từ z13) | 4 | 3 KB | 40 | 1.406 | 2,8 ms |

## 5. Bảng so — thắng bao nhiêu

| | GeoJSON một cục | PMTiles | Hơn |
|---|---|---|---|
| Byte phải có **trước khi vẽ được gì** | 4,02 MB (gzip) | **19 KB** | **215×** |
| **Tới ô vẽ được đầu tiên** | 3.970 ms | **3,7 ms** | **~1.070×** |
| RAM giữ lại | 834,69 MB | **2,90 MB** | **288×** |
| RSS đỉnh | 1.126 MB | **64 MB** | 17× |
| Đỉnh phải xử lý ở z6 | 4.020.968 | **2.283** | **1.761×** |
| Đỉnh phải xử lý ở z10 | 43.164 | **1.116** | 39× |
| Đỉnh phải xử lý ở z14 | 1.810 | 1.406 | ~1,3× |
| **Cỡ file trong git** | 8,44 MB | **12,00 MB** | **thua 3,56 MB (+42%)** |
| Mảnh còn đủ ở mức nét đầy đủ | 88.840 | **88.840** | hoà |
| Lệch toạ độ so với nguồn | 0 | **≤ 0,84 m** | thua, nhưng dưới bước lưới nguồn 1,11 m |

Ở z14 hai đường gần bằng nhau — đúng như phải thế: khi đã phóng sát thì cả hai chỉ vẽ
đúng mấy cái rạn trong khung. Khác biệt nằm ở **đường tới đó**: đường GeoJSON phải nuốt
trọn 4 triệu đỉnh trước khi vẽ được ô z14 đầu tiên, đường PMTiles thì không.

**Chỗ PMTiles thua là dung lượng git: +3,56 MB.** Nó thua vì hình học bị lặp lại ở 11 mức
zoom (z3–z13) và bị nhân thêm ở biên ô. Đổi lại là toàn bộ cột bên trái. Sau khi thêm,
`public/data` (phần git gánh) là **39,94 MiB / trần 120 MB**, file mới **12,00 MB / trần
20 MB** — không đụng cổng nào của hook. Nếu Lead chốt thay hẳn thì `.bin` 8,44 MB có thể
bỏ khỏi cây làm việc (xem phần dưới) và con số ròng chỉ còn **+3,56 MB**.

## 6. Bất biến: không mất một mảnh nào

Đây là điều kiện cần, không phải một mục "kiểm cho đủ". Lớp này là **lớp cảnh báo vật
cản**: mất một mảnh thì file vẫn hợp lệ, bản đồ vẫn vẽ đẹp, chỉ có chỗ đó ngoài biển là
trống — không lỗi, không thông báo, không ai biết cho tới lúc có tàu đi qua.

`scripts/reef-to-pmtiles.mjs` có bốn cổng, **chạy trên byte sắp ghi chứ không trên object
trung gian**:

- **(a)** mọi mảnh nguồn phải có mặt ở mức nét đầy đủ → **88.840/88.840** ✅
- **(b)** toạ độ ở mức nét đầy đủ khớp nguồn → so 85.160 mảnh nằm gọn trong lòng ô,
  **lệch tối đa 0,84 m** (trần 2 m, bước lưới nguồn 1,11 m) ✅
- **(c)** trần 20 MB/file → 12,00 MB ✅
- **(d)** đọc lại bằng **đúng gói `pmtiles`** mà `src/lib/pmtiles-protocol.ts` đăng ký cho
  MapLibre → header z3–z13, ô mẫu có 17 feature ✅

`src/lib/__tests__/reef-pmtiles.test.ts` soi lại **trên file đã phát hành**, và **không tin
số liệu script tự ghi vào metadata**: nó dựng lại kỳ vọng từ file `.bin` nguồn (mảnh nào
chạm ô z13 nào) rồi đối chiếu. 7 ca, chạy ~0,8 s.

### Hai lỗi đã dính thật khi làm — cả hai đều im lặng

Ghi lại vì cả hai đều thuộc loại "mọi cổng vẫn xanh mà bản đồ vẫn sai", và cả hai giờ có
test canh:

1. **Cắt nhánh nhầm.** Bản đầu đi cây ô và dừng ở ô nào có `features.length === 0`. Ô z0
   của bộ này đúng là như vậy (mọi mảnh đều bé hơn một pixel ở z0) ⇒ **cắt nhánh ngay từ
   gốc, sinh ra một kho rỗng**, mà cổng đếm vẫn chạy qua. Phân biệt đúng: `getTile` trả
   `null` = "không có dữ liệu" (được cắt nhánh); trả về ô rỗng = "có dữ liệu, mức này giản
   lược hết" (phải đi tiếp).
2. **Cổng báo động giả.** Cổng (b) ban đầu so đỉnh theo chỉ số và nhận diện "chưa bị cắt
   biên" bằng "cùng số vòng, cùng số đỉnh". Sai hai lần: vòng ra khỏi bước mã hoá MVT vừa
   **đảo chiều vừa đổi đỉnh bắt đầu** (mảnh 88.596: y hệt 8 đỉnh, nhưng `got[k] =
   src[(9−k) mod 8]` → báo lệch 537 m); và một vòng 1.175 đỉnh **cắt qua biên ô vẫn có thể
   ra đúng 1.175 đỉnh** (mất mấy đỉnh ngoài ô, thêm mấy đỉnh trên biên → báo lệch 1.547 m).
   Sửa: điều kiện "nằm gọn trong ô" phải là **hình học** (khung bao không chạm biên), và
   phép ghép đỉnh phải **dò đúng phép xoay** rồi so cả hai chiều. Một cổng hay báo oan sớm
   muộn cũng bị người ta tắt đi.

## 7. Đường khác đã cân nhắc

**Chỉ nạp cụm rạn trong khung nhìn (dùng `src/lib/spatial-index.ts`)** — *không thay được*.
Chỉ mục lọc được cụm nào trong khung, nhưng để lọc thì **vẫn phải giải mã cả file `.bin`
trước** — tức vẫn trả đủ 292 ms giải mã + **323 MB RAM**, đúng khoản đắt nhất. Nó cắt được
phần xén ô, không cắt được phần nuốt dữ liệu.

**Chia file theo vùng (mỗi ô 1°×1° một file)** — *không thay được, vì lý do hình học*.
Nó giúp ở zoom sâu, nhưng **ở z6 khung nhìn phủ gần hết Biển Đông** ⇒ tải hết mọi vùng ⇒
quay về 4 triệu đỉnh. Muốn z6 nhẹ thì phải có **bản giản lược riêng cho z6**, mà đó chính
là vector tile. Chia vùng còn phải tự viết mã tra vùng, tự lo cache, tự lo offline — trong
khi PMTiles dùng lại nguyên khuôn app **đã chạy** cho nền bản đồ.

**Giảm độ nét nguồn (tăng `SIMPLIFY_TOL` lúc sinh)** — *không được phép*: nó hạ độ chính
xác của lớp cảnh báo vật cản ở mọi zoom, kể cả zoom sâu, để đổi lấy một con số cho vừa mắt.
Vector tile cho đúng cái lợi ấy ở zoom thấp **mà không đụng zoom sâu**.

## 8. Còn phải làm gì nếu Lead chốt thay

Xếp theo mức nguy hiểm nếu quên:

1. 🔴 **`public/sw.js` — quên là hỏng offline.** Nhánh phục vụ Range đang **gắn cứng vào
   `BASEMAP_ARCHIVE`** (`/data/vn-basemap.pmtiles`). Thư viện `pmtiles` không tải cả file mà
   xin từng đoạn `Range: bytes=a-b`; Cache API **bỏ qua** header Range và trả nguyên bản 200,
   `pmtiles` bắt đúng ca đó rồi **ném**. Nghĩa là: thêm file `.pmtiles` thứ hai mà không
   sửa nhánh này thì ngoài biển mất sóng **lớp rạn chết hẳn**, trong khi trên bàn làm việc
   mọi thứ xanh. Phải cho nhánh đó nhận **một danh sách** file, và chạy bộ bắt buộc trong
   `docs/app-map/ops/qa-offline-acceptance.md`. *(Tôi không đụng `sw.js` — ngoài phần việc
   được giao.)*
2. 🟡 **`src/components/fishing-map-view.tsx`** — `<Source id="reef-shapes" type="geojson">`
   → `type="vector"` + `url="pmtiles:///data/reef-shapes-aca.v1.pmtiles"`, và **mỗi
   `<Layer>` phải thêm `source-layer="reef"`** (quên là lớp im lặng không vẽ gì). Nhớ gọi
   `registerPmtilesProtocol()` trước — hiện đã gọi sẵn cho nền.
3. 🟡 **Lớp `reef-hazard` không đi theo được.** Nó lọc `kind` ∈ `rock`/`wreck`, mà bộ ACA
   chỉ có `reef`/`shoal` — hai loại đó nằm ở `reef-shapes.v1.json` (OSM). Phải tách nó ra
   nguồn riêng, đừng để nó chết lặng.
4. 🟡 **Hôm nay app vẫn dùng `reef-shapes.v1.json` (782 KB, OSM), chưa dùng `.bin` ACA.**
   Nên đây **không phải** một hồi quy đang xảy ra — nó là quyết định cho lần bật ACA lên.
   Nếu bật thẳng bằng đường GeoJSON thì mới rơi vào đúng 3.970 ms / 835 MB đo ở trên.
5. 🟢 **Số phận file `.bin`.** Sau khi thay, `.bin` chỉ còn là **vật liệu để sinh lại**
   `.pmtiles`. Giữ cả hai trong git là gánh 20,4 MB cho một lớp, trong khi quy tắc "một
   lớp = MỘT file" (CLAUDE.md) nghiêng về việc chốt một cái. Đã kiểm: **không có chỗ nào
   khác đang đọc `.bin` ACA** — `scripts/generate-depth-grid.mjs` lấy mặt nạ rạn từ
   `reef-shapes.v1.json` (OSM), không phải từ bộ ACA; ngoài ra chỉ có
   `src/lib/__tests__/reef-aca.test.ts` (cổng giấy phép/chủ quyền) và test này. Bỏ `.bin`
   là bỏ luôn hai cổng đó, nên nếu bỏ thì phải chuyển chúng sang soi `.pmtiles`.
6. 🟢 **Doc + test đi cùng commit**: `02-architecture.md` (nguồn/lớp mới),
   `01-product.md` (nguồn dữ liệu), `ops/external-services.md` nếu đụng.

## 9. Chạy lại

```bash
node --max-old-space-size=8192 scripts/reef-to-pmtiles.mjs
npx vitest run src/lib/__tests__/reef-pmtiles.test.ts
```

Script chạy **6,6 s**, cần `.bin` nguồn, không cần mạng. Sinh lại là hành động **có chủ ý**
(CLAUDE.md, quy tắc 3): mỗi lần chạy là một bản 12 MB nữa nằm vĩnh viễn trong lịch sử git.
