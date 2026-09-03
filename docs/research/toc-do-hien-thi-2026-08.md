# Tốc độ hiển thị bản đồ — bộ đo và số thật (2026-08)

> **Việc của tài liệu này**: dựng bộ đo TRƯỚC khi tối ưu, rồi chỉ ra thời gian
> đang đi đâu. Nó **không đề xuất cách sửa** — đó là việc của hai mảng khác
> (lớp rạn; style/render).
>
> **Bộ đo**: `scripts/bench-render.mjs`. Chạy lại là kiểm chứng lại được:
> ```bash
> node scripts/bench-render.mjs        # đủ 7 phần
> node scripts/bench-render.mjs 1 4    # chỉ phần 1 và 4
> ```
> Mọi con số dưới đây lấy ra từ đó, không chép tay từ chỗ khác.
>
> **Bộ đo anh em**: `scripts/bench-map-method.mjs` đo BYTE và ĐỘ RÕ
> ("gửi bao nhiêu qua sóng, nhìn có rõ không"). File này đo THỜI GIAN CPU và
> RAM ("máy phải làm bao lâu sau khi byte đã về"). Hai câu hỏi khác nhau.

---

## 0. Đọc bảng cho đúng — ba điều phải nhớ trước

1. **Máy đo ≠ máy bà con.** Số ms là của máy dev (Intel i5-14400F, 16 luồng,
   32 GB, Node v20.20.2, Windows). Chỉ số máy chuẩn của bộ đo: **~10–13 ms**
   cho khối việc chuẩn (~31.000–40.000 thao tác/ms). Muốn so bảng này với bảng
   chạy trên máy khác thì chia hai chỉ số máy, đừng so ms với ms.
2. **Bảng này THIẾU phần WebGL.** Không có: nạp/biên dịch shader, dựng texture,
   dựng bucket, bố trí nhãn, đo chữ, khung hình đầu tiên. Xem §6.
   **Thời gian mở bản đồ thật LỚN HƠN tổng ở đây, không nhỏ hơn.**
3. **Số dao động ±2× giữa các lần chạy.** Chạy đủ 7 phần thì bộ rạn ACA giữ
   308 MB trong heap và mọi phép đo sau đó chạy dưới áp lực bộ nhớ cao hơn
   (isobaths: 10 ms khi chạy riêng vs 20 ms trong lượt đủ). **Đọc theo bậc độ
   lớn.** Số trong tài liệu này lấy từ các lượt chạy TỪNG PHẦN RIÊNG.

---

## 1. VIỆC 1 — Bộ đo và số thật

### 1.1 Giải mã — byte đã trong máy → cấu trúc JS dùng được

Mốc này bắt đầu **sau** khi byte đã nằm trong máy. Mạng nhanh cỡ nào cũng không
rút ngắn được một giây CPU ở đây.

| Nguồn | MB đĩa | Cách giải | ms (máy dev) | RAM giữ lại | RSS đỉnh + | Đỉnh / ô |
|---|---:|---|---:|---:|---:|---:|
| `reef-shapes-aca.v1.bin` | 8,05 | varint-delta (`reef-bin.mjs`) | **249** | **308 MB** | **966 MB** | 4.030.270 |
| `depth-grid.v1.bin` | 4,07 | 2 bit/ô, tra tại chỗ | ~0,00 | 0 | 0 | 17.057.881 ô |
| ↳ *nếu ai đó bung 1 byte/ô* | — | *(app KHÔNG làm)* | *19,1* | *+16 MB* | — | 17.057.881 ô |
| `isobaths.v1.json` | 1,27 | `JSON.parse` | 10,0 | 4,5 MB | — | 53.524 |
| `reef-shapes.v1.json` | 0,75 | `JSON.parse` | 5,65 | 2,6 MB | — | 29.242 |
| `vn-coast.v1.json` | 0,21 | `JSON.parse` | 1,71 | 0,6 MB | — | 10.759 |
| `seamarks.v1.json` | 0,18 | `JSON.parse` | 1,13 | 0,5 MB | — | 5.851 |
| `vn-sea-lanes.v1.json` | 0,08 | `JSON.parse` | 0,56 | 0,2 MB | — | 2.759 |
| `vn-aids.v1.json` | 0,03 | `JSON.parse` | 0,14 | 0,1 MB | — | 437 |
| `vn-islands.v1.json` | 0,02 | `JSON.parse` | 0,12 | ~0 | — | 103 |
| `coral-reefs.v1.json` | <0,01 | `JSON.parse` | 0,01 | ~0 | — | 13 |

**Hai điều đáng chú ý:**

- **Bộ giải `reef-bin.mjs` KHÔNG chậm — cái đắt là thứ nó tạo ra.** 249 ms để
  giải 8 MB là hợp lý (32 MB/s). Nhưng kết quả là **308 MB heap thường trú** và
  **966 MB RSS đỉnh điểm**. 4,03 triệu đỉnh dạng `[number, number]` = ~4 triệu
  mảng JS rời + 128.421 mảng vòng + 88.840 mảng mảnh. Đây là con số **RAM**, và
  RAM trên máy yếu là **vách đứng, không phải hệ số** (§4).
- **`depth-grid` là mẫu làm đúng.** `decodeDepthGrid` chỉ *bọc* `ArrayBuffer`
  đã tải, tra bằng dịch bit tại chỗ ⇒ 0 ms, 0 MB thêm cho 17 triệu ô. Dòng
  "nếu bung" cho thấy cái giá của cách "cho tiện": +19 ms CPU và RAM ×4, đổi
  lại **không được gì**.

### 1.2 Dựng chỉ mục ô — phần việc MapLibre bắt worker làm

Cho MapLibre một `type: "geojson"` source là đặt hàng **ba** việc, không phải
một: lấy dữ liệu → `JSON.parse` → **dựng chỉ mục ô** bằng `@maplibre/geojson-vt`
(chiếu, giản lược, cắt lát **toàn bộ** dữ liệu ngay lúc thêm source, không chờ
tới ô nào được nhìn).

Tham số đọc thẳng từ `node_modules/maplibre-gl` (`GeoJSONSource.workerOptions`),
**không đoán**: `buffer: 2048`, `tolerance: 6`, `extent: 8192`, `maxZoom: 18`,
`updateable: true`.

| Nguồn | Đỉnh | Dựng chỉ mục (ms) | RAM giữ | Cắt 4 ô z9 lần đầu | App dùng? |
|---|---:|---:|---:|---:|:--:|
| `isobaths.v1.json` | 53.524 | **54,6** | 8,3 MB | **55,9 ms** (111 hình) | CÓ |
| `reef-shapes.v1.json` (OSM) | 29.242 | 11,8 | 4,0 MB | 29,9 ms (1 hình) | CÓ |
| `vn-coast.v1.json` | 10.759 | 5,16 | 1,1 MB | 8,44 ms (4 hình) | CÓ |
| seamarks (FC dựng trong máy) | 5.851 | 5,00 | 7,1 MB | 25,3 ms (7 hình) | CÓ |
| `vn-sea-lanes.v1.json` | 2.759 | 0,76 | 0,3 MB | 1,00 ms | CÓ |
| `vn-islands.v1.json` | 103 | 0,21 | ~0 | 0,83 ms | CÓ |
| `coral-reefs.v1.json` | 13 | 0,09 | ~0 | 0,09 ms | CÓ |
| **`reef-shapes-aca`** | **4.030.270** | **1.119** | **132 MB** | 44,5 ms (80 hình) | **chưa** |

Cột "cắt 4 ô z9 lần đầu" thường **lớn hơn** cột dựng chỉ mục ở các bộ nhỏ: chỉ
mục chỉ dựng sẵn tới `indexMaxZoom = 5`, mọi ô sâu hơn phải cắt lát từ ô cha
**lúc được xin**. Bà con mở app ở z4,6 rồi zoom vào — mỗi nấc zoom là một mẻ
cắt mới.

### 1.3 Chuỗi hoá qua ranh giới luồng

Source khai bằng `data={objectTrongMáy}` (app đang làm với lớp báo hiệu và mọi
lớp dự báo) đi qua `postMessage` ⇒ **structured-clone toàn bộ object**. Source
khai bằng `data="/data/….json"` thì **không** — worker tự tải, luồng chính không
bao giờ cầm dữ liệu.

| Nguồn | Feature | Đỉnh | `structuredClone` | postMessage khứ hồi (worker thật) | JSON |
|---|---:|---:|---:|---:|---:|
| seamarks (FC trong máy) — **app đang làm** | 5.851 | 5.851 | **19,1 ms** | 25,7 ms | 0,7 MB |
| `isobaths` *(hôm nay khai bằng URL)* | 5.110 | 53.524 | 31,3 ms | 63,4 ms | 1,3 MB |
| `reef-shapes.v1` *(hôm nay khai bằng URL)* | 2.622 | 29.242 | 11,8 ms | 41,8 ms | 0,7 MB |
| `reef-shapes-aca` *(chưa nối)* | 1.534 | 4.030.270 | **2.091 ms** | 6.962 ms | 75,1 MB |

**Phát hiện đáng giá nhất của phần này**: chi phí clone **không** tỉ lệ với số
byte. Lớp báo hiệu 5.851 **điểm** (mỗi feature đúng 1 đỉnh) tốn ~3.300 ns/đỉnh;
bộ rạn 4 triệu đỉnh gói trong 1.534 feature tốn ~520 ns/đỉnh. Chi phí có **hai
vế**: một vế theo số **object** phải đi bộ qua (mỗi feature là 4 object rời:
feature, geometry, properties, mảng toạ độ), một vế theo số **đỉnh**. Bốn điểm
dữ liệu chưa đủ tách hai vế ⇒ **đừng ngoại suy bằng một hệ số**; muốn ước một
lớp mới thì thêm nó vào mảng `cases` của phần 3 rồi đo thẳng.

### 1.4 PMTiles

`vn-basemap.pmtiles` 13,77 MB · zoom 0–9 · **982 ô có địa chỉ** · ô nén gzip.

| Việc | ms |
|---|---:|
| Mở **lần đầu** (mã còn nguội): dựng + header + thư mục gốc | 43,7 |
| Mở **lần hai** (mã đã nóng), cùng công việc | **1,33** |
| Lấy 1 ô z9 lần đầu (trèo thư mục + giải nén) | 0,3 – 0,9 |
| Lấy 1 ô z5 (ô to nhất, 64 KB sau bung) | 1,3 – 2,2 |
| Cả khung nhìn điện thoại z9 (6 ô 512 px, 47 KB) | **~2,0** |
| SW: dựng lại `ArrayBuffer` 13,8 MB (1 lần/vòng đời SW) | ~2,7 |

**Cái bẫy đọc số ở đây**: 43,7 ms mở lần đầu **không phải** chi phí đọc file —
42,3 ms trong đó là làm nóng V8/zlib (chứng minh: cùng công việc lần hai còn
1,33 ms, chỉ 1 lượt đọc 16 KB). Bộ đo tách hẳn hai dòng để không ai kết luận
nhầm rằng đọc header PMTiles là chỗ tốn.

**PMTiles về CPU gần như không tốn gì.** Cái tốn của nền bản đồ nằm ở chỗ khác
và **không đo được ở Node**: service worker phải tải nguyên **13,8 MB** về kho
(`fillBasemapArchive`) trước khi có ô đầu tiên, và mỗi lượt xin ô đi qua
`caches.match` + `Response.arrayBuffer()` + `buf.slice()`.

### 1.5 Dựng style

| Cấu hình | Số lớp | Source | ms | JSON |
|---|---:|---:|---:|---:|
| nền trơn (`layerId = null`) | 57 | 2 | 0,04 | 15,7 KB |
| hải đồ độ sâu — **cấu hình app đang dùng** | 60 | 4 | **0,03** | 16,7 KB |
| nước nóng lạnh (raster GIBS) | 58 | 3 | 0,03 | 16,1 KB |
| hải đồ + lớp ảnh báo hiệu | 61 | 5 | 0,03 | 16,9 KB |

`protomapsLayers("basemap", light)` sinh 57 lớp trong 0,09 ms; `buildMapStyle`
giữ 54 (bỏ symbol + background + boundaries).

**`buildMapStyle` KHÔNG phải chỗ tốn: 0,03 ms, tức 1/500 ngân sách một khung
hình.** Kể cả nhân ×9 cho máy yếu vẫn là 0,3 ms. Ai định tối ưu chỗ này thì
đang tối ưu số 0. Nhưng — xem §6 — **sau** cái object 16,7 KB đó, MapLibre còn
validate style-spec, dựng `StyleLayer`, biên dịch mọi biểu thức paint/layout và
biên dịch shader WebGL cho 60 lớp. **Phần đó mới là phần nặng, và nó cần trình
duyệt để đo.**

---

## 2. VIỆC 3 — Ngân sách thời gian đề xuất

Ngân sách **đo trên máy bà con**, không phải máy dev.

| Mốc bà con cảm nhận được | Ngân sách | Vì sao đúng con số đó |
|---|---:|---|
| **THẤY BIỂN** — có màu nước + hình bờ | **1.000 ms** | Nielsen 1 s: quá đây là bà con biết mình đang chờ. Màn trắng trên tàu = tưởng app hỏng. `sea-bg` + `vn-coast` phải kịp mốc này. |
| **THẤY BẢN ĐỒ** — ô nền + đường đẳng sâu ở khung nhìn đầu | **2.500 ms** | Mốc LCP "tốt" của Core Web Vitals. Đây là lúc bà con đọc được vị trí mình. |
| **CHẠM ĐƯỢC** — chạm ra thông tin, kéo/zoom nhả tay | **100 ms** | RAIL *Response*. Chạm không nhả trong 100 ms là bà con chạm lại — rồi chạm nhầm. Trên tàu lắc, chạm nhầm là mất tuyến. |
| **MỘT KHUNG HÌNH** khi kéo bản đồ | **16 ms** | RAIL *Animation* (60 khung/s). |
| **MỘT KHỐI VIỆC** trên luồng chính | **50 ms** | RAIL *Idle* / định nghĩa long task. Dài hơn là tay chạm bị nuốt. |

**Vì sao hai mốc riêng "thấy biển" và "thấy bản đồ"**: bà con mở app giữa biển,
sóng chập chờn. Cái tệ nhất không phải chậm — là **màn hình trắng**, vì trắng
đọc ra "app hỏng" chứ không đọc ra "đang tải". App đã có `sea-bg` (nền nước vẽ
trước mọi thứ) đúng vì lý do này. Ngân sách phải tách hai mốc thì mới nghiệm thu
được cái lớp cứu-hộ đó, chứ gộp một mốc thì nó biến mất khỏi bảng.

**Vì sao mốc web thường vẫn dùng được ở đây**: ngưỡng cảm nhận là ngưỡng của
con người, không phải của thiết bị. Nhưng bối cảnh làm chúng **ngặt hơn**: nắng
chói (phải nhìn lâu hơn mới đọc được), tàu lắc (chạm khó hơn), một tay bám
(không thao tác lại được thoải mái). Vì vậy nên coi các con số trên là **trần
tuyệt đối**, không phải mục tiêu.

**Nguồn**: [RAIL — web.dev](https://web.dev/articles/rail) ·
[Response Times: The 3 Important Limits — NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/) ·
[Largest Contentful Paint — web.dev](https://web.dev/articles/lcp)

---

## 3. VIỆC 2 — Quy đổi sang máy phổ thông

**Node không có cách hãm CPU thật.** `--cpu-prof` chỉ đo, không hãm;
`--max-old-space-size` hãm RAM chứ không hãm CPU. Nên phần này là **quy đổi
bằng hệ số có nguồn**, và nó là **ước lượng, không phải phép đo**.

| Loại máy | Hệ số | Nguồn |
|---|---:|---|
| Máy tầm trung (Galaxy A54 5G hoặc tương đương) | **×4** | Lighthouse mặc định (`cpuSlowdownMultiplier: 4`, "đưa một máy desktop mạnh về khoảng máy di động tầm trung"); DevTools *mid-tier* cũng ×4 |
| Máy phổ thông, còn khoẻ | **×6** | Chrome DevTools *low-tier* mặc định (×6 CPU + mạng kiểu 3G) |
| Máy phổ thông đã dùng vài năm | **×9** | Đo thật trên Galaxy A15 5G so với máy dev: **×9,1** (Harry Roberts, 8/2025) |

- [Lighthouse — `docs/throttling.md`](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
- [Low- and Mid-Tier Mobile for the Real World (2025) — CSS Wizardry](https://csswizardry.com/2025/08/low-and-mid-tier-mobile-for-the-real-world-2025/)
- [CPU Throttling in Chrome DevTools and Lighthouse — DebugBear](https://www.debugbear.com/blog/cpu-throttling-in-chrome-devtools-and-lighthouse)

Chọn dải ×6–×9 làm mốc chính cho SDFish (bà con dùng điện thoại phổ thông rẻ
tiền, thường đã dùng vài năm), giữ ×4 làm mốc lạc quan.

### Giới hạn của phép quy đổi — đọc trước khi trích số ra ngoài

1. **Hệ số CPU là một số nhân đều; đời thật không đều.** Việc nặng bộ nhớ (bộ
   rạn 4 triệu đỉnh) chậm **hơn** hệ số vì máy rẻ có ít bộ nhớ đệm và băng thông
   RAM thấp. Việc nặng số học chậm đúng hệ số hơn.
2. **RAM là vách đứng, không phải hệ số.** Máy 3–4 GB mà app xin thêm 300 MB thì
   không "chậm gấp 9" — nó bị hệ điều hành **giết**, hoặc tab bị nạp lại. Cột
   "RAM giữ" ở §1.1–1.2 phải đọc như **ngưỡng an toàn**, không phải như thời gian.
3. **Node ≠ trình duyệt.** Cùng V8 nhưng khác cơ chế dọn rác, khác phân bổ luồng,
   và **hoàn toàn không có WebGL**.
4. **Điện thoại hạ xung khi nóng.** Máy để trên buồng lái nắng chiếu, sau 10 phút
   hệ số thực tế còn tệ hơn ×9. Không có trong hệ số của Chrome/Lighthouse, và
   không mô phỏng được ở Node.
5. **Hệ số của Chrome/Lighthouse tính trên máy dev của *người đo*.** Máy dev
   trong tài liệu này (i5-14400F) mạnh hơn máy dev trung bình, nên ×6–×9 ở đây
   có thể vẫn còn **lạc quan**.

⇒ **Con số cuối cùng phải đo trên máy thật.** Bộ đo này thu hẹp chỗ cần soi,
không thay được một cái điện thoại A15 cắm dây.

---

## 4. VIỆC 4 — Ba chỗ tốn nhất

Xếp theo **lớp bản đồ** (cái bà con thật sự ngồi chờ), không theo thao tác lẻ.
Mỗi lớp = tải → parse → clone (nếu truyền object) → dựng chỉ mục → cắt ô đầu.

| Lớp | Máy dev | ×6 | ×9 | % ngân sách 2.500 ms (×6) |
|---|---:|---:|---:|---:|
| **1. Đường đẳng sâu** (`isobaths.v1.json`) | **116 ms** | **696 ms** | 1.044 ms | **28 %** |
| **2. Nền vector PMTiles** \* | 57,0 ms | 342 ms | 513 ms | 14 % |
| **3. Báo hiệu hàng hải** (`seamarks.v1.json`) | **55,5 ms** | **333 ms** | 499 ms | **13 %** |
| 4. Hình rạn OSM (`reef-shapes.v1.json`) | 50,3 ms | 302 ms | 453 ms | 12 % |
| 5. Bờ biển offline (`vn-coast.v1.json`) | 15,4 ms | 92,2 ms | 138 ms | 4 % |
| 6. Luồng / tuyến | 2,21 ms | 13,3 ms | 19,9 ms | 1 % |
| 7. Nhãn đảo / rạn / báo hiệu VN | 1,27 ms | 7,64 ms | 11,5 ms | 0 % |
| 8. Dựng style | 0,03 ms | 0,20 ms | 0,30 ms | 0 % |
| 9. Lưới độ sâu (tra điểm, không vẽ) | 0,00 ms | 0,00 ms | 0,00 ms | 0 % |

\* Trong 57 ms của PMTiles có ~42 ms là **làm nóng V8/zlib** (xem §1.4), không
phải công việc thật. Trừ khoản đó ra thì PMTiles rơi xuống cuối bảng — nhưng
khoản làm nóng đó **có thật trên trình duyệt** dưới dạng phân tích + biên dịch
bundle, chỉ là nó thuộc về maplibre-gl chứ không thuộc về PMTiles.

### Vì sao ba chỗ đó tốn — không phải "phải làm gì"

**① Đường đẳng sâu — 116 ms, tốn gấp đôi lớp kế tiếp.**
Ba khoản gần bằng nhau: `JSON.parse` 10 ms + dựng chỉ mục 54,6 ms + cắt 4 ô z9
đầu tiên 55,9 ms. Nguyên nhân **không** phải file to (1,27 MB là nhỏ) mà là
**hình thái dữ liệu**: 5.110 tuyến / 53.524 đỉnh trải trên **chín mức đẳng sâu**
sinh ở bước 1/48°, tức rất nhiều **đường ngắn, uốn nhiều, nằm chồng nhau trong
dải ven bờ hẹp**. `geojson-vt` phải chiếu và giản lược từng đỉnh rồi cắt lát
theo ô — và MapLibre đặt `buffer: 2048` trên `extent: 8192`, tức **mỗi ô cõng
thêm 25 % chiều rộng ở mỗi cạnh**, nên đỉnh gần biên ô bị xử lý nhiều lần. Cộng
thêm: `isobath-labels` là lớp `symbol` đặt dọc đường (`symbol-placement: line`),
mà chi phí bố trí nhãn **không nằm trong bảng này** — nó chỉ đo được trên trình
duyệt và sẽ **cộng thêm** vào 116 ms.

**② Nền vector PMTiles — 57 ms, nhưng con số này gây hiểu nhầm.**
Việc đọc thật rẻ: 1,33 ms mở kho, ~2 ms cho cả khung nhìn 6 ô. Phần lớn 57 ms là
làm nóng V8/zlib. **Cái tốn thật của nền bản đồ không nằm trong bảng này**: SW
phải kéo nguyên **13,8 MB** về kho trước khi có ô đầu tiên
(`fillBasemapArchive`, `cache: "reload"`), và ô ở z5 bung ra tới **64–97 KB**
mỗi ô — 982 ô cho cả z0–9 nghĩa là ô rất "đậm". Đó là chi phí **mạng + service
worker + WebGL**, đo được ở trình duyệt chứ không ở Node.

**③ Báo hiệu hàng hải — 55,5 ms cho 5.851 cái chấm.**
Đây là chỗ **kiến trúc trả tiền, không phải dữ liệu**. File chỉ 184 KB và parse
chỉ 1,13 ms. Nhưng lớp này đi đường **object trong máy**, không phải URL:
`fetchSeamarks` → `decodeSeamarks` → `useMemo` dựng FeatureCollection (0,95 ms)
→ truyền vào `<Source data={seamarkGeo}>` ⇒ **structured-clone 19,1 ms** sang
worker → dựng chỉ mục 5,0 ms → cắt 4 ô z9 đầu 25,3 ms. Chi phí clone tính theo
**số object**, không theo byte: 5.851 điểm = ~23.000 object rời, mỗi cái một
lượt cấp phát ở đầu bên kia. Đây cũng là lớp duy nhất trong nhóm đầu bảng mà
**luồng chính** (chứ không phải worker) phải gánh — clone chạy trên luồng chính,
tức nó ăn thẳng vào ngân sách "chạm được" 100 ms.

### Và một quả bom chưa nổ: `reef-shapes-aca.v1.bin`

File 8,05 MB **đã nằm trong `public/data`** (được git theo dõi) nhưng **chưa nối
vào bản đồ** — trong `src/` nó chỉ xuất hiện ở test. Nếu nối vào theo cách thẳng
nhất (một geojson source cho cả bộ):

| Bước | Máy dev | ×6 | ×9 |
|---|---:|---:|---:|
| Giải mã `reef-bin` | 249 ms | 1,5 s | 2,2 s |
| Dựng chỉ mục `geojson-vt` | 1.119 ms | 6,7 s | 10,1 s |
| `structuredClone` sang worker (nếu truyền object) | 2.091 ms | 12,5 s | 18,8 s |
| **RAM: giữ 308 MB (giải mã) + 132 MB (chỉ mục)** | | | |

Tức **hơn 20 giây** trên máy phổ thông đã dùng vài năm, và **~440 MB RAM thường
trú** — con số thứ hai mới là con số giết app: máy 3–4 GB sẽ bị hệ điều hành
thu hồi tab. Bảng (B) trong bộ đo tách riêng phần này để không ai đọc nhầm nó
thành "chỗ đang tốn".

---

## 5. Bảng xếp hạng đầy đủ — 33 mốc

Xem đầu ra phần 7 của bộ đo. Bảng chia hai:

- **(A)** những gì app chạy thật hôm nay — 33 mốc, **không mốc nào một mình
  vượt 1 giây** trên máy phổ thông ×6. Điều này quan trọng: **không có một chỗ
  nghẽn duy nhất.** Chậm là do **cộng dồn** nhiều lớp, mỗi lớp vài trăm ms.
- **(B)** chưa nằm trong đường chạy: bộ rạn ACA, và chi phí `postMessage` của
  `isobaths`/rạn OSM (hôm nay khai bằng URL nên **không** đi qua clone). Đây là
  bảng "cái giá nếu làm", không phải "cái đang tốn".

Cộng theo nhóm việc (chỉ bảng A, máy dev → ×6 → ×9):

| Nhóm | Máy dev | ×6 | ×9 |
|---|---:|---:|---:|
| Cắt ô đầu (geojson-vt `getTile`) | 115 ms | 690 ms | 1.035 ms |
| Dựng chỉ mục ô | 81,6 ms | 490 ms | 735 ms |
| PMTiles | 63,3 ms | 380 ms | 569 ms |
| Chuỗi hoá (clone/postMessage) | 36,6 ms | 220 ms | 330 ms |
| Giải mã (`JSON.parse` + `reef-bin`) | 18,8 ms | 113 ms | 169 ms |
| Dựng GeoJSON trong máy | 0,98 ms | 5,9 ms | 8,8 ms |
| Dựng style | 0,03 ms | 0,20 ms | 0,30 ms |

⚠️ "Cộng dồn" **không** phải thời gian mở app: vài mốc là các cách khác nhau cho
cùng một việc, vài mốc chạy trong worker song song với luồng chính, và lớp đường
đẳng sâu chỉ dựng khi bà con đang ở nền "hải đồ độ sâu". Bảng để so **bậc độ
lớn**, không để cộng ra một con số.

---

## 6. Chỗ KHÔNG đo được ở Node — cần trình duyệt thật

**Đây là danh sách việc còn lại, không phải lời bào chữa.** Mỗi mục dưới đây là
thời gian có thật mà bảng ở trên **không** chứa. Không được bịa số cho chúng.

| Không đo được | Vì sao | Đo bằng gì |
|---|---|---|
| **WebGL**: biên dịch shader, dựng texture, khung hình đầu | Cần WebGL context | Chrome DevTools Performance, `map.on("load")` ↔ `"idle"` |
| **Dựng bucket + atlas ký tự** của MapLibre | Cần canvas để đo chữ | Performance panel, tìm `WorkerTile.parse` |
| **Bố trí nhãn** (`symbol-placement: line` của `isobath-labels`) | Dính đo chữ trên canvas | Như trên — đây là khoản **cộng thêm** vào lớp #1 |
| **`postMessage` thật của trình duyệt** | Node dùng cùng thuật toán structured-clone nhưng khác cài đặt | Đánh dấu `performance.mark` hai đầu worker |
| **Service worker**: `caches.match` + `Response.arrayBuffer()` trên 13,8 MB, `buf.slice()` mỗi ô | Không có Cache API trong Node | DevTools → Application → Service Workers + Network |
| **Tải 13,8 MB nền lần đầu** (`fillBasemapArchive`) | Là mạng, không phải CPU | Network panel + throttling 3G/4G |
| **Giải nén gzip ô PMTiles bằng `DecompressionStream`** | Node dùng zlib đồng bộ | Performance panel |
| **Phân tích + biên dịch bundle `maplibre-gl`** | Là chi phí nạp JS, không phải chạy | Coverage + Performance panel |
| **Hạ xung do nóng máy** | Không có mô hình nhiệt | Máy thật, chạy liên tục 10–15 phút |

**Việc tiếp theo, đúng thứ tự:**
1. Chạy Lighthouse (mobile preset) trên `/ngu-truong` để có LCP/INP/TBT thật.
2. Đo trên **một máy thật** (Galaxy A15 5G hoặc tương đương), có cắm dây, có
   chạy đủ 10–15 phút để bắt được hạ xung.
3. Dùng `performance.mark` quanh đúng ba mốc ở §2 ("thấy biển", "thấy bản đồ",
   "chạm được") để nghiệm thu bằng số, không bằng cảm giác.

---

## 7. Bộ đo được dựng ra sao — để người sau tin được

- **Dữ liệu thật**: đọc thẳng `public/data`, không dựng dữ liệu giả.
- **Mã thật**: `decodeReefShapes` import thẳng từ `src/lib/reef-bin.mjs` (cùng
  file app import). `buildMapStyle` được **dịch TypeScript tại chỗ** bằng
  `typescript` trong `node_modules`, ghi ra `node_modules/.cache` rồi import —
  **không chép tay sang `.mjs`**, vì bản đo lệch bản chạy thì bộ đo thành thứ
  tệ hơn không đo.
- **Tham số chỉ mục ô đọc ra từ `maplibre-gl`**, không đoán: `buffer`,
  `tolerance`, `extent`, `maxZoom` lấy đúng từ `GeoJSONSource.workerOptions`.
- **`postMessage` đo bằng `worker_threads` thật**, không giả lập bằng
  `structuredClone` — hai con số được in cạnh nhau để thấy chênh lệch.
- **Nguội / ấm được tách bạch**: mở PMTiles lần đầu vs lần hai, để không kết
  luận nhầm chi phí làm nóng V8 thành chi phí đọc file.
- **RAM đo hai kiểu**: `heapUsed` sau khi ép dọn rác với kết quả còn giữ (RAM
  thường trú) và `resourceUsage().maxRSS` (đỉnh điểm).
- **Chỉ số máy** in ra ở phần 6 để bảng số chạy trên máy khác so được.
- **Bộ đo không sửa gì**: không ghi vào `public/`, không sinh asset, không đụng
  `src/`.

---

**Ngày đo**: 2026-08-29/30 · **Máy**: Intel i5-14400F (16 luồng), 32 GB,
Windows 11, Node v20.20.2 · **Bộ đo**: `scripts/bench-render.mjs` ·
`npm test` xanh 2.507/2.507 sau khi thêm bộ đo.
