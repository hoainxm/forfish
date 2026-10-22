# 04 — Kiểm kê nguồn quan sát/mô hình cho dự báo cá theo "cổng" + chỉ số khí hậu

> Vai: kỹ sư dữ liệu hải dương. Ngày kiểm: 2026-10-22. Không sửa code.
> Đã đọc trước: `docs/research/05-nguon-du-lieu-mo-ngu-truong.md`, `docs/app-map/ops/external-services.md` (CMEMS PHY/SEALEVEL/BGC/OSTIA, NOAA ERDDAP SST/chl/OSCAR, Open-Meteo đã có → không nhắc lại, chỉ nói phần mới).
> Ký hiệu: **[KC]** = đã kiểm chứng (mở được link/đọc được câu giấy phép hôm nay) · **[GĐ]** = giả định, cần kiểm lại · **(chưa kiểm)** = URL chưa mở được.
> Luật áp: dự báo cá là tính năng BÁN → "non-commercial" là **chặn thật**.

## 0. Phát hiện chính (đọc cái này nếu không đọc gì khác)

1. **Không có quan sát tại cổng nào phát tự động, công khai, hằng ngày.** Neo đo dòng ở eo Luzon, eo Đài Loan, Karimata đều là dự án nghiên cứu (dữ liệu xin theo bài báo); HF radar Đài Loan (TOROS, 18 trạm CODAR) **không công khai** — các bài báo ghi rõ "not publicly available… cannot be used for free" / "due to security issues" [KC — MDPI Remote Sensing 2021, tandfonline 2018]. ⇒ "Quan sát ở cổng" thực tế phải là **mặt cắt tính từ mô hình đồng hoá + altimetry**: lấy vận chuyển (transport) qua 6 mặt cắt từ CMEMS GLORYS12 (quá khứ 1993→, để huấn luyện) và GLOBAL_ANALYSISFORECAST_PHY (hiện tại + 10 ngày tới), cộng chỉ số xâm nhập Kuroshio từ chênh lệch ADT (CMEMS SEALEVEL) qua eo Luzon. Đây là nguồn đã có pipeline ARCO trong `/api/fish-forecast` → chi phí tích hợp thấp nhất.
2. **Bẫy giấy phép lớn nhất ở chỉ số khí hậu, không ở dữ liệu biển.** Chỉ số MJO RMM của Cục Khí tượng Úc (BoM) — bản "chuẩn" mà mọi người dùng — theo điều khoản mặc định của BoM: *"You must not supply it to any other person or use it for any commercial purpose"* [KC — reg.bom.gov.au/other/copyright.shtml]; file `rmm.74toRealtime.txt` còn trả 403 cho máy. ⇒ **Tự tính RMM** từ OLR + gió (NOAA, công thuộc) hoặc dùng chỉ số MJO của NOAA CPC.
3. **Global Fishing Watch loại cho dự báo bán**: *"The Services are available for noncommercial use only in accordance with the CC BY-NC 4.0 license"*, và GFW nói rõ giấy phép hiện có không phủ *"integration of our APIs into commercial products"* [KC — globalfishingwatch.org/our-apis/documentation/docs/license-rate-limits].
4. **Bối cảnh khí hậu đang cực đoan**: ONI JAS 2026 = **+2,16** (El Niño mạnh), PDO tháng 9/2026 = **−1,55** [KC — đọc thẳng file NOAA CPC/NCEI hôm nay]. Mô hình dùng ENSO làm biến dẫn sẽ được thử ngay mùa này — nhưng cũng nghĩa là dữ liệu huấn luyện ít mẫu tương tự (El Niño ≥ +2 chỉ có 1982, 1997, 2015, 2023).

## 1. Phao / neo / trạm

| Nguồn | Biến | Vị trí/độ phủ | Phân giải | Trễ | Truy cập | Giấy phép (câu gốc) | Chủ quyền | Độ tin |
|---|---|---|---|---|---|---|---|---|
| **Argo** (GDAC / qua CMEMS INSITU) | T, S theo độ sâu 0–2000 m (BGC-Argo: chl, O₂) | Toàn cầu; Biển Đông thưa (vài chục profile/tháng [GĐ]) | Profile ~10 ngày/phao | NRT ~24 h | argo.ucsd.edu/data [KC 200]; CMEMS `INSITU_GLO_PHYBGCWAV_DISCRETE_MYNRT_013_030` [KC 200]; không key (CMEMS cần tài khoản miễn phí) | *"Argo data are freely available without restriction"* — xin ghi nhận khi dùng trong sản phẩm [KC — argo.ucsd.edu/data/acknowledging-argo] | Không nhãn | Cao (QC chuẩn) |
| **Global Drifter Program** (NOAA AOML) | Vận tốc dòng mặt, SST | Toàn cầu, ~1.300 phao | 1 h / 6 h | **Bộ QC trễ nhiều năm** (`drifter_hourly_qc` hết ở 2022-10-31 [KC]); NRT chỉ qua GTS/CMEMS INSITU | erddap.aoml.noaa.gov/gdp/erddap [KC 200] | `license`: *"Creative Commons Attribution 4.0"* [KC — thuộc tính NC_GLOBAL của `drifter_hourly_qc`] | Không | Cao — chỉ dùng **huấn luyện/kiểm** mô hình dòng |
| **TAO/TRITON + OceanSITES** (PMEL, JAMSTEC) | T theo độ sâu, gió, dòng | Xích đạo TBD (8°S–8°N), **không vào Biển Đông** | Giờ/ngày | NRT ~1 ngày | data.pmel.noaa.gov/pmel/erddap [KC 200, có `pmelTaoDyIso`…] | OceanSITES theo chính sách CLIVAR; điều khoản nằm trong thuộc tính `distribution_statement` từng file; bản ghi NOAA cũ ghi CC0 [GĐ] | Không | Cao; giá trị là **tiền thân ENSO** (độ sâu đẳng nhiệt 20 °C) |
| **NOAA NDBC** | Sóng, gió, SST | Chủ yếu vùng biển Mỹ; không có phao trong Biển Đông [GĐ] | Giờ | NRT | ndbc.noaa.gov [KC 200] | Công thuộc Mỹ | Không | **Loại** — không phủ |
| **Trạm hải văn KTTV Việt Nam** (17 trạm KTTV biển [GĐ — veia.com.vn]) | Sóng, mực nước, thuỷ triều, nhiệt nước tại trạm | Ven bờ + đảo (Bạch Long Vĩ, Cồn Cỏ, Lý Sơn, Phú Quý, Côn Đảo, Trường Sa…) | Giờ/ngày | Bản tin hằng ngày | nchmf.gov.vn/kttv [KC 200] — có mục Hải văn + **dự báo dòng chảy tầng mặt Biển Đông 10 ngày** (ROMS) dạng ảnh/bản tin; **không thấy API số** | Thông tin nhà nước công bố công khai — dùng bình thường | Sạch | Cao cho thực địa; **khó lấy tự động** (cạo bản tin). Số liệu lịch sử phải xin Trung tâm |
| **UHSLC Fast Delivery** (thuỷ triều) | Mực nước giờ/ngày | Có trạm VN (Quy Nhơn, Vũng Tàu [GĐ]) | Giờ | ~1–2 tháng | ERDDAP `global_daily_fast` (máy chủ UHSLC/PacIOOS **timeout hôm nay**, chưa kiểm) | Có trường `license` nhưng **chưa đọc được** [chưa kiểm] | Không | Trung bình; trễ dài, giá trị dự báo thấp |
| **PSMSL** | Mực nước trung bình tháng/năm | Toàn cầu | Tháng | Năm | psmsl.org/data/obtaining [KC 200] | Không thấy câu giấy phép trên trang [chưa kiểm] | Không | **Loại** — quá trễ cho dự báo tuần |
| **HF radar** | Dòng mặt | VN: không có mạng công khai [GĐ]; Đài Loan TOROS: không công khai [KC]; Philippines: không thấy [GĐ] | — | — | — | — | — | **Loại** |
| **JMA — Kuroshio** | Vĩ độ cực nam của trục Kuroshio 136–140°E, uốn khúc lớn | Nam Nhật Bản (không phải eo Luzon) | Tháng | Tháng | File `kuro_slat.txt` từng được trích **nay trả 404** [KC] | JMA dùng **Public Data License 1.0** — *"commercial use … is also permitted"*, phải ghi nguồn [KC — jma.go.jp/jma/en/copyright.html 200 + digital.go.jp] | Không | Giá trị thấp cho Biển Đông (Kuroshio xâm nhập ở eo Luzon mới là thứ cần) |
| **Đài Loan CWA (phao eo Đài Loan)** | Sóng, SST, gió | Eo Đài Loan | Giờ | NRT | (chưa kiểm) | Open Government Data License [GĐ] | ⚠️ Metadata có thể mang tên địa danh theo tuyên bố của Đài Loan (đường 11 đoạn) — chỉ lấy số tại phao, **không hiển thị nhãn** | Chưa đánh giá — để vòng sau |

## 2. Vệ tinh (phần mới so với 05)

| Nguồn | Biến | Phân giải | Trễ | Truy cập | Giấy phép | Chủ quyền | Ghi chú |
|---|---|---|---|---|---|---|---|
| **CMEMS SEALEVEL L4 (NRT + MY)** | ADT, SLA, dòng địa chuyển | 1/4° (NRT), 1/8° bản mới [GĐ], ngày | ~1 ngày | Đã có trong 05 | Copernicus Marine — royalty-free, phái sinh, thương mại OK (đã kiểm ở 05) | Không | **Dùng mới**: chỉ số Kuroshio xâm nhập eo Luzon = chênh ADT/vận tốc qua mặt cắt 120,75°E 18–22°N; bản MY 1993→ để huấn luyện |
| **CMEMS MULTIOBS SSS L3/L4** (SMOS + SMAP, CATDS) | Độ mặn mặt | ~1/4°, ngày–tuần | Vài ngày | data.marine.copernicus.eu/product/MULTIOBS_GLO_PHY_SSS_L3_MYNRT_015_014 [KC 200] | Copernicus Marine; bản CATDS ghi CC BY [GĐ — metadata Sextant] | Không | Bám **chùm nước Mekong** và nước mặn Kuroshio vào Biển Đông |
| **RSS SMAP SSS v3** | Độ mặn | 8 ngày/tháng | ~vài ngày | NCAR GDEX d285005 | *CC BY 4.0, access constraints: none* [KC — catalog NCAR] | Không | Dự phòng cho trên |
| **CMEMS MULTIOBS_GLO_PHY_MYNRT_015_003** | Dòng tổng = địa chuyển + Ekman | 1/4°, giờ/ngày | ~ngày | [KC 200] | Copernicus Marine | Không | Đối chứng cho dòng mô hình ở mặt cắt cổng |
| **CMEMS OCEANCOLOUR_GLO_BGC_L4_NRT_009_102** (GlobColour) | Chl-a **lấp đầy mây** | 4 km, ngày | ~1–2 ngày | [KC 200] | Copernicus Marine | Không | Mùa mưa bão mây che → L4 gap-free quan trọng hơn L3 VIIRS |
| **NASA PACE (OCI)** | Chl, **nhóm phù du (PFT)** siêu phổ | ~1 km, ngày | 1–2 ngày | pace.oceansciences.org/access_pace_data.htm [KC 200]; Earthdata login miễn phí | Chính sách dữ liệu mở NASA [GĐ — công thuộc Mỹ] | Không | Mới (2024→), chuỗi ngắn — chưa đủ huấn luyện, để làm đặc trưng phụ |
| **NOAA OISST v2.1** | SST ngày | 1/4° | ~1 ngày (prelim) | ncei.noaa.gov/products/optimum-interpolation-sst [KC 200] | Công thuộc Mỹ | Không | **Dùng để tự tính Niño3.4, DMI, SST cổng** hằng ngày — nhanh hơn chỉ số tháng |
| MUR SST, OSCAR | — | — | — | Đã có trong 05 (ERDDAP hôm nay timeout) | NASA | — | Không nhắc lại |

## 3. Mô hình tái phân tích / dự báo

| Nguồn | Biến | Phân giải | Tầm dự báo | Truy cập | Giấy phép | Ghi chú |
|---|---|---|---|---|---|---|
| **CMEMS GLORYS12** `GLOBAL_MULTIYEAR_PHY_001_030` | T, S, u, v, SSH, MLD 3D | 1/12°, ngày | Tái phân tích 1993→ (+ interim) | [KC 200] | Copernicus Marine | **Xương sống huấn luyện**: tính transport 6 cổng 30 năm |
| **CMEMS PHY_001_024** | như trên | 1/12° | **10 ngày** | Đã chạy ARCO | Copernicus Marine | Cùng lưới/nguồn với GLORYS → chuỗi liền |
| **HYCOM ESPC-D-V02** | 3D | 1/12° | ~7–8 ngày | hycom.org/dataserver [KC 200]; GOFS 3.1 tắt 2024-09-04 [KC] | "Freely available" [GĐ, không thấy câu giấy phép rõ]; có ngày thiếu dữ liệu [KC — FAQ] | Dự phòng, không ưu tiên |
| **NOAA RTOFS** | 3D | 1/12° | 8 ngày | nomads.ncep.noaa.gov/pub/data/nccf/com/rtofs/prod [KC 200] | Công thuộc Mỹ | Dự phòng khi CMEMS sập |
| **ERA5** (C3S) | Gió, áp, OLR… | 0,25°, giờ | Tái phân tích 1940→, trễ ~5 ngày | CDS (cần tài khoản) | CC-BY 4.0 từ 02/07/2025 (đã ghi ở 05) | Tính **WNPMI, WPSH, ứng suất gió/Ekman** — thay chỉ số của TQ |
| **ECMWF Open Data** (IFS/AIFS, ENS) | Khí quyển (+ có thể SST) | 0,25° | 15 ngày (ENS) | data.ecmwf.int/forecasts [KC 200] | *CC-BY-4.0… redistributed and used commercially* (từ 01/10/2025 toàn catalogue) [KC — ecmwf.int open-data] | Biến đại dương trong gói miễn phí **chưa kiểm** |
| **C3S seasonal multi-system** (SEAS5 + các trung tâm) | SST, gió, mưa tháng | 1° | **6 tháng** | cds.climate.copernicus.eu/datasets/seasonal-monthly-single-levels [KC 200] | *"may be used and redistributed without restrictions"*, CC BY 4.0 — **⚠️ có "Additional licence to use non European contributions"** [KC — ecmwf.int C3S seasonal] | Chỉ dùng hệ châu Âu trước (SEAS5, Météo-France, DWD, CMCC, UKMO) cho tới khi đọc phụ lục |
| **NOAA CFSv2** | SST, dòng, gió | ~1° | **9 tháng**, chạy hằng ngày | nomads.ncep.noaa.gov/pub/data/nccf/com/cfs/prod [KC 200] | Công thuộc Mỹ | Nguồn duy nhất vừa sạch vừa có **dòng chảy đại dương** dự báo mùa |
| **NMME** | SST, mưa tháng | 1° | 9–12 tháng | cpc.ncep.noaa.gov/products/NMME/data.html [KC 200] | CPC không ghi giấy phép, chỉ xin trích Kirtman 2014 [KC]; có model Canada; **IRI: dự báo hiện hành cần licence thương mại** [KC] | Lấy bản CPC/AWS, tránh bản IRI; xác nhận với CPC [GĐ] |

## 4. Chỉ số khí hậu

| Chỉ số | Nguồn kiểm được | Tần suất/trễ | Giấy phép | Kết luận |
|---|---|---|---|---|
| **ONI / Niño3.4** | cpc.ncep.noaa.gov/data/indices/oni.ascii.txt [KC 200, mới tới JAS 2026] | Tháng, trễ ~2–3 tuần; bản tuần OISST cũng có ở `ftp.cpc.ncep.noaa.gov/wd52dg/data/indices/` [KC 200] | Công thuộc Mỹ | ✅ Dùng; tự tính bản ngày từ OISST |
| **SOI** | cpc.ncep.noaa.gov/data/indices/soi [KC 200] | Tháng | Công thuộc Mỹ | ✅ Dùng bản NOAA, **không** bản BoM |
| **DMI (IOD)** | psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data [KC 200, tạo 25/07/2026, tới 05/2026] | Tháng, **trễ ~2–3 tháng** | Dựa HadISST1.1 — trang Met Office hiện ghi *"provided under an Open Government Licence"* [KC]; kết quả tìm kiếm còn thấy bản cũ ghi "Non-Commercial Government Licence" → mâu thuẫn | ⚠️ Trễ quá + mập mờ giấy phép → **tự tính DMI từ OISST** (công thuộc) |
| **PDO** | ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat [KC 200, tới 09/2026] | Tháng, trễ ~3 tuần | Công thuộc Mỹ | ✅ Dùng (biến nền chậm) |
| **MJO** | BoM RMM: **403** + điều khoản mặc định cấm thương mại [KC]. NOAA CPC MJO (velocity potential, pentad) `proj_norm_order.ascii` [KC 200 — số cuối 2026-09-25, **trễ ~4 tuần**] | | CPC công thuộc | ⚠️ CPC trễ quá cho dự báo tuần → **tự tính RMM** (Wheeler–Hendon) từ OLR NOAA + gió 850/200 hPa ERA5/GFS; thuật toán công khai |
| **WPSH, WNPMI** | Không tìm được nguồn phát định kỳ sạch [KC — tìm không ra trên PSL/IPRC]; bộ "chỉ số hoàn lưu" của Trung tâm Khí hậu Bắc Kinh | | | **Tự tính** từ ERA5/GFS: WNPMI = U850(5–15°N,100–130°E) − U850(20–30°N,110–140°E) (Wang 2001); WPSH = diện tích/chỉ số lưỡi Z500 ≥ 5880 gpm |
| **Kuroshio xâm nhập eo Luzon** | Không có chỉ số công khai định kỳ; ASUKA (Kyushu) chỉ là Nam Nhật Bản và dừng 2010 [KC] | | | **Tự tính** từ CMEMS SEALEVEL/GLORYS (transport qua 120,75°E hoặc chỉ số Nan et al. từ ADT) |

## 5. Dữ liệu nghề cá ngoài Việt Nam

| Nguồn | Nội dung | Trễ | Giấy phép | Kết luận |
|---|---|---|---|---|
| **Global Fishing Watch** | Nỗ lực đánh bắt AIS, 0,01°, ngày | ~3–5 ngày | **CC BY-NC 4.0**, cấm tích hợp sản phẩm thương mại [KC] | ❌ Loại cho dự báo cá. (Theo luật repo: lớp **bản đồ miễn phí** thì không bị chặn bởi NC — nhưng không được dùng làm đặc trưng/nhãn huấn luyện mô hình bán) |
| **FAO FishStat** | Sản lượng quốc gia/năm theo loài | ~1,5–2 năm | *"licensed under … CC BY 4.0"* cho CSDL thống kê FAO, trừ khi metadata ghi khác [KC — fao.org db-terms (search; trang trả 403 cho curl)] | ✅ Sạch nhưng chỉ dùng làm **nền năm**, không dự báo tuần |
| **RAM Legacy** | Đánh giá nguồn lợi (sinh khối, F) | Năm | **CC BY 4.0** (Zenodo v4.66, 2024) [KC] | ✅ Sạch; rất ít đàn ở Biển Đông → giá trị thấp |
| **WCPFC public domain** | Cá ngừ, 5°×5°, tháng | ~1–2 năm | Theo "RAP" của Uỷ ban, câu giấy phép **chưa đọc được** (link node/4648 [GĐ]) | Có ích cho **cá ngừ đại dương** (phía đông, gần cổng Luzon); 5° quá thô; để sau |
| **IOTC** | Cá ngừ Ấn Độ Dương | Năm | (chưa kiểm) | Ngoài vùng — bỏ |
| **SEAFDEC** | Bản tin thống kê nghề cá ĐNÁ (PDF) | ~2 năm | (chưa kiểm) | Không máy đọc được — bỏ |

## 6. Kết luận — xếp hạng 10 nguồn tích hợp

Thang điểm 1–5 mỗi trục; tổng = tích (giá trị dự báo × dễ lấy × giấy phép × chủ quyền).

| # | Nguồn | Vai trong phương pháp "cổng + khí hậu" | GT | Dễ | GP | CQ | Tích |
|---|---|---|---|---|---|---|---|
| 1 | **CMEMS GLORYS12 + PHY_001_024** | Transport 6 cổng: 30 năm huấn luyện + 10 ngày tới; đã có pipeline ARCO | 5 | 5 | 5 | 5 | 625 |
| 2 | **CMEMS SEALEVEL L4 (NRT+MY)** | Chỉ số Kuroshio xâm nhập Luzon, xoáy | 5 | 5 | 5 | 5 | 625 |
| 3 | **NOAA OISST v2.1 + CPC ONI/SOI/PDO** | Tự tính Niño3.4/DMI ngày, SST cổng; chỉ số tháng chuẩn | 5 | 5 | 5 | 5 | 625 |
| 4 | **NOAA CFSv2** | Dự báo SST + dòng 9 tháng, chạy ngày | 4 | 4 | 5 | 5 | 400 |
| 5 | **ERA5 + ECMWF Open Data** | Tự tính WNPMI, WPSH, RMM, Ekman; 15 ngày tới | 4 | 4 | 5 | 5 | 400 |
| 6 | **C3S seasonal (chỉ hệ châu Âu)** | Dự báo SST/gió 6 tháng, đa mô hình | 4 | 4 | 4 | 5 | 320 |
| 7 | **CMEMS OCEANCOLOUR L4 GlobColour** | Chl gap-free: nước trồi Nam Trung Bộ, phản ứng sau cổng | 4 | 5 | 5 | 5 | 500* |
| 8 | **CMEMS MULTIOBS SSS (SMOS+SMAP)** | Dấu vết nước Kuroshio/Mekong | 3 | 5 | 5 | 5 | 375 |
| 9 | **Argo (qua CMEMS INSITU)** | Kiểm MLD/thermocline mô hình tại cổng | 3 | 4 | 5 | 5 | 300 |
| 10 | **NOAA CPC MJO + tự tính RMM** | Điều biến 30–60 ngày của gió mùa/bão | 3 | 3 | 5 | 5 | 225 |

\* Chl xếp #7 dù tích cao vì nó là **biến đích/biến đồng thời** hơn là biến dẫn trước nhiều tuần; giá trị "dẫn trước" thấp hơn transport và ENSO.

Thứ tự triển khai đề xuất: 1+2 (cùng tài khoản CMEMS, cùng code) → 3 (file văn bản, vài dòng) → 5 (tự tính chỉ số) → 4/6 (dự báo mùa) → còn lại.

### Nguồn LOẠI và lý do

| Nguồn | Lý do |
|---|---|
| Global Fishing Watch | CC BY-NC 4.0, cấm tích hợp sản phẩm thương mại [KC] |
| BoM (RMM, SOI bản Úc) | Mặc định cấm dùng thương mại/cung cấp lại [KC]; dùng bản NOAA hoặc tự tính |
| IRI (dự báo mùa hiện hành) | Cần licence thương mại [KC]; dùng NMME bản CPC hoặc C3S |
| HF radar Đài Loan TOROS | Không công khai, có lý do an ninh [KC] |
| Nguồn Trung Quốc (NMEFC, CMA/BCC chỉ số WPSH, trạm Viện Hải dương Nam Hải) | Chủ quyền: sản phẩm gắn tên/bản đồ theo yêu sách TQ — loại theo luật repo, tự tính chỉ số thay thế [GĐ về nhãn từng sản phẩm; luật loại là bất biến] |
| NDBC, TAO/TRITON trực tiếp cho Biển Đông | Không phủ (TAO giữ làm tiền thân ENSO nếu cần, nhưng ONI đã đủ) |
| PSMSL, UHSLC, GDP bản QC | Trễ tháng–năm; chỉ dùng huấn luyện/kiểm, không vào runtime |
| JMA Kuroshio Nam Nhật Bản | Giấy phép OK (PDL 1.0) nhưng sai vùng + file đã 404 |
| HYCOM | Không loại hẳn: trùng CMEMS, giấy phép không ghi rõ, có ngày thiếu → dự phòng sau RTOFS |
| WCPFC, SEAFDEC, IOTC | Trễ 1–2 năm, 5° hoặc PDF; giá trị dự báo tuần ≈ 0 |

### Rủi ro chủ quyền chung
- NOAA/CMEMS/ECMWF/C3S: dữ liệu là lưới số, **không có nghĩa vụ hiển thị** tên vùng; tên "South China Sea" nếu có chỉ là nhãn metadata/tiêu đề dataset → không hiện ra app, trong app luôn ghi "Biển Đông", "Hoàng Sa", "Trường Sa" của Việt Nam.
- Nguồn Philippines (nếu sau này dùng) có nhãn "West Philippine Sea", Đài Loan có nhãn theo đường 11 đoạn → chỉ lấy số, không lấy nhãn.

### Việc còn mở (cho vòng sau)
1. Đọc "Additional licence to use non European contributions" của C3S trước khi dùng hệ ngoài châu Âu.
2. Xác nhận giấy phép UHSLC (máy chủ timeout hôm nay) và câu RAP của WCPFC.
3. Kiểm biến đại dương nào nằm trong gói ECMWF Open Data miễn phí.
4. Hỏi Trung tâm Dự báo KTTV quốc gia cách nhận số liệu trạm hải văn + đầu ra ROMS 10 ngày dạng số (nguồn nhà nước, dùng bình thường — chỉ vướng định dạng).
