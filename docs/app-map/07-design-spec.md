# 07 — DESIGN-SPEC: thang user, screen map, budget, trạng thái

> **Load khi**: task chạm UI / screen / component / flow / style. Đây là chốt chặn của pipeline ui-design-logic — sửa UI thì đọc file này TRƯỚC, đổi hành vi/cấu trúc UI thì cập nhật file này CÙNG COMMIT.

```
covers: src/app, src/components
last_verified: 2026-07-28
ttl_days: 90
gate: warn
```
<!-- gate: warn vì UI churn src/app+src/components cao — cảnh báo thay vì chặn. KHÔNG để comment cùng dòng `gate:` (hook tr -d ' ' giữ lại # → phá so khớp = "warn" → chặn nhầm). -->
<!-- re-verified: 2026-07-28b — WEB PUSH (Phase 3): sheet "Tài khoản" (hero-account.tsx) thêm hàng "Bật thông báo" (icon chuông mới BellIcon + nhãn phụ đổi theo trạng thái bật/tắt), nằm giữa khối "Cỡ giao diện" và nút Đăng xuất; TỰ ẨN nếu máy không hỗ trợ Push API hoặc thiếu env VAPID (không hiện nút vô dụng). `/quan-tri` thêm tab **Thông báo**: dải thống kê 3 số (Tổng/Có SĐT/Ẩn danh) + form gửi (2 nút phân đoạn Toàn bộ/Một người, input SĐT khi chọn "Một người", tiêu đề/nội dung/link) + ConfirmDialog trước khi gửi thật (danger=true khi gửi toàn bộ). Không đổi nav/dock.
FIX kiểm thử trực tiếp trong browser (cùng ngày): nút "Bật thông báo" từng có thể kẹt `disabled` vĩnh viễn khi chưa có service worker active (vd dev mode) — `navigator.serviceWorker.ready` không bao giờ resolve. Nay đua với timeout (3s tra trạng thái/8s khi bật) + hiện dòng lỗi đỏ dưới nút khi quyền bị chặn hoặc bật thất bại (trước đây im lặng quay về "tắt"). Không đổi bố cục/nav. -->
<!-- re-verified: 2026-07-28 — /quan-tri thêm 2 tab: **Sản phẩm** (CRUD danh mục product_listings — danh sách + toggle Hiện/Ẩn + form Sửa/Thêm collapsible cùng khuôn "Tạo tài khoản": 2 nút phân đoạn SDVICO/Đơn vị ngoài, input tên/loại/mô tả/tính năng theo dòng/giá/ảnh, thêm SĐT+ghi chú liên hệ khi chọn "Đơn vị ngoài"; ConfirmDialog khi xóa) và **Yêu cầu** (danh sách product_inquiries — chip lọc Mới/Đã liên hệ/Xong/Tất cả, thẻ hiện SĐT/tên/lời nhắn + 2 nút chuyển trạng thái + Xóa qua ConfirmDialog). Tab Sản phẩm /tau khu "Cửa hàng" (sdvico-catalog.tsx): sản phẩm đơn vị ngoài SDWork thêm nhãn tên đơn vị trên thẻ + nút "Gọi {SĐT}" + nút mới "Để lại yêu cầu" (mở BottomSheet form SĐT/tên/lời nhắn, cùng khuôn "Gọi SDVICO") thay cho nút Hỏi mua (giữ nguyên cho hàng SDVICO). Không đổi nav/dock. -->
<!-- re-verified: 2026-07-27c — /quan-tri tab Cảnh báo TV: form "Thêm thuyền viên có vấn đề" bỏ dấu "+" thừa ở tiêu đề collapsible cho khớp khuôn form "Tạo tài khoản". Chỉ đổi CHỮ, không đổi flow/nav/route. -->
<!-- re-verified: 2026-07-27b — ĐỒNG BỘ COPY theo đợt cắt 2026-07-27: trang chủ thẻ 4 đổi "Sổ tiền / Giá cá, ai cần mua, công nợ" → "Giao dịch / Giá cá, tin mua bán, chỗ bán" (khớp nhãn dock + 3 chip /tien); thẻ Bạn thuyền "Hồ sơ, chứng chỉ, bảo hiểm" → "Hồ sơ, giấy tờ, tra cảnh báo"; sub /nguoi thêm "tra cảnh báo trước khi nhận bạn mới" (không ghi CCCD — user chốt); ConfirmDialog xóa tàu bỏ "sổ lãi/lỗ" (feature đã xóa hẳn). Chỉ đổi CHỮ, không đổi flow/nav/route. -->
<!-- re-verified: 2026-07-27 — /quan-tri tab Dữ liệu thêm khối "Cron tự động & bản tính sẵn" (CronsPanel ← /api/admin/crons): 5 dòng trạng thái chấm màu (snapshot cá/thời tiết + 3 collector ngày; storm_events chấm xanh biển trung tính vì chỉ ghi khi có bão). Không đổi flow/nav. -->
<!-- re-verified: 2026-07-26 — /quan-tri form tạo: chọn loại bằng 2 nút phân đoạn (thay select bị bóp nhỏ), checkbox premium hàng riêng — spec màn 8 không đổi hành vi. -->


Doc này authored bằng tay (reverse-engineer từ code 2026-06-11). Không trộn nội dung token (xem [03-design-system.md](03-design-system.md)) hay route map đầy đủ (xem [02-architecture.md](02-architecture.md)).

---

## 1. Người dùng & nhiệm vụ

- **User chính**: chủ tàu / ngư dân Việt 40–60 tuổi, ít rành công nghệ, đọc ngoài nắng, tay ướt. MỘT vai trò (B2C) — KHÔNG có admin/staff/role, nên không có biến thể theo role, chỉ biến thể theo VÒNG ĐỜI đăng nhập.
- **Job hằng ngày**: trước/trong/sau chuyến biển — coi gió sóng + dự báo cá, giữ giấy tờ khỏi quá hạn, nắm giá + đăng tin mua/bán, quản hồ sơ + tra cảnh báo bạn thuyền (CCCD), hỏi/được SDVICO hỗ trợ.
- **Platform**: mobile-first tuyệt đối (cột ≤480px, dock nổi). Desktop = cùng cột mobile căn giữa, KHÔNG có layout desktop riêng.
- **Brand**: SDVICO (commissioned). ForFish là kênh CSKH + giá trị vượt trội cho bà con.

## 2. Thang người dùng (3 câu cho từng bậc)

| Bậc | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| **Public / chưa đăng nhập** | Dùng được NGAY: giá cá, bản đồ gió sóng, sổ tay (localStorage) | "App này lo được việc của bà con, không cần đăng ký mới xài" | 1 lời mời đăng nhập bằng SĐT — KHÔNG chặn cửa |
| **Đã đăng nhập, chưa khớp đơn SDVICO** (`unlinked`) | Đồ tự ghi + lời mời "mua hàng là đồ tự hiện" | "Tài khoản đã sẵn, mua hàng SDVICO là nối luôn" | Gọi SDVICO tư vấn / mua |
| **Khách SDVICO đã đồng bộ** (`ok`) | Đồ đã mua, bảo hành sắp hết, dịch vụ, **nợ/cước** | "Mọi thứ bà con mua đều theo dõi giúp" | Gọi bảo hành/đóng cước, mua thêm vật tư |

**Quy tắc đã áp dụng:**
- Tối đa **1 nudge đăng nhập/màn**: chip hero "Đăng nhập", thẻ khoá premium (`PremiumLock`), nút "Đăng nhập để đăng tin" ở Tin mua/bán. KHÔNG spam.
- **Phân hạng PREMIUM (2026-07-26 — THAY teaser 06-11)**: tính năng KHOÁ HẲN gồm **dự báo cá** (cả heatmap — không còn teaser) và **dự báo thời tiết quá 3 ngày** (ngày 4–16 ở "Những ngày tới" + khung 5/7/10/16 ngày trên bản đồ). Thang khoá 4 nấc (`lib/tier.ts` `FeatureAccess`): `checking` = chỉ hiện phần miễn phí, KHÔNG hiện thẻ khoá (chống nháy khoá↔mở) · `login` = thẻ khoá mời **Đăng nhập** · `upgrade` = thẻ khoá **"Gọi SDVICO 1900 23 23 49"** (hạng thường không tự nâng cấp trong app được) · `open` = premium/demo, hiện đủ. Component `premium-gate.tsx` (`PremiumLock`, có bản `compact` cho panel hẹp); nút khung ngày bị khoá vẫn HIỆN (kèm icon khoá, chạm ra một dòng mời) — biết có gì để mà muốn. **Nhu cầu mua cá** giữ gate đăng nhập cũ (`LoginGate`).
- Lỗi đồng bộ KHÔNG được hiện thành "đăng nhập đi" với người đã đăng nhập — `useSdvicoAssets` phân biệt `guest/unlinked/error/ok` (nấc `error` có nút Thử lại).

## 3. Object model

| Object | List | Detail | Form | Màn sinh ra |
|---|---|---|---|---|
| ~~Chuyến biển (lãi/lỗ, báo cáo năm, tính chuyến)~~ | — | — | — | **XÓA HẲN 2026-07-27** (user chốt — bỏ sổ lãi/lỗ, báo cáo năm, tính chuyến, chia tiền, hồ sơ chuyến PDF) |
| Tin mua/bán | list (tin bán + tin mua) | — | bottom-sheet (đăng tin ≤8 field) | /tien mục Tin mua/bán (`market-board.tsx`) |
| Bạn thuyền | sổ thuyền viên | báo cáo CCCD/SĐT (sheet, premium) | drawer (tra cảnh báo INLINE khi gõ CCCD hoặc SĐT) | /nguoi |
| Giấy tờ tàu | list | — | drawer | /tau tab Giấy tờ |
| Sản phẩm/Dịch vụ SDVICO | list (sync read-only + tự ghi) | — | drawer (đồ tự ghi) | /tau tab Sản phẩm/Dịch vụ |
| Điểm ngư trường / của tôi | map + sheet | peek sheet | sheet | /ngu-truong |
| Giá cá | list | — | — | /tien mục Giá cá |
| ~~Mức phạt~~ | ~~searchable list~~ | — | — | **gỡ khỏi /tau 2026-07-27 (user: không cần); giữ `fines-lookup.tsx` + `data/fines.ts`** |
| ~~Công nợ (chủ nợ)~~ | — | — | — | **XÓA HẲN 2026-07-27** (user chốt — bỏ sổ công nợ) |

→ 8 object. Tạo/sửa đa số ≤5 field nên dùng **drawer/bottom-sheet**, KHÔNG đẻ page riêng (quyết định đã chốt); form đăng tin mua/bán ≤8 field vẫn ở bottom-sheet.

## 4. Nav model

- **Mobile bottom dock (5)**: Trang chủ · Ra khơi · **Tàu cá** · Bạn thuyền · **Giao dịch** (dock đổi nhãn "Tiền"→"Giao dịch" 2026-07-27; "Tàu"→"Tàu cá" 2026-07-28 cho ĐỦ KHUÔN 2 chữ/nhãn — 03 "Nhãn ngang hàng") — đúng trần M3 = 5, taxonomy MECE theo đối tượng. Item ≥3.75rem, icon + chữ.
- **Tab trong page**: /tau = 3 tab (Giấy tờ/Dịch vụ/Sản phẩm) — **bỏ tab Mức phạt + Checklist xuất bến 2026-07-27 (user: không cần, chủ tàu tự biết)**; **/tien KHÔNG còn Tabs** (bỏ Hiệu quả/Công nợ 2026-07-27) — render thẳng `trade-hub.tsx` với 3 chip level-1 (Giá cá/Tin mua/bán/Bán ở đâu). Trong chip dùng `ChipRow` (≤3 tier). KHÔNG tab lồng tab. Thanh tab **dính (sticky top-0)** có padding-top `+env(safe-area-inset-top)` → khi hero cuộn mất, thanh không chui dưới notch/status bar (edge-to-edge).
- Route phụ (`/cang`, `/login`, `/dang-ky`, `/doi-mat-khau`) vào từ ngữ cảnh, không nằm trên dock. Route cũ (`/gia-ca`, `/giay-to`, `/van-hanh`, `/thuyen-vien`) = redirect 1 dòng sang trục mới.

## 5. Screen map + density budget

| # | Màn | Vào từ | User đến để | Step tiếp mong muốn | Primary | Density |
|---|---|---|---|---|---|---|
| 1 | Trang chủ `/` | dock, login | Coi việc cần làm ngay trong 5 giây | chạm việc khẩn / 1 trong 4 trục | (không — màn điều hướng) | M |
| 2 | Ra khơi `/ngu-truong` | dock | Coi gió sóng + dự báo cá chỗ định đi | dẫn đường / ghim điểm | "Dẫn đường tới chỗ này" | H (map ≥60%) |
| 3 | Tàu `/tau` | dock, nhắc `?tab=` | Coi **đủ điều kiện xuất bến chưa** (đèn xanh-đỏ + **mốc khai báo eCDT/NKKT** đầu tab Giấy tờ) + giữ giấy tờ + đồ SDVICO | xử việc đỏ (thiếu giấy/quá hạn/nợ) | theo tab | M |
| 4 | Bạn thuyền `/nguoi` | dock | Quản hồ sơ (CCCD/giấy tờ) + tra cảnh báo trước khi thuê | thêm bạn / tra + báo cáo CCCD | "Thêm bạn thuyền" | M |
| 5 | Giao dịch `/tien` | dock | Bán có lợi: nắm giá + đăng tin mua/bán | đăng tin bán/mua · gọi đầu mối | "Đăng tin mua/bán" | M |
| 6 | Cảng `/cang` | nút trên map | Tìm cảng chỉ định gần | gọi/chỉ đường | (đọc) | M |
| 7 | Đăng nhập `/login` | chip hero, gate | Vào bằng **SĐT + mật khẩu** (sale báo khi mua; KHÔNG email/OTP) | (vào app) | "Đăng nhập" | L |
| 8 | Quản trị `/quan-tri` | gõ URL trực tiếp (STAFF: admin env `ADMIN_PHONES` — đủ 3 tab; **quản lý** `role='manager'` — CHỈ tab Tài khoản với nút Kích hoạt/Gia hạn; không trên dock, không link trong app) | Admin theo dõi hệ thống; quản lý (đại lý) cấp premium cho khách | tìm khách → **Kích hoạt premium / Gia hạn +1 năm** (dialog ghi rõ hạn mới + "ghi log dưới tên bạn") / admin: tạo (khách/quản lý) / hạ hạng / xoá — đều dialog xác nhận | theo tab | M — **web độc lập về giao diện** (app-shell thoát khung mobile + dock), responsive PC/tablet/mobile; thống kê 4 ô + bảng "Premium theo người cấp" (quản lý thấy dòng mình, admin thấy hết); hành động phá huỷ BẮT BUỘC dialog; STAFF nên không áp chuẩn chữ-to của ngư dân |

Mobile M = ≤3 khối/viewport. Home: dải khẩn + lưới 4 trục + tagline = đạt. /tien, /tau, /nguoi: 1 hàng chip/tab + list — đạt.

## 6. Ma trận trạng thái (đã hiện thực)

| Màn | Chưa login | Trống | Lỗi/mạng yếu | Đang tải |
|---|---|---|---|---|
| Ra khơi | dự báo cá KHOÁ (thẻ `PremiumLock` mời đăng nhập; đã đăng nhập hạng thường → mời gọi SDVICO); gió sóng ≤3 ngày public | điểm: "chạm biển để xem" | scalar/lưới/cá: nút **Thử lại** (không hỏng câm; **bị khoá ≠ lỗi** — không hiện Thử lại khi 401/403) | "Đang lấy dự báo…" |
| Tàu | tab Sản phẩm/Dịch vụ: `guest` mời đăng nhập | "Chưa có … bấm nút cam" | `error` → Thử lại; `unlinked` → giải thích | "Đang kiểm tra đồ SDVICO…" |
| Bạn thuyền | public; sổ MẪU tự xưng "sổ mẫu"; tra cảnh báo (inline khi gõ CCCD) + báo cáo: hạng thường/chưa login → hint nâng cấp / `PremiumLock`; demo mode → "cần máy chủ thật" | empty + nút cam | tra INLINE khi gõ đủ 12 số (✓ xanh / cảnh báo đỏ) | hydrate sau mount |
| Đăng nhập | — | — | "Sai số điện thoại hoặc mật khẩu" | nút "Đang vào…" |

## 7. Action → Expectation (đã hiện thực)

| Hành động | Thấy ngay sau đó |
|---|---|
| Đăng tin mua/bán (đã đăng nhập) | tin hiện ngay trên chợ; tin của mình có nút Đóng/Xóa; chưa đăng nhập thì nút → /login |
| Gõ CCCD (12 số) hoặc SĐT trong form (premium) | tra tự động (debounce) NGAY dưới ô: ✓ xanh "không có cảnh báo" / hộp đỏ liệt kê cảnh báo đã duyệt. Định danh = 1 trong 2 (CCCD/SĐT), chống trùng CCCD trong sổ |
| Bấm "Cảnh báo" trên thẻ bạn thuyền (premium) | mở sheet Báo cáo: hiện cảnh báo cũ (bối cảnh) + form chọn loại vấn đề + kể rõ → gửi → `pending` chờ SDVICO duyệt ở /quan-tri |
| Gửi báo cáo thuyền viên | "Đã gửi — SDVICO kiểm duyệt trước khi hiện cho chủ tàu khác" |
| Xóa điểm ghim / tin mua-bán / sản phẩm | xác nhận inline / ConfirmDialog (KHÔNG xóa 1 chạm) |
| Gạch nợ ứng | ConfirmDialog nêu rõ số tiền |
| Gửi yêu cầu SDVICO | "Đã gửi" + mục "Yêu cầu đã gửi" hiện ngay (optimistic) |
| Đổi điểm xem trên map khi đang có tuyến | tuyến CŨ giữ nguyên + dải nhắc "tới chỗ chạm trước" + Xóa tuyến |
| Đổi tàu (chip BoatSwitcher) | mọi màn đang mở đổi theo tàu đó NGAY, không reload (ba-spec [08](08-ba-spec-da-tau.md) AC-4) |
| Xóa tàu (form Sửa tàu → Xóa tàu này) | ConfirmDialog nêu rõ; giấy tờ/bảo dưỡng của tàu bị xóa, thuyền viên + đồ SDVICO giữ; nhảy sang tàu còn lại. Còn 1 tàu → KHÔNG hiện nút xóa (08 R7) |

## 8. Quyết định đã chốt (không hỏi lại)

- Tạo/sửa mọi object → **drawer/bottom-sheet**, không page riêng. Sheet + ConfirmDialog **PORTAL ra `document.body`** (`createPortal`) → thoát stacking context của tổ tiên (vd wrapper `relative z-10` của BoatSwitcher nhốt sheet z-30 xuống lớp z-10 khiến bottom-nav z-20 đè che nút Lưu/Hủy). Sheet: `max-h-92dvh` cuộn trong, `pb` safe-area; viewport `interactiveWidget: resizes-content` → bàn phím CO layout (không đè) nên nút đáy luôn với tới. Khóa cuộn nền **đếm tham chiếu** (mở sheet-trong-sheet không nhả khóa sớm → nền không trôi sau lưng).
- Cỡ giao diện mặc định **"Gọn"** (user chốt 2026-07-28 — kể cả chưa đăng nhập/màn login); chỉnh tay ("Chữ to"/"Gọn") trong **sheet tài khoản**, bấm lại lựa chọn đang chọn = về theo máy (auto); không bày toggle ra hero.
- Ngôn ngữ status DUY NHẤT = `StatusBanner`; màu cam-đỏ ĐỘC QUYỀN cho ranh giới biển trên map.
- Demo/sổ mẫu KHÔNG ghi xuống máy, KHÔNG lọt vào dải nhắc khẩn.
- Visual "international" (font Plus Jakarta Sans + Archivo) nhưng COPY tiếng Việt đời thường.

## 9. Trạng thái audit ui-design-logic (2026-06-11)

- **Contrast AA**: đã quét computed-style 6 màn (home, /ngu-truong, /tau, /nguoi, /tien, /login, /cang) → **0 lỗi <4.5:1**. Sàn neutral text = `/65`; accent text/fill kiểm cả 2 chiều (t3 đậm về `#8f6010`).
- **`tabular-nums`**: đã phủ MỌI cột/figure số: giá cá, tin mua/bán (giá tự do), thẻ tổng quan bạn thuyền (2 ô), CCCD (thẻ + tra), cột điểm + sóng/gió `sea-forecast`.
- ~~Tên trục ở Home ("Tàu của tôi", "Sổ tiền") khác nhãn dock ("Tàu", "Tiền") — cố ý (dock cần ngắn), giữ nguyên.~~ **HẾT HIỆU LỰC 2026-07-28**: quy định "Nhãn ngang hàng" (03) + user chốt MỘT TÊN xuyên suốt — nay dock = thẻ Home = H1 /tau = **"Tàu cá"** (Giao dịch đã về một mối từ 2026-07-27).
- Lint `set-state-in-effect`: pattern hydrate-on-mount cố ý → rule đã tắt có chủ đích (commit 76acf4f).
- **Safe-area đa thiết bị (2026-06-18)**: mọi phần neo mép màn né tai thỏ + home-indicator iOS + thanh gesture/nút-dưới Android. TOP: PageHeader + map-overlay + sticky Tabs/dossier dùng `env(safe-area-inset-top)`. BOTTOM: `<main pb=calc(8rem+env(sab))>`, bottom-nav/bottom-sheet/snap-sheet dùng `env(safe-area-inset-bottom)` (body KHÔNG pad đáy — tránh cộng đôi). Overlay (sheet/dialog) **portal ra body** nên không bị stacking context của cha che. Render 320/360/landscape: 0 tràn ngang, form cuộn được, nút không bị ẩn. Mục tiêu: không đè nút, không mất form, không tràn.

## 10. Triage ui-ux-triage (2026-06-15) — full sweep 4 trục

Sweep mobile-first (375×812) cả 7 màn + redirect. Oracle = file này. Kết quả: Home / Ra khơi / Bạn thuyền / Tiền sạch (1 primary/màn, tabular-nums đủ, tap target ≥44, không overflow); 4 route cũ redirect OK.

**Đã sửa (P1 — vi phạm §8 "demo KHÔNG ghi xuống máy"):** `document-vault`, `maintenance-reminders`, `boat-products` trước đây seed demo rồi `useEffect` save **vô điều kiện** → demo bị ghi xuống localStorage → `urgent-strip` (vốn cố ý seed `[]`) đọc lại tưởng việc thật → **báo đỏ giả trên Home** (đúng thứ comment urgent-strip dòng 158 muốn tránh). Fix: mirror `crew-list` (cờ `isDemo` + save gated `!isDemo` + thêm/sửa thật đầu tiên thì demo nhường chỗ). Verify preview: demo vẫn hiện trên màn, localStorage rỗng, Home calm; add thật → persist + demo wiped.

**Đã sửa (TEXT — §3 "title cùng cấp cùng ngữ pháp"):** H1 dock-sibling lệch ngữ pháp ("Quản lý con tàu" động từ vs "Sổ thuyền viên"/"Tiền nong của tàu" danh từ) → đổi `/tau` title → **"Tàu của tôi"** (danh từ, khớp tên trục ở Home); kicker đổi "Tàu của tôi"→**"Quản lý tàu"** để eyebrow ≠ title (user chốt wording 2026-06-15).

**Note (chưa sửa — scope decision):** app không có dark mode (0 `prefers-color-scheme` rule). §8 không liệt dark mode là quyết định, app dùng "ngoài nắng" → không phải defect vs oracle; nếu muốn hỗ trợ → việc của BA/ui-design-logic, không phải triage. Handle `Mở rộng bảng thông tin` trên /ngu-truong cao 18px (<44) nhưng có affordance thay thế "Xem thêm" → P2 chấp nhận.

## 11. Ra khơi REDESIGN — Phương án A (target build, 2026-06-16)

> **Nguồn thiết kế chính: [design-review/07-ra-khoi-A-design.md](../design-review/07-ra-khoi-A-design.md)** (design doc đầy đủ user duyệt). Diệt "phản khoa học" ở [05](../design-review/05-ra-khoi-current-state.md). Data: [06](../design-review/06-ra-khoi-data-inventory.md).

**Delta so với bản trích đầu (theo design doc đầy đủ) — build phải theo:**
- **Màu cá = hồng tím `oklch(0.64 0.19 350)`** (hiện app xanh lá → ĐỔI). Font **Be Vietnam Pro**. Primary xanh `oklch(0.52 0.13 235)`.
- **Thanh dự báo NGANG ở đáy** (không nằm trong sheet): Gió&sóng = tab mặc định luôn có; bật lớp → thêm tab; **click ngày → cả bản đồ đổi theo ngày** + badge "Bản đồ: [ngày]".
- **Bỏ toggle "Tàu tôi" (GPS)** — increment 1 đang còn, sẽ gỡ. **Bỏ OceanByte**.
- Điểm đã lưu: thêm **"Thêm điểm theo toạ độ"** (tên + vĩ độ + kinh độ).
- ⚠️ **Khả thi**: thang kéo trên lớp NỀN (depth/SST/mồi = raster tile) KHÔNG lọc-giá-trị-thật client được (chỉ dải % cá GeoJSON lọc thật). "Bản đồ đổi theo ngày" chỉ áp lớp có data-theo-ngày (gió/sóng/cá/bão); ảnh vệ tinh nền trễ ~2 ngày, không có ngày tương lai. Xem [design-review/07 §7](../design-review/07-ra-khoi-A-design.md).

**NGUYÊN TẮC GỐC (bất biến khi build):**
1. **Bản đồ luôn SẠCH** — chỉ data lớp + marker, không nhồi control.
2. **TRÁI = điều khiển LỚP** (data nào HIỆN trên bản đồ): bật/tắt, kéo dải, chọn loài. KHÔNG chứa số liệu từng điểm.
3. **SHEET ĐÁY = số liệu theo ĐIỂM CHẠM** (gió/sóng/%cá/dẫn đường tại nơi chạm). 3 nấc: xem nhanh → nửa → đầy đủ.
4. **Hai việc TÁCH BẠCH, KHÔNG TRÙNG** — bỏ legend-bấm-mở-Lớp trùng + cụm 3 nút rải phải + chip cá nổi giữa map.
5. **Bão TỰ NỔI, ưu tiên cao nhất** — banner đỏ trên cùng bất kể đang xem lớp gì.

**RAIL PHẢI — thanh điều khiển = 6 nút (mỗi nút mở 1 panel). MẶC ĐỊNH THU GỌN (user 2026-07-28)**: chỉ hiện nút "Lớp" + "Vị trí"; chạm "Lớp" mới xổ rail; xổ rồi mà **5s không thao tác** (chạm/gõ trong rail hoặc panel) thì TỰ thu lại (đóng cả panel đang mở). Thanh giờ Windy dưới đáy cùng luật: mặc định thu 1 dòng "chạm để chọn giờ", xổ ra 5s không thao tác tự thu — trừ khi đang chạy ▶ (đang coi thì không giật khỏi tay).
| Nhóm | Panel chứa |
|---|---|
| **Hải đồ** | Lớp nền bản đồ (chọn-1: Hải đồ độ sâu / Nước nóng-lạnh / Nhiều mồi / Ảnh mây) + nhịp + nhãn dải + note "ảnh vệ tinh trễ ~2 ngày · phao chỉ hiện khi zoom gần bờ" |
| **Ngư trường** | Dự báo cá PFZ (bật/tắt) + nhịp · **chọn loài** (dropdown XỔ INLINE trong panel — không swap view/đổi bề rộng panel, user 2026-07-27: đừng nhảy panel giật ra giật vô) · note "public, chi tiết cần đăng nhập" — chưa đăng nhập thì ẩn picker, chỉ 1 CTA đăng nhập. **Hiển thị = LƯỚI Ô** (thay heatmap mềm cũ, 2026-07-27): mỗi ô SST (~0,25°) là ô vuông tô theo **3 MỨC CỐ ĐỊNH** kiểu bản tin ngư trường Viện Hải sản — **Thấp** (xanh lá, 40–60) · **Trung bình** (vàng, 60–75) · **Cao** (đỏ, 75–100), quy ước màu `FISH_LEVEL_BANDS` **KHÔNG đổi theo loài** (đỡ rối); viền ô trắng mảnh; **CHỈ MÀU, không in số** (user 2026-07-27: zoom lên chỉ cần màu). Sàn hiển thị cố định = `FISH_LEVEL_BANDS[0].min` (40) — **đã BỎ dải lọc kéo-2-đầu** (user 2026-07-27: không cần), luôn hiện đủ 3 mức. Chọn loài chỉ đổi mức (điểm `sp[loài]`), màu vẫn 3 mức. **KHÔNG hiện sản lượng (kg)** — nguồn chỉ có điểm khả năng 0–100, in kg là hứa sai. Chú giải Thấp/TB/Cao **CHỈ nổi sát mép trái bản đồ** khi lớp Cá bật (gate `fishGridGeo`, tự mờ khi kéo sheet lên như rail) — **đã BỎ khỏi panel** cho đỡ lặp (user 2026-07-27). **Lớp màu cá THUỘC nút lớp "Cá" ở rail** (`fishGridGeo` cần `fishOn` + `fishCast`, khoá premium khi `fishCast`=null) — KHÁC hẳn lưới kẻ ô toạ độ ở Cài đặt (2026-07-27: user chốt toggle Cài đặt là lưới grid toạ độ, KHÔNG liên quan cá) |
| **Thời tiết** | Lớp gió/sóng + scalar (nước dâng/xoáy) + nhịp · note "tham khảo, lỗi thì thử lại" |
| **Điểm đã lưu** | Bật/tắt hiện điểm trên map + quản lý điểm (thêm theo toạ độ, sửa/xoá, tìm cảng) ngay trong panel |
| **Công cụ** | **Đo khoảng cách 2 điểm** — bật chế độ đo, chạm 2 điểm trên map → đường nối + mốc 1/2 + kết quả (khoảng cách đường chim bay + hướng) theo đơn vị đang chọn; "Xoá, đo lại" |
| **Cài đặt** | **Đơn vị khoảng cách** (Hải lý/km) + **Hệ toạ độ** (độ thập phân / độ-phút) — đổi thì MỌI chỗ (peek toạ độ, whereLine, điểm cá gần, dẫn đường, công cụ đo) đổi theo. **Lớp bản đồ**: toggle **Lưới kẻ ô (toạ độ)** — `prefs.mapGrid` (mặc định bật): graticule kinh/vĩ tuyến 1° (`MAP_GRID_BOUNDS` [102,119,4,24]) + nhãn độ, KHÔNG liên quan dự báo cá — + Ranh giới vùng lộng. Store dùng chung `lib/map-prefs.ts` (localStorage `forfish.mapPrefs.v1`) |

**TRÊN:** banner bão (đỏ, ưu tiên) + **dải dự báo gió/sóng 1–16 ngày** (chip ngày cuộn ngang, `FORECAST_MAX_DAYS=16`; sóng từ `ncep_gfswave025`). Dưới dải: **dòng độ tin theo tầm ngày** (`forecastConfidence(daysAhead, skillConf)` — `daysAhead` đếm từ NGÀY THẬT tới ngày đang xem, KHÔNG theo vị trí trong mảng) — hạ nhãn khi backtest (`forecast-skill.json`) đo được sai số lớn ở tầm ngày đó; KHÔNG để mọi ngày trông chắc như nhau.
**ĐÁY — sheet số liệu điểm (3 nấc):**
- "Đang hiển thị trên bản đồ" — danh sách lớp đang bật (name · val · tag) — đổi theo nút trái.
- "SỐ LIỆU tại điểm bạn chạm" — Điểm đã chọn (toạ độ + cách cảng) · Sóng · Gió · tình trạng biển + "tham khảo" · cảnh báo ranh giới · **chi tiết bão** (cách điểm, cấp, sức gió, giật) · dẫn đường.

**GIỮ NGUYÊN (từ 05 §8, 06 §7):** mọi tính năng + data + ma trận trạng thái + quy tắc an toàn + ràng buộc (font ≥18, tap ≥44-56, map ≥60%, cam-đỏ độc quyền ranh giới, lazy-load MapLibre, nguồn dữ liệu). Chừa chỗ data dự kiến (06 §6).

> **Build status**: chốt spec 2026-06-16. Hiện thực dần (rail → gom panel → sheet số liệu điểm), verify từng bước trên dev (map screenshot QA cần mắt user).

**Delta hiện thực 2026-06-23 (theo feedback user trên dev):**
- **Rail panel = khung CÂN ĐỐI** `w-[16.5rem]` (max `calc(100vw-5rem)`) — không full-width (user: full = "chiếm hết màn hình"), không hẹp (1 chữ/dòng). Nhãn lớp rút gọn: "Gió (Windy)" / "Sóng (Windy)" / "Nước dâng/xoáy" để 1 hàng không rớt dòng.
- **Sheet đáy VUỐT** lên/xuống đổi nấc (peek↔half↔full) thay 2 nút "Xem thêm"/"Thu gọn" (đã bỏ); chạm mép = nở 1 nấc; chỉ giữ nút "Về cảng nhà". (`ui/snap-sheet.tsx`)
- **Banner bão (overlay) THU/MỞ** được: mặc định mở (an toàn), thu thành 1 chip đỏ/vàng "N tin bão — chạm xem" để không chiếm view. (`storm-banner.tsx`)
- **Số liệu sóng/gió LIỀN MẠCH**: thẻ "Gió/Sóng lúc này" dời lên ngay dưới dải ngày + "cả ngày" (trước nằm sau khối cá/trăng/dẫn đường → user: "trên dưới cách cả 1 khúc").
- **Điểm đã lưu: bỏ hàng "Chỗ tàu tôi đang đứng" (GPS)** — user: vô nghĩa (không còn entry-point GPS). Giữ "Thêm điểm theo toạ độ".
- **BottomSheet (modal) cap `max-h-[85dvh]`** (trước 92) — đọc như sheet cân đối, còn thấy map sau lưng.
- **"Chọn loài cá" + "Điểm đã lưu" = PANEL RAIL, không bottom-sheet modal** (user: 2 popup này "ko đồng bộ các kiểu popup trước" → cho khớp panel rail): 
  · Chọn loài = **dropdown XỔ INLINE** trong panel **Ngư trường** (nút loài → list `FishSpeciesContent` 1 cột xổ ngay dưới, chevron xoay 90°; chọn xong tự thu). KHÔNG swap view / KHÔNG đổi bề rộng panel (bỏ `speciesView` + panel width 22rem cho ngư-trường). Khi MỞ: nút trigger đổi nhãn "Chọn loài cá" + ẩn chấm (khỏi TRÙNG item "Mọi loài" trong list). List dùng **CHUNG thanh cuộn của panel** (`max-h-[62vh] overflow-y-auto`) — KHÔNG bọc khung cuộn riêng → chỉ **1 thanh scroll**, tránh 2 thanh lồng nhau (user 2026-07-27). 
  · Quản lý điểm = nội dung panel **Điểm đã lưu** luôn (toggle hiện-trên-map + thêm theo toạ độ + sửa/xoá compact + tìm cảng) — bỏ nút "Quản lý" mở modal. 
  · Tách thân `FishSpeciesContent` / `MyPlacesContent` dùng chung (panel + wrapper bottom-sheet legacy). Nút "Sửa" ở thẻ "Đã ghim" trong sheet → đổi thành chỉ dẫn "Sửa ở Điểm đã lưu".

**Delta dẫn đường 2026-07-26 (team review 5 lăng kính + verify chéo — thẻ kết quả `route-planner.tsx`):**
- Thêm 2 trạng thái cảnh báo: **RẤT CẠN** (đỏ — tuyến đè vùng <4 m/bãi nổi gần nơi xuất phát/điểm đến, trước đây đi qua im lặng) và **QUÁ CỬA SỔ DỰ BÁO** (vàng — chuyến dài hơn dự báo đang có, N giờ cuối tính bằng dự báo giờ cuối, `plan.beyondForecastH`). Không được để phần đuôi tuyến "êm giả".
- Copy chốt kết quả nói THẬT giới hạn: "bản đồ độ sâu ô ~5,5 km — né bờ và bãi cạn lớn; rạn nhỏ hơn ô lưới, đá ngầm lẻ máy KHÔNG thấy" (bỏ câu "đã né bờ, rạn, bãi cạn sát mặt" — hứa quá khả năng lưới ETOPO 0,05°).
- Còn treo (chưa làm, cần chốt scope): tuyến CHƯA đối chiếu tin bão `/api/storms` — hành lang bão 24–72h có thể lọt dưới ngưỡng sóng/gió số; và Dijkstra vẫn chạy main-thread (chưa Web Worker).

### 10.1 Mất sóng ngoài khơi — SỐ CŨ KHÔNG ĐƯỢC TRÔNG NHƯ SỐ MỚI (2026-07-25i)

Chuyến biển 5–16 ngày, máy mất sóng gần hết chuyến. Nguyên tắc: **thà không có số còn hơn số sai chỗ / sai ngày**. Chữ UI dùng lời đời thường ("số cũ lưu trong máy", "máy không có sóng"), KHÔNG dùng cache / đồng bộ / offline / stale.

**A. Tin bão — BA trạng thái tách bạch** (`lib/storms.ts` → `stormStatus`, dùng ở `storm-banner.tsx` + panel Thời tiết + Marker tâm bão)

| Trạng thái | Điều kiện | Hiển thị |
|---|---|---|
| Đang hỏi | chưa có trả lời | banner không render; panel "Đang hỏi tin bão…" |
| **Chưa hỏi được** | nguồn lỗi / mất sóng / `checkedAt` hỏng / **tin cũ hơn 12 h** (`STORM_MAX_AGE_MS`) | **nền VÀNG + icon cảnh báo**: "Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải / Icom." — **CẤM** nói "không có bão" |

> ⚠️ **PHẢI THỬ LẠI — an toàn tính mạng** (sửa 2026-07-26, user báo: "đang có bão mà [hiện] Chưa hỏi được tin bão"). TRƯỚC: cả `fishing-map-view` lẫn `storm-banner` gọi `fetchStormCheck()` trong `useEffect(..., [])` ⇒ hỏi ĐÚNG MỘT LẦN lúc mở trang, KHÔNG BAO GIỜ thử lại. Mở app lúc mất sóng (ngoài biển sóng chập chờn là chuyện thường; ở đây tái hiện được ngay khi route đang biên dịch) ⇒ `{ok:false}` ⇒ màn hình **kẹt ở "Chưa hỏi được" VĨNH VIỄN** kể cả khi sóng đã về, tới khi bà con tự tải lại trang. Bão đang vào mà app không hỏi lại = chết người. NAY dùng chung `lib/use-storm-check.ts` (`useStormCheck`): hỏi lại khi **(a)** có sóng trở lại (`online`), **(b)** mở lại app (`visibilitychange`) nếu tin đã cũ, **(c)** định kỳ `STORM_REFRESH_MS` 30 phút (khớp cache route), **(d)** NHANH hơn — `STORM_RETRY_MS` 60 s — khi lần trước hỏng. Mọi nơi hiển thị bão PHẢI dùng hook này, KHÔNG gọi `fetchStormCheck` trực tiếp trong component. Đã kiểm chạy thật trên trình duyệt: chặn `/api/storms` → hiện "Chưa hỏi được"; trả lại + bắn `online` → **"Bão mạnh NOUL" tự hiện lại, KHÔNG cần tải lại trang**.
| Không có bão | hỏi được thật, danh sách rỗng, tin ≤ 12 h | nền xanh: "Không có tin bão trên Biển Đông (hỏi lúc HH:MM ngày D/M)." |
| Có bão | danh sách khác rỗng (kể cả tin cũ — thà báo thừa) | thẻ đỏ/vàng như cũ + dòng **"Tin lúc HH:MM ngày D/M"**; tin > 12 h thì dòng này màu warn + "tin cũ trong máy, nghe lại đài duyên hải". Marker tâm bão trên map cũng mang nhãn giờ này. |

Vì sao có ngưỡng 12 h: Service Worker cache `/api/*` network-first → mất sóng vẫn trả bản `/api/storms` cũ với `ok:true`. Mảng bão rỗng KHÔNG được dùng chung cho "không có bão" và "chưa hỏi được".

**B. Nhãn ngày — so NGÀY THẬT, không so vị trí mảng** (`lib/day-labels.ts`)

- "Hôm nay" / "Ngày mai" chỉ hiện khi `isoDate` khớp ngày thật (giờ VN +07). Ngày đã qua → hiện thứ + ngày + "(đã qua)"; chip ngày đó **mờ 40% + disabled**, ngày chọn tự nhảy sang ngày đầu còn dùng được.
- Bản lưu mà **qua ngày hết** → sheet peek: "Số lưu trong máy ở chỗ này đã qua ngày hết (lưu HH:MM ngày D/M). Có sóng lại máy sẽ tự lấy số mới." — không hiện dải ngày/số nào.
- Thanh giờ Windy: mốc "Hôm nay" so ngày thật (trước so ngày đầu của chính bản lưu).

**C. Số "lúc này" và chỉ báo bản lưu**

- Khối "Gió/Sóng lúc này" chỉ hiện khi ngày đang xem = hôm nay. Nếu đang xem **bản lưu**, tiêu đề đổi thành **"Gió đo lúc HH:MM ngày D/M"** / "Sóng đo lúc …" (số `current` đông cứng từ lúc lưu).
- Chỉ báo bản lưu nâng 13px → **17px đậm, nền warn**: "Số cũ lưu trong máy — lưu lúc HH:MM ngày D/M (lưu N giờ trước). Chưa phải số mới."
- Thanh giờ Windy khi mất sóng: "Số cũ lưu trong máy — lưu lúc HH:MM ngày D/M" (thay "· bản lưu (offline)").

**D. Chạm điểm lạ khi mất sóng — KHÔNG mượn số chỗ khác** (`lib/marine-weather.ts`)

Bỏ fallback "bản lưu mới nhất của bất kỳ toạ độ nào". Chỉ dùng bản lưu **đúng ô lưới ~0,25°** của chỗ vừa chạm. Không có → **thử tiếp LƯỚI đã lưu** (§10.4); lưới cũng không phủ → peek: "Chỗ này chưa có số nào lưu trong máy — vuốt lên để thử lại."; mở sheet có thêm "Lúc mất sóng, máy chỉ có số ở những chỗ bà con đã mở xem lúc còn sóng. Chạm lại đúng chỗ đó để coi." + nút Thử lại.

**E. Độ tin theo tầm ngày THẬT** — `assessForecast` / `applyBiasCorrection` / `forecastConfidence` nhận `todayIso`; lead = số ngày từ hôm nay tới ngày dự báo (`leadOf`), không phải chỉ số mảng. Bản lưu cũ vì thế bị hạ độ tin đúng mức thay vì được nắn bias theo hàng lead 1 (sai theo hướng lạc quan).

**F. Đồng hồ màn hình** — `fishing-map-view` + `storm-banner` giữ `nowMs` nhích 5 phút/lần: app mở suốt chuyến thì "Hôm nay" và tuổi tin bão vẫn tự trôi.

### 10.2 Tải sẵn dự báo — TỰ ĐỘNG, không nút, không chữ thường trực (2026-07-25n)

Cùng mạch §10.1, ba việc: (A) màn hình phải GỌN — bỏ hẳn chữ nói tuổi lớp cá, (B) tải sẵn 16 ngày offline không bắt bà con bấm nút, (C) lưới gió/sóng không được đưa khung ngày khác.

> **Sửa lớn 2026-07-25n** (chủ dự án xem app thật): hai đợt trước thêm quá nhiều chữ NẰM LÌ trên bản đồ → rối. Quyết định sản phẩm: **bỏ badge tuổi lớp cá ở mọi chỗ** và **bỏ nút "Chuẩn bị đi biển" + 2 khối chữ đi kèm**, thay bằng tự tải + một dòng báo tự tắt.

**A. TUỔI LỚP CÁ — KHÔNG hiển thị ở đâu cả** (bỏ `lib/fish-age.ts`)

Đã gỡ sạch ba chỗ từng hiện tuổi: badge "Bản đồ cá — Ảnh ngày D/M (2 ngày trước) · lấy về HH:MM" trên map (cả biến thể nền vàng "Bản đồ cá CŨ"), khối warn trong panel **Ngư trường**, và đuôi "— Ảnh ngày … · lấy về …" trong thẻ cá ở sheet (nay chỉ còn **"Nước 28°C · mồi dày"**). Toggle "Dự báo cá (PFZ)" quay lại phụ đề cố định "Theo ngày · ảnh vệ tinh". `lib/fish-age.ts` + test đã **xoá** (không còn ai dùng).

`/api/fish-forecast` **vẫn trả `generatedAt`** (và `FishForecast.generatedAt` vẫn còn trong interface) — rẻ, không hiện ra UI, giữ để đối chiếu/kiểm tra sau này. Ai muốn hiện lại tuổi cá phải mở lại quyết định sản phẩm này.

**B. TẢI SẴN TỰ ĐỘNG + notify tự ẩn** (`lib/pretrip.ts` giữ nguyên phần tải · cửa chặn `lib/pretrip-auto.ts` · hiển thị `components/pretrip-auto-notify.tsx`)

Bỏ cả ba thứ cũ: nút "Chuẩn bị đi biển", thẻ xanh "Xong. Máy giữ dự báo tới ngày D/M cho N chỗ.", dòng thường trực "Trong máy: dự báo tới D/M · N chỗ". Nay **vào màn Ra khơi là máy tự lo**, chỉ báo **một dòng gọn bo tròn** nổi dưới banner bão (kiểu hiển thị mượn `storm-banner.tsx`: `rounded-full px-3 py-1.5`, 14px đậm, `shadow-md`, `role="status"`, không nút, không chắn bản đồ).

| Lúc | Dòng báo | Nền |
|---|---|---|
| Đang chạy | **"Đang tải dự báo…"** | `bg-card/95` chữ navy |
| Xong | **"Đã lưu dự báo tới ngày D/M."** → tự ẩn sau **5 giây** | `bg-ok-bg` + ✓ |
| Hỏng / mất sóng giữa chừng | **"Chưa tải được dự báo — chưa có sóng."** → tự ẩn | `bg-warn-bg` + ⚠ |
| Máy hết chỗ nhớ | **"Máy hết chỗ nhớ — xoá bớt điểm đã lưu."** → tự ẩn | `bg-warn-bg` + ⚠ |

**Nhãn nhỏ THƯỜNG TRỰC "đã sẵn sàng ra khơi chưa"** (`PretripSavedStatus` trong `pretrip-auto-notify.tsx`, thêm 2026-07-26): khác dòng nổi tự tắt ở trên — đây là **chip nhỏ 13px căn phải, nằm ngay TRÊN box biển động** (slot `above` của `SnapSheet`, **chỉ ở nấc `peek`**), để bà con liếc là biết trong máy đã có dự báo tới ngày nào. Câu chữ ở `pretripSavedText` (`lib/pretrip-auto.ts`, thuần, có test), đọc thẳng `savedSummary()` + bám phase tải sẵn:

| Trạng thái | Chip | Màu |
|---|---|---|
| Đang tải sẵn | **"Đang tải dữ liệu dự báo"** | chữ navy |
| Trong máy đã có bản | **"Đã lưu dữ liệu dự báo tới ngày D/M"** | chữ `text-ok` |
| Chưa có gì | **"Chưa tải dữ liệu dự báo"** | chữ `text-warn` |

Dòng lỗi **"Dự báo cá chưa tải được — chạm để thử lại"** (khi lớp cá bật mà tải hỏng) **xếp NGAY TRÊN** nhãn này trong cùng slot `above`, căn phải (2026-07-26) — trước đây trôi nổi góc trái bản đồ.

Tải sẵn (không đổi): gió sóng 16 ngày cho **chỗ đang xem + mọi điểm đã ghim** (gộp các chỗ cùng ô 0,25°) · **bản đồ cá** · **lưới gió/sóng khung 3 / 7 / 16 ngày** (`PRETRIP_GRID_DAYS`).

**TIẾT CHẾ DATA (bắt buộc)** — mỗi lượt tải sẵn ≈ **2,5–3 MB**, bà con trả tiền theo dung lượng nên KHÔNG được tải lại mỗi lần vào trang. Luật ở `shouldAutoPretrip` (`lib/pretrip-auto.ts`, thuần, có test):

| Trường hợp | Hành vi |
|---|---|
| Chưa tải lần nào | **chạy** |
| Bản trong máy cũ hơn **6 giờ** (`PRETRIP_MIN_INTERVAL_MS`, khớp ISR 6h của nguồn) | **chạy** |
| Bản còn mới (< 6 giờ) | **KHÔNG chạy, im lặng hoàn toàn** — không hiện notify gì |
| `navigator.onLine === false` | **KHÔNG thử tải, im lặng** |
| Vẽ lại / đóng-mở sheet / đổi lớp trong màn | **KHÔNG chạy lại** — cờ ở mức module, một lần mỗi lần mở app |
| Mốc lưu nằm ở tương lai (đồng hồ máy chỉnh lùi) hoặc rác | coi như chưa có → **chạy** (không để cửa chặn kẹt vĩnh viễn) |

Mốc lần chạy gần nhất lưu ở `forfish.pretrip.lastRunAt.v1` (xem `ops/state-registry.md`).

- Vỏ offline: `public/sw.js` pre-cache thêm `/ngu-truong` (bump `SDFISH_CACHE_V` → `sdfish-v3`) — trước đây mở app giữa biển chỉ về được trang chủ.

**C. Lưới gió/sóng — đúng KHUNG NGÀY đã xin** (`lib/forecast-grid.ts`)

Bỏ fallback "bản lưu gần nhất": xin 16 ngày mà máy chỉ có 3 ngày thì trước đây đưa lưới 3 ngày trong khi chip vẫn sáng "16 ngày". Nay không có đúng khung → thanh giờ báo: **"Chưa tải được khung {N} ngày — máy chưa lưu khung này."** + nút "Thử lại"; nếu máy có khung khác thì liệt kê thật **"Trong máy đang có: [3 ngày] [7 ngày]"**, chạm là đổi sang đúng khung đó (chip khung ngày đổi theo, không nói dối).

### 10.3 BẢN ĐỒ khi mất sóng — không được để màn hình trắng (2026-07-25m)

Lỗ hổng cuối của mạch §10.1–10.2: số liệu đã nói thật, nhưng **cái nền dưới nó thì biến mất**. Mọi ô bản đồ đến từ host ngoài mà Service Worker không giữ được (chỉ giữ same-origin) → mất sóng là nền trắng: bà con có số gió sóng và điểm nóng cá, nhưng **mũi tên gió lơ lửng giữa khoảng trắng**, không thấy bờ, không thấy đảo. Đây là lỗi AN TOÀN (mất định hướng), không phải lỗi thẩm mỹ.

**A. Bà con THẤY GÌ khi mất sóng** (`lib/offline-basemap.ts` + `public/data/vn-coast.v1.json`)

| Lớp | Có khi mất sóng? | Vì sao |
|---|---|---|
| Nền nước (màu biển kín màn hình) | **Luôn có** | layer `sea-bg` nằm trong style, không cần tải gì |
| Hình **bờ biển + đảo** (gồm Hoàng Sa, Trường Sa) | **Luôn có** | GeoJSON 215 KB nằm sẵn trong máy từ lúc cài app (SW pre-cache) |
| Nhãn chủ quyền (BIỂN ĐÔNG, QUẦN ĐẢO HOÀNG SA…) | **Luôn có** | nhãn HTML, không phải ô bản đồ |
| Ranh giới biển VN (cam-đỏ) + vùng lộng | **Luôn có** | toạ độ nằm trong mã nguồn |
| Đường đẳng sâu + **số mét** | **Luôn có** (lớp Hải đồ) | `isobaths.v1.json` + font chữ đều pre-cache |
| Vị trí tàu mình, thước đo, điểm đã ghim | **Luôn có** | GPS + localStorage |
| Gió/sóng, điểm nóng cá, tin bão | Bản đã lưu (§10.1–10.2) | — |
| Hải đồ EMODnet, phao đèn, ảnh vệ tinh | Chỉ vùng **đã xem lúc còn sóng** (hải đồ/phao) · ảnh vệ tinh thì không | tile đi qua `/api/tiles/*` mới cache được; NASA/CARTO vẫn cross-origin |

**B. Khi nào bật nền trong máy** — `shouldUseOfflineBasemap({online, fails})`: máy báo mất mạng → bật **ngay**; máy báo có mạng nhưng ô nền trượt ≥ **3 ô** (wifi cảng "có mà không ra") → cũng bật. Tải được một ô là đếm về 0 và tắt lại. **Có sóng thì KHÔNG vẽ** — nền thật đủ tốt, vẽ chồng chỉ rối. Lớp bờ đặt DƯỚI mọi lớp khác (ranh giới, cá, mũi tên gió vẫn nổi trên).

**C. Chữ báo cho bà con — MỘT DÒNG, TỰ ẨN** (sửa 2026-07-25p)

Trước đây là **thẻ vàng 2 dòng nằm lì** trên bản đồ. Chủ dự án xem bản thật: cùng bệnh với §10.2 — chữ nằm lì làm rối màn. Nay dùng **đúng kiểu chip** của `pretrip-auto-notify.tsx` / `storm-banner.tsx`: `rounded-full px-3 py-1.5`, 14px đậm, `bg-warn-bg` + ⚠, `role="status"`, `pointer-events-none`.

| Trạng thái | Chữ |
|---|---|
| Mất mạng hẳn | **"Mất sóng — đang dùng bản đồ lưu trong máy."** |
| Có mạng mà ô nền không về | **"Mạng yếu — đang dùng bản đồ lưu trong máy."** |

- **Tự ẩn sau 5 giây** (`NOTIFY_HIDE_MS`, xuất từ `components/pretrip-auto-notify.tsx` để mọi dòng báo nổi tắt cùng một nhịp).
- **Hiện lại khi trạng thái ĐỔI**: đang mất sóng → có sóng → mất lại thì báo thêm một lần. Vẫn đang mất sóng thì **không** báo đi báo lại (effect chỉ chạy lại khi CÂU đổi).
- Bỏ hẳn dòng phụ "Bờ, đảo, ranh giới và độ sâu vẫn đúng chỗ…" — bà con nhìn là thấy, không cần chữ.

Không dùng từ kỹ thuật (tile / offline / cache / bản đồ nền) — có test chặn jargon lọt vào câu này.

**D. Số biển từ ảnh CŨ — MỘT DÒNG, TỰ ẨN** (thêm 2026-07-26; bỏ nhánh "thiếu nguồn" 2026-07-27)

Bản đồ cá biết mình dựng từ ảnh ngày nào (`sources`, xem [02](02-architecture.md) + [ops/external-services](ops/external-services.md)). Màn hình GỌN → **KHÔNG badge thường trực**; nhưng im hẳn khi ảnh CŨ thì thành hứa "hôm nay" mà dữ liệu không đảm bảo (bà con ra khơi theo bản đồ này). Chốt: **một dòng, chỉ khi ảnh cũ, tự ẩn 5 s** — đúng chip như mục C.

| Khi nào | Chữ |
|---|---|
| Ảnh nhiệt hoặc phù du quá tuổi (`sources.sst.stale` / `sources.chl.stale`) | **"Số biển hôm nay lấy từ ảnh cũ — có thể chưa sát."** |
| Bình thường / payload cũ chưa có `sources` | **im lặng** — không doạ oan |

- **BỎ cảnh báo "thiếu vài nguồn số biển" (chủ dự án 2026-07-27)**: bà con thấy dữ liệu vẫn hiển thị bình thường mà lại báo "thiếu nguồn — chưa sát" là gây hoang mang vô ích. Bản đồ vẫn dựng từ nguồn còn sống (bất biến monotonic: mất nguồn phụ chỉ GIẢM điểm, không bịa) nên KHÔNG cần báo user. Tình trạng thiếu nguồn + `dataQuality` GIỮ cho trang **quản trị** (`/quan-tri` tab Dữ liệu).
- Luật + chữ nằm ở `lib/source-registry.ts` (`lowQualityNote` — nay chỉ còn nhánh ảnh cũ, có test); hiển thị trong `fishing-map-view.tsx`, chỉ khi lớp cá đang bật.
- Cùng `NOTIFY_HIDE_MS` = 5 s như mục C, cùng `bg-warn-bg` + ⚠ — không thêm kiểu chip mới.
- Không nói tên dataset, không hiện tuổi tính bằng ngày (quyết định 2026-07-25n vẫn giữ: **không hiện tuổi lớp cá**).

### 10.4 Chạm điểm khi mất sóng — LẤY SỐ TỪ LƯỚI ĐÃ LƯU (2026-07-25p)

Chủ dự án bật **chế độ máy bay** trên bản production: bản đồ nền, bờ, đảo, độ sâu và **mũi tên gió đều vẽ đủ**, thanh "Gió · Th 2 27/7 · 6h" chạy được — tức lưới đã lưu đang dùng tốt. Nhưng **chạm một điểm trên biển** thì sheet báo đỏ "Chỗ này chưa có số nào lưu trong máy". Mâu thuẫn thấy bằng mắt: mũi tên đang vẽ ngay chỗ đó mà app nói không có số.

Nguyên nhân: §10.1 D bỏ fallback quá tay — chỉ còn nhận **đúng ô 0,25° đã từng chạm**, trong khi **lưới phủ CẢ VÙNG BIỂN và đúng vị trí**.

**A. Luật lấy số** (`lib/forecast-grid.ts` + `lib/marine-weather.ts`, thuần, có test)

Thứ tự khi `fetchSeaPoint` mất mạng: (1) bản ĐẦY ĐỦ đã lưu của đúng ô 0,25° → (2) **dựng từ lưới đã lưu** → (3) nói thật là chưa có gì.

| Việc | Luật |
|---|---|
| Chọn khung lưới | **Khung DÀI NGÀY NHẤT đang có** (`loadLongestSavedGrid`: d16 → d7 → d3) — phủ nhiều ngày nhất cho chuyến dài |
| Chọn ô lưới | Ô **PHỦ** chỗ vừa chạm (`nearestGridCell`). Trần = **nửa bước lưới theo TỪNG CHIỀU** (`GRID_SNAP_MAX_LAT_DEG` ≈ 0,86° · `GRID_SNAP_MAX_LON_DEG` ≈ 1,06°; `GRID_SNAP_MAX_DEG` = trần lớn nhất). Xa hơn → **KHÔNG dùng**, giữ nguyên câu "chưa có số nào lưu trong máy" |
| Gộp ngày | Mốc giờ của lưới đã là **giờ VN** → gộp theo ngày, mỗi ngày lấy **gió LỚN NHẤT + sóng CAO NHẤT** (đúng như thẻ ngày mô tả "gió tới…", "sóng tới…") |
| Nguồn gốc | `stale: true` + `savedAt` của lưới + `source: "saved-grid"` |

> **Vì sao trần là nửa bước lưới chứ không phải 0,5°**: lưới thưa ~2° (ngang 2,11° × dọc 1,70°). Đặt 0,5° thì quá nửa số lần chạm giữa hai mũi tên vẫn bị từ chối — đúng cái mâu thuẫn bà con kêu. Dùng **hai nửa-bước theo hai chiều** (không phải một bán kính tròn) vì lưới dẹt: bán kính tròn để thủng mấy góc ô. Bù thêm 0,01° vì toạ độ ô làm tròn 2 chữ số. **Bất biến giữ nguyên**: ô lưới = đúng chỗ đang chạm, KHÔNG bao giờ dán số của một toạ độ khác.

**B. TRUNG THỰC — lưới CHỈ có gió + sóng**

`SeaPointDay` cho phép `score` / `level` / `precipMm` / `wmoCode` = **null**. Bản dựng từ lưới để null hết → UI **ẩn**:

| Phần | Bản đầy đủ | Bản dựng từ lưới |
|---|---|---|
| Chấm tình trạng biển ("Biển êm"/"Biển động…") + màu | có | **ẩn** — peek chỉ hiện tên ngày + số gió/sóng |
| Màu thẻ ngày / khối "Cả ngày" | theo `level` | **trung tính** (`--field` / `--navy`) |
| Thẻ "Gió lúc này" / "Sóng lúc này" | có | **ẩn hẳn** (`windKmh` = null — lưới không có số đo hiện tại) |
| Mưa / dông | có | **ẩn** (`wmoCode` null) |
| Dải chọn ngày + "Cả ngày: sóng tới … · gió tới cấp …" | có | **có** |
| Độ tin theo tầm ngày | có | **có** |

**C. Chữ trong sheet** — thẻ "số cũ" là **chip nhỏ TỰ ẨN** (13px, nền warn, có `AlertIcon`, `staleNoteOn` tắt sau `NOTIFY_HIDE_MS` như chip mất-sóng/chất-lượng-cá) — trước là hộp vàng 17px nằm lì che bản đồ, bà con than "không tự ẩn, mất view" (2026-07-27). Vẫn nói thật MỘT lần rồi trả lại tầm nhìn (an toàn nhưng không cản). Signal tự ẩn = `source:savedAt` nên vẫn stale thì không nhấp nháy báo lại.

| Trường hợp | Chip (tự ẩn) |
|---|---|
| Bản đầy đủ đã lưu | "Số cũ trong máy (lưu N giờ trước). Chưa phải số mới." |
| **Dựng từ lưới** | **"Số gió, sóng lấy từ bản đã lưu (lưu lúc HH:MM ngày D/M). Chưa có mưa, dông chỗ này."** |
| Ngoài vùng lưới / máy chưa lưu gì | "Chỗ này chưa có số nào lưu trong máy — vuốt lên để thử lại." (giữ nguyên, KHÔNG tự ẩn — chưa có số là chuyện phải nói mãi) |

**D. Chữ/số trên bản đồ** — `glyphs` trước trỏ CDN `fonts.openmaptiles.org`; dò 2026-07-25 thấy CDN đó **trả trang HTML chuyển hướng thay vì file font** → nhãn "50 m" trên đường đẳng sâu **chưa từng hiện, kể cả lúc có sóng**. Nay tự host `public/fonts/` (Noto Sans Regular + Bold, giấy phép OFL) → chữ hiện, và mất sóng vẫn còn.

**E. Trần bộ nhớ** — ô bản đồ đi qua `/api/tiles/*` được giữ trong kho riêng `sdfish-tiles-v1`, **trần 600 ô (~12 MB)**, quá thì bỏ ô cũ nhất. Xem bản đồ lâu KHÔNG được làm đầy máy bà con (cùng nguyên tắc với "máy hết chỗ nhớ" ở §10.2).

### 10.5 Thanh ngày KHÔNG điều khiển lớp cá — vì đo được là bản đồ cá không đổi (2026-07-26)

Chủ dự án muốn bản đồ cá chạy **hôm nay → +3 ngày** theo thanh ngày. **ĐO TRƯỚC KHI DỰNG** (`scripts/fish-3day-probe.mjs`) rồi mới quyết — và số đo nói: **KHÔNG dựng**.

**Đã đo gì.** Dựng SST cho D+1..D+3 bằng neo vệ tinh + xu hướng nhiệt Copernicus (`lib/sst-tendency.ts`, hệ số α cross-validated từ `src/data/copernicus-tendency-skill.json`), giữ nguyên mọi trường khác (phù du KHÔNG có kỹ năng xu hướng nên phải giữ ảnh hôm nay), rồi chấm lại `buildFishForecast` và so bản đồ.

| Ngày ảnh | Jaccard(ô ≥50) D+3 | ô đổi trạng thái điểm nóng D+3 | tb \|Δđiểm\| | %điểm nóng D+0 → D+3 |
|---|---|---|---|---|
| 24/7/2026 (hè) | 0,926 | **1,64 %** (37/2252) | 0,51/100 | 22,1 % → 20,9 % |
| 10/1/2026 (đông) | 0,982 | **0,52 %** (12/2299) | 0,12/100 | 28,5 % → 28,2 % |
| 8/4/2026 (chuyển mùa) | 0,967 | **0,53 %** (12/2250) | 0,27/100 | 15,9 % → 15,7 % |

Ngưỡng ĐẶT TRƯỚC khi chạy: "đổi đáng kể" ⇔ Jaccard < 0,90 **hoặc** ≥5 % ô đổi trạng thái ở D+3. **Không mùa nào chạm ngưỡng.** Lý do vật lý: nhiệt mặt biển chỉ đổi ~0,4 °C sau 3 ngày, hãm theo α còn ~0,1–0,24 °C — quá nhỏ so với bề rộng cổng nhiệt của loài (vài °C).

**Quyết định UI**: lớp cá giữ **MỘT bản** (ảnh vệ tinh mới nhất) cho mọi ngày trên thanh ngày. **KHÔNG dựng 4 bản, KHÔNG làm thanh trượt giả** — cho bà con kéo ngày mà bản đồ y hệt là nói dối bằng hình.

| Trạng thái | Chữ trong sheet (chạm điểm, dưới khối cá) |
|---|---|
| Đang xem **hôm nay** (`daysAhead = 0`) | KHÔNG thêm chữ gì — màn hình giữ gọn (quyết định 2026-07-25n) |
| Đang xem **+1..+3 ngày** | "Chỗ cá ít đổi trong vài ngày tới — cái đổi là gió, sóng." |
| Đang xem **> +3 ngày** (thanh ngày tới 16) | "Lớp cá vẫn là ảnh mới nhất, không phải dự báo riêng cho ngày này — xa ngày thì xem gió, sóng." |

- Mốc 3 ngày là hằng `FISH_STABLE_DAYS` trong `fishing-map-view.tsx` — **đúng bằng tầm đã đo**; xa hơn thì chưa đo nên phải đổi giọng, KHÔNG được nói "ít đổi".
- **KHÔNG badge thường trực**, không chip mới, không dòng trên bản đồ. Chữ chỉ hiện khi bà con ĐÃ kéo sang ngày khác VÀ đang đọc thẻ cá — đúng lúc câu hỏi "sao kéo ngày mà bản đồ không đổi?" xuất hiện.
- Thứ ĐỔI theo ngày vẫn là gió/sóng (đã có kỹ năng đo được ở `src/data/forecast-skill.json`, dòng độ tin theo tầm ngày giữ nguyên).

---

**Last updated**: 2026-06-16
<!-- re-verified: 2026-06-11 — screen map khớp routes; contrast AA pass home/nguoi/tau (eval) -->
<!-- re-verified: 2026-06-15 — thêm /tien Báo cáo năm/Tính chuyến/Công nợ + /tau checklist xuất bến + hồ sơ/lặp lại chuyến; fix layout suppressHydrationWarning không đổi screen spec -->
<!-- re-verified: 2026-06-15 — triage full-sweep; fixed demo-persist §8 (doc-vault/maint/products) + title grammar /tau; contrast/tabular re-confirmed 06-11 -->
<!-- re-verified: 2026-06-15 — boat-store refactor (08) nội bộ (useBoats → store dùng chung, đổi tàu cập nhật live) — KHÔNG đổi screen map/state matrix -->
<!-- re-verified: 2026-06-15 — build đa tàu: chip BoatSwitcher trên /tien (lãi-lỗ theo tàu) + crew owner-scope (§5 +chip); action→expectation Đổi tàu / Xóa tàu (§7); còn lại screen map không đổi -->
<!-- re-verified: 2026-06-15 — build đa tàu 4-5/5: dải nhắc Home gắn nhãn tàu mỗi việc khi >1 tàu (urgent-strip), /tau Sản phẩm có sheet "Đồ này của tàu nào?" (gán hàng SDVICO) — còn lại không đổi -->
<!-- re-verified: 2026-06-16 — rebrand ForFish→SDFish (chỉ string brand) + PWA (manifest/SW/icons) + api-base indirection; screen map/nav/object model KHÔNG đổi -->
<!-- re-verified: 2026-06-16 — native UI polish: edge-to-edge safe-area, motion điềm đạm (sheet/dialog vào-ra, tab cross-fade), tap-target Tabs/SnapSheet→56; screen map/nav/density/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-06-23 — Ra khơi feedback: rail panel cân đối + nhãn rút gọn; sheet đáy vuốt (bỏ nút Xem thêm/Thu gọn); banner bão thu/mở; sóng-gió liền mạch; bỏ hàng GPS ở Điểm; BottomSheet cap 85dvh (xem §10 delta 2026-06-23) -->
<!-- re-verified: 2026-06-23b — Chọn loài + Điểm đã lưu chuyển từ bottom-sheet modal sang PANEL RAIL (drill-down Ngư trường / nội dung Điểm); FishSpeciesContent + MyPlacesContent tách dùng chung -->
<!-- re-verified: 2026-06-23c — sheet: mưa/dông + độ tin dời lên LIỀN sóng/gió; thanh giờ Windy (gió/sóng) cho thu/mở (chip "chạm để chọn giờ") -->
<!-- re-verified: 2026-06-23d — bỏ nút "Về cảng nhà" ở sheet (vô tác dụng); kéo sheet info lên (half/full) TỰ ẨN tin bão + rail phải (opacity+pointer-events) cho khỏi chồng chéo, về peek hiện lại — logic tự ẩn, không bắt click -->
<!-- re-verified: 2026-06-23e — login-gate ĐỒNG BỘ: panel Ngư trường khi chưa đăng nhập → ẩn picker loài + dải khả năng, chỉ 1 CTA "Đăng nhập để chọn loài & xem khả năng" (khớp gate ở sheet); toạ độ điểm đang xem dời lên PEEK (luôn thấy), bỏ bản trùng cuối sheet -->
<!-- re-verified: 2026-06-23f — sheet: tap nở dần peek→half→full, ở full tap lần nữa thu về peek (không còn tap vô tác dụng); banner bão overlay tự thu thành chip sau 3s kể từ lúc check bão về (refresh/back lại map), chạm mở lại -->
<!-- re-verified: 2026-06-23g — panel rail width theo nội dung: Điểm đã lưu + Chọn loài rộng w-22rem (max calc(100vw-4.25rem)) cho khỏi chồng chéo/dễ nhìn; panel đơn giản (Hải đồ/Thời tiết/Ngư trường-menu) giữ w-16.5rem cân đối -->
<!-- re-verified: 2026-07-25 — thanh giờ Windy (gió/sóng) thêm HÀNG CHỌN KHUNG NGÀY 3/5/7/10/16 (chip đầy đủ chiều ngang) ngay trên slider; nhãn mốc slider động theo khung (Bây giờ → N ngày); đổi khung = tải lại lưới tầm mới. forecast-grid: bước tăng dần 3/6/12h + sóng ncep_gfswave025 -->
<!-- re-verified: 2026-07-27 — BẤM khung ngày (3/5/7/10/16) → khi lưới mới về, thanh giờ NHẢY tới NGÀY CUỐI của khung (bấm "10 ngày" = xem luôn gió ~ngày 10, kéo lùi để về gần). `jumpEndRef` đặt cờ lúc bấm, áp lúc grid sẵn sàng; lần MỞ lớp đầu KHÔNG bật cờ → giữ "Bây giờ". Sửa nhầm lẫn bà con: 2 control cùng nhãn "ngày" (khung vs giờ) → trước bấm khung reset về Bây giờ, tưởng gió không đổi. -->
<!-- re-verified: 2026-07-25b — api/fish-forecast route thêm fetch ETOPO (cổng độ sâu chặn loài xa bờ). BACKEND-only: không đổi màn hình/mật độ/trạng thái nào; lớp cá trên map chỉ bớt điểm nóng sát bờ cho loài xa bờ. -->
<!-- re-verified: 2026-07-25c — THÊM lớp map "Ranh giới vùng lộng" (NĐ 26/2019, polygon 36 đỉnh SDVico): nét đứt teal #0d9488 + fill mờ 6%, vẽ TRƯỚC ranh giới ngoài (cam-đỏ IUU vẫn nổi trên, GIỮ độc quyền màu). Toggle bật/tắt trong panel CÀI ĐẶT (mục "Lớp bản đồ") + nhãn THAM KHẢO "tra Chi cục Thủy sản". Mặc định bật. (chuyển từ Thời tiết → Cài đặt theo user 2026-07-25) -->
<!-- re-verified: 2026-07-25d — badge lớp nền Hải đồ BỎ "Ảnh {ngày} · chậm ~2 ngày" (user: không cần), chỉ còn "Theo ngày". Giữ 1 dòng ghi chú chung "Ảnh vệ tinh trễ ~2 ngày" ở chân panel. -->
<!-- re-verified: 2026-07-25e — dải lọc khả năng có cá SÀN 50 (trước 35, user: dưới 50 làm nhiễu): default fishRange [50,100], hard-floor Math.max(50,…) áp cả "Mọi loài" lẫn theo loài, RangeBand min=50. Lõi PFZ tính ≥25 (chỉ lọc HIỂN THỊ ở client). -->
<!-- re-verified: 2026-07-27 — SÀN HẠ 50→40 (user: dải 40–60 Thấp[xanh lá] / 60–75 TB[vàng] / 75–100 Cao[đỏ] cho lưới ô 3 mức). Sàn CỐ ĐỊNH = FISH_LEVEL_BANDS[0].min (40). ĐÃ BỎ dải lọc kéo-2-đầu + state fishRange + hàm RangeBand (user: không cần) → lưới luôn hiện đủ 3 mức ≥40. Lõi PFZ vẫn tính ≥25. Điểm nóng hồng tâm giữ ngưỡng ≥75 (= mức Cao). -->
<!-- re-verified: 2026-07-25f — VIỆC 3: lõi chấm điểm đổi TRUNG BÌNH CỘNG → soft-OR (cổng nhiệt × mồi-giới-hạn-mềm × soft-OR cơ chế × cổng độ sâu; hằng calibrate lưới thật, xem 01-product + scripts/fish-predict-viec3-calib.mjs). BACKEND-only, KHÔNG đổi màn hình/mật độ/trạng thái/chữ UI. HỆ QUẢ HIỂN THỊ: điểm nóng s≥50 CO LẠI (~½→~⅕ vùng biển) → bản đồ ở sàn 50 sẽ THƯA điểm hơn (đúng ý đồ: điểm nóng thật hơn); ngưỡng giữ ô lõi hạ 35→25 nên payload không rỗng khi user kéo dải xuống. Nếu bà con thấy "ít điểm quá" cân nhắc chữ trấn an — CHƯA đổi wording. -->
<!-- re-verified: 2026-07-25f — cá ĐÁY/RẠN/giáp xác (surfaceSignal low) giữ hiển thị được ở sàn 50: NEUTRAL_AGG 0.6 đủ để vùng hợp MÙA VỤ+nhiệt+mồi của loài đáy vượt 50 (calib mùa đông: cá mối/tôm bạc/ghẹ đều có ô ≥50) → chọn loài đáy KHÔNG ra bản đồ trống. Vẫn TRUNG THỰC: là suy theo mùa+nhiệt+mồi, không phải điểm nóng vệ tinh giả. -->
<!-- re-verified: 2026-07-26 — THIẾU NGUỒN nay làm ĐIỂM GIẢM chứ không tăng (wMax cố định theo hồ sơ loài + DEPTH_UNKNOWN_FIT 0.5 khi mất lưới độ sâu). BACKEND-only: KHÔNG đổi màn hình/mật độ/trạng thái/chữ UI nào. HỆ QUẢ HIỂN THỊ: ngày ĐỦ NGUỒN bản đồ y như cũ (đo lưới thật: %điểm nóng 48.8→48.8 t7, 66.6→66.5 t1). Ngày HỎNG NGUỒN thì THƯA hơn thay vì dày lên: mất HYCOM → cá ngừ bớt điểm nóng; mất ETOPO → loài xa bờ (ngừ/cờ/nục heo/mực xà) gần như không còn ô ≥50 (vẫn nằm trong payload ≥25 nên kéo dải xuống dưới 50 vẫn thấy). Chưa có chữ UI nào giải thích "hôm nay thiếu nguồn nên bản đồ thưa" — đã có sổ nguồn/dataQuality trong payload, CÂN NHẮC dùng cho dòng tự-ẩn 5s nếu bà con thắc mắc; CHƯA đổi wording. -->
<!-- re-verified: 2026-07-26b — TƯƠNG PHẢN BẢN ĐỒ CÁ: sửa `thermoFit` (D20 tuyệt đối → dị thường KHÔNG GIAN + dải theo loài). BACKEND-only: KHÔNG đổi màn hình/mật độ/trạng thái/chữ UI nào. SỬA SỐ SAI trong ghi chú 2026-07-25f: "~½→~⅕ vùng biển" là số đo bằng script calibrate CỐ Ý BỎ HYCOM, không phải số sản phẩm — %điểm nóng ĐO TỪ API THẬT (GET /api/fish-forecast, 2354 ô biển, ảnh 23–24/7/2026, đủ 7 nguồn) TRƯỚC = 49,0% (1153 ô), tức bản đồ vẫn "nhìn đâu cũng đỏ". SAU khi sửa = 21,1% (497 ô), median 49→37, p90 66→60 → bản đồ ở sàn hiển thị 50 nay THƯA và có tương phản thật. KHÔNG loài nào biến mất (mọi loài đang vụ đều còn ô ≥50; ít nhất là "ngừ mắt to" 8 ô, vẫn 348 ô trong payload ≥25 nên kéo dải xuống dưới 50 vẫn thấy). Loài xa bờ giảm mạnh nhất (ngừ vây vàng 457→217, mực xà 328→66); loài không dùng tầng nhiệt (cá đáy/rạn/giáp xác/cá nổi nhỏ) KHÔNG đổi một ô nào. CHƯA đổi wording — nếu bà con thấy "ít điểm quá" thì đây là chủ ý (điểm nóng thật hơn), cân nhắc chữ trấn an sau. -->
<!-- re-verified: 2026-07-25g — OFFLINE (user: ra khơi mất mạng vẫn xem 16 ngày): fetchSeaPoint LƯU mỗi lần lấy thành công vào localStorage (lib/forecast-cache), mất mạng lùi về bản đã lưu (đúng điểm/không thì gần nhất) + cờ stale. Sheet peek thêm TRẠNG THÁI "mất mạng": banner warn "Đang xem bản đã lưu (offline) · lưu X trước — có mạng sẽ tự cập nhật". Cá PFZ + bão đã offline sẵn qua Service Worker (network-first /api/*). -->
<!-- covers: lib/forecast-cache.ts (offline localStorage forfish.fc.*) — chưa có ops doc riêng, đủ mô tả ở đây + 02-architecture khi mạch fish-predict-viec4 sync xong. -->
<!-- re-verified: 2026-07-25h — OFFLINE mở rộng: lớp gió/sóng WINDY (forecast-grid) cũng cache localStorage theo khung ngày; mất mạng kéo thanh giờ vẫn xem được bản đã tải, thanh giờ hiện "· bản lưu (offline)". Lưới đã downsample (~58 khung/16 ngày) nên nhẹ. -->
<!-- re-verified: 2026-07-25i — TRẠNG THÁI MẤT SÓNG nói thật (xem §10.1): (1) tin bão tách 3 trạng thái qua lib/storms.ts stormStatus + ngưỡng 12h, banner/panel/marker đều đọc checkedAt — bỏ câu "đã kiểm tra" và "cập nhật vừa xong"; (2) nhãn ngày so ngày thật qua lib/day-labels.ts (dayLabel/chipLabel/isPastDay), chip ngày đã qua mờ + disabled, thanh giờ Windy so ngày thật; (3) khối "Gió/Sóng lúc này" đổi tiêu đề "đo lúc HH:MM ngày D/M" khi xem bản lưu, chỉ báo bản lưu 13px→17px kèm giờ lưu; (4) fetchSeaPoint bỏ fallback loadLatest (không mượn số chỗ khác), chỗ chưa lưu → "Chỗ này chưa có số nào lưu trong máy"; (5) assessForecast/applyBiasCorrection/forecastConfidence tính lead từ ngày thật (leadOf). -->
<!-- re-verified: 2026-07-25j — CHUẨN BỊ ĐI BIỂN + tuổi lớp cá (xem §10.2): (1) /api/fish-forecast trả thêm generatedAt, lib/fish-age.ts tính tuổi → badge "Bản đồ cá — Ảnh ngày … · lấy về …" (nền warn khi ảnh > 5 ngày — mức đo được còn tin cậy: tương quan ~0.976 ở lead 5 ngày), panel Ngư trường bỏ chữ "cache 6h", thẻ cá trong sheet nói cả hai mốc; (2) thẻ "Chuẩn bị đi biển" ở Ra khơi (lib/pretrip.ts): 1 nút to + tiến trình + câu kết "Xong. Máy giữ dự báo tới ngày D/M cho N chỗ." + dòng thường trực "Trong máy: dự báo tới D/M · N chỗ"; sw.js pre-cache thêm /ngu-truong (SDFISH_CACHE_V v3); (3) forecast-grid chỉ lùi về ĐÚNG khung ngày đã lưu, thiếu thì nói thật + liệt kê khung đang có; (4) forecast-cache: trim TRƯỚC setItem + xử lý QuotaExceeded, saveForecast trả boolean (UI báo "máy hết chỗ"), bỏ hẳn loadLatest. -->
<!-- re-verified: 2026-06-23h — rail 4→6 nút: thêm Công cụ (đo khoảng cách 2 điểm, vẽ đường+mốc trên map, kết quả theo đơn vị) + Cài đặt (đơn vị hải lý/km + hệ toạ độ dd/dms qua lib/map-prefs store dùng chung; đổi thì peek/whereLine/điểm-cá-gần/dẫn-đường/đo đổi theo). Icons SettingsIcon/RulerIcon. Test map-prefs.test.ts -->
<!-- re-verified: 2026-06-23i — công cụ đo: thêm nhãn khoảng cách NGAY GIỮA đường nối 1→2 trên bản đồ (marker midpoint) -->
<!-- re-verified: 2026-06-16 — /login = SĐT + mật khẩu (webhook provision, KHÔNG email/OTP); nav/screen map/object model không đổi -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): thêm lớp BÃO trên map (vùng ảnh hưởng polygon đỏ mờ + đường đi track gạch đứt, dưới Marker tâm bão) từ GDACS; + fix dự báo cá maxDuration/ISR. Screen map/nav/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): legend cá thành BỘ LỌC kéo-thả 2 đầu (chỉ hiện ô [lo,hi]% khả năng có cá). Độ sâu raster KHÔNG lọc được (giữ legend tĩnh). Screen map/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-07-25m — BẢN ĐỒ LÚC MẤT SÓNG (xem §10.3): (1) style thêm layer nền nước sea-bg (không còn màn hình trắng); (2) nền tối giản bờ+đảo public/data/vn-coast.v1.json bật qua lib/offline-basemap.ts khi mất mạng hoặc ≥3 ô nền trượt, đặt DƯỚI mọi lớp khác, có mạng thì không vẽ; (3) badge warn "Mất sóng. Đang dùng hình bờ biển lưu trong máy." cùng chỗ badge tuổi lớp cá; (4) glyph font tự host public/fonts (CDN openmaptiles đã chết → nhãn số mét trước nay KHÔNG hiện); (5) hải đồ + phao đèn qua /api/tiles/* để SW giữ được, kho ô riêng trần 600 ô; sw.js → sdfish-v4. -->
<!-- re-verified: 2026-07-25n — GỌN MÀN HÌNH (xem §10.2, chủ dự án xem app thật thấy rối): (1) BỎ HẲN mọi chỗ hiện tuổi lớp cá — badge trên map (cả biến thể "Bản đồ cá CŨ" nền vàng), khối warn panel Ngư trường, đuôi "Ảnh ngày…/lấy về…" trong thẻ cá ở sheet; xoá lib/fish-age.ts + test (không còn ai dùng). /api/fish-forecast VẪN trả generatedAt nhưng KHÔNG hiển thị (giữ để đối chiếu). (2) BỎ nút "Chuẩn bị đi biển" + thẻ xanh "Xong. Máy giữ dự báo…" + dòng thường trực "Trong máy: …" → TỰ tải khi vào trang, báo 1 dòng tự ẩn sau 5s ("Đang tải dự báo…" / "Đã lưu dự báo tới ngày D/M." / "Chưa tải được dự báo — chưa có sóng."), kiểu hiển thị mượn storm-banner. (3) TIẾT CHẾ DATA: lib/pretrip-auto.ts shouldAutoPretrip — chỉ tự chạy khi bản cũ hơn PRETRIP_MIN_INTERVAL_MS=6h hoặc chưa có; còn mới/offline → im lặng; 1 lần mỗi lần mở app; mốc ở forfish.pretrip.lastRunAt.v1. lib/pretrip.ts giữ nguyên phần tải (bỏ 2 hàm chữ savedLine/doneLine vì không còn ai hiện). -->
<!-- re-verified: 2026-07-26 — THÊM §10.3 D: một dòng tự ẩn 5s khi bản đồ cá dựng từ ảnh CŨ hoặc thiếu nhiều nguồn (`sources.sst/chl.stale` hoặc `dataQuality < 0,5`). KHÔNG badge thường trực — giữ quyết định 2026-07-25n (màn hình gọn, không hiện tuổi lớp cá); dùng lại đúng chip + NOTIFY_HIDE_MS của mục C, không thêm kiểu mới. Chữ + luật ở lib/source-registry.ts (lowQualityNote, có test từng nhánh). -->
<!-- re-verified: 2026-07-25p — CHẠM ĐIỂM LÚC MẤT SÓNG + notify mất sóng tự ẩn (xem §10.3 C + §10.4; chủ dự án bật chế độ máy bay trên bản production): (1) fetchSeaPoint mất mạng, chỗ chưa từng xem → DỰNG số từ LƯỚI ĐÃ LƯU (loadLongestSavedGrid d16→d7→d3 + nearestGridCell, trần nửa-bước-lưới TỪNG CHIỀU GRID_SNAP_MAX_LAT_DEG≈0,86°/GRID_SNAP_MAX_LON_DEG≈1,06°, xa hơn → giữ nguyên câu "chưa có số nào lưu trong máy"); gộp mốc giờ theo NGÀY lấy gió max + sóng max. Bất biến "KHÔNG mượn số toạ độ khác" giữ nguyên — ô lưới phủ đúng chỗ chạm. (2) TRUNG THỰC: SeaPointDay cho phép score/level/precipMm/wmoCode = null; bản từ lưới KHÔNG chấm điểm đi biển, ẩn chấm tình trạng biển + màu level (về trung tính --field/--navy), ẩn thẻ "Gió/Sóng lúc này" (windKmh null), ẩn mưa/dông; chữ warn "Số gió, sóng lấy từ bản đã lưu trong máy (lưu lúc HH:MM ngày D/M). Chưa có mưa, dông cho chỗ này." (3) Nhắc mất sóng: thẻ vàng 2 dòng thường trực → CHIP 1 dòng "Mất sóng — đang dùng bản đồ lưu trong máy." / "Mạng yếu — …", tự ẩn sau NOTIFY_HIDE_MS=5s (xuất từ pretrip-auto-notify), hiện lại khi trạng thái đổi, không lặp khi vẫn đang mất sóng. -->
<!-- re-verified: 2026-07-26b — THÊM §10.5: bản đồ cá 3 ngày — ĐO TRƯỚC KHI DỰNG rồi KHÔNG DỰNG. scripts/fish-3day-probe.mjs dựng D+1..D+3 bằng neo vệ tinh + xu hướng nhiệt Copernicus (lib/sst-tendency.ts, α cross-validated) trên 3 mùa THẬT: Jaccard(ô≥50) ở D+3 = 0,926 (hè) / 0,982 (đông) / 0,967 (chuyển mùa), ô đổi trạng thái điểm nóng chỉ 0,5–1,6 %, |Δđiểm| trung bình 0,1–0,5 trên thang 100 — KHÔNG mùa nào chạm ngưỡng đặt trước (J<0,90 hoặc ≥5 % ô đổi). ⇒ lớp cá GIỮ MỘT BẢN cho mọi ngày, KHÔNG dựng thanh trượt giả. UI đổi ĐÚNG MỘT CHỖ: trong sheet chạm điểm, khi daysAhead>0 thêm 1 dòng phụ ("Chỗ cá ít đổi trong vài ngày tới — cái đổi là gió, sóng."; >3 ngày đổi giọng "vẫn là ảnh mới nhất, không phải dự báo riêng cho ngày này"). KHÔNG badge thường trực, không chip mới, hôm nay KHÔNG thêm chữ (giữ màn hình gọn 2026-07-25n). Route /api/fish-forecast KHÔNG đổi payload, KHÔNG gọi Copernicus lúc chạy (đo thật cold 3,4 s / 389 KB / 2239 ô / 22,1 % điểm nóng). -->
<!-- re-verified: 2026-07-26c — ĐÍNH CHÍNH câu trên: từ 2026-07-26 route CÓ gọi Copernicus lúc chạy, nhưng cho **DÒNG CHẢY** (`utotal/vtotal`, yếu tố hội tụ `conv`), KHÔNG phải cho lớp NHIỆT của bản đồ 3 ngày — quyết định "không dựng thanh trượt giả" ở §10.5 KHÔNG đổi. UI KHÔNG đụng gì (không màn hình mới, không chữ mới, không badge). Đo API thật sau khi đổi nguồn: cold 4,07 s / ấm 0,88 s / 345 KB / 2237 ô / ô ≥50 514 (494 trước) / dataQuality 1; chặn host Copernicus → vẫn 200 trong 1,17 s, dataQuality 0,95, bản đồ vẫn chạy, không loài nào biến mất. Căn cứ + bảng số: ops/external-services.md + 01-product.md. -->
<!-- re-verified: 2026-07-27 — §10.3 D: BỎ nhánh cảnh báo "thiếu vài nguồn số biển — bản đồ cá có thể chưa sát" (chủ dự án: bà con thấy dữ liệu hiện bình thường mà báo thiếu nguồn = hoang mang vô ích). `lowQualityNote` (lib/source-registry.ts) nay CHỈ còn nhánh ẢNH CŨ (sst/chl.stale); bỏ tham số `dataQuality` khỏi hàm. `dataQuality` + tình trạng thiếu nguồn GIỮ cho /quan-tri (staff), KHÔNG hiển thị cho user. Test source-registry cập nhật (32 pass): thiếu nguồn + ảnh mới → IM LẶNG. LOW_QUALITY_THRESHOLD nay chỉ dùng cho quản trị/test. -->

<!-- re-verified: 2026-07-26e — NÚT "TÔI Ở ĐÂU" (GPS) trên rail bản đồ (user yêu cầu: "thêm cái nút lấy toạ độ của tôi tương tự như các app khác để biết gps vị trí mình đang đứng").
PHÁT HIỆN: `goToMyBoat` trong `fishing-map-view.tsx` ĐÃ CÓ SẴN (lấy GPS → bay tới → set điểm → peek sheet) nhưng **KHÔNG NƠI NÀO GỌI** — code chết, nên app thực tế CHƯA có nút GPS. `locating`/`geoError` cũng khai mà không hiển thị.
NAY: nút trên rail `ra-khoi-controls.tsx`, đặt NGAY DƯỚI nút "Lớp" (chuẩn mọi app bản đồ, chỗ tay phải với tới), LUÔN hiện kể cả khi thu bảng lớp. Ba trạng thái nói thật: "Tôi ở đâu" · "Đang tìm" (disabled + pulse, đừng để bấm hoài) · "Bật GPS" (nền warn — máy từ chối/không có GPS thì PHẢI nói, không được câm). Icon CrosshairIcon, min-h 3.25rem (≥56px tap target).
Ghi chú: `route-planner.tsx` đã dùng định vị cho lựa chọn "Chỗ tàu tôi đang đứng (định vị)" — nút mới dùng CÙNG cơ chế, chỉ khác là xem được vị trí mà KHÔNG cần mở phần dẫn đường.
KIỂM CHẠY THẬT trên trình duyệt: nút hiện đúng vị trí trong rail; bấm với GPS giả (13.9N 109.6E) → bản đồ bay tới, sheet hiện "Toạ độ: 13,90°B · 109,60°Đ", không báo lỗi. -->

<!-- re-verified: 2026-07-26f — DẪN ĐƯỜNG × TIN BÃO (đóng việc "còn treo" của team review dẫn đường 2026-07-26).
LỖ HỔNG: compute() trong route-planner.tsx chỉ nhìn Open-Meteo GFS lưới thô — bão dự báo 24–72h có thể lọt dưới ngưỡng chặn số (sóng <4 m, gió <62 km/h sau nội suy song tuyến; GFS ước non cường độ bão) → tuyến vẽ bình thường không một chữ "bão"; storm-banner lại tự ẩn đúng lúc sheet dẫn đường mở.
NAY: sau khi tính xong tuyến, đối chiếu waypoints (chêm điểm mỗi ~25 km) với tin bão GDACS qua lib/route-storm.ts (routeStormConflict, thuần + test): phạm khi cách tâm bão hoặc HÀNH LANG TRACK DỰ BÁO (từ tâm hiện tại về sau — track quá khứ KHÔNG chặn) dưới 200 km, hoặc nằm trong polygon vùng ảnh hưởng. Phạm → CHẶN HẲN (chốt chủ dự án 2026-07-26: chặn MỌI trường hợp kể cả áp thấp mức watch; bán kính 200 km): không vẽ tuyến, thông báo đỏ "KHÔNG VẼ TUYẾN — đường đi cắt vào vùng nguy hiểm của {loại bão} {TÊN} …" + lời dặn nghe đài; nhiều bão thì nêu con sát tuyến nhất.
GIỚI HẠN NÓI THẬT: GDACS không có mốc giờ từng điểm track → KHÔNG so được ETA từng chặng với vị trí bão theo thời gian — dùng phép kiểm không-thời-gian bảo thủ (thà báo thừa). Mất sóng/chưa hỏi được tin bão → KHÔNG chặn (không có dữ liệu để nói; mảng storms rỗng), lời dặn nghe đài sẵn có vẫn giữ. Cost model route-plan.ts KHÔNG đổi — đây là cổng chặn cộng thêm sau khi plan xong. Dữ liệu bão truyền từ fishing-map-view (mảng storms của useStormCheck, gồm cả tin cũ — thà báo thừa) vào prop storms của RoutePlanner. Test src/lib/__tests__/route-storm.test.ts (11 case: tâm/hành lang/polygon/track quá khứ/chêm điểm/nhiều bão). -->

<!-- re-verified: 2026-07-28 — RAIL + THANH GIỜ MẶC ĐỊNH THU GỌN, TỰ THU 5s (user: "mặc định ẩn đi, click vào xổ ra, nếu ko chọn hay thao tác gì thì 5s tự động ẩn").
ra-khoi-controls.tsx: `collapsed` khởi tạo TRUE (trước false) — mở trang chỉ thấy nút "Lớp" + "Vị trí"; xổ rail thì timer 5s (AUTO_HIDE_MS) tự thu + đóng panel; mọi pointerdown/keydown TRONG rail-panel (capture ở wrapper) + đổi `open` đều nạp lại timer.
fishing-map-view.tsx: `gridStripOpen` khởi tạo FALSE (trước true) — bật lớp gió/sóng chỉ thấy 1 dòng "chạm để chọn giờ"; xổ thanh thì timer 5s (STRIP_AUTO_HIDE_MS) tự thu; nạp lại khi kéo slider/đổi khung ngày/chạm-gõ trong thanh; ĐANG CHẠY ▶ thì KHÔNG tự thu (đang coi, không giật khỏi tay — dừng mới đếm lại). -->

<!-- re-verified: 2026-07-28c — QUY ĐỊNH NHÃN NGANG HÀNG (user chốt, kèm screenshot tab /quan-tri gãy dòng lộn xộn): mọi cụm tab/chip/nút ngang hàng phải CÙNG KHUÔN nhãn — cùng số dòng, cùng biên độ số chữ, chọn TỪ cho vừa khuôn chứ không co giãn khuôn theo từ. Luật đầy đủ ở 03-design-system mục "Nhãn ngang hàng — ĐỒNG BỘ hình dạng". Áp ngay cho /quan-tri: 7 tab bỏ flex-1 → hàng cuộn ngang nowrap (pattern ui/tabs.tsx, >4 tab thì cuộn), nhãn "Cảnh báo TV" → "Thuyền viên" cho đủ khuôn 2 chữ/nhãn (Tài khoản · Thuyền viên · Sản phẩm · Yêu cầu · Thông báo · Dữ liệu · Hệ thống — tất cả 2 chữ 1 dòng). CHƯA đụng dock (nhãn "Tàu" 1 chữ giữa 4 nhãn 2 chữ — cross-trục, chờ user chốt có đổi "Tàu cá" không). -->

<!-- re-verified: 2026-07-28d — USER CHỐT "sửa đi, cho đồng bộ" → MỘT TÊN "Tàu cá" xuyên suốt: dock bottom-nav "Tàu"→"Tàu cá" (5 nhãn đều 2 chữ: Trang chủ · Ra khơi · Tàu cá · Bạn thuyền · Giao dịch); thẻ trục 3 ở Home "Tàu của tôi"→"Tàu cá" (4 thẻ đều 2 chữ); H1 + metadata /tau "Tàu của tôi"→"Tàu cá" (kicker "Quản lý tàu" giữ). Đóng luôn note cũ §9 "khác nhãn dock — cố ý, giữ nguyên" (gạch bỏ tại chỗ) + note review-final #6. Route /tau, BoatSwitcher, tên tàu mặc định lib/boats.ts ("Tàu của tôi" = TÊN CON TÀU của user, không phải nhãn nav) KHÔNG đổi. -->
