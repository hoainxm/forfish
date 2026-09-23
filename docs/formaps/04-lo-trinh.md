# ForMaps — Lộ trình: từ file tĩnh trong repo tới nhà cung cấp chạy được

> Ngày soạn: 2026-08-29 · Người soạn: teammate FORMAPS (AI)
> Ước công tính bằng **ngày-người**, giả định **một người làm toàn thời gian** đã quen repo. **[E]** = ước tính, chưa đo.

---

## 0. Đọc lộ trình này thế nào

Bốn giai đoạn, và **ba cổng chặn**. Cổng chặn là chỗ **không được đi tiếp nếu chưa có câu trả lời** — không phải chỗ để "vừa làm vừa hỏi".

```
GĐ 0 ──[CỔNG A: pháp lý]── GĐ 1 ──[CỔNG B: có khách thật]── GĐ 2 ──[CỔNG C: bán được]── GĐ 3
Dọn nhà                    Dựng kho                        Bán thử                    Vận hành
~15 ngày                   ~25 ngày                        ~30 ngày                   liên tục
```

Tổng tới lúc **có khách trả tiền đầu tiên**: **~70 ngày-người**, tức khoảng **3,5–4 tháng** nếu một người làm và có việc khác xen vào.

---

## GIAI ĐOẠN 0 — Dọn nhà (~15 ngày)

> Mục tiêu: **sửa những thứ đang sai, trước khi xây thêm.** Mọi việc ở đây đều có ích **cho chính ForFish**, kể cả khi ForMaps không bao giờ ra đời. Đó là lý do làm trước.

| # | Việc | Công **[E]** | Vì sao trước |
|---|---|---|---|
| 0.1 | 🚨 **Mua gói Open-Meteo trả tiền** + hỏi bằng văn bản về quyền bán lại | 1 ngày + chờ | **ForFish đang dùng sai gói.** Vi phạm đang diễn ra ([00 §7.3](00-phap-ly.md)) |
| 0.2 | 🚨 **Kiểm + thêm `© OpenStreetMap contributors`** vào màn `/ngu-truong` | 0,5 ngày | App có bán premium đang chạy dữ liệu OSM. Nếu chưa ghi nguồn là vi phạm ODbL đang diễn ra |
| 0.3 | **Hỏi luật sư** 3 câu ưu tiên (1, 2, 7 ở [00 §9](00-phap-ly.md)) | 1 ngày soạn hồ sơ + chờ 2–4 tuần | **CỔNG A.** Câu 1 quyết định ForMaps có tồn tại được không |
| 0.4 | **Hỏi SDVico** nguồn gốc pháp lý vùng VMS | 0,5 ngày + chờ | Quyết định một trong bốn hào có thật hay không |
| 0.5 | **Tách `vn-sea-lanes.v1.json`** thành hai file/hai bảng (vẽ tay / OSM) | 1 ngày | Lỗ hổng giấy phép đang tồn tại ([00 §3.2](00-phap-ly.md)) |
| 0.6 | Dựng `docs/formaps/attribution.md` + endpoint `/api/attribution` đọc được bằng máy | 1,5 ngày | Ghi nguồn phải là thứ **API tự phục vụ**, không phải thứ nhớ dán tay |
| 0.7 | Email `dem.info@noaa.gov` hỏi về dữ liệu bên thứ ba trong ETOPO vùng VN | 0,5 ngày + chờ | [00 §7.6b](00-phap-ly.md) |
| 0.8 | Đọc ghi chú giấy phép **từng dataset ERDDAP/NCEI** đang dùng, ghi vào bảng | 2 ngày | Bẫy WMO Res 40 ([00 §7.6a](00-phap-ly.md)) |
| 0.9 | Dựng **nhật ký nạp nguồn** cho các script `generate-*.mjs` hiện có (URL, checksum, ngày, git SHA) | 3 ngày | **Bằng chứng nguồn gốc phải sinh lúc nạp** — dựng sau là không dựng được ([00 §6.3](00-phap-ly.md)) |
| 0.10 | Viết `docs/formaps/README.md` chỉ đường 5 tài liệu | 0,5 ngày | — |

### 🚪 CỔNG A — không vượt được thì dừng hẳn

**Ba câu phải có câu trả lời trước khi tiêu thêm một đồng nào:**

| Câu | Nếu trả lời xấu thì sao |
|---|---|
| ForMaps có phải xin **giấy phép đo đạc bản đồ** không? | Phải xin → **+6 tháng, + chi phí nhân sự chứng chỉ**. Có thể phải đổi mô hình (hợp tác với đơn vị đã có giấy thay vì tự làm) |
| Tile vector PMTiles là **Produced Work** hay **Derivative Database**? | Là Derivative → làm §4.6 cho đàng hoàng (rẻ). **Không phải lý do dừng**, chỉ là lý do làm kỹ |
| **Vùng VMS** có được bán lại không? | Không → mất một hào, **và mất luôn gói bán cho doanh nghiệp thuỷ sản** ([03 §1.5](03-kinh-doanh.md)). Vẫn đi tiếp được, nhưng nhỏ hơn |

> ⚠️ **Đây là cổng thật, không phải cổng hình thức.** Nếu câu 1 trả lời "phải có giấy và điều kiện là X, Y, Z mà anh không đáp ứng" thì lộ trình này **phải viết lại**, không phải "cứ làm rồi tính".

---

## GIAI ĐOẠN 1 — Dựng kho (~25 ngày)

> Mục tiêu: dữ liệu ra khỏi git, vào một kho **có nguồn gốc, có phiên bản, có lịch chạy**.

| # | Việc | Công **[E]** |
|---|---|---|
| 1.1 | Thuê VPS **Hetzner Singapore** (CX43), cài PostGIS, dựng vòng đời sao lưu | 2 ngày |
| 1.2 | Dựng bảng `formaps_features` **đủ 7 cột nguồn gốc** ([00 §6.3](00-phap-ly.md)) | 2 ngày |
| 1.3 | Dựng bucket R2 `formaps-raw/` — nạp bản thô + checksum SHA-256, **bất biến** | 2 ngày |
| 1.4 | Chuyển `generate-depth-grid` + `generate-isobaths` thành bước ETL có lịch, ghi vào PostGIS | 3 ngày |
| 1.5 | Chuyển `generate-reef-shapes` + `generate-seamarks` + `generate-sea-lanes` (bản OSM) | 3 ngày |
| 1.6 | Nạp lớp tự soạn (`vn-islands`, `coral-reefs`, tuyến vẽ tay) — `src_method='hand-authored'`, có `src_author` | 1,5 ngày |
| 1.7 | **Cổng CI chặn trộn giấy phép trong một loại đối tượng** + cổng CJK chuyển sang cấp DB | 2 ngày |
| 1.8 | Cài `planetiler`, dựng lại `vn-basemap.pmtiles` từ Geofabrik VN — **đo thật thời gian** | 2 ngày |
| 1.9 | Xuất **ba tileset tách tầng**: `basemap-osm` / `bathy` / `vn-names` | 3 ngày |
| 1.10 | `systemd timer` cho toàn bộ nhịp ([02 §2](02-kien-truc.md)) + nhật ký `formaps_etl_runs` | 2 ngày |
| 1.11 | Repo công khai `formaps-etl-osm` + trang `/formaps/odbl` — **thực hiện §4.6(b)** | 1,5 ngày |
| 1.12 | Chuyển ForFish sang đọc tileset từ R2 thay vì file trong repo | 1 ngày |

> ⚠️ **Việc 1.12 phải chạy `ops/qa-offline-acceptance.md` bộ bắt buộc.** Nó đụng đường lấy nền bản đồ — đúng thứ bà con cần lúc mất sóng. Trả lời bốn câu soi offline và ghi vào commit message.

### Cái được sau GĐ 1

- Dữ liệu có **nguồn gốc truy vấn được**, không nằm trong chú thích.
- Ba tầng giấy phép **tách vật lý**, xuất gói bằng một câu `WHERE`.
- Đường ống **chạy theo lịch**, có nhật ký — bán được cam kết cập nhật.
- **Nghĩa vụ ODbL đã hoàn thành**, công khai, không nợ ai.
- ForFish nhẹ đi ~23 MB trong repo.

---

## GIAI ĐOẠN 2 — Bán thử (~30 ngày)

> Mục tiêu: **một khách thật gọi API thật.** Không phải doanh thu.

| # | Việc | Công **[E]** |
|---|---|---|
| 2.1 | Worker Cloudflare: xác thực licence key (đệm 60 s), 3 mã trạng thái đúng (204/429/503) | 4 ngày |
| 2.2 | Đo lượng dùng qua Durable Object, gộp mỗi 60 s về Supabase | 3 ngày |
| 2.3 | **Bốn endpoint truy vấn** `/depth` `/hazards` `/seamarks` `/place` ([02 §3.1](02-kien-truc.md)) | 5 ngày |
| 2.4 | Endpoint tile XYZ có cổng + nền tầng 1 phục vụ thẳng từ R2 (không Worker) | 2 ngày |
| 2.5 | Hệ phiên bản: kênh ghim / `stable` / `latest` + `/v1/versions` | 3 ngày |
| 2.6 | Trang tài liệu API + khoá thử tự đăng ký | 4 ngày |
| 2.7 | **Demo tầng 3**: nhận dữ liệu VMS giả, vẽ lên nền ForMaps, hiện câu tiếng Việt | 4 ngày |
| 2.8 | Hợp đồng mẫu + phụ lục chuyển tiếp nghĩa vụ ghi nguồn (luật sư xem) | 2 ngày + chờ |
| 2.9 | **Gặp 3 nhà cung cấp VMS tư nhân** — cho xem demo, không chào giá | 3 ngày |

### 🚪 CỔNG B — có ai thật sự cần không

Sau ba cuộc gặp, trả lời thật:

- Có **ít nhất một** công ty nói *"cái này giúp được"* và đồng ý thử không?
- Họ nói **cái gì** giúp được — nền bản đồ (⚠️ dấu hiệu xấu, họ tự làm được) hay **câu tiếng Việt + tuân thủ** (✅ dấu hiệu tốt)?
- Họ có sẵn sàng ký thư ý định không, dù giá 0 ₫?

> ⛔ **Ba cuộc gặp mà không ai muốn thử = dừng lại, đừng xây tiếp.** Xây tiếp lúc đó là xây cho mình xem.

---

## GIAI ĐOẠN 3 — Vận hành (liên tục)

| Việc | Nhịp |
|---|---|
| Trực vận hành, giám sát, cảnh báo | Liên tục — **không có thì đừng bán SLA** |
| Phát hành phiên bản `stable` mới | Quý 1 lần, báo trước 60 ngày |
| Dựng lại tile OSM | Tuần 1 lần |
| Rà soát điều khoản mọi nguồn ngoài | Quý 1 lần |
| Vẽ lại từng lớp bằng nguồn độc lập ([00 §6.2](00-phap-ly.md)) | Dần dần, theo giá trị thương mại |
| Xây đường thu **dữ liệu ngư dân đóng góp** | Sau khi có chính sách quyền riêng tư ([01 §5](01-tai-san-du-lieu.md)) |

---

## 🛑 Điểm không quay lại

Đây là phần quan trọng nhất của tài liệu này. **Bảy chỗ mà một khi đã bước qua thì không lùi được** — hoặc lùi được nhưng phải trả giá lớn.

### 1. 🔴 Giao bản ON-PREMISE có tầng 1 cho khách

**Vì sao không lùi được.** Giao cả cơ sở dữ liệu OSM cho khách chạy sau tường lửa = **Conveying một Derivative Database**. ODbL §4.4 buộc đi kèm ODbL ⇒ khách **có quyền phát tán tiếp**, và ForMaps không lấy lại được. Xoá hợp đồng không xoá được bản sao đã giao.

**Mà on-premise lại đúng là thứ khách VMS và nhà nước cần** ([03 §1.2](03-kinh-doanh.md)).

> ⚠️ **Phải quyết TRƯỚC KHI VIẾT MÃ**: bản on-premise là **bản KHÔNG có tầng 1** (chỉ tầng 2+3, sạch OSM), hay là bản có tầng 1 nhưng đóng gói riêng kèm ODbL. Quyết sau khi đã bán một hợp đồng là quá muộn.

### 2. 🔴 Phát hành một nhãn phiên bản dữ liệu

Một khi `basemap-osm/2026-09` đã ra và có khách ghim vào, **nội dung dưới nhãn đó không bao giờ được đổi**. Sửa lỗi thì phải ra nhãn mới. Đây là cam kết vĩnh viễn với mọi khách production.

*(Bài học ForFish: `SDFISH_CACHE_V` — bump có giá vì `activate` xoá kho cũ trước khi biết mẻ mới có đủ không.)*

### 3. 🔴 Nhận dữ liệu ngư dân đóng góp mà chưa có chính sách quyền riêng tư

**Không thể "chưa-thu" lại được dữ liệu đã thu.** Nếu thu vị trí tàu mà chưa có đồng ý rõ ràng theo NĐ 13/2023, thì mọi thứ dựng trên đó đều nhiễm bẩn, và cách sửa duy nhất là **xoá hết, làm lại**.

> **Vạch ranh giới TRƯỚC dòng dữ liệu đầu tiên**: ForMaps bán dữ kiện về **BIỂN**, không bán dữ kiện về **TÀU**. Vạch nhầm một lần là mất cả sản phẩm gốc — vì lòng tin của bà con là thứ duy nhất khiến họ mở app.

### 4. 🟡 Công khai repo ETL để thoả §4.6

Đăng lên rồi thì gỡ xuống **không xoá được bản đã fork**. Nhưng đây là điểm không-quay-lại **nên bước qua** — chi phí gần bằng 0, và nó gỡ rủi ro pháp lý lớn nhất ([00 §5](00-phap-ly.md)).

⚠️ Điều **phải kiểm kỹ trước khi đăng**: không lọt khoá API, không lọt endpoint nội bộ, và **không lọt phần tầng 3**. Đọc lại toàn bộ repo bằng mắt trước khi bấm public.

### 5. 🟡 Nộp hồ sơ xin giấy phép đo đạc bản đồ

Nộp hồ sơ là **tự giới thiệu mình với cơ quan quản lý**. Nếu hồ sơ cho thấy đang làm việc thuộc diện phải có phép mà **chưa có phép**, thì có thể lộ vi phạm đang diễn ra.

> **Hỏi luật sư TRƯỚC KHI NỘP**, không phải sau. Đây là lý do câu #1 ở [00 §9](00-phap-ly.md) đứng đầu.

### 6. 🟡 Để ForFish phụ thuộc ForMaps

Sau việc 1.12, ForFish lấy nền bản đồ từ hạ tầng ForMaps. Từ lúc đó, **ForMaps sập là ForFish sập**, và ForFish là app mà bà con dùng ngoài biển.

**Cách phòng, phải làm cùng lúc với 1.12, không làm sau**: giữ nguyên nấc lùi hiện có (`vn-coast.v1.json` + service worker cache) làm **lưới an toàn cuối**. Ngày ForMaps hỏng, bà con vẫn phải thấy bờ và đảo.

### 7. 🟡 Ký khách trả tiền đầu tiên

Từ giây đó ForMaps là **hạ tầng của người khác**, không còn là dự án phụ. Có nghĩa vụ SLA, nghĩa vụ báo trước, nghĩa vụ trực.

> **Đừng ký khách trả tiền khi chưa có người trực.** Một khách trả tiền mà dịch vụ chập chờn còn tệ hơn không có khách nào — vì họ sẽ kể lại cho chín người còn lại trong một thị trường chỉ có mười.

---

## Đường ngắn nhất, nếu chỉ có 30 ngày

Nếu chủ dự án muốn kiểm chứng ý tưởng nhanh nhất có thể thay vì xây đủ:

| Ngày | Việc |
|---|---|
| 1–2 | Hỏi luật sư 3 câu + hỏi SDVico. **Cùng lúc** làm 0.1, 0.2 (mua Open-Meteo, thêm ghi nguồn) |
| 3–8 | Đưa **ba lớp tầng 3** (đảo, rạn tên Việt, nhãn báo hiệu) lên PostGIS có đủ cột nguồn gốc. **Chỉ tầng 3** — sạch OSM, không dây buộc, không chờ câu trả lời pháp lý về ODbL |
| 9–15 | Dựng **một endpoint duy nhất**: `/v1/place?lat=&lng=` → *"cách Đá Ba Đầu 3 hải lý, đáy 45 m"* |
| 16–20 | Dựng demo: nhận CSV toạ độ VMS, vẽ lên bản đồ, xuất câu tiếng Việt |
| 21–30 | Gặp 3 nhà cung cấp VMS. Cho xem. Nghe. |

**Vì sao đường này khôn hơn**: nó kiểm chứng **hào thật** ([01 §4](01-tai-san-du-lieu.md)) mà **không đụng một byte OSM nào** — nên không phải chờ câu trả lời về ODbL, không phải dựng đường ống, không phải thuê VPS.

Nếu ba công ty VMS xem `/v1/place` mà không thấy giá trị, thì cả kiến trúc ở [02](02-kien-truc.md) là công vô ích. **Biết điều đó sau 30 ngày rẻ hơn biết sau 4 tháng.**

---

## Tóm tắt công

| Giai đoạn | Ngày-người **[E]** | Ra được gì |
|---|---|---|
| GĐ 0 — Dọn nhà | ~15 | Hết vi phạm đang diễn ra; có câu trả lời pháp lý |
| GĐ 1 — Dựng kho | ~25 | Kho có nguồn gốc, có phiên bản, có lịch |
| GĐ 2 — Bán thử | ~30 | API chạy + demo + 3 cuộc gặp |
| **Tới khách đầu tiên** | **~70** | ≈ 3,5–4 tháng thực tế |
| *Đường ngắn (kiểm chứng)* | *~30* | *Biết ý tưởng có sống không* |

---

## Nguồn

Toàn bộ căn cứ ở [00-phap-ly.md](00-phap-ly.md) · [01-tai-san-du-lieu.md](01-tai-san-du-lieu.md) · [02-kien-truc.md](02-kien-truc.md) · [03-kinh-doanh.md](03-kinh-doanh.md).

Ước công là **ước tính của tôi cho một người đã quen repo**, chưa đo bằng việc thật. Con số dễ sai nhất: việc 1.8 (`planetiler` trên VN 312 MB — tôi đoán 3–10 phút chạy, nhưng công cài đặt và dò tham số có thể gấp đôi ước tính 2 ngày).
