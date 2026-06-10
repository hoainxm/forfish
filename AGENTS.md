# AGENTS.md — ForFish

> Entry point chung cho mọi AI tool (cross-tool). Nội dung canonical nằm ở **[CLAUDE.md](CLAUDE.md)** — file này chỉ tóm tắt và trỏ đường.

## Bắt đầu ở đâu / Where to start

1. Đọc **[CLAUDE.md](CLAUDE.md)** — bốn trục (four promises), stack, invariant, risk flags
2. Đọc **[docs/app-map/README.md](docs/app-map/README.md)** — index hồ sơ + load strategy
3. Nếu tool hỗ trợ slash command: gọi `/fl <task>` để route context (xem `.claude/commands/fl.md`)

## Tóm tắt 30 giây

- **ForFish**: app mobile-first cho ngư dân Việt Nam (SDVICO). Người dùng ít rành công nghệ → UI đơn giản, chữ to, tiếng Việt đời thường.
- Sản phẩm = **bốn lời hứa**: Đánh bắt tốt hơn (`/ngu-truong`), Bán được đắt hơn (`/gia-ca`), Vận hành rẻ hơn (`/van-hanh`), Tuân thủ dễ hơn (`/giay-to` — MVP hiện tại).
- Stack: Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase (demo mode fallback khi env trống), deploy Vercel.

## Quy tắc cốt lõi (chi tiết trong CLAUDE.md)

- **Doc + Test sync**: sửa `src/` → update doc app-map tương ứng cùng commit (bảng mapping trong [CLAUDE.md](CLAUDE.md#doc--test-sync--invariant-không-thoả-hiệp))
- **Pre-flight flags**: DB/migration/RLS/auth → dừng hỏi user trước
- **LOGIC vs REQUEST**: câu hỏi → trả lời, không sửa code; lệnh rõ → làm

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

**Last updated**: 2026-06-10
