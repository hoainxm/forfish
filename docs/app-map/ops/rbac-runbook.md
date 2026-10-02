# Ops — Tổ chức lại tài khoản & phân quyền (RBAC) — runbook triển khai

> Load khi: triển khai/kiểm tra việc tách vai · loại · hạng tài khoản (2026-10-02), apply migration 0056, xoay khoá sau sự cố lộ, gỡ tài khoản admin dùng chung, thêm/bớt quản trị viên.

covers: supabase/migrations/0056_rbac_staff_accounts.sql, src/lib/staff-store.ts
last_verified: 2026-10-02
ttl_days: 90
gate: warn

## Mô hình (một đoạn)

| Trục | Nguồn | Ai đổi |
|---|---|---|
| **VAI** — admin tổng · admin · manager · (không) | admin tổng = env `OWNER_LOGIN` (đăng nhập bằng TÊN) · admin/manager = bảng `staff_accounts` (0056) | admin tổng nâng/hạ quản trị viên; quản trị viên quản lý vai Quản lý — tab Phân quyền |
| **LOẠI** — real · test · demo · reviewer | `customers.account_kind` (0056) | admin, ô "Loại" ở tab Tài khoản · `scripts/test-account.mjs danh-dau` |
| **HẠNG** — basic · premium | `customers.tier` | webhook SDWork, admin, quản lý (chỉ khách mình) |

Một cửa đọc: `src/lib/staff-store.ts` (`loadActor`). Luật thuần + test: `src/lib/admin.ts` (`resolveStaffRole`, `managerTargetDenial`, `tokenTtlMs`) — `src/lib/__tests__/rbac.test.ts`. Chi tiết luật nghiệp vụ: [10-ba-spec R3/R6–R10](../10-ba-spec-quan-tri-van-hanh.md); schema: [04 §0056](../04-data-model.md).

| | Admin tổng | Admin | Quản lý `own` | Quản lý `all_premium` | Khách thật | test / demo / reviewer |
|---|---|---|---|---|---|---|
| Nâng/hạ/tạo/xoá quản trị viên | ✓ | – | – | – | – | – |
| Vào /quan-tri | ✓ | ✓ | theo bảng quyền | theo bảng quyền | – | **không bao giờ** |
| Cấp/gia hạn premium | ✓ | ✓ | khách mình + khách chưa ai cấp; cấm tự cấp | + mọi khách đang premium | – | – |
| Xoá · ghi cờ · ghi thu tiền · nhắn riêng | ✓ | ✓ (xoá admin: không) | chỉ khách mình | + khách đang premium | – | – |
| Gửi thông báo TẤT CẢ | ✓ | ✓ | – | – | – | không nhận |
| Hạ hạng · đặt lại mật khẩu · đổi loại · đăng xuất mọi máy | ✓ | ✓ | – | – | – | – |
| CCCD trong tab Thuyền viên | đủ | đủ | 4 số cuối | 4 số cuối | – | – |
| Hạn chuỗi đăng nhập | 12 giờ, nhiều máy | 7 ngày, nhiều máy | 7 ngày, 1 máy | 7 ngày, 1 máy | **không hạn** | test 24 giờ · demo 7 ngày |

## Admin tổng (chủ dự án chốt 2026-10-02)

Một tài khoản đăng nhập `/quan-tri` bằng **tên** (vd `admin`), không phải SĐT. Nguồn: hàng `staff_accounts` role=`owner` (0057, MỘT người — index unique), hoặc env `OWNER_LOGIN` (cách cũ, vẫn đọc). Tên đăng nhập khác SĐT mà không có hàng owner ⇒ máy chủ không cấp chuỗi (`bad_account`). Đứng trên mọi quản trị viên: **chỉ người này nâng/hạ/tạo/xoá quản trị viên**; web không hạ/xoá được admin tổng. Thay vai "cứu hộ" của env `ADMIN_PHONES`.

- **Không bao giờ `admin/admin`.** Đây là chìa mở mọi cửa và `admin` là tên đầu tiên kẻ dò mật khẩu thử. Script chặn: tối thiểu 12 ký tự, có cả chữ lẫn số (hoặc ≥16 ký tự), không chứa tên đăng nhập/`123456`/`sdvico`, không ký tự có dấu. (Nới 2026-10-02 — bỏ luật 3/4 loại ký tự vì chủ dự án gõ mãi không đạt.)
- **Gõ mật khẩu**: TẮT bộ gõ tiếng Việt (Telex/Unikey biến `aa`→`â` khi gõ ẩn). Mỗi ký tự hiện một dấu `•`; chưa đạt thì script liệt kê HẾT lý do và cho gõ lại (3 lần). Terminal không phải TTY (khung terminal của một số app) vẫn chạy được nhưng chữ có thể hiện ra — dọn màn hình sau đó.
- Định danh trong hệ thống là chính cái tên (`device_tokens.customer_phone = 'admin'`, nhật ký `actor_phone = 'admin'`). Không có hồ sơ khách, không dùng app ngư dân. Phiên 12 giờ, nhiều máy.
- Chưa có admin tổng (chưa apply 0057, không env) ⇒ không có admin tổng và mọi quản trị viên vẫn nâng/hạ được nhau (luật cũ) — để không tự khoá cửa lúc chuyển đổi.

**Bật (làm theo thứ tự) — GỌN từ 2026-10-02 (0057, admin tổng nằm trong DB, KHÔNG cần sửa env server / khởi động lại):**
1. Trên máy mình (có `.env.local` chứa `SUPABASE_SERVICE_ROLE_KEY` prod): `node scripts/owner-account.mjs admin` → tự gõ mật khẩu (mỗi ký tự hiện `•`). Chạy lại lệnh này = đổi mật khẩu + đăng xuất mọi máy của admin tổng. *(Cách khác không cần script: Supabase SQL editor — `update auth.users set encrypted_password = crypt('<mật khẩu>', gen_salt('bf')) where email = 'admin@sdvico.local';` — chạy tay, KHÔNG lưu vào migration/git.)*
2. Apply migration **`0057_staff_owner.sql`** — ghi hàng `staff_accounts (phone='admin', role='owner')`. Code đã deploy nhận ra ngay, không cần làm gì trên server.
   - *(Tuỳ chọn, tương thích bản trước: env `OWNER_LOGIN=admin` trong `.env.production` của server riêng `sdfish.sdvico.vn` vẫn được đọc — không còn cần.)*
3. Mở `/quan-tri`, đăng nhập bằng `admin` + mật khẩu vừa đặt. Tab Phân quyền phải thấy dòng **admin tổng** đứng đầu và ô "Nâng lên quản trị viên".
4. Chuyển người đang có thành quản trị viên: nhập SĐT ở ô "Nâng lên quản trị viên" (người chưa có tài khoản → "Tạo tài khoản nhân sự" chọn cấp Quản trị viên).
5. Xoá dòng `ADMIN_PHONES` (và `MASTER_AGENT_PHONES` khi đã chuyển đại lý tổng) trong `.env.production` của server riêng → khởi động lại app (Linux: `pm2 reload sdfish --update-env` · Windows: `nssm restart forfish`). Bước này KHÔNG bắt buộc ngay — để env cũ cũng không sao. Từ đây cửa cứu hộ duy nhất là admin tổng; quên mật khẩu thì chạy lại bước 1.

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
6. **Bật admin tổng rồi BỎ env `ADMIN_PHONES`** (chủ dự án chốt 2026-10-02 — mục "Admin tổng" ở trên). Số nào trong env cần giữ quyền thì nâng lên quản trị viên DB trước khi xoá env.

## Xoay khoá — BẮT BUỘC (đã lộ trong lịch sử git)

Gỡ khỏi file không xoá được khỏi lịch sử git, nên phải coi những thứ dưới đây là **đã lộ**:

| Thứ | Lộ ở đâu | Làm gì |
|---|---|---|
| Khoá riêng VAPID | `ops/self-host-vps.md` (trước 2026-10-02) | Trước hết **so khoá trong doc với khoá đang chạy** trên server production — khác nhau thì chỉ cần gỡ (đã gỡ). Trùng thì phải xoay: `npx web-push generate-vapid-keys` → thay 3 biến `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → deploy. ⚠️ **Hiện app KHÔNG tự đăng ký lại** khi khoá đổi (`push-client.ts` dùng lại đăng ký cũ nếu có) và máy chủ chỉ dọn đăng ký chết 404/410 ⇒ xoay khoá xong là **mọi máy mất thông báo** (kể cả tin bão) tới khi bà con tắt/bật lại thông báo. Phải làm thay đổi client "đăng ký lại khi khoá khác" và để nó phủ máy TRƯỚC khi xoay |
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
