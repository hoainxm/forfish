// scripts/fish-plankton-eval-verify.mjs
// ─────────────────────────────────────────────────────────────────────────
// KIỂM CHỨNG ĐỘC LẬP kết luận "advection phù du vô ích" (phản biện).
// KHÔNG dùng lại harness của agent trước — dựng lõi metric riêng.
//
// Câu hỏi phản biện (Part A):
//   A1) RMSE toàn lưới bị vùng biển hở phương sai thấp chi phối → persistence
//       thắng hiển nhiên. Đo LẠI trên các TẬP CON: chl cao / front mạnh /
//       dòng mạnh. Ở nơi cá THẬT SỰ ở, advection có thắng không?
//   A2) RMSE điểm-theo-điểm phạt lệch pha, luôn ưu ái persistence. fish-predict
//       dùng FRONT (gradientStrength(logChl)). Đo bằng chỉ số ĐẶT FRONT ĐÚNG CHỖ:
//       tương quan |grad| trên tập ô front + độ dịch chuyển tối ưu (cross-corr).
//       PURE advection (kappa=0) có đặt front đúng hơn persistence không?
//   A5) Tái tạo độc lập: advScale=0 ≡ persistence (bằng chứng harness đúng).
//
// Chạy:  node scripts/fish-plankton-eval-verify.mjs
// Không key. Cần mạng (NOAA ERDDAP coastwatch).
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = "C:\\Users\\Envy\\AppData\\Local\\Temp\\claude\\C--Code-ForFish\\1498723b-1dfd-4b8b-b887-fc686b5a0497\\scratchpad\\plankton-eval-verify.json";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const LAT0 = 5.0, LAT1 = 22.0, LON0 = 102.0, LON1 = 118.0, STEP = 0.25;
const WINDOW_DAYS = 30;
const MAX_LEAD = 5;
const FETCH_TIMEOUT_MS = 45000;
const RETRIES = 2;
const CONCURRENCY = 4;

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const round = (x, p = 4) =>
  x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

const GLATS = [];
for (let v = LAT0; v <= LAT1 + 1e-9; v += STEP) GLATS.push(Math.round(v * 100) / 100);
const GLONS = [];
for (let v = LON0; v <= LON1 + 1e-9; v += STEP) GLONS.push(Math.round(v * 100) / 100);
const NLAT = GLATS.length, NLON = GLONS.length;

async function fetchJson(url, label) {
  let lastErr;
  for (let a = 0; a <= RETRIES; a++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`non-JSON ${r.status}`); }
      if (!r.ok) {
        if (r.status === 400 || r.status === 404) return { _empty: true };
        throw new Error(data?.reason || `HTTP ${r.status}`);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (a < RETRIES) await new Promise((res) => setTimeout(res, 800 * (a + 1)));
    }
  }
  console.warn(`  ! ${label}: ${String(lastErr).slice(0, 80)}`);
  return { _error: true };
}
async function pool(items, worker, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  return out;
}

function parseGrid(json, hasAlt, kelvin) {
  const rows = json?.table?.rows ?? [];
  const iLat = hasAlt ? 2 : 1, iLon = iLat + 1, iVal = iLon + 1;
  const latSet = new Set(), lonSet = new Set();
  for (const r of rows) { latSet.add(r[iLat]); lonSet.add(r[iLon]); }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  const latIdx = new Map(lats.map((v, i) => [v, i]));
  const lonIdx = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  for (const r of rows) {
    const v = r[iVal];
    if (typeof v === "number" && Number.isFinite(v))
      values[latIdx.get(r[iLat])][lonIdx.get(r[iLon])] = kelvin ? v - 273.15 : v;
  }
  return { lats, lons, values };
}
function bilinear(grid, lat, lon) {
  const { lats, lons, values } = grid;
  if (lat < lats[0] || lat > lats[lats.length - 1]) return NaN;
  if (lon < lons[0] || lon > lons[lons.length - 1]) return NaN;
  let i = 0; while (i < lats.length - 2 && lats[i + 1] < lat) i++;
  let j = 0; while (j < lons.length - 2 && lons[j + 1] < lon) j++;
  const t = (lat - lats[i]) / (lats[i + 1] - lats[i]);
  const s = (lon - lons[j]) / (lons[j + 1] - lons[j]);
  const c = [
    [values[i][j], (1 - t) * (1 - s)],
    [values[i][j + 1], (1 - t) * s],
    [values[i + 1][j], t * (1 - s)],
    [values[i + 1][j + 1], t * s],
  ];
  let acc = 0, w = 0;
  for (const [v, ww] of c) if (Number.isFinite(v)) { acc += v * ww; w += ww; }
  return w > 0 ? acc / w : NaN;
}
function toCommon(grid) {
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++)
      out[a * NLON + b] = bilinear(grid, GLATS[a], GLONS[b]);
  return out;
}
const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T00:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

const log10safe = (v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN);
function bilinFlat(flat, lat, lon) {
  if (lat < LAT0 || lat > LAT1 || lon < LON0 || lon > LON1) return NaN;
  const fa = (lat - LAT0) / STEP, fb = (lon - LON0) / STEP;
  const a = Math.min(NLAT - 2, Math.floor(fa)), b = Math.min(NLON - 2, Math.floor(fb));
  const t = fa - a, s = fb - b;
  const c = [
    [flat[a * NLON + b], (1 - t) * (1 - s)],
    [flat[a * NLON + b + 1], (1 - t) * s],
    [flat[(a + 1) * NLON + b], t * (1 - s)],
    [flat[(a + 1) * NLON + b + 1], t * s],
  ];
  let acc = 0, w = 0;
  for (const [v, ww] of c) if (Number.isFinite(v)) { acc += v * ww; w += ww; }
  return w > 0 ? acc / w : NaN;
}
// |gradient| trung tâm (log chl) — GIỐNG gradientStrength của fish-predict (chưa clamp)
function gradMag(flat) {
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  for (let a = 1; a < NLAT - 1; a++)
    for (let b = 1; b < NLON - 1; b++) {
      const c = flat[a * NLON + b];
      if (!Number.isFinite(c)) continue;
      const up = flat[(a + 1) * NLON + b], dn = flat[(a - 1) * NLON + b];
      const rt = flat[a * NLON + b + 1], lf = flat[a * NLON + b - 1];
      const gy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      const gx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      out[a * NLON + b] = Math.hypot(gx, gy);
    }
  return out;
}
const M_PER_DEG_LAT = 110540;
const SUBSTEPS = 4;
// PURE semi-Lagrangian advection (kappa=0, growth=0, relax=1) — chỉ đẩy trôi.
// truy NGƯỢC k ngày theo dòng chảy các ngày trung gian.
function advectPure(srcLogFlat, curDays, k, advScale) {
  if (advScale === 0) return srcLogFlat;
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  const dt = 1 / SUBSTEPS;
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      let lat = GLATS[a], lon = GLONS[b], ok = true;
      for (let day = k - 1; day >= 0 && ok; day--) {
        const cur = curDays[day];
        if (!cur) { ok = false; break; }
        for (let sub = 0; sub < SUBSTEPS; sub++) {
          const u = bilinFlat(cur.u, lat, lon), v = bilinFlat(cur.v, lat, lon);
          if (!Number.isFinite(u) || !Number.isFinite(v)) { ok = false; break; }
          const mLon = 111320 * Math.cos((lat * Math.PI) / 180);
          lon -= (advScale * u * 86400 * dt) / mLon;
          lat -= (advScale * v * 86400 * dt) / M_PER_DEG_LAT;
        }
      }
      out[a * NLON + b] = ok ? bilinFlat(srcLogFlat, lat, lon) : NaN;
    }
  return out;
}

function rmseOn(pred, act, per, mask) {
  let sa = 0, sp = 0, n = 0;
  for (let i = 0; i < act.length; i++) {
    if (!mask[i]) continue;
    const a = act[i], p = pred[i], q = per[i];
    if (!Number.isFinite(a) || !Number.isFinite(p) || !Number.isFinite(q)) continue;
    sa += (p - a) ** 2; sp += (q - a) ** 2; n++;
  }
  return { adv: n ? Math.sqrt(sa / n) : null, per: n ? Math.sqrt(sp / n) : null, n };
}
function pearsonOn(predV, actV, mask) {
  let n = 0, sp = 0, sa = 0, spp = 0, saa = 0, spa = 0;
  for (let i = 0; i < actV.length; i++) {
    if (!mask[i]) continue;
    const p = predV[i], a = actV[i];
    if (!Number.isFinite(p) || !Number.isFinite(a)) continue;
    n++; sp += p; sa += a; spp += p * p; saa += a * a; spa += p * a;
  }
  if (n < 5) return null;
  const cov = spa / n - (sp / n) * (sa / n);
  const vp = spp / n - (sp / n) ** 2, va = saa / n - (sa / n) ** 2;
  return vp > 0 && va > 0 ? cov / Math.sqrt(vp * va) : null;
}
function percentile(arr, p) {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function main() {
  const probe = await fetchJson(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 2 * 864e5));
  const START = addDays(END, -(WINDOW_DAYS - 1));
  const days = [];
  for (let d = START; d <= END; d = addDays(d, 1)) days.push(d);
  console.log(`Lưới ${NLAT}×${NLON}@0.25° · cửa sổ ${START}..${END} (${days.length} ngày)`);

  const chlByDay = {}, curByDay = {};
  console.log("Kéo chl + dòng chảy...");
  await pool(days, async (d) => {
    const [cj, uj, vj] = await Promise.all([
      fetchJson(chlUrl(d), `chl ${d}`),
      fetchJson(curUrl(d, "u"), `u ${d}`),
      fetchJson(curUrl(d, "v"), `v ${d}`),
    ]);
    if (cj?.table) chlByDay[d] = toCommon(parseGrid(cj, true, false));
    if (uj?.table && vj?.table)
      curByDay[d] = { u: toCommon(parseGrid(uj, false, false)), v: toCommon(parseGrid(vj, false, false)) };
    process.stdout.write(".");
  }, CONCURRENCY);
  console.log("");

  // cache log-chl nguồn + |grad| + tốc độ dòng
  const srcLog = {}, tgtGrad = {}, curSpeed = {};
  for (const d of days) {
    if (chlByDay[d]) {
      const lf = Float64Array.from(chlByDay[d], log10safe);
      srcLog[d] = lf;
      tgtGrad[d] = gradMag(lf);
    }
    if (curByDay[d]) {
      const sp = new Float64Array(NLAT * NLON).fill(NaN);
      for (let i = 0; i < NLAT * NLON; i++) {
        const u = curByDay[d].u[i], v = curByDay[d].v[i];
        if (Number.isFinite(u) && Number.isFinite(v)) sp[i] = Math.hypot(u, v);
      }
      curSpeed[d] = sp;
    }
  }

  // cặp (D,k)
  const pairs = [];
  for (let i = 0; i < days.length; i++) {
    const D = days[i];
    if (!chlByDay[D]) continue;
    for (let k = 1; k <= MAX_LEAD; k++) {
      const T = addDays(D, k);
      if (!chlByDay[T]) continue;
      const cd = [];
      let ok = true;
      for (let dd = 0; dd < k; dd++) {
        const day = addDays(D, dd);
        if (!curByDay[day]) { ok = false; break; }
        cd.push(curByDay[day]);
      }
      if (ok) pairs.push({ D, T, k, curDays: cd });
    }
  }
  console.log(`Cặp (D,k) hợp lệ: ${pairs.length}`);

  // ── A5: reproduce persistence identity ─────────────────────────────────
  let identOk = true, identMaxDiff = 0;
  for (const pr of pairs.slice(0, 20)) {
    const pred = advectPure(srcLog[pr.D], pr.curDays, pr.k, 0);
    for (let i = 0; i < pred.length; i++) {
      const a = pred[i], b = srcLog[pr.D][i];
      if (Number.isFinite(a) !== Number.isFinite(b)) { identOk = false; }
      else if (Number.isFinite(a)) identMaxDiff = Math.max(identMaxDiff, Math.abs(a - b));
    }
  }
  console.log(`\n[A5] advScale=0 ≡ persistence: ${identOk && identMaxDiff < 1e-12 ? "ĐÚNG" : "SAI"} (maxDiff=${identMaxDiff})`);

  // ── A1: subset RMSE (global vs chl-cao vs front-mạnh vs dòng-mạnh) ──────
  // với vài advScale, gộp mọi cặp theo lead. Mask xây trên TỪNG cặp (per-pair
  // percentile) để "nơi cá ở" phản ánh điều kiện ngày đó.
  const SCALES = [0, 0.1, 0.25, 0.5, 1.0];
  const subsets = ["global", "chlHigh", "frontStrong", "curStrong", "coastal"];
  // coastal = ô có dòng chảy hợp lệ nhưng gần ranh NaN (ven bờ) — xấp xỉ bằng
  // ô mà >=1 trong 4 hàng xóm trực tiếp là NaN dòng chảy.
  const acc = {}; // key `${sub}|${scale}|${lead}` -> {sa,sp,n}
  const gradAcc = {}; // key `${sub}|${scale}|${lead}` -> pearson accum for |grad|
  const initG = () => ({ n: 0, sp: 0, sa: 0, spp: 0, saa: 0, spa: 0 });

  for (const pr of pairs) {
    const src = srcLog[pr.D], act = srcLog[pr.T], per = src;
    const speedD = curSpeed[pr.D];
    const gradD = tgtGrad[pr.D], gradT = tgtGrad[pr.T];
    // ngưỡng per-pair
    const chlHi = percentile(Array.from(src), 75);
    const frontHi = percentile(Array.from(gradD), 75);
    const curHi = percentile(Array.from(speedD), 75);
    // coastal mask
    const finiteCur = (i) => Number.isFinite(speedD[i]);
    const isCoastal = new Uint8Array(NLAT * NLON);
    for (let a = 1; a < NLAT - 1; a++)
      for (let b = 1; b < NLON - 1; b++) {
        const i = a * NLON + b;
        if (!Number.isFinite(src[i])) continue;
        if (!finiteCur(i)) continue;
        if (!finiteCur(i + 1) || !finiteCur(i - 1) || !finiteCur(i + NLON) || !finiteCur(i - NLON))
          isCoastal[i] = 1;
      }
    const masks = {
      global: (i) => true,
      chlHigh: (i) => src[i] >= chlHi,
      frontStrong: (i) => gradD[i] >= frontHi,
      curStrong: (i) => speedD[i] >= curHi,
      coastal: (i) => isCoastal[i] === 1,
    };
    for (const scale of SCALES) {
      const pred = advectPure(src, pr.curDays, pr.k, scale);
      const predGrad = gradMag(pred);
      for (const sub of subsets) {
        const mfn = masks[sub];
        const key = `${sub}|${scale}|${pr.k}`;
        (acc[key] ??= { sa: 0, sp: 0, n: 0 });
        (gradAcc[key] ??= initG());
        const A = acc[key], G = gradAcc[key];
        for (let i = 0; i < act.length; i++) {
          if (!mfn(i)) continue;
          const a = act[i], p = pred[i], q = per[i];
          // MASK CHUNG: chỉ chấm ô mà adv, per, actual đều hữu hạn (apples-to-apples)
          if (!Number.isFinite(a) || !Number.isFinite(p) || !Number.isFinite(q)) continue;
          A.sa += (p - a) ** 2; A.sp += (q - a) ** 2; A.n++;
          // front placement: tương quan |grad| dự báo vs |grad| thực
          const pg = predGrad[i], ag = gradT[i];
          if (Number.isFinite(pg) && Number.isFinite(ag)) {
            G.n++; G.sp += pg; G.sa += ag; G.spp += pg * pg; G.saa += ag * ag; G.spa += pg * ag;
          }
        }
      }
    }
  }
  const finishG = (G) => {
    if (G.n < 5) return null;
    const cov = G.spa / G.n - (G.sp / G.n) * (G.sa / G.n);
    const vp = G.spp / G.n - (G.sp / G.n) ** 2, va = G.saa / G.n - (G.sa / G.n) ** 2;
    return vp > 0 && va > 0 ? cov / Math.sqrt(vp * va) : null;
  };

  // ── báo cáo A1: RMSE theo subset (gộp mọi lead, trọng số n) ─────────────
  console.log("\n[A1] RMSE log10(chl) theo TẬP CON (gộp lead 1..5, mask chung):");
  console.log("subset       | scale |  advRMSE  perRMSE | gain% |    n");
  const a1rows = [];
  for (const sub of subsets) {
    for (const scale of SCALES) {
      let sa = 0, sp = 0, n = 0;
      for (let k = 1; k <= MAX_LEAD; k++) {
        const A = acc[`${sub}|${scale}|${k}`];
        if (A) { sa += A.sa; sp += A.sp; n += A.n; }
      }
      const adv = n ? Math.sqrt(sa / n) : null, per = n ? Math.sqrt(sp / n) : null;
      const gain = adv != null && per ? (1 - adv / per) * 100 : null;
      a1rows.push({ sub, scale, adv: round(adv), per: round(per), gainPct: round(gain, 2), n });
      console.log(
        `${sub.padEnd(12)} | ${String(scale).padStart(5)} |  ${adv == null ? "  —  " : adv.toFixed(4)}  ${per == null ? "  —  " : per.toFixed(4)} | ${gain == null ? "  —  " : gain.toFixed(2).padStart(6)} | ${n}`,
      );
    }
  }

  // ── báo cáo A2: front placement corr theo subset & scale (lead 2 & 3) ────
  console.log("\n[A2] Tương quan |grad log-chl| (đặt front đúng chỗ) — PURE advection:");
  console.log("subset       | scale | frontCorr(gộp lead) — cao hơn = front đúng chỗ hơn");
  const a2rows = [];
  for (const sub of subsets) {
    const line = [];
    for (const scale of SCALES) {
      // gộp mọi lead cho front corr
      const G = initG();
      for (let k = 1; k <= MAX_LEAD; k++) {
        const g = gradAcc[`${sub}|${scale}|${k}`];
        if (g) { G.n += g.n; G.sp += g.sp; G.sa += g.sa; G.spp += g.spp; G.saa += g.saa; G.spa += g.spa; }
      }
      const c = finishG(G);
      a2rows.push({ sub, scale, frontCorr: round(c, 4) });
      line.push(`${scale}:${c == null ? "—" : c.toFixed(3)}`);
    }
    console.log(`${sub.padEnd(12)} | ${line.join("  ")}`);
  }

  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    window: { START, END, days: days.length },
    grid: { NLAT, NLON, step: STEP },
    pairs: pairs.length,
    a5_persistenceIdentity: { ok: identOk && identMaxDiff < 1e-12, maxDiff: identMaxDiff },
    a1_subsetRmse: a1rows,
    a2_frontPlacement: a2rows,
  }, null, 2) + "\n", "utf8");
  console.log(`\n✓ Ghi ${OUT}`);
}
main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
