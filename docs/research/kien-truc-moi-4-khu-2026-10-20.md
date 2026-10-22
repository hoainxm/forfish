# Kiến trúc mới ForFish — 4 khu (nghiên cứu 2026-10-20)

> Làm bởi team agent 11 người: 2 kiểm kê (code + hồ sơ sản phẩm), 4 nghiên cứu thị trường (thị trường chung, giao dịch cá, tin tức và pháp lý, vật tư và bản đồ), 3 kiến trúc sư viết 3 phương án độc lập (ngư dân trước · doanh thu trước · tái dùng trước), 2 giám khảo chấm chéo.
> Đề xuất: dock 4 mục **Bản đồ · Tin tức · Vật tư · Bán cá**, mở app là bản đồ; Tàu tôi xuống sheet tài khoản; Tin tức là bảng mới; Bán cá đặt lên bảng `market_listings` sẵn có; 3 migration 0065–0067; 6 đợt, mỗi đợt ≤2 tuần.
> Anh cần chốt: (1) lô cá đăng từ biển gửi kiểu gì khi mất sóng, (2) cảng thí điểm nào và ai là 5 người mua đầu tiên, (3) có mở bình luận bài bà con trước khi luật sư trả lời không. Đủ 8 câu ở mục 8.
> Cập nhật 2026-10-20 (vòng 2): khu Giao dịch cá tổ chức lại theo hồ sơ cảng, tham khảo luồng L99, không dùng dữ liệu DataLake.

## 1. Tóm tắt cho người bận

1. Việt Nam chưa có app nào **vì bà con**: eCDT, VMS, VNPT đều là nghĩa vụ hoặc thiết bị. Việc thật (chốt cá, xem bão, mua đồ) đang chạy trên Zalo/Facebook vô tổ chức.
2. Thế giới cũng chưa có app gộp bản đồ + tin + chợ + bán cá. Cái sống bền là **người mua trả phí, ngư dân miễn phí** (Abalobi); cái chết là tự ôm hàng (eFishery, Aruna).
3. Mở app là **bản đồ** — thứ duy nhất dùng mỗi ngày và khi mất sóng; đúng thói quen Windy.
4. Dock 4 mục, nhãn ≤2 chữ: Bản đồ `/ngu-truong` · Tin tức `/tin` · Vật tư `/cho` · Bán cá `/tien`. "Tàu tôi" rời dock, vào sheet "Tôi" sau nút tài khoản góc phải; route `/tau` `/nguoi` giữ nguyên nên ~20 deep-link push và chip Sen Biển không gãy.
5. Tin tức: một dòng tin, ba loại bài (nhà nước tự lên · báo tóm tắt chờ duyệt, tắt bình luận · bà con tự đăng). Chip: Tất cả · Cảng tôi · Bão. Thẻ "Giá hôm nay ở cảng X" nằm đầu dòng tin.
6. Giao dịch cá (vòng 2, 20/10): đơn vị gốc là **hồ sơ cảng** (cảng này hay về cá gì, tháng nào) khởi tạo từ nguồn công khai rồi bà con xác nhận 1 chạm; chủ tàu khai cảng nhà là mang đặc tính đó, thiếu thì lùi tỉnh → vùng. Giá hôm nay bà con tự báo ẩn danh + Lô sắp về. Không nút đặt mua, không cọc, không giữ tiền.
6b. **Bên mua** (nậu, vựa, nhà máy, tàu hậu cần) phải đăng ký tài khoản trong app (tái dùng luồng đăng ký + duyệt shop), SDVICO duyệt rồi mới đăng yêu cầu thu mua; khớp hai chiều loài × cảng × thời điểm cập bờ; SĐT chủ tàu chỉ lộ khi họ bật. **Không lấy dữ liệu DataLake** (eCDT, VMS, SC/CC) — chỉ tham khảo cách tổ chức luồng của L99. Ngư dân miễn phí; phí bên mua bàn sau đợt 5.
7. Vật tư giữ nguyên, thêm "Shop nổi bật" (vị trí đại lý trả phí, miễn phí quý đầu) và gợi món theo lịch bảo dưỡng.
8. Offline: mở app mất sóng vẫn ra bản đồ không chờ server; `/tin` và giá bà con vào cache SW (cùng một bản cho mọi người); lô cá là nháp có thẻ "Có 1 lô chờ đăng" khi bắt sóng.
9. Tiền năm đầu: gian hàng SDVICO + gia hạn VMS + Shop nổi bật; premium và gói người mua cá là lớp hai. Tin tức không quảng cáo để không kích giấy phép mạng xã hội sớm.
10. Rủi ro lớn nhất: (a) Zalo là đủ với đa số, (b) VNPT thêm thời tiết + giá cá vào eCDT, (c) Bán cá lạnh chợ nếu SDVICO không đứng cảng kéo 5 người mua đầu tiên.

## 2. Thị trường

### 2.1 Số có nguồn (xem 20/10/2026)

| Số | Giá trị | Nguồn |
|---|---|---|
| Tàu cá cả nước | 82.333 chiếc; ≥15 m ≈ 28.548; 6–15 m ≈ 53.734 | vasep.com.vn, danviet (hội nghị cảng cá 4/2025) |
| Tàu phải cài e-logbook 2026–2027 | ~43.000 tàu ≥12 m, lộ trình TT 81/2025 (≥24 m từ 1/7/2026; 15–24 m từ 1/9/2026; 12–15 m từ 1/1/2027) | baohatinh.vn, htv.vn |
| Tuân thủ eCDT tháng đầu | 19.806/80.346 tàu (24,65%) | KTSG 02/04/2026 |
| VMS giữ kết nối hằng ngày | ~60% dù >98% tàu ≥15 m đã lắp | nongnghiepmoitruong.vn d387149 |
| Sóng 4G trên biển | ≥95% diện tích trong 35 km từ bờ, có chỗ tới 100 km (Viettel, số 2020–2021) | infonet.vietnamnet.vn 137728 |
| Chi phí chuyến xa bờ | 200–250 triệu (Cà Mau); 500 triệu–1 tỷ (tàu lớn); dầu chiếm 2/3–80% | nhandan.vn 700871, bnews.vn 417026 |
| Tàu xa bờ phụ thuộc vốn nậu | ~80% (số cũ, chưa có số mới) | tienphong.vn 552526 |
| Giá nậu thấp hơn mặt bằng | tới 30% | vtv.vn 2016 |
| Abalobi (Nam Phi) | ~2 triệu USD/năm doanh thu, 1,67 triệu về tay ngư dân; ngư dân không mất phí niêm yết | adaptation-undp.org, dailymaverick |
| eFishery | khai 752 triệu USD, thật ~157 triệu; founder 9 năm tù | businesstoday.com.my 25/7/2026 |
| Aruna | cắt 18–40% nhân sự 2025 | undercurrentnews 12/3/2025 |
| Fishbrain | >14 triệu người dùng, Pro ~6 USD/tháng; người dùng bực vì khoá dần | venturebeat, seedrs |
| Starlink VN | bán chính thức 13/8/2026; chưa có gói tàu cá; tàu Cát Bà bị phạt 70 triệu vì dùng Starlink nước ngoài | vnexpress 5108545, 5057599 |
| Tóm tắt AI | Haiku 5.5: ~0,3 USD/tháng cho 50 bài/ngày | bảng giá claude-api |

Không tìm thấy: số ngư dân toàn quốc 2025; tỷ lệ smartphone/4G trên biển có khảo sát; app giá cá/chợ cá VN còn sống; app "Ngư dân số".

### 2.2 Đối thủ

**Việt Nam**: eCDT VN (bắt buộc, không lợi ích trực tiếp cho bà con), Viettel S-Tracking (app là phụ kiện thiết bị), Windy (gió sóng động, offline dự báo, không hải đồ tiếng Việt), Zalo/Facebook (đối thủ thật của Tin tức và Bán cá: miễn phí, quen tay, thương lái đã ở đó; nhưng không cấu trúc, không offline, nhóm dễ bị chiếm như nhóm FB lịch tàu Cồn Cỏ). Đấu giá Thọ Quang 2018 và Thuận An 2011 đều không bám rễ vì tập quán nậu.

**Thế giới**: Fishbrain (cộng đồng sống, không bán cá), Abalobi (bán cá, người mua trả phí, không dòng tin), Fisher Friend Ấn Độ (giá chợ + cảnh báo offline), Laut Nusantara Indonesia (giá cá tại cảng + chat), OurFish Philippines (công cụ cho **người thu mua** — đi qua nậu, khớp VN), Norges Råfisklag Na Uy (khai lô khi tàu ngoài khơi, sống nhờ luật + tổ chức ngư dân + bảo lãnh ngân hàng).

### 2.3 Khoảng trống ForFish chiếm được

1. App đầu tiên ở VN đặt bản đồ + tin + vật tư + bán cá vào một chỗ, và bắt buộc có nhánh đọc bản đã lưu — thứ Zalo không làm.
2. Hải đồ tiếng Việt có tên Hoàng Sa/Trường Sa, khu tránh trú, con nước, vùng cấm, đọc to khi chạy — Windy không có, Navionics tên nước ngoài và trả phí.
3. "Chào lô trước khi cập cảng" là việc bà con Phan Thiết **đã làm bằng tay qua Zalo** (SGGP 02/09/2025) — ForFish đỡ việc, không tạo thói quen mới.
4. Cá có giấy đang khan: nhà máy TP.HCM thiếu nguyên liệu có SC (DĐDN 20/09/2026) — tàu "sạch hồ sơ" bán được giá hơn, đây là đòn bẩy giá thật.
5. Cửa sổ 18 tháng: e-logbook kéo ~43.000 tàu lên smartphone; ForFish là app "còn lại" sau khai báo.

### 2.4 Ba rủi ro

1. **Zalo/Facebook là đủ** với đa số. ForFish chỉ thắng bằng thứ Zalo không làm (offline, giá tham khảo, bản đồ), không thắng bằng "có dòng tin".
2. **VNPT/Viettel gộp tiện ích vào eCDT/VMS**: eCDT bắt ghi nhật ký ngoài biển nên VNPT cũng buộc phải làm offline; một bản cập nhật thêm thời tiết + giá cá là đủ chặn. Lợi thế còn lại của ForFish là hải đồ chủ quyền tiếng Việt + giọng đọc + chợ vật tư có shop thật — những thứ cơ quan quản lý không có động cơ làm.
3. **Giao dịch cá thất bại vì tiền mặt, niềm tin và thuế**: nậu ứng vốn ~80% tàu, app không thay được dòng tiền đó; từ 10/2026 bà con sợ nhận chuyển khoản vì lộ doanh thu (NĐ 320/2025, Dân Việt 03/10/2026).

## 3. Phương án chọn

Nền là phương án **"tái dùng trước" (ky-thuat)**, ghép ý hay của hai bản kia. Điểm giám khảo (thang 10, tổng có trọng số):

| Phương án | GK1: ngư dân / tiền / khả thi / offline → tổng | GK2: ngư dân / tiền / khả thi / offline → tổng | Trung bình |
|---|---|---|---|
| ngu-dan (ngư dân trước) | 8 / 6 / 6 / 6 → **6,70** | 8 / 5 / 7 / 8 → **6,70** | 6,70 |
| doanh-thu (doanh thu trước) | 6 / 8 / 5 / 6 → **6,15** | 6 / 7,5 / 5,5 / 7 → **6,55** | 6,35 |
| ky-thuat (tái dùng trước) | 7 / 6 / 8 / 8 → **7,25** | 7 / 6 / 8,5 / 7 → **7,03** | **7,14** |

Cả hai giám khảo chọn ky-thuat: không mở đường ghi mới khi mất sóng (nháp thay outbox, đúng ADR 0004), không phụ thuộc server redirect để vào bản đồ, cache dòng tin đúng cửa SW có cổng test, ít bảng và ít route đổi nhất nên 1 người + agent làm được mà không gãy deep-link push bão.

Ghép từ **ngu-dan**: Bán cá rút về 3 chip Giá · Lô · Mối mua (bỏ "Cần mua" tới khi SDWork đổ tin thật); thẻ "Giá hôm nay ở cảng X" nằm đầu Tin tức nên làm Giá trước Tin tức; chip "Bão" trong Tin tức, tin bão ghim không bị đẩy khỏi 50 bài; lô cá có `client_ref` UNIQUE + thẻ "Có 1 lô chờ đăng" khi online (nửa-outbox, xem Q1); bộ lọc chủ quyền trong `tin-core.ts` có test chuỗi; cửa thoát đo được cho bình luận (<3% người mở có đăng/thích trong 30 ngày thì đóng bình luận, giữ đăng ảnh).

Ghép từ **doanh-thu**: "Shop nổi bật" là vị trí trả phí trong `/cho`, miễn phí một quý rồi thu; bảng đối chiếu chuyển khoản cho gói người mua cá ở `/quan-tri` (chép cơ chế premium); sheet Cảng gộp "đại lý SDVICO gần cảng" thành lead; giới hạn 3 bài/ngày/SĐT + nhật ký 2 năm; mốc dừng bằng tiền (doanh thu tháng ≥ chi Vercel + Supabase + Haiku); "mở cảng nào phải có người SDVICO đứng cảng đó" là điều kiện của đợt 5. **Không ghép**: ô quảng cáo trong dòng tin, chip Cá mờ "Gọi SDVICO", dời `/tau` sang `/toi/tau`.

### 3.1 Cấu trúc điều hướng

| # | Nhãn | Route | Vì sao |
|---|---|---|---|
| 1 (mở đầu) | Bản đồ | `/ngu-truong` | Dùng mỗi ngày, duy nhất dùng được khi mất sóng |
| 2 | Tin tức | `/tin` (mới) | Lý do mở app ở bờ: bão, cấm biển, giá hôm nay, chuyện tàu bạn |
| 3 | Vật tư | `/cho` | Đã lên prod, giữ nguyên |
| 4 | Bán cá | `/tien` (giữ route, đổi nhãn) | "Giao dịch cá" 3 chữ và lạ tai; bà con nói "bán cá" |

- **Mở đầu**: `/` thành trang mỏng `router.replace("/ngu-truong")`. Giữ cả `/` lẫn `/ngu-truong` trong `CRITICAL_SHELL` nên mất sóng vẫn ra bản đồ, không chờ server. Không dời `FishingMap` sang `/` vì ~20 deep-link trỏ `/ngu-truong`. `manifest.start_url` đổi về `/ngu-truong`.
- **4 khối trang chủ cũ đi đâu**: `StormBanner` đã có trên bản đồ · `TideHomeCard` đã là `tide-card` trong bản đồ · `InboxSection` thành dải ghim đầu Tin tức (đọc `lib/inbox.ts`, không bảng mới) · `UrgentStrip` (giấy tờ sắp hạn) thành dải mỏng trên bản đồ, dưới dải bão, chỉ hiện khi có việc; chuông sáng `cron/notify-docs` giữ nguyên.
- **Tàu tôi**: rời dock. Nút tài khoản góc phải (`hero-account.tsx`, có mặt mọi màn) mở sheet "Tôi": Tàu tôi (`/tau`) · Bạn thuyền (`/nguoi`) · Hộp thư · Gói premium (hạn + nút gọi SDVICO) · Đăng xuất. Route `/tau` `/nguoi` giữ nguyên làm trang thật; `dockActive()` trả `null` cho nhóm này. Đường lùi tường minh: nếu số lần mở tủ giấy tờ sụt mạnh sau đợt 1 thì trả Tàu tôi về dock (5 mục) — `dock-nav.ts` một chỗ nên đổi lại rẻ.
- **Sen Biển**: icon nổi như hiện tại, mọi khu; mở rộng intent "đăng lô", "đọc tin" ở đợt sau.
- **Premium**: không màn riêng; khoá tại chỗ như nay (lớp cá, >3 ngày, 3 công cụ). Giữ `tier.ts`.

Route cũ → mới (tất cả là redirect hoặc giữ, không xoá):

| Cũ | Mới | Cách |
|---|---|---|
| `/` | `/ngu-truong` | client replace, giữ trong SW shell |
| `/cang` | `/ngu-truong?sheet=cang` | PortDirectory thành sheet trong bản đồ, gộp giá dầu + đại lý SDVICO gần cảng |
| `/tau` `/nguoi` `/giay-to` `/van-hanh` `/thuyen-vien` | giữ `/tau` `/nguoi` | chỉ đổi lối vào (sheet Tôi) |
| `/gia-ca` `/tien` | `/tien` | đổi nhãn Bán cá, 3 chip |
| `/cho/**` `/ban-hang/**` | giữ | sáng mục Vật tư |

Sửa một file nguồn `src/lib/dock-nav.ts` (`DOCK` 4 phần tử, `KHU` thêm `["tin-tuc", ["/tin"]]`), `bottom-nav.tsx` grid 4 cột, `dock-nav.test.ts`. Doc 02 + 07 §4 cùng commit.

Ma trận trạng thái dùng chung 4 khu: **Trống** = một câu + một nút · **Đang tải** = skeleton ≤1,5 s rồi hiện bản đã lưu · **Lỗi/503** = giữ bản đã lưu + "Chưa tải được, thử lại", không nuốt lỗi khi ghi · **Mất sóng** = bản đã lưu kèm "Lưu lúc …", nút ghi báo "Cần sóng", nút `tel:` không bao giờ ẩn · **Cực đoan** = >500 phân trang cursor, ảnh cắt ở 5, chữ chặn 2.000 ký tự.

### 3.2 Khu Bản đồ (`/ngu-truong`)

- **Màn chính**: bản đồ toàn màn; dải bão/áp thấp đè trên (4 trạng thái có sẵn); dải việc cần làm mỏng (giấy tờ/VMS) chỉ khi có sóng và có việc; hàng chip dưới: Thời tiết · Con nước · Cảng · Đi tàu — chạm là sheet, không đổi trang. Không viết code mới ngoài sheet Cảng.
- **Mất sóng**: như hiện nay — toàn bộ lớp tĩnh trong SW, dự báo 6 giờ đọc `forfish.fc.*`, bão cũ kèm tuổi tin. Không thêm request nào lúc mở.
- **Quyền**: khách xem hải đồ + 3 ngày; SĐT thêm lưu tuyến/điểm; premium lớp cá + >3 ngày + 3 công cụ.
- **DB/API**: không đổi. 11 route dữ liệu vẫn qua `dataGate`.
- **Tái dùng**: toàn bộ `fishing-map-view.tsx`, `tide-card`, `route-layers`, `nav-mode`, PortDirectory (thành sheet).

### 3.3 Khu Tin tức (`/tin`) — mới

Giả định: bà con đã có Zalo; lý do duy nhất mở lại là ba thứ Zalo không có — bão/cấm biển chính thống đọc offline, giá hôm nay ở cảng mình, chuyện tàu bạn cùng cảng. Không tab "Dành cho bạn", không "Đang hot" (Forlife có mà `hot_score` không chạy nên tab luôn rỗng), không chấm điểm — sắp theo thời gian, ghim theo `pinned_until`.

- **Màn chính**: (1) dải ghim: tin bão/cấm biển mới nhất + tin hộp thư chưa đọc; (2) thẻ "Giá hôm nay ở cảng X" một dòng (từ khu Bán cá); (3) dòng tin một cột: ảnh thu nhỏ + tiêu đề + 2–3 câu + nguồn + thích/bình luận; (4) nút tròn "Đăng" (cần SĐT): chụp ảnh ≤4, vài dòng ≤500 ký tự, chọn cảng — không tiêu đề, không hashtag. Chip: **Tất cả · Cảng tôi · Bão**.
- **Ba loại bài, một dòng tin, khác hành vi** (theo nghiên cứu pháp lý NĐ 147/2024, NĐ 174/2026, Luật SHTT Điều 15/25):

| Loại | Lên dòng tin | Thích | Bình luận | Chia sẻ |
|---|---|---|---|---|
| Nhà nước (bão, cấm biển, công văn — Điều 15 không bảo hộ) | tự lên, nhãn "Tin nhà nước" | có | tắt | link gốc |
| Báo (tóm tắt 2–3 câu + link, nhãn "Tóm tắt từ [báo]") | chờ duyệt ở `/quan-tri`, một người bấm Đăng | có | **tắt** tới khi có ý kiến luật sư | link gốc |
| Bà con (đã xác thực SĐT) | tự lên; 3 bài/ngày/SĐT | có | có; ẩn 1 chạm như `product_reviews.hidden`; báo xấu gỡ ≤48 giờ | link bài |

- **Chủ quyền**: `tin-core.ts` loại thẳng bài có "South China Sea" hoặc tên Trung Quốc cho Hoàng Sa/Trường Sa; prompt tóm tắt bắt buộc "Biển Đông", "Hoàng Sa/Trường Sa của Việt Nam"; test chuỗi trong `tin-core.test.ts`.
- **Mất sóng**: `GET /api/tin` trả giống nhau cho mọi người → đưa vào `API_CACHE_ALLOW` của sw.js (sửa cả `sw-cache-policy.ts`, test `sw-cache-policy` tự bắt) — rẻ hơn tự cache localStorage và không rò chéo SĐT. App giữ thêm `forfish.tin.v1` = 50 bài gần nhất + ảnh thu nhỏ, có trần KB (Q3); tin bão ghim không bị đẩy khỏi 50. Viết bài lúc mất sóng → nháp `forfish.tin.draft.v1`, nhãn "Nháp, có sóng thì bấm Đăng" — không tự gửi (đúng ADR 0004), không mất chữ bà con đã gõ.
- **Quyền**: khách đọc (`anonymous=true`); SĐT đăng/thích/bình luận/báo xấu; premium không khác (cộng đồng phải miễn phí hoàn toàn — bài học Fishbrain).
- **DB/API**: bảng `posts` `post_reactions` `post_comments` `post_audit` (3.6). Route `GET /api/tin?cursor=&cang=` · `POST /api/tin` · `POST /api/tin/[id]/{thich,binh-luan,bao-xau}` (403 nếu `kind != ba-con`) · `POST /api/tin/[id]/anh` · `GET/POST /api/admin/tin` (tab mới `/quan-tri`) · `GET /api/cron/crawl-news` (2 giờ/lần 5h–21h, 1 lượt đêm; 5 RSS sống: NN&MT Thủy sản + Biển đảo, Thủy sản VN, VnExpress, Tuổi Trẻ, Thanh Niên; lọc từ khoá; UNIQUE `source_hash` + so `title_hash` 7 ngày; Haiku tóm tắt ở server; ≤8 bài báo/ngày; mỗi nguồn có cờ tắt ở `app_config` vì 10/15 nguồn thử đã chết). Tin bão không crawl thêm — `notify-storms` đã có, chỉ ghi thêm một `posts kind=nha-nuoc` khi phát bão. Rate limit đăng bài 10/giờ/SĐT ở `rate-limit.ts`.
- **Tái dùng**: `identityFromRequest`, `authedFetch`, `image-resize` + upload `/api/ban-hang/upload`, `inbox.ts`, `product_reviews` khuôn ẩn, `push_messages`, tab `/quan-tri`, cron khuôn `refresh-storms`.
- **Cửa thoát**: 30 ngày sau mở bài bà con, <3% người mở có đăng/thích → đóng bình luận, giữ đăng ảnh. Trước đó khu Tin tức vẫn có giá trị nhờ tin nhà nước + báo + giá.

### 3.4 Khu Vật tư (`/cho`) — giữ, dọn 4 việc

- **Màn chính**: giữ `market-home.tsx` (Mua lại · Gần bà con · Món mới). Thêm hàng **"Shop nổi bật"** — vị trí trả phí của đại lý, nhãn rõ "Nổi bật", miễn phí quý đầu để đại lý thấy đơn thật rồi mới thu. Thêm khối "Tới kỳ bảo dưỡng" đọc `forfish.maintenance.v1` tại máy → link `/cho/tim?q=` đúng món (nhớt, lọc) — thuần client, không bảng, không request.
- **Dọn**: gỡ `boat-products.tsx`/`sdvico-catalog.tsx` + bảng `supplies`/`product_catalog`/`product_inquiries` (0061 đã gộp catalog); tab Sản phẩm ở `/tau` thành link "Mua ở Chợ".
- **Mất sóng**: thêm `/cho` vào `SHELL` của sw.js (đang thiếu). Còn lại theo spec 11: xem bản lưu đơn + danh mục, nút Gọi shop không ẩn, đặt hàng cần sóng, không outbox.
- **Quyền**: khách xem, SĐT đặt/bán — spec 11 đã chốt.
- **DB/API**: `shops` thêm cột `featured_until timestamptz` (0067); `/api/admin/cho/shops` gán; `/api/cho` sắp shop nổi bật lên đầu. Không bảng ads, không impressions.
- **Không làm đợt này**: "ứng vật tư đổi cá" (chỉ nên làm ở mức niêm yết + gọi điện, chưa có hành lang).

### 3.5 Khu Giao dịch cá (`/tien`) — hồ sơ cảng · chủ tàu · bên mua đăng ký

Chỉnh hướng 2026-10-20 (anh Long chốt): đơn vị gốc là **đặc tính cảng → tỉnh → vùng biển**, không phải từng tàu. **Toàn bộ dữ liệu khu này do người dùng ForFish tự tạo (chủ tàu tự khai, bên mua tự đăng) hoặc từ nguồn công khai; KHÔNG lấy một dòng nào từ DataLake (eCDT, VMS, giấy SC/CC, sổ đăng ký tàu) và không có route nào gọi sang hệ thống nhà nước.** Giữ: giá bà con tự báo ẩn danh, lô sắp về, nháp khi mất sóng (nửa-outbox, Q1), không cọc/thanh toán/chat, `price_reports` không gắn được vào tàu. Bỏ: gói "thấy lô trước 2 giờ" (thay bằng khớp loài × cảng), "hồ sơ sạch" tự khai (không gì xác minh, dễ thành nhãn giả), chip Mối mua rời. Mức 3 (cọc, đấu giá, NĐ 320) vẫn ngoài 18 tháng.

**Tham khảo L99 "Bản đồ chuỗi sau cảng" (SDVICO làm cho nhà nước, bản 05/10/2026)** — chỉ mượn cách tổ chức luồng và phân cấp nhìn; không dựng lại, không chạm dữ liệu:

| Mắt xích L99 | Trong ForFish ai tạo | Thay cho gì |
|---|---|---|
| Tàu (sổ đăng ký) | Chủ tàu tự khai `skipper_profiles`: cảng nhà (hoặc tỉnh), loài hay đánh | Không có danh sách tàu |
| Chuyến → nhật ký (loài, kg, cảng bốc dỡ) | Phiếu "cảng tôi hay về loài này" + lô sắp về + "Đã bán" | Nhật ký eCDT → đặc tính cảng gộp từ nhiều bà con, ẩn danh |
| Giấy SC (bên mua + MST) | Bên mua tự đăng ký `shops`, MST tuỳ chọn, SDVICO tra tay rồi bấm "đã xác minh" | Giấy SC → tài khoản được duyệt + dấu xác minh |
| Cảng → cơ sở thu mua/chế biến | Khớp `fish_buy_requests` × lô/chủ tàu theo loài × cảng × thời điểm | Dòng chảy sản lượng → nhu cầu đang mở, hai chiều |
| Bấm ra tới từng tàu | Không có. Bấm tới cấp cảng, rồi nhóm ẩn danh; từng chủ tàu chỉ khi họ tự bật liên hệ | Truy xuất → quyền tự lộ của chủ tàu |
| Tỉnh → xã → thôn → tàu | Khách: cảng; chủ tàu: + yêu cầu thu mua; bên mua đã duyệt: + "sắp cập" ẩn danh; admin: toàn bộ | Phân cấp hành chính → phân vai theo tài khoản |

**A. Ba lớp lồng nhau.** Khuôn chung: định danh `owner_phone` chuỗi cứng (0043), bảng mới `enable RLS + revoke all from anon, authenticated` **theo khuôn `market_requests` 0063** (không phải `market_listings` 0014 — bảng đó còn policy `auth.uid()`, 0065 dọn luôn), mọi ghi qua route service-role + `identityFromRequest`, ghi nhiều bảng dùng RPC atomic (0064). `port_id` khoá vào `FISHING_PORTS` (173 cảng, `src/data/fishing-ports.ts`); cấm `data/ports.ts` (10 cảng, id trùng `hon-ro`), test gác; 8 "cảng" đảo `active:false` toạ độ rác không được seed. Tên tỉnh theo sau sáp nhập 2025 đúng như `FISHING_PORTS.province` (Tam Quan → Gia Lai, Phan Thiết → Lâm Đồng, Tắc Cậu → An Giang).

| Lớp | Bảng | Cột chính | Quyết định |
|---|---|---|---|
| Cảng | `port_profiles` (0065) | `port_id text PK`, `seed jsonb` {species:[{name, months[1..12], gear}], sources:[{name, url, seen_on}]}, `confirmed jsonb` (gộp từ phiếu, cache), `vote_count`, `updated_at` | 1 dòng/cảng; `seed` từ script đọc nguồn công khai, **dòng seed không có `url` công khai thì script từ chối**; `confirmed` do luật thuần tính lại sau mỗi phiếu |
| | `port_profile_votes` (0065) | `phone`, `port_id`, `species`, `months int[]`, `created_at`; **PK (phone, port_id, species)** | 1 SĐT = 1 phiếu/loài/cảng, sửa được, không cộng dồn; không hiện SĐT ở đâu |
| Tỉnh / vùng | suy ra, không bảng | tỉnh = `FISHING_PORTS.province`; vùng = `fish-seasons.ts` (đã có mùa vụ 4 vùng từ nguồn công khai) + bảng tỉnh→vùng mới `src/data/sea-regions.ts` | Tỉnh = gộp phiếu mọi cảng trong tỉnh, tính lúc đọc trong `port-profile-core.ts`; vùng = tĩnh từ `fish-seasons.ts`, không nhập tay lần hai. Thiếu lớp dưới thì lùi lên, trả `level: 'cang'|'tinh'|'vung'` để màn hình ghi "theo tỉnh Khánh Hòa" |
| Chủ tàu | `skipper_profiles` (0065) | `owner_phone PK`, `home_port_id null`, `province`, `species text[]`, `allow_buyer_contact bool default false`, `home_port_changed_at`, `created_at` | Bảng riêng, không nhét `customers` (SDWork webhook đè). Bến làng ngoài 173 → `home_port_id = null` + tỉnh, không ép chọn bừa. Khai xong tự thành phiếu. Đổi cảng nhà ≤1 lần/30 ngày |
| Lô sắp về | `market_listings` + cột (0065) | `port_id`, `eta_at`, `est_kg`, `sold_to_kind`, `sold_price_vnd`, `client_ref text UNIQUE`; status thêm `sold`; đợt 5 thêm `images jsonb`, `size_text`, `visibility ('ben_mua'/'moi_quen')` | Giữ bảng cũ (route, core, test có sẵn). **Cột `phone` ngừng ghi cho lô cá** (`lo-ca-core.validate` bắt null) — đường lộ SĐT có sẵn. Không bump contract SDWork: webhook chỉ ghi `customers/payments/assets`, chưa code nào đụng `market_listings` (Q7 trống). `side='mua'` không nhận bài mới |
| Giá | `price_reports` (0065) | `phone`, `species`, `size_text`, `port_id`, `price_vnd`, `buyer_kind`, `listing_id null`, `reported_on` | Chỉ SĐT có `skipper_profiles` được báo; tổng hợp trả **trung vị + cắt 10% hai đầu**, dải thấp–cao + số lượt, ≥3 SĐT/loài/cảng/7 ngày, không SĐT |
| Bên mua | `shops` + cột (0067) | `buys_fish bool default false`, `buyer_kind ('nau','vua','nha_may','tau_hau_can')`, `buy_species text[]`, `buy_port_ids text[]`, `tax_code text`, `verified_at timestamptz` | Chọn `shops`, không bảng `buyers`: 1 SĐT = 1 shop, trạng thái `cho_duyet/hoat_dong/tam_khoa/tu_choi` + `status_note` + duyệt `/api/admin/cho/shops` đã chạy; vựa vừa bán vật tư vừa mua cá là một hồ sơ. **`verified_at` chỉ từ tra cứu Tổng cục Thuế công khai bằng tay, không từ L99/DataLake** — ghi vào 04 |
| Yêu cầu thu mua | `fish_buy_requests` (0067) | `id`, `shop_id`, `species`, `size_text`, `port_ids text[]` (rỗng = cả tỉnh), `province`, `window_from`, `window_to`, `price_vnd`, `kg_min`, `kg_max`, `note ≤300`, `status ('mo','du','dong','het_han')`, `response_count`, `created_at` | Tên `fish_*` để không đụng `market_requests` (yêu cầu đặt vật tư 0063); route `/api/thu-mua`, admin không có hai tab "Yêu cầu" trùng tên |
| Khớp | `fish_buy_responses` (0067) | `request_id`, `owner_phone`, `listing_id null`, `share_contact bool`, `created_at`; **PK (request_id, owner_phone)** | Khớp gợi ý tính lúc đọc, không lưu; chỉ lưu khi chủ tàu **bấm "Tôi có"**. SĐT chỉ hở khi `share_contact=true` (bấm riêng, mặc định tắt) |

**B. Bốn màn.**

(1) **Hồ sơ cảng** — sheet trong `/ngu-truong` (đã precache) mở từ ghim cảng hoặc `/tien?cang=<id>`; **không** làm route động `/tien/cang/[id]` vì không nằm `SHELL`, mất sóng là màn trắng. Viewport đầu: tên cảng + tỉnh + loại; "Tháng này hay về" chip loài; "Giá hôm nay" (dải, số lượt). Hành động chính: **"Cảng tôi hay về loài này"** 1 chạm/loài (cần SĐT có `skipper_profiles`), chạm giữ chọn tháng. Quyền: **khách chỉ thấy seed + confirmed qua ngưỡng**, không thấy số yêu cầu thu mua (khách có thể là bên mua chưa đăng ký); chủ tàu thấy thêm "Đang cần mua ở cảng này" + nút xác nhận; bên mua đã duyệt thấy thêm số chủ tàu khai cảng nhà (số, không danh sách). Trạng thái: trống → "Chưa đủ bà con xác nhận, đang hiện theo tỉnh X" + nút xác nhận; tải → khung xám; lỗi → bản lưu + "Thử lại"; mất sóng → `forfish.cang.v1` (cảng nhà + ≤5 cảng đã mở, ≤300 KB) kèm "Lưu lúc"; nút xác nhận báo "Cần sóng" — **không** nháp phiếu (outbox thứ ba, ADR 0004).

(2) **Phía chủ tàu** `/tien` (mặc định khi có cảng nhà; chưa có → thẻ "Khai cảng nhà" 2 chạm: cảng hoặc tỉnh, loài gợi từ `confirmed`). Viewport đầu: "Giá hôm nay ở [cảng nhà]"; **"Ai đang cần mua"**: thẻ yêu cầu khớp loài tôi hay đánh × cảng nhà/tỉnh × cửa sổ còn hạn (tên cơ sở, dấu xác minh, loài, giá, kg, "còn N ngày"), nút **"Tôi có"**; dưới: lô của tôi. Chip: **Giá · Cần mua · Lô tôi**. Hành động: "Chào lô" (loài, ước kg, giờ về, cảng về — có thể khác cảng nhà; **không GPS**, Q4; ảnh ≤5 + "ai thấy" từ đợt 5, mặc định `moi_quen`), "Báo giá vừa bán" 3 chạm, "Đã bán" sinh `price_reports` atomic. Quyền: cần SĐT; khách thấy giá + nút đăng nhập. Trống → "Chưa ai cần mua [loài] ở cảng mình; chào lô để bên mua biết". Mất sóng → yêu cầu cache `forfish.yc.v1` ngăn SĐT (khuôn `orders-cache.ts`), "Chào lô" thành nháp `forfish.lo.draft.v1` có `client_ref`, thẻ "Có 1 lô chờ đăng" khi bắt sóng, không gửi ngầm; "Tôi có" báo "Cần sóng".

(3) **Phía bên mua** `/tien/mua` (chỉ `shops.buys_fish && status='hoat_dong'`; chưa duyệt → một màn "Hồ sơ đang chờ SDVICO duyệt", **không thấy gì khác**). Viewport đầu: yêu cầu của tôi (mở/đủ/hết hạn, số "Tôi có"); **"Sắp cập"**: nhóm cảng × loài khớp yêu cầu — "4 chủ tàu, cá ngừ, về Hòn Rớ 2–3 ngày tới" — ẩn danh (không tên, SĐT, số hiệu), chỉ hiện khi nhóm ≥3 **và** cảng có ≥10 chủ tàu khai cảng nhà (cảng 5–6 tàu tra ngược được); chủ tàu đã bấm "Tôi có" + bật liên hệ mới hiện tên + Gọi/Zalo. **Chưa `verified_at` thì không thấy "Sắp cập"**, chỉ đăng ≤1 yêu cầu — chặn mạo danh vựa có tiếng. Khối 3: "Cảng nào hay về [loài]" theo tháng từ `port_profiles`. Hành động chính: **"Đăng yêu cầu"** — validate ở ranh giới: giá 1.000–10.000.000 đ/kg, kg ≤ 500 tấn, cửa sổ ≤30 ngày, note ≤300. Trống → "Chưa có yêu cầu nào; đăng để chủ tàu ở cảng biết"; lỗi → giữ form; mất sóng → bản lưu `forfish.yc.mua.v1`, form thành nháp `forfish.yc.draft.v1` + thẻ nhắc khi có sóng (bên mua ở bờ, hiếm, vẫn phải có nhánh).

(4) **Đăng ký bên mua + duyệt.** Tái dùng `ShopRegister` (`/ban-hang/dang-ky` → `POST /api/ban-hang/shop`): thêm ô "Tôi mua cá" (`buys_fish`) mở phần: loại cơ sở, cảng hay thu mua (chọn từ 173), loài hay mua, MST tuỳ chọn. `validateShopDraft` thêm nhánh `buys_fish && !sells` bỏ bắt buộc `shippingFlatVnd`/bank; `MarketStore` (interface + `supabase-store` + kho file dev) thêm cột, nếu không localhost (thiếu service_role) không test được. Tạo `shops` `cho_duyet`. `/quan-tri` tab Shops thêm lọc "Mua cá" + ô MST + nút "Đã xác minh" + từ chối có `status_note`; cờ khi tên cơ sở trùng tên đã verified. Thông báo duyệt dùng `notifyShopStatus` N10/N11/N12 sẵn có. Hồ sơ công khai cho chủ tàu: tên cơ sở, loại, loài hay mua, cảng hay đứng, số yêu cầu, dấu xác minh — SĐT bên mua chỉ hiện khi chủ tàu bấm "Tôi có".

**C. Khởi tạo hồ sơ cảng không cần dữ liệu nhà nước.**
- Nguồn công khai, mỗi dòng có `url` + ngày xem: báo cáo ngành thuỷ sản tỉnh **đã đăng công khai** (Điều 15 Luật SHTT không bảo hộ số liệu — nhưng chỉ bản đã đăng, không file nội bộ), TT 81/2025 nghề theo vùng, báo mùa vụ địa phương, trang BQL cảng, VASEP tuần, `fish-seasons.ts`. Script `scripts/seed-port-profiles.mjs` đọc `src/data/port-profile-seed.json` (nhập tay, có nguồn từng dòng) → upsert `seed`; đợt 2 seed ≥20 cảng lớn.
- Ngưỡng hiện: loài ở lớp cảng khi `seed` có hoặc ≥5 SĐT; tháng khi ≥3 phiếu đồng ý. Dưới ngưỡng → tỉnh (gộp, ngưỡng 10) → vùng (`fish-seasons.ts`). Nhãn luôn ghi "theo cảng/tỉnh/vùng, N bà con xác nhận".
- Chống bịa: chỉ SĐT có `home_port_id` trùng cảng hoặc cùng tỉnh mới vote; phiếu của SĐT tạo <7 ngày và của SĐT có `shops.buys_fish` **không tính vào ngưỡng** (vẫn lưu); ≤20 phiếu/SĐT/ngày. Ngưỡng 5 không chặn 5 SIM rác (đăng ký chỉ cần OTP) — chấp nhận đợt 2, cờ "nghi bơm" admin để đợt 5.

**D. Khớp + thông báo.**
- Bên mua đăng yêu cầu loài X, cảng Y/tỉnh → `matchSkippers` (loài ∈ species; **ưu tiên `listing.port_id` của lô đang mở**, rồi `home_port_id`, rồi cùng tỉnh — tàu cập cảng khác do bão/giá không bị bỏ lỡ) → `notifyAccount({ sentBy: "system:can-mua", pushOs: true, tag: "can-mua-<species>-<port>" })` gom, tối đa 200 SĐT/yêu cầu (ưu tiên có lô mở, rồi phiếu gần nhất), mỗi SĐT ≤3 push cần-mua/ngày. Chủ tàu bấm "Tôi có" → `fish_buy_responses` + `response_count` atomic (RPC `market_respond_request`) → bên mua nhận hộp thư, gom "N chủ tàu đã trả lời". Bên mua bấm "Đủ rồi" → `status='du'`, ngừng push.
- Chủ tàu chào lô loài X cảng Y → `matchRequests` → push shop `hoat_dong` có yêu cầu khớp (`sentBy: "system:lo"`); lô `moi_quen` không push ai.
- Hạn mức đợt 5 (giữ 2 loại): bên mua ≤5 yêu cầu mở, ≤10 tạo/ngày (chưa xác minh ≤1 mở); chủ tàu ≤5 lô mở, ≤10 "Tôi có"/ngày; `rate-limit.ts` theo SĐT. Hết hạn tính lúc đọc (`window_to + 1 ngày` → `het_han`; lô `eta_at + 2 ngày` → `closed`), không cron. "Báo xấu", `kind='het_roi'`, `suspectBurst`: sau đợt 5.

**E. API + migration + luật thuần.** Migration: **0065_ho_so_cang_lo_gia** (`port_profiles`, `port_profile_votes`, `skipper_profiles`, `market_listings` + cột + dọn policy cũ, `price_reports`, RPC `market_vote_port`, `market_sell_done`) · **0066_tin_tuc** giữ của khu Tin · **0067_ben_mua** (`shops` + cột, `fish_buy_requests`, `fish_buy_responses`, RPC `market_respond_request`). Route (đều `identityFromRequest`): `GET /api/cang/[id]` (khách, trả `level`) · `POST /api/cang/[id]/xac-nhan` · `GET/PUT /api/me/tau-ca` · `GET /api/market-listings?port=&species=` (**redact theo vai** `redactForRole`: khách không thấy lô `ban`, `phone` không bao giờ trả; viết trước 0065) · `POST /api/market-listings/[id]/ban-xong` · `GET /api/gia-ba-con?port=` (khách) · `POST /api/gia-ba-con` · `GET/POST /api/thu-mua` · `POST /api/thu-mua/[id]/toi-co` · `PATCH /api/thu-mua/[id]` · `GET /api/thu-mua/sap-cap` · `/api/admin/cho/shops` thêm lọc + `verified`. Route mở khách (`/api/cang`, `/api/gia-ba-con`) **không qua middleware** để giữ cache SW; khai `/api/cang`, `/api/gia-ba-con`, `/api/thu-mua` vào `KHONG_PHAI_DU_LIEU` của `data-route-rules.ts` kèm lý do "tự gác rate theo IP ở route" để test không đỏ. Luật thuần + test cùng commit: `port-profile-core.ts` (`mergeVotes`, `resolveLevel`, `canVote`, `portIdValid` khoá 173), `buy-request-core.ts` (`validateRequest`, `matchSkippers`, `matchRequests`, `expireAtRead`, `redactForBuyer`, `redactForSkipper`, hạn mức), `lo-ca-core.ts` (thẻ lô, trung vị cắt 10%, ngưỡng 3 SĐT/7 ngày, `phone` null).

**F. Ba chỗ yếu còn lại.** (a) ngưỡng 5 phiếu ở cảng tàu 6–15 m trống lâu, lùi lên tỉnh làm thẻ "cảng tôi" kém thật (Q5); (b) push cần-mua đánh thức cả chủ tàu đang ở biển không có cá — cần cờ "đang đi biển" từ chế độ Đang chạy, chưa nối; (c) nậu đang cho tàu vay vốn nhìn "Sắp cập" vẫn có thể đoán tàu dù ẩn danh — mặc định lô `moi_quen`, nhóm chỉ hiện ≥3 ở cảng ≥10 chủ tàu (Q8).

### 3.6 Kiến trúc kỹ thuật tổng

```
 ĐIỆN THOẠI BÀ CON (PWA / Capacitor)
 ┌──────────────────────────────────────────────────────────────┐
 │ dock 4: /ngu-truong  /tin  /cho  /tien   + sheet Tôi (/tau /nguoi)
 │ sw.js  sdfish-v7: CRITICAL_SHELL(/ + /ngu-truong + data)      │
 │        SHELL(+/tin +/cho)  API_CACHE_ALLOW(+/api/tin +/api/gia-ba-con)
 │ localStorage forfish.*: fc.* tier.* token.v1 datakey.v1       │
 │   tin.v1 (50 bài, trần KB) tin.draft.v1 lo.v1 lo.draft.v1    │
 │   cang.v1 (hồ sơ ≤6 cảng) yc.v1 yc.mua.v1 yc.draft.v1 (ngăn SĐT)
 │   mcart/mfav/morders (ngăn SĐT)  maintenance.v1               │
 └───────────────┬──────────────────────────┬───────────────────┘
   authedFetch   │ x-sdfish-token            │ GET /data/** (SDF2)
                 ▼                           ▼
 ┌──────────────────────────────── Next.js 16 trên Vercel ─────────┐
 │ middleware.ts → dataGate (11 route dữ liệu: 401/403/429)       │
 │ route tự gọi identityFromRequest (không qua middleware):        │
 │   /api/tin/**  /api/gia-ba-con  /api/market-listings/**        │
 │   /api/cang/**  /api/thu-mua/**  /api/me/tau-ca                 │
 │   /api/cho/**  /api/ban-hang/**  /api/me/**  /api/admin/**     │
 │ luật thuần + test: tin-core.ts  lo-ca-core.ts  data-route-rules │
 │   port-profile-core.ts  buy-request-core.ts                    │
 │ cron (Vercel): refresh-weather/fish/storms  notify-storms       │
 │   notify-docs  snapshot-prices  crawl-news (mới, 2h ban ngày)   │
 └───────┬─────────────────────────────┬───────────────────────────┘
         │ service role                │ Haiku 5.5 (tóm tắt, ~0,3 USD/tháng)
         ▼                             ▼
 ┌────── Supabase (RLS owner-only / không policy, ghi qua route) ──┐
 │ cũ: customers device_tokens push_messages push_subscriptions    │
 │     shops shop_products market_orders product_reviews           │
 │     market_listings sell_contacts price_history user_docs       │
 │ 0065: port_profiles · port_profile_votes · skipper_profiles     │
 │       market_listings +cột (dọn policy cũ) · price_reports      │
 │ 0066: posts · post_reactions · post_comments · post_audit       │
 │ 0067: shops +cột (buys_fish, tax_code, verified_at, featured)   │
 │       fish_buy_requests · fish_buy_responses                    │
 └─────────────────────────────────────────────────────────────────┘
         ▲ gán premium / lead (KHÔNG có dòng nào từ DataLake eCDT/VMS/SC/CC)
 SDWork (CRM SDVICO) ── contract docs/contracts/sdwork-assets.contract.md
```

Bảng mới và cột mới (khuôn `market_requests` 0063: `owner_phone`, `enable RLS + revoke all from anon, authenticated`, không policy, mọi ghi qua route server + `identityFromRequest`; **mọi dữ liệu do người dùng tạo hoặc seed từ nguồn công khai, không bảng nào nhận dữ liệu DataLake**):

| Migration | Bảng / cột | Cột chính | Ghi chú |
|---|---|---|---|
| **0065_ho_so_cang_lo_gia** | `port_profiles` | `port_id text PK` (khoá `FISHING_PORTS`, 173), `seed jsonb` (species/months/gear + sources có url), `confirmed jsonb`, `vote_count`, `updated_at` | seed từ nguồn công khai; `confirmed` gộp từ phiếu theo ngưỡng 5/3 |
| | `port_profile_votes` | phone, port_id, species, months int[], created_at; PK (phone, port_id, species) | 1 SĐT = 1 phiếu/loài/cảng; không hiện SĐT |
| | `skipper_profiles` | `owner_phone PK`, `home_port_id null`, `province`, `species text[]`, `allow_buyer_contact bool default false`, `home_port_changed_at`, `created_at` | hồ sơ chủ tàu tự khai; không nhét `customers` |
| | `market_listings` + cột | `port_id`, `eta_at`, `est_kg`, `sold_to_kind`, `sold_price_vnd`, `client_ref text UNIQUE`, status thêm `sold`; đợt 5: `images jsonb`, `size_text`, `visibility (ben_mua/moi_quen)` | cột nullable; `phone` ngừng ghi cho lô cá; dọn policy `auth.uid()` 0014; không bump contract SDWork (webhook không chạm bảng này) |
| | `price_reports` | id, phone, species, size_text, port_id, price_vnd, buyer_kind, listing_id null, reported_on | tổng hợp trung vị cắt 10%, ẩn danh; chỉ SĐT có `skipper_profiles` ghi |
| | RPC | `market_vote_port`, `market_sell_done` | atomic theo khuôn 0064 |
| **0066_tin_tuc** | `posts` | id, kind (`nha-nuoc`/`bao`/`ba-con`), author_phone, title, body, images jsonb, source_name, source_url, **source_hash UNIQUE**, title_hash, port, status (`cho_duyet`/`dang`/`an`), is_ai_summary, like_count, comment_count, pinned_until, report_count, created_at; trgm trên search_text như 0060 | bài báo + bà con chung bảng vì chung dòng tin |
| | `post_reactions` | post_id, phone, created_at; PK (post_id, phone) | |
| | `post_comments` | id, post_id, phone, body, hidden, created_at | chép `product_reviews` |
| | `post_audit` | post_id, phone, action, ip, at | nhật ký 2 năm NĐ 147 |
| **0067_ben_mua** | `shops` + cột | `buys_fish bool default false`, `buyer_kind (nau/vua/nha_may/tau_hau_can)`, `buy_species text[]`, `buy_port_ids text[]`, `tax_code text`, `verified_at timestamptz`, `featured_until timestamptz` | bên mua = shop, duyệt ở `/api/admin/cho/shops`; `verified_at` chỉ từ tra Tổng cục Thuế công khai bằng tay; Shop nổi bật |
| | `fish_buy_requests` | id, shop_id, species, size_text, port_ids text[], province, window_from, window_to, price_vnd, kg_min, kg_max, note, status (mo/du/dong/het_han), response_count, created_at | tên `fish_*` để không đụng `market_requests` (vật tư); hết hạn tính lúc đọc |
| | `fish_buy_responses` | request_id, owner_phone, listing_id null, share_contact bool, created_at; PK (request_id, owner_phone) | chỉ lưu khi chủ tàu bấm "Tôi có"; SĐT chỉ hở khi `share_contact` |
| | RPC | `market_respond_request` | atomic: insert response + `response_count` |

Không bảng người theo dõi, `user_interests`, `post_scores`, `feed_impressions`, `ads`; không `fish_lots`/`fish_buyers` riêng (lô trên `market_listings`, bên mua trên `shops`); không `customers.buyer_until` (gói "thấy lô sớm" đã bỏ); không bảng tỉnh/vùng (suy từ `FISHING_PORTS.province` + `sea-regions.ts` + `fish-seasons.ts`).

Đụng offline (chạy bộ bắt buộc `qa-offline-acceptance.md` ở đợt 1 và đợt 5): sw.js bump `sdfish-v7`, `SHELL` thêm `/tin` `/cho` (hồ sơ cảng là sheet trong `/ngu-truong` nên không thêm route động), `API_CACHE_ALLOW` thêm `/api/tin` `/api/gia-ba-con` `/api/cang/*`; **không bump** kho api `sdfish-api-v2` (giữ dự báo đã tải); mọi fetch mới qua `authedFetch` có timeout, `.catch` về bản lưu; không request nào mới chạy lúc mở bản đồ.

## 4. So sánh

| | Dock hiện tại (2026-10-19) | Phương án mới | Forlife OA | Zalo/Facebook | Windy |
|---|---|---|---|---|---|
| Màn mở đầu | Trang chủ tổng hợp 4 khối | Bản đồ, dùng được khi mất sóng | Dòng tin | Danh sách chat | Bản đồ gió |
| Số mục tầng 1 | 5 (có Tàu tôi) | 4; Tàu tôi trong sheet Tôi | 1 dòng tin + nhiều tab | — | — |
| Tin tức | Chỉ hộp thư push | 3 loại bài một dòng tin, báo duyệt tay, nhãn "Tóm tắt từ", UNIQUE url, không chấm điểm, lọc chủ quyền | 12 OA giả, `hot_score` không chạy, không lọc, lưu `is_ai_summary` mà không hiện, service role ngoài repo | Nhóm tự phát, trộn lẫn, dễ bị chiếm | Không |
| Giao dịch cá | 3 chip giá/tin/đầu mối, không ảnh, không offline | Giá bà con + thẻ lô + hồ sơ sạch + người mua trả phí, trên `market_listings` | — | Chốt tay qua ảnh/clip, đặt cọc ngoài app | — |
| Vật tư | `/cho` đã lên prod | + Shop nổi bật + gợi món theo bảo dưỡng | — | Fanpage đại lý | — |
| Offline | Trang chủ cache, chợ không | `/tin` + giá vào SW; lô cache ngăn SĐT; nháp không mất | Không | Không | Chỉ dự báo |
| Bảng mới | — | 5 bảng + cột thêm 3 bảng cũ, 3 migration | 6+ bảng | — | — |
| Tiền | Premium + hàng SDVICO | + Shop nổi bật + gói người mua cá | Không | Quảng cáo Meta | Thuê bao |

## 5. Cách thực hiện — 6 đợt, mỗi đợt ≤2 tuần, một nhánh

| Đợt | Làm gì | Tiêu chí xong | Rủi ro | Đụng offline |
|---|---|---|---|---|
| **1** (tuần 1–2) | Dock 4 + sheet Tôi + `/` → bản đồ + `/cang` thành sheet + dải việc trên bản đồ; dọn trang chủ; sw.js v7 (`SHELL` +`/tin` +`/cho`) | `dock-nav.test` xanh; mọi deep-link cũ tới đúng chỗ; mở app mất sóng ra bản đồ; bộ offline bắt buộc qua kể cả ca "vỏ v6 đang ở biển, tải v7 dở dang" (Q2) | Chủ tàu không thấy Giấy tờ → đo số mở sheet Tôi tuần đầu, có đường lùi | **Nặng**: bump vỏ, đổi `/` |
| **2** (tuần 3–4) | **0065**: hồ sơ cảng seed ≥20 cảng lớn từ nguồn công khai + sheet Cảng (1) + xác nhận 1 chạm + `skipper_profiles` ("Khai cảng nhà") + cột lô + `price_reports` + "Đã bán" sinh báo giá + `GET /api/gia-ba-con` mở khách + thẻ "Giá hôm nay" (dùng chung Tin tức) + `redactForRole` cho `GET /api/market-listings` (viết trước 0065) + cache `forfish.cang.v1` `forfish.lo.v1` | Cảng thí điểm ≥30 chủ tàu khai cảng nhà, ≥20 báo giá/tuần; `port-profile-core.test` + `lo-ca-core.test` xanh; mất sóng thấy hồ sơ cảng + giá kèm "Lưu lúc"; khách không thấy `phone` | Nậu bơm số → trung vị cắt 10%, chỉ `skipper_profiles` báo giá, ngưỡng 3 SĐT/7 ngày; cảng nhỏ <5 phiếu → lùi tỉnh + VASEP (Q5); seed không url → script từ chối | `API_CACHE_ALLOW` +2 route; không route động mới |
| **3** (tuần 5–6) | **0066** + crawl + duyệt ở `/quan-tri` + `GET /api/tin` + màn đọc + cache 50 bài + ghim bão + chip Bão | 5 nguồn chạy 1 tuần không trùng bài; mất sóng mở `/tin` thấy 50 bài; nhãn "Tóm tắt từ" hiện; test chủ quyền xanh | RSS chết → cờ tắt từng nguồn; luật sư chưa trả lời → bài báo chỉ lên sau tay người duyệt | `API_CACHE_ALLOW` +1 route; trần KB `tin.v1` (Q3) |
| **4** (tuần 7–8) | Bà con đăng/thích/bình luận/báo xấu/ẩn + `post_audit` + rate limit + nháp offline | Gỡ bài ≤48 giờ có đường làm ở admin; test quyền bình luận theo kind; chỉ mở ra ngoài nhóm thử khi luật sư gật | Ngưỡng 1.000 người/tháng kích giấy phép MXH; rỗng/bẩn → cửa thoát 3% | Nháp `tin.draft.v1`, không outbox |
| **5** (tuần 9–10) | **0067**: đăng ký bên mua (ô "Tôi mua cá" trên `ShopRegister`, nhánh `validateShopDraft`, `MarketStore` + kho file dev) + duyệt/xác minh MST tay ở `/quan-tri` + `fish_buy_requests`/`fish_buy_responses` + màn "Ai đang cần mua" (chủ tàu) + `/tien/mua` "Sắp cập" ẩn danh (bên mua) + chào lô có ảnh ≤5/ai thấy + nháp `client_ref` + thẻ "Có 1 lô chờ đăng" + push hai chiều `system:can-mua`/`system:lo` + hạn mức | 1 cảng có ≥5 bên mua đã duyệt, ≥10 yêu cầu + ≥10 lô/tuần, ≥20 "Tôi có"; `buy-request-core.test` xanh; bên mua chưa duyệt không thấy gì; bộ offline bắt buộc qua | **Điều kiện mở**: SDVICO ký 5 vựa/nhà máy ở 1 cảng và có người đứng cảng; không có thì đợt 5 chờ. Nậu đoán tàu qua "Sắp cập" → mặc định `moi_quen`, nhóm ≥3 ở cảng ≥10 chủ tàu (Q8). Phí bên mua chưa thu (Q7) | Nháp lô + nháp yêu cầu + thẻ nhắc khi online |
| **6** (tuần 11–12) | Vật tư: Shop nổi bật (`featured_until`), gỡ catalog cũ + bảng 0016/0017, gợi món từ bảo dưỡng; dọn doc | Không còn import `boat-products`; 3 đại lý nhận vị trí thử miễn phí | Thấp | Không |

Thứ tự đổi thành 1 → 2 → 3 → 5 → 4 → 6 nếu luật sư chưa trả lời sau đợt 3 (đợt 5 không dính pháp lý Tin tức). Mỗi đợt doc 02/04/07 cùng commit; không apply migration lên remote khi anh Long chưa gật. 10 tuần là lạc quan cho 1 người + agent; mốc thật tính 3–4 tháng.

## 6. Mô hình tiền

Nguyên tắc: **ngư dân không trả tiền cho khu nào ngoài dự báo cá**. Người trả là bên có tiền: đại lý vật tư, vựa/nhà máy mua cá, SDVICO tự bán hàng. Không ôm hàng, không giữ tiền, không hoa hồng trên cá.

| Khu | Vai trò | Ai trả | Bao nhiêu | Bao giờ | Ước lượng thô |
|---|---|---|---|---|---|
| Bản đồ | Cho không để giữ người; cửa bán premium | Ngư dân (premium) | 500k/18 tháng (đã có) | Đang có | 28.548 tàu ≥15 m × 3% × 500k ≈ 430 triệu/18 tháng — **ước lượng**, tỷ lệ 3% chưa có cảng nào chứng minh |
| Tin tức | Cho không, lý do mở app ở bờ | Không ai | 0 | — | 0 đ; không quảng cáo để không kích giấy phép MXH khi có doanh thu |
| Vật tư | Tiền sớm nhất | (1) SDVICO bán hàng mình + gia hạn VMS; (2) đại lý mua "Shop nổi bật" | Nổi bật ~1 triệu/tháng/shop — **ước lượng**, chưa có tiền lệ; miễn phí quý đầu | Từ đợt 6, thu từ quý 2 sau đó | 20–50 đại lý × 1 triệu = 20–50 triệu/tháng nếu đại lý thấy đơn thật |
| Bán cá | Cho không với ngư dân; thu từ người mua | Vựa/nhà máy/tàu hậu cần | Gói "thấy lô sớm" 300–500k/tháng/cảng — **ước lượng** | Đợt 5, chỉ ở cảng có 5 người mua ký | 10 cảng × 5 × 400k ≈ 20 triệu/tháng; miễn phí 3 tháng đầu ở cảng mở mới |

Chi hạ tầng ước ~15 triệu/tháng. Mốc dừng: doanh thu tháng từ Shop nổi bật + gói người mua ≥ chi hạ tầng trước tháng 12 kể từ đợt 1; không đạt thì giữ Bán cá ở mức 1 và Tin tức một chiều. Tiền thật năm đầu vẫn là gian hàng SDVICO + VMS. Tài sản ngầm: giá cảng theo ngày — chưa ai có ở VN.

## 7. Hai phương án không chọn — vì sao

**ngu-dan (ngư dân trước) — 6,70 / 6,70.** Mạnh nhất về câu chữ và việc bà con: mở app là bản đồ, Tin tức chỉ 3 chip, nhãn "Bán cá", thẻ giá làm mồi cho cả hai khu, chống bơm giá nghĩ sẵn. Không chọn làm nền vì đẻ **2 outbox** (bài tin + lô cá) tức 2 cỗ máy trạng thái mới trong khi ADR 0004 bác outbox vì chính dự án đã mất dữ liệu ở đường ghi; outbox bài tin không có lý do "sinh ra trên biển" như lô cá. 8 bảng mới cho 2 khu (`fish_lots`, `fish_buyers`, `fish_lot_views`, `news_sources`… trong khi `market_listings` và `shops` đã có chỗ). Redirect 308 server cho `/` nghĩa là vỏ v6 trong máy bà con đang ở biển không tự vào bản đồ. Góc tiền mỏng nhất: Vật tư "không tính ở đây" dù đó là chỗ SDVICO đang có tiền thật. Phần hay nhất đã ghép vào mục 3.

**doanh-thu (doanh thu trước) — 6,15 / 6,55.** Duy nhất trả lời câu "SDVICO sống bằng gì tháng thứ 3": Shop nổi bật, bảng đối chiếu CK, mốc "quảng cáo ≥ chi", nhận thẳng rằng mở cảng nào phải có người SDVICO đứng cảng đó. Không chọn vì ô quảng cáo 1/8 bài trong dòng tin + chip Cá mờ "Gọi SDVICO" nhìn thấy mỗi ngày làm app giống tờ rơi, bà con ít rành dễ bấm nhầm (bài học Fishbrain); doanh thu quảng cáo chính là thứ kích giấy phép MXH sớm nhất — tự mâu thuẫn với lịch 2 tuần cho Tin tức. Dời `/tau` → `/toi/tau` là đổi route thật, ~20 deep-link push bão phải rewrite kèm query — rủi ro gãy lớn nhất cho người đang ngoài biển. 9 bảng + bảng ads + cron ads-expire + ops bán quảng cáo + luật sư = 12 tuần với 1 người không xong. Phần ăn tiền không dính giấy phép đã ghép.

## 8. Câu hỏi anh Long phải chốt

Q1–Q4 giữ nguyên; Q5–Q8 viết lại theo hướng hồ sơ cảng + bên mua đăng ký (vòng 2).

1. **Lô cá đăng từ biển khi mất sóng: nháp bấm 1 lần hay tự đẩy?** Hai giám khảo lệch: một bên muốn nửa-outbox (nháp + thẻ "Có 1 lô chờ đăng" khi bắt sóng), bên kia muốn tự đẩy khi bắt 4G ven bờ vì đúng lúc bạn hàng đặt cọc. *Mặc định đề xuất*: nửa-outbox — đúng ADR 0004, bà con không phải nhớ nhưng cũng không có gì gửi ngầm; nếu sau 2 tháng số lô bị quên đăng >20% thì nâng lên tự đẩy, ghi thành ngoại lệ có chủ ý của ADR 0004 cùng commit.
2. **Bump vỏ SW v6 → v7 khi bà con đang ở biển.** Vỏ cũ cache `/` = trang chủ cũ. SW chỉ `activate` v7 sau khi precache xong `CRITICAL_SHELL`, nên tải dở dang thì v6 vẫn nguyên — nhưng chưa bản nào thử ca này. *Mặc định*: bump v7 ngay đợt 1 (đổi dock là đổi vỏ, không tránh được), thêm ca "v6 đang chạy, mở app với sóng yếu rồi ngắt giữa chừng" vào `qa-offline-acceptance.md` bộ bắt buộc, phải qua trước khi lên prod.
3. **Trần KB cho `forfish.tin.v1` (50 bài + ảnh thu nhỏ) và `forfish.lo.v1` (ảnh lô ≤5).** Chưa bản nào đo; đây chính là lý do ADR 0004 ra đời (hạn ngạch chung WebKit, gói dự báo 16 ngày không tải lại được giữa biển). *Mặc định*: ảnh thu nhỏ ≤20 KB/ảnh, trần `tin.v1` 1,5 MB và `lo.v1` 1 MB, đo thật ở đợt 3 trước khi mở; khi đầy thì bỏ ảnh trước, bỏ bài sau, không bao giờ đụng `forfish.fc.*`.
4. **Lô cá có mang toạ độ không?** Ba bản chỉ nói "ẩn toạ độ với người không phải người mua trả phí", nhưng người mua trả phí có thể là chủ tàu khác. *Mặc định*: **không gửi GPS kèm lô**, chỉ cảng + giờ về; toạ độ chỉ thêm sau khi có cảng thí điểm yêu cầu rõ.
5. **Ngưỡng hồ sơ cảng: 5 SĐT/loài, 3 phiếu/tháng, lùi tỉnh ở ngưỡng 10 — cảng tàu 6–15 m sẽ trống lâu; đại lý SDVICO nhập hộ có tính không?** *Mặc định*: giữ 5/3/10; đại lý nhập hộ tính là 1 SĐT (SĐT đại lý); khi trống, hiện "đang hiện theo tỉnh X, N bà con xác nhận" + VASEP tuần + nút xác nhận, mất sóng hiện bản lưu kèm "Lưu lúc"; giá vẫn ngưỡng 3 SĐT/7 ngày, trung vị cắt 10%, chỉ SĐT có `skipper_profiles` báo. Chấp nhận thẻ "cảng tôi" kém thật ở cảng nhỏ trong 2–3 tháng đầu; hạ ngưỡng chỉ khi đo được tỷ lệ phiếu trùng SIM <10%.
6. **Ai duyệt bên mua, xác minh MST bằng gì, và bên mua chưa xác minh được làm gì?** *Mặc định*: SDVICO duyệt tay ở `/quan-tri` (người đứng cảng gọi xác nhận cơ sở có thật), MST tra Tổng cục Thuế công khai bằng tay rồi bấm "Đã xác minh" — **app không gọi API nào, không đối chiếu với danh sách SC/CC trong DataLake**; chưa xác minh: đăng ≤1 yêu cầu, không thấy "Sắp cập"; tên cơ sở trùng tên đã xác minh → cờ chờ. Hồ sơ bên mua không có dấu "sạch" nào ngoài dấu xác minh MST.
7. **Có thu phí bên mua không, từ đợt nào, hình thức gì?** Gói "thấy lô trước 2 giờ" đã bỏ (lô giờ khớp theo loài × cảng cho mọi bên mua đã duyệt). *Mặc định*: đợt 5 miễn phí hoàn toàn ở cảng thí điểm; sau 3 tháng, nếu ≥10 yêu cầu/tuần thì thu phí đăng yêu cầu vượt hạn mức (trên 5 yêu cầu mở hoặc cửa sổ >14 ngày), gán ở `/quan-tri` như premium, chưa có bảng đối chiếu CK riêng; không thu theo lô khớp để không thành hoa hồng trên cá. Cập nhật mục 6 khi chốt. Kèm: không bump contract SDWork vì webhook không chạm `market_listings` (Q7 cũ đã đóng).
8. **Cảng thí điểm nào, 5 bên mua đầu tiên tên gì, và nậu đang cho tàu vay vốn có cắt vốn khi tàu bị thấy trong "Sắp cập" không?** *Mặc định*: chọn 1 cảng có đại lý SDVICO đứng; SDVICO gọi 5 vựa/nhà máy trong CRM (họ đăng ký trong app như mọi bên mua, không nhập hộ từ CRM) trước đợt 5; mặc định "ai thấy" của lô là **chỉ mối quen**; nhóm "Sắp cập" ẩn danh chỉ hiện ≥3 chủ tàu ở cảng có ≥10 chủ tàu khai cảng nhà; chủ tàu khai cảng nhà = null + tỉnh nếu bến làng; đợt 5 không bắt đầu khi chưa ký được 5 bên mua. Cùng lúc: cho luật sư đọc mục 3.3 để chốt có mở bình luận bài bà con (đợt 4) trước khi có giấy phép MXH không — mặc định chỉ mở trong nhóm thử ≤200 người.

## 9. Nguồn (xem 20/10/2026)

Nội bộ: `docs/research/01, 04, 07, 08`; `docs/app-map/01, 02, 04, 07, 11, 12`; ADR 0004/0013/0014; `ops/qa-offline-acceptance.md`; `src/lib/dock-nav.ts`, `sw-cache-policy.ts`, `data-route-rules.ts`, `tier.ts`, `api-identity.ts`, `public/sw.js`; Forlife `lunar-family-reminders/docs/external/OA_PYTHON_AGENTS_GUIDE.md` + `supabase/functions/get-trending`.

Thị trường VN: vasep.com.vn/…83-600-chiec-30599 · vietnamnet.vn/…2260646 · htv.vn/…222261007121241605 · baohatinh.vn/…post312220, post311430 · nongnghiepmoitruong.vn/…d402076, d387149, d321042 · sggp.org.vn/ngu-dan-ra-khoi-cung-4g-post811300 · baolaocai.vn/…post911412 · tuoitre.vn/saigontimes/truy-xuat-nguon-goc (02/04/2026), …2025010317031443 · infonet.vietnamnet.vn/…137728 · vnexpress.net/…5108545, 5057599 · dantri.com.vn/…20261016091305858 · tienphong.vn/…552526 · vtv.vn/…20160405105657586 · diendandoanhnghiep.vn/…10184663 · doanhnghiephoinhap.vn/…80414 · danviet.vn/…d1464330 · nhandan.vn/…700871 · bnews.vn/…417026 · simplize.vn/co-phieu/SBV · vjol.info.vn/…134336 · thuonghieucongluan.com.vn/…a58061 · vov.vn/…1076338, 564152.

Thế giới: adaptation-undp.org (Abalobi fact sheet) · dailymaverick.co.za 2025-05-19 · undercurrentnews.com 2025/03/12 (Aruna) · cloud.google.com/customers/aruna · businesstoday.com.my 2026/07/25 (eFishery) · dealstreetasia.com ?p=426188 · venturebeat/seedrs (Fishbrain) · apps.apple.com id1121514756 · blog.huawei.com 2026/2/3 + qualcomm.com (Fisher Friend) · xlaxiata.co.id (Laut Nusantara) · newsinfo.inquirer.net ?p=1193770 + hakaimagazine (OurFish) · deccanchronicle …290117 (FreshToHome) · inc42.com (Captain Fresh) · eurofish.dk · pefa.com · rafisklaget.no · snf.no a05_21.pdf · seafoodsource.com (海洋一鲜来) · epaper.wifizs.cn 2025-02-14.

Pháp lý: luatvietnam.vn VBHN 155/2025 Luật SHTT (Điều 15, 25) · congluan.vn (NĐ 174/2026) · thuvienphapluat.vn 138039788, 138038091, 138041193 + lsvn.vn a150603 (NĐ 147/2024) · vneconomy.vn (Luật TMĐT 2025) · baolaocai.vn/…post902924 (NĐ 248/2026) · vietnamfinance.vn/…d129086 (NĐ 94/2025). Toàn văn Điều 24–28 NĐ 147 và số điều NĐ 174 chưa đọc được bản gốc — đối chiếu trước khi quyết.

RSS kiểm bằng curl: nongnghiepmoitruong.vn/thuy-san.rss, bien-dao.rss · thuysanvietnam.com.vn/feed · vnexpress.net/rss/thoi-su.rss · tuoitre.vn/rss/thoi-su.rss · thanhnien.vn/rss/thoi-su.rss (sống); báo Quảng Ngãi, Khánh Hoà, Biên phòng, Cà Mau, VASEP, NCHMF, Cục Thủy sản (chết hoặc chặn bot). Giá Haiku 5.5: skill claude-api (cache 2026-10-06).
