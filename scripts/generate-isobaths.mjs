// Sinh ĐƯỜNG ĐẲNG SÂU (isobath) cho lớp hải đồ Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-isobaths.mjs
//
// Vì sao tự sinh: WMS đẳng sâu của EMODnet chỉ phủ châu Âu — vùng VN trắng.
// Nguồn: ETOPO 2022 (NOAA, public domain) qua ERDDAP — cùng nguồn với
// generate-depth-grid.mjs. Marching squares ở 0,1° rồi nối đoạn thành tuyến
// dài để bản đồ dán được nhãn "50 m" dọc đường.
//
// Đầu ra: public/data/isobaths.v1.json — FeatureCollection<LineString, {d}>
// d = độ sâu mét (dương). Mức chọn theo nghề cá VN: 20/50/100/200/500/1000/2000.

import { writeFileSync, mkdirSync } from "node:fs";

const LAT0 = 5.0, LAT1 = 23.0, LON0 = 102.0, LON1 = 118.0, STEP = 0.1;
const N_LAT = Math.round((LAT1 - LAT0) / STEP) + 1;
const N_LON = Math.round((LON1 - LON0) / STEP) + 1;
const LEVELS = [20, 50, 100, 200, 500, 1000, 2000];
// ETOPO 15" → 0,1° = stride 24
const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json";

// ── kéo lưới z ───────────────────────────────────────────────────────────
const z = new Float32Array(N_LAT * N_LON).fill(NaN);
const BANDS = 6;
for (let b = 0; b < BANDS; b++) {
  const a = Math.max(LAT0, LAT0 + ((LAT1 - LAT0) * b) / BANDS - STEP);
  const e = LAT0 + ((LAT1 - LAT0) * (b + 1)) / BANDS;
  const url =
    `${ERDDAP}?z%5B(${a.toFixed(2)}):24:(${e.toFixed(2)})%5D` +
    `%5B(${LON0}):24:(${LON1})%5D`;
  process.stdout.write(`band ${b + 1}/${BANDS} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ERDDAP ${res.status}`);
  const json = await res.json();
  for (const [lat, lon, zv] of json.table.rows) {
    const i = Math.round((lat - LAT0) / STEP);
    const j = Math.round((lon - LON0) / STEP);
    if (i >= 0 && i < N_LAT && j >= 0 && j < N_LON) z[i * N_LON + j] = zv;
  }
  console.log("ok");
}

// ── marching squares cho từng mức sâu ────────────────────────────────────
const lat = (i) => LAT0 + i * STEP;
const lon = (j) => LON0 + j * STEP;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** điểm cắt nội suy giữa 2 đỉnh lưới */
function interp(level, x0, y0, v0, x1, y1, v1) {
  const t = (level - v0) / (v1 - v0);
  return [r3(x0 + t * (x1 - x0)), r3(y0 + t * (y1 - y0))];
}

function segmentsForLevel(level) {
  const L = -level; // z âm dưới mực nước
  const segs = [];
  for (let i = 0; i < N_LAT - 1; i++) {
    for (let j = 0; j < N_LON - 1; j++) {
      const v00 = z[i * N_LON + j], v01 = z[i * N_LON + j + 1];
      const v10 = z[(i + 1) * N_LON + j], v11 = z[(i + 1) * N_LON + j + 1];
      if ([v00, v01, v10, v11].some((v) => Number.isNaN(v))) continue;
      let idx = 0;
      if (v00 > L) idx |= 1;
      if (v01 > L) idx |= 2;
      if (v11 > L) idx |= 4;
      if (v10 > L) idx |= 8;
      if (idx === 0 || idx === 15) continue;
      const x0 = lon(j), x1 = lon(j + 1), y0 = lat(i), y1 = lat(i + 1);
      // các điểm cắt trên 4 cạnh
      const bottom = () => interp(L, x0, y0, v00, x1, y0, v01);
      const top = () => interp(L, x0, y1, v10, x1, y1, v11);
      const left = () => interp(L, x0, y0, v00, x0, y1, v10);
      const right = () => interp(L, x1, y0, v01, x1, y1, v11);
      // bảng marching squares (bỏ qua 2 ca mơ hồ 5/10 — nối đơn giản)
      const TABLE = {
        1: [left, bottom], 2: [bottom, right], 3: [left, right],
        4: [top, right], 6: [bottom, top], 7: [left, top],
        8: [left, top], 9: [bottom, top], 11: [top, right],
        12: [left, right], 13: [bottom, right], 14: [left, bottom],
        5: [left, bottom], 10: [bottom, right],
      };
      const pair = TABLE[idx];
      if (pair) segs.push([pair[0](), pair[1]()]);
    }
  }
  return segs;
}

/** nối đoạn rời thành polyline dài (hashmap đầu mút) để dán nhãn đẹp */
function chain(segs) {
  const key = (p) => `${p[0]},${p[1]}`;
  const byEnd = new Map();
  const used = new Array(segs.length).fill(false);
  segs.forEach((s, i) => {
    for (const p of [s[0], s[1]]) {
      const k = key(p);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push(i);
    }
  });
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const line = [...segs[i]];
    // nối về 2 phía
    for (const headFirst of [false, true]) {
      for (;;) {
        const end = headFirst ? line[0] : line[line.length - 1];
        const cands = (byEnd.get(key(end)) ?? []).filter((s) => !used[s]);
        if (cands.length === 0) break;
        const si = cands[0];
        used[si] = true;
        const [a, b] = segs[si];
        const next = key(a) === key(end) ? b : a;
        if (headFirst) line.unshift(next);
        else line.push(next);
      }
    }
    if (line.length >= 4) lines.push(line); // bỏ vụn ngắn
  }
  return lines;
}

const features = [];
for (const level of LEVELS) {
  const segs = segmentsForLevel(level);
  const lines = chain(segs);
  for (const coords of lines) {
    features.push({
      type: "Feature",
      properties: { d: level },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  console.log(`đẳng sâu ${level} m: ${segs.length} đoạn → ${lines.length} tuyến`);
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/isobaths.v1.json", JSON.stringify(out));
console.log(
  `OK: public/data/isobaths.v1.json — ${features.length} tuyến, ${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
