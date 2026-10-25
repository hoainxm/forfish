#!/usr/bin/env node
// GHÉP "VÙNG NÀY HAY ĐÁNH CÁ GÌ" VÀO LƯỚI MẬT ĐỘ TÀU → public/data/fleet-density.v1.json (2026-10-25).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: anh Long 25/10 — "tàu đánh xong lần ngược lại là vùng đó sẽ hay đánh cá gì luôn".
// NGUỒN: lưới sản lượng loài src/data/species-catch-025.v1.json (nhật ký × giờ đánh, ô ≥3 tàu, đã ẩn danh)
//   — CÙNG trục 0,25° với lưới mật độ. Gộp kg theo ô cho từng khoá: mùa ("nam"/"bac"), tháng-trong-năm
//   ("01".."12") và "tat" (cả năm); mỗi ô giữ TOP 3 loài theo % kg (làm tròn), bỏ loài < 5 %.
// RA NGOÀI chỉ có tên loài + phần trăm — không kg, không số tàu, không chữ nguồn (luật anh Long 25/10).
// Chạy SAU build-fleet-density (file mật độ đã kéo về): node scripts/add-density-species.mjs
import fs from "node:fs";

const DENSITY = process.argv[2] || "public/data/fleet-density.v1.json";
const CATCH = process.argv[3] || "src/data/species-catch-025.v1.json";
const TOP = 3, MIN_PCT = 5;

const d = JSON.parse(fs.readFileSync(DENSITY, "utf8"));
const c = JSON.parse(fs.readFileSync(CATCH, "utf8"));
if (JSON.stringify(d.axis) !== JSON.stringify(c.axis)) throw new Error("trục hai lưới lệch");

const seasonOf = (m) => (m >= 4 && m <= 9 ? "nam" : "bac");
const acc = {}; // key → "i,j" → species → kg
const add = (key, ij, sp, kg) => (((acc[key] ??= {})[ij] ??= {})[sp] = ((acc[key][ij][sp] ?? 0) + kg));
for (const ym of c.months) {
  const mm = ym.slice(5, 7);
  for (const [sp, rows] of Object.entries(c.effort[ym] ?? {})) {
    for (const [i, j, kg] of rows) {
      if (!(kg > 0)) continue;
      const ij = `${i},${j}`;
      add("tat", ij, sp, kg);
      add(mm, ij, sp, kg);
      add(seasonOf(Number(mm)), ij, sp, kg);
    }
  }
}
const out = {};
let cells = 0;
for (const [key, byCell] of Object.entries(acc)) {
  out[key] = {};
  for (const [ij, bySp] of Object.entries(byCell)) {
    const total = Object.values(bySp).reduce((a, b) => a + b, 0);
    const top = Object.entries(bySp)
      .map(([sp, kg]) => [sp, Math.round((kg / total) * 100)])
      .filter(([, p]) => p >= MIN_PCT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP);
    if (top.length) { out[key][ij] = top; cells++; }
  }
}
d.species = out;
d.speciesKeys = { season: ["nam", "bac"], month: c.months.map((m) => m.slice(5, 7)), all: "tat" };
fs.writeFileSync(DENSITY, JSON.stringify(d));
console.log(`[species] ${Object.keys(out).length} khoá · ${cells} ô có loài · file ${(fs.statSync(DENSITY).size / 1024 / 1024).toFixed(1)} MB`);
