# Thông báo hàng hải → số đo sâu khảo sát — chạy thật cả nước, 2026-08-31

> **Mọi con số trong tài liệu này là kết quả tự chạy**, không trích lại từ tài liệu khác.
> Ngày truy cập nguồn: **2026-08-31**. Mã chạy: `scripts/fetch-soundings.mjs`,
> thư viện thuần: `src/lib/soundings.ts`, test: `src/lib/__tests__/soundings.test.ts`.
> Đầu ra: **`public/data/soundings.v1.json`** (cả nước; file mẫu hai luồng đã xoá).
>
> **Bối cảnh**: bản rà độ phủ ghi lớp SOUNDG (số đo sâu rời của chuẩn S-57) = **0%**.
> App chỉ có ETOPO 2022 (~450 m/ô) — mô hình nội suy từ vệ tinh, không một điểm khảo
> sát thật nào. Đây là khoảng cách lớn nhất còn lại so với hải đồ thương mại.

---

## 1. Kết luận thẳng

Đợt này **bỏ bộ lọc theo tiêu đề**, **tải hết rồi mới xét**, và **kéo thêm kho lưu trữ
miền Nam trong Internet Archive**. Kết quả cả nước:

| | |
|---|---:|
| **Điểm đo sâu** (có toạ độ + độ sâu tại điểm) | **379** |
| **Tuyến** (tim luồng/khu nước + độ sâu khống chế) | **96** · 652 đỉnh |
| Thông báo bóc được | **64** |
| Cơ quan ban hành (vùng) | **10** |
| Cỡ file | **645 KB** (0,62 MB — trần hook là 20 MB) |
| Độ tươi | **2019-01-01 … 2026-08-21**; 45 thông báo năm 2026, 17 năm 2025, 2 năm 2019 |

**Ba đính chính, cả ba đều theo hướng ngược nhau — nên phải nói rõ từng cái:**

1. **Bỏ lọc tiêu đề là ĐÚNG, và nó lấy về phần lớn dữ liệu.** Bộ lọc cũ sẽ vứt
   **741/1.260** thông báo trong cửa sổ có PDF. Trong 65 thông báo cho ra dữ liệu, phần
   lớn nằm ở nhóm mà bộ lọc cũ loại.
2. **Nhưng tỷ lệ "51% có bảng toạ độ" KHÔNG đúng cho cả kho.** Con số đó đo trên mẫu
   **đã lọc theo tiêu đề**. Đo trên **toàn bộ** thông báo, không lọc: **1.791 bảng toạ
   độ** tìm thấy, nhưng chỉ **65** thông báo có bảng kèm được một con số độ sâu. Phần
   còn lại là **vị trí phao báo hiệu và góc khu vực thi công** — toạ độ thật, nhưng
   không phải dữ liệu độ sâu. Hai câu "51% có bảng toạ độ" và "5% có độ sâu" **cùng
   đúng**, chúng đếm hai thứ khác nhau.
3. **"91% miền Nam có lớp chữ" chỉ đúng cho thông báo cảng vụ 2025–2026.** Bản lưu trữ
   `vms-south.vn` (bản tin của Bảo đảm an toàn hàng hải miền Nam) thì **358/1.415 là ảnh
   scan**. Tính chung cả nước, **985/2.261 PDF (43,6%) là ảnh** — xem §5.1 để biết vì
   sao đây là kết luận về NGUỒN chứ không phải lỗi bộ bóc.

**Đánh giá thẳng**: 379 điểm + 96 tuyến **không** khép được khoảng cách với hải đồ
thương mại về mật độ. Nó khép ở chỗ khác: đây là **khảo sát thật, quy về số 0 hải đồ,
phần lớn dưới 3 tháng tuổi** — mới hơn mọi hải đồ thương mại. Giá trị nằm ở *độ tươi và
đúng chỗ nguy hiểm*, không nằm ở mật độ.

---

## 2. Hai nguồn, vì một nguồn không đủ

### 2.1. `vmsa.vn` — danh mục sống, nhưng là kho của MIỀN BẮC đổi tên

- **8.163 thông báo**, 25 chuyên mục vùng biển, 20 mục/trang, phân trang theo offset.
- **File đính kèm CHỈ có từ 2025 trở đi.** Dò biên bằng cách lấy 4 mục đầu ở nhiều
  offset khác nhau: `hai-phong-253` offset 0 và 200 (2026, 2025) → **4/4 có PDF**;
  offset 400, 700, 1000, 1400, 1800, 2200, 2600 (2024 → 2007) → **0/4 có PDF**. Cùng
  kết quả ở `quang-ngai-264` và `tp.-ho-chi-minh-452`.
- Vì vậy đường ống cắt theo **NGÀY ≥ 2025-01-01** — đó là phép cắt **đo được**, không
  phải phỏng đoán về nội dung. Trong cửa sổ ấy: **1.260 mục**, tải được **1.144 PDF**.
- Mốc đổi cũng thấy trong số hiệu: trước 2025 là `TBHH-TCTBĐATHHMB` (Bảo đảm an toàn
  hàng hải miền Bắc), từ 2025 là `TBHH-CVHHxx` của từng cảng vụ.

### 2.2. Internet Archive giữ kho `vms-south.vn` đã chết

- CDX API (`web.archive.org/cdx/search/cdx?url=vms-south.vn*`): **2.220 PDF** riêng biệt.
- Lấy từ **2019** trở đi (trước đó gần như toàn ảnh scan): **1.432 URL**, tải được
  **1.415** (17 trả HTTP 404).
- Tải qua `/web/<timestamp>id_/<url>` để lấy **bản nguyên**, không có thanh công cụ chèn.
- **Thu về: 149 điểm, 0 tuyến.** Thấp so với công bỏ ra — nhưng nó là **cách duy nhất
  tìm được** để có chiều sâu lịch sử miền Nam, và giờ đã biết trần của nó.

### 2.3. Lịch sự với hạ tầng công cộng

- `vmsa.vn`: nối đuôi, nghỉ **250 ms** giữa mỗi yêu cầu.
- Internet Archive: đo thật **~6 giây/file** phía máy chủ (nó dựng lại file từ kho WARC),
  nối đuôi thì 1.432 file mất hơn ba tiếng. Dùng **4 luồng**, mỗi luồng vẫn nghỉ **900 ms**
  ⇒ khoảng 4 yêu cầu/giây, xong trong ~1 giờ.
- **Tải một lần rồi cache ra NGOÀI repo** (thư mục tạm của phiên). Chạy lại không tải
  lại — đây là lý do sinh lại dataset không tốn thêm một yêu cầu nào.

---

## 3. Đường ống bóc — `scripts/fetch-soundings.mjs`

### 3.1. Bóc chữ từ PDF: tự viết, không thêm dependency

Repo không có thư viện PDF nào. Thêm một gói nặng cho việc chạy vài lần một năm là sai
thang (nguyên tắc 15, bậc 5). Bộ bóc dùng `zlib` của thư viện chuẩn và xử lý ba thứ mà
PDF của các cảng vụ dùng thật — **thiếu bất kỳ cái nào là ra rác, không phải ra lỗi**:

1. **Object stream (`/ObjStm`, PDF ≥1.5)** — từ điển font nằm nén bên trong. Không bung
   thì không thấy `/ToUnicode`, và chữ ra dạng dịch mã.
2. **CMap `bfrange` dạng đích MẢNG** — `<0069> <006B> [<00E1> <00E0> <00E2>]`. Đây đúng
   là chỗ chứa dấu tiếng Việt `á à â`. Bỏ nó thì `hàng hải` ra `hng hải` và mọi regex
   tiếng Việt trượt sạch.
3. **Dựng lại DÒNG theo toạ độ vẽ** (nhân ma trận CTM × Tm) — bảng toạ độ là bảng bố
   cục; đọc theo thứ tự byte trong stream là ra hàng lộn cột.

> `scripts/link-fairway-depths.mjs` (đường ống ghép đoạn luồng, của teammate khác) **cắt
> mục 2–3 của file này ra dùng lại** theo mốc `/* ══ 2.` … `/* ══ 4.`. Viết lại đường ống
> vẫn giữ nguyên mốc cắt và các hàm `pdfPages` · `get` · `parseList` · `isDepthNotice` ·
> `sleep`. **Đừng đổi tiêu đề mục** mà không sửa mốc bên đó.

### 3.2. Hai khuôn dữ liệu, xét theo TỪNG BẢNG

| Khuôn | Nhận ra bằng | Đi vào |
|---|---|---|
| (a) bảng **có cột độ sâu** | `hasDepthColumn` — xem §4.2 | `diem[]` — điểm đo sâu rời |
| (b) bảng **tim tuyến / góc khu nước** + câu *"…độ sâu… đạt X m"* ngay sau bảng | `readControllingDepthM` | `tuyen[]` — đường có độ sâu khống chế |

Khuôn (b) là thứ đợt trước vứt hết vào `boSot` ("hàng có toạ độ nhưng không có cột độ
sâu"). Nó **đông gấp ba** khuôn (a): 50 thông báo so với 15.

⚠️ **Phải cắt theo TỪNG BẢNG, không gộp cả thông báo.** Thông báo 969/TBHH-CVHHKG
(luồng Năm Căn – Bồ Đề) có **hai** bảng tim tuyến rời nhau, mỗi bảng một độ sâu (11,8 m
và 10,0 m). Gộp làm một là nối hai khúc luồng cách nhau vài km thành một đường không có
thật, rồi gán cho nó một độ sâu không thuộc về khúc nào.

⚠️ **Bảng bốn góc khu vực + một câu độ sâu ở văn xuôi PHẢI vào `tuyen[]`, không vào
`diem[]`.** Gắn "đạt 14,46 m" vào bốn cái góc là **bịa ra bốn phép đo ở bốn toạ độ thật**.
Cổng `hasDepthColumn` là chỗ chặn: bảng không có cột độ sâu thì không bao giờ sinh điểm.

### 3.3. Bảng chỉ có VN-2000 thì BỎ, không đoán

Bảng toạ độ trong thông báo thường có **hai hệ cạnh nhau**:

```
        Hệ VN-2000                          Hệ WGS-84
Độ sâu  Vĩ độ         Kinh độ               Vĩ độ          Kinh độ
7,5     10˚44’39,04”N 106˚44’42,29”E        10˚44’35,4”N   106˚44’48,7”E
```

Hai hệ lệch **~180 m** ở vùng biển này (test đo và chốt ngưỡng ≥100 m) — đủ đưa tàu ra
ngoài luồng. Đường ống đọc thứ tự cột từ **dòng tiêu đề của chính bảng đó**, không mặc
định. Kiểm chéo trên toàn kho: **0 file** có bảng mà không có dòng tiêu đề hệ toạ độ,
và **0 file** có tiêu đề một hệ mà hàng lại chứa hai cặp — nên không có chỗ nào bị lẫn hệ.

---

## 4. Bốn cổng đỏ — không qua thì KHÔNG ghi file

Mỗi cổng canh một kiểu sai **không tự lộ ra**: số vẫn hợp lý, file vẫn ghi được, không
ai biết. Cả bốn đều có ca test chép tay từ dữ liệu thật.

### 4.1. Vùng đọc từ SỐ HIỆU, không đọc từ chuyên mục

Chuyên mục trên `vmsa.vn` dùng **tên tỉnh sau sáp nhập 2025**, và cảng vụ nào phụ trách
vùng nào thì KHÔNG theo tên tỉnh đó. Đối chiếu chéo slug ↔ số hiệu trên toàn kho:

| Chuyên mục | Số hiệu thật ghi | Nghĩa là |
|---|---|---|
| `an-giang-456` | `CVHHKG` (17/17) | **Kiên Giang** — An Giang không giáp Rạch Giá |
| `ca-mau-455` | `CVHHKG` (17/17) | Kiên Giang phụ trách luôn Cà Mau |
| `gia-lai-449` | `CVHHQNh` (34/35) | **Quy Nhơn** |
| `lam-dong-457` | `CVHHBT` (28/30) | **Bình Thuận** |
| `tp.-ho-chi-minh-452` | `CVHHTPHCM` + `CVHHVT` | gồm cả **Vũng Tàu** |

Nên "vùng" trong dataset là **cơ quan ban hành**, thứ mà số hiệu nói được chắc chắn —
không phải tỉnh, vì suy ra tỉnh là thêm một tầng đoán nữa.

Ba cái bẫy con bên trong, đều đã cắn thật:

- **Không viết hoa số hiệu.** `CVHHQNg` (Quảng Ngãi) và `CVHHQNh` (Quy Nhơn) chỉ khác
  chữ cái cuối viết thường. Viết hoa toàn bộ là gộp hai cảng vụ cách nhau 300 km.
- **`CVHHQN` là Quảng Ninh**, không đoán mò: nó xuất hiện **78/78 lần** dưới chuyên mục
  `quang-ninh-252`.
- **`CVHHĐN` trùng khít cho Đà Nẵng và Đồng Nai.** Không tách được bằng chữ, tách bằng
  **vĩ độ** (Đà Nẵng ~16,1°N, Đồng Nai ~10,6°N, mốc 14°N). Không có vĩ độ thì trả `null`,
  KHÔNG đoán.
- Mã lạ hoặc mã **cụt** do bóc PDF hỏng (`TCTBĐATHHM` — thiếu chữ cuối, không biết MB hay
  MN) đều trả `null` và được in ra cuối lần chạy. Lần chạy này: **0 mã lạ mang dữ liệu**.

### 4.2. Tên điểm KHÔNG được đọc thành độ sâu — cổng nay ở mức CẢ BẢNG

Án lệ cũ: `"DHN - 0 6"` là TÊN ĐIỂM bị đọc thành **6 m**, ở toạ độ thật, trong dải hợp
lý; đã sinh 4 điểm giả. Cổng cũ (ô độ sâu phải chỉ chứa con số) chặn được cái có chữ.

**Nó không chặn được bảng mà cột tên điểm chỉ là SỐ**: `01`, `06`, `12`. Mỗi hàng trông
y hệt một hàng độ sâu. Cổng mới nằm ở **cả bảng, không ở từng hàng**: máy hồi âm đo tới
0,1 m, nên một cột độ sâu thật gần như chắc chắn có **ít nhất một số lẻ**; cột tên điểm
thì toàn số nguyên.

Đo trên toàn kho: **1.791 bảng toạ độ**, chỉ **35** có ít nhất một số lẻ ở ô độ sâu.
Trong 1.756 bảng bị loại, mẫu ô số đọc được gồm `"8"`, `"13"`, `"14"` (số hiệu phao) và
`"995746119"` (số MMSI của tàu) — **không cái nào là độ sâu**. Cổng cắn đúng chỗ.

### 4.3. Thông báo mới đè thông báo cũ

Luồng được nạo vét thì độ sâu đổi, và các cảng vụ khảo sát lại **đúng những điểm cạn
cũ**. Ô lưới ~11 m (0,0001°): cùng chỗ thì giữ bản **mới nhất theo ngày**; bằng ngày thì
giữ bản **nông hơn** (an toàn hơn cho tàu — cùng luật với `keepNewestPerSegment` của
`fairway-depth.ts`).

Lần chạy này: **415 → 379 điểm**, bỏ **36** bản cũ hơn. Ví dụ thật: 1493/TBHH-CVHHTPHCM
(2026-06-16) có hai điểm ở ~10,5297 N 107,0186 E, bị 1810 và 1814/TBHH-CVHHTPHCM
(2026-07-17) đè — đúng khúc luồng Vũng Tàu vừa được khảo sát lại.

### 4.4. Ngày ban hành phải đứng vững

Bản lưu trữ không có danh mục để hỏi ngày, nên ngày bóc từ chính PDF — và **bản ký số
thường để trống ô ngày** (`Số:    /TBHH-…, ngày    tháng    năm    `), khiến bộ đọc
trượt xuống và vớ phải ngày của một **văn bản được dẫn** trong phần căn cứ:
*"Nghị định 58/2017 ngày 10/5/2017"*. Một khảo sát 2025 thành ra đo năm **2017**. Không
cổng nào khác chặn được: ngày đúng khuôn, năm có thật, điểm vẫn trong khung biển.

Cổng: năm của ngày phải khớp năm của chính bản lưu (`/uploads/<năm>/<tháng>/`), lệch tối
đa một năm. Không khớp thì lùi về năm-tháng của bản lưu. **Bắt được 4 trường hợp** trong
lần chạy này.

*(Hai cổng cũ giữ nguyên: không một ký tự Hán/CJK nào lọt vào đầu ra; mọi điểm nằm trong
khung biển VN và trong dải độ sâu hợp lý.)*

---

## 5. Kết quả cả nước — số thật

Lệnh đã chạy:

```bash
node scripts/fetch-soundings.mjs --nguon vmsa                    # cả 25 vùng biển
node scripts/fetch-soundings.mjs --nguon wayback --song-song 4   # kho lưu trữ 2019+
node scripts/fetch-soundings.mjs --nguon ca --chi-kho            # ghép, không tải lại
```

| Bước | vmsa.vn | Kho lưu trữ | Cộng |
|---|---:|---:|---:|
| Mục danh mục đọc được | 1.380 | — | 1.380 |
| Trong cửa sổ có PDF (≥ 2025-01-01) | 1.260 | — | 1.260 |
| *(bộ lọc TIÊU ĐỀ CŨ sẽ bỏ)* | *741* | — | *741* |
| URL PDF xét | — | 1.432 | |
| **PDF mở được** | 1.144 | 1.117 | **2.261** |
| · ảnh scan | 627 | 358 | **985** (43,6%) |
| · có lớp chữ nhưng **bảng mã hỏng** | 52 | 10 | **62** |
| · bảng **có cột độ sâu** | 13 | 2 | **15** |
| · **tim tuyến / góc vùng** có độ sâu | 50 | 0 | **50** |
| · không có bảng toạ độ mang độ sâu | — | — | 1.150 |
| **Điểm đo sâu** | **230** | **149** | **379** |
| **Tuyến** | **96** | **0** | **96** |

### 5.1. "43,6% ảnh scan" là kết luận về NGUỒN, không phải lỗi bộ bóc

Kiểm chéo bắt buộc, vì "không bóc được chữ" và "không có chữ" là hai chuyện khác nhau.
Với **626** PDF của `vmsa.vn` bị gọi là ảnh scan, đếm **số toán tử vẽ chữ** có thật
trong file sau khi bung mọi stream:

| Toán tử vẽ chữ | Số file |
|---|---:|
| 0 (ảnh thuần) | **460** |
| 1–50 (dấu ký số, số trang) | **165** |
| 51–200 | 0 |
| **>200 (có thân văn bản)** | **1** |

625/626 không có thân văn bản nào để bóc. Bộ bóc đúng.

### 5.2. Kiểu hỏng thứ ba: có lớp chữ nhưng bảng mã hỏng

**62 file** có nhiều dòng chữ nhưng font thiếu `/ToUnicode` khả dụng, nên chữ bóc ra là
mã tuỳ font — trông như rác (`; X© W K LË Q`, số hiệu ra `308/TBHH- 7 & 7 % $ 7 + + 0`).
Vẫn nhiều dòng, vẫn ghi được file, không cổng nào đỏ. **Đếm riêng, không gộp vào "scan"**,
và ghi vào `boSot` với lý do đúng tên. Đây là nhóm còn cứu được nếu sau này chịu đọc
`/Differences` và bảng mã chuẩn của font — chưa làm.

### 5.3. Phủ theo cơ quan ban hành

| Mã | Cơ quan | Điểm | Tuyến |
|---|---|---:|---:|
| CVHHTPHCM | Cảng vụ Hàng hải TP. Hồ Chí Minh | 198 | 35 |
| TCTBĐATHHMN | Bảo đảm an toàn hàng hải miền Nam *(kho lưu trữ)* | 149 | 0 |
| CVHHĐN | Cảng vụ Hàng hải Đồng Nai | 19 | 1 |
| CVHHKG | Cảng vụ Hàng hải Kiên Giang | 7 | 11 |
| CVHHBT | Cảng vụ Hàng hải Bình Thuận | 5 | 14 |
| CVHHNT | Cảng vụ Hàng hải Nha Trang | 1 | 12 |
| CHHĐTVN | Cục Hàng hải và Đường thuỷ Việt Nam | 0 | 15 |
| CVHHVT | Cảng vụ Hàng hải Vũng Tàu | 0 | 3 |
| CVHHCT | Cảng vụ Hàng hải Cần Thơ | 0 | 3 |
| CVĐTNĐIV | Cảng vụ Đường thuỷ nội địa khu vực IV | 0 | 2 |

Đặc trưng dữ liệu: độ sâu điểm **1,2 – 15,4 m**; độ sâu khống chế tuyến **1,1 – 17,4 m**;
tất cả tới 0,1 m, quy về mực nước "số 0 hải đồ".

### 5.4. Ảnh hưởng kho dữ liệu: không đáng kể

645 KB so với trần **20 MB/file**. Nhưng `public/data/` đang **116 MB** so với trần thư
mục **120 MB** — chỗ trống còn rất mỏng, và nhiều người đang cùng thêm lớp. Đó là việc
của Lead, không phải của lớp này.

---

## 6. Vùng nào vẫn trắng

| Vùng trắng | Mức | Vì sao |
|---|---|---|
| **Toàn bộ miền Bắc** (Quảng Ninh → Quảng Ngãi) | 🔴 **0 điểm, 0 tuyến** | Không phải vì thiếu thông báo — 32% cả kho là Hải Phòng. Vì **khuôn viết khác**: miền Bắc nêu độ sâu theo *"đoạn từ cặp phao số 5, 6 đến cặp phao số 17, 18"*, không in bảng toạ độ. Khuôn đó là dataset của `src/lib/fairway-depth.ts` + `public/data/fairway-depths.v1.json`, **không phải file này** — nên nó không mất, nó nằm chỗ khác |
| **Ngư trường xa bờ** | 🔴 Trắng hoàn toàn | Toàn bộ nguồn này là *luồng hàng hải và vũng quay tàu*. Ngoài luồng, app vẫn chỉ có ETOPO |
| **Cửa lạch / cảng cá** | 🔴 Trắng | Không thuộc luồng hàng hải; cổng đường thuỷ nội địa `viwa.gov.vn` đã chết. **Đây là lỗ đau nhất** — cảng nhà của bà con nằm đúng ở đây |
| **Kho trước 2025 trên vmsa.vn** | 🔴 Không lấy được | 0/32 mẫu 2007–2024 có file đính kèm. Muốn dữ liệu cũ hơn phải **xin bản gốc**, không cào được |
| Thanh Hoá · Nghệ An · Hà Tĩnh · Quảng Trị · Huế · Quảng Nam · Đà Nẵng · Quảng Ngãi · Quy Nhơn | 🟠 0 điểm | Cùng lý do miền Bắc: khuôn "đoạn giữa hai phao" + tỷ lệ scan cao |

---

## 7. Việc còn lại, xếp theo giá trị trên mỗi ngày công

1. 🟢 **Đăng ký nguồn `tbhh` vào `src/lib/provenance.ts`.** Lý lịch mỗi thông báo đang ghi
   `source: "tbhh"`, chưa có trong `SOURCES` — `provenance.ts` không thuộc phạm vi thay
   đổi này. Hệ quả **cố ý và có test canh**: `validateProvenance()` trả đúng một lỗi
   `origin: nguồn lạ "tbhh"`, nên dataset **không** lọt vào `cleanPackage()`. Ai sở hữu
   `provenance.ts` thêm mục là cổng tự mở. Gợi ý: `method: "survey-compilation"`,
   `resolutionM: null`, `attribution: "Tổng công ty Bảo đảm an toàn hàng hải"`.
2. 🟢 **Nối `tuyen[]` vào màn hình.** 96 đường có độ sâu khống chế đang nằm trong file mà
   chưa có gì vẽ. `src/components/**` không thuộc phạm vi đợt này.
3. 🟡 **Cứu 62 file "bảng mã hỏng"** bằng cách đọc `/Differences` và bảng mã chuẩn của
   font. Đây là nhóm duy nhất còn cứu được **bằng mã**, không phải bằng OCR.
4. 🟡 **298 bản lưu trữ không đọc được số hiệu.** Tên file kiểu `TBHH-10.pdf` không mang
   số; chữ trong PDF thì ô số hiệu để trống. Có thể lấy cơ quan ban hành từ **letterhead**
   của chính PDF, nhưng phải cẩn thận: cổng vùng hiện đọc từ số hiệu, đổi nguồn gán vùng
   là đổi cả cổng.
5. 🔴 **Đừng viết OCR.** Công OCR đổ đúng vào nơi hình dạng dữ liệu tệ nhất: chỗ scan
   nhiều nhất (miền Bắc) lại là chỗ viết theo khuôn "đoạn giữa hai phao", gần như không
   có bảng toạ độ để bóc. Đường rẻ hơn nhiều lần là **hỏi xin bình đồ bản nét gốc** ở Xí
   nghiệp Khảo sát Bảo đảm an toàn hàng hải — đó là việc của người, không phải của code.

---

## 8. Câu cảnh báo bắt buộc khi lên màn hình

Dataset mang sẵn trường `nhan`, test canh nội dung:

> *Độ sâu tham khảo — đo tại ngày ghi kèm, luồng bồi lắng liên tục. Không thay hải đồ.
> Đi biển vẫn phải xem hải đồ và máy dò của tàu.*

Màn hình nào hiện độ sâu **phải hiện kèm NGÀY của thông báo**. Hải đồ cũ là hải đồ nguy
hiểm, và luồng thì bồi lắng liên tục. Ghi nguồn "Tổng công ty Bảo đảm an toàn hàng hải"
để bà con biết số liệu đến từ đâu.

---

## 9. Tập file của đợt này

| File | Vai trò |
|---|---|
| `scripts/fetch-soundings.mjs` | Cào hai nguồn + bóc PDF + bốn cổng tự kiểm. Có cache ngoài repo, chạy lại không tải lại |
| `src/lib/soundings.ts` | Kiểu dữ liệu + bộ phân tích toạ độ + bốn cổng + `decodeSoundings` / `decodeSoundingRoutes` (thuần, không fetch) |
| `src/lib/__tests__/soundings.test.ts` | 62 ca — gồm ca đối chứng chép tay từ TBHH 947, 969, 2139 |
| `public/data/soundings.v1.json` | **Cả nước**: 379 điểm · 96 tuyến · 64 thông báo · 645 KB |
| `public/data/soundings-sample.v1.json` | **ĐÃ XOÁ** — mẫu hai luồng, không còn lý do tồn tại |
| `docs/research/thong-bao-hang-hai-2026-08.md` | Tài liệu này |

Bộ phân tích toạ độ chỉ có **một bản**: script nạp thẳng `src/lib/soundings.ts` bằng cách
dịch TypeScript tại chỗ (cùng cách `scripts/bench-render.mjs` nạp `ocean-map.ts`), không
chép tay sang `.mjs` — hai bản lệch nhau là chuyện chỉ chờ ngày xảy ra.

**Ảnh hưởng offline: không.** Script chạy lúc phát triển trên máy người viết mã, không
chạy trong app. (a) Không thêm yêu cầu mạng nào lúc mở app hay chuyển màn. (b) Không đụng
`public/sw.js`, `SHELL`, danh sách cache hay khoá `forfish.*`. (c) Không đè dữ liệu bà con
đã tải — file mới là asset tĩnh mới; file mẫu bị xoá chưa từng được nối vào màn hình nào
nên không có bản đã tải để mất. (d) Chưa có màn nào đọc nó, nên chưa có nhánh mạng để hỏng.

**Nghiệm thu**: `npm test` **2.772/2.772 xanh** (166 file) · `npm run lint` **0 lỗi**
(34 cảnh báo có sẵn từ trước) · `npx tsc --noEmit` **sạch** ·
`node scripts/audit-names.mjs` **SẠCH**.
