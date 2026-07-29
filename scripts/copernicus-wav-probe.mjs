// scripts/copernicus-wav-probe.mjs
// ─────────────────────────────────────────────────────────────────────────
// KIỂM CHỨNG THẬT nguồn SÓNG DỰ PHÒNG Copernicus WAV (VHM0/VMDR) — luật repo
// "fetch thử thật trước khi thêm nguồn" (kiểm ĐƠN VỊ + QUY ƯỚC HƯỚNG + tầm
// dự báo + chi phí chunk).
//
// Dataset: GLOBAL_ANALYSISFORECAST_WAV_001_027 /
//   cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411, asset downsampled4 (1/3°).
// VHM0 = sig. wave height (m) · VMDR = mean wave direction (độ, "TỚI TỪ" theo
// chuẩn khí tượng — probe đối chiếu với Open-Meteo cùng toạ độ để xác nhận).
//
// Chạy:  npx tsx scripts/copernicus-wav-probe.mjs
// Không key, cần mạng, KHÔNG ghi vào src/.
// ─────────────────────────────────────────────────────────────────────────

import {
  bloscDecompress,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
} from "../src/lib/copernicus.ts";

/** Giải mã chunk theo dtype thật của mảng (downsampled4 WAV đóng gói <i2 +
    scale_factor — KHÔNG như <f4 của độ mặn; time là <i4). */
function decodeTyped(raw, dtype) {
  const b = bloscDecompress(raw);
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  if (dtype === "<f4") return new Float32Array(buf);
  if (dtype === "<f8") return new Float64Array(buf);
  if (dtype === "<i2") return new Int16Array(buf);
  if (dtype === "<i4") return new Int32Array(buf);
  if (dtype === "<i8") return new BigInt64Array(buf);
  throw new Error(`dtype lạ: ${dtype}`);
}

const UA = "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const BASE =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-015/arco/" +
  "GLOBAL_ANALYSISFORECAST_WAV_001_027/" +
  "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411/downsampled4.zarr";
const TIMEOUT = 60000;

const opt = { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) };

let bytes = 0;
async function getRaw(path) {
  const r = await fetch(`${BASE}/${path}`, opt);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  bytes += buf.length;
  return buf;
}
async function readAxis(name, meta) {
  const len = meta.shape[0];
  const cl = meta.chunks[0];
  const out = new Array(len);
  for (let c = 0; c < Math.ceil(len / cl); c++) {
    const chunk = decodeTyped(await getRaw(`${name}/${c}`), meta.dtype);
    for (let k = 0; k < cl && c * cl + k < len; k++)
      out[c * cl + k] = Number(chunk[k]);
  }
  return out;
}

const t0 = Date.now();
console.log("Đang đọc .zmetadata WAV…");
const zmeta = await (await fetch(`${BASE}/.zmetadata`, opt)).json();

for (const name of ["VHM0", "VMDR"]) {
  const m = readZarrArrayMeta(zmeta, name);
  console.log(
    name,
    "shape", JSON.stringify(m?.shape),
    "chunks", JSON.stringify(m?.chunks),
    "dtype", m?.dtype,
    "units", readZarrAttr(zmeta, name, "units"),
    "scale", readZarrAttr(zmeta, name, "scale_factor"),
    "offset", readZarrAttr(zmeta, name, "add_offset"),
    "fill", readZarrAttr(zmeta, name, "_FillValue"),
  );
}
console.log("time dtype:", readZarrArrayMeta(zmeta, "time")?.dtype, "units:", readZarrAttr(zmeta, "time", "units"));

const latMeta = readZarrArrayMeta(zmeta, "latitude");
const lonMeta = readZarrArrayMeta(zmeta, "longitude");
const timeMeta = readZarrArrayMeta(zmeta, "time");
const cf = parseCfTimeUnits(readZarrAttr(zmeta, "time", "units"));

const [lats, lons, times] = await Promise.all([
  readAxis("latitude", latMeta),
  readAxis("longitude", lonMeta),
  readAxis("time", timeMeta),
]);
const lastMs = cfTimeToMs(times[times.length - 1], cf);
const firstMs = cfTimeToMs(times[0], cf);
console.log("time:", times.length, "mốc ·", new Date(firstMs).toISOString(), "→", new Date(lastMs).toISOString());
console.log("tầm dự báo còn lại:", ((lastMs - Date.now()) / 86400000).toFixed(1), "ngày · bước", ((cfTimeToMs(times[1], cf) - firstMs) / 3600000).toFixed(0), "giờ");

// lấy mốc gần BÂY GIỜ + đọc 2 chunk (VHM0 + VMDR) đo chi phí thật
let ti = 0;
for (let i = 0; i < times.length; i++) if (cfTimeToMs(times[i], cf) <= Date.now()) ti = i;
console.log("mốc chọn:", new Date(cfTimeToMs(times[ti], cf)).toISOString());

const nLon = lonMeta.shape[0];
const b0 = bytes;
const scaleOf = (n) => Number(readZarrAttr(zmeta, n, "scale_factor") ?? 1);
const offsetOf = (n) => Number(readZarrAttr(zmeta, n, "add_offset") ?? 0);
const fillOf = (n) => Number(readZarrAttr(zmeta, n, "_FillValue") ?? NaN);
const loadVar = async (n) => {
  const raw = decodeTyped(await getRaw(`${n}/${ti}.0.0`), readZarrArrayMeta(zmeta, n).dtype);
  const s = scaleOf(n), o = offsetOf(n), f = fillOf(n);
  return { at: (idx) => (raw[idx] === f ? null : raw[idx] * s + o) };
};
const [hFlat, dFlat] = await Promise.all([loadVar("VHM0"), loadVar("VMDR")]);
console.log("2 chunk dữ liệu:", ((bytes - b0) / 1024).toFixed(0), "KB");

// so với Open-Meteo cùng điểm 12.5N 111.0E (kiểm đơn vị + QUY ƯỚC HƯỚNG)
const pick = (lat, lon) => {
  let bi = 0, bj = 0;
  for (let i = 1; i < lats.length; i++) if (Math.abs(lats[i] - lat) < Math.abs(lats[bi] - lat)) bi = i;
  for (let j = 1; j < lons.length; j++) if (Math.abs(lons[j] - lon) < Math.abs(lons[bj] - lon)) bj = j;
  const idx = bi * nLon + bj;
  return { h: hFlat.at(idx), d: dFlat.at(idx) };
};
for (const [name, la, lo] of [
  ["Đông Nha Trang", 12.5, 111.0],
  ["Vịnh Bắc Bộ", 19.5, 107.5],
  ["Giữa Biển Đông", 14.0, 113.0],
]) {
  const { h, d } = pick(la, lo);
  console.log(`${name}: VHM0=${h?.toFixed(2)} m · VMDR=${d?.toFixed(0)}°`);
}

const om = await (
  await fetch(
    "https://marine-api.open-meteo.com/v1/marine?latitude=12.5&longitude=111.0&current=wave_height,wave_direction&models=ncep_gfswave025",
    opt,
  )
).json();
console.log("Open-Meteo gfswave cùng điểm:", om?.current?.wave_height, "m ·", om?.current?.wave_direction, "° (TỚI TỪ)");

console.log(`\nTổng tải: ${(bytes / 1024).toFixed(0)} KB · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
