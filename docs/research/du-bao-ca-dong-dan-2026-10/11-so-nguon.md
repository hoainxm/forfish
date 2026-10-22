# 11 — Sổ nguồn đã thử thật cho "Dòng Dẫn" (2026-10-22, curl từ Mac)

**Load khi / Load when**: trước khi tải thêm dữ liệu cho bất kỳ vòng nào của dự báo cá (chl, gió lưới, mặt cắt cổng, SSH, chỉ số khí hậu, sản lượng nhiều năm) — để không dò lại nguồn đã hỏng và biết thay bằng gì. Agent Sonnet thử; lead tự thử lại OC-CCI (PIFSC ERDDAP) và kho Zarr ẩn danh của Copernicus Marine (GLORYS12, chl gap-free) — đều chạy. Script tải hiện có: `scripts/dong-dan/`.


Hộp NTB = 8-15°N x 106-115°E. "KC" = đã chạy hôm nay. Không đăng ký tài khoản nào, không in khoá.
Phát hiện lớn: **Copernicus Marine có kho ARCO Zarr đọc ẩn danh (không tài khoản, không khoá)** cho cả bộ tái phân tích nhiều năm, không chỉ bộ dự báo app đang dùng. Cách tìm URL: STAC `https://stac.marine.copernicus.eu/metadata/<PRODUCT>/<DATASET>/dataset.stac.json`, lấy href `geoChunked.zarr` (chunk theo vùng, đọc chuỗi thời gian một ô rất rẻ) hoặc `timeChunked.zarr`.

## (a) CHẠY ĐƯỢC NGAY, KHÔNG TÀI KHOẢN

| Nhu cầu | Nguồn + URL đã chạy | Biến / phủ | Giấy phép | Chủ quyền | Dung lượng NTB x toàn chuỗi |
|---|---|---|---|---|---|
| 1 Chl-a | **ESA OC-CCI v6.0 qua ERDDAP PIFSC (NOAA)**: `https://oceanwatch.pifsc.noaa.gov/erddap/griddap/esa-cci-chla-8d-v6-0.nc?chlor_a[(2024-06-01):1:(2024-06-01)][(15):1:(8)][(106):1:(115)]` (200, 161 KB, 2 s). Cùng gốc có `esa-cci-chla-monthly-v6-0` (.csv thử được, 28 494/36 673 ô có số). Danh mục: `.../erddap/search/index.csv?searchFor=chla` | chlor_a mg/m3, 4 km (0,0417°), **8 ngày và tháng, 1997-09 -> 2026-06**, toàn cầu; lat sắp giảm dần trong truy vấn (15 rồi 8) | "ESA CCI Data Policy: free and open access" + ghi nguồn. Dùng bán được (cần ghi nguồn) | không ép tên | ~140 KB/mốc, 13 mốc = 1,8 MB; 8 ngày x 29 năm ~1 300 mốc ~ 180 MB |
| 1 Chl-a | **CMEMS OC gap-free hằng NGÀY** (đã lấp mây), anonymous S3: `https://s3.waw3-1.cloudferro.com/mdl-arco-geo-043/arco/OCEANCOLOUR_GLO_BGC_L4_MY_009_104/cmems_obs-oc_glo_bgc-plankton_my_l4-gapfree-multi-4km_P1D_202603/geoChunked.zarr` ; chunk `CHL/0.153.435` (200, 1,5 MB, 2 s) phủ ~12,0-13,3°N x 109,3-110,6°E, 1915 ngày/chunk | CHL, CHL_uncertainty, flags; 4 km; **1997-09-04 -> 2026-10-14**, 10 633 ngày. Dạng gần-thời-gian thực: `mdl-arco-geo-044/.../OCEANCOLOUR_GLO_BGC_L4_NRT_009_102/..._P1D_202311/geoChunked.zarr` (2023-10 -> 2026-10-20) | Copernicus Marine: dùng tự do kể cả thương mại, ghi nguồn [GĐ: chưa trích câu chữ hôm nay] | không ép tên | ~(9°/0,667° ~14)^2 ~ 190 chunk x 1,5 MB ~ 0,3 GB cho đủ chuỗi |
| 1 Chl-a (VIIRS) | `noaa_snpp_chla_daily` cùng ERDDAP PIFSC: có 2012-01 -> 2026-10-10, 0,0375°; "redistributed and used without restriction" (câu hỏi truy vấn con chạy nhưng ô thử toàn NaN do mây) | chlor_a ngày, có khe mây | công thuộc | không | nhỏ |
| 2 Gió | **CMEMS WIND_GLO_PHY_L4_MY_012_006** (scatterometer + ERA5 hiệu chỉnh), hai bộ nối nhau: 0,25° giờ **1994-06 -> 2009-10**: `mdl-arco-geo-049/arco/WIND_GLO_PHY_L4_MY_012_006/cmems_obs-wind_glo_phy_my_l4_0.25deg_PT1H_202406/geoChunked.zarr`, chunk `eastward_wind/0.102.290` (200, 365 KB); 0,125° giờ **2007-01 -> 2026-06**: `mdl-arco-geo-062/.../cmems_obs-wind_glo_phy_my_l4_0.125deg_PT1H_202211/geoChunked.zarr`, chunk `eastward_wind/0.204.580` (200, 362 KB, 18 567 giờ/chunk, ô 4x4) | eastward/northward_wind, stress, **wind_curl, wind_divergence, stress_curl**, bias/sdd. Nên tính tương hợp 2007-2009 khi nối | Copernicus Marine tự do (như trên) | không | chunk 4x4 ô, 2 năm giờ/chunk ~ 0,36 MB; hộp NTB 9° ~ 72x72 ô ~ 330 chunk/biến ~ 120 MB/biến toàn chuỗi. **Thay Open-Meteo, không bị chặn 429** |
| 2 Gió (phương án 2) | **CCMP v3.1 RSS**: `https://data.remss.com/ccmp/v03.1/Y2020/M01/CCMP_Wind_Analysis_20200101_V03.1_L4.nc` (HEAD 200, 33,6 MB/ngày, HDF5, có Range) ; có cả file tháng `..._202001_monthly_mean_V03.1_L4.nc` 16,6 MB. Hiện có tới Y2026 (cập nhật 14/10/2026) | 0,25°, 6 giờ, 1993 -> nay | CC BY 4.0 ("licensed under a Creative Commons Attribution 4.0", trang v3.0) | không | cả cầu 33 MB/ngày x 12 000 ngày ~ 400 GB: KHÔNG tải cả; cần đọc Range (chưa thử: máy không có h5py/netCDF4) |
| 2 Gió (phương án 3) | **ERA5 ARCO Google** (HTTP công khai): `https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3/` (`.zattrs`: 1940-01 -> 2026-06-30, ERA5T tới 2026-10-16). Chunk `10m_u_component_of_wind/1000000.0.0` = 200, **3,3 MB, 2 s** | cả cầu mỗi giờ MỘT chunk [1,721,1440] | CC BY 4.0 (ERA5) | không | Lấy 1 giờ/ngày x 45 năm = 16 000 chunk ~ 54 GB egress. Chỉ đáng khi cần biến ERA5 khác (Z500, OLR...). `co/single-level-*` còn tệ hơn (lưới Gauss 542 080 điểm/chunk) |
| 3 Cổng/D20/dòng (mặt cắt) | **GLORYS12 tái phân tích** GLOBAL_MULTIYEAR_PHY_001_030, `mdl-arco-geo-025/arco/GLOBAL_MULTIYEAR_PHY_001_030/cmems_mod_glo_phy_my_0.083deg_P1D-m_202311/geoChunked.zarr` (.zmetadata 200, 17 KB). Chunk `thetao/0.49.69.217` (200, 856 KB), `uo/0.20.69.217`, `vo/..`, `so/..`, `zos/0.69.217` (680 KB), `mlotst/0.69.217` (455 KB) đều 200 | thetao, so, uo, vo (50 mực), zos, mlotst, bottomT, hải băng; 1/12°; ngày; **1993-01-01 -> 2026-09-22**, 12 318 ngày. **Bẫy: trục elevation đảo, chỉ số 49 = mặt, 0 = sâu nhất; chunk trống trả 403 (không phải 404)**. int16 + scale/offset trong `.zattrs` | Copernicus Marine tự do | không | chunk [2081 ngày,1,16,16]; 1 biến 1 mực NTB ~ 49 chunk x ~0,8 MB ~ 40 MB toàn chuỗi; D20 cần ~20 mực x thetao ~ 0,8 GB |
| 4 SSH/xoáy | CMEMS SEALEVEL_GLO_PHY_L4_MY_008_047 (0,125° ngày): STAC 200, `mdl-arco-geo-045/arco/SEALEVEL_GLO_PHY_L4_MY_008_047/cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1D_202411/geoChunked.zarr`; MY đến 2026-05-15. Chưa tải chunk (chưa thử chunk). Thay thế: `zos` của GLORYS12 (đã thử, cùng lưới) | ADT, SLA, dòng địa chuyển | tự do | không | nhỏ |
| 5 Chỉ số | **DMI**: `https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data` (200, 20 KB, 1870 -> 2026, bản tạo 25/7/2026, HadISST). **MJO CPC**: `https://www.cpc.ncep.noaa.gov/products/precip/CWlink/daily_mjo_index/proj_norm_order.ascii` (200, 354 KB, từ 1978, số cuối thật 2026-09-25, sau đó dấu `*****`) | DMI tháng; MJO 10 chỉ số vận tốc thế | công thuộc Mỹ | không | KB |
| 6 Sản lượng | **Ngân hàng Thế giới (từ FAO)**: `https://api.worldbank.org/v2/country/VNM/indicator/ER.FSH.CAPT.MT?format=json&per_page=80` (200; 65 năm 1960-2024; năm 2024 = 3 433 839 tấn) | sản lượng khai thác QUỐC GIA/năm, 1 con số/năm | WDI mặc định CC BY 4.0 [GĐ] | không | KB. Chỉ là nền năm, không có tỉnh/loài |
| OISST/ONI/Niño/PDO/ERA5 Open-Meteo | như anh đã có | | | | |

## (b) CẦN TÀI KHOẢN MIỄN PHÍ (anh Long đăng ký)

| Tài khoản | Ở đâu | Để làm gì | Còn cần không |
|---|---|---|---|
| Copernicus Marine (CMEMS) | data.marine.copernicus.eu | `copernicusmarine` toolbox, subset phía máy chủ. **Hiện KHÔNG cần**: Zarr S3 ẩn danh đủ cho 1, 2, 3, 4 | Chỉ khi cần dataset không có trong ARCO (vd bản 300 m) |
| Copernicus CDS (ECMWF) | cds.climate.copernicus.eu | ERA5 cắt ô phía máy chủ (hàng đợi) thay cho 54 GB chunk toàn cầu | Tùy chọn; chỉ nếu cần biến ERA5 khác |
| NASA Earthdata | urs.earthdata.nasa.gov | OB.DAAC `oceandata.sci.gsfc.nasa.gov/cgi/getfile/...` trả trang đăng nhập 9 KB (HTML), OPeNDAP Hyrax liệt kê được nhưng tải cần đăng nhập [GĐ] | Không cần: đã có OC-CCI và VIIRS |
| FAO FishStat / data.apps.fao.org | fao.org | Cloudflare chặn curl (403 "Just a moment"). Cần tải tay bằng trình duyệt: bộ "Global capture production" CSV | Việc 6 nếu cần theo loài |

## (c) HỎNG / GIỚI HẠN + thay thế

| Nguồn | Kết quả hôm nay | Thay |
|---|---|---|
| coastwatch.pfeg.noaa.gov ERDDAP | HTTP 000, 60 s timeout | oceanwatch.pifsc ERDDAP; coastwatch.noaa.gov/erddap (200 nhưng không thấy bộ chl) |
| upwell.pfeg.noaa.gov | hôm nay 200 nhưng chậm: 2 MB trong 60 s (cờ -L) | dùng PIFSC |
| psl.noaa.gov THREDDS | 503. Nhưng `psl.noaa.gov/gcos_wgsp/...` (DMI) và các trang tĩnh 200; `downloads.psl.noaa.gov/Datasets/ncep.reanalysis/surface/uwnd.sig995.2020.nc` mở được nhưng chậm (3 MB/70 s, quá hạn) | CMEMS wind/ERA5 |
| NCEI THREDDS `uv/daily`, `ncep` | 404 | CCMP/CMEMS wind |
| CEDA OC-CCI v6.0 đường dẫn đoán | 404 | PIFSC/CMEMS |
| oceancolour.org THREDDS | catalog 200, có mục "Ocean Colour - CCI" (chưa vào sâu) | PIFSC đủ |
| polarwatch ERDDAP | 404 với id esa-cci-chla-monthly | PIFSC |
| fao.org, data.apps.fao.org | 403 Cloudflare | World Bank API |
| gso.gov.vn | HTTP 000; trang mới là **nso.gov.vn** (Cục Thống kê, 200). Có trang chỉ tiêu "Sản lượng thủy sản khai thác biển... hằng tháng" phân tổ tỉnh/thành, nhưng chỉ là định nghĩa, **không thấy file số liệu**; số liệu nằm ở Niên giám/PxWeb (chưa tìm) | tải tay xlsx niên giám từng năm |
| Sea Around Us API | `api.seaaroundus.org/api/v1/eez/704/catch?format=json` trả 200 nhưng rỗng/không rõ; trang có "Terms and Conditions", chưa đọc giấy phép | không dùng cho nhãn bán trước khi đọc giấy phép |
| HYCOM | `tds.hycom.org` 200: GLBy0.08/expt_93.0 chỉ 2018-12 -> 2024-09; GLBv0.08/expt_53.X 1994-2015 (chưa thử ô) | GLORYS12 tốt hơn, liền mạch 1993-2026 |
| Open-Meteo 429 | giới hạn đếm theo điểm x ngày | CMEMS wind |
| BoM RMM | cấm thương mại | CPC MJO (trễ ~4 tuần) |
| ORAS5, SODA, JRA-3Q, Kuroshio chỉ số, NOAA Blended Sea Winds | (chưa thử được: không đủ thời gian; NCEI blended `data/blended-global-sea-surface-wind-products/access/` 200 nhưng liệt kê trống) | |

## (d) Thứ tự đề nghị cho vòng sau
1. **Chl-a**: lấy OC-CCI 8 ngày từ PIFSC ERDDAP (.nc, 1 lần ~180 MB cho hộp NTB), dùng gap-free hằng ngày CMEMS làm bản đối chứng/ngày. Việc dễ nhất, giải nhãn thiếu lớn nhất.
2. **Gió**: CMEMS WIND hai bộ (0,25° rồi 0,125°), đọc Zarr chunk 4x4; thay 120 điểm Open-Meteo. Cần script tải đọc `.zattrs` (scale/offset) + blosc lz4 (app đã có bộ giải blosc trong `src/lib/copernicus.ts`).
3. **Mặt cắt/D20/dòng**: GLORYS12 geoChunked, mực mặt = chỉ số 49; viết bảng tra lat/lon -> chunk.
4. SSH/xoáy: dùng `zos` của GLORYS12 trước; SEALEVEL DUACS sau.
5. DMI + MJO CPC: tải ngay (file nhỏ), tự tính RMM/WNPMI từ gió ở bước 2 khi cần.
6. **Nhãn cá nhiều năm là điểm nghẽn thật**: không có nguồn mở máy-đọc-được theo tỉnh. Hỏi anh Long: xin số liệu tỉnh/tháng từ Cục Thống kê hoặc Cục Thủy sản và Kiểm ngư / SDWork; trước mắt dùng sản lượng quốc gia (World Bank) làm chỉ số nền.
