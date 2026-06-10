# 09 — Nguồn hải đồ MIỄN PHÍ, không khoá, dùng được cho ForFish

> **Mục đích**: Lấp các khoảng trống của hải đồ Trục 1 — **đường đẳng sâu**
> (contour), **luồng/kênh vào cảng**, **số độ sâu điểm** (sounding), **chướng
> ngại vật** (xác tàu) — bằng nguồn không bản quyền, không API key, không
> giới hạn nội dung thương mại. Mỗi nguồn được curl thực tế cho bbox Việt Nam
> lon 102–117 / lat 8–22 ngày tổng hợp **2026-06-10**.
>
> Phạm vi: **bỏ qua** Navionics, C-MAP, IHO ENC chính thức, Garmin BlueChart —
> tất cả đều có licence. Chỉ giữ public-domain, CC, ODbL, government open-data.

---

## 0. Tóm tắt 5 dòng

1. **EMODnet baselayer** đang dùng làm nền độ sâu hoạt động tốt cho VN vì nó
   lùi về **GEBCO 2019 khoảng 500 m bên ngoài châu Âu** — nhưng *các lớp EMODnet
   contour/mean DTM chỉ có dữ liệu ở châu Âu*; WFS contour trả về **0
   feature** cho bbox VN. Đừng chuyển sang `emodnet:contours`.
2. **OpenSeaMap depth contour WMS** (https://depth.openseamap.org) phủ TOÀN
   CẦU dùng dữ liệu GEBCO — kéo về bbox VN 102–117/8–22 ra **đường đẳng sâu
   1000 m / 2000 m / 5000 m** nhãn rõ (curl thực tế trả 93 kB PNG có nội
   dung). Là nguồn contour DUY NHẤT phủ Biển Đông không licence.
3. **GEBCO 2024 WMS** (https://wms.gebco.net/2024/mapserv) trả ảnh shaded
   relief đầy đủ cho bbox VN (141 kB PNG, đẹp hơn EMODnet baselayer ở chi
   tiết). Có thể đóng vai trò backup hoặc lớp "đáy biển" có cảm giác 3D.
4. **OpenStreetMap qua Overpass API** chứa **607 đèn biển, 1167 phao/cọc
   báo hiệu, 150 cảng & cầu cảng, 13 xác tàu** trong bbox VN — đây là dữ
   liệu VECTOR có thể tải về làm overlay GeoJSON, mảnh hơn nhưng tự kiểm
   soát style, không phụ thuộc tile server bên thứ ba. OpenSeaMap seamark
   tile (đang dùng) chính là render từ tập tag này.
5. **Không tìm thấy nguồn miễn phí cho số độ sâu điểm (spot soundings) và
   contour 10/20/50/100/200 m phủ VN.** NOAA ENC chỉ phủ Mỹ. Cục Hàng hải
   VN (VinaMarine) không có open-data WMS. Đây là khoảng trống cấu trúc
   của open-data hàng hải khu vực — phải chọn: (a) tô shaded relief từ
   GEBCO + ETOPO (đã đóng gói) để bà con nhìn được gò/rạn, (b) chấp nhận
   không có chữ số độ sâu, (c) tự nội suy contour từ GeoTIFF GEBCO 2024
   nếu cần — task lớn, không trong scope ngay.

---

## 1. Khẩu vị: tại sao "không licence" lại khó

Hải đồ chính thức trên thế giới đều thuộc một trong ba khối:

- **Cơ quan thuỷ đạc quốc gia** (UKHO Admiralty, NOAA, Hải quân VN…). NOAA
  *là* miễn phí và public domain, **nhưng chỉ phủ vùng biển Mỹ**. Các nước
  khác phần lớn tính phí qua hệ thống ENC IHO.
- **Vendor thương mại** (Navionics/Garmin, C-MAP/Wärtsilä, OpenCPN cài cắm
  raster RNC mua riêng). Tất cả licence chặt.
- **Open-data khoa học** (GEBCO, EMODnet, AusSeabed…). Public domain hoặc CC,
  **nhưng độ phân giải thấp** — đủ để vẽ đường đẳng sâu sâu (≥100 m), không
  đủ cho hải đồ vào cảng (cần 1–2 m).

Vì lý do trên, **ForFish không thể có hải đồ vào cảng đúng chuẩn miễn phí**.
Bù lại có hai cách dùng được: (i) OpenStreetMap nautical tag (vector) cho
phao đèn + luồng đã được người dùng map, (ii) shaded relief đáy biển từ
GEBCO cho cảm giác địa hình. Cả hai đã đủ cho bà con đi câu/lưới rê *biết*
hình thù đáy chứ không phải để *cập cảng đêm*.

---

## 2. Nguồn đã kiểm tra thực tế cho bbox VN (102–117 E, 8–22 N)

### 2.1 EMODnet — Bathymetry tile services

| Endpoint | URL | VN? |
|---|---|---|
| WMTS baselayer (đang dùng) | `https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png` | **Có** — 141 kB ở z=6, dùng GEBCO 2019 cho ngoài EU |
| WMTS mean_atlas_land_latest | `https://tiles.emodnet-bathymetry.eu/latest/mean_atlas_land/web_mercator/{z}/{x}/{y}.png` | **Không** — 854 byte (transparent) cho VN |
| WMTS mean_multicolour 2022 | `https://tiles.emodnet-bathymetry.eu/v11/mean_multicolour/web_mercator/{z}/{x}/{y}.png` | **Không** — 854 byte cho VN |
| WMS `emodnet:contours` | `https://ows.emodnet-bathymetry.eu/wms?...layers=emodnet:contours` | **Không** — WFS GetFeature trả 0 contour cho bbox VN; xác minh sang bbox EU (50–55 N, –2 E…) cũng cho ra contour có nội dung. Là dataset *European waters only*. |

**Kết luận EMODnet**: giữ nguyên `baselayer` đang dùng — đó là cách EMODnet
phủ toàn cầu (đè lên GEBCO). Đừng chuyển lớp khác kỳ vọng có contour cho VN.

License: **CC-BY 4.0**. Attribution string yêu cầu: *"EMODnet Bathymetry
Consortium (2024): EMODnet Digital Bathymetry (DTM)."*

Gotchas:
- Tile matrix set `web_mercator` mới được EMODnet thêm cho 2022/latest;
  bản 2020 (đang dùng) đã có sẵn.
- Có CORS header (đã thấy `access-control-allow-origin: *` trên CDN).
- Max native zoom ~10 (đã đặt đúng trong `ocean-map.ts`).

### 2.2 GEBCO 2024 — WMS shaded relief

Endpoint: `https://wms.gebco.net/2024/mapserv?`
Layer: `GEBCO_2024_Grid` (relief + colour) hoặc `GEBCO_2024_2` (flat colour).

URL mẫu (tile tạm thời, dùng MapLibre raster source kiểu WMS):

```
https://wms.gebco.net/2024/mapserv?service=WMS&version=1.3.0&request=GetMap&layers=GEBCO_2024_Grid&styles=&crs=EPSG:3857&width=256&height=256&format=image/png&bbox={bbox-epsg-3857}
```

Verify: bbox VN 8,102,22,117 trả **141 700 byte** PNG có nội dung shaded
relief đẹp (thấy rõ rãnh sâu phía đông + cao nguyên ngầm Hoàng Sa).

License: GEBCO compilation under **public-domain-like terms** (CC-BY style
recommended) — *"Imagery reproduced from the GEBCO_2024 Grid, GEBCO
Compilation Group (2024) doi:10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f"*.

> GEBCO's own ToS: *"The imagery within this WMS should not be used for
> navigation or for any purpose relating to safety at sea."* — đã có sẵn
> footer "Không dùng cho an toàn hàng hải" trong app, ổn.

Gotchas:
- **Không có WMTS / XYZ** — chỉ WMS GetMap. MapLibre vẫn dùng được qua
  `type: 'raster'` với template URL có `{bbox-epsg-3857}` và `tileSize: 256`,
  nhưng ít cache-friendly hơn WMTS.
- Có 3 chế độ tile region (global, north-polar, south-polar) — dùng cái
  global `https://wms.gebco.net/2024/mapserv`.
- Đường đẳng sâu **không có sẵn** ở dạng vector — chỉ tô màu/shading.
  Muốn contour phải đi qua nguồn khác (OpenSeaMap depth) hoặc nội suy từ
  GeoTIFF `data.source.coop/alexgleith/gebco-2024`.

### 2.3 OpenSeaMap — depth contour WMS (TÌM RA QUAN TRỌNG NHẤT)

Endpoint: `https://depth.openseamap.org/geoserver/openseamap/wms`
(cũng có sẵn ở `https://depth.openseamap.org/cgi-bin/mapserv.fcgi`).

Layer: `openseamap:contour` — *contour với nhãn số độ sâu in trực tiếp*.
Phụ: `openseamap:contour2`, `openseamap:contoursplit` (chia khoảng khác).

URL mẫu:

```
https://depth.openseamap.org/geoserver/openseamap/wms?service=WMS&version=1.1.1&request=GetMap&layers=openseamap:contour&srs=EPSG:4326&bbox={minlon},{minlat},{maxlon},{maxlat}&width=512&height=512&format=image/png&transparent=true
```

Verify: bbox VN rộng 102–117/8–22 trả **93 625 byte** PNG: thấy rõ
đường 1000 m, 2000 m, 5000 m với nhãn dọc rãnh Manila và phía đông Trường
Sa, dọc thềm lục địa VN tới Cà Mau. Đường được vẽ bằng dataset **GEBCO**
nên phủ toàn cầu.

Gotchas (rất quan trọng):
- **Contour interval mặc định** = 1000/2000/5000 m (dùng cho đại dương);
  *KHÔNG có đường 10/20/50/100/200 m như Navionics cho thềm lục địa*. Đây
  là giới hạn dữ liệu nguồn (GEBCO ~500 m grid), không khắc phục được.
  Lớp `contour2` thử ra mỏng hơn nhưng vẫn cùng grid.
- **Render theo scale rule trong GeoServer**: bbox quá nhỏ (zoom cao,
  vài độ vĩ tuyến) GeoServer ẩn contour → ra PNG trắng. Khắc phục: bật
  lớp này CHỈ ở zoom 4–8 (xem khung biển khơi); zoom ≥9 ẩn đi (đỡ rối khi
  bà con xem gần bờ).
- **WMS không phải WMTS** — phải truyền `{bbox}` thay vì `{z}/{x}/{y}`.
  MapLibre vẫn nhận, nhưng cache sẽ kém hơn tile WMTS.
- License: ODbL (dữ liệu OSM) + GEBCO public terms. Attribution:
  *"Depth contours: OpenSeaMap (depth.openseamap.org) © OSM contributors,
  derived from GEBCO."*
- CORS: chưa kiểm tra rõ; cần curl thêm `Origin:` để xác nhận, nếu chặn
  phải proxy qua Next.js route handler.

### 2.4 OpenSeaMap — seamark tile (đã dùng, giữ nguyên)

URL: `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png`
(mirror: `https://t1.openseamap.org/seamark/{z}/{x}/{y}.png`)

Verify VN: lighthouses + buoys + harbours hiện rõ ở zoom ≥12 quanh Vũng
Tàu, Hải Phòng, Đà Nẵng (tile ~540 byte có nội dung vs 334 byte transparent).

Vì OpenSeaMap render từ OSM, **không có chính thức Vung Tau buoy chart**
nhưng cộng đồng đã map khá nhiều — Overpass API đếm thực tế:
- **607** lighthouses (`seamark:type=light_*` hoặc `man_made=lighthouse`)
- **1167** buoy/beacon nodes (`seamark:type=^buoy_*` hoặc `^beacon_*`)
- **150** harbour features (75 nodes + 75 ways, `seamark:type=harbour`
  hoặc `harbour=yes`)
- **13** wrecks (`seamark:type=wreck`)
- **5** ways `seamark:type=fairway|recommended_track|navigation_line|
  waterway=fairway` — luồng vào cảng *gần như chưa được map* cho VN.

License: ODbL. CORS đã có (`Access-Control-Allow-Origin: *`). Có hai
mirror — nên fallback giữa `tiles.openseamap.org` và `t1.openseamap.org`.

Gotchas: tile server đôi khi chậm/đứng (vài giờ); cần `errorTileUrl`
trong MapLibre hoặc retry.

### 2.5 OpenStreetMap qua Overpass API — vector overlay

Endpoint: `https://overpass-api.de/api/interpreter` (POST JSON or
GET `?data=...`). Phải gửi `User-Agent`.

Pattern: chạy server-side (Next.js route handler) khi user di chuyển bản
đồ, cache trong KV/Redis, trả GeoJSON về client. **Không gọi trực tiếp
từ browser ở scale toàn VN** — server công cộng giới hạn ~10 000 nodes
mỗi query, dễ rate-limit.

Ví dụ query đèn biển VN:

```overpass
[out:json][timeout:25];
(node["seamark:type"~"^light"](8,102,22,117);
 node["man_made"="lighthouse"](8,102,22,117););
out body geom;
```

License: ODbL. Attribution: *"Báo hiệu hàng hải: © OpenStreetMap
contributors (ODbL)"*.

Có 4 mirror chính (`overpass-api.de`, `overpass.kumi.systems`,
`maps.mail.ru/osm/tools/overpass`, `lz4.overpass-api.de`) — fallback round-
robin nếu cần.

### 2.6 NOAA — Chart Display Service / ENC

Endpoint REST: `https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/
ENCOnline/MapServer/exts/MaritimeChartService/WMSServer`

**Phạm vi: VÙNG BIỂN MỸ** (US-flagged ENC cells). Verify: gọi GetMap với
bbox VN trả về HTML lỗi không phải PNG hợp lệ. Không sử dụng cho ForFish.

(Để tham khảo: nếu sau này muốn tra cứu vùng giáp Mỹ — Philippines,
Indonesia, Đài Loan — NOAA có một số "INT" charts nhưng không phủ Biển Đông.)

### 2.7 AusSeabed — bathymetry portal

Phủ chính: vùng biển Úc + nam Indonesia. Một số compilation regional ở
biển Đông Sumatra nhưng không vươn tới Biển Đông Việt Nam. **Không
phù hợp với VN.** Để link tham khảo, không thêm tile.

### 2.8 Source.coop GEBCO_2024 COG

URL: `https://data.source.coop/alexgleith/gebco-2024/GEBCO_2024_sub_ice_topo_<n>.tif`

Là Cloud-Optimised GeoTIFF của GEBCO 2024. **Không phải tile server XYZ**
— không dùng trực tiếp được trong MapLibre raster source. Có thể:
- Đọc qua `titiler` hoặc `cog-tile` self-hosted (Cloudflare Workers) để
  sinh tile theo yêu cầu.
- Nội suy đường đẳng sâu (gdal_contour) offline thành GeoJSON, đóng gói
  với app — kiểu dữ liệu này lý tưởng để **bổ sung contour 50/100/200 m**
  cho thềm lục địa VN nếu cần (việc lớn, không trong scope hôm nay).

License: GEBCO (public-domain-like, attribution required).

### 2.9 Natural Earth raster

Public domain hoàn toàn. **Không có tile server chính thức miễn phí** —
phải tự host. Stadia/Stamen có tile từ NE nhưng đã chuyển sang paid model.
Nếu muốn dùng cho lớp "trang trí" zoom thấp, đóng gói raster 1:10m vào
public folder và serve qua `/tiles/naturalearth/{z}/{x}/{y}.png` (pre-render).

**Không khẩn cấp** cho ForFish — Carto Voyager đang phủ zoom thấp đẹp rồi.

### 2.10 Global Maritime Traffic Density Service (GMTDS)

Endpoint chính: https://globalmaritimetraffic.org/ — viewer browser-based,
WMS chỉ cấp **theo yêu cầu** (apply form). Không public XYZ.

Là dữ liệu **density tích luỹ ~10 năm AIS** chia ô 1 km². Cực kỳ giá trị
cho overlay "ngư trường nào tàu cá hay đi". Nhưng phải xin license/quota.
**Không dùng ngay; ghi nhận cho roadmap.**

### 2.11 AISHub / aishub.net

Crowdsourced AIS exchange. **Yêu cầu đóng góp dữ liệu của bạn để nhận**
(cần một AIS receiver tự host) → không phù hợp với ForFish web app. Bỏ qua.

### 2.12 VinaMarine / Cục Đo đạc bản đồ VN

Trang web `vinamarine.gov.vn` chỉ có thông báo hành chính, không có open-
data WMS. Cục Đo đạc Bản đồ và Thông tin Địa lý VN có cổng map.vietgis
nhưng yêu cầu đăng nhập và không phục vụ ngư dân. **Không có nguồn open-
data hải đồ VN chính thống tại thời điểm 2026-06.**

### 2.13 Heidelberg ASTER contour (`korona.geog.uni-heidelberg.de`)

Được tham chiếu trong dependencies cũ của OpenSeaMap online_chart, nhưng
tới 2026-06 server **không phản hồi** (timeout cả http/https). Dịch vụ này
chỉ là contour ĐẤT LIỀN (ASTER GDEM) — không phải hải đồ. Bỏ qua.

---

## 3. Vùng trống thực sự còn lại

| Mong muốn của bà con / Navionics | Có nguồn open-data không? |
|---|---|
| Đường đẳng sâu 10/20/50 m vào cảng | **Không** — GEBCO grid ~500 m không đủ resolve. Các nước EU có EMODnet 125 m nhưng VN không nằm trong. |
| Đường đẳng sâu 100/200 m thềm lục địa | **Có thể** — nội suy từ GEBCO 2024 COG → GeoJSON, đóng gói app (~5–20 MB) |
| Đường đẳng sâu 1000/2000/5000 m biển khơi | **Có** — OpenSeaMap depth WMS (mục 2.3) |
| Số độ sâu điểm (spot soundings) | **Không miễn phí cho VN** |
| Luồng/kênh vào cảng (channel/fairway) | **Rất thưa** — OSM mới có 5 way cho VN. Có thể vẽ tay 6–8 luồng lớn (Hải Phòng, Hòn Gai, Đà Nẵng, Quy Nhơn, Nha Trang, Vũng Tàu, Định An, sông Hậu) làm GeoJSON nội bộ. |
| Safety depth tô màu theo mớn tàu | **Có thể** — đã có ETOPO đóng gói + depth-grid.ts; chỉ cần style fill theo ngưỡng |
| Xác tàu (wrecks) | **Có** — OSM Overpass: 13 wreck nodes cho VN; bổ sung lớp vector hiển thị icon |
| Phao + đèn biển | **Có** — OpenSeaMap tile (đã dùng) + OSM Overpass (1700+ điểm) |

---

## 4. Recommended stack — đưa vào `src/lib/ocean-map.ts`

Bảng theo *thứ tự ưu tiên triển khai*. Cột "Có gì" mô tả nội dung sau khi
verify thực tế cho bbox VN.

| Lớp | Nguồn | URL tile | Min/Max zoom | License | Phủ VN? | Có gì |
|---|---|---|---|---|---|---|
| 1. Nền độ sâu (đang dùng — GIỮ) | EMODnet baselayer 2020 | `https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png` | 0 / 10 | CC-BY (EMODnet) | Có (qua GEBCO 2019) | Tô màu đáy biển toàn cầu, đại dương + đất liền |
| 2. Phao đèn (đang dùng — GIỮ) | OpenSeaMap seamark | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | 9 / 18 | ODbL (OSM) | Có (607 đèn + 1167 phao) | Phao, đèn biển, harbour icon — render OSM tag |
| 3. **Đường đẳng sâu sâu** (MỚI) | OpenSeaMap depth contour WMS | `https://depth.openseamap.org/geoserver/openseamap/wms?service=WMS&version=1.1.1&request=GetMap&layers=openseamap:contour&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true` | 4 / 8 | ODbL + GEBCO | **Có** (1000/2000/5000 m) | Đường đẳng sâu có nhãn số mét — chỉ deep ocean, hiển thị khi xem cả Biển Đông |
| 4. **Xác tàu** (MỚI, vector) | OSM Overpass | POST `https://overpass-api.de/api/interpreter` với query `node["seamark:type"="wreck"](bbox)` — proxy qua `/api/wrecks?bbox=` (server-side, cache 24 h) | 8 / 18 | ODbL | Có (13 wrecks) | Icon ⚓ + tooltip; cảnh báo khi route đi qua |
| 5. **Đèn biển có vùng chiếu sáng** (MỚI, vector) | OSM Overpass | tương tự, query `man_made=lighthouse` + `seamark:light:*` | 9 / 18 | ODbL | Có (607) | Tô vùng quét đèn theo `seamark:light:range`/`sector` — phụ trợ cho lúc về đêm |
| 6. **GEBCO shaded relief** (TÙY CHỌN, basemap thay thế) | GEBCO 2024 WMS | `https://wms.gebco.net/2024/mapserv?service=WMS&version=1.3.0&request=GetMap&layers=GEBCO_2024_Grid&crs=EPSG:3857&width=256&height=256&format=image/png&bbox={bbox-epsg-3857}` | 0 / 8 | GEBCO public terms | Có | Backup nền độ sâu nếu EMODnet down; chi tiết relief hơn |
| 7. Contour 100/200 m từ GEBCO COG (FUTURE) | nội suy offline từ GeoTIFF | đóng gói GeoJSON tĩnh `/contours-vn-100m.json` (~10 MB gzip) | 5 / 12 | GEBCO public terms | Có | Đường thềm lục địa VN cho route-planner cảnh báo "ra khỏi thềm" |
| 8. Luồng vào cảng (FUTURE, nội bộ) | tự vẽ tay từ ảnh hải đồ giấy chính thức + xác minh với cảng vụ | GeoJSON tĩnh `/fairways-vn.json` | 9 / 18 | Tự tạo (CC-BY-NC) | — | Vẽ 6–8 luồng cảng lớn để dẫn tàu khỏi cạn |

**Attribution string mới** (cập nhật trong `ocean-map.ts`):

```
"Ảnh: NASA · Độ sâu: EMODnet/GEBCO · Đẳng sâu: OpenSeaMap (depth.openseamap.org) · Phao đèn & xác tàu: © OpenStreetMap (ODbL) · Nền: © OpenStreetMap © CARTO · Dự báo: Open-Meteo"
```

---

## 5. Top 3 nguồn nên cắm vào ngay (priority order)

### #1 — OpenSeaMap depth contour WMS (lớp 3 ở bảng trên)

Lý do: là nguồn DUY NHẤT có **đường đẳng sâu nhãn số** phủ Biển Đông không
licence. Cắm thêm 30 dòng vào `buildMapStyle()` là xong:

```ts
sources["depth-contours"] = {
  type: "raster",
  tiles: [
    "https://depth.openseamap.org/geoserver/openseamap/wms" +
    "?service=WMS&version=1.1.1&request=GetMap" +
    "&layers=openseamap:contour&srs=EPSG:3857" +
    "&bbox={bbox-epsg-3857}&width=256&height=256" +
    "&format=image/png&transparent=true",
  ],
  tileSize: 256,
};
layers.push({
  id: "depth-contours",
  type: "raster",
  source: "depth-contours",
  minzoom: 4,
  maxzoom: 8, // ẩn khi gần bờ — contour 1000 m vô nghĩa ở cảng
  paint: { "raster-opacity": 0.7 },
});
```

Rủi ro nhỏ: CORS chưa xác nhận. Nếu chặn → proxy qua route handler
`/api/tile-proxy/depth/{bbox}` 5 dòng code.

### #2 — Lớp xác tàu (wrecks) vector từ OSM Overpass

Lý do: 13 xác tàu trong vùng biển VN — quan trọng cho an toàn route-planner.
Đã có `route-plan.ts` chặn theo độ sâu, thêm một check "trong 500 m của
wreck" thì đơn giản. Triển khai:

1. Route handler `/api/wrecks?bbox=` chạy Overpass query với cache 24 h.
2. Source `wrecks` vector trong MapLibre, icon ⚓ nhỏ ở zoom ≥10.
3. Tích hợp vào `route-plan.ts`: nếu polyline đi qua trong 500 m của wreck
   → cảnh báo "Có xác tàu gần tuyến".

### #3 — GEBCO 2024 WMS làm fallback basemap

Lý do: EMODnet baselayer là single point of failure (đã thấy chậm, đôi khi
tile cũ). GEBCO WMS là backup public-domain-like *cùng dữ liệu nguồn*. Cắm
qua flag `OCEAN_LAYERS.bathymetry.tilesFallback` để client tự retry khi
EMODnet 5xx liên tiếp.

---

## 6. Nguồn tham khảo (đã curl thực tế ngày 2026-06-10)

- EMODnet WMTS capabilities: https://tiles.emodnet-bathymetry.eu/wmts/1.0.0/WMTSCapabilities.xml
- EMODnet WMS GetCapabilities: https://ows.emodnet-bathymetry.eu/wms?request=GetCapabilities
- EMODnet WFS contours: https://ows.emodnet-bathymetry.eu/wfs (0 feature cho VN bbox — xác minh)
- GEBCO WMS docs: https://www.gebco.net/data-products/gebco-web-services/web-map-service
- GEBCO 2024 WMS endpoint: https://wms.gebco.net/2024/mapserv
- GEBCO COG (source.coop): https://source.coop/alexgleith/gebco-2024
- OpenSeaMap dependencies: https://github.com/OpenSeaMap/online_chart/blob/master/dependencies.md
- OpenSeaMap depth: https://depth.openseamap.org/ (WMS GetCapabilities 323 kB, layer `openseamap:contour`)
- OpenSeaMap seamark tile: https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png
- OpenStreetMap Marine navigation tag wiki: https://wiki.openstreetmap.org/wiki/Marine_navigation
- Overpass API: https://overpass-api.de/api/interpreter
- NOAA NCDS (US only): https://nauticalcharts.noaa.gov/updates/coast-survey-launches-noaa-chart-display-service/
- AusSeabed (Úc only): https://www.ausseabed.gov.au/data
- GMTDS (apply for access): https://globalmaritimetraffic.org/
- VinaMarine portal (không có open data): https://www.vinamarine.gov.vn/

## 7. Test commands (đã chạy trước khi viết)

```bash
# EMODnet tiles status
curl -sI https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/6/51/29.png
#  → 200 OK, 141 663 byte PNG (Vietnam content visible)

# EMODnet contours empty for VN
curl -s "https://ows.emodnet-bathymetry.eu/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=emodnet:contours&bbox=8,102,22,117,EPSG:4326&count=5&outputFormat=application/json"
#  → numberMatched: 0

# OpenSeaMap depth contour for VN
curl -s "https://depth.openseamap.org/geoserver/openseamap/wms?service=WMS&version=1.1.1&request=GetMap&layers=openseamap:contour&srs=EPSG:4326&bbox=102,8,117,22&width=512&height=512&format=image/png&transparent=true"
#  → 93 625 byte PNG with 1000/2000/5000 m contour labels in Vietnam waters

# GEBCO 2024 WMS for VN
curl -s "https://wms.gebco.net/2024/mapserv?service=WMS&version=1.3.0&request=GetMap&layers=GEBCO_2024_Grid&bbox=8,102,22,117&crs=EPSG:4326&width=512&height=512&format=image/png"
#  → 141 700 byte PNG with detailed shaded relief

# Overpass counts for VN bbox
#  → 607 lighthouses, 1167 buoys+beacons, 150 harbour features, 13 wrecks, 5 fairway ways
```
