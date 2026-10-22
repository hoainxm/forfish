#!/usr/bin/env node
// phan-tich-du-bao-moi.mjs — THỬ DỰ BÁO MỒI 1–3 TUẦN (docs/research/du-bao-ca-dong-dan-2026-10/13-du-bao-moi.md).
// Phát dự báo ở đầu mỗi mốc chl 8 ngày t0 (tháng 5–10); lúc đó đã biết chl mốc [t0−8, t0).
// Mục tiêu: dị thường log10 chl của mốc kết thúc sau L = 8 / 16 / 24 ngày (mốc [t0+L−8, t0+L)).
// Gió = dị thường ứng suất đông τ_E của hộp (chỉ số mạnh nhất ở 12-gio-moi.md), trung bình 16 ngày [a−8, a+8)
// quanh mốc mục tiêu a (chl phản ứng sau 0–16 ngày).
//   P (đối thủ)  : chl = c + a·chl_vừa_qua                       (quán tính tắt dần)
//   Q            : + gió QUAN SÁT tới lúc phát (phần cửa sổ trước t0; L ≥ 16 thì không có ⇒ Q = P)
//   F (thử)      : + gió: quan sát trước t0, DỰ BÁO ECMWF IFS từ t0 (ngoài tầm dự báo = khí hậu, dị thường 0)
//   O (trần)     : + gió QUAN SÁT cả cửa sổ (biết trước tương lai — không làm được thật)
// Hệ số học trên 1998–2023 bằng gió quan sát CMEMS (bỏ-từng-năm khi chấm trên chính 1998–2023), GIỮ CỐ ĐỊNH khi thử
// 2024–2026 với gió dự báo thật (tai-gio-du-bao.mjs). Lệch gió dự báo theo tầm: hiệu chỉnh bằng các năm thử KHÁC.
// Ra $SDFISH_DATA_DIR/dong-dan/ket-qua/du-bao-moi.{json,md}.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { mean, pearson, makeRng, quantile as q, doy, addDays, loadChlBoxes, anomBySlot, loadGioNgay, anomDaily } from "./chl-gio.mjs";

const RAW = join(dataDir(), "hindcast-ntb"), OUT = join(dataDir(), "dong-dan", "ket-qua");
mkdirSync(OUT, { recursive: true });
const BX = ["SCU", "OFU", "MKU"], LS = [8, 16, 24], TRAIN = [1998, 2023], RHO_A = 1.22, CD = 1.2e-3;
const rnd = makeRng(11);

// ── dữ liệu ─────────────────────────────────────────────────────────────────
const { chl } = loadChlBoxes(RAW, BX);
const chlA = Object.fromEntries(BX.map((b) => [b, anomBySlot(chl[b]).anom]));
const gio = loadGioNgay(RAW);
const W = Object.fromEntries(BX.map((b) => [b, anomDaily(gio[`${b}_tE`])]));
const lastObs = [...W.SCU.anom.keys()].sort().at(-1);
// gió dự báo: ngày phát → hộp → [dị thường thô theo tầm ngày 0..]
const FDIR = join(RAW, "gio-du-bao", "ecmwf_ifs");
const FC = {};
for (const f of readdirSync(FDIR).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(join(FDIR, f), "utf8")), t0 = f.slice(0, 10);
  FC[t0] = {};
  for (const b of BX) {
    const pts = j.points.filter((p) => p.box === b), byDay = new Map();
    for (const p of pts) for (let h = 0; h < j.time.length; h++) {
      const s = p.s[h], dd = p.d[h]; if (s == null || dd == null) continue;
      const r = (dd * Math.PI) / 180, u = -s * Math.sin(r), d = j.time[h].slice(0, 10);
      const e = byDay.get(d) ?? byDay.set(d, new Map()).get(d), k = `${p.lat},${p.lon}`, a = e.get(k) ?? e.set(k, { s: 0, n: 0 }).get(k);
      a.s += RHO_A * CD * s * u; a.n++;
    }
    const lead = [];
    for (let l = 0; l < 16; l++) {
      const d = addDays(t0, l), e = byDay.get(d);
      const v = e ? [...e.values()].filter((a) => a.n >= 18).map((a) => a.s / a.n) : [];
      lead.push(v.length >= 6 ? mean(v) - W[b].clim[doy(d)] : NaN);
    }
    FC[t0][b] = lead;
  }
}
const fcDates = Object.keys(FC).sort();
console.error("gió dự báo:", fcDates.length, "lần phát", fcDates[0], "→", fcDates.at(-1), "· gió quan sát tới", lastObs);

// ── chất lượng chính gió dự báo theo tầm (so gió quan sát CMEMS cùng ngày) ──
const windSkill = {};
for (const b of BX) {
  windSkill[b] = [];
  for (let l = 0; l < 16; l++) {
    const P = fcDates.map((t0) => [FC[t0][b][l], W[b].anom.get(addDays(t0, l))]).filter(([f, o]) => Number.isFinite(f) && Number.isFinite(o));
    if (P.length < 10) { windSkill[b].push({ l, n: P.length }); continue; }
    windSkill[b].push({ l, n: P.length, r: +pearson(P.map((x) => x[0]), P.map((x) => x[1])).toFixed(3), lech: +(mean(P.map((x) => x[0] - x[1])) * 1e3).toFixed(2) });
  }
}
// lệch theo tầm, tính trên các NĂM THỬ KHÁC năm đang chấm
const biasExcl = (b, l, y) => { const v = fcDates.filter((t0) => +t0.slice(0, 4) !== y).map((t0) => FC[t0][b][l] - W[b].anom.get(addDays(t0, l))).filter(Number.isFinite); return v.length >= 5 ? mean(v) : 0; };

// ── mẫu: mỗi (hộp, L, ngày phát) ────────────────────────────────────────────
const winMean = (b, a, src) => { // src(day) → giá trị hoặc undefined; cần ≥ 12/16 ngày có số (trừ khi cố ý bỏ)
  const v = []; for (let i = -8; i < 8; i++) { const x = src(addDays(a, i)); if (Number.isFinite(x)) v.push(x); }
  return v;
};
function sample(b, L, t0, useFc) {
  const x1 = chlA[b].get(addDays(t0, -8)), a = addDays(t0, L - 8), y = chlA[b].get(a);
  if (!Number.isFinite(x1) || !Number.isFinite(y)) return null;
  const obs = winMean(b, a, (d) => W[b].anom.get(d));
  const past = winMean(b, a, (d) => (d < t0 ? W[b].anom.get(d) : undefined));
  const s = { t0, y: +t0.slice(0, 4), m: +t0.slice(5, 7), x1, yv: y, xO: obs.length >= 12 ? mean(obs) : NaN, xQ: past.length >= 6 ? mean(past) : NaN };
  if (useFc && FC[t0]) {
    const bias = (l) => biasExcl(b, l, s.y);
    const vRaw = [], vCor = []; let nf = 0;
    for (let i = -8; i < 8; i++) {
      const d = addDays(a, i);
      if (d < t0) { const o = W[b].anom.get(d); if (Number.isFinite(o)) { vRaw.push(o); vCor.push(o); } continue; }
      const l = Math.round((Date.parse(d) - Date.parse(t0)) / 864e5), f = FC[t0][b][l];
      if (Number.isFinite(f)) { vRaw.push(f); vCor.push(f - bias(l)); nf++; } else { vRaw.push(0); vCor.push(0); } // ngoài tầm ⇒ khí hậu
    }
    s.xF = mean(vRaw); s.xFc = mean(vCor); s.nFc = nf;
  }
  return s;
}
const issueDates = (y0, y1) => { const out = []; for (let y = y0; y <= y1; y++) for (let k = 1; k < 46; k++) { const d = new Date(Date.UTC(y, 0, 1) + k * 8 * 864e5).toISOString().slice(0, 10); const m = +d.slice(5, 7); if (m >= 5 && m <= 10) out.push(d); } return out; };

// ── hồi quy nhỏ ─────────────────────────────────────────────────────────────
function ols(X, y) { const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0)); for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += X[k][i] * X[k][j]; A[i][p] += X[k][i] * y[k]; } for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; for (let r = 0; r < p; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c <= p; c++) A[r][c] -= f * A[i][c]; } } return A.map((r, i) => (r[i] ? r[p] / r[i] : 0)); }
const dot = (b, x) => b.reduce((s, bj, j) => s + bj * x[j], 0);
const FEAT = { P: (s) => [1, s.x1], Q: (s) => [1, s.x1, s.xQ], O: (s) => [1, s.x1, s.xO] };
const fit = (rows, kind) => ols(rows.map(FEAT[kind]), rows.map((s) => s.yv));
// chấm: MSE skill so P (cùng mẫu) + tương quan, CI 90 % bootstrap theo khối (năm hoặc năm-tháng)
function score(rows, preds, blockOf) {
  const blocks = [...new Set(rows.map(blockOf))], idxOf = new Map(blocks.map((k) => [k, rows.map((s, i) => [s, i]).filter(([s]) => blockOf(s) === k).map(([, i]) => i)]));
  const ss = (ix, k) => 1 - mean(ix.map((i) => (rows[i].yv - preds[k][i]) ** 2)) / mean(ix.map((i) => (rows[i].yv - preds.P[i]) ** 2));
  const all = rows.map((_, i) => i), out = { n: rows.length, khoi: blocks.length };
  for (const k of Object.keys(preds)) {
    const boot = []; for (let t = 0; t < 1000; t++) { const ix = []; for (let j = 0; j < blocks.length; j++) ix.push(...idxOf.get(blocks[Math.floor(rnd() * blocks.length)])); boot.push(ss(ix, k)); }
    out[k] = { r: +pearson(rows.map((s) => s.yv), preds[k]).toFixed(3), ss: +ss(all, k).toFixed(3), ci90: [+q(boot, 0.05).toFixed(3), +q(boot, 0.95).toFixed(3)] };
  }
  return out;
}

const out = { builtAt: new Date().toISOString(), train: TRAIN, gioQuanSatToi: lastObs, gioDuBao: { model: "ecmwf_ifs (Open-Meteo Single Runs)", n: fcDates.length, from: fcDates[0], to: fcDates.at(-1) }, windSkill, hindcast: {}, thu: {}, heSo: {} };
for (const b of BX) for (const L of LS) {
  const key = `${b}|L${L}`;
  // A. hindcast 1998–2023, bỏ-từng-năm: P, Q, O
  const H = issueDates(TRAIN[0], TRAIN[1]).map((t0) => sample(b, L, t0, false)).filter((s) => s && Number.isFinite(s.xO));
  const useQ = L === 8;
  const pH = { P: [], O: [] }; if (useQ) pH.Q = [];
  for (const y of [...new Set(H.map((s) => s.y))]) {
    const tr = H.filter((s) => s.y !== y), te = H.map((s, i) => [s, i]).filter(([s]) => s.y === y);
    const cP = fit(tr, "P"), cO = fit(tr, "O"), cQ = useQ ? fit(tr.filter((s) => Number.isFinite(s.xQ)), "Q") : null;
    for (const [s, i] of te) { pH.P[i] = dot(cP, FEAT.P(s)); pH.O[i] = dot(cO, FEAT.O(s)); if (useQ) pH.Q[i] = Number.isFinite(s.xQ) ? dot(cQ, FEAT.Q(s)) : pH.P[i]; }
  }
  out.hindcast[key] = score(H, pH, (s) => s.y);
  // B. thử 2024–2026 với gió dự báo thật, hệ số học trên toàn 1998–2023
  const cP = fit(H, "P"), cO = fit(H, "O"), cQ = useQ ? fit(H.filter((s) => Number.isFinite(s.xQ)), "Q") : null;
  out.heSo[key] = { P: cP.map((v) => +v.toFixed(4)), O: cO.map((v) => +v.toFixed(4)), Q: cQ?.map((v) => +v.toFixed(4)) ?? null };
  const T = fcDates.map((t0) => sample(b, L, t0, true)).filter((s) => s && Number.isFinite(s.xF) && Number.isFinite(s.xO));
  if (T.length < 10) { out.thu[key] = { n: T.length, bo: "ít mẫu" }; continue; }
  const pT = { P: T.map((s) => dot(cP, FEAT.P(s))), O: T.map((s) => dot(cO, FEAT.O(s))), F: T.map((s) => dot(cO, [1, s.x1, s.xF])), Fc: T.map((s) => dot(cO, [1, s.x1, s.xFc])) };
  if (useQ) pT.Q = T.map((s, i) => (Number.isFinite(s.xQ) ? dot(cQ, FEAT.Q(s)) : pT.P[i]));
  out.thu[key] = { ...score(T, pT, (s) => `${s.y}-${s.m}`), ngayDuBaoTB: +mean(T.map((s) => s.nFc)).toFixed(1) };
}
writeFileSync(join(OUT, "du-bao-moi.json"), JSON.stringify(out, null, 1));
// markdown
const fmt = (v) => (v ? `${v.ss} [${v.ci90}] · r ${v.r}` : "—");
const md = [`# Thử dự báo mồi 1–3 tuần — kết quả thô (${out.builtAt})\n`, `Hệ số học ${TRAIN.join("–")} (gió quan sát CMEMS). Gió dự báo: ${out.gioDuBao.model}, ${out.gioDuBao.n} lần phát ${out.gioDuBao.from} → ${out.gioDuBao.to}. Gió quan sát tới ${lastObs}. Ô = MSE skill so quán tính P [CI 90 %] · tương quan với chl thật.\n`];
md.push(`## 1. Chất lượng gió dự báo theo tầm (r với gió quan sát cùng ngày; lệch ×10⁻³ N/m²)\n\n| hộp | ${[0, 2, 4, 6, 8, 10, 12, 14].map((l) => `ngày ${l}`).join(" | ")} |\n|---|---|---|---|---|---|---|---|---|`);
for (const b of BX) md.push(`| ${b} | ${[0, 2, 4, 6, 8, 10, 12, 14].map((l) => { const v = windSkill[b][l]; return v.r === undefined ? `— (n ${v.n})` : `${v.r} (lệch ${v.lech}, n ${v.n})`; }).join(" | ")} |`);
md.push(`\n## 2. Hindcast ${TRAIN.join("–")} bỏ-từng-năm (không cần gió dự báo): Q = gió đã thấy, O = trần (biết gió tương lai)\n\n| hộp · tầm | n | P: r | Q | O (trần) |\n|---|---|---|---|---|`);
for (const [k, v] of Object.entries(out.hindcast)) md.push(`| ${k} | ${v.n} | ${v.P.r} | ${fmt(v.Q)} | ${fmt(v.O)} |`);
md.push(`\n## 3. Thử thật 2024–2026 với gió dự báo ECMWF IFS (hệ số cố định từ ${TRAIN.join("–")})\n\n| hộp · tầm | n (khối) | ngày gió dự báo TB trong cửa sổ | P: r | Q | F (dự báo, thô) | Fc (dự báo, chỉnh lệch) | O (trần) |\n|---|---|---|---|---|---|---|---|`);
for (const [k, v] of Object.entries(out.thu)) md.push(v.bo ? `| ${k} | ${v.n} | bỏ (${v.bo}) | | | | | |` : `| ${k} | ${v.n} (${v.khoi}) | ${v.ngayDuBaoTB} | ${v.P.r} | ${fmt(v.Q)} | ${fmt(v.F)} | ${fmt(v.Fc)} | ${fmt(v.O)} |`);
md.push(`\n## Hệ số (học trên ${TRAIN.join("–")}): [hằng, chl vừa qua, gió]\n\n${JSON.stringify(out.heSo)}\n`);
writeFileSync(join(OUT, "du-bao-moi.md"), md.join("\n"));
console.error("xong →", join(OUT, "du-bao-moi.md"));
