// scripts/fish-front-calib-probe.mjs
// Đo phân bố |gradient| THỰC của SST, log-chl, SSHA trên lưới biển VN để kiểm
// các hằng `full` trong fish-predict.ts (thermFront 0.5°C, chlFront 0.25 log,
// eddy 0.08 m) có realistic không: nếu hầu hết ô front đã kịch trần (=1) thì
// tín hiệu bão hoà (mất phân biệt); nếu hầu như 0 thì front gần như vô hình.
// Chỉ kéo ảnh MỚI NHẤT mỗi nguồn (nhanh). node scripts/fish-front-calib-probe.mjs
import { writeFileSync } from "node:fs";
const UA = "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
async function gj(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) });
  return r.ok ? r.json() : null;
}
function parse(json, hasAlt, kelvin) {
  const rows = json?.table?.rows ?? [];
  const iLat = hasAlt ? 2 : 1, iLon = iLat + 1, iVal = iLon + 1;
  const latS = new Set(), lonS = new Set();
  for (const r of rows) { latS.add(r[iLat]); lonS.add(r[iLon]); }
  const lats = [...latS].sort((a, b) => a - b), lons = [...lonS].sort((a, b) => a - b);
  const li = new Map(lats.map((v, i) => [v, i])), oi = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  for (const r of rows) {
    const v = r[iVal];
    if (typeof v === "number" && Number.isFinite(v))
      values[li.get(r[iLat])][oi.get(r[iLon])] = kelvin ? v - 273.15 : v;
  }
  return { lats, lons, values };
}
// |grad| per-cell trung tâm (giống gradientStrength CHƯA clamp/chưa chia full)
function gradList(values) {
  const H = values.length, W = H ? values[0].length : 0, out = [];
  for (let i = 1; i < H - 1; i++)
    for (let j = 1; j < W - 1; j++) {
      const c = values[i][j];
      if (!Number.isFinite(c)) continue;
      const up = values[i + 1][j], dn = values[i - 1][j], rt = values[i][j + 1], lf = values[i][j - 1];
      const gy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      const gx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      out.push(Math.hypot(gx, gy));
    }
  return out;
}
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p / 100 * s.length)]; };
function stats(list, full) {
  const clampFrac = list.filter((v) => v / full >= 1).length / list.length;
  return {
    n: list.length, full,
    p50: +pct(list, 50).toFixed(4), p75: +pct(list, 75).toFixed(4),
    p90: +pct(list, 90).toFixed(4), p95: +pct(list, 95).toFixed(4), p99: +pct(list, 99).toFixed(4),
    fracAtClamp: +clampFrac.toFixed(3),
    p90_over_full: +(pct(list, 90) / full).toFixed(3),
  };
}
async function main() {
  const sstU = `${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst%5B(last)%5D%5B(5.0):5:(22.0)%5D%5B(102.0):5:(118.0)%5D`;
  const chlU = enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
  const slaU = `${ERDDAP}/noaacwBLENDEDsshDaily.json?sla%5B(last)%5D%5B(5.0):2:(22.0)%5D%5B(102.0):2:(118.0)%5D`;
  const [sj, cj, lj] = await Promise.all([gj(sstU), gj(chlU), gj(slaU)]);
  const sst = parse(sj, false, true);
  const chl = parse(cj, true, false);
  const sla = lj ? parse(lj, false, false) : null;
  const logchl = chl.values.map((row) => row.map((v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN)));
  const res = {
    generatedAt: new Date().toISOString(),
    note: "|grad| per-cell THỰC vs hằng `full` fish-predict. fracAtClamp cao = bão hoà (mất phân biệt); p90_over_full ~0.5-1 = calibrated tốt.",
    sstFront_thermFront: stats(gradList(sst.values), 0.5),   // fish-predict full=0.5 °C/ô @0.25°
    chlFront: stats(gradList(logchl), 0.25),                  // full=0.25 log/ô @0.25°
    slaEddy: sla ? stats(gradList(sla.values), 0.08) : null,  // full=0.08 m/ô @0.5°
  };
  console.log(JSON.stringify(res, null, 2));
  const OUT = "C:\\Users\\Envy\\AppData\\Local\\Temp\\claude\\C--Code-ForFish\\1498723b-1dfd-4b8b-b887-fc686b5a0497\\scratchpad\\fish-front-calib.json";
  writeFileSync(OUT, JSON.stringify(res, null, 2) + "\n", "utf8");
  console.log("\n✓ " + OUT);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
