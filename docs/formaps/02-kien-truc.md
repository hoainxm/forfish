# ForMaps — Kiến trúc: từ file tĩnh trong repo tới nhà cung cấp dữ liệu

> Ngày soạn: 2026-08-29 · Người soạn: teammate FORMAPS (AI)
> Mọi giá hạ tầng tra ngày **29/08/2026**. **[Q]** = giá niêm yết trên trang nhà cung cấp · **[E]** = tôi ước tính.
> Đọc kèm: [00-phap-ly.md §6.3](00-phap-ly.md) — lược đồ theo dõi nguồn gốc là **ràng buộc kiến trúc**, không phải chi tiết phụ.

---

## 0. Điểm xuất phát: hôm nay đang có gì

| Chỗ | Cái gì | Cỡ |
|---|---|---|
| `public/data/` trong repo git | 10 file tĩnh sinh sẵn lúc build | ~23,3 MB |
| Supabase (Postgres, **chưa có PostGIS**) | `vms_zones`, `weather_snapshot`, `storm_bulletins` | Nhỏ |
| Vercel | Next.js 16 + route `/api/*` + cron | Hobby/Pro |
| GitHub Actions | Cron làm mới snapshot thời tiết | 4 lượt/ngày |

**Ba điểm yếu chặn ForMaps ngay lập tức:**

1. **Dữ liệu nằm trong git.** `vn-basemap.pmtiles` 16,9 MB đang là file untracked. Đẩy vào git là làm repo phình vĩnh viễn (git không quên). Không có đường phát hành phiên bản dữ liệu tách khỏi phát hành mã.
2. **Script sinh dữ liệu chạy TAY.** Mọi `generate-*.mjs` đều ghi "chạy MỘT LẦN". Không có lịch, không có nhật ký, không có checksum. **Không thể bán cam kết cập nhật cho thứ chạy bằng tay.**
3. **Không có nơi nào biết dòng dữ liệu này tới từ đâu.** Nguồn gốc đang nằm trong **chú thích đầu file** — mà chú thích thì không truy vấn được, không lọc được, không chứng minh được trước toà.

---

## 1. Ba câu hỏi kiến trúc, ba câu trả lời

### 1.1 Kho nguồn: Supabase, hay VPS riêng?

**Trả lời: CẢ HAI, chia theo việc — và ranh giới chia là "dữ liệu của ai".**

| Kho | Chứa gì | Vì sao |
|---|---|---|
| **Supabase (đang có)** | Dữ liệu **vận hành**: tài khoản, licence key, đo lượng dùng, `vms_zones` admin sửa, snapshot thời tiết | Đã chạy, đã có RLS, đã có Auth. Đừng dời. PostGIS **có sẵn** trên mọi gói, bật bằng `create extension postgis` |
| **VPS riêng có PostGIS** | Kho **bản đồ chính**: hình học OSM/ETOPO/tự vẽ, bảng nguồn gốc, kho bản thô, chỗ chạy `planetiler` | Supabase **không chạy được** đường ống nặng, và giá egress của Supabase ($0,09/GB sau 250 GB) là bẫy khi API trở nên nhiều chữ |
| **Object storage (R2)** | File PMTiles đã dựng, bản thô đã lưu, ảnh vệ tinh | **Egress $0,00 không giới hạn** — đây là con số quyết định cả bài toán chi phí |

> ⚠️ **Vì sao KHÔNG để hết trên Supabase**: ở mức 1.000 khách, riêng egress DB đã ~$90/tháng trên tổng ~$239 của Supabase. Tự chạy PostGIS trên một máy Hetzner CX53 (€29,49) rẻ hơn khoảng **$200/tháng** ở đúng mức đó.
>
> ⚠️ **Vì sao KHÔNG dời hết sang VPS**: Supabase Auth + RLS đang giữ tài khoản bà con. Dời là rủi ro thật, đổi lấy khoản tiết kiệm không có.

### 1.2 Máy đặt ở đâu?

Đây là chỗ **latency thắng giá**. Khách của ForMaps ở Việt Nam; khách của khách là ngư dân cầm điện thoại ở Nha Trang.

| Nơi đặt | RTT tới VN | Giá | Nhận xét |
|---|---|---|---|
| Hetzner Đức/Phần Lan | ~250–300 ms | Rẻ nhất (20 TB traffic kèm theo) | **Quá xa.** 300 ms cho mỗi ô bản đồ là hỏng trải nghiệm |
| **Hetzner Singapore** | **~30–50 ms** | +20–40% so với EU **[E]**, traffic kèm chỉ 0,5–8 TB, vượt thì €7,40/TB | ✅ **Điểm giá/độ trễ tốt nhất tìm được** |
| DigitalOcean Singapore | ~30–50 ms | 8 vCPU/16 GB = **$168/tháng** [Q], 6 TB kèm | Đắt gấp ~10 lần Hetzner cho cùng cấu hình |
| VPS Việt Nam (Viettel IDC / FPT / VNG) | **<20 ms** | ≈ 2,5–4 triệu ₫/tháng cho 8 vCPU/16 GB **[E]** | ⚠️ **Chưa xác nhận được điều khoản băng thông.** Nhà cung cấp VN thường tính **lưu lượng trong nước và quốc tế riêng**, mà quốc tế mới là phần đắt. **Phải lấy báo giá bằng văn bản** |
| Cloudflare (CDN đứng trước) | Có PoP ở VN | $0 (gói Free) hoặc $20 (Pro) | **Bắt buộc**, không phải tuỳ chọn — xem dưới |

> 🎯 **Chốt: Hetzner Singapore + Cloudflare CDN đứng trước.** Vì traffic vượt hạn ở Singapore đắt gấp 7,4 lần EU (€7,40/TB so với €1/TB), **CDN không phải để nhanh — nó là để không phá sản.** CDN hấp thụ ~85% lượt, origin chỉ còn 15%.
>
> ⚠️ Hai con số này (+20–40% phụ phí SG, hạn traffic SG) là **ước tính**, không phải giá niêm yết. **Phải kiểm trong bảng điều khiển Hetzner trước khi cam kết** — chúng là hai con số làm lệch tổng nhiều nhất.

### 1.3 Cột sống: Cloudflare R2

**Egress $0,00/GB, không giới hạn** [Q]. Đây là con số làm sụp mọi so sánh khác:

| Ở mức 15 TB/tháng | Chi phí băng thông |
|---|---|
| **Cloudflare R2** | **$0** |
| AWS CloudFront (Singapore) | $1.680 |
| Vercel (sin1, $0,16/GB) | $2.240 |

Và đây cũng là cách Protomaps tự khuyến nghị triển khai. ⚠️ Nhưng tài liệu của họ có cảnh báo phải đọc: *"Cloudflare R2 is known to have higher latency (500ms or higher)"* — **lớp cache của Worker không phải tuỳ chọn, nó là bắt buộc.**

> 💡 **Mẹo tiết kiệm lớn**: `pmtiles://` của MapLibre gọi HTTP Range **ngay từ trình duyệt**. Trỏ vào một tên miền R2 công khai thì **không cần Worker nào cả** — $0 request, $0 egress, chỉ trả tiền lưu trữ. Đánh đổi: không xác thực được, không đo được. ⇒ **Nền bản đồ tầng 1 (ODbL, dù sao cũng phải mở) đi đường này. Chỉ đặt cổng cho endpoint truy vấn tầng 2–3.** Riêng chỗ này cắt ~$150/tháng ở mức 1.000 khách.

---

## 2. Đường ống dữ liệu

```
┌─ NGUỒN ─────────────────────────────────────────────────┐
│ Geofabrik vietnam-latest.osm.pbf  312 MB · ngày 1 lần   │
│ ETOPO 2022 qua ERDDAP (.dods)     68 MB  · năm 1 lần    │
│ Natural Earth 10m                  ~50 MB · năm 1 lần    │
│ EMODnet / GEBCO                            · quý 1 lần   │
│ Copernicus / NOAA / Open-Meteo             · giờ–ngày    │
│ Ngư dân đóng góp (sau này)                 · liên tục    │
└────────────────────┬────────────────────────────────────┘
                     ↓  ① NẠP — giữ BẢN THÔ + checksum
┌────────────────────────────────────────────────────────┐
│ R2 bucket `formaps-raw/`                                │
│   osm/2026-08-29/vietnam.osm.pbf   + sha256             │
│   etopo/2022/etopo15s.dods         + sha256             │
│ → BẤT BIẾN. Không bao giờ ghi đè. Đây là BẰNG CHỨNG.    │
└────────────────────┬────────────────────────────────────┘
                     ↓  ② CHUẨN HOÁ — vào PostGIS, GẮN NGUỒN GỐC
┌────────────────────────────────────────────────────────┐
│ PostGIS trên VPS Singapore                              │
│   formaps_features (geom, feature_type, props,          │
│     src_dataset, src_licence, src_fetched_at,           │
│     src_ref, src_method, src_author)   ← §6.3 của 00    │
│ Mỗi loại đối tượng MỘT nguồn duy nhất (Horizontal Map   │
│ Layers) — cổng CI chặn trộn giấy phép                   │
└────────────────────┬────────────────────────────────────┘
                     ↓  ③ HỢP NHẤT / KHỬ TRÙNG
┌────────────────────────────────────────────────────────┐
│ · Ghép tên tiếng Việt vào hình OSM = LIÊN KẾT, KHÔNG    │
│   GHI ĐÈ (hai bảng, một khoá — giữ tách giấy phép)      │
│ · Khử 98 polygon trùng (way vừa top-level vừa member)   │
│ · Cổng CJK: còn ký tự Hán là DỪNG, không xuất           │
│ · Kiểm hình học: vòng kín, không tự cắt, trong khung    │
└────────────────────┬────────────────────────────────────┘
                     ↓  ④ XUẤT — mỗi tầng một mẻ
┌────────────────────────────────────────────────────────┐
│ planetiler → R2 `formaps-tiles/`                        │
│   basemap-osm.v{N}.pmtiles       (tầng 1 — ODbL)        │
│   bathy.v{N}.pmtiles             (tầng 2 — public)      │
│   vn-names.v{N}.pmtiles          (tầng 3 — độc quyền)   │
│   depth-grid.v{N}.bin  ·  isobaths.v{N}.json            │
└────────────────────┬────────────────────────────────────┘
                     ↓  ⑤ PHỤC VỤ
      Cloudflare CDN → Worker (xác thực + đo) → R2 / PostGIS
```

### Nhịp chạy

| Việc | Nhịp | Máy | Thời gian **[E]** |
|---|---|---|---|
| Nạp diff OSM (`.osc.gz`) | **Hằng ngày** — Geofabrik dựng lại mỗi ngày, có diff | VPS | vài phút |
| Dựng lại tile OSM bằng `planetiler` | **Tuần 1 lần** | CX43 (8 vCPU/16 GB) | **3–10 phút** cho VN 312 MB |
| ETOPO / Natural Earth | **Năm 1 lần** (đáy biển không đổi) | VPS | ~2 phút tải + xử lý |
| EMODnet / GEBCO | **Quý 1 lần** | VPS | — |
| Snapshot thời tiết | **4 lượt/ngày** — 04/10/16/22 UTC + 40′ | GitHub Actions (giữ nguyên) | — |
| Dự báo cá | **6 giờ/lần** (giữ nguyên) | Vercel cron | — |
| Ngư dân đóng góp | **Liên tục vào**, gộp vào mẻ tuần | VPS | — |

> ⚠️ **Tuyệt đối không dựng lại tile mỗi ngày.** Mỗi bản dựng là một phiên bản mà khách production phải chịu. Đổi dữ liệu dưới chân khách đang chạy là cách nhanh nhất mất khách. Xem §4.

> ⚠️ **Vercel KHÔNG chạy được đường ống này.** Không gói function nào cho 10–60 phút, 8–16 GB RAM, 100+ GB đĩa tạm. Cần máy thật, không tránh được — nên chi phí VPS là **cố định ở mọi phương án**.

### Chạy bằng gì

| Việc | Công cụ | Vì sao |
|---|---|---|
| Điều phối | **systemd timer + script shell** trên VPS | Nguyên tắc 15 bậc 4: nền tảng có sẵn. **Đừng thêm Airflow/Dagster** cho 6 việc chạy theo lịch |
| Dựng tile | **planetiler** | 3–10 phút cho VN vs 10–20 phút của tilemaker, và ăn RAM ít hơn (2–4 GB heap so với 8–16 GB) |
| Nạp OSM | `osmium` + `osm2pgsql` | Chuẩn ngành |
| Nhật ký chạy | Bảng `formaps_etl_runs` trong PostGIS | Vừa là giám sát, vừa là **bằng chứng nguồn gốc** ([00 §6.3](00-phap-ly.md)) |

---

## 3. API — hình dạng, xác thực, đo lường

### 3.1 Ba kiểu endpoint, ba mục đích khác nhau

| Kiểu | Đường | Dùng khi | Ghi chú |
|---|---|---|---|
| **PMTiles + HTTP Range** | `GET /v1/tiles/{tileset}.pmtiles` (Range) | Khách dùng MapLibre, muốn nhanh nhất, rẻ nhất | **Không xác thực được** ⇒ chỉ cho tầng 1 (dù sao cũng ODbL). Thẳng từ R2, chi phí ~$0 |
| **XYZ tile** | `GET /v1/tiles/{tileset}/{z}/{x}/{y}.{pbf\|png}` | Khách dùng thư viện cũ, hoặc cần đo/chặn theo khách | Qua Worker. Đây là **đường thu tiền chính** |
| **Truy vấn GeoJSON** | `GET /v1/query/{layer}?bbox=&types=` | VMS, bảo hiểm — không vẽ bản đồ, chỉ hỏi số | Qua Worker → PostGIS. Đây là chỗ **giá trị cao nhất** |

**Bốn endpoint truy vấn nên có ngay, vì đó là thứ khách VMS thật sự cần:**

```
GET /v1/depth?lat=&lng=                     → độ sâu tại điểm (m) + hạng an toàn
GET /v1/hazards?bbox=&buffer_nm=            → rạn/đá/xác tàu trong vùng
GET /v1/seamarks?bbox=                      → báo hiệu + đặc tính đèn, NHÃN TIẾNG VIỆT
GET /v1/place?lat=&lng=                     → "cách đảo Song Tử Tây 12 hải lý hướng Đông Bắc"
```

> 💡 Cái cuối cùng (`/place`) trông tầm thường nhưng là món **dễ bán nhất**: hệ VMS hiện chỉ hiện được toạ độ số. Biến `9,9939°B / 114,6575°Đ` thành *"cách Đá Ba Đầu 3 hải lý"* là thứ cán bộ trực ban dùng được ngay, và nó chạy **hoàn toàn trên tầng 3** — không dây buộc giấy phép nào.

### 3.2 Xác thực licence key

```
Authorization: Bearer fm_live_<32 ký tự ngẫu nhiên>
```

- Khoá lưu ở Supabase, chỉ giữ **hash** (`sha256`), không giữ bản rõ.
- Worker giữ **bản đệm khoá trong bộ nhớ, TTL 60 giây** — không hỏi DB mỗi ô tile (500 triệu request/tháng mà mỗi cái một truy vấn DB là tự sát).
- Mỗi khoá gắn: gói dịch vụ, hạn mức/tháng, danh sách tầng được phép (`1` / `1,2` / `1,2,3`), danh sách tên miền được gọi.
- **Thu hồi** phải có hiệu lực trong ≤60 giây — trần TTL chính là cam kết đó.

⚠️ **Bài học đã trả giá trong ForFish, đừng lặp lại**: `/api/admin/*` từng bị service worker cache đè bản 200 cũ lên 401/403 thật. Với ForMaps thì lỗi tương đương là **CDN cache đè phản hồi của khách A cho khách B**. Luật: **mọi phản hồi có xác thực phải `Cache-Control: private`, và khoá cache phải gồm cả licence key.**

### 3.3 Đo lượng dùng — không đo đồng bộ

Ghi từng lượt vào DB ngay là hỏng ở mức 500 triệu request. Cách đúng:

1. Worker cộng bộ đếm trong **Durable Object** (hoặc Workers KV) theo khoá + giờ.
2. Mỗi 60 giây đẩy một mẻ gộp về Supabase (`formaps_usage`: `key_id, hour, endpoint, count, bytes`).
3. Hoá đơn tính từ bảng gộp.

**Hạn mức**: kiểm tra ở Worker bằng bộ đếm trong bộ nhớ. Vượt thì **HTTP 429 kèm `Retry-After`**, không phải 200 kèm `{ok:false}` — đúng luật đã học trong ForFish (soát offline 2026-08-02): mã 200 làm CDN và service worker cất phản hồi lỗi đè lên dữ liệu tốt.

**Ba mã trạng thái phải viết đúng ngay từ đầu:**

| Tình huống | Mã | Vì sao |
|---|---|---|
| Ngoài dải zoom / ô trống thật | `204` | Ô trống là sự thật, không phải lỗi |
| Vượt hạn mức | `429` + `Retry-After` | Khách lùi đúng cách, CDN không cache |
| Nguồn nội bộ hỏng | `503` | **Không bao giờ 200 kèm `{ok:false}`** |
| Khoá sai / hết hạn | `401` / `403` | Và **cấm cache**, cấm mọi lớp cứu |

---

## 4. Phiên bản dữ liệu — thứ dễ làm mất khách nhất

Khách chạy production. Đổi dữ liệu dưới chân họ mà không báo là mất khách, không phải là mất uy tín — mất khách.

### Luật phiên bản

```
/v1/tiles/basemap-osm/2026-09/{z}/{x}/{y}.pbf   ← ghim phiên bản, BẤT BIẾN
/v1/tiles/basemap-osm/stable/{z}/{x}/{y}.pbf    ← trỏ tới bản ổn định hiện hành
/v1/tiles/basemap-osm/latest/{z}/{x}/{y}.pbf    ← bản mới nhất, có thể đổi bất cứ lúc nào
```

| Kênh | Cho ai | Cam kết |
|---|---|---|
| `YYYY-MM` (ghim) | Khách production nghiêm túc | **Bất biến vĩnh viễn.** Không bao giờ sửa nội dung dưới một nhãn đã phát hành |
| `stable` | Mặc định | Đổi **tối đa mỗi quý một lần**, báo trước **60 ngày** |
| `latest` | Dev, thử nghiệm | Đổi lúc nào cũng được |

### Ba bất biến

1. **Nhãn phiên bản đã phát hành không bao giờ đổi nội dung.** Muốn sửa thì phát hành nhãn mới. (Đây chính là bài học `SDFISH_CACHE_V` trong ForFish: bump có giá vì `activate` xoá kho cũ trước khi biết mẻ mới có đủ không.)
2. **Giữ tối thiểu 4 phiên bản ghim** (một năm). Lưu trữ rẻ ($0,015/GB-tháng); mất khách thì không rẻ.
3. **Khai tử phải có nghi thức**: báo 60 ngày → 30 ngày thêm header `Deprecation` → tắt. Không bao giờ tắt im lặng.

### Endpoint bảng kê

```
GET /v1/versions
→ { "basemap-osm": { "stable": "2026-09", "latest": "2026-11",
                     "available": ["2026-03","2026-06","2026-09","2026-11"],
                     "deprecating": { "2026-03": "2026-12-31" } }, … }
```

Khách tự dò được là khách không phải gọi điện hỏi.

---

## 5. Chi phí thật

### Giả định (nói rõ ra, vì mọi con số phụ thuộc vào chúng)

1. Một ô tile trung bình **30 KB**.
2. **Tỷ lệ trúng cache CDN 85%** — con số nặng nhất trong cả bảng. Ở 95% thì chi phí đọc R2 giảm ~3 lần.
3. Lưu trữ: **20 GB / 50 GB / 200 GB** ở ba mức.
4. EUR→USD = 1,09. Giá Hetzner **chưa VAT**.
5. Lưu lượng: 1M×30 KB = **30 GB** · 50M×30 KB = **1,5 TB** · 500M×30 KB = **15 TB**.

### So ba phương án phục vụ

| | **10 khách** 1 tr. request | **100 khách** 50 tr. | **1.000 khách** 500 tr. |
|---|---|---|---|
| **R2 + Workers** + máy ETL + Supabase | **$47,6** | **$70,7** | **$467,2** |
| **Vercel Pro** + máy ETL + Supabase | **$62,4** | **$236,4** | **$3.785,2** |
| ✅ **Hetzner SG + Cloudflare** (tự chạy PostGIS) | **$29,5** | **$40,1** | **$158,0** |
| *AWS S3+CloudFront (chỉ phần phục vụ)* | *~$1* | *~$109* | *~$2.303* |

**Cách ra con số của cột 1.000 khách, phương án Hetzner SG:**
- 2 × CX53-SG ≈ €76,68 = $83,58 **[E — phụ phí SG là ước tính]**
- Lưu lượng origin = 15% × 15 TB = 2,25 TB; vượt 1 TB kèm → 1,25 × €7,40 = €9,25 = **$10,08** [Q cho €7,40/TB]
- Cloudflare Free = **$0**
- Máy ETL CX53 ≈ **$32,15**
- PostGIS tự chạy trên chính máy đó = **$0** thêm
- R2 lưu PMTiles 200 GB = **$2,85** [Q]
- Supabase Pro (chỉ tài khoản + đo lượng dùng, nhẹ) = **$25** [Q]
- **≈ $154–158/tháng**

### Ba điều bảng này nói

**(1) Toàn bộ câu chuyện chi phí là EGRESS.** Ở 15 TB/tháng, CloudFront tính $1.680 và Vercel tính $2.240 cho đúng số byte mà R2 chở miễn phí.

**(2) 🔴 Vercel là cái bẫy cho việc này, và hỏng ở hai chỗ.** Đắt gấp ~8 lần R2+Workers ở mức lớn; **và** Edge Request của Vercel ở Singapore ($2,60/triệu) đắt gấp **8,7 lần** request của Workers ($0,30/triệu). Phục vụ 500 triệu file nhỏ qua đồng hồ CDN của Vercel là tổ hợp gần như tệ nhất có thể. Chưa kể nó **không chạy nổi ETL**.

> ⚠️ **Nhưng đừng dời ForFish khỏi Vercel.** ForFish là app, không phải máy chủ tile. Vercel đang làm tốt việc của nó. **ForMaps là hạ tầng riêng, đặt cạnh, không thay thế.**

**(3) Chi phí cố định là máy ETL, không tránh được ở phương án nào.** Cái €15,99 CX43 ấy có mặt trong cả ba cột. Điều đó làm yếu hẳn lý lẽ "serverless không có sàn chi phí", và làm mạnh lý lẽ "đã có VPS rồi thì phục vụ luôn từ đó".

### Hai cần gạt tiết kiệm lớn

| Cần gạt | Tiết kiệm |
|---|---|
| Nâng tỷ lệ trúng cache 85% → 95% | Chi phí đọc R2 ở mức 1.000 khách: $28,80 → **~$4** |
| Nền tầng 1 phục vụ thẳng từ tên miền R2 công khai (bỏ Worker) | **~$150/tháng** ở mức 1.000 khách. Chỉ đặt cổng cho endpoint truy vấn tầng 2–3 |

### Chi phí bị bỏ sót trong mọi ước tính hạ tầng

| Khoản | Ước |
|---|---|
| Gói **Open-Meteo trả tiền** (bắt buộc, [00 §7.3](00-phap-ly.md)) | **?** — phải hỏi báo giá |
| Luật sư — 10 câu ở [00 §9](00-phap-ly.md) | 30–100 triệu ₫ **[E]** |
| **Giấy phép đo đạc bản đồ** (nếu cần) — nhân sự có chứng chỉ hành nghề | Có thể là khoản lớn nhất. Chưa ước được |
| Bảo hiểm trách nhiệm nghề nghiệp | Chưa tra |
| Người trực vận hành | Không có thì đừng bán SLA |

> **Nói thẳng**: hạ tầng ~$160/tháng ở mức 1.000 khách là **khoản nhỏ nhất** trong bảng chi phí ForMaps. Đừng để con số đẹp đó che mất ba dòng dưới nó.

---

## 6. Kiến trúc chốt

```
        ┌──────────────── Cloudflare (CDN + Workers) ────────────────┐
        │  · Xác thực licence key (đệm 60 s)                          │
        │  · Đo lượng dùng (Durable Object → gộp mỗi 60 s)            │
        │  · Hạn mức → 429 · Nguồn hỏng → 503 · Ô trống → 204         │
        └───┬────────────────────────┬──────────────────────┬────────┘
            │                        │                      │
      ┌─────▼─────┐         ┌────────▼────────┐     ┌───────▼────────┐
      │    R2     │         │  PostGIS trên   │     │    Supabase    │
      │  PMTiles  │         │  Hetzner SG     │     │ tài khoản·khoá │
      │  bản thô  │         │  + đường ống ETL│     │  ·đo·vms_zones │
      │ egress $0 │         │  + planetiler   │     │  (giữ nguyên)  │
      └───────────┘         └─────────────────┘     └────────────────┘
            ▲                        ▲
            │                        │  systemd timer
            └────── mẻ tuần ─────────┤  ① nạp+checksum ② chuẩn hoá
                                     │  ③ hợp nhất ④ xuất
                                     │
                  Geofabrik · ETOPO · Natural Earth · EMODnet ·
                  Copernicus · NOAA · ngư dân đóng góp
```

**Nền tầng 1 (ODbL) đi đường riêng, bỏ qua Worker**: `pmtiles://` từ tên miền R2 công khai → nhanh nhất, rẻ nhất, và **đúng tinh thần ODbL** (dữ liệu OSM vốn phải mở).

---

## 7. Việc phải làm, theo thứ tự

| # | Việc | Vì sao trước |
|---|---|---|
| 1 | Bật PostGIS + dựng bảng `formaps_features` **có đủ cột nguồn gốc** | Không có cột này thì mọi dữ liệu nạp sau đều phải bóc lại bằng tay |
| 2 | Dựng kho **bản thô + checksum** trên R2 | Bằng chứng nguồn gốc phải sinh **lúc nạp**, không dựng lại được sau |
| 3 | Chuyển `generate-*.mjs` thành đường ống có lịch + nhật ký | Không bán được cam kết cập nhật cho thứ chạy tay |
| 4 | **Tách `vn-sea-lanes` thành hai** (vẽ tay / OSM) | Lỗ hổng giấy phép đang tồn tại ([00 §3.2](00-phap-ly.md)) |
| 5 | Dựng cổng CI chặn trộn giấy phép trong một loại đối tượng | Cùng khuôn với cổng CJK đã có — một truy vấn ngăn một sai lầm không sửa được |
| 6 | Thuê VPS Hetzner SG, chạy thử planetiler trên VN 312 MB | **Đo thật**, đừng tin con số 3–10 phút của tôi |
| 7 | Dựng Worker xác thực + đo, phục vụ một tileset | Bán được cái đầu tiên |

---

## Nguồn

Giá tra ngày 29/08/2026:
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Protomaps trên Cloudflare](https://docs.protomaps.com/deploy/cloudflare)
- [Vercel pricing](https://vercel.com/docs/pricing) · [giá vùng sin1](https://vercel.com/docs/pricing/regional-pricing/sin1)
- [Supabase pricing](https://supabase.com/pricing) · [PostGIS trên Supabase](https://supabase.com/docs/guides/database/extensions/postgis)
- [Hetzner Cloud](https://www.hetzner.com/cloud/) · [điều chỉnh giá 06/2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [AWS CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/)
- [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets)
- [Viettel Cloud](https://viettel-cloud.com.vn/pricing/) · [FPT Cloud VPS](https://fptcloud.com/bang-gia-thue-vps/)
- [Geofabrik — vietnam-latest.osm.pbf, 312 MB, dựng lại hằng ngày](https://download.geofabrik.de/asia/vietnam.html)
- [planetiler](https://github.com/onthegomap/planetiler) · [PLANET.md benchmark](https://github.com/onthegomap/planetiler/blob/main/PLANET.md) · [tilemaker benchmark](https://www.tilemaker.org/post/13)
