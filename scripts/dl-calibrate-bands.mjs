#!/usr/bin/env node
// scripts/dl-calibrate-bands.mjs — dựng MỘT bảng dải tốc độ "đang đánh" theo nhóm nghề, CỐ ĐỊNH CẢ NĂM
// → scripts/fishing-bands.v2.json (rà pipeline 2026-10-18, mảnh 2C; README §7.1).
// ─────────────────────────────────────────────────────────────────────────────
// Vì sao: bản cũ chỉnh dải theo TỪNG cửa sổ bằng Spearman(số đợt, haulCount) trên vài trăm chuyến ⇒ dải nhảy
// (Rê 1–1,5 → 0,3–3,5 → 0–1 …), giờ/chuyến 46 → 122. Cách mới:
//   · gộp mọi cửa sổ — toàn bộ chuyến có haulCount + VMS phủ tốt (≈ 6 600);
//   · metric = ρ(GIỜ trong dải, haulCount) — không phải số đợt (số đợt gấp 4 lần số mẻ ở Rê);
//   · bootstrap 100 lần theo chuyến ⇒ CI 90 % của ρ tại dải chọn + độ ổn định (tỉ lệ lần chọn lại đúng dải đó);
//   · vmin = 0 BỊ LOẠI khỏi lưới dò; chỉ nhóm vây được "đứng yên ban đêm" (nightStill, fishing-def.mjs);
//   · giờ trong 10 km quanh BẤT KỲ cảng nào và giữa IN/OUT thật (tk.c) không tính ngay từ lúc dò;
//   · nhóm không đủ chuyến (hoặc ρ ≤ 0,1) lùi về dải gộp mọi nghề (cờ fallback).
// Nghề tàu = sổ tàu, thiếu thì gear-map (scripts/gear-infer.mjs).
//   node scripts/dl-calibrate-bands.mjs --dir ~/sdfish-data/dl-all --ports <catalog-ports.json.gz|.json> \
//        [--gear-map …/gear-map.json] [--boot 100] [--out scripts/fishing-bands.v2.json] [--report <file>]
//   node scripts/dl-calibrate-bands.mjs --selftest
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { gearGroup, GEARS, makePortIndex, nearAnyPort, inPortIntervals, inIntervals, segmentsRaw, BANDS_FILE } from "./fishing-def.mjs";

export const GAP_H = 4;
const lenClassOf = (m) => (!Number.isFinite(m) ? "?" : m < 12 ? "<12" : m < 15 ? "12-15" : m < 24 ? "15-24" : ">=24");
export const VMIN = [0.3, 0.6, 1, 1.5, 2]; // KHÔNG có 0
export const VMAX = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];
export const MIN_TRIPS = 100;
export const MIN_RHO = 0.1;
export const bandGrid = () => VMIN.flatMap((a) => VMAX.filter((b) => b > a + 0.4).map((b) => [a, b]));

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Hạng trung bình (xử lý hoà). */
export function rankAvg(v) {
  const n = v.length, idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => v[a] - v[b]), r = new Float64Array(n);
  for (let i = 0; i < n; ) { let j = i; while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++; for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2; i = j + 1; }
  return r;
}
export function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
}
export const spearman = (x, y) => pearson(rankAvg(x), rankAvg(y));

/** Giờ trong dải của một chuyến. segs = {kn:Float32Array, dt:Float32Array} (đã lọc cảng/gap/IN-OUT). */
export function hoursInBand(segs, [lo, hi]) {
  let h = 0;
  for (let i = 0; i < segs.kn.length; i++) if (segs.kn[i] >= lo && segs.kn[i] <= hi) h += segs.dt[i];
  return h;
}

/**
 * Chọn dải cho một tập chuyến [{segs, hauls}] bằng ρ(giờ trong dải, haulCount); bootstrap B lần.
 * Trả {band, rho, n, ci90:[lo,hi], stability, top:[{band,freq}]}.
 */
export function calibrateBand(trips, { boot = 100, seed = 7, bands = bandGrid() } = {}) {
  const n = trips.length;
  if (n < 30) return { band: null, rho: NaN, n, fallback: true };
  const H = bands.map((b) => Float64Array.from(trips, (t) => hoursInBand(t.segs, b)));
  const hauls = Float64Array.from(trips, (t) => t.hauls);
  const best = (idx) => {
    const hy = rankAvg(idx.map((i) => hauls[i]));
    let bi = -1, br = -Infinity;
    const rhos = new Array(bands.length);
    for (let k = 0; k < bands.length; k++) {
      const r = pearson(rankAvg(idx.map((i) => H[k][i])), hy);
      rhos[k] = r;
      if (r > br) { br = r; bi = k; }
    }
    return { bi, rhos };
  };
  const all = Array.from({ length: n }, (_, i) => i);
  const full = best(all);
  const rng = mulberry32(seed);
  const freq = new Map(), rhoAt = [];
  let same = 0;
  for (let b = 0; b < boot; b++) {
    const idx = Array.from({ length: n }, () => (rng() * n) | 0);
    const r = best(idx);
    freq.set(r.bi, (freq.get(r.bi) ?? 0) + 1);
    if (r.bi === full.bi) same++;
    rhoAt.push(r.rhos[full.bi]);
  }
  rhoAt.sort((a, b) => a - b);
  const q = (p) => rhoAt[Math.min(rhoAt.length - 1, Math.max(0, Math.round(p * (rhoAt.length - 1))))];
  return {
    band: bands[full.bi], rho: full.rhos[full.bi], n,
    ci90: boot ? [q(0.05), q(0.95)] : null,
    stability: boot ? same / boot : null,
    top: [...freq].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, f]) => ({ band: bands[k], freq: f / boot })),
  };
}

// ── nạp chuyến ──────────────────────────────────────────────────────────────
const readJsonMaybeGz = (f) => { const b = readFileSync(f); return JSON.parse((f.endsWith(".gz") ? gunzipSync(b) : b).toString("utf8")); };

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const home = (p) => p?.replace(/^~/, homedir());
  const DIR = home(arg("dir", ""));
  const PORTS = home(arg("ports", ""));
  if (!DIR || !PORTS) { console.error("thiếu --dir <dl-all> và --ports <catalog-ports.json[.gz]>"); process.exit(2); }
  const OUT = home(arg("out", BANDS_FILE));
  const REPORT = home(arg("report", null));
  const BOOT = +arg("boot", 100);
  const GMAP = home(arg("gear-map", join(DIR, "gear-map.json")));
  const ports = makePortIndex(((c) => c.items || c)(readJsonMaybeGz(PORTS)));
  const inferred = existsSync(GMAP) ? new Map(Object.entries(JSON.parse(readFileSync(GMAP, "utf8")).vessels).map(([id, o]) => [id, o.group])) : new Map();
  const tf = readdirSync(DIR).filter((f) => /^trips_.*\.json$/.test(f)), lf = readdirSync(DIR).filter((f) => /^logbooks_.*\.json$/.test(f));
  const trips = new Map(tf.flatMap((f) => JSON.parse(readFileSync(join(DIR, f), "utf8"))).map((t) => [t.code, t]));
  const vessels = new Map(JSON.parse(readFileSync(join(DIR, "vessels.json"), "utf8")).map((v) => [v.id, v]));
  const lbs = lf.flatMap((f) => JSON.parse(readFileSync(join(DIR, f), "utf8"))).filter((lb) => (lb.haulCount ?? 0) >= 1).sort((a, b) => String(a.vessel?.id).localeCompare(String(b.vessel?.id)));
  console.error(`[bands] ${lbs.length} nhật ký có haulCount · ${trips.size} chuyến · nghề suy ${inferred.size}`);
  const rows = [];
  let cache = [null, null];
  const cov = { logbooks: lbs.length, noTrip: 0, noTime: 0, noVms: 0, fewPts: 0, used: 0 };
  for (const lb of lbs) {
    const vid = lb.vessel?.id, tr = trips.get(lb.trip?.code);
    if (!tr) { cov.noTrip++; continue; }
    const dep = Date.parse(tr.vms?.dep ?? tr.dep ?? "") / 1000, arr = Date.parse(tr.vms?.arr ?? tr.arr ?? "") / 1000;
    if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep || arr - dep > 60 * 86400) { cov.noTime++; continue; }
    if (cache[0] !== vid) { const f = join(DIR, "track", `${vid}.json`); cache = [vid, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null]; }
    const tk = cache[1];
    if (!tk?.hasVms) { cov.noVms++; continue; }
    const pts = tk.p.filter(([t]) => t >= dep && t <= arr);
    if (pts.length < 4 || (arr - dep) / 3600 / pts.length > 3) { cov.fewPts++; continue; }
    const ivs = inPortIntervals(tk.c, dep, arr);
    const kn = [], dt = [];
    for (const s of segmentsRaw(pts)) {
      if (s.dtH > GAP_H || inIntervals(s.t, ivs) || nearAnyPort(ports, s.lat, s.lon)) continue;
      kn.push(s.kn); dt.push(s.dtH);
    }
    const reg = vessels.get(vid)?.gear;
    const group = reg && reg !== "?" ? gearGroup(reg) : inferred.get(vid) ?? "khac";
    rows.push({ group, cls: lenClassOf(vessels.get(vid)?.lengthM ?? lb.vessel?.lengthM), src: reg && reg !== "?" ? "registry" : inferred.has(vid) ? "inferred" : "none", hauls: lb.haulCount, segs: { kn: Float32Array.from(kn), dt: Float32Array.from(dt) } });
    cov.used++;
  }
  console.error(`[bands] dùng ${cov.used} chuyến`);
  // --probe <nhóm>:<lớp dài>:<registry|inferred|any> — chỉ IN dải tốt nhất của một lát cắt, không ghi bảng (chẩn đoán)
  const probe = arg("probe", null);
  if (probe) {
    const [g, lc, src] = probe.split(":");
    const rs = rows.filter((r) => r.group === g && (lc === "any" || r.cls === lc) && (src === "any" || r.src === src));
    const c = calibrateBand(rs, { boot: 30 });
    console.log(JSON.stringify({ probe, n: rs.length, band: c.band, rho: c.rho, ci90: c.ci90, stability: c.stability, top: c.top }));
    process.exit(0);
  }
  const pooled = calibrateBand(rows, { boot: BOOT });
  const out = { band: {}, report: {} };
  for (const g of GEARS) {
    const rs = rows.filter((r) => r.group === g);
    let c = g === "khac" || rs.length < MIN_TRIPS ? null : calibrateBand(rs, { boot: BOOT });
    const fallback = !c || !(c.rho > MIN_RHO);
    if (fallback) c = { ...pooled, nGroup: rs.length, rhoGroup: c?.rho ?? NaN };
    out.band[g] = { band: c.band, rho: +c.rho.toFixed(3), ci90: c.ci90?.map((v) => +v.toFixed(3)), stability: c.stability, n: c.n, top: c.top, ...(fallback ? { fallback: "pooled", nGroup: rs.length } : {}) };
    console.error(`[bands] ${g}: ${c.band.join("–")} kn ρ=${c.rho.toFixed(3)} CI ${c.ci90?.map((v) => v.toFixed(2)).join("…")} ổn định ${c.stability} n=${c.n}${fallback ? " (gộp)" : ""}`);
  }
  const sha = createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex").slice(0, 12);
  const table = {
    v: 1, date: new Date().toISOString().slice(0, 10),
    source: { what: "ρ(giờ trong dải, haulCount) trên mọi chuyến có haulCount + VMS phủ tốt, gộp cả năm 2026", script: "scripts/dl-calibrate-bands.mjs", scriptSha: sha, dir: DIR.split("/").pop(), logbookFiles: lf, ...cov, bootstrap: BOOT, metric: "spearman(hours_in_band, haulCount)", grid: { vmin: VMIN, vmax: VMAX }, gearMap: inferred.size },
    maxGapH: GAP_H, minPortKm: 10,
    nightStill: { gears: ["vay"], from: 18, to: 6, why: "tàu vây ánh sáng giữ đàn đứng yên ban đêm; vmin = 0 chỉ vây, 18–06 giờ VN, cách mọi cảng > 10 km" },
    bands: out.band,
  };
  writeFileSync(OUT, JSON.stringify(table, null, 1) + "\n");
  if (REPORT) writeFileSync(REPORT, JSON.stringify({ ...table, pooled }, null, 1));
  console.log(`ghi ${OUT}`);
}

function selftest() {
  if (rankAvg([3, 1, 1, 2]).join() !== "3,0.5,0.5,2") throw new Error("selftest: rankAvg");
  if (Math.abs(spearman([1, 2, 3, 4], [2, 4, 6, 9]) - 1) > 1e-9) throw new Error("selftest: spearman");
  if (bandGrid().some(([a]) => a === 0) || bandGrid().some(([a, b]) => b <= a + 0.4)) throw new Error("selftest: lưới dải");
  // chuyến giả: mẻ thật nằm ở 1–2 kn; kn ngoài dải là nhiễu ⇒ phải chọn dải ôm [1,2]
  const rng = mulberry32(1);
  const trips = Array.from({ length: 400 }, () => {
    const hauls = 1 + ((rng() * 9) | 0);
    const kn = [], dt = [];
    for (let i = 0; i < hauls * 3; i++) { kn.push(1 + rng()); dt.push(1); } // 3 giờ trong dải mỗi mẻ
    for (let i = 0; i < 20; i++) { kn.push(rng() < 0.5 ? 0.3 * rng() : 3 + 2 * rng()); dt.push(1); } // nhiễu cố định ngoài dải
    return { segs: { kn: Float32Array.from(kn), dt: Float32Array.from(dt) }, hauls };
  });
  const c = calibrateBand(trips, { boot: 20 });
  if (!(c.band[0] <= 1 && c.band[1] === 2)) throw new Error(`selftest: dải ${c.band}`);
  if (!(c.rho > 0.95 && c.ci90[0] > 0.9 && c.stability > 0.5)) throw new Error(`selftest: ρ ${JSON.stringify(c)}`);
  if (!calibrateBand(trips.slice(0, 10)).fallback) throw new Error("selftest: ít chuyến phải lùi");
  console.log("selftest OK (dl-calibrate-bands)");
}

if (process.argv[1]?.endsWith("dl-calibrate-bands.mjs")) { if (process.argv.includes("--selftest")) selftest(); else main(); }
