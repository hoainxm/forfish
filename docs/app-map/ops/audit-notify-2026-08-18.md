# Audit thông báo & cảnh báo toàn app — 2026-08-18

> **Load khi**: sắp thêm/sửa bất kỳ banner, chip, toast, badge, push hay ngưỡng cảnh báo nào — đọc mục 6 (chính sách 5 tầng, đã đưa vào 07 §12) và mục 8 (top 10). Đây là **biên bản audit tại một thời điểm**, không đặt `covers:`; các việc trong Top 10 đã được triển khai cùng ngày (commit "feat(notify)").
>
> Yêu cầu chủ dự án: rà toàn bộ các loại cảnh báo/notify (vị trí, nguyên lý, logic ẩn), đánh giá **đồng bộ · đúng đắn · phù hợp · cần thiết**, không "nhắc như cái máy" (ngoài khơi mất sóng thì bà con đã biết). Có phản biện.
> Cách làm: 6 agent kiểm kê song song (shell/Trang chủ · push/inbox/server · Trục 1 · Trục 2+auth · Trục 3+4 · hồ sơ app-map) → 3 critic độc lập (kiểm chứng kỹ thuật từng claim mở đúng file:line · góc BA + thuyền trưởng 52 tuổi · spec-vs-code). Kết luận dưới đây **đã qua kiểm chứng**; mức nặng theo critic kỹ thuật (P0 tính mạng/mất dữ liệu · P1 nói sai với người dùng · P2 nhiễu/lệch · P3 cosmetic).

## 0. Tóm tắt 10 dòng

1. App **không có hệ thông báo chung**: không toast, không provider, không hàng đợi, không "ngân sách" tối đa N khối/màn. Mỗi component tự vẽ. `StatusBanner` là chuẩn duy nhất nhưng UrgentStrip / StormBanner / InstallBanner / InboxSection và toàn bộ vùng nổi bản đồ đều không dùng.
2. **Toàn app chỉ có 1 khoá dismiss** do người dùng bấm (`forfish.installNudge.dismissed.v1`). Không snooze/dismiss cho việc gấp, offline, premium.
3. **Không có khái niệm "đang ở biển"** — mọi thứ đi từ `navigator.onLine`. Hệ quả: 22 câu về mạng ở riêng Trục 1 (11 thường trực), 14 cách nói "mất sóng" ở lớp shell; câu "Chưa hỏi được tin bão — máy không có sóng" nằm lì suốt chuyến và nhân bản 3 nơi.
4. **Nhắc nhiều nhất ở chỗ ít quan trọng nhất, im ở chỗ quan trọng nhất**: 1 khoản nợ SDVICO hiện 4 chỗ, đơn hàng 3 điểm chạm × 4 trạng thái, premium/đăng nhập 8 nơi 5 kiểu copy — nhưng **Trang chủ không có tin bão**, **không push bão tự động** (dù `/api/storms` + cron sẵn), **ranh giới không bám GPS khi dẫn đường**, **bị đá tài khoản hoàn toàn im lặng**.
5. Điểm 4 tính: **Đồng bộ 4/10 · Đúng đắn 6/10 · Phù hợp 5/10 · Cần thiết 5/10**.
6. Phần làm tốt và nên nhân rộng: 4 trạng thái bão qua 1 hook (`useStormCheck`/`stormStatus`), "(ước)" cho sóng suy, chống lặp theo nội dung câu, xin quyền push không nag, `my-orders`/`sdvico-catalog` "đang xem bản lưu (N trước)", câu mất sóng của giỏ hàng, không lộ mã HTTP/tiếng Anh.
7. Bug thật đã xác nhận (P1): S14 cảnh báo máy hết chỗ ở BoatSwitcher không bao giờ hiện lúc cần; G2 lỗi mạng bị đổ tội "nhập sai SĐT"; S11 banner bão bỏ qua tuổi tin, đổ "máy không có sóng" cả khi nguồn lỗi lúc online.
8. Phát hiện mới của critic: **lệch múi giờ có hệ thống** trong 6 bản `daysUntil` (dùng ngày UTC → 00h–07h sáng VN "hôm nay" là hôm qua); mở màn thuyền viên/bảo dưỡng khi máy đầy → báo đỏ "chưa lưu được" dù chưa nhập gì.
9. Hồ sơ app-map **thiếu chính sách thông báo** (ưu tiên/xếp chồng/tần suất) và có ≥9 chỗ lạc hậu/mâu thuẫn — nặng nhất: 02-architecture:342 nói banner bão "im lặng khi nguồn fail" (đúng cái 07 cấm).
10. Đề xuất: viết **§8 Chính sách thông báo 5 tầng** vào 07-design-spec (mục 6 dưới đây), rồi làm Top 10 (mục 8).

## 1. Bản đồ hệ thống thông báo (kênh · nơi mount)

| Kênh | Component / route | Mount ở | Ghi chú |
|---|---|---|---|
| Dải "Việc cần làm ngay" | `urgent-strip.tsx` | Trang chủ | đọc 3 khoá LS + fetch `/api/me/sdvico` mỗi lần vào |
| Nhắc cài app | `install-prompt.tsx` | Trang chủ, dưới dải khẩn | khoá dismiss duy nhất toàn app |
| Hộp thư | `inbox-section.tsx` | Trang chủ, dưới 4 ô | không badge chưa đọc, không "TIN CŨ" |
| Banner bão | `storm-banner.tsx` (overlay) | **chỉ** `fishing-map-view.tsx` | `variant="page"` là mã chết; Trang chủ không có bão |
| Vùng nổi bản đồ (z-20) | StormBanner → NavHud → PretripAutoNotify → ghim hỏng → RaKhoiControls (chứa bản sao bão) → lớp SSHA hỏng → chất lượng cá → mất sóng nền | Ra khơi | thứ tự = thứ tự JSX; ca mất sóng chưa cache 6–8 khối |
| Thanh giờ / sheet peek / body | FM C1–C6, D1–D9, E1–E13, RoutePlanner F1–F17 | Ra khơi | kết quả tuyến tới ~10 khối cảnh báo trước nút dẫn đường |
| Băng trạng thái trên thẻ | `StatusBanner` | /tau, /nguoi, giỏ, đơn | mọi thẻ đeo băng kể cả xanh |
| Badge tab | `tau-tabs.tsx:57` | /tau | chỉ đếm nợ; Giấy tờ không badge |
| OS push | `public/sw.js:1412-1503` ← `api/admin/push` (tay), `account-notify.ts` (đơn hàng) | ngoài app | không `tag`, không quiet hours, không phân vùng |
| Xin quyền push | `hero-account.tsx:468` | sheet Tài khoản | chỉ khi tự bấm — tốt |
| Dock | `bottom-nav.tsx` | mọi màn | không badge nào |
| Layout | `layout.tsx` | — | không vẽ thông báo nào |

## 2. Đánh giá 4 tính

| Tính | Điểm | Lý do chính (ID ở mục 3/4) |
|---|---|---|
| Đồng bộ | **4/10** | Không giọng chung (K1/K2); "máy hết chỗ" 5 bản, "chưa tải được đồ SDVICO" 3 bản + 1 nuốt im (T14); 4 cách nói mất sóng trong 1 sheet (S15); premium 3 tên, đăng nhập 8 nơi/5 copy (G7); ngưỡng "sắp hết" 30/30/30/14/7 + `daysUntil` chép 6 lần (T4). Riêng tin bão đồng bộ tốt — mẫu để nhân rộng. |
| Đúng đắn | **6/10** | Lõi an toàn đúng (không nói "không có bão" từ tin cũ). Nhưng nói sai: S11, M6, G2, G3, P5, T2 ("Giấy tờ ổn" cho hồ sơ không ngày), T5, N1 (lệch UTC), N5 (báo đỏ khi chưa nhập). |
| Phù hợp | **5/10** | Không có "đang ở biển" (K4); mất sóng nhắc lì (M5); 6–8 khối khi mất sóng chưa cache (M1); tuyến ~10 khối (M7); ranh giới theo điểm xem không theo GPS (M3); auto-hide 5s/3s cho người 50 tuổi (M9). |
| Cần thiết | **5/10** | Thừa: nợ 4 chỗ (T6), đơn hàng 12 điểm chạm/1 đơn (P6), premium 5 gate Trục 1 (M8), install iOS mỗi lần mở (S7), CCCD 2 lần cùng màn (T8). Thiếu: bão Trang chủ (S10), push bão (P7), bị đá (G1), xác nhận sau hành động (G4), badge tin mới (S9). |

## 3. Phát hiện đã kiểm chứng (xếp theo mức)

### P1 — nói sai với người dùng / thất bại câm có hại
| ID | Chỗ | Nội dung (đã confirm) |
|---|---|---|
| S14 | `boat-switcher.tsx:63-73,102,116,147` | `saveFailed` set khi form đóng (`pick=false`) nhưng alert chỉ vẽ trong `{pick && …}` → lưu tàu hỏng vì máy đầy, màn hình im; chỉ thấy khi mở lại "Chọn tàu". |
| G2 | `product-inquiry-button.tsx:71-74,90-94,157` | SĐT sai / mất sóng / timeout / 500 đều → "Nhập đúng số điện thoại rồi thử lại." Không hotline. |
| S11 | `storm-banner.tsx:50-77` | Nhánh `khong-hoi-duoc` có `checkedAt` (type `storms.ts:57`) nhưng không hiện tuổi tin; copy cứng "máy không có sóng" dù `{ok:false}` cũng sinh khi online mà nguồn 5xx. `stormGateForRoute` đã biết nói "tin cũ N giờ" — banner không dùng. |
| N1 (mới) | `documents.ts:46-54` + 5 bản chép; `tau-tabs.tsx:22` | `daysUntil` lấy ngày UTC → 00h–07h VN "hôm nay" = hôm qua: giấy hết hạn hôm nay hiện "Còn 1 ngày", nợ đến hạn hôm qua chưa đỏ tới 7h sáng. |
| N5 (mới) | `crew-list.tsx:93-111`, `maintenance-reminders.tsx:160-` | effect `if (ready && !isDemo) setSaveFailed(!save(...))` chạy ngay sau hydrate → máy đầy thì băng đỏ "CHƯA lưu được" bật lúc mở màn dù chưa nhập gì. |
| T1 | `crew-list.tsx:75-84`, `maintenance-reminders.tsx:121-134` | JSON hỏng → rơi về sổ/lịch MẪU trông như thật → thêm người thật ghi đè chuỗi gốc. `readUserList` đã có (document-vault/boat-products dùng đúng), 2 file này chưa. (Nhánh `"null"`/`"{}"` sập trang là lý thuyết — không writer nào ghi vậy, chỉ qua devtools/import transfer.) |
| G1 | `device-token-store.ts:109-111`; `api/auth/token/route.ts:100`; `login/page.tsx` | Bị máy khác đăng nhập cùng SĐT → xoá token, bắn `forfish:kicked`, **không UI nào nghe** (chỉ `use-tier.ts:135` re-sync); server còn trả `kicked:true` cho máy MỚI để "màn hình nói đã đăng xuất máy trước" — login page cũng không đọc. Cả hai đầu im. (Critic hạ P2 vì cần có sóng mới bị đá; tôi giữ P1 vì premium biến mất không lời.) |

### P2 — nhiễu / lệch / thiếu
| ID | Chỗ | Nội dung |
|---|---|---|
| S2 | `urgent-strip.tsx:281-295` | Fetch `/api/me/sdvico` mỗi lần vào Trang chủ (không dùng cache module `use-sdvico-assets.ts:55-84`), lỗi nuốt im → thiếu nợ/bảo hành không báo; không `noteResponse` (bỏ lỡ chỗ phát hiện bị đá sớm nhất). |
| S3 | `urgent-strip.tsx:236` | crew danger `days=-9999`, warn `days=0` → thuyền viên "còn 29 ngày" xếp trên giấy tờ "còn 2 ngày"; danger crew đè giấy quá hạn 200 ngày. |
| S6 | `document-vault.tsx:144-147` | Dải khẩn gom mọi tàu, tab lọc tàu đang chọn, `?tab=` không mang boatId (chỉ khi >1 tàu; có nhãn tàu + BoatSwitcher nên không ngõ cụt tuyệt đối). |
| S17 | `sdvico-assign-prompt.tsx:41` | `onClose=save` → vuốt đóng = ghi "Dùng chung", không có UI sửa lại. |
| S7/S8 | `install-prompt.tsx:31-58`, `page.tsx:66-114` | iOS hiện mỗi lần mở tới khi X; Android bấm Cài rồi huỷ không ghi khoá; ca xấu dải khẩn 4 dòng + Install đẩy 4 ô chính khỏi màn đầu (07:153 "≤3 khối" đã lạc hậu, chưa cộng BoatSwitcher/Install/Inbox). |
| S13/M5 | `storm-banner.tsx:58`, `ra-khoi-controls.tsx:734` | Câu bão-mất-sóng nhân bản; 22 câu mạng ở Trục 1, 11 thường trực; không phân biệt "chưa từng có tin" vs "có tin lúc 6h". |
| M1/M7 | `fishing-map-view.tsx:2559-2594`; `route-planner.tsx:558-694` | Vùng nổi theo thứ tự JSX (bão đứng đầu là do vị trí khai báo, may mà đúng); kết quả tuyến ~10 khối cảnh báo liên tiếp. |
| M3 | `fishing-map-view.tsx:1774`, `nav-mode.tsx`, `:2018-2022` | Ranh giới tính theo điểm đang xem; NavHud không có ranh giới; đường ranh đã bỏ vẽ. Docs đã ghi geofence = backlog (06-jtbd:44). |
| T4/T5 | `documents.ts:43,64`, `crew.ts:61`, `products.ts:24`, `owned-assets.ts:76`, `maintenance-reminders.tsx:50` | 30/30/30/14/7 + nợ/eCDT không ngưỡng; chỉ 30 (giấy tờ) và 14 (dịch vụ) có trong 04; bảo dưỡng 7 (cần đặt thợ) báo muộn nhất; `days===0` vàng theo 04:333 (nên chốt lại = đỏ). |
| T6/T7 | `tau-tabs.tsx:23-57`, `boat-services.tsx:120-124`, `owned-assets.ts:120-125` | Nợ 4 chỗ; badge tab chỉ đếm nợ, Giấy tờ không badge; nợ chưa tới hạn 6 tháng vẫn vàng; "Đã nhận — chờ gọi lại" vàng (vi phạm 07:367 màu ≠ chữ). |
| T13 + N2 (mới) | `boat-products.tsx:116-129,193-200,332` | Banner "đừng thêm đồ mới" nhưng nút Thêm vẫn bật; nhánh đọc lại khi đổi tàu set `readFailed` mà `ready` vẫn true → effect ghi không guard → có thể ghi đè chuỗi đang không đọc được. |
| G3 | `price-board.tsx:76-87,100,126-129`; `price-history-sheet.tsx:199-208` | Fetch 1 lần lúc mount, không `online` listener (khác market-board/my-orders/sdvico-catalog), chưa từng cache → bảng tĩnh ngày build không nói mất sóng; giá dầu lỗi → khối biến mất im; lịch sử giá gộp mất sóng với "VASEP không đăng". |
| G4 | `doi-mat-khau:187`, `dang-ky:100-103`, `my-orders.tsx:135-138` | Đổi mật khẩu xong / đăng ký xong nhưng signIn hỏng / huỷ đơn xong → không xác nhận. |
| G8 | `market-board.tsx:100-104,172-176,305-317` | Offline lần đầu: banner "chưa tải được" + empty "đăng tin đầu tiên đi" cùng lúc; nút đổi trạng thái không disabled tới 20s. |
| P2/P6/P7 | `sw.js:1421-1428`, `admin/push/route.ts`, `account-notify.ts` | Không `tag`/quiet hours/phân vùng; đơn hàng = push+hộp thư+chip; không push bão/premium/duyệt cảnh báo/đồ SDWork. |
| P3 | `api/push/subscribe/route.ts:95-126` | PATCH/DELETE không auth (hạ P2: endpoint ngẫu nhiên khó đoán, client tự đăng ký lại lần mở sau) — thuộc bài security, ghi riêng. |
| S16 | `sw-register.tsx` | SW `skipWaiting+claim` đổi vỏ ngầm không báo (listener không cleanup là cố ý, không leak). |
| N4 (mới) | `storm-banner.tsx:39-44` | deps `[check]` → mỗi nhịp poll 30 phút thẻ bão bà con vừa mở lại tự thu sau 3s. |

### P3 — cosmetic / tranh luận thiết kế
S1 (`today` đóng băng chỉ ảnh hưởng PWA để nguyên Trang chủ qua nửa đêm — page remount mỗi lần điều hướng), S12 (3s thu bão là chủ đích user 2026-06-23), P5 (hộp thư thiếu "TIN CŨ" nhưng có giờ gửi cạnh tiêu đề), T3 (mẫu báo đỏ trong tab — có banner "đây là mẫu"), M6, M8 (5 gate premium đều là gate tại điểm dùng, không phải nudge tự bung), K3, G5 (`catalog-orders`/`product-catalog` là cache — nuốt lỗi đúng; chỉ `cart.ts` là dữ liệu tự nhập, nuốt lỗi là chủ đích ghi chú → tranh luận chính sách), T2 phần short-circuit bảo hiểm (thiết kế có ghi chú `crew.ts:74-75`).

### Bác bỏ / đính chính claim vòng 1
- "Chip hero Đăng nhập hiện mọi trang" — **sai**, `HeroAccount` chỉ mount ở `page.tsx`.
- "market-board thiếu nút Thử lại thủ công" — **không phải lỗi**, 01-product:31 chốt "không bắt bà con bấm Thử lại"; đã có `online` listener.
- "`"null"` trong localStorage sập Trang chủ/nguoi/tau" — **lý thuyết**, không writer nào ghi; giữ như nợ bất nhất giữa 2 loader.
- "Bão hiện 5 chỗ trên bản đồ là lặp" — **sai trọng số**: 5 lớp nhìn (banner/polygon/marker/chấm rail/panel) của 1 sự kiện là redundancy tốt; chỉ thiếu phân cấp theo khoảng cách tàu.

## 4. "Nhắc như cái máy" — bảng chốt (đã phản biện 2 chiều)

| Thông báo | Chốt | Lý do |
|---|---|---|
| Băng vàng "Chưa hỏi được tin bão — máy không có sóng" thường trực (S11/S13/M5) | **HẠ CẤP + SỬA COPY, KHÔNG BỎ** | Chiều nhiễu: ngày thứ 3 ngoài khơi ai cũng biết mất sóng. Chiều an toàn: cái có giá trị là **tuổi tin bão** ("tin bão cũ 3 ngày · nghe đài") — thông tin mới mỗi ngày. Chốt: hiện đầy đủ 1 lần khi tin vừa quá 12h, rồi thu về chip nhỏ cùng nhịp chip bão; dùng `stormGateForRoute`; online mà nguồn lỗi → "nguồn tin bão đang lỗi". Bản trong panel Thời tiết giữ (chỉ hiện khi tự mở). |
| Thẻ đỏ CÓ BÃO bung lại mỗi lần vào màn (S12) | **GIỮ, chỉnh nhịp** | Đây là an toàn tính mạng, bà con vào màn này để hỏi "đi được không". Sửa: 3s→5s, không tự thu khi cấp danger + tàu trong bán kính; sửa N4. Thêm ở Trang chủ. |
| "Mất sóng — đang dùng bản đồ lưu trong máy" (A7) | **GIỮ** | Đã 1 lần rồi tắt, chỉ nói lại khi câu đổi — mẫu đúng. Sửa M6. |
| 11 câu mạng thường trực Trục 1 (M5) | **GỘP về 1 chip/màn** | Panel con im; chỉ ghi "số lúc HH:MM D/M" cạnh con số. Mất sóng không phải tin, tuổi dữ liệu mới là tin. |
| Premium/đăng nhập 8 nơi (G7, M8) | **HẠ CẤP** | Đúng 07:113 "1 nudge/màn": gate chỉ tại điểm chạm vào tính năng khoá; nút ngày khoá chỉ icon; **ẩn hết khi offline** (`tel:` là ngõ cụt); 1 tên "Premium". |
| 1 khoản nợ 4 chỗ (T6) | **GỘP về 2** | Dải khẩn (khi quá hạn) + thẻ tab Dịch vụ. Bỏ banner đầu /tau + chấm đỏ tab chỉ-nợ; badge chuyển sang Giấy tờ. Nợ chưa tới hạn: không băng màu. |
| Đơn hàng push+hộp thư+chip (P6) | **HẠ CẤP** | Chuyện ở bờ. Push chỉ "đã giao"/"cần gọi lại"; còn lại hộp thư + chip. |
| Install iOS mỗi lần mở (S7) | **HẠ CẤP** | ≤3 lần cách ≥1 ngày rồi im; Cài-rồi-huỷ = ghi khoá. |
| Auto-hide 5s/3s (M9) | **SỬA số** | 1 dòng 5s; 2 dòng 8s hoặc tới lần chạm. |
| CCCD ×2 (T8), C6+C7 giỏ (G6), D7+E1 ranh giới (M3), F6→F16 tuyến (M7) | **GỘP** | Cùng ý cùng màn → 1 khối; tuyến gom "3 điều cần biết trước khi đi". |
| Dải khẩn 4 dòng + Install đẩy 4 ô (S8) | **GIỮ nội dung, đổi ưu tiên** | Trục 4 là lý do app tồn tại; Install nhường (xuống dưới 4 ô hoặc ẩn khi dải ≥3 dòng); sửa S3. |
| Bão 5 lớp nhìn (M2) | **GIỮ** | Không phải lặp. Chỉ thêm phân cấp theo khoảng cách tàu. |
| Chip pretrip / PretripAutoNotify | **GIỮ** | Đã đúng. |

## 5. Thiếu — nên có (theo giá trị cho bà con)
1. **Tin bão ở Trang chủ** — mount `StormBanner variant="page"` (mã chết sẵn) trên dải khẩn khi có bão hoặc tin cũ >24h. Công ~1h.
2. **Push bão tự động** từ cron `/api/storms` (30 phút): bão mới/lên cấp → push máy đã bật, `tag` theo mã bão, quiet hours trừ danger.
3. **Ranh giới theo GPS trong NavHud** — cảnh báo 1 lần khi vào 15 hl, lặp mỗi 5 hl, không tắt <6 hl; gộp D7/E1.
4. **Bị đá tài khoản có tiếng** — component nghe `TOKEN_KICKED_EVENT`; login đọc `kicked:true` → "Máy trước đã được đăng xuất".
5. **Sổ hỏng không rơi về mẫu im lặng** — `crew-list`/`maintenance` dùng `readUserList`; sửa S14, N5, N2.
6. **Xác nhận sau hành động** — đổi mật khẩu / huỷ đơn / đặt hàng (mã đơn + tổng) / thêm giỏ.
7. **Tuổi tin trong hộp thư** — in "TIN CŨ N ngày" như OS notification.
8. **Badge tab Giấy tờ** thay tab Dịch vụ.
9. Badge tin chưa đọc trên dock/hộp thư (làm sau).
10. "Có bản mới, mở lại app" khi SW đổi vỏ (thấp).

## 6. Đề xuất §8 Chính sách thông báo (dán vào 07-design-spec — CHƯA ghi, chờ chủ dự án chốt)

**Nguyên tắc gốc**: thông báo là *thông tin mới*, không nhắc lại thứ bà con đã biết. **Mất sóng không phải tin — tuổi của dữ liệu mới là tin.** Một sự kiện = 1 chỗ chính + tối đa 1 chỗ phụ (chip/badge).

| Tầng | Ví dụ | Vị trí | Lặp? | Tắt/tạm? | Offline |
|---|---|---|---|---|---|
| 1 Tính mạng | bão (có/cũ), ranh giới theo GPS, mất fix GPS khi dẫn đường | trên cùng Trang chủ + Ra khơi, không bị lớp nào che (kể cả kéo sheet) | bung lại mỗi lần vào màn khi còn hiệu lực; danger + trong bán kính: không tự thu | chạm thu về chip, không tắt hẳn | nói bằng **tuổi tin**, không nói "mất sóng" |
| 2 Mất dữ liệu / bị đá | máy hết chỗ chưa lưu, sổ hỏng, token bị thu hồi | inline đỏ tại chỗ vừa thao tác + dải khẩn nếu rời màn | tới khi xử lý xong | không | luôn nói |
| 3 Việc phải làm | giấy tờ/bảo hiểm/bảo dưỡng sắp hết, nợ quá hạn, cảnh báo thuyền viên | **chỉ** dải khẩn Trang chủ (≤4 dòng, danger trước warn, theo ngày) + badge tab đích; không banner riêng đầu trang con | 1 lần/ngày mở app; đã xem → badge | "để sau" = im 3 ngày | tính từ máy; ngày tính lại mỗi lần vào, giờ VN |
| 4 Trạng thái mạng/dữ liệu | đang xem bản lưu, chưa tải được, đang tải, đã lưu dự báo | **1 chip/màn**, tự tắt 5s (1 dòng)/8s (2 dòng), nói lại chỉ khi câu đổi | tự tắt | panel con im, ghi "số lúc HH:MM" cạnh số | đã có bản lưu → im + tuổi; chưa từng có → 1 lần "chưa tải được, máy không có sóng" + Thử lại |
| 5 Mời gọi | đăng nhập, premium, cài app | ≤1 khối/màn, tại điểm khoá hoặc Trang chủ, giọng mời | cài app ≤3 lần cách ≥1 ngày | tắt là nhớ (`forfish.*.dismissed`) | **ẩn hoàn toàn** |

Luật chung: ngân sách ≤3 khối/viewport (tầng thấp nhường tầng cao, tầng 1–2 không bị cắt) · cùng màn không hai câu cùng ý · 1 câu chuẩn/tình huống trong `lib/copy.ts` (mất sóng · máy hết chỗ · đang xem bản lưu · chưa tải được · đây là mẫu), xưng "bà con", không đổ tội sai · màu = chữ (đỏ chỉ khi chậm là mất tiền/bị phạt/nguy hiểm; "hôm nay hết hạn" = đỏ; chưa tới hạn = không băng; xanh không đeo băng) · 1 `daysUntil` giờ VN + `SOON_DAYS` chung (30 giấy tờ/BH/bảo hành, 14 bảo dưỡng+dịch vụ) · mẫu không sinh cảnh báo tầng 3, không đếm badge · push: chỉ tầng 1–2 tự động, tầng 3 ≤1/ngày, tầng 5 không; mọi push có `tag`, giờ gửi, "TIN CŨ" >2h; ~~quiet hours 22h–5h trừ tầng 1 danger~~ (**chủ dự án BÁC 2026-08-18b**: "giờ khuya làm cái gì???" — bão có tin là đẩy, giờ nào cũng vậy; thay bằng luật định danh cơn dùng chung `lib/storm-identity.ts` để không trùng/lệch giữa nguồn) · không toast (giữ inline).

## 7. Hồ sơ cần sửa
| Vị trí | Sửa thành |
|---|---|
| `02-architecture.md:342` | bão **4 trạng thái**, "chưa hỏi được" = VÀNG bắt buộc (cấm im); chỉ variant overlay được mount |
| `07-design-spec.md:59` | gạch "app KHÔNG có hộp thư" (đã có 01m); ghi nợ hộp thư chưa in TIN CŨ |
| `07:58`, `04:252`, comment `page.tsx:110-112` | inbox chỉ ẩn khi không có tin, không chặn đăng nhập (01n) |
| `07:153` | cập nhật khối Trang chủ (BoatSwitcher/Install/Inbox) hoặc chốt luật gộp |
| `07:595` | nhắc cài 3 chỗ (InstallBanner · băng iOS sheet tải-sẵn · 1 dòng login) |
| `07:194` vs `03:119` | chốt phạm vi StatusBanner (thẻ dữ liệu vs banner nổi) |
| `02:160`, `04:288` | thang lùi heartbeat 2 thang, cửa 30 phút (khớp state-registry:95) |
| `02:346`/`07:373`/audit-vong2:137 | số lớp popup: 10 loại theo `lib/pretrip.ts:662-755` |
| `state-registry.md:75` | `inbox.v1` → `inbox.v2` |
| `02:337-338` + login-gate/push-message/storm-banner page | gắn nhãn **mã chết** hoặc xoá |
| `04:333` | chốt `days===0` = đỏ hay vàng |
| `04` | thêm bảng ngưỡng chung + 1 `daysUntil` |
| `07` | thêm §8 Chính sách thông báo (mục 6) |

## 8. Top 10 việc nên làm trước (giá trị/công)
1. Bão ở Trang chủ (S10) — 1h.
2. Copy bão mất sóng → tuổi tin, chip nhỏ, đúng nguyên nhân (S11/S13/M5/N4).
3. Push bão tự động + `tag` + quiet hours (P7/P2).
4. Sổ hỏng không rơi về mẫu; S14; N5; N2; guard loader chung (T1/S4/S14/N5).
5. Ranh giới theo GPS trong NavHud, gộp D7/E1 (M3).
6. Bị đá có tiếng, cả 2 đầu (G1).
7. Premium/đăng nhập 1 nudge/màn, ẩn offline, 1 tên (G7/M8).
8. Nợ 4→2 chỗ, badge Giấy tờ, nợ chưa hạn không băng, requestStatus không vàng (T6/T7).
9. 1 `daysUntil` giờ VN + `SOON_DAYS` chung + "hôm nay" = đỏ + mẫu không đếm + sort dải khẩn (N1/T4/T5/T3/S3).
10. Xác nhận sau hành động + TIN CŨ hộp thư + G2 copy đúng lý do + price-board online listener (G4/G6/P5/G2/G3).
Riêng bảo mật (làm riêng): P3 auth cho PATCH/DELETE subscribe, ack/read giả được.

## Assumptions / giới hạn
- Chỉ đọc tĩnh, không chạy app: ca "6–8 khối cùng lúc" (M1) và mật độ thật trên máy nhỏ chưa đo bằng mắt.
- Ngưỡng nghiệp vụ (6/15 hải lý, 200 km bão, 12h tin bão, 7/14/30 ngày) là việc chốt của BA/chuyên gia — báo cáo chỉ nêu là "chưa có nguồn/chưa có trong spec".
- Không sửa code/doc trong đợt này (LOGIC task); §8 ở mục 6 là đề xuất chờ chốt.
