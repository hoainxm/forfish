# R2 — S-Tracking trong ForFish: số thật và cơ hội

Đo ngày 06/11/2026 (khoảng 16:30 giờ VN). Chỉ đọc. Không có SĐT, tên hay số tàu cá nhân, chỉ có số tổng hợp.
Nguồn: SQLite `~/.local/forlife/stracking/stracking.db` (mở `mode=ro`, script `an.py` / `an2.py` trong scratchpad) và Supabase prod `znzgugvfhgmiszqgjulk` (chỉ chạy SELECT).

> **Lưu ý về độ dài lịch sử**: kho mới có từ 05/11 09:12 (`lan_chay` 167 lượt, chạy được ~32 giờ). Cảnh báo cũ hơn trong kho chỉ là bản tồn Viettel trả về. Mọi tỷ lệ "lịch sử" bên dưới vì vậy là **ảnh chụp 1,5 ngày**, chưa phải xu hướng.

---

## 1. Số liệu

### 1.1 Thiết bị
| Chỉ số | Số | Cách đo |
|---|---|---|
| Tổng máy trong kho GPU | **15 853** | `select count(*) from thiet_bi` |
| Máy đã bỏ (luật `laMayDaBo`) | 2 027 (530 đổi tên DE/Thu/DELETE + 1 497 đứng >365 ngày và hết hạn) | luật trong `may-da-bo.mjs` chép sang Python |
| **Máy còn dùng** | **13 826** | phần còn lại |
| Có SĐT chủ tàu | 12 655 máy / **9 670 SĐT** | distinct `sdt_chu_tau` |
| Số máy mỗi chủ | 1 máy: 8 003 · 2: 1 198 · 3: 221 · 4: 111 · từ 5 máy: 137 | |
| Bản trên server (`stracking_thiet_bi`) | 14 563 máy / 10 431 SĐT chủ tàu | Supabase |

**Tỉnh** (lấy tiền tố biển số `ten_tau`, có 52 mã): BĐ 1 497 · QNg 1 382 · KG 1 239 · BTh 953 · NA 751 · CM 713 · BT 676 · BV 578 · TG 512 · TH 476 · QB 440 · không đọc được 1 050. Cột `nhom` có 9 259 giá trị khác nhau (phần lớn là tên người hoặc đại lý, ví dụ "BINH THUAN" 1 078), nên **không dùng được làm trục phân nhóm** nếu chưa làm sạch.

**Trong bờ / ngoài khơi**: trong bờ 8 835 (64%) · ngoài khơi 4 991.

**Đồng bộ Tổng cục Thủy sản**: thành công 12 190 · **thất bại 1 636 (11,8%)**. Trong số thất bại, 1 527 máy nằm bờ và **109 máy ngoài khơi**.

**Hạn cước** (máy còn dùng, mốc hôm nay):
| Nhóm | Số máy |
|---|---|
| Quá hạn 1–30 ngày | 194 |
| Quá hạn 31–90 ngày | 271 |
| Quá hạn 91–365 ngày | 477 |
| Quá hạn >365 ngày | 83 |
| **Còn hạn 0–30 ngày** | **2 294** |
| Còn hạn 31–60 ngày | 2 586 |
| Còn hạn 61–90 ngày | 2 625 |
| Còn hạn 91–180 ngày | 3 392 |
| Còn hạn >180 ngày | 828 |
| Không có ngày hạn | 1 076 |

Cộng lại: **1 025 máy đã hết hạn** và **7 505 máy hết hạn trong 90 ngày tới** (54% đội máy). Hạn dồn về mốc ngắn vì kỳ gia hạn phổ biến là 3 tháng.

**Đời máy** (lấy từ serial): M2019 6 646 · K2025 2 055 · D2026 2 035 · E2025 2 024 · D2019 1 015 · K2018 27. Riêng **M2019 + D2019 là 7 661 máy (55%)** thuộc diện "chắc chắn phải nâng cấp" theo NĐ 41/2026 (luật `DOI_PHAI_NANG_CAP` đang chạy).

**Lần cập nhật vị trí gần nhất**: <1 ngày 11 170 · 1–7 ngày 161 · 7–30 ngày 150 · 30–90 ngày 414 · 90–365 ngày 1 823 · >365 ngày 108. Như vậy **~2 300 máy còn hạn hoặc chưa bị loại nhưng đã im hơn 30 ngày**.

### 1.2 Gia hạn (`han_lich_su`)
- Có 251 dòng, nhưng **187 dòng chỉ lệch +1 ngày**, ghi cùng lúc 06/11 05:xx. Nhiều khả năng đây là lệch múi giờ/định dạng của nguồn, **không phải gia hạn thật**. Nên lọc ra hoặc sửa ở lúc thu.
- **Gia hạn thật (lệch ≥25 ngày): 63 lần trong ~1,5 ngày.** Kỳ hạn: 3 tháng 35 lần (56%) · 6 tháng 22 lần (35%) · 7 tháng 3 · khác 3.
- Lúc gia hạn so với hạn cũ: trước hạn >7 ngày 123 · trong 0–7 ngày trước hạn 107 · trễ 1–30 ngày 16 · trễ >30 ngày 4 (tính trên toàn bộ 251 dòng, kể cả dòng +1 ngày).
- Có 2 294 máy hết hạn trong 30 ngày, tức ~76 máy chạm hạn mỗi ngày. 63 gia hạn trong 1,5 ngày là khoảng ~42/ngày. Vậy **tỷ lệ gia hạn đúng hạn sơ bộ ~55%**, cần 4–8 tuần dữ liệu mới chốt được.
- Bảng `stracking_renewal_*` **không có trong DB ForFish**, mà nằm ở DB chung crm (`exueouggmbjtjvsvpfya`, xem contract). Phễu yêu cầu gia hạn từ app chưa đo được từ phía này.

### 1.3 Cảnh báo
Kho có 30 812 dòng, từ 4 391 IMEI. Server `stracking_canh_bao` có 28 534 dòng.

**24 giờ qua (theo loại, số dòng / số máy)**:
| Loại | Dòng | Máy |
|---|---|---|
| Không dùng nguồn ngoài | 22 036 | 1 597 |
| SOS | 1 329 | **24** |
| Pin dự phòng sắp hết | 1 300 | 122 |
| Vượt biên | 714 | 63 |
| Sắp vượt biên | 548 | 111 |
| Vùng chú ý đánh bắt | 245 | 34 |
| Mất GPS | 147 | 49 |

- Theo mức: Báo động chiếm ~95% dòng. Mức "Cảnh cáo" chỉ có ở pin, tắt máy, vùng, GPS.
- **Cảnh báo "nguồn ngoài" chiếm 78% dòng 7 ngày, trong đó 78% là tàu nằm bờ** (18 629 / 23 836). Đây là nhiễu, đúng như luật "bỏ" trong `muc-canh-bao.mjs`.
- **SOS: 24 máy bắn ~55 lần/máy/ngày.** Đây gần như chắc là nút kẹt hoặc máy lỗi, không phải nạn thật. Đáng lo ở chỗ báo động giả làm mất tác dụng của báo động thật.
- Theo giờ VN: đều quanh ~1 150–1 250 dòng/giờ, đỉnh 14–15 giờ (1 572–1 976), đáy 19 giờ (397, nghi lượt thu bị hụt). SOS/vượt biên cũng đều suốt đêm, nên **lượt khẩn ban đêm là cần thiết**.
- Phân tán: 10% máy nhiều cảnh báo nhất chỉ chiếm 15,6% dòng 7 ngày (1 996 IMEI).

### 1.4 Mất kết nối (server, cột 0087)
- **Đang mất tín hiệu: 214 máy** (62 ngoài khơi, 152 nằm bờ). Trung vị thời gian mất là **103 giờ (~4,3 ngày)**.
- Ngoài khơi: <6 giờ 3 · 6–24 giờ 10 · 1–3 ngày 5 · 3–7 ngày 20 · >7 ngày 24. Tức **59/62 máy đã qua mốc phạt 6 giờ**.
- Nằm bờ: <6 giờ 9 · 6–24 giờ 21 · 1–3 ngày 18 · 3–7 ngày 88 · >7 ngày 16. Tức **122/152 máy đã quá mốc 1 ngày**.
- Nhắc đã gửi (`da_nhac`): sắp tới 6 giờ 46 lần / 28 SĐT · quá 6 giờ 282 lần / 91 SĐT · bờ sắp 1 ngày 9 lần · bờ quá 1 ngày 124 lần / 101 SĐT. Phần lớn nhắc rơi vào lúc **đã quá mốc**, vì lượt đầu gặp sẵn một tồn đọng cũ.

### 1.5 Phủ tài khoản ForFish
| Chỉ số | Số |
|---|---|
| SĐT chủ tàu S-Tracking (server) | 10 431 |
| Có hàng `customers` | 10 431 (100%), nhưng **toàn bộ là tài khoản tạo sẵn ngày 05/11** (auth `nguon='s-tracking'`: 12 139) |
| Chủ tàu đã có tài khoản **tự lập từ trước 05/11** (khớp tiền tố email = SĐT) | **437 (4,2%)** |
| Đã từng mở app (PWA/web) | **91 (0,87%)** · mở trong 30 ngày 72 · trong 7 ngày 35 |
| Premium | 73 |
| Tài khoản tạo sẵn đã đăng nhập | 12 / 12 139 |
| Khớp qua `sdt_khac` | 1 |
| Tin trong hộp thư `system:stracking` | 10 180 tin tới 1 766 SĐT · **Web Push tới máy: 0** |

**Kết luận phủ**: về mặt kỹ thuật thì 100% chủ tàu đã "có tài khoản", nhưng mới **<1% thật sự dùng app**. Mọi lời nhắc hôm nay hầu như chưa tới tay ai. Đây là nút thắt số 1.

---

## 2. Cơ hội (xếp theo giá trị × khả thi)

### #1 Kênh đến tay: Zalo/SMS cho nhắc hạn và mất kết nối
- **Dữ liệu**: 10 180 tin trong hộp thư, 0 lượt push, 91/10 431 người từng mở app.
- **Cách làm**: gửi cùng nội dung `nhac-nho.mjs` qua Zalo ZNS hoặc SMS brandname SDVICO, kèm link mở app đăng nhập một chạm (magic link). Ưu tiên ba loại: quá 6 giờ ngoài khơi, cước còn ≤3 ngày, Tổng cục thất bại.
- **Rủi ro**: tốn phí mỗi tin, cần mẫu ZNS được duyệt, cần chặn spam (đã có `da_nhac`). Cần ghi đồng ý nhận tin (bảng `dong_y_dieu_khoan`).

### #2 Phễu gia hạn chủ động: 2 294 máy trong 30 ngày + 1 025 đã hết
- **Dữ liệu**: phân bố hạn ở trên; giá 385 000 đ/tháng (contract `price`); kỳ 3 tháng chiếm 56%.
- **Cỡ tiền**: (2 294 + 1 025) × 3 × 385 000 ≈ **3,8 tỷ đ cước gộp** trong một quý nếu gia hạn đủ. Cả đội 13 826 máy × 12 tháng ≈ **64 tỷ đ/năm cước gộp** (phần SDVICO hưởng phụ thuộc chiết khấu đại lý, chưa có số).
- **Cách làm**: nút "Gia hạn 3/6/12 tháng" ngay trên lời nhắc, có QR; bám tỷ lệ gia hạn theo nấc 15/7/3/1/0 ngày.
- **Rủi ro**: dữ liệu `han_lich_su` bị lệch +1 ngày, phải sửa trước khi đo. Phễu gia hạn nằm ở DB crm, cần một view đọc chung để đo được chuyển đổi.

### #3 Nâng cấp máy theo NĐ 41/2026: 7 661 máy đời M2019/D2019
- **Dữ liệu**: phân bố đời máy theo serial; luật `DOI_PHAI_NANG_CAP`.
- **Cách làm**: chiến dịch theo tỉnh (BĐ, QNg, KG, BTh trước), gói đổi máy cộng cước, trả góp, gắn với chương trình hỗ trợ của tỉnh. Lịch gọi xếp theo hạn cước gần nhất (đổi máy đúng lúc gia hạn).
- **Rủi ro**: căn cứ pháp lý về thời hạn bắt buộc cần luật sư xác nhận trước khi nói "phải". Giá máy chưa có trong dữ liệu.

### #4 Chẩn đoán "máy hỏng hay mất sóng" và bán dịch vụ kỹ thuật
- **Dữ liệu**: 24 máy SOS lặp ~55 lần/ngày; 122 máy pin dự phòng yếu; 49 máy mất GPS; 1 597 máy chạy không nguồn ngoài; ~2 300 máy im >30 ngày.
- **Cách làm**: luật thuần trong `lib/stracking/`: SOS > N lần/giờ ở cùng vị trí thì coi là nút kẹt; pin yếu lặp lại thì cần thay pin; mất GPS mà vẫn có kết nối thì kiểm anten; không nguồn ngoài khi đang ở khơi thì kiểm dây nguồn. Từ đó tạo "phiếu kỹ thuật" cho CSKH, kèm báo giá pin, anten, bảo dưỡng.
- **Rủi ro**: chẩn đoán sai sẽ gây mất lòng tin. Nên nói "có thể", và luôn để nhân viên gọi xác nhận.

### #5 Tránh phạt mất kết nối: rút ngắn từ "đã quá mốc" về "trước mốc"
- **Dữ liệu**: 59/62 máy ngoài khơi đang mất tín hiệu đã qua 6 giờ; trung vị 4,3 ngày; 282 nhắc "quá 6 giờ" so với 46 nhắc "sắp".
- **Cách làm**: luật đa nấc đã có. Phần còn thiếu là **gọi điện** cho máy ngoài khơi còn ≤1 giờ trước mốc, và gửi cho cả người thân/quản lý (kho có các cột này, cần đồng ý của chủ tàu).
- **Rủi ro**: liên hệ người thân là dữ liệu nhạy cảm, phải được chủ tàu đồng ý trước.

### #6 Sửa đồng bộ Tổng cục thất bại: 1 636 máy
- **Dữ liệu**: 1 527 nằm bờ, 109 ngoài khơi.
- **Cách làm**: CSKH xử lý theo lô (thường là sai hoặc thiếu hồ sơ tàu trên VNFishbase), ưu tiên 109 máy ngoài khơi. Đo tỷ lệ chuyển từ "Thất bại" sang "Thành công" theo ngày.
- **Rủi ro**: nguyên nhân có thể nằm ở phía Tổng cục, ngoài tầm SDVICO.

### #7 Chấm điểm rủi ro rời bỏ gia hạn
- **Đặc trưng có sẵn**: số ngày còn hạn, số lần tạm ngưng (7 698 máy có lịch sử `tam_ngung_tu`), số ngày im lặng, đời máy cũ, trong bờ hay ngoài khơi, số máy mỗi chủ, tỉnh, đã mở app chưa.
- **Cách làm**: bắt đầu bằng điểm luật cộng dồn (không cần ML), đủ 8 tuần nhãn gia hạn thì fit logistic. Dùng để chia: nhắc tự động / gọi CSKH / tặng ưu đãi.
- **Rủi ro**: nhãn hiện nhiễu (+1 ngày) và chỉ có 1,5 ngày lịch sử.

### #8 Lịch gọi chăm sóc mỗi ngày
- **Dữ liệu**: các mục #2, #4, #5, #6 gộp theo SĐT. Có 1 667 chủ có ≥2 máy (137 chủ từ 5 máy, thường là chủ đội tàu hoặc doanh nghiệp).
- **Cách làm**: danh sách ~50–80 cuộc gọi/ngày, xếp theo (giá trị cước × rủi ro × độ gấp). Chủ đội tàu được gọi riêng (một cuộc gọi chạm nhiều máy). Đổ vào hub CSKH.
- **Rủi ro**: trùng với luồng CSKH sẵn có của crm, cần thống nhất chủ sở hữu danh sách.

### #9 Kích hoạt app từ tệp 10 000 chủ tàu
- **Dữ liệu**: 12 139 tài khoản tạo sẵn, 12 đăng nhập; 437 chủ tàu tự lập tài khoản từ trước.
- **Cách làm**: dùng chính giá trị S-Tracking làm mồi ("xem máy giám sát của anh còn hạn bao lâu"). Nhân viên lắp hoặc gia hạn thì cài PWA tại chỗ; theo dõi phễu kích hoạt trên `customers.pwa_last_open_at`.
- **Rủi ro**: mật khẩu mặc định cho 12 139 tài khoản là rủi ro bảo mật, cần buộc đổi hoặc chuyển sang OTP.

### #10 Sen Biển đọc cảnh báo, có lọc nhiễu
- **Dữ liệu**: 78% dòng là "nguồn ngoài" khi nằm bờ.
- **Cách làm**: Sen Biển chỉ đọc mức khẩn/cao (luật `muc-canh-bao` đã có) và gộp thành câu "hôm nay 2 tàu ổn, 1 tàu cần kiểm pin".
- **Rủi ro**: vẫn chỉ có tác dụng với người đã mở app (<1%), nên phụ thuộc vào #1 và #9.

### #11 Dự báo máy sắp mất kết nối hoặc sắp hỏng
- **Đặc trưng**: chuỗi pin yếu → không nguồn ngoài → mất GPS → mất kết nối; đời máy; tuổi máy (đăng ký 2023–2026 chiếm phần lớn).
- **Cách làm**: cần ≥1–2 tháng chuỗi sự kiện. Lưu thêm lịch sử `mat_ket_noi_tu` / `co_lai_luc` theo đợt (hiện chỉ giữ đợt mới nhất).
- **Rủi ro**: dữ liệu chưa đủ; nếu không giữ lịch sử từ bây giờ thì sẽ không bao giờ đủ.

### #12 Báo cáo đội tàu cho doanh nghiệp/chủ nhiều tàu (gói trả phí)
- **Dữ liệu**: 137 chủ từ 5 máy; nhóm kiểu công ty trong cột `nhom`.
- **Cách làm**: bảng một trang gồm hạn, tín hiệu, cảnh báo theo tàu, xuất được PDF. Bán kèm premium.
- **Rủi ro**: nhỏ về số khách. Phải giữ cổng chỉ chủ tàu được xem.

---

## 3. Việc dữ liệu cần làm trước (rẻ, chặn mọi phân tích sau)
1. Lọc hoặc sửa các dòng `han_lich_su` lệch +1 ngày (187/251).
2. Giữ **lịch sử đợt mất kết nối** (bảng mới trong SQLite GPU), không chỉ đợt mới nhất.
3. Lập view đọc chung với `stracking_renewal_*` (DB crm) để đo phễu nhắc → yêu cầu → gia hạn.
4. Chuẩn hoá tỉnh từ biển số (1 050 máy không đọc được), bỏ dùng `nhom` làm trục phân nhóm.
5. Kiểm lỗ dữ liệu cảnh báo lúc 19 giờ (397 dòng so với ~1 150 dòng ở các giờ khác).
