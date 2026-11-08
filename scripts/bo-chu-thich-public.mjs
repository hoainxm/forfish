#!/usr/bin/env node
// BỎ CHÚ THÍCH `public/*.js` LÚC BUILD (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #12).
//
// `public/sw.js` + worker phát NGUYÊN VĂN ra máy (không qua bundler/minify như `.next/static`) ⇒ chú thích trong đó đi
// xuống máy bà con, kèm tên nguồn, cách làm. Bản trong git GIỮ chú thích (người đọc + test đọc thẳng hàm từ sw.js).
// Bước này chỉ chạy lúc build phát hành, cùng cờ với encode-data: `VERCEL=1` / `SDFISH_ENCODE_DATA=1` / `--force`.
// Lỡ chạy trên máy dev:  git checkout -- public/sw.js public/*.worker.js
//
// Dùng terser KÈM SẴN trong Next (không thêm dependency), `compress:false, mangle:false`: chỉ bỏ chú thích + khoảng
// trắng, KHÔNG đổi một phép tính nào — hành vi SW (kho, nhánh offline) y nguyên. Hỏng ⇒ build ĐỎ (không lặng lẽ phát
// bản còn chú thích).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Tệp được bỏ chú thích: mọi `.js` ở gốc `public/`. */
export function tepCongKhai(root = process.cwd()) {
  const pub = join(root, "public");
  return readdirSync(pub)
    .filter((t) => /\.(js|mjs)$/.test(t))
    .map((t) => join(pub, t));
}

/** Bỏ chú thích một đoạn JS (giữ nguyên ngữ nghĩa). @param {string} src @returns {Promise<string>} */
export async function boChuThichJs(src) {
  const { minify } = require("next/dist/compiled/terser");
  const r = await minify(src, { compress: false, mangle: false, format: { comments: false, beautify: true } });
  if (!r || typeof r.code !== "string" || !r.code.length) throw new Error("bo-chu-thich: terser không trả mã");
  return r.code + "\n";
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const force = process.argv.includes("--force");
  if (!(force || process.env.VERCEL || process.env.SDFISH_ENCODE_DATA)) {
    console.log("[bo-chu-thich] bỏ qua — không phải build phát hành (đặt VERCEL=1 / SDFISH_ENCODE_DATA=1 / --force)");
    process.exit(0);
  }
  try {
    for (const p of tepCongKhai()) {
      const goc = readFileSync(p, "utf8");
      const moi = await boChuThichJs(goc);
      writeFileSync(p, moi);
      console.log(`[bo-chu-thich] ${p}: ${goc.length} → ${moi.length} ký tự`);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
