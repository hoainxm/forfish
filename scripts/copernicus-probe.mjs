// scripts/copernicus-probe.mjs
// ─────────────────────────────────────────────────────────────────────────
// KIỂM CHỨNG THẬT nguồn dòng chảy Copernicus Marine ARCO (Zarr) cho Trục 1.
//
// CÂU HỎI CHÍNH (quyết định có đổi nguồn dòng chảy hay không):
//   `convergenceStrength()` trong src/lib/fish-predict.ts chấm "nước dồn" bằng
//   -(∂u/∂x + ∂v/∂y). Nguồn ĐANG dùng là NOAA blended currents — dòng ĐỊA CHUYỂN
//   suy từ độ cao mặt biển, mà dòng địa chuyển VỀ MẶT TOÁN HỌC gần như KHÔNG
//   phân kỳ. Nếu đúng vậy thì yếu tố "hội tụ" hiện đang chấm NHIỄU.
//   Copernicus `utotal/vtotal` = dòng TỔNG (Eulerian + sóng + triều) — phải CÓ
//   phân kỳ thật.
//
// ĐO GÌ (cùng ngày, cùng hộp biển VN 5–22°N / 102–118°E):
//   1. Giá trị dòng chảy tại vài điểm Biển Đông (độ lớn + hướng) của hai nguồn.
//   2. PHÂN KỲ VẬT LÝ  D = ∂u/∂x + ∂v/∂y  (đơn vị 1e-6 s⁻¹, có quy đổi mét
//      theo vĩ độ) — phân bố |D| và RMS.
//   3. TỈ SỐ RMS(D)/RMS(ζ) với ζ = ∂v/∂x − ∂u/∂y (xoáy). Đây là thước đo
//      CHUẨN HOÁ, không phụ thuộc bước lưới: trường địa chuyển lý tưởng có
//      D ≡ 0 nên tỉ số ≈ 0; trường tổng thật phải cho tỉ số O(0,1–1).
//   4. `convergenceStrength()` (copy y hệt lõi app, full = 0.1) — xem chính
//      con số mà mô hình đang ăn: bao nhiêu ô > 0, trung bình, phân vị.
//
// Chạy:  node scripts/copernicus-probe.mjs
// Không cần API key (cả hai nguồn công khai). Cần mạng. KHÔNG ghi vào src/.
// ─────────────────────────────────────────────────────────────────────────

import { fetchCopernicusCurrents } from "../src/lib/copernicus.ts";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const R_EARTH = 6371000;
const TIMEOUT_MS = 60000;

/* ---------- NOAA blended currents (nguồn ĐANG dùng) ---------- */

function noaaUrl(comp) {
  return `${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${comp}_current%5B(last)%5D%5B(5.0):1:(22.0)%5D%5B(102.0):1:(118.0)%5D`;
}

/** Bảng ERDDAP .json → lưới (copy công thức parseErddapGrid, hasAltitude:false) */
function parseErddapGrid(json) {
  const rows = json?.table?.rows ?? [];
  const latSet = new Set();
  const lonSet = new Set();
  for (const r of rows) {
    latSet.add(r[1]);
    lonSet.add(r[2]);
  }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  const li = new Map(lats.map((v, i) => [v, i]));
  const oi = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  let date = "";
  for (const r of rows) {
    if (!date && typeof r[0] === "string") date = r[0].slice(0, 10);
    const v = r[3];
    if (typeof v === "number" && Number.isFinite(v)) values[li.get(r[1])][oi.get(r[2])] = v;
  }
  return { lats, lons, values, date };
}

async function fetchNoaaCurrents() {
  const opt = { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": UA } };
  const [ru, rv] = await Promise.all([
    fetch(noaaUrl("u"), opt),
    fetch(noaaUrl("v"), opt),
  ]);
  if (!ru.ok || !rv.ok) throw new Error(`NOAA HTTP ${ru.status}/${rv.status}`);
  const u = parseErddapGrid(await ru.json());
  const v = parseErddapGrid(await rv.json());
  return { u, v };
}

/* ---------- Toán chung ---------- */

/** copy Y HỆT convergenceStrength() của src/lib/fish-predict.ts */
function convergenceStrength(u, v, full) {
  const H = u.length;
  const W = H ? u[0].length : 0;
  const out = u.map((row) => row.map(() => 0));
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      if (!Number.isFinite(u[i][j]) || !Number.isFinite(v[i][j])) continue;
      const rt = j + 1 < W ? u[i][j + 1] : NaN;
      const lf = j - 1 >= 0 ? u[i][j - 1] : NaN;
      const up = i + 1 < H ? v[i + 1][j] : NaN;
      const dn = i - 1 >= 0 ? v[i - 1][j] : NaN;
      const dudx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      const dvdy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      out[i][j] = Math.min(1, Math.max(0, -(dudx + dvdy) / full));
    }
  }
  return out;
}

/**
 * Phân kỳ D = ∂u/∂x + ∂v/∂y và xoáy ζ = ∂v/∂x − ∂u/∂y ở đơn vị VẬT LÝ (s⁻¹),
 * sai phân giữa, quy đổi độ → mét theo vĩ độ. Ô thiếu láng giềng → NaN.
 */
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
 * TỰ TƯƠNG QUAN KHÔNG GIAN trễ-1 ô của một trường (trung bình theo 2 chiều).
 * NHIỄU số học → ≈ 0 (thậm chí ÂM vì sai phân giữa tạo dao động răng cưa);
 * cấu trúc VẬT LÝ thật (dải nước dồn, front) → dương rõ. Đây là phép thử
 * "tín hiệu hay nhiễu" KHÔNG phụ thuộc đơn vị hay bước lưới.
 */
function lag1Autocorr(f) {
  const pairs = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < f[i].length; j++) {
      const a = f[i][j];
      if (!Number.isFinite(a)) continue;
      if (j + 1 < f[i].length && Number.isFinite(f[i][j + 1])) pairs.push([a, f[i][j + 1]]);
      if (i + 1 < f.length && Number.isFinite(f[i + 1][j])) pairs.push([a, f[i + 1][j]]);
    }
  }
  if (pairs.length < 10) return NaN;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

const flat = (g) => g.flat().filter(Number.isFinite);
const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : NaN);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
function pct(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

/** Giá trị lưới tại điểm gần (lat, lon) nhất */
function at(grid, lat, lon) {
  let bi = 0;
  let bj = 0;
  for (let i = 1; i < grid.lats.length; i++) {
    if (Math.abs(grid.lats[i] - lat) < Math.abs(grid.lats[bi] - lat)) bi = i;
  }
  for (let j = 1; j < grid.lons.length; j++) {
    if (Math.abs(grid.lons[j] - lon) < Math.abs(grid.lons[bj] - lon)) bj = j;
  }
  return { v: grid.values[bi][bj], lat: grid.lats[bi], lon: grid.lons[bj] };
}

const dirDeg = (u, v) => ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360; // hướng CHẢY TỚI, 0=Bắc

const POINTS = [
  ["Ngoài khơi Đà Nẵng", 16.0, 110.0],
  ["Đông Nha Trang", 12.5, 111.5],
  ["Trường Sa (bắc)", 10.5, 114.0],
  ["Vịnh Bắc Bộ", 19.5, 107.5],
  ["Nam Côn Đảo", 8.0, 107.0],
  ["Giữa Biển Đông", 14.0, 113.0],
];

/* ---------- Chạy ---------- */

function report(name, g) {
  const { div, curl } = divCurlPhysical(g.u.values, g.v.values, g.u.lats, g.u.lons);
  const D = flat(div).map((x) => x * 1e6); // 1e-6 s⁻¹
  const Z = flat(curl).map((x) => x * 1e6);
  const conv = flat(convergenceStrength(g.u.values, g.v.values, 0.1));
  const speeds = [];
  for (let i = 0; i < g.u.lats.length; i++) {
    for (let j = 0; j < g.u.lons.length; j++) {
      const a = g.u.values[i][j];
      const b = g.v.values[i][j];
      if (Number.isFinite(a) && Number.isFinite(b)) speeds.push(Math.hypot(a, b));
    }
  }
  const rmsD = rms(D);
  const rmsZ = rms(Z);
  console.log(`\n=== ${name} ===`);
  console.log(
    `  lưới ${g.u.lats.length}×${g.u.lons.length}` +
      `  bước ${(g.u.lats[1] - g.u.lats[0]).toFixed(4)}°` +
      `  ô có số: ${speeds.length}`,
  );
  console.log(
    `  tốc độ |V| (m/s): TB ${mean(speeds).toFixed(3)}` +
      `  p50 ${pct(speeds, 50).toFixed(3)}  p95 ${pct(speeds, 95).toFixed(3)}` +
      `  max ${Math.max(...speeds).toFixed(3)}`,
  );
  console.log(
    `  PHÂN KỲ D (1e-6 s⁻¹): RMS ${rmsD.toFixed(3)}` +
      `  |D| p50 ${pct(D.map(Math.abs), 50).toFixed(3)}` +
      `  p95 ${pct(D.map(Math.abs), 95).toFixed(3)}` +
      `  max ${Math.max(...D.map(Math.abs)).toFixed(3)}`,
  );
  console.log(`  XOÁY  ζ (1e-6 s⁻¹): RMS ${rmsZ.toFixed(3)}`);
  const ac = lag1Autocorr(div);
  console.log(
    `  ➜ TỈ SỐ RMS(D)/RMS(ζ) = ${(rmsD / rmsZ).toFixed(4)}` +
      `   ${rmsD / rmsZ < 0.15 ? "(≈0 → trường gần như KHÔNG phân kỳ)" : "(có phân kỳ đáng kể)"}`,
  );
  console.log(
    `  ➜ TỰ TƯƠNG QUAN không gian của D (trễ 1 ô) = ${ac.toFixed(3)}` +
      `   ${ac < 0.2 ? "← NHIỄU răng cưa, KHÔNG có cấu trúc" : "← có CẤU TRÚC không gian thật"}`,
  );
  const nz = conv.filter((x) => x > 0);
  console.log(
    `  convergenceStrength(full=0.1): ô > 0: ${nz.length}/${conv.length}` +
      ` (${((100 * nz.length) / conv.length).toFixed(1)}%)  TB ${mean(conv).toFixed(4)}` +
      `  p95 ${pct(conv, 95).toFixed(4)}  max ${Math.max(...conv).toFixed(4)}`,
  );
  return { rmsD, rmsZ, ratio: rmsD / rmsZ, autocorr: lag1Autocorr(div) };
}

const t0 = Date.now();
console.log("Đang tải Copernicus ARCO (Zarr)…");
const cop = await fetchCopernicusCurrents();
const tCop = Date.now() - t0;
if (!cop) {
  console.error("✗ Copernicus trả null — xem lại mạng/kho ARCO");
  process.exit(1);
}
console.log(
  `✓ Copernicus OK sau ${(tCop / 1000).toFixed(1)}s` +
    `  | mốc ${cop.timeISO} (${cop.forecast ? "DỰ BÁO tương lai" : "quá khứ/hiện tại"})` +
    `  | dữ liệu chunk ${(cop.bytes / 1024).toFixed(0)} KB`,
);

const t1 = Date.now();
console.log("Đang tải NOAA blended currents…");
const noaa = await fetchNoaaCurrents();
console.log(
  `✓ NOAA OK sau ${((Date.now() - t1) / 1000).toFixed(1)}s  | ngày ${noaa.u.date}`,
);

console.log("\n──────── GIÁ TRỊ TẠI VÀI ĐIỂM BIỂN ĐÔNG ────────");
console.log(
  "điểm".padEnd(30) +
    "COPERNICUS tổng".padEnd(30) +
    "NOAA địa chuyển".padEnd(30),
);
for (const [name, lat, lon] of POINTS) {
  const cu = at(cop.u, lat, lon).v;
  const cv = at(cop.v, lat, lon).v;
  const nu = at(noaa.u, lat, lon).v;
  const nv = at(noaa.v, lat, lon).v;
  const fmt = (u, v) =>
    Number.isFinite(u) && Number.isFinite(v)
      ? `${Math.hypot(u, v).toFixed(3)} m/s → ${dirDeg(u, v).toFixed(0)}°`.padEnd(30)
      : "— (đất/thiếu)".padEnd(30);
  console.log(`${(`${name} ${lat}N ${lon}E`).padEnd(30)}${fmt(cu, cv)}${fmt(nu, nv)}`);
}

// ĐỐI CHỨNG THỨ BA: cùng mô hình, cùng lưới, cùng mốc giờ — nhưng dòng EULERIAN
// thuần (uo/vo, KHÔNG cộng sóng Stokes + triều). Nếu utotal phân kỳ hơn hẳn uo
// thì phần "hội tụ có nghĩa" đúng là do sóng + triều mang lại, chứ không phải do
// Copernicus dùng lưới khác NOAA.
console.log("\nĐang tải Copernicus uo/vo (Eulerian thuần) để đối chứng…");
const copEul = await fetchCopernicusCurrents({
  at: new Date(cop.timeISO),
  variables: { u: "uo", v: "vo" },
});

console.log("\n──────── SO PHÂN KỲ ────────");
const rc = report("COPERNICUS utotal/vtotal (dòng TỔNG, 1/3°)", cop);
const re = copEul
  ? report("COPERNICUS uo/vo (Eulerian thuần, 1/3°) — đối chứng", copEul)
  : null;
const rn = report("NOAA blended currents (ĐỊA CHUYỂN, 0.25°)", noaa);

console.log("\n──────── KẾT LUẬN ────────");
console.log(
  `RMS(D)/RMS(ζ):    tổng ${rc.ratio.toFixed(4)}` +
    (re ? `  |  Eulerian ${re.ratio.toFixed(4)}` : "") +
    `  |  NOAA địa chuyển ${rn.ratio.toFixed(4)}` +
    `   → dòng TỔNG phân kỳ gấp ${(rc.ratio / rn.ratio).toFixed(1)}× NOAA`,
);
console.log(
  `Tự tương quan D:  tổng ${rc.autocorr.toFixed(3)}` +
    (re ? `  |  Eulerian ${re.autocorr.toFixed(3)}` : "") +
    `  |  NOAA địa chuyển ${rn.autocorr.toFixed(3)}`,
);
console.log(
  `   → ${rn.autocorr < 0.2 ? "phân kỳ NOAA KHÔNG có cấu trúc không gian ⇒ convergenceStrength đang chấm NHIỄU" : "phân kỳ NOAA vẫn có cấu trúc"}` +
    `; ${rc.autocorr >= 0.2 ? "phân kỳ Copernicus CÓ cấu trúc thật" : "phân kỳ Copernicus cũng nhiễu"}`,
);
console.log(
  `RMS(D) thô:       Copernicus ${rc.rmsD.toFixed(3)}  vs  NOAA ${rn.rmsD.toFixed(3)} (1e-6 s⁻¹)`,
);
console.log(`Tổng thời gian: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
