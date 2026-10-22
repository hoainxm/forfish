#!/usr/bin/env node
// buoc-b-moi-ca.mjs — BƯỚC B của "Dòng Dẫn" (docs/research/du-bao-ca-dong-dan-2026-10/14-buoc-B-moi-ca.md):
// mồi (chl) và gió những ngày TRƯỚC chuyến có giải thích được năng suất của chính chuyến đó không, sau khi đã khử
// tàu, nghề × lớp dài, tháng × vùng 0,5°, giờ đánh, độ dài chuyến và pha trăng.
//   Chuyến (bang-chuyen.mjs) gán vào hộp (hop.mjs) khi ≥ 60 % giờ đánh nằm trong hộp; mốc = giữa các giờ đánh trong hộp.
//   Biến (dị thường so khí hậu ngày-trong-năm 1998–2025, trung bình hộp):
//     chl08  = log10 chl ngày [d−8, d−1]     · chl916 = [d−16, d−9]  (phần dự báo mồi 1–3 tuần cho được)
//     gio08  = ứng suất đông τ_E [d−8, d−1]  · trăng = cos, sin pha trăng ở mốc
//   Kiểm giả: cùng biến nhưng lấy ở [d+30, d+38] (tương lai — không thể là nguyên nhân).
//   --fe nuathang: thay tháng × vùng bằng nửa tháng × vùng (khử xu thế mượt trong tháng mà kiểm giả bắt được).
// Chl: hindcast-ntb/chl-ngay (tai-chl-ngay.mjs, lấp mây, hằng ngày). Gió: hindcast-ntb/cmems-gio (đã nối gần thời gian thực).
// CHẠY Ở gpu-desktop (dữ liệu DataLake không rời máy đó). Ra $SDFISH_DATA_DIR/dong-dan/buoc-b/buoc-b.{json,md}.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES, inBox } from "./hop.mjs";
import { buildTrips, defaultPaths, moonPhase, log, mean, variance, feResid, ols, pearson } from "./bang-chuyen.mjs";
import { anomDaily, addDays, makeRng, quantile as q } from "./chl-gio.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const P0 = defaultPaths(), RAW = join(dataDir(), "hindcast-ntb"), OUT = arg("out", join(dataDir(), "dong-dan", "buoc-b"));
mkdirSync(OUT, { recursive: true });
const BX = ["SCU", "MKU", "OFU", "NCU"], SHARE = 0.6;
// --fe thang (mặc định): tháng × vùng 0,5° · --fe nuathang: NỬA tháng × vùng — phép kiểm vững khử xu thế trong tháng
const FE = arg("fe", "thang");
const kyOf = (r) => (FE === "nuathang" ? `${r.day.slice(5, 7)}${+r.day.slice(8, 10) <= 15 ? "a" : "b"}` : `${r.month}`);
const rnd = makeRng(2027);

// ── chuỗi ngày theo hộp: dị thường chl và gió ───────────────────────────────
const chlDay = JSON.parse(readFileSync(join(RAW, "chl-ngay", "hop-ngay.json"), "utf8"));
const gio = JSON.parse(readFileSync(join(RAW, "cmems-gio", "chiso-ngay.json"), "utf8"));
const CHL = Object.fromEntries(BX.map((b) => [b, anomDaily(chlDay[b]).anom]));
const WIND = Object.fromEntries(BX.map((b) => [b, anomDaily(gio[`${b}_tE`]).anom]));
const winMean = (m, d, a, z) => { const v = []; for (let i = a; i <= z; i++) { const x = m.get(addDays(d, i)); if (Number.isFinite(x)) v.push(x); } return v.length >= 0.75 * (z - a + 1) ? mean(v) : NaN; };
log("chl ngày tới", Object.keys(chlDay.SCU).at(-1), "· gió tới", Object.keys(gio.SCU_tE).at(-1));

// ── bảng chuyến + giờ đánh theo hộp ─────────────────────────────────────────
const { rows, cov, spName } = buildTrips({ dir: arg("dir", P0.dir), ports: arg("ports", P0.ports), enc: arg("enc", P0.enc), limit: Number(arg("limit", 0)), covExtra: ["ngoaiHop"] }, () => {
  const h = Object.fromEntries(BX.map((b) => [b, { H: 0, T: 0 }]));
  return {
    seg(s) { for (const b of BX) if (inBox(BOXES[b], s.lat, s.lon)) { h[b].H += s.dtH; h[b].T += s.t * s.dtH; } },
    done(base, c) {
      const best = BX.reduce((x, b) => (h[b].H > h[x].H ? b : x), BX[0]);
      if (h[best].H < SHARE * base.H) { c.ngoaiHop++; return null; }
      const tRef = h[best].T / h[best].H, d = new Date(tRef * 1000).toISOString().slice(0, 10);
      const f = (m, a, z) => winMean(m, d, a, z);
      return {
        box: best, shareBox: h[best].H / base.H, day: d, moonRef: moonPhase(tRef),
        chl08: f(CHL[best], -8, -1), chl916: f(CHL[best], -16, -9), gio08: f(WIND[best], -8, -1),
        chlGia: f(CHL[best], 30, 38), gioGia: f(WIND[best], 30, 38),
      };
    },
  };
});
log("chuyến trong hộp:", JSON.stringify(Object.fromEntries(BX.map((b) => [b, rows.filter((r) => r.box === b).length]))));

// ── nhóm loài theo TÊN (mã ASFIS không thống nhất giữa nhật ký) ───────────────
const codesBy = (re) => [...spName].filter(([, nm]) => re.test(nm ?? "")).map(([c]) => c);
const GROUPS = {
  "tổng kg": null,
  "cá cơm": codesBy(/cá cơm/i),
  "cá nục": codesBy(/cá nục/i),
  "cá nổi nhỏ (cơm, nục, trích, bạc má, chỉ vàng)": codesBy(/cá cơm|cá nục|cá trích|bạc má|chỉ vàng/i),
  "mực (ống, giã, xà, lá)": codesBy(/mực (ống|giã|xà|lá)/i),
  "cá ngừ": codesBy(/cá ngừ/i),
};

// ── mô hình trong-tàu với các biến mồi/gió ──────────────────────────────────
const VARS = ["chl08", "chl916", "gio08"], GIA = ["chlGia", "gioGia"];
function analyse(sel, yOf, vars) {
  const R = sel.filter((r) => Number.isFinite(yOf(r)) && vars.every((v) => Number.isFinite(r[v])));
  const strat = new Map(); for (const r of R) { const k = `${kyOf(r)}|${r.reg}`; strat.set(k, (strat.get(k) ?? 0) + 1); }
  const vc = new Map(); for (const r of R) vc.set(r.vid, (vc.get(r.vid) ?? 0) + 1);
  const S = R.filter((r) => strat.get(`${kyOf(r)}|${r.reg}`) >= 5 && vc.get(r.vid) >= 2); // tàu 1 chuyến không cho thông tin trong-tàu
  if (S.length < 150) return { n: S.length, bo: "ít chuyến" };
  const fac = [S.map((r) => `${r.gear}|${r.cls}`), S.map((r) => `${kyOf(r)}|${r.reg}`), S.map((r) => r.vid)];
  const ctrl = [S.map((r) => Math.log(r.H)), S.map((r) => Math.log(r.tripH)), S.map((r) => Math.cos(2 * Math.PI * r.moonRef)), S.map((r) => Math.sin(2 * Math.PI * r.moonRef))];
  const y = feResid(S.map(yOf), fac), C = ctrl.map((x) => feResid(x, fac));
  const X = vars.map((v) => { const x = feResid(S.map((r) => r[v]), fac); return x; });
  // còn bao nhiêu biến thiên của biến sau khi khử (trong tháng × vùng, trong tàu)
  const remain = Object.fromEntries(vars.map((v, k) => [v, +(variance([...X[k]]) / variance(S.map((r) => r[v]))).toFixed(3)]));
  const base = ols(y, C), full = ols(y, [...C, ...X]);
  const vy = variance([...base.res]), r2gain = 1 - variance([...full.res]) / vy;
  // β chuẩn hoá: thay đổi log kg (≈ %/100) khi biến tăng 1 sd PHẦN CÒN LẠI; CI 90 % bootstrap cụm tuần × vùng
  const sdX = X.map((x) => Math.sqrt(variance([...x])));
  const beta = vars.map((_, k) => full.beta[C.length + k] * sdX[k]);
  const cl = new Map(); S.forEach((r, i) => { const k = `${r.week}|${r.reg}`; (cl.get(k) ?? cl.set(k, []).get(k)).push(i); });
  const groups = [...cl.values()], boots = vars.map(() => []), bootG = [];
  for (let b = 0; b < 300; b++) {
    const ix = []; for (let j = 0; j < groups.length; j++) ix.push(...groups[Math.floor(rnd() * groups.length)]);
    const yb = ix.map((i) => y[i]), Cb = C.map((c) => ix.map((i) => c[i])), Xb = X.map((x) => ix.map((i) => x[i]));
    const fb = ols(yb, [...Cb, ...Xb]), bb = ols(yb, Cb);
    vars.forEach((_, k) => boots[k].push(fb.beta[C.length + k] * sdX[k]));
    bootG.push(1 - variance([...fb.res]) / variance([...bb.res]));
  }
  const tau = new Map(); S.forEach((r) => tau.set(r.vid, 1));
  return {
    n: S.length, tau: tau.size, cum: groups.length, conLai: remain,
    beta: Object.fromEntries(vars.map((v, k) => [v, { b: +beta[k].toFixed(4), ci90: [+q(boots[k], 0.05).toFixed(4), +q(boots[k], 0.95).toFixed(4)] }])),
    r2Them: +r2gain.toFixed(4), r2ThemCi90: [+q(bootG, 0.05).toFixed(4), +q(bootG, 0.95).toFixed(4)],
    rTrongTau: Object.fromEntries(vars.map((v, k) => [v, +pearson([...X[k]], [...base.res]).toFixed(4)])),
  };
}
const out = { builtAt: new Date().toISOString(), fe: FE, cov, share: SHARE, nhom: Object.fromEntries(Object.entries(GROUPS).map(([g, c]) => [g, c ? c.map((x) => `${x} ${spName.get(x)}`) : "tất cả"])), ket: {} };
for (const b of BX) for (const [g, codes] of Object.entries(GROUPS)) {
  const kgG = (r) => (codes ? codes.reduce((a, c) => a + (r.sp[c] ?? 0), 0) : r.kg);
  const sel = rows.filter((r) => r.box === b && kgG(r) > 0);
  const yOf = (r) => Math.log(kgG(r));
  out.ket[`${b}|${g}`] = { that: analyse(sel, yOf, VARS), gia: analyse(sel, yOf, GIA) };
}
const SUF = FE === "thang" ? "" : `-${FE}`;
writeFileSync(join(OUT, `buoc-b${SUF}.json`), JSON.stringify(out, null, 1));
// markdown
const cell = (v) => (v ? `${v.b} [${v.ci90[0]}, ${v.ci90[1]}]` : "—");
const md = [`# Bước B — mồi/gió trước chuyến → năng suất chuyến (${out.builtAt}; hiệu ứng thời gian: ${FE === "thang" ? "tháng" : "nửa tháng"} × vùng 0,5°)\n`, `Độ phủ: ${JSON.stringify(cov)}. Chuyến gán hộp khi ≥ ${SHARE * 100} % giờ đánh trong hộp. Ô β = thay đổi log kg khi biến tăng 1 độ lệch chuẩn phần còn lại (trong tàu, trong tháng × vùng), [CI 90 % bootstrap cụm tuần × vùng]. R² thêm = phần phương sai năng suất (sau khử mọi kiểm soát) mà ba biến giải thích thêm.\n`];
md.push(`| hộp · nhóm | n chuyến (tàu, cụm) | chl 0–8 ngày trước | chl 9–16 ngày trước | gió 0–8 ngày trước | R² thêm [CI] | kiểm giả: chl +30–38 | gió +30–38 | R² thêm giả |\n|---|---|---|---|---|---|---|---|---|`);
for (const [k, v] of Object.entries(out.ket)) {
  const t = v.that, g = v.gia;
  md.push(t.bo ? `| ${k} | ${t.n} | bỏ (${t.bo}) | | | | | | |` : `| ${k} | ${t.n} (${t.tau}, ${t.cum}) | ${cell(t.beta.chl08)} | ${cell(t.beta.chl916)} | ${cell(t.beta.gio08)} | ${t.r2Them} [${t.r2ThemCi90}] | ${g.bo ? "—" : cell(g.beta.chlGia)} | ${g.bo ? "—" : cell(g.beta.gioGia)} | ${g.bo ? "—" : g.r2Them} |`);
}
md.push(`\n## Biến thiên còn lại sau khử (tỉ lệ phương sai)\n\n| hộp · nhóm | chl08 | chl916 | gio08 |\n|---|---|---|---|`);
for (const [k, v] of Object.entries(out.ket)) if (!v.that.bo) md.push(`| ${k} | ${v.that.conLai.chl08} | ${v.that.conLai.chl916} | ${v.that.conLai.gio08} |`);
md.push(`\n## Mã loài trong từng nhóm\n\n${Object.entries(out.nhom).map(([g, c]) => `- ${g}: ${Array.isArray(c) ? c.join(", ") : c}`).join("\n")}\n`);
writeFileSync(join(OUT, `buoc-b${SUF}.md`), md.join("\n"));
log("xong →", join(OUT, `buoc-b${SUF}.md`));
