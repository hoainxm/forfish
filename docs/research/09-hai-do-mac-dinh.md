# 09 — Hải đồ làm mặc định: trạng thái mở app của các app hàng hải

> **Mục đích**: Trả lời "app cho tàu thì mở lên phải thấy gì?" bằng cách đối
> chiếu các app hàng hải phổ biến, rồi chốt trạng thái mặc định cho bản đồ
> Trục 1. Ngày tổng hợp: 2026-06-10.

---

## 1. Các app hàng hải mặc định hiển thị gì

| App | Trạng thái mở mặc định | Vệ tinh/ảnh? |
|---|---|---|
| **Navionics Boating** (Garmin) | Nautical Chart: nền độ sâu tô màu theo dải, đường đẳng sâu + số độ sâu điểm (spot soundings), phao đèn/navaids, dịch vụ bến cảng; safety depth tô nổi vùng cạn theo mớn tàu | Overlay tuỳ chọn (satellite, relief shading) |
| **C-MAP App** | Hải đồ vector kiểu "paper chart", contour tới 1 ft, safety depth đặt được | Lớp Shaded Relief / Satellite là tuỳ chọn thêm |
| **OpenCPN** | Chart-centric: mở thẳng hải đồ (raster/vector) người dùng cài | Không có vệ tinh mặc định |
| **OpenSeaMap** | Hải đồ cộng đồng: nền bản đồ + seamarks luôn bật | — |

**Mẫu số chung**: mở app = thấy HẢI ĐỒ (độ sâu + báo hiệu hàng hải). Ảnh vệ
tinh, nhiệt độ, relief… đều là lớp TUỲ CHỌN bật thêm. App nhớ chế độ người
dùng chọn lần trước.

## 2. ForFish trước/sau (2026-06-10)

| Hạng mục | Trước | Sau |
|---|---|---|
| Lớp mở app | Nhiệt độ vệ tinh (SST anomaly) trên nền bản đồ ĐƯỜNG PHỐ | **Hải đồ độ sâu** (EMODnet/GEBCO, relief đáy biển — thấy gò, rạn, bãi cạn) |
| Thứ tự chọn lớp | SST → mồi → độ sâu → mây | **Hải đồ** → SST → mồi → mây |
| Nhớ lựa chọn | Không (luôn quay về SST) | localStorage `forfish.maplayer.v1` |
| Phao đèn/navaids | Bật sẵn (OpenSeaMap, zoom ≥9) — giữ nguyên, đúng chuẩn chart | như cũ |
| Lớp an toàn (ranh giới VN, bão, nhãn chủ quyền) | Luôn bật, không công tắc | như cũ |

Lý do giữ khung nhìn mở rộng toàn biển VN (không auto-zoom GPS như Navionics):
người dùng mở app trên bờ là chính (xem trước chuyến), cần thấy cả Biển Đông +
tin bão; nút "Tàu tôi" một chạm đã có. Xin quyền định vị ngay lúc mở app là
anti-pattern với người ít rành công nghệ.

## 3. Còn thiếu so với hải đồ thật (việc sau này)

- **Số độ sâu điểm (spot soundings) + đường đẳng sâu có nhãn**: cần hải đồ
  vector (S-57/S-101 của Hải quân/VN Hydrographic hoặc thương mại) — chưa có
  nguồn miễn phí cho vùng VN. Tile EMODnet hiện chỉ có relief shading.
- **Safety depth theo mớn tàu** (tô đỏ vùng cạn hơn X m như Navionics): cần
  tile vector độ sâu; tạm thời route-planner đã chặn <4 m / cảnh báo 4–12 m
  khi dẫn đường (dữ liệu ETOPO đóng gói — xem 06).
- **Chế độ theo tàu (follow/heading-up)** khi đang chạy trên biển.

## 4. Nguồn

- Navionics map options / nautical chart mặc định:
  https://support.garmin.com/en-US/?faq=lbf2TwzwtI2huG6MX8efs5 ·
  https://www.navionics.com/charts/features/advanced-map-options
- C-MAP app (contour 1 ft, safety depth, lớp satellite là tuỳ chọn):
  https://www.c-map.com/app/
- OpenCPN chart-centric: https://opencpn.org/ ·
  https://www.openseamap.org/index.php?id=opencpn&L=1
- OpenSeaMap hải đồ cộng đồng: https://map.openseamap.org/
- Tile hải đồ đang dùng: EMODnet Bathymetry baselayer
  (https://tiles.emodnet-bathymetry.eu/, nền GEBCO cho ngoài châu Âu).

---

**Last updated**: 2026-06-10
