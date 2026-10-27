# Bàn giao Claude / bên GPU — design Sen Biển toàn app

Ngày: 2026-10-19. Trạng thái: **thiết kế tham khảo, chưa triển khai production**.

## Yêu cầu người dùng

Người dùng muốn UI gọn, đẹp, bớt icon và khối lớn che bản đồ; tổ chức nhóm theo mục tiêu sử dụng. Định hướng tiếp theo: **Sen Biển là trợ lý toàn app, hướng đến hoàn thành công việc bằng giao tiếp với Sen**. Người dùng yêu cầu chuyển thông tin thiết kế cho Claude và bên GPU/code tham khảo. Chưa xác định chính xác máy/chat nhận tại thời điểm đóng gói.

## Mở bộ thiết kế

- `preview.html`: bản HTML độc lập, mở trình duyệt để xem 12 màn/trạng thái, bộ chọn màn nằm dưới khung điện thoại. Dùng máy chủ static nếu trình duyệt hạn chế mở file.
- `design-source.html`: fragment nguồn để đọc bố cục, CSS và tương tác mock.
- `PROMPT-CLAUDE.md`: lời bàn giao để gửi Claude.

Preview dùng D3 từ CDN nên cần mạng để tải thư viện vẽ bản đồ. Không gọi API dữ liệu app. Không bật micro, không đặt hàng hay đăng tin thật. Không phải ứng dụng chạy offline hoàn chỉnh.

## Phân biệt định hướng và quyết định đã chốt

Người dùng đã nêu hướng Sen toàn app. Thanh **Sen Biển · Bản đồ · Của tôi** là PHƯƠNG ÁN thiết kế do Codex đề xuất, không được coi là quyết định đã duyệt triển khai.

**Khác biệt với repo đang làm:** CLAUDE.md đọc ngày 2026-10-19 ghi dock hiện tại là **Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư; Sen là icon nổi**. Vì vậy không tự ghi đè dock đang triển khai chỉ vì preview có 3 mục. Có thể dùng ngay các nguyên tắc giao tiếp/ngữ cảnh/thẻ kết quả, còn thay cấu trúc nav cần đối chiếu quyết định mới nhất của chủ dự án.

## Cấu trúc đề xuất

1. Sen Biển: cửa vào theo mục tiêu; nói hoặc nhập chữ, tiếp tục việc đang dở, xem kết quả và xác nhận.
2. Bản đồ: mở trực tiếp, không buộc đi qua chat. Hải đồ, lớp cá, thời tiết, GPS, chạy tàu, lộ trình, điểm lưu và dữ liệu offline.
3. Của tôi: nhóm quản lý và lối vào bằng tay:
   - Tàu: hồ sơ, giấy tờ, thiết bị đang dùng, bảo dưỡng, dịch vụ, VMS.
   - Bạn thuyền: danh bạ chung của chủ tàu, chứng chỉ/bảo hiểm, tra cảnh báo theo quyền.
   - Chợ cá: giá tham khảo, tin mua/bán, đầu mối, tin đã đăng.
   - Vật tư: sản phẩm, giỏ, đơn mua, mua lại; kênh người bán tách vai.
   - Tài khoản/cỡ giao diện/thông báo/trợ giúp vẫn truy cập được.

Chợ cá và Vật tư là hai domain riêng: tin hải sản + liên hệ trực tiếp khác sản phẩm + giỏ + đơn hàng. Thiết bị đã sở hữu thuộc Chăm tàu; món muốn mua thuộc Vật tư. Không nhúng lại toàn bộ cửa hàng trong hồ sơ tàu.

## Danh sách 12 màn

| Màn | Mục đích |
|---|---|
| Sen Biển | Chào, gợi ý câu nói, nhập chữ, mô phỏng nghe, việc đang dở |
| Hỏi gió sóng | Câu hỏi → câu trả lời ngắn + thẻ dự báo + mở bản đồ |
| Bản đồ | Bản đồ là vùng chính, gọi Sen theo điểm đang xem |
| Đang chạy tàu | GPS không bắt buộc lập tuyến; ưu tiên cảnh báo |
| Của tôi | Nhóm hồ sơ/người/thiết bị và các lối vào mua bán |
| Hồ sơ & bạn thuyền | Hồ sơ tàu, danh bạ chung, chăm tàu |
| Nhờ Sen bán cá | Trích thông tin → bổ sung cảng/thời gian → bản nháp |
| Chợ cá | Giá, tin mua/bán, đầu mối |
| Nhờ Sen mua đồ | Tìm món đơn cũ, xem số lượng và giá |
| Vật tư & đơn hàng | Tìm món, nhóm hàng, đơn mua, kênh người bán |
| Xác nhận đơn | Hiện món, nơi nhận, cách trả, phí, tổng trước khi xác nhận |
| Mất sóng | Chỉ rõ bản lưu/thời điểm; không trình bày số cũ như dữ liệu mới |

## Hành vi Sen cần đạt khi triển khai

- Nói mục tiêu → hiểu ngữ cảnh → mở đúng màn/thẻ kết quả → hỏi phần thiếu → xác nhận khi tác động dữ liệu.
- Ngữ cảnh có cấu trúc: màn hiện tại, tàu đang chọn (khi có ý nghĩa), con trỏ/toạ độ, ngày giờ dự báo, tuyến, sản phẩm/đơn đang xem, quyền và trạng thái mạng.
- Sen nói ngắn, kết quả hiển thị bằng thẻ nghiệp vụ; không biến mọi tác vụ thành đoạn chat dài.
- Giọng nói và chạm thao tác trên cùng một bản nháp; không tạo hai nguồn trạng thái.
- Xem/tra cứu: thực hiện trực tiếp trong quyền hiện có.
- Đăng tin/đặt hàng/sửa hoặc xoá hồ sơ: trình nội dung cụ thể, xác nhận rồi mới ghi. Nhận diện giọng chưa chắc phải hỏi lại.
- Đặt lại món phải kiểm giá/tồn/phí hiện tại qua nghiệp vụ thật, không dùng snapshot đơn cũ làm giá cam kết.
- Mất mạng: nói rõ giới hạn; đọc bản lưu; giữ nháp cho việc cần mạng; không báo đã gửi khi chưa gửi.
- Cảnh báo an toàn ưu tiên hơn hội thoại thông thường; dùng engine cảnh báo hiện có.
- Mọi chức năng quan trọng vẫn thao tác bằng tay được nếu không nói được/ồn/mất mạng.

## Invariant cần giữ

- Danh bạ thuyền viên thuộc CHỦ, không đổi/mất khi đổi/xoá tàu. Gom lối vào không đổi ownership dữ liệu.
- Hồ sơ cố định của tàu theo boatId; đơn mua và dữ liệu chung giữ phạm vi đúng theo spec mới nhất.
- Chạy GPS và dẫn đường theo tuyến là hai trạng thái khác nhau.
- Bản đồ phải còn dữ liệu đã tải khi mất sóng. Không đổi khoá cache/localStorage để làm giao diện.
- Không trộn ngày dự báo điểm với thanh giờ lớp thời tiết; bám source hiện tại.
- Không thêm quyền premium/khóa bản đồ theo suy đoán từ mock.
- Không phục hồi sổ lãi lỗ, chia tiền/công nợ đã bị loại khỏi phạm vi.

## Định hướng hình thức

Gọn, rõ, màu biển tiết chế; icon nhỏ cùng nét; giảm khối tiêu đề/padding/badge dư. Mỗi màn một hành động chính. Sen là một điểm gọi thống nhất và hiểu ngữ cảnh. Trên bản đồ không đặt hero hoặc hộp chat lớn thường trực.

**Cỡ chữ, khoảng cách, vùng bấm phải theo docs/app-map/03 §0 hiện hành**, không sao chép thông số px của HTML mock. Preview chỉ tham khảo bố cục, chưa là design token production, chưa kiểm đủ accessibility/dark mode/toàn bộ kích thước máy.

## Nguồn code cần đối chiếu

Đọc AGENTS.md, CLAUDE.md, docs/app-map/README.md trước. Đọc có chọn lọc:
- 03-design-system, 07-design-spec: cỡ, density, nav, hành vi màn.
- 08-ba-spec-da-tau: phạm vi sở hữu và đổi tàu.
- 11/12 sàn thương mại: đơn, thanh toán, vai mua/bán.
- 13-ba-spec-tro-ly-giong-noi và ADR Sen mới nhất: kiến trúc trợ lý đang triển khai.
- src/components/bottom-nav.tsx, tau-tabs.tsx, trade-hub.tsx, crew-list.tsx.
- fishing-map-view.tsx, ra-khoi-controls.tsx, plotter-readout.tsx, route-planner.tsx, nav-mode.tsx, ui/snap-sheet.tsx, time-scrubber.tsx.
- src/components/market/buyer/*, seller/* và src/lib/market/*.

Danh sách trên là điểm bắt đầu, phải kiểm file/luồng hiện tại; repo đã thay đổi sau vòng audit đầu.

## Giới hạn mock — không mang sang production

- Tất cả giá, dự báo, tuyến, người, đơn, tồn kho là mẫu; không dùng đi biển hay giao dịch thật.
- Giọng nói là mô phỏng. Nhập chữ chỉ match từ khoá vào một vài kịch bản cố định, KHÔNG phải NLU/LLM thật.
- Một số màn sâu chỉ có placeholder, chưa đủ CRUD, lỗi/tải/rỗng/permission.
- Bản đồ dùng Natural Earth/D3 để minh hoạ bố cục, không thay MapLibre hoặc hải đồ thật.
- Widget state chỉ giữ trạng thái trình diễn, không phải store nghiệp vụ.
- Mock không phải đặc tả API/tool đầy đủ, không chứng minh có model chạy trên GPU hay trên máy người dùng.

## Phần bên GPU/model có thể tham khảo

Dùng các câu hỏi mẫu để đối chiếu ý định và ngữ cảnh. Model nên đề xuất tool nghiệp vụ trong quyền hiện có; ứng dụng kiểm schema, quyền, dữ liệu và bước xác nhận. Không cho model tự ghi DB hoặc tự xác nhận thay người dùng. Đây là nguyên tắc bàn giao, chưa chỉ định model, nơi inference, schema tool hay máy GPU cụ thể. Đọc ADR trợ lý mới nhất trước khi thiết kế giao tiếp app ↔ runtime.

## Checklist trước khi chuyển thành code

1. Đối chiếu nav 3 mục của proposal với nav 5 mục đang làm; ghi rõ phần dùng/phần không dùng.
2. Map từng luồng Sen vào tool và component hiện có; không viết lại engine bản đồ/sàn.
3. Chuyển token sang hệ thống rem và labels hiện hành.
4. Hoàn thiện trạng thái lỗi, thiếu thông tin, nghe sai, offline, mất quyền và lưu thất bại.
5. Kiểm bảo toàn dữ liệu, xác nhận hành động, deep link và thao tác bằng tay.
6. Chỉ khi có yêu cầu triển khai: sửa source + sync app-map + kiểm thử phù hợp. Không deploy, commit/push hay đổi DB/auth chỉ từ tài liệu tham khảo này.
