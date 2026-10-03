#!/usr/bin/env node
// Kiểm định dự báo cá bằng VỊ TRÍ ĐÁNH BẮT THẬT (chuẩn Hsu 2021 — không cần CPUE).
// Đọc payload `buildFishForecast` (cells{lat,lon,s,sp}) + CSV giờ đánh bắt theo ô
// (GFW fleet-daily hoặc VMS/nhật ký đã gom), đo:
//   • LIFT  = mật độ giờ đánh bắt trong ô điểm ≥ ngưỡng / mật độ nền (kỳ vọng > 1,5)
//   • % giờ (và % vị trí) nằm trong 5 km / 50 km của một ô điểm cao
//   • p-value hoán vị (≥ 200 lần): có nhiều ngày dự báo → hoán vị cặp NGÀY (vị trí ngày d
//     ghép với dự báo ngày d'); chỉ 1 dự báo → hoán vị điểm giữa các ô (ghi rõ trong kết quả)
//   theo tổng, theo NGHỀ (geartype) và theo LOÀI (nghề → nhóm loài mục tiêu).
// Thuần Node ≥ 18, không phụ thuộc. KHÔNG sửa fish-predict.ts — chỉ đọc payload.
//
//   node scripts/fish-validate-positions.mjs --forecast fc.json[,fc2.json|dir/] --positions gfw.csv
//        [--threshold 50] [--perm 200] [--radius 5,50] [--flag VNM] [--min-hours 0]
//        [--gear-map map.json] [--json out.json] [--seed 7]
//   node scripts/fish-validate-positions.mjs --selftest
//
// CSV vị trí: cột lat,lon,hours[,geartype,date,flag] — hoặc nguyên bản GFW
// (cell_ll_lat,cell_ll_lon,fishing_hours,geartype,date,flag; góc dưới-trái 0,01° → tâm +0,005).
// Payload dự báo: {date, cells:[{lat,lon,s,sp:{tên-ngắn: điểm}}]} — lat/lon là TÂM ô, bước lưới
// suy từ chính payload (0,25° hiện nay). Vị trí ngoài vùng dự báo bị bỏ và được đếm.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Nghề GFW → loài mục tiêu (tên ngắn trong `sp`). Nghề không có trong bảng chỉ tính vào TỔNG.
// Đè bằng --gear-map file.json cùng hình dạng.
export const DEFAULT_GEAR_MAP = {
  tuna_purse_seines: ["ngừ vằn", "ngừ chù", "ngừ ồ"],
  other_purse_seines: ["cá nục", "cá cơm", "bạc má", "cá trích", "cá ngân", "cá sòng", "cá tráo", "cá lầm", "chỉ vàng", "ngừ vằn"],
  purse_seines: ["cá nục", "cá cơm", "bạc má", "cá trích", "cá ngân", "cá sòng", "cá tráo", "cá lầm", "chỉ vàng", "ngừ vằn", "ngừ chù", "ngừ ồ"],
  seiners: ["cá nục", "cá cơm", "bạc má", "cá trích", "cá ngân", "cá sòng", "cá tráo", "cá lầm", "chỉ vàng", "ngừ vằn"],
  drifting_longlines: ["ngừ vây vàng", "ngừ mắt to", "cá cờ"],
  pole_and_line: ["ngừ vằn"],
  trawlers: ["cá hố", "cá mối", "cá đổng", "cá phèn", "cá đù", "cá khoai", "cá chim", "cá bơn"],
  squid_jigger: ["mực xà", "mực ống"],
};

const R_EARTH = 6371;
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

/** Bước lưới = chênh nhỏ nhất (>1e-6) giữa các vĩ độ duy nhất; không suy được → 0,25. */
export function inferStep(cells, fallback = 0.25) {
  const lats = [...new Set(cells.map((c) => +c.lat.toFixed(6)))].sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < lats.length; i++) {
    const d = lats[i] - lats[i - 1];
    if (d > 1e-6 && d < best) best = d;
  }
  return Number.isFinite(best) ? best : fallback;
}

/** Lưới tra nhanh: key "i,j" → cell. */
export function indexGrid(cells, step) {
  // gốc = tâm ô nhỏ nhất; khoá theo số bước từ gốc (tâm ở x.125 chia 0,25 ra đúng .5 → round lệch nếu không trừ gốc)
  let lat0 = Infinity, lon0 = Infinity;
  for (const c of cells) { if (c.lat < lat0) lat0 = c.lat; if (c.lon < lon0) lon0 = c.lon; }
  const g = { map: new Map(), step, lat0, lon0 };
  for (const c of cells) g.map.set(key(c.lat, c.lon, g), c);
  return g;
}
function key(lat, lon, g) {
  return `${Math.round((lat - g.lat0) / g.step)},${Math.round((lon - g.lon0) / g.step)}`;
}

/** Đọc CSV vị trí (GFW hoặc gọn). Trả [{lat,lon,hours,gear,date,flag}] đã lọc flag/min-hours. */
export function parsePositions(text, { flag, minHours = 0 } = {}) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const cols = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const col = (...names) => names.map((n) => cols.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iLat = col("lat", "cell_ll_lat", "latitude");
  const iLon = col("lon", "cell_ll_lon", "longitude");
  const iH = col("fishing_hours", "hours"); // GFW: fishing_hours (giờ ĐÁNH BẮT), không lấy hours (giờ có mặt)
  const iG = col("geartype", "gear");
  const iD = col("date");
  const iF = col("flag");
  if (iLat < 0 || iLon < 0 || iH < 0) throw new Error(`CSV thiếu cột lat/lon/hours — header: ${lines[0]}`);
  const llCorner = cols[iLat] === "cell_ll_lat"; // GFW: góc dưới-trái ô 0,01° → tâm
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(",");
    const hours = +f[iH];
    if (!Number.isFinite(hours) || hours <= minHours) continue;
    if (flag && iF >= 0 && f[iF] !== flag) continue;
    let lat = +f[iLat];
    let lon = +f[iLon];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (llCorner) { lat += 0.005; lon += 0.005; }
    out.push({ lat, lon, hours, gear: iG >= 0 ? f[iG] : "", date: iD >= 0 ? f[iD] : "", flag: iF >= 0 ? f[iF] : "" });
  }
  return out;
}

/**
 * Gắn mỗi vị trí vào ô dự báo (theo lưới). Trả {hits:[{pos, cell}], dropped}.
 */
export function attach(positions, grid) {
  const hits = [];
  let dropped = 0;
  for (const p of positions) {
    const c = grid.map.get(key(p.lat, p.lon, grid));
    if (c) hits.push({ pos: p, cell: c });
    else dropped++;
  }
  return { hits, dropped };
}

/**
 * Lift cho một hàm điểm `score(cell) → 0..100|undefined`:
 *   lift = (giờ trong ô ≥ thr / số ô ≥ thr) / (tổng giờ / tổng ô có điểm)
 * Trả {lift, hotHours, hotCells, totalHours, totalCells, shareHours}
 */
export function lift(cells, hits, score, thr) {
  let totalCells = 0;
  let hotCells = 0;
  const hot = new Set();
  for (const c of cells) {
    const s = score(c);
    if (s === undefined || s === null || Number.isNaN(s)) continue;
    totalCells++;
    if (s >= thr) { hotCells++; hot.add(c); }
  }
  let totalHours = 0;
  let hotHours = 0;
  for (const h of hits) {
    totalHours += h.pos.hours;
    if (hot.has(h.cell)) hotHours += h.pos.hours;
  }
  const base = totalCells ? totalHours / totalCells : 0;
  const dens = hotCells ? hotHours / hotCells : 0;
  return {
    lift: base > 0 && hotCells > 0 ? dens / base : NaN,
    hotHours, hotCells, totalHours, totalCells,
    shareHours: totalHours ? hotHours / totalHours : NaN,
    shareCells: totalCells ? hotCells / totalCells : NaN,
  };
}

/** % giờ và % vị trí nằm trong `radiusKm` của ô ≥ thr (khoảng cách tới TÂM ô gần nhất). */
export function nearHot(cells, hits, score, thr, radii) {
  const hot = cells.filter((c) => (score(c) ?? -1) >= thr);
  const res = Object.fromEntries(radii.map((r) => [r, { hours: 0, n: 0 }]));
  let totalHours = 0;
  for (const h of hits) {
    totalHours += h.pos.hours;
    let dmin = Infinity;
    for (const c of hot) {
      const d = haversineKm(h.pos.lat, h.pos.lon, c.lat, c.lon);
      if (d < dmin) dmin = d;
    }
    for (const r of radii) if (dmin <= r) { res[r].hours += h.pos.hours; res[r].n += 1; }
  }
  const out = {};
  for (const r of radii) out[r] = { pctHours: totalHours ? (100 * res[r].hours) / totalHours : NaN, pctPos: hits.length ? (100 * res[r].n) / hits.length : NaN };
  return out;
}

/** Bộ sinh ngẫu nhiên có hạt (mulberry32) để kết quả hoán vị lặp lại được. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Đánh giá một nhóm (tổng / nghề / loài) trên danh sách ngày.
 * days: [{date, cells, grid, hits}] (hits đã lọc theo nghề nếu cần). score(cell) → điểm.
 * Lift quan sát = gộp mọi ngày (giờ/ô cộng dồn). Hoán vị:
 *   - ≥2 ngày: hoán vị ánh xạ ngày→dự báo (vị trí ngày d chấm bằng lưới ngày π(d)); loại hoán vị đồng nhất.
 *   - 1 ngày: hoán vị điểm giữa các ô (giữ nguyên vị trí).
 */
export function evaluate(days, score, thr, perm, rand, radii) {
  const agg = (pairs) => {
    let hotH = 0, totH = 0, hotC = 0, totC = 0;
    for (const { cells, hits } of pairs) {
      const l = lift(cells, hits, score, thr);
      hotH += l.hotHours; totH += l.totalHours; hotC += l.hotCells; totC += l.totalCells;
    }
    const base = totC ? totH / totC : 0;
    return { lift: base > 0 && hotC > 0 ? hotH / hotC / base : NaN, hotHours: hotH, totalHours: totH, hotCells: hotC, totalCells: totC };
  };
  const obs = agg(days);
  const near = radii.length ? mergeNear(days.map((d) => nearHot(d.cells, d.hits, score, thr, radii)), days.map((d) => d.hits.reduce((s, h) => s + h.pos.hours, 0)), days.map((d) => d.hits.length), radii) : {};
  let ge = 0, used = 0, mode;
  if (!Number.isFinite(obs.lift)) return { ...obs, near, p: NaN, perm: 0, mode: "không đủ dữ liệu" };
  if (days.length >= 2) {
    mode = `hoán vị ngày (${days.length} ngày)`;
    for (let k = 0; k < perm; k++) {
      const order = shuffle(days.map((_, i) => i), rand);
      if (order.every((v, i) => v === i)) continue;
      // vị trí ngày i chấm trên lưới ngày order[i] — phải gắn lại ô vì lưới có thể khác
      const pairs = days.map((d, i) => ({ cells: days[order[i]].cells, hits: attach(d.hits.map((h) => h.pos), days[order[i]].grid).hits }));
      if (agg(pairs).lift >= obs.lift) ge++;
      used++;
    }
  } else {
    mode = "hoán vị điểm giữa các ô (1 dự báo)";
    const d = days[0];
    const scored = d.cells.filter((c) => score(c) !== undefined && !Number.isNaN(score(c)));
    const vals = scored.map(score);
    for (let k = 0; k < perm; k++) {
      const sh = shuffle(vals, rand);
      const m = new Map(scored.map((c, i) => [c, sh[i]]));
      if (lift(d.cells, d.hits, (c) => m.get(c), thr).lift >= obs.lift) ge++;
      used++;
    }
  }
  return { ...obs, near, p: used ? (ge + 1) / (used + 1) : NaN, perm: used, mode };
}
function mergeNear(list, hoursPerDay, nPerDay, radii) {
  const out = {};
  const H = hoursPerDay.reduce((a, b) => a + b, 0);
  const N = nPerDay.reduce((a, b) => a + b, 0);
  for (const r of radii) {
    let h = 0, n = 0;
    list.forEach((x, i) => { if (Number.isFinite(x[r].pctHours)) h += (x[r].pctHours / 100) * hoursPerDay[i]; if (Number.isFinite(x[r].pctPos)) n += (x[r].pctPos / 100) * nPerDay[i]; });
    out[r] = { pctHours: H ? (100 * h) / H : NaN, pctPos: N ? (100 * n) / N : NaN };
  }
  return out;
}

/** Điểm nhóm loài tại ô = max sp[loài] trong nhóm; không loài nào có mặt → undefined. */
export function groupScore(species) {
  return (c) => {
    let m;
    for (const s of species) { const v = c.sp?.[s]; if (typeof v === "number" && (m === undefined || v > m)) m = v; }
    return m;
  };
}

/** Chạy toàn bộ: trả báo cáo {overall, byGear, bySpecies, meta}. */
export function run({ forecasts, positions, threshold = 50, perm = 200, radii = [5, 50], gearMap = DEFAULT_GEAR_MAP, seed = 7 }) {
  const rand = rng(seed);
  // ghép ngày: nhiều dự báo → vị trí ngày d dùng dự báo cùng ngày; không khớp → bỏ (đếm).
  const byDate = new Map(forecasts.map((f) => [f.date, f]));
  const single = forecasts.length === 1;
  let unmatched = 0, dropped = 0;
  const days = [];
  const grouped = new Map();
  for (const p of positions) {
    const f = single ? forecasts[0] : byDate.get(p.date);
    if (!f) { unmatched++; continue; }
    if (!grouped.has(f)) grouped.set(f, []);
    grouped.get(f).push(p);
  }
  for (const [f, ps] of grouped) {
    const step = inferStep(f.cells);
    const grid = indexGrid(f.cells, step);
    const a = attach(ps, grid);
    dropped += a.dropped;
    days.push({ date: f.date, cells: f.cells, grid, hits: a.hits, step });
  }
  const usedHits = days.reduce((s, d) => s + d.hits.length, 0);
  const meta = { forecasts: forecasts.length, positions: positions.length, unmatchedDate: unmatched, outsideGrid: dropped, used: usedHits, threshold, perm, step: days[0]?.step ?? null, radii };
  const sub = (filter) => days.map((d) => ({ ...d, hits: d.hits.filter(filter) }));
  const overall = evaluate(days, (c) => c.s, threshold, perm, rand, radii);
  const byGear = {};
  const gears = [...new Set(positions.map((p) => p.gear).filter(Boolean))].sort();
  for (const g of gears) {
    const sp = gearMap[g];
    const d = sub((h) => h.pos.gear === g);
    const hours = d.reduce((s, x) => s + x.hits.reduce((t, h) => t + h.pos.hours, 0), 0);
    byGear[g] = { hours, species: sp ?? null, all: evaluate(d, (c) => c.s, threshold, perm, rand, radii), target: sp ? evaluate(d, groupScore(sp), threshold, perm, rand, radii) : null };
  }
  const bySpecies = {};
  const allSpecies = [...new Set(Object.values(gearMap).flat())];
  for (const s of allSpecies) {
    const gearsFor = Object.entries(gearMap).filter(([, v]) => v.includes(s)).map(([g]) => g);
    const d = sub((h) => gearsFor.includes(h.pos.gear));
    const hours = d.reduce((t, x) => t + x.hits.reduce((u, h) => u + h.pos.hours, 0), 0);
    if (!hours) continue;
    bySpecies[s] = { gears: gearsFor, hours, ...evaluate(d, groupScore([s]), threshold, perm, rand, radii) };
  }
  return { meta, overall, byGear, bySpecies };
}

export function format(rep) {
  const L = [];
  const m = rep.meta;
  L.push(`# Kiểm định vị trí đánh bắt — ${m.forecasts} dự báo · ${m.positions} dòng vị trí · dùng ${m.used} (ngoài lưới ${m.outsideGrid}, lệch ngày ${m.unmatchedDate}) · bước ${m.step}° · ngưỡng ≥${m.threshold} · hoán vị ${m.perm}`);
  const row = (name, e) => {
    if (!e) return;
    const near = m.radii.map((r) => `≤${r}km ${fmt(e.near?.[r]?.pctHours)}%h/${fmt(e.near?.[r]?.pctPos)}%vt`).join(" · ");
    L.push(`${name.padEnd(28)} lift ${fmt(e.lift, 2).padStart(6)}  p ${fmt(e.p, 3).padStart(6)}  ô nóng ${e.hotCells}/${e.totalCells}  giờ nóng ${fmt(e.hotHours, 1)}/${fmt(e.totalHours, 1)}  ${near}  [${e.mode}]`);
  };
  L.push("## Tổng (điểm s mọi loài)");
  row("tổng", rep.overall);
  L.push("## Theo nghề — `all`: điểm s; `target`: max điểm nhóm loài mục tiêu của nghề");
  for (const [g, e] of Object.entries(rep.byGear)) {
    row(`${g} all (${fmt(e.hours, 0)}h)`, e.all);
    if (e.target) row(`${g} target`, e.target);
    else L.push(`${g.padEnd(28)} (không có trong bảng nghề→loài; chỉ tính tổng)`);
  }
  L.push("## Theo loài — giờ của các nghề nhắm loài đó, điểm sp[loài]");
  const absent = [];
  for (const [s, e] of Object.entries(rep.bySpecies).sort((a, b) => (b[1].lift || 0) - (a[1].lift || 0))) {
    if (Number.isFinite(e.lift)) row(`${s} (${e.gears.length} nghề, ${fmt(e.hours, 0)}h)`, e);
    else absent.push(s);
  }
  if (absent.length) L.push(`(không có trong payload hôm nay / không ô nào ≥ ngưỡng: ${absent.join(", ")})`);
  L.push("Đọc: lift > 1,5 và p < 0,05 = dự báo phân biệt được chỗ tàu đánh bắt; lift ≈ 1 = không hơn ngẫu nhiên; lift < 1 = ngược. Giờ AIS ≠ sản lượng; tàu < 15 m không có AIS/VMS — bẫy đọc ở docs/app-map/ops/fish-validate-positions.md §4.");
  return L.join("\n");
}
function fmt(v, d = 1) { return Number.isFinite(v) ? v.toFixed(d) : "—"; }

// ---------- nạp dự báo: file JSON, danh sách phẩy, hoặc thư mục ----------
export function loadForecasts(spec) {
  const files = [];
  for (const part of spec.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p)) if (f.endsWith(".json")) files.push(join(p, f));
    } else {
      files.push(p);
    }
  }
  const out = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(f, "utf8"));
    const payload = j.cells ? j : j.forecast?.cells ? j.forecast : null;
    if (!payload) throw new Error(`${f}: không thấy cells`);
    if (!Array.isArray(payload.cells) || !payload.cells.length) throw new Error(`${f}: cells trống`);
    for (const c of payload.cells.slice(0, 3)) if (typeof c.lat !== "number" || typeof c.lon !== "number" || typeof c.s !== "number") throw new Error(`${f}: cell thiếu lat/lon/s`);
    out.push({ date: payload.date ?? f, cells: payload.cells, file: f });
  }
  if (!out.length) throw new Error("không có file dự báo nào");
  return out;
}

// ---------- selftest: dữ liệu giả, không đụng src/ ----------
function selftest() {
  const fails = [];
  const check = (name, ok, info = "") => { (ok ? console.log : console.error)(`${ok ? "PASS" : "FAIL"} ${name} ${info}`); if (!ok) fails.push(name); };
  const rand = rng(42);
  // lưới 12×12 ô 0,25° quanh 10–13°N 108–111°E, điểm ngẫu nhiên, ~25% ô ≥50
  const mk = (seedOff) => {
    const r = rng(100 + seedOff);
    const cells = [];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const s = Math.round(r() * 100);
      cells.push({ lat: 10.125 + i * 0.25, lon: 108.125 + j * 0.25, s, sp: { "ngừ vằn": s, "cá mối": Math.round(r() * 100) } });
    }
    return cells;
  };
  const cells = mk(0);
  check("inferStep", Math.abs(inferStep(cells) - 0.25) < 1e-9, inferStep(cells));
  // (a) vị trí dồn vào ô nóng: 80% giờ rơi vào ô s≥50 (chiếm ~50% ô) → lift ≈ 1,6, p nhỏ
  const hot = cells.filter((c) => c.s >= 50), cold = cells.filter((c) => c.s < 50);
  const posA = [];
  for (let k = 0; k < 600; k++) {
    const c = rand() < 0.8 ? hot[Math.floor(rand() * hot.length)] : cold[Math.floor(rand() * cold.length)];
    posA.push({ lat: c.lat + (rand() - 0.5) * 0.04, lon: c.lon + (rand() - 0.5) * 0.04, hours: 1 + rand() * 3, gear: "tuna_purse_seines", date: "2024-10-01" });
  }
  const repA = run({ forecasts: [{ date: "2024-10-01", cells }], positions: posA, perm: 200, seed: 1 });
  check("lift>1.3 khi dồn ô nóng", repA.overall.lift > 1.3, `lift=${repA.overall.lift.toFixed(2)} share ô nóng=${(hot.length / cells.length).toFixed(2)}`);
  check("p<0.05 khi dồn ô nóng", repA.overall.p < 0.05, `p=${repA.overall.p}`);
  check("≤5km ≥ 70% giờ", repA.overall.near[5].pctHours >= 70, repA.overall.near[5].pctHours.toFixed(1));
  check("theo nghề có target", repA.byGear.tuna_purse_seines?.target?.lift > 1.3, repA.byGear.tuna_purse_seines?.target?.lift);
  check("theo loài ngừ vằn", repA.bySpecies["ngừ vằn"]?.lift > 1.3, repA.bySpecies["ngừ vằn"]?.lift);
  check("không gán cá mối cho vây", repA.bySpecies["cá mối"] === undefined);
  // (b) vị trí đều → lift ≈ 1, p lớn
  const posB = cells.flatMap((c) => [{ lat: c.lat, lon: c.lon, hours: 2, gear: "trawlers", date: "2024-10-01" }]);
  const repB = run({ forecasts: [{ date: "2024-10-01", cells }], positions: posB, perm: 200, seed: 2 });
  check("lift≈1 khi đều", Math.abs(repB.overall.lift - 1) < 1e-9, repB.overall.lift);
  check("p≥0.05 khi đều", !(repB.overall.p < 0.05), `p=${repB.overall.p}`);
  // (c) hoán vị ngày: 4 ngày, mỗi ngày lưới khác, vị trí dồn đúng ngày → p nhỏ; ghép lệch ngày → lift giảm
  const days = [0, 1, 2, 3].map((k) => ({ date: `2024-10-0${k + 1}`, cells: mk(k + 1) }));
  const posC = [];
  for (const d of days) {
    const h = d.cells.filter((c) => c.s >= 50);
    for (let k = 0; k < 200; k++) { const c = h[Math.floor(rand() * h.length)]; posC.push({ lat: c.lat, lon: c.lon, hours: 1, gear: "drifting_longlines", date: d.date }); }
  }
  const repC = run({ forecasts: days, positions: posC, perm: 200, seed: 3 });
  check("hoán vị ngày: mode", repC.overall.mode.startsWith("hoán vị ngày"), repC.overall.mode);
  check("hoán vị ngày: p<0.05", repC.overall.p < 0.05, `lift=${repC.overall.lift.toFixed(2)} p=${repC.overall.p}`);
  // (d) parse CSV GFW: góc dưới-trái → tâm; lọc flag; ngoài lưới bị đếm
  const csv = "date,cell_ll_lat,cell_ll_lon,flag,geartype,hours,fishing_hours,mmsi_present\n2024-10-01,10.12,108.12,VNM,trawlers,5,2.5,1\n2024-10-01,10.12,108.12,CHN,trawlers,5,2.5,1\n2024-10-01,0.5,100.5,VNM,trawlers,5,1,1\n2024-10-01,10.5,108.5,VNM,trawlers,5,0,1\n";
  const pp = parsePositions(csv, { flag: "VNM" });
  check("parse GFW: lọc flag + bỏ 0 giờ", pp.length === 2 && Math.abs(pp[0].lat - 10.125) < 1e-9 && pp[0].hours === 2.5, JSON.stringify(pp[0]));
  const repD = run({ forecasts: [{ date: "2024-10-01", cells }], positions: pp, perm: 10 });
  check("đếm vị trí ngoài lưới", repD.meta.outsideGrid === 1 && repD.meta.used === 1, JSON.stringify(repD.meta));
  // (e) thiếu dữ liệu → NaN có kiểm soát, không ném
  const repE = run({ forecasts: [{ date: "x", cells }], positions: [], perm: 10 });
  check("rỗng → NaN, không crash", Number.isNaN(repE.overall.lift) && Number.isNaN(repE.overall.p));
  console.log(format(repA).split("\n").slice(0, 4).join("\n"));
  if (fails.length) { console.error(`\n${fails.length} ca đỏ: ${fails.join(", ")}`); process.exit(1); }
  console.log("\nselftest xanh");
}

// ---------- CLI ----------
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("fish-validate-positions.mjs")) {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i];
  if (a.selftest) selftest();
  else if (!a.forecast || !a.positions) { console.error("cần --forecast <json|dir> --positions <csv>   (hoặc --selftest)"); process.exit(2); }
  else {
    try {
      const forecasts = loadForecasts(a.forecast);
      const positions = parsePositions(readFileSync(a.positions, "utf8"), { flag: a.flag, minHours: a["min-hours"] ? +a["min-hours"] : 0 });
      const gearMap = a["gear-map"] ? JSON.parse(readFileSync(a["gear-map"], "utf8")) : DEFAULT_GEAR_MAP;
      const rep = run({ forecasts, positions, threshold: a.threshold ? +a.threshold : 50, perm: a.perm ? Math.max(200, +a.perm) : 200, radii: (a.radius ?? "5,50").split(",").map(Number), gearMap, seed: a.seed ? +a.seed : 7 });
      console.log(format(rep));
      if (a.json) writeFileSync(a.json, JSON.stringify(rep, null, 2));
    } catch (e) {
      console.error("LỖI:", e.message);
      process.exit(1);
    }
  }
}
