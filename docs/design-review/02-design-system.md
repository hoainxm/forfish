# 02 — Rà soát Hệ thống thiết kế / Design system audit

> **Góc nhìn**: hợp nhất & nhất quán hệ thống thiết kế thị giác (visual design system) của ForFish.
> **Phạm vi**: READ-ONLY trên `src/`. Đây là tài liệu phân tích — không sửa code.
> **Ngày**: 2026-06-10 · **Nguồn chuẩn**: `docs/app-map/03-design-system.md` + `src/app/globals.css` (`@theme`).

---

## Tóm tắt 5 ý

1. **Token nền tảng tốt, nhưng tài liệu chuẩn lệch giá trị thật.** `globals.css` có đủ token màu (sand/navy/trim, t1–t4 + `-bg`, ok/warn/danger + `-bg`) và base 18px / font Archivo + Be Vietnam Pro đúng intent. Nhưng `docs/app-map/03-design-system.md` ghi sai một loạt hex so với code thật (t1 ghi `#2e6b8a` nhưng code là `#18648b`; trim ghi `#e4572e` đúng; t2/t3/t4/warn đều lệch). Vì doc tự nhận "không trích line number", nhưng bảng hex trong doc lại sai → cần đồng bộ.
2. **Các pattern atom RẤT nhất quán về tinh thần** (card trắng `rounded-xl ring-1 ring-line shadow-sm`, status banner màu + icon + chữ đậm, bottom-sheet `rounded-t-2xl`, nút cam `bg-trim`), nhưng **được copy-paste lặp lại ở từng feature** thay vì tách thành component dùng chung.
3. **Sao chép trùng lặp nghiêm trọng**: helper `formatVnDate` định nghĩa lại ở 6 file; component `Field` (label form) copy y hệt ở 3 file; `inputCls` (class input) copy ở 6 file với **2 biến thể không khớp** (`text-[17px]` vs `text-[19px]/[20px]`); khối "card + status banner + nút Sửa/Xóa + dialog xác nhận xóa + bottom-sheet" lặp gần như nguyên xi ở `document-vault`, `maintenance-reminders`, `trip-log`, `crew-list`.
4. **Drift cụ thể cần sửa**: bo góc ô tìm kiếm lệch (`price-board` dùng `rounded-xl`, `fines-lookup`/`sea-forecast` dùng `rounded-lg`); section-header (h2) có **4 cỡ khác nhau** (`text-[17px]`, `[20px]`, `[22px]`) và padding lệch (`px-1`/`px-4`/`px-5`); 2 chỗ hardcode màu né token (`price-board.tsx:92` `rgba(28,43,54,0.55)`; `fishing-map-view.tsx:284` `#e4572e` = trim).
5. **Thiếu các component dùng chung hiển nhiên**: `<Card>`, `<StatusBanner>`, `<PrimaryButton>` (nút cam), `<SecondaryButton>`, `<BottomSheet>`, `<Field>` + `<TextInput>`, `<ConfirmDialog>`, `<FilterChip>`, `<SectionHeader>`, `<RefDateBanner>` (banner "giá tham khảo ngày…"). Hiện chỉ có `PageHeader`, `BottomNav`, `icons` được tách dùng chung.

---

## 1. Token audit

### 1.1 Token đang tồn tại (`src/app/globals.css`)

| Nhóm | Token | Giá trị thật trong code |
|---|---|---|
| Nền/mực | `--background` | `#faf5ec` (sand) |
| | `--foreground` | `#1c2b36` (sea ink) |
| | `--card` | `#ffffff` |
| | `--line` | `#e7ddcc` |
| Thân/viền tàu | `--navy` | `#14324f` |
| | `--sea` | `#18648b` |
| | `--sun` | `#f2a01f` |
| | `--trim` | `#e4572e` |
| Trục | `--t1` / `--t1-bg` | `#18648b` / `#e3f0f7` |
| | `--t2` / `--t2-bg` | `#2e7d4f` / `#e4f3e9` |
| | `--t3` / `--t3-bg` | `#b07816` / `#fcf1d8` |
| | `--t4` / `--t4-bg` | `#7a4d9e` / `#f1eaf8` |
| Trạng thái | `--ok` / `--ok-bg` | `#1e7a45` / `#d9f0e2` |
| | `--warn` / `--warn-bg` | `#a36a00` / `#ffeec2` |
| | `--danger` / `--danger-bg` | `#c0392b` / `#fde0db` |
| Font | `--font-sans` / `--font-display` | Be Vietnam Pro / Archivo |

Tất cả map qua `@theme inline` (`globals.css:43–68`) → dùng được dạng class Tailwind (`bg-t1`, `text-ok`, `ring-line`…). Base 18px + `line-height 1.6` ở `body` (`globals.css:79–80`), heading gắn `--font-display` (`globals.css:84–90`). **Đây đúng với intent.**

### 1.2 Token bị doc ghi sai (intent vs reality) — cần sửa DOC, không sửa code

`docs/app-map/03-design-system.md` mục 2 ghi bảng hex theo trục **không khớp** `globals.css`:

| Trục | Doc ghi | Code thật | Lệch? |
|---|---|---|---|
| t1 steel blue | `#2e6b8a` | `#18648b` | ✗ |
| t2 green | "green" (không hex) | `#2f6b43`*¹ | — |
| t3 amber | "amber" (không hex) | `#b07816` | — |
| t4 purple | "purple" (không hex) | `#7a4d9e` | — |

*¹ Lưu ý prompt nói t2 `#2f6b43` nhưng code là `#2e7d4f` — doc và code cùng mơ hồ. **Chốt 1 nguồn sự thật = `globals.css`, cập nhật lại doc.**

### 1.3 Hardcode hex/màu né token (cần thay bằng token)

| File:line | Giá trị hardcode | Vấn đề | Đề xuất |
|---|---|---|---|
| `src/components/price-board.tsx:92` | `rgba(28,43,54,0.55)` | Đây chính là `--foreground` ở 55% opacity, viết tay → né token | Dùng `text-foreground/55` (class Tailwind) như mọi nơi khác |
| `src/components/fishing-map-view.tsx:284` | `#e4572e` | = `--trim`. Nằm trong MapLibre `paint` (line màu ranh giới) | **Ranh giới mơ hồ**: theo ngoại lệ doc mục 5, màu vẽ lên bản đồ được phép hardcode tại `src/lib/ocean-map.ts` kèm comment. Màu này lại đặt inline trong component → nên chuyển sang hằng có tên trong `ocean-map.ts` (giống `ROUTE_LINE_COLOR`) cho nhất quán |
| `src/components/fishing-map-view.tsx:275` | `#ffffff` | casing trắng cho line ranh giới (MapLibre paint) | Như trên — gom về `ocean-map.ts` |
| `src/components/fishing-map-view.tsx:303,331,343,347` | `rgba(255,255,255,.9)`, `bg-white/90`, `rgba(0,0,0,0.45)` | Halo/nền marker đè ảnh vệ tinh | **Chấp nhận được** — là chrome đè lên ảnh, cần trắng/đen tuyệt đối để đọc trên mọi lớp ảnh; không phải màu thương hiệu |

**Điểm tốt**: tuyệt đại đa số component dùng token đúng. Pattern phổ biến `style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}` (dùng CSS var trực tiếp vì màu chọn động theo trạng thái) xuất hiện nhất quán ở `document-vault.tsx:118-127`, `maintenance-reminders.tsx:208-213`, `crew-list.tsx:68-72`, `sea-forecast.tsx:23-27`, `fishing-map-view.tsx:93-97`. Đây là cách đúng cho màu động.

### 1.4 Không nhất quán radius / spacing / font-size (cite file:line)

**Bo góc (radius)** — intent: thẻ/nút `rounded-xl`, phần tử nhỏ `rounded-lg`/`md`, không pill.

| Atom | File:line | Radius dùng |
|---|---|---|
| Ô tìm kiếm (price) | `price-board.tsx:63` | `rounded-xl` |
| Ô tìm kiếm (fines) | `fines-lookup.tsx:77` | `rounded-lg` |
| Ô chọn cảng (sea) | `sea-forecast.tsx:75` | `rounded-lg` |
| Input trong form (mọi `inputCls`) | `document-vault.tsx:277` v.v. | `rounded-lg` |
| Input trong route-planner | `route-planner.tsx:259,283` | `rounded-xl` |
| → **Drift**: cùng là "ô nhập 1 dòng" nhưng lúc `rounded-lg` lúc `rounded-xl`. |

Bottom-sheet dùng `rounded-t-2xl` (`document-vault.tsx:287`, `maintenance-reminders.tsx:401`, `trip-log.tsx:349`, `crew-list.tsx:387,546`) — nhất quán với nhau nhưng `2xl` (16px) > intent "rounded-xl 12px cho khối nội dung". **Chấp nhận** vì sheet không phải card nội dung, nhưng nên ghi rõ trong spec.

**Section header (h2) — lệch cỡ & padding rõ rệt:**

| File:line | Cỡ chữ | Padding |
|---|---|---|
| `van-hanh/page.tsx:18,25` | `text-[22px]` | `px-4` |
| `thuyen-vien/page.tsx:18` | `text-[20px]` | `px-5` |
| `fines-lookup.tsx:63` | `text-[22px]` | `px-4` (h2 nằm TRONG component) |
| `page.tsx:69,116` | `text-[17px]` | `px-1` |
| `sea-forecast.tsx:158`, `fishing-map-view.tsx:362` | `text-[17px]` | `px-1` |

→ 3 cỡ (`17/20/22`), 3 padding (`px-1/4/5`). Cùng vai trò "tiêu đề mục" nhưng không có spec.

**Tap target** — đa số đạt ≥56px (nút cam `min-h-[60px]`, nút điều hướng `min-h-[56px]`, bottom-nav `min-h-[64px]`). Nhưng một số dưới chuẩn 56px:
- Nút Sửa/Xóa trên card: `min-h-[52px]` (`document-vault.tsx:172,179`; `trip-log.tsx:220,227`; `crew-list.tsx:241,251,258`).
- Chip lọc / chip chu kỳ: `min-h-[44px]` (`supply-catalog.tsx:34`; `maintenance-reminders.tsx:459`; `crew-list.tsx:572`).
- Ô tìm kiếm/select: `min-h-[52px]` (`price-board.tsx:63`, `fines-lookup.tsx:77`, `sea-forecast.tsx:75`).

→ Intent ghi "tap target ≥56px". Hiện có 3 mức (44/52/56+). Cần chốt: hành động phụ/chip được phép 44–48px hay phải ≥56? Hiện đang ngầm chấp nhận nhưng **không có quy ước viết ra**.

---

## 2. Kiểm kê pattern atom (component inventory)

| Atom | Xuất hiện ở | Nhất quán? | Lệch ở đâu |
|---|---|---|---|
| **Card** (`rounded-xl bg-card shadow-sm ring-1 ring-line`) | document-vault:131, maintenance:217, trip-log:181, crew-list:188, price-board:83, supply:77, sea-forecast, fishing-map-view, route-planner:242 | ✅ Rất cao | Trip-summary card dùng `p-4` còn list-card dùng `overflow-hidden` + padding nội bộ — biến thể nhỏ |
| **Status banner** (dải màu đầu card: `flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold` + icon + nhãn, màu `var(--*-bg)/var(--*)`) | document-vault:134, maintenance:220, crew-list:190 | ✅ Cao (3 chỗ giống hệt) | storm-banner:45 dùng biến thể `border-l-4` + `rounded-xl` thay vì dải đầu thẻ; fines-lookup:110 dùng `borderLeft 4px` |
| **Primary button** (nút cam: `bg-trim text-white display font-bold rounded-xl/lg min-h-[60px] active:scale-[0.98]`) | document-vault:96 (rounded-**xl**), maintenance:188 (xl), trip-log:157 (xl), crew-list:163 (xl); NHƯNG nút submit trong form: document-vault:358, crew-list:512 dùng `rounded-**lg**` | ⚠️ | Nút "thêm" = `rounded-xl`, nút "Lưu lại" submit = `rounded-lg` — cùng là primary button nhưng khác radius |
| **Secondary button** (`border-2 border-line text-foreground/70 font-bold`) | document-vault:224,352; maintenance; trip-log:434; crew-list:506 | ✅ Cao | min-h lúc 56 lúc 60 |
| **Danger button** (`bg-danger text-white`) | mọi dialog xác nhận xóa | ✅ Cao | — |
| **Filter chip** (`min-h-[44px] rounded-lg font-bold`, active `bg-navy text-white`, off `bg-card ring-1 ring-line`) | supply-catalog:33-69, maintenance:459 (chip số), trip-split:65 (`%`), crew-list:572 | ⚠️ | active state lúc `bg-navy` (supply, maintenance, trip-split), lúc `border-2` (crew advance chips) — 2 kiểu off-state |
| **Stat tile** (ô số to + nhãn nhỏ) | crew-list:135-156 (grid-3), route-planner:326-354 (grid-3), trip-log:128-149 (summary), sea-forecast:108 (điểm to 72px), fishing-map-view:425 (điểm 44px) | ⚠️ | Cỡ số: `24px`/`20px`/`26px`/`44px`/`72px` tùy nơi; padding `py-3`/`p-3`/`p-4` khác nhau |
| **Bottom-sheet form** (`fixed inset-0 bg-black/50` + `rounded-t-2xl bg-background p-5 pb-8 max-h-[92dvh]` + tay nắm `h-1.5 w-12 rounded-full bg-line`) | document-vault:280, maintenance:393, trip-log:341, crew-list:379,535 | ✅ Rất cao (gần như copy y hệt) | AdvanceForm (crew-list:546) bỏ `max-h/overflow` + `overflow-y-auto` |
| **Confirm-delete dialog** (`fixed inset-0 ... items-center` + card `max-w-[400px] rounded-xl p-5 text-center` + TrashIcon + 2 nút) | document-vault:205, maintenance:297, trip-log:253, crew-list:292 | ✅ Rất cao (copy 4 lần) | — |
| **Field** (label form: `<label class="mb-3.5 block">` + `<span class="mb-1.5 block text-[16px] font-bold text-navy">`) | document-vault:368, maintenance:501, trip-log:450, crew-list:609 (4 bản copy); trip-split:35,48 inline; sea-forecast:67 inline; route-planner:252 inline (`text-[15px] text-foreground/75` — KHÁC) | ⚠️ | Định nghĩa 4 lần + inline 3 lần; route-planner dùng cỡ/màu label khác (`15px foreground/75` vs `16px navy`) |
| **TextInput** (`inputCls`: `w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[17px] focus:border-sea focus:outline-none`) | copy nguyên văn ở document-vault:277, maintenance:391, trip-log:334, crew-list:377; biến thể `text-[19px]/[20px] font-bold` ở trip-split:30, crew-list:560,583 | ⚠️ | 6 bản copy, 2 cỡ chữ; route-planner:259,283 dùng `rounded-xl bg-background ring-1` (KHÁC hẳn: nền + ring thay border) |
| **Ref-date banner** ("Giá tham khảo ngày…") | price-board:52 (`bg-warn-bg text-warn`), supply-catalog:38 (`var(--t3-bg)/var(--t3)`), fines-lookup:135 (`var(--t4-bg)/var(--t4)`), sea-forecast:203 (`bg-t1-bg text-t1`) | ⚠️ | Cùng vai trò "ghi chú nguồn/ngày" nhưng mỗi nơi một màu nền (warn vs trục) và radius (`rounded-lg` vs `rounded-xl`) |
| **List row** (dòng trong list dọc: `flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0`) | trip-split:105, sea-forecast:167, fishing-map-view:493, page.tsx:80 | ✅ Cao | py lúc `py-3` lúc `py-3.5` |
| **Section header** | xem §1.4 | ❌ | 3 cỡ, 3 padding |
| **Page header** (`PageHeader`) | mọi page qua component | ✅ Đã tách dùng chung | fines-lookup KHÔNG dùng — tự render `<h2>` riêng (fines-lookup:63) |
| **Empty state** (`rounded-xl border-2 border-dashed border-line bg-card ... text-center` + icon to + chữ) | document-vault:103, maintenance:195, trip-log:164, crew-list:170, price-board:68, fines-lookup:92 | ✅ Cao | py lúc `py-12` lúc `py-10` |

### Spec chuẩn đề xuất (1 spec / atom)

- **Card**: `rounded-xl bg-card shadow-sm ring-1 ring-line`. Có header màu → thêm `overflow-hidden`. Padding nội dung `px-4 py-3`.
- **StatusBanner**: dải đầu card `flex items-center gap-2 px-4 py-2.5 text-[16px] font-bold`, nền `var(--{level}-bg)`, chữ+icon `var(--{level})`. Prop `level: ok|warn|danger|neutral`, `icon`, `label`. (storm-banner kiểu `border-l-4` để riêng làm variant `emphasis="block"`.)
- **PrimaryButton**: `display rounded-xl bg-trim text-white font-bold min-h-[60px] active:scale-[0.98] shadow-sm`. **Thống nhất `rounded-xl` cả nút "thêm" lẫn "Lưu lại".**
- **SecondaryButton**: `rounded-xl border-2 border-line font-bold text-foreground/70 min-h-[60px]`.
- **FilterChip**: `min-h-[48px] rounded-lg px-4 text-[16px] font-bold`; active `bg-navy text-white`, off `bg-card text-foreground/70 ring-1 ring-line`. Một off-state duy nhất.
- **StatTile**: `rounded-xl bg-card py-3 text-center shadow-sm ring-1 ring-line`; số `display font-bold` — chốt thang cỡ: `text-[24px]` (thường), `text-[44px]` (điểm chính), bỏ các cỡ lẻ.
- **BottomSheet**: wrapper `fixed inset-0 z-30 flex items-end justify-center bg-black/50`; panel `max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-5 pb-8` + tay nắm. Đóng khi chạm nền, `stopPropagation` trên panel.
- **Field + TextInput**: `<Field label>` = `label.mb-3.5.block` + `span.mb-1.5.block.text-[16px].font-bold.text-navy`. Input mặc định `text-[17px]`, variant `emphasis` = `text-[20px] font-bold` cho ô tiền. **Một định nghĩa, import chung.**
- **ConfirmDialog**: props `title, body, confirmLabel, onConfirm, onCancel`. Card `max-w-[400px] rounded-xl bg-card p-5 text-center` + icon + 2 nút.
- **SectionHeader**: `display text-[20px] font-bold text-navy px-4 pb-2`. Một cỡ, một padding cho toàn app.
- **RefDateBanner**: `rounded-lg px-3 py-2 text-[14px] font-semibold`; màu theo trục của trang (prop `tone`). Gom logic "giá/thông tin tham khảo ngày X".

---

## 3. Gaps — component thiếu / đang copy-paste

**Đang copy-paste theo feature, NÊN tách dùng chung:**

1. `formatVnDate` — định nghĩa lại 6 lần: `document-vault.tsx:385`, `maintenance-reminders.tsx:518`, `trip-log.tsx:62`, `supply-catalog.tsx:22`, `price-board.tsx:36`, `crew-list.tsx:626`. → đưa vào `src/lib/format.ts`.
2. `Field` component — copy 4 lần (document-vault, maintenance, trip-log, crew-list) + inline 3 nơi. → `src/components/ui/field.tsx`.
3. `inputCls` — copy 6 lần, 2 biến thể. → component `<TextInput>` hoặc hằng `INPUT_CLS` chung.
4. **Confirm-delete dialog** — copy gần nguyên văn 4 lần. → `<ConfirmDialog>`.
5. **Bottom-sheet shell** — copy 5 lần. → `<BottomSheet>`.
6. **Card + StatusBanner + nút Sửa/Xóa** — bộ ba này lặp ở document-vault / maintenance / crew-list gần như giống hệt (status logic khác, khung giống). → `<RecordCard>` hoặc tối thiểu `<StatusBanner>` + `<CardActions>`.
7. **Stat tile / điểm số** — 5 chỗ tự dựng. → `<StatTile>`.
8. **Filter chip** — 4 chỗ. → `<FilterChip>`.
9. **Empty state** — 6 chỗ. → `<EmptyState icon label hint>`.
10. **Ref-date banner** — 4 chỗ. → `<RefNote tone>`.
11. **Số tiền VND** — `formatVnd`/`formatSignedVnd`/`formatShortVnd`/`toLocaleString("vi-VN")` rải rác (trip-log, crew-list, trip-split, supply, price). → gom `src/lib/money.ts`.

**Đã tách tốt (giữ nguyên)**: `PageHeader`, `BottomNav`, `icons.tsx` (29 icon stroke, đúng intent, không emoji). `icons.tsx` là điểm sáng — một nguồn icon duy nhất, đúng `strokeWidth 2.2`, `viewBox 0 0 24 24`.

---

## 4. Kế hoạch hợp nhất (ưu tiên)

> Mục tiêu: rút hàng trăm dòng trùng, chốt 1 spec/atom, đưa mọi màu về token. Không đổi giao diện thị giác — chỉ gom.

### P0 — Sửa nhanh, rủi ro thấp, ảnh hưởng lớn
1. **Đồng bộ doc với code**: cập nhật bảng hex trong `docs/app-map/03-design-system.md` mục 2 cho khớp `globals.css` (t1=`#18648b`, t2=`#2e7d4f`, t3=`#b07816`, t4=`#7a4d9e`, warn=`#a36a00`…). Chốt `globals.css` là nguồn sự thật duy nhất.
2. **Xóa 2 hardcode màu né token**: `price-board.tsx:92` → `text-foreground/55`; gom `#e4572e`/`#ffffff` ở `fishing-map-view.tsx:275,284` thành hằng có tên trong `src/lib/ocean-map.ts` (theo ngoại lệ đã định).
3. **Tách `formatVnDate` + helper tiền** vào `src/lib/format.ts` / `money.ts`, thay 6+ bản copy.

### P1 — Tách component dùng chung (gỡ copy-paste nặng nhất)
4. **`<BottomSheet>`** — gom 5 bản copy (shell + nền + tay nắm + max-h + stopPropagation).
5. **`<ConfirmDialog>`** — gom 4 bản copy.
6. **`<Field>` + `<TextInput>`** (chốt `text-[17px]` mặc định, variant `emphasis` cho ô tiền). Thay 6 `inputCls` + 4 `Field`.
7. **`<StatusBanner>`** (prop `level`+`icon`+`label`) — thay 3 dải đầu card + chuẩn hóa storm/fines thành variant.

### P2 — Chuẩn hóa atom còn lại
8. **`<PrimaryButton>` / `<SecondaryButton>`** — chốt `rounded-xl` cho cả nút "thêm" và nút submit "Lưu lại" (hiện submit là `rounded-lg`).
9. **`<SectionHeader>`** — một cỡ `text-[20px]`, một padding `px-4`. Sửa 4 cỡ/3 padding hiện tại; cho `fines-lookup` ngừng tự render h2, để page sở hữu section header (giống các trang khác).
10. **`<FilterChip>`** — một off-state (`bg-card ring-1 ring-line`), `min-h-[48px]`. Thống nhất supply/maintenance/trip-split/crew.
11. **`<StatTile>`**, **`<EmptyState>`**, **`<RefNote>`** — gom các bản lặp.

### P3 — Quy ước & token mới
12. **Chốt quy ước tap-target**: ghi rõ vào doc — hành động chính ≥56px; hành động phụ/chip cho phép 44–48px (hoặc nâng tất cả lên ≥56px nếu muốn tuyệt đối theo intent). Hiện đang ngầm định, cần viết ra.
13. **Cân nhắc thêm token alpha/elevation**: `text-foreground/40|55|60|70` và `ring-1 ring-line shadow-sm` xuất hiện khắp nơi — có thể đặt semantic token `--text-muted`, `--text-faint`, `--elevation-card` để giảm "magic opacity".
14. **Thống nhất radius ô nhập 1 dòng**: chốt `rounded-xl` cho ô tìm kiếm/select (fines + sea-forecast đang `rounded-lg`) để khớp price-board, HOẶC chốt `rounded-lg` cho mọi input — chọn một.

---

### Phụ lục — danh sách file đã đọc
`src/app/globals.css`, `src/components/{page-header,bottom-nav,icons,storm-banner,document-vault,maintenance-reminders,price-board,supply-catalog,trip-log,fines-lookup,crew-list,trip-split,sea-forecast,route-planner,fishing-map,fishing-map-view}.tsx`, `src/app/{page,giay-to/page,van-hanh/page,thuyen-vien/page}.tsx`, `docs/app-map/03-design-system.md`.
