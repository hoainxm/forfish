#!/usr/bin/env node
// buoc0-chuyen.mjs — BƯỚC 0 của nghiên cứu "Dòng Dẫn" (docs/research/du-bao-ca-dong-dan-2026-10/README.md §3):
// dựng bảng CHUYẾN v3(a) từ dữ liệu DataLake đã kéo (dl-all) + cache đặc trưng vệ tinh (fc-full), rồi đo
//   (i)  % phương sai của đặc trưng (trung bình theo giờ đánh trên dấu vết) CÒN LẠI sau nghề×lớp dài + tháng×vùng (+ tàu)
//   (ii) ICC tàu trên phần dư năng suất
//   (iii) công suất: ρ nhỏ nhất phát hiện được với n hiệu dụng (chuyến / tàu / cụm tuần×vùng)
// CHỈ ĐỌC. Không sửa nhãn, không sửa mô hình, không ghi vào repo. Ra: <out>/buoc0.json + buoc0.md
//   (gpu-desktop) SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/buoc0-chuyen.mjs
//   (mặc định: --dir $SDFISH_DATA_DIR/dl-all --fc …/fc-full/features --ports <datalake>/snapshots/<mới nhất>/catalog-ports.json.gz --enc <datalake>/encounters/vessels.json --out …/dong-dan/buoc0)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { loadBands, makePortIndex, gearGroup, inPortIntervals, segmentsRaw, fishingVerdict } from "../fishing-def.mjs";
import { dataDir, datalakeRoot } from "../lib/data-dir.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
// mặc định đúng chỗ dữ liệu train trên PC GPU ($SDFISH_DATA_DIR) — chạy ở gpu-desktop, dữ liệu DataLake KHÔNG rời máy đó
const latestSnap = () => { const d = join(datalakeRoot(), "snapshots"); return existsSync(d) ? readdirSync(d).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1) : ""; };
const DIR = arg("dir", join(dataDir(), "dl-all")), FC = arg("fc", join(dataDir(), "fc-full", "features")), OUT = arg("out", join(dataDir(), "dong-dan", "buoc0"));
mkdirSync(OUT, { recursive: true });
const LIMIT = Number(arg("limit", 0)); // thử nhanh: chỉ N nhật ký đầu
const readJson = (f) => JSON.parse(f.endsWith(".gz") ? gunzipSync(readFileSync(f)).toString("utf8") : readFileSync(f, "utf8"));
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const vnDate = (t) => new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10);
const lenClass = (m) => (!Number.isFinite(m) ? "?" : m < 12 ? "<12" : m < 15 ? "12-15" : m < 24 ? "15-24" : ">=24");
/** pha trăng 0..1 (0 = trăng non, 0,5 = rằm) */
const moonPhase = (t) => { const d = t / 86400 + 2440587.5; const a = ((d - 2451550.1) / 29.530588853) % 1; return a < 0 ? a + 1 : a; };

// ── đặc trưng ô-ngày (Float32 [n × NF]) ──────────────────────────────────────
const man = readJson(join(FC, "manifest.json"));
const F = man.fields, NF = F.length, AX = man.axis;
const FI = Object.fromEntries(F.map((f, i) => [f, i]));
const WANT = ["t", "c", "fThermFront", "fChlFront", "fEddy", "coldStr", "warmStr", "upwTerm", "convTerm", "thermoAnomM"];
const cellKey = (lat, lon) => Math.round((lat - AX.lat0) / AX.step) * 1000 + Math.round((lon - AX.lon0) / AX.step);
const featDay = new Map(); // ngày → Map(cellKey → offset)
const featBuf = new Map();
function loadDay(day) {
  if (featDay.has(day)) return featDay.get(day);
  const f = join(FC, `f-${day}.f32`);
  if (!existsSync(f)) { featDay.set(day, null); return null; }
  const b = readFileSync(f);
  const a = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  const idx = new Map();
  for (let r = 0; r + NF <= a.length; r += NF) idx.set(cellKey(a[r + FI.lat], a[r + FI.lon]), r);
  featDay.set(day, idx); featBuf.set(day, a);
  return idx;
}

// ── dữ liệu DataLake ─────────────────────────────────────────────────────────
const table = loadBands();
const portsRaw = readJson(arg("ports", join(datalakeRoot(), "snapshots", latestSnap(), "catalog-ports.json.gz")));
const ports = makePortIndex(portsRaw.items ?? portsRaw);
const ctx = { table, ports };
const gm = existsSync(join(DIR, "gear-map.json")) ? readJson(join(DIR, "gear-map.json")) : null;
const inferred = new Map(Object.entries(gm?.vessels ?? {}));
const encF = arg("enc", join(datalakeRoot(), "encounters", "vessels.json"));
const carriers = new Set(encF && existsSync(encF) ? Object.entries(readJson(encF).vessels).filter(([, v]) => v.likelyCarrier).map(([id]) => id) : []);
const [lbFile] = readdirSync(DIR).filter((f) => f.startsWith("logbooks_"));
const trFile = lbFile.replace("logbooks_", "trips_");
log("đọc", lbFile, trFile);
const trips = new Map(readJson(join(DIR, trFile)).map((t) => [t.code, t]));
let logbooks = readJson(join(DIR, lbFile)).sort((a, b) => String(a.vessel?.id ?? "").localeCompare(String(b.vessel?.id ?? "")));
if (LIMIT) logbooks = logbooks.slice(0, LIMIT);
const vessels = new Map(readJson(join(DIR, "vessels.json")).map((v) => [v.id, v]));
let cache = [null, null];
const track = (id) => { if (cache[0] !== id) { const f = join(DIR, "track", `${id}.json`); cache = [id, existsSync(f) ? readJson(f) : null]; } return cache[1]; };
const landedOf = (lb) => ((lb.landedKg ?? 0) > 0 ? lb.species?.landed : lb.species?.catch) ?? [];
log("nhật ký", logbooks.length, "chuyến", trips.size, "tàu", vessels.size, "thu mua", carriers.size);

// ── bảng chuyến ──────────────────────────────────────────────────────────────
const cov = { logbooks: logbooks.length, noTrip: 0, noTime: 0, noVms: 0, fewPts: 0, carrier: 0, noFishing: 0, noKg: 0, noFeat: 0, used: 0 };
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
  let H = 0, tripH = 0, sumLat = 0, sumLon = 0, sumT = 0, hFeat = 0;
  const acc = new Float64Array(WANT.length), cnt = new Float64Array(WANT.length);
  const fishing = [];
  for (const s of segs) {
    tripH += s.dtH;
    if (fishingVerdict(s, group, ctx, ivs) !== "fish") continue;
    H += s.dtH; sumLat += s.lat * s.dtH; sumLon += s.lon * s.dtH; sumT += s.t * s.dtH;
    fishing.push(s);
    const idx = loadDay(vnDate(s.t));
    const off = idx?.get(cellKey(s.lat, s.lon));
    if (off === undefined) continue;
    const a = featBuf.get(vnDate(s.t));
    let any = false;
    WANT.forEach((f, k) => { const v = a[off + FI[f]]; if (Number.isFinite(v)) { acc[k] += v * s.dtH; cnt[k] += s.dtH; any = true; } });
    if (any) hFeat += s.dtH;
  }
  if (!(H > 0)) { cov.noFishing++; continue; }
  const cLat = sumLat / H, cLon = sumLon / H, tMid = sumT / H;
  // bán kính hồi chuyển (độ) của dấu vết đánh, trọng số giờ
  let rg = 0; for (const s of fishing) rg += ((s.lat - cLat) ** 2 + (s.lon - cLon) ** 2) * s.dtH; rg = Math.sqrt(rg / H);
  const feat = WANT.map((f, k) => (cnt[k] > 0 ? acc[k] / cnt[k] : NaN));
  if (!(hFeat > 0)) cov.noFeat++;
  for (const x of sp) spName.set(x.code, x.name);
  cov.used++;
  rows.push({
    vid, gear, group, cls: lenClass(ves?.lengthM ?? lb.vessel?.lengthM), kg, H, tripH, days: (arr - dep) / 86400,
    month: Number(vnDate(dep).slice(5, 7)), week: Math.floor(dep / (7 * 86400)), lat: cLat, lon: cLon, rg,
    reg: `${Math.floor(cLat * 2) / 2},${Math.floor(cLon * 2) / 2}`, moon: moonPhase(tMid), featShare: hFeat / H, feat,
    sp: Object.fromEntries(sp.map((x) => [x.code, x.kg])), electronic: lb.form === "ELECTRONIC", monitored: lb.landingMonitored === true,
  });
}
log("bảng chuyến", rows.length, JSON.stringify(cov));

// ── thống kê ─────────────────────────────────────────────────────────────────
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };
/** khử hiệu ứng cố định (nhiều nhân tố) bằng chiếu luân phiên; trả phần dư */
function feResid(y, factors, iters = 60) {
  const r = Float64Array.from(y);
  const maps = factors.map((f) => { const m = new Map(); f.forEach((k, i) => (m.get(k) ?? m.set(k, []).get(k)).push(i)); return [...m.values()]; });
  for (let it = 0; it < iters; it++) {
    let delta = 0;
    for (const groups of maps) for (const g of groups) { let s = 0; for (const i of g) s += r[i]; s /= g.length; for (const i of g) r[i] -= s; delta += Math.abs(s); }
    if (delta / y.length < 1e-10) break;
  }
  return r;
}
function ols(y, X) { // X: mảng cột; trả hệ số + phần dư (Gram nhỏ)
  const p = X.length, n = y.length, G = Array.from({ length: p }, () => new Float64Array(p)), b = new Float64Array(p);
  for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) { let s = 0; for (let k = 0; k < n; k++) s += X[i][k] * X[j][k]; G[i][j] = s; } let s = 0; for (let k = 0; k < n; k++) s += X[i][k] * y[k]; b[i] = s; }
  // Gauss
  const A = G.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; for (let r = 0; r < p; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c <= p; c++) A[r][c] -= f * A[i][c]; } }
  const beta = A.map((r, i) => (r[i] ? r[p] / r[i] : 0));
  const res = Float64Array.from(y, (v, k) => v - beta.reduce((s, bj, j) => s + bj * X[j][k], 0));
  return { beta, res };
}
const icc1 = (eps, groups) => { // ANOVA một chiều, không cân bằng
  const m = new Map(); groups.forEach((g, i) => (m.get(g) ?? m.set(g, []).get(g)).push(eps[i]));
  const k = m.size, N = eps.length, gm = mean([...eps]);
  let ssb = 0, ssw = 0, sq = 0;
  for (const v of m.values()) { const mu = mean(v); ssb += v.length * (mu - gm) ** 2; for (const x of v) ssw += (x - mu) ** 2; sq += v.length ** 2; }
  const msb = ssb / (k - 1), msw = ssw / (N - k), n0 = (N - sq / N) / (k - 1);
  return { icc: (msb - msw) / (msb + (n0 - 1) * msw), k, n0: +n0.toFixed(2) };
};
const kish = (sizes) => { const s = sizes.reduce((a, b) => a + b, 0), q = sizes.reduce((a, b) => a + b * b, 0); return (s * s) / q; };
const rhoMin = (nEff) => (nEff > 4 ? Math.tanh(2.8016 / Math.sqrt(nEff - 3)) : NaN); // α 0,05 hai phía, công suất 0,8
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };

function analyse(sel, label, yOf) {
  const R = sel.filter((r) => Number.isFinite(yOf(r)));
  if (R.length < 200) return { label, n: R.length, skip: "ít chuyến" };
  // tầng tháng×vùng có < 5 chuyến thì bỏ (không ước được)
  const strat = new Map(); for (const r of R) { const k = `${r.month}|${r.reg}`; strat.set(k, (strat.get(k) ?? 0) + 1); }
  const S = R.filter((r) => strat.get(`${r.month}|${r.reg}`) >= 5);
  const y = S.map(yOf), fGL = S.map((r) => `${r.gear}|${r.cls}`), fMR = S.map((r) => `${r.month}|${r.reg}`), fV = S.map((r) => r.vid);
  const lH = S.map((r) => Math.log(r.H)), lT = S.map((r) => Math.log(r.tripH)), moon = S.map((r) => Math.cos(2 * Math.PI * r.moon)), moon2 = S.map((r) => Math.sin(2 * Math.PI * r.moon));
  // mô hình A: nghề×lớp + tháng×vùng + log H + log tripH (không tàu) → ε_A ; mô hình B: thêm tàu cố định → ε_B
  const fit = (fac) => { const ry = feResid(y, fac); const X = [lH, lT, moon, moon2].map((x) => feResid(x, fac)); const { beta, res } = ols(ry, X); return { beta, res }; };
  const A = fit([fGL, fMR]), B = fit([fGL, fMR, fV]);
  const varY = variance(y);
  const icc = icc1(A.res, fV);
  // cụm tuần×vùng cho n hiệu dụng
  const cl = new Map(); S.forEach((r, i) => { const k = `${r.week}|${r.reg}`; (cl.get(k) ?? cl.set(k, []).get(k)).push(i); });
  const sizes = [...cl.values()].map((g) => g.length);
  const vs = new Map(); fV.forEach((v) => vs.set(v, (vs.get(v) ?? 0) + 1));
  const nEff = { trips: S.length, vessels: vs.size, clustersWeekRegion: cl.size, kishClusters: +kish(sizes).toFixed(0), kishVessels: +kish([...vs.values()]).toFixed(0) };
  // (i) phương sai đặc trưng còn lại
  const feats = {};
  WANT.forEach((f, k) => {
    const ok = S.map((r, i) => (Number.isFinite(r.feat[k]) ? i : -1)).filter((i) => i >= 0);
    if (ok.length < 200) { feats[f] = { n: ok.length, skip: true }; return; }
    const x = ok.map((i) => S[i].feat[k]);
    const sub = (fac) => feResid(x, fac.map((ff) => ok.map((i) => ff[i])));
    const v0 = variance(x), vA = variance([...sub([fGL, fMR])]), vB = variance([...sub([fGL, fMR, fV])]);
    // thăm dò: tương quan phần dư (trong tàu) — KHÔNG phải cổng, chỉ để biết dấu và độ lớn; CI bootstrap cụm tuần×vùng
    const xB = sub([fGL, fMR, fV]), eB = ok.map((i) => B.res[i]);
    const rho = pearson([...xB], eB);
    const clk = ok.map((i) => `${S[i].week}|${S[i].reg}`);
    const cm = new Map(); clk.forEach((k, j) => (cm.get(k) ?? cm.set(k, []).get(k)).push(j));
    const cg = [...cm.values()]; const boots = [];
    // mulberry32 (32-bit, không tràn 2^53 như LCG) — bootstrap cụm tuần×vùng, B = 300
    let seed = 0x9e3779b9; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
    for (let b = 0; b < 300; b++) { const xa = [], ya = []; for (let c = 0; c < cg.length; c++) { const g = cg[Math.floor(rnd() * cg.length)]; for (const j of g) { xa.push(xB[j]); ya.push(eB[j]); } } boots.push(pearson(xa, ya)); }
    boots.sort((a, b) => a - b);
    feats[f] = { n: ok.length, sd: +Math.sqrt(v0).toFixed(4), remainAfterGearMonthRegion: +(vA / v0).toFixed(3), remainAfterVessel: +(vB / v0).toFixed(3), rhoWithinVessel: +rho.toFixed(4), ci90: [+boots[15].toFixed(4), +boots[284].toFixed(4)] };
  });
  return {
    label, n: S.length, dropped: R.length - S.length, strata: { gearLen: new Set(fGL).size, monthRegion: new Set(fMR).size, vessels: vs.size },
    y: { sd: +Math.sqrt(varY).toFixed(3), residSdA: +Math.sqrt(variance([...A.res])).toFixed(3), residSdB: +Math.sqrt(variance([...B.res])).toFixed(3), r2A: +(1 - variance([...A.res]) / varY).toFixed(3), r2B: +(1 - variance([...B.res]) / varY).toFixed(3) },
    betaA: { logH: +A.beta[0].toFixed(3), logTripH: +A.beta[1].toFixed(3), moonCos: +A.beta[2].toFixed(3), moonSin: +A.beta[3].toFixed(3) },
    iccVessel: { ...icc, icc: +icc.icc.toFixed(3) }, nEff, rhoMin: Object.fromEntries(Object.entries(nEff).map(([k, v]) => [k, +rhoMin(v).toFixed(4)])),
    feats,
  };
}

const all = rows;
const half = (r) => (r.month <= 5 ? "H1" : "H2");
const out = { builtAt: new Date().toISOString(), cov, nTrips: all.length, source: { dir: DIR, fc: FC, lbFile, featureDays: man.days ? Object.keys(man.days).length : null } };
out.tripShape = {
  daysMedian: +[...all.map((r) => r.days)].sort((a, b) => a - b)[all.length >> 1].toFixed(1),
  fishingHMedian: +[...all.map((r) => r.H)].sort((a, b) => a - b)[all.length >> 1].toFixed(1),
  featShareMean: +mean(all.map((r) => r.featShare)).toFixed(3),
  compact: (() => { const c = all.filter((r) => r.H <= 72 && r.rg <= 0.25); return { trips: c.length, tripShare: +(c.length / all.length).toFixed(3), kgShare: +(c.reduce((a, r) => a + r.kg, 0) / all.reduce((a, r) => a + r.kg, 0)).toFixed(3) }; })(),
  byGroup: Object.fromEntries(["vay", "cau", "re", "keo", "chup", "khac"].map((g) => [g, all.filter((r) => r.group === g).length])),
  byMonth: Object.fromEntries(Array.from({ length: 12 }, (_, m) => [m + 1, all.filter((r) => r.month === m + 1).length])),
  byLen: Object.fromEntries(["<12", "12-15", "15-24", ">=24", "?"].map((c) => [c, all.filter((r) => r.cls === c).length])),
};
const spTot = new Map(); for (const r of all) for (const [c, k] of Object.entries(r.sp)) spTot.set(c, (spTot.get(c) ?? 0) + k);
out.topSpecies = [...spTot].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([c, k]) => ({ code: c, name: spName.get(c), kg: Math.round(k), trips: all.filter((r) => r.sp[c] > 0).length }));
const logKg = (r) => Math.log(r.kg), logCpue = (r) => Math.log(r.kg / r.H);
out.analyses = [
  analyse(all, "tổng kg, log kg (cả năm)", logKg),
  analyse(all, "tổng kg, log(kg/giờ đánh) (cả năm)", logCpue),
  analyse(all.filter((r) => half(r) === "H1"), "log kg, nửa đầu (T1–5)", logKg),
  analyse(all.filter((r) => half(r) === "H2"), "log kg, nửa sau (T6–10)", logKg),
];
// theo nhóm loài: tìm mã theo tên
const findCodes = (re) => [...spName].filter(([, nm]) => re.test(nm ?? "")).map(([c]) => c);
const groups = { "mực xà": /mực xà/i, "cá nục": /cá nục/i, "cá cơm": /cá cơm/i, "cá ngừ vằn": /ngừ vằn/i, "cá ngừ (mọi loại)": /cá ngừ/i };
out.speciesCodes = Object.fromEntries(Object.entries(groups).map(([g, re]) => [g, findCodes(re)]));
for (const [g, re] of Object.entries(groups)) {
  const codes = findCodes(re);
  const kgG = (r) => codes.reduce((a, c) => a + (r.sp[c] ?? 0), 0);
  const sel = all.filter((r) => kgG(r) > 0);
  out.analyses.push(analyse(sel, `${g}: log kg loài (chuyến có loài)`, (r) => Math.log(kgG(r))));
}
writeFileSync(join(OUT, "buoc0.json"), JSON.stringify(out, null, 1));
// markdown gọn
const md = [];
md.push(`# Bước 0 — bảng chuyến v3(a): phương sai còn lại, ICC tàu, công suất\n\nSinh ${out.builtAt}. Chuyến dùng: ${all.length}. Độ phủ: ${JSON.stringify(cov)}\n`);
md.push(`Hình dạng chuyến: ${JSON.stringify(out.tripShape)}\n`);
md.push(`Loài top: ${out.topSpecies.map((s) => `${s.code} ${s.name} ${s.kg} kg/${s.trips} chuyến`).join(" · ")}\n`);
for (const a of out.analyses) {
  if (a.skip) { md.push(`## ${a.label}: bỏ (${a.skip}, n=${a.n})\n`); continue; }
  md.push(`## ${a.label}\n\nn=${a.n} (bỏ ${a.dropped} ở tầng <5 chuyến) · tầng: ${JSON.stringify(a.strata)} · y: ${JSON.stringify(a.y)} · β_A: ${JSON.stringify(a.betaA)}\n\nICC tàu (trên ε_A): **${a.iccVessel.icc}** (k=${a.iccVessel.k}, n0=${a.iccVessel.n0}) · n hiệu dụng: ${JSON.stringify(a.nEff)} · ρ_min (α 0,05, power 0,8): ${JSON.stringify(a.rhoMin)}\n`);
  md.push(`| đặc trưng | n | sd | còn lại sau nghề×lớp+tháng×vùng | còn lại sau +tàu | ρ trong tàu (thăm dò) | CI 90 % cụm |\n|---|---|---|---|---|---|---|`);
  for (const [f, v] of Object.entries(a.feats)) md.push(v.skip ? `| ${f} | ${v.n} | — | — | — | — | — |` : `| ${f} | ${v.n} | ${v.sd} | ${(v.remainAfterGearMonthRegion * 100).toFixed(1)} % | ${(v.remainAfterVessel * 100).toFixed(1)} % | ${v.rhoWithinVessel} | [${v.ci90[0]}, ${v.ci90[1]}] |`);
  md.push("");
}
writeFileSync(join(OUT, "buoc0.md"), md.join("\n"));
log("xong →", join(OUT, "buoc0.md"));
