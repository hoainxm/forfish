# Kiểm kê dữ liệu bản đồ — hiện trạng trước khi chốt phương án tự chủ (2026-09)

> **Việc**: chủ dự án chuẩn bị chốt MỘT phương án tổng để tự chủ xây dữ liệu bản đồ
> (như Navionics/C-MAP đang bán). Trước khi ai đó vẽ phương án, đây là bản kiểm kê
> TRUNG THỰC: có gì, mỗi thứ tốt tới đâu, hổng chỗ nào.
>
> **Cách đo**: mọi con số về file trong `public/data/` là **tự đo ngày 2026-09-02**
> (script đo để ngoài repo, thư mục tạm của phiên): đếm đối tượng, hộp toạ độ, cỡ nén
> gzip/brotli, chạy `npm run kiem:ban-do`, chạy `node scripts/audit-names.mjs`, grep
> wiring trong `src/` + `public/sw.js`. Số liệu lịch sử/đối chiếu **trích từ
> `docs/research/*.md`** có ghi nguồn từng dòng — không đo lại thứ đã đo.
> "Qua sóng" = cỡ gzip (Vercel phát brotli, chênh không đáng kể).

---

## 0. Bảng tổng — một dòng một lớp

| Lớp (file) | Số đối tượng | Phủ (vĩ độ) | Nguồn | Giấy phép | Xác minh | Đã nối? | So Navionics/C-MAP |
|---|---|---|---|---|---|---|---|
| **Nền** `vn-basemap.pmtiles` | 982 ô z0–9 · 83.121 đối tượng · 14,4 MB | 4–24°B / 102–118°Đ | Protomaps 4.15.2 (OSM chốt 2026-08-27), đã gột nhãn bằng `rebuild-basemap.mjs` | **ODbL share-alike** | `audit-names` 2026-09-02: **SẠCH** 0 CJK (trước gột: 12.755 đối tượng chữ Hán) | ✅ nối + kho SW riêng | Họ có nền chi tiết tới z18+; ta dừng z9, gần bờ chỉ overzoom |
| **Rạn ACA** `reef-shapes-aca.v1.{bin,pmtiles}` | 1.534 cụm · 88.840 mảnh · 4.030.270 đỉnh | 4–22,8°B / 102–118°Đ | Allen Coral Atlas 5 m + WCMC-008 v4.1, lấy 2026-08-29 | **CC BY 4.0 — sạch, bán được** (⚠️ riêng 80 cụm gốc WCMC: hai báo cáo mâu thuẫn giấy phép, xem §1.3) | mép ≤8,4 m (0,88 px z14); WCMC xác nhận 548/1.454 cụm ACA (38%), vênh tâm→mép trung vị 155 m; 986 cụm chỉ mình ACA thấy | ✅ nối (vector tile z3–13) | Ngang/tốt hơn về mép rạn; họ không công bố lý lịch từng hình |
| **Rạn OSM** `reef-shapes.v1.json` | 2.622 hình (2.345 reef · 190 shoal · 45 rock · 42 wreck) | 4–23,6°B | OSM Overpass 2026-08-29 | **ODbL** | ACA xác nhận 52/55 mẫu; tâm lệch trung vị 1.556 m vs WCMC; ven bờ VN chỉ 138 hình | ✅ (chỉ còn vai điểm hiểm hoạ + mặt nạ depth-grid) | Họ có obstruction/wreck dày từ ENC; ta 87 điểm cả khung |
| **Nhãn rạn Việt** `coral-reefs.v1.json` | 13 điểm tên | Trường Sa 7 + DK1 6 | Tự soạn (Wikipedia VI) | sdfish-own | cổng test chủ quyền | ✅ | Họ 0 tên tiếng Việt ở Trường Sa — ta thắng tuyệt đối |
| **Đảo** `vn-islands.v1.json` | 103 điểm (42 ven bờ + 36 HS + 25 TS) | 7,9–21,4°B | Tự soạn (Wikipedia VI) | sdfish-own | cổng test chủ quyền (CJK/khung/admin) | ✅ | Tương đương; ta hơn về tên Việt HS-TS |
| **Bờ offline** `vn-coast.v1.json` | 526 polygon · 10.759 đỉnh | 3–24°B | Natural Earth 1:10m | public domain | giản lược 440 m — chỉ để định hướng | ✅ (lưới an toàn mất sóng) | Họ có bờ chi tiết hơn nhiều |
| **Tuyến/luồng** `vn-sea-lanes.v1.json` | 290 (5 tuyến vẽ tay + 285 OSM) | — | OSM + tự vẽ | ODbL + sdfish-own | ⚠️ **~90% nội dung là Hồng Kông/Quảng Đông/Hải Nam; luồng vào cảng VN: 0** [do-phu] | ✅ | Họ có đủ luồng VN từ ENC — ta thua trắng lớp này |
| **Lưới độ sâu** `depth-grid.v1.bin` | 17.057.881 ô 15″ (2 bit) · 4,07 MB | 5–23,5°B / 102–118°Đ | ETOPO 2022 + GEBCO 2026 + mặt nạ rạn | PD + GEBCO terms — sạch | khớp GEBCO 100% biển sâu, 85,2% vùng rạn; **mù nông: bắt đúng 1/13 điểm thật <4 m**; 35% chỗ khảo sát ven luồng bị xếp là ĐẤT | ✅ (dẫn đường + cảnh báo cạn) | Họ có ô ~mét ở luồng từ khảo sát; ta 450 m |
| **Đẳng sâu** `isobaths.v1.json` | 17 feature: 9 mức đường + 8 mức vùng · 3.467 vòng · 69.779 đỉnh · 1,10 MB | 5–23°B | ETOPO 2022 | PD — sạch | 0 vòng hở; cổng an toàn 557 điểm TBHH: 0 ca tô sâu quá 15 m, 1 ca >6 m | ✅ đường; **dải tô CHƯA bật** (tương phản <3:1, có số đo) | Navionics tô dải màu — ta mới có đường nét |
| **Số đo sâu TBHH** `soundings.v1.json` | 394 điểm · 313 tuyến · 191 thông báo · 770 KB (70 KB sóng) | điểm: **8,66–11,88°B**; tuyến: tới 21,4°B | Thông báo hàng hải (vmsa.vn + Wayback vms-south) | **vn-official — sạch** | xem lớp verified ↓; 149 điểm ngày ước lượng ~2019 (39%) | ✅ + CRITICAL_SHELL | **Mật độ thua xa** (họ: SOUNDG dày đặc từ ENC); ta tươi hơn (tới 2 tháng/lần) |
| **Đo sâu cảng vụ** `soundings-cangvu.v1.json` | 178 điểm · 9 tuyến · 10 TB | 10,3–11,9°B | trang cảng vụ tỉnh | vn-official | **175/178 trùng kho trung ương (15 m)** — chỉ 3 điểm mới [thu-tu-uu-tien] | ✅ (qua verified) | — |
| **Đoạn luồng** `fairway-depths.v1.json` | 22 đoạn · 10 tuyến · 17 TB · 382 KB (28 KB sóng) | 15,2–20,9°B (miền Bắc) | TBHH + vn-aids (ghép tên phao→toạ độ) | vn-official | 13/13 đoạn cũ khớp lưới vệ tinh | ✅ + SHELL | Bù đúng nửa nước viết thông báo theo đoạn |
| **Đối chiếu đo sâu** `soundings-verified.v1.json` | 916 mục: **khớp 433 (47%) · giải thích được 41 · nghi lỗi 18 · KHÔNG đối chiếu được 424 (46%)** | theo 3 file trên | tự đối chiếu ETOPO↔GEBCO | — | chính nó LÀ bước xác minh; 424 mục không đối chiếu được vì lòng sông hẹp hơn ô 450 m | ✅ (ẩn 18 điểm nghi lỗi; điểm >365 ngày vẽ rỗng ruột) | Họ có ZOC/M_QUAL chuẩn S-57; ta có bản tự chế minh bạch hơn với người dùng |
| **Báo hiệu OSM** `seamarks.v1.json` | 5.851 · 21 loại · 184 KB (47 KB sóng) | 4,1–24°B cả khung | OSM Overpass | **ODbL** | ⚠️ **chỉ 474 (8,1%) trong dải bờ VN** — 2.942 Hồng Kông, 631 Hải Nam; Định An 0/118 phao, Hải Phòng 0/120+45 [do-phu] | ✅ + sprite ký hiệu IALA-A | **Thua trắng ở luồng VN** — lỗ nặng nhất so đối thủ |
| **Báo hiệu Cục HH** `vn-aids.v1.json` | **774** báo hiệu · 96 KB | **7,5–21,4°B** (miền Nam đã lấp 2026-09-02) | ENC vinamarine + TBHH | **vn-official — sạch** | đối chứng chéo: 308/377 đỉnh tuyến OCR nằm trong 2 km một phao thật | ❌ **CHƯA NỐI** — 0 dòng `src/` fetch lúc runtime, không có trong `sw.js`; chỉ dùng lúc build + đối chứng. ⚠️ `kiem:ban-do` vẫn đếm nó như một lớp "sẽ thấy" — bảng đang nói quá so với màn hình | Đây chính là dữ liệu lấp lỗ phao luồng — **có rồi mà chưa vẽ** |
| **Đèn biển** `den-bien.v1.json` | 90 ngọn (50 nửa nam · 9 Trường Sa · 2 DK1) · 31 KB (6 KB sóng) | 7,9–21,4°B | vmsa 40 + ENC 28 + **Wayback vms-south 55 (trang gốc CHẾT)** | vn-official — sạch | 27 ngọn có đối chứng chéo ENC; 90/90 đủ đặc tính chớp; thiếu Hòn Hải (điểm cơ sở A6) + 5 ngọn ENC toạ độ trống | ✅ (z7) + CRITICAL_SHELL | Ngang họ về đèn chính; ta có tên Việt + câu chớp đọc được |
| **Thuỷ triều** `tide-stations.v1.json` | **4 trạm** (Hòn Dấu, Quy Nhơn, Vũng Áng, Vũng Tàu) · RMSE 0,149 m (Hòn Dấu) | 4 điểm rời | UHSLC/JASL RQDS, hằng số tự phân tích | sạch (PD + tự phân tích) | RMSE ghi từng trạm trong file | ❌ **CHƯA NỐI** — `lib/tides.ts` thuần + test, **0 component import, không trong sw.js** | Navionics có trạm triều khắp nơi + đồ thị; [do-phu] xếp thuỷ triều vào 3 lớp thiếu nghiêm trọng nhất |
| **Mùa vụ cá** `fish-climatology.v1.json` | lưới 69×65 ô 0,25° · 12 tháng | 5–22°B | NOAA CoralTemp 2020–2025 + VIIRS chl | công khai NOAA | backtest riêng (fit-fish-blend-weights) | ✅ (trục cá premium) | Đối thủ hải đồ không có lớp này — sản phẩm bán riêng của ta |

Ngoài `public/data/`: `public/icons/chart-sprite*` (bộ ký hiệu hải đồ tự vẽ theo QCVN 20:2015, 52 KB, **đã nối 2026-09-01**, tránh GPL OpenCPN + cấm-adapted của IHO S-52).

**Cân nặng**: `public/data/` trên đĩa **117 MB**, trong đó 76 MB là `reef-shapes-aca.v1.json` trung gian đã `.gitignore` — nhưng nó nằm trong `public/` nên **máy dev vẫn phục vụ nó ra ngoài** [style-render §9]; phần theo git ~**41 MB** / trần hook 120 MB [phan-bien-vung-do-sau]. `.git` hiện **218 MB**. Bộ rạn ACA đang tồn tại **ba bản** (.json 76 MB ngoài git · .bin 8,4 MB · .pmtiles 12 MB — giữ .bin vì hai cổng giấy phép/chủ quyền đọc nó).

---

## 1. Chi tiết đáng chú ý theo nhóm

### 1.1 Nền bản đồ
- Nền là bản Protomaps dựng từ OSM, **zoom chỉ tới 9** — sát cảng MapLibre overzoom, không thêm chi tiết. Nợ đã ghi trong 02-architecture.
- Chủ quyền: bản gốc chứa 12.755 đối tượng chữ Hán, có cả "三沙市" trên Phú Lâm [ra-soat-ten]. `rebuild-basemap.mjs` đã gột; **kiểm lại 2026-09-02 bằng `audit-names.mjs`: SẠCH cả hai pmtiles** (0 CJK/tên nước ngoài trong 6.635 ô, 305.553 đối tượng). Cổng thường trực: `no-cjk-data.test.ts`.
- ODbL share-alike: nền **không bán được** — chấp nhận được vì bản đồ là lớp miễn phí (CLAUDE.md §Nguồn dữ liệu), nhưng phương án tự chủ phải ghi rõ nền không nằm trong "gói sạch".

### 1.2 Độ sâu — mạnh ở biển hở, mù ở đúng chỗ chết người
- Lưới 450 m khớp GEBCO 100% ở biển sâu, nhưng ven bờ <1 km: **90% mẫu khảo sát bị mô hình xếp là ĐẤT** [emodnet-vs-gebco]; điểm thật <4 m chỉ bắt đúng **1/13** [phan-bien]. Luật "lấy nông hơn" của app cắt ca nguy hiểm từ 12 còn **2/602** — cả 2 cùng một toạ độ ở Soài Rạp.
- Sự cố đã ghi: đường tiếp cận **cửa Định An app nói "đủ sâu >12 m" nơi TBHH công bố 3,9 m** [do-phu] — sau đó đã có mặt nạ rạn + GEBCO + fairway, nhưng bản chất "ô 450 m không thấy luồng nạo vét 100–150 m" là **giới hạn vật lý, không sửa bằng code được**.
- Số đo khảo sát thật: cộng thô 572 điểm (394+178), **khử trùng 15 m còn ~369 điểm duy nhất**, gọn trong **12 ô 0,25°**, toàn bộ điểm rời nằm **dưới 11,88°B**; đo theo bán kính 3 km chỉ chạm **0,7% chiều dài bờ** [thu-tu-uu-tien]. Miền Bắc bù bằng 22 đoạn luồng khống chế. **Từ 12°B tới 15,2°B (Nha Trang→Sa Kỳ): trắng cả điểm lẫn đoạn.**
- 46% mục trong verified là "không đối chiếu được" — sông Lòng Tàu/Thị Vải/Soài Rạp/Năm Căn, lòng lạch hẹp hơn ô. Đây là chỗ **ghi "không biết" thay vì tô hồng** — đúng, và cũng nghĩa là gần nửa kho khảo sát không có trọng tài độc lập thứ hai.
- EMODnet **không có dữ liệu VN** (0/72, 0/45 điểm dò; biên đông bộ DTM là 43–45°Đ) — mọi đường dựa EMODnet cho VN là ngõ cụt đã đo [emodnet-vs-gebco].
- Nguồn tương lai đã khảo sát nhưng **chưa dùng**: HHU24SWDSCS (29,4 triệu điểm 10 m, RMSE 0,82 m, CC BY 4.0 — nhưng **0 điểm ven bờ VN**, chỉ HS/TS; và 10 m ≈ 1:10.000 chạm ngưỡng "Tối mật" QĐ 562/QĐ-TTg — cần chốt pháp lý trước khi đụng); ATL24 ICESat-2 (2.373 granule, điểm laser dọc tuyến); bình đồ khảo sát trong 27/63 PDF TBHH (ảnh 94 dpi — OCR chữ số 4,5–9 px, dưới ngưỡng 20 px của Tesseract, **không cứu được**) [nguon-do-sau, nguon-do-sau-mo-rong].

### 1.3 Rạn — tài sản sạch nhất
- Bộ ACA/WCMC: 4,03 triệu đỉnh, mép ≤8,4 m, ven bờ ×33,8 so OSM (11.188 vs 331 mảnh dưới 110°Đ) [ran-ve-lai-aca]. Mỗi feature mang `prov` đầy đủ (origin + crossChecks) — lọc "gói bán được" bằng một câu `cleanPackage()`.
- Trung thực về xác minh: chỉ **548/1.454 cụm ACA (38%) có WCMC xác nhận độc lập** (đếm trực tiếp `agreed:true` trên file); 986 cụm là ACA-only — ảnh vệ tinh 5 m có quy trình lặp lại được, nhưng chưa nguồn thứ hai nào xác nhận. 80 cụm là WCMC-only (nước đục cửa sông — chỗ ACA mù).
- ⚠️ **Mâu thuẫn giấy phép WCMC chưa xử**: `09-nautical-map-sources.md` §6c ghi WCMC = General Data License **phi thương mại → LOẠI**; hai báo cáo mới hơn (`doi-chieu-nguon`, `ran-ve-lai-aca`, 2026-08-29) ghi **CC BY 4.0 bán được**. Nếu bản "phi thương mại" đúng thì 80 cụm/439 mảnh gốc WCMC phải rơi khỏi gói bán — cần một lần tra tận văn bản giấy phép trước khi chốt phương án.
- Riêng ACA còn tầng giấy phép: maps/geomorphic/benthic CC-BY 4.0 OK, nhưng **mosaic ảnh Planet là BY-NC-SA và lớp Boundaries dính tranh chấp — cấm dùng** [09-nautical §6c].
- Render đã giải xong bằng PMTiles: 3.970 ms → 3,7 ms, RAM 835 MB → 2,9 MB [ran-vector-tile]. Rủi ro sw.js mà báo cáo đó cảnh báo (nhánh Range gắn cứng một archive) **đã xử**: `sw.js` nay có danh sách PMTILES gồm cả hai file, có test `sw-basemap-range`.
- Lớp điểm hiểm hoạ (45 đá + 42 xác tàu) vẫn phải mượn OSM — ACA/WCMC không có lớp điểm, NGA MSI (nguồn thay thế public domain) đang 503. Đối thủ lấy từ ENC có hàng nghìn.

### 1.4 Báo hiệu + đèn — dữ liệu nhà nước đã về, phần vẽ chưa theo kịp
- Lớp đang vẽ (`seamarks`, OSM) **rỗng đúng chỗ cần**: 474/5.851 trong dải bờ VN, 69% dồn ở 20–21°B; hai luồng lớn nhất nước 0 phao. Không phải lỗi bóc — **OSM Việt Nam thật sự trống** (toàn VN chỉ 68 phao/tiêu) [do-phu].
- Trong khi đó `vn-aids.v1.json` đã có **774 báo hiệu nhà nước** phủ 7,5–21,4°B — và **chưa có một dòng nào vẽ nó**. Kho sổ AtoN VMS-South (752 báo hiệu có toạ độ, 21/22 tuyến miền Nam, đối chiếu Định An 117/118) đã tìm thấy, file ứng viên còn nằm ngoài repo chờ Lead quyết [san-so-dang-ky].
- 22 tuyến miền Nam trên cổng ENC **không bao giờ có bảng toạ độ** (khuôn trang B chỉ in số đếm) — đường HTML tự nó không lấp được miền Nam [bao-hieu-mien-nam].
- Đèn biển 90 ngọn: nguồn nửa nam là **bản Wayback của trang đã chết**; sổ AtoN chỉ còn **MỘT bản lưu duy nhất** trên Internet Archive — rủi ro mất nguồn vĩnh viễn nếu không tải về cất.

### 1.5 Chưa nối — căn bệnh cũ đang sống lần thứ tư
Ba lần trước (lớp độ sâu · bộ ký hiệu · kết quả đối chiếu) đã ghi trong 02-architecture (4)(5)(6). Hiện còn **hai tài sản sinh xong, test xong, không ai vẽ/gọi**:
1. `vn-aids.v1.json` — 774 báo hiệu (xem trên). Nặng thêm vì `kiem:ban-do` đếm nó như lớp đang bật → công cụ tự kiểm đang báo "sẽ thấy" cho thứ màn hình không có.
2. `tide-stations.v1.json` + `lib/tides.ts` — thuỷ triều tính offline, một trong **ba lớp thiếu nghiêm trọng nhất** theo chính bản so đối thủ [do-phu §7], đã có engine + test từ 2026-08-29, **0 component import, không trong SW**.

---

## 2. Các đường ống THU dữ liệu

| # | Đường | Đầu vào → Đầu ra | Điểm gãy đã biết | Tự chạy lại? |
|---|---|---|---|---|
| A | **Overpass OSM** (`generate-reef-shapes/seamarks/sea-lanes.mjs`) | Overpass API → 3 file OSM | rate-limit; vùng tranh chấp phải gột name (cổng CJK); OSM VN trống phao | ✅ sống, chạy lúc build |
| B | **ACA WFS + WCMC FeatureServer** (`generate-reef-shapes-aca.mjs`, 30–60′, cache 803 MB) | WFS 1.0.0 + ArcGIS query → json 76 MB → `encode` → bin → `reef-to-pmtiles` | ⚠️ WFS **2.0.0 trả 0 feature không báo lỗi** (thứ tự trục bbox); ACA 502 nhất thời; WCMC trần 2.000 bản ghi/lượt | ✅ sống (kiểm 2026-08-29) |
| C | **ETOPO ERDDAP `.dods` + GEBCO ODB NTU** (`generate-depth-grid/isobaths.mjs`, `verify-soundings.mjs`) | 38 băng float32 (68 MB) + 90 ô GeoJSON → bin/isobaths/verified | treo không hẹn giờ (đã dính, nay có trần mỗi lô); GEBCO **bắt buộc `mode=point`**, thiếu là nội suy thành trắc diện; ODB NTU là dịch vụ bên thứ ba không SLA | ✅ sống |
| D | **Bóc PDF lớp chữ TBHH** (`fetch-soundings.mjs` + `extract-tbhh-text.mjs` + `lib/pdf-text.mjs`) | vmsa.vn (~8.163 TB) + Wayback CDX vms-south (2.105 PDF) → kho 2.556 PDF ngoài repo → soundings/fairway | **985 PDF ảnh scan (~39% kho)**; font không `/ToUnicode` (Huế 6/13 tệp — chữ bóc ra là mã rác); một PDF nhiều thông báo; ngày suy từ URL (149 điểm) | ✅ vmsa sống; **vms-south/vms-north CHẾT — chỉ còn Wayback** |
| E | **OCR ảnh scan** (`ocr-soundings.mjs`, EasyOCR vi+en, venv + GPU ngoài repo) | 987 PDF → 911 bản chữ → nhập lại đường D | dính máy dev (venv + RTX 3060, không trong package.json); lỗi "hợp lý mà sai" phải cổng chặn (nhiễu sau dấu giây, `BL.1`→`81.1`, đan hàng bảng) | ✅ chạy lại được trên máy này; dự phóng phần còn lại ~308 điểm — lợi suất thấp |
| F | **Bóc HTML cổng ENC vinamarine** (`generate-vn-aids.mjs`, `generate-den-bien.mjs`) | 100 ID tuyến + 45 ID đèn → vn-aids 774 + đèn 28 | SSL lỗi (phải bỏ verify); **khuôn B miền Nam không có bảng toạ độ (22/43 tuyến)**; 5 trang đèn ô toạ độ trống; không ghi ngày cập nhật | ✅ sống |
| G | **Trang cảng vụ tỉnh** (`fetch-soundings-cangvu.mjs`) | 27 tên miền → 16 sống → 178 điểm | 175/178 trùng kho trung ương — **lợi suất gần 0**; Hải Phòng đăng lại cả nước (bẫy tên miền); 3 trang chỉ còn vỏ Plesk | ✅ nhưng không đáng chạy lại thường xuyên |
| H | **Wayback/CDX** (dùng chung D + đèn biển + sổ AtoN) | CDX vms-south → PDF/HTML nửa nam | nguồn gốc chết vĩnh viễn; **sổ AtoN 5,2 MB chỉ còn MỘT snapshot** (các snapshot sau là 301/lỗi) — chưa tải cất chính thức | ✅ Wayback sống, nhưng là bản đóng băng ≤2023, không bao giờ có dữ liệu mới |
| I | **UHSLC/JASL mực nước** (`generate-tides.mjs`) | số đo giờ từng trạm → hằng số điều hoà 4 trạm | mới 4 trạm; đầu ra chưa ai dùng (§1.5) | ✅ |
| J | **NOAA ERDDAP SST/chl** (`collect-fish-climatology.mjs` + các probe Copernicus) | CoralTemp + VIIRS → climatology 0,25° | phụ thuộc uptime ERDDAP; trục cá, ngoài phạm vi hải đồ | ✅ |
| K | **NGA MSI** | (dự định: đèn/hiểm hoạ PD toàn cầu) | **503 "under maintenance" từ 2026-08-29**, chỉ World Port Index sống | ❌ đang chết |

**Rủi ro kho vật liệu**: toàn bộ nguyên liệu các đường D/E/H — 2.556 PDF (1,7 GB), 1.837 bản OCR, 1.358 bản lớp-chữ, cache ACA 803 MB — nằm trong **thư mục Temp của Windows** (`%TEMP%\sdfish-*`). Đúng quy tắc chống phình, nhưng một lần dọn đĩa là mất: tải lại vmsa được, **phần Wayback quota chậm và phần sổ AtoN thì chỉ còn một bản**. Chưa có bản sao lưu có chủ ý nào.

---

## 3. So đối thủ — vị trí tổng

Theo bản đối chiếu 53 lớp với máy hải đồ tàu cá [do-phu-hai-do-2026-08]: **điểm phủ 31%** (8 đủ · 17 một phần · 28 thiếu). Đo 2026-08-29 — từ đó đã thêm: ký hiệu IALA (nối), soundings/fairway (nối), verified, đèn biển, vn-aids (chưa nối), rạn ACA pmtiles (nối). Ước lượng lại chưa ai đo — con số 31% là **sàn**, hiện trạng khá hơn một ít nhưng chưa đo lại.

- **Thua hẳn**: mật độ SOUNDG (họ: dày đặc từ ENC; ta: ~369 điểm duy nhất, 12 ô 0,25°); phao luồng đang vẽ (0 ở Định An/Hải Phòng); chất đáy SBDARE (0, không có nguồn mở); safety contour theo mớn tàu (ta ngưỡng cứng 4/12 m — thiếu **cơ chế** S-52, sửa rẻ); vùng UNSARE/"tôi không biết" (0); nền z>9.
- **Ngang hoặc hơn**: mép rạn (≤8,4 m, có lý lịch); độ tươi số đo luồng (TBHH 2 tháng/lần vs C-MAP theo quý); tên tiếng Việt + chủ quyền (họ 0); đèn biển có câu chớp tiếng Việt; thời tiết 16 ngày + dòng chảy 4 tầng (máy hải đồ thường không có); minh bạch tuổi/nguồn từng con số.
- **Đường họ đi mà ta không đi được**: mua ENC S-63 (chỉ cấp cho ECDIS type-approve, không hợp mô hình app di động) [nguon-do-sau]; crowd-sourced bathymetry kiểu Genesis (Olex 8,6 tỷ điểm từ 10.000 tàu — VN chưa có hạ tầng CSB, IHO DCDB có **0 sounding** vùng VN).

---

## 4. Ba lỗ hổng lớn nhất (đánh giá của người kiểm kê)

1. **Vào-ra cửa lạch vẫn là chỗ trắng nhất, và phần vá ĐÃ CÓ TRONG TAY nhưng chưa vẽ.** Lớp phao đang hiển thị có 8,1% nội dung ở VN; hai luồng lớn nhất nước 0 phao. Trong khi 774 báo hiệu nhà nước (`vn-aids`) nằm sẵn trong repo không ai fetch, sổ AtoN 752 báo hiệu miền Nam nằm ngoài repo chờ quyết, thuỷ triều 4 trạm có engine không ai gọi. Căn bệnh "sinh xong không nối" đang sống lần thứ 4 — và lần này công cụ tự kiểm (`kiem:ban-do`) còn che nó bằng cách đếm lớp chưa nối như lớp đang bật.
2. **Độ sâu mù đúng dải ra quyết định.** Điểm khảo sát thật chỉ phủ 0,7–1,8% bờ, trắng hoàn toàn 12→15,2°B; mô hình 450 m bắt đúng 1/13 điểm nông <4 m, xếp ĐẤT cho 35% chỗ đã khảo sát ven luồng; 46% kho khảo sát không có trọng tài độc lập; 39% điểm mang ngày ước lượng 2019 ở luồng bồi lắng. Không nguồn mở nào lấp được thềm 10–200 m ven bờ (HHU24 0 điểm ven bờ, GMRT 0, CSB 0, ATL24 chỉ dọc tuyến laser).
3. **Chuỗi cung nửa nam đứng trên một nguồn đã chết, chưa sao lưu.** Đèn biển nửa nam + Trường Sa + DK1, sổ AtoN, kho TBHH miền Nam trước 05/2025 — tất cả chỉ còn qua Wayback; sổ AtoN còn đúng MỘT snapshot; toàn bộ 2,5 GB nguyên liệu nằm trong %TEMP% có thể bị dọn bất cứ lúc nào. Thêm rào pháp lý chưa chốt: QĐ 562/QĐ-TTg (bản đồ đảo >1:10.000 = Tối mật) treo trên đầu mọi phương án dùng dữ liệu 10 m ở Trường Sa.

## 5. Ba tài sản mạnh nhất

1. **Bộ rạn ACA/WCMC — hàng bán được, có lý lịch từng hình.** Sạch ODbL 100%, mép ≤8,4 m (4× nét hơn OSM), ven bờ ×33,8, đã đóng vector tile chạy 3,7 ms/2,9 MB RAM trên máy yếu. Cộng `provenance.ts` (giấy phép + thang tin cậy A–D + `cleanPackage()` một câu lọc gói sạch) — đây là nền tảng của chính sản phẩm "bán licence dữ liệu" mà Navionics không công bố tương đương.
2. **Đường ống TBHH đã thông cả nước và có bộ tự soi lỗi.** PDF lớp chữ + OCR GPU + Wayback + cảng vụ + ghép đoạn-phao: 394 điểm + 313 tuyến + 22 đoạn, quy về số 0 hải đồ, tươi tới 2 tháng — cộng verify hai mô hình độc lập đã bắt được lỗi bóc thật (16/17 số rơi chữ số lẻ) và dám ẩn 18 điểm nghi lỗi khỏi bản đồ. Kho 2.556 PDF + 2.275 bản chữ sẵn sàng khai thác tiếp.
3. **Bộ cổng chất lượng + chủ quyền chạy tự động.** `audit-names` quét MVT từng ô (grep thường bị gzip che mắt), `no-cjk-data` trong `npm test`, cổng toạ độ/admin cho đảo-rạn, `kiem:ban-do` tách "lớp tắt / không có dữ liệu / không vẽ", cổng an toàn 557 điểm cho vùng tô đẳng sâu, test đột biến. Nền pmtiles đã được gột sạch 12.755 tên Hán và kiểm lại SẠCH 2026-09-02. Đối thủ không cho người dùng thấy được chuỗi này; với thị trường VN nó là điều kiện sống còn.

---

## Nguồn trích

`do-phu-hai-do-2026-08.md` · `doi-chieu-nguon-2026-08.md` · `ran-ve-lai-aca.md` · `ran-vector-tile-2026-08.md` · `doi-chieu-do-sau-2026-08.md` · `emodnet-vs-gebco-2026-09.md` · `phan-bien-vung-do-sau-2026-09.md` · `thu-tu-uu-tien-2026-09.md` · `nguon-do-sau-2026-08.md` · `nguon-do-sau-mo-rong-2026-08.md` · `thong-bao-hang-hai-2026-08.md` · `cang-vu-tinh-2026-08.md` · `ocr-mien-bac-2026-09.md` · `kho-pdf-chua-doc-2026-09.md` · `bao-hieu-mien-nam-2026-09.md` · `san-so-dang-ky-2026-09.md` · `den-bien-2026-09.md` · `ky-hieu-hai-do-2026-08.md` · `ra-soat-ten-2026-08.md` · `style-render-2026-08.md` · `toc-do-hien-thi-2026-08.md` · `09-nautical-map-sources.md` · docs/app-map/02-architecture.md mục (1)–(11) · số đo trực tiếp 2026-09-02 (đếm file, gzip, `kiem:ban-do`, `audit-names`, grep wiring).

**Chưa đo / còn treo**: điểm phủ 53-lớp sau đợt 08-31→09-02 (chưa chấm lại, 31% là số cũ); % xác minh của 774 báo hiệu vn-aids so với sổ AtoN (hai bộ chưa đối chiếu nhau); tuổi thật của bảng tuyến luồng cổng ENC (trang không ghi ngày); giấy phép S2Shores, điều khoản Navionics/C-MAP (403), vị thế CSB của VN tại IHO — đều ghi "chưa tra được" trong các báo cáo gốc.
