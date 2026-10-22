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
| `dong-dan/ket-qua/` | Kết quả bước C, C2 (`ket-qua*.json/md`) | Mac | nhỏ |
| `dong-dan/buoc0/` | Kết quả bước 0 | GPU (dữ liệu DataLake **không rời PC GPU**) | nhỏ |
| `dl-all/`, `fc-full/features/` | Nhãn DataLake + cache đặc trưng vệ tinh (bước 0 đọc) | **chỉ GPU** | 11 GB + 56 MB |

## Thứ tự chạy

```bash
node scripts/dong-dan/tai-gio-3diem-va-chiso.mjs   # chỉ số + gió 3 điểm (vài phút)
node scripts/dong-dan/tai-oisst.mjs 6              # OISST theo ngày, 6 luồng; chạy lại chỉ tải ngày thiếu (~25 phút từ đầu)
node scripts/dong-dan/tai-luoi-gio.mjs             # lưới gió — xem cảnh báo hạn mức dưới đây
node scripts/dong-dan/phan-tich.mjs                # bước C  → dong-dan/ket-qua/ket-qua.{json,md}
node scripts/dong-dan/phan-tich-ekman.mjs          # bước C2 → dong-dan/ket-qua/ket-qua-ekman.{json,md}
```

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

Sổ nguồn đầy đủ, có nguồn thay thế đã thử: `docs/research/du-bao-ca-dong-dan-2026-10/11-so-nguon.md`.

## Tải tiếp phần lưới gió còn thiếu

`tai-luoi-gio.mjs` bỏ qua file đã có, nên cứ chạy lại mỗi ngày là tải thêm được khoảng 1/14 phần còn thiếu trước khi chạm hạn mức. Đủ 120 điểm thì `phan-tich-ekman.mjs` tự tính thêm OFU/MKU/NCU, không phải sửa gì. Muốn nhanh hơn: chuyển nguồn sang ERA5 Copernicus CDS hoặc nguồn lưới khác ghi trong sổ nguồn.
