#!/usr/bin/env node
// phan-tich.mjs — BƯỚC C: triển vọng nước trồi Nam Trung Bộ theo mùa, thuần vật lý. Chỉ đọc raw/, ghi ra/.
//   Chỉ số: S = dị thường SST ven bờ (hộp 11,125–12,875°N × 108,875–110,375°E) trừ khí hậu ngày-trong-năm;
//           D = SST ven bờ − SST khơi (112,625–114,375°E) (âm = nước trồi mạnh). Mùa đích: JJA (T6–8).
//   Dự báo phát cuối tháng 4: đối thủ khí hậu (0) + quán tính (năm trước); ứng viên ONI (các mùa dẫn), PDO, gió xuân.
//   Kiểm: bỏ-từng-năm (LOYO), bootstrap theo năm cho CI. Không chọn tham số nào trên năm giữ ra.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
// Dữ liệu: $SDFISH_DATA_DIR/hindcast-ntb (Mac mặc định ~/sdfish-data) — tải bằng tai-*.mjs cùng thư mục. Ra: $SDFISH_DATA_DIR/dong-dan/ket-qua
const RAW = join(dataDir(), "hindcast-ntb") + "/", OUT = join(dataDir(), "dong-dan", "ket-qua") + "/";
mkdirSync(OUT, { recursive: true });
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const doy = (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;

// ── OISST theo ngày → S, D ────────────────────────────────────────────────
const COAST = { la: [11.125, 12.875], lo: [108.875, 110.375] }, OFF = { la: [11.125, 12.875], lo: [112.625, 114.375] };
const inBox = (b, la, lo) => la >= b.la[0] - 1e-6 && la <= b.la[1] + 1e-6 && lo >= b.lo[0] - 1e-6 && lo <= b.lo[1] + 1e-6;
const day = new Map(); // date → {c:[], o:[]}
// raw/oisst/YYYY-MM.csv: "YYYY-MM-DD,<264 số>" — 11 hàng lat (10,875 + 0,25·i) × 24 cột lon (108,625 + 0,25·j)
for (const f of readdirSync(RAW + "oisst/").filter((f) => f.endsWith(".csv")).sort()) {
  for (const l of readFileSync(RAW + "oisst/" + f, "utf8").split("\n")) {
    if (!l) continue;
    const p = l.split(","), d = p[0];
    const e = day.get(d) ?? day.set(d, { c: [], o: [] }).get(d);
    for (let k = 1; k < p.length; k++) {
      const x = +p[k]; if (!Number.isFinite(x)) continue;
      const i = Math.floor((k - 1) / 24), j = (k - 1) % 24, L = 10.875 + 0.25 * i, G = 108.625 + 0.25 * j;
      if (inBox(COAST, L, G)) e.c.push(x); else if (inBox(OFF, L, G)) e.o.push(x);
    }
  }
}
const dates = [...day.keys()].sort();
const coast = new Map(), diff = new Map();
for (const d of dates) { const e = day.get(d); if (e.c.length >= 10 && e.o.length >= 10) { coast.set(d, mean(e.c)); diff.set(d, mean(e.c) - mean(e.o)); } }
console.error("ngày OISST", dates.length, dates[0], dates.at(-1), "ô ven bờ/khơi", day.get(dates[0]).c.length, day.get(dates[0]).o.length);
// khí hậu ngày-trong-năm (trơn ±15 ngày), trên các năm NỀN 1982–2025 (giữ 2026 ngoài khí hậu)
function climo(series, yrs) {
  const by = Array.from({ length: 367 }, () => []);
  for (const [d, v] of series) { const y = +d.slice(0, 4); if (y >= yrs[0] && y <= yrs[1]) by[doy(new Date(d))].push(v); }
  const raw = by.map((a) => mean(a)), out = new Array(367).fill(NaN);
  for (let k = 1; k <= 366; k++) { const a = []; for (let j = -15; j <= 15; j++) { const kk = ((k + j - 1 + 366) % 366) + 1; if (Number.isFinite(raw[kk])) a.push(raw[kk]); } out[k] = mean(a); }
  return out;
}
const cS = climo(coast, [1982, 2025]), cD = climo(diff, [1982, 2025]);
const S = new Map(), D = new Map();
for (const [d, v] of coast) S.set(d, v - cS[doy(new Date(d))]);
for (const [d, v] of diff) D.set(d, v - cD[doy(new Date(d))]);
const seasonMean = (m, y, months) => mean([...m].filter(([d]) => +d.slice(0, 4) === y && months.includes(+d.slice(5, 7))).map(([, v]) => v));
// ngày khởi phát: ngày đầu ≥ 1/5 mà trung bình trượt 15 ngày của diff THÔ xuống tới mức "hè điển hình"
// = trung bình khí hậu của diff trong JJA (ngưỡng rút từ khí hậu 1982–2025, không đặt tay)
const THR = mean(cD.slice(152, 244).filter(Number.isFinite));
function onset(y) {
  const ds = dates.filter((d) => +d.slice(0, 4) === y && diff.has(d));
  for (let i = 14; i < ds.length; i++) {
    if (+ds[i].slice(5, 7) < 5) continue;
    const w = ds.slice(i - 14, i + 1).map((d) => diff.get(d));
    if (w.length === 15 && mean(w) <= THR) return doy(new Date(ds[i]));
  }
  return NaN;
}
console.error("ngưỡng khởi phát (diff JJA khí hậu)", THR.toFixed(2), "°C");
const peak = (y) => { const ds = dates.filter((d) => +d.slice(0, 4) === y && diff.has(d) && +d.slice(5, 7) >= 6 && +d.slice(5, 7) <= 9); let mn = Infinity; for (let i = 14; i < ds.length; i++) mn = Math.min(mn, mean(ds.slice(i - 14, i + 1).map((d) => diff.get(d)))); return mn === Infinity ? NaN : mn; };

// ── ONI / PDO / Niño3.4 ──────────────────────────────────────────────────
const oni = {}; // "YYYY-SEAS" → anom
for (const l of readFileSync(RAW + "chiso/oni.txt", "utf8").split("\n").slice(1)) { const p = l.trim().split(/\s+/); if (p.length >= 4) oni[`${p[1]}-${p[0]}`] = +p[3]; }
const pdo = {}; // "YYYY-MM" → value
for (const l of readFileSync(RAW + "chiso/pdo.txt", "utf8").split("\n")) { const p = l.trim().split(/\s+/); if (p.length === 13 && /^\d{4}$/.test(p[0])) p.slice(1).forEach((v, i) => { if (+v < 99) pdo[`${p[0]}-${String(i + 1).padStart(2, "0")}`] = +v; }); }
const pdoSeason = (y, months) => mean(months.map((m) => pdo[`${y}-${String(m).padStart(2, "0")}`]).filter(Number.isFinite));

// ── gió ERA5 → ứng suất dọc bờ ───────────────────────────────────────────
const THETA = (25 * Math.PI) / 180; // trục dọc bờ NTB ≈ 25° đông-bắc; dương = gió đẩy nước về đông-bắc (tây nam, thuận trồi)
const tauDay = new Map(); // date → [τ_a...] gộp 3 điểm
for (const f of readdirSync(RAW + "era5-3diem/").filter((f) => f.startsWith("era5-"))) {
  const j = JSON.parse(readFileSync(RAW + "era5-3diem/" + f, "utf8")), T = j.hourly.time, Sp = j.hourly.wind_speed_10m, Di = j.hourly.wind_direction_10m;
  const acc = new Map();
  for (let i = 0; i < T.length; i++) {
    const s = Sp[i], dir = Di[i]; if (!Number.isFinite(s) || !Number.isFinite(dir)) continue;
    const r = (dir * Math.PI) / 180, u = -s * Math.sin(r), v = -s * Math.cos(r); // gió "từ" hướng dir → vector thổi tới
    const tau = 1.22 * 1.2e-3 * s; // τ/|U| ; τ_vec = tau*(u,v)
    const ta = tau * (u * Math.sin(THETA) + v * Math.cos(THETA));
    const d = T[i].slice(0, 10); const e = acc.get(d) ?? acc.set(d, { s: 0, n: 0 }).get(d); e.s += ta; e.n++;
  }
  for (const [d, e] of acc) (tauDay.get(d) ?? tauDay.set(d, []).get(d)).push(e.s / e.n);
}
const tau = new Map([...tauDay].map(([d, a]) => [d, mean(a)]));
const cT = climo(tau, [1982, 2025]);
const TA = new Map([...tau].map(([d, v]) => [d, v - cT[doy(new Date(d))]]));
console.error("ngày gió", tau.size);

// ── bảng năm ─────────────────────────────────────────────────────────────
const years = [];
for (let y = 1982; y <= 2026; y++) {
  const r = {
    y, S_JJA: seasonMean(S, y, [6, 7, 8]), D_JJA: seasonMean(D, y, [6, 7, 8]), S_JA: seasonMean(S, y, [7, 8]), onset: onset(y), peak: peak(y),
    oni_JAS_prev: oni[`${y - 1}-JAS`], oni_SON_prev: oni[`${y - 1}-SON`], oni_DJF: oni[`${y}-DJF`], oni_MAM: oni[`${y}-MAM`], oni_JJA: oni[`${y}-JJA`],
    pdo_MAM: pdoSeason(y, [3, 4, 5]), pdo_SON_prev: pdoSeason(y - 1, [9, 10, 11]),
    tau_MAM: seasonMean(TA, y, [3, 4, 5]), tau_May: seasonMean(TA, y, [5]), tau_JJA: seasonMean(TA, y, [6, 7, 8]), tauRaw_JJA: seasonMean(tau, y, [6, 7, 8]),
  };
  years.push(r);
}
for (let i = 1; i < years.length; i++) years[i].S_prev = years[i - 1].S_JJA;
const Y = years.filter((r) => Number.isFinite(r.S_JJA) && Number.isFinite(r.S_prev) && Number.isFinite(r.oni_DJF));
console.error("năm dùng", Y.length, Y[0].y, Y.at(-1).y);

// ── hồi quy + LOYO ───────────────────────────────────────────────────────
function olsFit(X, y) { // X: n×p (kèm cột 1), nghiệm chuẩn
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += X[k][i] * X[k][j]; A[i][p] += X[k][i] * y[k]; }
  for (let i = 0; i < p; i++) { let mx = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; for (let r = 0; r < p; r++) if (r !== i && A[i][i]) { const f = A[r][i] / A[i][i]; for (let c = i; c <= p; c++) A[r][c] -= f * A[i][c]; } }
  return A.map((r, i) => (r[i] ? r[p] / r[i] : 0));
}
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0; for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
const MODELS = {
  "khí hậu (0)": () => [],
  "quán tính (S năm trước)": (r) => [r.S_prev],
  "ONI JAS năm trước (lead ~10 th)": (r) => [r.oni_JAS_prev],
  "ONI SON năm trước (lead ~8 th)": (r) => [r.oni_SON_prev],
  "ONI DJF (lead ~5 th)": (r) => [r.oni_DJF],
  "ONI MAM (lead ~2 th)": (r) => [r.oni_MAM],
  "ONI DJF + quán tính": (r) => [r.oni_DJF, r.S_prev],
  "ONI DJF × dấu PDO MAM": (r) => [r.oni_DJF, r.oni_DJF * Math.sign(r.pdo_MAM), r.pdo_MAM],
  "ONI JAS−1 × dấu PDO SON−1 (lead ~10 th)": (r) => [r.oni_JAS_prev, r.oni_JAS_prev * Math.sign(r.pdo_SON_prev), r.pdo_SON_prev],
  "ONI SON−1 + PDO SON−1 (lead ~8 th)": (r) => [r.oni_SON_prev, r.pdo_SON_prev],
  "gió xuân MAM": (r) => [r.tau_MAM],
  "gió tháng 5": (r) => [r.tau_May],
  "ONI DJF + gió tháng 5": (r) => [r.oni_DJF, r.tau_May],
  "[trần] gió JJA đồng thời": (r) => [r.tau_JJA],
  "[trần] ONI JJA đồng thời": (r) => [r.oni_JJA],
  "[trần] gió JJA + ONI JJA": (r) => [r.tau_JJA, r.oni_JJA],
};
function loyo(target, feat, rows) {
  const ok = rows.filter((r) => Number.isFinite(r[target]) && feat(r).every(Number.isFinite));
  if (ok.length < 8) return { n: ok.length, skip: "ít năm" };
  const pred = ok.map((_, i) => {
    const tr = ok.filter((_, j) => j !== i);
    const X = tr.map((r) => [1, ...feat(r)]), b = olsFit(X, tr.map((r) => r[target]));
    const x = [1, ...feat(ok[i])]; return b.reduce((s, bj, j) => s + bj * x[j], 0);
  });
  const y = ok.map((r) => r[target]);
  const abs = y.map((v, i) => Math.abs(v - pred[i]));
  const climAbs = y.map((v, i) => { const tr = y.filter((_, j) => j !== i); return Math.abs(v - mean(tr)); });
  // bootstrap theo năm: r và skill MAE so khí hậu (LOYO)
  let seed = 42; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const br = [], bs = [];
  for (let b = 0; b < 2000; b++) { const idx = y.map(() => Math.floor(rnd() * y.length)); const yy = idx.map((i) => y[i]), pp = idx.map((i) => pred[i]); br.push(pearson(yy, pp)); bs.push(1 - mean(idx.map((i) => abs[i])) / mean(idx.map((i) => climAbs[i]))); }
  br.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const q = (a, p) => a[Math.floor(p * (a.length - 1))];
  const my = mean(y), hit = [];
  y.forEach((v, i) => { if (Math.abs(v - my) > 0.5 * sd(y)) hit.push(Math.sign(v - my) === Math.sign(pred[i] - my)); });
  return { n: ok.length, r: +pearson(y, pred).toFixed(3), r_ci90: [+q(br, 0.05).toFixed(3), +q(br, 0.95).toFixed(3)], mae: +mean(abs).toFixed(3), mae_clim: +mean(climAbs).toFixed(3), skill: +(1 - mean(abs) / mean(climAbs)).toFixed(3), skill_ci90: [+q(bs, 0.05).toFixed(3), +q(bs, 0.95).toFixed(3)], signHitBig: hit.length ? +(hit.filter(Boolean).length / hit.length).toFixed(2) : null, nBig: hit.length, pred: Object.fromEntries(ok.map((r, i) => [r.y, +pred[i].toFixed(3)])) };
}
const out = { builtAt: new Date().toISOString(), box: { COAST, OFF }, years, results: {} };
for (const target of ["S_JJA", "D_JJA", "onset", "peak"]) {
  out.results[target] = {};
  for (const [name, feat] of Object.entries(MODELS)) out.results[target][name] = loyo(target, feat, Y);
}
// hệ số toàn mẫu cho vài mô hình chính + dự báo khoá trước hè 2027 từ ONI JAS 2026 và PDO
const full = (feat, target) => { const ok = Y.filter((r) => Number.isFinite(r[target]) && feat(r).every(Number.isFinite)); const b = olsFit(ok.map((r) => [1, ...feat(r)]), ok.map((r) => r[target])); const res = ok.map((r) => r[target] - b.reduce((s, bj, j) => s + bj * [1, ...feat(r)][j], 0)); return { beta: b.map((v) => +v.toFixed(3)), resSd: +sd(res).toFixed(3), n: ok.length }; };
out.full = { S_JJA_oniJASxPDO: full(MODELS["ONI JAS−1 × dấu PDO SON−1 (lead ~10 th)"], "S_JJA"), D_JJA_oniJASprev: full(MODELS["ONI JAS năm trước (lead ~10 th)"], "D_JJA"), D_JJA_oniDJF: full(MODELS["ONI DJF (lead ~5 th)"], "D_JJA"), S_JJA_oniJASprev: full(MODELS["ONI JAS năm trước (lead ~10 th)"], "S_JJA"), S_JJA_oniDJF: full(MODELS["ONI DJF (lead ~5 th)"], "S_JJA"), onset_oniJASprev: full(MODELS["ONI JAS năm trước (lead ~10 th)"], "onset"), S_JJA_oniDJFxPDO: full(MODELS["ONI DJF × dấu PDO MAM"], "S_JJA") };
const oniJAS2026 = oni["2026-JAS"], pdoNow = pdoSeason(2026, [7, 8, 9]);
const f1 = out.full.S_JJA_oniJASprev, f2 = out.full.onset_oniJASprev;
out.forecast2027 = { input: { oni_JAS_2026: oniJAS2026, pdo_JAS_2026: +pdoNow.toFixed(2) }, S_JJA_2027: { value: +(f1.beta[0] + f1.beta[1] * oniJAS2026).toFixed(2), pi80: +(1.28 * f1.resSd).toFixed(2) }, onset_2027_doy: { value: +(f2.beta[0] + f2.beta[1] * oniJAS2026).toFixed(0), pi80: +(1.28 * f2.resSd).toFixed(0) }, climatology: { S_sd: +sd(Y.map((r) => r.S_JJA)).toFixed(2), onset_mean: +mean(Y.map((r) => r.onset).filter(Number.isFinite)).toFixed(0), onset_sd: +sd(Y.map((r) => r.onset).filter(Number.isFinite)).toFixed(0) } };
writeFileSync(OUT + "ket-qua.json", JSON.stringify(out, null, 1));
// markdown
const md = [`# Bước C — kết quả thô (${out.builtAt})\n`];
md.push(`Năm dùng: ${Y.length} (${Y[0].y}–${Y.at(-1).y}). Hộp ven bờ ${JSON.stringify(COAST)}, khơi ${JSON.stringify(OFF)}.\n`);
md.push(`## Bảng năm\n\n| năm | S_JJA | D_JJA | khởi phát (doy) | đỉnh D 15 ngày | ONI JAS−1 | ONI DJF | ONI MAM | ONI JJA | PDO MAM | τ_a MAM | τ_a T5 | τ_a JJA |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of years) md.push(`| ${r.y} | ${r.S_JJA?.toFixed(2)} | ${r.D_JJA?.toFixed(2)} | ${Number.isFinite(r.onset) ? r.onset : "—"} | ${r.peak?.toFixed(2)} | ${r.oni_JAS_prev ?? ""} | ${r.oni_DJF ?? ""} | ${r.oni_MAM ?? ""} | ${r.oni_JJA ?? ""} | ${r.pdo_MAM?.toFixed(2)} | ${(r.tau_MAM * 1e3)?.toFixed(1)} | ${(r.tau_May * 1e3)?.toFixed(1)} | ${(r.tau_JJA * 1e3)?.toFixed(1)} |`);
for (const [target, res] of Object.entries(out.results)) {
  md.push(`\n## Đích ${target} — bỏ-từng-năm\n\n| mô hình | n | r LOYO | CI 90 % | MAE | MAE khí hậu | skill MAE | CI 90 % | đúng dấu (năm lớn) |\n|---|---|---|---|---|---|---|---|---|`);
  for (const [name, v] of Object.entries(res)) md.push(v.skip ? `| ${name} | ${v.n} | bỏ (${v.skip}) | | | | | | |` : `| ${name} | ${v.n} | ${v.r} | [${v.r_ci90}] | ${v.mae} | ${v.mae_clim} | ${v.skill} | [${v.skill_ci90}] | ${v.signHitBig ?? "—"} (${v.nBig}) |`);
}
md.push(`\n## Hệ số toàn mẫu\n\n${JSON.stringify(out.full)}\n\n## Dự báo khoá trước hè 2027\n\n${JSON.stringify(out.forecast2027)}\n`);
writeFileSync(OUT + "ket-qua.md", md.join("\n"));
console.error("xong →", OUT + "ket-qua.md");
