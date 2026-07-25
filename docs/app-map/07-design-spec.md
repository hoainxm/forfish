# 07 — DESIGN-SPEC: thang user, screen map, budget, trạng thái

> **Load khi**: task chạm UI / screen / component / flow / style. Đây là chốt chặn của pipeline ui-design-logic — sửa UI thì đọc file này TRƯỚC, đổi hành vi/cấu trúc UI thì cập nhật file này CÙNG COMMIT.

```
covers: src/app, src/components
last_verified: 2026-06-29
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
| **Public / chưa đăng nhập** | Dùng được NGAY các mục THAM KHẢO: giá cá, bản đồ gió sóng, dự báo cá teaser, **tra mức phạt** | "App này lo được việc của bà con, xem thông tin không cần đăng ký" | 1 lời mời đăng nhập bằng SĐT — data cá nhân mới khóa |
| **Đã đăng nhập, chưa khớp đơn SDVICO** (`unlinked`) | Đồ tự ghi + lời mời "mua hàng là đồ tự hiện" | "Tài khoản đã sẵn, mua hàng SDVICO là nối luôn" | Gọi SDVICO tư vấn / mua |
| **Khách SDVICO đã đồng bộ** (`ok`) | Đồ đã mua, bảo hành sắp hết, dịch vụ, **nợ/cước** | "Mọi thứ bà con mua đều theo dõi giúp" | Gọi bảo hành/đóng cước, mua thêm vật tư |

**Quy tắc đã áp dụng:**
- Tối đa **1 nudge đăng nhập/màn**: chip hero "Đăng nhập", thẻ khóa dự báo cá (teaser), gate "Ai cần mua". KHÔNG spam.
- **Khóa đăng nhập (sửa 2026-07-02)**: MỌI chức năng lưu DATA CÁ NHÂN yêu cầu đăng nhập (LoginGate) — /tau tab Giấy tờ + Dịch vụ (gồm nhắc bảo dưỡng) + Sản phẩm, thông tin tàu (BoatSwitcher), /tien tab Hiệu quả (sổ lãi lỗ) + Công nợ, /nguoi (thuyền viên). Lý do: data giả/localStorage chung máy gây hiểu nhầm "dùng chung" (bug bà con báo). Vẫn PUBLIC (tham khảo, không data cá nhân): giá cá + giá dầu (/tien Giao dịch), **tra mức phạt** (/tau Mức phạt), bản đồ gió sóng + dự báo cá teaser (/ngu-truong), nhu cầu mua cá (buy-board tự gate riêng).
- **KHÔNG seed demo (sửa 2026-07-02)**: bỏ hết `demoDocuments/demoBoats/demoCrew/demoDebts/demoProducts` khỏi luồng load — user mới thấy màn TRỐNG "chưa có, bấm thêm", không thấy giấy tờ/tàu giả. (Hàm demo* còn trong lib cho test, không gọi trong UI.)
- Lỗi đồng bộ KHÔNG được hiện thành "đăng nhập đi" với người đã đăng nhập — `useSdvicoAssets` phân biệt `guest/unlinked/error/ok` (nấc `error` có nút Thử lại).

## 3. Object model

| Object | List | Detail | Form | Màn sinh ra |
|---|---|---|---|---|
| Chuyến biển | sổ lãi/lỗ + báo cáo năm + máy tính tổn | — | drawer (≤5 field) | trong /tien tab Hiệu quả (4 chip: Sổ lãi/lỗ · Báo cáo năm · Tính chuyến · Chia tiền) |
| Bạn thuyền | sổ thuyền viên | sổ ứng + **hồ sơ chi tiết** (sheet, chạm tên) | drawer (gồm SĐT + **CCCD 12 số**) | /nguoi |
| Giấy tờ tàu | list | — | drawer | /tau tab Giấy tờ |
| Sản phẩm/Dịch vụ SDVICO | list (sync read-only + tự ghi) | — | drawer (đồ tự ghi) | /tau tab Sản phẩm/Dịch vụ |
| Điểm ngư trường / của tôi | map + sheet | peek sheet | sheet | /ngu-truong |
| Giá cá / Nhu cầu mua | list | — | — | /tien tab Giao dịch |
| Mức phạt | searchable list (xếp **nặng → nhẹ** theo cận trên `rangeVnd`, `lib/fines.ts`) | — | — | /tau tab Mức phạt |
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
| 8 | Sách hướng dẫn `/huong-dan.html` | nút "Hướng dẫn" (bước cuối), sheet Tài khoản | Đọc/in hướng dẫn đầy đủ từng màn từng nút | quay lại app | (đọc) | — (trang tĩnh, không dock) |

Mobile M = ≤3 khối/viewport. Home: dải khẩn + lưới 4 trục + tagline = đạt. /tien, /tau, /nguoi: 1 hàng chip/tab + list — đạt.

## 6. Ma trận trạng thái (đã hiện thực)

| Màn | Chưa login | Trống | Lỗi/mạng yếu | Đang tải |
|---|---|---|---|---|
| Ra khơi | dự báo cá teaser + mời; gió sóng public | điểm: "chạm biển để xem" | scalar/lưới/cá: nút **Thử lại** (không hỏng câm) | "Đang lấy dự báo…" |
| Tàu | tab Giấy tờ/Dịch vụ/Sản phẩm: **LoginGate** thẻ khóa + mời đăng nhập (Mức phạt vẫn public) | đã login, chưa có: "Chưa có … bấm nút cam"; chưa có tàu → nút "Thêm tàu của bạn" | `error` → Thử lại; `unlinked` → giải thích | "Đang kiểm tra đồ SDVICO…" |
| Bạn thuyền | **LoginGate** thẻ khóa (data cá nhân) | đã login, chưa có: empty + nút cam | — | hydrate sau mount |
| Tiền | Giao dịch (giá cá) public; **Hiệu quả + Công nợ: LoginGate** | đã login, chưa có → EmptyState | — | — |
| Đăng nhập | — | — | "Sai số điện thoại hoặc mật khẩu" | nút "Đang vào…" |

**Ô mật khẩu (`PasswordField`)**: nút Hiện/Ẩn đổi `type` password↔text. Ở trạng thái `text`, iOS/iPadOS tự viết hoa chữ đầu + tự sửa chính tả → mật khẩu gõ đúng vẫn báo sai. Bắt buộc `autoCapitalize="none" autoCorrect="off" spellCheck={false}` cho cả hai trạng thái (Apple App Review từ chối 2026-07-17 Guideline 2.1 — reviewer không đăng nhập được, máy iPad Air 11" M3).

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
- **Sheet Tài khoản hiện DANH TÍNH đầy đủ (2026-07-21)**: tên KH lấy `OwnedAssets.customerName` (bảng `customers` từ CRM) ưu tiên trước `user_metadata.full_name` — webhook provision không set metadata nên trước đây đa số chỉ thấy SĐT. Thẻ danh tính (`hero-account.tsx`) gồm: tên KH trơn (1.25rem, ẩn khi chưa có tên) — **KHÔNG thêm kính ngữ "Bác"** (data không có giới tính/tuổi + nhiều "tên" là tổ chức: đại lý/xí nghiệp/ghe → "Bác {tên công ty}" sai; danh tính ấm áp để pill lo) · **SĐT LUÔN hiện** kèm `PhoneIcon` (khi thiếu tên thì SĐT là danh tính chính, cỡ to hơn) · pill **"Khách hàng SDVICO"** (mọi tài khoản đều từ SDWork — cho danh tính đầy khi hồ sơ mỏng) · dòng **"Đang quản lý N tàu"** (`AnchorIcon`, ← `useBoats` localStorage) + **"Đã mua N thiết bị SDVICO"** (link `/tau?tab=san-pham`) trong khối phân cách, mỗi dòng ẩn khi đếm = 0. Logic thuần `lib/account-display.ts` (test): làm sạch tên rác CRM (`\r\n`), fallback metadata, `deviceCountLine`/`boatCountLine` ẩn khi 0. Nguyên tắc: KHÔNG bao giờ chỉ trơ SĐT — luôn có ≥ SĐT + nhãn khách hàng.
- Ngôn ngữ status DUY NHẤT = `StatusBanner`; màu cam-đỏ ĐỘC QUYỀN cho ranh giới biển trên map.
- **KHÔNG còn demo/sổ mẫu trong UI (2026-07-02)**: các hàm load trả rỗng khi chưa có data thật; data cá nhân khóa sau đăng nhập (xem §2). Trước đây seed demo tự-xưng-mẫu — bỏ vì gây hiểu nhầm "data dùng chung".
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

**TRÊN:** banner bão (đỏ, ưu tiên) + **dải dự báo gió/sóng 6 ngày** (tab ngày).
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

## 12. HƯỚNG DẪN SỬ DỤNG — coach-mark trên màn + sách HTML (2026-07-24)

Trước đó app KHÔNG có hướng dẫn nào (không route help, không tour, không tooltip). Bổ sung **hai lớp**, cùng một nội dung nói theo hai kiểu:

| Lớp | Ở đâu | Dùng khi |
|---|---|---|
| **Chỉ trên màn hình** (coach-mark) | `ui/coach-tour.tsx` + `tour-launcher.tsx` (mount 1 lần trong `layout.tsx`), nội dung `lib/tour.ts` | đang đứng trong app, hỏi "nút này làm gì" |
| **Sách hướng dẫn CÓ ẢNH** | `public/huong-dan.html` + `public/huong-dan/*.webp` — **SINH BẰNG MÁY**, `npm run guide` | đọc trước/ngoài app, **in ra giấy phát cho bà con**, gửi Zalo |

**Sách có ảnh = ảnh chụp THẬT của app, đánh số lên từng nút** (2026-07-24, user chốt: "hướng dẫn đi kèm hình ảnh của hệ thống, từng màn hình có nút chức năng gì thì mô tả"). 12 màn · 45 nút được đánh số.

- `npm run guide` (cần `npm run dev` đang chạy) → `scripts/build-guide.mjs` mở Chrome ẩn, chụp từng màn ở 390×844 (dsf 2), **đo vị trí thật của từng nút** rồi sinh HTML với số vẽ đè lên đúng chỗ + bảng "số → nút → làm gì". Lời nằm ở `scripts/guide-content.mjs`, KHÔNG sửa tay `huong-dan.html` (file sinh).
- Đo và chụp phải CÙNG một khung: script phóng viewport cao bằng cả trang rồi mới chụp, KHÔNG dùng `fullPage` — dock/`position:fixed` bị trình duyệt dựng ở đáy ảnh dài, số sẽ lệch khỏi nút (đã dính, đã sửa).
- **Màn khoá sau đăng nhập** (Giấy tờ · Dịch vụ · Bạn thuyền · Hiệu quả · Công nợ) chụp bằng **phiên giả đặt ngay trong trình duyệt chụp** (cookie phiên giả + chặn lời gọi `auth/v1/user` và `/api/me/sdvico` trả người dùng mẫu). KHÔNG tài khoản thật, KHÔNG sửa code auth, không có gì lọt vào bản chạy thật. Dữ liệu mẫu (tàu/giấy tờ/thuyền viên/chuyến/công nợ) bơm vào localStorage — shape PHẢI khớp type thật, sai một field là màn trắng lúc chụp.
- Nút nào đổi chữ → script báo "KHÔNG THẤY" kèm danh sách nhãn đang có trên màn, sửa `guide-content.mjs` cho khớp rồi chạy lại. Không bao giờ vẽ số vào chỗ trống.
- Ảnh xuất **WebP q80** (~1,6 MB cả bộ; PNG là 5,7 MB — nặng cho repo + cache offline PWA).
- Chạy lại sau MỌI thay đổi UI đáng kể, nếu không sách sẽ mô tả nút đã đổi.

**Quy tắc coach-mark (đã hiện thực):**
- **Chỉ NÚT CHÍNH mỗi màn, trần 6 bước/màn** (test `tour.test.ts` chặn). Tour dài thì bà con 40–60 tuổi bỏ giữa chừng → hướng dẫn thành vô dụng. Không phải mọi nút đều được chỉ.
- Nút được chỉ đánh dấu bằng `data-tour="<id>"` trong JSX. Neo hiện có: `tai-khoan` (hero-account) · `chon-tau` (boat-switcher) · `nhac-viec` (urgent-strip) · `bon-viec` (lưới 4 trục Home) · `dock` (bottom-nav) · `tab-<id>` (**tự sinh trong `ui/tabs.tsx`** — thêm tab mới là có neo, không phải sửa gì) · `rail` (ra-khoi-controls) · `sheet-day` (snap-sheet) · `them-thuyen-vien` (crew-list).
- **Không bao giờ chỉ vào chỗ trống**: bước nào không tìm thấy nút thì bỏ (`visibleSteps`). Màn có nút để chỉ mà bị **LoginGate che sạch** (vd /nguoi chưa đăng nhập) thì KHÔNG chạy tour và **ẩn luôn nút "Hướng dẫn"** (`runnableSteps`) — không chỉ dẫn về thứ bà con đang không nhìn thấy.
- **Tự chạy lần đầu mỗi màn**, sau đó im. Ghi `forfish.tour.v1` (mảng id tour đã xem) — đây là **UI pref, KHÔNG scope theo user**, cùng nhóm `displaymode/maplayer` trong `USER_SCOPED_KEYS` bên [02 §4](02-architecture.md).
- **Thẻ luôn nằm trọn trong màn**: đo chiều cao THẬT của thẻ (ResizeObserver) rồi đặt dưới nút → trên nút → ép sát đáy. Ước lượng cứng làm nút "Tiếp" bị cắt khi nút được chỉ cao (lưới 4 ô Home cao 336px) — đã dính, đã sửa.
- Bố cục thẻ: "màn · bước i/n" + tiêu đề + 1 câu việc-làm-được + [Quay lại] [Tiếp/Xong] ≥3.5rem + nút Bỏ qua (×). **Bước CUỐI** thêm 1 dòng dưới nút Xong: **"Tắt hướng dẫn, không hiện nữa"** (xem xong tắt hẳn ngay tại chỗ — `onDisable` = `setTourEnabled(false)`, ẩn nút nổi + ngừng tự chạy). `onDisable` là prop tùy chọn của `CoachTour`; TourLauncher truyền vào. **Giữ gọn — chỉ 2 đường tắt** (nút bước cuối + công tắc Cài đặt); KHÔNG bày thêm "Xem hướng dẫn đầy đủ" trong app hay nhấn-giữ (user 2026-07-25: 3 nút là thừa).
- Đường vào lại: nút nổi **"Hướng dẫn"** + sheet Tài khoản mục "Hướng dẫn dùng app" có: **công tắc "Chỉ dẫn trên màn hình"** (bật/tắt) và "Chỉ lại từ đầu trên màn hình" (`resetTours`).
- **Công tắc TỔNG bật/tắt chỉ dẫn trên màn** (sheet Tài khoản, key `forfish.tour.enabled.v1`, vắng=bật): bà con đã quen app thì **tắt cho gọn** → ẩn nút nổi "Hướng dẫn" VÀ không tự chạy coach-tour ở mọi màn; bật lại thì trở về như cũ. Launcher đổi NGAY trong tab qua sự kiện `TOUR_ENABLED_EVENT` (không đợi reload). Khi tắt: ẩn luôn hàng "Chỉ lại từ đầu" (vô nghĩa lúc đang tắt). Là UI pref chung máy như `displaymode` — [02 §4](02-architecture.md).
- **Vị trí nút "Hướng dẫn" theo màn**: mặc định góc TRÁI DƯỚI, trên dock. **Riêng `/ngu-truong` lên góc TRÁI TRÊN** (dưới dải tin bão, ngang hàng rail) — ở đáy nó che mất dòng "Sóng … · Gió cấp …" của sheet peek, mép phải thì đụng rail 6 nút. Bắt được nhờ đọc chính ảnh chụp sinh ra cho sách.
- **Đo lại nhiều lần, không hụt trên máy chậm**: nút chỉ hiện khi màn có neo `data-tour` thật (`runnableSteps`). Đo DOM một lần ở 900ms thì máy yếu / bản đồ MapLibre nạp trễ đo trượt → `available` kẹt false MÃI, nút "Hướng dẫn" biến mất hẳn (đúng lỗi báo "mobile nhiều nơi không thấy nút", 2026-07-25). Sửa: dò lại theo mốc tăng dần 300→4500ms, thấy neo thì bật nút và dừng dò; tự chạy tour chỉ ở lần dò thành công đầu.
- **Nút bám cột app 480px, không dính mép viewport**: `left: max(0.75rem, calc(50% - 240px + 0.75rem))` — mobile ≤480 vẫn 12px như cũ; màn rộng/tablet nút theo cột thay vì trôi ra lề xám tách khỏi app.

**Sách HTML**: không phông/mã ngoài, ảnh là file cùng thư mục → mở được khi mất mạng, có `@media print` (nền trắng, khung không bị cắt ngang trang). Sửa lời sách ở `guide-content.mjs` thì soát lại `lib/tour.ts` cho khớp, và ngược lại.

**KHÔNG có nút "Xem hướng dẫn đầy đủ" trong app** (bỏ 2026-07-25, user: không cần thiết). Sách `public/huong-dan.html` vẫn sinh + giữ như tài liệu ĐỘC LẬP — in giấy phát bà con / gửi Zalo / mở trực tiếp URL, KHÔNG link từ app. Nếu sau này thêm lại nút mở trong app: nhớ bẫy native (`target=_blank` đẩy ra trình duyệt ngoài không với tới `capacitor://localhost` → trang trắng; mở iframe cùng webview thay vì tab).

---

**Last updated**: 2026-07-24
<!-- re-verified: 2026-06-11 — screen map khớp routes; contrast AA pass home/nguoi/tau (eval) -->
<!-- re-verified: 2026-06-15 — thêm /tien Báo cáo năm/Tính chuyến/Công nợ + /tau checklist xuất bến + hồ sơ/lặp lại chuyến; fix layout suppressHydrationWarning không đổi screen spec -->
<!-- re-verified: 2026-06-15 — triage full-sweep; fixed demo-persist §8 (doc-vault/maint/products) + title grammar /tau; contrast/tabular re-confirmed 06-11 -->
<!-- re-verified: 2026-06-15 — boat-store refactor (08) nội bộ (useBoats → store dùng chung, đổi tàu cập nhật live) — KHÔNG đổi screen map/state matrix -->
<!-- re-verified: 2026-06-15 — build đa tàu: chip BoatSwitcher trên /tien (lãi-lỗ theo tàu) + crew owner-scope (§5 +chip); action→expectation Đổi tàu / Xóa tàu (§7); còn lại screen map không đổi -->
<!-- re-verified: 2026-06-15 — build đa tàu 4-5/5: dải nhắc Home gắn nhãn tàu mỗi việc khi >1 tàu (urgent-strip), /tau Sản phẩm có sheet "Đồ này của tàu nào?" (gán hàng SDVICO) — còn lại không đổi -->
<!-- re-verified: 2026-06-16 — rebrand ForFish→SDFish (chỉ string brand) + PWA (manifest/SW/icons) + api-base indirection; screen map/nav/object model KHÔNG đổi -->
<!-- re-verified: 2026-06-29 — đổi logo brand (icon app/PWA/favicon, nguồn logo-src.png); chỉ asset icon, screen map/nav/flow/density/trạng thái UI KHÔNG đổi -->
<!-- re-verified: 2026-06-16 — native UI polish: edge-to-edge safe-area, motion điềm đạm (sheet/dialog vào-ra, tab cross-fade), tap-target Tabs/SnapSheet→56; screen map/nav/density/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-06-23 — Ra khơi feedback: rail panel cân đối + nhãn rút gọn; sheet đáy vuốt (bỏ nút Xem thêm/Thu gọn); banner bão thu/mở; sóng-gió liền mạch; bỏ hàng GPS ở Điểm; BottomSheet cap 85dvh (xem §10 delta 2026-06-23) -->
<!-- re-verified: 2026-06-23b — Chọn loài + Điểm đã lưu chuyển từ bottom-sheet modal sang PANEL RAIL (drill-down Ngư trường / nội dung Điểm); FishSpeciesContent + MyPlacesContent tách dùng chung -->
<!-- re-verified: 2026-06-23c — sheet: mưa/dông + độ tin dời lên LIỀN sóng/gió; thanh giờ Windy (gió/sóng) cho thu/mở (chip "chạm để chọn giờ") -->
<!-- re-verified: 2026-06-23d — bỏ nút "Về cảng nhà" ở sheet (vô tác dụng); kéo sheet info lên (half/full) TỰ ẨN tin bão + rail phải (opacity+pointer-events) cho khỏi chồng chéo, về peek hiện lại — logic tự ẩn, không bắt click -->
<!-- re-verified: 2026-06-23e — login-gate ĐỒNG BỘ: panel Ngư trường khi chưa đăng nhập → ẩn picker loài + dải khả năng, chỉ 1 CTA "Đăng nhập để chọn loài & xem khả năng" (khớp gate ở sheet); toạ độ điểm đang xem dời lên PEEK (luôn thấy), bỏ bản trùng cuối sheet -->
<!-- re-verified: 2026-06-23f — sheet: tap nở dần peek→half→full, ở full tap lần nữa thu về peek (không còn tap vô tác dụng); banner bão overlay tự thu thành chip sau 3s kể từ lúc check bão về (refresh/back lại map), chạm mở lại -->
<!-- re-verified: 2026-06-23g — panel rail width theo nội dung: Điểm đã lưu + Chọn loài rộng w-22rem (max calc(100vw-4.25rem)) cho khỏi chồng chéo/dễ nhìn; panel đơn giản (Hải đồ/Thời tiết/Ngư trường-menu) giữ w-16.5rem cân đối -->
<!-- re-verified: 2026-06-23h — rail 4→6 nút: thêm Công cụ (đo khoảng cách 2 điểm, vẽ đường+mốc trên map, kết quả theo đơn vị) + Cài đặt (đơn vị hải lý/km + hệ toạ độ dd/dms qua lib/map-prefs store dùng chung; đổi thì peek/whereLine/điểm-cá-gần/dẫn-đường/đo đổi theo). Icons SettingsIcon/RulerIcon. Test map-prefs.test.ts -->
<!-- re-verified: 2026-06-23i — công cụ đo: thêm nhãn khoảng cách NGAY GIỮA đường nối 1→2 trên bản đồ (marker midpoint) -->
<!-- re-verified: 2026-06-16 — /login = SĐT + mật khẩu (webhook provision, KHÔNG email/OTP); nav/screen map/object model không đổi -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): thêm lớp BÃO trên map (vùng ảnh hưởng polygon đỏ mờ + đường đi track gạch đứt, dưới Marker tâm bão) từ GDACS; + fix dự báo cá maxDuration/ISR. Screen map/nav/object model KHÔNG đổi cấu trúc -->
<!-- re-verified: 2026-06-16 — Ra khơi (#2): legend cá thành BỘ LỌC kéo-thả 2 đầu (chỉ hiện ô [lo,hi]% khả năng có cá). Độ sâu raster KHÔNG lọc được (giữ legend tĩnh). Screen map/object model KHÔNG đổi cấu trúc -->
