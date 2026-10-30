# Rà soát SDFish — 28/10/2026

Đánh giá kiến trúc, dữ liệu/offline, bảo mật, thuật toán và trải nghiệm. Đây là báo cáo đề xuất, chưa triển khai sửa app.

> **Trạng thái 30/10/2026** (đối chiếu main `df371968`): **ĐÃ SỬA** A1 · A9 · A10 (02-architecture re-verified 2026-10-30n). **A6 không xảy ra ở production**: `device_tokens.expires_at` đã có (kiểm schema chỉ đọc 30/10) — nhánh lùi cấp token không hạn chỉ còn là code chết, gỡ cần chủ dự án duyệt (Auth 🔴). **CHỜ CHỦ DỰ ÁN CHỐT**: A4 · A5 · A6-gỡ nhánh (Auth 🔴) · A2 · A11 (đổi kết quả dẫn đường) · A3 (nghiệp vụ nền tháng) · A7 · A8 (hạ tầng/quản trị).

## Phạm vi và bằng chứng

- Bản chạy kiểm tra: workspace tại `b24956ac`, có thay đổi chưa commit của người dùng. Đã giữ nguyên các thay đổi đó.
- Đã fetch remote: `origin/main` tại `86e84fad`; HEAD có 1 commit riêng, remote có 51 commit riêng. Không pull/rebase vào workspace đang có việc dở. Đã đối chiếu diff remote của các phát hiện chính về sync, token, middleware, bản đồ và route planner.
- Đã đọc entrypoint, app-map theo domain, kiểm kê API, xem các đường auth/quyền, đồng bộ, upload giấy tờ, đơn hàng, Sen Biển, Kairos, service worker, dẫn đường và dự báo cá; đây là audit theo rủi ro, không phải kiểm từng dòng của 1.220 file trong src.
- `npm test`: **409 file passed, 2 skipped; 6.526 test passed, 3 skipped**. `npm run typecheck`: đạt. `npm run lint`: **0 lỗi, 76 cảnh báo**. Những số này thuộc workspace local, không phải kết quả CI của origin/main.
- Đã tái hiện lỗi sync bằng cách chạy module thật qua TypeScript transpilation với storage/network giả lập, không sửa source/test trong repo.
- Doc-health chạy xong, có cảnh báo thiếu metadata tài liệu. Không có báo lỗi broken cross-reference trong phần cuối báo cáo.
- Chưa build release, chưa kiểm DB/RLS đang triển khai, chưa pentest production, chưa benchmark Android/iPhone. Công cụ trình duyệt không attach được phiên local; đánh giá UX dưới đây dựa trên code/spec, chưa có bằng chứng ảnh chụp hoặc usability test.

## Nhận định kiến trúc

Giữ kiến trúc ứng dụng hiện tại và cải thiện từng ranh giới. Next.js + Supabase + dữ liệu lưu trên máy phù hợp với các yêu cầu đã thấy. Chưa có số đo chứng minh cần tách microservice hay viết lại app.

Các nền tảng tốt cần giữ:

- Phân biệt 401 dứt khoát với 503 khi không tra được danh tính, tránh đá người dùng giữa biển.
- API đồng bộ có CAS theo revision và merge theo ID; lỗi mạng giữ dữ liệu chưa đẩy.
- Service worker chỉ cache API trong allowlist, tránh gom hồ sơ riêng vào cache chung.
- Chợ có state machine, clientRef chống trùng, các thao tác quan trọng đi RPC và lấy chủ đơn từ danh tính xác thực.
- Thuật toán dẫn đường tách hàm thuần/worker, có chẩn đoán khi thiếu dự báo; không chỉ trả null chung chung.
- OCR giấy tờ điền vào form cho người dùng kiểm tra rồi mới lưu. Sen Biển có xác nhận cho một số hành động thay đổi đơn.
- CI kiểm lint/type/test; deploy tự động đợi CI xanh và checkout đúng SHA đã kiểm.

Điểm yếu kiến trúc lớn nhất là ranh giới trách nhiệm: `fishing-map-view.tsx` 9.137 dòng, `route-planner.tsx` 2.723 dòng, `fish-predict.ts` 2.402 dòng, service worker 2.077 dòng. Số dòng không tự chứng minh chậm, nhưng cho thấy phạm vi dễ ảnh hưởng khi sửa rất lớn. Cần profile trước khi kết luận về hiệu năng.

## Phát hiện và thứ tự xử lý

### A1 — P1: nhận dữ liệu server thất bại nhưng vẫn ghi đã đồng bộ

**Đã tái hiện.** `src/lib/user-sync.ts:161` nuốt lỗi ghi localStorage; `adoptServer` tại dòng 191 vẫn tăng mốc, xoá dirty và phát sự kiện.

Kịch bản: dữ liệu local tên `old`, mốc 100; server trả tên `new`, mốc 200. Giả lập đầy bộ nhớ lúc ghi cuốn dữ liệu, nhưng ghi metadata thành công. Kết quả: dữ liệu vẫn `old`, metadata thành `{at:200,dirty:false}`. Giải phóng bộ nhớ và gọi sync lại vẫn giữ `old`, vì server không còn mới hơn mốc local.

**Tác động:** người dùng có thể xem sổ cũ vô thời hạn dù app tưởng đã đồng bộ; rủi ro đặc biệt với giấy tờ và thuyền viên.

**Sửa:** writer trả trạng thái thành công; chỉ nhận revision/base/dirty mới sau khi lưu dữ liệu thành công. Giữ dấu cần kéo lại và báo lưu không thành công. Sau đó chuyển dữ liệu + metadata sang cùng transaction hoặc cùng envelope có phương án di trú.

**Nghiệm thu:** lỗi ghi dữ liệu, lỗi ghi metadata, đóng/mở app khi đầy bộ nhớ, giải phóng bộ nhớ rồi sync; không mất sửa đổi local, không xác nhận thành công giả. Trường hợp dữ liệu ghi được nhưng metadata không ghi được hiện cũng còn nợ sau khi khởi động lại (chính module đã ghi nhận).

### A2 — P1: triều có trong bộ tính nhưng chưa nối vào đường tính tuyến thực tế

**Xác nhận bằng caller.** `src/lib/route-plan.ts:798` nhận `tide` và dùng ở dòng 1238. `src/components/route-planner.tsx:861` không truyền tham số này. Màn hình có tải triều và dùng cho bước audit/cảnh báo sau tính, nên không thể kết luận app hoàn toàn thiếu cảnh báo triều. Tuy nhiên, ràng buộc triều của solver chưa có hiệu lực từ flow này.

**Sửa:** thống nhất cách đóng gói triều, datum và thời điểm đến vào đầu vào solver; giữ chính sách bảo thủ đã chốt, không tự mở đường nước cạn chỉ vì thêm dữ liệu.

**Bẫy cần tránh:** `heightAtMs` là function; truyền thẳng nó qua `postMessage` sẽ lỗi clone rồi rơi về tính đồng bộ trên UI. Nên truyền mẫu số liệu hoặc tham số trạm có thể serialize và nội suy trong worker. [MDN xác nhận function không được structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

**Nghiệm thu:** integration test từ thao tác tính tuyến tới worker, cùng tuyến ở hai thời điểm triều khác nhau; đo thời gian tương tác trên máy yếu. Không chỉ test hàm solver riêng.

### A3 — P1: chọn ngày sang tháng khác nhưng lớp bãi cá vẫn giữ nền tháng cũ

**Xác nhận bằng code; đã là nợ được ghi nhận.** `src/components/fishing-map-view.tsx:4739` trả nguyên `fishCast` khi `baseMode`, trước khi đọc tháng của ngày chọn. `ops/forecast-accuracy.md §7` cũng ghi rõ vấn đề này. Nhánh tương ứng vẫn còn trong origin/main được đối chiếu.

**Tác động:** người dùng chọn ngày tháng 11 nhưng có thể đang đọc nền tháng 10. Đây là vấn đề ý nghĩa dữ liệu và cách trình bày, chưa phải bằng chứng định lượng rằng dự báo sai bao nhiêu.

**Sửa:** tách rõ ngày người dùng chọn, tháng của bãi mùa vụ, ngày ảnh vệ tinh. Chưa có nền tháng mới thì ghi rõ giới hạn; chỉ thay mô hình sau khi chốt nghiệp vụ.

**Nghiệm thu:** ngày cuối tháng/đầu tháng, ảnh vệ tinh cũ, thiếu nguồn, offline; nhãn và dữ liệu phải nói cùng một thời điểm.

### A4 — P2: đăng xuất một máy thu hồi mọi máy của admin

**Xác nhận bằng code.** `src/app/api/auth/token/route.ts:193` gọi `revokeTokensOfPhone` cho DELETE. Trong cùng file, POST cho phép admin nhiều máy. Do đó đăng xuất trên một thiết bị sẽ thu hồi cả các thiết bị admin khác.

**Sửa:** đăng xuất thông thường chỉ thu hồi tokenHash hiện tại; hành động “đăng xuất mọi máy” là lựa chọn riêng. Giữ luật một máy cho tài khoản khách theo quyết định sản phẩm.

**Nghiệm thu:** admin hai máy, logout A không làm B mất phiên; thao tác thu hồi toàn bộ vẫn làm đúng.

### A5 — P2: token bị thu hồi vẫn qua cổng dữ liệu trong cửa sổ cache

**Xác nhận bằng code.** `src/lib/supabase/middleware.ts:44` tin identity cache; TTL tại dòng 120 là 10 phút. Thu hồi token trong DB không xoá cache này. Đây là độ trễ bảo mật có giới hạn, không phải bằng chứng vượt quyền admin: các route staff có kiểm quyền riêng.

**Sửa:** xác định SLA thu hồi; giữ cache cho tile nặng nhưng có cơ chế invalidation/version phù hợp, và giữ kiểm tra mới cho hành động nhạy cảm. Không tắt quyền đọc dữ liệu đã tải khi mất sóng một cách vô tình.

**Nghiệm thu:** warm cache, thu hồi token, gọi lại từng nhóm API; đo chính xác lúc hết truy cập online và phân biệt với dữ liệu offline đã lưu.

### A6 — P1 nếu production thiếu migration: nhánh tương thích có thể cấp token staff không hạn

**Điều kiện đã xác nhận trong code, trạng thái production chưa xác minh.** `src/app/api/auth/token/route.ts:140` retry insert không `expires_at` khi thiếu cột. App-map vẫn ghi 0056 chưa apply, trong khi phần khác ghi 0057 đã apply; không được lấy tài liệu này làm bằng chứng chắc chắn về DB thật.

**Sửa:** kiểm tra read-only schema đang triển khai trước. Thêm kiểm tra tương thích schema vào phát hành; sau khi migration đã đủ, đóng đường cấp token staff/test không hạn. Tách quyền dùng dữ liệu offline của khách khỏi thời hạn credential online/staff.

**Nghiệm thu:** thiếu schema làm bước phát hành báo lỗi rõ; tài khoản staff/test nhận expiry đúng và hết hạn đúng. Chưa tự apply migration trong audit này.

### A7 — P2: giới hạn chống lạm dụng chưa đồng đều

`src/app/api/auth/exists/route.ts:17` công khai boolean tồn tại SĐT, chưa có limiter tại route. Việc cho biết tồn tại đã được chủ dự án chấp nhận; không đề xuất âm thầm xoá UX đó. `src/lib/rate-limit.ts` lưu counter trong RAM từng instance, nên không phải giới hạn toàn hệ thống.

**Sửa:** ưu tiên quota dùng chung cho auth lookup và tác vụ tốn tài nguyên; xác minh proxy đáng tin trước khi dùng IP header. Không cần biến mọi request tile thành một lần ghi DB.

**Nghiệm thu:** tải từ nhiều instance vẫn đúng trần; không khoá cả nhóm ngư dân dùng chung mạng cảng. Đây là gap quan sát từ app code, chưa kiểm WAF/reverse proxy production.

### A8 — P2: credential JavaScript đọc được; cần tăng lớp bảo vệ tài khoản quản trị

`src/lib/device-token-store.ts:124` lưu bearer token trong localStorage. Đây là thiết kế đã chọn để dùng offline, không phải phát hiện XSS. Nếu có XSS cùng origin, token JavaScript đọc được sẽ làm tăng hậu quả. Chưa thấy CSP trong config/code được tìm, nhưng chưa kiểm header reverse proxy nên không kết luận production thiếu CSP.

**Sửa:** ưu tiên MFA/reauth cho quản trị, session quản trị có hạn, thu hồi và nhật ký; đánh giá cookie HttpOnly cho web quản trị. Với app ngư dân, thiết kế riêng quyền offline và credential online trước khi thay storage. Thử CSP Report-Only rồi mới enforce, kiểm MapLibre/worker/inline script/native.

Đây là hướng hardening theo [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), không phải yêu cầu đổi toàn bộ auth trong một lần.

### A9 — P2: upload giấy tờ chỉ tin MIME khai báo, chưa đồng mức với upload chợ

`src/app/api/me/docs/photo/route.ts:47` chọn loại theo `file.type`; module chợ đã có kiểm magic bytes tại `src/lib/market/route-utils.ts`. Bucket ảnh giấy tờ private và signed URL ngắn hạn là điểm tốt.

**Sửa:** dùng lại validator phù hợp, kiểm ảnh decode được/kích thước pixel và quota theo tài khoản. Giới hạn request body ở hạ tầng để không phải parse toàn bộ file quá cỡ trước khi từ chối. Không coi magic bytes đơn lẻ là kiểm tra đầy đủ.

**Nghiệm thu:** file giả MIME, ảnh hỏng, ảnh pixel quá lớn, upload dồn; không làm mất ảnh hợp lệ đang lưu. Chưa có bằng chứng route này cho phép thực thi mã hay đọc ảnh người khác.

### A10 — P2: trả kết quả đặt hàng còn đợi bước thông báo

`src/app/api/cho/don/route.ts:153` await thông báo lần lượt sau khi đơn đã tạo; `notifyMarket` tiếp tục await DB/push. Nuốt lỗi tránh exception nhưng vẫn có độ trễ.

**Sửa:** phản hồi sau khi commit đơn, tách thông báo sang cơ chế nền có bảo đảm vòng đời thực thi hoặc hàng đợi server bền vững. Không dùng `void promise` mù quáng trong serverless; không thêm hàng đợi đặt hàng offline trái spec.

**Nghiệm thu:** cố tình làm dịch vụ thông báo chậm, khách vẫn nhận mã đơn; retry cùng clientRef không sinh đơn trùng. Đo p95 trước/sau.

### A11 — P2: core có kiểm két dầu nhưng flow chưa dùng

`fuelReturnCheck` có trong `src/lib/route-plan.ts:122`; tìm caller ngoài test không thấy nơi gọi. Hồ sơ solver có `fuelTankL`/`lengthM` nhưng điều đó chưa tương đương người dùng nhận được kiểm tra đủ dầu đi-về. Runbook dẫn đường cũng ghi chưa nối UI.

**Sửa:** chỉ hiển thị kết quả khi có đầu vào người dùng xác nhận; phân biệt lượng dầu đang có với dung tích két. Không tự suy ra “đủ dầu” từ dung tích két hoặc coi phép nhân tuyến đi là mô phỏng đầy đủ tuyến về.

**Nghiệm thu:** thiếu thông tin phải nói chưa kiểm được; có thông tin thì giải thích giả định và số liệu đầu vào.

## Tối ưu UX và flow — đề xuất cần kiểm với người dùng thật

Các mục này là giả thuyết thiết kế, không phải lỗi đã tái hiện bằng thao tác trên điện thoại. Giữ thang cỡ hiện tại; không quay lại ép chữ/nút lớn toàn app.

| Luồng | Cải thiện đề xuất | Cách đánh giá |
|---|---|---|
| Mở app lần đầu | Dẫn tới việc đầu tiên hữu ích: chọn cảng, thêm tàu khi cần; giải thích quyền premium tại đúng hành động | Người mới hoàn thành việc đầu tiên không cần hướng dẫn; đếm bước và điểm bỏ cuộc |
| Điều hướng | Dock 6 icon là quyết định hiện tại; thử cách giải thích tên mục lần đầu hoặc nhãn mục đang chọn trước khi đổi cả dock | Người mới tìm đúng Bản đồ/Tàu tôi/Chợ cá/Vật tư; đo nhầm Chợ cá với Vật tư |
| Chuẩn bị ra khơi | Một trạng thái dễ hiểu: dữ liệu nào đã nằm trên máy, bản lúc nào, vùng/ngày nào còn thiếu; hành động tải tiếp rõ ràng | Tắt mạng và mở lại toàn bộ dữ liệu người dùng tưởng đã tải |
| Đọc bản đồ | Luôn phân biệt ngày xem, ngày dữ liệu, thiếu nguồn và bản lưu; chỉ bày công cụ liên quan việc hiện tại | Người dùng trả lời đúng “đây là số hôm nào, có đang thiếu gì không?” |
| Giấy tờ | Chụp → kiểm ô máy đọc → lưu → thấy xác nhận ảnh đã tải về máy → xuất trình offline | Kiểm ảnh chưa vào kho, ảnh nhiều trang, ngày hết hạn không đọc được, bộ nhớ đầy |
| Đa tàu | Tên tàu hiện tại xuất hiện ngay tại thao tác thêm/sửa giấy, nhắc việc và xuất trình | Chuyển tàu giữa lúc form đang mở; không lưu nhầm tàu |
| Đặt hàng | Thành công hiện mã đơn ngay; nếu nhiều shop thì nói rõ shop nào thành công, shop nào cần thử lại | Mất kết nối sau commit đơn, đổi giá, hết hàng, chạm hai lần |
| Kairos | Giữ phân biệt tin nhà nước/bài cộng đồng/tài trợ, tuổi tin và bản tải offline; tránh làm tin cộng đồng lấn cảnh báo cần làm | Đọc offline, tin bị ẩn/xoá sau tải, deep link từ thông báo |
| Sen Biển | Trả lời trạng thái ngay khi đang xử lý; đọc lại đúng tàu/đơn/hành động trước thay đổi quan trọng | Nghe nhầm, mất mạng, người dùng đổi màn/tàu trong lúc trợ lý xử lý |

## Thuật toán và chất lượng số liệu

- Dijkstra hiện là xấp xỉ theo thời gian, một nhãn chi phí/giờ mỗi nút. Code đã nói rõ; chưa có bằng chứng trong audit này để gọi nó tối ưu toàn cục hoặc kết luận cần thay thuật toán ngay.
- Đo oracle theo (nút, thời gian) và lưới mịn trên cùng bộ tuyến, so nhiên liệu/quãng đường/thời gian và các vi phạm ràng buộc. Chỉ thay thuật toán khi chênh lệch có ý nghĩa; thêm tuyến do thuyền trưởng duyệt.
- Solver có nợ lấy mẫu vùng cấm dài-hẹp ở `route-plan.ts:57`. Tài liệu nói kho hiện chưa có hình như vậy; chưa chứng minh đây là lỗi trên tuyến thực tế. Khi nguồn vùng cấm mở rộng, cần test giao đoạn với polygon, không chỉ test điểm mẫu.
- Điểm “confidence” từ MAE gió không nên được diễn giải thành xác suất an toàn hay xác suất có cá. Repo đã ghi ERA5 là tái phân tích, không phải phao đo; cần giữ phân biệt đó trong báo cáo chất lượng.
- Đánh giá cá theo thời gian và vùng giữ lại ngoài tập fit; báo số mẫu từng mùa/nghề, so với baseline mùa vụ, tách kết quả sản lượng khỏi việc “có tàu tập trung”. Audit này chưa chạy lại backtest, không chấm điểm độ chính xác.

## Lộ trình thực hiện

1. **Độ tin cậy dữ liệu và phiên:** A1; kiểm trạng thái schema A6; A4–A5. Acceptance tập trung đầy bộ nhớ, đổi tài khoản, thu hồi phiên và mất mạng.
2. **Đúng nghĩa kết quả:** A2–A3–A11; đi hết từ UI tới solver và phần giải thích dữ liệu. Không dừng ở unit test của hàm.
3. **Bảo vệ và tốc độ thao tác:** A7–A10; đo p95 API, quota đa instance và UX nhận kết quả đơn.
4. **Giảm độ phức tạp:** tách bản đồ theo dữ liệu/lớp hiển thị/selection/điều khiển; giữ giao diện bên ngoài và regression test. Dùng profile quyết định memoization, worker và tải lười, không tách file chỉ để giảm số dòng.
5. **Cổng phát hành theo hành trình:** thêm smoke E2E cho login → tàu → giấy → xuất trình offline; tải vùng → đóng/mở offline; đổi tài khoản; đặt hàng khi phản hồi thất lạc. Chạy ma trận iPhone Safari/PWA và Android native trên máy thật.

Tài liệu kiến trúc/design nên giữ trạng thái hiện hành gọn ở đầu, đưa lịch sử chỉnh sửa dài sang lịch sử riêng. Ví dụ scope khách xem tin bão/giá và luật premium đã đổi trên remote; một bản app-map cũ dễ làm người triển khai “sửa đúng tài liệu nhưng sai sản phẩm”. Mỗi báo cáo nghiệm thu cần ghi SHA, môi trường, nền tảng và kết quả cụ thể.

**Điều kiện để gọi là nghiệm thu toàn app:** rà live RLS/Storage và cấu hình proxy, chạy bản release đúng SHA, hoàn thành ma trận offline/đổi tài khoản/đa tàu, thực hiện usability test và benchmark thiết bị. Báo cáo này chưa thay thế các bước đó.
