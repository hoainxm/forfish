# R4 — Năng lực app ForFish: có gì, hứa gì, kiếm tiền ra sao, hở ở đâu

> Kiểm kê ngày 2026-11-06, chỉ đọc. Nguồn: CLAUDE.md, docs/app-map 01/06/10/13/14/16/17, docs/research 01/03/04/08, kien-truc-moi-4-khu-2026-10-20, ra-soat-sen-bien-kairos-2026-10-26, src/lib/tier.ts, data-route-rules.ts, git log 80 commit. Số dòng ghi theo file hiện tại.

**Nhịp phát triển 80 commit gần nhất**: khoảng 45% là S-Tracking (hạn cước, cảnh báo mất kết nối, NĐ 41 nâng cấp máy, SĐT phụ, Sen Biển đọc cảnh báo), 25% Hải đồ (tuyến, AIS, MOB, neo, CPA), phần còn lại là thí nghiệm dự báo cá (cả 4 thí nghiệm lớp ngày đều TRƯỢT), Kairos (luật NĐ 246) và vai tài khoản. Trọng tâm đã dịch từ "4 lời hứa" sang **dịch vụ thuê bao thiết bị (VMS) + hải đồ**.

---

## 1. Bản đồ tính năng: thật hay nửa vời

| Mảng | Đang có | Đánh giá |
|---|---|---|
| **Trục 1 — Đánh bắt** | Hải đồ tiếng Việt (1.558 tên rạn/địa danh TT 33/2024, Hoàng Sa/Trường Sa), số đo sâu từ Thông báo hàng hải (OCR 987 PDF), 106 trạm con nước, khu tránh trú bão, vùng cấm/bảo tồn, chất đáy; tin bão NCHMF + GDACS + áp thấp sớm; chế độ "Đang chạy" đọc to cảnh báo, chạy offline; dẫn đường né sóng ước lít dầu; AIS/radar CPA | **Giá trị thật, cao nhất app.** Moat chủ quyền + tiếng Việt + offline mà Windy/Navionics không có. Nhưng AIS, Mật độ tàu vẫn chỉ mở cho 1 SĐT (01:85, 17 §11) |
| **Dự báo cá (cái bán)** | Bãi cá theo mùa từ 155 nghìn chuyến eCDT × VMS, AUCeff 0,810 (01:83); "dấu hiệu hôm nay" từ vệ tinh | **Nửa vời về giá trị bán.** Phần đo được là *bãi theo mùa*, thứ thuyền trưởng lâu năm đã biết. Lớp ngày: vệ tinh/thời tiết 0/7, phù du 0/168, cổng trăng ngừ vằn TRƯỢT (commit 8e3b4b97, 683edd74, be576bc5). Chưa có vòng phản hồi "trúng/trượt" từ bà con |
| **Trục 2 — Bán cá** | Giá VASEP tuần + lịch sử, giá dầu DO, tin mua/bán `market_listings`, danh bạ đầu mối | **Mỏng.** Giá tuần ở Khánh Hoà, không phải giá cảng theo ngày. Tin cần mua của vựa vẫn là tin mẫu (01:155). Kế hoạch hồ sơ cảng / giá bà con báo / bên mua đăng ký (4-khu đợt 2, 5) **chưa có dòng code nào** (grep `price_reports`, `fish_buy_requests` = 0) |
| **Trục 3 — Vận hành** | Chợ vật tư đa người bán `/cho` (SDVICO là 1 gian), 11 sản phẩm SDVICO có trang chi tiết, nhắc bảo dưỡng, thẻ khuyến mãi | Hạ tầng sàn đủ, **thanh khoản chưa đo**. Không có thanh toán trong app (COD), gian ngoài SDVICO chưa thấy số liệu |
| **Trục 4 — Tuân thủ** | Tủ giấy tờ chụp ảnh tự điền (Gemma máy nhà), nhắc hạn 30/15/7/3/1/0 ngày qua push, Xuất trình offline, sổ thuyền viên CCCD, mốc eCDT theo Lmax | **Giá trị thật**, dùng hằng ngày. Cảnh báo thuyền viên chéo (premium) chưa apply prod (01:174) |
| **S-Tracking** | Hạn cước thật từ tài khoản đại lý Viettel (~16 nghìn máy), cảnh báo mất kết nối nhiều nấc trước mốc phạt, NĐ 41 nâng cấp máy, gia hạn 3 bước qua pipeline CRM, Sen Biển đọc tình trạng | **Đòn bẩy doanh thu mạnh nhất hiện có.** Đau thật (mất kết nối là phạt/nằm bờ), có tiền thật (cước), tần suất thật |
| **Sen Biển** | Trợ lý giọng nói chạy trong máy (zipformer 79 MB, n-gram 74 ý), hỏi đáp bản đồ, chào kèm giấy gấp, tuyên truyền NĐ 246 | Kỹ thuật tốt, **chưa đo đúng/sai** (ra-soat §1: "không đo được mình đúng hay sai") |
| **Kairos** | Dòng tin 5 báo AI tóm tắt, MXH (Hay, bình luận, @tên, Bến), tab Chính sách theo tỉnh (tra tên tàu trong danh sách hỗ trợ dầu), 2000 agent AI, bài Tài trợ, tư vấn bán hàng bằng Claude, đo CDP nội bộ | Lý do mở app ở bờ; **kênh bán hàng + CSKH duy nhất có đo**. Rủi ro niềm tin vì agent đóng vai người có đời tư (16:17) |
| **Vai + Việc làm** | 4 vai (Đi bạn/Chủ tàu/Thu mua/Đại lý), dock theo vai, tin tuyển + hồ sơ tìm tàu, liên hệ thẳng | Mới (03/11), **chưa có dữ liệu**. ~980 tài khoản: 510 suy ra chủ tàu, 470 chưa chọn (17:12) |

---

## 2. Mô hình doanh thu hiện tại

**Nguyên tắc chủ (4-khu:293)**: ngư dân không trả tiền cho khu nào ngoài dự báo cá. Người trả là đại lý vật tư, vựa/nhà máy, và SDVICO tự bán hàng. Không ôm hàng, không giữ tiền, không hoa hồng trên cá.

| Nguồn | Gói / đơn giá | Ai trả | Kênh | Trạng thái |
|---|---|---|---|---|
| **Premium "gói dự báo"** | **500k / 18 tháng** (4-khu:297); kỳ hạn chọn được 1 năm / 18 tháng (07:259, 10:55). Gồm: dự báo cá, lớp có nguồn cho bán (EMODnet, Allen, Copernicus, NOAA, ảnh vệ tinh), dẫn đường, thời tiết nhiều ngày (tier.ts:2-6, data-route-rules.ts:7-13). Từ 03/11 với Đi bạn/Thu mua/Đại lý: có gói mới thấy ô Bản đồ (17 §11) | Chủ tàu | Gán tay qua webhook SDWork hoặc `/quan-tri`, **app không có luồng thanh toán** (tier.ts:11-13); nhân viên ghi mã CK, SDWork đối chiếu (10 §0) | Đang có. Ước 3% × 28.548 tàu ≥15 m ≈ 430 triệu / 18 tháng, **chưa có cảng nào chứng minh tỷ lệ 3%** |
| **Gia hạn VMS / S-Tracking** | Kỳ 3/6/12 tháng, QR VietQR (01:178); đơn giá cước không ghi trong docs | Chủ tàu | Pipeline gia hạn chung crm-sdvico-40 (`origin='sdfish'`); anh Long là đại lý Viettel | Đang chạy, đây là **tiền thật năm đầu** (4-khu:302) |
| **Bán thiết bị SDVICO** | Sứ định vị GPS **300.000đ** (giá thường 500k); máy lọc dầu SF50 cơ **7,9 triệu**, SF300B điện **9,9 triệu** (14:161-172); 11 sản phẩm khác không niêm yết giá | Chủ tàu | Thẻ khuyến mãi (Trang chủ + Vật tư) ⇒ phiếu `sdvico_khach_hoi` ⇒ AI Assistant nhắn Zalo Quân; tư vấn trong bình luận Kairos bằng Claude ⇒ phiếu ⇒ Zalo KD (14:151-160); nút "Gọi SDVICO" vào hộp tư vấn SDWork (01:163) | Đang có |
| **Chợ vật tư** | Không phí, không hoa hồng | — | `/cho` | "Shop nổi bật" ~1 triệu/tháng/shop là **ước lượng, chưa build** (4-khu:299) |
| **Kairos Tài trợ** | Tự quản, 1 thẻ / 20 bài, link Shopee affiliate được (14:363-372) | Nhà tài trợ / affiliate | `/quan-tri` › Kairos › Tài trợ | Có hạ tầng, chưa thấy doanh thu |
| **Bên mua cá** | Gói "thấy lô" 300–500k/tháng/cảng: **ước lượng, chưa build** | Vựa/nhà máy | — | Chưa có |

**Ranh giới vận hành**: SDFish chỉ ghi nhận thao tác. Sổ tiền, thuê bao, chia doanh thu cho đại lý nằm ở SDWork; **không dựng trang dữ liệu SDWork trong SDFish** (10:74).

---

## 3. Quyết định đã chốt, đề xuất mới KHÔNG được vi phạm

**Sản phẩm và tiền**
1. Bản đồ miễn phí cho chủ tàu. Cái bán là dự báo cá + lớp có nguồn cho bán; thời tiết nhiều ngày đi kèm gói, không bán riêng (CLAUDE.md:78; tier.ts:20-27). Ba vai còn lại cần gói mới có Bản đồ (17:370).
2. Ngư dân chỉ trả cho dự báo cá; không giữ tiền, không hoa hồng trên cá, không cọc, không đặt mua cá (4-khu:16, 293).
3. Không thanh toán trong app; đơn vật tư COD, online-only (01:166).
4. SDVICO không có đặc quyền trong lõi sàn, cấm nhánh `if shop === SDVICO` (01:208).
5. App không phán "đi hay không đi": đã bỏ điểm 1–100 khỏi UI (01:91).
6. Dự báo cá chỉ trong vùng VMS được phép đánh bắt, không mời tàu tới vùng nhạy cảm (01:81).
7. Không hứa độ chính xác mà nguồn không đảm bảo (CLAUDE.md:127; 01 §5.3).

**Dữ liệu và nguồn**
8. **Không lấy dữ liệu DataLake** (eCDT, VMS, SC/CC) cho khu giao dịch; không đối chiếu bên mua với danh sách SC/CC (4-khu:16, 319). Kairos cũng không dùng DataLake (14:48).
9. Lớp "Mật độ tàu dự kiến": **tuyệt đối không ghi nguồn**, kể cả comment trong code phía app và file phát ra; có cổng test chặn (01:84).
10. Chủ quyền: Hoàng Sa, Trường Sa của Việt Nam, gọi "Biển Đông"; mô hình AI rớt bộ thử chủ quyền là loại (01:223-230; CLAUDE.md:94).
11. "Phi thương mại" không chặn lớp bản đồ miễn phí, chỉ chặn chỗ bán; copyleft GPL/ODbL và cấm "adapted" S-52 vẫn là cổng thật (CLAUDE.md:76-92).
12. Dữ liệu nằm trong repo, không đưa ra Blob/CDN ngoài (CLAUDE.md:72). Mọi file `public/data` phát ra là bản mã, cấm `fetch("/data/…")` trần (CLAUDE.md:104).
13. Vendor (OceanByte, SDWork) đi qua adapter, không hardcode (CLAUDE.md:115; 01 §5).

**Offline và UX**
14. Offline-first cho chủ tàu; mỗi commit phải trả lời 4 câu offline (CLAUDE.md:114). Không cache tin chợ, **không outbox** cho đặt hàng/đăng tin (01:69). Ba vai còn lại chỉ cần "mất sóng = câu + Thử lại" (17:46).
15. Nhãn nút/tab/chip ≤2 chữ, lấy từ `labels.ts`; REM không px; màu qua token (CLAUDE.md:38). Luật "to chữ cho dân biển" đã xoá, không thêm lại.
16. eCDT/NKKT ngoài phạm vi: chỉ nhắc mốc, không khai hộ, không tích hợp hệ thống nhà nước (01:214).

**AI và Kairos**
17. Agent có chấm "AI"; không nhắn riêng, không báo xấu; gợi ý sản phẩm ≤6/ngày, không nhận đã dùng, không chê hàng khác (16:15-21).
18. Quảng cáo Kairos: không SDK, không nhắm theo người đọc, nhãn "Tài trợ" bắt buộc; chỉ SDVICO đăng tài trợ (14:363-372).
19. Bot tư vấn không hỏi SĐT, không báo giá, không link (14:155).
20. Việc làm: liên hệ thẳng Gọi/Zalo, không nhắn trong app, không thu phí đăng tin (17:165).

---

## 4. Ý tưởng đã bị loại hoặc xoá (đừng đề xuất lại)

| Ý tưởng | Khi nào | Lý do / nguồn |
|---|---|---|
| Sổ lãi lỗ, báo cáo năm, tính chuyến, chia tiền, công nợ nậu | 2026-07-27 | User chốt: /tien gọn về mua–bán, không ôm kế toán chuyến (CLAUDE.md:12; 01:218). *Dù 06 §4 từng gọi đây là "khoảng trống vàng"* |
| Sổ ứng tiền + máy chia tiền thuyền viên | 2026-07-27 | Sổ thuyền viên chỉ còn định danh + giấy tờ (01:176) |
| Tab Mức phạt NĐ 38 + Checklist xuất bến | 2026-07-27 | User không cần; file giữ, gỡ khỏi tab (CLAUDE.md:14) |
| Điểm đi biển 1–100 + lời khuyên ra khơi | 2026-06-10 | Không dạy đời thuyền trưởng (01:91) |
| Lớp "ngày nào ra đánh được" theo nghề | 2026-07-26 | "Họ đi họ tự có chọn" (01:92) |
| Heatmap teaser dự báo cá cho tài khoản thường | 2026-07-26 | Khoá hẳn, không mồi (01:87) |
| Khai hộ eCDT / wizard NKKT | 2026-06-10 | Hệ sinh thái đã có sản phẩm riêng (01:214) |
| Cache tin chợ, outbox gửi lại | 2026-08-17 | Dễ nói dối tin hết hiệu lực; từng mất dữ liệu ở đường ghi (01:69; ADR 0004) |
| Màn bản đồ bão riêng `/bao` | 2026-11-03 | Tin bão chữ ở trang chủ là đủ (17 §11.1) |
| Gói "thấy lô trước 2 giờ" cho bên mua | 2026-10-20 | Lô khớp loài × cảng cho mọi bên mua đã duyệt (4-khu:320) |
| Ô quảng cáo 1/8 bài + chip cá mờ "Gọi SDVICO" mỗi ngày | 2026-10-20 | Biến app thành tờ rơi, kích giấy phép MXH (4-khu §7) |
| Dời `/tau` → `/toi/tau`; outbox bài tin | 2026-10-20 | Gãy ~20 deep-link push; trái ADR 0004 (4-khu §7) |
| Cửa hàng SDVICO riêng | 2026-09-07 | Gộp vào chợ, SDVICO là 1 gian (ADR 0014) |
| Thuraya XT-Pro | 2026-09-24 | Không có trong tài liệu sản phẩm (01:165) |
| Độ mặn (SMOS/SMAP), tầng nhiệt | — | Nguồn nhiễu hoặc đã ngừng, không dùng dữ liệu cũ giả mới (01:99) |
| Model AI Ternary Bonsai | 2026-10-18 | Rớt bộ thử chủ quyền (01:227) |
| Ảnh bìa báo trong Kairos; "chấm độ người" cho agent (A12) | 2026-10-26 | Bản quyền ảnh; thao túng (ra-soat §5.2, §5.7) |
| Mạng quảng cáo/SDK, nhắm theo vị trí, Sen Biển tự giới thiệu sản phẩm | 2026-10-24 | 14:372 |

---

## 5. Mười khoảng trống chiến lược lớn nhất

1. **Sản phẩm bán duy nhất (dự báo cá) chưa chứng minh được giá trị trên mức kinh nghiệm.** Phần đo tốt là bãi theo mùa; mọi tín hiệu "hôm nay" đều trượt. Thiếu vòng phản hồi trúng/trượt sau chuyến để vừa đo, vừa tạo dữ liệu riêng, vừa làm bằng chứng bán hàng. Nếu không có vòng này, 500k/18 tháng rất khó bán lại lần hai.

2. **Gói premium được thiết kế quanh một thứ, trong khi đau và tiền thật nằm ở S-Tracking.** ~16 nghìn máy, cảnh báo mất kết nối trước mốc phạt, đợt nâng cấp NĐ 41: đây là lý do trả tiền rõ nhất, nhưng đang là dịch vụ lẻ chứ chưa phải một gói (ví dụ "gói yên tâm": VMS + cảnh báo + nhắc giấy + dự báo). Cần đóng gói mà không đụng luật "ngư dân chỉ trả cho dự báo cá", hoặc xin anh Long chốt lại luật này.

3. **Không có phễu thuê bao tự phục vụ.** Premium gán tay, không dùng thử, không nhắc hết hạn premium, không gia hạn một chạm, không đo tỷ lệ chuyển đổi. Ước 3% chưa có cảng nào xác nhận. (Giữ luật không thanh toán trong app thì vẫn làm được: QR + mã CK + duyệt nhân viên như VMS.)

4. **Mảng Bán cá (Trục 2) gần như trống**, trong khi đây là lời hứa "bán được đắt hơn". Hồ sơ cảng, giá bà con tự báo, bên mua đăng ký đã có thiết kế đầy đủ (4-khu đợt 2, 5) nhưng chưa build. Giá cảng theo ngày là tài sản chưa ai ở VN có (4-khu:302).

5. **Ba vai mới chưa có mô hình tiền.** Thu mua và đại lý là bên "có tiền" theo nguyên tắc chủ, nhưng gói của họ chỉ là "có ô Bản đồ" (17 §13 Q6). Shop nổi bật chưa build, gói bên mua chưa build.

6. **Chăm sóc khách vẫn bị động và nằm rải rác.** Bot tư vấn chỉ kích hoạt trong bình luận Kairos; CDP chỉ đo Kairos; thiếu vòng đời khách (chào mừng, kích hoạt tuần đầu, sắp hết hạn, khách bỏ app, bảo hành thiết bị đã mua). Dữ liệu SDWork đã đồng bộ ngược (sản phẩm đã mua, hạn bảo hành, cước) nhưng chưa thành lịch chăm sóc chủ động.

7. **Không có vai "người nhà trên bờ".** Nghiên cứu nói rõ mẫu "một người trẻ thao tác hộ" (06 §5.3) và chủ tàu ở nhà không biết tàu mất tín hiệu (03 §6.1). SĐT phụ (≤3 số) là bước đầu, nhưng chưa có vai theo dõi hộ, xem cảnh báo S-Tracking, gia hạn hộ. Đây cũng là người dễ trả tiền nhất.

8. **Trí thông minh chưa được đo, và còn treo rủi ro niềm tin AI.** Sen Biển chưa có bộ kiểm vàng; 2000 agent được phép kể đời tư bịa (16:17) trái khuyến nghị "persona = góc nhìn nghề" của ra-soat §5.2; bốn câu chốt đợt 1 vẫn chưa trả lời. Một vụ lộ "người quen trên Kairos là AI" có thể làm hỏng kênh bán hàng tốt nhất.

9. **Rủi ro pháp lý treo ngay trên món đang bán.** Thời tiết nhiều ngày Open-Meteo (điều khoản free non-commercial) được gộp vào gói trả phí; Luật Đo đạc bản đồ khi bán lớp; Google News; giấy phép Gemma; NĐ 246 thay NĐ 38 nên kho hỏi–đáp cần rà lại (ra-soat §5.7). Chưa có ý kiến luật sư cho cái nào.

10. **Phân phối và độ phủ.** Mới ~980 tài khoản so với 82 nghìn tàu; PWA khó cài với người ít rành công nghệ, iOS phải cài ra màn hình chính mới có push; bản native mới đang dựng (`native/` chưa commit). Cửa sổ 18 tháng e-logbook đưa ~43 nghìn tàu lên smartphone (4-khu:57) đang trôi qua; đối thủ thật là Zalo và VNPT/Viettel gộp tiện ích vào eCDT/VMS (4-khu §2.4).

*(Thêm: AIS + Mật độ tàu, hai lớp "wow" nhất, vẫn chỉ mở cho 1 SĐT; cảnh báo thuyền viên chéo chưa apply prod. Cả hai là tính năng đã xây xong nhưng chưa tạo giá trị.)*
