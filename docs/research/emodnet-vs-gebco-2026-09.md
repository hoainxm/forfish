# EMODnet so với GEBCO/ETOPO trên vùng biển Việt Nam — đo thật, 2026-09-01

> **Câu hỏi duy nhất của tài liệu này**: nếu bỏ EMODnet và tự vẽ độ sâu từ
> ETOPO/GEBCO, bà con có bị đưa cho thứ **tệ hơn** thứ họ đang có không?
>
> **Kết luận một câu: BỎ EMODnet là AN TOÀN — vì EMODnet chưa từng cho vùng
> biển Việt Nam một con số độ sâu nào.** Bộ dữ liệu đo đa tia của EMODnet khai
> biên đông ở **43–45°Đ**; Việt Nam nằm ở **102–117°Đ**, cách rìa bộ dữ liệu
> khoảng **6.500 km**. Cái app đang lấy từ EMODnet là **một tấm ảnh nền dựng
> trên chính GEBCO**, không phải số đo.

Điều này lật ngược tiền đề của phép so: đây **không phải** đổi nguồn tinh lấy
nguồn thô. Đây là bỏ một tấm ảnh GEBCO phát từ máy chủ châu Âu, để tự vẽ lấy
tấm ảnh từ đúng dữ liệu GEBCO/ETOPO mà app **đã** dùng cho mọi con số.

---

## 1. EMODnet có gì ở vùng biển Việt Nam — bốn phép đo độc lập

Bốn cách hỏi khác nhau, bốn lần cùng một câu trả lời. Mỗi phép đều có **đối
chứng châu Âu chạy cùng lúc** để chứng minh không phải mình gọi sai API.

| # | Cách hỏi | Việt Nam | Châu Âu (đối chứng) |
|---|---|---|---|
| 1 | REST `depth_sample`, lưới 2° khắp bbox 103–117°Đ / 6–23°B | **0/72 có số** (72 lần HTTP **204 No Content**) | — |
| 2 | REST `depth_sample` tại **45 điểm khảo sát THẬT** (rải Cà Mau → Quảng Ninh) | **0/45 có số** (45 lần 204) | 3/3 có số, kèm lý lịch khảo sát |
| 3 | WMS `GetFeatureInfo` lớp `mean_atlas_land`, `mean_multicolour` | **0 feature** | **1 feature** (có giá trị pixel) |
| 4 | Ô tile DTM `mean_atlas_land` ở z6 · z8 · z10 | **854 B** (PNG trong suốt, cả ba zoom) | 70.868 · 42.715 · 47.164 B |

Ba điểm đối chứng châu Âu trả về đúng thứ mà tiền đề mô tả — **đo đa tia thật,
truy được ra tổ chức thuỷ đạc**:

| Nơi | EMODnet trả về | Lý lịch nguồn |
|---|---|---|
| Biển Bắc (3,0°Đ 54,0°B) | −40,2 m | CDI `HY17516`, tổ chức EDMO 574 |
| Địa Trung Hải (5,5°Đ 43,0°B) | −877,1 m | DTM `MB_DTM_1_64_ESSROV2010_Cassidaigne_SURVEY` |
| Eo Manche (−4,0°Đ 50,0°B) | −70,9 m | CDI `122634`, EDMO 2607 |

Còn ở 45 điểm khảo sát Việt Nam: **204, rỗng, không một con số nào.**

**Biên khai trong `GetCapabilities`** (không phải suy đoán, là chính bộ dữ liệu
tự khai):

```
mean_atlas_land     W -73.125   E 45.0    S 5.625   N 90.0
mean_multicolour    W -73.125   E 45.0    S 5.625   N 90.0
contours            W -70.5     E 43.0    S 11.0    N 90.0
hr_bathymetry_area  W -70.5     E 43.0    S 11.0    N 90.0
```

Đông nhất là **45°Đ**. Không có lớp DTM nào của EMODnet chạm tới kinh độ 102°.

### Vậy app đang lấy gì từ EMODnet?

Đúng **một** thứ, ở đúng **một** dòng: `src/lib/tile-proxy.ts` — ô raster
`chart` ← `tiles.emodnet-bathymetry.eu/2020/baselayer/...`. Đó là **baselayer
toàn cầu**, không phải DTM. Ô này có nội dung ở Việt Nam (117–142 KB ở z6),
trong khi ô DTM cùng chỗ chỉ 854 B — nghĩa là nội dung ấy không thể đến từ dữ
liệu đo của EMODnet, nó là lớp phủ toàn cầu dựng trên GEBCO.

Mọi **con số** độ sâu trong app — `depth-grid.v1.bin`, `isobaths.v1.json`,
ràng buộc cạn của `route-plan.ts`, cảnh báo nước cạn — đã lấy từ ETOPO + GEBCO
+ mặt nạ rạn từ trước, không đi qua EMODnet dòng nào.

---

## 2. Neo vào sự thật mặt đất: 675 mẫu khảo sát nhà nước

Trọng tài: `soundings.v1.json` (379 điểm) + `soundings-cangvu.v1.json`
(178 điểm) + `fairway-depths.v1.json` (13 đoạn) — độ sâu do các Cảng vụ Hàng
hải đo bằng máy hồi âm, công bố trong Thông báo hàng hải. Tổng **675 mẫu**
(557 điểm rời, 105 đỉnh vùng, 13 đoạn luồng).

Δ = **mô hình − khảo sát**, mét. Δ **dương = mô hình nói SÂU HƠN thực tế** —
đó là chiều nguy hiểm, vì `route-plan.ts` sẽ cho tuyến chạy qua.

### Bảng A — theo dải độ sâu khảo sát

| Dải | n | so được | GEBCO Δ trung vị | GEBCO \|Δ\| tv | GEBCO \|Δ\| p90 | ETOPO Δ trung vị | ETOPO \|Δ\| tv | ETOPO \|Δ\| p90 | mô hình nói "ĐẤT" |
|---|---|---|---|---|---|---|---|---|---|
| dưới 5 m | 72 | 47 | **−0,6** | 4,0 | 6,7 | +3,4 | 6,2 | 7,9 | 40 (56%) |
| 5 – 10 m | 252 | 227 | **−2,7** | 2,7 | 10,4 | −2,0 | 2,5 | 13,2 | 112 (44%) |
| 10 – 20 m | 351 | 328 | **−2,3** | 2,4 | 14,7 | −2,3 | 3,4 | 15,9 | 101 (29%) |
| 20 – 50 m | **0** | — | — | — | — | — | — | — | — |
| 50 – 200 m | **0** | — | — | — | — | — | — | — | — |
| trên 200 m | **0** | — | — | — | — | — | — | — | — |

**Cột EMODnet không có trong bảng vì không có gì để điền.** 0/45 điểm khảo sát
được EMODnet trả lời.

### Bảng B — theo khoảng cách bờ

| Dải | n | GEBCO \|Δ\| tv | ETOPO \|Δ\| tv | mô hình nói "ĐẤT" |
|---|---|---|---|---|
| dưới 1 km (trong sông/lạch) | 125 | 12,5 | 15,3 | **113 (90%)** |
| 1 – 5 km | 346 | 2,3 | 3,3 | 99 (29%) |
| 5 – 20 km | 189 | **1,9** | 1,9 | 35 (19%) |
| 20 – 100 km | 15 | 1,9 | 6,4 | 6 (40%) |
| trên 100 km | **0** | — | — | — |

---

## 3. Hai cái bẫy — đã xử lý, có số kèm

### Bẫy 1: chuẩn mực nước. Không so thẳng.

Thông báo hàng hải quy về **"số 0 hải đồ"**; ETOPO/GEBCO quy về **mực nước
trung bình**. Repo đã có số đo của chính khoảng lệch này trong
`public/data/tide-stations.v1.json`:

| Trạm | z0 (số 0 hải đồ dưới mực trung bình) |
|---|---|
| Quy Nhơn | 1,183 m |
| Vũng Áng | 1,274 m |
| Hòn Dấu | 1,970 m |
| Vũng Tàu | 2,887 m |

Bảng dưới quy khảo sát về **cùng chuẩn mực trung bình** (cộng z0 của trạm gần
nhất) rồi mới so. Hiệu ứng lớn và đi đúng một chiều:

| Dải | GEBCO Δ **thô** | GEBCO Δ **cùng chuẩn** | ETOPO Δ **thô** | ETOPO Δ **cùng chuẩn** |
|---|---|---|---|---|
| dưới 5 m | −0,6 | **−3,5** | +3,4 | **+1,4** |
| 5 – 10 m | −2,7 | **−5,2** | −2,0 | **−4,9** |
| 10 – 20 m | −2,3 | **−5,2** | −2,3 | **−5,2** |
| **toàn bộ** | −2,3 | **−5,2** | −2,1 | **−5,0** |

Đọc cho đúng: sau khi cùng chuẩn, **cả hai mô hình đọc NÔNG HƠN đáy thật
khoảng 5 m**. Nông hơn là chiều **an toàn** — mô hình dè dặt hơn thực tế, tuyến
đường bị chặn oan chứ không bị cho qua chỗ cạn. Nếu bỏ qua chuẩn mực nước thì
con số ra −2,3 m, tức là **tự đánh giá thấp mức dè dặt của chính mình** đi 3 m.

### Bẫy 2: ô 450 m nuốt lòng lạch. Đó là giới hạn vật lý, không phải nguồn kém.

**253/675 mẫu (37%) KHÔNG đối chiếu được** vì cả hai mô hình xếp ô đó là ĐẤT.
Tập trung đúng chỗ đã được cảnh báo: **90% số mẫu nằm trong vòng 1 km từ bờ**
rơi vào nhóm này — sông Lòng Tàu, Thị Vải, Soài Rạp, Năm Căn. Một luồng rộng
300 m không lọt nổi vào một ô 450 m.

Ở đó mô hình **không có ý kiến**, và tài liệu này **không** kết tội nguồn nào.
Quan trọng hơn: **EMODnet cũng không lấp được chỗ này** — nó rỗng ở đó y hệt.
Sông ngòi là chỗ mô hình toàn cầu không soi được, đổi nguồn toàn cầu nào cũng
vậy.

---

## 4. Ca nguy hiểm thật — đếm sau khi đã cùng chuẩn

"Nguy" = mô hình nói **sâu hơn đáy thật ≥ 5 m**, tức là đủ để `route-plan.ts`
vạch tuyến qua chỗ tàu mắc cạn.

| Luật lấy độ sâu | Ca nguy / mẫu so được | Tỷ lệ |
|---|---|---|
| Chỉ ETOPO | **12 / 602** | 2,0% |
| Chỉ GEBCO | **2 / 602** | 0,3% |
| **Lấy NÔNG HƠN giữa hai nguồn** (luật app đang chạy) | **2 / 602** | **0,3%** |

Hai ca còn lại là **cùng một toạ độ** (106,9983°Đ 10,5082°B, luồng Vũng Tàu,
`1493/TBHH-CVHHTPHCM`) ghi hai lần: khảo sát 15,2 m, mô hình nói 28–31 m. Mô
hình đọc quá sâu ở đó — nhưng 15,2 m vẫn không phải chỗ mắc cạn cho tàu cá mớn
1,5–3 m. **Không còn ca nào là ca an toàn.**

Đối chiếu ở mức **lớp** của lưới đang phát hành (`depth-grid.v1.bin`):

> Khảo sát nói **≤ 6 m** mà lưới app xếp **"đủ sâu"** (lớp 3, tuyến chạy
> thẳng qua): **0 / 119**.

Luật "hai nguồn vênh thì lấy cái nông hơn" đang làm việc thật, không phải câu
chữ trang trí: nó cắt số ca nguy từ 12 (ETOPO đơn độc) xuống 2.

---

## 5. Dải sâu hơn 20 m — không có trọng tài, nói thẳng ra

Thông báo hàng hải chỉ nói về **luồng, cửa biển, vũng cảng**. Toàn bộ 675 mẫu
khảo sát nằm trong **0–20 m**. Ba dải 20–50 m, 50–200 m, trên 200 m **không có
một điểm khảo sát nhà nước nào** để neo vào — và đó là dải bà con đánh bắt
nhiều nhất.

Ở đó đo được đúng một thứ: **hai mô hình có tự đồng ý với nhau không**. Lấy 438
ô biển từ bốn khung ngoài khơi (Nam Côn Sơn, ngoài khơi Trung Bộ, Trường Sa,
vịnh Bắc Bộ), hỏi ETOPO qua ERDDAP rồi hỏi GEBCO tại **chính những toạ độ đó**:

| Dải | n ô | \|ETOPO − GEBCO\| trung vị | p90 | max | % lệch quá 10% độ sâu |
|---|---|---|---|---|---|
| 20 – 50 m | 112 | **1,0 m** | 5,0 | 9,0 | 20% |
| 50 – 200 m | 165 | **2,0 m** | 7,0 | 57,0 | 6% |
| trên 200 m | 145 | 28,0 m | 96,0 | 277,0 | 3% |

Hai mô hình dựng độc lập mà đồng ý trong **1–2 m** ở dải 20–200 m. Ở dải trên
200 m chúng vênh mạnh (trung vị 28 m) — nhưng ở độ sâu đó, 28 m không đổi một
quyết định nào của tàu cá.

**EMODnet rỗng ở cả ba dải này.** Phép quét lưới 2° (mục 1, phép #1) đi qua
đúng những khung ngoài khơi ấy: 204 sạch.

---

## 6. Trả lời thẳng câu được giao

> **Có dải nào EMODnet hơn hẳn không?**

**Không có dải nào.** Không phải "hơn ít", không phải "hơn ở ven bờ" — mà là
**không có dữ liệu ở bất kỳ dải nào** trong vùng biển Việt Nam. Đo bằng bốn
cách độc lập, mỗi cách có đối chứng châu Âu chạy cùng, kết quả không đổi.

> **Bỏ hẳn EMODnet có hỏng phương án không?**

Không. Điều cần sửa lại là **cách mô tả** việc đang làm. "Bỏ nguồn tinh lấy
nguồn thô rồi tô cho đẹp hơn" không phải chuyện đang xảy ra ở đây — vì không
có nguồn tinh nào cả. Cái bị bỏ là **một tấm ảnh nền dựng trên GEBCO, phát từ
máy chủ châu Âu**. Cái thay vào là **một tấm ảnh nền dựng trên GEBCO/ETOPO,
phát từ chính deployment của mình**. Chất lượng dữ liệu bên dưới **giống hệt
nhau**, còn app thì bớt một phụ thuộc mạng ngoài — điều này ăn khớp với ràng
buộc offline trong `CLAUDE.md`.

### Dòng cấm "hứa độ chính xác nguồn không đảm bảo" — nó cắn ở chỗ khác

Rủi ro thật **có tồn tại**, nhưng không nằm ở chỗ tiền đề đặt. Nó nằm ở đây:

1. **Vẽ lại đẹp hơn dễ trông như chính xác hơn.** Cùng một dữ liệu GEBCO, nếu
   render mượt hơn, nhiều đường đẳng sâu hơn, màu chuyển tinh hơn — bà con sẽ
   đọc ra độ tin cậy mà con số không có. Ô vẫn 450 m dù vẽ mịn cỡ nào. **Đừng
   render mịn hơn mức 15" mà nguồn cho.**
2. **37% mẫu ven bờ không kiểm được.** Đó là lỗ thật, và nó **không** được lấp
   bằng bất kỳ mô hình toàn cầu nào (EMODnet gồm cả). Thứ lấp được nó là
   `soundings.v1.json` + `fairway-depths.v1.json` — dữ liệu nhà nước đã có
   trong repo.
3. **Dải 20–200 m chưa từng được neo vào khảo sát nào.** Bảng ở mục 5 là đồng
   thuận giữa hai mô hình, **không phải** độ chính xác. Đừng trích nó như một
   lời hứa về sai số.

---

## 7. Cỡ mẫu và chỗ không đo được

| Hạng mục | Con số |
|---|---|
| Mẫu khảo sát nhà nước dùng làm trọng tài | 675 (557 điểm rời · 105 đỉnh vùng · 13 đoạn luồng) |
| So được với mô hình | 602 |
| **Không đối chiếu được** (mô hình xếp là ĐẤT) | **253 (37%)** |
| Điểm khảo sát dò EMODnet trực tiếp | 45 — **0 trả lời** |
| Ô lưới 2° quét bbox VN | 72 — **0 trả lời** |
| Ô biển ngoài khơi so ETOPO↔GEBCO | 438 |
| **Dải độ sâu KHÔNG có trọng tài khảo sát** | **trên 20 m — toàn bộ vùng đánh bắt xa bờ** |
| **Khoảng cách bờ KHÔNG có trọng tài** | **trên 100 km — 0 mẫu** |

Chỗ **không đo được** phải nói rõ, đây là ba chỗ:

- **Sông và lòng lạch** (dưới 1 km bờ): 90% mẫu bị mô hình xếp là đất. Giới hạn
  vật lý của ô 450 m, không phải nguồn kém, và không nguồn toàn cầu nào gỡ được.
- **Ngoài 20 m nước**: không có khảo sát nhà nước công bố toạ độ để neo. Chỉ đo
  được đồng thuận, không đo được đúng-sai.
- **Chất lượng tấm ảnh nền EMODnet ở VN**: PNG màu, không giải mã ngược ra số
  được nếu không thêm dependency. Kết luận "nó là GEBCO" ở đây dựa vào **lớp
  DTM rỗng + biên khai 45°Đ**, tức là suy ra từ chỗ EMODnet **không** có gì,
  chứ không phải đọc thẳng từ tấm ảnh.

---

## 8. Kết luận

> **BỎ EMODnet là AN TOÀN.** Nó không đóng góp một con số độ sâu nào cho vùng
> biển Việt Nam, ở bất kỳ dải độ sâu hay khoảng cách bờ nào. Không có "đường
> lai" nào cần giữ, vì không có chất lượng nào để mất.

Việc phải làm không phải là giữ EMODnet, mà là **đừng để việc tự vẽ trở thành
một lời hứa mới**: giữ nguyên bước 15" của nguồn, giữ nguyên luật "hai nguồn
vênh thì lấy cái nông hơn" (đo được: cắt ca nguy từ 12 xuống 2), giữ nguyên
mặt nạ rạn, và giữ nguyên câu "không thay hải đồ" đang có trong app.

Chỗ đáng đổ công tiếp theo, nếu muốn bản đồ tốt hơn thật, là **37% mẫu ven bờ
mà mô hình toàn cầu không có ý kiến** — và thứ lấp nó là dữ liệu khảo sát nhà
nước, không phải một mô hình toàn cầu khác.

---

## Phụ lục — lặp lại phép đo

Script dò để **ngoài repo** (thư mục tạm của phiên), theo quy tắc 5 của mục
"Dữ liệu bản đồ trong git". Endpoint đã dùng:

| Nguồn | Gọi thế nào |
|---|---|
| EMODnet DTM (điểm) | `https://rest.emodnet-bathymetry.eu/depth_sample?geom=POINT(<lon>%20<lat>)` — **204 = không có dữ liệu**, không phải lỗi. Có giới hạn tần suất: gọi nối tiếp, nghỉ ~0,7 s, gặp 429 thì lùi dần |
| EMODnet DTM (lớp) | `ows.emodnet-bathymetry.eu/wms` — `GetFeatureInfo` lớp `emodnet:mean_atlas_land`, `emodnet:mean_multicolour` |
| EMODnet biên khai | `ows.emodnet-bathymetry.eu/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities` → đọc `EX_GeographicBoundingBox` |
| GEBCO | `https://api.odb.ntu.edu.tw/gebco?lon=<ds>&lat=<ds>&mode=point` — **bắt buộc `mode=point`**, thiếu là API nội suy thành trắc diện |
| ETOPO 2022 | ERDDAP PIFSC, cùng endpoint `scripts/generate-depth-grid.mjs` đang dùng |
| Khảo sát (trọng tài) | `public/data/soundings-verified.v1.json` (`muc[]` đã mang sẵn `sauM`/`gebcoM`/`etopoM`), `tide-stations.v1.json` (`z0`), `vn-coast.v1.json` (khoảng cách bờ) |

Cách gọi nguồn ngoài đúng chuẩn đã có sẵn trong `scripts/compare-sources.mjs`
(hàm `etopoLattice`, `gebcoAt`, `getJson` có trần thời gian + thử lại) — dùng
lại, đừng viết mới.

**Ngày dò**: 2026-09-01. Kết quả EMODnet là **thuộc tính của bộ dữ liệu** (biên
khai 45°Đ), không phải trạng thái nhất thời của máy chủ — không cần dò lại
định kỳ, chỉ dò lại nếu EMODnet công bố mở rộng ra ngoài châu Âu.
