# 03 — Design system: thiết kế cho ngư dân / Audience-first design

> **Mục đích / Purpose**: Hướng thiết kế canonical của ForFish — bắt đầu từ việc bà con cần làm và thang cỡ Codex (§0, chốt 2026-10-19), không bắt đầu từ trend.

**Load khi / Load when**: sửa UI, màu sắc, typography, copy, trạng thái (status), hoặc thêm component mới.

covers: src/app/globals.css
last_verified: 2026-10-19
<!-- re-verified: 2026-10-24p — KAIROS RÀ FB VÒNG 2: mẫu trình xem ảnh toàn màn (nền navy, × CloseButton goc góc phải, vuốt snap, pinch-zoom) · mẫu nhãn nơi chốn chạm được trên dòng tên "Tên ▸ Bến X" (bỏ viên "Bến X" dưới thân + nhãn "Cả nước") · lưới ảnh 1/2/3/4+ · ⋯ lên đầu thẻ · thẻ đầu Bến · viên trả lời. Không token mới. -->
<!-- re-verified: 2026-10-24 — KAIROS TRANG CÁ NHÂN: pattern đầu trang kiểu FB (ảnh bìa 2.6:1 + `KairosAvatar xl` 6rem đè mép, chấm AI, nhãn Cùng cảng, dòng đếm theo dõi, lưới Ảnh 3 cột) — không token mới. -->
<!-- re-verified: 2026-10-23 — KAIROS: token mới `--kairos-av-1..6` (ảnh đại diện chữ cái), pattern `PostCard` thẻ 3 loại + `KairosAvatar` + nút 'Có N bài mới' (mục trước §3), icon mới NewsIcon/ThumbIcon/CommentIcon/ShareIcon, dock 6 ô pill 3.25rem. -->
<!-- re-verified: 2026-10-22d — CHỐT 9 ĐIỂM THEO APP ĐÔNG NGƯỜI DÙNG (anh Long: "xử lý theo các app hiện đại nhất, đông user nhất"): (1) ĐẦU MÀN: màn gốc dock = `ManHeader` tiêu đề lớn 24px; màn PHỤ = thanh SÁNG một hàng `[‹ 3.5rem][tiêu đề 1.25rem đậm]` (`market-header.tsx` — `PageHeader` dựng lại trên nó) — BỎ thanh navy đặc của chợ + dải gradient bo đáy + nhãn nhỏ trên tiêu đề; (2) NGĂN MODAL PHỦ DOCK (Material/iOS) — 5b chỉ cho tấm trợ lý; (3) NÚT NỔI Sen Biển ẩn khi cuộn xuống, hiện khi cuộn lên/đầu trang (`lib/sen-bien/an-khi-cuon.ts`, kiểu Gmail/Facebook), mờ 200ms + `inert`; (4) TÍNH NĂNG KHOÁ thấy được, chạm thì mời (ô "Đi đâu?" tài khoản thường → ngăn + PremiumLock); (5) LỚP BẢN ĐỒ = ngăn đáy kiểu Google Maps (lưới 3 cột ô icon-trên-chữ-dưới 4.5rem, bo 1rem, đang bật lớp có chấm màu), panel con trong cùng ngăn với ‹/×, chạm bản đồ đóng; (6) TRANG CHI TIẾT MÓN không tiêu đề chung — tên món là h1 (Shopee); (7) "Ẩn" lời nhắc = hoãn 7 ngày; (8) ô chữ khuôn B1 trong hộp thoại thẳng mép nhãn (`.o-chu`); (9) chạm ngoài: lớp nổi tạm (ngăn Lớp, menu, thẻ) đóng — bảng tác vụ (lộ trình) đứng yên như bảng chỉ đường Google Maps. -->
<!-- re-verified: 2026-10-22c — RÀ BỐ CỤC TOÀN APP (sửa phải-sửa + nên-sửa): (1) BottomSheet `kieu` xem|form + vuốt-đóng + hỏi "Bỏ phần đang ghi?" (§Nút X mục 4); ConfirmDialog cao tối đa 85dvh + bẫy focus + khoá cuộn chung (`lib/dialog-focus.ts`); (2) THẺ NỔI BẢN ĐỒ: 12 thẻ thông tin + menu chạm giữ kẹp theo KHUNG BẢN ĐỒ thật và cỡ thật của thẻ (`lib/the-noi-vi-tri.ts` + `components/ban-do/kep-the.ts`, không còn `window.innerWidth`), thân `max-h-[50dvh]` cuộn, × kiểu `goc`; một thẻ một lúc, tự kéo bản đồ là đóng; (3) BO GÓC hai bậc: ngăn đáy 1.75rem, panel/thẻ nổi/thẻ bão 1rem (`rounded-2xl`), control bên trong 0.75rem; (4) LỀ TRANG một mức 16px — `PageHeader` + thẻ đăng nhập + quyền riêng tư px-5→px-4; (5) ĐANG CHỌN: tab Đơn hàng navy như ChipRow (bỏ màu khu t3); (6) GIỜ TỰ TẮT chỉ hai hằng `lib/notify.ts` (3 s báo, 8 s cảnh báo/hoàn tác) — bỏ 3000/5000 viết cứng ở chợ; tải sẵn dự báo bản cảnh báo 8 s; (7) Z: báo bản mới z-[28] (dưới nền mờ ngăn/hộp), rộng theo `--w-app`; hộp quản trị z-40 + Esc + 85dvh; (8) panel lớp bản đồ bỏ nhãn "Điều khiển", nút ‹ 44px. -->
<!-- re-verified: 2026-10-22b — RÀ 3 SKILL LẦN 2 (bộ đo `inspect.mjs --app` của Taste: 0 FAIL/0 WARN trên /, /tien, /cho, /tau, /ngu-truong ở 390 + 768): (1) NÚT PHẲNG: `.shadow-trim-btn/.shadow-trim-cta` = none (bóng 1px vẫn bị FAIL `button-fx`); `.shadow-trim-fab` giữ vì nổi thật. (2) THẺ: `--shadow-card: none` — `.surface` chỉ còn viền 1px (viền HOẶC bóng, không cả hai). Bóng chỉ cho thứ NỔI (`--shadow-float`). (3) `--h-chip` 2.5→2.75rem (vùng chạm 44px). (4) ĐỘ ĐẬM: ba mức 400/500·600/700 — `font-bold` (700) CHỈ cho tiêu đề màn (`ManHeader` h1) và khu quản trị; mọi chỗ khác `font-semibold`. (5) MÀU CAM HÀNH ĐỘNG `--trim` #c8461f GIỮ (chủ dự án chốt 2026-10-22): bộ đo Taste xếp nó vào "terracotta" — chạy bộ đo với `--allow palette-terracotta`, lý do: cam là màu hành động/an toàn trên biển, đã đạt AA 4,83:1 chữ trắng. (6) ICON TRƠN, không đặt icon trong vòng/ô tô màu. (7) Kính mờ: bỏ ở bong bóng Sen Biển (nền đặc + `shadow-float`); `.glass` còn ở panel đè bản đồ (thanh giờ, HUD) — hiệu ứng có chủ đích cho chữ đọc được trên ảnh vệ tinh. (8) CHUYỂN ĐỘNG (Emil): giảm chuyển động chặn `scale` (Tailwind 4 co nút bằng `scale`, không phải `transform`); `.anim-giot` 240ms từ scale 0.94, không nảy, không tạo hình bo góc; ngăn kéo bản đồ không transition `height`; nút co tối đa 0.97 (bỏ `active:scale-90`); mọi nút có `active:scale-*` đều có `transition`. (9) Ảnh món chợ: khung 4:3 nền trắng (`bg-card`) cho mọi ảnh. Chữ phụ 10px GIỮ (chủ dự án: "10px đã thấy to"). -->
<!-- re-verified: 2026-10-22 — ÁP 3 SKILL THIẾT KẾ (Impeccable · Taste · Emil Kowalski, đọc bản gốc trên GitHub): (1) CHUYỂN ĐỘNG: token `--ease-out` cubic-bezier(0.23,1,0.32,1) · `--ease-in-out` · `--ease-drawer` cubic-bezier(0.32,0.72,0,1); @theme `--default-transition-duration: 160ms` + `--default-transition-timing-function: var(--ease-out)` (mọi `transition` Tailwind); anim vào/ra bỏ `ease-in` (Emil cấm trên UI); sheet 260ms đường cong ngăn kéo; GIẢM CHUYỂN ĐỘNG không còn tắt sạch 0,01ms — vào/ra thành mờ dần ngắn, bỏ vòng lặp + co giãn khi nhấn, transition 80ms; (2) CHỮ: bỏ chữ hoa giãn chữ (eyebrow/nhãn nhóm `uppercase tracking-*`, 26 chỗ — chữ Việt có dấu viết hoa nhỏ khó đọc, Impeccable cấm kicker, Taste cấm caption hoa giãn chữ); gộp cỡ chữ 17 → 12 bậc (1.0625/1.1875→1.125, 1.3125→1.375, 1.625→1.75, 0.6875→0.75rem); (3) BỀ MẶT: bỏ sọc màu dày bên trái thẻ cảnh báo (bão, quyền đã lưu, admin) → nền màu + viền mảnh cùng tông; bỏ kính mờ ở thanh Tabs + menu admin (nền đặc); bỏ quầng cam dưới nút chính (`.shadow-trim-*` → bóng trung tính rất nhẹ); (4) BỀ MẶT TRÌNH DUYỆT: `accent-color`/`caret-color` = --sea, `::selection` sea 20%, `scrollbar-color` mực nhạt; class `.cuon-an` ẩn thanh cuộn ở dải cuộn ngang (chip, ngày, ảnh — 13 chỗ, trừ admin). -->
<!-- re-verified: 2026-10-20q — HỆ NÚT NỔI BẢN ĐỒ một khuôn: tròn --h-ctl (2.75rem), nền card/95, viền line, bóng nhẹ, CHỈ icon 1.125rem, tên ở aria-label (Lớp · ⋯ · ⚠ · loa · về tàu); đang bật = nền sea/navy đặc chữ trắng. Danh sách bung ra = MENU: thẻ 11rem viền line bo xl, dòng cao 2.5rem icon+chữ 0.875rem ngang, đang chọn navy đặc. Đồng hồ tốc độ: không ô, chữ số 1.75rem đậm + đơn vị 0.75rem, quầng sáng `text-shadow` màu --card. Huy hiệu trạng thái icon (Sen Biển mic tắt): tròn 42% góc dưới phải, nền --warn, viền 2px --card. -->
<!-- re-verified: 2026-10-20p — pattern KHUNG BẢN ĐỒ (components/ban-do/khung.tsx): ô tìm pill cao --h-ctl viền line nền card/95; đồng hồ tốc độ tròn 4.5rem viền 4px sea (vàng khi GPS cũ), số 1.375rem đậm tabular + đơn vị 0.625rem; nút về tàu tròn --h-cta; thẻ trạng thái đáy rộng hết màn bo 1rem min-h --h-row. CHẾ ĐỘ GỌN `@container/map` <15rem: rail chỉ icon (`.sq-btn.sq-tile` thu về vuông --h-ctl). Khối mời tài khoản: thẻ viền line + hai nút ngang bằng --h-cta (cam đặc · viền). -->
<!-- re-verified: 2026-10-20o — ĐÍNH CHÍNH 2026-10-20n: màu loài cá KHÔNG nạp vào paint MapLibre (chỉ DOM: chấm bảng chọn loài, nút chọn loài, ghim cá) — nay qua 38 token `--sp-<tên ngắn>` ở globals.css, hồ sơ loài trỏ `var(--sp-…)`; cổng `species-colors.test.ts` đối chiếu token + không trùng. Đầu ngăn bên: container query <15rem ⇒ tiêu đề riêng dòng, "Giữ mở" icon khoá, nút 2.25rem. Nhãn ≤2 chữ: "Chọn loài", "Mọi loài". -->
<!-- re-verified: 2026-10-20m — token mới `--fish-all-from` #95d5b2 · `--fish-all-to` #1b4b2c (chấm "Mọi loài" = dải thang mật độ cá) · `--fish-unknown` #888888; `--w-app` giữ px CÓ CHỦ Ý (ghi ở globals.css: khung không nở theo chế độ chữ). -->
<!-- re-verified: 2026-10-20l — token `--w-app: 480px` = bề ngang khung app (một nguồn cho khung, dock, sheet đáy, thanh mua, lớp nổi; px CÓ CHỦ Ý vì khung không nở theo chế độ "Chữ to"); lưới số ngăn gió sóng thích ứng bằng container query (3 cột từ 17rem, dưới đó 2 cột), không cắt chữ. -->
<!-- re-verified: 2026-10-20k — `--sea: rgb(var(--sea-rgb))`, `--trim: rgb(var(--trim-rgb))`: kênh là NGUỒN DUY NHẤT (màu đặc + bóng trong suốt), khối kênh dời lên `:root` đầu file; nút bật/tắt chữ "Giữ mở" ở đầu ngăn bên (h --h-ctl, pill, bật = bg-sea chữ trắng, aria-pressed). -->
<!-- re-verified: 2026-10-20j — token KÊNH MÀU `--ink-rgb` 13 35 54 · `--white-rgb` · `--black-rgb` · `--trim-rgb` 200 70 31 (= --trim) · `--sea-rgb` 8 110 115 (= --sea) trong globals.css: bóng/kính/quầng viết `rgb(var(--x-rgb) / a)`, không còn số màu rời ngoài khối token (color-mix bị loại vì iOS 15). Đổi --trim/--sea phải đổi bộ số đi kèm. `SeaCell` (ô lưới số) nay ở `lib/sea-cells.ts`. -->
<!-- re-verified: 2026-10-20i — pattern mới `SeaDenseGrid` (lưới số 3 cột: nhãn 0.75rem mờ + số 0.9375rem đậm tabular, không kẻ vạch; `full`/`span2`) cho ngăn gió sóng; nút "Cả tháng" của thẻ con nước theo bậc control (--h-ctl, bo 0.75rem, chữ 600); `#fff` đặc trong globals.css nay là `var(--card)` (rgb trắng có alpha giữ nguyên — color-mix không chạy iOS 15). -->
<!-- re-verified: 2026-10-20h — `--trim` #c8461f (chữ trắng 4,83:1, rà Codex lần 3); ghi bảng MÃ HIỆN TẠI navy/sea/trim/nền/line/field trước phần lịch sử màu. -->
<!-- re-verified: 2026-10-19d — QUYẾT ĐỊNH (anh Long): "xoá cái quy tắc làm cho dân biển to chữ các kiểu đi, xoá hẳn đi" — §0 viết lại thành THANG CỠ Codex, §1 bỏ bảng cỡ theo đối tượng, §Nhãn mới (≤2 chữ, cỡ cố định theo loại, bảng nhãn chuẩn `lib/labels.ts`), §3 type-ramp theo thang mới. Mọi chỗ còn lại trong file nhắc sàn 18px/56px hay lý do nắng/tay ướt đều đã gỡ (xem các re-verified cùng ngày). -->
<!-- re-verified: 2026-10-19c — GỌN = 37px Ở MỌI KHU (chủ dự án chốt): `--market-control: var(--row-h)`, `.tau-action min-height: var(--row-h)`, 86 chỗ `min-h-[3.5rem]` trong market/cho/ban-hang + khu Tàu tôi → `min-h-(--row-h)` (Tailwind v4 cú pháp biến). Đo 390 gọn: ô tìm/chip/nút Vật tư 37px, "Thêm"/"Gọi SDVICO" Tàu tôi 37px; hàng có nút stretch theo thân hàng (48/42px) đúng luật thân hàng = nút. Chip tài khoản biến thể `light` (ManHeader): chữ 1rem, đệm hẹp, min-w-0 + truncate — nhường chỗ cho tiêu đề. -->
<!-- re-verified: 2026-10-19 — `.dock-label` đổi theo nhãn dock mới (Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư); từ 2026-10-19d là 0.75rem (0.6875rem dưới 345px) theo thang §0. Khuôn MỚI `ManHeader` (components/man-header.tsx): đầu màn nền sáng thay hero gradient ở các màn dock. Danh sách kẻ mảnh (`divide-y divide-line rounded-2xl bg-card`, hàng theo bậc hàng danh sách, chữ theo thang §0, chấm màu thay tag) là khuôn chung của Thông báo + Việc cần làm. HeroAccount có biến thể `light`. -->
ttl_days: 90
gate: warn
<!-- re-verified: 2026-10-05 10:40 — thêm pattern "overlay tự-ẩn phải tính CUỘN là thao tác" (onScrollCapture ở container gốc, không onScroll): đối chiếu `ui/snap-sheet.tsx` (<section onScrollCapture={onInteract}>) + `ra-khoi-controls.tsx` (container gốc onScrollCapture) — khớp sau fix 2026-10-05. Tap-target SnapSheet min-h-[3.5rem] còn đúng. -->
<!-- re-verify(03): pattern overlay tự-ẩn + cuộn (onScrollCapture) -->
<!-- re-verified: 2026-10-02 12:00 — ĐỐI CHIẾU globals.css: `.anim-fade-in` (sdf-scrim-in 180ms ease-out) + block prefers-reduced-motion (animation-duration 0.01ms, iteration 1) còn khớp. PATTERN MỚI chỉ cho /quan-tri (không đụng app ngư dân, không thêm token/keyframe): `AdminSkeleton` (components/admin/admin-nav.tsx) = câu "Đang tải…" + thẻ `.surface` chứa thanh `bg-field animate-pulse` — khung xương đúng dáng danh sách thay chữ trơ trọi; `AdminNav` = điều hướng nhóm (cột trái desktop / thanh dính mobile), nút tab `transition-[background-color,color,box-shadow,transform] duration-200` + `active:scale-[0.98]`. -->
<!-- re-verified: 2026-09-24 16:00 — ĐỐI CHIẾU globals.css cho fix dock: `.dock-frame`/`.bottom-dock`/`--dock-row`/`--dock-total` còn khớp; `.anim-*` (motion điềm đạm) còn; `.sq-btn:active { scale(0.95) }` + transition color/bg/transform còn (mọi nút hành động đã có press feedback). THÊM `.dock-label` (nhãn dock 1 dòng, cỡ chữ hạ theo bề ngang máy) — xem §"Nhãn ngang hàng" mục 5. Bug đã sửa: "Bạn thuyền"/"Trang chủ"/"Giao dịch" gãy 2 dòng ở ≤399px → icon lệch khỏi pill. -->
<!-- re-verify(03): dock-label responsive + sq-btn:active + anim-* motion -->
<!-- re-verified: 2026-09-24 17:00 — audit UI P2: THÊM route-fade `src/app/template.tsx` (verify browser: wrapper `.anim-fade-in` chạy `sdf-scrim-in` 180ms khi đổi route, /ngu-truong bỏ qua, /quan-tri không vỡ). LÀM RÕ hai họ nút (sq-btn vuông tại-chỗ vs pill CTA/auth) — đối chiếu `sdvico-request.tsx` (rounded-full bg-t3 active:scale) + `login-gate.tsx` (rounded-full bg-trim active:scale) + `sq-btn.ts` (.sq-btn:active scale trong globals.css): đều CÓ press feedback, hai họ intentional. -->
<!-- re-verify(03): route-fade template.tsx + hai họ nút intentional -->

<!-- re-verified: 2026-06-30 - safe-area pb env(sab), edge-to-edge mobile native, motion điềm đạm khớp globals.css hiện tại (4 commit UI tween đã review) -->
<!-- re-verified: 2026-08-18 — ĐỐI CHIẾU `globals.css` (bản 2026-08-14 b0bd111) với doc: (1) 51 biến `--*` trong `:root`/`@theme` — bảng màu theo trục có 4 hex LỆCH từ đợt chỉnh AA (t1 #18648b · t2 #2e7d4f · t3 #8f6010 · t4 #7a4d9e) → sửa bảng theo mã, ghi kèm `--tN-bg` + bộ trạng thái ok/warn/danger (+ `-bg`); bổ sung tên token nền tảng `--navy/--sea/--trim/--sun/--foreground/--card/--line` mà doc chỉ gọi bằng tên chữ. (2) `.surface` · `.glass` · `.range-big` · `.range-dual` · `.display` · `.anim-*` · `.dock-frame`/`.bottom-dock`/`--app-vh`/`--dock-*` đều còn trong mã, khớp mục 2/3/6. (3) giá trị oklch ở mục "Token chờ lift" là GIÁ TRỊ MÀU chưa lift, không phải symbol mã — bỏ backtick để doc-health khỏi báo dead-symbol oan; nội dung không đổi. (4) Mục 6 "Lớp Dự báo cá" còn tả heatmap theo loài + hàm `fishHeatColor` (đã xoá) → đính chính theo mã hiện tại (lưới ô 3 mức `FISH_LEVEL_BANDS`, từ 2026-07-27 — 07 đã ghi, 03 chưa). (5) Gói C 2026-08-18: thêm bullet `neutral` cho `CrewIssueLevel`/`requestStatusVN` ở mục "Ngôn ngữ trạng thái" — không token mới. -->
<!-- re-verified: 2026-08-29 — DOCK iOS: RÚT GỌN `--app-vh` về ĐÚNG một luật (chủ dự án chốt, máy iOS 26.6 vẫn lỗi sau nhiều vòng vá): "đọc khung nào lớn hơn thì CỐ ĐỊNH theo khung đó thôi". viewport-gap-fix.tsx nay = CHỈ CHO LỚN LÊN rồi KHOÁ (`measured <= stableBottom → return`), trần `screen.height` (bỏ glitch vọt), lưu localStorage. ĐÃ BỎ nhánh "tự hạ theo tab ngắn" (>32px) — chính nó gây DAO ĐỘNG qua lại 2 tab = lỗi "khung kia cụt / không lưu". ĐÃ BỎ cổng phiên bản `viewportBugFixed()` (native 26.6 vẫn lệch per-tab → workaround chạy cho MỌI bản cài iOS). CSS `:root.pwa-frame` (dock-frame/app-shell/full-map theo --app-vh) KHÔNG đổi; app-shell min-height=--app-vh vẫn ép tab ngắn nở bằng tab dài. -->
<!-- re-verified: 2026-06-16 — +.range-dual (globals.css): dual-range kéo-thả 2 đầu, tái dùng thumb kiểu .range-big (input pointer-events:none, thumb auto). Dùng ở legend lọc khả năng có cá. Token màu/font KHÔNG đổi -->

> ⚠️ Một đợt redesign theo hướng này đang chạy song song — file này mô tả **direction + tokens conceptually**, không trích line number cụ thể của file src. Token thực tế nằm trong `src/app/globals.css` (`@theme`), luôn coi file đó là nguồn giá trị hiện hành.

---

## 0. THANG CỠ — theo rà Codex (anh Long chốt 2026-10-19)

> **QUYẾT ĐỊNH 2026-10-19 (anh Long, chủ dự án)**: *"xoá cái quy tắc làm cho dân biển to chữ các kiểu đi, xoá hẳn đi"*. Bỏ hẳn sàn chữ 18px, sàn chạm 56px và mọi lý do ép cỡ theo đối tượng (tuổi, nắng, tay ướt, tàu lắc). Từ nay cỡ chữ / nút / icon / khoảng cách theo thang dưới đây (nguồn: `ra-soat-giao-dien-codex.md` + mẫu `sdfish-purpose-design.html`). **Mục tiêu là ĐẸP như mẫu Codex**: nền sáng, ít lớp, navy = thương hiệu/tiêu đề, cam = MỘT hành động chính mỗi màn, hàng danh sách kẻ mảnh thay vì nhiều hộp, ít nền tròn sau icon, ít chữ đậm, mỗi màn một điểm nhấn. GIỮ: viết cỡ bằng **rem** (kiến trúc `data-mode`), token màu ở `globals.css @theme` (cấm hex rời), tiếng Việt đời thường, đủ trạng thái trống/tải/lỗi/offline, focus ring.

Gốc `<html>` = **16px** (chế độ Gọn, mặc định). Chế độ **Nút to** (`data-mode="to"`) nâng gốc lên 17px — mọi thứ to theo tỷ lệ, không đổi bố cục. **Theo máy** không đặt gốc. Mọi giá trị dưới đây là rem ở gốc 16px.

| Thành phần | Bậc (rem → px) | Token / class |
|---|---|---|
| Tiêu đề màn (h1) | **1.5rem** (24) · trang chủ compact 1.25rem | `ManHeader` |
| Tiêu đề nhóm (h2) | **1.125rem** (18) · đậm 600 | `.display` |
| Tiêu đề hàng / tên đối tượng | **1rem** (16) · đậm 600 | hàng danh sách |
| Nội dung chính | **1rem** (16) · thường | `body` |
| Chữ phụ (meta, nguồn, ghi chú) | **0.8125–0.875rem** (13–14) · `text-foreground/65` | — |
| Nhãn dock · nhãn dưới icon ô vuông | **0.6875–0.75rem** (11–12) | `.dock-label`, `.sq-tile` (bản đồ) |
| Icon trong dòng | **1.125–1.25rem** (18–20) | `h-5 w-5` |
| Icon điều hướng (dock, rail) | **1.375–1.5rem** (22–24) | `h-6 w-6` |
| Icon đầu thẻ | hạn chế; 1.5rem trong nền 2–2.25rem | — |
| Header màn | **3.5–4.5rem** (56–72) chưa gồm safe-area | `ManHeader` |
| Nút chính (CTA cam / navy) | cao **3.25rem** (52) · bo 0.75rem · chữ 1rem 600 | `--h-cta`, `PrimaryButton` |
| Control thường (nút phụ `.sq-btn`, ô nhập, ô vuông rail `.sq-tile`) | cao **2.75rem** (44) · nút phụ bo tròn, ô nhập + ô vuông bo 0.75rem | `--h-ctl`, `--row-h`, `.sq-btn` |
| Chip (tab trong trang, lọc) | cao **2.5rem** (40) · bo tròn · viền 1px line | `--h-chip`, `ChipRow` |
| Tab thanh (gạch dưới) | cao 3.25rem · gạch 3px navy | `TauToiNav`, `ui/tabs` |
| Hàng danh sách | tối thiểu **3.5rem** (56) · kẻ mảnh `divide-line` · không hộp riêng | `--h-row` |
| Padding thẻ | **0.75–1rem** (12–16) | `.surface` |
| Bo góc thẻ | **0.75–1rem** (12–16) · thẻ 1rem, control 0.75rem | `--r-card`, `--r-ctl` |
| Khoảng trong nhóm / giữa nhóm | 0.5–0.75rem / 1–1.25rem | `space-y-2` / `space-y-5` |
| Bóng | thẻ: viền 1px `line` + bóng rất nhẹ; nổi trên bản đồ: `--shadow-float` | `.surface`, `.glass` |
| Dock | **kiểu Facebook** (anh Long 2026-10-19): thanh trắng bo tròn NỔI, lề 0.75rem, hở đáy `--dock-gap` 0.5rem trên home-indicator, viền 1px line + `--shadow-float`; CHỈ ICON 1.5rem, mục đang chọn = pill xanh nhạt (`bg-sea/12`) + icon xanh; tên mục qua `aria-label`/`title` | `.bottom-dock`, `bottom-nav.tsx` |

Luật đi kèm:
- **Cỡ cố định theo loại** (anh Long 2026-10-19): cùng loại ⇒ cùng cao/rộng, chữ canh giữa; nút/chip KHÔNG nở theo độ dài chữ — vì nhãn ≤2 chữ (§Nhãn) nên ô cố định luôn đủ. Ô vuông bản đồ `.sq-tile` = 4rem × 2.75rem; nút phụ chữ `.sq-btn` ≥ 5.5rem rộng; chip ≥ 5.5rem.
- `text-[Npx]`/`min-h-[Npx]` vẫn cấm trong component — dùng rem hoặc token `(--h-ctl)`.
- Ô nhập giữ `font-size ≥16px thực tế` — đây là hành vi nền tảng iOS (tự phóng trang), không phải luật đối tượng.
- Chế độ hiển thị chỉnh trong sheet Tài khoản (`forfish.displaymode.v1`), script đầu `<body>` đặt `data-mode` trước khi vẽ.

## 0b. HỆ NÚT · CHIP · THÔNG BÁO — v2 (rà design Codex lần 2, 2026-10-19)

> Anh Long chê lượt trước "vẫn chưa đạt" ⇒ nhờ Codex rà lại toàn app. Chẩn đoán: **mới làm gọn lớp vỏ, bố cục bên trong vẫn theo hệ thẻ + nút cũ**. Mục này THẮNG mọi chỉ đạo cũ trái nó ở §2 "Hình khối", §"Phân cấp điều hướng", §6 "Nút hành động" — các đoạn đó giữ làm lịch sử, đọc kèm dấu ⛔ THAY.

| Thứ | Luật v2 | Code |
|---|---|---|
| **Nút phụ trong hàng/thẻ/sheet** | NÚT CHỮ gọn: icon 1rem BÊN TRÁI nhãn, cao `--h-ctl`, bo tròn, rộng tối thiểu 5.5rem, chữ 0.875rem 600, KHÔNG bóng. Nền do nơi gọi đặt (trung tính `bg-field`/`bg-background`; cam chỉ khi là hành động chính duy nhất của màn) | `SQ_BTN` = `.sq-btn` (globals.css) |
| **Ô vuông icon-trên-chữ** | CHỈ trên bản đồ: rail phải, thẻ dẫn đường, panel điểm đã lưu — cùng cột với rail | `SQ_TILE` = `.sq-btn.sq-tile` |
| **Chip điều hướng trong trang** | chọn = **navy** (tầng 1 đặc, tầng 2 viền + chữ navy); KHÔNG còn màu trục t1–t4 | `ChipRow` (`accent` bỏ) |
| **Header màn** | `right` = MỘT nút ngắn nhãn cố định (vd "Tài khoản"). Thông báo/thẻ KHÔNG đặt trong header — đặt đầu thân màn, nguyên bề ngang | `ManHeader` |
| **Trạng thái "yên"** | một hàng viền mảnh, icon màu, chữ thường; KHÔNG phủ nền trạng thái. Nền `ok/warn/danger-bg` chỉ khi có việc cần biết (có bão, mất sóng, tài khoản bị đá) | `StormBanner` lúc không bão |
| **Dữ liệu dạng bảng** | MỘT `.surface` + `divide-y divide-line`, mỗi mục một hàng `min-h-(--h-row)`; chạm cả hàng + chevron nhỏ, KHÔNG ô nút riêng lặp lại việc của hàng | bảng giá cá |
| **Bản ghi có thao tác (giấy tờ, bạn thuyền…)** | cùng khuôn danh sách; hàng = tên + tình trạng chữ nhỏ CÓ MÀU (không băng nền đặc); chạm ⇒ bung chi tiết ngay dưới hàng (nền `background/60`) chứa dữ liệu phụ + Sửa · Xóa · việc riêng. Một hàng bung một lúc. Việc gọi điện (Gọi) được ở ngoài hàng | `document-vault`, `crew-list` |
| **Khối trống** | viền đứt `border-dashed border-line`, py-6, icon nhạt — không hộp nền xám to | — |
| **Không ghép `.surface` với border utility** | `.surface` nằm ngoài layer, khai `border` shorthand ⇒ `surface border-l-4 border-danger` không chắc ra viền đỏ. Thẻ trạng thái tự khai viền + nền | `KickedNotice` |

**Cam = MỘT hành động chính mỗi màn.** Nút "Thêm" ở đầu từng nhóm là nút phụ (nền trung tính), không phải cam — đang dọn theo màn (Tàu tôi, Bạn thuyền, Vật tư) ở các commit sau của đợt này.

## 1. Người dùng / Audience

Ngư dân, ít rành công nghệ, dùng app ngoài biển và ở bờ. Điều đó quyết định **ngôn ngữ và luồng**, không quyết định cỡ:

| Ràng buộc | Quy tắc |
|---|---|
| Ít rành công nghệ | Nhãn = **icon + ≤2 chữ**, không icon trơ trọi, không jargon — NGOẠI LỆ duy nhất: dock (chỉ icon kiểu Facebook, anh Long chốt 2026-10-19) |
| Tiếng Việt đời thường | "Tủ giấy tờ" chứ không "Document management"; "Còn 18 ngày" chứ không "Expires in 18d" |
| Một việc một màn hình | Không nested menu, không bước thừa; flow ≤ 2 chạm tới việc chính |
| Mất sóng nhiều ngày | Màn nào cũng có nhánh đọc bản đã lưu; trạng thái trống/tải/lỗi/offline đủ trong code |

## 2. Màu / Palette — "Mặt nước" (redesign 2026-06-10, user yêu cầu hiện đại + tràn viền)

Hướng mới: **modern edge-to-edge mobile** — nền sáng lạnh, hero biển sâu tràn viền, bề mặt không viền. Bỏ nền cát ấm cũ.

### Logo / brand mark
- **Một logo DUY NHẤT cho cả sản phẩm**: bộ icon PWA sinh từ `image/logo sdfish.png` (`npm run icons` → `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, maskable). App ngư dân dùng qua manifest/PWA; **web quản trị `/quan-tri` dùng CHUNG chính icon đó** (`/icons/icon-192.png`) trong header (44px, bo góc `rounded-xl` + `border-line`) — KHÔNG tạo logo riêng cho khu quản trị (chốt user 2026-07-30 "logo chung với logo app"). Đổi logo = thay `image/logo sdfish.png` rồi chạy lại `npm run icons`; cả hai khu tự cập nhật.

### Màu nền tảng
> **TONE MẪU CODEX (anh Long 2026-10-19: "xem cái tone màu của cái codex góp ý")** — đo từ ảnh mẫu Sen Biển của Codex: chữ/tiêu đề **slate-teal `#1c323c`**, nhấn **teal `#306c72`** (chữ in hoa nhỏ, icon, link, mục đang chọn), chữ phụ ≈`#576b72` (= foreground/65), nền **`#f6f8f7`**, viền thẻ **`#dce4e3`**, nền ô/nút phụ `#edf1f0`. Đã đổi giá trị `--navy`, `--sea`, `--foreground`, `--background`, `--line`, `--field` (tên token GIỮ để không phải sửa ~900 chỗ dùng). Mẫu Codex KHÔNG có cam — nút chính của mẫu là teal mờ; `--trim` (cam) **sẫm lại `#c8461f` (2026-10-20, rà Codex lần 3 ưu tiên 4)** — chữ trắng trên cam đạt 4,83:1 (cũ `#e4572e` chỉ 3,68:1); cam vẫn là nút chính, đổi sang teal chờ anh Long chốt. Viền/ghim trên bản đồ còn dùng mã `#e4572e` rời trong `fishing-map-view.tsx` (màu nội dung bản đồ, không phải token UI).

**MÃ HIỆN TẠI (đối chiếu `globals.css` 2026-10-20)**: `--navy`/`--foreground` #15333e · `--sea` #086e73 · `--trim` #c8461f · `--background` #f6f8f7 · `--line` #dce5e4 · `--field` #edf1f0. Ba gạch dưới đây là **lịch sử** (bảng màu trước 2026-10-19).
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
> ⛔ THAY một phần bởi §0 + §0b (2026-10-19): thẻ nay viền 1px `line` bo 1rem; hero gradient chỉ còn ở màn chưa chuyển sang `ManHeader`; nút phụ không bóng; "HAI HỌ NÚT" ô vuông/pill → nút chữ gọn + ô vuông chỉ ở bản đồ; dock nền trắng (§0), không còn navy kính mờ.
- **Thẻ = `.surface`** (globals.css): trắng KHÔNG viền, bo 20px, bóng mềm 2 lớp. KHÔNG dùng `ring-1 ring-line` làm viền thẻ nữa — `--line` chỉ còn cho divider trong thẻ (`border-t/b/l border-line`).
- **Panel nổi trên bản đồ = `.glass`** (globals.css, 2026-07-29): liquid glass — nền trắng 62% + `backdrop-filter: blur(14px) saturate(1.5)`, viền sáng inset 1px, bo 20px; có fallback nền 92% cho máy không hỗ trợ blur. CHỈ dùng cho panel đè lên bản đồ (thanh giờ Windy, HUD dẫn đường) — thẻ nội dung thường vẫn `.surface`. **Dock sát đáy 2026-10-22** ("sao nó ko sát thế"): `--dock-bottom = max(--dock-gap, safe-area − 0.875rem)` — dock ăn vào safe-area, cách đáy ≈20px trên iPhone (vẫn trên vạch home), `--dock-total = --dock-row + --dock-bottom`; thẻ trạng thái đáy màn Bản đồ lề `px-3` = đúng lề 0.75rem của dock. **Mở rộng 2026-10-22** (anh Long: "bố cục cho cân đối, đừng che màn hình… ko thì làm hiệu ứng water"): mọi thanh/nút NỔI THƯỜNG TRỰC trên màn Bản đồ cũng là `.glass` — ô "Đi đâu?", nút tròn rail + Về tàu + Loa (lúc tắt), thẻ toạ độ Tàu/Trỏ, chú giải lớp cá. `.glass.rounded-full` trả bo tròn (vì `.glass` ngoài `@layer` đè `rounded-full`). GIỮ NỀN ĐẶC: thẻ bão (an toàn phải đọc rõ), nút đang bật (navy/sea), thẻ thông tin + menu bung ra (nội dung đọc kỹ).
- **Hero = `.hero`**: gradient `navy → màu trục`, quầng sáng radial, bo đáy 28px, tiêu đề display 28px. Chip tàu (`BoatSwitcher`) nổi đè mép hero (`-mt-6`).
- **Nút chính + chip + tab**: pill (`rounded-full`); nút cam có bóng màu. Ô nhập: filled (`bg-field`, không viền, focus ring sea). Sheet đáy: bo trên 28px.
- **Ô nhập TIỀN = `MoneyField`** (`ui/primitives.tsx`, hội đồng UX 2026-06-11): mọi ô nhập tiền đồng dùng chung component này — chấm nghìn ngay khi gõ, cap 12 chữ số, dòng đọc-lại "= 45 triệu đồng" khi ≥1 triệu (chống lỗi thừa/thiếu một số 0 làm lệch 10 lần). State giữ CHUỖI SỐ THÔ (`digits`/`onDigits`), helpers `formatDigits`/`parseDigits`/`readbackVnd` trong `lib/format.ts` (có test). KHÔNG tự chế ô tiền với `parseVnd` + toLocaleString tay nữa.
- **Hành động phá hủy KHÔNG bao giờ 1 chạm**: `ConfirmDialog` (xóa cả bản ghi) hoặc xác nhận inline ngay trong hàng ("Xóa 'X'? [Xóa hẳn][Thôi]" — mẫu ở `my-places-sheet.tsx`). Nút icon trong hàng danh sách là ô vuông `.sq-btn` (bậc control §0) và luôn kèm nhãn chữ. Gạch nợ ứng (`crew-list.tsx`) cũng phải ConfirmDialog nêu rõ số tiền.
- **Nút GỌI = `CallButton`** (`ui/primitives.tsx`, 2026-06-11): pill xanh biển icon + chữ, cao bậc control §0, tự lấy số đầu khi chuỗi nhiều số. Không tự chế nút gọi chữ trần.
- **Ô mật khẩu = `PasswordField`** (`auth-form.tsx`): có nút Hiện/Ẩn → form đăng ký KHÔNG cần ô "nhập lại".
- **Slider trên bản đồ dùng class `.range-big`** (globals.css): núm 1.75rem tự vẽ — `accent-color` mặc định núm quá nhỏ.
- **In hồ sơ = `@media print` + `.print-area`/`.no-print`** (globals.css, 2026-06-15): bản in chỉ hiện vùng `.print-area`, giấu nav + nút `.no-print`. *(Người dùng đầu tiên `trip-dossier.tsx` đã XÓA 2026-07-27 — CSS còn trong globals.css cho lần in kế tiếp, hiện chưa component nào dùng.)*
- **Safe-area edge-to-edge** (globals.css + layout.tsx, 2026-06-16): `viewport.viewportFit:"cover"` → app vẽ tràn dưới notch/Dynamic Island. Chrome né vùng an toàn bằng `.safe-pt`/`.safe-pb` (= `env(safe-area-inset-top/bottom)`): hero `page-header.tsx` (`calc(1.5rem+inset-top)`), overlay top map `fishing-map-view.tsx`, đáy `bottom-sheet`/`snap-sheet`. Dock đã tự cộng inset-bottom. `body { overscroll-behavior-y: none }` chặn rubber-band (cảm giác app).
- **Motion điềm đạm** (globals.css, 2026-06-16): chuyển động chuẩn native, CSS THUẦN (không lib). Keyframes `sdf-{scrim,sheet,pop}-{in,out}` + class `.anim-{scrim,sheet,pop,fade}-{in,out}` (180–220ms ease). Áp: BottomSheet (scrim mờ + panel trượt lên/xuống), ConfirmDialog (scrim mờ + card pop), Tabs (tabpanel `.anim-fade-in` đổi tab), **chuyển ROUTE (`src/app/template.tsx`, 2026-09-24): nội dung trang mới `.anim-fade-in` hiện lên mượt thay vì nhảy tức thì — TRỪ bản đồ `/ngu-truong` (full-bleed + render nặng, bỏ qua fade)**. Đóng-có-animation qua hook `lib/use-exit-transition.ts` (chạy animation thoát rồi mới gọi onClose; API component KHÔNG đổi). **`NutCamXuc` / `DongCamXuc`** (`components/kairos/nut-cam-xuc.tsx`, 2026-10-24): nút cảm xúc kiểu FB — chạm 👍, giữ ~0,4 s (cảm ứng) / rê ~0,55 s (chuột) ⇒ thanh nổi `shadow-float` 6 biểu tượng 2.75rem phóng 1.25× khi rê, chặn menu giữ-lâu iOS (`-webkit-touch-callout:none`); dòng tổng ≤3 biểu tượng tròn chồng −0.375rem + số. **`ChuXemThem`** (`components/kairos/chu-xem-them.tsx`, 2026-10-24): chữ dài cắt N dòng (2–8), ĐO tràn thật (`biCat` scrollHeight>clientHeight, đo lại khi đổi bề ngang), tràn ⇒ nút "… Xem thêm" góc dưới-phải trên nền đặc cùng màu khung (`nen` card/field, dải mờ 0–30 %), chạm mở hết tại chỗ, không lan click ra thẻ. **`ImagePicker` thêm `openRef` (nút ngoài mở hộp chọn ảnh) + `chiAnh` (chỉ ảnh 9rem, không nhãn, không ô "Thêm ảnh")** — dùng ở khung soạn Kairos kiểu Facebook (nút Ảnh nằm ở thanh công cụ); icon mới `ImageIcon` (khung + núi + mặt trời, cùng nét). **Hiệu ứng MỞ của BottomSheet (khoá cuộn, đặt con trỏ vào ô đầu, trả con trỏ khi đóng) chạy ĐÚNG MỘT LẦN mỗi lần mở** — `onClose`/đóng-nhẹ đọc qua ref, `requestClose` giữ nguyên danh tính dù bên gọi truyền hàm mới mỗi lần vẽ (2026-10-24: trước đó gõ một chữ trong khung soạn Kairos là con trỏ nhảy khỏi ô, "gõ từng chữ một"; test `bottom-sheet-go-chu.test.ts`). **KHÔNG bounce/nhún nhảy**; block `prefers-reduced-motion` tự tắt mọi animation. Haptics nhẹ `lib/haptics.ts` (`tapFeedback`) chỉ ở ConfirmDialog confirm.
- **HAI HỌ NÚT — có chủ đích, đừng gộp** (làm rõ 2026-09-24, audit UI): (a) **Nút hành động TẠI CHỖ trong hàng/thẻ** = ô VUÔNG `.sq-btn` (`ui/sq-btn.ts`, 56px, icon trên chữ) — vd "Thêm", "Gia hạn", "Biểu đồ". (b) **CTA liên hệ / xác thực** = PILL `rounded-full` — "Gọi SDVICO" (`sdvico-request.tsx`, `CallButton`), "Đăng nhập"/"Đăng ký" (`login-gate.tsx`). Hai họ CÙNG XUẤT HIỆN trên một màn (vd /tau Dịch vụ) là ĐÚNG, không phải lệch chuẩn — mỗi họ mang một nghĩa. Cả hai đã có `:active` scale (press feedback). Thêm nút mới: chọn họ theo NGHĨA (tại-chỗ → vuông; liên-hệ/auth → pill), không trộn hình trong cùng một nghĩa.
- **Hướng dẫn trên màn (coach-tour) ĐÃ GỠ 2026-08-26** — component `ui/coach-tour.tsx` + engine `lib/tour.ts` đã xoá (chủ dự án chốt "app cần hướng dẫn là app đểu, bỏ luôn"). KHÔNG dựng lại tour tự-bung; sách hướng dẫn HTML ngoài app vẫn còn ([07 §12](07-design-spec.md)).
- **Vùng chạm**: Tabs + nút SnapSheet theo bậc tab/control của §0. Thanh kéo của SnapSheet ở nấc `hidden` (2026-08-24) VẼ mảnh (vệt kính h-8) nhưng VÙNG CHẠM vẫn giữ bậc control §0 — vệt vẽ mảnh không được kéo vùng chạm xuống theo.
- **Overlay TỰ-ẨN khi idle phải tính CUỘN là "đang đọc"** (pattern chốt 2026-10-05, fix bug "Ngư trường → Tất cả → kéo xuống là tắt"): mọi lớp nổi có đồng hồ tự-đóng khi không thao tác (SnapSheet 3s · rail/panel lớp `ra-khoi-controls` 5s) mà BÊN TRONG có vùng cuộn (`overflow-y-auto`) phải nạp lại đồng hồ KHI CUỘN, không chỉ khi chạm/gõ. Dùng **`onScrollCapture` ở container gốc** (KHÔNG `onScroll`): sự kiện `scroll` không bubble nên onScroll ở cha không bắt được vùng cuộn con; pha CAPTURE thì bắt được MỌI vùng cuộn con (kể cả list LỒNG, vd route-planner trong sheet) tại một chỗ. Lý do bắt buộc: cuộn bánh xe / cuộn quán tính (buông tay trang vẫn trôi) KHÔNG bắn `pointerdown` ⇒ chỉ nghe pointer/key thì panel sập giữa lúc bà con đang kéo xem. (`ui/snap-sheet.tsx` `<section onScrollCapture>` · `ra-khoi-controls.tsx` container gốc.)
- **Dock điều hướng nổi**: thanh navy kính mờ bo 26px tách khỏi mép màn hình, tab chọn = pill trắng. Item ≥60px, icon luôn kèm chữ.
- Thẻ 4 trục ở Home: **tonal** — nền `--tN-bg`, icon tròn đặc `--tN`.

### Phân cấp điều hướng TRONG trang (chốt 2026-06-10, khi cấu trúc mới sinh chip lồng chip)
> ⛔ THAY màu + cỡ chip bởi §0b (2026-10-19): chip chọn = navy, cùng bậc 2.5rem cả hai tầng; KHÔNG pill đặc màu trục.

Người dùng phải biết mình đang ở tầng nào bằng MẮT, không bằng suy luận:
1. **Tabs** (`ui/tabs.tsx`) — chia KHU trong một trang (vd /tau: Giấy tờ · Dịch vụ · Sản phẩm). Track pill sticky, tab chọn navy đặc. *(/tien bỏ Tabs 2026-07-27 — chỉ còn 1 khu Giao dịch.)*
2. **Chip tầng 1** (`ui/chip-row.tsx` `level=1`) — mục chính TRONG một tab: pill ĐẶC màu trục, **3.5rem** (56px), chữ 1rem (vd Giá cá · Ai cần mua · Bán ở đâu; chip nhóm hàng + chip sắp xếp của khu chợ). *(Số cũ 48px hết hiệu lực từ 2026-08-29e — xem 5d.)*
3. **Chip tầng 2** (`level=2`) — mục con bên trong một mục: pill TONAL nền nhạt màu trục, cùng bậc chip 2.5rem của §0, chữ 0.8125rem — nhẹ hơn tầng 1 bằng màu, không bằng cỡ (vd các mục của Đầu mối).
KHÔNG tự chép tay style chip nữa — mọi hàng chip điều hướng dùng `ChipRow` (truyền `accent` đúng màu trục). Không đào sâu quá 3 tầng (Tabs → chip 1 → chip 2 là kịch trần).

### Nhãn — ≤2 chữ, cỡ cố định theo loại, bảng nhãn chuẩn (anh Long chốt 2026-10-19; thay luật "Nhãn ngang hàng" 2026-07-28)

Nguyên văn: *"các quy tắc về nhãn, kích thước các kiểu, tối đa chữ 1 nhãn là 2 chữ thôi, ko phải mở rộng theo chiều dài của chữ, đặt tên nhãn chuẩn vào"*.

1. **Mỗi nhãn tối đa 2 chữ (2 tiếng)** — áp cho nút, tab, chip, mục dock, tiêu đề hàng, nút trong thẻ. Số đếm (vd "3") và dấu không tính; ngoại lệ duy nhất: tên riêng **"Sen Biển"** tính là một tên. Nhãn dài → đổi sang tên chuẩn: "Xem thêm 3 tin cũ hơn" → **Xem thêm**, "Chạm để nói với Sen Biển" → **Nói**, "Kiểm tra tin trước khi đăng" → **Xem trước**, "Tin mua/bán" → **Mua bán**, "Bán ở đâu" → **Đầu mối**, "Đơn của tôi" → **Đơn hàng**, "Yêu cầu gia hạn của tôi" → **Yêu cầu**, "Máy & động cơ" → **Máy móc**, "Tạo tài khoản" → **Đăng ký**.
2. **Cỡ cố định theo loại** — cùng loại ⇒ cùng rộng/cao, chữ canh giữa, KHÔNG nở theo chữ: ô vuông bản đồ `.sq-tile` 4rem × 2.75rem; nút phụ chữ `.sq-btn` rộng ≥5.5rem cao 2.75rem; nút chính cao 3.25rem (full bề ngang khối hoặc rộng cố định trong hàng); chip rộng ≥5.5rem cao 2.5rem; tab chia đều `flex-1`; mục dock 5 cột đều.
3. **Bảng nhãn chuẩn sống ở `src/lib/labels.ts` (`NHAN`)** — tên cho từng hành động lặp lại; component lấy từ đó, không đặt tên tại chỗ. Test `labels.test.ts` gác ≤2 chữ; hook pre-commit WARN khi thấy `<button>…</button>` có nhãn >2 chữ.

| Việc | Nhãn | Việc | Nhãn |
|---|---|---|---|
| Ghi | **Lưu** | Bỏ dở | **Huỷ** |
| Chỉnh | **Sửa** | Bỏ hẳn | **Xoá** |
| Tạo mới | **Thêm** | Kết thúc bước | **Xong** / **Tiếp** |
| Gửi đi | **Gửi** | Đóng / ẩn | **Đóng** / **Ẩn** |
| Mở rộng / thu | **Xem thêm** / **Thu gọn** | Xem trước khi gửi | **Xem trước** |
| Mở chi tiết | **Chi tiết** / **Mở** | Lùi | **Quay lại** |
| Làm lại khi lỗi | **Thử lại** | Đổi lựa chọn | **Đổi** / **Chọn** |
| Vào app | **Đăng nhập** | Tạo tài khoản | **Đăng ký** |
| Ra khỏi | **Đăng xuất** | Quên mật khẩu | **Cấp lại** |
| Gọi điện | **Gọi** | Liên hệ chung | **Liên hệ** |
| Đăng tin chợ cá | **Đăng tin** | Mua | **Đặt hàng** / **Mua lại** |
| Giỏ / đơn | **Giỏ hàng** / **Đơn hàng** | Thanh toán | **Thanh toán** |
| Hỏi giá | **Báo giá** | Gia hạn VMS | **Gia hạn** |
| Tìm / lọc | **Tìm** / **Lọc** | Cài PWA | **Cài app** |
| Bản đồ: lớp | **Lớp** | GPS | **Vị trí** |
| Chạy bằng GPS | **Chạy tàu** / **Đang chạy** | Lập tuyến | **Lộ trình** |
| Dẫn đường | **Dẫn đường** / **Dừng** | Thêm chặng | **Điểm** / **Đã lưu** |
| Tính tuyến | **Tính đường** | Nói / nghe | **Nói** / **Nghe** |
| Biểu đồ giá | **Biểu đồ** | Khác | **Cài đặt** · **Sao lưu** · **Hướng dẫn** · **Chính sách** |

4. **Cùng cụm, cùng khuôn** (giữ từ luật cũ): thanh tab / hàng chip / dock cùng số dòng (1 dòng), >4 tab thì cuộn ngang, không ép `flex-1`; dock 5 cột cố định, `.dock-label` nowrap.

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

Mọi trạng thái trên thẻ (giấy tờ, bảo dưỡng, sản phẩm/bảo hành, thuyền viên, ~~mức phạt~~ giỏ/đơn) dùng **`ui/status-banner.tsx` (`StatusBanner`)** — băng màu + icon + chữ ở ĐẦU thẻ. Màu không bao giờ đứng một mình (an toàn mù màu). **Phạm vi chốt 2026-08-18** (khớp [07 §8 + §12](07-design-spec.md)): `StatusBanner` = **thẻ dữ liệu + banner tĩnh trong luồng**; **chip nổi trên bản đồ / kết quả tuyến** dùng khuôn `<p role="status">` với **cùng token** warn/danger (`bg-warn-bg text-warn` …), không bọc StatusBanner. **Xanh (ok) KHÔNG đeo băng**; `days === 0` = đỏ; chưa tới hạn = neutral (không băng).

- Mức: `danger` / `warn` / `ok` / `neutral`. Icon mặc định theo mức (chuông/đồng hồ/tick), truyền `icon` khi cần khác, `icon={null}` để bỏ.
- KHÔNG tự chế kiểu trạng thái mới (viền trái màu, icon màu trơ trọi…) — các bản chép tay cũ ở fines-lookup/crew-list/document-vault/maintenance-reminders đã gom hết về StatusBanner.
- Mức phạt không bao giờ "tốt": phạt nhẹ dùng `neutral` (xám bình tĩnh), không dùng xanh.
- **`neutral` cho "chưa biết / chưa tới việc" (chốt 2026-08-18, gói C — 07 §12 "màu = chữ")**: `CrewIssueLevel` (`lib/crew.ts`) = `danger | warn | neutral | ok` — `neutral` = "Chưa ghi hạn bảo hiểm" (có bảo hiểm nhưng chưa ghi hạn, không dám nói "ổn", không doạ đỏ); `requestStatusVN` (`lib/owned-assets.ts`) chỉ còn `ok | neutral` — "Đã nhận — chờ gọi lại" / "Đang xử lý" là neutral, KHÔNG vàng; nợ SDVICO chưa tới hạn = neutral "Chờ thanh toán — hạn dd/mm/yyyy"; thẻ MẪU đeo băng neutral "Ví dụ: …". Vàng chỉ dành cho việc bà con phải làm; đỏ khi chậm là mất tiền/phạt/nguy hiểm (`days === 0` = đỏ).

### Đặt hàng — bộ đếm số lượng + chip trạng thái đơn (2026-08-11)

- **Bộ đếm số lượng** (`QtyStepper`, export từ `cart-sheet.tsx`): 2 nút − / + bậc control §0 + ô số ở giữa, dùng cho thẻ hàng orderable ở Cửa hàng và trong giỏ. Clamp 1..999. KHÔNG tự chế stepper khác.
- **Chip trạng thái đơn**: `moi` = field/navy (neutral), `da_nhan` = warn, `dang_giao` = sea (xanh biển đặc), `da_giao` = ok (xanh lá), `da_huy` = danger. Nhãn từ `ORDER_STATUS_LABELS` (`lib/catalog-orders.ts`) — GIỮ đồng bộ nhãn ở app chủ tàu và /quan-tri.
- **Giỏ + đặt hàng** ở **bottom-sheet** (`cart-sheet.tsx`) như mọi form tạo/sửa; nút giỏ nổi hiện `cartCount`. Đặt đơn nêu rõ "không thanh toán trong app"; mất mạng báo trung thực "cần có mạng" (online-only).

**Chợ vật tư — BA bộ chip nữa, cùng bảng màu trạng thái (2026-09-06).** Sàn có sáu trạng thái đơn thay vì năm, nên KHÔNG dùng lại bảng của Cửa hàng: nhãn và cặp màu là **một nguồn duy nhất** trong `lib/market/order-state.ts` (`ORDER_STATUS_LABEL`, `ORDER_STATUS_CHIP` — giá trị `var(--token)`, không hex), component dùng chung là `components/market/shared/order-status-chip.tsx`. Người mua, người bán và `/quan-tri` nhìn **cùng một chữ, cùng một màu** — bà con gọi tổng đài đọc "đơn đang giao" thì người trực thấy đúng chữ đó trên màn mình.

| Bộ chip | Giá trị → cặp màu (nền / chữ) |
|---|---|
| **Trạng thái đơn chợ** (6) | `cho_xac_nhan` field/navy (neutral — chưa ai làm gì, đừng doạ) · `da_xac_nhan` warn-bg/warn · `dang_giao` sea/card (xanh biển đặc — đang chạy) · `da_giao` ok-bg/ok · `hoan_thanh` ok/card (xanh lá đặc — xong hẳn) · `da_huy` danger-bg/danger |
| **Thanh toán** (3 nấc, `PaymentStatusChip`) | `chua_thanh_toan` field/navy · `bao_da_chuyen` warn-bg/warn (**lời khai của người mua — app KHÔNG xác minh tiền**, nên vàng "đang chờ", không xanh) · `da_thanh_toan` ok-bg/ok |
| **Trạng thái gian hàng** (4, chỉ hiện ở `/quan-tri`) | `cho_duyet` warn-bg/warn · `hoat_dong` ok-bg/ok · `tam_khoa` danger-bg/danger · `tu_choi` field/foreground-70 (xám — không phải lỗi hệ thống, là chưa đạt) |

Chip món của admin dùng lại đúng ba cặp trên: "Đã gỡ" = danger, "Đang bán" = ok, "Hết hàng"/"Shop ẩn" = field. **Sao đánh giá** dùng `RatingStars` (`components/market/shared`), không tự chế ký tự ★.

**GIÁ HIỆN Ở ĐÂU CŨNG QUA `PriceText`** (`components/market/shared/price-text.tsx`) — thẻ lưới, màn món, màn shop, tìm kiếm, danh sách của người bán. Từ 2026-09-07 ([ADR 0014](../adr/0014-gop-cua-hang-vao-cho.md)) nó nhận `priceVnd: number | null`, và **`null` in ra chữ "Liên hệ báo giá"** — đúng cỡ chữ, đúng màu `text-trim`, đúng độ đậm của giá thật để hàng thẻ không so le. Đây là luật, không phải tuỳ chọn: **cấm để một giá rỗng rơi vào `formatVnd()`**, vì nó in ra "0 đ" và bà con đọc "0 đ" là hiểu cho không. Chỗ nào không dùng được `PriceText` (bảng của `/quan-tri`) thì tự rẽ nhánh `null` trước khi gọi `formatVnd`.

**CHIP CHỌN CỦA CHỢ = `ChipRow` TẦNG 1, không tầng 2 (2026-09-06).** Chip nhóm hàng ở `/cho` · `/cho/tim` · trang shop (`shared/category-chips.tsx`) và hàng chip sắp xếp ở `/cho/tim` đều dùng **`level={1}`**, accent `t3` — từ 2026-10-19 cả hai tầng chung bậc chip 2.5rem (§0), tầng 2 chỉ khác màu.

### Kairos — thẻ bài + ảnh đại diện chữ cái (2026-10-23, [14](14-ba-spec-kairos.md))

- **`PostCard`** (`components/kairos/post-card.tsx`) — MỘT khung `.surface` cho ba loại bài, chỉ khác ĐẦU THẺ: báo (tên báo đậm navy · giờ · chủ đề chữ `sea` bên phải), Chính thức (tên "SDVICO" + chip **Chính thức** `bg-sea/12 text-sea` + chip **Ghim** `bg-sun/20` khi còn hạn), bà con (ảnh đại diện + tên gọi một dòng `truncate` + dòng phụ "Cảng X · số hiệu · giờ · đã sửa"). Thân bà con `line-clamp-6` + "Xem thêm"; lưới ảnh kiểu FB (`anh-luoi.boCucAnh`, 2026-10-24): 1 ảnh theo tỉ lệ thật (dọc 4:5, kẹp 12–34rem) / 2 (hai cột vuông) / 3 (ô trái cao hai hàng) / 4+ (2×2, ô thứ tư phủ "+N" `bg-navy/60`), khe 0.125rem. Dòng tổng: cảm xúc trái · "N bình luận" phải (chữ 0.875rem `foreground/65`, không phải nút có viền). Chân: ba nút đều nhau `flex-1` cao 2.75rem (Hay · Bình luận · Chia sẻ, icon `ThumbIcon`/`CommentIcon`/`ShareIcon` + nhãn từ `labels.ts`, Bình luận không kèm số), Hay đã bấm = chữ `sea`. Ba chấm ⋯ 2.75rem tròn ở góc phải ĐẦU THẺ cạnh Nghe (không ở chân). Bình luận đầu: bong bóng `bg-field` bo 1rem. Nút chưa nối hành vi thì `disabled` (không mờ hẳn — vẫn đọc được số). ~~Viên "Bến X" dưới thân + nhãn tĩnh "Cả nước"~~ (bỏ 2026-10-24) ⇒ xem mẫu **Nhãn nơi chốn trên dòng tên** dưới.
- **Nhãn nơi chốn chạm được trên dòng tên** (rà FB vòng 2, 2026-10-24 — như tên nhóm FB "Tên ▸ Nhóm"): sau tên (và chấm Chính thức/AI) một dấu `▸` 0.75rem `foreground/50` `aria-hidden` + liên kết **"Bến X"** chữ đậm `sea` cùng cỡ tên, `shrink-0` (tên `truncate` co trước). Vùng chạm 2.75rem bằng `py-3 -my-3 px-1 -mx-1` — dòng tên KHÔNG cao lên; `focus-visible:ring-2 ring-sea`. Liên kết RIÊNG, không lồng trong liên kết trang cá nhân. Chỉ khi bài gắn cảng có trong danh mục; ẩn khi đang ở chính Bến đó (prop `benPort`). Không có nhãn tĩnh không bấm được (bỏ "Cả nước"). Cùng tinh thần ở trang cá nhân: cảng nhà là liên kết chữ `sea` đậm `min-h-11`, gạch chân khi rê, viền tiêu điểm `outline-sea`.
- **Trình xem ảnh toàn màn** (`components/kairos/xem-anh.tsx`, 2026-10-24): portal vào `body`, `fixed inset-0 z-40` **nền `bg-navy`** chữ trắng (token, không đen rời). Thanh trên 3.5rem (+ safe-area): bộ đếm "i/N" 0.9375rem `tabular-nums` trái (ẩn khi 1 ảnh) · nút Tải ảnh 2.75rem tròn · **× góc phải** = `CloseButton variant="goc"` (luật thẻ nổi toàn app). Thân: dải cuộn ngang **`snap-x snap-mandatory`** mỗi ảnh một trang `snap-center`, `object-contain`, `touch-action: pan-x pinch-zoom` (chụm phóng của trình duyệt) — KHÔNG thư viện vuốt. Mở đứng ngay ở ảnh được chạm. Đóng: × · Escape · nút back máy (đẩy một mục lịch sử); khoá cuộn trang (`lockBodyScroll`), trả tiêu điểm về ô ảnh. Dòng trạng thái đáy `role="status"` 0.875rem (hỏng ⇒ chữ `sun`). Ảnh không tải được ⇒ "Cần sóng để xem ảnh" `white/80` giữa màn thay khung vỡ; mất sóng ⇒ nút Tải mờ. Dựng CHỈ khi mở (không tốn gì cho thẻ chưa chạm).
- **Thẻ đầu Bến** (2026-10-24): `.surface` dải bìa 6rem `bg-sea/15` tên cảng `display` 1.5rem `sea` · "Bến X" 1.25rem navy · dòng phụ 0.875rem · hai nút 2.75rem chia đôi (Đăng nền sea · Cảng nhà viền + tick khi đã chọn) — không nút Tham gia, không số thành viên.
- **Viên trả lời bình luận**: dòng 0.8125rem "Trả lời **tên**" thụt 2.5rem trên ô viết + × 2rem (`CloseIcon`) huỷ — thay việc chèn "@tên" vào chữ. Luồng gập: nút 2.25rem "Xem N phản hồi" kèm `KairosAvatar small` người trả lời cuối.
- **Ảnh đại diện chữ cái** (`KairosAvatar`): tròn 2.5rem (bình luận 2rem), chữ cái đầu trắng đậm trên **`--kairos-av-1..6`** (globals.css, A15 — 6 nền đậm, mỗi nền ≥4.5:1 với chữ trắng), chọn theo băm `profileId` ⇒ cùng người luôn cùng màu. Không có ảnh / bản lưu mất sóng ⇒ luôn về chữ cái, không ô vỡ.
- **Nút "Có N bài mới"**: viên `bg-sea` chữ trắng, dính đầu dòng tin (`sticky`), chỉ hiện khi N>0, trần "99+".
- **Hàng chip Kairos** = `ChipRow` tầng 1 (11 chip, nhãn `NHAN_CHIP_KAIROS` trong `labels.ts`) — không bộ chip riêng.
- **Dock 6 ô**: pill sáng 3.25rem × 2.5rem (trước 3.75rem) để 6 ô vừa máy 360 px; icon Kairos `NewsIcon` (tờ báo gấp) cùng nét 2.2.
- **Thông báo nổi Kairos** (`use-post-actions`): viên bo 1rem nổi trên dock (`bottom-24`), `role="status"`, tự tắt 5 s; tốt = `bg-navy` chữ trắng, hỏng = `bg-danger-bg text-danger`. Dùng cho kết quả của cú bấm không mở sheet (Hay lỗi, Đã đăng, Đã chặn) — không chặn màn, không thay câu lỗi dưới ô nhập.
- **Nút ghi 3 trạng thái** (mọi nút gửi Kairos): nhãn đổi theo thứ tự ưu tiên `Cần sóng` (mất sóng, xám) › `Đang gửi` (`aria-busy`, xám) › nhãn việc (Đăng/Gửi/Lưu/Đồng ý); lỗi ⇒ câu `role="alert"` chữ `danger` NGAY TRÊN nút, nút bấm lại được. Nhãn lấy từ `labels.ts` (`canSong`, `dangGui`).
- **Bảng hành động** (ShareSheet 4 việc, ba chấm Sửa/Xoá hoặc Báo xấu/Chặn): `BottomSheet` kiểu `xem`, mỗi việc một hàng cao 3.5rem chữ đậm, chú thích phụ nhỏ bên phải; việc phá huỷ chữ `danger` + `ConfirmDialog`.
- **Bình luận**: bong bóng `bg-field` bo 1rem (tên đậm navy trên, chữ dưới), hàng việc nhỏ cao 2.25rem (giờ · Hay · Trả lời · Xoá/Báo xấu), trả lời thụt 2.5rem; xoá xác nhận TẠI CHỖ (hàng "Xoá bình luận? Xoá · Huỷ") thay vì hộp nổi.
- **Ảnh đại diện lớn** (`KairosAvatar large`): 5rem, chữ 2rem — sheet "Sửa trang" (trước 2026-10-24 cả đầu trang người dùng).
- **Đầu trang cá nhân kiểu Facebook** (2026-10-24, 14 §3.8): **ảnh bìa** `aspect-[2.6/1]` trọn bề ngang thẻ `.surface` (`overflow-hidden`), chưa có ảnh ⇒ nền `bg-sea/15` (token, không ảnh giả); **`KairosAvatar xl`** 6rem chữ 2.5rem, viền `ring-4 ring-card` tách nền, đè mép dưới bìa bằng `-mt-12`. Trang mình: viên `bg-card/90` góc phải dưới bìa ghi "Ảnh"/"Đổi ảnh"/"Đang gửi". Chấm **"AI"** cạnh tên: viên `bg-navy/10` chữ 0.6875rem đậm. Nhãn **Cùng cảng**: viên `bg-ok-bg text-ok` 0.75rem. Số đếm "**N** bài · **N** người theo dõi · **M** đang theo dõi": số đậm navy, chữ thường 0.875rem — đây là DÒNG ĐẾM (như "N bài" cũ), không phải nhãn nút, nên không theo trần 2 chữ; hai số sau bấm được (`min-h-11`). Lưới **Ảnh**: 3 cột vuông, khe 0.25rem, bo ngoài 0.75rem. Thẻ `Tabs` sẵn có (Bài viết · Ảnh · Giới thiệu), không bộ tab riêng.

## 3. Typography

- **Archivo** — display/heading: đậm chắc, đáng tin, kiểu "thiết bị hàng hải" (đã thay Baloo 2 ngày 2026-06-10 — feedback: tròn trịa quá thành trẻ con)
- **Plus Jakarta Sans** — body (thay Be Vietnam Pro 2026-06-11, user: "dùng loại international hơn"): geometric-humanist kiểu app toàn cầu, subset `vietnamese` đầy đủ dấu. Ngoại lệ FONT hợp lệ theo ui-design-logic vì user chỉ đích danh 2026-06-11.
- Cỡ theo §0; không dùng font-weight mảnh (light/thin); **ít chữ đậm** — đậm chỉ cho tiêu đề, tên đối tượng và con số quan trọng; nhãn nút 600, meta 500 thường.

### Type ramp — nguồn duy nhất của cỡ chữ arbitrary (chốt 2026-08-13; cập nhật theo thang Codex 2026-10-19)

type-ramp: 0.6875rem 0.75rem 0.8125rem 0.875rem 1rem 1.125rem 1.25rem 1.5rem

- Hook WARN mọi `text-[…rem]` ngoài ramp trên file staged — dùng bậc ramp, hoặc thêm bậc vào ĐÂY kèm lý do.
- Bậc cũ 0.9375rem / 1.0625rem / 1.1875rem / 1.375rem / 1.75rem… dọn dần khi chạm file (đổi về bậc gần nhất của thang §0).
- **Ngoại lệ data-viz**: nhãn trục/chú thích trong SVG chart được 0.75rem; số quan trọng vẫn ở tầng HTML theo §0.

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

- **HUD dẫn đường / Đang chạy — hàng KÊNH CẢNH BÁO (2026-10-13, 07 §10.7 S)**: lưới 2 cột ngay dưới hàng tiêu đề: **"Giọng: đầy đủ / ít / im 30 phút / tắt"** (`SpeakerIcon`) | **"Báo rung: đang bật/tắt"** — chữ chứ không chỉ hình, bậc control §0, bật = `bg-t1/15 text-t1`, tắt/im = `bg-navy/10 text-navy/60`. Dòng **câu đang đọc**: `SpeakerIcon` + đúng câu loa đang nói; câu đỏ dùng `bg-danger-bg text-danger` + nút **"Đã nghe"** nền `bg-danger` chữ trắng. Máy không có giọng Việt: dòng `bg-warn-bg text-warn` + nút **"Tải giọng"** nền `bg-navy` (KHÔNG chữ trắng trên `warn` — tương phản thấp ngoài nắng). Nút rail **"Bắt đầu chạy" / "Đang chạy"** cùng khuôn nút "Lộ trình": nền đổi + chữ đổi + chấm trắng nhấp nháy.

- **Nhãn chủ quyền**: BIỂN ĐÔNG / VỊNH BẮC BỘ / VỊNH THÁI LAN + HOÀNG SA (TP. Đà Nẵng — VN), TRƯỜNG SA (Tỉnh Khánh Hòa — VN) render bằng HTML marker tiếng Việt, halo màu nước để đọc được trên mọi lớp ảnh; tile quốc tế bị che bằng mask ở zoom ≤9. KHÔNG để lộ "South China Sea / Paracel / Spratly". Map view mới phải dùng lại `buildMapStyle` + `SOVEREIGNTY_LABELS` từ `src/lib/ocean-map.ts`.
- **Chọn lớp ảnh**: hàng chọn theo bậc hàng danh sách §0, icon + từ đời thường ("Hải đồ độ sâu", "Nước nóng lạnh", "Vùng nhiều mồi", "Ảnh mây trời") — không dùng thuật ngữ SST/chlorophyll trong UI. **Lớp mặc định khi mở = Hải đồ độ sâu** (chuẩn mọi app hàng hải — Navionics/C-MAP/OpenCPN mở nautical chart, vệ tinh chỉ là tuỳ chọn; xem [../research/09-hai-do-mac-dinh.md](../research/09-hai-do-mac-dinh.md)); app nhớ lớp người dùng chọn (`forfish.maplayer.v1`).
- **Trung thực dữ liệu**: luôn hiện "Ảnh ngày X — ảnh vệ tinh luôn chậm vài ngày" đè góc bản đồ; chú giải nói rõ "chỗ trống là mây che".
- **Hải đồ có số (2026-06-10, user: "hải đồ không thấy được, toàn màu xanh")**: nền hải đồ kèm **đường đẳng sâu + nhãn số mét** (20/50/100/200/500/1000/2000 m) tự sinh từ ETOPO (`scripts/generate-isobaths.mjs` → `public/data/isobaths.v1.json`, ~200 KB) vì EMODnet WMS chỉ phủ châu Âu. Style cần `glyphs` (fonts.openmaptiles.org) cho nhãn. Chỉ vẽ trên nền hải đồ, không vẽ đè nền vệ tinh.
- **Legend tại chỗ (kiểu Google Maps)**: badge góc trái = tên lớp + ngày + **thanh gradient mini + 2 đầu thang** của nền đang xem; lớp Dự báo cá có legend riêng ở cuối hàng chip loài ("khả năng có cá" xanh lá nhạt→đậm). KHÔNG bắt người dùng mở sheet mới biết màu nghĩa là gì.
- **Lớp Dự báo cá** — ~~heatmap MỖI LOÀI MỘT MÀU + hồng tâm (2026-06-10, tham khảo PFZ của OceanFishMap): ô điểm → lớp `heatmap` maplibre, màu theo loài (`SPECIES_PROFILES.color` → ramp 1 sắc qua hàm `fishHeatColor`), "Mọi loài" = xanh lá `#95d5b2→#1b4b2c`~~ → **từ 2026-07-27 (đính chính doc 2026-08-18, khớp `fishing-map-view.tsx` + `FISH_LEVEL_BANDS` trong `fish-predict.ts`): LƯỚI Ô kiểu bản tin ngư trường, 3 MỨC CỐ ĐỊNH không đổi theo loài** — Thấp ≥40 xanh lá `#22c55e` · Trung bình ≥60 vàng `#eab308` · Cao ≥75 đỏ `#ef4444` (`fill-opacity` 0.6, chỉ màu không in số; chọn loài chỉ đổi điểm từng ô). `SPECIES_PROFILES.color` vẫn còn (marker/thẻ loài), hàm `fishHeatColor` ĐÃ XOÁ. ≤8 điểm nóng nhất (≥75 điểm, cách nhau ≥0.7°) vẽ marker **hồng tâm** `TargetIcon` tô màu loài đang chọn — chạm là bay tới; điểm nóng GẦN MÌNH (≤~40 hải lý) viền cam. Thẻ cá kèm số môi trường ("Nước 28°C · mồi vừa") + **tuần trăng** (`lib/moon.ts`); loài ĐÁY/RẠN (`surfaceSignal` low) hiện cảnh báo vàng "đoán theo mùa + độ sâu, ảnh vệ tinh ít chính xác". Màu loài là NỘI DUNG bản đồ (khai trong `fish-predict.ts`, ngoại lệ §5). Phân màu CHUNG: cá = màu theo loài; cam-đỏ = riêng ranh giới; xanh dương = tuyến đi.
- **Chọn loài cá = nút GỌN + bảng modal (sửa 2026-06-11, user: "hàng chip ngang chắn map, không ẩn hiện gọn")**: BỎ hàng chip cuộn ngang full-width (chắn nhãn chủ quyền, 40 loài cuộn mệt). Thay bằng **một nút "Cá" nhỏ** (`inline-flex max-w-[80%] self-start`, chỉ rộng bằng nội dung) hiện loài đang chọn + chấm màu + chevron; chạm mở **`fish-species-sheet.tsx`** (modal `ui/bottom-sheet`): "Mọi loài" trên cùng + loài đang vụ **gom theo nhóm** (`CATEGORY_LABEL`), mỗi loài chấm màu + tên đầy đủ, **loài vùng đang xem viền cam + xếp đầu nhóm**; chọn xong đóng luôn. Map chỉ còn nút gọn — không vật gì chắn ngang. Chọn loài thì heatmap + hồng tâm tô CHỈ theo màu loài đó. **Ưu tiên gần mình**: điểm nóng cộng thưởng theo khoảng cách tới chỗ xem / cảng nhà / điểm ghim (không bịa cá, chỉ xếp gần lên trước); thẻ cá có dòng "Điểm cá gần bạn nhất ~N hải lý hướng X".
- **Lớp che ↔ chi tiết gần bờ (sửa 2026-06-10)**: sea-mask (che nhãn quốc tế Biển Đông) chỉ ĐẶC ở mức toàn cảnh (z≤6), mờ dần và TẮT ở z8 — không che luồng lạch/cảng khi zoom gần bờ. Lớp ảnh/độ sâu (`ocean-data`) có `maxzoom 12` → zoom sâu hơn thì nhả ra cho basemap (bờ, cảng, sông lạch) + phao đèn hiện. Phao đèn/luồng lạch (OpenSeaMap) `minzoom 8`. Nguyên tắc: sovereignty ở mức vùng, hải đồ chi tiết ở mức gần bờ — không đánh nhau. **Nước nền = màu mask (2026-09-28)**: lớp `water` của Protomaps (gốc `#80deea`) bị đè `fill-color` = `SEA_MASK_COLOR` — lệch màu thì qua lỗ mây trong suốt của lớp ảnh vệ tinh (Nước nóng lạnh / Vùng nhiều mồi) lộ nguyên khung mask thành Ô VUÔNG xám giữa nền xanh ngọc, bà con tưởng bản đồ tải lỗi. Sông (`water_river/stream`) giữ màu gốc để nổi trên đất. Cổng test ở `ocean-map.test.ts`.
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

**CHỌN MỘT GIÁ TRỊ TRONG DANH SÁCH DÀI (>12 lựa chọn) → `<select>` NỀN TẢNG, không phải hàng chip (chốt 2026-09-06).** Ca sinh ra luật: ô **tỉnh** trong `AddressForm` (đặt hàng) và trong form đăng ký / cài đặt shop từng là **34 chip cuộn ngang** — người Khánh Hòa phải kéo qua ~20 chip mới thấy tỉnh mình, mà hàng chip cuộn ngang không cho biết còn bao nhiêu cái nữa ở bên phải. `<select>` nền tảng mở ra danh sách cuộn dọc quen thuộc, gõ chữ cái nhảy tới nơi, và bà con đã gặp nó ở mọi app khác.

- **Ranh giới với luật chip**: `ChipRow` là để **ĐIỀU HƯỚNG** — chuyển khu/mục, tập nhỏ và cố định, người dùng cần thấy hết lựa chọn cùng lúc (nhóm hàng, mục của một tab, cách sắp xếp). Danh sách **GIÁ TRỊ NHẬP** dài thì không phải việc của chip. Không mâu thuẫn với "mọi hàng chip điều hướng dùng `ChipRow`" ở §Phân cấp điều hướng: chỗ này vốn không nên là chip ngay từ đầu.
- **Vẫn giữ luật C2 "đoán sẵn giá trị hay đúng nhất"**: đưa **tỉnh của cảng nhà lên đầu** danh sách; người dùng đổi được, không khoá tay ai.
- **Cỡ chữ**: `<select>` đã nằm trong `input,select,textarea { font-size: max(16px, 1em) }` của `globals.css` (§Nút hành động mục 4) nên iOS không phóng to cả trang khi chạm. Vùng chạm theo sàn 3.5rem như mọi ô nhập.
- ≤12 lựa chọn, tập cố định, cần thấy hết cùng lúc (vd "Giao ra cảng / bến" × "Địa chỉ nhà / kho") thì **vẫn dùng chip** — luật này không phải lệnh đổi mọi chip thành select.

**MÀU TUYẾN THEO CHẶNG (2026-08-29g)** — `ocean-map.ts`: xanh `ROUTE_LINE_COLOR #1a73e8` = không có gì · cam `ROUTE_LEG_AMBER #e8710a` = chú ý vừa · đỏ `ROUTE_LEG_RED #d92d20` = phải lưu ý · xám `ROUTE_LEG_PASSED #8a94a0` = đã đi qua. Bề dày đi kèm màu (5 / 4,5 / 3,5 / 2,5px) để không dựa riêng vào màu. **Không phạm quy ước cam-đỏ độc quyền của ranh giới**: đỏ tuyến là đỏ TƯƠI khác đỏ GẠCH `#b42318`, tuyến luôn có viền trắng dày, và ranh giới là đường dài chạy suốt màn còn chặng là khúc ngắn nối hai ghim số. Lý do đầy đủ ở 07 §10.7 L2.

**MÀU CHẤT ĐÁY + KHU TRÁNH TRÚ BÃO (2026-09-03)** — `ocean-map.ts`, cùng ngoại lệ "màu nội dung bản đồ" (không phải token UI). **`CHAT_DAY_COLORS`** — mỗi loại đáy một màu ĐỦ TÁCH NHAU và đủ SẪM để đọc trên nền biển sáng (#d5e8eb), tách khỏi teal rạn / magenta báo hiệu / cam-đỏ ranh giới: Cát `S #d99a2b` (vàng cát) · Đá `R #5c5560` (xám đá) · San hô `Co #e2674a` (cam-đỏ san hô) · Vụn `G #a9743f` (nâu đất) · Cỏ biển `Sg #2f9163` (lục rêu) · Thảm rong `Ma #7f8c2f` (ô-liu); loại chưa rõ `khac #8a949c` (xám trung tính) làm nền lùi. Mã khớp `codes` của `chat-day.ts`. **`KHU_TRU_BAO_COLOR #0e8a5f`** — xanh lục "bến an toàn": khu neo đậu là nơi CHẠY TỚI khi bão, nên CỐ Ý không dùng cam-đỏ (màu hiểm hoạ/ranh giới) — kênh màu riêng, tách cả với xanh chỉ đường của tuyến.

**KÝ HIỆU HẢI ĐỒ TỰ VẼ + MÀU CÁP/ỐNG/VÙNG CẤM + DẢI ĐỘ SÂU (2026-09-03b — theo [research/danh-gia-hai-do-2026-09.md](../research/danh-gia-hai-do-2026-09.md) §A)** — `lib/chart-symbols.ts` + `lib/ocean-map.ts`, vẫn ngoại lệ "màu nội dung bản đồ", không phải token UI.

- **Sprite `public/icons/chart-sprite*` 74 → 80 → 87 ô**, 13 hình mới TỰ VẼ theo luật viền INK + test bóng sẵn có (cấm "adapted" S-52 là cổng thật). Đợt 1 (6): `rock-awash` (đá ngầm — sao 6 gai đỏ) · `bank` (bãi cạn/cồn — nửa elip chấm) · `coral-reef` (rạn — răng cưa) · `no-anchor` (mỏ neo gạch chéo) · `cable-landing` (cáp cập bờ) · `pipeline-mark` (ống dẫn). Đợt 2 (7, địa hình đáy biển cho `dia-danh-ngam`, mặt cắt teal/INK, không đỏ): `seamount` (núi/dãy — hai chóp) · `knoll` (đồi — gò tròn có đồng mức) · `ridge` (sống — răng cưa thấp) · `guyot` (chóp phẳng — hình thang) · `deep` (hố — khoét chữ V) · `valley` (thung lũng/hẻm/kênh — lòng máng U) · `escarpment` (vách/dốc/đèo — bậc); `diaDanhNgamSymbolId(loai)`; `LOCKED_CELLS` khoá hash từng ô của cả 87 (thêm hình mà không khoá là test đỏ). Gom trong `CHART_FEATURE_ICON`; rạn/bãi/đá dùng `CHART_PALETTE.teal #0e7c86` (= `REEF_DOT_COLOR`) — ba HÌNH, một màu: phân biệt bằng hình chứ không đẻ thêm hue. **Sàn icon 16 px** (`CHART_ICON_MIN_PX`) nay áp cả `WRECK_LAYER`/`LIGHTHOUSE_LAYER` (nấc thấp nhất 0,55/0,6 → **0,7** × 24 = 16,8 px) và có test quét.
- **Ba mối nguy — ba nét KHÁC NHAU cả sắc lẫn ĐỘ SÁNG** (đo trên nền biển `#d5e8eb` SAU khi pha mờ, cùng phép với đẳng sâu, có cổng test): cáp quang `SEA_CABLE_COLOR #6d28d9` @`SEA_CABLE_OPACITY` 0,9, dash `SEA_CABLE_DASH` [4,2] → **4,83:1** (cũ `#7c3aed`@0,6 = 2,44) · vùng cấm/giàn `SEA_RESTRICTED_COLOR #b85a00` @0,9 → **3,25:1** (cũ 2,43) · ống dẫn `PIPELINE_COLOR #1f2933` (MỰC — kênh màu duy nhất chưa ai dùng cho nét, và tối nhất = nguy nhất) @0,95, dash `PIPELINE_DASH` [7;2,5;1,5;2,5] vạch–chấm → **10,17:1**. Độ sáng giữa các nét: cáp–vùng cấm 1,49 · cáp–ống 2,11 · vùng cấm–ống 3,13 (cũ cáp–vùng cấm **1,00** — chỉ khác hue, trên nền sáng/mù màu là một). Vùng cấm có NỀN `RESTRICTED_FILL_COLOR #b85a00` @`RESTRICTED_FILL_OPACITY` 0,1 (bước 1,13 vs nền — nhận ra, không chói; lên 0,12 là nét đẳng sâu đè lên tụt dưới 3) + nhãn `RESTRICTED_LABEL_COLOR #7a3b00` (6,00:1 trên nền đó).
- **Rạn + chất đáy lên sàn 3:1**: viền rạn `REEF_SHAPE_LINE #0b6b74` @`REEF_SHAPE_LINE_OPACITY` 0,85 → **3,75** (cũ 1,89); fill `REEF_SHAPE_FILL_OPACITY` 0,18 → 0,3 (diện, được phép dưới sàn nhưng phải ≥1,15 để nhận ra); chất đáy `CHAT_DAY_COLORS` tối một bậc (giữ hue để chú giải góc vẫn khớp; san hô về đất nung `#a3452a` — không lấn kênh cam cảnh báo) @`CHAT_DAY_OPACITY` 0,8 → **3,3–4,8** (cũ 1,4–2,1). Bài học ghi lại: "màu đủ sẫm" trong comment cũ là chưa đo — mọi độ mờ nay đi qua hằng `*_OPACITY` để cổng đo được.
- **Dải độ sâu `DEPTH_BANDS` 4 nấc** (fill `k=vung`, màu là màu CUỐI không pha): 0–10 nền biển `#d5e8eb` · 10–20 `#e2f0f3` · 20–50 `#eef6f8` · ≥50 `#f8fbfc`, bước giữa hai nấc 1,05–1,09 (ngưỡng "nhận ra"), nấc sâu nhất KHÔNG trắng tinh vì đất nền cũng sáng. **Đường an toàn** `SAFETY_CONTOUR_M` = 10, `SAFETY_CONTOUR_STYLE #2c5a80` @0,95 dày 1,4→2,6 px (z7→12) → 5,19:1 trên biển, ≥5,5 trên mọi dải.
- Sheet "Ký hiệu là gì?" (07 §A) hiện icon bằng cách **cắt đúng ô từ sprite thật** — chú giải không bao giờ lệch hình đang vẽ.

**CHẾ ĐỘ HIỂN THỊ (lịch sử 2026-08-29h → đổi 2026-10-19d)** — trước đây "gọn"/"to" đổi `--row-h` (37/56px). Từ 2026-10-19d: Gọn = gốc 16px, Nút to = gốc 17px (mọi thứ to theo tỷ lệ), `--row-h` = `--h-ctl` 2.75rem ở mọi chế độ; cỡ nút theo bậc §0, không theo chế độ.

**Nhãn công tắc là "Nút to" / "Gọn"** (giữ tên từ 2026-08-29h).

**HÌNH KHỐI NÚT Ở `globals.css .sq-btn`, KHÔNG Ở CHUỖI TAILWIND** — chế độ gọn phải đổi cả BỐ CỤC nút, thứ một chuỗi tĩnh không làm được; nhân đôi chuỗi theo chế độ là quay lại đúng bài học hai bản chép tay. `SQ_BTN` nay chỉ còn tên lớp `"sq-btn"`.

**THÂN HÀNG = NÚT (2026-08-29h, cập nhật 2026-10-19d)** — thân hàng và ô nút trong cùng hàng cao bằng nhau (bậc hàng danh sách / bậc control §0), khối cuộn dùng `space-y-1`. Hàng ba dòng rút còn hai bằng cách bỏ thứ đã suy ra được (toạ độ khi chỗ đó đã có tên).

**HÀNG KHÔNG CÓ NÚT THÌ KÉO HẾT BỀ NGANG (sửa luật B1, 2026-08-29h)** — chừa ô `w-16` rỗng để "mép phải thẳng" chỉ đúng khi hàng đó CÓ nút. Hàng không nút mà vẫn chừa là 72px trống tuyệt đối, trong khi chính dòng chữ bên cạnh đang bị cắt cụt. Đã dính HAI LẦN: hộp thư trang chủ mất 21% bề ngang chữ vì chừa cột không hàng nào dùng, rồi thẻ dẫn đường lặp lại y hệt (chủ dự án: *"khoảng trắng ở kế bên này? nếu ko có nút nào thì kéo ra cho kín"*). Mép phải thẳng là thứ tốt, nhưng không đổi bằng bề ngang của dữ liệu. Đo lại: hàng 263 → 335px.

**KHÔNG ĐƯỢC CÓ NÚT BẤM-KHÔNG-RA-GÌ (2026-08-29h)** — chủ dự án: *"click ko có tác dụng thì ẩn"*. Nút nào ở trạng thái hiện tại không mở ra được gì thì phải ẩn hoặc phải sửa cho mở được; không để nút đứng đó bấm hụt. Án lệ: cổng render viết theo cách kể tên từng panel (`|| panel === "saved"`) làm "Tuỳ chọn" ở màn kết quả bấm ra thẻ RỖNG. Cổng phải viết theo TRẠNG THÁI (`panel !== "idle"`), thêm panel mới tự chạy. Chi tiết: 07 §10.7 M5.

**MỘT THANH ĐÔNG CỨNG, KHÔNG PHẢI HAI (2026-08-29h)** — panel CÓ TRẦN chiều cao chỉ được ghim ĐÚNG MỘT thanh (thường là hàng trên: danh tính + nút hành động). Muốn ghim thêm thứ gì thì phải BỎ một thứ đang ghim, không cộng dồn. Án lệ: thẻ dẫn đường 252px từng ghim cả hàng trên (~68px) lẫn dải đáy (~76px) ⇒ cửa đọc còn ~104px, chữ bị mép trên và mép dưới cắt ngang cùng lúc, cuộn kiểu gì cũng có một đầu đang cụt (chủ dự án: *"freeze 2 cái trên dưới, nội dung ở giữa kéo khó đọc"*). Cách gỡ: cho MỘT ô hành động gánh hai việc theo trạng thái, khi hai việc đó không bao giờ là "việc kế tiếp" cùng lúc. Đo lại: cửa đọc 104 → 184px, chiều cao thẻ không đổi. Chi tiết: 07 §10.7 L7.

**Trần khung nổi**: mọi panel/popup/bottom-sheet **trên màn bản đồ** giữ ≤ ~40% màn ở trạng thái mặc định. Đo trên bản đồ: Lớp 36% · Đến điểm 31% · Điểm đã lưu 36% · sheet Tài khoản 33%.

**NGOẠI LỆ ĐÃ CHỐT 2026-08-29f — FORM Ở MÀN THƯỜNG KHÔNG BỊ TRẦN 40%.** Sau khi cắt ô theo C1, đo lại 375×812 vẫn vượt: `DocumentForm` **69%** · `BuyerForm` **67%** · `PriceHistorySheet` **73%** (sheet Tài khoản 33% là ca duy nhất đạt). **Chốt: GIỮ NGUYÊN, không ép xuống 40%.**

*Vì sao:* trần 40% sinh ra để **bản đồ còn nhìn được** — nền phía sau là dữ liệu bà con đang cần đọc trong lúc thao tác. Ở `/tau` · `/tien` · `/nguoi` thì nền sau form **không mang thông tin nào đang cần**, nên che 69% không mất gì. Ép xuống 40% ở đây chỉ còn hai đường: giấu ô đang cần (phạm D2 — thao tác câm, án lệ `CrewForm` giấu ô SĐT rồi báo lỗi trỏ vào ô đang ẩn), hoặc chẻ form thành nhiều bước (thêm bước, đi ngược đúng thứ đợt này vừa cắt). **Luật C1 — chỉ bày cái KEY — vẫn áp cho MỌI form, không ngoại lệ**; chỉ con số 40% là bỏ ngoài màn bản đồ.

### Nút hành động — LUẬT VỊ TRÍ & KÍCH THƯỚC (2026-08-29; nới ra TOÀN APP 2026-08-29e)

> ⛔ THAY HÌNH KHỐI bởi §0b (2026-10-19): ngoài bản đồ `SQ_BTN` là NÚT CHỮ gọn (icon trái, cao `--h-ctl`), không còn ô vuông icon-trên-chữ 11px; ô vuông chỉ còn `SQ_TILE` trên bản đồ. Luật 3b "hàng không nút vẫn chừa ô `w-16`" BỎ ngoài bản đồ — chừa ô trống là "ô đệm" Codex chỉ ra. Các luật VỊ TRÍ còn lại (nút inline cuối hàng nó thao tác, không nút ăn riêng một hàng) giữ.

Chủ dự án: *"cái nút nó là ô vuông kích thước đồng bộ"* · *"nó là 1 nút thì đừng để nó chiếm cả 1 hàng… 1 ô chiếm 1 hàng thì lại mất cân đối trong khi vẫn chiếm chỗ màn hình"* · *"có logic về tối ưu vị trí và hiển thị chưa?"*.

**0. PHẠM VI — CHỦ DỰ ÁN ĐÃ CHỐT 2026-08-29f.** Hai mục này ra đời trên màn bản đồ nhưng luật là luật CỦA APP: áp cho `/` · `/tau` · `/nguoi` · `/tien` như nhau. Các ca mẫu bản đồ bên dưới (route-planner, my-places-sheet, rail phải) giữ nguyên làm ví dụ.

**NGOẠI LỆ ĐÃ CHỐT — NÚT CHÍNH DUY NHẤT CỦA MÀN GIỮ FULL-WIDTH.** Hỏi: luật A2 (cấm nút hành động full-width) có phủ nút submit của form auth không. **Chốt: KHÔNG — giữ nguyên `PrimaryButton` full-width.** Gồm: Đăng nhập · Tạo tài khoản · Lưu mật khẩu mới · Gửi yêu cầu · CTA của [login-gate.tsx](../../src/components/login-gate.tsx) · [doi-mat-khau/page.tsx:105](../../src/app/doi-mat-khau/page.tsx:105) · [quen-mat-khau/page.tsx:97](../../src/app/quen-mat-khau/page.tsx:97).

*Vì sao ngoại lệ này không phá luật:* A2 sinh ra để nút đừng **ăn chỗ của dữ liệu** và đừng **lẫn vào hàng danh sách**. Trên màn auth không có dữ liệu nào để giành chỗ, và nút là hành động **duy nhất** của cả màn — không có gì để lẫn. Thêm nữa Zalo · Grab · Facebook đều dựng nút này full-width; bà con bấm nó bằng phản xạ, bóp về ô vuông 64px là bắt học lại. **Ranh giới:** ngoại lệ chỉ cho nút chính DUY NHẤT của màn. Màn có từ hai hành động trở lên, hoặc nút nằm trong danh sách/thẻ/panel ⇒ về `SQ_BTN` như thường.

**1. MỘT KHUÔN DUY NHẤT.** Mọi nút hành động dùng chung hằng `SQ_BTN` (**`src/components/ui/sq-btn.ts`** — dời khỏi `route-planner.tsx` ngày 2026-08-29d, xem 5d): ô vuông `w-16` × `min-h-[3.25rem]`, `rounded-2xl`, icon `h-6 w-6` + nhãn `0.6875rem` xuống dòng. Đây **đúng khuôn nút rail phải** (Lớp · Vị trí · Đến điểm · Điểm đã lưu · Dẫn đường) — bà con đã quen hình đó ở ngay cạnh, không phải học kiểu nút thứ hai. Đo thật: nút trong thẻ 56×49px = nút rail 56×49px.

**Nhãn 0.6875rem (11px) dưới icon trong `SQ_BTN`** — là bậc "nhãn dưới icon ô vuông" của §0 (cùng bậc nhãn dock). **Ranh giới:** chỉ dùng cho nhãn dưới icon; chữ khác theo type-ramp.

**Nợ `0.6875rem` GIẢM (2026-09-03b)**: chữ phụ trong panel lớp `ra-khoi-controls.tsx` (dòng "tham khảo…", ghi chú nguồn) nay dùng bậc chữ phụ 0.8125–0.875rem của §0, không mượn bậc nhãn dưới icon.

**1b. KHU CHỢ VẬT TƯ — KHÔNG DÙNG `SQ_BTN` CHO HÀNH ĐỘNG CHÍNH / VIỆC THƯỜNG BẤM (chốt 2026-09-06, vòng FIX UX).**

> **ĐẢO MỘT VẾ 2026-10-19 (chủ dự án chốt sau kiểm ảnh dock 5 mục):** phần "chợ không được rơi xuống 37px" dưới đây KHÔNG còn — chế độ Gọn nay hạ CẢ nút chợ/tàu về `--row-h` (37px) cho khớp `.sq-btn`, vì cùng một màn hai cỡ nút (37 cạnh 56) trông lệch. `SELLER_BTN`/nút chữ của chợ vẫn là NÚT CHỮ (không về `SQ_BTN` icon+nhãn 11px) — vế đó giữ. Mặc định app vẫn là Gọn; ai thấy khó bấm thì chuyển "Nút to" (56px).

Mặc định giao diện của app là **"gọn"** ⇒ `--row-h` = **2.3125rem (37px)** và nhãn `.sq-btn` = **0.6875rem (11px)**. Trên bản đồ điều đó đã chốt là chấp nhận được (§"CHẾ ĐỘ HIỂN THỊ…", 2026-08-29h): nút ở đó là icon phụ, ít bấm, người dùng đổi sang "Nút to" được. **Khu chợ không nằm trong ngoại lệ đó.** Đo thật 390×844 ở chế độ mặc định, mọi nút của chợ rơi xuống 37px cao / chữ 11px: "+ Giỏ" 68×37 · "Bỏ" 55×37 · **"Huỷ" 37×37** · "Đổi" 58×37 · "Chép mã" 88×37 · "Sửa"/"Hết hàng" · "Thêm món" · "Lưu" · "Xoá món" · "Huỷ đơn". Đó là những việc bà con làm suốt buổi, một số có hậu quả tiền bạc (Huỷ đơn, Đặt hàng, Đã nhận hàng) — và mọi máy mới rơi vào 37px mà chưa chọn gì.

**Luật cho `/cho/**` · `/ban-hang/**`:**

| Loại nút ở khu chợ | Khuôn |
|---|---|
| Hành động **chính** của màn (Đặt hàng · Thêm vào giỏ · Xác nhận đơn · Lưu) và mọi việc **thường bấm** hoặc **có hậu quả** (Huỷ · Bỏ · Đã nhận hàng · Sửa · Xoá món · Chép mã) | **nút CHỮ — bậc nút chính 3.25rem (hành động chính) / bậc control 2.75rem (việc thường bấm), chữ 1rem** — hằng dùng chung `SELLER_BTN` / `SELLER_BTN_WIDE` (`components/market/seller/ui.tsx`); phía người mua dùng cùng khuôn tại chỗ |
| Icon phụ, ít bấm, có nhãn giải thích ngay cạnh | `SQ_BTN` như phần còn lại của app |

Vì sao đây **không phải phá luật `SQ_BTN`**: luật một-khuôn sinh ra để nút đừng lệch nhau và đừng ăn chỗ của dữ liệu. Ở chợ, hành động chính là NÚT CHỮ (bậc §0) để tên việc đọc được, còn nút icon phụ vẫn là ô vuông.

**Nút ♡ trên thẻ món trong lưới: vùng chạm `2.75rem` (bậc control §0), nền tròn nhỏ, đè góc ảnh — là nút duy nhất trên thẻ, cạnh nó không có nút nào khác.**

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

**4. Ô NHẬP PHẢI ≥16px THỰC TẾ — ngưỡng của hệ điều hành, không phải bậc type-ramp.** iOS Safari **tự phóng to cả trang** khi focus vào `<input>/<select>/<textarea>` có cỡ chữ dưới 16px. Gốc chữ từng là 14px (trước 2026-08-29) nên ô nhập rơi dưới ngưỡng ⇒ iOS tự phóng to cả trang; nay gốc ≥16px và `input,select,textarea{font-size:max(16px,1em)}` giữ cầu dao đó.

**5. Vùng chạm theo bậc §0, không co riêng cho một thẻ.** Rút là rút NHÃN và BỀ NGANG của chữ, không rút vùng chạm của ô.

**5b. HAI Ổ CHẠM DƯỚI SÀN (2026-08-29b) — một nâng đủ, một nâng NỬA VÌ ĐO RA MỚI BIẾT.**

(a) **Chip ngày trong sheet gió sóng** (`fishing-map-view.tsx`): bậc chip §0, cùng cỡ cả hàng.

(b) **Ba nút icon mỗi hàng điểm** trong panel "Điểm đã lưu" (`my-places-sheet.tsx`): ô vuông `.sq-btn`, ba ô cùng cỡ, đo vừa panel `w-[19rem]`.

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

1. **Nút X đóng = MỘT component duy nhất `CloseButton`** ([src/components/ui/close-button.tsx](../../src/components/ui/close-button.tsx)). Kiểu `hang` (đầu panel/ngăn): vùng chạm **3.5rem (56px)**, glyph `CloseIcon` **1.5rem** (`h-6 w-6`) — ĐÍNH CHÍNH 2026-10-22 theo code (doc cũ ghi 2.75rem/1.25rem). Kiểu `goc` (THẺ NỔI bản đồ, §6 mục 8): chấm 28px đè góc trên-phải, vùng chạm 44px — từ 2026-10-22 dùng cho cả 12 thẻ thông tin bản đồ; `rounded-full`, nền TRONG SUỐT lúc nghỉ + `active:bg-field` (không "boxy"), `-m-1` để không phình header. Góc **trên-phải**. **CẤM tự chế nút X, CẤM ký tự `✕`/`×` thô** (hook cảnh báo). Chỉ dùng cho panel ĐỌC-XEM / auto-apply (đóng không mất dữ liệu). Áp: `ra-khoi-controls` PanelHeader, `fishing-map-view` thông tin chặng.

2. **KHÔNG bao giờ để cả X lẫn Huỷ trên cùng màn** (điểm gây rối nhất). Chọn MỘT mô hình: panel đọc-xem/auto-apply → chỉ **X + vuốt/chạm-ngoài** (không Huỷ, không Lưu); form có dữ liệu nhập → **cặp Huỷ/Lưu ở đáy, BỎ X**.

3. **Cặp Huỷ/Lưu (chủ dự án chốt 2026-08-29g: NẰM NGANG, Lưu bên phải)** — `grid grid-cols-2`, Huỷ (secondary, `bg-field`) trái · Lưu/Xác nhận (primary, `bg-sea`/danger `bg-danger`) phải, mỗi nút `min-h-[3.5rem]` `rounded-2xl`. Đây đúng khuôn `ConfirmDialog` dùng chung ([ui/confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx)) — mọi xác nhận phá huỷ đi qua nó. Nút Huỷ trong ô `SQ_BTN` (khuôn ô-vuông đã chốt) giữ icon 24px như mọi nút vuông khác — nhất quán trong khuôn vuông, KHÔNG phải nút X-đóng.

4. **Sheet: vuốt-xuống-đóng + chạm-ngoài-đóng** — `BottomSheet` chung có grabber + scrim-đóng + Esc. **2026-10-22 (rà bố cục) — `BottomSheet` prop `kieu`:** `xem` (mặc định) = × `hang` góc trên-phải + vuốt + chạm nền; `form` = ngăn có nút chốt ở đáy (Huỷ/Lưu, Đặt hàng, Xong…) ⇒ KHÔNG ×; đã gõ chữ (bắt sự kiện `input` trong ngăn) mà vuốt/chạm nền/Esc thì hỏi "Bỏ phần đang ghi?" (ConfirmDialog, "Ghi tiếp" | "Bỏ"). Vuốt bắt trên tay nắm + hàng tiêu đề (thân còn cuộn): kéo ≥80px hoặc hất >0,11 px/ms là đóng (`lib/dialog-focus.ts` `vuotDeDong`). 21 ngăn mang `kieu="form"`; các nút "Đóng"/"Xong" chỉ-để-đóng ở đáy ngăn xem ĐÃ BỎ (tide-card, pretrip, giỏ trống, vms "chưa gia hạn", biểu đồ giá, chọn loài). ConfirmDialog: `max-h-[85dvh]` cuộn trong, bẫy focus + khoá cuộn nền dùng chung với BottomSheet (`lib/dialog-focus.ts`). Sheet đọc-xem cho vuốt/chạm-ngoài thoải mái. Form có dữ liệu chưa lưu → nếu cho vuốt phải hỏi "Bỏ thay đổi?" (nguyên tắc 4 CLAUDE.md: chống mất dữ liệu bà con).

5. **Cỡ nút**: theo bậc §0 — X đóng/icon-only = control 2.75rem · nút chính/Huỷ/phá huỷ = 3.25rem · khoảng cách 2 control kề **≥8px**. `// nợ:` còn 2 nút thu-gọn dưới sàn (storm-banner `h-9`=36px, nav-mode `h-11`=44px — là nút Chevron thu gọn, không phải X; nâng khi rà HUD vòng sau).

6. **Cấp bậc nút** (màu qua token `@theme`, cấm hex): Primary = filled `--navy`/`--sea` chữ trắng (Lưu/Xong/Gọi) · Secondary = `bg-field` viền nhẹ (hành động phụ) · Text = chữ `--muted` không nền (Huỷ/Bỏ qua) · Destructive = `bg-danger` **luôn kèm ConfirmDialog** (Xoá/gỡ không đảo được).

7. **Thao tác thông minh (tự-hiểu, chống rối)**: toggle/bộ lọc/chọn lớp **auto-apply ngay** (không nút Lưu) · **không hỏi xác nhận cho hành động ĐẢO ĐƯỢC** (bật/tắt lớp, đổi cảng) — chỉ hỏi cho phá huỷ · form autofill từ `forfish.*`. Xem thêm luật dữ liệu-KHÔNG-CẮT (§6 mục toạ độ) + [07-design-spec](07-design-spec.md).

8. **THẺ NỔI — LUẬT CHUNG CHO MỌI KHUNG/THẺ (chủ dự án chốt 2026-10-17, sau khi chê thẻ Sen Biển 5 lượt: *"× ở dưới… box lớn, thông tin không có gì, tốn diện tích"*, *"icon quá quen thuộc thì đừng có text"*, *"tính cân đối ở đâu"*, *"làm cái ô nhỏ lại, đừng có ghi nói cái gì hết"*, *"nút × là cái nhỏ ở góc trên phải sát góc, bé xíu"* — và dặn: *"trong toàn bộ design đừng bao giờ làm một cái thiết kế như thế"*)**. Áp cho MỌI thẻ/khung/panel mới, không riêng Sen Biển:
   - **× = chấm nhỏ ĐÈ góc trên-phải** của thẻ nổi (`<CloseButton variant="goc">`: chấm 28px, vùng chạm 44px). CẤM × nằm ngang hàng nút, CẤM × ở đáy, CẤM × to chiếm một ô ngang bằng nút hành động. Panel có hàng tiêu đề thì dùng `CloseButton` mặc định (glyph 24px trong suốt, góc phải hàng tiêu đề).
   - **Icon quen thuộc KHÔNG kèm chữ** (micro, bàn phím, gửi, đóng, tìm, vị trí, phóng/thu…). Tên đưa vào `aria-label`. CẤM nút chữ dài kiểu "Chạm rồi nói", "Gõ thay vì nói", "Nói bằng giọng" — chữ làm nút phình ra và phá bố cục. Nút chữ chỉ cho hành động không có icon quen, MỘT–HAI chữ (Đi, Thôi, Lưu).
   - **Không câu nhắc / hướng dẫn chiếm chỗ** ("Nói tên cảng, điểm ghim…", "Chạm để…"). Chữ trong thẻ chỉ khi mang THÔNG TIN THẬT (kết quả, số, cảnh báo, câu trả lời). Gợi ý nhập thì để `placeholder` của ô nhập.
   - **Thẻ rộng VỪA KHÍT nội dung** (`w-max` + `max-w`), không kéo full-width khi chỉ có vài icon. Không hàng điều khiển thừa ở đáy; không khoảng trắng chết.
   - **Cân đối**: hàng icon canh giữa dọc; nếu hàng nút phải phủ bề ngang thì chia cột BẰNG NHAU (`grid-cols-N`), không dồn nút một bên để trống bên kia.
   - **Không cắt chữ thông tin bằng "…"** — rút gọn câu hoặc cho xuống dòng.
   - Icon gọn: glyph 20px trong ô màu 44px, vùng chạm vẫn 56px (component `IconNut` trong `sen-bien-sheet.tsx` là mẫu).
   - **Thẻ TỰ THU VỀ thì KHÔNG cần ×** (Sen Biển 2026-10-17: "bỏ luôn dấu X, không nói thì 5s tự thu về") — thẻ ngắn hạn đóng theo trạng thái (hết nói / rảnh), × chỉ cho khung bà con chủ động đọc lâu.
   - **Nhập bằng giọng theo khuôn Claude/ChatGPT**: tách GỌI (hội thoại giọng, icon nhân vật là nút ghi, vòng lan + sóng âm khi nghe) với micro ĐỌC-RA-CHỮ trong thanh chat (ô hiện "Đang nghe…" + sóng âm + nút dừng ■, chữ điền vào ô, không tự gửi; mũi tên gửi chỉ hiện khi có chữ). Không trộn hai kiểu trong một nút. **Nhân vật trợ lý (icon nổi) đứng CỐ ĐỊNH, kéo đi được, và LÀ nút gọi** — hội thoại hiện trong bong bóng kính (liquid: nền mờ xuyên thấu + blur, viền/vệt sáng, đuôi chỉ về icon, trồi lên như giọt nước) bám theo icon; KHÔNG kéo icon vào trong khung. **Ô nhập chat TỰ PHÌNH theo chữ** (textarea, trần ~4 dòng rồi cuộn) và thanh đủ rộng để đọc trọn câu — không bao giờ ô một dòng hẹp cắt chữ.

**Nguồn khảo sát**: Material 3 Dialogs (48dp/24dp) · Apple HIG Sheets (Cancel trái/Done phải, 44pt, `interactiveDismissDisabled` khi có thay đổi) · Shopify Polaris Modal (X/Cancel/Esc/chạm-ngoài, primary phải) · IBM Carbon Modal (Cancel ngoài-trái, primary ngoài-phải, X đóng không gửi) · WCAG 2.5.5 (44px AAA) / 2.5.8 (24px AA).

### Trợ lý trong app — LUẬT CHUNG cho mọi trợ lý nổi (2026-09-07, chủ dự án chốt sau khảo sát)

> Chủ dự án 2026-09-07: *"sao lại xổ ra 1 cái che hết toàn bộ app thế — ghi rõ vào cái quy định đi, đừng có làm các kiểu design không có tư duy, không giống ai"*.
> Mục này là **quy định**, không phải mô tả bản đang chạy. Ai làm khác phải sửa mục này trước, kèm lý do.

**Khảo sát đã làm (2026-09-07)** — nguồn kiểm chứng được, KHÔNG suy đoán:

| Nguồn | Câu chốt lấy được |
|---|---|
| [Intercom Messenger trên app di động](https://www.intercom.com/help/en/articles/6705301-use-the-messenger-in-your-mobile-app) | Messenger mở **dạng bottom sheet gốc**, để người dùng "see exactly where they are in your app" |
| [Material 3 · Bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines) | Sheet dạng chặn (modal) **mở đầu không quá 50% chiều cao**; đổi nấc và đóng được **bằng nút, không bắt buộc kéo**; *"Don't omit a close affordance in full-screen modal bottom sheets"* |
| [Apple HIG · Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | Sheet "allows some of the parent view to remain visible, **helping people retain their original context**"; **toàn màn chỉ dành cho** "complex or prolonged user flows", ảnh/video/máy ảnh, việc nhiều bước |
| [WCAG 2.2.2 Pause, Stop, Hide (mức A)](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html) | Chuyển động **tự chạy quá 5 giây** song song với nội dung khác thì phải dừng/ẩn được ⇒ **nhịp thở vô hạn là vi phạm** |
| [Material 3 · FAB](https://m3.material.io/components/floating-action-button/guidelines) | Góc **dưới-phải** là chỗ dễ với nhất trên màn hẹp; **không bao giờ hai nút nổi cùng một màn** |
| [Material 3 · Chips](https://m3.material.io/components/chips/guidelines) · [NN/g #4](https://www.nngroup.com/articles/ai-chatbots-design-guidelines/) | Gợi ý phải là **nút bấm, không phải chữ**; nhãn ngắn; luôn đi theo nhóm |
| [Amazon Rufus](https://www.aboutamazon.com/news/retail/how-to-use-amazon-rufus) | Câu hỏi gợi ý **khác nhau theo từng trang**; ở trang sản phẩm thì hỏi về chính sản phẩm đó |
| [Apple · AssistiveTouch](https://support.apple.com/guide/iphone/use-assistivetouch-iph96b21954/ios) | Nút nổi của hệ điều hành có **độ mờ lúc rảnh** (hạ tới 15%) |

**Không tìm được nguồn** mô tả chi tiết giao diện trợ lý của Shopee, MB Bank, Vietcombank, Techcombank, VPBank, TPBank, Zalo, Grab — báo chí tiếng Việt chỉ nói "chatbot 24/7", không tả một chi tiết màn nào. Nên **đừng viện dẫn các app đó** làm lý do cho một quyết định thiết kế; dùng bảng trên.

#### Luật bắt buộc

| # | Luật | Vì sao |
|---|---|---|
| 1 | **CẤM `fixed inset-0`** cho trợ lý. Hỏi–đáp là việc ngắn, không phải "luồng nhiều bước" — Apple HIG dành toàn màn cho ảnh/video/việc dài. Che hết app là bà con **mất dấu mình đang đứng ở đâu** | Apple HIG Sheets · Intercom |
| 2 | **Hai nấc, mặc định là nấc thấp**: nấc 1 = **55%** chiều cao khả dụng (M3 nói ≤50%; SDFish nới lên 55% cho đủ 2 hàng nội dung), nấc 2 = **92%**, KHÔNG 100% — chừa một dải thấy màn phía sau | M3 · HIG |
| 3 | **Ba đường đóng**: nút ✕ luôn hiện ở hàng tiêu đề · vuốt xuống · chạm nền mờ. Đổi nấc phải làm được **bằng chạm tay nắm**, không bắt buộc kéo | M3 "cycle through preset heights without dragging" |
| 4 | **Nền mờ nhìn xuyên** (đen ~32%), KHÔNG nền đục | HIG: giữ ngữ cảnh |
| 5 | Tự lên nấc 2 **chỉ khi bàn phím mở**. Không tự nhảy vì lý do nào khác | tránh giật màn |
| 5b | **(PHẠM VI: chỉ tấm trợ lý — chốt 2026-10-22: `BottomSheet`/`ConfirmDialog` modal của app PHỦ dock như Material modal bottom sheet và iOS sheet, nền mờ che cả dock; anh Long: "xử lý theo các app hiện đại nhất, đông user nhất")** **KHÔNG che thanh điều hướng đáy** (chủ dự án 2026-09-07: *"cái dialog hiện ra không nên che cái bottom menu"*). Cả sheet LẪN nền mờ dừng ở `bottom: var(--dock-total)`; dock vẫn **chạm được** để đổi tab mà không phải đóng trợ lý trước | bà con phải luôn thấy mình đang đứng ở tab nào; bắt đóng trợ lý rồi mới đổi tab là một bước thừa |
| 6 | **Tay nắm** mép trên, vùng chạm bậc control §0 | 03 §Nút hành động 5 |
| 7 | Nút nổi **có mặt ở mọi màn app ngư dân**, không biến mất khi đổi tab. M3 nói FAB nên biến mất khi đổi tab, nhưng đó là nút *hành động chính của màn*; trợ lý là **đường tắt xuyên suốt** — NN/g: *"A chatbot that disappears between pages is one that users will stop trying to use"* | NN/g |
| 8 | **Một nút nổi một màn.** Màn nào đã có nút nổi khác (giỏ hàng ở Cửa hàng) thì hai nút **xếp chồng dọc cách 0.75rem**, không đặt cạnh nhau, không đè | M3 FAB |
| 9 | **Gợi ý là NÚT BẤM theo màn đang đứng**, 3–4 cái, mỗi nút bậc control §0, nhãn ≤2 chữ (§Nhãn). Nội dung phải bám **mục tiêu của chính tab đó** — xem bảng §Gợi ý theo tab dưới | M3 Chips · NN/g #4 · Rufus |
| 10 | Mở sheet ở màn nào thì **dòng đầu nói rõ đang xem gì** ("Đang xem Ra khơi — cảng Quy Nhơn") | Rufus |

#### Hiệu ứng gây chú ý — chọn MỘT, không chồng

| # | Luật | Trần |
|---|---|---|
| 11 | **Nhịp thở khi mở app**: 3 nhịp rồi **dừng hẳn**, tổng **≤5 giây**; tắt hoàn toàn dưới `prefers-reduced-motion: reduce` | WCAG 2.2.2 mức A — quá 5 giây mà không dừng được là **vi phạm**, không phải lựa chọn thẩm mỹ |
| 12 | **Bong bóng chào một dòng** theo màn: bung sau 2 giây, tự thu sau 6 giây hoặc khi bà con cuộn/chạm chỗ khác; có ✕. Tối đa **1 lần/ngày/trục**; **3 ngày liền không ai bấm → thôi hẳn** | Drift welcome message; đừng phiền người đang làm việc |
| 13 | **Chấm báo** chỉ khi có việc THẬT chưa xem; chấm không số, dùng token màu, **tắt ngay khi mở sheet** | M3 Badges |
| 14 | **CẤM**: nhấp nháy vô hạn · rung · đổi màu liên tục · âm thanh · nút tự chạy quanh màn | WCAG + ngư dân đang lái tàu |

#### Gợi ý theo tab — bám mục tiêu của trục, không trộn lẫn

Chủ dự án 2026-09-07: *"click vào bot ở từng màn hình nó phải khác nhau tương ứng với mục tiêu của từng cái tab"*. Luật: **hai gợi ý đầu LUÔN thuộc trục của tab đang đứng**; gợi ý theo giờ và theo việc chỉ được chen vào **ô thứ 3–4**, và **không bao giờ đẩy gợi ý của trục ra ngoài**.

| Tab | Trục | Hai gợi ý đầu phải thuộc nhóm |
|---|---|---|
| Trang chủ | tổng hợp | việc gấp nhất trong máy (giấy sắp hết · bão · đơn đang giao) |
| Ra khơi | 1 — đánh bắt | đi được không · sóng gió · bão · dầu/tuyến |
| Tàu cá | 3 + 4 — vận hành, giấy tờ | giấy tờ · bảo dưỡng · mua đồ cho tàu · đơn |
| Bạn thuyền | 4 — thuyền viên | số người · bảo hiểm · giấy của thuyền viên |
| Giao dịch | 2 — bán được đắt | giá cá · giá dầu · chỗ bán |

Sai đã đo thật 2026-09-07: đứng ở **Tàu cá → Sản phẩm** mà gợi ý ra "Ngày mai sao" + "Tin bão" (chuyện thời tiết) vì chip theo giờ và theo việc chiếm chỗ. Đó là lỗi trộn trục, không phải chuyện thẩm mỹ.

---

### Nút nổi TRỢ LÝ + tấm che toàn màn (2026-09-06, [13 §5.1/§5.2](13-ba-spec-tro-ly-giong-noi.md))

Hai khuôn mới, chỉ dùng cho Trợ lý giọng nói — đừng chép sang chỗ khác mà không đọc lý do.

> ⚠️ **ĐÍNH CHÍNH 2026-10-22 (rà bố cục) — bảng dưới mô tả bản CŨ.** `assistant-fab.tsx` / `assistant-sheet.tsx` KHÔNG còn. Bản hiện hành: icon + bong bóng Sen Biển `components/sen-bien-sheet.tsx`, khung toàn app `components/sen-bien-toan-app.tsx` (`fixed` z-[25], cột 480px, đáy `--dock-total`, mặc định mép phải cách dock 96px — `lib/sen-bien/vi-tri.ts`; bản đồ: mép trái, cách đáy 184px). Luật ẩn THẬT trong code: ẩn khi đang gõ (input/textarea/select có focus); trên bản đồ ẩn khi bong bóng mở / bảng lộ trình mở / ngăn gió sóng nấc `half`. KHÔNG còn tự ẩn theo `[aria-modal]` hay thanh đáy chợ — ngăn/hộp phủ lên (nền mờ z-30/40 > z-25). Bong bóng: không ×, đóng bằng chạm icon / chạm ngoài / **Escape** (`lib/use-escape.ts`, 2026-10-22) / tự thu 5–15 s; `max-h-[70dvh]` cuộn trong, bo 1rem (trước 1.5rem, không giới hạn cao, kính mờ).

| Khuôn | Chốt | Vì sao |
|---|---|---|
| **Nút nổi "Sen Biển"** (`assistant-fab.tsx` trên khuôn `ui/float-btn.tsx`, 2026-09-07) | vùng chạm tròn **3.5rem**, **trong suốt, không nền/viền**, mascot PNG đầy ô, hiệu ứng theo trạng thái (`sen-icon`, §Sen Biển) + nhãn "Sen Biển" dưới icon; mặc định cách mép **cột app** 1rem, `bottom: calc(var(--dock-total) + 0.75rem)`, `z-20`; **kéo được** (thả nép mép, giữ độ cao), **ẩn được** (đẩy sát mép → ló 1,25rem, mờ 70%, chạm hiện lại), nhớ `forfish.fab.v1` | Linh vật riêng như bot ngân hàng: **cá xanh** thân thiện, **nụ sen cam** hòa vào đỉnh đầu, hai vây bên mở như đang lắng nghe, **cụm sóng xanh** làm chân để khóa nghĩa “biển”. Asset `public/icons/sen-bien.png` có alpha thật, nổi trực tiếp trên màn hình, không huy hiệu trắng/robot/mic; bóng đổ chỉ bám silhouette. Vùng chạm theo bậc control §0. Nằm TRONG cột 480px; **khuôn `FloatBtn` dùng chung** cho nút giỏ nổi ở Cửa hàng |
| **Luật ẩn** (rẻ → đắt) | route cấm (danh sách tĩnh) → bàn phím mở (`visualViewport` co >150px) → panel khác (`[role=dialog][aria-modal]`) → thanh đáy dính của chợ → **sheet Ra khơi nở nấc `half`** (2026-09-06c: `section[role=region]` có `style.height` theo %) | Nút nổi che ô đang gõ hoặc che "Đặt hàng (n)" là hỏng việc chính của màn. ⚠️ Phép dò thanh dính bắt theo dấu vết `--dock-total`, mà chính nút nổi cũng mang dấu đó ⇒ **phải loại chính nó ra**, không thì nút tự thấy mình → ẩn → hiện → ẩn (đo thật 2026-09-06: ~10.000 lượt/giây, chạm không được) |
| **Tấm che** (`assistant-sheet.tsx`) | `fixed inset-0` trong cột 480px, `role="dialog" aria-modal`, tự bẫy focus + Esc + khoá cuộn nền; **không** dùng `BottomSheet`, **không** scrim | Cần trọn chiều cao cho vòng mic + câu trả lời; nền sau không có gì để nhìn. Đổi lại nó phải tự làm đủ ba việc a11y mà `BottomSheet` làm sẵn |
| **Sáu khối theo thứ tự** | 1 tiêu đề + Tắt/Bật tiếng (`SQ_BTN` 56px) + `CloseButton` · 2 vòng mic ≥6rem (nhịp `motion-safe:animate-ping`, tôn trọng "giảm chuyển động") + chữ nghe được hiện dần · 3 câu trả lời **≥1.25rem** `text-foreground` + dòng tuổi dữ liệu 0.9375rem · 4 thẻ hành động 0-hoặc-1 (cặp nút `grid-cols-2`, primary bên PHẢI, mỗi nút `min-h-[3.5rem]`) · 5 chip gợi ý 3–4 (`min-h-[3.5rem]`) · 6 hàng đáy "Gõ thay vì nói" / ô gõ | "Chỉ bày cái KEY" (§Khung nhập C1). Chữ trả lời là kênh CHÍNH (nhiều máy Android không có giọng Việt), nên nó to hơn mọi chữ khác trên tấm che |
| **Đọc lại** | nút chữ "Nghe lại" dưới câu trả lời, ẩn khi đã tắt tiếng hoặc máy không có giọng Việt | iOS chỉ phát tiếng trong một cử chỉ chạm THẬT; câu trả lời tới sau cử chỉ mở tấm che thì máy im — nút này là cử chỉ mới |
| **Nâng tránh chỗ chạm** (2026-09-06c) | ở `/ngu-truong` đo dải chip ngày rồi nâng nút bằng `marginBottom` (KHÔNG `transform` — lớp `active:scale` đã chiếm thuộc tính đó) | Chip ngày là ô chạm nhiều thứ hai của màn; nâng theo SỐ ĐO thật thì dải đổi chỗ theo nấc sheet vẫn không bị che |
| **Chữ phụ trên tấm che** (2026-09-06c) | các dòng dặn ("Bật mic trong cài đặt máy…", "Máy này chưa nói được với tôi…", dòng cách xác nhận) và nhãn chip theo bậc nội dung 1rem của §0; "Nghe lại" 1rem | Chữ đọc theo bậc nội dung, nhãn theo bậc nhãn |
| **Đồng hồ** | "Đang nghĩ…" chỉ hiện sau **300 ms**, đổi sang "Hơi lâu, bác chờ chút…" ở **8 s** (cạnh nó là nút "Thôi đợi" — bỏ câu đang hỏi, không đóng tấm che); trạng thái xong không ai chạm **20 s** → tự đóng | Tầng máy trả lời trong nửa giây — nháy một dòng chữ rồi mất còn khó chịu hơn không có. Tự đóng để trả màn về việc bà con đang làm dở |

## 7. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-09-06

<!-- re-verified: 2026-09-06b — VÒNG FIX UX CHỢ VẬT TƯ, ba luật vào design system (doc đi cùng commit code):
  §Nút hành động 1b MỚI — khu chợ KHÔNG dùng `SQ_BTN` cho hành động chính / việc thường bấm. Gốc là số ĐO chứ không phải ý thích: mặc định app là "gọn" (`layout.tsx` đặt `data-mode=gon` khi chưa có khoá) ⇒ `--row-h` 2.3125rem và nhãn `.sq-btn` 0.6875rem, nên mọi máy MỚI rơi vào 37px/11px mà người dùng chưa chọn gì; đo 390×844 ra "Huỷ" 37×37, "Bỏ" 55×37, "Chép mã" 88×37… Hằng dùng chung là `SELLER_BTN`/`SELLER_BTN_WIDE` ở `src/components/market/seller/ui.tsx` (tên mang tiền tố seller vì sinh ra ở đó; phía người mua dùng cùng chuỗi tại chỗ — GỘP TÊN là việc vòng sau, KHÔNG nhân bản chuỗi thứ hai). Ngoại lệ ♡ overlay đối chiếu mã (2026-10-19): `shared/product-card.tsx` vùng chạm `h-14 w-14` (3.5rem) nhưng phần vẽ chỉ nền tròn `h-9 w-9` (2.25rem) đè lên ảnh, `onFav` là nút riêng ngoài `<a>` — ghi ranh giới rõ để không ai mượn con số này cho nút khác.
  §Đặt hàng — thêm luật chip chợ = `ChipRow` level 1 (`shared/category-chips.tsx` + hàng sắp xếp ở `market-search.tsx`); nhân đó SỬA số cũ ở §Phân cấp điều hướng (48px/42px) cho khớp 5d (3.5rem/3.25rem) — hai chỗ đang nói hai con số cho cùng một component.
  §Khung nhập — thêm luật `<select>` nền tảng cho danh sách >12 lựa chọn (tỉnh: `AddressForm` + `seller/shop-form.tsx` đều đã đổi từ 34 chip cuộn ngang sang `<select>` trên `COASTAL_PROVINCES`). ĐÃ ĐỐI CHIẾU với luật chip cũ: không mâu thuẫn — `ChipRow` là để ĐIỀU HƯỚNG, đây là GIÁ TRỊ NHẬP; ghi rõ ranh giới ≤12 vẫn dùng chip để luật không bị đọc thành "đổi hết chip thành select".
  KHÔNG token màu mới; không đụng `globals.css`. Ma trận trạng thái + screen map: [07 §5a/§6/§7/§8]. -->
<!-- re-verified: 2026-09-06 — CHỢ VẬT TƯ: mục "Đặt hàng" thêm BA bộ chip của sàn (trạng thái đơn 6 giá trị · thanh toán 3 nấc · trạng thái gian hàng 4 giá trị). Đối chiếu mã: `src/lib/market/order-state.ts` (ORDER_STATUS_LABEL + ORDER_STATUS_CHIP, cặp màu bằng `var(--token)` — không hex, không rgba) và `src/components/market/shared/order-status-chip.tsx`; chip gian hàng ở `src/components/admin/market-admin-shared.tsx` (class token: warn-bg/ok-bg/danger-bg/field). KHÔNG token màu MỚI nào được thêm vào `globals.css` — sàn dùng đúng bộ trạng thái sẵn có. Vì sao tách khỏi bảng chip của Cửa hàng (`lib/catalog-orders.ts`, 5 trạng thái): sàn có thêm `hoan_thanh` và nghĩa của `da_giao` khác (chờ người mua xác nhận), gộp một bảng là nói dối một trong hai. Khu `/quan-tri` là web desktop-first nên chạm ở đó theo khuôn tab sẵn có (2.5–2.75rem), KHÔNG áp sàn 3.5rem của app ngư dân — luật tap 56px vẫn nguyên cho mọi màn bà con dùng. -->

**5c. Form "Thêm điểm"** (`my-places-sheet.tsx`): ô nhập và nút theo bậc control §0, cùng một cỡ trong form.

### Cỡ UI cửa hàng — 2026-09-08 (thay quy tắc thẻ lưới cũ)

- Icon thao tác thông thường 1.5rem, vùng chạm 3.5rem; icon mic 2rem trong nút 4rem. Nút lưu món bỏ ngoại lệ 2.75rem, dùng 3.5rem.
- Tên món và giá thẻ 1.125rem; thông tin shop/tỉnh/thống kê 0.875rem, độ đậm và tương phản tăng. Giá chi tiết size lg dùng text-2xl; tiêu đề trang và Sen Biển text-xl.
- Thẻ ảnh 4:3, không cắt ảnh hàng; màn dưới 360px một cột, ảnh 2:1. Hai cột còn lại chỉ cân chiều cao trong cùng hàng, không auto-rows-fr toàn danh sách.
- Thanh tìm không dùng icon trơ cho Giỏ/Đơn. Thanh đầu nền navy phẳng, không hero gradient. Nút người bán rounded-2xl, đồng bộ ô điều khiển sàn.
- Focus ring rõ, reduced-motion tắt hiệu ứng trong khu sàn. Token màu/font và quy tắc chế độ Gọn/Nút to giữ nguyên.
