#!/usr/bin/env node
// tai-chl-occi.mjs — chlorophyll-a ESA OC-CCI v6.0 theo 8 ngày (4 km) qua ERDDAP của NOAA PIFSC, vùng Nam Trung Bộ
// 8–15°N × 106–115°E, lấy mỗi ô thứ 3 (≈0,125°, khớp lưới gió CMEMS 0,125°). Nguồn + giấy phép: 11-so-nguon.md
// ("ESA CCI Data Policy: free and open access", ghi nguồn).
// Ra $SDFISH_DATA_DIR/hindcast-ntb/chl-occi/<năm>.csv — mỗi dòng "YYYY-MM-DD,<giá trị mg/m³ hoặc NaN …>" theo thứ tự
// hàng vĩ độ GIẢM DẦN × cột kinh độ TĂNG DẦN; trục ghi ở manifest.json. Chạy lại: năm đã đủ thì bỏ qua (năm nay luôn tải lại).
//   node scripts/dong-dan/tai-chl-occi.mjs [--tu 1997] [--den <năm nay>] [--stride 3]
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = join(dataDir(), "hindcast-ntb", "chl-occi");
mkdirSync(DIR, { recursive: true });
const Y0 = Number(arg("tu", 1997)), Y1 = Number(arg("den", new Date().getUTCFullYear())), ST = Number(arg("stride", 3));
const ERDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/esa-cci-chla-8d-v6-0.csv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
      if (r.status === 404) return null; // ERDDAP: không có mốc nào trong khoảng
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { console.error("  thử lại", i + 1, e.message); await sleep(5000 * (i + 1)); }
  }
  throw new Error("bỏ cuộc " + url);
}
let axes = existsSync(join(DIR, "manifest.json")) ? JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) : null;
const thisYear = new Date().getUTCFullYear();
// ERDDAP trả 404 nếu khoảng hỏi vượt phạm vi trục thời gian ⇒ kẹp vào time_coverage_start/end của bộ dữ liệu
const info = await get(ERDDAP.replace("/griddap/", "/info/").replace(".csv", "/index.csv"));
const cov = (k) => info?.split("\n").find((l) => l.includes(`,${k},`))?.split(",").at(-1).slice(0, 10);
const T0 = cov("time_coverage_start") ?? "1997-09-04", T1 = cov("time_coverage_end") ?? new Date().toISOString().slice(0, 10);
console.error("phạm vi bộ dữ liệu", T0, "→", T1);
for (let y = Y0; y <= Y1; y++) {
  const f = join(DIR, `${y}.csv`);
  if (existsSync(f) && y < thisYear) continue;
  const a = `${y}-01-01` < T0 ? T0 : `${y}-01-01`, b = `${y}-12-31` > T1 ? T1 : `${y}-12-31`;
  if (a > b) { console.error(y, "ngoài phạm vi"); continue; }
  const q = `chlor_a%5B(${a}):1:(${b})%5D%5B(15):${ST}:(8)%5D%5B(106):${ST}:(115)%5D`;
  const txt = await get(`${ERDDAP}?${q}`);
  if (!txt) { console.error(y, "không có mốc"); continue; }
  const rows = txt.split("\n").slice(2).filter(Boolean).map((l) => l.split(","));
  const lats = [...new Set(rows.map((r) => r[1]))], lons = [...new Set(rows.map((r) => r[2]))];
  if (!axes) { axes = { source: ERDDAP, dataset: "esa-cci-chla-8d-v6-0", stride: ST, lat: lats.map(Number), lon: lons.map(Number), order: "lat giảm dần × lon tăng dần", units: "mg m-3" }; writeFileSync(join(DIR, "manifest.json"), JSON.stringify(axes)); }
  if (lats.length !== axes.lat.length || lons.length !== axes.lon.length) throw new Error(`${y}: trục lệch manifest (${lats.length}×${lons.length})`);
  const n = lats.length * lons.length, byT = new Map();
  for (const r of rows) (byT.get(r[0]) ?? byT.set(r[0], []).get(r[0])).push(r[3] === "NaN" || r[3] === "" ? "NaN" : (+r[3]).toPrecision(4));
  const out = [...byT].map(([t, v]) => { if (v.length !== n) throw new Error(`${t}: ${v.length}≠${n} ô`); return `${t.slice(0, 10)},${v.join(",")}`; });
  writeFileSync(f, out.join("\n") + "\n");
  console.error(y, out.length, "mốc 8 ngày ×", n, "ô");
  await sleep(1000);
}
console.error("xong chl →", DIR);
