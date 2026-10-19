// scripts/fish-base-fit.mjs — FIT HỆ SỐ cho điểm nền "bãi cá theo mùa" (đợt 2A, docs/app-map/ops/fish-train-review-2026-10-18 §7).
// Không chạy riêng: dl-eval-honest.mjs (`runHonest`) gọi `makeBase(env)` để (a) dựng đặc trưng
// [xc, xf, stat, season] cho từng (ngày, loài, ô), (b) fit hệ số THEO NHÓM LOÀI trên các tháng KHÁC tháng chấm,
// (c) chấm ngày bằng lưới giữ-tháng-ra của đúng tháng đó. Ra `fish-base-fit.json` cho fish-base-build.mjs.
//
// ĐẶC TRƯNG (src/lib/fish-base.ts): xc = x-sản-lượng với K_s riêng loài (trung vị kg ô dương của lưới giữ-tháng-ra),
// xf = x-đội-tàu (60 giờ), stat = tổng log-lift sâu+bờ+vĩ (bảng fit trên tháng KHÁC; hàng huấn luyện dùng
// cross-fit chẵn/lẻ khối 7 ngày trong tháng huấn luyện để hệ số `stat` không phồng vì tự chấm), season = seasonPrior.
// NHÓM: pelagic-large · pelagic-small · cephalopod · other (đáy/rạn/giáp xác — ít kg, gộp một nhóm).
// IRLS use-availability: dương = kg (chuẩn lại tổng 1/loài), âm = giờ đánh nhóm nghề (chuẩn lại tổng 1/loài).
import { SPECIES_META } from "../src/lib/fish-predict.ts";
import { fleetPresenceLookup } from "../src/lib/fleet-effort.ts";
import { baseGroup, baseSeason, staticBins, fitStaticLift, staticLogLift, medianPositive, irlsLogistic, scoreBase, BASE_DEPTH_EDGES, BASE_COAST_EDGES, BASE_LAT_BINS } from "../src/lib/fish-base.ts";

export const BASE_GROUPS = ["pelagic-large", "pelagic-small", "cephalopod", "other"];
export const groupOf = (short) => baseGroup(SPECIES_META[short]?.category ?? "");
export function seasonOf(short, month) {
  const full = SPECIES_META[short]?.full;
  return full ? baseSeason(full, month) : 1;
}

/** K_s theo loài từ MỘT lưới sản lượng: trung vị kg ô-tháng dương qua mọi tháng của lưới */
export function ksOfGrid(g) {
  const vals = {};
  for (const m of g.months) for (const [s, arr] of Object.entries(g.effort[m] ?? {})) for (const e of arr) (vals[s] ??= []).push(e[2]);
  return Object.fromEntries(Object.entries(vals).map(([s, v]) => [s, medianPositive(v)]));
}

export function makeBase(env) {
  const { days, prepAll, SPECIES, feat, heldOut, catchHeld, catchFull } = env;
  // loài KHÔNG dựng nền từ kg (kg khai kém tin cậy: cá tạp/cá xô, loài cấm/hạn chế): chỉ đội tàu + tĩnh + mùa
  const fleetOnly = new Set(env.fleetOnly ?? []);
  const ndim = [BASE_DEPTH_EDGES.length - 1, BASE_COAST_EDGES.length - 1, BASE_LAT_BINS];

  const binsMemo = new Map();
  const binsOf = (di) => {
    let b = binsMemo.get(di);
    if (!b) { const day = days[di]; b = day.cells.map((c, i) => { const f = feat(day.keys[i], c.lat, c.lon); return staticBins(f.depth, f.coast, f.lat); }); binsMemo.set(di, b); }
    return b;
  };

  /** bảng log-lift theo loài, fit trên tập ngày `idxs` */
  function fitTables(idxs) {
    const out = {};
    for (const s of SPECIES) {
      const kg = ndim.map((n) => new Array(n).fill(0)), hr = ndim.map((n) => new Array(n).fill(0));
      for (const di of idxs) {
        const bins = binsOf(di);
        for (const [i, w] of prepAll[di][s].pos) bins[i].forEach((b, f) => { if (b >= 0) kg[f][b] += w; });
        for (const [i, w] of prepAll[di][s].neg) bins[i].forEach((b, f) => { if (b >= 0) hr[f][b] += w; });
      }
      const L = fitStaticLift(kg, hr);
      out[s] = { depth: L[0], coast: L[1], lat: L[2] };
    }
    return out;
  }
  const monthIdx = (ym) => days.map((d, i) => (d.ym === ym ? i : -1)).filter((i) => i >= 0);
  const notMonthIdx = (ym) => days.map((d, i) => (d.ym !== ym ? i : -1)).filter((i) => i >= 0);
  const tabOther = new Map();
  const tablesExcluding = (ym) => tabOther.get(ym) ?? (tabOther.set(ym, fitTables(notMonthIdx(ym))), tabOther.get(ym));
  const tabCF = new Map(); // `${ym}|${parity}` → bảng fit trên NỬA KIA (khối chẵn/lẻ) của tháng
  const tablesCF = (ym, p) => {
    const k = `${ym}|${p}`;
    if (!tabCF.has(k)) tabCF.set(k, fitTables(monthIdx(ym).filter((di) => days[di].block % 2 !== p)));
    return tabCF.get(k);
  };

  /* nguồn lưới + bộ tra x, nhớ theo khoá */
  const srcMemo = new Map();
  function look(src, month) {
    let o = srcMemo.get(src.key);
    if (!o) {
      const Ks = ksOfGrid(src.catch);
      const cl = {};
      o = { Ks, fl: fleetPresenceLookup(src.fleet, month, 60), cl: (s) => (cl[s] ??= fleetPresenceLookup(src.catch, month, Ks[s] ?? 8000)) };
      srcMemo.set(src.key, o);
    }
    return o;
  }
  const srcOf = (day) => ({ key: day.ym, fleet: heldOut[day.ym], catch: catchHeld[day.ym] });

  /* hàng huấn luyện tại ô có nhãn, dựng một lần */
  let rows = null;
  function buildRows() {
    rows = days.map((day, di) => {
      const o = look(srcOf(day), day.month), tab = tablesCF(day.ym, day.block % 2), out = {};
      const bins = binsOf(di);
      for (const s of SPECIES) {
        const cl = o.cl(s), t = tab[s], se = seasonOf(s, day.month);
        const mk = (list, y) => list.map(([i, w]) => {
          const c = day.cells[i];
          return { x: [1, cl(s, c.lat, c.lon), o.fl(s, c.lat, c.lon), staticLogLift(t, bins[i]), se], y, w };
        });
        out[s] = { pos: mk(prepAll[di][s].pos, 1), neg: mk(prepAll[di][s].neg, 0) };
      }
      return out;
    });
  }

  const fitMemo = new Map();
  /** hệ số theo nhóm, fit trên mọi ngày KHÔNG thuộc tháng `exYm` (null = tất cả) */
  function fitGroups(exYm) {
    if (fitMemo.has(exYm)) return fitMemo.get(exYm);
    if (!rows) buildRows();
    const idx = days.map((d, i) => (d.ym !== exYm ? i : -1)).filter((i) => i >= 0);
    const coef = {}, coefNoCatch = {}, nRows = {};
    for (const g of BASE_GROUPS) {
      const data = [], dataNc = [];
      for (const s of SPECIES) {
        if (groupOf(s) !== g) continue;
        let P = 0, N = 0;
        for (const di of idx) { for (const r of rows[di][s].pos) P += r.w; for (const r of rows[di][s].neg) N += r.w; }
        if (!(P > 0) || !(N > 0)) continue;
        for (const di of idx) for (const [list, tot] of [[rows[di][s].pos, P], [rows[di][s].neg, N]])
          for (const r of list) { const w = r.w / tot; data.push({ x: r.x, y: r.y, w }); dataNc.push({ x: [r.x[0], r.x[2], r.x[3], r.x[4]], y: r.y, w }); }
      }
      nRows[g] = data.length;
      if (data.length < 50) continue;
      coef[g] = irlsLogistic(data);
      coefNoCatch[g] = irlsLogistic(dataNc);
    }
    const res = { coef, coefNoCatch, nRows };
    fitMemo.set(exYm, res);
    return res;
  }

  /** điểm nền cho một ngày: mode "irls" | "rank"; opt.src = lưới thay thế (nửa tàu); opt.noCatch = bỏ kênh sản lượng */
  function scoreDay(day, mode, hotShare, opt = {}) {
    const di = days.indexOf(day);
    const src = opt.src ?? srcOf(day), o = look(src, day.month);
    const tab = tablesExcluding(day.ym), fit = fitGroups(day.ym), bins = binsOf(di);
    const out = {};
    for (const s of SPECIES) {
      if (!prepAll[di][s].pos.length && !prepAll[di][s].neg.length) { out[s] = new Uint8Array(day.cells.length); continue; }
      const cl = o.cl(s), t = tab[s], se = seasonOf(s, day.month);
      const feats = day.cells.map((c, i) => [opt.noCatch || fleetOnly.has(s) ? 0 : cl(s, c.lat, c.lon), o.fl(s, c.lat, c.lon), staticLogLift(t, bins[i]), se]);
      out[s] = scoreBase({ coef: fit.coef, coefNoCatch: fit.coefNoCatch, hotShare, mode }, groupOf(s), feats, !opt.noCatch && !fleetOnly.has(s));
    }
    return out;
  }

  /** x-sản-lượng THUẦN với K_s theo loài (chẩn đoán: K_s thay 8000 chung có giúp không) */
  function xcScores(day) {
    const o = look(srcOf(day), day.month), out = {};
    for (const s of SPECIES) { const cl = o.cl(s); out[s] = Uint8Array.from(day.cells, (c) => Math.round(100 * cl(s, c.lat, c.lon))); }
    return out;
  }

  /** tham số xuất cho fish-base-build.mjs: fit trên MỌI ngày, bảng tĩnh trên mọi ngày */
  function exportFit(hotShare, mode) {
    const f = fitGroups(null);
    return { v: 1, mode, hotShare, groups: BASE_GROUPS, coef: f.coef, coefNoCatch: f.coefNoCatch, nRows: f.nRows, staticLift: fitTables(days.map((_, i) => i)), ksFromHeld: Object.fromEntries(Object.keys(catchHeld).map((ym) => [ym, ksOfGrid(catchHeld[ym])])), catchFullMonths: catchFull?.months ?? [], fleetOnly: [...fleetOnly] };
  }

  /** BaseParams (src/lib/fish-base.ts) dựng cho tháng chấm `ym`: hệ số + bảng tĩnh fit trên tháng KHÁC, K_s từ lưới giữ-tháng-ra.
   *  `sameMonthKg` mô phỏng tháng có kg loài cùng tháng (true) hay chưa (false ⇒ "fleet-static"). */
  function paramsFor(ym, hotShare, mode, sameMonthKg = true) {
    const f = fitGroups(ym);
    return {
      v: 1, builtAt: "eval", mode, hotShare, ksKg: ksOfGrid(catchHeld[ym]), coef: f.coef, coefNoCatch: f.coefNoCatch,
      staticLift: tablesExcluding(ym), fleetOnly: [...fleetOnly], catchMonths: [],
      catchSameMonth: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), sameMonthKg])),
    };
  }

  return { scoreDay, xcScores, fitGroups, exportFit, look, srcOf, paramsFor };
}
