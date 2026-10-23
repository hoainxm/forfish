# scripts/dong-dan — công cụ nghiên cứu dự báo cá "Dòng Dẫn"

Kết luận và bối cảnh: [`docs/research/du-bao-ca-dong-dan-2026-10/`](../../docs/research/du-bao-ca-dong-dan-2026-10/README.md). Các script ở đây **chỉ đọc** nguồn và dữ liệu, **không** đụng app, nhãn hay mô hình. Không có test Vitest vì không có logic nào vào `src/`.

## Dữ liệu nằm ở đâu (NGOÀI git — luật "chống phình")

Mọi đường dẫn đi qua `scripts/lib/data-dir.mjs`: `$SDFISH_DATA_DIR`, mặc định `~/sdfish-data` (Mac); PC GPU đặt `SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data`.

| Thư mục | Nội dung | Có ở | Cỡ (2026-10-22) |
|---|---|---|---|
| `hindcast-ntb/oisst/YYYY-MM.csv` | OISST v2.1 theo ngày, hộp 10,875–13,375°N × 108,625–114,375°E, mỗi dòng `ngày,<264 số °C>` (11 hàng vĩ × 24 cột kinh, NaN = đất) | Mac + GPU | 538 tháng, 1982-01 → 2026-10-20, 25 MB |
| `hindcast-ntb/era5-luoi/<lat>_<lon>_<năm>.json` | Gió ERA5 10 m theo giờ, lưới 0,5°, khúc 3 năm; `boxes.json` = hộp SCU/NCU/OFU/MKU/REF + danh sách 120 điểm | Mac + GPU | **20/120 điểm** (hộp SCU 10,5–12°N), 1982 → 2026-10-20, 207 MB |
| `hindcast-ntb/era5-luoi-do/` | Tải dở hàng 12,5°N (bị Open-Meteo chặn giữa chừng) — không dùng trong phân tích | Mac + GPU | 20 file |
| `hindcast-ntb/era5-3diem/` | Gió ERA5 theo giờ tại 3 điểm (12°N 110°E · 11°N 110,5°E · 13°N 109,75°E) | Mac + GPU | 45 file, 31 MB |
| `hindcast-ntb/chiso/` | `oni.txt` (CPC), `nino.txt` (CPC), `pdo.txt` (NCEI ERSSTv5) | Mac + GPU | tải lại mỗi lần |
| `hindcast-ntb/chl-occi/<năm>.csv` | Chl OC-CCI v6.0 theo 8 ngày, 8–15°N × 106–115°E, ≈0,125° (57 × 73 ô, vĩ độ GIẢM dần); trục ở `manifest.json` | Mac + GPU | 9/1997 → 6/2026, 31 MB |
| `hindcast-ntb/cmems-gio/chiso-ngay.json` | Chỉ số gió NGÀY theo 5 hộp (`<HỘP>_<ti\|tE\|tN\|Mek\|wEk>`), nối 0,25° + 0,125° có hiệu chỉnh lệch theo tháng; `noi-bo.json` = so khúc chồng | Mac + GPU | 1994-06 → 2026-06-20, 6,5 MB |
| `hindcast-ntb/chl-ngay/hop-ngay.json` | Chl lấp mây HẰNG NGÀY (Copernicus Marine OC gap-free MY), trung bình log10 theo 4 hộp; `cache/` chỉ để chạy tiếp | Mac + GPU (cache chỉ GPU) | 9/1997 → 14/10/2026, 1 MB (cache ~700 MB, xoá được) |
| `dong-dan/buoc-b/` | Kết quả bước B (chỉ số tổng hợp, không mã tàu) | GPU; bản .md cả Mac | nhỏ |
| `dong-dan/buoc15/` | Kết quả bước 15 trăng (chỉ số tổng hợp, không mã tàu) | GPU | nhỏ |
| `hindcast-ntb/san-luong/<bảng>.json` | Bảng NSO PxWeb dạng JSON-stat: sản lượng khai thác / cá biển theo tỉnh cũ × năm 1995 → sơ bộ 2025 (`V06.65`, `V06.66`), công suất tàu ≥ 90 CV 2010 → (`V06.60`), nước mắm cả nước (`V07.05`)… (`tai-san-luong.mjs`) | GPU | 9 file, 100 KB |
| `dong-dan/buoc17/` | Kết quả bước 17 (sản lượng tỉnh-năm ↔ gió, chl, ONI) | GPU | nhỏ |
| `hindcast-ntb/gio-du-bao/ecmwf_ifs/<ngày phát>.json` | Gió DỰ BÁO thật ECMWF IFS (lần chạy 00 UTC đúng ngày phát), 27 ô biển (9/hộp SCU, OFU, MKU), theo giờ tới 10–15 ngày | Mac + GPU | 52 lần phát 5/2024 → 6/2026, 5 MB |
| `hindcast-ntb/cmems-gio/<025\|0125>/ngay-o.f32` | Gió NGÀY từng ô trong hộp: [ô × ngày × 4] (τx, τy, \|τ\|, curl τ), Float32; `manifest.json` liệt kê ô | **chỉ GPU** | ~730 MB; thư mục `cache/` (~440 MB) chỉ để chạy tiếp, xoá được |
| `dong-dan/ket-qua/` | Kết quả bước C, C2 (`ket-qua*.json/md`) | Mac | nhỏ |
| `dong-dan/buoc0/` | Kết quả bước 0 | GPU (dữ liệu DataLake **không rời PC GPU**) | nhỏ |
| `dl-all/`, `fc-full/features/` | Nhãn DataLake + cache đặc trưng vệ tinh (bước 0 đọc) | **chỉ GPU** | 11 GB + 56 MB |

## Thứ tự chạy

```bash
node scripts/dong-dan/tai-gio-3diem-va-chiso.mjs   # chỉ số + gió 3 điểm (vài phút)
node scripts/dong-dan/tai-oisst.mjs 6              # OISST theo ngày, 6 luồng; chạy lại chỉ tải ngày thiếu (~25 phút từ đầu)
node scripts/dong-dan/tai-luoi-gio.mjs             # lưới gió Open-Meteo — bị hạn mức, đã thay bằng tai-gio-cmems.mjs
node scripts/dong-dan/tai-chl-occi.mjs             # chl OC-CCI 8 ngày (~8 phút ở GPU)
node scripts/dong-dan/tai-gio-cmems.mjs            # gió CMEMS 5 hộp, cả hai bộ (~3 phút ở GPU; từ Mac chập chờn)
node scripts/dong-dan/phan-tich.mjs                # bước C  → dong-dan/ket-qua/ket-qua.{json,md}
node scripts/dong-dan/phan-tich-ekman.mjs          # bước C2, gió ERA5  → ket-qua-ekman.{json,md}
node scripts/dong-dan/phan-tich-ekman.mjs --gio cmems   # bước C2, gió CMEMS → ket-qua-ekman-cmems.{json,md}
node scripts/dong-dan/phan-tich-gio-moi.mjs        # mắt xích gió → mồi → gio-moi.{json,md}
node scripts/dong-dan/tai-gio-du-bao.mjs           # gió dự báo ECMWF IFS đã lưu (Open-Meteo Single Runs, chỉ có từ 2024)
node scripts/dong-dan/phan-tich-du-bao-moi.mjs     # thử dự báo mồi 1–3 tuần → du-bao-moi.{json,md}
```

`chl-gio.mjs` là phần dùng chung của hai phân tích "mồi" (đọc chl theo hộp, khe 8 ngày, dị thường, gió ngày).

Bước B (chỉ chạy ở gpu-desktop, cần nhãn DataLake):

```bash
node scripts/dong-dan/tai-chl-ngay.mjs                                   # chl lấp mây hằng ngày theo hộp (~1 phút ở GPU)
node scripts/dong-dan/tai-gio-cmems.mjs --bo nrt                         # nối gió gần thời gian thực sau 20/6/2026
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/buoc-b-moi-ca.mjs [--fe nuathang]
```

Bước 16 "Bãi đang ăn" (chỉ chạy ở PC GPU, cần nhãn DataLake; doc `16-bai-dang-an.md`):

```bash
# Windows: SDFISH_DATA_DIR=C:/Users/admin/sdfish-data SDVICO_DATALAKE_ROOT=C:/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu
node --max-old-space-size=12000 scripts/dong-dan/buoc16-bai-dang-an.mjs dung   # MỘT lần: chuyến × ngày × ô 0,25° → giờ đánh (~6 phút, ~9 GB RAM) → dong-dan/buoc16/bang-o.json (~70 MB, chỉ số tàu, không mã)
node --max-old-space-size=8000 scripts/dong-dan/buoc16-bai-dang-an.mjs do [--boot 1000] [--lag 3]   # đối thủ W−1/tháng-trước/nền → buoc16.{json,md} (vài phút)
```

`bang-chuyen.mjs` là MỘT định nghĩa bảng chuyến (lọc + giờ đánh) cho bước 0, bước B và bước 15; mỗi bước gắn "móc" riêng trên từng đoạn giờ đánh (`seg`), tuỳ chọn thêm `segAny` để thấy mọi đoạn kèm phán quyết.

Bước 15 — trăng và sản lượng (chỉ chạy ở gpu-desktop, cần `dl-all`; ~5 phút, đọc nhãn cần ~9 GB RAM):

```bash
node scripts/dong-dan/trang-thien-van.mjs --selftest        # kiểm vị trí Mặt Trời/Mặt Trăng (trăng tròn/non 2026, trưa/nửa đêm)
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=12000 scripts/dong-dan/buoc15-trang.mjs [--fe nuathang] [--limit N --boot 20 --null 10]
```

Trên Windows (node 22): đặt `SDFISH_DATA_DIR=C:/Users/admin/sdfish-data` và `SDVICO_DATALAKE_ROOT=C:/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu` (snapshot cảng + danh sách tàu thu mua). Ra `dong-dan/buoc15/buoc15[-nuathang].{json,md}`. `trang-thien-van.mjs` là vị trí Mặt Trời/Mặt Trăng độ chính xác thấp, không thêm phụ thuộc.

Bước 17 — sản lượng nhiều năm theo tỉnh (chạy được ở mọi máy có `chl-occi/`, `cmems-gio/`, `chiso/`; ~2 giây, không cần khoá RAM):

```bash
node scripts/dong-dan/tai-san-luong.mjs            # 9 bảng NSO PxWeb (form ASP.NET, không tài khoản; ~20 giây)
node scripts/dong-dan/buoc17-san-luong.mjs         # → dong-dan/buoc17/buoc17.{json,md}
```

Giả thuyết và luật quyết đăng ký trước ở `docs/research/du-bao-ca-dong-dan-2026-10/17-san-luong-nhieu-nam.md` §2 — sửa script thì không sửa luật.

Thông số lớp chuỗi thức ăn của app (`src/data/fish-chain-params.json`, doc `docs/research/du-bao-ca-dong-dan-2026-10/19-lop-chuoi-thuc-an.md`):

```bash
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/fit-trang-loai.mjs   # GPU: lịch trăng theo nhóm loài × nghề
node scripts/dong-dan/dung-chain-params.mjs    # Mac: gom trang/ + buoc-b/ (chép về $SDFISH_DATA_DIR/dong-dan) → src/data/fish-chain-params.json
```

`hop.mjs` là nguồn hộp cho cả app (bộ dựng chép vào file thông số; test `fish-chain.test.ts` canh hai bên khớp).

`hop.mjs` là MỘT nguồn định nghĩa hộp; `zarr-cmems.mjs` đọc Zarr ẩn danh của Copernicus Marine bằng bộ giải nén blosc của app (`src/lib/copernicus.ts`, nạp qua `jiti` có sẵn trong node_modules — không thêm phụ thuộc). Muốn chạy ở thư mục ngoài repo (như `~/.local/forlife/train/dong-dan` trên GPU) thì giữ đúng bố cục: `scripts/dong-dan/`, `scripts/lib/data-dir.mjs`, `src/lib/{copernicus,abort}.ts`, `node_modules` (liên kết tới repo).

Bước 0 (chỉ chạy ở gpu-desktop, cần `dl-all` + `fc-full`):

```bash
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/buoc0-chuyen.mjs
```

Khoảng 7 phút, ~9 GB RAM. Ra `dong-dan/buoc0/buoc0.{json,md}`.

## Nguồn: cái nào chạy, cái nào không (thử 2026-10-22)

| Nguồn | Trạng thái | Ghi chú |
|---|---|---|
| OISST qua NCEI THREDDS OPeNDAP (`/thredds/dodsC/OisstBase/NetCDF/V2.1/AVHRR/…`) | **Chạy** | ngày gần nhất có hậu tố `_preliminary` |
| OISST qua NCEI ERDDAP | Chỉ từ 2020-02 | đừng dùng cho chuỗi dài |
| CoastWatch ERDDAP (pfeg), NOAA PSL THREDDS | Nghẽn cả ngày (timeout / 503) | chl lịch sử chưa lấy được |
| Open-Meteo archive, gió theo giờ | **Chạy, nhưng có hạn mức** | tính lượt ≈ số điểm × số ngày / 14; ~5 000/giờ, ~10 000/ngày; 120 điểm × 45 năm ≈ 140 nghìn lượt |
| Open-Meteo archive/marine, SST | Trả null cho năm cũ | không dùng |
| ONI, Niño (CPC), PDO (NCEI) | **Chạy** | |
| Chl OC-CCI qua ERDDAP NOAA PIFSC (`oceanwatch.pifsc.noaa.gov`) | **Chạy** | hỏi vượt phạm vi thời gian ⇒ 404 — script kẹp vào `time_coverage_start/end` |
| Gió dự báo đã lưu, Open-Meteo Single Runs (`&run=`), mô hình `ecmwf_ifs` | **Chạy, chỉ từ ~4/2024** | 10 ngày tới giữa 2024, 15 ngày từ 19/7/2024; `ecmwf_ifs025`, GFS không có trong kho; Previous Runs API (tầm 1–7 ngày) cũng chỉ từ 2024 |
| Chl lấp mây hằng ngày `OCEANCOLOUR_GLO_BGC_L4_MY_009_104` (gap-free, 4 km) qua Zarr ẩn danh | **Chạy** | 1997 → ~2 tuần trước; khối 16×16 ô × 1 915 ngày, Float32 |
| Gió CMEMS gần thời gian thực `WIND_GLO_PHY_L4_NRT_012_004` | **Chạy** | khối 8×8 ô; kho chỉ còn giữ từ ~6/2024 (khối cũ trống); không có stress_curl |
| Sản lượng thủy sản theo tỉnh × năm, NSO PxWeb (`pxweb.nso.gov.vn`, thử 2026-10-23) | **Chạy** | kho nông nghiệp không có trong `/api/v1` ⇒ qua form chọn biến; chỉ có năm × tỉnh, không tháng, không loài; tỉnh cũ tới 2025, nhánh `PLV06` theo 34 tỉnh mới |
| Gió CMEMS `WIND_GLO_PHY_L4_MY_012_006` qua Zarr ẩn danh | **Chạy** | khối trống trả 403; ứng suất có sẵn quá thô (0,01 N/m²) nên tự tính từ gió; trục time phải đọc Float64; từ Mac nối S3 chập chờn — chạy ở GPU |

Sổ nguồn đầy đủ, có nguồn thay thế đã thử: `docs/research/du-bao-ca-dong-dan-2026-10/11-so-nguon.md`.

## Lưới gió Open-Meteo còn thiếu

Không cần tải tiếp nữa: gió CMEMS (`tai-gio-cmems.mjs`) đã phủ đủ 5 hộp từ 1994. Lưới Open-Meteo (chỉ hộp SCU, 1982 →) giữ lại vì có thêm 12 năm trước 1994 và để kiểm chéo nguồn (hai nguồn khớp r 0,94–0,96 cho gió hè SCU 1995–2025).
