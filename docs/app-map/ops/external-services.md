# Ops — External Services — ForFish

> Load khi: lỗi liên quan nguồn dữ liệu ngoài (timeout, rate limit, đổi format, token hết hạn), thêm nguồn mới, hoặc audit phụ thuộc.

covers: src/lib/sea.ts, src/lib/marine-weather.ts, src/lib/route-weather.ts, src/lib/forecast-grid.ts, src/lib/forecast-ensemble.ts, src/lib/forecast-quality.ts, src/lib/sdwork-assets.ts, src/lib/auth-gateway.ts, src/lib/fish-predict.ts, src/lib/hycom.ts, src/lib/sea-scalars.ts, src/lib/fuel-price.ts, src/lib/port-price-source.ts
last_verified: 2026-07-25
ttl_days: 180
gate: warn
<!-- re-verified: 2026-06-17 - auth-gateway.ts = SĐT+mật khẩu (signup/sso), bỏ OTP/magic-link/service-key; timeout 20s -->

> Registry CANONICAL cho mọi service ngoài hệ (nguyên tắc 11). Toàn bộ fetch nguồn ngoài BẮT BUỘC `AbortSignal.timeout(...)` + degrade rõ ràng (xem 02-architecture §5).

<!-- re-verified: 2026-06-16 — covers MỞ RỘNG thêm fish-predict/hycom/sea-scalars/fuel-price/port-price-source (trước bỏ sót → drift im). Toàn bộ fetch ngoài đã có AbortSignal.timeout (sweep 2026-06-16: server 15-20s, client 15-25s). -->
<!-- re-verified: 2026-07-25 — forecast-grid.ts (lớp Windy) nay CHỌN KHUNG 3/5/7/10/16 ngày, dùng model sóng ncep_gfswave025 (như sea/marine-weather) + bước giờ tăng dần, client timeout 20s. sea/marine-weather mở 16 ngày (WAVE_MODEL). -->
<!-- re-verified: 2026-07-25b — fish-predict.ts tách cá ngừ đại dương → vây vàng + mắt to (39→40 loài); KHÔNG đổi tích hợp nguồn ERDDAP/HYCOM (URL/UA/timeout giữ nguyên), chỉ là tham số khẩu vị loài. -->
**Last updated**: 2026-07-25

---

## Bảng service ngoài

| Service | Dùng để | Auth | Cấu hình ở đâu | Rate / cache | Khi nó chết thì sao |
|---|---|---|---|---|---|
| **Open-Meteo** (forecast + marine) | Gió/mưa/dông + **sóng theo ngày 1–16** (điểm đi biển); lưới Windy; tuyến dầu | Không key | hardcode endpoint trong `lib/sea.ts`, `marine-weather.ts`, `route-weather.ts`, `forecast-grid.ts`, `sea-forecast`. **Sóng 16 ngày phải chỉ định `models=ncep_gfswave025`** (best-match sóng chỉ ~8 ngày) — hằng `WAVE_MODEL` | free, cache 6h/1h (sea), client timeout 15s | Thẻ peek "Chưa lấy được dự báo — Thử lại"; ngày sóng thủng ước từ gió (`waveEstimated`); lưới gió/sóng nút Thử lại; KHÔNG treo |
| **Open-Meteo Ensemble** (GFS-EPS) | Độ bất định dự báo: spread gió 31 thành viên → độ tin từng ngày | Không key, gửi `User-Agent` | `lib/forecast-ensemble.ts` (`ensemble-api.open-meteo.com`, `models=gfs05`) | free, client timeout 15s | `fetchEnsembleUncertainty` trả `null` → độ tin lùi về prior theo tầm ngày (`forecast-quality.ts`), dự báo vẫn chạy |
| **Open-Meteo Archive + Historical-Forecast** (backtest offline) | Học thử độ chính xác: dự-báo-cũ vs thực-tế ERA5 → `forecast-skill.json` | Không key | `scripts/forecast-backtest.mjs` (chạy tay, KHÔNG runtime) — xem [forecast-accuracy.md](forecast-accuracy.md) | — (offline, kết quả commit sẵn) | Không ảnh hưởng runtime; bảng skill thiếu → độ tin/bias lùi về prior |
| **GDACS** (bão) | Tin bão Biển Đông + **đường đi (track) + vùng ảnh hưởng (polygon)** (`/api/storms`) | Không key | `app/api/storms`, `lib/storms.ts` | server 15s + client 20s | StormBanner ẩn nếu lỗi; lớp bão (track/vùng) ẩn; bản đồ vẫn chạy |
| **VASEP** (giá bến) | Giá nguyên liệu tuần (`/api/port-prices`) | Không key (scrape) | `lib/port-price-source.ts` | cache 24h | Lùi bảng giá tĩnh + nhãn "tham khảo" |
| **Petrolimex / giaxanghomnay** | Giá dầu DO (`/api/fuel-price`) | Không key (scrape) | `app/api/fuel-price` | cache 6h | Ẩn dòng giá dầu, phần còn lại giữ nguyên |
| **NOAA ERDDAP** | SST / phù du / front (dự báo cá) + nước dâng/xoáy (`/api/sea-scalar`) | Không key, **BẮT BUỘC `User-Agent`** (`ERDDAP_UA` trong fish-predict.ts; thiếu → coastwatch trả **403 + HTML** → parse JSON vỡ → `{ok:false}` = cá KHÔNG chạy, chẩn 2026-06-23) | `lib/fish-predict.ts`, `lib/sea-scalars.ts`, `app/api/fish-forecast`, `app/api/sea-scalar` | cache 6h, **server timeout 20s/lưới** (vài MB), **client fetch 25-35s** | Lớp cá pill đỏ "chạm để thử lại"; lùi mùa vụ; nguồn treo → route fail-fast `{ok:false}`, KHÔNG treo serverless |
| **HYCOM** (OPeNDAP) | Tầng nhiệt D20 (cá ngừ) | Không key, gửi `User-Agent` (`ERDDAP_UA`) phòng host chặn undici | `lib/hycom.ts` | fetch song song ERDDAP, **timeout 20s** + `.catch→null` | Chia lại trọng số habitat, không D20 vẫn ra cá; treo → null (không treo `await thermoP`) |
| **Overpass / OpenSeaMap** | Phao đèn, báo hiệu gần bờ | Không key | `app/api/nautical` | timeout 25s (nguồn chậm) | Lớp phao ẩn; hải đồ + dự báo vẫn chạy |
| **NASA GIBS / tiles vệ tinh** | Ảnh mây, nhiệt độ, phù du nền bản đồ | Không key | `lib/ocean-map.ts` (buildMapStyle) | tile CDN | Badge "Chưa tải được"; đổi lớp khác được |
| **Supabase — ForFish** (`znzgugvfhgmiszqgjulk`) | Auth (SĐT) + DB owner-only (boats/documents/profiles) | publishable + anon (public env) | Vercel env `NEXT_PUBLIC_SUPABASE_*` | — | Env trống → **demo mode** localStorage, app vẫn dùng được (02 §4) |
| **CRM SDViCo gateway** (`exueouggmbjtjvsvpfya`) | Đồ đã mua (`forfish-gateway`) + đăng nhập SĐT+mật khẩu (`auth-gateway`: action `signup`/`sso`, KHÔNG OTP/magic-link/service-key) | sb_publishable key (in-code ALLOWED_KEYS, verify_jwt:false) | Edge Functions `forfish-gateway`/`auth-gateway` (service key tự cấp trong CRM) | client 20s | `useSdvicoAssets` nấc `error` + Thử lại; chưa nối → `unlinked`. ⚠️ CHUYỂN TIẾP — thay bởi webhook + DB riêng ([04 §5b](../04-data-model.md)) |
| **SDWork webhook** (ingest + provision auth) | Nạp KH/thiết bị/vật tư + tạo tài khoản (SĐT+mật khẩu) vào SDFish | HMAC `SDWORK_WEBHOOK_SECRET` (header `x-sdwork-signature`) | `app/api/sdwork/webhook` + `lib/sdwork-webhook.ts` | SDWork đẩy khi đổi | Sai/thiếu chữ ký → 401/503; rớt event → cron đối soát (Đợt 2); app đọc bản đã nạp, không phụ thuộc SDWork lúc KH mở. Đăng nhập = SĐT+mật khẩu, KHÔNG email/OTP |

## Quy tắc

1. **Cột "khi nó chết thì sao" là bắt buộc** — đây là cột cần lúc 2h sáng. Mọi nguồn phải degrade, KHÔNG để treo UI hay báo lỗi câm (đã enforce qua roadmap "thất bại lên tiếng").
2. **Token/secret ghi ĐƯỜNG DẪN, không ghi giá trị** — kiến trúc zero-secret: chỉ env public trên Vercel; service key sống trong Edge Function CRM.
3. **Nguồn mới = dòng mới CÙNG commit** với code tích hợp (Doc+Test sync).
4. Đây KHÔNG phải cron/agent thường trực (Vercel serverless + Edge Functions) → không cần runbook start/stop; vận hành = deploy Vercel + Supabase MCP. Sự cố nguồn ngoài → đọc bảng này TRƯỚC khi sửa code.
