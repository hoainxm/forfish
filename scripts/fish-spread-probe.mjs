// scripts/fish-spread-probe.mjs   (chạy: node scripts/fish-spread-probe.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// ĐO "NỞ VÙNG" CHO NGÀY XA — ngày xa có nên tô VÙNG RỘNG thay vì Ô SẮC NÉT?
//
// VẤN ĐỀ (chủ dự án nêu 2026-07-28): lớp cá ngày +12 vẽ ô 0,25° sắc nét y hệt
// ngày +1. Ô 0,25° ≈ 28 km. Nếu điểm nóng THẬT dịch đi 60 km sau 12 ngày thì
// vẽ sắc nét là GIẢ VỜ CHÍNH XÁC: bà con chạy đúng ô đó mà cá ở ô bên cạnh.
// Cách chữa thẳng thắn: ngày xa NỞ vùng tô ra bán kính r(d) ô — nhưng r(d) phải
// ĐO ĐƯỢC, không đặt tay. Script này đo.
//
// DỮ LIỆU: kho `.cache/fish-corpus/` đã dựng sẵn (16 mốc gốc × 11 tầm ngày,
// lưới 0,25°, điểm 0..100). KHÔNG gọi lại ERDDAP.
//
// SỰ THẬT ĐỂ ĐỐI CHIẾU: bản đồ tính từ ẢNH NGÀY T+d (đúng thứ app sẽ phục vụ
// vào ngày đó). KHÔNG phải sản lượng cá thật — cùng caveat với fit-fish-blend-weights.
//
// BỐN VIỆC:
//  1. DỊCH CHUYỂN — điểm nóng ngày T chạy bao nhiêu km tới ngày T+d?
//  2. BÁN KÍNH — r(d) cần bao nhiêu để bao 75 % / 90 % dịch chuyển đó?
//  3. NỞ THẬT — cài dilation (max / gauss / decay), quét r ∈ {0..4}, đo
//     recall ↑ và precision ↓. BẮT BUỘC có phép so CÔNG BẰNG: cùng DIỆN TÍCH tô
//     thì nở có hơn việc chỉ HẠ NGƯỠNG không? (nở mà thua = chỉ là tô bừa)
//  4. "~30 %, <40 %" của chủ dự án nghĩa là gì bằng số — hai cách hiểu:
//     (a) tăng 30 % DIỆN TÍCH vùng tô · (b) hạ NGƯỠNG 40 → 30.
//
// KẾT QUẢ: .cache/fish-spread-result.json + bảng console.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const CORPUS = ".cache/fish-corpus";
const OUT = ".cache/fish-spread-result.json";

/** Ô không có trong lưới cá = điểm < KEEP_MIN(25) → dùng ước lượng của app.
    PHẢI khớp ABSENT_PERSIST trong src/lib/fish-blend.ts. */
const ABSENT_PERSIST = 12;
/** Sàn hiển thị của app: ô ≥ 40 mới được tô (src/lib/fish-blend.ts, 09 §5f) */
const PAINT_FLOOR = 40;
/** Số ô "điểm nóng" lấy làm sự thật khi đo dịch chuyển + recall */
const TOP_HOT = 50;
/** Số ô cho thước "chỉ đúng chỗ" (khớp TOP_K của fit-fish-blend-weights.mjs) */
const TOP_K = 100;
/** 0,25° vĩ ≈ 27,8 km (kinh tuyến co theo cos(vĩ) — chênh <7 % ở 5–22 °N) */
const CELL_KM = 27.83;
const STEP = 0.25;
const RADII = [0, 1, 2, 3, 4];
const KERNELS = ["max", "gauss", "decay"];

/* ── nạp kho ─────────────────────────────────────────────────────────────── */
if (!existsSync(`${CORPUS}/index.json`)) {
  console.error(`KHÔNG thấy ${CORPUS}/index.json — chạy scripts/fish-corpus-build.mjs trước.`);
  process.exit(1);
}
const index = JSON.parse(readFileSync(`${CORPUS}/index.json`, "utf8"));
const ORIGINS = index.origins ?? [];
const LEADS = index.leads ?? [];

const addDays = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const dayCache = new Map();
function loadDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  let v = null;
  try {
    v = JSON.parse(readFileSync(`${CORPUS}/days/${date}.json`, "utf8"));
  } catch {
    v = null;
  }
  dayCache.set(date, v);
  return v;
}

/* ── lưới: dựng MIỀN (union mọi ô từng có điểm) ──────────────────────────── */
const allDays = (index.days ?? []).map(loadDay).filter(Boolean);
let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity;
for (const d of allDays)
  for (const c of d.cells) {
    if (c.lat < latMin) latMin = c.lat;
    if (c.lat > latMax) latMax = c.lat;
    if (c.lon < lonMin) lonMin = c.lon;
    if (c.lon > lonMax) lonMax = c.lon;
  }
const NLAT = Math.round((latMax - latMin) / STEP) + 1;
const NLON = Math.round((lonMax - lonMin) / STEP) + 1;
const NCELL = NLAT * NLON;
const iOf = (lat) => Math.round((lat - latMin) / STEP);
const jOf = (lon) => Math.round((lon - lonMin) / STEP);

/** MIỀN BIỂN dùng chung: ô nào TỪNG có điểm ≥25 trong kho. Ô ngoài miền = đất /
    ngoài vùng chấm điểm → không bao giờ tô, không bao giờ tính vào mẫu số. */
const inDomain = new Uint8Array(NCELL);
for (const d of allDays)
  for (const c of d.cells) inDomain[iOf(c.lat) * NLON + jOf(c.lon)] = 1;
const DOMAIN = [];
for (let k = 0; k < NCELL; k++) if (inDomain[k]) DOMAIN.push(k);
const latOfIdx = (k) => latMin + Math.floor(k / NLON) * STEP;
const lonOfIdx = (k) => lonMin + (k % NLON) * STEP;

/** Trường điểm của một ngày trên toàn lưới (ô vắng = ABSENT_PERSIST) */
function fieldOf(date) {
  const day = loadDay(date);
  if (!day) return null;
  const f = new Float32Array(NCELL);
  for (const k of DOMAIN) f[k] = ABSENT_PERSIST;
  for (const c of day.cells) f[iOf(c.lat) * NLON + jOf(c.lon)] = c.s;
  return f;
}

/* ── khoảng cách thật (haversine) ────────────────────────────────────────── */
const R_EARTH = 6371;
const rad = (x) => (x * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

/* ── tiện ích thống kê ───────────────────────────────────────────────────── */
const pct = (sorted, p) => {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** K ô điểm cao nhất trong MIỀN (tie-break theo chỉ số cho ổn định) */
function topCells(field, k) {
  const arr = DOMAIN.map((idx) => [field[idx], idx]);
  arr.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return arr.slice(0, k).map((x) => x[1]);
}

/* ── PHÉP NỞ (dilation) ──────────────────────────────────────────────────── */
const offsetCache = new Map();
/** Các lệch (di,dj,khoảng cách ô) trong đĩa bán kính r ô */
function offsets(r) {
  if (offsetCache.has(r)) return offsetCache.get(r);
  const out = [];
  for (let di = -r; di <= r; di++)
    for (let dj = -r; dj <= r; dj++) {
      const d = Math.hypot(di, dj);
      if (d <= r + 1e-9) out.push([di, dj, d]);
    }
  offsetCache.set(r, out);
  return out;
}

/**
 * Nở trường điểm.
 *  · max   — ô lấy ĐIỂM CAO NHẤT trong bán kính r (vùng tô phình đều, không giảm)
 *  · gauss — trung bình có trọng số khoảng cách (làm mượt: đỉnh tụt, chân dâng)
 *  · decay — lấy max của (điểm × hệ số suy giảm theo khoảng cách): lan ra nhưng
 *            càng xa càng nhạt — sát nghĩa "càng xa càng không chắc chỗ nào"
 */
function dilate(field, kernel, r) {
  if (r === 0) return field;
  const out = new Float32Array(NCELL);
  const offs = offsets(r);
  const sigma = r / 1.5;
  const wOf = (d) => Math.exp(-(d * d) / (2 * sigma * sigma));
  for (const k of DOMAIN) {
    const i = Math.floor(k / NLON);
    const j = k % NLON;
    let best = -Infinity;
    let acc = 0;
    let wsum = 0;
    for (const [di, dj, d] of offs) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || ii >= NLAT || jj < 0 || jj >= NLON) continue;
      const kk = ii * NLON + jj;
      if (!inDomain[kk]) continue;
      const v = field[kk];
      if (kernel === "max") {
        if (v > best) best = v;
      } else if (kernel === "decay") {
        const vv = v * wOf(d);
        if (vv > best) best = vv;
      } else {
        const w = wOf(d);
        acc += w * v;
        wsum += w;
      }
    }
    out[k] =
      kernel === "gauss"
        ? wsum > 0
          ? acc / wsum
          : field[k]
        : best > -Infinity
          ? best
          : field[k];
  }
  return out;
}

/* ── VIỆC 1+2: ĐO DỊCH CHUYỂN CỦA ĐIỂM NÓNG ─────────────────────────────── */
console.log("═".repeat(78));
console.log("VIỆC 1 — ĐIỂM NÓNG CHẠY BAO NHIÊU KM?");
console.log(
  `  top-${TOP_HOT} ô cao nhất ngày T → ô nóng THẬT gần nhất ngày T+d (haversine).`,
);
console.log("═".repeat(78));

const dispByLead = new Map(); // lead → mảng khoảng cách km (gần nhất, thuận)
const revByLead = new Map(); // lead → khoảng cách NGƯỢC (ô nóng thật → ô app chỉ)
const nullByLead = new Map(); // lead → khoảng cách từ ô NGẪU NHIÊN (mốc so sánh)
const rank1ByLead = new Map(); // lead → ô SỐ 1 của app cách ô SỐ 1 thật bao xa
const centByLead = new Map(); // lead → trọng tâm đám top-50 dịch bao xa
const pairs = []; // (origin, lead) dùng được

// mẫu ngẫu nhiên cố định hạt giống để tái lập
let seed = 20260728;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

for (const origin of ORIGINS) {
  const fT = fieldOf(origin);
  if (!fT) continue;
  const hotT = topCells(fT, TOP_HOT);
  for (const d of LEADS) {
    const target = addDays(origin, d);
    const fTd = fieldOf(target);
    if (!fTd) continue;
    pairs.push({ origin, lead: d, target });
    const hotTd = topCells(fTd, TOP_HOT);
    const hotXY = hotTd.map((k) => [latOfIdx(k), lonOfIdx(k)]);
    const nearest = (lat, lon) => {
      let best = Infinity;
      for (const [la, lo] of hotXY) {
        const dd = haversine(lat, lon, la, lo);
        if (dd < best) best = dd;
      }
      return best;
    };
    if (!dispByLead.has(d)) dispByLead.set(d, []);
    if (!revByLead.has(d)) revByLead.set(d, []);
    if (!nullByLead.has(d)) nullByLead.set(d, []);
    if (!rank1ByLead.has(d)) rank1ByLead.set(d, []);
    if (!centByLead.has(d)) centByLead.set(d, []);
    for (const k of hotT) dispByLead.get(d).push(nearest(latOfIdx(k), lonOfIdx(k)));
    for (let s = 0; s < TOP_HOT; s++) {
      const k = DOMAIN[Math.floor(rnd() * DOMAIN.length)];
      nullByLead.get(d).push(nearest(latOfIdx(k), lonOfIdx(k)));
    }
    // NGƯỢC: ô nóng THẬT cách ô app-chỉ gần nhất bao xa (thiếu chỗ nào thì lộ ra đây)
    const predXY = hotT.map((k) => [latOfIdx(k), lonOfIdx(k)]);
    for (const k of hotTd) {
      const la = latOfIdx(k);
      const lo = lonOfIdx(k);
      let best = Infinity;
      for (const [a, b] of predXY) {
        const dd = haversine(la, lo, a, b);
        if (dd < best) best = dd;
      }
      revByLead.get(d).push(best);
    }
    // Ô SỐ 1 (chỗ bà con sẽ chạy tới trước) — thước nghiêm nhất
    rank1ByLead
      .get(d)
      .push(
        haversine(latOfIdx(hotT[0]), lonOfIdx(hotT[0]), latOfIdx(hotTd[0]), lonOfIdx(hotTd[0])),
      );
    // TRỌNG TÂM đám điểm nóng — dịch chuyển "khối", lọc nhiễu từng ô
    const cen = (list) => [
      mean(list.map(latOfIdx)),
      mean(list.map(lonOfIdx)),
    ];
    const [aLat, aLon] = cen(hotT);
    const [bLat, bLon] = cen(hotTd);
    centByLead.get(d).push(haversine(aLat, aLon, bLat, bLon));
  }
}

const dispRows = [];
for (const d of LEADS) {
  const a = (dispByLead.get(d) ?? []).slice().sort((x, y) => x - y);
  const rv = (revByLead.get(d) ?? []).slice().sort((x, y) => x - y);
  const nl = (nullByLead.get(d) ?? []).slice().sort((x, y) => x - y);
  const r1s = (rank1ByLead.get(d) ?? []).slice().sort((x, y) => x - y);
  const ct = (centByLead.get(d) ?? []).slice().sort((x, y) => x - y);
  if (!a.length) continue;
  const p50 = pct(a, 0.5);
  const p75 = pct(a, 0.75);
  const p90 = pct(a, 0.9);
  dispRows.push({
    lead: d,
    n: a.length,
    medianKm: r1(p50),
    p75Km: r1(p75),
    p90Km: r1(p90),
    meanKm: r1(mean(a)),
    kmPerDay: r2(mean(a) / d),
    revMedianKm: r1(pct(rv, 0.5)),
    revP75Km: r1(pct(rv, 0.75)),
    revP90Km: r1(pct(rv, 0.9)),
    rank1MedianKm: r1(pct(r1s, 0.5)),
    rank1MeanKm: r1(mean(r1s)),
    centroidMedianKm: r1(pct(ct, 0.5)),
    nullMedianKm: r1(pct(nl, 0.5)),
    // bán kính cần (ô 0,25°) để bao 75 % / 90 % dịch chuyển
    rCells75: r2(p75 / CELL_KM),
    rCells90: r2(p90 / CELL_KM),
    revRCells75: r2(pct(rv, 0.75) / CELL_KM),
    revRCells90: r2(pct(rv, 0.9) / CELL_KM),
  });
}
console.table(
  dispRows.map((r) => ({
    "tầm (ngày)": r.lead,
    "trung vị km": r.medianKm,
    "p75 km": r.p75Km,
    "p90 km": r.p90Km,
    "TB km/ngày": r.kmPerDay,
    "ngược p75 km": r.revP75Km,
    "ngược p90 km": r.revP90Km,
    "ô SỐ 1 lệch (trung vị km)": r.rank1MedianKm,
    "trọng tâm dịch (km)": r.centroidMedianKm,
    "ô ngẫu nhiên (km)": r.nullMedianKm,
    "r ô cho 75%": r.rCells75,
    "r ô cho 90%": r.rCells90,
  })),
);
console.log(
  `  (mốc so: ô NGẪU NHIÊN trong miền cách ô nóng gần nhất ~${dispRows[0]?.nullMedianKm} km —` +
    ` điểm nóng ngày T mà gần hơn nhiều thì ảnh hôm nay THẬT SỰ có thông tin vị trí)`,
);

/* ── VIỆC 3: NỞ THẬT — recall / precision / diện tích ────────────────────── */
console.log("");
console.log("═".repeat(78));
console.log("VIỆC 3 — NỞ THẬT: quét r ∈ {0..4} ô × kiểu {max, gauss, decay}");
console.log(
  `  vùng tô = ô có điểm dự báo ≥ ${PAINT_FLOOR} · recall = % top-${TOP_HOT} ô nóng THẬT nằm trong vùng tô`,
);
console.log(
  `  precision = % ô trong vùng tô mà THẬT SỰ ≥ ${PAINT_FLOOR} ngày đó · F1 = cân bằng hai cái`,
);
console.log("═".repeat(78));

/** Đo một cặp (T, T+d) với một trường dự báo */
function evalPred(pred, truth, truthHot, truthGood, baselineArea) {
  const paint = [];
  for (const k of DOMAIN) if (pred[k] >= PAINT_FLOOR) paint.push(k);
  const paintSet = new Set(paint);
  let hitHot = 0;
  for (const k of truthHot) if (paintSet.has(k)) hitHot++;
  let hitGood = 0;
  for (const k of paint) if (truth[k] >= PAINT_FLOOR) hitGood++;
  const precision = paint.length ? hitGood / paint.length : NaN;
  const recallHot = truthHot.length ? hitHot / truthHot.length : NaN;
  const recallGood = truthGood.size ? hitGood / truthGood.size : NaN;
  const f1 =
    Number.isFinite(precision) && Number.isFinite(recallGood) && precision + recallGood > 0
      ? (2 * precision * recallGood) / (precision + recallGood)
      : 0;

  // top-K "chỉ đúng chỗ" (không phụ thuộc ngưỡng)
  const topP = topCells(pred, TOP_K);
  const topT = new Set(topCells(truth, TOP_K));
  let hitK = 0;
  for (const k of topP) if (topT.has(k)) hitK++;

  // SO CÔNG BẰNG: cắt vùng tô về ĐÚNG diện tích của bản KHÔNG NỞ
  let recallHotMatched = NaN;
  let precisionMatched = NaN;
  if (baselineArea > 0) {
    const topA = topCells(pred, baselineArea);
    const setA = new Set(topA);
    let hh = 0;
    for (const k of truthHot) if (setA.has(k)) hh++;
    let hg = 0;
    for (const k of topA) if (truth[k] >= PAINT_FLOOR) hg++;
    recallHotMatched = truthHot.length ? hh / truthHot.length : NaN;
    precisionMatched = topA.length ? hg / topA.length : NaN;
  }

  // DIỆN TÍCH CẦN để bao 75 % ô nóng thật (tô theo hạng, không theo ngưỡng)
  const ranked = DOMAIN.map((k) => [pred[k], k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const hotSet = new Set(truthHot);
  const need = Math.ceil(0.75 * truthHot.length);
  let got = 0;
  let areaFor75 = ranked.length;
  for (let i = 0; i < ranked.length; i++) {
    if (hotSet.has(ranked[i][1])) got++;
    if (got >= need) {
      areaFor75 = i + 1;
      break;
    }
  }
  return {
    area: paint.length,
    recallHot,
    precision,
    recallGood,
    f1,
    topKHit: hitK / TOP_K,
    recallHotMatched,
    precisionMatched,
    areaFor75,
  };
}

/** gom trung bình các phép đo qua các mốc gốc */
function agg(list) {
  const keys = Object.keys(list[0] ?? {});
  const out = {};
  for (const k of keys) out[k] = mean(list.map((x) => x[k]).filter(Number.isFinite));
  return out;
}

const results = []; // {lead, kernel, r, ...}
const cache = new Map(); // origin → field
const fieldFor = (date) => {
  if (!cache.has(date)) cache.set(date, fieldOf(date));
  return cache.get(date);
};

for (const d of LEADS) {
  const perCombo = new Map();
  for (const origin of ORIGINS) {
    const fT = fieldFor(origin);
    const fTd = fieldFor(addDays(origin, d));
    if (!fT || !fTd) continue;
    const truthHot = topCells(fTd, TOP_HOT);
    const truthGood = new Set(DOMAIN.filter((k) => fTd[k] >= PAINT_FLOOR));
    let baselineArea = 0;
    for (const k of DOMAIN) if (fT[k] >= PAINT_FLOOR) baselineArea++;
    for (const kernel of KERNELS) {
      for (const r of RADII) {
        if (r === 0 && kernel !== "max") continue; // r=0 giống nhau ở mọi kiểu
        const pred = dilate(fT, kernel, r);
        const m = evalPred(pred, fTd, truthHot, truthGood, baselineArea);
        m.baselineArea = baselineArea;
        const key = `${kernel}|${r}`;
        if (!perCombo.has(key)) perCombo.set(key, []);
        perCombo.get(key).push(m);
      }
    }
  }
  for (const [key, list] of perCombo) {
    const [kernel, rs] = key.split("|");
    const a = agg(list);
    results.push({
      lead: d,
      kernel: rs === "0" ? "—" : kernel,
      r: Number(rs),
      n: list.length,
      area: Math.round(a.area),
      areaRatio: r2(a.area / a.baselineArea),
      /** recall mà một vùng tô CÙNG DIỆN TÍCH nhưng đặt NGẪU NHIÊN sẽ đạt —
          mốc để biết recall cao là do biết chỗ hay chỉ do tô rộng */
      randomRecallPct: r1((a.area / DOMAIN.length) * 100),
      recallHotPct: r1(a.recallHot * 100),
      precisionPct: r1(a.precision * 100),
      recallGoodPct: r1(a.recallGood * 100),
      f1Pct: r1(a.f1 * 100),
      topKHitPct: r1(a.topKHit * 100),
      recallHotMatchedPct: r1(a.recallHotMatched * 100),
      precisionMatchedPct: r1(a.precisionMatched * 100),
      areaFor75: Math.round(a.areaFor75),
    });
  }
}

const SHOW_LEADS = LEADS.filter((d) => [1, 3, 5, 8, 12, 16].includes(d));
for (const d of SHOW_LEADS) {
  console.log(`\n── tầm +${d} ngày ─────────────────────────────────────────────`);
  console.table(
    results
      .filter((x) => x.lead === d)
      .sort((a, b) => a.r - b.r || a.kernel.localeCompare(b.kernel))
      .map((x) => ({
        kiểu: x.kernel,
        "r (ô)": x.r,
        "r (km)": Math.round(x.r * CELL_KM),
        "ô tô": x.area,
        "×diện tích": x.areaRatio,
        "recall %": x.recallHotPct,
        "recall nếu tô BỪA %": x.randomRecallPct,
        "precision %": x.precisionPct,
        "F1 %": x.f1Pct,
        "top100 %": x.topKHitPct,
        "recall khi CÙNG diện tích %": x.recallHotMatchedPct,
      })),
  );
}

/* ── VIỆC 3b: PHÉP SO CÔNG BẰNG — nở vs chỉ HẠ NGƯỠNG ───────────────────── */
console.log("");
console.log("═".repeat(78));
console.log("VIỆC 3b — CÔNG BẰNG: cùng một DIỆN TÍCH tô, nở có hơn hạ ngưỡng không?");
console.log(
  "  (nở luôn làm recall tăng vì tô nhiều hơn — muốn biết nở có ĐÁNG không thì phải",
);
console.log("   so với cách rẻ nhất để tô nhiều hơn: hạ ngưỡng trên bản KHÔNG nở)");
console.log("═".repeat(78));

/** recall của "tô A ô cao điểm nhất" trên trường pred */
function recallAtArea(pred, truthHot, A) {
  const top = new Set(topCells(pred, A));
  let h = 0;
  for (const k of truthHot) if (top.has(k)) h++;
  return truthHot.length ? h / truthHot.length : NaN;
}
function precisionAtArea(pred, truth, A) {
  const top = topCells(pred, A);
  let h = 0;
  for (const k of top) if (truth[k] >= PAINT_FLOOR) h++;
  return top.length ? h / top.length : NaN;
}

const fairRows = [];
for (const d of LEADS) {
  const per = new Map();
  for (const origin of ORIGINS) {
    const fT = fieldFor(origin);
    const fTd = fieldFor(addDays(origin, d));
    if (!fT || !fTd) continue;
    const truthHot = topCells(fTd, TOP_HOT);
    let A0 = 0;
    for (const k of DOMAIN) if (fT[k] >= PAINT_FLOOR) A0++;
    for (const kernel of KERNELS) {
      for (const r of RADII) {
        if (r === 0) continue;
        const pred = dilate(fT, kernel, r);
        // diện tích thật khi nở rồi cắt ở ngưỡng 40
        let A = 0;
        for (const k of DOMAIN) if (pred[k] >= PAINT_FLOOR) A++;
        A = Math.min(A, DOMAIN.length);
        if (A <= 0) continue;
        const rDil = recallAtArea(pred, truthHot, A);
        const rThr = recallAtArea(fT, truthHot, A); // CÙNG diện tích, KHÔNG nở
        const pDil = precisionAtArea(pred, fTd, A);
        const pThr = precisionAtArea(fT, fTd, A);
        const key = `${kernel}|${r}`;
        if (!per.has(key)) per.set(key, []);
        per.get(key).push({
          A,
          ratio: A / A0,
          rDil,
          rThr,
          gain: rDil - rThr,
          pDil,
          pThr,
          pGain: pDil - pThr,
        });
      }
    }
  }
  for (const [key, list] of per) {
    const [kernel, rs] = key.split("|");
    const a = agg(list);
    fairRows.push({
      lead: d,
      kernel,
      r: Number(rs),
      areaRatio: r2(a.ratio),
      recallDilPct: r1(a.rDil * 100),
      recallThrOnlyPct: r1(a.rThr * 100),
      recallGainPct: r1(a.gain * 100),
      precisionDilPct: r1(a.pDil * 100),
      precisionThrOnlyPct: r1(a.pThr * 100),
      precisionGainPct: r1(a.pGain * 100),
    });
  }
}
for (const d of SHOW_LEADS) {
  console.log(`\n── tầm +${d} ngày (cùng diện tích) ──────────────────────────`);
  console.table(
    fairRows
      .filter((x) => x.lead === d)
      .sort((a, b) => a.r - b.r || a.kernel.localeCompare(b.kernel))
      .map((x) => ({
        kiểu: x.kernel,
        "r (ô)": x.r,
        "×diện tích": x.areaRatio,
        "recall NỞ %": x.recallDilPct,
        "recall chỉ hạ ngưỡng %": x.recallThrOnlyPct,
        "nở HƠN %": x.recallGainPct,
        "precision NỞ %": x.precisionDilPct,
        "precision hạ ngưỡng %": x.precisionThrOnlyPct,
      })),
  );
}

/* ── VIỆC 4: "~30 %, <40 %" NGHĨA LÀ GÌ ─────────────────────────────────── */
console.log("");
console.log("═".repeat(78));
console.log('VIỆC 4 — GIẢI NGHĨA "nở ~30 %, <40 %" của chủ dự án');
console.log("  (a) TĂNG 30 % DIỆN TÍCH vùng tô   (b) HẠ NGƯỠNG 40 → 30 điểm");
console.log("═".repeat(78));

const interpRows = [];
for (const d of LEADS) {
  const list = [];
  for (const origin of ORIGINS) {
    const fT = fieldFor(origin);
    const fTd = fieldFor(addDays(origin, d));
    if (!fT || !fTd) continue;
    const truthHot = topCells(fTd, TOP_HOT);
    let A0 = 0;
    for (const k of DOMAIN) if (fT[k] >= PAINT_FLOOR) A0++;
    // (a) tô thêm 30 % diện tích, bằng cách NỞ (decay) vs bằng HẠ NGƯỠNG
    const A30 = Math.round(A0 * 1.3);
    // tìm r (decay) cho tỷ lệ diện tích gần 1,30 nhất
    let bestR = 1;
    let bestGap = Infinity;
    let bestPred = null;
    for (const r of RADII.filter((x) => x > 0)) {
      const pred = dilate(fT, "decay", r);
      let A = 0;
      for (const k of DOMAIN) if (pred[k] >= PAINT_FLOOR) A++;
      const gap = Math.abs(A / A0 - 1.3);
      if (gap < bestGap) {
        bestGap = gap;
        bestR = r;
        bestPred = pred;
      }
    }
    // (b) hạ ngưỡng 40 → 30 trên bản KHÔNG nở
    let A30thr = 0;
    for (const k of DOMAIN) if (fT[k] >= 30) A30thr++;
    let hit30 = 0;
    const set30 = new Set(DOMAIN.filter((k) => fT[k] >= 30));
    for (const k of truthHot) if (set30.has(k)) hit30++;
    let good30 = 0;
    for (const k of set30) if (fTd[k] >= PAINT_FLOOR) good30++;
    // recall gốc (ngưỡng 40, không nở)
    const set40 = new Set(DOMAIN.filter((k) => fT[k] >= PAINT_FLOOR));
    let hit40 = 0;
    for (const k of truthHot) if (set40.has(k)) hit40++;
    let good40 = 0;
    for (const k of set40) if (fTd[k] >= PAINT_FLOOR) good40++;

    list.push({
      A0,
      // (a) diện tích +30 % bằng hạng (không phụ thuộc kernel)
      recallArea130: recallAtArea(fT, truthHot, A30),
      precisionArea130: precisionAtArea(fT, fTd, A30),
      // (a') diện tích +30 % bằng NỞ decay
      rBest: bestR,
      recallDil130: bestPred ? recallAtArea(bestPred, truthHot, A30) : NaN,
      precisionDil130: bestPred ? precisionAtArea(bestPred, fTd, A30) : NaN,
      // (b) hạ ngưỡng 40 → 30
      areaRatioThr30: A30thr / A0,
      recallThr30: hit30 / truthHot.length,
      precisionThr30: set30.size ? good30 / set30.size : NaN,
      // gốc
      recall40: hit40 / truthHot.length,
      precision40: set40.size ? good40 / set40.size : NaN,
    });
  }
  if (!list.length) continue;
  const a = agg(list);
  interpRows.push({
    lead: d,
    baseArea: Math.round(a.A0),
    recall40Pct: r1(a.recall40 * 100),
    precision40Pct: r1(a.precision40 * 100),
    // (a)
    recallArea130Pct: r1(a.recallArea130 * 100),
    precisionArea130Pct: r1(a.precisionArea130 * 100),
    rBestForPlus30: r2(a.rBest),
    recallDil130Pct: r1(a.recallDil130 * 100),
    precisionDil130Pct: r1(a.precisionDil130 * 100),
    // (b)
    areaRatioThr30: r2(a.areaRatioThr30),
    recallThr30Pct: r1(a.recallThr30 * 100),
    precisionThr30Pct: r1(a.precisionThr30 * 100),
  });
}
console.table(
  interpRows.map((x) => ({
    "tầm": x.lead,
    "ô tô gốc": x.baseArea,
    "recall gốc %": x.recall40Pct,
    "prec gốc %": x.precision40Pct,
    "(a) +30%dt bằng HẠ NGƯỠNG: recall %": x.recallArea130Pct,
    "(a) prec %": x.precisionArea130Pct,
    "(a) r decay cho +30%dt": x.rBestForPlus30,
    "(a') +30%dt bằng NỞ: recall %": x.recallDil130Pct,
    "(a') prec %": x.precisionDil130Pct,
    "(b) ×dt khi hạ 40→30": x.areaRatioThr30,
    "(b) recall %": x.recallThr30Pct,
    "(b) prec %": x.precisionThr30Pct,
  })),
);

/* ── VIỆC 5: KHUYẾN NGHỊ r(d) ───────────────────────────────────────────── */
console.log("");
console.log("═".repeat(78));
console.log("VIỆC 5 — KHUYẾN NGHỊ r(d)");
console.log("═".repeat(78));

/** Chọn r cho mỗi tầm: lấy r có F1 cao nhất, NHƯNG chỉ nhận nếu phép so CÔNG
    BẰNG cho thấy nở thắng hạ-ngưỡng (recallGain > 0) — không thì r = 0. */
const recRows = [];
for (const d of LEADS) {
  const cands = results.filter((x) => x.lead === d);
  const base = cands.find((x) => x.r === 0);
  let best = base;
  for (const c of cands) {
    if (c.r === 0) continue;
    const fair = fairRows.find((f) => f.lead === d && f.kernel === c.kernel && f.r === c.r);
    if (!fair || (fair.recallGainPct ?? 0) <= 0) continue; // nở không thắng hạ ngưỡng ⇒ loại
    if ((c.f1Pct ?? 0) > (best.f1Pct ?? 0)) best = c;
  }
  // bán kính "vật lý" gợi ý từ dịch chuyển đo được (bao 75 %)
  const disp = dispRows.find((x) => x.lead === d);
  // giá phải trả nếu VẪN nở theo kiểu max (nở thấy rõ nhất trên bản đồ)
  const m1 = cands.find((x) => x.kernel === "max" && x.r === 1);
  const m2 = cands.find((x) => x.kernel === "max" && x.r === 2);
  recRows.push({
    lead: d,
    rPhysical75: disp?.rCells75 ?? null,
    rPhysical90: disp?.rCells90 ?? null,
    /** BÁN KÍNH KHÔNG-CHẮC để vẽ VIỀN MỜ (không đụng điểm): làm tròn lên từ p75 */
    rHaloVisual: Math.ceil(disp?.rCells75 ?? 0),
    maxR1_dRecall: r1((m1?.recallHotPct ?? 0) - (base?.recallHotPct ?? 0)),
    maxR1_dPrecision: r1((m1?.precisionPct ?? 0) - (base?.precisionPct ?? 0)),
    maxR1_dTop100: r1((m1?.topKHitPct ?? 0) - (base?.topKHitPct ?? 0)),
    maxR2_dRecall: r1((m2?.recallHotPct ?? 0) - (base?.recallHotPct ?? 0)),
    maxR2_dPrecision: r1((m2?.precisionPct ?? 0) - (base?.precisionPct ?? 0)),
    maxR2_dTop100: r1((m2?.topKHitPct ?? 0) - (base?.topKHitPct ?? 0)),
    rChosen: best?.r ?? 0,
    kernelChosen: best?.r ? best.kernel : "—",
    recallBasePct: base?.recallHotPct ?? null,
    recallChosenPct: best?.recallHotPct ?? null,
    dRecallPct: r1((best?.recallHotPct ?? 0) - (base?.recallHotPct ?? 0)),
    precisionBasePct: base?.precisionPct ?? null,
    precisionChosenPct: best?.precisionPct ?? null,
    dPrecisionPct: r1((best?.precisionPct ?? 0) - (base?.precisionPct ?? 0)),
    f1BasePct: base?.f1Pct ?? null,
    f1ChosenPct: best?.f1Pct ?? null,
    areaRatio: best?.areaRatio ?? 1,
  });
}
console.table(
  recRows.map((x) => ({
    "tầm (ngày)": x.lead,
    "r vật lý p75 (ô)": x.rPhysical75,
    "r vật lý p90 (ô)": x.rPhysical90,
    "r NỞ ĐIỂM (đo được)": x.rChosen,
    kiểu: x.kernelChosen,
    "r VIỀN MỜ nên vẽ (ô)": x.rHaloVisual,
    "recall gốc %": x.recallBasePct,
    "precision gốc %": x.precisionBasePct,
    "F1 gốc %": x.f1BasePct,
  })),
);

console.log(
  "\nGIÁ PHẢI TRẢ NẾU VẪN NỞ ĐIỂM (kiểu max — kiểu 'phình vùng' rõ nhất trên bản đồ):",
);
console.table(
  recRows.map((x) => ({
    "tầm (ngày)": x.lead,
    "r=1: Δrecall": x.maxR1_dRecall,
    "r=1: Δprecision": x.maxR1_dPrecision,
    "r=1: Δtop100": x.maxR1_dTop100,
    "r=2: Δrecall": x.maxR2_dRecall,
    "r=2: Δprecision": x.maxR2_dPrecision,
    "r=2: Δtop100": x.maxR2_dTop100,
  })),
);

/* ── PHÁN QUYẾT ─────────────────────────────────────────────────────────── */
const fairWins = fairRows.filter((f) => (f.recallGainPct ?? 0) > 0.5);
const anyF1Win = results.some((x) => {
  if (x.r === 0) return false;
  const b = results.find((y) => y.lead === x.lead && y.r === 0);
  return (x.f1Pct ?? 0) > (b?.f1Pct ?? 0) + 0.5;
});
const verdict = {
  dilationBeatsNoDilationOnF1: anyF1Win,
  dilationBeatsThresholdAtEqualArea: fairWins.length,
  fairComparisonsTotal: fairRows.length,
  text: anyF1Win
    ? "CÓ tầm nào đó nở làm F1 tốt hơn — xem bảng."
    : "KHÔNG tầm nào nở ĐIỂM làm F1 tốt hơn KHÔNG nở; và ở CÙNG diện tích tô, " +
      "nở gần như luôn THUA việc chỉ hạ ngưỡng ⇒ nở ĐIỂM chỉ là tô rộng thêm, " +
      "không thêm thông tin. Muốn nói 'ngày xa kém chắc' thì vẽ VIỀN MỜ theo " +
      "rHaloVisual (đo từ dịch chuyển thật) và/hoặc hạ ngưỡng — ĐỪNG bôi điểm.",
};
console.log(`\nPHÁN QUYẾT: ${verdict.text}`);
console.log(
  `  · nở thắng hạ-ngưỡng ở ${fairWins.length}/${fairRows.length} phép so cùng-diện-tích`,
);

/* ── xuất ────────────────────────────────────────────────────────────────── */
const payload = {
  builtAt: new Date().toISOString().slice(0, 10),
  method: {
    corpus: CORPUS,
    origins: ORIGINS.length,
    leads: LEADS,
    pairs: pairs.length,
    domainCells: DOMAIN.length,
    gridStepDeg: STEP,
    cellKm: CELL_KM,
    absentPersist: ABSENT_PERSIST,
    paintFloor: PAINT_FLOOR,
    topHot: TOP_HOT,
    topK: TOP_K,
    kernels: KERNELS,
    radii: RADII,
    truth:
      "bản đồ tính từ ẢNH ngày T+d (cùng pipeline app) — KHÔNG phải sản lượng cá thật",
  },
  displacement: dispRows,
  sweep: results,
  fairness: fairRows,
  interpretation30: interpRows,
  recommendation: recRows,
  verdict,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 1));
console.log(`\n→ đã ghi ${OUT}`);
