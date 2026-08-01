# Ops — State Registry — ForFish

> Load khi: đọc/ghi/sửa state phía client, hoặc debug "dữ liệu mất / sai / không lưu". Mọi key `forfish.*` trong localStorage liệt kê ở đây.

covers: src/lib/boats.ts, src/lib/debts.ts, src/lib/region.ts, src/lib/places.ts, src/lib/sea.ts, src/lib/forecast-cache.ts
last_verified: 2026-08-01
ttl_days: 180
gate: warn
<!-- re-verified: 2026-07-25j — thêm 2 hàng `forfish.fc.point.*` / `forfish.fc.grid.d<N>` (bản lưu dự báo xem lúc mất sóng, lib/forecast-cache.ts). Trần 40 bản/namespace, dọn TRƯỚC khi ghi + bỏ bản cũ nhất khi máy hết chỗ; saveForecast trả boolean để UI báo "máy hết chỗ". -->
<!-- re-verified: 2026-07-25 — forfish.sea bump v2→v3 (dự báo 16 ngày + waveEstimated); TTL sửa 6h→1h khớp CACHE_TTL_MS -->
<!-- re-verified: 2026-07-29 — KHÔNG key mới, chỉ đổi TƯƠNG THÍCH NGƯỢC bên trong key cũ: (a) `forfish.fc.grid.d<N>` — GridHour thêm 2 trường OPTIONAL curKmh/curDirDeg (dòng chảy, hướng CHẢY VỀ); bản lưu đời cũ thiếu trường → đọc `?? null`, lớp Dòng chảy tự bỏ nấc cache thiếu cur (needCurrent). (b) `forfish.fc.point.*` — SeaPointConditions/SeaPointDay thêm curKmh/curDirDeg optional, luật đọc y vậy. (c) Cả 3 đường fetch (grid/scalar/sea) nay LƯU cả bản lấy từ SNAPSHOT server vào các key này với savedAt = TUỔI THẬT của snapshot (không phải Date.now) — semantics savedAt không đổi, chỉ nguồn ghi thêm. KHÔNG bump version key nào. -->

<!-- re-verified: 2026-08-01 — KHÔNG key mới, KHÔNG đổi semantics key nào; đổi CÁCH CHỌN NẠN NHÂN của `reclaimForecastSpace` (forecast-cache): trước sắp theo `savedAt` nên bỏ bản "cũ nhất", mà `savedAt` của các key nặng `forfish.fc.grid.d<N>` / `forfish.fc.curdepth.*` / `forfish.fc.scalar.*` là GIỜ CHẠY CRON của snapshot (ghi bằng `snap.savedAt`, xem ghi chú 2026-07-29 (c)) còn `forfish.fc.point.*` lưu bằng `Date.now()` ⇒ lớp nặng LUÔN trông cũ hơn và bị bỏ trước: một ghi chú 3 KB (`forfish.crew.v1` / `forfish.documents.v1` / bảo dưỡng) xoá nguyên lưới gió/sóng 16 ngày ~1,6 MB — thứ giữa biển KHÔNG tải lại được. Nay bỏ theo BẬC HY SINH `DROP_RANK`: point 0 → scalar/seascalar 1 → curdepth 2 → grid 3 → fishmark 4 (số nhỏ bỏ trước), cùng bậc mới xét `savedAt` cũ trước. `savedAt` vẫn là TUỔI SỐ LIỆU cho `isCacheCurrent`, không phải "tuổi trong máy". `dropOldest` (đường `saveForecast` tự nhường chỗ cho dự báo khác) GIỮ NGUYÊN. Cũng KHÔNG đổi `forfish.pretrip.lastRunAt.v1` về hình dạng — chỉ đổi ĐIỀU KIỆN ghi: mẻ tải sẵn hỏng sạch không còn ghi mốc (xem `shouldMarkPretripRun`), nên xoá key vẫn cho hành vi cũ. -->
<!-- re-verified: 2026-07-31 — KHÔNG key mới cho dự báo; đổi CÁCH DỌN: forecast-cache `dropOldest(n, needBytes, keep)` nay dọn theo BYTE và nới dần 1/4 → 1/2 → cả bản (trước dọn theo SỐ BẢN nên máy đầy vẫn không đủ chỗ), thêm `reclaimForecastSpace()` để dữ liệu bà con TỰ NHẬP (giấy tờ, thuyền viên, bảo dưỡng) mượn chỗ của dự báo — ưu tiên: dữ liệu người dùng gõ tay > dự báo tải lại được. Ghi dữ liệu tự nhập đi qua lib mới `src/lib/user-store.ts` (`saveUserJson` trả boolean; hết chỗ → UI banner đỏ, KHÔNG nuốt lỗi). Key `forfish.*` giữ nguyên tên và semantics savedAt. -->
<!-- re-verified: 2026-08-01b — KHO CACHE STORAGE (không phải localStorage nhưng cùng họ "state trong máy"): nay 5 kho tách bạch — `sdfish-v6` (vỏ) · `sdfish-static-v1` (JS/CSS băm tên, trần 400) · `sdfish-rsc-v1` (MỚI, phản hồi ?_rsc=, trần 60) · `sdfish-api-v1` (dữ liệu /api, trần 120, CHỈ 9 tiền tố trong allowlist `src/lib/sw-cache-policy.ts`) · `sdfish-tiles-v1` (ô bản đồ, trần 600). Mọi kho dọn FIFO (Cache API trả key theo thứ tự thêm), KHÔNG phải LRU. `/api/me`, `/api/crew-reports`, `/api/admin/*` và mọi route gắn danh tính KHÔNG bao giờ vào kho — máy dùng chung trên tàu thì đó là dữ liệu người trước nằm lại cho người sau. -->

<!-- re-verified: 2026-08-01d — HAI NAMESPACE MỚI trong `forfish.fc.*`: `storm.latest` (bản tin bão hỏi được gần nhất, payload mang `checkedAt` nên `stormStatus` vẫn tự coi >12h là chưa-hỏi-được) và `price.{port,fuel}` (bảng giá tuần VASEP + kỳ giá dầu). Writer: `storms.ts` / `port-price-source.ts` / `fuel-price.ts` khi hỏi được; reader: chính chúng khi mất sóng, + `pretrip.savedLayers` để popup đếm. Vào tệp sao lưu tự động (offline-backup gom mọi khoá `forfish.*`). Dọn theo `DROP_RANK` như các lớp khác. -->

<!-- re-verified: 2026-08-01e — KEY MỚI `forfish.heartbeat.v1`: mốc epoch ms lần cuối máy gửi nhịp "đã mở app" về server (`src/lib/heartbeat.ts`). Writer: sendHeartbeat, ghi TRƯỚC khi gửi (gửi hỏng cũng không thử lại ngay — thà mất một nhịp thống kê còn hơn đập vào đường truyền yếu giữa biển). Reader: chính nó, để chặn 12 giờ/máy. Không có PII, xoá đi chỉ tốn thêm một nhịp. -->

<!-- re-verified: 2026-08-01g —  `forfish.heartbeat.v2` ĐỔI NGHĨA: nay là mốc **GHI ĐƯỢC** (máy chủ xác nhận `recorded:true`), KHÔNG còn là mốc "đã gửi đi". Bản 01e ghi dấu TRƯỚC khi gửi + chỉ một cửa 12 giờ ⇒ **một lần hỏng là im nửa ngày**, mà cú gửi đầu tiên lại là cú dễ hỏng nhất (vừa đăng nhập xong, service worker đang cài). Triệu chứng đo được ngoài đời: khách dùng app cả buổi mà /quan-tri vẫn "Chưa ghi nhận" và KHÔNG ai biết vì sao — client gọi `void sendHeartbeat()` không đọc kết quả, route trả `recorded` không ai nhận. Nay tách mức hoãn sang key mới `forfish.heartbeat.retry.v1` (xem bảng) và **ĐỔI TÊN key sang `forfish.heartbeat.v2`** — bắt buộc, vì dùng lại tên v1 thì mọi máy đang mang dấu của một cú gửi HỎNG sẽ bị đọc thành đã-thành-công và im tiếp 12 giờ, tức bản vá không ăn trên đúng những máy đang lỗi. Dấu `forfish.heartbeat.v1` còn sót lại vô hại, không ai đọc nữa. LƯU Ý ĐỐI VỚI OFFLINE: ca **không nhận được phản hồi** (mất sóng, sóng "sống mà chết", hết 8 giây) lùi ĐÚNG 12 giờ y như bản cũ — nhịp thử ngoài khơi KHÔNG dày thêm một lần nào; chỉ ca máy chủ CÓ trả lời mới mở cửa sớm (30 phút), mà ca đó theo định nghĩa là lúc đường truyền đang tốt. -->

> Registry CANONICAL cho state client (nguyên tắc 11 §state). **State không có trong bảng này = coi như không tồn tại — KHÔNG đoán schema.** ForFish chạy Vercel serverless + demo mode → "state nền" duy nhất là localStorage của trình duyệt (prefix `forfish.*`, GIỮ tên cũ — đổi sẽ mất dữ liệu user). Khi đã đăng nhập Supabase, nguồn sự thật là DB (xem [04-data-model](../04-data-model.md)); localStorage là fallback demo mode (xem [02-architecture §4](../02-architecture.md)).

**Last updated**: 2026-07-25

---

## Bảng localStorage `forfish.*`

| Key | Nội dung | Writer (module ghi) | Reader chính | Trục | Reset |
|---|---|---|---|---|---|
| `forfish.displaymode.v1` | Cỡ giao diện (`gon`/`to`/`auto`) | `components/hero-account.tsx` + boot script `app/layout.tsx` | `globals.css`, `layout.tsx` | chung | xoá key → về mặc định "Gọn" (2026-07-28) |
| `forfish.boats.v1` | Danh sách tàu | `lib/boats.ts` | toàn app | chung | xoá → trống, tạo lại tàu |
| `forfish.currentBoat.v1` | Tàu đang chọn | `lib/boats.ts` | toàn app | chung | xoá → chọn tàu đầu |
| `forfish.boat.v1` | Tàu cho dẫn đường (route planner) — **khác `boats.v1`** | `components/route-planner.tsx` | route-planner | 1 | xoá → nhập lại thông số |
| `forfish.home.v1` | Vùng/quê nhà đã chọn | `lib/region.ts` | `ui/region-filter.tsx` | chung | xoá → hỏi lại vùng |
| `forfish.places.v1` | Địa điểm đã lưu | `lib/places.ts` | nơi dùng places | 1 | xoá → trống |
| `forfish.port.v1` | Cảng đang chọn (dự báo) | `components/sea-forecast.tsx` | sea-forecast | 1 | xoá → cảng mặc định |
| `forfish.maplayer.v1` | Lớp bản đồ đang bật | `components/fishing-map-view.tsx` | fishing-map-view | 1 | xoá → lớp mặc định |
| `forfish.installNudge.dismissed.v1` | Đã tắt banner "Cài về máy" (`"1"`) | `components/install-prompt.tsx` | install-prompt | chung | xoá → hiện lại nhắc cài |
| `forfish.sea.<port>.v3` | **Cache** dự báo biển 16 ngày theo cảng (prefix; v3 = +waveEstimated, model sóng ncep_gfswave025) | `lib/sea.ts` | sea-forecast | 1 | xoá an toàn (chỉ cache, TTL 1h) |
| `forfish.fc.point.<lat_lon>` | **Bản lưu** dự báo 16 ngày theo ô lưới 0,25° (ra khơi mất sóng vẫn xem) | `lib/forecast-cache.ts` ← `lib/marine-weather.ts`, `lib/pretrip.ts` | ngu-truong | 1 | xoá → mất số đã tải, có sóng lấy lại |
| `forfish.fc.grid.d<N>` | **Bản lưu** lưới gió/sóng Windy THEO KHUNG NGÀY (d3/d7/d16…) — chỉ dùng lại đúng khung đã xin | `lib/forecast-cache.ts` ← `lib/forecast-grid.ts`, `lib/pretrip.ts` | ngu-truong | 1 | xoá → khung đó báo "máy chưa lưu khung này" |
| `forfish.pretrip.lastRunAt.v1` | Mốc (epoch ms) lần **tự tải sẵn dự báo** gần nhất — cửa chặn 6 giờ cho khỏi tốn tiền sóng (mỗi lượt ~2,5–3 MB) | `lib/pretrip-auto.ts` | `components/pretrip-auto-notify.tsx` | 1 | xoá → lần vào Ra khơi kế tiếp tải lại một lượt. **Chỉ ghi khi mẻ tải GIỮ ĐƯỢC gì (hoặc máy hết chỗ)** — `shouldMarkPretripRun`, 2026-08-01: trước ghi vô điều kiện nên mẻ hỏng sạch cũng khoá 6 giờ |
| `forfish.tier.premium.v1` | **Dấu premium** phiên gần nhất (`"1"`/`"0"`) — đường lùi khi MẤT SÓNG: `getUser()` offline trả null, premium đã trả tiền vẫn xem được bản đồ cá đã tải sẵn | `lib/use-tier.ts` | toàn app (gate premium) | 1 | xoá → mất sóng phải chờ có mạng mới mở lại premium; đăng xuất thật (online) tự xoá — **"thật" = máy chủ ĐÃ trả lời** (`isNetworkAuthError` trong `lib/auth-error.ts`, 2026-08-01): trước đây `getUser()` hỏng vì sóng cũng resolve kèm error và bị tính là đăng xuất ⇒ dấu premium bị xoá giữa biển |
| `forfish.tier.until.v1` | **Hạn premium** (ISO) lần tra được gần nhất — để sheet Tài khoản nói "dùng tới dd/mm/yyyy" cả khi mất sóng | `lib/use-tier.ts` | `components/hero-account.tsx` | 1 | xoá → chip Premium vẫn hiện nhưng không nêu ngày; đăng xuất thật / hạ hạng tự xoá. Cùng tiền tố `forfish.tier.` ⇒ **KHÔNG vào tệp sao lưu** (entitlement, không phải dữ liệu dự báo) |
| `forfish.heartbeat.v2` | Mốc (epoch ms) lần máy chủ **XÁC NHẬN GHI ĐƯỢC** nhịp "đã mở app" (`recorded:true`) — cửa chặn 12 giờ/máy. v1 mang nghĩa cũ "đã gửi đi", nay bỏ không đọc | `lib/heartbeat.ts` | chính nó | 1 | xoá → lần mở app kế tiếp gửi lại một nhịp. Không có PII |
| `forfish.heartbeat.retry.v1` | **Sớm nhất được thử lại** nhịp "đã mở app" (epoch ms, mốc TUYỆT ĐỐI). Mất sóng/không phản hồi → `now+12h`; máy chủ CÓ trả lời mà chưa ghi được → `now+30phút`; ghi được → xoá | `lib/heartbeat.ts` | chính nó | 1 | xoá → lần mở app kế tiếp thử lại một nhịp. Không có PII |
| `forfish.products.v1` | Đồ/vật tư của tàu | `components/boat-products.tsx` | van-hanh | 3 | xoá → trống |
| `forfish.maintenance.v1` | Nhắc bảo dưỡng | `components/maintenance-reminders.tsx` | + `urgent-strip.tsx` | 3 | xoá → mất lịch nhắc |
| `forfish.crew.v1` | Danh sách thuyền viên | `components/crew-list.tsx` | + `urgent-strip.tsx` | 3 | xoá → trống |
| `forfish.debts.v1` | Sổ lãi lỗ chuyến biển | `components/debt-ledger.tsx` (+ `lib/debts.ts`) | gia-ca | 2 | xoá → **mất sổ — backup trước** |
| `forfish.buyers.v1` | Danh bạ thương lái | `components/sell-guide.tsx` | gia-ca | 2 | xoá → trống |
| `forfish.trips.v1` | Nhật ký chuyến biển | `components/trip-report.tsx`, `trip-log.tsx` | gia-ca, van-hanh | 2 | xoá → **mất nhật ký — backup trước** |
| `forfish.documents.v1` | Tủ giấy tờ (loại, hạn) | `components/document-vault.tsx` | + `urgent-strip.tsx` | 4 | xoá → **mất hồ sơ — backup trước** |

> `urgent-strip.tsx` là reader chéo: đọc `documents` + `maintenance` + `crew` để hiện cảnh báo gần đến hạn.

## Quy tắc (governance)

1. **Single writer** — mỗi key chỉ ghi qua module ở cột Writer, không `setItem` raw rải rác. Thêm chỗ ghi mới phải đi qua module đó.
2. **Versioned key** — đuôi `.v1`. Đổi schema không tương thích → **bump `.v2`** + viết migrate từ v1, KHÔNG ghi đè câm lên v1.
3. **GIỮ prefix `forfish.`** — hạ tầng cũ (xem [CLAUDE.md](../../../CLAUDE.md)); đổi `forfish.`→`sdfish.` sẽ làm user mất hết dữ liệu.
4. **Backup trước thao tác tay** với 4 key đánh dấu "backup trước" (debts/trips/documents) — đây là dữ liệu user gõ tay, không tái tạo được.
5. **Thêm state mới = thêm 1 dòng bảng này CÙNG COMMIT** với code (nguyên tắc 4 doc+test sync). State thiếu trong bảng = không tồn tại.

## Liên quan

- DB thật (khi đăng nhập): [04-data-model.md](../04-data-model.md)
- Demo mode fallback: [02-architecture.md](../02-architecture.md) §4
- Service ngoài (nguồn fill cache): [external-services.md](external-services.md)
