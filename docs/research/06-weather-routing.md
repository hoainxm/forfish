# 06 — Thuật toán dẫn đường theo thời tiết / Weather routing (Trục 1)

> **Mục đích**: Ghi lại nghiên cứu thuật toán weather-routing đã công bố và cách
> ForFish áp dụng cho tàu cá nhỏ VN trong `src/lib/route-plan.ts`.
> Ngày tổng hợp: 2026-06-10.

---

## 1. Các họ thuật toán trong văn liệu

Tổng quan ngành (Ocean Engineering 2025, "State-of-the-art optimization
algorithms in weather routing") chia các phương pháp thành:

| Họ | Đại diện | Đặc điểm |
|---|---|---|
| **Isochrone** | James 1957; modified isochrone (Hagiwara 1989); 3D isochrone | Nở "mặt sóng" các điểm tới được theo từng bước thời gian. Trực quan, ra đời cho hàng hải; bản gốc khó xử lý ràng buộc đất liền phức tạp |
| **Tìm đường trên đồ thị** | Dijkstra, A* time-dependent | Lưới phủ vùng biển, trọng số cạnh đổi theo giờ dự báo. Nghiệm đúng, dễ thêm ràng buộc cứng (đất, cạn, sóng quá ngưỡng). Isochrone-A* lai tiết kiệm tới ~9% dầu so với tuyến thực tế mùa đông (Ship Sci. Technol. 2024) |
| **Quy hoạch động 2D/3D** | Zoppoli; Shao & Zhou 3DDP | Tối ưu cả tốc độ máy; nặng tính toán hơn |
| **Metaheuristic** | GA, ACO, PSO | Đa mục tiêu, không đảm bảo nghiệm đúng; quá nặng cho client di động |

## 2. Mô hình chọn làm chuẩn: VISIR (CMCC, peer-reviewed, mã nguồn mở)

**VISIR-1** (Mannarini et al., *Geosci. Model Dev.* 9, 1597–1625, 2016 —
"VISIR-I: small vessels, least-time nautical routes using wave forecasts") và
**VISIR-2** (*Geosci. Model Dev.* 17, 4355–4382, 2024 — refactor Python) là mô
hình route tàu **cỡ nhỏ** (motorboat, có cả tàu cá trong case study) được bình
duyệt và mở mã. Cấu trúc VISIR:

1. **Đồ thị lưới** phủ vùng biển, connectivity bậc cao (không chỉ 8 ô kề) để
   giảm sai số rời rạc hoá hướng chạy.
2. **Tìm đường ngắn nhất time-dependent** (Dijkstra biến thể, giả định FIFO).
3. **Ràng buộc TĨNH**: độ sâu (bathymetry) + đường bờ — cạnh chạm đáy nông/bờ
   bị loại khỏi đồ thị.
4. **Ràng buộc ĐỘNG**: ổn định nguyên vẹn của tàu theo sóng (tham chiếu hướng
   dẫn IMO MSC.1/Circ.1228: surf-riding/broaching khi sóng đuôi, parametric
   roll, pure loss of stability).
5. **Giảm tốc trong sóng** (involuntary speed reduction) phụ thuộc chiều cao
   VÀ góc tới của sóng so với hướng chạy (VISIR-2 thêm angle-of-attack cho
   tàu máy).

Giảm tốc theo hướng còn có công thức bán thực nghiệm **Townsin–Kwon** (1982,
cập nhật Kwon 2008): mất tốc lớn nhất khi sóng/gió vỗ mũi; sóng vai/ngang và
sóng đuôi là các PHÂN SỐ của mức sóng mũi (suy từ dữ liệu Aertssen).

## 3. ForFish áp dụng (`src/lib/route-plan.ts`)

| Thành phần VISIR | Bản ForFish (client-side, nguồn miễn phí) |
|---|---|
| Lưới đồ thị | Lưới đều phủ bbox start–dest + lề; bước 4 km trở lên, trần ~7.500 nút; **16 hướng** (8 ô kề + 8 nước mã) |
| Tìm đường | **Dijkstra time-dependent** (nghiệm đúng, FIFO); chi phí = lít dầu ước tính ở ETA từng cạnh; chạy tức thì trên điện thoại |
| Trường thời tiết | Open-Meteo theo GIỜ, 72h, lưới thô ≤120 điểm/lượt (`route-weather.ts`) + **nội suy song tuyến** xuống lưới tìm đường; hướng nội suy bằng vector sin/cos |
| Dòng hải lưu (VISIR-2: velocity composition) | Open-Meteo `ocean_current_velocity/direction` — nền **MeteoFrance SMOC** 0,08° (~8 km), theo giờ, dự báo 10 ngày, **gồm cả dòng triều + Stokes** (đã test thực tế có số cho Biển Đông, không cần key). Cộng vector vào tốc độ qua nước: thành phần dọc hướng chạy cộng thẳng, thành phần ngang trừ vào (vát mũi bù); dòng nội suy theo vector u/v. Quan sát được: tuyến tự bẻ vào dải dòng thuận khi bõ công, từ chối khi dải xa quá |
| Ràng buộc tĩnh | **ETOPO 2022** (NOAA, public domain) đóng gói sẵn 0,05° (~30 KB, `scripts/generate-depth-grid.mjs` → `public/data/depth-grid.v1.bin`): chặn đất + chỗ cạn < 4 m, cảnh báo 4–12 m. Vùng rạn Hoàng Sa/Trường Sa/Macclesfield quét lại ở phân giải gốc 15″ và lấy **lớp nguy hiểm nhất từng ô** (min-pool) vì rạn hẹp ~1 km lọt khe lấy mẫu. Quanh cảng 12 km nới lỏng (tàu thuộc con nước nhà) |
| Ràng buộc động | Chặn cứng sóng ≥ 4 m; phạt ×3 vùng sóng ≥ 2,5 m / gió ≥ cấp 7; **sóng đuôi ±45° cao ≥ 2 m** (đơn giản hoá điều kiện surf-riding/broaching của IMO 1228) tính là vùng dữ — quan sát được: thuật toán tự "chạy chéo" cho sóng vào vai như dân biển |
| Giảm tốc trong sóng | Kwon-lite: ~10%/m trên 0,5 m × hệ số hướng (mũi 1,0 / ngang 0,7 / đuôi 0,4), sàn 55% tốc độ |
| Mô hình dầu | Máy ga cố định → dầu/giờ ≈ hằng số: chậm vì sóng = thêm giờ máy = thêm dầu; ngược gió +0,4%/km/h thành phần ngược (trần +25%), xuôi gió tối đa −8% |

**Khác VISIR ở đâu (và vì sao)**: VISIR tối ưu thời gian/CO₂ với polar tàu chi
tiết (lượng giãn nước, GM…); ngư dân không có số liệu đó nên ForFish chỉ hỏi
2 số đời thường (hải lý/giờ + lít/giờ) và tối ưu LÍT DẦU. Mọi hệ số là ước
lượng bán thực nghiệm — UI bắt buộc gắn nhãn "tham khảo".

**Kiểm chứng đã chạy**: tuyến Rạch Giá → nam Côn Đảo (đường chim bay 180 km
xuyên đất liền) ra tuyến 461 km vòng qua phía nam mũi Cà Mau, né dải cạn
ven bờ, kèm cảnh báo đoạn nước nông — corridor hẹp bản cũ không làm được.

## 4. Hạn chế ghi rõ (để copy UI trung thực)

- ETOPO ~ mực nước trung bình; thuỷ triều VN có nơi ±2 m → ngưỡng 4 m vẫn có
  thể hụt khi triều kiệt; lưới 0,05° không thấy đá ngầm lẻ, luồng lạch, đăng đáy.
- Open-Meteo là mô hình toàn cầu (~25 km cho sóng, ~8 km cho dòng chảy) —
  không thấy sóng cồn cửa sông. Dòng chảy SMOC kèm cảnh báo của chính nguồn:
  "accuracy at coastal areas is limited / not suitable for coastal navigation"
  → copy UI ghi "con nước sát bờ có thể lệch". (Ghi chú: từng tưởng phải dùng
  CMEMS có key — hoá ra Open-Meteo đã phát hành current toàn cầu, đã test có
  số liệu cho Biển Đông.)
- Dự báo 72 giờ; chuyến dài hơn dùng số liệu giờ cuối (ghi chú tự tin giảm dần
  theo tầm — xem `forecastConfidence`).
- FIFO: giả định xuất phát muộn không bao giờ tới sớm hơn — đúng với dự báo
  nội suy tuyến tính theo giờ.

## 5. Nguồn

- Mannarini G. et al. (2016), *VISIR-I: small vessels – least-time nautical
  routes using wave forecasts*, Geosci. Model Dev. 9, 1597–1625.
  https://gmd.copernicus.org/articles/9/1597/2016/
- Mannarini G. et al. (2024), *VISIR-2: ship weather routing in Python*,
  Geosci. Model Dev. 17, 4355–4382. https://gmd.copernicus.org/articles/17/4355/2024/
- Mã nguồn VISIR: https://zenodo.org/records/2563074 · www.visir-model.net
- Townsin R.L., Kwon Y.J. (1982); Kwon Y.J. (2008), *Speed loss due to added
  resistance in wind and waves*. Tóm tắt: https://www.semanticscholar.org/paper/b59f3dbc35a98f499ae503916bd0eb8cb9b6b86a
- Tổng quan 2025: *State-of-the-art optimization algorithms in weather routing*,
  Ocean Engineering. https://www.sciencedirect.com/science/article/pii/S0029801825009114
- Isochrone cải tiến: https://www.tandfonline.com/doi/full/10.1080/17445302.2024.2329011
- IMO MSC.1/Circ.1228 — *Revised guidance to the master for avoiding dangerous
  situations in adverse weather and sea conditions* (2007).
- ETOPO 2022 (NOAA NCEI): https://www.ncei.noaa.gov/products/etopo-global-relief-model
  — lấy qua ERDDAP OceanWatch PIFSC, dataset `ETOPO_2022_v1_15s`.
- Dòng chảy: Open-Meteo Marine API (https://open-meteo.com/en/docs/marine-weather-api)
  — `ocean_current_velocity/direction`, nền MeteoFrance SMOC (CMEMS GLOBAL
  ANALYSISFORECAST PHY), 0,08°, hourly, 10 ngày, gồm Eulerian + Waves + Tides;
  hướng theo quy ước CHẢY TỚI (ngược quy ước gió/sóng).

---

**Last updated**: 2026-06-10
