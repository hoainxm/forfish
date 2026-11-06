# R3 — Hành vi người dùng + kinh doanh thật (DB prod `znzgugvfhgmiszqgjulk`, đo 2026-11-06)

> Chỉ SELECT. Không có SĐT/tên. "Người dùng thật" = SĐT có `device_tokens` (đã đăng nhập trên máy). Bảng `customers` không có cột tạo lúc → tăng trưởng đo bằng `profiles.created_at` và `min(device_tokens.created_at)`.

## 0. Cảnh báo đọc số (quan trọng nhất)

- **11.078 `customers` / 13.424 `profiles` là ẢO về hành vi**: ngày **2026-11-05 nhập lô 12.184 profiles** + 10.353 sổ `boats` (từ danh sách tàu giám sát hành trình). Trước đó cả 5 tháng chỉ ~1.240 profiles.
  `select created_at::date, count(*) from profiles where created_at>'2026-10-25' group by 1`
- **Kairos "bà con" cũng là dữ liệu mồi**: 830 bài `ba-con` của 683 tác giả, **chỉ 1 tác giả có đăng nhập** (2 bài thật). 1.821 bình luận / 1.090 tác giả → **2 bình luận thật**. 8.722 bài `bao` là tin báo cào tự động.
- `device_tokens` mới có từ 08/2026 → người dùng 06–07 không đo được.
- `last_used_at` của token có thể được làm mới nền → WAU/DAU dưới đây là **trần trên**; `customers.pwa_last_open_at/web_last_open_at` cho số thấp hơn (30 ngày: 222).

## 1. Tăng trưởng

| Tháng | profiles tạo | SĐT đăng nhập lần đầu |
|---|---|---|
| 06 | 631 | (chưa đo) |
| 07 | 70 | – |
| 08 | 87 | 55 |
| 09 | 94 | 78 |
| 10 | 281 | 254 |
| 11 (6 ngày) | 12.261 (lô nhập) | 135 |

Theo tuần (đăng nhập lần đầu): 08: 3–36/tuần · 09: 4–26 · đầu 10: 6–8 · **tuần 19/10: 35 · 26/10: 200 · 02/11: 129**. Bước nhảy cuối 10 trùng giai đoạn tài khoản do nhân viên tạo (`admin_activity_log`: `account.create` admin 127 + manager 53).
`select date_trunc('week',f), count(*) from (select customer_phone, min(created_at) f from device_tokens group by 1) x group by 1`

- **Tổng người dùng thật: 522 SĐT** (android ~322, ios ~207 tính cả trùng nhóm). 221 SĐT có token nhưng không có dòng `customers` (khách/vai khác hoặc lệch định dạng SĐT — nên soát).
- **Vai** (`customers.vai`): chủ tàu 10.734 (gần hết là lô nhập), ngư dân 24, trống 320. Trong 522 người thật: chủ tàu ~216, ngư dân 24, **premium chưa chọn vai 91**.
- **Tỉnh**: 9.597/9.640 chủ trong sổ tàu **trống tỉnh**. Trong số có tỉnh, Gia Lai (19), TP.HCM (6), Khánh Hòa (5) — gần như toàn bộ là người dùng thật đã tự khai. Không đo được theo cảng.
- **Premium**: 184 (182 thật), hạn trung vị **365 ngày**, 0 hết hạn trong 30 ngày tới. **193 lượt gán bởi 4 người** (nhân viên theo SĐT ~180 lượt, admin 7, `ai-assistant` 2). `payments` = **0 dòng** → premium hiện là **tặng/gán tay**, không phải bán qua app. Bán thật chỉ thấy qua CRM: **6–7 đơn "SDFish 12 tháng" × 300.000đ**.
  `select granted_by, action, date_trunc('week',created_at), count(*) from premium_grants group by 1,2,3`

## 2. Mức dùng

| Chỉ số | Số |
|---|---|
| DAU (token 24h) | 165 |
| WAU (7 ngày) | 284 |
| MAU (30 ngày) | 477 |
| Mở PWA/web 30 ngày (`customers`) | 222 |
| Máy sẵn sàng offline (`customer_devices.offline_ready_at`) | 216 máy / 153 người |
| Dữ liệu bản đồ còn hạn (`data_until>=today`) | 144 máy; dung lượng trung vị 68 MB |

**Retention thô**: người đăng nhập lần đầu >14 ngày trước: 175 → còn dùng 7 ngày qua **53 (30%)**; >30 ngày trước: 150 → còn dùng 14 ngày qua **86 (57%)**. Tức là ai qua được tháng đầu thì ở lại khá tốt; rơi mạnh nằm ở 2 tuần đầu.
`select count(*) filter (where f<now()-'30 days'::interval and lu>now()-'14 days'::interval) ... from (select customer_phone, min(created_at) f, max(last_used_at) lu from device_tokens group by 1) t`

**Tính năng được dùng (trên 522 người thật)**:

| Tính năng | Người dùng | Ghi chú |
|---|---|---|
| Hộp thư/tin hệ thống (`push_reads`) | 496 | 8.135 lượt đọc, 75 tin; chủ yếu tin bão + giấy tờ |
| Kairos xem bảng tin (`kairos_reads`) | 305 (179 trong 7 ngày) | 3.278 lượt hiện, chỉ **38 lượt mở bài**; dwell trung vị 41 s |
| Kairos đăng/bình luận/"hay" thật | **1 / 2 / 4** | |
| Kairos hồ sơ | 40 người thật / 2.042 | |
| Sổ tay tự ghi (tàu tự khai, giấy tờ, thuyền viên, bảo dưỡng, vật tư) | ~60 | documents 20, crew 9, maintenance 7, materials 4 |
| Sen Biển (`sen_bien_mau`, chỉ mẫu câu) | ~10 người, 157 câu, 3 tuần | **40% `khong_hieu`**; còn lại: hỏi cá 18, thời tiết 11, tìm món 9, dẫn đường 4, bão 3 |
| Chợ tin mua/bán (`market_listings`) | **0 tin** | |
| Shop sàn (`shops`/`market_orders`) | 1 shop, 25 SP (13 đang bán), **1 đơn — đã huỷ** | sold_count = 0 |
| Yêu cầu báo giá (`market_requests`) | 1 | |
| Đơn catalog trong app (`catalog_orders`) | 2 (3,65 tr, trạng thái "mới" từ 28/08 — chưa ai xử lý) | |
| Hỏi sản phẩm SDVICO (`sdvico_khach_hoi`, `sdvico_hoi_thoai`, `product_inquiries`) | **0 / 0 / 0** | |
| Hỗ trợ (`support_requests`) | 0 | |
| Việc làm (`job_posts` / `job_seekers`) | 0 / 6 | |
| Tra cảnh báo thuyền viên (`crew_reports`) | 1 | |
| Web push (`push_subscriptions`) | 17 máy | 10.181 tin `system:stracking` gửi **0 máy** |
| Đồng ý điều khoản | 108 người (đều phiên bản 05/11) | |

`select ct, count(*) from sen_bien_mau group by 1 order by 2 desc`

## 3. Thương mại

- **Đơn CRM (`crm_orders`, đồng bộ SDWork)**: 20 đơn, 16/10→06/11. Đã giao 12 đơn = **55 tr**; đang chuẩn bị 8 đơn = 1,11 tỷ, trong đó **1 đơn 1,07 tỷ** (ngoại lệ). Bỏ ngoại lệ: ~93 tr / 19 đơn, trung vị ~1,9 tr.
  `select status, count(*), sum(total_vnd) from crm_orders group by 1`
- **Hàng bán chạy (theo số dòng đơn)**: gói **SDFish 12 tháng** (7 đơn, 300k), **lọc dầu SF50 / túi lọc dầu / lõi lọc** (9 dòng, ~55 cái), màng lọc + phụ kiện máy lọc nước biển, dây anten GPS/SAT MarineStar, dây niêm phong Stracking, nhớt 15W40, thiết bị Thuraya, bơm/motor.
  → Nhu cầu thật = **vật tư tiêu hao định kỳ cho thiết bị đã lắp** (lọc, màng, dây, niêm phong) + gia hạn thuê bao.
- Chỉ **8/20 người mua CRM có dùng app**, 7 là premium. Kênh bán thật vẫn là nhân viên/CRM, không phải app.
- **Cơ sở khách thiết bị**: `devices` 1.049 thiết bị / 495 chủ, `supplies` 691 dòng / 328 chủ (từ SDWork) — **chỉ 14 chủ thiết bị đang dùng app** (khớp theo SĐT; có thể lệch định dạng — nên soát).
- **Danh bạ chỗ bán** (`sell_contacts`): 93 vựa, 34 nhà máy, 7 chợ — do staff nhập; không đo được lượt gọi.
- **Câu hỏi khách**: bảng khách hỏi = 0 → **không có tín hiệu nhu cầu từ app**. Tín hiệu duy nhất là Sen Biển: hỏi **cá ở đâu / thời tiết / bão / dẫn đường**.

## 4. Phễu đứt ở đâu

1. **Lô 10.000+ chủ tàu nhập 05/11 chưa ai đăng nhập** (30/9.597 chủ có tàu trống tỉnh dùng app). Đây là kho tiếp cận lớn nhất nhưng chưa có kênh kéo vào (web push gần 0, `contacted`=false cho cả 11.078, `staff_used`=false hết).
2. **2 tuần đầu**: chỉ 30% người >14 ngày còn dùng tuần này.
3. **Premium không dùng premium**: 182 premium, `premium_used=true` chỉ **1**; 175 đã đăng nhập, **59 dùng 7 ngày qua (32%)** — thấp hơn nhóm basic (chủ tàu basic ios 49/56, android 35/49 dùng 7 ngày). Premium tặng hạn 1 năm → không có động lực dùng, và chưa đo được việc mở dự báo cá (không có bảng log dùng tính năng premium).
4. **Tính năng xây mà ~0 người dùng**: chợ tin mua/bán (0), shop sàn + đơn sàn (1 đơn huỷ), yêu cầu báo giá (1), đơn catalog (2, không ai xử lý 2 tháng), phiếu khách hỏi SDVICO (0), hỗ trợ (0), việc làm (0 tin tuyển), tra cảnh báo thuyền viên (1), Kairos đăng/bình luận/theo dõi (≈0 thật, `kairos_follows`=0), giấy tờ/thuyền viên sổ tay (<30 người).
5. **Sen Biển**: 40% câu không hiểu → trải nghiệm hỏng ngay lần đầu.
6. **Đo lường mù**: không có bảng sự kiện (mở màn/dùng tính năng); `customers.created_at` không có; phone lệch giữa bảng (221 token không khớp `customers`).

## 5. Cơ hội (xếp theo tác động/công sức)

1. **Kích hoạt lô 10.000 chủ tàu giám sát hành trình** — tin SMS/Zalo/nhân viên gọi kèm 1 giá trị cụ thể: *"tàu anh mất tín hiệu từ X giờ, còn Y giờ trước mốc phạt"* (dữ liệu `stracking_*` đã có). Đây là móc mạnh nhất vì đụng chuyện bị phạt. Đo: % lô đăng nhập trong 14 ngày.
2. **Nhắc thay vật tư tự động → đơn lặp**: 328 chủ có `supplies`, 495 chủ có `devices`; hàng bán chạy là lọc/màng/dây. Tính chu kỳ thay theo ngày mua → nhắc trong app + nút "đặt lại" vào CRM. Đây là doanh thu lặp rõ nhất.
3. **Bán gia hạn thuê bao 300k trong app** (bảng `payments` đã có nhưng 0 dòng): chuyển premium "tặng 1 năm" thành **dùng thử 30–60 ngày** rồi gia hạn; gắn với dự báo cá + nhiều ngày thời tiết. Cần đo `premium_used` thật trước (log mở dự báo cá).
4. **Onboarding 14 ngày** cho người mới: chọn vai (91 premium chưa chọn), khai tỉnh/cảng (để cá nhân hoá bão/giá), tải bản đồ offline (mới 153/522 người sẵn sàng offline), bật thông báo.
5. **Sửa Sen Biển trước khi mở rộng**: lấy 63 câu `khong_hieu` làm tập luyện; ưu tiên 4 ý đang được hỏi (cá ở đâu, thời tiết, bão, đường đi). Mục tiêu <15% không hiểu.
6. **Kênh thông báo thật**: web push chỉ 17 máy → 10.181 tin giám sát không tới ai. Cần app native (đã có `native/` đang làm) hoặc Zalo OA để tin bão/mất tín hiệu đến tay.
7. **Chăm sóc khách có hệ thống**: cờ `contacted`/`staff_used`/`staff_guided` toàn false → dùng nó thành danh sách việc cho nhân viên (premium không mở app 14 ngày, chủ thiết bị chưa dùng app, đơn catalog chưa xử lý).
8. **Bảng sự kiện tối thiểu** (mở màn, mở dự báo, mở lớp premium, hỏi Sen Biển) — không có nó thì không trả lời được "premium có giá trị không".
9. **Kairos → kênh tuyên truyền một chiều**: 305 người có lướt nhưng 38 lượt mở bài, 0 tương tác thật. Giữ bảng tin chính thức + tin luật/bão (đang có người lướt), bỏ kỳ vọng mạng xã hội.
10. **Giá cá theo cảng từ bên mua đã xác minh**: danh bạ 127 vựa/nhà máy là tài sản; mời họ báo giá tuần thay vì chờ ngư dân đăng tin (chợ tin = 0).

**Nên BỎ / đơn giản hoá** (xây xong nhưng ~0 dùng, tốn bảo trì + làm rối dock):
- Shop sàn đa người bán + đơn sàn + yêu cầu báo giá + đánh giá SP → thay bằng **một nút "đặt hàng SDVICO"** đổ vào CRM (nơi đơn thật đang chạy).
- Chợ tin mua/bán ngư dân tự đăng (0 tin) → ẩn, thay bằng danh bạ + giá từ vựa.
- Việc làm thuyền viên, tra cảnh báo chéo thuyền viên → ẩn tới khi có nhu cầu.
- Kairos: bỏ follow/đăng bài/bình luận phía người dùng, **ngừng dữ liệu mồi bà con** (683 tác giả giả làm sai số đo và rủi ro uy tín).
- Đơn catalog trong app: hoặc nối vào CRM, hoặc gỡ — 2 đơn nằm "mới" 2 tháng là mất khách.
