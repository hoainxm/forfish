# ADR 0006 — Cron dày hơn 1 lần/ngày KHÔNG được nằm trong `vercel.json`

**Status**: Accepted
**Date**: 2026-08-18
**Deciders**: chủ dự án (sau sự cố deploy đứng 7 tiếng)

---

## Context / Bối cảnh

Ngày 18/8, chủ dự án mở app và thấy tin bão *"vẫn thể hiện kiểu cũ"* dù code đường-đi-cơn-bão đã push xong. Truy ra: **production đứng ở commit `f96d94b` suốt 7 tiếng**, trong khi `main` đã đi thêm 5 commit.

Cái làm việc truy ra khó hơn nó đáng phải khó:

- Bảng Deployments của Vercel **KHÔNG hiện lỗi nào**. Không có bản build đỏ, không có bản bị huỷ — chỉ là "bản mới nhất là bản lúc 10:13".
- `git ls-remote` xác nhận GitHub có đủ 5 commit trên `main`. Code không thiếu.
- Đẩy thêm commit rỗng để thử: **ba lần push liên tiếp, Vercel tạo 0 deployment.**
- Bấm **Redeploy** trên bản mới nhất cũng không cứu — nút đó dựng lại **đúng commit của bản đó**, tức bản cũ.

Tôi từng loại giả thuyết "`vercel.json` sai" bằng cách tải schema `openapi.vercel.sh/vercel.json` và thấy `crons` cho `maxItems: 100`, `schedule` chỉ cần chuỗi ≥9 ký tự — `*/30 * * * *` hợp lệ. **Đó là phép thử sai chỗ**: giới hạn theo GÓI không nằm trong schema.

Chỉ khi gọi thẳng API tạo deployment mới đọc được câu trả lời:

```
400 cron_jobs_limits_reached
"Hobby accounts are limited to daily cron jobs. This cron expression
 (*/30 * * * *) would run more than once per day."
```

Nguyên nhân: commit `9af1c04` thêm cron thứ tư `/api/cron/notify-storms` với lịch `*/30 * * * *` vào `vercel.json`. Từ giây đó, **mọi** lời gọi tạo deployment bị từ chối — không riêng gì cron, mà cả ứng dụng.

Đáng nói: doc trong repo đã ghi *"cron THỨ TƯ ⇒ cần plan Vercel cho phép, CHƯA kiểm plan"* ngay lúc thêm. Cảnh báo đúng, nhưng không ai chặn nó lại, và cái giá là 7 tiếng bản vá an toàn nằm ngoài tay bà con.

## Decision / Quyết định

**`vercel.json` chỉ được chứa cron chạy tối đa 1 lần/ngày.** Cần nhịp dày hơn thì đặt ở **GitHub Actions**, gọi vào cùng route bằng `Authorization: Bearer $CRON_SECRET` — đúng khuôn `refresh-fish.yml` / `refresh-weather.yml` / `refresh-currents-depth.yml` / `refresh-storms.yml` đã dùng.

Áp ngay: `notify-storms` chuyển sang `.github/workflows/notify-storms.yml`, giữ nguyên `*/30 * * * *` và toàn bộ hành vi. Ba cron còn lại trong `vercel.json` (`refresh-fish` daily, `refresh-weather` daily, `snapshot-prices` weekly) đều hợp lệ.

Ràng buộc này gắn với **gói Hobby**. Đổi sang Pro thì mở lại được — nhưng phải sửa ADR này trước, đừng lặng lẽ thêm vào rồi lại đứng deploy.

## Consequences / Hệ quả

**Được**

- Deploy chạy lại. Và cái bẫy này không tái diễn: luật viết ở đầu `notify-storms.yml`, `refresh-storms.yml`, ADR này, `02-architecture`, `ops/external-services`.
- Nhịp đẩy tin bão không đổi một phút nào — Actions chạy `*/30` miễn phí.

**Mất / phải chấp nhận**

- Cron sống ở hai nơi (`vercel.json` cho nhịp ngày, Actions cho nhịp dày). Người mới phải đọc một luật thay vì nhìn một chỗ. Đổi lấy việc deploy không bao giờ chết vì một dòng lịch.
- Actions chết thì không ai đẩy tin bão. Nhưng đó là hỏng **kêu thành tiếng** (job đỏ), khác hẳn kiểu hỏng vừa gặp.

## Bài học cho lần sau (phần quan trọng nhất của ADR này)

1. **"Không có bản ghi lỗi" ≠ "không có lỗi".** Ca hỏng ở tầng TẠO deployment thì bảng Deployments trống trơn, không đỏ. Thấy production đứng mà bảng sạch thì phải gọi thẳng API tạo deploy để lấy câu lỗi.
2. **Đừng dùng schema để kiểm giới hạn theo gói.** Schema nói cú pháp hợp lệ; gói nói được phép hay không. Hai câu hỏi khác nhau.
3. **Redeploy không đưa code mới lên** — nó dựng lại commit của chính bản deploy đó.
4. **Cảnh báo "CHƯA kiểm" trong doc là nợ, không phải bùa hộ mệnh.** Ghi ra rồi ship là vẫn ship một thứ chưa kiểm.
