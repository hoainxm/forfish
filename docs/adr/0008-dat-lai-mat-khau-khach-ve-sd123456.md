# ADR 0008 — Đặt lại mật khẩu KHÁCH về `sd123456`; quyền đặt lại tick riêng từng quản lý

**Status**: Accepted
**Date**: 2026-10-06
**Deciders**: chủ dự án (chốt qua phiếu hỏi 2026-10-06) · đội SDFish

---

## Context / Bối cảnh

- 2026-07-29: nút "Đặt lại mật khẩu" ở `/quan-tri` đặt CỐ ĐỊNH `sd123456`.
- 2026-10-02 (RBAC P0): đổi sang NGẪU NHIÊN `sd` + 6 số mỗi lần (`randomTempPassword`), lý do: trùng mật khẩu chung của khách SDWork (ADR 0007) nên ai cũng biết.
- Hệ quả thật sau 4 ngày (chủ dự án 2026-10-06): *"hiện tại còn lung tung nhiều mật khẩu khác nhau"*. Mỗi lần đặt lại ra một chuỗi khác, chỉ hiện MỘT lần trên màn admin; ô "Mật khẩu tạm" khi tạo khách tay thì admin tự gõ tuỳ ý. Bà con gọi lên hỏi mật khẩu thì không ai trả lời được — đúng nút thắt mà chiến dịch 21/07 (ADR 0007) đã phải gỡ.
- Cùng lúc, chỉ admin được bấm đặt lại. Đại lý/quản lý chăm khách hằng ngày phải nhờ admin cho một việc lặp đi lặp lại.

## Decision / Quyết định

1. **Khách** (không phải nhân sự) đặt lại ⇒ về **`sd123456`**, một nguồn `DEFAULT_CUSTOMER_PASSWORD` (`src/lib/temp-password.ts`) dùng chung cho webhook SDWork, nút Đặt lại và ô mật khẩu điền sẵn khi tạo khách.
2. Vẫn bật `must_change_password` ⇒ app **nhắc** đổi khi đăng nhập lại, có lối "Thoát ra, để đổi sau" (không tái tạo cảnh 627/632 kẹt).
3. **Nhân sự** (quản lý/quản trị viên) đặt lại ⇒ vẫn **ngẫu nhiên**. Tra vai đối tượng hỏng ⇒ coi là nhân sự.
4. Quyền bấm: admin luôn được; quản lý chỉ khi admin tick **cờ riêng `resetPassword`** trong tab Phân quyền (mặc định TẮT, đọc hỏng ⇒ tắt). Có cờ cũng chỉ trên **khách của mình** (`managerTargetCheck`: cấm nhân sự, cấm chính mình, khách người khác ⇒ 403).
5. Giữ nguyên: thu hồi mọi chuỗi đăng nhập của số đó (R9), ghi `admin_audit` + `admin_activity_log` (`account.reset-password`, có `actorRole` thật và `password: default|random`).

## Alternatives considered / Phương án đã cân nhắc

### Option A: Giữ ngẫu nhiên, thêm chỗ tra lại mật khẩu đã cấp
- ✅ Không có mật khẩu chung mới.
- ❌ Phải LƯU mật khẩu dạng đọc được ở đâu đó để tra, còn tệ hơn mật khẩu chung.

### Option B: Đặt lại hàng loạt mọi khách về `sd123456`
- ✅ Đồng nhất ngay một lần.
- ❌ Thu hồi chuỗi mọi máy ⇒ bà con đang ngoài khơi mất sóng bị văng, không đăng nhập lại được tới khi có sóng. Chủ dự án KHÔNG chọn.

### Option C: Từng tài khoản về `sd123456` + quyền tick riêng ← chosen / đã chọn
- ✅ Hết "lung tung" ở mọi lần đặt lại từ nay; không đụng ai chưa bấm.
- ❌ Khách vừa được đặt lại mà chưa đổi ⇒ ai biết SĐT là vào được (cùng rủi ro ADR 0007 mục 1).

## Consequences / Hệ quả

- **Tích cực**: CSKH trả lời được "mật khẩu là gì" trong một câu; đại lý tự xử lý khách của mình.
- **Đánh đổi**: đảo một phần quyết định 2026-10-02 cho nhóm khách. Rủi ro dò mật khẩu phụ thuộc ADR 0007 Bước 1 (`/api/auth/exists` đã có rate-limit; đăng nhập vẫn dựa rate-limit mặc định của Supabase Auth).
- **Trung tính**: không migration — cờ nằm trong jsonb `staff_accounts.permissions` (0056) + gương `customers.staff_permissions`.

## References

- App-map: [04 §5b](../app-map/04-data-model.md), [10 R3/R5](../app-map/10-ba-spec-quan-tri-van-hanh.md), [ops/rbac-runbook](../app-map/ops/rbac-runbook.md)
- ADR liên quan: [0007](0007-siet-bao-mat-sau-sd123456.md)
- Code: `src/lib/temp-password.ts`, `src/lib/staff-permissions.ts` (`canResetPassword`), `src/app/api/admin/accounts/route.ts` (action `reset-password`)

## History

- **2026-10-06**: Accepted (chủ dự án chọn đủ ba khuyến nghị: từng tài khoản + ô tạo, tick từng quản lý chỉ khách mình, nhắc đổi có "để sau").
