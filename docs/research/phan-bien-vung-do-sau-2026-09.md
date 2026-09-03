# Phản biện — "Tự vẽ vùng độ sâu, bỏ hẳn EMODnet" (2026-09-01)

> Việc PHÂN TÍCH, không sửa một dòng `src/`, `public/`, `scripts/`. Mọi con số dưới đây
> là **đo thật** trong phiên này, script dò để ngoài repo (thư mục tạm của phiên).
> Nguồn đo: `public/data/*` tại chỗ, ERDDAP ETOPO 2022 15″, và 57 ô tile EMODnet tải thật.

---

## 0. Kết luận thẳng — bảy dòng

1. **Đề xuất của Lead ĐÚNG ở đích, SAI ở gần hết lý lẽ.** Ba trong bốn lý lẽ (b), (d), và
   rủi ro chất lượng mà brief nêu, đều không đứng được khi đo.
2. **Lỗ Lead tự tìm ra là lỗ giả.** "Đường đẳng sâu không khép kín ở mép khung" chỉ đúng
   nếu ta đi *polygonize đường*. Không ai làm thế: chạy lại marching squares ở **chế độ
   VÙNG** trên chính lưới z đó, đệm một ô "đất" quanh khung → **0 vòng hở trên 3.968 vòng**.
3. **Đường 1 thắng, và thắng đậm: 1,03 MB, 51.879 đỉnh, 9 mức lồng nhau, 0 vòng hở.**
   Nó **thay** `isobaths.v1.json` (1,27 MB) chứ không cộng thêm ⇒ CRITICAL_SHELL **nhẹ đi
   0,24 MB**. Đúng luật "một lớp = một file" và "chỉ commit mức chi tiết nhất".
4. **Đường 3 chết vì DUNG LƯỢNG, không phải vì giấy phép.** Đo 48 ô ngẫu nhiên trong khung
   VN: **trung bình 99.369 byte/ô** — không phải 18 KB như thường tưởng. z0–z9 = **85 MB**,
   z0–z10 = **325 MB**. Giấy phép EMODnet là **CC-BY 4.0, đóng gói lại được** — nên brief
   nói đúng khi bắt soi kỹ, nhưng soi xong thì nó vẫn chết.
5. **Rủi ro "bỏ nguồn tốt lấy nguồn thô" KHÔNG TỒN TẠI.** DTM đo đa tia của EMODnet phủ
   **36W–43E / 15N–90N** (châu Âu) + một mảnh Caribe. Vùng biển Việt Nam nằm ngoài hoàn toàn:
   ở đây EMODnet **đang phát GEBCO 2019 ~500 m**. Ta đang dùng **GEBCO 2026 + ETOPO 2022 ở 15″
   (~450 m), lấy giá trị nông hơn**. Bỏ EMODnet là **nâng cấp**, không phải hạ cấp.
6. **Rủi ro thật nằm chỗ khác, và nó tồn tại sẵn từ trước.** Đối chiếu 415 điểm Thông báo
   hàng hải đối chiếu được: chỉ **1 trên 13** điểm khảo sát nông dưới 4 m được mô hình xếp
   đúng là dưới 4 m. Tô dải "trắng = cạn" ven bờ từ dữ liệu này là **hứa thứ dữ liệu không
   có**. Đây là lý do phải *gate* hai mức nông, không phải lý do giữ EMODnet.
7. Việc nhỏ nhất chứng minh: file 1,03 MB **đã sinh xong** trong thư mục tạm. Thả vào
   `public/data/` **ở máy, không commit**, đổi một `source` trong `buildMapStyle`, nhìn
   z5·z8·z10·z13. Nửa buổi, không tốn một byte lịch sử git nào.

---

## 1. Bốn đường đi — số đo thật

Trần: một file `public/data/**` > **20 MB** ⇒ hook BLOCK. Cả thư mục > **120 MB** ⇒ BLOCK.
Đo mức hiện tại bằng đúng lệnh của hook (`git ls-files --cached --others --exclude-standard`):
**41,0 MB — còn 79,0 MB dư địa.** (Con số 96 MB trong CLAUDE.md đã cũ: `reef-shapes-aca.v1.json`
78 MB nay nằm trong `.gitignore`.)

| | Đường | Cỡ file | Số đỉnh / ô | Offline | ODbL? | z5–z13 |
|---|---|---|---|---|---|---|
| **1** | **Vùng lồng nhau, marching squares chế độ VÙNG** | **1,03 MB** (thay 1,27 MB ⇒ **−0,24 MB**) | **51.879 đỉnh** / 3.968 vòng / **0 vòng hở** | ✅ nằm trong CRITICAL_SHELL như file nó thay | ❌ sạch (ETOPO public domain) | ✅ vector, nét ở mọi mức |
| **2** | Lưới nhiều bit hơn từ ETOPO/GEBCO | 4 bit: **8,13 MB** thô / **1,64 MB** PNG · 8 bit: **16,27 MB** thô / **7,69 MB** PNG | 17.057.881 ô | ✅ | ❌ sạch | ⚠️ **không vẽ được nếu không cắt ô trước** |
| **3** | Đóng gói ảnh EMODnet thành PMTiles raster | z0–8 **24,4 MB** · z0–9 **85,4 MB** · z0–10 **325,1 MB** | 257 / 901 / 3.431 ô | ✅ (nếu lọt trần) | ❌ CC-BY 4.0, **cho đóng gói lại** | ⚠️ nguồn hết nét ở z10, trên đó là phóng mờ |
| **4** | Tô trên GPU (`color-relief` + `raster-dem`) | terrain-RGB liên tục: **98,8 MB** (z0–9) · **DEM lượng tử hoá 16 bậc: 5,5 MB** (z0–9) / 21,1 MB (z0–10) | 59,0 Mpx (z0–9) | ✅ qua PMTiles | ❌ sạch | ⚠️ raster, z>9 là phóng mờ |

### Cách đo từng ô

**Đường 1** — kéo lại đúng lưới `generate-isobaths.mjs` dùng (ETOPO 2022 15″ qua ERDDAP,
stride 5 ⇒ 1/48° ≈ 2,3 km, 865 × 769 = 665.185 mắt, 0 lỗ). Đệm một vòng ô "đất" (−9999)
quanh khung, chạy marching squares 16 ca có xử lý yên ngựa bằng giá trị tâm ô, nối đoạn
thành vòng, Douglas–Peucker đúng `TOL_DEG` hiện hành, làm tròn 5 chữ số thập phân.

```
L=5m     vòng 1169→691   đỉnh 14835→8654    hở 0
L=10m    vòng 1210→724   đỉnh 14948→8776    hở 0
L=20m    vòng 1437→744   đỉnh 16783→9774    hở 0
L=50m    vòng 1626→672   đỉnh 18652→9277    hở 0
L=100m   vòng  775→359   đỉnh 11223→4451    hở 0
L=200m   vòng  269→167   đỉnh  7515→2446    hở 0
L=500m   vòng  220→151   đỉnh  8038→2217    hở 0
L=1000m  vòng  302→222   đỉnh  9650→2786    hở 0
L=2000m  vòng  346→238   đỉnh 11740→3498    hở 0
TỔNG     3.968 vòng · 113.384 đỉnh thô → 51.879 sau giản lược · 0 vòng hở
depth-areas.json = 1.079.024 byte = 1,03 MB
```

Kiểm tính lồng nhau (diện tích có dấu, độ²) — **đơn điệu giảm, không một chỗ lệch**:

```
5m 194,8 → 10m 192,6 → 20m 187,1 → 50m 159,5 → 100m 127,0
→ 200m 112,9 → 500m 104,2 → 1000m 94,4 → 2000m 60,4
```

**Đường 2** — lượng tử hoá lưới theo thang phi tuyến kiểu hải đồ, đóng bit, rồi đo
`deflate -9` và PNG thật (sharp). Đo trên lưới 1/48° rồi nhân ra 17.057.881 ô. Đây là
**chặn trên**: lưới 15″ mịn hơn ⇒ tương quan không gian cao hơn ⇒ nén tốt hơn số này.

| bit | bậc | thô | deflate | PNG |
|---|---|---|---|---|
| 2 | 4 | 4,07 MB | 0,38 MB | 0,48 MB |
| 3 | 8 | 6,10 MB | 0,83 MB | 0,93 MB |
| 4 | 16 | 8,13 MB | 1,33 MB | 1,64 MB |
| 6 | 64 | 12,20 MB | 3,60 MB | 4,00 MB |
| 8 | 256 | 16,27 MB | 6,31 MB | 7,69 MB |

**Đường 3** — 48 ô ngẫu nhiên trong khung VN (24 ô z8 + 24 ô z9), tải thật, đọc
`size_download`:

```
n=48  tổng=4.769.752 B  TRUNG BÌNH = 99.369 B/ô  (nhỏ nhất 49.815 · lớn nhất 162.167)
```

Ô EMODnet **không phải 18 KB**. Đây là ảnh PNG truecolour của một trường liên tục có
đổ bóng — nó nặng đúng như ảnh chụp. Nhân ra:

```
z0–z8   257 ô  →  24,4 MB   ← ĐÃ VƯỢT trần 20 MB/file, mà z8 thì thô vô dụng
z0–z9   901 ô  →  85,4 MB   ← vượt 4×
z0–z10 3431 ô  → 325,1 MB   ← vượt 16×
```

Mã hoá lại PNG8 (256 màu) may lắm được 3× ⇒ z0–z9 vẫn ~28 MB, **vẫn quá trần**.

**Đường 4** — `maplibre-gl` cài trong repo là **5.24.0**, và style-spec của nó **có**
`color-relief` (26 chỗ trong bundle) cùng `raster-dem`. Nghĩa là tô liên tục trên GPU là
việc làm được thật. Nhưng `color-relief` **bắt buộc** ăn một `raster-dem` source ⇒ vẫn
phải có kim tự tháp ô. Đo bằng sharp:

```
terrain-RGB liên tục:  1,7542 B/px  → z0–z9 = 98,8 MB   ← quá trần
DEM lượng tử 16 bậc:   0,0984 B/px  → z0–z9 =  5,5 MB   ← LỌT
                                      z0–z10 = 21,1 MB  ← lại quá trần
```

Độ phân giải nguồn 450 m ứng với z ≈ 8,4; z9 (≈299 m/px) đã là phóng lên rồi, nên
z0–z9 là mức cao nhất *lương thiện*. Con số dùng được là **5,5 MB**.

---

## 2. Kiểm bốn lý lẽ của Lead — hai sai, một nửa đúng, một đúng

### (a) "Offline chỉ còn ô đã tình cờ xem" — **nửa đúng, và cơ chế còn tệ hơn Lead mô tả**

Đọc `public/sw.js`:

- Ô `/api/tiles/*` **không hề được tải sẵn** ở bất cứ đâu. Không có bước prefetch nào —
  grep toàn `src/` chỉ ra chỗ *dùng*, không có chỗ *nạp trước*. Vào kho hoàn toàn do
  `tileFirst` nhặt lúc bà con vô tình kéo qua.
- Kho `SDFISH_TILE_V` trần **600 ô**, dọn **FIFO** (không phải LRU), và **tụt xuống 120 ô**
  khi `storage.estimate()` thấy máy còn dưới 60 MB (`tranOHienGio`).
- **Kho đó dùng chung cho `chart` VÀ `seamark`.** Kéo bản đồ ở cửa lạch (seamark từ z8)
  là đẩy ô hải đồ ra khỏi kho.
- Không có ô ⇒ trả **204**, bản đồ coi như ô trống, **không báo gì**.

Vậy claim (a) **được xác nhận**, và mạnh hơn: kể cả ô đã xem cũng không chắc còn.

**Nhưng phải trừ đi phần Lead nói quá:** mất sóng thì bà con **không mất trắng**. Còn nguyên
`vn-basemap.pmtiles`, `isobaths.v1.json` (9 mức đường + nhãn mét), `reef-shapes-aca.v1.pmtiles`,
`seamarks.v1.json`, `soundings*.json`, `fairway-depths.v1.json` — tất cả nằm trong SHELL hoặc
kho PMTiles riêng. Cái mất chính xác là **mảng tô nền**, tức đúng cái đường 1 lấp.

### (b) "Bỏ được tile server ngoài CUỐI CÙNG khỏi đường bản đồ" — **SAI**

`src/lib/tile-proxy.ts` có **hai** nguồn: `chart` (EMODnet) **và** `seamark`
(`tiles.openseamap.org`, **ODbL**). Ngoài ra `src/lib/ocean-map.ts` còn kéo `sst` và
`chlorophyll` từ **NASA GIBS**. Bỏ EMODnet còn lại ít nhất ba host ngoài. Câu này không
nên dùng làm lý do — nó không đúng, và nó khiến phương án được cho điểm bằng thứ nó không làm.

### (c) "Lấp khoảng cách với Navionics" — **ĐÚNG, và đây là lý lẽ duy nhất đứng vững**

Chính hồ sơ trong repo đã chấm: `docs/research/do-phu-hai-do-2026-08.md` §A xếp `DEPARE`
(depth area) là 🟡 — *"nén còn 4 bậc và **không tô lên bản đồ**"*, trong khi `DEPARE` là
mức **B (Display Base)** trên ECDIS, tức lớp không được phép tắt. Đây là lỗ thật, đã đo,
đã ghi. Đề xuất nhắm đúng chỗ.

### (d) "ETOPO/GEBCO không dính ODbL nên sạch hơn cho việc bán licence sau này" — **SAI, và sai đúng kiểu CLAUDE.md cảnh báo**

Giấy phép EMODnet World Base Layer, tra tận bản ghi metadata:

- **Access constraints: "Creative Commons Attribution 4.0 International"**
- Không share-alike. Không phi-thương-mại. Phần ngoài châu Âu là **GEBCO Grid** —
  *"in the public domain"*, và cho phép rõ *"Commercially exploit The GEBCO Grid"*.
- Có "DO NOT USE FOR NAVIGATION" — nhưng câu đó **GEBCO cũng có**, tức là nó áp cho
  **cả nguồn ta đang dùng**, không phân biệt hai phương án.

Nói cách khác: **CC-BY 4.0 sạch y hệt ETOPO/GEBCO về mặt cản trở thương mại.** Không có
ODbL, không có copyleft, không có mét vuông nào cần né. Đây chính xác là kiểu suy luận mà
CLAUDE.md §"Nguồn dữ liệu — ĐỪNG TỰ GIỚI HẠN" viết ra để chặn: *loại một nguồn vì một ràng
buộc không tồn tại*. Nếu đường 3 thắng ở dung lượng thì giấy phép **đã không cản** — nó chỉ
thua vì 99.369 byte/ô.

---

## 3. Lỗ Lead tự tìm ra là lỗ GIẢ — và đây là chỗ quan trọng nhất của phản biện này

Brief viết:

> `isobaths.v1.json` là **ĐƯỜNG, không phải VÙNG** — không tô trực tiếp được, và đường đẳng
> sâu cắt ở mép khung thì không khép kín.

Câu đó đúng **về file đang có**, và sai **về việc phải làm**. Không ai đi khép 5.110
LineString đã giản lược thành vùng. Việc đúng là:

> Chạy lại marching squares trên **cùng lưới z** mà `generate-isobaths.mjs` đã kéo, nhưng ở
> **chế độ VÙNG** (`độ sâu ≥ L`) thay vì chế độ ĐƯỜNG (`độ sâu = L`), sau khi **đệm một vòng
> ô "đất" quanh khung**.

Đệm xong thì **mọi** vùng đóng kín bên trong lưới đệm — theo định nghĩa, không phải theo may
mắn. Đo được: **0 vòng hở trên 3.968 vòng.** Vấn đề mép khung biến mất, không cần một dòng
code xử lý riêng.

Hai hệ quả nữa, đều có lợi:

- **Biên của vùng CHÍNH LÀ đường đẳng sâu.** Vùng "sâu ≥ 5 m" có biên là đường 5 m ở mọi chỗ
  (đất nằm ngoài vùng, nên không có đoạn biên nào chạy dọc bờ). Nghĩa là **một file phục vụ
  cả `fill` lẫn `line` lẫn `symbol` nhãn mét** — `isobaths.v1.json` không cần tồn tại nữa.
  Đúng luật 1 ("một lớp = một file") và luật 2 ("chỉ commit mức chi tiết nhất").
- **Không cần thư viện mới.** `scripts/generate-isobaths.mjs` đã tự viết marching squares +
  Douglas–Peucker rồi. Thêm chế độ vùng là bảng 16 ca + đệm khung, cỡ 40–60 dòng vào chính
  script đó. Không `d3-contour`, không vi phạm luật "cấm thêm dep mới cho việc vài dòng".

---

## 4. Vì sao ba đường kia thua

### Đường 3 thua — 99.369 byte/ô, và nó phát GEBCO chứ không phát gì hơn

Hai đòn, mỗi đòn đủ chết:

1. **Dung lượng.** Mức zoom thấp nhất còn *dùng được* (z9) đã là **85,4 MB** — vượt trần
   file 20 MB gấp hơn 4 lần, và một mình nó ăn hết dư địa 79 MB của cả thư mục. Muốn lọt
   trần thì phải dừng ở z8 (24,4 MB — **vẫn vượt**), mà z8 là ~600 m/px: thô hơn cả lưới
   nguồn ta đang có.
2. **Nó không mang thêm thông tin nào.** DTM đo đa tia của EMODnet phủ **36W–43E, 15N–90N**.
   Khung VN là 102–118E, 5–23,5N — **ngoài hoàn toàn**. World Base Layer ở đây là
   **GEBCO 2019 ~500 m**. Ta đã có **GEBCO 2026 + ETOPO 2022 ở 15″ (~450 m)**, lấy giá trị
   nông hơn, cộng mặt nạ rạn. Đóng gói 85 MB để phát lại một phiên bản GEBCO **cũ hơn 7 năm
   và thô hơn** là trả giá cao nhất để nhận về ít nhất.

Đòn thứ ba, nhẹ hơn nhưng đáng nói: ảnh đã tô màu sẵn thì **màu chết cứng**. Bà con không
bao giờ tự đặt được "safety contour theo mớn tàu tôi" — lớp mà `do-phu-hai-do-2026-08.md`
đánh dấu ❌ và ECDIS coi là mức B.

### Đường 2 thua — nó là ĐỊNH DẠNG LƯU, không phải CÁCH VẼ

Nâng 2 bit lên 4 bit cho **16 bậc** tốn 8,13 MB thô (1,64 MB nếu lưu PNG). Lọt trần. Nhưng
xong rồi **vẫn chưa vẽ được gì**: một lưới 4441 × 3841 = 17,06 Mpx không có đường nào vào
MapLibre. Nạp làm `image` source là một texture 17 Mpx (~68 MB RAM GPU ở RGBA) — điện thoại
ngư dân không gánh nổi. Nạp làm `raster-dem` thì **phải cắt ô trước**, tức là đã tự biến
thành đường 4.

Nên đường 2 không phải một phương án song song với ba đường kia; nó là **nửa đầu của đường 4**.
Xếp nó thành lựa chọn riêng là một lỗi phân loại trong brief.

> **Phát hiện phụ, đáng làm độc lập với cả cuộc tranh luận này:**
> `depth-grid.v1.bin` hiện **4,07 MB thô** cho đúng 4 bậc, và nó nằm trong **CRITICAL_SHELL**
> (tải nguyên khối lúc cài PWA ở cảng sóng yếu). Cùng dữ liệu ấy đóng PNG là **0,48 MB**.
> Đang có **~3,6 MB mỡ** trong ngân sách cài đặt — đúng thứ CLAUDE.md gọi là *"ĐỔI ĐỊNH DẠNG
> LƯU, không đổi chỗ lưu"*. Việc này **không** cần đợi quyết định vùng độ sâu.

### Đường 4 thua sát nút — 5,5 MB, và một dây chuyền mới chưa ai chạy thử

Đây là đối thủ thật, không phải rơm. Ưu điểm thật: gradient liên tục trên GPU, đổi màu bằng
biểu thức nên **safety contour tự đặt vẫn làm được**, và MapLibre 5.24.0 hỗ trợ sẵn.

Thua ở bốn chỗ:

1. **5,5 MB so với 1,03 MB** — gấp 5,3 lần, để đổi lấy 16 bậc rời rạc thay vì biên liên tục.
2. **Nó CỘNG THÊM một file, không thay file nào.** `isobaths.v1.json` 1,27 MB vẫn phải ở lại
   (đường + nhãn mét). Hai file, hai đường sinh, hai chỗ lệch nhau — trái luật "một lớp = một
   file". Đường 1 thì *thay*.
3. **Dây chuyền mới, chưa chứng minh:** sinh kim tự tháp DEM → đóng PMTiles raster → thêm vào
   `PMTILES_ARCHIVES` của `sw.js` → `raster-dem` đọc qua `pmtiles://`. Mắt xích cuối là chỗ
   `sw.js` đã tự ghi án lệ: *"trên bàn làm việc VẪN XANH — vì có mạng… ngoài biển mất sóng…
   lớp rạn chết hẳn, không một dòng lỗi nào tới tay bà con."*
4. **Hết nét ở z9.** Trên z9 là phóng mờ, mà app vẽ tới z12,5 (`SOUNDING_LABEL_MINZOOM`).

Nếu về sau muốn gradient mượt kiểu Navionics thật, đường 4 là đường đúng để đi — **sau khi**
đường 1 đã chứng minh rằng bà con đọc được dải tô. Không phải trước.

---

## 5. Rủi ro chất lượng khi bỏ EMODnet — thật, nhưng KHÔNG phải rủi ro brief nêu

Brief lo: *"bỏ nguồn tốt lấy nguồn thô rồi tô cho đẹp là làm bà con tin vào thứ kém hơn trước."*
Lo đúng **cơ chế**, sai **đối tượng**. Bỏ EMODnet không hạ cấp gì (§4). Rủi ro thật là:

**Tô dải làm cho dữ liệu 450 m TRÔNG như dữ liệu khảo sát.**

Số đo, lấy thẳng từ `public/data/soundings-verified.v1.json` (675 điểm Thông báo hàng hải
đối chiếu với ETOPO + GEBCO), và tính lại theo đúng ba dải màu app đang dùng (4 m / 12 m):

```
675 điểm chính thức
  ├─ 253 (37,5%) KHÔNG ĐỐI CHIẾU ĐƯỢC — ô 450 m không phân giải nổi lòng lạch;
  │              ở Lòng Tàu, Thị Vải, Soài Rạp, Năm Căn cả hai mô hình xếp là ĐẤT
  ├─  17 nghi lỗi bóc
  └─ 415 đối chiếu được:
        cùng dải (4 m/12 m):  320 / 415 = 77,1%
        |Δ| trung vị:         1,9 m       (Δ trung vị −1,7 m — lệch về phía NÔNG, tức phía an toàn)
        p5 … p95:             −7,8 m … +3,0 m
```

Ma trận nhầm (khảo sát → mô hình) — đọc dòng đầu, đó là dòng giết người:

```
khảo sát <4 m  → mô hình <4 m   :  1     ← bắt được
khảo sát <4 m  → mô hình 4–12 m :  12    ← TRƯỢT
khảo sát 4–12  → mô hình <4 m   :  17    (báo động thừa — vô hại)
khảo sát ≥12   → mô hình <4 m   :   7    (báo động thừa)
khảo sát ≥12   → mô hình 4–12 m :  51
```

**Một trên mười ba.** Mô hình bắt được đúng 1/13 số điểm thật sự nông dưới 4 m. Nếu vẽ một
dải trắng và để bà con hiểu "trắng = chỗ cạn, tránh ra", thì 12/13 chỗ cạn thật **không có
màu trắng nào cả**.

Ba việc bắt buộc đi kèm, không phải "nên có":

1. **Hai mức nông (5 m, 10 m) chỉ là THẾ ĐÁY, không phải AN TOÀN.** Chú giải phải nói thẳng
   bằng tiếng đời thường, và mức 5 m/10 m nên **tắt** ở zoom mà `soundings*.json` +
   `fairway-depths.v1.json` đã lên tiếng (z ≥ 11) — để số đo thật che chỗ mô hình đoán.
2. **Đừng vẽ mép sắc.** Biên vector nét căng ở z13 là **diễn kịch độ chính xác**: nhìn như
   sai số 10 m, thực tế ±2 km. Đây là nhược điểm thật của chính đường 1, và cách trả là làm
   mềm/nhoè mép ở zoom cao chứ không phải đổi phương án.
3. **`UNSARE` — chỗ app thú nhận không biết.** `do-phu-hai-do-2026-08.md` đã chấm ❌ cho lớp
   này. 253/675 điểm "không đối chiếu được" là bản đồ chỉ thẳng vào những vùng đó. Tô dải mà
   không kèm nó là làm khoảng trống trông giống như dữ liệu.

Cả ba đều **độc lập với việc bỏ hay giữ EMODnet** — vì EMODnet ở đây cũng là GEBCO 500 m.

---

## 6. Đường 1 thắng — điều kiện để nó thắng thật

| Việc | Kích cỡ | Ghi chú |
|---|---|---|
| Thêm chế độ VÙNG vào `scripts/generate-isobaths.mjs` | ~40–60 dòng | Bảng 16 ca + đệm khung + xử lý yên ngựa. Không dep mới. |
| Sinh `depth-areas.v1.json` | 1,03 MB | Thay `isobaths.v1.json` 1,27 MB ⇒ CRITICAL_SHELL **−0,24 MB** |
| Đổi `buildMapStyle` khi `layerId === "bathymetry"` | 1 `source`, 3 `layer` | `fill` (dải) + `line` (biên = chính đường đẳng sâu cũ) + `symbol` (nhãn mét) từ **một** source |
| Đổi `SHELL` trong `public/sw.js` | 1 dòng | `/data/isobaths.v1.json` → `/data/depth-areas.v1.json`. **Không** bump `SDFISH_CACHE_V` (chỉ đổi URL trong SHELL, `sw.js` đổi byte là cài lại) |
| Gỡ `chart` khỏi `TILE_PROXY` | — | ⚠️ giữ `seamark`; kho `SDFISH_TILE_V` vẫn cần cho nó |

Ba cổng phải qua trước khi gọi là xong:

- **Tương phản dưới nắng chói** — repo đã có cổng canh tỷ lệ tương phản cho màu số đo sâu.
  Dải tô mới phải qua cùng cổng đó, và phải không nuốt mất `REEF_SHAPE_FILL` (teal trong suốt)
  cùng `DEPTH_DANGER_COLOR` đang vẽ đè lên.
- **Offline** — file thay file, cùng nằm CRITICAL_SHELL, nhẹ hơn 0,24 MB ⇒ không thêm request
  mạng nào, không đè dữ liệu bà con đã tải. Vẫn phải chạy bộ bắt buộc trong
  `docs/app-map/ops/qa-offline-acceptance.md` vì có đụng `SHELL`.
- **RAM** — 51.879 đỉnh. Đối chiếu án lệ trong `ocean-map.ts`: lớp rạn 4,03 triệu đỉnh dạng
  GeoJSON ngốn 835 MB (~207 B/đỉnh) nên phải đẩy sang PMTiles. Ở tỷ lệ đó, lớp này là
  **~10,7 MB** — không cần PMTiles, GeoJSON thẳng là đủ.

---

## 7. Việc nhỏ nhất chứng minh phương án — nửa buổi, 0 byte lịch sử git

File **đã sinh xong** trong thư mục tạm của phiên
(`…/scratchpad/depth-areas.json`, 1.079.024 byte). Chưa cần viết script chính thức, chưa cần
commit gì.

1. Chép file vào `public/data/depth-areas.v1.json` **ở máy**. ⚠️ File này **không** nằm trong
   `.gitignore`, mà hook đếm ngân sách lại quét cả file chưa theo dõi
   (`git ls-files --cached --others`) — nên **KHÔNG `git add`**, và **xoá đi ngay sau khi xem**.
2. Trong `buildMapStyle`, nhánh `layerId === "bathymetry"`: đổi `sources["isobaths"].data`
   sang file mới, thêm một `fill` layer màu theo `["get","d"]`, giữ nguyên layer đường + nhãn
   (chúng đọc được biên polygon mà không sửa gì).
3. Mở `/ngu-truong`, xem đúng bốn mức và trả lời bốn câu:
   - **z5** (toàn Biển Đông): chín dải có đọc ra thế đáy không, hay thành một khối lam?
   - **z8** (thềm lục địa): mép dốc 100–200 m — chỗ cá đáy — có nổi lên không?
   - **z10** (ven bờ): chín dải có thành búi không? Dải 5/10 m có nuốt mất lớp rạn teal không?
   - **z13** (cửa lạch): mép có trông sắc nét một cách gian dối không? Chấm số đo sâu thật
     (`soundings*`) còn đọc được đè lên không?
4. Đo hai số trong DevTools: **heap sau khi lớp nạp xong** (kỳ vọng ~10 MB, cờ đỏ nếu > 60 MB)
   và **thời gian một khung khi kéo bản đồ ở z10** (cờ đỏ nếu > 16 ms).
5. Nếu bước 3 câu hỏi z10 trả lời "thành búi" — đó **không** phải lý do bỏ phương án, mà là
   lý do đưa dải 5/10 m vào cùng nấc zoom `isobathZoomGate` đang có sẵn.

Chỉ khi bốn câu ở bước 3 đều qua thì mới viết chế độ VÙNG vào `generate-isobaths.mjs` và
commit. Ngược lại thì đã biết trước khi tiêu một byte lịch sử git nào.

---

## 8. ĐÃ LÀM THẬT (2026-09-01) — số đo sau khi sinh

Chủ dự án chốt làm. Ba việc dưới đây đã xong; số đo là của file thật trong
`public/data/isobaths.v1.json`, không phải bản dựng thử trong thư mục tạm.

### 8.1. Hình dạng file — một lớp, một file, hai vai

`scripts/generate-isobaths.mjs` nay dò **chế độ VÙNG** (`độ sâu ≥ L`) trên lưới có
đệm một vòng ô "đất", rồi xuất **đúng 17 Feature**:

| vai | kiểu hình | mức | dùng cho |
|---|---|---|---|
| `k:"duong"` | MultiLineString | cả 9 (5…2000 m) | nét đẳng sâu + nhãn số mét |
| `k:"vung"` | MultiPolygon | 8 mức từ 10 m | dải tô |

Hai vai **dùng chung một bộ đỉnh** — vai đường là vòng của vai vùng đã cắt bỏ đoạn
chạy dọc mép khung. Sinh rời nhau ở hai dung sai khác nhau thì nét "50 m" nằm lệch
khỏi mép dải 50 m vài km, bà con nhìn ra ngay là bản đồ tự mâu thuẫn.

| | trước | sau |
|---|---|---|
| cỡ file | 1.334.280 B (1,272 MB) | **1.154.129 B (1,101 MB)** — **−0,172 MB** |
| Feature | 5.110 (LineString phẳng) | **17** |
| vòng / đỉnh | — | 3.467 vòng · 38.412 đỉnh |
| **vòng hở** | — | **0** |
| lỗ mồ côi | — | **0** |
| lồng nhau | — | đơn điệu giảm 192,6 → 60,5 độ² |
| đoạn nét chạy dọc mép khung | — | **0** |

Hai điều bản dựng thử ở §1 chưa có, và cả hai đều đổi kết quả:

- **Gắn lỗ vào đúng vòng ngoài.** Bản thử để mỗi vòng thành một Polygon riêng ⇒
  **lỗ cũng bị tô**: bãi ngầm nhô lên giữa vùng 2000 m được tô đúng màu "sâu hơn
  2000 m" — bản đồ nói chỗ nông nhất là chỗ sâu nhất. Nay lỗ lớn nhất trong vùng
  2000 m (bãi ở ~[114,35 · 10,64], Trường Sa) ra dải **1000 m**, đúng.
- **Cắt đoạn mép khung khỏi vai đường.** Đo được **~201° (~22.000 km)** đoạn chạy
  dọc biên. Để nguyên là bản đồ có nét "2000 m" thẳng băng dọc 102°Đ / 118°Đ / 5°B —
  đường đẳng sâu không có thật, mà bản đồ mặc định **không** chặn pan tới mép
  (`LOCKED_BOUNDS` chỉ áp khi bật lớp dự báo).

Ngân sách nhét vừa bằng cách **đổi cách lưu, không đổi chỗ lưu** (CLAUDE.md §CHỐNG
PHÌNH): gộp 5.110 Feature thành 17 (bỏ ~460 KB khung JSON lặp lại) và nới dung sai
Douglas–Peucker gấp đôi — 0,004° ≈ 440 m, vẫn **nhỏ hơn bước lưới nguồn 5 lần**.

```
dung sai ×1  → 1,632 MB   vượt trần
dung sai ×2  → 1,212 MB   ← chọn (bản sinh thật ra 1,101 MB)
dung sai ×2,5→ 1,076 MB   không mua thêm gì mà bắt đầu thấy mép gãy
```

### 8.2. Bờ biển nuốt cửa lạch — đo cho chính file này, và cách xử

Cảnh báo của Lead **được xác nhận, và nặng hơn ở lưới 1/48°**. Trọng tài: **557 điểm**
đo sâu Thông báo hàng hải (`soundings.v1.json` + `soundings-cangvu.v1.json`).

Lưới 1/48° (~2,3 km) nói gì tại chính ô của điểm đã khảo sát:

```
ĐẤT LIỀN          193 / 557 = 34,6%   ← khớp con số 195/557 Lead đưa
nước nhưng < 5 m   33 / 557 =  5,9%
nước ≥ 5 m        331 / 557 = 59,4%
```

**Cách xử đã chọn: TÔ TỪ 10 m TRỞ RA. Mức 5 m chỉ còn là ĐƯỜNG.**

| mức nông nhất được tô | ca tô sâu hơn khảo sát >3 m | bỏ trắng | tô đúng |
|---|---|---|---|
| 5 m | 15 | 262 (47,0%) | 276 |
| **10 m ← chọn** | **11** | **386 (69,3%)** | **156** |
| 20 m | 11 | 546 (98,0%) | 0 |

**Vì sao 10 m, ba lý do có số:**

1. **Nó bỏ đúng chỗ nguy hiểm.** Sáu điểm ở Kiên Giang (737/TBHH-CVHHKG) nước thật
   **1,2–1,4 m** bị dải 5 m tô "≥ 5 m". Tàu vỏ gỗ mớn 1,8–2,5 m đọc con số đó là mắc
   cạn. Sau khi bỏ dải 5 m: cả sáu **không được tô**. Có test chép tay canh.
2. **Mô hình mù đúng ở dải đó** — không phải suy đoán: trong 13 điểm khảo sát thật sự
   nông dưới 4 m, mô hình xếp đúng **ĐÚNG 1** (§5).
3. **Cắt sâu hơn là bỏ thông tin, không phải bỏ rủi ro.** "Tô từ 20 m" — chính là
   hướng Lead gợi ý — **không bỏ được ca nguy hiểm nào** (11 ca cả hai mức) mà xoá
   sạch 156 điểm tô đúng. Đã thử, đã đo, đã bỏ.

**Số còn lại sau khi xử** (557 điểm, file thật):

```
tô sâu hơn khảo sát   > 3 m : 11      (gần hết ở khu tiếp cận Vũng Tàu, +4,7…+5,1 m
                                       — nằm trong bao triều 3–4 m + chuẩn số 0 hải đồ)
                      > 6 m :  1      ← ngưỡng dung sai của chính repo
                                       (soundings-verified nguong.tolAbsM)
                      >15 m :  0
bỏ trắng (có nước, lớp tô im lặng): 386 = 69,3%
tô đúng: 156
```

Ca duy nhất vượt 6 m: **7,2 m ở Lòng Tàu (465/TBHH-CVHHĐN) bị tô 20 m** — lòng lạch
sông mà ô 2,3 km không phân giải nổi. Ghi tên, không giấu.

**Vì sao 69,3% bỏ trắng KHÔNG phải một khiếm khuyết:** bỏ trắng là **hiện trạng** —
hôm nay chưa có lớp tô nào. Và chỗ đó bà con không mù: đã có 557 số đo sâu khảo sát,
13 đoạn luồng có độ sâu khống chế, cùng chính nét đẳng sâu 5 m + 10 m của file này.
Lớp tô chỉ thôi nói cái nó không biết. Đo thêm: mẫu 4.000 điểm ngẫu nhiên trong vùng
tô, tỷ lệ rơi trên **đất thật** (`vn-coast.v1.json`) là **0,03%** — lớp tô gần như
không bao giờ liếm lên bờ.

> Nguyên tắc áp dụng nguyên văn: **thà không tô còn hơn tô sai vào chỗ có nước.**

### 8.3. Test — `src/lib/__tests__/isobath-areas.test.ts`

16 ca, 380 ms, đọc **file thật** trong `public/data`. Cổng chính:

- mọi vòng khép kín · hướng vòng ngoài dương / lỗ âm · 9 dải lồng nhau đơn điệu
- **lỗ không bị tô** (ca chép tay: bãi ngầm ~[114,35 · 10,64] phải ra dải < 2000 m)
- **mức 5 m không được có vai vùng** — quyết định an toàn đóng đinh thành hình dạng file
- vai đường: **0** đoạn chạy dọc mép khung
- cỡ file ≤ 1.334.280 B (đúng cỡ bản nó thay)
- **cổng an toàn với 557 điểm khảo sát**: 0 ca vượt 15 m (bất biến cứng) · ≤ 2 ca vượt
  6 m (nay 1) · ≤ 15 ca vượt 3 m (nay 11)
- **ca chép tay Kiên Giang**: sáu điểm 1,2–1,4 m phải không được tô dải nào

Đã **kiểm cổng bằng đột biến** (test không đỏ được là test trang trí):

| đột biến | cổng bắt |
|---|---|
| bỏ hết lỗ khỏi mọi Polygon | ✅ ca chép tay bãi ngầm (1 đỏ) |
| thêm lại vai vùng cho mức 5 m | ✅ hợp đồng hình dạng + cổng FILL_MIN_M (2 đỏ) |
| mở một vòng (bỏ đỉnh cuối) | ✅ cổng khép kín (1 đỏ) |

Đáng chú ý: đột biến "bỏ hết lỗ" **lọt** cổng lồng-nhau-đơn-điệu (bỏ lỗ làm mọi mức
cùng nở, thứ tự vẫn giữ). Đúng lý do phải có ca chép tay bên cạnh kiểm tra thống kê.

### 8.4. ⚠️ VIỆC CÒN LẠI CỦA LEAD — chặn, không phải nhắc

`src/lib/ocean-map.ts` **chưa lọc theo `k`** (đã kiểm: 0 chỗ nhắc `"k"`). Hai lớp
`isobath-lines` và `isobath-labels` đang đọc source `isobaths` không có bộ lọc vai ⇒
với file mới chúng vẽ **cả biên đa giác của vai vùng**, tức là kéo nguyên **~201°
đoạn mép khung** ra thành nét — đúng thứ vai `duong` được sinh ra để tránh.

`npm test` **vẫn xanh** với lỗi này vì `ocean-map.test.ts` chỉ soi spec của layer,
không soi dữ liệu. Đúng khuôn "trên bàn làm việc vẫn xanh, ngoài biển mới hỏng".

Cần thêm vào cả hai layer (và lớp `fill` mới):

```
// isobath-lines, isobath-labels
filter: ["all", ["==", ["get", "k"], "duong"], ISOBATH_ZOOM_FILTER]
// lớp tô mới
filter: ["==", ["get", "k"], "vung"]
```

Và nên có một ca trong `ocean-map.test.ts` canh rằng mọi layer đọc source `isobaths`
đều mang bộ lọc `k` — nếu không, lần sinh lại sau sẽ lại rơi vào đúng chỗ này.

---

## 9. Nguồn đã tra

- Giấy phép EMODnet World Base Layer (EBWBL) — bản ghi metadata:
  https://www.pigma.org/geonetwork/5a8srv/api/records/386fe2aa-84c4-4cea-9e22-fcba4d5f2e75
  → *Access constraints: Creative Commons Attribution 4.0 International*; phần ngoài châu Âu
  là GEBCO 2019, *"in the public domain"*, cho phép *"Commercially exploit"*; kèm
  *"DO NOT USE FOR NAVIGATION"*.
- Phạm vi phủ EMODnet Bathymetry: https://emodnet.ec.europa.eu/en/bathymetry
  → DTM 2024 phủ 36W–43E / 15N–90N (+ một mảnh Caribe); *"Gaps in data coverage are filled by
  using the GEBCO bathymetry model"*; World Base Layer = lưới EMODnet 2018 quanh châu Âu
  (~115 m) **+ GEBCO 2019 (~500 m) ở nơi khác**.
- Ô tile đo thật: `https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png`,
  48 ô ngẫu nhiên trong khung 102–118E / 5–23,5N.
- Lưới độ sâu: ETOPO 2022 v1 15″ qua ERDDAP oceanwatch.pifsc.noaa.gov (cùng nguồn
  `generate-isobaths.mjs` đang dùng).
- Trong repo: `public/sw.js`, `src/lib/tile-proxy.ts`, `src/lib/ocean-map.ts`,
  `src/lib/depth-grid.ts`, `scripts/generate-isobaths.mjs`, `scripts/generate-depth-grid.mjs`,
  `public/data/soundings-verified.v1.json`, `docs/research/do-phu-hai-do-2026-08.md`,
  `.githooks/pre-commit`.
