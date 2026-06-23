# 05 — Ra khơi (`/ngu-truong`) — XUẤT HIỆN TRẠNG để redesign

> **Mục đích**: chụp lại TOÀN BỘ tính năng · flow · bố cục đang có trên màn Ra khơi, để giao designer thiết kế lại bố cục. Đây là *hiện trạng* (as-is), KHÔNG phải đề xuất. Nguồn: code `src/components/fishing-map-view.tsx` (+ `layer-sheet`, `snap-sheet`, `route-planner`, `storm-banner`, `sea-forecast`) + snapshot DOM 2026-06-16.
> **Vấn đề user nêu**: bố cục hiện tại "phản khoa học" — quá nhiều lớp nổi đè lên bản đồ cùng lúc. Phần §7 nói rõ vì sao.

---

## 1. Người dùng & nhiệm vụ (giữ khi redesign)
- **User**: chủ tàu / ngư dân Việt 40–60 tuổi, ít rành công nghệ, đọc ngoài nắng, tay ướt, mobile-first (cột ≤480px).
- **Job**: trước/đang chuyến biển — coi **gió sóng** + **dự báo cá** chỗ định đi, né **bão**, **dẫn đường tiết kiệm dầu**, ghim điểm.
- **Primary action (design-spec §5 #2)**: "Dẫn đường tới chỗ này". Density spec: **H — map ≥60%**.

## 2. Bố cục hiện tại — bản đồ full-bleed + 6 cụm nổi đè lên (đồng thời)

Bản đồ MapLibre chiếm toàn màn. Trên nó **xếp chồng cùng lúc** (từ trên xuống, trái→phải):

| # | Cụm nổi | Vị trí | Luôn hiện? |
|---|---|---|---|
| A | **Banner bão** (alert vàng to: tên + cấp gió + "đừng ra khơi") | đỉnh, full width | chỉ khi có bão |
| B | **Legend nền** ("Hải đồ độ sâu — Cạn→Sâu", hoặc nhiệt/phù du) | trên-trái | luôn |
| C | **3 nút tròn**: Lớp · Tàu tôi · Điểm tôi | trên-phải, dọc | luôn |
| D | **Chọn loài cá** ("Mọi loài cá" ▾) + **Lọc khả năng có cá** (slider kéo 2 đầu, "60–80%") | dưới B, trái | khi lớp cá bật |
| E | **Thanh thời gian** (Windy: Gió/Sóng + ▶ chạy + slider Bây giờ→3 ngày) | nổi sát mép trên SnapSheet | khi bật lớp gió/sóng |
| F | **SnapSheet đáy 3 nấc** (peek/half/full) — gió sóng + ngày + dự báo cá + dẫn đường | đáy | luôn (peek) |
| — | **Dock điều hướng 5 tab** | đáy cùng | luôn (toàn app) |

**Marker trên bản đồ (đồng thời):** 7 nhãn vùng/đảo chủ quyền (VỊNH BẮC BỘ, BIỂN ĐÔNG, HOÀNG SA…) + tâm bão + **tối đa 8 hồng tâm "điểm nóng có cá"** + điểm ghim của user + cảng nhà + (tuyến dẫn đường nếu có) + vùng đỏ/track bão.

→ Lúc cao điểm: **A+B+C+D+E+F + dock + ~20 marker** cùng tranh chỗ trên màn 375px.

## 3. Inventory đầy đủ — từng control

### A. Banner bão (`storm-banner.tsx`)
- Icon ⚠ + "Siêu bão MEKKHALA đang trên vùng Biển Đông" + "Gió mạnh nhất ~231 km/giờ (cấp 12). Đừng ra khơi vùng ảnh hưởng — nghe đài duyên hải/biên phòng."
- Nguồn fail → KHÔNG hiện (không nói "không có bão").

### B. Legend nền (góc trên-trái) — **bấm được, mở sheet Lớp**
- Hiện tên lớp nền đang xem + dải màu + nhãn 2 đầu (vd "Cạn / Sâu", "Mát / Ấm").

### C. 3 nút tròn (trên-phải)
- **Lớp** → mở sheet "Xem bản đồ kiểu gì?" (§4).
- **Tàu tôi** → định vị GPS về vị trí tàu.
- **Điểm tôi** → mở sheet quản lý điểm ghim + cảng nhà.

### D. Bộ chọn cá (khi lớp cá bật)
- **"Mọi loài cá ▾"** → mở bảng chọn loài (39 loài, 6 nhóm; loài đang vụ ở vùng đang xem lên đầu).
- **Slider lọc "khả năng có cá"** — kéo 2 đầu chọn khoảng % (vd 60–80) → heatmap + hồng tâm chỉ hiện ô trong khoảng. *(mới 2026-06-16; độ sâu KHÔNG lọc được vì là raster)*

### E. Thanh thời gian dự báo (khi bật gió/sóng)
- "Gió/Sóng · [giờ]" + nút ▶/⏸ chạy 3 ngày + slider giờ + nhãn Bây giờ/Ngày mai/2 ngày/3 ngày.

### F. SnapSheet đáy — 3 nấc (peek / half / full)
- **Nút điều khiển**: thanh kéo + "Xem thêm"/"Thu gọn" + "Về cảng nhà".
- **Peek**: tình trạng biển ("Biển động nhẹ — hôm nay") + "Sóng 0,5 m · Gió cấp 4 Nam" + khoảng cách tới cảng nhà + cảnh báo ranh giới (nếu gần) + mồi cá teaser.
- **Half/Full**: cảnh báo ranh giới đầy đủ · **dải chip chọn ngày 1–10** (mỗi chip: ngày + sóng max/gió) · thẻ tình trạng biển ngày đã chọn · **thẻ Dự báo cá tại điểm** (khoá nếu chưa đăng nhập → mời đăng nhập; mở thì: loài + khả năng % + số môi trường nước°C/mồi + tuần trăng + "đi hướng nào") · **dẫn đường tiết kiệm dầu** (`route-planner`).

### Sheet "Lớp" (`layer-sheet.tsx`) — mở từ B hoặc nút Lớp
- **Lớp nền (chọn-một, grid 2×2)**: Hải đồ độ sâu · Nhiệt độ mặt biển (SST) · Phù du (chlorophyll) · Ảnh mây (truecolor).
- **Lớp số liệu biển (chọn-một)**: Nước dâng/xoáy (SSHA) · (độ mặn — tạm rút).
- **Lớp dự báo**: Tắt / Gió / Sóng.
- **Dự báo cá**: bật/tắt.
- **Phao đèn, báo hiệu gần bờ**: bật/tắt.

## 4. Tính năng (đầy đủ)
1. Bản đồ ngư trường đa lớp (hải đồ độ sâu / SST / phù du / ảnh mây vệ tinh).
2. Dự báo cá PFZ (heatmap + hồng tâm; 39 loài; chi tiết điểm khoá theo đăng nhập) — **+ lọc theo khoảng %**.
3. Gió/sóng theo điểm chạm, 1–10 ngày + độ tin theo tầm xa.
4. Lớp gió/sóng vẽ động theo giờ kiểu Windy (mũi tên + thanh thời gian + chạy).
5. Nước dâng/xoáy (SSHA).
6. Tin bão + **đường đi + vùng ảnh hưởng** trên bản đồ.
7. Dẫn đường tiết kiệm dầu (né sóng gió, ước lít dầu).
8. Nhãn chủ quyền VN (Hoàng Sa/Trường Sa kèm tỉnh).
9. Cảnh báo ranh giới biển (gần vạch → đỏ).
10. Phao đèn/báo hiệu (OpenSeaMap) gần bờ.
11. Điểm ghim của tôi + cảng nhà; định vị GPS "Tàu tôi".
12. Tuần trăng (trong thẻ cá).

## 5. Flows chính
- **Coi chỗ định đi**: mở app → vào cảng nhà/ngoài khơi → **chạm điểm trên biển** → peek hiện gió sóng + mồi cá → "Xem thêm" → ngày + dự báo cá + dẫn đường.
- **Tìm cá**: bật lớp cá → chọn loài → (lọc % nếu muốn) → hồng tâm → chạm hồng tâm → bay tới + xem chi tiết (đăng nhập).
- **Dẫn đường**: chọn điểm → full sheet → route-planner vẽ tuyến né sóng gió + ước dầu.
- **Đổi lớp**: nút Lớp / chạm legend → sheet Lớp → chọn nền/dự báo/cá/phao.
- **Né bão**: banner bão + vùng đỏ + track trên map.

## 6. Ma trận trạng thái (giữ khi redesign)
| Tình huống | Hiện gì |
|---|---|
| Chưa login | dự báo cá teaser + mời đăng nhập; gió sóng public |
| Điểm trống/chưa chạm | "chạm biển để xem"; mặc định cảng nhà |
| Lỗi/mạng yếu | mỗi lớp (cá/lưới/scalar) có nút **Thử lại** — không hỏng câm |
| Đang tải | "Đang lấy dự báo…" / "Đang tải dự báo cho cả vùng…" |
| Trên đất liền | "Chỗ này trên đất liền — chạm ra biển" |
| Có bão | banner + vùng đỏ + track |

## 7. VÌ SAO "phản khoa học" (việc của designer)
- **Quá nhiều lớp nổi cạnh tranh**: 6 cụm UI (A–F) + dock + ~20 marker đè lên bản đồ cùng lúc trên 375px → mắt không biết nhìn đâu trước; vi phạm "map ≥60% sạch".
- **Control rải 4 góc**: legend trái, 3 nút phải, chọn-loài+slider trái-dưới, thời gian + sheet dưới → không có thứ bậc, không gom nhóm theo nhiệm vụ.
- **Trùng chức năng mở Lớp**: cả legend (B) lẫn nút Lớp (C) cùng mở 1 sheet.
- **Mật độ marker**: 7 nhãn chủ quyền + 8 hồng tâm + bão + ghim + cảng = chữ chồng chữ khi zoom xa.
- **Slider lọc cá + chọn loài + legend nền** nằm sát nhau, 3 ý khác nhau, dễ nhầm.
- **Nấc peek vẫn đẩy nhiều chữ** (tình trạng + khoảng cách + ranh giới + mồi) — đua chỗ với phần trên.

## 8. Ràng buộc CỨNG cho redesign (không được phá)
- Mobile-first ≤480px; font ≥18px body; tap target ≥44–56px; tiếng Việt đời thường; người dùng 40–60 ít rành công nghệ.
- 1 nhiệm vụ chính = 1 primary ("Dẫn đường tới chỗ này"); map ≥60%.
- Màu **cam-đỏ độc quyền cho ranh giới biển**; status chỉ qua `StatusBanner`.
- Giữ MỌI tính năng §4 + ma trận trạng thái §6 + quy tắc an toàn (không phán "đi/không đi"; nguồn fail không nói "không có bão"; mọi số liệu "tham khảo").
- Lazy-load MapLibre bắt buộc. Nguồn dữ liệu giữ nguyên (Open-Meteo/ERDDAP/HYCOM/GDACS/EMODnet/OpenSeaMap).
- Dock 5 tab toàn app — không đụng.

---

**Tạo**: 2026-06-16 — xuất hiện trạng để giao designer. Khi có thiết kế mới → cập nhật [07-design-spec.md](../app-map/07-design-spec.md) (#2 Ra khơi) rồi mới build.
