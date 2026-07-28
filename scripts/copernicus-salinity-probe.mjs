// scripts/copernicus-salinity-probe.mjs
// ─────────────────────────────────────────────────────────────────────────
// KIỂM CHỨNG THẬT nguồn ĐỘ MẶN Copernicus (so) — theo luật repo "fetch thử
// thật trước khi thêm nguồn Copernicus" (kiểm ĐƠN VỊ + endpoint Zarr).
//
// Dataset: GLOBAL_ANALYSISFORECAST_PHY_001_024 /
//   cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m_202406, asset downsampled4 (1/3°).
// so: shape [time, elevation, lat, lon], chunk [1,1,511,1080] = 1 chunk/tầng/mốc,
//   dtype <f4 (giải mã y hệt dòng chảy), units "1e-3" = PSU (0..50).
//
// Chạy:  node scripts/copernicus-salinity-probe.mjs
// Không key, cần mạng, KHÔNG ghi vào src/.
// ─────────────────────────────────────────────────────────────────────────

import {
  decodeFloat32Chunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
  nearestIndex,
} from "../src/lib/copernicus.ts";

const UA = "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const BASE =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-010/arco/" +
  "GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
  "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m_202406/downsampled4.zarr";
const TIMEOUT = 60000;
const VN = { lat0: 5, lat1: 22, lon0: 102, lon1: 118 };

const POINTS = [
  ["Cửa sông Hậu (gần bờ)", 9.3, 106.2],
  ["Ngoài khơi Đà Nẵng", 16.0, 110.0],
  ["Đông Nha Trang", 12.5, 111.5],
  ["Trường Sa (bắc)", 10.5, 114.0],
  ["Vịnh Bắc Bộ", 19.5, 107.5],
  ["Giữa Biển Đông", 14.0, 113.0],
];

const opt = { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

async function getChunk(path) {
  const r = await fetch(`${BASE}/${path}`, opt);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
  return decodeFloat32Chunk(new Uint8Array(await r.arrayBuffer()));
}

/** đọc trục f4 gồm nhiều chunk (chunkLen) → mảng đủ length */
async function readAxis(name, meta) {
  const len = meta.shape[0];
  const cl = meta.chunks[0];
  const nC = Math.ceil(len / cl);
  const out = new Float32Array(len);
  for (let c = 0; c < nC; c++) {
    const chunk = await getChunk(`${name}/${c}`);
    for (let k = 0; k < cl && c * cl + k < len; k++) out[c * cl + k] = chunk[k];
  }
  return Array.from(out);
}

const t0 = Date.now();
console.log("Đang đọc .zmetadata độ mặn (so)…");
const zmeta = await (await fetch(`${BASE}/.zmetadata`, opt)).json();

const soMeta = readZarrArrayMeta(zmeta, "so");
const latMeta = readZarrArrayMeta(zmeta, "latitude");
const lonMeta = readZarrArrayMeta(zmeta, "longitude");
const timeMeta = readZarrArrayMeta(zmeta, "time");
const elevMeta = readZarrArrayMeta(zmeta, "elevation");
if (!soMeta || !latMeta || !lonMeta || !timeMeta || !elevMeta) {
  console.error("✗ thiếu mảng meta", { soMeta: !!soMeta, elevMeta: !!elevMeta });
  process.exit(1);
}

const units = readZarrAttr(zmeta, "so", "units");
const stdName = readZarrAttr(zmeta, "so", "standard_name");
const unitLong = readZarrAttr(zmeta, "so", "unit_long");
console.log(
  `  so: dtype ${soMeta.dtype}  shape [${soMeta.shape}]  chunks [${soMeta.chunks}]` +
    `  fill ${soMeta.fillValue}`,
);
console.log(`  ➜ ĐƠN VỊ: units="${units}"  standard_name="${stdName}"  (${unitLong})`);

const timeUnits = readZarrAttr(zmeta, "time", "units");
const cf = parseCfTimeUnits(String(timeUnits));

const [lats, lons, times, elev] = await Promise.all([
  readAxis("latitude", latMeta),
  readAxis("longitude", lonMeta),
  readAxis("time", timeMeta),
  readAxis("elevation", elevMeta),
]);
console.log(
  `  trục: lat ${lats.length} [${lats[0].toFixed(2)}..${lats[lats.length - 1].toFixed(2)}]` +
    `  lon ${lons.length} [${lons[0].toFixed(2)}..${lons[lons.length - 1].toFixed(2)}]` +
    `  time ${times.length}  elevation ${elev.length}`,
);
// elevation giảm dần (sâu→mặt) → tầng MẶT = |elev| nhỏ nhất
let di = 0;
for (let k = 1; k < elev.length; k++) if (Math.abs(elev[k]) < Math.abs(elev[di])) di = k;
console.log(`  tầng mặt: elevation[${di}] = ${elev[di].toFixed(2)} m`);

// mốc gần bây giờ + tầm dự báo
const nowUnits = (Date.now() - cf.epochMs) / cf.msPerUnit;
const ti = nearestIndex(times, nowUnits);
const pickedMs = cfTimeToMs(times[ti], cf);
const lastMs = cfTimeToMs(times[times.length - 1], cf);
const leadDays = (lastMs - Date.now()) / 86400000;
console.log(
  `  mốc gần nay: ti=${ti}  ${new Date(pickedMs).toISOString().slice(0, 10)}` +
    `  | mốc CUỐI cùng ${new Date(lastMs).toISOString().slice(0, 10)} → dự báo tới +${leadDays.toFixed(1)} ngày`,
);

// tải chunk so tại (ti, elevation 0) — lat/lon một chunk nên key ...0.0
console.log("\nĐang tải chunk độ mặn tầng mặt cho mốc gần nay…");
const tGet = Date.now();
const r = await fetch(`${BASE}/so/${ti}.${di}.0.0`, opt);
const rawBuf = new Uint8Array(await r.arrayBuffer());
const flat = decodeFloat32Chunk(rawBuf);
console.log(
  `  ✓ chunk ${(rawBuf.byteLength / 1024).toFixed(0)} KB nén → ${flat.length} ô` +
    `  trong ${((Date.now() - tGet) / 1000).toFixed(1)}s`,
);

const nLat = latMeta.shape[0];
const nLon = lonMeta.shape[0];
const val = (i, j) => flat[i * nLon + j];
const isFill = (v) => !Number.isFinite(v) || Math.abs(v) > 1e30 || v < 0 || v > 60;

// cắt hộp VN → thống kê
const box = [];
for (let i = 0; i < nLat; i++) {
  if (lats[i] < VN.lat0 || lats[i] > VN.lat1) continue;
  for (let j = 0; j < nLon; j++) {
    const lon = lons[j] < 0 ? lons[j] + 360 : lons[j];
    if (lon < VN.lon0 || lon > VN.lon1) continue;
    const v = val(i, j);
    if (!isFill(v)) box.push(v);
  }
}
console.log("\n──────── ĐỘ MẶN HỘP BIỂN VN (tầng mặt, PSU) ────────");
console.log(
  `  ô biển có số: ${box.length}` +
    `  | min ${Math.min(...box).toFixed(2)}  p05 ${pct(box, 5).toFixed(2)}` +
    `  TB ${mean(box).toFixed(2)}  p95 ${pct(box, 95).toFixed(2)}  max ${Math.max(...box).toFixed(2)}`,
);

const at = (lat, lon) => {
  let bi = 0, bj = 0;
  for (let i = 1; i < nLat; i++) if (Math.abs(lats[i] - lat) < Math.abs(lats[bi] - lat)) bi = i;
  const lonE = lon;
  for (let j = 1; j < nLon; j++) {
    const a = lons[j] < 0 ? lons[j] + 360 : lons[j];
    const b = lons[bj] < 0 ? lons[bj] + 360 : lons[bj];
    if (Math.abs(a - lonE) < Math.abs(b - lonE)) bj = j;
  }
  return val(bi, bj);
};
console.log("\n──────── ĐỘ MẶN TẠI VÀI ĐIỂM ────────");
for (const [name, lat, lon] of POINTS) {
  const v = at(lat, lon);
  console.log(`  ${`${name} ${lat}N ${lon}E`.padEnd(34)} ${isFill(v) ? "— (đất/thiếu)" : v.toFixed(2) + " PSU"}`);
}
console.log(`\nTổng thời gian: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
