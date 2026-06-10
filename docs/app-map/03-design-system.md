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

## 6. Cross-references

- Vì sao audience là vậy: [01-product.md](01-product.md)
- Component nào dùng ở đâu: [02-architecture.md](02-architecture.md)

---

**Last updated**: 2026-06-10
