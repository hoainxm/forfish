# ForFish — Rà soát CUỐI: Design System + Trợ năng (a11y)

> Phạm vi: kiểm tra **mức độ ÁP DỤNG** nền tảng redesign (`src/components/ui/*` + `src/lib/format.ts`)
> và **độ nhất quán** thị giác / a11y trên toàn bộ route. Chỉ đọc, không sửa `src/`.
> Đối chiếu audit trước: `docs/design-review/02-design-system.md`, `04-accessibility.md`.

---

## TL;DR — câu hỏi chính "đã gom xong chưa?"

**CHƯA.** Nền tảng dùng chung đã được dựng đầy đủ và chuẩn (BottomSheet có focus-trap,
ConfirmDialog `alertdialog`, primitives, Tabs, lib/format), nhưng **mới đúng MỘT màn hình
(`sell-guide.tsx`) thực sự thay máu sang dùng nó.** Các màn còn lại (giấy tờ, bạn thuyền,
bảo dưỡng, lãi/lỗ, chia tiền, giá cá, vật tư) vẫn **copy-paste y nguyên** modal / Field /
inputCls / formatVnDate cũ — tức là phần lớn lỗi a11y mà nền tảng SINH RA để vá **vẫn còn
nguyên** ở các màn đó.

Khu vực bản đồ (`fishing-map-view`, `layer-sheet`, `ui/snap-sheet`) là điểm sáng: dùng đúng
component dùng chung và khớp hệ thống.

**Ước lượng tỷ lệ áp dụng `ui/`: ~25–30%** (chi tiết ở §6).

---

## 1. Áp dụng component dùng chung — bảng đối chiếu từng màn

| Màn hình | BottomSheet | ConfirmDialog | Field/inputClass | formatVnDate / VND | Kết luận |
|---|---|---|---|---|---|
| `sell-guide.tsx` | ✅ import ui/ | ✅ import ui/ | ✅ import ui/ | (không dùng) | **ĐÃ GOM** |
| `layer-sheet.tsx` | ✅ import ui/ | — | — | — | **ĐÃ GOM** |
| `fishing-map-view.tsx` | ✅ ui/SnapSheet | — | (input cục bộ) | local `formatDateVN` | một phần |
| `document-vault.tsx` | ❌ tự dựng | ❌ tự dựng | ❌ Field + inputCls cục bộ | ❌ `formatVnDate` cục bộ | **chưa** |
| `crew-list.tsx` | ❌ tự dựng ×3 | ❌ tự dựng | ❌ Field + inputCls cục bộ | ❌ `formatVnDate` cục bộ; parseInt cục bộ | **chưa** |
| `maintenance-reminders.tsx` | ❌ tự dựng | ❌ tự dựng | ❌ Field + inputCls cục bộ | ❌ `formatVnDate` cục bộ | **chưa** |
| `trip-log.tsx` | ❌ tự dựng | ❌ tự dựng | ❌ Field + inputCls cục bộ | ❌ `formatVnd` + `formatVnDate` cục bộ | **chưa** |
| `trip-split.tsx` | (không có modal) | — | ❌ inputCls cục bộ, label tay | ❌ `parseVnd` cục bộ | **chưa** |
| `fines-lookup.tsx` | (không có modal) | — | input cục bộ | — | một phần |
| `price-board.tsx` | (không có modal) | — | input cục bộ | ❌ `formatVnDate` cục bộ | một phần |
| `supply-catalog.tsx` | (không có modal) | — | input cục bộ | ❌ `formatVnDate` cục bộ | một phần |

### 1a. Trùng lặp `formatVnDate` / tiền VND còn sót (file:line)

- `src/components/document-vault.tsx:385` — `function formatVnDate` (nên import `@/lib/format`)
- `src/components/maintenance-reminders.tsx:518` — `function formatVnDate`
- `src/components/price-board.tsx:36` — `function formatVnDate`
- `src/components/crew-list.tsx:626` — `function formatVnDate`
- `src/components/supply-catalog.tsx:22` — `function formatVnDate`
- `src/components/trip-log.tsx:62` — `function formatVnDate`
- `src/components/trip-log.tsx:53` — `function formatVnd` (trùng `lib/format formatVnd`)
- `src/components/trip-split.tsx:164` — `function parseVnd` (trùng `lib/format parseVnd`)
- `src/components/crew-list.tsx:533` — `parseInt(amount.replace(/\D/g,""))` inline (chính là `parseVnd`)

→ **6 bản `formatVnDate` + 3 bản parse/format tiền vẫn tồn tại**, đúng thứ `lib/format.ts`
sinh ra để xóa. Mục tiêu "một nguồn duy nhất" chưa đạt.

### 1b. Trùng lặp `Field` + `inputCls` cục bộ (file:line)

- `Field` định nghĩa lại: `document-vault.tsx:368`, `crew-list.tsx:609`, `maintenance-reminders.tsx:501`, `trip-log.tsx:450` (4 bản, lệch khỏi `ui/primitives Field`)
- `inputCls` chuỗi dán lại: `document-vault.tsx:276`, `crew-list.tsx:376`, `maintenance-reminders.tsx:390`, `trip-log.tsx:334`, `trip-split.tsx:29`, cộng input cục bộ ở `fishing-map-view.tsx:501`, `fines-lookup.tsx:77`, `sell-guide Factories:270`, `price-board`, `supply-catalog`.
  → `inputClass` của `ui/primitives` mới chỉ dùng ở `sell-guide`. `trip-split.tsx:30` còn **lệch chuẩn** (thêm `text-[19px] font-bold`) so với chuẩn 17px.

### 1c. Primitives gần như không ai dùng

`Card`, `SectionHeader`, `StatusBanner`, `EmptyState`, `PrimaryButton`, `RefNote` **chỉ được
import bởi `sell-guide.tsx`**. Đặc biệt:
- **`StatusBanner` (ui/status-banner.tsx): 0 nơi dùng** — băng trạng thái ở `fishing-map-view`, `document-vault`, `maintenance-reminders` vẫn tự dựng inline `style={{backgroundColor,color}}`.
- **`SectionHeader`: 0 nơi dùng** — xem §3 (tiêu đề mục mỗi nơi một cỡ).

---

## 2. A11y modal — màn KHÔNG dùng ui/ vẫn không truy cập được

Mọi modal tự dựng dưới đây **thiếu hết** focus-trap, Escape-để-đóng, khóa cuộn nền,
`role="dialog"/"alertdialog"`, `aria-modal`, `aria-labelledby`, trả focus về nút mở
(đúng những gì `ui/BottomSheet` + `ui/ConfirmDialog` đã giải quyết):

**Bottom-sheet form (chỉ là `<div>`/`<form>` trần):**
- `document-vault.tsx:281` (DocumentForm)
- `maintenance-reminders.tsx:395` (MaintenanceForm)
- `trip-log.tsx:343` (TripForm)
- `crew-list.tsx:381` (CrewForm)
- `crew-list.tsx:537` (AdvanceForm)

**Confirm dialog (xác nhận xóa, `<div>` trần):**
- `document-vault.tsx:207`
- `maintenance-reminders.tsx:299`
- `trip-log.tsx:255`
- `crew-list.tsx:294`

→ **9 modal vẫn không truy cập được** (5 sheet + 4 confirm). Người dùng bàn phím / trình
đọc màn hình: tiêu điểm rò ra nền, Esc không đóng, nền vẫn cuộn dưới sheet. Đây là
**Nghiêm trọng** — và đáng tiếc vì bản vá đã có sẵn, chỉ thiếu bước thay import.

---

## 3. Nhất quán thị giác trên toàn route

**Tốt / đồng nhất:**
- Thẻ card: hầu hết là `rounded-xl bg-card shadow-sm ring-1 ring-line` — khớp `ui/Card`.
- Bo góc: 12px (`rounded-xl`) cho card/nút chính, `rounded-lg` cho input — nhất quán.
- `PageHeader` (gradient + sóng cát) dùng chung cho mọi page; tab điều hướng cấp trang dùng `ui/Tabs` ở `/tau`, `/tien` — đồng nhất.
- Bản đồ (`snap-sheet`, `layer-sheet`, FAB có chữ) khớp hệ thống, dùng token, tap target lớn.

**Lệch chuẩn cần ghi nhận:**

1. **Tiêu đề mục mỗi nơi một cỡ** (lý do `SectionHeader` ra đời, nhưng chưa ai dùng):
   - `fines-lookup.tsx:63` → **22px**
   - tiêu đề sheet (bottom-sheet) → **21px** (chuẩn ui/BottomSheet, nhất quán)
   - confirm title → **20px** (chuẩn) ; `ui/SectionHeader` → **20px**
   - `sea-forecast.tsx:158` → **17px**
   → có ít nhất **3 cỡ tiêu đề khác nhau** (17 / 20 / 22) cho cùng vai trò "tiêu đề mục".

2. **Mẫu tab/chip phân mảnh — 3 kiểu cho cùng ý "chuyển mục":**
   - Cấp trang: `ui/Tabs` — segmented, nền navy đặc, `role=tab/aria-selected` (chuẩn).
   - `sell-guide.tsx:56` — chip cuộn ngang `aria-pressed`, active nền `bg-t2`.
   - `sell-guide.tsx:142` (chọn tỉnh) — chip active nền `bg-navy`.
   - `fishing-map-view.tsx:646` — chip ngày dạng cột.
   - bộ lọc của `supply-catalog` / `price-board` — chip lọc riêng.
   → màu active của chip không thống nhất (t2 vs navy), và không có một component chip dùng chung. Không sai a11y, nhưng là điểm "chưa khoá chuẩn".

3. **Nút phụ "Hủy" trong form**: mỗi sheet tự viết `min-h-[56px]`/`min-h-[60px]` + `border-2 border-line text-foreground/70` lặp lại — chưa có `SecondaryButton`. (Không chặn, nhưng là copy-paste.)

4. **Input cao không đồng nhất**: chỗ `py-3.5` (≈52px), chỗ `min-h-[52px]`, `trip-split` lại 19px chữ. Gom về `inputClass` sẽ thống nhất.

---

## 4. Rà a11y còn lại

**Tap target < 48px (Nghiêm trọng vừa — tay ướt/người lớn tuổi):**
- `fishing-map-view.tsx:390` & `:398` — FAB "Lớp" / "Tàu tôi": `w-16` + `py-2`, không có `min-h-[48px]`. Icon h-6 + chữ 12px + `py-2` ⇒ chiều cao thực ~44px, **dưới ngưỡng 48px** (và dưới mục tiêu 56px của hệ thống). Có chữ kèm icon (tốt), chỉ thiếu chiều cao.
- `sell-guide.tsx:60`, `:146` — chip `min-h-[44px]`: **dưới 48px**.
- `sell-guide.tsx:429`, `:454`, `:462` — nút "Gọi"/"Sửa"/"Xóa" dạng text trần (chỉ padding chữ), không đảm bảo 48px.
- `fines-lookup.tsx:77`, `sell-guide.tsx:270`, `fishing-map-view.tsx:501` — input `min-h-[52px]` (đạt) — ok.

**Nút chỉ-icon thiếu aria-label:** không tìm thấy nút icon-only thật sự thiếu nhãn — phần lớn icon đều kèm chữ hoặc `aria-hidden`. `layer-sheet` dùng `role=radio/switch` + nhãn chữ rõ ràng (tốt). Đây là điểm đã cải thiện so với audit 04.

**Trạng thái-bằng-màu-đơn-độc:** không phát hiện vi phạm mới — `StatusBanner`, `fines-lookup` (SEVERITY_STYLE), `sell-guide` (Check/Alert icon) đều kèm icon + chữ. Tốt.

**Chữ mờ tương phản thấp (`text-foreground/40–60`):** 41 chỗ ở 14 file. Đa số là metadata phụ (nhãn nguồn, "đ/vị", placeholder) ở cỡ 12–14px:
- Đáng lưu ý: `sell-guide.tsx:164,419` `text-foreground/45` cỡ **12px** uppercase (nhãn loại) — tương phản + cỡ đều ở mức rủi ro dưới nắng.
- `text-foreground/40` cho icon search (`fines-lookup:70`, `sell-guide:265`) — icon trang trí, chấp nhận được.
- Nền `--foreground` (#1c2b36) ở /50–/60 trên nền sand vẫn dưới 4.5:1 → **không nên dùng cho chữ mang nội dung**. Phần lớn là phụ trợ nên xếp **Thấp**, trừ nhãn 12px nói trên (**Trung bình**).

---

## 5. Token màu — còn hardcode không?

Hệ token (`globals.css`) đầy đủ, đã làm tối `--ok/--warn/--danger` đạt AA, đã bỏ
`maximumScale` (layout.tsx:29), thêm `:focus-visible` (globals.css:99). Tốt.

Màu hardcode còn sót — **chấp nhận được về mặt ngữ cảnh nhưng nên ghi chú:**
- `layout.tsx:26` `themeColor: "#14324f"` — đúng `--navy` (metadata không đọc được CSS var, buộc phải hardcode; nên thêm comment đồng bộ thủ công).
- `fishing-map-view.tsx:301` `#ffffff`, `:310` `#e4572e` — màu vẽ line trên canvas MapLibre (không nhận CSS var trong paint spec). `#e4572e` = `--trim`. Hợp lý nhưng **dễ lệch khi đổi token** — nên đọc từ `getComputedStyle` hoặc tập trung vào hằng số có chú thích.
- `fishing-map-view.tsx:667` `"#fff"` — chữ trên chip active, nội tuyến.

→ Không có hardcode "lạc loài" trong UI thường; các trường hợp còn lại đều ở ranh giới canvas/metadata.

---

## 6. Ước lượng tỷ lệ áp dụng `ui/` + `lib/format`

| Hạng mục | Đã dùng / Tổng nơi nên dùng | % |
|---|---|---|
| BottomSheet | 2 / 6 màn có sheet (sell, layer ✓; doc, maint, trip, crew ✗) | ~33% |
| ConfirmDialog | 1 / 5 (sell ✓; doc, maint, trip, crew ✗) | ~20% |
| Field / inputClass | 1 / ~8 | ~12% |
| Card | 1 / ~8 (đa số tự viết class y hệt nhưng không import) | ~12% |
| SectionHeader | 0 / nhiều | 0% |
| StatusBanner | 0 / ≥3 | 0% |
| PrimaryButton / EmptyState / RefNote | 1 / nhiều | thấp |
| Tabs (cấp trang) | 2 / 2 page lớn | 100% |
| lib/format (date/VND) | 1–2 / ~9 | ~15% |
| SnapSheet (map) | 1 / 1 | 100% |

**Ước lượng tổng có trọng số: ~25–30%.** Nền tảng đã 100% sẵn sàng; việc di trú mới chạy
được ~1/4 chặng đường (gần như chỉ `sell-guide` + khu bản đồ).

---

## 7. Danh sách "gom nốt" (consolidation punch list) — ưu tiên giảm dần

**P0 — a11y, làm ngay (mỗi việc ~thay 1 cụm import):**
1. `document-vault.tsx`, `maintenance-reminders.tsx`, `trip-log.tsx`, `crew-list.tsx`: thay 4 confirm-dialog tự dựng (`:207/:299/:255/:294`) bằng `ui/ConfirmDialog`.
2. Cùng 4 file + `AdvanceForm` (`crew-list.tsx:537`): bọc 5 form sheet (`:281/:395/:343/:381/:537`) bằng `ui/BottomSheet`. → xóa sạch 9 modal không truy cập được.

**P1 — gom code trùng:**
3. Xóa 6 `formatVnDate` (doc:385, maint:518, price:36, crew:626, supply:22, trip:62), 1 `formatVnd` (trip:53), 2 parse tiền (trip-split:164, crew:533) → import `@/lib/format`.
4. Xóa 4 `Field` cục bộ + ~6 `inputCls` chuỗi → import `Field` + `inputClass` từ `ui/primitives`; sửa `trip-split.tsx:30` về cỡ chuẩn (hoặc thêm biến thể "tiền" vào primitives).
5. Thay các băng trạng thái inline bằng `ui/StatusBanner`; thay khối "trống" bằng `ui/EmptyState`; thay nút chính cam bằng `PrimaryButton`.

**P2 — khoá chuẩn thị giác:**
6. Dùng `ui/SectionHeader` cho mọi tiêu đề mục (thống nhất 1 cỡ); sửa `fines-lookup:63` (22px) và `sea-forecast:158` (17px).
7. Tạo `Chip`/`SegmentedChip` dùng chung (màu active thống nhất) cho `sell-guide`, bộ lọc `supply-catalog`/`price-board`, chip ngày map.
8. Nâng tap target: FAB map (`fishing-map-view:390/398`) và chip `sell-guide:60/146` lên `min-h-[48px]` (lý tưởng 56px theo design system).
9. Tạo `SecondaryButton` cho nút "Hủy" lặp trong form.

**P3 — token:**
10. Chú thích đồng bộ `#14324f`/`#e4572e` hardcode (layout, map paint) với token; cân nhắc đọc qua `getComputedStyle` cho MapLibre.

---

## 8. Phán quyết — độ mạch lạc thiết kế

Nền tảng design-system **đúng đắn, chất lượng cao và đầy đủ a11y** — BottomSheet/ConfirmDialog
giải quyết trọn bộ lỗi modal của audit 04; token đã đạt AA; `:focus-visible` + bỏ maximumScale
là chuẩn. **Nhưng đây là một cuộc di trú mới đi 1/4 đường.** Sản phẩm hiện ở trạng thái
"hai tốc độ": `sell-guide` + khu bản đồ đã hiện đại & truy cập được, còn 4 màn sổ sách
(giấy tờ / bạn thuyền / bảo dưỡng / lãi-lỗ) vẫn mang nguyên 9 modal không truy cập được và
9 bản hàm trùng. Về mặt *thị giác* thì khá mạch lạc (nhờ copy-paste cùng class), nhưng về
*kiến trúc + a11y* thì **chưa nhất quán** và rủi ro lệch chuẩn dần theo thời gian.

**Kết luận: chưa hoàn tất hợp nhất. Ưu tiên P0 (thay 9 modal) là việc rẻ nhất / lợi a11y lớn nhất.**
