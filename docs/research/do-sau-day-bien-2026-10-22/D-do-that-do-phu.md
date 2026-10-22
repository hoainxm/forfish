# Đo thật 4 nguồn độ sâu cho vùng biển VN — 2026-10-22

Máy đo: Mac, Node 24, Python 3 **không có numpy/h5py/netCDF4/rasterio/GDAL** → mọi phép đo dùng curl + Python thư viện chuẩn (zlib, struct, json). File tải để ở `…/scratchpad/dosau-D/`, không có file nào trong repo. File 88 MB đã xoá sau khi đo.

## Tóm bảng

| Nguồn | Phủ VN ven bờ (lon<110) | Phủ Trường Sa/Hoàng Sa | Tải được không | Kết luận |
|---|---|---|---|---|
| HHU24SWDSCS | **0** (bbox 111,19–117,85°Đ) | 128 đảo/rạn, 29,4 M điểm 10 m | Zenodo, không cần tài khoản, 88 MB | Dùng được ngay về kỹ thuật, nhưng 100 % tên Trung Quốc + rủi ro pháp lý 562/QĐ-TTg |
| ATL24 v2 | 419/251/496/266 granule cho 4 hộp | có (đã đo đợt 08) | **Cần tài khoản Earthdata** (302 → urs.earthdata.nasa.gov) | Cần tài khoản; granule ~220 MB/cái nên phải subset (Harmony/SlideRule) |
| Allen Coral Atlas bathymetry | WMS/WFS/WCS **không có lớp bathymetry**; viewer giấu lớp (`HIDE_LAYERS: ["bathymetry"]`) | geomorphic có (Đá Tây 8 067 px, Song Tử Tây 6 752 px, Trường Sa Lớn 462 px) | Chỉ qua cổng tải có tài khoản | Cần tài khoản; không có đường API |
| GEBCO 2026 TID | Đo thật ô biển: **VBB 2,87 % · Trung Bộ 18,3 % · ĐNB-Mekong 27,9 % · Tây Nam 45,8 %** | Trường Sa 29,7 % · Hoàng Sa 4,2 % | WMS công khai trả TID từng ô; GeoTIFF toàn cầu 96 MB ở CEDA không cần đăng nhập | Dùng được ngay — nhưng GEBCO ở VN chủ yếu là **dự đoán trọng lực vệ tinh (TID 40)** |
| soundings.v1.json (TBHH) | 394 điểm nằm gọn 104,58–109,19°Đ / 8,66–11,88°B; **363 điểm (92 %) ở hộp ĐNB-Mekong** | 0 | — | "Trọng tài" chỉ có ở Nam Bộ; Vịnh Bắc Bộ 0 điểm (chỉ có 106 tuyến luồng) |

---

## 1. HHU24SWDSCS

**Lệnh:** `curl https://zenodo.org/api/records/13852568` · tải `Readme.txt` · tải 64 KB đầu file .nc (`-r 0-65535`) rồi `strings` · tải cả file 88 203 093 byte, kiểm `md5 = 25f105a3cfc4c50eb26b6a4bf520a216` (khớp Zenodo) · quét zlib-stream trong HDF5 bằng Python để moi mảng `islandName` (128 × 18 byte).

**Kết quả:**
- DOI phiên bản `10.5281/zenodo.13852568`, concept `10.5281/zenodo.13852496`; 2 phiên bản cùng ngày 2024-09-28, cùng một file .nc. Giấy phép đúng chữ trong metadata: `"license": {"id": "cc-by-4.0"}`; bài ESSD cũng ghi "distributed under the Creative Commons Attribution 4.0 License".
- 12 tác giả: 10 Hohai University, 1 DTU (Andersen), 1 HUST Vũ Hán.
- **Định dạng**: NetCDF-4/HDF5 (`netcdf=4.9.1, hdf5=1.10.10`), **đám mây điểm, KHÔNG phải lưới**: chiều điểm = 29 404 904; biến `latitude` (degrees_north), `longitude` (degrees_east), `depth` (meters, "seafloor depth"); chiều `island` = 128, `name_strlen` = 18; `islandName/islandLat/islandLon`.
- **Datum**: header file không ghi gì. Bài báo: ngang là toạ độ ICESat-2 (WGS84 ngầm định), **dọc quy về mặt biển trung bình DTU21/DTU22 MSS** ("unified reference datum… DTU22MSS"), có hiệu chỉnh khúc xạ. Không có EGM, không có LAT/chart datum → **không phải số 0 hải đồ**.
- **bbox** (đợt 08 đã đo, lần này xác nhận qua danh sách đảo): lon 111,19–117,85, lat 4,96–20,78. **0 điểm ở lon < 110 ⇒ 0 ô cho Phú Quý, Côn Đảo, Phú Quốc, toàn bộ bờ VN.** Trong hộp 8–17°B 106–118°Đ chỉ có phần Trường Sa (87 đảo/rạn, 57,9 % điểm) và nửa nam Hoàng Sa.
- **Tên địa danh — đo thật đủ 128 tên, 100 % tiếng Trung phiên âm**: Yongxing (Phú Lâm), Taiping (Ba Bình), Nanzi (Song Tử Tây), Beizi (Song Tử Đông), Zhongye (Thị Tứ), Yongshu (Chữ Thập), Chigua (Gạc Ma), Renai (Cỏ Mây), Meiji (Vành Khăn), Huayang (Châu Viên), Xiyue (Bến Lạc), Hongxiu (Nam Yết), Jinghong (Sinh Tồn), Dongmen (Tư Nghĩa)… Một bản ghi lỗi dữ liệu: `"Zhanhan Band\t16.42"`. Bài báo gọi vùng là Xisha/Nansha/Zhongsha/Dongsha; chữ "Vietnam" xuất hiện **0 lần**.
- **Kết luận**: dùng được ngay về kỹ thuật (không tài khoản, CC BY), **không có gì cho ven bờ VN**; nếu đưa vào đường ống phải (a) thay toàn bộ 128 tên, (b) ghi "Hohai University" trong app theo CC BY, (c) đọc lại §5.2 (Quyết định 562) — bản đồ địa hình đảo/bãi ngầm thuộc danh mục bí mật nhà nước.

## 2. ATL24 (NASA ICESat-2 L3A)

**Lệnh:** `curl -I "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL24&version=002&bounding_box=W,S,E,N&page_size=1"` đọc header `CMR-Hits`; rồi `page_size=2000&sort_key=start_date` để lấy ngày và `granule_size`.

| Hộp | bbox | Granule v1 | **Granule v2** | Ngày đầu → cuối (v2) | Tổng cỡ v2 | Cỡ TB/granule |
|---|---|---|---|---|---|---|
| Vịnh Bắc Bộ | 105,5–108 / 18–21,5 | 419 | **419** | 2018-10-16 → 2024-11-06 | 93,9 GB | 224 MB |
| Trung Bộ | 108,5–109,8 / 11–16 | 251 | **251** | 2018-11-02 → 2024-10-25 | 61,2 GB | 244 MB |
| ĐNB–Mekong | 104,5–107,5 / 8–10,8 | 497 | **496** | 2018-10-16 → 2024-11-06 | 108,4 GB | 218 MB |
| Tây Nam–Phú Quốc | 103,5–105 / 8,5–10,5 | 266 | **266** | 2018-10-24 → 2024-10-24 | 54,5 GB | 205 MB |

- Hai collection: v001 `C3433822507-NSIDC_CPRD`, v002 `C4085168939-NSIDC_CPRD`; cả hai `cloud_hosted: true`; không có v003. Số granule mỗi năm ổn định ~40–90/hộp/năm (2019–2023), 2024 ít hơn vì CMR chỉ tới 11/2024.
- **Cảnh báo đọc số**: granule ATL24 là cả một đoạn quỹ đạo dài (polygon mẫu chạy 27°B → 0°), nên "419 granule chạm hộp" **không** có nghĩa là 419 × 224 MB dữ liệu *trong* hộp; phải subset (Harmony, SlideRule `atl24x`, OPeNDAP) — tải nguyên granule là 94–108 GB/hộp.
- **Thử tải không đăng nhập**: `GET https://data.nsidc.earthdatacloud.nasa.gov/nsidc-cumulus-prod-protected/ATLAS/ATL24/002/2018/11/02/ATL24_20181102191925_05370107_006_02_002_01.h5` → **HTTP 302 → urs.earthdata.nasa.gov/oauth/authorize** ⇒ **cần tài khoản Earthdata**, dừng theo đề bài. File `.iso.xml` ở bucket public tải được (21 KB) nhưng không chứa datum/license.
- **Kết luận**: cần tài khoản Earthdata (miễn phí); đường ống GPU cần earthaccess/SlideRule + lọc `confidence`; datum theo tài liệu v2 là WGS84 ellipsoid + `ortho_h` EGM2008 (**chưa kiểm được trong file** vì không tải được).

## 3. Allen Coral Atlas — lớp bathymetry

**Lệnh:** GetCapabilities WMS 1.3.0 / WFS 2.0.0 / WCS 2.0.1 ở `https://allencoralatlas.org/geoserver/ows`; grep layer có chữ "bath"; đọc `__NEXT_DATA__` của `/atlas/`; probe `/tiles/bathymetry/...`; WMS GetMap lớp geomorphic 256×256 quanh 5 điểm; WFS `resultType=hits`.

- WMS 200 (226 KB) chỉ có **2 lớp**: `coral-atlas:benthic_data_verbose`, `coral-atlas:geomorphic_data_verbose`. WFS: 2 feature type như trên. WCS 200 (637 KB) nhưng `<wcs:Contents>` **rỗng, 0 coverage**. **Không có lớp nào tên "bath"** trên cả 3 dịch vụ. `AccessConstraints: CC BY 4.0`, `Fees: NONE`.
- Runtime config của viewer: `"HIDE_LAYERS": ["bathymetry", "labels"]` — lớp bathymetry **bị giấu khỏi bản công khai**. `/tiles/bathymetry/10/821/481.png` → 404; `/api/v2/tiles/bathymetry/...` → 404; GeoServer REST → 401.
- Trang Resources (FAQ) viết rõ: *"Q: Is there bathymetry data available? Yes. Bathymetry data is available for download only."* và *"Sometimes fewer choices are available. This can be due to data licensing restrictions"*. Giấy phép đúng chữ: *"Allen Coral Atlas maps, bathymetry and map statistics are © 2018-2023 Allen Coral Atlas Partnership and Arizona State University and licensed CC BY 4.0"*.
- Đo nhanh lớp geomorphic (thay cho bathymetry, để biết rạn nào có trong Atlas): GetMap 256 px, bbox ~0,13°: Trường Sa Lớn **462 px** có dữ liệu, Phú Quý 4 483, Song Tử Tây 6 752, Đá Tây 8 067 (đối chứng Heron Island GBR 24 822). WFS `resultType=hits` trả `numberMatched="0"` ở MỌI bbox kể cả Heron → WFS hits đang hỏng/không tính, không dùng được để đếm.
- **Kết luận**: bathymetry 10 m **không có qua WMS/WFS/WCS**, chỉ qua cổng tải có tài khoản; định dạng/đơn vị/datum chưa kiểm được. Rạn VN có trong Atlas (geomorphic hiện), nên đáng mở tài khoản tải thử 1 AOI (Đá Tây) ở bước sau.

## 4. GEBCO 2026 TID — con số quan trọng nhất

**Cách lấy được**: ODB NTU `api.odb.ntu.edu.tw/gebco` chỉ trả `z` (openapi 1.1.0: mode row/point/truncate/lon360/zonly/lineid — **không có TID**). Nhưng **GEBCO WMS** `https://wms.gebco.net/mapserv` có 2 lớp `GEBCO_LATEST_TID` (đen = TID 10–17 + 44, còn lại trong suốt) và `GEBCO_LATEST_TID_2` (tô màu theo TID), cả hai `queryable=1` → `GetFeatureInfo … info_format=text/plain` trả `value_list = '40'` cùng tâm ô 15″. Đo: GetMap TID_2 **đúng 240 px/độ** (1 px = 1 ô 15″), giải mã PNG bằng Python thuần, đếm màu, rồi GetFeatureInfo tại 1 pixel mỗi màu để lập bảng màu→TID (vàng=17, xám mờ=40, xanh lá=44, hồng=14, đỏ=11, xanh dương=16, be=0 đất).

| Hộp | Ô biển | TID 40 trọng lực vệ tinh | TID 17 kết hợp đo trực tiếp | TID 44 gián tiếp từ hải đồ | TID 14 ENC | TID 11 multibeam | **Đo thật (10–17 + 44)** | Đo trực tiếp (10–17) |
|---|---|---|---|---|---|---|---|---|
| Vịnh Bắc Bộ | 324 919 | **97,13 %** | 1,00 % | 1,70 % | 0,18 % | 0,00 % | **2,87 %** | 1,18 % |
| Trung Bộ | 210 178 | **81,74 %** | 13,81 % | 4,14 % | 0,28 % | 0,03 % | **18,26 %** | 14,12 % |
| ĐNB–Mekong | 281 309 | **72,13 %** | 25,48 % | 2,11 % | 0,28 % | — | **27,87 %** | 25,76 % |
| Tây Nam–Phú Quốc | 144 940 | **54,24 %** | 43,81 % | 1,94 % | 0,00 % | — | **45,76 %** | 43,82 % |
| (thêm) Trường Sa 8–12°B 111–116°Đ | 1 150 670 | 70,27 % | 2,77 % | 1,05 % | 0,17 % | **25,03 %** | 29,73 % (+TID16 0,71 %) | 28,68 % |
| (thêm) Hoàng Sa 15,5–17,5°B 111–113°Đ | 230 150 | 95,83 % | 0,90 % | 0,93 % | 0,15 % | 0,43 % | 4,17 % (+TID16 1,75 %) | 3,23 % |

Cách đọc: TID 40/41 = **nội suy** (thực chất là ước lượng từ trọng lực vệ tinh, không ai đo); TID 42–44 = gián tiếp từ hải đồ (có số liệu thật đằng sau); 10–17 = đo trực tiếp. Đề bài gộp "40–47 = lidar/chart" là nhầm — lidar là 15, chart là 42–44. Trong hộp ven bờ không thấy TID 41, 42, 43, 70.

- **Ý nghĩa**: Vịnh Bắc Bộ trong GEBCO gần như **toàn bộ là đoán** (97 %); Trung Bộ 82 %; chỉ Tây Nam (vùng nông Kiên Giang–Phú Quốc) có gần nửa ô là đo thật. Dải TID 17 ven bờ nam trùng vùng nông <30 m — nhiều khả năng là lưới khảo sát cũ nộp Seabed 2030. Trường Sa 25 % multibeam là do các chuyến khảo sát nước ngoài ở vùng sâu, không phải quanh rạn.
- Datum (trang gebco.net): "The GEBCO grid can be assumed to be relative to WGS84 … assuming all of them to be referred to Mean Sea Level". Attribution bắt buộc: "GEBCO Bathymetric Compilation Group 2026(2026)… doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa".
- **Tải TID theo bbox**: `download.gebco.net/api/grids` liệt kê data_source `gebco_2026_tid` (`z_name: tid`, `maximum_area: 14400` độ²), formats netcdf/geotiff/ascii; luồng là `POST /api/queue` → basket → `/api/queue/download/{id}` (tôi **không POST** vì là form gửi cho bên thứ ba, chỉ GET để xác nhận). GeoTIFF **toàn cầu** `https://dap.ceda.ac.uk/bodc/gebco/global/gebco_2026/type_identifier_grid/geotiff/gebco_2026_tid_geotiff.zip` HEAD → **200, 96 150 976 byte, không cần đăng nhập** — đường rẻ nhất cho GPU: tải 1 lần, cắt VN.
- **Kết luận**: dùng được ngay, không tài khoản. Nhưng con số nói rằng **GEBCO ở VN không phải "đo được", mà là nền nội suy**; ETOPO→GEBCO chỉ đổi nền đoán này sang nền đoán khác ở Vịnh Bắc Bộ và Trung Bộ.

## 5. public/data/soundings.v1.json (trọng tài TBHH)

`layNgay 2026-09-01` · 18 cảng vụ · 191 thông báo (2019-01-01 → 2026-08-21) · **394 điểm** (`[lon, lat, sâu(dm), idxTB]`, sâu 12–154 dm) · **313 tuyến** (1 392 đỉnh) · 2 365 TB bỏ sót.

- **Điểm**: bbox lon 104,58–109,19 / lat 8,66–11,88. Theo hộp: Vịnh Bắc Bộ **0**, Bắc Trung Bộ 0, Trung Bộ 11, **ĐNB–Mekong 363**, Tây Nam 1, khơi 0. Theo ô 1°: (107,10) 148 · (105,8) 132 · (106,10) 92 · (108,11) 10. Theo cảng vụ: CVHH TP.HCM 199, TCT BĐATHH Miền Nam 162, Đồng Nai 19, Kiên Giang 7, Bình Thuận 5, Nha Trang 1, Cần Thơ 1.
- **Tuyến** (độ sâu luồng): Vịnh Bắc Bộ **106** (Hải Phòng 56, Quảng Ninh 6…), Bắc Trung Bộ 8, Trung Bộ 43, ĐNB 149, Tây Nam 7.
- **Kết luận**: trọng tài điểm chỉ có ở cửa Sài Gòn–Soài Rạp–Vũng Tàu và Trần Đề/Định An; miền Bắc và Trung Bộ chỉ có độ sâu luồng dạng tuyến. Để kiểm GEBCO/ATL24 ở Vịnh Bắc Bộ phải dùng `tuyen`, không có `diem`.

## Gợi ý cho lead (không phải quyết định)

1. **GEBCO TID GeoTIFF toàn cầu (96 MB, CEDA, không login)** → cắt VN, dùng làm **mặt nạ tin cậy** cho lớp độ sâu hiện có; đây là việc rẻ nhất, trả lời được "ô này đo hay đoán".
2. ATL24: mở tài khoản Earthdata, chạy SlideRule `atl24x` theo hộp — không tải granule nguyên.
3. HHU24SWDSCS: 0 giá trị cho ven bờ; chỉ bàn tiếp nếu chấp nhận 3 cảnh báo (tên TQ, attribution Hohai, 562/QĐ-TTg).
4. Allen Coral Atlas bathymetry: cần tài khoản; thử 1 AOI Đá Tây để biết định dạng/datum trước khi tính tiếp.
