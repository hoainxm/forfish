# 02 — Kiến trúc / Architecture: routes, components, demo mode

> **Mục đích / Purpose**: Bản đồ code thực tế — routes, folder layout, component map, và cơ chế demo mode fallback khi chưa có Supabase.

**Load khi / Load when**: thêm/sửa page, route, navigation, component; cần hiểu app chạy thế nào khi env trống.

---

## 1. Stack

- **Next.js 16** App Router + TypeScript (lưu ý: Next 16 có breaking changes — đọc `node_modules/next/dist/docs/` khi không chắc API)
- **Tailwind CSS v4** — design tokens khai báo trong `src/app/globals.css` qua `@theme` (xem [03-design-system.md](03-design-system.md))
- **Supabase** qua `@supabase/ssr` (browser + server client)
- Deploy: **Vercel** · Repo: github.com/Long-Forfun/ForFish

## 2. Routes — mỗi trục một route

| Route | Trục | File | Trạng thái |
|---|---|---|---|
| `/` | — | `src/app/page.tsx` | Trang chủ: bốn trục + nhắc việc gấp |
| `/giay-to` | 4 — Tuân thủ dễ hơn | `src/app/giay-to/page.tsx` | **MVP**: Tủ giấy tờ |
| `/ngu-truong` | 1 — Đánh bắt tốt hơn | `src/app/ngu-truong/page.tsx` | Placeholder (coming-soon) |
| `/gia-ca` | 2 — Bán được đắt hơn | `src/app/gia-ca/page.tsx` | Placeholder (coming-soon) |
| `/van-hanh` | 3 — Vận hành rẻ hơn | `src/app/van-hanh/page.tsx` | Placeholder (coming-soon) |

Quy ước: route slug là tiếng Việt không dấu, khớp ngôn ngữ người dùng. Thêm route mới → update bảng này cùng commit.

## 3. Folder layout

```
src/
  app/
    layout.tsx          # Root layout (fonts, bottom nav)
    globals.css         # Tailwind v4 @theme tokens — single source màu/typography
    page.tsx            # Trang chủ
    giay-to/  ngu-truong/  gia-ca/  van-hanh/   # 1 folder / trục
  components/
    bottom-nav.tsx      # Điều hướng dưới cùng (mobile-first, 4 trục + home)
    document-vault.tsx  # Trục 4: vault UI — thêm/sửa/xóa giấy tờ + trạng thái hạn
    coming-soon.tsx     # Khung placeholder dùng chung cho trục chưa build
  lib/
    documents.ts        # Domain logic Trục 4 (kinds, expiry status) — xem 04-data-model.md
    supabase/
      client.ts         # Browser client — trả về null khi env trống
      server.ts         # Server client (cookies) — trả về null khi env trống
supabase/
  migrations/0001_init.sql   # boats + documents + RLS
```

## 4. Demo mode — invariant quan trọng

Khi `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` chưa set:

1. `src/lib/supabase/client.ts` và `server.ts` đều **trả về `null`** (không throw)
2. App fallback về **demo mode**: `document-vault.tsx` lưu dữ liệu vào localStorage key **`forfish.documents.v1`**, seed bằng `demoDocuments()` để app không bao giờ trống
3. Vault **hydrate từ localStorage trong `useEffect` sau mount** — tránh SSR/CSR mismatch. KHÔNG đọc localStorage lúc render đầu.

→ Mọi feature mới đụng dữ liệu phải giữ pattern này: chạy được không cần Supabase, degrade gracefully.

## 5. Quy ước component

- Client component chỉ khi cần (`"use client"` ở vault vì có state + localStorage)
- Placeholder trục mới dùng chung `coming-soon.tsx` — không tự chế khung riêng
- UI tuân thủ [03-design-system.md](03-design-system.md) (font ≥18px, tap ≥56px)

## 6. Cross-references

- Vì sao route chia theo trục: [01-product.md](01-product.md)
- Tokens/màu trong `globals.css`: [03-design-system.md](03-design-system.md)
- Schema + expiry logic: [04-data-model.md](04-data-model.md)

---

**Last updated**: 2026-06-10
