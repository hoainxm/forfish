// scripts/fish-predict-viec3-calib.mjs  (chạy: npx tsx scripts/fish-predict-viec3-calib.mjs)
// ─────────────────────────────────────────────────────────────────────────
// VIỆC 3 — CALIBRATE trên LƯỚI THẬT: chọn SOFTOR_SCALE / AGG_FLOOR / FOOD_FLOOR
// / NEUTRAL_AGG cho công thức chấm điểm MỚI (soft-OR) so với công thức CŨ
// (trung bình cộng có trọng số).
//
// Kéo SST/chl/sla/anom/u,v (ERDDAP, không key) + độ sâu ETOPO (tĩnh) cho vài
// ngày gần nhất, tái dựng ĐÚNG lõi buildFishForecast (import helpers + data
// THẬT từ src/lib/fish-predict.ts) rồi:
//   - chấm điểm CŨ vs MỚI trên cùng dữ liệu,
//   - sweep bộ hằng, đo: median(s), đuôi trên, %diện tích s≥50, tương quan
//     chéo giữa bản đồ các loài, và số ô s≥50 của cá đáy/tôm/ghẹ (không biến mất).
//
// KHÔNG ghi vào src/. Chỉ in bảng để agent chốt hằng.
// Lưu ý: BỎ QUA tầng nhiệt HYCOM (thermo) trong calib — chỉ ~6 loài offshore có
// trọng số thermo và nó chỉ kích khi có HYCOM; không ảnh hưởng phân bố/tương quan
// tổng thể để chọn hằng. Cổng độ sâu ETOPO CÓ tính (ảnh hưởng offshore sát bờ).
// ─────────────────────────────────────────────────────────────────────────

import {
  SPECIES_PROFILES,
  SURFACE_CONF,
  trapezoid,
  chlFit,
  deepWaterFit,
  gradientStrength,
  frontStrength,
  convergenceStrength,
  logChlGrid,
  nearestIndex,
  parseErddapGrid,
  parseBathyGrid,
  softOrHabitat,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const REGION_REACH_DEG = 2.0;
const NEUTRAL_HABITAT_OLD = 0.45; // hằng công thức CŨ
const KEEP_MIN = 25; // ngưỡng giữ MỚI (client sàn 50)
const FETCH_TIMEOUT_MS = 45000;
const N_DAYS = 3;

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

async function fetchJson(url, label) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`non-JSON ${r.status}`); }
      if (!r.ok) { if (r.status === 400 || r.status === 404) return null; throw new Error(data?.reason || r.status); }
      return data;
    } catch (e) {
      if (attempt === 2) { console.warn(`  ! ${label}: ${String(e).slice(0, 80)}`); return null; }
      await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
    }
  }
}

// URL builders theo NGÀY (mirror src, chèn ngày thay (last))
const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T12:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

// ── tính ENV per cell 1 lần (đắt), rồi sweep chỉ áp công thức (rẻ) ──────────
// Trả về: danh sách sea cells, mỗi cell có, per loài đang-vụ: tFit, food,
// mechTerms([w,x]...), depthFit, conf, low. + meta loài.
function precompute(grids, month) {
  const { sst, chl, sla, anom, cur, depth } = grids;
  const thermFront = frontStrength(sst);
  const logChl = logChlGrid(chl);
  const chlFront = gradientStrength(logChl, 0.25);
  const eddyEdge = sla ? gradientStrength(sla.values, 0.08) : null;
  const convGrid = cur ? convergenceStrength(cur.u.values, cur.v.values, 0.1) : null;

  const cells = [];
  for (let i = 0; i < sst.lats.length; i++) {
    for (let j = 0; j < sst.lons.length; j++) {
      const t = sst.values[i][j];
      if (!Number.isFinite(t)) continue;
      const lat = sst.lats[i], lon = sst.lons[j];
      const region = nearestRegionWithin(lat, lon, REGION_REACH_DEG);
      if (!region) continue;
      const inSeason = FISH_SEASONS.filter(
        (f) => f.months.includes(month) && f.regions.includes(region.id),
      );
      if (inSeason.length === 0) continue;

      const ci = nearestIndex(chl.lats, lat), cj = nearestIndex(chl.lons, lon);
      const c = chl.values[ci]?.[cj];
      const fThermFront = thermFront[i][j];
      const fChlFront = chlFront[ci]?.[cj] ?? 0;
      let fEddy = 0, coldStrength = 0;
      if (sla && eddyEdge) {
        const si = nearestIndex(sla.lats, lat), sj = nearestIndex(sla.lons, lon);
        fEddy = eddyEdge[si]?.[sj] ?? 0;
        const slaV = sla.values[si]?.[sj];
        coldStrength = Number.isFinite(slaV) ? Math.min(1, Math.max(0, -slaV / 0.12)) : 0;
      }
      let upwTerm = null;
      if (anom) {
        const ai = nearestIndex(anom.lats, lat), aj = nearestIndex(anom.lons, lon);
        const a = anom.values[ai]?.[aj];
        if (Number.isFinite(a)) upwTerm = Math.min(1, Math.max(0, -a / 1.5));
      }
      let convTerm = null;
      if (cur && convGrid) {
        const ui = nearestIndex(cur.u.lats, lat), uj = nearestIndex(cur.u.lons, lon);
        const cv = convGrid[ui]?.[uj];
        if (cv != null && Number.isFinite(cur.u.values[ui]?.[uj])) convTerm = cv;
      }
      let cellDepthM = null;
      if (depth) {
        const dpi = nearestIndex(depth.lats, lat), dpj = nearestIndex(depth.lons, lon);
        const dv = depth.values[dpi]?.[dpj];
        if (Number.isFinite(dv)) cellDepthM = dv;
      }

      const species = [];
      for (const f of inSeason) {
        const p = SPECIES_PROFILES.find((x) => x.species === f.species);
        if (!p) continue;
        const tFit = trapezoid(t, p.sst[0], p.sst[1], p.sst[2], p.sst[3]);
        if (tFit === 0) continue;
        const food = chlFit(c, p.chlLog[0], p.chlLog[1]);
        const eddyTerm = sla ? (p.coldCore ? Math.max(fEddy, coldStrength) : fEddy) : null;
        const mech = [
          [p.w.thermFront, fThermFront],
          [p.w.chlFront, fChlFront],
        ];
        if (eddyTerm != null) mech.push([p.w.eddy, eddyTerm]);
        if (upwTerm != null) mech.push([p.w.upw, upwTerm]);
        if (convTerm != null) mech.push([p.w.conv, convTerm]);
        // (bỏ qua thermo trong calib)
        // terms CŨ (có food, không chuẩn hoá wMax)
        const oldTerms = [
          [p.w.food, food],
          [p.w.thermFront, fThermFront],
          [p.w.chlFront, fChlFront],
        ];
        if (eddyTerm != null) oldTerms.push([p.w.eddy, eddyTerm]);
        if (upwTerm != null) oldTerms.push([p.w.upw, upwTerm]);
        if (convTerm != null) oldTerms.push([p.w.conv, convTerm]);
        const depthFit = p.offshore && cellDepthM != null
          ? deepWaterFit(cellDepthM, p.offshore[0], p.offshore[1]) : 1;
        species.push({
          short: p.short, sig: p.surfaceSignal, low: p.surfaceSignal === "low",
          conf: SURFACE_CONF[p.surfaceSignal], tFit, food, mech, oldTerms, depthFit,
        });
      }
      if (species.length) cells.push({ species });
    }
  }
  return cells;
}

// điểm CŨ 1 loài
function scoreOld(sp) {
  let wSum = 0, acc = 0;
  for (const [w, v] of sp.oldTerms) { wSum += w; acc += w * v; }
  const habitat = wSum > 0 ? acc / wSum : 0;
  const habitatEff = sp.conf * habitat + (1 - sp.conf) * NEUTRAL_HABITAT_OLD;
  return sp.tFit * habitatEff * sp.depthFit;
}
// điểm MỚI 1 loài (parametrized)
function scoreNew(sp, P) {
  const foodLimiter = P.FOOD_FLOOR + (1 - P.FOOD_FLOOR) * sp.food;
  const agg = softOrHabitat(sp.mech, P.SOFTOR_SCALE);
  const aggEff = sp.conf * agg + (1 - sp.conf) * P.NEUTRAL_AGG;
  const habitat = P.AGG_FLOOR + (1 - P.AGG_FLOOR) * aggEff;
  return sp.tFit * foodLimiter * habitat * sp.depthFit;
}

// ── metrics cho 1 công thức trên tập cells (nhiều ngày gộp) ─────────────────
const TARGET_DEMERSAL = ["cá mối", "tôm bạc", "ghẹ xanh"];
function evalFormula(cellsPerDay, scorer) {
  const sList = []; // "Mọi loài" s trên MỌI sea cell (kể cả 0)
  let hot = 0, total = 0; // s≥50
  const demersalHot = Object.fromEntries(TARGET_DEMERSAL.map((k) => [k, 0])); // ≥50
  const demersalPay = Object.fromEntries(TARGET_DEMERSAL.map((k) => [k, 0])); // ≥25 (payload)
  // ngày 0: ma trận điểm per loài + mask hotspot (≥50) để đo TƯƠNG QUAN + CHỒNG LẤN
  const scoreMat = new Map(); // short -> number[]  (điểm liên tục)
  const hotMask = new Map(); // short -> boolean[] (≥50)
  for (let d = 0; d < cellsPerDay.length; d++) {
    const cells = cellsPerDay[d];
    if (d === 0) {
      const allShorts = new Set(cells.flatMap((c) => c.species.map((s) => s.short)));
      for (const s of allShorts) {
        scoreMat.set(s, new Array(cells.length).fill(0));
        hotMask.set(s, new Array(cells.length).fill(false));
      }
    }
    for (let ci = 0; ci < cells.length; ci++) {
      let bestLoc = 0;
      for (const sp of cells[ci].species) {
        const v = Math.round(Math.max(0, scorer(sp)) * 100);
        if (!sp.low && v > bestLoc) bestLoc = v;
        if (demersalHot[sp.short] != null) {
          if (v >= 50) demersalHot[sp.short]++;
          if (v >= KEEP_MIN) demersalPay[sp.short]++;
        }
        if (d === 0) {
          scoreMat.get(sp.short)[ci] = v;
          if (v >= 50) hotMask.get(sp.short)[ci] = true;
        }
      }
      total++;
      if (bestLoc >= 50) hot++;
      sList.push(bestLoc);
    }
  }
  sList.sort((a, b) => a - b);
  const q = (p) => sList[Math.min(sList.length - 1, Math.floor(p * sList.length))];
  // loài "định vị được" (không low) phủ đủ (≥40 ô điểm>0) — để so bản đồ
  const locs = [];
  for (const [short, arr] of scoreMat) {
    const prof = SPECIES_PROFILES.find((p) => p.short === short);
    if (!prof || prof.surfaceSignal === "low") continue;
    if (arr.filter((x) => x > 0).length >= 40) locs.push(short);
  }
  let corrSum = 0, corrN = 0, jacSum = 0, jacN = 0;
  for (let a = 0; a < locs.length; a++)
    for (let b = a + 1; b < locs.length; b++) {
      const r = pearson(scoreMat.get(locs[a]), scoreMat.get(locs[b]));
      if (r != null) { corrSum += r; corrN++; }
      // Jaccard chồng lấn hotspot (≥50): |A∩B|/|A∪B| — "40 map giống nhau?"
      const A = hotMask.get(locs[a]), B = hotMask.get(locs[b]);
      let inter = 0, uni = 0;
      for (let i = 0; i < A.length; i++) { if (A[i] || B[i]) uni++; if (A[i] && B[i]) inter++; }
      if (uni >= 10) { jacSum += inter / uni; jacN++; }
    }
  return {
    median: q(0.5), p90: q(0.9), p95: q(0.95), max: sList[sList.length - 1],
    hotPct: (100 * hot) / total, total,
    meanCorr: corrN ? corrSum / corrN : null,
    meanJac: jacN ? jacSum / jacN : null,
    nLoc: locs.length,
    demersalHot, demersalPay,
  };
}

function pearson(x, y) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = y[i];
    n++; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b;
  }
  if (n < 3) return null;
  const cov = sxy / n - (sx / n) * (sy / n);
  const vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : null;
}

async function loadDay(d) {
  const [sj, cj, slj, aj, uj, vj] = await Promise.all([
    fetchJson(sstUrl(d), `sst ${d}`),
    fetchJson(chlUrl(d), `chl ${d}`),
    fetchJson(slaUrl(d), `sla ${d}`),
    fetchJson(anomUrl(d), `anom ${d}`),
    fetchJson(curUrl(d, "u"), `u ${d}`),
    fetchJson(curUrl(d, "v"), `v ${d}`),
  ]);
  if (!sj?.table || !cj?.table) return null;
  const sst = parseErddapGrid(sj, { hasAltitude: false, kelvin: true });
  const chl = parseErddapGrid(cj, { hasAltitude: true });
  if (!sst.lats.length || !chl.lats.length) return null;
  const opt = (j) => { if (!j?.table) return null; const g = parseErddapGrid(j, { hasAltitude: false }); return g.lats.length ? g : null; };
  const sla = opt(slj), anom = opt(aj), u = opt(uj), v = opt(vj);
  const cur = u && v && u.lats.length === v.lats.length ? { u, v } : null;
  return { sst, chl, sla, anom, cur };
}

async function main() {
  console.log("VIỆC 3 calibrate — kéo lưới THẬT (ERDDAP + ETOPO)...");
  // ngày mới nhất của chl
  const probe = await fetchJson(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 2 * 86400000));
  const days = [];
  for (let k = N_DAYS - 1; k >= 0; k--) days.push(addDays(END, -k));
  console.log(`Ngày: ${days.join(", ")}`);

  // độ sâu ETOPO (tĩnh) 1 lần
  const bj = await fetchJson(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;
  console.log(`Độ sâu ETOPO: ${depth ? depth.lats.length + "×" + depth.lons.length : "KHÔNG có"}`);

  const month = new Date(END + "T00:00:00Z").getUTCMonth() + 1;
  const cellsPerDay = [];
  for (const d of days) {
    const g = await loadDay(d);
    if (!g) { console.warn(`  bỏ ngày ${d} (thiếu SST/chl)`); continue; }
    g.depth = depth;
    const cells = precompute(g, month);
    cellsPerDay.push(cells);
    console.log(`  ${d}: ${cells.length} sea cells, ` +
      `fields sla=${!!g.sla} anom=${!!g.anom} cur=${!!g.cur}`);
  }
  if (!cellsPerDay.length) { console.error("Không kéo được ngày nào."); process.exitCode = 1; return; }

  console.log(`\nTháng ${month}. Sea cells ngày 0 = ${cellsPerDay[0].length}\n`);

  // ── CŨ ────────────────────────────────────────────────────────────────────
  const old = evalFormula(cellsPerDay, scoreOld);
  printRow("CŨ (TB cộng)", old);

  // ── SWEEP MỚI ──────────────────────────────────────────────────────────────
  const grid = [];
  for (const SOFTOR_SCALE of [0.4])
    for (const AGG_FLOOR of [0.0, 0.12])
      for (const FOOD_FLOOR of [0.45])
        for (const NEUTRAL_AGG of [0.55, 0.6])
          grid.push({ SOFTOR_SCALE, AGG_FLOOR, FOOD_FLOOR, NEUTRAL_AGG });

  console.log(`\nSWEEP ${grid.length} bộ hằng — MỤC TIÊU: median 20–30, đuôi ~85+, %hot(s≥50) 10–20%,`);
  console.log(`  meanJac(chồng lấn hotspot) GIẢM rõ so CŨ, cá đáy/tôm/ghẹ còn ô ≥25 (payload)\n`);
  console.log(pad("scale", 6) + pad("aggF", 6) + pad("foodF", 6) + pad("neutA", 6) +
    pad("med", 5) + pad("p90", 5) + pad("p95", 5) + pad("max", 5) +
    pad("hot%", 7) + pad("corr", 6) + pad("jac", 6) + " demHot(mối/bạc/ghẹ) demPay");
  const scored = [];
  for (const P of grid) {
    const m = evalFormula(cellsPerDay, (sp) => scoreNew(sp, P));
    scored.push({ P, m });
    printSweep(P, m);
  }

  console.log(`\n── ỨNG VIÊN (median 20–34, hot 10–20%, jac≤CŨ) ──`);
  const ok = scored.filter(({ m }) =>
    m.median >= 20 && m.median <= 34 && m.hotPct >= 10 && m.hotPct <= 20 &&
    (m.meanJac == null || old.meanJac == null || m.meanJac <= old.meanJac + 0.005));
  if (!ok.length) console.log("  (không bộ nào đạt hết)");
  ok.sort((a, b) => Math.abs(a.m.median - 27) - Math.abs(b.m.median - 27));
  for (const { P, m } of ok.slice(0, 10)) printSweep(P, m);

  // ── CHỐT + kiểm tra tháng ĐÔNG (cá mối/tôm bạc trong vụ) ───────────────────
  const CHOSEN = { SOFTOR_SCALE: 0.4, AGG_FLOOR: 0.0, FOOD_FLOOR: 0.45, NEUTRAL_AGG: 0.6 };
  console.log(`\n── CHỐT ${JSON.stringify(CHOSEN)} ──`);
  printRow("MỚI(chốt) tháng " + month, evalFormula(cellsPerDay, (sp) => scoreNew(sp, CHOSEN)));

  // tháng đông: kéo 1 ngày quá khứ để cá mối/tôm bạc vào vụ → xác nhận KHÔNG biến mất
  const WINTER = "2026-01-15";
  const gW = await loadDay(WINTER);
  if (gW) {
    gW.depth = depth;
    const cw = [precompute(gW, 1)];
    console.log(`\nĐÔNG ${WINTER} (tháng 1): ${cw[0].length} sea cells`);
    printRow("CŨ  tháng 1", evalFormula(cw, scoreOld));
    printRow("MỚI tháng 1", evalFormula(cw, (sp) => scoreNew(sp, CHOSEN)));
  } else {
    console.log(`\n(không kéo được ${WINTER} để kiểm cá đáy mùa đông)`);
  }
}

const pad = (s, n) => String(s).padEnd(n);
const f2 = (x) => (x == null ? "  — " : x.toFixed(2));
function printRow(label, m) {
  console.log(`${label}: median=${m.median} p90=${m.p90} p95=${m.p95} max=${m.max} ` +
    `hot%=${m.hotPct.toFixed(1)} meanCorr=${f2(m.meanCorr)} meanJac=${f2(m.meanJac)} ` +
    `(nLoc=${m.nLoc}) demHot=${JSON.stringify(m.demersalHot)} demPay=${JSON.stringify(m.demersalPay)}`);
}
function printSweep(P, m) {
  console.log(
    pad(P.SOFTOR_SCALE, 6) + pad(P.AGG_FLOOR, 6) + pad(P.FOOD_FLOOR, 6) + pad(P.NEUTRAL_AGG, 6) +
    pad(m.median, 5) + pad(m.p90, 5) + pad(m.p95, 5) + pad(m.max, 5) +
    pad(m.hotPct.toFixed(1), 7) + pad(f2(m.meanCorr), 6) + pad(f2(m.meanJac), 6) +
    ` ${m.demersalHot["cá mối"]}/${m.demersalHot["tôm bạc"]}/${m.demersalHot["ghẹ xanh"]}` +
    `   ${m.demersalPay["cá mối"]}/${m.demersalPay["tôm bạc"]}/${m.demersalPay["ghẹ xanh"]}`);
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
