// scripts/fish-predict-viec2-spatial.mjs  (chạy: npx tsx scripts/fish-predict-viec2-spatial.mjs)
// ─────────────────────────────────────────────────────────────────────────
// VIỆC 2 — CALIBRATE + KIỂM CHỨNG dị thường KHÔNG GIAN trên LƯỚI THẬT.
//
// VẤN ĐỀ: upwTerm (anomaly nhiệt nhiều năm) và coldStrength (SSHA thô) so nước
// với NHIỀU NĂM / CẢ BỒN → sáng-tối ĐỒNG LOẠT toàn miền theo mùa, KHÔNG xếp
// hạng được ô nào hơn ô nào (chỉ là núm chỉnh độ sáng). Việc 2: thay bằng dị
// thường KHÔNG GIAN (mỗi ô trừ TRUNG VỊ lân cận trong SPATIAL_RADIUS_DEG).
//
// KHÔNG ghi src. In:
//   1) PHÉP KIỂM 1 DÒNG — std GIỮA-NGÀY của TRUNG BÌNH KHÔNG GIAN sla & anom
//      (≳0.05 ⇒ MÙA cả-bồn ⇒ fix đáng làm; <0.02 ⇒ có thể không cần, vẫn vô hại).
//   2) std KHÔNG GIAN (giữa các ô 1 ngày) của upwTerm/coldStrength TRƯỚC (cả-bồn)
//      vs SAU (không gian) — SAU phải TĂNG rõ để yếu tố "chỉ vào chỗ cụ thể".
//   3) p90(|dị thường không gian|) POOL nhiều ngày → gợi ý UPW_SCALE / COLD_SCALE.
//   4) buildFishForecast CŨ (cả-bồn) vs MỚI (không gian): %diện tích điểm nóng
//      + phân bố s (không PHÌNH vùng đỏ; lý tưởng chỉ dịch chỗ).
//   5) thời gian spatialAnomaly (ràng buộc route 60s).
// ─────────────────────────────────────────────────────────────────────────

import {
  spatialAnomaly,
  parseErddapGrid,
  parseBathyGrid,
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
  softOrHabitat,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const FETCH_TIMEOUT_MS = 45000;
const N_DAYS = 30;
const SPATIAL_RADIUS_DEG = 2.5;
const REGION_REACH_DEG = 2.0;
// hằng CŨ (cả-bồn) để tính TRƯỚC:
const OLD_UPW = 1.5, OLD_COLD = 0.12;
// hằng chấm điểm (MIRROR src — KHÔNG export; giữ đồng bộ tay):
const SOFTOR_SCALE = 0.4, AGG_FLOOR = 0.0, NEUTRAL_AGG = 0.6, FOOD_FLOOR = 0.45, KEEP_MIN = 25;

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => { const d = new Date(isoStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

async function fetchJson(url, label) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": UA } });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error(`non-JSON ${r.status}`); }
      if (!r.ok) { if (r.status === 400 || r.status === 404) return null; throw new Error(data?.reason || r.status); }
      return data;
    } catch (e) {
      if (attempt === 2) { console.warn(`  ! ${label}: ${String(e).slice(0, 80)}`); return null; }
      await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
    }
  }
}

const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T12:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

const opt = (j) => { if (!j?.table) return null; const g = parseErddapGrid(j, { hasAltitude: false }); return g.lats.length ? g : null; };
async function loadDay(d) {
  const [sj, cj, slj, aj, uj, vj] = await Promise.all([
    fetchJson(sstUrl(d), `sst ${d}`), fetchJson(chlUrl(d), `chl ${d}`), fetchJson(slaUrl(d), `sla ${d}`),
    fetchJson(anomUrl(d), `anom ${d}`), fetchJson(curUrl(d, "u"), `u ${d}`), fetchJson(curUrl(d, "v"), `v ${d}`),
  ]);
  const sst = sj?.table ? parseErddapGrid(sj, { hasAltitude: false, kelvin: true }) : null;
  const chl = cj?.table ? parseErddapGrid(cj, { hasAltitude: true }) : null;
  const sla = opt(slj), anom = opt(aj), u = opt(uj), v = opt(vj);
  const cur = u && v && u.lats.length === v.lats.length ? { u, v } : null;
  return { sst, chl, sla, anom, cur };
}

// ── thống kê thuần ──────────────────────────────────────────────────────────
const finite = (m) => { const o = []; for (const r of m) for (const v of r) if (Number.isFinite(v)) o.push(v); return o; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const std = (a) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
const quant = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// std KHÔNG GIAN của term = clamp(-val/scale) trên MỌI ô hữu hạn (pool 1+ ngày)
function termStats(vals, scale) {
  const t = [];
  for (const v of vals) if (Number.isFinite(v)) t.push(clamp01(-v / scale));
  return { std: std(t), meanT: mean(t) };
}

// ── chấm điểm 1 loài tại 1 ô (MIRROR src) — mode "old"|"new" chỉ khác nguồn ──
// upwTerm/coldStrength. Trả về s "Mọi loài" (loài định vị được, không low).
function scoreCellAllSpecies(env) {
  let best = 0;
  for (const sp of env.species) {
    const p = sp.p;
    const tFit = trapezoid(env.t, p.sst[0], p.sst[1], p.sst[2], p.sst[3]);
    if (tFit === 0) continue;
    const food = chlFit(env.c, p.chlLog[0], p.chlLog[1]);
    const foodLimiter = FOOD_FLOOR + (1 - FOOD_FLOOR) * food;
    const eddyTerm = env.hasSla ? (p.coldCore ? Math.max(env.fEddy, env.coldStrength) : env.fEddy) : null;
    const mech = [[p.w.thermFront, env.fThermFront], [p.w.chlFront, env.fChlFront]];
    if (eddyTerm != null) mech.push([p.w.eddy, eddyTerm]);
    if (env.upwTerm != null) mech.push([p.w.upw, env.upwTerm]);
    if (env.convTerm != null) mech.push([p.w.conv, env.convTerm]);
    const agg = softOrHabitat(mech, SOFTOR_SCALE);
    const conf = SURFACE_CONF[p.surfaceSignal];
    const aggEff = conf * agg + (1 - conf) * NEUTRAL_AGG;
    const habitat = AGG_FLOOR + (1 - AGG_FLOOR) * aggEff;
    const depthFit = p.offshore && env.cellDepthM != null ? deepWaterFit(env.cellDepthM, p.offshore[0], p.offshore[1]) : 1;
    const fit = tFit * foodLimiter * habitat * depthFit;
    if (p.surfaceSignal !== "low") { const v = Math.round(fit * 100); if (v > best) best = v; }
  }
  return best;
}

// build map "Mọi loài" s cho toàn lưới, mode CŨ hay MỚI
function buildMapS(g, depth, month, mode) {
  const { sst, chl, sla, anom, cur } = g;
  const thermFront = frontStrength(sst);
  const chlFront = gradientStrength(logChlGrid(chl), 0.25);
  const eddyEdge = sla ? gradientStrength(sla.values, 0.08) : null;
  const convGrid = cur ? convergenceStrength(cur.u.values, cur.v.values, 0.1) : null;
  const slaSp = sla && mode === "new" ? spatialAnomaly(sla.values, sla.lats, sla.lons, SPATIAL_RADIUS_DEG) : null;
  const anomSp = anom && mode === "new" ? spatialAnomaly(anom.values, anom.lats, anom.lons, SPATIAL_RADIUS_DEG) : null;
  const sList = [];
  for (let i = 0; i < sst.lats.length; i++) for (let j = 0; j < sst.lons.length; j++) {
    const t = sst.values[i][j];
    if (!Number.isFinite(t)) continue;
    const lat = sst.lats[i], lon = sst.lons[j];
    const region = nearestRegionWithin(lat, lon, REGION_REACH_DEG);
    if (!region) continue;
    const inSeason = FISH_SEASONS.filter((f) => f.months.includes(month) && f.regions.includes(region.id));
    if (inSeason.length === 0) continue;
    const ci = nearestIndex(chl.lats, lat), cj = nearestIndex(chl.lons, lon);
    const c = chl.values[ci]?.[cj];
    let fEddy = 0, coldStrength = 0;
    if (sla && eddyEdge) {
      const si = nearestIndex(sla.lats, lat), sj = nearestIndex(sla.lons, lon);
      fEddy = eddyEdge[si]?.[sj] ?? 0;
      const raw = sla.values[si]?.[sj];
      const sv = mode === "new" ? slaSp[si]?.[sj] : raw;
      coldStrength = Number.isFinite(sv) ? clamp01(-sv / (mode === "new" ? COLD_SCALE : OLD_COLD)) : 0;
    }
    let upwTerm = null;
    if (anom) {
      const ai = nearestIndex(anom.lats, lat), aj = nearestIndex(anom.lons, lon);
      const av = mode === "new" ? anomSp[ai]?.[aj] : anom.values[ai]?.[aj];
      if (Number.isFinite(av)) upwTerm = clamp01(-av / (mode === "new" ? UPW_SCALE : OLD_UPW));
    }
    let convTerm = null;
    if (cur && convGrid) {
      const ui = nearestIndex(cur.u.lats, lat), uj = nearestIndex(cur.u.lons, lon);
      const cv = convGrid[ui]?.[uj];
      if (cv != null && Number.isFinite(cur.u.values[ui]?.[uj])) convTerm = cv;
    }
    let cellDepthM = null;
    if (depth) { const di = nearestIndex(depth.lats, lat), dj = nearestIndex(depth.lons, lon); const dv = depth.values[di]?.[dj]; if (Number.isFinite(dv)) cellDepthM = dv; }
    const species = inSeason.map((f) => SPECIES_PROFILES.find((x) => x.species === f.species)).filter(Boolean).map((p) => ({ p }));
    const s = scoreCellAllSpecies({ t, c, fThermFront: thermFront[i][j], fChlFront: chlFront[ci]?.[cj] ?? 0, fEddy, coldStrength, upwTerm, convTerm, cellDepthM, hasSla: !!sla, species });
    if (s >= KEEP_MIN) sList.push(s);
  }
  const hot = sList.filter((x) => x >= 50).length;
  return { nCells: sList.length, hotPct: sList.length ? (100 * hot) / sList.length : 0, median: quant(sList, 0.5), p90: quant(sList, 0.9) };
}

// hằng MỚI (src hiện tại; script (4) tự sweep để kiểm phình)
let UPW_SCALE = 0.55, COLD_SCALE = 0.09;

async function main() {
  console.log("VIỆC 2 — kéo lưới THẬT (ERDDAP + ETOPO)…");
  const probe = await fetchJson(enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(last)][(13.0)][(111.0)]`), "probe");
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 3 * 86400000));
  const days = []; for (let k = N_DAYS - 1; k >= 0; k--) days.push(addDays(END, -k));
  console.log(`Cửa sổ ${N_DAYS} ngày, mới nhất ${END}`);
  const bj = await fetchJson(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;

  const grids = [];
  const slaFieldMean = [], anomFieldMean = [];
  for (const d of days) {
    const g = await loadDay(d);
    if (g.sla) slaFieldMean.push(mean(finite(g.sla.values)));
    if (g.anom) anomFieldMean.push(mean(finite(g.anom.values)));
    if (g.sst && g.chl) grids.push({ d, g });
  }
  console.log(`Nạp ${grids.length}/${days.length} ngày đủ sst+chl.`);

  // ── (1) PHÉP KIỂM 1 DÒNG ─────────────────────────────────────────────────
  const slaSeasonStd = std(slaFieldMean), anomSeasonStd = std(anomFieldMean);
  console.log("\n── (1) PHÉP KIỂM 1 DÒNG — std GIỮA-NGÀY của TRUNG BÌNH KHÔNG GIAN ──");
  console.log(`  sla  : std giữa-ngày = ${slaSeasonStd.toFixed(4)} m   (n=${slaFieldMean.length}); |mean| ngày ~ ${Math.abs(mean(slaFieldMean)).toFixed(3)} m`);
  console.log(`  anom : std giữa-ngày = ${anomSeasonStd.toFixed(4)} °C  (n=${anomFieldMean.length}); mean ngày ~ ${mean(anomFieldMean).toFixed(3)} °C`);
  console.log(`  → sla ${slaSeasonStd >= 0.05 ? "≳0.05 ⇒ MÙA cả-bồn RÕ (fix 2b đáng làm)" : slaSeasonStd < 0.02 ? "<0.02 ⇒ mùa cả-bồn YẾU trong cửa sổ này (fix 2b có thể KHÔNG cần; vẫn vô hại)" : "0.02–0.05 ⇒ mùa vừa phải"}`);
  console.log(`  (lưu ý: mean anomaly ngày lệch 0 nhiều = nền cả-bồn ÂM/DƯƠNG dịch upwTerm ĐỒNG LOẠT — xem (2))`);

  // ── (3) POOL |dị thường không gian| nhiều ngày → scale ────────────────────
  const anomAbsPool = [], slaAbsPool = [];
  let spatialMsSum = 0, spatialN = 0;
  for (const { g } of grids) {
    if (g.anom) { const t0 = performance.now(); const a = spatialAnomaly(g.anom.values, g.anom.lats, g.anom.lons, SPATIAL_RADIUS_DEG); spatialMsSum += performance.now() - t0; spatialN++; for (const v of finite(a)) anomAbsPool.push(Math.abs(v)); }
    if (g.sla) { const s = spatialAnomaly(g.sla.values, g.sla.lats, g.sla.lons, SPATIAL_RADIUS_DEG); for (const v of finite(s)) slaAbsPool.push(Math.abs(v)); }
  }
  const anomP90 = quant(anomAbsPool, 0.9), slaP90 = quant(slaAbsPool, 0.9);
  console.log("\n── (3) p90(|dị thường KHÔNG GIAN|) POOL nhiều ngày → SCALE ──");
  console.log(`  anom: p90=${anomP90.toFixed(3)} °C  p95=${quant(anomAbsPool, 0.95).toFixed(3)}  → UPW_SCALE ≈ ${anomP90.toFixed(2)}`);
  console.log(`  sla : p90=${slaP90.toFixed(3)} m   p95=${quant(slaAbsPool, 0.95).toFixed(3)}  → COLD_SCALE ≈ ${slaP90.toFixed(3)}`);
  console.log(`  (src hiện đặt UPW_SCALE=${UPW_SCALE}, COLD_SCALE=${COLD_SCALE})`);

  // ── (5) thời gian ─────────────────────────────────────────────────────────
  console.log(`\n── (5) THỜI GIAN spatialAnomaly / ngày (anom+sla) ≈ ${spatialN ? (spatialMsSum / spatialN).toFixed(1) : "—"} ms (route 60s: OK) ──`);

  // ── (2) std KHÔNG GIAN của term TRƯỚC→SAU (pool tất cả ngày) ───────────────
  const upwBeforeVals = [], upwAfterVals = [], coldBeforeVals = [], coldAfterVals = [];
  for (const { g } of grids) {
    if (g.anom) { for (const v of finite(g.anom.values)) upwBeforeVals.push(v); const a = spatialAnomaly(g.anom.values, g.anom.lats, g.anom.lons, SPATIAL_RADIUS_DEG); for (const v of finite(a)) upwAfterVals.push(v); }
    if (g.sla) { for (const v of finite(g.sla.values)) coldBeforeVals.push(v); const s = spatialAnomaly(g.sla.values, g.sla.lats, g.sla.lons, SPATIAL_RADIUS_DEG); for (const v of finite(s)) coldAfterVals.push(v); }
  }
  const ub = termStats(upwBeforeVals, OLD_UPW), ua = termStats(upwAfterVals, anomP90 || OLD_UPW);
  const cb = termStats(coldBeforeVals, OLD_COLD), ca = termStats(coldAfterVals, slaP90 || OLD_COLD);
  console.log("\n── (2) std KHÔNG GIAN của yếu tố (pool ô mọi ngày) TRƯỚC(cả-bồn)→SAU(không gian) ──");
  console.log(`  upwTerm : std ${ub.std.toFixed(4)} (mean ${ub.meanT.toFixed(3)}) → ${ua.std.toFixed(4)} (mean ${ua.meanT.toFixed(3)})  ${ua.std > ub.std ? "TĂNG ✓" : "✗"}`);
  console.log(`  coldStr : std ${cb.std.toFixed(4)} (mean ${cb.meanT.toFixed(3)}) → ${ca.std.toFixed(4)} (mean ${ca.meanT.toFixed(3)})  ${ca.std > cb.std ? "TĂNG ✓" : "~/giảm (mùa sla yếu → raw đã cục bộ)"}`);

  // ── (4) buildFishForecast CŨ (cả-bồn) vs MỚI (không gian) — SWEEP scale ────
  const month = new Date(grids[0].d + "T00:00:00Z").getUTCMonth() + 1;
  const sample = grids.slice(0, 5); // 5 ngày đại diện (đủ ổn định)
  const avg = (arr, sel) => mean(arr.map(sel));
  // CŨ 1 lần (không đổi theo scale)
  const oldRows = sample.map(({ d, g }) => ({ d, o: buildMapS(g, depth, month, "old") }));
  const oldHot = avg(oldRows, (r) => r.o.hotPct);
  console.log(`\n── (4) %diện tích điểm nóng (s≥50): CŨ(cả-bồn) hot%=${oldHot.toFixed(1)} — SWEEP scale MỚI ──`);
  console.log("  (mục tiêu: Δhot ≤ ~2 = không phình; đồng thời upwTerm còn trải rộng)");
  const combos = [];
  for (const U of [anomP90, 0.55, 0.7]) for (const C of [slaP90, 0.12, 0.15]) combos.push([U, C]);
  let bestCombo = null;
  for (const [U, C] of combos) {
    UPW_SCALE = Math.round(U * 1000) / 1000; COLD_SCALE = Math.round(C * 1000) / 1000;
    const newRows = sample.map(({ g }) => buildMapS(g, depth, month, "new"));
    const nHot = avg(newRows.map((n) => ({ n })), (r) => r.n.hotPct);
    const upwMean = termStats(upwAfterVals, UPW_SCALE).meanT, upwStd = termStats(upwAfterVals, UPW_SCALE).std;
    const d = nHot - oldHot;
    console.log(`  UPW=${UPW_SCALE} COLD=${COLD_SCALE}: MỚI hot%=${nHot.toFixed(1)} (Δ=${d >= 0 ? "+" : ""}${d.toFixed(1)}) upwTerm mean=${upwMean.toFixed(3)} std=${upwStd.toFixed(3)} ${d <= 2 ? "✓" : ""}`);
    if (d <= 2 && (!bestCombo || upwStd > bestCombo.upwStd)) bestCombo = { U: UPW_SCALE, C: COLD_SCALE, d, upwStd };
  }
  console.log(bestCombo
    ? `\n  → CHỐT: UPW_SCALE=${bestCombo.U}, COLD_SCALE=${bestCombo.C} (Δhot=${bestCombo.d >= 0 ? "+" : ""}${bestCombo.d.toFixed(1)}, upwTerm std=${bestCombo.upwStd.toFixed(3)})`
    : "\n  → không combo nào Δhot≤2; xét nới scale thêm");

  console.log("\nXong.");
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
