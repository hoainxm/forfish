# 01 — Review sản phẩm & UX (đánh giá cuối, trước ra mắt MVP)

> **Người đánh giá**: senior product reviewer · **Ngày**: 2026-06-10
> **Phạm vi**: read-only, đi hết app như một bác ngư dân 55 tuổi (40–60, ít rành CN).
> **Đối chiếu**: `docs/app-map/01-product.md`, `06-jtbd-quan-ly-tau.md`, `docs/design-review/00-plan.md`.
> **Đã đọc**: mọi `src/app/*/page.tsx` + component chúng render + `bottom-nav.tsx`.

---

## 0. Tóm tắt nhanh (verdict)

App đã **đúng xương sống**: taxonomy MECE theo đối tượng (Tàu · Người · Chuyến · Tiền) được hiện thực gần như trọn vẹn, route cũ redirect sạch, copy tiếng Việt mộc mạc và nhãn "tham khảo" có mặt ở hầu hết nơi cần. Bản đồ "Ra khơi" đã được gom thành màn-bản-đồ-toàn-trang đúng tinh thần plan. eCDT đã loại khỏi scope đúng quyết định — không thấy wizard khai hộ nào.

**Còn lỗi cần xử trước/ngay sau ra mắt**: (1) dải "Việc cần làm ngay" ở Trang chủ **chỉ quét giấy tờ tàu** — bỏ sót bão, bảo dưỡng quá hạn, bảo hiểm bạn thuyền hết hạn (đúng điều plan §D dặn phải gom); (2) ba màn cốt lõi (`document-vault`, `trip-log`, `maintenance-reminders`) **vẫn dùng confirm-dialog / bottom-sheet tự chế thiếu a11y** thay cho component chung đã trích sẵn → modal không bẫy focus / không Escape / không khóa cuộn nền; (3) thiếu cross-link giữa các nhóm việc (bảo dưỡng → vật tư, giấy tờ → mức phạt, lãi/lỗ ↔ chia tiền) dù plan §D đã chốt.

---

## 1. Taxonomy MECE — có giữ không?

**Kết luận: CÓ, ổn.** Nav 5 tab (`bottom-nav.tsx:18-24`): `Trang chủ · Ra khơi(/ngu-truong) · Tàu(/tau) · Bạn thuyền(/nguoi) · Tiền(/tien)` — đúng trục đối tượng đã chốt ở plan §A.

| Kiểm tra | Kết quả |
|---|---|
| Mọi feature ở đúng một chỗ? | Đạt. Tiền gom hết về `/tien` (giá + lãi/lỗ + chia); chia tiền đã rời `/nguoi` (`nguoi/page.tsx:7` ghi rõ). Giấy tờ TÀU ở `/tau`, chứng chỉ NGƯỜI ở `/nguoi` — hết chồng lấn. |
| Route cũ redirect? | Đạt 4/4. `gia-ca→/tien`, `van-hanh→/tau`, `giay-to→/tau`, `thuyen-vien→/nguoi` (mỗi file `redirect()` của Next). |
| Dead route / mồ côi? | Không thấy route chết. `SellGuide` mục "Mối quen", "Nhà máy" có chỗ; price/supply/fines đều mount trong tab. |
| Home cards khớp nav? | Đạt. `page.tsx:20-49` 4 thẻ trỏ đúng `/ngu-truong /tau /nguoi /tien`; nhãn thân thiện ("Tàu của tôi", "Sổ tiền") đồng bộ với plan. |

**Lưu ý nhỏ (Thấp)**: nhãn nav vs nhãn thẻ Home lệch nhau — nav ghi "Tàu", "Tiền"; Home ghi "Tàu của tôi", "Sổ tiền". Có chủ ý (nav ngắn), chấp nhận được, nhưng nên nhất quán một bộ chữ để người mới khỏi phân vân "Tàu" và "Tàu của tôi" có phải một.

---

## 2. Mỗi màn — hiểu việc trong 3 giây?

- **Trang chủ** — Đạt. Urgent strip + 4 thẻ lớn, câu chào mộc. (Nhưng urgent strip thiếu phạm vi — xem §3.)
- **Ra khơi (`/ngu-truong`)** — Đạt về "job rõ": mở ra là điểm đi biển theo cảng ở peek sheet (`fishing-map-view.tsx:421-452`), chạm biển = gió sóng + dẫn đường điểm đó. Đã hết "1 tab gánh 5 việc dạng cuộn dọc" — giờ là bản đồ + sheet 3 nấc + sheet Lớp. **Vẫn là màn nặng nhất** (bão + lớp ảnh + ranh giới + dự báo cảng + điểm chạm + dẫn đường dầu), nhưng được phân tầng hợp lý: thứ nguy hiểm (bão, ranh giới) luôn nổi, thứ chủ động (dẫn đường) nằm trong sheet. Chấp nhận cho MVP.
- **Tàu (`/tau`)** — Đạt. 4 tab `Giấy tờ · Bảo dưỡng · Vật tư · Mức phạt` (`tau/page.tsx:23-28`), segmented chia đều, nhãn đúng.
- **Bạn thuyền (`/nguoi`)** — Đạt. 3 ô tổng quan (số bạn / chưa bảo hiểm / đang ứng) lên đầu, nút "Thêm bạn thuyền" cam to.
- **Tiền (`/tien`)** — 4 tab `Giá cá · Bán ở đâu · Lãi/lỗ · Chia tiền` (`tien/page.tsx:23-39`). **Coherent**, không quá tải ở cấp tab. **Nhưng `SellGuide` bên trong "Bán ở đâu" có 5 chip** `Kênh bán · Nậu vựa · Chợ đầu mối · Nhà máy · Mối quen` (`sell-guide.tsx:40-46`) → tab-trong-tab-trong-chip, ba tầng điều hướng. Với người ít rành CN đây là tầng sâu nhất app. Xem §3 (Trung).

---

## 3. Khoảng trống flow & cross-link

### 3.1 [CAO] Urgent strip ở Home chỉ quét giấy tờ
`page.tsx:53-56` chỉ gọi `demoDocuments()` → strip "Việc cần làm ngay" **bỏ sót**: tin bão (đã có `fetchStormCheck`/`StormBanner`), bảo dưỡng quá hạn (`maintenance` đã tính `overdue`), bảo hiểm/chứng chỉ bạn thuyền hết hạn (`crewIssue` đã có level `danger`). Plan §D chốt rõ "Dải việc cần làm ngay ở Trang chủ gom MỌI nhóm". Hệ quả thực tế: bác ngư dân mở app, thấy "không có việc gấp" trong khi bảo hiểm 2 bạn đã hết hạn hoặc đang có áp thấp → đúng tình huống nguy hiểm mà app hứa tránh. Link strip cũng cứng `href="/tau"` dù nội dung là giấy tờ.

### 3.2 [CAO] Thiếu cross-link giữa nhóm việc (plan §D)
- **Bảo dưỡng → vật tư**: seed demo bảo dưỡng ghi "xem bảng giá bên dưới" (`maintenance-reminders.tsx:91`) nhưng KHÔNG có nút nhảy sang tab Vật tư. Trên `/tau` hai thứ là tab anh em, vẫn phải tự bấm.
- **Giấy tờ → mức phạt**: thẻ giấy tờ quá hạn không liên kết tới tab "Mức phạt" để bác xem phạt bao nhiêu.
- **Lãi/lỗ ↔ chia tiền**: `TripLog` (lãi/lỗ) và `TripSplit` (chia) cùng route `/tien`, chung gốc "chuyến biển" nhưng KHÔNG truyền số: bác nhập doanh thu+tổn 2 lần ở 2 tab. `TripSplit` lấy `crew` từ `useCrew()` nhưng tiền thì nhập tay lại.

### 3.3 [TRUNG] "Bán ở đâu" (SellGuide) ba tầng điều hướng + 5 chip
5 chip (`sell-guide.tsx:40`) nằm dưới tab "Bán ở đâu" nằm dưới trục Tiền. Bản thân mỗi chip rõ, nhưng chiều sâu 3 tầng là rủi ro với người 55 tuổi. Cân nhắc gộp "Nậu vựa + Nhà máy + Chợ đầu mối" thành một "Tìm chỗ bán" có bộ lọc, để lại "Kênh bán" (kiến thức) và "Mối quen" (của tôi) — giảm còn 3 chip. Không chặn ra mắt.

### 3.4 [THẤP] Storm chỉ xuất hiện trong /ngu-truong
`StormBanner` chỉ render trong `fishing-map-view.tsx:370`. Nếu bác chỉ mở Home rồi Tiền, không bao giờ thấy cảnh báo bão. (Liên quan 3.1 — nếu urgent strip gom bão thì xử luôn.)

---

## 4. Copy / lời lẽ

**Điểm mạnh — giữ nguyên**: tiếng Việt mộc, gọi "bà con", câu dặn dò bình tĩnh ("Ở bờ chờ biển êm", "nghe đài duyên hải"). Honesty labels có mặt dày: `price-board.tsx:52` ("Giá tham khảo… Giá thật tại cảng có thể khác"), `supply-catalog.tsx:42`, `fines-lookup.tsx:141` ("không thay cho văn bản gốc"), bản đồ ("Ảnh ngày X — chậm vài ngày"), dẫn đường ("vẫn chỉ để tham khảo… dò hải đồ"), storm ("nguồn fail → không nói bừa không có bão"). **Adapter rule giữ tốt — không thấy tên vendor (OceanByte/SDWork) lọt vào UI.**

- **[THẤP] Jargon còn sót**: `fishing-map-view.tsx:744` "nhịp sóng … giây" (wave period) — khái niệm kỹ thuật, bác có thể không hiểu; cân nhắc bỏ hoặc đổi "sóng dồn dập/thưa". Tọa độ "°B / °Đ" (`:482`) hiện cho người không quen độ — chấp nhận vì kèm nhãn vùng.
- **[THẤP] Bug copy nhỏ**: `trip-split.tsx:122-123` có `{finalVnd >= grossVnd ? "" : ""}` — cả hai nhánh rỗng (dead expression, vô hại nhưng là dấu hiệu copy chưa hoàn thiện, có lẽ định thêm dấu).
- **[THẤP]** Empty-state vẫn nói "Bấm nút **cam** ở trên" (`document-vault.tsx:108`, `trip-log.tsx:169`…) — phụ thuộc màu, người mù màu/đọc bằng screen reader không định vị được. Nhỏ.

---

## 5. Coherence với repositioning (con tàu) & eCDT-out-of-scope

- **Object model "con tàu"**: Đạt. Tàu (tài sản) · Người (lao động) · Chuyến (hoạt động) · Tiền (tài chính) hiện đúng. "Bốn lời hứa" vẫn sống trong `layout.tsx:21` description — đúng vai "ngôn ngữ giá trị", không còn là trục IA.
- **eCDT / NKKT ngoài phạm vi**: Đạt. Không có wizard khai hộ, không tích hợp hệ thống nhà nước. `fines-lookup` có tra phạt "không ghi nhật ký" (info-only) là hợp lệ, không phải công cụ khai. **Tuy nhiên** plan §7/JTBD-E nói ForFish vẫn nên **NHẮC mốc nghĩa vụ** (eCDT 01/3/2026; NKKT theo cỡ tàu) — hiện **chưa thấy bất kỳ lời nhắc mốc nào** trong app. Đây là phần "in-scope" của tuân thủ còn thiếu, nhưng thuộc Đợt 2 roadmap, không chặn MVP. (Trung, xem punch list.)
- **Checklist xuất bến / cảnh báo VMS / điểm rủi ro IUU**: chưa có — đúng là "CẦN XÂY" ở map §6, không kỳ vọng cho MVP này.

---

## 6. Nợ kỹ thuật chạm tới UX (a11y & nhất quán)

### [CAO] Modal tự chế chưa a11y ở 3 màn cốt lõi
Plan Đợt 1 đã trích `ui/confirm-dialog.tsx` (có focus-trap, Escape, trả focus, `role=alertdialog`) và `ui/bottom-sheet.tsx` (focus-trap, Escape, khóa cuộn nền, `overscroll-contain`). **`SellGuide` đã dùng chúng**, nhưng:
- `document-vault.tsx:206-237` (confirm xóa) + `:279-364` (form sheet) — **bản tự chế**, không Escape, không focus-trap, không khóa cuộn nền.
- `trip-log.tsx:253-286` + `:341-447` — tương tự.
- `maintenance-reminders.tsx:297-329` + `:393-498` — tương tự.
- `crew-list.tsx:292-329` + các form — tương tự.

Hệ quả: cuộn nền trôi sau lưng modal trên điện thoại, không đóng được bằng phím, screen reader không biết là dialog. Đây là regression so với mục tiêu plan §C. Còn kéo theo trùng lặp `formatVnDate`/`Field`/`inputCls` mà plan đã muốn dẹp.

### [THẤP] a11y tốt đã làm — ghi nhận
`layout.tsx:29` đã bỏ `maximumScale` (cho zoom) — đạt P0 plan §C1. `bottom-nav` active pill navy + `aria-current`. `BottomSheet`/`ConfirmDialog`/`SnapSheet` mới đều có aria/role chuẩn.

### [THẤP] Tab state không nhớ
`ui/tabs.tsx:27` `useState(tabs[0].id)` — chú thích nói "tự hydrate lại từ localStorage" nhưng code KHÔNG đọc localStorage. Quay lại `/tien` luôn về tab "Giá cá". Nhỏ, nhưng comment sai sự thật nên gỡ kẻo gây hiểu nhầm.

---

## 7. Punch list ưu tiên

| # | Sev | Việc | File:line |
|---|---|---|---|
| 1 | CAO | Urgent strip Home gom đủ: bão + bảo dưỡng quá hạn + bảo hiểm/chứng chỉ bạn thuyền hết hạn (không chỉ giấy tờ); link động theo loại | `src/app/page.tsx:53-111` |
| 2 | CAO | Thay 4 modal/sheet tự chế bằng `ui/ConfirmDialog` + `ui/BottomSheet` (focus-trap/Escape/khóa cuộn) | `document-vault.tsx`, `trip-log.tsx`, `maintenance-reminders.tsx`, `crew-list.tsx` |
| 3 | CAO | Cross-link: bảo dưỡng→tab Vật tư; giấy tờ quá hạn→tab Mức phạt; Lãi/lỗ↔Chia tiền truyền số chuyến | `maintenance-reminders.tsx`, `document-vault.tsx`, `trip-log.tsx`↔`trip-split.tsx` |
| 4 | TRUNG | Thêm "Nhắc mốc nghĩa vụ" (eCDT 01/3/2026, NKKT theo cỡ tàu) — info-only, không wizard | màn `/tau` hoặc urgent strip |
| 5 | TRUNG | Giảm tầng SellGuide: gộp Nậu vựa+Nhà máy+Chợ thành "Tìm chỗ bán" có lọc → còn 3 chip | `sell-guide.tsx:40-46` |
| 6 | THẤP | Đồng bộ nhãn nav vs Home ("Tàu"/"Tàu của tôi", "Tiền"/"Sổ tiền") | `bottom-nav.tsx:18-24`, `page.tsx:20-49` |
| 7 | THẤP | Bỏ dead expression `{finalVnd >= grossVnd ? "" : ""}` | `trip-split.tsx:122-123` |
| 8 | THẤP | Empty-state bớt phụ thuộc màu ("nút cam") + cân nhắc bỏ "nhịp sóng giây" | nhiều file; `fishing-map-view.tsx:744` |
| 9 | THẤP | Gỡ comment localStorage sai ở Tabs hoặc làm thật | `ui/tabs.tsx:8-12,27` |

---

## 8. Verdict

**Sẵn sàng ra mắt MVP chưa?** — **GẦN sẵn sàng**: nền IA/taxonomy/copy/scope đã đúng và chắc; nên xử **3 việc CAO** (urgent strip gom đủ nhóm #1 vì liên quan an toàn, modal a11y #2, cross-link #3) trước khi mở rộng người dùng — không cái nào lớn, ước 1–2 ngày. Các việc Trung/Thấp có thể theo sau bản phát hành đầu.
