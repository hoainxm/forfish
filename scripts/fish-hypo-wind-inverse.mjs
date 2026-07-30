// scripts/fish-hypo-wind-inverse.mjs  (chạy: npx tsx scripts/fish-hypo-wind-inverse.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// PHỤ LỤC cho GIẢ THUYẾT #3 — H3 ĐÃ BỊ BÁC. Script này KHÔNG cứu H3; nó ĐO một
// GIẢ THUYẾT MỚI lộ ra trong lúc chẩn đoán, để người sau khỏi phải mò lại:
//
//   "H3-nghịch": số hạng gió DUY NHẤT có tương quan là TỐC ĐỘ GIÓ với dấu
//   NGƯỢC tiền đề — gió MẠNH ⇒ điểm cá CAO hơn (r(M,R) = +0,06…+0,17, tăng
//   theo tầm ngày). Tiền đề "xáo trộn xoá front" của H3 SAI DẤU trên biến
//   'sự thật' đang dùng (bản đồ cá tính từ ảnh vệ tinh): gió mạnh ⇒ xáo trộn
//   ⇒ dinh dưỡng lên mặt ⇒ chl cao ⇒ ĐIỂM CAO.
//
//   Mô hình: pred = pha-trộn + γ·ẑ(tốc độ gió cửa sổ [d−5,d−1] − nền [T−5,T−1])
//   ĐÚNG 1 THAM SỐ γ. Kiểm chéo LOYO (4 năm) + hoán vị.
//   Số hạng NƯỚC TRỒI bị BỎ vì trần trong-mẫu của nó là α*=0 khi thả dấu tự do.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClimScaleMap, decodeClimatology, ABSENT_PERSIST, climShare } from "../src/lib/fish-blend.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, ".cache", "fish-corpus");
const CLIM_PATH = join(ROOT, "public", "data", "fish-climatology.v1.json");
const WIND_PATH = join(ROOT, ".cache", "fish-wind", "era5-1deg.json");
const OUT = join(ROOT, ".cache", "fish-hypo-wind-inverse.json");
const TOP_K = 100;
const r2 = (x) => Math.round(x * 100) / 100;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const INDEX = JSON.parse(readFileSync(join(CORPUS, "index.json"), "utf8"));
const CLIM = decodeClimatology(JSON.parse(readFileSync(CLIM_PATH, "utf8")));
const WIND = JSON.parse(readFileSync(WIND_PATH, "utf8"));
const dayCache = new Map();
const loadDay = (d) => { if (dayCache.has(d)) return dayCache.get(d); const p = join(CORPUS, "days", `${d}.json`); const v = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; dayCache.set(d, v); return v; };
const { lat0: cLat0, lon0: cLon0, dLat, dLon, nLat, nLon } = CLIM.meta;
const cellKey = (a, b) => `${a},${b}`;
const climRawAt = (lat, lon, m) => { const buf = CLIM.months.get(m); if (!buf) return 0; const i = Math.round((lat - cLat0) / dLat), j = Math.round((lon - cLon0) / dLon); return i >= 0 && i < nLat && j >= 0 && j < nLon ? (buf[i * nLon + j] ?? 0) : 0; };
const W_NLAT = WIND.nLat, W_NLON = WIND.nLon, W_LAT0 = WIND.lat0, W_LON0 = WIND.lon0, W_STEP = WIND.step;
const NPT = W_NLAT * W_NLON;
const dateIdx = new Map(WIND.times.map((t, i) => [t, i]));
const SPD = WIND.speed.map((row) => { const f = new Float64Array(NPT); for (let k = 0; k < NPT; k++) f[k] = row[k] ?? 0; return f; });
const winMean = (fields, dates) => { const o = new Float64Array(NPT); let n = 0; for (const dt of dates) { const i = dateIdx.get(dt); if (i === undefined) continue; const f = fields[i]; for (let k = 0; k < NPT; k++) o[k] += f[k]; n++; } if (n) for (let k = 0; k < NPT; k++) o[k] /= n; return o; };
const bilinear = (f, lat, lon) => { const x = (lon - W_LON0) / W_STEP, y = (lat - W_LAT0) / W_STEP; const j0 = Math.max(0, Math.min(W_NLON - 2, Math.floor(x))), i0 = Math.max(0, Math.min(W_NLAT - 2, Math.floor(y))); const fx = Math.max(0, Math.min(1, x - j0)), fy = Math.max(0, Math.min(1, y - i0)); const g = (i, j) => f[i * W_NLON + j]; return g(i0, j0) * (1 - fx) * (1 - fy) + g(i0, j0 + 1) * fx * (1 - fy) + g(i0 + 1, j0) * (1 - fx) * fy + g(i0 + 1, j0 + 1) * fx * fy; };
const zscore = (a) => { const n = a.length; let s = 0; for (let i = 0; i < n; i++) s += a[i]; const m = s / n; let v = 0; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2; const sd = Math.sqrt(v / n); const o = new Float64Array(n); if (sd > 1e-9) for (let i = 0; i < n; i++) o[i] = (a[i] - m) / sd; return o; };
function topKIdx(vals, K) {
  const heap = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  for (let i = 0; i < vals.length; i++) { if (heap.length < K) { heap.push([vals[i], i]); up(heap.length - 1); } else if (vals[i] > heap[0][0]) { heap[0] = [vals[i], i]; down(0); } }
  return heap.map((h) => h[1]);
}

const LEADS = INDEX.leads.filter((d) => d >= 1 && d <= 16);
const samples = [];
process.stdout.write("dựng mẫu ");
for (const T of INDEX.origins) {
  const dayT = loadDay(T); if (!dayT) continue;
  const persist = new Map(dayT.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
  const dayScores = dayT.cells.map((c) => c.s);
  const bd = []; for (let k = 5; k >= 1; k--) bd.push(addDays(T, -k));
  const bM = winMean(SPD, bd);
  for (const d of LEADS) {
    const target = addDays(T, d); const dayY = loadDay(target); if (!dayY) continue;
    const m = dayY.month;
    const truth = new Map(dayY.cells.map((c) => [cellKey(c.lat, c.lon), c.s]));
    const scale = buildClimScaleMap(CLIM, m, dayScores);
    const keys = new Set([...persist.keys(), ...truth.keys()]);
    const buf = CLIM.months.get(m);
    if (buf) for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) { if (!buf[i * nLon + j]) continue; keys.add(cellKey(Math.round((cLat0 + i * dLat) * 100) / 100, Math.round((cLon0 + j * dLon) * 100) / 100)); }
    const n = keys.size;
    const P = new Float64Array(n), C = new Float64Array(n), Y = new Float64Array(n), lats = new Float64Array(n), lons = new Float64Array(n);
    let i = 0;
    for (const k of keys) { const [lat, lon] = k.split(",").map(Number); P[i] = persist.has(k) ? persist.get(k) : ABSENT_PERSIST; Y[i] = truth.has(k) ? truth.get(k) : ABSENT_PERSIST; C[i] = scale[Math.min(100, climRawAt(lat, lon, m))] ?? 0; lats[i] = lat; lons[i] = lon; i++; }
    const wd = []; for (let k = 5; k >= 1; k--) wd.push(addDays(target, -k));
    const mW = winMean(SPD, wd);
    const M = new Float64Array(n);
    for (let q = 0; q < n; q++) M[q] = bilinear(mW, lats[q], lons[q]) - bilinear(bM, lats[q], lons[q]);
    const w = 1 - climShare(d);
    const B = new Float64Array(n), Bp = new Float64Array(n);
    for (let q = 0; q < n; q++) { B[q] = w * P[q] + (1 - w) * C[q]; Bp[q] = P[q]; }
    samples.push({ origin: T, year: +T.slice(0, 4), month: m, lead: d, n, P: Bp, B, M: zscore(M), topTrue: new Set(topKIdx(Y, TOP_K)) });
  }
  process.stdout.write(".");
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const hitOf = (s, pred) => { let h = 0; for (const i of topKIdx(pred, TOP_K)) if (s.topTrue.has(i)) h++; return h; };
console.log(`\n${samples.length} mẫu\n`);

const GAMMA = []; for (let g = -4; g <= 4.0001; g += 0.25) GAMMA.push(r2(g));
function hits(ss, g, baseKey, srcOf) {
  return ss.map((s) => {
    const src = srcOf ? srcOf(s) : s;
    const base = s[baseKey], M = src.M, lim = Math.min(s.n, src.n);
    const p = new Float64Array(s.n);
    for (let q = 0; q < lim; q++) p[q] = base[q] + g * M[q];
    for (let q = lim; q < s.n; q++) p[q] = base[q];
    return hitOf(s, p);
  });
}
function clusteredSE(pairs) {
  const by = new Map();
  for (const [s, d] of pairs) { if (!by.has(s.origin)) by.set(s.origin, []); by.get(s.origin).push(d); }
  const om = [...by.values()].map(mean);
  const m = mean(om), v = om.reduce((a, x) => a + (x - m) ** 2, 0) / (om.length - 1);
  return { mean: m, se: Math.sqrt(v / om.length), byOrigin: [...by.entries()].map(([o, a]) => [o, r2(mean(a))]) };
}

const rows = [];
const detail = {};
for (const baseKey of ["P", "B"]) {
  for (const [lbl, ss] of [["tất cả", samples], ["d≥10", samples.filter((s) => s.lead >= 10)]]) {
    const base = ss.map((s) => hitOf(s, s[baseKey]));
    // trần trong-mẫu
    let best = null;
    for (const g of GAMMA) { if (!g) continue; const v = mean(hits(ss, g, baseKey)) - mean(base); if (!best || v > best.v) best = { g, v }; }
    // LOYO theo NĂM
    const years = [...new Set(ss.map((s) => s.year))].sort();
    const cv = new Map(); const picks = [];
    for (const y of years) {
      const tr = ss.filter((s) => s.year !== y), te = ss.filter((s) => s.year === y);
      const trBase = tr.map((s) => hitOf(s, s[baseKey]));
      let bg = null;
      for (const g of GAMMA) { if (!g) continue; const v = mean(hits(tr, g, baseKey)) - mean(trBase); if (!bg || v > bg.v) bg = { g, v }; }
      picks.push({ "bỏ năm": y, "γ*": bg.g, "lời huấn luyện": r2(bg.v) });
      const h = hits(te, bg.g, baseKey);
      te.forEach((s, i) => cv.set(s, h[i]));
    }
    const st = clusteredSE(ss.map((s, i) => [s, cv.get(s) - base[i]]));
    rows.push({
      "nền": baseKey === "P" ? "ảnh-thuần" : "pha-trộn", "tập": lbl, "n": ss.length,
      "baseline": r2(mean(base)),
      "trần trong-mẫu (γ*)": `+${r2(best.v)} (γ=${best.g})`,
      "KIỂM CHÉO LOYO": `${r2(st.mean)} ± ${r2(st.se)}`,
      "t": r2(st.mean / (st.se || 1e-9)),
    });
    detail[`${baseKey}|${lbl}`] = { picks, byOrigin: st.byOrigin, inSample: r2(best.v), gammaStar: best.g, cv: r2(st.mean), se: r2(st.se) };
  }
}
console.log("=== H3-NGHỊCH: pred = nền + γ·ẑ(Δ tốc độ gió) · ĐÚNG 1 THAM SỐ ===");
console.table(rows);
for (const [k, v] of Object.entries(detail)) console.log(`  ${k}: γ* mỗi fold ${v.picks.map((p) => p["γ*"]).join("/")} · lời từng mốc ${v.byOrigin.map(([o, g]) => `${o.slice(0, 7)}:${g}`).join(" ")}`);

/* hoán vị cho cấu hình tốt nhất theo KIỂM CHÉO */
const bestRow = rows.reduce((a, b) => (parseFloat(b["KIỂM CHÉO LOYO"]) > parseFloat(a["KIỂM CHÉO LOYO"]) ? b : a));
console.log(`\n=== HOÁN VỊ cho cấu hình CV tốt nhất: nền ${bestRow["nền"]} · ${bestRow["tập"]} ===`);
const bk = bestRow["nền"] === "ảnh-thuần" ? "P" : "B";
const bss = bestRow["tập"] === "tất cả" ? samples : samples.filter((s) => s.lead >= 10);
const bbase = bss.map((s) => hitOf(s, s[bk]));
const observed = parseFloat(bestRow["KIỂM CHÉO LOYO"]);
const B_PERM = 200;
let ge = 0; const nulls = [];
for (let b = 0; b < B_PERM; b++) {
  const byLead = new Map();
  bss.forEach((s) => { if (!byLead.has(s.lead)) byLead.set(s.lead, []); byLead.get(s.lead).push(s); });
  const map = new Map();
  for (const [, arr] of byLead) { const sh = [...arr]; for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; } arr.forEach((s, k) => map.set(s, sh[k])); }
  const srcOf = (s) => map.get(s);
  const years = [...new Set(bss.map((s) => s.year))].sort();
  const cv = new Map();
  for (const y of years) {
    const tr = bss.filter((s) => s.year !== y), te = bss.filter((s) => s.year === y);
    const trBase = tr.map((s) => hitOf(s, s[bk]));
    let bg = null;
    for (const g of GAMMA) { if (!g) continue; const v = mean(hits(tr, g, bk, srcOf)) - mean(trBase); if (!bg || v > bg.v) bg = { g, v }; }
    const h = hits(te, bg.g, bk, srcOf);
    te.forEach((s, i) => cv.set(s, h[i]));
  }
  const g = mean(bss.map((s, i) => cv.get(s) - bbase[i]));
  nulls.push(g); if (g >= observed) ge++;
  if ((b + 1) % 40 === 0) process.stdout.write(`${b + 1} `);
}
nulls.sort((a, b) => a - b);
const p = (ge + 1) / (B_PERM + 1);
console.log(`\n  quan sát ${r2(observed)} · null tb ${r2(mean(nulls))} · p95 ${r2(nulls[Math.floor(0.95 * nulls.length)])} · p = ${r2(p)}`);

writeFileSync(OUT, JSON.stringify({ rows, detail, permutation: { config: `${bestRow["nền"]}|${bestRow["tập"]}`, observed: r2(observed), nullMean: r2(mean(nulls)), p: r2(p) } }, null, 1));
console.log(`\n→ ${OUT}`);
