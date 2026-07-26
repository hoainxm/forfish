// scripts/conv-copernicus-calib.mjs   (chạy: node scripts/conv-copernicus-calib.mjs)
// ─────────────────────────────────────────────────────────────────────────
// ĐỔI NGUỒN YẾU TỐ `conv` (hội tụ dòng chảy) NOAA địa chuyển → Copernicus dòng
// TỔNG, rồi HIỆU CHỈNH LẠI mức "hội tụ rõ hẳn" (CONV_FULL_PER_DEG).
//
// VÌ SAO: dòng ĐỊA CHUYỂN (NOAA `noaacwBLENDEDNRTcurrentsDaily`) về mặt vật lý
// gần như KHÔNG phân kỳ, nên -(∂u/∂x+∂v/∂y) trên nó là NHIỄU vi phân số.
// `w.conv` của 40 loài từng được đặt khi conv ≈ 0 khắp nơi ⇒ nay conv mang tín
// hiệu THẬT thì điểm có thể phình. Phải đo lại, không đoán.
//
// BA PHA (chạy hết, hoặc chọn bằng cờ):
//   --assets   PHA 1 — ĐO RỒI CHỌN asset ARCO: `downsampled4` (1/3°, 1 chunk
//              toàn cầu) vs `timeChunked` (1/12°, 2 chunk vùng VN). Chỉ tiêu:
//              dung lượng + thời gian, và CHẤT LƯỢNG trường phân kỳ đo bằng TỰ
//              TƯƠNG QUAN KHÔNG GIAN trễ-1 ô TRÊN LƯỚI ĐÃ CẮT VỀ VÙNG VN.
//   --dist     PHA 2 — phân bố `convTerm` (giá trị mô hình THỰC SỰ ăn) sau khi
//              lấy mẫu về lưới cá 0,25°: mean/p50/p90/p99 + ĐỘ LỆCH CHUẨN KHÔNG
//              GIAN, so Copernicus vs NOAA; sweep CONV_FULL_PER_DEG để ~10% ô
//              mạnh nhất tiến gần 1 (cùng tinh thần UPW_SCALE/COLD_SCALE).
//   --ba       PHA 3 — TRƯỚC/SAU trên CÙNG dữ liệu, ≥2 ngày hè + 1 ngày đông:
//              %điểm nóng (s≥50), median, p90, và SỐ Ô ≥50 CỦA LOÀI ĐẠI DIỆN
//              MỖI NHÓM (không loài nào được biến mất).
//
// Lưới NOAA cache ra đĩa (CONV_CALIB_CACHE hoặc %TMP%/sdfish-conv-calib) để mọi
// pha dùng CHÍNH XÁC cùng dữ liệu. KHÔNG ghi vào src/.
// ─────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildFishForecast,
  convergenceStrength,
  gridStepDeg,
  nearestIndex,
  parseBathyGrid,
  parseErddapGrid,
  CONV_FULL_PER_DEG,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";
import { fetchCopernicusCurrents, COPERNICUS_ASSETS } from "../src/lib/copernicus.ts";
import { fetchHycomGrids } from "../src/lib/hycom.ts";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const REGION_REACH_DEG = 2.0;
const KEEP_MIN = 25;
const SHOW_MIN = 50;
const FETCH_TIMEOUT_MS = 60000;
const R_EARTH = 6371000;
/** HẰNG CŨ, quy về "mỗi độ": 0,1 m/s mỗi ô 0,25° = 0,4 m/s mỗi độ */
const OLD_FULL_PER_DEG = 0.4;
const N_DAYS_SUMMER = 2;
/** ứng viên CONV_FULL_PER_DEG đem ra so trên ĐIỂM CUỐI (pha 3) */
const SWEEP_FULL = [0.44, 0.8, 1.0, 1.5, 2.0];
const WINTER_DAY = "2026-01-15";
/** loài đại diện MỖI NHÓM — không loài nào được biến mất */
const WATCH = [
  "ngừ vây vàng", // pelagic-large (offshore)
  "ngừ mắt to", // pelagic-large (offshore, thermo NẶNG)
  "cá nục", // pelagic-small (w.conv 0.30)
  "cá đối", // pelagic-small (w.conv 0.50 — CAO NHẤT, dễ phình nhất)
  "mực lá", // cephalopod (w.conv 0.50)
  "cá mối", // demersal
  "ghẹ xanh", // crustacean (w.conv hạ 0.12 CỐ Ý — phải giữ)
  "cá hồng", // reef
];

const CACHE =
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
const flat = (g) => g.flat().filter(Number.isFinite);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : NaN);
const std = (a) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
function pct(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

async function fetchJsonCached(url, key) {
  const file = path.join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
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
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON ${r.status}`);
      }
      if (!r.ok) {
        if (r.status === 400 || r.status === 404) { data = null; break; }
        throw new Error(j?.reason || r.status);
      }
      data = j;
      break;
    } catch (e) {
      if (attempt === 2) {
        console.warn(`  ! ${key}: ${String(e).slice(0, 90)}`);
        data = null;
      } else await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T12:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

async function loadDay(d) {
  const [sj, cj, slj, aj, uj, vj] = await Promise.all([
    fetchJsonCached(sstUrl(d), `sst-${d}`),
    fetchJsonCached(chlUrl(d), `chl-${d}`),
    fetchJsonCached(slaUrl(d), `sla-${d}`),
    fetchJsonCached(anomUrl(d), `anom-${d}`),
    fetchJsonCached(curUrl(d, "u"), `u-${d}`),
    fetchJsonCached(curUrl(d, "v"), `v-${d}`),
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
  const sla = opt(slj), anom = opt(aj), u = opt(uj), v = opt(vj);
  const cur = u && v && u.lats.length === v.lats.length ? { u, v } : null;
  return { sst, chl, sla, anom, cur };
}

/** Copernicus — cache ra đĩa theo asset + biến (một mốc giờ, dùng cho mọi ngày) */
async function loadCopernicus(asset, variables) {
  const tag = `cop-${asset}-${variables ? variables.u : "utotal"}`;
  const file = path.join(CACHE, `${tag}.json`);
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    const j = raw === "null" ? null : JSON.parse(raw);
    if (j) j.cached = true;
    return j;
  }
  const t0 = Date.now();
  const g = await fetchCopernicusCurrents({ asset, variables, timeoutMs: 90000 });
  const out = g ? { ...g, ms: Date.now() - t0, cached: false } : null;
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
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

/* ---------------------------------------------------------------------------
   PHA 1 — chọn asset
--------------------------------------------------------------------------- */

/** Phân kỳ D và xoáy ζ ở đơn vị VẬT LÝ (s⁻¹) — không phụ thuộc bước lưới */
function divCurlPhysical(u, v, lats, lons) {
  const H = lats.length;
  const W = lons.length;
  const dLat = ((lats[1] - lats[0]) * Math.PI) / 180;
  const dLon = ((lons[1] - lons[0]) * Math.PI) / 180;
  const dy = R_EARTH * dLat;
  const div = [];
  const curl = [];
  for (let i = 0; i < H; i++) {
    const dRow = [];
    const cRow = [];
    const dx = R_EARTH * Math.cos((lats[i] * Math.PI) / 180) * dLon;
    for (let j = 0; j < W; j++) {
      const uR = j + 1 < W ? u[i][j + 1] : NaN;
      const uL = j - 1 >= 0 ? u[i][j - 1] : NaN;
      const uU = i + 1 < H ? u[i + 1][j] : NaN;
      const uD = i - 1 >= 0 ? u[i - 1][j] : NaN;
      const vR = j + 1 < W ? v[i][j + 1] : NaN;
      const vL = j - 1 >= 0 ? v[i][j - 1] : NaN;
      const vU = i + 1 < H ? v[i + 1][j] : NaN;
      const vD = i - 1 >= 0 ? v[i - 1][j] : NaN;
      const ok = [uR, uL, uU, uD, vR, vL, vU, vD].every(Number.isFinite);
      dRow.push(ok ? (uR - uL) / (2 * dx) + (vU - vD) / (2 * dy) : NaN);
      cRow.push(ok ? (vR - vL) / (2 * dx) - (uU - uD) / (2 * dy) : NaN);
    }
    div.push(dRow);
    curl.push(cRow);
  }
  return { div, curl };
}

/**
 * TỰ TƯƠNG QUAN KHÔNG GIAN trễ-1 ô. NHIỄU số học → ≈0 (hoặc âm: sai phân giữa
 * tạo dao động răng cưa); cấu trúc VẬT LÝ thật → dương rõ. Không phụ thuộc đơn
 * vị. Đây là phép thử "tín hiệu hay nhiễu".
 */
function lag1Autocorr(f) {
  const pairs = [];
  for (let i = 0; i < f.length; i++)
    for (let j = 0; j < f[i].length; j++) {
      const a = f[i][j];
      if (!Number.isFinite(a)) continue;
      if (j + 1 < f[i].length && Number.isFinite(f[i][j + 1])) pairs.push([a, f[i][j + 1]]);
      if (i + 1 < f.length && Number.isFinite(f[i + 1][j])) pairs.push([a, f[i + 1][j]]);
    }
  if (pairs.length < 10) return NaN;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function fieldStats(name, g, extra) {
  const { div, curl } = divCurlPhysical(g.u.values, g.v.values, g.u.lats, g.u.lons);
  const D = flat(div).map((x) => x * 1e6);
  const Z = flat(curl).map((x) => x * 1e6);
  const step = gridStepDeg(g.u.lats);
  const ac = lag1Autocorr(div);
  const r = {
    name,
    grid: `${g.u.lats.length}×${g.u.lons.length}`,
    step,
    cells: D.length,
    rmsD: rms(D),
    rmsZ: rms(Z),
    ratio: rms(D) / rms(Z),
    autocorr: ac,
    ...extra,
  };
  console.log(
    `  ${pad(name, 34)} lưới ${pad(r.grid, 10)} bước ${step.toFixed(4)}°` +
      `  ô có số ${pad(r.cells, 8)}` +
      `  RMS(D) ${r.rmsD.toFixed(3)}  D/ζ ${r.ratio.toFixed(4)}` +
      `  ➜ TỰ TƯƠNG QUAN ${ac.toFixed(3)} ${ac < 0.2 ? "(NHIỄU)" : "(CÓ CẤU TRÚC)"}`,
  );
  return r;
}

async function phaseAssets(noaaCur) {
  console.log("\n╔══ PHA 1 — ĐO RỒI CHỌN ASSET ARCO ═══════════════════════════");
  const out = {};
  for (const asset of ["downsampled4", "timeChunked"]) {
    console.log(`\n── ${asset}  ${COPERNICUS_ASSETS[asset]}`);
    const g = await loadCopernicus(asset);
    if (!g) { console.log("   ✗ trả null"); continue; }
    console.log(
      `   mốc ${g.timeISO} (${g.forecast ? "DỰ BÁO" : "quá khứ"})` +
        `  | tải ${(g.bytes / 1024).toFixed(0)} KB` +
        `  | ${g.cached ? "(từ cache đĩa)" : `${(g.ms / 1000).toFixed(1)} s`}`,
    );
    out[asset] = fieldStats(`Copernicus ${asset}`, g, {
      bytes: g.bytes,
      ms: g.ms,
      cached: g.cached,
    });
  }
  if (noaaCur) {
    console.log("\n── ĐỐI CHỨNG: NOAA blended currents (ĐỊA CHUYỂN, 0,25°)");
    out.noaa = fieldStats("NOAA địa chuyển", noaaCur, { bytes: null, ms: null });
  }
  console.log(
    "\n  → tự tương quan CÀNG CAO = trường phân kỳ càng có CẤU TRÚC thật" +
      " (nhiễu răng cưa cho ≈0 hoặc âm).",
  );
  return out;
}

/* ---------------------------------------------------------------------------
   PHA 2 — phân bố convTerm trên LƯỚI CÁ + sweep hằng
--------------------------------------------------------------------------- */

/**
 * `convTerm` mà `buildFishForecast` THỰC SỰ ăn: hội tụ tính trên LƯỚI GỐC của
 * nguồn dòng, rồi lấy mẫu GẦN NHẤT về từng ô cá 0,25° có mùa vụ. Chép đúng
 * đường đi trong src (nearestIndex + kiểm ô u hữu hạn).
 */
function convTermsOnFishGrid(sst, cur, month, fullPerDeg) {
  const grid = convergenceStrength(
    cur.u.values,
    cur.v.values,
    fullPerDeg * gridStepDeg(cur.u.lats),
  );
  const vals = [];
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      if (!FISH_SEASONS.some((f) => f.months.includes(month) && f.regions.includes(region.id)))
        continue;
      const ui = nearestIndex(cur.u.lats, sst.lats[i]);
      const uj = nearestIndex(cur.u.lons, sst.lons[j]);
      const cv = grid[ui]?.[uj];
      if (cv != null && Number.isFinite(cur.u.values[ui]?.[uj])) vals.push(cv);
    }
  return vals;
}

/**
 * Giá trị HỘI TỤ THÔ (m/s trên MỘT ĐỘ), KHÔNG chuẩn hoá, KHÔNG kẹp — để chọn
 * `full` theo ĐÚNG LUẬT NHÀ đã dùng cho UPW_SCALE/COLD_SCALE/THERMO_BAND:
 * `full` = p90 của |đại lượng| TRÊN CHÍNH PHÍA được tính điểm (ở đây: phía HỘI
 * TỤ, vì phía phân kỳ đã bị kẹp về 0) ⇒ đúng ~10% ô của phía đó đạt 1.
 * Lấy mẫu y hệt src: hội tụ tính trên LƯỚI GỐC rồi nearest về ô cá 0,25°.
 */
function rawConvOnFishGrid(sst, cur, month) {
  const u = cur.u.values, v = cur.v.values;
  const H = u.length, W = H ? u[0].length : 0;
  const step = gridStepDeg(cur.u.lats);
  const raw = u.map((row) => row.map(() => NaN));
  for (let i = 0; i < H; i++)
    for (let j = 0; j < W; j++) {
      if (!Number.isFinite(u[i][j]) || !Number.isFinite(v[i][j])) continue;
      const rt = j + 1 < W ? u[i][j + 1] : NaN;
      const lf = j - 1 >= 0 ? u[i][j - 1] : NaN;
      const up = i + 1 < H ? v[i + 1][j] : NaN;
      const dn = i - 1 >= 0 ? v[i - 1][j] : NaN;
      const dudx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      const dvdy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      raw[i][j] = -(dudx + dvdy) / step; // m/s trên MỘT ĐỘ
    }
  const vals = [];
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      if (!FISH_SEASONS.some((f) => f.months.includes(month) && f.regions.includes(region.id)))
        continue;
      const ui = nearestIndex(cur.u.lats, sst.lats[i]);
      const uj = nearestIndex(cur.u.lons, sst.lons[j]);
      const cv = raw[ui]?.[uj];
      if (Number.isFinite(cv)) vals.push(cv);
    }
  return vals;
}

function describe(tag, v) {
  const nz = v.filter((x) => x > 0).length;
  console.log(
    `   ${pad(tag, 30)} n=${pad(v.length, 6)} >0: ${pad(`${((100 * nz) / v.length).toFixed(1)}%`, 8)}` +
      ` mean ${mean(v).toFixed(4)}  p50 ${pct(v, 50).toFixed(4)}` +
      `  p90 ${pct(v, 90).toFixed(4)}  p99 ${pct(v, 99).toFixed(4)}` +
      `  max ${Math.max(...v).toFixed(4)}  STD-KG ${std(v).toFixed(4)}`,
  );
  return { n: v.length, nzPct: (100 * nz) / v.length, mean: mean(v), p50: pct(v, 50), p90: pct(v, 90), p99: pct(v, 99), std: std(v) };
}

function phaseDist(days, cop) {
  console.log("\n╔══ PHA 2 — PHÂN BỐ convTerm TRÊN LƯỚI CÁ 0,25° ══════════════");
  console.log("  (STD-KG = độ lệch chuẩn KHÔNG GIAN của convTerm trên vùng biển VN)");
  for (const { d, g, month } of days) {
    console.log(`\n── ${d} (tháng ${month})`);
    if (g.cur) describe(`NOAA địa chuyển (full cũ 0,4/độ)`, convTermsOnFishGrid(g.sst, g.cur, month, OLD_FULL_PER_DEG));
    describe(`Copernicus (full cũ 0,4/độ)`, convTermsOnFishGrid(g.sst, cop, month, OLD_FULL_PER_DEG));
  }

  // LUẬT NHÀ (giống UPW_SCALE/COLD_SCALE/THERMO_BAND): full = p90 của đại lượng
  // THÔ trên PHÍA ĐƯỢC CHẤM (hội tụ > 0) ⇒ đúng ~10% ô của phía đó đạt 1.
  console.log("\n── ĐẠI LƯỢNG THÔ (m/s trên MỘT ĐỘ), chỉ phía HỘI TỤ (>0)");
  const dayRef = days[0];
  for (const [tag, cg] of [["NOAA địa chuyển", dayRef.g.cur], ["Copernicus", cop]]) {
    if (!cg) continue;
    const pos = rawConvOnFishGrid(dayRef.g.sst, cg, dayRef.month).filter((x) => x > 0);
    console.log(
      `   ${pad(tag, 20)} n(+)=${pad(pos.length, 6)}` +
        ` p50 ${pct(pos, 50).toFixed(4)}  p75 ${pct(pos, 75).toFixed(4)}` +
        `  ➜ p90 ${pct(pos, 90).toFixed(4)}  p99 ${pct(pos, 99).toFixed(4)}` +
        `  max ${Math.max(...pos).toFixed(4)}`,
    );
  }

  // SWEEP: xem full nào giữ được dải động (mục tiêu %điểm nóng KHÔNG phình)
  console.log("\n── SWEEP CONV_FULL_PER_DEG trên Copernicus");
  const raw = rawConvOnFishGrid(dayRef.g.sst, cop, dayRef.month).map((x) => Math.max(0, x));
  console.log(
    "   " + pad("full/độ", 10) + pad("mean", 9) + pad("p50", 9) + pad("p90", 9) +
      pad("p99", 9) + pad("%ô ≥0,5", 10) + pad("%ô =1 (kẹp)", 12),
  );
  const rows = [];
  for (const f of [0.4, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 6.0]) {
    const v = raw.map((x) => Math.min(1, x / f));
    const row = {
      full: f, mean: mean(v), p50: pct(v, 50), p90: pct(v, 90), p99: pct(v, 99),
      ge5: (100 * v.filter((x) => x >= 0.5).length) / v.length,
      eq1: (100 * v.filter((x) => x >= 0.999).length) / v.length,
    };
    rows.push(row);
    console.log(
      "   " + pad(f.toFixed(1), 10) + pad(row.mean.toFixed(4), 9) + pad(row.p50.toFixed(4), 9) +
        pad(row.p90.toFixed(4), 9) + pad(row.p99.toFixed(4), 9) +
        pad(row.ge5.toFixed(1), 10) + pad(row.eq1.toFixed(1), 12),
    );
  }
  console.log(
    `\n   Hằng ĐANG DÙNG trong src: CONV_FULL_PER_DEG = ${CONV_FULL_PER_DEG}` +
      `  (hằng CŨ tương đương ${OLD_FULL_PER_DEG})`,
  );
  return rows;
}

/* ---------------------------------------------------------------------------
   PHA 3 — TRƯỚC/SAU
--------------------------------------------------------------------------- */

function totalSeaCells(sst, month) {
  let n = 0;
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      if (FISH_SEASONS.some((f) => f.months.includes(month) && f.regions.includes(region.id))) n++;
    }
  return n;
}

function metrics(fc, total) {
  const sList = fc.cells.map((c) => c.s);
  while (sList.length < total) sList.push(0);
  sList.sort((a, b) => a - b);
  const q = (p) => sList[Math.min(sList.length - 1, Math.floor(p * sList.length))];
  const hot = fc.cells.filter((c) => c.s >= SHOW_MIN).length;
  const sp = {};
  for (const w of WATCH) sp[w] = { pay: 0, hot: 0 };
  let allSpecies = 0;
  const seen = new Set();
  for (const c of fc.cells)
    for (const [k, v] of Object.entries(c.sp)) {
      if (v >= SHOW_MIN) seen.add(k);
      if (!sp[k]) continue;
      if (v >= KEEP_MIN) sp[k].pay++;
      if (v >= SHOW_MIN) sp[k].hot++;
    }
  allSpecies = seen.size;
  return {
    total, kept: fc.cells.length, median: q(0.5), p90: q(0.9), p95: q(0.95),
    max: sList[sList.length - 1], hotPct: (100 * hot) / total, sp, allSpecies,
  };
}

function phaseBA(days, cop, depth, hy) {
  console.log("\n╔══ PHA 3 — TRƯỚC / SAU trên CÙNG dữ liệu ════════════════════");
  const rep = {};
  for (const { d, g, month } of days) {
    const total = totalSeaCells(g.sst, month);
    const base = {
      anom: g.anom, depth,
      thermo: hy?.d20 ?? null, bottomTemp: hy?.bottom ?? null, deepTemp: hy?.deep250 ?? null,
    };
    const before = buildFishForecast(g.sst, g.chl, g.sla, month, {
      ...base, cur: g.cur, convFullPerDeg: OLD_FULL_PER_DEG,
    });
    const noConv = buildFishForecast(g.sst, g.chl, g.sla, month, { ...base, cur: null });
    const m = { "TRƯỚC (NOAA, 0,4/độ)": metrics(before, total) };
    // sweep `full` NGAY TRÊN ĐIỂM CUỐI — chỉ tiêu quyết định là %điểm nóng, không
    // phải phân bố convTerm; 0,44 = p90 phía hội tụ (luật nhà), 0,8 = giữ đúng
    // dải động mà 40 hồ sơ loài đã được tuned trên đó.
    for (const f of SWEEP_FULL)
      m[`SAU Copernicus full=${f}${f === CONV_FULL_PER_DEG ? " ★" : ""}`] = metrics(
        buildFishForecast(g.sst, g.chl, g.sla, month, {
          ...base, cur: cop, convFullPerDeg: f,
        }),
        total,
      );
    m["Copernicus HỎNG (bỏ conv)"] = metrics(noConv, total);
    rep[d] = { month, total, m };
    console.log(`\n══ ${d} (tháng ${month}) — ${total} ô biển`);
    console.log(
      pad("kịch bản", 30) + pad("med", 5) + pad("p90", 5) + pad("p95", 5) +
        pad("max", 5) + pad("hot%", 7) + pad("payload", 9) + pad("#loài≥50", 9) +
        WATCH.map((w) => pad(w, 14)).join(""),
    );
    for (const [k, x] of Object.entries(m))
      console.log(
        pad(k, 30) + pad(x.median, 5) + pad(x.p90, 5) + pad(x.p95, 5) + pad(x.max, 5) +
          pad(x.hotPct.toFixed(1), 7) + pad(x.kept, 9) + pad(x.allSpecies, 9) +
          WATCH.map((w) => pad(`${x.sp[w].pay}/${x.sp[w].hot}`, 14)).join(""),
      );
    console.log("  (mỗi loài: số ô ≥25 / số ô ≥50)");
  }
  return rep;
}

/* ---------------------------------------------------------------------------
   main
--------------------------------------------------------------------------- */

async function main() {
  const only = ["--assets", "--dist", "--ba"].filter((f) => process.argv.includes(f));
  const want = (f) => only.length === 0 || only.includes(f);
  console.log(`cache: ${CACHE}`);

  const probe = await fetchJsonCached(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ??
    iso(new Date(Date.now() - 2 * 86400000));
  const dayIds = [];
  for (let k = N_DAYS_SUMMER - 1; k >= 0; k--) dayIds.push(addDays(END, -k));
  dayIds.push(WINTER_DAY);
  console.log(`Ngày: ${dayIds.join(", ")}`);

  const days = [];
  for (const d of dayIds) {
    const g = await loadDay(d);
    if (!g) { console.warn(`bỏ ngày ${d}`); continue; }
    days.push({ d, g, month: Number(d.slice(5, 7)) });
  }
  if (!days.length) throw new Error("không tải được ngày nào");

  const assets = want("--assets") ? await phaseAssets(days[0].g.cur) : null;

  // asset dùng cho pha 2–3: theo mặc định của src (đã chốt sau pha 1)
  const cop = await loadCopernicus(undefined);
  if (!cop) throw new Error("Copernicus trả null — không đo tiếp được");
  console.log(
    `\nCopernicus dùng cho pha 2–3: asset=${cop.asset} bước ${cop.stepDeg.toFixed(4)}°` +
      ` lưới ${cop.u.lats.length}×${cop.u.lons.length} mốc ${cop.timeISO}`,
  );

  if (want("--dist")) phaseDist(days, cop);

  if (want("--ba")) {
    const bj = await fetchJsonCached(BATHY, "bathy");
    const depth = bj ? parseBathyGrid(bj) : null;
    const hy = await loadHycom();
    console.log(`ETOPO: ${depth ? depth.lats.length + "×" + depth.lons.length : "KHÔNG có"} | HYCOM: ${hy ? "có" : "KHÔNG"}`);
    phaseBA(days, cop, depth, hy);
  }

  if (assets) {
    console.log("\n╔══ TÓM TẮT CHỌN ASSET ═══════════════════════════════════════");
    for (const [k, r] of Object.entries(assets))
      console.log(
        `  ${pad(k, 14)} bước ${r.step.toFixed(4)}°  tự-tương-quan-D ${r.autocorr.toFixed(3)}` +
          `  D/ζ ${r.ratio.toFixed(4)}` +
          (r.bytes ? `  tải ${(r.bytes / 1024).toFixed(0)} KB` : "") +
          (r.ms ? `  ${(r.ms / 1000).toFixed(1)} s` : ""),
      );
  }
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
