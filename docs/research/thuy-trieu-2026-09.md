# Thuỷ triều — trạm điều hoà cho vùng biển Việt Nam, rà soát 2026-09

> **Ngày tra mọi nguồn: 2026-09-03.** Con số trong tài liệu này là kết quả tự truy vấn API (UHSLC ERDDAP, IOC SLSMF) và tự trích/hiệu chuẩn từ mô hình triều EOT20, không trích lại bảng dự tính của ai.
>
> **Bối cảnh**: engine điều hoà (`src/lib/tides.ts`) + bộ sinh hằng số (`scripts/generate-tides.mjs`) đã chạy và có 4 trạm ĐO thật (Hòn Dấu, Vũng Áng, Quy Nhơn, Vũng Tàu). 4 trạm cho 3.260 km bờ biển là thưa — nội suy xa sai số lớn đúng lúc mực triều quyết định qua được cửa lạch hay không. Việc (#14, vòng 2): tìm THÊM trạm, kể cả nguồn KHÔNG phải máy đo ghi giờ.

---

## 1. Kết luận thẳng

Hai tầng nguồn, tách bạch bằng cờ `nguon` trong `tide-stations.v1.json`:

| `nguon` | Loại | Số trạm | Nguồn | Độ tin |
|---|---|---|---|---|
| `gauge` (vắng cờ) | ĐO THẬT, ghi giờ | **4** | UHSLC/JASL + IOC | Chuẩn vàng (RMSE 7,7–14,9 cm) |
| `model` | ƯỚC TÍNH từ mô hình | **7** | EOT20 (CC-BY 4.0) | Kém hơn (RMSE EOT20↔trạm đo 9–16,5 cm; cửa lạch nông có thể lớn hơn) |
| | **Tổng** | **11** | | |

**Hai điều đúng cùng lúc, đừng gộp:**

1. **4 trạm ĐO vẫn là TRẦN của nguồn đo ghi-giờ mở.** Quét lại UHSLC RQDS + Fast + IOC ngày 2026-09-03: đúng 4 trạm VN, không hơn (§2). Không bịa thêm trạm đo.
2. **Nhưng thuỷ triều KHÔNG cần máy đo mới nói được.** Mô hình triều toàn cầu EOT20 cho hằng số điều hoà trên lưới 1/8°; ở các cửa lạch XA cả 4 trạm (100–306 km) nó tốt hơn nội suy từ trạm thật ở tận đầu kia bờ biển. Đã thêm **7 trạm `model`** (§3), gắn cờ rõ, độ tin thấp hơn, KHÔNG trộn với trạm đo.

> **Honesty-gate (thước #14):** trạm mô hình **KHÔNG** được đếm như trạm đo để thổi độ phủ. Đúng là: **4 trạm đo + 7 trạm ước tính = 11**. Gate test (`tides.test.ts`) chặn riêng: trạm `model` cấm ghi nguồn UHSLC, bắt buộc cờ `nguon="model"` + nguồn EOT20.

---

## 2. Trần nguồn ĐO ghi-giờ — vẫn đúng 4 (rà lại 2026-09-03)

| Nguồn tra | Trạm Việt Nam có chuỗi giờ mở |
|---|---|
| UHSLC/JASL **Research Quality** (`global_hourly_rqds`) | Hòn Dấu, Vũng Áng, Quy Nhơn, Vũng Tàu — **4** |
| UHSLC **Fast Delivery** (`global_hourly_fast`) | Quy Nhơn, Vũng Tàu — 2 (đã có) |
| **IOC** Sea Level Monitoring Facility | Qui Nhon, Vung Tau — 2 (đã có) |
| **Hợp lại** | **4 — không hơn** |

Quét cả theo nhãn nước lẫn theo khung toạ độ 8–23°N/102–112°E. Trong khung còn 4 trạm Trung Quốc trên đảo Hải Nam (Zhapo #6351, Beihai #6361, Dongfang #6371, Haikou #6381) — không phải trạm VN, loại.

### Bốn trạm đo — nguồn, chuỗi, sai số

| Trạm | Tỉnh | Bản ghi | Chuỗi | RMSE ngoài mẫu | z0 (m) | Chế độ triều |
|---|---|---|---|---|---|---|
| **Hòn Dấu** | Hải Phòng | RQDS #6502 | 1995 | **14,9 cm** | 1,97 | Nhật triều đều |
| **Vũng Áng** | Hà Tĩnh | RQDS #6511 | 1996–1997 | **13,4 cm** | 1,274 | Nhật triều không đều |
| **Quy Nhơn** | Bình Định | RQDS #3812 | 2019–2024 | **7,7 cm** | 1,183 | Nhật triều không đều, biên nhỏ |
| **Vũng Tàu** | BR–VT | RQDS #3832 | 2019–2024 | **11,0 cm** | 2,887 | Bán nhật triều không đều |

Giấy phép UHSLC: *"The data may be used and redistributed for free…"* — dùng và phát hành lại tự do; ghi nguồn + giữ chữ "chỉ để tham khảo". Hằng số do SDFish tự phân tích, KHÔNG mượn mô hình. **Giữ NGUYÊN từng byte, chỉ THÊM trạm mới.**

---

## 3. Bảy trạm MÔ HÌNH từ EOT20 — cửa lạch xa mọi trạm đo

### 3.1 Vì sao EOT20 (không phải FES2022 hay TPXO)

| Mô hình | Giấy phép | Kết luận |
|---|---|---|
| **EOT20** (Hart-Davis 2021, DGFI-TUM; SEANOE, doi:10.17882/79489) | **CC-BY 4.0** — thương mại ĐƯỢC, tải TỰ DO không cần đăng ký | **ĐÃ DÙNG.** Ghi nguồn trong `credit`. |
| FES2022 (AVISO) | Độ cao dùng thương mại được, nhưng **phải đăng ký tài khoản AVISO, duyệt vài ngày** | Loại về mặt thực thi: không tạo được tài khoản ở đây; EOT20 sạch hơn và không cổng đăng nhập. |
| TPXO9-atlas | **CẤM thương mại** | Loại cho mọi mục đích. |

EOT20: lưới 1/8° (~14 km), 17 sóng (2N2, J1, K1, K2, M2, M4, MF, MM, N2, O1, P1, Q1, S1, S2, SA, SSA, T2), gói gốc **2,33 GB netCDF** (nested zip: `ocean_tides.zip` + `load_tides.zip`; chỉ dùng `ocean_tides`).

**Ràng buộc thương mại KHÔNG cắn ở đây** (CLAUDE.md "Nguồn dữ liệu — đừng tự giới hạn"): bản đồ + con nước là MIỄN PHÍ cho mọi tài khoản; chỗ thu tiền là DỰ BÁO CÁ. EOT20 CC-BY dùng cho lớp con nước miễn phí là hợp lệ, chỉ cần ghi nguồn.

### 3.2 Vấn đề pha — và cách giải KHÔNG bịa

EOT20 công bố pha theo quy ước Greenwich (pha trễ G so với thế triều cân bằng **có** hằng số ±90°/180°). Quy ước V(t) của `tides.ts` thì **không** có hằng số đó (chú thích đầu `tides.ts` cảnh báo lệch tới 90° ≈ 3 tiếng nước). Chép thẳng pha là bà con mắc cạn.

**Không tự suy hằng số quy đổi C từ lý thuyết** (dễ sai) — mà **ĐO C thẳng từ dữ liệu**: tại 4 trạm đã biết pha ĐÚNG, `C = G_eot − pha_ta`. C là hằng số toán học (không đổi theo nơi), nên nếu 4 trạm cho C nhất quán thì đó CHÍNH là hằng số quy đổi; độ tản của nó = sai số EOT20, báo ra chứ không giấu. Đơn vị (cm→m) cũng đo từ tỉ số biên độ.

**Kết quả tự kiểm (2026-09-03) — rất chắc:**
- Hệ số đơn vị amp (ta/eot) = **1,020·10⁻²** (đúng cm→m), độ tản chặt.
- Dấu pha toàn cục **f=+1** thắng rõ (độ tản sóng chính 3,2° so với 64,0° của f=−1).
- Độ lệch quy ước C rơi đúng **bội số 90°** như lý thuyết Doodson–Warburg dự đoán, độ tản qua 4 trạm chỉ **1,2–6,2°** cho 8 sóng chính:

  | Sóng | C (°) | tản | | Sóng | C (°) | tản |
  |---|---|---|---|---|---|---|
  | M2 | 359,6 | 3,5° | | P1 | 269,2 | 3,0° |
  | S2 | 356,1 | 4,2° | | Q1 | 267,9 | 1,8° |
  | N2 | 356,5 | 6,2° | | K1 | 88,0 | 1,2° |
  | K2 | 1,9 | 3,8° | | O1 | 268,8 | 1,6° |

- **Đối chứng độc lập:** hằng số EOT20 quy đổi tại **Nha Trang** (mô hình) khớp trạm ĐO **Quy Nhơn** kề bên tới ~1°: K1 103,5° vs 103,1°; O1 242,8° vs 243,2°; M2 87,9° vs 87,0°; biên độ lệch ~1 cm. Đúng chế độ, đúng vùng → pipeline đúng.

Chỉ giữ sóng có độ tản C đủ nhỏ ⇒ mỗi trạm mô hình có **8 sóng thiên văn chính** (M2, S2, K1, O1, N2, K2, P1, Q1). Các sóng nhỏ (M4, S1, T2, Mf…) biên độ vài cm, pha nhiễu ở bờ VN, EOT20 kém tin — bỏ đi là tránh giả vờ chính xác, không phải thiếu sót.

### 3.3 Bảy trạm — vị trí, khoảng cách tới trạm đo gần nhất, chế độ

| Trạm | Toạ độ | Cách trạm ĐO gần nhất | z0 (m) | F=(K1+O1)/(M2+S2) | Chế độ |
|---|---|---|---|---|---|
| **Cửa Việt** (Quảng Trị) | 16,95N 107,30E | Vũng Áng 166 km | 0,556 | 0,79 | Bán nhật không đều |
| **Đà Nẵng** | 16,10N 108,35E | Quy Nhơn 276 km | 0,716 | 1,58 | Nhật triều không đều |
| **Nha Trang** (Khánh Hoà) | 12,10N 109,45E | Quy Nhơn 187 km | 1,048 | 2,60 | Nhật triều không đều |
| **Định An** (sông Hậu) | 9,55N 106,60E | Vũng Tàu 102 km | 2,704 | 0,90 | Bán nhật không đều, biên lớn |
| **Mũi Cà Mau** | 8,55N 104,95E | Vũng Tàu 306 km | 1,926 | 1,29 | Nhật triều không đều |
| **Rạch Giá** (vịnh Thái Lan) | 9,90N 104,55E | Vũng Tàu 280 km | 0,401 | 2,98 | Nhật triều gần đều |
| **Cửa Ông** (Quảng Ninh) | 20,95N 107,55E | Hòn Dấu 82 km | 2,207 | 7,21 | Nhật triều đều, biên lớn |

**Giá trị lớn nhất là bờ Tây (vịnh Thái Lan):** Rạch Giá + Mũi Cà Mau nằm ở một BỒN TRIỀU KHÁC hẳn — nhật triều (F cao) — mà cả 4 trạm đo đều ở bờ Đông. Trước đây ngư dân Kiên Giang/Cà Mau tra ra Vũng Tàu (bán nhật, sai bồn, cách 280–306 km); giờ có điểm đúng chế độ tại chỗ. F=7,21 ở Cửa Ông và F=2,98 ở Rạch Giá khớp đặc trưng hải văn đã biết của vịnh Bắc Bộ và vịnh Thái Lan → EOT20 + quy đổi cho ra vật lý đúng.

Cửa Ông (82 km từ Hòn Dấu, cùng bồn nhật triều) là trạm ÍT quan trọng nhất; giữ vì > 30 km (ngưỡng `tideTrustText` bắt đầu cảnh báo) và là ngư trường lớn — nhưng đây là ứng viên đầu tiên nên bỏ nếu cần gọn.

### 3.4 Độ tin — con số TRUNG THỰC

Không có máy đo tại 7 điểm mô hình để holdout. Số thay thế: **RMSE giữa EOT20 (đã quy đổi) và trạm ĐO, đo tại chính 4 trạm thật** (bỏ lệch mốc, so đường mực nước cả năm 2026):

    Hòn Dấu 9,2 cm · Vũng Áng 10,4 cm · Quy Nhơn 12,8 cm · Vũng Tàu 16,5 cm → trung vị 12,8 cm

`rmseM = 0,128` cho mọi trạm mô hình. **Cảnh báo thật:** đây là sai số ở vùng nước tương đối hở gần 4 trạm; ở **cửa lạch nông** (Định An, Rạch Giá) EOT20 có thể sai HƠN — `note` mỗi trạm và `tideModelCaveat()` đều nói "ước tính từ mô hình".

---

## 4. Nguồn CÓ mà bị loại — và lý do

| Ứng viên | Vì sao loại |
|---|---|
| Hải Nam TQ (Zhapo, Beihai, Dongfang, Haikou) trong khung toạ độ VN | Không phải trạm Việt Nam. |
| Đà Nẵng, Nha Trang, Cửa Việt, Định An, Phú Quốc, Côn Đảo, Rạch Giá, Cửa Ông, Trường Sa | Không có **chuỗi ĐO giờ mở** → không phân tích điều hoà từ số đo được. (Đã lấp bằng trạm MÔ HÌNH — §3.) |
| **Bảng thuỷ triều VN in / trang tra tiếng Việt** | Đúng là dữ liệu nhà nước (Điều 15 Luật SHTT). Nhưng **không lấy được số máy đọc**: các bảng phát hành dạng bản in / PDF ảnh / trang tra từng-ngày không có API tải cả-năm-một-cảng, và bản thân chúng là bản DỰ TÍNH không kèm hằng số gốc. Muốn khớp ngược hằng số cần chuỗi cao/thấp cả năm dạng số — chưa lấy được. Nếu sau này có, quy trình khớp-ngược khả thi; hiện EOT20 là đường tốt hơn (có sẵn, cả-năm, mọi giờ). |
| **PSMSL** | Chỉ có trung bình tháng — không tách được hằng số điều hoà. |
| **FES2022 / TPXO9** | Xem §3.1 (đăng ký / cấm thương mại). EOT20 thay được. |

---

## 5. Hệ quả cho sản phẩm & bàn giao

- **Dữ liệu**: `public/data/tide-stations.v1.json` giờ có **11 trạm** (4 gauge giữ nguyên byte + 7 model), 10 KB — trong ngân sách 60 KB. Đường dẫn/khoá SW không đổi (offline an toàn).
- **Engine** (`tides.ts`): thêm cờ `nguon`, hàm `isModelStation()`, `tideModelCaveat()`, và `tideTrustText(distanceKm, station?)` (tham số `station` TUỲ CHỌN — lời gọi cũ vẫn chạy). Engine dự báo GIỮ NGUYÊN.
- **⚠️ Bàn giao UI (đội bản đồ — `fishing-map-view.tsx`, ngoài quyền sửa của việc này):** lời gọi hiện tại `tideTrustText(gan.distanceKm)` cần đổi thành **`tideTrustText(gan.distanceKm, gan.station)`** để trạm mô hình được gắn cờ "ước tính" NGAY CẢ khi ở gần. Chưa đổi thì trạm mô hình gần sẽ hiện như trạm đo — đây là điểm honesty cần vá sớm.
- **Sinh lại**: `scripts/extract-eot20.py` (trích EOT20 → `scripts/eot20-points.json`, ~9 KB, đã commit) rồi `npx tsx scripts/generate-tides.mjs --add-model-only`. Gói EOT20 2,3 GB KHÔNG vào repo, KHÔNG tải lúc build.
- **Rà lại khi**: UHSLC/IOC mở thêm trạm ĐO VN, EOT20 ra bản mới, hoặc lấy được bảng thuỷ triều VN dạng số (khớp-ngược hằng số).

---

## 6. Lệnh đã chạy (tái lập)

```bash
# trần nguồn đo
curl -s "https://uhslc.soest.hawaii.edu/erddap/tabledap/global_hourly_rqds.csv?record_id,station_name,station_country,latitude,longitude&distinct()"
curl -s "https://uhslc.soest.hawaii.edu/erddap/tabledap/global_hourly_fast.csv?record_id,station_name,station_country,latitude,longitude&distinct()"
curl -s "https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all&format=json"

# EOT20 (chạy tay, hiếm khi)
#   tải https://www.seanoe.org/data/00683/79489/data/85762.zip  (2,33 GB)
#   giải nén ocean_tides.zip → <dir>/ocean_tides/*.nc
pip install netCDF4
python scripts/extract-eot20.py <dir>/ocean_tides     # → scripts/eot20-points.json
npx tsx scripts/generate-tides.mjs --add-model-only    # quy đổi + ghép 7 trạm model
npm test
```
