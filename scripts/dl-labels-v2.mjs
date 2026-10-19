#!/usr/bin/env node
// scripts/dl-labels-v2.mjs — NHÃN v2 (dl-build-labels.mjs --v2). Rà pipeline 2026-10-18, mảnh 2C
// (docs/app-map/ops/fish-train-review-2026-10-18/README.md §7.1, report-data-labels.md Q1–Q5, Q8).
// ─────────────────────────────────────────────────────────────────────────────
// Khác nhãn cũ (dl-build-labels.mjs không cờ — GIỮ NGUYÊN BYTE vì 2A/2B đang đo trên nó):
//  1. "Giờ đánh" theo scripts/fishing-def.mjs: MỘT bảng dải theo nghề cả năm (fishing-bands.v2.json), vmin = 0 chỉ
//     vây ban đêm, loại giờ trong 10 km BẤT KỲ cảng nào + giữa IN/OUT thật (tk.c). Cùng định nghĩa với lưới đội tàu v2.
//  2. Nghề tàu NULL suy bằng Naive Bayes (scripts/gear-infer.mjs, gear-map.json): cột `gs` = registry | inferred;
//     cap p99 tính theo nghề đã suy.
//  3. Tàu thu mua (encounters/vessels.json likelyCarrier): kg KHÔNG phân vào giờ của chính nó → nhóm "không có vị trí"
//     (report.noPosition). Cặp kéo đôi (PAIRED một-đối-một, pairs.json): gộp kg hai tàu, chia theo giờ trong dải của CẢ HAI.
//  4. Bỏ ×0,5/×0,3/×0,7; thay bằng trọng số Huber trên log(kg) ~ log(giờ trong dải) + log(giờ chuyến) theo
//     nghề × lớp dài. `--ablate` ghi THÊM catch-legacy.csv (hệ số cũ) và catch-none.csv (hệ số = 1) cho phép đo ablation.
//  5. Cột `vh` luôn bật. report.json: kgUsed/kgTotal theo lớp dài, snapshot, sha script, bảng dải + CI, cổng nhãn
//     (giờ/chuyến, % giờ Rê ≤ 6 km cảng, kg "?", ρ và tỉ lệ đợt/mẻ theo nghề, riêng tàu NULL).
// Ra: effort.csv (date,lat,lon,geartype,vh,gs,hours) · catch.csv (date,lat,lon,species,gear,vh,gs,kg) ·
//     catch-vessels-025.csv (month,lat,lon,species,vh,vessels) · report.json
//   node scripts/dl-labels-v2.mjs --selftest   ·   node scripts/dl-labels-v2.mjs --pairs-prep --events events.ndjson --out pairs.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, createReadStream } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { vesselBucket } from "./vessel-bucket.mjs";
import { gearGroup, GEARS, GROUP_NAME, makePortIndex, nearAnyPort, inPortIntervals, inIntervals, segmentsRaw, fishingVerdict, loadBands, BANDS_FILE, loadVnRing, pointInRing, hav } from "./fishing-def.mjs";

export const CELL = 0.05;
export const HUBER_K = 1.345;
export const MIN_STRATUM = 30;
const VN_OFFSET_S = 7 * 3600;
const csv = (x) => String(x).replace(/[,\n]/g, ";");
const snap = (v) => (Math.floor(v / CELL) * CELL + CELL / 2).toFixed(3);
const vnDate = (t) => new Date((t + VN_OFFSET_S) * 1000).toISOString().slice(0, 10);
const axis025 = (v) => (Math.round((v - 0.025) / 0.25) * 0.25 + 0.025).toFixed(3);
export const lenClass = (m) => (!Number.isFinite(m) ? "?" : m < 12 ? "<12" : m < 15 ? "12-15" : m < 24 ? "15-24" : ">=24");
export const median = (a) => { if (!a.length) return NaN; const v = [...a].sort((x, y) => x - y), h = v.length >> 1; return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2; };
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 12);

// ── Huber trên log(kg) ~ 1 + log(giờ trong dải) + log(giờ chuyến) ────────────────────────────────
function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    const d = M[i][i] || 1e-12;
    for (let c = i; c < 4; c++) M[i][c] /= d;
    for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i]; for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]; }
  }
  return [M[0][3], M[1][3], M[2][3]];
}
/** rows = [{x1,x2,y}] → {beta, sigma, w:Float64Array} (w ∈ [0,05; 1]; chuyến lệch xa hồi quy bị hạ). */
export function huberFit(rows, { k = HUBER_K, iters = 15 } = {}) {
  const n = rows.length;
  let w = new Float64Array(n).fill(1), beta = [0, 0, 0], sigma = 1;
  for (let it = 0; it < iters; it++) {
    const A = [[1e-9, 0, 0], [0, 1e-9, 0], [0, 0, 1e-9]], b = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const x = [1, rows[i].x1, rows[i].x2];
      for (let r = 0; r < 3; r++) { b[r] += w[i] * x[r] * rows[i].y; for (let c = 0; c < 3; c++) A[r][c] += w[i] * x[r] * x[c]; }
    }
    beta = solve3(A, b);
    const res = rows.map((r) => r.y - (beta[0] + beta[1] * r.x1 + beta[2] * r.x2));
    sigma = Math.max(1.4826 * median(res.map(Math.abs)), 1e-6);
    w = Float64Array.from(res, (e) => (Math.abs(e) <= k * sigma ? 1 : Math.max(0.05, (k * sigma) / Math.abs(e))));
  }
  return { beta, sigma, w };
}

// ── cặp kéo đôi ──────────────────────────────────────────────────────────────
/** counts: Map a → Map b → số sự kiện PAIRED. Cặp một-đối-một = b là đối tác chính (≥ 80 %) của a VÀ ngược lại, ≥ minEv sự kiện. */
export function choosePairs(counts, { minEv = 20, share = 0.8 } = {}) {
  const top = new Map();
  for (const [a, m] of counts) {
    let tot = 0, bb = null, bn = 0;
    for (const [b, n] of m) { tot += n; if (n > bn) { bn = n; bb = b; } }
    if (bb && bn >= minEv && bn / tot >= share) top.set(a, bb);
  }
  const out = {};
  for (const [a, b] of top) if (top.get(b) === a) out[a] = b;
  return out;
}
export async function pairsFromEvents(file) {
  const counts = new Map();
  const bump = (a, b) => { const m = counts.get(a) ?? counts.set(a, new Map()).get(a); m.set(b, (m.get(b) ?? 0) + 1); };
  for await (const l of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (!l.includes('"kind":"PAIRED"')) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.a && e.b && e.a !== e.b) { bump(e.a, e.b); bump(e.b, e.a); }
  }
  return choosePairs(counts);
}
/** Nối mỗi chuyến với chuyến của tàu đối tác chồng giờ ≥ 50 % chuyến ngắn hơn. Gán r.mate (đối xứng, một-một). */
export function linkMates(rows, pairs) {
  const byV = new Map();
  for (const r of rows) (byV.get(r.vid) ?? byV.set(r.vid, []).get(r.vid)).push(r);
  let n = 0;
  for (const r of rows) {
    const p = pairs[r.vid];
    if (!p || r.mate || r.carrier) continue;
    let best = null, bo = 0;
    for (const c of byV.get(p) ?? []) {
      if (c.mate || c.carrier) continue;
      const ov = Math.min(r.arr, c.arr) - Math.max(r.dep, c.dep);
      if (ov > bo && ov >= 0.5 * Math.min(r.arr - r.dep, c.arr - c.dep)) { bo = ov; best = c; }
    }
    if (best) { r.mate = best; best.mate = r; n++; }
  }
  return n;
}

// ── ĐIỂM TIN CẬY theo chuyến từ tín hiệu ĐỘC LẬP với lời khai (luật README §7.2b: khai sai CÓ CHỦ ĐÍCH) ─────────
/** (a) giấu vị trí: loại khỏi nhãn vị trí · (b) giấu loài: kg chỉ vào tổng nghề · (c)(d) hạ trọng số theo mức lệch. */
export const POSITION_SIGNALS = ["a1_gap", "a2_flag", "a3_eez"];
export const SOFT_SIGNALS = ["c2_repeat", "c3_round", "c4_mismatch", "c5_carrier", "d1_port", "d2_time"];
/** Tín hiệu mềm ĐANG BẬT mặc định sau ablation (2026-10-18, README §7.6b): c5/d2 chỉ GHI cờ, không hạ trọng số. */
export const DEFAULT_SOFT = ["c2_repeat", "c3_round", "c4_mismatch", "d1_port"];
export const TAP_CODES = new Set(["CTA", "CXO", "CDT"]); // Cá Tạp · Cá Xô · Loài Khác
export const GAP_HIDE_H = 12, EEZ_OUT_H = 6, PORT_FAR_KM = 50, ARR_DEV_H = 12;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Hệ số của MỘT tín hiệu mềm (1 = sạch). sig: {rep, round, ratio, carrier, portKm, arrDevH} */
export function softFactor(name, sig) {
  switch (name) {
    case "c2_repeat": return sig.rep > 0 ? clamp(1 / (1 + 0.5 * sig.rep), 0.3, 1) : 1;
    case "c3_round": return sig.round ? 0.8 : 1;
    case "c4_mismatch": return sig.ratio > 2 ? clamp(2 / sig.ratio, 0.3, 1) : 1;
    case "c5_carrier": return sig.carrier ? 0.7 : 1;
    case "d1_port": return sig.portKm > PORT_FAR_KM ? clamp(PORT_FAR_KM / sig.portKm, 0.3, 1) : 1;
    case "d2_time": return sig.arrDevH > ARR_DEV_H ? clamp(ARR_DEV_H / sig.arrDevH, 0.3, 1) : 1;
    default: return 1;
  }
}
export const trustScore = (sig, active) => active.reduce((w, n) => w * softFactor(n, sig), 1);
export const tapShareOf = (sp) => { let t = 0, a = 0; for (const x of sp ?? []) if (x.kg > 0) { a += x.kg; if (TAP_CODES.has(x.code)) t += x.kg; } return a > 0 ? t / a : null; };
export const isRoundSingle = (sp) => { const v = (sp ?? []).filter((x) => x.kg > 0); return v.length === 1 && v[0].kg >= 500 && v[0].kg % 100 === 0; };
const quantile = (a, q) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))] : NaN; };
const hash10 = (x) => createHash("sha256").update(String(x)).digest("hex").slice(0, 10);

// ── trọng số tin cậy CŨ (chỉ để ablation) ──────────────────────────────────────────────────────
const catchPrint = (sp) => (sp ?? []).filter((x) => x.kg > 0).map((x) => `${x.code}:${Math.round(x.kg)}`).sort().join("|");
function legacyTrust(lb, isTemplate) {
  let w = 1;
  if (!(lb.landingMonitored === true && (lb.landedKg ?? 0) > 0)) w *= 0.5;
  if (isTemplate) w *= 0.3;
  const c = lb.catchKg ?? 0, l = lb.landedKg ?? 0;
  if (c > 0 && l > 0 && (l / c > 2 || l / c < 0.5)) w *= 0.7;
  return w;
}

const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length); for (let i = 0; i < idx.length; ) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
export function spearman(x, y) {
  if (x.length < 3) return NaN;
  const rx = rank(x), ry = rank(y), n = x.length, mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const readJson = (f) => { const b = readFileSync(f); return JSON.parse((f.endsWith(".gz") ? gunzipSync(b) : b).toString("utf8")); };

/**
 * Dựng nhãn v2. o = {DIR, FROM, TO, WINDOW:[a,b]|[], OUT?, ports, bands?, gearMap?, encounters?, pairs?, ablate, argv}
 */
export async function buildLabelsV2(o) {
  const t0 = Date.now();
  const DIR = o.DIR, WINDOW = o.WINDOW ?? [];
  const OUT = o.OUT ?? join(DIR, `labels-v2${WINDOW.length ? `-${WINDOW[0]}` : ""}`);
  mkdirSync(OUT, { recursive: true });
  const bandsFile = o.bands ?? BANDS_FILE;
  const table = loadBands(bandsFile);
  const portsRaw = readJson(o.ports);
  const ports = makePortIndex(portsRaw.items ?? portsRaw);
  const ctx = { table, ports };
  const gm = o.gearMap && existsSync(o.gearMap) ? JSON.parse(readFileSync(o.gearMap, "utf8")) : null;
  const inferred = new Map(Object.entries(gm?.vessels ?? {}));
  const encF = o.encounters ?? null;
  const carriers = new Set(encF && existsSync(encF) ? Object.entries(readJson(encF).vessels).filter(([, v]) => v.likelyCarrier).map(([id]) => id) : []);
  const encAll = encF && existsSync(encF) ? readJson(encF).vessels : {};
  const portByCode = new Map((portsRaw.items ?? portsRaw).map((p) => [p.code, p]));
  const ring = loadVnRing();
  const ACTIVE = o.signals ?? DEFAULT_SOFT;
  const pairsRaw = o.pairs && existsSync(o.pairs) ? JSON.parse(readFileSync(o.pairs, "utf8")) : {};
  const pairsMap = pairsRaw.pairs ?? pairsRaw;
  const trips = new Map(readJson(join(DIR, `trips_${o.FROM}_${o.TO}.json`)).map((t) => [t.code, t]));
  const depDay = (lb) => { const t = trips.get(lb.trip?.code); const d = Date.parse(t?.vms?.dep ?? t?.dep ?? ""); return Number.isFinite(d) ? vnDate(d / 1000) : null; };
  const logbooks = readJson(join(DIR, `logbooks_${o.FROM}_${o.TO}.json`))
    .filter((lb) => !WINDOW.length || ((d) => d && d >= WINDOW[0] && d <= WINDOW[1])(depDay(lb)))
    .sort((a, b) => String(a.vessel?.id ?? "").localeCompare(String(b.vessel?.id ?? "")));
  const vessels = new Map(readJson(join(DIR, "vessels.json")).map((v) => [v.id, v]));
  let cache = [null, null];
  const track = (id) => { if (cache[0] !== id) { const f = join(DIR, "track", `${id}.json`); cache = [id, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null]; } return cache[1]; };
  const landedOf = (lb) => ((lb.landedKg ?? 0) > 0 ? lb.species?.landed : lb.species?.catch) ?? [];
  const kgOf = (lb) => landedOf(lb).reduce((a, x) => a + (x.kg > 0 ? x.kg : 0), 0);

  // ── ghép nhật ký ↔ chuyến ↔ track ─────────────────────────────────────────
  const cov = { logbooks: logbooks.length, noTrip: 0, noTime: 0, noVms: 0, fewPts: 0, used: 0, carrier: 0, declaredButNoFishing: 0 };
  const kgTotal = {}, kgUsed = {}, kgLost = {};
  const add = (m, k, v) => { m[k] = (m[k] ?? 0) + v; };
  const lostBy = (why, cls, kg) => { (kgLost[why] ??= {}); add(kgLost[why], cls, kg); };
  const rows = [];
  const seenPrint = new Map();
  const verdictH = {}; // nhóm → {fish,band,gap,inport,port} (giờ)
  for (const lb of logbooks) {
    const vid = lb.vessel?.id, ves = vessels.get(vid);
    const len = ves?.lengthM ?? lb.vessel?.lengthM, cls = lenClass(len), kg = kgOf(lb);
    add(kgTotal, cls, kg);
    const tr = trips.get(lb.trip?.code);
    if (!tr) { cov.noTrip++; lostBy("noTrip", cls, kg); continue; }
    const dep = Date.parse(tr.vms?.dep ?? tr.dep ?? "") / 1000, arr = Date.parse(tr.vms?.arr ?? tr.arr ?? "") / 1000;
    if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep || arr - dep > 60 * 86400) { cov.noTime++; lostBy("noTime", cls, kg); continue; }
    const tk = vid ? track(vid) : null;
    if (!tk?.hasVms) { cov.noVms++; lostBy("noVms", cls, kg); continue; }
    const pts = tk.p.filter(([t]) => t >= dep && t <= arr);
    if (pts.length < 4 || (arr - dep) / 3600 / pts.length > 3) { cov.fewPts++; lostBy("fewPts", cls, kg); continue; }
    const fp = catchPrint(landedOf(lb));
    const prints = seenPrint.get(vid) ?? seenPrint.set(vid, new Map()).get(vid);
    const repN = fp ? prints.get(fp) ?? 0 : 0; // số lần dấu vân tay này đã gặp ở chuyến trước của cùng tàu
    const legacyW = legacyTrust(lb, repN > 0);
    if (fp) prints.set(fp, repN + 1);
    const reg = ves?.gear && ves.gear !== "?" ? ves.gear : null;
    const inf = !reg ? inferred.get(vid) : null;
    const gear = reg ?? inf?.gear ?? "?", gs = reg || !inf ? "registry" : "inferred";
    const group = gearGroup(gear);
    const carrier = carriers.has(vid);
    const ivs = inPortIntervals(tk.c, dep, arr);
    const segs = segmentsRaw(pts);
    // tín hiệu ĐỘC LẬP với lời khai
    let gapOffH = 0, outH = 0;
    for (const s of segs) {
      const away = !nearAnyPort(ports, s.lat, s.lon, table.minPortKm) && !inIntervals(s.t, ivs);
      if (!away) continue;
      if (s.dtH > table.maxGapH) gapOffH += s.dtH;
      if (ring && !pointInRing(s.lon, s.lat, ring)) outH += s.dtH;
    }
    const flags = tr.vms?.flags ?? [];
    const decArr = Date.parse(tr.arr ?? ""), vmsArr = Date.parse(tr.vms?.arr ?? "");
    const port = portByCode.get(lb.landingPort?.code), last = pts[pts.length - 1];
    const ev = encAll[vid];
    const catchKg = lb.catchKg ?? 0, landKg = lb.landedKg ?? 0;
    const sig = {
      a1_gap: gapOffH >= GAP_HIDE_H, a2_flag: flags.some((f) => f === "KHONG_CO_THIET_BI" || f.startsWith("MAT_TIN_TU")), a3_eez: outH >= EEZ_OUT_H,
      rep: repN, round: isRoundSingle(landedOf(lb)),
      ratio: catchKg > 0 && landKg > 0 ? Math.max(landKg / catchKg, catchKg / landKg) : 1,
      carrier: !!ev && (ev.suspectedTransshipments ?? 0) >= 1 && (ev.topPartners ?? []).some((q) => carriers.has(q.v)),
      portKm: port && last ? hav(port.lat, port.lng, last[1], last[2]) : 0,
      arrDevH: Number.isFinite(decArr) && Number.isFinite(vmsArr) ? Math.abs(decArr - vmsArr) / 3.6e6 : 0,
      gapOffH, outH,
    };
    const vh = verdictH[group] ?? (verdictH[group] = { fish: 0, band: 0, gap: 0, inport: 0, port: 0 });
    const fishing = [];
    let eps = 0, prev = false, tripH = 0;
    for (const s of segs) {
      tripH += s.dtH;
      const v = fishingVerdict(s, group, ctx, ivs);
      if (!carrier) vh[v] += s.dtH;
      const f = v === "fish";
      if (f) fishing.push(s);
      if (f && !prev) eps++;
      prev = f;
    }
    cov.used++;
    rows.push({ lb, vid, ves, len, cls, gear, gs, group, carrier, dep, arr, fishing, H: fishing.reduce((a, s) => a + s.dtH, 0), tripH, eps, hauls: lb.haulCount ?? 0, kg, sp: landedOf(lb), legacyW, mate: null, sig, area: lb.fishingArea ?? "", tapShare: tapShareOf(landedOf(lb)), tcode: lb.trip?.code });
  }

  // ── tàu thu mua: kg ra khỏi nhãn vị trí ─────────────────────────────────────
  const noPos = { carrierTrips: 0, carrierKg: 0, carrierKgByGear: {}, hiddenTrips: 0, hiddenKg: 0, hiddenByReason: {} };
  const live = [];
  // (b) "Cá Tạp/Cá Xô" bất thường: trên p95 của nghề × lớp dài × vùng khai (và > 0,5) ⇒ kg chuyến chỉ vào tổng nghề (mã UNK), không vào lưới loài
  const tapBy = new Map();
  const tapKey = (r, area) => `${r.gear}|${r.cls}${area ? `|${r.area}` : ""}`;
  for (const r of rows) if (!r.carrier && r.kg > 0 && r.tapShare !== null) for (const area of [true, false]) (tapBy.get(tapKey(r, area)) ?? tapBy.set(tapKey(r, area), []).get(tapKey(r, area))).push(r.tapShare);
  const tapThr = (r) => { for (const area of [true, false]) { const v = tapBy.get(tapKey(r, area)); if (v && v.length >= 50) return Math.max(0.5, quantile(v, 0.95)); } return 0.8; };
  for (const r of rows) r.tap = !r.carrier && r.kg > 0 && r.tapShare !== null && r.tapShare > tapThr(r);
  const HIDE = o.hide ?? POSITION_SIGNALS;
  for (const r of rows) {
    if (r.carrier) { cov.carrier++; noPos.carrierTrips++; noPos.carrierKg += r.kg; add(noPos.carrierKgByGear, r.gear, r.kg); add(kgUsed, "carrier(không vị trí)", r.kg); continue; }
    r.hidden = HIDE.filter((n) => r.sig[n]);
    if (r.hidden.length) {
      noPos.hiddenTrips++; noPos.hiddenKg += r.kg; add(kgUsed, "giấu vị trí(không vị trí)", r.kg);
      for (const n of r.hidden) add(noPos.hiddenByReason, n, r.kg);
      continue;
    }
    live.push(r);
  }
  const nMate = linkMates(live, pairsMap);

  // ── đơn vị tính: chuyến lẻ hoặc cặp ──────────────────────────────────────────
  const units = [];
  const seen = new Set();
  for (const r of live) {
    if (seen.has(r)) continue;
    seen.add(r);
    const ms = r.mate ? (seen.add(r.mate), [r, r.mate]) : [r];
    const sp = new Map();
    for (const m of ms) for (const x of m.sp) if (x.kg > 0) { const c = x.code || "?"; sp.set(c, (sp.get(c) ?? 0) + x.kg); }
    const segs = ms.flatMap((m) => m.fishing.map((s) => ({ s, o: m })));
    const H = segs.reduce((a, e) => a + e.s.dtH, 0), kg = ms.reduce((a, m) => a + m.kg, 0);
    const tripH = ms.reduce((a, m) => a + m.tripH, 0);
    units.push({ ms, p: r, tap: ms.some((m) => m.tap), sp, segs, H, kg, tripH, legacyW: kg > 0 ? ms.reduce((a, m) => a + m.legacyW * m.kg, 0) / kg : 1, pair: ms.length === 2 });
  }

  // ── trần p99 theo nghề ĐÃ SUY ────────────────────────────────────────────────
  const cpue = new Map();
  for (const u of units) if (u.H > 0 && u.kg > 0) (cpue.get(u.p.gear) ?? cpue.set(u.p.gear, []).get(u.p.gear)).push(u.kg / u.H);
  const cap = {};
  for (const [g, v] of cpue) { v.sort((a, b) => a - b); cap[g] = v[Math.floor(0.99 * (v.length - 1))]; }

  // ── Huber theo nghề × lớp dài ─────────────────────────────────────────────────
  const strata = new Map();
  for (const u of units) if (u.H > 0 && u.kg > 0 && u.tripH > 0) { const k = `${u.p.gear}|${u.p.cls}`; (strata.get(k) ?? strata.set(k, []).get(k)).push(u); }
  const huberInfo = {};
  for (const [k, us] of strata) {
    if (us.length < MIN_STRATUM) { huberInfo[k] = { n: us.length, fitted: false }; continue; }
    const f = huberFit(us.map((u) => ({ x1: Math.log(u.H), x2: Math.log(u.tripH), y: Math.log(u.kg) })));
    us.forEach((u, i) => { u.hw = f.w[i]; });
    const kgSum = us.reduce((a, u) => a + u.kg, 0), kgDown = us.reduce((a, u) => a + (u.hw < 0.999 ? u.kg : 0), 0);
    huberInfo[k] = { n: us.length, fitted: true, beta: f.beta.map((v) => +v.toFixed(3)), sigma: +f.sigma.toFixed(3), kgDownweightedShare: +(kgDown / kgSum).toFixed(4), meanW: +(f.w.reduce((a, b) => a + b, 0) / us.length).toFixed(3) };
  }

  // ── gán giờ + sản lượng vào ô–ngày ──────────────────────────────────────────
  const eff = new Map(), catH = new Map(), catL = new Map(), catN = new Map(), catVessels = new Map(), spTot = new Map();
  const ABL = !!o.ablate;
  const catV = Object.fromEntries(SOFT_SIGNALS.map((n) => [n, new Map()])); // ablation từng tín hiệu: tắt đúng một tín hiệu
  const unitTrust = (u, active) => (u.kg > 0 ? u.ms.reduce((a, m) => a + trustScore(m.sig, active) * m.kg, 0) / u.kg : 1);
  for (const u of units) { u.tw = unitTrust(u, ACTIVE); for (const m of u.ms) m.score = trustScore(m.sig, ACTIVE); }
  let capped = 0, pairUnits = 0;
  for (const u of units) {
    if (!u.H) { if (u.kg > 0) { cov.declaredButNoFishing++; for (const m of u.ms) m.c6 = true; } continue; }
    if (u.pair) pairUnits++;
    const scale = u.kg > 0 && u.kg / u.H > cap[u.p.gear] ? (capped++, (cap[u.p.gear] * u.H) / u.kg) : 1;
    const wH = (o.huber ? u.hw ?? 1 : 1) * u.tw * scale;
    if (scale < 1) for (const m of u.ms) m.c1 = true;
    const twV = ABL ? Object.fromEntries(SOFT_SIGNALS.map((n) => [n, unitTrust(u, ACTIVE.filter((x) => x !== n))])) : null;
    for (const m of u.ms) add(kgUsed, m.cls, m.kg);
    for (const { s, o: m } of u.segs) {
      const k = `${vnDate(s.t)},${snap(s.lat)},${snap(s.lon)}`;
      const tag = `${csv(m.gear)},${vesselBucket(m.vid)},${m.gs}`;
      const ek = `${k},${tag}`;
      eff.set(ek, (eff.get(ek) ?? 0) + s.dtH);
      for (const [code0, kgc] of u.sp) {
        const code = u.tap ? "UNK" : code0;
        const kk = `${k},${csv(code)},${tag}`;
        catH.set(kk, (catH.get(kk) ?? 0) + (kgc * wH * s.dtH) / u.H);
        if (ABL) {
          catL.set(kk, (catL.get(kk) ?? 0) + (kgc * scale * u.legacyW * s.dtH) / u.H);
          catN.set(kk, (catN.get(kk) ?? 0) + (kgc * scale * s.dtH) / u.H);
          for (const n of SOFT_SIGNALS) catV[n].set(kk, (catV[n].get(kk) ?? 0) + (kgc * scale * twV[n] * s.dtH) / u.H);
        }
        const vk = `${vnDate(s.t).slice(0, 7)},${axis025(s.lat)},${axis025(s.lon)},${csv(code)},${vesselBucket(m.vid)}`;
        (catVessels.get(vk) ?? catVessels.set(vk, new Set()).get(vk)).add(m.vid);
      }
    }
    for (const m of u.ms) for (const x of m.sp) if (x.kg > 0) spTot.set(`${x.code}|${x.name}`, (spTot.get(`${x.code}|${x.name}`) ?? 0) + x.kg);
  }
  const hdr = (c) => c.join(",") + "\n";
  const rowsOf = (m, f = (v) => v.toFixed(1)) => [...m].map(([k, v]) => `${k},${f(v)}`).join("\n");
  writeFileSync(join(OUT, "effort.csv"), hdr(["date", "lat", "lon", "geartype", "vh", "gs", "hours"]) + rowsOf(eff, (h) => h.toFixed(2)));
  writeFileSync(join(OUT, "catch.csv"), hdr(["date", "lat", "lon", "species", "gear", "vh", "gs", "kg"]) + rowsOf(catH));
  writeFileSync(join(OUT, "catch-vessels-025.csv"), hdr(["month", "lat", "lon", "species", "vh", "vessels"]) + [...catVessels].map(([k, v]) => `${k},${v.size}`).join("\n"));
  if (ABL) {
    // chuẩn lại tổng kg bằng bản huber ⇒ so AUC không bị lệch vì tổng kg (mức bão hoà CATCH_FULL_KG giữ nghĩa)
    const tot = (m) => [...m.values()].reduce((a, b) => a + b, 0), T = tot(catH);
    for (const [name, m] of [["catch-legacy.csv", catL], ["catch-none.csv", catN], ...SOFT_SIGNALS.map((n) => [`catch-no-${n}.csv`, catV[n]])]) {
      const F = tot(m) > 0 ? T / tot(m) : 1;
      writeFileSync(join(OUT, name), hdr(["date", "lat", "lon", "species", "gear", "vh", "gs", "kg"]) + rowsOf(m, (v) => (v * F).toFixed(1)));
    }
  }

  // ── cổng nhãn ────────────────────────────────────────────────────────────────
  const effortHours = [...eff.values()].reduce((a, b) => a + b, 0);
  // ── điểm tin cậy: tỉ lệ chuyến / kg dính từng tín hiệu + file lý do từng chuyến (mã băm, không PII) ──────
  const own = rows.filter((r) => !r.carrier);
  const nOwn = own.length, kgOwn = own.reduce((a, r) => a + r.kg, 0);
  const flagOf = {
    a1_gap: (r) => r.sig.a1_gap, a2_flag: (r) => r.sig.a2_flag, a3_eez: (r) => r.sig.a3_eez, b_tap: (r) => r.tap,
    ...Object.fromEntries(SOFT_SIGNALS.map((n) => [n, (r) => softFactor(n, r.sig) < 1])),
    c1_cap: (r) => !!r.c1, c6_nofish: (r) => !!r.c6,
  };
  const prevalence = {};
  for (const [n, f] of Object.entries(flagOf)) {
    let t = 0, k = 0;
    for (const r of own) if (f(r)) { t++; k += r.kg; }
    prevalence[n] = { trips: t, tripsShare: +(t / Math.max(nOwn, 1)).toFixed(4), kg: Math.round(k), kgShare: +(k / Math.max(kgOwn, 1)).toFixed(4) };
  }
  const scoreHist = { "1": 0, "0.7-1": 0, "0.5-0.7": 0, "<0.5": 0 };
  let kgScore = 0;
  const lines = ["trip,score,reasons"];
  for (const r of rows) {
    if (r.carrier) { lines.push(`${hash10(r.tcode)},0,carrier`); continue; }
    const sc = r.score ?? trustScore(r.sig, ACTIVE);
    const why = Object.entries(flagOf).filter(([, f]) => f(r)).map(([n]) => n);
    if (r.hidden?.length) lines.push(`${hash10(r.tcode)},0,hidden:${r.hidden.join("+")}`);
    else lines.push(`${hash10(r.tcode)},${sc.toFixed(3)},${why.join("|")}`);
    if (!r.hidden?.length) { scoreHist[sc >= 0.999 ? "1" : sc >= 0.7 ? "0.7-1" : sc >= 0.5 ? "0.5-0.7" : "<0.5"]++; kgScore += sc * r.kg; }
  }
  writeFileSync(join(OUT, "trust-trips.csv"), lines.join("\n"));
  const tripsWithH = units.reduce((a, u) => a + (u.H > 0 ? u.ms.length : 0), 0);
  const tripHoursWithH = units.reduce((a, u) => a + (u.H > 0 ? u.tripH : 0), 0); // giờ có điểm VMS của các chuyến đó (cửa sổ cuối thiếu chuyến dài chưa cập)
  const kgByGearName = {};
  for (const [k, v] of catH) { const g = k.split(",")[4]; add(kgByGearName, g, v); }
  const kgAll = Object.values(kgByGearName).reduce((a, b) => a + b, 0);
  const stat = (rs) => {
    const hs = rs.filter((r) => r.hauls >= 1 && !r.carrier);
    const rh = (f) => +(spearman(hs.map(f), hs.map((r) => r.hauls))).toFixed(3);
    // rho = ρ(số đợt, haulCount) (cổng); rhoH = ρ(giờ trong dải, haulCount) (metric chọn dải); rhoTrip = ρ(giờ chuyến, haulCount) = đường cơ sở
    return { nTrips: hs.length, rho: rh((r) => r.eps), rhoH: rh((r) => r.H), rhoTrip: rh((r) => r.tripH), epsPerHaul: hs.length ? +(hs.reduce((a, r) => a + r.eps, 0) / hs.reduce((a, r) => a + r.hauls, 0)).toFixed(2) : null };
  };
  const byGroup = {}, byGear = {};
  for (const g of GEARS) byGroup[g] = stat(rows.filter((r) => r.group === g));
  for (const g of ["?", ...Object.values(GROUP_NAME)]) byGear[g] = stat(rows.filter((r) => r.gear === g));
  const nullStat = { allInferred: stat(rows.filter((r) => r.gs === "inferred")), stillUnknown: stat(rows.filter((r) => r.gear === "?")), inferredByGroup: Object.fromEntries(GEARS.map((g) => [g, stat(rows.filter((r) => r.gs === "inferred" && r.group === g))])) };
  const reV = verdictH.re ?? {};
  const reTot = (reV.fish ?? 0) + (reV.port ?? 0) + (reV.inport ?? 0);
  // % giờ Rê ≤ 6 km cảng ở nhãn CUỐI: đo trực tiếp trên các đoạn đã nhận
  let reNear6 = 0, reH = 0;
  for (const r of rows) if (r.group === "re" && !r.carrier) for (const s of r.fishing) { reH += s.dtH; if (nearAnyPort(ports, s.lat, s.lon, 6)) reNear6 += s.dtH; }
  const lenKgShare = Object.fromEntries(Object.keys(kgTotal).map((c) => [c, { kgUsed: Math.round(kgUsed[c] ?? 0), kgTotal: Math.round(kgTotal[c]), share: +((kgUsed[c] ?? 0) / kgTotal[c]).toFixed(4) }]));
  const kgUsedAll = Object.values(kgUsed).reduce((a, b) => a + b, 0), kgTotalAll = Object.values(kgTotal).reduce((a, b) => a + b, 0);
  const here = fileURLToPath(import.meta.url);
  const report = {
    v: 2, builtAt: new Date().toISOString(), secs: Math.round((Date.now() - t0) / 1000),
    source: { dir: basename(DIR), from: o.FROM, to: o.TO, window: WINDOW, portsSnapshot: basename(dirname(o.ports)), logbooksRead: logbooks.length },
    scriptSha: { labelsV2: sha(here), fishingDef: sha(join(dirname(here), "fishing-def.mjs")), gearInfer: sha(join(dirname(here), "gear-infer.mjs")), bandsTable: sha(bandsFile) },
    bandsTable: { date: table.date, bands: table.bands, nightStill: table.nightStill, maxGapH: table.maxGapH, minPortKm: table.minPortKm },
    gearMap: gm ? { vessels: inferred.size, params: gm.params, holdout: gm.holdout } : null,
    carriers: { vesselsKnown: carriers.size }, pairs: { vesselsMapped: Object.keys(pairsMap).length, linkedTrips: nMate, pairUnits },
    coverage: cov,
    kg: { used: Math.round(kgUsedAll), total: Math.round(kgTotalAll), share: +(kgUsedAll / kgTotalAll).toFixed(4), byLenClass: lenKgShare, lostByReason: kgLost },
    noPosition: noPos,
    trust: {
      note: "điểm tin cậy từ tín hiệu ĐỘC LẬP với lời khai (README §7.2b); nhãn nghiêng về tàu khai thật. Lý do từng chuyến: trust-trips.csv (mã băm sha256/10 hex)",
      active: ACTIVE, hide: HIDE, huber: !!o.huber,
      thresholds: { gapHideH: GAP_HIDE_H, eezOutH: EEZ_OUT_H, portFarKm: PORT_FAR_KM, arrDevH: ARR_DEV_H, tapCodes: [...TAP_CODES], eezRing: !!ring },
      prevalence, scoreHist, meanScoreKgWeighted: +(kgScore / Math.max(kgOwn, 1)).toFixed(4), tripsFile: "trust-trips.csv",
    },
    cpueCapKgPerH: cap, capped,
    huber: huberInfo,
    gates: {
      hoursPerTrip: { effortHours: Math.round(effortHours), trips: tripsWithH, value: +(effortHours / Math.max(tripsWithH, 1)).toFixed(2), tripHoursPerTrip: +(tripHoursWithH / Math.max(tripsWithH, 1)).toFixed(1), fishingShareOfTripHours: +(effortHours / Math.max(tripHoursWithH, 1)).toFixed(4) },
      reHoursNear6kmShare: reH ? +(reNear6 / reH).toFixed(5) : null,
      reHoursDroppedByPortRule: reTot ? +(((reV.port ?? 0) + (reV.inport ?? 0)) / reTot).toFixed(4) : null,
      kgUnknownGearShare: kgAll ? +((kgByGearName["?"] ?? 0) / kgAll).toFixed(4) : null,
      kgByGear: Object.fromEntries(Object.entries(kgByGearName).map(([g, v]) => [g, Math.round(v)])),
      episodesVsHauls: { byGroup, byGear, nullVessels: nullStat },
      hoursByVerdict: Object.fromEntries(Object.entries(verdictH).map(([g, v]) => [g, Object.fromEntries(Object.entries(v).map(([k, h]) => [k, Math.round(h)]))])),
    },
    effortHours,
    species: [...spTot].sort((a, b) => b[1] - a[1]).map(([k, kg]) => ({ code: k.split("|")[0], name: k.split("|")[1], kg: Math.round(kg) })),
  };
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ out: OUT, coverage: cov, kg: report.kg.share, gates: { hoursPerTrip: report.gates.hoursPerTrip, reHoursNear6kmShare: report.gates.reHoursNear6kmShare, kgUnknownGearShare: report.gates.kgUnknownGearShare, nullVessels: nullStat }, noPosition: noPos, pairUnits, secs: report.secs }, null, 1));
}

function selftest() {
  // Huber: hồi quy y = 1 + 0,8·x1 + 0,2·x2 + nhiễu nhỏ, 5 điểm ngoại lai ⇒ hệ số đúng, ngoại lai bị hạ
  let seed = 3;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rows = Array.from({ length: 200 }, () => { const x1 = rnd() * 3, x2 = rnd() * 3; return { x1, x2, y: 1 + 0.8 * x1 + 0.2 * x2 + (rnd() - 0.5) * 0.1 }; });
  for (let i = 0; i < 5; i++) rows[i].y += 6;
  const f = huberFit(rows);
  if (Math.abs(f.beta[1] - 0.8) > 0.05 || Math.abs(f.beta[2] - 0.2) > 0.05) throw new Error(`selftest: huber beta ${f.beta}`);
  if (!(f.w[0] < 0.2) || !(f.w[100] > 0.9)) throw new Error(`selftest: huber trọng số ${f.w[0]} ${f.w[100]}`);
  // cặp: chỉ một-đối-một
  const c = new Map([["A", new Map([["B", 30]])], ["B", new Map([["A", 30]])], ["C", new Map([["D", 25], ["E", 20]])], ["D", new Map([["C", 25]])], ["F", new Map([["G", 5]])], ["G", new Map([["F", 5]])]]);
  const p = choosePairs(c);
  if (p.A !== "B" || p.B !== "A" || p.C || p.F) throw new Error(`selftest: choosePairs ${JSON.stringify(p)}`);
  const rs = [{ vid: "A", dep: 0, arr: 100 }, { vid: "B", dep: 10, arr: 95 }, { vid: "B", dep: 500, arr: 600 }, { vid: "X", dep: 0, arr: 100 }];
  if (linkMates(rs, p) !== 1 || rs[0].mate !== rs[1] || rs[2].mate || rs[3].mate) throw new Error("selftest: linkMates");
  if (lenClass(11.9) !== "<12" || lenClass(24) !== ">=24" || lenClass(null) !== "?") throw new Error("selftest: lenClass");
  if (Math.abs(spearman([1, 2, 3, 4], [1, 3, 2, 4]) - 0.8) > 1e-9) throw new Error("selftest: spearman");
  // điểm tin cậy
  if (softFactor("c2_repeat", { rep: 0 }) !== 1 || softFactor("c2_repeat", { rep: 2 }) !== 0.5) throw new Error("selftest: c2");
  if (softFactor("c4_mismatch", { ratio: 1.9 }) !== 1 || Math.abs(softFactor("c4_mismatch", { ratio: 4 }) - 0.5) > 1e-9 || softFactor("c4_mismatch", { ratio: 100 }) !== 0.3) throw new Error("selftest: c4");
  if (softFactor("d1_port", { portKm: 10 }) !== 1 || softFactor("d1_port", { portKm: 100 }) !== 0.5) throw new Error("selftest: d1");
  if (softFactor("d2_time", { arrDevH: 6 }) !== 1 || softFactor("d2_time", { arrDevH: 24 }) !== 0.5) throw new Error("selftest: d2");
  if (Math.abs(trustScore({ rep: 2, round: true, ratio: 1, carrier: false, portKm: 0, arrDevH: 0 }, SOFT_SIGNALS) - 0.4) > 1e-9) throw new Error("selftest: trustScore nhân dồn");
  if (trustScore({ rep: 2, round: true }, []) !== 1) throw new Error("selftest: tắt hết = 1");
  if (tapShareOf([{ code: "CTA", kg: 60 }, { code: "SKJ", kg: 40 }]) !== 0.6 || tapShareOf([]) !== null) throw new Error("selftest: tapShare");
  if (!isRoundSingle([{ code: "X", kg: 600 }]) || isRoundSingle([{ code: "X", kg: 650 }]) || isRoundSingle([{ code: "X", kg: 600 }, { code: "Y", kg: 100 }]) || isRoundSingle([{ code: "X", kg: 100 }])) throw new Error("selftest: isRoundSingle");
  console.log("selftest OK (dl-labels-v2)");
}

if (process.argv[1]?.endsWith("dl-labels-v2.mjs")) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  if (argv.includes("--selftest")) selftest();
  else if (argv.includes("--pairs-prep")) {
    const out = arg("out", "pairs.json").replace(/^~/, homedir());
    pairsFromEvents(arg("events", "").replace(/^~/, homedir())).then((pairs) => { writeFileSync(out, JSON.stringify({ v: 1, builtAt: new Date().toISOString(), rule: "PAIRED một-đối-một: ≥20 sự kiện, đối tác chính ≥80 % ở cả hai phía", pairs })); console.log(`${Object.keys(pairs).length / 2} cặp → ${out}`); });
  }
}
