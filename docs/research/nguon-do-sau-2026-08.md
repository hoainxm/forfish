# Nguồn dữ liệu độ sâu cho vùng biển Việt Nam — rà soát 2026-08

> **Ngày truy cập mọi nguồn: 2026-08-29.** Mọi con số "đo được" trong tài liệu này là kết quả tự truy vấn API/tải dữ liệu, không phải trích lại từ tài liệu khác. Chỗ nào không tra được đều ghi rõ.
>
> **Bối cảnh**: SDFish hiện chỉ có ETOPO 2022 15″ (~450 m) — mô hình nội suy từ vệ tinh, không có một điểm đo sâu khảo sát thật nào. Câu hỏi: nguồn mở có lấp được khoảng cách với hải đồ thương mại (C-MAP, Navionics — đẳng sâu tới 0,5 m dựng trên khảo sát thật) không?

---

## 1. Kết luận thẳng

**Lấp được một phần, và phần lấp được lớn hơn nhiều so với kết luận trước đó — nhưng không lấp được đều.** Vùng biển VN tách thành ba mảnh có số phận hoàn toàn khác nhau:

| Vùng | Lấp được tới đâu | Bằng gì |
|---|---|---|
| **Đảo/rạn ngoài khơi** (Trường Sa, Hoàng Sa) | ✅ **Lấp gần hết** — 10 m, sai số 0,82 m, ngang hải đồ thương mại | HHU24SWDSCS (CC BY 4.0) |
| **Luồng — cửa biển — vũng cảng** | ✅ **Lấp bằng khảo sát THẬT**, chính xác hơn cả hải đồ thương mại, cập nhật 2 tháng/lần | Thông báo hàng hải VN |
| **Thềm lục địa ven bờ ngoài luồng** (nơi bà con đánh bắt nhiều nhất) | 🟡 **Chỉ lấp được dạng vệt rời** — không có lưới liền | ATL24 (lidar vệ tinh, đo thật, 0–20 m) |

**Nói gọn**: nguồn mở lấp được *hai đầu* — rạn ngoài khơi và luồng vào cảng — còn *khúc giữa* (thềm 10–200 m dọc bờ) chỉ có **vệt laser rời rạc**, không có lưới liền. Muốn có đẳng sâu liền mạch ở khúc giữa thì vẫn phải mua/xin, **hoặc** tự dựng SDB lấy ATL24 làm điểm hiệu chuẩn.

**Lead trước sai ở chỗ nào**: kết luận "phải mua ENC" đúng cho khúc giữa, nhưng bỏ sót (a) Thông báo hàng hải là khảo sát thật, công khai, có toạ độ máy đọc được, và (b) đã có sẵn dữ liệu 10 m phủ Trường Sa/Hoàng Sa dưới giấy phép cho dùng thương mại.

**Nhưng có một rào cản lớn hơn kỹ thuật**: xem [§5 Rào cản pháp lý](#5-rào-cản-pháp-lý-việt-nam--đọc-trước-khi-làm-bất-cứ-gì). Một số việc trong danh sách này **không nên làm** cho tới khi có ý kiến pháp lý, dù dữ liệu hoàn toàn mở.

### 🔴 Phát hiện gấp — ảnh hưởng ngay tới thứ SDFish ĐANG chạy

**Cả ETOPO 2022 lẫn GEBCO đều cấm dùng cho hàng hải / an toàn trên biển.** Đây không phải suy đoán, là nguyên văn điều khoản (tự kiểm chứng 2026-08-29):

| Nguồn | Giấy phép | Ràng buộc sử dụng — nguyên văn |
|---|---|---|
| **ETOPO 2022** (SDFish đang dùng) | **CC0-1.0** (sạch nhất) | *"**Not to be used for navigation.** Although these data are of high quality and useful for planning and modeling purposes, they are not suitable for navigation."* |
| **GEBCO** (mọi phiên bản) | Public domain | *"The GEBCO Grid should **NOT** be used for navigation or for any other purpose involving safety at sea."* |

→ SDFish đang hiển thị độ sâu ETOPO **trong bối cảnh dẫn đường và đi biển**. Giấy phép cho phép dùng thương mại và cho phép nhúng vào sản phẩm, nhưng **loại trừ mục đích hàng hải**.

**Việc phải làm, không tranh cãi**: mọi màn có độ sâu phải có câu cảnh báo tiếng Việt đời thường, kiểu *"Độ sâu chỉ để tham khảo. Không thay hải đồ. Đi biển vẫn phải xem hải đồ và máy dò của tàu."* Việc này khớp đúng luật đã có trong `CLAUDE.md`: *"Không hứa độ chính xác dữ liệu mà nguồn không đảm bảo."* Đây cũng là lý do vì sao **Thông báo hàng hải (§4.2) có giá trị vượt trội**: nó là văn bản hàng hải chính thức, không dính điều khoản loại trừ này.

---

## 2. Bảng xếp hạng theo giá trị ÷ công sức

| # | Nguồn | Phủ vùng VN | Độ phân giải / mật độ thật | **Dùng thương mại?** | Lấy về | Công sức | Giá trị/Công |
|---|---|---|---|---|---|---|---|
| 1 | **HHU24SWDSCS** | Trường Sa 57,9% điểm · Hoàng Sa 23,7% · **ven bờ 0%** | 10 m, 29,4 triệu điểm, RMSE 0,82 m | ✅ **CC BY 4.0** — được, ghi nguồn | 1 file 88 MB, Zenodo | **2–3 ngày** | ★★★★★ ⚠️ |
| 2 | **Thông báo hàng hải VN** | Luồng, cửa biển, vũng cảng toàn quốc · ~3.500 thông báo độ sâu | Khảo sát thật 200 kHz, toạ độ WGS-84 DMS, độ sâu tới 0,1 m | ✅ Không thuộc phạm vi bảo hộ (Đ15 LSHTT) — *cần luật sư chốt* | Scrape web + parse PDF | **8–12 ngày** | ★★★★★ |
| 3 | **GEBCO 2026** (hoặc ETOPO 2022) | Toàn bộ | 15″ (~450 m) — bằng ETOPO, nhưng chính xác hơn (SWOT) | ✅ Public domain / ETOPO là **CC0** — thương mại OK, 🔴 **nhưng cấm dùng cho hàng hải** → bắt buộc có disclaimer | 1 file NetCDF | **1–2 ngày** | ★★★★☆ |
| 4 | **ATL24 (ICESat-2)** | 2.373 granule ven bờ · **đo được điểm đáy thật ở cả vùng nước đục** (cửa Mekong 19.173 điểm/hộp) | Vệt laser dọc tuyến, 0–40 m | ✅ NASA — miễn phí, không hạn chế | SlideRule / earthaccess / S3 | **5–8 ngày** | ★★★★☆ |
| 5 | **Allen Coral Atlas** | Rạn san hô (chưa đo riêng phần VN) | 10 m, chỉ <15 m sâu | ✅ **CC BY 4.0** | Tải theo vùng | **3–5 ngày** | ★★★☆☆ |
| 6 | **Sentinel-2 SDB tự làm** | 0–20 m nước trong; **hỏng ở vùng đục** | 10 m, RMSE 0,35–1,2 m (nước trong) | ✅ Copernicus mở | Tự xử lý ảnh | **20–40 ngày** | ★★☆☆☆ |
| 6b | **S2Shores** (nghịch đảo sóng) | Toàn cầu ven bờ — **chạy được ở nước đục** | **1 km (30″)** — thô hơn ETOPO · RMSE 2–5 m | 🟡 Toolbox mở; điều khoản bộ dữ liệu **cần xác nhận** | Chưa rõ DOI | — | ★☆☆☆☆ |
| 7 | **NCEI trackline (single-beam)** | 81 khảo sát trong EEZ, 28 ven bờ | Vệt tàu rời rạc, **1962–1999** | ✅ Public domain quốc tế | Đặt hàng qua form | **4–6 ngày** | ★★☆☆☆ |
| 8 | **NCEI multibeam** | **Chỉ 8 khảo sát** toàn EEZ, đều là tuyến chạy qua vùng sâu | Dày trên vệt, nhưng không chạm thềm đánh bắt | ✅ Public domain | Tải trực tiếp | 3–5 ngày | ★☆☆☆☆ |
| 9 | **GMRT** | **Đo được: 2/42 ô mẫu có đo sâu thật, đều ở lòng chảo sâu** | 61 m trên vệt — nhưng vệt gần như không tồn tại ở VN | ✅ Mở | API lưới | — | ☆☆☆☆☆ **loại** |
| 10 | **IHO DCDB / CSB** | **Đo được: 0 điểm** toàn VN + ĐNÁ | — | CC0 (nếu có dữ liệu) | API | — | ☆☆☆☆☆ **loại** |

⚠️ = có cảnh báo pháp lý nghiêm trọng, xem §5.

---

## 3. Ba nguồn nên làm trước

### 3.1. GEBCO 2026 — làm ngay, rẻ nhất, không rủi ro
Thay thẳng ETOPO 2022. Cùng độ phân giải 15″ nên **không mịn hơn**, nhưng bản 2026 dùng SRTM15+ v2.8 với trường trọng lực từ vệ tinh **SWOT** — chính xác hơn hẳn ở vùng sâu. Giấy phép nói thẳng được "commercially exploit". Công sức ~1–2 ngày vì pipeline lưới + đẳng sâu của SDFish đã có sẵn, chỉ đổi nguồn đầu vào.

**Vì sao trước**: rủi ro bằng không, công sức thấp nhất, cải thiện ngay nền bản đồ hiện tại.

### 3.2. Thông báo hàng hải — giá trị cao nhất trên mỗi ngày công, và là thứ bà con dùng thật
Đây là nguồn bị bỏ quên đáng tiếc nhất. Nó **là khảo sát thật**, không phải nội suy, và **mới hơn mọi hải đồ thương mại** (C-MAP cập nhật theo quý; TBHH cập nhật tới 2 tháng/lần cho luồng đông tàu).

**Vì sao trước**: đây là chỗ tàu cá thực sự dễ mắc cạn — cửa biển và luồng ra vào, không phải giữa Biển Đông. Giá trị an toàn trên mỗi đồng bỏ ra cao nhất trong toàn bộ danh sách.

### 3.3. ATL24 — lấp phần thềm ven bờ, nguồn duy nhất làm được việc đó
Là nguồn **duy nhất** trong cả danh sách có đo thật (laser) ở vùng thềm ven bờ ngoài luồng. Dữ liệu dọc tuyến nên không phủ kín, nhưng có thể dùng làm điểm hiệu chuẩn (ground truth) cho SDB Sentinel-2 sau này — đây là cách các nghiên cứu SCS đang làm.

**Vì sao trước**: mở đường cho hướng tự làm SDB mà không phải thuê tàu khảo sát.

> **Không xếp HHU24SWDSCS vào ba việc đầu dù nó đứng số 1 về giá trị/công sức** — vì rào cản ở §5 phải được giải quyết trước, và đó là việc của luật sư chứ không phải của kỹ thuật.

---

## 4. Chi tiết từng nguồn

### 4.1. HHU24SWDSCS — độ sâu 10 m cho đảo/rạn Biển Đông ⚠️

- **Là gì**: mô hình độ sâu nước nông toàn Biển Đông, dựng bằng ICESat-2 (1.298 tuyến laser) + Sentinel-2 (70 ảnh), công bố trên *Earth System Science Data* (Copernicus), 10/6/2025.
- **URL**: https://essd.copernicus.org/articles/17/2463/2025/ · dữ liệu https://doi.org/10.5281/zenodo.13852568
- **Giấy phép**: **CC BY 4.0** — dùng thương mại được, bắt buộc ghi nguồn. (Xác nhận trong metadata Zenodo: `"license": {"id": "cc-by-4.0"}`.)
- **Kích thước**: 1 file `HHU24SWDSCS.nc` 88,2 MB (HDF5) + Readme.

**Đo thật (tự tải về, phân tích, rồi xoá):**

| Chỉ số | Giá trị |
|---|---|
| Tổng số điểm | **29.404.904** |
| Dải độ sâu | 0 → **48,3 m** |
| Phạm vi | lon 111,19–117,85 · lat 4,96–20,78 |
| Điểm trong hộp Hoàng Sa | **6.962.784** (23,68%) |
| Điểm trong hộp Trường Sa | **17.019.639** (57,88%) |
| **Điểm ven bờ VN (lon < 110)** | **0** (0,00%) |
| Số đảo/rạn | 128 (87 trong hộp Trường Sa, 35 trong hộp Hoàng Sa) |

**Điểm gần các thực thể Việt Nam đang giữ** (đo trong bán kính ±0,06°):

| Thực thể | Số điểm |
|---|---|
| Song Tử Tây | 641.048 |
| Tốc Tan (vùng lân cận) | 556.615 |
| Đá Tây | 414.139 |
| Sinh Tồn | 126.567 |
| Nam Yết | 21.300 |
| Trường Sa Lớn | **0** |

- **Độ chính xác công bố**: RMSE 0,82 m toàn vùng; 0,53–1,24 m theo tiểu vùng; kiểm chứng độc lập bằng lidar hàng không 1,01 m.
- **Công sức**: 2–3 ngày (đọc HDF5 → lọc theo vùng → nội suy về lưới → sinh đẳng sâu; pipeline SDFish đã có).

**⚠️ Ba cảnh báo bắt buộc đọc:**

1. **Pháp lý** — xem §5.2. Đây là bản đồ địa hình của "quần đảo, đảo, bãi cạn lúc chìm lúc nổi, bãi ngầm", trùng đúng mô tả một mục **Tối mật** trong Quyết định 562/QĐ-TTg.
2. **Chủ quyền / tên gọi** — dataset do **Đại học Hà Hải (Hohai University, Trung Quốc)** sản xuất, trường `islandName` dùng **toàn bộ địa danh Trung Quốc** (Nanzi Island = Song Tử Tây, Zhongye Island = Thị Tứ, Xisha = Hoàng Sa, Nansha = Trường Sa). Nếu dùng, **bắt buộc thay toàn bộ tên bằng tên Việt Nam**; SDFish đã có nguyên tắc nhãn chủ quyền VN nên đây là việc bắt buộc, không phải tuỳ chọn.
3. **CC BY buộc ghi nguồn** — nghĩa là phải hiển thị "Hohai University" trong app. Cần cân nhắc mặt truyền thông cho một app ngư dân Việt Nam. Không có cách né: bỏ attribution là vi phạm giấy phép.

### 4.2. Thông báo hàng hải Việt Nam — khảo sát thật, công khai, máy đọc được

- **Nơi công bố**: https://vmsa.vn/thong-bao-hang-hai-247 (Tổng công ty Bảo đảm an toàn hàng hải VN — HTTP 200) · https://enc.vinamarine.gov.vn (HTTP 200, cert lỗi, phải bỏ qua verify) · https://vimawa.gov.vn (Cục Hàng hải và Đường thuỷ VN, HTTP 200).
  - `vms-north.vn` và `www.vms-south.vn` **đã chết** (DNS không phân giải, 2026-08-29) — hai tổng công ty miền Bắc/miền Nam đã hợp nhất về `vmsa.vn`.
- **Quy mô đo được**: phân trang theo offset (`/thong-bao-hang-hai-247/20`, `/40`, … `/8160`), 20 thông báo/trang. Trang cuối (offset 8160) còn 13 mục → **tổng ≈ 8.173 thông báo**, 409 trang. Có bộ lọc theo tỉnh/vùng biển.
- **Tỉ lệ thông báo độ sâu**: đếm trên 3 trang mẫu (offset 20, 4000, 8160) → **13/30, 13/30, 4/13** tiêu đề chứa "thông số kỹ thuật" ≈ **43%** → ước **~3.500 thông báo độ sâu** trong kho.
- **Phần thưởng kèm theo**: kho này còn có thông báo **vật chướng ngại và xác tàu đắm** (ví dụ *"Về việc di dời Sà lan QNg-0286 bị đắm tại luồng hàng hải Dung Quất"*) và thông báo phao báo hiệu — dữ liệu an toàn mà ETOPO không bao giờ có.
- **Định dạng**: trang HTML + **PDF tải trực tiếp** theo mẫu `https://vmsa.vn/baodam/upload/files/TBHH/TBHH<năm>/<số>.pdf`. Đã kiểm: `TBHH2025/784.pdf` → 200, 653 KB; `TBHH2025/100.pdf` → 200, 502 KB. ID không liên tục (nhiều số trả 302), nên phải lấy link từ trang chi tiết chứ không đoán số.

**Nội dung PDF — đây là điểm quyết định.** Trích thật từ TBHH số 784/TBHH-CVHHQNg ngày 24/10/2025:

```
Tên điểm | Hệ VN-2000              | Hệ WGS-84
B14      | 15°23'43.0" 108°47'30.4" | 15°23'39.2" 108°47'37.0"
C        | 15°23'44.6" 108°47'30.4" | 15°23'40.9" 108°47'37.0"
...
Độ sâu đạt: 7.2m (bảy mét hai).
Lưu ý: Dải cạn có độ sâu từ 6.6m đến 6.9m, nằm dọc theo tuyến mép cầu cảng...
```

→ **Có toạ độ, cả VN-2000 lẫn WGS-84, dạng DMS, parse được bằng regex.** Có độ sâu khống chế tới 0,1 m. Có mô tả dải cạn kèm khoảng cách. Đo được 32 chuỗi toạ độ DMS trong 1 file 3 trang.

- **Phương pháp đo**: "độ sâu được xác định bằng máy hồi âm tần số 200kHz tính đến mực nước số '0' Hải đồ" — **khảo sát thật**, quy về số 0 hải đồ, cùng chuẩn với hải đồ thương mại.
- **Tần suất cập nhật**: theo **Thông tư 05/2026/TT-BXD** (hiệu lực 01/4/2026), tần suất khảo sát chấm điểm theo thang 100: luồng ≥85 điểm khảo sát **2 tháng/lần**; luồng 45–54 điểm → 2 năm/lần; ≤44 điểm → 3 năm/lần.
- **Hạn chế thật**: TBHH cho **độ sâu khống chế theo đoạn/vùng** + polygon toạ độ, **không phải đám mây điểm**. Không thay được SOUNDG của hải đồ. Nhưng nó nói đúng thứ tàu cần biết: "đoạn này sâu bao nhiêu, chỗ nào cạn".

**Giấy phép — cột quyết định:**
- Footer site ghi "Copyright © 2025 VMC. All Rights Reserved."
- **Nhưng**: Điều 15 Luật Sở hữu trí tuệ loại khỏi phạm vi bảo hộ quyền tác giả: *"văn bản quy phạm pháp luật, văn bản hành chính, văn bản khác thuộc lĩnh vực tư pháp và bản dịch chính thức"*, và **"quy trình, hệ thống, phương pháp hoạt động, khái niệm, nguyên lý, số liệu"**. TBHH do Cảng vụ Hàng hải (cơ quan nhà nước) ban hành = văn bản hành chính; độ sâu = số liệu. → **Nội dung TBHH không được bảo hộ quyền tác giả**, dòng "All Rights Reserved" không tạo ra quyền.
- 🟡 **Cần luật sư chốt** trước khi dựng sản phẩm thương mại trên nền này. Lập luận vững nhưng chưa có án lệ.

- **Công sức**: 8–12 ngày (crawler phân trang + trích link PDF + parser DMS/độ sâu + đối chiếu tên luồng + job cập nhật định kỳ). Đã kiểm chứng `pypdf` trích được text sạch.

### 4.3. GEBCO 2026 — nền toàn cầu, thay ETOPO

- **URL**: https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid
- **Phát hành**: 4/2026. Lưới 15″ (43.200 × 86.400 ≈ 3,7 tỷ điểm). NetCDF4, bản toàn cầu 7,0 GB; lưới TID 3,5 GB.
- **Mới gì**: dùng SRTM15+ v2.8 với trường trọng lực từ **SWOT** + học máy cải tiến.
- **Giấy phép**: public domain, "may be used free of charge", cho phép tường minh *"Commercially exploit The GEBCO Grid, by, for example, combining it with other information, or by including it in their own product or application"* kèm ghi nguồn.
- 🔴 **Ràng buộc loại trừ**: *"The GEBCO Grid should **NOT** be used for navigation or for any other purpose involving safety at sea."* + tuyên bố miễn trách nhiệm "as is". **ETOPO 2022 có ràng buộc tương đương**: *"Not to be used for navigation… not suitable for navigation"*, dù giấy phép là **CC0-1.0** (sạch hơn GEBCO về mặt bản quyền). Xem cảnh báo ở §1.
- **Chọn cái nào**: ETOPO 2022 = **CC0-1.0**, giấy phép sạch nhất tuyệt đối. GEBCO 2026 = mới hơn, chính xác hơn (SWOT), nhưng điều khoản dài hơn. Cả hai cùng 15″ và cùng cấm dùng cho hàng hải → **chọn theo chất lượng, không phải theo giấy phép**: GEBCO 2026.
- **GEBCO 2025** (8/2025) công bố **27,3%** đáy đại dương đã đo theo chuẩn hiện đại (2024: 26,1%) — **không tìm được số bóc tách riêng cho Biển Đông**.
- **Thẳng thắn**: cùng 15″ nên **không mịn hơn ETOPO**. Đây là nâng cấp chất lượng, **không phải** lời giải cho khoảng cách với hải đồ thương mại.

### 4.4. ATL24 — lidar vệ tinh, nguồn duy nhất chạm được thềm ven bờ

- **URL**: https://nsidc.org/data/atl24/versions/2
- **Là gì**: sản phẩm NASA ICESat-2 L3A "Along Track Coastal and Nearshore Bathymetry" — độ cao đáy biển và mặt biển **đã hiệu chỉnh khúc xạ**, kèm sai số. V1 ra 01/4/2025, V2 ra 2026. Phủ toàn cầu 88°N–88°S, từ 14/10/2018 tới nay.
- **Đo thật**: truy vấn NASA CMR với hộp ven bờ VN (105–112°E, 8–18°N) → **CMR-Hits: 2.373 granule**. Xác nhận `cloud_hosted: true`, có spatial subsetting.
- **Khả năng**: laser xanh xuyên tới **40 m** ở nước đủ trong.
- **Lấy về**: earthaccess (Python), icepyx, Harmony subsetting, AWS S3 (us-west-2), SlideRule. Cần tài khoản Earthdata (miễn phí).
- **Giấy phép**: dữ liệu NASA — miễn phí, mở, không hạn chế thương mại. Trang NSIDC không nêu điều khoản riêng; theo chính sách dữ liệu NASA là full & open. 🟡 *Cần xác nhận* nếu bán lại licence.
**🔬 Đo thật — điểm đáy ATL24 thu được trong vùng biển VN** (qua SlideRule `atl24x`, hộp ~0,15–0,20°, tích luỹ 2018→2026):

| Vị trí | Granule (CMR) | **Điểm đáy thu được** | Dải độ cao đáy (5–95%) |
|---|---|---|---|
| **Cửa Mekong** *(nước đục)* | 45 | **19.173** | −13,6 → +0,4 m |
| Nha Trang / Hòn Mun *(nước trong)* | 38 | **4.018** | −18,3 → +0,1 m |
| Hạ Long *(nước đục)* | 41 | **3.666** | −16,9 → 0,0 m |
| Phú Quốc | 45 | **2.580** | −18,6 → 0,0 m |
| Trường Sa / Đá Tây | 41 | **40.123** | −13,9 → −0,1 m |

> ✅ **Kết quả bác bỏ nỗi lo ban đầu**: ATL24 **vẫn cho điểm đáy ở vùng nước đục** — cửa Mekong ra **19.173 điểm**, cao nhất trong nhóm ven bờ, gấp ~5 lần Nha Trang nước trong. Lý do có thể là vùng cửa sông rất nông (đáy trong tầm với của laser) bù lại cho độ đục.
>
> ⚠️ **Cảnh báo khi đọc con số này**: chưa lọc theo cờ độ tin cậy/phân loại của ATL24. Một phần điểm ở vùng đục có thể là nhiễu hoặc bắt vào tầng phù sa lơ lửng thay vì đáy thật. **Trước khi dùng phải lọc theo `confidence`/`class_ph` và đối chiếu với TBHH cùng khu.** Nhưng về mặt "có dữ liệu hay không" thì câu trả lời đã rõ: **có, và nhiều hơn dự đoán.**

- **Hạn chế còn lại**: **dọc tuyến, không phủ kín** — là các vệt laser cách nhau hàng km, không phải lưới. Không dùng trực tiếp để vẽ đẳng sâu; giá trị lớn nhất là làm **điểm hiệu chuẩn cho SDB** và **kiểm chứng chéo** cho ETOPO/GEBCO.

### 4.5. Allen Coral Atlas — rạn san hô, giấy phép sạch

- **URL**: https://allencoralatlas.org/resources/
- **Giấy phép**: *"Allen Coral Atlas maps, bathymetry and map statistics are © 2018-2023 Allen Coral Atlas Partnership and Arizona State University and licensed **CC BY 4.0**"* → **dùng thương mại được**.
- **Thông số**: bản đồ nền 5 m (từ Planet Dove + Sentinel-2); lớp bathymetry 10 m; lớp geomorphic chỉ tới **<15 m sâu**, benthic <10 m.
- **Phủ VN**: sản phẩm **toàn cầu cho mọi rạn san hô** (dựng từ 1,17 triệu ảnh Planet Dove + 1,05 triệu cảnh Sentinel-2, 2018–2020) → rạn VN (Hoàng Sa, Trường Sa, Phú Quốc, Nha Trang, Côn Đảo) nằm trong phạm vi. **Không tra được** con số diện tích riêng cho Việt Nam — API công khai không truy cập được (`/api/regions/` trả 404), phải đăng nhập cổng tải để đo.
- **Công sức**: 3–5 ngày. Giá trị chồng lấn nhiều với HHU24SWDSCS ở ngoài khơi, nhưng **không dính cảnh báo tên gọi Trung Quốc** → có thể là lựa chọn thay thế an toàn hơn về truyền thông cho vùng rạn.

### 4.6. Sentinel-2 SDB tự làm — làm được, nhưng đắt và hỏng ở chỗ cần nhất

- **Thuật toán**: Stumpf log-band-ratio (tỉ số log băng lam/lục) là chuẩn; xu hướng 2024–2025 chuyển sang học máy + hiệu chuẩn bằng **ICESat-2** thay vì đo tàu.
- **Sai số thực tế theo tài liệu**: 0,35–0,65 m (random forest, 0–13,5 m); 0,42–1,18 m (ICESat-2 + Sentinel-2); 0,97 m (rạn san hô); 2–5 m cho dải 10–40 m bằng nghịch đảo sóng.
- **Đã có nghiên cứu ở Việt Nam**: "Machine learning approaches for satellite-derived bathymetry in tropical coastal waters: A comparative study from **Nha Trang** marine protected area, Vietnam", *Vietnam Journal of Earth Sciences*, 2025 — https://vjs.ac.vn/jse/article/view/24020 (trang trả 403, không lấy được số RMSE cụ thể). Và "Nhật Lệ estuary, Quảng Bình" trên *Vietnam Journal of Marine Science and Technology* — https://vjs.ac.vn/jmst/article/view/22634
- **Vấn đề chí mạng**: sông Hồng nằm trong nhóm **đục nhất Đông Nam Á**; vùng cửa Mekong tải phù sa lớn. SDB quang học **hỏng ở nước đục** — đúng những nơi tàu cá ven bờ hoạt động nhiều nhất. Hệ số Stumpf lại phụ thuộc từng vùng, phải hiệu chuẩn riêng cho mỗi khu.
- **Công sức**: 20–40 ngày và cần người biết viễn thám. **Không nên làm trước** khi đã khai thác xong ATL24 (vì ATL24 chính là nguồn hiệu chuẩn).

### 4.6b. S2Shores — nguồn duy nhất KHÔNG sợ nước đục, nhưng quá thô

Đáng ghi lại vì nó giải đúng điểm yếu chí mạng của SDB quang học ở §4.6, nhưng lại vướng điểm khác.

- **Là gì**: "Global 1-km Coastal Bathymetry from Sentinel-2 Wave Inversion using the Satellite-to-Shores (S2hores) Toolbox", *Scientific Data* (Nature), 2025. CNES–LEGOS chạy **>1 triệu ảnh Sentinel-2**, suy độ sâu từ **tốc độ lan truyền sóng**, không phải từ màu nước.
- URL: https://www.nature.com/articles/s41597-025-06402-w · mã nguồn mở https://github.com/CNES/S2Shores
- **Ưu điểm quyết định**: vì dùng vật lý sóng chứ không phải độ trong, nó **chạy được ở nước đục** — đã kiểm chứng trên bờ biển bùn Guyane và cửa sông Gironde. Đây là thứ duy nhất tìm được có tính chất này.
- **Nhược điểm chí mạng**: phân giải **1 km (30″)** — **thô hơn cả ETOPO 450 m hiện tại**. Sai số 2–5 m cho dải sâu 10–40 m (tức 10–25% ở vùng thềm).
- **Giấy phép / DOI dữ liệu**: **không tra được** (Nature chặn qua IdP, PubMed đòi cookie). Toolbox trên GitHub là mã nguồn mở; bộ dữ liệu thành phẩm chưa xác nhận được điều khoản.
- **Kết luận**: **không dùng để vẽ bản đồ**. Chỉ có giá trị tiềm năng làm lớp *hiệu chỉnh sai lệch hệ thống* cho GEBCO/ETOPO ở dải thềm 10–40 m nước đục. Ưu tiên thấp — ghi lại để người sau khỏi tìm lại.

### 4.7–4.8. NOAA NCEI — public domain nhưng gần như trống ở VN

**Đo thật qua ArcGIS REST của NCEI, hộp EEZ VN (102–118°E, 5–23°N):**

| Lớp | Số khảo sát |
|---|---|
| Multibeam Bathymetric Surveys | **8** |
| Marine Trackline Surveys: Bathymetry | **81** (28 trong hộp ven bờ 105–112°E, 8–18°N) |
| NOS Hydrographic Surveys | **0** (đúng dự đoán — chỉ có Hoa Kỳ) |

8 khảo sát multibeam: RC2611, RC2614 (*Robert D. Conrad*, 1985), MGL0905 (2009), TN354, TN358 (*Thomas G. Thompson*, 2018 — 791 và 1.084 triệu beam), SR1912 (2019), EQT190012, EQT20210702 (*Fugro Equator*, 2019/2021 — 913 triệu và 1,24 tỷ beam). Số beam lớn nhưng **đều là tuyến chạy qua vùng nước sâu**, dài 598–7.832 km — xem §4.9 để thấy chúng không chạm thềm đánh bắt.

Trackline ven bờ chủ yếu **1962–1999** (LUSI02AR, V1908, KH7201, RC1710, ODP184JR…) — đo đơn tia, vệt thưa, số liệu 30–60 năm tuổi.

- **Giấy phép**: *"Data received by NGDC are in the international public domain"*, "free to the public with no restrictions". Định dạng MGD77T.
- **Lấy về**: multibeam tải trực tiếp; trackline qua form đặt hàng `ngdc.noaa.gov/trackline/request/?surveyIds=<ID>`.
- **Kết luận**: giá trị thấp cho mục tiêu đánh bắt ven bờ. Có thể dùng kiểm chứng chéo vùng sâu.

### 4.9. GMRT — đã loại, có số liệu chứng minh

Giả thuyết: GMRT mịn hơn ETOPO ở nơi tàu khảo sát đa tia đi qua. **Đã kiểm và bác bỏ cho vùng VN.**

Cách đo: gọi `GridServer` với `layer=topo-mask` — lớp này **chỉ trả về ô có dữ liệu đo thật**, ô nội suy trả `-2147483648`. Lưới 5,49e-4° ≈ **61 m**.

**Kết quả 5 hộp ven bờ/rạn:**

| Hộp | % ô có dữ liệu thật | Trong đó là đo sâu biển |
|---|---|---|
| Nha Trang (109,2 / 12,1) | 5,99% | **0 — toàn bộ là độ cao đất liền** |
| Phan Thiết (108,0 / 10,5) | 9,67% | **0 — toàn bộ đất liền** |
| Hạ Long (107,0 / 20,4) | 8,67% | **0 — toàn bộ đất liền** |
| Vũng Tàu ngoài khơi | 0,32% | 0 |
| Trường Sa (112,0 / 9,0) · Hoàng Sa tây | **0,00%** | 0 |

**Lưới 42 ô mẫu 0,25° phủ toàn EEZ** (lon 106–116, lat 8–20): chỉ **2/42 ô** có bất kỳ ô đo sâu biển nào (112°E/10°N: 58.881 ô; 116°E/16°N: 9.724 ô) — cả hai đều ở **lòng chảo sâu**, không ô nào trên thềm đánh bắt. Mọi ô "có dữ liệu thật" khác đều là **độ cao đất liền từ SRTM**, giá trị dương.

→ **GMRT không đóng góp gì cho vùng biển VN.**

### 4.10. IHO DCDB / Crowdsourced Bathymetry — đã loại, đo được số 0

- **API**: `https://q81rej0j12.execute-api.us-east-1.amazonaws.com/count?bbox=...` (tài liệu: https://github.com/CI-CMG/pointstore-api-docs)
- **Giấy phép**: **CC0 1.0** (public domain) — nếu có dữ liệu thì hoàn toàn dùng thương mại được.

**Đo thật:**

| Vùng | Số sounding |
|---|---|
| Vịnh Bắc Bộ | **0** |
| Miền Trung | **0** |
| Vũng Tàu / Đông Nam Bộ | **0** |
| Trường Sa | **0** |
| Hoàng Sa | **0** |
| Vịnh Thái Lan | **0** |
| Singapore / Malacca | **0** |
| Philippines | **0** |
| *Biển Bắc (kiểm chứng API)* | *1.905.152* |
| *Chesapeake, Hoa Kỳ (kiểm chứng)* | *70.795.611* |

API hoạt động bình thường (trả hàng triệu điểm ở nơi khác) → **con số 0 là thật, không phải lỗi truy vấn**. `/platforms` cho toàn Đông Nam Á trả mảng rỗng.

→ **DCDB hiện không có gì cho VN.** Và §5.3 giải thích vì sao việc *đóng góp* dữ liệu vào đây cũng không phải lối ra.

---

## 5. Rào cản pháp lý Việt Nam — đọc trước khi làm bất cứ gì

> Đây là phần quan trọng nhất tài liệu. Nó không đổi được bằng kỹ thuật.

### 5.1. Đo đạc hải đồ là việc của Bộ Quốc phòng

**Luật Đo đạc và bản đồ 2018 (số 27/2018/QH14), Điều 27**: nội dung đo đạc, thành lập hải đồ gồm *"đo đạc, cập nhật toạ độ, độ sâu đáy biển, các đối tượng địa lý trên mặt biển, trong lòng biển, đáy biển"*. Phân công:
- **Bộ Quốc phòng** tổ chức đo đạc, thành lập hải đồ **vùng biển Việt Nam và vùng biển liền kề**.
- **Bộ Giao thông vận tải** (nay Bộ Xây dựng) tổ chức đo đạc, thành lập hải đồ **vùng nước cảng biển và luồng hàng hải**.

→ Chính sự phân công này giải thích vì sao **Thông báo hàng hải được công bố công khai** (lane Bộ GTVT/Xây dựng) còn hải đồ vùng biển thì không. Đây là lý do kỹ thuật-pháp lý khiến §4.2 là con đường mở hợp pháp rõ ràng nhất.

Điều 51 + 52: kinh doanh dịch vụ đo đạc bản đồ phải **có giấy phép**; người phụ trách kỹ thuật cần bằng đại học chuyên ngành + ≥5 năm kinh nghiệm.

### 5.2. Quyết định 562/QĐ-TTg (10/3/2025) — danh mục bí mật nhà nước

Đã kiểm chéo **ba** nguồn (baochinhphu.vn, vasi.mae.gov.vn, xaydungchinhsach.chinhphu.vn). Ba mục liên quan:

| Mục | Độ | Nguyên văn |
|---|---|---|
| Bản đồ đảo/bãi ngầm | **TỐI MẬT** | *"Bản đồ về địa hình, địa chất, tài nguyên và môi trường các quần đảo, đảo, bãi cạn lúc chìm lúc nổi, bãi ngầm **có tỷ lệ lớn hơn 1:10.000**"* |
| Trường sóng âm | **TỐI MẬT** | *"Số liệu, bản đồ, sơ đồ về **trường sóng âm** các vùng biển Việt Nam"* |
| Số liệu gốc đo đạc | **MẬT** | *"Hệ thống số liệu gốc đo đạc quốc gia bao gồm số liệu gốc của hệ toạ độ quốc gia, hệ độ cao quốc gia, hệ trọng lực quốc gia, **độ sâu quốc gia**"* |

> ✅ **Đã giải quyết nghi vấn nêu ở bản nháp trước**: cụm **"độ sâu quốc gia" CÓ** trong mục độ Mật — xác nhận bằng hai nguồn độc lập (vasi.mae.gov.vn và xaydungchinhsach.chinhphu.vn). Bản tin baochinhphu.vn chỉ trích rút gọn.

**🔑 Ngưỡng 1:10.000 là chìa khoá của toàn bộ hồ sơ này.** Mục Tối mật **không** cấm mọi bản đồ đáy biển — chỉ cấm loại **chi tiết hơn 1:10.000**. Suy ra:

| Nguồn | Độ phân giải | Tỷ lệ tương đương | Đứng ở đâu so với ngưỡng |
|---|---|---|---|
| ETOPO / GEBCO | ~450 m | ~1:1.000.000 | ✅ **Rất xa ngưỡng — an toàn** |
| S2Shores | 1 km | thô hơn nữa | ✅ an toàn |
| Allen Coral Atlas | 10 m | ~1:10.000 | 🟡 **sát ngưỡng** |
| **HHU24SWDSCS** | **10 m** | **~1:10.000** | 🔴 **chạm đúng ngưỡng, và đối tượng là bãi ngầm/đảo** |

> 🔴 **Kết luận về HHU24SWDSCS**: nó rơi đúng vào giao của hai điều kiện — *đối tượng* (quần đảo, bãi cạn lúc chìm lúc nổi, bãi ngầm) và *tỷ lệ* (10 m ≈ 1:10.000). Đây là lý do phải hỏi luật sư trước, không phải sau.
>
> Sắc thái cần luật sư phân xử: quy định mật hoá **tài liệu do nhà nước VN sản xuất**, không đương nhiên cấm sử dụng dữ liệu nước ngoài đã công bố mở về cùng thực thể. Nhưng một doanh nghiệp Việt Nam **phát hành bản đồ độ sâu 10 m của bãi ngầm Trường Sa** là rủi ro thật, cả pháp lý lẫn chính trị. **Không tự quyết.**
>
> 💡 **Đường vòng nếu luật sư nói không**: hạ độ phân giải xuống thô hơn 1:10.000 (ví dụ regrid về 30–50 m) thì ra khỏi phạm vi mục Tối mật, mà vẫn mịn hơn ETOPO ~10 lần. Cần luật sư xác nhận cách đọc này.

Ngoài ra Điều 6 Luật Đo đạc và bản đồ nghiêm cấm phát tán thông tin bí mật nhà nước.

**Đối chiếu ngược — cái KHÔNG mật**: Quyết định 969/QĐ-TTg (7/7/2020) cho lĩnh vực GTVT **không liệt kê hải đồ hay khảo sát độ sâu luồng**. Đây là chỗ dựa cho §4.2: **độ sâu luồng hàng hải là hàng hoá công khai, không phải bí mật.**

### 5.2b. Ba nghị định khác chặn đường, phải biết trước

1. **Nghị định 27/2019** (hướng dẫn Luật ĐĐBĐ): *"đo đạc, thành lập bản đồ địa hình đáy biển"* và *"hải đồ"* là hoạt động **phải có giấy phép**. → Nếu SDFish **tự dựng bản đồ độ sâu** từ dữ liệu thu thập, không chỉ hiển thị lại nguồn có sẵn, thì cần giấy phép. 🟡 Ranh giới "hiển thị lại" vs "thành lập bản đồ" **cần luật sư vạch rõ** — đây là câu hỏi quyết định mô hình sản phẩm.
2. **Nghị định 73/2017 Điều 20**: cấm chuyển dữ liệu tài nguyên–môi trường (gồm biển đảo) cho **bên thứ ba** trừ khi hợp đồng ghi rõ. → Nếu sau này xin được dữ liệu nhà nước, **mỗi người dùng app là một bên thứ ba** — hợp đồng bắt buộc phải có điều khoản này, nếu không thì dữ liệu xin được cũng không phát hành ra app được. *(Bản PDF chính thức là ảnh scan không có lớp text; điều khoản đối chiếu từ hai CSDL luật độc lập — nên để luật sư đọc bản gốc.)*
3. **Nghị định 18/2020**: phạt **30–40 triệu ₫** khi lưu hành và **40–50 triệu ₫** khi xuất bản sản phẩm bản đồ **không thể hiện hoặc thể hiện sai** chủ quyền/biên giới quốc gia. → Nhãn chủ quyền Hoàng Sa/Trường Sa trong SDFish không phải chuyện "làm cho đẹp", nó là **nghĩa vụ pháp lý có chế tài**. `CLAUDE.md` đã ghi nhận nhãn chủ quyền VN — giữ nguyên và không được bỏ.
4. **Nghị định 41/2016**: tổ chức/cá nhân **nước ngoài** nghiên cứu khoa học trong vùng biển VN phải xin phép, nộp hồ sơ trước **6 tháng**. → Ảnh hưởng nếu thuê vendor nước ngoài đo đạc.

### 5.3. Thu thập độ sâu từ tàu cá — kỹ thuật dễ, pháp lý chặn

Kỹ thuật hoàn toàn khả thi:
- Máy dò cá phổ biến ở VN (Furuno FCV-627 ~24,7 triệu ₫; GP-1670F ~38,7 triệu ₫) **xuất chuẩn NMEA 0183 câu DPT/DBT/DBS** — đúng câu IHO B-12 yêu cầu.
- Logger mở **WIBL** (ESP32, CCOM/UNH) chỉ **~30–50 USD/tàu** phần cứng.
- Độ chính xác thực tế của mô hình này đã được chứng minh: nghiên cứu Olex trên **8,6 tỷ điểm từ ~10.000 tàu cá** đạt tương quan Spearman **0,99** với dữ liệu kiểm chứng, lưới 75 m — **mịn hơn GEBCO hơn 100 lần**. Đánh giá độc lập khác cho chênh lệch trung bình **18 cm**, đạt **IHO S-44 Order 1a**.

Nhưng ba chốt chặn:

1. **Luật VN** (§5.1, §5.2) — đo đạc hải đồ vùng biển VN thuộc Bộ Quốc phòng; kinh doanh dịch vụ đo đạc phải có giấy phép.
2. **Không có đường ra quốc tế** — IHO B-12 §1.3: dữ liệu CSB thu trong vùng biển thuộc quyền tài phán của quốc gia **chưa thông báo ủng hộ CSB** cho Ban Thư ký IHO sẽ **không được nạp**, chỉ lưu trữ. Chỉ ~30–34 quốc gia đã đồng ý; **>20 GB dữ liệu CSB đang bị giữ lại**. **Không tra được** vị thế chính thức của Việt Nam — báo cáo CSBWG gửi IRCC16 (2024) không nhắc tới VN. Theo cơ chế mặc định, dữ liệu vùng biển VN sẽ **bị lọc bỏ**. Một số nước từ chối với lý do nguyên văn: bathymetry trong lãnh hải là *thông tin mật* nên CSB *bị luật cấm*.
3. **Trusted Node buộc CC0** — ký thoả thuận nghĩa là **từ bỏ vĩnh viễn** quyền với dữ liệu, không thu hồi được. Ngược hoàn toàn với ý định bán licence dữ liệu của SDFish.

**VMS không giúp gì**: thiết bị giám sát hành trình bắt buộc (NĐ 26/2019 → NĐ 41/2026) chỉ truyền **vị trí + thời gian**, tần suất 2–3 giờ/lần, sai số toạ độ ≤500 m — **không có cảm biến độ sâu**. Dữ liệu do Cục Thuỷ sản độc quyền quản lý; **không tra được** cơ chế cấp cho bên thứ ba.

**Hướng khả dĩ nếu vẫn muốn đi đường này**: mô hình **C-MAP Genesis Edge** (99 USD/năm) — người dùng giữ dữ liệu **riêng tư, mã hoá**, chỉ chia sẻ khi tự nguyện. Né được vấn đề công bố ra kho quốc tế, và hợp với `customers.tier` sẵn có. Nhưng **vẫn phải hỏi ý kiến Bộ Quốc phòng / Văn phòng Thuỷ đạc Việt Nam TRƯỚC**, không phải sau.

---

## 6. Chỗ thật sự phải mua hoặc xin — không có đường mở

| Cần gì | Vì sao không có nguồn mở | Đi đâu |
|---|---|---|
| **Đẳng sâu chi tiết thềm ven bờ 10–200 m, ngoài luồng** | Không nguồn mở nào phủ: HHU24 = 0 điểm ven bờ; GMRT = 0; CSB = 0; ATL24 chỉ dọc tuyến; SDB hỏng ở nước đục | Hải đồ giấy/ENC VN (VMSA), hoặc C-MAP/Navionics |
| **Điểm đo sâu rời (SOUNDG) chuẩn hải đồ** | Đặc quyền hải đồ chính thức | ENC S-57/S-101 |
| **Vật chướng ngại, xác tàu đắm** | TBHH có nêu lẻ tẻ, không hệ thống | ENC |

**Hải đồ giấy Việt Nam** (nguồn chính thức, tự tra được):
- Danh mục trên web VMSA liệt kê ~**69 hải đồ**, tỉ lệ chủ yếu **1:75.000 và 1:25.000** (có 1:15.000–1:40.000), phát hành 2015–2024, phủ từ Quảng Ninh tới Cà Mau. URL: https://vmsa.vn/thuy-dac-428/san-pham-hai-do-giay-429/hai-do-giay-12022-2.html
- Catalogue PDF chính thức của MHE-South cho số hiệu chi tiết hơn: **`VN300015`–`VN300034`** (20 mảnh tuyến vận tải ven biển, **1:75.000**, có toạ độ góc khung) và **`VN4<mã cảng>NNN`** cho vùng nước cảng/luồng (VD `VN4QN001` Luồng Quy Nhơn **1:10.000**, `VN4BĐ001` Bồ Đề 1:25.000). Dải tỉ lệ toàn catalogue **1:2.000 → 1:75.000**.
  https://mhe-south.vn/storage/publication_categories/August2020/09.6.2020-VMS-SOUTH%20CHART%20CATALOGUE.pdf
  Chuẩn kỹ thuật ghi trong catalogue: *"Độ sâu ghi bằng mét, tính từ mặt chuẩn số 0 Hải đồ, xấp xỉ LAT… WGS84. Phép chiếu Mercator."* Có dịch vụ **Print On Demand**.
  *(Hai danh mục đánh số khác nhau — web VMSA và PDF MHE-South. Chưa đối chiếu được vì sao; nhiều khả năng là hai vùng quản lý Bắc/Nam.)*
- **VMS-North**: 107 mảnh hải đồ giấy (1:25.000 và 1:75.000) + 105 ô ENC. Liên hệ 0225 3837 994 · vmsn.hsdnorth@gmail.com. *(Website `vms-north.vn` / `hsd-north.vn` không phân giải DNS — kiểm hai lần từ hai hướng.)*
- Liên hệ VMSA: Số 01 Lô 11A đường Lê Hồng Phong, P. Hải An, Hải Phòng · +84-225.3550517 · vmsc-office@vmsa.vn · MHE-South: kinhdoanh@mhe-south.vn · +84 28 6268 0897
- **Không đơn vị nào niêm yết giá.**
- ⚠️ **Biểu phí khai thác dữ liệu đo đạc bản đồ (TT 47/2024/TT-BTC, từ 1/9/2024)** có giá cho bản đồ địa hình đất liền (1:25.000 = 130.000 ₫/mảnh; CSDL nền địa lý 1:10.000 = 850.000 ₫/mảnh) nhưng **không có mục nào cho bản đồ địa hình đáy biển / dữ liệu biển** → chưa có kênh dân sự chính thức để mua bathymetry nhà nước theo biểu phí.
- 🟡 **Việc nên làm**: gửi thư hỏi thẳng VMSA về **licence dữ liệu độ sâu cho ứng dụng di động thương mại**. Đây là con đường hợp pháp, đúng cơ quan, và chưa ai trong dự án thử. Rẻ hơn nhiều so với mua C-MAP và không dính vấn đề chủ quyền.

**ENC Việt Nam — CÓ TỒN TẠI và CÓ phân phối quốc tế** *(sửa lại nhận định sai ở bản nháp trước của chính tài liệu này)*:

- Việt Nam **có mã nhà sản xuất ENC riêng theo chuẩn IHO S-62**: **V1 = Vietnam Maritime Safety Corporation (miền Bắc)**, **V2 = VMS-South**. Chuyển từ mã cũ "VN" sang V1/V2 từ **28/5/2020 (tuần 22/2020)**. Xác nhận qua thông báo kỹ thuật của NAVTOR và IHO S-62 registry (https://registry.iho.int/producercode/list2.do).
- Quy tắc đặt tên ô: `V1230001` (General), `V1300001` (Coastal), `V14N0003` (Approach).
- Danh mục ENC trên web VMSA: https://vmsa.vn/san-pham-dich-vu-245/danh-muc-hai-do-dien-tu-12023-2.html — **117 ô ENC**.
- **Có phân phối qua PRIMAR và AVCS/UKHO.** Việt Nam **không** là thành viên IC-ENC.

> ⚠️ **Nhưng vẫn không dùng được cho SDFish**: ENC phân phối dưới mã hoá **S-63**, bán licence theo ô/năm và **chỉ cấp cho thiết bị ECDIS đã được type-approve**. Không có kênh cấp phép cho ứng dụng di động tiêu dùng. Đây là rào cản **mô hình phân phối**, không phải rào cản giá.

→ Nghĩa là: mua ENC qua kênh quốc tế **không giải quyết được vấn đề của SDFish**. Đường thực tế vẫn là **thương lượng licence dữ liệu trực tiếp với VMSA** — càng củng cố việc gửi thư hỏi ở §8.

### 6b. Hai đầu mối trong nước đáng gõ cửa

**VODIC — Cơ sở dữ liệu biển quốc gia** (https://nodc.gov.vn/, ✅ 200)
Đây là phát hiện đáng chú ý: API công khai của cổng này khai báo **15 danh mục dữ liệu, trong đó có đúng `DHDB` = "Địa hình đáy biển"** — **nhưng DHDB không nằm trong danh sách thư mục đã publish**, và không map service nào trong 29 dịch vụ công bố là bathymetry.
→ **Nhà nước CÓ dữ liệu độ sâu, đã số hoá, và chưa công bố.** Đây là cửa xin dữ liệu rõ ràng nhất về mặt hành chính. Liên hệ: vodic@vodic.vn · (024) 376 18118 · 125 Trung Kính, Hà Nội. Ràng buộc: hợp đồng **bắt buộc phải có điều khoản cho phép chuyển bên thứ ba** (NĐ 73/2017 Đ.20), nếu không thì xin được cũng không phát hành ra app được.

**SEAMAP — Trung tâm Trắc địa và Bản đồ Biển** (https://seamap.com.vn/)
Đơn vị sự nghiệp công lập thuộc **Cục Đo đạc, Bản đồ và Thông tin địa lý VN** (QĐ 502/QĐ-TTg, 11/6/1998) — tức **cơ quan dân sự** (không phải quân đội) nắm bản đồ địa hình đáy biển tỉ lệ **1:50.000 / 1:10.000 / 1:5.000**. Nhưng chỉ chào **dịch vụ khảo sát theo hợp đồng**, không có catalogue bán dữ liệu sẵn.

**Một đầu mối học thuật đáng thử**: bài **MDTVN22** (*MethodsX* 2024, DOI 10.1016/j.mex.2024.102624) có **4.243 điểm đo sâu thật ở Vịnh Bắc Bộ**, ghi *"data available on request"*. Đây là **dữ liệu đo thật hiếm hoi ở đúng vùng thềm ven bờ đang thiếu** — chi phí gửi email bằng 0.

### 6c. Bối cảnh cần biết: nhà nước cũng chưa phủ xong

Theo QĐ 28/QĐ-TTg (Chương trình trọng điểm điều tra cơ bản TN-MT biển đến 2030) và Nghị quyết 139/2024/QH15: mục tiêu **đến 2030** mới là hoàn thành bản đồ địa hình đáy biển **1:50.000 vùng ven bờ**, và **1:500.000 / 1:250.000** vùng xa bờ, với chỉ tiêu **≥50% diện tích biển** điều tra ở tỉ lệ 1:500.000.

> Nói thẳng: **mục tiêu quốc gia cho vùng xa bờ (1:500.000) còn thô hơn GEBCO**. Đừng kỳ vọng vài năm tới sẽ có nguồn nhà nước mịn hơn cho ngư trường xa bờ. Chỗ trống ở thềm ven bờ là chỗ trống thật, không phải chỗ trống đang chờ được lấp.

---

## 6d. Nguồn trong nước ĐÃ KIỂM VÀ ĐÓNG — đừng tìm lại

| Nguồn | Trạng thái | Vì sao loại |
|---|---|---|
| **Viện Hải dương học Nha Trang** (vnio.org.vn) | ✅ sống | Không công bố bathymetry, không có cổng dữ liệu — chỉ email vanthu@io.vast.vn |
| **Viện Nghiên cứu Hải sản (RIMF)** | ✅ sống nhưng bản tin ngư trường mới nhất **02/2024** | Footer nguyên văn: *"Nghiêm cấm việc sao chép dưới bất cứ hình thức nào"* → **cấm tái sử dụng** |
| **Viện Địa chất & Địa vật lý biển (IMGG)** | ❌ HTTP 503, cert hết hạn | Không truy cập được |
| **Trung tâm Hải văn** (bảng thuỷ triều) | ✅ | **"Giữ bản quyền"**, bán dạng sách in |
| **Dầu khí (PVN / VPI / PVEP / Vietsovpetro)** | PVEP ❌ HTTP 000, còn lại ✅ | **Luật Dầu khí 2022 Đ.6.6** — dữ liệu do Nhà nước quản lý, phải bảo mật; **Đ.9.6** cung cấp trái phép là **hành vi bị cấm**. Không catalogue, không bảng giá. **Bỏ hẳn khỏi roadmap** |
| **data.gov.vn / open.data.gov.vn** | ❌ **đã chết** — zone tồn tại nhưng không có bản ghi A; `open.` trả NXDOMAIN | Cổng không phục vụ dữ liệu nào; chức năng đang chuyển về Trung tâm Dữ liệu quốc gia |
| **opendata.monre.gov.vn · seaportal.vodic.vn · data.vodic.vn** | ❌ refused / trang mặc định Apache2 | Không có nội dung |
| **VNSDI** (vnsdi.mae.gov.vn) | 🟡 trang chủ 200 nhưng backend ArcGIS trả "Application Error" | Không liệt kê được catalogue |
| **EMODnet** | ✅ | **Chỉ phủ châu Âu** |
| **PANGAEA** | ✅ | Chỉ 2 dataset "bathymetry + Vietnam", cả hai **không phải biển** (hồ Biển Hồ, sông Tiền) |

**Về khung pháp lý dữ liệu mở**: Nghị định 47/2020 và **Luật Dữ liệu 2024** (60/2024/QH15, hiệu lực 1/7/2025, Đ.35.3(c)) **cho phép** bên thứ ba tự do khai thác dữ liệu mở kể cả cho mục đích thương mại. Nhưng **không cơ quan nào công bố bathymetry dưới dạng dữ liệu mở** → quyền này hiện rỗng trên thực tế.

**Bài báo VN có nhưng dữ liệu không có**: SDB Nha Trang (R²=0,85, RMSE 2,66 m, dải −0,5→−40 m) ghi *"Download data is not yet available"*; bài Nhật Lệ có **mâu thuẫn giấy phép** (trang bài ghi CC BY-**NC-ND** cấm thương mại, trang tạp chí ghi CC BY-SA — phải hỏi toà soạn); bài biến động đáy đảo Trường Sa là **CC BY-ND** → cấm tác phẩm phái sinh, không được regrid.

---

## 7. Những gì KHÔNG tra được (ghi để người sau không tìm lại)

- Số liệu diện tích/tỉ lệ phủ riêng cho **Việt Nam** của Allen Coral Atlas.
- **RMSE cụ thể** của nghiên cứu SDB Nha Trang (vjs.ac.vn trả HTTP 403).
- ~~Bản gốc Quyết định 562/QĐ-TTg~~ → **đã giải quyết**: xác nhận bằng 2 nguồn độc lập, có cả "độ sâu quốc gia" (Mật) lẫn ngưỡng "tỷ lệ lớn hơn 1:10.000" (Tối mật). Vẫn chưa đọc bản gốc PDF.
- **Giá** hải đồ giấy VN, licence ENC qua PRIMAR/AVCS, giá SDB thương mại (TCarta, EOMAP) cho vùng biển VN — không đơn vị nào công bố.
- Mức phí "khai thác và sử dụng tài liệu dầu khí" theo NĐ 45/2023 Đ.11.
- Nội dung `opendata.monre.gov.vn` và `seaportal.vodic.vn` (cổng refused từ ngoài VN — có thể mở được từ trong nước, **đáng thử lại từ máy ở VN**).
- Giấy phép chính thức của **SRTM15+** (OpenTopography ghi "Use License: Not Provided") → dùng GEBCO thay.
- Vì sao hai danh mục hải đồ VN (web VMSA vs PDF MHE-South) đánh số khác nhau.
- **Vị thế chính thức của Việt Nam** trong danh sách quốc gia đồng ý CSB của IHO → nên hỏi thẳng `bathydata@iho.int`.
- **Giá** hải đồ giấy và ENC Việt Nam; điều kiện licence dữ liệu của VMSA.
- Điều khoản sở hữu dữ liệu người dùng của **C-MAP Genesis / Navionics** (trang Terms trả 403).
- Cơ chế xin dữ liệu **VMS** cho bên thứ ba.
- ~~Tỉ lệ photon đáy thực thu của ATL24 trong vùng nước đục VN~~ → **đã đo được**, xem §4.4. Còn lại: **chất lượng sau khi lọc cờ tin cậy** thì chưa đo.
- Phần Sentinel-2 SDB đã có nghiên cứu VN nhưng **không có bộ dữ liệu công bố kèm** để tái sử dụng.
- **DOI dữ liệu và giấy phép của S2Shores** (Nature chuyển hướng qua IdP, PubMed đòi cookie) — nếu cần thì hỏi tác giả CNES/LEGOS.

---

## 8. Việc nên làm tiếp, theo thứ tự

**Làm ngay, không phụ thuộc ai:**

0. 🔴 **Thêm câu cảnh báo "không thay hải đồ"** vào mọi màn hiển thị độ sâu. Đây là **điều kiện giấy phép** của ETOPO/GEBCO mà sản phẩm hiện tại chưa đáp ứng, không phải việc "nên có". Rẻ nhất, gấp nhất trong cả danh sách.
1. **Nâng nền lên GEBCO 2026** — 1–2 ngày, rủi ro bằng 0.
2. **Dựng crawler Thông báo hàng hải** — 8–12 ngày, giá trị an toàn cao nhất cho bà con, và là nguồn duy nhất **không dính điều khoản cấm dùng cho hàng hải**.

**Gửi đi rồi chờ (chi phí gần bằng 0, làm song song ngay hôm nay):**

3. **Thư hỏi VMSA** về licence dữ liệu độ sâu cho ứng dụng di động thương mại (vmsc-office@vmsa.vn, kinhdoanh@mhe-south.vn).
4. **Thư hỏi VODIC** (vodic@vodic.vn) về danh mục `DHDB` "Địa hình đáy biển" — nêu rõ cần điều khoản **cho phép chuyển bên thứ ba** theo NĐ 73/2017 Đ.20.
5. **Thư hỏi nhóm tác giả MDTVN22** xin 4.243 điểm đo Vịnh Bắc Bộ ("available on request").
6. **Thư hỏi `bathydata@iho.int`** về vị thế CSB của Việt Nam.

**Phải có luật sư trước khi làm:**

7. **Ba câu hỏi pháp lý cụ thể**, gửi cùng một lần:
   - (a) Doanh nghiệp VN phát hành bản đồ độ sâu **10 m** của bãi ngầm/đảo Trường Sa từ nguồn CC BY nước ngoài — có chạm mục **Tối mật** của QĐ 562 (ngưỡng "tỷ lệ lớn hơn 1:10.000") không? Nếu regrid về 30–50 m thì có ra khỏi phạm vi không?
   - (b) Thông báo hàng hải có được tái sử dụng thương mại theo **Điều 15 Luật SHTT** (văn bản hành chính + số liệu) không?
   - (c) Ranh giới giữa "hiển thị lại dữ liệu có sẵn" và "**thành lập bản đồ địa hình đáy biển**" theo **NĐ 27/2019** nằm ở đâu? SDFish có cần giấy phép đo đạc bản đồ không?

**Sau khi có kết quả trên:**

8. **Lọc chất lượng ATL24** — đã xác nhận có dữ liệu (§4.4); việc còn lại là lọc theo cờ tin cậy/phân loại rồi đối chiếu với TBHH cùng khu để biết dùng được bao nhiêu phần trăm.
9. **Chỉ khi luật sư gật** — tích hợp HHU24SWDSCS, kèm thay toàn bộ địa danh sang tên Việt Nam.

> **Không làm**: thu thập độ sâu từ máy dò của bà con để tạo bản đồ, cho tới khi có ý kiến Bộ Quốc phòng / Văn phòng Thuỷ đạc VN (§5.3). Kỹ thuật dễ, pháp lý nặng.

---

## Phụ lục: cách kiểm chứng lại (lệnh thật đã dùng)

```bash
# IHO DCDB CSB — đếm sounding theo bbox (lon,lat,lon,lat)
curl "https://q81rej0j12.execute-api.us-east-1.amazonaws.com/count?bbox=105.6,17,110,21.6"

# GMRT — lớp CHỈ dữ liệu đo thật (ô nội suy = -2147483648)
curl "https://www.gmrt.org/services/GridServer?minlongitude=109.2&maxlongitude=109.45\
&minlatitude=12.1&maxlatitude=12.35&format=esriascii&resolution=max&layer=topo-mask"

# NOAA NCEI — đếm khảo sát multibeam / trackline trong EEZ VN
curl -G "https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/multibeam_dynamic/MapServer/0/query" \
  --data-urlencode "geometry=102,5,118,23" --data-urlencode "geometryType=esriGeometryEnvelope" \
  --data-urlencode "inSR=4326" --data-urlencode "returnCountOnly=true" --data-urlencode "f=json"

# NASA CMR — đếm granule ATL24 phủ ven bờ VN (đọc header CMR-Hits)
curl -D - "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL24\
&bounding_box=105,8,112,18&page_size=1" -o /dev/null

# Thông báo hàng hải — PDF tải trực tiếp
curl -O "https://vmsa.vn/baodam/upload/files/TBHH/TBHH2025/784.pdf"
```

```python
# ATL24 — đếm điểm đáy thật trong một hộp (pip install sliderule)
# LƯU Ý: icesat2.atl24v hiện HỎNG phía server (500, thiếu file .lua).
#        Phải dùng sliderule.run("atl24x", ...) như dưới.
import sliderule
sliderule.init("slideruleearth.io", verbose=False)
poly = [{"lon":106.60,"lat":9.40},{"lon":106.80,"lat":9.40},
        {"lon":106.80,"lat":9.60},{"lon":106.60,"lat":9.60},
        {"lon":106.60,"lat":9.40}]
df = sliderule.run("atl24x", {"poly": poly})
print(len(df), df["ortho_h"].quantile([.05,.95]).tolist())
```

```python
# HHU24SWDSCS — đọc và đếm điểm theo vùng (pip install h5py numpy)
# BẪY: file có CẢ 'lat'/'lon' (>f4, đọc ra toàn 0) lẫn 'latitude'/'longitude' (float32, ĐÚNG).
#      Phải dùng 'latitude'/'longitude'.
import h5py, numpy as np
f = h5py.File("HHU24SWDSCS.nc")
lat, lon = np.array(f["latitude"]), np.array(f["longitude"])
m = (lat>=6.0)&(lat<=12.5)&(lon>=111.0)&(lon<=117.8)   # hộp Trường Sa
print(int(m.sum()))
```
