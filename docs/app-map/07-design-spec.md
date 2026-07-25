# 07 — DESIGN-SPEC: thang user, screen map, budget, trạng thái

> **Load khi**: task chạm UI / screen / component / flow / style. Đây là chốt chặn của pipeline ui-design-logic — sửa UI thì đọc file này TRƯỚC, đổi hành vi/cấu trúc UI thì cập nhật file này CÙNG COMMIT.

```
covers: src/app, src/components
last_verified: 2026-07-25
ttl_days: 90
gate: warn
```
<!-- gate: warn vì UI churn src/app+src/components cao — cảnh báo thay vì chặn. KHÔNG để comment cùng dòng `gate:` (hook tr -d ' ' giữ lại # → phá so khớp = "warn" → chặn nhầm). -->


Doc này authored bằng tay (reverse-engineer từ code 2026-06-11). Không trộn nội dung token (xem [03-design-system.md](03-design-system.md)) hay route map đầy đủ (xem [02-architecture.md](02-architecture.md)).

---

## 1. Người dùng & nhiệm vụ

- **User chính**: chủ tàu / ngư dân Việt 40–60 tuổi, ít rành công nghệ, đọc ngoài nắng, tay ướt. MỘT vai trò (B2C) — KHÔNG có admin/staff/role, nên không có biến thể theo role, chỉ biến thể theo VÒNG ĐỜI đăng nhập.
- **Job hằng ngày**: trước/trong/sau chuyến biển — coi gió sóng + dự báo cá, giữ giấy tờ khỏi quá hạn, ghi lãi lỗ & chia tiền bạn thuyền, hỏi/được SDVICO hỗ trợ.
- **Platform**: mobile-first tuyệt đối (cột ≤480px, dock nổi). Desktop = cùng cột mobile căn giữa, KHÔNG có layout desktop riêng.
- **Brand**: SDVICO (commissioned). ForFish là kênh CSKH + giá trị vượt trội cho bà con.

## 2. Thang người dùng (3 câu cho từng bậc)

| Bậc | Muốn thấy gì | Sản phẩm truyền tải | Thúc đẩy action tiếp |
|---|---|---|---|
| **Public / chưa đăng nhập** | Dùng được NGAY: giá cá, bản đồ gió sóng, tra phạt, sổ tay (localStorage) | "App này lo được việc của bà con, không cần đăng ký mới xài" | 1 lời mời đăng nhập bằng SĐT — KHÔNG chặn cửa |
| **Đã đăng nhập, chưa khớp đơn SDVICO** (`unlinked`) | Đồ tự ghi + lời mời "mua hàng là đồ tự hiện" | "Tài khoản đã sẵn, mua hàng SDVICO là nối luôn" | Gọi SDVICO tư vấn / mua |
| **Khách SDVICO đã đồng bộ** (`ok`) | Đồ đã mua, bảo hành sắp hết, dịch vụ, **nợ/cước** | "Mọi thứ bà con mua đều theo dõi giúp" | Gọi bảo hành/đóng cước, mua thêm vật tư |

**Quy tắc đã áp dụng:**
- Tối đa **1 nudge đăng nhập/màn**: chip hero "Đăng nhập", thẻ khóa dự báo cá (teaser), gate "Ai cần mua". KHÔNG spam.
- Tính năng KHÓA chỉ gồm: **dự báo cá chi tiết** (heatmap hiện cho mọi người làm mồi, chi tiết điểm mới gate) và **nhu cầu mua cá** (mở public chừng nào còn TIN MẪU). Còn lại public.
- Lỗi đồng bộ KHÔNG được hiện thành "đăng nhập đi" với người đã đăng nhập — `useSdvicoAssets` phân biệt `guest/unlinked/error/ok` (nấc `error` có nút Thử lại).

## 3. Object model

| Object | List | Detail | Form | Màn sinh ra |
|---|---|---|---|---|
| Chuyến biển | sổ lãi/lỗ + báo cáo năm + máy tính tổn | — | drawer (≤5 field) | trong /tien tab Hiệu quả (4 chip: Sổ lãi/lỗ · Báo cáo năm · Tính chuyến · Chia tiền) |
| Bạn thuyền | sổ thuyền viên | sổ ứng (sheet) | drawer | /nguoi |
| Giấy tờ tàu | list | — | drawer | /tau tab Giấy tờ |
| Sản phẩm/Dịch vụ SDVICO | list (sync read-only + tự ghi) | — | drawer (đồ tự ghi) | /tau tab Sản phẩm/Dịch vụ |
| Điểm ngư trường / của tôi | map + sheet | peek sheet | sheet | /ngu-truong |
| Giá cá / Nhu cầu mua | list | — | — | /tien tab Giao dịch |
| Mức phạt | searchable list | — | — | /tau tab Mức phạt |
| Công nợ (chủ nợ) | list theo chủ nợ | sổ vay/trả (sheet) | drawer | /tien tab Công nợ |

→ 8 object. Tạo/sửa đều ≤5 field nên dùng **drawer/bottom-sheet**, KHÔNG đẻ page riêng (quyết định đã chốt).

## 4. Nav model

- **Mobile bottom dock (5)**: Trang chủ · Ra khơi · Tàu · Bạn thuyền · Tiền — đúng trần M3 = 5, taxonomy MECE theo đối tượng. Item ≥3.75rem, icon + chữ.
- **Tab trong page**: /tau = 4 tab (Giấy tờ/Dịch vụ/Sản phẩm/Mức phạt); /tien = 3 tab (Giao dịch/Hiệu quả/Công nợ). Trong tab dùng `ChipRow` (≤3 tier: Tabs → chip1 → chip2). KHÔNG tab lồng tab. Thanh tab **dính (sticky top-0)** có padding-top `+env(safe-area-inset-top)` → khi hero cuộn mất, thanh không chui dưới notch/status bar (edge-to-edge).
- Route phụ (`/cang`, `/login`, `/dang-ky`, `/doi-mat-khau`) vào từ ngữ cảnh, không nằm trên dock. Route cũ (`/gia-ca`, `/giay-to`, `/van-hanh`, `/thuyen-vien`) = redirect 1 dòng sang trục mới.

## 5. Screen map + density budget

| # | Màn | Vào từ | User đến để | Step tiếp mong muốn | Primary | Density |
|---|---|---|---|---|---|---|
| 1 | Trang chủ `/` | dock, login | Coi việc cần làm ngay trong 5 giây | chạm việc khẩn / 1 trong 4 trục | (không — màn điều hướng) | M |
| 2 | Ra khơi `/ngu-truong` | dock | Coi gió sóng + dự báo cá chỗ định đi | dẫn đường / ghim điểm | "Dẫn đường tới chỗ này" | H (map ≥60%) |
| 3 | Tàu `/tau` | dock, nhắc `?tab=` | Coi **đủ điều kiện xuất bến chưa** (đèn xanh-đỏ + **mốc khai báo eCDT/NKKT** đầu tab Giấy tờ) + giữ giấy tờ + đồ SDVICO | xử việc đỏ (thiếu giấy/quá hạn/nợ) | theo tab | M |
| 4 | Bạn thuyền `/nguoi` | dock | Quản hồ sơ + sổ ứng | thêm bạn / gạch nợ | "Thêm bạn thuyền" | M |
| 5 | Tiền `/tien` | dock | Bán có lợi + lãi/lỗ rõ | ghi chuyến / chia tiền | "Ghi chuyến biển mới" | M |
| 6 | Cảng `/cang` | nút trên map | Tìm cảng chỉ định gần | gọi/chỉ đường | (đọc) | M |
| 7 | Đăng nhập `/login` | chip hero, gate | Vào bằng **SĐT + mật khẩu** (sale báo khi mua; KHÔNG email/OTP) | (vào app) | "Đăng nhập" | L |

Mobile M = ≤3 khối/viewport. Home: dải khẩn + lưới 4 trục + tagline = đạt. /tien, /tau, /nguoi: 1 hàng chip/tab + list — đạt.

## 6. Ma trận trạng thái (đã hiện thực)

| Màn | Chưa login | Trống | Lỗi/mạng yếu | Đang tải |
|---|---|---|---|---|
| Ra khơi | dự báo cá teaser + mời; gió sóng public | điểm: "chạm biển để xem" | scalar/lưới/cá: nút **Thử lại** (không hỏng câm) | "Đang lấy dự báo…" |
| Tàu | tab Sản phẩm/Dịch vụ: `guest` mời đăng nhập | "Chưa có … bấm nút cam" | `error` → Thử lại; `unlinked` → giải thích | "Đang kiểm tra đồ SDVICO…" |
| Bạn thuyền | public; sổ MẪU tự xưng "sổ mẫu" | empty + nút cam | — | hydrate sau mount |
| Tiền (Chia) | public | chưa có bạn thuyền → EmptyState + link /nguoi | — | — |
| Đăng nhập | — | — | "Sai số điện thoại hoặc mật khẩu" | nút "Đang vào…" |

## 7. Action → Expectation (đã hiện thực)

| Hành động | Thấy ngay sau đó |
|---|---|
| Ghi chuyến biển | sổ có dòng mới + thẻ "Nhìn nhanh" cập nhật tức thì (một nguồn `trips`) |
| Bấm "Chia tiền" trên thẻ chuyến | sang tab Chia tiền, số đã đổ sẵn (sửa được) |
| Bấm "Hồ sơ chuyến (PDF)" trên thẻ chuyến | mở bản hồ sơ in được (tàu + thu/tổn/lãi + thuyền viên + giấy tờ), nút In/Lưu PDF |
| Bấm "Lặp lại chuyến" trên thẻ chuyến | mở form chuyến MỚI (id mới, ngày hôm nay) prefill số tổn chuyến cũ — chuẩn bị chuyến nhanh, không đè chuyến cũ |
| Xóa điểm ghim / chuyến / sản phẩm | xác nhận inline / ConfirmDialog (KHÔNG xóa 1 chạm) |
| Gạch nợ ứng | ConfirmDialog nêu rõ số tiền |
| Gửi yêu cầu SDVICO | "Đã gửi" + mục "Yêu cầu đã gửi" hiện ngay (optimistic) |
| Đổi điểm xem trên map khi đang có tuyến | tuyến CŨ giữ nguyên + dải nhắc "tới chỗ chạm trước" + Xóa tuyến |
| Đổi tàu (chip BoatSwitcher) | mọi màn đang mở đổi theo tàu đó NGAY, không reload (ba-spec [08](08-ba-spec-da-tau.md) AC-4) |
| Xóa tàu (form Sửa tàu → Xóa tàu này) | ConfirmDialog nêu rõ; giấy tờ/bảo dưỡng/lãi-lỗ của tàu bị xóa, thuyền viên + đồ SDVICO giữ; nhảy sang tàu còn lại. Còn 1 tàu → KHÔNG hiện nút xóa (08 R7) |

## 8. Quyết định đã chốt (không hỏi lại)

- Tạo/sửa mọi object → **drawer/bottom-sheet**, không page riêng. Sheet + ConfirmDialog **PORTAL ra `document.body`** (`createPortal`) → thoát stacking context của tổ tiên (vd wrapper `relative z-10` của BoatSwitcher nhốt sheet z-30 xuống lớp z-10 khiến bottom-nav z-20 đè che nút Lưu/Hủy). Sheet: `max-h-92dvh` cuộn trong, `pb` safe-area; viewport `interactiveWidget: resizes-content` → bàn phím CO layout (không đè) nên nút đáy luôn với tới. Khóa cuộn nền **đếm tham chiếu** (mở sheet-trong-sheet không nhả khóa sớm → nền không trôi sau lưng).
- Cỡ giao diện mặc định **theo máy** (rem); chỉnh tay ("Chữ to"/"Gọn") trong **sheet tài khoản**, không bày toggle ra hero.
- Ngôn ngữ status DUY NHẤT = `StatusBanner`; màu cam-đỏ ĐỘC QUYỀN cho ranh giới biển trên map.
- Demo/sổ mẫu KHÔNG ghi xuống máy, KHÔNG lọt vào dải nhắc khẩn.
- Visual "international" (font Plus Jakarta Sans + Archivo) nhưng COPY tiếng Việt đời thường.

## 9. Trạng thái audit ui-design-logic (2026-06-11)

- **Contrast AA**: đã quét computed-style 6 màn (home, /ngu-truong, /tau, /nguoi, /tien, /login, /cang) → **0 lỗi <4.5:1**. Sàn neutral text = `/65`; accent text/fill kiểm cả 2 chiều (t3 đậm về `#8f6010`).
- **`tabular-nums`**: đã phủ MỌI cột/figure số: giá cá, chia tiền (per-member), sổ lãi/lỗ, sổ ứng (lịch sử + tổng), nhìn nhanh, thẻ tổng quan bạn thuyền (3 ô), cột điểm + sóng/gió `sea-forecast`.
- Tên trục ở Home ("Tàu của tôi", "Sổ tiền") khác nhãn dock ("Tàu", "Tiền") — cố ý (dock cần ngắn), giữ nguyên.
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

**RAIL PHẢI — thanh điều khiển = 6 nút (mỗi nút mở 1 panel):**
| Nhóm | Panel chứa |
|---|---|
| **Hải đồ** | Lớp nền bản đồ (chọn-1: Hải đồ độ sâu / Nước nóng-lạnh / Nhiều mồi / Ảnh mây) + nhịp + nhãn dải + note "ảnh vệ tinh trễ ~2 ngày · phao chỉ hiện khi zoom gần bờ" |
| **Ngư trường** | Dự báo cá PFZ (bật/tắt) + nhịp · **chọn loài** (drill-down) · **dải lọc khả năng có cá (kéo 2 đầu)** · note "heatmap public, chi tiết cần đăng nhập" — chưa đăng nhập thì ẩn picker+dải, chỉ 1 CTA đăng nhập |
| **Thời tiết** | Lớp gió/sóng + scalar (nước dâng/xoáy) + nhịp · note "tham khảo, lỗi thì thử lại" |
| **Điểm đã lưu** | Bật/tắt hiện điểm trên map + quản lý điểm (thêm theo toạ độ, sửa/xoá, tìm cảng) ngay trong panel |
| **Công cụ** | **Đo khoảng cách 2 điểm** — bật chế độ đo, chạm 2 điểm trên map → đường nối + mốc 1/2 + kết quả (khoảng cách đường chim bay + hướng) theo đơn vị đang chọn; "Xoá, đo lại" |
| **Cài đặt** | **Đơn vị khoảng cách** (Hải lý/km) + **Hệ toạ độ** (độ thập phân / độ-phút) — đổi thì MỌI chỗ (peek toạ độ, whereLine, điểm cá gần, dẫn đường, công cụ đo) đổi theo. Store dùng chung `lib/map-prefs.ts` (localStorage `forfish.mapPrefs.v1`) |

**TRÊN:** banner bão (đỏ, ưu tiên) + **dải dự báo gió/sóng 1–16 ngày** (chip ngày cuộn ngang, `FORECAST_MAX_DAYS=16`; sóng từ `ncep_gfswave025`). Dưới dải: **dòng độ tin theo tầm ngày** (`forecastConfidence(dayIdx, skillConf)`) — hạ nhãn khi backtest (`forecast-skill.json`) đo được sai số lớn ở tầm ngày đó; KHÔNG để mọi ngày trông chắc như nhau.
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
  · Chọn loài = drill-down trong panel **Ngư trường** (nút "Chọn loài" → list loài 1 cột + nút quay lại). 
  · Quản lý điểm = nội dung panel **Điểm đã lưu** luôn (toggle hiện-trên-map + thêm theo toạ độ + sửa/xoá compact + tìm cảng) — bỏ nút "Quản lý" mở modal. 
  · Tách thân `FishSpeciesContent` / `MyPlacesContent` dùng chung (panel + wrapper bottom-sheet legacy). Nút "Sửa" ở thẻ "Đã ghim" trong sheet → đổi thành chỉ dẫn "Sửa ở Điểm đã lưu".

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
<!-- re-verified: 2026-07-25b — api/fish-forecast route thêm fetch ETOPO (cổng độ sâu chặn loài xa bờ). BACKEND-only: không đổi màn hình/mật độ/trạng thái nào; lớp cá trên map chỉ bớt điểm nóng sát bờ cho loài xa bờ. -->
<!-- re-verified: 2026-07-25c — THÊM lớp map "Ranh giới vùng lộng" (NĐ 26/2019, polygon 36 đỉnh SDVico): nét đứt teal #0d9488 + fill mờ 6%, vẽ TRƯỚC ranh giới ngoài (cam-đỏ IUU vẫn nổi trên, GIỮ độc quyền màu). Toggle bật/tắt trong panel CÀI ĐẶT (mục "Lớp bản đồ") + nhãn THAM KHẢO "tra Chi cục Thủy sản". Mặc định bật. (chuyển từ Thời tiết → Cài đặt theo user 2026-07-25) -->
<!-- re-verified: 2026-07-25d — badge lớp nền Hải đồ BỎ "Ảnh {ngày} · chậm ~2 ngày" (user: không cần), chỉ còn "Theo ngày". Giữ 1 dòng ghi chú chung "Ảnh vệ tinh trễ ~2 ngày" ở chân panel. -->
<!-- re-verified: 2026-07-25e — dải lọc khả năng có cá SÀN 50 (trước 35, user: dưới 50 làm nhiễu): default fishRange [50,100], hard-floor Math.max(50,…) áp cả "Mọi loài" lẫn theo loài, RangeBand min=50. Lõi PFZ vẫn tính ≥35 (chỉ lọc HIỂN THỊ ở client). -->
<!-- re-verified: 2026-06-23h — rail 4→6 nút: thêm Công cụ (đo khoảng cách 2 điểm, vẽ đường+mốc trên map, kết quả theo đơn vị) + Cài đặt (đơn vị hải lý/km + hệ toạ độ dd/dms qua lib/map-prefs store dùng chung; đổi thì peek/whereLine/điểm-cá-gần/dẫn-đường/đo đổi theo). Icons SettingsIcon/RulerIcon. Test map-prefs.test.ts -->
<!-- re-verified: 2026-06-23i — công cụ đo: thêm nhãn khoảng cách NGAY GIỮA đường nối 1→2 trên bản đồ (marker midpoint) -->
<!-- re-verified: 2026-06-16 — /login = SĐT + mật khẩu (webhook provision, KHÔNG email/OTP); nav/screen map/object model không đổi -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): thêm lớp BÃO trên map (vùng ảnh hưởng polygon đỏ mờ + đường đi track gạch đứt, dưới Marker tâm bão) từ GDACS; + fix dự báo cá maxDuration/ISR. Screen map/nav/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): legend cá thành BỘ LỌC kéo-thả 2 đầu (chỉ hiện ô [lo,hi]% khả năng có cá). Độ sâu raster KHÔNG lọc được (giữ legend tĩnh). Screen map/object model KHÔNG đổi cấu trúc -->
