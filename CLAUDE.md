# CLAUDE.md — ForFish

> App đồng hành của ngư dân Việt Nam (commissioned by SDVICO). Mobile-first, tiếng Việt đời thường, cho người dùng ít rành công nghệ. Sản phẩm xoay quanh **bốn lời hứa với bà con** — không phải feature, không phải nguồn dữ liệu.

## Bốn trục / The four promises

| Trục | Lời hứa | Route | Trạng thái |
|---|---|---|---|
| 1 | Đánh bắt tốt hơn | `/ngu-truong` | Placeholder |
| 2 | Bán được đắt hơn | `/gia-ca` | Placeholder |
| 3 | Vận hành rẻ hơn | `/van-hanh` | Placeholder |
| 4 | Tuân thủ dễ hơn | `/giay-to` | **MVP đang chạy** |

Thứ tự build: **4 + 3 trước → 1 → 2**. Trục 4 làm trước vì không phụ thuộc dữ liệu bên ngoài. Chi tiết: [docs/app-map/01-product.md](docs/app-map/01-product.md).

## Tech stack

- **Next.js 16** App Router + TypeScript, **Tailwind v4** (tokens trong `src/app/globals.css` qua `@theme`)
- **Supabase** (Postgres + Auth, RLS owner-only) — app fallback về **demo mode** (localStorage) khi env chưa cấu hình
- Deploy: **Vercel** · Repo: github.com/Long-Forfun/ForFish

## Đọc gì trước / Read first

1. **`docs/app-map/README.md`** — index + load strategy của hồ sơ (app-map docs)
2. Route context theo task: gọi **`/fl <mô tả task>`** → agent `context-router` trả về danh sách `.md` cần đọc + pre-flight flags. KHÔNG load cả app-map.

## Doc + Test sync — INVARIANT (không thoả hiệp)

Mọi thay đổi `src/` phải update doc app-map tương ứng **TRONG CÙNG COMMIT**:

| Code change | Doc bắt buộc update |
|---|---|
| Route / page / nav / component | [docs/app-map/02-architecture.md](docs/app-map/02-architecture.md) |
| `src/lib/documents.ts`, migration, RLS | [docs/app-map/04-data-model.md](docs/app-map/04-data-model.md) |
| Token màu / font / component pattern | [docs/app-map/03-design-system.md](docs/app-map/03-design-system.md) |
| Scope trục / lời hứa / data source | [docs/app-map/01-product.md](docs/app-map/01-product.md) |
| Quy trình team-agent | [docs/app-map/05-agents-team.md](docs/app-map/05-agents-team.md) |

Test: repo chưa có test runner — khi thêm logic mới vào `src/lib/`, đề xuất kèm test. Skip chỉ cho phép với pure UI tweak / config-only / doc-only, note rõ trong commit message.

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
