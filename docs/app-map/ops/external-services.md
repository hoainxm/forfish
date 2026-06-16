# Ops — External Services — ForFish

> Load khi: lỗi liên quan nguồn dữ liệu ngoài (timeout, rate limit, đổi format, token hết hạn), thêm nguồn mới, hoặc audit phụ thuộc.

covers: src/lib/sea.ts, src/lib/marine-weather.ts, src/lib/route-weather.ts, src/lib/forecast-grid.ts, src/lib/sdwork-assets.ts, src/lib/auth-gateway.ts
last_verified: 2026-06-11
ttl_days: 180
gate: warn

> Registry CANONICAL cho mọi service ngoài hệ (nguyên tắc 11). Toàn bộ fetch nguồn ngoài BẮT BUỘC `AbortSignal.timeout(...)` + degrade rõ ràng (xem 02-architecture §5).

**Last updated**: 2026-06-11

---

## Bảng service ngoài

| Service | Dùng để | Auth | Cấu hình ở đâu | Rate / cache | Khi nó chết thì sao |
|---|---|---|---|---|---|
| **Open-Meteo** (marine + forecast) | Gió/sóng/mưa/dông theo giờ; lưới Windy; tuyến dầu | Không key | hardcode endpoint trong `lib/marine-weather.ts`, `route-weather.ts`, `forecast-grid.ts`, `sea-forecast` | free, cache 6h (sea), client timeout 15s | Thẻ peek "Chưa lấy được dự báo — Thử lại"; lưới gió/sóng nút Thử lại; KHÔNG treo |
| **GDACS** (bão) | Tin bão Biển Đông (`/api/storms`) | Không key | `app/api/storms` | server 15s + client 20s | StormBanner ẩn nếu lỗi; bản đồ vẫn chạy |
| **VASEP** (giá bến) | Giá nguyên liệu tuần (`/api/port-prices`) | Không key (scrape) | `lib/port-price-source.ts` | cache 24h | Lùi bảng giá tĩnh + nhãn "tham khảo" |
| **Petrolimex / giaxanghomnay** | Giá dầu DO (`/api/fuel-price`) | Không key (scrape) | `app/api/fuel-price` | cache 6h | Ẩn dòng giá dầu, phần còn lại giữ nguyên |
| **NOAA ERDDAP** | SST / phù du / front (dự báo cá) | Không key | `lib/fish-predict.ts`, `app/api/fish-forecast` | cache 6h | Lớp cá hiện pill đỏ "chạm để thử lại"; lùi mùa vụ |
| **HYCOM** (OPeNDAP) | Tầng nhiệt D20 (cá ngừ) | Không key | `lib/hycom.ts` | fetch song song ERDDAP, `.catch→null` | Chia lại trọng số habitat, không có D20 vẫn ra điểm cá |
| **Overpass / OpenSeaMap** | Phao đèn, báo hiệu gần bờ | Không key | `app/api/nautical` | timeout 25s (nguồn chậm) | Lớp phao ẩn; hải đồ + dự báo vẫn chạy |
| **NASA GIBS / tiles vệ tinh** | Ảnh mây, nhiệt độ, phù du nền bản đồ | Không key | `lib/ocean-map.ts` (buildMapStyle) | tile CDN | Badge "Chưa tải được"; đổi lớp khác được |
| **Supabase — ForFish** (`znzgugvfhgmiszqgjulk`) | Auth (SĐT) + DB owner-only (boats/documents/profiles) | publishable + anon (public env) | Vercel env `NEXT_PUBLIC_SUPABASE_*` | — | Env trống → **demo mode** localStorage, app vẫn dùng được (02 §4) |
| **CRM SDViCo gateway** (`exueouggmbjtjvsvpfya`) | Đồ đã mua + đăng nhập SSO | sb_publishable key (in-code ALLOWED_KEYS, verify_jwt:false) | Edge Functions `forfish-gateway`/`auth-gateway` (service key tự cấp trong CRM) | client 20s | `useSdvicoAssets` nấc `error` + Thử lại; chưa nối → `unlinked`. ⚠️ CHUYỂN TIẾP — thay bởi webhook + DB riêng ([04 §5b](../04-data-model.md)) |
| **OTP provider** (Zalo ZNS/SMS — CHƯA cắm) | Gửi mã đăng nhập SĐT | env `OTP_PROVIDER` (trống=stub) | `lib/otp/provider.ts` adapter | rate-limit 60s/SĐT, mã sống 5′ | Provider lỗi → `/api/auth/otp/request` 502 "chưa gửi được"; stub (chưa cắm) → 503 → UI lùi đăng nhập mật khẩu |
| **SDWork webhook** (ingest) | Nạp KH/thiết bị/vật tư vào DB SDFish | HMAC `SDWORK_WEBHOOK_SECRET` (header `x-sdwork-signature`) | `app/api/sdwork/webhook` + `lib/sdwork-webhook.ts` | SDWork đẩy khi đổi | Sai/thiếu chữ ký → 401/503; rớt event → cron đối soát (Đợt 2); app đọc bản đã nạp, không phụ thuộc SDWork lúc KH mở |

## Quy tắc

1. **Cột "khi nó chết thì sao" là bắt buộc** — đây là cột cần lúc 2h sáng. Mọi nguồn phải degrade, KHÔNG để treo UI hay báo lỗi câm (đã enforce qua roadmap "thất bại lên tiếng").
2. **Token/secret ghi ĐƯỜNG DẪN, không ghi giá trị** — kiến trúc zero-secret: chỉ env public trên Vercel; service key sống trong Edge Function CRM.
3. **Nguồn mới = dòng mới CÙNG commit** với code tích hợp (Doc+Test sync).
4. Đây KHÔNG phải cron/agent thường trực (Vercel serverless + Edge Functions) → không cần runbook start/stop; vận hành = deploy Vercel + Supabase MCP. Sự cố nguồn ngoài → đọc bảng này TRƯỚC khi sửa code.
