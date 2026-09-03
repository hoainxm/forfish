# Báo hiệu hàng hải miền Nam — lấp số 0, 2026-09-02

> **Việc**: `public/data/vn-aids.v1.json` có **437 báo hiệu, không một cái nào dưới 15°B**.
> Mất trắng Vũng Tàu, TP.HCM, Cần Thơ, Cà Mau, Kiên Giang, Nha Trang, Quy Nhơn —
> đúng nửa nước có đội tàu đông nhất, và cũng là nơi **293/394 điểm đo sâu** của app
> đang nằm.
>
> Tài liệu này ghi **vì sao thiếu** (không phải lý do ai cũng đoán), **vá bằng gì**,
> **đo được bao nhiêu**, và **chỗ nào vẫn trắng**.
>
> Mọi con số là tự đo trong phiên **2026-09-02**.
> Đường ống: [`scripts/generate-vn-aids.mjs`](../../scripts/generate-vn-aids.mjs) ·
> nghiệm thu: [`scripts/kiem-ban-do.mjs`](../../scripts/kiem-ban-do.mjs)
> (`npm run kiem:ban-do`) · test: [`src/lib/__tests__/vn-aids.test.ts`](../../src/lib/__tests__/vn-aids.test.ts).

---

## 1. Giả thuyết ban đầu SAI — và đó là kết quả quan trọng nhất

Giả thuyết vào phiên: *"trang miền Nam dùng khuôn bảng khác, bộ bóc không nhận ra."*
Bằng chứng ủng hộ nó khá mạnh: `enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=33`
(luồng Định An – Cần Thơ, nhà nước công bố **118 phao**) trả về **HTTP 200, 76.799 byte,
16 thẻ `<table>`, 52 dòng `<tr>`**. Trang sống, có bảng, mà ta lấy được 0.

Đo lại thì không phải vậy. Tải cả 100 ID, cắt khối `<table>` **cân bằng** (đếm mở/đóng,
vì bảng báo hiệu nằm sâu trong 5–6 lớp bảng bố cục), rồi dò tiêu đề cột trên **mọi** khối:

| | |
|---|---|
| ID có tuyến luồng | **43** |
| tuyến **có** bảng chứa cả "Vĩ độ" lẫn "Kinh độ" | **21** |
| tuyến **không có** bảng nào như vậy — ở **bất kỳ** khối `<table>` nào, kể cả bảng bọc ngoài | **22** |

16 thẻ `<table>` của trang #33 là **bố cục** (khung, menu, ô tin tức). Không thẻ nào chứa
"Vĩ độ". Trong HTML của #33 cũng **không có** phần tử `ContentPlaceHolder_lblBaoHieu` —
phần tử mang tiêu đề "HỆ THỐNG BÁO HIỆU" của trang #1 (luồng Hải Phòng).

### 1.1 Khác biệt THẬT giữa trang lấy được và trang trượt

Nó lộ ra ở **chính bảng tóm tắt đầu trang**, và đó là hai khuôn trang khác nhau:

| | tiêu đề bảng tóm tắt | có bảng báo hiệu? |
|---|---|---|
| khuôn A | `Tên luồng \| Thông số luồng thiết kế \| Độ sâu hiện tại \| Bán kính cong nhỏ nhất \| Số báo hiệu` | **có** |
| khuôn B | `Tuyến luồng \| Thông số kỹ thuật \| Số báo hiệu` | **không** |

Khuôn B chỉ có ô **đếm** ("Phao 118" cho Định An, "Phao 54 / Tiêu 58" cho Sài Gòn – Vũng
Tàu) — không có chỗ nào để đặt danh sách. Và ranh giới giữa hai khuôn không ngẫu nhiên:

```
khuôn A (21 tuyến)  Hải Phòng · Phà Rừng · Hòn Gai · Sông Chanh · Vạn Gia · Diêm Điền
                    Hải Thịnh · Lệ Môn · Nghi Sơn · Cửa Lò · Cửa Hội · Vũng Áng
                    Cửa Gianh · Hòn La · Cửa Việt · Thuận An · Chân Mây · Đà Nẵng
                    Kỳ Hà · Dung Quất · Sa Kỳ                     ← hết ở 15,2°B
khuôn B (22 tuyến)  Quy Nhơn · Vũng Rô · Đầm Môn · Nha Trang · Ba Ngòi · Phú Quý
                    Sài Gòn–Vũng Tàu · Đồng Nai · Soài Rạp · Vũng Tàu–Thị Vải
                    Gò Gia · Sông Dừa · Sông Dinh · Đồng Tranh–Tắt Bài–Tắt Cua
                    Sông Tiền · Sa Đéc · Định An Cần Thơ · Côn Sơn–Côn Đảo
                    Bến Đầm · Năm Căn · Hà Tiên · An Thới
```

Khuôn B trùng khít địa bàn **Bảo đảm an toàn hàng hải miền Nam**.

### 1.2 Kiểm chéo ở một dataset khác của CÙNG cổng thông tin

Một bảng thiếu có thể là sự cố. Hai bảng thiếu cùng một chỗ thì là chính sách nhập liệu.
Quét `ChiTietDenBien.aspx?id=1..200` (hệ thống **đèn biển**, dataset độc lập với tuyến luồng):

| | |
|---|---|
| trang đèn biển có nội dung | **36** |
| ID lớn nhất còn có nội dung | **45** (từ 46 trở lên: trang rỗng, dài đúng 34.050 byte) |
| đèn cực nam trong đó | **Vạn Ca, 15,425°B** (Quảng Ngãi) |
| phân trang danh sách đèn (POST `Page$2`) | **HTTP 302 → `/?aspxerrorpath=`** — lỗi máy chủ |
| `MapView.aspx?ID=33` (bản đồ tuyến) | **302 → `AccessDenied.aspx`** — đòi đăng nhập |

Đối chiếu thêm ở `vmsa.vn` (`bao-hieu-hang-hai-249/he-thong-den-bien-286/`): **40 đèn**,
cực nam là **Sa Huỳnh 14,68°B / Ba Làng An / Lý Sơn**. Cũng chỉ có phần Bắc–Trung Bộ.
`vms-south.vn` — nơi đáng lẽ có phần miền Nam — **đã chết**, chỉ còn bản lưu trữ.

**Kết luận**: cổng ENC của Cục Hàng hải **mới nhập phần miền Bắc**. Sửa regex bao nhiêu
lần cũng không làm hiện ra dữ liệu chưa nhập. Đây là cái bẫy thứ tư của dự án ở dạng
gương: không phải "kết luận *không có gì* khi thật ra bóc trượt", mà là "đi sửa bộ bóc
khi thật ra nguồn trống". Cách phân biệt duy nhất là **đo**, không phải đoán.

---

## 2. Vá bằng gì: Thông báo hàng hải

Nguồn duy nhất còn lại cho miền Nam là **Thông báo hàng hải** — văn bản công bố của Tổng
công ty Bảo đảm an toàn hàng hải và các Cảng vụ. Mỗi lần **thiết lập · dịch chuyển · đổi
đặc tính · tạm ngừng · thu hồi** một báo hiệu đều có một thông báo, kèm bảng toạ độ
VN-2000 và WGS-84.

Repo **đã có** đường ống kéo kho này về cho lớp số đo sâu
([`fetch-soundings.mjs`](../../scripts/fetch-soundings.mjs),
[`ocr-soundings.mjs`](../../scripts/ocr-soundings.mjs)) và kho chữ nằm **ngoài repo**.
Phiên này không tải thêm gì, không ghi gì vào kho đó — chỉ **mở kho ra đọc lại theo một
câu hỏi khác**: không hỏi "đáy sâu bao nhiêu" mà hỏi "báo hiệu nằm ở đâu".

Nguồn `tbhh` đã đăng ký sẵn trong [`src/lib/provenance.ts`](../../src/lib/provenance.ts),
giấy phép `vn-official`, `redistributable: true`.

### 2.1 Thông báo là SỰ KIỆN, không phải sổ đăng ký

Đây là chỗ dễ sai nhất và nó nguy hiểm theo cả hai chiều. Xếp mọi tin về một báo hiệu
theo thời gian, lấy tin **mới nhất**, rồi quyết:

| việc trong tin | quyết | vì sao |
|---|---|---|
| **LẬP** thiết lập mới · đưa vào hoạt động · phục hồi hoạt động | giữ | |
| **ĐỔI** thay đổi đặc tính/vị trí · dịch chuyển · điều chỉnh | giữ | |
| **NÊU** công bố thông số (không có động từ hành động) | giữ | tin khẳng định báo hiệu đang tồn tại ở toạ độ đó |
| **NGƯNG** tạm ngừng hoạt động | **giữ**, ghi trạng thái | phao còn nổi, chỉ tắt chức năng |
| **GỠ** chấm dứt hoạt động · thu hồi · huỷ bỏ · tháo dỡ | **bỏ** | không còn ngoài biển |

Gộp NGƯNG vào GỠ là **xoá một cái phao đang nổi thật**; gộp GỠ vào giữ là **vẽ một cái
phao đã tháo**. Hai lỗi ngược chiều, nên hai nhãn phải tách. Trạng thái đi ra file ở
`routes[].tinhTrang`.

Thứ tự xét cũng không đảo được: một tin *"chấm dứt hoạt động phao … đã thiết lập theo
Thông báo số X"* chứa **cả hai** động từ. Xét GỠ trước thì đọc đúng.

Ví dụ thật, đúng ô nghiệm thu Cà Mau: `114/TBHH-TCTBĐATHHMN` ngày 5/6/2023 — *"tạm ngừng
hoạt động phao báo hiệu hàng hải số 6, luồng hàng hải Năm Căn – Bồ Đề"*, 8°42′32,3″N
105°16′06,3″E. Cùng ô đó còn `453/TBHH-TCTBĐATHHMN` (2022) — *"**chấm dứt** hoạt động phao
chuyên dùng NC1, NC2"*. Tin đầu **giữ**, tin sau **bỏ**. Nếu trộn hai loại làm một thì ô
Cà Mau hoặc vẫn là 0, hoặc có hai cái phao không tồn tại.

### 2.2 Bốn cái bẫy, và cổng chặn cho từng cái

| bẫy | biểu hiện thật trong kho | cổng |
|---|---|---|
| **toạ độ tách chữ** | OCR đọc `°` thành `0`/`9`: `105016'12,7"`, `16911'03.0"` — đọc ra 10°50′ thay vì 105°16′ | bắt buộc có dấu độ **thật**; phút/giây < 60; trong khung biển VN. Dòng không đạt thì **bỏ**, không đoán |
| **tên hoá số đo** | mảnh toạ độ vỡ trôi lên đầu dòng thành TÊN: `26A 1092649,8`, `10,9`, `15,4` | tên không được chứa `°`, không được có chuỗi **4 chữ số liền**, không được là số thập phân trơn, ≤ 4 từ |
| **địa danh hoá tên** | ô "Vùng biển"/"Tên luồng" tràn sang cột tên → dán `Thành phố Hồ Chí Minh.` lên một cái phao | chặn danh sách từ hành chính (thành phố · tỉnh · huyện · vùng biển · tên luồng · toạ độ) |
| **hàng lộn cột** | `15,4 10*17*07,39"N 10°04'52,13"N 109°17'3,71"E 107904258,55"` → bóc ra một điểm **hợp lệ mà sai chỗ**, cách cụm 250 km | (a) hai hệ toạ độ trên cùng dòng phải cách nhau < 2 km — chúng là **cùng một điểm**; (b) mọi báo hiệu của một tin phải nằm trong 60 km quanh **tâm cụm** của tin |

Cổng (b) là cái bắt được kiểu sai nguy hiểm nhất: điểm **trông đúng hoàn toàn** — đúng
định dạng, đúng khung biển VN, đúng dải kinh vĩ — mà nằm sai chỗ. Không có cổng cụm thì
nó lọt hết mọi phép kiểm khác.

### 2.3 Không đọc ra số hiệu thì NÓI THẲNG

**158/738** báo hiệu (đều từ nguồn B) có toạ độ nhưng OCR nuốt mất cột tên. Chúng vẫn giữ
vị trí, mang tên **"Báo hiệu (chưa rõ số hiệu)"**. Bịa một số hiệu trông như thật là kiểu
sai tệ nhất: bà con đối chiếu với Thông báo hàng hải sẽ không tìm thấy và mất tin vào cả
lớp. Có test chặn cả hai chiều — chặn tên hỏng, và chặn việc bỏ mất nhãn "chưa rõ".

---

## 3. Đo được gì

### 3.1 Số báo hiệu, chia theo vĩ độ

| | trước | sau | |
|---|---|---|---|
| **tổng** | 437 | **738** | +301 |
| **nam 15°B** | **0** | **147** | ← việc chính |
| bắc 15°B | 437 | 591 | +154 |
| nam 10°B | 0 | 70 | |
| dung lượng | ~28 KB | ~86 KB | ngân sách 200 KB |

Chia theo nguồn: **437** từ trang tuyến luồng ENC (`vinamarine`, 21 tuyến) — đúng bằng
số cũ, nguồn A tái lập y nguyên — cộng **301** từ Thông báo hàng hải (`tbhh`, 142 tin còn
hiệu lực).

### 3.2 `npm run kiem:ban-do` — trước / sau

Chỉ dòng **"báo hiệu Cục HH"**; các lớp khác không đụng tới.

| chỗ mẫu | toạ độ · zoom | trước | sau |
|---|---|---|---|
| **vung-tau** | 10,35°B 107,05°Đ z13 | **0** ✗ | **7** ✓ |
| **ca-mau** | 8,70°B 105,30°Đ z13 | **0** ✗ | **1** ✓ |
| **long-tau** | 10,60°B 107,00°Đ z13 | **0** ✗ | **4** ✓ |
| nghe-an | 19,80°B 105,93°Đ z13 | 13 ✓ | **19** ✓ |
| man-mo-dau | 12,80°B 110,80°Đ z4,6 | 437 (lớp tắt ở zoom này) | **738** (lớp tắt) |
| truong-sa | 8,65°B 111,92°Đ z10 | 0 ✗ | 0 ✗ — ngoài khơi xa, không có luồng |

Hai dòng phải sửa (`vung-tau`, `ca-mau`) đã hết 0. `long-tau` được vá kèm.
`truong-sa` vẫn 0 và **đúng là phải 0**: đó là biển hở, không có luồng hàng hải nào để
đặt phao.

### 3.3 Ký hiệu hải đồ

Mọi báo hiệu mới đều ra được ký hiệu qua
[`chartSymbolId()`](../../src/lib/chart-symbols.ts) — **0** cái rơi về `aid-unknown`
(test `chart-symbols.test.ts` đọc chính tấm sprite đã sinh và chặn nếu có loại lạ).

| loại | số | ký hiệu |
|---|---|---|
| `buoy_lateral` | 392 | `lat-port` / `lat-stbd` / `lat-unknown` (+ `-lit`) |
| `buoy_special_purpose` | 264 | `special` |
| `buoy_safe_water` | 28 | `safe-water` |
| `buoy_cardinal` | 21 | `card-n/s/e/w` |
| `beacon_lateral` | 12 | `bcn-lat-*` |
| `beacon` | 9 | `beacon` |
| `beacon_cardinal` | 7 | `bcn-card-*` |
| `buoy_isolated_danger` | 3 | `iso-danger` |
| `light_minor` | 2 | `light-minor` |

Trong đó **258** báo hiệu (gần hết là nguồn B) không đọc ra **vai trò** từ câu "Tác dụng"
nên xếp `buoy_special_purpose` — loại **không hứa gì** về mép luồng. Đây là mặc định an
toàn có chủ ý: xếp bừa thành `buoy_lateral` sẽ khiến bà con tưởng có mép luồng ở chỗ chưa
biết, và vẽ nhầm bên luồng là đưa tàu vào chỗ cạn.

---

## 4. Chỗ nào vẫn trắng

| chỗ trắng | quy mô | đường đi tiếp |
|---|---|---|
| **22 tuyến luồng miền Nam vẫn không có bảng đăng ký chính thức** | nhà nước công bố Định An 118 phao, Soài Rạp 66, Vũng Tàu–Thị Vải 68, Sài Gòn–Vũng Tàu 54+58 — ta có vài chục | ghi trong `thieuBang[]` **kèm lý do**, app nói được "chưa có dữ liệu" thay vì "không có phao" |
| **1.639/2.556 PDF trong kho chưa bóc chữ** | kho chữ OCR chỉ có 917 file; phần còn lại là PDF **có lớp chữ**, `ocr-soundings.mjs` không chạy vào | dùng bộ bóc PDF sẵn có trong `fetch-soundings.mjs` (§ "BÓC CHỮ TỪ PDF") — cần tách nó thành module dùng chung trước |
| **17 tin có bảng toạ độ mà không rõ việc** | chữ OCR hỏng cả câu "Về việc…" | không đoán; để lại |
| **11 điểm bị cổng cụm loại** | dòng OCR trộn cột | đúng ra là bỏ |
| **19 tin quá cũ** | phao chuyên dùng > 3 năm, tin thường > 10 năm | hết công trình là hết phao |
| **đèn biển miền Nam** (~50 cái: Vũng Tàu, Kê Gà, Côn Đảo, Hòn Khoai, Phú Quốc, Thổ Chu…) | cổng ENC **và** vmsa.vn đều chỉ có phần Bắc–Trung Bộ; vms-south.vn đã chết | tìm trong bản lưu trữ vms-south.vn (đã có sẵn trong kho `cdx`) hoặc Danh mục báo hiệu hàng hải bản giấy |

Số miền Nam hiện tại là **sàn, không phải trần**: bóc nốt 1.639 PDF còn lại là đường tăng
rõ ràng nhất, và nó không cần thêm một lần tải mạng nào.

---

## 5. Cổng giữ cho không tụt lại

- **Cổng chủ quyền** — không một ký tự Hán/CJK nào lọt; cổng tự chứng minh nó không rỗng.
- **Cổng khung biển VN** — mọi toạ độ trong `[4°N–24°N, 102°Đ–118°Đ]`.
- **Cổng ngân sách** — file ≤ 200 KB.
- **Cổng chống xoá nhầm** (mới) — hai nguồn nằm hai chỗ: nguồn A cần **mạng**, nguồn B cần
  **kho chữ ngoài repo**. Chạy trên máy thiếu một trong hai mà vẫn ghi đè thì repo mất nửa
  số báo hiệu, và mất **im lặng**. Cổng so số báo hiệu **theo từng nguồn** với file đang có
  và chặn nếu một nguồn tụt quá 20%. Ngưỡng đặt ở 20% chứ không phải 0 là có lý do: dao
  động vài cái là bình thường, cổng kêu bừa là cổng sẽ bị tắt.
- **Test** (`vn-aids.test.ts`, chạy mỗi `npm test`) — thêm bốn nhóm: miền Nam không được
  rỗng · hai ô Vũng Tàu và Cà Mau phải có báo hiệu · tên không được là mảnh toạ độ hay địa
  danh · mỗi tin nguồn B phải có số hiệu hoặc URL để tra lại tận gốc.

---

## 6. Giấy phép

Cả hai nguồn là **số liệu do cơ quan nhà nước Việt Nam công bố công khai**. Điều 15 Luật
Sở hữu trí tuệ loại "văn bản hành chính" và "tin tức thời sự thuần tuý đưa tin / số liệu"
khỏi bảo hộ quyền tác giả. Hai nguồn đã đăng ký trong
[`provenance.ts`](../../src/lib/provenance.ts) — `vinamarine` và `tbhh`, cùng giấy phép
`vn-official` (`redistributable: true`), nên dataset này **được** vào `cleanPackage()`.

Điều **phải** giữ là nhãn `nhan`: *"Tham khảo — phải đối chiếu Thông báo hàng hải trước
khi dùng để lái tàu"*. Không phải vì giấy phép mà vì **độ tươi**: trang ENC không ghi ngày
cập nhật, và kho thông báo thì chưa bóc hết. Mỗi báo hiệu mang theo số hiệu văn bản và URL
gốc trong `routes[].prov` — bà con hoặc cán bộ cảng vụ tra lại được tận gốc. Ta không phải
nguồn cuối cùng và không giả vờ là.
