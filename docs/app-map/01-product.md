# 01 — Sản phẩm / Product: bốn lời hứa với bà con

> **Mục đích / Purpose**: Định nghĩa canonical về sản phẩm ForFish — bốn lời hứa, thứ tự build, nguồn dữ liệu và quy tắc adapter, vòng lặp giá trị giữa các trục.

**Load khi / Load when**: cần hiểu scope một trục, quyết định feature thuộc trục nào, đụng tới data vendor (OceanByte, SDWork), hoặc viết copy/positioning.

---

## 1. ForFish là gì

App đồng hành của **ngư dân Việt Nam**, do **SDVICO** đặt hàng. Mobile-first, tiếng Việt đời thường.

**Người dùng**: ngư dân, phần lớn 40–60 tuổi, **ít rành công nghệ** (low tech literacy). Mọi quyết định sản phẩm phải qua filter: *"bác ngư dân 55 tuổi, tay ướt, đứng ngoài nắng có dùng được không?"* — chi tiết UI ở [03-design-system.md](03-design-system.md).

**Nguyên tắc số 1**: sản phẩm cấu trúc quanh **BỐN LỜI HỨA (bốn trục)** — KHÔNG phải quanh feature, KHÔNG phải quanh nguồn dữ liệu. Vendor có thể thay, lời hứa thì không.

## 2. Bốn trục / The four promises

### Trục 1 — Đánh bắt tốt hơn (`/ngu-truong`)
- **Hứa gì**: ra khơi trúng hơn, đỡ phí dầu phí công.
- **Gồm**: điểm biển hằng ngày (sea-score 1–100), bản đồ ngư trường (lớp vệ tinh nhiệt độ mặt biển / phù du / ảnh mây + gió sóng theo điểm chạm + nhãn chủ quyền Biển Đông – Hoàng Sa – Trường Sa tiếng Việt), dẫn đường tiết kiệm dầu (tuyến gợi ý từ cảng/vị trí tàu tới điểm đã chạm, né vùng sóng to gió ngược theo dự báo từng giờ, ước tính giờ chạy + lít dầu so với chạy thẳng).
- **Dữ liệu hiện chạy** (đều miễn phí, không cần key, qua adapter trong `src/lib/`):
  - Ảnh vệ tinh: chương trình mở của NASA (cập nhật hằng ngày, **trễ ~2 ngày** — UI ghi rõ "ảnh ngày X, chậm vài ngày"). Lớp dòng chảy mặt biển: chưa có nguồn tile miễn phí không-key → làm sau.
  - Hải đồ: độ sâu đáy biển EMODnet/GEBCO (tĩnh, không đổi theo ngày — UI ghi rõ) + báo hiệu hàng hải (phao, đèn biển) OpenSeaMap, tự hiện khi zoom gần bờ. Lưu ý OpenSeaMap là dữ liệu cộng đồng, vùng VN còn thưa — chỉ là tham khảo thêm, không thay hải đồ giấy/máy định vị của tàu.
  - Gió/sóng + mưa/dông: Open-Meteo (mô hình quốc tế, cập nhật theo giờ) — UI luôn kèm lời dặn nghe đài duyên hải / biên phòng. Dông sét trừ 30 điểm đi biển và tô đỏ — nguy hiểm nhất với tàu nhỏ.
  - **Tầm dự báo chọn được**: tại điểm chạm trên bản đồ, bà con chọn xem trước 1–10 ngày (`FORECAST_MAX_DAYS = 10` — giới hạn theo nguồn sóng; gió mô hình cho xa hơn nhưng lấy mức cả hai cùng có). **Độ tin ghi rõ theo tầm xa** (`forecastConfidence`): 1–3 ngày khá sát · 4–7 ngày tham khảo · 8–10 ngày chỉ để liệu đường. Ảnh vệ tinh là ảnh ĐÃ CHỤP — không dự báo trước được, UI nói thẳng điều này cạnh bộ chọn ngày.
  - Dẫn đường tiết kiệm dầu: thuật toán theo mô hình nghiên cứu VISIR cho tàu nhỏ (xem [../research/06-weather-routing.md](../research/06-weather-routing.md)) — lưới phủ vùng + Dijkstra theo giờ dự báo Open-Meteo (72h, kèm hướng sóng), né bờ/rạn/bãi cạn bằng lưới độ sâu ETOPO 2022 đóng gói sẵn (chặn <4 m, cảnh báo 4–12 m; rạn Hoàng Sa/Trường Sa quét ở phân giải gốc). **Mô hình dầu là ƯỚC LƯỢNG THAM KHẢO** (sóng làm tàu chậm theo hướng sóng; ngược gió ăn dầu hơn; sóng đuôi ≥2 m tính là vùng dữ) — KHÔNG hứa con số lít chính xác; chưa biết đá ngầm nhỏ, luồng lạch, thuỷ triều — UI bắt buộc dặn dò hải đồ + nghe đài trước khi chạy.
  - Tin bão/áp thấp: hệ cảnh báo thiên tai quốc tế GDACS (EU/UN, JSON công khai) qua proxy `/api/storms`, lọc vùng Biển Đông. **Quy tắc an toàn**: nguồn fail → KHÔNG hiển thị "không có bão" (im lặng, để lời dặn nghe đài làm việc); chỉ hiện dòng trấn an khi đã kiểm tra được thật. Nguồn quốc tế có thể lệch tên/cấp so với bản tin KTTV VN bà con nghe đài — nâng cấp lên nguồn chính thống VN khi có thỏa thuận.
- **Dữ liệu tương lai**: feed thương mại (vd OceanByte) — **bắt buộc đi qua adapter có thể thay thế**.
  - ⚠️ OceanByte là bên thứ ba nước ngoài, có sản phẩm vessel-tracking cạnh tranh → **không bao giờ là core**, không hardcode vào domain logic.
  - ⚠️ Khuyến nghị ngư trường của họ chỉ cập nhật **2 lần/tuần** → KHÔNG hứa với người dùng độ chính xác hằng ngày cho phần khuyến nghị.
- ⚠️ Độ phân giải ảnh vệ tinh là **mức vùng (vài km)**, không phải tọa độ điểm — không hứa "chỉ đúng chỗ thả lưới". Lớp phù du bị mây che mất chỗ — UI giải thích "chỗ trống là mây che".

### Trục 2 — Bán được đắt hơn (`/gia-ca`)
- **Hứa gì**: cá về bờ bán được giá, không bị ép.
- **Gồm**: giá theo loài tại cảng, kết nối đầu mối thu mua, sổ lãi/lỗ chuyến biển.
- **Dữ liệu**: **tự thu thập** qua mạng lưới đại lý/cảng của SDVICO (moat riêng, không ai có), feed từ SDWork.

### Trục 3 — Vận hành rẻ hơn (`/van-hanh`)
- **Hứa gì**: giữ tàu chạy bền, tốn ít tiền hơn.
- **Gồm**: chợ vật tư in-app (dầu nhớt, lọc...), nhắc bảo dưỡng, yêu cầu bảo hành.
- **Dữ liệu/flow**: đơn hàng chảy vào **SDWork** (ERP công ty), thanh toán QR.
- **Vai trò**: đây là **động cơ doanh thu** của công ty.

### Trục 4 — Tuân thủ dễ hơn (`/giay-to`) — **MVP hiện tại**
- **Hứa gì**: lo giấy tờ nhẹ đầu, tránh bị phạt oan.
- **Gồm**: tủ giấy tờ (document vault) + nhắc hạn, trợ lý hỏi đáp pháp luật thủy sản VN.
- **Dữ liệu**: KHÔNG phụ thuộc nguồn ngoài → được build **ĐẦU TIÊN**. Logic ở [04-data-model.md](04-data-model.md).

## 3. Thứ tự build / Build order

```
Trục 4 + 3  →  Trục 1  →  Trục 2
(không phụ      (feed       (mạng lưới
 thuộc ngoài)    ngoài)      tự thu thập)
```

Hiện trạng (2026-06-10): cả 4 trục đều có MVP chạy được — Trục 1: điểm đi biển dữ liệu thật Open-Meteo + bản đồ ngư trường ảnh vệ tinh (nhiệt độ/phù du/ảnh mây, nhãn chủ quyền VN, chạm xem gió sóng); Trục 2: bảng giá tham khảo + sổ lãi lỗ; Trục 3: nhắc bảo dưỡng + danh mục vật tư; Trục 4: tủ giấy tờ + tra mức phạt NĐ 38/2024. Dữ liệu giá/vật tư/mức phạt là bản tổng hợp THAM KHẢO từ nguồn công khai — bước tiếp: thay bằng nguồn tự thu qua mạng đại lý.

## 4. Vòng lặp cross-trục / Cross-pillar loop

```
Trục 1 + 4 (điểm biển, nhắc hạn) → mở app hằng ngày
        ↓
  thấy Trục 3 (chợ vật tư) → doanh thu SDVICO
        ↓
Trục 2 tăng thu nhập → mua nhiều hơn từ Trục 3
        ↓
  mọi lượt dùng → làm giàu hồ sơ tàu (boat profile) trong SDWork
```

## 5. Quy tắc adapter / Adapter rule (invariant)

1. Nguồn dữ liệu ngoài (OceanByte, SDWork, kho văn bản luật) chỉ là **phương tiện** — code phải tách qua adapter layer để thay vendor mà không đổi domain logic.
2. Không để tên vendor lọt vào UI copy hay domain types.
3. Không hứa với người dùng điều mà nguồn dữ liệu không đảm bảo (tần suất, độ chính xác).

## 7. Lộ trình: từ 4 lời hứa → app quản lý toàn bộ tàu cá

Định vị mở rộng (2026-06): bốn lời hứa vẫn là **ngôn ngữ giá trị**, nhưng object model của app chuyển sang **CON TÀU** (tàu → chuyến biển → thuyền viên → tiền → giấy tờ). Căn cứ JTBD + chân dung người dùng + mốc pháp lý: xem [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md).

> **Quyết định phạm vi (2026-06-10, từ user)**: khai báo **eCDT / nhật ký khai thác điện tử (NKKT)** là nghiệp vụ với hệ thống NHÀ NƯỚC — **ngoài phạm vi ForFish** (hệ sinh thái đã có sản phẩm NKKT riêng phụ trách mảng này). ForFish chỉ dừng ở: NHẮC mốc nghĩa vụ, checklist trước chuyến, giải thích quy định bằng lời thường. KHÔNG xây wizard khai hộ, KHÔNG tích hợp/đồng bộ hệ thống khai báo nhà nước.

1. **Đợt 1 — Thuyền viên + sổ tiền (wedge)** *(đang xây)*: crew module `/thuyen-vien` (hồ sơ + chứng chỉ/bảo hiểm + sổ ứng tiền + máy tính chia tiền) và sổ tiền của tàu trên nền trip-log. Đây là khoảng trống vàng số 1 — chưa app nào ở VN đụng tới phần "tiền"; không phụ thuộc nguồn ngoài, đúng triết lý build order ở mục 3.
2. **Đợt 2 — Checklist xuất bến + nhắc tuân thủ**: checklist xuất bến tự sinh theo Lmax (đèn xanh-đỏ "đủ điều kiện xuất bến": giấy tàu, chứng chỉ, bảo hiểm thuyền viên, sổ danh bạ) + cảnh báo hạn giấy tờ cho cả người nhà trên bờ + NHẮC mốc nghĩa vụ khai báo (không khai hộ — xem quyết định phạm vi ở trên).
3. **Đợt 3 — Công nợ nậu + hồ sơ chuyến QR**: sổ công nợ đa đối tượng (đại lý dầu, nậu, ngân hàng — minh bạch hóa trước, thay thế nậu sau) + gói hồ sơ chuyến biển PDF/QR chứng minh truy xuất cho người mua.
4. **Đợt 4 — Kết nối SDWork/marketplace**: hồ sơ kinh nghiệm thuyền viên thành "chợ lao động đi biển", kênh bán/chào giá nối mạng đại lý SDVICO, đơn vật tư chảy sâu hơn vào SDWork — chỉ sau khi dữ liệu từ đợt 1–3 đủ dày.

## 8. Cross-references

- Kiến trúc routes/components: [02-architecture.md](02-architecture.md)
- Thiết kế cho ngư dân: [03-design-system.md](03-design-system.md)
- Schema + logic Trục 4: [04-data-model.md](04-data-model.md)
- Cách team agent chia việc: [05-agents-team.md](05-agents-team.md)
- JTBD + map nhóm việc → module (quản lý toàn bộ tàu cá): [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md)

---

**Last updated**: 2026-06-10
