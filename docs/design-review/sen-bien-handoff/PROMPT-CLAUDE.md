Đọc docs/design-review/sen-bien-handoff/README.md và mở preview.html cùng thư mục. Đây là bộ thiết kế tham khảo 12 màn của SDFish, định hướng Sen Biển làm trợ lý toàn app: giao tiếp theo mục tiêu, hiểu ngữ cảnh, trả thẻ kết quả và xác nhận trước hành động ghi dữ liệu.

Nhờ đối chiếu với code/spec/ADR mới nhất, rồi chuyển bộ tài liệu này sang đúng bên GPU/code được chủ dự án chỉ định để tham khảo. Nếu chưa rõ máy/chat nhận, hỏi đích nhận, không tự chọn máy hoặc gửi ra nơi khác.

Chú ý: dock 3 mục trong preview là proposal; CLAUDE.md hiện ghi dock 5 mục + Sen nổi. Không tự thay dock đang triển khai. Sổ bạn thuyền là danh bạ chung của chủ; Chợ cá và Vật tư là domain khác nhau. Mock chỉ mô phỏng giọng nói, dự báo và giao dịch; không dùng logic placeholder làm code thật.

Trước mắt bàn giao/đối chiếu, chưa có yêu cầu từ tài liệu này để đổi production, DB/auth, commit/push/deploy. Khi người dùng yêu cầu code, tuân thủ AGENTS.md và doc/test sync.
