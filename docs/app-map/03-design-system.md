# 03 — Design system: thiết kế cho ngư dân / Audience-first design

> **Mục đích / Purpose**: Hướng thiết kế canonical của ForFish — bắt đầu từ người dùng (ngư dân 40–60 tuổi, nắng chói, tay ướt), không bắt đầu từ trend.

**Load khi / Load when**: sửa UI, màu sắc, typography, copy, trạng thái (status), hoặc thêm component mới.

covers: src/app/globals.css
last_verified: 2026-08-25
ttl_days: 90
gate: warn
<!-- re-verified: 2026-08-18 — ĐỐI CHIẾU `globals.css` (bản 2026-08-14 b0bd111) với doc: (1) 51 biến `--*` trong `:root`/`@theme` — bảng màu theo trục có 4 hex LỆCH từ đợt chỉnh AA (t1 #18648b · t2 #2e7d4f · t3 #8f6010 · t4 #7a4d9e) → sửa bảng theo mã, ghi kèm `--tN-bg` + bộ trạng thái ok/warn/danger (+ `-bg`); bổ sung tên token nền tảng `--navy/--sea/--trim/--sun/--foreground/--card/--line` mà doc chỉ gọi bằng tên chữ. (2) `.surface` · `.glass` · `.range-big` · `.range-dual` · `.display` · `.anim-*` · `.dock-frame`/`.bottom-dock`/`--app-vh`/`--dock-*` đều còn trong mã, khớp mục 2/3/6. (3) giá trị oklch ở mục "Token chờ lift" là GIÁ TRỊ MÀU chưa lift, không phải symbol mã — bỏ backtick để doc-health khỏi báo dead-symbol oan; nội dung không đổi. (4) Mục 6 "Lớp Dự báo cá" còn tả heatmap theo loài + hàm `fishHeatColor` (đã xoá) → đính chính theo mã hiện tại (lưới ô 3 mức `FISH_LEVEL_BANDS`, từ 2026-07-27 — 07 đã ghi, 03 chưa). (5) Gói C 2026-08-18: thêm bullet `neutral` cho `CrewIssueLevel`/`requestStatusVN` ở mục "Ngôn ngữ trạng thái" — không token mới. -->
<!-- re-verified: 2026-06-16 — +.range-dual (globals.css): dual-range kéo-thả 2 đầu, tái dùng thumb kiểu .range-big (input pointer-events:none, thumb auto). Dùng ở legend lọc khả năng có cá. Token màu/font KHÔNG đổi -->

> ⚠️ Một đợt redesign theo hướng này đang chạy song song — file này mô tả **direction + tokens conceptually**, không trích line number cụ thể của file src. Token thực tế nằm trong `src/app/globals.css` (`@theme`), luôn coi file đó là nguồn giá trị hiện hành.

---

## 0. CỠ GIAO DIỆN — một kiến trúc rem, mặc định GỌN (user chốt 2026-07-28; trước đó theo máy 2026-06-11)

Toàn bộ cỡ chữ / tap-size / bo góc viết bằng **REM** (đã quét sạch `text-[Npx]`/`min-h-[Npx]`/`rounded-[Npx]` → rem; utility chuẩn Tailwind vốn là rem). Chế độ chỉ là font-size gốc của `<html>`:

| Chế độ | Gốc | Cho ai |
|---|---|---|
| **Gọn** (`data-mode="gon"`, MẶC ĐỊNH — kể cả chưa đăng nhập/màn login) | khóa 14px → body ~15.8px, nút ~52px | mật độ chuẩn app, cân đối |
| **Chữ to** (`data-mode="to"`) | khóa 16px → body 18px, nút 60px | khóa to bất kể máy |
| **Theo máy** (auto — bấm lại lựa chọn đang chọn trong sheet) | không đặt → ăn theo cỡ chữ cài trong điện thoại/trình duyệt | bác nào chỉnh chữ to trong máy, app TỰ to theo |

- **Chỉnh trong SHEET TÀI KHOẢN** (`hero-account.tsx` — chip duy nhất trên hero mở sheet: danh tính · cỡ giao diện · đăng xuất). KHÔNG bày toggle thô ra hero — nguyên tắc: cái gì trực tiếp thì show, còn lại vào menu phụ. Lưu `forfish.displaymode.v1`; script đầu `<body>` đặt `data-mode` TRƯỚC khi vẽ — không nháy.
- **QUY TẮC**: cấm viết `text-[Npx]`/`min-h-[Npx]` trong component — dùng rem (`text-[1.125rem]`…) để mọi chế độ cùng ăn. Tỷ lệ giữa các phần tử giữ nguyên → một hệ giao diện, không phải nhiều bộ.
- Sàn accessibility (≥18px, tap ≥56px ở mục 1) tính cho gốc 16px; chế độ Gọn là lựa chọn chủ động của người dùng.

## 1. Người dùng quyết định tất cả / Audience-first

Ngư dân 40–60 tuổi, dùng điện thoại ngoài trời **nắng chói**, **tay ướt**, ít rành công nghệ:

| Ràng buộc | Quy tắc |
|---|---|
| Mắt kém hơn, nắng chói | Base font **≥ 18px**, contrast cao, không chữ xám nhạt trên nền sáng |
| Tay ướt, ngón to | Tap target **≥ 56px**, khoảng cách giữa nút rộng |
| Ít rành công nghệ | Label = **icon + từ ngắn**, không icon trơ trọi, không jargon |
| Tiếng Việt đời thường | "Tủ giấy tờ" chứ không "Document management"; "Còn 18 ngày" chứ không "Expires in 18d" |
| Một việc một màn hình | Không nested menu, không bước thừa; flow ≤ 2 chạm tới việc chính |

## 2. Màu / Palette — "Mặt nước" (redesign 2026-06-10, user yêu cầu hiện đại + tràn viền)

Hướng mới: **modern edge-to-edge mobile** — nền sáng lạnh, hero biển sâu tràn viền, bề mặt không viền. Bỏ nền cát ấm cũ.

### Logo / brand mark
- **Một logo DUY NHẤT cho cả sản phẩm**: bộ icon PWA sinh từ `image/logo sdfish.png` (`npm run icons` → `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, maskable). App ngư dân dùng qua manifest/PWA; **web quản trị `/quan-tri` dùng CHUNG chính icon đó** (`/icons/icon-192.png`) trong header (44px, bo góc `rounded-xl` + `border-line`) — KHÔNG tạo logo riêng cho khu quản trị (chốt user 2026-07-30 "logo chung với logo app"). Đổi logo = thay `image/logo sdfish.png` rồi chạy lại `npm run icons`; cả hai khu tự cập nhật.

### Màu nền tảng
- **Deep sea navy** (`--navy` #14324f "hull blue" + `--sea` #18648b "mid sea") — màu chủ đạo, hero/brand/dock (đối chiếu `globals.css` 2026-08-18)
- **Sunrise orange-red** (`--trim` #e4572e "boat-trim"; `--sun` #f2a01f "sun yellow" phụ) — accent, call-to-action (nút pill + bóng màu)
- **Cool mist** (`--background` #f3f6f8) — nền sáng lạnh; chữ `--foreground` #16283a "sea ink"; `--card` #ffffff; `--line` #e2e9ef hairline (KHÔNG dùng làm viền thẻ)
- **Field** (`--field` #eaeff3) — nền ô nhập kiểu filled + chip tonal chưa chọn
- Mọi token trên đều có bản `--color-*` trong `@theme` (Tailwind v4) + `--font-sans`/`--font-display`; dock: `--dock-safe` / `--dock-row` / `--dock-total` (chiều cao pill + safe-area, xem ghi chú PWA)

### Token chờ lift — redesign "Ra khơi A" (nguồn giá trị: lift từ 07-design-spec, 2026-08-13)
- **Màu cá = hồng tím oklch(0.64 0.19 350)** (design doc Ra khơi A — thay xanh lá hiện tại khi build phương án A); **primary xanh oklch(0.52 0.13 235)** (viết không backtick — `doc-health-report` coi `tên(` trong backtick là symbol mã và báo SUSPECT oan). CHƯA vào `globals.css @theme` — khi build increment tương ứng thì lift vào globals cùng commit rồi xoá chữ "chờ" ở đây. 07-design-spec chỉ TRỎ về mục này, không giữ giá trị (luật "không trộn token" của chính nó §"Không trộn").
- Màu THEO LOÀI cá trên bản đồ vẫn là NỘI DUNG (khai trong `fish-predict.ts` — ngoại lệ §5, không phải token UI).

### Hình khối hiện đại (thay quy tắc bo 12px cũ)
- **Thẻ = `.surface`** (globals.css): trắng KHÔNG viền, bo 20px, bóng mềm 2 lớp. KHÔNG dùng `ring-1 ring-line` làm viền thẻ nữa — `--line` chỉ còn cho divider trong thẻ (`border-t/b/l border-line`).
- **Panel nổi trên bản đồ = `.glass`** (globals.css, 2026-07-29): liquid glass — nền trắng 62% + `backdrop-filter: blur(14px) saturate(1.5)`, viền sáng inset 1px, bo 20px; có fallback nền 92% cho máy không hỗ trợ blur. CHỈ dùng cho panel đè lên bản đồ (thanh giờ Windy, HUD dẫn đường) — thẻ nội dung thường vẫn `.surface`.
- **Hero = `.hero`**: gradient `navy → màu trục`, quầng sáng radial, bo đáy 28px, tiêu đề display 28px. Chip tàu (`BoatSwitcher`) nổi đè mép hero (`-mt-6`).
- **Nút chính + chip + tab**: pill (`rounded-full`); nút cam có bóng màu. Ô nhập: filled (`bg-field`, không viền, focus ring sea). Sheet đáy: bo trên 28px.
- **Ô nhập TIỀN = `MoneyField`** (`ui/primitives.tsx`, hội đồng UX 2026-06-11): mọi ô nhập tiền đồng dùng chung component này — chấm nghìn ngay khi gõ, cap 12 chữ số, dòng đọc-lại "= 45 triệu đồng" khi ≥1 triệu (chống lỗi thừa/thiếu một số 0 làm lệch 10 lần). State giữ CHUỖI SỐ THÔ (`digits`/`onDigits`), helpers `formatDigits`/`parseDigits`/`readbackVnd` trong `lib/format.ts` (có test). KHÔNG tự chế ô tiền với `parseVnd` + toLocaleString tay nữa.
- **Hành động phá hủy KHÔNG bao giờ 1 chạm**: `ConfirmDialog` (xóa cả bản ghi) hoặc xác nhận inline ngay trong hàng ("Xóa 'X'? [Xóa hẳn][Thôi]" — mẫu ở `my-places-sheet.tsx`). Nút icon trong hàng danh sách ≥3.5rem và luôn kèm nhãn chữ 0.75rem. Gạch nợ ứng (`crew-list.tsx`) cũng phải ConfirmDialog nêu rõ số tiền.
- **Nút GỌI = `CallButton`** (`ui/primitives.tsx`, 2026-06-11): pill xanh biển icon + chữ, tap ≥48px, tự lấy số đầu khi chuỗi nhiều số. Không tự chế nút gọi chữ trần.
- **Ô mật khẩu = `PasswordField`** (`auth-form.tsx`): có nút Hiện/Ẩn → form đăng ký KHÔNG cần ô "nhập lại".
- **Slider trên bản đồ dùng class `.range-big`** (globals.css): núm 1.75rem tự vẽ cho tay ướt — `accent-color` mặc định núm quá nhỏ.
- **In hồ sơ = `@media print` + `.print-area`/`.no-print`** (globals.css, 2026-06-15): bản in chỉ hiện vùng `.print-area`, giấu nav + nút `.no-print`. *(Người dùng đầu tiên `trip-dossier.tsx` đã XÓA 2026-07-27 — CSS còn trong globals.css cho lần in kế tiếp, hiện chưa component nào dùng.)*
- **Safe-area edge-to-edge** (globals.css + layout.tsx, 2026-06-16): `viewport.viewportFit:"cover"` → app vẽ tràn dưới notch/Dynamic Island. Chrome né vùng an toàn bằng `.safe-pt`/`.safe-pb` (= `env(safe-area-inset-top/bottom)`): hero `page-header.tsx` (`calc(1.5rem+inset-top)`), overlay top map `fishing-map-view.tsx`, đáy `bottom-sheet`/`snap-sheet`. Dock đã tự cộng inset-bottom. `body { overscroll-behavior-y: none }` chặn rubber-band (cảm giác app).
- **Motion điềm đạm** (globals.css, 2026-06-16): chuyển động chuẩn native, CSS THUẦN (không lib). Keyframes `sdf-{scrim,sheet,pop}-{in,out}` + class `.anim-{scrim,sheet,pop,fade}-{in,out}` (180–220ms ease). Áp: BottomSheet (scrim mờ + panel trượt lên/xuống), ConfirmDialog (scrim mờ + card pop), Tabs (tabpanel `.anim-fade-in` đổi tab). Đóng-có-animation qua hook `lib/use-exit-transition.ts` (chạy animation thoát rồi mới gọi onClose; API component KHÔNG đổi). **KHÔNG bounce/nhún nhảy**; block `prefers-reduced-motion` tự tắt mọi animation. Haptics nhẹ `lib/haptics.ts` (`tapFeedback`) chỉ ở ConfirmDialog confirm.
- **Tap target**: nâng Tabs + nút SnapSheet lên `min-h-[3.5rem]` (56px) — đạt sàn tap chính cho tay ướt. Thanh kéo của SnapSheet ở nấc `hidden` (2026-08-24) VẼ mảnh (vệt kính h-8) nhưng VÙNG CHẠM vẫn `min-h-[3.5rem]` — vệt vẽ mảnh không được kéo vùng chạm xuống theo.
- **Dock điều hướng nổi**: thanh navy kính mờ bo 26px tách khỏi mép màn hình, tab chọn = pill trắng. Item ≥60px, icon luôn kèm chữ.
- Thẻ 4 trục ở Home: **tonal** — nền `--tN-bg`, icon tròn đặc `--tN`.

### Phân cấp điều hướng TRONG trang (chốt 2026-06-10, khi cấu trúc mới sinh chip lồng chip)
Người 40–60 tuổi phải biết mình đang ở tầng nào bằng MẮT, không bằng suy luận:
1. **Tabs** (`ui/tabs.tsx`) — chia KHU trong một trang (vd /tau: Giấy tờ · Dịch vụ · Sản phẩm). Track pill sticky, tab chọn navy đặc. *(/tien bỏ Tabs 2026-07-27 — chỉ còn 1 khu Giao dịch.)*
2. **Chip tầng 1** (`ui/chip-row.tsx` `level=1`) — mục chính TRONG một tab: pill ĐẶC màu trục, 48px, chữ 16px (vd Giá cá · Ai cần mua · Bán ở đâu).
3. **Chip tầng 2** (`level=2`) — mục con bên trong một mục: pill TONAL nền nhạt màu trục, 42px, chữ 15px — nhỏ + nhẹ hơn hẳn tầng 1 (vd 5 mục của Bán ở đâu).
KHÔNG tự chép tay style chip nữa — mọi hàng chip điều hướng dùng `ChipRow` (truyền `accent` đúng màu trục). Không đào sâu quá 3 tầng (Tabs → chip 1 → chip 2 là kịch trần).

### Nhãn ngang hàng — ĐỒNG BỘ hình dạng (user chốt 2026-07-28)

Mọi cụm điều khiển ngang hàng (thanh tab, hàng chip, hàng nút phân đoạn, dock) phải có nhãn CÙNG KHUÔN — người dùng lướt mắt một lượt là đọc được, không bị cái dài cái ngắn kéo mắt:

1. **Cùng số dòng**: cả cụm 1 dòng thì 1 dòng hết, 2 dòng thì 2 dòng hết. KHÔNG trộn (đã dính: tab /quan-tri 7 nhãn `flex-1` → "Yêu cầu" 1 dòng cạnh "Tài khoản" 2 dòng — sửa 2026-07-28).
2. **Cùng biên độ số chữ**: đặt budget cho cụm trước (vd tab /quan-tri: đúng 2 chữ/nhãn) rồi CHỌN TỪ cho vừa khuôn — không co giãn khuôn theo từ. Tên không vừa → đổi từ (vd "Cảnh báo TV" 3 chữ → "Thuyền viên" 2 chữ), KHÔNG để nhãn 1 chữ cụt lủn đứng cạnh nhãn 3 chữ dài ngoằng.
3. **Cơ chế chống gãy dòng**: ≤4 tab mới được segmented `flex-1` (và phải kiểm nhãn dài nhất vẫn 1 dòng ở 360px); >4 tab → hàng CUỘN NGANG (`overflow-x-auto` + nút `shrink-0 whitespace-nowrap`) đúng pattern `ui/tabs.tsx`. KHÔNG ép nhiều tab vào một hàng bằng flex-1.
4. **Không tự chế tablist**: trong app dùng `ui/tabs.tsx` / `ChipRow`; trang đứng riêng (vd /quan-tri) được style riêng nhưng vẫn phải theo 3 luật trên.

Luật này áp cho CHỮ trong nhãn, không chỉ CSS: viết copy cho tab/nút là phải nghĩ theo cụm, không đặt tên từng cái một.

### Màu theo trục (per-trục accents) — đã có trong `globals.css`

| Trục | Tên | Hex (`globals.css`, đối chiếu 2026-08-18) | Nền nhạt |
|---|---|---|---|
| 1 — Đánh bắt | steel blue (`--t1`) | ~~`#2e6b8a`~~ **`#18648b`** (= `--sea`) | `--t1-bg` #e3f0f7 |
| 2 — Bán | green (`--t2`) | ~~`#2f6b43`~~ **`#2e7d4f`** | `--t2-bg` #e4f3e9 |
| 3 — Vận hành | amber (`--t3`) | ~~`#8a6516`~~ **`#8f6010`** (đậm để `text-t3` + white-on-t3 đạt AA 4.5, audit 2026-06-11) | `--t3-bg` #fcf1d8 |
| 4 — Tuân thủ | purple (`--t4`) | ~~`#7a3b9a`~~ **`#7a4d9e`** | `--t4-bg` #f1eaf8 |

Trạng thái: `--ok` #15663a / `--ok-bg` #d9f0e2 · `--warn` #7a4e00 / `--warn-bg` #ffeec2 · `--danger` #a82218 / `--danger-bg` #fde0db. Hex trong bảng cũ là giá trị lúc reverse-engineer 2026-06-11, đã lệch với `globals.css` từ đợt chỉnh AA — sửa doc theo mã 2026-08-18. Mỗi trục có thêm biến nền nhạt tương ứng (`--tN-bg`). Mọi UI thuộc một trục phải dùng đúng accent của trục đó — giúp người dùng nhận diện "khu" bằng màu.

### Màu trạng thái (semantic status) — KHÔNG đổi nghĩa

| Màu | Nghĩa | Token |
|---|---|---|
| 🔴 Đỏ | Quá hạn / nguy | `--danger` |
| 🟡 Vàng hổ phách | Sắp hết hạn / chú ý | `--warn` |
| 🟢 Xanh lá | Còn hạn / ổn | `--ok` |

Mapping với expiry logic (`expired`/`soon`/`ok`): xem [04-data-model.md](04-data-model.md).

### Ngôn ngữ trạng thái: MỘT component duy nhất (đồng bộ 2026-06-10)

Mọi trạng thái trên thẻ (giấy tờ, bảo dưỡng, sản phẩm/bảo hành, thuyền viên, ~~mức phạt~~ giỏ/đơn) dùng **`ui/status-banner.tsx` (`StatusBanner`)** — băng màu + icon + chữ ở ĐẦU thẻ. Màu không bao giờ đứng một mình (an toàn mù màu + nắng chói). **Phạm vi chốt 2026-08-18** (khớp [07 §8 + §12](07-design-spec.md)): `StatusBanner` = **thẻ dữ liệu + banner tĩnh trong luồng**; **chip nổi trên bản đồ / kết quả tuyến** dùng khuôn `<p role="status">` với **cùng token** warn/danger (`bg-warn-bg text-warn` …), không bọc StatusBanner. **Xanh (ok) KHÔNG đeo băng**; `days === 0` = đỏ; chưa tới hạn = neutral (không băng).

- Mức: `danger` / `warn` / `ok` / `neutral`. Icon mặc định theo mức (chuông/đồng hồ/tick), truyền `icon` khi cần khác, `icon={null}` để bỏ.
- KHÔNG tự chế kiểu trạng thái mới (viền trái màu, icon màu trơ trọi…) — các bản chép tay cũ ở fines-lookup/crew-list/document-vault/maintenance-reminders đã gom hết về StatusBanner.
- Mức phạt không bao giờ "tốt": phạt nhẹ dùng `neutral` (xám bình tĩnh), không dùng xanh.
- **`neutral` cho "chưa biết / chưa tới việc" (chốt 2026-08-18, gói C — 07 §12 "màu = chữ")**: `CrewIssueLevel` (`lib/crew.ts`) = `danger | warn | neutral | ok` — `neutral` = "Chưa ghi hạn bảo hiểm" (có bảo hiểm nhưng chưa ghi hạn, không dám nói "ổn", không doạ đỏ); `requestStatusVN` (`lib/owned-assets.ts`) chỉ còn `ok | neutral` — "Đã nhận — chờ gọi lại" / "Đang xử lý" là neutral, KHÔNG vàng; nợ SDVICO chưa tới hạn = neutral "Chờ thanh toán — hạn dd/mm/yyyy"; thẻ MẪU đeo băng neutral "Ví dụ: …". Vàng chỉ dành cho việc bà con phải làm; đỏ khi chậm là mất tiền/phạt/nguy hiểm (`days === 0` = đỏ).

### Đặt hàng — bộ đếm số lượng + chip trạng thái đơn (2026-08-11)

- **Bộ đếm số lượng** (`QtyStepper`, export từ `cart-sheet.tsx`): 2 nút − / + tap ≥3.5rem + ô số ở giữa, dùng cho thẻ hàng orderable ở Cửa hàng và trong giỏ. Clamp 1..999. KHÔNG tự chế stepper khác.
- **Chip trạng thái đơn**: `moi` = field/navy (neutral), `da_nhan` = warn, `dang_giao` = sea (xanh biển đặc), `da_giao` = ok (xanh lá), `da_huy` = danger. Nhãn từ `ORDER_STATUS_LABELS` (`lib/catalog-orders.ts`) — GIỮ đồng bộ nhãn ở app chủ tàu và /quan-tri.
- **Giỏ + đặt hàng** ở **bottom-sheet** (`cart-sheet.tsx`) như mọi form tạo/sửa; nút giỏ nổi hiện `cartCount`. Đặt đơn nêu rõ "không thanh toán trong app"; mất mạng báo trung thực "cần có mạng" (online-only).

## 3. Typography

- **Archivo** — display/heading: đậm chắc, đáng tin, kiểu "thiết bị hàng hải" (đã thay Baloo 2 ngày 2026-06-10 — feedback: tròn trịa quá thành trẻ con)
- **Plus Jakarta Sans** — body (thay Be Vietnam Pro 2026-06-11, user: "dùng loại international hơn"): geometric-humanist kiểu app toàn cầu, subset `vietnamese` đầy đủ dấu, nét đậm chắc hợp UI chữ to.
  **Đây là ngoại lệ [DEF] hợp lệ theo ui-design-logic** (SKILL.md rule FONT — cơ chế `## Ngoại lệ đã duyệt`): lý do AUDIENCE (ngư dân 40–60 tuổi, UI chữ to ≥18px ngoài nắng, cần subset tiếng Việt đủ dấu nét đậm) + user chỉ đích danh 2026-06-11 — không phải "trendy". Font này nằm trong danh sách chê của skill ở project KHÁC; ở đây nó là quyết định audience có căn cứ (hội đồng 2026-08-13).
- Base ≥ 18px; heading to rõ; không dùng font-weight mảnh (light/thin)

### Type ramp — nguồn duy nhất của cỡ chữ arbitrary (chốt 2026-08-13, hội đồng)

type-ramp: 0.75rem 0.8125rem 0.875rem 0.9375rem 1rem 1.125rem

- 6 bậc trên phủ 800/919 (87%) lượt `text-[…rem]` đo thực tế toàn app (`grep -rhoE 'text-\[[0-9.]+rem\]' src | sort | uniq -c`). Hook 3b2 WARN mọi cỡ ngoài ramp trên file staged — dùng bậc ramp, hoặc thêm bậc vào ĐÂY kèm lý do (thêm bậc = sửa dòng `type-ramp:` cùng commit).
- **Nợ đuôi ~119 chỗ / 11 giá trị** (1.0625 / 0.6875 / 1.1875 / 1.25 / 1.5 / 1.375 / 1.75 / 0.625 / 4.5 / 1.625 / 1.3125): dọn dần khi chạm file (WARN nay → BLOCK sau 1 sprint). **CẤM nới ramp để im cổng** — nới >2 bậc trong sprint đầu = cổng thành no-op, rút lui theo tiêu chí hội đồng.
- Ngoại lệ đã biết: `text-[4.5rem]` (1 chỗ, hero display) — khi chạm file đó, chuyển thành cỡ display có tên; nhãn trục data-viz 12px xem ngoại lệ data-viz dưới.
- **Ngoại lệ data-viz** (lift từ 07-design-spec §Trục 2 — luật hệ thống sống ở đây): nhãn trục/chú thích trong SVG chart được 12–13px dù sàn body ≥18px — SỐ QUAN TRỌNG vẫn phải to ở tầng HTML (vd số tuần mới nhất in to trên biểu đồ giá); chỉ nhãn phụ trợ trong chart được nhỏ.
- **Sàn 18px cho body/input (2026-06-10)**: đã quét sạch `text-[17px]` → `text-[18px]` toàn app (kể cả `inputClass` trong `ui/primitives.tsx`). Chữ phụ (nhãn mục, ghi chú nguồn) được phép 13–16px nhưng KHÔNG dùng cho nội dung chính cần đọc ngoài nắng. Thẻ 4 trục ở Home: tiêu đề 19px display, mô tả 14px, thẻ dọc icon-trên-chữ-dưới.

## 4. Motif & tone

- **Wave motifs** (họa tiết sóng) làm điểm nhấn trang trí — nhẹ, không lấn nội dung
- **Icon: chỉ dùng stroke SVG trong `src/components/icons.tsx`** (nét 2.2px, luôn kèm nhãn chữ). **KHÔNG dùng emoji làm icon hay trang trí** — emoji làm app thành đồ chơi, mất tin cậy. Không hoạt ảnh "dễ thương" (nhún nhảy, lắc lư).
- Bo góc (đã đổi theo redesign "Mặt nước" 2026-06-10): thẻ nội dung `.surface` 20px, hero/sheet 28px, nút/chip/tab pill — xem mục 2. Vẫn KHÔNG "đồ chơi": không emoji, không hoạt ảnh nhún nhảy, icon stroke + chữ như cũ
- Tone copy: như người quen trong nghề nói chuyện — ngắn, điềm đạm, cụ thể ("Đăng kiểm sắp hết hạn, còn 12 ngày — đi gia hạn sớm kẻo phạt"); hạn chế dấu chấm than
- Không dùng từ kỹ thuật trong UI: "đồng bộ", "xác thực", "session"...

## 5. Cách dùng tokens (Tailwind v4)

- Tất cả màu khai báo ở `:root` + map qua `@theme inline` trong `src/app/globals.css` → dùng class Tailwind (`text-t4`, `bg-t1-bg`, ...)
- **KHÔNG hardcode hex trong component** — thêm màu mới thì thêm token trước
- Đổi/thêm token → update file này cùng commit (invariant trong root [CLAUDE.md](../../CLAUDE.md))
- **Ngoại lệ duy nhất — màu nội dung bản đồ** (Trục 1): màu mask nước biển, gradient chú giải thang đo vệ tinh, màu vẽ tuyến dẫn đường (MapLibre paint không nhận CSS variable) là nội dung dữ liệu (khớp palette ảnh vệ tinh/basemap), KHÔNG phải màu UI → khai báo tại `src/lib/ocean-map.ts` kèm comment, không đưa vào tokens. UI chrome quanh bản đồ (nút, thẻ, badge) vẫn dùng tokens như thường.

## 6. Pattern bản đồ (Trục 1)

- **Nhãn chủ quyền**: BIỂN ĐÔNG / VỊNH BẮC BỘ / VỊNH THÁI LAN + HOÀNG SA (TP. Đà Nẵng — VN), TRƯỜNG SA (Tỉnh Khánh Hòa — VN) render bằng HTML marker tiếng Việt, halo màu nước để đọc được trên mọi lớp ảnh; tile quốc tế bị che bằng mask ở zoom ≤9. KHÔNG để lộ "South China Sea / Paracel / Spratly". Map view mới phải dùng lại `buildMapStyle` + `SOVEREIGNTY_LABELS` từ `src/lib/ocean-map.ts`.
- **Chọn lớp ảnh**: nút to ≥56px, icon + từ đời thường ("Hải đồ độ sâu", "Nước nóng lạnh", "Vùng nhiều mồi", "Ảnh mây trời") — không dùng thuật ngữ SST/chlorophyll trong UI. **Lớp mặc định khi mở = Hải đồ độ sâu** (chuẩn mọi app hàng hải — Navionics/C-MAP/OpenCPN mở nautical chart, vệ tinh chỉ là tuỳ chọn; xem [../research/09-hai-do-mac-dinh.md](../research/09-hai-do-mac-dinh.md)); app nhớ lớp người dùng chọn (`forfish.maplayer.v1`).
- **Trung thực dữ liệu**: luôn hiện "Ảnh ngày X — ảnh vệ tinh luôn chậm vài ngày" đè góc bản đồ; chú giải nói rõ "chỗ trống là mây che".
- **Hải đồ có số (2026-06-10, user: "hải đồ không thấy được, toàn màu xanh")**: nền hải đồ kèm **đường đẳng sâu + nhãn số mét** (20/50/100/200/500/1000/2000 m) tự sinh từ ETOPO (`scripts/generate-isobaths.mjs` → `public/data/isobaths.v1.json`, ~200 KB) vì EMODnet WMS chỉ phủ châu Âu. Style cần `glyphs` (fonts.openmaptiles.org) cho nhãn. Chỉ vẽ trên nền hải đồ, không vẽ đè nền vệ tinh.
- **Legend tại chỗ (kiểu Google Maps)**: badge góc trái = tên lớp + ngày + **thanh gradient mini + 2 đầu thang** của nền đang xem; lớp Dự báo cá có legend riêng ở cuối hàng chip loài ("khả năng có cá" xanh lá nhạt→đậm). KHÔNG bắt người dùng mở sheet mới biết màu nghĩa là gì.
- **Lớp Dự báo cá** — ~~heatmap MỖI LOÀI MỘT MÀU + hồng tâm (2026-06-10, tham khảo PFZ của OceanFishMap): ô điểm → lớp `heatmap` maplibre, màu theo loài (`SPECIES_PROFILES.color` → ramp 1 sắc qua hàm `fishHeatColor`), "Mọi loài" = xanh lá `#95d5b2→#1b4b2c`~~ → **từ 2026-07-27 (đính chính doc 2026-08-18, khớp `fishing-map-view.tsx` + `FISH_LEVEL_BANDS` trong `fish-predict.ts`): LƯỚI Ô kiểu bản tin ngư trường, 3 MỨC CỐ ĐỊNH không đổi theo loài** — Thấp ≥40 xanh lá `#22c55e` · Trung bình ≥60 vàng `#eab308` · Cao ≥75 đỏ `#ef4444` (`fill-opacity` 0.6, chỉ màu không in số; chọn loài chỉ đổi điểm từng ô). `SPECIES_PROFILES.color` vẫn còn (marker/thẻ loài), hàm `fishHeatColor` ĐÃ XOÁ. ≤8 điểm nóng nhất (≥75 điểm, cách nhau ≥0.7°) vẽ marker **hồng tâm** `TargetIcon` tô màu loài đang chọn — chạm là bay tới; điểm nóng GẦN MÌNH (≤~40 hải lý) viền cam. Thẻ cá kèm số môi trường ("Nước 28°C · mồi vừa") + **tuần trăng** (`lib/moon.ts`); loài ĐÁY/RẠN (`surfaceSignal` low) hiện cảnh báo vàng "đoán theo mùa + độ sâu, ảnh vệ tinh ít chính xác". Màu loài là NỘI DUNG bản đồ (khai trong `fish-predict.ts`, ngoại lệ §5). Phân màu CHUNG: cá = màu theo loài; cam-đỏ = riêng ranh giới; xanh dương = tuyến đi.
- **Chọn loài cá = nút GỌN + bảng modal (sửa 2026-06-11, user: "hàng chip ngang chắn map, không ẩn hiện gọn")**: BỎ hàng chip cuộn ngang full-width (chắn nhãn chủ quyền, 40 loài cuộn mệt). Thay bằng **một nút "Cá" nhỏ** (`inline-flex max-w-[80%] self-start`, chỉ rộng bằng nội dung) hiện loài đang chọn + chấm màu + chevron; chạm mở **`fish-species-sheet.tsx`** (modal `ui/bottom-sheet`): "Mọi loài" trên cùng + loài đang vụ **gom theo nhóm** (`CATEGORY_LABEL`), mỗi loài chấm màu + tên đầy đủ, **loài vùng đang xem viền cam + xếp đầu nhóm**; chọn xong đóng luôn. Map chỉ còn nút gọn — không vật gì chắn ngang. Chọn loài thì heatmap + hồng tâm tô CHỈ theo màu loài đó. **Ưu tiên gần mình**: điểm nóng cộng thưởng theo khoảng cách tới chỗ xem / cảng nhà / điểm ghim (không bịa cá, chỉ xếp gần lên trước); thẻ cá có dòng "Điểm cá gần bạn nhất ~N hải lý hướng X".
- **Lớp che ↔ chi tiết gần bờ (sửa 2026-06-10)**: sea-mask (che nhãn quốc tế Biển Đông) chỉ ĐẶC ở mức toàn cảnh (z≤6), mờ dần và TẮT ở z8 — không che luồng lạch/cảng khi zoom gần bờ. Lớp ảnh/độ sâu (`ocean-data`) có `maxzoom 12` → zoom sâu hơn thì nhả ra cho basemap (bờ, cảng, sông lạch) + phao đèn hiện. Phao đèn/luồng lạch (OpenSeaMap) `minzoom 8`. Nguyên tắc: sovereignty ở mức vùng, hải đồ chi tiết ở mức gần bờ — không đánh nhau.
- **Chọn ngày dự báo**: dãy chip ngang cuộn được (mỗi chip ≥60px cao, nhãn ngày + điểm số tô màu mức), chip đang chọn nền navy. Dự báo càng xa càng kém tin → bắt buộc kèm dòng độ tin (`forecastConfidence`) dưới số liệu, tông `--warn` từ ngày thứ 4 trở đi — KHÔNG để mọi ngày trông chắc chắn như nhau.
- **Màn hình map-first (2026-06-10)**: tab Ra khơi là map FULL-SCREEN kiểu Google Maps nhưng đơn giản hoá cho người lớn tuổi — KHÔNG gesture phức tạp, sheet điều khiển bằng NÚT TO ("Xem thêm"/"Thu gọn"/"Về cảng" ≥52px, nút thoát hiện Ở MỌI NẤC và phải tự giải thích), FAB luôn icon + chữ (không icon trơ trọi). Zone rules: tin bão TRÊN CÙNG không gì che; dải giữa màn hình để trống cho nhãn chủ quyền/pin/tâm bão; badge lớp+ngày ảnh luôn hiện (trung thực dữ liệu). Layer sheet: lớp chính chọn-MỘT (chọn xong ĐÓNG NGAY để thấy bản đồ đổi) + overlay bật/tắt; **ranh giới biển VN, vị trí bão, nhãn chủ quyền không bao giờ có công tắc** — ghi 1 dòng tĩnh. Sheet đáy dùng `ui/snap-sheet.tsx` (thường trực, không scrim); picker mở-chọn-đóng dùng `ui/bottom-sheet.tsx` (modal). **Ô nguồn bản đồ** (2026-08-24, `globals.css` `.maplibregl-ctrl-attrib*`): nút ⓘ 1.375rem góc TRÁI đáy, bung ra thì chữ 0.625rem + trần `min(72%,18rem)` × 5rem cuộn trong — không bao giờ tràn ngang đáy che thanh kéo sheet. Đây là dòng nguồn BẮT BUỘC theo điều khoản CARTO/OSM: được thu, KHÔNG được bỏ. **Vá 2026-08-25**: thu `background-size` của control MapLibre thì PHẢI kèm `background-repeat: no-repeat` + `background-position: center` — MapLibre không khai `background-repeat` (mặc định ảnh 24px vừa khít nút 24px), ảnh nhỏ hơn nút là LÁT LẠI, hiện ⓘ thứ hai cắt dở (user: *"cái ở góc lỗi gì mà nó tròn vo thế"*).
- **"Điểm của tôi" thay "chọn cảng" (user chốt 2026-06-10)**: ngư dân nghĩ theo CHỖ CỦA MÌNH (bãi hay đánh, rạn quen), không theo danh mục cảng. Bỏ `<select>` cảng. Thay bằng: ghim chỗ đang xem (đặt tên) → sao vàng trên bản đồ + mở 1 chạm; FAB "Điểm tôi" mở sheet quản lý (GPS + ghim + cảng nhà). Cảng nhà chọn 1 lần qua Ô TÌM KIẾM 173 cảng (gõ lọc tên/tỉnh/huyện, KHÔNG đổ list dài). "Về cảng nhà" chỉ hiện khi đã đặt cảng nhà và đang xem chỗ khác — quay về vùng biển nhà (trước đây vô nghĩa vì luôn nhảy về 1 cảng seed cứng).
- **KHÔNG PHÁN "đi hay không đi" (user chốt 2026-06-10)**: bản đồ mô tả ĐIỀU KIỆN bằng tình trạng biển ("Biển êm/Biển động nhẹ/Biển động mạnh") + con số (sóng m, gió cấp Beaufort, giật cấp) — không hiện điểm số /100, không lời khuyên ra khơi. Ngư dân có lịch chuyến riêng; quyết là việc của thuyền trưởng.
- **Dự báo kiểu Windy**: thanh thời gian nổi trên map (chỉ hiện khi bật lớp Gió/Sóng) — nhãn giờ tiếng Việt ("Hôm nay · 13h"), slider to + nút chạy ▶; mũi tên chỉ HƯỚNG ĐI của gió/sóng, màu xanh→đỏ theo độ dữ (ngưỡng khớp mức cảnh báo: gió 39 km/h ~ cấp 6, sóng 2,5 m). Lớp "Cá mùa này": polygon viền đứt mảnh + chip nhãn loài rút gọn; tên đầy đủ + chữ "tham khảo" nằm trong sheet.
- **Sau audit team 2026-06-10 (3 reviewer) — quy tắc chống "rối"**: (1) sheet đáy chỉ có MỘT chế độ — "gió sóng chỗ đang xem", mở app = điểm đặt sẵn tại CẢNG NHÀ, không xây màn hình cảng riêng trùng chức năng; (2) **cam đỏ là màu ĐỘC QUYỀN của ranh giới biển** trên bản đồ — tuyến dẫn đường dùng xanh chỉ đường `#1a73e8` (hằng `ROUTE_LINE_COLOR`); (3) vị trí nói tiếng người ("Cách cảng X ~Y hải lý hướng Z"), toạ độ số chỉ nằm cuối sheet cho ai đọc vào máy định vị; (4) số liệu jargon không hành động được thì BỎ (đã bỏ "nhịp sóng X giây"; gió giật nói bằng "giật cấp N"); (5) khoảng cách ranh giới chỉ nói khi gần (cảnh báo), xa hàng trăm hải lý thì im; (6) màu mask nước phải sample từ tile basemap thật (#d5e8eb), không ước lượng; (7) tính xong tuyến KHÔNG thu sheet — kết quả + cảnh báo đoạn dữ phải còn đọc được, map nhìn thấy tuyến nhờ fitBounds chừa đáy; (8) thất bại phải lên tiếng (định vị fail, nguồn bão fail) — không có thất bại câm; (9) **chạm điểm trên biển → sheet ở nấc PEEK kiểu Windy** (user chốt 2026-06-10): thẻ gọn dưới đáy hiện tóm tắt (tình trạng biển + sóng/gió + vị trí), BẢN ĐỒ KHÔNG BỊ CHE — chi tiết là việc của nút "Xem thêm", KHÔNG tự nhảy lên nấc half.
- **Ô TOẠ ĐỘ + HAI HÌNH ĐỊNH VỊ (2026-08-25, góp ý bà con qua VSS Quân Bình Định)**: màn Ra khơi có **dải toạ độ kiểu máy định vị** ở góc trên trái (`components/plotter-readout.tsx`, thẻ `.glass`, cao 42px) — hàng **TÀU** (toạ độ GPS) + hàng **TRỎ** (toạ độ chỗ đang xem + cách tàu bao xa/hướng nào). Dải này là chỗ ĐỌC, không phải nút; nút "my location" vẫn là nút **Vị trí** ở rail phải và nó CHỈ đưa bản đồ về chỗ mình đứng, không dời con trỏ. **Quy ước hình, dùng chung mọi chỗ**: vị trí MÌNH = **chấm nhấp nháy** (`NavBoatMarker`, chấm 1.875rem viền trắng 4px + quầng ping 2.625rem — chốt sau hai nhịp chỉnh cỡ 2026-08-25; mất tín hiệu thì tắt nháy + mờ) · chỗ TRỎ TỚI = **cái ghim** (`PinIcon`, `anchor="bottom"` để chân ghim rơi đúng toạ độ) — hình trong dải toạ độ phải Y HỆT hình trên bản đồ. Đã thử vòng ngắm và mũi tên cho con trỏ, cả hai đều bị chê lạ mắt: bà con quen ghim kiểu Google Maps. Đính chính bullet audit 2026-06-10 mục (3): câu "Cách cảng X ~Y hải lý hướng Z" ĐÃ BỎ (2026-08-25) — nó đo từ CON TRỎ mà đọc như đang nói về TÀU; toạ độ nay in ở CẢ dải góc (liếc lúc lái) lẫn cột phải peek sheet (đọc kỹ lúc dừng), đó là hai việc khác nhau chứ không phải nói hai lần. Chi tiết + ma trận trạng thái: [07-design-spec §10.9](07-design-spec.md).

## 7. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-08-18
