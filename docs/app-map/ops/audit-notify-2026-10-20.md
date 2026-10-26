# Audit nhắc hạn giấy tờ (push + sheet khi mở app) — 2026-10-20

> **Load khi**: sửa lịch mốc nhắc hạn, sheet nhắc khi mở app, cron `notify-docs`, hộp thư hay luật nhường tin bão. Bổ sung cho [audit-notify-2026-08-18](audit-notify-2026-08-18.md) (chính sách 5 tầng, 07 §12).
>
> Phạm vi: commit `e6f45c72`, gồm `lib/doc-reminders.ts`, `api/cron/notify-docs`, `components/doc-remind-on-open.tsx`, `lib/doc-reminder-local.ts`, `document-vault.tsx` (`?nhac=`), `lib/storms.ts` (`savedStormActive`), `doc-reminder-bell.tsx`, và `public/sw.js` (push/notificationclick). Đối chiếu bằng cách đọc code, chạy test và soi trình duyệt 375px.

## Đã sửa trong đợt này

| # | Lỗi | Hậu quả | Sửa |
|---|---|---|---|
| A1 | Sheet nhường MỌI bản tin bão có cơn trong máy, kể cả bản cũ | Ra khơi mất sóng nhiều ngày, nếu bản tin cuối có cơn thì sheet nhắc giấy **im suốt chuyến**, đúng lúc nó là kênh nhắc duy nhất còn chạy | `stormYieldsToReminder`: chỉ nhường khi có cơn **và** tin còn ≤12 giờ (`STORM_MAX_AGE_MS`). Có test trong `storms.test.ts` |
| A2 | Chỉ đánh dấu "đã báo" khi bấm nút / chạm nền | Vuốt Quay lại trên Trang chủ là thoát app mà không đóng sheet ⇒ mở lại thì hiện lại đúng mốc đó | Đánh dấu lúc sheet HIỆN. Dải khẩn vẫn liệt kê đủ |

## Còn mở (chưa sửa, cần chốt)

| # | Vấn đề | Mức | Đề xuất |
|---|---|---|---|
| O1 ✅ ĐÃ SỬA (cùng ngày, `keepLatestDocReminder` trong `/api/me/messages`) | **Hộp thư đầy tin nhắc hạn.** Mỗi push cũng ghi vào `push_messages`, và hộp thư Trang chủ hiện 3 tin mới nhất. Lịch mới ra 11 tin cho mỗi giấy (trước là 6), 6 ngày cuối liên tiếp ⇒ 3 ô đầu hộp thư toàn tin giấy tờ, che tin SDVICO và tin chung | Vừa | `/api/me/messages` chỉ giữ tin `sent_by='system:docs'` MỚI NHẤT (gộp như `tag` trên màn khoá). Không cần migration |
| O2 | **Nhiều tàu: bấm vào là rơi sai tàu.** Cả push lẫn "Xem giấy tờ" mở `/tau?tab=giay-to`, mà tủ giấy lọc theo TÀU ĐANG CHỌN (`showsUnderBoat`) ⇒ giấy của T2 không hiện khi đang chọn T1. Đã có từ 2026-10-06, dải khẩn cũng dính | Vừa | Thêm `&tau=<boatId>` và để /tau đổi tàu theo tham số. Đây là cross-trục, nên xử lý thành việc riêng |
| O3 ✅ ĐÃ SỬA (cùng ngày, `docPushUrl` → `/nguoi?nhac=`, `crew-list.tsx` đánh dấu đã báo) | **Push chỉ có giấy thuyền viên vẫn mở tab Giấy tờ tàu** (`docPushUrl` cố định `/tau?tab=giay-to`), trong khi bảo hiểm/chứng chỉ nằm ở `/nguoi`. Sheet đã tách đúng, push thì chưa | Nhỏ | `docPushUrl` chọn `/nguoi` khi mọi khoá là `crew-*`. Lưu ý `parseDocPushUrl` vẫn phải đọc được cả hai đường |
| O4 | **Có thể báo trùng trong ngày.** Sheet (sổ trong máy) và push (sổ máy chủ) ghi riêng ⇒ cùng một mốc có thể vừa hiện sheet lúc 6h vừa có push lúc 7h | Nhỏ, đã chấp nhận | Giữ nguyên. Gộp sổ lên máy chủ sẽ thêm request mạng (08 History 2026-10-20) |
| O5 | **Chưa chạy bộ offline bắt buộc trên máy thật.** Có thêm khoá `forfish.docRemindSeen.v1` (cổng `offline-backup.test` đã xếp loại). Không đụng `sw.js`/SHELL | Nhỏ | Trước phát hành: TC-07 trên Android bản cài, máy bay bật, mở Trang chủ ⇒ sheet hiện từ kho máy |

## Đã kiểm và đúng

- **Lịch mốc** `[0,1,2,3,4,5,10,15,20,25,30]`: chạy 31 sáng liên tiếp ra đúng 11 lần. Giấy nhập lúc còn 28 ngày thì báo ngay. Lỡ cron thì chỉ báo mốc hiện tại. Mốc đã gửi theo lịch cũ không gửi lại. Quá hạn vẫn mỗi 30 ngày ×3. Cửa sổ sổ đã gửi 45 ngày vẫn phủ bucket dài nhất (30 ngày quá hạn).
- **Ngày giờ VN**: cron dùng `todayIsoVN`, sheet dùng `useTodayVN`. Lỗi N1 cũ (UTC) không tái phát.
- **Chuông**: `tag: giay-to` + `renotify: true` (sw.js) ⇒ tin hằng ngày đè tin cũ mà vẫn kêu/rung. Tiếng là âm báo mặc định của máy. iPhone chỉ nhận khi đã "Thêm vào MH chính" (iOS ≥16.4).
- **≤1 push/chủ tàu/ngày**: gom mọi giấy tới mốc vào một tin, nhiều tàu thì kèm tên tàu (AC-8).
- **Offline**: sheet không gọi mạng nào (đọc localStorage + bản tin bão đã lưu). Không đụng `sw.js`. Kho hỏng thì im, không ném lỗi.
- **Riêng tư**: chưa đăng nhập thì im (cùng cổng `readToken` với dải khẩn). Thử với token giả bị máy chủ đá thì sheet im, đúng thiết kế.
- **`?nhac=`**: `DocumentVault` đọc URL lúc mount, trước khi `tau-tabs` đổi tham số, nên đánh dấu đúng khoá.
- **Chữ**: rem, tap 60px, màu warn/danger theo 07 §12 (`days === 0` là đỏ). Câu "Bật chuông" khớp lịch mới.
