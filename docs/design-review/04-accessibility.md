# 04 — Soát xét Khả năng tiếp cận (Accessibility)

**Chuẩn:** WCAG 2.1 AA + Vercel Web Interface Guidelines
**Đối tượng:** ngư dân 40–60 tuổi, ít quen công nghệ, dùng ngoài nắng gắt, tay ướt
**Phạm vi:** `globals.css`, `layout.tsx`, `bottom-nav.tsx` + 11 component tương tác
**Ngày:** 2026-06-10 · Chỉ đọc mã, không sửa `src/`

> Ghi chú đo độ tương phản: tất cả tỉ lệ tính theo WCAG. Ngưỡng chữ thường = 4.5:1; chữ lớn (≥18.66px **đậm** hoặc ≥24px thường) = 3:1; thành phần UI/đồ hoạa = 3:1. Với người dùng ngoài nắng, nên **nhắm tới AAA (7:1) nơi khả thi** — báo cáo này đánh dấu chỗ chỉ vừa đạt AA là rủi ro.

---

## Tóm tắt

| Mức | Số phát hiện |
|---|---|
| 🔴 Chặn (Blocker) | 4 |
| 🟠 Cao (High) | 6 |
| 🟡 Trung bình (Medium) | 7 |
| 🟢 Thấp (Low) | 5 |

**Điểm sáng đã làm tốt:** trạng thái luôn kèm **icon + chữ** (không chỉ màu) ở các banner giấy tờ/thuyền viên/bảo dưỡng và xu hướng giá; tap target chính ≥56–64px; `inputMode` đã đặt cho ô số/điện thoại; font nền 18px; `aria-current` trên nav; hydrate localStorage sau khi mount; `lang="vi"`; `Intl.*` cho ngày/số.

---

## 🔴 CHẶN — phải sửa trước khi giao

### B1. `maximumScale: 1` chặn người dùng phóng to — vi phạm nặng nhất với nhóm này
**File:** `src/app/layout.tsx:29` (`maximumScale: 1`)
**WCAG 1.4.4 (Resize text) + 1.4.10** · Anti-pattern Vercel (`maximum-scale=1` disabling zoom)
Người 40–60 tuổi mắt kém, ngoài nắng — chặn pinch-zoom là rào cản trực tiếp. iOS/Android sẽ không cho phóng to.
**Sửa:** bỏ `maximumScale: 1`. Chỉ giữ `width: "device-width", initialScale: 1`. Không bao giờ giới hạn `maximumScale` hay `userScalable`.

### B2. Chữ xám nhạt trên nền sáng không đạt tương phản — đầy khắp app
**WCAG 1.4.3 (Contrast)**. Đo thực tế trên nền sand `#faf5ec` / card `#fff` với `--foreground #1c2b36`:

| Lớp opacity | Trên sand | Trên card | Đạt AA chữ thường (4.5)? |
|---|---|---|---|
| `text-foreground/40` | 2.31 | 2.35 | ❌ |
| `text-foreground/45` | 2.62 | 2.65 | ❌ |
| `text-foreground/50` | 2.98 | 3.04 | ❌ |
| `text-foreground/55` | 3.40 | 3.51 | ❌ |
| `text-foreground/60` | 3.91 | 4.03 | ❌ (gần đạt) |
| `text-foreground/65` | 4.52 | 4.71 | ✅ vừa đủ |
| `text-foreground/70` | 5.24 | 5.46 | ✅ |

Các chỗ dùng `/40`–`/60` cho chữ có nghĩa (không phải trang trí):
- `bottom-nav.tsx:46,53` — tab **không active** dùng `text-foreground/45` (2.62). Đây là điều hướng chính, phải đọc được. 🔴
- `document-vault.tsx:143` `crew-list.tsx:199` `maintenance-reminders.tsx` — nhãn loại in hoa `text-foreground/40` (2.31).
- `document-vault.tsx:105,150,155,160,190` và tương tự ở mọi list: chú thích `text-foreground/60`, `/70` (số giấy, hết hạn, ghi chú).
- `crew-list.tsx:140,148,154` — nhãn thẻ tổng quan `text-foreground/55` (3.40).
- `price-board.tsx:103` `supply-catalog.tsx:84,93,99` — spec/đơn vị/ghi chú `text-foreground/55,60`.
- `trip-log.tsx:129,139,186,203` — nhãn “Lãi … gần nhất”, “Về bờ …” `text-foreground/55`.
- `fishing-map-view.tsx:365,432,459,475,481,507` — toạ độ, “/100 điểm”, chi tiết gió sóng `/55,/65,/75`.

**Sửa:** nâng sàn opacity cho mọi chữ mang thông tin lên **tối thiểu `/70`** (≥5.2:1, hướng AAA). Chữ nhỏ phụ (≤14px) nên dùng `/75`. Trang trí thuần (icon rỗng empty-state `/30`) thì giữ được. Cân nhắc tạo token `--muted: #4a5963` thay cho opacity để kiểm soát chính xác.

### B3. Nhãn cảnh báo màu vàng (warn) không đạt tương phản trên nền vàng nhạt
**File:** mọi banner trạng thái “soon/caution” + disclaimer:
`document-vault.tsx:120,135` · `crew-list.tsx:70,191` · `maintenance-reminders.tsx:212,221` · `sea-forecast.tsx:25,134` · `price-board.tsx:52` · `trip-split.tsx:83` · `route-planner.tsx:362`
**WCAG 1.4.3**. `--warn #a36a00` trên `--warn-bg #ffeec2` = **3.95:1**. Chữ banner là `text-[16px] font-bold` = **chữ thường** (16px<18.66px) → cần 4.5. **Không đạt.** Đây là cảnh báo an toàn ("sắp hết hạn", "biển nên cẩn thận") — đọc khó dưới nắng là nguy hiểm.
So sánh: `ok`=4.46 (cũng dưới 4.5), `danger`=4.37 — **cả ba cặp status đều CHƯA đạt 4.5 cho chữ thường.**

| Cặp | Tỉ lệ | AA 4.5? |
|---|---|---|
| `--ok` trên `--ok-bg` | 4.46 | ❌ (sát) |
| `--warn` trên `--warn-bg` | 3.95 | ❌ |
| `--danger` trên `--danger-bg` | 4.37 | ❌ (sát) |

**Sửa:** làm đậm chữ trạng thái để vượt 4.5 (tốt nhất ≥5–6 cho nắng):
- `--warn` → `#8a5a00` (≈4.9) hoặc đậm hơn `#7a5000`.
- `--ok` → `#1a6b3c` (≈5.1).
- `--danger` → `#a8281b` (≈5.2).
Giữ nguyên nền `-bg`. (Mẹo: chữ banner đang 16px — nếu nâng lên 18px **đậm** vẫn là chữ thường, nên phải sửa màu, không thể né bằng cỡ chữ.)

### B4. Modal/bottom-sheet không bẫy focus, không đóng bằng Escape, không khoá cuộn nền
**File:** mọi bottom-sheet & dialog xác nhận:
`document-vault.tsx:194,205,279` · `crew-list.tsx:284,292,379,535` · `maintenance-reminders.tsx:297,393` · `trip-log.tsx:253,341`
**WCAG 2.1.2 (No keyboard trap — ngược lại: thiếu focus management), 4.1.2; Vercel: focus trap, `overscroll-behavior: contain`, Escape**
- Không có focus trap: Tab sẽ chạy ra các nút phía sau scrim.
- Không bắt phím **Escape** để đóng (chỉ đóng bằng chạm scrim — tay ướt khó).
- Scrim `<div onClick>` dùng `div` làm nút đóng → không có vai trò nút, không bàn phím (Vercel: `<div onClick>` nên là `<button>`; ở đây nên là overlay + nút đóng thật).
- Thiếu `role="dialog"` / `aria-modal="true"` / `aria-labelledby` trỏ tới tiêu đề `<h3>`.
- Thiếu `overscroll-behavior: contain` → cuộn trong sheet làm cuộn nền.
- Không trả focus về nút mở khi đóng.

**Sửa:** bọc trong một `Dialog` dùng chung: `role="dialog" aria-modal="true" aria-labelledby={titleId}`; focus phần tử đầu khi mở (KHÔNG autofocus ô input trên mobile — xem M5), trap Tab, nghe `keydown Escape`, thêm `overscroll-behavior: contain` cho `<form>`, khoá `body` scroll, trả focus khi đóng. Cân nhắc Radix Dialog / `<dialog>` native.

---

## 🟠 CAO

### C1. Bản đồ chỉ thao tác được bằng chạm pixel chính xác — không có lối thay thế
**File:** `fishing-map-view.tsx:248-345` (chỉ có `onClick` đặt điểm theo `e.lngLat`)
**WCAG 2.1.1 (Keyboard), 2.5.5**. Toàn bộ tính năng cốt lõi (xem gió sóng tại điểm, vẽ tuyến) phụ thuộc vào việc **chạm đúng một toạ độ** trên bản đồ. Người tay ướt/run, hoặc dùng bàn phím/đọc màn hình, không có cách nào chọn điểm. Marker, nút zoom mặc định của MapLibre cũng nhỏ <56px.
**Sửa:** thêm lối thay thế không cần bản đồ — ví dụ chọn cảng/khu vực từ `<select>` (đã có pattern ở `sea-forecast`), hoặc nút "Xem chỗ tàu tôi" (đã có ở `:537`) làm lối chính. Đảm bảo nút zoom/định vị của MapLibre ≥56px (tuỳ biến `NavigationControl`) hoặc ẩn đi và cung cấp nút to riêng. Marker nên có nhãn chạm được lớn.

### C2. Nút icon-only của bản đồ thiếu tên — và toàn bộ icon thiếu `aria-hidden`
**File:** điều khiển MapLibre mặc định (zoom +/−) không có nhãn tiếng Việt; mọi `<Icon className=.../>` trong app render `<svg>` không có `aria-hidden="true"`.
**WCAG 4.1.2, 1.1.1; Vercel: icon-only buttons need `aria-label`, decorative icons need `aria-hidden`**
Vì nút đều đã kèm chữ (vd "Sửa", "Xóa") nên icon là trang trí → cần `aria-hidden="true"` để trình đọc không đọc lặp/đọc rác. Các marker bão `fishing-map-view.tsx:325-335` truyền thông tin (AlertIcon) nhưng `pointer-events-none` và không có text alternative cho SR.
**Sửa:** thêm `aria-hidden="true"` (hoặc `focusable="false"`) mặc định trong component icon ở `@/components/icons`. Nút zoom bản đồ: đặt `aria-label="Phóng to" / "Thu nhỏ"`. Marker bão: thêm `aria-label`/text ẩn mô tả "Bão … tại …".

### C3. Chip lọc & nút phụ nhỏ hơn quy tắc 56px của dự án
**WCAG 2.5.5 (44px tối thiểu) — dự án đặt ≥56px**
- `supply-catalog.tsx:34` chip lọc `min-h-[44px]`.
- `maintenance-reminders.tsx:459` chip số ngày `min-h-[44px]`.
- `crew-list.tsx:572` chip số tiền nhanh `min-h-[44px]`.
- `crew-list.tsx:241,251,258` `document-vault.tsx:172,179` `maintenance-reminders.tsx:264,271` `trip-log.tsx:220,227` hàng nút Sửa/Xóa/Ứng tiền `min-h-[52px]` (<56).
- `trip-split.tsx:70` nút % `min-h-[48px]`.
- `crew-list.tsx:229,231` "Đã trừ xong" và `:207` link "Gọi" — vùng chạm chỉ theo chiều cao chữ (~24px), không có padding → rất nhỏ.
**Sửa:** nâng tất cả nút/chip tương tác lên `min-h-[56px]` và đủ rộng. Link "Gọi {sđt}" và "Đã trừ xong" bọc trong vùng chạm ≥56px (thêm `py-3 px-3 inline-flex min-h-[56px] items-center`).

### C4. Nút "Thêm" chính (cam) — chữ trắng trên `--trim` chỉ 3.68:1
**File:** nút thêm ở mọi màn: `document-vault.tsx:96` `crew-list.tsx:163` `maintenance-reminders.tsx:188` `trip-log.tsx:157`; nút Lưu `:358,512,599...`
**WCAG 1.4.3**. `#fff` trên `--trim #e4572e` = **3.68:1**. Chữ 19px **đậm** = chữ lớn → ngưỡng 3:1 → **đạt AA large text**, nhưng chỉ vừa đủ và **không đạt chữ thường** nếu cỡ giảm. Dưới nắng 3.68 là yếu.
**Sửa:** làm đậm trim cho nền nút hành động → vd `#c8431f` (≈4.6) để qua cả ngưỡng chữ thường và an toàn ngoài nắng. Hoặc dùng `--navy` (white-on-navy = 13.1, tuyệt vời) cho nút chính, để cam làm nhấn phụ.

### C5. Ô input thiếu `name`/`autocomplete`, `value` controlled không khớp guideline; date input có thể gây zoom iOS
**File:** mọi `<input>`/`<select>`/`<textarea>` trong các form (vd `document-vault.tsx:309-345`, `crew-list.tsx:395-497`, `trip-log.tsx:357-411`, `route-planner.tsx:276-298`)
**WCAG 1.3.5; Vercel: inputs need `autocomplete` + meaningful `name`**
- Không ô nào có thuộc tính `name` hay `autocomplete` → trình duyệt không tự điền, password manager có thể nhảy vào.
- `route-planner.tsx:281,295` input `text-[18px]` ổn; nhưng nhiều input `text-[17px]` — **đạt ≥16px** nên KHÔNG gây zoom iOS (tốt). ✅ Tuy nhiên kiểm lại: tất cả input form đều ≥17px → an toàn.
- `crew-list.tsx:421` ô điện thoại nên dùng `type="tel"` (đang chỉ `inputMode="tel"`) + `autocomplete="tel"`.
**Sửa:** thêm `name` có nghĩa cho mọi control; `type="tel"` + `autocomplete="tel"` cho điện thoại; `autocomplete="off"` cho các ô không phải thông tin cá nhân để tránh password manager.

### C6. Focus không nhìn thấy được — `focus:outline-none` chỉ thay bằng đổi màu viền
**File:** mọi input dùng `inputCls` ("…focus:border-sea focus:outline-none") — `document-vault.tsx:277` `crew-list.tsx:377` `maintenance-reminders.tsx:391` `trip-log.tsx:335` `sea-forecast.tsx:75` `price-board.tsx:63` `fines-lookup.tsx:77` `trip-split.tsx:30`; **các nút thì hoàn toàn không có trạng thái focus.**
**WCAG 2.4.7 (Focus Visible); Vercel: never `outline-none` without replacement, use `:focus-visible`**
- Input: `outline-none` + chỉ đổi `border-sea` — đổi màu viền 2px là tín hiệu yếu, và `border` thay đổi không phải `:focus-visible`. Người dùng bàn phím khó thấy.
- **Toàn bộ `<button>` và `<Link>`** (nav, Sửa/Xóa, chip, nút Thêm) **không có `focus-visible:` nào** → không thấy ổ focus khi điều hướng bàn phím.
**Sửa:** thêm tiện ích chung `focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2` cho mọi nút/link/input. Bỏ `outline-none` hoặc thay bằng `focus-visible:outline-2`.

---

## 🟡 TRUNG BÌNH

### M1. Cập nhật bất đồng bộ & kết quả lọc không có `aria-live`
**File:** `sea-forecast.tsx:85-103` (đang tải / lỗi), `fishing-map-view.tsx:389-408`, `route-planner.tsx:313` (lỗi tuyến), `fines-lookup.tsx:82` (số kết quả), `price-board.tsx:67`, `trip-log.tsx` (preview lãi/lỗ `:414`)
**WCAG 4.1.3; Vercel: async updates need `aria-live="polite"`**
Trình đọc màn hình không được thông báo khi "Đang tải", có lỗi, hay số kết quả thay đổi.
**Sửa:** bọc vùng trạng thái/đếm kết quả trong `aria-live="polite"` (lỗi nghiêm trọng dùng `role="alert"`).

### M2. Thứ tự heading không nhất quán; thiếu `<h1>` và skip link
**File:** `fines-lookup.tsx:63` mở đầu bằng `<h2>`; `sea-forecast.tsx:158`, `fishing-map-view.tsx:362` dùng `<h2>`; các form dùng `<h3>` nhưng nhiều màn (document-vault, crew-list, trip-log, price-board, supply-catalog) **không có heading nào** — nội dung bắt đầu bằng `<button>`/`<p>`. Không có `<h1>` cấp trang, không có skip-link tới `<main>`.
**WCAG 1.3.1, 2.4.1; Vercel: hierarchical headings + skip link**
**Sửa:** mỗi màn có một `<h1>` (tiêu đề trang, có thể sr-only nếu thiết kế không hiện), heading con xuống `<h2>`. Thêm skip link "Tới nội dung chính" đầu `layout.tsx` trỏ tới `#main`. (`<main>` ở `layout.tsx:45` cần `id`.)

### M3. Banner trạng thái dùng `<p>` cho thông tin có cấu trúc; vai trò ngữ nghĩa yếu
**File:** banner `document-vault.tsx:134`, `crew-list.tsx:190`, `maintenance-reminders.tsx:220` — `<p>` chứa cảnh báo quan trọng.
**WCAG 1.3.1, 4.1.2**
Cảnh báo "Quá hạn"/"Sắp hết hạn" nên có `role="status"` (hoặc `role="alert"` nếu khẩn) để SR nắm ngữ cảnh. Hiện chỉ là đoạn văn màu.
**Sửa:** thêm `role="status"` cho banner; cân nhắc text ẩn nêu rõ "Cảnh báo:" trước nhãn.

### M4. Bảng/danh sách số liệu thiếu `tabular-nums`; dùng dấu `–`/`...` chưa nhất quán
**File:** `trip-split.tsx`, `trip-log.tsx`, `crew-list.tsx`, `price-board.tsx:27` (đã dùng `–` đẹp ✅), `supply-catalog.tsx`. Placeholder dùng `"..."` (3 chấm thường) ở nhiều ô: `document-vault.tsx`, `price-board.tsx:62`, `fines-lookup.tsx:75`.
**Vercel: `tabular-nums` cho cột số; `…` không phải `...`; loading states kết thúc bằng `…`**
- Số tiền VND xếp cột (trip-split, trip-log) nên `font-variant-numeric: tabular-nums` để thẳng hàng.
- Placeholder "Tìm loại cá..." → "Tìm loại cá…" (đa số chỗ "Đang … " loading đã dùng `…` đúng ✅).
**Sửa:** thêm class `tabular-nums` cho các số tiền; đổi `...` → `…` trong placeholder.

### M5. `autofocus`/quản lý focus trong sheet trên mobile cần thận trọng (liên quan B4)
**Vercel: avoid `autoFocus` on mobile**. Hiện form chưa autofocus (tốt), nhưng khi thêm focus trap (B4), **không** nên tự focus ô input đầu trên mobile (bật bàn phím che màn). Focus tiêu đề hoặc nút đóng thay vì input.

### M6. Nút "Vừa làm xong hôm nay" reset đồng hồ mà không xác nhận / hoàn tác
**File:** `maintenance-reminders.tsx:245-255`
**Vercel: destructive/state-changing actions need confirm or undo**. Một chạm ghi đè `lastDone` = hôm nay, mất mốc cũ, không hoàn tác. Tay ướt dễ chạm nhầm.
**Sửa:** thêm undo nhanh ("Đã cập nhật · Hoàn tác") hoặc xác nhận nhẹ.

### M7. `<select>` thiếu màu nền/chữ tường minh; thiếu `touch-action: manipulation`
**File:** mọi `<select>` (sea-forecast, document-vault, crew-list, maintenance, route-planner) và body chung.
**Vercel: native select needs explicit background-color/color; `touch-action: manipulation`**
`<select>` dựa màu kế thừa — ổn ở light, nhưng nên đặt rõ `bg-card text-foreground`. Thêm `touch-action: manipulation` toàn cục (hoặc cho nút) để bỏ trễ double-tap.
**Sửa:** đặt `background-color`/`color` rõ cho select; thêm `touch-action: manipulation` trong `globals.css` cho `button, a, select, input`.

---

## 🟢 THẤP

### L1. `t3` trên `t3-bg` chỉ 3.38:1 — hộp ghi chú vật tư khó đọc
**File:** `supply-catalog.tsx:38-44` (`--t3 #b07816` trên `--t3-bg #fcf1d8` = 3.38; chữ 14px semibold = chữ thường → cần 4.5). ❌
**Sửa:** đậm `--t3` → `#8f5f0f` (≈4.6) hoặc tăng cỡ chữ ghi chú. (Các accent khác ổn: `t1`=5.59, `t4`=5.28.)

### L2. `<a href="tel:">` "Gọi" — màu `text-sea` trên card ổn nhưng vùng chạm nhỏ (đã nêu C3); kiểm tra dấu cách không ngắt
**File:** `crew-list.tsx:207`. Số điện thoại nên `translate="no"` để không bị tự dịch; thêm `tabular-nums`.

### L3. Empty-state icon `text-foreground/30` — chấp nhận được (trang trí) nhưng chữ kèm `/60` nên nâng (gộp B2).
**File:** `document-vault.tsx:104-105` v.v.

### L4. Marker chủ quyền & nhãn bản đồ dựa `text-shadow` để nổi trên ảnh vệ tinh — tương phản không đảm bảo trên mọi lớp ảnh
**File:** `fishing-map-view.tsx:299-320`. Nhãn `--navy` 10–12px trên ảnh SST/mây có thể tụt dưới 4.5 tuỳ vùng. Cân nhắc nền mờ đặc (pill trắng `bg-white/90`) như đã làm cho nhãn ngày `:347`.

### L5. `transition` dùng từ khoá rộng & thiếu `prefers-reduced-motion`
**File:** nhiều nút `className="...transition active:scale-[0.98]"`; `globals.css` không có khối `@media (prefers-reduced-motion: reduce)`.
**Vercel: honor `prefers-reduced-motion`; animate transform/opacity only**. `transition` (không liệt kê thuộc tính) ⊃ `transition: all`. `active:scale` là transform (tốt) nhưng `flyTo`/`fitBounds` của bản đồ (`fishing-map-view.tsx:144,190`) có `duration` cố định.
**Sửa:** thêm `@media (prefers-reduced-motion: reduce) { *{animation:none!important;transition:none!important} }` trong `globals.css`; rút `duration` bản đồ về 0 khi reduce-motion.

---

## Checklist ưu tiên (theo thứ tự nên làm)

**Đợt 1 — Chặn (làm ngay):**
- [ ] B1 — Bỏ `maximumScale: 1` trong `layout.tsx:29` (cho phép phóng to).
- [ ] B2 — Nâng sàn opacity chữ thông tin lên `/70` trở lên; sửa `bottom-nav` tab inactive trước tiên.
- [ ] B3 — Làm đậm `--ok`/`--warn`/`--danger` để chữ banner vượt 4.5:1 (nhắm 5–6).
- [ ] B4 — Bottom-sheet/dialog: `role="dialog" aria-modal`, focus trap, Escape, `overscroll-behavior:contain`, khoá scroll nền, trả focus.

**Đợt 2 — Cao:**
- [ ] C1 — Thêm lối chọn điểm không cần chạm pixel trên bản đồ (select cảng / nút vị trí).
- [ ] C2 — `aria-hidden="true"` mặc định cho mọi icon trang trí; `aria-label` cho nút zoom & marker bão.
- [ ] C3 — Mọi nút/chip/link tương tác ≥56px (Sửa/Xóa/chip/% /Gọi/Đã trừ xong).
- [ ] C4 — Đậm nền nút hành động cam (hoặc dùng navy) để ≥4.6:1.
- [ ] C5 — Thêm `name`/`autocomplete`; `type="tel"` cho điện thoại.
- [ ] C6 — `focus-visible:ring-*` cho mọi nút/link/input; bỏ `outline-none` trần.

**Đợt 3 — Trung bình:**
- [ ] M1 — `aria-live="polite"` cho trạng thái tải/lỗi/đếm kết quả.
- [ ] M2 — `<h1>` mỗi màn + skip link tới `<main id>`.
- [ ] M3 — `role="status"` cho banner trạng thái.
- [ ] M4 — `tabular-nums` cho cột số tiền; `...` → `…` trong placeholder.
- [ ] M5 — Không autofocus input trong sheet trên mobile.
- [ ] M6 — Undo/confirm cho "Vừa làm xong hôm nay".
- [ ] M7 — Màu nền/chữ rõ cho `<select>`; `touch-action: manipulation` toàn cục.

**Đợt 4 — Thấp / hoàn thiện:**
- [ ] L1 — Đậm `--t3`.
- [ ] L2 — `translate="no"` + `tabular-nums` cho số điện thoại.
- [ ] L4 — Nền pill đặc cho nhãn chủ quyền trên bản đồ.
- [ ] L5 — `prefers-reduced-motion` trong `globals.css` + tắt animation bản đồ khi bật.
