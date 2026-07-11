# 07 — Ra khơi (`/ngu-truong`) — THIẾT KẾ Phương án A (nguồn chính)

> Design doc do user cung cấp (mockup `Ra khoi A.dc.html`, iPhone 390×844). Đây là **nguồn thiết kế chính** cho redesign. Build oracle = [app-map/07-design-spec §10](../app-map/07-design-spec.md). Hiện trạng cũ: [05](05-ra-khoi-current-state.md) · Data: [06](06-ra-khoi-data-inventory.md).

## 1. Nguyên tắc thiết kế
- **Bản đồ luôn sạch** — control gom **2 vùng**: thanh dọc trái (lớp dữ liệu) + sheet đáy (ngữ cảnh điểm).
- **Tự động / Chạm / Kéo**: chạm biển → sheet đáy hiện dự báo điểm (bão tự nổi) · 4 nút trái bật/tắt lớp · sheet 3 nấc kéo.
- **1 hành động chính/trạng thái** (CTA "Dẫn đường tới đây" / "Bắt đầu dẫn đường").
- **Cam-đỏ RESERVED cho ranh giới biển**. Số liệu đều "tham khảo" + nhịp + độ tươi.

## 2. Hệ màu & chữ
- Font **Be Vietnam Pro** (400–800).
- Primary xanh `oklch(0.52 0.13 235)` (CTA, lớp chọn, tàu).
- Ranh giới biển (RESERVED) `oklch(0.62 0.21 33)` cam-đỏ.
- **Cá/ngư trường `oklch(0.64 0.19 350)` hồng tím** (⚠ hiện app đang xanh lá — đổi).
- Bão vàng hổ phách `oklch(0.82 0.14 80)` (banner) + cam-đỏ (vùng/track).
- Text `#16202e` / phụ `#5b6b7d` trên trắng.

## 3. Mô hình lớp
**Nền — chọn-MỘT (radio)** + thang kéo dải hiển thị: Hải đồ độ sâu (cố định, 0→3000m) · Nước nóng-lạnh SST (ngày, −3→+3°C) · Vùng nhiều mồi (ngày) · Ảnh mây (ngày).
**Overlay — bật-tắt NHIỀU (checkbox)**: Dự báo cá PFZ (ngày/6h, chọn loài + dải %) · Gió&sóng điểm (giờ) · Lưới Windy (giờ) · SSHA (ngày) · Cảnh báo bão (liên tục, ưu tiên cao nhất, luôn bật).
Mỗi lớp có **chấm màu nhịp**: 🟥 liên tục · 🟧 giờ · 🟨 ngày · ⬛ cố định.

## 4. Bố cục
**Thanh dọc trái — 4 nút**: `Hải đồ` · `Ngư trường` · `Thời tiết` · `Điểm đã lưu` (mở panel sang phải).
- Hải đồ: radio lớp nền + thang kéo + "ảnh trễ ~2 ngày".
- Ngư trường: bật cá → chọn loài (14 loài, "x/39") + dải khả năng + gate đăng nhập chi tiết.
- Thời tiết: bão (ưu tiên) + Windy + SSHA, mỗi lớp có thang.
- Điểm đã lưu: list + **"Thêm điểm theo toạ độ"** (tên + vĩ độ + kinh độ) + sửa/xoá.

**Thanh dự báo NGANG (đáy, cố định)** — luôn hiện (trừ màn Điểm), nổi trên sheet, trượt theo:
- **Gió&sóng = tab mặc định luôn có** (an toàn quan trọng nhất); bật lớp khác → thêm tab (Khả năng có cá / Nhiệt độ / Mật độ mồi / Nước dâng).
- **Click ngày → bản đồ đổi theo ngày đó** (bão dịch vào bờ, vùng cá phình/co, gió đậm/nhạt) + badge "Bản đồ: [ngày]" giữa map.

**Sheet đáy (3 nấc kéo)**:
- Mặc định: "Đang hiển thị trên bản đồ" — list lớp đang bật (đổi theo thao tác).
- Chạm điểm: toạ độ + sóng/gió + cảnh báo ranh giới + CTA "Dẫn đường tới đây".
- Lớp cá: dự báo theo loài + thẻ khoá đăng nhập.
- Dẫn đường: quãng/dầu/thời gian + CTA "Bắt đầu dẫn đường".

## 5. Trạng thái (demo)
Mặc định · Chạm điểm · Lớp cá · Có bão (track dịch theo ngày) · Dẫn đường.

## 6. Đã loại bỏ / quyết định
- **Bỏ OceanByte** (không dùng).
- **Bỏ toggle "Tàu tôi" (GPS)** — trùng vai trò, đặt sai chỗ.
- Dự báo **đưa ra thanh ngang** (không nằm trong sheet) để click ngày thấy map đổi.

## 7. ⚠️ Ghi chú khả thi kỹ thuật (build cần biết)
- **Thang kéo trên lớp NỀN (depth/SST/mồi)**: các lớp này là **raster tile** (EMODnet/NASA GIBS) — ảnh dựng sẵn, **KHÔNG value-filter client được** như dải % cá (GeoJSON). "Thang kéo chọn dải hiển thị" trên nền → hoặc (a) chỉ là chỉ-báo-đọc-màu (không lọc thật), hoặc (b) phải render lớp từ data grid (việc lớn, chưa có nguồn). Dải % **cá** thì lọc thật được (đã làm).
- **"Bản đồ đổi theo ngày"**: gió/sóng/cá có dữ liệu theo ngày → đổi được; ảnh vệ tinh nền trễ ~2 ngày (không có "ngày tương lai"); bão track theo dự báo GDACS. Cần map từng lớp xem ngày nào đổi được.

> Số liệu mockup là minh hoạ; nối nguồn thật sau.
