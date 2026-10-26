# Giao việc: Sen Biển rảnh tay — làm tiếp + TEST KỸ trên máy này (gpu-desktop)

Repo: ~/SDFish (đổi tên từ ~/ForFish 2026-10-18), nhánh feat/sen-bien-ranh-tay (HEAD 6fd19e2). Node 20 qua nvm (`. ~/.nvm/nvm.sh`).
Đọc CLAUDE.md của repo trước. Chủ dự án KHÔNG muốn bị hỏi lặt vặt: tự quyết theo mặc định an toàn, tự test, chỉ báo kết quả.
KHÔNG chạy gì trên máy Mac của chủ dự án.

## Đã có (test xanh 4342)
- announcer `reply` (một giọng chung: đỏ cắt ngang, trả lời không chờ nhịp 8 s) · useNavVoice `say/mute/unmuteVoice/repeatLast`
- lib/sen-bien/hieu-y.ts `senBienReply(text, model, dests, seaLine, {awaitingGo, running})`: lệnh ngắn bằng LUẬT (đi/thôi/dừng/im/bật tiếng/nhắc lại/còn bao xa), toạ độ nói (`parseSpokenCoordPair` trong lib/parse-coord.ts), tên chỗ (n-gram + dò tên)
- sen-bien-sheet.tsx = thẻ nhỏ nổi góc trái (Đi/Thôi khi chờ, mic, ô gõ khi mất mic)
- NavHud có cá Sen Biển ở hàng đầu (prop onSenBien); icon nổi chỉ hiện khi KHÔNG chạy
- Tự đọc khi mở bản đồ: prefs `tuDoc` (mặc định bật) + nút trong Cài đặt → Giọng đọc; chạm đầu tiên mở khoá loa web
- RouteMode prop `autoCompute` (số tăng ⇒ tự tính đường)

## Việc còn lại
1. **LỖI: tự vẽ đường không chạy.** Gõ "dẫn về cảng Sa Huỳnh" → bản đồ bay tới + khung dẫn đường mở, nhưng KHÔNG tự tính (còn nút "Tính lộ trình", không lỗi console). Soi effect `autoCompute` trong src/components/route-planner.tsx (có thể compute() chạy khi state khung chưa sẵn — `effectiveStartId`, `busy`, hoặc khung mount rồi effect chạy trước khi `dest` mới vào). Sửa gốc + test.
   Lưu ý: điểm cảng nằm TRÊN BỜ ("Điểm này nằm trên bờ") — xem compute có từ chối điểm trên bờ không; nếu có thì Sen Biển nên chọn điểm nước gần cửa cảng (đã có logic "gần điểm đến nhất"/snap? tìm trong lib/route-plan) hoặc nói rõ.
2. Sau khi tính xong phải: đọc tóm tắt ("Tới Sa Huỳnh: … hải lý, chừng … giờ. Nói đi để bắt đầu"), thẻ hiện nút Đi/Thôi; "đi" ⇒ startNav; khi đang chạy cruise thì chuyển thẳng sang dẫn đường.
3. Thẻ Sen Biển: đã thu hẹp `w-[min(20rem,calc(100%-6rem))]` để chừa cột rail phải — kiểm lại không đè nút "Đang chạy"/"Lớp bản đồ"; câu hướng dẫn ≤2 dòng. Chủ dự án: "gọn, đừng rối, đừng che bản đồ".
4. **GIỌNG NỮ** (chủ dự án: "giọng đọc đang ko hay, ko dùng các bộ đọc nữ của t à, cái nhịp không tự nhiên, máy móc"):
   - Bộ giọng nữ Sen Biển (VieNeu-TTS) nằm ở nhánh `feat/san-thuong-mai`: `public/tro-ly/audio/**` (câu cố định mp3) + commit 84b2371 "giọng nữ Sen Biển" + 7301365 (máy sinh giọng ở bờ). Đọc cách nhánh đó dùng (src/lib/assistant/speech.ts `setPackVoice`, brain-pack).
   - Làm: (a) câu CỐ ĐỊNH (lời Sen Biển, bản tin mở đầu khuôn cố định) phát bằng mp3 giọng nữ — sinh thêm clip bằng VieNeu-TTS trên máy này nếu cần (GPU có sẵn, xem Forlife Assistant ~/forlife voice-gateway/ hoặc tài liệu runbook); (b) câu ĐỘNG (khoảng cách, tên đảo) qua `lib/voice/tts.ts`: chọn giọng nữ vi-VN tốt nhất trên máy (ưu tiên tên chứa female/nữ/Linh/HoaiMy…), rate ~1.0, tách câu theo dấu phẩy/gạch thành các đoạn có ngắt nghỉ 150–250 ms cho tự nhiên. Một cửa vẫn là lib/voice/tts.ts (ADR 0010).
   - Offline: mp3 phải nằm trong public/ và được SW giữ (không đụng SHELL nếu không cần; nếu đụng sw.js thì chạy docs/app-map/ops/qa-offline-acceptance.md).
5. Doc cùng commit: 02-architecture, 07-design-spec (Sen Biển rảnh tay, tự đọc khi mở, thẻ gọn), 15-flow-dang-chay-giong-noi, ADR 0010 nếu đổi cửa giọng. Commit message có mục "Offline:" trả lời 4 câu (a)-(d) của CLAUDE.md.

## TEST KỸ (bắt buộc, không hỏi)
- `npm test`, `npx tsc --noEmit -p .`, eslint các file đụng.
- Giao diện: `npx next build && npx next start -H 0.0.0.0 -p 3000`, mở bằng Playwright Chromium headless (cài `npx playwright install chromium` nếu thiếu), viewport 375×812, giả GPS (context.setGeolocation + grantPermissions geolocation) ở biển gần Sa Huỳnh (14.6, 109.3).
- Đăng nhập: acc test theo docs/app-map/ops/test-tai-khoan.md (`node scripts/test-account.mjs cap 0903333333` — cần SUPABASE_SERVICE_ROLE_KEY; nếu .env.local máy này thiếu thì lấy bằng `vercel env pull` của project forfish nếu CLI có, KHÔNG in khoá ra log). Không lấy được khoá ⇒ đặt localStorage `forfish.token.v1` = "sdf_" + 43 ký tự [A-Za-z0-9_-] (qua cổng nhìn; API dữ liệu sẽ 401 — ghi rõ phần nào chưa kiểm được). Xong thì `thu` dọn chuỗi.
- Kịch bản: mở /ngu-truong ⇒ tự vào Đang chạy · chạm cá ⇒ thẻ gọn · gõ "dẫn về cảng Sa Huỳnh" ⇒ đường tự vẽ + tóm tắt + nút Đi ⇒ "đi" ⇒ đang dẫn đường · gõ "còn bao xa", "im", "nhắc lại", "dừng" · gõ "14 độ 34 phút bắc 109 độ 4 phút đông". Chụp ảnh từng bước vào ~/sen-bien-shots/.
- Xong: commit trên nhánh, push origin feat/sen-bien-ranh-tay (git push HTTPS/SSH tuỳ máy có quyền). KHÔNG đẩy main. Viết báo cáo ngắn ~/sen-bien-shots/BAO-CAO.md: đã làm gì, ảnh, cái gì chưa kiểm được.

## Model n-gram (đã làm, chỉ để biết)
Train lại 2 lần ở ~/forlife-troly (thêm câu lệnh ngắn): lệnh ngắn 74 % → 90–95 % nhưng test-b tụt ~1 điểm ⇒ app GIỮ model cũ; lệnh ngắn đi bằng luật. Trọng số mới ở ~/.local/forlife/train/out/troly-ngram{,.lan1}.
