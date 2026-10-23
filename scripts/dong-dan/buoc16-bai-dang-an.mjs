#!/usr/bin/env node
// buoc16-bai-dang-an.mjs — BƯỚC 16 "Bãi đang ăn" của "Dòng Dẫn" (docs/research/du-bao-ca-dong-dan-2026-10/16-bai-dang-an.md):
// giờ đánh của đội tàu tuần trước có dự báo được CHỖ đội tàu đánh tuần tới (và kg/giờ ở đó) không — so với nền tĩnh và
// tháng-trước. Đối thủ, metric, cổng QUA đã ĐĂNG KÝ TRƯỚC ở doc 16 — đừng thêm đối thủ mà không ghi vào đó.
//
//   node buoc16-bai-dang-an.mjs dung [--limit N]   → dựng MỘT lần bảng nhỏ (chuyến × ngày × ô 0,25° → giờ đánh) +
//                                                      đo độ trễ nhật ký; ra $SDFISH_DATA_DIR/dong-dan/buoc16/bang-o.json
//   node buoc16-bai-dang-an.mjs do [--boot 1000] [--lag <ngày>]  → đọc bang-o.json, ra buoc16.{json,md}
//
// CHẠY Ở PC GPU (dữ liệu DataLake không rời máy đó). Bảng nhỏ chỉ có chỉ số tàu (0..n), không mã tàu.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { buildTrips, defaultPaths, readJson, log, feResid, ols, variance } from "./bang-chuyen.mjs";
import { makeRng, quantile as q } from "./chl-gio.mjs";

const argv = process.argv.slice(2);
const MODE = argv[0];
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = arg("out", join(dataDir(), "dong-dan", "buoc16"));
mkdirSync(OUT, { recursive: true });
const DAY0 = Date.parse("2025-11-01T00:00:00Z") / 864e5; // ngày VN tính từ 1/11/2025 (t tính bằng giây)
const dayOf = (t) => Math.floor((t + 7 * 3600) / 86400) - DAY0;
const dateOf = (d) => new Date((d + DAY0) * 864e5).toISOString().slice(0, 10);
const dayOfDate = (s) => Date.parse(`${s}T00:00:00Z`) / 864e5 - DAY0;
const GEARS = ["vay", "cau", "re", "keo", "chup", "khac"];

// ═══════════════════════════════ dựng bảng ═══════════════════════════════════
if (MODE === "dung") {
  const P0 = defaultPaths();
  const vIdx = new Map();
  const trips = [], R = { trip: [], day: [], ci: [], cj: [], h: [] };
  const { rows, cov, spName, lbFile } = buildTrips({ dir: arg("dir", P0.dir), ports: arg("ports", P0.ports), enc: arg("enc", P0.enc), limit: Number(arg("limit", 0)) }, () => {
    const m = new Map();
    return {
      seg(s) { const k = `${dayOf(s.t)}|${Math.floor(s.lat * 4)}|${Math.floor(s.lon * 4)}`; m.set(k, (m.get(k) ?? 0) + s.dtH); },
      done(base) {
        const ti = trips.length;
        if (!vIdx.has(base.vid)) vIdx.set(base.vid, vIdx.size);
        trips.push({ v: vIdx.get(base.vid), g: base.group, cls: base.cls, kg: base.kg, H: base.H, dep: dayOf(base.dep), arr: dayOf(base.arr), sp: base.sp });
        for (const [k, h] of m) { const [d, i, j] = k.split("|").map(Number); R.trip.push(ti); R.day.push(d); R.ci.push(i); R.cj.push(j); R.h.push(+h.toFixed(3)); }
        return {};
      },
    };
  });
  // loài chiếm ≥ 1 % kg (tối đa 15) — giữ kg loài trong chuyến chỉ cho các loài này
  const tot = new Map(); let all = 0;
  for (const r of rows) for (const [c, kg] of Object.entries(r.sp)) { tot.set(c, (tot.get(c) ?? 0) + kg); all += kg; }
  const species = [...tot].filter(([, kg]) => kg >= 0.01 * all).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([code, kg]) => ({ code, name: spName.get(code), kg: Math.round(kg), share: +(kg / all).toFixed(4) }));
  const keep = new Set(species.map((s) => s.code));
  for (const t of trips) t.sp = Object.fromEntries(Object.entries(t.sp).filter(([c]) => keep.has(c)));

  // độ trễ nhật ký: submittedAt − ngày về theo VMS (và unloadedAt nếu có) — chỉ thống kê
  const dir = arg("dir", P0.dir);
  const trMap = new Map(readJson(join(dir, lbFile.replace("logbooks_", "trips_"))).map((t) => [t.code, Date.parse(t.vms?.arr ?? t.arr ?? "") / 1000]));
  const lagBy = {};
  for (const lb of readJson(join(dir, lbFile))) {
    const arr = trMap.get(lb.trip?.code), sub = Date.parse(lb.submittedAt ?? "") / 1000;
    if (!Number.isFinite(arr) || !Number.isFinite(sub)) continue;
    (lagBy[lb.form ?? "?"] ??= []).push((sub - arr) / 86400);
  }
  const lagStats = Object.fromEntries(Object.entries(lagBy).map(([f, a]) => [f, { n: a.length, q05: +q(a, 0.05).toFixed(2), q25: +q(a, 0.25).toFixed(2), q50: +q(a, 0.5).toFixed(2), q75: +q(a, 0.75).toFixed(2), q95: +q(a, 0.95).toFixed(2), tiLeAm: +(a.filter((x) => x < 0).length / a.length).toFixed(3), tiLeQua30: +(a.filter((x) => x > 30).length / a.length).toFixed(3) }]));
  log("độ trễ nhật ký (ngày):", JSON.stringify(lagStats));
  writeFileSync(join(OUT, "bang-o.json"), JSON.stringify({ builtAt: new Date().toISOString(), day0: dateOf(0), cov, species, lagStats, nVessel: vIdx.size, trips, rows: R }));
  log("xong →", join(OUT, "bang-o.json"), "chuyến", trips.length, "dòng ô-ngày", R.h.length);
  process.exit(0);
}
if (MODE !== "do") { console.error("dùng: buoc16-bai-dang-an.mjs dung|do"); process.exit(2); }

// ═══════════════════════════════ phân tích ═══════════════════════════════════
const B = Number(arg("boot", 1000));
const rnd = makeRng(2016);
const T0 = readJson(join(OUT, "bang-o.json"));
const { trips, rows: RR, species } = T0;
const lagMed = T0.lagStats.ELECTRONIC?.q50 ?? T0.lagStats.PAPER?.q50;
const LAG = Number(arg("lag", Number.isFinite(lagMed) && lagMed >= 0 && lagMed < 30 ? Math.max(1, Math.round(lagMed)) : 3));
log("chuyến", trips.length, "dòng", RR.h.length, "độ trễ nhật ký dùng", LAG, "ngày");

// ô
const cellId = new Map(), cLat = [], cLon = [];
const nR = RR.h.length, rowC = new Int32Array(nR), rowD = new Int32Array(nR), rowT = new Int32Array(nR), rowH = new Float64Array(nR), rowG = new Int8Array(nR), rowV = new Int32Array(nR), rowKnown = new Int32Array(nR);
for (let r = 0; r < nR; r++) {
  const k = RR.ci[r] * 10000 + RR.cj[r];
  if (!cellId.has(k)) { cellId.set(k, cLat.length); cLat.push(RR.ci[r]); cLon.push(RR.cj[r]); }
  rowC[r] = cellId.get(k); rowD[r] = RR.day[r]; rowT[r] = RR.trip[r]; rowH[r] = RR.h[r];
  const t = trips[RR.trip[r]]; rowG[r] = GEARS.indexOf(t.g); rowV[r] = t.v; rowKnown[r] = t.arr + LAG;
}
const NC = cLat.length;
const nbr = Array.from({ length: NC }, (_, c) => { const o = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) { const n = cellId.get((cLat[c] + a) * 10000 + cLon[c] + b); if (n !== undefined) o.push(n); } return o; });
// vũ trụ theo nghề: ô nghề g có ≥ 1 giờ trong cả dữ liệu
const uni = GEARS.map(() => new Set());
for (let r = 0; r < nR; r++) uni[rowG[r]].add(rowC[r]);
const U = uni.map((s) => Int32Array.from([...s]));
const UALL = Int32Array.from({ length: NC }, (_, i) => i);
// kg loài của chuyến chia đều theo giờ
const SP = species.map((s) => s.code), NS = SP.length;
const tripKgH = trips.map((t) => SP.map((c) => (t.sp[c] ?? 0) / t.H));
const tripSpL = tripKgH.map((a) => a.map((v, s) => [s, v]).filter(([, v]) => v > 0)); // chỉ loài có mặt
// nghề mục tiêu của loài (≥ 10 % kg loài)
const spGearKg = SP.map(() => new Float64Array(GEARS.length));
for (const t of trips) SP.forEach((c, s) => { spGearKg[s][GEARS.indexOf(t.g)] += t.sp[c] ?? 0; });
const TG = spGearKg.map((a) => { const s = a.reduce((x, y) => x + y, 0); return [...a.keys()].filter((g) => a[g] >= 0.1 * s); });
// lần đầu tàu v đánh ô c (cho kiểm "tàu lạ")
const firstVC = new Map();
for (let r = 0; r < nR; r++) { const k = rowV[r] * NC + rowC[r]; const f = firstVC.get(k); if (f === undefined || rowD[r] < f) firstVC.set(k, rowD[r]); }
// dòng theo ngày
const maxD = rowD.reduce((a, b) => Math.max(a, b), 0) + 1;
const byDay = Array.from({ length: maxD }, () => []);
for (let r = 0; r < nR; r++) if (rowD[r] >= 0) byDay[rowD[r]].push(r);

// ngày phát
const CUT = dayOfDate("2026-09-20"), JUN = dayOfDate("2026-06-01");
const TS = []; for (let T = dayOfDate("2026-02-02"); T + 21 <= CUT; T += 7) TS.push(T);
log("ngày phát", TS.length, dateOf(TS[0]), "→", dateOf(TS.at(-1)), "· ô", NC);
const COMPS = ["R0", "A1", "A1x", "B1", "B2", "C1", "C2", "C3", "D1", "D2", "E1"];
const SCEN = ["vms", "ve"];
const HZ = [[1, 7], [8, 14], [15, 21]];

/** cộng các cửa sổ cho một ngày phát + kịch bản: trả {eff[g][comp], kg[s][comp]} điểm thô (Float64Array NC) */
const prevMonthRange = (T) => { const d = new Date((T + DAY0) * 86400000); const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) / 86400000 - DAY0; const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86400000 - DAY0 - 1; return [a, b]; };
const W = ["A1", "B1", "B2", "C1", "C2", "C3", "DK"]; // DK = giảm dần chưa mượt
const fullEff = GEARS.map(() => new Float64Array(NC)), fullKg = SP.map(() => new Float64Array(NC));
for (let r = 0; r < nR; r++) { fullEff[rowG[r]][rowC[r]] += rowH[r]; const kh = tripKgH[rowT[r]]; for (let s = 0; s < NS; s++) if (kh[s]) fullKg[s][rowC[r]] += kh[s] * rowH[r]; }
function windows(T, scen) {
  const mk = () => Object.fromEntries(W.map((w) => [w, new Float64Array(NC)]));
  const eff = GEARS.map(mk), kg = SP.map(mk);
  const [pa, pb] = prevMonthRange(T);
  for (let d = 0; d <= T && d < maxD; d++) for (const r of byDay[d]) {
    if (scen === "ve" && rowKnown[r] > T) continue;
    const age = T - d, c = rowC[r], h = rowH[r], kl = scen === "ve" ? tripSpL[rowT[r]] : [], E = eff[rowG[r]];
    const add = (w, x) => { E[w][c] += x * h; for (const [s, v] of kl) kg[s][w][c] += x * v * h; };
    add("A1", 1);
    if (d >= pa && d <= pb) add("B1", 1);
    if (age < 30) add("B2", 1);
    if (age < 7) add("C1", 1);
    if (age >= 7 && age < 14) add("C2", 1);
    if (age >= 7 && age < 28) add("C3", 1);
    if (age < 28) add("DK", 0.5 ** (age / 7));
  }
  return { eff, kg };
}
const smooth = (x) => { const o = Float64Array.from(x); for (let c = 0; c < NC; c++) if (x[c]) for (const n of nbr[c]) o[n] += 0.5 * x[c]; return o; };
const share = (x) => { let s = 0; for (const v of x) s += v; return s > 0 ? x.map((v) => v / s) : x; };
function scoresFrom(w, full) {
  const D2 = smooth(w.DK), sD2 = share(D2), sA1 = share(w.A1);
  const r0 = new Float64Array(NC); for (let c = 0; c < NC; c++) r0[c] = rnd();
  return { R0: r0, A1: w.A1, A1x: full, B1: w.B1, B2: w.B2, C1: w.C1, C2: w.C2, C3: w.C3, D1: smooth(w.C1), D2, E1: sD2.map((v, c) => 0.5 * v + 0.5 * sA1[c]) };
}
/** hạng phân vị 0..100 trên tập ô `cells` (giống dl-eval-honest.pctRank) → Int8Array theo ô (−1 ngoài tập) */
function rankOn(score, cells) {
  const idx = Array.from(cells).sort((a, b) => score[a] - score[b]), n = idx.length, out = new Int8Array(NC).fill(-1);
  for (let i = 0; i < n; ) { let j = i; while (j + 1 < n && score[idx[j + 1]] === score[idx[i]]) j++; const rk = Math.round((100 * (i + j)) / 2 / Math.max(1, n - 1)); for (let k = i; k <= j; k++) out[idx[k]] = rk; i = j + 1; }
  return out;
}
/** trọng số "top 10 %" theo ô (1, phân số ở ngưỡng hoà, 0) */
function top10(score, cells) {
  const v = Array.from(cells, (c) => score[c]).sort((a, b) => b - a), k = Math.max(1, Math.round(0.1 * v.length)), thr = v[k - 1];
  let gt = 0, eq = 0; for (const x of v) { if (x > thr) gt++; else if (x === thr) eq++; }
  const fr = (k - gt) / eq, out = new Float64Array(NC);
  for (const c of cells) out[c] = score[c] > thr ? 1 : score[c] === thr ? fr : 0;
  return out;
}

// ── đích theo ngày phát × tầm ──
function targets(T, [a, z]) {
  const eff = GEARS.map(() => new Map()), lạ = GEARS.map(() => new Map()), moi = GEARS.map(() => new Map()), kgSG = SP.map(() => GEARS.map(() => new Map()));
  for (let d = T + a; d <= T + z && d < maxD; d++) for (const r of byDay[d]) {
    const g = rowG[r], c = rowC[r], h = rowH[r];
    eff[g].set(c, (eff[g].get(c) ?? 0) + h);
    if (firstVC.get(rowV[r] * NC + c) > T) lạ[g].set(c, (lạ[g].get(c) ?? 0) + h);
    if (trips[rowT[r]].dep > T) moi[g].set(c, (moi[g].get(c) ?? 0) + h); // chuyến đi SAU ngày phát
    for (const [s, v] of tripSpL[rowT[r]]) kgSG[s][g].set(c, (kgSG[s][g].get(c) ?? 0) + v * h);
  }
  return { eff, lạ, moi, kgSG };
}

// ── gom histogram theo ngày phát ──
// H[scen][h][comp]: { gp[g] (Float64 101), gl[g] (tàu lạ), gn[g] (ô vũ trụ), top[g] = [tử, mẫu], topL[g], sp[s][g]: {p, n} }
const NB = 101;
const store = []; // theo ngày phát
for (const T of TS) {
  const tgCache = {};
  const rec = {};
  for (const scen of SCEN) {
    const w = windows(T, scen);
    const effS = GEARS.map((_, g) => scoresFrom(w.eff[g], fullEff[g]));
    const kgS = scen === "ve" ? SP.map((_, s) => scoresFrom(w.kg[s], fullKg[s])) : null;
    // hạng + top 10 % không phụ thuộc tầm — tính một lần
    const RK = Object.fromEntries(COMPS.map((cp) => [cp, GEARS.map((_, g) => [rankOn(effS[g][cp], U[g]), top10(effS[g][cp], U[g])])]));
    const RKS = kgS ? Object.fromEntries(COMPS.map((cp) => [cp, SP.map((_, s) => rankOn(kgS[s][cp], UALL))])) : null;
    rec[scen] = HZ.map((hz) => {
      const tg = tgCache[`${T}|${hz[0]}`] ??= targets(T, hz);
      return Object.fromEntries(COMPS.map((cp) => {
        const o = { gp: [], gl: [], gm: [], gn: [], top: [], topL: [], topM: [], sp: [] };
        GEARS.forEach((_, g) => {
          const [rk, tp] = RK[cp][g];
          const p = new Float64Array(NB), l = new Float64Array(NB), m = new Float64Array(NB), n = new Float64Array(NB);
          for (const c of U[g]) n[rk[c]]++;
          let tn = 0, td = 0, ln = 0, ld = 0, mn = 0, mdn = 0;
          for (const [c, h] of tg.eff[g]) { p[rk[c]] += h; tn += h * tp[c]; td += h; }
          for (const [c, h] of tg.lạ[g]) { l[rk[c]] += h; ln += h * tp[c]; ld += h; }
          for (const [c, h] of tg.moi[g]) { m[rk[c]] += h; mn += h * tp[c]; mdn += h; }
          o.gp.push(p); o.gl.push(l); o.gm.push(m); o.gn.push(n); o.top.push([tn, td]); o.topL.push([ln, ld]); o.topM.push([mn, mdn]);
        });
        if (kgS) SP.forEach((_, s) => {
          const rk = RKS[cp][s];
          o.sp.push(TG[s].map((g) => { const p = new Float64Array(NB), n = new Float64Array(NB); for (const [c, kg] of tg.kgSG[s][g]) p[rk[c]] += kg; for (const [c, h] of tg.eff[g]) n[rk[c]] += h; return { g, p, n }; }));
        });
        return [cp, o];
      }));
    });
  }
  store.push({ T, rec });
  log("ngày phát", dateOf(T));
}

// ── metric từ histogram cộng theo trọng số ngày phát ──
function auc(p, n) { let P = 0, N = 0, s = 0, cum = 0; for (let i = 0; i < NB; i++) { P += p[i]; N += n[i]; } if (!(P > 0 && N > 0)) return NaN; for (let i = 0; i < NB; i++) { s += p[i] * (cum + 0.5 * n[i]); cum += n[i]; } return s / (P * N); }
function metrics(scen, h, cp, wT) {
  const acc = (get) => { const o = new Float64Array(NB); store.forEach((x, t) => { if (wT[t]) { const a = get(x); for (let i = 0; i < NB; i++) o[i] += wT[t] * a[i]; } }); return o; };
  const R = (x) => x.rec[scen][h][cp];
  let aSum = 0, aW = 0, lSum = 0, lW = 0, mSum = 0, mW = 0, tn = 0, td = 0, ln = 0, ld = 0, mn = 0, mdn = 0; const perG = {};
  GEARS.forEach((gn, g) => {
    const p = acc((x) => R(x).gp[g]), n = acc((x) => R(x).gn[g]), l = acc((x) => R(x).gl[g]), m = acc((x) => R(x).gm[g]);
    const P = p.reduce((a, b) => a + b, 0), L = l.reduce((a, b) => a + b, 0), M = m.reduce((a, b) => a + b, 0), A = auc(p, n), AL = auc(l, n), AM = auc(m, n);
    if (Number.isFinite(AM)) { mSum += AM * M; mW += M; }
    perG[gn] = A;
    if (Number.isFinite(A)) { aSum += A * P; aW += P; }
    if (Number.isFinite(AL)) { lSum += AL * L; lW += L; }
    store.forEach((x, t) => { if (wT[t]) { const [a, b] = R(x).top[g], [c, d] = R(x).topL[g], [e, f] = R(x).topM[g]; tn += wT[t] * a; td += wT[t] * b; ln += wT[t] * c; ld += wT[t] * d; mn += wT[t] * e; mdn += wT[t] * f; } });
  });
  const out = { aucGio: aSum / aW, aucGioLa: lSum / lW, aucGioMoi: mSum / mW, top10: tn / td, top10La: ln / ld, top10Moi: mn / mdn, perG };
  if (scen === "ve") {
    let s = 0, w = 0; const perS = [];
    SP.forEach((_, si) => {
      let as = 0, aw = 0;
      TG[si].forEach((g, k) => { const p = acc((x) => R(x).sp[si][k].p), n = acc((x) => R(x).sp[si][k].n); const P = p.reduce((a, b) => a + b, 0), A = auc(p, n); if (Number.isFinite(A)) { as += A * P; aw += P; } });
      const A = as / aw; perS.push(A); if (Number.isFinite(A)) { s += A * species[si].kg; w += species[si].kg; }
    });
    out.aucEff = s / w; out.aucEffMacro = perS.filter(Number.isFinite).reduce((a, b) => a + b, 0) / perS.filter(Number.isFinite).length; out.perS = perS;
  }
  return out;
}
const KEYS = ["aucGio", "aucGioLa", "aucGioMoi", "top10", "top10La", "top10Moi", "aucEff"];
const res = {};
const halves = { "cả kỳ": () => true, "nửa 2–5": (T) => T < JUN, "nửa 6–9": (T) => T >= JUN };
for (const [hn, sel] of Object.entries(halves)) {
  const base = store.map((x) => (sel(x.T) ? 1 : 0)), idx = base.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const boots = Array.from({ length: B }, () => { const w = new Array(store.length).fill(0); for (let k = 0; k < idx.length; k++) w[idx[Math.floor(rnd() * idx.length)]]++; return w; });
  res[hn] = { nPhat: idx.length };
  for (const scen of SCEN) for (let h = 0; h < HZ.length; h++) {
    const key = `${scen}|L${HZ[h][0]}-${HZ[h][1]}`;
    const point = Object.fromEntries(COMPS.map((cp) => [cp, metrics(scen, h, cp, base)]));
    const bs = boots.map((w) => Object.fromEntries(COMPS.map((cp) => [cp, metrics(scen, h, cp, w)])));
    const ci = (f) => [+q(bs.map(f).filter(Number.isFinite), 0.05).toFixed(4), +q(bs.map(f).filter(Number.isFinite), 0.95).toFixed(4)];
    res[hn][key] = Object.fromEntries(COMPS.map((cp) => [cp, Object.fromEntries(KEYS.filter((k) => Number.isFinite(point[cp][k])).map((k) => [k, {
      v: +point[cp][k].toFixed(4), ci: ci((b) => b[cp][k]),
      vsA1: ci((b) => b[cp][k] - b.A1[k]), vsB1: ci((b) => b[cp][k] - b.B1[k]), vsB2: ci((b) => b[cp][k] - b.B2[k]),
    }]).concat([["perG", Object.fromEntries(Object.entries(point[cp].perG).map(([g, v]) => [g, +(+v).toFixed(3)]))]]).concat(point[cp].perS ? [["perS", Object.fromEntries(point[cp].perS.map((v, s) => [SP[s], +(+v).toFixed(3)]))]] : []))]));
    log(hn, key, "D2", res[hn][key].D2.aucGio.v, "B1", res[hn][key].B1.aucGio.v);
  }
}

// ── kiểm (ii): kg/giờ của chuyến theo phần giờ trong ô nóng W−1 do tàu KHÁC tạo ra ──
const tripRows = trips.map(() => []); for (let r = 0; r < nR; r++) tripRows[rowT[r]].push(r);
const vesRows = new Map(); for (let r = 0; r < nR; r++) (vesRows.get(rowV[r]) ?? vesRows.set(rowV[r], []).get(rowV[r])).push(r);
// quét ngày tăng dần theo nghề: W−1 [D−7, D−1] (vms) và nền tĩnh (< D); ngưỡng top 10 % trên vũ trụ nghề
const thrOf = (x, g) => { const v = Array.from(U[g], (c) => x[c]).sort((a, b) => b - a); return v[Math.max(0, Math.round(0.1 * v.length) - 1)]; };
const tripsByGD = new Map();
trips.forEach((t, ti) => { if (t.dep >= dayOfDate("2026-02-01") && t.dep <= CUT && t.kg > 0) { const k = GEARS.indexOf(t.g) * 10000 + t.dep; (tripsByGD.get(k) ?? tripsByGD.set(k, []).get(k)).push(ti); } });
const cp = [];
for (let g = 0; g < GEARS.length; g++) {
  const w1 = new Float64Array(NC), st = new Float64Array(NC);
  for (let D = 0; D <= CUT; D++) {
    if (D - 1 >= 0 && D - 1 < maxD) for (const r of byDay[D - 1]) if (rowG[r] === g) { st[rowC[r]] += rowH[r]; w1[rowC[r]] += rowH[r]; }
    if (D - 8 >= 0 && D - 8 < maxD) for (const r of byDay[D - 8]) if (rowG[r] === g) w1[rowC[r]] -= rowH[r];
    const list = tripsByGD.get(g * 10000 + D); if (!list) continue;
    const hot = { w1, st, t1: thrOf(w1, g), tS: thrOf(st, g) };
    for (const ti of list) tripHot(ti, g, hot);
  }
}
function tripHot(ti, g, hot) {
  const t = trips[ti];
  const own = new Map(); for (const r of vesRows.get(t.v)) if (rowD[r] >= t.dep - 7 && rowD[r] < t.dep && rowG[r] === g) own.set(rowC[r], (own.get(rowC[r]) ?? 0) + rowH[r]);
  let hW = 0, hS = 0, H = 0;
  for (const r of tripRows[ti]) { const c = rowC[r], x = hot.w1[c] - (own.get(c) ?? 0); H += rowH[r]; if (x > 0 && x >= hot.t1) hW += rowH[r]; if (hot.st[c] > 0 && hot.st[c] >= hot.tS) hS += rowH[r]; }
  if (H > 0) cp.push({ v: t.v, g: t.g, cls: t.cls, wk: Math.floor(t.dep / 7), y: Math.log(t.kg / t.H), lH: Math.log(t.H), sW: hW / H, sS: hS / H });
}
const vc = new Map(); cp.forEach((r) => vc.set(r.v, (vc.get(r.v) ?? 0) + 1));
const S = cp.filter((r) => vc.get(r.v) >= 2);
const fac = [S.map((r) => `${r.g}|${r.cls}|${r.wk}`), S.map((r) => r.v)];
const y = feResid(S.map((r) => r.y), fac), XL = feResid(S.map((r) => r.lH), fac), XW = feResid(S.map((r) => r.sW), fac), XS = feResid(S.map((r) => r.sS), fac);
const fitC = (yy, cols) => ols(yy, cols).beta;
const bPt = fitC(y, [XL, XW, XS]), bOnlyW = fitC(y, [XL, XW]);
const cl = new Map(); S.forEach((r, i) => (cl.get(r.wk) ?? cl.set(r.wk, []).get(r.wk)).push(i));
const groups = [...cl.values()], bb = [], bbW = [];
for (let b = 0; b < 300; b++) {
  const ix = []; for (let j = 0; j < groups.length; j++) ix.push(...groups[Math.floor(rnd() * groups.length)]);
  const yy = ix.map((i) => y[i]), L = ix.map((i) => XL[i]), Wc = ix.map((i) => XW[i]), Sc = ix.map((i) => XS[i]);
  bb.push(fitC(yy, [L, Wc, Sc])); bbW.push(fitC(yy, [L, Wc]));
}
const cpue = {
  nChuyen: S.length, nTau: new Set(S.map((r) => r.v)).size, nTuan: groups.length,
  tbPhanGioNongW1: +(S.reduce((a, r) => a + r.sW, 0) / S.length).toFixed(3), tbPhanGioNongTinh: +(S.reduce((a, r) => a + r.sS, 0) / S.length).toFixed(3),
  conLaiW1: +(variance([...XW]) / variance(S.map((r) => r.sW))).toFixed(3),
  betaW1: { b: +bPt[1].toFixed(4), ci90: [+q(bb.map((x) => x[1]), 0.05).toFixed(4), +q(bb.map((x) => x[1]), 0.95).toFixed(4)] },
  betaTinh: { b: +bPt[2].toFixed(4), ci90: [+q(bb.map((x) => x[2]), 0.05).toFixed(4), +q(bb.map((x) => x[2]), 0.95).toFixed(4)] },
  betaW1Rieng: { b: +bOnlyW[1].toFixed(4), ci90: [+q(bbW.map((x) => x[1]), 0.05).toFixed(4), +q(bbW.map((x) => x[1]), 0.95).toFixed(4)] },
};
log("kg/giờ theo ô nóng:", JSON.stringify(cpue));

const out = { builtAt: new Date().toISOString(), lagNgay: LAG, lagStats: T0.lagStats, cov: T0.cov, nChuyen: trips.length, nDong: nR, nO: NC, vuTru: Object.fromEntries(GEARS.map((g, i) => [g, U[i].length])), ngayPhat: TS.map(dateOf), species, nghềMucTieu: Object.fromEntries(SP.map((c, s) => [c, TG[s].map((g) => GEARS[g])])), ket: res, cpue };
writeFileSync(join(OUT, "buoc16.json"), JSON.stringify(out, null, 1));

// ── markdown ──
const f = (x) => (x ? `${x.v.toFixed(3)} [${x.ci[0].toFixed(3)}, ${x.ci[1].toFixed(3)}]` : "—");
const fd = (x, k) => (x ? `${x[k][0] >= 0 ? "+" : ""}${x[k][0].toFixed(3)}…${x[k][1] >= 0 ? "+" : ""}${x[k][1].toFixed(3)}` : "—");
const md = [`# Bước 16 — bảng số gốc (${out.builtAt})\n`, `Chuyến ${trips.length}, dòng chuyến×ngày×ô ${nR}, ô 0,25° ${NC}, vũ trụ theo nghề ${JSON.stringify(out.vuTru)}. Ngày phát ${TS.length} (${out.ngayPhat[0]} → ${out.ngayPhat.at(-1)}). Độ trễ nhật ký dùng cho kịch bản \`ve\`: ${LAG} ngày. Độ phủ: ${JSON.stringify(T0.cov)}.\n`, `Độ trễ nhật ký đo được (submittedAt − ngày về VMS, ngày): ${JSON.stringify(T0.lagStats)}\n`];
for (const [hn, rr] of Object.entries(res)) {
  md.push(`## ${hn} (${rr.nPhat} ngày phát)\n`);
  for (const [key, v] of Object.entries(rr)) {
    if (key === "nPhat") continue;
    const hasKg = key.startsWith("ve");
    md.push(`### ${key}\n\n| đối thủ | AUC giờ [CI 90] | − A1 | − B1 | AUC giờ tàu lạ | − B1 (lạ) | AUC giờ chuyến mới | − B1 (mới) | top 10 % | top 10 % tàu lạ | top 10 % chuyến mới |${hasKg ? " AUCeff trong-nghề | − B1 (kg) |" : ""}\n|---|---|---|---|---|---|---|---|---|---|---|${hasKg ? "---|---|" : ""}`);
    for (const c of COMPS) { const x = v[c]; md.push(`| ${c} | ${f(x.aucGio)} | ${fd(x.aucGio, "vsA1")} | ${fd(x.aucGio, "vsB1")} | ${f(x.aucGioLa)} | ${fd(x.aucGioLa, "vsB1")} | ${f(x.aucGioMoi)} | ${fd(x.aucGioMoi, "vsB1")} | ${f(x.top10)} | ${f(x.top10La)} | ${f(x.top10Moi)} |${hasKg ? ` ${f(x.aucEff)} | ${fd(x.aucEff, "vsB1")} |` : ""}`); }
    md.push(`\nAUC giờ theo nghề: ${COMPS.filter((c) => ["A1", "B1", "C1", "D2", "E1"].includes(c)).map((c) => `${c} ${JSON.stringify(v[c].perG)}`).join(" · ")}\n`);
    if (hasKg) md.push(`AUCeff theo loài: ${["A1", "B1", "D2"].map((c) => `${c} ${JSON.stringify(v[c].perS)}`).join(" · ")}\n`);
  }
}
md.push(`## Kiểm (ii) — kg/giờ của chuyến theo phần giờ trong ô nóng\n\n${JSON.stringify(cpue, null, 1)}\n\nβ = thay đổi log(kg/giờ) khi TOÀN BỘ giờ của chuyến nằm trong ô nóng (so với không giờ nào), cố định tàu và nghề × lớp × tuần đi, kiểm soát log giờ đánh; CI 90 % bootstrap cụm tuần.\n`);
md.push(`## Loài (≥ 1 % kg) và nghề mục tiêu\n\n${species.map((s) => `- ${s.code} ${s.name} ${s.kg} kg (${(s.share * 100).toFixed(1)} %) — nghề ${out.nghềMucTieu[s.code].join(", ")}`).join("\n")}\n`);
writeFileSync(join(OUT, "buoc16.md"), md.join("\n"));
log("xong →", join(OUT, "buoc16.md"));
