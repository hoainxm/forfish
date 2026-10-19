// scripts/fish-fit-lib.mjs — hàm THUẦN cho fit/đo hồ sơ loài trên cache đặc trưng (mảnh 2B, rà pipeline 2026-10-18).
// Dùng bởi scripts/dl-fit-profiles.mjs. Không đọc đĩa, không mạng. `node scripts/fish-fit-lib.mjs --selftest`.
//
//  • AUC trên histogram ĐIỂM LIÊN TỤC (NBF ngăn; ngăn 0 = đúng 0) — hết bậc thang làm tròn/KEEP_MIN
//  • chia nếp: K nếp theo tháng có ĐỆM `pad` ngày (ngày train cách ngày test < pad bị loại) + chuỗi tiến F3
//  • bootstrap khối 7 ngày cho CHÊNH AUC (fit − gốc), p một phía
//  • Benjamini–Hochberg trên loài (thay MIN_GAIN cố định)
export const NBF = 1024;

/** ngăn của điểm s∈[0,1]: 0 chỉ cho đúng 0 (ô bị cổng nhiệt/ngoài vụ), còn lại 1..NBF−1 */
export const binOf = (s) => (s > 0 ? 1 + Math.min(NBF - 2, Math.floor(s * (NBF - 1))) : 0);

/** AUC có trọng số từ hai histogram (offset oa/ob); ties ½. NaN nếu một phía rỗng. */
export function aucHist(a, oa, b, ob) {
  let P = 0, N = 0, acc = 0;
  for (let v = 0; v < NBF; v++) { const p = a[oa + v], n = b[ob + v]; acc += p * (N + n / 2); N += n; P += p; }
  return P > 0 && N > 0 ? acc / (P * N) : NaN;
}

/**
 * Bản ghi một lượt đo = Float64Array((2G+1)·NBF): [hp_0,hn_0, hp_1,hn_1, …, hArea].
 * hp_g = kg loài ở nghề g; hn_g = giờ đánh của nghề g; hArea = mỗi ô biển 1 (mẫu số AUCarea).
 */
export const recLen = (G) => (2 * G + 1) * NBF;

/**
 * Số đo từ một bản ghi (đã cộng nhiều ngày): within = AUCeff TRONG-NGHỀ Σ_g w_g·AUC(hp_g, hn_g) (w_g = kg nghề g,
 * chỉ nghề đo được); eff = AUC(Σ hp_g, Σ hn_g) (pos MỌI nghề mục tiêu vs giờ hợp) — số "cũ" đã chặn nghề khác;
 * area = AUC(Σ hp_g, hArea); kg = tổng kg.
 */
export function recMetrics(rec, G) {
  const hpU = new Float64Array(NBF), hnU = new Float64Array(NBF);
  let wSum = 0, wAuc = 0, kg = 0;
  for (let g = 0; g < G; g++) {
    const op = 2 * g * NBF, on = (2 * g + 1) * NBF;
    let w = 0;
    for (let v = 0; v < NBF; v++) { hpU[v] += rec[op + v]; hnU[v] += rec[on + v]; w += rec[op + v]; }
    kg += w;
    const a = aucHist(rec, op, rec, on);
    if (Number.isFinite(a) && w > 0) { wSum += w; wAuc += w * a; }
  }
  return { within: wSum > 0 ? wAuc / wSum : NaN, eff: aucHist(hpU, 0, hnU, 0), area: aucHist(hpU, 0, rec, 2 * G * NBF), kg };
}

/** a += b */
export function recAdd(a, b) { for (let i = 0; i < a.length; i++) a[i] += b[i]; return a; }

const DAY = 86400e3;
export const dayNum = (d) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY);

/**
 * Nếp kiểm chéo theo THÁNG. `folds` = mảng nhóm tháng ["2026-07","2026-08"]… Ngày thử = ngày thuộc nhóm; ngày train = mọi ngày
 * KHÔNG thuộc nhóm và cách MỌI ngày thử ≥ `pad` ngày (chuyến dài + SST tự tương quan: tháng kề không lọt vào train).
 */
export function makeFolds(dates, folds, pad = 15) {
  return folds.map((months) => {
    const test = dates.filter((d) => months.includes(d.slice(0, 7)));
    const tn = test.map(dayNum);
    const lo = Math.min(...tn), hi = Math.max(...tn);
    const train = dates.filter((d) => {
      if (months.includes(d.slice(0, 7))) return false;
      const n = dayNum(d);
      return n <= lo - pad || n >= hi + pad ? true : false;
    });
    return { name: months.join("+"), months, test, train };
  }).filter((f) => f.test.length > 0);
}

/**
 * CHUỖI TIẾN (F3): tháng M thử bằng fit trên các ngày TRƯỚC ngày đầu M trừ `pad`. Bỏ tháng chưa có ≥ `minTrain` ngày train.
 */
export function makeForward(dates, pad = 15, minTrain = 20) {
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  const out = [];
  for (const m of months) {
    const test = dates.filter((d) => d.startsWith(m));
    const first = dayNum(test[0]);
    const train = dates.filter((d) => dayNum(d) <= first - pad);
    if (train.length >= minTrain) out.push({ name: `fwd-${m}`, months: [m], test, train });
  }
  return out;
}

/** Chỉ số khối 7 ngày (theo lịch) của từng ngày */
export function blockIds(dates, size = 7) {
  const n = dates.map(dayNum), base = Math.min(...n);
  return n.map((x) => Math.floor((x - base) / size));
}

function makeRng(seed) {
  let r = seed;
  return () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/**
 * Bootstrap khối cho CHÊNH `stat(recFit) − stat(recBase)`. `days` = [{block, base:Float64Array, fit:Float64Array}];
 * mỗi lần lấy mẫu có hoàn lại các KHỐI rồi cộng bản ghi. Trả {gain, lo, hi (CI 90 %), p (một phía: chênh ≤ 0), n}.
 * Nếu MỌI ngày có thêm `cbase`/`cfit` (cùng dự báo chấm với nhãn ĐỐI CHỨNG lệch ngày) thì chênh là
 * ĐỘNG: (fit−gốc | nhãn thật) − (fit−gốc | nhãn đối chứng) — trừ phần "hình học bãi theo mùa" mà nhãn lệch ngày cũng thấy.
 */
export function bootstrapGain(days, G, stat, B = 400, seed = 11) {
  const blocks = new Map();
  for (const d of days) (blocks.get(d.block) ?? blocks.set(d.block, []).get(d.block)).push(d);
  const keys = [...blocks.keys()];
  const len = recLen(G);
  const withCtrl = days.length > 0 && days.every((d) => d.cbase && d.cfit);
  const sumOf = (sel) => {
    const base = new Float64Array(len), fit = new Float64Array(len);
    const cbase = withCtrl ? new Float64Array(len) : null, cfit = withCtrl ? new Float64Array(len) : null;
    for (const k of sel) for (const d of blocks.get(k)) {
      recAdd(base, d.base); recAdd(fit, d.fit);
      if (withCtrl) { recAdd(cbase, d.cbase); recAdd(cfit, d.cfit); }
    }
    const g = stat(recMetrics(fit, G)) - stat(recMetrics(base, G));
    return withCtrl ? g - (stat(recMetrics(cfit, G)) - stat(recMetrics(cbase, G))) : g;
  };
  const gain = sumOf(keys);
  const rnd = makeRng(seed);
  const xs = [];
  for (let b = 0; b < B; b++) {
    const sel = Array.from({ length: keys.length }, () => keys[Math.floor(rnd() * keys.length)]);
    const g = sumOf(sel);
    if (Number.isFinite(g)) xs.push(g);
  }
  xs.sort((a, b) => a - b);
  const q = (p) => (xs.length ? xs[Math.min(xs.length - 1, Math.max(0, Math.round((xs.length - 1) * p)))] : NaN);
  const p = (xs.filter((x) => x <= 0).length + 1) / (xs.length + 1);
  return { gain, lo: q(0.05), hi: q(0.95), p, n: xs.length, blocks: keys.length };
}

/** Benjamini–Hochberg: p-giá trị đã chỉnh + cờ bác bỏ ở mức q. NaN/undefined = không tham gia (không bác bỏ). */
export function bhAdjust(ps, q = 0.1) {
  const idx = ps.map((p, i) => [p, i]).filter(([p]) => Number.isFinite(p)).sort((a, b) => a[0] - b[0]);
  const m = idx.length, adj = ps.map(() => NaN), reject = ps.map(() => false);
  let prev = 1;
  for (let r = m - 1; r >= 0; r--) {
    const v = Math.min(prev, (idx[r][0] * m) / (r + 1));
    adj[idx[r][1]] = v; prev = v;
  }
  for (let r = 0; r < m; r++) reject[idx[r][1]] = adj[idx[r][1]] <= q;
  return { adj, reject };
}

/* ── selftest ─────────────────────────────────────────────────────────────── */
export async function selftest() {
  const assert = (c, m) => { if (!c) throw new Error(`selftest fish-fit-lib: ${m}`); };
  const { weightedAuc } = await import("./dl-eval.mjs");
  // AUC histogram ≈ AUC chính xác trên điểm liên tục
  const rnd = makeRng(5);
  const pos = [], neg = [];
  for (let i = 0; i < 4000; i++) { pos.push([Math.min(1, rnd() * 0.9 + 0.1 * rnd()), 1 + rnd()]); neg.push([rnd() * 0.8, 1 + rnd()]); }
  const hp = new Float64Array(NBF), hn = new Float64Array(NBF);
  for (const [s, w] of pos) hp[binOf(s)] += w;
  for (const [s, w] of neg) hn[binOf(s)] += w;
  const exact = weightedAuc(pos, neg), approx = aucHist(hp, 0, hn, 0);
  assert(Math.abs(exact - approx) < 2e-3, `AUC hist ${approx} vs ${exact}`);
  assert(binOf(0) === 0 && binOf(1e-9) === 1 && binOf(1) === NBF - 1, "binOf");
  // trong-nghề: hai nghề, một nghề AUC 1, nghề kia 0 ⇒ trung bình theo kg
  const rec = new Float64Array(recLen(2));
  rec[0 * NBF + 900] = 3; rec[1 * NBF + 100] = 1;          // nghề 0: pos cao hơn neg → AUC 1, kg 3
  rec[2 * NBF + 100] = 1; rec[3 * NBF + 900] = 1;          // nghề 1: pos thấp hơn neg → AUC 0, kg 1
  const m = recMetrics(rec, 2);
  assert(Math.abs(m.within - 0.75) < 1e-12, `within ${m.within}`);
  assert(m.kg === 4, "kg");
  // BH: ví dụ chuẩn
  const bh = bhAdjust([0.01, 0.04, 0.03, 0.2, NaN], 0.1);
  assert(bh.reject.join() === "true,true,true,false,false", `BH ${bh.reject}`);
  assert(Math.abs(bh.adj[0] - 0.04) < 1e-12 && Math.abs(bh.adj[2] - 0.16 / 3) < 1e-12, `BH adj ${bh.adj}`);
  // nếp có đệm
  const dates = [];
  for (let d = 0; d < 61; d++) dates.push(new Date(Date.parse("2026-08-01T00:00:00Z") + d * DAY).toISOString().slice(0, 10));
  const f = makeFolds(dates, [["2026-08"], ["2026-09"]], 15);
  assert(f.length === 2 && f[0].test.length === 31 && f[1].test.length === 30, "nếp: số ngày thử");
  assert(f[0].train.length === 16 && f[0].train[0] === "2026-09-15", `nếp đệm train ${f[0].train.length} ${f[0].train[0]}`);
  assert(f[1].train.length === 17 && f[1].train.at(-1) === "2026-08-17", `nếp đệm train#2 ${f[1].train.length} ${f[1].train.at(-1)}`);
  assert(f.every((x) => x.train.every((d) => !x.test.includes(d))), "train không lẫn test");
  // chuỗi tiến: 2 tháng ⇒ tháng 9 có train = ngày ≤ 2026-08-17 (17 ngày) < 20 ⇒ bỏ; hạ minTrain=10 ⇒ có
  assert(makeForward(dates, 15, 20).length === 0, "forward minTrain");
  const fw = makeForward(dates, 15, 10);
  assert(fw.length === 1 && fw[0].name === "fwd-2026-09" && fw[0].train.at(-1) === "2026-08-17", "forward");
  // khối 7 ngày
  assert(blockIds(dates).slice(0, 8).join() === "0,0,0,0,0,0,0,1", "blockIds");
  // bootstrap: fit luôn hơn gốc 0,1 ⇒ p thấp, lo > 0; fit = gốc ⇒ lo ≤ 0 ≤ hi
  const mk = (lift) => dates.slice(0, 28).map((d, i) => {
    const base = new Float64Array(recLen(1)), fit = new Float64Array(recLen(1));
    const r = makeRng(100 + i);
    for (let k = 0; k < 60; k++) {
      const sp = r(), sn = r();
      base[binOf(sp)] += 1; base[NBF + binOf(sn)] += 1;
      fit[binOf(Math.min(1, sp + lift))] += 1; fit[NBF + binOf(sn)] += 1;
    }
    return { block: blockIds(dates)[i], base, fit };
  });
  const up = bootstrapGain(mk(0.15), 1, (m) => m.within, 300);
  assert(up.gain > 0.05 && up.lo > 0 && up.p < 0.02, `bootstrap lift ${JSON.stringify(up)}`);
  const none = bootstrapGain(mk(0), 1, (m) => m.within, 300);
  assert(Math.abs(none.gain) < 1e-12 && none.lo <= 1e-12 && none.hi >= -1e-12 && none.p > 0.5, `bootstrap null ${JSON.stringify(none)}`);
  // đối chứng: nâng điểm như nhau ở nhãn thật và nhãn đối chứng ⇒ chênh ĐỘNG ≈ 0; chỉ nâng ở nhãn thật ⇒ > 0
  const mk2 = (liftTrue, liftCtrl) => dates.slice(0, 28).map((d, i) => {
    const r = makeRng(300 + i), z = () => new Float64Array(recLen(1));
    const o = { block: blockIds(dates)[i], base: z(), fit: z(), cbase: z(), cfit: z() };
    for (let k = 0; k < 60; k++) {
      const sp = r(), sn = r(), sp2 = r(), sn2 = r();
      o.base[binOf(sp)] += 1; o.base[NBF + binOf(sn)] += 1; o.fit[binOf(Math.min(1, sp + liftTrue))] += 1; o.fit[NBF + binOf(sn)] += 1;
      o.cbase[binOf(sp2)] += 1; o.cbase[NBF + binOf(sn2)] += 1; o.cfit[binOf(Math.min(1, sp2 + liftCtrl))] += 1; o.cfit[NBF + binOf(sn2)] += 1;
    }
    return o;
  });
  const same = bootstrapGain(mk2(0.15, 0.15), 1, (m) => m.within, 300);
  assert(Math.abs(same.gain) < 0.05 && same.lo < 0.02 && same.p > 0.05, `động (lift như nhau) ${JSON.stringify(same)}`);
  const dyn = bootstrapGain(mk2(0.15, 0), 1, (m) => m.within, 300);
  assert(dyn.gain > 0.05 && dyn.lo > 0 && dyn.p < 0.02, `động (lift chỉ ở nhãn thật) ${JSON.stringify(dyn)}`);
  console.log("selftest fish-fit-lib OK");
}

if (process.argv[1]?.endsWith("fish-fit-lib.mjs") && process.argv.includes("--selftest")) await selftest();
