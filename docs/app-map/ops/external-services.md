# Ops — External Services — ForFish

> Load khi: lỗi liên quan nguồn dữ liệu ngoài (timeout, rate limit, đổi format, token hết hạn), thêm nguồn mới, hoặc audit phụ thuộc.

covers: src/lib/tile-proxy.ts, src/lib/offline-basemap.ts, src/lib/sea.ts, src/lib/marine-weather.ts, src/lib/route-weather.ts, src/lib/forecast-grid.ts, src/lib/pretrip.ts, src/lib/forecast-ensemble.ts, src/lib/forecast-quality.ts, src/lib/sdwork-assets.ts, src/lib/auth-gateway.ts, src/lib/fish-predict.ts, src/lib/hycom.ts, src/lib/copernicus.ts, src/lib/source-registry.ts, src/lib/sea-scalars.ts, src/lib/fuel-price.ts, src/lib/port-price-source.ts
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
<!-- re-verified: 2026-07-25n — TẢI SẴN nay TỰ CHẠY (bỏ nút "Chuẩn bị đi biển"): KHÔNG nguồn/endpoint/timeout mới, vẫn đúng fetchSeaPoint / fetchFishForecast / fetchForecastGrid chạy TUẦN TỰ, ~2,5–3 MB/lượt. ĐIỂM CẦN NHỚ về tải trọng nguồn: trước bà con chủ động bấm, nay máy tự gọi khi VÀO màn Ra khơi → cửa chặn BẮT BUỘC ở lib/pretrip-auto.ts (shouldAutoPretrip): chỉ chạy khi chưa có bản nào hoặc bản cũ hơn PRETRIP_MIN_INTERVAL_MS=6h (khớp ISR 6h /api/fish-forecast), navigator.onLine=false thì không thử, và chỉ 1 lần mỗi lần mở app → trần thực tế ~4 lượt/máy/ngày thay vì mỗi lần mở màn. Sửa cửa chặn này = đổi tải trọng lên Open-Meteo/ERDDAP, phải cân nhắc kèm. -->
<!-- re-verified: 2026-07-26 — SỔ NGUỒN + SO NGÀY (lib/source-registry.ts): mỗi TRƯỜNG của /api/fish-forecast nay có DANH SÁCH ứng viên, chạy song song, lấy bản có ngày MỚI NHẤT, quá tuổi thì vẫn dùng nhưng gắn `stale`. THÊM 2 nguồn ERDDAP dự phòng ĐÃ FETCH THỬ THẬT (200, ~255–300 KB, 3–4 s): SST `noaacrwsstDaily` (CoralTemp, **đơn vị °C không kelvin**) + phù du `noaacwNPPN20S3ASCIDINEOFDaily` (thêm cảm biến Sentinel-3 OLCI). Tổng fetch 9 → 11, VẪN song song nên wall-clock không đổi (đo thật 2026-07-26: route trả trong ~5 s ấm cache). Payload thêm `sources` / `dataQuality` / `targetDate`. -->
**Last updated**: 2026-07-26

---

## Bảng service ngoài

| Service | Dùng để | Auth | Cấu hình ở đâu | Rate / cache | Khi nó chết thì sao |
|---|---|---|---|---|---|
| **Open-Meteo** (forecast + marine) | Gió/mưa/dông + **sóng theo ngày 1–16** (điểm đi biển); lưới Windy; tuyến dầu | Không key | hardcode endpoint trong `lib/sea.ts`, `marine-weather.ts`, `route-weather.ts`, `forecast-grid.ts`, `sea-forecast`. **Sóng 16 ngày phải chỉ định `models=ncep_gfswave025`** (best-match sóng chỉ ~8 ngày) — hằng `WAVE_MODEL` | free, cache 6h/1h (sea), client timeout 15s; bản lưu offline `forfish.fc.point.*` theo **ô lưới 0,25°** | Mất mạng → CHỈ lùi về bản lưu **đúng ô lưới của chỗ vừa chạm** (KHÔNG mượn bản của toạ độ khác), gắn cờ `stale` + `savedAt` để UI ghi giờ lưu; chỗ chưa lưu → peek "Chỗ này chưa có số nào lưu trong máy — vuốt lên để thử lại"; ngày sóng thủng ước từ gió (`waveEstimated`); **lưới Windy lùi về bản lưu ĐÚNG khung ngày đã xin** (`forfish.fc.grid.d{N}`) — không có thì báo "máy chưa lưu khung này" + liệt kê khung đang có, KHÔNG đưa lưới khung khác; KHÔNG treo |
| **Open-Meteo Ensemble** (GFS-EPS) | Độ bất định dự báo: spread gió 31 thành viên → độ tin từng ngày | Không key, gửi `User-Agent` | `lib/forecast-ensemble.ts` (`ensemble-api.open-meteo.com`, `models=gfs05`) | free, client timeout 15s | `fetchEnsembleUncertainty` trả `null` → độ tin lùi về prior theo tầm ngày (`forecast-quality.ts`), dự báo vẫn chạy |
| **Open-Meteo Archive + Historical-Forecast** (backtest offline) | Học thử độ chính xác: dự-báo-cũ vs thực-tế ERA5 → `forecast-skill.json` | Không key | `scripts/forecast-backtest.mjs` (chạy tay, KHÔNG runtime) — xem [forecast-accuracy.md](forecast-accuracy.md) | — (offline, kết quả commit sẵn) | Không ảnh hưởng runtime; bảng skill thiếu → độ tin/bias lùi về prior |
| **GDACS** (bão) | Tin bão Biển Đông + **đường đi (track) + vùng ảnh hưởng (polygon)** (`/api/storms`) | Không key | `app/api/storms`, `lib/storms.ts` | server 15s + client 20s; route trả `checkedAt` (ISO) — **UI BẮT BUỘC đọc**, tin cũ > `STORM_MAX_AGE_MS` = 12h coi như chưa hỏi được (SW cache `/api/*` network-first nên offline vẫn trả `ok:true` bản cũ) | `stormStatus()` quy về 4 nhánh: lỗi/quá-cũ → banner VÀNG "Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải / Icom." (**CẤM** nói "không có bão"); hỏi được & rỗng → "Không có tin bão … (hỏi lúc HH:MM ngày D/M)"; có bão → vẫn hiện + "Tin lúc HH:MM ngày D/M". Lớp bão (track/vùng) ẩn khi không có tin; bản đồ vẫn chạy |
| **VASEP** (giá bến) | Giá nguyên liệu tuần (`/api/port-prices`) | Không key (scrape) | `lib/port-price-source.ts` | cache 24h | Lùi bảng giá tĩnh + nhãn "tham khảo" |
| **Petrolimex / giaxanghomnay** | Giá dầu DO (`/api/fuel-price`) | Không key (scrape) | `app/api/fuel-price` | cache 6h | Ẩn dòng giá dầu, phần còn lại giữ nguyên |
| **NOAA ERDDAP** | SST / phù du / front (dự báo cá) + nước dâng/xoáy (`/api/sea-scalar`) | Không key, **BẮT BUỘC `User-Agent`** (`ERDDAP_UA` trong fish-predict.ts; thiếu → coastwatch trả **403 + HTML** → parse JSON vỡ → `{ok:false}` = cá KHÔNG chạy, chẩn 2026-06-23) | `lib/fish-predict.ts`, `lib/sea-scalars.ts`, `app/api/fish-forecast` (qua **sổ nguồn** `lib/source-registry.ts` — xem §"Sổ nguồn" bên dưới), `app/api/sea-scalar` | cache 6h, **server timeout 20s/lưới** (~250–300 KB/lưới), **client fetch 25-35s** | SST/phù du có **nguồn dự phòng** → một dataset chết vẫn ra bản đồ; chết HẾT nguồn của một trường bắt buộc → route `{ok:false}` → lớp cá pill đỏ "chạm để thử lại", lùi mùa vụ; nguồn treo → fail-fast, KHÔNG treo serverless |
| **HYCOM** (OPeNDAP) | Tầng nhiệt D20 (cá ngừ) + **nhiệt ĐÁY** (loài đáy) + nhiệt 250m | Không key, gửi `User-Agent` (`ERDDAP_UA`) phòng host chặn undici | `lib/hycom.ts` | fetch song song ERDDAP, **timeout 20s** + `.catch→null`; **1 fetch cube → NHIỀU lưới** (`fetchHycomGrids` dùng lại cube cho d20+bottom+deep250, KHÔNG mở DEPTH_RANGE để giữ route 60s) | KHÔNG "chia lại trọng số" nữa (2026-07-26): mốc chuẩn hoá `wMax` CỐ ĐỊNH theo hồ sơ loài → mất D20 làm điểm cá ngừ GIẢM chứ không tăng (trước tăng tới +43%). Loài đáy thiếu nhiệt đáy → fallback SST mặt (không biến mất); treo → null (không treo `await hycomP`) |
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
> Luật thuần + test: [`src/lib/source-registry.ts`](../../../src/lib/source-registry.ts) (`resolveField`) · dựng danh sách ứng viên: `src/app/api/fish-forecast/route.ts`.

**Luật `resolveField` (mỗi luật một test)**: (1) mọi ứng viên chạy **song song** `Promise.allSettled` — không tuần tự, ngân sách route 60 s; (2) bỏ ứng viên lỗi / trả `null` / ngày không parse được; (3) trong số còn lại lấy bản có **ngày dữ liệu MỚI NHẤT**, hoà ngày → ứng viên **ưu tiên cao hơn** (đứng trước); (4) `ageDays` tính theo **ngày Việt Nam** (`isoDateVN`), ngày tương lai kẹp về 0; (5) bản mới nhất mà **quá `maxAgeDays` vẫn TRẢ VỀ** (thà ảnh cũ còn hơn không có) nhưng gắn `stale: true` — KHÔNG âm thầm coi là hiện tại; (6) không ứng viên nào dùng được → `null` (trường bắt buộc → `{ok:false}`, trường tuỳ chọn → bỏ yếu tố).

| Trường | Bắt buộc? | Ứng viên (thứ tự ƯU TIÊN) | `maxAgeDays` | Khi trường này rỗng |
|---|---|---|---|---|
| `sst` | **CÓ** | 1. `noaa-blended-sst` — `noaacwBLENDEDsstDaily` (**kelvin**)<br>2. `noaa-coraltemp-sst` — `noaacrwsstDaily` CoralTemp 5km (**°C, KHÔNG kelvin**) | 3 | `{ok:false}` — không bịa bản đồ cá |
| `chl` (phù du) | **CÓ** | 1. `noaa-viirs-dineof-chl` — `noaacwNPPN20VIIRSDINEOFDaily`<br>2. `noaa-multisensor-dineof-chl` — `noaacwNPPN20S3ASCIDINEOFDaily` (thêm Sentinel-3 OLCI) | 7 (mây che nhiều) | `{ok:false}` |
| `sla` (SSHA/xoáy) | không | `noaa-blended-ssh` — `noaacwBLENDEDsshDaily` | 3 | bỏ yếu tố rìa xoáy + nước lõm lạnh |
| `anom` (dị thường nhiệt) | không | `noaa-crw-sst-anomaly` — `noaacrwsstanomalyDaily` | 3 | bỏ yếu tố nước trồi |
| `currents` (u,v) | không | `noaa-blended-currents` — `noaacwBLENDEDNRTcurrentsDaily`; **cặp u+v là MỘT ứng viên** (thiếu một vế / lệch cỡ lưới = hỏng cả cặp), ngày lấy vế CŨ hơn | 3 | bỏ yếu tố hội tụ dòng |
| `hycom` (D20 + nhiệt đáy + 250 m) | không | `hycom-gofs` — 1 cube → 3 lưới | 3 | cá ngừ bỏ yếu tố tầng nhiệt; loài đáy fallback SST mặt |
| `bathy` (độ sâu đáy) | không | `etopo-2022-15s` (PIFSC ERDDAP) — **TĨNH**, ngày = hôm nay, `maxAgeDays = STATIC_MAX_AGE_DAYS` (không bao giờ stale) | — | KHÔNG bỏ cổng: loài xa bờ nhân `DEPTH_UNKNOWN_FIT` 0.5 (điểm trần 50 = sàn hiển thị → không dựng lại được điểm nóng sát bờ) |

**Thêm nguồn mới** = thêm phần tử vào mảng ứng viên trong `route.ts` + một dòng ở bảng này. KHÔNG phải sửa luật. Trước khi thêm **PHẢI fetch thử thật** (đúng bbox/stride, kiểm ĐƠN VỊ — CoralTemp là °C còn Blended là kelvin; sai là cả bản đồ lệch 273°).

**Payload thêm** (không phá cấu trúc cũ): `sources[field] = { id, date, ageDays, stale }` (trường vắng mặt = không nguồn nào dùng được), `dataQuality` 0..1, `targetDate` = ngày dữ liệu dùng lọc mùa vụ.
`dataQuality` = 1 − 0,25/trường **bắt buộc** cũ − 0,05/trường **tuỳ chọn** mất hẳn − 0,025/trường tuỳ chọn có-nhưng-cũ (kẹp [0,1]). CHỈ để hạ kỳ vọng — **KHÔNG nhân vào điểm cá**.

**Tải trọng lên NOAA**: 9 → **11 fetch/lượt tính** (thêm 2 nguồn dự phòng), tất cả **song song** nên wall-clock ≈ lưới chậm nhất, không cộng dồn. Mỗi lưới ~250–300 KB (không phải "vài MB" như ghi trước đây). ISR 6h + cửa chặn `pretrip-auto` giữ trần lượt gọi như cũ. Nếu về sau thêm nhiều ứng viên nữa mà route chạm 60 s thì đổi chiến lược: chỉ gọi dự phòng khi nguồn chính hỏng (mất luật "so ngày lấy mới nhất" — phải cân nhắc, ghi lại lý do).

## Copernicus Marine ARCO (Zarr) — dòng chảy TỔNG, nguồn thứ hai *(thư viện xong, CHƯA nối vào route)*

> Đọc: [`src/lib/copernicus.ts`](../../../src/lib/copernicus.ts) · kiểm chứng: `node scripts/copernicus-probe.mjs` · test: `src/lib/__tests__/copernicus.test.ts`.
> Trạng thái 2026-07-26: thư viện + kiểm chứng ĐÃ XONG, **chưa** thêm vào sổ nguồn `/api/fish-forecast` (chờ chốt đổi nguồn `currents`).

| Mục | Nội dung |
|---|---|
| Nguồn | Copernicus Marine Service (CMEMS) — sản phẩm `GLOBAL_ANALYSISFORECAST_PHY_001_024`, dataset `cmems_mod_glo_phy_anfc_merged-uv_PT1H-i_202211`, asset **`downsampled4`** (Zarr v2 trên CloudFerro S3) |
| Auth | **KHÔNG cần key, KHÔNG cần đăng nhập** — kho ARCO công khai (fetch thật 2026-07-26: HTTP 200). Nếu về sau đòi đăng nhập thì DỪNG và báo, KHÔNG nhúng secret |
| Attribution | Bắt buộc ghi nguồn khi hiển thị: *"Generated using E.U. Copernicus Marine Service Information"* (giấy phép Copernicus Marine, dùng lại tự do kể cả thương mại, có ghi nguồn) |
| Biến dùng | `utotal`/`vtotal` = dòng **TỔNG** (Eulerian + sóng Stokes + triều). Còn có `uo`/`vo` (Eulerian thuần), `utide`/`vtide`, `vsdx`/`vsdy` |
| Độ phân giải | **1/3°** (lat 511 ô −80…90, lon 1080 ô −180…180 — **hệ có dấu, phải quy đổi**), bước **1 giờ** |
| Dự báo tương lai | **CÓ** — trục `time` chạy tới **+9/+10 ngày** so với hôm nay (đo 2026-07-26: mốc cuối 2026-08-03T23Z). Khác hẳn NOAA/HYCOM chỉ có nowcast ⇒ dùng được cho trục thời gian bản đồ cá |
| Định dạng | chunk `[1,1,511,1080]` ⇒ **1 chunk = toàn cầu 1 mốc giờ**; nén **blosc(lz4, shuffle byte)**, dtype `<f4`, `fill_value` 9.969209968386869e+36 → NaN. Giải nén **tự viết thuần TS**, KHÔNG thêm phụ thuộc |
| Ngân sách | `.zmetadata` 12 KB + trục lat/lon/time ~9 KB (cache 24h) + **2 × 668 KB** chunk u/v. Đo thật: **~1,33 MB, 3,7–4,3 s**; giải nén ~40 ms/chunk. Timeout 20 s + `.catch → null` |
| Khi nó chết | `fetchCopernicusCurrents()` trả `null` (không ném, không treo) → nếu sau này nối vào sổ nguồn thì lùi về `noaa-blended-currents` như hiện tại |
| ⚠️ CẤM | Endpoint MOTU cũ `nrt.cmems-du.eu` **đã ngừng và domain bị người khác chiếm** (trang rao bán tên miền). Chỉ đi qua STAC `stac.marine.copernicus.eu` → S3 `s3.waw3-1.cloudferro.com` |

**Vì sao đáng đổi (số đo thật 2026-07-26, cùng hộp biển VN)** — NOAA `noaacwBLENDEDNRTcurrentsDaily` khai `standard_name: surface_geostrophic_*_velocity`, mà dòng địa chuyển gần như KHÔNG phân kỳ ⇒ `convergenceStrength()` đang chấm nhiễu:

| Chỉ số | Copernicus `utotal` | Copernicus `uo` (đối chứng) | NOAA địa chuyển |
|---|---|---|---|
| RMS(phân kỳ)/RMS(xoáy) | **0,359** | 0,344 | **0,133** |
| Tự tương quan không gian của phân kỳ (trễ 1 ô) | **0,466** (cấu trúc thật) | 0,433 | **0,006** (nhiễu răng cưa) |

Tự tương quan ≈ 0 của NOAA là bằng chứng mạnh nhất: trường phân kỳ của nó KHÔNG có cấu trúc không gian. Đối chứng `uo` cho thấy chênh lệch đến từ **loại mô hình** (mô hình 3D có nước trồi/chìm thật) chứ không phải từ việc cộng thêm sóng + triều.

## Quy tắc

1. **Cột "khi nó chết thì sao" là bắt buộc** — đây là cột cần lúc 2h sáng. Mọi nguồn phải degrade, KHÔNG để treo UI hay báo lỗi câm (đã enforce qua roadmap "thất bại lên tiếng").
2. **Token/secret ghi ĐƯỜNG DẪN, không ghi giá trị** — kiến trúc zero-secret: chỉ env public trên Vercel; service key sống trong Edge Function CRM.
3. **Nguồn mới = dòng mới CÙNG commit** với code tích hợp (Doc+Test sync).
4. Đây KHÔNG phải cron/agent thường trực (Vercel serverless + Edge Functions) → không cần runbook start/stop; vận hành = deploy Vercel + Supabase MCP. Sự cố nguồn ngoài → đọc bảng này TRƯỚC khi sửa code.
