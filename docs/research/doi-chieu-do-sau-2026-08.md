# Đối chiếu số đo sâu khảo sát bằng vệ tinh — đo thật 31/08/2026

> **Hướng đối chiếu bị lật ngược.** Giả thuyết ban đầu: khảo sát của Cảng vụ
> đúng, lưới độ sâu vệ tinh của app sai, lấy khảo sát sửa lưới. Lead đo và bác
> bỏ: 377/379 điểm và 13/13 đoạn luồng KHỚP lớp đi biển của lưới ETOPO+GEBCO,
> hai điểm lệch đều nằm sát ngưỡng 12 m. **Lưới không cần sửa.**
>
> Nên việc đi chiều ngược lại: **dùng vệ tinh soi lỗi BÓC trong dữ liệu chính
> thức vừa thu**. Đường ống bóc PDF đã sinh điểm giả nhiều lần và mọi lần đều
> im lặng — con số giả nằm trong dải hợp lý nên mọi cổng hiện có cho qua.
>
> **Công cụ**: `scripts/verify-soundings.mjs` · **Kết quả**:
> `public/data/soundings-verified.v1.json` (290 KB) · **Cổng**:
> `src/lib/__tests__/soundings-verify.test.ts` · **Thang tin cậy**:
> `src/lib/provenance.ts` (dùng lại, không sửa).
> Mọi số dưới đây chạy lại được bằng `node scripts/verify-soundings.mjs`.

---

## 0. Kết luận trước (6 dòng)

1. **Tìm ra một lỗi bóc THẬT, chưa ai biết**: thông báo
   `57/TBHH-TCTBĐATHHMN` có **16/17 số đo bị rơi chữ số lẻ** — 7,7 m vào file
   thành 7 · 8,5 → 8 · 6,5 → 6. Mở PDF gốc đọc bằng mắt đã xác nhận từng số.
2. **Cùng thông báo đó còn nuốt nhầm 3 hàng của một thông báo KHÁC**
   (`59/TBHH-TCTBĐATHHMN`): một file PDF của kho lưu trữ chứa NHIỀU mục thông
   báo, đường ống coi một PDF là một thông báo.
3. **Vệ tinh KHÔNG bắt được lỗi đó** — lệch chỉ 0,1–0,9 m, dưới mọi ngưỡng
   phân giải của mô hình 450 m. Thứ bắt được nó là **chính dữ liệu tự khai**:
   tỉ lệ số "mét chẵn" của thông báo đó là 94%, mọi thông báo khác 0–20%.
4. **Vệ tinh mù ở 37,5% số mục** — 163 điểm nằm trong sông (Lòng Tàu, Thị Vải,
   Soài Rạp, Năm Căn) nơi lòng lạch hẹp hơn ô 450 m nên cả hai mô hình xếp là
   ĐẤT. Ở đó phải trả "không đối chiếu được", **không được trả "khớp"**.
5. **Không còn điểm giả kiểu "DHN - 0 6" nào sống sót**: Δ lớn nhất toàn corpus
   là 12,8 m, chưa tới nửa trần kết tội 20 m; không mục nào rơi ra ngoài địa
   bàn 40 m. Cổng vẫn giữ, và test chèn tay một điểm giả để chứng minh nó đỏ.
6. **39% số điểm mang NGÀY BỊA**: 149/379 điểm của `soundings.v1.json` ghi ngày
   `2019-01-01` / `2019-05-01`, suy từ đường dẫn `/uploads/2019/01/` của bản
   lưu trữ. Script tự hứa ghi cờ `ngayUocLuong: true` cho ca này — **cờ chưa
   bao giờ được ghi ra file**.

---

## 1. Đối chiếu với cái gì, và vì sao chỉ hai nguồn

| Nguồn | Endpoint đã gọi thật | Vai |
|---|---|---|
| **ETOPO 2022 15″** | `https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json` | CÙNG endpoint sinh `depth-grid.v1.bin` — tức lưới app đang chạy |
| **GEBCO Grid 15″** | `https://api.odb.ntu.edu.tw/gebco?lon=…&lat=…&mode=point` | Bản gộp thứ hai, bước lưới y hệt ⇒ so được **ô với ô** |

Không dùng Allen Coral Atlas / UNEP-WCMC ở đây: chúng lập bản đồ **rạn**, không
cho độ sâu tại điểm. Không dùng NGA MSI: cổng hiểm hoạ vẫn 503 (đã ghi ở
[doi-chieu-nguon-2026-08.md](doi-chieu-nguon-2026-08.md)).

Cách gọi: GEBCO nhận **lô 100 toạ độ** (bắt buộc `mode=point`, thiếu nó API nội
suy thành trắc diện). ETOPO gọi **theo ô 0,1°** rồi tra trong ô — 1.066 toạ độ
rơi vào 52 ô ⇒ 52 lượt gọi thay vì 1.066, mà vẫn là giá trị ô THẬT vì ERDDAP
trả kèm toạ độ tâm ô.

### Hai mô hình này KHÔNG độc lập — số đo nói vậy

Trên 362 điểm cả hai cùng thấy nước, khoảng vênh giữa chúng có **trung vị
0,0 m** · p90 2 m · p95 6 m · lớn nhất 17 m. Quá nửa số ô hai bên trả về **y
hệt nhau** — chúng gộp chung nhiều khảo sát nền.

Hai hệ quả, cả hai đã đưa vào code:

- **Chấm điểm**: `collapseFamilies()` gộp `gebco` + `etopo` về **một** xác nhận
  trước khi tính. Đếm thành hai nguồn độc lập là tự thưởng 40 điểm trọng số
  lớn nhất cho một sự trùng khớp không mang thông tin.
- **Kết tội**: đòi **cả hai** cùng thấy nước và cùng nói sâu, rồi lấy bên
  **nông hơn** làm chứng — luôn nghiêng về phía tha bổng.

---

## 2. Ngưỡng — mỗi số một lý do, không có số tròn cho đẹp

### 2.1 Dải tha bổng: `tol = 6 m + |d_GEBCO − d_ETOPO|`

Ba ngân sách sai lệch CÓ THẬT giữa "số khảo sát" và "số mô hình":

| # | Nguồn sai | Cỡ | Chiều |
|---|---|---|---|
| a | **Chuẩn mực nước**: khảo sát quy về *số 0 hải đồ* (≈ mực nước thấp nhất thiên văn), mô hình quy về *mực nước trung bình* | 1–2 m (triều VN ~4 m ở Hòn Dấu/Vũng Tàu, ~1,5–2 m miền Trung) | khảo sát **nông hơn**, luôn một chiều |
| b | **Ô 450 m nuốt luồng**: luồng nạo vét rộng 100–150 m nằm gọn trong một ô; giá trị ô là trung bình của luồng VÀ bãi hai bên | tới ~9 m | mô hình **nông hơn** |
| c | **Nội suy**: ven bờ VN không có đo đa tia, giá trị là nội suy giữa tuyến khảo sát cũ | **không đoán — đo được** | hai chiều |

(c) là chỗ dễ bịa số nhất, nên **không bịa**: cỡ sai số của họ mô hình chính là
khoảng vênh giữa hai bản gộp tại đúng ô đó. Hai bản còn lệch nhau S mét ở đây
thì không bên nào dám nhận chính xác hơn S. Vì vậy `tol` **co giãn theo từng
điểm**, không phải một hằng số hay một hệ số nhân độ sâu.

Sàn **6 m** = (a) 2 m + (b) sàn 4 m. Soi lại bằng phân bố đo được: |Δ| so với
khảo sát có trung vị **1,8 m** · p90 **5,0 m** · p95 **6,8 m**. Sàn nằm ngay
trên p90 — đủ rộng để không kết tội nhiễu thường ngày, đủ hẹp để không nuốt
một lỗi bóc.

> Bản nháp đầu dùng `tol = 6 + 0,5 × d_mô_hình`. Bỏ, vì ở ô sâu 28 m nó cho
> phép lệch 20 m — rộng bằng cả trần kết tội. Hệ số nhân độ sâu là số bịa;
> khoảng vênh giữa hai mô hình là số đo.

### 2.2 Chiều lệch quyết định, không chỉ độ lớn

**Δ < 0 — khảo sát SÂU HƠN mô hình: KHÔNG BAO GIỜ kết tội.** Đây là chữ ký của
nạo vét và vũng cảng đào sâu; vệ tinh không thể thấy hai thứ đó, và bản gộp
GEBCO có khi lấy khảo sát từ thập niên trước. **Khảo sát đúng, mô hình cũ.**
Lỗi bóc kiểu "DHN - 0 6" tạo số **nông** giả, không tạo số sâu giả — nên chiều
này không mang thông tin về lỗi bóc.

**Δ > 0 — mô hình sâu hơn, khảo sát báo nông:** hai khả năng khác hẳn nhau, và
đây mới là chỗ phải cân. Một cồn cát 6 m giữa vũng 20 m là **đúng thứ Thông
báo hàng hải sinh ra để báo**; nhưng "6 m ở chỗ biển sâu 200 m" là số giả. Hai
ngưỡng tách chúng:

| Ngưỡng | Giá trị | Vì sao đúng con số đó |
|---|---|---|
| `OUT_OF_DOMAIN_M` | **40 m** | Trần **địa bàn của chính nguồn này**, không phải trần của biển. Cả 557 số đo nằm trong 1,2–15,4 m; 105 tuyến trong 1,1–17,4 m; ô mô hình **sâu nhất** dưới một điểm khảo sát bất kỳ là **31 m**. 40 m ≈ 2,3× số sâu nhất corpus và trên cả ô sâu nhất đo được. Đường đẳng sâu 40 m ở thềm VN cách bờ vài chục km — không cảng vụ nào ra đó cắm mốc luồng. Rơi vào đây thì hoặc toạ độ sai hoặc độ sâu sai. |
| `BIG_GAP_M` | **20 m** | Lớn hơn **toàn bộ bao lệch đo được**: gấp gần 3× p95 của \|Δ\| (6,8 m) và trên cả khoảng vênh lớn nhất giữa hai mô hình (17 m). Δ lớn nhất thật sự thấy trong corpus là **12,8 m**. Cổng chỉ mở khi khoảng lệch vượt ra ngoài mọi thứ dữ liệu thật từng thể hiện. |

### 2.3 Ngưỡng đã BỎ — và vì sao ghi lại

Đề bài gợi ý một tiêu chí: *"điểm nằm trên đất liền theo cả hai nguồn ⇒ nghi
lỗi"*. **Tiêu chí đó SAI ở vùng biển Việt Nam.** Bản nháp đầu cài đúng như vậy
(mọi ô trong bán kính 1,5 km đều là đất) và ra **138 "nghi lỗi"** — gần như
toàn bộ là oan:

```
[soundings.v1.json diem#14] 1814/TBHH-CVHHTPHCM 2026-07-17
   107.01381, 10.52531 · khảo sát 13,7 m · GEBCO đất · ETOPO đất
```

Đó là luồng **Cái Mép – Thị Vải**, sâu 13–14 m thật, tàu container vào hằng
ngày. 195/557 điểm nằm trong tình cảnh này. Ô 450 m không phân giải nổi một
lòng lạch 300–500 m giữa rừng ngập mặn — nó nói **mô hình không biết**, không
nói dữ liệu sai.

**Luật thay thế: cả hai mô hình phải cùng thấy NƯỚC mới được kết luận.** Ba ca
đều trả "không đối chiếu được":
- cả hai xếp là đất (163 điểm),
- hai mô hình mâu thuẫn đất↔nước (17 điểm),
- đoạn luồng có dưới một nửa số ô lấy mẫu là nước (73 tuyến/đoạn).

> **Im lặng cho qua và tuyên vô tội là hai chuyện khác nhau.** Đây là lý do
> "không đối chiếu được" là một hạng riêng chứ không gộp vào "khớp".

### 2.4 Cổng thứ hai — chữ số lẻ bị rơi (`WHOLE_METRE_SHARE = 0,8`)

Vệ tinh **mù** trước lỗi này: lệch 0,1–0,9 m, dưới mọi ngưỡng ở trên. Nhưng dữ
liệu tự khai: máy hồi âm ghi tới 0,1 m, nên tỉ lệ số **đúng mét chẵn** trong
một thông báo bình thường phải nhỏ. Đo trên 15 thông báo có điểm:

| Thông báo | n | mét chẵn |
|---|---|---|
| 1493/TBHH-CVHHTPHCM | 134 | 6 (**4%**) |
| 237/TBHH-TCTBĐATHHMN | 132 | 7 (**5%**) |
| 465/TBHH-CVHHĐN | 19 | 0 (**0%**) |
| 1810/TBHH-CVHHTPHCM | 19 | 1 (**5%**) |
| 867/TBHH-CVHHTPHCM | 10 | 2 (**20%**) |
| … 10 thông báo khác | | **0–17%** |
| **57/TBHH-TCTBĐATHHMN** | 17 | **16 (94%)** |

Hai cụm cách nhau rất xa (20% ↔ 94%); ngưỡng 0,8 nằm giữa. Sàn **8 điểm** loại
ca ngẫu nhiên — thông báo 3 điểm toàn số nguyên là chuyện thường.

---

## 3. Kết quả: 675 mục

| Kết quả | Điểm | Tuyến | Đoạn | Tổng |
|---|---|---|---|---|
| **KHỚP** | 344 | 28 | 6 | **378 (56,0%)** |
| **LỆCH GIẢI THÍCH ĐƯỢC** | 16 | 11 | 0 | **27 (4,0%)** |
| **NGHI LỖI BÓC** | 17 | 0 | 0 | **17 (2,5%)** |
| **KHÔNG ĐỐI CHIẾU ĐƯỢC** | 180 | 66 | 7 | **253 (37,5%)** |

Δ = mô_hình − khảo_sát trên 407 mục so được: min **−11,4** · p05 −7,8 ·
p50 **−1,7** · p95 2,6 · max **12,8** m.

Trung vị âm là **đúng như dự đoán vật lý**: phần lớn số đo nằm trong luồng nạo
vét mà ô 450 m san phẳng mất (ngân sách b), lấn át lệch chuẩn mực nước (ngân
sách a) đi theo chiều ngược lại.

Bậc tin cậy: **A = 246 · B = 132 · D = 297**. A dành riêng cho mục KHỚP có
thông báo dưới 1 năm tuổi; B là mục KHỚP nhưng thông báo cũ (hai bản 2019);
D là mọi mục không có xác nhận nào — gồm cả 253 mục vệ tinh không nhìn thấy.

---

## 4. Nghi lỗi: truy ngược ra nguyên nhân

### 4.1 `57/TBHH-TCTBĐATHHMN` — 17/17 điểm, hai lỗi chồng nhau

Nguồn: `web.archive.org/…/vms-south.vn/wp-content/uploads/2019/05/45-TBHH.pdf`.
Đã tải PDF gốc và đọc bằng mắt.

**Lỗi 1 — chữ số lẻ rơi mất.** Bản song ngữ vẽ chữ số lẻ ở toạ độ khác nên bộ
bóc dựng nó thành **dòng riêng**:

```
Chèn Độ sâu 7 10°34'55.39"N 106°50'11.82"E
7                                              ← chữ số lẻ, dòng riêng ⇒ 7,7 m
Chèn Độ sâu 8 5 10°45'15.61"N 106°44'45.93"E   ← 8,5 m
```

| Toạ độ | PDF | Trong file |
|---|---|---|
| 10°34'55,39"N 106°50'11,82"E | **7,7** | 7 |
| 10°39'39,16"N 106°48'08,09"E | **7,9** | 7 |
| 10°39'49,38"N 106°47'51,25"E | **8,3** | 8 |
| 10°44'33,60"N 106°45'13,81"E | **8,2** | 8 |
| 10°45'08,66"N 106°44'47,09"E | **7,9** | 7 |
| 10°45'15,61"N 106°44'45,93"E | **8,5** | 8 |
| 10°45'20,36"N 106°44'51,85"E | **8,4** | 8 |
| 10°45'26,53"N 106°44'55,89"E | **8,4** | 8 |
| 10°45'36,92"N 106°43'21,92"E | **6,5** | 6 |
| 10°45'38,05"N 106°43'12,34"E | **7,3** | 7 |
| 10°45'46,77"N 106°45'05,66"E | **7,5** | 7 |

Đúng **một** hàng qua được — hàng duy nhất PDF vẽ dấu chấm thật (`7.6`).
Chiều lệch *có vẻ* an toàn (báo nông hơn thực tế), nhưng đây là dữ liệu ghi
"đo bằng máy hồi âm, tới 0,1 m": làm tròn xuống trong im lặng là hứa một độ
chính xác không có.

**Lỗi 2 — nuốt nhầm thông báo bên cạnh.** File `45-TBHH.pdf` là một **bản tin
Thông báo hàng hải chứa NHIỀU mục**:

```
318/2019 … Nguồn: … thông báo số 57/TBHH-TCTBĐATHHMN
319/2019 … Nguồn: … thông báo số 59/TBHH-TCTBĐATHHMN
```

Đường ống coi *một PDF = một thông báo*, nên **3 hàng của thông báo 59** bị
đóng dấu là 57:

| Toạ độ | Thuộc | PDF | Trong file (gán cho 57) |
|---|---|---|---|
| 10°37'58,81"N 106°49'24,12"E | 59/TBHH | **3,5** | 3 |
| 10°38'01,78"N 106°49'20,81"E | 59/TBHH | **4,?** | 4 |
| 10°38'01,11"N 106°49'17,19"E | 59/TBHH | **14,2** | 14 |

Đồng thời **4/7 hàng còn lại của thông báo 59 mất hẳn**, và thông báo 57 cũng
rụng 9 hàng: PDF liệt kê **23** số đo, file giữ **14**.

> Trớ trêu: `237/TBHH-TCTBĐATHHMN` (132 điểm, 35% cả bộ) đến từ cùng kho lưu
> trữ nhưng **sạch** — `01-TBHH.pdf` chỉ chứa một mục (260/2019) và PDF vẽ dấu
> chấm thật (`8.6`). Lỗi không phải ở "kho lưu trữ", mà ở **cách PDF vẽ chữ**.

### 4.2 Không có ca "khảo sát 6 m, vệ tinh 200 m" nào còn sống

Cổng vẫn được giữ và được test bằng cách chèn tay một điểm giả
(`classifyDepth(6, -200, -200)` phải trả `nghi-loi`). Trên dữ liệu thật: không
mục nào có min(GEBCO, ETOPO) vượt 40 m; Δ lớn nhất là 12,8 m tại
`106,99831 / 10,50822` (vịnh Gành Rái, khảo sát 15,2 m, mô hình 28–31 m) — một
điểm cạn thật trong vũng sâu, xếp **lệch giải thích được**.

---

## 5. Lỗ hổng còn lại của đường ống bóc

Bốn chỗ tìm được trong đợt này, xếp theo mức độ nguy hiểm:

### 5.1 🔴 Ngày BỊA mà không có cờ — 149/379 điểm (39%)

`scripts/fetch-soundings.mjs` tự ghi trong `## Assumptions`:

> *"Đọc không ra thì lùi về NĂM-THÁNG trong đường dẫn `/wp-content/uploads/<năm>/<tháng>/`
> và lấy ngày 01 — ghi rõ `ngayUocLuong: true` để không ai tưởng đó là ngày ký."*

**Cờ đó không tồn tại trong file**: `grep -c ngayUocLuong public/data/soundings.v1.json` → **0**.
Hai thông báo lưu trữ mang ngày `2019-01-01` và `2019-05-01` — cả hai đều là
ngày suy từ đường dẫn, không phải ngày ký. Cả hai PDF **không có ngày ký nào**;
mốc duy nhất là "hải đồ cập nhật ngày 02/01/2019" và "23/4/2019".

Vì sao nghiêm trọng: chính đầu `src/lib/soundings.ts` viết *"NGÀY của thông
báo đi kèm TỪNG điểm… một số đo sâu không có ngày là một con số nguy hiểm"*.
Đường ống đang trao một ngày **giả chính xác** cho 39% số điểm, và tuổi thật
của chúng là **≥ 7,5 năm** ở luồng bồi lắng liên tục.

**Nên sửa**: ghi `ngayUocLuong: true` như đã hứa, và để giao diện nói
"khoảng 2019" chứ không nói "01/01/2019".

### 5.2 🔴 Một PDF ≠ một thông báo

Bản tin của Bảo đảm an toàn hàng hải miền Nam gộp nhiều mục NtM trong một file.
Đường ống lấy **số hiệu đầu tiên tìm thấy** rồi đóng dấu cho mọi hàng toạ độ
trong file. Cần cắt theo ranh giới mục (`\d{3}\s*/\s*\d{4}\s*-` + dòng
`Nguồn: … thông báo số …`) trước khi bóc bảng.

### 5.3 🟡 Chữ số lẻ nằm ở dòng riêng

Bộ dựng dòng của `pdfPages` gom chữ theo vị trí vẽ; khi ký tự thập phân lệch
vài phần trăm điểm về trục Y nó rơi sang dòng khác. Bộ đọc độ sâu chỉ nhìn
trong một dòng nên mất chữ số lẻ **mà không báo**. Hai đường ra: dựng dòng theo
ngưỡng Y rộng hơn cho bảng, hoặc cộng thêm cổng "mét chẵn" của file này vào
chính `fetch-soundings.mjs` để nó **tự từ chối** ghi ra một thông báo như vậy.

### 5.4 🟡 Không khử trùng giữa hai file

- **173/178 hàng** của `soundings-cangvu.v1.json` **trùng byte-với-byte** với
  một hàng đã có trong `soundings.v1.json`. Chín trong mười thông báo của file
  cảng vụ đã nằm sẵn ở file vmsa. Hai đường ống thu cùng một thông báo từ hai
  cổng khác nhau và không ai hỏi bên kia.
- **19 cặp hàng trùng hệt nhau NGAY TRONG** `soundings-cangvu.v1.json`
  (38/178 hàng) — cùng lon, lat và độ sâu. `keepNewestPerSpot` (lưới gộp ~11 m)
  có trong `src/lib/soundings.ts` nhưng đường ống cảng vụ không gọi.

Chưa nguy hiểm cho bà con (cùng số, cùng chỗ), nhưng nó làm **mọi phép đếm sai
gấp đôi** — kể cả phép đếm trong chính báo cáo này.

### 5.5 🟢 Chưa đủ bằng chứng, ghi lại để lần sau soi

`22/TBHH-CVHHTPHCM` ghi ngày **2025-01-05** nhưng PDF nằm ở thư mục
`TBHH2026/`. Mở PDF: bản đăng web là **bản chưa ký**, ô số hiệu để trống và
dòng ngày là "*ngày   tháng 01 năm 2026*" — tức **2026**, không phải 2025. Chỉ
một thông báo, và nó không mang điểm nào (chỉ 1 tuyến), nên chưa dựng cổng
riêng; nhưng nó xác nhận lỗi năm vẫn còn đường lọt.

---

## 6. Vùng không đối chiếu được — và vì sao

**253/675 mục (37,5%).** Không phải lỗi công cụ, mà là giới hạn vật lý của mô
hình 450 m:

| Ca | Số mục | Vì sao |
|---|---|---|
| Cả hai mô hình xếp ô là **đất** | 163 điểm | Lòng lạch (Lòng Tàu, Thị Vải, Soài Rạp, Năm Căn – Bồ Đề, Đồng Nai) rộng 300–500 m, hẹp hơn hoặc xấp xỉ một ô lưới; ô lấy trung bình cả rừng ngập mặn hai bên |
| Hai mô hình **mâu thuẫn** đất↔nước | 17 điểm | Ví dụ `465/TBHH-CVHHĐN`: GEBCO nói đất +1 m, ETOPO nói nước −25 m tại cùng một ô. Khi hai bản gộp cãi nhau về việc có nước hay không thì không bên nào làm chứng được |
| Đoạn luồng có **< 50% ô là nước** | 73 tuyến/đoạn | Cùng lý do, chạy dọc theo đường thay vì tại điểm |

Nói cách khác: **vệ tinh soi được biển hở và cửa biển, không soi được sông.**
Mà phần lớn Thông báo hàng hải nói về sông. Muốn phủ nốt 37,5% này thì cần
nguồn có độ phân giải mét — ảnh Sentinel-2/PlanetScope suy độ sâu vùng nông,
hoặc chính hải đồ điện tử ENC của Vinamarine. Cả hai nằm ngoài đợt này.

---

## 7. Độ tin cậy: dùng thang của `provenance.ts`, không dựng thang mới

`scripts/*.mjs` không nạp được alias `@/lib`, nên script **chép hằng số** của
`src/lib/provenance.ts` (trọng số 40/25/20/15, `OFFSET_FULL_M` 150,
`OFFSET_ZERO_M` 3000, `FRESH_FULL_DAYS`, `FRESH_ZERO_DAYS`) — đúng cách
`compare-sources.mjs` đã làm với haversine. Mối nối giữ bằng test: file
`soundings-verify.test.ts` import `provenance.ts` **thật**, đối chiếu từng hằng
số, và chạy `confidenceScore` song song với `confidenceOf` trên bốn ca để bắt
lệch công thức.

Bốn yếu tố áp vào bài này như sau:

| Yếu tố | Cách áp | Ghi chú |
|---|---|---|
| **Xác nhận độc lập** (40) | Chỉ tính khi mục **KHỚP**; ETOPO + GEBCO gộp thành **một** xác nhận | Xem §1: trung vị vênh 0,0 m |
| **Hạng phương pháp** (25) | Mượn `survey-compilation` (0,75) cho `tbhh` | Đo hồi âm trực tiếp đáng hạng cao hơn, nhưng `provenance.ts` chưa có hạng đó và **không thuộc phạm vi sửa**. Điểm ở đây là **cận DƯỚI** |
| **Vênh vị trí** (20) | Khoảng cách từ điểm đo tới **tâm ô** mà mô hình trả lời | Vênh thật, không hình thức: giá trị mô hình thuộc về tâm ô. Nửa đường chéo ô 15″ ≈ 318 m, luôn rơi trong dải 150–3000 m nên nó thật sự đổi điểm |
| **Độ tươi** (15) | Tuổi thông báo tính tới ngày đối chiếu | Đúng chỗ hai bản 2019 rơi từ A xuống B |

**`tbhh` vẫn CHƯA đăng ký trong `SOURCES`** — `validateProvenance` vẫn báo
"nguồn lạ", cổng ở `fairway-depth.test.ts` vẫn cố ý đỏ, và
`confidenceOf(prov)` với `origin.source: "tbhh"` **vẫn ném** (`SOURCES["tbhh"]`
là `undefined`). File này không sửa chỗ đó; nó chỉ ghi lại rằng khi có người
đăng ký nguồn thì điểm tin cậy chỉ **tăng**, nên không ca nào bị tha oan vì
chỗ mượn hạng.

---

## 8. Chạy lại

```bash
node scripts/verify-soundings.mjs            # đối chiếu + ghi file (≈2 phút)
node scripts/verify-soundings.mjs --stats    # chỉ in phân bố, KHÔNG ghi file
node scripts/verify-soundings.mjs --offline  # dùng lại kho tạm, không gọi mạng
npx vitest run src/lib/__tests__/soundings-verify.test.ts
```

Kho tạm (phản hồi thô của hai mô hình) nằm ở thư mục tạm của hệ điều hành,
**ngoài repo** — quy tắc CHỐNG PHÌNH #5. `public/data/` sau đợt này:
**116,2 MiB**, còn dưới trần 120 MiB.

## 9. Việc còn lại

| # | Việc | Ai |
|---|---|---|
| 1 | Ghi `ngayUocLuong: true` như `fetch-soundings.mjs` đã hứa; giao diện nói "khoảng 2019" | chủ `fetch-soundings.mjs` |
| 2 | Cắt PDF theo ranh giới mục NtM trước khi bóc bảng | chủ `fetch-soundings.mjs` |
| 3 | Dựng lại chữ số lẻ nằm ở dòng riêng, HOẶC chặn ngay lúc sinh bằng cổng "mét chẵn" | chủ `fetch-soundings.mjs` |
| 4 | Khử trùng giữa `soundings.v1.json` và `soundings-cangvu.v1.json`; gọi `keepNewestPerSpot` ở đường ống cảng vụ | chủ hai `fetch-soundings*.mjs` |
| 5 | Đăng ký `tbhh` + hạng `survey` trong `provenance.ts` | chủ `provenance.ts` |
| 6 | Sau khi (2)(3) xong: chạy lại script, XOÁ ca đỏ có chủ ý trong `soundings-verify.test.ts` | ai sửa |
