// scripts/fish-hypo-percell-trust.mjs   (chạy: node scripts/fish-hypo-percell-trust.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// GIẢ THUYẾT #2 — ĐỘ TIN THEO TỪNG Ô, không phải một w toàn cục.
//
//   Ý: điểm cao sinh ra từ hai loại nguồn có TUỔI THỌ khác nhau
//      (i) front hẹp / xoáy nhỏ  → sắc, gồ ghề, thọ 2–4 ngày
//      (ii) cấu trúc nền         → trơn, rộng, thọ hàng tuần
//   ⇒ w(ô,d) = w0(d)·g(r(ô))   với r = hạng "gồ ghề cục bộ" chuẩn hoá.
//
// BƯỚC (a) ĐO CƠ CHẾ TRƯỚC: ô trong top-100 của S_T còn nằm trong top-100 THẬT
//   ở T+d không, cắt theo TAM PHÂN VỊ độ gồ ghề. Ba đường chồng nhau ⇒ CHẾT.
// BƯỚC (b–d) chỉ chạy nếu (a) tách: học 2 tham số (a,b) của g, kiểm chéo
//   leave-one-year-out 4 năm, báo CẢ 4 FOLD.
//
// BASELINE bắt buộc: ảnh-thuần · pha trộn ĐANG CHẠY (climShare) · w toàn cục
//   TỐI ƯU học trên cùng tập train (mô hình lồng nhau b=0 ⇒ so công bằng).
//
// DỮ LIỆU: .cache/fish-corpus (0 request mạng).
// SỰ THẬT = bản đồ cá tính từ ảnh vệ tinh ngày T+d — KHÔNG phải sản lượng cá.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const W_PATH = join(ROOT, "src", "data", "fish-blend-weights.json");
const OUT = join(ROOT, ".cache", "fish-hypo-percell-trust.json");

const TOP_K = 100;
const ABSENT_PERSIST = 12; // KHỚP src/lib/fish-blend.ts
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ── sao chép NGUYÊN VĂN logic src/lib/fish-blend.ts (script không import .ts) ─ */
const WEIGHTS = JSON.parse(readFileSync(W_PATH, "utf8"));
const MEASURED = (WEIGHTS.perLead ?? [])
  .filter((r) => typeof r?.w === "number")
  .map((r) => ({ lead: r.lead, w: Math.min(1, Math.max(0, r.w)) }))
  .sort((a, b) => a.lead - b.lead);
const BLEND_USABLE = MEASURED.length > 0 && WEIGHTS.guard?.degenerate !== true;
const PRODUCT_SHARE_FIRST = 0.06;
const PRODUCT_SHARE_LAST = 0.56;
const PRODUCT_SHARE_GAMMA = 2.5;
function measuredWeight(dayIdx) {
  if (!BLEND_USABLE) return 1;
  const d = Math.max(0, dayIdx);
  if (d === 0) return 1;
  if (d <= MEASURED[0].lead) return 1 + (d / MEASURED[0].lead) * (MEASURED[0].w - 1);
  for (let i = 0; i < MEASURED.length - 1; i++) {
    const a = MEASURED[i], b = MEASURED[i + 1];
    if (d <= b.lead) return a.w + ((d - a.lead) / (b.lead - a.lead)) * (b.w - a.w);
  }
  return MEASURED[MEASURED.length - 1].w;
}
function climShare(dayIdx) {
  const d = Math.max(0, dayIdx);
  if (!BLEND_USABLE || d === 0) return 0;
  const raw = 1 - measuredWeight(d);
  const lo = 1 - measuredWeight(MEASURED[0].lead);
  const hi = 1 - measuredWeight(MEASURED[MEASURED.length - 1].lead);
  if (!(hi > lo)) {
    const t = Math.min(1, d / Math.max(1, MEASURED[MEASURED.length - 1].lead));
    return PRODUCT_SHARE_FIRST + t * (PRODUCT_SHARE_LAST - PRODUCT_SHARE_FIRST);
  }
  const t = (raw - lo) / (hi - lo);
  return Math.max(0, Math.min(1,
    PRODUCT_SHARE_FIRST +
    Math.pow(Math.max(0, Math.min(1, t)), PRODUCT_SHARE_GAMMA) * (PRODUCT_SHARE_LAST - PRODUCT_SHARE_FIRST)));
}
function decodeClimatology(file) {
  const need = file.nLat * file.nLon;
  const months = new Map();
  for (let m = 1; m <= 12; m++) {
    const b64 = file.months?.[String(m)];
    if (!b64) continue;
    const arr = new Uint8Array(Buffer.from(b64, "base64"));
    if (arr.length !== need) continue;
    months.set(m, arr);
  }
  const { months: _drop, ...meta } = file;
  return { meta, months };
}
function buildClimScaleMap(clim, month, dayScores) {
  const identity = new Uint8Array(101);
  for (let i = 0; i <= 100; i++) identity[i] = i;
  const buf = clim?.months.get(month);
  if (!buf || !dayScores.length) return identity;
  const climHist = new Int32Array(101);
  let nClim = 0;
  for (const v of buf) if (v > 0) { climHist[Math.min(100, v)]++; nClim++; }
  const dayHist = new Int32Array(101);
  let nDay = 0;
  for (const v of dayScores) if (v > 0) { dayHist[Math.max(0, Math.min(100, Math.round(v)))]++; nDay++; }
  if (!nClim || !nDay) return identity;
  const dayAtPct = [];
  { let acc = 0, s = 0;
    for (let step = 0; step <= 1000; step++) {
      const p = step / 1000;
      while (s <= 100 && (acc + dayHist[s]) / nDay < p) { acc += dayHist[s]; s++; }
      dayAtPct.push(Math.min(100, s));
    } }
  const out = new Uint8Array(101);
  let acc = 0;
  for (let v = 0; v <= 100; v++) {
    if (v === 0) { out[0] = 0; continue; }
    const p = (acc + climHist[v] / 2) / nClim;
    acc += climHist[v];
    out[v] = climHist[v] === 0 ? out[v - 1] : dayAtPct[Math.round(p * 1000)];
  }
  for (let v = 1; v <= 100; v++) if (out[v] < out[v - 1]) out[v] = out[v - 1];
  return out;
}

/* ── nạp kho ──────────────────────────────────────────────────────────────── */
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
const gi = (lat) => Math.round((lat - lat0) / dLat);
const gj = (lon) => Math.round((lon - lon0) / dLon);
const cellKey = (lat, lon) => `${lat},${lon}`;
function climRawAt(lat, lon, month) {
  const buf = CLIM.months.get(month);
  if (!buf) return 0;
  const i = gi(lat), j = gj(lon);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0;
  return buf[i * nLon + j] ?? 0;
}

/* ── top-K ────────────────────────────────────────────────────────────────── */
function topKIdx(vals, K) {
  const heap = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
    if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  for (let i = 0; i < vals.length; i++) {
    if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); }
    else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); }
  }
  return heap.map((h) => h[1]);
}

/* ── ĐẶC TRƯNG Ô: độ gồ ghề cục bộ trên trường S_T ────────────────────────── */
/** grid Float64 (NaN = không có số) từ danh sách ô của một ngày */
function gridOf(day) {
  const g = new Float64Array(nLat * nLon).fill(NaN);
  for (const c of day.cells) {
    const i = gi(c.lat), j = gj(c.lon);
    if (i >= 0 && i < nLat && j >= 0 && j < nLon) g[i * nLon + j] = c.s;
  }
  return g;
}
/** std trong cửa sổ (2R+1)² — NaN nếu quá ít láng giềng có số */
function roughStd(g, i, j, R, minN) {
  let n = 0, s = 0, s2 = 0;
  for (let di = -R; di <= R; di++)
    for (let dj = -R; dj <= R; dj++) {
      const a = i + di, b = j + dj;
      if (a < 0 || a >= nLat || b < 0 || b >= nLon) continue;
      const v = g[a * nLon + b];
      if (!Number.isFinite(v)) continue;
      n++; s += v; s2 += v * v;
    }
  if (n < minN) return NaN;
  const m = s / n;
  return Math.sqrt(Math.max(0, s2 / n - m * m));
}
/** |laplacian| = |tâm − trung bình 8 láng giềng 3×3| */
function roughLap(g, i, j) {
  const c = g[i * nLon + j];
  if (!Number.isFinite(c)) return NaN;
  let n = 0, s = 0;
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || a >= nLat || b < 0 || b >= nLon) continue;
      const v = g[a * nLon + b];
      if (!Number.isFinite(v)) continue;
      n++; s += v;
    }
  return n < 5 ? NaN : Math.abs(c - s / n);
}

/* BẢN ĐỒ TRUNG BÌNH DÀI HẠN TỪNG Ô — dựng từ 192 ngày corpus, LOẠI năm test.
   Trả về hàm (year) → {mean:Float64Array, topFreq:Float64Array} */
const ALL_DAYS = INDEX.days;
const YEARS = [...new Set(INDEX.origins.map((o) => o.slice(0, 4)))].sort();
const ltCache = new Map();
function longTerm(excludeYear) {
  const key = excludeYear ?? "all";
  if (ltCache.has(key)) return ltCache.get(key);
  const sum = new Float64Array(nLat * nLon);
  const cnt = new Float64Array(nLat * nLon);
  const topc = new Float64Array(nLat * nLon);
  let nDays = 0;
  for (const date of ALL_DAYS) {
    if (excludeYear && date.slice(0, 4) === excludeYear) continue;
    const day = loadDay(date);
    if (!day) continue;
    nDays++;
    const vals = day.cells.map((c) => c.s);
    const idxTop = new Set(topKIdx(vals, TOP_K));
    day.cells.forEach((c, k) => {
      const i = gi(c.lat), j = gj(c.lon);
      if (i < 0 || i >= nLat || j < 0 || j >= nLon) return;
      const p = i * nLon + j;
      sum[p] += c.s; cnt[p] += 1;
      if (idxTop.has(k)) topc[p] += 1;
    });
  }
  const mean = new Float64Array(nLat * nLon).fill(NaN);
  const freq = new Float64Array(nLat * nLon);
  for (let p = 0; p < mean.length; p++) {
    if (cnt[p] >= 20) mean[p] = sum[p] / cnt[p];
    freq[p] = nDays ? topc[p] / nDays : 0;
  }
  const v = { mean, freq, nDays };
  ltCache.set(key, v);
  return v;
}

/* ── DỰNG MẪU ─────────────────────────────────────────────────────────────── */
const LEADS = INDEX.leads.slice();
const samples = []; // mỗi phần tử: {origin, year, lead, P, C, Y, topTrue, feats:{...}}
let skipped = 0;
for (const T of INDEX.origins) {
  const dayT = loadDay(T);
  if (!dayT) { skipped++; continue; }
  const year = T.slice(0, 4);
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const gT = gridOf(dayT);
  const lt = longTerm(year); // LOẠI năm của chính mốc gốc → chống rò rỉ
  for (const d of LEADS) {
    const target = addDays(T, d);
    const dayY = loadDay(target);
    if (!dayY) { skipped++; continue; }
    const m = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayT.cells.map((c) => c.s));
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf)
      for (let i = 0; i < nLat; i++)
        for (let j = 0; j < nLon; j++) {
          if (!buf[i * nLon + j]) continue;
          keys.add(cellKey(Math.round((lat0 + i * dLat) * 100) / 100, Math.round((lon0 + j * dLon) * 100) / 100));
        }
    const n = keys.size;
    const P = new Float64Array(n), C = new Float64Array(n), Y = new Float64Array(n);
    const fStd = new Float64Array(n), fLap = new Float64Array(n), fAnom = new Float64Array(n), fFreq = new Float64Array(n);
    let k = 0;
    for (const key of keys) {
      const ci = key.indexOf(",");
      const lat = +key.slice(0, ci), lon = +key.slice(ci + 1);
      P[k] = persist.has(key) ? persist.get(key) : ABSENT_PERSIST;
      Y[k] = truth.has(key) ? truth.get(key) : ABSENT_PERSIST;
      C[k] = scale[Math.min(100, climRawAt(lat, lon, m))] ?? 0;
      const i = gi(lat), j = gj(lon);
      const inGrid = i >= 0 && i < nLat && j >= 0 && j < nLon;
      fStd[k] = inGrid ? roughStd(gT, i, j, 2, 10) : NaN;
      fLap[k] = inGrid ? roughLap(gT, i, j) : NaN;
      const mu = inGrid ? lt.mean[i * nLon + j] : NaN;
      fAnom[k] = Number.isFinite(mu) && persist.has(key) ? Math.abs(P[k] - mu) : NaN;
      fFreq[k] = inGrid ? lt.freq[i * nLon + j] : NaN;
      k++;
    }
    samples.push({
      origin: T, year, lead: d, target, month: m, P, C, Y,
      topTrue: new Set(topKIdx(Y, TOP_K)),
      topPred: topKIdx(P, TOP_K),
      feats: { std: fStd, lap: fLap, anom: fAnom, freq: fFreq },
    });
  }
  process.stdout.write(".");
}
console.log(`\nmẫu: ${samples.length} (bỏ ${skipped}) · ${INDEX.origins.length} mốc gốc × ${LEADS.length} tầm · năm: ${YEARS.join(",")}\n`);

/* ── BƯỚC (a) · ĐO CƠ CHẾ: tỷ lệ SỐNG SÓT của top-100 ảnh, cắt tam phân vị ── */
const FEATS = ["std", "lap", "anom", "freq"];
const survival = {}; // feat → lead → [t1,t2,t3] (%)
for (const f of FEATS) {
  const acc = new Map(LEADS.map((d) => [d, [[], [], []]]));
  for (const s of samples) {
    const fv = s.feats[f];
    // chỉ xét ô nằm trong top-100 của ẢNH ngày T
    const rows = s.topPred
      .map((i) => ({ i, v: fv[i] }))
      .filter((r) => Number.isFinite(r.v));
    if (rows.length < 30) continue;
    rows.sort((a, b) => a.v - b.v); // thấp = TRƠN, cao = GỒ GHỀ
    const n = rows.length;
    const cut = [Math.floor(n / 3), Math.floor((2 * n) / 3)];
    const groups = [rows.slice(0, cut[0]), rows.slice(cut[0], cut[1]), rows.slice(cut[1])];
    groups.forEach((g, t) => {
      if (!g.length) return;
      const surv = g.filter((r) => s.topTrue.has(r.i)).length / g.length;
      acc.get(s.lead)[t].push(surv * 100);
    });
  }
  survival[f] = LEADS.map((d) => {
    const g = acc.get(d);
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    const se = (a) => {
      if (a.length < 2) return NaN;
      const m = mean(a);
      return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1)) / Math.sqrt(a.length);
    };
    return {
      lead: d,
      n: g[0].length,
      t1: r1(mean(g[0])), t2: r1(mean(g[1])), t3: r1(mean(g[2])),
      seT1: r1(se(g[0])), seT3: r1(se(g[2])),
      gapSmoothMinusRough: r1(mean(g[0]) - mean(g[2])),
    };
  });
}

console.log("=== BƯỚC (a) · TỶ LỆ SỐNG SÓT của ô top-100 ảnh, theo TAM PHÂN VỊ đặc trưng ===");
console.log("   t1 = TRƠN nhất · t3 = GỒ GHỀ nhất · gap = t1 − t3 (dương ⇒ trơn thọ hơn)\n");
for (const f of FEATS) {
  console.log(`— đặc trưng: ${f} —`);
  console.table(survival[f].map((r) => ({
    "tầm(ngày)": r.lead, "t1 trơn %": r.t1, "t2 %": r.t2, "t3 gồ ghề %": r.t3,
    "gap (t1−t3)": r.gapSmoothMinusRough, "±se t1": r.seT1, "±se t3": r.seT3, "n mốc": r.n,
  })));
}
const gapAtD8 = Object.fromEntries(FEATS.map((f) => [f, survival[f].find((r) => r.lead === 8)?.gapSmoothMinusRough]));
const maxAbsGap8 = Math.max(...Object.values(gapAtD8).map((v) => Math.abs(v ?? 0)));
console.log("gap tại d8:", JSON.stringify(gapAtD8), "| |gap| lớn nhất =", r1(maxAbsGap8));
const MECH_THRESHOLD = 3; // điểm % — người đẻ giả thuyết chốt: <3 ⇒ bác bỏ, dừng
const mechAlive = maxAbsGap8 >= MECH_THRESHOLD;
console.log(mechAlive
  ? `⇒ CƠ CHẾ CÓ TÁCH (|gap| d8 = ${r1(maxAbsGap8)} ≥ ${MECH_THRESHOLD}) → chạy tiếp bước (b–d)\n`
  : `⇒ CƠ CHẾ KHÔNG TÁCH (|gap| d8 = ${r1(maxAbsGap8)} < ${MECH_THRESHOLD}) → GIẢ THUYẾT CHẾT ở bước (a)\n`);

/* ── TRẦN CỦA CẢ HỌ H2 (oracle, có nhìn trộm sự thật) ─────────────────────────
   Mọi mô hình dạng pred_i = (1−sh_i)·P_i + sh_i·C_i với sh_i ∈ [0,1] đều nằm
   trong đoạn [min(P_i,C_i), max(P_i,C_i)]. Kẻ gian lận tối đa: đẩy ô THẬT SỰ
   thuộc top-100 lên đầu đoạn, ô khác xuống đáy đoạn. Đó là TRẦN TUYỆT ĐỐI của
   việc "chọn tỷ lệ tin theo từng ô" — không đặc trưng nào vượt được. */
if (process.env.STEP === "oracle") {
  const byLeadO = new Map(LEADS.map((d) => [d, []]));
  const byLeadI = new Map(LEADS.map((d) => [d, []]));
  for (const s of samples) {
    const n = s.P.length;
    const pred = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const lo = Math.min(s.P[i], s.C[i]), hi = Math.max(s.P[i], s.C[i]);
      pred[i] = s.topTrue.has(i) ? hi : lo;
    }
    let hit = 0;
    for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) hit++;
    byLeadO.get(s.lead).push(hit);
    let h2 = 0;
    for (const i of topKIdx(s.P, TOP_K)) if (s.topTrue.has(i)) h2++;
    byLeadI.get(s.lead).push(h2);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log("\n=== TRẦN ORACLE của họ 'pha theo từng ô' (gian lận: biết trước sự thật) ===");
  console.table(LEADS.map((d) => ({
    "tầm(ngày)": d,
    "ảnh thuần": r1(mean(byLeadI.get(d))),
    "TRẦN oracle": r1(mean(byLeadO.get(d))),
    "dư địa tối đa": r1(mean(byLeadO.get(d)) - mean(byLeadI.get(d))),
  })));
  process.exit(0);
}

/* ── CHẨN ĐOÁN: đặc trưng có TRÙNG với chính bản mùa vụ C không? ───────────── */
if (process.env.STEP === "diag") {
  const rho = (a, b) => {
    const n = a.length;
    const rk = (arr) => {
      const idx = Array.from({ length: n }, (_, i) => i).sort((x, y) => arr[x] - arr[y]);
      const r = new Float64Array(n);
      let i = 0;
      while (i < n) { let j = i; while (j + 1 < n && arr[idx[j + 1]] === arr[idx[i]]) j++;
        const av = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = av; i = j + 1; }
      return r;
    };
    const x = rk(a), y = rk(b);
    let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    const mx = sx / n, my = sy / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const p = x[i] - mx, q = y[i] - my; sxy += p * q; sxx += p * p; syy += q * q; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  };
  const out = {};
  for (const f of FEATS) {
    const vs = samples.map((s) => {
      const v = s.feats[f];
      const keep = [];
      for (let i = 0; i < v.length; i++) if (Number.isFinite(v[i])) keep.push(i);
      return rho(keep.map((i) => v[i]), keep.map((i) => s.C[i]));
    });
    out[f] = r3(vs.reduce((a, b) => a + b, 0) / vs.length);
  }
  console.log("\n=== CHẨN ĐOÁN · Spearman(đặc trưng, điểm MÙA VỤ C) trung bình trên mẫu ===");
  console.log(JSON.stringify(out));
  console.log("|rho| lớn ⇒ đặc trưng KHÔNG mang tin mới: lớp pha trộn hiện tại đã dùng đúng trục đó rồi.");

  /* Sau khi lớp PHA TRỘN HIỆN TẠI đã chạy, đặc trưng còn tách được sống sót không?
     Tách biến mất ⇒ blend toàn cục ĐÃ khai thác hết cơ chế đó rồi. */
  console.log("\n=== CHẨN ĐOÁN 2 · tách sống sót TRONG top-100 của BẢN PHA TRỘN ĐANG CHẠY ===");
  const rows = [];
  for (const d of LEADS) {
    const acc = [[], [], []];
    for (const s of samples.filter((x) => x.lead === d)) {
      const sh = climShare(d);
      const n = s.P.length, pred = new Float64Array(n);
      for (let i = 0; i < n; i++) pred[i] = (1 - sh) * s.P[i] + sh * s.C[i];
      const tp = topKIdx(pred, TOP_K);
      for (const [fi, f] of [["freq"], ["anom"]].map((x, k) => [k, x[0]])) {
        void fi;
      }
      const v = s.feats.freq;
      const list = tp.map((i) => ({ i, v: v[i] })).filter((r) => Number.isFinite(r.v)).sort((a, b) => a.v - b.v);
      if (list.length < 30) continue;
      const c1 = Math.floor(list.length / 3), c2 = Math.floor((2 * list.length) / 3);
      [list.slice(0, c1), list.slice(c1, c2), list.slice(c2)].forEach((g, t) => {
        if (g.length) acc[t].push((g.filter((r) => s.topTrue.has(r.i)).length / g.length) * 100);
      });
    }
    const mn = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    rows.push({ "tầm(ngày)": d, "t1 ít-khi-top %": r1(mn(acc[0])), "t2 %": r1(mn(acc[1])), "t3 hay-top %": r1(mn(acc[2])), "gap (t3−t1)": r1(mn(acc[2]) - mn(acc[0])) });
  }
  console.table(rows);
  process.exit(0);
}

if (process.env.STEP === "a") {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), stepA: { thresholdPct: MECH_THRESHOLD, gapAtD8, alive: mechAlive, survival } }, null, 2));
  console.log(`✓ (chỉ bước a) ${OUT}`);
  process.exit(0);
}

/* ── BƯỚC (b) · MÔ HÌNH w(ô,d) = w0(d)·g(r) ───────────────────────────────── */
// share_clim(ô,d) = clamp01( climShare(d) · (A + B·(2r−1)) ), r = hạng chuẩn hoá
// của đặc trưng trong CHÍNH mẫu đó. B = 0 ⇒ đúng baseline w toàn cục co giãn A.
// Trung bình của (A + B·(2r−1)) = A (r phân bố đều) ⇒ A không bị B kéo lệch.
function rankNorm(vals) {
  const n = vals.length;
  const ok = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(vals[i])) ok.push(i);
  const out = new Float64Array(n).fill(0.5); // thiếu số → giữa
  ok.sort((a, b) => vals[a] - vals[b]);
  for (let k = 0; k < ok.length; k++) out[ok[k]] = ok.length > 1 ? k / (ok.length - 1) : 0.5;
  return out;
}
for (const s of samples) {
  s.rank = {};
  for (const f of FEATS) s.rank[f] = rankNorm(s.feats[f]);
}

const A_GRID = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
const B_GRID = [-2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.5, 2];

function hitPct(s, A, B, feat) {
  const base = climShare(s.lead);
  const n = s.P.length;
  const pred = new Float64Array(n);
  if (B === 0) {
    const sh = Math.max(0, Math.min(1, base * A));
    for (let i = 0; i < n; i++) pred[i] = (1 - sh) * s.P[i] + sh * s.C[i];
  } else {
    const r = s.rank[feat];
    for (let i = 0; i < n; i++) {
      let sh = base * (A + B * (2 * r[i] - 1));
      sh = sh < 0 ? 0 : sh > 1 ? 1 : sh;
      pred[i] = (1 - sh) * s.P[i] + sh * s.C[i];
    }
  }
  let hit = 0;
  for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) hit++;
  return (hit / TOP_K) * 100;
}

// bảng hit: feat → "A|B" → mảng theo mẫu
console.log("Đang quét lưới tham số (có thể mất ~1 phút)…");
const HIT = {};
for (const f of FEATS) {
  HIT[f] = new Map();
  for (const A of A_GRID)
    for (const B of B_GRID) {
      if (B !== 0 && A === 0) continue; // A=0 và B≠0 cho share âm-đối xứng, vô nghĩa
      const key = `${A}|${B}`;
      if (B === 0 && HIT.__glob?.has(key)) { HIT[f].set(key, HIT.__glob.get(key)); continue; }
      const arr = samples.map((s) => hitPct(s, A, B, f));
      HIT[f].set(key, arr);
      if (B === 0) { HIT.__glob = HIT.__glob ?? new Map(); HIT.__glob.set(key, arr); }
    }
  process.stdout.write(`[${f}]`);
}
console.log("");

const HIT_IMG = samples.map((s) => hitPct(s, 0, 0, "std"));          // ảnh thuần (share=0)
const HIT_RUNTIME = samples.map((s) => hitPct(s, 1, 0, "std"));      // pha trộn ĐANG CHẠY (A=1,B=0)

/** trung bình theo TẦM rồi theo mốc gốc (mỗi tầm cân bằng) trên tập chỉ số idxs */
function meanOver(arr, idxs) {
  const byLead = new Map();
  for (const i of idxs) {
    const d = samples[i].lead;
    if (!byLead.has(d)) byLead.set(d, []);
    byLead.get(d).push(arr[i]);
  }
  let s = 0, n = 0;
  for (const [, a] of byLead) { s += a.reduce((x, y) => x + y, 0) / a.length; n++; }
  return n ? s / n : NaN;
}
const ALL_IDX = samples.map((_, i) => i);
const idxOfYear = (y) => ALL_IDX.filter((i) => samples[i].year === y);
const idxNotYear = (y) => ALL_IDX.filter((i) => samples[i].year !== y);

/* ── (c)+(d) · KIỂM CHÉO LEAVE-ONE-YEAR-OUT ───────────────────────────────── */
function fitGlobal(trainIdx) { // baseline: B=0, chọn A tốt nhất
  let best = null;
  for (const A of A_GRID) {
    const v = meanOver(HIT.__glob.get(`${A}|0`), trainIdx);
    if (!best || v > best.v) best = { A, B: 0, v };
  }
  return best;
}
function fitPerCell(trainIdx, feat) { // H2: chọn (A,B)
  let best = null;
  for (const A of A_GRID)
    for (const B of B_GRID) {
      const key = `${A}|${B}`;
      if (!HIT[feat].has(key)) continue;
      const v = meanOver(HIT[feat].get(key), trainIdx);
      if (!best || v > best.v) best = { A, B, v };
    }
  return best;
}

const folds = [];
for (const y of YEARS) {
  const tr = idxNotYear(y), te = idxOfYear(y);
  const row = { year: y, nTest: te.length,
    imgOnly: r2(meanOver(HIT_IMG, te)),
    runtime: r2(meanOver(HIT_RUNTIME, te)) };
  const gb = fitGlobal(tr);
  row.globalFit = gb;
  row.globalTest = r2(meanOver(HIT.__glob.get(`${gb.A}|0`), te));
  row.perFeat = {};
  for (const f of FEATS) {
    const fit = fitPerCell(tr, f);
    const test = r2(meanOver(HIT[f].get(`${fit.A}|${fit.B}`), te));
    row.perFeat[f] = { fit: { A: fit.A, B: fit.B }, test,
      vsGlobal: r2(test - row.globalTest), vsRuntime: r2(test - row.runtime), vsImg: r2(test - row.imgOnly) };
  }
  folds.push(row);
}

console.log("=== (c)+(d) · KIỂM CHÉO LEAVE-ONE-YEAR-OUT (top-100 hit %, trên năm BỊ GIỮ LẠI) ===");
console.table(folds.map((f) => ({
  "năm test": f.year, "ảnh thuần": f.imgOnly, "pha ĐANG CHẠY": f.runtime,
  "w toàn cục tối ưu": f.globalTest, "(A học được)": f.globalFit.A,
  ...Object.fromEntries(FEATS.map((k) => [`H2 ${k}`, f.perFeat[k].test])),
})));
console.log("\nH2 hơn 'w toàn cục tối ưu' bao nhiêu điểm % (theo fold):");
console.table(folds.map((f) => ({
  "năm test": f.year,
  ...Object.fromEntries(FEATS.map((k) => [k, f.perFeat[k].vsGlobal])),
  ...Object.fromEntries(FEATS.map((k) => [`${k} (A,B)`, `${f.perFeat[k].fit.A},${f.perFeat[k].fit.B}`])),
})));

const summary = {};
for (const f of FEATS) {
  const v = folds.map((x) => x.perFeat[f].vsGlobal);
  const vr = folds.map((x) => x.perFeat[f].vsRuntime);
  const vi = folds.map((x) => x.perFeat[f].vsImg);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const se = (a) => Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1)) / Math.sqrt(a.length);
  summary[f] = {
    vsGlobalMean: r2(mean(v)), vsGlobalSe: r2(se(v)), foldsPositive: v.filter((x) => x > 0).length,
    vsRuntimeMean: r2(mean(vr)), vsImgMean: r2(mean(vi)), perFold: v.map(r2),
  };
}
console.log("\n=== TỔNG HỢP LOYO ===");
console.table(FEATS.map((f) => ({
  "đặc trưng": f,
  "TB hơn w toàn cục": summary[f].vsGlobalMean, "±se": summary[f].vsGlobalSe,
  "số fold dương": `${summary[f].foldsPositive}/4`,
  "TB hơn pha ĐANG CHẠY": summary[f].vsRuntimeMean,
  "TB hơn ảnh thuần": summary[f].vsImgMean,
})));

/* ── HÁI QUẢ: 4 đặc trưng × lưới (A,B) → phải trừ lợi thế chọn ────────────── */
// Permutation: xáo HẠNG r trong từng mẫu (giữ nguyên P, C, Y và cấu trúc lưới)
// rồi chạy lại đúng quy trình LOYO + chọn đặc trưng tốt nhất → phân bố null của
// "lợi ích lớn nhất qua 4 đặc trưng". p family-wise = tỷ lệ null ≥ quan sát.
const bestFeat = FEATS.reduce((a, b) => (summary[a].vsGlobalMean >= summary[b].vsGlobalMean ? a : b));
const observedMax = Math.max(...FEATS.map((f) => summary[f].vsGlobalMean));
const N_PERM = Number(process.env.NPERM ?? 200);
console.log(`\nĐang chạy ${N_PERM} hoán vị để trừ lợi thế hái quả (đặc trưng thắng: ${bestFeat}, lợi ích quan sát ${r2(observedMax)})…`);

function shuffled(arr, rnd) {
  const a = Float64Array.from(arr);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// lưới rút gọn cho hoán vị (giữ nguyên số bậc tự do B, A cố định theo baseline)
const permMax = [];
for (let p = 0; p < N_PERM; p++) {
  const rnd = mulberry32(1000 + p);
  const permRank = samples.map((s) => shuffled(s.rank[bestFeat], rnd));
  const hitTab = new Map();
  for (const A of A_GRID)
    for (const B of B_GRID) {
      if (B === 0) { hitTab.set(`${A}|0`, HIT.__glob.get(`${A}|0`)); continue; }
      if (A === 0) continue;
      const arr = samples.map((s, si) => {
        const base = climShare(s.lead);
        const n = s.P.length, pred = new Float64Array(n), r = permRank[si];
        for (let i = 0; i < n; i++) {
          let sh = base * (A + B * (2 * r[i] - 1));
          sh = sh < 0 ? 0 : sh > 1 ? 1 : sh;
          pred[i] = (1 - sh) * s.P[i] + sh * s.C[i];
        }
        let hit = 0;
        for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) hit++;
        return hit;
      });
      hitTab.set(`${A}|${B}`, arr);
    }
  let sumGain = 0;
  for (const y of YEARS) {
    const tr = idxNotYear(y), te = idxOfYear(y);
    const gb = fitGlobal(tr);
    const gTest = meanOver(HIT.__glob.get(`${gb.A}|0`), te);
    let best = null;
    for (const [key, arr] of hitTab) {
      const v = meanOver(arr, tr);
      if (!best || v > best.v) best = { key, v };
    }
    sumGain += meanOver(hitTab.get(best.key), te) - gTest;
  }
  permMax.push(sumGain / YEARS.length);
  if ((p + 1) % 25 === 0) process.stdout.write(`${p + 1} `);
}
console.log("");
permMax.sort((a, b) => a - b);
const pPerm = (permMax.filter((v) => v >= observedMax).length + 1) / (permMax.length + 1);
// điều chỉnh family-wise thô theo Šidák cho 4 đặc trưng (permutation đã bao lưới A,B)
const pFamily = 1 - Math.pow(1 - Math.min(1, pPerm), FEATS.length);
console.log(`p (hoán vị, đã bao cả lưới A×B) = ${r3(pPerm)} · p family-wise (Šidák, 4 đặc trưng) = ${r3(pFamily)}`);
console.log(`null: TB ${r2(permMax.reduce((a, b) => a + b, 0) / permMax.length)} · p95 ${r2(permMax[Math.floor(permMax.length * 0.95)])} · max ${r2(permMax[permMax.length - 1])}`);

/* ── ĐỘ BỀN: bỏ 1 MỐC GỐC bất kỳ ──────────────────────────────────────────── */
const robust = [];
for (const drop of INDEX.origins) {
  const keep = ALL_IDX.filter((i) => samples[i].origin !== drop);
  let sum = 0;
  for (const y of YEARS) {
    const tr = keep.filter((i) => samples[i].year !== y);
    const te = keep.filter((i) => samples[i].year === y);
    if (!te.length || !tr.length) continue;
    const gb = fitGlobal(tr);
    const gTest = meanOver(HIT.__glob.get(`${gb.A}|0`), te);
    const fit = fitPerCell(tr, bestFeat);
    sum += meanOver(HIT[bestFeat].get(`${fit.A}|${fit.B}`), te) - gTest;
  }
  robust.push({ dropped: drop, vsGlobal: r2(sum / YEARS.length) });
}
console.log("\n=== ĐỘ BỀN · bỏ 1 mốc gốc (lợi ích H2 vs w toàn cục, LOYO) ===");
console.table(robust.map((r) => ({ "bỏ mốc": r.dropped, "lợi ích": r.vsGlobal })));
const rv = robust.map((r) => r.vsGlobal);
console.log(`dải khi bỏ 1 mốc: ${r2(Math.min(...rv))} … ${r2(Math.max(...rv))} (đầy đủ: ${r2(observedMax)})`);

/* ── PHÂN RÃ THEO TẦM NGÀY cho đặc trưng thắng (LOYO) ─────────────────────── */
const byLead = LEADS.map((d) => {
  const row = { lead: d };
  let img = 0, run = 0, glob = 0, h2 = 0, n = 0;
  for (const y of YEARS) {
    const tr = idxNotYear(y);
    const te = ALL_IDX.filter((i) => samples[i].year === y && samples[i].lead === d);
    if (!te.length) continue;
    const gb = fitGlobal(tr);
    const fit = fitPerCell(tr, bestFeat);
    const avg = (arr) => te.reduce((a, i) => a + arr[i], 0) / te.length;
    img += avg(HIT_IMG); run += avg(HIT_RUNTIME);
    glob += avg(HIT.__glob.get(`${gb.A}|0`));
    h2 += avg(HIT[bestFeat].get(`${fit.A}|${fit.B}`));
    n++;
  }
  row.imgOnly = r1(img / n); row.runtime = r1(run / n);
  row.global = r1(glob / n); row.h2 = r1(h2 / n);
  row.h2VsGlobal = r2(row.h2 - row.global);
  row.h2VsRuntime = r2(row.h2 - row.runtime);
  row.h2VsImg = r2(row.h2 - row.imgOnly);
  return row;
});
console.log(`\n=== THEO TẦM NGÀY (đặc trưng ${bestFeat}, LOYO) ===`);
console.table(byLead.map((r) => ({
  "tầm(ngày)": r.lead, "ảnh thuần": r.imgOnly, "pha ĐANG CHẠY": r.runtime,
  "w toàn cục": r.global, "H2 theo ô": r.h2,
  "H2−toàn cục": r.h2VsGlobal, "H2−đang chạy": r.h2VsRuntime, "H2−ảnh": r.h2VsImg,
})));

const MATERIAL = 0.5;
const meanH2 = folds.reduce((a, f) => a + f.perFeat[bestFeat].test, 0) / folds.length;
const meanRun = folds.reduce((a, f) => a + f.runtime, 0) / folds.length;
const meanImg = folds.reduce((a, f) => a + f.imgOnly, 0) / folds.length;
const meanGlob = folds.reduce((a, f) => a + f.globalTest, 0) / folds.length;
const verdict =
  !mechAlive
    ? "THUA/HOÀ — cơ chế không tách ở bước (a); mọi lợi ích sau đó là nhiễu"
    : summary[bestFeat].vsGlobalMean >= MATERIAL && summary[bestFeat].foldsPositive >= 3 && pFamily < 0.05
      ? "THẮNG"
      : Math.abs(summary[bestFeat].vsGlobalMean) < MATERIAL
        ? "HOÀ — lợi ích dưới ngưỡng 0,5 điểm %"
        : "THUA/KHÔNG BỀN — hoặc p không đạt, hoặc không đủ 3/4 fold cùng dấu";

console.log("\n===================== KẾT LUẬN =====================");
console.log(`đặc trưng tốt nhất: ${bestFeat}`);
console.log(`LOYO trung bình 4 fold: ảnh thuần ${r2(meanImg)} · pha ĐANG CHẠY ${r2(meanRun)} · w toàn cục tối ưu ${r2(meanGlob)} · H2 theo ô ${r2(meanH2)}`);
console.log(`H2 − w toàn cục = ${summary[bestFeat].vsGlobalMean} ± ${summary[bestFeat].vsGlobalSe} · fold dương ${summary[bestFeat].foldsPositive}/4 · p family-wise ${r3(pFamily)}`);
console.log(`⇒ ${verdict}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  hypothesis: "H2 — độ tin theo từng ô: w(ô,d)=w0(d)·g(r(ô)), r = hạng gồ ghề/dị thường chuẩn hoá",
  caveat: "SỰ THẬT = bản đồ cá tính từ ảnh vệ tinh ngày T+d bằng cùng pipeline, KHÔNG phải sản lượng cá thật.",
  corpus: { origins: INDEX.origins, leads: LEADS, nSamples: samples.length },
  stepA: { thresholdPct: MECH_THRESHOLD, gapAtD8, alive: mechAlive, survival },
  loyo: { folds, summary, bestFeat, meanImg: r2(meanImg), meanRuntime: r2(meanRun), meanGlobal: r2(meanGlob), meanH2: r2(meanH2) },
  permutation: { nPerm: N_PERM, observedMax: r2(observedMax), pPerm: r3(pPerm), pFamilySidak: r3(pFamily) },
  robustnessDropOneOrigin: robust,
  byLead,
  verdict,
}, null, 2));
console.log(`\n✓ ${OUT}`);
