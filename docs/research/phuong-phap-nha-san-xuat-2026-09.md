# Phương pháp nhà sản xuất hải đồ — mổ quy trình Navionics / C-MAP / ENC quốc gia, 2026-09-02

> **Câu hỏi duy nhất**: các hãng đã bán được hải đồ Việt Nam 5 triệu/máy **sản xuất dữ
> liệu bằng quy trình nào**, và quy trình đó ánh xạ sang một xưởng nhỏ tự động hoá bằng
> script như SDFish ra sao?
>
> **Trả lời một dòng**: họ không phải công ty khảo sát — họ là **xưởng biên tập + đường
> ống cập nhật + kênh phân phối khoá**. Ba phần tư chuỗi của họ SDFish đã có bản tương
> đương chạy được bằng script; hai khâu thiếu thật là **CSDL nguồn tách khỏi sản phẩm**
> và **nhịp cập nhật thành dòng chảy**. Phần họ hơn tuyệt đối — dữ liệu khảo sát gốc —
> thì chính họ cũng **không tự làm** mà mua/mượn của nhà nước, và ở Việt Nam nhà nước
> công bố công khai đúng thứ đó.
>
> Nguồn web truy cập **2026-09-02**; số liệu repo lấy từ các tài liệu đo ngày ghi kèm.
> Chỗ nào là suy luận (hãng không công bố) thì ghi rõ **[suy luận]**.

---

## 0. Tóm tắt sáu dòng

1. Chuỗi ENC quốc gia có 7 bước chuẩn hoá: **khảo sát → CSDL nguồn → biên tập ô S-57 →
   kiểm định S-58 → kiểm định độc lập lần hai (RENC) → phân phối mã hoá → cập nhật ER
   hằng tuần đồng nhịp Thông báo hàng hải**. Bước nào cũng có tài liệu công khai.
2. Hãng tư nhân (Navionics, C-MAP) **bỏ bước khảo sát**: mua/li-xăng hải đồ chính thức,
   số hoá vào một CSDL riêng liền mạch, vẽ ký hiệu riêng, thêm lớp giá trị (đẳng sâu
   0,5 m từ sonar cộng đồng), phát hành **hằng ngày** trong định dạng khoá phần cứng.
3. Cái họ bán 5 triệu/máy ở Việt Nam, phần "ruột VN" là **biên tập lại nguồn nhà nước
   VN** — đúng nguồn SDFish đang bóc trực tiếp. Khác biệt của họ không nằm ở nguồn mà ở
   **kỷ luật đường ống**.
4. SDFish đã có tương đương chạy được của: thu thập nguồn, đối chiếu chéo, lý lịch từng
   đối tượng, kiểm định tự động, bộ ký hiệu riêng (§4 — chỉ đích danh script).
5. SDB (đo sâu từ vệ tinh) ở biển Việt Nam: **làm được** vùng nước trong (Nha Trang
   RMSE 1,1–2,0 m tới ~10 m sâu), **không làm được** ở đúng chỗ cần nhất — cửa sông
   phù sa (Định An, Soài Rạp, Hải Phòng). Sentinel-2 xác minh được **công trình cố
   định** tới ~10–15 m; **không xác minh được phao** (§3).
6. Ba bài học nên bắt chước: CSDL nguồn tách khỏi sản phẩm · cập nhật là dòng chảy có
   nhịp theo lớp · kiểm định tách khỏi sản xuất. Một cái không nên: **vẻ liền mạch che
   tuổi và độ tin của dữ liệu** (§5–§6).

---

## 1. Chuỗi sản xuất của họ — vẽ thành các bước

### 1.1 Chuỗi ENC quốc gia (nhà nước → tàu hàng) — chuỗi gốc mà mọi hãng tựa vào

Đây là chuỗi được tài liệu hoá đầy đủ nhất (IHO S-57/S-58/S-65, quy trình NOAA/IC-ENC):

| # | Bước | Ai làm | Làm gì cụ thể |
|---|---|---|---|
| 1 | **Khảo sát** | Cơ quan thuỷ đạc quốc gia | Đo sâu multibeam/singlebeam theo chuẩn S-44, đo bờ, đặt phao. Mỗi mẻ khảo sát mang **cấp tin cậy (ZOC)** |
| 2 | **Đánh giá nguồn** | Bộ phận nguồn | Xét từng nguồn mới (khảo sát, thông báo hàng hải, cơ quan phao đèn, cảng vụ): có đáng đưa vào hải đồ không, đè lên nguồn cũ nào |
| 3 | **CSDL nguồn** | Cả xưởng | Một CSDL **liền mạch, không chia ô** (kiểu CARIS HPD trên Oracle/PostgreSQL): mỗi đối tượng lưu **một lần** kèm lý lịch, rồi **nhiều sản phẩm** (ENC các tỉ lệ, hải đồ giấy, ấn phẩm) dẫn xuất từ đó. Sửa nguồn một lần → mọi sản phẩm nhận theo |
| 4 | **Biên tập ô** | Biên tập viên | Cắt CSDL nguồn thành ô S-57 theo 6 dải tỉ lệ (usage band), tổng quát hoá theo tỉ lệ, gán thuộc tính theo Object Catalogue (163 lớp) |
| 5 | **Kiểm định S-58** | Bộ phận QA của chính nhà sản xuất | Chạy bộ kiểm tự động (S-58: hàng trăm phép kiểm cấu trúc + logic), soát tay từng cảnh báo, **kiểm nhất quán giữa ô cạnh nhau**, và **mở lên ECDIS thật nhìn bằng mắt** |
| 6 | **Kiểm định độc lập lần hai** | RENC (IC-ENC của UKHO, PRIMAR của Na Uy) | Trung tâm **không phải người sản xuất** chạy lại toàn bộ kiểm định bằng nhiều công cụ khác nhau (Analyzer, dKart Inspector, công cụ riêng), phân loại từng lỗi theo tác động lên người dùng, rồi mới cho vào catalogue phát hành |
| 7 | **Phân phối** | RENC → đại lý (VAR) | Mã hoá S-63, bán qua đại lý, phủ toàn cầu ghép từ nhiều quốc gia |
| 8 | **Bảo trì** | Vòng lặp về bước 2 | **File cập nhật ER** (chỉ chứa phần thay đổi, không phát lại cả ô) — NOAA đẩy **mỗi tối ngày làm việc**, RENC theo tuần, **đồng nhịp với Notices to Mariners**: cùng một thay đổi ra cả bản giấy lẫn bản điện tử cùng lúc. Ô có vòng đời: bản mới (new edition) ↔ bản vá (update) ↔ khai tử |

Hai đặc trưng đáng chú ý nhất của chuỗi này:

- **Bước 3 là trái tim.** "Data-centric": sản phẩm chỉ là *khung nhìn* của CSDL nguồn.
  Teledyne CARIS bán đúng ý tưởng này suốt 20 năm cho phần lớn cơ quan thuỷ đạc thế giới.
- **Kiểm định chạy HAI lần bởi HAI tổ chức.** Người sản xuất tự kiểm (bước 5), rồi một
  trung tâm độc lập kiểm lại (bước 6). Lý do tồn tại của RENC chính là: người viết dữ
  liệu không được là người duy nhất phán dữ liệu đạt.

### 1.2 Chuỗi hãng tư nhân (Navionics / C-MAP → tàu cá, du thuyền)

Hãng tiêu dùng **không chạy bước 1** và thay bước 6–7 bằng thứ khác:

| # | Bước | Navionics / C-MAP làm gì |
|---|---|---|
| 1′ | **Gom nguồn** | Li-xăng hải đồ chính thức (giấy + ENC) từ các cơ quan thuỷ đạc; C-MAP nói thẳng: *"utilizes official government charts and transforms the already-digitized charts into its own proprietary format"* (CM-93). Navionics: *"derived from official surveys and community-sourced sonar data"*, cộng "dynamic data layers sourced from authoritative hydrographic offices" |
| 2′ | **Số hoá / hợp nhất** | Đưa mọi nguồn vào **một CSDL riêng liền mạch toàn cầu** (datacore của Navionics, CM93 của C-MAP — hơn 13.500 hải đồ đã hợp nhất). Đây là bản sao tư nhân của bước 3 ở trên |
| 3′ | **Lớp giá trị riêng** | Thứ nhà nước không có: **SonarChart** — sonar log do người dùng tải lên, xử lý ra đẳng sâu tới 0,5 m; C-MAP có bản tương đương (Genesis). Khảo sát riêng chủ yếu ở **hồ nội địa Mỹ** [suy luận từ dòng sản phẩm HD lakes — hãng không công bố chi tiết]. Cộng: ảnh vệ tinh phủ (Satellite Overlay), ký hiệu riêng, dữ liệu marina |
| 4′ | **Biên tập + kiểm** | Không công bố quy trình nội bộ. Biết chắc: có đội duyệt **Community Edits** (sửa đổi người dùng gửi phải qua duyệt mới phát), và ánh xạ layer của họ sang S-57 **không công bố** (đã ghi ở [do-phu-hai-do-2026-08.md §2.2](do-phu-hai-do-2026-08.md)) |
| 5′ | **Phát hành khoá** | Định dạng độc quyền + khoá theo thẻ nhớ/thiết bị + thuê bao năm. CM-93/3 bán như SENC "cài sẵn, chạy ngay" cho cả ECDIS |
| 6′ | **Cập nhật hằng ngày** | Navionics công bố: tích hợp sonar log + Community Edits + cập nhật hải đồ **mỗi ngày**; bản sửa có thể lên site trong **24 giờ** sau khi nhận |

**Đọc ra điều gì cho câu "5 triệu/máy":** phần ruột Việt Nam trong sản phẩm của họ, theo
chính mô tả của họ, là **hải đồ chính thức VN được biên tập lại** — cộng rất ít
crowdsource (đội tàu cá VN không chạy plotter có tính năng tải sonar log lên hãng).
Nghĩa là ở vùng biển Việt Nam, họ và SDFish **uống chung một giếng nguồn**; họ hơn ở
chỗ đã trả tiền mua bản gọn (hải đồ đã biên tập sẵn của nhà nước) trong khi SDFish đang
bóc bản thô (TBHH, sổ đăng ký, cổng ENC) — và hơn ở **kỷ luật đường ống** mô tả dưới đây.
[Suy luận — hãng không công bố hợp đồng nguồn từng nước; cơ sở: mô tả sản phẩm CM-93 và
Navionics ở trên, cộng thực tế UKHO cũng chỉ mới thêm được vài ô ENC VN (Vũng Tàu –
Cái Mép), tức nguồn ENC gốc VN mỏng với **mọi** người mua.]

### 1.3 Chu kỳ cập nhật — con số công bố được

| Sản phẩm | Nhịp |
|---|---|
| NOAA ENC | ô cập nhật đẩy lên **mỗi tối ngày làm việc** |
| RENC (IC-ENC/PRIMAR) → tàu hàng | theo **tuần**, đồng nhịp Notices to Mariners |
| NGA List of Lights (Pub 110–116) | bản in **mỗi năm**; CSDL trực tuyến sửa theo NtM **mỗi tuần** |
| Navionics | tích hợp và phát **mỗi ngày**; sửa đổi cộng đồng lên trong ~24 h |
| Việt Nam (VMS-North/South) | Thông báo hàng hải ra **liên tục** (độ sâu luồng đo lại hằng tháng ở luồng bồi lắng); sổ đăng ký tuyến luồng **không ghi ngày**, có dấu hiệu trễ nhiều năm ([do-phu-hai-do-2026-08.md §5.4](do-phu-hai-do-2026-08.md)) |

---

## 2. Họ xử lý nguồn không độc quyền như thế nào

| Nguồn | Cách họ dùng | Ghi chú cho SDFish |
|---|---|---|
| **Hải đồ chính thức các nước** | **Mua li-xăng** (royalty theo hợp đồng với từng cơ quan thuỷ đạc) rồi số hoá/hợp nhất — đây là đường chính của cả Navionics lẫn C-MAP | SDFish không mua được và không cần: bản thô cùng nội dung được VN công bố công khai (Điều 15 Luật SHTT — văn bản hành chính và số liệu không được bảo hộ) |
| **Hải đồ giấy cũ hết bản quyền** | Số hoá thẳng làm nền cho vùng không có nguồn mới [suy luận — thực hành ngành, hãng không liệt kê từng tờ] | Cùng logic "sự kiện không có bản quyền" SDFish đang dùng |
| **List of Lights các nước** | NGA Pub 110–116 là **public domain** (tác phẩm chính phủ Mỹ), tải tự do, có CSDL tra cứu sửa hằng tuần | `provenance.ts` đã đăng ký `nga-msi` license `public-domain`. Cổng NGA MSI từng 503 khi thử ([doi-chieu-nguon-2026-08.md](doi-chieu-nguon-2026-08.md)) — thử lại định kỳ |
| **Sonar/AIS cộng đồng** | **Tự thu qua thiết bị của chính khách hàng** (SonarChart/Genesis) — biến người mua thành đội khảo sát không lương, dữ liệu về tay hãng độc quyền | Chưa có tương đương; xem §6 bài học 2 (nhưng đừng làm trước khi có người dùng thật đông) |
| **Ảnh vệ tinh** | Lớp phủ trực quan (Satellite Overlay) + mua SDB từ nhà cung cấp chuyên (kiểu TCarta: SDB 10 m từ Sentinel-2, hiệu chuẩn bằng ICESat-2, đóng gói **theo chuẩn S-57/S-100** để bán cho người làm hải đồ) | Copernicus/Sentinel giấy phép mở — SDFish dùng thẳng, khỏi mua trung gian |
| **Chuẩn trao đổi phao đèn** | Ngành đang chuyển sang **IALA S-201** (đặc tả sản phẩm dữ liệu AtoN trên nền S-100): cơ quan phao đèn ↔ cơ quan thuỷ đạc trao đổi máy-đọc-được | Đáng đọc lướt S-201 một lần **chỉ để mượn danh sách trường** (vị trí, đặc tính, trạng thái hoạt động, ngày xác lập) khi thiết kế schema `vn-aids` — không cần tuân chuẩn |

**Nền pháp lý của dự án (giữ nguyên, không nới không thắt):** sự kiện (vị trí đèn, độ
sâu, đặc tính chớp) không có bản quyền; dữ liệu nhà nước VN công bố công khai dùng lại
được, không viết câu dè chừng nào cho nhóm này. ODbL của OSM cắn lên **tập hợp** —
lối ra đã chốt và **đã chạy thật**: OSM làm manh mối, xác minh độc lập, ghi lý lịch theo
nguồn xác minh ([ran-ve-lai-aca.md](ran-ve-lai-aca.md) đã tách được bộ rạn 100% sạch
ODbL đúng cách này). Cấm "adapted" của S-52 vẫn là cổng thật — bộ ký hiệu đã tự vẽ
(`public/icons/chart-sprite.*`). Nguồn buộc ghi "South China Sea"/tên Trung Quốc: loại.

---

## 3. Ảnh vệ tinh trong sản xuất hải đồ — làm được gì THẬT ở biển Việt Nam

### 3.1 SDB — đo sâu từ ảnh quang học

Số đo công bố (không phải quảng cáo của nhà cung cấp):

| Điều kiện | Kết quả đo được | Nguồn |
|---|---|---|
| Nước trong, ven bờ, ≤10 m | RMSE **1,99–4,74 m** (hồi quy kinh điển), **1,13–1,95 m** (Random Forest) | nghiên cứu tại **khu bảo tồn biển Nha Trang** — đúng biển VN |
| Nước trong, học sâu + đa thời điểm | RMSE ~**1,2 m**; chồng nhiều ảnh (multi-temporal stacking) luôn tốt hơn ảnh đơn | các nghiên cứu Sentinel-2 2019–2025 |
| Trần độ sâu | thực dụng **~10 m** ven bờ; nhà cung cấp thương mại (TCarta G-SDB, 10 m/pixel, hiệu chuẩn ICESat-2) nói "tới 30 m **tuỳ độ trong của nước**" | |
| **Nước đục phù sa** | hạt lơ lửng tán xạ ngược làm thuật toán **đoán cạn hơn thật** và sai không kiểm soát được — không có con số RMSE dùng được | tổng quan SDB vùng nước quang học phức tạp |

Đọc cho đúng ở bối cảnh Việt Nam:

- **SDB khớp đúng phần SDFish đã mạnh và trượt đúng phần SDFish đang thiếu.** Nước
  trong (Nha Trang, đảo, rạn Trường Sa) SDB chạy tốt — nhưng đó là vùng lớp rạn ACA
  5 m đã phủ. Còn cửa Định An, Soài Rạp, Hải Phòng — nơi [do-phu-hai-do-2026-08.md
  §4](do-phu-hai-do-2026-08.md) chỉ ra app nói sai 7 m về phía nguy hiểm — là nước đục
  bậc nhất khu vực: SDB **không cứu được**, chỉ có máy hồi âm của nhà nước (tức TBHH)
  cứu được. Đường ống OCR/bóc TBHH đang làm là đường **duy nhất**, không phải đường tạm.
- **SDB đo mặt nước tức thời, hải đồ tính từ số 0 hải đồ.** Muốn dùng SDB làm số đi
  biển phải quy về datum triều — biên độ triều VN 2,5–4 m, tức riêng khâu này sai bằng
  cả sai số thuật toán. Nhà cung cấp thương mại giải bằng mô hình triều + ICESat-2;
  xưởng nhỏ nên coi SDB là **lớp tham khảo tương đối** (chỗ này nông hơn chỗ kia),
  không phải số mét tuyệt đối.
- **ICESat-2 là "máy hồi âm miễn phí từ trời"**: lidar chấm theo vệt, xuyên nước trong
  vài chục mét, chính TCarta dùng nó làm chuẩn hiệu chuẩn/thẩm định cho SDB thương mại.
  Dữ liệu NASA mở. Với SDFish nó hợp vai **thẩm định điểm** (kiểm ETOPO/GEBCO ở mép rạn
  — chỗ [doi-chieu-nguon-2026-08.md](doi-chieu-nguon-2026-08.md) đo được 12/169 ô đảo
  đất↔nước) hơn là vai nguồn phủ diện.

### 3.2 Xác minh công trình bằng Sentinel-2 — độ chính xác thật

| Đại lượng | Số |
|---|---|
| Pixel Sentinel-2 (băng khả kiến) | **10 m** |
| Sai số định vị ảnh L1C (không cần điểm khống chế) | đặc tả **<20 m (2σ)**; đo thực tế **~11–12,5 m**, các bản xử lý sau ~14,5 m (2σ) |
| Bóc đường bờ tự động từ Sentinel-2 | RMSE **3,7–13,5 m** tuỳ kiểu bờ |

Nghĩa là, cho việc "một nguồn toạ độ + một ảnh vệ tinh = một điểm đã xác minh":

- **Xác minh ĐƯỢC**: đèn biển, đăng tiêu lớn, đê chắn sóng, cầu cảng, giàn khoan (giàn
  thì Sentinel-1 radar còn chắc hơn — điểm sáng cố định mọi thời tiết), đảo/bãi nổi.
  Công trình ≥1–2 pixel, đứng yên → ảnh trả lời được hai câu: **có tồn tại không** và
  **toạ độ nguồn có lệch quá ~10–15 m không**. Đủ tốt: mọi nét vẽ của app ở z14 là
  9,3 m/px ([phuong-phap-ban-do.md §1](phuong-phap-ban-do.md)).
- **Xác minh KHÔNG được**: **phao**. Thân phao 2–5 m là dưới pixel, lại trôi quanh xích
  neo vài chục mét. Phao chỉ xác minh được bằng nguồn giấy chéo nhau (sổ đăng ký ↔ TBHH
  ↔ List of Lights) — đúng việc `crossChecks` trong `provenance.ts` sinh ra để làm.
  Đừng hứa "đã xác minh vệ tinh" cho lớp phao.
- **Quy trình chuẩn hoá được** (mỗi đối tượng cố định một lần, lưu vào lý lịch):
  1. toạ độ từ nguồn giấy → 2. cắt ô ảnh Sentinel-2 L2A quanh toạ độ (±100 m là quá đủ)
  → 3. người nhìn: có khối sáng/bóng đổ đúng chỗ không, lệch bao nhiêu pixel → 4. ghi
  `crossChecks[]` mục mới: `{ against: "sentinel-2", ngày ảnh, lệch ước lượng m }` →
  5. lệch >2 pixel (~20 m) = treo cờ, không phát. Toàn bộ làm bằng script + một lượt
  mắt người; không cần GIS chuyên.

---

## 4. Khoảng cách giữa ta và họ — từng bước một

Đối chiếu chuỗi §1 với repo (chỉ đích danh; số liệu từ các doc đo 2026-08-29 → 09-02):

| Bước của họ | SDFish đã có | Trạng thái |
|---|---|---|
| 1. Khảo sát gốc | **Không có, và họ cũng không có** (họ mua). Bản thô cùng nguồn: kho TBHH 2.556 PDF đã kéo về (`scripts/fetch-soundings.mjs`), sổ đăng ký ENC (`generate-vn-aids.mjs`), List of AtoN 752 báo hiệu ([san-so-dang-ky-2026-09.md](san-so-dang-ky-2026-09.md)), 3 nguồn đèn biển (`generate-den-bien.mjs`) | ✅ tương đương về nguồn |
| 2. Đánh giá nguồn | Thứ tự ưu tiên hình học có lý do (B→A→C theo độ rõ hệ toạ độ, [den-bien-2026-09.md §2](den-bien-2026-09.md)); đối chiếu độc lập `scripts/compare-sources.mjs`; thẩm định lô `scripts/verify-soundings.mjs` (đã bắt được lô 57/TBHH mất chữ số lẻ) | ✅ có, chạy thật |
| 3. **CSDL nguồn liền mạch, một nguồn → nhiều sản phẩm** | **Thiếu.** Hiện mỗi `generate-*.mjs` đọc thẳng nguồn thô → ghi thẳng asset phát hành; "kho chữ" nằm ngoài repo không phiên bản; file ứng viên (List of AtoN đã bóc) nằm ngoài repo chờ Lead; không có ID ổn định cho từng phao/đèn xuyên các lần sinh | ❌ khâu thiếu lớn nhất |
| 4. Biên tập theo tỉ lệ | Luật ẩn/hiện theo việc của người đi biển + giản lược trong không gian pixel ([phuong-phap-ban-do.md §2](phuong-phap-ban-do.md)) — **khác cách của họ nhưng cùng vai, và đo được** | ✅ |
| 5. Kiểm định tự động + mắt người | `scripts/kiem-ban-do.mjs` (cổng zoom + đếm dữ liệu theo khung nhìn), `bench-map-method.mjs` (4 thước đo độ rõ), cổng vitest chặn nguồn bẩn (`reef-aca.test.ts` đỏ nếu `origin.source="osm"`), cổng "dữ liệu có mà không thấy" (`depth-layer.test.ts`), pre-commit hooks | ✅ — phần này **không thua kém** một xưởng nhỏ chuyên nghiệp |
| 5b. Đối chiếu con số với nhà nước | Đã làm kiểu RENC-thu-nhỏ: bóc 117/118 phao Định An, 64/64 Sông Tiền, 13/13 Ba Ngòi so với con số nhà nước tự công bố ([san-so-dang-ky-2026-09.md](san-so-dang-ky-2026-09.md)) | 🟡 làm thủ công từng phiên, chưa thành cổng bắt buộc |
| 6. Kiểm định độc lập lần hai | Không có tổ chức thứ hai — nhưng **mô hình teammate phản biện** đang đóng vai này ([thu-tu-uu-tien-2026-09.md](thu-tu-uu-tien-2026-09.md) bắt được 5 số sai/nói quá của Lead) | 🟡 có văn hoá, chưa có cơ chế |
| 7. Ký hiệu + trình bày | Bộ ký hiệu tự vẽ `chart-sprite` (né cấm "adapted" S-52), tương phản đo sau pha độ mờ, nhãn tiếng Việt — lớp nội dung Việt là tài sản riêng ([phuong-phap-ban-do.md §7](phuong-phap-ban-do.md)) | ✅ |
| 8. **Cập nhật ER — dòng chảy** | **Thiếu.** Chưa có `generatedAt` trên asset (hở O2), chưa có luật di trú phiên bản (hở H3), CLAUDE.md chốt "sinh lại là hành động có chủ ý" — **đúng cho rạn/bờ, sai nhịp cho phao và độ sâu luồng** vốn đổi hằng tháng theo TBHH. Chưa có gì theo dõi TBHH mới ra để sinh **bản vá** thay vì sinh lại cả file | ❌ khâu thiếu lớn thứ hai |
| 3′. Lớp giá trị crowdsource | Không có. App có GPS người dùng ngoài biển (nav-mode) nhưng không thu gì | ❌ (chưa đến lúc — cần đội người dùng trước) |
| Lý lịch/ZOC | `provenance.ts`: giấy phép + `crossChecks` + `confidenceOf` + `cleanPackage` — về cấu trúc là **ZOC-cộng-giấy-phép**, tinh hơn M_QUAL của S-57 | ✅ cấu trúc; ❌ chưa hiện lên màn hình (app chưa nói "số này tin được tới đâu" — trùng kết luận [do-phu-hai-do-2026-08.md](do-phu-hai-do-2026-08.md) về UNSARE) |

**Tóm khoảng cách bằng một câu**: ta đã có xưởng bóc–đối chiếu–kiểm định chạy được;
ta chưa có **cái kho ở giữa** (bước 3) và **cái đồng hồ** (bước 8).

---

## 5. Cái KHÔNG nên bắt chước

**Vẻ liền mạch che mất tuổi và độ tin của dữ liệu.**

Sản phẩm hãng tiêu dùng trông **đều tăm tắp mọi nơi**: cùng bảng màu, cùng mật độ ký
hiệu, phóng tới đâu cũng "có bản đồ". Nhưng bên dưới, ô này từ khảo sát multibeam 2023,
ô kia từ hải đồ vẽ giữa thế kỷ trước — và giao diện **không cho người lái biết mình
đang đứng trên ô nào**. ECDIS nhà nước ít ra còn lớp ZOC/M_QUAL và UNSARE (Display
Base, không tắt được); bản tiêu dùng thì ưu tiên cảm giác "phủ kín".

Với tàu hàng có hoa tiêu và hải đồ giấy dự phòng, đó là khuyết điểm chịu được. Với ngư
dân coi app là nguồn duy nhất, **liền mạch giả là dối trá ăn mặc đẹp**. Repo đã tự chứng
minh điều này hai lần: app nói "đủ sâu trên 12 m" ở chỗ TBHH đo 3,9 m, và 147 điểm đo
2019 vẽ y hệt điểm đo 2026 ([thu-tu-uu-tien-2026-09.md §2.1](thu-tu-uu-tien-2026-09.md)).
Đó chính là "phương pháp Navionics" lọt vào app qua đường vô thức. Luật ngược lại đã
có sẵn trong nhà — *"không bao giờ nói một điều app không biết"*
([phuong-phap-ban-do.md §5](phuong-phap-ban-do.md)) — phải để nó thắng mỗi khi hai bên
giằng nhau, kể cả khi bên kia nhân danh "cho giống hải đồ xịn 5 triệu".

*(Cũng đừng bắt chước định dạng khoá phần cứng + thuê bao cập nhật — nhưng cái đó không
ai trong dự án định làm, không cần cảnh báo dài.)*

---

## 6. Ba bài học nên bắt chước

### Bài 1 — Một CSDL nguồn, nhiều sản phẩm (bước 3 của họ)

Cái làm CARIS HPD đáng tiền suốt 20 năm: **đối tượng lưu một lần, sản phẩm là khung
nhìn**. Sửa một cái phao trong nguồn → mọi sản phẩm nhận theo, không sửa tay ở ba chỗ.

Bản xưởng-script cho SDFish, không cần Oracle: một thư mục nguồn **có phiên bản** (kho
chữ TBHH, bảng đã bóc, file ứng viên — hiện đang rải ngoài repo), mỗi đối tượng một
**ID ổn định** (đèn: tên + toạ độ làm tròn; phao: tuyến + số hiệu) sống xuyên các lần
sinh, và mọi `generate-*.mjs` đọc từ kho đó thay vì mỗi script tự đi chợ. Có ID ổn định
thì mới có được bài 2 (bản vá thay vì sinh lại) và mới trả lời được "phao số 5 luồng
X đổi gì so với tháng trước". Việc này cũng gỡ đúng cái kẹt hiện tại: file ứng viên
752 báo hiệu đang **không có chỗ hợp lệ để nằm** trong repo.

### Bài 2 — Cập nhật là dòng chảy có nhịp theo lớp, không phải mẻ (bước 8 của họ)

Điều làm Navionics phát được **hằng ngày** không phải đội biên tập đông, mà là **đường
từ "nguồn đổi" tới "người dùng thấy" đã tự động từ đầu đến cuối**, và mỗi lớp có nhịp
riêng. Ánh xạ thẳng:

| Lớp | Nhịp nguồn VN | Nhịp nên đặt |
|---|---|---|
| Đèn biển | đứng yên hàng chục năm | năm/lần, xác minh vệ tinh một lần |
| Phao, độ sâu luồng | TBHH ra liên tục, luồng bồi đo lại hằng tháng | **theo dõi feed TBHH** → sinh bản vá khi có thông báo chạm tuyến mình phủ |
| Rạn, bờ, đẳng sâu | nguồn gốc đổi theo năm | "sinh lại có chủ ý" như CLAUDE.md — giữ nguyên |

Kèm hai thứ họ làm mà ta ghi được ngay: mỗi asset mang `generatedAt` (hở O2 — nhỏ, đã
nằm trong danh sách việc), và mỗi đối tượng ghi **thông báo nào chạm nó lần cuối**
(`prov.origin.url` đã có sẵn chỗ ghi). "Đồng nhịp NtM" phiên bản SDFish = một dòng trong
app: *"phao này theo TBHH số …, ngày …"* — đó là thứ 5 triệu/máy cũng không nói được.

### Bài 3 — Người kiểm không phải người làm (bước 5–6 của họ)

Cả ngành chấp nhận trả chi phí một tổ chức riêng (RENC) chỉ để **chạy lại kiểm định
bằng công cụ khác, mắt khác**, phân loại lỗi theo tác động lên người dùng — vì họ biết
người sản xuất tự soát sẽ mù đúng chỗ mình sai. Repo đã thấy y hệt: phản biện độc lập
bắt được "557 điểm" thực ra là 369, "trắng hoàn toàn" thực ra không trắng
([thu-tu-uu-tien-2026-09.md §1](thu-tu-uu-tien-2026-09.md)); cổng `kiem-ban-do.mjs`
ra đời vì "mắt người không phải công cụ đo". Việc còn thiếu là **thể chế hoá**: mọi mẻ
sinh dữ liệu an toàn (phao/đèn/độ sâu) trước khi vào `public/data/` phải qua (a) cổng
đối chiếu con số nhà nước kiểu 117/118 — tự động, đỏ là chặn; (b) một phiên/người
**không phải người viết script** soát báo cáo sinh. Tốn một lượt đọc; RENC tốn cả một
toà nhà — cùng một nguyên lý.

---

## 7. Chưa biết / chưa xác nhận — nói thẳng

- **Quy trình biên tập nội bộ của Navionics/C-MAP** (bao nhiêu người, công cụ gì, kiểm
  gì trước khi phát): không công bố. Mọi mô tả bước 4′ ở trên dựng từ mô tả sản phẩm
  công khai, có gắn [suy luận] tại chỗ.
- **Hợp đồng nguồn dữ liệu VN của hai hãng** (mua của ai, bản nào, năm nào): không công
  bố. Kết luận "cùng giếng nguồn" là suy luận có cơ sở, không phải tài liệu.
- **Độ chính xác SDB tại chính cửa Định An / Hải Phòng**: chưa có nghiên cứu công bố
  nào đo ở đó (con số Nha Trang là nước trong, không ngoại suy được). Kết luận "không
  làm được ở nước đục" dựa trên cơ chế vật lý được tài liệu hoá, chưa có RMSE địa phương.
- **ICESat-2 có vệt đo dùng được quanh rạn VN không, mật độ bao nhiêu**: chưa dò. Đáng
  một phiên riêng nếu muốn thẩm định mép rạn.
- **Hải đồ giấy VN của Hải quân/Đoàn đo đạc**: chuỗi phát hành và điều kiện tiếp cận
  chưa tra trong phiên này — mọi nguồn nhà nước đã dùng đều thuộc nhánh Bộ GTVT
  (Vinamarine/VMS). Nhánh quân đội là ô trắng của tài liệu này.

---

## 8. Nguồn

**Chuỗi ENC quốc gia**

- [IHO S-65 — ENCs: Production, Maintenance and Distribution guidance](https://iho.int/iho_pubs/standard/S-65/S-65_ed2%201%200_June17.pdf)
- [Hydro International — ENC Life Cycle](https://www.hydro-international.com/content/article/enc-life-cycle) *(truy cập qua tóm tắt tìm kiếm; trang chặn fetch trực tiếp)*
- [IHO S-58 Ed 7.0.0 — ENC Validation Checks](https://iho.int/uploads/user/pubs/standards/s-58/S-58%20Ed%207.0.0_Final.pdf)
- [IC-ENC — quy trình kiểm định (blog đào tạo validator)](https://www.ic-enc.org/news/a-blog-by-laura) · [IC-ENC Validation Training Course](https://journals.lib.unb.ca/index.php/ihr/article/download/22835/26523/34819)
- [NOAA — ENC cập nhật mỗi tối ngày làm việc](https://nauticalcharts.noaa.gov/updates/noaa-encourages-all-mariners-to-use-noaa-enc-for-latest-updates-and-other-advantages/) · [NOAA ENC](https://www.nauticalcharts.noaa.gov/charts/noaa-enc.html)
- [Teledyne CARIS HPD — một nguồn, nhiều sản phẩm](https://www.teledynecaris.com/en/products/hpd/) · [Hydro International — Cartography at the Source](https://www.hydro-international.com/content/article/cartography-at-the-source)
- [UKHO thêm ENC Việt Nam (Vũng Tàu – Cái Mép)](https://safety4sea.com/ukho-adds-vietnam-electronic-navigational-charts/)

**Hãng tư nhân**

- [Navionics — SonarCharts (sonar cộng đồng, cập nhật hằng ngày)](https://www.navionics.com/sonarcharts) · [SuperyachtNews — Navionics community-sourced chart updates](https://www.superyachtnews.com/fleet/navionics_sonarcharts_communitysourcing_navigational_chart_updates) · [Navionics — Satellite Overlay](https://www.navionics.com/usa/charts/features/satellite-overlay)
- [Wikipedia — Navionics (1984, Geonav; 2017 về Garmin)](https://en.wikipedia.org/wiki/Navionics)
- [MarineLink — C-MAP: "utilizes official government charts… transforms into its own proprietary format" (CM-93, >13.500 hải đồ)](https://www.marinelink.com/article/navigation/cmap-standard-electronic-charts-703) · [PC Maritime — C-MAP ENC+/CAES từ PRIMAR + CM-ENC](https://www.pcmaritime.com/chart-data/c-map-chart/)

**Phao đèn, List of Lights**

- [NGA Pub 112 — List of Lights (public domain, CSDL sửa theo NtM hằng tuần)](https://msi.nga.mil/api/publications/download?key=16694312/SFH00000/UpdatedPub112bk.pdf&type=view) · [Tổng quan USCG/NGA light lists](https://www.offshoreblue.com/nav/light-list.php)
- [IALA S-201 — AtoN Information Product Specification](https://www.iala.int/technical/data-modelling/iala-s-200-development-status/s-201/) · [IHO — S-201](http://s100.iho.int/product%20specification/division-search/s-201-aids-to-navigation-information)

**SDB + xác minh vệ tinh**

- [VJES — SDB máy học tại khu bảo tồn biển Nha Trang (RMSE 1,13–1,95 m)](https://vjs.ac.vn/jse/article/view/24020)
- [Hydro International — Sentinel-2 SDB in optically complex waters](https://www.hydro-international.com/content/article/sentinel-2-satellite-derived-bathymetry-in-optically-complex-waters) · [Tổng quan SDB Sentinel-2](https://www.tandfonline.com/doi/full/10.1080/15481603.2019.1685198) · [MDPI — SDB học sâu + nội suy thích nghi](https://www.mdpi.com/2072-4292/17/15/2594)
- [TCarta — G-SDB 10 m, tới 30 m tuỳ độ trong, hiệu chuẩn ICESat-2, đóng gói S-57/S-100](https://tcarta.com/satellite-derived-bathymetry/) · [TCarta + ICESat-2 (NSF grant)](https://geospatialworld.net/news/tcarta-icesat-2-bathymetric-product/) · [TCarta SDB bổ trợ hải đồ chính thức vùng nông](https://amerisurv.com/2025/02/21/tcarta-announces-satellite-derived-bathymetry-product-to-supplement-official-nautical-charts-in-shallow-coastal-zones/)
- [eoPortal — Sentinel-2 (định vị <20 m 2σ)](https://www.eoportal.org/satellite-missions/copernicus-sentinel-2) · [Copernicus Sentinel-2 Cal/Val (~11–14,5 m 2σ đo thật)](https://www.tandfonline.com/doi/full/10.1080/22797254.2019.1582840)
- [ScienceDirect — đường bờ từ Sentinel-2 RMSE 3,7–13,5 m (SAET)](https://www.sciencedirect.com/science/article/pii/S0378383923001503)

**Trong repo** — [do-phu-hai-do-2026-08.md](do-phu-hai-do-2026-08.md) ·
[phuong-phap-ban-do.md](phuong-phap-ban-do.md) ·
[thu-tu-uu-tien-2026-09.md](thu-tu-uu-tien-2026-09.md) ·
[doi-chieu-nguon-2026-08.md](doi-chieu-nguon-2026-08.md) ·
[ran-ve-lai-aca.md](ran-ve-lai-aca.md) · [den-bien-2026-09.md](den-bien-2026-09.md) ·
[bao-hieu-mien-nam-2026-09.md](bao-hieu-mien-nam-2026-09.md) ·
[san-so-dang-ky-2026-09.md](san-so-dang-ky-2026-09.md) ·
[ocr-mien-bac-2026-09.md](ocr-mien-bac-2026-09.md) ·
[kho-pdf-chua-doc-2026-09.md](kho-pdf-chua-doc-2026-09.md) ·
`src/lib/provenance.ts` · `scripts/kiem-ban-do.mjs` · `scripts/verify-soundings.mjs` ·
`scripts/compare-sources.mjs`
