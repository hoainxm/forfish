# Nguồn dữ liệu đại dương MỞ để tự chủ lớp "ngư trường"

> **Mục đích:** Lập bản đồ các nguồn dữ liệu hải dương MỞ, miễn phí, dùng được hợp pháp để ForFish tái tạo khả năng "tìm luồng cá" của OceanBytes/OceanFishMap **mà KHÔNG phụ thuộc API trả phí/độc quyền của họ**. Tập trung vào các lớp là tín hiệu tụ cá thật sự: **front nhiệt (SST front)**, **front màu/diệp lục (chl front)**, **xoáy SSHA**, dòng chảy mặt — cùng SST/chlorophyll nền.
> **Load khi:** thiết kế/triển khai tính năng bản đồ ngư trường, chọn nguồn tile/API hải dương, hoặc tự tính lớp front.
> Cập nhật: 10/06/2026. Nguồn được dẫn link ngay tại chỗ. Chỗ nào là suy luận/giả định (chưa kiểm chứng từ docs) ghi rõ **(giả định)**; còn lại là **đã kiểm chứng từ tài liệu chính thức**.

---

## 0. Bối cảnh & khoảng trống cần lấp

OceanFishMap bán sau API trả phí các lớp: SST, **SST fronts**, chlorophyll/plankton + **plankton fronts**, **SSHA**, dòng chảy mặt, FSLE, thermocline, tảo độc (HAB). Trong đó **fronts (gradient SST/chl sắc nét)** và **xoáy SSH** mới là chỉ báo tụ cá thật.

ForFish hiện có:
- **NASA GIBS WMTS** (SST anomaly, chlorophyll, ảnh mây) — trễ ~2 ngày.
- **Open-Meteo** (gió/sóng/thời tiết).

Khoảng trống: **SSHA + dòng chảy mặt**, và quan trọng nhất là **lớp front** (không ai phát free dưới dạng tile). Tài liệu này map nguồn mở cho từng lớp + chiến lược tự tính front.

Vùng quan tâm: **Biển Đông** (xấp xỉ kinh độ 105–120°E, vĩ độ 5–23°N).

---

## 1. Copernicus Marine (CMEMS) — nguồn "vàng" cho SSHA + dòng chảy

Miễn phí sau khi đăng ký tài khoản (Copernicus Marine Data Store). Đây là nguồn duy nhất trong danh sách phát **SSHA + dòng chảy địa chuyển dạng tile WMTS dùng trực tiếp từ trình duyệt**.

### 1.1. Sản phẩm phủ Biển Đông

| Sản phẩm (Product ID) | Lớp cho ngư trường | Độ phân giải | Độ trễ | Nguồn |
|---|---|---|---|---|
| `GLOBAL_ANALYSISFORECAST_PHY_001_024` | SST (thetao), **dòng chảy mặt (uo, vo)**, SSH (zos) | ~1/12° (0.083°, ~9 km), tới PT6H | NRT + dự báo 10 ngày | [CMEMS PHY 001_024](https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/services) |
| `SEALEVEL_GLO_PHY_L4_NRT_008_046` | **SLA/SSHA**, ADT, **dòng địa chuyển (geostrophic currents)** | 1/4° (~25 km) | NRT (~ngày) | [CMEMS SEALEVEL NRT](https://data.marine.copernicus.eu/product/SEALEVEL_GLO_PHY_L4_NRT_008_046/description) |
| `GLOBAL_ANALYSISFORECAST_BGC_001_028` | **Chlorophyll (chl)**, plankton, nutrients | 1/4° | NRT + dự báo 10 ngày | [CMEMS BGC 001_028](https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_BGC_001_028/description) |
| `SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001` (OSTIA) | SST quan trắc L4 | 0.05° (~5 km) | NRT | [CMEMS OSTIA SST](https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001/description) |

> Lưu ý: SLA và SSH là biến khác nhau — SLA = bất thường so với trung bình 20 năm (1993–2012), SSH/ADT = mực tuyệt đối ([CMEMS — SSH vs SLA](https://help.marine.copernicus.eu/en/articles/6025269-what-are-the-differences-between-the-ssh-and-sla-variables)). Cho phát hiện **xoáy tụ cá**, dùng **SLA/ADT + dòng địa chuyển**.

### 1.2. Cách truy cập — có WMTS dùng được từ trình duyệt/Next.js

**Đã kiểm chứng:** CMEMS có endpoint **WMTS** trả tile ảnh, **không cần NetCDF**, **không thấy yêu cầu API key/token cho GetTile** trong tài liệu ([CMEMS — How to use WMTS](https://help.marine.copernicus.eu/en/articles/6478168-how-to-use-wmts-to-visualize-data)).

- Endpoint: `https://wmts.marine.copernicus.eu/teroWmts`
- GetCapabilities: `https://wmts.marine.copernicus.eu/teroWmts?SERVICE=WMTS&version=1.0.0&REQUEST=GetCapabilities`
- Mẫu GetTile (dòng chảy `uo`):
  ```
  https://wmts.marine.copernicus.eu/teroWmts/?service=WMTS&version=1.0.0&request=GetTile
    &layer=GLOBAL_ANALYSISFORECAST_PHY_001_024/cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i_202406/uo
    &tilematrixset=EPSG:3857&tilematrix=2&tilerow=2&tilecol=6&format=image/png
    &time=2024-02-02T00:00:00.000Z
  ```
- Quy ước layer: `PRODUCT_ID/DATASET_ID_TAG/VARIABLE_ID`.
- Hỗ trợ **EPSG:3857** (Pseudo-Mercator, hợp với Leaflet/MapLibre) và **EPSG:4326**; có chiều `TIME` (ISO 8601) và `ELEVATION` (depth).
- Ngoài WMTS còn có **OPeNDAP / NetCDF / REST (Copernicus Marine Toolbox)** cho việc lấy giá trị số — nhưng nặng hơn, nên để backend xử lý.

> **(giả định)** Tên `DATASET_ID_TAG` có hậu tố phiên bản (vd `_202406`) thay đổi theo đợt cập nhật → nên đọc `GetCapabilities` định kỳ ở backend để lấy layer ID hiện hành thay vì hardcode.

### 1.3. Giấy phép / ghi nguồn

Bản quyền thuộc Liên minh châu Âu; cấp phép **toàn cầu, không độc quyền, miễn phí bản quyền (royalty-free), được tạo sản phẩm phái sinh và phân phối lại** ([CMEMS — Service Commitments and Licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence)). Chuỗi ghi nguồn bắt buộc cho sản phẩm/dịch vụ phái sinh ([CMEMS — How to cite](https://help.marine.copernicus.eu/en/articles/4444611-how-to-cite-copernicus-marine-products-and-services)):

> **"Generated using E.U. Copernicus Marine Service Information; https://doi.org/<DOI của product>"**

> Lưu ý: chuyển dịch sang **CC-BY 4.0** từ 02/07/2025 áp dụng cho **CDS/ADS/EWDS** (khí hậu/khí quyển), **chưa xác nhận** áp cho Copernicus **Marine** — vẫn dùng chuỗi ghi nguồn Marine ở trên ([ECMWF — CC-BY thay License 02/07/2025](https://forum.ecmwf.int/t/cc-by-licence-to-replace-licence-to-use-copernicus-products-on-02-july-2025/13464)). **(cần kiểm chứng lại định kỳ)**

**Dùng được ngay không?** → **CÓ, tile-ready** (WMTS) cho SST/SSHA/dòng chảy/chl. Đăng ký tài khoản 1 lần; GetTile không cần token theo docs.

---

## 2. NOAA CoastWatch / ERDDAP — nguồn "vàng" cho GIÁ TRỊ ĐIỂM (tính front)

ERDDAP là chìa khoá để **lấy giá trị số theo lat/lon** mà không cần tự xử lý NetCDF — nó tự reformat sang **.json, .csv, .png, .pdf, .nc...** ([ERDDAP — griddap Documentation](https://coastwatch.noaa.gov/erddap/griddap/documentation.html)).

### 2.1. Dataset hữu ích (đã kiểm chứng ID)

| Lớp | Dataset ID | Độ phân giải | Server |
|---|---|---|---|
| **SST Geo-polar Blended L4** (Day+Night) | `noaacwBLENDEDsstDNDaily` | 5 km, daily, NRT | [NOAA CoastWatch ERDDAP](https://coastwatch.noaa.gov/erddap/info/noaacwBLENDEDsstDNDaily/index.html) |
| **MUR SST L4** (siêu nét) | `jplMURSST41` | 0.01° (~1 km), daily | [CoastWatch West](https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.html) |
| **Chlorophyll VIIRS** NRT L3 | `noaacwNPPVIIRSchlaDaily` | 4 km, daily | [NOAA CoastWatch ERDDAP](https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSchlaDaily.html) |
| **OSCAR dòng chảy mặt** | `jplOscar` | 1/3°, 5-day | [CoastWatch West](https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar.html) |

### 2.2. Mẫu URL griddap — trả PNG hoặc JSON cho hộp lat/lon

Định dạng: `https://<server>/erddap/griddap/<datasetID>.<fileType>?<var>[(time)][(latMin):(latMax)][(lonMin):(lonMax)]`

- **JSON giá trị (cho tính front ở backend), hộp Biển Đông, lưới thưa (stride 10):**
  ```
  https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDsstDNDaily.json?
    analysed_sst[(last)][(5):10:(23)][(105):10:(120)]
  ```
- **Ảnh PNG overlay sẵn:**
  ```
  https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDsstDNDaily.png?
    analysed_sst[(last)][(5):(23)][(105):(120)]
  ```
- ERDDAP cũng có **WMS** (`/erddap/wms/<datasetID>/...`) nếu muốn tile thay vì giá trị.

> Cú pháp `[ (latMin):(stride):(latMax) ]` cho phép **lấy lưới thưa** → giảm số điểm, đủ để tính gradient mà nhẹ. **(đã kiểm chứng cú pháp từ docs griddap)**.

### 2.3. Giấy phép

Dữ liệu NOAA là **tác phẩm của Chính phủ Mỹ → public domain**, dùng tự do; chỉ cần ghi nguồn lịch sự ([ERDDAP — Information](https://coastwatch.noaa.gov/erddap/information.html)). Chuỗi gợi ý:

> **"Data: NOAA CoastWatch / NESDIS (ERDDAP)"** (+ tên dataset).

**Dùng được ngay không?** → **CÓ cho cả hai mục đích**: giá trị điểm (`.json`, **cần xử lý nhẹ ở backend**) và ảnh (`.png`/WMS, tile-ready). Đây là backbone để **tự tính front**.

---

## 3. NASA — ngoài GIBS tiles

| Nguồn | Lớp | Cách lấy browser-friendly | Nguồn |
|---|---|---|---|
| **GIBS WMTS** (đang dùng) | SST anomaly, chlorophyll (MODIS/VIIRS), ảnh mây | **Tile WMTS** `https://gibs.earthdata.nasa.gov/wmts/...`, có lớp "Best Available", EPSG:3857 GoogleMapsCompatible | [GIBS API for Developers](https://wiki.earthdata.nasa.gov/display/GIBS/GIBS+API+for+Developers) |
| **OceanColor (OBPG)** | Chlorophyll-a L3/L4 (VIIRS/MODIS/OLCI) | L3/L4 Browser + tải composite; **giá trị số tốt nhất lấy qua ERDDAP** (mục 2) | [NASA Ocean Color](https://oceancolor.gsfc.nasa.gov/) |
| **PO.DAAC** | MUR SST (1 km), **OSCAR dòng chảy mặt** | NetCDF/OPeNDAP; **browser-friendly hơn khi đi qua ERDDAP** (`jplMURSST41`, `jplOscar`) | [PO.DAAC OSCAR NRT](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0) |

- GIBS: chú ý hãng đã **ngừng** lớp "Chlorophyll a Terra/Aqua MODIS" cũ — dùng lớp VIIRS/MODIS thay thế ([GIBS — layers](https://wiki.earthdata.nasa.gov/display/GIBS/GIBS+API+for+Developers)).
- PO.DAAC native là NetCDF/OPeNDAP (**cần xử lý**); để browser-friendly thì **lấy qua ERDDAP**.
- **Dùng ngay:** GIBS = tile-ready (đã dùng). OceanColor/PO.DAAC = **cần xử lý NetCDF** nếu lấy trực tiếp; nên đi vòng qua ERDDAP. Public domain (US Gov), ghi **"NASA"**.

---

## 4. Lớp FRONT — tự tính, vì không ai phát free dạng tile

Front (gradient SST/chl sắc nét) là chỉ báo tụ cá then chốt và **không có nguồn mở nào phát sẵn dưới dạng tile**. ForFish **có thể tự tính** từ raster mở.

### 4.1. Phương pháp nhẹ nhất khả thi (gradient magnitude)

1. **Lấy lưới SST thưa** qua ERDDAP `.json` cho hộp Biển Đông (vd `noaacwBLENDEDsstDNDaily`, stride ~2–5 để có ~5–10 km/ô).
2. **Tính độ lớn gradient** mỗi ô bằng toán tử **Sobel 3×3**: `|∇SST| = sqrt(Gx² + Gy²)` (đơn vị °C/km, chia theo độ phân giải km của lưới).
3. **Ngưỡng** giá trị gradient → ô nào vượt ngưỡng = "front" → overlay (heatmap/đường) lên bản đồ.
4. Làm tương tự cho **chlorophyll** (`noaacwNPPVIIRSchlaDaily`) để có **chl front**.

Đây chính là lõi thuật toán **Belkin–O'Reilly** dùng trong nghiên cứu (median filter ngữ cảnh + Sobel 3×3 gradient magnitude), đã được áp dụng cho **front SST/chl ở Biển Đông quanh đảo Hải Nam** ([Belkin & O'Reilly 2009 — front detection SST & chl](https://www.sciencedirect.com/science/article/abs/pii/S0924796309000682)); và bộ front SST Biển Đông 2015–2022 cho thấy tính khả thi ([MDPI — South China Sea SST Fronts](https://www.mdpi.com/2072-4292/17/5/817)). Phiên bản tối giản (chỉ Sobel + ngưỡng, bỏ median filter) là đủ cho MVP **(giả định về mức "đủ dùng" — cần kiểm thử thực địa)**.

### 4.2. Đánh đổi compute/độ trễ

- **Nhẹ:** lưới thưa (Biển Đông ~15°×18°, stride 5 km → ~vài nghìn ô) → tính Sobel cực rẻ, chạy trong **một API route / cron backend**, cache theo ngày.
- Độ trễ kế thừa nguồn SST (~ngày với geo-polar blended; ~2 ngày với GIBS). Front **không cần real-time** — front di chuyển chậm.
- Lưới càng dày (MUR 1 km) → front sắc hơn nhưng tải dữ liệu + tính nặng hơn; cân bằng ở 5 km cho MVP.
- **Khuyến nghị:** tính server-side (Next.js route / cron), lưu GeoJSON/PNG, client chỉ overlay.

---

## 5. Dòng chảy / SSHA — nguồn browser-friendly

| Nguồn | Lớp | Cách lấy | Ghi chú |
|---|---|---|---|
| **CMEMS** `SEALEVEL_GLO_PHY_L4_NRT_008_046` | **SLA/SSHA + dòng địa chuyển** | **WMTS tile** (mục 1.2) hoặc OPeNDAP | Tốt nhất cho **xoáy tụ cá**, tile-ready |
| **CMEMS** `GLOBAL_ANALYSISFORECAST_PHY_001_024` | dòng chảy mặt (uo, vo), zos | **WMTS tile** | 1/12°, có dự báo 10 ngày |
| **OSCAR** (`jplOscar` qua ERDDAP / PO.DAAC NRT) | dòng chảy mặt | ERDDAP `.json`/`.png`/WMS | 1/3°, 5-day; NRT trễ ~2 ngày ([PO.DAAC OSCAR NRT](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0)) |

- **SSHA dạng tile sẵn:** chỉ **CMEMS** có (qua WMTS). OSCAR không phát SSHA, chỉ dòng chảy.
- **Dùng ngay:** CMEMS = tile-ready; OSCAR qua ERDDAP = giá trị/ảnh (cần xử lý nhẹ nếu vẽ mũi tên dòng chảy động ở client).

---

## 6. Bảng khuyến nghị — nguồn mở tốt nhất cho từng lớp ngư trường

| Lớp dữ liệu (ngư trường) | Nguồn mở tốt nhất | Cách lấy (tile/REST/NetCDF) | Độ trễ | Giấy phép/ghi nguồn | Dùng ngay? |
|---|---|---|---|---|---|
| **SST** (nền) | NASA GIBS (đang dùng) / CMEMS OSTIA / NOAA geo-polar blended | Tile WMTS (GIBS, CMEMS); ERDDAP PNG/JSON (NOAA) | ~1–2 ngày | NASA public domain / "E.U. Copernicus Marine" / "NOAA CoastWatch" | ✅ Tile-ready |
| **SST front** | Tự tính từ NOAA geo-polar blended (ERDDAP) | ERDDAP `.json` → Sobel ở backend → overlay | ~1 ngày | "NOAA CoastWatch" + ghi "front do ForFish tính" | ⚙️ Cần xử lý (nhẹ) |
| **Chlorophyll/plankton** | NASA GIBS (VIIRS) / NOAA VIIRS (ERDDAP) / CMEMS BGC | Tile WMTS (GIBS, CMEMS); ERDDAP (NOAA) | ~1–2 ngày | NASA / "NOAA CoastWatch" / "E.U. Copernicus Marine" | ✅ Tile-ready |
| **Chl/plankton front** | Tự tính từ VIIRS chl (ERDDAP) | ERDDAP `.json` → Sobel ở backend | ~1–2 ngày | "NOAA CoastWatch" + "front do ForFish tính" | ⚙️ Cần xử lý (nhẹ) |
| **SSHA / xoáy** | **CMEMS** `SEALEVEL_GLO_PHY_L4_NRT_008_046` | **Tile WMTS** | ~ngày | "E.U. Copernicus Marine" | ✅ Tile-ready |
| **Dòng chảy mặt** | **CMEMS** PHY_001_024 / SEALEVEL (geostrophic) / OSCAR | Tile WMTS (CMEMS); ERDDAP (OSCAR) | ~ngày–2 ngày | "E.U. Copernicus Marine" / "NASA OSCAR" | ✅ Tile-ready (CMEMS) |
| **Thermocline / FSLE / HAB** | (Không có nguồn tile mở trực tiếp tương đương) | — | — | — | ❌ Ngoài phạm vi MVP **(giả định)** |

---

## 7. Lộ trình "tự chủ lớp ngư trường" (3 bước, không phụ thuộc OceanBytes)

**Bước 1 — Dùng ngay tile có sẵn (tuần này):**
Thêm các lớp **tile WMTS** vào bản đồ: SST/chl từ **GIBS** (đang có) + **SSHA & dòng chảy mặt từ CMEMS WMTS**. Không cần xử lý NetCDF, không cần backend nặng → đã có ~70% giá trị OceanFishMap (mọi lớp trừ "fronts").
*Ghi nguồn:* "E.U. Copernicus Marine Service Information" + "NASA".

**Bước 2 — Giá trị điểm qua ERDDAP (cho tooltip & chuẩn bị front):**
Backend (Next.js route/cron) gọi **ERDDAP `.json`** lấy giá trị SST/chl/dòng chảy theo lat/lon → hiển thị số khi ngư dân chạm vào điểm, đồng thời tạo lưới thưa làm đầu vào cho bước 3.
*Ghi nguồn:* "NOAA CoastWatch".

**Bước 3 — Tự tính lớp front (khác biệt cốt lõi):**
Từ lưới SST/chl của ERDDAP, chạy **Sobel 3×3 → gradient magnitude → ngưỡng** ở backend, cache theo ngày, xuất **GeoJSON/PNG overlay**. Đây là lớp tụ cá then chốt mà OceanFishMap bán sau paywall — ForFish **tự sản xuất từ raster mở**, không phụ thuộc ai.
*Ghi nguồn:* nguồn raster gốc + "Lớp front do ForFish tính (thuật toán gradient kiểu Belkin–O'Reilly)".

Kết quả: chuỗi cung dữ liệu hoàn toàn từ **GIBS + CMEMS + NOAA ERDDAP** → ForFish **không bao giờ phụ thuộc API trả phí của OceanBytes**.

---

### Phân định mức tin cậy
- **Đã kiểm chứng từ docs chính thức:** endpoint & cú pháp WMTS của CMEMS; product ID CMEMS; điều khoản license CMEMS + chuỗi ghi nguồn; cú pháp/định dạng griddap ERDDAP; dataset ID NOAA (`noaacwBLENDEDsstDNDaily`, `jplMURSST41`, `noaacwNPPVIIRSchlaDaily`, `jplOscar`); public domain NOAA; lõi Sobel 3×3 của Belkin–O'Reilly; OSCAR NRT trễ ~2 ngày.
- **Giả định / cần kiểm chứng thêm:** hậu tố phiên bản layer CMEMS thay đổi theo đợt; CC-BY 4.0 có/không áp cho Copernicus Marine sau 02/07/2025; mức "Sobel-only là đủ" cho MVP; không có nguồn tile mở tương đương cho thermocline/FSLE/HAB.
