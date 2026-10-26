# 0017 — Đọc giấy tờ tàu từ ảnh bằng Gemma máy nhà (cùng mô hình Sen Biển) + xuất trình offline cho cán bộ

- **Status**: Accepted
- **Ngày**: 2026-10-26
- **Người quyết**: chủ dự án — *"hỗ trợ bà con là chụp hình giấy tờ gửi lên app, app nội suy ra thời gian hết hạn các loại giấy tờ, báo hết hạn trước 30 ngày, lúc cần có thể show các bản này cho cán bộ, cơ quan phục vụ cho việc show nhanh cho cán bộ kiểm tra"* → hỏi "Claude đọc ảnh hay OCR trong máy?" → *"dùng cái ai nối về local để đọc"* → *"dùng chung con hỗ trợ sen biển ấy"*.

## Context

Tủ giấy tờ đã có: ảnh giấy lên Storage riêng (P3, 08/2026), nhắc hạn 30/15/7/3/1/0 ngày qua Web Push (10/2026). Thiếu hai thứ: (1) bà con phải GÕ TAY ngày hết hạn — gõ sai hoặc lười gõ là app không nhắc được; (2) ảnh chỉ xem được khi có sóng (signed URL), mà kiểm tra của biên phòng/kiểm ngư hay ở cửa lạch, trên biển. Lựa chọn OCR: Claude API (tốn tiền theo ảnh, ảnh giấy tờ đi ra ngoài), tesseract.js trong máy (gói tiếng Việt vài MB, chữ viết tay/mờ đọc kém), hay Gemma 4 trên máy GPU nhà — đã có đường `/gw/v1/forfish/*` ký HMAC/OIDC phục vụ Sen Biển (ADR 0016), mô hình `gemma4:e2b` có vision và đang nóng sẵn. Đo 26/10 ảnh mẫu giấy phép khai thác (nghiêng, mờ nhẹ): e2b đọc đúng 5/5 ô trong 1,9 s (Ollama trực tiếp), trọn cổng 1,2 s lạnh / 0,6 s nóng; e4b cũng đúng nhưng nạp lạnh 11 s. "Claude subscription" không dùng được cho app (gói thuê bao là chat, không phải API cho máy chủ gọi).

## Decision

1. **Máy nhà đọc, người quyết.** Ảnh nén (≤1,8 MB) ⇒ `POST /api/me/docs/doc-giay` (server ForFish: thuê bao, nhịp 10/10 phút, ký, mã thuê bao giả danh) ⇒ `/gw/v1/forfish/giay` (AI Assistant app-map 13 §7: Gemma e2b, `format: json`, `num_ctx` = của Sen Biển để không nạp lại, trần 12 s, nhịp 6/phút + 60/ngày) ⇒ `{loai, so, ngay_cap, het_han, ten_tau}` được kiểm hai lần (máy nhà `chuanHoaKqGiay`, ForFish `kiemKqDocGiay`: ngày thật 2000–2050, hết hạn ≤ cấp ⇒ bỏ). App **chỉ điền vào form**, câu nhắc nói rõ ô nào máy điền, bà con xem lại rồi Lưu. Không bao giờ tự lưu.
2. **Riêng tư**: máy nhà không lưu ảnh, không ghi nhật ký train, log chỉ ms; ForFish không lưu thêm gì ngoài Storage sẵn có.
3. **Xuất trình offline**: bytes ảnh vừa tải lên / vừa xem được cất IndexedDB `forfish-giay-anh` (`lib/giay-anh-kho`, trần 60 MB bỏ cũ nhất); dải ảnh và màn Xuất trình đọc kho trước, mạng sau. Dùng IndexedDB chứ không Cache Storage để KHÔNG đụng `sw.js` (activate xoá kho lạ ⇒ phải sửa SW + bộ QA offline). Đăng xuất xoá sạch kho.
4. Màn Xuất trình: toàn màn, một giấy một lúc theo thứ tự bộ giấy, chip hạn màu, ảnh phóng được, giữ màn sáng.

## Alternatives

- Claude API vision: chính xác nhưng ảnh giấy tờ (số tàu, tên chủ) ra ngoài + tiền theo ảnh; chủ dự án chọn máy nhà.
- tesseract.js trong máy: không cần sóng, nhưng đọc kém chữ viết tay/dấu đỏ; có thể làm đường lùi sau (nợ).
- Cache Storage cho ảnh offline: phải sửa sw.js; IndexedDB đủ dùng.

## Consequences

- **Offline** (câu hỏi bắt buộc CLAUDE.md): (a) request mới CHỈ khi bà con bấm Chụp giấy, có sóng + chuỗi, trần 30 s, mọi lỗi ⇒ câu "ghi tay"; không request lúc mở app/chuyển màn; (b) không đụng `sw.js`/SHELL/khoá `forfish.*` (kho IndexedDB mới, tên riêng); (c) không mất/đè dữ liệu: form chỉ điền ô, giấy lưu như cũ; ảnh Storage như cũ; (d) màn Xuất trình có nhánh kho trong máy — mất sóng vẫn xem ảnh đã từng tải/xem; ảnh chưa vào kho thì nói rõ cần sóng một lần.
- Máy nhà tắt / Funnel đứt ⇒ 502/503 ⇒ app nói "máy đọc giấy đang bận, ghi tay" — tính năng tắt êm, tủ giấy tờ như trước.
- Chưa đo trên ảnh chụp giấy THẬT (dấu đỏ, chữ viết tay, bóng) — nợ: gom ảnh thật (xoá SĐT) đo tỉ lệ đúng; sai nhiều thì đổi prompt/mô hình, luồng không đổi.
- nợ: đếm nhịp trong bộ nhớ một instance (như rate-limit.ts). nợ: pinch-zoom thật trên ảnh (hiện chạm = 2×), nâng khi bà con phản hồi.
