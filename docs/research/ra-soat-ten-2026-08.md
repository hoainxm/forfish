# Rà soát tên trên hải đồ — 2026-08-29

> **Mức nghiêm trọng: cao nhất.** Sai một nhãn là sai về chính trị, không phải sai
> về kỹ thuật. Tài liệu này CHỈ BÁO CÁO — **không sửa một dòng dữ liệu nào**.
> Mọi đề xuất đổi tên ở §4 phải do Lead + chủ dự án duyệt trước khi ai đó chạm vào
> `public/data/`.

Công cụ: `node scripts/audit-names.mjs` (mới) · cổng thường trực:
`src/lib/__tests__/no-cjk-data.test.ts` (mới, chạy trong `npm test`).

---

## 0. Kết luận một dòng

Dữ liệu **do dự án tự sinh** (đảo, rạn, hình rạn, phao đèn, bờ, luồng, độ sâu)
**sạch tuyệt đối** — 0 vi phạm. Nhưng **nền bản đồ mua ngoài
`public/data/vn-basemap.pmtiles` (16,9 MB) chứa 13.499 chuỗi tên chữ Hán / tên
tranh chấp**, trong đó có **"三沙市 / Tam Sa / Sansha" đặt ngay trên đảo Phú Lâm,
Hoàng Sa** — đơn vị hành chính Trung Quốc lập ra để "quản" Hoàng Sa + Trường Sa.
Hôm nay app không vẽ nhãn nào từ nền nên **màn hình sạch**, nhưng **file thì
không** — và nó đang được phát tới máy bà con.

---

## 1. Kết quả quét `vn-basemap.pmtiles` — con số thật

Protomaps basemap v4.15.2 · OSM chốt 2026-08-27 · z0–9 · 982 ô tile · 84.320
đối tượng. Quét bằng cách **giải nén từng ô tile rồi đọc bảng thuộc tính MVT**.

> ⚠️ **`grep` trên file này trả về "sạch" GIẢ TẠO.** Mỗi ô tile nén gzip, chữ Hán
> không tồn tại ở dạng văn bản thô. Ai kiểm bằng `grep -P '[\x{4E00}-\x{9FFF}]'`
> sẽ yên tâm nhầm. Đây là lý do phải có bộ quét riêng.

| Con số | Giá trị |
|---|---|
| Đối tượng mang ký tự Hán/CJK | **12.755 / 84.320** |
| Chuỗi tên riêng biệt chứa chữ Hán | **8.326** |
| Vi phạm bộ quét ghi nhận (đã gộp trùng) | **13.499** (13.463 CJK + 36 tên Latin) |
| Lớp dính | `places` 10.255 · `water` 2.979 · `pois` 142 · `earth` 109 · `roads` 22 |
| Trường dính | `name:zh-Hant` 4.157 · `name` 4.133 · `name:zh-Hans` 4.126 · `name:ja` 988 · `ref*` 30 · **`name:vi` 7** |

### 1.1 Ở ĐÂU — mười hai đối tượng nguy hiểm nhất

Toạ độ đọc thẳng từ hình học tile.

| # | Tên trong nền | Vị trí | Lớp / loại | Vì sao nghiêm trọng |
|---|---|---|---|---|
| 1 | **三沙市** · `name:vi=Tam Sa` · `name:en=Sansha` | 112,334°Đ **16,832°B** — trên **đảo Phú Lâm, Hoàng Sa** | `places` · locality, `min_zoom 8`, dân số 2.500 | "Thành phố Tam Sa" — đơn vị hành chính TQ lập 2012 để "quản" Hoàng Sa + Trường Sa. Đây là mục nguy hiểm nhất trong toàn file. |
| 2 | **永乐群岛** · `Yongle Qundao` | 111,743°Đ 16,465°B — **nhóm Lưỡi Liềm, Hoàng Sa** | `places` · town | "Trấn" cấp xã của TQ đặt trên nhóm đảo Hoàng Sa |
| 3 | **七连屿** · `Qilianyu` | 112,269°Đ 16,979°B — **nhóm An Vĩnh, Hoàng Sa** | `places` · town | như trên |
| 4 | **渚碧岛** · `Zhubi` | 114,071°Đ 10,910°B — **Đá Xu Bi, Trường Sa** | `places` · town | TQ biến đá ngầm bồi lấp thành "đảo" rồi thành "trấn" |
| 5 | **渚碧礁** · `name:vi=Đảo Chử Bích` · `name:en=Subi Island` | Đá Xu Bi | `pois` · **military** | Điểm quân sự TQ, **có sẵn tên tiếng Việt SAI** (xem §1.2) |
| 6 | **黄岩岛国家级自然保护区** | Bãi Scarborough | `pois` · nature_reserve | "Khu bảo tồn quốc gia" TQ áp lên bãi tranh chấp |
| 7 | **西沙东岛海域国家级水产种质资源保护区** | Hoàng Sa | `pois` · nature_reserve | "Khu bảo tồn nguồn lợi thuỷ sản Tây Sa" — đúng thứ áp lên ngư trường của bà con |
| 8 | **Kalayaan** | 114,285°Đ 11,054°B — **Đảo Thị Tứ, Trường Sa** | `places` · town | Đơn vị hành chính Philippines đặt trên Trường Sa |
| 9 | **南海** · `name:en=South China Sea` | nhãn biển, hiện từ z3 | `water` · sea | `name` gốc là chữ Hán; `name:vi` đúng ("Biển Đông") nhưng KHÔNG phải trường mặc định |
| 10 | **华光礁** · `name:vi=Đá Hoa Quang` | Hoàng Sa | `earth` · island | Đá Lồi bị gọi theo tên TQ, kể cả ở trường tiếng Việt |
| 11 | **浪花礁** · `name:vi=Đá Lãng Hoa` | Hoàng Sa | `earth` · island | Đá Bông Bay, như trên |
| 12 | **万安滩 / 广雅滩 / 南薇滩 / 人骏滩 / 西卫滩** | Tư Chính · Phúc Tần · Vũng Mây · Huyền Trân · Phúc Nguyên | `water` · reef | Sáu bãi ngầm **trên thềm lục địa Việt Nam** đều có sẵn tên Trung Quốc |

### 1.2 Bẫy nguy hiểm nhất: trường `name:vi` của nền CŨNG BẨN

Phản xạ tự nhiên của người sửa sau này là *"bật nhãn lên nhưng lấy `name:vi` cho
nó ra tiếng Việt"*. **Làm thế là hỏng nặng hơn**, vì chính `name:vi` đang mang
phiên âm Hán-Việt của tên Trung Quốc:

| `name:vi` trong nền | Thực chất là | Tên Việt ĐÚNG |
|---|---|---|
| `Tam Sa` (10 ô tile, z7–9) | 三沙市 Sansha | (không tồn tại — không được vẽ) |
| `Đảo Chử Bích` | 渚碧岛 Zhubi | **Đá Xu Bi** |
| `Đá Hoa Quang` | 华光礁 Huaguang | **Đá Lồi** |
| `Đá Lãng Hoa` | 浪花礁 Langhua | **Đá Bông Bay** |
| `Nam Sa` / `Quận Nam Sa` | 南沙 Nansha | — |

Đây là lý do bộ quét có **nhóm luật D — phiên âm Hán-Việt**: cổng chỉ soi chữ Hán
thì bốn dòng trên đi lọt hết, vì chúng viết bằng chữ Latin có dấu tiếng Việt.

### 1.3 Ranh giới vẽ trên biển

Lớp `boundaries` của nền có đường kẻ **ngoài khơi Trường Sa**:

- `kind=region, kind_detail=3` — 13 đoạn ngoài khơi, mẫu tại **114,44°Đ 11,35°B**
- `kind=county, disputed=true` — 5 đoạn, mẫu tại **113,93°Đ 8,84°B**
- `kind=country` — 4 đoạn, mẫu tại **114,35°Đ 10,33°B**

Hôm nay `buildMapStyle` lọc bỏ mọi lớp `boundaries*` nên không vẽ. Nếu ai bật lại,
bản đồ sẽ hiện ranh giới hành chính giữa quần đảo Trường Sa.

### 1.4 Vì sao màn hình vẫn sạch (hôm nay)

`src/lib/ocean-map.ts` → `buildMapStyle()` lọc style Protomaps, bỏ:
`l.type !== "symbol"` (mọi nhãn) · `l.id !== "background"` · `!l.id.startsWith("boundaries")`.
Thêm `sea-mask` che khung biển khơi ở z≤6. **Ba dòng lọc này là toàn bộ thứ ngăn
chữ Hán hiện lên màn hình bà con.** Một PR "bật nhãn địa danh cho dễ nhìn" là đủ
để phá.

---

## 2. Kết quả quét mọi file khác — SẠCH

| File | Kết quả |
|---|---|
| `public/data/vn-islands.v1.json` (103 đảo) | ✅ 0 |
| `public/data/coral-reefs.v1.json` (13 rạn/bãi) | ✅ 0 |
| `public/data/reef-shapes.v1.json` (2.612 hình) | ✅ 0 — script đã bỏ hẳn tag `name` |
| `public/data/seamarks.v1.json` (~4.000 báo hiệu) | ✅ 0 — đã bỏ hẳn mọi trường tên |
| `public/data/isobaths.v1.json` · `vn-coast.v1.json` · `vn-sea-lanes.v1.json` · `fish-climatology.v1.json` | ✅ 0 |
| `public/data/depth-grid.v1.bin` | ✅ nhị phân số học thuần (lưới 2 bit/ô), không mang văn bản |
| `src/data/*.json`, `src/data/*.ts` | ✅ 0 |
| `src/lib/**/*.ts`, `src/components/**/*.tsx` (chuỗi hiển thị) | ✅ 0 |

Bốn cổng CJK sẵn có trong `generate-islands` / `generate-coral-reefs` /
`generate-reef-shapes` / `generate-seamarks` **đang làm đúng việc**. Lỗ hổng duy
nhất là file nền — thứ không do script nào trong repo sinh ra nên chưa từng qua
cổng nào.

### 2.1 Ghi chú về `depth-grid.v1.bin`

Ép file này thành UTF-8 rồi soi CJK cho ra **19 "chữ Hán" TOÀN BỘ là rác**
(`鯪﫪鯥迪諑髪…`) — byte số ngẫu nhiên tình cờ hợp lệ trong dải Hán. Bộ quét phân
loại bằng cách **giải mã UTF-8 nghiêm (fatal)**: hỏng ở đâu đó → không phải văn
bản → không thể chứa tên. Kiểm chéo độc lập: kích thước file đúng bằng
`ceil(4441 × 3841 / 4) = 4.264.471` byte, không dư một byte nào cho chuỗi.

---

## 3. Bằng chứng cổng KHÔNG RỖNG

Một cổng chủ quyền mà không chứng minh được nó bắt được gì thì tệ hơn không có —
nó tạo cảm giác an toàn giả.

**Bằng chứng 1 — bản sao bị bơm chuỗi bẩn** (bản gốc `public/data` không bị đụng):

```
$ cp public/data/coral-reefs.v1.json <tmp>/coral-dirty.json   # + 三沙市, Vanguard Bank, Đảo Chử Bích
$ node scripts/audit-names.mjs --file <tmp>/coral-dirty.json
❌ 3 vi phạm ở 1 file:
  [CJK]            → 三沙市
  [Vanguard Bank]  → bãi Tư Chính
  [Chử Bích]       → phiên âm 渚碧 — TQ gọi đá Xu Bi
EXIT=1

$ node scripts/audit-names.mjs --file public/data/coral-reefs.v1.json   # bản gốc
SẠCH: không tìm thấy chữ Hán hay tên nước ngoài nào.
EXIT=0
```

**Bằng chứng 2 — hạ mốc nợ về 0, cổng phải đỏ:**

```
$ # tạm sửa BASELINE = 0 trong no-cjk-data.test.ts
$ npx vitest run src/lib/__tests__/no-cjk-data.test.ts
AssertionError: Nền bản đồ có 13499 tên chữ Hán/tranh chấp (mốc đã ghi nhận: 0)…
     Tests  1 failed | 10 passed
$ # khôi phục → 11 passed
```

Chứng minh phát hiện pmtiles **thật sự chảy tới câu khẳng định**, không phải
"xanh vì không quét gì".

**Bằng chứng 3 — 8 ca fixture chạy thường trực trong `npm test`**: chữ Hán · chữ
Nhật (`南シナ海`) · tên Anh (Fiery Cross, Vanguard Bank) · tên Philippines
(Ayungin) · phiên âm Hán-Việt (Chử Bích, Tam Sa) · chuỗi hiển thị bẩn trong mã
nguồn · và hai ca NGƯỢC lại: không kêu oan tên Việt đúng chuẩn, không kêu oan chú
thích. Thêm một ca chốt `stats.files > 200`, `stats.tiles > 900`,
`stats.features > 80.000` để "sạch vì không mở được file" không đi qua được.

### 3.1 Đánh đổi tốc độ

Quét **đầy đủ** 982 ô tile mất **~1,5 giây** — đủ nhanh, nên **không** phải cắt
xuống z0–6 hay lấy mẫu, và **không** cần dấu vân tay tính sẵn lúc build (dấu vân
tay chỉ bắt được "file đổi", không bắt được "file mới cũng bẩn"). Hai quyết định
kỹ thuật mua được tốc độ đó:

1. **Bỏ hẳn hình học.** Bộ đọc MVT tự viết chỉ giải mã `keys` + `values` +
   `tags`, nhảy qua trường geometry — phần nặng nhất của tile.
2. **Không mượn `@mapbox/vector-tile` + `pbf`.** Hai gói đó chỉ là dependency
   **bắc cầu** của `maplibre-gl`; maplibre nâng phiên bản là cổng chủ quyền gãy.
   ~90 dòng protobuf tự viết đổi lấy sự độc lập đó là đáng.

---

## 4. Đối chiếu tên Việt — DANH SÁCH ĐỀ XUẤT, **CHƯA SỬA**

Đối chiếu Wikipedia tiếng Việt + văn bản nhà nước. Chất lượng dữ liệu hiện tại
**cao**: hầu hết toạ độ khớp tới 4 chữ số thập phân với nguồn; **cả 21 thực thể
Việt Nam đóng quân ở Trường Sa đều đã có mặt**. Vấn đề chính là **thiếu**, không
phải **sai**.

### 4.1 Tên nên chỉnh (2 mục — đều là biến thể tên gọi, không phải lỗi chính tả)

| Đang ghi | Đề xuất | Căn cứ |
|---|---|---|
| `Đá Thị` (10,4103 / 114,5872) | **`Đá Núi Thị`** | Bài chính vi.wikipedia là "Đá Núi Thị" (Petley Reef), toạ độ khớp chính xác. Bia chủ quyền Hải quân VN ghi "Đảo Đá Thị" → giữ "Đá Thị" làm tên gọi phụ. |
| `Bãi An Nhơn` (10,7106 / 114,5339) | **`Đá An Nhơn`** | "Bãi An Nhơn" chỉ là trang chuyển hướng; tên chính là "Đá An Nhơn". Ưu tiên thấp. |

**Các mục từng nghi ngờ — đã xác minh ĐÚNG, đừng sửa:** `Đá Ken Nan` (McKennan
Reef) · `Bãi Quảng Nghĩa` (Jehangire Bank — **không phải** "Quảng Ngãi") ·
`Đá Trà Tây` (nguồn: bản đồ hành chính gis.chinhphu.vn) · `Bãi Đèn Pha` ·
`Đảo Ba Ba` · `Đảo Ốc Hoa` · `Đá Én Đất` · `Đá Lồi` 16,2311/111,6931 ·
`Bãi Ốc Tai Voi` 15,7167/112,2167 · `Bãi Phúc Tần` (dạng phổ thông, không phải
"Phúc Tầm").

**Lệch toạ độ nhỏ, ưu tiên thấp:** `Bãi Quế Đường` lệch ~3 km (nguồn:
7,8194/110,5008) · `Đảo Phú Lâm` lệch ~0,5 km · `Đá Ga Ven`: lưu ý nguồn nhà nước
dùng "**cụm** đá Ga Ven" (10,1853/114,2383) = Ga Ven + Đá Lạc.

### 4.2 Thực thể còn THIẾU

**A. Ưu tiên cao — thềm lục địa (Danh sách C thiếu 1 trong 7 cụm DK1):**

| Tên | Toạ độ | Vì sao |
|---|---|---|
| **Bãi Ba Kè** (Bombay Castle) | 7,9364 / 111,7181 | **Cụm DK1 lớn thứ hai: 4 nhà giàn (DK1/4, /9, /20, /21).** Đây là lỗ hổng lớn nhất — app có 6/7 cụm DK1. |
| Bãi Cạn Cà Mau | *không xác minh được* | Có nhà giàn DK1/10 (vịnh Thái Lan). **Không tìm được toạ độ tin cậy — đừng đoán.** |

**B. Ưu tiên cao — Trường Sa, nước khác chiếm nhưng là chướng ngại/điểm định hướng thật:**

| Tên | Toạ độ | Vì sao |
|---|---|---|
| **Đảo Song Tử Đông** (NE Cay) | 11,4528 / 114,3547 | Philippines — **cách Song Tử Tây chỉ 1,5 hải lý**; app có cái này thiếu cái kia là bẫy định hướng |
| **Đá Châu Viên** (Cuarteron) | 8,8650 / 112,8303 | TQ quân sự hoá, **chỉ cách Đá Đông 10 hải lý** — vùng bà con đánh bắt |
| **Đá Tư Nghĩa** (Hughes) | 9,9086 / 114,4972 | TQ, nằm giữa cụm Sinh Tồn, sát điểm VN đóng quân |
| **Đảo Ba Bình** (Itu Aba) | 10,3769 / 114,3656 | Đài Loan — đảo tự nhiên lớn nhất quần đảo |
| **Đảo Thị Tứ** (Thitu) | 11,0531 / 114,2847 | Philippines — lớn thứ hai, có dân thường |
| **Đá Hoa Lau** (Swallow) | 7,3736 / 113,8269 | Malaysia — đường băng, mốc cực nam |
| Đá Lạc | 10,1625 / 114,2522 | Nửa còn lại của "cụm đá Ga Ven" |

**C. Ưu tiên cao — Hoàng Sa:**

| Tên | Toạ độ | Vì sao |
|---|---|---|
| **Đá Sơn Kỳ** (Antelope Reef) | 16,5767 / 111,6667 | **Nền rạn chứa Đảo Ốc Hoa + Đảo Ba Ba** — app đã có hai đảo nhưng thiếu nền rạn, tức thiếu chính vật cản |

**D. Ưu tiên thấp hơn** (chướng ngại thật, bổ sung khi có đợt): Đảo Loại Ta, Đảo
Bến Lạc, Đảo Bình Nguyên, Đảo Vĩnh Viễn, Loại Ta Tây, Đá Công Đo (Philippines);
Đá Én Ca, Đá Kỳ Vân, Đá Kiêu Ngựa, Bãi Thám Hiểm (Malaysia).

**E. KHÔNG xác minh được — đừng thêm:** `Bãi La Mác`, `Đá Trương Nghĩa` (Hoàng
Sa), `Bãi Đất`, `Bãi Đinh` (thềm lục địa). Không có nguồn tiếng Việt đáng tin cho
toạ độ. Chủ quyền không phải chỗ để đoán.

### 4.3 Đơn vị hành chính

**(a) Cả hai gán hiện tại ĐÚNG — nhưng loại đơn vị đã đổi từ 1/7/2025:**

| Đang ghi | Thực tế sau sắp xếp 2025 |
|---|---|
| `TP Đà Nẵng` (Hoàng Sa) | ✅ đúng cấp tỉnh. Huyện Hoàng Sa → **đặc khu Hoàng Sa**, vẫn thuộc TP Đà Nẵng (NQ 1659/NQ-UBTVQH15) |
| `tỉnh Khánh Hòa` (Trường Sa) | ✅ đúng cấp tỉnh. Thị trấn Trường Sa + xã Song Tử Tây + xã Sinh Tồn → **đặc khu Trường Sa**, thuộc tỉnh Khánh Hòa (NQ 1667/NQ-UBTVQH15) |

→ Đề xuất hiển thị: *"Đặc khu Hoàng Sa, TP Đà Nẵng"* · *"Đặc khu Trường Sa, tỉnh
Khánh Hòa"*.

**(b) `Thềm lục địa phía Nam` cho 6 bãi DK1 — ĐÚNG, và PHẢI GIỮ NGUYÊN.**
Đây là điểm pháp lý quan trọng nhất của cả đợt rà soát. Lập trường chính thức của
Việt Nam: bãi Tư Chính **nằm trên thềm lục địa phía Nam, KHÔNG thuộc quần đảo
Trường Sa**, và Việt Nam **bác bỏ việc gán ghép** bãi này vào Trường Sa. Sáu bãi
này là nơi Việt Nam có **quyền chủ quyền và quyền tài phán** theo UNCLOS 1982 —
khác về bản chất với **chủ quyền lãnh thổ** đối với đảo. **Gán chúng cho một
tỉnh/thành là sai lệch pháp lý thực chất.**
⚠️ Đừng nhầm: Tiểu đoàn DK1 / Lữ đoàn 171 Vùng 2 Hải quân đóng quân ở khu vực
nguyên là Bà Rịa – Vũng Tàu (từ 1/7/2025 thuộc TP.HCM) — đó là **nơi đóng quân của
đơn vị**, không phải đơn vị hành chính của các bãi ngầm. **Đừng đổi nhãn thành
"TP.HCM".**

**(c) Bãi Cỏ Rong + Bãi Cỏ Mây gán `truong-sa` — ĐÚNG.** Bãi Cỏ Rong "nằm ở đông
bắc quần đảo Trường Sa"; Bãi Cỏ Mây có nguồn bản đồ hành chính huyện Trường Sa,
tỉnh Khánh Hòa (gis.chinhphu.vn), toạ độ khớp chính xác.
⚠️ Lưu ý vận hành: **cả hai đang do Philippines kiểm soát trên thực tế** (Cỏ Mây
có tàu BRP Sierra Madre mắc cạn, là điểm nóng đụng độ). Nếu app hiển thị tình
trạng chiếm đóng hoặc cảnh báo an toàn, hai điểm này cần cảnh báo riêng.

---

## 5. KHUYẾN NGHỊ CHO LEAD

### 5.1 Có phải dựng lại file nền không? — **CÓ, nhưng không gấp trong tuần**

Cân nhắc thật:

- **Rủi ro hôm nay = 0 trên màn hình.** Ba dòng lọc trong `buildMapStyle` chặn
  hết. Không có chuyện bà con nhìn thấy chữ Hán.
- **Rủi ro ngày mai = cao.** Chỉ cần một PR "bật nhãn cho dễ đọc" hoặc "dùng
  `name:vi` cho ra tiếng Việt" là chữ Hán + "Tam Sa" hiện ngay. Lớp phòng vệ hiện
  tại là **quy ước trong code**, không phải thuộc tính của dữ liệu.
- **Rủi ro thương mại = rất cao.** Nếu đóng gói bán licence (ForMaps), ta phát đi
  một file chứa "三沙市" đặt trên Hoàng Sa và "黄岩岛国家级自然保护区". Đây là
  chuyện khác hẳn với việc app không vẽ nó.

### 5.2 Ba phương án, theo thứ tự khuyến nghị

**① Dựng lại tile từ nguồn, lọc trường tên lúc đóng gói — KHUYẾN NGHỊ**

Dùng `planetiler` + hồ sơ Protomaps basemap trên OSM extract vùng, thêm bước bỏ
mọi khoá `name*` / `ref*` khỏi `places` · `pois` · `earth` · `water` · `roads`,
và bỏ luôn lớp `boundaries`. App vốn **không dùng một nhãn nào từ nền** nên
**không mất gì về chức năng**, lại nhẹ đi đáng kể (bảng chuỗi là phần tốn chỗ nhất
của MVT — ước tính giảm 25–40% của 16,9 MB, tức nhẹ hơn cho bà con tải ngoài
khơi).
Đánh đổi: cần máy có Java + bộ nhớ, và một lần chạy vài chục phút. Đây là cách
duy nhất biến "app không vẽ" thành "dữ liệu không có".

**② Viết bộ lọc hậu kỳ trên chính file `.pmtiles` hiện có**

Đọc từng ô tile → giải nén → dựng lại MVT bỏ các khoá tên → nén lại → ghi archive
mới. **Bộ đọc MVT trong `scripts/audit-names.mjs` đã làm được nửa việc** (đọc
keys/values/tags); phần còn thiếu là ghi ngược, ~150 dòng. Không cần Java, không
cần mạng, chạy vài giây.
Đánh đổi: tự viết bộ ghi protobuf = tự chịu rủi ro sinh tile hỏng — **bắt buộc**
phải kiểm bằng cách mở lại bằng chính bộ đọc + so số đối tượng trước/sau.

**③ Giữ nguyên file, siết bằng cổng — ĐANG LÀM, nhưng không đủ một mình**

Cổng `no-cjk-data.test.ts` đã chốt mốc 13.499: **không cho nền phình bẩn thêm**.
Nên bổ sung một test riêng khẳng định `buildMapStyle` **thật sự lọc hết** lớp
`symbol` + `boundaries*` — biến quy ước trong comment thành khẳng định máy kiểm
được. Nhưng phương án này **không giải quyết được rủi ro ForMaps**: file phát đi
vẫn bẩn.

### 5.3 Việc Lead phải quyết / làm tiếp

1. **QUYẾT §5.2**: chọn ① hay ② để làm sạch nền, và có gộp vào lộ trình ForMaps
   không. Nếu bán licence thì đây là việc **chặn phát hành**.
2. **DUYỆT §4.1** (2 đổi tên) và **§4.2** (10 thực thể ưu tiên cao cần bổ sung) —
   trình chủ dự án. Tôi **không sửa** vì đây là chuyện chủ quyền.
3. **QUYẾT §4.3(a)**: có đổi nhãn sang "Đặc khu Hoàng Sa / Đặc khu Trường Sa"
   theo NQ 1659 & 1667 (hiệu lực 1/7/2025) không.
4. **GIAO thêm test khoá `buildMapStyle`** (§5.2③) cho người giữ `src/lib/ocean-map.ts` —
   tôi không sở hữu file đó nên không đụng.
5. **KHÔNG bao giờ** bật nhãn từ nền bằng `name:vi` — xem §1.2. Nếu cần nhãn tiếng
   Việt, lấy từ `vn-islands.v1.json` / `coral-reefs.v1.json` (app đang làm đúng).
6. Cân nhắc gọi `node scripts/audit-names.mjs` trong `.githooks/pre-commit` khi
   commit có đụng `public/data/**` — hiện cổng chỉ chạy ở `npm test`.

---

## 6. Giới hạn đã biết của bộ quét (nói thẳng, không giấu)

- **Dương tính giả còn lại trong nhóm luật Latin (36 vi phạm tên Latin ở nền):**
  `Zhongsha` 中沙镇 (thị trấn Quảng Đông) · `Yongxing` 永兴镇 (thị trấn Hải Nam) ·
  `Zhubi River` 珠碧江 (sông Hải Nam) là **địa danh có thật trong đất liền Trung
  Quốc**, không phải nhãn sai chủ quyền. Cố ý **không nới luật** cho chúng: chúng
  chỉ xuất hiện trong file nền vốn đã bẩn toàn diện, còn nới luật thì đúng lúc
  "Yongxing Island" (đảo Phú Lâm) lọt.
- **Đã siết 4 luật để tránh kêu oan tên Việt Nam thật:** `Vạn An` (xã ở Nghệ An),
  `Vĩnh Hưng` (huyện ở Đồng Tháp), `Nam Sa` (quận Nam Sa, Quảng Châu), `Nam Vi`
  (sông ở Lào) chỉ tính vi phạm **khi đi kèm từ chỉ thực thể trên biển**
  (đảo/đá/bãi/cồn/rạn/quần đảo/thành phố) — tức đúng dạng nhãn hải đồ. Có test
  cho cả hai chiều.
- **Danh sách tên cấm là hữu hạn.** Nó bắt các tên đã biết; một tên lạ chưa có
  trong danh sách vẫn lọt (nếu viết bằng chữ Latin). Cổng CJK thì không có lỗ này.
- **Không quét `docs/`**: tài liệu phải được phép viết ra tên cấm để bàn về chúng.
- **Không quét file test** (`src/lib/__tests__/`): fixture bắt buộc phải chứa
  chuỗi bẩn để chứng minh cổng bắt được, và test không nằm trong bundle phát đi.

---

**Người thực hiện**: teammate "SẠCH TÊN" · **Ngày**: 2026-08-29
**File mới**: `scripts/audit-names.mjs` · `src/lib/__tests__/no-cjk-data.test.ts` ·
tài liệu này. **Không sửa một byte nào trong `public/data/`.**
