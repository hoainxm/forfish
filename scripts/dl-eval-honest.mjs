// scripts/dl-eval-honest.mjs — BỘ ĐO TRUNG THỰC (đợt 1 của docs/app-map/ops/fish-train-review-2026-10-18).
// Chạy qua dl-eval-fleet.mjs --honest (dùng lại đúng lưới vệ tinh cache, nhãn, lưới giữ-tháng-ra của nó):
//   npx tsx scripts/dl-eval-fleet.mjs --honest --grids <fc-full/grids> --labels <dl-trk0809/labels-vh> \
//        --fleet-dir <fleet> --catch-dir <catch> --out <thư mục> [--boot 500]
// KHÔNG đổi mô hình, KHÔNG đổi hồ sơ loài: chỉ thêm thước đo + baseline + phép kiểm rò + bootstrap.
//
//  1.1 AUCeff TRONG-NGHỀ  Σ_g w_g·AUC(pos_{s,g}, neg_g) + n_eff Kish + TB macro (cạnh AUCeff cũ)
//  1.2 baseline cùng đường chấm: x-sản-lượng thuần · x-đội-tàu thuần · tĩnh (sâu+bờ+vĩ, fit tháng kia)
//      · khí hậu mô hình (TB tháng của điểm, bỏ biến động ngày) · ngẫu nhiên mượt 3×3 · HEAD không kênh
//  1.3 4 phép kiểm rò: cách ≥2 tháng · tách theo tàu (2 nửa băm) · M−1 · triệt tiêu năng suất tàu
//  1.4 bootstrap khối 7 ngày (B=500) trên histogram theo khối: CI 90 % từng số + CI CHÊNH CẶP
//  1.6 bảng CPUE (kg/giờ nhóm nghề) theo bậc điểm 0–24 / 25–49 / 50–74 / ≥75
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFishForecast, nearestIndex, coastDistanceKm } from "../src/lib/fish-predict.ts";
import { fleetPresenceLookup } from "../src/lib/fleet-effort.ts";
import { attachDay, ASFIS_TO_SHORT, NB, recLen, recMetrics, kishNeff, blockResamples, ci90, makeRng } from "./dl-eval.mjs";
import { halfOfBucket } from "./vessel-bucket.mjs";
import { makeBase } from "./fish-base-fit.mjs";

export const BLOCK_DAYS = 7;
export const TIERS = [[0, 24], [25, 49], [50, 74], [75, 100]];
const pad2 = (n) => String(n).padStart(2, "0");
const moy = (ym) => Number(ym.slice(5, 7));
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const f3s = (x) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(3) : "—");

/** Xếp hạng phân vị 0..100 (nguyên), ô bằng nhau chung điểm. */
export function pctRank(values) {
  const n = values.length;
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const r = n > 1 ? (i + j) / 2 / (n - 1) : 0.5;
    for (let k = i; k <= j; k++) out[idx[k]] = Math.round(100 * r);
    i = j + 1;
  }
  return out;
}

/** Lưới chỉ giữ tháng `ym` (để dùng làm "tháng trước") */
export function monthOnly(g, ym) {
  if (!g?.effort?.[ym]) return null;
  return { ...g, months: [ym], days: { [ym]: g.days[ym] }, effort: { [ym]: g.effort[ym] } };
}

/**
 * Lưới GIẢ cho tháng `month`: gộp các tháng cách nó 2–3 tháng (vòng tròn năm), BỎ M−1, M, M+1.
 * (Cửa sổ vụ của fleetPresenceGrid chỉ đọc M−1,M,M+1 ⇒ bỏ ±1 theo đúng nghĩa đen ra lưới rỗng = HEAD,
 * vô nghĩa. Ở đây gắn nhãn lại các tháng xa thành "tháng M" để đo: lưới từ mùa khác còn nâng điểm không?)
 */
export function distantMonthsGrid(g, month, dists = [2, 3]) {
  const use = g.months.filter((ym) => {
    const d = Math.abs(moy(ym) - month);
    return dists.includes(Math.min(d, 12 - d));
  });
  if (!use.length) return null;
  const ym0 = `2000-${pad2(month)}`;
  const { nLon } = g.axis;
  const eff = {};
  let days = 0;
  for (const ym of use) {
    days += g.days[ym] ?? 30;
    for (const [gear, arr] of Object.entries(g.effort[ym] ?? {})) {
      const m = (eff[gear] ??= new Map());
      for (const [i, j, v] of arr) m.set(i * nLon + j, (m.get(i * nLon + j) ?? 0) + v);
    }
  }
  const effort = Object.fromEntries(Object.entries(eff).map(([gear, m]) => [gear, [...m].map(([k, v]) => [Math.floor(k / nLon), k % nLon, v])]));
  return { ...g, months: [ym0], days: { [ym0]: days }, effort: { [ym0]: effort }, usedMonths: use };
}

export async function runHonest(ctx) {
  const { inputs, depth, climo, reef, heldOut, catchHeld, catchFull, fullGrid, effD, catD, SPECIES, tg, OUT, FLEET_DIR, CATCH_DIR, B } = ctx;
  const t0 = Date.now();
  const log = (m) => console.error(`[honest ${Math.round((Date.now() - t0) / 1000)}s] ${m}`);
  if (!catchHeld) { console.error("--honest cần --catch-dir"); process.exit(2); }

  /* ── ngày + lưới ô ── */
  const gIndex = new Map();
  const days = inputs.map((x, di) => {
    const cells = [];
    for (let i = 0; i < x.sst.lats.length; i++)
      for (let k = 0; k < x.sst.lons.length; k++)
        if (Number.isFinite(x.sst.values[i][k])) cells.push({ lat: Math.round(x.sst.lats[i] * 100) / 100, lon: Math.round(x.sst.lons[k] * 100) / 100, sp: {} });
    const keys = cells.map((c) => `${c.lat},${c.lon}`);
    const g = Int32Array.from(keys, (k) => gIndex.get(k) ?? (gIndex.set(k, gIndex.size), gIndex.size - 1));
    return { x, d: x.d, ym: x.d.slice(0, 7), month: Number(x.d.slice(5, 7)), block: Math.floor(di / BLOCK_DAYS), cells, keys, g, idxByKey: new Map(keys.map((k, i) => [k, i])) };
  });
  const nBlocks = days[days.length - 1].block + 1;
  const hasVh = [...effD.values()][0]?.[0]?.vh !== undefined;
  log(`${days.length} ngày · ${nBlocks} khối ${BLOCK_DAYS} ngày · ${gIndex.size} ô · nhãn ${hasVh ? "CÓ" : "KHÔNG có"} cột vh`);

  /* ── nhãn theo ngày × loài × nghề ── */
  // --trust-col <tên cột> (nhãn v2): nhân kg mỗi dòng với trọng số tin cậy của chuyến; mặc định không có cột = 1
  const TRUST = process.argv.includes("--trust-col") ? process.argv[process.argv.indexOf("--trust-col") + 1] : null;
  function labelPrep(day, half) {
    let eff = effD.get(day.d) ?? [], cat = catD.get(day.d) ?? [];
    if (TRUST) cat = cat.map((r) => ({ ...r, kg: +r.kg * (Number.isFinite(+r[TRUST]) && r[TRUST] !== "" ? +r[TRUST] : 1) }));
    if (half) { eff = eff.filter((r) => halfOfBucket(r.vh) === half); cat = cat.filter((r) => halfOfBucket(r.vh) === half); }
    const lab = attachDay(day.cells, eff, cat, ASFIS_TO_SHORT);
    const cellIdx = new Map(day.cells.map((c, i) => [c, i]));
    const per = {};
    for (const s of SPECIES) {
      const gi = new Map(tg[s].map((g, i) => [g, i]));
      const pos = [], neg = [];
      for (const [c, m] of lab.kgG) for (const [g, kg] of Object.entries(m[s] ?? {})) if (kg > 0) pos.push([cellIdx.get(c), kg, gi.get(g) ?? -1]);
      for (const [c, m] of lab.eff) for (const g of tg[s]) if (m[g] > 0) neg.push([cellIdx.get(c), m[g], gi.get(g)]);
      per[s] = { pos, neg };
    }
    return per;
  }
  const prepAll = days.map((d) => labelPrep(d, null));
  let prepHalf = null;
  const needHalf = () => (prepHalf ??= { A: days.map((d) => labelPrep(d, "A")), B: days.map((d) => labelPrep(d, "B")) });

  /* n_eff Kish theo ô-ngày + phần kg của 1 % ô-ngày lớn nhất, từng loài */
  const nEff = {}, top1 = {};
  for (const s of SPECIES) {
    const tot = [];
    days.forEach((d, di) => {
      const m = new Map();
      for (const [i, kg] of prepAll[di][s].pos) m.set(i, (m.get(i) ?? 0) + kg);
      tot.push(...m.values());
    });
    nEff[s] = kishNeff(tot);
    tot.sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(tot.length * 0.01)), all = tot.reduce((a, b) => a + b, 0);
    top1[s] = all > 0 ? tot.slice(0, k).reduce((a, b) => a + b, 0) / all : NaN;
  }
  const MACRO = SPECIES.filter((s) => nEff[s] >= 200);
  log(`n_eff≥200: ${MACRO.length}/${SPECIES.length} loài`);

  /* ── tích luỹ histogram theo khối ── */
  const newBlocks = () => Array.from({ length: nBlocks }, () => Object.fromEntries(SPECIES.map((s) => [s, new Float64Array(recLen(tg[s].length))])));
  function accumulate(blocks, day, per, scores) {
    const n = day.cells.length;
    for (const s of SPECIES) {
      const sc = scores[s];
      if (!sc) continue;
      const R = blocks[day.block][s], P = per[s];
      for (const [i, kg, gi] of P.pos) { const v = sc[i]; R[v] += kg; if (gi >= 0) R[(2 + 2 * gi) * NB + v] += kg; }
      for (const [i, h, gi] of P.neg) R[(3 + 2 * gi) * NB + sc[i]] += h;
      if (P.pos.length) for (let i = 0; i < n; i++) R[NB + sc[i]] += 1;
    }
  }

  /* ── các nguồn điểm ── */
  const blank = (day) => Object.fromEntries(SPECIES.map((s) => [s, new Uint8Array(day.cells.length)]));
  function modelScores(day, extra) {
    const x = day.x;
    const fc = buildFishForecast(x.sst, x.chl, x.sla, day.month, { anom: x.anom, depth, climo, reef, frontSstFine: x.sstFine, frontChlFine: x.chlFine, ...extra });
    const out = blank(day);
    for (const c of fc.cells) {
      const i = day.idxByKey.get(`${c.lat},${c.lon}`);
      if (i === undefined) continue;
      for (const [s, v] of Object.entries(c.sp ?? {})) if (out[s]) out[s][i] = Math.max(0, Math.min(100, Math.round(v)));
    }
    return out;
  }
  function xScores(day, grid, full) {
    const out = blank(day);
    if (!grid) return out;
    const look = fleetPresenceLookup(grid, day.month, full);
    for (const s of SPECIES) day.cells.forEach((c, i) => { out[s][i] = Math.round(100 * look(s, c.lat, c.lon)); });
    return out;
  }
  const rawHours30 = (x, full) => (x > 0 ? -Math.log1p(-Math.min(x, 1 - 1e-12)) * full : 0);
  const prevYm = (ym) => (moy(ym) === 1 ? `${+ym.slice(0, 4) - 1}-12` : `${ym.slice(0, 4)}-${pad2(moy(ym) - 1)}`);

  // tĩnh: sâu + cách bờ + vĩ độ
  const coastGrid = coastDistanceKm(depth, 700);
  const featCache = new Map();
  const feat = (key, lat, lon) => {
    let f = featCache.get(key);
    if (!f) {
      const di = nearestIndex(depth.lats, lat), dj = nearestIndex(depth.lons, lon);
      const dv = depth.values[di]?.[dj], cv = coastGrid[di]?.[dj];
      f = { depth: Number.isFinite(dv) ? dv : NaN, coast: Number.isFinite(cv) ? cv : 700, lat };
      featCache.set(key, f);
    }
    return f;
  };
  const EDGES = { depth: [0, 20, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 6000, Infinity], coast: [0, 5, 10, 20, 40, 80, 160, 320, 640, Infinity] };
  const binOf = (v, e) => { if (!Number.isFinite(v)) return -1; for (let i = 0; i + 1 < e.length; i++) if (v >= e[i] && v < e[i + 1]) return i; return -1; };
  const featBins = (f) => [binOf(f.depth, EDGES.depth), binOf(f.coast, EDGES.coast), Math.floor(f.lat)];
  const NBIN = [EDGES.depth.length - 1, EDGES.coast.length - 1, 40];
  function fitStatic(trainIdx) {
    const out = {};
    for (const s of SPECIES) {
      const kg = NBIN.map((n) => new Float64Array(n)), h = NBIN.map((n) => new Float64Array(n));
      let K = 0, H = 0;
      for (const di of trainIdx) {
        const day = days[di];
        const bins = day.cells.map((c, i) => featBins(feat(day.keys[i], c.lat, c.lon)));
        for (const [i, w] of prepAll[di][s].pos) { K += w; bins[i].forEach((b, f) => { if (b >= 0) kg[f][b] += w; }); }
        for (const [i, w] of prepAll[di][s].neg) { H += w; bins[i].forEach((b, f) => { if (b >= 0) h[f][b] += w; }); }
      }
      const c0 = H > 0 ? K / H : 0, PH = 50;
      out[s] = NBIN.map((n, f) => Float64Array.from({ length: n }, (_, b) => (c0 > 0 ? Math.log(((kg[f][b] + c0 * PH) / (h[f][b] + PH)) / c0) : 0)));
    }
    return out;
  }
  const monthDays = (ym) => days.map((d, i) => (d.ym === ym ? i : -1)).filter((i) => i >= 0);
  const staticFit = {};
  const months = [...new Set(days.map((d) => d.ym))];
  for (const ym of months) staticFit[ym] = fitStatic(days.map((d, i) => (d.ym !== ym ? i : -1)).filter((i) => i >= 0));
  function staticScores(day) {
    const out = blank(day);
    const bins = day.cells.map((c, i) => featBins(feat(day.keys[i], c.lat, c.lon)));
    for (const s of SPECIES) {
      const L = staticFit[day.ym][s];
      out[s] = pctRank(bins.map((b) => b.reduce((a, bi, f) => a + (bi >= 0 ? L[f][bi] : 0), 0)));
    }
    return out;
  }

  // ngẫu nhiên mượt 3×3 (cùng nhân với kênh x), mỗi ngày một trường riêng
  const rnd = makeRng(20261018);
  const KERN = [[0, 0, 2], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 0.5], [-1, 1, 0.5], [1, -1, 0.5], [1, 1, 0.5]];
  function randScores(day) {
    const lats = [...new Set(day.cells.map((c) => c.lat))].sort((a, b) => a - b), lons = [...new Set(day.cells.map((c) => c.lon))].sort((a, b) => a - b);
    const field = Array.from({ length: lats.length }, () => Float64Array.from({ length: lons.length }, rnd));
    const li = new Map(lats.map((v, i) => [v, i])), lj = new Map(lons.map((v, i) => [v, i]));
    const sm = day.cells.map((c) => {
      const i = li.get(c.lat), j = lj.get(c.lon);
      let a = 0, w = 0;
      for (const [di, dj, k] of KERN) { const v = field[i + di]?.[j + dj]; if (v !== undefined) { a += k * v; w += k; } }
      return a / w;
    });
    const sc = pctRank(sm), out = blank(day);
    for (const s of SPECIES) out[s] = sc;
    return out;
  }

  // khí hậu: TB tháng của điểm mô hình (mọi ngày cùng tháng), bỏ biến động ngày
  function climSums(extra) {
    const sums = {}; // ym → s → {sum: Float64Array(gN), n}
    for (const day of days) {
      const sc = modelScores(day, extra(day));
      const m = (sums[day.ym] ??= { n: 0, sp: Object.fromEntries(SPECIES.map((s) => [s, new Float64Array(gIndex.size)])) });
      m.n++;
      for (const s of SPECIES) for (let i = 0; i < day.g.length; i++) m.sp[s][day.g[i]] += sc[s][i];
    }
    return sums;
  }
  const climScore = (sums) => (day) => {
    const m = sums[day.ym], out = blank(day);
    for (const s of SPECIES) for (let i = 0; i < day.g.length; i++) out[s][i] = Math.round(m.sp[s][day.g[i]] / m.n);
    return out;
  };

  /* ── danh sách cấu hình ── */
  const results = {};
  function run(key, name, scoreFn, note = "") {
    const t = Date.now();
    const blocks = newBlocks();
    let hot = 0, tot = 0;
    days.forEach((day, di) => {
      const sc = scoreFn(day);
      accumulate(blocks, day, prepAll[di], sc);
      for (const s of SPECIES) if (prepAll[di][s].pos.length || prepAll[di][s].neg.length) { let h = 0; const a = sc[s]; for (let i = 0; i < a.length; i++) if (a[i] >= 50) h++; hot += h; tot += a.length; }
    });
    results[key] = { name, note, blocks, hotShare: tot ? hot / tot : NaN };
    log(`${key}: ${name} (${Math.round((Date.now() - t) / 1000)}s)`);
  }
  const Fh = (d) => heldOut[d.ym], Ch = (d) => catchHeld[d.ym];
  run("head", "HEAD — không kênh", (d) => modelScores(d, {}));
  run("fleet", "đội tàu (giữ-tháng-ra)", (d) => modelScores(d, { fleet: Fh(d) }));
  run("catch", "sản lượng, không đội tàu", (d) => modelScores(d, { catchGrid: Ch(d) }));
  run("prod", "đội tàu + sản lượng (bản chốt 0,736)", (d) => modelScores(d, { fleet: Fh(d), catchGrid: Ch(d) }));
  // baseline 1.2
  run("x_catch", "x-sản-lượng thuần (tháng kề)", (d) => xScores(d, Ch(d), 8000), "score = 100·x lưới sản lượng giữ-tháng-ra");
  run("x_fleet", "x-đội-tàu thuần (tháng kề)", (d) => xScores(d, Fh(d), 60), "score = 100·x lưới đội tàu giữ-tháng-ra");
  run("static", "tĩnh: sâu+bờ+vĩ (fit tháng kia)", staticScores, "bảng lift CPUE theo 3 biến, fit trên tháng còn lại");
  const cHead = climSums(() => ({})), cProd = climSums((d) => ({ fleet: Fh(d), catchGrid: Ch(d) }));
  run("clim_head", "khí hậu của HEAD (TB tháng)", climScore(cHead));
  run("clim_prod", "khí hậu của bản chốt (TB tháng)", climScore(cProd));
  run("rand", "ngẫu nhiên mượt 3×3", randScores, "sanity: kỳ vọng ≈ 0,5");

  // 2A — NỀN "bãi cá theo mùa": x-sản-lượng (K_s riêng loài) + x-đội-tàu + tĩnh + mùa vụ, ≤5 hệ số/nhóm loài,
  // hệ số + bảng tĩnh fit trên tháng KHÁC tháng chấm, lưới x giữ-tháng-ra. Ngưỡng "nóng" (điểm ≥50) hiệu chỉnh theo
  // tỉ lệ ô ≥50 của bản chốt (đơn điệu ⇒ không đổi AUC; chỉ để cổng iii so được).
  const BASE = makeBase({ days, prepAll, SPECIES, feat, heldOut, catchHeld, catchFull, fleetOnly: process.argv.includes("--fleet-only") ? process.argv[process.argv.indexOf("--fleet-only") + 1].split(",").filter(Boolean) : [] });
  const HOT = results.prod.hotShare;
  log(`2A: ngưỡng nóng = tỉ lệ ô ≥50 của bản chốt = ${(100 * HOT).toFixed(1)} %`);
  run("xc_ks", "x-sản-lượng K_s theo loài (thuần)", (d) => BASE.xcScores(d), "như x_catch nhưng K_s = trung vị kg ô dương của loài thay vì 8000");
  run("base_irls", "NỀN 2A — logistic ≤5 hệ số/nhóm", (d) => BASE.scoreDay(d, "irls", HOT), "xc(K_s)+xf+stat+mùa, IRLS use-availability fit trên tháng kia");
  run("base_rank", "NỀN 2A — rank-combine (0 hệ số)", (d) => BASE.scoreDay(d, "rank", HOT), "cộng hạng phân vị xc, xf, stat");
  // production mới (đợt 2A nối nền): buildFishForecast thật với extra.base — nền + cổng nhiệt + lịch mùa vụ; HSI ra hint
  const HOT2 = Number(process.env.HOT2 ?? HOT);
  const baseP = (d, same = true) => BASE.paramsFor(d.ym, HOT2, "irls", same);
  run("prod2", "PRODUCTION MỚI — nền + cổng nhiệt + mùa vụ", (d) => modelScores(d, { fleet: Fh(d), catchGrid: Ch(d), base: baseP(d) }), `buildFishForecast thật, extra.base, hotShare ${HOT2}`);
  for (const [key, g] of [["prod2_nothermal", { thermal: false }], ["prod2_listgate", { season: true }]])
    run(key, `production mới, ${key === "prod2_listgate" ? "BẬT cổng lịch mùa vụ theo vùng" : "tắt cổng nhiệt"}`, (d) => modelScores(d, { fleet: Fh(d), catchGrid: Ch(d), base: baseP(d), baseGates: g }), "chẩn đoán: cổng nào làm mất AUC");
  run("prod2_fs", "production mới, tháng chưa có kg (fleet-static)", (d) => modelScores(d, { fleet: Fh(d), catchGrid: Ch(d), base: baseP(d, false) }), "catchSameMonth=false ⇒ đội tàu + tĩnh + mùa");
  run("base_irls_nc", "NỀN 2A — logistic, bỏ kênh sản lượng", (d) => BASE.scoreDay(d, "irls", HOT, { noCatch: true }), "chế độ tháng chưa có kg loài: đội tàu + tĩnh + mùa");
  // 1.3 (c) M−1
  const catchPrev = (d) => monthOnly(catchFull, prevYm(d.ym)), fleetPrev = (d) => monthOnly(fullGrid, prevYm(d.ym));
  if (catchFull) {
    run("m1_kg", "M−1: kg tháng trước (thuần)", (d) => xScores(d, catchPrev(d), 8000), "tháng 8 ← 7, tháng 9 ← 8; nhân quả, không dùng tương lai");
    run("m1_cpue", "M−1: kg/giờ tháng trước", (d) => {
      const kgL = fleetPresenceLookup(catchPrev(d), d.month, 1e6), hL = fleetPresenceLookup(fleetPrev(d), d.month, 1e6), out = blank(d);
      for (const s of SPECIES) {
        const v = d.cells.map((c) => { const k = rawHours30(kgL(s, c.lat, c.lon), 1e6), h = rawHours30(hL(s, c.lat, c.lon), 1e6); return k > 0 && h > 0 ? k / h : 0; });
        const pos = v.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0), r = pctRank(pos.map((i) => v[i]));
        pos.forEach((i, j) => { out[s][i] = 1 + Math.round(0.99 * r[j]); });
      }
      return out;
    }, "kg tháng trước ÷ giờ đánh của nghề mục tiêu tháng trước, xếp hạng phân vị");
    // 1.3 (a) cách ≥2 tháng
    const dist = (g) => (d) => distantMonthsGrid(g, d.month);
    const dC = dist(catchFull), dF = dist(fullGrid);
    run("leak1_prod", "rò#1 cách ≥2 tháng: đội tàu+sản lượng", (d) => modelScores(d, { fleet: dF(d), catchGrid: dC(d) }), "lưới từ các tháng cách 2–3 tháng (bỏ M−1,M,M+1), mọi tàu");
    run("leak1_xcatch", "rò#1 cách ≥2 tháng: x-sản-lượng thuần", (d) => xScores(d, dC(d), 8000));
  } else log("thiếu catch-full.json ⇒ bỏ M−1 và rò#1");

  // 1.3 (b) tách theo tàu: lưới nửa H (giữ-tháng-ra), nhãn nửa H (cùng tàu) vs nửa kia
  const halfGrid = (dir, stem) => Object.fromEntries(months.map((ym) => [ym, Object.fromEntries(["A", "B"].map((h) => { const f = join(dir, `${stem}-${ym}-${h}.json`); return [h, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null]; }))]));
  const fHalf = halfGrid(FLEET_DIR, "fleet-ex"), cHalf = halfGrid(CATCH_DIR, "catch-ex");
  const haveHalf = hasVh && months.every((ym) => ["A", "B"].every((h) => fHalf[ym][h] && cHalf[ym][h]));
  if (haveHalf) {
    const P = needHalf();
    for (const [key, name, same] of [["leak2_other", "rò#2 tách tàu: lưới nửa này → nhãn nửa KIA (tàu lạ)", false], ["leak2_same", "rò#2 đối chứng: lưới nửa này → nhãn nửa NÀY (tàu quen)", true]]) {
      const t = Date.now(), blocks = newBlocks();
      days.forEach((day, di) => {
        for (const h of ["A", "B"]) {
          const sc = modelScores(day, { fleet: fHalf[day.ym][h], catchGrid: cHalf[day.ym][h] });
          accumulate(blocks, day, P[same ? h : h === "A" ? "B" : "A"][di], sc);
        }
      });
      results[key] = { name, note: "đội tàu+sản lượng dựng từ MỘT nửa tàu (băm), giữ-tháng-ra", blocks };
      log(`${key} (${Math.round((Date.now() - t) / 1000)}s)`);
    }
    for (const mode of ["irls", "rank"]) for (const [sfx, same] of [["other", false], ["same", true]]) {
      const t = Date.now(), blocks = newBlocks();
      days.forEach((day, di) => {
        for (const h of ["A", "B"]) {
          const sc = BASE.scoreDay(day, mode, HOT, { src: { key: `${day.ym}-${h}`, fleet: fHalf[day.ym][h], catch: cHalf[day.ym][h] } });
          accumulate(blocks, day, P[same ? h : h === "A" ? "B" : "A"][di], sc);
        }
      });
      results[`base_${mode}_leak2_${sfx}`] = { name: `nền 2A (${mode}) rò#2: lưới nửa này → nhãn nửa ${same ? "NÀY (quen)" : "KIA (lạ)"}`, note: "hệ số + bảng tĩnh vẫn fit trên tháng kia, mọi tàu", blocks, hotShare: NaN };
      log(`base_${mode}_leak2_${sfx} (${Math.round((Date.now() - t) / 1000)}s)`);
    }
    // HEAD trên cùng tập nhãn đã là "head" (hai nửa cộng lại = toàn bộ)
  } else log(`thiếu lưới nửa tàu (fleet-ex-<tháng>-A/B, catch-ex-<tháng>-A/B) hoặc nhãn không có vh ⇒ bỏ rò#2`);

  // 1.3 (d) triệt tiêu năng suất tàu
  const nullHeld = Object.fromEntries(months.map((ym) => { const f = join(CATCH_DIR, `catch-null-ex-${ym}.json`); return [ym, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null]; }));
  if (months.every((ym) => nullHeld[ym])) {
    const Nh = (d) => nullHeld[d.ym];
    run("leak4_prod", "rò#4 triệt tiêu năng suất: đội tàu + sản lượng-null", (d) => modelScores(d, { fleet: Fh(d), catchGrid: Nh(d) }), "kg chuyến → trung vị kg/giờ (nghề×lớp dài) × giờ đánh; cơ cấu loài giữ, tổng kg chuẩn lại");
    run("leak4_catch", "rò#4: sản lượng-null, không đội tàu", (d) => modelScores(d, { catchGrid: Nh(d) }));
    run("leak4_xcatch", "rò#4: x-sản-lượng-null thuần", (d) => xScores(d, Nh(d), 8000));
  } else log("thiếu catch-null-ex-<tháng>.json ⇒ bỏ rò#4");

  /* ── thống kê + bootstrap khối ── */
  const keys = Object.keys(results);
  const G = Object.fromEntries(SPECIES.map((s) => [s, tg[s].length]));
  const sumRec = (blocks, idxs, s) => {
    const out = new Float64Array(recLen(G[s]));
    for (const b of idxs) { const r = blocks[b][s]; for (let i = 0; i < out.length; i++) out[i] += r[i]; }
    return out;
  };
  const wmean = (per, set, val, wt, need) => {
    let a = 0, w = 0;
    for (const s of set) { const m = per[s]; if (need.every((k) => Number.isFinite(m[k])) && m[wt] > 0) { a += m[val] * m[wt]; w += m[wt]; } }
    return w > 0 ? a / w : NaN;
  };
  const mean = (per, set, val) => { const v = set.map((s) => per[s][val]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  function summarize(blocks, idxs) {
    const per = {};
    for (const s of SPECIES) per[s] = recMetrics(sumRec(blocks, idxs, s), G[s]);
    return {
      per,
      kgOld: wmean(per, SPECIES, "eff", "kgAll", ["eff", "area"]),
      kgWithin: wmean(per, SPECIES, "within", "kgW", ["within"]),
      kgArea: wmean(per, SPECIES, "area", "kgAll", ["eff", "area"]),
      macroOld: mean(per, MACRO, "eff"),
      macroWithin: mean(per, MACRO, "within"),
    };
  }
  const STATS = ["kgOld", "kgWithin", "macroOld", "macroWithin", "kgArea"];
  const all = Array.from({ length: nBlocks }, (_, i) => i);
  const samples = blockResamples(nBlocks, B, 20261018);
  const point = {}, boot = {}, bootSp = {};
  for (const k of keys) {
    point[k] = summarize(results[k].blocks, all);
    boot[k] = Object.fromEntries(STATS.map((st) => [st, new Float64Array(B)]));
    bootSp[k] = Object.fromEntries(SPECIES.map((s) => [s, { eff: new Float64Array(B), within: new Float64Array(B) }]));
  }
  for (let r = 0; r < B; r++) {
    for (const k of keys) {
      const sm = summarize(results[k].blocks, samples[r]);
      for (const st of STATS) boot[k][st][r] = sm[st];
      for (const s of SPECIES) { bootSp[k][s].eff[r] = sm.per[s].eff; bootSp[k][s].within[r] = sm.per[s].within; }
    }
    if ((r + 1) % 100 === 0) log(`bootstrap ${r + 1}/${B}`);
  }
  const ciOf = (arr) => ci90(arr);
  const diffCi = (a, b, st) => ci90(Array.from(boot[a][st], (v, r) => v - boot[b][st][r]));
  const REFS = ["head", "prod", "x_catch", "static", "m1_cpue"].filter((k) => results[k]);

  /* ── bảng CPUE theo bậc điểm (1.6) ── */
  const tierStat = (blocks, idxs, set) => {
    const kg = TIERS.map(() => ({})), hr = TIERS.map(() => ({}));
    for (const s of set) {
      const rec = sumRec(blocks, idxs, s);
      for (let t = 0; t < TIERS.length; t++) {
        let K = 0, H = 0;
        for (let v = TIERS[t][0]; v <= TIERS[t][1]; v++) {
          K += rec[v];
          for (let k = 0; k < G[s]; k++) H += rec[(3 + 2 * k) * NB + v];
        }
        kg[t][s] = K; hr[t][s] = H;
      }
    }
    return { kg, hr };
  };
  const cpue = (ts, set) => TIERS.map((_, t) => { let K = 0, H = 0; for (const s of set) { K += ts.kg[t][s]; H += ts.hr[t][s]; } return H > 0 ? K / H : NaN; });
  const topSp = [...SPECIES].sort((a, b) => point.head.per[b].kgAll - point.head.per[a].kgAll);
  const tierOut = {};
  for (const k of ["head", "prod", "base_irls", "base_rank", "base_irls_nc", "prod2", "prod2_nothermal", "prod2_listgate", "prod2_fs"].filter((k) => results[k])) {
    const blocks = results[k].blocks, ts = tierStat(blocks, all, SPECIES);
    const rows = { pooled: { cpue: cpue(ts, SPECIES), kg: TIERS.map((_, t) => SPECIES.reduce((a, s) => a + ts.kg[t][s], 0)), hours: TIERS.map((_, t) => SPECIES.reduce((a, s) => a + ts.hr[t][s], 0)) } };
    for (const s of topSp.slice(0, 12)) rows[s] = { cpue: cpue(ts, [s]), kg: TIERS.map((_, t) => ts.kg[t][s]), hours: TIERS.map((_, t) => ts.hr[t][s]) };
    // CI của tỉ số bậc cao / bậc liền dưới
    const R = { pooled: TIERS.slice(1).map(() => new Float64Array(B)) };
    for (const s of topSp.slice(0, 12)) R[s] = TIERS.slice(1).map(() => new Float64Array(B));
    for (let r = 0; r < B; r++) {
      const tr = tierStat(blocks, samples[r], SPECIES);
      for (const nm of Object.keys(R)) {
        const c = cpue(tr, nm === "pooled" ? SPECIES : [nm]);
        for (let t = 1; t < TIERS.length; t++) R[nm][t - 1][r] = c[t] / c[t - 1];
      }
    }
    for (const nm of Object.keys(rows)) rows[nm].ratio = rows[nm].cpue.slice(1).map((c, t) => ({ r: c / rows[nm].cpue[t], ci: ci90(R[nm][t]) }));
    tierOut[k] = rows;
  }

  /* ── xuất ── */
  const json = {
    builtAt: new Date().toISOString(), days: days.length, blocks: nBlocks, B, species: SPECIES, macroSet: MACRO,
    nEff, top1pctShare: top1, targetGears: tg,
    configs: Object.fromEntries(keys.map((k) => [k, {
      name: results[k].name, note: results[k].note,
      point: Object.fromEntries(STATS.map((st) => [st, point[k][st]])),
      ci: Object.fromEntries(STATS.map((st) => [st, ciOf(boot[k][st])])),
      diff: Object.fromEntries(REFS.filter((r) => r !== k).map((r) => [r, Object.fromEntries(STATS.map((st) => [st, { d: point[k][st] - point[r][st], ci: diffCi(k, r, st) }]))])),
      species: Object.fromEntries(SPECIES.map((s) => [s, { eff: point[k].per[s].eff, within: point[k].per[s].within, area: point[k].per[s].area, kg: point[k].per[s].kgAll, effCi: ciOf(bootSp[k][s].eff), withinCi: ciOf(bootSp[k][s].within) }])),
    }])),
    speciesDiff: Object.fromEntries(["prod", "x_catch"].filter((k) => results[k]).map((k) => [k, Object.fromEntries(SPECIES.map((s) => [s, { vsHead: { within: ci90(Array.from(bootSp[k][s].within, (v, r) => v - bootSp.head[s].within[r])), eff: ci90(Array.from(bootSp[k][s].eff, (v, r) => v - bootSp.head[s].eff[r])) } }]))])),
    tiers: { TIERS, ...tierOut },
  };
  json.hotShare = Object.fromEntries(keys.map((k) => [k, results[k].hotShare]));
  writeFileSync(join(OUT, "honest-eval.json"), JSON.stringify(json, null, 1));
  writeFileSync(join(OUT, "fish-base-fit.json"), JSON.stringify(BASE.exportFit(HOT, process.env.BASE_MODE || "irls")));

  /* ── in markdown ── */
  const cell = (k, st) => `${f3(json.configs[k].point[st])} [${f3(json.configs[k].ci[st][0])}–${f3(json.configs[k].ci[st][1])}]`;
  console.log(`\n## Bảng A — mọi cấu hình (${days.length} ngày, ${nBlocks} khối ${BLOCK_DAYS} ngày, B=${B}; [CI 90 %])\n`);
  console.log("| cấu hình | AUCeff cũ (TB kg) | AUCeff TRONG-NGHỀ (TB kg) | TRONG-NGHỀ macro (n_eff≥200) | cũ macro | AUCarea (TB kg) |\n|---|---|---|---|---|---|");
  for (const k of keys) console.log(`| ${results[k].name} | ${cell(k, "kgOld")} | ${cell(k, "kgWithin")} | ${cell(k, "macroWithin")} | ${cell(k, "macroOld")} | ${cell(k, "kgArea")} |`);
  console.log(`\n## Bảng B — CHÊNH CẶP (CI 90 % cùng mẫu khối): TRONG-NGHỀ TB kg · macro\n`);
  console.log("| cấu hình | Δ so HEAD (kg) | Δ so HEAD (macro) | Δ so bản chốt (kg) | Δ so bản chốt (macro) | Δ so x-sản-lượng thuần (kg) | (macro) |\n|---|---|---|---|---|---|---|");
  const dc = (k, r, st) => { const x = json.configs[k].diff[r]?.[st]; return x ? `${f3s(x.d)} [${f3s(x.ci[0])}…${f3s(x.ci[1])}]` : "—"; };
  for (const k of keys) console.log(`| ${results[k].name} | ${dc(k, "head", "kgWithin")} | ${dc(k, "head", "macroWithin")} | ${dc(k, "prod", "kgWithin")} | ${dc(k, "prod", "macroWithin")} | ${dc(k, "x_catch", "kgWithin")} | ${dc(k, "x_catch", "macroWithin")} |`);
  console.log(`\n## Bảng C — theo loài: n_eff · AUCeff cũ → trong-nghề (theo cấu hình)\n`);
  const showK = ["head", "prod", "x_catch", "x_fleet", "static", "m1_cpue", "leak2_other", "leak4_prod", "xc_ks", "base_irls", "base_rank"].filter((k) => results[k]);
  console.log(`| loài | tấn | n_eff | top1% kg | ${showK.map((k) => results[k].name).join(" | ")} |\n|---|---|---|---|${showK.map(() => "---").join("|")}|`);
  for (const s of topSp) {
    const t = point.head.per[s].kgAll / 1000;
    if (t < 0.5) continue;
    console.log(`| ${s} | ${t.toFixed(1)} | ${Math.round(nEff[s])}${nEff[s] < 200 ? "⚠" : ""} | ${f3(top1[s])} | ${showK.map((k) => `${f3(point[k].per[s].eff)} → ${f3(point[k].per[s].within)}`).join(" | ")} |`);
  }
  for (const k of ["head", "prod", "base_irls", "base_rank", "base_irls_nc", "prod2", "prod2_nothermal", "prod2_listgate", "prod2_fs"].filter((k) => results[k])) {
    console.log(`\n## Bảng D(${k}) — CPUE kg/giờ (nhóm nghề mục tiêu) theo bậc điểm — ${results[k].name}\n`);
    console.log(`| loài | ${TIERS.map((t) => `${t[0]}–${t[1]}`).join(" | ")} | 25–49/0–24 | 50–74/25–49 | ≥75/50–74 [CI 90 %] |\n|---|---|---|---|---|---|---|---|---|`);
    for (const [nm, row] of Object.entries(tierOut[k])) {
      const rr = (i) => (Number.isFinite(row.ratio[i].r) ? `${row.ratio[i].r.toFixed(2)} [${row.ratio[i].ci[0].toFixed(2)}–${row.ratio[i].ci[1].toFixed(2)}]` : "—");
      console.log(`| ${nm === "pooled" ? "**gộp mọi loài**" : nm} | ${row.cpue.map((c) => (Number.isFinite(c) ? c.toFixed(1) : "—")).join(" | ")} | ${rr(0)} | ${rr(1)} | ${rr(2)} |`);
    }
  }
  console.log(`\n## Bảng E — cổng 2A\n`);
  for (const k of ["base_irls", "base_rank", "base_irls_nc", "prod2", "prod2_nothermal", "prod2_listgate", "prod2_fs"].filter((k) => results[k])) {
    const t = tierOut[k].pooled, r = t.ratio.map((x) => `${x.r.toFixed(2)} [${x.ci[0].toFixed(2)}–${x.ci[1].toFixed(2)}]`).join(" · ");
    const lw = (a) => (json.configs[a] ? f3(json.configs[a].point.kgWithin) : "—");
    console.log(`- ${k}: trong-nghề ${cell(k, "kgWithin")} · cũ ${cell(k, "kgOld")} · Δ bản chốt ${dc(k, "prod", "kgWithin")} · Δ tĩnh ${dc(k, "static", "kgWithin")} · Δ M−1 kg/giờ ${dc(k, "m1_cpue", "kgWithin")} · ô≥50 ${(100 * results[k].hotShare).toFixed(1)} % (chốt ${(100 * HOT).toFixed(1)} %) · bậc 25/50/75: ${r} · lạ ${lw(`${k}_leak2_other`)} vs quen ${lw(`${k}_leak2_same`)}`);
  }
  log(`xong → ${join(OUT, "honest-eval.json")}`);
}

if (process.argv[1]?.endsWith("dl-eval-honest.mjs") && process.argv.includes("--selftest")) {
  const r = pctRank([5, 1, 1, 9]);
  if (r[1] !== r[2] || !(r[3] === 100) || !(r[1] < r[0])) throw new Error(`pctRank ${Array.from(r)}`);
  const g = {
    v: 1, axis: { lat0: 5, lon0: 100, step: 0.25, nLat: 4, nLon: 4 }, gears: ["x"], speciesGears: { a: ["x"] },
    months: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    days: { "2026-05": 31, "2026-06": 30, "2026-07": 31, "2026-08": 31, "2026-09": 30, "2026-10": 11 },
    effort: Object.fromEntries(["05", "06", "07", "08", "09", "10"].map((m, i) => [`2026-${m}`, { x: [[0, 0, 10 * (i + 1)]] }])),
  };
  const d = distantMonthsGrid(g, 8); // tháng cách 2–3 của 8 = 5, 6, 10, 11 ⇒ có 2026-05, 06, 10; KHÔNG có 07, 08, 09
  if (JSON.stringify(d.usedMonths) !== JSON.stringify(["2026-05", "2026-06", "2026-10"])) throw new Error(`distantMonthsGrid ${d.usedMonths}`);
  if (d.effort["2000-08"].x[0][2] !== 10 + 20 + 60 || d.days["2000-08"] !== 31 + 30 + 11) throw new Error("gộp giờ/ngày");
  // lưới giả phải "đọc được" như tháng 8
  const look = fleetPresenceLookup(d, 8, 60);
  if (!(look("a", 5, 100) > 0)) throw new Error("lưới giả không đọc được");
  if (monthOnly(g, "2026-07").months[0] !== "2026-07" || monthOnly(g, "2025-01") !== null) throw new Error("monthOnly");
  console.log("selftest OK");
}
