# C1: Phản biện độc lập cho P1 (thông minh) và P2 (kinh doanh). Ngày 06/11/2026

> Chỉ đọc. Đã kiểm lại số bằng SQLite `stracking.db` (mở `mode=ro`, script `c1check.py`) và Supabase prod (chỉ chạy SELECT). Không có SĐT hay tên.

## A. Kiểm chéo số then chốt

| Số | P1/P2 ghi | Kiểm lại | Kết luận |
|---|---|---|---|
| 187/251 dòng `han_lich_su` lệch +1 ngày | đúng | 187 dòng lệch đúng 1 ngày | **ĐÚNG** |
| Gia hạn đúng hạn ~55% | P2 dùng làm gốc cho "+10 điểm" | 63 lần gia hạn thật, nhưng **42 lần rơi vào cùng một lượt quét lúc 05 giờ ngày 06/11**. Hạn cước chỉ quét 4 lần/ngày, nên mẫu số thời gian chỉ ~20–31 giờ chứ không chắc là 1,5 ngày. Tuỳ chọn mẫu số, tỷ lệ ra từ ~55% tới ~90%. Thêm nữa, 20/63 lần (32%) là **gia hạn trễ** | **KHÔNG DÙNG ĐƯỢC.** Sai số còn lớn hơn mức +10 điểm định đo |
| "107/251 gia hạn rơi vào 0–7 ngày trước hạn ⇒ nhắc có tác dụng" (P2 §2) | | Con số này tính **cả 187 dòng giả**. Chỉ tính dòng thật thì là 26/63. Mà các lần gia hạn này xảy ra khi **chưa có tin nào tới tay ai**, nên nó không chứng minh được gì về tác dụng của lời nhắc | **SAI LẬP LUẬN** |
| 54% máy hết hạn trong 90 ngày | 7.505/13.826 | 2.294 + 2.586 + 2.625 = 7.505, tức 54,3%. Lưu ý mẫu số có cả 1.076 máy không có ngày hạn | Đúng |
| 0 push tới máy, 0,87% chủ tàu mở app | | Push: có **3/10.431** chủ tàu có đăng ký nhận push, 106 chủ có token đăng nhập (~1%). Số đã có ghi nhận đồng ý điều khoản: **17/10.431 (0,16%)** | Đúng về bản chất. Thiếu một số nguy hiểm hơn: **gần như không ai đã đồng ý** |
| "78% không nguồn ngoài" và "gốc 22.036 tin/ngày, giảm ≥90%" (P1 #1) | | Kho gần như **chỉ có 05–06/11** (trước 05/11 chỉ còn vài chục dòng tồn), nên nhãn "7 ngày" thực ra là ~1,5 ngày. Quan trọng hơn: `muc-canh-bao.mjs` **đã xếp "nguồn ngoài" khi nằm bờ vào mức "bỏ"** và chặn lặp 24 giờ cho tàu ngoài khơi. 22.036 là số **dòng thô**, không phải số tin đẩy | **Gốc đo sai.** Phần lọc nhiễu nguồn ngoài **đã làm xong**. Chỉ còn phần SOS kẹt là việc mới |
| SOS 24 máy, ~55 lần/máy/ngày | | 674 dòng/20 máy (05/11), 719/25 (06/11); sự kiện thật, không đếm trùng | Đúng về độ lớn |
| "14% lời nhắc tới trước mốc" (P1 #2) | | Chính r2 ghi: lượt chạy đầu gặp sẵn một **tồn đọng cũ** | **Gốc đo bị thổi phồng.** Phải đo lại trên các đợt mất mới, bắt đầu sau 05/11 |

## B. Giả định yếu và mâu thuẫn

1. **Cước VMS là bắt buộc theo luật.** Tàu ≥15 m không gia hạn thì bị phạt, nên đa số vẫn gia hạn, chỉ là trễ (32% mẫu trễ). Vậy lời nhắc chủ yếu **dời thời điểm** gia hạn, không tạo thêm doanh thu. Phần doanh thu tăng thật chỉ đến từ (a) giữ khách khỏi chạy sang VNPT/hãng khác, (b) kéo lại máy đã bỏ. Hơn nữa 1,3 tỷ là **cước gộp trả cho Viettel**. Phần SDVICO hưởng (c) chưa biết, có thể chỉ 10–20%. Con số 1,3 tỷ không được lên slide.
2. **"+10 điểm", "20% chủ thiết bị đặt lại", "5% đổi máy", "70% tới tay", "10% kích hoạt"** đều không có cơ sở đo. Bằng chứng duy nhất là tuần có 200 đăng nhập, và tuần đó do **nhân viên tạo tài khoản và hướng dẫn tận nơi**. Đó là bằng chứng cho kênh người, không phải cho ZNS.
3. **Nhóm đối chứng.** P2 giữ 10% "không nhắn". Nếu áp cho **cảnh báo mất kết nối, SOS hay bão** thì đó là cố ý giữ lại cảnh báo an toàn và cảnh báo phạt, không chấp nhận được. Chỉ được giữ đối chứng cho tin thương mại (gia hạn, vật tư, onboarding).
4. **Trùng nhau:** P1 #2 trùng P2 S9; P1 #1 + #3 trùng P2 S5; P1 #6 trùng P2 S8; P1 #8 trùng P2 S7; P1 #4 trùng P2 S2. Cần **một danh sách chung**, nếu không sẽ bị đếm hai lần trong ngân sách.
5. **Mâu thuẫn:**
   - Chỉ tiêu giữ chân 14 ngày: P1 đặt 30% → 45% (đối chứng 20%), P2 đặt 30% → 40% (đối chứng 10%).
   - **P2 S9 đóng đồng hồ phạt vào gói 12 tháng**, trong khi P1 #2 cho mọi người. Nếu S9 sau này bán giá G thì một cảnh báo giúp tránh phạt 30–300 triệu lại **nằm sau cổng thu tiền**. Như vậy là trái luật 1–2 (ngư dân chỉ trả cho dự báo cá), và là rủi ro uy tín khi một tàu không mua gói bị phạt.
6. **Cỡ mẫu:** P1 #7 dựa trên 59 premium dùng hằng tuần; P1 #5 dựa trên 157 câu của ~10 người. Rẻ, nhưng đừng kỳ vọng kết quả trong 8 tuần.
7. **P1 #9 "chưa có văn bản thì để miễn phí":** sai luật. Rủi ro của DataLake nằm ở chỗ đây là **dữ liệu quản lý nhà nước, API bản thử, có PII** (r1 §0.3), không nằm ở chuyện có thu tiền hay không. Luật "phi thương mại không chặn lớp miễn phí" trong CLAUDE.md chỉ nói về giấy phép nguồn mở. Nó không áp cho DataLake.

## C. Rủi ro bị bỏ sót

**Pháp lý**
- **Dữ liệu cá nhân.** 10.431 SĐT lấy từ cổng đại lý Viettel, nhưng chỉ 17 chủ tàu có ghi nhận đồng ý.
  - Nhắn ZNS/SMS về **hạn cước của chính dịch vụ họ đang dùng** có thể dựa vào căn cứ "thực hiện hợp đồng".
  - Nhắn **đổi máy, vật tư, premium** là tiếp thị: cần đồng ý trước theo NĐ 13/2023, Luật Bảo vệ dữ liệu cá nhân 2025 (cần pháp chế xác nhận hiệu lực, dự kiến 01/01/2026) và NĐ 91/2020 về tin nhắn rác (giờ gửi, tần suất, từ chối nhận).
  - Phải tách hẳn hai luồng mẫu tin. P2 đang trộn hai loại trong cùng một "phễu".
- **Hợp đồng đại lý Viettel.** Cào cổng đại lý bằng Playwright rồi dùng dữ liệu thuê bao để bán hàng SDVICO (đổi máy, vật tư) có thể vượt phạm vi đại lý được phép. Chưa ai đọc điều khoản này.
- **Xung đột lợi ích.** SDVICO làm mkn-3 cho Cục, đồng thời bán máy "phải nâng cấp theo NĐ 41" (S4), đồng thời in "Cục chốt lúc 21:10" (P1 #2). Dù mốc giờ lấy từ văn bản NĐ 41, bên ngoài vẫn có thể đọc thành "nhà thầu dùng hiểu biết hệ thống nhà nước để bán hàng". Cấm hẳn câu "bắt buộc nâng cấp" tới khi pháp chế xác nhận.
- **Trách nhiệm SOS.** P1 #1 hứa "100% SOS có người liên hệ trong ≤15 phút". Hứa như vậy là SDVICO nhận **nghĩa vụ cứu nạn trên thực tế**. Lỡ một ca thật thì trách nhiệm rất lớn. SOS phải đi kênh chính thức (Biên phòng, MRCC). ForFish chỉ "thông báo thêm", không cam kết SLA nếu chưa có ca trực 24/7 và văn bản.
- **"Nhắn trạm" (P1 #10).** Cục chưa chấp nhận kênh này, nên bà con dễ **tưởng đã khai hợp lệ**. Giai đoạn 2 chạm luật 16 (không tích hợp hệ nhà nước). Danh bạ Chi cục cũng chưa có.

**Vận hành**
- P1 và P2 cộng lại cần các đầu việc sau, trong khi hôm nay `contacted` = false trên toàn bộ 11.078 khách, và 2 đơn catalog bị bỏ quên 2 tháng. Tức là **chưa có người làm**:

| Đầu việc | Khối lượng |
|---|---|
| Gọi theo danh sách chăm khách (S2) | 50–80 cuộc/ngày |
| Gọi máy còn ≤3 ngày cước | ~76 máy chạm hạn/ngày |
| Phiếu đồng bộ Tổng cục thất bại (S5) | 1.636 máy |
| Đơn tạm ngừng VMS (S6) | 152 máy nằm bờ đang mất tín hiệu |
| SOS (P1 #1) | trực 24/7 |
| Gắn nhãn kết quả cuộc gọi | để có ~300 nhãn cho P1 #3 |

- **Kiến trúc thu dữ liệu chỉ có một điểm.** Một máy GPU ở nhà cào cổng Viettel. Máy tắt hoặc cổng đổi giao diện thì nhắc dừng **im lặng**. Đã có lỗ dữ liệu lúc 19 giờ. Muốn đẩy sang ZNS cho 10.000 SĐT thì phải có giám sát nhịp thu và báo khi thu hỏng trước.

**Uy tín**
- Gửi nhầm "tàu anh mất tín hiệu, sắp bị phạt" qua ZNS **hàng loạt** (dữ liệu cũ, `trong_bo` sai, lỗi múi giờ như vụ +1 ngày) sẽ đốt kênh CSKH chỉ trong một ngày. Bản thân mkn-3 đã có 5.847 ca lệch bờ/khơi.
- Bắt buộc có: ngưỡng chặn số tin/lượt, công tắc tắt khẩn, thí điểm 1 tỉnh, và lời "có thể".
- Kairos có **683 tác giả giả**: P2 đúng khi đòi ngừng.

**Offline.** Người nhận ZNS là chủ tàu trên bờ, nên ổn. Đồng hồ phạt (P1 #2) cần nhánh đọc T0 đã lưu, và **không được đếm sai khi giờ điện thoại lệch**.

**Luật anh Long đã chốt (r4)**
- P1 #4 "Kiểm máy" gần với Checklist xuất bến đã gỡ.
- P1 #8 + P2 S7 đẩy hàng SDVICO: sát luật 4 nếu đi vào sàn.
- P2 §6 đòi ẩn Việc làm và vai mới, nhưng các phần này **mới ra ngày 03/11**. Ba ngày không có dữ liệu chưa đủ để kết luận "0 dùng".

## D. Phán quyết từng đề xuất

**P1**

| # | Phán quyết | Lý do / sửa gì |
|---|---|---|
| Nền đo a, b, c | **GIỮ, làm đầu tiên** | Rẻ. Không giữ lịch sử đợt mất kết nối từ hôm nay thì mọi mô hình về sau không có nhãn |
| 1 Lọc nhiễu + SOS kẹt | **SỬA** | Bỏ phần nguồn ngoài (đã có trong `muc-canh-bao`). Chỉ làm nhãn "SOS nghi kẹt" chuyển cho CSKH. Bỏ cam kết "100% ≤15 phút" |
| 2 Đồng hồ mốc phạt | **GIỮ** | Giá trị cao nhất cho bà con, chạy thuần `lib`, offline. Phải **miễn phí cho mọi người**. Đo lại gốc trên các đợt mất mới |
| 3 Phân loại nguyên nhân | **SỬA** | Chỉ giữ hai luật chắc chắn ("Cước", "Đồng bộ") làm ngay. Các lớp khác hoãn tới khi đủ lịch sử và nhãn |
| 4 Kiểm máy | **HOÃN** | Gộp vào thẻ tàu của #2/#3. Cần anh Long xác nhận nó khác Checklist xuất bến |
| 5 Sen Biển 40% không hiểu | **GIỮ (nhỏ)** | Rẻ, nhưng chỉ ~10 người dùng. Đừng xếp trước kênh tới tay |
| 6 Hướng dẫn 14 ngày | **GIỮ** | Gộp với S8. Chốt **một** chỉ tiêu và **một** tỷ lệ đối chứng |
| 7 Trúng/Trượt | **GIỮ (nhỏ)** | Rẻ và tạo nhãn riêng của ForFish. Đừng hứa có kết quả trong 8 tuần |
| 8 Nhắc vật tư theo ngày biển | **HOÃN** | Chỉ 14 chủ thiết bị dùng app. Làm bản đơn giản ở S7 qua CRM trước |
| 9 Khoảng năng suất | **HOÃN** | Dùng DataLake thì cần văn bản của Cục, **kể cả khi miễn phí** |
| 10 Nhắn trạm | **HOÃN** | Không có giá trị pháp lý, chưa có danh bạ, dễ gây hiểu lầm đã khai |
| 11 Bãi nhóm năng suất cao | **BỎ (lúc này)** | Vướng DataLake, lẫn tay nghề với bãi tốt |

**P2**

| # | Phán quyết | Lý do / sửa gì |
|---|---|---|
| S1 Gia hạn chủ động | **SỬA** | Chỉ nhắn tin **giao dịch** (hạn cước) theo căn cứ hợp đồng. Thí điểm 1–2 tỉnh. Có đối chứng. Ghi doanh thu là "× c, chủ yếu dời thời điểm", bỏ con số 1,3 tỷ |
| S2 Danh sách gọi | **GIỮ** | Do CRM sở hữu, ForFish chỉ tính điểm. Giới hạn theo số người thật có |
| S3 Chủ nhiều tàu | **GIỮ** | Đòn bẩy rẻ nhất: 137 chủ từ 5 máy, gọi tay |
| S4 Đổi máy NĐ 41 | **HOÃN** | Chờ pháp chế xác nhận thời hạn, chờ có đồng ý tiếp thị, chờ có giá P, và cần tường lửa xung đột lợi ích |
| S5 Chăm sóc kỹ thuật | **GIỮ** | Ưu tiên 109 máy ngoài khơi đồng bộ thất bại: bà con bị phạt oan trong khi máy vẫn có sóng |
| S6 Làm hộ tạm ngừng | **GIỮ (thí điểm)** | Giúp bà con thật (mỗi tàu ~33 kỳ lỡ). Chấp nhận giảm cước ngắn hạn |
| S7 Nhắc vật tư | **SỬA** | Làm sau khi có đồng ý tiếp thị. Trước mắt chỉ **nối hoặc gỡ đơn catalog** |
| S8 Kích hoạt tại chỗ | **GIỮ** | Kênh duy nhất đã chứng minh. Thay mật khẩu mặc định của 12.139 tài khoản là việc **bảo mật bắt buộc**, không tuỳ chọn |
| S9 Bảo vệ kết nối | **SỬA** | Đồng hồ phạt miễn phí cho mọi người. Gói chỉ thêm dịch vụ người (gọi, ưu tiên sửa). Không đóng gói thứ an toàn |
| S10 Premium dùng thử | **GIỮ** | Chốt một giá trước |
| S11 Đại lý thưởng | **HOÃN** | Chưa có số h, dễ chồng kênh |
| S12 B2G | **HOÃN** | Chỉ xin ý kiến pháp chế |
| §6 Danh sách ngừng | **SỬA** | Ngừng Kairos dữ liệu mồi **ngay**. Shop sàn và chợ tin thì ẩn. Việc làm và vai mới chờ 60 ngày dữ liệu rồi mới xét |

## E. TOP 5 việc thật sự nên làm trong 30 ngày

1. **Dọn nền và chặn rủi ro:**
   - lọc 187 dòng giả;
   - giữ lịch sử từng đợt mất kết nối;
   - bảng sự kiện tối thiểu;
   - giám sát nhịp thu S-Tracking, có báo khi máy GPU hoặc cổng hỏng;
   - đổi mật khẩu mặc định sang OTP hoặc link một chạm;
   - **ngừng Kairos dữ liệu mồi**.
2. **Kênh tới tay, nhưng theo luật:** đăng ký OA, duyệt **chỉ mẫu ZNS giao dịch** (hạn cước, mất kết nối, đồng bộ thất bại). Có ngưỡng chặn số tin, công tắc tắt khẩn, thí điểm 1 tỉnh, và luồng xin đồng ý tiếp thị tách riêng.
3. **Đồng hồ mốc phạt (P1 #2), miễn phí cho mọi người**, kèm hai luật nguyên nhân chắc chắn (cước, đồng bộ) trên thẻ tàu. Đo lại "tỷ lệ nhắc trước mốc" chỉ trên các đợt mất mới.
4. **Chăm sóc bằng người, theo danh sách:**
   - gọi 109 máy ngoài khơi đồng bộ thất bại;
   - gọi các máy SOS nghi kẹt;
   - gọi 194 máy quá hạn ≤30 ngày;
   - gọi 137 chủ từ 5 máy;
   - ghi **kết quả từng cuộc gọi**. Đây là nhãn cho mọi mô hình về sau.
5. **Kích hoạt tại chỗ + hướng dẫn 14 ngày** khi nhân viên lắp hoặc gia hạn, kèm nối hoặc gỡ đơn catalog. Có đối chứng cho phần onboarding.

Để sau 30 ngày: đổi máy NĐ 41, nhắc vật tư tiếp thị, Nhắn trạm, mọi thứ dùng DataLake, B2G, mô hình ML.

## F. Ba câu hỏi anh Long phải trả lời trước khi chi tiền

1. **SDVICO thật sự hưởng bao nhiêu trên mỗi đồng cước gia hạn (c)?** Hợp đồng đại lý Viettel có cho phép dùng dữ liệu thuê bao để chăm sóc và bán hàng SDVICO không? Không có hai câu trả lời này thì không tính được lời lỗ của ZNS, SMS và người gọi.
2. **Căn cứ pháp lý để nhắn tin cho ~10.000 SĐT chưa đồng ý là gì?** Tin nào là giao dịch (được gửi), tin nào là tiếp thị (phải xin trước)? Ai chịu trách nhiệm nếu gửi nhầm cảnh báo phạt hàng loạt?
3. **Ranh giới của SDVICO, vừa làm hệ của Cục vừa bán máy và dịch vụ, là gì?** Cụ thể: có được in "giờ Cục chốt", có được nói "bắt buộc nâng cấp NĐ 41", có nhận SLA cho SOS không, và có xin văn bản dùng DataLake không. Câu này phải trả lời bằng văn bản pháp chế trước khi làm S4, S9, S12 hay P1 #9.
