// GỘP THAM SỐ MÔ HÌNH ĐÃ ĐO → public/data/model-params.v1.json (2026-09-16).
//
// Nguồn sự thật: src/data/fish-blend-weights.json (scripts/fit-fish-blend-weights.mjs)
// và src/data/forecast-skill.json (scripts/forecast-backtest.mjs). App KHÔNG
// import hai file đó nữa (bundle JS ai cũng đọc); nó tải file gộp này — nhóm
// SDF2 (gzip + AES, khoá theo tài khoản) lúc build Vercel.
//
// Chạy lại SAU MỖI LẦN fit/backtest:  node scripts/build-model-params.mjs
// Cổng `model-params.test.ts` đỏ nếu file gộp lệch nguồn.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OUT = join("public", "data", "model-params.v1.json");
// Dùng dấu "/" CỐ ĐỊNH (không `join`): các chuỗi này đi thẳng vào `builtFrom`
// của tệp phát hành, nên phải KHÔNG phụ thuộc HĐH — `join` cho "src\\data\\…"
// trên Windows ⇒ tệp sinh trên Windows khác tệp sinh trên macOS/CI (Linux) ⇒
// model-params.test.ts đỏ trên mọi máy khác máy đã build. `readFileSync(join(
// root, p))` bên dưới vẫn chạy đúng vì Node chuẩn hoá "/" khi đọc trên Windows.
export const SOURCES = {
  fishBlend: "src/data/fish-blend-weights.json",
  forecastSkill: "src/data/forecast-skill.json",
};

/** @param {string} root gốc repo */
export function buildModelParams(root = process.cwd()) {
  const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
  return {
    v: 1,
    builtFrom: Object.values(SOURCES),
    fishBlend: read(SOURCES.fishBlend),
    forecastSkill: read(SOURCES.forecastSkill),
  };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = buildModelParams();
  writeFileSync(join(process.cwd(), OUT), JSON.stringify(out) + "\n");
  console.log(`[model-params] ghi ${OUT}`);
}
