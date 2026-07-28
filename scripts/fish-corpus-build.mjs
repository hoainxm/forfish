// scripts/fish-corpus-build.mjs  (npx tsx scripts/fish-corpus-build.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// KHO DỮ LIỆU DÙNG CHUNG cho nhóm nghiên cứu lớp cá (thiết kế chủ dự án 2026-07-28).
// Tải MỘT LẦN, ghi ra đĩa, mọi phân tích sau đọc từ đây — tránh mỗi người tải
// lại vài trăm request ERDDAP (chậm + dội nguồn miễn phí).
//
// GHI RA (mặc định .cache/fish-corpus/):
//   days/<YYYY-MM-DD>.json  — bản đồ cá ngày đó: [{lat,lon,s}] + chỉ số hải dương
//                              trung bình vùng (sstMean, sstAnomMean, chlMeanLog)
//   index.json              — danh sách ngày + tham số dựng
//
// CHỌN NGÀY: với mỗi mốc gốc T (rải 4 mùa × nhiều năm) lấy T và T+lead cho mọi
// lead trong LEADS ⇒ đủ cho: đo suy giảm tương quan, dò điểm gãy X, đo dịch
// chuyển điểm nóng, và chọn năm tương tự (analog year).
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { buildFishForecast, parseErddapGrid, ERDDAP_UA } from "../src/lib/fish-predict.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : ".cache/fish-corpus";
const LEADS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16];
const YEARS = [2022, 2023, 2024, 2025];
const MONTHS = [1, 4, 7, 10];
const DAYS_IN_MONTH = [10];

const pad = (n) => String(n).padStart(2, "0");
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function getJson(url) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": ERDDAP_UA },
        signal: AbortSignal.timeout(120000),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(String(r.status));
      return JSON.parse(t);
    } catch {
      if (a === 3) return null;
      await new Promise((s) => setTimeout(s, 1500 * a));
    }
  }
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

async function buildDay(date) {
  const file = `${OUT}/days/${date}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const sstJson = await getJson(
    `${CW}/noaacrwsstDaily.json?analysed_sst%5B(${date})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`,
  );
  const chlJson = await getJson(
    `${CW}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(${date})%5D%5B(0.0)%5D%5B(22.0):3:(5.0)%5D%5B(102.0):3:(118.0)%5D`,
  );
  const anomJson = await getJson(
    `${CW}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly%5B(${date})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`,
  );
  if (!sstJson || !chlJson) return null;
  const sst = parseErddapGrid(sstJson, { hasAltitude: false, unit: "degC" });
  const chl = parseErddapGrid(chlJson, { hasAltitude: true, unit: "mg/m3" });
  const anom = anomJson
    ? parseErddapGrid(anomJson, { hasAltitude: false, unit: "degC" })
    : null;
  if (!sst.lats.length || !chl.lats.length) return null;
  const month = Number(date.slice(5, 7));
  const fc = buildFishForecast(sst, chl, null, month, anom ? { anom } : undefined);

  const flat = (g) => g.values.flat().filter((v) => Number.isFinite(v));
  const rec = {
    date,
    month,
    cells: (fc.cells ?? []).map((c) => ({ lat: c.lat, lon: c.lon, s: c.s })),
    // CHỈ SỐ HẢI DƯƠNG CẢ VÙNG — "thời tiết của năm đó" để chọn năm tương tự
    idx: {
      sstMean: +mean(flat(sst)).toFixed(3),
      sstStd: +Math.sqrt(
        mean(flat(sst).map((v) => (v - mean(flat(sst))) ** 2)),
      ).toFixed(3),
      chlLogMean: +mean(
        flat(chl).filter((v) => v > 0).map((v) => Math.log10(v)),
      ).toFixed(4),
      anomMean: anom ? +mean(flat(anom)).toFixed(3) : null,
    },
  };
  mkdirSync(`${OUT}/days`, { recursive: true });
  writeFileSync(file, JSON.stringify(rec));
  return rec;
}

const origins = [];
for (const y of YEARS) for (const m of MONTHS) for (const d of DAYS_IN_MONTH) origins.push(`${y}-${pad(m)}-${pad(d)}`);
const wanted = new Set();
for (const T of origins) {
  wanted.add(T);
  for (const l of LEADS) wanted.add(addDays(T, l));
}
const list = [...wanted].sort();
console.log(`KHO DỮ LIỆU: ${origins.length} mốc gốc × ${LEADS.length} tầm ⇒ ${list.length} ngày cần có`);

let ok = 0;
let miss = 0;
for (const d of list) {
  const rec = await buildDay(d);
  if (rec) ok++;
  else miss++;
  process.stdout.write(rec ? "." : "x");
}
console.log("");
mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/index.json`,
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    origins,
    leads: LEADS,
    days: list,
    ok,
    miss,
    note: "cells = [{lat,lon,s}] điểm cá 0..100 (đã qua buildFishForecast, có anom); idx = chỉ số hải dương trung bình vùng",
  }, null, 1),
);
console.log(`✓ ${OUT} — ${ok} ngày có dữ liệu, ${miss} ngày thiếu`);
