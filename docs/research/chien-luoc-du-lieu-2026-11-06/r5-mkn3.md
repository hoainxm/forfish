# R5 — mkn-3 (VMS Alert, hệ thông báo mất kết nối) × ForFish S-Tracking

*Phân tích 06/11/2026. Chỉ đọc: repo `C:\Code\SDVico\mkn-3` (HEAD `2fa7a4ce`) và bản cào API ngày 17/10/2026 trên máy GPU (`~/cao-api/api-dump/*.ndjson`). Không mở CSDL nào, không chạm prod. Số liệu dưới đây chỉ là đếm tổng hợp, không có SĐT, tên hay số đăng ký.*

## 1. Tóm tắt

- mkn-3 là hệ **VMS Alert** của Cục Thủy sản (máy chủ `cbvms.tongcucthuysan.gov.vn`), do SDVICO làm. Nó **không tự phát hiện** mất kết nối: VMS đẩy gói `ALERT`/`POSITION` sang, mkn-3 chiếu thành sự vụ, tự chuyển loại theo giờ, sinh kỳ báo vị trí, tự chốt vi phạm, rồi nối biên bản XPHC vào.
- **Cục gần như không báo được cho bà con.** Bộ gửi SMS chỉ là giả lập (`sms.sender.ts` ghi log rồi báo thành công). Không có Zalo. Thứ duy nhất gửi đi thật là Web Push/FCM vào app chủ tàu. Trong 155.080 sự vụ chỉ có **239 bản khai, 100% do cán bộ nhập tay**, không bản nào chủ tàu tự gửi.
- ForFish đang đọc S-Tracking 15 phút một lần và nhắc trước mốc phạt. Nó **đã báo sớm hơn đồng hồ của Cục khoảng 3–5 giờ**. Chỗ thiếu: bà con chỉ được nhắc mà chưa có cách "báo vị trí thay thế" để gỡ vi phạm.

## 2. mkn-3 là gì

Năm dự án con:
- `api-ingest`: nhận gói VMS, eCDT, VNF, KSTC, Biên phòng, XPHC, ghi nguyên văn vào `data_raw`.
- `ingest-projector`: chiếu sang `alert`, `trip`, `vessel_position`; khép sự vụ theo vị trí, cập bến hoặc gói `RECONNECT`.
- `be-core`: sự vụ, kỳ khai báo, xử phạt, báo cáo, thông báo, bộ hẹn giờ.
- `fe-admin`: màn cán bộ Cục, Chi cục, Cảng, đồn Biên phòng.
- `app-owner`: PWA chủ tàu, có khai báo vị trí với hàng đợi ngoại tuyến và Web Push.

Lược đồ 33 bảng (thẩm quyền: `01-schema.sql`). Bảng `alert` có hai trục: trục nguồn do máy quyết (`opened_at`/`closed_at`), trục hành chính do cán bộ quyết (`admin_state` DETECTED → VERIFYING → PENALTY_PENDING → CLOSED, kèm `admin_result`), và ba phiếu vùng (`vms_zone`, `trip_zone`, `position_zone`). Kèm theo là `alert_rule`, `alert_report_window`, `alert_penalty_link`, `vessel_device` + `device_provider` (VNPT, **Viettel S-Tracking**, Vishipel, Zunibal, Thuraya, Bình Anh), `notify_channel`, `notification_delivery`.

## 3. Luật phát hiện và leo thang (đọc từ mã)

**Mốc xảy ra** (`alert.opened_at`, đổi nghĩa từ 22/09/2026) = vị trí cuối + **2 giờ với tàu ≥ 24 m, + 3 giờ với tàu < 24 m** (chu kỳ phát theo luật). Theo NĐ 41/2026, thời điểm mất tín hiệu là lúc VMS không nhận được tín hiệu của chu kỳ tiếp theo.

| Loại | Chuyển sang | Nghĩa vụ | Vi phạm khi |
|---|---|---|---|
| `MKN` (cảnh báo, < 6 giờ) | sau 6 giờ → `MKN_6H` | báo vị trí 6 giờ/lần tính từ `opened_at` | kỳ 1 kết thúc đúng lúc lên `MKN_6H`, nên giai đoạn này không tự sinh vi phạm |
| `MKN_6H` | sau 240 giờ → `MKN_10D`; bậc nhắc sớm `DAY_8` ở giờ 192 | báo vị trí 6 giờ/lần | một kỳ lỡ là một vi phạm; chốt sau window_end **+60 phút**; khai bù trong **300 phút** thì gỡ (`REPORTED_LATE`); trần 240 giờ |
| `MKN_10D` | cuối chuỗi | **đưa tàu về bờ** | quá `deadline_at` mà chưa khép; bật cấm xuất bến |
| `MKN_INSHORE_PRE` (< 24 giờ) | sau 24 giờ → `MKN_INSHORE` | xác nhận vị trí neo đậu 24 giờ/lần | nhắc trước 12 giờ; không có ân hạn khai bù; **không có trần**, mỗi ngày là một vi phạm |
| `VMS_SUSPENDED` | — | báo vị trí neo đậu 7 ngày/lần | nhắc trước 1 ngày, ân hạn 1 ngày |
| `BORDER_NEAR` / `BORDER_CROSS` | — | quay đầu | không sinh kỳ; vượt ranh giới có hạn 45 phút và cấm xuất bến |

Sự vụ khép theo nguồn (`POSITION_RESUMED`, `IN_PORT`, `OWNER_DECLARED`, `MANUAL`). Máy tự kết thúc (`AUTO_NO_VIOLATION`) khi nguồn đã khép, không lỡ kỳ và tàu đã về.

**Người nhận và kênh.** Bộ hẹn giờ (mặc định tắt, `ENABLE_CRON`) gửi tin mở sự vụ, nhắc kỳ, kết quả duyệt tới chủ tàu/thuyền trưởng có `notify_channel`: FCM, WebPush, SMS (giả lập). Cán bộ thấy sự vụ theo phạm vi tỉnh, cảng, đồn. **Không có luồng nào báo cho nhà cung cấp thiết bị**; "lỗi NCC" (`PROVIDER_FAULT`) chỉ do cán bộ chọn tay.

**Pháp lý mkn-3 viện dẫn** (`fine-frames.ts`):
- **NĐ 41/2026** (nghĩa vụ): báo vị trí 6 giờ/lần trên biển, 24 giờ/lần ở bờ, 7 ngày/lần khi tạm ngừng; không khắc phục thì về bờ trong 10 ngày.
- **NĐ 246/2026** (phạt, hiệu lực 18/08/2026, thay NĐ 38/2024): Đ37 k1 (ở bờ, tạm ngừng) 1–3 triệu · Đ37 k4 (biển, 15–24 m) 30–40 triệu · Đ37 k7a (≥ 24 m) 100–300 triệu · Đ21 k2k (không về trong 10 ngày) 300–500 triệu · Đ5 k9: mất kết nối nhiều lần trong chuyến là tình tiết tăng nặng.
- Chỉ một khung (NĐ 38 Đ35 k3a, 20–30 triệu) đã có quyết định thật xác nhận; **các khung còn lại `confirmed: false`, chờ pháp chế**. mkn-3 không dẫn NĐ 26/2019 và 37/2024; ForFish dùng mốc lắp máy 19/05/2024 (NĐ 37), cần chốt NĐ 41 thay hai nghị định này tới đâu.

## 4. Số liệu thật (bản cào API prod 17/10/2026)

> Lưu ý: trước 08/2026 kho chỉ có sự vụ đã leo thang (`MKN_6H`, `MKN_INSHORE`...) chuyển từ hệ cũ. Họ cảnh báo (`MKN`, `MKN_INSHORE_PRE`, `BORDER_NEAR`) chỉ có từ 08/2026. Vì vậy chuỗi theo tháng không so trực tiếp được. Bản cào **không có trường nhà cung cấp thiết bị**, nên chưa tách được Viettel với hãng khác.

**Quy mô**
- 155.080 sự vụ, 19.670 tàu (18.295 tàu từng mất kết nối). 27.646 tàu trong danh mục: 91% dài 15–24 m, 9% từ 24 m trở lên.
- Theo loại: MKN 47.075 · MKN_INSHORE_PRE 45.447 · BORDER_NEAR 42.251 · MKN_INSHORE 13.854 · **MKN_6H 5.548** · BORDER_CROSS 568 · VMS_SUSPENDED 204 · **MKN_10D 133**.
- Theo tháng: tháng 1–7 khoảng 1,6–2,8 nghìn (chỉ loại đã leo thang); tháng 8: 29,1 nghìn; tháng 9: 86,8 nghìn; tháng 10 (tới ngày 17): 25,0 nghìn. `MKN_6H` khoảng 400–1.070 vụ/tháng.
- Tỉnh nhiều MKN biển (6h/10d) nhất: An Giang 1.240, Đồng Tháp 708, Vĩnh Long 684, Cà Mau 494, Ninh Bình 358, Thanh Hóa 311, Nghệ An 302 (tên tỉnh sau sáp nhập).

**Thời lượng mất kết nối** (từ vị trí cuối tới lúc có lại)
- `MKN` (chưa đủ 6 giờ): trung vị 1 giờ, p90 3 giờ. **98,8% tự có lại trong 6 giờ.**
- `MKN_6H`: trung vị 22 giờ, p75 56 giờ, p90 103 giờ. 53% có lại trong 24 giờ.
- `MKN_10D`: trung vị 371 giờ (15 ngày).
- `MKN_INSHORE`: trung vị **330 giờ**; **65% kéo dài quá 10 ngày**. Đây thực chất là tàu nằm bờ tắt máy mà không làm thủ tục tạm ngừng.
- Xác suất có điều kiện, ngoài khơi: đã mất quá 3 giờ thì **55%** sẽ quá 6 giờ; quá 5 giờ thì **86%** sẽ quá 9 giờ; quá 48 giờ thì 13% sẽ quá 10 ngày.
- Xác suất có điều kiện, ở bờ: đã quá 24 giờ thì 68% sẽ quá 10 ngày.
- Mất kết nối hay bắt đầu vào **17–23 giờ** (đỉnh 19 giờ, gấp khoảng 2 lần trung bình giờ), thấp nhất 3–6 giờ sáng. Phù hợp với việc tắt máy hoặc nguồn khi neo đêm hay về bến.

**Tự khôi phục và tái diễn**
- 97,7% sự vụ họ MKN khép bằng `POSITION_RESUMED`. Chỉ 27 sự vụ khép bằng `OWNER_DECLARED`. 2.426 còn mở, phần lớn là `MKN_INSHORE`.
- Tái diễn: 2.057 tàu có từ 10 sự vụ MKN trở lên. **10% số tàu chiếm 60,6% số sự vụ MKN.**

**Khai báo và xử phạt**
- `MKN_6H`: 5.542 trên 5.548 sự vụ (99,9%) không có kỳ nào được khai; 5.039 sự vụ có kỳ lỡ (tổng 31.299 kỳ lỡ).
- `MKN_INSHORE`: 463.657 kỳ lỡ, trung bình khoảng 33 kỳ mỗi sự vụ, tức hàng chục vi phạm tiềm năng cho mỗi tàu nằm bờ.
- Trạng thái hành chính: 95% đang `VERIFYING` (147.897), 4.851 không phạt, **2.275 đã phạt**, 6 chuyển hình sự.
- Kết quả theo loại:
  - `MKN_6H`: 584 bị phạt, 1.786 không vi phạm, 3 hình sự.
  - `MKN_INSHORE`: 564 bị phạt.
  - `MKN_10D`: 12 bị phạt, 2 hình sự.
- Biên bản XPHC: **3.510 biên bản (01–10/2026), tổng 99,35 tỷ đồng**, trung bình khoảng 28 triệu mỗi biên bản; 97% là phạt tiền, 3% cảnh cáo; **80% biên bản chưa nối được vào sự vụ**. Mỗi tháng khoảng 330–540 biên bản, 6–17 tỷ đồng.
- Ba phiếu vùng lệch nhau: 5.847 sự vụ VMS ghi "ngoài khơi" nhưng toạ độ nằm trong bờ; 965 ca ngược lại. Lệch kiểu này quyết định khung phạt 6 giờ hay 24 giờ.

## 5. Đối chiếu với ForFish S-Tracking

| Mặt | mkn-3 (Cục) | ForFish (0080–0087, `lib/stracking/`) |
|---|---|---|
| Nguồn | VMS trung tâm, mọi hãng | Cổng đại lý Viettel S-Tracking (Playwright trên máy GPU), khoảng 15,9 nghìn máy, chỉ Viettel |
| Nhịp | Theo gói VMS đẩy | Mất kết nối và cảnh báo 15 phút/lần; SOS và vượt biên 5 phút/lần; hồ sơ và hạn cước 4 lần/ngày |
| Mốc bắt đầu | Vị trí cuối + 2/3 giờ | `batDau` của báo cáo mất kết nối S-Tracking (≈ vị trí cuối) |
| Mốc phạt | Ngoài khơi: lỡ kỳ 6 giờ, chốt +1 giờ, gỡ được nếu khai bù trong 5 giờ ⇒ **sớm nhất khoảng 9–10 giờ sau vị trí cuối**. Ở bờ: khoảng 27 giờ | Ngoài khơi: 6 giờ kể từ lúc mất, báo khi còn 3 giờ và còn 1 giờ. Ở bờ: 24 giờ, báo khi còn 8 giờ và 3 giờ ⇒ **mốc của ForFish sớm hơn mốc Cục chốt 3–4 giờ**, an toàn |
| Kênh | FCM/WebPush; SMS giả lập; không Zalo | Hộp thư ForFish + Web Push; chỉ chủ tàu |
| Đồng bộ Tổng cục | Không biết máy "có sóng mà không về Cục" | `dong_bo_tcts = Thất bại` ⇒ nhắc. Đây là mất kết nối giả mà Cục vẫn phạt |
| Biện pháp gỡ | Bản khai vị trí (app-owner, cán bộ nhập) | **Chưa có**, chỉ dặn "báo vị trí bằng liên lạc khác" |
| Tạm ngừng VMS | Có đơn và kỳ 7 ngày | Đọc `tam_ngung_tu/den` để khỏi nhắc; chưa giúp làm đơn |
| Nguồn, GPS, SOS · hãng khác | Không · Có | Có · Không |

**Trùng nhau:** cùng tách bờ/khơi, cùng mốc 6 giờ/24 giờ, cùng khép khi có lại tín hiệu.

**ForFish thiếu:** mốc theo chiều dài tàu (+2/+3 giờ); mốc 10 ngày (phạt 300–500 triệu) và nấc 8 ngày; đường báo vị trí thay thế có bằng chứng; đếm số lần mất kết nối trong chuyến (Đ5 k9); biết Cục đã mở sự vụ hay phạt chưa.

**mkn-3 thiếu:** kênh tới tay bà con; tín hiệu sức khoẻ máy (nguồn ngoài, pin, GPS, đồng bộ TCTS); hạn cước (hết cước cũng gây mất kết nối); luồng "lỗi nhà cung cấp" có dữ liệu.

## 6. Cơ hội (8)

**1. Đồng hồ phạt chuẩn Cục trên thẻ tàu** (bà con)
- Dữ liệu: vị trí cuối, chiều dài tàu (`vessel.length_m` hoặc sổ tàu ForFish), vùng bờ/khơi, `alert_rule`.
- Cách làm: thuần `lib/`. Mốc = vị trí cuối + 2/3 giờ + 6 giờ, kèm ân hạn 1 giờ và cửa khai bù 5 giờ. Hiện "còn X giờ để báo vị trí". Thêm nấc 8 ngày và 10 ngày ("đưa tàu về trước …"), kèm số tiền theo khung NĐ 246 theo chiều dài.
- Rủi ro: khung phạt còn `confirmed: false`, cần ghi "tham khảo" (CLAUDE.md cấm hứa chắc). Giữ cách báo sớm hơn Cục.

**2. "Báo vị trí thay thế" ngay trong ForFish** (bà con, tránh phạt)
- Dữ liệu: toạ độ GPS điện thoại, giờ chụp, ảnh, SĐT. Khi ngoại tuyến thì xếp hàng đợi.
- Cách làm: nút "Báo vị trí tàu" tạo bản khai có dấu thời gian. Giai đoạn 1: soạn sẵn tin ICOM/SMS gửi trạm bờ hoặc Chi cục. Giai đoạn 2: nối API khai báo của mkn-3 (`/my/*` declaration, `windowSeq`), vì app-owner đã có sẵn hàng đợi ngoại tuyến.
- Rủi ro: chỉ có giá trị pháp lý khi Cục chấp nhận kênh này, phải ký với Cục (B2G). Ngoài khơi thường không có sóng di động, nên phải nói rõ hướng dẫn ICOM. Toạ độ là dữ liệu cá nhân, cần đồng ý.

**3. Gỡ "MKN nằm bờ": hướng dẫn và làm hộ đơn tạm ngừng VMS** (bà con và kinh doanh)
- Dữ liệu: `trong_bo` cộng mất kết nối quá 48 giờ (đã quá 48 giờ thì 79% sẽ quá 10 ngày), `tam_ngung_tu/den`.
- Cách làm: sau 48 giờ ở bờ, gợi ý "Tàu nghỉ dài? Làm đơn tạm ngừng để mỗi 7 ngày báo một lần thay vì mỗi ngày". SDVICO làm hộ thủ tục với Viettel và Chi cục.
- Lợi: mỗi tàu nằm bờ đang mang khoảng 33 kỳ lỡ; chỉ 204 đơn tạm ngừng trên khoảng 13,9 nghìn sự vụ ở bờ.
- Rủi ro: thấp. Đúng luật NĐ 41 (không khai thác từ 3 tháng). Không được hứa "tránh phạt" cho những ngày đã lỡ.

**4. Phân loại nguyên nhân: mất sóng, hỏng máy hay tắt cố ý** (thuật toán)
- Dữ liệu: cảnh báo S-Tracking trước lúc mất (không nguồn ngoài, pin yếu, mất GPS, tắt thiết bị), `dong_bo_tcts`, hạn cước, giờ trong ngày (đỉnh 17–23 giờ), vị trí cuối (xa bờ hay gần ranh giới), lịch sử tái diễn, AIS hoặc thời tiết (sóng, dông từ Open-Meteo đã có).
- Cách làm: luật trước (hết cước → "cước"; TCTS thất bại → "đồng bộ"; không nguồn ngoài rồi mất → "nguồn điện"; gần ranh giới rồi tắt → cờ rủi ro), sau đó cây quyết định với nhãn `admin_result` (`PROVIDER_FAULT`, `NO_VIOLATION`, `PENALIZED`) lấy từ mkn-3.
- Rủi ro: **không được gắn nhãn "tắt cố ý" cho bà con xem**, cũng không được bán cho cơ quan dưới dạng kết luận. Chỉ dùng để ưu tiên chăm sóc. Nhãn huấn luyện là dữ liệu nhà nước, cần thoả thuận.

**5. Dự báo mất kết nối theo vùng, thời tiết, nguồn điện** (thuật toán)
- Dữ liệu: lịch sử S-Tracking (SQLite trên GPU), sóng/gió, đời máy (M2019/D2019). Cách làm: điểm rủi ro mỗi máy trong 24 giờ tới, nhắc "kiểm ắc-quy, ăng-ten trước khi xuất bến". Rủi ro: thấp, chỉ là khuyến nghị.

**6. Chăm sóc chủ động: hàng việc kỹ thuật SDVICO** (kinh doanh)
- Dữ liệu: nhãn của cơ hội 4; 10% tàu chiếm 61% sự vụ; khoảng 7.700 máy phải nâng cấp theo NĐ 41; máy hết cước. Cách làm: danh sách gọi điện ưu tiên, hẹn kỹ thuật lúc tàu cập bến (dùng chân cảng eCDT), gói đổi máy hoặc trả góp. Rủi ro: tiếp thị cần đồng ý điều khoản (0083), không nhắn quá dày.

**7. Gói "Bảo vệ kết nối"** (kinh doanh, premium)
- Gồm đồng hồ phạt, báo vị trí thay thế, hỗ trợ kỹ thuật 24/7, ưu tiên sửa ở cảng. Mức phạt trung bình khoảng 28 triệu/biên bản làm mốc so sánh giá. Rủi ro: không bán dưới dạng "bảo hiểm phạt", không ngụ ý can thiệp được kết quả xử phạt.

**8. B2G với Cục/Chi cục: ForFish làm "kênh tới tay ngư dân" cho VMS Alert**
- Dữ liệu chiều về: sự vụ mở, kỳ đến hạn, cấm xuất bến của tàu đã liên kết.
- Dữ liệu chiều đi: bằng chứng gửi/đọc (`notification_delivery` DELIVERED/READ), bản khai, nhãn "lỗi NCC" kèm log máy.
- Cách làm: webhook hoặc API qua adapter (CLAUDE.md: không cứng hoá vendor). Bịt đúng lỗ hổng SMS giả lập và 0 bản khai tự gửi.
- Rủi ro: cao nhất về pháp lý và riêng tư.
  - Dữ liệu sự vụ là thông tin quản lý nhà nước, cần văn bản cho phép.
  - mkn-3 cấm đụng CSDL prod; bản cào API hiện có chỉ dùng phân tích nội bộ, **không đưa vào sản phẩm**.
  - Xung đột lợi ích: SDVICO vừa làm hệ của Cục, vừa bán máy và dịch vụ.
  - Phải có DPA và theo NĐ 13/2023.

## 7. Việc cần chốt

1. Pháp chế: khung phạt NĐ 246 (chỉ 1 khung đã xác nhận) và quan hệ giữa NĐ 41/2026 với NĐ 26/2019, NĐ 37/2024.
2. Anh Long: ForFish có nên tính mốc theo chiều dài (+2/+3 giờ) không, hay giữ báo sớm 6 giờ như hiện nay. Đề xuất: giữ báo sớm, và hiện thêm "giờ Cục chốt".
3. Thêm cột `provider_code` vào bản cào hoặc báo cáo mkn-3 để đo được tỷ lệ Viettel so với hãng khác. Hiện **chưa đo được**.
4. Với Cục: cổng SMS thật, hoặc chấp nhận ForFish là kênh khai báo.

*Nguồn:* mkn-3 `01-schema.sql`, `seed-data/catalog.js`, `penalty/fine-frames.ts`, `senders/sms.sender.ts`; ForFish 04 (0080–0087), runbook S-Tracking, `nhac-nho.mjs`; số liệu từ `~/cao-api/api-dump`, script `scratchpad/agg.py`.
