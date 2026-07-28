# Ops — External Services — ForFish

> Load khi: lỗi liên quan nguồn dữ liệu ngoài (timeout, rate limit, đổi format, token hết hạn), thêm nguồn mới, hoặc audit phụ thuộc.

covers: src/lib/tile-proxy.ts, src/lib/offline-basemap.ts, src/lib/sea.ts, src/lib/marine-weather.ts, src/lib/route-weather.ts, src/lib/forecast-grid.ts, src/lib/scalar-field.ts, src/lib/copernicus-salinity.ts, src/lib/pretrip.ts, src/lib/forecast-ensemble.ts, src/lib/forecast-quality.ts, src/lib/sdwork-assets.ts, src/lib/auth-gateway.ts, src/lib/fish-predict.ts, src/lib/fish-forecast-run.ts, src/lib/fish-snapshot.ts, src/lib/fish-snapshot-policy.ts, src/lib/weather-snapshot.ts, src/lib/weather-snapshot-id.ts, src/lib/hycom.ts, src/lib/copernicus.ts, src/lib/source-registry.ts, src/lib/sst-tendency.ts, src/lib/sea-scalars.ts, src/lib/fuel-price.ts, src/lib/port-price-source.ts
last_verified: 2026-07-26
ttl_days: 180
gate: warn
<!-- re-verified: 2026-06-17 - auth-gateway.ts = SĐT+mật khẩu (signup/sso), bỏ OTP/magic-link/service-key; timeout 20s -->

> Registry CANONICAL cho mọi service ngoài hệ (nguyên tắc 11). Toàn bộ fetch nguồn ngoài BẮT BUỘC `AbortSignal.timeout(...)` + degrade rõ ràng (xem 02-architecture §5).

<!-- re-verified: 2026-06-16 — covers MỞ RỘNG thêm fish-predict/hycom/sea-scalars/fuel-price/port-price-source (trước bỏ sót → drift im). Toàn bộ fetch ngoài đã có AbortSignal.timeout (sweep 2026-06-16: server 15-20s, client 15-25s). -->
<!-- re-verified: 2026-07-25 — forecast-grid.ts (lớp Windy) nay CHỌN KHUNG 3/5/7/10/16 ngày, dùng model sóng ncep_gfswave025 (như sea/marine-weather) + bước giờ tăng dần, client timeout 20s. sea/marine-weather mở 16 ngày (WAVE_MODEL). -->
<!-- re-verified: 2026-07-25b — fish-predict.ts tách cá ngừ đại dương → vây vàng + mắt to (39→40 loài); KHÔNG đổi tích hợp nguồn ERDDAP/HYCOM (URL/UA/timeout giữ nguyên), chỉ là tham số khẩu vị loài. -->
<!-- re-verified: 2026-07-25c — THÊM nguồn runtime ETOPO 2022 (PIFSC ERDDAP) cho fish-forecast: cổng độ sâu chặn loài xa bờ (cá ngừ/cờ/nục heo/mực xà) khỏi ô cạn sát bờ. Row ETOPO thêm vào bảng; degrade .catch→null. -->
<!-- re-verified: 2026-07-25j — CHUẨN BỊ ĐI BIỂN (lib/pretrip.ts): KHÔNG nguồn/endpoint/timeout mới — chỉ gọi lại đúng fetchSeaPoint / fetchFishForecast / fetchForecastGrid, TUẦN TỰ (không song song, khỏi dội Open-Meteo): mỗi chỗ ghim 2 request Open-Meteo + 1 lần /api/fish-forecast + 3 khung lưới (3/7/16) × 2 request = ~2–3 MB/lượt, bà con chủ động bấm ở bờ. Fallback offline forecast-grid SIẾT: chỉ nhận bản lưu ĐÚNG khung ngày đã xin (bỏ loadLatest) — thiếu thì báo thật + liệt kê khung đang có. /api/fish-forecast trả thêm generatedAt để UI nói tuổi thật của bản do SW giữ lại. -->
<!-- re-verified: 2026-07-25d — VIỆC 2: fish-predict.ts đổi CÁCH XỬ LÝ anomaly (noaacrwsstanomalyDaily) + SSHA (noaacwBLENDEDsshDaily) — nay lấy dị thường KHÔNG GIAN (so vùng bên cạnh) thay vì so cả-bồn. KHÔNG thêm nguồn/URL/UA/timeout mới, không thêm fetch; chỉ hậu xử lý grid tại chỗ (spatialAnomaly, ~0.2s cả anom+sla, trong ngân sách route 60s). -->
<!-- re-verified: 2026-07-25k — NỀN BẢN ĐỒ LÚC MẤT SÓNG: (a) glyph font BỎ CDN fonts.openmaptiles.org (dò 2026-07-25: trả HTML redirect, không phải .pbf → nhãn số mét chưa từng hiện) → tự host public/fonts; (b) tile hải đồ EMODnet + phao OpenSeaMap ĐỔI ĐƯỜNG ĐI: client → /api/tiles/{chart|seamark}/{z}/{x}/{y} (same-origin, SW giữ được, danh sách TRẮNG trong lib/tile-proxy.ts); (c) nền CARTO giữ cross-origin cố ý (ToS) → bù bằng nền tối giản trong máy vn-coast.v1.json; (d) proxy contour cũ vẫn CHƯA nối vào style, có lý do. -->
<!-- re-verified: 2026-07-26b — CÁCH DEGRADE ĐỔI (không thêm/bớt nguồn, không đổi URL/UA/timeout): thiếu nguồn nay phải làm ĐIỂM GIẢM chứ không tăng. wMax của soft-OR cố định theo hồ sơ loài (trước suy từ term còn lại → mất nguồn = điểm tăng +43%); thiếu lưới độ sâu ETOPO → DEPTH_UNKNOWN_FIT 0.5 thay vì bỏ cổng. Cột "Khi hỏng" của HYCOM + ETOPO đã sửa cho khớp. -->
<!-- re-verified: 2026-07-28 — THÊM nguồn ERDDAP LỊCH SỬ (chỉ dùng OFFLINE, không đụng runtime): CoralTemp `noaacrwsstDaily` (1985→nay) + chl THÁNG `noaacwNPPVIIRSSQchlaMonthly` (2012→nay) dựng bản đồ MÙA VỤ 12 tháng (public/data/fish-climatology.v1.json, 69×65 ô 0,25°, ~71 KB, SW pre-cache sdfish-v6) qua scripts/collect-fish-climatology.mjs; scripts/fit-fish-blend-weights.mjs backtest 12 mốc gốc × 7 tầm ngày ra tỷ lệ pha trộn w(d). ĐO THẬT (16 mốc gốc, 30–33k ô/tầm): w giảm 0,823 (d1) → 0,547 (d16) tự nhiên đơn điệu, blend THẮNG persistence ở MỌI tầm khi kiểm chéo (+4,4% → +9,0% RMSE), guard always-on-term PASS (biên độ w 0,276). KẾT LUẬN ÂM ghi lại: tách w theo MÙA GIÓ thua bảng chung ở cả 7 tầm khi kiểm chéo (−2,4% … −6,5%) ⇒ giữ MỘT bảng. KHÔNG route mới, KHÔNG đổi payload /api/fish-forecast, runtime KHÔNG gọi thêm nguồn nào. -->
<!-- re-verified: 2026-07-26c — TIMEOUT NGUỒN HAY TREO: HYCOM (OPeNDAP tds.hycom.org) + Copernicus (ARCO Zarr) — cả hai TUỲ CHỌN — nay dùng SLOW_SOURCE_TIMEOUT_MS=12s thay vì GRID_TIMEOUT_MS=20s. Lý do: route /api/fish-forecast gom mọi trường bằng Promise.all → resolveField chờ MỌI load() settle → một nguồn treo 20s KÉO cả route quá mốc hủy 35s của client (fetchFishForecast) ⇒ "dự báo cá chưa tải được" dù SST/phù du (bắt buộc, ~3s) đã sẵn. Chẩn 2026-07-26: HYCOM .dds treo >25s. ERDDAP bắt buộc giữ 20s (nhanh + cốt lõi). fetchHycomGrids(timeoutMs?) + fetchCopernicusCurrents({timeoutMs}). -->
<!-- re-verified: 2026-07-25n — TẢI SẴN nay TỰ CHẠY (bỏ nút "Chuẩn bị đi biển"): KHÔNG nguồn/endpoint/timeout mới, vẫn đúng fetchSeaPoint / fetchFishForecast / fetchForecastGrid chạy TUẦN TỰ, ~2,5–3 MB/lượt. ĐIỂM CẦN NHỚ về tải trọng nguồn: trước bà con chủ động bấm, nay máy tự gọi khi VÀO màn Ra khơi → cửa chặn BẮT BUỘC ở lib/pretrip-auto.ts (shouldAutoPretrip): chỉ chạy khi chưa có bản nào hoặc bản cũ hơn PRETRIP_MIN_INTERVAL_MS=6h (khớp ISR 6h /api/fish-forecast), navigator.onLine=false thì không thử, và chỉ 1 lần mỗi lần mở app → trần thực tế ~4 lượt/máy/ngày thay vì mỗi lần mở màn. Sửa cửa chặn này = đổi tải trọng lên Open-Meteo/ERDDAP, phải cân nhắc kèm. -->
<!-- re-verified: 2026-07-26b — THÊM mục "Copernicus `thetao` — chỉ dùng ĐỂ ĐO, KHÔNG vào runtime": kho ARCO ngày cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m (downsampled4) dùng cho scripts/fish-3day-probe.mjs, chi phí đo thật 4,58 MB / 7,0–7,3 s cho 4 mốc ngày. KHÔNG thêm fetch nào vào /api/fish-forecast (route vẫn 11 fetch NOAA/HYCOM/ETOPO, cold 3,4 s đo thật) vì bản đồ cá D+3 gần như không đổi. lib mới src/lib/sst-tendency.ts vào `covers`; fail-safe: thiếu Copernicus → persistence, không vỡ. -->
<!-- re-verified: 2026-07-26c — route-weather.ts (lưới thời tiết DẪN ĐƯỜNG) thêm CACHE promise TTL 45 phút, khoá bbox+ngày-VN: "Tính lại" / vòng nở khung của route-planner không refetch ~0,7–1,5 MB nữa; lỗi mạng không găm cache (pattern fetchDepthGrid). KHÔNG đổi endpoint/UA/timeout. Hardening cùng đợt: ô sóng-có-số nhưng giờ gió RỖNG → onSea=false; giờ thiếu số sóng → route-plan ước từ gió (estimateWaveFromWind) thay vì 0. -->
<!-- re-verified: 2026-07-26 — SỔ NGUỒN + SO NGÀY (lib/source-registry.ts): mỗi TRƯỜNG của /api/fish-forecast nay có DANH SÁCH ứng viên, chạy song song, lấy bản có ngày MỚI NHẤT, quá tuổi thì vẫn dùng nhưng gắn `stale`. THÊM 2 nguồn ERDDAP dự phòng ĐÃ FETCH THỬ THẬT (200, ~255–300 KB, 3–4 s): SST `noaacrwsstDaily` (CoralTemp, **đơn vị °C không kelvin**) + phù du `noaacwNPPN20S3ASCIDINEOFDaily` (thêm cảm biến Sentinel-3 OLCI). Tổng fetch 9 → 11, VẪN song song nên wall-clock không đổi (đo thật 2026-07-26: route trả trong ~5 s ấm cache). Payload thêm `sources` / `dataQuality` / `targetDate`. -->
<!-- re-verified: 2026-07-28b — THÊM lib/scalar-field.ts: LỚP DẢI MÀU (mây/mưa/nhiệt không khí) kiểu Windy. Nguồn = Open-Meteo forecast (CÙNG endpoint api.open-meteo.com đã dùng cho gió), gộp 5 biến hourly cloud_cover,precipitation,temperature_2m,cape,pressure_msl vào MỘT request (cape = CAPE J/kg cho lớp "Dông" = NGUY CƠ dông/sét, KHÔNG phải sét thật — `lightning_potential` đo thật trả NULL ở VN, chỉ có model châu Âu; sét quan sát thật = Blitzortung, ngoài phạm vi; pressure_msl = áp suất mực biển hPa). ĐỘ MẶN ĐÃ NỐI (Copernicus, hàng riêng bên dưới, probe thật scripts/copernicus-salinity-probe.mjs). Cùng stepHourIndices + timeout 20s + cache offline (lib/forecast-cache, NS "scalar"). Render: nội suy song tuyến → fill + lớp WebGL nền mịn. Loại trừ lẫn nhau với lớp gió/sóng (một overlay/lần). ⚠️ TẢI TRỌNG (2026-07-29): lưới MỞ RỘNG 80→156 điểm (98–123°Đ/1–24°B) × 5 biến × tới 16 ngày — Open-Meteo tính theo trọng số nên ĐÃ DÍNH 429 "Daily API request limit" khi dev test dày; hướng xử: cron snapshot server (weather_snapshot, khoá scalar:*) làm fallback + client vẫn live-first. -->
<!-- re-verified: 2026-07-29b — AUDIT OFFLINE các lớp mới: pretrip THÊM bước tải sẵn LỚP DẢI MÀU (fetchScalarField("cloud", d) cho d∈PRETRIP_SCALAR_DAYS=[3,16] — mỗi lượt MỘT request Open-Meteo ra cả 5 lớp, khớp khoá cache kind.d{gridDays} mà màn Ra khơi xin theo hạng free-3/premium-16) + ĐỘ MẶN (fetchScalarField("salinity") — khoá cache CHUẨN HOÁ salinity.d4 duy nhất bất kể màn xin 3/16, hằng SALINITY_DAYS). Trước đó lớp mới KHÔNG được tải sẵn → ra khơi mở lần đầu là trống. Tải trọng pretrip: +2 request Open-Meteo (156 điểm × 5 biến, khung 3+16) + 1 request same-origin /api/salinity (~140 KB); vẫn tuần tự + cửa chặn 6h pretrip-auto. Production build PASS sau thay đổi. -->
**Last updated**: 2026-07-29

---

## Bảng service ngoài

| Service | Dùng để | Auth | Cấu hình ở đâu | Rate / cache | Khi nó chết thì sao |
|---|---|---|---|---|---|
| **Open-Meteo** (forecast + marine) | Gió/mưa/dông + **sóng theo ngày 1–16** (điểm đi biển); lưới Windy gió/sóng; **lưới DẢI MÀU mây/mưa/nhiệt** (`scalar-field.ts` — `cloud_cover`/`precipitation`/`temperature_2m`); tuyến dầu | Không key | hardcode endpoint trong `lib/sea.ts`, `marine-weather.ts`, `route-weather.ts`, `forecast-grid.ts`, `scalar-field.ts`, `sea-forecast`. **Sóng 16 ngày phải chỉ định `models=ncep_gfswave025`** (best-match sóng chỉ ~8 ngày) — hằng `WAVE_MODEL` | free, cache 6h/1h (sea), client timeout 15s; **lưới tuyến dầu (`route-weather.ts`): cache promise 45 phút theo bbox+ngày-VN** — "Tính lại" không refetch ~1 MB; bản lưu offline `forfish.fc.point.*` theo **ô lưới 0,25°** | Mất mạng → CHỈ lùi về bản lưu **đúng ô lưới của chỗ vừa chạm** (KHÔNG mượn bản của toạ độ khác), gắn cờ `stale` + `savedAt` để UI ghi giờ lưu; chỗ chưa lưu → peek "Chỗ này chưa có số nào lưu trong máy — vuốt lên để thử lại"; ngày sóng thủng ước từ gió (`waveEstimated`); **lưới Windy lùi về bản lưu ĐÚNG khung ngày đã xin** (`forfish.fc.grid.d{N}`) — không có thì báo "máy chưa lưu khung này" + liệt kê khung đang có, KHÔNG đưa lưới khung khác; **tuyến dầu mất sóng lùi về lưới Windy đã lưu** (`route-weather.ts` → `gridToWeatherField` dựng WeatherField từ `loadLongestSavedGrid()`, trục giờ ĐẶT LẠI về 0h hôm nay để bản lưu hôm trước không lệch 24h; `source='grid'` → UI banner "dùng lưới đã lưu, thô hơn + chưa có dòng chảy"), không có lưới nào → báo "mở Ra khơi lúc còn sóng để tải sẵn"; KHÔNG treo |
| **Open-Meteo Ensemble** (GFS-EPS) | Độ bất định dự báo: spread gió 31 thành viên → độ tin từng ngày | Không key, gửi `User-Agent` | `lib/forecast-ensemble.ts` (`ensemble-api.open-meteo.com`, `models=gfs05`) | free, client timeout 15s | `fetchEnsembleUncertainty` trả `null` → độ tin lùi về prior theo tầm ngày (`forecast-quality.ts`), dự báo vẫn chạy |
| **Open-Meteo Archive + Historical-Forecast** (backtest offline) | Học thử độ chính xác: dự-báo-cũ vs thực-tế ERA5 → `forecast-skill.json` | Không key | `scripts/forecast-backtest.mjs` (chạy tay, KHÔNG runtime) — xem [forecast-accuracy.md](forecast-accuracy.md) | — (offline, kết quả commit sẵn) | Không ảnh hưởng runtime; bảng skill thiếu → độ tin/bias lùi về prior |
| **GDACS** (bão) | Tin bão Biển Đông + **đường đi (track) + vùng ảnh hưởng (polygon)** (`/api/storms`) | Không key | `app/api/storms`, `lib/storms.ts` | server 15s + client 20s; route trả `checkedAt` (ISO) — **UI BẮT BUỘC đọc**, tin cũ > `STORM_MAX_AGE_MS` = 12h coi như chưa hỏi được (SW cache `/api/*` network-first nên offline vẫn trả `ok:true` bản cũ) | `stormStatus()` quy về 4 nhánh: lỗi/quá-cũ → banner VÀNG "Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải / Icom." (**CẤM** nói "không có bão"); hỏi được & rỗng → "Không có tin bão … (hỏi lúc HH:MM ngày D/M)"; có bão → vẫn hiện + "Tin lúc HH:MM ngày D/M". Lớp bão (track/vùng) ẩn khi không có tin; bản đồ vẫn chạy |
| **VASEP** (giá bến) | Giá nguyên liệu tuần (`/api/port-prices`) | Không key (scrape) | `lib/port-price-source.ts` | cache 24h | Lùi bảng giá tĩnh + nhãn "tham khảo" |
| **Petrolimex / giaxanghomnay** | Giá dầu DO (`/api/fuel-price`) | Không key (scrape) | `app/api/fuel-price` | cache 6h | Ẩn dòng giá dầu, phần còn lại giữ nguyên |
| **NOAA ERDDAP — LỊCH SỬ** (offline, 2026-07-28) | Dựng **BẢN ĐỒ MÙA VỤ** (`public/data/fish-climatology.v1.json`) + đo **tỷ lệ pha trộn w(d)** (`src/data/fish-blend-weights.json`) | Không key, cùng `ERDDAP_UA` | `scripts/collect-fish-climatology.mjs` (SST `noaacrwsstDaily` — có từ **1985**, lấy stride 10 ngày × 6 năm 2020–2025; phù du `noaacwNPPVIIRSSQchlaMonthly` — ảnh THÁNG sẵn, 2012→nay, stride 6 ≈ 0,25°) · `scripts/fit-fish-blend-weights.mjs` (chl NGÀY `noaacwNPPN20VIIRSDINEOFDaily` cho các mốc lịch sử) | **KHÔNG chạy lúc runtime** — script chạy tay/định kỳ (~1 lần/năm là đủ; mùa vụ đổi rất chậm), ~150 request/lượt, retry 3 lần, timeout 120s | Nguồn chết KHÔNG ảnh hưởng app đang chạy (dữ liệu đã kết tinh thành asset tĩnh). Tháng nào thiếu → điểm 0 → blend tự nghiêng về bản dự báo |
| **NOAA ERDDAP** | SST / phù du / front (dự báo cá) + nước dâng/xoáy (`/api/sea-scalar`) | Không key, **BẮT BUỘC `User-Agent`** (`ERDDAP_UA` trong fish-predict.ts; thiếu → coastwatch trả **403 + HTML** → parse JSON vỡ → `{ok:false}` = cá KHÔNG chạy, chẩn 2026-06-23) | `lib/fish-predict.ts`, `lib/sea-scalars.ts`, `app/api/fish-forecast` (qua **sổ nguồn** `lib/source-registry.ts` — xem §"Sổ nguồn" bên dưới), `app/api/sea-scalar` | cache 6h, **server timeout 20s/lưới** (~250–300 KB/lưới), **client fetch 25-35s** | SST/phù du có **nguồn dự phòng** → một dataset chết vẫn ra bản đồ; chết HẾT nguồn của một trường bắt buộc → route `{ok:false}` → lớp cá pill đỏ "chạm để thử lại", lùi mùa vụ; nguồn treo → fail-fast, KHÔNG treo serverless |
| **HYCOM** (OPeNDAP) | Tầng nhiệt D20 (cá ngừ) + **nhiệt ĐÁY** (loài đáy) + nhiệt 250m | Không key, gửi `User-Agent` (`ERDDAP_UA`) phòng host chặn undici | `lib/hycom.ts` | fetch song song ERDDAP, **timeout 20s** + `.catch→null`; **1 fetch cube → NHIỀU lưới** (`fetchHycomGrids` dùng lại cube cho d20+bottom+deep250, KHÔNG mở DEPTH_RANGE để giữ route 60s) | KHÔNG "chia lại trọng số" nữa (2026-07-26): mốc chuẩn hoá `wMax` CỐ ĐỊNH theo hồ sơ loài → mất D20 làm điểm cá ngừ GIẢM chứ không tăng (trước tăng tới +43%). Loài đáy thiếu nhiệt đáy → fallback SST mặt (không biến mất); treo → null (không treo `await hycomP`) |
| **Copernicus — ĐỘ MẶN** (ARCO Zarr) | Lớp dải màu "Độ mặn" theo NGÀY (`/api/salinity`) | KHÔNG key (kho công khai) | `lib/copernicus-salinity.ts` (server) + `app/api/salinity/route.ts`; dataset `cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m` asset `downsampled4` (bucket **`mdl-arco-time-010`**, KHÁC currents `-015`); PROBE `scripts/copernicus-salinity-probe.mjs` | ISR 6h; **≤4 mốc NGÀY** (hôm nay→+3), mỗi chunk ~1 MB (lz4+shuffle, decodeFloat32Chunk dùng chung); tầng mặt = |elevation| nhỏ nhất (trục elevation GIẢM dần); đơn vị **PSU**; attribution "Generated using E.U. Copernicus Marine Service Information" | Route 503 / `fetchScalarField` lùi bản lưu offline + `stale`; chưa lưu → lớp báo "chưa tải được", bản đồ vẫn chạy |
| **ETOPO 2022** (NOAA PIFSC ERDDAP) | Độ sâu đáy (m) — cổng chặn loài XA BỜ khỏi ô cạn (`bathyGridUrl`/`parseBathyGrid`, `SpeciesProfile.offshore`) | Không key, gửi `ERDDAP_UA` | `lib/fish-predict.ts`, `app/api/fish-forecast` (host `oceanwatch.pifsc.noaa.gov`, stride 60 = 0.25°) | TĨNH (đáy không đổi), cache 6h theo route, timeout 20s + `.catch→null` | Không có lưới độ sâu → **KHÔNG bỏ cổng** (2026-07-26): loài `offshore` nhân `DEPTH_UNKNOWN_FIT = 0.5` ("không biết thì bớt chắc chắn") thay vì ×1 — trước đây ×1 nghĩa là NGUỒN CHẾT LÀM ĐIỂM TĂNG, cá ngừ hiện lại sát bờ. Hệ quả đo trên lưới thật: loài xa bờ VẪN trong payload (≥25) nhưng gần hết ô ≥50 → ở sàn hiển thị 50 bản đồ thưa cá xa bờ tới khi ETOPO sống lại. Forecast vẫn chạy |
| **Overpass / OpenSeaMap** | Phao đèn, báo hiệu gần bờ | Không key | `app/api/nautical` | timeout 25s (nguồn chậm) | Lớp phao ẩn; hải đồ + dự báo vẫn chạy |
| **NASA GIBS / tiles vệ tinh** | Ảnh mây, nhiệt độ, phù du nền bản đồ | Không key | `lib/ocean-map.ts` (buildMapStyle) — **cross-origin thẳng, SW KHÔNG giữ được** | tile CDN | Badge "Chưa tải được"; đổi lớp khác được. Mất sóng → lớp ảnh trống, nhưng nền nước + bờ/đảo trong máy vẫn vẽ |
| **EMODnet Bathymetry** (hải đồ độ sâu) | Lớp "Hải đồ độ sâu" (mặc định khi mở bản đồ) | Không key (CC-BY 4.0) | `lib/tile-proxy.ts` (`chart`) → `app/api/tiles/[src]/[z]/[x]/[y]` → `tiles.emodnet-bathymetry.eu`. **KHÔNG gọi thẳng từ client** — đi same-origin để service worker giữ được ô đã xem | z0–12; CDN `s-maxage` 30 ngày (đáy biển không đổi), SW kho `sdfish-tiles-v1` trần 600 ô | Upstream lỗi/timeout 12s → 204 (ô trống, MapLibre không báo lỗi đỏ). Mất sóng → SW trả ô đã xem; ô chưa xem thì trống, còn đường đẳng sâu `public/data/isobaths.v1.json` (SW giữ sẵn) vẫn vẽ |
| **OpenSeaMap seamark tiles** (phao đèn) | Lớp phao/đèn/báo hiệu z≥8 | Không key (ODbL) | `lib/tile-proxy.ts` (`seamark`) → `app/api/tiles/[src]/...` → `tiles.openseamap.org` | z8–18; `s-maxage` 7 ngày | Như trên: 204 → lớp phao trống, hải đồ + dự báo vẫn chạy |
| **OpenSeaMap depth WMS** (contour) | Contour 250/500/750…m — proxy `app/api/tiles/contour` + `lib/nautical-layers.ts` | Không key (ODbL) | **CHƯA NỐI vào style** (2026-07-25: route dò lại vẫn trả PNG thật) — trùng vạch với đường đẳng sâu tự sinh ở đúng dải zoom bà con dùng → sẽ rối. Quyết định giữ/bỏ chờ review | — | Không ảnh hưởng: không lớp nào gọi |
| **CARTO Voyager** (nền đường bờ/địa danh) | Bản đồ nền | Không key | `lib/ocean-map.ts` — **giữ cross-origin CỐ Ý**: điều khoản CARTO không cho proxy/cache lại tile | tile CDN, 4 subdomain | Mất sóng → tile không về. Bù bằng **nền tối giản trong máy** (`lib/offline-basemap.ts` + `public/data/vn-coast.v1.json`): lớp nền nước `sea-bg` + hình bờ/đảo. KHÔNG bao giờ để màn hình trắng |
| **Natural Earth 1:10m** (bờ + đảo offline) | Sinh `public/data/vn-coast.v1.json` | Không key (public domain) | `scripts/generate-coastline.mjs` — **chạy tay, KHÔNG runtime** | — (kết quả commit sẵn, 215 KB) | Không ảnh hưởng runtime |
| **~~fonts.openmaptiles.org~~** (glyph bản đồ) | Chữ/số trên bản đồ (số mét đường đẳng sâu) | — | **ĐÃ BỎ 2026-07-25**: CDN nay trả trang HTML chuyển hướng thay vì `.pbf` → nhãn KHÔNG hiện. Nay **tự host** `public/fonts/{fontstack}/{range}.pbf` (Noto Sans Regular/Bold, OFL — `public/fonts/OFL.txt`) | asset tĩnh same-origin, SW giữ sẵn dải `0-255` | Không còn phụ thuộc bên ngoài |
| **Supabase — ForFish** (`znzgugvfhgmiszqgjulk`) | Auth (SĐT) + DB owner-only (boats/documents/profiles) | publishable + anon (public env) | Vercel env `NEXT_PUBLIC_SUPABASE_*` | — | Env trống → **demo mode** localStorage, app vẫn dùng được (02 §4) |
| **CRM SDViCo gateway** (`exueouggmbjtjvsvpfya`) | Đồ đã mua (`forfish-gateway`) + đăng nhập SĐT+mật khẩu (`auth-gateway`: action `signup`/`sso`, KHÔNG OTP/magic-link/service-key) | sb_publishable key (in-code ALLOWED_KEYS, verify_jwt:false) | Edge Functions `forfish-gateway`/`auth-gateway` (service key tự cấp trong CRM) | client 20s | `useSdvicoAssets` nấc `error` + Thử lại; chưa nối → `unlinked`. ⚠️ CHUYỂN TIẾP — thay bởi webhook + DB riêng ([04 §5b](../04-data-model.md)) |
| **SDWork webhook** (ingest + provision auth) | Nạp KH/thiết bị/vật tư + tạo tài khoản (SĐT+mật khẩu) vào SDFish | HMAC `SDWORK_WEBHOOK_SECRET` (header `x-sdwork-signature`) | `app/api/sdwork/webhook` + `lib/sdwork-webhook.ts` | SDWork đẩy khi đổi | Sai/thiếu chữ ký → 401/503; rớt event → cron đối soát (Đợt 2); app đọc bản đã nạp, không phụ thuộc SDWork lúc KH mở. Đăng nhập = SĐT+mật khẩu, KHÔNG email/OTP |

## Sổ nguồn `/api/fish-forecast` — nhiều nguồn / một trường, SO NGÀY lấy mới nhất

> Yêu cầu chủ dự án 2026-07-26: *"dữ liệu có nhiều nguồn thì down về so ngày (lấy ngày mới nhất), khi 1 nguồn lỗi thì hệ thống vẫn luôn hoạt động được."*
> Luật thuần + test: [`src/lib/source-registry.ts`](../../../src/lib/source-registry.ts) (`resolveField`) · dựng danh sách ứng viên + compute: [`src/lib/fish-forecast-run.ts`](../../../src/lib/fish-forecast-run.ts) (`computeFishForecast`).

### PRECOMPUTE — cron tính sẵn, route chỉ đọc snapshot (2026-07-26)

> Vì sao: các nguồn trên NẶNG + HAY TREO (HYCOM OPeNDAP, Copernicus Zarr) — tính tại chỗ mỗi lần cache lạnh dễ vượt mốc hủy 35s của client → "dự báo cá chưa tải được". Trị tận gốc: tách compute khỏi request của user.

- **Cron** `/api/cron/refresh-fish` (`computeFishForecast()` → `saveFishSnapshot()`) chạy theo lịch: **GitHub Actions** `.github/workflows/refresh-fish.yml` cron `20 */6 * * *` (best-effort, có thể trễ/bỏ run — không sao vì route có fallback) + **Vercel cron** `vercel.json` `0 2 * * *` (Hobby chỉ ~1 lần/ngày → dự phòng; Pro đổi thành `20 */6 * * *` được).
- **Đọc**: `/api/fish-forecast` → `loadFishSnapshot()` đọc bảng `fish_forecast_snapshot` (service-role, `next.revalidate` 30′ giữ ISR). Chưa có snapshot → tự tính fallback (`computeFishForecast`) → KHÔNG bao giờ trắng bản đồ.
- **Ghi đè**: `shouldReplaceSnapshot` ([`src/lib/fish-snapshot-policy.ts`](../../../src/lib/fish-snapshot-policy.ts), thuần, có test) — không lùi ngày, không thay bản tốt bằng bản hỏng.
- **KÍCH HOẠT** (chưa có thì degrade êm về hành vi cũ): apply migration `0005` + env `CRON_SECRET` (Vercel — Vercel Cron tự gắn header — và GitHub Secret trùng) + GitHub Variable `APP_BASE_URL`. `SUPABASE_SERVICE_ROLE_KEY` đã có.
- I/O: [`src/lib/fish-snapshot.ts`](../../../src/lib/fish-snapshot.ts) (server-only, service-role qua `lib/supabase/admin.ts`).

### LƯỚI AN TOÀN thời tiết Open-Meteo — snapshot là FALLBACK, live là chính (2026-07-26)

> KHÁC snapshot cá (snapshot làm CHÍNH vì nguồn nặng/hay-treo). Open-Meteo NHANH + ỔN ĐỊNH nên client vẫn gọi LIVE trực tiếp (tải phân tán theo IP từng máy — đẩy hết lên 1 server sẽ chạm rate-limit Open-Meteo nhanh hơn). Snapshot server chỉ lùi về khi live LỖI + máy chưa có localStorage.

- **Cron** `/api/cron/refresh-weather` (Vercel cron `30 2 * * *`, chung `CRON_SECRET`): `fetchSeaLive` 10 cảng + `fetchForecastGridLive(3)` + **`fetchScalarFieldsLive(3)` (2026-07-29 — MỘT fetch ra 5 lớp dải màu mây/mưa/nhiệt/dông/áp suất)** → `saveWeatherSnapshot` → bảng `weather_snapshot` (id `sea:<port>` | `grid:d3` | `scalar:<kind>:d3`). Lý do thêm scalar: lưới 156 điểm × 5 biến nặng theo trọng số Open-Meteo — dính 429 khi client gọi dày; cron chạy từ IP Vercel 1 lần/ngày làm lưới an toàn.
- **Fallback client**: `sea.ts` thứ tự cache-TTL → live → `/api/weather-snapshot?id=sea:<port>` → cache cũ; `forecast-grid.ts` live → localStorage → (chỉ d3) `/api/weather-snapshot?id=grid:d3`; `scalar-field.ts` live → localStorage → (chỉ d3) `/api/weather-snapshot?id=scalar:<kind>:d3`. Độ mặn KHÔNG qua đây (Copernicus server-side sẵn, /api/salinity).
- **Chỉ khung MIỄN PHÍ**: lưới >3 ngày là premium, non-premium không tải từ live → KHÔNG snapshot công khai (kẻo lộ). Cảng snapshot đủ 16 ngày vì client vốn đã tải đủ từ live (không lộ thêm).
- Khoá + whitelist thuần: [`src/lib/weather-snapshot-id.ts`](../../../src/lib/weather-snapshot-id.ts) (có test) — chặn `/api/weather-snapshot` thành proxy đọc bảng tuỳ ý.

**Luật `resolveField` (mỗi luật một test)**: (1) mọi ứng viên chạy **song song** `Promise.allSettled` — không tuần tự, ngân sách route 60 s; (2) bỏ ứng viên lỗi / trả `null` / ngày không parse được; (3) trong số còn lại lấy bản có **ngày dữ liệu MỚI NHẤT**, hoà ngày → ứng viên **ưu tiên cao hơn** (đứng trước); (4) `ageDays` tính theo **ngày Việt Nam** (`isoDateVN`), ngày tương lai kẹp về 0; (5) bản mới nhất mà **quá `maxAgeDays` vẫn TRẢ VỀ** (thà ảnh cũ còn hơn không có) nhưng gắn `stale: true` — KHÔNG âm thầm coi là hiện tại; (6) không ứng viên nào dùng được → `null` (trường bắt buộc → `{ok:false}`, trường tuỳ chọn → bỏ yếu tố).

| Trường | Bắt buộc? | Ứng viên (thứ tự ƯU TIÊN) | `maxAgeDays` | Khi trường này rỗng |
|---|---|---|---|---|
| `sst` | **CÓ** | 1. `noaa-blended-sst` — `noaacwBLENDEDsstDaily` (**kelvin**)<br>2. `noaa-coraltemp-sst` — `noaacrwsstDaily` CoralTemp 5km (**°C, KHÔNG kelvin**) | 3 | `{ok:false}` — không bịa bản đồ cá |
| `chl` (phù du) | **CÓ** | 1. `noaa-viirs-dineof-chl` — `noaacwNPPN20VIIRSDINEOFDaily`<br>2. `noaa-multisensor-dineof-chl` — `noaacwNPPN20S3ASCIDINEOFDaily` (thêm Sentinel-3 OLCI) | 7 (mây che nhiều) | `{ok:false}` |
| `sla` (SSHA/xoáy) | không | `noaa-blended-ssh` — `noaacwBLENDEDsshDaily` | 3 | bỏ yếu tố rìa xoáy + nước lõm lạnh |
| `anom` (dị thường nhiệt) | không | `noaa-crw-sst-anomaly` — `noaacrwsstanomalyDaily` | 3 | bỏ yếu tố nước trồi |
| `currents` (u,v) | không | `copernicus-glo-phy-uv-total` — CMEMS `cmems_mod_glo_phy_anfc_merged-uv_PT1H-i`, `utotal`/`vtotal` 1/12° (ARCO Zarr, asset `timeChunked`); **cặp u+v là MỘT ứng viên**, ngày = ngày UTC của mốc GIỜ đã chọn.<br>**KHÔNG có dự phòng — CỐ Ý**: NOAA `noaacwBLENDEDNRTcurrentsDaily` ĐÃ BỊ GỠ khỏi trường này (xem mục Copernicus bên dưới) | 1 (bước 1 giờ) | **bỏ HẲN yếu tố hội tụ dòng** — thà thiếu còn hơn lùi về nhiễu |
| `hycom` (D20 + nhiệt đáy + 250 m) | không | `hycom-gofs` — 1 cube → 3 lưới (OPeNDAP `tds.hycom.org`, **hay treo** → timeout ngắn `SLOW_SOURCE_TIMEOUT_MS` 12s, KHÔNG phải 20s) | 3 | cá ngừ bỏ yếu tố tầng nhiệt; loài đáy fallback SST mặt |
| `bathy` (độ sâu đáy) | không | `etopo-2022-15s` (PIFSC ERDDAP) — **TĨNH**, ngày = hôm nay, `maxAgeDays = STATIC_MAX_AGE_DAYS` (không bao giờ stale) | — | KHÔNG bỏ cổng: loài xa bờ nhân `DEPTH_UNKNOWN_FIT` 0.5 (điểm trần 50 = sàn hiển thị → không dựng lại được điểm nóng sát bờ) |

**Thêm nguồn mới** = thêm phần tử vào mảng ứng viên trong `route.ts` + một dòng ở bảng này. KHÔNG phải sửa luật. Trước khi thêm **PHẢI fetch thử thật** (đúng bbox/stride, kiểm ĐƠN VỊ — CoralTemp là °C còn Blended là kelvin; sai là cả bản đồ lệch 273°).

**Payload thêm** (không phá cấu trúc cũ): `sources[field] = { id, date, ageDays, stale }` (trường vắng mặt = không nguồn nào dùng được), `dataQuality` 0..1, `targetDate` = ngày dữ liệu dùng lọc mùa vụ.
`dataQuality` = 1 − 0,25/trường **bắt buộc** cũ − 0,05/trường **tuỳ chọn** mất hẳn − 0,025/trường tuỳ chọn có-nhưng-cũ (kẹp [0,1]). CHỈ để hạ kỳ vọng — **KHÔNG nhân vào điểm cá**.

**Tải trọng lên NOAA**: 9 → **11 fetch/lượt tính** (thêm 2 nguồn dự phòng) → **9** sau khi gỡ cặp u,v NOAA khỏi trường `currents` (2026-07-26), cộng ~6 request Copernicus (metadata + 3 trục, cache 24 h + 4 chunk dữ liệu). Tất cả **song song** nên wall-clock ≈ lưới chậm nhất, không cộng dồn. Mỗi lưới ~250–300 KB (không phải "vài MB" như ghi trước đây). ISR 6h + cửa chặn `pretrip-auto` giữ trần lượt gọi như cũ. Nếu về sau thêm nhiều ứng viên nữa mà route chạm 60 s thì đổi chiến lược: chỉ gọi dự phòng khi nguồn chính hỏng (mất luật "so ngày lấy mới nhất" — phải cân nhắc, ghi lại lý do).

## Copernicus Marine ARCO (Zarr) — dòng chảy TỔNG, **ĐANG CHẠY trong `/api/fish-forecast`** (từ 2026-07-26)

> Đọc: [`src/lib/copernicus.ts`](../../../src/lib/copernicus.ts) · kiểm chứng: `npx tsx scripts/copernicus-probe.mjs` · hiệu chỉnh: `npx tsx scripts/conv-copernicus-calib.mjs` · test: `src/lib/__tests__/copernicus.test.ts`.
> Trạng thái: là **ứng viên DUY NHẤT** của trường `currents` trong sổ nguồn. NOAA `noaacwBLENDEDNRTcurrentsDaily` **đã gỡ hẳn** khỏi route (bớt 2 fetch).

| Mục | Nội dung |
|---|---|
| Nguồn | Copernicus Marine Service (CMEMS) — sản phẩm `GLOBAL_ANALYSISFORECAST_PHY_001_024`, dataset `cmems_mod_glo_phy_anfc_merged-uv_PT1H-i_202211`, asset **`timeChunked`** (Zarr v2 trên CloudFerro S3) |
| Auth | **KHÔNG cần key, KHÔNG cần đăng nhập** — kho ARCO công khai (fetch thật: HTTP 200). Nếu về sau đòi đăng nhập thì DỪNG và báo, KHÔNG nhúng secret |
| Attribution | Bắt buộc ghi nguồn khi hiển thị: *"Generated using E.U. Copernicus Marine Service Information"* (giấy phép Copernicus Marine, dùng lại tự do kể cả thương mại, có ghi nguồn) |
| Biến dùng | `utotal`/`vtotal` = dòng **TỔNG** (Eulerian + sóng Stokes + triều). Còn có `uo`/`vo` (Eulerian thuần), `utide`/`vtide`, `vsdx`/`vsdy` |
| Độ phân giải | **1/12° ≈ 9 km** (lat 2041 ô −80…90, lon 4320 ô −180…180 — **hệ có dấu, phải quy đổi**), bước **1 giờ** |
| Dự báo tương lai | **CÓ** — trục `time` chạy tới **+9/+10 ngày** so với hôm nay. Route hiện chỉ lấy mốc GẦN BÂY GIỜ nhất; phần dự báo để dành |
| Định dạng | chunk `[1,1,512,2048]`; nén **blosc(lz4, shuffle byte)**, dtype `<f4`, `fill_value` 9.969209968386869e+36 → NaN. Giải nén **tự viết thuần TS**, KHÔNG thêm phụ thuộc. Hộp biển VN **vắt qua ranh lat 1024** ⇒ **2 chunk lat × 1 chunk lon = 2 chunk/biến** (`chunkSpan` + `assembleWindow`, trần `MAX_DATA_CHUNKS = 6`) |
| Ngân sách | `.zmetadata` 12 KB + trục lat/lon/time (cache 24 h) + **4 × ~958 KB** chunk u/v = **3,83 MB**. Đo thật: **1,2 s (ấm) – 4,0 s (lạnh)**. Timeout **12 s** (`SLOW_SOURCE_TIMEOUT_MS` — nguồn tuỳ chọn hay treo không được kéo route quá hạn client 35s; trước là 20s), mọi lỗi → `null` |
| Khi nó chết | `fetchCopernicusCurrents()` trả `null` → `resolveField` cho `currents = null` → **`buildFishForecast` BỎ HẲN term `conv`**. `sources.currents` biến mất, `dataQuality` 1 → 0,95. **KHÔNG lùi về NOAA** — xem lý do dưới. Đo thật kịch bản chặn host: route vẫn **200 trong 1,17 s**, bản đồ vẫn chạy, ô ≥50 giảm 514 → 454, số loài ≥50 giữ nguyên 23 |
| ⚠️ CẤM | Endpoint MOTU cũ `nrt.cmems-du.eu` **đã ngừng và domain bị người khác chiếm**. Chỉ đi qua STAC `stac.marine.copernicus.eu` → S3 `s3.waw3-1.cloudferro.com` |

### Vì sao GỠ HẲN NOAA địa chuyển khỏi `conv` (không giữ làm dự phòng)

NOAA `noaacwBLENDEDNRTcurrentsDaily` khai `standard_name: surface_geostrophic_*_sea_water_velocity`. Dòng **địa chuyển** về mặt vật lý gần như **KHÔNG PHÂN KỲ** (∂u/∂x+∂v/∂y ≈ 0), nên `-(∂u/∂x+∂v/∂y)` trên nó là **NHIỄU VI PHÂN SỐ**, không phải nước dồn thật. Lùi về nhiễu **tệ hơn** không có yếu tố: bất biến monotonic (f0b907d) bảo đảm thiếu nguồn chỉ làm điểm GIẢM, còn nhiễu thì vẽ điểm nóng **sai chỗ**.

Bằng chứng — **tự tương quan KHÔNG GIAN trễ-1 ô của trường phân kỳ** trên lưới đã cắt về hộp biển VN (nhiễu răng cưa → ≈0 hoặc âm; cấu trúc vật lý thật → dương rõ):

| Nguồn / asset | Bước lưới | RMS(phân kỳ)/RMS(xoáy) | **Tự tương quan phân kỳ** | Tải | Thời gian |
|---|---|---|---|---|---|
| NOAA địa chuyển `noaacwBLENDEDNRTcurrentsDaily` | 0,25° | 0,140 | **−0,029** ← NHIỄU | — | — |
| Copernicus `downsampled4` (1/3°) | 0,3333° | 0,369 | 0,510 | 1,33 MB | 1,0–3,5 s |
| **Copernicus `timeChunked` (1/12°) ← ĐANG DÙNG** | 0,0833° | 0,404 | **0,732** | 3,83 MB | 1,2–4,0 s |

`geoChunked` **loại thẳng**: chunk `[4272,1,16,8]` gom theo THỜI GIAN — lấy MỘT mốc giờ cho hộp VN phải tải 312 chunk × 2,2 MB. Sai kiểu truy cập.

**Chọn `timeChunked`** vì (a) tự tương quan 0,732 > 0,510 — trường phân kỳ có cấu trúc rõ hơn hẳn; (b) 1/12° **MỊN HƠN** lưới cá 0,25° nên hội tụ được tính **trên lưới gốc rồi mới lấy mẫu xuống** (đúng chiều vật lý), còn `downsampled4` 1/3° **THÔ HƠN** lưới đích — làm mượt trước rồi mới đạo hàm; (c) thêm 2,5 MB / ~3 s vào một route có ngân sách 60 s và 9 fetch khác chạy song song là an toàn (đo thật route: 1,27 s → 4,07 s lần lạnh, 0,88 s lần ấm).

### Hiệu chỉnh lại `CONV_FULL_PER_DEG` (bắt buộc — `w.conv` từng tuned trên nhiễu)

`convergenceStrength()` chuẩn hoá theo chênh lệch giữa hai ô KỀ NHAU, nên hằng "mỗi ô" **lệ thuộc bước lưới**. Đổi 0,25° → 1/12° là **cùng một dòng chảy** nhưng chênh mỗi ô nhỏ đi 3 lần. Vì vậy hằng nay ghi theo **ĐỘ**: `CONV_FULL_PER_DEG` (`src/lib/fish-predict.ts`), nhân với `gridStepDeg(cur.u.lats)` lúc chạy — đổi nguồn/độ phân giải không phải chỉnh tay nữa.

Số đo (`scripts/conv-copernicus-calib.mjs`, lưới THẬT, 2 ngày hè + 1 ngày đông, hội tụ thô lấy mẫu về ô cá 0,25°, chỉ phía HỘI TỤ >0):

| | p50 | p90 | p99 | max |
|---|---|---|---|---|
| NOAA địa chuyển (nguồn CŨ) | 0,0664 | **0,2218** | 0,929 | 4,06 |
| Copernicus dòng TỔNG | 0,1289 | **0,4395** | 0,996 | 2,03 |

Hằng CŨ 0,1 "mỗi ô 0,25°" = **0,4/độ** = **1,80 × p90 của chính nguồn nó**. Giữ nguyên tỷ lệ đó trên nguồn mới: 0,4395 × 1,80 ≈ 0,79 → chốt **`CONV_FULL_PER_DEG = 0,8`**.

**KHÔNG lấy thẳng p90 = 0,44** như luật `UPW_SCALE`/`COLD_SCALE`/`THERMO_BAND`: đo trên ĐIỂM CUỐI thì 0,44 làm %điểm nóng **PHÌNH** (21,2→23,2 · 21,0→23,4 · 29,5→31,7). Ràng buộc mạnh hơn là **KHÔNG phình**, nên neo theo **dải động cũ** — ở 0,8 phân bố `convTerm` khớp gần y hệt nguồn cũ (mean 0,1214 vs 0,1216; p90 0,3662 vs 0,3720; std KHÔNG GIAN 0,306 vs 0,210), nghĩa là yếu tố hội tụ **không to lên, chỉ ĐÚNG CHỖ hơn**.

**TRƯỚC/SAU trên cùng dữ liệu** (%điểm nóng s≥50 / tổng ô biển; loài đại diện = số ô ≥25 / ≥50):

| Ngày | | hot% | med | p90 | ngừ vây vàng | cá nục | mực lá | cá mối | ghẹ xanh | #loài ≥50 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-07-23 | TRƯỚC (NOAA) | 21,2 | 37 | 62 | 667/221 | 299/84 | 359/48 | 0/0 | 266/90 | 23 |
| | **SAU (Copernicus, 0,8)** | **21,6** | 37 | 62 | 691/215 | 305/83 | 360/48 | 0/0 | 266/94 | 23 |
| | Copernicus HỎNG (bỏ `conv`) | 19,4 | 36 | 60 | 595/196 | 287/77 | 318/40 | 0/0 | 249/88 | 23 |
| 2026-07-24 | TRƯỚC (NOAA) | 21,0 | 37 | 60 | 669/220 | 284/77 | 377/42 | 0/0 | 260/94 | 23 |
| | **SAU (Copernicus, 0,8)** | **21,7** | 37 | 60 | 683/214 | 291/76 | 373/47 | 0/0 | 252/94 | 23 |
| 2026-01-15 (đông) | TRƯỚC (NOAA) | 29,5 | 44 | 57 | 815/108 | 0/0 | 0/0 | 763/344 | 359/110 | 21 |
| | **SAU (Copernicus, 0,8)** | **28,7** | 43 | 57 | 819/91 | 0/0 | 0/0 | 767/342 | 349/116 | 21 |

Không loài nào biến mất (số loài đạt sàn hiển thị giữ nguyên 23 hè / 21 đông ở MỌI kịch bản). `cá mối` 0/0 tháng 7 và `cá nục`/`mực lá` 0/0 tháng 1 là **mùa vụ**, đúng như bản TRƯỚC. Giáp xác giữ nguyên `w.conv ≈ 0,12` (loài ĐÁY, dòng MẶT không gom chúng) — **không đụng**; `w.conv` của 40 loài **không đổi một số nào**, chỉ đổi hằng chuẩn hoá.

**Đo trên API THẬT** (`GET /api/fish-forecast`, dev server, cache `.next` xoá sạch mỗi lần):

| | thời gian | payload | ô trả về | ô ≥50 | med / p90 | #loài ≥50 | `dataQuality` | `sources.currents` |
|---|---|---|---|---|---|---|---|---|
| TRƯỚC | 1,27 s | 344 KB | 2239 | 494 (22,1%) | 38 / 61 | 23 | 1 | `noaa-blended-currents`, ảnh **2 ngày tuổi** |
| **SAU** | 4,07 s (lạnh) · 0,88 s (ấm) | 345 KB | 2237 | 514 (23,0%) | 37 / 61 | 23 | 1 | `copernicus-glo-phy-uv-total`, **ageDays 0** |
| SAU, chặn host Copernicus | 1,17 s | 332 KB | 2210 | 454 (20,5%) | 36 / 60 | 23 | **0,95** | *(vắng mặt)* |


### Copernicus `thetao` (nhiệt mặt) — chỉ dùng ĐỂ ĐO, **KHÔNG vào runtime** (2026-07-26)

> Đọc: [`src/lib/sst-tendency.ts`](../../../src/lib/sst-tendency.ts) · đo lại: `npx tsx scripts/fish-3day-probe.mjs [--date=YYYY-MM-DD]` · bảng kỹ năng: `src/data/copernicus-tendency-skill.json`.

| Mục | Nội dung |
|---|---|
| Dataset | `GLOBAL_ANALYSISFORECAST_PHY_001_024` / `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406`, asset `downsampled4` (bucket `mdl-arco-time-012`) — biến `thetao`, trung bình NGÀY, chọn tầng `elevation` gần mặt nhất |
| Auth / attribution | Như bảng `merged-uv` ở trên: không key, bắt buộc ghi *"Generated using E.U. Copernicus Marine Service Information"* nếu hiển thị |
| Chi phí ĐO THẬT | `.zmetadata` + trục (time/elevation/lat/lon) + **1 chunk ≈ 668 KB cho MỖI ngày** ⇒ D+0..D+3 = **4,58 MB / 7,0–7,3 s** trên dây. Cộng vào route hiện tại (~3,4 s cold) là **gấp ~3 lần thời gian** cho một thứ không đổi được bản đồ |
| Trạng thái | **KHÔNG nối vào `/api/fish-forecast`.** Đo xong thấy kéo nhiệt tới +3 ngày chỉ làm 0,5–1,6 % số ô đổi trạng thái điểm nóng (Jaccard 0,93–0,98, 3 mùa) ⇒ không đáng tiền băng thông lẫn thời gian route. Xem 01-product + 07-design-spec §10.5 |
| Nếu sau này nối vào | `anchoredSstGrid()` đã fail-safe sẵn: thiếu chunk / ô NaN / snap xa > 0,5° / biên độ > 5 °C đều **rơi êm về persistence** (bản đồ chạy y như hôm nay). Phải bọc `.catch → null` như `fetchCopernicusCurrents` và giữ ngân sách route 60 s |

## Quy tắc

1. **Cột "khi nó chết thì sao" là bắt buộc** — đây là cột cần lúc 2h sáng. Mọi nguồn phải degrade, KHÔNG để treo UI hay báo lỗi câm (đã enforce qua roadmap "thất bại lên tiếng").
2. **Token/secret ghi ĐƯỜNG DẪN, không ghi giá trị** — kiến trúc zero-secret: chỉ env public trên Vercel; service key sống trong Edge Function CRM.
3. **Nguồn mới = dòng mới CÙNG commit** với code tích hợp (Doc+Test sync).
4. Đây KHÔNG phải cron/agent thường trực (Vercel serverless + Edge Functions) → không cần runbook start/stop; vận hành = deploy Vercel + Supabase MCP. Sự cố nguồn ngoài → đọc bảng này TRƯỚC khi sửa code.
