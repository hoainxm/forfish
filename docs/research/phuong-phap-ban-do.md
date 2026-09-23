# Phương pháp bản đồ SDFish — hiển thị chuẩn, cache chuẩn, offline chuẩn

> Tài liệu nền cho tài sản trí tuệ của dự án. Mọi con số trong đây đều ĐO ĐƯỢC
> trên dữ liệu thật đang phát hành trong `public/data/`, bằng
> `node scripts/bench-map-method.mjs` và
> `npx vitest run src/lib/__tests__/spatial-index.test.ts --reporter=verbose`.
> Chỗ nào chưa đo được thì ghi thẳng là **chưa đo**.
>
> Ngày đo: **2026-08-29** · Node v20.20.2 · máy dev Windows (KHÔNG phải điện
> thoại yếu — cách quy đổi thận trọng ở §3, và đó là mục 1 trong danh sách
> **chưa đo** ở §8).

---

## 0. Ưu tiên — đọc trước khi đọc bất cứ con số nào

Chủ dự án chốt 2026-08-29:

> *"Mạng 4G/5G hiện nay và cấu hình máy điện thoại thì dung lượng app web không
> phải là vấn đề, 40–50 MB đều tải rất nhanh. Chủ yếu cái cơ chế hiển thị khi có
> dữ liệu, có cache, có cái offline phải làm chuẩn."*

Nên tài liệu này KHÔNG phải là tài liệu nén dữ liệu. Thứ tự:

| Ưu tiên | Nội dung | Ở đâu |
|---|---|---|
| 1 | **Cơ chế hiển thị khi có dữ liệu** — độ rõ theo zoom, luật ẩn/hiện, đọc dưới nắng | §1, §2 |
| 2 | **Cache chuẩn** — cất gì, cất đâu, sống bao lâu, di trú, máy đầy thì bỏ gì | §4 |
| 3 | **Offline chuẩn** — ma trận trạng thái đầy đủ, mỗi ô màn hình nói gì | §5 |
| 4 | **Hệ truy xuất thông minh** — trả lời câu hỏi của người đi biển, chạy offline | §3 |
| tham khảo | Nén, lượng tử hoá, mã hoá thưa | §6 |

Ngân sách dung lượng: **~40–50 MB** (trước là 17 MB). Khi hai phương án đối đầu
nhau, phương án nào **hiển thị chuẩn hơn** thì thắng, kể cả khi nó nặng hơn vài MB.

---

## 1. Phát hiện chính: cái chặn độ nét KHÔNG phải mạng

Đây là kết quả quan trọng nhất của cả đợt đo, và nó đảo ngược giả định trong
brief ban đầu ("nhẹ hơn mà vẫn thấy rõ").

**Đo được** (`bench-map-method.mjs` phần 7 — 88.630 đỉnh của lớp hải đồ đang
phát hành, đo ở vĩ 14°B):

| Mức | Một pixel là | Sai số giản lược | Sai số lượng tử | Mắt thấy gì |
|---|---|---|---|---|
| z9 | 296,7 m/px | 0,11 px | 0,02 px | nét |
| z11 | 74,2 m/px | 0,44 px | 0,07 px | nét |
| z12 | 37,1 m/px | **0,87 px** | 0,15 px | vừa đủ |
| z13 | 18,5 m/px | **1,75 px** | 0,29 px | **thấy răng cưa** |
| z14 | 9,3 m/px | **3,50 px** | 0,58 px | **thấy răng cưa** |
| z15 | 4,6 m/px | 6,99 px | 1,17 px | thấy răng cưa |
| z16 | 2,3 m/px | 13,98 px | 2,33 px | thấy răng cưa |

Nguồn hai cột sai số: dung sai Douglas–Peucker lúc sinh file là `0,0003°` = **32 m**
(`scripts/generate-reef-shapes.mjs`, `SIMPLIFY_TOL`); lưới toạ độ `1e-4°` = **±5,4 m**
(`ROUND = 4`). Cả hai đều **đo lại từ chính file JSON**, không tin hằng số trong
script: 93% số đỉnh nằm đúng lưới `1e-4°`, nhiều nhất 5 chữ số thập phân.

Và (phần 1) **từ z11 trở đi, 100% số đỉnh sống sót** khi giản lược ở dung sai
0,5 px. Nghĩa là:

> **Giản lược theo zoom không còn cứu được gì ở z12+, vì không còn đỉnh nào để
> giữ thêm. Trần độ nét nằm ở khâu SINH FILE, không nằm ở đường truyền.**

Mà z13–z15 đúng là dải zoom bà con dùng lúc **vào luồng, áp bãi cạn, né đá** —
lúc cần nét nhất thì bản đồ răng cưa nhất.

**Việc phải làm** (Lead): sinh lại `reef-shapes.v1.json` ở `SIMPLIFY_TOL = 0,0001°`
(~11 m) và `ROUND = 5` (~0,5 m). Bảng đánh đổi đã đo sẵn trong đầu
`generate-reef-shapes.mjs`: 42.119 đỉnh, **992 KB thô / 198 KB qua sóng**. Trong
ngân sách 40–50 MB thì đó là tiền lẻ; đổi lại sai số ở z14 tụt từ 3,50 px xuống
1,17 px. Muốn nét tới z16 thì phải giữ hình học gốc OSM (chưa đo — cần chạy lại
Overpass, xem §8).

Isobath thì trần nằm ở chỗ khác: bước lưới nguồn ETOPO 15″ ≈ 450 m. Dày hơn
`isobaths.v1.json` hiện tại được, nhưng không dày hơn nguồn được — mọi thứ dưới
450 m là nội suy, và **nội suy độ sâu rồi vẽ như thật là hứa thứ nguồn không có**.

---

## 2. Cơ chế hiển thị — bốn thước đo độ rõ

Nhẹ mà mờ thì vô nghĩa; nhưng "rõ" mà không đo được thì cũng chỉ là ý kiến. Đề
xuất chốt **bốn thước đo** thành tiêu chuẩn nghiệm thu, cả bốn đều tự động hoá được:

### (a) Sai số hình học tối đa, tính bằng PIXEL — ngưỡng ≤ 0,5 px

Không tính bằng mét, không tính bằng độ. Lý do:

- **Bằng độ là sai kiểu** — một độ kinh tuyến ở vĩ 22° chỉ dài bằng 0,93 lần ở
  vĩ 5°, nên một dung sai theo độ méo theo vĩ độ. Pipeline hiện tại đang dùng độ.
- **Bằng mét là không trả lời được câu hỏi** — 32 m là nhiều hay ít? Không biết,
  cho tới khi hỏi "ở zoom nào".
- **Bằng pixel thì vừa đẳng hướng** (Mercator bảo giác) **vừa là đơn vị mắt
  người thật sự đọc.** Dưới nửa pixel thì màn hình không có chỗ để vẽ ra sự khác
  biệt — đó là định nghĩa vật lý của "đủ nét", không phải một con số thẩm mỹ.

Cách làm: **giản lược trong không gian pixel của chính mức zoom đích**, không
phải trong không gian độ. Douglas–Peucker CHẶN sai số (điểm bị bỏ không bao giờ
lệch quá dung sai) nên đây là một **bảo đảm chứng minh được**, không phải lời hứa.
Đo thực tế trên toàn bộ dữ liệu (phần 1 + 6): lệch lớn nhất đo được đúng bằng
0,49–0,50 px ở mọi mức — trần được tôn trọng.

### (b) Số đối tượng bị rơi — ngưỡng = 0 với lớp hiểm hoạ

Hình nhỏ hơn nửa pixel thì **rút về CHẤM, không được biến mất**. Đây là án lệ
thật của repo: bản radial-distance trước 2026-08-29 làm ~1.400/2.612 vòng rạn nhỏ
ven bờ biến mất khỏi hải đồ. Mất một vật cản khỏi hải đồ là lỗ hổng an toàn, không
phải chuyện đẹp/xấu. Đo được ở phần 1: **0 hình mất** ở mọi mức z5–z14.

### (c) Mật độ nét ở ô đông nhất — ngưỡng ≤ 15% mực phủ

Hai thước đo trên vẫn có thể đạt trong khi màn hình là một búi chỉ. Đo mật độ
đỉnh trên ô 256×256 và ước lượng phần trăm pixel bị nét phủ:

| Mức | Ô có nội dung | Đỉnh/ô (giữa) | p95 | Ô đông nhất | ≈ mực phủ |
|---|---|---|---|---|---|
| z5 | 5 | 2.207 | 7.296 | 7.296 | **24,5%** |
| z7 | 40 | 529 | 3.779 | 3.817 | 12,8% |
| z9 | 460 | 67 | 402 | 1.546 | 5,2% |
| z11 | 4.008 | 8 | 89 | 1.815 | 6,1% |
| z12 | 9.947 | 3 | 33 | 1.048 | 3,5% |
| z14 | 37.160 | 1 | 7 | 174 | 0,6% |

z5 vượt ngưỡng — và đó chính là lý do `ocean-map.ts` đã phải đặt **nấc zoom cho
từng mức đẳng sâu** (`isobathZoomGate`). Bảng này xác nhận trực giác đó bằng số,
và cho một cách kiểm tra tự động mỗi khi thêm lớp mới.

### (d) Tương phản dưới nắng chói — ĐO ĐƯỢC, và ba chỗ đang trượt

Thước đo này thêm vào sau khi đo (`bench-map-method.mjs` phần 8, màu
đọc thẳng từ `ocean-map.ts` nên bảng không bao giờ trôi khỏi thứ đang vẽ thật).
Ngưỡng WCAG 2.1: **3:1 cho đối tượng đồ hoạ** (đường, chấm), **4,5:1 cho chữ**.
Nền nước `SEA_MASK_COLOR` = `#d5e8eb`.

| Nét | Màu khai báo | Độ mờ | Mắt thấy | Tương phản | Cần | |
|---|---|---|---|---|---|---|
| **Đường đẳng sâu** | `#3d6e96` | **0,55** | `#81a5bc` | **2,06:1** | 3,0 | ✗ |
| Số mét đẳng sâu | `#14324f` | đặc | — | 10,36:1 | 4,5 | ✓ |
| Viền hình rạn | `#0e7c86` | đặc | — | 3,90:1 | 3,0 | ✓ |
| Điểm hiểm hoạ | `#b45309` | đặc | — | 3,96:1 | 3,0 | ✓ |
| Báo hiệu CÓ đèn | `#b4267a` | đặc | — | 4,74:1 | 3,0 | ✓ |
| Báo hiệu KHÔNG đèn | `#3f6b85` | đặc | — | 4,54:1 | 3,0 | ✓ |
| Luồng / tuyến hàng hải | `#4a5a70` | đặc | — | 5,55:1 | 3,0 | ✓ |
| Nhãn tên đảo | `#0f2f4d` | đặc | — | 10,80:1 | 4,5 | ✓ |
| Nhãn tên rạn | `#0b5e66` | đặc | — | 5,90:1 | 4,5 | ✓ |
| Tuyến của tôi | `#1a73e8` | đặc | — | 3,56:1 | 3,0 | ✓ |
| Chặng cần lưu ý (đỏ) | `#d92d20` | đặc | — | 3,81:1 | 3,0 | ✓ |
| **Chặng chú ý vừa (cam)** | `#e8710a` | đặc | — | **2,44:1** | 3,0 | ✗ |
| Chặng đã đi qua (xám) | `#8a94a0` | đặc | — | 2,43:1 | 3,0 | (cố ý) |

Ba chỗ trượt, và chỉ hai trong ba là lỗi:

1. **Đường đẳng sâu 2,06:1 — lỗi, và không phải lỗi chọn màu.** Bản thân
   `#3d6e96` đạt **4,58:1**. Thủ phạm là `line-opacity: 0.55` trong
   `buildMapStyle`: pha 45% nền nước vào nét làm bay mất hơn một nửa tương phản.
   **Đây là bài học chung đáng ghi vào phương pháp: độ mờ là một quyết định thẩm
   mỹ, nhưng nó ăn thẳng vào độ đọc được, và nó làm việc đó ở chỗ không ai nhìn —
   bảng màu vẫn "đúng", chỉ có màn hình là mờ.** Mọi lớp an toàn phải đo tương
   phản SAU KHI pha độ mờ, không phải trên màu khai báo.
2. **Chặng cam "chú ý vừa" 2,44:1 — lỗi.** Đây là mức cảnh báo GIỮA trong bộ ba
   đỏ/cam/xanh, mà lại là mức khó thấy nhất. Đèn giao thông mà đèn vàng mờ nhất.
3. **Chặng đã đi qua 2,43:1 — CỐ Ý, không phải lỗi.** Nó được thiết kế để "thôi
   tranh mắt". Ghi lại ở đây để người sau đừng "sửa" nhầm — và để cho thấy bộ
   thước đo này cần một cột "cố ý mờ", nếu không nó sẽ đẻ ra việc vô ích.

Ghi chú trung thực: đây là số học sRGB thuần, **không** phải mô hình mắt dưới
nắng 100.000 lux. Nắng chói làm mọi tỉ lệ **tệ hơn** con số này, không bao giờ
tốt hơn — nên coi bảng trên là cận trên lạc quan.

### Luật ẩn/hiện theo zoom — nguyên tắc chung rút ra

Repo đã có ba ví dụ đúng (đẳng sâu theo mức sâu, báo hiệu từ z8, nhãn hiện muộn
hơn đường một nấc). Nguyên tắc chung đằng sau chúng:

1. **Gate theo VIỆC bà con làm ở mức zoom đó**, không theo con số đẹp. 5/10 m chỉ
   cần khi áp bờ vào luồng (z10); 200 m trở lên là mốc định hướng vùng (z5).
2. **Nhãn muộn hơn hình một nấc.** Thấy đường trước, đọc số sau — nếu không thì
   đúng lúc đường vừa hiện, màn hình đã đặc chữ.
3. **Ngân sách mực, không phải ngân sách đối tượng.** Ngưỡng (c) là ràng buộc
   thật; "hiện tối đa N đối tượng" là ràng buộc giả vì một đường dài tốn mực
   bằng ba mươi cái chấm.
4. **Càng nguy hiểm càng hiện sớm.** Hiểm hoạ (đá, xác tàu, bãi cạn) phải hiện ở
   zoom sớm hơn thứ chỉ để trang trí. Khi phải hy sinh vì ngưỡng (c), hy sinh
   theo thứ tự ngược: nhãn trang trí → đường đẳng sâu phụ → không bao giờ hiểm hoạ.

### Đọc dưới nắng chói, trên tàu lắc — phần chưa đo được thành số

Ba thứ này thuộc về cách vẽ chứ không thuộc về dữ liệu, và **chưa có thước đo tự
động** như (a)–(d). Ghi lại thành luật để người sau không phải nghĩ lại:

- **Viền trắng (halo) là bắt buộc cho mọi thứ phải đọc được**, không phải trang
  trí. Repo đã làm đúng với nhãn đẳng sâu (`text-halo-width: 1.4`) và với tuyến
  (`ROUTE_CASING_COLOR`). Dưới nắng chói, halo là thứ giữ cho nét không tan vào nền.
- **Tàu lắc ⇒ nét mảnh biến mất.** `line-width` 0,5 px ở z5 (giá trị hiện tại)
  là dưới ngưỡng nhìn được trên tay run. Đề xuất **sàn 1,0 px cho mọi nét mang
  thông tin an toàn**, và dùng độ mờ/màu để phân cấp thay vì dùng độ mảnh.
- **Màu mang thông tin thì phải khác nhau cả về SÁNG TỐI**, không chỉ khác tông —
  nắng chói và mắt 40–60 tuổi đều làm mất khả năng phân biệt tông gần nhau. Repo
  đã có tiền lệ đúng: magenta = báo hiệu CÓ đèn, xanh thép = KHÔNG đèn.

---

## 3. Hệ truy xuất — bản đồ biết trả lời, không chỉ biết vẽ

Cài đặt: `src/lib/spatial-index.ts` · test + đo: `src/lib/__tests__/spatial-index.test.ts`.

### Bốn câu hỏi → bốn lời gọi

| Câu bà con hỏi | Gọi gì |
|---|---|
| "Quanh tôi 5 hải lý có gì nguy hiểm?" | `queryRadius(hazards, me, 5 * 1.852)` |
| "Phao đèn gần nhất tên gì, đặc tính đèn ra sao?" | `queryNearest(seamarks, me)` → `describeSeamark()` |
| "Cảng/chỗ tránh trú gần nhất, đi mất bao lâu?" | `queryNearest(ports, me, 3)` → km ÷ tốc độ tàu |
| "Đường tôi định đi có cắt chỗ cạn dưới 4 m nào không?" | `pathPoints(route, 0.4)` → `depthClassAt()` |
| "Đường tôi định đi có sát vật cản nào không?" | `queryCorridor(hazards, route, width)` |

Lưu ý **chỗ cạn KHÔNG đi qua chỉ mục**: nó không phải danh sách điểm mà là một
trường liên tục, đã có `depth-grid.ts` tra O(1). `pathPoints` rải mẫu dọc tuyến
với bước ≤ 0,4 km (nhỏ hơn ô lưới 450 m) — bước lớn hơn là để bãi cạn lọt qua khe
giữa hai mẫu, đúng bài học `WEATHER_SAMPLE_KM` của `route-plan.ts`.

### Vì sao lưới ô, không phải R-tree hay geohash

Ba ứng viên đều giải được bài này. Chọn **lưới ô xếp kiểu CSR** vì bài toán cụ thể:

- **Dữ liệu TĨNH**, đóng gói lúc build, nạp một lần, không chèn/xoá lúc chạy.
  Ưu thế của R-tree là chèn/xoá động và dữ liệu phân bố lệch — ta không dùng tới
  cái nào. Đổi lại R-tree cần tách nút, chọn trục, ~150 dòng và một cây con trỏ
  (nặng bộ nhớ, xấu với bộ dọn rác của máy yếu).
- **Geohash** mã hoá thành chuỗi rồi tìm theo tiền tố: sinh ra việc thừa (nối
  chuỗi, so chuỗi) và một cái bẫy thật — hai điểm cạnh nhau có thể khác tiền tố ở
  mọi ký tự khi vắt qua mép ô lớn, nên vẫn phải tự tính 8 ô lân cận. Đúng việc mà
  lưới ô làm thẳng bằng số học.
- **Vùng biển VN là một khung chữ nhật nhỏ, dữ liệu rải khá đều trên biển** — ca
  lý tưởng của lưới ô.

Xếp **CSR** (hai mảng số nguyên phẳng: `start[]` + `order[]`) chứ không phải mảng
của mảng: dựng O(n), không sinh hàng nghìn mảng con cho bộ dọn rác. Toạ độ sao ra
hai `Float64Array` ngay lúc dựng nên vòng lọc **chỉ đọc số**, không chạm object
nào cho tới khi đã chắc có kết quả.

Không thêm **một dependency nào** (nguyên tắc 15 bậc 3–5). Dùng lại `haversineKm`
và `LatLon` có sẵn của `route-plan.ts` — không đẻ bản thứ ba của cùng một hàm.

### Thời gian truy vấn ĐO ĐƯỢC

Trên 5.851 báo hiệu hàng hải thật, lưới **43×35 ô** (cạnh 0,4655° tự chọn):

| Việc | Đo được | So với quét cạn |
|---|---|---|
| Dựng chỉ mục | **1,1 ms** (một lần cho cả phiên) | — |
| "Quanh tôi 5 hải lý có gì" | **0,3 µs/lượt** | 237,7 µs → **nhanh hơn 725×** |
| "Báo hiệu gần nhất" | **14,4 µs/lượt** | — |
| Soi tuyến 4 điểm, hành lang ±3 hải lý | **4,5 µs/lượt** | — |

Máy dev, không phải điện thoại yếu. Quy đổi thận trọng ×20 cho máy Android rẻ
tiền: dựng chỉ mục ~22 ms (một lần), truy vấn ~6 µs — **vẫn dưới một phần nghìn
của một khung hình 16 ms**. Nghĩa là chạy được ở tần suất mỗi lần GPS nhảy, không
cần debounce, không cần worker.

### Một lỗi thật mà cách đo này bắt được

Bản đầu tiên của `queryRadius` trả về **936** kết quả trong khi quét cạn trả về
**937** trên 2.000 lượt hỏi. Nguyên nhân: hộp lọc thô đổi bán kính km ra độ bằng
**111,32** (km/độ của ellipsoid) trong khi phép loại chính xác là `haversineKm`
đo trên **quả cầu R = 6371** (111,195 km/độ). Hộp hẹp hơn hình tròn thật khoảng
một phần nghìn — và một phần nghìn đó nuốt mất một cái phao nằm sát mép.

Ba điều rút ra, đã ghi thành chú thích tại chỗ trong mã:

1. **Hộp lọc thô phải dùng CHUNG một mô hình Trái Đất với phép đo chính xác**,
   rồi còn phải nới thêm (hệ số `BOX_SLACK` = 1,001).
2. **Độ kinh co lại khi đi về phía cực** — lấy km/độ ngay tại tâm thì hộp hẹp
   với những điểm nằm phía cực so với tâm (`minKmPerDegLon`).
3. Sai kiểu này **không bao giờ tự lộ**: danh sách vẫn dài, vẫn hợp lý, chỉ thiếu
   đúng cái xa nhất. Với lớp hiểm hoạ thì "cái xa nhất" hôm nay là "cái tàu đâm
   vào" ngày mai. **Nên mọi ca đúng-sai trong bộ test đều đối chiếu với quét cạn**,
   và có một ca quét 2.000 tâm rải khắp vùng biển VN làm lưới an toàn vĩnh viễn.

Đây là một phần của phương pháp, không phải một mẩu chuyện bên lề: **chỉ mục
không gian phải được nghiệm thu bằng quét cạn trên dữ liệu thật, ở quy mô đủ lớn
để chạm vào các ca sát mép.**

---

## 4. Cache — làm cho chuẩn

Phần này soát cơ chế đang chạy trong `public/sw.js` và chỉ ra chỗ còn hở. Cơ chế
hiện tại **đã tốt hơn mặt bằng rất nhiều** (có kho tạm lúc cài, có `putWithRoom`
bắt QuotaExceeded thật, có cắt lát Range cho PMTiles) — những chỗ hở dưới đây là
phần còn lại, không phải phán xét toàn bộ.

### 4.1 Bản đồ kho hiện tại

| Kho | Chứa gì | Trần | Dọn khi nào | Sống qua deploy? |
|---|---|---|---|---|
| `sdfish-v6` (vỏ) | HTML 6 màn, `/data/*`, font, icon | không | chỉ khi bump tên kho | không (bump = xoá) |
| `sdfish-static-v1` | JS/CSS băm tên | 400 mục, FIFO | trim + `reclaimRoom` | **có** |
| `sdfish-rsc-v1` | phản hồi `?_rsc=` | 60 mục | trim | có |
| `sdfish-api-v2` | dự báo/giá (allowlist) | 120 mục | trim + `reclaimRoom` | có |
| `sdfish-tiles-v1` | ô raster qua `/api/tiles` | 600 ô, **siết còn 120 khi máy sắp cạn** | `trimTileCache` | có |
| `sdfish-basemap-v1` | đúng một file `.pmtiles` 16,9 MB | không | chỉ khi bump | **có** |
| `sdfish-stage-v1` | kho tạm của mẻ install | — | `activate` dọn | không |

Bốn quyết định nền đã đúng và nên giữ nguyên trong mọi bản sau:

1. **Tách kho theo VÒNG ĐỜI, không theo loại nội dung.** Kho vỏ bị xoá mỗi lần
   bump; kho dữ liệu và kho nền thì không. Án lệ: trước 2026-07-26 phản hồi `/api`
   nằm chung khoá vỏ ⇒ mỗi lần deploy đổi giao diện là **xoá bản đồ cá bà con đã
   tải sẵn ở bờ**.
2. **Lớp cố định thì không dọn.** `putWithRoom` chỉ đuổi ở kho có trần; vỏ app,
   nền bản đồ, font, đường bờ, độ sâu nằm ngoài tầm với của mọi cơ chế đuổi.
   Đường dọn hợp lệ duy nhất của chúng là đổi tên kho lúc deploy.
3. **Trần theo SỐ MỤC và hạn ngạch theo BYTE là hai đại lượng khác nhau.** Một
   payload lưới 16 ngày là vài MB, nên hạn ngạch cạn từ rất lâu trước khi kho
   chạm 120 mục. Nên phải bắt `QuotaExceeded` thật rồi dọn theo byte, không phải
   trim trước rồi hy vọng.
4. **Hạn ngạch là của CẢ ORIGIN.** Dọn kho A không cứu được cú ghi vào kho B.
   `putWithRoom` đo byte giải phóng được, dọn không ăn thua thì DỪNG — không dọn
   tiếp để mất thêm bản đang dùng được mà vẫn không ghi nổi một byte.

### 4.2 Chỗ còn hở

**H1 — FIFO không phải LRU, và nó đuổi nhầm ở đúng ca xấu nhất.**
`trimCache` bỏ theo thứ tự THÊM VÀO. `precacheOne` đã vá một nửa (ghi lại asset
đã có để đưa xuống cuối hàng), nhưng nhánh `fetch` cache-first thì **không**: một
chunk khung sườn được dùng mỗi lần mở app vẫn giữ nguyên vị trí cất lần đầu, và
sẽ bị đuổi trước một chunk mới toanh chỉ dùng một lần. Chú thích trong sw.js đã
tự nhận điều này ("đừng đọc chữ 'trần' thành 'ưu tiên cái hay dùng'"). Ở trần 400
chưa cắn, nhưng đó là may chứ không phải thiết kế.
*Đề xuất:* ghi kèm dấu thời gian truy cập (một entry `__lru` nhỏ trong chính kho,
hoặc IndexedDB) và đuổi theo đó. Chi phí một lượt ghi nhỏ mỗi lần đọc — với ngân
sách mới thì rẻ.

**H2 — nền bản đồ 16,9 MB nằm nguyên trong RAM của service worker.**
`basemapBuffer()` giữ cả file để không phải dựng lại `arrayBuffer` mỗi lượt cắt
lát (một khung hình xin vài chục ô). Đúng về tốc độ, nhưng trên máy 2 GB thì đó
là một khối 16,9 MB đứng trong tiến trình SW, và iOS giết SW rất mạnh tay khi bộ
nhớ căng — giết xong thì lượt sau phải đọc lại cả file từ kho.
*Đề xuất:* cắt file thành **nhiều mảnh** trong kho (ví dụ 1 MB/mảnh, khoá
`/data/vn-basemap.pmtiles#part-N`) và chỉ giữ trong RAM những mảnh vừa dùng. Chưa
đo chi phí — xem §8.

**H3 — không có luật di trú phiên bản dữ liệu, chỉ có luật xoá.**
Mọi asset trong `public/data/` đều mang `.v1.` trong tên. Đổi sang `.v2.` thì
`CRITICAL_SHELL` trỏ tên mới, `activate` xoá kho vỏ cũ, và bà con **tải lại từ
đầu**. Với `depth-grid.v1.bin` (4,16 MB) và nền (16,9 MB) thì đó là một mẻ tải
lớn có thể rơi đúng lúc đang ở cảng sóng yếu, mà bản cũ đã bị xoá.
*Đề xuất — luật di trú:* (a) tải bản mới vào **kho tạm** trước, giống `installShell`
đã làm cho vỏ; (b) chỉ xoá bản cũ khi bản mới đã nằm đủ; (c) trong lúc chuyển
tiếp thì đọc bản cũ, và (d) màn hình nói thật "đang cập nhật hải đồ, bản đang
dùng là bản ngày X". Chưa có cái nào trong bốn cái này.

**H4 — thứ tự hy sinh mới chỉ đúng một nửa.**
Chủ dự án đã chốt thứ tự *"1- token · 2- sóng+gió+dòng chảy · 3- cá · 4- các lớp
khác"* và `trimTileCache` đã siết trần ô xuống 120 khi máy sắp cạn. Nhưng kho ô
raster không phải nơi tốn chỗ nhất nữa — nền vector 16,9 MB mới là. Và **nền
vector nằm ở lớp cố định, không ai được đuổi nó**, kể cả khi máy sắp đầy và bà
con chỉ cần dự báo.
*Đề xuất:* nền vector nên có một cửa **"bỏ nền bản đồ để lấy chỗ"** do bà con
bấm, chứ không tự động — mất nền là mất định hướng, không được lén.

**H5 — `KHO_CAN_MB = 60` là một hằng số chưa được đo.**
Nó nói "dưới 60 MB trống thì coi là sắp cạn, đủ chỗ cho ~2 gói 16 ngày". Với
ngân sách mới 40–50 MB cho riêng bản đồ, ngưỡng này gần như chắc chắn phải nâng.
Chưa đo dung lượng thật một gói 16 ngày — xem §8.

---

## 5. Offline — ma trận trạng thái đầy đủ

Nguyên tắc trên hết, rút từ hai án lệ thật của repo:

> **Không bao giờ nói một điều app KHÔNG BIẾT.** Câu "Mạng yếu" đã bị chủ dự án
> bắt trên máy thật (*"t vào internet ầm ầm mà mạng yếu gì?"*) — thứ app quan sát
> được chỉ là "ô nền không về", còn nguyên nhân thì có thể là CDN, ISP, DNS.
> Và câu "đang dùng bản đồ lưu trong máy" khi hình bờ CHƯA nạp được là nói dối
> ngay lúc bà con đang cần biết mình ở đâu (audit M6).

### Ma trận

Sáu trạng thái × mỗi ô một câu. Cột "app biết bằng cách nào" quan trọng ngang
cột "màn hình nói gì" — không có cách biết thì không được nói.

| # | Trạng thái | App biết bằng cách nào | Bản đồ vẽ gì | Màn hình nói gì |
|---|---|---|---|---|
| 1 | **Chưa tải gì** | `isShellReady()` = false, `caches` rỗng | nền nước + hình bờ nếu có | "Chưa tải xong bản đồ — nên tải trước khi rời bờ." + nút tải |
| 2 | **Tải dở** | `isShellReady()` = false nhưng một phần URL đã có | có gì vẽ nấy | "Đã tải \<n\>/\<N\> phần. Còn thiếu: hải đồ độ sâu." — **nói thiếu CÁI GÌ, không nói phần trăm suông** |
| 3 | **Tải đủ** | `isShellReady()` = true (kiểm lại **từng URL**, không tin dấu suông) | đủ lớp | chip "sẵn sàng đi biển" — và chỉ khi đó |
| 4 | **Dữ liệu cũ** | mốc thời gian cất trong chính payload | vẽ bình thường | "Hải đồ bản ngày X · dự báo tới ngày Y" — **nói TUỔI, không nói 'mới nhất'** |
| 5 | **Mất sóng** | `navigator.onLine` = false | lớp trong máy | "Mất sóng — đang dùng bản đồ lưu trong máy." (được phép nói thẳng: có bằng chứng) |
| 6 | **Sóng "sống mà chết"** | ô nền im lặng ≥ `BASEMAP_SILENT_MS` (9 s), đếm từ lúc THẬT SỰ xin ô | lớp trong máy | "Chưa tải được nền bản đồ — đang dùng hình bờ lưu trong máy." (**không** phán về mạng) |

Trạng thái 6 là ca **hay gặp nhất ngoài khơi 40–60 hải lý** và là ca duy nhất mà
`navigator.onLine` lẫn bộ đếm lỗi đều không bắt được: `fetch` treo mà không
reject, nên `.catch` không bao giờ chạy. Repo đã bịt bằng đồng hồ im lặng — và
bài học đi kèm quan trọng không kém: **đồng hồ phải bấm từ lúc thật sự xin ô, không
phải từ lúc mở màn**, vì MapLibre lazy-load ngốn gần hết 9 giây trước request đầu
tiên ⇒ bấm sớm là dương tính giả, bản đồ nhấp nháy và câu vừa nói lại sai.

### Chỗ còn hở trong ma trận

**O1 — trạng thái 2 (tải dở) hiện không có màn hình riêng.** `isShellReady()` chỉ
trả `true`/`false`; nó BIẾT thiếu URL nào (nó vừa kiểm từng cái) nhưng vứt thông
tin đó đi. Bà con nhận "chưa sẵn sàng" mà không biết thiếu gì, phải chờ bao lâu,
hay có nên chờ không.
*Đề xuất:* trả về danh sách nhóm còn thiếu (vỏ / hải đồ / độ sâu / báo hiệu) và
để màn hình nói tên việc, không nói tên file.

**O2 — trạng thái 4 (dữ liệu cũ) chưa phủ hết lớp bản đồ.** Dự báo có tuổi và có
nói tuổi. Hải đồ, đẳng sâu, rạn, báo hiệu thì **không mang mốc thời gian nào** —
bà con không có cách biết dữ liệu rạn trong máy là bản OSM tháng nào. Đáy biển
thì không đổi, nhưng **phao và luồng lạch thì đổi**, và đó đúng là thứ dùng lúc
vào bờ ban đêm.
*Đề xuất:* nhét `generatedAt` vào mỗi asset lúc sinh, hiện ở panel lớp.

**O3 — không có trạng thái "dữ liệu cũ ĐẾN MỨC NGUY HIỂM".** Ma trận trên coi
"cũ" là một trạng thái phẳng. Dự báo sóng 5 ngày tuổi khác hẳn dự báo 5 giờ tuổi.
*Đề xuất:* mỗi lớp khai một **hạn dùng** riêng, quá hạn thì đổi giọng từ "bản
ngày X" sang "bản này đã cũ, đừng dựa vào".

**O4 — chưa có ca "kho bị trình duyệt xoá ngầm".** iOS xoá dữ liệu site không
dùng trong 7 ngày nếu chưa được cấp `persistent storage`. Repo có
`storage-persist.ts` — **chưa đọc trong đợt này**, cần soát riêng xem có thật sự
xin quyền và có nói gì khi bị từ chối (xem §8).

---

## 6. Tham khảo — các hướng nén đã đo

Giữ lại đầy đủ vì đã đo thật, nhưng theo ưu tiên mới thì **không hướng nào trong
mục này được dùng để cắt chi tiết hiển thị**.

### 6.1 Giản lược theo zoom (phần 1)

Dữ liệu đang phát hành: 13.596 hình · 88.630 đỉnh · 2.253,7 KB thô · **426,3 KB gzip**,
tải nguyên khối ở mọi zoom.

| Mức | Hình | Đỉnh | So gốc | Dung sai 0,5 px | Lệch thật đo được | Hình mất |
|---|---|---|---|---|---|---|
| z5 | 3.688 | 14.161 | 16% | 2.373 m | 0,50 px | 0 |
| z7 | 5.039 | 33.730 | 38% | 593 m | 0,50 px | 0 |
| z9 | 11.846 | 57.381 | 65% | 148 m | 0,50 px | 0 |
| z11 | 13.596 | 86.774 | 98% | 37 m | 0,50 px | 0 |
| z12 | 13.596 | 88.281 | 100% | 19 m | 0,50 px | 0 |
| z14 | 13.596 | 88.627 | 100% | 5 m | 0,49 px | 0 |

Ở mức toàn cảnh z5 chỉ cần **16%** số đỉnh để đạt cùng độ nét — hôm nay bà con
tải 100% rồi vứt 84%. Đó là lý do kỹ thuật để tile hoá, nhưng theo ưu tiên mới nó
là lý do **phụ**; lý do chính là §1 (tile hoá cho phép giữ dữ liệu DÀY hơn ở
z13+ mà không phải tải cả vùng biển).

### 6.2 Byte cho một khung nhìn (phần 2)

Màn hình 390×844:

| Khung nhìn | Ô | Ô có nội dung | gzip | Nhẹ hơn khối |
|---|---|---|---|---|
| z9 · Ven bờ Nha Trang | 15 | 12 | 4,5 KB | 94× |
| z9 · Cửa Hải Phòng | 8 | 7 | 1,8 KB | 231× |
| z9 · Trường Sa | 12 | 11 | 14,8 KB | 29× |
| z12 · Ven bờ Nha Trang | 8 | 8 | 0,8 KB | 536× |
| z12 · Cửa Hải Phòng | 15 | 15 | 1,1 KB | 391× |
| z12 · Trường Sa | 12 | 11 | 3,1 KB | 137× |

### 6.3 Tách lớp theo việc (phần 3) — kết quả bất ngờ nhất

Ô "chỉ hải đồ" so với ô nền Protomaps tại **cùng z/x/y**, cùng cách nén:

| Khung nhìn (z9) | Ô | Nền Protomaps | Chỉ hải đồ | Tỉ lệ |
|---|---|---|---|---|
| Ven bờ Nha Trang | 15 | 199,3 KB | 4,5 KB | **44,1×** |
| Cửa Hải Phòng | 8 | 240,8 KB | 1,8 KB | **130,6×** |
| Trường Sa | 12 | 10,3 KB | 14,8 KB | **0,7×** |
| Cộng | 35 | 450,4 KB | 21,2 KB | 21,3× |

Hai điều đọc ra:

1. **Ven bờ, app trả 44–130 lần byte cho thứ nó vứt đi ngay lúc dựng style.**
   `buildMapStyle` lọc bỏ toàn bộ lớp `symbol` và `boundaries` của Protomaps —
   nhà cửa, đường phố, ranh giới, tên đất — nhưng byte thì đã tải rồi.
2. **Ngoài khơi, Protomaps gần như RỖNG (10,3 KB cho 12 ô) trong khi lớp hải đồ
   của ta là 14,8 KB.** Tức là ở Trường Sa, ở Hoàng Sa, ở ngư trường xa bờ —
   đúng nơi bà con làm ăn — **toàn bộ bản đồ là dữ liệu của chính dự án này**.
   Nền quốc tế không đóng góp gì. Đây là lập luận mạnh nhất cho việc coi lớp hải
   đồ là tài sản riêng (§7).

*(Cảnh báo trung thực: byte ô hải đồ đo bằng mã hoá varint-delta không bọc
protobuf, nên lạc quan vài chục byte/ô; ngược lại vòng kín bị cắt thành đường mở
nên bi quan vài phần trăm. Hai sai lệch ngược chiều, cả hai đều nhỏ so với tỉ lệ
hàng chục lần đang đo.)*

### 6.4 Lượng tử hoá toạ độ (phần 4)

| Cách | Sai số | px@z9 | px@z12 | px@z14 |
|---|---|---|---|---|
| JSON 3 số lẻ | 54,0 m | 0,182 | 1,456 | 5,825 |
| **JSON 4 số lẻ (đang dùng)** | **5,4 m** | 0,018 | 0,146 | 0,583 |
| JSON 5 số lẻ | 0,5 m | 0,002 | 0,015 | 0,058 |
| Nguyên trong ô, extent 4096 | theo zoom | 0,031 | 0,031 | 0,031 |

Byte thật, cùng nội dung, khung Nha Trang z12:

| Cách ghi | Thô | gzip |
|---|---|---|
| GeoJSON 4 số lẻ | 6,1 KB | 0,8 KB |
| GeoJSON 3 số lẻ | 6,0 KB | 0,7 KB |
| Nguyên trong ô + varint-delta | **0,6 KB** | 0,8 KB |

**Kết quả ngược trực giác và nó quan trọng: sau khi gzip, ba cách gần như bằng
nhau.** Gzip ăn hết phần chữ thừa của JSON. Chênh lệch thật nằm ở **byte thô** —
thứ máy phải `JSON.parse` và giữ trong RAM sau khi giải nén (**9,8× ít hơn**),
không phải thứ chạy qua sóng. Theo ưu tiên mới, lượng tử hoá **không còn là đòn bẩy
tiết kiệm mạng**; nó chỉ còn đáng làm vì lý do khác: thời gian phân tích cú pháp
trên máy yếu và RAM thường trú.

### 6.5 Mã hoá lưới độ sâu (phần 5)

4441×3841 = 17.057.881 ô · đất 33,56% · rất cạn 0,28% · nông 1,19% · **đủ sâu 64,97%**.

| Cách mã hoá | Đĩa | gzip | brotli | RAM | Tra 1 điểm |
|---|---|---|---|---|---|
| **Đặc 2 bit/ô (đang dùng)** | 4.164,5 KB | 118,9 KB | 103,7 KB | 4.164,5 KB | **2–4 ns** |
| RLE varint | 197,5 KB | 92,9 KB | 92,5 KB | 4.164,5 KB | ✗ cần bung |
| **Khối-thưa 32×32** | **458,4 KB** | **79,7 KB** | **75,1 KB** | **458,4 KB** | **7–8 ns** |

*(Cột "tra 1 điểm" dao động ±2 ns giữa các lần chạy — cả hai cách đều nằm trong
nhiễu đo; điều duy nhất bảng này chứng minh là **không cách nào chậm đến mức
đáng quan tâm**.)*

| Khối-thưa 64×64 | 760,2 KB | 83,6 KB | 78,0 KB | 760,2 KB | 12 ns |
| Khối-thưa 128×128 | 1.341,1 KB | 90,1 KB | 82,1 KB | 1.341,1 KB | 14 ns |
| Cây tứ phân (8192²) | 337,0 KB | 81,2 KB | 85,7 KB | 337,0 KB | ✗ cần bảng nhảy |

Khối 32×32: **15.051/16.819 khối đồng nhất (89%)** — chỉ 1.768 khối phải chở dữ liệu.

Đọc bảng cho đúng:

- **Qua sóng bốn cách chênh nhau ít** (75–119 KB): gzip tự tìm ra đúng cái mà
  RLE/khối-thưa mã hoá tay. Khối-thưa nhẹ hơn 39 KB — theo ưu tiên mới, **39 KB
  không phải lý do để đổi định dạng đang chạy tốt**.
- **Chênh lệch thật ở RAM và ở khả năng dùng TỪNG PHẦN:** đặc 2 bit phải nằm
  nguyên 4,16 MB trong bộ nhớ suốt phiên; khối-thưa 32×32 chỉ 458 KB (**9,1× ít
  hơn**) mà vẫn tra O(1). **Đây mới là lý do đáng cân nhắc**, và nó thuộc nhóm
  "cơ chế hiển thị chuẩn trên máy yếu", không thuộc nhóm tiết kiệm mạng.
- **RLE và cây tứ phân LOẠI** vì mất tra ngẫu nhiên O(1). Với "tuyến này có cắt
  chỗ cạn nào không" thì mỗi tuyến là hàng nghìn lượt tra — "cần bung" nghĩa là
  quay về đúng 4,16 MB RAM, không được gì.

*(Chú ý: brief ghi 111 KB gzip cho file này, ở đây đo được 118,9 KB — chênh do
mức nén gzip. Số trong bảng dùng mức mặc định, giống server thật.)*

---

## 7. Cái gì bán licence được, cái gì là kỹ thuật phổ thông

Phân định thẳng thắn, vì tài liệu này là nền cho việc bán licence.

### Kỹ thuật phổ thông — KHÔNG bán được, đừng đưa vào hợp đồng

- Douglas–Peucker, Liang–Barsky, marching squares, haversine, CSR, varint/zigzag,
  RLE, cây tứ phân, lưới ô, R-tree, geohash. Sách giáo khoa, hàng chục thư viện.
- Web Mercator, MVT, PMTiles, Cache API, service worker. Chuẩn công khai.
- Bản thân dữ liệu: OSM (ODbL), ETOPO (public domain), Natural Earth, Protomaps.
  **Dữ liệu không phải của ta và không được bán như của ta.**

### Tài sản riêng — bán licence được

1. **Bộ tiêu chuẩn "độ rõ đo được cho hải đồ trên điện thoại"** (§2): bốn thước
   đo — ≤ 0,5 px sai số hình học / 0 đối tượng mất / ≤ 15% mực phủ / tương phản
   ≥ 3:1 **tính SAU KHI pha độ mờ** — kèm quy trình đo tự động trên dữ liệu thật
   và trên chính hằng số màu của mã nguồn. Không có ở đâu khác dưới dạng nghiệm thu được. Đây là thứ biến "bản
   đồ đẹp" từ ý kiến thành hợp đồng.
2. **Quy tắc giản lược trong không gian pixel của mức zoom đích**, thay cho dung
   sai theo độ dùng chung — cộng với **bảng trần độ nét theo zoom** (§1) cho phép
   nói chính xác "dữ liệu này nét tới zoom mấy". Thuật toán là phổ thông; **cách
   đặt bài toán và bộ ngưỡng thì không**.
3. **Luật ẩn/hiện theo VIỆC của người đi biển** (§2): mức nông đòi zoom gần, nhãn
   muộn hơn hình một nấc, ngân sách mực, càng nguy hiểm càng hiện sớm. Đây là tri
   thức miền — rút từ việc quan sát ngư dân, không suy ra được từ tài liệu kỹ thuật.
4. **Kiến trúc cache phân tầng theo VÒNG ĐỜI** (§4.1) với bốn bất biến: tách kho
   theo vòng đời, lớp cố định không bị đuổi, trần-số-mục ≠ hạn-ngạch-byte, hạn
   ngạch là của cả origin. Kèm danh mục án lệ hỏng thật đã bịt. **Đây là phần khó
   sao chép nhất** — nó là kết quả của việc hỏng thật nhiều lần.
5. **Ma trận trạng thái offline sáu ô + luật "không nói điều app không biết"**
   (§5). Kèm cơ chế phát hiện sóng "sống mà chết" và bài học đồng hồ-bấm-từ-lúc-nào.
6. **Tầng truy xuất theo câu hỏi của người đi biển** (§3) — bốn câu hỏi, ánh xạ
   sang bốn nguyên hàm, cộng nghiệm thu bằng quét cạn. Lưới ô là phổ thông; **tập
   câu hỏi, ngưỡng bước lấy mẫu 0,4 km ràng với ô lưới độ sâu, và quy trình
   nghiệm thu** thì không.
7. **Toàn bộ lớp nội dung hải đồ tiếng Việt**: nhãn chủ quyền, tên rạn/đảo tiếng
   Việt, cổng chặn CJK, bảng dịch đặc tính đèn sang câu bà con đọc được. Đây là
   thứ *duy nhất* trong danh sách mà đối thủ không thể mua bằng tiền — và §6.3
   cho thấy ngoài khơi thì nó **là toàn bộ bản đồ**.

Ranh giới cần nói rõ với khách mua licence: **phần mềm và phương pháp không vướng
giấy phép của nguồn dữ liệu, nhưng bên mua vẫn phải tự lo giấy phép dữ liệu của
họ** (ODbL của OSM đòi ghi công và share-alike cho CSDL phái sinh).

---

## 8. Chưa đo được — nói thẳng

Danh sách này là một phần của tính trung thực của tài liệu; đừng xoá nó khi thấy dài.

| # | Chưa đo | Vì sao | Đo bằng cách nào |
|---|---|---|---|
| 1 | Thời gian trên **điện thoại yếu thật** | chỉ có máy dev | chạy bench trong WebView trên máy Android tầm thấp |
| 2 | Độ nét nếu giữ **hình học gốc OSM** (không giản lược) | cần chạy lại Overpass, và `public/data/**` không thuộc quyền sửa của đợt này | chạy `generate-reef-shapes.mjs` với `SIMPLIFY_TOL = 0` |
| 3 | Chi phí **cắt nền PMTiles thành mảnh** (hở H2) | chưa dựng thử | dựng thử, đo thời gian dựng ô và RAM đỉnh của SW |
| 4 | Dung lượng thật **một gói dự báo 16 ngày** (hở H5) | cần chạy app thật có tài khoản premium | đọc `estimate()` trước/sau một lượt pretrip |
| 5 | Hành vi **`storage-persist.ts`** khi bị từ chối quyền (hở O4) | chưa soát file đó trong đợt này | soát riêng + thử trên iOS Safari |
| 6 | Byte thật của **MVT có protobuf** so với mã hoá trần | không dựng bộ mã hoá protobuf | dùng `@mapbox/vector-tile` khi có nhu cầu thật |
| 7 | Ngưỡng **15% mực phủ** và ngưỡng **3:1** đã đúng chưa với mắt 40–60 tuổi dưới nắng thật | là đề xuất, chưa thử người dùng | cho 5 chủ tàu xem 3 mức mật độ + 3 mức tương phản trên boong, giữa trưa |

---

## 9. Việc Lead phải làm tiếp

Xếp theo giá trị trên công sức, cao trước.

1. **Sinh lại `reef-shapes.v1.json` ở `SIMPLIFY_TOL = 0,0001°`, `ROUND = 5`** —
   một dòng đổi hằng số, +200 KB qua sóng, sai số ở z14 tụt 3× (§1). Đây là việc
   rẻ nhất và ăn thẳng vào ưu tiên #1. ⚠️ Đụng `public/data/**` và `CRITICAL_SHELL`
   ⇒ chạy bộ QA offline bắt buộc.
2. **Sửa hai chỗ tương phản trượt ngưỡng** (§2d): nâng `line-opacity` của đường
   đẳng sâu từ 0,55 lên ≥ 0,85 (hoặc bỏ hẳn độ mờ và phân cấp bằng độ dày), và
   đổi cam `#e8710a` sang một sắc cam ĐẬM hơn đạt ≥ 3:1 trên `#d5e8eb`. Cả hai
   là đổi hằng số, và cả hai đang làm mờ đúng lớp an toàn. ⚠️ Đụng `ocean-map.ts`
   ⇒ cập nhật `03-design-system.md` cùng commit.
3. **Thêm `generatedAt` vào mọi asset `public/data/`** và hiện tuổi ở panel lớp
   (hở O2). Nhỏ, nhưng nó bịt một chỗ app đang im lặng về tuổi dữ liệu an toàn.
4. **Trả về danh sách nhóm còn thiếu từ `isShellReady()`** thay cho boolean
   (hở O1) — thông tin đã có sẵn trong hàm, chỉ là đang bị vứt đi.
5. **Nối `spatial-index.ts` vào màn `/ngu-truong`**: chạm bản đồ → "quanh đây có
   gì", và soi tuyến trong `route-planner`. Cơ chế đã xong và đã đo; phần còn lại
   là giao diện + copy tiếng Việt. ⚠️ Cross-trục (đụng bản đồ) ⇒ hỏi trước.
6. **Đổi `trimCache` từ FIFO sang LRU thật** (hở H1) — chưa cắn ở trần 400 nhưng
   đang sống nhờ may.
7. **Viết luật di trú phiên bản dữ liệu** (hở H3): kho tạm → kiểm đủ → đổi → xoá
   bản cũ, và nói thật trong lúc chuyển tiếp.
8. **Quyết định về khối-thưa 32×32 cho lưới độ sâu** (§6.5): 9,1× ít RAM hơn, đổi
   lấy một định dạng mới phải viết bộ giải mã + test. Đáng làm nếu và chỉ nếu đo
   được RAM là vấn đề thật trên máy yếu (chưa đo, mục 1 của §8).
9. **Tile hoá lớp hải đồ** (§6.1–6.3). Việc lớn nhất, giá trị thật nằm ở chỗ nó
   cho phép giữ dữ liệu DÀY hơn ở z13+ chứ không phải ở chỗ tiết kiệm byte. Đừng
   làm trước việc #1 — sinh lại dữ liệu dày hơn là điều kiện cần của nó.

---

## Phụ lục — chạy lại mọi con số

```bash
node scripts/bench-map-method.mjs            # cả 8 phần
node scripts/bench-map-method.mjs 1 6 7 8    # chỉ phần về độ rõ

npx vitest run src/lib/__tests__/spatial-index.test.ts --reporter=verbose
```

Tệp liên quan: `scripts/bench-map-method.mjs` · `src/lib/spatial-index.ts` ·
`src/lib/__tests__/spatial-index.test.ts` · `src/lib/ocean-map.ts` (luật hiển thị
đang chạy) · `public/sw.js` (cache) · `src/lib/offline-basemap.ts` (offline) ·
`src/lib/depth-grid.ts` · `scripts/generate-reef-shapes.mjs` (dung sai sinh file).
