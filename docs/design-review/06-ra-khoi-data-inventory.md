# 06 — Ra khơi (`/ngu-truong`) — DATA INVENTORY (cho redesign)

> **Mục đích**: liệt kê TOÀN BỘ dữ liệu đưa vào màn Ra khơi — lớp nào, nguồn nào, **cố định hay cập nhật thường xuyên**, độ trễ/cache, fallback — + data **dự kiến** sẽ thêm, để designer bố trí đúng (cái tươi mỗi giờ cần vị trí dễ thấy/làm mới; cái tĩnh thì nền). Nguồn: [ops/external-services](../app-map/ops/external-services.md) + `lib/ocean-map.ts` + [01-product §Trục 1](../app-map/01-product.md). Ngày: 2026-06-16.

---

## 1. Phân loại theo NHỊP cập nhật (trục chính cho design)

| Nhịp | Nghĩa | Gồm |
|---|---|---|
| 🟥 **Liên tục** | đổi bất cứ lúc nào, an toàn tính mạng | Bão (GDACS): tin + đường đi + vùng ảnh hưởng |
| 🟧 **Theo giờ** | mỗi vài giờ một bản | Gió/sóng/mưa/dông điểm + 1–10 ngày · lưới gió/sóng Windy · tuyến dẫn đường (theo dự báo) |
| 🟨 **Theo ngày** | ~1 bản/ngày (ảnh vệ tinh trễ ~2 ngày) | Dự báo cá PFZ · SST nóng-lạnh · phù du · ảnh mây · nước dâng/xoáy (SSHA) · tầng nhiệt D20 |
| 🟦 **Gần cố định** | đổi rất chậm (cộng đồng/năm) | Phao đèn/báo hiệu (OpenSeaMap) |
| ⬛ **Cố định** | tĩnh, đóng gói/không đổi | Hải đồ độ sâu · lưới độ sâu ETOPO · mùa vụ cá · hồ sơ loài · nhãn chủ quyền · danh bạ cảng |
| ⚪ **Tính offline** | không fetch, tính trên máy | Tuần trăng |
| 👤 **Của user** | localStorage / thiết bị / account | Điểm ghim + cảng nhà · GPS "Tàu tôi" · trạng thái đăng nhập |

## 2. Lớp NỀN bản đồ (chọn-MỘT) — `lib/ocean-map.ts`

| Lớp (nhãn) | Nguồn | Nhịp | Trễ | Zoom thật | Ghi chú |
|---|---|---|---|---|---|
| **Hải đồ độ sâu** (mặc định) | EMODnet (nền GEBCO) | ⬛ Cố định | 0 | 10 | "không đổi theo ngày"; gò/bãi cạn; zoom gần thấy phao |
| **Nước nóng lạnh** (SST anomaly) | NASA GIBS — GHRSST MUR | 🟨 Ngày | ~2 ngày | 7 | chênh nhiệt (không tuyệt đối) → lộ nước trồi/xoáy |
| **Vùng nhiều mồi** (chlorophyll) | NASA GIBS — VIIRS NOAA20 | 🟨 Ngày | ~2 ngày | 7 | mây che → để trống (không phải hết mồi) |
| **Ảnh mây trời** (truecolor) | NASA GIBS — VIIRS NOAA20 | 🟨 Ngày | ~2 ngày | 9 | ảnh chụp thật, JPG đặc |

> Mọi lớp NASA: trễ ~2 ngày (UI phải ghi "ảnh ngày X, chậm vài ngày"). Bathymetry là lớp **mặc định** khi mở (chuẩn app hàng hải).

## 3. Lớp DỮ LIỆU động (vẽ đè bản đồ)

| Lớp | Dữ liệu / nguồn | Nhịp | Cache | Fallback khi chết |
|---|---|---|---|---|
| **Dự báo cá (PFZ)** heatmap + hồng tâm | `/api/fish-forecast`: NOAA ERDDAP (SST blended · chlorophyll DINEOF · SSHA · dị thường nhiệt nước trồi · dòng chảy u/v) + HYCOM (D20 tầng nhiệt). Tính server, chấm điểm 39 loài. | 🟨 Ngày | **6h** (ISR) | pill "chạm để thử lại" → lùi **mùa vụ tĩnh** |
| **Gió/sóng tại điểm + 1–10 ngày** | `sea-forecast` — Open-Meteo marine + forecast | 🟧 Giờ | 6h | thẻ peek "Chưa lấy được — Thử lại" |
| **Lưới gió/sóng động (Windy)** | `forecast-grid` — Open-Meteo ~80 điểm/giờ, 3 ngày (mũi tên + thanh thời gian + ▶) | 🟧 Giờ | — | nút Thử lại, lớp ẩn |
| **Nước dâng/xoáy (SSHA)** | `/api/sea-scalar` — NOAA ERDDAP | 🟨 Ngày | 6h | im lặng (không bịa) |
| **Bão: tin + đường đi + vùng ảnh hưởng** | `/api/storms` — GDACS (Point tâm + LineString track + Polygon vùng) | 🟥 Liên tục | server 15s | banner + lớp ẩn nếu lỗi; KHÔNG nói "không có bão" |
| **Phao đèn / báo hiệu** | `/api/nautical` — Overpass / OpenSeaMap | 🟦 Gần cố định | timeout 25s | lớp ẩn; chỉ hiện khi zoom gần bờ |
| **Tuyến dẫn đường tiết kiệm dầu** | `route-planner`/`route-weather` — Open-Meteo 72h (sóng/gió/**dòng chảy SMOC**) + **lưới độ sâu ETOPO đóng gói** né cạn | 🟧 Giờ (dự báo) + ⬛ (độ sâu) | — | tính lại khi đổi đích; ước dầu "tham khảo" |

## 4. Data TĨNH đóng gói trong repo (⬛ cố định, không fetch)

| Data | File | Dùng cho |
|---|---|---|
| Lưới độ sâu ETOPO | `public/data/depth-grid.v1.bin` (~30KB) | né cạn/rạn khi dẫn đường |
| Mùa vụ cá | `data/fish-seasons.ts` (7 vùng × 39 loài × tháng) | fallback dự báo cá + lọc loài theo mùa/vùng |
| Hồ sơ loài | `SPECIES_PROFILES` (39 loài: SST, dải mồi, màu, surfaceSignal) | chấm điểm + màu heatmap + độ tin |
| Nhãn chủ quyền VN | trong `ocean-map.ts` | Hoàng Sa/Trường Sa + tên vùng biển tiếng Việt |
| Danh bạ cảng | data cảng (10 cảng chỉ định) | "Về cảng nhà", chọn cảng |

## 5. Data của USER (👤)

| Data | Lưu ở | Ghi chú |
|---|---|---|
| Điểm ghim "Điểm tôi" + cảng nhà | localStorage `forfish.places.v1` | sao vàng trên map; chạm xem dự báo chỗ đó |
| Vị trí "Tàu tôi" | GPS thiết bị (realtime, không lưu) | nút định vị |
| Trạng thái đăng nhập | Supabase auth / account | gate **chi tiết** điểm cá (loài/khả năng/hướng); heatmap thì public (teaser) |

## 6. Data DỰ KIẾN sẽ thêm (⏳ — designer nên chừa chỗ / nghĩ trước)

| Data dự kiến | Nhịp dự kiến | Trạng thái | Lưu ý design |
|---|---|---|---|
| **OceanByte** — khuyến nghị ngư trường (feed thương mại) | **2 lần/tuần** | qua adapter, chưa bật | KHÔNG hứa chính xác hằng ngày; là lớp "khuyến nghị" tách khỏi PFZ tự tính |
| **Dòng chảy mặt biển** (lớp tile riêng) | 🟨 Ngày | chưa có nguồn free no-key | sẽ là 1 lớp nền/overlay nữa |
| **Độ mặn** (SMOS/SMAP) | 🟨 Ngày | tạm rút (nhiễu/ngừng) | chỗ trong nhóm "lớp số liệu biển" (cùng SSHA) |
| **Tầng nhiệt nâng cao** (OHC/iso26C) | 🟨 Ngày | nguồn ngừng 2024, chờ | bổ sung cho dự báo cá ngừ |
| **Bản tin ngư trường RIMF** theo kỳ | vài ngày | nối khi có thoả thuận | thay/bổ sung mùa vụ tĩnh |
| **Nguồn bão chính thống VN (KTTV)** | 🟥 Liên tục | nâng cấp khi có thoả thuận | thay/bổ sung GDACS — tên/cấp khớp đài VN |

## 7. Hệ quả cho design (gợi ý, không bắt buộc)
- **Cần "đang xem ngày/giờ nào" rõ ràng**: lớp 🟨 ngày (ảnh trễ 2 ngày) và 🟧 giờ phải hiện mốc thời gian + nút làm mới; KHÔNG để user tưởng realtime.
- **Bão 🟥 ưu tiên cao nhất** (an toàn tính mạng) — luôn nổi bật bất kể lớp đang xem.
- **Lớp nền chọn-một** (hải đồ/nhiệt/mồi/mây) vs **overlay bật-tắt nhiều** (cá/gió-sóng/SSHA/phao/bão/tuyến) — 2 nhóm khác bản chất, gom riêng.
- **Mỗi nguồn đều degrade** → mỗi lớp cần trạng thái lỗi/thử-lại + nhãn "tham khảo".
- Chừa chỗ cho **6 data dự kiến** (§6) — nhất là OceanByte (khuyến nghị) + dòng chảy + độ mặn.

---

**Tạo**: 2026-06-16 — kèm [05-ra-khoi-current-state.md](05-ra-khoi-current-state.md) (bố cục/flow). Giao designer cùng 2 file.
