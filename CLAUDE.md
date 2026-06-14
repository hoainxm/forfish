# CLAUDE.md — ForFish

> App đồng hành của ngư dân Việt Nam (commissioned by SDVICO). Mobile-first, tiếng Việt đời thường, cho người dùng ít rành công nghệ. Sản phẩm xoay quanh **bốn lời hứa với bà con** — không phải feature, không phải nguồn dữ liệu.

## Bốn trục / The four promises

| Trục | Lời hứa | Route | Trạng thái |
|---|---|---|---|
| 1 | Đánh bắt tốt hơn | `/ngu-truong` | **MVP**: điểm đi biển 1–100, dữ liệu thật Open-Meteo (sóng/gió/mưa/dông, 10 cảng) + bản đồ ngư trường vệ tinh (nhiệt độ/phù du/ảnh mây/độ sâu + phao đèn biển, nhãn chủ quyền VN, chạm xem gió sóng) + tin bão Biển Đông (`/api/storms`) + dẫn đường tiết kiệm dầu (tuyến né sóng gió theo giờ, ước tính lít dầu — tham khảo) |
| 2 | Bán được đắt hơn | `/gia-ca` | **MVP**: bảng giá tham khảo + sổ lãi lỗ chuyến biển (localStorage) |
| 3 | Vận hành rẻ hơn | `/van-hanh` | **MVP**: nhắc bảo dưỡng (localStorage) + danh mục vật tư tham khảo |
| 4 | Tuân thủ dễ hơn | `/giay-to` | **MVP**: tủ giấy tờ + tra mức phạt (NĐ 38/2024) |

Thứ tự build: **4 + 3 trước → 1 → 2**. Trục 4 làm trước vì không phụ thuộc dữ liệu bên ngoài. Chi tiết: [docs/app-map/01-product.md](docs/app-map/01-product.md).

## Tech stack

- **Next.js 16** App Router + TypeScript, **Tailwind v4** (tokens trong `src/app/globals.css` qua `@theme`)
- **Supabase** (Postgres + Auth, RLS owner-only) — app fallback về **demo mode** (localStorage) khi env chưa cấu hình
- **MapLibre GL** (bắt buộc lazy-load) — bản đồ ngư trường Trục 1 · **Vitest** — test logic `src/lib/`
- Deploy: **Vercel** · Repo: github.com/Long-Forfun/ForFish

## Đọc gì trước / Read first

1. **`docs/app-map/README.md`** — index + load strategy của hồ sơ (app-map docs)
2. Route context theo task: gọi **`/fl <mô tả task>`** → agent `context-router` trả về danh sách `.md` cần đọc + pre-flight flags. KHÔNG load cả app-map.

## Doc + Test sync — INVARIANT (không thoả hiệp)

Mọi thay đổi `src/` phải update doc app-map tương ứng **TRONG CÙNG COMMIT**:

| Code change | Doc bắt buộc update |
|---|---|
| Route / page / nav / component | [docs/app-map/02-architecture.md](docs/app-map/02-architecture.md) |
| Màn hình / flow / density / trạng thái / audit UI | [docs/app-map/07-design-spec.md](docs/app-map/07-design-spec.md) |
| `src/lib/documents.ts`, migration, RLS | [docs/app-map/04-data-model.md](docs/app-map/04-data-model.md) |
| Token màu / font / component pattern | [docs/app-map/03-design-system.md](docs/app-map/03-design-system.md) |
| Scope trục / lời hứa / data source | [docs/app-map/01-product.md](docs/app-map/01-product.md) |
| Quy trình team-agent | [docs/app-map/05-agents-team.md](docs/app-map/05-agents-team.md) |
| Shape đồ SDWork (CRM↔ForFish) | [docs/contracts/sdwork-assets.contract.md](docs/contracts/sdwork-assets.contract.md) — bump version nếu breaking |
| Nguồn dữ liệu ngoài (timeout/fallback) | [docs/app-map/ops/external-services.md](docs/app-map/ops/external-services.md) |

**Enforcement (nguyên tắc 8/12)**: pre-commit hook ở `.githooks/` (bật bằng `git config core.hooksPath .githooks`) chặn migration↔04 lệch, covers-gate, budget root, contract SDWork, spacing-px, BOM/mojibake. Verify: `sh .githooks/pre-commit --self-test`. Sức khoẻ doc: `sh scripts/doc-health-report.sh`. Audit định kỳ: `/audit`.

Test: **Vitest** (`npm test`, test tại `src/lib/__tests__/`) — thêm logic mới vào `src/lib/` thì viết test kèm cùng commit. Skip chỉ cho phép với pure UI tweak / config-only / doc-only, note rõ trong commit message.

## Pre-flight risk flags — dừng lại hỏi user khi

- 🔴 **DB/migration**: đụng `supabase/migrations/`, RLS, schema (project ref `znzgugvfhgmiszqgjulk`) — KHÔNG tự apply lên remote
- 🔴 **Auth**: thêm/bỏ check quyền, bypass RLS
- 🟡 **Cross-trục**: thay đổi ảnh hưởng >1 trục (vd: bottom-nav, layout, design tokens)
- 🟡 **Data vendor**: code dính OceanByte/SDWork phải đi qua adapter — KHÔNG hardcode vendor vào core (xem [01-product.md](docs/app-map/01-product.md))

## LOGIC vs REQUEST

- User hỏi "tại sao / có nên / kiểm tra giúp" → **LOGIC**: phân tích, trả lời, KHÔNG sửa code
- User ra lệnh rõ (thêm, sửa, fix, build, deploy) → **REQUEST**: làm
- Không chắc → hỏi 1 câu ngắn để lock scope. `/fl` sẽ classify giúp.

## KHÔNG ĐƯỢC / NEVER

- Hardcode secret / API key
- UI phức tạp, chữ nhỏ, jargon — người dùng là ngư dân 40-60 tuổi (font ≥18px, tap target ≥56px, xem [03-design-system.md](docs/app-map/03-design-system.md))
- Hứa độ chính xác dữ liệu mà nguồn không đảm bảo (vd: khuyến nghị ngư trường chỉ cập nhật 2 lần/tuần)
- Code mà không update doc cùng commit

## Quick commands

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

---

**Last updated**: 2026-06-10
