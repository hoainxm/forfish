#!/usr/bin/env node
// scripts/gear-infer.mjs — SUY NGHỀ cho tàu sổ tàu để NULL (rà pipeline 2026-10-18, nhãn Q2 / mảnh 2C).
// ─────────────────────────────────────────────────────────────────────────────
// Naive Bayes thuần JS: tỉ trọng loài theo kg của TÀU (gộp mọi nhật ký) + dải chiều dài + dải công suất.
// Huấn luyện trên tàu có nghề, 6 lớp (vây/câu/rê/kéo/chụp/khác); GIỮ 20 % tàu để kiểm theo hash mã tàu
// (xô 8–9 của scripts/vessel-bucket.mjs); số "mẻ chứng" N0 chọn trên xô 6–7, KHÔNG nhìn xô kiểm.
// Chỉ áp posterior ≥ THR (0,7) cho tàu chưa có nghề và đủ ≥ MIN_KG kg; còn lại giữ "?".
// Ra gear-map.json (ngoài repo): {vessels:{id:{group,gear,p}}, holdout:{…}} — nhãn v2 và lưới đội tàu v2 đọc
// cùng một file ⇒ một tàu ở cùng một nghề ở mọi nơi. Cột `gear_src` của nhãn = registry | inferred.
//   node scripts/gear-infer.mjs --dir ~/sdfish-data/dl-all --out ~/sdfish-data/dl-all/gear-map.json
//   node scripts/gear-infer.mjs --selftest
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { gearGroup, GEARS, GROUP_NAME } from "./fishing-def.mjs";
import { vesselBucket } from "./vessel-bucket.mjs";

export const THR = 0.7;
export const MIN_KG = 500;
export const TOP_K = 80;
export const LEN_EDGES = [9, 12, 15, 18, 24, 30];
export const PWR_EDGES = [90, 250, 400, 600, 800, 1000];
const bin = (v, edges) => { if (!Number.isFinite(v)) return edges.length + 1; let i = 0; while (i < edges.length && v >= edges[i]) i++; return i; };

/** kg loài bốc dỡ của nhật ký (giống landedOf của dl-build-labels). */
export const landedOf = (lb) => ((lb.landedKg ?? 0) > 0 ? lb.species?.landed : lb.species?.catch) ?? [];

/** Gộp mọi nhật ký theo tàu → {kg theo mã loài, số chuyến, tổng kg}. */
export function vesselProfiles(logbooks) {
  const m = new Map();
  for (const lb of logbooks) {
    const id = lb.vessel?.id;
    if (!id) continue;
    const v = m.get(id) ?? m.set(id, { sp: new Map(), trips: 0, kg: 0, len: lb.vessel?.lengthM ?? null }).get(id);
    v.trips++;
    for (const x of landedOf(lb)) if (x.kg > 0) { v.sp.set(x.code || "?", (v.sp.get(x.code || "?") ?? 0) + x.kg); v.kg += x.kg; }
  }
  return m;
}

export const topCodesOf = (profiles, k = TOP_K) => {
  const t = new Map();
  for (const v of profiles.values()) for (const [c, kg] of v.sp) t.set(c, (t.get(c) ?? 0) + kg);
  return [...t].sort((a, b) => b[1] - a[1]).slice(0, k).map(([c]) => c);
};

/** Mẫu đặc trưng: share[k] (k = TOP_K + 1 ô "khác"), lb, pb, n (số chuyến chứng). */
export function featuresOf(profile, vessel, codes) {
  const idx = new Map(codes.map((c, i) => [c, i]));
  const share = new Float64Array(codes.length + 1);
  for (const [c, kg] of profile.sp) share[idx.get(c) ?? codes.length] += kg / profile.kg;
  const len = vessel?.lengthM ?? profile.len;
  return { share, lb: bin(len, LEN_EDGES), pb: bin(vessel?.powerCv, PWR_EDGES), trips: profile.trips };
}

export function trainNB(samples, { alpha = 0.5, N0 = 15 } = {}) {
  const K = GEARS.length, S = samples[0].x.share.length;
  const prior = new Array(K).fill(1), sp = Array.from({ length: K }, () => new Float64Array(S).fill(alpha));
  const nl = LEN_EDGES.length + 2, np = PWR_EDGES.length + 2;
  const lenC = Array.from({ length: K }, () => new Array(nl).fill(1)), pwrC = Array.from({ length: K }, () => new Array(np).fill(1));
  for (const { x, y } of samples) {
    prior[y]++;
    for (let s = 0; s < S; s++) sp[y][s] += x.share[s];
    lenC[y][x.lb]++;
    pwrC[y][x.pb]++;
  }
  const tot = prior.reduce((a, b) => a + b, 0);
  const norm = (a) => { const t = a.reduce((x, y) => x + y, 0); return a.map((v) => Math.log(v / t)); };
  return { N0, logPrior: prior.map((v) => Math.log(v / tot)), logTheta: sp.map((a) => norm([...a])), logLen: lenC.map(norm), logPwr: pwrC.map(norm) };
}

/** Posterior 6 lớp (softmax của log-hợp lý). */
export function predictNB(model, x) {
  const n = Math.min(x.trips, model.N0);
  const lp = model.logPrior.map((p, c) => {
    let s = p + model.logLen[c][x.lb] + model.logPwr[c][x.pb];
    let ll = 0;
    for (let k = 0; k < x.share.length; k++) if (x.share[k] > 0) ll += x.share[k] * model.logTheta[c][k];
    return s + n * ll;
  });
  const mx = Math.max(...lp);
  const e = lp.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0);
  const probs = e.map((v) => v / z);
  let best = 0;
  for (let c = 1; c < probs.length; c++) if (probs[c] > probs[best]) best = c;
  return { probs, best, p: probs[best] };
}

const logLoss = (model, set) => set.reduce((a, { x, y }) => a - Math.log(Math.max(predictNB(model, x).probs[y], 1e-9)), 0) / Math.max(set.length, 1);

/**
 * Dựng toàn bộ: nhật ký + sổ tàu → gear-map. Trả {map, holdout, params}.
 * vesselsById: Map id → {lengthM, powerCv, gear}.
 */
export function inferGears(logbooks, vesselsById, { thr = THR, minKg = MIN_KG } = {}) {
  const profiles = vesselProfiles(logbooks);
  const codes = topCodesOf(profiles);
  const known = [], unknown = [];
  for (const [id, p] of profiles) {
    if (!(p.kg > 0)) continue;
    const v = vesselsById.get(id);
    const g = v?.gear && v.gear !== "?" ? gearGroup(v.gear) : null;
    const x = featuresOf(p, v, codes);
    if (g) known.push({ id, x, y: GEARS.indexOf(g), kg: p.kg });
    else if (p.kg >= minKg) unknown.push({ id, x, kg: p.kg });
  }
  const tr = known.filter((s) => vesselBucket(s.id) <= 5), va = known.filter((s) => [6, 7].includes(vesselBucket(s.id))), te = known.filter((s) => vesselBucket(s.id) >= 8);
  // N0 (số chuyến chứng tối đa) chọn trên xô 6–7: phủ kg lớn nhất MÀ ĐỘ ĐÚNG trên phần đã phủ ≥ thr
  // (posterior ≥ thr phải thật sự đúng ≥ thr); không ứng viên nào đạt thì lấy log-loss nhỏ nhất.
  let N0 = 15, bestCov = -1, bestLL = Infinity, anyOk = false;
  for (const cand of [1, 2, 3, 5, 8, 15, 40, 100]) {
    const m = trainNB(tr, { N0: cand });
    let c = 0, ok2 = 0, kgc = 0;
    for (const s of va) { const r = predictNB(m, s.x); if (r.p >= thr) { c++; kgc += s.kg; if (r.best === s.y) ok2++; } }
    const ll = logLoss(m, va);
    if (c && ok2 / c >= thr) { if (kgc > bestCov) { bestCov = kgc; N0 = cand; anyOk = true; } }
    else if (!anyOk && ll < bestLL) { bestLL = ll; N0 = cand; }
  }
  const m80 = trainNB([...tr, ...va], { N0 });
  const conf = Array.from({ length: GEARS.length }, () => new Array(GEARS.length).fill(0));
  let ok = 0, okKg = 0, kgAll = 0, cov = 0, covOk = 0, covKg = 0, covOkKg = 0;
  for (const s of te) {
    const r = predictNB(m80, s.x);
    conf[s.y][r.best]++;
    kgAll += s.kg;
    if (r.best === s.y) { ok++; okKg += s.kg; }
    if (r.p >= thr) { cov++; covKg += s.kg; if (r.best === s.y) { covOk++; covOkKg += s.kg; } }
  }
  const model = trainNB(known, { N0 });
  const map = {};
  let kgInferred = 0, kgUnknown = 0;
  const byGroup = {};
  for (const u of unknown) {
    kgUnknown += u.kg;
    const r = predictNB(model, u.x);
    if (r.p < thr) continue;
    const g = GEARS[r.best];
    map[u.id] = { group: g, gear: GROUP_NAME[g], p: +r.p.toFixed(3) };
    kgInferred += u.kg;
    byGroup[g] = (byGroup[g] ?? 0) + u.kg;
  }
  return {
    map,
    params: { thr, minKg, N0, topK: codes.length, classes: GEARS },
    holdout: {
      nTrain: tr.length + va.length, nTest: te.length,
      accuracy: te.length ? ok / te.length : NaN, accuracyKg: kgAll ? okKg / kgAll : NaN,
      covAt: { thr, cover: te.length ? cov / te.length : NaN, accuracy: cov ? covOk / cov : NaN, coverKg: kgAll ? covKg / kgAll : NaN, accuracyKg: covKg ? covOkKg / covKg : NaN },
      majorityBaseline: te.length ? Math.max(...GEARS.map((_, c) => te.filter((s) => s.y === c).length)) / te.length : NaN,
      confusion: conf,
    },
    applied: { nUnknown: unknown.length, nInferred: Object.keys(map).length, kgUnknown: Math.round(kgUnknown), kgInferred: Math.round(kgInferred), kgByGroup: Object.fromEntries(Object.entries(byGroup).map(([g, v]) => [g, Math.round(v)])) },
  };
}

function selftest() {
  // 3 nghề giả: câu (loài A, nhỏ), kéo (loài B, lớn), vây (loài C, lớn); tàu thiếu nghề phải về đúng lớp
  const mk = (id, code, len, pw) => ({ id, code, len, pw });
  const vs = new Map(), lbs = [];
  let n = 0;
  const add = (code, len, pw, gear, copies) => {
    for (let i = 0; i < copies; i++) {
      const id = `V${n++}`;
      vs.set(id, { lengthM: len + (i % 3), powerCv: pw + i, gear });
      for (let t = 0; t < 5; t++) lbs.push({ vessel: { id }, landedKg: 100, species: { landed: [{ code, kg: 90 }, { code: "ZZ", kg: 10 }] } });
    }
  };
  add("AAA", 8, 50, "Câu", 120); add("BBB", 20, 500, "Kéo", 120); add("CCC", 22, 600, "Vây", 120);
  const unk = ["U1", "U2", "U3"];
  const tryAdd = (id, code, len, pw) => { vs.set(id, { lengthM: len, powerCv: pw, gear: null }); for (let t = 0; t < 5; t++) lbs.push({ vessel: { id }, landedKg: 1000, species: { landed: [{ code, kg: 1000 }] } }); };
  tryAdd("U1", "AAA", 8, 50); tryAdd("U2", "BBB", 20, 500); tryAdd("U3", "CCC", 22, 600);
  const r = inferGears(lbs, vs);
  if (r.map.U1?.group !== "cau" || r.map.U2?.group !== "keo" || r.map.U3?.group !== "vay") throw new Error(`selftest: ${JSON.stringify(r.map)}`);
  if (!(r.holdout.accuracy > 0.95)) throw new Error(`selftest: holdout ${r.holdout.accuracy}`);
  // tàu ít kg hoặc mơ hồ không bị ép
  const vs2 = new Map(vs), lb2 = [...lbs, { vessel: { id: "U9" }, landedKg: 50, species: { landed: [{ code: "AAA", kg: 50 }] } }];
  vs2.set("U9", { lengthM: 8, powerCv: 50, gear: null });
  if (inferGears(lb2, vs2).map.U9) throw new Error("selftest: <MIN_KG phải giữ ?");
  if (bin(8.9, LEN_EDGES) !== 0 || bin(9, LEN_EDGES) !== 1 || bin(NaN, LEN_EDGES) !== LEN_EDGES.length + 1) throw new Error("selftest: bin");
  console.log("selftest OK (gear-infer)");
}

if (process.argv[1]?.endsWith("gear-infer.mjs")) {
  if (process.argv.includes("--selftest")) selftest();
  else {
    const argv = process.argv.slice(2);
    const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
    const DIR = arg("dir", "").replace(/^~/, homedir());
    if (!DIR) { console.error("thiếu --dir <thư mục dl-*>"); process.exit(2); }
    const OUT = arg("out", join(DIR, "gear-map.json")).replace(/^~/, homedir());
    const lf = readdirSync(DIR).filter((f) => /^logbooks_.*\.json$/.test(f)).sort();
    const logbooks = lf.flatMap((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")));
    const vessels = new Map(JSON.parse(readFileSync(join(DIR, "vessels.json"), "utf8")).map((v) => [v.id, v]));
    const r = inferGears(logbooks, vessels, { thr: +arg("thr", THR) });
    writeFileSync(OUT, JSON.stringify({ v: 1, builtAt: new Date().toISOString(), source: { logbookFiles: lf, logbooks: logbooks.length }, params: r.params, holdout: r.holdout, applied: r.applied, vessels: r.map }));
    console.log(JSON.stringify({ params: r.params, holdout: r.holdout, applied: r.applied }, null, 1));
  }
}
