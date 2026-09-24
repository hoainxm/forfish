# 03 — Design system: thiết kế cho ngư dân / Audience-first design

> **Mục đích / Purpose**: Hướng thiết kế canonical của ForFish — bắt đầu từ người dùng (ngư dân 40–60 tuổi, nắng chói, tay ướt), không bắt đầu từ trend.

**Load khi / Load when**: sửa UI, màu sắc, typography, copy, trạng thái (status), hoặc thêm component mới.

covers: src/app/globals.css
last_verified: 2026-09-24
ttl_days: 90
<!-- DOC-STATUS: SUSPECT (2026-09-09) — code 'src/app/globals.css' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
gate: warn
<!-- re-verified: 2026-09-24 16:00 — ĐỐI CHIẾU globals.css cho fix dock: `.dock-frame`/`.bottom-dock`/`--dock-row`/`--dock-total` còn khớp; `.anim-*` (motion điềm đạm) còn; `.sq-btn:active { scale(0.95) }` + transition color/bg/transform còn (mọi nút hành động đã có press feedback). THÊM `.dock-label` (nhãn dock 1 dòng, cỡ chữ hạ theo bề ngang máy) — xem §"Nhãn ngang hàng" mục 5. Bug đã sửa: "Bạn thuyền"/"Trang chủ"/"Giao dịch" gãy 2 dòng ở ≤399px → icon lệch khỏi pill. -->
<!-- re-verify(03): dock-label responsive + sq-btn:active + anim-* motion -->

<!-- re-verified: 2026-06-30 - safe-area pb env(sab), edge-to-edge mobile native, motion điềm đạm khớp globals.css hiện tại (4 commit UI tween đã review) -->
<!-- re-verified: 2026-08-18 — ĐỐI CHIẾU `globals.css` (bản 2026-08-14 b0bd111) với doc: (1) 51 biến `--*` trong `:root`/`@theme` — bảng màu theo trục có 4 hex LỆCH từ đợt chỉnh AA (t1 #18648b · t2 #2e7d4f · t3 #8f6010 · t4 #7a4d9e) → sửa bảng theo mã, ghi kèm `--tN-bg` + bộ trạng thái ok/warn/danger (+ `-bg`); bổ sung tên token nền tảng `--navy/--sea/--trim/--sun/--foreground/--card/--line` mà doc chỉ gọi bằng tên chữ. (2) `.surface` · `.glass` · `.range-big` · `.range-dual` · `.display` · `.anim-*` · `.dock-frame`/`.bottom-dock`/`--app-vh`/`--dock-*` đều còn trong mã, khớp mục 2/3/6. (3) giá trị oklch ở mục "Token chờ lift" là GIÁ TRỊ MÀU chưa lift, không phải symbol mã — bỏ backtick để doc-health khỏi báo dead-symbol oan; nội dung không đổi. (4) Mục 6 "Lớp Dự báo cá" còn tả heatmap theo loài + hàm `fishHeatColor` (đã xoá) → đính chính theo mã hiện tại (lưới ô 3 mức `FISH_LEVEL_BANDS`, từ 2026-07-27 — 07 đã ghi, 03 chưa). (5) Gói C 2026-08-18: thêm bullet `neutral` cho `CrewIssueLevel`/`requestStatusVN` ở mục "Ngôn ngữ trạng thái" — không token mới. -->
<!-- re-verified: 2026-08-29 — DOCK iOS: RÚT GỌN `--app-vh` về ĐÚNG một luật (chủ dự án chốt, máy iOS 26.6 vẫn lỗi sau nhiều vòng vá): "đọc khung nào lớn hơn thì CỐ ĐỊNH theo khung đó thôi". viewport-gap-fix.tsx nay = CHỈ CHO LỚN LÊN rồi KHOÁ (`measured <= stableBottom → return`), trần `screen.height` (bỏ glitch vọt), lưu localStorage. ĐÃ BỎ nhánh "tự hạ theo tab ngắn" (>32px) — chính nó gây DAO ĐỘNG qua lại 2 tab = lỗi "khung kia cụt / không lưu". ĐÃ BỎ cổng phiên bản `viewportBugFixed()` (native 26.6 vẫn lệch per-tab → workaround chạy cho MỌI bản cài iOS). CSS `:root.pwa-frame` (dock-frame/app-shell/full-map theo --app-vh) KHÔNG đổi; app-shell min-height=--app-vh vẫn ép tab ngắn nở bằng tab dài. -->
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
- **Chấm nhịp cập nhật lớp bản đồ + accent cá** (2026-08-29g, dời khỏi hex cứng trong `ra-khoi-controls.tsx` sau rà soát design): `--cadence-hour` #f59e0b (🟧 theo giờ) · `--cadence-day` #eab308 (🟨 theo ngày) · `--cadence-fixed` #64748b (⬛ cố định) · `--fish` #2d8659 (accent cá hiện tại — đổi giá trị khi build "Ra khơi A" hồng tím ở mục dưới). Chấm "🟥 liên tục" dùng lại `--trim`. Dùng qua `var(--…)` trong inline style (không có bản `--color-*` vì không cần class Tailwind). Lý do tồn tại: hook `1d-r` chặn hex/rgba literal trong chuỗi JS — màu UI phải là token.

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
- **Hướng dẫn trên màn (coach-tour) ĐÃ GỠ 2026-08-26** — component `ui/coach-tour.tsx` + engine `lib/tour.ts` đã xoá (chủ dự án chốt "app cần hướng dẫn là app đểu, bỏ luôn"). KHÔNG dựng lại tour tự-bung; sách hướng dẫn HTML ngoài app vẫn còn ([07 §12](07-design-spec.md)).
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
5. **Dock 5 cột — nhãn cố định, KHÔNG cuộn được**: dock là 5 mục cố định (`grid-cols-5`), không được cuộn ngang như tab. Nhãn 2 chữ (Bạn thuyền · Trang chủ · Giao dịch) rộng ~65px ở 12px, mà ô dock chỉ 54–68px tuỳ máy ⇒ ở máy hẹp nhãn GÃY 2 DÒNG, icon+chữ tràn khỏi pill trắng, lệch so với các tab khác (bug user 2026-09-24). Cách chống: class `.dock-label` (globals.css) = `white-space:nowrap` + hạ cỡ chữ theo BỀ NGANG máy bằng media-query, GIỮ rem (không clamp font — hook 1d-n): ≥400px `0.75rem` · 345–399px `0.6875rem` · <345px `0.625rem`. `line-height:1.15` (không `leading-none`) để chừa dấu tiếng Việt. Đo thật: 1 dòng ở mọi bề ngang 320→430px. Dock item bấm có `active:scale-95` + `transition-[color,background-color,transform]` (khớp `.sq-btn:active`).

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
- **Vòng gom "+N" trên hải đồ (2026-09-03c, kiểu Navionics)**: chỗ nhiều phao/tiêu chồng nhau ở tầng VỪA/SÁT gom thành **vòng trắng viền navy 2 px, số navy "+N"** (`CLUSTER_BADGE` trong `ocean-map.ts`, bán kính 13 = 26 px; navy `#14324f` trên trắng 13,6:1). Cố ý **trung tính** — không mượn đỏ/xanh/vàng của phao để không bị đọc thành một loại phao, không mượn cam-đỏ cảnh báo vì cụm không phải hiểm hoạ. Chạm vòng = phóng tới 2 nấc (không mở thẻ). Tầng XA (đèn lớn) **không gom**: một ngọn đèn bị nuốt vào cụm là mất mốc. Nấc hiện của mọi lớp hải đồ lấy từ `CHART_TIER` (LUÔN z5 · XA z7 · VỪA z9 · SÁT z11) — xem [07-design-spec.md](07-design-spec.md) §A "BA TẦNG HIỆN CÓ TÊN".
- **Ký hiệu trạm con nước = KHỐI NƯỚC MẶT SÓNG (2026-09-04, "đừng dùng hình tròn" → bản 2 "không viền, lượn sóng")**: một khối màu **không khung, không viền INK**, đáy bo, mặt trên lượn sóng, cao theo biên độ ngày; **BLUE `#2b74c4`** (màu mới thứ 9 của bảng sprite; 3,77:1 nền biển · 3,49:1 với INK — cổng test) + ▲ INK khi đang lên, **RED** + ▼ khi đang xuống, **SLATE** chỉ mặt sóng khi đứng; trạm mô hình khối kẻ sọc khe trong suốt. **Ngoại lệ có đo của luật "mọi ký hiệu có viền INK"** (mục 2 đầu `build-chart-sprite.mjs`): viền tồn tại để cứu vàng/trắng chuẩn IALA (1,3–1,4:1 trên nước); ba ruột này tự vượt sàn 3:1 nên cổng "vành ngoài" của `chart-symbols.test.ts` vẫn đo trên cả 18 ô và xanh — luật được thoả bằng chính màu ruột, không phải bị bỏ. `TIDE_STATION_COLOR` (nhãn) = đúng mã BLUE — một thứ, một màu. Kênh màu riêng: khác navy nhãn đảo, teal rạn, lục khu trú bão, lục phao phải luồng, magenta đèn, tím xác tàu. Nhãn cùng màu, halo trắng, Noto Sans Bold. Trong thẻ con nước: chip xu hướng **lên = t1, xuống = warn, đứng = field**; chấm đỉnh triều t1, chân triều warn — đỏ để dành cho vạch "bây giờ" và cảnh báo, không dùng cho nước ròng (nước ròng không phải hiểm hoạ).
### Khung nhập / panel nổi — CHỈ BÀY CÁI KEY (2026-08-29; nới ra TOÀN APP 2026-08-29e)

Chủ dự án: *"ở từng thao tác xác định rõ key cần là gì, cái nào có thể ẩn đi (collapse/expand) hiển thị thông minh, đừng để chiếm màn hình quá nhiều"*.

**Luật**: mỗi thao tác chỉ có MỘT–HAI thứ người dùng thật sự phải nhập. Bày đúng thứ đó; mọi thứ khác thu lại sau một nút, hoặc **đoán sẵn giá trị hay đúng nhất** rồi cho sửa.

Ba câu hỏi trước khi thêm một ô vào khung:
1. **Key là gì?** — bỏ ô này thì việc còn làm xong không? Không ⇒ giữ. Còn ⇒ thu.
2. **Máy đã biết chưa?** — biết rồi thì ĐIỀN SẴN, đừng hỏi. Điền sẵn là đoán cái hay đúng nhất, không khoá tay ai: luôn kèm đường sửa.
3. **Có đang giúp việc ĐANG LÀM không?** — không thì thu trong lúc làm việc đó, xong thì trả lại.

**Ca mẫu — form "Thêm điểm"** (`my-places-sheet.tsx`): key là **cái tên**; toạ độ máy đã biết (chỗ con trỏ đang chỉ, và lối vào chính là menu chạm-giữ nên bà con VỪA chỉ bằng ngón tay). Trước: 6 ô cùng lúc — ô tên · nút "Lấy chỗ đang trỏ" · 2 ô vĩ/kinh độ · Hủy · Lưu, trong đó nút và 2 ô là **hai đường cho cùng một việc** mà toạ độ đã điền sẵn; placeholder còn bị cắt cụt (`"Vĩ độ (vd 8 3"`). Nay: [ô tên + ô nút **Lưu** inline] · **một dòng toạ độ đọc-được** + ô nút **Sửa** · [ô nút **Huỷ**]; hai ô nhập chỉ hiện khi bấm Sửa; danh sách điểm và hàng "Chọn cảng nhà" **thu trong lúc đang nhập** (chúng không giúp gì cho việc đang làm).

**Đo thật (375×812)**: popup lúc mở form **563px (69% màn) → 296px (36%)**; số ô nhập bày sẵn **6 → 1**; toạ độ điền sẵn thay vì báo "Chưa có toạ độ".

**MÀU TUYẾN THEO CHẶNG (2026-08-29g)** — `ocean-map.ts`: xanh `ROUTE_LINE_COLOR #1a73e8` = không có gì · cam `ROUTE_LEG_AMBER #e8710a` = chú ý vừa · đỏ `ROUTE_LEG_RED #d92d20` = phải lưu ý · xám `ROUTE_LEG_PASSED #8a94a0` = đã đi qua. Bề dày đi kèm màu (5 / 4,5 / 3,5 / 2,5px) vì nắng chói làm màu bạc nhanh — chỉ dựa vào màu là thua. **Không phạm quy ước cam-đỏ độc quyền của ranh giới**: đỏ tuyến là đỏ TƯƠI khác đỏ GẠCH `#b42318`, tuyến luôn có viền trắng dày, và ranh giới là đường dài chạy suốt màn còn chặng là khúc ngắn nối hai ghim số. Lý do đầy đủ ở 07 §10.7 L2.

**MÀU CHẤT ĐÁY + KHU TRÁNH TRÚ BÃO (2026-09-03)** — `ocean-map.ts`, cùng ngoại lệ "màu nội dung bản đồ" (không phải token UI). **`CHAT_DAY_COLORS`** — mỗi loại đáy một màu ĐỦ TÁCH NHAU và đủ SẪM để đọc dưới nắng trên nền biển sáng (#d5e8eb), tách khỏi teal rạn / magenta báo hiệu / cam-đỏ ranh giới: Cát `S #d99a2b` (vàng cát) · Đá `R #5c5560` (xám đá) · San hô `Co #e2674a` (cam-đỏ san hô) · Vụn `G #a9743f` (nâu đất) · Cỏ biển `Sg #2f9163` (lục rêu) · Thảm rong `Ma #7f8c2f` (ô-liu); loại chưa rõ `khac #8a949c` (xám trung tính) làm nền lùi. Mã khớp `codes` của `chat-day.ts`. **`KHU_TRU_BAO_COLOR #0e8a5f`** — xanh lục "bến an toàn": khu neo đậu là nơi CHẠY TỚI khi bão, nên CỐ Ý không dùng cam-đỏ (màu hiểm hoạ/ranh giới) — kênh màu riêng, tách cả với xanh chỉ đường của tuyến.

**KÝ HIỆU HẢI ĐỒ TỰ VẼ + MÀU CÁP/ỐNG/VÙNG CẤM + DẢI ĐỘ SÂU (2026-09-03b — theo [research/danh-gia-hai-do-2026-09.md](../research/danh-gia-hai-do-2026-09.md) §A)** — `lib/chart-symbols.ts` + `lib/ocean-map.ts`, vẫn ngoại lệ "màu nội dung bản đồ", không phải token UI.

- **Sprite `public/icons/chart-sprite*` 74 → 80 → 87 ô**, 13 hình mới TỰ VẼ theo luật viền INK + test bóng sẵn có (cấm "adapted" S-52 là cổng thật). Đợt 1 (6): `rock-awash` (đá ngầm — sao 6 gai đỏ) · `bank` (bãi cạn/cồn — nửa elip chấm) · `coral-reef` (rạn — răng cưa) · `no-anchor` (mỏ neo gạch chéo) · `cable-landing` (cáp cập bờ) · `pipeline-mark` (ống dẫn). Đợt 2 (7, địa hình đáy biển cho `dia-danh-ngam`, mặt cắt teal/INK, không đỏ): `seamount` (núi/dãy — hai chóp) · `knoll` (đồi — gò tròn có đồng mức) · `ridge` (sống — răng cưa thấp) · `guyot` (chóp phẳng — hình thang) · `deep` (hố — khoét chữ V) · `valley` (thung lũng/hẻm/kênh — lòng máng U) · `escarpment` (vách/dốc/đèo — bậc); `diaDanhNgamSymbolId(loai)`; `LOCKED_CELLS` khoá hash từng ô của cả 87 (thêm hình mà không khoá là test đỏ). Gom trong `CHART_FEATURE_ICON`; rạn/bãi/đá dùng `CHART_PALETTE.teal #0e7c86` (= `REEF_DOT_COLOR`) — ba HÌNH, một màu: phân biệt bằng hình chứ không đẻ thêm hue. **Sàn icon 16 px** (`CHART_ICON_MIN_PX`) nay áp cả `WRECK_LAYER`/`LIGHTHOUSE_LAYER` (nấc thấp nhất 0,55/0,6 → **0,7** × 24 = 16,8 px) và có test quét.
- **Ba mối nguy — ba nét KHÁC NHAU cả sắc lẫn ĐỘ SÁNG** (đo trên nền biển `#d5e8eb` SAU khi pha mờ, cùng phép với đẳng sâu, có cổng test): cáp quang `SEA_CABLE_COLOR #6d28d9` @`SEA_CABLE_OPACITY` 0,9, dash `SEA_CABLE_DASH` [4,2] → **4,83:1** (cũ `#7c3aed`@0,6 = 2,44) · vùng cấm/giàn `SEA_RESTRICTED_COLOR #b85a00` @0,9 → **3,25:1** (cũ 2,43) · ống dẫn `PIPELINE_COLOR #1f2933` (MỰC — kênh màu duy nhất chưa ai dùng cho nét, và tối nhất = nguy nhất) @0,95, dash `PIPELINE_DASH` [7;2,5;1,5;2,5] vạch–chấm → **10,17:1**. Độ sáng giữa các nét: cáp–vùng cấm 1,49 · cáp–ống 2,11 · vùng cấm–ống 3,13 (cũ cáp–vùng cấm **1,00** — chỉ khác hue, dưới nắng/mù màu là một). Vùng cấm có NỀN `RESTRICTED_FILL_COLOR #b85a00` @`RESTRICTED_FILL_OPACITY` 0,1 (bước 1,13 vs nền — nhận ra, không chói; lên 0,12 là nét đẳng sâu đè lên tụt dưới 3) + nhãn `RESTRICTED_LABEL_COLOR #7a3b00` (6,00:1 trên nền đó).
- **Rạn + chất đáy lên sàn 3:1**: viền rạn `REEF_SHAPE_LINE #0b6b74` @`REEF_SHAPE_LINE_OPACITY` 0,85 → **3,75** (cũ 1,89); fill `REEF_SHAPE_FILL_OPACITY` 0,18 → 0,3 (diện, được phép dưới sàn nhưng phải ≥1,15 để nhận ra); chất đáy `CHAT_DAY_COLORS` tối một bậc (giữ hue để chú giải góc vẫn khớp; san hô về đất nung `#a3452a` — không lấn kênh cam cảnh báo) @`CHAT_DAY_OPACITY` 0,8 → **3,3–4,8** (cũ 1,4–2,1). Bài học ghi lại: "màu đủ sẫm" trong comment cũ là chưa đo — mọi độ mờ nay đi qua hằng `*_OPACITY` để cổng đo được.
- **Dải độ sâu `DEPTH_BANDS` 4 nấc** (fill `k=vung`, màu là màu CUỐI không pha): 0–10 nền biển `#d5e8eb` · 10–20 `#e2f0f3` · 20–50 `#eef6f8` · ≥50 `#f8fbfc`, bước giữa hai nấc 1,05–1,09 (ngưỡng "nhận ra"), nấc sâu nhất KHÔNG trắng tinh vì đất nền cũng sáng. **Đường an toàn** `SAFETY_CONTOUR_M` = 10, `SAFETY_CONTOUR_STYLE #2c5a80` @0,95 dày 1,4→2,6 px (z7→12) → 5,19:1 trên biển, ≥5,5 trên mọi dải.
- Sheet "Ký hiệu là gì?" (07 §A) hiện icon bằng cách **cắt đúng ô từ sprite thật** — chú giải không bao giờ lệch hình đang vẽ.

**CHẾ ĐỘ HIỂN THỊ NAY ĐỔI MẬT ĐỘ, KHÔNG ĐỔI CỠ CHỮ (2026-08-29h)** — chủ dự án: *"nút hạ xuống 37 với chế độ gọn"*. Từ khi cả "to" lẫn "gọn" cùng gốc chữ 16px (chống iOS tự phóng to), công tắc KHÔNG đổi gì — chọn xong màn y hệt. Nay biến `--row-h` trong `globals.css`: **to = 3.5rem (56px)** · **gọn = 2.3125rem (37px)**; `.sq-btn` và mọi thân hàng đọc chung biến đó nên nút và hàng luôn bằng nhau ở CẢ HAI chế độ. Gọn KHÔNG hạ cỡ chữ (dưới 16px là iOS phóng to cả trang khi chạm ô nhập — án lệ "bể ra hết"); gọn = ít đệm, không phải chữ nhỏ. Ở gọn, icon và nhãn nằm NGANG (37px không đủ chỗ xếp icon 24px trên nhãn) — **nhãn không bị bỏ**, icon trơ trọi thì bà con 40–60 tuổi phải đoán.

**37px DƯỚI SÀN CHẠM 56px — chủ dự án chốt sau khi đã nêu lo ngại.** Đây là lựa chọn có ý thức của người dùng cuối, đổi lại thấy được nhiều hàng hơn; ai thấy khó bấm thì chuyển sang "Nút to". Mặc định của app vẫn là 56px. Nhãn công tắc sửa theo: "Chữ to" → **"Nút to"** (nhãn cũ hứa một việc nó không còn làm).

**HÌNH KHỐI NÚT Ở `globals.css .sq-btn`, KHÔNG Ở CHUỖI TAILWIND** — chế độ gọn phải đổi cả BỐ CỤC nút, thứ một chuỗi tĩnh không làm được; nhân đôi chuỗi theo chế độ là quay lại đúng bài học hai bản chép tay. `SQ_BTN` nay chỉ còn tên lớp `"sq-btn"`.

**THÂN HÀNG = NÚT = 56px, KHOẢNG CÁCH 4px (2026-08-29h)** — `SQ_BTN` nâng `3.25rem` → `3.5rem`; mọi thân hàng đặt `min-h-[3.5rem] flex items-center`; khối cuộn dùng `space-y-1` chứ không `space-y-2`. Trước đó thân hàng 37/56/73px cạnh nút 52–56px, không hàng nào khớp nút (chủ dự án: *"các nút đang quá to, nó bằng cái chiều cao của hàng thôi"*). **Kéo HÀNG lên bằng NÚT, không hạ nút xuống bằng hàng** — 56px là sàn chạm của app, hạ là phạm điều KHÔNG ĐƯỢC CẮT của CLAUDE.md. Hàng ba dòng rút còn hai bằng cách bỏ thứ đã suy ra được (toạ độ khi chỗ đó đã có tên). Chi tiết: 07 §10.7 M10.

**HÀNG KHÔNG CÓ NÚT THÌ KÉO HẾT BỀ NGANG (sửa luật B1, 2026-08-29h)** — chừa ô `w-16` rỗng để "mép phải thẳng" chỉ đúng khi hàng đó CÓ nút. Hàng không nút mà vẫn chừa là 72px trống tuyệt đối, trong khi chính dòng chữ bên cạnh đang bị cắt cụt. Đã dính HAI LẦN: hộp thư trang chủ mất 21% bề ngang chữ vì chừa cột không hàng nào dùng, rồi thẻ dẫn đường lặp lại y hệt (chủ dự án: *"khoảng trắng ở kế bên này? nếu ko có nút nào thì kéo ra cho kín"*). Mép phải thẳng là thứ tốt, nhưng không đổi bằng bề ngang của dữ liệu. Đo lại: hàng 263 → 335px.

**KHÔNG ĐƯỢC CÓ NÚT BẤM-KHÔNG-RA-GÌ (2026-08-29h)** — chủ dự án: *"click ko có tác dụng thì ẩn"*. Nút nào ở trạng thái hiện tại không mở ra được gì thì phải ẩn hoặc phải sửa cho mở được; không để nút đứng đó bấm hụt. Án lệ: cổng render viết theo cách kể tên từng panel (`|| panel === "saved"`) làm "Tuỳ chọn" ở màn kết quả bấm ra thẻ RỖNG. Cổng phải viết theo TRẠNG THÁI (`panel !== "idle"`), thêm panel mới tự chạy. Chi tiết: 07 §10.7 M5.

**MỘT THANH ĐÔNG CỨNG, KHÔNG PHẢI HAI (2026-08-29h)** — panel CÓ TRẦN chiều cao chỉ được ghim ĐÚNG MỘT thanh (thường là hàng trên: danh tính + nút hành động). Muốn ghim thêm thứ gì thì phải BỎ một thứ đang ghim, không cộng dồn. Án lệ: thẻ dẫn đường 252px từng ghim cả hàng trên (~68px) lẫn dải đáy (~76px) ⇒ cửa đọc còn ~104px, chữ bị mép trên và mép dưới cắt ngang cùng lúc, cuộn kiểu gì cũng có một đầu đang cụt (chủ dự án: *"freeze 2 cái trên dưới, nội dung ở giữa kéo khó đọc"*). Cách gỡ: cho MỘT ô hành động gánh hai việc theo trạng thái, khi hai việc đó không bao giờ là "việc kế tiếp" cùng lúc. Đo lại: cửa đọc 104 → 184px, chiều cao thẻ không đổi. Chi tiết: 07 §10.7 L7.

**Trần khung nổi**: mọi panel/popup/bottom-sheet **trên màn bản đồ** giữ ≤ ~40% màn ở trạng thái mặc định. Đo trên bản đồ: Lớp 36% · Đến điểm 31% · Điểm đã lưu 36% · sheet Tài khoản 33%.

**NGOẠI LỆ ĐÃ CHỐT 2026-08-29f — FORM Ở MÀN THƯỜNG KHÔNG BỊ TRẦN 40%.** Sau khi cắt ô theo C1, đo lại 375×812 vẫn vượt: `DocumentForm` **69%** · `BuyerForm` **67%** · `PriceHistorySheet` **73%** (sheet Tài khoản 33% là ca duy nhất đạt). **Chốt: GIỮ NGUYÊN, không ép xuống 40%.**

*Vì sao:* trần 40% sinh ra để **bản đồ còn nhìn được** — nền phía sau là dữ liệu bà con đang cần đọc trong lúc thao tác. Ở `/tau` · `/tien` · `/nguoi` thì nền sau form **không mang thông tin nào đang cần**, nên che 69% không mất gì. Ép xuống 40% ở đây chỉ còn hai đường: giấu ô đang cần (phạm D2 — thao tác câm, án lệ `CrewForm` giấu ô SĐT rồi báo lỗi trỏ vào ô đang ẩn), hoặc chẻ form thành nhiều bước (thêm bước, đi ngược đúng thứ đợt này vừa cắt). **Luật C1 — chỉ bày cái KEY — vẫn áp cho MỌI form, không ngoại lệ**; chỉ con số 40% là bỏ ngoài màn bản đồ.

### Nút hành động — LUẬT VỊ TRÍ & KÍCH THƯỚC (2026-08-29; nới ra TOÀN APP 2026-08-29e)

Chủ dự án: *"cái nút nó là ô vuông kích thước đồng bộ"* · *"nó là 1 nút thì đừng để nó chiếm cả 1 hàng… 1 ô chiếm 1 hàng thì lại mất cân đối trong khi vẫn chiếm chỗ màn hình"* · *"có logic về tối ưu vị trí và hiển thị chưa?"*.

**0. PHẠM VI — CHỦ DỰ ÁN ĐÃ CHỐT 2026-08-29f.** Hai mục này ra đời trên màn bản đồ nhưng luật là luật CỦA APP: áp cho `/` · `/tau` · `/nguoi` · `/tien` như nhau. Các ca mẫu bản đồ bên dưới (route-planner, my-places-sheet, rail phải) giữ nguyên làm ví dụ.

**NGOẠI LỆ ĐÃ CHỐT — NÚT CHÍNH DUY NHẤT CỦA MÀN GIỮ FULL-WIDTH.** Hỏi: luật A2 (cấm nút hành động full-width) có phủ nút submit của form auth không. **Chốt: KHÔNG — giữ nguyên `PrimaryButton` full-width.** Gồm: Đăng nhập · Tạo tài khoản · Lưu mật khẩu mới · Gửi yêu cầu · CTA của [login-gate.tsx](../../src/components/login-gate.tsx) · [doi-mat-khau/page.tsx:105](../../src/app/doi-mat-khau/page.tsx:105) · [quen-mat-khau/page.tsx:97](../../src/app/quen-mat-khau/page.tsx:97).

*Vì sao ngoại lệ này không phá luật:* A2 sinh ra để nút đừng **ăn chỗ của dữ liệu** và đừng **lẫn vào hàng danh sách**. Trên màn auth không có dữ liệu nào để giành chỗ, và nút là hành động **duy nhất** của cả màn — không có gì để lẫn. Thêm nữa Zalo · Grab · Facebook đều dựng nút này full-width; bà con bấm nó bằng phản xạ, bóp về ô vuông 64px là bắt học lại. **Ranh giới:** ngoại lệ chỉ cho nút chính DUY NHẤT của màn. Màn có từ hai hành động trở lên, hoặc nút nằm trong danh sách/thẻ/panel ⇒ về `SQ_BTN` như thường.

**1. MỘT KHUÔN DUY NHẤT.** Mọi nút hành động dùng chung hằng `SQ_BTN` (**`src/components/ui/sq-btn.ts`** — dời khỏi `route-planner.tsx` ngày 2026-08-29d, xem 5d): ô vuông `w-16` × `min-h-[3.25rem]`, `rounded-2xl`, icon `h-6 w-6` + nhãn `0.6875rem` xuống dòng. Đây **đúng khuôn nút rail phải** (Lớp · Vị trí · Đến điểm · Điểm đã lưu · Dẫn đường) — bà con đã quen hình đó ở ngay cạnh, không phải học kiểu nút thứ hai. Đo thật: nút trong thẻ 56×49px = nút rail 56×49px.

**Nhãn 0.6875rem (11px) — CHỦ DỰ ÁN CHỐT GIỮ 2026-08-29f.** Cỡ này thấp hơn sàn *font ≥18px* mà CLAUDE.md đặt cho bà con 40–60 tuổi, nên phải nói rõ vì sao được miễn: sàn 18px là cho **chữ phải ĐỌC** — tên giấy tờ, con số, câu cảnh báo. Nhãn `SQ_BTN` không phải chữ để đọc mà là **chú thích cho icon** ngay trên nó; icon `h-6 w-6` mới là thứ mắt bắt, nhãn chỉ xác nhận. Vùng chạm vẫn đủ **56px**. Nâng lên 0.75rem thì nhãn hai chữ ("Cảnh báo", "Đăng nhập") tràn ô `w-16` — đổi lấy chữ to hơn 1px bằng nhãn bị cắt là lỗ. **Ranh giới:** 0.6875rem CHỈ dùng cho nhãn dưới icon trong `SQ_BTN`. Mọi chữ khác vẫn theo type-ramp, sàn 0.75rem.

**Nợ `0.6875rem` GIẢM (2026-09-03b)**: chữ phụ dưới các công tắc/nhóm trong panel lớp `ra-khoi-controls.tsx` (dòng "tham khảo…", ghi chú nguồn, câu dưới nút "Ký hiệu là gì?") trước cũng dùng 11 px mượn ngoại lệ trên — sai chỗ: đó là chữ ĐỌC dưới nắng, không phải chú thích icon. Nay **`0.8125rem` (13 px)**, mờ tối đa `/75`. Ranh giới ở trên giữ nguyên: 0.6875rem CHỈ cho nhãn dưới icon trong `SQ_BTN`.

**2. CẤM NÚT FULL-WIDTH.** Một dải ngang chiếm trọn bề ngang cho MỘT việc, trong khi thẻ đang tranh từng chục px với bản đồ. Ba ô vuông xếp hàng tốn bằng một dải cũ. **Trả về khuôn 2026-08-29b**: dải "Chọn cảng nhà" (271×52 full-width trong panel Điểm đã lưu) nay là một hàng chuẩn — vế trái nói CẤP DỮ LIỆU (`"Cảng nhà: chưa đặt"` / tên cảng đang đặt), vế phải là ô `w-16` mang icon kính lúp + nhãn "Chọn". **Không bóp cả nút thành ô vuông trơ**: nó là nút MỞ Ô TÌM, ô vuông không đủ chỗ cho nhãn nói nó làm gì. Lợi ích nói đúng, không bán quá: panel đang chạm trần `max-h-[70dvh]` nên xoá dải KHÔNG kéo bản đồ lộ thêm — được là mép phải thẳng một khuôn và chạm trần muộn hơn một điểm ghim.

**2b. HÀNH ĐỘNG GHI ĐÈ PHẢI CÓ ĐƯỜNG LÙI.** Hai hàng kề nhau không được chạy hai luật: hàng "Xóa" có đủ *Xóa hẳn* + *Thôi*, nên hàng "Đổi tên" — cũng là GHI ĐÈ — phải có *Thôi* (thêm 2026-08-29b). Trước đó bấm nhầm "Đổi tên" rồi lỡ chạm ô chữ là không thoát được mà không ghi đè: hoặc bấm Lưu (ghi cái vừa lỡ gõ), hoặc đóng cả panel.

**3. CẤM NÚT ĂN RIÊNG MỘT HÀNG.** Ô vuông đứng một mình giữa hàng trống vẫn tốn nguyên chiều cao hàng và trông lệch. Nút **phải nằm INLINE ở cuối một hàng đã có nội dung** — và là hàng **nó thao tác lên**:

| Nút | Nằm inline ở đâu | Vì sao hàng đó |
|---|---|---|
| Đóng · Tuỳ chọn · Xoá hết | hàng tiêu đề thẻ | thao tác lên cả thẻ |
| **Tính đường / Tính lại** (màn ĐANG SỬA danh sách) | cuối hàng **dòng tóm tắt của THANH GHIM ĐÁY** (đổi 2026-08-29b, xem dưới) | nút chính của cả màn phải luôn thấy đủ, không bị mép thẻ cắt |
| **Tính lại** (màn ĐANG ĐỌC kết quả) | cuối hàng **"Đoạn xấu nhất: sóng ~x m, gió cấp y. Lưới độ sâu ô ~450 m — dò hải đồ, nghe đài duyên hải trước khi chạy."** (đổi 2026-08-29c; "5,5 km" → "450 m" 2026-09-04 theo lưới 15″) | đây là hàng nói tuyến vừa tính xấu chỗ nào — thấy số xấu thì tính lại, đúng hàng nó thao tác lên |
| **Dẫn đường** | cuối hàng **3 con số kết quả** | đọc số xong thì đi |
| Bỏ điểm N | cuối chính hàng điểm đó | thao tác lên đúng điểm ấy |
| **Thêm điểm** (panel Điểm đã lưu) | cuối hàng toggle **"Hiện điểm trên bản đồ"** | trước đây là dải viền đứt ăn trọn một hàng |

Ca ngoại lệ (hàng chủ bị ẩn, vd đủ 6 điểm nên hàng "Chọn điểm đến" biến mất): nút chuyển sang inline với **dòng nhắc** thay thế, KHÔNG bao giờ đứng một mình.

**3b. HÀNG KHÔNG CÓ NÚT VẪN CHỪA Ô (2026-08-29b).** Mọi hàng một khuôn: `[thân bg-background, flex-1]` + `[ô nút w-16]`. Hàng nào không có nút thì render `<span className="w-16 shrink-0" aria-hidden />` — không thì thân hàng nở/co giữa hai trạng thái và mép phải nhảy. Đo được hai chỗ phạm: hàng "Chọn điểm đến" của `route-planner` (khi nút Tính dời xuống thanh ghim) và hàng toggle "Hiện điểm trên bản đồ" của panel Điểm đã lưu (mở form thêm điểm thì toggle nở 199 → 271px). Nay cả hai giữ 199px ở mọi trạng thái.

**3c. THANH GHIM ĐÁY = MỘT HÀNG CHUẨN, KHÔNG PHẢI HÀNG RIÊNG CHO NÚT (2026-08-29b).** Dải `sticky bottom-0` của thẻ dẫn đường VỐN ĐÃ tồn tại và vốn chiếm chỗ, nhưng render RỖNG trừ ca đủ 6 điểm — một dải ăn chỗ mà không làm gì. Nay nó luôn mang đúng một hàng: `[dòng chữ CẤP DỮ LIỆU flex-1]` + `[SQ_BTN Tính/Tính lại]`. **Không trái luật 3**: nút vẫn inline cuối một hàng CÓ NỘI DUNG, chỉ khác là hàng đó nằm trong thanh ghim thay vì luồng cuộn — đúng cách Maps/Grab ghim nút "Bắt đầu". Dòng chữ chỉ nói số liệu, không dạy cách đọc: `"Chưa chọn điểm đến"` · `"1 chỗ · ~252 hải lý thẳng"` · `"3 chỗ · ~546 hải lý thẳng"` · ca đủ 6 điểm giữ nguyên câu cảnh báo. Tổng "chạy thẳng" cộng từ chính `legKm` (không đẻ phép đo thứ hai); một chặng chưa biết toạ độ thì **không** cộng ra tổng — thà nói số chỗ còn hơn bịa số thiếu chặng đầu.

**Đo thật trước/sau (375×812)**: ca MỘT ĐIỂM ĐẾN — nút chính lộ **29/56px** (nội dung 307px trong cửa 252px, `scrollTop=0`, bị mép thẻ cắt đôi) → **56/56px**. Ca 2 chỗ và 3 chỗ cũng 56/56px ở `scrollTop=0`. Chiều cao thẻ không đổi (vẫn chạm trần `max-h-[31dvh]` = 252px).

**3d. NÚT LỆCH KHUÔN CUỐI CÙNG ĐÃ VỀ HÀNG (2026-08-29c).** `route-planner.tsx` còn đúng MỘT nút full-width: "Tính lại" ở màn đọc kết quả (`min-h-[3.5rem] w-full`, đo thật **335×56 trong thẻ rộng 359**), ăn riêng một hàng — trái cả luật 2 lẫn luật 3, mà lại nằm trên đường đi của 100% người tính đường. Nay là `SQ_BTN` inline cuối hàng dặn dò; **câu dặn hải đồ + đài duyên hải GIỮ NGUYÊN CHỮ**, không rút cho vừa hàng ([01-product](01-product.md) bắt buộc). Nhãn dùng lại chữ đã có ở thanh ghim ("Tính lại" / "Đang tính", **không** dấu ba chấm) — không đẻ nhãn mới. Đang SỬA danh sách thì thanh ghim đáy đã là "Tính lại", nên ô này chừa trống theo luật 3b. **Đo sau khi sửa (375×812)**: nút 64×56px, đúng bằng "Đóng" · "Tuỳ chọn" · "Dẫn đường" trong cùng thẻ ⇒ mọi nút của màn bản đồ về đúng một cột ô vuông; nội dung màn kết quả **586 → 401px** (cùng lượt cắt lưới 3 ô, xem [07 §10.7 J](07-design-spec.md)).

**4. Ô NHẬP PHẢI ≥16px THỰC TẾ — ngưỡng của hệ điều hành, không phải bậc type-ramp.** iOS Safari **tự phóng to cả trang** khi focus vào `<input>/<select>/<textarea>` có cỡ chữ dưới 16px. Chế độ "gọn" đặt gốc 14px nên MỌI ô nhập đều dưới ngưỡng ⇒ chạm vào ô gõ toạ độ là màn bung ra: rail tràn khỏi mép phải, dock cắt mất "Giao dịch", bản đồ lệch (chủ dự án báo 2026-08-29: *"cái bản đồ thao tác nó bể ra hết, các rail các menu nó bung ra nó kéo đi tùm lum"*). Ghim trong `globals.css`: `input,select,textarea { font-size: max(16px, 1em) !important }` — `!important` vì class Tailwind (`text-[1rem]`) thắng selector thẻ; `max()` giữ nguyên cỡ lớn hơn ở chế độ "to". **KHÔNG** chặn zoom bằng `maximum-scale=1` — chặn zoom là cắt đường phóng to của người mắt kém, hại đúng nhóm người dùng này.

**5. Vùng chạm không được co.** Rút là rút NHÃN và BỀ NGANG, không rút vùng chạm: `w-16` × `min-h-[3.25rem]` là sàn.

**5b. HAI Ổ CHẠM DƯỚI SÀN (2026-08-29b) — một nâng đủ, một nâng NỬA VÌ ĐO RA MỚI BIẾT.**

(a) **Chip ngày trong sheet gió sóng** (`fishing-map-view.tsx`): `min-h-[2.75rem]` = 44px, mà đây là ô bị chạm nhiều thứ HAI của cả màn — chạm hụt trên tàu lắc dễ thành vuốt dọc, thu luôn sheet. Nay `min-h-[3.5rem]`. **Đo lại sau khi sửa**, không suy: sheet peek 157 → **169px**, bản đồ **70,2%** (bản có dòng cảnh báo biên) — trên sàn 60%.

(b) **Ba nút icon mỗi hàng điểm** trong panel "Điểm đã lưu" (`my-places-sheet.tsx`): `min-h-[3rem] w-11` = 44×48. Kế hoạch là nâng cả hai chiều lên `min-h-[3.5rem] w-14` (56×56); **đo trên máy thật thì phải rút lại một nửa**. Panel `w-[19rem]` trừ `p-3` còn 271px, ba ô 56px ăn 168px ⇒ thân hàng 103px — nhưng TRONG thân đó còn vòng icon 36px + gap 12 + `px-4` 32, nên **chữ tên chỉ còn 19px**: "Bãi mực Hoàng Sa" hiện ra "Bã…". Phép tính "103px là đọc được" quên phần icon + đệm; `w-16` còn tệ hơn. **Chốt**: nâng CHIỀU CAO lên sàn (48 → **56px**, trục dễ trượt tay nhất khi tàu lắc), giữ bề ngang **44px**. Đo sau khi sửa: hàng vừa khít 271px, tên còn 55px (3 nút) / 99px (2 nút). Ghi `// nợ:` tại chỗ — bề ngang nâng được khi hàng điểm dựng lại cho tên nằm riêng một dòng (cần BA/design chốt).

**5d. ÁP SANG `/` · `/tau` · `/nguoi` · `/tien` (2026-08-29e).** Đợt rà ngoài-bản-đồ. Đo thật 375×812 (gốc chữ 16px):

| Màn / khối | Trước | Sau |
|---|---|---|
| `/nguoi` thẻ bạn thuyền đầu tiên | y=380 (47% màn bị ăn trước khi thấy một người) | 2 ô đếm + dải cam 343×60 gộp thành MỘT hàng `[thân "N bạn thuyền · N kẹt giấy tờ"] + [ô Thêm]` |
| `/nguoi` dải `grid-cols-3` Cảnh báo/Sửa/Xóa | 52px cuối thẻ, không nút nào ở hàng nó thao tác lên | Sửa+Xóa ở hàng danh tính · Cảnh báo ở hàng CCCD/SĐT · Gọi ở hàng số điện thoại |
| `/tau` thẻ giấy tờ | 373px (46% màn), 2 hàng `grid-cols-2` chỉ chứa nút | thân thẻ theo `[thân flex-1] + [ô w-16]`, hàng không nút chừa `<span className="w-16 shrink-0" aria-hidden />` |
| `/tien` chip mục (`ui/chip-row`) | tầng 1 48px · tầng 2 42px | 3.5rem · 3.25rem |
| `/tien` nút Gọi (`CallButton`) | 80×48px | `min-h-[3.5rem]`, bề ngang `px-4` giữ nguyên (nhãn "Gọi hỏi mua" cần chỗ) |
| `/` dải khẩn "Còn N việc nữa — xem hết" | 343×48 full-width, `setExpanded(true)` MỘT CHIỀU | `SQ_BTN` inline cuối hàng tiêu đề, `setExpanded(v => !v)` — có đường thu lại |
| `/` hộp thư "Xem N tin cũ hơn" | 343×44 full-width | `SQ_BTN` inline cuối hàng tiêu đề; thẻ tin vào khuôn `[thân] + [ô w-16]` nên mép phải hai danh sách thẳng nhau |

**Khung nhập đã cắt theo C1** (đều đang là bottom-sheet trần `max-h-[85dvh]`, tức 690px = 85% màn): `DocumentForm` 5 ô → 2 (tên gọi hạ xuống dòng đọc-được + ô Sửa, vì `label` khởi tạo bằng `kindLabel(kind)` nên form đang hỏi thứ nó vừa tự trả lời) · `CrewForm` 6 → 3 (validate chỉ đòi tên + MỘT định danh) · `ReportSheet` (tên trùng dòng danh tính → bỏ ô nhập; 6 nút loại vấn đề → hàng `[Vấn đề: chưa chọn] + [Chọn]`) · `BuyerForm` 6 → 2 (cảng điền sẵn từ `useHome()`) · `ListingForm` 9 → 2 (tên/tỉnh từ hồ sơ tàu, SĐT từ tài khoản — nhãn cũ đã tự thú "để trống thì lấy SĐT tài khoản") · `MaintenanceForm` (bỏ ô số chu kỳ — nó và 4 chip là HAI ĐƯỜNG cho CÙNG một giá trị; thêm chip "Khác") · `ProductForm` 5 → 2 · `CartSheet` 5 ô giao hàng → MỘT dòng `Giao: … · … · …` + ô Sửa · sheet Tài khoản gom 5 nhóm sau một hàng "Cài đặt khác".

**Đường lùi giữ nguyên, không đánh đổi**: `document-photos` nay đi qua `ConfirmDialog` dùng chung (trước xoá thẳng ảnh giấy tờ THẬT trên Storage, không hỏi lại, không hoàn tác) và nút xoá lên `h-14 w-14`. Cặp nút xác nhận của `hero-account` giữ đúng khuôn `Thôi` / `Xoá` + `min-h-[3.5rem]` mà `identity-gate.test.ts` đang canh.

**5c. MỌI THÂN HÀNG `flex-1` PHẢI CÓ `min-w-0`.** Flex item mặc định `min-width:auto` nên nó KHÔNG co dưới bề rộng nội dung — `flex-1` một mình là chưa đủ, và phần thừa đẩy nút **ra ngoài mép panel** (panel `overflow-y-auto` ⇒ trục ngang thành auto, nút chỉ thấy khi cuộn ngang: coi như mất nút). Hai chỗ bắt được 2026-08-29b, cả hai đều là lỗi CÓ SẴN chứ không phải mới:

| Hàng | Đo trước | Sau khi thêm `min-w-0` |
|---|---|---|
| Đổi tên điểm (ô nhập + Lưu + Thôi) | 271px chứa **391px**, cặp nút văng ra ngoài (đã tràn ~37px từ trước, khi mới chỉ có nút "Lưu") | vừa khít 271px, ô nhập 109px |
| Hàng điểm đã lưu (tên + 2–3 nút icon) | 271px chứa **345–365px**, nút "Xóa" nằm ngoài panel | vừa khít 271px, tên 55–99px |

**Đo thật (375×812)** sau khi áp luật: thẻ dẫn đường 296px → 243px → **209px**; bản đồ 55% → 62% → **66%**; không còn hàng nào chỉ chứa một nút.

- **Sau audit team 2026-06-10 (3 reviewer) — quy tắc chống "rối"**: (1) sheet đáy chỉ có MỘT chế độ — "gió sóng chỗ đang xem", mở app = điểm đặt sẵn tại CẢNG NHÀ, không xây màn hình cảng riêng trùng chức năng; (2) **cam đỏ là màu ĐỘC QUYỀN của ranh giới biển** trên bản đồ — tuyến dẫn đường dùng xanh chỉ đường `#1a73e8` (hằng `ROUTE_LINE_COLOR`). **Bổ sung 2026-08-28 (đường đi nhiều điểm, 07 §10.7 H)**: cùng màu xanh đó, **nét LIỀN = tuyến ĐÃ TÍNH**, **nét ĐỨT mờ = đường NHÁP** (các chỗ đã chấm, chưa bấm tính) — hai trạng thái của MỘT thứ nên dùng chung màu, phân biệt bằng nét. Chỗ ghé đánh **số 1-2-3** trong vòng tròn trắng viền `ROUTE_LINE_COLOR` (`h-10 w-10`, chữ `1rem` trong ramp). Badge số là DOM đè lên map nhưng vẫn lấy màu từ hằng `ocean-map.ts` qua `style` (KHÔNG dựng token màu thứ hai — hai nguồn màu là hai chỗ để lệch nhau; và không có hex trong class Tailwind nên cổng hook không bị phạm); (3) vị trí nói tiếng người ("Cách cảng X ~Y hải lý hướng Z"), toạ độ số chỉ nằm cuối sheet cho ai đọc vào máy định vị; (4) số liệu jargon không hành động được thì BỎ (đã bỏ "nhịp sóng X giây"; gió giật nói bằng "giật cấp N"); (5) ~~khoảng cách ranh giới chỉ nói khi gần (cảnh báo), xa hàng trăm hải lý thì im~~ → **ĐỔI 2026-08-25 theo yêu cầu của chính bà con** (*"hiện dưới mục toạ độ là cách ranh giới bn hải lý cho tiện"*): con số LUÔN hiện ngay dưới toạ độ ở peek, tô xám khi còn xa / `--warn` khi ≤15 hl / ẩn khi ≤6 hl vì dòng đỏ to đã in số đó (xem 07 §10.9). Vẫn KHÔNG khẳng định "đã vượt"; (6) màu mask nước phải sample từ tile basemap thật (#d5e8eb), không ước lượng; (7) tính xong tuyến KHÔNG thu sheet — kết quả + cảnh báo đoạn dữ phải còn đọc được, map nhìn thấy tuyến nhờ fitBounds chừa đáy; (8) thất bại phải lên tiếng (định vị fail, nguồn bão fail) — không có thất bại câm; (9) **chạm điểm trên biển → sheet ở nấc PEEK kiểu Windy** (user chốt 2026-06-10): thẻ gọn dưới đáy hiện tóm tắt (tình trạng biển + sóng/gió + vị trí), BẢN ĐỒ KHÔNG BỊ CHE — chi tiết là việc của nút "Xem thêm", KHÔNG tự nhảy lên nấc half.
- **Ô TOẠ ĐỘ + HAI HÌNH ĐỊNH VỊ (2026-08-25, góp ý bà con qua VSS Quân Bình Định)**: màn Ra khơi có **dải toạ độ kiểu máy định vị** ở góc trên trái (`components/plotter-readout.tsx`, thẻ `.glass`, cao 42px) — hàng **TÀU** (toạ độ GPS) + hàng **TRỎ** (toạ độ chỗ đang xem + cách tàu bao xa/hướng nào). Dải này là chỗ ĐỌC, không phải nút; nút "my location" vẫn là nút **Vị trí** ở rail phải và nó CHỈ đưa bản đồ về chỗ mình đứng, không dời con trỏ. **Quy ước hình, dùng chung mọi chỗ**: **đường kẻ nét đứt mảnh `--t1`** nối tàu → con trỏ (chỉ khi biết vị trí tàu; KHÔNG dùng xanh tuyến dẫn đường, KHÔNG dùng cam/đỏ ranh giới) · vị trí MÌNH = **icon tàu** (ảnh `/icons/boat-marker.png` cao 3rem, `anchor="bottom"`, **KHÔNG xoay** vì là cái ghim, trên quầng ping 2.625rem neo vào mũi ghim — mất tín hiệu thì tắt nháy + mờ; ảnh đã ghim vào CRITICAL_SHELL của service worker) · chỗ TRỎ TỚI = **con cá** (`PinIcon` 2.625rem trên quầng ping 3.75rem màu `--trim`, `anchor="bottom"` — chân ghim rơi đúng toạ độ nên quầng neo vào CHÂN, không phải giữa hình). **CẢ HAI dấu đều nhấp nháy như dấu vị trí của các app bản đồ, phân biệt bằng MÀU** — tàu `--t1`, con trỏ `--trim`. Chốt 2026-08-25f sau nhiều nhịp đổi hình/cỡ — xem 07 §10.9 — hình trong dải toạ độ phải Y HỆT hình trên bản đồ. Đã thử vòng ngắm và mũi tên cho con trỏ, cả hai đều bị chê lạ mắt: bà con quen ghim kiểu Google Maps. Đính chính bullet audit 2026-06-10 mục (3): câu "Cách cảng X ~Y hải lý hướng Z" ĐÃ BỎ (2026-08-25) — nó đo từ CON TRỎ mà đọc như đang nói về TÀU; toạ độ nay in ở CẢ dải góc (liếc lúc lái) lẫn cột phải peek sheet (đọc kỹ lúc dừng), đó là hai việc khác nhau chứ không phải nói hai lần. Chi tiết + ma trận trạng thái: [07-design-spec §10.9](07-design-spec.md).

**5d. TRẢ XONG NỢ "44px" + DỜI `SQ_BTN` RA DÙNG CHUNG (2026-08-29d).**

Dòng `// nợ:` ở 5b(b) ghi điều kiện nâng cấp là *"khi hàng điểm được dựng lại cho tên nằm riêng một dòng"*. Nay dựng lại đúng như vậy:

- Hàng điểm trong panel "Điểm đã lưu" còn **hai** phần tử: `[thân hàng = ĐI TỚI, flex-1]` + `[một ô `SQ_BTN` "Khác"]`. Ba việc phụ (Cảng nhà · Đổi tên · Xóa) xổ ra **tầng dưới của chính hàng đó**, cũng đúng khuôn `SQ_BTN`; tầng chỉ tồn tại ở hàng đang mở nên danh sách không phình. Chạm thân hàng vẫn là **ĐI TỚI** — việc dùng nhiều nhất của panel, không được biến thành cú xổ menu.
- Hàng "Đổi tên" và hàng "Xóa" cũng về `SQ_BTN` (bỏ ba cỡ pill đo được 59×52 / 63×52 / 89×52).
- Dùng **chevron** chứ không dấu ⋮: repo không có sẵn icon ba chấm, mà chevron thì có sẵn VÀ nói thêm được trạng thái đang mở/đóng — không đẻ icon mới cho việc icon cũ làm tốt hơn.
- Menu **chạm-giữ trên bản đồ** (hai hàng full-width 224px) được **MIỄN** khuôn `SQ_BTN`: đó là quy ước context-menu mà Google Maps/Zalo đã dạy bà con, đổi đi là phát minh ngược thói quen.

**Đo sau khi sửa (375×812, panel 295px)**: ô chạm **44 → 64×56px** · số cỡ nút trong panel **4 → 1** · bề rộng tên **~59 → 123px** · hàng thường 56px (tầng mở thêm 68px, chỉ ở hàng đang mở) · hàng xoá 76 → 80px, câu hỏi hiện ĐỦ TÊN trên 2 dòng (không `truncate`: cắt cụt tên trong một câu xác nhận phá huỷ là bắt bà con đồng ý với cái mình không đọc hết). Đổi lại: ô nhập của hàng đổi tên 119 → **103px** — hẹp hơn nhưng vẫn ≥16px cỡ chữ và cuộn được trong ô.

`SQ_BTN` nay khai ở **`src/components/ui/sq-btn.ts`**: 2026-08-29 đã có HAI bản chép tay của đúng chuỗi class đó (`route-planner` + `my-places-sheet`) — hai bản là hai lần lệch nhau khi ai đó chỉnh một chỗ (bài học `haversineKm`, nguyên tắc 3). Rail phải trong `ra-khoi-controls.tsx` **chưa** dùng chung hằng này (mỗi nút rail còn mang `shadow-md` + màu theo trạng thái riêng) — gộp nốt là việc của vòng sau.

**5e. ĐỆM CUỘN CỦA THẺ DẪN ĐƯỜNG PHẢI BẰNG ĐÚNG HAI THANH GHIM (2026-08-29d).** `scroll-pt`/`scroll-pb` của khung `max-h-[31dvh]` còn giữ trị số của bố cục CŨ (9rem + 5rem = 224px) trong khi hai thanh ghim thật chỉ chiếm 72px + 88px. Hệ quả đo được: cửa cuộn "hợp lệ" chỉ 28px — **thấp hơn một hàng 56px** — nên MỌI cú `scrollIntoView({block:"nearest"})` rơi vào nhánh "phần tử cao hơn cửa" và neo mép trên vào 144px, tức đẩy hàng vừa cuộn tới xuống **dưới thanh ghim đáy**, đúng cái nó định tránh. Nay `scroll-pt-[4.5rem]` / `scroll-pb-[5.5rem]` ⇒ cửa 92px, một hàng 56px lọt trọn. Còn `// nợ:` tại chỗ: thanh ghim trên CAO HƠN khi có câu cảnh báo tuyến-cũ, nâng cấp khi chiều cao hai thanh ghim được đo/đưa vào CSS var thay vì hằng số.

### Nút X đóng · Huỷ · vuốt-đóng — QUY ƯỚC DÙNG CHUNG (chuẩn hoá 2026-08-29g)

Chủ dự án 2026-08-29: *"kích thước cái x đóng làm cho đồng bộ… bao nhiêu cái design quy ước đâu?"*. Trước đó mỗi panel tự chế nút X → cỡ lệch (chỗ chạm 56px + icon 24px, chỗ 32px + **ký tự `✕` thô**). Khảo sát design system hàng đầu (Apple HIG · Material 3 · Polaris · Carbon · Ant Design · WCAG 2.5.x) → chốt một chuẩn, KHÔNG chế lại.

**Đồng thuận từ các hệ**: icon "X" là glyph vẽ nét **~24px** đặt trong vùng chạm lớn (Material **48dp**, WCAG AAA **44px**), **luôn góc trên-phải**. Chỉ Apple cho dùng nút-chữ (Cancel/Done) thay X trong sheet có nhập liệu. Thứ tự nút: primary **bên PHẢI** (Apple/Material/Carbon/Polaris/Atlassian — chỉ Ant Design ngược, KHÔNG theo). Ký tự `✕`/`×` thô **không hệ nào dùng** (lệch baseline, scale xấu) → dùng icon nét.

1. **Nút X đóng = MỘT component duy nhất `CloseButton`** ([src/components/ui/close-button.tsx](../../src/components/ui/close-button.tsx)). Vùng chạm **56×56px** (`h-14 w-14`, = sàn tap dự án, nhỉnh hơn Material 48dp vì tay găng/tàu lắc/nắng), glyph `CloseIcon` **24px** (`h-6 w-6`), `rounded-full`, nền TRONG SUỐT lúc nghỉ + `active:bg-field` (không "boxy"), `-m-1` để không phình header. Góc **trên-phải**. **CẤM tự chế nút X, CẤM ký tự `✕`/`×` thô** (hook cảnh báo). Chỉ dùng cho panel ĐỌC-XEM / auto-apply (đóng không mất dữ liệu). Áp: `ra-khoi-controls` PanelHeader, `fishing-map-view` thông tin chặng.

2. **KHÔNG bao giờ để cả X lẫn Huỷ trên cùng màn** (điểm gây rối nhất). Chọn MỘT mô hình: panel đọc-xem/auto-apply → chỉ **X + vuốt/chạm-ngoài** (không Huỷ, không Lưu); form có dữ liệu nhập → **cặp Huỷ/Lưu ở đáy, BỎ X**.

3. **Cặp Huỷ/Lưu (chủ dự án chốt 2026-08-29g: NẰM NGANG, Lưu bên phải)** — `grid grid-cols-2`, Huỷ (secondary, `bg-field`) trái · Lưu/Xác nhận (primary, `bg-sea`/danger `bg-danger`) phải, mỗi nút `min-h-[3.5rem]` `rounded-2xl`. Đây đúng khuôn `ConfirmDialog` dùng chung ([ui/confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx)) — mọi xác nhận phá huỷ đi qua nó. Nút Huỷ trong ô `SQ_BTN` (khuôn ô-vuông đã chốt) giữ icon 24px như mọi nút vuông khác — nhất quán trong khuôn vuông, KHÔNG phải nút X-đóng.

4. **Sheet: vuốt-xuống-đóng + chạm-ngoài-đóng** — `BottomSheet` chung đã có grabber + scrim-đóng + Esc. Sheet đọc-xem cho vuốt/chạm-ngoài thoải mái. Form có dữ liệu chưa lưu → nếu cho vuốt phải hỏi "Bỏ thay đổi?" (nguyên tắc 4 CLAUDE.md: chống mất dữ liệu bà con).

5. **Tap tối thiểu**: sàn tuyệt đối **56px** (mọi thứ bấm được) · X đóng/icon-only **56px** · nút chính/Huỷ/phá huỷ **cao ≥56px** · khoảng cách 2 control kề **≥12px**. `// nợ:` còn 2 nút thu-gọn dưới sàn (storm-banner `h-9`=36px, nav-mode `h-11`=44px — là nút Chevron thu gọn, không phải X; nâng khi rà HUD vòng sau).

6. **Cấp bậc nút** (màu qua token `@theme`, cấm hex): Primary = filled `--navy`/`--sea` chữ trắng (Lưu/Xong/Gọi) · Secondary = `bg-field` viền nhẹ (hành động phụ) · Text = chữ `--muted` không nền (Huỷ/Bỏ qua) · Destructive = `bg-danger` **luôn kèm ConfirmDialog** (Xoá/gỡ không đảo được).

7. **Thao tác thông minh (tự-hiểu, chống rối)**: toggle/bộ lọc/chọn lớp **auto-apply ngay** (không nút Lưu) · **không hỏi xác nhận cho hành động ĐẢO ĐƯỢC** (bật/tắt lớp, đổi cảng) — chỉ hỏi cho phá huỷ · form autofill từ `forfish.*`. Xem thêm luật dữ liệu-KHÔNG-CẮT (§6 mục toạ độ) + [07-design-spec](07-design-spec.md).

**Nguồn khảo sát**: Material 3 Dialogs (48dp/24dp) · Apple HIG Sheets (Cancel trái/Done phải, 44pt, `interactiveDismissDisabled` khi có thay đổi) · Shopify Polaris Modal (X/Cancel/Esc/chạm-ngoài, primary phải) · IBM Carbon Modal (Cancel ngoài-trái, primary ngoài-phải, X đóng không gửi) · WCAG 2.5.5 (44px AAA) / 2.5.8 (24px AA).

## 7. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-08-29

**5c. SÁU Ổ CHẠM CÒN SÓT TRONG FORM "THÊM ĐIỂM" (2026-08-29c).** `my-places-sheet.tsx` còn `min-h-[3rem]` (48px) ở sáu chỗ của khối `addOpen`: ô Tên · nút "Lấy chỗ đang trỏ" · hai ô Vĩ/Kinh độ · nút "Hủy" · nút "Lưu điểm" — trong khi CHÍNH FILE ĐÓ đã dùng `3.25rem` ở các hàng khác và `3.5rem` ở hàng điểm. Đây là **sáu ngoại lệ đo được còn sót, KHÔNG phải chuyện cả app chưa đạt sàn** (gốc chữ 16px ⇒ `3.5rem` = 56px, sàn tap toàn app đã đạt). Vì sao đáng sửa dù chỉ là 6 token: đó là **đường đi DUY NHẤT để lưu một điểm đánh cá** — việc cốt lõi của app — và cũng đúng là chỗ lối tắt chạm-giữ trên bản đồ đổ vào ([07 §10.7 K](07-design-spec.md), `prefillTick`); chỗ tốt nhất của app đang dẫn thẳng vào sáu ô nhỏ nhất của app, tay ướt, tàu lắc, sáu ô liền nhau. **Chốt**: bốn ô nhập/nút trong thân form lên `3.25rem`; "Hủy" + "Lưu điểm" (đứng riêng một hàng `grid-cols-2`, nâng không ảnh hưởng bố cục) lên hẳn `3.5rem`. Chỉ đổi token chiều cao, không đụng bố cục ⇒ không có rủi ro tràn — panel đã chứa sẵn hàng `3.25rem`. **KHÔNG đụng bề ngang** cột "Đổi tên"/"Xóa" (44px, xem 5b(b) — vẫn đang có `// nợ:`).
