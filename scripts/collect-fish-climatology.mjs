// scripts/collect-fish-climatology.mjs   (chạy: npx tsx scripts/collect-fish-climatology.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// THU THẬP THÔNG SỐ MÙA VỤ → public/data/fish-climatology.v1.json
//
// VÌ SAO: lộ trình chuyến biển tới 16 NGÀY, nhưng ảnh vệ tinh chỉ cho dự báo cá
// đáng tin vài ngày đầu. Ngày xa dùng "bản đồ mùa vụ" — điều kiện ĐIỂN HÌNH của
// tháng đó dựng từ nhiều năm lịch sử. Lớp cá 16 ngày = pha trộn hai bản
// (tỷ lệ w(d) do scripts/fit-fish-blend-weights.mjs đo ra, KHÔNG đặt tay).
//
// CÁCH LÀM (điểm mấu chốt: DÙNG LẠI ĐÚNG HÀM CHẤM ĐIỂM CỦA APP):
//   1. SST: CoralTemp ngày (noaacrwsstDaily, có từ 1985) — mỗi tháng lấy vài
//      mốc (stride ngày), gộp NHIỀU NĂM → trung bình ô = nhiệt điển hình tháng.
//   2. Phù du: chl tháng (noaacwNPPVIIRSSQchlaMonthly, 2012→nay) — trung bình
//      nhiều năm theo tháng. Trung bình LOG (phân bố chl lệch phải nặng).
//   3. buildFishForecast(sstClim, chlClim, null, month) — CÙNG scoring với bản
//      live (cùng mùa vụ loài, cổng nhiệt, front) ⇒ điểm hai bên SO SÁNH ĐƯỢC.
//      Các trường phụ (SSHA/dị thường/dòng/tầng nhiệt) KHÔNG có bản khí hậu →
//      bỏ; bất biến monotonic của app: thiếu nguồn = điểm giảm, không bịa.
//
// ĐẦU RA: lưới dùng chung + 12 mảng điểm 0..100 (1 byte/ô, base64) → nhỏ, nhét
// vừa asset tĩnh cho SW giữ offline.
//
//   npx tsx scripts/collect-fish-climatology.mjs [--years 2020-2025] [--out <path>]
//
// KHI NÀO CHẠY LẠI: ~1 lần/năm (mùa vụ đổi rất chậm) hoặc khi đổi hàm chấm điểm
// trong fish-predict.ts — vì bản mùa vụ phải CÙNG thang điểm với bản dự báo thì
// pha trộn mới có nghĩa. Chạy xong PHẢI chạy lại scripts/fit-fish-blend-weights.mjs
// (tỷ lệ w(d) đo trên chính bản mùa vụ này) rồi `npm test`.
// Lần chạy 2026-07-28: 6 năm 2020–2025, ~144 request, ~6 phút, 12/12 tháng, 71 KB.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildFishForecast,
  parseErddapGrid,
  ERDDAP_UA,
} from "../src/lib/fish-predict.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const OUT_DEFAULT = "public/data/fish-climatology.v1.json";

// Lưới đích = ĐÚNG lưới bản live (0,25°, bbox 5–22N / 102–118E) để hai bản
// khớp ô nhau — stride 5 trên lưới CoralTemp 0,05°.
const SST_DS = "noaacrwsstDaily";
const CHL_DS = "noaacwNPPVIIRSSQchlaMonthly";
// mỗi tháng lấy 3 mốc ngày (1, 11, 21) — SST mượt theo thời gian, 3 mốc × N năm
// là đủ; lấy dày hơn chỉ tốn băng thông
const SST_TIME_STRIDE = 10;
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

/** SST một tháng-năm: vài mốc ngày, trả mảng lưới thô ERDDAP đã tách theo mốc */
async function fetchSstMonth(y, m) {
  const d1 = `${y}-${pad(m)}-01`;
  const d2 = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
  const url =
    `${CW}/${SST_DS}.json?analysed_sst` +
    `%5B(${d1}):${SST_TIME_STRIDE}:(${d2})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`;
  const json = await getJson(url, `SST ${y}-${pad(m)}`);
  if (!json?.table?.rows) return [];
  // tách theo mốc thời gian rồi parse từng lát bằng ĐÚNG parser của app
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

/** Phù du một tháng-năm (ảnh THÁNG sẵn) */
async function fetchChlMonth(y, m) {
  const d1 = `${y}-${pad(m)}-01`;
  const d2 = `${y}-${pad(m)}-05`;
  const url =
    `${CW}/${CHL_DS}.json?chlor_a` +
    `%5B(${d1}):1:(${d2})%5D%5B(0.0)%5D%5B(22.0):6:(5.0)%5D%5B(102.0):6:(118.0)%5D`;
  const json = await getJson(url, `chl ${y}-${pad(m)}`);
  if (!json?.table?.rows?.length) return null;
  return parseErddapGrid(json, { hasAltitude: true, unit: "mg/m3" });
}

/**
 * Gộp nhiều lưới CÙNG trục → trung bình theo ô, bỏ NaN.
 * `log` = trung bình hình học (dùng cho chl: phân bố lệch phải nặng, trung bình
 * cộng bị vài ô nở hoa kéo lệch).
 */
function meanGrids(grids, { log = false, unit } = {}) {
  const live = grids.filter((g) => g && g.lats.length && g.lons.length);
  if (!live.length) return null;
  const ref = live[0];
  const sum = ref.lats.map(() => ref.lons.map(() => 0));
  const cnt = ref.lats.map(() => ref.lons.map(() => 0));
  for (const g of live) {
    if (g.lats.length !== ref.lats.length || g.lons.length !== ref.lons.length) {
      console.warn("   ! bỏ lưới lệch cỡ");
      continue;
    }
    for (let i = 0; i < ref.lats.length; i++)
      for (let j = 0; j < ref.lons.length; j++) {
        const v = g.values[i][j];
        if (!Number.isFinite(v)) continue;
        if (log && v <= 0) continue;
        sum[i][j] += log ? Math.log(v) : v;
        cnt[i][j]++;
      }
  }
  const values = ref.lats.map((_, i) =>
    ref.lons.map((_, j) => {
      if (!cnt[i][j]) return NaN;
      const mean = sum[i][j] / cnt[i][j];
      return log ? Math.exp(mean) : mean;
    }),
  );
  return { lats: ref.lats, lons: ref.lons, values, date: "", unit };
}

/* ── chạy ─────────────────────────────────────────────────────────────────── */
console.log(
  `BẢN ĐỒ MÙA VỤ — năm ${yFrom}–${yTo} (${YEARS.length} năm) · SST ${SST_DS} · chl ${CHL_DS}`,
);

let axes = null; // lưới đích (lấy từ tháng đầu tiên dựng được)
const monthCells = {}; // month → Map("lat,lon" → điểm)
const stats = [];

for (let m = 1; m <= 12; m++) {
  const sstSlices = [];
  const chlGrids = [];
  for (const y of YEARS) {
    const s = await fetchSstMonth(y, m);
    sstSlices.push(...s);
    const c = await fetchChlMonth(y, m);
    if (c) chlGrids.push(c);
  }
  const sstClim = meanGrids(sstSlices, { unit: "degC" });
  const chlClim = meanGrids(chlGrids, { log: true, unit: "mg/m3" });
  if (!sstClim || !chlClim) {
    console.log(`Tháng ${pad(m)}: THIẾU DỮ LIỆU (sst=${sstSlices.length} chl=${chlGrids.length}) — bỏ`);
    stats.push({ month: m, cells: 0, sstSlices: sstSlices.length, chlMonths: chlGrids.length });
    continue;
  }

  // CÙNG hàm chấm điểm với bản live ⇒ điểm hai bên so sánh được
  const fc = buildFishForecast(sstClim, chlClim, null, m);
  const cells = fc.cells ?? [];
  if (!axes && cells.length) {
    axes = { lats: sstClim.lats, lons: sstClim.lons };
  }
  monthCells[m] = new Map(cells.map((c) => [`${c.lat},${c.lon}`, c.s]));
  const hot = cells.filter((c) => c.s >= 50).length;
  stats.push({
    month: m,
    cells: cells.length,
    hot,
    sstSlices: sstSlices.length,
    chlMonths: chlGrids.length,
    species: (fc.species ?? []).length,
  });
  console.log(
    `Tháng ${pad(m)}: ${cells.length} ô (≥50: ${hot}) · SST ${sstSlices.length} lát · chl ${chlGrids.length} tháng · ${(fc.species ?? []).length} loài`,
  );
}

if (!axes) {
  console.error("KHÔNG dựng được lưới nào — dừng, KHÔNG ghi file.");
  process.exit(1);
}

// ĐÓNG GÓI: lưới dùng chung + 12 mảng byte (0 = không có ô/dưới ngưỡng giữ)
const { lats, lons } = axes;
const months = {};
for (let m = 1; m <= 12; m++) {
  const map = monthCells[m];
  const buf = new Uint8Array(lats.length * lons.length);
  if (map) {
    for (let i = 0; i < lats.length; i++)
      for (let j = 0; j < lons.length; j++) {
        const key = `${Math.round(lats[i] * 100) / 100},${Math.round(lons[j] * 100) / 100}`;
        const v = map.get(key);
        if (v != null) buf[i * lons.length + j] = Math.max(0, Math.min(100, Math.round(v)));
      }
  }
  months[m] = Buffer.from(buf).toString("base64");
}

const out = {
  v: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  years: [yFrom, yTo],
  sources: { sst: SST_DS, chl: CHL_DS },
  lat0: Math.round(lats[0] * 1000) / 1000,
  lon0: Math.round(lons[0] * 1000) / 1000,
  dLat: Math.round(((lats.at(-1) - lats[0]) / (lats.length - 1)) * 100000) / 100000,
  dLon: Math.round(((lons.at(-1) - lons[0]) / (lons.length - 1)) * 100000) / 100000,
  nLat: lats.length,
  nLon: lons.length,
  months,
  stats,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);
console.log(
  `\n✓ ${OUT} — ${lats.length}×${lons.length} ô, 12 tháng, ${kb} KB` +
    `\n  lat0=${out.lat0} dLat=${out.dLat} · lon0=${out.lon0} dLon=${out.dLon}`,
);
const filled = stats.filter((s) => s.cells > 0).length;
console.log(`  tháng dựng được: ${filled}/12`);
if (filled < 12) console.log("  ⚠ tháng thiếu sẽ trả điểm 0 → blend tự nghiêng về bản dự báo");
