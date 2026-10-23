// buoc17-san-luong.mjs — bước 17: sản lượng cá biển theo tỉnh × năm (NSO PxWeb) ↔ gió hè, chl hè, ONI.
// Giả thuyết, nhóm tỉnh, cách khử xu thế, luật quyết: ĐĂNG KÝ TRƯỚC ở
// docs/research/du-bao-ca-dong-dan-2026-10/17-san-luong-nhieu-nam.md §2 — sửa script thì không sửa luật.
//
// Đầu vào (ngoài git, $SDFISH_DATA_DIR/hindcast-ntb/):
//   san-luong/V06.66.json  cá biển khai thác theo tỉnh (nghìn tấn), V06.65 tổng khai thác (tấn),
//   san-luong/V06.60.json  tổng công suất tàu ≥ 90 CV (2010→), V07.05 sản phẩm công nghiệp (nước mắm)
//     — JSON-stat tải từ pxweb.nso.gov.vn (cách tải: 17 §1).
//   cmems-gio/chiso-ngay.json, chl-occi/, chiso/oni.txt (như 12).
// Ra: $SDFISH_DATA_DIR/dong-dan/buoc17/buoc17.{json,md}
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { mean, pearson, makeRng, quantile as q, slot, loadChlBoxes, anomBySlot, loadGioNgay } from "./chl-gio.mjs";

const RAW = join(dataDir(), "hindcast-ntb"), SL = join(RAW, "san-luong"), OUT = join(dataDir(), "dong-dan", "buoc17");
mkdirSync(OUT, { recursive: true });
const rnd = makeRng(17);

// ── 1. sản lượng: JSON-stat 2 chiều (tỉnh × năm) ───────────────────────────
const norm = (s) => s.normalize("NFC").replace(/\s+/g, " ").replace(/oà/g, "òa").replace(/oá/g, "óa").replace(/oả/g, "ỏa").replace(/uỷ/g, "ủy").trim();
function readPx(file) {
  const txt = readFileSync(join(SL, file), "utf8").replace(/^﻿/, "").replace(/\0+$/, "").trim();
  const d = JSON.parse(txt).dataset, dims = d.dimension, ids = dims.id, size = dims.size;
  const lab = (k) => Object.values(dims[k].category.label);
  return { d, ids, size, lab };
}
function provYear(file) { // → { tỉnh: { năm: giá trị } }
  const { d, ids, size, lab } = readPx(file);
  const P = lab(ids[0]).map(norm), Y = lab(ids[1]).map((y) => +y.replace(/\D/g, ""));
  const out = {};
  P.forEach((p, i) => { out[p] = {}; Y.forEach((y, j) => { const v = d.value[i * size[1] + j]; if (typeof v === "number" && v > 0) out[p][y] = v; }); });
  return out;
}
const CA = provYear("V06.66.json"), TONG = provYear("V06.65.json"), CS = provYear("V06.60.json");
const GROUPS = {
  SCU: ["Ninh Thuận", "Bình Thuận"],
  MKU: ["Bà Rịa - Vũng Tàu", "Tiền Giang", "Bến Tre", "Trà Vinh", "Sóc Trăng", "Bạc Liêu"],
  NCU: ["Khánh Hòa", "Phú Yên", "Bình Định"],
  GIA_BACBO: ["Quảng Ninh", "Hải Phòng", "Thái Bình", "Nam Định", "Ninh Bình", "Thanh Hóa", "Nghệ An", "Hà Tĩnh"],
  GIA_KIENGIANG: ["Kiên Giang"],
};
const sumGroup = (tab, names, y) => { let s = 0; for (const n of names) { const v = tab[n]?.[y]; if (!Number.isFinite(v)) return NaN; s += v; } return s; };
for (const [g, ns] of Object.entries(GROUPS)) for (const n of ns) if (!CA[n] || !TONG[n]) throw new Error(`thiếu tỉnh ${n} (${g})`);

// ── 2. chỉ số vật lý theo năm (dị thường hè 6–9, như 12) ───────────────────
const BX = ["SCU", "NCU", "MKU"];
const WK = { SCU: "SCU_tE", NCU: "NCU_tN", MKU: "MKU_tE" };
const { chl } = loadChlBoxes(RAW, BX);
const chlA = Object.fromEntries(BX.map((b) => [b, anomBySlot(chl[b]).anom]));
const gio = loadGioNgay(RAW);
const win8 = (m, start) => { const v = []; for (let i = 0; i < 8; i++) { const d = new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10); if (m[d] !== undefined) v.push(m[d]); } return v.length >= 6 ? mean(v) : NaN; };
const slots = []; for (let y = 1994; y <= 2026; y++) for (let s = 0; s < 46; s++) slots.push(new Date(Date.UTC(y, 0, 1) + s * 8 * 864e5).toISOString().slice(0, 10));
const windA = Object.fromEntries(BX.map((b) => [b, anomBySlot(new Map(slots.map((d) => [d, win8(gio[WK[b]], d)]).filter(([, v]) => Number.isFinite(v)))).anom]));
const seas = (m, y, minFrac) => { const v = [...m].filter(([d]) => +d.slice(0, 4) === y && [6, 7, 8, 9].includes(+d.slice(5, 7))).map(([, x]) => x); return v.length >= minFrac * (122 / 8) ? mean(v) : NaN; };
const oni = {}; for (const l of readFileSync(join(RAW, "chiso", "oni.txt"), "utf8").split("\n").slice(1)) { const p = l.trim().split(/\s+/); if (p.length >= 4) oni[`${p[1]}-${p[0]}`] = +p[3]; }
const IDX = {}; // IDX[y] = { gio_SCU, chl_SCU, ..., oni }
for (let y = 1994; y <= 2027; y++) { IDX[y] = { oni: oni[`${y}-DJF`] }; for (const b of BX) { IDX[y][`gio_${b}`] = seas(windA[b], y, 0.85); IDX[y][`chl_${b}`] = seas(chlA[b], y, 0.6); } }

// ── 3. khử xu thế ───────────────────────────────────────────────────────────
const linResid = (xs, ys, deg = 1) => { // hồi quy đa thức bậc deg theo năm (chuẩn hoá), trả phần dư
  const xm = mean(xs), xsd = Math.sqrt(mean(xs.map((x) => (x - xm) ** 2))) || 1, X = xs.map((x) => (x - xm) / xsd);
  const k = deg + 1, A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0);
  X.forEach((x, i) => { const p = Array.from({ length: k }, (_, j) => x ** j); for (let r = 0; r < k; r++) { b[r] += p[r] * ys[i]; for (let c = 0; c < k; c++) A[r][c] += p[r] * p[c]; } });
  for (let i = 0; i < k; i++) { const piv = A[i][i]; for (let j = i + 1; j < k; j++) { const f = A[j][i] / piv; for (let c = i; c < k; c++) A[j][c] -= f * A[i][c]; b[j] -= f * b[i]; } }
  const beta = new Array(k).fill(0); for (let i = k - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < k; j++) s -= A[i][j] * beta[j]; beta[i] = s / A[i][i]; }
  return ys.map((y, i) => y - beta.reduce((s, bb, j) => s + bb * X[i] ** j, 0));
};
/** Trả cặp (x, y) đã khử theo cách m cho cửa sổ năm [y0, y1]; series(y) = sản lượng, xOf(y) = chỉ số. */
function pairs(series, xOf, m, y0, y1, lagC = 0) {
  const yrs = []; for (let y = y0; y <= y1; y++) yrs.push(y);
  if (m === "a" || m === "d") {
    const R = yrs.map((y) => ({ y, c: Math.log(series(y + lagC)), x: xOf(y) })).filter((r) => Number.isFinite(r.c) && Number.isFinite(r.x));
    const res = linResid(R.map((r) => r.y), R.map((r) => r.c), m === "a" ? 1 : 2);
    return R.map((r, i) => ({ y: r.y, c: res[i], x: r.x }));
  }
  if (m === "b") return yrs.map((y) => ({ y, c: Math.log(series(y + lagC)) - Math.log(series(y + lagC - 1)), x: xOf(y) - xOf(y - 1) })).filter((r) => Number.isFinite(r.c) && Number.isFinite(r.x));
  if (m === "c") return yrs.map((y) => { const prev = [1, 2, 3, 4, 5].map((k) => series(y + lagC - k)); return { y, c: Math.log(series(y + lagC) / mean(prev)), x: xOf(y) }; }).filter((r) => Number.isFinite(r.c) && Number.isFinite(r.x));
  throw new Error(m);
}

// ── 4. thống kê ─────────────────────────────────────────────────────────────
const r1 = (a) => pearson(a.slice(1), a.slice(0, -1));
function stat(P, { boot = 2000, perm = 5000 } = {}) {
  const n = P.length; if (n < 8) return { n };
  const X = P.map((p) => p.x), C = P.map((p) => p.c), r = pearson(X, C);
  const B = []; for (let i = 0; i < boot; i++) { const S = P.map(() => P[Math.floor(rnd() * n)]); const v = pearson(S.map((s) => s.x), S.map((s) => s.c)); if (Number.isFinite(v)) B.push(v); }
  let ge = 0; for (let i = 0; i < perm; i++) { const Xp = [...X]; for (let j = n - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [Xp[j], Xp[k]] = [Xp[k], Xp[j]]; } if (Math.abs(pearson(Xp, C)) >= Math.abs(r)) ge++; }
  const loo = P.map((_, i) => pearson(X.filter((_, j) => j !== i), C.filter((_, j) => j !== i)));
  const a1 = r1(X), c1 = r1(C), neff = Math.min(n, Math.max(3, Math.round((n * (1 - a1 * c1)) / (1 + a1 * c1))));
  return { n, neff, r: +r.toFixed(3), ci90: [+q(B, 0.05).toFixed(3), +q(B, 0.95).toFixed(3)], p: +((ge + 1) / (perm + 1)).toFixed(4), looMin: +Math.min(...loo).toFixed(3), looMax: +Math.max(...loo).toFixed(3), years: [P[0].y, P.at(-1).y] };
}
const bh = (ps, qv = 0.1) => { const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p); let k = -1; o.forEach((e, j) => { if (e.p <= ((j + 1) / ps.length) * qv) k = j; }); const pass = new Array(ps.length).fill(false); for (let j = 0; j <= k; j++) pass[o[j].i] = true; return pass; };

// ── 5. phép thử chính P1–P6 + kiểm giả ─────────────────────────────────────
const catchOf = (tab, names) => (y) => sumGroup(tab, names, y);
const idx = (key, shift = 0) => (y) => IDX[y + shift]?.[key] ?? NaN;
const METHODS = ["a", "b", "c", "d"];
const W0 = 1998, W1 = 2025;
const PRIMARY = [
  { id: "P1", g: "SCU", key: "gio_SCU", sign: +1 }, { id: "P2", g: "SCU", key: "chl_SCU", sign: +1 }, { id: "P3", g: "SCU", key: "oni", sign: -1 },
  { id: "P4", g: "MKU", key: "gio_MKU", sign: +1 }, { id: "P5", g: "MKU", key: "chl_MKU", sign: +1 }, { id: "P6", g: "MKU", key: "oni", sign: -1 },
];
const out = { builtAt: new Date().toISOString(), cuaSo: [W0, W1], primary: {}, fake: {}, phu: {}, nam: {} };
for (const T of PRIMARY) {
  const ser = catchOf(CA, GROUPS[T.g]), res = {};
  for (const m of METHODS) res[m] = stat(pairs(ser, idx(T.key), m, W0, W1));
  res.giaThoiGian = stat(pairs(ser, idx(T.key, +1), "a", W0, W1)); // chỉ số năm t+1 ↔ sản lượng t
  const chieu = (s) => Number.isFinite(s.r) && Math.sign(s.r) === T.sign && Math.sign(s.ci90[0]) === T.sign && Math.sign(s.ci90[1]) === T.sign;
  res.dieuKien = {
    ciDungChieu: ["a", "b", "c"].filter((m) => chieu(res[m])).length,
    looDungChieu: T.sign > 0 ? res.a.looMin > 0 : res.a.looMax < 0,
    giaThoiGianNhoHon: Math.abs(res.giaThoiGian.r) < Math.abs(res.a.r),
  };
  out.primary[T.id] = { ...T, tinh: GROUPS[T.g], ...res };
}
// kiểm giả không gian: tỉnh xa với chỉ số SCU
for (const g of ["GIA_BACBO", "GIA_KIENGIANG"]) for (const key of ["gio_SCU", "chl_SCU", "oni"]) out.fake[`${g}|${key}`] = Object.fromEntries(["a", "b", "c"].map((m) => [m, stat(pairs(catchOf(CA, GROUPS[g]), idx(key), m, W0, W1), { perm: 2000 })]));
const pass = bh(PRIMARY.map((T) => out.primary[T.id].a.p));
PRIMARY.forEach((T, i) => {
  const o = out.primary[T.id];
  const fakeMax = Math.max(...["GIA_BACBO", "GIA_KIENGIANG"].map((g) => Math.abs(out.fake[`${g}|${T.key}`]?.a.r ?? 0)));
  o.dieuKien.giaKhongGianNhoHon = T.g === "SCU" ? fakeMax < Math.abs(o.a.r) : null; // luật 4 chỉ áp cho P1–P3
  o.dieuKien.bh = pass[i];
  o.QUA = o.dieuKien.ciDungChieu >= 2 && o.dieuKien.looDungChieu && o.dieuKien.giaThoiGianNhoHon && (o.dieuKien.giaKhongGianNhoHon ?? true) && o.dieuKien.bh;
});

// ── 6. phụ (không vào luật quyết) ───────────────────────────────────────────
const phu = (name, ser, key, opt = {}) => { out.phu[name] = Object.fromEntries((opt.methods ?? ["a", "b", "c"]).map((m) => [m, stat(pairs(ser, idx(key), m, opt.y0 ?? W0, opt.y1 ?? W1, opt.lag ?? 0), { perm: 2000 })])); };
for (const T of PRIMARY) {
  const ser = catchOf(CA, GROUPS[T.g]);
  phu(`${T.id} trễ +1 năm`, ser, T.key, { lag: 1, y1: W1 - 1 });
  phu(`${T.id} bỏ 2025 sơ bộ`, ser, T.key, { y1: 2024 });
  phu(`${T.id} đích V06.65 tổng khai thác`, catchOf(TONG, GROUPS[T.g]), T.key);
  if (T.key !== `chl_${T.g}`) phu(`${T.id} cửa sổ 1995–2025`, ser, T.key, { y0: 1995 });
  // CPUE thô: sản lượng / tổng công suất tàu ≥ 90 CV (2010→)
  phu(`${T.id} CPUE thô (÷ công suất tàu ≥90 CV)`, (y) => sumGroup(CA, GROUPS[T.g], y) / sumGroup(CS, GROUPS[T.g], y), T.key, { y0: 2011, methods: ["a", "b"] });
}
for (const b of BX) for (const key of [`gio_${b}`, `chl_${b}`, "oni"]) for (const n of GROUPS[b]) phu(`tỉnh ${n} ~ ${key}`, (y) => CA[n][y], key);
for (const key of ["gio_NCU", "chl_NCU", "oni"]) phu(`NCU nhóm ~ ${key}`, catchOf(CA, GROUPS.NCU), key);
// nước mắm cả nước (proxy cá cơm, rất thô) ~ chl SCU, chl MKU
{
  const { d, ids, size, lab } = readPx("V07.05.json");
  const items = lab(ids[0]), Y = lab(ids[1]).map((y) => +y.replace(/\D/g, "")), i = items.findIndex((s) => s.startsWith("Nước mắm"));
  const nm = {}; Y.forEach((y, j) => { const v = d.value[i * size[1] + j]; if (typeof v === "number") nm[y] = v; });
  for (const key of ["chl_SCU", "chl_MKU", "gio_SCU", "oni"]) phu(`nước mắm cả nước ~ ${key}`, (y) => nm[y], key);
  out.nuocMam = nm;
}
// bảng năm để in
for (let y = 1995; y <= 2025; y++) out.nam[y] = { SCU: sumGroup(CA, GROUPS.SCU, y), MKU: sumGroup(CA, GROUPS.MKU, y), NCU: sumGroup(CA, GROUPS.NCU, y), ...Object.fromEntries(Object.entries(IDX[y]).map(([k, v]) => [k, Number.isFinite(v) ? +v.toFixed(4) : null])) };

writeFileSync(join(OUT, "buoc17.json"), JSON.stringify(out, null, 1));
// ── 7. md ───────────────────────────────────────────────────────────────────
const f = (s) => (s?.n >= 8 ? `${s.r.toFixed(2)} [${s.ci90[0].toFixed(2)}, ${s.ci90[1].toFixed(2)}] p ${s.p} · n ${s.n} (hiệu dụng ${s.neff})` : `n ${s?.n ?? 0}`);
const md = [`# Bước 17 — bảng số (chạy ${out.builtAt.slice(0, 10)})`, "", "r Pearson [CI 90 % bootstrap theo năm] p hoán vị hai phía · n năm (n hiệu dụng theo tự tương quan bậc 1). Cách khử: a tuyến tính · b sai phân năm · c so trung bình 5 năm trước · d bậc hai.", "", "## Sáu phép thử chính (cửa sổ 1998–2025)", "", "| | nhóm ~ chỉ số (chiều kỳ vọng) | a | b | c | d | bỏ-từng-năm (a) | giả: chỉ số năm t+1 (a) | điều kiện | QUA |", "|---|---|---|---|---|---|---|---|---|---|"];
for (const T of PRIMARY) { const o = out.primary[T.id]; md.push(`| ${T.id} | ${T.g} ~ ${T.key} (${T.sign > 0 ? "+" : "−"}) | ${f(o.a)} | ${f(o.b)} | ${f(o.c)} | ${f(o.d)} | ${o.a.looMin} … ${o.a.looMax} | ${o.giaThoiGian.r} | CI đúng chiều ${o.dieuKien.ciDungChieu}/3 · LOO ${o.dieuKien.looDungChieu ? "✓" : "✗"} · giả t+1 ${o.dieuKien.giaThoiGianNhoHon ? "✓" : "✗"} · giả xa ${o.dieuKien.giaKhongGianNhoHon === null ? "—" : o.dieuKien.giaKhongGianNhoHon ? "✓" : "✗"} · BH ${o.dieuKien.bh ? "✓" : "✗"} | **${o.QUA ? "QUA" : "KHÔNG"}** |`); }
md.push("", "## Kiểm giả không gian (tỉnh xa ~ chỉ số SCU)", "", "| nhóm ~ chỉ số | a | b | c |", "|---|---|---|---|");
for (const [k, v] of Object.entries(out.fake)) md.push(`| ${k} | ${f(v.a)} | ${f(v.b)} | ${f(v.c)} |`);
md.push("", "## Phụ (không vào luật quyết)", "", "| phép | a | b | c |", "|---|---|---|---|");
for (const [k, v] of Object.entries(out.phu)) md.push(`| ${k} | ${f(v.a)} | ${f(v.b)} | ${v.c ? f(v.c) : "—"} |`);
md.push("", "## Bảng năm (cá biển khai thác, nghìn tấn; chỉ số dị thường hè 6–9)", "", "| năm | SCU | MKU | NCU | gió SCU ×10³ | chl SCU | gió MKU ×10³ | chl MKU | gió NCU ×10³ | chl NCU | ONI T12–2 |", "|---|---|---|---|---|---|---|---|---|---|---|");
const g3 = (v) => (v === null || v === undefined ? "" : (v * 1e3).toFixed(1)), c3 = (v) => (v === null || v === undefined ? "" : v.toFixed(3));
for (const [y, r] of Object.entries(out.nam)) md.push(`| ${y} | ${r.SCU.toFixed(1)} | ${r.MKU.toFixed(1)} | ${r.NCU.toFixed(1)} | ${g3(r.gio_SCU)} | ${c3(r.chl_SCU)} | ${g3(r.gio_MKU)} | ${c3(r.chl_MKU)} | ${g3(r.gio_NCU)} | ${c3(r.chl_NCU)} | ${r.oni ?? ""} |`);
writeFileSync(join(OUT, "buoc17.md"), md.join("\n") + "\n");
console.log(md.slice(0, 40).join("\n"));
