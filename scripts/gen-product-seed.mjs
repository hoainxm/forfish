// Sinh migration seed product_listings TỪ src/data/sdvico-showcase.ts (nguồn đơn).
// Chạy lại khi sửa nội dung sản phẩm:  node scripts/gen-product-seed.mjs
// → ghi đè supabase/migrations/0054_product_catalog_seed_2026.sql
//
// Node ≥22 tự strip type (import type bị xoá, không cần resolve alias "@/").

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { SDVICO_SHOWCASE } = await import("../src/data/sdvico-showcase.ts");

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const jsonb = (v) => q(JSON.stringify(v)) + "::jsonb";

// uuid seed CŨ (migration 0016, dòng 1111-series) — thay bằng bản chi tiết mới.
const OLD_SEED_IDS = [
  "b6e1a1a0-1111-4a11-8a11-000000000001",
  "b6e1a1a0-1111-4a11-8a11-000000000002",
  "b6e1a1a0-1111-4a11-8a11-000000000003",
  "b6e1a1a0-1111-4a11-8a11-000000000004", // XT-Pro (bỏ — không có trong tài liệu)
  "b6e1a1a0-1111-4a11-8a11-000000000005",
  "b6e1a1a0-1111-4a11-8a11-000000000006",
];

const rows = SDVICO_SHOWCASE.map(
  (p, i) =>
    `  (${q(p.uuid)}, 'sdvico', ${q(p.title)}, ${q(p.category)}, ${q(p.desc)},\n` +
    `   ${jsonb(p.features)}, ${jsonb(p.detail)}, ${q(p.image)}, ${q(p.line)}, ${p.group ? q(p.group) : "null"}, ${i})`,
).join(",\n");

const sql = `-- SDFish — SEED danh mục sản phẩm SDVICO chi tiết (2026-09-24). Sinh TỰ ĐỘNG từ
-- src/data/sdvico-showcase.ts bằng scripts/gen-product-seed.mjs — ĐỪNG sửa tay,
-- sửa nội dung ở file TS rồi chạy lại script.
--
-- Nguồn nội dung: tài liệu "Thong-tin-chi-tiet-san-pham-SDVICO.docx" (SDVICO).
-- Thêm cột \`detail\` (jsonb: models/maker/forWho/benefits/specs/variant) cho trang
-- Chi tiết; thay 6 seed cũ (0016) bằng ${SDVICO_SHOWCASE.length} sản phẩm chi tiết + BỎ "Điện thoại
-- vệ tinh XT-Pro" (không có trong tài liệu). Idempotent: chạy lại refresh nội dung.
--
-- Xem docs/app-map/04-data-model.md.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

alter table public.product_listings
  add column if not exists detail jsonb;

-- Bỏ 6 seed cũ (1111-series, gồm XT-Pro). Admin tự thêm (uuid ngẫu nhiên) KHÔNG bị đụng.
delete from public.product_listings
where id in (${OLD_SEED_IDS.map(q).join(", ")});

-- ${SDVICO_SHOWCASE.length} sản phẩm chi tiết từ tài liệu. do update = seed là nguồn, chạy lại refresh.
insert into public.product_listings
  (id, vendor_kind, title, category, description, features, detail, image_url, line, "group", sort_order)
values
${rows}
on conflict (id) do update set
  vendor_kind = excluded.vendor_kind,
  title       = excluded.title,
  category    = excluded.category,
  description = excluded.description,
  features    = excluded.features,
  detail      = excluded.detail,
  image_url   = excluded.image_url,
  line        = excluded.line,
  "group"     = excluded."group",
  sort_order  = excluded.sort_order,
  updated_at  = now();
`;

const out = join(__dirname, "..", "supabase", "migrations", "0054_product_catalog_seed_2026.sql");
writeFileSync(out, sql, "utf8");
console.log(`[gen-product-seed] Ghi ${SDVICO_SHOWCASE.length} sản phẩm → ${out}`);

// ── 0055: DỌN danh mục — chỉ GIỮ ${SDVICO_SHOWCASE.length} sản phẩm SDVICO trong tài liệu ──────────
// Xóa mọi sản phẩm vendor_kind='sdvico' KHÔNG thuộc bộ seed (bộ đàm, máy dò cá,
// hàng test cũ…). GIỮ nguyên sản phẩm đơn vị NGOÀI (vendor_kind='external').
const keepIds = SDVICO_SHOWCASE.map((p) => p.uuid);
const pruneSql = `-- SDFish — DỌN danh mục sản phẩm (2026-09-24). Chủ dự án: chỉ giữ ${SDVICO_SHOWCASE.length} sản phẩm
-- SDVICO trong tài liệu chính thức; xóa các sản phẩm SDVICO không liên quan còn
-- sót trong bảng (bộ đàm, máy dò cá, hàng test…). Sinh TỰ ĐỘNG từ
-- src/data/sdvico-showcase.ts (scripts/gen-product-seed.mjs) — đừng sửa tay.
--
-- GIỮ nguyên sản phẩm ĐƠN VỊ NGOÀI (vendor_kind='external'). Idempotent.
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

delete from public.product_listings
where vendor_kind = 'sdvico'
  and id not in (${keepIds.map(q).join(", ")});
`;
const pruneOut = join(__dirname, "..", "supabase", "migrations", "0055_product_catalog_prune.sql");
writeFileSync(pruneOut, pruneSql, "utf8");
console.log(`[gen-product-seed] Ghi prune (giữ ${keepIds.length}) → ${pruneOut}`);
