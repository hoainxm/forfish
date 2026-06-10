# 00 — Plan redesign ForFish (tổng hợp 4 audit)

> **Mục đích**: chốt hướng redesign sau khi function nở nhiều. Tổng hợp từ
> [01-ia-navigation](01-ia-navigation.md), [02-design-system](02-design-system.md),
> [03-screens-ux](03-screens-ux.md), [04-accessibility](04-accessibility.md).
>
> **Last updated**: 2026-06-10

## Chẩn đoán chung (4 audit đồng thuận)

1. **`/ngu-truong` quá tải** — 1 tab gánh 5 việc (điểm đi biển + bản đồ + bão + geofence + dẫn đường dầu); riêng `fishing-map-view.tsx` ôm 4 lớp.
2. **`/thuyen-vien` mồ côi** — nhóm việc giá trị nhất (wedge) không có trong bottom nav.
3. **"Tiền" vỡ làm 3 ở 2 route** — lãi/lỗ ở Bán cá; ứng tiền + chia tiền ở Thuyền viên; chung gốc "chuyến biển".
4. **Code copy-paste theo feature** — `formatVnDate` ×6, `Field`/`inputCls` ×4–6, bottom-sheet ×5, confirm-dialog ×4; chưa tách component dùng chung.
5. **Accessibility là lỗi hệ thống & nguy hiểm** — chữ status (đỏ/vàng/xanh) KHÔNG đạt AA (3.95–4.46:1) đọc dưới nắng; zoom bị tắt; modal thiếu focus trap/Escape; tap target lẫn 44/52/56.
6. **Nav theo "4 lời hứa" cũ**, chưa khớp object model "con tàu".
7. **Điểm mạnh PHẢI giữ**: "ngôn ngữ thẻ" (banner trạng thái màu+icon+chữ), 29 icon stroke không emoji, active pill navy, trang chủ thẻ lớn.

## A. Taxonomy MECE — chia theo ĐỐI TƯỢNG QUẢN LÝ (chốt 2026-06-10)

**Vấn đề cũ (không MECE)**: nav cũ trộn 2 trục phân loại — "Đánh bắt/Bán cá/Vật tư/Giấy tờ" là **động từ lợi ích**, còn "Thuyền viên/Tiền" là **danh từ đối tượng**. Hệ quả: tiền nằm cả ở Bán cá lẫn Thuyền viên; giấy tờ TÀU và chứng chỉ NGƯỜI gộp chung một rọ "Giấy tờ" dù thuộc 2 đối tượng khác nhau → chồng lấn.

**Nguyên tắc mới (một trục duy nhất)**: chia theo **đối tượng bạn quản lý khi có một con tàu cá** — đúng mô hình doanh nghiệp kinh điển *Tài sản · Con người · Hoạt động · Tài chính*. 4 nhóm là 4 danh từ song song, loại trừ nhau, phủ hết.

| Trục (nhóm lớn) | Là gì | Gồm chức năng |
|---|---|---|
| **TÀU** (tài sản) | con tàu | giấy tờ tàu + nhắc hạn (đăng ký/đăng kiểm/giấy phép), bảo dưỡng máy, vật tư & phụ tùng, tra mức phạt |
| **NGƯỜI** (lao động) | thuyền viên | hồ sơ bạn thuyền, chứng chỉ + bảo hiểm + nhắc hạn, danh bạ/định biên |
| **CHUYẾN** (hoạt động) | chuyến ra khơi | điểm đi biển/dự báo, bản đồ ngư trường, ranh giới + an toàn + bão, dẫn đường |
| **TIỀN** (tài chính) | dòng tiền | giá cá, doanh thu, chi phí, lãi/lỗ chuyến, chia phần, ứng & công nợ |

**Vì sao MECE**:
- *Loại trừ nhau*: mọi chức năng "tiền" về một chỗ (TIỀN) thay vì rải 2 nơi. Tuân thủ/giấy tờ là **thuộc tính của đối tượng** (giấy của TÀU, chứng chỉ của NGƯỜI) → KHÔNG còn là nhóm peer chồng lấn.
- *Phủ hết*: tài sản + người + hoạt động + tiền = trọn vẹn việc vận hành một con tàu.

**Bottom nav (5 tab)** — giữ Trang chủ vì người ít rành CN bám chặt:
```
[Trang chủ]  [Tàu]  [Người]  [Chuyến]  [Tiền]
```
Nhãn thân thiện thay thế (cùng logic): **Tàu của tôi · Bạn thuyền · Ra khơi · Sổ tiền**.

- `/chuyen` (đổi từ `/ngu-truong`): điểm đi biển = màn CHÍNH; bản đồ + dẫn đường = màn phụ 1 chạm; geofence kèm bản đồ.
- `/tau` (gộp `/van-hanh` + `/giay-to`): bảo dưỡng + vật tư + tủ giấy tờ + tra phạt.
- `/nguoi` (`/thuyen-vien`): hồ sơ + chứng chỉ/bảo hiểm.
- `/tien` (route mới, gom từ `gia-ca` + phần chia/ứng của `thuyen-vien`): giá + lãi/lỗ + chia + công nợ.
- **Bán cá (giá)** nằm trong TIỀN; KHÔNG còn là tab riêng.

**Trục axis thay thế đã cân nhắc — vòng đời chuyến biển** (Chuẩn bị đi → Ra khơi → Về bờ → Hồ sơ nền): trực giác theo thời gian, nhưng *tiền* và *tuân thủ* trải đều nhiều pha → kém MECE hơn trục đối tượng. Không chọn.

## B. Hệ thiết kế — chốt & gom (nguồn sự thật = `globals.css`)

Trích component dùng chung vào `src/components/ui/`:
- **P1**: `<BottomSheet>`, `<ConfirmDialog>`, `<Field>`+`<TextInput>` (chốt `text-[17px]`, variant tiền), `<StatusBanner>` (level→icon+màu+label)
- **P2**: `<PrimaryButton>` (chốt `rounded-xl`), `<SectionHeader>` (1 cỡ `text-[20px]` + `px-4`), `<FilterChip>` (`min-h-[48px]`), `<StatTile>`, `<EmptyState>`, `<RefNote>`, `<Card>`
- **lib**: `lib/format.ts` (gộp `formatVnDate` + tiền VND)
- Dọn 2 hardcode màu (`price-board.tsx:92`, `fishing-map-view.tsx:275/284`); chốt 1 radius cho ô nhập 1 dòng; đồng bộ bảng hex trong `03-design-system.md` với code.

## C. Accessibility — P0 AN TOÀN (làm trước tiên, ít va chạm)

1. **Bỏ `maximumScale: 1`** (`layout.tsx`) — cho phóng to.
2. **Đậm token status** `--ok/--warn/--danger` để chữ banner đạt ≥4.5:1 (nhắm 5–6:1 cho nắng); nâng sàn chữ mờ ≥`/70`; sửa tab nav không active (2.62:1).
3. **Modal a11y**: `<BottomSheet>`/`<ConfirmDialog>` có focus trap + Escape + `role="dialog"` + `overscroll-behavior:contain` + khóa cuộn + trả focus.
4. `focus-visible` mọi nút/link; tap target phụ/chip ≥48px (chính ≥56px); `aria-hidden` icon trang trí.

## D. Liên thông màn (cross-link)

- **Dải "việc cần làm ngay" ở Trang chủ gom MỌI nhóm** (hiện chỉ quét giấy tờ): + bão, + bảo dưỡng quá hạn, + bảo hiểm bạn thuyền hết hạn.
- Cầu nối: bảo dưỡng → giá vật tư tương ứng; giấy tờ → mức phạt; lãi/lỗ ↔ chia tiền.

## Thứ tự thực thi (tránh va chạm parallel session)

> Session khác đang xây dẫn đường + bão (route-planner/storms, CHƯA commit, đang sửa `ngu-truong`, `fishing-map-view`, `ocean-map`, `sea`). Redesign là cross-cutting → KHÔNG spawn editor song song; chờ cụm đó land trước khi đụng `/ngu-truong`.

1. **Đợt 1 — Nền (ít va chạm, làm ngay)**: a11y tokens (C1–C2 trong `globals.css`) + `lib/format.ts` + trích `src/components/ui/` (BottomSheet, ConfirmDialog, Field, StatusBanner, SectionHeader, PrimaryButton…). Chưa đụng file đang hot.
2. **Đợt 2 — Áp dụng UI mới** vào các màn KHÔNG bị parallel đụng trước (Tiền/Thuyền viên/Giấy tờ/Bán cá/Vật tư): thay copy-paste bằng component chung, modal a11y.
3. **Đợt 3 — IA/nav**: bottom nav mới (5 tab), route `/tien`, hạ Bán cá/Vật tư xuống Home, urgent strip toàn cục.
4. **Đợt 4 — Tách `/ngu-truong`** (bản đồ + dẫn đường thành màn phụ) — SAU khi parallel session land.

## Quyết định cần user chốt
- IA: Phương án B? (khuyến nghị)
- Tab "Tiền" gom lãi/lỗ + chia tiền — đồng ý?
- Bán cá + Vật tư rời bottom nav xuống thẻ Home — đồng ý?
