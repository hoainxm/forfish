# Nghiên cứu 08: Chuỗi bán buôn thủy sản — bán cho AI, ở ĐÂU, THẾ NÀO để được giá

> Phục vụ ForFish — giúp ngư dân HIỂU chuỗi bán/bán buôn và tăng vị thế đàm phán.
> Ngày nghiên cứu: 10/06/2026. Quy ước: nội dung có nguồn được dẫn link tại chỗ; nội dung **[suy luận]** là phân tích của nhóm.
> Tài liệu liên quan: `04-chuoi-gia-tri-va-app.md` (nậu vựa = ngân hàng+logistics phi chính thức, ép giá/ép cân), `01-kinh-te-chuyen-bien.md` (tổn, công nợ). Dữ liệu kèm theo: `src/data/market-channels.ts`.

---

## 0. Câu hỏi cốt lõi của bà con

> "Cá đầy hầm rồi, **bán cho ai, ở đâu, làm sao để được giá**, đừng bị ép?"

Không có một câu trả lời đúng cho mọi tàu. Mỗi kênh bán đánh đổi giữa **GIÁ** ↔ **tiền mặt ngay** ↔ **ràng buộc nợ** ↔ **yêu cầu giấy tờ/công sức**. Tài liệu này mô tả 5 kênh, các chợ đầu mối lớn công khai, và mẹo "bán được giá".

---

## 1. Năm kênh bán — ưu/nhược về GIÁ, tiền mặt, nợ, giấy tờ

Sắp xếp gần đúng từ **giá thấp → giá cao**, cũng là từ **dễ → tốn công**:

| Kênh | Giá | Tiền mặt ngay | Ràng buộc nợ | Giấy tờ/truy xuất | Hợp với ai |
|---|---|---|---|---|---|
| 1. Nậu vựa/đầu nậu tại cảng | Thấp nhất (ép 2–4k đ/kg) | Ngay lập tức | **Cao** (nợ tổn = phải bán cho nậu) | Không cần | Tàu nợ tổn, cần tiền gấp |
| 2. Vựa/đại lý thu mua | Thấp–trung bình | Nhanh | Thấp (nếu không vay họ) | Không cần | Tàu không nợ, muốn so giá |
| 3. Chợ đầu mối thủy sản | Trung bình–cao | Trong ngày | Không | Ít | Tàu gần chợ, có người chở đi bán |
| 4. Bán thẳng nhà máy/HTX | Cao nhất (hàng chuẩn) | Chậm hơn (theo hợp đồng) | Tùy liên kết | **Bắt buộc** (eCDT/IUU) | Tàu khơi lớn, làm tốt giấy tờ |
| 5. Bán lẻ/online (Zalo/livestream) | Cao nhất/kg | Khi giao hàng | Không | Không (có thể vướng thuế) | Hàng tươi giá trị cao, lượng vừa |

### 1.1. Nậu vựa / đầu nậu tại cảng
- **Ưu:** tiền mặt ngay khi cập bến; mua hết cả mẻ mọi loại/cỡ; ứng trước tổn (dầu, đá, lương thực) và cho vay sửa tàu **không cần thế chấp**; không đòi giấy tờ.
- **Nhược:** giá bị ép thấp hơn thị trường **2.000–4.000 đ/kg**; **ép cân** bằng cách tăng mức "trừ hao" (có giai đoạn từ 300kg lên 600–700kg/chuyến — cân 1,6–1,7 tấn chỉ trả tiền 1 tấn); nợ ứng tổn buộc bán toàn bộ cá cho đúng nậu đó ("luật riêng"); các nậu hay **bắt tay thống nhất giá** nên ngư dân không mang ra chợ tự bán được ([Dân Việt](https://danviet.vn/ban-hai-san-cho-dau-nau-phai-chiu-nhieu-he-luy-tu-luat-rieng-7777926731.htm), [VTV](https://vtv.vn/kinh-te/le-thuoc-nau-vua-ngu-dan-bi-ep-gia-theo-nhieu-dang-thuc-20160405105657586.htm)).
- **Lưu ý quan trọng:** nậu **không phải kẻ xấu thuần túy** — họ là ngân hàng + logistics phi chính thức của bà con (xem TL04). Cắt nậu mà không thay được chức năng vốn thì tàu nằm bờ. Hướng đi: **minh bạch số liệu (giá, cân, nợ) để bớt bị ép**, chứ không phải bỏ nậu ngay.

### 1.2. Vựa / đại lý thu mua (không ràng nợ)
- **Ưu:** trả nhanh, thường nhỉnh hơn nậu ràng nợ; **so được giá giữa vài vựa** để mặc cả; vựa lớn có kho lạnh gom hàng đi chợ đầu mối/nhà máy.
- **Nhược:** vẫn là trung gian ăn chênh; có thể ép cân/ép loại nếu mình không kiểm tra; vẫn phải bán nhanh trong ngày.

### 1.3. Chợ đầu mối thủy sản
- **Ưu:** **giá sát thị trường**, nhiều người mua cạnh tranh nên cao hơn bán tại cảng; có chợ làm **đấu giá** (Thọ Quang) giúp giá minh bạch ([Tepbac](https://tepbac.com/tin-tuc/full/da-nang-dau-gia-mua-ban-tai-cho-dau-moi-thuy-san-tho-quang-26061.html)).
- **Nhược:** phải tự vận chuyển, ướp đá giữ tươi, chịu hao hụt; mất phí chợ/bến bãi/công bốc xếp; cần biết giá trước và có bạn hàng quen ở chợ; chợ họp ban đêm–rạng sáng nên **người nhà ở bờ thường là người đi bán hộ** [suy luận, nhất quán với TL04].

### 1.4. Bán thẳng nhà máy chế biến / HTX
- **Ưu:** **giá tốt nhất cho hàng đạt chuẩn** (xuất khẩu trả cao hơn nội địa); HTX hậu cần nghề cá có thể **mua ngay trên biển** và cấp dầu/đá để bám biển dài ngày (xem TL04); hợp đồng bao tiêu ổn định nếu liên kết tốt.
- **Nhược:** **bắt buộc giấy tờ truy xuất** — nhật ký khai thác, giấy xác nhận/chứng nhận nguồn gốc (eCDT/IUU); yêu cầu chất lượng & phân cỡ cao, hàng dập bị loại/hạ giá; mua lô lớn loài cụ thể, tàu lẻ khó đạt; **liên kết còn yếu** — có nơi ngư dân phá kèo bán cho nậu khi nậu trả cao hơn, khiến nhà máy ngại ký ([Báo Quảng Ngãi](https://baoquangngai.vn/kinh-te/bien-kinh-te-bien/202308/truy-xuat-nguon-goc-thuy-san-khai-thac-con-nhieu-kho-khan-3bc1af9/)).

### 1.5. Bán lẻ / online (Zalo, livestream, chợ địa phương)
- **Ưu:** **giá cao nhất/kg** vì bỏ hết trung gian; khách thấy cá tươi qua livestream, **chốt đơn trước cả khi tàu về**, "không lo ế"; chủ động giá, xây khách quen nhiều tỉnh ([Tiền Phong](https://tienphong.vn/khi-ngu-dan-xai-40-post1316758.tpo), [KTSG](https://thesaigontimes.vn/livestream-ban-hang-tuoi-song-mo-rong-thi-truong-di-kem-thach-thuc/)).
- **Nhược:** tốn công đóng gói/giao/chăm khách (thường **con/vợ ngư dân** làm); chỉ bán lượng nhỏ, không tiêu hết mẻ lớn; cần sóng/điện thoại tốt; bán đều có thể phát sinh nghĩa vụ thuế hộ kinh doanh.

---

## 2. Chợ đầu mối thủy sản lớn — công khai (THAM KHẢO)

> Đầy đủ trong `src/data/market-channels.ts` (`WHOLESALE_MARKETS`). Cần rà lại địa chỉ/giờ trước khi ghim chính xác lên bản đồ.

| Chợ | Tỉnh/TP | Địa chỉ (tham khảo) | Loài chính | Giờ họp |
|---|---|---|---|---|
| **Bình Điền** | TP.HCM | Nguyễn Văn Linh, KP6, P.7, Q.8 | tôm, cua, cá tra/basa/lóc, mực, nghêu sò | Về đêm tới sáng, đông ~22h–3h ([Wiki](https://vi.wikipedia.org/wiki/Ch%E1%BB%A3_%C4%91%E1%BA%A7u_m%E1%BB%91i_B%C3%ACnh_%C4%90i%E1%BB%81n)) |
| **Hóc Môn** | TP.HCM | 14/7A Nguyễn Thị Sóc, Xuân Thới Đông, Hóc Môn | thủy hải sản (1 khu trong chợ) | Chính 22h–6h ([Wiki](https://vi.wikipedia.org/wiki/Ch%E1%BB%A3_%C4%91%E1%BA%A7u_m%E1%BB%91i_n%C3%B4ng_s%E1%BA%A3n_th%E1%BB%B1c_ph%E1%BA%A9m_H%C3%B3c_M%C3%B4n)) |
| **Thọ Quang** | Đà Nẵng | 20 Vân Đồn, Nại Hiên Đông, Sơn Trà (cạnh âu thuyền) | cá thu, ngừ chù, hố, dìa, chim, bớp, mú, mực, bạch tuộc | Tàu cập 1–2h, mua 4–5h sáng ([Tepbac](https://tepbac.com/tin-tuc/full/da-nang-dau-gia-mua-ban-tai-cho-dau-moi-thuy-san-tho-quang-26061.html)) |
| **Yên Sở** | Hà Nội | 96 Đỗ Mười, P. Yên Sở, Q. Hoàng Mai | cá nước ngọt + cá biển | Đêm về rạng sáng, ~150 tấn/ngày ([Ahamove](https://kinhdoanh.ahamove.com/cho-yen-so)) |
| **Long Biên** | Hà Nội | Khu cầu Long Biên, Ba Đình (cũ) | thủy hải sản + nông sản | Đêm về sáng |
| **Hòn Gai (chợ cá sớm)** | Quảng Ninh | Bến cá Hòn Gai → P. Cao Xanh, Hạ Long | cá biển, mực, tôm, ghẹ vịnh | Chợ cá sớm, sáng sớm ([CafeF](https://cafef.vn/cho-ca-khong-ngu-duy-nhat-o-vinh-ha-long-188241028144615798.chn)) |
| **Cụm ĐBSCL (Cà Mau)** | Cà Mau | Cảng cá Cà Mau, Sông Đốc, Năm Căn, Rạch Gốc, Cái Đôi Vàm | tôm, cua Cà Mau, cá biển, mực | Theo con nước/tàu về |

**Lưu ý ĐBSCL:** đây **không phải một chợ tập trung** mà là mạng vựa/đại lý gắn với cảng; tên từng vựa là **mối quen địa phương, không có CSDL công khai** (xem mục 4).

---

## 3. "Bán thế nào cho được giá" — mẹo thực dụng

1. **Giữ tươi là giữ giá.** Ướp đá đúng, đủ đá, hạ nhiệt ngay sau khi đánh — cá giữ 0–4°C lâu hư hơn nhiều; con dập/kém để riêng ([Aquaculture](https://aquaculture.vn/khoa-hoc-ky-thuat/tu-van-ki-thuat/huong-dan-bao-quan-nguyen-lieu-thuy-san-tom-ca-muc-sau-thu-hoach-bang-nuoc-da), [Fishy](https://fishy.vn/am-thuc/meo-vat/cac-phuong-phap-bao-quan-ca-va-hai-san.html)).
2. **Phân loại/phân cỡ trước khi bán.** Phân cỡ kỹ thì mỗi loại bán đúng giá của nó; bán xô (trộn lẫn) là cách nhanh nhất để bị trả giá thấp cho cả mẻ ([Khuyến nông VN](https://khuyennongvn.gov.vn/portals/0/tailieu/2014/12/host/merge_17.pdf)).
3. **Biết giá tham chiếu trước khi mặc cả.** Không tồn tại bảng giá thu mua công khai tại cảng theo loài/ngày (xem TL04) → đây là lý do bị ép. Hỏi 2–3 nơi/2–3 cảng lân cận trước khi gật.
4. **Chống ép cân:** tự cân/chứng kiến cân, ghi lại số cân và mức "trừ hao" từng chuyến để đối chứng — ép cân là dạng mất tiền âm thầm lớn không kém ép giá ([Dân Việt](https://danviet.vn/ban-hai-san-cho-dau-nau-phai-chiu-nhieu-he-luy-tu-luat-rieng-7777926731.htm)).
5. **Gom lô để bán kênh giá cao.** Tàu lẻ khó đạt lô nhà máy/HTX; gom qua HTX/nhóm tàu mới đủ lượng và đủ giấy tờ để bán thẳng nhà máy.
6. **Giữ giấy tờ truy xuất sạch (eCDT/nhật ký).** Muốn chạm tới giá xuất khẩu phải có hồ sơ nguồn gốc; thiếu giấy thì mãi chỉ bán được cho nậu/chợ nội địa ([Báo Quảng Ngãi](https://baoquangngai.vn/kinh-te/bien-kinh-te-bien/202308/truy-xuat-nguon-goc-thuy-san-khai-thac-con-nhieu-kho-khan-3bc1af9/)).
7. **Tách hàng giá trị cao bán lẻ/online.** Một phần hàng tươi/đặc sản bán Zalo/livestream giá cao, phần còn lại bán sỉ — không "bỏ hết trứng một giỏ".

---

## 4. Khoảng trống thành thật — vì sao app KHÔNG có danh sách nậu vựa

**ĐIỂM TRUNG THỰC then chốt:** tên và địa chỉ **TỪNG nậu vựa / đầu nậu / vựa cá cá nhân KHÔNG nằm trong bất kỳ cơ sở dữ liệu công khai nào.** Đây là **tri thức địa phương** truyền miệng trong làng chài. Mọi "danh sách nậu vựa" bịa ra đều sai và nguy hiểm (gắn tên thật vào giá/hành vi ép giá). Vì vậy file dữ liệu **không liệt kê nậu vựa cá nhân** — chỉ liệt kê **loại kênh** và **chợ đầu mối công khai**.

Lớp "nậu vựa/mối mua" phải đến từ hai nguồn:
1. **Mạng đại lý SDVICO** — đại lý ForFish ở từng cảng là người biết mối mua địa phương, có thể nhập/giới thiệu hợp pháp.
2. **Người dùng tự thêm "mối quen"** — bà con tự lưu người mua của mình. File dữ liệu đã thiết kế sẵn interface `SavedBuyer` (tên, loại: nậu vựa/vựa/nhà máy/HTX/khách lẻ, cảng, SĐT, loài, ghi chú giá/ứng tổn/mức trừ hao) để app lưu **riêng tư cho từng tàu**, đồng bộ khi có mạng. Đây là cách lấp lớp nậu vựa cá nhân mà không bịa dữ liệu.

Các gap khác:
- **Giá thu mua tại cảng theo loài/ngày** vẫn không có nguồn công khai → app nên crowdsource từ chính người dùng + đối chiếu giá chợ đầu mối.
- **Giờ họp/địa chỉ chợ** ở trên là tham khảo từ báo/wiki, có thể đã đổi (vd. chợ Hòn Gai đã dời địa điểm) — cần rà trước khi dùng làm chỉ đường.

---

## 5. Gợi ý cho app ForFish

- **Màn "Bán cho ai":** so 5 kênh theo đúng tàu (đang nợ nậu? gần chợ nào? có giấy eCDT chưa?) → gợi ý kênh phù hợp, không phán "bỏ nậu".
- **Sổ mối quen (`SavedBuyer`):** để bà con lưu người mua + ghi chú giá/cân từng lần, dần thành "lịch sử ai trả tốt".
- **Bản đồ chợ đầu mối + cảng** (ghép với `fishing-ports.ts`): chỉ chợ gần nhất, loài, giờ họp.
- **Checklist "bán được giá":** ướp đá → phân cỡ → hỏi ≥2 giá → kiểm cân → ghi lại — đúng mục 3.
- **Nhắc giấy tờ truy xuất** để mở khóa kênh nhà máy/HTX giá cao (nối với TL04 phần eCDT).

---

### Nguồn chính đã dùng

[Dân Việt — bán cho đầu nậu, "luật" riêng](https://danviet.vn/ban-hai-san-cho-dau-nau-phai-chiu-nhieu-he-luy-tu-luat-rieng-7777926731.htm) · [VTV — lệ thuộc nậu vựa](https://vtv.vn/kinh-te/le-thuoc-nau-vua-ngu-dan-bi-ep-gia-theo-nhieu-dang-thuc-20160405105657586.htm) · [Báo Quảng Ngãi — truy xuất nguồn gốc còn khó](https://baoquangngai.vn/kinh-te/bien-kinh-te-bien/202308/truy-xuat-nguon-goc-thuy-san-khai-thac-con-nhieu-kho-khan-3bc1af9/) · [Tiền Phong — ngư dân 'xài' 4.0](https://tienphong.vn/khi-ngu-dan-xai-40-post1316758.tpo) · [KTSG — livestream bán hàng tươi sống](https://thesaigontimes.vn/livestream-ban-hang-tuoi-song-mo-rong-thi-truong-di-kem-thach-thuc/) · [Bình Điền (Wiki)](https://vi.wikipedia.org/wiki/Ch%E1%BB%A3_%C4%91%E1%BA%A7u_m%E1%BB%91i_B%C3%ACnh_%C4%90i%E1%BB%81n) · [BQL Bình Điền](http://www.binhdienmarket.com.vn) · [Hóc Môn (Wiki)](https://vi.wikipedia.org/wiki/Ch%E1%BB%A3_%C4%91%E1%BA%A7u_m%E1%BB%91i_n%C3%B4ng_s%E1%BA%A3n_th%E1%BB%B1c_ph%E1%BA%A9m_H%C3%B3c_M%C3%B4n) · [Thọ Quang đấu giá (Tepbac)](https://tepbac.com/tin-tuc/full/da-nang-dau-gia-mua-ban-tai-cho-dau-moi-thuy-san-tho-quang-26061.html) · [Yên Sở (Ahamove)](https://kinhdoanh.ahamove.com/cho-yen-so) · [Chợ cá Hạ Long (CafeF)](https://cafef.vn/cho-ca-khong-ngu-duy-nhat-o-vinh-ha-long-188241028144615798.chn) · [Bảo quản đá (Aquaculture)](https://aquaculture.vn/khoa-hoc-ky-thuat/tu-van-ki-thuat/huong-dan-bao-quan-nguyen-lieu-thuy-san-tom-ca-muc-sau-thu-hoach-bang-nuoc-da) · [Sơ chế/phân cỡ (Khuyến nông VN)](https://khuyennongvn.gov.vn/portals/0/tailieu/2014/12/host/merge_17.pdf)

*Hết tài liệu 08.*
