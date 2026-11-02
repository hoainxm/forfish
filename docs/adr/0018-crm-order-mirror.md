# ADR 0018 — Đơn SDVICO từ CRM cho khách lẻ: bảng mirror chỉ đọc `crm_orders`, gộp vào `/cho/don`

**Status**: Accepted
**Date**: 2026-11-02
**Deciders**: Bảo (SDViCo) — duyệt SPEC + PLAN + confirm 🔴 ngày 02/11

---

## Context / Bối cảnh

Khách lẻ mua hàng qua CRM (SDWork, `work.sdvico.vn`) không tự xem được đơn của mình. SDFish đăng nhập bằng SĐT và đã có màn `/cho/don`, nhưng màn này là đơn **Chợ vật tư** (`market_orders`, nhiều shop, có máy trạng thái cùng các nút người mua: huỷ, đã nhận, đã chuyển khoản).

CRM → SDFish đã có ống outbox sẵn: `sdfish_outbox` → `sdfish-outbox-push` → `/api/sdwork/webhook` (HMAC). Event `customer` của ống này đã tạo tài khoản SĐT với mật khẩu mặc định `sd123456`.

Phía CRM: ADR 0015 (`crm-sdvico-40/docs/decisions/0015-crm-sdfish-order-sync.md`) và contract `crm-sdfish-order-sync`.

## Decision / Quyết định

Nhận event mới `order` qua webhook sẵn có và lưu vào **bảng riêng chỉ đọc `crm_orders`** (RLS khoá kín, đọc qua route service-role theo SĐT phiên). Màn `/cho/don` hiện đơn SDVICO **trong cùng 4 tab** bằng thẻ không có nút thao tác. Chi tiết đơn nằm ở `/cho/don-sdvico/[id]`.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Ghi đơn CRM vào `market_orders` (shop `sdvico`)
- ✅ Ưu: một bảng, một màn, không phải gộp.
- ❌ Nhược:
  - `shop_id` và `productId` của từng dòng là bắt buộc, trong khi đơn CRM không có product của chợ.
  - Máy trạng thái chợ cho khách huỷ hoặc bấm "Đã nhận" trên đơn do CRM quản.
  - Mã đơn `SD…` sinh tại chỗ, lệch với mã `DH…` của CRM.
  - Cron tự hoàn thành và thông báo chủ shop sẽ chạy nhầm trên đơn CRM.

### Option B: Bảng mirror riêng `crm_orders` + gộp hiển thị ← chosen / đã chọn
- ✅ Ưu:
  - Theo đúng khuôn `devices` / `supplies` (`sdwork_ref` unique, webhook là đường ghi duy nhất).
  - Không đụng chợ.
  - Gỡ bằng `DROP` là xong.
- ❌ Nhược: `/cho/don` phải gọi 2 API và gộp ở client. Chấp nhận được vì mỗi khách có ít đơn SDVICO nên API không cần phân trang.

### Option C: Đọc live từ CRM lúc khách mở màn
- ❌ Nhược: đi ngược quyết định 2026-06-16 ("SDFish độc lập, không đọc-live CRM"), và mất sóng thì không xem được.

## Consequences / Hệ quả

- **Tích cực**:
  - Tài khoản đi qua đường customer sẵn có: không reset tài khoản có sẵn, chặn tài khoản nhân sự.
  - Bản cũ không ghi đè bản mới, nhờ RPC `crm_order_upsert` có điều kiện `snapshot_at`. Lệnh gỡ để lại bia mộ (`crm_order_tombstones`) nên upsert cũ tới sau cũng không làm đơn sống lại.
  - Mất sóng vẫn xem được (bản lưu `forfish.sdvico-orders.v1`).
- **Đánh đổi**:
  - Số đếm tab cộng 2 nguồn.
  - Đơn chợ phân trang còn đơn SDVICO thì không.
  - Phụ thuộc ống outbox CRM còn sống. Ống từng tắc 26/10 → 02/11 vì webhook trỏ vào bản Vercel bị tạm dừng.
- **Thứ tự deploy**: SDFish `0078` + web → CRM `20261102120000` → bật cờ CRM `order_sync`.
