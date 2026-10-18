#!/usr/bin/env node
// scripts/dl-eval.mjs — KIỂM ĐỊNH lớp cá bằng SẢN LƯỢNG THẬT (nhật ký eCDT × track VMS,
// nhãn từ scripts/dl-build-labels.mjs). Offline, không mạng.
// ─────────────────────────────────────────────────────────────────────────────
// Khác fish-validate-positions.mjs (đo "tàu có ở ô nóng không"): ở đây có KG theo loài nên đo
// được "ô nóng có NHIỀU CÁ HƠN trên mỗi giờ đánh không" — tách được địa lý tàu hay đi.
//
// Với mỗi loài s (tên ngắn trong payload `sp`):
//   AUCeff  = P(điểm ô của 1 kg cá s > điểm ô của 1 giờ đánh của nhóm nghề bắt s)
//             0,5 = dự báo không hơn "chỗ tàu hay đi"; > 0,5 = chỉ đúng chỗ năng suất cao.
//   AUCarea = P(điểm ô của 1 kg cá s > điểm 1 ô biển ngẫu nhiên) — so với cả biển (dễ hơn).
//   Δdyn    = AUCeff(cùng ngày) − TB AUCeff(nhãn ngày d ghép dự báo ngày d' khác) — phần
//             "hôm nay cá ở đâu" thật sự đến từ ảnh vệ tinh ngày đó. p = tỉ lệ hoán vị ≥ thật.
// Nhóm nghề bắt s = các nghề mang về ≥ TG_SHARE sản lượng của loài s (targetGears).
//
//   node scripts/dl-eval.mjs --payloads ~/sdfish-data/fc-full/payload-fill --labels ~/sdfish-data/dl/labels
//        [--perm 200] [--min-kg 2000] [--json out.json] [--names names.json]
// `--names`: {"MÃ ASFIS": "tên ngắn"} đè bảng ASFIS_TO_SHORT.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { indexGrid, inferStep } from "./fish-validate-positions.mjs";

export const TG_SHARE = 0.1;

/**
 * Mã loài ASFIS (eCDT) → tên ngắn hồ sơ. Ghép theo MÃ vì tên API không thống nhất (SQZ vừa
 * "Mực ống" vừa "Mực giã"). Dựng 2026-10-10 từ 107.109 nhật ký 8–9/2026; mã gộp nhóm
 * (CTA cá tạp, CXO cá xô, FRZ ngừ xô…) và loài không có hồ sơ (LOT ngừ bò, ECP cá chuồn…)
 * cố ý KHÔNG ghép. Thiếu cá kẽm, cá lầm, cá khoai, tôm sú: eCDT không có mã tương ứng rõ.
 */
export const ASFIS_TO_SHORT = {
  SKJ: "ngừ vằn", BLT: "ngừ ồ", FRI: "ngừ chù", KAW: "ngừ chấm", YFT: "ngừ vây vàng", BET: "ngừ mắt to",
  KGX: "cá thu", COM: "cá thu", GUT: "cá thu",
  BLM: "cá cờ", SFA: "cá cờ", BIL: "cá cờ", MLS: "cá cờ",
  DOL: "nục heo", CFW: "nục heo",
  TUM: "cá ngân",
  MSD: "cá nục", DCC: "cá nục", RUS: "cá nục", DCK: "cá nục", SDX: "cá nục", RSA: "cá nục",
  ESR: "cá cơm", END: "cá cơm", STL: "cá cơm", STO: "cá cơm", ECT: "cá cơm",
  CLP: "cá trích", SIX: "cá trích", RWA: "cá trích",
  RAG: "bạc má", RAX: "bạc má", BIS: "cá tráo", HAS: "cá sòng", TRY: "chỉ vàng",
  LHT: "cá hố", TKR: "cá hố",
  OMZ: "mực xà", SQZ: "mực ống", OJH: "mực ống", SQC: "mực ống", UHL: "mực lá",
  IAX: "mực nang", IEX: "mực nang", EIY: "mực nang", IEJ: "mực nang", ILR: "mực nang",
  OCZ: "bạch tuộc", OQR: "bạch tuộc", OCC: "bạch tuộc",
  SZX: "cá mối", THB: "cá đổng", THG: "cá đổng", NNJ: "cá đổng", GOX: "cá phèn", RQF: "cá phèn",
  CDX: "cá đù", LKR: "cá đù", CUP: "cá chim", POB: "cá chim", SOX: "cá bơn", TOX: "cá bơn", LEF: "cá bơn",
  SNA: "cá hồng", LJB: "cá hồng", LUB: "cá hồng", GPX: "cá mú", CFI: "cá mú", IIX: "cá mú",
  PEZ: "tôm bạc", MQT: "tôm bạc", SCD: "ghẹ xanh", SHS: "ruốc",
};

/**
 * AUC có trọng số: P(score(pos) > score(neg)) (+½ khi bằng). pos/neg = [[score, w]].
 */
export function weightedAuc(pos, neg) {
  // Điểm dự báo là số nguyên 0..100 ⇒ đếm theo histogram, O(n) — gọi hàng nghìn lần khi hoán vị.
  const allInt = (a) => a.every(([s]) => Number.isInteger(s) && s >= 0 && s <= 100);
  if (allInt(pos) && allInt(neg)) {
    const hp = new Float64Array(101), hn = new Float64Array(101);
    for (const [s, w] of pos) hp[s] += w;
    for (const [s, w] of neg) hn[s] += w;
    let P = 0, N = 0, acc = 0;
    for (let s = 0; s <= 100; s++) { acc += hp[s] * (N + hn[s] / 2); N += hn[s]; P += hp[s]; }
    return P > 0 && N > 0 ? acc / (P * N) : NaN;
  }
  const all = [...pos.map(([s, w]) => [s, w, 0]), ...neg.map(([s, w]) => [s, 0, w])].sort((a, b) => a[0] - b[0]);
  let P = 0, N = 0, acc = 0, negBelow = 0;
  for (let i = 0; i < all.length; ) {
    let j = i, p = 0, n = 0;
    while (j < all.length && all[j][0] === all[i][0]) { p += all[j][1]; n += all[j][2]; j++; }
    acc += p * (negBelow + n / 2);
    negBelow += n; P += p; N += n;
    i = j;
  }
  return P > 0 && N > 0 ? acc / (P * N) : NaN;
}

/**
 * Nhóm nghề bắt loài s = các nghề mang về ≥ TG_SHARE sản lượng CỦA LOÀI ĐÓ.
 * (Bản đầu lấy theo tỉ trọng trong nghề ⇒ loài phụ như cá tráo/nục heo ra nhóm rỗng.)
 * @param {Record<string, number>} kgByGear sản lượng loài s theo nghề
 */
export function targetGears(kgByGear) {
  const tot = Object.values(kgByGear).reduce((a, b) => a + b, 0);
  return Object.keys(kgByGear).filter((g) => kgByGear[g] / tot >= TG_SHARE);
}

export function readCsv(f) {
  const [h, ...ls] = readFileSync(f, "utf8").split("\n").filter(Boolean);
  const cols = h.split(",");
  return ls.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

async function selftest() {
  if (Math.abs(weightedAuc([[1, 1]], [[0, 1]]) - 1) > 1e-9) throw new Error("auc 1");
  if (Math.abs(weightedAuc([[1, 1]], [[1, 1]]) - 0.5) > 1e-9) throw new Error("auc tie");
  if (Math.abs(weightedAuc([[0, 3], [2, 1]], [[1, 1]]) - 0.25) > 1e-9) throw new Error("auc w");
  if (Math.abs(weightedAuc([[0.5, 3], [2, 1]], [[1, 1]]) - 0.25) > 1e-9) throw new Error("auc w (đường sắp xếp)");
  if (JSON.stringify(targetGears({ a: 95, b: 5 })) !== '["a"]') throw new Error("targetGears");
  const { SPECIES_PROFILES: P } = await import("../src/lib/fish-predict.ts");
  const shorts = new Set(P.map((p) => p.short));
  const bad = Object.entries(ASFIS_TO_SHORT).filter(([, v]) => !shorts.has(v));
  if (bad.length) throw new Error(`ASFIS_TO_SHORT trỏ tới loài không có hồ sơ: ${JSON.stringify(bad)}`);
  console.log("selftest OK");
}


/* ── BỘ ĐO TRUNG THỰC (đợt 1, docs/app-map/ops/fish-train-review-2026-10-18) ─────────────────────
 * Mỗi (khối ngày, loài) giữ MỘT bản ghi histogram điểm 0..100 (Float64Array), bố cục:
 *   [0] hpAll  kg loài s của MỌI nghề (đúng "pos" của AUCeff cũ)
 *   [1] ha     số ô biển (chỉ ngày loài s có kg)           — mẫu số của AUCarea
 *   [2+2k] hp_k, [3+2k] hn_k  kg của loài s / giờ đánh, CHỈ của nghề thứ k trong targetGears(s)
 * Bootstrap khối ngày = cộng các bản ghi khối; AUC tính lại từ histogram. */
export const NB = 101;
export const recLen = (G) => NB * (2 + 2 * G);

/** AUC từ hai histogram con (offset oa, ob trong mảng a, b); ties tính ½. */
export function aucHist(a, oa, b, ob) {
  let P = 0, N = 0, acc = 0;
  for (let v = 0; v < NB; v++) { const p = a[oa + v], n = b[ob + v]; acc += p * (N + n / 2); N += n; P += p; }
  return P > 0 && N > 0 ? acc / (P * N) : NaN;
}

/**
 * Số đo của một bản ghi. eff = AUCeff CŨ (pos mọi nghề vs giờ hợp các nghề mục tiêu); within = AUCeff
 * TRONG-NGHỀ Σ_g w_g·AUC(pos_{s,g}, neg_g) (w_g = kg loài s của nghề g, chuẩn lại trên nghề đo được);
 * area = AUCarea; kgAll/kgW = trọng số kg của hai số đầu.
 */
export function recMetrics(rec, G) {
  const hnU = new Float64Array(NB);
  let kgAll = 0, wSum = 0, wAuc = 0;
  for (let v = 0; v < NB; v++) kgAll += rec[v];
  for (let k = 0; k < G; k++) {
    const op = (2 + 2 * k) * NB, on = (3 + 2 * k) * NB;
    let w = 0;
    for (let v = 0; v < NB; v++) { hnU[v] += rec[on + v]; w += rec[op + v]; }
    const a = aucHist(rec, op, rec, on);
    if (Number.isFinite(a) && w > 0) { wSum += w; wAuc += w * a; }
  }
  return { eff: aucHist(rec, 0, hnU, 0), area: aucHist(rec, 0, rec, NB), within: wSum > 0 ? wAuc / wSum : NaN, kgAll, kgW: wSum };
}

/** Cỡ mẫu hiệu dụng Kish (Σw)²/Σw² */
export function kishNeff(w) {
  let s = 0, s2 = 0;
  for (const x of w) { s += x; s2 += x * x; }
  return s2 > 0 ? (s * s) / s2 : 0;
}

/** LCG 31 bit trả [0,1) — cùng họ với dl-eval để chạy lại ra đúng số. */
export function makeRng(seed) {
  let r = seed;
  return () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/** Phân vị p∈[0,1] của mảng ĐÃ SẮP XẾP tăng (nội suy tuyến tính). */
export function quantile(sorted, p) {
  if (!sorted.length) return NaN;
  const x = (sorted.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
}

/** Khoảng tin cậy 90 % (phân vị 5–95) của một dãy thống kê bootstrap (bỏ NaN). */
export function ci90(samples) {
  const v = Array.from(samples).filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? [quantile(v, 0.05), quantile(v, 0.95)] : [NaN, NaN];
}

/** B lần lấy mẫu có hoàn lại `nb` khối (mỗi lần trả mảng chỉ số khối). */
export function blockResamples(nb, B, seed = 11) {
  const rnd = makeRng(seed);
  return Array.from({ length: B }, () => Array.from({ length: nb }, () => Math.floor(rnd() * nb)));
}

/** Gắn nhãn theo ngày vào lưới; trả mỗi ngày {cells, eff:Map(cell→{gear→h}), kg:Map(cell→{sp→kg}), kgG:Map(cell→{sp→{gear→kg}})}. */
export function attachDay(cells, effRows, catchRows, nameMap) {
  const step = inferStep(cells);
  const g = indexGrid(cells, step);
  const keyOf = (lat, lon) => `${Math.round((lat - g.lat0) / g.step)},${Math.round((lon - g.lon0) / g.step)}`;
  const eff = new Map(), kg = new Map(), kgG = new Map();
  let dropE = 0, dropK = 0;
  for (const r of effRows) {
    const c = g.map.get(keyOf(+r.lat, +r.lon));
    if (!c) { dropE += +r.hours; continue; }
    const m = eff.get(c) ?? eff.set(c, {}).get(c);
    m[r.geartype] = (m[r.geartype] ?? 0) + +r.hours;
  }
  for (const r of catchRows) {
    const s = nameMap[r.species];
    if (!s) continue;
    const c = g.map.get(keyOf(+r.lat, +r.lon));
    if (!c) { dropK += +r.kg; continue; }
    const m = kg.get(c) ?? kg.set(c, {}).get(c);
    m[s] = (m[s] ?? 0) + +r.kg;
    // theo NGHỀ (cột gear của catch.csv) — cho AUCeff trong-nghề
    const mg = kgG.get(c) ?? kgG.set(c, {}).get(c);
    const gs = mg[s] ?? (mg[s] = {});
    gs[r.gear] = (gs[r.gear] ?? 0) + +r.kg;
  }
  return { cells, eff, kg, kgG, dropE, dropK };
}

// Chạy như script (không chạy khi bộ tối ưu import các hàm ở trên).
if (process.argv[1]?.endsWith("dl-eval.mjs")) {
if (process.argv.includes("--selftest")) { await selftest(); process.exit(0); }

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
const PAY = home(arg("payloads", "~/sdfish-data/fc-full/payload-fill"));
const LAB = home(arg("labels", "~/sdfish-data/dl/labels"));
const PERM = Number(arg("perm", 200));
const MIN_KG = Number(arg("min-kg", 2000));
const SEED = Number(arg("seed", 7));

const { SPECIES_PROFILES } = await import("../src/lib/fish-predict.ts");

const payloads = readdirSync(PAY).filter((f) => /^payload-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(PAY, f), "utf8")));
const dates = payloads.map((p) => p.date);
const effAll = readCsv(join(LAB, "effort.csv"));
const catAll = readCsv(join(LAB, "catch.csv"));

// ghép tên loài
const apiNames = [...new Set(catAll.map((r) => r.species))];
const override = arg("names", null) ? JSON.parse(readFileSync(home(arg("names")), "utf8")) : {};
const nameMap = {};
for (const n of apiNames) nameMap[n] = override[n] ?? ASFIS_TO_SHORT[n] ?? null;

// nhóm nghề bắt từng loài (toàn kỳ)
const gearTot = {}, gearSp = {};
for (const r of catAll) {
  gearTot[r.gear] = (gearTot[r.gear] ?? 0) + +r.kg;
  const s = nameMap[r.species];
  if (s) (gearSp[s] ??= {})[r.gear] = (gearSp[s][r.gear] ?? 0) + +r.kg;
}
const tg = (s) => targetGears(gearSp[s] ?? {});

// nhãn theo ngày CÓ dự báo
const byDate = (rows) => { const m = new Map(); for (const r of rows) (m.get(r.date) ?? m.set(r.date, []).get(r.date)).push(r); return m; };
const effD = byDate(effAll), catD = byDate(catAll);
const labs = payloads.map((p) => attachDay(p.cells, effD.get(p.date) ?? [], catD.get(p.date) ?? [], nameMap));
// tra ô của ngày khác theo toạ độ (lưới ổn định giữa các ngày nhưng ô có thể khác tập)
const cellKey = (c) => `${c.lat},${c.lon}`;
const idx = payloads.map((p) => new Map(p.cells.map((c) => [cellKey(c), c])));

/**
 * Tính SẴN cho loài s, mỗi ngày nhãn: [khoá ô, kg] (pos), [khoá ô, giờ nhóm nghề] (neg), khoá
 * mọi ô biển (area). Hoán vị chỉ đổi lưới điểm ⇒ không dựng lại các danh sách này.
 */
function prepare(s) {
  const gears = s === "*" ? Object.keys(gearTot) : tg(s);
  return labs.map((lab) => {
    const pos = [], neg = [];
    for (const [c, m] of lab.kg) {
      const k = s === "*" ? Object.values(m).reduce((a, b) => a + b, 0) : m[s] ?? 0;
      if (k > 0) pos.push([cellKey(c), k]);
    }
    for (const [c, m] of lab.eff) {
      let h = 0;
      for (const g of gears) h += m[g] ?? 0;
      if (h > 0) neg.push([cellKey(c), h]);
    }
    return { pos, neg, area: lab.cells.map(cellKey) };
  });
}

/** AUCeff/AUCarea của loài s khi nhãn ngày i chấm bằng lưới ngày pairing[i] — histogram điểm 0..100. */
function aucFor(s, prep, pairing) {
  const hp = new Float64Array(101), hn = new Float64Array(101), ha = new Float64Array(101);
  prep.forEach((d, i) => {
    const fc = idx[pairing[i]];
    const sc = (k) => {
      const c = fc.get(k);
      const v = (s === "*" ? c?.s : c?.sp?.[s]) ?? 0;
      return Math.max(0, Math.min(100, Math.round(v)));
    };
    for (const [k, w] of d.pos) hp[sc(k)] += w;
    for (const [k, w] of d.neg) hn[sc(k)] += w;
    for (const k of d.area) ha[sc(k)] += 1;
  });
  const auc = (h1, h0) => {
    let P = 0, N = 0, acc = 0;
    for (let v = 0; v <= 100; v++) { acc += h1[v] * (N + h0[v] / 2); N += h0[v]; P += h1[v]; }
    return P > 0 && N > 0 ? acc / (P * N) : NaN;
  };
  return { eff: auc(hp, hn), area: auc(hp, ha), kg: hp.reduce((a, b) => a + b, 0) };
}

let rng = SEED;
const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const ident = dates.map((_, i) => i);
const derange = () => {
  for (;;) {
    const a = [...ident];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.every((v, i) => v !== i)) return a;
  }
};
const perms = Array.from({ length: PERM }, derange);

const species = ["*", ...SPECIES_PROFILES.map((p) => p.short)];
const out = [];
for (const s of species) {
  const prep = prepare(s);
  const real = aucFor(s, prep, ident);
  if (!(real.kg >= MIN_KG)) continue;
  const nulls = perms.map((p) => aucFor(s, prep, p).eff).filter(Number.isFinite);
  const mean = nulls.reduce((a, b) => a + b, 0) / nulls.length;
  out.push({ species: s === "*" ? "(mọi loài · điểm s)" : s, kg: Math.round(real.kg), gears: s === "*" ? [] : tg(s), aucEff: real.eff, aucArea: real.area, nullEff: mean, dDyn: real.eff - mean, p: (nulls.filter((x) => x >= real.eff).length + 1) / (nulls.length + 1) });
}
out.sort((a, b) => b.kg - a.kg);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const dropE = labs.reduce((a, l) => a + l.dropE, 0), dropK = labs.reduce((a, l) => a + l.dropK, 0);
console.log(`${dates.length} ngày dự báo · giờ đánh ngoài lưới ${Math.round(dropE)} h · kg ngoài lưới ${Math.round(dropK)}`);
console.log(`loài API chưa ghép: ${apiNames.filter((n) => !nameMap[n]).length}/${apiNames.length}`);
console.log("loài | kg | AUCeff | AUCarea | AUCeff ngày-khác | Δdyn | p");
for (const r of out) console.log(`${r.species} | ${r.kg} | ${f3(r.aucEff)} | ${f3(r.aucArea)} | ${f3(r.nullEff)} | ${f3(r.dDyn)} | ${f3(r.p)}`);
const J = arg("json", null);
if (J) writeFileSync(home(J), JSON.stringify({ dates, nameMap, rows: out }, null, 1));
}
