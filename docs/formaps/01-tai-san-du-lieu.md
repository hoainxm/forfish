# ForMaps — Tài sản dữ liệu: cái gì bán được, cái gì không

> Ngày soạn: 2026-08-29 · Người soạn: teammate FORMAPS (AI) · **Không phải luật sư.**
> Đọc kèm: [00-phap-ly.md](00-phap-ly.md) (căn cứ pháp lý cho từng dòng bảng dưới đây).

---

## 0. Đọc bảng này thế nào

Mỗi món dữ liệu ForFish đang có được xếp vào một trong ba nhóm:

| Nhóm | Nghĩa là gì | Làm được gì |
|---|---|---|
| 🟢 **A — Bán tự do** | Tự làm, hoặc nguồn public domain (không ai giữ quyền) | Bán API, bán licence, giữ kín cơ sở dữ liệu, không phải ghi nguồn (nhưng nên ghi) |
| 🟡 **B — Bán được nhưng có dây buộc** | Được dùng thương mại, nhưng phải ghi nguồn, hoặc phải chia sẻ lại phần dẫn xuất | Bán được, nhưng **phải làm đúng nghi thức**, và có món buộc phải mở dữ liệu ra |
| 🔴 **C — Chưa bán được** | Điều khoản cấm, hoặc chưa rõ, hoặc đang dùng sai gói | Dừng lại, mua gói đúng, hoặc thay nguồn |

Một chữ phải nhớ suốt tài liệu này: **"bán được" nói về quyền của NGƯỜI CHO DỮ LIỆU, không nói về quyền của người mua.** Có món ForMaps bán được nhưng khách của ForMaps lại phải ghi nguồn — dây buộc đó đi theo dữ liệu xuống tận khách của khách. Hợp đồng licence của ForMaps phải chuyển tiếp dây buộc đó, nếu không thì ForMaps vi phạm.

---

## 1. Bảng phân loại đầy đủ

### 🟢 Nhóm A — bán tự do

| Tài sản | Đo thật | Nguồn | Vì sao tự do |
|---|---|---|---|
| **Lưới độ sâu ETOPO 15″** | 17.057.881 ô · `depth-grid.v1.bin` 4,26 MB | ETOPO 2022 (NOAA NCEI) qua ERDDAP PIFSC | Tác phẩm của chính phủ Mỹ → không có bản quyền (17 U.S.C. § 105). NOAA Coast Survey còn hiến hẳn vào public domain bằng CC0. ⚠️ Xem cảnh báo §3.1 |
| **9 mức đường đẳng sâu** | 5.110 tuyến · `isobaths.v1.json` 1,33 MB | Tự sinh bằng marching-squares + Douglas–Peucker từ ETOPO | Thuật toán + tham số + dung sai theo mức là **của ForMaps**. Nguồn gốc public domain nên bản dẫn xuất cũng tự do |
| **Bờ biển + đảo nền** | `vn-coast.v1.json` 220 KB | Natural Earth 1:10m | "No permission is needed… Crediting the authors is unnecessary" — nguồn tự do nhất trong cả kho |
| **103 đảo có tên tiếng Việt** | `vn-islands.v1.json` 18,8 KB | **Tự soạn** (toạ độ + tên từ Wikipedia tiếng Việt, gán `admin` thủ công) | Toạ độ là dữ kiện, không có bản quyền. Việc CHỌN, SOẠN, GÁN chủ quyền là công của ForMaps |
| **13 rạn/bãi ngầm tên tiếng Việt** | `coral-reefs.v1.json` 2,6 KB | **Tự soạn** (Trường Sa + thềm lục địa DK1) | Như trên |
| **Bảng nhãn tiếng Việt cho báo hiệu hàng hải** | 26 nhãn + `describeLight()` trong `src/lib/seamarks.ts` | **Tự soạn** | Bản dịch/biên soạn là tác phẩm của ForMaps. `Fl(2)W.10s14M` → "Chớp 2 nhịp, ánh trắng, 10 giây một vòng, xa 14 hải lý" |
| **Tuyến hàng hải lớn vẽ tay** | phần `kind:"tuyen"` trong `vn-sea-lanes.v1.json` | **Tự vẽ** (cố ý không dùng Global Shipping Lanes vì giấy phép BY-SA/BY-NC) | Đã tránh nguồn bẩn ngay từ đầu — quyết định này giờ trả cổ tức |
| **Mô hình dự báo cá** | `fish-predict.ts` + `fish-blend-weights.json` + `fish-climatology.v1.json` (72 KB, 69×65 ô, 12 tháng) | **Tự làm**, có backtest 16 mốc gốc × 7 tầm ngày | Công thức, 40 hồ sơ loài, hằng số hiệu chỉnh, bảng pha trộn w(d) — không nguồn nào cho không |
| **Nghiệp vụ vận hành** | `source-registry.ts`, `snapshot-merge.ts`, `source-cadence.ts`, `abort.ts` | **Tự làm** | Xem §4 — đây là hào bị đánh giá thấp nhất |

**Ghi chú về ETOPO**: lưới 17 triệu ô ở dạng `.bin` 2 bit/ô là **định dạng của ForMaps**, không phải của NOAA. Ai muốn có bằng đó phải tự tải 68 MB `.dods` rồi tự phân hạng. Việc đó không khó, nhưng nó tốn công — và đó là chỗ ForMaps bán *sự tiện*, không bán *dữ liệu*.

---

### 🟡 Nhóm B — bán được nhưng có dây buộc

| Tài sản | Đo thật | Nguồn + giấy phép | Dây buộc |
|---|---|---|---|
| **Nền vector PMTiles** | `vn-basemap.pmtiles` **16,9 MB** | Protomaps dựng từ **OpenStreetMap** — **ODbL 1.0** | 🔴 **Nặng nhất.** Chia sẻ tương tự (share-alike) + nghĩa vụ mở cơ sở dữ liệu dẫn xuất (ODbL §4.6). Xem [00-phap-ly.md](00-phap-ly.md) §2 |
| **5.851 báo hiệu hàng hải** | `seamarks.v1.json` 188 KB, 21 loại, 4.303 cái có thông tin đèn | OpenStreetMap / OpenSeaMap — **ODbL 1.0** | Như trên. Đã bỏ hết `name` → nhẹ hơn về chủ quyền nhưng **không** nhẹ hơn về giấy phép |
| **2.622 hình rạn / bãi ngầm** | `reef-shapes.v1.json` 783 KB, 29.242 đỉnh | OpenStreetMap Overpass (`natural=reef`, `natural=shoal`) — **ODbL 1.0** | Như trên |
| **290 luồng / phân luồng / cáp / giàn khoan** | phần OSM trong `vn-sea-lanes.v1.json` | OpenStreetMap Overpass — **ODbL 1.0** | Như trên |
| **Ô hải đồ độ sâu EMODnet** | proxy qua `/api/tiles/chart`, z0–12 | EMODnet Bathymetry — **CC-BY 4.0** | Chỉ phải **ghi nguồn**. Không share-alike. ⚠️ Nhưng CC-BY cấp quyền cho *dữ liệu*, không cấp quyền dùng *máy chủ của họ* → xem §3.2 |
| **Dòng chảy / độ mặn / sóng Copernicus** | 4 tầng sâu, 575 điểm, `curdepth:t{tier}:d10` | Copernicus Marine — licence riêng | Ghi nguồn theo câu chuẩn + **phải giữ nhật ký sử dụng và xuất trình khi được yêu cầu** |
| **SST / phù du / SSHA NOAA ERDDAP** | 11 fetch/lượt `/api/fish-forecast` | NOAA CoastWatch — "available for use without restriction" | Ghi nguồn theo phép lịch sự. ⚠️ Kiểm từng dataset một, xem §3.3 |
| **HYCOM** | tuỳ chọn, timeout 12 s | US Navy — DISTRIBUTION A, public release | Ghi nguồn quỹ tài trợ. Có tuyên bố "as is" — quan trọng vì dữ liệu này dính an toàn tính mạng |
| **GEBCO** | nền của EMODnet | Public domain | "we ask that you acknowledge" — nên ghi |

---

### 🔴 Nhóm C — chưa bán được (phải xử lý trước)

| Tài sản | Vấn đề | Xử thế nào |
|---|---|---|
| **Toàn bộ dữ liệu Open-Meteo** (gió, sóng, mưa, mây, nhiệt, CAPE, áp suất, dòng chảy mặt) | 🔴 Điều khoản dịch vụ MIỄN PHÍ của Open-Meteo: *"You may only use the free API services for non-commercial purposes."* Ví dụ "thương mại" của chính họ có: app có gói thuê bao, app có quảng cáo | **Việc gấp — không phải chuyện của ForMaps mà là của ForFish HÔM NAY.** ForFish đã có gói premium ⇒ đang dùng sai gói. Phải mua gói trả tiền của Open-Meteo. Và **phải hỏi bằng văn bản** xem gói trả tiền có cho **bán lại** cho khách hạ nguồn không — điều khoản của họ không nói |
| **Vùng VMS chính thức VN** (3 file GeoJSON SDVico gửi + bảng `vms_zones`) | ❓ Không biết nguồn gốc pháp lý. Ai cấp? Có cho phép bán lại không? Có văn bản nào không? | **Hỏi SDVico ngay.** Đây có thể là hào lớn nhất (§4) hoặc là quả bom (§5) — hiện chưa biết cái nào |
| **Nền PMTiles bán ở dạng "cơ sở dữ liệu"** | Bán quyền *truy vấn* thì gỡ được; bán quyền *tải nguyên khối bảng OSM đã chuẩn hoá* thì rơi thẳng vào ODbL §4.4 + §4.6 | Xem [00-phap-ly.md](00-phap-ly.md) §5 — kiến trúc ba tầng |
| **Tên tiếng Việt của rạn ở Hoàng Sa** | `coral-reefs.v1.json` mới có 7 điểm Trường Sa + 6 điểm thềm lục địa. **Chưa có Hoàng Sa** | Không phải vấn đề pháp lý — là lỗ hổng sản phẩm. Xem [04-lo-trinh.md](04-lo-trinh.md) |

---

## 2. Ba con số cần nhớ khi nói chuyện với khách

- **17.057.881** ô độ sâu ~450 m — không phải "có dữ liệu độ sâu", mà là độ phân giải mà VMS hiện hành **không có**.
- **5.851** báo hiệu hàng hải **đọc được bằng tiếng Việt**, không phải ảnh raster.
- **2.622** hình rạn với sai số mép **33 m** (trước là 770 m). Rạn là thứ đâm tàu — con số này là con số an toàn, không phải con số đẹp.

---

## 3. Bốn cảnh báo phải xử trước khi ký hợp đồng đầu tiên

### 3.1 ETOPO 2022 là bản HỢP NHẤT, không phải một nguồn thuần
ETOPO gom nhiều bộ dữ liệu vùng, và **có vùng dùng dữ liệu bên thứ ba có bản quyền được cấp phép vào lưới**. Việc quyền đó có chảy xuống người bán lại hay không **không có trang nào nói rõ**. Đây là câu hỏi cho luật sư, và nên gửi email hỏi thẳng `dem.info@noaa.gov`.

**Việc phải làm**: xác định vùng biển VN trong ETOPO lấy từ nguồn nào — nếu là GEBCO/SRTM15 thuần thì sạch; nếu có bộ khảo sát tư nhân thì phải xem giấy.

### 3.2 CC-BY của EMODnet cho phép dùng DỮ LIỆU, không cho phép mượn MÁY CHỦ
`src/lib/tile-proxy.ts` hiện đang proxy thẳng `tiles.emodnet-bathymetry.eu`. Với ForFish (một app, lưu lượng nhỏ) thì hợp lý. Với ForMaps (bán lại cho hàng trăm khách) thì **phải tự dựng tile từ dữ liệu tải về**, không proxy. Bằng không là biến máy chủ của EMODnet thành hạ tầng miễn phí cho một sản phẩm thương mại — họ có quyền chặn IP bất cứ lúc nào, và ngày họ chặn là ngày mọi khách của ForMaps mất hải đồ cùng lúc.

Cùng lý lẽ áp cho `tiles.openseamap.org` — nhưng cái này đã tự nhiên hết nguy hiểm: lớp ảnh OpenSeaMap **đã tắt hẳn** từ 2026-08-29 (`seamarks: false`), thay bằng vector tĩnh cùng origin.

### 3.3 WMO Resolution 40 — cái bẫy dành riêng cho công ty Việt Nam
Một số bộ dữ liệu của NOAA/NCEI mang ghi chú rằng dữ liệu quan trắc do các nước thành viên WMO trao đổi **không được cung cấp cho người khác hoặc dùng để tái xuất khẩu dịch vụ thương mại** ngoài nước Mỹ. Một công ty Việt Nam bán API chính là "tái xuất khẩu dịch vụ thương mại quốc tế".

Theo tra cứu thì điều này **không áp cho ETOPO, CoralTemp, HYCOM** (đó là sản phẩm mô hình/vệ tinh, không phải quan trắc trạm của nước thành viên). Nhưng luật ở đây là: **đọc ghi chú của TỪNG dataset trước khi nạp**, và mặc định coi mọi dataset quan trắc-theo-trạm là cấm.

### 3.4 Không được đội logo NOAA
Bản quyền không cấm, nhưng **nhãn hiệu thì cấm**: emblem NOAA "shall not be used to imply endorsement" và không được dùng làm branding hay trong quảng cáo. Ghi NOAA là **nguồn dữ liệu** thì được; dán logo NOAA lên trang bán hàng của ForMaps thì không.

---

## 4. Hào thật của ForMaps

Câu hỏi đúng không phải "ForMaps có gì" mà là **"cái gì đối thủ bỏ tiền ra cũng không mua được trong 6 tháng?"**. Soi từng món:

### ❌ Không phải hào (ai cũng lấy được trong 1 tuần)
- Nền OSM/PMTiles — Protomaps phát hành build hằng ngày, miễn phí.
- Lưới độ sâu ETOPO — script 200 dòng, 95 giây tải.
- Đường đẳng sâu — marching squares là thuật toán trong sách giáo khoa.
- Báo hiệu hàng hải, hình rạn — một truy vấn Overpass.
- Dữ liệu dự báo Open-Meteo/Copernicus/NOAA — ai đăng ký cũng có.

Nói thẳng: **khoảng 80% dung lượng byte trong kho ForFish không phải là hào.** Ai muốn cũng dựng lại được. Đừng bán câu chuyện "chúng tôi có 17 triệu ô độ sâu" — đối thủ có 17 triệu ô đó sau một buổi chiều.

### ✅ Hào thật, xếp theo độ sâu

**1. Tên tiếng Việt + gán chủ quyền — hào PHÁP LÝ, không phải hào kỹ thuật.**
Đây là hào mạnh nhất và lý do khiến nó mạnh không nằm ở chỗ "khó soạn 103 cái tên". Nó nằm ở đây:

> Nghị định 18/2020/NĐ-CP phạt **30–40 triệu đồng** với hành vi lưu hành sản phẩm đo đạc, bản đồ liên quan chủ quyền lãnh thổ mà **không thể hiện hoặc thể hiện sai** chủ quyền, biên giới quốc gia; **40–50 triệu** nếu là **xuất bản**.

Nghĩa là: một công ty VMS Việt Nam **không thể** lấy nền OSM thô mà dùng, vì OSM ở Hoàng Sa/Trường Sa gắn tên chữ Hán (đo thật: **160 tên chứa ký tự Hán** trong khung biển VN) và tên Anh/Philippines. Dùng thô là ăn phạt. Tự soạn lại thì phải bỏ hàng tháng công + chịu rủi ro chính trị nếu soạn sai.

ForMaps đã trả cái giá đó rồi, và có **cổng tự kiểm CJK** trong script sinh file: còn một ký tự Hán là `throw`, không ghi file. Đó không phải một tính năng — đó là một **cam kết tuân thủ có thể kiểm chứng được**, thứ bán được cho khách doanh nghiệp.

*Đây là chỗ ForMaps nên đặt toàn bộ trọng lượng thương hiệu.* Không phải "bản đồ biển", mà **"bản đồ biển đúng luật Việt Nam"**.

**2. Vùng VMS chính thức + logic cảnh báo ranh giới — hào QUAN HỆ.**
`geofence.ts` (`BORDER_STEPS_NM = [15, 10, 6, 3]`) + `vms-zones.ts` + bảng admin sửa vùng không cần build lại. Cái quý không phải mã nguồn (viết lại trong 3 ngày) mà là **hình vùng đến từ đâu**. Nếu SDVico lấy từ cơ quan quản lý thì đó là quan hệ, không phải dữ liệu — và quan hệ thì không copy được.

⚠️ **Nhưng hào này hiện chưa xác nhận được.** Phải hỏi SDVico: file GeoJSON ấy có nguồn giấy tờ gì, có được phép bán lại không. Nếu không có giấy, đây không phải hào — đây là rủi ro.

**3. Mô hình dự báo cá + có backtest — hào KHOA HỌC.**
Không phải vì công thức khó (PFZ là công thức ngành, ai cũng biết). Mà vì:
- 40 hồ sơ loài với dải nhiệt + khẩu vị mồi, hiệu chỉnh trên lưới thật.
- `fish-blend-weights.json`: w giảm 0,823 (ngày 1) → 0,547 (ngày 16), **đơn điệu tự nhiên**, thắng persistence ở cả 7 tầm khi kiểm chéo (+4,4% → +9,0% RMSE).
- **Có cả kết luận ÂM được ghi lại**: tách w theo mùa gió THUA bảng chung ở cả 7 tầm ⇒ giữ một bảng.

Cái cuối là dấu hiệu của công việc thật. Đối thủ copy được công thức nhưng không copy được **bộ số đã hiệu chỉnh cho Biển Đông** — muốn có phải chạy lại toàn bộ backtest, mà muốn chạy backtest phải có kho dữ liệu lịch sử (CoralTemp 1985→nay, chl tháng 2012→nay) và biết phải đo cái gì.

**4. Nghiệp vụ vận hành nguồn — hào bị đánh giá thấp nhất.**
Đây là thứ không ai nhìn thấy trong demo nhưng quyết định việc khách có gia hạn hợp đồng năm sau không:
- `source-registry.ts` — mỗi trường có DANH SÁCH ứng viên, chạy song song, lấy bản mới nhất, quá tuổi thì gắn `stale` chứ không vứt.
- `snapshot-merge.ts` — ghép hai nguồn theo đơn vị (ngày × nhóm biến), nguồn >48h loại, không trộn trong ngày.
- `source-cadence.ts` — biết GFS ra bản lúc 04/10/16/22 UTC nên không gọi vô ích; đã cứu app khỏi 429 một lần rồi.
- `abort.ts` — 65 lời gọi timeout gom về một chỗ, có đường lùi cho Safari 15.
- Toàn bộ luật "nguồn hỏng phải trả 503, không phải 200 kèm `{ok:false}`" + các cổng test chống tái phát.

Đây là **hai năm học phí trả bằng sự cố thật**, ghi lại thành mã và test. Một đối thủ dựng API bản đồ trong 3 tháng sẽ không có cái này, và sẽ phát hiện ra là mình thiếu vào đúng ngày ERDDAP treo.

**5. Dữ liệu ngư dân đóng góp — hào TƯƠNG LAI, hiện bằng 0.**
Đây là hào duy nhất có thể **lớn dần theo thời gian** thay vì bị bắt kịp. Chưa có gì. Xem đánh giá thẳng ở §5.

---

## 5. Nói thẳng về "dữ liệu ngư dân đóng góp"

Đề bài gợi ý đây là hào. **Đồng ý về lý thuyết, nhưng hôm nay giá trị bằng không**, và có ba rào phải vượt trước khi nó thành hào:

**Rào 1 — chưa có cơ chế thu.** App hiện chưa có đường nào để bà con báo "chỗ này có đá ngầm", "phao này hỏng", "chỗ này cạn hơn bản đồ". Phải xây, và phải xây kiểu **một chạm** — ngư dân 40–60 tuổi trên tàu lắc không điền form.

**Rào 2 — dữ liệu ngư dân là dữ liệu cá nhân + bí mật nghề.** Vị trí tàu là thứ nhạy cảm nhất trong nghề cá: nó lộ ngư trường. Bán dữ liệu vị trí của bà con cho công ty bảo hiểm hay logistics **mà không có đồng ý rõ ràng** là vừa vi phạm Nghị định 13/2023 về bảo vệ dữ liệu cá nhân, vừa phá tan lòng tin — mà lòng tin là thứ duy nhất khiến bà con mở app.

> **Ranh giới nên vạch từ hôm nay**: ForMaps bán **dữ kiện về BIỂN** (chỗ này cạn, phao này hỏng, rạn này ở đây), tuyệt đối **không** bán **dữ kiện về TÀU** (ai ở đâu, ai đánh chỗ nào). Vạch nhầm ranh giới này một lần là mất cả sản phẩm gốc.

**Rào 3 — phải kiểm chứng.** Một báo cáo lẻ không thành dữ liệu hải đồ. Cần ≥3 tàu độc lập báo cùng chỗ, hoặc đối chiếu với ETOPO. Không có bước này thì ForMaps bán ra thứ có thể làm đắm tàu người khác.

**Kết luận về hào này**: đúng là hào duy nhất bền, nhưng nó ở cách hiện tại **12–18 tháng** và cần một quyết định đạo đức được ghi thành chính sách, không phải một tính năng.

---

## 6. Bảng tóm — bán cái gì, giá nào

| Gói | Gồm | Nhóm giấy phép | Bán được ngay? |
|---|---|---|---|
| **Nền hải đồ** (độ sâu + đẳng sâu + bờ + đảo) | ETOPO, Natural Earth, tự sinh | 🟢 A | ✅ Ngay |
| **Nhãn Việt + chủ quyền** | 103 đảo, 13 rạn, 26 nhãn báo hiệu | 🟢 A | ✅ Ngay — **và đây là món đắt nhất** |
| **Chi tiết hàng hải** (báo hiệu, rạn, luồng, cáp) | OSM | 🟡 B (ODbL) | ⚠️ Được, nhưng phải theo nghi thức §4.6 |
| **Nền vector đầy đủ** (PMTiles) | OSM qua Protomaps | 🟡 B (ODbL) | ⚠️ Như trên |
| **Thời tiết biển** | Open-Meteo | 🔴 C | ❌ Phải mua gói trả tiền + hỏi về quyền bán lại |
| **Hải dương học** (dòng chảy, độ mặn, sóng, SST) | Copernicus, NOAA, HYCOM | 🟡 B | ✅ Được, nhớ ghi nguồn + giữ nhật ký |
| **Dự báo cá** | Tự làm | 🟢 A | ✅ Ngay — nhưng phải nói thật về độ chính xác |
| **Vùng VMS + cảnh báo ranh giới** | SDVico | ❓ | ⛔ **Hỏi SDVico trước, đừng bán khi chưa có giấy** |

---

## 7. Việc phải làm với tập tài sản này

1. **Dựng `docs/formaps/attribution.md`** — một trang duy nhất chứa đủ câu ghi nguồn cho mọi nguồn, và một endpoint `/api/formaps/attribution` để khách tự đọc bằng máy. Nghĩa vụ ghi nguồn phải là thứ **API tự phục vụ**, không phải thứ nhớ dán tay vào hợp đồng.
2. **Đánh dấu nguồn ở cấp DÒNG dữ liệu, không phải cấp file.** Mỗi feature trong PostGIS phải có cột `src_dataset` + `src_licence` + `src_method` + `src_author`. Lược đồ đầy đủ và cách chứng minh nguồn gốc nếu bị kiện: [00-phap-ly.md §6.3](00-phap-ly.md). Không có mấy cột này thì ngày phải tách tầng ODbL sẽ phải bóc bằng tay — và bóc sai.
3. **Hỏi SDVico về nguồn gốc pháp lý của vùng VMS** — trước khi viết một dòng mã ForMaps nào.
4. **Mua gói Open-Meteo trả tiền** — việc này gấp cho chính ForFish, không chờ ForMaps.

---

## Nguồn

Truy cập 2026-08-29:
- [Natural Earth — Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)
- [NCEI — ETOPO Global Relief Model](https://www.ncei.noaa.gov/products/etopo-global-relief-model)
- [NOAA Coast Survey — Data Licensing](https://www.nauticalcharts.noaa.gov/data/data-licensing.html)
- [NOAA CoastWatch ERDDAP — noaacrwsstDaily](https://coastwatch.noaa.gov/erddap/info/noaacrwsstDaily/index.html)
- [EMODnet — Terms of use](https://emodnet.ec.europa.eu/en/terms-use-emodnet-online-services-data-and-data-products)
- [GEBCO — Gridded bathymetry data](https://www.gebco.net/data-products/gridded-bathymetry-data)
- [Copernicus Marine — Service commitments and licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence)
- [Open-Meteo — Terms](https://open-meteo.com/en/terms) · [Open-Meteo — Licence](https://open-meteo.com/en/licence)
- [HYCOM — Acknowledgements](https://www.hycom.org/publications/acknowledgements/hycom-data)
- [WMO Resolution 40](https://community.wmo.int/resolution-40)
- [NOAA emblem usage](https://www.noaa.gov/noaa-emblem-usage-and-licensing)
- [Thư viện pháp luật — mức phạt bản đồ thiếu Hoàng Sa, Trường Sa (NĐ 18/2020/NĐ-CP)](https://thuvienphapluat.vn/phap-luat/luu-hanh-ban-do-viet-nam-the-hien-thieu-hinh-anh-quan-dao-hoang-sa-va-truong-sa-co-bi-xu-phat-khong-12223.html)

Số đo tài sản lấy từ chính repo ngày 2026-08-29 (`public/data/`, `docs/app-map/02-architecture.md` ghi chú 2026-08-29).
