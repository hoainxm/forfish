// scripts/collect-sst-climatology.mjs   (chạy: npx tsx scripts/collect-sst-climatology.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// BẢNG KHÍ HẬU SST THEO VÙNG–THÁNG → src/data/sst-climatology.v1.json
//
// VÌ SAO: dải nhiệt lai (src/lib/thermal-band.ts) cần biết "nước vùng này tháng
// này THƯỜNG bao nhiêu độ" để không phạt oan loài đang vụ. Bảng = phân vị
// p10/p25/p50/p75/p90 của SST CoralTemp nhiều năm, gộp MỌI ô biển trong vùng
// (gán vùng bằng ĐÚNG hàm app dùng: nearestRegionWithin · REGION_REACH_DEG) ×
// mọi lát ngày của tháng (stride 10 ngày ⇒ 3 lát/tháng/năm).
//
// Vì sao KHÔNG dùng public/data/fish-climatology.v1.json: file đó là ĐIỂM CÁ
// 0..100 đã chấm (đầu ra của buildFishForecast), không còn SST.
//
// ĐẦU RA nhỏ (7 vùng × 12 tháng × 6 số ≈ 5 KB) → nằm trong src/data như
// copernicus-tendency-skill.json, import thẳng ở server (fish-forecast-run.ts).
//
//   npx tsx scripts/collect-sst-climatology.mjs [--years 2021-2025] [--out <path>]
//
// KHI NÀO CHẠY LẠI: ~1 lần/năm hoặc khi FISH_REGIONS đổi đa giác. Mỗi lần chạy
// ~60 request ERDDAP (~3–8 phút). Ghi năm chốt trong file (`years`).
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseErddapGrid, ERDDAP_UA, REGION_REACH_DEG } from "../src/lib/fish-predict.ts";
import { nearestRegionWithin, FISH_REGIONS } from "../src/data/fish-seasons.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const SST_DS = "noaacrwsstDaily";
const OUT_DEFAULT = "src/data/sst-climatology.v1.json";
const SST_TIME_STRIDE = 10; // ngày 1, 11, 21 mỗi tháng
const REQ_TIMEOUT_MS = 120_000;
const RETRIES = 3;

const args = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const [yFrom, yTo] = argVal("--years", "2021-2025").split("-").map(Number);
const OUT = argVal("--out", OUT_DEFAULT);
const YEARS = [];
for (let y = yFrom; y <= yTo; y++) YEARS.push(y);

const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

async function getJson(url, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ERDDAP_UA },
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  console.warn(`   ! bỏ qua ${label}: ${String(lastErr).slice(0, 100)}`);
  return null;
}

/** SST một tháng-năm: vài lát ngày trên lưới 0,25° (stride 5 của CoralTemp 0,05°) */
async function fetchSstMonth(y, m) {
  const d1 = `${y}-${pad(m)}-01`;
  const d2 = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
  const url =
    `${CW}/${SST_DS}.json?analysed_sst` +
    `%5B(${d1}):${SST_TIME_STRIDE}:(${d2})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`;
  const json = await getJson(url, `SST ${y}-${pad(m)}`);
  if (!json?.table?.rows) return [];
  const byTime = new Map();
  for (const r of json.table.rows) {
    const t = r[0];
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t).push(r);
  }
  return [...byTime.values()].map((rows) =>
    parseErddapGrid({ table: { rows } }, { hasAltitude: false, unit: "degC" }),
  );
}

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
const r2 = (x) => Math.round(x * 100) / 100;

console.log(`KHÍ HẬU SST THEO VÙNG–THÁNG — ${yFrom}–${yTo} · ${SST_DS} · ${FISH_REGIONS.length} vùng`);

// vùng của từng ô: tính một lần theo lưới của lát đầu tiên
let regionOfCell = null; // Map("i,j" → regionId | null)
const samples = {}; // regionId → month → number[]
for (const rg of FISH_REGIONS) samples[rg.id] = Object.fromEntries(Array.from({ length: 12 }, (_, k) => [k + 1, []]));
const stats = [];

for (let m = 1; m <= 12; m++) {
  let slices = 0;
  for (const y of YEARS) {
    const grids = await fetchSstMonth(y, m);
    for (const g of grids) {
      if (!regionOfCell) {
        regionOfCell = new Map();
        for (let i = 0; i < g.lats.length; i++)
          for (let j = 0; j < g.lons.length; j++)
            regionOfCell.set(`${i},${j}`, nearestRegionWithin(g.lats[i], g.lons[j], REGION_REACH_DEG)?.id ?? null);
      }
      for (let i = 0; i < g.lats.length; i++)
        for (let j = 0; j < g.lons.length; j++) {
          const v = g.values[i][j];
          if (!Number.isFinite(v)) continue;
          const rid = regionOfCell.get(`${i},${j}`);
          if (rid) samples[rid][m].push(v);
        }
      slices++;
    }
  }
  stats.push({ month: m, slices });
  console.log(`Tháng ${pad(m)}: ${slices} lát`);
}

const regions = {};
for (const rg of FISH_REGIONS) {
  regions[rg.id] = {};
  for (let m = 1; m <= 12; m++) {
    const arr = samples[rg.id][m].sort((a, b) => a - b);
    if (!arr.length) continue;
    regions[rg.id][m] = {
      p10: r2(pct(arr, 0.1)),
      p25: r2(pct(arr, 0.25)),
      p50: r2(pct(arr, 0.5)),
      p75: r2(pct(arr, 0.75)),
      p90: r2(pct(arr, 0.9)),
      n: arr.length,
    };
  }
}

const filled = Object.values(regions).reduce((s, r) => s + Object.keys(r).length, 0);
if (!filled) {
  console.error("KHÔNG có mẫu nào — dừng, KHÔNG ghi file.");
  process.exit(1);
}

const out = {
  v: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  years: [yFrom, yTo],
  source: SST_DS,
  timeStrideDays: SST_TIME_STRIDE,
  note: "Phân vị SST (°C) nhiều năm theo vùng FISH_REGIONS × tháng; dùng cho dải nhiệt lai (src/lib/thermal-band.ts).",
  regions,
  stats,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`\n✓ ${OUT} — ${filled}/${FISH_REGIONS.length * 12} ô vùng–tháng`);
for (const rg of FISH_REGIONS) {
  const row = Array.from({ length: 12 }, (_, k) => {
    const c = regions[rg.id][k + 1];
    return c ? `${c.p25}–${c.p75}` : "—";
  });
  console.log(`  ${rg.id.padEnd(14)} ${row.join(" | ")}`);
}
