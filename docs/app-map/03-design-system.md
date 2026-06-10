# 03 — Design system: thiết kế cho ngư dân / Audience-first design

> **Mục đích / Purpose**: Hướng thiết kế canonical của ForFish — bắt đầu từ người dùng (ngư dân 40–60 tuổi, nắng chói, tay ướt), không bắt đầu từ trend.

**Load khi / Load when**: sửa UI, màu sắc, typography, copy, trạng thái (status), hoặc thêm component mới.

> ⚠️ Một đợt redesign theo hướng này đang chạy song song — file này mô tả **direction + tokens conceptually**, không trích line number cụ thể của file src. Token thực tế nằm trong `src/app/globals.css` (`@theme`), luôn coi file đó là nguồn giá trị hiện hành.

---

## 1. Người dùng quyết định tất cả / Audience-first

Ngư dân 40–60 tuổi, dùng điện thoại ngoài trời **nắng chói**, **tay ướt**, ít rành công nghệ:

| Ràng buộc | Quy tắc |
|---|---|
| Mắt kém hơn, nắng chói | Base font **≥ 18px**, contrast cao, không chữ xám nhạt trên nền sáng |
| Tay ướt, ngón to | Tap target **≥ 56px**, khoảng cách giữa nút rộng |
| Ít rành công nghệ | Label = **icon + từ ngắn**, không icon trơ trọi, không jargon |
| Tiếng Việt đời thường | "Tủ giấy tờ" chứ không "Document management"; "Còn 18 ngày" chứ không "Expires in 18d" |
| Một việc một màn hình | Không nested menu, không bước thừa; flow ≤ 2 chạm tới việc chính |

## 2. Màu / Palette — "sơn tàu" ấm áp, thân thiện

Cảm hứng: màu sơn tàu cá miền biển — navy biển sâu, cam đỏ bình minh, nền cát.

### Màu nền tảng
- **Deep sea navy** — màu chủ đạo, header/brand
- **Sunrise orange-red** — accent, call-to-action
- **Sand** — background ấm

### Màu theo trục (per-trục accents) — đã có trong `globals.css`

| Trục | Tên | Hex |
|---|---|---|
| 1 — Đánh bắt | steel blue | `#2e6b8a` |
| 2 — Bán | green | `#2f6b43` |
| 3 — Vận hành | amber | `#8a6516` |
| 4 — Tuân thủ | purple | `#7a3b9a` |

Mỗi trục có thêm biến nền nhạt tương ứng (`--tN-bg`). Mọi UI thuộc một trục phải dùng đúng accent của trục đó — giúp người dùng nhận diện "khu" bằng màu.

### Màu trạng thái (semantic status) — KHÔNG đổi nghĩa

| Màu | Nghĩa | Token |
|---|---|---|
| 🔴 Đỏ | Quá hạn / nguy | `--danger` |
| 🟡 Vàng hổ phách | Sắp hết hạn / chú ý | `--warn` |
| 🟢 Xanh lá | Còn hạn / ổn | `--ok` |

Mapping với expiry logic (`expired`/`soon`/`ok`): xem [04-data-model.md](04-data-model.md).

## 3. Typography

- **Archivo** — display/heading: đậm chắc, đáng tin, kiểu "thiết bị hàng hải" (đã thay Baloo 2 ngày 2026-06-10 — feedback: tròn trịa quá thành trẻ con)
- **Be Vietnam Pro** — body: dấu tiếng Việt đẹp, dễ đọc cỡ lớn
- Base ≥ 18px; heading to rõ; không dùng font-weight mảnh (light/thin)

## 4. Motif & tone

- **Wave motifs** (họa tiết sóng) làm điểm nhấn trang trí — nhẹ, không lấn nội dung
- **Icon: chỉ dùng stroke SVG trong `src/components/icons.tsx`** (nét 2.2px, luôn kèm nhãn chữ). **KHÔNG dùng emoji làm icon hay trang trí** — emoji làm app thành đồ chơi, mất tin cậy. Không hoạt ảnh "dễ thương" (nhún nhảy, lắc lư).
- Bo góc vừa phải: thẻ/nút `rounded-xl` (12px), phần tử nhỏ `rounded-lg`/`rounded-md` — KHÔNG bo tròn xoe (`rounded-3xl`, pill) cho khối nội dung
- Tone copy: như người quen trong nghề nói chuyện — ngắn, điềm đạm, cụ thể ("Đăng kiểm sắp hết hạn, còn 12 ngày — đi gia hạn sớm kẻo phạt"); hạn chế dấu chấm than
- Không dùng từ kỹ thuật trong UI: "đồng bộ", "xác thực", "session"...

## 5. Cách dùng tokens (Tailwind v4)

- Tất cả màu khai báo ở `:root` + map qua `@theme inline` trong `src/app/globals.css` → dùng class Tailwind (`text-t4`, `bg-t1-bg`, ...)
- **KHÔNG hardcode hex trong component** — thêm màu mới thì thêm token trước
- Đổi/thêm token → update file này cùng commit (invariant trong root [CLAUDE.md](../../CLAUDE.md))
- **Ngoại lệ duy nhất — màu nội dung bản đồ** (Trục 1): màu mask nước biển, gradient chú giải thang đo vệ tinh, màu vẽ tuyến dẫn đường (MapLibre paint không nhận CSS variable) là nội dung dữ liệu (khớp palette ảnh vệ tinh/basemap), KHÔNG phải màu UI → khai báo tại `src/lib/ocean-map.ts` kèm comment, không đưa vào tokens. UI chrome quanh bản đồ (nút, thẻ, badge) vẫn dùng tokens như thường.

## 6. Pattern bản đồ (Trục 1)

- **Nhãn chủ quyền**: BIỂN ĐÔNG / VỊNH BẮC BỘ / VỊNH THÁI LAN + HOÀNG SA (TP. Đà Nẵng — VN), TRƯỜNG SA (Tỉnh Khánh Hòa — VN) render bằng HTML marker tiếng Việt, halo màu nước để đọc được trên mọi lớp ảnh; tile quốc tế bị che bằng mask ở zoom ≤9. KHÔNG để lộ "South China Sea / Paracel / Spratly". Map view mới phải dùng lại `buildMapStyle` + `SOVEREIGNTY_LABELS` từ `src/lib/ocean-map.ts`.
- **Chọn lớp ảnh**: nút to ≥56px, icon + từ đời thường ("Hải đồ độ sâu", "Nước nóng lạnh", "Vùng nhiều mồi", "Ảnh mây trời") — không dùng thuật ngữ SST/chlorophyll trong UI. **Lớp mặc định khi mở = Hải đồ độ sâu** (chuẩn mọi app hàng hải — Navionics/C-MAP/OpenCPN mở nautical chart, vệ tinh chỉ là tuỳ chọn; xem [../research/09-hai-do-mac-dinh.md](../research/09-hai-do-mac-dinh.md)); app nhớ lớp người dùng chọn (`forfish.maplayer.v1`).
- **Trung thực dữ liệu**: luôn hiện "Ảnh ngày X — ảnh vệ tinh luôn chậm vài ngày" đè góc bản đồ; chú giải nói rõ "chỗ trống là mây che".
- **Chọn ngày dự báo**: dãy chip ngang cuộn được (mỗi chip ≥60px cao, nhãn ngày + điểm số tô màu mức), chip đang chọn nền navy. Dự báo càng xa càng kém tin → bắt buộc kèm dòng độ tin (`forecastConfidence`) dưới số liệu, tông `--warn` từ ngày thứ 4 trở đi — KHÔNG để mọi ngày trông chắc chắn như nhau.
- **Màn hình map-first (2026-06-10)**: tab Ra khơi là map FULL-SCREEN kiểu Google Maps nhưng đơn giản hoá cho người lớn tuổi — KHÔNG gesture phức tạp, sheet điều khiển bằng NÚT TO ("Xem thêm"/"Thu gọn"/"Về cảng" ≥52px, nút thoát hiện Ở MỌI NẤC và phải tự giải thích), FAB luôn icon + chữ (không icon trơ trọi). Zone rules: tin bão TRÊN CÙNG không gì che; dải giữa màn hình để trống cho nhãn chủ quyền/pin/tâm bão; badge lớp+ngày ảnh luôn hiện (trung thực dữ liệu). Layer sheet: lớp chính chọn-MỘT (chọn xong ĐÓNG NGAY để thấy bản đồ đổi) + overlay bật/tắt; **ranh giới biển VN, vị trí bão, nhãn chủ quyền không bao giờ có công tắc** — ghi 1 dòng tĩnh. Sheet đáy dùng `ui/snap-sheet.tsx` (thường trực, không scrim); picker mở-chọn-đóng dùng `ui/bottom-sheet.tsx` (modal).
- **KHÔNG PHÁN "đi hay không đi" (user chốt 2026-06-10)**: bản đồ mô tả ĐIỀU KIỆN bằng tình trạng biển ("Biển êm/Biển động nhẹ/Biển động mạnh") + con số (sóng m, gió cấp Beaufort, giật cấp) — không hiện điểm số /100, không lời khuyên ra khơi. Ngư dân có lịch chuyến riêng; quyết là việc của thuyền trưởng.
- **Dự báo kiểu Windy**: thanh thời gian nổi trên map (chỉ hiện khi bật lớp Gió/Sóng) — nhãn giờ tiếng Việt ("Hôm nay · 13h"), slider to + nút chạy ▶; mũi tên chỉ HƯỚNG ĐI của gió/sóng, màu xanh→đỏ theo độ dữ (ngưỡng khớp mức cảnh báo: gió 39 km/h ~ cấp 6, sóng 2,5 m). Lớp "Cá mùa này": polygon viền đứt mảnh + chip nhãn loài rút gọn; tên đầy đủ + chữ "tham khảo" nằm trong sheet.
- **Sau audit team 2026-06-10 (3 reviewer) — quy tắc chống "rối"**: (1) sheet đáy chỉ có MỘT chế độ — "gió sóng chỗ đang xem", mở app = điểm đặt sẵn tại CẢNG NHÀ, không xây màn hình cảng riêng trùng chức năng; (2) **cam đỏ là màu ĐỘC QUYỀN của ranh giới biển** trên bản đồ — tuyến dẫn đường dùng xanh chỉ đường `#1a73e8` (hằng `ROUTE_LINE_COLOR`); (3) vị trí nói tiếng người ("Cách cảng X ~Y hải lý hướng Z"), toạ độ số chỉ nằm cuối sheet cho ai đọc vào máy định vị; (4) số liệu jargon không hành động được thì BỎ (đã bỏ "nhịp sóng X giây"; gió giật nói bằng "giật cấp N"); (5) khoảng cách ranh giới chỉ nói khi gần (cảnh báo), xa hàng trăm hải lý thì im; (6) màu mask nước phải sample từ tile basemap thật (#d5e8eb), không ước lượng; (7) tính xong tuyến KHÔNG thu sheet — kết quả + cảnh báo đoạn dữ phải còn đọc được, map nhìn thấy tuyến nhờ fitBounds chừa đáy; (8) thất bại phải lên tiếng (định vị fail, nguồn bão fail) — không có thất bại câm.

## 7. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-06-10
