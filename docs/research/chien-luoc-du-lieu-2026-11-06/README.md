# ForFish: báo cáo tổng hợp từ dữ liệu, đề xuất đã qua phản biện (06/11/2026)

> **Team 8 agent.** 5 agent nghiên cứu (r1–r5), 2 agent soạn đề xuất (p1, p2), 1 agent phản biện độc lập (c1). Phản biện có kiểm lại số then chốt trên SQLite S-Tracking và Supabase prod.
>
> **Phạm vi:** chỉ đọc. Không sửa repo, không ghi DB. Báo cáo không chứa SĐT, tên hay số tàu.

## ⚑ Quyết định của anh Long (06/11, sau khi đọc báo cáo)

> *"ko nhắn gì ngoài sdfish hết, mục tiêu bán trên sdfish thôi"*

- **Không gửi Zalo ZNS/OA, SMS hay bất kỳ tin nào ra ngoài app.** Mọi lời nhắc, cảnh báo và chào bán chỉ đi trong ForFish: thông báo đẩy, hộp thư, thẻ trên màn hình.
- **Bán ngay trên ForFish:** gia hạn cước, vật tư, premium. Luật đã chốt vẫn giữ: không thanh toán trong app, gia hạn đi qua luồng QR/CRM có sẵn.
- **Hệ quả:** nút thắt "tới tay" giờ phải giải bằng **số người cài app và bật thông báo**. Các mục ZNS/SMS bên dưới coi như đã bỏ; xem kế hoạch 30 ngày ở mục 4 (bản đã sửa). Rủi ro "nhắn tiếp thị cho 10.000 số chưa đồng ý" cũng hết theo, vì chỉ người đã vào app và bấm Đồng ý mới nhận tin.
- **Giữ gọi điện** (anh Long chốt 06/11): nhân viên gọi chăm sóc theo danh sách (S2, S5), mục tiêu là kéo khách vào app và gia hạn hoặc mua trên app. Đây là việc người làm, không phải tin nhắn tự động.

## 0. Năm sự thật từ dữ liệu

| # | Sự thật | Số | Nguồn |
|---|---|---|---|
| 1 | **Tiền thật nằm ở cước S-Tracking, không ở app** | 13.826 máy đang dùng, khoảng 64 tỷ/năm cước gộp (phần SDVICO hưởng chưa biết). 54% số máy hết hạn trong 90 ngày tới. 1.025 máy đã hết hạn | r2 |
| 2 | **Có "não", không có "miệng"** | App đã sinh 10.180 tin cảnh báo/nhắc nhưng chỉ 3/10.431 chủ tàu nhận được push. 0,87% chủ tàu từng mở app. 12.139 tài khoản nhập lô vẫn dùng mật khẩu mặc định | r2, r3, c1 |
| 3 | **Người dùng thật rất ít** | 522 SĐT từng đăng nhập; trong 30 ngày qua 222 người mở app. 182 premium do nhân viên gán tay, bảng `payments` = 0. Chợ, shop, việc làm, Kairos ≈ 0 dùng; Kairos có 683 "tác giả" là dữ liệu mồi | r3 |
| 4 | **Nỗi đau lớn nhất của bà con là phạt mất kết nối, không phải tìm cá** | Cục ghi 155 nghìn sự vụ, phạt 99 tỷ trong 10 tháng (trung bình khoảng 28 triệu/biên bản). Cục **gần như không báo được cho bà con**: SMS chỉ là giả lập, chỉ có 239 bản khai | r5 |
| 5 | **Dự báo cá chỉ chứng minh được "bãi mùa này"** | AUCeff 0,81. Cả 4 thí nghiệm "cá hôm nay" đều trượt. DataLake đóng băng từ 11/10 và là dữ liệu quản lý nhà nước: muốn dùng trong sản phẩm phải có văn bản của Cục | r1, r4 |

**Kết luận:** việc cần làm là **đưa đúng lời nhắc tới tay chủ tàu trước mốc phạt và trước ngày hết cước**. Cái này vừa là giá trị thật cho bà con, vừa là doanh thu thật cho SDVICO. Thuật toán cá mới hay tính năng mạng xã hội chưa phải ưu tiên.

## 1. Phản biện đã sửa những gì

- **Tỷ lệ "55% gia hạn đúng hạn" bỏ.** 42/63 lần gia hạn rơi vào cùng một lượt quét, nên tỷ lệ ra đâu đó từ 55% tới 90%. Thêm nữa 187/251 dòng lịch sử là dòng giả (lệch +1 ngày).
- **Con số "~1,3 tỷ/quý" bỏ.** Cước VMS là bắt buộc nên lời nhắc chủ yếu *dời ngày* gia hạn, không tạo thêm doanh thu. Đó lại là cước gộp; phần SDVICO hưởng (c) chưa biết.
- **"Lọc nhiễu nguồn ngoài" đã có sẵn** trong `muc-canh-bao.mjs`. Chỉ phần nhận ra SOS kẹt (24 máy, khoảng 55 lần/máy/ngày) là việc mới.
- **Đồng hồ mốc phạt phải miễn phí.** Không đặt sau gói trả phí: cảnh báo giúp tránh phạt 30–300 triệu mà khoá lại thì vừa trái luật đã chốt vừa rủi ro uy tín.
- **Nhóm đối chứng chỉ áp cho tin thương mại.** Tuyệt đối không giữ lại cảnh báo mất kết nối, SOS hay bão.
- **Rủi ro mới mà cả hai đề xuất bỏ sót:**
  - Chỉ 17/10.431 chủ tàu đã đồng ý điều khoản. Nhắn tiếp thị (đổi máy, vật tư, premium) cho 10.000 SĐT có thể vướng NĐ 13/2023 và NĐ 91/2020.
  - Hợp đồng đại lý Viettel có thể không cho dùng dữ liệu thuê bao để bán hàng.
  - Cam kết "SOS ≤15 phút" biến SDVICO thành bên chịu trách nhiệm cứu nạn.
  - Thu dữ liệu chỉ có một điểm (máy GPU cào cổng Viettel). Hỏng là nhắc dừng im lặng.

## 2. Trục 1: Thông minh, tính năng vượt trội, thuật toán (sau phản biện)

| Ưu tiên | Đề xuất | Bà con thấy gì | Thuật toán / cách đo | Phán quyết |
|---|---|---|---|---|
| 0 | **Nền đo** | không thấy | Lọc 187 dòng giả. Lưu lịch sử từng đợt mất kết nối (từ nay, không có thì về sau không có nhãn). Bảng sự kiện tối thiểu. Giám sát nhịp thu và báo khi máy GPU hoặc cổng hỏng | **Làm ngay** |
| 1 | **Đồng hồ mốc phạt** | Thẻ tàu: "Mất tín hiệu 3 giờ, còn khoảng X giờ tới mốc phạt (tham khảo)" | Mốc theo chiều dài tàu (≥24 m: +2 giờ, <24 m: +3 giờ, rồi chu kỳ 6 giờ + 1 giờ ân hạn; trong bờ 24 giờ; nấc 8 và 10 ngày). Nhắc ở giờ thứ 3 và thứ 5, vì quá 3 giờ thì 55% sẽ quá 6 giờ, quá 5 giờ thì 86% sẽ quá 9 giờ. Chạy thuần `lib`, offline từ T0 đã lưu, chống lệch giờ máy. Đo: % lời nhắc tới trước mốc, chỉ tính các đợt mới | **Giữ, miễn phí cho mọi người** |
| 2 | **Nguyên nhân + một nút xử lý** | "Có thể do: hết cước → Gia hạn" / "Chưa đồng bộ Tổng cục → Gọi SDVICO" | Trước mắt chỉ hai luật chắc chắn: **cước** và **đồng bộ TCTS** (1.636 máy, 109 máy ngoài khơi đang có sóng mà vẫn có thể bị tính mất kết nối). Nguồn điện, anten, mất sóng hoãn tới khi có nhãn từ cuộc gọi CSKH. **Cấm nhãn "tắt cố ý"** | **Sửa, thu hẹp** |
| 3 | **SOS nghi kẹt** | không thấy (nội bộ) | Cùng máy ≥N lần SOS/giờ thì gắn nhãn và chuyển CSKH gọi xác nhận. Không bao giờ tự đóng SOS, không cam kết thời gian | **Sửa** |
| 4 | **Hướng dẫn 14 ngày** | 4 bước: vai, cảng nhà (gợi ý từ máy giám sát), tải bản đồ offline, bật thông báo | Tối đa 1 lời nhắc/ngày. Chốt **một** chỉ tiêu: giữ chân 14 ngày từ 30% lên 40%, đối chứng 10% | **Giữ** (gộp với S8) |
| 5 | **Sen Biển hiểu đúng hơn** | Hỏi lại bằng 2 chip khi chưa chắc | Gắn nhãn lại 63 câu không hiểu, thêm khớp mờ, bộ kiểm vàng tách theo người nói. Không hiểu từ 40% xuống dưới 15% | **Giữ (nhỏ)** |
| 6 | **Trúng/Trượt** | Thẻ hỏi sau chuyến: "Bãi gợi ý có trúng không?" | Gắn với bản chụp dự báo lúc xuất bến. Tạo nhãn riêng của ForFish thay cho DataLake đã đóng băng. Không hỏi tiền | **Giữ (nhỏ)** |
| – | Kiểm máy / điểm rủi ro | | Gần với Checklist xuất bến đã gỡ | Hoãn, cần anh chốt |
| – | Nhắc vật tư theo ngày biển | | Chỉ 14 chủ thiết bị dùng app | Hoãn, làm bản CRM trước |
| – | Khoảng năng suất tàu cùng loại; bãi nhóm năng suất cao | | Cần văn bản DataLake, kể cả khi miễn phí | Hoãn / Bỏ |
| – | "Nhắn trạm" báo vị trí thay thế | | Không có giá trị pháp lý, bà con dễ tưởng đã khai hợp lệ | Hoãn |

**Không làm:** thêm thí nghiệm "cá hôm nay", dự báo nguồn cá về cảng / khớp bên mua (luật Giao dịch chặn), kg/lít dầu, ML khi lịch sử mới 1,5 ngày, đưa bản cào mkn-3 vào sản phẩm.

## 3. Trục 2: Kinh doanh, thuê bao, bán hàng, chăm sóc (sau phản biện)

**Phễu:** tới tay → kích hoạt → dùng → gia hạn → gia hạn dài → bán thêm. Hôm nay đứt ngay tầng **tới tay**.

| Ưu tiên | Sáng kiến | Cách làm | Phán quyết |
|---|---|---|---|
| 1 | **Kênh tới tay = chính ForFish** (đổi 06/11: không ZNS/SMS) | Thông báo đẩy tin cậy: hoàn thiện bản native (Capacitor) để push chạy được cả trên iOS, vì web push hiện chỉ tới 3/10.431 chủ tàu. Có hộp thư và chấm đỏ trong app. Có trần số tin/lượt, công tắc tắt khẩn, câu chữ "có thể". Đo: % chủ tàu đã cài app **và** bật thông báo | **Giữ, đổi kênh** |
| 2 | **Gia hạn chủ động trong app (S1)** | Thẻ "còn X ngày cước", nhắc ở các mốc 15/7/3/1/0 ngày. Nút **Gia hạn** mở QR theo luồng CRM 3 bước (không thanh toán trong app). Nhân viên gọi kéo lại 194 máy quá hạn ≤30 ngày về app. Đối chứng 10% | **Sửa** (doanh thu = × c) |
| 3 | **Danh sách gọi mỗi ngày (S2)** | ForFish tính điểm (giá trị cước × rủi ro × độ gấp); danh sách đổ vào CRM. **Ghi kết quả từng cuộc gọi**: đây là nhãn cho mọi mô hình về sau | **Giữ** |
| 4 | **Chủ nhiều tàu (S3)** | 1.667 chủ khoảng 4.300 máy; gọi trước 137 chủ có từ 5 máy. Gia hạn đồng loạt về cùng một ngày, kèm bảng "đội tàu của anh" | **Giữ** |
| 5 | **Chăm sóc kỹ thuật (S5)** | Phiếu từ tín hiệu máy, ưu tiên 109 máy ngoài khơi lỗi đồng bộ TCTS, sau đó SOS kẹt, pin, GPS. Hẹn sửa khi tàu cập bến | **Giữ** |
| 6 | **Làm hộ đơn tạm ngừng (S6)** | Tàu nằm bờ mất tín hiệu quá 48 giờ (hiện 152 máy). Cả ngành chỉ có 204 đơn tạm ngừng | **Giữ (thí điểm)** |
| 7 | **Kích hoạt tại chỗ (S8)** | Nhân viên lắp/gia hạn cài app ngay trên tàu (kênh duy nhất đã chứng minh: 200 đăng nhập/tuần). **Đổi mật khẩu mặc định sang OTP/link một chạm là việc bảo mật bắt buộc** | **Giữ** |
| 8 | **Premium tặng → dùng thử (S10)** | Chốt **một** giá (CRM bán 300k/12 tháng, docs ghi 500k/18 tháng). Cấp mới thì dùng thử 60 ngày | **Giữ** |
| – | Nhắc vật tư theo chu kỳ (S7) | Trước mắt chỉ nối hoặc gỡ 2 đơn catalog treo từ 28/08 | Sửa, sau khi có đồng ý tiếp thị |
| – | Gói "Bảo vệ kết nối" (S9) | Đồng hồ phạt miễn phí; gói chỉ thêm *dịch vụ người* (gọi, ưu tiên sửa) | Sửa |
| – | Đổi máy NĐ 41 (S4) | Cấm câu "bắt buộc nâng cấp" tới khi pháp chế xác nhận | Hoãn |
| – | Thưởng đại lý (S11), B2G với Cục (S12) | Xung đột lợi ích, chưa có số liệu | Hoãn |

**Ngừng để dồn lực:**
- Kairos dữ liệu mồi: ngừng **ngay**.
- Shop sàn và chợ tin tự đăng: ẩn, thay bằng nút "Đặt hàng SDVICO" vào CRM.
- Thí nghiệm cá theo ngày.
- Việc làm và vai mới (mới ra 03/11): chờ đủ 60 ngày dữ liệu rồi mới xét.
- Ngừng đếm lô 12.184 tài khoản nhập 05/11 là "người dùng".

## 4. Kế hoạch 30 ngày (Top 5)

1. **Dọn nền và chặn rủi ro:**
   - lọc dòng giả, giữ lịch sử đợt mất kết nối, bảng sự kiện;
   - giám sát nhịp thu S-Tracking;
   - OTP thay mật khẩu mặc định;
   - ngừng Kairos mồi.
2. **Đưa chủ tàu vào app và bật thông báo, thí điểm 1 tỉnh** (Bình Định 1.497 máy hoặc Quảng Ngãi 1.382). Không nhắn ra ngoài (quyết định 06/11). Gồm:
   - mã QR "Mở ForFish" dán trên máy, in trên phiếu gia hạn và hoá đơn;
   - nhân viên cài app ngay khi lắp hoặc gia hạn;
   - đăng nhập một chạm, rồi bước bật thông báo;
   - push đi qua bản native.

   Chỉ số: % chủ tàu tỉnh thí điểm đã cài app và bật thông báo.
3. **Đồng hồ mốc phạt miễn phí**, kèm hai luật nguyên nhân (cước, đồng bộ) trên thẻ tàu.
4. **Gọi chăm sóc theo danh sách:** 109 máy lỗi TCTS ngoài khơi, SOS kẹt, 194 máy quá hạn ≤30 ngày, 137 chủ có từ 5 máy. Ghi kết quả từng cuộc.
5. **Kích hoạt tại chỗ + hướng dẫn 14 ngày**, có đối chứng.

Ngày 31–90: tự động hoá đủ mốc nhắc gia hạn, đo lift so với đối chứng, mở rộng sang tỉnh thứ 2–4. Vật tư, đổi máy, B2G, mô hình ML chỉ làm sau khi có kết quả pháp chế và đủ nhãn.

## 5. Anh Long cần trả lời trước khi chi tiền

1. **SDVICO hưởng bao nhiêu trên mỗi đồng cước (c)?** Hợp đồng đại lý Viettel có cho dùng dữ liệu thuê bao để chăm sóc và bán hàng không?
2. ~~Căn cứ pháp lý để nhắn tin cho khoảng 10.000 SĐT chưa đồng ý là gì?~~ **Đã chốt 06/11: không nhắn ra ngoài app.** Còn một câu cần trả lời: ai chịu trách nhiệm khi app đẩy nhầm cảnh báo phạt?
3. **Ranh giới xung đột lợi ích, cần văn bản pháp chế:** có được in "giờ Cục chốt" không, có được nói "bắt buộc NĐ 41" không, có nhận SLA cho SOS không, có xin văn bản dùng DataLake không?
4. Luật "ngư dân chỉ trả cho dự báo cá" chỉ áp cho tính năng trong app, hay cho cả dịch vụ gắn thiết bị bán qua CRM?
5. Chốt một giá premium. Ai giữ danh sách gọi (CRM hay ForFish). Ngân sách cho 1–2 người gọi.

## Phụ lục: tài liệu gốc (cùng thư mục)
[r1-datalake](r1-datalake.md) · [r2-stracking](r2-stracking.md) · [r3-db-van-hanh](r3-db-van-hanh.md) · [r4-nang-luc-app](r4-nang-luc-app.md) · [r5-mkn3](r5-mkn3.md) · [p1-thong-minh](p1-thong-minh.md) · [p2-kinh-doanh](p2-kinh-doanh.md) · [c1-phan-bien](c1-phan-bien.md). Script đo để ngoài repo (scratchpad phiên 06/11).
