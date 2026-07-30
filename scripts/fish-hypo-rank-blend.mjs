// scripts/fish-hypo-rank-blend.mjs   (chạy: npx tsx scripts/fish-hypo-rank-blend.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// GIẢ THUYẾT #4 — "VẶN LẠI ĐÚNG THƯỚC ĐO":
//   (a) fit w bằng TOP-100 (thước đo dự án tuyên bố là đúng) thay vì bình phương
//       nhỏ nhất (thước RMSE mà chính dự án nói là SAI);
//   (b) pha ở KHÔNG GIAN HẠNG (phân vị) thay vì ở mức GIÁ TRỊ;
//   (c) kiểm chéo LOYO theo NĂM (4 năm × 4 mốc gốc) — không trộn mẫu trong mốc;
//   (d) tính lại "cái giá" của mức sản phẩm 56 % bằng thước đúng.
//
// KHÔNG sửa src/. Chỉ đọc .cache/fish-corpus + public/data/fish-climatology.v1.json.
// 0 request mạng.
//
// SỰ THẬT = bản đồ cá tính từ ảnh vệ tinh ngày T+d bằng chính buildFishForecast
// (đã nằm sẵn trong kho). KHÔNG PHẢI sản lượng cá thật.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClimScaleMap,
  decodeClimatology,
  ABSENT_PERSIST,
  climShare,
} from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const OUT = join(ROOT, ".cache", "fish-hypo-rank-blend-result.json");

const TOP_K = 100;
const SHARE_GRID = Array.from({ length: 51 }, (_, i) => i * 0.02); // 0..1 bước 0,02

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (isoStr, n) => {
  const d = new Date(`${isoStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
if (!existsSync(join(CORPUS, "index.json"))) {
  console.error(`KHÔNG thấy ${CORPUS}/index.json — chạy scripts/fish-corpus-build.mjs trước.`);
  process.exit(1);
}
const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM = decodeClimatology(JSON.parse(readFileSync(CLIM_PATH, "utf8")));
const { lat0, lon0, dLat, dLon, nLat, nLon } = CLIM.meta;

const dayCache = new Map();
function loadDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  const p = join(CORPUS, "days", `${date}.json`);
  const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  dayCache.set(date, v);
  return v;
}
function climRawAt(lat, lon, month) {
  const buf = CLIM.months.get(month);
  if (!buf) return 0;
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/* ── thước đo ─────────────────────────────────────────────────────────────── */
/** hạng trung bình (đồng hạng lấy hạng trung bình) */
function ranks(arr) {
  const n = arr.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => arr[a] - arr[b]);
  const rk = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && arr[idx[j + 1]] === arr[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rk[idx[k]] = avg;
    i = j + 1;
  }
  return rk;
}
/** phân vị 0..100 (hạng trung bình chuẩn hoá) — KHÔNG GIAN HẠNG dùng để pha */
function pct(arr) {
  const rk = ranks(arr);
  const n = arr.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = ((rk[i] - 0.5) / n) * 100;
  return out;
}
/** chỉ số TOP_K ô cao nhất (tie-break theo chỉ số ô — GIỐNG NHAU cho mọi biến thể) */
function topKIdx(vals, K) {
  const n = vals.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => (vals[b] - vals[a]) || (a - b));
  return idx.slice(0, K);
}

/* ── dựng mẫu ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads.slice();
const YEAR_OF = (T) => Number(T.slice(0, 4));
const samples = new Map(LEADS.map((d) => [d, []]));
let skipped = 0;

for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const persist = new Map(dayT.cells.map((c) => [`${c.lat},${c.lon}`, c.s]));
  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const m = dayY.month; // mùa vụ theo THÁNG ĐÍCH (đúng như runtime)
    const truth = new Map(dayY.cells.map((c) => [`${c.lat},${c.lon}`, c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayT.cells.map((c) => c.s));

    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf)
      for (let i = 0; i < nLat; i++)
        for (let j = 0; j < nLon; j++) {
          if (!buf[i * nLon + j]) continue;
          const lat = Math.round((lat0 + i * dLat) * 100) / 100;
          const lon = Math.round((lon0 + j * dLon) * 100) / 100;
          keys.add(`${lat},${lon}`);
        }

    const n = keys.size;
    const P = new Float64Array(n);
    const C = new Float64Array(n);
    const Craw = new Float64Array(n);
    const Y = new Float64Array(n);
    let i = 0;
    for (const k of keys) {
      const [lat, lon] = k.split(",").map(Number);
      P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST;
      Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST;
      Craw[i] = climRawAt(lat, lon, m);
      C[i] = scale[Math.min(100, Craw[i])] ?? 0;
      i++;
    }
    samples.get(d).push({
      origin: T,
      year: YEAR_OF(T),
      target,
      month: m,
      P, C, Craw, Y,
      pP: pct(P),
      pC: pct(C),
      dayTcells: dayT.cells.map((c) => c.s), // để tái dựng đoạn GIÃN của fish-blend
      topTrue: new Set(topKIdx(Y, TOP_K)),
    });
  }
  process.stdout.write(".");
}
console.log(`\n${LEADS.length} tầm × ${INDEX.origins.length} mốc gốc (bỏ ${skipped} cặp thiếu ngày)\n`);

function hitOf(s, pred) {
  let hit = 0;
  for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) hit++;
  return hit / TOP_K;
}
/** pha ở MỨC GIÁ TRỊ (đúng như fish-blend.ts hiện tại, trước đoạn giãn) */
function hitValue(s, share) {
  const n = s.P.length;
  const w = 1 - share;
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = w * s.P[i] + share * s.C[i];
  return hitOf(s, pred);
}
/** pha ở KHÔNG GIAN HẠNG (phân vị trên HỢP tập ô) */
function hitRank(s, share) {
  const n = s.P.length;
  const w = 1 - share;
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = w * s.pP[i] + share * s.pC[i];
  return hitOf(s, pred);
}
/** pha ở HẠNG nhưng dùng mùa vụ THÔ (chưa qua bảng quy đổi phân vị) —
    kiểm chứng phụ: ở không gian hạng thì bảng quy đổi lẽ ra THỪA */
function hitRankRaw(s, share) {
  const n = s.P.length;
  const w = 1 - share;
  const pCraw = pct(s.Craw);
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = w * s.pP[i] + share * pCraw[i];
  return hitOf(s, pred);
}

/* ── KIỂM CHỨNG 0: đoạn "GIÃN VỀ PHÂN BỐ HÔM NAY" có đổi top-100 không? ──────
   Nó sắp xếp điểm pha rồi gán lại giá trị theo phân bố ngày T ⇒ ĐƠN ĐIỆU
   KHÔNG GIẢM ⇒ về lý thuyết KHÔNG đổi thứ tự ⇒ top-100 phải y hệt (chỉ lệch do
   ĐỒNG HẠNG mới sinh ra khi nhiều điểm pha bị gán cùng một giá trị đích). */
function hitValueRespread(s, share) {
  const n = s.P.length;
  const w = 1 - share;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) raw[i] = w * s.P[i] + share * s.C[i];
  const target = [...s.dayTcells].sort((a, b) => a - b);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (raw[a] - raw[b]) || (a - b));
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const posIdx = n === 1 ? target.length - 1 : Math.round((k / (n - 1)) * (target.length - 1));
    out[i] = Math.max(0, Math.min(100, Math.round(target[posIdx] ?? 0)));
  }
  return hitOf(s, out);
}

/* ── bình phương nhỏ nhất (đúng fitW của fit-fish-blend-weights.mjs) ──────── */
function fitWLS(ss) {
  let saa = 0, sab = 0, n = 0;
  for (const s of ss)
    for (let i = 0; i < s.P.length; i++) {
      const a = s.P[i] - s.C[i];
      const b = s.Y[i] - s.C[i];
      saa += a * a; sab += a * b; n++;
    }
  if (!n || saa <= 0) return 1;
  return Math.min(1, Math.max(0, sab / saa));
}

/* ── bảng hit theo lưới share (cache) ─────────────────────────────────────── */
console.log("Đang quét lưới share cho từng mẫu (value + rank)...");
const HIT = new Map(); // lead → { value: number[sample][shareIdx], rank: ... }
for (const d of LEADS) {
  const ss = samples.get(d);
  const value = ss.map((s) => SHARE_GRID.map((sh) => hitValue(s, sh)));
  const rank = ss.map((s) => SHARE_GRID.map((sh) => hitRank(s, sh)));
  HIT.set(d, { value, rank });
  process.stdout.write("#");
}
console.log("\n");

const gridPick = (curve) => {
  // argmax với ưu tiên share NHỎ khi hoà (bảo thủ: đừng ăn mùa vụ nếu không hơn)
  let best = 0;
  for (let i = 1; i < curve.length; i++) if (curve[i] > curve[best] + 1e-12) best = i;
  return best;
};

/* ── VIỆC A/B/C: in-sample + LOYO ─────────────────────────────────────────── */
const YEARS = [...new Set(INDEX.origins.map(YEAR_OF))].sort();
const rows = [];
// per-sample hit của từng biến thể, gom theo (lead, origin) để làm thống kê ghép cặp
const perSample = []; // {lead, origin, year, persist, product, ls, optVal, optRank, prodRank}

for (const d of LEADS) {
  const ss = samples.get(d);
  const H = HIT.get(d);
  const nS = ss.length;
  const shareProduct = climShare(d);
  const iProduct = SHARE_GRID.reduce(
    (bi, sh, i) => (Math.abs(sh - shareProduct) < Math.abs(SHARE_GRID[bi] - shareProduct) ? i : bi), 0);

  // in-sample tối ưu
  const curveVal = SHARE_GRID.map((_, k) => mean(H.value.map((r) => r[k])));
  const curveRank = SHARE_GRID.map((_, k) => mean(H.rank.map((r) => r[k])));
  const iOptValIn = gridPick(curveVal);
  const iOptRankIn = gridPick(curveRank);
  const wLSall = fitWLS(ss);

  // LOYO theo NĂM
  const loyo = { optVal: new Array(nS), optRank: new Array(nS), ls: new Array(nS) };
  const loyoShares = { optVal: {}, optRank: {}, ls: {} };
  for (const y of YEARS) {
    const trainIdx = ss.map((s, i) => (s.year !== y ? i : -1)).filter((i) => i >= 0);
    const testIdx = ss.map((s, i) => (s.year === y ? i : -1)).filter((i) => i >= 0);
    if (!trainIdx.length || !testIdx.length) continue;
    const cv = SHARE_GRID.map((_, k) => mean(trainIdx.map((i) => H.value[i][k])));
    const cr = SHARE_GRID.map((_, k) => mean(trainIdx.map((i) => H.rank[i][k])));
    const iV = gridPick(cv);
    const iR = gridPick(cr);
    const wls = fitWLS(trainIdx.map((i) => ss[i]));
    loyoShares.optVal[y] = SHARE_GRID[iV];
    loyoShares.optRank[y] = SHARE_GRID[iR];
    loyoShares.ls[y] = 1 - wls;
    for (const i of testIdx) {
      loyo.optVal[i] = H.value[i][iV];
      loyo.optRank[i] = H.rank[i][iR];
      loyo.ls[i] = hitValue(ss[i], 1 - wls);
    }
  }

  for (let i = 0; i < nS; i++) {
    perSample.push({
      lead: d,
      origin: ss[i].origin,
      year: ss[i].year,
      persist: H.value[i][0],
      product: H.value[i][iProduct],
      prodRank: H.rank[i][iProduct],
      ls: loyo.ls[i],
      optVal: loyo.optVal[i],
      optRank: loyo.optRank[i],
      optValIn: H.value[i][iOptValIn],
      optRankIn: H.rank[i][iOptRankIn],
    });
  }

  rows.push({
    lead: d,
    nOrigins: nS,
    nCells: Math.round(mean(ss.map((s) => s.P.length))),
    shareLS: r3(1 - wLSall),
    shareOptValIn: r3(SHARE_GRID[iOptValIn]),
    shareOptRankIn: r3(SHARE_GRID[iOptRankIn]),
    shareProduct: r3(shareProduct),
    loyoShares: {
      optVal: Object.values(loyoShares.optVal).map(r3),
      optRank: Object.values(loyoShares.optRank).map(r3),
      ls: Object.values(loyoShares.ls).map(r3),
    },
    hitPersist: r1(mean(H.value.map((r) => r[0])) * 100),
    hitProduct: r1(mean(H.value.map((r) => r[iProduct])) * 100),
    hitProdRank: r1(mean(H.rank.map((r) => r[iProduct])) * 100),
    hitLS_loyo: r1(mean(loyo.ls) * 100),
    hitOptVal_loyo: r1(mean(loyo.optVal) * 100),
    hitOptRank_loyo: r1(mean(loyo.optRank) * 100),
    hitOptVal_in: r1(curveVal[iOptValIn] * 100),
    hitOptRank_in: r1(curveRank[iOptRankIn] * 100),
    hitClim: r1(mean(H.value.map((r) => r[r.length - 1])) * 100),
  });
}

console.log("=== BẢNG CHÍNH — top-100 hit (%) theo tầm ngày ===");
console.table(
  rows.map((r) => ({
    "tầm": r.lead,
    "ảnh thuần": r.hitPersist,
    "pha hiện tại": r.hitProduct,
    "LS(loyo)": r.hitLS_loyo,
    "top100-val(loyo)": r.hitOptVal_loyo,
    "top100-hạng(loyo)": r.hitOptRank_loyo,
    "hạng@share sp": r.hitProdRank,
    "mùa vụ thuần": r.hitClim,
  })),
);
console.log("=== SHARE (tỷ lệ mùa vụ) mà từng cách chọn ra ===");
console.table(
  rows.map((r) => ({
    "tầm": r.lead,
    "LS (sai số)": r.shareLS,
    "top100 value (in-sample)": r.shareOptValIn,
    "top100 hạng (in-sample)": r.shareOptRankIn,
    "sản phẩm": r.shareProduct,
    "LOYO top100-val": r.loyoShares.optVal.join("/"),
    "LOYO top100-hạng": r.loyoShares.optRank.join("/"),
    "LOYO LS": r.loyoShares.ls.join("/"),
  })),
);

/* ── KIỂM CHỨNG 0 (đoạn giãn) ─────────────────────────────────────────────── */
console.log("\n=== KIỂM CHỨNG 0 · đoạn GIÃN có đổi top-100 không? ===");
const respreadRows = [];
for (const d of LEADS) {
  const ss = samples.get(d);
  if (!ss?.length) continue;
  const sh = climShare(d);
  const a = mean(ss.map((s) => hitValue(s, sh)));
  const b = mean(ss.map((s) => hitValueRespread(s, sh)));
  respreadRows.push({ "tầm": d, "share": r3(sh), "chưa giãn": r1(a * 100), "đã giãn": r1(b * 100), "chênh": r2((b - a) * 100) });
}
console.table(respreadRows);

/* ── KIỂM CHỨNG phụ: ở không gian hạng, bảng quy đổi phân vị có thừa không? ── */
console.log("\n=== KIỂM CHỨNG phụ · hạng với mùa vụ THÔ vs mùa vụ ĐÃ quy đổi ===");
const rawRows = [];
for (const d of [1, 8, 16]) {
  const ss = samples.get(d);
  if (!ss?.length) continue;
  const sh = 0.4;
  const a = mean(ss.map((s) => hitRank(s, sh)));
  const b = mean(ss.map((s) => hitRankRaw(s, sh)));
  rawRows.push({ "tầm": d, "share": sh, "hạng+quy đổi": r1(a * 100), "hạng+thô": r1(b * 100), "chênh": r2((b - a) * 100) });
}
console.table(rawRows);

/* ── THỐNG KÊ: gain trung bình + ghép cặp theo (mốc gốc, tầm) ─────────────── */
const VARIANTS = [
  { key: "ls", label: "value @ w bình-phương-nhỏ-nhất (LOYO)" },
  { key: "optVal", label: "value @ w tối-ưu-top100 (LOYO)" },
  { key: "optRank", label: "HẠNG @ w tối-ưu-top100 (LOYO)" },
  { key: "prodRank", label: "HẠNG @ share sản phẩm (6→56 %)" },
];
const BASES = [
  { key: "persist", label: "ảnh thuần" },
  { key: "product", label: "pha hiện tại (value, 6→56 %)" },
];

const ORIGINS = [...new Set(perSample.map((p) => p.origin))].sort();
/** gain trung bình (điểm %) của biến thể v so với baseline b, và theo từng mốc gốc */
function gainStats(vKey, bKey, subsetOrigins = ORIGINS) {
  const set = new Set(subsetOrigins);
  const rowsF = perSample.filter((p) => set.has(p.origin) && Number.isFinite(p[vKey]) && Number.isFinite(p[bKey]));
  const diffs = rowsF.map((p) => (p[vKey] - p[bKey]) * 100);
  const byOrigin = subsetOrigins.map((o) => {
    const dd = rowsF.filter((p) => p.origin === o).map((p) => (p[vKey] - p[bKey]) * 100);
    return dd.length ? mean(dd) : null;
  }).filter((v) => v !== null);
  return {
    n: diffs.length,
    meanAll: mean(diffs),
    meanOrigin: mean(byOrigin),
    seOrigin: sd(byOrigin) / Math.sqrt(byOrigin.length),
    byOrigin,
  };
}

console.log("\n=== GAIN TRUNG BÌNH (điểm % top-100, ghép cặp theo mốc gốc × tầm) ===");
{
  const g = gainStats("product", "persist");
  console.log(
    `THAM CHIẾU · pha hiện tại vs ảnh thuần: ${r2(g.meanOrigin)} ± ${r2(g.seOrigin)} điểm % (n=${g.n} cặp, 16 mốc gốc)`,
  );
}
const gainTable = [];
for (const v of VARIANTS) {
  const row = { "biến thể": v.label };
  for (const b of BASES) {
    const g = gainStats(v.key, b.key);
    row[`vs ${b.label}`] = `${r2(g.meanOrigin)} ± ${r2(g.seOrigin)}`;
  }
  gainTable.push(row);
}
console.table(gainTable);

/* ── PERMUTATION có TRỪ LỢI THẾ HÁI QUẢ (max-T trên 4 biến thể) ────────────
   Đơn vị hoán vị = MỐC GỐC (16). Thống kê của mỗi biến thể =
   min(gain vs ảnh-thuần, gain vs pha-hiện-tại) — luật của dự án: phải thắng CẢ HAI.
   Null: đảo dấu chênh lệch của từng mốc gốc (đối xứng quanh 0). Liệt kê ĐỦ 2^16. */
const statOf = {};
const perOriginPair = {}; // key → { p:number[16], q:number[16] } gain theo từng mốc gốc
for (const v of VARIANTS) {
  const gp = gainStats(v.key, "persist");
  const gq = gainStats(v.key, "product");
  perOriginPair[v.key] = { p: gp.byOrigin, q: gq.byOrigin };
  statOf[v.key] = Math.min(mean(gp.byOrigin), mean(gq.byOrigin));
}
const nOrig = perOriginPair[VARIANTS[0].key].p.length;
const obsMax = Math.max(...VARIANTS.map((v) => statOf[v.key]));
let ge = 0;
const total = 1 << nOrig;
for (let mask = 0; mask < total; mask++) {
  let mx = -Infinity;
  for (const v of VARIANTS) {
    const { p, q } = perOriginPair[v.key];
    let sp = 0, sq = 0;
    for (let i = 0; i < nOrig; i++) {
      const f = (mask >> i) & 1 ? -1 : 1;
      sp += f * p[i];
      sq += f * q[i];
    }
    const m = Math.min(sp / nOrig, sq / nOrig);
    if (m > mx) mx = m;
  }
  if (mx >= obsMax - 1e-12) ge++;
}
const pFamily = ge / total;

console.log("\n=== PERMUTATION (max-T, đã trừ lợi thế hái quả trên 4 biến thể) ===");
console.table(
  VARIANTS.map((v) => ({
    "biến thể": v.label,
    "min(gain vs 2 baseline)": r2(statOf[v.key]),
  })),
);
console.log(`Biến thể tốt nhất: ${VARIANTS.find((v) => statOf[v.key] === obsMax).label}`);
console.log(`observed max-stat = ${r2(obsMax)} điểm % · p family-wise = ${r3(pFamily)} (liệt kê đủ ${total} phép đảo dấu, đơn vị = mốc gốc)`);

/* ── ĐỘ BỀN: bỏ 1 mốc gốc bất kỳ ──────────────────────────────────────────── */
console.log("\n=== ĐỘ BỀN — bỏ 1 mốc gốc (jackknife) ===");
const robust = [];
for (const v of VARIANTS) {
  const vals = ORIGINS.map((o) => {
    const sub = ORIGINS.filter((x) => x !== o);
    const gp = gainStats(v.key, "persist", sub).meanOrigin;
    const gq = gainStats(v.key, "product", sub).meanOrigin;
    return Math.min(gp, gq);
  });
  robust.push({
    "biến thể": v.label,
    "đủ 16 mốc": r2(statOf[v.key]),
    "min khi bỏ 1": r2(Math.min(...vals)),
    "max khi bỏ 1": r2(Math.max(...vals)),
  });
}
console.table(robust);

/* ── (d) CÁI GIÁ CỦA MỨC SẢN PHẨM 56 % ĐO BẰNG THƯỚC ĐÚNG ─────────────────── */
console.log("\n=== (d) CÁI GIÁ CỦA MỨC SẢN PHẨM, đo bằng TOP-100 ===");
console.table(
  rows.map((r) => ({
    "tầm": r.lead,
    "share sản phẩm": r.shareProduct,
    "share top100 (in-sample)": r.shareOptValIn,
    "top100 sản phẩm": r.hitProduct,
    "top100 tối ưu (in-sample)": r.hitOptVal_in,
    "GIÁ (điểm %)": r1(r.hitOptVal_in - r.hitProduct),
    "sản phẩm − ảnh thuần": r1(r.hitProduct - r.hitPersist),
  })),
);

/* ── ghi kết quả ──────────────────────────────────────────────────────────── */
const summary = {
  generatedAt: new Date().toISOString(),
  hypothesis:
    "H4: fit w theo TOP-100 (không phải bình phương nhỏ nhất) + pha ở KHÔNG GIAN HẠNG (không phải giá trị)",
  truthCaveat:
    "SỰ THẬT = bản đồ cá tính từ ảnh vệ tinh ngày T+d bằng chính buildFishForecast, KHÔNG PHẢI sản lượng cá thật. Mọi kết luận chỉ nói về 'khớp bản đồ ngày đó'.",
  design: {
    origins: INDEX.origins,
    leads: LEADS,
    nPairs: perSample.length,
    cv: "LOYO theo NĂM (4 năm × 4 mốc gốc), share học ở 3 năm — đo ở năm còn lại",
    shareGrid: "0..1 bước 0,02",
    topK: TOP_K,
  },
  perLead: rows,
  gains: gainTable,
  permutation: {
    method: "max-T trên 4 biến thể; thống kê = min(gain vs ảnh-thuần, gain vs pha-hiện-tại); đảo dấu theo MỐC GỐC, liệt kê đủ 2^16",
    stats: Object.fromEntries(VARIANTS.map((v) => [v.key, r2(statOf[v.key])])),
    obsMax: r2(obsMax),
    pFamilyWise: r3(pFamily),
  },
  robustness: robust,
  respreadCheck: respreadRows,
  rankRawCheck: rawRows,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(`\n✓ ${OUT}`);
