#!/usr/bin/env node
// tai-oisst.mjs — OISST v2.1 theo NGÀY từ NCEI THREDDS (OPeNDAP ascii) cho nghiên cứu "Dòng Dẫn" (docs/research/du-bao-ca-dong-dan-2026-10)
// lon idx 434..457 (108,625–114,375°E). Ra: raw/oisst/YYYY-MM.csv, mỗi dòng "YYYY-MM-DD,<264 số °C hoặc NaN>" (hàng lat, cột lon).
// Chạy lại được: tháng đã đủ ngày thì bỏ qua. Song song CONC luồng.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
const DIR = join(dataDir(), "hindcast-ntb", "oisst") + "/";
mkdirSync(DIR, { recursive: true });
const CONC = Number(process.argv[2] ?? 6);
const END = new Date(Date.UTC(2026, 9, 20));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchDay(d) {
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, ""), ym = ymd.slice(0, 6);
  for (const suf of ["", "_preliminary"]) {
    const url = `https://www.ncei.noaa.gov/thredds/dodsC/OisstBase/NetCDF/V2.1/AVHRR/${ym}/oisst-avhrr-v02r01.${ymd}${suf}.nc.ascii?sst%5B0:1:0%5D%5B0:1:0%5D%5B403:1:413%5D%5B434:1:457%5D`;
    for (let t = 0; t < 4; t++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (r.status === 404) break;
        if (!r.ok) throw new Error("HTTP " + r.status);
        const txt = await r.text();
        const vals = [];
        for (const l of txt.split("\n")) if (/^\[0\]\[0\]\[\d+\],/.test(l)) for (const v of l.split(",").slice(1)) { const x = +v; vals.push(x <= -999 ? "NaN" : (x / 100).toFixed(2)); }
        if (vals.length !== 264) throw new Error("thiếu ô " + vals.length);
        return vals.join(",");
      } catch (e) { await sleep(3000 * (t + 1)); if (t === 3) console.error("lỗi", ymd, e.message); }
    }
  }
  return null;
}
const months = [];
for (let d = new Date(Date.UTC(1982, 0, 1)); d <= END; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(d);
for (const m0 of months) {
  const ym = m0.toISOString().slice(0, 7), f = `${DIR}${ym}.csv`;
  const days = [];
  for (let d = new Date(m0); d.getUTCMonth() === m0.getUTCMonth() && d <= END; d = new Date(d.getTime() + 864e5)) days.push(new Date(d));
  const have = existsSync(f) ? new Set(readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => l.slice(0, 10))) : new Set();
  const todo = days.filter((d) => !have.has(d.toISOString().slice(0, 10)));
  if (!todo.length) continue;
  const lines = [];
  for (let i = 0; i < todo.length; i += CONC) {
    const res = await Promise.all(todo.slice(i, i + CONC).map(fetchDay));
    res.forEach((v, k) => { if (v) lines.push(`${todo[i + k].toISOString().slice(0, 10)},${v}`); });
  }
  if (lines.length) writeFileSync(f, (existsSync(f) ? readFileSync(f, "utf8") : "") + lines.join("\n") + "\n");
  console.error(ym, lines.length, "/", todo.length);
}
console.error("xong oisst");
