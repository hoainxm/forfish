#!/usr/bin/env node
// tai-luoi-gio.mjs — lưới gió ERA5 10 m theo giờ (Open-Meteo archive) 0,5° phủ 4 hộp nước trồi Nam VN + lề,
// 1982→2026-10-20, mỗi yêu cầu 5 điểm × 3 năm. Ra raw/grid/<lat>_<lon>_<y>.json. Chạy lại được.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
const DIR = join(dataDir(), "hindcast-ntb", "era5-luoi") + "/";
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { BOXES } from "./hop.mjs"; // MỘT nguồn định nghĩa hộp
const pts = new Set();
for (const [la0, la1, lo0, lo1] of Object.values(BOXES)) for (let la = la0; la <= la1 + 1e-9; la += 0.5) for (let lo = lo0; lo <= lo1 + 1e-9; lo += 0.5) pts.add(`${la.toFixed(1)}_${lo.toFixed(1)}`);
const P = [...pts].map((k) => k.split("_").map(Number));
console.error("điểm", P.length);
writeFileSync(DIR + "boxes.json", JSON.stringify({ BOXES, points: P }));
const years = []; for (let y = 1982; y <= 2026; y += 3) years.push(y);
let n429 = 0;
for (let i = 0; i < P.length; i += 5) {
  const g = P.slice(i, i + 5);
  for (const y of years) {
    const y2 = Math.min(y + 2, 2026), end = y2 === 2026 ? "2026-10-20" : `${y2}-12-31`;
    const files = g.map(([la, lo]) => `${DIR}${la}_${lo}_${y}.json`);
    if (files.every(existsSync)) continue;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${g.map((p) => p[0]).join(",")}&longitude=${g.map((p) => p[1]).join(",")}&start_date=${y}-01-01&end_date=${end}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=GMT`;
    for (let t = 0; t < 8; t++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(180000) });
        if (r.status === 429) { n429++; await sleep(60000); continue; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const arr = Array.isArray(j) ? j : [j];
        arr.forEach((o, k) => writeFileSync(files[k], JSON.stringify({ lat: g[k][0], lon: g[k][1], time: o.hourly.time, s: o.hourly.wind_speed_10m, d: o.hourly.wind_direction_10m })));
        break;
      } catch (e) { console.error("lỗi", i, y, e.message); await sleep(10000); }
    }
    await sleep(2500);
  }
  console.error("nhóm", i / 5 + 1, "/", Math.ceil(P.length / 5), "429:", n429);
}
console.error("xong lưới gió");
