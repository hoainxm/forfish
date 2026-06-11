# 03 — Design system: thiết kế cho ngư dân / Audience-first design

> **Mục đích / Purpose**: Hướng thiết kế canonical của ForFish — bắt đầu từ người dùng (ngư dân 40–60 tuổi, nắng chói, tay ướt), không bắt đầu từ trend.

**Load khi / Load when**: sửa UI, màu sắc, typography, copy, trạng thái (status), hoặc thêm component mới.

> ⚠️ Một đợt redesign theo hướng này đang chạy song song — file này mô tả **direction + tokens conceptually**, không trích line number cụ thể của file src. Token thực tế nằm trong `src/app/globals.css` (`@theme`), luôn coi file đó là nguồn giá trị hiện hành.

---

## 0. CỠ GIAO DIỆN — một kiến trúc rem, mặc định THEO MÁY (user chốt 2026-06-11)

Toàn bộ cỡ chữ / tap-size / bo góc viết bằng **REM** (đã quét sạch `text-[Npx]`/`min-h-[Npx]`/`rounded-[Npx]` → rem; utility chuẩn Tailwind vốn là rem). Chế độ chỉ là font-size gốc của `<html>`:

| Chế độ | Gốc | Cho ai |
|---|---|---|
| **Theo máy** (MẶC ĐỊNH) | không đặt → ăn theo cỡ chữ cài trong điện thoại/trình duyệt | bác nào chỉnh chữ to trong máy, app TỰ to theo — thông minh, không cần dạy |
| **Chữ to** (`data-mode="to"`) | khóa 16px → body 18px, nút 60px | khóa to bất kể máy |
| **Gọn** (`data-mode="gon"`) | khóa 14px → body ~15.8px, nút ~52px | mật độ chuẩn app, cân đối |

- **Chỉnh trong SHEET TÀI KHOẢN** (`hero-account.tsx` — chip duy nhất trên hero mở sheet: danh tính · cỡ giao diện · đăng xuất). KHÔNG bày toggle thô ra hero — nguyên tắc: cái gì trực tiếp thì show, còn lại vào menu phụ. Lưu `forfish.displaymode.v1`; script đầu `<body>` đặt `data-mode` TRƯỚC khi vẽ — không nháy.
- **QUY TẮC**: cấm viết `text-[Npx]`/`min-h-[Npx]` trong component — dùng rem (`text-[1.125rem]`…) để mọi chế độ cùng ăn. Tỷ lệ giữa các phần tử giữ nguyên → một hệ giao diện, không phải nhiều bộ.
- Sàn accessibility (≥18px, tap ≥56px ở mục 1) tính cho gốc 16px; chế độ Gọn là lựa chọn chủ động của người dùng.

## 1. Người dùng quyết định tất cả / Audience-first

Ngư dân 40–60 tuổi, dùng điện thoại ngoài trời **nắng chói**, **tay ướt**, ít rành công nghệ:

| Ràng buộc | Quy tắc |
|---|---|
| Mắt kém hơn, nắng chói | Base font **≥ 18px**, contrast cao, không chữ xám nhạt trên nền sáng |
| Tay ướt, ngón to | Tap target **≥ 56px**, khoảng cách giữa nút rộng |
| Ít rành công nghệ | Label = **icon + từ ngắn**, không icon trơ trọi, không jargon |
| Tiếng Việt đời thường | "Tủ giấy tờ" chứ không "Document management"; "Còn 18 ngày" chứ không "Expires in 18d" |
| Một việc một màn hình | Không nested menu, không bước thừa; flow ≤ 2 chạm tới việc chính |

## 2. Màu / Palette — "Mặt nước" (redesign 2026-06-10, user yêu cầu hiện đại + tràn viền)

Hướng mới: **modern edge-to-edge mobile** — nền sáng lạnh, hero biển sâu tràn viền, bề mặt không viền. Bỏ nền cát ấm cũ.

### Màu nền tảng
- **Deep sea navy** — màu chủ đạo, hero/brand/dock
- **Sunrise orange-red** — accent, call-to-action (nút pill + bóng màu)
- **Cool mist** (`--background` #f3f6f8) — nền sáng lạnh
- **Field** (`--field` #eaeff3) — nền ô nhập kiểu filled + chip tonal chưa chọn

### Hình khối hiện đại (thay quy tắc bo 12px cũ)
- **Thẻ = `.surface`** (globals.css): trắng KHÔNG viền, bo 20px, bóng mềm 2 lớp. KHÔNG dùng `ring-1 ring-line` làm viền thẻ nữa — `--line` chỉ còn cho divider trong thẻ (`border-t/b/l border-line`).
- **Hero = `.hero`**: gradient `navy → màu trục`, quầng sáng radial, bo đáy 28px, tiêu đề display 28px. Chip tàu (`BoatSwitcher`) nổi đè mép hero (`-mt-6`).
- **Nút chính + chip + tab**: pill (`rounded-full`); nút cam có bóng màu. Ô nhập: filled (`bg-field`, không viền, focus ring sea). Sheet đáy: bo trên 28px.
- **Ô nhập TIỀN = `MoneyField`** (`ui/primitives.tsx`, hội đồng UX 2026-06-11): mọi ô nhập tiền đồng dùng chung component này — chấm nghìn ngay khi gõ, cap 12 chữ số, dòng đọc-lại "= 45 triệu đồng" khi ≥1 triệu (chống lỗi thừa/thiếu một số 0 làm lệch 10 lần). State giữ CHUỖI SỐ THÔ (`digits`/`onDigits`), helpers `formatDigits`/`parseDigits`/`readbackVnd` trong `lib/format.ts` (có test). KHÔNG tự chế ô tiền với `parseVnd` + toLocaleString tay nữa.
- **Hành động phá hủy KHÔNG bao giờ 1 chạm**: `ConfirmDialog` (xóa cả bản ghi) hoặc xác nhận inline ngay trong hàng ("Xóa 'X'? [Xóa hẳn][Thôi]" — mẫu ở `my-places-sheet.tsx`). Nút icon trong hàng danh sách ≥3.5rem và luôn kèm nhãn chữ 0.75rem. Gạch nợ ứng (`crew-list.tsx`) cũng phải ConfirmDialog nêu rõ số tiền.
- **Nút GỌI = `CallButton`** (`ui/primitives.tsx`, 2026-06-11): pill xanh biển icon + chữ, tap ≥48px, tự lấy số đầu khi chuỗi nhiều số. Không tự chế nút gọi chữ trần.
- **Ô mật khẩu = `PasswordField`** (`auth-form.tsx`): có nút Hiện/Ẩn → form đăng ký KHÔNG cần ô "nhập lại".
- **Slider trên bản đồ dùng class `.range-big`** (globals.css): núm 1.75rem tự vẽ cho tay ướt — `accent-color` mặc định núm quá nhỏ.
- **Dock điều hướng nổi**: thanh navy kính mờ bo 26px tách khỏi mép màn hình, tab chọn = pill trắng. Item ≥60px, icon luôn kèm chữ.
- Thẻ 4 trục ở Home: **tonal** — nền `--tN-bg`, icon tròn đặc `--tN`.

### Phân cấp điều hướng TRONG trang (chốt 2026-06-10, khi cấu trúc mới sinh chip lồng chip)
Người 40–60 tuổi phải biết mình đang ở tầng nào bằng MẮT, không bằng suy luận:
1. **Tabs** (`ui/tabs.tsx`) — chia KHU trong một trang (vd /tien: Giao dịch · Hiệu quả). Track pill sticky, tab chọn navy đặc.
2. **Chip tầng 1** (`ui/chip-row.tsx` `level=1`) — mục chính TRONG một tab: pill ĐẶC màu trục, 48px, chữ 16px (vd Giá cá · Ai cần mua · Bán ở đâu).
3. **Chip tầng 2** (`level=2`) — mục con bên trong một mục: pill TONAL nền nhạt màu trục, 42px, chữ 15px — nhỏ + nhẹ hơn hẳn tầng 1 (vd 5 mục của Bán ở đâu).
KHÔNG tự chép tay style chip nữa — mọi hàng chip điều hướng dùng `ChipRow` (truyền `accent` đúng màu trục). Không đào sâu quá 3 tầng (Tabs → chip 1 → chip 2 là kịch trần).

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

### Ngôn ngữ trạng thái: MỘT component duy nhất (đồng bộ 2026-06-10)

Mọi trạng thái trên thẻ (giấy tờ, bảo dưỡng, sản phẩm/bảo hành, thuyền viên, mức phạt) dùng **`ui/status-banner.tsx` (`StatusBanner`)** — băng màu + icon + chữ ở ĐẦU thẻ. Màu không bao giờ đứng một mình (an toàn mù màu + nắng chói).

- Mức: `danger` / `warn` / `ok` / `neutral`. Icon mặc định theo mức (chuông/đồng hồ/tick), truyền `icon` khi cần khác, `icon={null}` để bỏ.
- KHÔNG tự chế kiểu trạng thái mới (viền trái màu, icon màu trơ trọi…) — các bản chép tay cũ ở fines-lookup/crew-list/document-vault/maintenance-reminders đã gom hết về StatusBanner.
- Mức phạt không bao giờ "tốt": phạt nhẹ dùng `neutral` (xám bình tĩnh), không dùng xanh.

## 3. Typography

- **Archivo** — display/heading: đậm chắc, đáng tin, kiểu "thiết bị hàng hải" (đã thay Baloo 2 ngày 2026-06-10 — feedback: tròn trịa quá thành trẻ con)
- **Plus Jakarta Sans** — body (thay Be Vietnam Pro 2026-06-11, user: "dùng loại international hơn"): geometric-humanist kiểu app toàn cầu, subset `vietnamese` đầy đủ dấu, nét đậm chắc hợp UI chữ to
- Base ≥ 18px; heading to rõ; không dùng font-weight mảnh (light/thin)
- **Sàn 18px cho body/input (2026-06-10)**: đã quét sạch `text-[17px]` → `text-[18px]` toàn app (kể cả `inputClass` trong `ui/primitives.tsx`). Chữ phụ (nhãn mục, ghi chú nguồn) được phép 13–16px nhưng KHÔNG dùng cho nội dung chính cần đọc ngoài nắng. Thẻ 4 trục ở Home: tiêu đề 19px display, mô tả 14px, thẻ dọc icon-trên-chữ-dưới.

## 4. Motif & tone

- **Wave motifs** (họa tiết sóng) làm điểm nhấn trang trí — nhẹ, không lấn nội dung
- **Icon: chỉ dùng stroke SVG trong `src/components/icons.tsx`** (nét 2.2px, luôn kèm nhãn chữ). **KHÔNG dùng emoji làm icon hay trang trí** — emoji làm app thành đồ chơi, mất tin cậy. Không hoạt ảnh "dễ thương" (nhún nhảy, lắc lư).
- Bo góc (đã đổi theo redesign "Mặt nước" 2026-06-10): thẻ nội dung `.surface` 20px, hero/sheet 28px, nút/chip/tab pill — xem mục 2. Vẫn KHÔNG "đồ chơi": không emoji, không hoạt ảnh nhún nhảy, icon stroke + chữ như cũ
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
- **Hải đồ có số (2026-06-10, user: "hải đồ không thấy được, toàn màu xanh")**: nền hải đồ kèm **đường đẳng sâu + nhãn số mét** (20/50/100/200/500/1000/2000 m) tự sinh từ ETOPO (`scripts/generate-isobaths.mjs` → `public/data/isobaths.v1.json`, ~200 KB) vì EMODnet WMS chỉ phủ châu Âu. Style cần `glyphs` (fonts.openmaptiles.org) cho nhãn. Chỉ vẽ trên nền hải đồ, không vẽ đè nền vệ tinh.
- **Legend tại chỗ (kiểu Google Maps)**: badge góc trái = tên lớp + ngày + **thanh gradient mini + 2 đầu thang** của nền đang xem; lớp Dự báo cá có legend riêng ở cuối hàng chip loài ("khả năng có cá" xanh lá nhạt→đậm). KHÔNG bắt người dùng mở sheet mới biết màu nghĩa là gì.
- **Lớp Dự báo cá = heatmap MỖI LOÀI MỘT MÀU + hồng tâm (2026-06-10, tham khảo cách thể hiện PFZ của OceanFishMap)**: ô điểm → lớp `heatmap` maplibre (radius theo zoom phủ kín lưới 0.25°, weight theo điểm 35→100). **Màu theo loài đang chọn** (`SPECIES_PROFILES.color` → ramp 1 sắc qua `fishHeatColor()`); "Mọi loài" = xanh lá nhiều tông `#95d5b2→#1b4b2c`. ≤8 điểm nóng nhất (≥75 điểm, cách nhau ≥0.7°) vẽ marker **hồng tâm** `TargetIcon` tô màu loài đang chọn — chạm là bay tới; điểm nóng GẦN MÌNH (≤~40 hải lý) viền cam. Thẻ cá kèm số môi trường ("Nước 28°C · mồi vừa") + **tuần trăng** (`lib/moon.ts`); loài ĐÁY/RẠN (`surfaceSignal` low) hiện cảnh báo vàng "đoán theo mùa + độ sâu, ảnh vệ tinh ít chính xác". Màu loài là NỘI DUNG bản đồ (khai trong `fish-predict.ts`, ngoại lệ §5). Phân màu CHUNG: cá = màu theo loài; cam-đỏ = riêng ranh giới; xanh dương = tuyến đi.
- **Chọn loài cá = nút GỌN + bảng modal (sửa 2026-06-11, user: "hàng chip ngang chắn map, không ẩn hiện gọn")**: BỎ hàng chip cuộn ngang full-width (chắn nhãn chủ quyền, 39 loài cuộn mệt). Thay bằng **một nút "Cá" nhỏ** (`inline-flex max-w-[80%] self-start`, chỉ rộng bằng nội dung) hiện loài đang chọn + chấm màu + chevron; chạm mở **`fish-species-sheet.tsx`** (modal `ui/bottom-sheet`): "Mọi loài" trên cùng + loài đang vụ **gom theo nhóm** (`CATEGORY_LABEL`), mỗi loài chấm màu + tên đầy đủ, **loài vùng đang xem viền cam + xếp đầu nhóm**; chọn xong đóng luôn. Map chỉ còn nút gọn — không vật gì chắn ngang. Chọn loài thì heatmap + hồng tâm tô CHỈ theo màu loài đó. **Ưu tiên gần mình**: điểm nóng cộng thưởng theo khoảng cách tới chỗ xem / cảng nhà / điểm ghim (không bịa cá, chỉ xếp gần lên trước); thẻ cá có dòng "Điểm cá gần bạn nhất ~N hải lý hướng X".
- **Lớp che ↔ chi tiết gần bờ (sửa 2026-06-10)**: sea-mask (che nhãn quốc tế Biển Đông) chỉ ĐẶC ở mức toàn cảnh (z≤6), mờ dần và TẮT ở z8 — không che luồng lạch/cảng khi zoom gần bờ. Lớp ảnh/độ sâu (`ocean-data`) có `maxzoom 12` → zoom sâu hơn thì nhả ra cho basemap (bờ, cảng, sông lạch) + phao đèn hiện. Phao đèn/luồng lạch (OpenSeaMap) `minzoom 8`. Nguyên tắc: sovereignty ở mức vùng, hải đồ chi tiết ở mức gần bờ — không đánh nhau.
- **Chọn ngày dự báo**: dãy chip ngang cuộn được (mỗi chip ≥60px cao, nhãn ngày + điểm số tô màu mức), chip đang chọn nền navy. Dự báo càng xa càng kém tin → bắt buộc kèm dòng độ tin (`forecastConfidence`) dưới số liệu, tông `--warn` từ ngày thứ 4 trở đi — KHÔNG để mọi ngày trông chắc chắn như nhau.
- **Màn hình map-first (2026-06-10)**: tab Ra khơi là map FULL-SCREEN kiểu Google Maps nhưng đơn giản hoá cho người lớn tuổi — KHÔNG gesture phức tạp, sheet điều khiển bằng NÚT TO ("Xem thêm"/"Thu gọn"/"Về cảng" ≥52px, nút thoát hiện Ở MỌI NẤC và phải tự giải thích), FAB luôn icon + chữ (không icon trơ trọi). Zone rules: tin bão TRÊN CÙNG không gì che; dải giữa màn hình để trống cho nhãn chủ quyền/pin/tâm bão; badge lớp+ngày ảnh luôn hiện (trung thực dữ liệu). Layer sheet: lớp chính chọn-MỘT (chọn xong ĐÓNG NGAY để thấy bản đồ đổi) + overlay bật/tắt; **ranh giới biển VN, vị trí bão, nhãn chủ quyền không bao giờ có công tắc** — ghi 1 dòng tĩnh. Sheet đáy dùng `ui/snap-sheet.tsx` (thường trực, không scrim); picker mở-chọn-đóng dùng `ui/bottom-sheet.tsx` (modal).
- **"Điểm của tôi" thay "chọn cảng" (user chốt 2026-06-10)**: ngư dân nghĩ theo CHỖ CỦA MÌNH (bãi hay đánh, rạn quen), không theo danh mục cảng. Bỏ `<select>` cảng. Thay bằng: ghim chỗ đang xem (đặt tên) → sao vàng trên bản đồ + mở 1 chạm; FAB "Điểm tôi" mở sheet quản lý (GPS + ghim + cảng nhà). Cảng nhà chọn 1 lần qua Ô TÌM KIẾM 173 cảng (gõ lọc tên/tỉnh/huyện, KHÔNG đổ list dài). "Về cảng nhà" chỉ hiện khi đã đặt cảng nhà và đang xem chỗ khác — quay về vùng biển nhà (trước đây vô nghĩa vì luôn nhảy về 1 cảng seed cứng).
- **KHÔNG PHÁN "đi hay không đi" (user chốt 2026-06-10)**: bản đồ mô tả ĐIỀU KIỆN bằng tình trạng biển ("Biển êm/Biển động nhẹ/Biển động mạnh") + con số (sóng m, gió cấp Beaufort, giật cấp) — không hiện điểm số /100, không lời khuyên ra khơi. Ngư dân có lịch chuyến riêng; quyết là việc của thuyền trưởng.
- **Dự báo kiểu Windy**: thanh thời gian nổi trên map (chỉ hiện khi bật lớp Gió/Sóng) — nhãn giờ tiếng Việt ("Hôm nay · 13h"), slider to + nút chạy ▶; mũi tên chỉ HƯỚNG ĐI của gió/sóng, màu xanh→đỏ theo độ dữ (ngưỡng khớp mức cảnh báo: gió 39 km/h ~ cấp 6, sóng 2,5 m). Lớp "Cá mùa này": polygon viền đứt mảnh + chip nhãn loài rút gọn; tên đầy đủ + chữ "tham khảo" nằm trong sheet.
- **Sau audit team 2026-06-10 (3 reviewer) — quy tắc chống "rối"**: (1) sheet đáy chỉ có MỘT chế độ — "gió sóng chỗ đang xem", mở app = điểm đặt sẵn tại CẢNG NHÀ, không xây màn hình cảng riêng trùng chức năng; (2) **cam đỏ là màu ĐỘC QUYỀN của ranh giới biển** trên bản đồ — tuyến dẫn đường dùng xanh chỉ đường `#1a73e8` (hằng `ROUTE_LINE_COLOR`); (3) vị trí nói tiếng người ("Cách cảng X ~Y hải lý hướng Z"), toạ độ số chỉ nằm cuối sheet cho ai đọc vào máy định vị; (4) số liệu jargon không hành động được thì BỎ (đã bỏ "nhịp sóng X giây"; gió giật nói bằng "giật cấp N"); (5) khoảng cách ranh giới chỉ nói khi gần (cảnh báo), xa hàng trăm hải lý thì im; (6) màu mask nước phải sample từ tile basemap thật (#d5e8eb), không ước lượng; (7) tính xong tuyến KHÔNG thu sheet — kết quả + cảnh báo đoạn dữ phải còn đọc được, map nhìn thấy tuyến nhờ fitBounds chừa đáy; (8) thất bại phải lên tiếng (định vị fail, nguồn bão fail) — không có thất bại câm; (9) **chạm điểm trên biển → sheet ở nấc PEEK kiểu Windy** (user chốt 2026-06-10): thẻ gọn dưới đáy hiện tóm tắt (tình trạng biển + sóng/gió + vị trí), BẢN ĐỒ KHÔNG BỊ CHE — chi tiết là việc của nút "Xem thêm", KHÔNG tự nhảy lên nấc half.

## 7. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-06-10
