# Vẽ lại hình rạn từ nguồn độc lập (ACA + WCMC) — 29/08/2026

> **Việc**: dựng một bộ hình rạn **không dính OpenStreetMap**, thay cho
> `public/data/reef-shapes.v1.json` (2.535 hình rạn/bãi + 87 điểm hiểm hoạ, bóc
> từ OSM → **ODbL, có share-alike** → **không bán licence được**).
>
> **Công cụ**: `scripts/generate-reef-shapes-aca.mjs`
> · **Đầu ra**: `public/data/reef-shapes-aca.v1.json`
> · **Cổng nghiệm thu**: `src/lib/__tests__/reef-aca.test.ts`
> · **Schema lý lịch**: `src/lib/provenance.ts` (dùng lại, không sửa)
> · **Số liệu đối chiếu nền**: [doi-chieu-nguon-2026-08.md](doi-chieu-nguon-2026-08.md)
>
> Mọi số dưới đây **đo thật ngày 29/08/2026**, chạy lại được bằng
> `node --max-old-space-size=8192 scripts/generate-reef-shapes-aca.mjs`.
> ⚠️ Bộ mới **chưa được nối vào app**: `public/sw.js`, `src/lib/ocean-map.ts`,
> `src/components/fishing-map-view.tsx` vẫn đọc bộ OSM. Lead quyết (xem §7).

---

## 0. Kết luận trước

1. **Bộ mới sạch giấy phép.** 100% đối tượng có lý lịch gốc là **ACA** hoặc
   **WCMC**, cả hai **CC BY 4.0** (ghi công, **không** share-alike). Không một
   byte hình học nào trích từ OSM. `isCleanLicense` đúng cho **toàn bộ**.
2. **Nét hơn bộ OSM 4 lần.** Sai số mép ≤ **8,4 m ≈ 0,88 px ở z14**, so với
   **32 m ≈ 3,50 px** của bộ OSM.
3. **Lấp đúng lỗ hổng ven bờ.** Khung vịnh Nha Trang: bộ mới **589 mảnh**, bộ
   OSM **1**. Toàn dải ven bờ (<110°Đ): **11.188** so với **331** mảnh (×33,8).
4. **Cỡ file 75,1 MB** (gzip 11,4 MB) — **vượt** mức 40–50 MB chủ dự án nói là
   chấp nhận được. Đây là chỗ **cần Lead quyết**, có bảng đánh đổi ở §4.3.
5. **Chưa thay được HẲN bộ OSM.** Thiếu lớp **điểm hiểm hoạ** `rock`/`wreck`
   (45 đá ngầm + 42 xác tàu) — ACA và WCMC **không có** lớp đó. Xem §6.

---

## 1. Vì sao phải vẽ lại, không phải "xử lý lại"

Hướng dẫn **Trivial Transformations** của OSMF đã chốt: đổi định dạng, cắt
khung, làm thưa đỉnh (Douglas–Peucker) đều là *trivial* — sản phẩm **vẫn là dữ
liệu OSM**, vẫn kéo theo share-alike. Không có cách xử lý nào gỡ được ODbL khỏi
một bộ dữ liệu bóc từ OSM.

Ranh giới pháp lý nằm ở **hành vi trích xuất**, không ở kết quả giống nhau. Nên
script mới:

- **không đọc một byte hình học nào** của bộ OSM khi dựng dữ liệu;
- **có** đọc bộ OSM ở cuối, nhưng **chỉ để in báo cáo so sánh** (đếm hình, đo
  phủ ven bờ) — không số liệu nào của OSM chảy vào file xuất;
- có cổng chặn ở **cả script lẫn test**: đối tượng nào ghi
  `origin.source = "osm"` là hỏng cả gói, không ghi file / test đỏ.

---

## 2. Nguồn và thứ tự tin cậy

| Nguồn | Endpoint | Giấy phép | Phương pháp | Độ phân giải |
|---|---|---|---|---|
| **Allen Coral Atlas** | `allencoralatlas.org/geoserver/ows` WFS **1.0.0**, layer `coral-atlas:geomorphic_data_verbose` | CC BY 4.0 | remote-sensing (PlanetScope) | 5 m |
| **UNEP-WCMC WCMC-008 v4.1** | `data-gis.unep-wcmc.org/.../FeatureServer/1/query` | CC BY 4.0 | survey-compilation | 30 m |

⚠️ **WFS phải là 1.0.0.** Bản 2.0.0 nhận bbox theo thứ tự trục EPSG:4326
(lat,lon) và trả **0 feature mà KHÔNG báo lỗi** — im lặng là kiểu hỏng tệ nhất.

**Thứ tự tin cậy: ACA > WCMC** — lý do là *phương pháp đo*, không phải uy tín.
ACA có quy trình lặp lại được và sai số ước lượng được bằng GSD ảnh; WCMC gộp
nhiều khảo sát nên sai số **không đều theo vùng**. Cùng một chỗ mà hai bên đều
thấy rạn thì **mép của ACA nét hơn**.

### Luật hợp nhất / khử trùng lặp

Với mỗi hình WCMC, đo tỉ lệ thân hình nằm trên vùng ACA đã khoanh (lưới thô
0,002° ≈ 222 m):

- ≥ **15%** → coi là **trùng**, bỏ hình WCMC, giữ mép ACA.
- < 15% → **giữ nguyên** hình WCMC: đó là chỗ ACA mù, thà cảnh báo thô còn hơn
  để trắng một vật cản.

Ngưỡng **15%** (không phải 50%) đến từ đo thật: ở cụm Trường Sa, một hình WCMC
phủ 2.105 ô 222 m còn ACA chỉ 586 ô cùng chỗ (~28%) — **không phải ACA sót
rạn**, mà vì WCMC vẽ cả nền thềm quanh rạn thành một mảng thô 30 m. Lấy 50% thì
gần như không hình WCMC nào bị coi là trùng, và bộ dữ liệu sẽ vẽ chồng mảng thô
lên đúng những rạn đã có mép nét — người lái không biết tin mép nào.

Phân bố thật của tỉ lệ đó trên 406 hình WCMC trong khung:

| tỉ lệ có rạn ACA bên dưới | 0% | <5% | 5–15% | 15–50% | ≥50% |
|---|---|---|---|---|---|
| số hình WCMC | 70 | 3 | 7 | 41 | 285 |

→ **giữ 80 hình** (kể cả hình nhiều mảnh), **bỏ 326 hình trùng**, 22 hình nằm
ngoài khung. Khoảng trống 5–15% chỉ có 7 hình, tức ngưỡng nằm ở **chỗ thưa**
của phân bố — không phải một con số đặt giữa đám đông.

---

## 3. Cách "vẽ lại" — tô lưới rồi dò biên

ACA trả **252.403 mảnh đa giác** trong khung VN (4–24°B, 102–118°Đ), tổng
**24,2 triệu đỉnh** (~535 MB GeoJSON thô), mảnh nhỏ nhất **24 m²**. Đó là **biên
pixel của ảnh phân loại**, không phải hình rạn: giữ nguyên thì vừa quá nặng, vừa
răng cưa, vừa cắt một rạn thành hàng trăm mảnh rời.

Ba bước, **không thêm một dependency nào** (nguyên tắc 1):

1. **Tô** mọi mảnh lên một lưới chung **0,00005°** (≈ 5,6 m) — hợp nhất tự
   động, không cần thư viện cắt đa giác. Lưới giữ dạng **run** (đoạn liên tiếp
   mỗi hàng): 199,9 triệu ô rạn + 29,3 triệu ô bãi thu về 4,5 triệu run.
2. **Dò biên**: nối các cạnh ô có hàng xóm rỗng, hướng sao cho phần đặc luôn
   nằm **bên trái** ⇒ vòng ngoài ngược kim đồng hồ, **vòng lỗ** thuận kim đồng
   hồ. Lỗ được giữ đúng — tô đầy lòng đầm trong rạn vòng là **báo hiểm hoạ giả
   ngay chỗ tàu đi được**. Ở đỉnh "thắt nút" (hai ô chạm nhau theo đường chéo)
   chọn cạnh **rẽ trái nhất** ⇒ ra hai vòng ĐƠN thay vì một vòng tự chạm.
3. **Douglas–Peucker** khử răng cưa.

Dò biên chạy **theo từng cụm liên thông** (lưới thô 712 m) nên đỉnh điểm bộ nhớ
chỉ bằng cụm rạn lớn nhất, không phải cả Biển Đông.

**Kiểm chứng thuật toán** (quan trọng — ghép vòng hay gán lỗ sai thì con số này
lệch hàng chục phần trăm): diện tích các đa giác dò ra ở cụm thử Trường Sa =
**10,951 km²**, kỳ vọng từ số ô lưới = **10,94 km²** → lệch **0,1%**.

---

## 4. Kết quả đo

### 4.1 Bộ mới so bộ OSM

| | bộ mới (ACA+WCMC) | bộ OSM (đang chạy) |
|---|---|---|
| giấy phép | **CC BY 4.0** — bán licence được | ODbL — **không** bán được |
| feature | 1.534 (1 feature = 1 **cụm rạn**) | 2.622 (1 feature = 1 mảnh) |
| mảnh đa giác | **88.840** | 2.535 (+87 điểm hiểm hoạ) |
| đỉnh | **4.030.270** | 29.155 |
| ven bờ (<110°Đ) | **11.188 mảnh** | 331 mảnh |
| vịnh Nha Trang | **589 mảnh** | **1 mảnh** |
| diện tích rạn khoanh được | **6.989 km²** | — (không đo được, hình hở) |
| sai số mép (tệ nhất) | **8,4 m ≈ 0,88 px @z14** | 32 m ≈ 3,50 px @z14 |
| cỡ file | **75,1 MB** (gzip 11,4 MB) | 765 KB (gzip 147 KB) |

Tỉ lệ: mảnh **×35,0** · ven bờ **×33,8** · đỉnh **×138,2**.

Chia theo nguồn và loại:

| nguồn/loại | feature | mảnh | đỉnh | % đỉnh |
|---|---|---|---|---|
| `aca/reef` | 600 | 43.890 | 3.398.724 | 84% |
| `aca/shoal` | 854 | 44.511 | 612.951 | 15% |
| `wcmc/reef` | 80 | 439 | 18.595 | 0% |

**Đối chiếu chéo**: WCMC xác nhận **548/1.454** cụm ACA; vênh
tâm-cụm-ACA ↔ mép-WCMC gần nhất **trung vị 155 m**. (Để so: bộ OSM lệch tâm
**trung vị 1.556 m** so với WCMC — xem doi-chieu-nguon-2026-08.md §3.)

### 4.2 Ngân sách sai số

| Nguồn sai số | Bộ mới (lớp `reef`) | Bộ OSM |
|---|---|---|
| lượng tử hoá lưới | 3,9 m (nửa đường chéo ô 0,00005°) | — |
| Douglas–Peucker | 4,45 m (tol 0,00004°) | 32 m (tol 0,0003°) |
| làm tròn toạ độ | **0 m** (5 số lẻ = đúng bước lưới) | 11 m (4 số lẻ) |
| **cộng dồn tệ nhất** | **8,4 m ≈ 0,88 px @z14** | **32 m ≈ 3,50 px @z14** |

Lớp **`shoal`** (đầm sâu / đầm nông / thềm) đi tol rộng hơn — **0,00012° ≈
13,4 m (~1,4 px)**. Đây là quyết định về **chỗ nào cần nét**, không phải mẹo
nén: mặt rạn/đỉnh rạn là vật cản chết người, còn mép một đầm sâu không phải thứ
người lái căn vào. Gộp cả hai thành một lớp "reef" mới là sai — báo hiểm hoạ giả
giữa lòng đầm thì bà con sẽ tắt lớp cảnh báo, mất luôn cảnh báo thật.

Ánh xạ lớp địa mạo ACA → `kind`:

- `shoal` ← Deep Lagoon · Shallow Lagoon · Plateau
- `reef` ← tất cả phần còn lại (Reef Crest, Outer/Inner/Terrestrial Reef Flat,
  Reef Slope, Sheltered/Back Reef Slope, Patch Reefs) **và mọi lớp lạ** — lớp
  ACA thêm sau này mặc định vào `reef`, sai lệch nghiêng về **cảnh báo thừa**.

### 4.3 Đánh đổi độ nét ↔ cỡ file (đo thật, cùng một bộ dữ liệu)

| tol `reef` / `shoal` | sai số mép `reef` | px @z14 | đỉnh | cỡ file | gzip |
|---|---|---|---|---|---|
| **0,00004° / 0,00012°** ← **đang xuất** | 8,4 m | **0,88** | 4.030.270 | **75,1 MB** | 11,4 MB |
| 0,00008° / 0,00020° ← *vừa khung 40–50 MB* | 12,8 m | 1,35 | 2.229.658 | 41,9 MB | 7,7 MB |
| 0,00012° / 0,00030° | 17,3 m | 1,82 | 1.603.985 | 30,4 MB | 6,0 MB |
| *(bộ OSM để so)* | 32 m | 3,50 | 29.155 | 0,77 MB | 0,14 MB |

Sinh bản 41,9 MB bằng:

```bash
node --max-old-space-size=8192 scripts/generate-reef-shapes-aca.mjs   --tol-reef 0.00008 --tol-shoal 0.00020
```

(Số mảnh đa giác gần như không đổi giữa ba mức — 88.840 / 88.827 / 88.833 — nên
nới tol **không làm mất vật cản nào**, chỉ làm mép thô hơn. Đó là lý do bảng này
là một lựa chọn thật, không phải một cái bẫy an toàn.)

Chủ dự án nói hai câu: *"40–50 MB là chấp nhận được"* và *"đừng hy sinh độ nét
để tiết kiệm byte"*. Bảng trên cho thấy hai câu đó **xung đột**: ở ≤ 1 px thì
trọn khung VN là 75 MB, vì ACA khoanh **6.989 km²** rạn — gấp gần ba lần ước
lượng ban đầu. Bản đang xuất chọn theo câu **sau** (độ nét là câu ra lệnh; 40–50
MB là một mức "chấp nhận được", không phải phép đo). Trần cứng trong script đặt
**80 MB**; vượt nữa là hỏi Lead.

---

## 5. Chủ quyền + lý lịch nguồn

- **Không một trường tên nào** được kéo về. ACA có `class_name` (tiếng Anh),
  WCMC có `name`/`orig_name`/`species`; script chỉ xin `objectid` của WCMC và
  bỏ hết ở đầu ra. Mỗi feature chỉ có đúng hai khoá: `kind` và `prov`.
- **Cổng CJK** (chép từ `scripts/generate-coral-reefs.mjs`) quét **toàn bộ
  chuỗi sắp ghi**; còn chữ Hán là `throw`, **không ghi file**. Test lặp lại cổng
  đó trên file thật bằng `\p{Script=Han|Hiragana|Katakana|Hangul}` — cố ý không
  dán dải ký tự Hán vào mã nguồn, vì `scripts/audit-names.mjs` coi mọi chữ Hán
  trong `src/` là vi phạm, kể cả trong chú thích.
- **Lý lịch theo từng đối tượng** (`properties.prov`, schema
  `src/lib/provenance.ts`): nguồn hình học + kết quả đối chiếu chéo với nguồn
  kia. Phần **giống hệt nhau ở mọi đối tượng** (`version`, `url`, chuỗi ghi
  công) nằm ở `properties.sources` **cấp bộ** — cùng thông tin, tra lại được, mà
  không nhân vài MB thuần lặp.
- **Một feature = một cụm rạn liên thông** (MultiPolygon), không phải một mảnh
  pixel. Đo thật ở cụm Trường Sa: **trung vị 7 đỉnh/mảnh** — phần lớn "hình"
  chỉ là một chấm vài ô, mà mỗi feature GeoJSON tốn ~215 byte khung + lý lịch dù
  chỉ có 5 đỉnh. Gom cụm vừa cắt khoản đó (682 → 29 feature trên cụm thử), vừa
  **đúng hơn về nghĩa**: đối tượng mà lý lịch nguồn nói về là *cụm rạn*, không
  phải mảnh pixel của nó.
- **Ghi công bắt buộc khi phát hành** (CC BY 4.0):
  `Allen Coral Atlas (CC BY 4.0)` và
  `UNEP-WCMC, WorldFish Centre, WRI, TNC (2021), WCMC-008 v4.1`.

---

## 6. Chỗ bộ mới KHÔNG thay được bộ OSM

**Trả lời thẳng câu "đã đủ thay hẳn chưa": CHƯA — thiếu đúng một lớp.**

| Lớp trong bộ OSM | Bộ mới có? | Ghi chú |
|---|---|---|
| `reef` (hình rạn) | ✅ nét hơn, phủ rộng hơn | |
| `shoal` (bãi cạn/ngầm) | ✅ | ACA: Deep/Shallow Lagoon + Plateau |
| `rock` (đá ngầm, chướng ngại) — **45 điểm** | ❌ | ACA/WCMC **không có lớp này** |
| `wreck` (xác tàu) — **42 điểm** | ❌ | ACA/WCMC **không có lớp này** |

87 điểm hiểm hoạ đó là **vật cản đơn lẻ ven bờ và trong luồng** — đúng thứ đâm
tàu, và đúng chỗ ảnh vệ tinh rạn san hô không nhìn ra. Nguồn độc lập thay thế là
**NGA MSI** (public domain), nhưng dò thật 29/08/2026 thì cổng đang **BẢO TRÌ**,
mọi endpoint hiểm hoạ trả 503; chỉ World Port Index còn sống.

Hai giới hạn nữa, ít nghiêm trọng hơn nhưng phải nói ra:

- **ACA chỉ thấy rạn ở nước trong.** Vùng nước đục ven cửa sông (đồng bằng sông
  Hồng, sông Cửu Long) ảnh vệ tinh không phân loại được. Ở đó chỉ còn 80 hình
  WCMC giữ lại, mà WCMC là 30 m và biên tập chứ không phải đo.
- **Bộ mới không có nhãn tên.** Nhãn tên tiếng Việt vẫn ở
  `public/data/coral-reefs.v1.json` (tự soạn từ Wikipedia tiếng Việt, group
  `sdfish`) — không đổi, không dính vào việc này.

---

## 7. Việc Lead phải làm tiếp

1. **Quyết cỡ file.** 75,1 MB (gzip 11,4 MB) **không thể** thả thẳng vào
   `SHELL` của `public/sw.js` — hôm nay `reef-shapes.v1.json` nằm ở tier
   BEST-EFFORT với 765 KB. Ba lối:
   (a) hạ độ nét theo bảng §4.3;
   (b) cắt theo vùng, chỉ tải quanh ngư trường của tàu;
   (c) đóng vector tile / PMTiles thay vì một GeoJSON.
   ⚠️ Bất kể chọn gì: **đụng `sw.js` là phải chạy bộ QA offline bắt buộc**
   (`docs/app-map/ops/qa-offline-acceptance.md`).
2. **Quyết có thay bộ OSM không**, và thay tới đâu. Nếu thay, phải sửa
   `src/lib/ocean-map.ts` (`REEF_SHAPES_DATA_URL`),
   `src/components/fishing-map-view.tsx` (source `reef-shapes`) và danh sách
   `SHELL` trong `public/sw.js` — **cả ba file đều ngoài phạm vi của việc này**.
   Nhớ hợp đồng render hiện tại: lớp `rock`/`wreck` là **Point**; bộ mới không
   có Point nào, nên style phải xử lý được việc đó.
3. **Tìm nguồn độc lập cho `rock`/`wreck`.** NGA MSI khi cổng hết bảo trì, hoặc
   ENC/thông báo hàng hải của Cục Hàng hải VN. Tới lúc đó, giữ lớp điểm OSM
   trong app là được (ODbL cho phép **dùng**), chỉ là **gói bán phải lọc nó
   ra** — `cleanPackage()` trong `src/lib/provenance.ts` làm đúng việc đó.
4. **Ghi công CC BY 4.0** phải hiện ở đâu đó trong app (màn "Giới thiệu" hoặc
   chân bản đồ) trước khi phát hành — CC BY bắt buộc ghi công, không có ngoại lệ.
5. **Nhịp sinh lại.** ACA cập nhật theo đợt; script chạy tay, có cache ô tải
   (`%TEMP%/sdfish-aca-cache`, ~674 MB). Chạy lại là ~25 phút lần đầu, ~8 phút
   khi còn cache.
6. **Nếu đưa vào gói bán (ForMaps)**, chạy `cleanPackage()` trên bộ hợp nhất
   (bộ mới + phần OSM còn lại) để tự động rơi đúng phần dính ODbL.
