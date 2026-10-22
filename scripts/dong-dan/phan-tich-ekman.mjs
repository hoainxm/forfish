#!/usr/bin/env node
// phan-tich-ekman.mjs — BƯỚC C2: chỉ số nước trồi từ GIÓ LƯỚI (Herrmann 2023) + chỉ số SST kiểu Herrmann từ OISST,
// rồi đo lại cổng ONI → nước trồi (LOYO 44 năm). Chỉ đọc raw/, ghi ra/.
//   Gió: τ = ρa·Cd·|U|·U (ρa 1,22, Cd 1,2e-3); theo hộp: cường độ |τ|, τ_E, τ_N (đúng ba chỉ số của bài),
//        thêm vận chuyển Ekman ra khơi M = τ_dọc bờ/(ρw f) (SCU trục 25°, NCU 10°) và bơm Ekman w = curl τ/(ρw f) (OFU).
//   SST: UI_d = T_ref − SST nơi SST < T_o (T_o 27,6 °C như bài; T_ref = JJAS trung bình OISST hộp REF 1982–2025), trung bình hộp.
//   Mùa: JJAS (6–9) như bài. Khởi phát: ngày đầu ≥ 1/5 mà trung bình trượt 15 ngày của τ_E(SCU) ≥ khí hậu JJAS.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
// Dữ liệu: $SDFISH_DATA_DIR/hindcast-ntb (Mac mặc định ~/sdfish-data) — tải bằng tai-*.mjs cùng thư mục. Ra: $SDFISH_DATA_DIR/dong-dan/ket-qua
const RAW = join(dataDir(), "hindcast-ntb") + "/", OUT = join(dataDir(), "dong-dan", "ket-qua") + "/";
mkdirSync(OUT, { recursive: true });
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const doy = (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;
const RHO_A = 1.22, CD = 1.2e-3, RHO_W = 1025, OMEGA = 7.2921e-5;
const fCor = (lat) => 2 * OMEGA * Math.sin((lat * Math.PI) / 180);
const { BOXES, points } = JSON.parse(readFileSync(RAW + "era5-luoi/boxes.json", "utf8"));
const inBox = (b, la, lo) => la >= b[0] - 1e-6 && la <= b[1] + 1e-6 && lo >= b[2] - 1e-6 && lo <= b[3] + 1e-6;

// ── gió lưới → ứng suất ngày từng điểm ───────────────────────────────────
const pt = new Map(); // "lat_lon" → Map(date → {tx,ty,ti})
for (const f of readdirSync(RAW + "era5-luoi/").filter((f) => /^\d/.test(f))) {
  const j = JSON.parse(readFileSync(RAW + "era5-luoi/" + f, "utf8"));
  const k = `${j.lat}_${j.lon}`, m = pt.get(k) ?? pt.set(k, new Map()).get(k);
  const acc = new Map();
  for (let i = 0; i < j.time.length; i++) {
    const s = j.s[i], dd = j.d[i]; if (!Number.isFinite(s) || !Number.isFinite(dd)) continue;
    const r = (dd * Math.PI) / 180, u = -s * Math.sin(r), v = -s * Math.cos(r), c = RHO_A * CD * s;
    const d = j.time[i].slice(0, 10), e = acc.get(d) ?? acc.set(d, { tx: 0, ty: 0, ti: 0, n: 0 }).get(d);
    e.tx += c * u; e.ty += c * v; e.ti += c * s; e.n++;
  }
  for (const [d, e] of acc) if (e.n >= 20) m.set(d, { tx: e.tx / e.n, ty: e.ty / e.n, ti: e.ti / e.n });
}
console.error("điểm có gió", pt.size);
const dates = [...new Set([...pt.values()].flatMap((m) => [...m.keys()]))].sort();
const ptAt = (la, lo) => pt.get(`${+la.toFixed(1)}_${+lo.toFixed(1)}`); // khoá giống tên file: "11_109", "10.5_108.5"
// chỉ số ngày theo hộp
const ANG = { SCU: 25, NCU: 10 }; // trục dọc bờ (độ, từ bắc sang đông), dương = gió đẩy về đông-bắc ⇒ Ekman ra khơi
const idx = {}; // tên → Map(date → giá trị)
const put = (name, d, v) => { (idx[name] ??= new Map()); if (Number.isFinite(v)) idx[name].set(d, v); };
for (const d of dates) {
  for (const [bn, b] of Object.entries(BOXES)) {
    const vals = points.filter(([la, lo]) => inBox(b, la, lo)).map(([la, lo]) => [la, lo, ptAt(la, lo)?.get(d)]).filter((x) => x[2]);
    if (vals.length < 4) continue;
    put(`${bn}_ti`, d, mean(vals.map((x) => x[2].ti)));
    put(`${bn}_tE`, d, mean(vals.map((x) => x[2].tx)));
    put(`${bn}_tN`, d, mean(vals.map((x) => x[2].ty)));
    if (ANG[bn] !== undefined) { const th = (ANG[bn] * Math.PI) / 180; put(`${bn}_Mek`, d, mean(vals.map(([la, , e]) => (e.tx * Math.sin(th) + e.ty * Math.cos(th)) / (RHO_W * fCor(la))))); }
    if (bn === "OFU" || bn === "SCU") {
      // curl τ = ∂τy/∂x − ∂τx/∂y bằng sai phân trung tâm trên lưới 0,5°
      const curls = [];
      for (const [la, lo, e] of vals) {
        const E = ptAt(la, lo + 0.5)?.get(d), W = ptAt(la, lo - 0.5)?.get(d), N = ptAt(la + 0.5, lo)?.get(d), S = ptAt(la - 0.5, lo)?.get(d);
        if (!E || !W || !N || !S) continue;
        const dx = 2 * 0.5 * 111195 * Math.cos((la * Math.PI) / 180), dy = 2 * 0.5 * 111195;
        curls.push(((E.ty - W.ty) / dx - (N.tx - S.tx) / dy) / (RHO_W * fCor(la)));
      }
      if (curls.length >= 2) put(`${bn}_wEk`, d, mean(curls) * 86400); // m/ngày
    }
  }
}
console.error("chỉ số gió:", Object.keys(idx).join(" "));

// ── OISST → UI kiểu Herrmann + S, D cũ ───────────────────────────────────
const sstDay = new Map(); // date → [[lat,lon,sst]]
for (const f of readdirSync(RAW + "oisst/").filter((f) => f.endsWith(".csv")).sort())
  for (const l of readFileSync(RAW + "oisst/" + f, "utf8").split("\n")) {
    if (!l) continue; const p = l.split(","), arr = [];
    for (let k = 1; k < p.length; k++) { const x = +p[k]; if (!Number.isFinite(x)) continue; arr.push([10.875 + 0.25 * Math.floor((k - 1) / 24), 108.625 + 0.25 * ((k - 1) % 24), x]); }
    sstDay.set(p[0], arr);
  }
const T_O = 27.6;
const refVals = []; for (const [d, arr] of sstDay) { const y = +d.slice(0, 4), m = +d.slice(5, 7); if (y <= 2025 && m >= 6 && m <= 9) for (const [la, lo, x] of arr) if (inBox(BOXES.REF, la, lo)) refVals.push(x); }
const T_REF = mean(refVals);
console.error("T_ref OISST JJAS hộp REF (phần phủ):", T_REF.toFixed(2), "°C; T_o", T_O);
const COAST = [11.125, 12.875, 108.875, 110.375], OFF = [11.125, 12.875, 112.625, 114.375];
for (const [d, arr] of sstDay) {
  for (const bn of ["SCU", "OFU", "NCU"]) { const v = arr.filter(([la, lo]) => inBox(BOXES[bn], la, lo)); if (v.length >= 4) put(`UI_${bn}`, d, mean(v.map(([, , x]) => (x < T_O ? T_REF - x : 0)))); }
  const c = arr.filter(([la, lo]) => inBox(COAST, la, lo)).map((x) => x[2]), o = arr.filter(([la, lo]) => inBox(OFF, la, lo)).map((x) => x[2]);
  if (c.length >= 10 && o.length >= 10) { put("SSTc", d, mean(c)); put("Dc", d, mean(c) - mean(o)); }
}
// khí hậu ngày-trong-năm & dị thường
function climo(series, yrs = [1982, 2025]) { const by = Array.from({ length: 367 }, () => []); for (const [d, v] of series) { const y = +d.slice(0, 4); if (y >= yrs[0] && y <= yrs[1]) by[doy(new Date(d))].push(v); } const raw = by.map((a) => mean(a)), out = new Array(367).fill(NaN); for (let k = 1; k <= 366; k++) { const a = []; for (let j = -15; j <= 15; j++) { const kk = ((k + j - 1 + 366) % 366) + 1; if (Number.isFinite(raw[kk])) a.push(raw[kk]); } out[k] = mean(a); } return out; }
const anom = {}, clim = {};
for (const [n, m] of Object.entries(idx)) { clim[n] = climo(m); anom[n] = new Map([...m].map(([d, v]) => [d, v - clim[n][doy(new Date(d))]])); }
const seasonMean = (m, y, months) => mean([...m].filter(([d]) => +d.slice(0, 4) === y && months.includes(+d.slice(5, 7))).map(([, v]) => v));
const JJAS = [6, 7, 8, 9], MAM = [3, 4, 5];
// khởi phát theo gió: τ_E SCU trượt 15 ngày ≥ khí hậu JJAS của chính nó
if (!clim.SCU_tE) { console.error("chưa đủ lưới gió cho hộp SCU — chờ tải xong"); process.exit(3); }
const THR_W = mean(clim.SCU_tE.slice(152, 274).filter(Number.isFinite));
function onsetWind(y) { const ds = dates.filter((d) => +d.slice(0, 4) === y && idx.SCU_tE.has(d)); for (let i = 14; i < ds.length; i++) { if (+ds[i].slice(5, 7) < 5) continue; const w = ds.slice(i - 14, i + 1).map((d) => idx.SCU_tE.get(d)); if (w.length === 15 && mean(w) >= THR_W) return doy(new Date(ds[i])); } return NaN; }

// ── ONI / PDO ────────────────────────────────────────────────────────────
const oni = {}; for (const l of readFileSync(RAW + "chiso/oni.txt", "utf8").split("\n").slice(1)) { const p = l.trim().split(/\s+/); if (p.length >= 4) oni[`${p[1]}-${p[0]}`] = +p[3]; }
const pdo = {}; for (const l of readFileSync(RAW + "chiso/pdo.txt", "utf8").split("\n")) { const p = l.trim().split(/\s+/); if (p.length === 13 && /^\d{4}$/.test(p[0])) p.slice(1).forEach((v, i) => { if (+v < 99) pdo[`${p[0]}-${String(i + 1).padStart(2, "0")}`] = +v; }); }
const pdoS = (y, ms) => mean(ms.map((m) => pdo[`${y}-${String(m).padStart(2, "0")}`]).filter(Number.isFinite));

// ── bảng năm ─────────────────────────────────────────────────────────────
const TARGETS = ["SCU_ti", "SCU_tE", "SCU_Mek", "SCU_wEk", "OFU_ti", "OFU_wEk", "MKU_ti", "MKU_tE", "NCU_tN", "UI_SCU", "UI_OFU", "SSTc", "Dc"];
const years = [];
for (let y = 1982; y <= 2026; y++) {
  const r = { y, onsetW: onsetWind(y), oni_JAS_prev: oni[`${y - 1}-JAS`], oni_SON_prev: oni[`${y - 1}-SON`], oni_DJF: oni[`${y}-DJF`], oni_MAM: oni[`${y}-MAM`], oni_JJA: oni[`${y}-JJA`], pdo_MAM: pdoS(y, [3, 4, 5]), pdo_SON_prev: pdoS(y - 1, [9, 10, 11]) };
  for (const t of TARGETS) { r[t] = seasonMean(anom[t] ?? new Map(), y, JJAS); r[`${t}_raw`] = seasonMean(idx[t] ?? new Map(), y, JJAS); r[`${t}_MAM`] = seasonMean(anom[t] ?? new Map(), y, MAM); }
  years.push(r);
}
for (let i = 1; i < years.length; i++) for (const t of TARGETS) years[i][`${t}_prev`] = years[i - 1][t];
const Y = years.filter((r) => r.y >= 1983);

// ── hồi quy + LOYO (như phan-tich.mjs) ────────────────────────────────────
function olsFit(X, y) { const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0)); for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += X[k][i] * X[k][j]; A[i][p] += X[k][i] * y[k]; } for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; for (let r = 0; r < p; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c <= p; c++) A[r][c] -= f * A[i][c]; } } return A.map((r, i) => (r[i] ? r[p] / r[i] : 0)); }
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
let seed = 42; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
function loyo(target, feat, rows) {
  const ok = rows.filter((r) => Number.isFinite(r[target]) && feat(r).every(Number.isFinite));
  if (ok.length < 8) return { n: ok.length, skip: "ít năm" };
  const y = ok.map((r) => r[target]);
  const pred = ok.map((_, i) => { const tr = ok.filter((_, j) => j !== i); const b = olsFit(tr.map((r) => [1, ...feat(r)]), tr.map((r) => r[target])); const x = [1, ...feat(ok[i])]; return b.reduce((s, bj, j) => s + bj * x[j], 0); });
  const abs = y.map((v, i) => Math.abs(v - pred[i])), climAbs = y.map((v, i) => Math.abs(v - mean(y.filter((_, j) => j !== i))));
  const br = [], bs = [];
  for (let b = 0; b < 2000; b++) { const id = y.map(() => Math.floor(rnd() * y.length)); br.push(pearson(id.map((i) => y[i]), id.map((i) => pred[i]))); bs.push(1 - mean(id.map((i) => abs[i])) / mean(id.map((i) => climAbs[i]))); }
  br.sort((a, b) => a - b); bs.sort((a, b) => a - b); const q = (a, p) => a[Math.floor(p * (a.length - 1))];
  const my = mean(y), hit = []; y.forEach((v, i) => { if (Math.abs(v - my) > 0.5 * sd(y)) hit.push(Math.sign(v - my) === Math.sign(pred[i] - my)); });
  return { n: ok.length, r: +pearson(y, pred).toFixed(3), r_ci90: [+q(br, 0.05).toFixed(3), +q(br, 0.95).toFixed(3)], skill: +(1 - mean(abs) / mean(climAbs)).toFixed(3), skill_ci90: [+q(bs, 0.05).toFixed(3), +q(bs, 0.95).toFixed(3)], signHitBig: hit.length ? +(hit.filter(Boolean).length / hit.length).toFixed(2) : null, nBig: hit.length };
}
const MODELS = (t) => ({
  "quán tính (năm trước)": (r) => [r[`${t}_prev`]],
  "ONI JAS−1 (lead ~10 th)": (r) => [r.oni_JAS_prev],
  "ONI SON−1 (lead ~8 th)": (r) => [r.oni_SON_prev],
  "ONI DJF (lead ~5 th)": (r) => [r.oni_DJF],
  "ONI MAM (lead ~2 th)": (r) => [r.oni_MAM],
  "ONI DJF × dấu PDO MAM": (r) => [r.oni_DJF, r.oni_DJF * Math.sign(r.pdo_MAM), r.pdo_MAM],
  "ONI SON−1 + PDO SON−1": (r) => [r.oni_SON_prev, r.pdo_SON_prev],
  "chính nó mùa xuân MAM": (r) => [r[`${t}_MAM`]],
  "[trần] ONI JJA đồng thời": (r) => [r.oni_JJA],
});
const out = { builtAt: new Date().toISOString(), BOXES, T_REF: +T_REF.toFixed(2), T_O, THR_W: +(THR_W * 1e3).toFixed(2), years, results: {}, concurrent: {} };
for (const t of [...TARGETS, "onsetW"]) { out.results[t] = {}; for (const [n, f] of Object.entries(MODELS(t))) out.results[t][n] = loyo(t, f, Y); }
// đồng thời: gió JJAS ↔ UI/SST JJAS (kiểm chỉ số có "thấy" nước trồi không)
const okY = Y.filter((r) => Number.isFinite(r.SCU_tE) && Number.isFinite(r.UI_SCU));
for (const w of ["SCU_ti", "SCU_tE", "SCU_Mek", "SCU_wEk", "OFU_ti", "OFU_wEk", "MKU_ti", "NCU_tN"]) {
  out.concurrent[w] = {};
  for (const s of ["UI_SCU", "UI_OFU", "SSTc", "Dc"]) { const rows = Y.filter((r) => Number.isFinite(r[w]) && Number.isFinite(r[s])); out.concurrent[w][s] = { r: +pearson(rows.map((r) => r[w]), rows.map((r) => r[s])).toFixed(3), n: rows.length }; }
}
// dự báo khoá hè 2027 cho SCU_tE từ ONI JAS 2026 (nếu có skill mới dùng)
const fit = (t, f) => { const ok = Y.filter((r) => Number.isFinite(r[t]) && f(r).every(Number.isFinite)); const b = olsFit(ok.map((r) => [1, ...f(r)]), ok.map((r) => r[t])); const res = ok.map((r) => r[t] - b.reduce((s, bj, j) => s + bj * [1, ...f(r)][j], 0)); return { beta: b.map((v) => +v.toExponential(3)), resSd: +sd(res).toExponential(3), n: ok.length }; };
out.full = { SCU_tE_oniJASprev: fit("SCU_tE", (r) => [r.oni_JAS_prev]), SCU_tE_oniDJF: fit("SCU_tE", (r) => [r.oni_DJF]), UI_SCU_oniDJF: fit("UI_SCU", (r) => [r.oni_DJF]), SCU_Mek_oniDJF: fit("SCU_Mek", (r) => [r.oni_DJF]) };
out.sdTargets = Object.fromEntries(TARGETS.map((t) => [t, +sd(Y.map((r) => r[t]).filter(Number.isFinite)).toExponential(3)]));
writeFileSync(OUT + "ket-qua-ekman.json", JSON.stringify(out, null, 1));
const md = [`# Bước C2 — chỉ số Ekman/Herrmann: kết quả thô (${out.builtAt})\n`, `Hộp: ${JSON.stringify(BOXES)} · T_ref ${out.T_REF} °C · T_o ${T_O} °C · ngưỡng khởi phát gió ${out.THR_W}×10⁻³ N/m² · sd đích JJAS: ${JSON.stringify(out.sdTargets)}\n`];
md.push(`## Đồng thời JJAS (năm): gió ↔ SST\n\n| chỉ số gió | ${["UI_SCU", "UI_OFU", "SSTc", "Dc"].join(" | ")} |\n|---|---|---|---|---|`);
for (const [w, o] of Object.entries(out.concurrent)) md.push(`| ${w} | ${Object.values(o).map((v) => `${v.r} (n ${v.n})`).join(" | ")} |`);
for (const [t, res] of Object.entries(out.results)) {
  md.push(`\n## Đích ${t} (dị thường JJAS) — bỏ-từng-năm\n\n| mô hình | n | r LOYO | CI 90 % | skill MAE | CI 90 % | đúng dấu (năm lớn) |\n|---|---|---|---|---|---|---|`);
  for (const [n, v] of Object.entries(res)) md.push(v.skip ? `| ${n} | ${v.n} | bỏ | | | | |` : `| ${n} | ${v.n} | ${v.r} | [${v.r_ci90}] | ${v.skill} | [${v.skill_ci90}] | ${v.signHitBig ?? "—"} (${v.nBig}) |`);
}
md.push(`\n## Bảng năm (dị thường JJAS; τ ×10⁻³ N/m²; M m²/s; w m/ngày; UI °C)\n\n| năm | SCU_ti | SCU_tE | SCU_Mek | SCU_wEk | OFU_ti | OFU_wEk | MKU_ti | NCU_tN | UI_SCU | UI_OFU | SSTc | Dc | khởi phát gió | ONI DJF | ONI JJA | PDO MAM |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of years) md.push(`| ${r.y} | ${(r.SCU_ti * 1e3).toFixed(1)} | ${(r.SCU_tE * 1e3).toFixed(1)} | ${r.SCU_Mek?.toFixed(3)} | ${r.SCU_wEk?.toFixed(2)} | ${(r.OFU_ti * 1e3).toFixed(1)} | ${r.OFU_wEk?.toFixed(2)} | ${(r.MKU_ti * 1e3).toFixed(1)} | ${(r.NCU_tN * 1e3).toFixed(1)} | ${r.UI_SCU?.toFixed(2)} | ${r.UI_OFU?.toFixed(2)} | ${r.SSTc?.toFixed(2)} | ${r.Dc?.toFixed(2)} | ${Number.isFinite(r.onsetW) ? r.onsetW : "—"} | ${r.oni_DJF ?? ""} | ${r.oni_JJA ?? ""} | ${r.pdo_MAM?.toFixed(2)} |`);
md.push(`\n## Hệ số toàn mẫu\n\n${JSON.stringify(out.full)}\n`);
writeFileSync(OUT + "ket-qua-ekman.md", md.join("\n"));
console.error("xong →", OUT + "ket-qua-ekman.md");
