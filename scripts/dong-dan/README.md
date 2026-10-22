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
| Gió CMEMS `WIND_GLO_PHY_L4_MY_012_006` qua Zarr ẩn danh | **Chạy** | khối trống trả 403; ứng suất có sẵn quá thô (0,01 N/m²) nên tự tính từ gió; trục time phải đọc Float64; từ Mac nối S3 chập chờn — chạy ở GPU |

Sổ nguồn đầy đủ, có nguồn thay thế đã thử: `docs/research/du-bao-ca-dong-dan-2026-10/11-so-nguon.md`.

## Lưới gió Open-Meteo còn thiếu

Không cần tải tiếp nữa: gió CMEMS (`tai-gio-cmems.mjs`) đã phủ đủ 5 hộp từ 1994. Lưới Open-Meteo (chỉ hộp SCU, 1982 →) giữ lại vì có thêm 12 năm trước 1994 và để kiểm chéo nguồn (hai nguồn khớp r 0,94–0,96 cho gió hè SCU 1995–2025).
