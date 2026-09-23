# Cáp/ống ngầm Việt Nam — lấp hạng mục #12 (2026-09)

> Trạng thái trước: `vn-sea-lanes.v1.json` chỉ có vài cáp OSM quanh Hồng Kông/
> Quảng Đông + hai way OSM thô (thực chất là FEA/SJC) không mang tên VN. Báo cáo
> cũ kết luận "không nguồn mở" là **kết luận vội**. Việt Nam có nhiều tuyến cáp
> quang biển quốc tế cập bờ THẬT — thông tin công khai.

## Kết quả

Thêm **10 điểm cập bờ** cáp quang biển quốc tế cập bờ VN vào
`public/data/vn-sea-lanes.v1.json` (`kind=cap`, `src=cap-vn`, tên tiếng Việt),
phân theo 3 trạm cập bờ THẬT:

| Trạm cập bờ | Toạ độ (lon,lat) | Cáp |
|---|---|---|
| Vũng Tàu | 107.0792, 10.3418 | AAG · AAE-1 · Liên Á (IA/TGN-IA) · VTS · MViSTA |
| Đà Nẵng | 108.2147, 16.0516 | APG · ALC · SMW-3 |
| Quy Nhơn | 109.2197, 13.7820 | ADC · SJC2 |

## Vì sao là ĐIỂM CẬP BỜ, không phải TUYẾN

Luật cứng của hạng mục: **tuyến/vị trí từ nguồn, KHÔNG bịa hình học**; nếu chỉ
biết điểm cập bờ mà không có tuyến sạch bản quyền → vẽ điểm cập bờ.

- **TeleGeography (submarinecablemap.com)** — có hình học tuyến đầy đủ cho cả 10
  cáp, NHƯNG giấy phép **CC BY-NC-SA 3.0**:
  - *ShareAlike (copyleft)* là ràng buộc lên cơ sở dữ liệu → repo CHỦ ĐỘNG TRÁNH
    (CLAUDE.md §"Nguồn dữ liệu": xếp cùng nhóm với share-alike ODbL của OSM).
  - *NonCommercial* đụng đúng mô hình kinh doanh của họ (họ bán bản quyền dữ
    liệu này). SDFish là sản phẩm thương mại → không nhúng hình học của họ.
  - → dùng TeleGeography **chỉ làm MANH MỐI**: danh sách cáp cập bờ VN + toạ độ
    trạm cập bờ. Đây là **sự thật địa lý công khai, KHÔNG bản quyền** (một trạm
    cập bờ có thật ở một chỗ có thật). KHÔNG copy đường tuyến (biểu đạt bản đồ
    của họ mới là cái được bảo hộ).
- **OSM** — KHÔNG map các cáp này. `seamark:type=cable_submarine` có tên trong cả
  vùng Á-ĐNÁ chỉ trả về vài cáp quanh HK/Đài Loan (I2i, TKO Express…) + "FLAG
  Europe-Asia" và "Southeast Asia-Japan Cable". "FLAG Europe-Asia" của OSM **KHÔNG
  chạm Đà Nẵng** (đỉnh gần nhất cách 509 km — chỉ có đoạn HK→Thái Lan). Không có
  hình tuyến VN dùng được.
- Danh sách per-cable của TeleGeography liệt kê trạm cập bờ theo **thứ tự abc**,
  KHÔNG theo thứ tự tuyến → không thể dựng lại polyline hợp lý từ các trạm mà
  không đoán thứ tự = bịa. Nên dừng ở điểm cập bờ.

**Mã hoá hình học**: bất biến của file (islands.test.ts) là "cap = LineString
≥2 đỉnh; chỉ giàn khoan mới là Point". Điểm cập bờ vì thế mã hoá thành
**LineString độ-dài-0**: hai đỉnh TRÙNG nhau tại toạ độ trạm cập bờ THẬT. Không
bịa thêm đỉnh nào — cả hai đỉnh đều là sự thật. Lớp `sea-lane-cap` (line-cap:
round) vẽ nó thành một chấm nhỏ tại điểm cập bờ, dùng đúng renderer hiện có,
KHÔNG cần đụng `fishing-map-view`. Nếu muốn chấm to/nhãn rõ hơn thì đội sở hữu
`fishing-map-view` thêm layer riêng — ngoài phạm vi hạng mục này.

## Verify từng tuyến (≥2 nguồn độc lập)

| Cáp | Trạm | Nguồn 1 | Nguồn 2 | Ghi chú |
|---|---|---|---|---|
| AAG (Asia-America Gateway) | Vũng Tàu | TeleGeography (landing: Vung Tau) | submarinenetworks — Vietnam/Vung Tau | RFS 2009 |
| AAE-1 (Asia-Africa-Europe-1) | Vũng Tàu | TeleGeography | submarinenetworks; vietnamnet (sự cố AAE-1) | RFS 2017 |
| Liên Á — TGN-IA (Tata Intra Asia) | Vũng Tàu | TeleGeography | submarinenetworks — Vung Tau | RFS 2009 |
| VTS (Việt Nam – Singapore) | Vũng Tàu | TeleGeography | DatacenterDynamics (Viettel–Singtel MOU) | RFS ~2027 |
| MViSTA | Vũng Tàu | TeleGeography | submarinenetworks (Stavian Group) | đang triển khai ~2028 |
| APG (Asia Pacific Gateway) | Đà Nẵng | TeleGeography (landing: Danang) | vietnamnet (khôi phục APG) | RFS 2016 |
| ALC (Asia Link Cable) | Đà Nẵng | TeleGeography | submarinenetworks | RFS ~2027 |
| SMW-3 (SEA-ME-WE 3) | Đà Nẵng | submarinenetworks — Danang | Wikipedia SEA-ME-WE 3 (Da Nang) | RFS 1999; đang thoái dần |
| ADC (Asia Direct Cable) | Quy Nhơn | TeleGeography (landing: Quy Nhon) | Viettel (thông cáo cập bờ ADC, 4/2025) | 50 Tbps |
| SJC2 (Southeast Asia-Japan Cable 2) | Quy Nhơn | TeleGeography | vietnamnet (SJC2 sự cố); VNPT là nhà đầu tư VN | RFS 2025 |

Toạ độ 3 trạm lấy từ `landing-point-geo.json` của TeleGeography (dữ liệu điểm —
sự thật, không phải đường tuyến): Vũng Tàu 107.0792°Đ/10.3418°B · Đà Nẵng
108.2147°Đ/16.0516°B · Quy Nhơn 109.2197°Đ/13.7830°B. Làm tròn 4 số lẻ theo
khuôn file.

## Bỏ vì thiếu nguồn / không đủ điều kiện

- **SJC (Southeast Asia-Japan Cable, bản gốc)** — **KHÔNG cập bờ VN**. Kiểm trên
  cả `cable-geo.json` (điểm gần nhất tới 3 trạm VN > 15 km) lẫn danh sách trạm
  per-cable (không có trạm VN). Loại — dù báo cáo cần lục có nêu tên.
- **TVH (Thailand-Vietnam-Hong Kong)** — đã ngừng khai thác (~2016). Không đưa.
- **FLAG Europe-Asia (FEA)** — từng cập bờ Đà Nẵng nhưng đã ngừng; OSM chỉ có
  đoạn không chạm VN. Không đưa (không rõ hiện trạng thực địa).

## Cách tái lập

`scripts/generate-sea-lanes.mjs` §(E) chứa bảng sự thật `VN_CABLES` + `VNCLS`
(cùng toạ độ, cùng tên) → mỗi lần sinh lại đầy đủ sẽ tạo đúng 10 feature này,
KHÔNG cần mạng cho lớp cáp VN (không như lớp OSM). Bảng là dữ liệu tĩnh từ sự
thật công khai, chỉ đổi khi có cáp VN mới cập bờ / ngừng khai thác.

## Nguồn

- TeleGeography Submarine Cable Map — https://www.submarinecablemap.com (API v3:
  `cable-geo.json`, `landing-point-geo.json`, per-cable JSON). Giấy phép bản đồ:
  CC BY-NC-SA 3.0 → chỉ dùng làm manh mối cho SỰ THẬT (tên + điểm cập bờ).
- SubmarineNetworks — https://www.submarinenetworks.com/en/stations/asia/vietnam
- vietnamnet.vn, viettel.com.vn, datacenterdynamics.com (tin công khai VN).
- Wikipedia: SEA-ME-WE 3.
