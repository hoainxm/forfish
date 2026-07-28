// scripts/fish-hypo-drift-vector.mjs   (chạy: npx tsx scripts/fish-hypo-drift-vector.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// GIẢ THUYẾT #5 (H5) — DỊCH CẢ TRƯỜNG ĐIỂM THEO MỘT VECTƠ ĐO ĐƯỢC
//
// Ý: front / ổ phù du KHÔNG đứng yên rồi mờ đi — chúng TRÔI. Nếu có thành phần
// trôi HỆ THỐNG (theo mùa gió), bù nó là hồi được điểm. Khác "advect phù du theo
// dòng chảy" (đã bác bỏ 2 lần): ở đây KHÔNG lấy vận tốc từ mô hình mà ĐO thẳng
// bằng chính thước đo mục tiêu, trên trường ĐẦU RA (điểm), 1 vectơ / mùa.
//
// DỮ LIỆU: .cache/fish-corpus (0 request mạng). SỰ THẬT = bản đồ cá tính từ ảnh
// vệ tinh ngày T+d bằng chính buildFishForecast — KHÔNG PHẢI sản lượng cá thật.
//
// CÁC BƯỚC (đăng ký trước):
//   (a)  Dò thô  : quét dx,dy ∈ [−20,+20] ô (±5°) cho MỌI (mốc gốc, tầm ngày),
//                  thước đo = top-100 hit. + hồ sơ hit theo QUÃNG DỊCH.
//   (a2) CHẨN ĐOÁN THỨ HAI (thêm vào sau khi (a) ra kết quả suy biến): ước lượng
//        dịch chuyển bằng TƯƠNG QUAN trên trường ĐÃ LÀM TRƠN (σ = 1/2/3 ô).
//        Tương quan tính trên phần CHỒNG LẤN nên KHÔNG bị phạt biên/mặt nạ, và
//        làm trơn xoá đốm nhiễu ⇒ nếu có trôi quy mô lớn thì đây là chỗ thấy nó.
//        Không có bước này thì không phân biệt được "KHÔNG có trôi" với
//        "có trôi nhưng thước đo top-100 quá nhọn để đo".
//   (b)  DẤU     : tháng 1 (gió mùa ĐB) phải cho vectơ TÂY NAM; tháng 7 ĐÔNG BẮC.
//                  Dấu lộn xộn ⇒ nhiễu tối-ưu-hoá ⇒ BÁC BỎ, không cứu vãn.
//   (c)  LOYO    : fit vận tốc theo mùa trên 3 năm, áp lên năm giữ lại.
//   (d)  Theo vùng: CHỈ chạy nếu (c) thắng.
//   (e)  Baseline: ảnh thuần (= vectơ 0), pha trộn hiện tại, pha trộn + dịch.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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
const OUT = join(ROOT, ".cache", "fish-hypo-drift-result.json");

const TOP_K = 100;
const MAX_SHIFT = 20; // ô (±5°) — đủ cho 35 km/ngày × 16 ngày
const MATERIAL = 0.5; // điểm % — dưới mức này là HOÀ
const N_PERM = 4000;
const SIGMAS = [1, 2, 3]; // bán kính làm trơn (ô) cho chẩn đoán tương quan

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1));
};

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
if (!existsSync(join(CORPUS, "index.json"))) {
  console.error(`KHÔNG thấy ${CORPUS}/index.json`);
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

const N = nLat * nLon;
const gi = (lat, lon) => {
  const i = Math.round((lat - lat0) / dLat);
  const j = Math.round((lon - lon0) / dLon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return -1;
  return i * nLon + j;
};

/* ── MẶT NẠ BIỂN: ô có mặt ở ÍT NHẤT 1 ngày trong kho, ∪ ô mùa vụ > 0 ─────── */
const MASK = new Uint8Array(N);
for (const date of INDEX.days) {
  const d = loadDay(date);
  if (!d) continue;
  for (const c of d.cells) {
    const k = gi(c.lat, c.lon);
    if (k >= 0) MASK[k] = 1;
  }
}
for (const buf of CLIM.months.values())
  for (let k = 0; k < N; k++) if (buf[k] > 0) MASK[k] = 1;
const MASK_IDX = [];
for (let k = 0; k < N; k++) if (MASK[k]) MASK_IDX.push(k);
console.log(`Lưới ${nLat}×${nLon} = ${N} ô; MẶT NẠ (biển ∪ mùa vụ) = ${MASK_IDX.length} ô`);

function topKIdxOfArray(vals, K) {
  const c = MASK_IDX.slice();
  c.sort((a, b) => vals[b] - vals[a] || a - b);
  return c.slice(0, K);
}

/** làm trơn Gauss CÓ MẶT NẠ (chuẩn hoá theo trọng số ô hợp lệ) */
function smoothMasked(A, sigma) {
  const rad = Math.max(1, Math.ceil(2.5 * sigma));
  const ker = [];
  for (let t = -rad; t <= rad; t++) ker.push(Math.exp(-(t * t) / (2 * sigma * sigma)));
  // ngang
  const tmpV = new Float64Array(N), tmpW = new Float64Array(N);
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      if (!MASK[k]) continue;
      let s = 0, w = 0;
      for (let t = -rad; t <= rad; t++) {
        const jj = j + t;
        if (jj < 0 || jj >= nLon) continue;
        const kk = i * nLon + jj;
        if (!MASK[kk]) continue;
        s += ker[t + rad] * A[kk];
        w += ker[t + rad];
      }
      tmpV[k] = w > 0 ? s / w : 0;
      tmpW[k] = 1;
    }
  // dọc
  const out = new Float64Array(N);
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      if (!MASK[k]) continue;
      let s = 0, w = 0;
      for (let t = -rad; t <= rad; t++) {
        const ii = i + t;
        if (ii < 0 || ii >= nLat) continue;
        const kk = ii * nLon + j;
        if (!tmpW[kk]) continue;
        s += ker[t + rad] * tmpV[kk];
        w += ker[t + rad];
      }
      out[k] = w > 0 ? s / w : 0;
    }
  return out;
}

/* ── dựng mẫu ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads;
const SAMPLES = [];
let skipped = 0;
console.time("dựng mẫu");
for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const P = new Float64Array(N);
  P.fill(ABSENT_PERSIST);
  for (const c of dayT.cells) {
    const k = gi(c.lat, c.lon);
    if (k >= 0) P[k] = c.s;
  }
  const sortedP = topKIdxOfArray(P, 1400);
  const Psm = Object.fromEntries(SIGMAS.map((s) => [s, smoothMasked(P, s)]));

  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const m = dayY.month;
    const Y = new Float64Array(N);
    Y.fill(ABSENT_PERSIST);
    for (const c of dayY.cells) {
      const k = gi(c.lat, c.lon);
      if (k >= 0) Y[k] = c.s;
    }
    const truthTop = new Set(topKIdxOfArray(Y, TOP_K));
    const scale = buildClimScaleMap(CLIM, m, dayT.cells.map((c) => c.s));
    const buf = CLIM.months.get(m);
    const C = new Float64Array(N);
    if (buf) for (let k = 0; k < N; k++) C[k] = scale[Math.min(100, buf[k] ?? 0)] ?? 0;

    SAMPLES.push({
      origin: T, year: Number(T.slice(0, 4)), month: Number(T.slice(5, 7)),
      lead: d, P, C, sortedP, truthTop, Psm,
      Ysm: Object.fromEntries(SIGMAS.map((s) => [s, smoothMasked(Y, s)])),
    });
  }
}
console.timeEnd("dựng mẫu");
console.log(`Mẫu: ${SAMPLES.length} cặp (mốc gốc × tầm ngày), bỏ ${skipped} cặp thiếu ngày.\n`);

/* ── HIT của trường ĐÃ DỊCH (dùng tính bijection của phép dịch) ───────────── */
function hitShift(s, dx, dy) {
  let got = 0, hit = 0;
  const src = s.sortedP;
  for (let t = 0; t < src.length && got < TOP_K; t++) {
    const k = src[t];
    const i = (k / nLon) | 0, j = k - i * nLon;
    const ii = i + dy, jj = j + dx;
    if (ii < 0 || ii >= nLat || jj < 0 || jj >= nLon) continue;
    const kk = ii * nLon + jj;
    if (!MASK[kk]) continue;
    got++;
    if (s.truthTop.has(kk)) hit++;
  }
  return hit;
}
function hitBlendShift(s, dx, dy, share) {
  const pred = new Float64Array(N);
  const w = 1 - share;
  for (const k of MASK_IDX) {
    const i = (k / nLon) | 0, j = k - i * nLon;
    const si = i - dy, sj = j - dx;
    let pv = ABSENT_PERSIST;
    if (si >= 0 && si < nLat && sj >= 0 && sj < nLon) {
      const sk = si * nLon + sj;
      pv = MASK[sk] ? s.P[sk] : ABSENT_PERSIST;
    }
    pred[k] = w * pv + share * s.C[k];
  }
  let hit = 0;
  for (const k of topKIdxOfArray(pred, TOP_K)) if (s.truthTop.has(k)) hit++;
  return hit;
}

/* ── (a) DÒ THÔ theo top-100 ──────────────────────────────────────────────── */
console.time("(a) dò thô top-100");
const SPAN = 2 * MAX_SHIFT + 1;
const H = SAMPLES.map((s) => {
  const tbl = new Int16Array(SPAN * SPAN);
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++)
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++)
      tbl[(dy + MAX_SHIFT) * SPAN + (dx + MAX_SHIFT)] = hitShift(s, dx, dy);
  return tbl;
});
console.timeEnd("(a) dò thô top-100");
const hAt = (si, dx, dy) => H[si][(dy + MAX_SHIFT) * SPAN + (dx + MAX_SHIFT)];
const hitZero = SAMPLES.map((_, si) => hAt(si, 0, 0));

const bestVec = SAMPLES.map((_, si) => {
  let b = { dx: 0, dy: 0, hit: -1 };
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++)
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++) {
      const h = hAt(si, dx, dy);
      if (h > b.hit || (h === b.hit && dx * dx + dy * dy < b.dx * b.dx + b.dy * b.dy))
        b = { dx, dy, hit: h };
    }
  return b;
});
const nBestNonZero = bestVec.filter((b) => b.dx !== 0 || b.dy !== 0).length;

/* ── (e) BASELINE ─────────────────────────────────────────────────────────── */
const hitBlend = SAMPLES.map((s) => hitBlendShift(s, 0, 0, climShare(s.lead)));
function byLead(vals) {
  const out = {};
  for (const d of LEADS) {
    const v = SAMPLES.map((s, i) => [s, vals[i]]).filter(([s]) => s.lead === d).map(([, x]) => x);
    out[d] = v.length ? mean(v) : null;
  }
  return out;
}
const baseImgL = byLead(hitZero), baseBlendL = byLead(hitBlend);
const oracleL = byLead(bestVec.map((b) => b.hit));

console.log("=== (e) BASELINE + TRẦN ORACLE (top-100 hit %) ===");
console.table(LEADS.map((d) => ({
  "tầm(ngày)": d,
  "ảnh thuần (vectơ 0)": r1(baseImgL[d]),
  "pha trộn hiện tại": r1(baseBlendL[d]),
  "ORACLE dịch tốt nhất (TRONG mẫu)": r1(oracleL[d]),
  "trần − ảnh": r1(oracleL[d] - baseImgL[d]),
})));
console.log(`TB: ảnh ${r1(mean(hitZero))} · pha trộn ${r1(mean(hitBlend))} · oracle ${r1(mean(bestVec.map((b) => b.hit)))}`);
console.log(`Số mẫu có vectơ tốt nhất KHÁC 0: ${nBestNonZero}/${SAMPLES.length}`);

/* ── (a2-1) HỒ SƠ HIT THEO QUÃNG DỊCH — vì sao vectơ tốt nhất luôn là 0? ──── */
const profByLead = {};
for (const d of [1, 4, 8, 16]) {
  const idxs = SAMPLES.map((s, i) => i).filter((i) => SAMPLES[i].lead === d);
  const buckets = new Map();
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++)
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++) {
      const r = Math.round(Math.hypot(dx, dy));
      if (r > 8) continue;
      if (!buckets.has(r)) buckets.set(r, []);
      for (const i of idxs) buckets.get(r).push(hAt(i, dx, dy));
    }
  profByLead[d] = Object.fromEntries([...buckets.entries()].sort((a, b) => a[0] - b[0])
    .map(([r, v]) => [r, r1(mean(v))]));
}
console.log("\n=== (a2-1) HIT TRUNG BÌNH THEO QUÃNG DỊCH (ô; 1 ô ≈ 28 km) ===");
console.table([0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => {
  const row = { "quãng dịch (ô)": r, "≈ km": Math.round(r * 27.5) };
  for (const d of [1, 4, 8, 16]) row[`d${d}`] = profByLead[d][r];
  return row;
}));

/* ── (a2-2) CHẨN ĐOÁN TƯƠNG QUAN TRÊN TRƯỜNG LÀM TRƠN ─────────────────────── */
// Tương quan Pearson trên phần CHỒNG LẤN ⇒ không bị phạt biên, không bị đốm nhiễu.
function bestCorrShift(A, B, maxS) {
  let best = { dx: 0, dy: 0, r: -2 };
  let r00 = 0;
  for (let dy = -maxS; dy <= maxS; dy++)
    for (let dx = -maxS; dx <= maxS; dx++) {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (const k of MASK_IDX) {
        const i = (k / nLon) | 0, j = k - i * nLon;
        const si = i - dy, sj = j - dx;
        if (si < 0 || si >= nLat || sj < 0 || sj >= nLon) continue;
        const sk = si * nLon + sj;
        if (!MASK[sk]) continue;
        const a = A[sk], b = B[k];
        n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
      }
      if (n < 300) continue;
      const cov = sab / n - (sa / n) * (sb / n);
      const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
      const r = va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
      if (dx === 0 && dy === 0) r00 = r;
      if (r > best.r) best = { dx, dy, r };
    }
  return { ...best, r00 };
}
console.time("(a2-2) tương quan trường làm trơn");
const corrBest = {}; // sigma → mảng {dx,dy,r,r00} theo mẫu
for (const sg of SIGMAS)
  corrBest[sg] = SAMPLES.map((s) => bestCorrShift(s.Psm[sg], s.Ysm[sg], MAX_SHIFT));
console.timeEnd("(a2-2) tương quan trường làm trơn");

console.log("\n=== (a2-2) DỊCH CHUYỂN ĐO BẰNG TƯƠNG QUAN (trường làm trơn) ===");
console.table(SIGMAS.map((sg) => {
  const cb = corrBest[sg];
  const nz = cb.filter((b) => b.dx !== 0 || b.dy !== 0).length;
  return {
    "σ làm trơn (ô)": sg,
    "mẫu có dịch ≠0": `${nz}/${cb.length}`,
    "|dịch| trung vị (ô)": r2(median(cb.map((b) => Math.hypot(b.dx, b.dy)))),
    "r tại dịch tốt nhất": r3(mean(cb.map((b) => b.r))),
    "r tại dịch 0": r3(mean(cb.map((b) => b.r00))),
    "Δr nhờ dịch": r3(mean(cb.map((b) => b.r - b.r00))),
  };
}));

/* ── (b) KIỂM ĐỊNH DẤU ĐĂNG KÝ TRƯỚC ──────────────────────────────────────── */
const KM_LAT = 27.8, KM_LON = 111.32 * 0.25 * Math.cos((13 * Math.PI) / 180);
const EXPECT = { 1: [-1, -1], 4: [+1, +1], 7: [+1, +1], 10: [-1, -1] };
const STRICT_MONTHS = [1, 7];
const FIT_LEADS = LEADS.filter((d) => d >= 4);

function binomP(k, n, p = 0.5) {
  const logC = (n, k) => { let v = 0; for (let i = 1; i <= k; i++) v += Math.log(n - k + i) - Math.log(i); return v; };
  let s = 0;
  for (let i = k; i <= n; i++) s += Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, s);
}
/** kiểm định dấu trên một nguồn vectơ (mảng {dx,dy} theo mẫu) */
function signTestOn(vecs, label) {
  const rows = [];
  for (const T of INDEX.origins) {
    const sel = SAMPLES.map((s, i) => ({ s, i })).filter(({ s }) => s.origin === T && FIT_LEADS.includes(s.lead));
    if (!sel.length) continue;
    const vx = median(sel.map(({ i, s }) => vecs[i].dx / s.lead));
    const vy = median(sel.map(({ i, s }) => vecs[i].dy / s.lead));
    const month = Number(T.slice(5, 7));
    const [ex, ey] = EXPECT[month];
    const proj = vx * KM_LON * ex + vy * KM_LAT * ey;
    rows.push({
      source: label, origin: T, month,
      kmDayE: r1(vx * KM_LON), kmDayN: r1(vy * KM_LAT),
      speedKmDay: r1(Math.hypot(vx * KM_LON, vy * KM_LAT)),
      expected: month === 1 || month === 10 ? "TÂY NAM" : "ĐÔNG BẮC",
      projKm: r1(proj / Math.SQRT2),
      signMatch: proj > 0, zero: vx === 0 && vy === 0,
    });
  }
  const nz = rows.filter((r) => !r.zero);
  const k = rows.filter((r) => r.signMatch).length;
  const kNZ = nz.filter((r) => r.signMatch).length;
  const st = rows.filter((r) => STRICT_MONTHS.includes(r.month));
  const kSt = st.filter((r) => r.signMatch).length;
  return {
    label, rows,
    all: { k, n: rows.length, p: r3(binomP(k, rows.length)) },
    nonZeroOnly: { k: kNZ, n: nz.length, p: nz.length ? r3(binomP(kNZ, nz.length)) : null },
    strictJanJul: { k: kSt, n: st.length, p: r3(binomP(kSt, st.length)) },
    medianSpeedKmDay: r1(median(rows.map((r) => r.speedKmDay))),
  };
}
const SIGN_SOURCES = [
  { label: "top-100 (dò thô)", vecs: bestVec },
  ...SIGMAS.map((sg) => ({ label: `tương quan σ=${sg}`, vecs: corrBest[sg] })),
];
const signTests = SIGN_SOURCES.map((s) => signTestOn(s.vecs, s.label));

console.log("\n=== (b) KIỂM ĐỊNH DẤU ĐĂNG KÝ TRƯỚC ===");
console.table(signTests.map((t) => ({
  "nguồn vectơ": t.label,
  "khớp dấu (16 mốc)": `${t.all.k}/${t.all.n}`, "p": t.all.p,
  "khớp dấu (bỏ vectơ 0)": t.nonZeroOnly.n ? `${t.nonZeroOnly.k}/${t.nonZeroOnly.n}` : "—",
  "p (bỏ 0)": t.nonZeroOnly.p ?? "—",
  "tháng 1&7": `${t.strictJanJul.k}/${t.strictJanJul.n}`, "p_1&7": t.strictJanJul.p,
  "tốc độ trung vị km/ngày": t.medianSpeedKmDay,
})));
console.log("\nChi tiết vectơ theo mốc gốc (nguồn tương quan σ=2 — nguồn nhạy nhất):");
console.table(signTests.find((t) => t.label === "tương quan σ=2").rows.map((r) => ({
  "mốc gốc": r.origin, "tháng": r.month,
  "km/ngày ĐÔNG(+)": r.kmDayE, "km/ngày BẮC(+)": r.kmDayN,
  "tốc độ": r.speedKmDay, "kỳ vọng": r.expected, "chiếu": r.projKm,
  "khớp dấu?": r.zero ? "(vectơ 0)" : r.signMatch ? "CÓ" : "không",
})));

const SIGN_OK = signTests.some((t) =>
  t.all.k >= 12 || (t.strictJanJul.p < 0.05 && t.strictJanJul.k > t.strictJanJul.n / 2));
console.log(SIGN_OK
  ? "⇒ DẤU ĐẠT ngưỡng đăng ký trước ở ít nhất 1 nguồn — đi tiếp (c)."
  : "⇒ DẤU KHÔNG ĐẠT ở MỌI nguồn (<12/16 và p≥0,05 ở tháng 1&7) — theo giao kèo là BÁC BỎ. " +
    "Vẫn chạy (c) để BÁO mức lợi thực tế, KHÔNG để cứu vãn.");

/* ── (c) LOYO ─────────────────────────────────────────────────────────────── */
const YEARS = [...new Set(SAMPLES.map((s) => s.year))].sort();
const VGRID = [];
for (let vy = -1.4; vy <= 1.4001; vy += 0.05)
  for (let vx = -1.4; vx <= 1.4001; vx += 0.05) VGRID.push([r2(vx), r2(vy)]);
const clip = (v) => Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(v)));
const GROUPERS = {
  perMonth: (s) => String(s.month),
  monsoon: (s) => (s.month === 1 || s.month === 10 ? "NE" : "SW"),
  global: () => "ALL",
};
/** fit theo TOP-100 (tối đa tổng hit) */
function fitVelocityHit(idxs) {
  let best = { vx: 0, vy: 0, sum: -1 };
  for (const [vx, vy] of VGRID) {
    let sum = 0;
    for (const i of idxs) sum += hAt(i, clip(vx * SAMPLES[i].lead), clip(vy * SAMPLES[i].lead));
    if (sum > best.sum) best = { vx, vy, sum };
  }
  return best;
}
/** fit theo vectơ TƯƠNG QUAN đã đo (trung vị vận tốc của tập huấn luyện) */
function fitVelocityCorr(idxs, sg) {
  return {
    vx: median(idxs.map((i) => corrBest[sg][i].dx / SAMPLES[i].lead)),
    vy: median(idxs.map((i) => corrBest[sg][i].dy / SAMPLES[i].lead)),
  };
}
function loyo(grouperName, blend, fitter) {
  const g = GROUPERS[grouperName];
  const out = new Array(SAMPLES.length).fill(0);
  const fits = {};
  for (const yr of YEARS) {
    const groups = new Map();
    SAMPLES.forEach((s, i) => {
      if (s.year === yr || !FIT_LEADS.includes(s.lead)) return;
      const k = g(s);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    });
    for (const [k, idxs] of groups) {
      const f = fitter(idxs);
      fits[`${yr}|${k}`] = { vx: f.vx, vy: f.vy };
    }
    SAMPLES.forEach((s, i) => {
      if (s.year !== yr) return;
      const f = fits[`${yr}|${g(s)}`] ?? { vx: 0, vy: 0 };
      const dx = clip(f.vx * s.lead), dy = clip(f.vy * s.lead);
      out[i] = blend ? hitBlendShift(s, dx, dy, climShare(s.lead)) : hAt(i, dx, dy);
    });
  }
  return { hits: out, fits };
}

console.time("(c) LOYO");
const VARIANTS = [
  { key: "perMonth-img", grouper: "perMonth", blend: false, fit: fitVelocityHit, label: "dịch ảnh · vectơ/tháng (fit top-100)" },
  { key: "monsoon-img", grouper: "monsoon", blend: false, fit: fitVelocityHit, label: "dịch ảnh · vectơ/mùa gió (fit top-100)" },
  { key: "global-img", grouper: "global", blend: false, fit: fitVelocityHit, label: "dịch ảnh · 1 vectơ chung (fit top-100)" },
  { key: "perMonth-blend", grouper: "perMonth", blend: true, fit: fitVelocityHit, label: "dịch ảnh + pha trộn · vectơ/tháng" },
  { key: "monsoon-blend", grouper: "monsoon", blend: true, fit: fitVelocityHit, label: "dịch ảnh + pha trộn · vectơ/mùa gió" },
  ...SIGMAS.map((sg) => ({
    key: `corr${sg}-monsoon-img`, grouper: "monsoon", blend: false,
    fit: (idxs) => fitVelocityCorr(idxs, sg), label: `dịch ảnh · vectơ/mùa gió (fit TƯƠNG QUAN σ=${sg})`,
  })),
  ...SIGMAS.map((sg) => ({
    key: `corr${sg}-monsoon-blend`, grouper: "monsoon", blend: true,
    fit: (idxs) => fitVelocityCorr(idxs, sg), label: `dịch ảnh + pha trộn · vectơ/mùa gió (fit TƯƠNG QUAN σ=${sg})`,
  })),
];
const RES = {};
for (const v of VARIANTS) RES[v.key] = loyo(v.grouper, v.blend, v.fit);
console.timeEnd("(c) LOYO");

function pairedDelta(hits, base) {
  const diffs = hits.map((h, i) => h - base[i]);
  const m = mean(diffs), se = sd(diffs) / Math.sqrt(diffs.length);
  return { meanPct: r2(m), sePct: r2(se), n: diffs.length, t: se > 0 ? r2(m / se) : 0 };
}
console.log("\n=== (c) LOYO — hit trung bình theo tầm ngày (điểm %) ===");
const tableC = LEADS.map((d) => {
  const row = { "tầm(ngày)": d, "ảnh thuần": r1(baseImgL[d]), "pha trộn": r1(baseBlendL[d]) };
  for (const v of VARIANTS) row[v.key] = r1(byLead(RES[v.key].hits)[d]);
  return row;
});
console.table(tableC);

console.log("\n=== (c) CHÊNH SO VỚI HAI BASELINE (so cặp đôi, cùng mốc gốc + tầm ngày) ===");
const deltas = VARIANTS.map((v) => ({
  ...v, dImg: pairedDelta(RES[v.key].hits, hitZero), dBlend: pairedDelta(RES[v.key].hits, hitBlend),
}));
console.table(deltas.map((v) => ({
  "biến thể": v.label,
  "vs ảnh thuần": v.dImg.meanPct, "±se": v.dImg.sePct, "t": v.dImg.t,
  "vs pha trộn": v.dBlend.meanPct, "±se_": v.dBlend.sePct, "t_": v.dBlend.t,
  "thắng CẢ HAI ≥0,5?": v.dImg.meanPct >= MATERIAL && v.dBlend.meanPct >= MATERIAL ? "CÓ" : "không",
})));

const fitTable = [];
for (const v of VARIANTS) {
  for (const [k, f] of Object.entries(RES[v.key].fits)) {
    const [yr, grp] = k.split("|");
    fitTable.push({
      "biến thể": v.key, "năm giữ lại": yr, "nhóm": grp,
      "km/ngày ĐÔNG": r1(f.vx * KM_LON), "km/ngày BẮC": r1(f.vy * KM_LAT),
      "tốc độ km/ngày": r1(Math.hypot(f.vx * KM_LON, f.vy * KM_LAT)),
    });
  }
}
console.log("\n=== VECTƠ ĐÃ FIT trong LOYO (fit từ 3 năm KHÁC) ===");
console.table(fitTable.filter((r) => r["tốc độ km/ngày"] !== 0).length
  ? fitTable : fitTable.slice(0, 12));
const allFitZero = fitTable.every((r) => r["tốc độ km/ngày"] === 0);
if (allFitZero) console.log("→ MỌI vectơ fit ra ĐÚNG BẰNG 0 ⇒ phương pháp suy biến về persistence.");

/* ── HOÁN VỊ HƯỚNG → p family-wise ────────────────────────────────────────── */
let rngState = 12345;
const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };
const imgVariants = VARIANTS.filter((v) => !v.blend);
const OBS_MAX = Math.max(...deltas.map((v) => Math.min(v.dImg.meanPct, v.dBlend.meanPct)));
// Null: giữ TỐC ĐỘ đã fit, quay HƯỚNG ngẫu nhiên. Nếu mọi tốc độ fit = 0 thì null
// suy biến (mọi hoán vị đều bằng quan sát) → p vô nghĩa, phải nói rõ.
const fitSpeeds = imgVariants.flatMap((v) => Object.values(RES[v.key].fits).map((f) => Math.hypot(f.vx, f.vy)));
const permDegenerate = fitSpeeds.every((s) => s === 0);
let pFW = null, nullStats = null;
if (!permDegenerate) {
  console.time("hoán vị");
  const nullMaxes = [];
  let ge = 0;
  for (let p = 0; p < N_PERM; p++) {
    const angles = new Map();
    let mx = -Infinity;
    for (const v of imgVariants) {
      const src = RES[v.key].fits, g = GROUPERS[v.grouper];
      const h = SAMPLES.map((s, i) => {
        const key = `${s.year}|${g(s)}`;
        const f = src[key] ?? { vx: 0, vy: 0 };
        const sp = Math.hypot(f.vx, f.vy);
        if (!angles.has(key + v.key)) angles.set(key + v.key, rnd() * 2 * Math.PI);
        const a = angles.get(key + v.key);
        return hAt(i, clip(sp * Math.cos(a) * s.lead), clip(sp * Math.sin(a) * s.lead));
      });
      mx = Math.max(mx, Math.min(mean(h.map((x, i) => x - hitZero[i])), mean(h.map((x, i) => x - hitBlend[i]))));
    }
    nullMaxes.push(mx);
    if (mx >= OBS_MAX) ge++;
  }
  console.timeEnd("hoán vị");
  nullMaxes.sort((a, b) => a - b);
  pFW = r3((ge + 1) / (N_PERM + 1));
  nullStats = { median: r2(nullMaxes[N_PERM >> 1]), p95: r2(nullMaxes[Math.floor(N_PERM * 0.95)]), max: r2(nullMaxes[N_PERM - 1]) };
  console.log(`\nHoán vị HƯỚNG (${N_PERM} lần, giữ tốc độ đã fit): quan sát ${r2(OBS_MAX)} · ` +
    `null trung vị ${nullStats.median} · 95% ${nullStats.p95} ⇒ p family-wise = ${pFW}`);
} else {
  console.log("\nHoán vị hướng: BỎ QUA — mọi vectơ fit đều = 0 nên không có 'hướng' để hoán vị. " +
    "p family-wise không định nghĩa được; kết quả suy biến về persistence.");
}

/* ── ĐỘ BỀN: bỏ 1 mốc gốc ─────────────────────────────────────────────────── */
const bestVariant = deltas.slice().sort((a, b) =>
  Math.min(b.dImg.meanPct, b.dBlend.meanPct) - Math.min(a.dImg.meanPct, a.dBlend.meanPct))[0];
const robust = INDEX.origins.map((T) => {
  const keep = SAMPLES.map((s, i) => i).filter((i) => SAMPLES[i].origin !== T);
  const h = RES[bestVariant.key].hits;
  return {
    "bỏ mốc gốc": T,
    "vs ảnh": r2(mean(keep.map((i) => h[i] - hitZero[i]))),
    "vs pha trộn": r2(mean(keep.map((i) => h[i] - hitBlend[i]))),
  };
});
console.log(`\n=== ĐỘ BỀN (biến thể tốt nhất: ${bestVariant.label}) — bỏ 1 mốc gốc ===`);
console.table(robust);
const rngImg = [Math.min(...robust.map((r) => r["vs ảnh"])), Math.max(...robust.map((r) => r["vs ảnh"]))];
const rngBlend = [Math.min(...robust.map((r) => r["vs pha trộn"])), Math.max(...robust.map((r) => r["vs pha trộn"]))];
console.log(`Khoảng bỏ-1: vs ảnh [${rngImg[0]}, ${rngImg[1]}] · vs pha trộn [${rngBlend[0]}, ${rngBlend[1]}]`);

/* ── (d) THEO VÙNG ────────────────────────────────────────────────────────── */
const cWon = bestVariant.dImg.meanPct >= MATERIAL && bestVariant.dBlend.meanPct >= MATERIAL;
if (cWon) console.log("\n(c) thắng ⇒ cần chạy (d) theo vùng (vòng đo riêng).");
else console.log(`\n=== (d) THEO VÙNG: BỎ QUA đúng giao kèo — (c) chưa thắng ` +
  `(vs ảnh ${bestVariant.dImg.meanPct}; vs pha trộn ${bestVariant.dBlend.meanPct}) ===`);

/* ── KẾT LUẬN ─────────────────────────────────────────────────────────────── */
const winsBoth = bestVariant.dImg.meanPct >= MATERIAL && bestVariant.dBlend.meanPct >= MATERIAL;
const verdict = !SIGN_OK
  ? "THUA — kiểm định dấu đăng ký trước KHÔNG đạt ở mọi nguồn vectơ, và LOYO không vượt được cả hai baseline"
  : winsBoth && pFW !== null && pFW < 0.05 ? "THẮNG"
    : winsBoth ? `HOÀ — có lợi nhưng p family-wise ${pFW} không loại được ngẫu nhiên`
      : "HOÀ/THUA — mức lợi dưới ngưỡng 0,5 điểm % so với ít nhất một baseline";
console.log(`\n════════ KẾT LUẬN: ${verdict} ════════`);
console.log("GIỚI HẠN: 'sự thật' = bản đồ cá tính từ ảnh vệ tinh ngày T+d bằng chính buildFishForecast, " +
  "KHÔNG PHẢI sản lượng cá thật.");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  hypothesis: "H5 — dịch cả trường điểm theo một vectơ ĐO ĐƯỢC (không lấy từ mô hình dòng chảy)",
  caveat: "SỰ THẬT = bản đồ cá từ ảnh vệ tinh ngày T+d (buildFishForecast), KHÔNG phải sản lượng cá thật.",
  corpus: { origins: INDEX.origins, leads: LEADS, nSamples: SAMPLES.length, maskCells: MASK_IDX.length },
  settings: { TOP_K, MAX_SHIFT, MATERIAL, N_PERM, SIGMAS, FIT_LEADS, kmPerCell: { lat: r1(KM_LAT), lon: r1(KM_LON) } },
  baselines: {
    imgByLead: baseImgL, blendByLead: baseBlendL, oracleByLead: oracleL,
    imgMean: r2(mean(hitZero)), blendMean: r2(mean(hitBlend)),
    oracleMean: r2(mean(bestVec.map((b) => b.hit))), nBestNonZero, nSamples: SAMPLES.length,
  },
  shiftDistanceProfile: profByLead,
  corrDiagnostic: SIGMAS.map((sg) => ({
    sigma: sg,
    nNonZero: corrBest[sg].filter((b) => b.dx || b.dy).length,
    medianShiftCells: r2(median(corrBest[sg].map((b) => Math.hypot(b.dx, b.dy)))),
    meanRbest: r3(mean(corrBest[sg].map((b) => b.r))),
    meanRzero: r3(mean(corrBest[sg].map((b) => b.r00))),
    meanGain: r3(mean(corrBest[sg].map((b) => b.r - b.r00))),
  })),
  signTests, signOk: SIGN_OK,
  loyoByLead: tableC,
  deltas: deltas.map((v) => ({ key: v.key, label: v.label, vsImg: v.dImg, vsBlend: v.dBlend })),
  fits: fitTable,
  permutation: permDegenerate
    ? { degenerate: true, note: "mọi vectơ fit = 0 ⇒ không có hướng để hoán vị" }
    : { nPerm: N_PERM, observedMax: r2(OBS_MAX), pFamilyWise: pFW, null: nullStats },
  robustnessLeaveOneOrigin: robust, robustRange: { vsImg: rngImg, vsBlend: rngBlend },
  verdict,
}, null, 2));
console.log(`\n✓ ${OUT}`);
