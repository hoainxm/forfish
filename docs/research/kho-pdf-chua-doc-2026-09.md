# Đọc nốt kho PDF Thông báo hàng hải — phần CÓ lớp chữ, 2026-09-02

> **Việc**: kho Thông báo hàng hải đã nằm sẵn trên đĩa (ngoài repo) — **2.556 PDF**,
> mới đọc **917**. **1.639 file chưa đọc** vì chúng có **lớp chữ**, mà
> [`scripts/ocr-soundings.mjs`](../../scripts/ocr-soundings.mjs) cố ý chỉ lo **ảnh scan**.
> Không ai đọc chúng bằng đường lớp-chữ cả.
>
> Đây là đường **rẻ nhất còn lại** để lấp báo hiệu miền Nam: **không một request mạng
> mới**, băng thông đã trả rồi.
>
> Mọi con số dưới đây **tự đo trong phiên này**, ngày chạy **2026-09-02**.
> Đường ống mới: [`scripts/extract-tbhh-text.mjs`](../../scripts/extract-tbhh-text.mjs)
> → kho chữ ngoài repo → [`scripts/generate-vn-aids.mjs`](../../scripts/generate-vn-aids.mjs).
> Bộ bóc chữ PDF: [`scripts/lib/pdf-text.mjs`](../../scripts/lib/pdf-text.mjs) (vừa tách ra).
>
> Tiếp nối [ocr-mien-bac-2026-09.md](ocr-mien-bac-2026-09.md) và
> [bao-hieu-mien-nam-2026-09.md](bao-hieu-mien-nam-2026-09.md).

---

## 1. Việc đầu tiên: gỡ bộ bóc chữ ra khỏi chỗ nó bị khoá

Bộ bóc chữ PDF (parser zlib thuần, không dependency) nằm **trong**
`scripts/fetch-soundings.mjs` và **không có export**. Ai cần cũng phải chép.

Đã **tách hàm, không chép**: cả khối sang
[`scripts/lib/pdf-text.mjs`](../../scripts/lib/pdf-text.mjs), `fetch-soundings.mjs`
nay `import { pdfPages }` từ đó. Hành vi **không đổi một dòng** — kiểm bằng cách chạy
lại `fetch-soundings.mjs --chi-kho` trên 25 bản lưu trữ: vẫn bóc chữ, vẫn đọc kho OCR,
vẫn ra 3 tuyến, vẫn đếm đúng các nhóm `boSot`.

Chép là tạo **bản sự thật thứ hai**, và nó sẽ lệch đúng vào hôm ai đó sửa một bên.

## 2. Đọc được bao nhiêu

`node scripts/extract-tbhh-text.mjs`, đọc cả hai kho `pdf/` (vmsa) và `wb/` (lưu trữ):

| | |
|---|---|
| file trong kho | **2.556** |
| đã có bản chữ OCR (bỏ qua) | 917 |
| không tra ra địa chỉ gốc | 0 |
| PDF không mở được | **0** |
| **ảnh scan** — đường OCR lo, không phải lỗi | **281** |
| **bóc được chữ** | **1.358** → **271.183 dòng** |

Tức trong 1.639 file chưa đọc thì **1.358 thật sự có lớp chữ** và giờ đã đọc; **281 là
ảnh scan còn sót** — chúng nằm ngoài mẻ `--mien bac` mà `ocr-soundings.mjs` đã chạy, nên
vẫn phải OCR (đó là việc của script kia, không phải của script này).

**Khoá kho phải trùng kho OCR.** Kho chữ khoá theo `sha1(<địa chỉ CÔNG BỐ>)`, không
phải địa chỉ tải về: bản lưu trữ có tên file là `sha1(<địa chỉ Wayback>)` **mang dấu
thời gian**, nên phải dựng lại bảng ngược từ danh mục CDX đã tải. Đặt sai khoá thì
`lyLichThongBao()` không tra ra **năm** của thông báo, và tin không có năm bị cổng tuổi
(10 năm; 3 năm cho phao chuyên dùng) coi là 99 tuổi rồi vứt sạch — **hỏng im lặng**.

## 3. Kho này chủ yếu KHÔNG phải tin báo hiệu

Đọc 2.275 bản chữ (917 OCR + 1.358 lớp chữ):

| nhóm | số tin | |
|---|---:|---|
| **không nói về báo hiệu** | **1.875** | kho gốc gom cho lớp **số đo sâu** — phần lớn là tin công bố độ sâu luồng, thông số cầu cảng, khu neo |
| về báo hiệu, **không rõ việc** | 35 | OCR nát đúng dòng "Về việc" |
| về báo hiệu, **không đọc ra dòng toạ độ nào** | 120 | |
| **còn hiệu lực → vào bản đồ** | **163** | |

Con số 1.875 **không phải bộ dò hỏng**. Kiểm chéo: trong 1.358 file lớp chữ chỉ **179**
có chữ "báo hiệu" ở bất kỳ đâu, và chỉ **70** có mục `Tên báo hiệu:`. Kho vốn được gom
để lấy **độ sâu**, nên tỉ lệ này là bản chất của kho.

Cổng "chữ *báo hiệu* phải nằm trong **khối chủ đề**" (không phải toàn văn) **giữ
nguyên, cố ý**. 87 tin có chữ đó ở thân bài mà không ở khối chủ đề — soi tay thì đa số
là **tin độ sâu** chỉ nhắc "luồng được hướng dẫn bởi hệ thống báo hiệu hàng hải". Nới
cổng ra toàn văn là thả **bảng toạ độ điểm đo sâu** vào lớp báo hiệu — dựng hàng trăm
cái phao không có thật.

## 4. Bẫy đã cắn: chữ số bị **chẻ**, và nó chẻ khác OCR

Hai đường vào vỡ theo hai kiểu khác nhau:

- **OCR** đọc nhầm **ký tự** (`°` thành `0`/`9`).
- **Lớp chữ** thì ký tự luôn **đúng** — PDF ghi đúng chữ `°` — nhưng nó chẻ một con số
  thành nhiều mẩu vẽ rời, và bước dựng dòng nối các mẩu ấy bằng **khoảng trắng**:

```
thật:  20°03'29,4"  107°12'19,1"
ra:    20° 03 ' 29.4 "  107°1 2 ' 19. 1 "      ← phút "1 2", giây "19. 1"
ra:    “PH1”  10° 3 6 ’ 59 . 0 ”  10 7 ° 00 ’  ← cả ĐỘ cũng bị chẻ
```

Đo: **123.779** dòng có dấu độ + dấu phút, bộ đọc cũ đọc được 121.396, **vỡ 2.383**.
Khoanh vào **301 tin có mục `Tên báo hiệu:`** thì còn **79 hàng ở 50 tin** — đó là phần
thật sự mất báo hiệu.

**Ghép lại tới đâu thì nói rõ tới đó**, vì ba nhóm chữ số không cùng độ an toàn:

- **PHÚT và GIÂY** kẹp giữa hai dấu (`°…'` và `'…"`). Không gì khác lọt vào giữa được
  → gộp khoảng trắng ở đó là phép ghép **chắc chắn**.
- **ĐỘ** hở **bên trái** — sát nó là cột **TÊN**. `"Phao số 1" + "1 7°42'"` ghép mù
  thành 117°. Đây **đúng** cái bẫy đã cắn dự án: `10 5 ° 18'` đọc thành 5,3°.

Nên với ĐỘ thì **liệt kê mọi cách đọc** (cắt tại từng khoảng trắng: `1 1 7` → 117 · 17 ·
7), bắt cặp vĩ–kinh, và **chỉ nhận khi có đúng MỘT cặp** rơi vào khung biển VN. Không
cặp nào, hoặc từ hai cặp trở lên ⇒ **bỏ cả hàng**. Đây đúng luật `ocrCoordLine` trong
`src/lib/soundings.ts` đang dùng cho số đo sâu — **một cách xử mập mờ cho cả repo**.
Kết quả: **7 hàng** rơi vào "hai cách đọc trở lên" và bị bỏ, có đếm, có in ra.

### 4b. Một lỗi im lặng do chính bản vá này đẻ ra — và cách bắt được

Regex nới lỏng khớp **sớm hơn** trong dòng, nên `m.index` trỏ vào **cột tên**:
`"Phao 5 20°03'…"` khớp từ chữ `5`, và `tenBaoHieu` chỉ còn `"Phao"` — **mất số hiệu của
một cái phao đọc ĐÚNG toạ độ**. Không cổng nào đỏ; bắt được vì **đếm số tên đọc ra**
tụt từ 143 xuống **110**. Sửa: trả về vị trí nơi **con số được chọn** bắt đầu, không
phải nơi regex khớp. Sau khi sửa: **147 tên**, và tổng báo hiệu 341 → **372**.

> Bài học đóng gói: **mọi cổng phải in ra con số của nó**. Cái cổng chỉ `continue` im
> lặng là cổng không ai kiểm được — xem §5.

## 5. Hai chỗ tụt im lặng, nay đã có số đếm

`docThongBao()` có hai câu `continue` **không đếm gì**:

- tin không nói về báo hiệu → **1.875**
- tin về báo hiệu mà không đọc ra dòng toạ độ nào → **120**

Trước phiên này không con số nào in ra, nên báo cáo **không bao giờ** nói được "kho có
bao nhiêu tin là về báo hiệu". Một bộ dò hỏng (regex trượt dấu) sẽ trông **y hệt** một
kho không có tin báo hiệu nào. Nay cả hai đều đếm và in.

## 6. Lỗi im lặng còn lại — đã đo, chưa vá, và vì sao chưa

Chéo bảng "việc của tin" × "có bảng toạ độ không", trên 400 tin về báo hiệu:

| | có toạ độ | KHÔNG có toạ độ |
|---|---:|---:|
| LẬP | 125 | 71 |
| NGƯNG | 70 | 19 |
| **GỠ** | 29 | **11** |
| NÊU | 18 | 3 |
| ĐỔI | 16 | 3 |
| không rõ việc | 12 | 23 |

Nhóm **"GỠ · không toạ độ" (11 tin)** là hướng **nguy hiểm**: tin "chấm dứt hoạt động
phao X" chỉ gọi tên phao + luồng, dẫn chiếu về tin thiết lập cũ. `docThongBao()` thoát
sớm ở `if (!aids.length) continue`, nên tin GỠ ấy **không bao giờ tới được** nhánh lọc
`viec === "GỠ"` — tức có thể **vẽ một cái phao đã thu hồi**.

**Đo trước khi vá**: khớp tên-đã-chuẩn-hoá + tên luồng của cả 11 tin với 774 báo hiệu
đang vẽ → **0 tin khớp**. Những phao ấy vốn không có trong dữ liệu (tin thiết lập của
chúng chưa bóc được, hoặc đã quá tuổi). Nên **ảnh hưởng hiện tại bằng 0**, và viết một
nhánh ghép-theo-tên không khớp cái gì là thêm một đường mã **không ai kiểm được**.

Ghi lại làm **nợ có trần**: hễ số tin "GỠ · không toạ độ" khớp được > 0 thì phải vá —
khoá ghép sẵn có là `n:<tên>|<luồng>` trong `soTay`.

Nhóm **35 tin "không rõ việc"**: soi tay thì gần hết là **bản OCR nát đúng dòng "Về
việc"** (`"CAnG VU HÀNG HaI THANH HÓA CỎNG XĐNĐẾN Sô: Nzay àẽ7 2618RS"`). Đoán động từ
ở đây là đoán **giữa GỠ và LẬP** — hai lỗi ngược chiều nhau, một bên xoá phao đang nổi,
một bên vẽ phao đã tháo. **Không đoán.**

### 6b. Lỗ hổng THẬT vừa bắt được: cổng cụm **vô hiệu với tin chỉ có MỘT báo hiệu**

Đo khoảng cách từ mỗi báo hiệu tới đỉnh bờ biển gần nhất (`public/data/vn-coast.v1.json`):

| nguồn | số báo hiệu | xa bờ nhất | trung vị |
|---|---:|---:|---:|
| ENC (`vinamarine`) — sổ đăng ký chính thức | 437 | **8,5 km** | 1,4 km |
| Thông báo hàng hải (`tbhh`) | 337 | **213 km** | 2,6 km |

**7 báo hiệu** mang tên tuyến là một **luồng vào cảng** mà lại nằm **55–95 km ngoài
khơi** — điều đó bất khả: "luồng hàng hải" theo định nghĩa là lối vào một cảng.

```
91 km · "Luồng hàng hải Đồng Nai"          · 930/TBHH-CVHHĐN
95 km · "Luồng hàng hải Vũng Tàu Thị Vải"  · 312/TBHH-CVHHĐN
73 km · "Luồng hàng hải Sài Gòn 2 Vũng Tàu"· 263/TBHH-TCTBĐATHHMN
72 km · "Luồng hàng hải Vũng Tàu Thị Vải"  · 133/TBHH-TCTBĐATHHMN
66 km · "Luồng hàng Vũng"                  · 1832/TBHH-CVHHTPHCM
56 km · "Luồng hàng hải Soài"              · 732/TBHH-CVHHTPHCM
55 km · "Luồng hàng hải Hải Thịnh"         · 332/TBHH-CVHHTB
```

**Cơ chế**, truy tận dòng chữ gốc:

```
thật:  … 10°36'59,0"N   107°00'17,2"E
OCR:   … 10°37'2,7"N  109°36'59"E  107900'17,2"
                      └─ RÁC ─┘    └ kinh độ THẬT, ° đọc thành 9 ┘
```

OCR đọc `°` thành `9` ở **kinh độ thật** (`107900'…`) nên bộ đọc **loại đúng** nó —
luật "bắt buộc có dấu độ THẬT" chạy chuẩn. Nhưng cùng dòng lại có một mẩu **rác mang
dấu độ thật** (`109°36'59"E`) sinh ra từ việc OCR dán chữ số vào cột vĩ độ hệ kia. Bộ
đọc nhặt đúng cái rác ấy làm kinh độ ⇒ **lệch 290 km về phía đông**. Chuỗi `109°36'59"E`
xuất hiện **y hệt** ở hai thông báo khác nhau — dấu vân tay của lỗi hệ thống, không phải
trùng hợp.

**Vì sao lọt hết mọi cổng đang có**: cổng mạnh nhất là "mọi báo hiệu của một thông báo
phải nằm trong 60 km quanh **trung vị cụm** của chính tin đó". Với tin chỉ có **một**
báo hiệu thì trung vị cụm **chính là điểm đó** — khoảng cách bằng 0, cổng **luôn đạt**.
Đo: **106/337** báo hiệu `tbhh` đến từ tin một-điểm, và **9/12** điểm xa bờ > 30 km nằm
trong nhóm đó. Cổng không sai; nó chỉ **không có gì để so** khi cụm chỉ có một phần tử.

**Đây là lỗi CÓ TRƯỚC phiên này, không phải do bản vá §4 đẻ ra** — cả 7 tin đều tra ra
nằm ở **kho OCR**, không phải kho lớp-chữ mới. Chạy lại với `--kho-chu <thư mục rỗng>`
(tức chỉ kho OCR) thì chúng vẫn còn nguyên.

**Chưa vá, cố ý.** Cổng chặn được nó là "báo hiệu trên một tuyến mang chữ *luồng* không
được cách bờ quá N km" — chỗ dựa vững: sổ đăng ký ENC 437 cái, xa bờ nhất **8,5 km**.
Nhưng đặt N sai là **xoá thật** những báo hiệu ngoài khơi hợp lệ (phao rót dầu một điểm
neo, khu vực Trường Sa — điểm 213 km ở `[111,55; 7,53]` rất có thể là một trong số đó,
và nó **không** mang chữ "luồng" nên sẽ sống sót). Thêm một cổng địa lý mới vào cuối
phiên mà không đủ chỗ kiểm chứng là đổi một lỗi **vẽ thừa** lấy một lỗi **xoá nhầm** —
lỗi thứ hai tệ hơn, vì nó im lặng. Ghi lại thành **nợ có trần**: vá khi có người đo được
ngưỡng N trên toàn bộ báo hiệu ngoài khơi hợp lệ của cả nước.

## 7. Thu được gì — đếm được

`public/data/vn-aids.v1.json`, **ĐÈ** đúng một file (CLAUDE.md "chống phình"):

| | trước | sau |
|---|---:|---:|
| tổng báo hiệu | 738 | **774** |
| — từ cổng ENC (`vinamarine`) | 437 | 437 |
| — từ Thông báo hàng hải (`tbhh`) | **301** | **337** |
| **nam 15°B** | **147** | **161** |
| bắc 15°B | 591 | 613 |
| tên báo hiệu đọc ra được | *(không đo được — xem dưới)* | **301** |
| dung lượng | *(nt)* | **90 KB** (script tự đo; trần 200 KB) |

> Hai ô "trước" để trống **có lý do**, không phải lười: `public/data/vn-aids.v1.json`
> chưa được commit lần nào (`git status` báo `??`), nên **không có bản cũ trong lịch sử
> để đo lại**, và phiên này đã ĐÈ lên nó. Bốn con số "trước" còn lại là **số bàn giao
> kèm việc**, không phải số tự đo. Điền bừa hai ô này thì bảng trông đẹp hơn mà mất
> đúng cái làm nó đáng tin.

Bảng `npm run kiem:ban-do`, cột "báo hiệu Cục HH":

| chỗ | trước | sau |
|---|---:|---:|
| vung-tau | 7 | **7** |
| ca-mau | 1 | **2** |
| long-tau | 4 | **5** |
| nghe-an | 19 | **19** |
| màn mở đầu (cả nước) | 738 | **774** |
| truong-sa | 0 | **0** (biển hở — đúng) |

**Tỉ lệ tin được, và cổng nào chứng minh.** 163 tin vào bản đồ; số bị **cổng** loại:
50 tin mới nhất là GỠ · 20 quá tuổi · 42 trùng chỗ với nguồn ENC (nguồn A thắng) ·
26 trùng chỗ lẫn nhau · **12 điểm xa tâm cụm** · 0 dòng hai hệ toạ độ lệch nhau ·
7 hàng chữ số chẻ mập mờ. Cổng **60 km quanh trung vị cụm của chính thông báo đó** —
do teammate trước tự nghĩ ra — vẫn là cổng bắt được nhiều điểm "trông hợp lệ mà sai
chỗ" nhất; **giữ nguyên**.

**Rơi về "chưa rõ": 183/774 báo hiệu** (23,6%) mang tên `"Báo hiệu (chưa rõ số hiệu)"` —
OCR/lớp chữ nuốt mất cột tên. Giữ **vị trí**, không bịa số hiệu: bịa một số hiệu trông
như thật là kiểu sai tệ nhất, vì bà con tra lại sẽ không thấy. Và **287 phao** không đọc
ra vai trò từ câu "Tác dụng" nên xếp `buoy_special_purpose` — loại **không hứa gì** về
mép luồng.

## 8. Kết luận thẳng

Đọc thêm 1.358 file được **+36 báo hiệu** (**+14 ở nam 15°B**) — ít hơn nhiều so với kỳ
vọng ban đầu, và **lý do đo được, không phải đoán**: kho ấy vốn gom cho **độ sâu**, chỉ
**179/1.358** file có nhắc tới báo hiệu và **70** có bảng báo hiệu thật.

Luồng Định An vẫn thiếu: nhà nước công bố **118 phao**, `vn-aids.v1.json` vẫn chỉ có vài
chục. Chúng **không nằm** trong kho này — cổng ENC chưa nhập miền Nam (xem đầu
`generate-vn-aids.mjs`), và Thông báo hàng hải chỉ công bố **sự kiện** từng cái phao chứ
không công bố **sổ đăng ký** cả luồng. Muốn đủ 118 thì phải có nguồn **thứ ba**; đọc kỹ
hơn kho này không ra thêm.

Chỗ còn đào được, theo thứ tự đáng làm:

1. **7 báo hiệu lệch 55–95 km ra khơi** (§6b) — lỗi **đang hiển thị sai** trên bản đồ,
   nặng hơn mọi việc "thêm dữ liệu" bên dưới. Cần đo ngưỡng khoảng-cách-tới-bờ cho báo
   hiệu ngoài khơi hợp lệ trước khi dựng cổng.
2. **281 ảnh scan còn sót** — chạy `ocr-soundings.mjs` cho mẻ ngoài miền Bắc.
3. **11 tin GỠ không toạ độ** — vá khi (và chỉ khi) số khớp được > 0 (§6).
4. **35 tin không rõ việc** — cần OCR lại chất lượng cao hơn ở đúng dòng "Về việc",
   không phải nới regex.
