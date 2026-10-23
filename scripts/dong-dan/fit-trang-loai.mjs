#!/usr/bin/env node
// fit-trang-loai.mjs — LỊCH TRĂNG theo nhóm loài / loài, học trên nhãn chuyến (bang-chuyen.mjs), CỔNG CHẶT theo phản
// biện 18 (docs/research/du-bao-ca-dong-dan-2026-10/18-phan-bien-15-17.md §1.5) — bản 2026-10-23 thay bản đầu (bản đầu
// gom cụm tuần × vùng và xáo pha trong tháng × vùng ⇒ CI quá hẹp, phép giả quá dễ, không loại Tết).
//   log kg = tàu + nghề × lớp dài + tháng × vùng 0,5° + log giờ đánh + log giờ chuyến + c·cos(2πφ) + s·sin(2πφ)
//   φ = pha trăng ở GIỮA giờ đánh (0 trăng non, 0,5 rằm).
// Bốn kiểm, đều trên mẫu ĐÃ BỎ cửa sổ Tết (giữa giờ đánh trong 25/1–10/3/2026, giờ VN):
//   (1) NGOÀI MẪU theo thời gian: học (c, s) trên tháng 1–5, đoán tháng 6–10 — tương quan (đã khử cùng hiệu ứng cố
//       định) giữa Δ dự báo và log kg; CI 90 % bootstrap theo TUẦN (chung mọi vùng — pha trăng là của NGÀY);
//   (2) BIÊN ĐỘ nửa sau vượt phân vị 95 % phép giả THEO KHỐI TUẦN (mỗi tuần dịch pha một lượng ngẫu nhiên riêng);
//   (3) ĐỈNH ổn định: đỉnh nửa đầu và nửa sau lệch ≤ 0,15 chu kỳ (~4,4 ngày);
//   (4) đối xứng (chẩn đoán, KHÔNG làm cổng): |s| > |c| ⇒ lệch "trăng lên/xuống" — giống nhịp lịch âm của người hơn ánh sáng.
// "ap" = (1) ∧ (2) ∧ (3). CHẠY Ở gpu-desktop. Ra (chỉ hệ số tổng hợp): $SDFISH_DATA_DIR/dong-dan/trang/trang-loai.json
//   → scripts/dong-dan/dung-chain-params.mjs → src/data/fish-chain-params.json
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { buildTrips, defaultPaths, log, feResid, ols, pearson, vnDate } from "./bang-chuyen.mjs";
import { makeRng, quantile as q } from "./chl-gio.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const P0 = defaultPaths(), OUT = arg("out", join(dataDir(), "dong-dan", "trang"));
mkdirSync(OUT, { recursive: true });
const rnd = makeRng(29);
const TET = ["2026-01-25", "2026-03-10"];
const { rows: all, cov, spName } = buildTrips({ dir: arg("dir", P0.dir), ports: arg("ports", P0.ports), enc: arg("enc", P0.enc), limit: Number(arg("limit", 0)) }, () => ({ seg() {}, done: () => ({}) }));
const rows = all.filter((r) => { const d = vnDate(r.tMid); return d < TET[0] || d > TET[1]; }).map((r) => ({ ...r, wk: Math.floor(r.tMid / (7 * 86400)), half: Number(vnDate(r.tMid).slice(5, 7)) <= 5 ? 1 : 2 }));
log("bỏ cửa sổ Tết:", all.length - rows.length, "chuyến; còn", rows.length);

const codesBy = (re) => [...spName].filter(([, nm]) => re.test(nm ?? "")).map(([c]) => c);
const GROUPS = {
  "pelagic-small": codesBy(/cá cơm|cá nục|cá trích|bạc má|chỉ vàng|cá chuồn|cá sòng|cá tráo/i),
  "pelagic-large": codesBy(/cá ngừ|cá thu|cá cờ|cá kiếm|cá nục heo/i),
  cephalopod: codesBy(/mực|bạch tuộc/i),
  demersal: codesBy(/cá mối|cá hố|cá đổng|cá phèn|cá lượng|cá trác|cá bò/i),
  "ca-com": codesBy(/cá cơm/i),
  "ca-nuc": codesBy(/cá nục(?! heo)/i),
  "muc-xa": codesBy(/mực xà/i),
  "muc-ong": codesBy(/mực (ống|giã)/i),
};
const TAU = 2 * Math.PI;
const peakOf = (c, s) => ((Math.atan2(s, c) / TAU) % 1 + 1) % 1;
const phaseDist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/** khử hiệu ứng cố định trong một tập; trả y, kiểm soát, cột trăng (cos, sin) đã khử + các chuyến giữ lại */
function prep(R, yOf, ph = (r) => r.moon) {
  const strat = new Map(); for (const r of R) { const k = `${r.month}|${r.reg}`; strat.set(k, (strat.get(k) ?? 0) + 1); }
  const vc = new Map(); for (const r of R) vc.set(r.vid, (vc.get(r.vid) ?? 0) + 1);
  const S = R.filter((r) => strat.get(`${r.month}|${r.reg}`) >= 5 && vc.get(r.vid) >= 2);
  const fac = [S.map((r) => `${r.gear}|${r.cls}`), S.map((r) => `${r.month}|${r.reg}`), S.map((r) => r.vid)];
  const y = feResid(S.map(yOf), fac);
  const C = [S.map((r) => Math.log(r.H)), S.map((r) => Math.log(r.tripH))].map((x) => feResid(x, fac));
  const moon = (phs) => [feResid(phs.map((p) => Math.cos(TAU * p)), fac), feResid(phs.map((p) => Math.sin(TAU * p)), fac)];
  return { S, fac, y, C, moon, ph: S.map(ph) };
}
const fitCS = (P, [mc, ms]) => { const f = ols(P.y, [...P.C, mc, ms]); return { c: f.beta[2], s: f.beta[3], A: Math.hypot(f.beta[2], f.beta[3]) }; };

function analyse(sel, yOf) {
  const H1 = sel.filter((r) => r.half === 1), H2 = sel.filter((r) => r.half === 2);
  if (H1.length < 300 || H2.length < 300) return { n1: H1.length, n2: H2.length, bo: "ít chuyến ở một nửa năm" };
  const p1 = prep(H1, yOf), p2 = prep(H2, yOf), pa = prep(sel, yOf);
  if (p1.S.length < 300 || p2.S.length < 300) return { n1: p1.S.length, n2: p2.S.length, bo: "ít chuyến sau khi lọc tầng" };
  const f1 = fitCS(p1, p1.moon(p1.ph)), f2 = fitCS(p2, p2.moon(p2.ph)), fa = fitCS(pa, pa.moon(pa.ph));
  // (1) ngoài mẫu: Δ dự báo từ hệ số nửa đầu, áp lên nửa sau, khử cùng hiệu ứng cố định của nửa sau, bỏ phần giải thích bởi kiểm soát
  const pred = feResid(p2.ph.map((p) => f1.c * Math.cos(TAU * p) + f1.s * Math.sin(TAU * p)), p2.fac);
  const yRes = ols(p2.y, p2.C).res, xRes = ols(pred, p2.C).res;
  const rOos = pearson([...xRes], [...yRes]);
  const wkIdx = new Map(); p2.S.forEach((r, i) => (wkIdx.get(r.wk) ?? wkIdx.set(r.wk, []).get(r.wk)).push(i));
  const blocks = [...wkIdx.values()], boot = [];
  for (let b = 0; b < 400; b++) { const ix = []; for (let j = 0; j < blocks.length; j++) ix.push(...blocks[Math.floor(rnd() * blocks.length)]); boot.push(pearson(ix.map((i) => xRes[i]), ix.map((i) => yRes[i]))); }
  // (2) phép giả theo khối tuần trên nửa sau: mỗi tuần dịch pha một lượng ngẫu nhiên riêng
  const nul = [];
  for (let b = 0; b < 150; b++) {
    const shift = new Map([...wkIdx.keys()].map((w) => [w, rnd()]));
    const ph = p2.S.map((r, i) => (p2.ph[i] + shift.get(r.wk)) % 1);
    nul.push(fitCS(p2, p2.moon(ph)).A);
  }
  const ci = [q(boot, 0.05), q(boot, 0.95)], nul95 = q(nul, 0.95);
  const pk1 = peakOf(f1.c, f1.s), pk2 = peakOf(f2.c, f2.s);
  const kiem = { ngoaiMau: ci[0] > 0, bienDoNuaSau: f2.A > nul95, dinhOnDinh: phaseDist(pk1, pk2) <= 0.15 };
  const r4 = (x) => +x.toFixed(4);
  return {
    n: pa.S.length, n1: p1.S.length, n2: p2.S.length, tuanNuaSau: blocks.length,
    c: r4(fa.c), s: r4(fa.s), A: r4(fa.A), dinhPha: +peakOf(fa.c, fa.s).toFixed(3),
    nuaDau: { c: r4(f1.c), s: r4(f1.s), A: r4(f1.A), dinhPha: +pk1.toFixed(3) },
    nuaSau: { c: r4(f2.c), s: r4(f2.s), A: r4(f2.A), dinhPha: +pk2.toFixed(3), nguongGiaTuan95: r4(nul95) },
    ngoaiMau: { r: r4(rOos), ci90: ci.map(r4) },
    sinTroi: Math.abs(fa.s) > Math.abs(fa.c),
    kiem, ap: Object.values(kiem).every(Boolean),
  };
}
const out = { builtAt: new Date().toISOString(), phienBan: "chat-2026-10-23", nguon: "nhãn chuyến DataLake 2026 (bang-chuyen.mjs), tàu ≥ 15 m có VMS, BỎ cửa sổ Tết " + TET.join("→"), cov, congThuc: "Δlog kg = c·cos(2πφ) + s·sin(2πφ); φ 0 = trăng non, 0,5 = rằm", luatCong: "ap = ngoài mẫu (học T1–5 → đoán T6–10, CI 90 % theo tuần loại 0) ∧ biên độ nửa sau > giả khối tuần 95 % ∧ đỉnh hai nửa lệch ≤ 0,15 chu kỳ", ket: {} };
for (const [g, codes] of Object.entries(GROUPS)) {
  const kgG = (r) => codes.reduce((a, c) => a + (r.sp[c] ?? 0), 0);
  const v = analyse(rows.filter((r) => kgG(r) > 0), (r) => Math.log(kgG(r)));
  out.ket[`${g}|all`] = v;
  log(g.padEnd(14), v.bo ? `bỏ (${v.bo})` : `n ${v.n} A ${v.A} đỉnh ${v.dinhPha} · đầu ${v.nuaDau.dinhPha}/${v.nuaDau.A} · sau ${v.nuaSau.dinhPha}/${v.nuaSau.A} (giả ${v.nuaSau.nguongGiaTuan95}) · ngoài mẫu r ${v.ngoaiMau.r} [${v.ngoaiMau.ci90}] · sin trội ${v.sinTroi} → ${v.ap ? "ÁP" : "-"} ${JSON.stringify(v.kiem)}`);
}
writeFileSync(join(OUT, "trang-loai.json"), JSON.stringify(out, null, 1));
log("xong →", join(OUT, "trang-loai.json"));
