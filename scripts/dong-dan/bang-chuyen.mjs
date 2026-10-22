// bang-chuyen.mjs — MỘT định nghĩa bảng CHUYẾN v3(a) cho mọi bước "Dòng Dẫn" đọc nhãn DataLake (buoc0-chuyen.mjs,
// buoc-b-moi-ca.mjs): ghép nhật ký ↔ chuyến ↔ track VMS, lọc (không chuyến / thiếu giờ / không VMS / ít điểm / tàu thu
// mua / kg = 0), giờ đánh theo scripts/fishing-def.mjs. Mỗi bước gắn "móc" riêng chạy trên từng đoạn giờ đánh.
// CHỈ ĐỌC dữ liệu ở $SDFISH_DATA_DIR (PC GPU) — dữ liệu DataLake KHÔNG rời máy đó. Kèm vài hàm thống kê dùng chung.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { loadBands, makePortIndex, gearGroup, inPortIntervals, segmentsRaw, fishingVerdict } from "../fishing-def.mjs";
import { dataDir, datalakeRoot } from "../lib/data-dir.mjs";

export const readJson = (f) => JSON.parse(f.endsWith(".gz") ? gunzipSync(readFileSync(f)).toString("utf8") : readFileSync(f, "utf8"));
export const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
export const vnDate = (t) => new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10);
export const lenClass = (m) => (!Number.isFinite(m) ? "?" : m < 12 ? "<12" : m < 15 ? "12-15" : m < 24 ? "15-24" : ">=24");
/** pha trăng 0..1 (0 = trăng non, 0,5 = rằm) */
export const moonPhase = (t) => { const d = t / 86400 + 2440587.5; const a = ((d - 2451550.1) / 29.530588853) % 1; return a < 0 ? a + 1 : a; };
const latestSnap = () => { const d = join(datalakeRoot(), "snapshots"); return existsSync(d) ? readdirSync(d).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1) : ""; };
export const defaultPaths = () => ({
  dir: join(dataDir(), "dl-all"),
  ports: join(datalakeRoot(), "snapshots", latestSnap(), "catalog-ports.json.gz"),
  enc: join(datalakeRoot(), "encounters", "vessels.json"),
});

/**
 * Dựng bảng chuyến. `hook()` được gọi MỖI chuyến đã qua lọc, trả { seg(s), done(base, cov) → trường thêm }:
 *   seg(s) chạy trên từng đoạn giờ đánh (s = {t, lat, lon, dtH, kn}); done nhận dòng gốc + bộ đếm, trả trường thêm.
 * `covExtra`: tên bộ đếm riêng của bước (chèn trước "used", giữ đúng thứ tự in như bản cũ).
 */
export function buildTrips({ dir, ports: portsFile, enc: encFile, limit = 0, covExtra = [] }, hook) {
  const table = loadBands();
  const portsRaw = readJson(portsFile);
  const ctx = { table, ports: makePortIndex(portsRaw.items ?? portsRaw) };
  const gm = existsSync(join(dir, "gear-map.json")) ? readJson(join(dir, "gear-map.json")) : null;
  const inferred = new Map(Object.entries(gm?.vessels ?? {}));
  const carriers = new Set(encFile && existsSync(encFile) ? Object.entries(readJson(encFile).vessels).filter(([, v]) => v.likelyCarrier).map(([id]) => id) : []);
  const [lbFile] = readdirSync(dir).filter((f) => f.startsWith("logbooks_"));
  const trFile = lbFile.replace("logbooks_", "trips_");
  log("đọc", lbFile, trFile);
  const trips = new Map(readJson(join(dir, trFile)).map((t) => [t.code, t]));
  let logbooks = readJson(join(dir, lbFile)).sort((a, b) => String(a.vessel?.id ?? "").localeCompare(String(b.vessel?.id ?? "")));
  if (limit) logbooks = logbooks.slice(0, limit);
  const vessels = new Map(readJson(join(dir, "vessels.json")).map((v) => [v.id, v]));
  let cache = [null, null];
  const track = (id) => { if (cache[0] !== id) { const f = join(dir, "track", `${id}.json`); cache = [id, existsSync(f) ? readJson(f) : null]; } return cache[1]; };
  const landedOf = (lb) => ((lb.landedKg ?? 0) > 0 ? lb.species?.landed : lb.species?.catch) ?? [];
  log("nhật ký", logbooks.length, "chuyến", trips.size, "tàu", vessels.size, "thu mua", carriers.size);

  const cov = { logbooks: logbooks.length, noTrip: 0, noTime: 0, noVms: 0, fewPts: 0, carrier: 0, noFishing: 0, noKg: 0, ...Object.fromEntries(covExtra.map((k) => [k, 0])), used: 0 };
  const spName = new Map();
  const rows = [];
  let n = 0;
  for (const lb of logbooks) {
    if (++n % 20000 === 0) log("…", n, "dùng", rows.length);
    const vid = lb.vessel?.id, ves = vessels.get(vid);
    const tr = trips.get(lb.trip?.code);
    if (!tr) { cov.noTrip++; continue; }
    const dep = Date.parse(tr.vms?.dep ?? tr.dep ?? "") / 1000, arr = Date.parse(tr.vms?.arr ?? tr.arr ?? "") / 1000;
    if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep || arr - dep > 60 * 86400) { cov.noTime++; continue; }
    const tk = vid ? track(vid) : null;
    if (!tk?.hasVms) { cov.noVms++; continue; }
    const pts = tk.p.filter(([t]) => t >= dep && t <= arr);
    if (pts.length < 4 || (arr - dep) / 3600 / pts.length > 3) { cov.fewPts++; continue; }
    if (carriers.has(vid)) { cov.carrier++; continue; }
    const sp = landedOf(lb).filter((x) => x.kg > 0);
    const kg = sp.reduce((a, x) => a + x.kg, 0);
    if (!(kg > 0)) { cov.noKg++; continue; }
    const reg = ves?.gear && ves.gear !== "?" ? ves.gear : null;
    const gear = reg ?? inferred.get(vid)?.gear ?? "?";
    const group = gearGroup(gear);
    const ivs = inPortIntervals(tk.c, dep, arr);
    const segs = segmentsRaw(pts);
    const h = hook();
    let H = 0, tripH = 0, sumLat = 0, sumLon = 0, sumT = 0;
    const fishing = [];
    for (const s of segs) {
      tripH += s.dtH;
      if (fishingVerdict(s, group, ctx, ivs) !== "fish") continue;
      H += s.dtH; sumLat += s.lat * s.dtH; sumLon += s.lon * s.dtH; sumT += s.t * s.dtH;
      fishing.push(s);
      h.seg(s);
    }
    if (!(H > 0)) { cov.noFishing++; continue; }
    const cLat = sumLat / H, cLon = sumLon / H, tMid = sumT / H;
    // bán kính hồi chuyển (độ) của dấu vết đánh, trọng số giờ
    let rg = 0; for (const s of fishing) rg += ((s.lat - cLat) ** 2 + (s.lon - cLon) ** 2) * s.dtH; rg = Math.sqrt(rg / H);
    const base = {
      vid, gear, group, cls: lenClass(ves?.lengthM ?? lb.vessel?.lengthM), kg, H, tripH, days: (arr - dep) / 86400,
      month: Number(vnDate(dep).slice(5, 7)), week: Math.floor(dep / (7 * 86400)), lat: cLat, lon: cLon, rg,
      reg: `${Math.floor(cLat * 2) / 2},${Math.floor(cLon * 2) / 2}`, moon: moonPhase(tMid), tMid,
      sp: Object.fromEntries(sp.map((x) => [x.code, x.kg])), electronic: lb.form === "ELECTRONIC", monitored: lb.landingMonitored === true,
    };
    const extra = h.done(base, cov);
    if (extra === null) continue;
    for (const x of sp) spName.set(x.code, x.name);
    cov.used++;
    rows.push({ ...base, ...extra });
  }
  log("bảng chuyến", rows.length, JSON.stringify(cov));
  return { rows, cov, spName, lbFile };
}

// ── thống kê dùng chung ──────────────────────────────────────────────────────
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };
/** khử hiệu ứng cố định (nhiều nhân tố) bằng chiếu luân phiên; trả phần dư */
export function feResid(y, factors, iters = 60) {
  const r = Float64Array.from(y);
  const maps = factors.map((f) => { const m = new Map(); f.forEach((k, i) => (m.get(k) ?? m.set(k, []).get(k)).push(i)); return [...m.values()]; });
  for (let it = 0; it < iters; it++) {
    let delta = 0;
    for (const groups of maps) for (const g of groups) { let s = 0; for (const i of g) s += r[i]; s /= g.length; for (const i of g) r[i] -= s; delta += Math.abs(s); }
    if (delta / y.length < 1e-10) break;
  }
  return r;
}
/** X: mảng cột; trả hệ số + phần dư (Gram nhỏ) */
export function ols(y, X) {
  const p = X.length, n = y.length, G = Array.from({ length: p }, () => new Float64Array(p)), b = new Float64Array(p);
  for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k < n; k++) s += X[i][k] * X[j][k]; G[i][j] = s; } let s = 0; for (let k = 0; k < n; k++) s += X[i][k] * y[k]; b[i] = s; }
  const A = G.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; for (let r = 0; r < p; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c <= p; c++) A[r][c] -= f * A[i][c]; } }
  const beta = A.map((r, i) => (r[i] ? r[p] / r[i] : 0));
  const res = Float64Array.from(y, (v, k) => v - beta.reduce((s, bj, j) => s + bj * X[j][k], 0));
  return { beta, res };
}
/** ANOVA một chiều, không cân bằng */
export const icc1 = (eps, groups) => {
  const m = new Map(); groups.forEach((g, i) => (m.get(g) ?? m.set(g, []).get(g)).push(eps[i]));
  const k = m.size, N = eps.length, gm = mean([...eps]);
  let ssb = 0, ssw = 0, sq = 0;
  for (const v of m.values()) { const mu = mean(v); ssb += v.length * (mu - gm) ** 2; for (const x of v) ssw += (x - mu) ** 2; sq += v.length ** 2; }
  const msb = ssb / (k - 1), msw = ssw / (N - k), n0 = (N - sq / N) / (k - 1);
  return { icc: (msb - msw) / (msb + (n0 - 1) * msw), k, n0: +n0.toFixed(2) };
};
export const kish = (sizes) => { const s = sizes.reduce((a, b) => a + b, 0), q = sizes.reduce((a, b) => a + b * b, 0); return (s * s) / q; };
/** ρ nhỏ nhất phát hiện được, α 0,05 hai phía, công suất 0,8 */
export const rhoMin = (nEff) => (nEff > 4 ? Math.tanh(2.8016 / Math.sqrt(nEff - 3)) : NaN);
export const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
