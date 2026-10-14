// scripts/dl-eval-fleet.mjs  (npx tsx scripts/dl-eval-fleet.mjs --fleet-dir <thư mục lưới giữ-tháng-ra>)
// ─────────────────────────────────────────────────────────────────────────────
// KIỂM ĐỊNH KÊNH ĐỘI TÀU (FLEET_SCALE · FLEET_FULL_HOURS trong fish-predict.ts) bằng sản lượng
// thật DataLake — cùng nhãn, cùng lưới vệ tinh cache, cùng số đo với dl-fit-profiles.mjs.
//
// CHỐNG RÒ RỈ: ngày của tháng M chấm bằng lưới đội tàu dựng KHÔNG CÓ tháng M
//   node scripts/build-fleet-effort-grid.mjs --exclude-month 2026-08 --out <dir>/fleet-ex-2026-08.json
// (tháng kề vẫn có — đúng tình huống production: tháng 10 dùng tháng 9 + mấy ngày đầu tháng 10).
// Thêm biến thể "rò" (lưới đủ tháng) chỉ để biết TRẦN, không dùng chọn tham số.
//
// Số đo / loài: AUCeff = P(ô của 1 kg > ô của 1 giờ đánh của nhóm nghề bắt loài) — 0,5 là
// "không hơn chỗ tàu hay đi"; AUCarea = P(ô của 1 kg > một ô biển bất kỳ). Kênh đội tàu gần như
// CHẮC CHẮN nâng AUCarea (nó chính là chỗ tàu đi); câu hỏi thật là AUCeff có TỤT không.
//
// Ra: <out>/fleet-eval.json + bảng in ra màn hình.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { buildFishForecast, parseErddapGrid, parseBathyGrid } from "../src/lib/fish-predict.ts";
import { attachDay, weightedAuc, readCsv, targetGears, ASFIS_TO_SHORT } from "./dl-eval.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
const GRIDS = home(arg("grids", "~/sdfish-data/fc-full/grids"));
const LAB = home(arg("labels", "~/sdfish-data/dl/labels"));
const OUT = home(arg("out", "~/sdfish-data/fleet"));
const FLEET_DIR = home(arg("fleet-dir", "~/sdfish-data/fleet"));
const FULL = arg("fleet-full", "src/data/fleet-effort-025.v1.json");
const SCALES = (arg("scales", "0.3,0.5,0.7")).split(",").map(Number);
const HOURS = (arg("hours", "30,60,120")).split(",").map(Number);
// KÊNH SẢN LƯỢNG LOÀI (§11): --catch-dir <thư mục có catch-ex-<tháng>.json> ⇒ giữ kênh đội tàu ở
// cấu hình chốt (FLEET_SCALE/FLEET_FULL_HOURS mặc định, lưới giữ-tháng-ra) và dò kênh loài.
const CATCH_DIR = arg("catch-dir", null) && home(arg("catch-dir"));
const CATCH_SCALES = (arg("catch-scales", "0.5,0.7,1")).split(",").map(Number);
const CATCH_KG = (arg("catch-kg", "2000,8000,20000")).split(",").map(Number);
mkdirSync(OUT, { recursive: true });

const j = (f) => JSON.parse(readFileSync(join(GRIDS, f), "utf8"));
const has = new Set(readdirSync(GRIDS));
const dates = [...has].map((f) => /^sst-(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1]).filter(Boolean).sort();
const depth = parseBathyGrid(j("etopo.json"));
const climo = JSON.parse(readFileSync(new URL("../src/data/sst-climatology.v1.json", import.meta.url), "utf8")).regions;
const reef = JSON.parse(readFileSync(new URL("../src/data/reef-grid-025.v1.json", import.meta.url), "utf8"));
const g = (name, d, alt) => (has.has(`${name}-${d}.json`) && !j(`${name}-${d}.json`).missing ? parseErddapGrid(j(`${name}-${d}.json`), alt) : null);
const inputs = dates
  .map((d) => ({
    d,
    sst: g("sst", d, { hasAltitude: false, unit: "degC" }),
    chl: g("chl", d, { hasAltitude: true, unit: "mg/m3" }),
    sla: g("sla", d, { hasAltitude: false, unit: "m" }),
    anom: g("anom", d, { hasAltitude: false, unit: "degC" }),
    sstFine: g("sstFine", d, { hasAltitude: false, unit: "degC" }),
    chlFine: g("chlFine", d, { hasAltitude: true, unit: "mg/m3" }),
  }))
  .filter((x) => x.sst && x.chl)
  // --month 2026-08: chỉ chấm một tháng (đọc từng chiều gập riêng)
  .filter((x) => !arg("month", null) || x.d.startsWith(arg("month")));
const months = [...new Set(inputs.map((x) => x.d.slice(0, 7)))];
const heldOut = Object.fromEntries(months.map((m) => {
  const f = join(FLEET_DIR, `fleet-ex-${m}.json`);
  if (!existsSync(f)) { console.error(`thiếu ${f} — chạy build-fleet-effort-grid.mjs --exclude-month ${m} --out ${f}`); process.exit(2); }
  return [m, JSON.parse(readFileSync(f, "utf8"))];
}));
const fullGrid = JSON.parse(readFileSync(FULL, "utf8"));
const catchHeld = CATCH_DIR ? Object.fromEntries(months.map((m) => {
  const f = join(CATCH_DIR, `catch-ex-${m}.json`);
  if (!existsSync(f)) { console.error(`thiếu ${f} — chạy build-species-catch-grid.mjs --exclude-month ${m} --out ${f}`); process.exit(2); }
  return [m, JSON.parse(readFileSync(f, "utf8"))];
})) : null;
const catchFull = CATCH_DIR && existsSync(join(CATCH_DIR, "catch-full.json")) ? JSON.parse(readFileSync(join(CATCH_DIR, "catch-full.json"), "utf8")) : null;

/* ── nhãn ── */
const effAll = readCsv(join(LAB, "effort.csv"));
const catAll = readCsv(join(LAB, "catch.csv"));
const byDate = (rows) => { const m = new Map(); for (const r of rows) (m.get(r.date) ?? m.set(r.date, []).get(r.date)).push(r); return m; };
const effD = byDate(effAll), catD = byDate(catAll);
const gearSp = {};
for (const r of catAll) { const s = ASFIS_TO_SHORT[r.species]; if (s) (gearSp[s] ??= {})[r.gear] = (gearSp[s][r.gear] ?? 0) + +r.kg; }
const SPECIES = Object.keys(gearSp).filter((s) => Object.values(gearSp[s]).reduce((a, b) => a + b, 0) > 0).sort();
const tg = Object.fromEntries(SPECIES.map((s) => [s, targetGears(gearSp[s])]));

const prep = new Map();
for (const x of inputs) {
  const cells = [];
  for (let i = 0; i < x.sst.lats.length; i++)
    for (let k = 0; k < x.sst.lons.length; k++)
      if (Number.isFinite(x.sst.values[i][k])) cells.push({ lat: Math.round(x.sst.lats[i] * 100) / 100, lon: Math.round(x.sst.lons[k] * 100) / 100, sp: {} });
  const lab = attachDay(cells, effD.get(x.d) ?? [], catD.get(x.d) ?? [], ASFIS_TO_SHORT);
  const key = (c) => `${c.lat},${c.lon}`;
  const per = {};
  for (const s of SPECIES) {
    const pos = [], neg = [];
    for (const [c, m] of lab.kg) if (m[s] > 0) pos.push([key(c), m[s]]);
    for (const [c, m] of lab.eff) { let h = 0; for (const gn of tg[s]) h += m[gn] ?? 0; if (h > 0) neg.push([key(c), h]); }
    per[s] = { pos, neg };
  }
  prep.set(x.d, { per, area: cells.map(key) });
}

/** cấu hình {fleet:"none"|"held"|"full", scale, hours} → {loài: {eff, area, kg}} */
function evaluate(cfg) {
  const acc = Object.fromEntries(SPECIES.map((s) => [s, { P: [], N: [], A: [] }]));
  for (const x of inputs) {
    const fleet = cfg.fleet === "none" ? null : cfg.fleet === "full" ? fullGrid : heldOut[x.d.slice(0, 7)];
    const fc = buildFishForecast(x.sst, x.chl, x.sla, Number(x.d.slice(5, 7)), {
      anom: x.anom, depth, climo, reef, frontSstFine: x.sstFine, frontChlFine: x.chlFine,
      fleet, fleetScale: cfg.scale, fleetFullHours: cfg.hours,
      catchGrid: cfg.catch === "held" ? catchHeld[x.d.slice(0, 7)] : cfg.catch === "full" ? catchFull : null,
      catchScale: cfg.cScale, catchFullKg: cfg.cKg,
    });
    const sc = new Map(fc.cells.map((c) => [`${c.lat},${c.lon}`, c.sp ?? {}]));
    const d = prep.get(x.d);
    for (const s of SPECIES) {
      const a = acc[s];
      const v = (k) => sc.get(k)?.[s] ?? 0;
      for (const [k, w] of d.per[s].pos) a.P.push([v(k), w]);
      for (const [k, w] of d.per[s].neg) a.N.push([v(k), w]);
      if (d.per[s].pos.length) for (const k of d.area) a.A.push([v(k), 1]);
    }
  }
  return Object.fromEntries(SPECIES.map((s) => {
    const a = acc[s];
    return [s, { eff: weightedAuc(a.P, a.N), area: weightedAuc(a.P, a.A), kg: a.P.reduce((t, b) => t + b[1], 0) }];
  }));
}

const t0 = Date.now();
const res = { base: evaluate({ fleet: "none" }) };
if (!CATCH_DIR) {
  for (const sc of SCALES) for (const h of HOURS) {
    res[`held s${sc} h${h}`] = evaluate({ fleet: "held", scale: sc, hours: h });
    console.error(`… s${sc} h${h} ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  res["full s0.5 h60 (rò — chỉ để biết trần)"] = evaluate({ fleet: "full", scale: 0.5, hours: 60 });
} else {
  res["held fleet (chốt §10)"] = evaluate({ fleet: "held" });
  for (const cs of CATCH_SCALES) for (const kg of CATCH_KG) {
    res[`held fleet+catch s${cs} kg${kg}`] = evaluate({ fleet: "held", catch: "held", cScale: cs, cKg: kg });
    console.error(`… catch s${cs} kg${kg} ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  res["held catch, không đội tàu"] = evaluate({ fleet: "none", catch: "held" });
  if (catchFull) res["full fleet+catch (rò — chỉ để biết trần)"] = evaluate({ fleet: "full", catch: "full" });
}

const kgW = (r) => { let e = 0, a = 0, k = 0; for (const s of SPECIES) { const x = r[s]; if (Number.isFinite(x.eff) && Number.isFinite(x.area)) { e += x.eff * x.kg; a += x.area * x.kg; k += x.kg; } } return { eff: e / k, area: a / k }; };
const rows = Object.entries(res).map(([name, r]) => ({ name, ...kgW(r) }));
console.log("cấu hình | AUCeff TB theo kg | AUCarea TB theo kg");
for (const r of rows) console.log(`${r.name} | ${r.eff.toFixed(3)} | ${r.area.toFixed(3)}`);
const best = rows.filter((r) => r.name.startsWith("held")).sort((a, b) => b.eff - a.eff)[0];
const ref = CATCH_DIR ? "held fleet (chốt §10)" : "base";
console.log(`\ntừng loài (${ref} → ${best.name}) eff · area · tấn:`);
for (const s of SPECIES.sort((a, b) => res.base[b].kg - res.base[a].kg)) {
  const b = res[ref][s], f = res[best.name][s];
  console.log(`${s} | ${b.eff.toFixed(3)} → ${f.eff.toFixed(3)} | ${b.area.toFixed(3)} → ${f.area.toFixed(3)} | ${Math.round(b.kg / 1000)}`);
}
writeFileSync(join(OUT, CATCH_DIR ? "catch-eval.json" : "fleet-eval.json"), JSON.stringify({ builtAt: new Date().toISOString(), days: inputs.length, months, species: SPECIES, targetGears: tg, summary: rows, perSpecies: res }, null, 1));
console.log(`\n${inputs.length} ngày · ${Math.round((Date.now() - t0) / 1000)}s → ${join(OUT, CATCH_DIR ? "catch-eval.json" : "fleet-eval.json")}`);
