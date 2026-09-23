# Phản biện thứ tự ưu tiên — hàng đợi độ sâu / hải đồ (2026-09-01)

> **Câu hỏi duy nhất của tài liệu này**: trong sáu việc đang xếp hàng, làm cái nào
> trước thì **một ngư dân thật, ra khơi chuyến tới**, được thêm nhiều nhất?
> Không bàn *cách* vẽ vùng độ sâu — phần đó teammate khác giữ
> (`docs/research/phan-bien-vung-do-sau-2026-09.md`).
>
> Mọi con số dưới đây **đo lại từ dữ liệu trong repo**, không lấy lại của Lead.
> Lệnh kiểm ở phụ lục cuối bài.

---

## 0. Kết luận trước, lý lẽ sau

**Lead chọn sai thứ tự.** "Tô vùng độ sâu" nên là việc **thứ ba**, không phải thứ nhất.

| Hạng | Việc | Lead xếp |
|---|---|---|
| **1** | **Nói thật về số đo sâu** — mỗi con số trên bản đồ phải khai tuổi; chặn lô đã biết là hỏng. Gồm cả việc 6 (đăng ký `tbhh`) vì đó là điều kiện kỹ thuật của nó | 4 và 6 |
| **2** | **OCR — nhưng chỉ 337 bản scan miền Bắc**, không phải cả 985 | 2 |
| **3** | **Tô vùng độ sâu** — và kèm ba ràng buộc bắt buộc (§3) | **1** |
| — | **BỎ HẲN: khử trùng dữ liệu cảng vụ** | 5 |
| — | **ĐÃ XONG RỒI: nối bộ ký hiệu hải đồ** — hàng đợi đang liệt kê một việc đã làm | 3 |

Lý do một câu: **việc 1 của Lead vẽ lại đẹp hơn thứ bà con đã nhìn thấy; việc 4
của Lead là chỗ app đang nói một điều nó không biết.** Nguyên tắc 4 của
`CLAUDE.md` xếp "không hứa quá nguồn" vào nhóm **KHÔNG ĐƯỢC CẮT, dù thang bảo
gì**. Cái đang bị cắt hiện nằm ở việc 4, không nằm ở việc 1.

---

## 1. Kiểm số của Lead — cái nào đúng, cái nào sai

| Lead nói | Đo lại được | Phán |
|---|---|---|
| 557 điểm đo sâu | 379 (`soundings`) + 178 (`cangvu`) = 557 **cộng thô** | ⚠️ **Thổi 51%.** Khử trùng ở bán kính 15 m còn **369 điểm duy nhất**. 557 là đếm hai lần cùng một mũi khoan |
| Gọn trong 12 ô 0,25° | **Đúng 12 ô.** `cangvu` không thêm ô nào — hợp lại vẫn 12 | ✅ |
| Vĩ độ 8,7–11,9°B | 8,657–11,879 | ✅ |
| Phủ ~10% chiều dài bờ | **Tuỳ thước đo, và Lead chọn thước dễ nhất.** Bờ nằm trong 10 km của một số đo = **301 km**. Trên 3.260 km bờ chính thức = 9,2% ✅. Trên hình bờ **app đang dùng** (`vn-coast.v1.json`, 17.064 km đường bờ chi tiết tới từng rạch) = **1,8%**. Trong bán kính 3 km — tầm nhìn thật của một con tàu — chỉ **123 km = 0,7%** | ⚠️ Đúng số, **sai thước**. Con số bà con sống với là 0,7–1,8%, không phải 10% |
| 43,6% cả kho là PDF ảnh scan | 985 bản scan. Trên **cả kho** (64 trúng + 2.495 bỏ sót = 2.559) = **38,5%**. Con số 43,6% chỉ ra khi bỏ 298 bản "không đọc được số hiệu" khỏi mẫu số: 985/2.261 = 43,6% | ⚠️ **Đúng phép tính, sai nhãn.** Không phải "cả kho". Nói cho gọn: **985 bản, ~39% số ca hỏng** |
| "Từ Quy Nhơn ra Bắc trắng hoàn toàn" | **Sai hai lần.** (a) Số đo *điểm* dừng ở **11,88°B — Nha Trang**, không phải Quy Nhơn (13,77°B): vùng trắng bắt đầu sớm hơn ~200 km. (b) Miền Bắc **không trắng**: `fairway-depths.v1.json` có **13 đoạn khống chế từ 15,2°B đến 20,9°B** — Sa Kỳ, Thuận An, Cửa Việt, Cửa Gianh, Lệ Môn, Hải Thịnh, Diêm Điền, Sông Chanh, Phà Rừng — và **đã được vẽ** (`DEPTH_LINE_LAYER`), **đã nằm trong `SHELL` của service worker** | ❌ **Sai.** Kể cả fairway, phủ bờ tăng gấp đôi: 709 km trong bán kính 10 km |
| 149/379 (39%) mang ngày suy từ URL | **149 điểm, 39,3%** — hai thông báo: `237/TBHH` (132 điểm, `…/uploads/2019/01/01-TBHH.pdf` → ép ngày 01) và `57/TBHH` (17 điểm, `…/2019/05/…` → ép ngày 01) | ✅ **Đúng chính xác** |
| Script tự hứa ghi cờ `ngayUocLuong` mà chưa từng ghi (0) | `ngayUocLuong` xuất hiện **1 lần trong toàn repo**: dòng chú thích 79 của `scripts/fetch-soundings.mjs`. **0 lần** trong cả ba tệp dữ liệu | ✅ **Đúng** |
| 173/178 điểm cảng vụ trùng kho chính | **174 trùng khít 4 chữ số thập phân, 175/178 trùng trong 15 m = 98,3%** | ✅ (Lead còn nói nhẹ đi) |
| 19 cặp trùng trong chính nó | **23 cặp** trong 15 m | ⚠️ Lệch nhẹ, không đổi kết luận |
| File cảng vụ chưa lớp nào đọc | Đúng — `src/` không có một lời gọi `fetch` nào tới `soundings-cangvu.v1.json`; chỉ `__tests__` mở nó | ✅ |

**Tóm lại**: hai con số chống đỡ cả lập luận của Lead — "43,6% scan" và "phủ 10%
bờ" — **một cái sai nhãn, một cái đúng số nhưng chọn thước có lợi**. Và mệnh đề
mạnh nhất, "ra Bắc trắng hoàn toàn", **sai**.

---

## 2. Ba điều Lead bỏ sót — và chúng đảo ngược thứ tự

### 2.1. Con số trên bản đồ **không mang ngày nào cả**

Đây là phát hiện quan trọng nhất, và nó làm việc 4 **to hơn** Lead mô tả, đồng
thời **không phải việc Lead mô tả**.

`fishing-map-view.tsx:1960` dựng feature cho từng chấm đo sâu với đúng ba thuộc tính:

    properties: { i, d: s.depthM, nhan: fmtDepthM(s.depthM) }

Không `ngay`. Không `so`. Không nguồn. `SOUNDING_DOT_LAYER` cũng **không nằm
trong `hitLayers`** (`fishing-map-view.tsx:2350`) — chấm đo sâu **không chạm
được**, không có popup, không có đường nào để hỏi "số này đo hồi nào".

Nhãn công tắc nói: *"Thông báo hàng hải — đỏ là dưới 4 m. Tham khảo, không thay
hải đồ chính thức."* Trung thực về **thẩm quyền**, câm hoàn toàn về **tuổi**.

Trong khi tuổi thì như thế này:

| | |
|---|---|
| Tuổi trung vị | **0,3 năm** |
| Tuổi phân vị 75 | **7,7 năm** |
| Số điểm quá 3 năm | **149 / 379 = 39,3%** |

Phân bố **hai cục**: 61% đo cách đây 2–4 tháng, 39% đo tháng 1/2019 — **vẽ giống
hệt nhau, cùng cỡ chấm, cùng bảng màu, cạnh nhau trên cùng một màn hình.**

Và chúng nằm đúng chỗ chết người:

| Dải màu | 149 điểm cũ 7,7 năm |
|---|---|
| Đỏ (< 4 m) | 1 |
| **Cam (4–12 m)** | **147** |
| Lam (≥ 12 m) | 1 |

**147/149 điểm cũ rơi trúng dải 4–12 m** — đúng dải mà chính `depth-grid.ts` chú
thích là "tàu cá VN mớn 1,5–3 m chạy vùng 5–8 m hằng ngày". Không phải nước sâu
nơi sai vài mét chả sao. Là **dải ra quyết định**. Một luồng cửa sông bồi lắng
liên tục, số đo tháng 1/2019, in ra màn hình năm 2026 không kèm một chữ nào về
tuổi.

Chính tệp dữ liệu tự viết nhãn: *"Độ sâu tham khảo — **đo tại ngày ghi kèm**"*.
**Không có ngày nào được ghi kèm.** App đang phá nhãn của chính nó.

### 2.2. Repo **đã biết** một lô số đo bị hỏng, và vẫn vẽ nó

`public/data/soundings-verified.v1.json` — đối chiếu 675 mục với ETOPO 2022 và
GEBCO 15″ — kết luận sẵn nằm trong tệp:

    "so":"57/TBHH-TCTBĐATHHMN", "soNguyen":16, "tong":17,
    "lyDo":"16/17 số đo của thông báo này là mét chẵn (94%) — máy hồi âm ghi tới
            0,1 m và mọi thông báo khác trong bộ nằm ở 0–20%.
            Chữ số lẻ rơi mất lúc bóc PDF."

17 điểm đó, độ sâu đọc ra: `7, 3, 14, 4, 7, 8, 8, 8, 8, 7, 8, 8, 8, 7.6, 6, 7, 7`.
Một con "4" mất chữ số lẻ có thể là 3,5. Vị trí: 10,58–10,63°B / 106,82–106,84°Đ
— **luồng Soài Rạp / Lòng Tàu vào TP.HCM**, dày tàu.

Và 17 điểm đó **cũng chính là lô ngày giả 2019-05-01**. Vừa sai ngày vừa nghi sai
số. Vẫn đang được vẽ, không dấu hiệu gì.

Rộng hơn, kết quả đối chiếu chưa lớp nào dùng:

| Kết quả | Số mục |
|---|---|
| khớp | 378 |
| giải thích được | 27 |
| **nghi lỗi** | **17** |
| không đối chiếu được | 253 |

`soundings-verified.v1.json` **không được `src/` fetch** — y hệt căn bệnh mà
`src/lib/__tests__/depth-layer.test.ts` vừa dựng cổng để chặn hồi 2026-08-31:
*"dữ liệu có, test có, mà bà con không nhìn thấy gì."* Bệnh cũ, tệp mới.

### 2.3. Việc 3 (bộ ký hiệu hải đồ) **đã xong rồi**

Hàng đợi đang liệt kê một việc đã hoàn thành:

- `public/icons/chart-sprite.json` · `.png` · `@2x` — **4 tệp có trên đĩa**
- `src/lib/chart-symbols.ts:49` → `CHART_SPRITE_URL = "/icons/chart-sprite"`
- `src/lib/ocean-map.ts:743` → `sprite: CHART_SPRITE_URL`, kèm chú thích ghi rõ
  ngày **2026-09-01** và cảnh báo "thiếu dòng này thì mọi `icon-image` im lặng
  không vẽ"
- `src/lib/__tests__/chart-symbols.test.ts` khoá đường dẫn

Mô tả trong hàng đợi — *"ba lớp báo hiệu đang là chấm tròn tô màu"* — **không còn
đúng**. Đây là dấu hiệu hàng đợi được viết mà không soi lại `src/`; đáng ngờ cả
những mục khác trong cùng danh sách.

---

## 3. Xếp hạng, kèm lý lẽ

### 🥇 #1 — Nói thật về số đo sâu (Lead xếp 4 và 6)

**Gộp thành một mạch việc, một commit**, vì việc 6 là điều kiện kỹ thuật của việc 4.

**Ba phần:**

1. **Đăng ký `tbhh` và `vinamarine` vào `provenance.ts`** (Lead gọi là việc 6 —
   nhưng nó **không phải chuyện dọn nhà, nó là một cú ném đang nằm chờ**):
   `SOURCES` chỉ có `osm · aca · wcmc · gebco · etopo · nga-msi · sdfish`. Cả ba
   tệp độ sâu ghi `prov.origin.source: "tbhh"` / `"vinamarine"`. Gọi
   `isCleanLicense()` hay `confidenceOf()` trên chúng thì `SOURCES["tbhh"]` là
   `undefined`, rồi `LICENSES[undefined.license]` → **TypeError ném ra**, không
   phải `false` trả về. Hôm nay chưa nổ vì `src/` chưa gọi đường đó — nhưng nó là
   thứ chặn phần 2 và 3 dưới đây. Vài chục dòng, có `LICENSES` sẵn để móc vào.
2. **Mỗi số đo sâu khai tuổi.** Thêm `ngay` (và `so`) vào `properties` của
   feature; đưa `sounding-dot` vào `hitLayers`; popup dùng lại đúng khuôn
   `markInfo` đã có sẵn cho phao đèn. Không thêm dependency, không thêm request
   mạng, không đụng service worker — nguyên liệu **đã nằm trong `SoundingsBundle`**
   (`soundings.ts:323` có `ngay: string`), chỉ là chưa ai chuyển nó qua.
   Đúng bậc 2 của nguyên tắc 1: repo đã có sẵn helper và pattern.
3. **Chặn hoặc gắn cờ lô `57/TBHH`** và hạ vai trò 149 điểm ngày ép. Ngưỡng đã
   tính sẵn trong `soundings-verified.v1.json`; chỉ cần đọc `kq: "nghi-loi"`.

**Vì sao đứng nhất:** lớp này **đang chạy trên máy bà con ngay lúc này**
(`depthsOn` mặc định `true`, hiện từ z11 — tức là bật đúng lúc bà con phóng to
vào cửa lạch nhà mình). Đây không phải việc thêm tính năng, đây là **vá chỗ app
đang nói quá điều nó biết**, ở đúng dải nước ra quyết định. `CLAUDE.md` §KHÔNG
ĐƯỢC: *"Hứa độ chính xác dữ liệu mà nguồn không đảm bảo"*. Đang vi phạm, có bằng
chứng đo được.

**Chỉnh lại cách Lead đặt vấn đề:** Lead gọi việc này là *"vá cờ ngày ước lượng"*.
**Vá riêng cái cờ đó thì bà con không thấy khác một điểm ảnh nào** — cờ nằm trong
JSON, không có đường nào ra tới màn hình. Việc thật là **đưa ngày ra màn hình**;
cái cờ chỉ là một dòng trong đó.

---

### 🥈 #2 — OCR, nhưng **337 bản scan miền Bắc**, không phải 985 (Lead xếp 2)

Ước lượng có căn cứ, suy từ chính tỉ lệ trúng của bộ đã bóc được:

| Bước | Số |
|---|---|
| Bản ghi có lớp chữ đọc được | ≈ 1.214 |
| Trong đó ra được điểm | 64 → **tỉ lệ trúng 5,3%** |
| Điểm trên mỗi thông báo trúng | **5,9** |
| **Dự phóng OCR cả 985 bản scan** | ≈ 52 thông báo × 5,9 ≈ **308 điểm** |

Phân bố 985 bản scan theo tỉnh:

| Vùng | Bản scan | Dự phóng điểm |
|---|---|---|
| **Bắc** (Quảng Ninh → Hà Tĩnh; riêng Hải Phòng 185) | **337 (34%)** | **≈ 105** |
| Trung (Quảng Bình → Khánh Hoà) | 110 (11%) | ≈ 34 |
| **Nam — nơi đã có 369 điểm rồi** | 180 (18%) | ≈ 56 **(gần như vô ích)** |
| Chưa phân loại được | 358 | — |

**Cái Lead nói đúng:** OCR **thật sự** mở vùng trắng. 337 bản scan miền Bắc là
nguồn duy nhất trong hàng đợi tạo ra **thông tin chưa từng có trên máy**.
Việc 1, 3, 5, 6 không tạo ra một mét vuông biển mới nào.

**Cái Lead nói quá:** OCR cả 985 bản thì **~56 điểm rơi vào miền Nam vốn đã dày**,
và ~180 bản là công OCR đổ vào chỗ đã có. Chạy đúng 337 bản miền Bắc lấy được
~2/3 giá trị với ~1/3 công.

**Cảnh báo phải tính trước — miền Bắc viết kiểu khác.** `fairway-depth.ts:603` đã
ghi: *"miền Bắc viết theo ĐOẠN GIỮA HAI PHAO"*, không theo bảng toạ độ điểm rời.
Bộ bóc fairway đã quét cả kho và **chỉ ra 13 đoạn từ 10 thông báo**, 277 bản trượt
vì *"không có mục theo khuôn 'đoạn từ … đến … độ sâu đạt'"*. Nghĩa là: OCR xong
vẫn cần **một bộ bóc thứ hai theo văn phong Bắc**, và con số 105 điểm ở trên
**có thể ra dạng đoạn chứ không dạng điểm**. Đó là lý do việc này đứng nhì chứ
không đứng nhất: nó là việc có giá trị cao nhất **và** rủi ro ước lượng cao nhất.

---

### 🥉 #3 — Tô vùng độ sâu (Lead xếp **1**)

Đây là chỗ tôi cãi thẳng.

**Nó không cho bà con biết thêm điều gì. Nó vẽ lại thứ đã vẽ.**

- Lưới `depth-grid.v1.bin` (4,26 MB, 15″ ≈ 450 m) **đã tải về máy mọi người**,
  nằm trong `CRITICAL_SHELL` của service worker.
- Nó **đã đang được dùng**: `route-plan.ts` chặn tuyến qua ô cạn, `route-planner.tsx`
  và `fishing-map-view.tsx` cảnh báo nước cạn tại điểm chạm.
- Và cùng nền độ sâu đó **đã được vẽ thành đường**: `isobaths.v1.json` (1,33 MB,
  bước 1/48°, **chín mức**) đang chạy qua `isobath-lines` + `isobath-labels`.

Tô vùng = chuyển **chín đường đẳng sâu đã hiện** thành **chín mảng màu**. Đó là
lựa chọn trình bày, không phải thông tin mới. Nguyên tắc 1 bậc 1 hỏi *"việc này
có cần tồn tại không"* — với ba việc còn lại trong hàng đợi đang mang thông tin
thật, câu trả lời là "cần, nhưng sau".

**Và có một cái bẫy phải chốt trước khi tô.** Lấy 557 mục trong
`soundings-verified.v1.json` — nơi lưới đối mặt số khảo sát thật — dựng ma trận
lớp-thật (theo khảo sát) so với lớp-lưới-sẽ-tô:

| Khảo sát nói | Lưới nói **đất liền** | ...rất cạn | ...nước nông | ...đủ sâu |
|---|---|---|---|---|
| < 4 m | 9 | — | 8 | 0 |
| 4–12 m | **147** | 2 | 157 | 4 |
| ≥ 12 m | **39** | — | 46 | 145 |

**195/557 = 35% số chỗ đã khảo sát thật, lưới gọi là ĐẤT LIỀN.** Đó là luồng
tàu, là vũng quay, là cửa lạch — ô 450 m nuốt trọn một con luồng rộng 100 m. Tô
vùng theo lưới này nghĩa là **bờ biển nuốt mất một phần ba số cửa lạch**, đúng
chỗ bà con ra vào ban đêm.

Sai số mô hình so với khảo sát:

| | trung vị | p75 | p90 | max |
|---|---|---|---|---|
| \|ETOPO − khảo sát\| | 3,3 m | 10,0 m | **15,3 m** | 20,4 m |
| \|GEBCO − khảo sát\| | 2,4 m | 9,0 m | **12,8 m** | 16,9 m |

Sai số ngang bằng chính độ sâu chỗ nước cạn. *(Mẫu này lệch về luồng và vũng cảng
— ngoài khơi lưới tốt hơn nhiều. Nhưng đó chính là điểm: **lưới đúng ở chỗ không
quan trọng và sai ở chỗ quan trọng.**)*

**Nên khi làm việc này (ở hạng 3), ba ràng buộc bắt buộc — không phải gợi ý:**

1. **Cấm** dùng lớp 3 ("đủ sâu") làm màu **trấn an** trong phạm vi ~10 km bờ.
   Vắng dữ liệu phải nhìn ra là **vắng**, không được nhìn ra là **an toàn**.
2. Vùng tô **không được đè** chấm/nhãn số đo sâu và đường luồng khống chế — số
   khảo sát thật luôn thắng mô hình.
3. Ranh "đất liền" của vùng tô lấy từ `vn-coast.v1.json`, **không** lấy từ lớp 0
   của lưới — nếu không thì 195 chỗ kia hoá thành bờ.

**Điểm công bằng cho Lead:** lập luận thương mại có thật — bà con bỏ 5 triệu mua
tablet cài Navionics bẻ khoá, và mảng màu là thứ đập vào mắt đầu tiên. Nhưng
khoảng cách với Navionics **không nằm ở mảng màu**; nó nằm ở **dữ liệu khảo sát
dày** (việc #2) và **ký hiệu hải đồ** (đã xong). Tô một mô hình 450 m cho giống
Navionics là mượn **vẻ ngoài** của độ tin cậy mà không có **ruột**. Với một app
đi biển, đó là hướng sai để vay.

---

## 4. Việc nên BỎ HẲN

### ❌ Việc 5 — Khử trùng dữ liệu cảng vụ. Đừng khử. Đừng phát nữa.

| Đo được | |
|---|---|
| Điểm trùng kho chính (15 m) | **175 / 178 = 98,3%** |
| Ô 0,25° mới thêm được | **0** |
| Cặp tự trùng bên trong | 23 |
| Lớp `src/` đọc nó | **0** |
| Có trong `SHELL` service worker | **Không** |
| Kích thước phát cho mọi lượt tải | 73,7 KB |

Khử trùng xong được **3 điểm mới**, **không mở thêm một ô lưới nào**. Nguyên tắc
1 bậc 1 — *"việc này có cần tồn tại không"* — trả lời dứt khoát: **không**.

Nhưng đừng xoá vội, tệp **có một vai thật**: nó là **đầu vào lúc build** của
`soundings-verified.v1.json` (`tep: ["soundings.v1.json", "soundings-cangvu.v1.json",
"fairway-depths.v1.json"]`). Nên việc đúng là:

> **Chuyển nó ra khỏi `public/`** (thành đầu vào build, không phải asset phát đi),
> hoặc gộp 3 điểm duy nhất vào `soundings.v1.json` rồi bỏ tệp.
> **Không viết bộ khử trùng.**

Đúng tinh thần §"Dữ liệu bản đồ trong git — chống phình" quy tắc 5: dữ liệu không
ai đọc thì đừng để trong cây phát hành.

### ❌ Việc 3 — Nối bộ ký hiệu hải đồ. **Đã xong** (§2.3).

Xoá khỏi hàng đợi. Nếu còn phần dở thì mô tả lại cho đúng phần dở đó — mô tả hiện
tại ("ba lớp báo hiệu đang là chấm tròn tô màu") đã sai so với `src/`.

---

## 5. Giá phải trả nếu để #1 chậm thêm một tháng

Không phải "nợ kỹ thuật dồn lại". Là bốn thứ cụ thể:

1. **Thêm một tháng app khẳng định điều nó không biết.** Lớp bật mặc định, hiện
   từ z11 — tức là bật đúng lúc bà con phóng to vào cửa lạch nhà mình. **147
   điểm đo tháng 1/2019 nằm trong dải 4–12 m** vẽ y hệt điểm đo tháng 6/2026.
   Luồng cửa sông Việt Nam bồi lắng liên tục — chính bộ dữ liệu này cho thấy cùng
   một luồng được khảo sát lại nhiều lần mỗi năm. Số đo 7,7 năm ở cửa sông không
   phải "hơi cũ"; nó là **một con luồng khác**.
2. **17 điểm đã biết là hỏng vẫn nằm trên luồng Soài Rạp / Lòng Tàu.** Repo tự
   kết luận chữ số lẻ rơi mất. Một con "4" có thể là 3,5. Mỗi tuần trôi qua là
   bảy ngày cái kết luận đó nằm trong tệp mà không tới được người cần.
3. **Câu chống đỡ duy nhất đang mỏng.** Nếu có tàu chạm cạn và con số đến từ app,
   thứ duy nhất SDFish có là dòng phụ đề *"Tham khảo, không thay hải đồ chính
   thức"* — **không nói một chữ nào về tuổi**, trong khi tệp dữ liệu tự hứa "đo
   tại ngày ghi kèm". Nói được "số này đo ngày 30/6/2026" hay "số này từ 2019, đã
   7 năm" là khác hẳn về chất, không chỉ về giao diện.
4. **Nó chặn việc #2.** OCR 337 bản scan miền Bắc sẽ đổ vào thêm hàng trăm điểm
   với tuổi trải rộng hơn nữa, nhiều bản từ Wayback — tức là **thêm ngày ép từ
   URL**. Đưa cột tuổi vào **trước** thì mẻ OCR chảy vào một cái khuôn đã biết
   nói thật. Làm sau thì phải quay lại sửa toàn bộ khi số điểm đã gấp đôi.

Ngược lại, **để việc "tô vùng" chậm một tháng thì mất gì?** Bà con vẫn có chín
mức đường đẳng sâu, vẫn có cảnh báo cạn khi vạch tuyến, vẫn có chấm đo sâu và
đường luồng khống chế. Mất **thẩm mỹ và một phần sức thuyết phục trước Navionics**
— thật, nhưng không ai vì thế mà chạm đá.

---

## Phụ lục — lệnh kiểm lại

Mọi con số trong bài dựng từ tệp trong repo, không gọi mạng.

```bash
# 1) đếm điểm, ô 0,25°, trùng lặp
node --input-type=module -e '
import fs from "node:fs";
const f = p => JSON.parse(fs.readFileSync(p, "utf8"));
const m = f("public/data/soundings.v1.json"), c = f("public/data/soundings-cangvu.v1.json");
const R = 6371e3, r = x => x * Math.PI / 180;
const d = (a, b) => R * Math.hypot(r(b[0]-a[0]) * Math.cos(r((a[1]+b[1])/2)), r(b[1]-a[1]));
const all = [...m.diem, ...c.diem], u = [];
for (const p of all) if (!u.some(q => d(p, q) < 15)) u.push(p);
console.log("thô", all.length, "→ duy nhất", u.length);
console.log("cangvu trùng main:", c.diem.filter(p => m.diem.some(q => d(p, q) < 15)).length, "/", c.diem.length);
console.log("ô 0,25°:", new Set(all.map(p => Math.floor(p[0]/.25) + "," + Math.floor(p[1]/.25))).size);'

# 2) tuổi số đo + dải màu của lô 2019
node --input-type=module -e '
import fs from "node:fs";
const m = JSON.parse(fs.readFileSync("public/data/soundings.v1.json", "utf8"));
const old = m.diem.filter(p => m.thongBao[p[3]] && m.thongBao[p[3]].ngay.startsWith("2019"));
console.log("điểm 2019:", old.length, "/", m.diem.length);
console.log("trong dải 4–12 m:", old.filter(p => p[2]/10 >= 4 && p[2]/10 < 12).length);'

# 3) lưới gọi ĐẤT LIỀN ở bao nhiêu chỗ đã khảo sát thật
node --input-type=module -e '
import fs from "node:fs";
const v = JSON.parse(fs.readFileSync("public/data/soundings-verified.v1.json", "utf8"));
const M = v.muc.filter(x => typeof x.sauM === "number" && typeof x.lop === "number");
console.log("lưới gọi là đất liền:", M.filter(x => x.lop === 0).length, "/", M.length);
console.log("tomTat:", JSON.stringify(v.tomTat));'

# 4) lý do bỏ sót — nguồn của con số "985 scan" và mẫu số thật
node --input-type=module -e '
import fs from "node:fs";
const m = JSON.parse(fs.readFileSync("public/data/soundings.v1.json", "utf8"));
const c = {}; m.boSot.forEach(b => c[b.lyDo] = (c[b.lyDo] || 0) + 1);
console.log(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5));
console.log("mẫu số cả kho =", m.thongBao.length + m.boSot.length);'

# 5) việc 3 đã xong chưa
ls public/icons/chart-sprite*
grep -n "sprite:" src/lib/ocean-map.ts

# 6) lớp nào đọc soundings-cangvu (kỳ vọng: rỗng)
grep -rn "soundings-cangvu" src/ --include=*.ts --include=*.tsx | grep -v __tests__

# 7) chấm đo sâu có mang ngày không (kỳ vọng: chỉ i, d, nhan)
sed -n '1956,1967p' src/components/fishing-map-view.tsx
```

---

## Assumptions

- **Tuổi tính tới 2026-09-01.** Đổi ngày thì trung vị/phân vị đổi theo, kết luận
  "hai cục 0,3 năm / 7,7 năm" không đổi.
- **Bán kính khử trùng 15 m.** Chọn theo `SPOT_GRID_DEG` (~11 m) của
  `keepNewestPerSpot` trong `fetch-soundings.mjs`, nới nhẹ cho sai lệch làm tròn.
  Ở 50 m thì số điểm duy nhất còn thấp hơn nữa — kết luận mạnh thêm, không yếu đi.
- **Tỉ lệ trúng OCR 5,3% và 5,9 điểm/thông báo** suy từ nhóm có lớp chữ. Bản scan
  có thể **khác** nhóm đó theo cả hai chiều: thông báo cũ hơn (ít bảng toạ độ hơn)
  nhưng cũng thường là loại "thông số kỹ thuật luồng" (nhiều điểm hơn). Đây là
  ước lượng bậc độ lớn — dùng để **so hạng giữa các việc**, không dùng để cam kết
  con số giao nộp.
- **Phân vùng Bắc/Trung/Nam** đọc từ slug tỉnh trong URL vmsa; 358/985 bản scan
  không khớp khuôn slug nên để "chưa phân loại". Nếu nhóm đó phân bố như nhóm đã
  biết thì phần miền Bắc còn tăng, tức là kết luận "OCR miền Bắc trước" mạnh thêm.
- **Mẫu 557 mục đối chiếu lệch về luồng và vũng cảng** — không phải mẫu ngẫu
  nhiên của biển Việt Nam. Con số "35% lưới gọi là đất liền" **chỉ áp cho vùng ven
  bờ và cửa luồng**, và đó đúng là vùng mà việc tô vùng độ sâu phải chịu trách
  nhiệm.
- **Bờ biển**: `vn-coast.v1.json` gộp 526 đường (đất liền + đảo), tổng 35.840 km;
  đường dài nhất 17.064 km là bờ đất liền vẽ chi tiết tới từng rạch trong đồng
  bằng, nên **không so trực tiếp** với "3.260 km" chính thức. Bài này nêu **cả
  hai thước** thay vì chọn một.
- **Không đụng `src/`, `public/`, `scripts/`, `docs/app-map/`** trong mạch việc
  này — đây là tài liệu phản biện, mọi đề xuất sửa code để lại cho commit thực thi.
