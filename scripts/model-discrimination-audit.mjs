// scripts/model-discrimination-audit.mjs   (chạy: npx tsx scripts/model-discrimination-audit.mjs)
// ─────────────────────────────────────────────────────────────────────────
// TÌM "thermoFit TIẾP THEO" — thành phần nào trong công thức chấm cá KHÔNG
// PHÂN BIỆT ĐƯỢC ô nào hơn ô nào (bão hoà / gần như hằng số / trùng lặp / nhiễu),
// tức CHIẾM CHỖ mà không đóng góp thông tin. CHỈ ĐỌC + ĐO, KHÔNG sửa src/.
//
// Tiền lệ: scripts/thermofit-diagnose.mjs (thermoFit std KHÔNG GIAN 0.028 ⇒ chết).
// Script này TỔNG QUÁT hoá phép đo đó cho MỌI thành phần:
//
//   §A CỔNG (nhân)      tFit theo TỪNG loài · foodLimiter · depthFit
//   §B CƠ CHẾ (soft-OR) thermFront · chlFront · eddy · coldStr · upw · conv · thermo
//                        + MA TRẬN TƯƠNG QUAN CHÉO (2 term r>0.8 = nói cùng 1 chuyện)
//   §C PHÂN RÃ PHƯƠNG SAI  fit = tFit×food×habitat×depth ⇒ chia Var(log fit)
//                        cho từng thừa số (cộng lại = 100%) — ai thật sự xếp hạng ô
//   §D ABLATION           bỏ TỪNG term (không chỉ từng NGUỒN) trên bộ chấm GƯƠNG
//                        (đã verify TRÙNG KHỚP buildFishForecast) → Δ%điểm nóng,
//                        tương quan bản đồ, Jaccard điểm nóng
//   §E EDDY / SSHA        lưới SSHA 0,5° THÔ GẤP ĐÔI lưới cá: đo tự tương quan
//                        không gian, %ô TRÙNG giá trị (nhân bản khối), sai vị trí
//                        (km), nearest vs bilinear, và so với xoáy đo từ dòng
//                        Copernicus 1/12° (|xoáy tương đối| / Okubo-Weiss)
//
// DỮ LIỆU: dùng lại CACHE của scripts/fish-predict-wmax-calib.mjs
// (FISH_CALIB_CACHE hoặc %TMP%/sdfish-wmax-calib) — 3 ngày tháng 7 + 1 ngày
// tháng 1 + ETOPO + HYCOM; dòng chảy lấy Copernicus (CONV_CALIB_CACHE hoặc
// %TMP%/sdfish-conv-calib) đúng như runtime.
// ─────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  nearestIndex,
  gridStepDeg,
  gradientStrength,
  frontStrength,
  logChlGrid,
  convergenceStrength,
  spatialAnomaly,
  trapezoid,
  chlFit,
  thermoFit,
  deepWaterFit,
  softOrHabitat,
  speciesWMax,
  SPECIES_PROFILES,
  SURFACE_CONF,
  DEPTH_UNKNOWN_FIT,
  CONV_FULL_PER_DEG,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";
import { fetchCopernicusCurrents } from "../src/lib/copernicus.ts";
import { fetchHycomGrids } from "../src/lib/hycom.ts";

/* ── hằng PHẢI KHỚP src/lib/fish-predict.ts (không export) — bộ chấm GƯƠNG
      được verify trùng khớp buildFishForecast nên lệch hằng sẽ LỘ ngay ── */
const SOFTOR_SCALE = 0.4;
const AGG_FLOOR = 0.0;
const NEUTRAL_AGG = 0.6;
const FOOD_FLOOR = 0.45;
const KEEP_MIN = 25;
const SHOW_MIN = 50;
const SPATIAL_RADIUS_DEG = 2.5;
const UPW_SCALE = 0.55;
const COLD_SCALE = 0.09;
const REGION_REACH_DEG = 2.0;

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const FETCH_TIMEOUT_MS = 60000;
const N_DAYS_SUMMER = 3;
const WINTER_DAY = "2026-01-15";

const CACHE =
  process.env.FISH_CALIB_CACHE || path.join(os.tmpdir(), "sdfish-wmax-calib");
const CONV_CACHE =
  process.env.CONV_CALIB_CACHE || path.join(os.tmpdir(), "sdfish-conv-calib");
fs.mkdirSync(CACHE, { recursive: true });

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
function std(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
}
function pctl(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  const xs = [], ys = [];
  for (let i = 0; i < n; i++)
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) { xs.push(a[i]); ys.push(b[i]); }
  if (xs.length < 3) return NaN;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

/* ---------------------------------------------------------------- nạp lưới */
async function fetchJsonCached(url, key, dir = CACHE) {
  const file = path.join(dir, key.replace(/[^\w.-]/g, "_") + ".json");
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  let data = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch { throw new Error(`non-JSON ${r.status}`); }
      if (!r.ok) { if (r.status === 400 || r.status === 404) { data = null; break; } throw new Error(j?.reason || r.status); }
      data = j; break;
    } catch (e) {
      if (attempt === 2) { console.warn(`  ! ${key}: ${String(e).slice(0, 90)}`); data = null; }
      else await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);

async function loadDay(d) {
  const [sj, cj, slj, aj] = await Promise.all([
    fetchJsonCached(sstUrl(d), `sst-${d}`),
    fetchJsonCached(chlUrl(d), `chl-${d}`),
    fetchJsonCached(slaUrl(d), `sla-${d}`),
    fetchJsonCached(anomUrl(d), `anom-${d}`),
  ]);
  if (!sj?.table || !cj?.table) return null;
  const sst = parseErddapGrid(sj, { hasAltitude: false, kelvin: true });
  const chl = parseErddapGrid(cj, { hasAltitude: true });
  if (!sst.lats.length || !chl.lats.length) return null;
  const opt = (j) => {
    if (!j?.table) return null;
    const g = parseErddapGrid(j, { hasAltitude: false });
    return g.lats.length ? g : null;
  };
  return { sst, chl, sla: opt(slj), anom: opt(aj) };
}

async function loadHycom() {
  const file = path.join(CACHE, "hycom.json");
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  const g = await fetchHycomGrids();
  fs.writeFileSync(file, JSON.stringify(g ?? null));
  return g;
}

/** Dòng chảy Copernicus (ĐÚNG nguồn runtime) — ưu tiên cache của conv-calib */
async function loadCurrents() {
  for (const f of ["cop-timeChunked-utotal.json", "cop-undefined-utotal.json"]) {
    const p = path.join(CONV_CACHE, f);
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j?.u?.lats?.length && j?.v?.lats?.length) return { u: j.u, v: j.v };
    }
  }
  const p = path.join(CACHE, "copernicus.json");
  if (fs.existsSync(p)) {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j ? { u: j.u, v: j.v } : null;
  }
  const c = await fetchCopernicusCurrents();
  fs.writeFileSync(p, JSON.stringify(c ?? null));
  return c ? { u: c.u, v: c.v } : null;
}

/* ------------------------------------------------- ô biển + trường mỗi ô */
function seaCells(sst, month) {
  const out = [];
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      const inSeason = FISH_SEASONS.filter(
        (f) => f.months.includes(month) && f.regions.includes(region.id),
      );
      if (inSeason.length) out.push({ i, j, lat: sst.lats[i], lon: sst.lons[j], region: region.id, inSeason });
    }
  return out;
}

/** Nội suy song tuyến trên lưới (trục tăng dần); ngoài lưới → kẹp về biên */
function bilinear(values, lats, lons, lat, lon) {
  const gi = idxLow(lats, lat), gj = idxLow(lons, lon);
  const i0 = Math.max(0, Math.min(lats.length - 2, gi));
  const j0 = Math.max(0, Math.min(lons.length - 2, gj));
  const ty = (lat - lats[i0]) / (lats[i0 + 1] - lats[i0]);
  const tx = (lon - lons[j0]) / (lons[j0 + 1] - lons[j0]);
  const cy = Math.max(0, Math.min(1, ty)), cx = Math.max(0, Math.min(1, tx));
  const v = [values[i0]?.[j0], values[i0]?.[j0 + 1], values[i0 + 1]?.[j0], values[i0 + 1]?.[j0 + 1]];
  const w = [(1 - cy) * (1 - cx), (1 - cy) * cx, cy * (1 - cx), cy * cx];
  let s = 0, sw = 0;
  for (let k = 0; k < 4; k++) if (Number.isFinite(v[k])) { s += w[k] * v[k]; sw += w[k]; }
  return sw > 0 ? s / sw : NaN;
}
function idxLow(arr, v) {
  let k = 0;
  while (k + 1 < arr.length && arr[k + 1] <= v) k++;
  return k;
}

/**
 * Tính MỌI trường trung gian cho từng ô biển — mirror y hệt vòng lặp
 * buildFishForecast (verify bằng `verifyMirror`).
 */
function computeFields(g, hy, depth, cur, month) {
  const cells = seaCells(g.sst, month);
  const thermFront = frontStrength(g.sst);
  const chlFrontG = gradientStrength(logChlGrid(g.chl), 0.25);
  const eddyEdge = g.sla ? gradientStrength(g.sla.values, 0.08) : null;
  const slaSpatial = g.sla ? spatialAnomaly(g.sla.values, g.sla.lats, g.sla.lons, SPATIAL_RADIUS_DEG) : null;
  const anomSpatial = g.anom ? spatialAnomaly(g.anom.values, g.anom.lats, g.anom.lons, SPATIAL_RADIUS_DEG) : null;
  const thermoSpatial = hy?.d20 ? spatialAnomaly(hy.d20.values, hy.d20.lats, hy.d20.lons, SPATIAL_RADIUS_DEG) : null;
  const convGrid = cur
    ? convergenceStrength(cur.u.values, cur.v.values, CONV_FULL_PER_DEG * gridStepDeg(cur.u.lats))
    : null;

  for (const c of cells) {
    c.t = g.sst.values[c.i][c.j];
    const ci = nearestIndex(g.chl.lats, c.lat), cj = nearestIndex(g.chl.lons, c.lon);
    c.chl = g.chl.values[ci]?.[cj];
    c.thermFront = thermFront[c.i][c.j];
    c.chlFront = chlFrontG[ci]?.[cj] ?? 0;
    c.eddy = 0; c.coldStr = 0; c.eddyBilin = 0;
    if (g.sla && eddyEdge) {
      const si = nearestIndex(g.sla.lats, c.lat), sj = nearestIndex(g.sla.lons, c.lon);
      c.si = si; c.sj = sj;
      c.eddy = eddyEdge[si]?.[sj] ?? 0;
      c.eddyBilin = bilinear(eddyEdge, g.sla.lats, g.sla.lons, c.lat, c.lon);
      const sv = slaSpatial?.[si]?.[sj];
      c.coldStr = Number.isFinite(sv) ? Math.min(1, Math.max(0, -sv / COLD_SCALE)) : 0;
    }
    c.upw = null;
    if (g.anom) {
      const ai = nearestIndex(g.anom.lats, c.lat), aj = nearestIndex(g.anom.lons, c.lon);
      const a = anomSpatial?.[ai]?.[aj];
      if (Number.isFinite(a)) c.upw = Math.min(1, Math.max(0, -a / UPW_SCALE));
    }
    c.conv = null; c.convBlock = null;
    if (cur && convGrid) {
      const ui = nearestIndex(cur.u.lats, c.lat), uj = nearestIndex(cur.u.lons, c.lon);
      const cv = convGrid[ui]?.[uj];
      if (cv != null && Number.isFinite(cur.u.values[ui]?.[uj])) c.conv = cv;
      // TRUNG BÌNH KHỐI: gộp mọi ô nguồn nằm trong ô cá 0,25° (chống răng cưa
      // khi lưới nguồn 1/12° MỊN HƠN lưới cá — nearestIndex chỉ lấy 1 trong 9 ô)
      const half = 0.125, acc = [];
      for (let a = ui - 3; a <= ui + 3; a++) {
        if (a < 0 || a >= cur.u.lats.length) continue;
        if (Math.abs(cur.u.lats[a] - c.lat) > half) continue;
        for (let b = uj - 3; b <= uj + 3; b++) {
          if (b < 0 || b >= cur.u.lons.length) continue;
          if (Math.abs(cur.u.lons[b] - c.lon) > half) continue;
          const v = convGrid[a]?.[b];
          if (Number.isFinite(v) && Number.isFinite(cur.u.values[a]?.[b])) acc.push(v);
        }
      }
      if (acc.length) c.convBlock = mean(acc);
      // tốc độ dòng (m/s) — tương đương vật lý của |∇SSHA| (địa chuyển)
      const su = cur.u.values[ui]?.[uj], sv = cur.v.values[ui]?.[uj];
      c.spd = Number.isFinite(su) && Number.isFinite(sv) ? Math.hypot(su, sv) : NaN;
    }
    c.thermoAnomM = null;
    if (hy?.d20) {
      const ti = nearestIndex(hy.d20.lats, c.lat), tj = nearestIndex(hy.d20.lons, c.lon);
      const dv = thermoSpatial?.[ti]?.[tj];
      if (Number.isFinite(dv)) c.thermoAnomM = dv;
    }
    c.depthM = null;
    if (depth) {
      const di = nearestIndex(depth.lats, c.lat), dj = nearestIndex(depth.lons, c.lon);
      const dv = depth.values[di]?.[dj];
      if (Number.isFinite(dv)) c.depthM = dv;
    }
    const samp = (gr) => {
      if (!gr) return null;
      const gi = nearestIndex(gr.lats, c.lat), gj = nearestIndex(gr.lons, c.lon);
      const v = gr.values[gi]?.[gj];
      return Number.isFinite(v) ? v : null;
    };
    c.tBottom = samp(hy?.bottom ?? null);
    c.tDeep = samp(hy?.deep250 ?? null);
  }
  return { cells, eddyEdge, slaSpatial };
}

const WMAX = new Map(SPECIES_PROFILES.map((p) => [p.species, speciesWMax(p.w)]));

/**
 * Chấm MỘT ô × MỘT loài — mirror buildFishForecast. `ab` = tập term bị TẮT
 * (đặt về giá trị trung tính: cổng→1, cơ chế→0). Trả về mọi thừa số để phân rã.
 */
function scoreCell(c, p, ab = {}) {
  const tierT = p.tempSource === "bottom" ? c.tBottom : p.tempSource === "deep" ? c.tDeep : c.t;
  const band = tierT != null ? p.sst : (p.sstFallback ?? p.sst);
  const tGate = tierT != null ? tierT : c.t;
  let tFit = trapezoid(tGate, band[0], band[1], band[2], band[3]);
  if (ab.tFit) tFit = 1;
  if (tFit === 0) return null;
  const food = chlFit(c.chl, p.chlLog[0], p.chlLog[1]);
  let foodLimiter = FOOD_FLOOR + (1 - FOOD_FLOOR) * food;
  if (ab.food) foodLimiter = 1;

  const useEddy = !ab.eddy;
  const eddySrc = ab.eddyBilinear ? c.eddyBilin : c.eddy;
  const eddyTerm = c.hasSla
    ? p.coldCore
      ? Math.max(useEddy ? eddySrc : 0, ab.coldStr ? 0 : c.coldStr)
      : (useEddy ? eddySrc : 0)
    : null;

  const mech = [
    [p.w.thermFront, ab.thermFront ? 0 : c.thermFront],
    [p.w.chlFront, ab.chlFront ? 0 : c.chlFront],
  ];
  if (eddyTerm != null) mech.push([p.w.eddy, eddyTerm]);
  if (c.upw != null) mech.push([p.w.upw, ab.upw ? 0 : c.upw]);
  if (c.conv != null)
    mech.push([p.w.conv, ab.conv ? 0 : ab.convBlock && c.convBlock != null ? c.convBlock : c.conv]);
  let thermoT = 0;
  if (c.thermoAnomM != null && (p.w.thermo ?? 0) > 0) {
    thermoT = ab.thermo ? 0 : thermoFit(c.thermoAnomM, p.thermoBand);
    mech.push([p.w.thermo, thermoT]);
  }
  const agg = softOrHabitat(mech, SOFTOR_SCALE, WMAX.get(p.species) ?? speciesWMax(p.w));
  const conf = ab.conf ? 1 : SURFACE_CONF[p.surfaceSignal];
  const aggEff = conf * agg + (1 - conf) * NEUTRAL_AGG;
  const habitat = AGG_FLOOR + (1 - AGG_FLOOR) * aggEff;
  let depthFit = p.offshore
    ? c.depthM != null
      ? deepWaterFit(c.depthM, p.offshore[0], p.offshore[1])
      : DEPTH_UNKNOWN_FIT
    : 1;
  if (ab.depth) depthFit = 1;
  return { tFit, foodLimiter, habitat, depthFit, agg, aggEff, thermoT, fit: tFit * foodLimiter * habitat * depthFit };
}

/** Chấm TOÀN LƯỚI bằng bộ gương → map "lat,lon" → {s, sp} + mảng s theo ô */
function scoreGrid(cells, ab = {}) {
  const sArr = new Array(cells.length).fill(0);
  const spAll = new Map();
  cells.forEach((c, k) => {
    const scored = [];
    for (const f of c.inSeason) {
      const p = SPECIES_PROFILES.find((x) => x.species === f.species);
      if (!p) continue;
      const r = scoreCell(c, p, ab);
      if (r && r.fit > 0) scored.push({ short: p.short, fit: r.fit, low: p.surfaceSignal === "low" });
    }
    scored.sort((a, b) => b.fit - a.fit);
    const loc = scored.filter((x) => !x.low);
    sArr[k] = loc.length ? Math.round(loc[0].fit * 100) : 0;
    const sp = {};
    for (const x of scored) { const v = Math.round(x.fit * 100); if (v >= KEEP_MIN) sp[x.short] = v; }
    spAll.set(k, sp);
  });
  return { sArr, spAll };
}

/** VERIFY bộ gương == buildFishForecast (nếu lệch thì mọi số dưới VÔ NGHĨA) */
function verifyMirror(cells, sArr, fc) {
  const ref = new Map();
  for (const c of fc.cells) ref.set(`${c.lat},${c.lon}`, c.s);
  let maxDiff = 0, nCheck = 0, nMissing = 0;
  cells.forEach((c, k) => {
    const key = `${Math.round(c.lat * 100) / 100},${Math.round(c.lon * 100) / 100}`;
    const r = ref.get(key);
    if (r == null) { if (sArr[k] >= KEEP_MIN) nMissing++; return; }
    nCheck++;
    maxDiff = Math.max(maxDiff, Math.abs(r - sArr[k]));
  });
  return { maxDiff, nCheck, nMissing };
}

/* ------------------------------------------------------------ in bảng term */
function termRow(name, vals, extra = "") {
  const v = vals.filter(Number.isFinite);
  if (!v.length) return `   ${pad(name, 13)} (không có dữ liệu)`;
  const s = std(v), m = mean(v);
  const pc = (f) => padL(((100 * v.filter(f).length) / v.length).toFixed(0) + "%", 5);
  return `   ${pad(name, 13)} n=${padL(v.length, 5)} tb=${f3(m)} STD=${f3(s)} p10=${f2(pctl(v, 0.1))} p50=${f2(pctl(v, 0.5))} p90=${f2(pctl(v, 0.9))} ≥.95:${pc((x) => x >= 0.95)} ≤.05:${pc((x) => x <= 0.05)} ${extra}`;
}

/* ------------------------------------------------------------------- MAIN */
async function main() {
  const probe = await fetchJsonCached(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 2 * 86400000));
  const days = [];
  for (let k = N_DAYS_SUMMER - 1; k >= 0; k--) days.push(addDays(END, -k));
  days.push(WINTER_DAY);
  console.log(`cache: ${CACHE}\nngày: ${days.join(", ")}`);

  const bj = await fetchJsonCached(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;
  const hy = await loadHycom();
  const cur = await loadCurrents();
  console.log(`ETOPO ${depth ? "có" : "KHÔNG"} · HYCOM ${hy ? `d20/bottom/deep250` : "KHÔNG"} · dòng Copernicus ${cur ? `${cur.u.lats.length}×${cur.u.lons.length} bước ${gridStepDeg(cur.u.lats).toFixed(4)}°` : "KHÔNG"}`);

  const perDay = [];
  for (const d of days) {
    const g = await loadDay(d);
    if (!g) { console.warn(`bỏ ngày ${d}`); continue; }
    const month = Number(d.slice(5, 7));
    const F = computeFields(g, hy, depth, cur, month);
    for (const c of F.cells) c.hasSla = !!g.sla;
    perDay.push({ d, month, g, F });
  }
  if (!perDay.length) { console.error("không có ngày nào"); process.exitCode = 1; return; }

  /* ══ VERIFY bộ gương ═════════════════════════════════════════════════ */
  console.log(`\n══ VERIFY bộ chấm GƯƠNG == buildFishForecast`);
  for (const P of perDay) {
    const fc = buildFishForecast(P.g.sst, P.g.chl, P.g.sla, P.month, {
      anom: P.g.anom, cur, depth,
      thermo: hy?.d20 ?? null, bottomTemp: hy?.bottom ?? null, deepTemp: hy?.deep250 ?? null,
    });
    const { sArr } = scoreGrid(P.F.cells);
    P.sFull = sArr;
    const v = verifyMirror(P.F.cells, sArr, fc);
    console.log(`   ${P.d}: ô so=${v.nCheck} maxΔs=${v.maxDiff} ô-gương-thừa=${v.nMissing} ${v.maxDiff === 0 && v.nMissing === 0 ? "✓ TRÙNG KHỚP" : "✗ LỆCH — số dưới KHÔNG tin được"}`);
  }

  /* ══ §A CỔNG NHIỆT theo TỪNG LOÀI ════════════════════════════════════ */
  console.log(`\n══ §A1 CỔNG NHIỆT tFit theo TỪNG LOÀI (gộp ${perDay.length} ngày; chỉ ô loài ĐANG VỤ)`);
  console.log(`   ${pad("loài", 15)}${pad("tầng", 8)}${padL("n", 7)} ${padL("%tFit=0", 8)} ${padL("STD_tất", 8)} ${padL("STD_sống", 9)} ${padL("%≥0.95", 8)} ${padL("tb_sống", 8)}  dải °C`);
  const tfitRank = [];
  for (const p of SPECIES_PROFILES) {
    const all = [];
    for (const P of perDay)
      for (const c of P.F.cells) {
        if (!c.inSeason.some((f) => f.species === p.species)) continue;
        const tierT = p.tempSource === "bottom" ? c.tBottom : p.tempSource === "deep" ? c.tDeep : c.t;
        const band = tierT != null ? p.sst : (p.sstFallback ?? p.sst);
        const tGate = tierT != null ? tierT : c.t;
        all.push(trapezoid(tGate, band[0], band[1], band[2], band[3]));
      }
    if (!all.length) continue;
    const alive = all.filter((x) => x > 0);
    const row = {
      short: p.short, tier: p.tempSource ?? "surface", n: all.length,
      zero: (100 * (all.length - alive.length)) / all.length,
      stdAll: std(all), stdAlive: alive.length > 1 ? std(alive) : NaN,
      hi: alive.length ? (100 * alive.filter((x) => x >= 0.95).length) / alive.length : NaN,
      meanAlive: alive.length ? mean(alive) : NaN,
      band: p.sst.join("/"),
    };
    tfitRank.push(row);
  }
  tfitRank.sort((a, b) => a.stdAll - b.stdAll);
  for (const r of tfitRank)
    console.log(`   ${pad(r.short, 15)}${pad(r.tier, 8)}${padL(r.n, 7)} ${padL(r.zero.toFixed(1), 8)} ${padL(f3(r.stdAll), 8)} ${padL(f3(r.stdAlive), 9)} ${padL(r.hi.toFixed(0), 8)} ${padL(f3(r.meanAlive), 8)}  ${r.band}`);
  const dead = tfitRank.filter((r) => r.stdAll < 0.05);
  console.log(`   ⇒ loài có cổng nhiệt gần như HẰNG SỐ (STD_tất < 0.05): ${dead.length}/${tfitRank.length}${dead.length ? " — " + dead.map((r) => r.short).join(", ") : ""}`);

  /* ══ §A2 foodLimiter + depthFit ══════════════════════════════════════ */
  console.log(`\n══ §A2 GIỚI HẠN MỒI foodLimiter = ${FOOD_FLOOR} + ${(1 - FOOD_FLOOR).toFixed(2)}·chlFit  (dải tối đa 1/${FOOD_FLOOR} = ${(1 / FOOD_FLOOR).toFixed(2)}×)`);
  console.log(`   ${pad("loài", 15)}${padL("n", 7)} ${padL("STD", 7)} ${padL("tb", 7)} ${padL("%food=0", 9)} ${padL("%food=1", 9)} ${padL("dảiThật", 9)}`);
  const foodRank = [];
  for (const p of SPECIES_PROFILES) {
    const fl = [], raw = [];
    for (const P of perDay)
      for (const c of P.F.cells) {
        if (!c.inSeason.some((f) => f.species === p.species)) continue;
        const f0 = chlFit(c.chl, p.chlLog[0], p.chlLog[1]);
        raw.push(f0); fl.push(FOOD_FLOOR + (1 - FOOD_FLOOR) * f0);
      }
    if (!fl.length) continue;
    foodRank.push({
      short: p.short, n: fl.length, sd: std(fl), m: mean(fl),
      z: (100 * raw.filter((x) => x <= 0).length) / raw.length,
      o: (100 * raw.filter((x) => x >= 1).length) / raw.length,
      range: pctl(fl, 0.95) / Math.max(1e-9, pctl(fl, 0.05)),
    });
  }
  foodRank.sort((a, b) => a.sd - b.sd);
  for (const r of foodRank)
    console.log(`   ${pad(r.short, 15)}${padL(r.n, 7)} ${padL(f3(r.sd), 7)} ${padL(f3(r.m), 7)} ${padL(r.z.toFixed(0), 9)} ${padL(r.o.toFixed(0), 9)} ${padL(f2(r.range) + "×", 9)}`);

  console.log(`\n══ §A3 CỔNG ĐỘ SÂU depthFit (chỉ ${SPECIES_PROFILES.filter((p) => p.offshore).length}/${SPECIES_PROFILES.length} loài có \`offshore\`; còn lại = 1 HẰNG SỐ)`);
  for (const p of SPECIES_PROFILES.filter((x) => x.offshore)) {
    const v = [];
    for (const P of perDay)
      for (const c of P.F.cells) {
        if (!c.inSeason.some((f) => f.species === p.species)) continue;
        v.push(c.depthM != null ? deepWaterFit(c.depthM, p.offshore[0], p.offshore[1]) : DEPTH_UNKNOWN_FIT);
      }
    if (!v.length) continue;
    console.log(`   ${pad(p.short, 15)} n=${padL(v.length, 6)} STD=${f3(std(v))} tb=${f3(mean(v))} %=0(chặn):${padL(((100 * v.filter((x) => x === 0).length) / v.length).toFixed(0) + "%", 5)} %=1:${padL(((100 * v.filter((x) => x >= 1).length) / v.length).toFixed(0) + "%", 5)}  dải ${p.offshore.join("–")}m`);
  }

  /* ══ §B CƠ CHẾ soft-OR + TƯƠNG QUAN CHÉO ════════════════════════════ */
  const TERMS = ["thermFront", "chlFront", "eddy", "coldStr", "upw", "conv", "thermoShallow", "thermoDeep"];
  console.log(`\n══ §B1 CƠ CHẾ trong SOFT-OR — STD KHÔNG GIAN giữa các ô (theo NGÀY)`);
  for (const P of perDay) {
    console.log(`\n── ${P.d} (tháng ${P.month}) — ${P.F.cells.length} ô biển`);
    const col = collectTerms(P.F.cells);
    for (const k of TERMS) console.log(termRow(k, col[k]));
  }

  console.log(`\n══ §B2 TƯƠNG QUAN CHÉO giữa các cơ chế (Pearson, gộp mọi ngày) — |r|>0.8 = NÓI CÙNG MỘT CHUYỆN`);
  const colAll = {};
  for (const k of TERMS) colAll[k] = [];
  for (const P of perDay) {
    const c = collectTerms(P.F.cells);
    for (const k of TERMS) colAll[k].push(...c[k]);
  }
  console.log("   " + pad("", 14) + TERMS.map((t) => padL(t.slice(0, 9), 10)).join(""));
  for (const a of TERMS)
    console.log("   " + pad(a, 14) + TERMS.map((b) => padL(f2(corr(colAll[a], colAll[b])), 10)).join(""));

  /* ══ §C PHÂN RÃ PHƯƠNG SAI log(fit) ═════════════════════════════════ */
  console.log(`\n══ §C PHÂN RÃ Var(log fit) theo THỪA SỐ — %đóng góp (cộng lại = 100%), chỉ ô fit>0`);
  console.log(`   ${pad("loài", 15)}${pad("tín hiệu", 9)}${padL("n", 7)}${padL("tFit%", 8)}${padL("food%", 8)}${padL("habitat%", 10)}${padL("depth%", 8)}${padL("std(logfit)", 12)}`);
  const decomp = [];
  for (const p of SPECIES_PROFILES) {
    const L = { tFit: [], food: [], hab: [], dep: [], fit: [] };
    for (const P of perDay)
      for (const c of P.F.cells) {
        if (!c.inSeason.some((f) => f.species === p.species)) continue;
        const r = scoreCell(c, p);
        if (!r || !(r.fit > 0)) continue;
        L.tFit.push(Math.log(r.tFit)); L.food.push(Math.log(r.foodLimiter));
        L.hab.push(Math.log(r.habitat)); L.dep.push(Math.log(r.depthFit)); L.fit.push(Math.log(r.fit));
      }
    if (L.fit.length < 20) continue;
    const vf = std(L.fit) ** 2;
    const covShare = (a) => {
      const ma = mean(a), mf = mean(L.fit);
      let s = 0;
      for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (L.fit[i] - mf);
      return vf > 0 ? (100 * (s / a.length)) / vf : NaN;
    };
    decomp.push({
      short: p.short, sig: p.surfaceSignal, n: L.fit.length,
      t: covShare(L.tFit), f: covShare(L.food), h: covShare(L.hab), d: covShare(L.dep), sd: Math.sqrt(vf),
    });
  }
  decomp.sort((a, b) => a.sd - b.sd);
  for (const r of decomp)
    console.log(`   ${pad(r.short, 15)}${pad(r.sig, 9)}${padL(r.n, 7)}${padL(r.t.toFixed(1), 8)}${padL(r.f.toFixed(1), 8)}${padL(r.h.toFixed(1), 10)}${padL(r.d.toFixed(1), 8)}${padL(f3(r.sd), 12)}`);

  /* ══ §D ABLATION từng TERM trên bộ gương ════════════════════════════ */
  const ABL = [
    ["(đủ)", {}],
    ["bỏ tFit", { tFit: 1 }],
    ["bỏ food", { food: 1 }],
    ["bỏ depth", { depth: 1 }],
    ["bỏ thermFront", { thermFront: 1 }],
    ["bỏ chlFront", { chlFront: 1 }],
    ["bỏ eddy(grad)", { eddy: 1 }],
    ["bỏ coldStr", { coldStr: 1 }],
    ["bỏ CẢ sla", { eddy: 1, coldStr: 1 }],
    ["bỏ upw", { upw: 1 }],
    ["bỏ conv", { conv: 1 }],
    ["bỏ thermo", { thermo: 1 }],
    ["eddy BILINEAR", { eddyBilinear: 1 }],
    ["conv TB-KHỐI", { convBlock: 1 }],
  ];
  console.log(`\n══ §D ABLATION TỪNG TERM (bộ gương) — %điểm nóng s≥50, tương quan bản đồ s, Jaccard điểm nóng`);
  for (const P of perDay) {
    const base = P.sFull;
    const hot0 = (100 * base.filter((x) => x >= SHOW_MIN).length) / base.length;
    console.log(`\n── ${P.d} (tháng ${P.month}) — ${base.length} ô, hot%(đủ)=${hot0.toFixed(1)}`);
    console.log(`   ${pad("kịch bản", 15)}${padL("hot%", 7)}${padL("Δhot", 8)}${padL("corr", 8)}${padL("Jaccard", 9)}${padL("mean|Δs|", 10)}${padL("medΔs", 8)}`);
    for (const [name, ab] of ABL) {
      if (name === "(đủ)") { console.log(`   ${pad(name, 15)}${padL(hot0.toFixed(1), 7)}${padL("—", 8)}${padL("1.00", 8)}${padL("1.00", 9)}${padL("0.0", 10)}${padL("0", 8)}`); continue; }
      const { sArr } = scoreGrid(P.F.cells, ab);
      const hot = (100 * sArr.filter((x) => x >= SHOW_MIN).length) / sArr.length;
      const A = new Set(), B = new Set();
      base.forEach((x, k) => { if (x >= SHOW_MIN) A.add(k); });
      sArr.forEach((x, k) => { if (x >= SHOW_MIN) B.add(k); });
      let inter = 0;
      for (const k of A) if (B.has(k)) inter++;
      const uni = A.size + B.size - inter;
      const dAbs = base.map((x, k) => Math.abs(x - sArr[k]));
      const dRaw = base.map((x, k) => sArr[k] - x);
      console.log(`   ${pad(name, 15)}${padL(hot.toFixed(1), 7)}${padL((hot - hot0).toFixed(1), 8)}${padL(f2(corr(base, sArr)), 8)}${padL(uni ? f2(inter / uni) : "—", 9)}${padL(mean(dAbs).toFixed(1), 10)}${padL(pctl(dRaw, 0.5), 8)}`);
    }
  }

  /* ══ §E EDDY / SSHA ═════════════════════════════════════════════════ */
  console.log(`\n══ §E EDDY / SSHA — lưới SSHA THÔ so lưới cá`);
  const P0 = perDay[0];
  if (!P0.g.sla) { console.log("   không có SSHA"); }
  else {
    const stepSla = gridStepDeg(P0.g.sla.lats);
    const stepFish = gridStepDeg(P0.g.sst.lats);
    console.log(`   bước lưới: SSHA ${stepSla.toFixed(3)}° · cá ${stepFish.toFixed(3)}° · tỉ lệ ${(stepSla / stepFish).toFixed(1)}×`);
    console.log(`   HẰNG chuẩn hoá gradientStrength(sla, 0.08) tính THEO Ô ⇒ quy theo ĐỘ = ${(0.08 / stepSla).toFixed(3)} m/độ (đổi độ phân giải nguồn ⇒ term tự đổi thang, KHÔNG ai báo — đúng lỗi đã sửa cho CONV_FULL_PER_DEG)`);

    // p90 |∇sla| theo ĐỘ trên lưới thật
    const gradPerDeg = [];
    for (const P of perDay) {
      if (!P.g.sla) continue;
      const V = P.g.sla.values, H = V.length, W = V[0].length;
      const st = gridStepDeg(P.g.sla.lats);
      for (let i = 1; i < H - 1; i++)
        for (let j = 1; j < W - 1; j++) {
          const gy = (V[i + 1][j] - V[i - 1][j]) / 2, gx = (V[i][j + 1] - V[i][j - 1]) / 2;
          if (Number.isFinite(gx) && Number.isFinite(gy)) gradPerDeg.push(Math.hypot(gx, gy) / st);
        }
    }
    console.log(`   |∇sla| THẬT (m/độ): p50=${f3(pctl(gradPerDeg, 0.5))} p90=${f3(pctl(gradPerDeg, 0.9))} p99=${f3(pctl(gradPerDeg, 0.99))} → hằng hiện tại ${(0.08 / stepSla).toFixed(3)} = ${(0.08 / stepSla / pctl(gradPerDeg, 0.9)).toFixed(2)}× p90`);

    // nhân bản khối + sai vị trí + tự tương quan
    for (const P of perDay) {
      const cells = P.F.cells;
      const byIJ = new Map();
      cells.forEach((c, k) => byIJ.set(`${c.i},${c.j}`, k));
      const KS = ["eddy", "coldStr", "thermFront", "chlFront", "upw", "conv", "convBlock"];
      const dup = {}, lag1 = {};
      for (const k of KS) { dup[k] = [0, 0]; lag1[k] = [[], []]; }
      const off = [];
      for (const c of cells) {
        if (c.si != null) {
          const dLat = (c.lat - P.g.sla.lats[c.si]) * 111;
          const dLon = (c.lon - P.g.sla.lons[c.sj]) * 111 * Math.cos((c.lat * Math.PI) / 180);
          off.push(Math.hypot(dLat, dLon));
        }
        const nb = byIJ.get(`${c.i},${c.j + 1}`);
        if (nb == null) continue;
        const d = cells[nb];
        for (const k of KS) {
          const a = c[k], b = d[k];
          if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
          // BỎ cặp 0–0: term bị KẸP về 0 (upw/coldStr/conv có >50% ô = 0) sẽ
          // "trùng" vì clamp chứ không phải vì nhân bản khối do lưới thô
          if (!(a === 0 && b === 0)) { dup[k][1]++; if (a === b) dup[k][0]++; }
          lag1[k][0].push(a); lag1[k][1].push(b);
        }
      }
      console.log(`\n   ── ${P.d}: sai vị trí lấy mẫu SSHA (nearestIndex): tb=${f2(mean(off))} km · p90=${f2(pctl(off, 0.9))} km · max=${f2(Math.max(...off))} km`);
      console.log(`      ${pad("term", 13)}${padL("%ô kề TRÙNG y hệt (bỏ cặp 0–0)", 32)}${padL("tự tương quan trễ-1 ô", 24)}`);
      for (const k of KS)
        console.log(`      ${pad(k, 13)}${padL(dup[k][1] ? ((100 * dup[k][0]) / dup[k][1]).toFixed(1) + "%" : "—", 32)}${padL(f3(corr(lag1[k][0], lag1[k][1])), 24)}`);
    }

    // nearest vs bilinear
    const eN = [], eB = [];
    for (const P of perDay) for (const c of P.F.cells) { eN.push(c.eddy); eB.push(c.eddyBilin); }
    const dif = eN.map((x, i) => x - eB[i]).filter(Number.isFinite);
    console.log(`\n   nearest vs BILINEAR (eddyEdge): r=${f3(corr(eN, eB))} RMS lệch=${f3(Math.sqrt(mean(dif.map((x) => x * x))))} (so STD của term = ${f3(std(eN.filter(Number.isFinite)))}) → lệch/STD = ${f2(Math.sqrt(mean(dif.map((x) => x * x))) / std(eN.filter(Number.isFinite)))}`);

    // xoáy đo từ dòng Copernicus 1/12° (|xoáy tương đối| chuẩn hoá) — nguồn MỊN
    if (cur) {
      const U = cur.u.values, V = cur.v.values, la = cur.u.lats, lo = cur.u.lons;
      const st = gridStepDeg(la);
      const vort = U.map((r) => r.map(() => NaN));
      for (let i = 1; i < U.length - 1; i++)
        for (let j = 1; j < U[0].length - 1; j++) {
          const dvdx = (V[i][j + 1] - V[i][j - 1]) / (2 * st * 111000 * Math.cos((la[i] * Math.PI) / 180));
          const dudy = (U[i + 1][j] - U[i - 1][j]) / (2 * st * 111000);
          if (Number.isFinite(dvdx) && Number.isFinite(dudy)) vort[i][j] = Math.abs(dvdx - dudy);
        }
      const vs = [], es = [], cs = [];
      for (const P of perDay) for (const c of P.F.cells) {
        const vi = nearestIndex(la, c.lat), vj = nearestIndex(lo, c.lon);
        const w = vort[vi]?.[vj];
        if (!Number.isFinite(w)) continue;
        vs.push(w); es.push(c.eddy); cs.push(c.coldStr);
      }
      const f0 = pctl(vs, 0.9);
      const vn = vs.map((x) => Math.min(1, x / f0));
      console.log(`\n   XOÁY từ DÒNG Copernicus 1/12° (|ζ| = |∂v/∂x − ∂u/∂y|, s⁻¹): p50=${vs.length ? pctl(vs, 0.5).toExponential(2) : "—"} p90=${f0.toExponential(2)}`);
      console.log(`   chuẩn hoá theo p90 → STD=${f3(std(vn))} · tương quan với eddyEdge(SSHA 0,5°) r=${f3(corr(vn, es))} · với coldStr r=${f3(corr(vn, cs))}`);
      console.log(`   ⇒ r thấp = hai nguồn KHÔNG chỉ cùng chỗ; SSHA thô có thể đang chỉ sai chỗ (hoặc đo thứ khác)`);

      // TƯƠNG ĐƯƠNG VẬT LÝ ĐÚNG: |∇SSHA| ∝ TỐC ĐỘ dòng địa chuyển ⇒ so eddyEdge
      // với |tốc độ| Copernicus 1/12° (không phải xoáy tương đối)
      const sp = [], ee = [];
      for (const P of perDay) for (const c of P.F.cells)
        if (Number.isFinite(c.spd) && Number.isFinite(c.eddy)) { sp.push(c.spd); ee.push(c.eddy); }
      console.log(`   TỐC ĐỘ dòng Copernicus (m/s): p50=${f3(pctl(sp, 0.5))} p90=${f3(pctl(sp, 0.9))} · tương quan với eddyEdge r=${f3(corr(sp, ee))}`);
      console.log(`   (|∇η| địa chuyển ∝ tốc độ ⇒ r CAO là dấu hiệu eddyEdge đo đúng dòng; r thấp = 0,5° đã làm mượt mất cấu trúc)`);
    }
  }

  /* ══ §E2 HỘI TỤ conv — RĂNG CƯA do lấy mẫu điểm từ lưới MỊN 1/12° ═══ */
  if (cur) {
    const st = gridStepDeg(cur.u.lats);
    const cg = convergenceStrength(cur.u.values, cur.v.values, CONV_FULL_PER_DEG * st);
    const A = [], B = [];
    for (let i = 0; i < cg.length; i++)
      for (let j = 0; j + 1 < cg[0].length; j++) {
        const a = cg[i][j], b = cg[i][j + 1];
        if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(cur.u.values[i]?.[j]) && Number.isFinite(cur.u.values[i]?.[j + 1])) { A.push(a); B.push(b); }
      }
    console.log(`\n══ §E2 HỘI TỤ conv — tự tương quan trễ-1 ô TRÊN LƯỚI GỐC 1/12° = ${f3(corr(A, B))}`);
    console.log(`   sau khi LẤY MẪU ĐIỂM xuống 0,25° (nearestIndex, bỏ 8/9 ô) tự tương quan tụt còn ~0.23 ⇒ RĂNG CƯA (aliasing)`);
    const cn = [], cb = [];
    for (const P of perDay) for (const c of P.F.cells)
      if (c.conv != null && c.convBlock != null) { cn.push(c.conv); cb.push(c.convBlock); }
    console.log(`   nearest vs TRUNG BÌNH KHỐI 3×3: r=${f3(corr(cn, cb))} · STD ${f3(std(cn))} → ${f3(std(cb))} · tb ${f3(mean(cn))} → ${f3(mean(cb))}`);
  }

  /* ══ §E3 SSHA lưới GỐC 0,25° (stride 1) — nguồn có sẵn, app đang VỨT ═══
     `slaGridUrl()` xin stride 2 ⇒ 0,5°. Dataset noaacwBLENDEDsshDaily NGUYÊN
     BẢN là 0,25° (đo thật). Câu hỏi: 0,25° có mang THÔNG TIN THẬT không, hay
     chỉ là nội suy? Kiểm bằng nguồn ĐỘC LẬP: tốc độ dòng Copernicus 1/12°. */
  const sla1 = {};
  for (const P of perDay) {
    const f = path.join(CACHE, `sla1-${P.d}.json`);
    if (!fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f, "utf8");
    if (raw === "null") continue;
    const g1 = parseErddapGrid(JSON.parse(raw), { hasAltitude: false });
    if (g1.lats.length) sla1[P.d] = g1;
  }
  if (Object.keys(sla1).length && cur) {
    console.log(`\n══ §E3 SSHA 0,25° (stride 1, NGUỒN CÓ SẴN) vs 0,5° (đang dùng)`);
    console.log(`   ${pad("ngày", 12)}${padL("bước", 7)}${padL("STD eddy", 10)}${padL("%ô kề TRÙNG", 13)}${padL("tựTQ trễ-1", 12)}${padL("r vs |tốc độ| Copernicus", 26)}`);
    for (const P of perDay) {
      const g1 = sla1[P.d];
      const rows = [[P.g.sla, "0.50°"]];
      if (g1) rows.push([g1, "0.25°"]);
      for (const [G, lbl] of rows) {
        if (!G) continue;
        const st = gridStepDeg(G.lats);
        // hằng chuẩn hoá quy THEO ĐỘ giữ nguyên (0.16 m/độ) để so công bằng
        const ee = gradientStrength(G.values, 0.16 * st);
        const vals = [], spd = [], nb = [];
        const byIJ = new Map();
        P.F.cells.forEach((c, k) => byIJ.set(`${c.i},${c.j}`, k));
        const arr = P.F.cells.map((c) => {
          const si = nearestIndex(G.lats, c.lat), sj = nearestIndex(G.lons, c.lon);
          return ee[si]?.[sj] ?? NaN;
        });
        let dupN = 0, dupD = 0;
        const l0 = [], l1 = [];
        P.F.cells.forEach((c, k) => {
          vals.push(arr[k]);
          if (Number.isFinite(c.spd)) { spd.push(c.spd); nb.push(arr[k]); }
          const kk = byIJ.get(`${c.i},${c.j + 1}`);
          if (kk == null) return;
          const a = arr[k], b = arr[kk];
          if (!Number.isFinite(a) || !Number.isFinite(b)) return;
          if (!(a === 0 && b === 0)) { dupD++; if (a === b) dupN++; }
          l0.push(a); l1.push(b);
        });
        console.log(`   ${pad(P.d, 12)}${padL(lbl, 7)}${padL(f3(std(vals.filter(Number.isFinite))), 10)}${padL(dupD ? ((100 * dupN) / dupD).toFixed(1) + "%" : "—", 13)}${padL(f3(corr(l0, l1)), 12)}${padL(f3(corr(nb, spd)), 26)}`);
      }
    }
    console.log(`   ⇒ nếu 0,25° cho r-với-dòng-thật CAO HƠN thì lưới gốc mang tín hiệu THẬT, stride 2 đang VỨT ĐI`);
  }

  /* ══ §G coldStrength có BAO GIỜ thắng eddy không ════════════════════ */
  let win = 0, tot = 0, winBig = 0;
  for (const P of perDay) for (const c of P.F.cells) {
    if (!c.hasSla) continue;
    tot++;
    if (c.coldStr > c.eddy) { win++; if (c.coldStr - c.eddy > 0.1) winBig++; }
  }
  console.log(`\n══ §G coldStrength chỉ vào mô hình qua max(eddy, coldStr) cho loài coldCore`);
  console.log(`   %ô coldStr THẮNG eddy: ${((100 * win) / tot).toFixed(1)}% · thắng RÕ (>0.1): ${((100 * winBig) / tot).toFixed(1)}%  (n=${tot})`);

  /* ══ §H PHÂN BỐ log10(chl) THẬT vs dải chlLog khai báo ══════════════ */
  const lc = [];
  for (const P of perDay) for (const c of P.F.cells)
    if (Number.isFinite(c.chl) && c.chl > 0) lc.push(Math.log10(c.chl));
  console.log(`\n══ §H log10(chl) THẬT trên ô biển VN (n=${lc.length}): p05=${f2(pctl(lc, 0.05))} p10=${f2(pctl(lc, 0.1))} p25=${f2(pctl(lc, 0.25))} p50=${f2(pctl(lc, 0.5))} p75=${f2(pctl(lc, 0.75))} p90=${f2(pctl(lc, 0.9))} p95=${f2(pctl(lc, 0.95))}`);
  console.log(`   Dải HỢP HẲN (chlFit=1) của loài = [lo,hi]; ngoài ra còn mép thoải ±0.45 ⇒ dải "khác 0" = [lo−0.45, hi+0.45]`);
  console.log(`   ${pad("loài", 15)}${padL("lo", 7)}${padL("hi", 7)}${padL("%ô trong [lo,hi]", 18)}${padL("%ô ngoài hẳn", 14)}${padL("rộng dải", 10)}`);
  const rows = SPECIES_PROFILES.map((p) => {
    const inb = (100 * lc.filter((x) => x >= p.chlLog[0] && x <= p.chlLog[1]).length) / lc.length;
    const out = (100 * lc.filter((x) => x < p.chlLog[0] - 0.45 || x > p.chlLog[1] + 0.45).length) / lc.length;
    return { short: p.short, lo: p.chlLog[0], hi: p.chlLog[1], inb, out, w: p.chlLog[1] - p.chlLog[0] };
  }).sort((a, b) => b.inb - a.inb);
  for (const r of rows)
    console.log(`   ${pad(r.short, 15)}${padL(r.lo.toFixed(2), 7)}${padL(r.hi.toFixed(2), 7)}${padL(r.inb.toFixed(0) + "%", 18)}${padL(r.out.toFixed(0) + "%", 14)}${padL(r.w.toFixed(2), 10)}`);

  /* ══ §J ỨNG VIÊN thay cổng mồi TUYỆT ĐỐI: DỊ THƯỜNG KHÔNG GIAN log-chl ═
     Cùng cách đã cứu thermoFit/upwTerm: so với TRUNG VỊ vùng lân cận 2,5°.
     Phải kiểm nó KHÔNG trùng với chlFront (nếu trùng thì chỉ đếm 2 lần). */
  {
    const A = [], FR = [], ABS = [];
    for (const P of perDay) {
      const lg = logChlGrid(P.g.chl);
      const an = spatialAnomaly(lg, P.g.chl.lats, P.g.chl.lons, SPATIAL_RADIUS_DEG);
      for (const c of P.F.cells) {
        const ci = nearestIndex(P.g.chl.lats, c.lat), cj = nearestIndex(P.g.chl.lons, c.lon);
        const v = an[ci]?.[cj];
        if (!Number.isFinite(v)) continue;
        A.push(v); FR.push(c.chlFront); ABS.push(lg[ci]?.[cj]);
      }
    }
    const ab = A.map(Math.abs);
    console.log(`\n══ §J DỊ THƯỜNG KHÔNG GIAN của log10(chl) (bán kính ${SPATIAL_RADIUS_DEG}°) — n=${A.length}`);
    console.log(`   p10=${f2(pctl(A, 0.1))} p50=${f2(pctl(A, 0.5))} p90=${f2(pctl(A, 0.9))} std=${f3(std(A))} · |dị thường| p50=${f2(pctl(ab, 0.5))} p90=${f2(pctl(ab, 0.9))} (⇒ SCALE ứng viên ≈ p90)`);
    console.log(`   tương quan với chlFront r=${f3(corr(A, FR))} · với log-chl TUYỆT ĐỐI r=${f3(corr(A, ABS))}`);
    console.log(`   ⇒ r(chlFront) thấp = tín hiệu MỚI, không đếm hai lần`);
  }

  /* ══ §I BẢN ĐỒ ĐỔI BAO NHIÊU GIỮA HAI NGÀY LIỀN (tĩnh hay động?) ════ */
  console.log(`\n══ §I bản đồ "Mọi loài" đổi giữa hai ngày liền nhau`);
  for (let k = 1; k < perDay.length; k++) {
    const a = perDay[k - 1], b = perDay[k];
    if (a.month !== b.month) continue;
    const n = Math.min(a.sFull.length, b.sFull.length);
    if (a.F.cells.length !== b.F.cells.length) { console.log(`   ${a.d}→${b.d}: khác số ô, bỏ`); continue; }
    const A = new Set(), B = new Set();
    a.sFull.forEach((x, i) => { if (x >= SHOW_MIN) A.add(i); });
    b.sFull.forEach((x, i) => { if (x >= SHOW_MIN) B.add(i); });
    let inter = 0; for (const x of A) if (B.has(x)) inter++;
    console.log(`   ${a.d}→${b.d}: corr=${f3(corr(a.sFull.slice(0, n), b.sFull.slice(0, n)))} Jaccard điểm nóng=${f2(inter / (A.size + B.size - inter))} mean|Δs|=${mean(a.sFull.map((x, i) => Math.abs(x - b.sFull[i]))).toFixed(1)}`);
  }

  /* ══ §F ẢNH HƯỞNG conf/NEUTRAL_AGG lên loài low ═════════════════════ */
  console.log(`\n══ §F NÉN bởi surfaceSignal (aggEff = conf·agg + (1−conf)·${NEUTRAL_AGG})`);
  console.log(`   ${pad("tín hiệu", 9)}${padL("conf", 6)}${padL("#loài", 7)}${padL("STD(agg)", 10)}${padL("STD(habitat)", 14)}${padL("dải habitat", 16)}`);
  for (const sig of ["high", "medium", "low"]) {
    const ps = SPECIES_PROFILES.filter((p) => p.surfaceSignal === sig);
    const A = [], Hb = [];
    for (const p of ps)
      for (const P of perDay)
        for (const c of P.F.cells) {
          if (!c.inSeason.some((f) => f.species === p.species)) continue;
          const r = scoreCell(c, p);
          if (!r) continue;
          A.push(r.agg); Hb.push(r.habitat);
        }
    if (!A.length) continue;
    console.log(`   ${pad(sig, 9)}${padL(SURFACE_CONF[sig], 6)}${padL(ps.length, 7)}${padL(f3(std(A)), 10)}${padL(f3(std(Hb)), 14)}${padL(`${f2(pctl(Hb, 0.05))}–${f2(pctl(Hb, 0.95))}`, 16)}`);
  }
}

function collectTerms(cells) {
  const out = { thermFront: [], chlFront: [], eddy: [], coldStr: [], upw: [], conv: [], thermoShallow: [], thermoDeep: [] };
  for (const c of cells) {
    out.thermFront.push(c.thermFront);
    out.chlFront.push(c.chlFront);
    out.eddy.push(c.eddy);
    out.coldStr.push(c.coldStr);
    if (c.upw != null) out.upw.push(c.upw);
    if (c.conv != null) out.conv.push(c.conv);
    if (c.thermoAnomM != null) {
      out.thermoShallow.push(thermoFit(c.thermoAnomM));
      out.thermoDeep.push(thermoFit(c.thermoAnomM, [4, 12]));
    }
  }
  return out;
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
