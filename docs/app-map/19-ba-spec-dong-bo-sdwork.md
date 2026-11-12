# 19 — ba-spec: Đồng bộ SDFish ⇄ SDWork (hiện trạng + khung cho dạng đồng bộ mới)

> Load khi: task chạm BẤT KỲ đường dữ liệu nào giữa SDFish và SDWork (CRM SDViCo) — webhook vào, gọi ra, cron đối chiếu, đơn mua, yêu cầu tư vấn, gia hạn S-Tracking, premium, mật khẩu, trace tiền — hoặc khi định thêm một DẠNG ĐỒNG BỘ MỚI cho tính năng mới. Đọc §0 trước để biết cái gì đang chạy thật.
covers: src/lib/sdwork-webhook.ts, src/lib/sdwork-assets.ts, src/lib/sdwork-order.ts, src/lib/sdwork-request.ts, src/lib/sdwork-outbound.ts, src/lib/renewal-server.ts, src/lib/auth-gateway.ts, src/lib/password-reset.ts, src/lib/sdvico-orders, src/app/api/sdwork, src/app/api/sdvico, src/app/api/renewal, src/app/api/cron/trace-payments, src/app/api/cron/xac-nhan-gia-han, src/app/api/cho/don-sdvico, src/app/api/me/sdvico, src/app/api/me/sdt-khac
last_verified: 2026-11-12
ttl_days: 90

> **Mục đích**: oracle HÀNH VI cho mọi luồng dữ liệu SDFish ⇄ SDWork — ai sinh dữ liệu, ai nhận, khi nào, sai thì kết thúc ở đâu. KHÔNG mô tả giao diện (07-design-spec) và KHÔNG thay contract shape (`docs/contracts/*`, `docs/integration/*` — shape vẫn sửa ở đó).
> **Nguồn rà soát (2026-11-11, đo lại 2026-11-12)**: code SDFish `main` đã kéo tới `origin/main` `6a02033a` (4 commit mới chỉ đổi chữ hiển thị, không đụng logic đồng bộ) + code CRM `crm-sdvico-40` đọc từ `origin/main` `4db7af48` (`git show`, không pull; fetch lại 2026-11-12 không có commit mới). Ranh giới hai hệ giữ nguyên theo [10 §0](10-ba-spec-quan-tri-van-hanh.md): **SDWork = chân lý tiền + khách; SDFish = vận hành + trải nghiệm ngư dân**.

---

## 0. HIỆN TRẠNG — kiểm kê toàn bộ luồng (đo trên code, không theo doc)

### 0.1 Bảng luồng

Chú thích trạng thái: **CHẠY** = có code hai đầu và đang dùng · **TẮT** = code xong nhưng cờ tắt / chưa deploy · **NỬA** = một đầu có, đầu kia không · **CHẾT** = có code nhưng không ai gọi · **NGOÀI GIT** = chạy thật nhưng mã nguồn không nằm trong repo nào.

| # | Luồng | Chiều | Kích hoạt | Cách chở + xác thực | Chống trùng | Sai thì sao | Trạng thái |
|---|---|---|---|---|---|---|---|
| L1 | Khách hàng (account → `customer`) | SDWork→SDFish | trigger `accounts` → `sdfish_outbox` → `sdfish-outbox-push` (pg_cron 1′) | POST `/api/sdwork/webhook`, HMAC `x-sdwork-signature` | `ref = accounts.id`, SDFish upsert theo `sdwork_ref`; trùng SĐT → `claimByPhone` | CRM lùi 1′→24h, 8 lần thì `dead` (không báo ai); 401 dừng cả lô | **CHẠY** |
| L2 | Mật khẩu khởi tạo + đặt lại | SDWork→SDFish | trigger `temp_credentials` (mk `sd123456`) · `resetPassword:true` | nằm trong L1 | như L1 | tạo user lỗi → `provisioned:false`, dữ liệu khách vẫn vào; không bao giờ reset SĐT nhân sự | **CHẠY** |
| L3 | Thiết bị có serial (+ hạn bảo hành) | SDWork→SDFish | trigger `order_item_serials`, `warranty_cards` | nằm trong outbox | `ref = order_item_serials.id` | như L1 | **CHẠY** |
| L4 | Vật tư không serial | SDWork→SDFish | trigger `order_items` (`track_by_serial=false`) | nằm trong outbox | `ref = order_items.id` | như L1 | **CHẠY** (cột `sku` thêm cho premium nhưng SDFish chưa đọc) |
| L5 | Đơn bán lẻ (mirror `crm_orders`) | SDWork→SDFish | trigger `orders` (deferred) | outbox entity `order` | `sdwork_ref` + `snapshot_at`, bia mộ chống hồi sinh | `bad_status` nếu ngoài 4 trạng thái | **TẮT** — cờ `sdfish_sync_flags.order_sync=false`; chỉ khách loại `customer`, bỏ trạng thái `new` |
| L6 | Trace mã CK | SDFish→SDWork | cron `/api/cron/trace-payments` mỗi giờ | POST `SDWORK_TRACE_URL`, HMAC `x-sdfish-signature` | `traced_at`; SDWork phải tự lọc trùng theo `code` | lỗi → để `traced_at` trống, giờ sau gửi lại; không đếm lần, không báo; thiếu env trả `ok` im lặng | **CHẠY** (không có test cho phần gửi) |
| L7 | Đã đối chiếu tiền | SDWork→SDFish | webhook `payment/reconciled` | như L1 | update theo `code` | `code_not_found` | **NỬA** — SDFish nhận được; CRM KHÔNG có code nào bắn `payment_reconciled` ⇒ thực tế chỉ admin đánh tay ([10 R2](10-ba-spec-quan-tri-van-hanh.md)) |
| L8 | Yêu cầu tư vấn / sửa chữa / cước | SDFish→SDWork | ngư dân gửi (`/api/sdvico/request`, `/api/me/sdt-khac`) | `forfish-gateway` action `request`, anon key | **không có** | lỗi → 502, SDFish không giữ lại gì (riêng `sdt-khac` có giữ dòng local) | **CHẠY · NGOÀI GIT** (`forfish-gateway` không có trong repo CRM) · một chiều, trạng thái không về |
| L9 | Đơn mua phase 1 | SDFish→SDWork | ngư dân hỏi mua 1 sản phẩm (`/api/sdvico/order`) | `sdfish-order` action `create`, `x-sdfish-secret` | `externalRef` UNIQUE phía CRM | lỗi → 502, SDFish không lưu đơn (chỉ bản lạc quan ở máy) | **CHẠY** · trạng thái chờ/duyệt/từ chối KHÔNG về |
| L10 | Danh mục SDVICO | SDWork→SDFish (kéo) | mở màn danh mục (`/api/sdvico/catalog`) | `forfish-gateway` action `catalog` | — | CRM sập → trả 200 `not_configured` (lẫn với thiếu cấu hình); hết cache 1 giờ là trống | **CHẠY · NGOÀI GIT** |
| L11 | Đồ đã mua đọc trực tiếp (`assets`) | SDWork→SDFish (kéo) | — | `forfish-gateway` action `assets` | — | — | **CHẾT** — `fetchOwnedAssets` không ai gọi; `/api/me/sdvico` đọc bảng local do L1/L3/L4 đổ vào. Contract `sdwork-assets` mô tả đường đã bỏ |
| L12 | Gia hạn S-Tracking | hai chiều (SDFish gọi) | ngư dân tạo yêu cầu; cron `/api/cron/xac-nhan-gia-han` 4 lần/ngày | `sdfish-renewal` (`price/create/list/pending/confirm`), `x-sdfish-secret` | `create` KHÔNG có khoá chống trùng phía CRM (SDFish chặn trước bằng `list`, `list` lỗi thì bỏ chặn); `confirm` có điều kiện | `confirm` lỗi → đếm, lượt sau làm lại | **CHẠY** · trạng thái về bằng hỏi định kỳ, không đẩy |
| L13 | Premium 2 chiều (`CNTT_SDFISH_12/18`) | hai chiều | A: đơn premium SDWork → `supply` có `sku` → SDFish cấp premium · B: SDFish bán premium → `sdfish-premium-order` sinh đơn thống kê | outbox / `x-sdfish-secret` | `externalRef` UNIQUE | — | **NỬA** — CRM đã build (chưa deploy); SDFish chưa có dòng code nào (không đọc `sku`, không gọi `sdfish-premium-order`). Premium hiện cấp qua trường `tier` của L1 hoặc tay ở `/quan-tri` |
| L14 | Quên mật khẩu | SDFish→SDWork | ngư dân gửi ở `/quen-mat-khau` | trình duyệt gọi thẳng `request-password-reset` của CRM | — | lỗi → hiện số hotline | **CHẠY** · mật khẩu mới về qua L2 sau khi nhân viên duyệt |
| L15 | Đăng nhập SSO / đăng ký (`auth-gateway`) | SDFish→SDWork | — | Edge Function trong project SDFish | — | — | **NGOÀI GIT** · `/api/auth/sso` không còn ai gọi (legacy) |

Không thuộc SDWork nhưng hay bị nhầm: S-Tracking từ máy GPU (`/api/stracking/nhap`), khuyến mãi (`sdvico_khach_hoi`), hỏi mua hàng vendor ngoài (`product_inquiries`) — đều local.

### 0.2 Điểm gãy (xếp theo hậu quả với bà con / tiền công ty)

| # | Điểm gãy | Hậu quả | Luồng |
|---|---|---|---|
| G1 | Ngư dân gửi đơn / yêu cầu xong là **mất dấu**: trạng thái (chờ · duyệt · từ chối · đang giao) không về; mã `SDF-xxxxxx` chỉ sống trong bộ nhớ trang | Bà con không biết đơn có ai nhận chưa, gọi hỏi lại; cảm giác "app gửi vào hư không" | L8, L9, L5 |
| G2 | SDFish→SDWork **không có hàng đợi**: CRM lỗi / thiếu env là yêu cầu biến mất, bà con phải gõ lại | Mất mối bán hàng; ngoài biển chập chờn sóng càng dễ mất | L8, L9 |
| G3 | Mã nguồn **ngoài git**: `forfish-gateway` (project CRM), `auth-gateway` (project SDFish), cron outbox, `sdfish_enqueue`, schema outbox prod lệch migration | Không ai rà được, sửa một bên không biết vỡ bên kia; `supabase db reset` CRM vỡ ở migration 20261102 | L1–L5, L8, L10, L15 |
| G4 | Premium 2 chiều đã chốt kinh doanh 25/08 nhưng SDFish chưa làm | Đơn premium bán ở SDWork không tự bật premium; premium bán ở SDFish không thành doanh thu ở SDWork | L13 |
| G5 | Dead-letter không báo ai (CRM `dead=true` chỉ ghi log); trace tiền lỗi vĩnh viễn vẫn "xanh" | Khách tạo ở SDWork không lên SDFish mà không ai biết; mã CK không tới kế toán | L1–L6 |
| G6 | Mật khẩu là **một chiều** nhưng 3 tài liệu nói khác nhau (outbox-spec, migration 0003 ghi "2 chiều"; sso-contract ghi đã bỏ) | Đổi mật khẩu ở SDFish rồi nhân viên reset bên SDWork là bị đè — đúng thiết kế nhưng chưa ai chốt thành luật | L2, L14 |
| G7 | Kiểm tra sức khoẻ chỉ xem **có secret hay không**; nhịp webhook đo bằng `customers.updated_at` (admin sửa tay cũng làm nó xanh) | Đồng bộ chết mà bảng Hệ thống vẫn báo ổn | tất cả |
| G8 | Cấu hình tách đôi: URL CRM đổi ở `/quan-tri` chỉ ăn cho gia hạn; đơn mua + tư vấn vẫn đọc env | Đổi URL tưởng xong nhưng nửa số luồng vẫn trỏ chỗ cũ | L8, L9, L12 |
| G9 | Đơn của đại lý / tài khoản phụ không bao giờ mirror (L5 chỉ lấy loại `customer`) dù tài khoản của họ có sync (L1) | Đại lý mở SDFish không thấy đơn mình | L5 |
| G10 | Hạn dịch vụ / hạn giám sát hành trình / nhắc bảo dưỡng từ SDWork chưa có luồng (`vessel_tracking_records` mới là bản nháp contract) | Nhắc của SDFish dựa vào dữ liệu bà con tự khai, không dựa vào hợp đồng thật | — |
| G11 | Webhook vào không chống phát lại (HMAC không kèm thời điểm); `delete` xoá cứng, không kiểm snapshot như đơn | Một gói tin cũ phát lại có thể xoá thiết bị mới | L1, L3, L4 |
| G12 | Test thiếu: không có ca `payment/reconciled`, không test phần gửi của trace-payments, route `/api/sdvico/order` và `renewal-server.ts` | Sửa là vỡ không ai biết | L6, L7, L9, L12 |
| G13 | ✅ **ĐÃ VÁ 2026-11-12** — trước: `/api/sdvico/order` và `/api/sdvico/request` để **SĐT trong thân yêu cầu thắng SĐT của phiên** (`body.phone || profilePhone`), `externalRef` nhận chuỗi tuỳ ý. Nay: đã đăng nhập ⇒ SĐT phiên (`lib/phone.contactPhone`, dùng chung hai route); ref phải đúng dạng máy sinh `sdf-…` ≥ 20 ký tự (`isValidOrderRef`, sai ⇒ 400 `bad_ref`). Còn lại (cố ý): khách vãng lai vẫn tự gõ số — form là mối bán hàng, CSKH gọi lại xác minh | Người đã đăng nhập tạo được đơn/yêu cầu đứng tên SĐT người khác; mã ngắn đoán được thì nhận lại đơn cũ của người khác | L8, L9 |
| G14 | CRM có HAI worker outbox: `sdfish-outbox-push` (8 lần, lùi 1′→24h) và `flush-sdfish-outbox` cũ (10 lần, không lùi, đọc cột `payload` đã không còn trên prod) — vẫn deploy, cron ngoài git nên không biết cái nào đang chạy | Ngưỡng `dead` không xác định; nếu cả hai chạy thì một dòng có thể gửi hai lần | L1–L5 |
| G15 | Worker CRM khớp `results[]` theo `(ref, entity)` và lấy **kết quả đầu tiên** (`sdfish-outbox-push/index.ts:166`); `snapshotAt` chỉ có ở entity `order`; CHECK `sdfish_outbox_entity_check` chỉ cho `customer/device/supply/order` | Luồng trạng thái mới phải theo mẫu của `order`: chỉ giữ ≤ 1 dòng chưa gửi cho mỗi ref, kèm snapshot. Muốn thêm entity mới thì phải sửa CHECK phía CRM | L5, NV1, NV2 |
| G16 | Bảng `consultation_requests` không có migration nào trong repo CRM (chỉ có trong `types.ts`), vì nó do `forfish-gateway` (ngoài git) ghi | Muốn đưa trạng thái yêu cầu về SDFish thì trước hết phải biết schema thật của bảng này | L8, NV2 |

---

## 1. Vấn đề & JTBD
- **Job (ngư dân)**: Khi tôi đã gửi hỏi mua / gọi sửa / gia hạn qua SDFish, tôi muốn biết việc đó đang ở đâu mà không phải gọi điện, để yên tâm ra khơi.
- **Job (SDVICO)**: Khi có giao dịch ở bất kỳ bên nào, công ty muốn hai hệ khớp nhau mà không ai phải nhập hai lần, và khi đường truyền hỏng thì có người biết trong ngày.
- **Job (người làm tính năng mới)**: Khi một tính năng mới cần dữ liệu bên kia, tôi muốn chọn đúng một dạng đồng bộ đã có sẵn đường ray (chống trùng, gửi lại, nhật ký, sức khoẻ), không tự chế thêm một đường ống thứ 16.
- **Vì sao bây giờ**: 15 luồng đã mọc theo 4 kiểu xác thực và 3 kiểu gửi lại khác nhau; luồng mới (premium, đơn phase 2, vessel tracking) đều đang chờ. Dựng tiếp trên nền rời rạc thì mỗi luồng mới lại thêm một chỗ hỏng không ai thấy.
- **Đo thành công bằng**: 0 yêu cầu của bà con bị mất khi CRM lỗi; mọi luồng có trạng thái sức khoẻ thật; luồng mới thứ N dùng lại ≥ 3 phần đường ray chung (§9 R1–R6).

## 2. User registry
| User / actor | Là ai | Vòng đời | Bối cảnh |
|---|---|---|---|
| Ngư dân / chủ tàu | khách SDFish, có hoặc chưa có tài khoản | mới → quen | điện thoại, sóng chập chờn, có khi mất sóng nhiều ngày |
| Khách vãng lai | chưa đăng nhập, gửi hỏi mua = mối bán hàng | public | điện thoại |
| Nhân viên kinh doanh SDWork | nhận yêu cầu tư vấn / đơn phase 1, gán SKU, duyệt / từ chối | quen | CRM trên máy tính |
| Nhân viên CSKH / gia hạn (hub) | đối soát tiền gia hạn, bấm "đã gia hạn" | quen | cskh-tasker-hub |
| Kế toán / admin SDVICO | đối chiếu mã CK với sao kê, giữ sổ tiền | quen | CRM |
| Admin SDFish | cấu hình khoá + URL, xem sức khoẻ đồng bộ, cấp premium tay | quen | `/quan-tri` |
| Đại lý (manager SDFish) | chăm khách của mình, nhập mã CK | quen | `/quan-tri` |
| `outbox-worker` (system, SDWork) | `sdfish-outbox-push`, đẩy sự kiện CRM sang SDFish | — | pg_cron 1′ |
| `cron-sdfish` (system) | trace-payments, xac-nhan-gia-han, (mới) hàng đợi gửi đi | — | GitHub Actions cron-prod |
| `webhook-sdfish` (system) | `/api/sdwork/webhook`, nhận và ghi | — | server SDFish |

## 3. User × Nghiệp vụ
| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV0 | **Đường ray đồng bộ chung**: mỗi gói gửi đi được giữ lại tới khi bên kia xác nhận, chống trùng bằng khoá ngoài, có nhật ký, có sức khoẻ | system (`cron-sdfish` + `webhook-sdfish`) | admin SDFish (xem), outbox-worker | — | liên tục | **Must** (nền cho mọi NV sau) |
| NV1 | Đơn mua SDFish → SDWork **và trạng thái về** (phase 2) | ngư dân | NV kinh doanh (duyệt) | NV0 | trung | **Must** |
| NV2 | Yêu cầu tư vấn / sửa chữa / cước → SDWork **và trạng thái về** | ngư dân / khách vãng lai | NV kinh doanh / CSKH | NV0 | cao | **Must** |
| NV3 | Premium 2 chiều theo contract CRM `sdfish-premium-order-sync` | system | NV kinh doanh (A), ngư dân (B) | NV0 | thấp | **Should** |
| NV4 | Trace mã CK + đối chiếu tự động | system | kế toán, đại lý | NV0 | trung | **Should** (đang chạy, làm chắc) |
| NV5 | Gia hạn S-Tracking: trạng thái đẩy về thay vì chỉ hỏi định kỳ | system | CSKH gia hạn, ngư dân | NV0 | thấp | **Could** (hỏi 4 lần/ngày đang đủ) |
| NV6 | Mật khẩu: chốt **một chiều SDWork→SDFish** thành luật, dọn tài liệu lệch | admin SDFish | NV SDWork | — | — | **Must** (chỉ là chốt + doc) |
| NV7 | Hạn dịch vụ / giám sát hành trình / bảo hành từ hợp đồng thật → nhắc của SDFish | system | ngư dân (nhận nhắc) | NV0 | thấp | **Could** |
| NV8 | Đơn của đại lý / tài khoản phụ hiện trên SDFish | system | đại lý | NV1 | thấp | **Won't (đợt này)** |
| NV9 | **Khung tiếp nhận dạng đồng bộ mới** — cách chọn kiểu đồng bộ cho tính năng mới (§9 R7) | người làm tính năng (agent/dev) | admin SDFish | NV0 | mỗi tính năng | **Must** |

## 4. Cross-user handoff map
| Chặng | NV | Từ | → Nhận | Điều kiện chuyển | Điểm kết nếu không ai nhận |
|---|---|---|---|---|---|
| H1 | NV1 | ngư dân (gửi đơn) | NV kinh doanh | đơn ở SDWork trạng thái `pending` | quá 24 giờ kể từ lúc tạo vẫn `pending` → server SDFish gắn cờ `cho_lau` cho đơn, kèm số hotline; không tự huỷ |
| H2 | NV1 | NV kinh doanh (duyệt / từ chối) | ngư dân | trạng thái đổi ở SDWork | sự kiện không tới → bản cũ vẫn hiện, kèm thời điểm cập nhật cuối |
| H3 | NV2 | ngư dân / khách vãng lai | NV kinh doanh / CSKH | yêu cầu nằm trong `consultation_requests` | như H1; khách vãng lai không có nơi nhận trạng thái → kết ở "đã gửi" + hotline |
| H4 | NV0 | `cron-sdfish` (gửi) | SDWork | SDWork trả `ok` | sau 8 lần lỗi → `dead`. Người nhận là **admin SDFish**: sức khoẻ luồng ở tab Hệ thống `/quan-tri` chuyển lỗi và có lệnh gửi lại (AC-3b) |
| H5 | NV0 | `outbox-worker` | `webhook-sdfish` | SDFish trả `ok` cho sự kiện | CRM đánh `dead` thì SDFish không thấy. **Việc phía CRM**: worker gửi lô rỗng làm nhịp sống mỗi 15′; SDFish chỉ báo lỗi khi mất nhịp quá 60′ |
| H6 | NV3-A | NV kinh doanh (lên đơn premium) | ngư dân | `supply` có `sku` `CNTT_SDFISH_*` tới SDFish | `supply` tới trước `customer` (khác lô) → giữ `premium_cho` theo SĐT 30 ngày; tới khi khách có tài khoản thì áp; hết 30 ngày thì báo admin |
| H7 | NV3-B | ngư dân (mua premium trên SDFish) | SDWork (đơn thống kê) | premium đã cấp ở SDFish | gửi lỗi → hàng đợi NV0, premium **vẫn cấp** cho bà con |
| H8 | NV4 | đại lý (nhập mã CK) | kế toán | `payments.pending` | như [10 H1–H3](10-ba-spec-quan-tri-van-hanh.md) |

## 5. Flows

### Flow NV0 — Đường ray gửi đi · owner: `cron-sdfish`
- **Start**: một nghiệp vụ SDFish cần gửi dữ liệu sang SDWork (đơn, yêu cầu, premium, mã CK…)
- **Input**: loại việc · khoá ngoài ổn định (`externalRef`) · nội dung · SĐT lấy từ phiên (không từ máy khách)
- **Steps**: server sinh `externalRef` (hoặc nhận lại ref máy đã xin trước đó cho đúng bản nháp này) → ghi gói vào hàng đợi SDFish **trong cùng lần xử lý** với việc gốc → thử gửi ngay → thành công thì đánh dấu đã gửi + lưu mã bên kia trả về → thất bại thì xếp lần sau theo nấc lùi → quá ngưỡng thì `dead` → admin xem và ra lệnh gửi lại (đặt lại số lần, về `cho_gui`)
- **Nhánh mất sóng** (bà con chưa tới được server): máy giữ bản "chưa gửi" cùng `externalRef`, tự gửi khi có mạng; gửi trùng không sao vì R1
- **Output**: mỗi gói ở đúng 1 trong 3 trạng thái `cho_gui` · `da_gui` · `dead`; bà con nhận "đã nhận yêu cầu" (`code: accepted`) ngay cả khi CRM đang lỗi
- **End**: `da_gui` hoặc `dead` (admin thấy, gửi lại được)
- **Đổi hành vi so với hiện tại**: `/api/sdvico/order` và `/api/sdvico/request` đang trả 502 khi CRM lỗi → sẽ trả 202

### Flow NV0b — Đường ray nhận về · owner: `webhook-sdfish`
- **Start**: outbox-worker POST một lô
- **Input**: lô sự kiện có chữ ký + (mới) thời điểm ký
- **Steps**: kiểm chữ ký và độ tươi → từng sự kiện: kiểm loại có trong danh sách nhận → ghi theo `ref` (cũ hơn bản đang có thì bỏ, kể cả `delete`) → ghi nhật ký nhận
- **Output**: `results[]` từng sự kiện; "lần nhận cuối" cập nhật cho bảng sức khoẻ
- **End**: trả lô kết quả; loại sự kiện lạ → `unknown_entity` (không làm hỏng cả lô)

### Flow NV1 — Đơn mua và trạng thái về · owner: ngư dân
- **Start**: ngư dân đã đăng nhập chọn hỏi mua 1 sản phẩm SDVICO
- **Input**: sản phẩm, ghi chú, tên + SĐT từ tài khoản
- **Steps**: tạo đơn local trạng thái `cho_sdvico` + `externalRef` → NV0 gửi `sdfish-order` → nhận `SDF-xxxxxx` → NV kinh doanh duyệt / từ chối ở SDWork → SDWork bắn sự kiện trạng thái đơn yêu cầu theo `externalRef` (**việc phía CRM**: trigger trên `sdfish_order_requests`, entity mới hoặc mở rộng `order` — O2, theo mẫu G15) → SDFish cập nhật đơn local; duyệt thì nối với `crm_orders` qua `external_ref = 'sdfish_order:' || ref`
- **Map trạng thái** (nguồn: enum `sdfish_order_request_status` CRM migration 20260925000200):

  | CRM `sdfish_order_requests.status` | SDFish |
  |---|---|
  | `pending` | `cho_sdvico` |
  | `approved` | `da_nhan` (+ mã đơn CRM) |
  | `rejected` | `tu_choi` |
  | `cancelled` | `da_huy` |

  Các chặng giao (`dang_chuan_bi → dang_giao → da_giao`) đến từ mirror L5, chỉ có khi bật `order_sync` (O4) **và** nối được qua `external_ref`; chưa bật thì đơn dừng ở `da_nhan`
- **Output**: một đơn duy nhất trong "Đơn của tôi" theo bảng trên
- **End**: `tu_choi`, `da_huy`, `da_nhan` (khi chưa bật L5) hoặc `da_giao`; mỗi trạng thái hiện được cả khi mất sóng (bản đã lưu)
- **Cross**: H1, H2

### Flow NV2 — Yêu cầu tư vấn và trạng thái về · owner: ngư dân
- **Start**: ngư dân hoặc khách vãng lai gửi yêu cầu (mua chung chung / cước / sửa chữa / bảo dưỡng)
- **Input**: chủ đề, sản phẩm (nếu có), ghi chú, SĐT
- **Steps**: ghi local + NV0 gửi → SDWork tạo `consultation_requests` → (mới) SDWork đổi trạng thái xử lý → sự kiện về theo `externalRef`
- **Bị chặn**: chiều về chờ O3 + G16. Phía CRM phải xác nhận schema thật của `consultation_requests`, rồi thêm cột trạng thái + `external_ref` + trigger. Trong lúc chờ, NV2 chỉ làm chiều đi qua NV0 (AC-1, AC-1b)
- **Output**: người đã đăng nhập thấy yêu cầu `da_gui → dang_xu_ly → xong`; khách vãng lai kết ở `da_gui`
- **End**: `xong` hoặc `da_gui` (vãng lai, hoặc khi chiều về chưa có)
- **Cross**: H3

### Flow NV3 — Premium 2 chiều · owner: system
- **A (SDWork→SDFish)**: đơn premium ở SDWork → `supply` có `sku` `CNTT_SDFISH_12|18` → SDFish suy số tháng từ SKU → cộng dồn `premium_until` (không ghi đè hạn dài hơn) → ghi `premium_grants` nguồn `sdwork`
- **B (SDFish→SDWork)**: premium bán/cấp ở SDFish (đại lý thu mã CK) → NV0 gửi `sdfish-premium-order` với `externalRef` = id lần cấp → SDWork sinh đơn thống kê. Chống dội lại là tính chất của chính function CRM (đặt `skip_sdfish_outbox` trong phiên DB của nó, `:87`), không phải cờ SDFish gửi sang. Bỏ ra khỏi hàng đợi những lần cấp đến từ nhánh A (nguồn `sdwork`)
- **Output**: mỗi lần cấp premium có đúng 1 đơn ở SDWork và ngược lại; không vòng lặp
- **End**: cả hai bên ghi; B lỗi thì premium vẫn có, gói nằm `cho_gui`

### Flow NV6 — Mật khẩu một chiều · owner: admin SDFish
- **Luật**: SDWork là nơi duy nhất đặt lại mật khẩu cho bà con; SDFish cho đổi mật khẩu trên SDFish nhưng không đẩy sang SDWork. Lần reset kế từ SDWork sẽ đè — đúng thiết kế.
- **Output**: 3 tài liệu lệch (outbox-spec §password-in, header migration 0003, sso-contract §5b `SDWORK_SYNC_URL`) sửa về cùng một câu.

### Flow NV9 — Chọn dạng đồng bộ cho tính năng mới · owner: người làm tính năng
- **Start**: tính năng mới cần dữ liệu ở hệ bên kia
- **Input**: ai là chủ dữ liệu (§0 của 10), dữ liệu đổi bao lâu một lần, bà con có cần thấy khi mất sóng không, có dính tiền không
- **Steps**: tra bảng R7 → chọn 1 kiểu → khai loại gói / loại sự kiện vào **một file danh mục luồng** trong `src/lib/` (nguồn cho AC-14) + một dòng vào §0.1 + contract tương ứng + dùng đường ray NV0 → ghi các việc phía CRM vào contract → test theo R8
- **Output**: luồng mới có tên Lxx, trạng thái, chống trùng, điểm kết khi lỗi — trước khi viết code
- **End**: dòng mới trong §0.1 cùng commit với code

## 6. Flow optimization log
| Flow | Candidate | Chọn / Loại | Lý do (rubric) | Đánh giá bởi |
|---|---|---|---|---|
| NV0 | A: mỗi luồng tự lo gửi lại · B: một hàng đợi chung SDFish | **B** | A là hiện trạng sinh ra G2/G5 (3 kiểu gửi lại khác nhau); B ít cross, một chỗ đo sức khoẻ | Orchestrator + chuyên gia tích hợp |
| NV0 | A: hàng đợi trong localStorage máy bà con · B: hàng đợi ở server SDFish | **B** cho gửi CRM, máy chỉ giữ bản đã lưu để hiện | A mất khi xoá app, không ai thấy để gửi lại; ranh giới offline vẫn giữ vì máy vẫn có bản hiện | chuyên gia tích hợp |
| NV1 | A: SDFish hỏi định kỳ trạng thái đơn · B: SDWork đẩy qua outbox sẵn có | **B** | outbox CRM đã có lùi + dead-letter; A thêm đường gọi ra mới + trễ (giống lý do loại poll ở [10 D3](10-ba-spec-quan-tri-van-hanh.md)) | Orchestrator |
| NV1 | A: entity mới `order_request` · B: nhồi trạng thái chờ duyệt vào entity `order` | **Chưa chốt (Open O2)** | B ít loại hơn nhưng trộn hai bảng nguồn khác nhau (`sdfish_order_requests` vs `orders`) | — |
| NV5 | A: đẩy trạng thái gia hạn · B: giữ hỏi 4 lần/ngày | **B đợt này** | gia hạn hiếm, cron đã chạy ổn; đẩy là thêm luồng không đổi trải nghiệm (rubric: ít bước). Không mâu thuẫn với NV1 loại hỏi định kỳ: L12 hỏi vì CRM chưa có sự kiện gia hạn, đúng ngoại lệ ở R7 | Orchestrator |
| NV0 mất sóng | A: từ chối gửi, báo "chưa có sóng" · B: máy giữ bản chưa gửi, tự gửi khi có mạng | **B** | A khiến bà con phải nhớ gõ lại (đúng bệnh G2); B an toàn vì R1 chống trùng | reviewer + Orchestrator |
| NV6 | A: làm mật khẩu 2 chiều · B: chốt 1 chiều | **B** | 2 chiều cần SDFish cầm khoá ghi vào auth CRM — mở thêm bề mặt tấn công để giải bài toán chưa ai than | chuyên gia bảo mật |

## 7. Scope & Priority
- **IN (đợt chuẩn bị, phía SDFish)**: NV0 · NV1 (chiều đi + nhận trạng thái khi CRM bắn) · NV2 chiều đi · NV6 · NV9; G13 đã vá (2026-11-12); dọn G7 (sức khoẻ thật), G8 (một chỗ cấu hình), G12 (test thiếu).
- **Việc phía CRM (ghi vào contract, CRM làm)**: đưa `forfish-gateway` + cron outbox + `sdfish_enqueue` vào git (G3) · chốt một worker (G14) · sự kiện trạng thái `sdfish_order_requests` (NV1) · schema + trạng thái `consultation_requests` (NV2, G16) · nhịp sống worker (H5) · `snapshotAt` cho `device`/`supply` (R4) · thời điểm trong chữ ký (AC-6).
- **Đợt sau**: NV3 (chờ CRM deploy) · NV4 tự động (chờ CRM có `payment_reconciled`) · NV5 (giữ hỏi định kỳ) · NV7 (chờ contract vessel-tracking chốt).
- **OUT**: NV8 đơn đại lý; công nợ / sổ tiền hiện cho bà con (ranh giới [10 §0](10-ba-spec-quan-tri-van-hanh.md)); mật khẩu 2 chiều.

## 8. Success metric
| NV | Metric | Ngưỡng |
|---|---|---|
| NV0 | gói gửi đi bị mất (không ở `cho_gui`/`da_gui`/`dead`) | == 0 |
| NV0 | thời gian từ `dead` tới lúc admin thấy | ≤ 1 lần chạy cron |
| NV1 | đơn ngư dân gửi có trạng thái SDWork hiện trên SDFish (đo: `snapshotAt` của sự kiện so với `cap_nhat_luc` của đơn SDFish) | ≥ 95% trong 15 phút sau khi đổi |
| NV2 | yêu cầu mất khi CRM lỗi | == 0 |
| NV9 | luồng mới không có dòng trong §0.1 | == 0 |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | Mọi gói SDFish→SDWork có `externalRef` ổn định, sinh ở server, gửi lại bao nhiêu lần cũng chỉ ra 1 bản ghi bên kia | bà con bấm gửi 2 lần → cùng `externalRef` nếu cùng phiên soạn |
| R2 | Gói gửi đi được lưu ở SDFish **trước** khi gọi CRM; CRM lỗi không bao giờ làm mất yêu cầu của bà con | thiếu env → gói `cho_gui`, admin thấy "chưa cấu hình", không trả `ok` im lặng |
| R3 | SĐT / định danh khách lấy từ phiên server, không từ thân yêu cầu máy khách | khách vãng lai: SĐT tự khai, gắn cờ `chua_xac_thuc` |
| R4 | Sự kiện nhận về cũ hơn bản đang có thì bỏ — áp cho cả `upsert` lẫn `delete`. Hôm nay chỉ `order` có `snapshotAt`; `device`/`supply`/`customer` cần CRM thêm (việc phía CRM), chưa có thì giữ cách cũ | phát lại gói cũ sau khi thiết bị đã sửa |
| R5 | Mỗi luồng có sức khoẻ đo bằng **chính luồng đó** (lần gửi/nhận thành công cuối, số `cho_gui`, số `dead`), không bằng bảng khác | admin sửa `customers` không làm xanh L1 |
| R6 | Một nơi cấu hình cho URL + khoá CRM (`app_config`, env chỉ là dự phòng) — áp cho MỌI luồng | đổi URL ở `/quan-tri` ăn ngay cho L8/L9/L12 |
| R7 | **Chọn kiểu đồng bộ** (NV9): dữ liệu SDWork làm chủ + bà con cần khi mất sóng → **đẩy qua outbox CRM** về bảng local · dữ liệu SDWork làm chủ, đổi chậm, không cần offline → **kéo khi đọc** có cache + bản cũ khi lỗi · việc bà con khởi tạo ở SDFish → **gọi CRM qua đường ray NV0** (shared secret) · trạng thái việc đó về → **đẩy qua outbox CRM** theo `externalRef`, dạng **ảnh chụp trạng thái cuối** (CRM giữ ≤ 1 dòng chưa gửi mỗi ref, kèm `snapshotAt`; SDFish áp theo `snapshotAt` — vì worker CRM khớp kết quả theo ref, G15). Hỏi định kỳ chỉ khi CRM chưa đẩy được (ghi lý do + hạn bỏ) | tính năng dính tiền → chủ là SDWork, SDFish chỉ giữ mã + cờ |
| R8 | Luồng mới phải có: dòng trong §0.1, contract shape trong `docs/contracts/`, test ca thành công + CRM lỗi + gói trùng | thiếu một trong ba → chưa xong |
| R9 | Mã chạy thật của cả hai bên nằm trong git (Edge Function, cron, hàm SQL) | function deploy tay → phải đưa vào repo trước khi sửa tiếp |
| R10 | Không dội vòng: sự kiện SDFish sinh ra từ dữ liệu SDWork gửi tới không được gửi ngược lại | premium B có `skip_sdfish_outbox` |
| R11 | Mật khẩu chỉ đi SDWork→SDFish; không reset SĐT nhân sự ([10 R10](10-ba-spec-quan-tri-van-hanh.md)) | — |
| R12 | Trạng thái hiện cho bà con luôn kèm thời điểm cập nhật cuối; mất sóng thì hiện bản đã lưu | — |
| R13 | Chữ bà con thấy cho mọi trạng thái đồng bộ **không nêu tên hệ thống** (SDWork, CRM, S-Tracking, "hệ thống giám sát hành trình") và **không nói nhịp đồng bộ** ("4 lần mỗi ngày", "mỗi N phút"); chỉ nói SDVICO + việc đang ở đâu. Tên hệ thống chỉ ở mã nội bộ, log, bảng `/quan-tri` ([ops/khong-lo-nguon §6b hàng 17](ops/khong-lo-nguon.md), anh Long 10/11) | "SDVICO đã gia hạn, đang chờ cập nhật hạn" thay cho "đang chờ hệ thống giám sát hành trình đổi hạn — máy kiểm tra 4 lần mỗi ngày" |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Yêu cầu không mất khi CRM lỗi · Maps to flow: NV0 · Test: integration
- **Given** CRM trả 502 (hoặc chưa cấu hình URL)
- **When** ngư dân đã đăng nhập gửi một yêu cầu tư vấn hợp lệ, thân yêu cầu kèm SĐT khác SĐT phiên
- **Then** yêu cầu được nhận, gói nằm trong hàng đợi chờ gửi, đứng tên SĐT của phiên, ref do server sinh
- **Assert**: status == 202 · response.code == "accepted" · count(gói `cho_gui` với externalRef đó) == 1 · gói.phone == SĐT phiên · count(gọi CRM) >= 1

### AC-1b — Khách vãng lai gửi khi CRM lỗi · Maps to flow: NV0 · Test: integration
- **Given** chưa đăng nhập, CRM trả 502
- **When** khách gửi yêu cầu với SĐT tự khai hợp lệ
- **Then** gói được giữ chờ gửi, gắn cờ chưa xác thực, không có lời hứa trạng thái về
- **Assert**: status == 202 · gói.chua_xac_thuc == true · response.co_trang_thai == false

### AC-1c — Mất sóng lúc gửi, có sóng gửi lại không trùng · Maps to flow: NV0 · Test: e2e
- **Given** máy mất mạng
- **When** ngư dân gửi yêu cầu, rồi mạng trở lại
- **Then** yêu cầu được giữ ở máy với trạng thái chưa gửi, tự gửi khi có mạng, server chỉ có một gói
- **Assert**: lúc mất mạng count(bản "chua_gui" trên máy) == 1 · sau khi có mạng count(gói server theo externalRef) == 1 · count(bản "chua_gui" trên máy) == 0

### AC-2 — Gửi lại không sinh bản trùng · Maps to flow: NV0 · Test: integration
- **Given** một gói đã gửi thành công một lần nhưng chưa kịp đánh dấu
- **When** cron chạy lại và gửi lần nữa
- **Then** CRM chỉ có một bản ghi cho `externalRef` đó và gói chuyển `da_gui`
- **Assert**: count(bản ghi CRM giả lập theo externalRef) == 1 · trạng thái gói == "da_gui"

### AC-3 — Quá ngưỡng thì dead và có người biết · Maps to flow: NV0 · Test: unit
- **Given** một gói đã lỗi 7 lần
- **When** lần thứ 8 lỗi
- **Then** gói thành `dead` và sức khoẻ luồng báo có gói chết
- **Assert**: trạng thái gói == "dead" · health.dead_count >= 1 · health.ok == false

### AC-3b — Admin gửi lại gói chết · Maps to flow: NV0 · Test: integration
- **Given** một gói `dead`, CRM đã hết lỗi
- **When** admin ra lệnh gửi lại gói đó
- **Then** gói về chờ gửi với số lần đặt lại, lần cron kế gửi thành công, CRM vẫn chỉ một bản ghi
- **Assert**: ngay sau lệnh attempts == 0 và trạng thái == "cho_gui" · sau cron trạng thái == "da_gui" · count(bản ghi CRM giả lập theo externalRef) == 1 · count(nhật ký admin "gui_lai") == 1

### AC-4 — Thiếu cấu hình không được báo xanh · Maps to flow: NV0 · Test: integration
> Hệ quả có chủ ý: job cron-prod trên GitHub Actions sẽ ĐỎ cho tới khi cấu hình đủ.
- **Given** thiếu URL hoặc khoá của luồng trace tiền
- **When** cron trace-payments chạy
- **Then** kết quả cron và sức khoẻ đều báo chưa cấu hình
- **Assert**: response.ok == false · response.code == "not_configured" · health.status == "chua_cau_hinh"

### AC-5 — Sự kiện cũ không xoá bản mới · Maps to flow: NV0b · Test: integration (chờ CRM thêm `snapshotAt` cho `device` — R4)
- **Given** thiết bị `ref=X` đã có bản snapshot lúc T2
- **When** webhook nhận `device delete ref=X` mang snapshot T1 < T2
- **Then** thiết bị vẫn còn
- **Assert**: count(devices where sdwork_ref = X) == 1 · result.code == "stale_snapshot"

### AC-6 — Gói tin quá cũ bị từ chối · Maps to flow: NV0b · Test: unit (chờ CRM — đổi chữ ký, có giai đoạn chuyển tiếp: SDFish nhận cả lô có và không có thời điểm cho tới khi CRM deploy xong; lô gửi lại được ký lại lúc gửi nên nấc lùi 24h không vướng)
- **Given** một lô có chữ ký đúng nhưng thời điểm ký cách hiện tại > 10 phút
- **When** webhook nhận lô
- **Then** cả lô bị từ chối, không ghi gì
- **Assert**: status == 401 · count(bản ghi đổi) == 0

### AC-7 — Đơn mua hiện trạng thái chờ ngay khi gửi · Maps to flow: NV1 · Test: e2e
- **Given** ngư dân đã đăng nhập
- **When** gửi hỏi mua một sản phẩm SDVICO
- **Then** "Đơn của tôi" có đúng một đơn trạng thái chờ SDVICO, còn sau khi tải lại và khi mất sóng
- **Assert**: count(đơn của SĐT) == 1 · trạng thái == "cho_sdvico" · sau khi tắt mạng + tải lại count vẫn == 1

### AC-8 — Duyệt ở SDWork thì SDFish đổi theo · Maps to flow: NV1 · Test: integration
- **Given** đơn `externalRef=R` đang `cho_sdvico`
- **When** webhook nhận sự kiện `approved` cho `R` kèm mã đơn CRM
- **Then** đơn đó chuyển đã nhận, mang mã đơn CRM, và không sinh đơn thứ hai
- **Assert**: trạng thái == "da_nhan" · ma_don == mã trong sự kiện · count(đơn của SĐT) == 1

### AC-8b — Chờ quá 24 giờ có cờ · Maps to flow: NV1 · Test: unit
- **Given** đơn `cho_sdvico` tạo lúc T
- **When** tính trạng thái hiển thị tại T + 25 giờ
- **Then** đơn mang cờ chờ lâu, trạng thái không đổi
- **Assert**: cho_lau == true · trạng thái == "cho_sdvico" · tại T + 23 giờ cho_lau == false

### AC-9 — Từ chối ở SDWork có điểm kết · Maps to flow: NV1 · Test: integration
- **Given** đơn `externalRef=R` đang `cho_sdvico`
- **When** webhook nhận sự kiện từ chối cho `R`
- **Then** đơn chuyển từ chối và không còn nằm trong danh sách đang chờ
- **Assert**: trạng thái == "tu_choi" · count(đơn đang chờ của SĐT) == 0

### AC-10 — Yêu cầu tư vấn có trạng thái về · Maps to flow: NV2 · Test: integration (chờ CRM — G16, O3)
- **Given** ngư dân đã đăng nhập có yêu cầu `externalRef=Q` ở `da_gui`
- **When** webhook nhận sự kiện yêu cầu `Q` chuyển xong
- **Then** yêu cầu đó ở trạng thái xong kèm thời điểm cập nhật
- **Assert**: trạng thái == "xong" · cap_nhat_luc != null

### AC-11 — Đổi URL CRM một chỗ ăn cho mọi luồng · Maps to flow: NV0 · Test: unit
- **Given** `app_config.sdwork_crm_url` = U2, env = U1
- **When** ba luồng gửi đơn, gửi yêu cầu, gia hạn dựng địa chỉ gọi
- **Then** cả ba đều trỏ U2; khi `app_config` trống hoặc không phải URL hợp lệ thì cả ba rơi về U1
- **Assert**: count(luồng có host == U2) == 3 · với config = "" hoặc "abc": count(luồng có host == U1) == 3

### AC-12 — Premium từ đơn SDWork cộng dồn, không đè · Maps to flow: NV3 · Test: unit
- **Given** khách có `premium_until` = hôm nay + 100 ngày
- **When** webhook nhận `supply` có `sku` = "CNTT_SDFISH_12"
- **Then** hạn premium dời thêm 12 tháng tính từ hạn cũ
- **Assert**: premium_until == hạn cũ + 12 tháng · count(premium_grants nguồn "sdwork") == 1 · count(gói premium_order sinh ra) == 0 (không dội lại)

### AC-12b — Premium tới trước tài khoản · Maps to flow: NV3 · Test: unit
- **Given** SĐT chưa có tài khoản SDFish
- **When** webhook nhận `supply` có `sku` = "CNTT_SDFISH_18", rồi một lô sau mới tới `customer` của SĐT đó
- **Then** premium được giữ chờ, rồi áp khi tài khoản có
- **Assert**: sau supply count(premium_cho của SĐT) == 1 · sau customer tier == "premium" · count(premium_cho của SĐT) == 0

### AC-13 — Premium bán ở SDFish vẫn cấp khi CRM lỗi · Maps to flow: NV3 · Test: integration
- **Given** CRM `sdfish-premium-order` trả lỗi
- **When** đại lý cấp premium 12 tháng cho khách
- **Then** khách có premium ngay, gói đơn thống kê nằm chờ gửi
- **Assert**: tier == "premium" · count(gói `cho_gui` loại premium_order) == 1

### AC-14 — Luồng mới phải có dòng kiểm kê · Maps to flow: NV9 · Test: unit
- **Given** file danh mục luồng trong `src/lib/` (một nơi duy nhất khai loại gói gửi đi + loại sự kiện webhook nhận; webhook và hàng đợi chỉ nhận loại có trong danh mục)
- **When** chạy test đối chiếu với §0.1 của tài liệu này
- **Then** mọi loại đều có dòng
- **Assert**: count(loại không có dòng trong §0.1) == 0

### AC-16 — Mật khẩu một chiều nói cùng một câu · Maps to flow: NV6 · Test: unit
- **Given** ba tài liệu `docs/integration/sdwork-outbox-spec.md`, `docs/integration/sdwork-sso-contract.md`, header `supabase/migrations/0003_auth_password_sync.sql`
- **When** chạy test doc
- **Then** cả ba chứa câu luật mật khẩu một chiều và không còn nhắc đẩy mật khẩu từ SDFish sang SDWork
- **Assert**: count(file chứa "mật khẩu một chiều SDWork→SDFish") == 3 · count(file chứa "SDWORK_SYNC_URL" hoặc "sdfish-password-in") == 0

### AC-15 — Ca đối chiếu tiền có test · Maps to flow: NV4 · Test: integration (phía SDFish nhận được; CRM chưa bắn — L7)
- **Given** `payments` có mã CK `C` ở `pending`
- **When** webhook nhận `payment reconciled ref=C`
- **Then** khoản đó chuyển đã đối chiếu kèm thời điểm
- **Assert**: reconciled_status == "reconciled" · reconciled_at != null

### AC-17 — Chữ trạng thái đồng bộ không lộ nguồn · Maps to flow: NV9 · Test: unit
- **Given** mọi nhãn trạng thái đồng bộ bà con thấy (trạng thái đơn NV1, yêu cầu NV2, gia hạn L12, chờ lâu H1, chưa gửi NV0), lấy từ hằng số nhãn trong code
- **When** chạy test dò từ khoá cấm của R13
- **Then** không nhãn nào chứa tên hệ thống hay nhịp đồng bộ; luồng mới thêm nhãn cũng đi qua test này
- **Assert**: count(nhãn chứa "SDWork" | "CRM" | "S-Tracking" | "giám sát hành trình" | /\d+ lần mỗi ngày/ | /mỗi \d+ phút/) == 0

### AC-18 — SĐT người gửi lấy từ phiên · Maps to flow: NV1 · Test: integration (`src/lib/__tests__/sdvico-contact-phone.test.ts`)
- **Given** bà con đã đăng nhập bằng SĐT `A`; hoặc khách vãng lai chưa đăng nhập
- **When** gửi đơn mua hoặc yêu cầu tư vấn kèm SĐT `B` khác `A` trong nội dung, hoặc kèm mã chống trùng không đúng dạng máy sinh
- **Then** người đã đăng nhập: CRM nhận SĐT `A`; khách vãng lai: CRM nhận `B`; mã sai dạng: bị từ chối, CRM không nhận gì
- **Assert**: phone gửi CRM == `A` khi có phiên · phone gửi CRM == `B` khi không phiên · ref `DH75768` ⇒ status == 400, code == "bad_ref", số lời gọi CRM == 0

## 11. Assumptions / Open questions
- **Assumptions (fail-closed)**:
  - A1: Hàng đợi gửi đi ở server SDFish (bảng mới) — máy bà con chỉ giữ bản hiện. Cần migration ⇒ 🔴 hỏi trước khi apply.
  - A2: Trạng thái đơn/yêu cầu về bằng outbox CRM sẵn có (không thêm đường hỏi định kỳ).
  - A3: Khách vãng lai không có nơi nhận trạng thái; kết ở "đã gửi" + hotline.
  - A4: Ngưỡng `dead` phía SDFish = 8 lần, theo `sdfish-outbox-push` (worker mới); nếu prod hoá ra chạy `flush-sdfish-outbox` (10 lần) thì sửa lại số này (G14). Ngưỡng tươi chữ ký = 10 phút (cần CRM thêm thời điểm vào chữ ký — đổi contract, báo hai bên).
  - A5: Phase 2 cần CRM thêm sự kiện cho `sdfish_order_requests` và `consultation_requests` — việc phía CRM, ghi vào contract trước. Sự kiện là **ảnh chụp trạng thái cuối theo ref**: CRM giữ ≤ 1 dòng chưa gửi mỗi ref (như `order`), SDFish áp theo `snapshotAt`.
  - A6: Mất sóng lúc gửi ⇒ máy giữ bản chưa gửi, tự gửi khi có mạng (không từ chối) — §6.
  - A7: "Chờ lâu" = 24 giờ đồng hồ kể từ lúc tạo, không theo lịch ngày làm việc.
- **Open (RED — cần anh Long / chủ CRM chốt)**:
  - O1: **Tính năng mới nào cần đồng bộ?** Spec này dựng khung (NV0, NV9) + phase 2 đơn/yêu cầu; tính năng cụ thể (vd: vessel-tracking, nhắc bảo dưỡng theo hợp đồng, công nợ, chợ cá) cần được kể tên để viết flow riêng.
  - O2: Trạng thái đơn chờ duyệt đi entity mới `order_request` hay gộp vào `order`?
  - O3: Ai giữ việc đưa `forfish-gateway` (project CRM) và `auth-gateway` (project SDFish) vào git? Và trên prod pg_cron đang gọi worker nào — `sdfish-outbox-push` hay cả `flush-sdfish-outbox` (G14)?
  - O4: Bật `order_sync` trên prod khi nào — SDFish đã nhận được entity `order` (L5), chỉ chờ CRM bật cờ.

## History
- v1 (2026-11-11): khởi tạo — kiểm kê 15 luồng hai phía, 16 điểm gãy, khung NV0/NV9 cho đồng bộ mới, phase 2 đơn + yêu cầu, chốt mật khẩu một chiều. Đã qua review rubric (Optimizer + Cross-User-Integrity + tích hợp): thêm map trạng thái CRM, nhánh mất sóng, gửi lại gói chết, khách vãng lai, premium tới trước tài khoản, tách rõ việc phía CRM. Chưa code.
- v1.1 (2026-11-12): kéo code mới (`6a02033a`) + fetch CRM (`4db7af48`, không đổi) — 15 luồng, 16 điểm gãy giữ nguyên, G13 vẫn còn (`route.ts:34`, `:60`). Thêm R13 + AC-17 theo luật chữ không lộ nguồn (commit `e456262a`, anh Long 10/11).
- v1.2 (2026-11-12): **vá G13** ở cả `/api/sdvico/order` lẫn `/api/sdvico/request` (cùng lỗi, sửa ở helper chung `contactPhone`) + kiểm dạng `externalRef`. Thêm AC-18 kèm test.
