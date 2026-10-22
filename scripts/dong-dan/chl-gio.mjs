// chl-gio.mjs — phần dùng chung của các phân tích "mồi" (phan-tich-gio-moi.mjs, phan-tich-du-bao-moi.mjs):
// thống kê nhỏ, khe 8 ngày của OC-CCI, đọc chl trung bình hộp, dị thường theo khe, đọc chỉ số gió ngày CMEMS.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BOXES, inBox } from "./hop.mjs";

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
/** Bộ sinh ngẫu nhiên có hạt (mulberry32) — bootstrap lặp lại được. */
export const makeRng = (s0) => { let seed = s0; return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; }; };
export const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
export const doy = (iso) => Math.floor((Date.parse(iso) - Date.UTC(+iso.slice(0, 4), 0, 1)) / 864e5) + 1;
/** OC-CCI 8 ngày bắt đầu 1/1 mỗi năm ⇒ khe 0..45 */
export const slot = (iso) => Math.floor((doy(iso) - 1) / 8);
export const slotStart = (y, s) => new Date(Date.UTC(y, 0, 1) + s * 8 * 864e5).toISOString().slice(0, 10);
export const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
export const binomTail = (k, n, p = 1 / 3) => { let s = 0; for (let j = k; j <= n; j++) { let c = 1; for (let i = 0; i < j; i++) c = (c * (n - i)) / (i + 1); s += c * p ** j * (1 - p) ** (n - j); } return s; };
export const CLIM_YEARS = [1998, 2025];

/** Chl OC-CCI → trung bình log10 theo hộp cho từng mốc 8 ngày (mốc có < 30 % ô không mây bị bỏ). */
export function loadChlBoxes(RAW, BX) {
  const man = JSON.parse(readFileSync(join(RAW, "chl-occi", "manifest.json"), "utf8"));
  const nLon = man.lon.length;
  const cellsOf = Object.fromEntries(BX.map((b) => [b, man.lat.flatMap((la, i) => man.lon.map((lo, j) => (inBox(BOXES[b], la, lo) ? i * nLon + j : -1))).filter((k) => k >= 0)]));
  const chl = Object.fromEntries(BX.map((b) => [b, new Map()])); // hộp → Map(ngày → log10 chl)
  const cover = Object.fromEntries(BX.map((b) => [b, []]));
  for (const f of readdirSync(join(RAW, "chl-occi")).filter((f) => f.endsWith(".csv")).sort())
    for (const l of readFileSync(join(RAW, "chl-occi", f), "utf8").split("\n")) {
      if (!l) continue;
      const p = l.split(","), d = p[0];
      for (const b of BX) {
        const v = cellsOf[b].map((k) => +p[k + 1]).filter((x) => Number.isFinite(x) && x > 0);
        cover[b].push(v.length / cellsOf[b].length);
        if (v.length >= 0.3 * cellsOf[b].length) chl[b].set(d, mean(v.map(Math.log10)));
      }
    }
  return { man, cellsOf, chl, cover };
}
/** Dị thường theo khe 8 ngày, khí hậu theo CLIM_YEARS. */
export function anomBySlot(m, climYears = CLIM_YEARS) {
  const by = Array.from({ length: 46 }, () => []);
  for (const [d, v] of m) { const y = +d.slice(0, 4); if (y >= climYears[0] && y <= climYears[1]) by[slot(d)].push(v); }
  const cl = by.map(mean);
  return { clim: cl, anom: new Map([...m].map(([d, v]) => [d, v - cl[slot(d)]])) };
}
/** Chỉ số gió NGÀY theo hộp (tai-gio-cmems.mjs): {<HỘP>_<chỉ số>: {ngày: giá trị}} */
export const loadGioNgay = (RAW) => JSON.parse(readFileSync(join(RAW, "cmems-gio", "chiso-ngay.json"), "utf8"));
/** Dị thường NGÀY theo khí hậu ngày-trong-năm (làm trơn ±15 ngày) của chính chuỗi đó. */
export function anomDaily(series, climYears = CLIM_YEARS) {
  const by = Array.from({ length: 367 }, () => []);
  for (const [d, v] of Object.entries(series)) { const y = +d.slice(0, 4); if (y >= climYears[0] && y <= climYears[1]) by[doy(d)].push(v); }
  const raw = by.map(mean), cl = new Array(367).fill(NaN);
  for (let k = 1; k <= 366; k++) { const a = []; for (let j = -15; j <= 15; j++) { const kk = ((k + j - 1 + 366) % 366) + 1; if (Number.isFinite(raw[kk])) a.push(raw[kk]); } cl[k] = mean(a); }
  return { clim: cl, anom: new Map(Object.entries(series).map(([d, v]) => [d, v - cl[doy(d)]])) };
}
