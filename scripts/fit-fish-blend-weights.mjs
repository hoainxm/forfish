// scripts/fit-fish-blend-weights.mjs  (chạy: npx tsx scripts/fit-fish-blend-weights.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// ĐO TỶ LỆ PHA TRỘN w(d) — KHÔNG ĐẶT TAY (chủ dự án chốt 2026-07-28)
//
// CÂU HỎI: lộ trình 16 ngày cần điểm cá cho ngày T+d. Ta có hai bản:
//   · persist(d) = bản tính từ ẢNH NGÀY T (đúng cái app phục vụ hôm nay)
//   · clim       = bản MÙA VỤ của tháng đích (scripts/collect-fish-climatology.mjs)
// Pha trộn:  blend = w(d)·persist + (1−w(d))·clim
// w(d) BAO NHIÊU là tốt nhất ở từng tầm ngày?
//
// SỰ THẬT ĐỂ ĐỐI CHIẾU: bản tính từ ẢNH NGÀY T+d (cùng pipeline buildFishForecast).
// Đây là proxy tốt nhất có được — chính là sản phẩm app phục vụ vào ngày đó.
// KHÔNG phải sản lượng cá thật; nói rõ trong `caveat` của file kết quả.
//
// NGHIỆM: bình phương tối thiểu, đặt a = persist − clim, b = truth − clim
//         w* = Σ(a·b) / Σ(a²)   rồi kẹp [0,1] và ép ĐƠN ĐIỆU KHÔNG TĂNG theo d
//         (tầm càng xa, ảnh cũ càng không thể có thêm thông tin).
//
// KIỂM CHÉO (bắt buộc — luật của repo, xem copernicus-tendency-skill.mjs):
//   chia mốc gốc T thành K nhóm; fit trên K−1 nhóm, đo RMSE trên nhóm còn lại.
//   Báo gain so với persistence THUẦN (w=1) và mùa vụ THUẦN (w=0).
//   Blend không thắng persistence ở tầm nào → NÓI THẲNG, không giấu.
//
// GUARD "always-on-term" (bài học lặp lại của dự án): nếu w gần như hằng số ở
// mọi tầm (không phân biệt được) thì pha trộn KHÔNG có tác dụng → phải nói ra.
//
//   npx tsx scripts/fit-fish-blend-weights.mjs [--origins 16] [--out src/data/fish-blend-weights.json]
//
// KHI NÀO CHẠY LẠI: sau mỗi lần dựng lại bản mùa vụ, hoặc khi đổi hàm chấm điểm
// fish-predict.ts. Chạy xong `npm test` — test khoá bảng w (đơn điệu, [0,1],
// guard không suy biến, số mẫu >1000/tầm) sẽ bắt ngay nếu kết quả suy biến.
// ~200 request ERDDAP, ~7–10 phút.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildFishForecast,
  parseErddapGrid,
  ERDDAP_UA,
} from "../src/lib/fish-predict.ts";

const CW = "https://coastwatch.noaa.gov/erddap/griddap";
const CLIM_PATH = "public/data/fish-climatology.v1.json";
const OUT_DEFAULT = "src/data/fish-blend-weights.json";
const LEADS = [1, 2, 3, 5, 8, 11, 16];
const REQ_TIMEOUT_MS = 120_000;
const RETRIES = 3;
const CV_FOLDS = 4;

const args = process.argv.slice(2);
const argVal = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OUT = argVal("--out", OUT_DEFAULT);
const N_ORIGINS = Number(argVal("--origins", "12"));

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const monthOf = (isoStr) => Number(isoStr.slice(5, 7));

async function getJson(url, label) {
  let last = null;
  for (let a = 1; a <= RETRIES; a++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ERDDAP_UA },
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 100)}`);
      return JSON.parse(text);
    } catch (e) {
      last = e;
      if (a < RETRIES) await new Promise((r) => setTimeout(r, 1500 * a));
    }
  }
  console.warn(`   ! thiếu ${label}: ${String(last).slice(0, 90)}`);
  return null;
}

/* ── lấy lưới THẬT của một ngày (cache theo ngày) ─────────────────────────── */
const gridCache = new Map();
async function gridsFor(date) {
  if (gridCache.has(date)) return gridCache.get(date);
  const p = (async () => {
    const sstJson = await getJson(
      `${CW}/noaacrwsstDaily.json?analysed_sst%5B(${date})%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`,
      `SST ${date}`,
    );
    const chlJson = await getJson(
      `${CW}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(${date})%5D%5B(0.0)%5D%5B(22.0):3:(5.0)%5D%5B(102.0):3:(118.0)%5D`,
      `chl ${date}`,
    );
    if (!sstJson || !chlJson) return null;
    const sst = parseErddapGrid(sstJson, { hasAltitude: false, unit: "degC" });
    const chl = parseErddapGrid(chlJson, { hasAltitude: true, unit: "mg/m3" });
    if (!sst.lats.length || !chl.lats.length) return null;
    return { sst, chl };
  })();
  gridCache.set(date, p);
  return p;
}

/** Điểm cá từ ảnh ngày `imgDate`, mùa vụ tính theo `targetMonth` → Map(key→điểm) */
async function scoreMap(imgDate, targetMonth) {
  const g = await gridsFor(imgDate);
  if (!g) return null;
  const fc = buildFishForecast(g.sst, g.chl, null, targetMonth);
  return new Map((fc.cells ?? []).map((c) => [`${c.lat},${c.lon}`, c.s]));
}

/* ── bản mùa vụ ───────────────────────────────────────────────────────────── */
let CLIM = null;
try {
  CLIM = JSON.parse(readFileSync(CLIM_PATH, "utf8"));
} catch {
  console.error(
    `KHÔNG đọc được ${CLIM_PATH} — chạy scripts/collect-fish-climatology.mjs trước.`,
  );
  process.exit(1);
}
const climBuf = {};
for (let m = 1; m <= 12; m++)
  climBuf[m] = CLIM.months?.[m] ? Buffer.from(CLIM.months[m], "base64") : null;

function climRaw(key, month) {
  const buf = climBuf[month];
  if (!buf) return 0;
  const [lat, lon] = key.split(",").map(Number);
  const i = Math.round((lat - CLIM.lat0) / CLIM.dLat);
  const j = Math.round((lon - CLIM.lon0) / CLIM.dLon);
  if (i < 0 || i >= CLIM.nLat || j < 0 || j >= CLIM.nLon) return 0;
  return buf[i * CLIM.nLon + j] ?? 0;
}

/* CHUẨN HOÁ PHÂN VỊ (v2, 2026-07-28) — PHẢI khớp buildClimScaleMap trong
   src/lib/fish-blend.ts. Bản mùa vụ dựng trên nền trung bình nhiều năm nên
   thang điểm bị NÉN; không quy về thang bản đồ ngày thì nó chỉ biết kéo xuống,
   không bao giờ đẩy được ô nào lên (đo: 0 ô mới ở mọi tầm — fish-blend-audit). */
function buildScale(month, dayScores) {
  const identity = new Uint8Array(101);
  for (let i = 0; i <= 100; i++) identity[i] = i;
  const buf = climBuf[month];
  if (!buf || !dayScores.length) return identity;
  const ch = new Int32Array(101);
  let nc = 0;
  for (const v of buf) if (v > 0) (ch[Math.min(100, v)]++, nc++);
  const dh = new Int32Array(101);
  let nd = 0;
  for (const v of dayScores)
    if (v > 0) (dh[Math.max(0, Math.min(100, Math.round(v)))]++, nd++);
  if (!nc || !nd) return identity;
  const dayAtPct = [];
  { let acc = 0, sIdx = 0;
    for (let step = 0; step <= 1000; step++) {
      const p = step / 1000;
      while (sIdx <= 100 && (acc + dh[sIdx]) / nd < p) { acc += dh[sIdx]; sIdx++; }
      dayAtPct.push(Math.min(100, sIdx));
    } }
  const out = new Uint8Array(101);
  let acc = 0;
  for (let v = 0; v <= 100; v++) {
    if (v === 0) { out[0] = 0; continue; }
    const p = (acc + ch[v] / 2) / nc;
    acc += ch[v];
    out[v] = ch[v] === 0 ? out[v - 1] : dayAtPct[Math.round(p * 1000)];
  }
  for (let v = 1; v <= 100; v++) if (out[v] < out[v - 1]) out[v] = out[v - 1];
  return out;
}

/** Ô vắng mặt trong lưới cá = điểm < KEEP_MIN(25), KHÔNG phải 0 — khớp
    ABSENT_PERSIST trong src/lib/fish-blend.ts */
const ABSENT_PERSIST = 12;

/* ── chọn mốc gốc T rải đều mùa + năm ─────────────────────────────────────── */
function pickOrigins(n) {
  const out = [];
  const years = [2022, 2023, 2024, 2025];
  const months = [1, 4, 7, 10];
  for (const y of years)
    for (const m of months) out.push(`${y}-${pad(m)}-10`);
  // rải đều: lấy cách quãng cho đủ n
  const step = Math.max(1, Math.floor(out.length / n));
  return out.filter((_, i) => i % step === 0).slice(0, n);
}

/* ── chạy ─────────────────────────────────────────────────────────────────── */
const origins = pickOrigins(N_ORIGINS);
console.log(
  `FIT w(d) — ${origins.length} mốc gốc × ${LEADS.length} tầm ngày (${LEADS.join(",")})\n` +
    `mùa vụ: ${CLIM_PATH} (${CLIM.years?.join("–")}, ${CLIM.nLat}×${CLIM.nLon})\n`,
);

// samples[lead] = [{origin, a[], b[]}] — a = persist−clim, b = truth−clim
const perLead = new Map(LEADS.map((d) => [d, []]));

for (const T of origins) {
  for (const d of LEADS) {
    const target = addDays(T, d);
    const m = monthOf(target);
    const [persist, truth] = await Promise.all([
      scoreMap(T, m), // ảnh ngày T, mùa vụ tháng đích
      scoreMap(target, m), // sự thật: ảnh ngày T+d
    ]);
    if (!persist || !truth) continue;
    // thang quy đổi dựng trên phân bố của CHÍNH bản đồ ngày T (đúng như runtime)
    const scale = buildScale(m, [...persist.values()]);
    // HỢP ba tập: ô ảnh ∪ ô sự thật ∪ ô mùa vụ (ô mùa vụ mới là chỗ đẻ vị trí mới)
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    for (let i = 0; i < CLIM.nLat; i++)
      for (let j = 0; j < CLIM.nLon; j++) {
        if (!climBuf[m] || !climBuf[m][i * CLIM.nLon + j]) continue;
        const lat = Math.round((CLIM.lat0 + i * CLIM.dLat) * 100) / 100;
        const lon = Math.round((CLIM.lon0 + j * CLIM.dLon) * 100) / 100;
        keys.add(`${lat},${lon}`);
      }
    const a = [];
    const b = [];
    const P = [];
    const C = [];
    const Y = [];
    for (const k of keys) {
      const c = scale[Math.min(100, climRaw(k, m))] ?? 0;
      const pv = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      const tv = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      a.push(pv - c);
      b.push(tv - c);
      P.push(pv); C.push(c); Y.push(tv);
    }
    perLead.get(d).push({ origin: T, a, b, P, C, Y });
    process.stdout.write(".");
  }
}
console.log("\n");

/** w bình phương tối thiểu từ tập mẫu */
function fitW(samples) {
  let saa = 0;
  let sab = 0;
  let n = 0;
  for (const s of samples)
    for (let i = 0; i < s.a.length; i++) {
      saa += s.a[i] * s.a[i];
      sab += s.a[i] * s.b[i];
      n++;
    }
  if (!n || saa <= 0) return { w: 1, n };
  return { w: Math.min(1, Math.max(0, sab / saa)), n };
}

/** RMSE của blend với w cho trước */
function rmse(samples, w) {
  let se = 0;
  let n = 0;
  for (const s of samples)
    for (let i = 0; i < s.a.length; i++) {
      const e = w * s.a[i] - s.b[i];
      se += e * e;
      n++;
    }
  return n ? Math.sqrt(se / n) : NaN;
}

/* ── THƯỚC ĐO "CHỈ ĐÚNG CHỖ" (top-K) ─────────────────────────────────────────
   RMSE thưởng cho việc đoán AN TOÀN (kéo mọi ô về trung bình là sai số giảm),
   nên nó KHÔNG trả lời được câu "app có chỉ đúng chỗ đáng đi không". Đo thêm:
   lấy K ô app cho điểm cao nhất, xem bao nhiêu ô nằm trong K ô CAO NHẤT THẬT.
   So ba bản: chỉ ảnh (w=1) · chỉ mùa vụ (w=0) · pha với w đã fit. */
const TOP_K = 100;
function hitK(sample, w) {
  const n = sample.Y.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const pred = idx.map((i) => w * sample.P[i] + (1 - w) * sample.C[i]);
  const topPred = [...idx].sort((x, y) => pred[y] - pred[x]).slice(0, TOP_K);
  const topTrue = new Set(
    [...idx].sort((x, y) => sample.Y[y] - sample.Y[x]).slice(0, TOP_K),
  );
  let hit = 0;
  for (const i of topPred) if (topTrue.has(i)) hit++;
  return hit / TOP_K;
}

const rows = [];
for (const d of LEADS) {
  const samples = perLead.get(d);
  if (!samples.length) {
    rows.push({ lead: d, w: null, note: "không đủ dữ liệu" });
    continue;
  }
  const { w, n } = fitW(samples);
  // KIỂM CHÉO theo mốc gốc (fold = nhóm mốc gốc, không trộn trong cùng mốc)
  const byOrigin = [...new Set(samples.map((s) => s.origin))];
  let cvBlend = 0;
  let cvPersist = 0;
  let cvClim = 0;
  let folds = 0;
  for (let f = 0; f < CV_FOLDS; f++) {
    const testOrigins = byOrigin.filter((_, i) => i % CV_FOLDS === f);
    if (!testOrigins.length) continue;
    const train = samples.filter((s) => !testOrigins.includes(s.origin));
    const test = samples.filter((s) => testOrigins.includes(s.origin));
    if (!train.length || !test.length) continue;
    const wTrain = fitW(train).w;
    cvBlend += rmse(test, wTrain);
    cvPersist += rmse(test, 1);
    cvClim += rmse(test, 0);
    folds++;
  }
  const cv = folds
    ? {
        blend: cvBlend / folds,
        persist: cvPersist / folds,
        clim: cvClim / folds,
      }
    : null;
  const meanHit = (ww) =>
    Math.round(
      (samples.reduce((acc, s) => acc + hitK(s, ww), 0) / samples.length) * 1000,
    ) / 10;
  rows.push({
    lead: d,
    w: Math.round(w * 1000) / 1000,
    n,
    origins: byOrigin.length,
    hitBlendPct: meanHit(w),
    hitPersistPct: meanHit(1),
    hitClimPct: meanHit(0),
    rmseBlend: Math.round(rmse(samples, w) * 100) / 100,
    rmsePersist: Math.round(rmse(samples, 1) * 100) / 100,
    rmseClim: Math.round(rmse(samples, 0) * 100) / 100,
    cvGainVsPersistPct: cv
      ? Math.round(((cv.persist - cv.blend) / cv.persist) * 10000) / 100
      : null,
    cvGainVsClimPct: cv
      ? Math.round(((cv.clim - cv.blend) / cv.clim) * 10000) / 100
      : null,
  });
}

// ÉP ĐƠN ĐIỆU KHÔNG TĂNG (ảnh cũ không thể có thêm thông tin khi tầm xa hơn)
let running = 1;
for (const r of rows) {
  if (r.w == null) continue;
  r.wRaw = r.w;
  r.w = Math.min(r.w, running);
  running = r.w;
}

console.table(
  rows.map((r) => ({
    lead: r.lead,
    w: r.w,
    n: r.n,
    rmseBlend: r.rmseBlend,
    rmsePersist: r.rmsePersist,
    "cv%vsPersist": r.cvGainVsPersistPct,
    "top100 pha": r.hitBlendPct,
    "top100 ảnh": r.hitPersistPct,
    "top100 mùa": r.hitClimPct,
  })),
);
/* CÁI GIÁ CỦA LỚP CHỌN SẢN PHẨM: chủ dự án chốt mùa vụ gánh 6 % (tầm đo đầu) →
   56 % (tầm đo cuối), cao hơn mức tối ưu theo sai số. Đo xem mất bao nhiêu độ
   "chỉ đúng chỗ" — phải in ra, không được giấu. Công thức giãn PHẢI khớp
   `climShare` trong src/lib/fish-blend.ts. */
const PRODUCT_FIRST = 0.06;
const PRODUCT_LAST = 0.56;
{
  const meas = rows.filter((r) => typeof r.w === "number");
  const lo = 1 - meas[0].w;
  const hi = 1 - meas[meas.length - 1].w;
  for (const r of meas) {
    const raw = 1 - r.w;
    const t = hi > lo ? (raw - lo) / (hi - lo) : 0;
    r.productShare = Math.round((PRODUCT_FIRST + t * (PRODUCT_LAST - PRODUCT_FIRST)) * 1000) / 1000;
    const samples = perLead.get(r.lead);
    r.hitProductPct =
      Math.round(
        (samples.reduce((a, s) => a + hitK(s, 1 - r.productShare), 0) / samples.length) * 1000,
      ) / 10;
    r.hitCostVsOptimalPct = Math.round((r.hitBlendPct - r.hitProductPct) * 10) / 10;
  }
  console.log("");
  console.log("=== CÁI GIÁ CỦA MỨC CHỦ DỰ ÁN CHỌN (6 % → 56 %) ===");
  console.table(
    meas.map((r) => ({
      lead: r.lead,
      "%mùa vụ tối ưu": Math.round((1 - r.w) * 100),
      "%mùa vụ dùng": Math.round(r.productShare * 100),
      "top100 tối ưu": r.hitBlendPct,
      "top100 khi dùng": r.hitProductPct,
      "top100 ảnh thuần": r.hitPersistPct,
      "mất bao nhiêu": r.hitCostVsOptimalPct,
    })),
  );
  /* DÒ DẠNG ĐƯỜNG CONG: giữ nguyên hai đầu 6 % → 56 % (chủ dự án chốt), chỉ đổi
     ĐỘ CONG. gamma > 1 = lên chậm mấy ngày đầu rồi vọt về cuối ⇒ giữ được độ
     chính xác ngày gần mà vẫn đủ mùa vụ cho ngày xa. Chọn theo top-100. */
  console.log("");
  console.log("=== DÒ ĐỘ CONG (hai đầu giữ nguyên 6 % → 56 %) ===");
  const gammas = [1, 1.5, 2, 2.5, 3];
  const shapeRows = [];
  for (const g of gammas) {
    const row = { gamma: g };
    let sum = 0;
    let sumFar = 0;
    for (const r of meas) {
      const raw = 1 - r.w;
      const t = hi > lo ? (raw - lo) / (hi - lo) : 0;
      const share = PRODUCT_FIRST + Math.pow(t, g) * (PRODUCT_LAST - PRODUCT_FIRST);
      const samples = perLead.get(r.lead);
      const hit =
        Math.round(
          (samples.reduce((a, x) => a + hitK(x, 1 - share), 0) / samples.length) * 1000,
        ) / 10;
      row[`d${r.lead}`] = hit;
      row[`%d${r.lead}`] = Math.round(share * 100);
      sum += hit - r.hitPersistPct;
      if (r.lead >= 8) sumFar += hit - r.hitPersistPct;
    }
    row.tongHonAnh = Math.round(sum * 10) / 10;
    row.xaHonAnh = Math.round(sumFar * 10) / 10;
    shapeRows.push(row);
  }
  console.table(
    shapeRows.map((r) => ({
      gamma: r.gamma,
      "%d3": r["%d3"], "%d8": r["%d8"], "%d16": r["%d16"],
      d1: r.d1, d3: r.d3, d5: r.d5, d8: r.d8, d11: r.d11, d16: r.d16,
      "TỔNG hơn ảnh": r.tongHonAnh,
      "TẦM XA hơn ảnh": r.xaHonAnh,
    })),
  );
  const best = shapeRows.reduce((a, b) => (b.tongHonAnh > a.tongHonAnh ? b : a));
  console.log(`⇒ ĐỘ CONG TỐT NHẤT: gamma = ${best.gamma} (tổng hơn ảnh-thuần ${best.tongHonAnh} điểm %)`);

  const stillBeats = meas.filter((r) => r.hitProductPct > r.hitPersistPct).map((r) => r.lead);
  console.log(
    stillBeats.length
      ? `Ở mức đang dùng, vẫn CHỈ ĐÚNG CHỖ hơn ảnh-thuần ở tầm: ${stillBeats.join(", ")} ngày`
      : "Ở mức đang dùng, KHÔNG còn thắng ảnh-thuần ở tầm nào — phải nói với chủ dự án",
  );
}

const hitWins = rows.filter((r) => (r.hitBlendPct ?? 0) > (r.hitPersistPct ?? 0)).map((r) => r.lead);
console.log(
  hitWins.length
    ? `CHỈ ĐÚNG CHỖ: pha thắng ảnh-thuần ở tầm ${hitWins.join(", ")} ngày`
    : "CHỈ ĐÚNG CHỖ: pha KHÔNG thắng ảnh-thuần ở tầm nào — nói thẳng, đừng giữ cho có",
);

/* ── GUARD always-on-term ─────────────────────────────────────────────────── */
const ws = rows.filter((r) => r.w != null).map((r) => r.w);
const spread = ws.length ? Math.max(...ws) - Math.min(...ws) : 0;
const allHigh = ws.every((w) => w >= 0.97);
const allLow = ws.every((w) => w <= 0.03);
const guard = {
  spread: Math.round(spread * 1000) / 1000,
  degenerate: allHigh || allLow || spread < 0.05,
  verdict: allHigh
    ? "w≈1 ở MỌI tầm — mùa vụ KHÔNG thêm được gì; đừng pha trộn, giữ persistence"
    : allLow
      ? "w≈0 ở MỌI tầm — ảnh vệ tinh thua mùa vụ ở mọi tầm; kiểm lại pipeline"
      : spread < 0.05
        ? "w gần như hằng số — pha trộn không phân biệt theo tầm ngày"
        : "OK — w phân biệt rõ theo tầm ngày",
};
console.log(`\nGUARD always-on-term: ${guard.verdict} (biên độ w = ${guard.spread})`);

const wins = rows.filter((r) => (r.cvGainVsPersistPct ?? -1) > 0).map((r) => r.lead);
console.log(
  wins.length
    ? `Blend THẮNG persistence (kiểm chéo) ở tầm: ${wins.join(", ")} ngày`
    : "Blend KHÔNG thắng persistence ở tầm nào (kiểm chéo) — nói thẳng trong doc",
);

/* ── TÁCH THEO MÙA GIÓ có đáng không? ─────────────────────────────────────
   Biển Đông có hai mùa gió trái ngược (Đông Bắc T11–T3, Tây Nam T5–T9). Nếu w
   khác nhau rõ giữa hai mùa VÀ bản tách mùa thắng khi KIỂM CHÉO, thì nên dùng
   bảng theo mùa. Không thắng → giữ MỘT bảng (ít tham số, ít cơ hội overfit) và
   ghi lại kết luận âm — đừng để lần sau đo lại từ đầu. */
const NE_MONTHS = new Set([11, 12, 1, 2, 3]);
const seasonOf = (T, d) => (NE_MONTHS.has(monthOf(addDays(T, d))) ? "NE" : "SW");

const seasonRows = [];
for (const d of LEADS) {
  const samples = perLead.get(d);
  if (!samples.length) continue;
  const bySeason = { NE: [], SW: [] };
  for (const s of samples) bySeason[seasonOf(s.origin, d)].push(s);
  if (!bySeason.NE.length || !bySeason.SW.length) continue;

  const wNE = fitW(bySeason.NE).w;
  const wSW = fitW(bySeason.SW).w;

  // KIỂM CHÉO: bảng-theo-mùa vs bảng-chung, đo trên nhóm giữ lại
  const byOrigin = [...new Set(samples.map((s) => s.origin))];
  let cvSeason = 0;
  let cvSingle = 0;
  let folds = 0;
  for (let f = 0; f < CV_FOLDS; f++) {
    const testO = byOrigin.filter((_, i) => i % CV_FOLDS === f);
    if (!testO.length) continue;
    const train = samples.filter((s) => !testO.includes(s.origin));
    const test = samples.filter((s) => testO.includes(s.origin));
    if (!train.length || !test.length) continue;
    const wAll = fitW(train).w;
    const wTrainSeason = {
      NE: fitW(train.filter((s) => seasonOf(s.origin, d) === "NE")).w,
      SW: fitW(train.filter((s) => seasonOf(s.origin, d) === "SW")).w,
    };
    // RMSE gộp hai mùa, mỗi mẫu dùng w của mùa nó
    let seSeason = 0;
    let seSingle = 0;
    let n = 0;
    for (const s of test) {
      const wS = wTrainSeason[seasonOf(s.origin, d)];
      for (let i = 0; i < s.a.length; i++) {
        const eS = wS * s.a[i] - s.b[i];
        const eA = wAll * s.a[i] - s.b[i];
        seSeason += eS * eS;
        seSingle += eA * eA;
        n++;
      }
    }
    if (!n) continue;
    cvSeason += Math.sqrt(seSeason / n);
    cvSingle += Math.sqrt(seSingle / n);
    folds++;
  }
  if (!folds) continue;
  seasonRows.push({
    lead: d,
    wNE: Math.round(wNE * 1000) / 1000,
    wSW: Math.round(wSW * 1000) / 1000,
    diff: Math.round(Math.abs(wNE - wSW) * 1000) / 1000,
    cvGainPct:
      Math.round(((cvSingle / folds - cvSeason / folds) / (cvSingle / folds)) * 10000) / 100,
  });
}

if (seasonRows.length) {
  console.log("\n=== TÁCH THEO MÙA GIÓ có đáng không? ===");
  console.table(seasonRows);
}
const seasonWins = seasonRows.filter((r) => r.cvGainPct > 0.5).map((r) => r.lead);
const seasonVerdict = !seasonRows.length
  ? "không đủ dữ liệu để so"
  : seasonWins.length >= Math.ceil(seasonRows.length / 2)
    ? `NÊN tách mùa — thắng ở tầm ${seasonWins.join(", ")} ngày (>0,5% RMSE khi kiểm chéo)`
    : "KHÔNG đáng tách mùa — bảng chung tốt ngang hoặc hơn khi kiểm chéo; giữ MỘT bảng cho gọn";
console.log(seasonVerdict);

const out = {
  generatedAt: new Date().toISOString(),
  seasonSplit: { verdict: seasonVerdict, perLead: seasonRows },
  question:
    "Tầm ngày d thì nên tin ảnh vệ tinh ngày T (persistence) bao nhiêu, tin bản mùa vụ bao nhiêu? blend = w(d)·persist + (1−w(d))·clim",
  method:
    "Bình phương tối thiểu w* = Σ(a·b)/Σ(a²) với a = persist−clim, b = truth−clim; kẹp [0,1]; ép đơn điệu không tăng theo d. Kiểm chéo 4 nhóm theo MỐC GỐC.",
  caveat:
    "SỰ THẬT ở đây là bản đồ cá tính từ ảnh vệ tinh ngày T+d (chính sản phẩm app phục vụ), KHÔNG PHẢI sản lượng cá thật. w tối ưu theo nghĩa 'khớp bản đồ ngày đó', không phải 'bắt được nhiều cá hơn'.",
  climatology: {
    file: CLIM_PATH,
    years: CLIM.years,
    generatedAt: CLIM.generatedAt,
    sources: CLIM.sources,
  },
  leads: LEADS,
  origins,
  guard,
  cvWinsOverPersistence: wins,
  topKWinsOverPersistence: hitWins,
  topK: TOP_K,
  productCurve: { first: PRODUCT_FIRST, last: PRODUCT_LAST, note: "LỚP CHỌN CỦA CHỦ DỰ ÁN, KHÔNG phải số đo — xem climShare trong src/lib/fish-blend.ts và 09 §5f" },
  perLead: rows,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\n✓ ${OUT}`);
