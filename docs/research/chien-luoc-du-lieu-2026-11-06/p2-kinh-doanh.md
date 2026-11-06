# P2 — Trục 2: Kinh doanh thông minh cho ForFish (tăng thuê bao · tăng bán · tăng chăm sóc)

> Soạn 06/11/2026 từ r1–r5. Chỉ là đề xuất, chưa sửa repo. Mọi số tiền là **cước gộp/doanh số**, chưa trừ chiết khấu; phần SDVICO hưởng ghi là biến **c** (chưa có số). Số "lịch sử" từ kho S-Tracking mới có **1,5 ngày** — mọi tỷ lệ gia hạn là sơ bộ.

## 1. Bức tranh tiền thật hôm nay

| Mảng | Số thật | Nguồn |
|---|---|---|
| Máy S-Tracking còn dùng | **13.826** máy / 9.670 SĐT chủ | r2 §1.1 |
| Cước gộp cả đội | 13.826 × 12 × 385.000đ ≈ **64 tỷ/năm** | r2 §2 #2 |
| Đã hết hạn | 1.025 máy (465 máy quá hạn ≤90 ngày) | r2 |
| Hết hạn trong 90 ngày | **7.505 máy (54%)**, riêng 30 ngày tới 2.294 (~76 máy/ngày) | r2 |
| Gia hạn thật | ~42/ngày ⇒ **~55% đúng hạn (sơ bộ)**; kỳ 3 tháng 56%, 6 tháng 35% | r2 §1.2 |
| Máy đời M2019/D2019 (diện NĐ 41) | **7.661 (55%)** | r2 |
| Chủ ≥2 máy | **1.667 chủ ≈ 4.300 máy**; 137 chủ từ 5 máy | r2 |
| Đồng bộ Tổng cục thất bại | 1.636 máy (109 ngoài khơi) | r2 |
| Chủ tàu từng mở app | **91 / 10.431 (0,87%)**; tài khoản tạo sẵn đăng nhập 12/12.139 | r2 §1.5 |
| Tin S-Tracking gửi đi | 10.180 tin vào hộp thư · **Web Push tới máy: 0** | r2, r3 |
| Premium | **182 gán tay, `payments` = 0, `premium_used` = 1**; bán thật 6–7 đơn × 300k qua CRM | r3 §1 |
| Đơn CRM | 20 đơn; đã giao 12 = 55 tr; trung vị ~1,9 tr; hàng chạy = lọc dầu, màng, dây anten, niêm phong, gói 12 tháng | r3 §3 |
| Khách thiết bị SDWork | 1.049 thiết bị / 495 chủ; vật tư 691 dòng / 328 chủ — **14 chủ dùng app** | r3 |
| Đơn catalog trong app | 2 đơn (3,65 tr) nằm "mới" từ 28/08, **không ai xử lý** | r3 |
| Phạt mất kết nối toàn ngành | 3.510 biên bản, **99,35 tỷ**, TB ~28 tr | r5 §4 |

**Đọc nhanh:** tiền thật nằm ở **cước S-Tracking + vật tư tiêu hao + đổi máy NĐ 41**, không phải ở premium hay chợ. App đã có sẵn "não" (hạn cước, mất kết nối trước mốc phạt, đời máy) nhưng **không có "miệng"**.

### Nút thắt số 1: KHÔNG CÓ KÊNH TỚI TAY
Lời nhắc đúng lúc đã sinh ra (10.180 tin) nhưng tới **0 máy**; 99% chủ tàu chưa mở app. Mọi sáng kiến bên dưới đều phụ thuộc vào việc tin đến được người — qua **Zalo ZNS/OA, SMS, điện thoại, nhân viên cảng**, không chờ bà con tự mở app. Nút thắt số 2 đi kèm: **không đo được phễu gia hạn** (bảng `stracking_renewal_*` ở DB crm, `han_lich_su` có 187/251 dòng lệch +1 ngày giả).

Bằng chứng kênh người làm được: tuần 26/10 nhân viên tạo tài khoản ⇒ **200 đăng nhập lần đầu/tuần** (gấp ~25 lần tuần thường) (r3 §1).

## 2. Phễu đề xuất

| Tầng | Chỉ số đo | Hôm nay | Mục tiêu 90 ngày | Căn cứ mục tiêu | Cách làm |
|---|---|---|---|---|---|
| **Tới tay** | % SĐT chủ tàu nhận ≥1 tin qua kênh thật (đã giao) | ~0% | **70%** của 9.670 | ZNS + SMS dự phòng phủ gần hết SĐT di động; còn lại gọi | ZNS mẫu CSKH (hạn cước, mất kết nối), SMS brandname khi ZNS lỗi, gọi cho nhóm gấp |
| **Kích hoạt** | % chủ tàu đăng nhập trong 14 ngày sau tin | 0,87% | **10% (~1.000 chủ)** | 100 đăng nhập/tuần × 13 tuần ≈ 1.300; tuần 26/10 đã đạt 200 | Link đăng nhập một chạm (thay mật khẩu mặc định), mồi bằng "máy của anh còn X ngày cước" |
| **Dùng** | % người mới còn dùng sau 14 ngày | 30% | **40%** | Người qua tháng đầu ở lại 57%; rơi nằm ở 2 tuần đầu | Onboarding 14 ngày: chọn vai, khai cảng, tải bản đồ offline, bật thông báo |
| **Trả tiền** | % máy gia hạn trước/đúng hạn (có nhóm đối chứng) | ~55% sơ bộ | **+10 điểm (~65%)** | 107/251 gia hạn đã rơi vào 0–7 ngày trước hạn ⇒ nhắc đúng nấc có tác dụng | Nhắc 15/7/3/1/0 ngày + QR + gọi |
| **Gia hạn dài** | % gia hạn kỳ ≥12 tháng | chưa đo (3 tháng 56%) | **+10 điểm** | Kỳ dài = ít điểm rơi | Kèm quyền lợi "Bảo vệ kết nối" cho kỳ 12 tháng (S9) |
| **Bán thêm** | Đơn vật tư lặp/tháng; đơn đổi máy NĐ 41; doanh số/chủ | 20 đơn/3 tuần | **+100 đơn/quý** | 495 chủ thiết bị × 20% | Nhắc vật tư theo chu kỳ (S7), đổi máy lúc gia hạn (S4) |

**Luật đo bắt buộc:** giữ **10% nhóm đối chứng** (không nhắn, chỉ để so) trong mọi chiến dịch nhắc. Không có nhóm này thì không biết +10 điểm là do mình hay do mùa.

## 3. Mười hai sáng kiến (xếp theo doanh thu × chi phí × tốc độ)

Giả định chung: kỳ gia hạn bình quân ≈ 0,56×3 + 0,35×6 + 0,09×7 ≈ **4,4 tháng ⇒ ~1,69 tr cước gộp/lần gia hạn**. Phí tin **z**đ/tin (cần báo giá ZNS/SMS — chưa có số).

| # | Sáng kiến | Doanh thu 90 ngày (gộp) | Chi phí | Tốc độ |
|---|---|---|---|---|
| S1 | Gia hạn chủ động + kéo lại máy hết hạn | **~1,3 tỷ** × c | thấp | nhanh |
| S2 | Danh sách việc chăm khách mỗi ngày | nhân của S1/S4/S5 | 1–2 người | nhanh |
| S3 | Chủ nhiều tàu: gia hạn đồng loạt + báo cáo đội tàu | giữ ~4.300 máy | thấp | nhanh |
| S4 | Đổi máy NĐ 41 ghép lúc gia hạn | **~200 × P** | trung bình | vừa |
| S5 | Chăm sóc kỹ thuật (TCTS, SOS kẹt, pin, nguồn) | dịch vụ + giữ khách | thấp | nhanh |
| S6 | Làm hộ đơn tạm ngừng VMS cho tàu nằm bờ | giữ khách (có thể giảm cước ngắn hạn) | thấp | nhanh |
| S7 | Nhắc vật tư theo chu kỳ → đơn lặp | **~190 tr** doanh số | thấp | vừa |
| S8 | Kích hoạt tại chỗ + onboarding 14 ngày | gián tiếp | trung bình | vừa |
| S9 | Gói "Bảo vệ kết nối" | n × G | trung bình | chậm (cần chốt luật) |
| S10 | Premium tặng → dùng thử | ≤ 9 tr (để đo) | rất thấp | nhanh |
| S11 | Đại lý / nhân viên cảng thưởng theo gia hạn | nhân của S1 | h/lần | vừa |
| S12 | B2G với Cục/Chi cục | V (chưa có số), 0 trong 90 ngày | cao | chậm |

**S1 — Gia hạn chủ động.** Nhắc theo nấc 15/7/3/1/0 ngày qua ZNS → SMS → gọi (máy ≤3 ngày). Kèm QR VietQR và mã CK sẵn (đúng luồng gia hạn 3 bước đang chạy ở CRM, không thanh toán trong app). Nhóm hết hạn ≤90 ngày (465 máy) gọi kéo lại.
- *Ước:* 2.294 máy/tháng chạm hạn × +10 điểm = ~229 máy/tháng × 1,69 tr ≈ **390 tr/tháng ≈ 1,16 tỷ/quý**; kéo lại 15% của 465 + 3% của 560 máy quá hạn lâu ≈ 85 máy × 1,69 tr ≈ **144 tr**. Tổng ~1,3 tỷ × c.
- *Giả định:* máy không gia hạn đúng hạn là mất hẳn hoặc chạy sang đại lý khác (chưa kiểm). Chi phí ≈ 9.670 SĐT × 4 tin × z.
- *Ai:* CSKH SDVICO; dev nối ZNS. *Đo:* tỷ lệ gia hạn nhóm nhắc vs đối chứng theo nấc. *Rủi ro:* nhắn dày thành spam (đã có `da_nhac`); ZNS chỉ cho nội dung CSKH, không quảng cáo; số liệu `han_lich_su` phải sửa trước.

**S2 — Danh sách việc mỗi ngày (lead scoring).** 50–80 cuộc gọi/ngày, xếp theo **giá trị cước × rủi ro × độ gấp**. Điểm luật cộng dồn: ngày còn hạn, đã im >30 ngày (~2.300 máy), số lần tạm ngừng, đời máy cũ, số máy/chủ, đã mở app chưa, TCTS thất bại. Đủ 8 tuần nhãn thì fit logistic.
- *Ai:* dev (luật thuần `lib/`, có test) + CSKH gọi. *Đo:* % cuộc gọi ra gia hạn/đơn; thời gian từ cờ đến gọi. *Rủi ro:* trùng luồng CSKH của crm-sdvico-40 — phải chốt **một chủ sở hữu danh sách** (đề xuất: danh sách đổ vào CRM, ForFish chỉ tính điểm).

**S3 — Chủ nhiều tàu.** 1.667 chủ ≈ 4.300 máy (~34% máy có SĐT): một cuộc gọi chạm nhiều máy. Đề xuất **gia hạn đồng loạt về cùng một ngày** + bảng một trang "đội tàu của anh" (hạn, tín hiệu, cảnh báo theo tàu). Bảng tặng kèm để giữ khách; bán riêng thì cần chốt luật (mục 5).
- *Ước:* chủ yếu là giữ doanh thu; 100 chủ chuyển kỳ 12 tháng ⇒ ~260 máy trả trước, bớt 2–3 điểm rơi/năm. *Đo:* tỷ lệ gia hạn nhóm ≥2 máy vs nhóm 1 máy. *Rủi ro:* chỉ chủ tàu xem được (cổng quyền).

**S4 — Đổi máy NĐ 41 lúc gia hạn.** Trong 7.505 máy chạm hạn 90 ngày, ~55% (≈4.100) là đời cũ. Chào **đổi máy + cước** đúng lúc gia hạn, trả góp, làm theo tỉnh đông máy trước (BĐ 1.497, QNg 1.382, KG 1.239, BTh 953).
- *Ước:* 5% của 4.100 ≈ **200 máy × P** (P = giá máy, chưa có số). *Ai:* KD + kỹ thuật cảng. *Đo:* đơn đổi máy/tháng, theo tỉnh. *Rủi ro:* **chưa được nói "bắt buộc"** khi pháp chế chưa xác nhận thời hạn NĐ 41; không dùng nỗi sợ phạt để ép.

**S5 — Chăm sóc kỹ thuật chủ động.** Phiếu kỹ thuật từ tín hiệu máy: 1.636 TCTS thất bại (ưu tiên 109 ngoài khơi), 24 máy SOS kẹt ~55 lần/ngày, 122 pin dự phòng yếu, 49 mất GPS, 1.597 chạy không nguồn ngoài. Báo giá pin/anten/bảo dưỡng; hẹn sửa lúc tàu cập bến.
- *Ước:* doanh số dịch vụ = số phiếu × giá dịch vụ (biến); lợi chính là tàu **không bị phạt "mất kết nối giả"** ⇒ gia hạn. *Đo:* TCTS Thất bại → Thành công/ngày; phiếu → đơn. *Rủi ro:* chẩn đoán sai mất lòng tin — luôn nói "có thể", nhân viên gọi xác nhận.

**S6 — Làm hộ đơn tạm ngừng VMS.** Tàu nằm bờ mất kết nối quá 48 giờ (79% sẽ quá 10 ngày; cả ngành chỉ 204 đơn tạm ngừng). Hiện 152 máy nằm bờ đang mất tín hiệu.
- *Ước:* giữ khách + phí dịch vụ F (biến). *Rủi ro:* tạm ngừng **có thể làm giảm cước ngắn hạn** — chấp nhận để đổi lấy khách không bỏ máy; không hứa gỡ phạt cho ngày đã lỡ.

**S7 — Nhắc vật tư theo chu kỳ → đơn lặp.** Lấy ngày mua từ SDWork (495 chủ thiết bị, 328 chủ vật tư); chu kỳ mặc định theo nghề × cỡ (tiên nghiệm tổng từ r1 #2, ghi "ước"). Nút "Đặt lại" đổ thẳng vào CRM. **Nối hoặc gỡ ngay** luồng đơn catalog (2 đơn treo 2 tháng).
- *Ước:* 20% × 495 ≈ 99 đơn × 1,9 tr ≈ **190 tr doanh số/quý**. *Đo:* đơn lặp/khách/quý. *Rủi ro:* chu kỳ đoán sai thì phiền; DataLake chỉ dùng số tổng (L2), cần văn bản cho phép dùng trong sản phẩm (r1 §5).

**S8 — Kích hoạt tại chỗ + onboarding 14 ngày.** Nhân viên lắp/gia hạn cài app ngay tại tàu (đã chứng minh 200/tuần). Thay **mật khẩu mặc định của 12.139 tài khoản** bằng OTP/link một chạm. Onboarding: chọn vai (91 premium chưa chọn), khai cảng, tải offline (mới 153/522 người sẵn sàng), bật thông báo.
- *Đo:* tầng Kích hoạt + Dùng ở mục 2. *Rủi ro:* thêm request mạng lúc mở app phải có timeout/offline (luật 4 câu offline).

**S9 — "Bảo vệ kết nối".** Đồng hồ phạt (mốc sớm hơn Cục 3–4 giờ, thêm nấc 8/10 ngày), gọi khi ngoài khơi còn ≤1 giờ, báo người nhà (cần đồng ý), ưu tiên sửa ở cảng. Đề xuất **giai đoạn 1 tặng kèm kỳ 12 tháng** (không thu thêm ⇒ không đụng luật), giai đoạn 2 mới cân nhắc giá G.
- *Ước:* đòn bẩy cho tầng "Gia hạn dài"; nếu bán: n × G (n gợi ý 200 tàu tái diễn). *Rủi ro:* không bán như "bảo hiểm phạt", không ngụ ý can thiệp kết quả xử phạt; khung NĐ 246 mới 1 khung xác nhận ⇒ ghi "tham khảo".

**S10 — Premium tặng → dùng thử.** 182 premium tặng 1 năm, 1 người dùng thật. Giữ nguyên quyền của người đã nhận tới hạn; **cấp mới = dùng thử 60 ngày**, nhắc trước hạn 7/3/0 ngày, gia hạn qua QR + nhân viên đối chiếu. Thêm log mở dự báo cá/lớp gói (hiện không đo được).
- *Ước:* nhỏ (10% × 182 × 300–500k ≤ 9 tr) — mục đích là **đo có ai chịu trả không**. *Rủi ro:* giá đang lệch (CRM 300k/12 tháng vs tài liệu 500k/18 tháng) — phải thống nhất.

**S11 — Đại lý / nhân viên cảng làm kênh.** Thưởng **h**đ cho mỗi lần gia hạn hoặc kích hoạt app có mã người giới thiệu (thưởng trên dịch vụ thiết bị, **không phải hoa hồng trên cá**). *Đo:* gia hạn theo mã. *Rủi ro:* chồng kênh với nhân viên SDVICO; cần bảng chia rõ ở SDWork.

**S12 — B2G: ForFish làm kênh tới tay cho VMS Alert.** mkn-3 không có SMS thật, 0 bản khai do chủ tàu tự gửi. 90 ngày chỉ làm: ý kiến pháp chế + thư đề xuất. *Rủi ro lớn nhất:* **xung đột lợi ích** — SDVICO vừa làm hệ của Cục vừa bán máy. Tường lửa: (1) **không** dùng bản cào mkn-3/DataLake cho danh sách bán hàng — chỉ dữ liệu đại lý S-Tracking của khách mình; (2) kênh mở cho mọi hãng thiết bị; (3) DPA theo NĐ 13/2023 + văn bản của Cục.

## 4. Lộ trình 30/60/90 ngày

**0–30 ngày — dựng "miệng" và thước đo**
- Sửa dòng `han_lich_su` lệch +1 ngày; view đọc chung `stracking_renewal_*`; bảng sự kiện tối thiểu (mở app, mở dự báo, bấm gia hạn).
- Đăng ký Zalo OA + duyệt mẫu ZNS (hạn cước, mất kết nối); SMS brandname dự phòng; ghi đồng ý nhận tin.
- OTP/link một chạm thay mật khẩu mặc định.
- Chạy tay S1 cho máy hết hạn trong 7 ngày + quá hạn ≤30 ngày (194 máy), có nhóm đối chứng.
- Danh sách gọi v1 (S2, luật); xử lý lô TCTS thất bại ngoài khơi (S5).
- Nối đơn catalog vào CRM; ẩn các tính năng ở mục 6.

**31–60 ngày — tự động hoá và bán thêm**
- S1 tự động đủ nấc 15/7/3/1/0; S3 gọi 137 chủ từ 5 máy trước.
- S4 đổi máy ở 4 tỉnh đầu; S7 nhắc vật tư cho 495 chủ thiết bị.
- S8 kích hoạt tại cảng + onboarding 14 ngày; S10 cho mọi premium cấp mới.
- S6 thí điểm ở 1 tỉnh.

**61–90 ngày — đo, giữ cái chạy, cắt cái không chạy**
- Đọc lift gia hạn vs đối chứng; mục tiêu +10 điểm. Đủ nhãn ⇒ điểm rủi ro logistic.
- S9 tặng kèm kỳ 12 tháng ở 1 tỉnh; S11 thí điểm 2–3 đại lý.
- S12: gửi thư đề xuất nếu pháp chế OK.
- Báo cáo một trang: doanh thu tăng × c, chi phí kênh, mở rộng hay không.

## 5. Quyết định anh Long cần chốt

1. **Luật "ngư dân chỉ trả cho dự báo cá"** áp cho tính năng *trong app*, hay cho mọi thứ? Đề xuất: giữ cho app; **dịch vụ gắn thiết bị** (cước, sửa, đổi máy, tạm ngừng, Bảo vệ kết nối) là SDVICO bán qua CRM/nhân viên. Nếu thu G cho S9 hoặc bán báo cáo đội tàu (S3) thì đó là **xin mở lại luật**, lý do: đau và tiền thật nằm ở kết nối, không ở dự báo cá (4 thí nghiệm lớp ngày đều trượt).
2. Ngân sách kênh: OA + ZNS + SMS (≈ 9.670 × 4 × z/quý) và 1–2 người gọi.
3. **Một giá premium** (300k/12 tháng hay 500k/18 tháng) và chuyển premium tặng → dùng thử 60 ngày.
4. Ai giữ danh sách gọi: CRM (đề xuất) hay ForFish.
5. Thưởng đại lý/nhân viên cảng **h**đ/lần gia hạn; chiết khấu **c** để tính lãi thật.
6. Có làm hộ đơn tạm ngừng (S6) dù có thể giảm cước ngắn hạn.
7. Có đi B2G không, và tường lửa xung đột lợi ích như S12.
8. Gửi pháp chế: thời hạn bắt buộc NĐ 41; khung phạt NĐ 246; quyền dùng dẫn xuất DataLake trong sản phẩm thu phí.
9. Chấp thuận danh sách ngừng ở mục 6.

## 6. Nên ngừng / bỏ để dồn lực (theo r3 §5 "Nên BỎ" + r4)

- **Shop sàn đa người bán + đơn sàn + yêu cầu báo giá** (1 đơn, đã huỷ) ⇒ thay bằng một nút "Đặt hàng SDVICO" vào CRM.
- **Chợ tin mua/bán tự đăng** (0 tin) ⇒ ẩn; giữ danh bạ 127 vựa/nhà máy.
- **Việc làm thuyền viên, tra cảnh báo chéo** (0 tin tuyển, 1 lượt tra) ⇒ ẩn.
- **Kairos dữ liệu mồi** (683 tác giả giả, 2 bình luận thật) ⇒ ngừng; bỏ đăng/bình luận/theo dõi phía người dùng; giữ tin luật/bão một chiều. Rủi ro uy tín đe doạ đúng kênh CSKH.
- **Thí nghiệm dự báo cá lớp ngày** ⇒ tạm dừng tới khi có toạ độ mẻ hoặc vòng phản hồi trúng/trượt.
- **Đơn catalog không ai xử lý** ⇒ nối CRM hoặc gỡ trong 30 ngày.
- **Ngừng đếm lô 12.184 tài khoản nhập 05/11 là "người dùng"** trong mọi báo cáo; chỉ đếm SĐT có đăng nhập.

## Assumptions
- 55% gia hạn đúng hạn và 1,69 tr/lần gia hạn là ước từ 1,5 ngày dữ liệu; chốt lại sau 4–8 tuần.
- Không có giá máy (P), chiết khấu (c), phí tin (z), thưởng (h), giá gói (G), phí dịch vụ (F), giá trị B2G (V) — để biến.
