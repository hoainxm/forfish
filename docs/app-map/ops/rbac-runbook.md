# Ops — Tổ chức lại tài khoản & phân quyền (RBAC) — runbook triển khai

> Load khi: triển khai/kiểm tra việc tách vai · loại · hạng tài khoản (2026-10-02), apply migration 0056, xoay khoá sau sự cố lộ, gỡ tài khoản admin dùng chung, thêm/bớt quản trị viên.

covers: supabase/migrations/0056_rbac_staff_accounts.sql, src/lib/staff-store.ts
last_verified: 2026-10-02
ttl_days: 90
gate: warn

## Mô hình (một đoạn)

| Trục | Nguồn | Ai đổi |
|---|---|---|
| **VAI** — admin · manager · (không) | bảng `staff_accounts` (0056) · env `ADMIN_PHONES` = **1 số cứu hộ** | admin, tab Phân quyền |
| **LOẠI** — real · test · demo · reviewer | `customers.account_kind` (0056) | admin, ô "Loại" ở tab Tài khoản · `scripts/test-account.mjs danh-dau` |
| **HẠNG** — basic · premium | `customers.tier` | webhook SDWork, admin, quản lý (chỉ khách mình) |

Một cửa đọc: `src/lib/staff-store.ts` (`loadActor`). Luật thuần + test: `src/lib/admin.ts` (`resolveStaffRole`, `managerTargetDenial`, `tokenTtlMs`) — `src/lib/__tests__/rbac.test.ts`. Chi tiết luật nghiệp vụ: [10-ba-spec R3/R6–R10](../10-ba-spec-quan-tri-van-hanh.md); schema: [04 §0056](../04-data-model.md).

| | Admin | Quản lý `own` | Quản lý `all_premium` | Khách thật | test / demo / reviewer |
|---|---|---|---|---|---|
| Vào /quan-tri | ✓ | theo bảng quyền | theo bảng quyền | – | **không bao giờ** |
| Cấp/gia hạn premium | ✓ | khách mình + khách chưa ai cấp; cấm tự cấp | + mọi khách đang premium | – | – |
| Xoá · ghi cờ · ghi thu tiền · nhắn riêng | ✓ | chỉ khách mình | + khách đang premium | – | – |
| Gửi thông báo TẤT CẢ | ✓ | – | – | – | không nhận |
| Hạ hạng · đặt lại mật khẩu · đổi loại · đăng xuất mọi máy | ✓ | – | – | – | – |
| CCCD trong tab Thuyền viên | đủ | 4 số cuối | 4 số cuối | – | – |
| Hạn chuỗi đăng nhập | 7 ngày, nhiều máy | 7 ngày, 1 máy | 7 ngày, 1 máy | **không hạn** | test 24 giờ · demo 7 ngày |

## Thứ tự triển khai — ĐỪNG đảo

1. **Deploy code trước.** Code chạy được khi 0056 CHƯA apply (vai đọc từ `customers.role`, mọi người `real`, chuỗi không hạn) — không ai mất quyền.
2. **Apply `0056_rbac_staff_accounts.sql`** lên `znzgugvfhgmiszqgjulk` (🔴 chủ dự án tự apply). Kiểm sau apply:
   - `staff_accounts` có đủ số hàng = số `customers.role in ('admin','manager')`; RLS bật, 0 policy, anon/authenticated không có quyền bảng.
   - `customers.account_kind` mọi hàng = `real`; `device_tokens.expires_at` mọi hàng NULL (chuỗi đang sống không bị ảnh hưởng).
   - `select public.current_phone()` với phiên `@sdvico.local` vẫn ra SĐT.
3. **Đánh dấu tài khoản thử**: `node scripts/test-account.mjs danh-dau <sđt>` cho từng số trong `scripts/test-accounts.json`; tài khoản demo bán hàng / duyệt App Store → admin chọn loại ở tab Tài khoản.
4. **Gỡ admin dùng chung `0900000001`**:
   1. Mỗi người quản trị có **tài khoản riêng, đúng SĐT của mình** → tab Phân quyền → nâng lên Quản trị viên.
   2. Từng người đăng nhập thử /quan-tri bằng tài khoản riêng.
   3. Hạ `0900000001` (nút Hạ) — hệ thống thu hồi mọi chuỗi của số này ngay. Nếu cần giữ hồ sơ, đổi loại sang `demo` để số đó không bao giờ thành staff lại.
5. **Đại lý tổng**: với mỗi số trong env `MASTER_AGENT_PHONES` → tab Phân quyền → "Thấy khách nào" = *Mọi khách đang Premium*. Xong hết thì **xoá env** `MASTER_AGENT_PHONES`.
6. **Thu gọn env `ADMIN_PHONES` về đúng 1 số cứu hộ** (người chịu trách nhiệm cao nhất, không dùng hằng ngày). Số đó nâng lên admin trong DB trước rồi mới xoá các số env còn lại (`checkSetRole` cho phép nâng số đang là admin env — đường di cư).

## Xoay khoá — BẮT BUỘC (đã lộ trong lịch sử git)

Gỡ khỏi file không xoá được khỏi lịch sử git, nên phải coi những thứ dưới đây là **đã lộ**:

| Thứ | Lộ ở đâu | Làm gì |
|---|---|---|
| Khoá riêng VAPID | `ops/self-host-vps.md` (trước 2026-10-02) | Trước hết **so khoá trong doc với khoá đang chạy** trên Vercel/VPS — khác nhau thì chỉ cần gỡ (đã gỡ). Trùng thì phải xoay: `npx web-push generate-vapid-keys` → thay 3 biến `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → deploy. ⚠️ **Hiện app KHÔNG tự đăng ký lại** khi khoá đổi (`push-client.ts` dùng lại đăng ký cũ nếu có) và máy chủ chỉ dọn đăng ký chết 404/410 ⇒ xoay khoá xong là **mọi máy mất thông báo** (kể cả tin bão) tới khi bà con tắt/bật lại thông báo. Phải làm thay đổi client "đăng ký lại khi khoá khác" và để nó phủ máy TRƯỚC khi xoay |
| Mật khẩu khởi tạo admin chung | comment `0024_shared_admin.sql` | làm bước 4 ở trên; nếu chưa gỡ được ngay thì đặt lại mật khẩu số đó ở /quan-tri |
| SĐT cá nhân của chủ dự án trong `ADMIN_PHONES` | `ops/self-host-vps.md` | không phải bí mật, nhưng đừng để số cá nhân làm admin hằng ngày — bước 6 |

## Kiểm nhanh sau mỗi đợt đổi quyền

- Tài khoản quản lý: không thấy khách của người khác; bấm cấp premium cho chính mình → báo "Không thể thao tác trên chính tài khoản của bạn".
- Tài khoản test (đã `danh-dau`): đăng nhập app được, vào /quan-tri bị chặn.
- Admin bấm "Đăng xuất mọi máy" một tài khoản thử → máy đó bị đăng xuất ở lượt gọi mạng kế tiếp.
- Tab Nhật ký: thấy `staff.set-role`, `staff.set-scope`, `account.set-kind`, `account.revoke-sessions`, `account.test-token`.

## Việc còn lại (ngoài đợt này)

- Gỡ hai cột gương `customers.role` + `customers.staff_permissions` — migration riêng, sau khi 0056 đã chạy ổn ≥ 30 ngày và không còn bản deploy cũ.
- Gỡ GET `/api/crew-reports/lookup` (đã có POST) — khi bản app có POST đã phủ ≥ 60 ngày.
- Gỡ đường lùi cookie Supabase ở `api-identity.ts` — /quan-tri nay đã dùng chuỗi cứng, không còn phụ thuộc.
- Bảng nhật ký cũ `admin_audit` (0027) vẫn được ghi song song với `admin_activity_log`; gộp hẳn cần chủ dự án duyệt (đụng nhật ký kiểm toán).
- Mật khẩu mặc định khi webhook provision (`sd123456`, ADR 0007) giữ nguyên — có lộ trình siết riêng trong ADR.
