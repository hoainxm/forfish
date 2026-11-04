# Giao diện hải đồ thuần SDVICO — rà iSailor · OpenCPN · ForFish

**Ngày**: 2026-11-04 · **Người yêu cầu**: anh Long ("rà các màn hình bao gồm cả cách thực hiện các tính năng … làm lại 1 giao diện mới theo hướng thuần hải đồ, sở hữu của SDVICO, 2 bên kia chỉ dùng làm tham khảo")
**Nguồn**: gói cài `Wärtsilä iSailor 2.81` và `OpenCPN 4.1.915` (APKPure, anh Long tải 04/11) — chỉ ĐỌC chuỗi giao diện, tên lớp, tài nguyên; **không chạy, không dịch ngược mã, không chép hình/mã**. Màn ForFish: đọc mã hiện tại (`fishing-map-view.tsx` 10 727 dòng, `ban-do/*`, `ban-do-lop.ts`, `ra-khoi-controls.tsx`, `nav-*`).
**Tính chất**: tài liệu ĐỀ XUẤT, chưa sửa code. Đổi giao diện bản đồ là thay đổi chéo nhiều màn (🟡) — làm khi anh Long chốt.

---

## 0. Kết luận một đoạn

ForFish đã **hơn** cả hai app ở phần nội dung Việt Nam (tên Việt + chủ quyền, báo hiệu Cục Hàng hải, độ sâu tô theo mớn, khu cấm, bão, con nước 106 trạm, offline thật). Chỗ **thua** là phần "máy hải đồ" (chart-plotter): không có bảng màu đêm, mũi tàu không có vạch hướng đi, chỉ north-up, không ghi vết, không canh neo, không người rơi xuống biển (MOB), không thước tỉ lệ, không báo phóng quá cỡ, độ sâu an toàn cố định 10 m. Hai app kia làm phần này theo **một khuôn giống nhau** — khuôn đó là quy ước nghề hàng hải (IEC 62065/ECDIS), không phải tài sản của ai. Đề xuất: giữ bộ máy dữ liệu + ký hiệu tự vẽ hiện có, dựng lại **lớp vỏ** bản đồ thành một màn "hải đồ thuần": bản đồ chiếm trọn, một dải số liệu tàu, một cột công cụ, các tính năng nghề cá (dự báo cá, chợ, Sen Biển) lùi thành LỚP bật được — không chen lên mặt hải đồ khi chưa gọi.

---

## 1. Hai app tham khảo — đọc từ gói cài

| | iSailor 2.81 (Wärtsilä, gốc Transas) | OpenCPN 4.1.915 (Android) |
|---|---|---|
| Lõi | C++/Qt5, ~30 thư viện, **mỗi tính năng một thư viện** (`libnav_route`, `libmob`, `libnav_anchor_watch`, `libhydro`, `libkona_weather`, `libnav_targets`, `libnav_tracks`…) | C++ (wxWidgets port Qt), **một** `libopencpn.so` 11 MB + 2 plugin (tải hải đồ, từ thiên WMM) |
| Hải đồ | Bán theo vùng ("folio" Harbour/Approach/Coastal/General), tải từ máy chủ ChartStore sau khi mua Google Play, hạn thuê bao, mã khuyến mãi, khôi phục mua | Người dùng tự nạp ENC S-57/S-63, raster BSB/KAP; plugin tải hải đồ miễn phí của các nước |
| Ký hiệu | Bộ hình riêng Transas (sprite ngày/đêm) | Thư viện S-52 của IHO (`chartsymbols.xml` + sprite ngày/hoàng hôn/đêm) — **GPL-2.0** |
| Bảng màu | Daylight · Dusk · Night | DAY_BRIGHT · DAY_BLACKBACK · DAY_WHITEBACK · DUSK · NIGHT |
| Thuỷ triều | `TIDE.DAT` 5 098 trạm, 4 sóng rút gọn — đã giải mã, lấy 2 trạm Hoàng Sa/Song Tử (xem `tides.ts` `consTuBangTrieu`) | `tcdata/HARMONIC` của WXTide, **không có trạm Việt Nam** |
| Bờ biển nền | `world` (TX-97, 2002, 124 KB) | GSHHS (14 MB) |
| Giấy phép | Độc quyền Wärtsilä; quyền dùng anh Long trao đổi trực tiếp | **GPL-2.0** — chép mã/hình/bảng ký hiệu vào app là buộc mở mã ForFish |

---

## 2. Rà từng màn — ba bên cạnh nhau

Tên màn iSailor lấy từ catalog dịch (`assets/translations/*.qm`, 255 ngữ cảnh) và lớp `Ui_*`; OpenCPN từ tên hộp thoại + chuỗi tuỳ chọn trong `libopencpn.so`; ForFish từ mã.

| # | Màn / khối | iSailor | OpenCPN | ForFish hôm nay |
|---|---|---|---|---|
| 1 | **Mặt hải đồ khi mở** | Hải đồ trọn màn, nút zoom, la bàn trên màn (`COnscreenCompassControl`: COG·HDG·SOG) | Hải đồ trọn màn, thanh công cụ 20 icon, **thanh hải đồ** (piano — các tờ hải đồ đang ghép), thanh trạng thái | Bản đồ + ô "Đi đâu?" + cột phải (Lớp, ⋯) + ô toạ độ + Sen Biển + loa + vị trí + tốc độ + dock. Đã có bảng `ban-do-lop.ts` (5 chế độ) để gọn nút |
| 2 | **Dải số liệu tàu** | `PositionPanel` (LAT·LON·GPS·Acc·UTC), `CogSogPanel`, `EtaTtgPanel`, `HorzMonitoringPanel` (BTW·DTW·ETA·TTG·XTD), `HorzDepthWindPanel` — mỗi khối một ô, xếp ngang/dọc | Dashboard plugin (đồng hồ kim) + thanh trạng thái | `plotter-readout.tsx` (toạ độ tàu + con trỏ, khoảng cách/phương vị từ tàu), HUD dẫn đường, đồng hồ tốc độ |
| 3 | **Hướng bản đồ** | `ChartOrientationPanel`: North Up · COG Up · Head Up · Route Up | North Up · Course Up (chu kỳ cập nhật chỉnh được) · Look Ahead | **Chỉ North Up**, camera đẩy tàu lệch về phía trước (`nav-camera.ts`) |
| 4 | **Bảng màu** | `PalettesPanel`: Daylight · Dusk · Night (phím tắt) | 5 bảng màu S-52 | **Không có** — chỉ một nền sáng |
| 5 | **Tuỳ chọn hiển thị hải đồ** | `ChartOptionsPanel` General/ENC/Layers: All · Custom · Simplified, ranh giới hải đồ, độ chính xác | Display Category (Base·Standard·All·Mariner), Paper Chart / Simplified, đường biên Plain/Symbolized, **2 hoặc 4 sắc độ sâu**, Shallow/Safety/Deep Depth, bật tắt số đo sâu, chữ, đèn, thông tin neo | Khay Lớp 5 bảng (Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt); đường an toàn **cố định 10 m** |
| 6 | **Thông số tàu / độ sâu an toàn** | `SafetyParamsPanel` (Safety contour), `ShipSettingsPanel` (tên, MMSI, hô hiệu, kích thước), `BoatDimensions` + vị trí ăng-ten GPS, mớn nước, UKC | Ships: kích thước, độ lệch GPS mũi/giữa tàu | Mớn nước trong hồ sơ tàu (`BoatProfile.draftM`), đọc 1 lần khi dẫn đường |
| 7 | **Chạm vào hải đồ (thông tin điểm)** | `ChartInfoGenerator`: vị trí con trỏ · độ sâu · triều · mục tiêu AIS · vật người dùng — **một danh sách gộp mọi thứ dưới ngón tay** | `ChInfoWin`/rollover: thuộc tính S-57 của đối tượng | ~12 loại thẻ (`the-thong-tin.tsx`), kẹp trong khung; có lỗi "vật xa giành chạm" (đánh giá 09/2026) |
| 8 | **Tuyến** | `RouteEditPage` (giờ đi, tốc độ TB, ETA, đảo tuyến, xuất GPX/KML), `WaypointEditPage` (hướng, khoảng cách, **bán kính quay trở**, tốc độ chặng, XTD từng điểm), **`CheckRoutePanel` soi nguy hiểm theo hải đồ** (danh sách nguy hiểm theo điểm WP) | Route Manager: tuyến/điểm/vết/lớp, kích hoạt, điểm kế, in, gửi GPS | Dẫn đường né gió sóng + soi độ sâu theo mớn + soi rạn Hoàng Sa/Trường Sa (đã có, mạnh hơn cả hai); tối đa 6 điểm dừng, 12 tuyến lưu |
| 9 | **Giám sát tuyến khi chạy** | `RouteMonitoringPanel`: Next WPT · BTW · DTW · TTG · XTD · CRS; báo động lệch XTD, gần WP, chuyển WP, hết tuyến | Tương tự + vòng đến điểm | HUD dẫn đường, cảnh báo lệch tuyến theo nấc (`nav-progress.ts`) |
| 10 | **Vết tàu (track)** | `TracksListPage`/`TrackViewPage`: bật/tắt ghi, độ dài, thời gian, xuất, "Focus on track", ghi nền | Bật vết, nhiều vết, tô sáng, tạo tuyến từ vết | **Không có** (chỉ vết của tàu AIS khác) |
| 11 | **Mục tiêu AIS** | Danh sách lọc (Class A/B, AtoN, trạm bờ; sắp theo tên/khoảng cách/TCPA), thẻ đầy đủ (MMSI·IMO·hô hiệu·trạng thái·mớn·CPA·TCPA), véc-tơ chỉnh phút, **AIS qua Internet** (gói bán), tin an toàn AIS | Danh sách + hộp báo động CPA/TCPA + vết mục tiêu + hiện kích thước thật | Chế độ AIS (bán kính + toàn biển), CPA/TCPA vẽ trên bản đồ; **chưa có chuông báo CPA** |
| 12 | **Đo khoảng cách / phương vị** | ERBL (vạch phương vị + vòng cự ly điện tử) kéo trên màn, sửa số tay | Measure Distance, vòng cự ly quanh tàu | Công cụ đo 2 điểm; chưa có vòng cự ly quanh tàu |
| 13 | **Canh neo** | `AnchorWatchPanel`: Let go Anchor · By cursor · Swing circle · bán kính · báo động | Neo bằng điểm đánh dấu + vòng báo động | **Không có** |
| 14 | **Người rơi xuống biển (MOB)** | `MOBPanel`: Activate MOB (hỏi xác nhận) → hiện BRG·RNG·TTG·tuổi, đặt lại vị trí/giờ | Nút MOB trên thanh công cụ → tạo điểm + tuyến quay về | Chỉ có lệnh giọng Sen Biển, **chưa có màn** |
| 15 | **Báo động** | `AlarmMonitorPage`: danh sách báo động/cảnh báo, xác nhận, tuổi; loại: canh neo, gần WP, lệch XTD, hết tuyến, nguy hiểm cô lập, **cắt đường an toàn**, độ sâu máy dò, mất/kém GPS | Hộp CPA/TCPA, báo động neo | Cảnh báo rải rác (bão, ranh giới, lệch tuyến) — không có một danh sách chung |
| 16 | **Thuỷ triều & dòng chảy** | `TidesPage`: chọn điểm, đồ thị, bảng HW/LW, **UKC = độ sâu hải đồ + triều − mớn** | `TCWin`: đồ thị trạm, mũi tên dòng chảy | Thẻ con nước 106 trạm, đồ thị kéo theo giờ, tuần trăng (mạnh hơn) |
| 17 | **Thời tiết** | `KonaWeather`: gió/sóng/áp/mưa, tải trọn dự báo dùng offline, thanh tua giờ | GRIB plugin | Gió sóng dòng chảy hạt, bão, tua ngày (mạnh hơn, có offline) |
| 18 | **Vật của người dùng** | `AddInfoEditor`: điểm có loại (phao, xác tàu, chướng ngại, dịch vụ…), độ sâu, ghi chú, **ảnh chụp**, nhập/xuất GPX/KML/KMZ | Điểm đánh dấu có icon (cá, rạn, neo…), lớp | Điểm lưu + ghim điểm cá; **chưa nhập/xuất GPX** |
| 19 | **Kết nối thiết bị** | `ConnectionsListWidget`: TCP/UDP/Serial, NMEA GPS·la bàn·máy đo sâu·gió, máy dò hiển thị echogram (gói bán) | Connections: NMEA 0183/2000, lọc câu, nhật ký NMEA | Chỉ GPS điện thoại |
| 20 | **Cửa hàng hải đồ** | `ChartFolioListWidget`: mua/tải/cập nhật/gỡ theo vùng, hạn dùng, mã đại lý | Chart Downloader | Gói premium theo tài khoản (`tier.ts`) |
| 21 | **Khởi động** | EULA "chỉ là phương tiện hỗ trợ hàng hải" (bắt bấm I AGREE), mẹo dùng, đăng ký | — | — |

---

## 3. Cách thực hiện từng tính năng — họ làm sao, SDVICO làm sao

Cột "SDVICO làm" dùng **đúng nền đang có** (MapLibre GL + Next.js PWA + Capacitor, dữ liệu `public/data` mã SDF1/SDF2, `lib/` thuần có test). Không chép mã, không chép hình; các khái niệm (CPA, XTD, đường an toàn, vòng neo…) là quy ước nghề hàng hải, ai cũng dùng được.

| Tính năng | Họ làm (theo cái đọc được) | SDVICO làm |
|---|---|---|
| **Bảng màu Ngày / Chiều / Đêm** | Ba bộ màu áp lên cả hải đồ lẫn giao diện; đổi bằng một nút (iSailor có phím tắt) | Thêm 3 bộ token màu hải đồ trong `globals.css @theme` (màu nội dung hải đồ ≠ token UI, 03 §6) + `ocean-map.ts` dựng style theo bảng; sprite ký hiệu có biến thể đêm từ `build-chart-sprite.mjs` (tự vẽ, không lấy màu S-52). Đêm = nền tối đỏ-hổ phách thấp sáng để giữ mắt nhìn đêm. Tự chuyển theo giờ mặt trời tại vị trí tàu (`moon.ts`/thiên văn đã có), chạm để ép |
| **Hướng bản đồ** | Ma trận xoay quanh tàu; Course Up cập nhật theo chu kỳ để không giật | `nav-camera.ts` thêm chế độ `huongDi` (COG lọc trung bình trượt ~5–10 s, bỏ khi tốc độ < 1 hl/g) → `map.rotateTo(-cog)`. Ba nấc: Bắc lên · Hướng đi lên · Tuyến lên. Mũi tên Bắc nhỏ hiện khi bản đồ xoay |
| **Mũi tàu + vạch hướng** | Hình tàu theo HDG, véc-tơ COG dài theo phút (chỉnh 1–30 phút), vạch mũi | Icon tàu xoay theo COG (điện thoại không có la bàn tàu); véc-tơ = vị trí sau N phút với SOG — tính ở `lib/` (haversine sẵn có), vẽ GeoJSON line |
| **Độ sâu an toàn + 2/4 sắc** | Ba mức Nông/An toàn/Sâu do người dùng đặt; tô nước theo 2 hoặc 4 sắc; báo động khi tuyến/vết cắt đường an toàn | Đã có lưới độ sâu + đẳng sâu. Thêm cài đặt "Đường an toàn" = mớn + 1 m (mặc định, sửa được) thay hằng 10 m (`ocean-map.ts:285`); 4 dải tô theo 3 mức đó; dẫn đường + chế độ chạy dùng cùng số |
| **Ghi vết tàu** | Ghi nền (iSailor có dịch vụ "Background position tracking"), lưu điểm theo bước thời gian/khoảng cách, xuất GPX | Capacitor background geolocation (native) / PWA chỉ khi mở màn; lọc điểm (≥ 20 m hoặc ≥ 30 s, bỏ điểm sai số lớn), lưu IndexedDB theo chuyến (offline, không gửi mạng); xem lại, xuất GPX, "tạo tuyến từ vết". Nối với Chuyến biển sẵn có |
| **Canh neo** | Thả neo tại tàu hoặc tại con trỏ; vòng xoay = bán kính; ra ngoài vòng → báo động | Nút "Thả neo" → lưu toạ độ + bán kính (mặc định 3 × độ sâu + chiều dài tàu, tối thiểu 30 m); so mỗi lần GPS về, chống báo nhầm bằng 3 lần liên tiếp vượt + bỏ điểm sai số > bán kính/2; chuông + rung + đọc giọng; chạy nền (native) — đây là chỗ PWA không đủ |
| **Người rơi xuống biển (MOB)** | Một chạm (có xác nhận) ghi vị trí + giờ; màn chỉ BRG·RNG·TTG về điểm; tuyến quay lại | Nút đỏ luôn có ở chế độ chạy, **giữ 1 giây** thay hộp xác nhận (tay ướt, tàu lắc); ghi điểm + giờ, bật dẫn đường thẳng về điểm, hiện phương vị/cự ly to; cộng dạt theo dòng chảy (đã có trường dòng) để gợi ý vùng tìm |
| **Báo động CPA** | Ngưỡng CPA/TCPA, hộp báo động, xác nhận + hẹn giờ tắt | Đã có `ais-cpa.ts`; thêm ngưỡng (mặc định CPA < 0,5 hl, TCPA < 12 phút), chuông + giọng, danh sách báo động chung |
| **Danh sách báo động chung** | Một trang báo động: loại, tuổi, xác nhận | Một kho báo động `lib/` (bão, ranh giới, lệch tuyến, neo, CPA, nông, mất GPS) → một chuông nổi; an toàn không bao giờ bị ẩn (giữ luật `ban-do-lop`) |
| **ERBL / vòng cự ly** | Vạch phương vị + vòng điện tử kéo bằng ngón, sửa số | Mở rộng công cụ đo: neo một đầu tại tàu, kéo đầu kia, hiện phương vị + cự ly; vòng cự ly 1–2–5 hl tuỳ chọn |
| **Kiểm tuyến** | Soi tuyến với hải đồ (S-57 hoặc TRS), liệt kê nguy hiểm theo điểm | **Đã có và mạnh hơn** (độ sâu theo mớn, rạn xa bờ, khu cấm, gió sóng). Chỉ cần đưa ra một danh sách "Nguy hiểm trên tuyến" theo từng chặng |
| **Chạm xem thông tin** | Gom mọi thứ dưới ngón tay thành một danh sách (độ sâu, triều, AIS, vật) | Đổi thẻ chạm thành **một tấm gom** theo thứ tự: an toàn (nông/cấm) → báo hiệu → độ sâu + triều lúc này → tàu AIS → điểm lưu; sửa lỗi "vật xa giành chạm" bằng "gần nhất thắng" |
| **Thước tỉ lệ + báo phóng quá cỡ** | Thanh tỉ lệ; báo khi phóng quá độ chi tiết của hải đồ | MapLibre `ScaleControl` (hl/km theo cài đặt); mỗi nguồn ghi zoom tối đa thật → vượt thì một dòng "Phóng quá chi tiết hải đồ" |
| **Nhập/xuất GPX/KML** | Nhập/xuất tuyến, vết, điểm | `lib/gpx.ts` thuần (đọc/ghi, có test); xuất qua chia sẻ của máy |
| **Kết nối NMEA (máy dò, la bàn, AIS)** | TCP/UDP/Serial, mở khoá theo gói | Để sau: chỉ làm trong bản native (Capacitor plugin TCP/UDP) khi có khách dùng máy dò/AIS thật — giai đoạn 3 |
| **Bán hải đồ theo vùng** | Folio + hạn dùng + khôi phục | Không cần đổi: gói theo tài khoản đang chạy. Học thêm: báo trước khi gói sắp hết hạn, mã khuyến mãi |

---

## 4. Hướng giao diện "hải đồ thuần" của SDVICO

### 4.1 Nguyên tắc

1. **Mặt hải đồ là của hải đồ.** Mở lên chỉ thấy: hải đồ, tàu mình, một dải số liệu, một cột công cụ. Dự báo cá, mật độ tàu, chợ, Kairos… là **lớp** — tắt mặc định trên màn này, bật trong khay Lớp.
2. **Một chế độ — một bộ nút** (đã có `ban-do-lop.ts`, giữ và mở rộng): Rảnh · Tìm · Bảng · Tuyến · **Chạy** (thay "dẫn đường" + "đang chạy" gộp làm một chế độ có/không có tuyến) · **Neo** (mới).
3. **An toàn không bao giờ ẩn**: bão, ranh giới, nông, neo trôi, MOB, CPA — ở mọi chế độ, mọi bảng màu.
4. **Ba bảng màu**, đêm là bắt buộc — ngư dân chạy đêm nhiều hơn chạy ngày.
5. **Số to, chữ ít**: dải số liệu là con số + đơn vị, nhãn ≤ 2 chữ (`labels.ts`), không câu giải thích trên mặt hải đồ.
6. **Của SDVICO từ gốc**: ký hiệu tự vẽ (đã có 106 hình), bảng màu tự đặt, dữ liệu tự dựng, mã tự viết. Không một hình, bảng màu S-52, chuỗi hay đoạn mã nào lấy từ iSailor/OpenCPN.

### 4.2 Bố cục (điện thoại dọc 375 × 812)

```
┌──────────────────────────────────────┐
│ ▣ Dải số liệu (1 dòng, chạm để mở)   │  Tốc độ · Hướng · Độ sâu · (Điểm kế · Cự ly · Giờ đến)
│   12,4 hl/g   235°   18 m   ⤳ WP2 4,1 hl  21:40
├──────────────────────────────────┬───┤
│                                  │ ⊕ │  Cột công cụ phải (5 nút icon):
│                                  │ ⊖ │   Lớp · Hướng (N/⤒) · Đo · Màu (☀/◐/☾) · ⋯
│          HẢI ĐỒ TRỌN MÀN         │ ◎ │
│     (tàu + véc-tơ hướng đi)      │ ☀ │
│                                  │ ⋯ │
│                                  ├───┘
│  ⚓ / MOB (chỉ ở chế độ Chạy)       │
│ ─── thước tỉ lệ  · ⓘ phóng quá cỡ │
├──────────────────────────────────────┤
│  Dock (ẩn khi Chạy/Neo)              │
└──────────────────────────────────────┘
```

- Rảnh: hải đồ ≥ 85 % màn (hôm nay đo 76 %).
- Chạy: dock ẩn, dải số liệu mở 2 dòng, nút MOB đỏ giữ-1-giây góc trái dưới, nút Neo.
- Ngang (tablet/đặt trên cabin): dải số liệu thành cột trái — giống `HorzMonitoringPanel` của iSailor.

### 4.3 Bản đồ màn hình mới

| Màn | Gồm | Thay cho |
|---|---|---|
| Hải đồ (chế độ Rảnh) | Mặt hải đồ + dải số liệu + cột công cụ | Màn bản đồ hiện tại (giữ ô "Đi đâu?" dạng icon kính lúp ở cột) |
| Khay Lớp | 3 nhóm: **Hải đồ** (độ sâu, báo hiệu, đèn, cáp, khu cấm, chữ) · **Biển** (gió sóng, dòng, bão, nhiệt độ, con nước) · **Nghề** (dự báo cá, mật độ, AIS, điểm cá) | Khay 5 bảng |
| Cài đặt hải đồ | Bảng màu, hướng bản đồ, đơn vị, **mớn + đường an toàn**, cỡ ký hiệu, véc-tơ phút, ngưỡng CPA, bán kính neo | Rải trong bảng Cài đặt/Công cụ |
| Chạy | Dải số liệu 2 dòng, véc-tơ, giám sát tuyến (điểm kế, XTD), MOB, Neo, chuông báo động | HUD dẫn đường + "Đang chạy" |
| Neo | Vòng xoay, khoảng cách tới neo, trôi tối đa, nút Nhổ neo | (mới) |
| MOB | Phương vị + cự ly to, tuổi, hướng dạt, nút Tắt | (mới) |
| Tuyến | Danh sách điểm (hướng/cự ly/tốc độ chặng/giờ đến), **Nguy hiểm trên tuyến**, đảo tuyến, xuất GPX | Route planner |
| Vết | Danh sách chuyến, xem lại, xuất GPX, tạo tuyến từ vết | (mới, nối Chuyến biển) |
| Báo động | Danh sách đang kêu + đã xác nhận | (mới) |
| Tấm chạm | Một tấm gom mọi thứ dưới ngón tay | ~12 thẻ rời |

### 4.4 Cái giữ nguyên

Bộ máy dữ liệu (`ocean-map.ts`, `data-fetch`, SDF1/SDF2, service worker), ký hiệu tự vẽ, dẫn đường né gió sóng, con nước, bão, AIS, Sen Biển (icon nổi), luật thẻ nổi 03 §6 mục 8, bảng chế độ `ban-do-lop.ts`. Lần làm lại này là **vỏ + chế độ + 6 tính năng máy hải đồ còn thiếu**, không đập bộ máy.

---

## 5. Ranh giới pháp lý — được lấy gì

| Thứ | iSailor | OpenCPN |
|---|---|---|
| Ý tưởng tính năng, bố cục, quy ước nghề (CPA, XTD, ERBL, đường an toàn, Course Up) | ✅ tham khảo tự do | ✅ tham khảo tự do |
| Hình ký hiệu, icon, âm thanh, phông | ❌ (độc quyền; phông Arial Unicode của Monotype) | ❌ (GPL-2.0 + S-52 cấm "adapted") |
| Bảng màu cụ thể | ❌ tự đặt | ❌ không chép bảng S-52 — tự đặt |
| Mã, chuỗi giao diện | ❌ | ❌ (GPL lây sang ForFish) |
| Dữ liệu | Chỉ phần anh Long có giấy cho phép (đang lấy: 2 trạm triều) | Dữ liệu tide WXTide không có trạm VN — không cần |

---

## 6. Lộ trình đề xuất

| Đợt | Việc | Vì sao trước |
|---|---|---|
| 1 | Bảng màu Ngày/Chiều/Đêm · mũi tàu + véc-tơ hướng đi · thước tỉ lệ · đường an toàn theo mớn | Ít rủi ro, dùng ngay mỗi đêm; không đụng offline |
| 2 | Canh neo · MOB · chuông báo động chung (gồm CPA) | An toàn tính mạng; cần chạy nền → làm trong bản native |
| 3 | Vỏ mới: dải số liệu, cột công cụ, khay Lớp 3 nhóm, gộp Chạy, tấm chạm gom | Đổi bố cục lớn, cần chụp màn kiểm 375 px trước/sau |
| 4 | Hướng đi lên/Tuyến lên · ghi vết + GPX · Nguy hiểm trên tuyến dạng danh sách | |
| 5 | NMEA/máy dò/AIS thiết bị (native) — khi có khách dùng | Phụ thuộc phần cứng |

Mỗi đợt: ba-spec ngắn → design-spec 07 → code + test `lib/` → câu hỏi offline (a–d) trong commit.

## 7. Đã chốt (anh Long, 2026-11-04)

> "chế độ hải đồ thuần này là 1 lớp mới, ko dính tới cái cũ, bà con quen nhìn giao diện này thì đổi qua thôi … rồi cho cái mới trên cái đó, canh neo và MOB ok"

1. **Chế độ Hải đồ là một lớp RIÊNG, không sửa màn bản đồ cũ.** Bà con quen kiểu máy hải đồ thì chuyển sang; ai quen màn cũ vẫn dùng màn cũ. Câu hỏi "thay hẳn hay màn riêng" ⇒ **màn riêng**.
2. **Tính năng mới đặt trên chế độ Hải đồ**, không gắn ngược vào màn cũ: bảng màu đêm, véc-tơ hướng đi, thước tỉ lệ, đường an toàn theo mớn, canh neo, MOB, chuông báo động, ghi vết.
3. **Canh neo + MOB: duyệt.** Bản PWA chỉ chạy khi màn đang mở (chấp nhận); bản cài native chạy nền.

### 7.1 Cách tổ chức đề xuất (để thực hiện)

| Phần | Cách làm | Vì sao |
|---|---|---|
| Đường vào | Route riêng **`/hai-do`**, cây component riêng `src/components/hai-do/*` — KHÔNG import `fishing-map-view.tsx` | Không đụng 10 727 dòng màn cũ; hỏng cái mới không kéo cái cũ |
| Dùng chung | Chỉ lớp `lib/` thuần + dữ liệu: `ocean-map.ts` (style), `data-fetch`/SDF, `chart-symbols`, `tides`, `ais-cpa`, `nav-progress`, dẫn đường, `boat-profile` | Một nguồn sự thật cho dữ liệu; tính năng mới viết thành `lib/` có test để sau này màn cũ muốn dùng thì gọi được |
| Chuyển qua lại | Một nút ở cột phải màn cũ ("Hải đồ") + một nút ở màn mới ("Bản đồ"); nhớ lựa chọn trong máy (`forfish.*`) để lần sau mở thẳng màn quen | Bà con tự chọn, không ép |
| Offline | `/hai-do` vào `SHELL` của service worker như `/ngu-truong`; đọc cùng file dữ liệu đã tải, không tải thêm bản nào | Mất sóng vẫn mở được; không nhân đôi dung lượng |
| Quyền | Gói/premium giữ nguyên luật `tier.ts` + `data-route-rules.ts` — lớp dự báo cá trên màn mới vẫn qua cổng cũ | Không mở cửa sau |
| Thứ tự | Đợt 1 (vỏ + màu đêm + véc-tơ + thước + đường an toàn) → Đợt 2 (canh neo, MOB, chuông) → Đợt 4 (hướng đi lên, vết, GPX) | Có vỏ trước mới có chỗ đặt nút neo/MOB |

Còn mở: "thuần hải đồ" ⇒ trên màn mới, dự báo cá / mật độ tàu **tắt mặc định**, bật trong khay Lớp (mặc định an toàn nhất theo §4.1; anh muốn khác thì đổi một dòng).
