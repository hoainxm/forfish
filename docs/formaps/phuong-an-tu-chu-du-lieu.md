# Phương án tự chủ dữ liệu bản đồ — MỘT phương án, chốt 2026-09-02

> Tổng hợp từ hai phân tích cùng ngày: [kiểm kê hiện trạng](../research/kiem-ke-du-lieu-2026-09.md) (18 lớp, 11 đường ống, đo trực tiếp) và [mổ phương pháp nhà sản xuất](../research/phuong-phap-nha-san-xuat-2026-09.md) (chuỗi ENC quốc gia + Navionics/C-MAP, có nguồn từng khẳng định). Người tổng hợp chịu trách nhiệm về các lựa chọn; hai báo cáo chịu trách nhiệm về số liệu.

## 0. Câu trả lời một đoạn

Cái máy hải đồ 5 triệu không có phép màu: C-MAP tự mô tả quy trình là *"lấy hải đồ chính thức của nhà nước và chuyển thành định dạng riêng"* — không hãng nào tự khảo sát, và phần ruột Việt Nam của họ biên tập lại **đúng cái giếng nguồn SDFish đang bóc**. Khoảng cách giữa ta và họ không nằm ở nguồn hay ở pháp lý; nó nằm ở **hai bước hạ tầng ta chưa có**: (1) một **kho nguồn** tách khỏi sản phẩm, mỗi đối tượng một ID ổn định, và (2) **nhịp cập nhật theo lớp** thay vì mọi thứ đều là mẻ sinh-lại. Phương án này xây đúng hai bước đó lên trên những đường ống đã chạy, không đập gì đi làm lại.

## 1. Nền pháp lý — chốt một lần, ghi vào máy

Chủ dự án chốt (2026-09-02), nhất quán với CLAUDE.md:

1. **Sự kiện không có bản quyền.** Vị trí một ngọn đèn, độ sâu một luồng, đặc tính một cái phao — không ai sở hữu được. "Cái đèn hải đăng ai vẽ cũng thế."
2. **Dữ liệu nhà nước Việt Nam công bố công khai dùng thẳng** (Điều 15 Luật SHTT loại văn bản hành chính và số liệu khỏi bảo hộ). KHÔNG viết câu dè chừng pháp lý cho nhóm này. Giấy phép `vn-official` trong `provenance.ts` là hiện thân của luật này.
3. **Nguồn bất kỳ → xác minh độc lập → dữ liệu của mình.** Với nguồn mang điều khoản tập hợp (ODbL của OSM): dùng làm **manh mối đi tìm**, xác minh bằng vệ tinh + nguồn nhà nước, ghi lý lịch theo **nguồn xác minh** — chuỗi dẫn xuất đứt. Máy móc hoá: một đối tượng chỉ được mang `source` sạch khi `crossChecks` có ít nhất một nguồn độc lập không-ODbL; `cleanPackage()` đã chặn sẵn phần còn lại.
4. Hai cổng thật còn lại: **cấm "adapted" ký hiệu S-52** (đã giải — bộ `chart-sprite` tự vẽ) và **chủ quyền** (`audit-names.mjs` chặn máy; nguồn nào buộc ghi "South China Sea" thì loại dù giấy phép sạch).

## 2. Hiện trạng — tóm từ bản kiểm kê

**Ba tài sản mạnh nhất**: bộ rạn ACA sạch có lý lịch từng hình (1.454 cụm, 38% có WCMC đối chứng) · đường ống Thông báo hàng hải thông cả nước + bộ tự soi dám **ẩn 18 điểm nghi sai** khỏi bản đồ · bộ cổng chất lượng/chủ quyền tự động (3.008 test, hook, audit-names).

**Ba lỗ hổng lớn nhất**: (1) vào-ra cửa lạch — phao đang vẽ mỏng trong khi dữ liệu vá **đã nằm trong tay** (sổ AtoN 2016: 752 báo hiệu miền Nam, mới gộp một phần); (2) độ sâu mù đúng dải quyết định — điểm khảo sát phủ ~1–2% bờ, trắng 12→15,2°B, mô hình toàn cầu bắt 1/13 điểm nông <4 m; (3) chuỗi cung nửa nam đứng trên **nguồn đã chết** (`vms-south.vn`) mà kho vật liệu 2,5 GB còn nằm trong thư mục tạm chưa sao lưu.

**Số đối tượng chính thức hiện có**: 774 báo hiệu (147 nam 15°B) · 90 đèn biển (9 Trường Sa, 2 DK1) · 394 điểm đo sâu + 313 tuyến + 22 đoạn luồng · 1.454 cụm rạn · nền + đẳng sâu 2 vai. Tất cả đã NỐI vào bản đồ và vào vỏ offline (lần tái phát thứ tư của bệnh "sinh xong không nối" vá hôm nay, kèm cổng ba-mảnh).

## 3. Phương án: XƯỞNG HẢI ĐỒ BỐN BƯỚC

Mô phỏng đúng chuỗi nhà sản xuất, thu nhỏ thành script — mỗi bước đã có mầm trong repo, phương án chỉ nắn chúng thành một dây chuyền.

```
   THU                KHO NGUỒN              XÁC MINH                PHÁT HÀNH
 (đã có 11        (bước MỚI duy nhất)      (đã có, nâng cấp)      (đã có, thêm nhịp)
  đường ống)
 TBHH PDF ──┐                          ┌─ đối chiếu chéo nguồn
 cổng ENC ──┤    kho-nguon/            │  (compare-sources)
 Wayback  ──┼──► mỗi đối tượng         ├─ vệ tinh Sentinel-2      ┌─► public/data/*.v1.json
 sổ AtoN  ──┤    MỘT ID ổn định  ─────►│  (công trình cố định)────┤   (app, offline-first)
 vệ tinh  ──┤    lịch sử sự kiện       ├─ mô hình GEBCO/ETOPO     └─► gói ForMaps
 OSM(manh ──┘    (LẬP/ĐỔI/NGƯNG/GỠ)    │  (biển hở)                   (cleanPackage, bán licence)
  mối)                                 └─ trọng tài kiem-ban-do
```

### Bước 1 — THU (giữ nguyên, thêm một luật)
11 đường ống hiện có giữ nguyên. Luật thêm: **mọi vật liệu thô phải vào kho có sao lưu** — 2,5 GB PDF/OCR/cache đang nằm trong `%TEMP%` là rủi ro cháy nhà; sổ AtoN 752 báo hiệu chỉ còn MỘT bản Wayback trên toàn internet. Việc đầu tiên của phương án là chép kho này về một chỗ bền (ổ riêng/NAS — KHÔNG vào git, đúng luật CHỐNG PHÌNH).

### Bước 2 — KHO NGUỒN (bước mới duy nhất, và là trái tim)
Học từ CARIS HPD của chuỗi ENC: **đối tượng lưu một lần, nhiều sản phẩm dẫn xuất**. Bản script-hoá:

- `kho-nguon/` (repo riêng hoặc thư mục có phiên bản riêng): mỗi phao/đèn/điểm đo một bản ghi với **ID ổn định** (`vn-aid:dinh-an:phao-05`), mang: toạ độ + mọi thuộc tính + **lịch sử sự kiện** (thông báo nào LẬP/ĐỔI/NGƯNG/GỠ nó, ngày nào) + `crossChecks` + giấy phép nguồn.
- Sự kiện là đơn vị ghi, hiện trạng là phép chiếu — đúng bài học "báo hiệu là sự kiện" đã dùng cho vn-aids, nay thành luật chung.
- `public/data/*.v1.json` trở thành **sản phẩm dẫn xuất** của kho, sinh bằng chính các `generate-*.mjs` hiện có (đổi đầu vào, giữ đầu ra — app không đổi một dòng).

### Bước 3 — XÁC MINH (nâng cấp cái đã có, theo số đo thật)
Ba máy xác minh, chọn theo **bản chất đối tượng** (số từ báo cáo phương pháp):

| Đối tượng | Máy xác minh | Vì sao |
|---|---|---|
| Đèn biển, đăng tiêu, đê, giàn (đứng yên) | **Sentinel-2** (giấy phép mở, định vị ~11–12,5 m) | xác minh được công trình cố định tới ~10–15 m; quy trình 5 bước đã ghi ở §3.2 báo cáo phương pháp |
| Phao (trôi quanh neo, đổi theo nạo vét) | **Feed Thông báo hàng hải** — nguồn sống duy nhất | dưới pixel vệ tinh; SDB vô dụng ở nước đục |
| Độ sâu biển hở | GEBCO/ETOPO + khảo sát nhà nước làm trọng tài | đã chạy (`verify-soundings`), khớp 47%, phần "không đối chiếu được" là giới hạn vật lý ô 450 m |
| Độ sâu cửa lạch nước đục | **CHỈ Thông báo hàng hải** | SDB RMSE 1,1–1,9 m chỉ đúng ở nước trong; Định An/Soài Rạp thì mù — đường OCR đang chạy là đường duy nhất, không phải đường tạm |

Luật RENC thu nhỏ: **người kiểm không phải người làm** — mỗi dataset mới phải qua một lượt phản biện độc lập trước khi vào kho (văn hoá đã có, nay thành cổng bắt buộc trong quy trình giao việc).

### Bước 4 — PHÁT HÀNH (thêm nhịp, thêm nhãn tuổi)
- **Nhịp theo lớp**, học từ bản vá ER hằng tuần của NOAA: phao/độ sâu luồng theo feed TBHH (`mhe-south.vn` còn sống, 1.399 thông báo 2019–2025) — mục tiêu tháng/lần; đèn biển năm/lần; rạn/nền "sinh lại có chủ ý" như luật hiện hành. Mỗi lớp ghi `layNgay` + mỗi đối tượng ghi "TBHH nào chạm nó lần cuối".
- **Cấm bắt chước vẻ liền mạch che tuổi**: repo đã dính hai lần (lưới nói "đủ sâu" chỗ 3,9 m; điểm 2019 vẽ y hệt 2026). Cơ chế rỗng-ruột + thẻ tuổi của lớp đo sâu thành chuẩn cho mọi lớp.
- Nhánh ForMaps: `cleanPackage()` đã lọc theo giấy phép; kho nguồn có ID + lịch sử chính là thứ bán được (API tra "phao X hiện ở đâu, đổi lần cuối khi nào").

## 4. Thứ tự làm — trả về nhiều nhất trước

| # | Việc | Vì sao trước | Đầu vào đã có |
|---|---|---|---|
| 1 | **Sao lưu kho vật liệu 2,5 GB + tải giữ sổ AtoN** | rủi ro mất trắng, một bản Wayback duy nhất | kho `%TEMP%`, URL Wayback |
| 2 | **Gộp sổ AtoN 2016 ba tầng** (đèn/tiêu gộp thẳng · phao gộp nền + 176 TBHH đè theo ngày · nhãn tuổi) | lấp lỗ hổng #1 — cửa lạch nửa nam, dữ liệu ĐÃ trong tay | `aton-aids.json` 752 mục + `tbhh_index.json` |
| 3 | **Dựng kho-nguon/ + ID ổn định**, chuyển vn-aids + den-bien vào trước | trái tim phương án; hai lớp này có lịch sử sự kiện sẵn | `generate-vn-aids.mjs` đã phân loại LẬP/ĐỔI/NGƯNG/GỠ |
| 4 | **Nhịp TBHH tháng/lần** (script kéo feed mhe-south → sự kiện → kho → sinh lại) | biến "sinh lại có chủ ý" thành dòng chảy cho lớp chuyển động | `extract-tbhh-text.mjs`, `pdf-text.mjs` |
| 5 | **Xác minh Sentinel-2 cho 90 đèn + đăng tiêu** | đóng chuỗi "vẽ lại + đối chiếu = của mình" cho lớp đứng yên | quy trình §3.2 báo cáo phương pháp |
| 6 | Xử hai việc treo: Hòn Hải (điểm cơ sở A6) + mâu thuẫn giấy phép WCMC (tra tận văn bản CC BY vs phi-thương-mại) | nợ đã ghi, chặn `cleanPackage` cho lớp rạn | doc research đã dẫn đường |

## 5. Cái KHÔNG làm (quyết định, không phải bỏ sót)

- **Không tự khảo sát / crowdsource sonar** (chủ dự án đã bỏ 2026-09-01) — Navionics làm được vì có triệu khách; ta dùng khảo sát nhà nước.
- **Không mua SDB thương mại** — vô dụng ở nước đục cửa lạch, nơi duy nhất đang thiếu.
- **Không đổi chỗ lưu ra ngoài git/Vercel** cho sản phẩm phát hành (luật CHỐNG PHÌNH giữ nguyên); kho nguồn thô mới là thứ nằm ngoài.
- **Không dựng tile server cho app** — file tĩnh + SW thắng mọi server khi mất sóng; tile server chỉ dành cho nhánh ForMaps bán API.

## Assumptions
- Mâu thuẫn giấy phép WCMC (mục 4-#6) chưa chốt — trong lúc chờ, lớp rạn giữ nguyên trong app (bản đồ miễn phí, không vướng) nhưng KHÔNG vào gói bán.
- Con số "phao đang vẽ 8,1% ở VN" của bản kiểm kê tính trên lớp OSM cũ; lớp `vn-aids` 774 cái vá phần chính thức nhưng chưa ai đo lại tỷ lệ phủ tổng — sẽ đo sau bước gộp sổ AtoN (#2).
