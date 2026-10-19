// scripts/fish-base-build.mjs — DỰNG "lưới nền" bãi cá theo mùa (đợt 2A, docs/app-map/ops/fish-train-review-2026-10-18 §7).
//   npx tsx scripts/fish-base-build.mjs --fit <dir>/fish-base-fit.json [--catch-grid src/data/species-catch-025.v1.json] --out <tạm>/fish-base.v1.json
// Ghép: hệ số + bảng log-lift (fish-base-fit.json do dl-eval-honest sinh) + K_s theo loài và cờ tháng từ lưới sản lượng
// SẢN XUẤT. KHÔNG có dữ liệu theo ô: giá trị x theo ô vẫn đọc từ hai lưới đã có qua lib/fleet-effort.ts (cùng bundle,
// không thêm request). Mặc định ghi NGOÀI repo; chỉ ghi vào public/data/ khi qua cổng 2A VÀ có chủ ý (luật data-budget).
import fs from "node:fs";
import { homedir } from "node:os";
import { ksOfGrid } from "./fish-base-fit.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const MAX_BYTES = 1024 * 1024;

export function assemble(fit, catchGrid, builtFrom = null) {
  const months = catchGrid.months;
  const moy = (ym) => Number(ym.slice(5, 7));
  const have = new Set(months.map(moy));
  const ks = ksOfGrid(catchGrid);
  return {
    v: 1,
    builtAt: new Date().toISOString(),
    ...(builtFrom ? { builtFrom } : {}),
    mode: fit.mode,
    hotShare: r4(fit.hotShare),
    ksKg: Object.fromEntries(Object.entries(ks).map(([s, k]) => [s, Math.round(k)])),
    coef: Object.fromEntries(Object.entries(fit.coef).map(([g, c]) => [g, c.map(r4)])),
    coefNoCatch: Object.fromEntries(Object.entries(fit.coefNoCatch).map(([g, c]) => [g, c.map(r4)])),
    staticLift: Object.fromEntries(Object.entries(fit.staticLift).map(([s, t]) => [s, { depth: t.depth.map(r4), coast: t.coast.map(r4), lat: t.lat.map(r4) }])),
    fleetOnly: fit.fleetOnly ?? [],
    catchMonths: months,
    catchSameMonth: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), have.has(i + 1)])),
  };
}

if (process.argv[1]?.endsWith("fish-base-build.mjs")) {
  const fitFile = arg("fit", null), out = arg("out", null);
  if (!fitFile || !out) { console.error("thiếu --fit <fish-base-fit.json> --out <đường dẫn>"); process.exit(2); }
  const fit = JSON.parse(fs.readFileSync(home(fitFile), "utf8"));
  const grid = JSON.parse(fs.readFileSync(home(arg("catch-grid", "src/data/species-catch-025.v1.json")), "utf8"));
  // nguồn + ngày fit + phiên bản nhãn (luật: ghi trong chính file) — từ report.json của nhãn v2
  fit.fitMonths = ["2026-08", "2026-09"];
  const rep = arg("labels-report", null) ? JSON.parse(fs.readFileSync(home(arg("labels-report")), "utf8")) : null;
  const builtFrom = {
    fitDate: new Date().toISOString().slice(0, 10),
    labels: rep ? { dir: rep.source?.dir, from: rep.source?.from, to: rep.source?.to, builtAt: rep.builtAt, scriptSha: rep.scriptSha } : arg("labels-name", null),
    fitMonths: fit.fitMonths ?? null,
    catchGridBuiltFrom: grid.builtFrom ?? null,
    note: "hệ số + bảng tĩnh fit trên 61 ngày 8–9/2026 (nhãn v2, gập tháng này/tháng kia); K_s = trung vị kg ô-tháng dương của lưới sản lượng",
  };
  if (arg("hot-share", null)) fit.hotShare = Number(arg("hot-share")); // miền xếp hạng của buildFishForecast nhỏ hơn lưới đo ⇒ hiệu chỉnh riêng (README §7.9)
  const res = assemble(fit, grid, builtFrom);
  const txt = JSON.stringify(res);
  fs.writeFileSync(home(out), txt);
  const ok = Buffer.byteLength(txt) <= MAX_BYTES;
  console.log(`[fish-base] ${home(out)} · ${(Buffer.byteLength(txt) / 1024).toFixed(1)} KB ${ok ? "≤" : ">"} 1 MB · ${Object.keys(res.ksKg).length} loài · tháng có kg ${res.catchMonths.join(",")} · tháng-trong-năm thiếu kg: ${Object.entries(res.catchSameMonth).filter(([, v]) => !v).map(([m]) => m).join(",") || "—"}`);
  if (!ok) process.exit(1);
}
