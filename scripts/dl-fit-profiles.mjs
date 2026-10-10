// scripts/dl-fit-profiles.mjs  (npx tsx scripts/dl-fit-profiles.mjs --species "ngừ vằn")
// ─────────────────────────────────────────────────────────────────────────────
// TỐI ƯU THAM SỐ HỒ SƠ LOÀI bằng SẢN LƯỢNG THẬT (nhật ký eCDT × track VMS — nhãn của
// scripts/dl-build-labels.mjs). KHÔNG đổi dạng mô hình: chỉ dò lại SỐ trong SpeciesProfile
// (dải nhiệt, dải mồi, mức lệ thuộc mồi, cổng độ sâu, cổng cách bờ), dựng lại dự báo từ lưới
// vệ tinh ĐÃ CACHE (scripts/fish-validate-run.mjs --features full), không mạng.
//
// MỤC TIÊU: AUCeff (scripts/dl-eval.mjs) — P(ô của 1 kg cá loài s có điểm cao hơn ô của 1 giờ
// đánh của nhóm nghề bắt s). Đo "năng suất trên mỗi giờ đánh", không thưởng việc tô theo chỗ
// tàu hay đi.
//
// CHỐNG HỌC THUỘC (luật của repo — kiểm chéo bắt buộc):
//   gập theo THỜI GIAN: tháng 8 ↔ tháng 9 (ô sát nhau giống nhau ⇒ chia ngẫu nhiên là gian).
//   Fit trên một tháng, đo trên tháng kia. NHẬN tham số chỉ khi CẢ HAI chiều đều không tệ đi
//   và trung bình tăng ≥ MIN_GAIN; nhận thì fit lại trên cả hai tháng. Không qua ⇒ GIỮ NGUYÊN.
//   Cảnh báo: chỉ có MỘT MÙA (8–9/2026). Kết quả là hiệu chỉnh mùa gió Tây Nam, không phải
//   hồ sơ cả năm — ghi rõ trong file ra.
//
// Ra: <out>/fit-<loài>.json  {species, base, best, cv:{…}, accepted, caveat}
//   --grids ~/sdfish-data/fc-full/grids  --labels ~/sdfish-data/dl/labels  --out ~/sdfish-data/fit
//   --cfg '{"chlShift":-1}'  không dò, chỉ kiểm chéo gốc vs bộ chỉnh này (dùng khi đổi code nền)
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { buildFishForecast, parseErddapGrid, parseBathyGrid, SPECIES_PROFILES } from "../src/lib/fish-predict.ts";
import { attachDay, weightedAuc, readCsv, targetGears, ASFIS_TO_SHORT } from "./dl-eval.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
const GRIDS = home(arg("grids", "~/sdfish-data/fc-full/grids"));
const LAB = home(arg("labels", "~/sdfish-data/dl/labels"));
const OUT = home(arg("out", "~/sdfish-data/fit"));
const SPECIES = arg("species", null);
const MIN_GAIN = Number(arg("min-gain", 0.01));
// --cfg '<json>': KHÔNG dò — chỉ đo gốc vs bộ chỉnh đã chọn (kiểm lại trên code khác, vd main)
const FIXED_CFG = arg("cfg", null) ? JSON.parse(arg("cfg")) : null;
mkdirSync(OUT, { recursive: true });
if (!SPECIES) { console.error('cần --species "<tên ngắn>"'); process.exit(2); }

/* ── lưới đã cache theo ngày ─────────────────────────────────────────────── */
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
  .filter((x) => x.sst && x.chl);

/* ── nhãn ────────────────────────────────────────────────────────────────── */
const effAll = readCsv(join(LAB, "effort.csv"));
const catAll = readCsv(join(LAB, "catch.csv"));
const byDate = (rows) => { const m = new Map(); for (const r of rows) (m.get(r.date) ?? m.set(r.date, []).get(r.date)).push(r); return m; };
const effD = byDate(effAll), catD = byDate(catAll);
const gearS = {};
for (const r of catAll) if (ASFIS_TO_SHORT[r.species] === SPECIES) gearS[r.gear] = (gearS[r.gear] ?? 0) + +r.kg;
const tgGears = targetGears(gearS);

/* ── chỉ giữ loài đang fit trong mảng hồ sơ (điểm từng loài độc lập; nhanh hơn) ── */
const all = SPECIES_PROFILES.splice(0);
const prof = all.find((p) => p.short === SPECIES);
if (!prof) { console.error(`không có hồ sơ "${SPECIES}"`); process.exit(2); }
SPECIES_PROFILES.push(prof);
const base = structuredClone(prof);

/** Áp bộ chỉnh lên hồ sơ (tại chỗ). Mỗi khoá = một nút vặn; 0/1 = không đổi. */
function apply(cfg) {
  for (const k of Object.keys(prof)) if (!(k in base)) delete prof[k];
  Object.assign(prof, structuredClone(base));
  const sh = cfg.sstShift ?? 0, wd = cfg.sstWidth ?? 1;
  const tr = (a) => { const c = (a[1] + a[2]) / 2; return a.map((v) => +(c + (v - c) * wd + sh).toFixed(2)); };
  // LUẬT NGHIỆP VỤ (test fish-predict "trần nhiệt", chốt 2026-10-03): nước VN mùa hè 29,5–30,5 °C
  // ⇒ loài TẦNG MẶT không được HẠ phía nóng (sst[2], sst[3]) — chỉ chỉnh phía lạnh hoặc nâng trần.
  // Dữ liệu 8–9/2026 là MỘT mùa; hạ trần theo nó là phạt oan cả mùa hè sau.
  const surface = !base.tempSource || base.tempSource === "surface";
  const keepWarm = (a, b0) => {
    if (!surface) return a;
    const w = [a[0], a[1], Math.max(a[2], b0[2]), Math.max(a[3], b0[3])];
    w[1] = Math.min(w[1], w[2]);
    w[0] = Math.min(w[0], w[1]);
    return w;
  };
  prof.sst = keepWarm(tr(base.sst), base.sst);
  if (base.sstFallback) prof.sstFallback = keepWarm(tr(base.sstFallback), base.sstFallback);
  if (cfg.chlShift) prof.chlLog = base.chlLog.map((v) => +(v + cfg.chlShift).toFixed(2));
  if (cfg.food !== undefined) prof.foodDependence = cfg.food;
  if (cfg.depthScale && base.offshore) prof.offshore = base.offshore.map((v) => Math.round(v * cfg.depthScale));
  if (cfg.depthScale && base.inshore) prof.inshore = base.inshore.map((v) => Math.round(v * cfg.depthScale));
  // coastKm khai RIÊNG (ngừ vằn, nục heo [10,25] — nguồn RIMF, test khoá) ⇒ không dò
  if (cfg.coastScale && base.offshore && !base.coastKm) prof.coastKm = (base.coastKm ?? [20, 50]).map((v) => Math.round(v * cfg.coastScale));
}

/**
 * Nhãn tính SẴN theo khoá ô "lat,lon" (lưới lấp đủ = mọi ô SST hữu hạn, không đổi theo cấu hình):
 * mỗi ngày {pos:[[khoá, kg]], neg:[[khoá, giờ nhóm nghề]], area:[khoá]}. Mỗi cấu hình chỉ dựng dự báo.
 */
const prep = new Map();
for (const x of inputs) {
  const cells = [];
  for (let i = 0; i < x.sst.lats.length; i++)
    for (let k = 0; k < x.sst.lons.length; k++)
      if (Number.isFinite(x.sst.values[i][k])) cells.push({ lat: Math.round(x.sst.lats[i] * 100) / 100, lon: Math.round(x.sst.lons[k] * 100) / 100, sp: {} });
  const lab = attachDay(cells, effD.get(x.d) ?? [], catD.get(x.d) ?? [], ASFIS_TO_SHORT);
  const key = (c) => `${c.lat},${c.lon}`;
  const pos = [], neg = [];
  for (const [c, m] of lab.kg) if (m[SPECIES] > 0) pos.push([key(c), m[SPECIES]]);
  for (const [c, m] of lab.eff) {
    let h = 0;
    for (const gname of tgGears) h += m[gname] ?? 0;
    if (h > 0) neg.push([key(c), h]);
  }
  prep.set(x.d, { pos, neg, area: cells.map(key) });
}

/** Dựng dự báo cho các ngày, chấm nhãn đã tính sẵn; trả {eff, area, kg}. */
function evaluate(cfg, ds) {
  apply(cfg);
  const P = [], N = [], A = [];
  for (const x of inputs) {
    if (!ds.has(x.d)) continue;
    const fc = buildFishForecast(x.sst, x.chl, x.sla, Number(x.d.slice(5, 7)), {
      anom: x.anom, depth, climo, reef, frontSstFine: x.sstFine, frontChlFine: x.chlFine,
    });
    const sc = new Map(fc.cells.map((c) => [`${c.lat},${c.lon}`, c.sp?.[SPECIES] ?? 0])); // ô bị KEEP_MIN cắt = 0
    const d = prep.get(x.d);
    for (const [k, w] of d.pos) P.push([sc.get(k) ?? 0, w]);
    for (const [k, w] of d.neg) N.push([sc.get(k) ?? 0, w]);
    for (const k of d.area) A.push([sc.get(k) ?? 0, 1]);
  }
  return { eff: weightedAuc(P, N), area: weightedAuc(P, A), kg: P.reduce((a, b) => a + b[1], 0) };
}

const GRID = {
  sstShift: [-2, -1, -0.5, 0.5, 1, 2],
  sstWidth: [0.6, 0.8, 1.25, 1.5],
  // −0,4 là mép ở lượt đầu 2026-10-10 (13/16 loài nhận dừng đúng mép) ⇒ mở rộng tới −1,0
  chlShift: [-1, -0.8, -0.6, -0.4, -0.2, 0.2, 0.4],
  food: [0, 0.25, 0.5, 0.75],
  ...(base.offshore || base.inshore ? { depthScale: [0.5, 0.75, 1.5, 2] } : {}),
  ...(base.offshore && !base.coastKm ? { coastScale: [0.5, 0.75, 1.5] } : {}),
};

/** Leo toạ độ: mỗi nút vặn thử mọi mức, giữ mức tốt nhất nếu tăng > 0,002; 2 vòng. */
function fit(ds) {
  let cfg = {}, best = evaluate(cfg, ds);
  for (let round = 0; round < 2; round++) {
    let moved = false;
    for (const [k, vals] of Object.entries(GRID))
      for (const v of vals) {
        const c = { ...cfg, [k]: v };
        const r = evaluate(c, ds);
        if (r.eff > best.eff + 0.002 && r.area >= best.area - 0.02) { cfg = c; best = r; moved = true; }
      }
    if (!moved) break;
  }
  return { cfg, best };
}

const t0 = Date.now();
const months = [...new Set(inputs.map((x) => x.d.slice(0, 7)))];
const setOf = (m) => new Set(inputs.filter((x) => x.d.startsWith(m)).map((x) => x.d));
const allD = new Set(inputs.map((x) => x.d));
const baseAll = evaluate({}, allD);
const folds = months.map((test) => {
  const train = new Set([...allD].filter((d) => !d.startsWith(test)));
  const f = FIXED_CFG ? { cfg: FIXED_CFG, best: evaluate(FIXED_CFG, train) } : fit(train);
  const b = evaluate({}, setOf(test));
  const t = evaluate(f.cfg, setOf(test));
  return { test, cfg: f.cfg, trainEff: f.best.eff, testBase: b.eff, testFit: t.eff, testKg: Math.round(b.kg), gain: t.eff - b.eff };
});
const gains = folds.map((f) => f.gain).filter(Number.isFinite);
const meanGain = gains.reduce((a, b) => a + b, 0) / (gains.length || 1);
const accepted = gains.length === months.length && gains.every((x) => x >= -0.005) && meanGain >= MIN_GAIN;
const final = accepted ? (FIXED_CFG ? { cfg: FIXED_CFG, best: evaluate(FIXED_CFG, allD) } : fit(allD)) : { cfg: {}, best: baseAll };
apply(final.cfg);
const out = {
  species: SPECIES,
  builtAt: new Date().toISOString(),
  days: inputs.length,
  kg: Math.round(baseAll.kg),
  targetGears: tgGears,
  base: { aucEff: baseAll.eff, aucArea: baseAll.area },
  folds,
  meanGain,
  accepted,
  cfg: final.cfg,
  fitted: accepted ? { aucEff: final.best.eff, aucArea: final.best.area } : null,
  profile: accepted
    ? { sst: prof.sst, ...(prof.sstFallback ? { sstFallback: prof.sstFallback } : {}), chlLog: prof.chlLog, foodDependence: prof.foodDependence, offshore: prof.offshore, inshore: prof.inshore, coastKm: prof.coastKm }
    : null,
  caveat: "Một mùa (8–9/2026, gió Tây Nam), tàu có VMS (chủ yếu ≥15 m), sản lượng chia theo giờ đánh suy từ tốc độ VMS — không phải toạ độ mẻ. Payload không có HYCOM/Copernicus.",
  secs: Math.round((Date.now() - t0) / 1000),
};
writeFileSync(join(OUT, `fit-${SPECIES}.json`), JSON.stringify(out, null, 1));
console.log(`${SPECIES}: base ${baseAll.eff.toFixed(3)} · CV ${folds.map((f) => `${f.test} ${f.testBase.toFixed(3)}→${f.testFit.toFixed(3)}`).join(" · ")} · ${accepted ? "NHẬN " + JSON.stringify(final.cfg) : "giữ nguyên"} (${out.secs}s)`);
