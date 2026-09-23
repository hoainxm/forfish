# Đối chiếu CARTO vs nền bản đồ hiện tại — 2026-09-02

## Tóm tắt
Không thể tiến hành đối chiếu chi tiết vì **CARTO vector tiles không công khai miễn phí**. Dịch vụ hiện tại yêu cầu API key để truy cập.

## Kết quả thử tải CARTO

Đã thử các endpoint CARTO vector tiles công khai (không key):

| Endpoint | Mã HTTP | Trạng thái |
|---|---|---|
| `https://basemaps.cartocdn.com/vector/carto.streets/v1/0/0/0.mvt` | 404 Not Found | Không tồn tại |
| `https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/0/0/0.mvt` | 404 Not Found | Không tồn tại |
| `https://basemaps.cartocdn.com/vector/carto_smoothed.streets/v1/0/0/0.mvt` | 404 Not Found | Không tồn tại |
| `https://basemaps.cartocdn.com/gl/positron/style.json` | 404 Not Found | Không tồn tại |

Các dịch vụ tile tương tự:
- Mapbox (`https://api.mapbox.com/v4/mapbox.streets/0/0/0.mvt`): **401 Unauthorized** (yêu cầu key)
- ArcGIS Raster: **200 OK** (nhưng là PNG raster, không phải vector MVT)

## Kết luận

**CARTO nay đóng công khai (không cung cấp vector tiles miễn phí). Để so sánh, cần:**
- Liên hệ CARTO để xin API key, hoặc
- Sử dụng snapshot lịch sử CARTO nếu còn lưu, hoặc
- Dùng nguồn khác (OSM trực tiếp, Mapbox với key, v.v.)

## Không thực hiện các bước tiếp theo

- ❌ Bước 2: Tính tile coordinates cho 6 vị trí — không áp dụng (data CARTO không tải được)
- ❌ Bước 3-4: So sánh lớp vector — không áp dụng
- ❌ Bước 5: Danh sách manh mối — không áp dụng

## Ghi chú

- File `public/data/vn-basemap.pmtiles` của ta vẫn hoạt động bình thường (dữ liệu Protomaps/OSM gốc)
- Nền raster CARTO (`https://a.basemaps.cartocdn.com/light_all/...`) vẫn phục vụ (200 OK), nhưng là raster PNG, không phải vector tiles
- Để so sánh chi tiết vector, cần phải có quyền truy cập vector tiles (CARTO hoặc nguồn khác)
