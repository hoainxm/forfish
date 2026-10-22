# 13 — Thử dự báo mồi 1–3 tuần bằng gió dự báo thật (đo 2026-10-22)

**Load khi / Load when**: trước khi làm bất kỳ sản phẩm "mồi / nước trồi trong 1–3 tuần tới", hoặc khi cần biết gió dự báo ECMWF giúp được tới tầm nào. Bảng số gốc: `13b-du-bao-moi-bang-so.md`.

> Chỉ đọc nguồn công khai, không sửa app. Gió dự báo **thật đã phát trong quá khứ** (không phải tái phân tích): ECMWF IFS 9 km qua Open-Meteo Single Runs API, lần chạy 00 UTC đúng ngày phát, 52 lần phát (tháng 5–10 năm 2024, 2025, và 5–6/2026), 9 ô biển mỗi hộp. Chl OC-CCI 8 ngày, gió quan sát CMEMS (như 12). Script: `tai-gio-du-bao.mjs`, `phan-tich-du-bao-moi.mjs`; phần dùng chung tách ra `chl-gio.mjs` (kết quả 12 chạy lại giống hệt).

## 0. Kết luận (đọc nếu chỉ có 1 phút)

| Hộp | Tầm 8 ngày | Tầm 16 ngày | Tầm 24 ngày | Đọc |
|---|---|---|---|---|
| **MKU** (thềm ngoài Mê Kông, sau Côn Đảo) | **+0,32** [+0,08…+0,47] | **+0,35** [+0,21…+0,44] | **+0,12** [+0,02…+0,20] | **Dự báo mồi được 1–3 tuần.** Tầm 8–16 ngày gần bằng trần "biết trước gió" |
| **SCU** (ven bờ Ninh Thuận – Bình Thuận) | **+0,16** [+0,00…+0,29] | +0,10 [−0,22…+0,32] | ≈ 0 | Được ở 1 tuần, bằng trần; 2 tuần chưa chắc |
| **OFU** (ngoài khơi) | +0,09 [−0,54…+0,32] | ≈ 0 | ≈ 0 | **Không thêm gì** so với quán tính — mồi ngoài khơi tự giữ (quán tính r 0,80) |

Số trong bảng = mức thắng quán tính theo sai số bình phương (MSE skill; 0 = bằng quán tính, 1 = hoàn hảo), dùng gió dự báo đã chỉnh lệch, CI 90 % bootstrap theo khối năm-tháng (14 khối). Hệ số học trên 1998–2023 bằng gió quan sát rồi **giữ cố định** khi thử 2024–2026.

**Ý nghĩa:**
1. Lần đầu trong cả nghiên cứu có một **dự báo tầm 1–3 tuần thắng đối thủ đơn giản trên dữ liệu chưa thấy**, dù mẫu nhỏ: mồi ở thềm Mê Kông – Côn Đảo, và ở ven bờ Nam Trung Bộ tầm 1 tuần.
2. Gió dự báo có giá trị thật: ở MKU nó thắng hẳn phương án "chỉ dùng gió đã thấy tới lúc phát" (+0,32 so với +0,12 ở tầm 8 ngày).
3. **Vẫn là mồi, chưa phải cá.** Bước B (mồi → cá trên nhãn chuyến) quyết định có thành sản phẩm cho bà con hay không. Nếu B qua, MKU và SCU là hai vùng nên thử trước.

## 1. Cách đo

- **Phát dự báo** ở đầu mỗi mốc chl 8 ngày t0 (tháng 5–10); lúc đó đã biết chl mốc [t0−8, t0).
- **Mục tiêu**: dị thường log10 chl của mốc kết thúc sau L ngày, mốc [t0+L−8, t0+L), với L = 8, 16, 24.
- **Gió**: dị thường ứng suất đông τ_E trung bình hộp, cửa sổ 16 ngày [a−8, a+8) quanh mốc mục tiêu a (12 đo được chl phản ứng sau 0–16 ngày).
- **Bốn cách, cùng mẫu**:
  - P quán tính (đối thủ): chl = c + a·chl vừa qua.
  - Q gió đã thấy: thêm phần cửa sổ trước t0 bằng gió quan sát (chỉ có ở L = 8).
  - F gió dự báo: trước t0 dùng gió quan sát, từ t0 dùng ECMWF IFS; ngoài tầm dự báo coi như khí hậu. Fc = F trừ lệch theo tầm, lệch đo trên **các năm thử khác**.
  - O trần: cả cửa sổ dùng gió quan sát (biết trước tương lai, không làm được thật).
- **Hindcast** 1998–2023 (P, Q, O) chấm bỏ-từng-năm, bootstrap theo năm, ~480–500 mẫu mỗi ô.

## 2. Gió dự báo tự nó tốt tới đâu (r với gió quan sát cùng ngày, 52 lần phát)

| Hộp | ngày 0 | ngày 4 | ngày 8 | ngày 10 | ngày 12 | ngày 14 |
|---|---|---|---|---|---|---|
| SCU | 0,97 | 0,84 | 0,69 | 0,57 | 0,32 | 0,36 |
| OFU | 0,98 | 0,86 | 0,77 | 0,70 | 0,44 | 0,44 |
| MKU | 0,99 | 0,91 | 0,67 | 0,64 | 0,54 | 0,60 |

Gió dự báo thổi mạnh hơn gió CMEMS khoảng 3–13 ×10⁻³ N/m² ở ngày 2–8 (một phần do 9 điểm so với cả hộp). Đã chỉnh bằng lệch đo trên các năm khác; chỉnh hay không cũng gần như nhau. Năm 2024 kho chỉ lưu 10 ngày dự báo, từ 19/7/2024 lưu 15 ngày; thiếu lần phát 5/8/2025.

## 3. Trần và mức sàn trên 26 năm (1998–2023, không cần gió dự báo)

| Hộp | Quán tính r (8 / 16 / 24 ngày) | Gió đã thấy (8 ngày) | Trần biết trước gió (8 / 16 / 24 ngày) |
|---|---|---|---|
| SCU | 0,55 / 0,26 / 0,09 | +0,04 | +0,18 / +0,26 / +0,25 |
| OFU | 0,75 / 0,55 / 0,35 | +0,11 | +0,18 / +0,21 / +0,18 |
| MKU | 0,46 / 0,32 / 0,17 | +0,07 | +0,24 / +0,33 / +0,31 |

Đọc: nếu biết gió hoàn hảo thì thắng quán tính một phần năm đến một phần ba ở mọi tầm, mọi hộp (CI đều loại 0). Thực tế bị giới hạn bởi gió dự báo xấu dần sau ngày 8–10. Ở MKU tầm 16 ngày, gió dự báo giữ được khoảng 3/4 mức trần (+0,35 so với +0,46 trên cùng mẫu thử).

## 4. Giới hạn trung thực

- **Mẫu thử nhỏ**: 2 mùa hè + 2 tháng, 51 lần phát, 14 khối năm-tháng. CI rộng, nhất là OFU. Kho dự báo của Open-Meteo chỉ có từ 2024; muốn dài hơn phải dùng bộ dự báo lại (GEFS reforecast 2000–2019 của NOAA, mở trên AWS nhưng là GRIB toàn cầu, nặng).
- **Chl thời gian thực**: phép thử dùng OC-CCI bản xử lý lại. Chạy thật phải dùng chl gần thời gian thực (CMEMS OC NRT, trễ 1–2 ngày, đã lấp mây — 11-so-nguon.md); lệch giữa hai sản phẩm chưa đo.
- **Mây**: lần phát nào mốc vừa qua bị mây che (< 30 % ô) thì bị bỏ; vận hành thật cần đường lùi (mốc gần nhất có số, hoặc bản lấp mây).
- **Hộp và trục bờ là giả định** (hop.mjs); kết quả có thể đổi nếu hộp đổi.
- **Mồi ≠ cá**; chl mặt ≠ toàn cột nước.

## 5. Dự báo khoá trước (kiểm sau mùa 2027)

Chạy đúng quy trình này mỗi lần phát trong tháng 5–10/2027 (hệ số cố định từ 1998–2023, gió ECMWF IFS ngày phát), ghi lại trước, chấm sau khi chl OC-CCI 2027 ra. Cổng giữ: MKU tầm 8 và 16 ngày MSE skill > 0 với CI loại 0; SCU tầm 8 ngày > 0.
