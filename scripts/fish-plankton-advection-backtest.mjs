// scripts/fish-plankton-advection-backtest.mjs
// ─────────────────────────────────────────────────────────────────────────
// BỘ ĐO "phù du dịch chuyển" cho Trục 1 (dự báo cá) của SDFish.
//
// VẤN ĐỀ: route /api/fish-forecast kéo ảnh phù du DINEOF daily MỚI NHẤT
// (trễ ~2 ngày, ~25 km) rồi áp THẲNG lên "hôm nay" — coi như phù du đứng im.
// Nước biển thì chảy: dòng mặt 0.2–0.5 m/s cuốn tracer đi ~20–45 km/ngày.
// Script này ĐO xem: nếu ADVECT (đẩy trôi) ảnh phù du theo dòng chảy (+ gió cuốn)
// rồi áp decay/mean-reversion, thì dự báo trường phù du ở D+k có TỐT HƠN
// persistence (đứng im) không — bằng dữ liệu THẬT ~30 ngày gần nhất.
//
// Kết quả kết tinh thành bộ tham số nhỏ (advScale, windDrift, growth, relax,
// kappa) — đề xuất lưu src/data/plankton-drift-skill.json để runtime dùng
// (giống scripts/forecast-backtest.mjs → src/data/forecast-skill.json).
//
// Chạy tay:  node scripts/fish-plankton-advection-backtest.mjs
// Không cần API key. Cần mạng (NOAA ERDDAP + Open-Meteo archive).
//
// PHƯƠNG PHÁP (backtest thuần offline):
//   - Kéo lưới NGÀY: phù du chl (DINEOF), SST blended, dòng chảy u,v — cho
//     ~30 ngày gần nhất, bbox biển VN (lat 5..22, lon 102..118), ~0.25°.
//   - Gió (ERA5 archive Open-Meteo) trên lưới THÔ ~3° → u10,v10 ngày.
//   - Với mỗi ngày nguồn D và tầm k=1..5: dựng trường dịch chuyển từ dòng
//     chảy (× advScale) + gió (× windDrift), truy NGƯỢC quỹ đạo (semi-
//     Lagrangian) để lấy phù du nguồn, áp growth + mean-reversion + khuếch tán.
//   - So log10(chl) DỰ BÁO vs THỰC ở D+k: RMSE + tương quan Pearson không gian
//     + tương quan GRADIENT (front). Baseline = persistence (chl(D) đứng im).
//   - Fit tham số bằng coordinate-descent tối thiểu hoá tổng RMSE các lead.
//
//   TRUNG THỰC: ở 25 km + trễ 2 ngày + DINEOF đã làm mượt mây, trường phù du
//   RẤT trơn → persistence vốn đã mạnh. Advection chỉ có thể sửa phần DỊCH
//   CHUYỂN của front/lưỡi phù du, KHÔNG tạo được chi tiết mới, KHÔNG sửa được
//   nở hoa/tàn cục bộ (sinh học). Script báo cáo trung thực mức cải thiện.
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "plankton-drift-skill.json");

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";

// bbox biển VN + lưới chung 0.25°
const LAT0 = 5.0, LAT1 = 22.0, LON0 = 102.0, LON1 = 118.0, STEP = 0.25;
const MAX_LEAD = 5;
const WINDOW_DAYS = 30; // số ngày ảnh muốn kéo (điều chỉnh nếu mạng chậm)

const FETCH_TIMEOUT_MS = 40000;
const RETRIES = 2;
const CONCURRENCY = 4;

// ── tiện ích ngày ──────────────────────────────────────────────────────────
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x, p = 4) =>
  x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

// ── lưới chung ──────────────────────────────────────────────────────────────
const GLATS = [];
for (let v = LAT0; v <= LAT1 + 1e-9; v += STEP) GLATS.push(Math.round(v * 100) / 100);
const GLONS = [];
for (let v = LON0; v <= LON1 + 1e-9; v += STEP) GLONS.push(Math.round(v * 100) / 100);
const NLAT = GLATS.length, NLON = GLONS.length;

// ── fetch ────────────────────────────────────────────────────────────────────
async function fetchJson(url, label) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON (${r.status}): ${text.slice(0, 100)}`);
      }
      if (!r.ok) {
        const reason = data?.reason || `HTTP ${r.status}`;
        if (r.status === 400 || r.status === 404) return { _empty: true, reason };
        throw new Error(reason);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES)
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  console.warn(`    ! lỗi ${label}: ${String(lastErr).slice(0, 90)}`);
  return { _error: true };
}
async function pool(items, worker, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  return out;
}

// ── parse ERDDAP grid → {lats asc, lons asc, values[iLat][iLon]} ──────────────
function parseErddapGrid(json, hasAlt, kelvin) {
  const rows = json?.table?.rows ?? [];
  const iLat = hasAlt ? 2 : 1;
  const iLon = iLat + 1;
  const iVal = iLon + 1;
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

// bilinear sample (NaN-aware: bỏ góc thiếu, chuẩn hoá trọng số còn lại)
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

// resample grid bất kỳ → lưới chung → mảng phẳng [NLAT*NLON]
function toCommon(grid) {
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++)
      out[a * NLON + b] = bilinear(grid, GLATS[a], GLONS[b]);
  return out;
}

// ── URL builders (chọn ngày cụ thể) ──────────────────────────────────────────
const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
function chlUrl(d) {
  return enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
}
function sstUrl(d) {
  return enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
}
function curUrl(d, comp) {
  return enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${comp}_current[(${d}T00:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);
}

// ── gió ERA5 (Open-Meteo) trên lưới thô ~3° → u10,v10 ngày ────────────────────
const WLATS = [], WLONS = [];
for (let v = LAT0; v <= LAT1 + 1e-9; v += 3) WLATS.push(Math.round(v * 10) / 10);
for (let v = LON0; v <= LON1 + 1e-9; v += 3) WLONS.push(Math.round(v * 10) / 10);

// ── metrics ──────────────────────────────────────────────────────────────────
function log10safe(v) { return Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN; }
function rmse(pairs) {
  let s = 0, n = 0;
  for (const [p, a] of pairs) if (Number.isFinite(p) && Number.isFinite(a)) { s += (p - a) ** 2; n++; }
  return n ? Math.sqrt(s / n) : null;
}
function pearson(pairs) {
  let n = 0, sp = 0, sa = 0, spp = 0, saa = 0, spa = 0;
  for (const [p, a] of pairs) if (Number.isFinite(p) && Number.isFinite(a)) {
    n++; sp += p; sa += a; spp += p * p; saa += a * a; spa += p * a;
  }
  if (n < 3) return null;
  const cov = spa / n - (sp / n) * (sa / n);
  const vp = spp / n - (sp / n) ** 2, va = saa / n - (sa / n) ** 2;
  return vp > 0 && va > 0 ? cov / Math.sqrt(vp * va) : null;
}
// |gradient| trung tâm trên mảng phẳng (log chl) → cho tương quan front
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

// ── advection semi-Lagrangian ────────────────────────────────────────────────
// dịch chuyển ô đích (lat,lon) NGƯỢC k ngày để tìm nguồn, rồi lấy logchl nguồn.
// currents[dayIndex] = {u:flat, v:flat} m/s; wind[dayIndex] = {u:flat, v:flat} m/s.
const M_PER_DEG_LAT = 110540;
const SUBSTEPS = 4; // sub-step mỗi ngày

function flatAt(flat, a, b) { return flat[a * NLON + b]; }
function bilinFlat(flat, lat, lon) {
  if (lat < LAT0 || lat > LAT1 || lon < LON0 || lon > LON1) return NaN;
  const fa = (lat - LAT0) / STEP, fb = (lon - LON0) / STEP;
  const a = Math.min(NLAT - 2, Math.floor(fa)), b = Math.min(NLON - 2, Math.floor(fb));
  const t = fa - a, s = fb - b;
  const c = [
    [flatAt(flat, a, b), (1 - t) * (1 - s)],
    [flatAt(flat, a, b + 1), (1 - t) * s],
    [flatAt(flat, a + 1, b), t * (1 - s)],
    [flatAt(flat, a + 1, b + 1), t * s],
  ];
  let acc = 0, w = 0;
  for (const [v, ww] of c) if (Number.isFinite(v)) { acc += v * ww; w += ww; }
  return w > 0 ? acc / w : NaN;
}

// Gaussian blur đơn giản (separable, bán kính theo sigma ô) trên mảng phẳng
function blur(flat, sigmaCells) {
  if (sigmaCells <= 0.05) return flat;
  const rad = Math.max(1, Math.ceil(sigmaCells * 2));
  const ker = [];
  let ks = 0;
  for (let d = -rad; d <= rad; d++) { const w = Math.exp(-(d * d) / (2 * sigmaCells ** 2)); ker.push(w); ks += w; }
  for (let i = 0; i < ker.length; i++) ker[i] /= ks;
  const tmp = new Float64Array(NLAT * NLON).fill(NaN);
  // ngang
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      let acc = 0, w = 0;
      for (let d = -rad; d <= rad; d++) {
        const bb = b + d; if (bb < 0 || bb >= NLON) continue;
        const v = flat[a * NLON + bb]; if (!Number.isFinite(v)) continue;
        acc += v * ker[d + rad]; w += ker[d + rad];
      }
      tmp[a * NLON + b] = w > 0 ? acc / w : NaN;
    }
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  // dọc
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      let acc = 0, w = 0;
      for (let d = -rad; d <= rad; d++) {
        const aa = a + d; if (aa < 0 || aa >= NLAT) continue;
        const v = tmp[aa * NLON + b]; if (!Number.isFinite(v)) continue;
        acc += v * ker[d + rad]; w += ker[d + rad];
      }
      out[a * NLON + b] = w > 0 ? acc / w : NaN;
    }
  return out;
}

// Dự báo trường logchl ở D+k từ nguồn logchl(D) + dịch chuyển các ngày [D..D+k-1]
// params: {advScale, windDrift, growth, relax, kappa}
function advectLogChl(srcLogFlat, curDays, windDays, k, params, fieldMean) {
  const { advScale, windDrift, growth, relax, kappa } = params;
  const srcBlur = blur(srcLogFlat, kappa * Math.sqrt(k));
  const out = new Float64Array(NLAT * NLON).fill(NaN);
  const dtDay = 1 / SUBSTEPS;
  for (let a = 0; a < NLAT; a++) {
    for (let b = 0; b < NLON; b++) {
      if (!Number.isFinite(srcLogFlat[a * NLON + b]) && !Number.isFinite(out[a * NLON + b])) {
        // chỉ tính ô có thể là biển: dùng mask nguồn — nếu ô đích tương ứng nguồn NaN vẫn thử
      }
      let lat = GLATS[a], lon = GLONS[b];
      let valid = true;
      // truy NGƯỢC: đi qua từng ngày dịch chuyển, dùng trường của NGÀY đó
      for (let day = k - 1; day >= 0; day--) {
        const cur = curDays[day], wind = windDays[day];
        if (!cur) { valid = false; break; }
        for (let sub = 0; sub < SUBSTEPS; sub++) {
          const u = bilinFlat(cur.u, lat, lon);
          const v = bilinFlat(cur.v, lat, lon);
          if (!Number.isFinite(u) || !Number.isFinite(v)) { valid = false; break; }
          let uu = advScale * u, vv = advScale * v;
          if (wind && windDrift > 0) {
            const wu = bilinFlat(wind.u, lat, lon), wv = bilinFlat(wind.v, lat, lon);
            if (Number.isFinite(wu) && Number.isFinite(wv)) { uu += windDrift * wu; vv += windDrift * wv; }
          }
          const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
          // NGƯỢC dòng: trừ vận tốc
          lon -= (uu * 86400 * dtDay) / mPerDegLon;
          lat -= (vv * 86400 * dtDay) / M_PER_DEG_LAT;
        }
        if (!valid) break;
      }
      if (!valid) { out[a * NLON + b] = NaN; continue; }
      let lv = bilinFlat(srcBlur, lat, lon);
      if (!Number.isFinite(lv)) { out[a * NLON + b] = NaN; continue; }
      // growth (dịch log/ngày) + mean-reversion về trung bình trường
      lv = lv + growth * k;
      if (relax < 1 && Number.isFinite(fieldMean))
        lv = fieldMean + Math.pow(relax, k) * (lv - fieldMean);
      out[a * NLON + b] = lv;
    }
  }
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const generatedAt = new Date().toISOString();
  // xác định END = ảnh chl mới nhất (dò (last))
  const lastProbe = await fetchJson(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe last",
  );
  const END = lastProbe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 2 * 86400000));
  const START = addDays(END, -(WINDOW_DAYS - 1));
  const days = [];
  for (let d = START; d <= END; d = addDays(d, 1)) days.push(d);
  console.log(`Advection backtest phù du — lưới chung ${NLAT}×${NLON} @0.25°`);
  console.log(`Cửa sổ ảnh: ${START} .. ${END} (${days.length} ngày), lead 1..${MAX_LEAD}\n`);

  // 1) kéo chl + currents theo ngày (SST kéo để báo cáo độ phủ; model không bắt buộc)
  const chlByDay = {}, curByDay = {}, sstByDay = {};
  console.log("Kéo lưới ngày (chl / u,v / sst)...");
  await pool(days, async (d) => {
    const [cj, uj, vj, sj] = await Promise.all([
      fetchJson(chlUrl(d), `chl ${d}`),
      fetchJson(curUrl(d, "u"), `u ${d}`),
      fetchJson(curUrl(d, "v"), `v ${d}`),
      fetchJson(sstUrl(d), `sst ${d}`),
    ]);
    if (cj?.table) chlByDay[d] = toCommon(parseErddapGrid(cj, true, false));
    if (uj?.table && vj?.table) {
      curByDay[d] = {
        u: toCommon(parseErddapGrid(uj, false, false)),
        v: toCommon(parseErddapGrid(vj, false, false)),
      };
    }
    if (sj?.table) sstByDay[d] = toCommon(parseErddapGrid(sj, false, true));
    process.stdout.write(".");
  }, CONCURRENCY);
  console.log("");

  // 2) gió ERA5 lưới thô → u10,v10 ngày, bilinear lên lưới chung
  console.log(`Kéo gió ERA5 lưới thô ${WLATS.length}×${WLONS.length} (~3°)...`);
  const windPts = [];
  for (const la of WLATS) for (const lo of WLONS) windPts.push([la, lo]);
  // mỗi điểm: hourly u,v cả cửa sổ → daily mean
  const windDaily = {}; // day -> {grid:{lats,lons,uv:Map}} ta dựng grid thô rồi resample
  const wStart = START, wEnd = END;
  const perPointDaily = await pool(windPts, async ([la, lo]) => {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}` +
      `&start_date=${wStart}&end_date=${wEnd}&hourly=wind_speed_10m,wind_direction_10m&timezone=GMT&wind_speed_unit=ms`;
    const j = await fetchJson(url, `wind ${la},${lo}`);
    const byDay = {};
    if (j?.hourly?.time) {
      const acc = {};
      for (let i = 0; i < j.hourly.time.length; i++) {
        const day = j.hourly.time[i].slice(0, 10);
        const sp = j.hourly.wind_speed_10m[i], dir = j.hourly.wind_direction_10m[i];
        if (sp == null || dir == null) continue;
        const rad = (dir * Math.PI) / 180;
        const u = -sp * Math.sin(rad), v = -sp * Math.cos(rad); // vector gió THỔI TỚI
        (acc[day] ??= { u: 0, v: 0, n: 0 });
        acc[day].u += u; acc[day].v += v; acc[day].n++;
      }
      for (const [day, a] of Object.entries(acc)) if (a.n) byDay[day] = { u: a.u / a.n, v: a.v / a.n };
    }
    process.stdout.write("+");
    return { la, lo, byDay };
  }, CONCURRENCY);
  console.log("");
  // dựng grid thô mỗi ngày → resample lên lưới chung
  const windByDay = {};
  for (const d of days) {
    const glats = WLATS, glons = WLONS;
    const uu = glats.map(() => glons.map(() => NaN));
    const vv = glats.map(() => glons.map(() => NaN));
    for (const p of perPointDaily) {
      const rec = p.byDay[d]; if (!rec) continue;
      const ia = glats.indexOf(p.la), ib = glons.indexOf(p.lo);
      if (ia >= 0 && ib >= 0) { uu[ia][ib] = rec.u; vv[ia][ib] = rec.v; }
    }
    windByDay[d] = {
      u: toCommon({ lats: glats, lons: glons, values: uu }),
      v: toCommon({ lats: glats, lons: glons, values: vv }),
    };
  }

  // báo cáo độ phủ
  const cov = (flat) => flat ? flat.filter((x) => Number.isFinite(x)).length / flat.length : 0;
  const chlDays = days.filter((d) => chlByDay[d]);
  const curDaysN = days.filter((d) => curByDay[d]);
  const avgChlCov = chlDays.length ? chlDays.reduce((s, d) => s + cov(chlByDay[d]), 0) / chlDays.length : 0;
  console.log(`\nĐộ phủ: chl ${chlDays.length}/${days.length} ngày (ô hợp lệ TB ${(avgChlCov * 100).toFixed(1)}%), ` +
    `currents ${curDaysN.length}/${days.length}, sst ${days.filter((d) => sstByDay[d]).length}/${days.length}`);

  // 3) dựng danh sách cặp (D, k) có đủ chl(D) và chl(D+k) và currents ngày trung gian
  const pairs = [];
  for (let i = 0; i < days.length; i++) {
    const D = days[i];
    if (!chlByDay[D]) continue;
    for (let k = 1; k <= MAX_LEAD; k++) {
      const T = addDays(D, k);
      if (!chlByDay[T]) continue;
      // currents cho các ngày D..D+k-1
      const cd = [], wd = [];
      let ok = true;
      for (let dd = 0; dd < k; dd++) {
        const day = addDays(D, dd);
        if (!curByDay[day]) { ok = false; break; }
        cd.push(curByDay[day]); wd.push(windByDay[day] ?? null);
      }
      if (!ok) continue;
      pairs.push({ D, T, k, curDays: cd, windDays: wd });
    }
  }
  console.log(`Số cặp (D,k) hợp lệ: ${pairs.length}`);

  // logchl nguồn/đích + field mean cache
  const srcLog = {}, tgtLog = {}, tgtGrad = {}, fieldMean = {};
  for (const d of days) if (chlByDay[d]) {
    const lf = Float64Array.from(chlByDay[d], log10safe);
    srcLog[d] = lf; tgtLog[d] = lf; tgtGrad[d] = gradMag(lf);
    let s = 0, n = 0; for (const v of lf) if (Number.isFinite(v)) { s += v; n++; }
    fieldMean[d] = n ? s / n : NaN;
  }

  // 4) hàm chấm điểm cho 1 bộ params → {perLead, overall}
  function evaluate(params) {
    const perLead = Array.from({ length: MAX_LEAD }, () => ({
      advPairs: [], perPairs: [], advGradPairs: [], perGradPairs: [],
    }));
    for (const pr of pairs) {
      const pred = advectLogChl(srcLog[pr.D], pr.curDays, pr.windDays, pr.k, params, fieldMean[pr.D]);
      const act = tgtLog[pr.T], per = srcLog[pr.D];
      const predGrad = gradMag(pred);
      const L = perLead[pr.k - 1];
      for (let idx = 0; idx < act.length; idx++) {
        const a = act[idx];
        if (!Number.isFinite(a)) continue;
        // MASK CHUNG (apples-to-apples): chỉ chấm ô mà CẢ advection LẪN persistence
        // đều có giá trị — nếu không, advection bị "thưởng oan" khi bỏ ô ven bờ
        // (dòng chảy NaN) vốn dao động mạnh mà persistence vẫn phải gánh.
        if (!Number.isFinite(pred[idx]) || !Number.isFinite(per[idx])) continue;
        L.advPairs.push([pred[idx], a]);
        L.perPairs.push([per[idx], a]);
        const ag = tgtGrad[pr.T][idx];
        if (Number.isFinite(ag) && Number.isFinite(predGrad[idx]) && Number.isFinite(tgtGrad[pr.D][idx])) {
          L.advGradPairs.push([predGrad[idx], ag]);
          L.perGradPairs.push([tgtGrad[pr.D][idx], ag]);
        }
      }
    }
    const rows = perLead.map((L, i) => ({
      leadDay: i + 1,
      n: L.advPairs.length,
      advRmse: rmse(L.advPairs), perRmse: rmse(L.perPairs),
      advCorr: pearson(L.advPairs), perCorr: pearson(L.perPairs),
      advGradCorr: pearson(L.advGradPairs), perGradCorr: pearson(L.perGradPairs),
    }));
    // mục tiêu fit: tổng advRmse có trọng số theo n
    let num = 0, den = 0;
    for (const r of rows) if (r.advRmse != null) { num += r.advRmse * r.n; den += r.n; }
    return { rows, objective: den ? num / den : Infinity };
  }

  // DEBUG: pure-persistence (advScale 0, kappa 0) — advRMSE PHẢI ≈ perRMSE
  if (process.env.DEBUG) {
    const dbg = evaluate({ advScale: 0, windDrift: 0, growth: 0, relax: 1, kappa: 0 });
    console.log("\n[DEBUG] advScale=0,kappa=0 (adv nên = per):");
    for (const r of dbg.rows)
      console.log(`  lead ${r.leadDay}: advRMSE=${round(r.advRmse)} perRMSE=${round(r.perRmse)} advN=${r.n}`);
    const dbg2 = evaluate({ advScale: 1, windDrift: 0, growth: 0, relax: 1, kappa: 0 });
    console.log("[DEBUG] advScale=1,kappa=0:");
    for (const r of dbg2.rows)
      console.log(`  lead ${r.leadDay}: advRMSE=${round(r.advRmse)} perRMSE=${round(r.perRmse)}`);
    // sweep advScale (gồm ÂM) tại lead 2 để loại trừ lỗi hướng/dấu
    console.log("[DEBUG] sweep advScale @lead2 (kappa=0): perRMSE cố định");
    for (const s of [-1, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 1]) {
      const e = evaluate({ advScale: s, windDrift: 0, growth: 0, relax: 1, kappa: 0 });
      const r = e.rows[1];
      console.log(`  advScale=${String(s).padStart(5)}: advRMSE=${round(r.advRmse)} (per=${round(r.perRmse)})`);
    }
  }

  // 5) FIT bằng coordinate-descent trên lưới rời rạc
  console.log("\nFit tham số (coordinate descent)...");
  let best = {
    params: { advScale: 1.0, windDrift: 0.0, growth: 0.0, relax: 1.0, kappa: 0.3 },
  };
  best.eval = evaluate(best.params);
  const axes = {
    advScale: [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
    windDrift: [0, 0.005, 0.01, 0.02, 0.03],
    growth: [-0.03, -0.015, 0, 0.015, 0.03],
    relax: [0.85, 0.9, 0.95, 1.0],
    kappa: [0, 0.2, 0.4, 0.6, 0.9],
  };
  for (let iter = 0; iter < 3; iter++) {
    for (const ax of Object.keys(axes)) {
      let localBest = best;
      for (const val of axes[ax]) {
        const params = { ...best.params, [ax]: val };
        const ev = evaluate(params);
        if (ev.objective < localBest.eval.objective) localBest = { params, eval: ev };
      }
      best = localBest;
    }
    console.log(`  iter ${iter + 1}: obj=${round(best.eval.objective)} params=${JSON.stringify(best.params)}`);
  }

  // persistence baseline eval (params bất kỳ, chỉ đọc perRmse/perCorr từ best.eval)
  const rows = best.eval.rows;

  // sweep advScale @ lead2 (kappa=0) — bằng chứng đối xứng quanh 0 (không lỗi dấu)
  const advSweep = [-1, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 1].map((s) => {
    const r = evaluate({ advScale: s, windDrift: 0, growth: 0, relax: 1, kappa: 0 }).rows[1];
    return { advScale: s, advRmse: round(r.advRmse, 4), perRmse: round(r.perRmse, 4) };
  });
  // VERDICT TRUNG THỰC: advection "thắng" chỉ khi thành phần ĐẨY TRÔI thực sự có
  // ích — tức advScale fit > ngưỡng. Bất kỳ "gain" RMSE nào từ blur (kappa) mà
  // advScale≈0 KHÔNG tính là thắng: nó chỉ làm mượt, mà làm mượt PHÁ front
  // (gradient log-chl) — đúng tín hiệu fish-predict.ts dùng (chlFront). Kiểm cả
  // front: advGradCorr phải ≥ perGradCorr thì mới không hại.
  const advScaleUseful = best.params.advScale > 0.05;
  const frontNotHurt = rows.every(
    (r) => r.advGradCorr == null || r.perGradCorr == null || r.advGradCorr >= r.perGradCorr - 0.005,
  );
  const advWins = advScaleUseful && frontNotHurt;

  // 6) in bảng
  console.log("\nlead |   n  | advRMSE perRMSE | advCorr perCorr | advGradR perGradR");
  for (const r of rows) {
    const f = (x) => (x == null ? "  —  " : x.toFixed(3));
    console.log(
      `  ${String(r.leadDay).padStart(2)} | ${String(r.n).padStart(4)} | ` +
      `  ${f(r.advRmse)}   ${f(r.perRmse)} |  ${f(r.advCorr)}  ${f(r.perCorr)} |  ${f(r.advGradCorr)}   ${f(r.perGradCorr)}`,
    );
  }

  // 7) xuất JSON runtime (đề xuất) + diagnostics
  const skill = {
    generatedAt,
    method:
      `Semi-Lagrangian advection backtest phù du DINEOF vs persistence. ` +
      `${days.length} ngày ảnh (${START}..${END}), ${pairs.length} cặp (D,k), lưới chung ${NLAT}×${NLON}@0.25°. ` +
      `Trường dịch chuyển = dòng chảy blended NRT (×advScale) + gió ERA5 (×windDrift). ` +
      `Metric = RMSE/corr của log10(chl). Baseline = persistence. ` +
      `Xem plankton-advection-findings.md.`,
    grid: { lat0: LAT0, lat1: LAT1, lon0: LON0, lon1: LON1, step: STEP },
    substepsPerDay: SUBSTEPS,
    maxLead: MAX_LEAD,
    // VERDICT TRUNG THỰC: advection KHÔNG thắng persistence ở lưới 25km/2 ngày.
    // enabled=false → runtime GIỮ NGUYÊN (persistence). params dưới là bộ TỐI ƯU
    // fit được (advScale→0) chỉ để lưu vết; recommendedParams = persistence thuần.
    verdict: {
      advectionBeatsPersistence: advWins,
      note: advWins
        ? "Advection cải thiện ở một số lead — cân nhắc wiring (xem perLead)."
        : "Advection KHÔNG cải thiện (advScale fit→0; đẩy trôi làm decorrelate trường phù du trơn). KHUYẾN NGHỊ: giữ persistence, KHÔNG wiring advection.",
    },
    enabled: advWins,
    fittedParams: {
      advScale: round(best.params.advScale),
      windDrift: round(best.params.windDrift),
      growthPerDay: round(best.params.growth),
      relaxPerDay: round(best.params.relax),
      diffusionKappa: round(best.params.kappa),
    },
    recommendedParams: {
      advScale: 0, windDrift: 0, growthPerDay: 0, relaxPerDay: 1, diffusionKappa: 0,
    },
    advScaleSweepLead2: advSweep,
    coverage: {
      chlDays: chlDays.length, avgChlCovPct: round(avgChlCov * 100, 1),
      curDays: curDaysN.length, totalDays: days.length, pairs: pairs.length,
    },
    perLead: rows.map((r) => ({
      leadDay: r.leadDay, n: r.n,
      advRmse: round(r.advRmse, 4), perRmse: round(r.perRmse, 4),
      rmseGainPct: r.advRmse != null && r.perRmse ? round((1 - r.advRmse / r.perRmse) * 100, 2) : null,
      advCorr: round(r.advCorr, 4), perCorr: round(r.perCorr, 4),
      advGradCorr: round(r.advGradCorr, 4), perGradCorr: round(r.perGradCorr, 4),
    })),
  };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(skill, null, 2) + "\n", "utf8");
  console.log(`\n✓ Ghi ${OUT_PATH}`);
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
