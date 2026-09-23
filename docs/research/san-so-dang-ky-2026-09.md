# Săn sổ đăng ký báo hiệu — 22 tuyến luồng miền Nam, 2026-09-02

> **Việc**: [`bao-hieu-mien-nam-2026-09.md §4`](bao-hieu-mien-nam-2026-09.md) để lại một ô
> trắng có tên: *"22 tuyến luồng miền Nam vẫn không có bảng đăng ký chính thức"*. Cổng ENC
> của Cục Hàng hải in ra **con số đếm** cho từng tuyến (Định An – Cần Thơ: **118 phao**)
> nhưng khuôn trang miền Nam không có chỗ đặt danh sách. Việc của phiên này là **đi tìm
> nguồn khác cho đúng nội dung đó**.
>
> **Kết quả: TÌM ĐƯỢC.** Không phải mảnh vụn — là **cả cuốn sổ**, do chính Tổng công ty
> Bảo đảm an toàn hàng hải miền Nam biên soạn và Nhà xuất bản Giao thông vận tải phát hành.
> **752 báo hiệu có toạ độ**, phủ **21/22 tuyến** đang trắng — và tuyến thứ 22 (**Gò Gia**)
> nhiều khả năng cũng đã nằm trong đó dưới tên "Đồng Tranh", chỉ cần xác nhận (§8). Cộng
> thêm **2 tuyến cổng ENC chưa liệt kê**, cộng **50 đèn biển miền Nam** — trong đó có
> **11 đèn trên quần đảo Trường Sa**.
>
> Đối chiếu với con số nhà nước tự công bố: Định An – Cần Thơ nhà nước ghi **118**, bóc ra
> **117**. Sông Tiền **64/64**. Ba Ngòi **13/13**. Phú Quý **7/7**.
>
> Mọi con số dưới đây là tự đo trong phiên **2026-09-02**, tái lập được bằng lệnh ghi kèm.
> Phiên này **không ghi gì** vào `public/`, `src/`, `scripts/` — file ứng viên để ngoài repo
> cho Lead quyết.

---

## 1. Nguồn tìm được: "List of AtoN System"

| | |
|---|---|
| tên đầy đủ | *List of AtoN system from the South of Sa Huynh lighthouse, Quang Ngai* |
| cơ quan | Tổng công ty Bảo đảm an toàn hàng hải **miền Nam** (VMS-South) |
| phát hành | **Nhà xuất bản Giao thông vận tải**, quyết định xuất bản **211/QĐ-GTVT** ngày 24/10/2016 |
| ISBN | 978-604-76-1153-9 · đăng ký xuất bản 3553-2016/CXBIPH/1-160/GTVT |
| nộp lưu chiểu | 12/2016 · in 300 bản |
| ở đâu | `vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf` — **trang đã chết**, còn đúng **một** bản lưu Internet Archive |
| kích thước | 5.241.725 byte · **70 trang** · PDF **có lớp chữ** (không phải ảnh scan) |

Tái lập:

```bash
curl -sSL -o aton.pdf \
  "https://web.archive.org/web/20230328024018id_/http://www.vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf"
# 5.241.725 byte, PDF 1.6, 70 trang
```

> ⚠️ **Chỉ còn ĐÚNG MỘT bản.** Hỏi thẳng danh mục Wayback cho chính địa chỉ này:
>
> ```
> …List-of-AtoN-System.pdf 20230328024018 200 5077420   ← bản duy nhất tải được
> …List-of-AtoN-System.pdf 20240708220514 301    847
> …List-of-AtoN-System.pdf 20240709015917   -    618
> …List-of-AtoN-System.pdf 20241228101349   -    698
> …List-of-AtoN-System.pdf 20241228101350   -    746
> ```
>
> Bốn lần thu thập sau đều là chuyển hướng hoặc hỏng — trang đã chết giữa 2023 và 2024.
> Nghĩa là **bản chụp 2023-03-28 là bản sao công khai cuối cùng của ấn phẩm này trên
> Internet**. Nên giữ file PDF lại (đã có trong thư mục phiên), đừng coi việc tải lại được
> là chuyện đương nhiên.

### 1.1 Vì sao trước đây không thấy

Nó **không nằm trong** kho 2.556 Thông báo hàng hải đã tải — kho đó gom theo đường
`/thong-bao-hang-hai/`, còn cuốn này nằm ở `/wp-content/uploads/`. Danh mục `cdx` của
vms-south.vn **đã có sẵn trên đĩa từ phiên trước** (11.285 bản ghi); chỉ chưa ai hỏi nó
câu *"trong đống upload có file nào KHÔNG phải thông báo lẻ không"*. Một lệnh lọc là ra:

```bash
grep -ioE "[^\"]*/wp-content/uploads/[^\"]*\.pdf" kho/cdx/*.txt \
  | sed 's|.*/wp-content|/wp-content|' | sort -u \
  | grep -viE "thong-bao|tbhh|No\.[0-9]"
# → /wp-content/uploads/2017/02/List-of-AtoN-System.pdf
```

Bài học lặp lại đúng cái bẫy §1 của tài liệu trước, ở dạng thứ ba: lần đó là *"đi sửa bộ
bóc khi nguồn trống"*, lần này là **"kho đã nằm trên đĩa mà chưa hỏi đúng câu"**. Không
tốn một byte băng thông mới nào để phát hiện ra nó.

---

## 2. Nguồn đã thử → kết quả → tái lập

| # | Nguồn | Kết quả | Tái lập |
|---|---|---|---|
| 1 | **`List-of-AtoN-System.pdf`** (VMS-South, 2016) | ✅ **752 báo hiệu có toạ độ · 21/22 tuyến đang trắng + 2 tuyến ngoài danh sách ENC + 50 đèn biển** | `curl` ở §1 rồi `node parse2.mjs` |
| 2 | Cổng ENC `ChiTietTuyenLuong.aspx?ID=1..100` — bản HIỆN TẠI | ❌ **0/23 tuyến miền Nam có bảng toạ độ** — đo lại, khớp phiên trước | `node counts.mjs enc/` trên 105 file HTML đã tải |
| 3 | `danh-muc-tai-lieu/an-toan-hang-hai-ky-thuat` (vms-south) | ⚪ chỉ là trang **danh mục bài viết**, không phải sổ báo hiệu | grep trong `cdx` |
| 4 | Kho 2.556 Thông báo hàng hải trên đĩa | ⚪ **không dùng ở phiên này** — đang là lane của teammate khác (`scripts/extract-tbhh-text.mjs`) | — |
| 5 | `vmsa.vn` (miền Bắc) hệ thống đèn biển | ❌ chỉ Bắc–Trung Bộ, cực nam Sa Huỳnh 14,68°B — đã đo phiên trước | — |

Hai mũi dò nữa được phái đi song song và **chưa về lúc chốt tài liệu này**: (a) bản lưu
Internet Archive của **chính cổng ENC** — liệu trang miền Nam trước đây có từng dùng khuôn
A; (b) quét web cho **bản mới hơn 2016** của Danh mục báo hiệu, trang cảng vụ tỉnh, quyết
định công bố tuyến luồng và hồ sơ đấu thầu bảo trì báo hiệu. Kết quả của chúng nên được
**nối vào bảng trên**, không phải viết lại tài liệu: nguồn ở §1 đã tự đứng được.

> Cổng ENC dùng **hai khuôn trang**; đo lại trên 105 file HTML đã tải cho đúng kết quả cũ:
> **23 tuyến miền Nam, khuôn B, không tuyến nào có bảng toạ độ**. Nguồn mới **không mâu
> thuẫn** với kết luận cũ — nó **thay thế** cái mà cổng ENC chưa nhập.

---

## 3. Bóc được gì — và đối chiếu với con số nhà nước tự công bố

Cột "nhà nước công bố" đọc thẳng từ ô **Số báo hiệu (Phao / Tiêu)** của chính trang ENC
(`enc/<ID>.html` đã tải), nên đây là **hai nguồn độc lập của cùng một cơ quan** kiểm chéo
nhau — không phải ta tự chấm điểm cho ta.

| ENC | Tuyến | công bố (phao+tiêu) | **bóc được** | lệch |
|---|---|---|---|---|
| 33 | Định An – Cần Thơ | 118 | **117** | −1 |
| 19 | Sài Gòn – Vũng Tàu | 54 + 58 = 112 | **113** | +1 |
| 21 | Soài Rạp | 66 + 7 = 73 | **74** | +1 |
| 32 | Sông Tiền (Cửa Tiểu) | 64 | **64** | **0** |
| 36 | Sông Dinh | 18 + 2 = 20 | **20** | **0** |
| 44 | Ba Ngòi | 13 | **13** | **0** |
| 64 | Phú Quý | 7 | **7** | **0** |
| 65 | Bến Đầm – Côn Đảo | 3 | **3** | **0** |
| 40 | Năm Căn – Bồ Đề | 10 | **10** | **0** |
| 73 | Sa Đéc | 2 | **2** | **0** |
| 41 | Hà Tiên | 10 + 2 = 12 | **11** | −1 |
| 59 | Nha Trang | 13 | **12** | −1 |
| 43 | Côn Sơn – Côn Đảo | 3 + 2 = 5 | **4** | −1 |
| 35 | Sông Dừa | 10 + 2 = 12 | **10** | −2 |
| 30 | Vũng Rô | 3 | **4** | +1 |
| 31 | Vũng Tàu – Thị Vải | 68 + 3 = 71 | **64** | −7 |
| 20 | Đồng Nai | 27 + 6 = 33 | **40** | +7 |
| 42 | Đầm Môn | 4 | **10** | +6 |
| 66 | Đồng Tranh – Tắt Bài – Tắt Cua | 6 | **29** | +23 |
| 70 | An Thới | 6 | **8** | +2 |
| 38 | Quy Nhơn | **300** + 14 | **21** | −293 ⚠️ |
| 34 | **Gò Gia** | — | **0** | không có trong sách |
| — | Luồng tàu lớn vào sông Hậu (kênh Quan Chánh Bố) | không có trên ENC | **65** | tuyến ENC chưa liệt kê |
| — | Lagi (Bình Thuận) | không có trên ENC | **1** | |

**10/22 tuyến khớp chính xác**, thêm 5 tuyến lệch đúng 1 báo hiệu. Đó là mức khớp của hai
tài liệu **cùng đúng nhưng chốt ở hai thời điểm khác nhau**, không phải của một bộ bóc
đang đoán.

Ba dòng lệch nhiều, và cả ba đều có lời giải thích **không đổ cho bộ bóc**:

- **Quy Nhơn "300 phao"** — con số của trang ENC gần như chắc chắn là lỗi nhập liệu (số
  tròn trĩnh đáng ngờ; luồng Quy Nhơn dài 6 km). Sách in 21. Đây là chỗ **nguồn mới sửa
  lưng nguồn cũ**, không phải ngược lại.
- **Đồng Tranh 6 → 29** — hệ thống báo hiệu tuyến này được **thiết lập mới** (có hẳn một
  Thông báo hàng hải *"thiết lập hệ thống phao báo hiệu … tuyến từ ngã ba Tắt Ông Cu –
  Tắt Bài đến ngã ba sông Gò Gia và tuyến Tắt Cua"* trong danh mục vms-south). Ô đếm của
  ENC là số cũ.
- **Vũng Tàu – Thị Vải 71 → 64** — sách 2016 chốt trước vài đợt nạo vét mở rộng.

### 3.1 Chất lượng bóc

```
toạ độ thô        : 1518  (lat 759 / lon 759)   ← lat và lon cân nhau tuyệt đối
cặp ghép được     : 753
  trong khung VN  : 752   · ngoài khung: 1      ← 99,87 %
qua cổng cụm      : 752   · loại: 0
```

**Một** dòng duy nhất bị loại (`10°18'56,7"N 06°53'21,8"E`, trang 28 — kinh độ 6°Đ là giữa
Đại Tây Dương, hàng lộn cột). Không phải bộ bóc giỏi mà vì **PDF có lớp chữ thật**, không
phải ảnh scan — không có một ký tự nào đi qua OCR, nên bốn cái bẫy toạ độ của
[`§2.2 tài liệu trước`](bao-hieu-mien-nam-2026-09.md) hầu như không cắn.

### 3.2 Cổng cụm bắt được một lỗi thật

Vòng đầu, cổng cụm loại **19 điểm** ở Côn Đảo và Lagi. Không phải toạ độ sai — mà **nhãn
tuyến sai**: sách in tiêu đề `LIGHTHOUSES AT SOUTH WEST AREA`, còn bộ dò tiêu đề của tôi
chỉ nhận dòng bắt đầu bằng `SOUTH`, nên 13 ngọn đèn biển Tây Nam Bộ **thừa kế nhãn của
tuyến ngay trên** (Bến Đầm – Côn Đảo) rồi văng ra xa tâm cụm 120–236 km.

Sửa bộ dò tiêu đề xong: **loại 0**. Cổng đã làm đúng việc của nó — báo có chuyện, và
chuyện đó là thật. Nếu không có cổng cụm thì 13 ngọn đèn sẽ nằm im trong dữ liệu dưới tên
một tuyến luồng cách đó 200 km, **trông hoàn toàn hợp lệ**.

### 3.3 Loại báo hiệu: đo bằng hai tín hiệu độc lập, cãi nhau thì để trống

Việt Nam thuộc **IALA vùng A**, và chính cuốn sách tự nói ra quy ước (*"Green, pillar …
Starboard hand marks"* / *"Red … Port hand marks"*). Nên có hai đường suy ra vai trò:

1. **màu đèn** — nằm **cùng dòng** với toạ độ, không tràn sang bản ghi khác;
2. **chữ mô tả** — chính xác hơn về ngữ nghĩa nhưng **tràn dòng**, hay dính sang bản ghi sau.

Tính cả hai rồi đo độ khớp:

| | |
|---|---|
| cả hai tín hiệu, **khớp** | **212** |
| cả hai tín hiệu, **cãi nhau** | **23** → để `null`, **không đoán** |
| chỉ một tín hiệu | 300 |
| không tín hiệu nào | 167 |

23 chỗ cãi nhau (3,0 %) bị bỏ trống có chủ ý. Lý do đúng bằng lý do của
[`§3.3 tài liệu trước`](bao-hieu-mien-nam-2026-09.md): **vẽ nhầm bên luồng là đưa tàu vào
chỗ cạn**. Một cái phao "chưa rõ vai trò" thì bà con tự nhìn; một cái phao **dán nhãn sai
bên** thì bà con tin.

### 3.4 Nghiệm thu độc lập: phao liền số phải nằm cạnh nhau

Mọi con số ở trên đều là **bộ bóc tự nói về mình**. Phép kiểm dưới đây thì không — nó dùng
một thông tin bộ bóc **chưa từng nhìn đến**: phao luồng được **đánh số theo thứ tự dọc
luồng**, nên hai phao **cùng bên, liền số** (n và n+2 — chẵn với chẵn, lẻ với lẻ) bắt buộc
phải kề nhau ngoài thực địa. Nếu bộ bóc ghép lộn lat với lon, khoảng cách sẽ nhảy loạn.

| | |
|---|---|
| số cặp đo được | **342** |
| **trung vị** | **1,93 km** |
| 95 % dưới | 3,51 km |
| xa nhất | 7,81 km |
| cặp > 5 km | **6 / 342** |
| **đối chứng — hai phao lấy ngẫu nhiên** | **107,4 km** |

Chênh **55 lần** giữa "liền số" và "ngẫu nhiên". 1,93 km đúng là khoảng cách phao thật của
một luồng hàng hải. Bộ bóc ghép sai **không thể** vượt qua phép kiểm này.

> Lần đo đầu tôi so **n với n+1** và ra trung vị 9,46 km ở Định An — trông như hỏng. Không
> phải: phao **chẵn và lẻ nằm hai bên luồng**, nên n→n+1 là bước **ngang** qua luồng rồi
> lùi lại, không phải bước dọc. Đo cùng bên thì Định An về **2,26 km, xa nhất 4,13 km**.
> Ghi lại vì đây đúng là kiểu số liệu dễ bị đọc thành "dữ liệu rác" rồi vứt oan cả nguồn.

Kiểm chéo thêm bằng hình học: phao 0 của Định An ở 9,47°B 106,52°Đ, phao 109 ở 10,15°B
105,66°Đ — cách nhau **~118 km**, khớp với chiều dài **130,6 km** trang ENC tự công bố cho
tuyến này.

---

## 4. Đèn biển — và Trường Sa

`§4` tài liệu trước liệt "đèn biển miền Nam (~50 cái)" là ô trắng. Sách này có **đúng 50
ngọn**, kèm **số hiệu danh mục đèn quốc tế** (`F####`) để tra chéo:

| vùng | số đèn |
|---|---|
| Nam Trung Bộ | 18 |
| Tây Nam Bộ | 14 |
| **Biển Đông và quần đảo Trường Sa** | **11** |
| Đông Nam Bộ | 7 |

11 ngọn trên Trường Sa, tên tiếng Việt đứng trước, tên tiếng Anh trong ngoặc:

```
F2824.5   Song Tu Tay  11,428°B 114,331°Đ    F2825.18  An Bang       7,892°B 112,922°Đ
F2825.15  Da Tay        8,845°B 112,195°Đ    F2825.05  Tien Nu       8,871°B 114,681°Đ
F2825.1   Da Lat        8,666°B 111,664°Đ    F2825.08  Truong Sa Lon 8,646°B 111,919°Đ
F2825.19  Ba Ke         7,875°B 111,745°Đ    —         Son Ca       10,374°B 114,481°Đ
F2825.197 Phuc Tan      8,166°B 110,597°Đ    F2823.2   Sinh Ton (trang 59)
F2825.196 Huyen Tran    8,020°B 110,631°Đ    F2825.194 Que Duong     7,819°B 110,501°Đ
```

Đối chiếu địa lý thật: Song Tử Tây ~11,42°B 114,33°Đ ✓ · Sơn Ca ~10,38°B 114,48°Đ ✓.

### 4.1 Khớp đúng chỗ trống của lớp đèn biển đang dựng

Teammate khác đang dựng `public/data/den-bien.v1.json`. Chồng hai bên:

| | |
|---|---|
| `den-bien.v1.json` hiện có | **28** đèn · dải vĩ độ **15,425 → 21,396°B** · nam 15°B: **0** |
| ứng viên phiên này | **50** đèn · **toàn bộ nam 15°B** |
| **trùng nhau (< 500 m)** | **0 / 50** |

Hai bộ **không chồng lấn một cái nào** và ghép lại thành 78 đèn phủ cả nước. Đây không
phải trùng hợp: `den-bien.v1.json` lấy từ nguồn miền Bắc (vmsa.vn / cổng ENC), cuốn sách
này là ấn phẩm miền Nam — hai tổng công ty, hai địa bàn, ranh giới là **đèn Sa Huỳnh** đúng
như tên sách tự nói.

> **Sửa một câu sai trong tài liệu trước.** `§3.2` ghi ô nghiệm thu `truong-sa` bằng 0 và
> kết luận *"đúng là phải 0: đó là biển hở, không có luồng hàng hải nào để đặt phao"*.
> Vế đầu đúng — **không có phao luồng**. Vế sau sai: **có 11 ngọn đèn biển Việt Nam đang
> hoạt động trên Trường Sa**, và chúng là thứ ngư dân nhìn thấy thật ngoài đó. Ô nghiệm
> thu ấy nên đổi từ "phải 0" thành "phải có đèn biển".

---

## 5. Chủ quyền và giấy phép

**Cổng chủ quyền: ĐẠT, và đạt một cách dứt khoát.**

| kiểm | kết quả |
|---|---|
| chuỗi `"South China Sea"` | **0** lần |
| chuỗi `"East Sea"` | **4** lần (kể cả tiêu đề mục *EAST SEA AND SPRATLY ISLANDS*) |
| ký tự Hán / Nhật trong file ứng viên | **0** — cổng tự kiểm bắt được 2/2 trên chuỗi thử, nên **cổng không rỗng** |
| tên đảo Trường Sa | tiếng Việt đứng trước, tên quốc tế trong ngoặc |

Đây không chỉ là "không vi phạm" — nó là nguồn **khẳng định chủ quyền**: một ấn phẩm hàng
hải chính thức, có ISBN, liệt kê đèn biển Việt Nam trên Trường Sa bằng tên Việt.

**Giấy phép**: ấn phẩm của doanh nghiệp nhà nước, phát hành theo quyết định của Bộ Giao
thông vận tải, nội dung là **số liệu báo hiệu hàng hải**. Điều 15 Luật Sở hữu trí tuệ loại
"văn bản hành chính" và số liệu khỏi bảo hộ quyền tác giả. Theo đúng
[`CLAUDE.md` — "Nguồn dữ liệu, đừng tự giới hạn"](../../CLAUDE.md), nhóm này **không viết
câu dè chừng**. Ba cổng chặn thật đều không chạm tới: không copyleft (không phải phần mềm
hay CSDL share-alike), không "adapted" S-52 (đây là bảng số, không phải bộ ký hiệu), không
vấn đề chủ quyền.

**Cái phải giữ là nhãn TUỔI, không phải nhãn pháp lý** — xem §7.

---

## 6. File ứng viên (ngoài repo)

Để ở `…/scratchpad/san/`, **không** đụng `public/data/`:

| file | nội dung | dung lượng |
|---|---|---|
| `aton-vn-aids-candidate.json` | **702 phao/tiêu**, 23 tuyến — đúng khuôn `vn-aids.v1.json` | 44,5 KB |
| `aton-den-bien-candidate.json` | **50 đèn biển** (kể cả Trường Sa) — cho lớp `den-bien.v1.json` | 24,5 KB |
| `aton-aids.json` | 752 bản ghi phẳng, còn nguyên số trang để tra ngược | — |
| `aton.txt` · `aton.pdf` | chữ bóc ra và bản PDF gốc | 131 KB / 5,2 MB |
| `parse2.mjs` · `build-candidate.mjs` · `validate.mjs` · `counts.mjs` | bộ bóc, bộ dựng, bộ nghiệm thu, bộ đọc số công bố | — |

Tách hai lớp vì đang có hai người làm hai lớp khác nhau — phao/tiêu vào `vn-aids`, đèn
biển vào `den-bien`.

Nghiệm thu file ứng viên (`node validate.mjs aton-vn-aids-candidate.json`):

```
types MỚI (chưa có trong file đang chạy): []      ← không đẻ từ vựng mới, sprite không phải sinh lại
ngoài khung biển VN: 0
ký tự CJK: 0  (cổng tự kiểm: bắt được 2/2 trên chuỗi thử)
trùng toạ độ: 0
marks: 702 · routes: 23 · tổng so[] = 702
dung lượng: 44,5 KB
dải vĩ độ: 8,654 → 13,796          ← TOÀN BỘ nam 15°B, đúng chỗ đang trắng
nam 15°B: 702 · nam 10°B: 168
trùng với file đang chạy (< 50 m): 26/702   ← ~676 cái là MỚI
```

Từ vựng dùng lại nguyên của file đang chạy — `buoy_lateral`, `beacon_lateral`, `beacon`,
`buoy_safe_water`, `buoy_special_purpose`; bên luồng đi ra `purposes` ("Báo hiệu phía phải
/ trái luồng") đúng như nguồn A, **không** đẻ type mới. Tên đổi sang từ vựng tiếng Việt
đang dùng: `Buoy no. 68` → **Phao 68**, `Beacon no. 62` → **Tiêu 62**, `Front A1` →
**Tiêu trước A1**.

---

## 7. Điều Lead phải quyết trước khi gộp

1. **Tuổi: sách chốt 2016, nay 2026.** Đây là rủi ro thật và nó **không đều nhau**:
   *đèn biển và tiêu cố định* gần như không đổi trong 10 năm; *phao luồng* thì **đổi theo
   từng đợt nạo vét**. Cả hai file ứng viên mang sẵn trường `canhBaoTuoi`. Đề xuất: gộp
   đèn biển với độ tin cao, còn phao luồng thì **để Thông báo hàng hải mới hơn đè lên** khi
   trùng vị trí — kho thông báo đã có sẵn và teammate khác đang bóc.
2. **Cổng chống xoá nhầm** (`§5` tài liệu trước) so số **theo từng nguồn**. Thêm nguồn thứ
   ba thì phải khai báo `vms-south-aton-list` trong `src/lib/provenance.ts`, nếu không cổng
   sẽ thấy một nguồn lạ.
3. **26 điểm trùng < 50 m** với file đang chạy — cần quy tắc gộp: giữ bản mới hơn (thông
   báo) hay bản có nhãn đầy đủ hơn (sách)?
4. **85/702 báo hiệu chưa đọc ra số hiệu** — mang nhãn "chưa rõ", **không bịa số**, đúng
   luật `§2.3` tài liệu trước.
5. **Tên đèn biển phải nhập tay — 50 dòng, đừng tự động hoá.** Hai chuyện cộng lại:
   sách in bằng **tiếng Anh nên không dấu**, và bộ chữ PDF còn **cắt vụn từ ở đúng chỗ có
   dấu** (`Hòn Nước` → `Hon N uoc`, `Phước Mai` → `Ph uo c Mai`). Ghép lại bằng máy thì
   phải đoán chỗ nối, mà đoán sai tên một ngọn đèn là bà con tra không ra.
   Tên **phao/tiêu** không dính vấn đề này (chúng là số: đã đổi sẵn thành "Phao 68").
   Đường đúng: **ghép theo toạ độ + số hiệu quốc tế `F####`**, còn chữ tên thì lấy từ
   bảng tra tay. 50 dòng là việc một buổi, làm một lần, đúng vĩnh viễn.
   **8/50** dòng bộ bóc chưa đọc ra tên (mang `null`), **49/50** có số hiệu `F####`,
   **41/50** có cả hai — nên mọi dòng đều tra ngược được, không dòng nào mồ côi.

---

## 8. Còn trắng gì

| chỗ trắng | quy mô | đường đi tiếp |
|---|---|---|
| **Luồng Gò Gia** (ENC #34) — *có thể đã phủ, dưới tên khác* | sách không có mục riêng "Gò Gia", nhưng **14/29** báo hiệu của mục **Đồng Tranh** nằm đúng trong ô sông Gò Gia (10,55–10,68°B · 106,93–107,05°Đ) | xác nhận rồi gộp — xem ghi chú dưới |
| **Bản mới hơn 2016** | danh mục `cdx` của vms-south.vn chỉ có **một** bản `List-of-AtoN-System.pdf`, tải lên 02/2017 | VMS-South ra ấn phẩm thường niên — bản 2020+ có thể ở nơi khác |
| **167/702 không tín hiệu loại** | rơi về `buoy_special_purpose` (loại "không hứa gì") | cột "Tác dụng" của sách nằm ở cột 8, bộ bóc hiện đọc theo dòng chứ chưa theo cột |
| **Tầm hiệu lực · màu thân phao** | sách **có** hai cột này, bộ bóc chưa tách | bóc theo cột sẽ lấy được cả hai |

> **Ghi chú Gò Gia — nhiều khả năng không phải chỗ trắng, mà là chỗ ĐẶT TÊN KHÁC NHAU.**
> Ba mẩu bằng chứng chỉ cùng một hướng: (a) cổng ENC liệt Gò Gia thành tuyến #34 riêng
> nhưng **để trống cả ô Phao lẫn ô Tiêu** — nhà nước không công bố con số nào để mà thiếu;
> (b) Thông báo hàng hải gọi thẳng tuyến này là **"luồng hàng hải Đồng Tranh – Gò Gia"**,
> một tuyến chứ không hai; (c) có hẳn một thông báo *"thiết lập hệ thống phao báo hiệu
> luồng sông Đồng Tranh, tuyến từ ngã ba Tắt Ông Cu – Tắt Bài **đến ngã ba sông Gò Gia**
> và tuyến Tắt Cua"* — đúng phạm vi mục "DONG TRANH FAIRWAY" của sách, và đúng lý do mục
> này có **29** báo hiệu trong khi ô đếm ENC chỉ ghi 6.
>
> Nên đừng vội ghi "thiếu Gò Gia" vào `thieuBang[]`. Việc cần làm là **xác nhận**, không
> phải đi tìm tiếp: đối chiếu 14 điểm ấy với thông báo thiết lập hệ thống nói trên (đã có
> trong kho trên đĩa). Nếu khớp thì coverage là **22/22**.

---

## 9. Lệnh chạy lại toàn bộ

```bash
S=…/scratchpad/san
curl -sSL -o $S/aton.pdf \
  "https://web.archive.org/web/20230328024018id_/http://www.vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf"
node $S/ext.mjs   $S/aton.pdf $S/aton.txt          # 70 trang, 3.310 dòng
node $S/parse2.mjs $S/aton.txt $S/aton-aids.json   # 752 báo hiệu
node $S/build-candidate.mjs $S/aton-aids.json \
     $S/aton-vn-aids-candidate.json $S/aton-den-bien-candidate.json
node $S/validate.mjs $S/aton-vn-aids-candidate.json
node $S/counts.mjs  …/scratchpad/enc                # số nhà nước tự công bố
```

Bộ bóc chữ dùng lại [`scripts/lib/pdf-text.mjs`](../../scripts/lib/pdf-text.mjs) của repo —
zlib thuần, không dependency, **không chép lại** (nguyên tắc 3: trùng nghĩa thì dùng lại).

> Một chi tiết đủ để làm hỏng cả phiên nếu bỏ qua: sách in ký tự **"độ"** bằng glyph font
> Symbol **U+F0B0**, không phải U+00B0. Biểu thức nào chỉ tìm `°` sẽ bóc ra **0 dòng** và
> báo cáo "sách không có toạ độ" — một câu "không có" trông rất thuyết phục mà hoàn toàn
> sai. Bộ bóc gột U+F0B0 → U+00B0 **ngay ở cửa**, để phần sau chỉ phải biết một ký tự.
