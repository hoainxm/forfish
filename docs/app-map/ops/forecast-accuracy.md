# Ops — Forecast Accuracy ("học thử") — SDFish

> Load khi: hiệu chỉnh điểm đi biển theo tầm ngày, gán nhãn độ tin dự báo, chạy lại bộ đo skill, hoặc nghi bảng `forecast-skill.json` đã cũ.

covers: scripts/forecast-backtest.mjs, src/data/forecast-skill.json, src/lib/forecast-skill.ts
last_verified: 2026-07-25
ttl_days: 90
gate: warn

> Bảng **skill** đo độ chính xác của engine dự báo biển 15 ngày (Trục 1). So DỰ-BÁO-CŨ với THỰC-TẾ để biết sai số tăng bao nhiêu theo tầm ngày (lead 1..15), rồi kết tinh thành `src/data/forecast-skill.json` để (a) hiệu chỉnh **bias** điểm số và (b) gán nhãn **độ tin TRUNG THỰC**.

**Last updated**: 2026-07-25

---

## 1. Vì sao có bộ đo này

`src/lib/sea.ts` cho điểm đi biển 1–100 chủ yếu từ `wave_height_max` và `wind_speed_10m_max`, kéo dài tới 15 ngày. Dự báo càng xa càng sai — nhưng UI không được **hứa** độ chính xác mà nguồn không bảo đảm (KHÔNG ĐƯỢC #3 trong CLAUDE.md). Bộ đo này biến câu "xa thì kém tin" thành **con số thật đo được**, để app nói thật với bà con: ngày mai tin được bao nhiêu, ngày 15 tin được bao nhiêu.

Đây là **skill thống kê tham khảo**, KHÔNG phải bảo chứng. Một lần chạy đo trên một cửa sổ quá khứ; biển động bất thường (bão) vẫn có thể lệch xa con số trung bình. Luôn kèm lời nhắc nghe đài duyên hải.

## 2. Nguồn dữ liệu (Open-Meteo free, không key)

| Vai trò | Endpoint | Biến | Ghi chú |
|---|---|---|---|
| **Dự-báo-cũ (gió)** | `single-runs-api.open-meteo.com/v1/forecast` | `daily=wind_speed_10m_max` | Chọn đúng lần khởi tạo bằng `&run=<init>T00:00` (00:00 theo `timezone`). Model mặc định GFS → tầm **16 ngày** → lead 1..15. |
| **Dự-báo-cũ (sóng)** | `single-runs-api.open-meteo.com/v1/forecast` | `hourly=wave_height&models=gwam` | Model sóng gwam tầm **~7 ngày** → tự gom daily-max → lead **1..~6**. |
| **Thực tế (gió)** | `archive-api.open-meteo.com/v1/archive` | `daily=wind_speed_10m_max` | Tái phân tích ERA5, gần realtime (có dữ liệu tới ~hôm nay). |
| **Thực tế (sóng)** | `marine-api.open-meteo.com/v1/marine` | `daily=wave_height_max` | Marine archive ERA5-Ocean. |

Tất cả gọi với `timezone=GMT` để căn ngày khớp giữa dự báo và thực tế.

### Vì sao dùng Single Runs API (đã xác minh 2026-07-25)
- **historical-forecast-api KHÔNG cho chọn lead/init** — trả một chuỗi tái dựng, không theo tầm ngày. → không đo skill được.
- **Previous Runs API** chỉ tới lead 7; biến daily-max `_previous_dayN` không được chấp nhận, host `/v1/marine` trả 404 và `wave_height` trả null. → không dùng cho sóng.
- **Single Runs API** (`&run=`) lấy trọn tầm dự báo của đúng một lần khởi tạo quá khứ → nguồn init-anchored đúng nhất cho 15 ngày. Sóng chỉ có `models=gwam` trả số thật (ewam "no data", ecmwf_wam025/meteofrance_wave/best_match trả null tại toạ độ VN).

## 3. Phương pháp backtest

Với mỗi cảng (10 cảng thật trong `src/data/ports.ts`) và mỗi ngày khởi tạo `d` (cửa sổ hôm nay−51 … hôm nay−18, bước 3 ngày → 12 init):

1. Lấy chuỗi dự báo khởi tạo tại `d` (gió tới 16 ngày, sóng tới ~7 ngày).
2. Với mỗi ngày hợp lệ `d+L` (lead `L = 1..15`): ghép **forecast(d, d+L)** với **actual(d+L)** từ archive ERA5.
3. Gom mọi cảng × mọi init theo từng lead `L`, tính:
   - `windMae[L] = mean(|forecast − actual|)` (km/h)
   - `windBias[L] = mean(forecast − actual)` — dương = dự báo **thổi to** hơn thực tế
   - `waveMae[L]`, `waveBias[L]` (m) — tương tự
   - `n` = số cặp gió, `nWave` = số cặp sóng

Sóng lead 7..15 **không có nguồn dự-báo-lưu-trữ** trong Open-Meteo free → `waveMae/waveBias = null`, `nWave = 0`. Trung thực: không bịa số.

## 4. Công thức độ tin (confidence)

```
confidence[L] = clamp( 1 − windMae[L] / MAE_REF_WIND , 0, 1 )      MAE_REF_WIND = 12 km/h
```

- Chọn **gió** làm trục chính vì có đủ dữ liệu 1..15 (sóng thiếu 7..15).
- `MAE_REF_WIND = 12 km/h` là **hằng số cố định**: mốc sai số gió mà điểm `sea.ts` đã lệch đáng kể (phạt 1.2 điểm/(km/h) trên 20 km/h → MAE 12 km/h ~ dao động điểm ±14 → "khó tin"). Hằng số ⇒ confidence có nghĩa **tuyệt đối**, không trôi theo dữ liệu mỗi lần chạy. Đổi mốc = đổi thang tin (bump doc + regen).

## 5. Cách agent chính tích hợp

- **Hiệu chỉnh bias**: điều chỉnh `windMax` (và `waveMax` cho lead ≤6) trước khi chấm điểm, ví dụ `windCorrected = windForecast − windBias[L]` (bù xu hướng thổi to/nhỏ). Chỉ áp khi `n` đủ lớn.
- **Nhãn độ tin**: map `confidence[L]` → chip TRUNG THỰC ("tin cao / vừa / tham khảo"). KHÔNG che đi độ bất định — con số thấp ở lead xa là thông điệp, không phải lỗi.
- Với sóng lead ≥7 (`waveMae = null`): dựa vào `confidence` (nền gió) và ghi rõ "sóng xa ngày không đo được độ chính xác".

## 6. Chạy lại

```bash
node scripts/forecast-backtest.mjs      # ~1–2 phút, cần mạng, không cần key
```

Ghi đè `src/data/forecast-skill.json`. Script: timeout 20 s/fetch, retry nhẹ, in tiến độ, **ghi tạm sau mỗi cảng** (mạng rớt vẫn giữ phần đã thu). Cảng/ngày lỗi → bỏ qua cặp đó, giảm `n`, không làm hỏng cả bảng. Cửa sổ init tự tính theo ngày hiện tại nên chạy lúc nào cũng lấy 45–50 ngày gần nhất.

Nên chạy lại mỗi mùa (`ttl_days: 90`) vì skill model đổi theo mùa gió. Kết quả tham chiếu (2026-07-25, sampleSize 2394): gió MAE ~3.0 km/h ở lead 1 → ~8.0 ở lead 15; confidence 0.75 → 0.33; sóng MAE ~0.17 m (lead 1) → ~0.27 m (lead 6).

## 7. Giới hạn / cảnh báo TRUNG THỰC

- **Không phải bảo chứng**: trung bình trên cửa sổ quá khứ; bão/dông bất thường vẫn lệch xa.
- **Sóng chỉ đo tới ~lead 6**; xa hơn là khoảng trống dữ liệu, KHÔNG suy đoán.
- **`n` nhỏ** (12 init × 10 cảng ≈ 120 cặp gió/lead, 99 cặp sóng/lead 1..6): đủ ra xu hướng, chưa đủ cho khoảng tin cậy hẹp. Tăng `INIT_BACK_START`/giảm `INIT_STEP_DAYS` nếu cần nhiều mẫu hơn.
- **ERA5 = "thực tế" tham chiếu**, không phải quan trắc tại phao — bản thân nó cũng là mô hình tái phân tích.
- Một cảng có thể thiếu sóng (vd Rạch Giá: gwam "no data" tại toạ độ trong vịnh) → `nWave` cảng đó = 0, đã tính vào tổng.
