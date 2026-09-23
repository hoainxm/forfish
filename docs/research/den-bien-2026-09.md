# Lớp đèn biển Việt Nam — dựng lại thành dữ liệu của mình, 2026-09-02

> **Việc**: Việt Nam có khoảng **90 đèn biển**. App đang không có lớp nào cho chúng, và
> hai cổng thông tin nhà nước còn sống đều **dừng ở Quảng Ngãi**: cổng ENC của Cục Hàng
> hải có 36 đèn, cực nam Vạn Ca 15,42°B; `vmsa.vn` có 40 đèn, cực nam Sa Huỳnh 14,68°B.
> Toàn bộ nửa nam — Vũng Tàu, Côn Đảo, Hòn Khoai, Phú Quốc, Thổ Chu, Nam Du, Hòn Chuối —
> cùng **Trường Sa** và **các nhà giàn DK1** không có trên cổng nào.
>
> Tài liệu này ghi **tìm ở đâu ra**, **cổng nào bắt được lỗi thật**, **đo được bao nhiêu**,
> và **cái gì vẫn thiếu**.
>
> Mọi con số tự đo trong phiên **2026-09-02**.
> Đường ống: [`scripts/generate-den-bien.mjs`](../../scripts/generate-den-bien.mjs) ·
> thư viện: [`src/lib/den-bien.ts`](../../src/lib/den-bien.ts) ·
> test: [`src/lib/__tests__/den-bien.test.ts`](../../src/lib/__tests__/den-bien.test.ts).

---

## 1. Vì sao đèn biển phải là một lớp riêng

Phao **trôi**: bị dịch, bị thu hồi, đổi số hiệu hằng tháng theo tiến độ công trình — đó là
lý do `vn-aids.v1.json` mang nhãn "tham khảo" và phải đối chiếu Thông báo hàng hải.

Đèn biển **đứng yên hàng chục năm**. Long Châu 1894, Kê Gà 1898, Hòn Khoai 1899. Chúng có
**tên riêng** bà con nhớ được, và là thứ người ta định hướng ban đêm khi mọi thứ khác tắt.
Một cái đèn sai vị trí nguy hiểm hơn một cái phao sai vị trí: người ta **lái theo** nó chứ
không chỉ tránh nó.

Hai lớp vì thế có hai nhịp cập nhật và hai mức tin cậy khác nhau. Trộn chung là để nhịp của
phao kéo lùi độ tin của đèn.

---

## 2. Ba nguồn, và vì sao phải đủ ba

| | nguồn | `SourceId` | phủ | cho gì |
|---|---|---|---|---|
| A | `enc.vinamarine.gov.vn/ChiTietDenBien.aspx?id=1..45` | `vinamarine` | Bắc–Trung Bộ | 36 đèn, kèm mã hải đồ Việt (`Ch.Tr.Nh(3).20s`) |
| B | `vmsa.vn/bao-hieu-hang-hai-249/he-thong-den-bien-286/` | `tbhh` | Bắc–Trung Bộ | 40 đèn, **công bố thẳng cột WGS-84** |
| C | bản lưu trữ Internet Archive của `vms-south.vn` | `tbhh` | **từ Bình Định trở vào** + Trường Sa + DK1 | 88 trang đèn |

Nguồn C là nơi **duy nhất** còn dữ liệu nửa nam. Trang gốc đã chết; bản lưu giữ nguyên khối
"THÔNG SỐ CHI TIẾT" của từng đèn.

Kho `cdx` của `vms-south.vn` **đã nằm sẵn trên đĩa** từ đợt kéo Thông báo hàng hải
(`scripts/fetch-soundings.mjs`) — phiên này dùng lại, không tải lại danh mục. Chỉ tải thêm
các trang HTML đèn biển, thứ đợt trước không lấy (đợt đó chỉ lọc `.pdf`).

**Thứ tự ưu tiên hình học: B → A → C.** Không phải "trang nào đẹp hơn" mà là **độ rõ của
hệ toạ độ**: vmsa.vn in cột WGS-84 (hệ bản đồ app dùng) cạnh cột VN-2000; cổng ENC phần lớn
chỉ có một cột không nói hệ; bản lưu là ảnh chụp một trang đã ngừng cập nhật. Nguồn thua
**không bị vứt** — nó thành `crossChecks` trong lý lịch, đúng thứ `confidenceOf()` cho điểm
nặng nhất.

### 2.1 Giấy phép

Cả ba là thông tin do cơ quan nhà nước Việt Nam công bố công khai. Điều 15 Luật Sở hữu trí
tuệ loại "văn bản hành chính" và "số liệu" khỏi bảo hộ quyền tác giả. Hai `SourceId` đã đăng
ký sẵn trong [`provenance.ts`](../../src/lib/provenance.ts) với `vn-official`
(`redistributable: true`, không share-alike), nên lớp này **vào được** `cleanPackage()`.

Nhãn `nhan` = *"Tham khảo — phải đối chiếu Thông báo hàng hải trước khi dùng để lái tàu"*
vẫn giữ, và **không phải vì giấy phép** mà vì độ tươi: không nguồn nào ghi ngày cập nhật, và
nguồn C là bản chụp 2013–2024. Mỗi đèn mang `prov.origin.url` để tra lại tận gốc. Ta không
phải nguồn cuối cùng và không giả vờ là.

---

## 3. Năm cái bẫy — và cổng cho từng cái

### 3.0 Lỗi chính tả của người nhập liệu · **suýt mất một ngọn đèn 135 tuổi**

Trang Cù Lao Xanh (Quy Nhơn, dựng 1890) gõ **"Tọa độ ĐẠI dư"** thay vì "địa dư". Bộ bóc dò
nhãn đúng chính tả nên trượt sạch **13 bản chụp**, và cái đèn lớn nhất cửa ngõ Quy Nhơn biến
mất khỏi lớp — **im lặng**, vì kết quả trông y hệt "nguồn không có đèn đó".

Bài học: nhãn cột do **người** gõ, nên mọi phép dò nhãn phải nới cho lỗi chính tả một bậc, và
mọi cái tên đọc được mà **không** ra toạ độ phải được ĐẾM và IN RA. Con số "45 mục trong
`thieu[]`" chính là thứ làm lộ ra cái đèn này.

### 3.1 Toạ độ bị tách chữ · **cổng đã bắt được lỗi thật**

Cả ba nguồn ghi dấu độ bằng `<sup>o</sup>` — **chữ cái o dựng lên cao**, không phải ký tự
`°`. Gỡ thẻ HTML một cách ngây thơ thì `20<sup>o</sup>37'24"N` thành `20 o 37' 24" N`, và
bất kỳ bộ đọc nào gom chữ số sẽ ra 20°37', 2°03,7' hay 203,7 tuỳ cách nó gom. Đây đúng cái
bẫy đã cắn lớp số đo sâu (`105016'12,7"` → 10°50' thay vì 105°16').

**Cổng**: dựng lại `°` ngay trên HTML **trước** khi gỡ thẻ, rồi bắt buộc chuỗi phải có ký tự
`°` **thật** mới đọc. Không có dấu độ = bỏ dòng, không đoán. Cộng: phút/giây < 60, và điểm
phải nằm trong khung `[4°N–24°N, 102°Đ–118°Đ]`.

Vì sao khung biển bắt được đúng lớp lỗi này: chữ số bị tách **luôn** đẩy một trục ra ngoài
khung — `105` vỡ thành `10 5` cho kinh độ 5,x°Đ (ngoài 102–118), `10` vỡ thành `1 0` cho vĩ
độ 0,x°B (ngoài 4–24). Test chèn tay đúng kiểu vỡ đó và đòi cổng đỏ.

### 3.2 Ô giây tràn sang giá trị sau · **lỗi thật, mất im lặng**

Bảng ba hệ toạ độ của cổng ENC nằm trên nhiều ô `<td>`; gỡ thẻ xong chúng dính thành một
chuỗi: `19°59'14"7 106°10'45"6`. Phần giây của giá trị trước (chữ số + khoảng trắng + dấu
giây) trông **y hệt** phần đầu của giá trị sau, nên bộ đọc nuốt luôn `106` vào ô giây rồi
làm mất hẳn kinh độ. Thiếu kinh độ thì cả cái đèn biến mất — **im lặng**, vì "một giá trị"
đơn giản là không đủ để thành một điểm.

**Cổng**: chèn một dấu ngăn ngay trước mỗi cụm `<số>°` để ô giây không thể tràn qua ranh
giới.

### 3.3 Hai hệ toạ độ trên cùng trang · **cổng đã bắt được lỗi thật**

vmsa.vn và vài trang ENC in cả VN-2000, "Hệ Hải đồ" và WGS-84 cạnh nhau. Lấy nhầm cột là
lệch ~200 m; đọc lộn hàng thì lệch hàng chục km mà **điểm vẫn trông hợp lệ hoàn toàn**.

**Cổng**: cột WGS-84 luôn đứng cuối bảng ⇒ có nhắc "WGS" thì lấy **cặp cuối**. Và mọi cặp
trên cùng một trang phải cách nhau **< 2 km** — chúng là cùng một điểm đo bằng hai hệ (lệch
thật ở Việt Nam cỡ 200 m). Lệch hơn = đọc lộn cột, bỏ cả điểm.

### 3.4 Đèn biển bị nhầm với phao

Cả hai đều là "báo hiệu hàng hải". Phân biệt bằng **cái tên**: đèn biển là công trình cố
định có tên riêng ("Kê Gà", "Hòn Khoai", "Song Tử Tây"); phao mang **số hiệu** đổi theo tiến
độ công trình ("Phao số 6", "NC1", "TC-02", "26A").

`laTenDenBien()` loại: chuỗi có ký tự `°`/nháy (mảnh toạ độ), chuỗi 3+ chữ số liền, số trơn,
tên chứa "phao"/"tiêu"/"đăng tiêu", dạng `<2–4 chữ cái><1–3 số>`, và câu văn > 6 từ (ô "Vùng
biển" tràn sang cột tên). Cổng này có **hai bản** — một trong bộ sinh dữ liệu, một trong thư
viện — và test bắt chúng phải trả lời **giống hệt nhau** trên toàn bộ tên thật cộng các ca
biên, để hai bản không trôi khỏi nhau.

---

## 4. Lỗi CỦA CHÍNH NGUỒN mà cổng bắt được

Đây là phần đáng giá nhất của phiên: không phải bộ bóc sai, mà **nguồn sai**.

### 4.1 Hai cặp đèn mang cùng một toạ độ · **cổng bắt được, 4 đèn bị bỏ**

| cặp | toạ độ trùng | ai đúng |
|---|---|---|
| **Ba Kè** ↔ **Quế Đường** (hai nhà giàn DK1) | `07°49'09,8"N 110°30'03,4"E` | không biết — bản lưu cũ của `ba-ke` còn ghi một toạ độ **khác** (`07°52'14"N 112°54'10"E`), nên chính trang Ba Kè cũng không nhất quán |
| **Ba Kiềm** ↔ **Hòn Hải** | `09°58'26,5"N 109°05'03,8"E` | toạ độ này **là của Hòn Hải** (đảo Hòn Hải, Bình Thuận); trang Ba Kiềm tự mô tả nó ở *"núi Hai Cô, xã Bưng Riềng, huyện Xuyên Mộc, Bà Rịa – Vũng Tàu"* — cách đó ~200 km |

Hai ngọn đèn biển không thể đứng cách nhau 100 m. Cổng bắt được cả hai cặp.

**Xử: bỏ CẢ HAI trong mỗi cặp**, ghi toạ độ và lý do vào `thieu[]`. Giữ một cái là đoán — và
một cái đèn thiếu thì bà con **biết** là thiếu, còn một cái đèn sai chỗ thì bà con **tin nó**.

⚠️ Cặp thứ hai là mất mát thật: **Hòn Hải** gần như chắc chắn đúng, và nó là điểm cơ sở A6
của đường cơ sở lãnh hải Việt Nam. Nó bị bỏ vì **trang Ba Kiềm chép nhầm**, không phải vì dữ
liệu của nó xấu. Chỉ cần một Thông báo hàng hải cho Ba Kiềm là khôi phục được cả hai — đây
là việc đáng làm sớm, xem §8.

### 4.2 Bản chụp cũ và mới của cùng một trang mâu thuẫn nhau

`truong-sa-lon`: bản 2013 ghi `10°22'42"N 114°28'33"E`, bản 2020 ghi `08°38'25"N
111°55'00"E`. Bản 2020 đúng (đảo Trường Sa Lớn ở 8°38'N 111°55'Đ) — luật "đi từ bản mới nhất
lùi dần" cho kết quả đúng, nhưng nó là **may**, không phải bằng chứng. Ghi lại ở đây để lần
sau ai đó đổi luật thì biết mình đang đổi cái gì.

### 4.3 Một mâu thuẫn CHƯA giải được — cần chủ dự án quyết

Trang `vung-tau` của vms-south mang tiêu đề *"Hải đăng Vũng Tàu"* nhưng câu Tác dụng viết
*"Chỉ vị trí **đảo Côn Sơn, Côn Đảo**, Bà Rịa – Vũng Tàu"*, và toạ độ `8°39'13"N 106°35'58"E`
đúng là ở Côn Đảo — cách thành phố Vũng Tàu ~185 km.

Đọc được hai kiểu: (a) tiêu đề là tên cũ/nhầm, dữ liệu đúng cho đèn trên đảo Côn Sơn;
(b) toạ độ nhầm. Không có nguồn thứ hai (cổng ENC và vmsa.vn đều dừng ở 15°B).

**Hiện đang giữ nguyên như nguồn công bố** — đổi tên là ta tự bịa, mà bỏ đi là mất một ngọn
đèn có thật ở một vị trí có thật. Nhưng hệ quả phải nói rõ: **đèn biển Vũng Tàu ở Núi Nhỏ
(≈10°20'N 107°05'Đ) hiện KHÔNG có trong lớp này**, và mục mang tên "Vũng Tàu" nằm ở Côn Đảo.
Đây là việc cần một Thông báo hàng hải hoặc Danh mục báo hiệu bản giấy để chốt.

---

## 5. Đo được gì

### 5.1 Bảng số

| | |
|---|---|
| **tổng số đèn** | **90** |
| so với ước lượng ~90 đèn của cả nước | ≈ đủ |
| **nam 15°B** (nửa nam — trước phiên này app có **0**) | **50** |
| nam 10°B | 19 |
| bắc 15°B | 40 |
| trên quần đảo **Trường Sa** | **9** (Song Tử Tây · Sơn Ca · Nam Yết · Sinh Tồn · Tiên Nữ · Đá Tây · Đá Lát · Trường Sa Lớn · An Bang) |
| trên nhà giàn **DK1** | 2 (Phúc Tần · Huyền Trân) |
| có **đặc tính đèn** đủ (kiểu chớp + chu kỳ) | **90 / 90** |
| có tầm hiệu lực ánh sáng | 90 |
| có chiều cao tháp đèn | 90 |
| có chiều cao tâm sáng | 88 |
| có màu thân tháp (dấu hiệu ban ngày) | 80 |
| có năm thiết lập | 72 |
| có nơi đặt (tỉnh) | 84 |
| **được nguồn thứ hai xác nhận vị trí** | 27 |
| dung lượng file | **31,0 KB** (trần 200 KB) |

Cực bắc **Vĩnh Thực 21,40°B**, cực nam **An Bang 7,89°B** — trải đúng chiều dài bờ biển
cộng Trường Sa.

Chia theo nguồn gốc hình học: **89 `tbhh`** (vmsa.vn + bản lưu vms-south) · **1
`vinamarine`** (An Hòa). Con số 1 không phải vì cổng ENC vô dụng: nó đọc được **28** đèn,
nhưng vmsa.vn phủ gần hết cùng địa bàn và **thắng ưu tiên** vì công bố thẳng cột WGS-84. 27
đèn còn lại của ENC đi vào `crossChecks` — đúng chỗ chúng có giá trị nhất.

Loại: 89 `light_major`, 1 `light_minor` (Mũi Chụt, 9 hải lý).

### 5.2 Chưa lấy được — nói thẳng, không giấu

`thieu[]` trong chính file dữ liệu ghi **45 mục** kèm lý do, để app nói được *"chưa có dữ
liệu"* thay vì *"không có đèn"*. Nhưng **40 trong số đó vẫn CÓ MẶT trong lớp** — chúng chỉ
trống ô toạ độ ở MỘT nguồn và được nguồn khác bù (ví dụ Long Châu, Hòn Dấu, Bạch Long Vĩ
trống ở cổng ENC, đầy đủ ở vmsa.vn). Đây là lý do phải giữ cả ba nguồn.

**Năm cái tên thật sự KHÔNG có trong lớp:**

| tên | vì sao |
|---|---|
| Đèn báo cảng Lý Sơn | chỉ có 2 bản chụp trong lưu trữ, cả hai không có ô toạ độ |
| Ba Kiềm · Hòn Hải | nguồn ghi **cùng một toạ độ** cho cả hai (§4.1) |
| Ba Kè · Quế Đường | nguồn ghi **cùng một toạ độ** cho cả hai (§4.1) |

---

## 6. Đặc tính đèn: dịch bằng bộ dịch đã có, không viết bộ thứ hai

Nguồn viết bằng lời (*"Ánh sáng trắng, chớp nhóm (3+1) chu kỳ 20 giây"*), vài trang kèm mã
hải đồ Việt (*"Ch.Tr.Nh(3+1).20s"*). Bộ sinh dữ liệu dịch **ngược** về `LightInfo` của
[`seamarks.ts`](../../src/lib/seamarks.ts) — `character: "Fl"`, `group: "3+1"`, `period: 20`,
`colour: "white"` — rồi `describeLight()` dựng câu:

> *"Chớp 3 nhịp rồi 1 nhịp, ánh trắng, 20 giây một vòng, xa 22 hải lý"*

`describeLight()` là bộ dịch mã hải đồ sang tiếng Việt **duy nhất** của dự án. Viết bộ thứ
hai là để hai bộ nói khác nhau về cùng một cái đèn. Test đòi: mọi `character` trong file phải
là khoá `describeLight()` hiểu, và câu ra **không được chứa cụm chữ Latin nào từ 2 ký tự trở
lên** — lọt chữ Anh nghĩa là dataset mang mã lạ và câu đã rơi mất nửa đầu.

Loại đèn: `light_major` / `light_minor`, ranh **10 hải lý**. Không phải con số đẹp mà là mốc
chức năng: dưới 10 hải lý thì cái đèn chỉ dùng để **vào cửa** (đã nhìn thấy bờ), trên 10 thì
nó là mốc **định hướng ngoài khơi**. Cả hai đều là khoá có sẵn của `SEAMARK_LABEL` và
`chartSymbolId()`, nên đèn biển ra được ký hiệu hải đồ mà không thêm một nhánh nào — test
chặn nếu có cái nào rơi về `aid-unknown`.

---

## 7. Cổng giữ cho không tụt lại

- **Cổng chủ quyền** — không một ký tự Hán/CJK nào; không tên Anh/Trung của thực thể Việt
  Nam trong bảng tên; cổng tự chứng minh nó không rỗng.
- **Cổng khung biển VN** — mọi toạ độ trong `[4°N–24°N, 102°Đ–118°Đ]`, kiểm trên **từng
  hàng của file** chứ không chỉ trên kết quả đã giải mã.
- **Cổng tách chữ** — chèn tay một toạ độ vỡ vào bản sao dữ liệu, đòi bộ giải mã loại nó.
- **Cổng tên** — hai bản của `laTenDenBien()` phải trả lời giống hệt nhau.
- **Cổng trùng chỗ** — hai đèn khác tên trong 100 m ⇒ bỏ cả hai (§4.1).
- **Cổng chống xoá nhầm** — ba nguồn đều cần mạng; chạy trên máy mất một nguồn mà vẫn ghi đè
  thì repo mất một mảng đèn, mất **im lặng**. So với file đang có, tụt quá 20% thì chặn.
  Ngưỡng 20% chứ không phải 0 vì cổng kêu bừa là cổng sẽ bị tắt.
- **Cổng mất sóng** — `fetchDenBien()` hỏng thì **xoá bộ nhớ đệm**; test đòi lần gọi thứ hai
  phải ra mạng lại. Nhớ cả lần hỏng là khoá vĩnh viễn một lớp bản đồ giữa chuyến biển.
- **Cổng ngân sách** — file ≤ 200 KB.

---

## 8. Chỗ nào vẫn trắng, và đường đi tiếp

| chỗ trắng | đường đi tiếp |
|---|---|
| **Đèn biển Vũng Tàu (Núi Nhỏ)** — mục mang tên đó đang nằm ở Côn Đảo (§4.3) | Danh mục báo hiệu hàng hải bản giấy, hoặc Thông báo hàng hải của Cảng vụ Vũng Tàu |
| **Hòn Hải và Ba Kiềm** — bỏ vì trang Ba Kiềm chép nhầm toạ độ của Hòn Hải (§4.1). Hòn Hải là điểm cơ sở A6 | **ưu tiên cao nhất**: một Thông báo hàng hải cho Ba Kiềm là khôi phục được cả hai |
| **Ba Kè và Quế Đường** — bỏ vì nguồn ghi trùng toạ độ | cần một nguồn thứ ba cho nhà giàn DK1 |
| **Đèn báo cảng Lý Sơn** — lưu trữ chỉ có 2 bản chụp, cả hai trống ô toạ độ | Thông báo hàng hải Cảng vụ Quảng Ngãi |
| **đèn mới lập sau 2018** — bản lưu vms-south dừng ở đó | vmsa.vn có mục Thông báo hàng hải *"thiết lập mới đèn biển …"* (đã thấy Lạch Ghép, Thanh Hoá); đường ống Thông báo hàng hải trong `fetch-soundings.mjs` đã kéo sẵn kho — đọc lại kho đó theo câu hỏi "đèn biển nào mới lập" là bước rẻ nhất |
| **đặc tính đèn của một số đèn nguồn để trống** | Thông báo hàng hải *"thay đổi đặc tính đèn biển …"* |
| **vài trang bản lưu không tải được** (máy chủ Internet Archive từ chối lúc chạy) | chạy lại script — kho tải về giữ nguyên, chỉ tải phần còn thiếu |

---

## 9. Việc KHÔNG làm trong phiên này

Lớp này **chưa nối vào bản đồ**. `src/lib/den-bien.ts` chỉ có bộ giải mã + `fetchDenBien()`;
việc thêm lớp vào `ocean-map.ts`, thêm dòng vào `scripts/kiem-ban-do.mjs`, và thêm file vào
danh sách cache của `public/sw.js` thuộc về Lead — cả ba đều là chỗ nhiều nhóm cùng chạm.

⚠️ Khi nối: `public/data/den-bien.v1.json` **phải** vào danh sách cache offline. Đèn biển là
thứ bà con dùng đúng lúc mất sóng.
