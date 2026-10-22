#!/usr/bin/env node
// phan-tich-gio-moi.mjs — MẮT XÍCH GIÓ → MỒI của "Dòng Dẫn": gió (CMEMS, tai-gio-cmems.mjs) có đẩy chlorophyll
// (OC-CCI 8 ngày, tai-chl-occi.mjs) ở 4 hộp nước trồi Nam VN không, trễ bao lâu, và ENSO có đi tới tận mồi không.
// Chỉ đọc $SDFISH_DATA_DIR/hindcast-ntb, ghi $SDFISH_DATA_DIR/dong-dan/ket-qua/gio-moi.{json,md}.
//   A. Trong mùa (chl 5–10): r(dị thường gió trung bình cửa sổ 8 ngày TRƯỚC k cửa sổ, dị thường log10 chl), k = 0..6
//      (0–48 ngày). CI 90 % bootstrap theo NĂM; ngưỡng ngẫu nhiên = xáo năm (ghép gió năm y với chl năm y' cùng khe).
//   B. Liên năm: r(dị thường gió 6–9, dị thường chl 6–9) giữa các năm; CI bootstrap theo năm.
//   C. ENSO → mồi: ONI T12–2 → chl 6–9 (r, bỏ-từng-năm), và phân nhóm sau El Niño (tercile dưới, đuôi nhị thức).
//   D. Thời điểm: ngày chl đạt mức hè điển hình vs ngày gió khởi phát (tercile, tương quan).
// Đối tượng "mồi" ở đây là chl mặt biển (thực vật phù du) — KHÔNG phải cá; mây/cực đại dưới mặt là giới hạn (03 §4).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES, inBox } from "./hop.mjs";

const RAW = join(dataDir(), "hindcast-ntb"), OUT = join(dataDir(), "dong-dan", "ket-qua");
mkdirSync(OUT, { recursive: true });
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
let seed = 7; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const doy = (iso) => Math.floor((Date.parse(iso) - Date.UTC(+iso.slice(0, 4), 0, 1)) / 864e5) + 1;
const slot = (iso) => Math.floor((doy(iso) - 1) / 8); // OC-CCI 8 ngày bắt đầu 1/1 mỗi năm ⇒ khe 0..45
const binomTail = (k, n, p = 1 / 3) => { let s = 0; for (let j = k; j <= n; j++) { let c = 1; for (let i = 0; i < j; i++) c = (c * (n - i)) / (i + 1); s += c * p ** j * (1 - p) ** (n - j); } return s; };
const BX = ["SCU", "NCU", "OFU", "MKU"];
const CLIM_YEARS = [1998, 2025];

// ── chl: trung bình log10 theo hộp cho từng mốc 8 ngày ────────────────────
const man = JSON.parse(readFileSync(join(RAW, "chl-occi", "manifest.json"), "utf8"));
const nLon = man.lon.length;
const cellsOf = Object.fromEntries(BX.map((b) => [b, man.lat.flatMap((la, i) => man.lon.map((lo, j) => (inBox(BOXES[b], la, lo) ? i * nLon + j : -1))).filter((k) => k >= 0)]));
const chl = Object.fromEntries(BX.map((b) => [b, new Map()])); // hộp → Map(ngày → log10 chl)
const cover = Object.fromEntries(BX.map((b) => [b, []]));
for (const f of readdirSync(join(RAW, "chl-occi")).filter((f) => f.endsWith(".csv")).sort())
  for (const l of readFileSync(join(RAW, "chl-occi", f), "utf8").split("\n")) {
    if (!l) continue;
    const p = l.split(","), d = p[0];
    for (const b of BX) {
      const v = cellsOf[b].map((k) => +p[k + 1]).filter((x) => Number.isFinite(x) && x > 0);
      cover[b].push(v.length / cellsOf[b].length);
      if (v.length >= 0.3 * cellsOf[b].length) chl[b].set(d, mean(v.map(Math.log10)));
    }
  }
const anomBySlot = (m) => { // dị thường theo khe 8 ngày, khí hậu 1998–2025
  const by = Array.from({ length: 46 }, () => []);
  for (const [d, v] of m) { const y = +d.slice(0, 4); if (y >= CLIM_YEARS[0] && y <= CLIM_YEARS[1]) by[slot(d)].push(v); }
  const cl = by.map(mean);
  return { clim: cl, anom: new Map([...m].map(([d, v]) => [d, v - cl[slot(d)]])) };
};
const chlA = Object.fromEntries(BX.map((b) => [b, anomBySlot(chl[b])]));
const chlDates = [...new Set(BX.flatMap((b) => [...chl[b].keys()]))].sort();
console.error("chl:", chlDates[0], "→", chlDates.at(-1), "·", chlDates.length, "mốc; ô/hộp", JSON.stringify(Object.fromEntries(BX.map((b) => [b, cellsOf[b].length]))));

// ── gió: chỉ số ngày → trung bình cửa sổ 8 ngày khớp mốc chl ───────────────
const gio = JSON.parse(readFileSync(join(RAW, "cmems-gio", "chiso-ngay.json"), "utf8"));
const WIND = { SCU: ["SCU_tE", "SCU_Mek", "SCU_wEk", "SCU_ti"], NCU: ["NCU_tN", "NCU_Mek", "NCU_ti"], OFU: ["OFU_wEk", "OFU_ti", "OFU_tE"], MKU: ["MKU_ti", "MKU_tE", "MKU_wEk"] };
const win8 = (key, start) => { // trung bình 8 ngày từ start; cần ≥ 6 ngày
  const m = gio[key]; if (!m) return NaN;
  const v = []; for (let i = 0; i < 8; i++) { const d = new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10); if (m[d] !== undefined) v.push(m[d]); }
  return v.length >= 6 ? mean(v) : NaN;
};
// chuỗi gió theo khe 8 ngày cho MỌI năm có gió (để lấy trễ k khe, kể cả trước tháng 5)
const windSeries = {}, windAnom = {};
const allSlots = [];
for (let y = 1994; y <= 2026; y++) for (let s = 0; s < 46; s++) allSlots.push(new Date(Date.UTC(y, 0, 1) + s * 8 * 864e5).toISOString().slice(0, 10));
for (const ks of Object.values(WIND)) for (const k of ks) {
  windSeries[k] = new Map(allSlots.map((d) => [d, win8(k, d)]).filter(([, v]) => Number.isFinite(v)));
  windAnom[k] = anomBySlot(windSeries[k]).anom;
}
const prevSlot = (d, k) => { const y = +d.slice(0, 4), s = slot(d) - k; return s >= 0 ? new Date(Date.UTC(y, 0, 1) + s * 8 * 864e5).toISOString().slice(0, 10) : new Date(Date.UTC(y - 1, 0, 1) + (46 + s) * 8 * 864e5).toISOString().slice(0, 10); };

// ── A. trong mùa: trễ 0..6 khe ─────────────────────────────────────────────
const out = { builtAt: new Date().toISOString(), chl: { from: chlDates[0], to: chlDates.at(-1), cells: Object.fromEntries(BX.map((b) => [b, cellsOf[b].length])), coverMean: Object.fromEntries(BX.map((b) => [b, +mean(cover[b]).toFixed(2)])) }, A: {}, B: {}, C: {}, D: {} };
const inSeason = (d) => { const m = +d.slice(5, 7); return m >= 5 && m <= 10; };
for (const b of BX) for (const k of WIND[b]) {
  const res = [];
  for (let lag = 0; lag <= 6; lag++) {
    const pairs = [];
    for (const [d, c] of chlA[b].anom) { if (!inSeason(d)) continue; const w = windAnom[k].get(prevSlot(d, lag)); if (Number.isFinite(w)) pairs.push({ y: +d.slice(0, 4), s: slot(d), w, c }); }
    if (pairs.length < 60) { res.push({ lag, n: pairs.length }); continue; }
    const r = pearson(pairs.map((p) => p.w), pairs.map((p) => p.c));
    const years = [...new Set(pairs.map((p) => p.y))], byY = new Map(years.map((y) => [y, pairs.filter((p) => p.y === y)]));
    const boot = []; for (let i = 0; i < 400; i++) { const P = []; for (let j = 0; j < years.length; j++) P.push(...byY.get(years[Math.floor(rnd() * years.length)])); boot.push(pearson(P.map((p) => p.w), P.map((p) => p.c))); }
    // xáo năm: gió năm y' ghép chl năm y, cùng khe
    const wBy = new Map(years.map((y) => [y, new Map(byY.get(y).map((p) => [p.s, p.w]))]));
    const nul = []; for (let i = 0; i < 300; i++) { const perm = [...years].sort(() => rnd() - 0.5), mp = new Map(years.map((y, j) => [y, perm[j]])); const W = [], C = []; for (const p of pairs) { const w = wBy.get(mp.get(p.y)).get(p.s); if (Number.isFinite(w)) { W.push(w); C.push(p.c); } } nul.push(Math.abs(pearson(W, C))); }
    res.push({ lag, ngay: lag * 8, n: pairs.length, nam: years.length, r: +r.toFixed(3), ci90: [+q(boot, 0.05).toFixed(3), +q(boot, 0.95).toFixed(3)], null95: +q(nul, 0.95).toFixed(3) });
  }
  out.A[`${b}|${k}`] = res;
}
// ── B. liên năm 6–9 ─────────────────────────────────────────────────────────
// trung bình mùa trên các mốc 8 ngày — CHỈ khi đủ mốc: gió ≥ 85 % (hè 2026 gió tới 20/6 bị loại), chl ≥ 60 % (thiếu mốc chl là do MÂY, không phải hết chuỗi; 2026 chl tới 26/6 vẫn bị loại)
const seas = (m, y, months, minFrac = 0.85) => { const v = [...m].filter(([d]) => +d.slice(0, 4) === y && months.includes(+d.slice(5, 7))).map(([, x]) => x); const need = months.reduce((s, mo) => s + new Date(Date.UTC(y, mo, 0)).getUTCDate(), 0) / 8; return v.length >= minFrac * need ? mean(v) : NaN; };
const JJAS = [6, 7, 8, 9];
const yrs = []; for (let y = 1998; y <= 2026; y++) yrs.push(y);
const oni = {}; for (const l of readFileSync(join(RAW, "chiso", "oni.txt"), "utf8").split("\n").slice(1)) { const p = l.trim().split(/\s+/); if (p.length >= 4) oni[`${p[1]}-${p[0]}`] = +p[3]; }
const rowsY = yrs.map((y) => { const r = { y, oniDJF: oni[`${y}-DJF`], oniJASprev: oni[`${y - 1}-JAS`] }; for (const b of BX) { r[`chl_${b}`] = seas(chlA[b].anom, y, JJAS, 0.6); for (const k of WIND[b]) r[k] = seas(windAnom[k], y, JJAS); } return r; });
for (const b of BX) for (const k of WIND[b]) {
  const R = rowsY.filter((r) => Number.isFinite(r[k]) && Number.isFinite(r[`chl_${b}`]));
  const r = pearson(R.map((x) => x[k]), R.map((x) => x[`chl_${b}`]));
  const boot = []; for (let i = 0; i < 2000; i++) { const S = R.map(() => R[Math.floor(rnd() * R.length)]); boot.push(pearson(S.map((x) => x[k]), S.map((x) => x[`chl_${b}`]))); }
  out.B[`${b}|${k}`] = { n: R.length, r: +r.toFixed(3), ci90: [+q(boot, 0.05).toFixed(3), +q(boot, 0.95).toFixed(3)] };
}
// ── C. ENSO → chl 6–9 ───────────────────────────────────────────────────────
for (const b of BX) for (const [xk, nhan] of [["oniDJF", "ONI T12–2 (phát T3, lead ~4 th)"], ["oniJASprev", "ONI T7–9 năm trước (phát T10, lead ~9 th)"]]) {
  const R = rowsY.filter((r) => Number.isFinite(r[`chl_${b}`]) && Number.isFinite(r[xk]));
  const x = R.map((r) => r[xk]), yv = R.map((r) => r[`chl_${b}`]);
  const fitPred = (xi, yi, x0) => { const mx = mean(xi), my = mean(yi); let sxy = 0, sxx = 0; for (let j = 0; j < xi.length; j++) { sxy += (xi[j] - mx) * (yi[j] - my); sxx += (xi[j] - mx) ** 2; } return my + (sxy / sxx) * (x0 - mx); };
  const pred = R.map((_, i) => fitPred(x.filter((_, j) => j !== i), yv.filter((_, j) => j !== i), x[i]));
  const ae = yv.map((v, i) => Math.abs(v - pred[i])), aeC = yv.map((v, i) => Math.abs(v - mean(yv.filter((_, j) => j !== i))));
  const bs = []; for (let i = 0; i < 2000; i++) { const id = yv.map(() => Math.floor(rnd() * yv.length)); bs.push(1 - mean(id.map((j) => ae[j])) / mean(id.map((j) => aeC[j]))); }
  const th = q(yv, 1 / 3), el = R.filter((r) => r.oniDJF >= 1), la = R.filter((r) => r.oniDJF <= -1);
  const kEl = el.filter((r) => r[`chl_${b}`] <= th).length, kLa = la.filter((r) => r[`chl_${b}`] <= th).length;
  // dự báo khoá: dùng toàn mẫu, đầu vào ONI hiện có (T7–9 2026 cho mô hình lead 9 tháng)
  const now = xk === "oniJASprev" ? oni["2026-JAS"] : undefined;
  out.C[`${b}|${xk}`] = { nhan, n: R.length, rTrongMau: +pearson(x, yv).toFixed(3), rLOYO: +pearson(yv, pred).toFixed(3), skillMAE: +(1 - mean(ae) / mean(aeC)).toFixed(3), skillCI90: [+q(bs, 0.05).toFixed(3), +q(bs, 0.95).toFixed(3)], sauElNino: { k: kEl, n: el.length, nam: el.map((r) => `${r.y}:${r[`chl_${b}`].toFixed(2)}`), p: +binomTail(kEl, el.length).toFixed(3) }, sauLaNina: { k: kLa, n: la.length }, nguongTerDuoi: +th.toFixed(3), duBao2027: now === undefined ? null : { vao: now, chlAnom: +fitPred(x, yv, now).toFixed(3) } };
}
// ── D. thời điểm: chl đạt mức hè điển hình vs gió khởi phát ────────────────
const onsetFrom = (series, thr, y, ge) => { const ds = [...series.keys()].filter((d) => +d.slice(0, 4) === y && +d.slice(5, 7) >= 5).sort(); for (let i = 1; i < ds.length; i++) { const v = (series.get(ds[i]) + series.get(ds[i - 1])) / 2; if (ge ? v >= thr : v <= thr) return doy(ds[i]); } return NaN; };
for (const [b, k] of [["SCU", "SCU_tE"], ["OFU", "OFU_wEk"], ["MKU", "MKU_ti"]]) {
  const thrC = mean(chlA[b].clim.slice(19, 34).filter(Number.isFinite)); // khí hậu log10 chl khe tháng 6–9
  const thrW = mean([...windSeries[k]].filter(([d]) => JJAS.includes(+d.slice(5, 7)) && +d.slice(0, 4) <= 2025).map(([, v]) => v));
  const R = yrs.map((y) => ({ y, oc: onsetFrom(chl[b], thrC, y, true), ow: onsetFrom(windSeries[k], thrW, y, true), oni: oni[`${y}-DJF`] })).filter((r) => Number.isFinite(r.oc) && Number.isFinite(r.ow));
  const tre = R.map((r) => r.oc - r.ow);
  out.D[`${b}|${k}`] = { n: R.length, r: +pearson(R.map((r) => r.ow), R.map((r) => r.oc)).toFixed(3), treTrungVi: q(tre, 0.5), treTB: +mean(tre).toFixed(1), chlMuonSauElNino: (() => { const th = q(R.map((r) => r.oc), 2 / 3), el = R.filter((r) => r.oni >= 1); return `${el.filter((r) => r.oc >= th).length}/${el.length} (${el.map((r) => `${r.y}:${r.oc}`).join(" ")}); ngưỡng ${th}`; })(), nam: R.map((r) => `${r.y}:${r.ow}→${r.oc}`).join(" ") };
}
writeFileSync(join(OUT, "gio-moi.json"), JSON.stringify({ ...out, nam: rowsY }, null, 1));
// markdown
const md = [`# Mắt xích gió → mồi — kết quả thô (${out.builtAt})\n`, `Chl OC-CCI 8 ngày ${out.chl.from} → ${out.chl.to}; ô/hộp ${JSON.stringify(out.chl.cells)}; phủ (không mây) TB ${JSON.stringify(out.chl.coverMean)}. Gió CMEMS (chiso-ngay.json). Khí hậu ${CLIM_YEARS.join("–")}.\n`];
md.push(`## A. Trong mùa (chl 5–10): r(gió trước k cửa sổ 8 ngày, chl) — in đậm khi |r| > ngưỡng xáo năm 95 % và CI 90 % loại 0\n\n| hộp · gió | ${[0, 1, 2, 3, 4, 5, 6].map((k) => `trễ ${k * 8} ng`).join(" | ")} |\n|---|---|---|---|---|---|---|---|`);
for (const [key, res] of Object.entries(out.A)) md.push(`| ${key} | ${res.map((v) => (v.r === undefined ? "—" : (Math.abs(v.r) > v.null95 && (v.ci90[0] > 0 || v.ci90[1] < 0) ? `**${v.r}**` : `${v.r}`) + ` [${v.ci90}] ⊥${v.null95}`)).join(" | ")} |`);
md.push(`\n## B. Liên năm 6–9: r(dị thường gió, dị thường chl)\n\n| hộp · gió | n năm | r | CI 90 % |\n|---|---|---|---|`);
for (const [key, v] of Object.entries(out.B)) md.push(`| ${key} | ${v.n} | ${v.r} | [${v.ci90}] |`);
md.push(`\n## C. ONI → chl 6–9 (bỏ-từng-năm; phân nhóm theo ONI T12–2)\n\n| hộp · ONI | n | r trong mẫu | r bỏ-từng-năm | skill MAE [CI 90 %] | sau El Niño: chl tercile dưới | p | sau La Niña | dự báo 2027 (dị thường log10 chl) |\n|---|---|---|---|---|---|---|---|---|`);
for (const [b, v] of Object.entries(out.C)) md.push(`| ${b} | ${v.n} | ${v.rTrongMau} | ${v.rLOYO} | ${v.skillMAE} [${v.skillCI90}] | ${v.sauElNino.k}/${v.sauElNino.n} (${v.sauElNino.nam.join(" ")}) | ${v.sauElNino.p} | ${v.sauLaNina.k}/${v.sauLaNina.n} | ${v.duBao2027 ? `${v.duBao2027.chlAnom} (ngưỡng tercile dưới ${v.nguongTerDuoi})` : "—"} |`);
md.push(`\n## D. Thời điểm: ngày gió đạt mức hè → ngày chl đạt mức hè\n\n| hộp · gió | n | r(ngày gió, ngày chl) | trễ trung vị (ngày) | trễ TB | chl muộn sau El Niño |\n|---|---|---|---|---|---|`);
for (const [key, v] of Object.entries(out.D)) md.push(`| ${key} | ${v.n} | ${v.r} | ${v.treTrungVi} | ${v.treTB} | ${v.chlMuonSauElNino} |`);
md.push(`\n## Bảng năm (dị thường 6–9)\n\n| năm | ONI DJF | ${BX.map((b) => `chl ${b}`).join(" | ")} | SCU_tE ×10³ | OFU_wEk | MKU_ti ×10³ |\n|---|---|---|---|---|---|---|---|---|`);
for (const r of rowsY) md.push(`| ${r.y} | ${r.oniDJF ?? ""} | ${BX.map((b) => r[`chl_${b}`]?.toFixed(3)).join(" | ")} | ${(r.SCU_tE * 1e3).toFixed(1)} | ${r.OFU_wEk?.toFixed(3)} | ${(r.MKU_ti * 1e3).toFixed(1)} |`);
writeFileSync(join(OUT, "gio-moi.md"), md.join("\n"));
console.error("xong →", join(OUT, "gio-moi.md"));
