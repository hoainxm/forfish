# ForMaps — Kinh doanh: ai mua, giá nào, rủi ro gì

> Ngày soạn: 2026-08-29 · Người soạn: teammate FORMAPS (AI)
> Đọc kèm: [00-phap-ly.md](00-phap-ly.md) (§8 quyết định có bán được ở VN không) · [01-tai-san-du-lieu.md §4](01-tai-san-du-lieu.md) (hào thật)

---

## 0. Ba con số nền

| Con số | Giá trị | Nguồn |
|---|---|---|
| Tàu cá VN dài **từ 15 m trở lên** | **29.791 chiếc** | Trung tâm Thông tin Thuỷ sản, số 27/02/2023 |
| Trong đó **đã lắp VMS** | **28.787** (96,62% lúc đó; nay >99%) | Như trên |
| Số **nhà cung cấp thiết bị VMS** được chứng nhận | **10** đơn vị | Cục Thuỷ sản |

Ba thiết bị được lắp nhiều nhất: **Thuraya SF2500** (VNPT) · **Vifish.18** (Vishipel) · **BA-SAT-01** (Bình Anh).

> **Đọc ba con số này cho đúng**: thị trường thiết bị VMS **đã bão hoà** — trên 99% tàu đã lắp. Nghĩa là 10 nhà cung cấp ấy **hết đường bán phần cứng** và đang phải cạnh tranh bằng **phần mềm và dịch vụ**. Đó chính là cửa của ForMaps.

---

## 1. Kiểm chứng từng nhóm khách

Không liệt kê suông. Mỗi nhóm hỏi bốn câu: **họ đau chỗ nào? họ có tiền không? họ có quyền quyết không? bán vào bằng cửa nào?**

### 1.1 🟢 Nhà cung cấp VMS — khách số một, không cần bàn cãi

**Đau chỗ nào.** Màn hình VMS hiện nay là **chấm trên nền trống**. Cán bộ trực ban nhìn thấy `9,9939°B / 114,6575°Đ` và không biết chỗ đó là gì. Không có độ sâu, không có rạn, không có báo hiệu, không có tên tiếng Việt. Còn ngư dân thì nhìn thiết bị VMS như cái máy tố cáo mình, không phải cái máy giúp mình — báo chí liên tục phản ánh **"trục trặc nhiều, hỗ trợ ít"**.

**Có tiền không.** Có, và đây là điểm quan trọng: **họ đã hết đường tăng trưởng bằng phần cứng.** 99% tàu đã lắp. Doanh thu tương lai của họ chỉ còn ở thuê bao dịch vụ — mà muốn tăng giá thuê bao thì phải làm dịch vụ đáng tiền hơn. Hải đồ tử tế là thứ nhìn thấy được ngay.

**Có quyền quyết không.** Viettel/VNPT thì chậm và nhiều tầng. **Bình Anh, Zunibal, Khánh Hội, HTC, L'Trần** — công ty tư nhân vừa, quyết nhanh. **Bán vào nhóm nhỏ trước.**

**Cửa vào.** Không phải bán "API bản đồ". Bán **một màn hình demo**: lấy đúng dữ liệu VMS của họ, đặt lên nền ForMaps, cho cán bộ trực ban xem thử. Chuyển từ *"tàu X ở 9,99°B"* sang *"tàu X cách Đá Ba Đầu 3 hải lý, đáy 45 m, đang ở trong vùng khai thác"*. Không cần thuyết trình — nhìn là hiểu.

> ⚠️ **Nhưng đây cũng là khách nguy hiểm nhất.** Xem §4.1 — họ có đủ năng lực kỹ thuật để tự làm sau khi thấy demo.

### 1.2 🟢 Cơ quan quản lý: Cục Thuỷ sản, Chi cục Thuỷ sản các tỉnh, Sở NN&MT

**Đau chỗ nào.** Đây là nhóm chịu áp lực **thẻ vàng IUU của EC** — đoàn thanh tra lần 5 sang tháng 11/2025, và Việt Nam đặt mục tiêu gỡ thẻ. Cán bộ tỉnh phải giám sát hàng nghìn tàu trên một nền bản đồ không có ranh giới rõ, không có tên tiếng Việt.

**Có tiền không.** Có ngân sách, nhưng **chu kỳ chậm và đấu thầu**. Không phải khách của năm đầu.

**Có quyền quyết không.** Phân tán — 28 tỉnh ven biển, mỗi tỉnh một chi cục.

**Cửa vào.** Đi qua nhà cung cấp VMS (họ đã có hợp đồng với các tỉnh) thay vì bán trực tiếp. **ForMaps thành nhà cung cấp cấp hai** — chậm hơn về giá nhưng nhanh hơn về đường.

> 💡 **Nhưng nhóm này có giá trị phi tiền tệ rất lớn**: một hợp đồng với cơ quan nhà nước là **chứng nhận uy tín** khiến mọi cuộc bán sau dễ hơn. Và nó gián tiếp trả lời câu hỏi giấy phép ở [00 §8.1](00-phap-ly.md).

### 1.3 🟡 Bảo hiểm tàu cá — có lý về logic, chưa chắc về thực tế

**Đau chỗ nào (theo lý thuyết).** Định phí bảo hiểm thân tàu cần biết tàu hoạt động ở vùng nào, có hay đi vào chỗ nguy hiểm không. Giám định tổn thất cần biết chỗ tàu chìm đáy sâu bao nhiêu, có rạn không.

**Nhưng phải nói thẳng chỗ nghi ngờ.** Bảo hiểm tàu cá ở Việt Nam **phần lớn là bảo hiểm được nhà nước hỗ trợ phí theo Nghị định 67**, không phải sản phẩm thương mại định phí theo rủi ro. Ở một thị trường mà phí do chính sách quyết định, **dữ liệu rủi ro tinh vi không làm tăng lợi nhuận của ai** — nên không ai trả tiền cho nó.

**Kết luận trung thực**: đây là khách **năm thứ ba**, không phải năm đầu, và chỉ khi thị trường bảo hiểm tàu cá thương mại hoá. Đừng dồn công vào đây sớm.

### 1.4 🔴 Logistics / cảng biển — nhóm yếu nhất, nên loại sớm

**Vì sao yếu.** Tàu hàng thương mại **đã có hải đồ điện tử chuẩn ECDIS** theo quy định SOLAS, mua từ UKHO/Primar/NAVTOR. Đó là hải đồ **có chứng nhận pháp lý** dùng để lái tàu. ForMaps **không có và sẽ không có** chứng nhận đó — dữ liệu ForMaps là "tham khảo", đúng như app đang ghi.

**Bán được cái gì?** Chỉ được phần ngoài buồng lái: bảng theo dõi trên bờ, lập kế hoạch, phân tích. Nhóm này nhỏ, và họ đã có Windward/MarineTraffic/Spire.

> ⛔ **Khuyến nghị: loại nhóm này khỏi kế hoạch hai năm đầu.** Không phải vì không bán được, mà vì tỷ lệ công/thu tệ nhất trong bảng.

### 1.5 🟡 Doanh nghiệp thuỷ sản (VASEP, nhà máy chế biến)

**Đau chỗ nào.** Truy xuất nguồn gốc để **xuất khẩu sang EU**. Phải chứng minh lô cá đánh ở đâu, có hợp pháp không. Đây là đau thật và đau bằng tiền — lô hàng bị trả về là mất tiền tỷ.

**ForMaps bán gì.** Không bán bản đồ. Bán **`/v1/place`** và **`/v1/zone-check`**: nhận toạ độ khai thác, trả về "trong vùng khai thác hợp pháp của Việt Nam" hoặc "ngoài ranh giới" — bằng tiếng Việt, có căn cứ vùng VMS.

**Có tiền không.** Có, và họ trả nhanh vì rủi ro của họ đo được bằng tiền.

> ⚠️ **Nhưng gói này phụ thuộc hoàn toàn vào vùng VMS**, mà nguồn gốc pháp lý của vùng VMS **chưa xác định** ([00 §7.5](00-phap-ly.md)). **Không chào bán trước khi SDVico trả lời.**

### 1.6 🟢 App và phần mềm khác — khách dễ nhất, nhưng nhỏ

App du lịch biển, app thể thao dưới nước, app cảng, phần mềm quản lý đội tàu, đơn vị nghiên cứu. Mua bằng thẻ, không cần gặp mặt, không cần đấu thầu.

**Giá trị**: không phải doanh thu, mà là **kiểm chứng sản phẩm**. Mười khách tự đăng ký trả $50/tháng chứng minh API dùng được — thứ đáng giá hơn $500 rất nhiều khi đi gặp Bình Anh.

### 1.7 ⭐ Nhóm chưa ai nghĩ tới: các dự án chuyển đổi số nghề cá

Ngân hàng cho vay đóng tàu, quỹ tín dụng nông nghiệp, đơn vị làm truy xuất nguồn gốc, dự án ODA/JICA/FAO về nghề cá bền vững, và **các viện nghiên cứu biển**. Nhóm này có tiền dự án và cần dữ liệu **có nguồn gốc rõ, có ghi nguồn đàng hoàng** — đúng thứ ForMaps đang xây.

---

## 2. Xếp hạng ưu tiên

| Hạng | Nhóm | Vì sao |
|---|---|---|
| **1** | Nhà cung cấp VMS **tư nhân vừa** (Bình Anh, Zunibal, Khánh Hội, HTC) | Đau rõ · quyết nhanh · hết đường phần cứng · demo là hiểu |
| **2** | App/phần mềm tự đăng ký | Kiểm chứng sản phẩm, không tốn công bán |
| **3** | Doanh nghiệp thuỷ sản (truy xuất nguồn gốc) | Đau bằng tiền — **chờ SDVico trả lời về vùng VMS** |
| **4** | Viettel / VNPT / Vishipel | Túi sâu nhưng chu kỳ dài. Bắt đầu tiếp cận từ tháng 6 |
| **5** | Cơ quan nhà nước | Đi qua nhà cung cấp VMS, không bán trực tiếp |
| **6** | Dự án chuyển đổi số / ODA | Cơ hội, không phải kế hoạch |
| **7** | Bảo hiểm | Năm thứ ba |
| — | Logistics / cảng | ⛔ Loại |

---

## 3. Mô hình giá

### 3.1 Tham chiếu thị trường quốc tế

| Công ty | Giá |
|---|---|
| MapTiler | $30/tháng (25k phiên, 500k request) → hợp đồng riêng |
| Stadia Maps | $20 · $80 · $250/tháng |
| Geoapify | $59 → $609/tháng |
| Thunderforest | $125 · $255 · $525/tháng |

> **Một người làm (Thunderforest) thu $525/tháng cho tile raster OSM.** Đây là cột mốc hữu ích: giá không phải hàm của quy mô công ty.

### 3.2 Vì sao KHÔNG copy giá quốc tế

Ba lý do:
1. **Sức chi trả VN thấp hơn.** $609/tháng ≈ 15,5 triệu ₫ — quá cao cho một công ty VMS vừa.
2. **Họ bán theo request, ForMaps nên bán theo TÀU.** Khách VMS nghĩ theo đội tàu, không nghĩ theo request. Bán theo đơn vị họ nghĩ thì họ tính được ROI ngay.
3. **Giá trị của ForMaps không nằm ở số lượt.** Nằm ở **tuân thủ** — thứ không đo bằng request.

### 3.3 Bảng giá đề xuất

| Gói | Cho ai | Gồm | Giá/tháng |
|---|---|---|---|
| **Thử** | Dev, đánh giá | 50k request, chỉ tầng 1+2, có logo ForMaps | **0 ₫** |
| **App** | App nhỏ, tự đăng ký | 500k request, tầng 1+2, 1 tên miền | **1,2 tr ₫** (~$46) |
| **Chuyên nghiệp** | Phần mềm vừa | 5 tr request, **đủ 3 tầng**, 5 tên miền, hỗ trợ email | **4,5 tr ₫** (~$172) |
| **VMS** ⭐ | Nhà cung cấp VMS | **Tính theo tàu**: 3.000 ₫/tàu/tháng, sàn 500 tàu | **từ 1,5 tr ₫**, đội 3.000 tàu = **9 tr ₫** |
| **Doanh nghiệp / on-premise** | Nhà nước, quốc phòng, đội tàu lớn | Cài tại chỗ, SLA, dữ liệu ghim phiên bản | **từ 25 tr ₫**, thương lượng |

### 3.4 Vì sao 3.000 ₫/tàu/tháng

Đây là con số phải giải thích được, không phải con số bốc.

- **Từ phía khách**: thuê bao VMS hiện khoảng 300.000–400.000 ₫/tàu/tháng **[E — cần xác nhận]**. 3.000 ₫ là **dưới 1%** chi phí thuê bao. Không ai từ chối một khoản 1% để đổi lấy màn hình khác hẳn.
- **Từ phía ForMaps**: 3.000 tàu × 3.000 ₫ = **9 triệu ₫/tháng từ MỘT khách**. Chi phí hạ tầng cho lượng đó ~$40/tháng ([02 §5](02-kien-truc.md)). Biên lãi > 95%.
- **Từ phía thị trường**: 29.791 tàu ≥15 m × 3.000 ₫ = **89 triệu ₫/tháng ≈ 1,07 tỷ ₫/năm** nếu phủ 100% — trần thị trường thô cho riêng lát cắt VMS.

> **Nói thẳng về con số 1,07 tỷ ₫/năm**: đó **không phải một doanh nghiệp lớn**. Nó là một dòng tiền phụ tốt cho SDVico, hoặc là chân đứng để mở sang thị trường khác (Indonesia, Philippines, Thái Lan — cùng bài toán IUU, cùng thiếu hải đồ tiếng bản địa). **Đừng bán câu chuyện ForMaps là kỳ lân. Bán nó như đúng thứ nó là: một tài sản hạ tầng biên lãi cao, thị trường có trần rõ.**

### 3.5 Ba nguyên tắc định giá

1. **Gói miễn phí phải THẬT SỰ dùng được.** Ai cũng thử được thì mới có người mua. Nhưng gói miễn phí **chỉ tầng 1+2** — tên tiếng Việt và vùng VMS là thứ trả tiền mới có.
2. **Tính theo TÀU cho khách VMS, theo REQUEST cho khách app.** Bán bằng đơn vị mà khách đã nghĩ sẵn trong đầu.
3. **Đừng giảm giá theo yêu cầu. Giảm bằng cách BỎ BỚT TẦNG.** Khách kêu đắt thì đưa gói tầng 1+2. Giảm giá gói đủ tầng là dạy khách rằng giá niêm yết là giá bịa.

---

## 4. Rủi ro — xếp theo mức độ giết chết

### 4.1 🔴 Khách tự làm sau khi xem demo

**Đây là rủi ro lớn nhất, và nó lớn vì lý do đã nêu ở [01 §4](01-tai-san-du-lieu.md): khoảng 80% dung lượng byte của ForMaps không phải hào.** Viettel có hàng nghìn kỹ sư. Bình Anh có đội phần mềm. Sau khi xem demo, họ hoàn toàn có thể tự tải OSM, tự tải ETOPO, tự dựng tile.

**Cái họ KHÔNG tự làm nhanh được:**
- 103 đảo + 13 rạn tên tiếng Việt có gán chủ quyền, **có cổng tự kiểm CJK**;
- 26 nhãn tiếng Việt cho báo hiệu + `describeLight()`;
- Mô hình dự báo cá **đã hiệu chỉnh cho Biển Đông có backtest**;
- Nghiệp vụ chống hỏng nguồn (`source-registry`, `snapshot-merge`, `source-cadence`) — hai năm học phí trả bằng sự cố thật.

**Cách phòng:**
- **Demo bằng TẦNG 3, không bằng tầng 1.** Đừng khoe "chúng tôi có nền bản đồ đẹp" — khoe *"tàu này cách Đá Ba Đầu 3 hải lý"*. Nền bản đồ ai cũng có; câu tiếng Việt ấy thì không.
- **Bán tuân thủ, không bán byte.** Xem §5.
- **Hợp đồng nhiều năm, giá giảm dần theo năm.** Tự làm mất 6 tháng và tốn hơn giá 3 năm hợp đồng.

### 4.2 🔴 Không xin được giấy phép đo đạc bản đồ

Xem [00 §8.1](00-phap-ly.md). Nếu luật sư trả lời "phải có giấy" và điều kiện là phải có nhân sự chứng chỉ hành nghề, thì **ForMaps chậm ít nhất 6 tháng và tốn thêm một khoản chưa ước được**.

**Cách phòng**: hỏi luật sư **trước khi** làm gì khác. Đây là câu số 1 vì lý do đó.

### 4.3 🔴 Trách nhiệm khi dữ liệu sai và có tàu gặp nạn

ForMaps bán dữ liệu an toàn hàng hải cho công ty VMS, công ty VMS đưa cho ngư dân, ngư dân đi biển. Nếu bản đồ thiếu một cái rạn và có tàu đâm vào — ai chịu?

Đây **không phải rủi ro lý thuyết**. Chính đợt 2026-08-29 đã phát hiện **1.409/2.612 vòng rạn từng biến mất khỏi file đang ship** vì lỗi giản lược. Lỗi ấy đã sửa, nhưng nó chứng minh loại lỗi này có thật.

**Cách phòng:**
- Điều khoản miễn trừ mạnh, viết rõ "dữ liệu tham khảo, không thay thế hải đồ chính thức" — **và ghi vào từng phản hồi API**, không chỉ trong hợp đồng.
- Hỏi luật sư điều khoản miễn trừ có hiệu lực tới đâu ở VN (câu #10).
- Bảo hiểm trách nhiệm nghề nghiệp.
- **Giữ nguyên văn hoá kỹ thuật hiện có**: cổng test, nói thật về độ chính xác, sai lệch nghiêng về cảnh báo thừa. Đó vừa là đạo đức vừa là phòng thủ pháp lý.

### 4.4 🟡 Phụ thuộc SDVico về vùng VMS
Nếu vùng VMS không được phép bán lại thì mất một trong bốn hào. **Hỏi ngay.**

### 4.5 🟡 Nguồn miễn phí đổi luật chơi
Open-Meteo đã là ví dụ sống ([00 §7.3](00-phap-ly.md)). Copernicus, EMODnet, NOAA đều có thể đổi điều khoản hoặc chặn IP.

**Cách phòng**: nghiệp vụ đa nguồn hiện có (`source-registry`, `snapshot-merge`) **chính là biện pháp phòng này** — nó vốn được xây để chống nguồn hỏng, và nó chống luôn nguồn đổi luật. Đây là ví dụ hào kỹ thuật biến thành hào kinh doanh.

### 4.6 🟡 Chính trị chủ quyền
Bản đồ Hoàng Sa/Trường Sa là chủ đề nhạy cảm. Sai một nhãn là vừa ăn phạt hành chính vừa mất uy tín không lấy lại được. Cổng CJK là lá chắn kỹ thuật, nhưng cần thêm **quy trình duyệt của con người** cho mọi thay đổi ở lớp tên và lớp chủ quyền.

### 4.7 🟢 Đối thủ quốc tế nhảy vào
Mapbox/MapTiler làm bản đồ biển Việt Nam có tên tiếng Việt đúng chủ quyền? **Rất khó xảy ra**: thị trường quá nhỏ với họ, và chủ đề chủ quyền là thứ công ty Mỹ/châu Âu tránh. Đây là rủi ro thấp nhất trong bảng — và cũng là lý do hào của ForMaps bền hơn vẻ ngoài.

---

## 5. Câu chuyện bán hàng — một câu

> **"Bản đồ biển duy nhất mà một công ty Việt Nam dùng được mà không ăn phạt."**

Vì sao câu này đúng và mạnh:
- **Có căn cứ pháp lý**: NĐ 18/2020 phạt 30–50 triệu ₫ cho bản đồ sai chủ quyền ([00 §8.2](00-phap-ly.md)).
- **Có bằng chứng kỹ thuật**: OSM thô có **160 tên chứa ký tự Hán** trong khung biển VN. Đo được, chỉ ra được.
- **Đối thủ không đi vòng được**: dùng OSM thô là vi phạm; tự soạn lại là bỏ nhiều tháng công **và** chịu rủi ro chính trị nếu soạn sai.
- **Bán được cho cả người mua lẫn phòng pháp chế của họ** — hai người, một câu.

**Không nên bán câu chuyện**: "17 triệu ô độ sâu", "5.851 báo hiệu", "nền vector 16,9 MB". Đó là byte, và byte thì đối thủ có sau một buổi chiều.

---

## 6. Ba tháng đầu — làm gì

| Tháng | Việc | Đo bằng gì |
|---|---|---|
| **1** | Hỏi luật sư 3 câu (1, 2, 7). Hỏi SDVico về vùng VMS. Mua gói Open-Meteo. Dựng demo tầng 3 trên dữ liệu VMS giả | Có câu trả lời pháp lý ✅/❌ |
| **2** | Gặp **3 nhà cung cấp VMS tư nhân**. Không chào giá — chỉ cho xem demo và hỏi *"cái này giúp gì cho anh không?"* | 3 cuộc gặp, 3 câu trả lời thật |
| **3** | Dựng API tối thiểu (4 endpoint ở [02 §3.1](02-kien-truc.md)). Ký **một** khách thử, dù giá 0 ₫ | 1 khách thật đang gọi API |

> **Thước đo duy nhất của quý một**: có **một** công ty VMS thật gọi API ForMaps trong hệ thống của họ. Không phải doanh thu. Không phải số endpoint. Một khách thật.

---

## Nguồn

Truy cập 29/08/2026:
- [Nhanh chóng phủ rộng hệ thống giám sát hành trình tàu cá VMS — Tạp chí Thuỷ sản Việt Nam](https://thuysanvietnam.com.vn/nhanh-chong-phu-rong-he-thong-giam-sat-hanh-trinh-tau-ca-vms/) (29.791 tàu ≥15 m, 28.787 đã lắp)
- [Tháo gỡ khó khăn trong lắp đặt, sử dụng hệ thống giám sát tàu cá](https://nongnghiepmoitruong.vn/thao-go-kho-khan-trong-lap-dat-su-dung-he-thong-giam-sat-tau-ca-d325617.html) (10 nhà cung cấp; ba thiết bị chính)
- [Thiết bị giám sát hành trình tàu cá (VMS): Trục trặc nhiều, hỗ trợ ít — Báo Lâm Đồng](https://baolamdong.vn/thiet-bi-giam-sat-hanh-trinh-tau-ca-vms-truc-trac-nhieu-ho-tro-it-359750.html)
- [Việt Nam quyết tâm gỡ "thẻ vàng" IUU — Báo Nhân Dân](https://nhandan.vn/quyet-liet-go-the-vang-iuu-post918267.html)
- Giá đối thủ: [MapTiler](https://www.maptiler.com/cloud/pricing/) · [Stadia Maps](https://stadiamaps.com/pricing/) · [Geoapify](https://www.geoapify.com/pricing/) · [Thunderforest](https://www.thunderforest.com/pricing/)

⚠️ Con số **300.000–400.000 ₫/tàu/tháng** cho thuê bao VMS là **ước tính của tôi**, chưa xác nhận bằng nguồn. Phải hỏi thẳng một nhà cung cấp VMS trước khi dùng nó để định giá.
