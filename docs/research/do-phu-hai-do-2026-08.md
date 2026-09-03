# Đủ chưa? — Đối chiếu SDFish với một máy hải đồ trên tàu

> **Câu hỏi của chủ dự án**: *"Một máy bản đồ chuyên nghiệp trên tàu hiển thị
> những gì, thì SDFish có đủ chừng ấy chưa?"*
>
> **Trả lời một dòng**: **chưa — đo được 31% độ phủ.** SDFish làm rất tốt phần
> *nhìn vùng biển* (đường đẳng sâu, hình rạn, đảo tên Việt, ranh giới, thời
> tiết) nhưng gần như **trắng ở phần *vào ra cửa lạch*** — đúng chỗ tàu cá va
> đá, mắc cạn và chìm. Đo thật: trên hai luồng hàng hải lớn nhất nước (Định An
> và Hải Phòng), SDFish có **0 phao báo hiệu luồng**.
>
> Ngày đo: **2026-08-29**. Mọi con số về SDFish do **đếm trực tiếp từ file
> trong repo**, script chạy tại chỗ, không chép lại từ tài liệu cũ.

---

## 0. Tóm tắt bảy dòng

1. Chấm trên **53 lớp** mà máy hải đồ tàu cá thật sự hiển thị: **8 lớp đủ ·
   17 lớp có một phần · 28 lớp thiếu hẳn** → **điểm phủ 31%**.
2. Phần **nhìn vùng biển** đã tốt: 5.110 đường đẳng sâu 9 mức, 2.622 hình rạn,
   17,06 triệu ô độ sâu, 103 đảo tên Việt, ranh giới + vùng lộng + vùng VMS.
3. Phần **vào ra cửa lạch** gần như trắng. `seamarks.v1.json` có 5.851 báo hiệu
   nhưng **chỉ 474 (8,1%) nằm trong dải bờ Việt Nam** — 2.942 cái là Hồng Kông
   và cửa Châu Giang, 631 cái là Hải Nam.
4. `vn-sea-lanes.v1.json` **không phải dữ liệu Việt Nam**: 24/25 luồng, 90/108
   phân luồng, 8/8 vùng cấm, 76/103 cáp ngầm và 41/41 giàn khoan đều nằm ở
   Hồng Kông / Quảng Đông / Hải Nam. Luồng vào cảng Việt Nam: **0**.
5. Kiểm chứng hai cửa lạch bằng sổ đăng ký tuyến luồng của Cục Hàng hải:
   **luồng Định An – Cần Thơ có 118 phao**, **luồng Hải Phòng có 120 phao +
   45 đăng tiêu**. SDFish có **0 phao** trên cả hai — và **0 báo hiệu trong bán
   kính 3 km quanh phao số "0"** của luồng Hải Phòng.
6. Trên đường tiếp cận **cửa Định An**, SDFish nói **"đủ sâu, trên 12 m"** ở
   chỗ Thông báo hàng hải công bố **3,9 m**. Chênh hơn 7 mét, và chênh về phía
   nguy hiểm.
7. Ba lớp thiếu nghiêm trọng nhất: **số độ sâu luồng · phao tiêu luồng · thuỷ
   triều**. Cả ba cùng trả lời đúng một câu hỏi của bà con: *"tôi qua cửa lạch
   này lúc này có được không?"* — hiện SDFish không trả lời được câu nào.

---

## 1. Đo bằng cách nào

| Việc | Cách làm |
|---|---|
| Đếm đối tượng SDFish | Đọc thẳng file trong `public/data/`, `src/data/` bằng script Node chạy tại chỗ, 2026-08-29 |
| "Trong dải bờ Việt Nam" | Hộp 8,2–21,6°B / 102–110°Đ, **trừ** hộp Hải Nam 17,9–20,4°B / 108,4–111,3°Đ. Hộp này còn dính một ít Campuchia và cửa sông nội địa — nên con số VN nêu ra là **rộng rãi về phía có lợi cho SDFish**, thực tế còn mỏng hơn |
| "Quanh cảng cá" | Haversine tới 138 cảng có toạ độ trong `src/data/fishing-ports.ts` |
| Chuẩn hải đồ | IHO S-57 Ed 3.1 Appendix A (Object Catalogue) + S-52 Presentation Library (mức hiển thị) |
| Số liệu luồng lạch | Thông báo hàng hải của Tổng công ty Bảo đảm an toàn hàng hải (VMS-North / VMS-South), tra 2026-08-29 |

### Đối chiếu với số Lead đưa trong brief

Khớp hết, nhưng **hai chỗ lệch về ý nghĩa — và lệch đúng chỗ quan trọng nhất**:

- Lead ghi *"seamarks.v1.json 5.851 báo hiệu 21 loại"* — đếm lại đúng y (5.851
  mark, 21 giá trị trong bảng `types`). **Nhưng đó là con số của cả khung
  4–24°B / 102–118°Đ, không phải của Việt Nam.** Phần Việt Nam là **474**. Đây
  là chênh quan trọng nhất của cả bản kiểm kê.
- Lead ghi *"vn-sea-lanes.v1.json 290 (phân luồng 108 · cáp 103 · giàn khoan 41
  · luồng 25 · vùng cấm 8 · tuyến 5)"* — đếm đúng 290 và đúng từng loại.
  **Nhưng chữ "vn-" ở tên file gợi ý sai**: ~90% nội dung là Hồng Kông.
- `depth-grid.v1.bin`: Lead ghi 17,06 triệu ô — đếm ra **17.057.881 ô**
  (4.441 × 3.841), file 4.264.471 byte = đúng 2 bit/ô. Khớp tuyệt đối.
- `vn-basemap.pmtiles`: đọc header PMTiles v3 — **z0–9, khung 102–118°Đ /
  4–24°B, 16,88 MB**. Khớp.
- `isobaths.v1.json` 5.110 tuyến 9 mức, `reef-shapes.v1.json` 2.622 hình
  (reef 2.345 · shoal 190 · rock 45 · wreck 42), `coral-reefs.v1.json` 13,
  `vn-islands.v1.json` 103, `vn-coast.v1.json` 526 polygon. Khớp hết.

---

## 2. VIỆC 1 — Máy hải đồ trên tàu hiển thị những lớp gì

Máy hải đồ điện tử (ECDIS trên tàu hàng; chartplotter Furuno/Garmin/Simrad với
hải đồ C-MAP hay Navionics trên tàu cá) vẽ theo danh mục đối tượng của chuẩn
**IHO S-57**, mỗi lớp một mã sáu chữ cái. S-57 Appendix A có **163 lớp**; dưới
đây **chỉ giữ những lớp một tàu cá vỏ gỗ/composite 15–24 m của Việt Nam thật sự
dùng** — đã bỏ những lớp chỉ có nghĩa với tàu hàng lớn (khu chuyển tải hàng,
ranh giới VTS, khu hoa tiêu bắt buộc) và vùng băng (`ICEARE`, `FLODOC`).

### 2.1 Ba mức hiển thị — và tại sao nó quan trọng với SDFish

Chuẩn **S-52** chia mọi lớp làm ba mức, theo IMO Res. MSC.232(82) Appendix 2:

| Mức | Nội dung | Tắt được không |
|---|---|---|
| **Display Base** | Đường bờ; **đường an toàn (safety contour) do thuyền trưởng chọn**; nguy hiểm ngầm biệt lập nông hơn safety contour; phao/tiêu; hệ phân luồng; **vùng chưa khảo sát** | **KHÔNG** |
| **Standard Display** | Base + đường khô cạn; đèn, vật chuẩn; ranh giới luồng; **vùng cấm/hạn chế**; tuyến hàng hải | Mức tối thiểu bắt buộc khi lập tuyến |
| **All Other** | **Số độ sâu điểm**; cáp và ống ngầm; chi tiết báo hiệu; độ lệch từ; địa danh | Bật khi cần |

**Điểm dễ hiểu sai — và SDFish đang hiểu sai:** mức hiển thị **không cố định
theo lớp**. S-52 có *conditional symbology procedures* đổi mức lúc chạy:

- `DEPCNT02` / `UDWHAZ03` — đường đẳng sâu trùng safety contour được **tô đậm
  và đẩy lên Display Base**.
- `OBSTRN04` / `WRECKS02` — xác tàu, đá ngầm, chướng ngại **nông hơn safety
  contour** thì đổi sang ký hiệu *nguy hiểm biệt lập* và **đẩy lên Display
  Base**.

Nghĩa là: **máy thật vẽ nguy hiểm theo mớn tàu của bà con.** Cùng một cái đá
ngầm 8 m — tàu mớn 2 m thì nó là chi tiết nền, tàu mớn 3,5 m chở đầy cá thì nó
nhảy lên thành ký hiệu đỏ không tắt được.

**SDFish không có cơ chế này.** Rạn, đá, xác tàu vẽ một kiểu cố định
(`REEF_SHAPE_FILL`, `REEF_HAZARD_COLOR` trong `src/lib/ocean-map.ts`), và ngưỡng
cạn là **hằng số cứng 4 m / 12 m** trong `src/lib/depth-grid.ts` — tàu mớn 1,2 m
và tàu mớn 3 m nhận cùng một cảnh báo. Đây là chỗ thiếu **cơ chế**, không phải
thiếu dữ liệu, nên sửa rẻ (xem §7 bậc 1).

### 2.2 Danh mục lớp

Cột **Mức** = B (Display Base) · S (Standard) · O (All Other).

#### Nhóm A — Độ sâu

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `DEPARE` | Depth area | Vùng độ sâu, tô dải màu — nông thì xanh đậm | **B** |
| `DEPCNT` | Depth contour | Đường đẳng sâu có số mét | O (→**B** nếu là safety contour) |
| `SOUNDG` | Sounding | **Số độ sâu tại từng điểm** — con số in trên hải đồ | O |
| `DRGARE` | Dredged area | Vùng nạo vét = đáy luồng, kèm độ sâu duy trì | **B** |
| `UNSARE` | Unsurveyed area | **Vùng chưa khảo sát** — chỗ máy thú nhận nó không biết | **B** |
| `M_QUAL` | Quality of data (ZOC) | **Mức tin cậy khảo sát** — dữ liệu này đáng tin tới đâu | O |
| — | Safety contour / safety depth | Bà con **tự đặt mớn tàu mình**, máy tự tô và tự kêu | **B** |

#### Nhóm B — Hiểm hoạ cố định

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `UWTROC` | Underwater / awash rock | Đá ngầm, đá chìm, đá nhô lúc nước ròng | O → **B** khi nguy hiểm |
| `WRECKS` | Wreck | Xác tàu đắm | O → **B** khi nguy hiểm |
| `OBSTRN` | Obstruction | Chướng ngại, đáy bẩn — chỗ rách lưới | **B** + O |
| `CTNARE` | Caution area | Vùng phải thận trọng, có ghi lý do | S |
| `SBDARE` | Seabed area | **Chất đáy**: cát, bùn, đá, san hô — neo có bám không, kéo lưới được không | O |
| — | Reef / shoal | Rạn san hô, bãi cạn, bãi ngầm | — |

#### Nhóm C — Báo hiệu hàng hải

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `BOYLAT` | Buoy, lateral | **Phao luồng trái/phải** — thứ dẫn tàu vào lạch | **B** |
| `BOYCAR` | Buoy, cardinal | Phao phương vị: đi vòng phía Bắc/Nam/Đông/Tây | **B** |
| `BOYSAW` | Buoy, safe water | **Phao số "0"** — nước an toàn, đầu luồng | **B** |
| `BOYSPP` | Buoy, special purpose | Phao chuyên dùng: thả ống, quân sự, nuôi trồng | **B** |
| `BOYISD` | Buoy, isolated danger | Phao đè lên đúng chỗ nguy hiểm đơn lẻ | **B** |
| `BCNLAT`/`BCNCAR`/`BCNISD`/`BCNSAW`/`BCNSPP` | Beacons | Đăng tiêu cắm cố định, cùng nghĩa như phao | **B** |
| `LIGHTS` | Light | Đèn + **đặc tính chớp, chu kỳ, tầm hiệu lực, màu** | S |
| `DAYMAR` / `TOPMAR` | Daymark / topmark | Chóp và dấu — **ban ngày nhận dạng bằng cái này** | S |
| `RTPBCN` | Radar transponder (racon) | Racon, hiện trên màn radar | S |
| `FOGSIG` | Fog signal | **Còi, chuông sương mù** — mù thì tai thay mắt | S |
| — | Virtual AtoN / AIS AtoN | Phao ảo, chỉ máy thấy | — |

#### Nhóm D — Quy chế vùng biển

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `ADMARE`/`TESARE`/`EXEZNE` | Administration / territorial sea / EEZ | Ranh giới biển quốc gia, lãnh hải, vùng đặc quyền | O |
| `FAIRWY` | Fairway | **Luồng hàng hải** | S |
| `TSSLPT`/`TSEZNE`/`DWRTPT` | Traffic separation / deep water route | Phân luồng, dải phân cách, tuyến nước sâu | **B** |
| `NAVLNE`/`RECTRC`/`RCRTCL` | Navigation line / recommended track | **Trục luồng** — đường tim để bám | S / **B** |
| `RESARE` | Restricted area | **Vùng cấm, vùng hạn chế** | S |
| `ACHARE`/`ACHBRT` | Anchorage area / berth | **Vùng neo đậu** | S |
| `MIPARE` | Military practice area | Vùng diễn tập quân sự | S |
| `PRCARE` | Precautionary area | Vùng đề phòng, giao nhau nhiều tàu | **B** |
| `MARCUL` + `FSHFAC` | Marine culture / fishing facility | **Lồng bè, bãi nuôi, đăng, đáy, nò, sáo** | S / O |
| `FSHGRD` | Fishing ground | Ngư trường | S |
| — | Khu bảo tồn biển | Cấm/hạn chế khai thác theo luật thuỷ sản | — |
| — | Điểm tránh trú bão | Chạy vào đâu khi có bão | — |

#### Nhóm E — Hạ tầng

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `HRBFAC`/`BERTHS` | Harbour facility / berth | Cảng, bến, chỗ cập | O |
| `CBLSUB`/`PIPSOL` | Cable / pipeline, submarine | **Cáp, ống ngầm** — thả neo vào là đứt, đền không nổi | S / O |
| `MORFAC`/`PILPNT` | Mooring facility / pile | Trụ buộc, phao buộc, cọc | **B** |
| `SLCONS`/`DYKCON` | Shoreline construction / dyke | **Kè, đê chắn sóng, cầu tàu** | **B** / S |
| `OFSPLF` | Offshore platform | Giàn khoan, vùng cấm 500 m quanh giàn | **B** |
| `BRIDGE`/`PYLONS` | Bridge / pylon | **Cầu + tĩnh không** — tàu chui lọt không | **B** |
| `CBLOHD` | Cable, overhead | **Dây điện trên không** — cột buồm chạm là chết cả tàu | **B** |

#### Nhóm F — Địa danh và nền

| Mã | Tên đầy đủ | Nghĩa với bà con | Mức |
|---|---|---|---|
| `COALNE`/`LNDARE` | Coastline / land area | Đường bờ, vùng đất, đảo | **B** |
| — | Đảo có tên | Nhận dạng, định hướng | — |
| `SEAARE` | Sea area (named) | Vịnh, eo, bãi cạn có tên | S |
| — | Rạn/bãi có tên | Gọi đúng tên chỗ đánh bắt | — |
| `LNDMRK` | Landmark | Mốc trên bờ dễ nhận: tháp, ống khói, đèn | S / O |
| `MAGVAR`/`LOCMAG` | Magnetic variation | **Độ lệch từ** — la bàn từ lệch bao nhiêu độ | O |

#### Nhóm G — Lớp động (không phải S-57 nhưng máy nào cũng có)

| Lớp | Mã S-57 gần nhất | Nghĩa với bà con |
|---|---|---|
| Gió, sóng, mưa, dông | — | Dự báo |
| Dòng chảy | `CURENT`, `TS_*` | Nước chảy hướng nào, mạnh bao nhiêu |
| **Thuỷ triều** | `T_HMON`, `T_NHMN`, `T_TIMS` | **Mực nước theo giờ** — quyết định qua cửa lạch được lúc nào |
| AIS | — | Tàu xung quanh, tránh đâm va |
| *Radar overlay* | — | *Ngoài phạm vi app điện thoại — không tính vào mẫu số* |

> **Lưu ý về máy tiêu dùng**: C-MAP và Navionics **không công bố** bảng ánh xạ
> layer của họ sang mã S-57. Họ chỉ công bố nhóm bật/tắt ở mức người dùng (độ
> sâu, phao–đèn, cáp, marina, trạm triều, contour). Nên **ánh xạ "layer thương
> mại ↔ mã S-57" là chưa xác nhận được từ nguồn chính thức** — bảng trên dựng
> theo chuẩn IHO, không theo catalogue của hãng.

---

## 3. VIỆC 2 — Đối chiếu từng lớp với SDFish

**✅ đủ** · **🟡 có một phần** · **❌ thiếu hẳn**.
Cột "VN" = số đối tượng trong dải bờ Việt Nam (§1).

### A. Độ sâu — 1 đủ · 1 một phần · 5 thiếu

| Lớp | | SDFish có gì (đếm 2026-08-29) |
|---|---|---|
| `DEPCNT` đường đẳng sâu | ✅ | `isobaths.v1.json` **5.110 tuyến, 9 mức**: 5 m=888 · 10 m=862 · 20 m=956 · 50 m=862 · 100 m=489 · 200 m=232 · 500 m=203 · 1000 m=282 · 2000 m=336. Tự sinh từ ETOPO 2022 bước 1/48° (~2,3 km), Douglas–Peucker. Có nhãn số mét, có nấc zoom theo mức. **Đây là lớp làm tốt nhất trong cả app** |
| `DEPARE` vùng độ sâu | 🟡 | `depth-grid.v1.bin` **17.057.881 ô** ETOPO 15″ (~450 m) — nhưng **nén còn 4 bậc** (đất / <4 m / <12 m / đủ sâu) và **không tô lên bản đồ**, chỉ dùng chặn tuyến + một dòng chữ khi chạm điểm |
| `SOUNDG` số độ sâu điểm | ❌ | Không có file nào chứa sounding |
| `DRGARE` đáy luồng | ❌ | 0 |
| `UNSARE` vùng chưa khảo sát | ❌ | 0 — app **không bao giờ nói "chỗ này tôi không biết"**. Trên ECDIS đây là lớp Display Base, tức không tắt được |
| `M_QUAL` mức tin cậy khảo sát (ZOC) | ❌ | 0 — không có trường nào nói dữ liệu đáng tin tới đâu |
| Safety contour bà con tự đặt | ❌ | Ngưỡng **cứng 4 m / 12 m** trong `src/lib/depth-grid.ts` |

### B. Hiểm hoạ — 0 đủ · 3 một phần · 3 thiếu

| Lớp | | SDFish có gì | VN |
|---|---|---|---|
| Rạn / bãi cạn | 🟡 | `reef-shapes.v1.json` **2.622 hình** (reef 2.345 · shoal 190 · rock 45 · wreck 42; 2.328 polygon · 207 line · 87 point) | **138** ven bờ (reef 102 · shoal 35 · wreck 1). **1.954 hình nằm ở Hoàng Sa/Trường Sa**, 177 ở Hồng Kông |
| `UWTROC` đá ngầm | 🟡 | kind=`rock` **45** điểm toàn khung | **0** ven bờ VN (5 ở HS/TS) |
| `WRECKS` xác tàu | 🟡 | kind=`wreck` **42** điểm | **1** ven bờ VN |
| `OBSTRN` chướng ngại, đáy bẩn | ❌ | Không có lớp riêng | — |
| `CTNARE` vùng thận trọng | ❌ | 0 | — |
| `SBDARE` chất đáy | ❌ | 0 — app không biết đáy là cát hay đá | — |

> Đọc kỹ hàng "đá ngầm": SDFish vừa ra lớp **"Đá ngầm · Rạn"** (commit
> `7cceeb7`), nhưng **toàn bộ đá ngầm ven bờ Việt Nam trong đó là con số 0** —
> 45 điểm `rock` nằm cả ở Hoàng Sa/Trường Sa và vùng biển nước khác. Cái nhãn
> hứa nhiều hơn cái dữ liệu.

### C. Báo hiệu — 0 đủ · 7 một phần · 4 thiếu

`seamarks.v1.json` có **5.851 báo hiệu, 21 loại**, **4.172 cái có mã đặc tính
đèn**. Phân bố:

| Vùng | Số báo hiệu | % |
|---|---|---|
| **Hồng Kông + cửa Châu Giang** (21,5–23,5°B / 113–115°Đ) | **2.942** | 50,3% |
| **Hải Nam** (18–21°B / 108–111,5°Đ) | **631** | 10,8% |
| **Dải bờ Việt Nam** | **474** | **8,1%** |
| Malaysia / Borneo | 171 | 2,9% |
| Philippines | 14 | 0,2% |
| Thái Lan | 9 | 0,2% |
| Còn lại (khơi, HS/TS, chưa phân) | 1.610 | 27,5% |

Trong 474 cái của Việt Nam, phân bố theo vĩ độ:

| Vĩ độ | 8° | 9° | 10° | 11° | 12° | 13° | 14° | 15° | 16° | 17° | 18° | 19° | **20°** | **21°** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Số báo hiệu | 4 | 7 | 61 | 14 | 5 | 8 | 7 | 11 | 8 | 16 | 3 | 4 | **108** | **218** |

**326/474 = 69% nằm ở 20–21°B** (Quảng Ninh – Hải Phòng – Móng Cái). Riêng phao
luồng: **113 trong 141 cái nằm ở 21°B**. Cả dải miền Trung từ Nghệ An tới Bình
Thuận — Cửa Lò, Cửa Việt, Đà Nẵng, Quy Nhơn, Nha Trang, Phan Thiết — có **2**
phao luồng.

| Lớp | | Toàn khung | VN |
|---|---|---|---|
| `BOYLAT` phao luồng | 🟡 | 1.868 | **141** (113 ở 21°B) |
| `BOYCAR` phao phương vị | 🟡 | 172 | **16** |
| `BOYSAW` phao nước an toàn ("số 0") | 🟡 | 34 | **1** |
| `BOYSPP` phao chuyên dùng | 🟡 | 612 | **23** |
| `BCN*` đăng tiêu (5 loại) | 🟡 | 237 | **27** — không có cái nào loại "nguy hiểm đơn lẻ" |
| `LIGHTS` đèn | 🟡 | 1.392 (đèn lớn 95 · đèn nhỏ 1.291 · phao đèn 6) | **104** (đèn lớn 10 · đèn nhỏ 94) |
| Virtual AtoN | 🟡 | 309 | **16** |
| `BOYISD` phao báo nguy hiểm đơn lẻ | ❌ | 41 | **0** |
| `DAYMAR`/`TOPMAR` chóp, dấu ban ngày | ❌ | `generate-seamarks.mjs` giữ đặc tính đèn, chu kỳ, tầm, màu thân — **không giữ topmark**. Ban ngày phao tắt đèn thì bà con không nhận được loại | 0 |
| `RTPBCN` racon | ❌ | 0 | 0 |
| `FOGSIG` còi, chuông sương mù | ❌ | 0 | 0 |

**Đo theo cảng cá** — cách nhìn sát bà con nhất. `src/data/fishing-ports.ts` có
172 mục, **138 mục có toạ độ** (34 mục không có toạ độ nào — đáng sửa riêng):

| Bán kính quanh cảng cá | Báo hiệu SDFish có | Cảng có ít nhất 1 báo hiệu |
|---|---|---|
| 20 km | **148** | **79 / 138 (57%)** |
| 50 km | **264** | 117 / 138 (85%) |

**43% cảng cá Việt Nam trong danh bạ của chính app không có một báo hiệu hàng
hải nào trong vòng 20 km.**

### D. Quy chế vùng biển — 1 đủ · 1 một phần · 10 thiếu

| Lớp | | SDFish có gì |
|---|---|---|
| `ADMARE`/`TESARE` ranh giới biển quốc gia | ✅ | `VN_MARITIME_BORDER` **75 điểm** + lớp `border-line` vẽ trên bản đồ, có cảnh báo khoảng cách khi tới gần. Lớp làm tốt nhất trong nhóm |
| Vùng khai thác NĐ 26/2019 + vùng VMS | 🟡 | `VUNG_LONG_POLYGON` **36 đỉnh** (chỉ vùng *lộng*, không có tuyến bờ, không có tuyến khơi) + `src/data/vms-zones.json` 4 lớp (được phép · cần chú ý · chỉ cá đáy · ranh ngoài khơi), cập nhật 2026-07-28 |
| `FAIRWY` luồng hàng hải | ❌ | kind=`luong` **25** đối tượng — **24 ở Hồng Kông, 1 ở Trường Sa. Việt Nam: 0** |
| `TSSLPT`/`TSEZNE` phân luồng | ❌ | kind=`phanluong` **108** — 90 ở Hồng Kông. **Việt Nam: 2** |
| `NAVLNE`/`RECTRC` trục luồng | ❌ | 0 |
| `RESARE` vùng cấm / hạn chế | ❌ | kind=`vungcam` **8** — **cả 8 ở Hồng Kông. Việt Nam: 0** |
| `ACHARE`/`ACHBRT` vùng neo đậu | ❌ | `anchorage` **112** toàn khung — **Việt Nam: 2** |
| `MIPARE` vùng quân sự | ❌ | 0 |
| `PRCARE` vùng đề phòng | ❌ | 0 |
| Khu bảo tồn biển | ❌ | 0 — không có file nào |
| Điểm tránh trú bão | ❌ | 0. `grep "tránh trú\|trú bão\|khu neo đậu"` trên toàn `src/` **không ra kết quả nào**. App có tin bão Biển Đông, có cron đẩy cảnh báo, có tính tuyến né sóng gió — **nhưng không nói chạy vào đâu** |
| `MARCUL` + `FSHFAC` lồng bè, đăng đáy | ❌ | `marine_farm` **136** toàn khung (116 ở Borneo, 20 ở Hồng Kông) — **Việt Nam: 0**. Đăng, đáy, nò, sáo: 0 |

### E. Hạ tầng — 1 đủ · 3 một phần · 3 thiếu

| Lớp | | SDFish có gì |
|---|---|---|
| `HRBFAC` cảng, bến | ✅ | `harbour` 279 điểm (VN 68) + `FISHING_PORTS` 172 mục, 115 `active`, 138 có toạ độ |
| `CBLSUB`/`PIPSOL` cáp, ống ngầm | 🟡 | kind=`cap` **103** — 76 Hồng Kông, 7 Philippines, 3 Hải Nam, 2 Malaysia. **Việt Nam: 1**. Vẽ màu tím riêng, nhưng gần như không có gì để vẽ ở VN |
| `MORFAC`/`PILPNT` trụ, phao buộc, cọc | 🟡 | `mooring` 349 toàn khung — **VN 5** |
| `SLCONS`/`BERTHS` kè, đê, cầu tàu | 🟡 | Có **hình học** trong nền PMTiles (Protomaps/OSM) nhưng **không có nhãn** — `buildMapStyle` lọc bỏ toàn bộ lớp `symbol` để chặn chữ Hán lọt vào. Bà con thấy hình cái đê mà không biết nó là gì |
| `OFSPLF` giàn khoan | ❌ | kind=`giankhoan` **41** — toàn bộ ở Quảng Đông / Hồng Kông / Hải Nam / Philippines. **Việt Nam: 0**, tức **thiếu hẳn cụm Bạch Hổ, Rồng, Đại Hùng, Rạng Đông** — vùng cấm 500 m quanh giàn mà tàu cá hay lảng vảng |
| `BRIDGE` cầu + tĩnh không | ❌ | 0 |
| `CBLOHD` dây điện trên không | ❌ | 0 — vào sông rạch mà cột buồm chạm dây điện là mất cả tàu |

### F. Địa danh và nền — 3 đủ · 2 một phần · 1 thiếu

| Lớp | | SDFish có gì |
|---|---|---|
| `COALNE`/`LNDARE` bờ, đất | ✅ | Nền vector PMTiles **z0–9, 16,88 MB**, khung 102–118°Đ / 4–24°B (đọc thẳng header PMTiles v3) + `vn-coast.v1.json` **526 polygon** Natural Earth 1:10m, giản lược 0,004° (~440 m), làm nền offline |
| Đảo tên Việt | ✅ | `vn-islands.v1.json` **103 đảo**, có `admin` (tỉnh), có `rank` để giãn nhãn theo zoom |
| `SEAARE` địa danh biển | ✅ | 5 nhãn chủ quyền (Vịnh Bắc Bộ, Biển Đông, Vịnh Thái Lan, Hoàng Sa, Trường Sa) + mask che nhãn quốc tế ở z≤8 |
| Rạn/bãi có tên Việt | 🟡 | `coral-reefs.v1.json` **13 cái** — toàn bộ ở Trường Sa (Cỏ Mây, Cỏ Rong, Ba Đầu, Ga Ven, Én Đất, Ken Nan, An Nhơn, Tư Chính, Phúc Tần, Phúc Nguyên, Huyền Trân, Quế Đường, Vũng Mây). **Không rạn ven bờ nào có tên** |
| `LNDMRK` mốc trên bờ | 🟡 | 107 toàn khung (chỉ giữ cái **có đèn**) — **VN 2** |
| `MAGVAR` độ lệch từ | ❌ | 0 |

### G. Lớp động — 2 đủ · 0 một phần · 2 thiếu

| Lớp | | SDFish có gì |
|---|---|---|
| Gió, sóng, mưa, dông, mây, áp suất | ✅ | Open-Meteo tới 16 ngày, đa nguồn (best_match + ECMWF IFS + GFS) + snapshot server. **Vượt xa máy hải đồ thường** |
| Dòng chảy | ✅ | Mặt (Open-Meteo SMOC theo giờ) + **4 tầng sâu 0/50/150/300 m** (Copernicus). Máy hải đồ tàu cá thường **không có** cái này |
| **Thuỷ triều — mực nước theo giờ** | ❌ | **0** trong mã đã commit. `grep` "triều/tide" trên `src/` chỉ ra tên cảng "Hồng Triều", "Triều Dương" và một chú thích về dòng chảy. Không trạm triều, không bảng thuỷ triều, không mực nước.<br>⚠️ **Đang có người làm**: lúc rà soát thấy `src/lib/tides.ts`, `scripts/generate-tides.mjs`, `public/data/tide-stations.v1.json` **chưa commit** trong cây làm việc. Không thuộc phạm vi bản này (chưa đọc, chưa đo) — nhưng nghĩa là **hàng này có thể đã lỗi thời khi bạn đọc**. Kiểm lại trước khi lấy làm căn cứ |
| AIS tàu xung quanh | ❌ | 0 |

---

## 4. VIỆC 3 — Tỷ lệ phủ đo được

**53 lớp chấm** (đã loại radar overlay vì ngoài phạm vi phần cứng điện thoại):

| Nhóm | Số lớp | ✅ đủ | 🟡 một phần | ❌ thiếu | Điểm phủ |
|---|---|---|---|---|---|
| A. Độ sâu | 7 | 1 | 1 | 5 | **21%** |
| B. Hiểm hoạ | 6 | 0 | 3 | 3 | **25%** |
| C. Báo hiệu | 11 | 0 | 7 | 4 | **32%** |
| D. Quy chế vùng biển | 12 | 1 | 1 | 10 | **13%** |
| E. Hạ tầng | 7 | 1 | 3 | 3 | **36%** |
| F. Địa danh, nền | 6 | 3 | 2 | 1 | **67%** |
| G. Lớp động | 4 | 2 | 0 | 2 | **50%** |
| **Tổng** | **53** | **8** | **17** | **28** | **31%** |

- **Đủ: 8/53 = 15%**
- **Có một phần: 17/53 = 32%**
- **Thiếu hẳn: 28/53 = 53%**
- **Điểm phủ có trọng số** (đủ = 1, một phần = 0,5): (8 + 8,5)/53 = **31%**

Đọc theo nhóm thì thấy rõ hình dạng lỗ hổng: **SDFish mạnh ở "nhìn vùng biển",
yếu ở "đi vào chỗ hẹp".** Càng gần bờ — càng gần chỗ tàu cá thật sự chết người
— độ phủ càng tụt. Nhóm cao nhất (địa danh, nền 67%) là nhóm *ít cứu mạng
nhất*; nhóm thấp nhất (quy chế vùng biển 13%) là nhóm quyết định bị phạt, bị
bắt, hay chạy vào đâu khi bão.

### Ba lớp thiếu nghiêm trọng nhất với tàu cá Việt Nam

#### 1. Số độ sâu luồng — `SOUNDG` + `DRGARE` + `UNSARE`

**Vì sao nghiêm trọng: app đang nói SAI về phía nguy hiểm.**

Dò thật `depth-grid.v1.bin` trên đường tiếp cận cửa Định An:

| Điểm dò | SDFish nói | Thông báo hàng hải nói |
|---|---|---|
| 9,45°B / 106,55°Đ | **"đủ sâu, trên 12 m"** | Đoạn cửa Định An (phao 0→16): **3,9 m** |
| 9,40°B / 106,60°Đ | **"đủ sâu, trên 12 m"** | như trên |
| 9,35°B / 106,70°Đ | **"đủ sâu, trên 12 m"** | Đoạn phao 16→21: **4,9 m** |

Chênh **hơn 7 mét**, và chênh về phía chết người: app bảo qua được, thực tế đáy
cách sống tàu chưa tới một mét lúc nước ròng. Nguyên nhân không phải lỗi lập
trình — **ETOPO 15″ là ô 450 m, không thể phân giải một luồng rộng 100 m**, mà
lại là luồng bồi lấp liên tục. Dữ liệu đúng theo nghĩa khoa học, sai theo nghĩa
đi biển.

Đây là lớp nghiêm trọng nhất vì nó là **lỗi im lặng**: bà con không thấy app
thiếu gì, chỉ thấy nó nói "đủ sâu". Trên ECDIS thật, chính vì vậy mà `UNSARE`
(vùng chưa khảo sát) được xếp vào **Display Base — không tắt được**: chuẩn
hàng hải coi việc *thú nhận không biết* quan trọng ngang việc *biết*.

#### 2. Phao tiêu luồng — `BOYLAT` + `BCNLAT` + `BOYSAW`

**Vì sao nghiêm trọng: đúng thứ máy hải đồ tồn tại để hiển thị — và trên ECDIS
là Display Base, không tắt được — thì SDFish không có ở đúng chỗ cần.**

- **0 / 118 phao** luồng Định An – Cần Thơ
- **0 / 120 phao và 0 / 45 đăng tiêu** luồng Hải Phòng
- **0 báo hiệu** trong bán kính 3 km quanh phao số "0" của luồng Hải Phòng —
  đếm ở cả hai toạ độ chính thức đang lưu hành
- **43% cảng cá** trong danh bạ app không có báo hiệu nào trong 20 km
- **0 phao báo nguy hiểm đơn lẻ** (`BOYISD`) trong toàn dải bờ Việt Nam

Vào lạch ban đêm hay lúc mù là việc tàu cá làm thường xuyên. Không có phao thì
màn hình chỉ còn cái bờ — bằng đúng không có máy.

#### 3. Thuỷ triều — mực nước theo giờ

**Vì sao nghiêm trọng: thiếu nó thì có số độ sâu cũng vô dụng.**

Độ sâu trên hải đồ tính từ "số 0 hải đồ" — mức nước thấp nhất. Cửa Định An sâu
3,9 m nghĩa là *3,9 m cộng mực triều lúc đó*. Biên độ triều vịnh Bắc Bộ tới
~4 m (nhật triều đều), cửa sông Hậu ~2,5–3,5 m (bán nhật triều không đều). Một
chiếc tàu mớn 2,5 m **qua được cửa Định An lúc nước lớn, mắc cạn lúc nước ròng**
— cùng một chỗ, cùng một ngày.

SDFish có gió 16 ngày, dòng chảy 4 tầng sâu, bản đồ cá theo mùa vụ — mà **không
có một con số mực nước nào**. Đây là lỗ hổng lệch nhất trong cả app: đầu tư rất
sâu vào thứ khó, bỏ trống thứ dễ hơn và cần hơn.

**Á quân (sát nút): vùng neo đậu + điểm tránh trú bão.** SDFish có tin bão, có
cron đẩy cảnh báo, có tính tuyến né sóng gió — nhưng có **2 vùng neo đậu** trong
toàn dải bờ Việt Nam và **không một điểm tránh trú bão nào**. Báo bão rồi không
chỉ chỗ trú là mới làm nửa việc. Xếp sau ba lớp trên chỉ vì nó lấp **rẻ nhất**
(danh mục khu neo đậu tránh trú bão cho tàu cá đã được Bộ công bố, chỉ cần nhập
bảng) — nên nó thuộc về "làm ngay", không thuộc về "nghiêm trọng khó gỡ".

---

## 5. VIỆC 4 — Kiểm chứng bằng hai cửa lạch có thật

### 5.1 Luồng hàng hải Định An – Cần Thơ (sông Hậu)

**Nhà nước công bố gì**

Sổ đăng ký tuyến luồng của **Cục Hàng hải Việt Nam** (`enc.vinamarine.gov.vn`,
tuyến ID=33 "Tuyến luồng Định An Cần Thơ"):

| | Dài | Rộng | Sâu | **Phao** | Tiêu |
|---|---|---|---|---|---|
| **Toàn tuyến Định An – Cần Thơ** | **130,6 km** | | | **118** | *(để trống)* |
| – Phao "0" → phao "14" | 15,9 km | 100 m | −4,0 m | | |
| – Phao "14" → bến cảng Cần Thơ | 103,1 km | 200 m | tự nhiên | | |
| – Bến cảng Cần Thơ → Vàm Rạch Ô Môn | 11,6 km | 100 m | tự nhiên | | |

Thông báo hàng hải gần đây (VMS-South / Cảng vụ hàng hải Cần Thơ) chia đoạn
khác và cho độ sâu cập nhật hơn:

| Đoạn | Chiều dài | Bề rộng | Độ sâu |
|---|---|---|---|
| Phao "0" → phao "16" (cửa Định An) | ~16,65 km | 100 m | **3,9 m** |
| Phao "16" → phao "21" | ~13,4 km | 200 m | **4,9 m** (sát biên phải luồng) |

Độ sâu đo bằng máy hồi âm 200 kHz, tính đến mực nước "số 0 hải đồ".

Một nguồn cũ hơn (Cảng An Giang, đăng 31-01-2018) **bóc tách chi tiết hệ phao**:
*"Phao hiệu: 100 (43 phao bên trái, 40 phao bên phải, 07 phao chuyển hướng
trái, 8 phao chuyển hướng phải, 01 phao đầu luồng, 01 phao chướng ngại vật)"* —
chiều dài luồng 112 km.

⚠️ **118 (Cục Hàng hải, không ghi ngày) vs 100 (Cảng An Giang, 2018)** — hai con
số vênh nhau, và bản ghi Cục Hàng hải chia đoạn "0→14" trong khi thông báo hàng
hải 2025–2026 nói "0→16" và "16→21", nên **bản ghi đó nhiều khả năng đã lạc
hậu so với hệ phao thực tế**. Dù lấy con số nào thì kết luận cũng không đổi.

**SDFish có gì** (đếm 2026-08-29):

| Phạm vi đếm | Số đối tượng | Chi tiết |
|---|---|---|
| Hành lang 5 km quanh trục luồng | **1** | 1 điểm cảng |
| Hành lang 10 km quanh trục luồng (9,30°B/106,75°Đ → Cần Thơ 10,03°B/105,78°Đ) | **3** | 1 điểm cảng, 2 mốc trên bờ |
| Hộp cửa Định An 9,40–9,80°B / 106,15–106,70°Đ | **4** | 2 cửa/âu tàu, 2 mốc trên bờ |
| Hộp rộng 9,20–10,10°B / 105,70–106,90°Đ | **5** | 2 cửa/âu, 2 mốc, 1 cảng |
| Đường đẳng sâu quanh cửa (9,2–9,9°B / 106,0–107,0°Đ) | 33 tuyến | 5 m=14 · 10 m=2 · 20 m=17 |

### **CHÊNH — Định An: 0 / 118. Thiếu 100%.**

*(Hay 0/100 nếu lấy con số 2018. Không phao, không tiêu, không đèn luồng nào.)*

### 5.2 Luồng hàng hải Hải Phòng (Lạch Huyện – Hà Nam – Bạch Đằng – Sông Cấm)

**Nhà nước công bố gì**

Sổ đăng ký tuyến luồng Cục Hàng hải (`enc.vinamarine.gov.vn`, tuyến ID=1) — số
liệu đầy đủ nhất tìm được, và **cộng khớp tuyệt đối theo 6 đoạn**:

| Đoạn | Dài | Rộng | Sâu TK | **Phao** | **Tiêu** |
|---|---|---|---|---|---|
| Lạch Huyện | 17,7 km | 100 m | −7,2 m | 30 | 4 |
| Kênh Hà Nam | 5,9 km | 80 m | −7,0 m | 13 | 14 |
| Bạch Đằng | 8,8 km | 80 m | −7,0 m | 21 | 6 |
| Sông Cấm | 10,6 km | 80 m | −5,5 m | 13 | 13 |
| Vật Cách | 9,7 km | 60 m | tự nhiên | 19 | 7 |
| Nam Triệu | 19,4 km | 100 m | −4,5 m | 24 | 1 |
| **Toàn tuyến 72,1 km** | | | | **120** | **45** |

Trang này còn có **bảng toạ độ từng báo hiệu** — bóc được **151 dòng** (tên báo
hiệu · vĩ độ · kinh độ · tác dụng · đặc tính ánh sáng), ví dụ nguyên văn:

```
Phao 0   | 20°41'19.1" | 106°59'37.5" | Báo hiệu đầu luồng               | Mo(0).10s
Phao 1   | 20°42'13.6" | 106°58'59.5" | Báo hiệu phía phải luồng         | Fl(1)G.3s
Phao 2   | 20°42'09.8" | 106°58'53.9" | Báo hiệu phía trái luồng         | Fl(1)R.3s
Phao 16  | 20°47'03.7" | 106°55'05.4" | BH hướng luồng chính chuyển phải | Fl(2+1)R.10s
Phao 91  | 20°53'57.1" | 106°37'16.2" | Báo hiệu phía phải luồng
```

Đối chiếu thêm hai nguồn:
- **HPG-164-2024** (thiết lập AIS trên báo hiệu luồng Hải Phòng): **71 phao +
  43 đăng tiêu đã gắn AIS**, phát 3 phút/lần, tầm 3 hải lý.
- **HPG-45-2024** / **HPG-93-2024** / VMRCC: Lạch Huyện sau nâng cấp HICT rộng
  **160 m**, sâu **12,5–13,2 m** (khác hẳn "100 m / −7,2 m" của bản ghi hành
  chính) — nên bảng Cục Hàng hải là **bản ghi có độ trễ**; con số phao/tiêu
  đáng tin về thứ tự độ lớn, không nên trình bày như "số hiện hành".

⚠️ **Hai toạ độ phao "0" khác nhau**: sổ tuyến luồng ghi **20°41'19,1"B –
106°59'37,5"Đ**, còn bản tóm tắt HPG-45-2024 ghi **20°48'11,3"B –
106°54'31,8"Đ**. Cách nhau ~15 km. Chưa đối chiếu được bản gốc để biết cái nào
hiện hành — **đã đếm SDFish ở cả hai điểm**, kết quả không đổi.

**SDFish có gì** (đếm 2026-08-29):

| Phạm vi đếm | Số đối tượng | Chi tiết |
|---|---|---|
| **3 km quanh phao "0"** (toạ độ sổ tuyến luồng) | **0** | — |
| **3 km quanh phao "0"** (toạ độ HPG-45-2024) | **0** | — |
| 10 km quanh phao "0" (sổ tuyến luồng) | **12** | 4 tiêu mép luồng + 7 tiêu chuyên dùng + 1 cảng — **0 phao**; và cụm này nằm quanh **cầu Tân Vũ – Lạch Huyện**, không phải hệ phao luồng |
| 15 km quanh phao "0" (HPG-45-2024) | **0** | — |
| 3 km quanh **phao "91"** (cuối luồng) | **0** | — |
| Hành lang 10 km quanh trục luồng | **7** | cả 7 là điểm cảng — **0 phao, 0 tiêu** |
| Hộp rộng 20,50–21,10°B / 106,50–107,30°Đ, bỏ điểm cảng | **20** | 18 tiêu cụm cầu Tân Vũ – Lạch Huyện + 2 phao luồng ở 20,85°B/107,07°Đ (khu Hạ Long, ngoài luồng) |
| Đường đẳng sâu quanh vùng | 51 tuyến | 5 m=24 · 10 m=16 · 20 m=11 |

### **CHÊNH — Hải Phòng: 0 / 120 phao và 0 / 45 tiêu. Thiếu 100%.**

*(18 đăng tiêu SDFish có trong vùng là mốc quanh cầu vượt biển, không phải báo
hiệu luồng — không cái nào nằm trong danh sách 151 báo hiệu của Cục Hàng hải.)*

Đáng chú ý về **độ sâu**: dò `depth-grid.v1.bin` tại phao "0" Hải Phòng ra
*"nước nông, cỡ 4–12 m"* — trong khi Lạch Huyện nay sâu 12,5–13,2 m. Ở Định An
thì ngược lại: app nói "đủ sâu trên 12 m" ở chỗ thật ra 3,9 m. **Sai cả hai
chiều, ở hai cửa lạch khác nhau, cùng một bộ dữ liệu.** Đó chính là lý do phải
có lớp "chưa khảo sát / không đủ tin" thay vì một con số duy nhất — không thể
nói "ETOPO sai" hay "ETOPO đúng" một cách chung chung.

### 5.3 Vì sao lệch đến thế — không phải lỗi của script

`generate-seamarks.mjs` kéo OpenStreetMap qua Overpass, tag `seamark:*`. Script
làm đúng việc của nó. **Lỗ hổng nằm ở nguồn.**

Đo độc lập bằng Overpass (bản OSM 2026-08-29T13:51Z), truy vấn thẳng vào hai
hành lang luồng:

| Vùng | Node `seamark:type` | **Phao/tiêu** (`buoy_*` + `beacon_*`) |
|---|---|---|
| Hành lang Định An → Cần Thơ (9,2–10,2°B / 105,6–106,6°Đ) | 12 | **0** |
| Định An mở rộng (9,0–10,3°B / 105,5–107,0°Đ) | 111 | **0** — 104 cái là `landmark` ven bờ (bến phà, xưởng đóng tàu, cống) |
| Hành lang Lạch Huyện + Hà Nam + Bạch Đằng | 6 | **~0** |
| Hải Phòng mở rộng | 29 | 18 — **đều không có tên, đều tụm ở khu Cát Bà, không nằm trên trục luồng** |
| **Toàn Việt Nam** (ranh hành chính) | 396 | **68** |
| Ven biển miền Trung (12–18°B / 108–110°Đ) | — | **2** |
| *(đối chứng)* **Hải Nam – Trung Quốc** | — | **232** |
| *(đối chứng)* Thái Lan | — | 27 |

Nghĩa là: **0/118 phao Định An và ~0/120 phao Hải Phòng được map trên OSM.**
Không phải SDFish bỏ sót — **OpenStreetMap chưa có.** Trang theo dõi độ phủ của
OpenSeaMap chỉ liệt kê Argentina, Brazil, Paraguay, Đức, Hà Lan, Thuỵ Điển —
**không nhắc Việt Nam hay Đông Nam Á**; không tìm thấy nghiên cứu hay thảo luận
nào về độ phủ seamark ở Việt Nam.

*(Con số "68 phao/tiêu toàn VN" của phép đo Overpass thấp hơn 208 cái tôi đếm
trong `seamarks.v1.json` vì phép đo đó cắt theo **ranh hành chính đất liền**,
loại phần biển; còn hộp của tôi gồm cả vùng nước và dính một ít Campuchia. Hai
cách đo khác nhau, cùng một kết luận: rất mỏng.)*

**Báo hiệu hàng hải Việt Nam có công bố chính thức** — nhưng dưới dạng văn bản
thông báo hàng hải và bảng HTML trên trang Cục Hàng hải, **không phải dữ liệu mở
tải về được**. SDFish không thiếu vì làm ẩu, mà vì **đã lấy hết những gì nguồn
mở có, và nguồn mở ở Việt Nam thì trống**.

### 5.4 Tin tốt tìm được trong lúc kiểm chứng

`enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=<n>` là **bảng HTML công khai,
không cần đăng nhập, có toạ độ từng phao kèm tác dụng và đặc tính ánh sáng** —
đúng khuôn dữ liệu `seamarks.v1.json` đang dùng (loại · toạ độ · đặc tính chớp ·
chu kỳ). Luồng Hải Phòng có đủ 151 dòng. **Đây là nguồn khả thi duy nhất tra
được cho lớp phao Việt Nam** — xem §6 và §7.

Hai lưu ý trước khi dùng: (a) chứng thư SSL của site lỗi, phải xử lý riêng;
(b) trang **không ghi ngày cập nhật** và có dấu hiệu lạc hậu (thông số Lạch
Huyện đã cũ), nên phải hiển thị kèm câu *"tham khảo, đối chiếu thông báo hàng
hải"* — không được trình bày như số hiện hành. Luồng Định An **không có** bảng
toạ độ này (đã kiểm: trang không chứa một ký tự `°` nào).

---

## 6. Lấp từng chỗ thiếu bằng gì

| Chỗ thiếu | Nguồn lấp được | Giấy phép | Công |
|---|---|---|---|
| **Phao tiêu luồng VN** | ⭐ **`enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=<n>`** — bảng HTML công khai của Cục Hàng hải, **có toạ độ từng phao + tác dụng + đặc tính ánh sáng**. Luồng Hải Phòng: 151 dòng bóc được | Trang nhà nước công khai, không đăng nhập | **Thấp–trung bình** — đây là phát hiện đáng giá nhất của đợt rà soát. Viết bộ bóc bảng một lần, chạy cho mọi tuyến luồng có bảng. ⚠️ SSL lỗi; trang **không ghi ngày cập nhật** và có dấu hiệu lạc hậu ⇒ phải hiển thị kèm "tham khảo, đối chiếu thông báo hàng hải" |
| | Thông báo hàng hải VMS (`vmsa.vn`) cho luồng **không có bảng ENC** (vd Định An) | Văn bản nhà nước công khai | **Cao** — nhiều TBHH là **PDF ảnh scan, không có lớp text**, phải OCR hoặc nhập tay; và phải nuôi vì phao đổi liên tục |
| | Đóng góp ngược lên OpenStreetMap rồi kéo về như hiện tại | ODbL | Trung bình, lợi lâu dài nhưng chậm. **Đo thật: OSM hiện có 0/118 phao Định An, ~0/120 phao Hải Phòng** |
| **Số độ sâu luồng** | Thông báo hàng hải "thông số kỹ thuật độ sâu luồng" — mỗi luồng có bảng độ sâu từng đoạn, cập nhật hằng tháng | Công bố công khai | Trung bình. **Không cần sounding từng điểm** — chỉ cần *"cửa Định An: 3,9 m, cập nhật 8/2026"* là đã hơn hẳn "đủ sâu" |
| **Thuỷ triều** | Bảng thuỷ triều Trung tâm Hải văn; hoặc mô hình điều hoà toàn cầu **FES2014 / TPXO** (hệ số điều hoà, tính offline được, không cần mạng) | FES2014 dùng được phi thương mại — **phải kiểm điều khoản trước khi nhúng vào app thương mại**; TPXO cần đăng ký | Trung bình. Ưu điểm lớn: tính **hoàn toàn offline** từ hệ số, hợp app đi biển mất sóng |
| **Vùng neo đậu, tránh trú bão** | Danh mục **khu neo đậu tránh trú bão cho tàu cá** do Bộ Nông nghiệp công bố (quy hoạch hệ thống cảng cá và khu neo đậu tránh trú bão) | Văn bản nhà nước | **Thấp** — bảng vài chục dòng, nhập một lần. Việc rẻ nhất trong bảng này |
| **Khu bảo tồn biển** | Danh mục 16 khu bảo tồn biển VN (quyết định Thủ tướng) + WDPA / `protectedplanet.net` có ranh giới GIS | WDPA dùng được, có điều kiện ghi nguồn | Thấp–trung bình |
| **Vùng cấm, vùng quân sự** | Thông báo hàng hải mục "thiết lập phao báo hiệu vùng nước quân sự" (ví dụ vịnh Cam Ranh) | Công bố công khai | Trung bình, rải rác nhiều thông báo |
| **Lồng bè, bãi nuôi (`MARCUL`)** | OSM `seamark:type=marine_farm` (đang 0 ở VN) + đối chiếu ảnh Sentinel-2 — lồng bè nhìn rõ từ ảnh | ODbL / Copernicus mở | Cao nếu tự dò ảnh; thấp nếu chỉ nhập vài vùng lớn (Vân Đồn, Cát Bà, Vũng Rô, Cam Ranh, Phú Quốc) |
| **Giàn khoan VN (`OFSPLF`)** | OSM (thiếu) + danh mục công trình dầu khí PVN + **ảnh Sentinel-1 radar** (giàn khoan là điểm sáng cố định) | Copernicus mở | Trung bình. Vùng cấm 500 m quanh giàn là luật, đáng làm |
| **Độ lệch từ (`MAGVAR`)** | Mô hình **WMM (World Magnetic Model)** của NOAA/NGA — công thức, tính offline | Public domain | **Rất thấp** — vài chục dòng code, không cần dữ liệu |
| **Chất đáy (`SBDARE`)** | Không có nguồn mở phủ VN ở độ phân giải dùng được | — | **Không lấp được bằng nguồn mở** |
| **Số độ sâu điểm ngoài luồng (`SOUNDG`)** | Không có nguồn mở phủ VN. NOAA ENC chỉ phủ Mỹ; EMODnet contour chỉ phủ châu Âu (đã dò 2026-06-10, ghi ở `docs/research/09-nautical-map-sources.md`) | — | **Không lấp được**. Đường đẳng sâu tự sinh từ ETOPO là thứ tốt nhất làm được |
| **AIS tàu xung quanh** | Cần thiết bị AIS trên tàu; nguồn web (AISHub, MarineTraffic) không phủ ngoài khơi và giấy phép chặt | — | Ngoài phạm vi |

---

## 7. Thứ tự nên làm

Xếp theo **(cứu mạng bao nhiêu) ÷ (tốn bao nhiêu công)**, không theo thứ tự lớp.

### Bậc 1 — nói thật, làm được ngay, gần như không tốn gì

1. **Ngừng nói "đủ sâu"** ở chỗ ETOPO không đủ phân giải. Ven bờ và trong cửa
   lạch, lưới 450 m không biết gì về luồng rộng 100 m. Đổi câu chữ thành *"gần
   bờ — số độ sâu này không đủ tin để vào lạch, xem thông báo hàng hải"*. Đây
   chính là lớp `UNSARE` của hải đồ thật — lớp **Display Base, không tắt được**
   — và nó **không tốn một byte dữ liệu nào**. Việc nghiêm trọng nhất trong cả
   danh sách này lại là việc rẻ nhất.
2. **Safety depth bà con tự đặt** — thay ngưỡng cứng 4/12 m bằng mớn tàu bà con
   nhập, rồi tô rạn/đá/xác tàu nông hơn mớn bằng màu cảnh báo (đúng cơ chế
   `OBSTRN04`/`WRECKS02` của S-52, xem §2.1). Việc trong app, không cần nguồn
   ngoài, mà biến lớp độ sâu **đang có sẵn** thành thứ dùng được thật.
3. **Đổi tên `vn-sea-lanes.v1.json`** hoặc lọc bỏ phần Hồng Kông. Hiện app vẽ
   luồng, phân luồng, vùng cấm, cáp ngầm và giàn khoan của Hồng Kông lên bản đồ
   cho ngư dân Việt Nam. Vô hại về an toàn nhưng làm bà con tưởng app có dữ
   liệu luồng — rồi tới cửa lạch thật thì trống.
4. **`MAGVAR` bằng công thức WMM** — vài chục dòng, không cần dữ liệu, không cần
   mạng.
5. **Bổ sung toạ độ cho 34 cảng cá còn thiếu** trong `fishing-ports.ts`.

### Bậc 2 — rẻ, lấp lỗ hổng lớn

6. **Khu neo đậu tránh trú bão** — nhập bảng từ danh mục Bộ Nông nghiệp. App đã
   có cảnh báo bão; thêm bảng này là cảnh báo mới trọn vẹn.
7. **Bảng độ sâu luồng theo cửa lạch** — không cần sounding từng điểm, chỉ một
   con số cho mỗi cửa kèm ngày cập nhật, bóc từ thông báo hàng hải. Bắt đầu
   bằng ~20 cửa đông tàu cá nhất.
8. ⭐ **Bóc bảng báo hiệu từ `enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx`** —
   bảng HTML công khai, có toạ độ + tác dụng + đặc tính ánh sáng từng phao, đúng
   khuôn `seamarks.v1.json` đang dùng. Riêng luồng Hải Phòng đã là **151 báo
   hiệu** — nhiều hơn *toàn bộ* 141 phao luồng mà app đang có trên cả nước.
   **Đây là việc có tỷ lệ lợi/công tốt nhất trong cả danh sách**: một bộ bóc
   bảng, chạy cho mọi tuyến luồng có dữ liệu, ra ngay lớp phao thật cho các cửa
   lớn. Bắt buộc kèm nhãn *"tham khảo, đối chiếu thông báo hàng hải"* vì trang
   không ghi ngày cập nhật và có dấu hiệu lạc hậu.

### Bậc 3 — đáng làm, tốn công hơn

9. **Thuỷ triều offline** từ hệ số điều hoà (FES2014/TPXO — **kiểm giấy phép
   trước**). Đắt thứ hai nhưng đổi lại nhiều nhất: có triều thì mọi con số độ
   sâu mới dùng được. ⚠️ **Có người đang làm rồi** — thấy `src/lib/tides.ts` +
   `public/data/tide-stations.v1.json` chưa commit trong cây làm việc lúc rà
   soát. Đừng khởi động trùng; hỏi trước.
10. **Phao tiêu những cửa lạch không có bảng ENC** (Định An là một), bóc từ
    thông báo hàng hải. Đắt vì nhiều TBHH là PDF ảnh scan phải OCR, và phải
    nuôi. Làm dần theo cửa, đừng chờ đủ.
11. **Khu bảo tồn biển + vùng cấm/quân sự + giàn khoan VN** — thuộc trục 4 (tuân
    thủ) hơn trục 1, nhưng vẽ chung trên bản đồ.

### Không nên làm

- Đừng đuổi theo `SOUNDG` đầy đủ hay `SBDARE`. Không có nguồn mở, và mua license
  (Navionics/C-MAP) thì mâu thuẫn với mô hình app.
- Đừng mở rộng `seamarks.v1.json` bằng cách kéo khung rộng hơn — vấn đề không
  phải số lượng mà là **OSM chưa map Việt Nam**. Kéo rộng chỉ thêm Hồng Kông.

---

## 8. Những chỗ không đo được

Ghi ra để lần sau không ai tưởng đã đo:

- **Số phao Định An theo thông báo hàng hải *hiện hành***. Có 118 (sổ tuyến
  luồng Cục Hàng hải, **không ghi ngày**) và 100 (Cảng An Giang, 31-01-2018).
  Thông báo mới nhất tìm được — **212/TBHH-CVHHCT ngày 16-6-2026** (đoạn phao
  "0"→"16") — chỉ có bản **PDF ảnh scan, không có lớp text**, không OCR được.
- **Toạ độ từng phao luồng Định An**. Trang sổ tuyến luồng ID=33 **không chứa
  một toạ độ nào** (khác hẳn trang Hải Phòng). Phần Định An vì vậy dùng trục
  luồng ước lượng từ vị trí cửa sông; con số "0 phao" của SDFish không đổi dù
  dịch trục vài km, vì trong cả hộp rộng 9,2–10,1°B / 105,7–106,9°Đ chỉ có 5 đối
  tượng và không cái nào là phao.
- **Toạ độ phao "0" luồng Hải Phòng nào là hiện hành**. Sổ tuyến luồng ghi
  20°41'19,1"B – 106°59'37,5"Đ; bản tóm tắt HPG-45-2024 ghi 20°48'11,3"B –
  106°54'31,8"Đ. Cách nhau ~15 km, chưa đối chiếu được bản gốc. Đã đếm SDFish ở
  **cả hai** — kết quả 0 ở cả hai.
- **Ngày cập nhật của sổ tuyến luồng Cục Hàng hải** (cả hai luồng). Trang không
  ghi, và có dấu hiệu lạc hậu: ghi Lạch Huyện rộng 100 m / −7,2 m trong khi
  thông báo hàng hải nói 160 m / 12,5–13,2 m sau nâng cấp HICT.
- **Độ sâu Định An 3,9 m / 4,9 m** lấy qua trích dẫn tìm kiếm (trang gốc
  `vms-south.vn` timeout DNS) — **chưa xác nhận trên trang gốc**. Coi là số tham
  khảo, phải kiểm lại trước khi đưa vào app.
- **Mức hiển thị S-52 của từng lớp** trong §2.2 lấy theo Presentation Library
  **Ed 3.2 (2000)**. Bản hiện hành là **Ed 4.0.3** — nên đối chiếu lại trước khi
  dùng làm căn cứ chính thức.
- **Ánh xạ layer của C-MAP / Navionics sang mã S-57**. Hai hãng không công bố.
- **Độ chính xác vị trí** của 474 báo hiệu VN trong `seamarks.v1.json`. Toạ độ
  làm tròn 5 số (~1 m) nhưng đó là độ chính xác *lưu trữ*, không phải *thực
  địa*; OSM không có trường sai số.
- **Bao nhiêu trong 474 báo hiệu VN còn tồn tại thật**. Phao trôi, bị chấm dứt
  hoạt động, bị đổi số — thông báo hàng hải cập nhật, OSM thì không.

---

## 9. Nguồn

**Chuẩn hải đồ** (truy cập 2026-08-29)

- [IHO S-57 Appendix A — Object Catalogue Ed 3.1](https://iho.int/uploads/user/pubs/standards/s-57/31ApAch1.pdf) — 163 lớp đối tượng
- [IHO S-57 Appendix B.1 Annex A — Use of the Object Catalogue for ENC Ed 4.3.0](https://iho.int/uploads/user/pubs/standards/s-57/S-57%20Appendix%20B.1%20Annex%20A_UOC_Ed%204.3.0_Final.pdf)
- [IHO S-52 Ed 6.1.1 (6/2015) — Chart content and display aspects of ECDIS](https://iho.int/uploads/user/pubs/standards/s-52/S-52%20Edition%206.1.1%20-%20June%202015.pdf)
- [IHO S-52 Presentation Library Ed 4.0.3 Part I Addendum](https://iho.int/uploads/user/pubs/standards/s-52/S-52%20PresLib%20Ed%204.0.3%20Part%20I%20Addendum_Clean.pdf)
- [IMO Res. MSC.232(82) Appendix 2 — SENC Information Available for Display](https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/MSCResolutions/MSC.232(82).pdf) — định nghĩa ba mức Display Base / Standard / Other
- [IHO ENCWG4 — S-52 Issues with OBSTRN (2019)](https://iho.int/uploads/user/Services%20and%20Standards/ENCWG/ENCWG4/ENCWG4_2019_05.28_EN_S-52_Issues_with_OBSTRN_V1.pdf)
- [IHO TSMAD24/DIPWG4-09.9B — Setting safety depth and safety contours in ECDIS](https://legacy.iho.int/mtg_docs/com_wg/DIPWG/DIPWG4/TSMAD24-DIPWG4-09.9B_Setting_Safety_Depth_and_Safety_Contours_in_ECDIS.pdf) — nguồn cho khẳng định "số độ sâu điểm thuộc mức Other Display"
- [IHO S-101 ENC Product Specification 1.1.0](https://iho.int/uploads/user/Services%20and%20Standards/S-100WG/S-100WG7/S-101%20ENC_Product_Specification_1.1.0.20221208_Clean.pdf) — chuẩn kế tiếp, vẫn giữ ba mức hiển thị
- [GDAL — S-57 driver docs](https://gdal.org/drivers/vector/s57.html) · [MapServer — S-57 driver](https://mapserver.org/input/vector/S57.html) · [Australian Use of the Object Catalogue (AUOC)](https://hydro.gov.au/prodserv/important-info/SPEC_05_55_AA34159_AUOC.pdf)

**Thông báo hàng hải Việt Nam** (truy cập 2026-08-29)

- ⭐ [**Sổ tuyến luồng Hải Phòng — Cục Hàng hải VN (ENC ID=1)**](https://enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=1) — 72,1 km, 6 đoạn, **120 phao + 45 tiêu**, kèm **bảng toạ độ 151 báo hiệu**. *(SSL lỗi, không ghi ngày cập nhật)*
- ⭐ [**Sổ tuyến luồng Định An – Cần Thơ — Cục Hàng hải VN (ENC ID=33)**](https://enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=33) — 130,6 km, **118 phao**, **không có bảng toạ độ**
- [VMSA — Thông số kỹ thuật luồng hàng hải Hải Phòng (HPG-45-2024)](https://vmsa.vn/thong-bao-hang-hai-247/hai-phong-253/ve-thong-so-ky-thuat-luong-hang-hai-hai-phong-11346-2.html) — 5 đoạn luồng, toạ độ phao "0", số phao 0→93
- [VMSA — HPG-164-2024: thiết lập AIS trên phao và đăng tiêu luồng Hải Phòng](https://vmsa.vn/thong-bao-hang-hai-247/hai-phong-253/ve-viec-thiet-lap-moi-bao-hieu-hang-hai-ais-tren-cac-phao-dang-tieu-bao-hieu-luong-hang-hai-hai-phong-11867-2.html) — **71 phao + 43 đăng tiêu** có AIS
- [VMSA — TBHH 212/TBHH-CVHHCT ngày 16-6-2026, Định An – Sông Hậu phao "0"→"16"](https://vmsa.vn/thong-bao-hang-hai-247/can-tho-459/ve-thong-so-ky-thuat-cua-luong-hang-hai-dinh-an-song-hau-doan-tu-phao-bao-hieu-hang-hai-so-0-den-phao-bao-hieu-hang-hai-so-16--13573-2.html) — *bản scan ảnh, không đọc được nội dung*
- [Cảng An Giang — Giới thiệu luồng Định An (31-01-2018)](https://angiangport.com.vn/thong-tin-luong/gioi-thieu-luong-dinh-an) — bóc tách hệ phao: 100 phao (43 trái · 40 phải · 7 chuyển hướng trái · 8 chuyển hướng phải · 1 đầu luồng · 1 chướng ngại vật)
- [VMRCC — Luồng hàng hải Hải Phòng (HPG-65-2021)](https://vmrcc.gov.vn/thong-tin-luong-lach-va-dong-chay-theo-mua/luong-hang-hai-hai-phong-727.html)
- [VMSA — Thông số kỹ thuật đoạn luồng Kênh Hà Nam và Sông Cấm](https://vmsa.vn/thong-bao-hang-hai-247/hai-phong-253/ve-thong-so-ky-thuat-cua-doan-luong-kenh-ha-nam-va-song-cam-luong-hang-hai-hai-phong-11591-2.html)
- [Cảng vụ hàng hải Hải Phòng — chấm dứt hoạt động phao số 24 đoạn Lạch Huyện](https://cangvuhaiphong.gov.vn/thong-bao-hang-hai-ve-viec-cham-dut-hoat-dong-phao-bao-hieu-so-24-doan-lach-huyen-luong-hang-hai-hai-phong/)
- [VMS-South — Thông số kỹ thuật luồng Định An – Sông Hậu, phao "0" → phao "21"](https://www.vms-south.vn/thong-bao-hang-hai/thong-bao/ve-thong-so-ky-thuat-cua-luong-hang-hai-dinh-an-song-hau-doan-tu-phao-bao-hieu-hang-hai-so-0-den-phao-bao-hieu-hang-hai-so-21-2) *(trang timeout lúc tra — số liệu qua trích dẫn tìm kiếm)*
- [VMS-South — Độ sâu luồng Định An – Sông Hậu, phao "21" → rạch Gòi Lớn](https://www.vms-south.vn/thong-bao-hang-hai/thong-bao/ve-thong-so-ky-thuat-do-sau-luong-hang-hai-dinh-an-song-hau-doan-luong-tu-phao-bao-hieu-hang-hai-so-21-den-rach-goi-lon)
- [Cục Hàng hải và Đường thuỷ Việt Nam — Thông báo hàng hải](https://vimawa.gov.vn/vi/thong-bao-hang-hai) · [VMSA — Hệ thống luồng hàng hải](https://vmsa.vn/bao-hieu-hang-hai-249/luong-hang-hai-287) · [Danh mục TBHH Cần Thơ](https://vmsa.vn/thong-bao-hang-hai-247/can-tho-459)

**Độ phủ OpenSeaMap / OpenStreetMap ở Việt Nam** (đo qua Overpass, bản OSM
2026-08-29T13:51Z)

- [OpenSeaMap/coverage — OSM Wiki](https://wiki.openstreetmap.org/wiki/OpenSeaMap/coverage) — theo dõi Argentina, Brazil, Paraguay, Đức, Hà Lan, Thuỵ Điển; **không nhắc Việt Nam hay Đông Nam Á**
- [Vietnam Mapping Guide — OSM Wiki](https://wiki.openstreetmap.org/wiki/Vietnam_Mapping_Guide) · [OpenSeaMap FAQ](https://www.openseamap.org/index.php?id=faq&L=1)

**Trong repo** (đếm 2026-08-29)

- `public/data/` — `seamarks.v1.json` (184 KB) · `reef-shapes.v1.json` (765 KB) · `isobaths.v1.json` (1.303 KB) · `depth-grid.v1.bin` (4.165 KB) · `vn-sea-lanes.v1.json` (78 KB) · `vn-islands.v1.json` (18 KB) · `vn-coast.v1.json` (215 KB) · `coral-reefs.v1.json` (3 KB) · `vn-basemap.pmtiles` (16.486 KB)
- `src/data/` — `vms-zones.json` · `fishing-ports.ts` · `vn-maritime-border.ts` · `vn-fishing-zones.ts`
- `src/lib/ocean-map.ts` (`buildMapStyle`) · `src/lib/depth-grid.ts` · `src/lib/seamarks.ts` · `src/components/fishing-map-view.tsx`
- `scripts/generate-seamarks.mjs` · `generate-reef-shapes.mjs` · `generate-sea-lanes.mjs` · `generate-isobaths.mjs` · `generate-depth-grid.mjs` · `generate-coastline.mjs`
- Nghiên cứu trước: [`09-nautical-map-sources.md`](09-nautical-map-sources.md) (2026-06-10) — đã kết luận không có nguồn mở cho sounding và contour nông phủ VN. Bản này **xác nhận lại** kết luận đó, và bổ sung: contour nông **đã tự sinh được** từ ETOPO (5/10/20 m), còn sounding thì vẫn trống.
