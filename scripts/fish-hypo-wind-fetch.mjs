// scripts/fish-hypo-wind-fetch.mjs
// ─────────────────────────────────────────────────────────────────────────────
// TẢI GIÓ THẬT (ERA5 qua archive-api.open-meteo.com) cho GIẢ THUYẾT #3.
// Lưới 1° phủ 5–22°N / 102–118°E (306 điểm), dải ngày 2022-01-04 → 2025-10-27
// (phủ toàn bộ 16 mốc gốc + cửa sổ trễ 8 ngày + tầm 16 ngày).
//
// Biến: wind_speed_10m_mean (m/s) + wind_direction_10m_dominant (°, hướng GIÓ TỚI TỪ).
// Gộp nhiều toạ độ trong MỘT request (archive-api ghép cặp lat[i]/lon[i]).
// TUẦN TỰ, cache xuống .cache/fish-wind/era5-1deg.json — chạy lại KHÔNG tải lại.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = join(ROOT, ".cache", "fish-wind");
const OUT = join(OUTDIR, "era5-1deg.json");

const LAT0 = 5, LAT1 = 22, LON0 = 102, LON1 = 118, STEP = 1;
const START = "2022-01-04";
const END = "2025-10-27";
const BATCH = 51; // 306 / 51 = 6 request
const UA =
  "ForFish/1.0 (fish forecast research; contact duclong292@gmail.com)";

if (existsSync(OUT)) {
  console.log(`Đã có ${OUT} — bỏ qua tải.`);
  process.exit(0);
}
mkdirSync(OUTDIR, { recursive: true });

const lats = [];
for (let la = LAT0; la <= LAT1 + 1e-9; la += STEP) lats.push(Math.round(la * 10) / 10);
const lons = [];
for (let lo = LON0; lo <= LON1 + 1e-9; lo += STEP) lons.push(Math.round(lo * 10) / 10);
const pts = [];
for (const la of lats) for (const lo of lons) pts.push([la, lo]);
console.log(`${lats.length} vĩ × ${lons.length} kinh = ${pts.length} điểm, ${Math.ceil(pts.length / BATCH)} request`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** speed[date][ptIndex], dir[date][ptIndex] */
let times = null;
const speed = [];
const dir = [];

let reqCount = 0;
for (let b = 0; b < pts.length; b += BATCH) {
  const chunk = pts.slice(b, b + BATCH);
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${chunk.map((p) => p[0]).join(",")}` +
    `&longitude=${chunk.map((p) => p[1]).join(",")}` +
    `&start_date=${START}&end_date=${END}` +
    `&daily=wind_speed_10m_mean,wind_direction_10m_dominant` +
    `&wind_speed_unit=ms&timezone=UTC`;
  let json = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    reqCount++;
    const t0 = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      console.log(`  lô ${b / BATCH} HTTP ${res.status} → chờ ${(attempt + 1) * 20}s`);
      await sleep((attempt + 1) * 20000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    json = await res.json();
    console.log(`  lô ${b / BATCH}: ${chunk.length} điểm, ${Date.now() - t0} ms`);
    break;
  }
  if (!json) throw new Error(`lô ${b / BATCH} thất bại`);
  const arr = Array.isArray(json) ? json : [json];
  if (arr.length !== chunk.length) throw new Error(`trả về ${arr.length} ≠ ${chunk.length}`);
  for (let k = 0; k < arr.length; k++) {
    const d = arr[k].daily;
    if (!times) {
      times = d.time;
      for (let i = 0; i < times.length; i++) {
        speed.push(new Array(pts.length).fill(null));
        dir.push(new Array(pts.length).fill(null));
      }
    }
    if (d.time.length !== times.length) throw new Error("độ dài ngày lệch");
    for (let i = 0; i < times.length; i++) {
      speed[i][b + k] = d.wind_speed_10m_mean[i];
      dir[i][b + k] = d.wind_direction_10m_dominant[i];
    }
  }
  await sleep(1500); // TUẦN TỰ, nhẹ tay với máy chủ
}

writeFileSync(
  OUT,
  JSON.stringify({
    source: "ERA5 via archive-api.open-meteo.com",
    fetchedAt: new Date().toISOString().slice(0, 10),
    lat0: LAT0, lon0: LON0, step: STEP, nLat: lats.length, nLon: lons.length,
    times,
    // làm tròn 2 chữ số để file gọn
    speed: speed.map((row) => row.map((v) => (v == null ? null : Math.round(v * 100) / 100))),
    dir: dir.map((row) => row.map((v) => (v == null ? null : Math.round(v)))),
  }),
);
console.log(`\nXong: ${reqCount} request → ${OUT} (${times.length} ngày × ${pts.length} điểm)`);
