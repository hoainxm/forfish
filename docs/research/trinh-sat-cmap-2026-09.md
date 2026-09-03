# Trinh sát Navionics/C-MAP — 2026-09-02

> **Vai trò phiên này**: TRINH SÁT — chỉ thu manh mối + số đếm chuẩn, KHÔNG
> ghi gì vào dữ liệu phát hành. Quy trình đầy đủ (manh mối → xác minh độc
> lập → dữ liệu của mình) ở
> [phuong-an-tu-chu-du-lieu.md §1](../formaps/phuong-an-tu-chu-du-lieu.md).
> Manh mối thô (nếu có) nằm NGOÀI repo, không trong file này.

## 0. Tóm tắt một đoạn

**Navionics ChartViewer (webapp.navionics.com) đã bị Garmin khai tử tháng
7/2024** — mọi URL cũ redirect thẳng về `maps.garmin.com`, một trang chọn
chartplotter/rao bán hải đồ US–Canada, không còn xem được vùng biển Việt
Nam. **C-MAP vẫn còn một web viewer miễn phí thật, không cần tài khoản**
tại `appchart.c-map.com` — vào được, tìm toạ độ được, pin vị trí lộ vài
thuộc tính (nhiệt độ/gió/độ sâu điểm) — nhưng lớp hải đồ chính là **ảnh
raster WMTS đã dựng sẵn** (`tiles.c-map.com/wmts/cmt_int1/webmercator/{z}/{x}/{y}.png`,
maxzoom 17), không phải vector có thuộc tính truy vấn được qua API công
khai. Việc **đếm từng loại đối tượng (phao/đèn/xác tàu/số đo sâu) theo
yêu cầu KHÔNG thực hiện được trong phiên này** vì môi trường trình duyệt
của agent không hiển thị khung hình (screenshot timeout — "Browser pane is
not displayed") và tải ảnh tile để đếm bằng mắt bị **chính hệ thống quyền
hạn của phiên chặn** (downloading file cần xin phép người dùng trực tiếp,
phiên này không có kênh hỏi). Phát hiện giá trị nhất không phải số đếm, mà
là **trang Copyright Acknowledgement của C-MAP tự công bố công khai**:
với khu vực "China", C-MAP ghi rõ *"Chart data distributed by C-MAP is
based on China NGD official charts information"* — và **không có mục
Việt Nam nào** trong toàn bộ danh sách cơ quan thuỷ đạc được cấp phép.

## 1. Navionics — khai tử, không còn gì để dò

- `https://webapp.navionics.com/#@10.35,107.05,13z` → redirect ngay lập
  tức tới `https://maps.garmin.com` (xác nhận qua `navigate` + đọc
  `window.location.href` sau khi tải).
- `https://maps.garmin.com/en-US/marine/?maps=garmin&overlay=false` mở ra
  **không phải bản đồ hải đồ**, mà là trang "What chartplotter is on your
  boat?" — chọn hãng máy dò cá rồi dẫn sang trang bán sản phẩm US
  South / US & Coastal Canada. Gõ toạ độ Việt Nam (`10.35, 107.05`) hoặc
  tên "Vung Tau, Vietnam" vào ô tìm kiếm không trả kết quả liên quan —
  app chỉ định vị được sản phẩm hải đồ Bắc Mỹ.
- `https://www.navionics.com` (domain gốc) → lỗi Cloudflare DNS, rồi
  redirect về `garmin.com` kèm thử thách "Just a moment..." (bot-check).
  Domain coi như đã bị gộp/khai tử.
- WebSearch xác nhận: nhiều diễn đàn thuyền viên (Hull Truth, Trawler
  Forum, YBW, Bayliner Owners Club, Sailing Anarchy) đồng loạt báo Navionics
  Chart Viewer bị "decommissioned" khi Garmin tiếp quản, khoảng tháng
  7/2024, thay bằng Garmin Boating App (di động, không phải web).

**Kết luận Navionics**: không còn cổng nào để dò cho vùng biển Việt Nam.
Không cần đánh dấu "chặn sau trả phí" vì không có sản phẩm để chặn — nó
biến mất hoàn toàn khỏi web.

## 2. C-MAP — `appchart.c-map.com`, viewer thật, không cần tài khoản

### 2.1 Vào được gì free

- URL: `https://appchart.c-map.com/` — có "LOG IN" ở góc nhưng **xem bản
  đồ, tìm toạ độ, pin vị trí đều không cần đăng nhập**. Chặn thật duy
  nhất là cookie consent (OneTrust) — bấm "Reject Optional Cookies" là
  vào được ngay.
- Chức năng "SEARCH BY COORDINATES" (định dạng DMS / DECIMALS / DDM) đưa
  thẳng tới toạ độ, tạo pin. Route ứng dụng:
  `/core/select/new_place/@{lng},{lat}` — có thể điều hướng trực tiếp
  bằng URL này, không cần thao tác UI.
- Pin lộ ra một bảng thuộc tính nhỏ (đọc được qua text, không cần ảnh):
  tên "Pinned location", toạ độ, nút SAVE / ROUTE TO / "Add missing place
  to cruising guide" (đóng góp POI công khai — một cổng crowdsource khác
  cần lưu ý), và một khối **thời tiết + độ sâu**:
  - Vũng Tàu (10.350000°N, 107.050000°E): 29 °C, mưa 0.0 mm, gió
    14.58 kts, **Depth 0 m**.
  - Định An (9.470000°N, 106.500000°E): 29 °C, mưa 0.0 mm, gió
    16.13 kts, **Depth 0 m**.
  - Cả hai đều ra đúng 0 m — hai điểm tham chiếu nằm sát/trên bờ nên số
    này nhiều khả năng là điểm ảnh bãi bồi/đất liền của mô hình độ sâu
    nền, KHÔNG phải một sounding thật. Chưa thử điểm giữa luồng để có số
    khác 0 (xem §4 việc còn treo).
- "Full weather forecast" là link riêng, chưa mở để xem có khoá gì không.
- Trang **Copyright Acknowledgement** (`c-map.com/legal/copyright-acknowledgement/`,
  cập nhật 29/4/2026) công bố công khai toàn bộ danh sách cơ quan thuỷ đạc
  cấp phép cho C-MAP, theo quốc gia (Australia, Belgium, Canada, China, UK
  + các nước custodianship của UKHO, Đan Mạch, EMODnet, Phần Lan, Pháp,
  GEBCO, Đức, Hy Lạp, Hồng Kông, Ireland, Ý, Nhật, New Zealand, Hà Lan,
  Na Uy-PRIMAR, Thuỵ Điển, Tây Ban Nha, Nam Phi, rồi OpenStreetMap/Imagery/
  Weather). **Hai dòng đáng chú ý cho SDFish**:
  - `China — Chart data distributed by C-MAP is based on China NGD
    official charts information.` Đây là **cờ chủ quyền thật**: NGD là cơ
    quan thuỷ đạc nhà nước Trung Quốc; hải đồ "China" của C-MAP nhiều khả
    năng phủ tới các vùng nước tranh chấp/EEZ Việt Nam theo cách vẽ của
    Trung Quốc. Không dùng bất kỳ gì từ vùng phủ này làm nguồn, kể cả gián
    tiếp.
  - **Không có mục "Vietnam"** trong toàn bộ danh sách (đã đọc hết trang,
    quét chữ "Vietnam" không ra). Nghĩa là C-MAP **không có giấy phép trực
    tiếp từ một cơ quan thuỷ đạc Việt Nam** — vùng biển VN trên C-MAP nhiều
    khả năng ghép từ GEBCO (đáy biển toàn cầu) + OpenStreetMap (địa danh/
    ranh giới) + ảnh vệ tinh (Sentinel-2/UP42), đúng như báo cáo
    [phuong-phap-nha-san-xuat-2026-09.md](phuong-phap-nha-san-xuat-2026-09.md)
    đã suy luận — nay có xác nhận bằng văn bản công khai của chính C-MAP.

### 2.2 Kiến trúc kỹ thuật (soi mạng, không tải hàng loạt)

- App là React SPA (webpack, nhiều chunk `screens-*.js`), state quản lý
  bằng Redux. Vẽ bản đồ bằng **Mapbox GL JS** (canvas `mapboxgl-canvas`,
  `Mapbox logo` credit ở góc).
- Style JSON công khai tại `https://appchart.c-map.com/mapAssets/style_index.json`
  (một file cấu hình nhỏ, không phải dữ liệu hải đồ) khai rõ:
  ```json
  "sources": { "raster-tiles": {
    "type": "raster",
    "tiles": ["https://tiles.c-map.com/wmts/cmt_int1/webmercator/{z}/{x}/{y}.png"],
    "tileSize": 256 } },
  "sprite": "https://maps.navico.com/cmt/resources/sprites/v19/int1",
  "glyphs": "https://maps.navico.com/cmt/resources/glyphs/v1/{fontstack}/{range}.pbf",
  "layers": [{ "id": "raster-tiles", "type": "raster", "minzoom": 0, "maxzoom": 17 }]
  ```
  → **Toàn bộ hải đồ là MỘT lớp raster WMTS chuẩn z/x/y**, không có lớp
  vector nào để `queryRenderedFeatures` ra thuộc tính rời (đã thử — layer
  count = 1, type "raster"). Nghĩa là phao/đèn/xác tàu/số đo sâu/đường
  đẳng sâu đều đã được **vẽ chết vào ảnh PNG** ở phía server, không lộ ra
  API JSON nào cho client. Đây là khác biệt lớn với OSM/OpenSeaMap (vector,
  tự vẽ style) — C-MAP giống cách Navionics ChartViewer cũ từng làm.
  Ngoài lớp raster này, các `static/*.png` (icon UI, ~150 file thấy trong
  network log) KHÔNG phải tile hải đồ, chỉ là sprite/icon giao diện.
- Bấm "+/–" trên bản đồ đổi zoom thật (đã kiểm chứng: bấm 3 lần → zoom
  10→13→16, bấm ngược lại về 13). Trình tự dựng khung chuẩn **z13 tại
  10.35°N 107.05°E** và **z13 tại 9.47°N 106.5°E** đã dựng xong trong
  phiên (camera Redux xác nhận `center/zoom` đúng), nhưng KHÔNG chụp được
  ảnh khung hình để đếm ký hiệu (xem §3).

### 2.3 C-MAP Embark / embark.c-map.com

- `https://embark.c-map.com/` → lỗi Cloudflare "Origin DNS error" — domain
  không phục vụ nữa; viewer thật nằm ở `appchart.c-map.com` (có thể
  `embark` là tên sản phẩm cũ, đã đổi hạ tầng sang `appchart`).

## 3. Việc KHÔNG làm được trong phiên này — vì sao

Yêu cầu gốc là **đếm từng loại đối tượng theo khung nhìn ở z13** (số đo
sâu rời, phao/tiêu, đèn, xác tàu WK, chướng ngại, đẳng sâu) cho hai khung
Vũng Tàu và Định An. Việc này đòi hỏi **nhìn thấy ảnh bản đồ đã dựng** —
nhưng:

1. Công cụ `computer` (screenshot) trong phiên này báo lỗi cố định:
   *"Screenshot timed out... the Browser pane is not displayed, so the
   page is not compositing frames"* — môi trường chạy agent không có
   khung hình trực quan để chụp.
2. Vì lớp hải đồ là **raster** (không phải vector, xem §2.2), cách duy
   nhất để đếm là **nhìn ảnh** — không có API JSON nào trả về danh sách
   đối tượng trong khung nhìn để đếm bằng code.
3. Đường vòng khả dĩ — tải trực tiếp 1–2 tile PNG (`tiles.c-map.com/wmts/
   cmt_int1/webmercator/13/6531/3859.png` cho Vũng Tàu, `13/6519/3879.png`
   cho Định An, tính bằng công thức slippy-map chuẩn) rồi dùng công cụ đọc
   ảnh để đếm bằng mắt — đã thử và **bị chính bộ lọc quyền hạn của phiên
   chặn** ("Permission for this action was denied by the Claude Code auto
   mode classifier" khi gọi `curl`/`WebFetch` tới domain này), vì tải file
   từ nguồn ngoài cần xin phép người dùng trực tiếp trong chat và phiên
   trinh sát này không có kênh hỏi/chờ đó.

**Kết luận**: bảng đếm hai khung theo lớp (yêu cầu ở đầu bài, để thay thước
đo `npm run kiem:phu` hiện đang dùng số đếm từ ảnh Facebook) **chưa dựng
được**. Cần một phiên có (a) trình duyệt hiển thị được khung hình để chụp
ảnh trực tiếp, hoặc (b) người dùng xác nhận rõ trong chat cho phép tải 2
tile PNG (mỗi tile ~256×256, vài chục KB, KHÔNG phải bulk) để đếm bằng
mắt một lần rồi xoá.

## 4. Việc còn treo — đề xuất bước tiếp theo

1. **Chạy lại bước đếm ở một phiên có hiển thị màn hình thật** (không phải
   agent nền) — chỉ cần 2 lệnh: mở `appchart.c-map.com`, tìm toạ độ, bấm
   "+/-" tới scale ~500 m (tương đương z13), chụp ảnh, đếm bằng mắt theo
   đúng phương pháp đã dựng sẵn trong phiên này (route URL, tọa độ, cách
   zoom — xem §2.2).
2. **Thử pin ở một điểm giữa luồng thật** (không phải sát bờ) để xem
   "Depth" có trả số khác 0 không — nếu có, đó là một manh mối số đo sâu
   đọc được qua text, không cần ảnh; nếu vẫn ra 0/không hiển thị, kết luận
   trường "Depth" này là artefact của raster nền, không phải sounding thật
   — nên bỏ qua kênh này.
3. **Đối chiếu vùng phủ "China NGD"** với ranh giới các khung C-MAP dùng
   cho khu vực Biển Đông — nếu xác nhận được ranh giới đó chạm vào EEZ/
   thềm lục địa Việt Nam, đây là bằng chứng đủ mạnh để **loại hẳn C-MAP**
   khỏi danh sách nguồn tham khảo cho vùng biển tranh chấp, không chỉ dùng
   làm manh mối.

## 5. Trả lời các mục báo cáo được yêu cầu

- **Vào được gì free**: C-MAP `appchart.c-map.com` — xem bản đồ, tìm toạ
  độ, pin vị trí, đọc thời tiết + độ sâu điểm, không cần tài khoản.
  Navionics: không còn gì để vào (đã khai tử).
- **Bảng đếm hai khung theo lớp**: **chưa dựng được** — lý do kỹ thuật ở
  §3 (raster + không chụp được ảnh + tải tile bị chặn quyền hạn).
- **Số manh mối thu được, phân loại**: 2 điểm độ sâu (cả hai = 0 m, độ tin
  cậy thấp — khả năng là artefact bờ biển, không phải sounding); 0 đối
  tượng phao/đèn/xác tàu cụ thể có toạ độ (không đếm/click được từng ký
  hiệu vì không thấy ảnh). File thô: xem `manh-moi.json` ngoài repo.
- **Viewer lộ thuộc tính tới mức nào**: chỉ lộ qua bảng thông tin pin
  (tên, toạ độ, thời tiết, độ sâu điểm) khi click/pin một vị trí — không
  thử được việc click trúng một ký hiệu phao/đèn cụ thể vì không thấy màn
  hình để nhắm.
- **Cái gì bị chặn sau trả phí**: không phát hiện gì rõ ràng bị khoá premium
  trong lúc dò (không đăng nhập vẫn tìm toạ độ + pin + đọc thời tiết/độ sâu
  bình thường); "LOG IN" tồn tại nhưng không thử — dừng đúng ranh không tạo
  tài khoản theo luật an toàn phiên.
- **Đề xuất MỘT câu ưu tiên xác minh**: dòng chữ *"China NGD official
  charts information"* trong trang Copyright Acknowledgement của C-MAP nên
  được xác minh trước tiên — nếu vùng phủ đó lấn vào EEZ Việt Nam, nó tự
  động loại C-MAP khỏi mọi vai trò tham khảo (kể cả manh mối) cho vùng
  biển tranh chấp, quan trọng hơn bất kỳ số đếm phao/đèn nào.
