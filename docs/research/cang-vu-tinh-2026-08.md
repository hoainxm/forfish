# Trang cảng vụ hàng hải cấp tỉnh — dò và bóc, 2026-08-31

> **Việc**: kho trung ương `vmsa.vn` có hai lỗ — Hải Phòng ~47% là ảnh scan, miền Nam chỉ
> lưu từ 05/2025. Mỗi cảng vụ tỉnh lại có trang riêng với mục Thông báo hàng hải của mình.
> Tài liệu này ghi lại **đo được gì** ở 27 cảng vụ ven biển, và **bóc ra được bao nhiêu**.
>
> Mọi con số dưới đây là **tự đo trong phiên này**, ngày truy cập **2026-08-31**.
> Đường ống: [`scripts/fetch-soundings-cangvu.mjs`](../../scripts/fetch-soundings-cangvu.mjs)
> → [`public/data/soundings-cangvu.v1.json`](../../public/data/soundings-cangvu.v1.json).
> Test: [`src/lib/__tests__/soundings-cangvu.test.ts`](../../src/lib/__tests__/soundings-cangvu.test.ts).
>
> Tiếp nối [nguon-do-sau-mo-rong-2026-08.md](nguon-do-sau-mo-rong-2026-08.md) §3.2, và ở
> ba chỗ nó **sửa lại** con số của tài liệu đó (ghi rõ ở §1).

---

## 1. Kết luận thẳng

**16/27 cảng vụ ven biển còn trang sống, cả 16 đều có mục Thông báo hàng hải riêng.**
Nhưng lượng **số đo sâu theo điểm** bóc được thì rất ít — không phải vì bóc kém, mà vì
**hình dạng của nguồn không phải điểm**.

Ba điều lật lại hoặc làm rõ tài liệu khảo sát trước:

1. **"18/22 tên miền còn sống"** → đo lại bằng HTTP + DNS: **16 trang sống có nội dung**.
   Ba tên miền (`quangnam`, `angiang`, `dongthap`) phân giải được nhưng chứng thư hết hạn
   **và** chỉ trả về trang mặc định Plesk — sống về DNS, chết về nội dung. Còn lại 13 tên
   miền không phân giải. Danh sách đầy đủ ở §2.
2. **`cangvuhaiphong.gov.vn` có `.signed.pdf` CÓ LỚP CHỮ — đúng.** Nhưng nó **không vá
   được lỗ Hải Phòng**: trong 40 thông báo độ sâu lấy về từ trang này, **không một cái
   nào là của Cảng vụ Hải Phòng**. Chúng mang mã CVHHTPHCM, CVHHKG, CVHHBT, CVHHNT,
   CVHHĐN, CVHHCT, CVHHNA, CVHHDN. Trang Hải Phòng đang làm **bảng tin đăng lại của cả
   nước**, không phải kho của chính nó. Đây đúng là bẫy 3 mà đề bài cảnh báo, chỉ khác
   là nó nằm ở tên miền chứ không ở slug.
3. **Có một kiểu hỏng thứ ba, chưa ai ghi**: PDF **có lớp chữ nhưng font không kèm bảng
   `/ToUnicode`**. Bóc ra được hàng nghìn ký tự, đúng bố cục bảng, nhưng mỗi ký tự là một
   mã tuỳ font — `Ubcd4PUe bd44Pce` thực ra là một cặp toạ độ. Không phải "scan", không
   phải "có chữ". Thừa Thiên Huế dính 6/13 tệp. Nếu không nhận ra, đường ống báo "PDF
   không có bảng toạ độ" — **sai lý do**, và người sau đi tìm nhầm chỗ.

Thu về: **178 số đo sâu theo điểm · 9 tuyến/khu nước (72 đỉnh) · 10 thông báo · 4 cảng
vụ · 67 KB**. Trong đó **174/178 điểm trùng** với kho trung ương; phần **chỉ có ở đây** là
**8/10 thông báo** — và chúng gần như toàn là **tuyến**, không phải điểm (§5).

---

## 2. VIỆC 1 — Dò cho đủ: 27 cảng vụ ven biển

Dò bằng HTTP trực tiếp (`https://`, rồi `http://`, rồi bỏ kiểm chứng thư để tách
"chết DNS" khỏi "chứng thư hỏng"). Cột **TBHH** là số mục lấy được ở 6 trang danh mục
đầu; **độ sâu** là số mục có tiêu đề về thông số kỹ thuật/độ sâu, cắt ở 40 mục.

| # | Cảng vụ | Tên miền | Sống | Mục TBHH | TBHH | Độ sâu | PDF chữ | scan | mã hỏng | 0 bảng | bình đồ | **điểm** | **tuyến** |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Quảng Ninh | `cangvuhanghaiquangninh.gov.vn` | ✅ | `?page=news&cat=15` | 90 | 18 | 11 | 7 | 0 | 11 | 0 | 0 | 0 |
| 2 | Hải Phòng | `cangvuhaiphong.gov.vn` | ✅ | `/chuyen-muc/thong-bao-hang-hai/` | 150 | 40 | 31 | 7 | 1 | 22 | 0 | 0 | 4* |
| 3 | Thái Bình | `cangvuhanghaithaibinh.gov.vn` | ✅ | `?page=news&cat=15` | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | Nam Định | `cangvuhanghainamdinh.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 5 | Thanh Hoá | `cangvuhanghaithanhhoa.gov.vn` | ✅ | `?page=news&cat=30` | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 6 | Nghệ An | `cangvuhanghainghean.gov.vn` | ✅ | `?page=news&cat=15` | 86 | 40 | 1 | **39** | 0 | 1 | 0 | 0 | 0 |
| 7 | Hà Tĩnh | `cangvuhanghaihatinh.gov.vn` | ✅ | `?page=news&cat=2084` | 15 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| 8 | Quảng Bình | `cangvuhanghaiquangbinh.gov.vn` | ❌ DNS | — (gộp vào Quảng Trị) | — | — | — | — | — | — | — | — | — |
| 9 | Quảng Trị | `cangvuhanghaiquangtri.gov.vn` | ✅ | `?page=news&cat=15` | 85 | 39 | 6 | **26** | 0 | 6 | 0 | 0 | 0 |
| 10 | Thừa Thiên Huế | `cangvuhanghaithuathienhue.gov.vn` | ✅ | `?page=news&cat=30` → mục con | 27 | 19 | 4 | 3 | **6** | 4 | 0 | 0 | 0 |
| 11 | Đà Nẵng | `cangvuhanghaidanang.gov.vn` | ✅ | `/vi/chuyen-muc/thong-bao-hang-hai` | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 12 | Quảng Nam | `cangvuhanghaiquangnam.gov.vn` | ⚠️ Plesk | — | — | — | — | — | — | — | — | — | — |
| 13 | Quảng Ngãi | `cangvuhanghaiquangngai.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 14 | Quy Nhơn (Bình Định) | `cangvuhanghaiquynhon.gov.vn` | ✅ | `?page=news&cat=15` | 75 | 21 | 3 | 14 | 0 | 3 | 1 | 0 | 0 |
| 15 | Phú Yên | `cangvuhanghaiphuyen.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 16 | Nha Trang (Khánh Hoà) | `cangvuhanghainhatrang.gov.vn` | ✅ | `?page=news&cat=2014` | 53 | 7 | 4 | 3 | 0 | 2 | 0 | **4** | **2** |
| 17 | Ninh Thuận | `cangvuhanghaininhthuan.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 18 | Bình Thuận | `cangvuhanghaibinhthuan.gov.vn` | ✅ | `/chuyen-muc/thong-bao-hang-hai/` | 150 | 40 | **33** | 0 | 1 | 29 | 4 | 0 | 0 |
| 19 | Vũng Tàu | `cangvuhanghaivungtau.gov.vn` | ❌ DNS | — (gộp vào TP.HCM) | — | — | — | — | — | — | — | — | — |
| 20 | TP. Hồ Chí Minh | `cangvuhanghaitphcm.gov.vn` | ✅ | `?page=news&cat=30` | 85 | 40 | 27 | 12 | 0 | 25 | 3 | **174** | 0 |
| 21 | Đồng Nai | `cangvuhanghaidongnai.gov.vn` | ✅ | `?page=news&cat=2046` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1* |
| 22 | Mỹ Tho | `cangvuhanghaimytho.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 23 | Cần Thơ | `cangvuhanghaicantho.gov.vn` | ✅ | `Index.aspx?page=news&tab=tb` | 5 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 24 | An Giang | `cangvuhanghaiangiang.gov.vn` | ⚠️ Plesk | — | — | — | — | — | — | — | — | — | — |
| 25 | Kiên Giang | `cangvuhanghaikiengiang.gov.vn` | ✅ | `?page=news&cat=2049` | 52 | 11 | 10 | 1 | 0 | 4 | **8** | 0 | **6** |
| 26 | Cà Mau | `cangvuhanghaicamau.gov.vn` | ❌ DNS | — | — | — | — | — | — | — | — | — | — |
| 27 | Đồng Tháp | `cangvuhanghaidongthap.gov.vn` | ⚠️ Plesk | — | — | — | — | — | — | — | — | — | — |

\* Cột **tuyến** ghi theo **trang lấy về**; sau khi gán vùng theo số hiệu, 4 tuyến của
trang Hải Phòng và 1 tuyến của Đồng Nai thuộc về cảng vụ khác (xem §4).

Cũng đã thử và **không có**: `cangvuhanghaigialai / khanhhoa / lamdong / daklak .gov.vn`
(tên tỉnh **sau** sáp nhập 2025 — cảng vụ **không** đổi tên theo tỉnh, xem §4), các biến
thể `www.` và `.com.vn`, `cvhhqni.gov.vn`, `qni.gov.vn`.

### 2.1. Trang nào chặn tự động

**Không trang nào chặn.** Không CAPTCHA, không tường lửa ứng dụng, không chặn theo
User-Agent, không giới hạn nhịp. Cản trở là **kỹ thuật**, không phải **chính sách**:

| Cản | Ở đâu | Cách qua |
|---|---|---|
| **Phân trang là POSTBACK ASP.NET** | 13 trang họ ASPX | Không có `?p=2` (đã thử 10 biến thể, tất cả trả về trang 1). Phải POST lại toàn bộ `__VIEWSTATE` + `__EVENTVALIDATION` kèm `<nút>.x/.y` vì nút "Trang sau" là `input type=image`. |
| **Link PDF nấp sau plugin** | Hải Phòng, Bình Thuận (WordPress) | URL hiện ra là của `pdfjs-viewer-shortcode`; tệp thật nằm trong tham số `file=`. |
| **JSON của WP bị nối rác** | Hải Phòng | `wp-json` trả JSON hợp lệ rồi **nối thêm một `<div class="stealth">`** ở đuôi → `JSON.parse` ném. Cắt tới dấu `]` cuối cùng. |
| **`content.rendered` rỗng** | Hải Phòng, Bình Thuận | REST cho tiêu đề + ngày nhưng không cho nội dung; phải mở trang bài để lấy link PDF. |
| **Bốn kiểu bày mục khác nhau** | — | Xem §3. Nhận nhầm kiểu là ra **0 mục** mà tưởng "trang này không có thông báo" — im lặng và sai. |
| **Chứng thư hết hạn** | 3 tên miền | Bỏ kiểm chứng thư thì vào được, nhưng bên trong chỉ là trang mặc định Plesk. |

---

## 3. Bốn kiểu bày mục — và vì sao phải nhận cả bốn

Đợt dò đầu tiên chỉ nhận một kiểu và cho ra **5 trang “0 mục”**. Bốn trong năm trang đó
thật ra **có dữ liệu**, chỉ bày khác:

| Kiểu | Ai dùng | Dấu nhận | Cái khó |
|---|---|---|---|
| `tin` | 11 trang ASPX | `class="titleNews…"` + `class="dateNews"` | phân trang postback |
| `xep` (accordion) | Hà Tĩnh | `id="accordion"` | **không có trang chi tiết, không có ngày** — PDF treo thẳng dưới tiêu đề, ngày phải đọc từ chữ trong PDF |
| `bang` (GridView) | Cần Thơ | `GridView_News` | tệp PDF + ngày nằm thẳng trong hàng |
| `muc-con` | Thừa Thiên Huế | `JqueryDisplayCate` | chuyên mục cha chỉ bày **các mục con** (mỗi bến một mục), phải vào từng cái |
| WordPress | Hải Phòng, Bình Thuận | `/chuyen-muc/…` | `wp-json` + `file=` |
| riêng | Đà Nẵng | — | mã nguồn thứ ba, bắt link theo tiền tố `/vi/thong-bao…` |

---

## 4. VIỆC 3 — Ba cái bẫy, mỗi cái một cổng

### 4.1. 🔴 Tên điểm đọc thành độ sâu — **đã bắt được ca thật**

Thông báo **2139/KCHT** (Bến cảng Vietsovpetro, đăng trên trang Hải Phòng) in đúng dòng
mà đề bài cảnh báo:

```
Tên
điểm    Vĩ độ           Kinh độ        Vĩ độ           Kinh độ
DHN - 0 6  10˚23’22,83”N  107˚05’23,28”E  10˚23’19,16”N  107˚05’29,70”E
```

`DHN - 0 6` là **tên điểm**. Đọc thành **6 m** thì kết quả là một số đo sâu **hoàn toàn
hợp lý**, ở **một toạ độ thật**, trong **dải thật** — không cổng khung biển, cổng dải độ
sâu, hay cổng ngày nào chặn được.

Cổng đúng nằm trong `parseSoundingRow` của `src/lib/soundings.ts`: ô độ sâu phải **CHỈ
CHỨA con số**, không gì khác. Đường ống này **dùng lại đúng hàm đó**, không viết bản thứ
hai. Trong test có ca đối chứng chép nguyên dòng trên, cùng `B14`, `SR3`, `T2 - 1`,
`A 5`, `S1`, `DHN - 11`.

Và đúng con số ấy — **7,3 m** — có thật trong thông báo, nhưng nó nằm ở **văn xuôi**
(*"…nhỏ nhất đạt 7,3 m"*) và là độ sâu **khống chế của cả vùng**, không phải của điểm
`DHN - 0 6`. Xem §4.4.

### 4.2. 🔴 Khoảng trắng nuốt cột

`7,5 10°44'` đọc thành `510` độ. Cổng nằm ở khuôn `D_DEG`/`D_MIN` của thư viện (chữ số
phải **liền nhau**), cộng cổng khung biển VN ở cuối đường ống.

**Đã bắt được thật trong lượt chạy này**, hai lần — ghi rõ trong `boSot`:

```
toạ độ ngoài khung biển VN [3.9355361111111113, 10.232719444444445]
toạ độ ngoài khung biển VN [6.997847222222222, 10.61791388888889]
```

Kinh độ 3,9° và 7,0° là **bờ Tây Phi**. Cổng khung biển bắt được vì hai con số ấy rơi ra
ngoài; nếu bóc nhầm cho ra một số **trong** khung thì chỉ khuôn `D_DEG`/`D_MIN` cứu. Test
có ca đối chứng `7,5 10˚44 ’ 39,04 ” N …` phải ra **đúng 7,5 m và vĩ độ 10,744**.

### 4.3. 🟡 Gán sai tỉnh — **tên miền cũng không đáng tin**

Đề bài nói *"ở trang cảng vụ thì tên miền đáng tin hơn"*. Đo được thì phải nói lại:
tên miền đáng tin về việc **"đây là website của cảng vụ nào"**, nhưng **không** đáng tin
về việc **"thông báo này của cảng vụ nào"**.

Bằng chứng: trong 40 thông báo độ sâu lấy từ `cangvuhaiphong.gov.vn`, mã cơ quan quan sát
được là **CVHHTPHCM · CVHHKG · CVHHBT · CVHHNT · CVHHĐN · CVHHCT · CVHHNA · CVHHDN** —
tám cảng vụ, **không có Hải Phòng**.

Nên vùng lấy từ **`areaFromNotice`** của `src/lib/soundings.ts` — đúng hàm mà đường ống
kho trung ương dùng, để hai file gộp được mà không phải quy đổi. Mã lạ thì trả `null`:
**không lấy tên miền thay thế**, ghi `boSot`. Cổng cuối chạy lại `areaFromNotice` trên
chính đầu ra, nên sai sót lập trình (gán nhầm chỉ số) cũng đỏ.

Hệ quả thứ hai: cùng một thông báo lấy được ở **hai trang** (`969/TBHH-CVHHKG` có ở cả
Kiên Giang lẫn Hải Phòng). Không gộp thì một khúc luồng có hai đường chồng nhau. Đường
ống gộp theo **số hiệu**, và test canh `so` là duy nhất.

**⚠️ Sáp nhập tỉnh 2025 — cảng vụ KHÔNG đổi tên theo tỉnh.** Cảng vụ Kiên Giang vẫn tên
Kiên Giang dù tỉnh nay là An Giang; Quy Nhơn vẫn Quy Nhơn dù tỉnh nay là Gia Lai; Nha
Trang vẫn Nha Trang dù tỉnh nay là Khánh Hoà; Bình Thuận vẫn Bình Thuận dù tỉnh nay là
Lâm Đồng (thông báo 833/TBHH-CVHHBT ghi nơi ký là *"Lâm Đồng"*, cơ quan vẫn là *"Cảng vụ
Hàng hải Bình Thuận"*). Gán theo tên tỉnh mới sẽ đặt Rạch Giá lên An Giang — một tỉnh
không giáp biển ở đó. Tên miền `cangvuhanghaigialai/khanhhoa/lamdong/daklak.gov.vn`
**không tồn tại**, đúng như vậy.

### 4.4. 🔴 Cái bẫy thứ tư, chưa ai ghi — độ sâu khống chế của cả một vùng

Đây là **hình dạng phổ biến nhất** ở trang cảng vụ tỉnh, và nó nguy hiểm y hệt bẫy 1.

Thông báo 833/TBHH-CVHHBT (Bến cảng Nhiệt điện Vĩnh Tân 4):

```
Tên   Hệ VN-2000              Hệ WGS-84
điểm  Vĩ độ      Kinh độ      Vĩ độ      Kinh độ
S1    11˚18'21,68"N …         11˚18'17,97"N 108˚48'10,94"E
S2 … S3 … S4 …
Độ sâu được xác định bằng máy đo sâu hồi âm tần số 200 kHz tính đến mực nước
"số 0 Hải đồ" đạt 14,46 m.
```

Bốn điểm ấy là **bốn góc vùng khảo sát**, và `14,46 m` là độ sâu **nhỏ nhất của cả
vùng**. Gắn con số đó vào bốn góc là **bịa ra bốn phép đo chưa từng có, ở đúng bốn toạ độ
thật** — cùng loại sai lầm với đọc `DHN - 0 6` thành 6 m, chỉ khác là nó trông còn hợp lý
hơn vì con số kia có thật.

Đường ống **không** làm thế. Bảng không có cột độ sâu thì đi vào `tuyen[]` (một **đường**
mang độ sâu khống chế), không vào `diem[]`. Phân biệt bằng `hasDepthColumn` — cổng **cả
bảng**, không phải cổng từng hàng.

---

## 5. VIỆC 2 — Bóc được gì

`public/data/soundings-cangvu.v1.json` — **67 KB**, cùng kiểu `SoundingsFile` với
`src/lib/soundings.ts` (không quy đổi gì khi gộp).

| Cảng vụ | Thông báo | Điểm | Tuyến |
|---|---:|---:|---:|
| Cảng vụ Hàng hải TP. Hồ Chí Minh | 2 | **174** | 0 |
| Cảng vụ Hàng hải Kiên Giang | 5 | 0 | **6** |
| Cảng vụ Hàng hải Nha Trang | 2 | **4** | **2** |
| Cảng vụ Hàng hải Đồng Nai | 1 | 0 | **1** |
| **Tổng** | **10** | **178** | **9** (72 đỉnh) |

Khoảng ngày: **2025-06-13 … 2026-08-11**. Bỏ sót có ghi lý do: **286 mục**.

### 5.1. Trùng với kho trung ương bao nhiêu

Đối chiếu với `public/data/soundings-sample.v1.json` (bản kho trung ương có lúc chạy):

- **174/178 điểm trùng** (làm tròn 4 chữ số ≈ 11 m) — cả hai thông báo TP.HCM
  `1810/TBHH-CVHHTPHCM` và `1493/TBHH-CVHHTPHCM` đều đã có ở kho trung ương.
- **8/10 thông báo CHỈ CÓ Ở ĐÂY**: `969` · `736` · `230` · `1009` · `610/TBHH-CVHHKG`
  (Kiên Giang), `684/TBHH-CVHHĐN` (Đồng Nai), `1235` · `813/TBHH-CVHHNT` (Nha Trang).
- **Điểm chỉ có ở đây: 4** — bãi đá ngầm luồng Ba Ngòi, `813/TBHH-CVHHNT`.
- **Tuyến chỉ có ở đây: cả 9.**

> Nói thẳng: xét riêng **số đo sâu theo điểm**, nguồn này **gần như không thêm gì** cho
> kho trung ương — TP.HCM đã có sẵn ở đó. Giá trị thật nằm ở **vùng** và ở **kiểu dữ
> liệu**, xem §5.2.

### 5.2. Vùng nào chỉ có ở đây

| Vùng | Chỉ có ở đây | Vì sao đáng |
|---|---|---|
| **Luồng Ba Ngòi (Cam Ranh, Khánh Hoà)** | 4 điểm **bãi đá ngầm** 10,7 / 10,8 / 12,8 m + 2 tuyến | Đá ngầm trong luồng — đúng thứ làm thủng đáy tàu. Kho trung ương không có vùng này. |
| **Năm Căn – Bồ Đề, Rạch Giá, An Thới, Hà Tiên (Kiên Giang / vịnh Thái Lan)** | 6 tuyến | Vùng bà con Tây Nam Bộ đi hằng ngày. Kho trung ương có mục cho vùng này nhưng **chỉ từ 05/2025**. |
| **Sông Đồng Nai** | 1 tuyến | — |
| **Bình Thuận (Vĩnh Tân, Phú Quý)** | 33 PDF có chữ, **0 bóc được** | Xem §6 — đây là chỗ mất nhiều nhất, và lý do là một con số trong `soundings.ts`. |

Và một thứ **chỉ có ở trang cảng vụ, không có trên vmsa**: **16 tệp bình đồ khảo sát**
(Kiên Giang 8, Bình Thuận 4, TP.HCM 3, Quy Nhơn 1) — bản vẽ đo sâu gốc, hàng nghìn số mỗi
tờ. Đường ống **cố ý không tải**: ảnh raster ~94 dpi, chữ số cao 7–9 px, dưới xa ngưỡng
OCR (đo ở [nguon-do-sau-mo-rong §5](nguon-do-sau-mo-rong-2026-08.md)). Vẫn ghi vào
`boSot` kèm URL để lần sau còn quay lại.

---

## 6. Hai chỗ mất dữ liệu — và mất ở đâu chính xác

### 6.1. 🔴 `readControllingDepthM` hụt **5 ký tự** — mất trắng Bình Thuận

Khuôn `CONTROLLING_RE` trong `src/lib/soundings.ts` cho phép tối đa **80 ký tự** giữa
`"độ sâu"` và `"đạt"`:

```js
/đ\s*ộ\s*s\s*â\s*u[^.]{0,80}?đ\s*ạ\s*t …/i
```

Câu chuẩn của các cảng vụ miền Nam dài hơn đúng một chút:

```
Độ sâu được xác định bằng máy đo sâu hồi âm tần số 200 kHz tính đến mực nước
"số 0 Hải đồ" đạt 14,46 m.
        └───────────────── 85 ký tự ─────────────────┘
```

**85 > 80** ⇒ không khớp ⇒ bảng góc vùng không có độ sâu ⇒ **bị bỏ**. Đây là toàn bộ lý
do Bình Thuận có **33 PDF có lớp chữ mà bóc ra 0**, và nó cũng cắn Kiên Giang, Huế,
Quảng Trị.

> **Việc cho chủ sở hữu `src/lib/soundings.ts`** (file này không thuộc phạm vi thay đổi
> của đường ống cảng vụ): nới `{0,80}` lên `{0,120}`. **Cố ý không tự sửa, và cũng cố ý
> không viết bản đọc thứ hai ở phía script** — hai bộ đọc khác nhau trên cùng một loại
> văn bản sẽ cho hai kết quả khác nhau ở cùng một thông báo, và đó là thứ tệ hơn cả trùng
> lặp mã.

### 6.2. 🟡 Bộ dựng dòng cắt hàng ở ranh giới `y/3,2`

Trong `1493/TBHH-CVHHTPHCM` có những hàng bóc ra chỉ còn `˚ ˚ ˚ ˚` — chữ số của hàng rơi
vào một dải `y` khác nên bị tách khỏi ký hiệu độ. Ước chừng mất ~10% số hàng của thông
báo đó. Nằm trong bộ bóc PDF chép từ `scripts/fetch-soundings.mjs`; **không sửa lệch một
bản** — nếu chỉnh thì chỉnh cả hai, khi Lead gộp hai đường ống.

---

## 7. Xếp hạng: 16 trang này đáng làm tới đâu

| Hạng | Trang | Thu về | Lý do |
|---|---|---|---|
| **1** | **Kiên Giang** | 6 tuyến + **8 bình đồ** | Kho duy nhất treo bình đồ có link sâu tới đúng mục. Vịnh Thái Lan. |
| **2** | **Bình Thuận** | **0 hôm nay, ~29 sau khi sửa §6.1** | 33 PDF có chữ, 0 scan — chất lượng tệp tốt nhất trong 16 trang. Đây là chỗ đáng bỏ công nhất và công là **một con số**. |
| **3** | **Nha Trang** | 4 điểm đá ngầm + 2 tuyến | Vùng kho trung ương không có. |
| **4** | **Hải Phòng** | 4 tuyến (của cảng vụ khác) | Không vá được lỗ Hải Phòng như kỳ vọng, nhưng là bảng tin cả nước có `.signed.pdf` chữ. |
| **5** | TP.HCM | 174 điểm | Nhiều nhất, nhưng **đã có ở kho trung ương**. |
| ✗ | Nghệ An · Quảng Trị · Quy Nhơn · Hà Tĩnh · Cần Thơ | ~0 | **Ảnh scan là chính** (Nghệ An 39/40, Quảng Trị 26/39). Đúng chỗ mà [nguon-do-sau-mo-rong §5.5](nguon-do-sau-mo-rong-2026-08.md) nói OCR đổ công vào nơi hình dạng dữ liệu tệ nhất. |
| ✗ | Thừa Thiên Huế | 0 | 6/13 tệp **bảng mã hỏng** (font không kèm `/ToUnicode`). Muốn lấy phải dựng lại bảng mã theo hình chữ — công cao hơn OCR. |
| ✗ | Thái Bình · Thanh Hoá · Đà Nẵng · Đồng Nai | 0 | Mục thông báo gần như trống (2–5 mục; Đồng Nai ghi thẳng *"Dữ liệu đang được cập nhật"*). |

---

## Assumptions

- **Cắt ở 6 trang danh mục, 40 mục độ sâu mỗi cảng vụ.** Đây là hạn mức của lượt chạy,
  không phải giới hạn của nguồn (Hải Phòng có 243 mục, Bình Thuận 203). Chạy sâu hơn thì
  đổi `--trang` / `--max`. Mỗi lần sinh lại một bản là một khoản nợ vĩnh viễn trong lịch
  sử git, nên **chạy có chủ ý** — xem CLAUDE.md "Dữ liệu bản đồ trong git".
- **`source: "tbhh"` chưa có trong `SOURCES` của `src/lib/provenance.ts`.** Dùng đúng
  chuỗi mà `scripts/fetch-soundings.mjs` đang dùng để hai kho còn ghép được;
  `validateProvenance` sẽ báo "nguồn lạ" cho tới khi có người đăng ký nguồn — đúng như
  thiết kế, không phải lỗi im lặng.
- **Ngày ban hành** ưu tiên đọc từ **tiêu đề** (`… số 1810/TBHH-CVHHTPHCM ngày
  17/7/2026 …`), rồi tới dòng ký trong PDF, rồi mới tới ngày ĐĂNG của danh mục. Ngày đăng
  muộn hơn ngày ký vài ngày (đo thật: 1810 ký 17/7, đăng 20/7). Bản ký số hay để **trống
  ngày** (`"ngày tháng 6 năm 2025"`); khi đó **không** được lùi về chuỗi `dd/mm/yyyy` bất
  kỳ trong văn bản — đã dính thật: vớ phải *"Nghị định 58/2017/NĐ-CP ngày 10/5/2017"* và
  ghi một khảo sát 2025 thành **đo năm 2017**. Có cổng chặn khoảng ngày và có test.
- **"Bảng mã hỏng"** nhận ra bằng việc chữ bóc ra **không chứa lấy một từ nào** của văn
  bản hàng hải Việt Nam (`hàng hải`, `độ sâu`, `toạ độ`, `TBHH`, `WGS`, `VN-2000`,
  `Cảng vụ`). Đây là phép thử gián tiếp; một PDF ngắn dưới 200 ký tự sẽ không bị xét.
- **Số "16 tệp bình đồ"** đếm theo tên tệp có chứa `bình đồ`/`binh do`/`khao sat`. Bình
  đồ đặt tên khác sẽ bị tính nhầm là văn bản (và sẽ rơi vào "scan", vì nó là raster).
- **Đối chiếu trùng lặp** làm với `soundings-sample.v1.json` — bản kho trung ương **có
  lúc chạy**. Đường ống trung ương đang được viết lại để sinh `soundings.v1.json` cả
  nước; khi bản đó có, phải **đo lại tỷ lệ trùng**, và tỷ lệ nhiều khả năng **cao hơn**.
- **`scripts/fetch-soundings-cangvu.mjs` chép hai khối mã** từ
  `scripts/fetch-soundings.mjs` (bộ bóc chữ PDF, và `nhanBang`/`readNotice`), có ghi
  `// nợ:` kèm điều kiện nâng cấp. Không tự tách ra module dùng chung vì file kia thuộc
  quyền teammate khác — sửa nó là dẫm chân. Bộ phân tích **toạ độ** thì **không chép**:
  nạp thẳng từ `src/lib/soundings.ts`.
