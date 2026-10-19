// scripts/fish-2d-experiment.mjs — THÍ NGHIỆM 2D (README rà train §7.1 dòng 2D, §7.8): lớp vệ tinh có thêm được gì trên NỀN 2A?
// ─────────────────────────────────────────────────────────────────────────────
// Cùng nền 2A (src/lib/fish-base.ts: x-sản-lượng K_s theo loài + x-đội-tàu + tĩnh sâu/bờ/vĩ + mùa vụ → logistic ≤5 hệ số/nhóm loài),
// cùng nhãn v2, cùng số đo, ba nhánh:
//   nền  : chỉ nền 2A (đối chứng)
//   (a)  : nền + HSI hiện tại gộp noisy-OR như production:  1 − (1 − fitSat)(1 − CATCH_SCALE·điểmNền/100)
//          (fitSat = scoreCell với hai kênh tĩnh TẮT — nền thay chúng)
//   (b)  : nền + residual logistic KHOÁ DẤU:  logit = nền_raw + β0 + Σ βk·zk, zk = DỊ THƯỜNG theo trung bình tháng của ô
//          (SST, log chl, front nhiệt, front mồi, |xoáy|, nước trồi, hội tụ, tầng nhiệt — cấm vĩ/kinh/sâu/bờ),
//          dấu βk theo hồ sơ loài, ridge, zk thiếu ⇒ 0. ≤ 9 số/loài.
//   (c)  : nền + chỉ ba dị thường (front nhiệt, SST, log chl): 3 số + hệ số chặn.
// Fit trên nếp KHÁC, chấm 5 nếp 2 tháng (đệm 15 ngày) + F3 chuỗi tiến THUẦN (lưới fwd-<M> chỉ tháng < M).
// Thống kê: Δ AUC trong-nghề vs nền (bootstrap khối 7 ngày), chênh ĐỘNG (nhãn lệch ±ctrl ngày), AUC cục bộ 1°, Spearman dị thường.
//
//   npx tsx scripts/fish-2d-experiment.mjs --species "ngừ vằn,cá nục,bạc má,cá cơm,ngừ chù" --labels <labels-v2…> --out <dir>
//   --features --fleet-dir --catch-dir (v2: tag "2026-08" | "2026-07+2026-08" | "fwd-2026-05")   --pad 15 --boot 300 --ctrl-shift 15
//   --ridge 0.01   --schemes folds,f3   --selftest
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  SPECIES_PROFILES, SPECIES_META, CATCH_SCALE, FISH_ALGO_REV, cellHabitat, scoreCell, seasonWeights, coastDistanceKm, nearestIndex,
} from "../src/lib/fish-predict.ts";
import { fleetPresenceGrid, FLEET_FULL_HOURS } from "../src/lib/fleet-effort.ts";
import {
  staticBins, fitStaticLift, staticLogLift, baseRaw, rankFraction, rankToScore, BASE_DEPTH_EDGES, BASE_COAST_EDGES, BASE_LAT_BINS, BASE_DEFAULT_KS,
} from "../src/lib/fish-base.ts";
import { parseBathyGrid } from "../src/lib/fish-predict.ts";
import { ASFIS_TO_SHORT, targetGears } from "./dl-eval.mjs";
import { decodeFeatures, readFeatureDay, readSeaMask, dataDir } from "./fish-features-cache.mjs";
import { NBF, binOf, recLen, recMetrics, makeFolds, makeForward, blockIds, bootstrapGain, bhAdjust, dayNum } from "./fish-fit-lib.mjs";
import { localAucDay, anomalyPairsDense, spearmanFromPairs } from "./fish-metrics-local.mjs";
import { BASE_GROUPS, groupOf, seasonOf, ksOfGrid } from "./fish-base-fit.mjs";

/* ═════════ phần THUẦN (có selftest) ═════════ */

/** Giải H·x = g (khử Gauss, xoay từng phần) trên ma trận phẳng d×d; null nếu suy biến */
export function solveSystem(H, g, d) {
  const A = new Float64Array(d * (d + 1));
  for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) A[i * (d + 1) + j] = H[i * d + j]; A[i * (d + 1) + d] = g[i]; }
  for (let c = 0; c < d; c++) {
    let p = c;
    for (let r = c + 1; r < d; r++) if (Math.abs(A[r * (d + 1) + c]) > Math.abs(A[p * (d + 1) + c])) p = r;
    if (Math.abs(A[p * (d + 1) + c]) < 1e-12) return null;
    if (p !== c) for (let k = 0; k <= d; k++) { const t = A[c * (d + 1) + k]; A[c * (d + 1) + k] = A[p * (d + 1) + k]; A[p * (d + 1) + k] = t; }
    for (let r = c + 1; r < d; r++) {
      const f = A[r * (d + 1) + c] / A[c * (d + 1) + c];
      for (let k = c; k <= d; k++) A[r * (d + 1) + k] -= f * A[c * (d + 1) + k];
    }
  }
  const x = new Float64Array(d);
  for (let r = d - 1; r >= 0; r--) {
    let s = A[r * (d + 1) + d];
    for (let k = r + 1; k < d; k++) s -= A[r * (d + 1) + k] * x[k];
    x[r] = s / A[r * (d + 1) + r];
  }
  return x;
}

/**
 * Logistic có trọng số (use-availability) bằng Newton/IRLS trên mảng PHẲNG, có OFFSET và KHOÁ DẤU.
 *   X: Float64Array|Float32Array n×d (cột 0 = hệ số chặn 1), y: 0/1, w: trọng số, off: offset (hoặc null)
 *   signs[k] ∈ {+1,−1,0,null}: +1 ⇒ βk ≥ 0, −1 ⇒ βk ≤ 0, 0 ⇒ ép βk = 0 (loại), null/undefined ⇒ tự do. Cột 0 luôn tự do.
 *   ridge: phạt ridge·Σw·βk² cho k ≥ 1 (không phạt chặn).
 * Vi phạm dấu ⇒ ghim βk = 0 rồi giải lại các hệ số còn lại (tập hoạt động). Trả Float64Array(d).
 */
export function logisticFit({ X, y, w, off = null, d, signs = null, ridge = 1e-3, iters = 40 }) {
  const n = y.length;
  let wTot = 0;
  for (let i = 0; i < n; i++) wTot += w[i];
  const lam = ridge * wTot;
  const free = new Uint8Array(d).fill(1);
  if (signs) for (let k = 1; k < d; k++) if (signs[k] === 0) free[k] = 0;
  const beta = new Float64Array(d);
  for (let outer = 0; outer <= d; outer++) {
    for (let k = 0; k < d; k++) if (!free[k]) beta[k] = 0;
    const idx = [];
    for (let k = 0; k < d; k++) if (free[k]) idx.push(k);
    const m = idx.length;
    for (let it = 0; it < iters; it++) {
      const H = new Float64Array(m * m), g = new Float64Array(m);
      for (let i = 0; i < n; i++) {
        let eta = off ? off[i] : 0;
        const o = i * d;
        for (let a = 0; a < m; a++) eta += beta[idx[a]] * X[o + idx[a]];
        const p = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, eta))));
        const s = w[i] * p * (1 - p), e = w[i] * (y[i] - p);
        for (let a = 0; a < m; a++) {
          const xa = X[o + idx[a]];
          g[a] += e * xa;
          for (let b = a; b < m; b++) H[a * m + b] += s * xa * X[o + idx[b]];
        }
      }
      for (let a = 0; a < m; a++) {
        for (let b = 0; b < a; b++) H[a * m + b] = H[b * m + a];
        if (idx[a] > 0) { H[a * m + a] += lam; g[a] -= lam * beta[idx[a]]; } else H[a * m + a] += 1e-9 * wTot;
      }
      const step = solveSystem(H, g, m);
      if (!step) break;
      let mx = 0;
      for (let a = 0; a < m; a++) { beta[idx[a]] += step[a]; mx = Math.max(mx, Math.abs(step[a])); }
      if (mx < 1e-7) break;
    }
    let bad = false;
    if (signs) for (let k = 1; k < d; k++) if (free[k] && signs[k] != null && signs[k] !== 0 && signs[k] * beta[k] < 0) { free[k] = 0; beta[k] = 0; bad = true; }
    if (!bad) break;
  }
  return beta;
}

/** Cắt z về ±3 và NaN ⇒ 0 ("zk thiếu ⇒ 0") */
export const clampZ = (v) => (Number.isFinite(v) ? Math.max(-3, Math.min(3, v)) : 0);

/**
 * Dấu βk theo HỒ SƠ LOÀI cho 8 dị thường [sst, logChl, frontNhiệt, frontMồi, |xoáy|, nướcTrồi, hộiTụ, tầngNhiệt]:
 * trọng số cơ chế = 0 ⇒ 0 (loại); front/xoáy/trồi/hội tụ/tầng nhiệt ⇒ +1 (nhiều hơn ⇒ nhiều cá); chl ⇒ +1 nếu loài lệ thuộc mồi;
 * SST: +1 nếu tâm cao nguyên nhiệt của loài NÓNG hơn nền khí hậu SST vùng-tháng trong vụ của nó, −1 nếu mát hơn.
 */
export function residualSigns(p, climoMeanP50) {
  const w = p.w;
  const center = (p.sst[1] + p.sst[2]) / 2;
  return [
    Math.sign(center - climoMeanP50) || 1,
    (p.foodDependence ?? 1) > 0 ? 1 : 0,
    w.thermFront > 0 ? 1 : 0,
    w.chlFront > 0 ? 1 : 0,
    w.eddy > 0 ? 1 : 0,
    w.upw > 0 ? 1 : 0,
    w.conv > 0 ? 1 : 0,
    (w.thermo ?? 0) > 0 ? 1 : 0,
  ];
}

export async function selftest() {
  const assert = (c, m) => { if (!c) throw new Error(`selftest fish-2d: ${m}`); };
  let r = 3;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  // dữ liệu use-availability tổng hợp: logit(p) = −1 + 0,8·z1 − 0,5·z2 + offset
  const n = 6000, d = 4, X = new Float64Array(n * d), y = new Uint8Array(n), w = new Float64Array(n), off = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    X[i * d] = 1; X[i * d + 1] = gauss(); X[i * d + 2] = gauss(); X[i * d + 3] = gauss();
    off[i] = 0.5 * gauss();
    const eta = -1 + 0.8 * X[i * d + 1] - 0.5 * X[i * d + 2] + off[i];
    y[i] = rnd() < 1 / (1 + Math.exp(-eta)) ? 1 : 0;
    w[i] = 1;
  }
  const b0 = logisticFit({ X, y, w, off, d, ridge: 1e-6 });
  assert(Math.abs(b0[0] + 1) < 0.15 && Math.abs(b0[1] - 0.8) < 0.1 && Math.abs(b0[2] + 0.5) < 0.1 && Math.abs(b0[3]) < 0.1, `hệ số ${Array.from(b0).map((v) => v.toFixed(2))}`);
  // khoá dấu: ép β2 ≥ 0 (thật là −0,5) ⇒ ghim 0; ép β3 loại ⇒ 0; β1 giữ
  const b1 = logisticFit({ X, y, w, off, d, signs: [null, 1, 1, 0], ridge: 1e-6 });
  assert(b1[2] === 0 && b1[3] === 0 && Math.abs(b1[1] - 0.8) < 0.15, `khoá dấu ${Array.from(b1).map((v) => v.toFixed(2))}`);
  // ridge mạnh co hệ số
  const b2 = logisticFit({ X, y, w, off, d, ridge: 0.5 });
  assert(Math.abs(b2[1]) < Math.abs(b0[1]) && Math.abs(b2[1]) > 0, "ridge co hệ số");
  // khớp irlsLogistic của fish-base (không offset) trên dữ liệu nhỏ
  const { irlsLogistic } = await import("../src/lib/fish-base.ts");
  const m = 800, rows = [], X2 = new Float64Array(m * 3), y2 = new Uint8Array(m), w2 = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    X2[i * 3] = 1; X2[i * 3 + 1] = gauss(); X2[i * 3 + 2] = rnd();
    y2[i] = rnd() < 1 / (1 + Math.exp(-(0.3 + X2[i * 3 + 1] - X2[i * 3 + 2]))) ? 1 : 0; w2[i] = 0.5 + rnd();
    rows.push({ x: [1, X2[i * 3 + 1], X2[i * 3 + 2]], y: y2[i], w: w2[i] });
  }
  const ref = irlsLogistic(rows), mine = logisticFit({ X: X2, y: y2, w: w2, d: 3, ridge: 1e-3 });
  assert(ref.every((v, k) => Math.abs(v - mine[k]) < 1e-5), `khớp irlsLogistic ${ref} vs ${Array.from(mine)}`);
  assert(clampZ(NaN) === 0 && clampZ(9) === 3 && clampZ(-9) === -3 && clampZ(0.4) === 0.4, "clampZ");
  const P = { w: { thermFront: 0.4, chlFront: 0, eddy: 0.3, upw: 0.2, conv: 0, thermo: 0 }, sst: [24, 27, 30, 32], foodDependence: 1 };
  const sg = residualSigns(P, 28);
  assert(sg.join() === "1,1,1,0,1,1,0,0", `dấu ${sg}`);
  assert(residualSigns(P, 30)[0] === -1, "SST: loài mát hơn nền khí hậu ⇒ −1");
  assert(residualSigns({ ...P, foodDependence: 0 }, 26)[0] === 1 && residualSigns({ ...P, foodDependence: 0 }, 26)[1] === 0, "dấu chl/sst");
  console.log("selftest fish-2d OK");
}
if (process.argv[1]?.endsWith("fish-2d-experiment.mjs") && process.argv.includes("--selftest")) { await selftest(); process.exit(0); }
if (!process.argv[1]?.endsWith("fish-2d-experiment.mjs")) { /* import chỉ để dùng hàm thuần */ } else {
await main();
}

/* ═════════ chạy thí nghiệm ═════════ */
async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const home = (p) => p.replace(/^~/, homedir());
  const DD = dataDir();
  const FEAT = home(arg("features", join(DD, "fc-full/features")));
  const LABS = arg("labels", ["01", "03", "05", "07", "09"].map((m) => join(DD, `dl-all/labels-v2-2026-${m}-01`)).join(",")).split(",").map(home);
  const FLEET_DIR = home(arg("fleet-dir", join(DD, "fleet-v2")));
  const CATCH_DIR = home(arg("catch-dir", join(DD, "catch-v2")));
  const OUT = home(arg("out", join(DD, "fit2/2d")));
  const SPECIES = arg("species", "ngừ vằn,cá nục,bạc má,cá cơm,ngừ chù").split(",").map((s) => s.trim()).filter(Boolean);
  const PAD = Number(arg("pad", 15)), BOOT = Number(arg("boot", 300)), CTRL = Number(arg("ctrl-shift", 15));
  const RIDGE = Number(arg("ridge", 0.01)), HOT = Number(arg("hot-share", 0.113));
  const SCHEMES = arg("schemes", "folds,f3").split(",");
  mkdirSync(OUT, { recursive: true });
  const T0 = Date.now();
  const lg = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

  /* ── cache đặc trưng + lưới ── */
  const MF = JSON.parse(readFileSync(join(FEAT, "manifest.json"), "utf8"));
  const { nLat, nLon, lat0, lon0, step } = MF.axis;
  const NK = nLat * nLon;
  const dates = Object.keys(MF.days).filter((d) => d <= "2026-10-11" && d >= arg("from", "0000") && d <= arg("to", "9999")).sort(); // nhãn đến 11/10
  const monthOf = (d) => Number(d.slice(5, 7));
  const climoAll = JSON.parse(readFileSync(new URL("../src/data/sst-climatology.v1.json", import.meta.url), "utf8")).regions;
  const depthGrid = parseBathyGrid(JSON.parse(readFileSync(join(DD, "fc-full/grids/etopo.json"), "utf8")));
  const coastGrid = coastDistanceKm(depthGrid, 700);

  /* tĩnh theo ô: khoá = i*nLon + j */
  const binD = new Int16Array(NK), binC = new Int16Array(NK), binL = new Int16Array(NK), blk = new Int32Array(NK);
  for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) {
    const lat = lat0 + i * step, lon = lon0 + j * step, di = nearestIndex(depthGrid.lats, lat), dj = nearestIndex(depthGrid.lons, lon);
    const dv = depthGrid.values[di]?.[dj], cv = coastGrid[di]?.[dj];
    const b = staticBins(Number.isFinite(dv) ? dv : NaN, Number.isFinite(cv) ? cv : 700, lat);
    binD[i * nLon + j] = b[0]; binC[i * nLon + j] = b[1]; binL[i * nLon + j] = b[2];
    blk[i * nLon + j] = Math.floor(lat) * 1000 + Math.floor(lon);
  }

  /* ── nhãn v2 cho MỌI loài (nền cần cả nhóm loài) ── */
  const GEARS = ["Kéo", "Vây", "Rê", "Câu", "Lưới chụp", "Khác", "?"], NG = GEARS.length;
  const gIdx = (g) => { const k = GEARS.indexOf(g); return k < 0 ? GEARS.indexOf("Khác") : k; };
  const ALL_SP = [...new Set(Object.values(ASFIS_TO_SHORT))];
  const keyOf = (lat, lon) => { const i = Math.round((lat - lat0) / step), j = Math.round((lon - lon0) / step); return i < 0 || j < 0 || i >= nLat || j >= nLon ? -1 : i * nLon + j; };
  async function eachRow(file, fn) {
    const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    let col = null;
    for await (const line of rl) { if (!line) continue; const c = line.split(","); if (!col) { col = Object.fromEntries(c.map((n, i) => [n, i])); continue; } fn(c, col); }
  }
  const catchRaw = Object.fromEntries(ALL_SP.map((s) => [s, new Map()])), gearKg = Object.fromEntries(ALL_SP.map((s) => [s, {}]));
  const effRaw = new Map();
  for (const dir of LABS) {
    await eachRow(join(dir, "catch.csv"), (c, col) => {
      const sp = ASFIS_TO_SHORT[c[col.species]];
      if (!sp) return;
      const k = keyOf(+c[col.lat], +c[col.lon]);
      if (k < 0) return;
      const gi = gIdx(c[col.gear]), kg = +c[col.kg], date = c[col.date];
      gearKg[sp][GEARS[gi]] = (gearKg[sp][GEARS[gi]] ?? 0) + kg;
      const dm = catchRaw[sp].get(date) ?? catchRaw[sp].set(date, new Map()).get(date);
      const a = dm.get(k) ?? dm.set(k, new Float32Array(NG)).get(k);
      a[gi] += kg;
    });
    await eachRow(join(dir, "effort.csv"), (c, col) => {
      const k = keyOf(+c[col.lat], +c[col.lon]);
      if (k < 0) return;
      const date = c[col.date], dm = effRaw.get(date) ?? effRaw.set(date, new Map()).get(date);
      const a = dm.get(k) ?? dm.set(k, new Float32Array(NG)).get(k);
      a[gIdx(c[col.geartype])] += +c[col.hours];
    });
    lg("nhãn", dir.split("/").pop());
  }
  const spLive = ALL_SP.filter((s) => Object.keys(gearKg[s]).length);
  const tgIdx = {};
  for (const s of spLive) tgIdx[s] = targetGears(gearKg[s]).map(gIdx);
  const shiftDay = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

  /* tổng nhãn (kg loài, giờ nghề mục tiêu) theo khoá ô, ô biển */
  const maskCache = new Map(), totCache = new Map();
  const maskOf = (d) => maskCache.get(d) ?? maskCache.set(d, readSeaMask(FEAT, d)).get(d);
  function totals(s, d) {
    const ck = `${s}|${d}`;
    if (totCache.has(ck)) return totCache.get(ck);
    const mask = maskOf(d), tg = tgIdx[s], pk = [], pw = [], nk = [], nw = [];
    for (const [k, a] of catchRaw[s].get(d) ?? []) { if (!mask[k]) continue; let w = 0; for (const g of tg) w += a[g]; if (w > 0) { pk.push(k); pw.push(w); } }
    for (const [k, a] of effRaw.get(d) ?? []) { if (!mask[k]) continue; let w = 0; for (const g of tg) w += a[g]; if (w > 0) { nk.push(k); nw.push(w); } }
    const o = { pk: Int32Array.from(pk), pw: Float32Array.from(pw), nk: Int32Array.from(nk), nw: Float32Array.from(nw) };
    totCache.set(ck, o);
    return o;
  }
  const hasKg = (s, d) => totals(s, d).pk.length > 0;

  /* ── lưới tĩnh theo tag, và bộ x (giữ nguyên hàm đọc lưới của production: fleetPresenceGrid) ── */
  const gridCache = new Map(), presCache = new Map();
  const NONE = "none";
  function gridOf(kind, tag) {
    const k = `${kind}|${tag}`;
    if (!gridCache.has(k)) {
      const f = join(kind === "fleet" ? FLEET_DIR : CATCH_DIR, `${kind}-ex-${tag}.json`);
      if (!existsSync(f)) throw new Error(`thiếu lưới ${f}`);
      const g = JSON.parse(readFileSync(f, "utf8"));
      gridCache.set(k, { g, Ks: kind === "catch" ? ksOfGrid(g) : null });
    }
    return gridCache.get(k);
  }
  /** x∈[0,1] phẳng nLat×nLon của loài s ở tag/tháng; null = không có (x=0) */
  function xGrid(kind, tag, s, month) {
    if (tag === NONE) return null;
    const ck = `${kind}|${tag}|${s}|${month}`;
    if (presCache.has(ck)) return presCache.get(ck);
    const { g, Ks } = gridOf(kind, tag);
    const gears = g.speciesGears[s];
    const out = gears && gears.length ? fleetPresenceGrid(g, gears, month, kind === "fleet" ? FLEET_FULL_HOURS : (Ks[s] ?? BASE_DEFAULT_KS)) : null;
    presCache.set(ck, out);
    return out;
  }

  /* ── thông tin ngày: ô, khe, z (dị thường theo trung bình tháng của ô) ── */
  const NZ = 8, ZNAMES = ["sst", "logChl", "frontNhiệt", "frontMồi", "xoáy", "nướcTrồi", "hộiTụ", "tầngNhiệt"];
  const info = new Map();
  const rawCh = new Map();
  const monthSum = new Map(), monthCnt = new Map();
  for (const d of dates) {
    const F = decodeFeatures(readFeatureDay(FEAT, d), MF.regions);
    const n = F.length, keys = new Int32Array(n), slot = new Int32Array(NK).fill(-1), ch = new Float32Array(n * NZ);
    const ym = d.slice(0, 7);
    let S = monthSum.get(ym), C = monthCnt.get(ym);
    if (!S) { monthSum.set(ym, (S = new Float64Array(NK * NZ))); monthCnt.set(ym, (C = new Float64Array(NK * NZ))); }
    for (let q = 0; q < n; q++) {
      const f = F[q], key = f.i * nLon + f.j;
      keys[q] = key; slot[key] = q;
      const v = [f.t, f.c > 0 ? Math.log10(f.c) : NaN, f.fThermFront, f.fChlFront, f.fEddy ?? NaN, f.upwTerm ?? NaN, f.convTerm ?? NaN, f.thermoAnomM ?? NaN];
      for (let c = 0; c < NZ; c++) {
        ch[q * NZ + c] = v[c];
        if (Number.isFinite(v[c])) { S[key * NZ + c] += v[c]; C[key * NZ + c]++; }
      }
    }
    info.set(d, { keys, slot, n, month: monthOf(d), ym });
    rawCh.set(d, ch);
  }
  const zScale = new Float64Array(NZ).fill(1);
  { const ss = new Float64Array(NZ), nn = new Float64Array(NZ);
    for (const d of dates) { const I = info.get(d), ch = rawCh.get(d), S = monthSum.get(I.ym), C = monthCnt.get(I.ym);
      for (let q = 0; q < I.n; q++) for (let c = 0; c < NZ; c++) { const v = ch[q * NZ + c], k = I.keys[q] * NZ + c; if (Number.isFinite(v) && C[k] > 1) { const a = v - S[k] / C[k]; ss[c] += a * a; nn[c]++; } } }
    for (let c = 0; c < NZ; c++) zScale[c] = nn[c] > 10 ? Math.sqrt(ss[c] / nn[c]) || 1 : 1; }
  const zOf = new Map();
  for (const d of dates) {
    const I = info.get(d), ch = rawCh.get(d), S = monthSum.get(I.ym), C = monthCnt.get(I.ym), z = new Float32Array(I.n * NZ);
    for (let q = 0; q < I.n; q++) for (let c = 0; c < NZ; c++) { const v = ch[q * NZ + c], k = I.keys[q] * NZ + c; z[q * NZ + c] = Number.isFinite(v) && C[k] > 1 ? clampZ((v - S[k] / C[k]) / zScale[c]) : 0; }
    zOf.set(d, z);
  }
  rawCh.clear();
  lg("z dị thường xong; thang", Array.from(zScale, (v) => v.toFixed(3)).join(" "));
  const dayBlock = (d) => Math.floor((Number(d.slice(8, 10)) - 1) / 7);

  /* ── bảng tĩnh (log-lift) ── */
  const NDIM = [BASE_DEPTH_EDGES.length - 1, BASE_COAST_EDGES.length - 1, BASE_LAT_BINS];
  function fitTables(dayList, species) {
    const out = {};
    for (const s of species) {
      const kg = NDIM.map((n) => new Array(n).fill(0)), hr = NDIM.map((n) => new Array(n).fill(0));
      for (const d of dayList) {
        const T = totals(s, d);
        for (let i = 0; i < T.pk.length; i++) { const k = T.pk[i], w = T.pw[i]; if (binD[k] >= 0) kg[0][binD[k]] += w; if (binC[k] >= 0) kg[1][binC[k]] += w; kg[2][binL[k]] += w; }
        for (let i = 0; i < T.nk.length; i++) { const k = T.nk[i], w = T.nw[i]; if (binD[k] >= 0) hr[0][binD[k]] += w; if (binC[k] >= 0) hr[1][binC[k]] += w; hr[2][binL[k]] += w; }
      }
      const L = fitStaticLift(kg, hr);
      out[s] = { depth: L[0], coast: L[1], lat: L[2] };
    }
    return out;
  }
  const statOf = (t, k) => (binD[k] >= 0 ? t.depth[binD[k]] : 0) + (binC[k] >= 0 ? t.coast[binC[k]] : 0) + t.lat[binL[k]];
  const cfCache = new Map();
  function tablesCF(ym, parity) { // fit trên NỬA KIA (khối 7 ngày chẵn/lẻ) của chính tháng — cross-fit như 2A
    const k = `${ym}|${parity}`;
    if (!cfCache.has(k)) cfCache.set(k, fitTables(dates.filter((d) => d.startsWith(ym) && dayBlock(d) % 2 !== parity), spLive));
    return cfCache.get(k);
  }

  /* ── hàng huấn luyện của nền: mọi loài × mọi ngày, theo bộ tag ── */
  const fwdTagOf = (d) => { const ym = d.slice(0, 7); return ym <= "2026-01" ? NONE : `fwd-${ym}`; };
  const rowsCache = { month: new Map(), fwd: new Map() };
  function rowsFor(kind, s, d) {
    const cache = rowsCache[kind], ck = `${s}|${d}`;
    if (cache.has(ck)) return cache.get(ck);
    const T = totals(s, d), month = monthOf(d), tag = kind === "month" ? d.slice(0, 7) : fwdTagOf(d);
    const xc = xGrid("catch", tag, s, month), xf = xGrid("fleet", tag, s, month), se = seasonOf(s, month);
    const tab = tablesCF(d.slice(0, 7), dayBlock(d) % 2)[s];
    const m = T.pk.length + T.nk.length, key = new Int32Array(m), x = new Float32Array(m * 4), y = new Uint8Array(m), w = new Float32Array(m);
    let r = 0;
    for (const [ks, ws, yy] of [[T.pk, T.pw, 1], [T.nk, T.nw, 0]])
      for (let i = 0; i < ks.length; i++, r++) { const k = ks[i]; key[r] = k; x[r * 4] = xc ? xc[k] : 0; x[r * 4 + 1] = xf ? xf[k] : 0; x[r * 4 + 2] = statOf(tab, k); x[r * 4 + 3] = se; y[r] = yy; w[r] = ws[i]; }
    const o = { key, x, y, w, m };
    cache.set(ck, o);
    return o;
  }
  /** hệ số nền theo nhóm loài, fit trên `trainDays` (hàng chuẩn lại: mỗi loài tổng pos = tổng neg = 1) */
  function fitBase(kind, trainDays) {
    const coef = {};
    for (const g of BASE_GROUPS) {
      const parts = [];
      let tot = 0;
      for (const s of spLive) {
        if (groupOf(s) !== g) continue;
        let P = 0, N = 0;
        for (const d of trainDays) { const R = rowsFor(kind, s, d); for (let i = 0; i < R.m; i++) (R.y[i] ? (P += R.w[i]) : (N += R.w[i])); }
        if (!(P > 0) || !(N > 0)) continue;
        parts.push([s, P, N]);
        for (const d of trainDays) tot += rowsFor(kind, s, d).m;
      }
      if (tot < 50) continue;
      const X = new Float64Array(tot * 5), y = new Uint8Array(tot), w = new Float64Array(tot);
      let r = 0;
      for (const [s, P, N] of parts) for (const d of trainDays) {
        const R = rowsFor(kind, s, d);
        for (let i = 0; i < R.m; i++, r++) { X[r * 5] = 1; for (let c = 0; c < 4; c++) X[r * 5 + 1 + c] = R.x[i * 4 + c]; y[r] = R.y[i]; w[r] = R.w[i] / (R.y[i] ? P : N); }
      }
      coef[g] = logisticFit({ X, y, w, d: 5, ridge: 1e-3 });
    }
    return coef;
  }

  /* ── hồ sơ loài đích: dấu β ── */
  const prof = Object.fromEntries(SPECIES.map((s) => [s, SPECIES_PROFILES.find((p) => p.short === s)]));
  const signOf = {};
  for (const s of SPECIES) {
    const p = prof[s], v = [];
    for (const [rid, rr] of Object.entries(climoAll)) for (let m = 1; m <= 12; m++) if (seasonWeights(rid, m).get(p.species) > 0.99 && rr[m]?.p50 != null) v.push(rr[m].p50);
    signOf[s] = residualSigns(p, v.length ? v.reduce((a, b) => a + b, 0) / v.length : 28);
  }
  const C3 = [0, 2, 1]; // nhánh (c): cột z = [frontNhiệt, sst, logChl]
  const ORACLE = argv.includes("--oracle"); // ĐỐI CHỨNG DƯƠNG: nhánh "o" rò nhãn ngày — PHẢI thắng, nếu không thì bộ đo hỏng
  const TEST_BR = ORACLE ? ["a", "b", "c", "o"] : ["a", "b", "c"];
  const BRANCHES = ["nen", ...TEST_BR];

  /** residual (b)/(c) cho loài s: fit trên hàng huấn luyện (offset = nền_raw) */
  function fitResidual(kind, s, trainDays, coefBase, which) {
    const gr = groupOf(s), cf = coefBase[gr];
    const cols = which === "b" ? [...Array(NZ).keys()] : C3;
    const dd = cols.length + 1;
    let tot = 0, P = 0, N = 0;
    for (const d of trainDays) { const R = rowsFor(kind, s, d), sl = info.get(d).slot; for (let i = 0; i < R.m; i++) if (sl[R.key[i]] >= 0) { tot++; (R.y[i] ? (P += R.w[i]) : (N += R.w[i])); } }
    if (tot < 200 || !(P > 0) || !(N > 0)) return null;
    const X = new Float64Array(tot * dd), y = new Uint8Array(tot), w = new Float64Array(tot), off = new Float64Array(tot);
    let r = 0;
    for (const d of trainDays) {
      const R = rowsFor(kind, s, d), I = info.get(d), z = zOf.get(d);
      for (let i = 0; i < R.m; i++) {
        const q = I.slot[R.key[i]];
        if (q < 0) continue;
        X[r * dd] = 1;
        for (let c = 0; c < cols.length; c++) X[r * dd + 1 + c] = z[q * NZ + cols[c]];
        y[r] = R.y[i]; w[r] = R.w[i] / (R.y[i] ? P : N);
        off[r] = baseRaw(cf, [R.x[i * 4], R.x[i * 4 + 1], R.x[i * 4 + 2], R.x[i * 4 + 3]], true);
        r++;
      }
    }
    const signs = [null, ...cols.map((c) => signOf[s][c])];
    return { beta: logisticFit({ X, y, w, off, d: dd, signs, ridge: RIDGE }), cols, signs };
  }

  /* ── chấm một ngày thử cho loài s: 4 nhánh → điểm 0..1 mỗi ô của cache ── */
  function scoreBranches(s, d, testTag, coefBase, tab, res, F) {
    const I = info.get(d), month = I.month, p = prof[s], z = zOf.get(d), n = I.n, gr = groupOf(s), cf = coefBase[gr];
    const xc = xGrid("catch", testTag, s, month), xf = xGrid("fleet", testTag, s, month), se = seasonOf(s, month);
    const raw0 = new Float64Array(n);
    for (let q = 0; q < n; q++) { const k = I.keys[q]; raw0[q] = baseRaw(cf, [xc ? xc[k] : 0, xf ? xf[k] : 0, statOf(tab[s], k), se], true); }
    const out = { nen: rankFraction(raw0) };
    // (a) noisy-OR như production, hai kênh tĩnh của HSI TẮT (nền thay chúng)
    const k0 = { month, climo: climoAll };
    const a = new Float64Array(n);
    for (let q = 0; q < n; q++) {
      const sW = seasonWeights(F[q].regionId, month).get(p.species);
      const fitSat = sW == null ? 0 : scoreCell(F[q], p, sW, 0, 0, k0, cellHabitat(F[q], p, 0, k0));
      a[q] = 1 - (1 - fitSat) * (1 - CATCH_SCALE * (rankToScore(out.nen[q], HOT) / 100));
    }
    out.a = a;
    for (const which of ["b", "c"]) {
      const R = res[which];
      if (!R) { out[which] = out.nen; continue; }
      const raw = new Float64Array(raw0);
      for (let q = 0; q < n; q++) { let v = R.beta[0]; for (let c = 0; c < R.cols.length; c++) v += R.beta[1 + c] * z[q * NZ + R.cols[c]]; raw[q] = raw0[q] + v; }
      out[which] = rankFraction(raw);
    }
    return out;
  }

  /** nhãn đặt lên ô của ngày d (lệch `shift` ngày): theo nghề mục tiêu + tổng; khối lượng ngoài cache = điểm 0 */
  function labelVec(s, d, shift) {
    const ld = shift ? shiftDay(d, shift) : d, I = info.get(d), mask = maskOf(d), tg = tgIdx[s], G = tg.length, n = I.n;
    const posC = new Float64Array(n * G), negC = new Float64Array(n * G), outPos = new Float64Array(G), outNeg = new Float64Array(G);
    const kg = new Float64Array(n), hr = new Float64Array(n);
    for (const [k, a] of catchRaw[s].get(ld) ?? []) { if (!mask[k]) continue; const q = I.slot[k]; tg.forEach((g, gi) => { if (q < 0) outPos[gi] += a[g]; else { posC[q * G + gi] = a[g]; kg[q] += a[g]; } }); }
    for (const [k, a] of effRaw.get(ld) ?? []) { if (!mask[k]) continue; const q = I.slot[k]; tg.forEach((g, gi) => { if (q < 0) outNeg[gi] += a[g]; else { negC[q * G + gi] = a[g]; hr[q] += a[g]; } }); }
    let nSea = 0;
    for (let k = 0; k < NK; k++) nSea += mask[k];
    return { G, posC, negC, outPos, outNeg, outArea: nSea - n, kg, hr, has: kg.some((v) => v > 0) || outPos.some((v) => v > 0) };
  }
  function recOf(score, L, n) {
    const G = L.G, rec = new Float64Array(recLen(G)), area = 2 * G * NBF;
    for (let q = 0; q < n; q++) {
      const b = binOf(score[q]);
      for (let g = 0; g < G; g++) { const a = L.posC[q * G + g], c = L.negC[q * G + g]; if (a) rec[2 * g * NBF + b] += a; if (c) rec[(2 * g + 1) * NBF + b] += c; }
      rec[area + b] += 1;
    }
    for (let g = 0; g < G; g++) { rec[2 * g * NBF] += L.outPos[g]; rec[(2 * g + 1) * NBF] += L.outNeg[g]; }
    rec[area] += L.outArea;
    return rec;
  }

  /* ── chạy một sơ đồ (folds | f3): trả bản ghi theo (loài, nhánh, ngày thử) ── */
  const evalDays = dates.filter((d) => SPECIES.some((s) => hasKg(s, d)) || true);
  function runScheme(name) {
    const splits = name === "folds"
      ? makeFolds(evalDays, MF_FOLDS(), PAD).filter((f) => f.test.length >= 5 && f.train.length >= Number(arg("min-train", 20))).map((f) => ({ ...f, kind: "month", testTag: () => f.name }))
      : makeForward(evalDays, PAD, Number(arg("min-train", 20))).filter((f) => f.test.some((d) => d <= "2026-10-11")).map((f) => ({ ...f, kind: "fwd", testTag: () => f.name }));
    const per = Object.fromEntries(SPECIES.map((s) => [s, []]));
    for (const sp of splits) {
      const ts = Date.now();
      const trainDays = sp.train.filter((d) => d <= "2026-10-11"), testDays = sp.test.filter((d) => d <= "2026-10-11");
      const coef = fitBase(sp.kind, trainDays);
      const tab = fitTables(trainDays, spLive);
      for (const s of SPECIES) {
        const res = { b: fitResidual(sp.kind, s, trainDays, coef, "b"), c: fitResidual(sp.kind, s, trainDays, coef, "c") };
        for (const d of testDays) {
          if (!hasKg(s, d)) continue;
          const F = decodeFeatures(readFeatureDay(FEAT, d), MF.regions);
          const sc = scoreBranches(s, d, sp.testTag(d), coef, tab, res, F);
          const n = info.get(d).n;
          const Lt = labelVec(s, d, 0);
          if (ORACLE) { const o = new Float64Array(n); const base = sc.nen; for (let q = 0; q < n; q++) o[q] = base[q] + (Lt.kg[q] > 0 ? 1 : 0); sc.o = rankFraction(o); }
          const cs = [CTRL, -CTRL].find((c) => { const ld = shiftDay(d, c); return (catchRaw[s].get(ld)?.size ?? 0) > 0 && ld >= "2026-01-01" && ld <= "2026-10-11"; });
          const Lc = cs == null ? null : labelVec(s, d, cs);
          const rec = { d, split: sp.name, G: Lt.G, hot: {}, local: {}, score: {}, kg: Lt.kg, hr: Lt.hr, true: {}, ctrl: Lc && Lc.has ? {} : null, beta: { b: res.b && Array.from(res.b.beta), c: res.c && Array.from(res.c.beta) } };
          for (const br of BRANCHES) {
            const sv = sc[br];
            rec.true[br] = recOf(sv, Lt, n);
            if (rec.ctrl) rec.ctrl[br] = recOf(sv, Lc, n);
            const loc = localAucDay(sv, Lt.kg, Lt.hr, Int32Array.from(info.get(d).keys, (k) => blk[k]));
            rec.local[br] = [loc.num, loc.den];
            rec.score[br] = Float32Array.from(sv);
            let hot = 0;
            for (let q = 0; q < n; q++) hot += br === "a" ? (sv[q] >= 0.5 ? 1 : 0) : (rankToScore(sv[q], HOT) >= 50 ? 1 : 0);
            rec.hot[br] = [hot, n];
          }
          per[s].push(rec);
        }
      }
      lg(`${name} ${sp.name}: thử ${testDays.length} ngày, train ${trainDays.length} (${((Date.now() - ts) / 1000).toFixed(0)}s)`);
    }
    return per;
  }
  function MF_FOLDS() {
    const months = [...new Set(evalDays.map((d) => d.slice(0, 7)))].sort(), out = new Map();
    for (const m of months) { const key = `${m.slice(0, 4)}-${Math.floor((Number(m.slice(5, 7)) - 1) / 2)}`; (out.get(key) ?? out.set(key, []).get(key)).push(m); }
    return [...out.values()];
  }

  /* ── thống kê ── */
  const stat = (m) => m.within;
  function analyse(per) {
    const out = {};
    for (const s of SPECIES) {
      const recs = per[s];
      if (recs.length < 8) { out[s] = null; continue; }
      const G = recs[0].G, ids = blockIds(recs.map((r) => r.d));
      const o = { days: recs.length, nen: null, branches: {} };
      const sumRec = (get) => { const t = new Float64Array(recLen(G)); recs.forEach((r) => { const x = get(r); if (x) for (let i = 0; i < t.length; i++) t[i] += x[i]; }); return t; };
      o.nen = recMetrics(sumRec((r) => r.true.nen), G);
      const withC = recs.map((r, i) => ({ r, i })).filter(({ r }) => r.ctrl);
      const idsC = withC.length ? blockIds(withC.map(({ r }) => r.d)) : [];
      for (const br of TEST_BR) {
        const raw = bootstrapGain(recs.map((r, i) => ({ block: ids[i], base: r.true.nen, fit: r.true[br] })), G, stat, BOOT);
        const dyn = withC.length >= 8 ? bootstrapGain(withC.map(({ r }, k) => ({ block: idsC[k], base: r.true.nen, fit: r.true[br], cbase: r.ctrl.nen, cfit: r.ctrl[br] })), G, stat, BOOT) : null;
        // AUC cục bộ: Δ = (Σnum_br − Σnum_nền)/Σden, bootstrap khối 7 ngày
        const loc = localDelta(recs, ids, br);
        // Spearman dị thường của nhánh (và nền) trên các ngày thử
        const sp = spearmanOf(recs, br), spN = br === "a" ? spearmanOf(recs, "nen") : null;
        const hot = recs.reduce((a, r) => [a[0] + r.hot[br][0], a[1] + r.hot[br][1]], [0, 0]), hotN = recs.reduce((a, r) => [a[0] + r.hot.nen[0], a[1] + r.hot.nen[1]], [0, 0]);
        o.branches[br] = { within: recMetrics(sumRec((r) => r.true[br]), G).within, raw, dyn, local: loc, spearman: sp, spearmanNen: spN, hotShare: hot[0] / hot[1], hotShareNen: hotN[0] / hotN[1] };
      }
      o.spearmanNen = spearmanOf(recs, "nen");
      o.localNen = recs.reduce((a, r) => [a[0] + r.local.nen[0], a[1] + r.local.nen[1]], [0, 0]);
      o.localNen = o.localNen[0] / o.localNen[1];
      out[s] = o;
    }
    return out;
  }
  function localDelta(recs, ids, br) {
    const blocks = new Map();
    recs.forEach((r, i) => (blocks.get(ids[i]) ?? blocks.set(ids[i], []).get(ids[i])).push(r));
    const keys = [...blocks.keys()];
    const val = (sel) => { let nb = 0, nn = 0, den = 0; for (const k of sel) for (const r of blocks.get(k)) { nb += r.local[br][0]; nn += r.local.nen[0]; den += r.local.nen[1]; } return [nb / den, nn / den]; };
    const [auc, aucN] = val(keys);
    let rs = 11;
    const rnd = () => ((rs = (rs * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const xs = [];
    for (let b = 0; b < BOOT; b++) { const sel = Array.from({ length: keys.length }, () => keys[Math.floor(rnd() * keys.length)]); const [x, y] = val(sel); if (Number.isFinite(x - y)) xs.push(x - y); }
    xs.sort((a, b) => a - b);
    const q = (p) => xs[Math.round((xs.length - 1) * p)];
    return { auc, aucNen: aucN, delta: auc - aucN, lo: q(0.05), hi: q(0.95), p: (xs.filter((v) => v <= 0).length + 1) / (xs.length + 1) };
  }
  function spearmanOf(recs, br) {
    // các ô-ngày CÙNG khoá ô giữa các ngày: dùng khoá ô thật (cache có thể đổi số ô giữa ngày ⇒ dựng ma trận theo khoá)
    const dense = recs.map((r) => {
      const I = info.get(r.d), score = new Float64Array(NK).fill(NaN), kg = new Float64Array(NK), hours = new Float64Array(NK);
      for (let q = 0; q < I.n; q++) { score[I.keys[q]] = r.score[br][q]; kg[I.keys[q]] = r.kg[q]; hours[I.keys[q]] = r.hr[q]; }
      return { day: r.d, month: r.d.slice(0, 7), score, kg, hours };
    });
    // ô vắng khỏi cache một ngày: điểm NaN ⇒ không vào trung bình tháng; thay bằng 0 để cộng được (ô ngoài vụ)
    for (const x of dense) for (let k = 0; k < NK; k++) if (Number.isNaN(x.score[k])) x.score[k] = 0;
    const pairs = anomalyPairsDense(dense, NK);
    const cells = new Set();
    for (const x of dense) for (let k = 0; k < NK; k++) if (x.hours[k] >= 6) cells.add(k);
    return spearmanFromPairs(pairs, cells.size, { boot: Math.min(BOOT, 200) });
  }

  /* ── chạy ── */
  lg(`${dates.length} ngày cache, ${spLive.length} loài có nhãn; loài đích: ${SPECIES.join(", ")}`);
  const result = { builtAt: new Date().toISOString(), algoRev: FISH_ALGO_REV, params: { PAD, BOOT, CTRL, RIDGE, HOT, CATCH_SCALE }, species: SPECIES, signs: signOf, zScale: Array.from(zScale), zNames: ZNAMES, schemes: {} };
  for (const name of SCHEMES) {
    const per = runScheme(name);
    result.schemes[name] = analyse(per);
    // lưu hệ số β cuối mỗi nếp để đọc "cái học được"
    result.schemes[name]._beta = Object.fromEntries(SPECIES.map((s) => [s, per[s].reduce((m, r) => ({ ...m, [r.split]: r.beta }), {})]));
    writeFileSync(join(OUT, "2d-result.json"), JSON.stringify(result, null, 1));
    lg(`xong sơ đồ ${name}`);
  }
  // Benjamini–Hochberg trên Δ thô của F3 (nhánh × loài) — chỉ báo cáo
  for (const name of SCHEMES) {
    const items = [];
    for (const s of SPECIES) for (const br of TEST_BR) { const x = result.schemes[name][s]?.branches[br]?.raw; if (x) items.push({ s, br, p: x.p }); }
    const bh = bhAdjust(items.map((i) => i.p), 0.1);
    items.forEach((it, k) => { result.schemes[name][it.s].branches[it.br].raw.pBH = bh.adj[k]; });
  }
  writeFileSync(join(OUT, "2d-result.json"), JSON.stringify(result, null, 1));
  printTable(result);
  lg("XONG");

  function printTable(R) {
    const f = (x, d = 3) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(d) : "—");
    const ci = (x) => (x ? `[${f(x.lo)}…${f(x.hi)}]` : "—");
    for (const name of SCHEMES) {
      console.log(`\n== ${name} ==`);
      for (const s of SPECIES) {
        const o = R.schemes[name][s];
        if (!o) { console.log(`${s}: thiếu ngày`); continue; }
        console.log(`${s}: ${o.days} ngày · nền trong-nghề ${o.nen.within.toFixed(3)} · AUC1° nền ${o.localNen.toFixed(3)} · ρ nền ${f(o.spearmanNen.rho)}`);
        for (const br of TEST_BR) {
          const b = o.branches[br];
          const win = b.raw.gain >= 0.01 && b.raw.lo > 0 && b.dyn && b.dyn.lo > 0 && b.local.lo > 0 && b.spearman.rho > 0 && b.spearman.pBoot < 0.05 && b.hotShare - b.hotShareNen <= 0.02;
          console.log(`  (${br}) Δ ${f(b.raw.gain)} ${ci(b.raw)} · động ${b.dyn ? f(b.dyn.gain) + " " + ci(b.dyn) : "—"} · AUC1° Δ ${f(b.local.delta)} ${ci(b.local)} · ρ ${f(b.spearman.rho)} p~${b.spearman.pBoot?.toFixed(3)} · ô≥50 ${(100 * b.hotShare).toFixed(1)}% vs ${(100 * b.hotShareNen).toFixed(1)}% → ${win ? "THẮNG" : "thua"}`);
        }
      }
    }
  }
}
