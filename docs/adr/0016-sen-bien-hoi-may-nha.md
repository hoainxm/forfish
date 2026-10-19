# 0016 — Sen Biển hỏi máy nhà (AI Assistant, Gemma trong máy) khi máy bà con không tự trả lời được

- **Status**: Accepted
- **Ngày**: 2026-10-19
- **Người quyết**: chủ dự án — *"ai assistant có rồi. nối vô, rồi tạo pipeline để gemma ở local pc biết luồng xử lý riêng cho thuê bao forfish"*
- **Đảo**: luật 17/10 "Sen Biển chỉ chạy trong máy, bỏ nhánh hỏi máy chủ" (doc 15 §24) — nay có nhánh hỏi máy chủ, nhưng chỉ là **đường lùi**.

## Context

Sen Biển trả lời trong máy bằng luật + n-gram (Android thêm Gemma 270M). Câu ngoài tầm (hỏi mở, cách dùng app, nghề) thì nói "chưa hiểu". Repo AI Assistant chạy trên máy GPU của chủ dự án đã có kho tài liệu ForFish, Gemma 4 qua Ollama, lưới chữ an toàn, nhật ký train và cổng `/gw/v1/*` qua Tailscale Funnel có ký HMAC/OIDC.

## Decision

1. **Thứ tự không đổi**: luật → n-gram → kho/hỏi–đáp trong máy → (Android) Gemma 270M. Chỉ khi máy KHÔNG ra câu trả lời thật (`SenReply` `say` không `daTraLoi`), câu ≥ 2 chữ, có chuỗi thiết bị và có sóng (`nenHoiMayChu`) mới hỏi máy nhà. Máy nhà không bao giờ ra lệnh cho app — chỉ trả câu để đọc.
2. Máy bà con gọi `POST /api/sen-bien/hoi` (server ForFish), KHÔNG gọi thẳng máy nhà. Route: thuê bao đã đăng nhập (`identityFromRequest`), nhịp 30/10 phút mỗi SĐT, tra hạng (để Gemma nói đúng gói), ký rồi chuyển sang `https://gpu-desktop.tail1438a1.ts.net/gw/v1/forfish/hoi`, trần 20 s.
3. **Không gửi SĐT ra máy nhà**: định danh = mã thuê bao giả danh `tb-` + 24 hex = HMAC-SHA256(`CREW_CCCD_PEPPER`, `"forfish-tb:" + SĐT`). Ổn định theo người (nhịp + nhóm câu để train), không dò ngược từ danh bạ.
4. Ký: `FORLIFE_GW_KEY` (HMAC — web công ty IIS) hoặc OIDC Vercel (`x-vercel-oidc-token` — bản Vercel); công thức khoá bằng `sen-bien-cong-ai.test.ts` với vector tính độc lập theo spec AI Assistant. Thiếu cả hai hoặc thiếu muối ⇒ 503 `chua_noi`: tính năng TẮT ÊM, app như trước.
5. Phía máy nhà (repo AI Assistant ADR 0012, app-map 13): luồng riêng cho thuê bao — kho ForFish, Gemma `gemma4:e4b → e2b`, luật Sen Biển (≤3 câu để đọc, không hứa chỗ có cá, không đọc SĐT/STK, Biển Đông, **Hoàng Sa–Trường Sa của Việt Nam** — câu cố định), ghi nhật ký train `forfish_tb` (vòng train đêm học tiếp từ câu ngư dân thật).

## Consequences

- **Offline**: (a) request mới CHỈ khi bà con hỏi câu máy không trả lời được, có `navigator.onLine` + chuỗi, `timeoutSignal(22 s)`, mọi lỗi ⇒ `null` ⇒ máy nói câu của nó, không treo; (b) không đụng `sw.js`/SHELL/khoá `forfish.*` (route POST, SW không cache); (c) không ghi/xoá dữ liệu bà con; (d) không màn mới — mất sóng là nhánh trong máy như cũ.
- Sen Biển đọc "Để Sen Biển hỏi thêm." ngay khi gửi, rồi đọc câu máy nhà (1,5–3 s khi Gemma đã nạp; lượt lạnh ~15 s).
- **Điểm nối với kho hỏi–đáp trong máy (doc 15 §26, việc dở 19/10)**: câu kho KHÔNG có thì không được đánh `daTraLoi` — nếu không, máy nhà không bao giờ được hỏi. Đo 19/10 bằng giao diện: kho dở trả câu từ chối "dính tới luật lệ, con số…" cho "thủ đô nước Pháp" ⇒ máy nhà không được gọi.
- Màn bản đồ (`fishing-map-view`) có Sen Biển riêng — chưa nối ở bản này (file đang được tách ở đợt 3 rà Codex); Sen Biển toàn app (mọi màn khác) đã nối.
- Kho ForFish trên máy nhà dựng 17/10 — trước bản thiết kế lại ⇒ phải dựng lại kho (AI Assistant `ingest.mjs`) để Gemma nói đúng tên màn mới.

## Assumptions

- Dùng lại `CREW_CCCD_PEPPER` làm muối mã thuê bao (route mẫu câu `/api/sen-bien/mau` cũng dùng nó) — không thêm biến môi trường mới cho muối. Đổi pepper ⇒ đổi hết mã thuê bao (nhịp/nhóm câu train bắt đầu lại), không mất dữ liệu bà con.
- Màn đang mở gửi lên là đường dẫn (`/tau`), cảng nhà là TÊN TỈNH nhà (`loadHome().province`) — không gửi toạ độ.
