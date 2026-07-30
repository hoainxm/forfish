// scripts/fish-blend-audit.mjs  (npx tsx scripts/fish-blend-audit.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// CÂU HỎI CỦA CHỦ DỰ ÁN (2026-07-28): "bản mùa vụ có tạo ra VỊ TRÍ MỚI không,
// hay chỉ kéo tụt điểm của ảnh vệ tinh?"
//
// ĐO 4 THỨ:
//  1. Phân bố điểm: mùa vụ vs ảnh ngày — mùa vụ có bị "hiền" hơn không?
//  2. Ô mà MÙA VỤ nói tốt nhưng ảnh hôm nay KHÔNG có trong payload (<25) —
//     bao nhiêu ô, và nếu pha trên HỢP hai tập thì có ô nào vượt sàn 40 không?
//  3. Trần toán học: cần điểm mùa vụ bao nhiêu để một ô MỚI chạm sàn hiển thị?
//  4. Mùa vụ có biết CHỖ NÀO không (tương quan HẠNG với sự thật ngày T+d),
//     kể cả khi con số tuyệt đối thấp? → quyết định có đáng chuẩn hoá phân vị.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { buildFishForecast, parseErddapGrid, ERDDAP_UA } from "../src/lib/fish-predict.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const CLIM = JSON.parse(readFileSync("public/data/fish-climatology.v1.json", "utf8"));
const W = JSON.parse(readFileSync("src/data/fish-blend-weights.json", "utf8"));
const wOf = (d) => {
  const rows = W.perLead.filter((r) => typeof r.w === "number").sort((a, b) => a.lead - b.lead);
  if (d <= rows[0].lead) return 1 + (d / rows[0].lead) * (rows[0].w - 1);
  for (let i = 0; i < rows.length - 1; i++)
    if (d <= rows[i + 1].lead) {
      const t = (d - rows[i].lead) / (rows[i + 1].lead - rows[i].lead);
      return rows[i].w + t * (rows[i + 1].w - rows[i].w);
    }
  return rows[rows.length - 1].w;
};
const climBuf = {};
for (let m = 1; m <= 12; m++)
  climBuf[m] = CLIM.months?.[m] ? Buffer.from(CLIM.months[m], "base64") : null;
const climAt = (lat, lon, m) => {
  const b = climBuf[m];
  if (!b) return 0;
  const i = Math.round((lat - CLIM.lat0) / CLIM.dLat);
  const j = Math.round((lon - CLIM.lon0) / CLIM.dLon);
  if (i < 0 || i >= CLIM.nLat || j < 0 || j >= CLIM.nLon) return 0;
  return b[i * CLIM.nLon + j] ?? 0;
};

async function getJson(url) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": ERDDAP_UA }, signal: AbortSignal.timeout(120000) });
      const t = await r.text();
      if (!r.ok) throw new Error(r.status);
      return JSON.parse(t);
    } catch (e) {
      if (a === 3) return null;
      await new Promise((s) => setTimeout(s, 1500 * a));
    }
  }
}
const cache = new Map();
async function scoreMap(date, month) {
  const key = date;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const s = await getJson(`${CW}/noaacrwsstDaily.json?analysed_sst%5B(${date})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`);
        const c = await getJson(`${CW}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(${date})%5D%5B(0.0)%5D%5B(22.0):3:(5.0)%5D%5B(102.0):3:(118.0)%5D`);
        if (!s || !c) return null;
        return {
          sst: parseErddapGrid(s, { hasAltitude: false, unit: "degC" }),
          chl: parseErddapGrid(c, { hasAltitude: true, unit: "mg/m3" }),
        };
      })(),
    );
  }
  const g = await cache.get(key);
  if (!g) return null;
  const fc = buildFishForecast(g.sst, g.chl, null, month);
  return new Map((fc.cells ?? []).map((x) => [`${x.lat},${x.lon}`, x.s]));
}

const pct = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
};

/* ── 1. PHÂN BỐ ĐIỂM ───────────────────────────────────────────────────── */
const T = "2026-07-10";
const month = 7;
const today = await scoreMap(T, month);
if (!today) {
  console.error("không tải được ảnh ngày", T);
  process.exit(1);
}
const dayVals = [...today.values()];
const climVals = [];
for (let i = 0; i < CLIM.nLat; i++)
  for (let j = 0; j < CLIM.nLon; j++) {
    const v = climBuf[month][i * CLIM.nLon + j];
    if (v > 0) climVals.push(v);
  }
console.log("1) PHÂN BỐ ĐIỂM (tháng 7)");
console.table({
  "ảnh ngày": { n: dayVals.length, p50: pct(dayVals, 0.5), p90: pct(dayVals, 0.9), p99: pct(dayVals, 0.99), max: Math.max(...dayVals) },
  "mùa vụ": { n: climVals.length, p50: pct(climVals, 0.5), p90: pct(climVals, 0.9), p99: pct(climVals, 0.99), max: Math.max(...climVals) },
});

/* ── 2. Ô MÙA VỤ TỐT MÀ ẢNH KHÔNG CÓ ──────────────────────────────────── */
let onlyClim = 0;
let onlyClimGood = 0;
const newlyVisible = { 3: 0, 8: 0, 16: 0 };
for (let i = 0; i < CLIM.nLat; i++)
  for (let j = 0; j < CLIM.nLon; j++) {
    const cs = climBuf[month][i * CLIM.nLon + j];
    if (!cs) continue;
    const lat = Math.round((CLIM.lat0 + i * CLIM.dLat) * 100) / 100;
    const lon = Math.round((CLIM.lon0 + j * CLIM.dLon) * 100) / 100;
    if (today.has(`${lat},${lon}`)) continue;
    onlyClim++;
    if (cs >= 40) onlyClimGood++;
    for (const d of [3, 8, 16]) {
      // ô KHÔNG có trong payload ⇒ coi persist = 0 (đúng như lúc fit w)
      if ((1 - wOf(d)) * cs >= 40) newlyVisible[d]++;
    }
  }
console.log("\n2) Ô MÀ MÙA VỤ CÓ, ẢNH HÔM NAY KHÔNG CÓ");
console.log(`   tổng: ${onlyClim} ô · trong đó mùa vụ ≥40: ${onlyClimGood} ô`);
console.log(`   nếu pha trên HỢP hai tập, số ô MỚI vượt sàn 40: ` + JSON.stringify(newlyVisible));

/* ── 3. TRẦN TOÁN HỌC ──────────────────────────────────────────────────── */
console.log("\n3) CẦN ĐIỂM MÙA VỤ BAO NHIÊU ĐỂ MỘT Ô MỚI CHẠM SÀN 40?");
for (const d of [1, 3, 8, 16]) {
  const need = 40 / (1 - wOf(d));
  console.log(`   ngày ${String(d).padStart(2)}: w=${wOf(d).toFixed(3)} → cần mùa vụ ≥ ${need.toFixed(0)} điểm ` +
    `(mùa vụ cao nhất cả năm = ${Math.max(...Object.values(climBuf).filter(Boolean).map((b) => Math.max(...b)))})`);
}

/* ── 4. MÙA VỤ CÓ BIẾT "CHỖ NÀO" KHÔNG? (tương quan HẠNG) ─────────────── */
console.log("\n4) MÙA VỤ CÓ BIẾT CHỖ NÀO KHÔNG — tương quan HẠNG với sự thật");
const addDays = (iso, n) => {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const rank = (arr) => {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  idx.forEach(([, i], k) => (r[i] = k));
  return r;
};
const pearson = (x, y) => {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxy / Math.sqrt(sxx * syy || 1);
};
for (const d of [3, 8, 16]) {
  const tgt = addDays(T, d);
  const truth = await scoreMap(tgt, Number(tgt.slice(5, 7)));
  if (!truth) { console.log(`   ngày ${d}: thiếu ảnh`); continue; }
  const keys = [...new Set([...today.keys(), ...truth.keys()])];
  const p = [], c = [], t = [];
  for (const k of keys) {
    const [lat, lon] = k.split(",").map(Number);
    p.push(today.get(k) ?? 0);
    c.push(climAt(lat, lon, Number(tgt.slice(5, 7))));
    t.push(truth.get(k) ?? 0);
  }
  const rp = rank(p), rc = rank(c), rt = rank(t);
  console.log(
    `   ngày ${String(d).padStart(2)}: hạng(ảnh T, sự thật)=${pearson(rp, rt).toFixed(3)}  ` +
    `hạng(mùa vụ, sự thật)=${pearson(rc, rt).toFixed(3)}  · n=${keys.length}`,
  );
}
