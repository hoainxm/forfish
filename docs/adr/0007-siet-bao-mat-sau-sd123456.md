# ADR 0007 — Lộ trình siết bảo mật sau chiến dịch mật khẩu chung sd123456

**Status**: Proposed
**Date**: 2026-07-21
**Deciders**: Nam (product/owner) · đội SDFish

---

## Context / Bối cảnh

Chiến dịch kích hoạt 21/07: reset **634 tài khoản** `@sdvico.local` về mật khẩu chung **`sd123456`**, bỏ ép đổi mật khẩu lần đầu (627/632 KH từng kẹt ở màn ép đổi, chỉ 3 KH thật từng đăng nhập). Cùng ngày, màn `/login` tách thông báo lỗi qua `/api/auth/exists` — hiện gợi ý `sd123456` cho SĐT đã đăng ký.

Hệ quả bảo mật đang CHẤP NHẬN CÓ Ý THỨC để mở nút thắt kích hoạt:

1. **Mật khẩu chung ai cũng biết**: username = SĐT (đoán được / tra được), mật khẩu mặc định in trong app → bất kỳ ai biết SĐT một KH chưa đổi mật khẩu đều vào xem được thiết bị/bảo hành của KH đó.
2. **User enumeration**: `/api/auth/exists` cho phép dò "SĐT X có tài khoản SDFish không". Đánh đổi chấp nhận được vì username vốn là SĐT; route là chokepoint duy nhất, gắn rate-limit được ngay khi cần.
3. **Không có rate-limit riêng**: chỉ còn rate-limit mặc định của Supabase Auth; dò mật khẩu theo danh bạ SĐT chưa bị chặn chủ động.

Dữ liệu trong app là đồ đã mua + bảo hành + vật tư — nhạy cảm mức THẤP (không tiền, không giao dịch), nên đánh đổi ở mức chấp nhận được, NHƯNG cần lộ trình siết lại thay vì để vĩnh viễn.

## Decision / Quyết định

Chấp nhận rủi ro mật khẩu chung trong giai đoạn kích hoạt, siết lại theo **3 bước** dưới đây — mỗi bước có cổng quyết riêng, không làm đồng loạt để không tái tạo nút thắt kích hoạt.

### Bước 1 — Rate-limit đăng nhập theo IP + SĐT (làm sớm, không chờ)

- **Làm gì**: chặn dò mật khẩu/dò SĐT: (a) bật/siết rate-limit Supabase Auth (Dashboard → Auth → Rate Limits, mức sign-in per IP); (b) thêm đếm thất bại theo `IP + SĐT` ở middleware hoặc ngay trong `/api/auth/exists` (chokepoint sẵn có) — quá N lần/10 phút thì trả câu "thử lại sau" (KHÔNG khóa account, tránh kẻ xấu khóa giùm KH thật).
- **Effort**: nhỏ — config Supabase ~0.5 ngày; đếm ở middleware ~1–2 ngày (cần chỗ đếm: bảng Postgres nhẹ hoặc Upstash).
- **Impact**: chặn được dò hàng loạt — rủi ro (1) và (2) giảm mạnh mà KH thật không thấy khác gì.
- **Ai quyết**: đội SDFish tự quyết (không đổi UX, không đụng dữ liệu).

### Bước 2 — Chiến dịch nhắc đổi mật khẩu MỀM sau 30 ngày (~20/08)

- **Làm gì**: banner mềm trong app (trang chủ + sheet Tài khoản) cho user còn dùng `sd123456`: "Bà con đổi mật khẩu riêng cho an toàn" + nút đi `/doi-mat-khau`. **KHÔNG ép** (không middleware gate — bài học 627/632 KH kẹt). Nhận diện "còn dùng mật khẩu mặc định": đặt cờ `user_metadata.default_password=true` lúc provision/reset về mặc định, xóa cờ khi KH đổi ở `/doi-mat-khau` (webhook + trang đổi mật khẩu đều sẵn chỗ ghi metadata).
- **Effort**: vừa — ~2–3 ngày (cờ metadata 2 đầu + banner + test), kèm 1 đợt backfill cờ cho account đang ở mặc định.
- **Impact**: thu hẹp dần số account dùng mật khẩu chung mà không tạo nút thắt; đo được (đếm cờ còn lại).
- **Ai quyết**: Nam chốt thời điểm bật (sau khi nhìn số kích hoạt 30 ngày); nội dung banner đội SDFish tự soạn.

### Bước 3 — Đánh giá OTP SMS (khi có ngân sách)

- **Làm gì**: đánh giá thay/bổ sung mật khẩu bằng OTP SMS (Supabase Phone Auth + nhà cung cấp SMS VN — eSMS/SpeedSMS/Twilio). Xóa hẳn lớp "mật khẩu chung": SĐT + mã 1 lần, hết chuyện quên mật khẩu, hết sd123456.
- **Effort**: lớn — tích hợp nhà cung cấp SMS + đổi luồng login + chi phí ~200–700đ/SMS vận hành liên tục; ước 1–2 tuần dev + hợp đồng SMS.
- **Impact**: giải quyết tận gốc (1)+(2)+(3); nhưng thêm chi phí thường xuyên + phụ thuộc sóng SMS — cần cân với mức nhạy cảm thấp của dữ liệu.
- **Ai quyết**: Nam + SDVICO (có ngân sách, có hợp đồng nhà cung cấp) — chỉ khởi động khi Bước 1+2 xong và số KH hoạt động đủ lớn để đáng tiền.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Ép đổi mật khẩu lần đầu (giữ cơ chế cũ)
- ✅ Ưu: hết mật khẩu chung ngay lập tức.
- ❌ Nhược: đã thử — 627/632 KH kẹt ở màn ép đổi, chỉ 3 người vào được app. Giết kích hoạt.

### Option B: Chấp nhận có lộ trình 3 bước ← chosen / đã chọn
- ✅ Ưu: mở nút thắt kích hoạt trước, siết dần theo mức dùng thật; mỗi bước rẻ và đo được.
- ❌ Nhược: cửa sổ rủi ro mở trong lúc chưa xong Bước 1+2 — chấp nhận vì dữ liệu nhạy cảm thấp.

## Consequences / Hệ quả

- **Tích cực**: KH gọi hotline ít hơn (câu lỗi login chỉ đúng đường), chiến dịch kích hoạt 380 KH chạy được.
- **Đánh đổi**: đến khi Bước 1 xong, dò mật khẩu theo danh bạ SĐT là khả thi về lý thuyết; 2 account test mồ côi đã bị ban 21/07 để thu hẹp bề mặt.
- **Trung tính**: `/api/auth/exists` thành chokepoint bảo mật — mọi siết chặt sau này đặt tại đây, không rải rác.

## References

- App-map liên quan: `docs/app-map/04-data-model.md` §5b · `docs/app-map/02-architecture.md` (route `/login`, `/api/auth/exists`)
- Hợp đồng: `docs/integration/sdwork-sso-contract.md` §5
- ADR liên quan: 0001

## History

- **2026-07-21**: Proposed
