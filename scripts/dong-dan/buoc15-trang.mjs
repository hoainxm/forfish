#!/usr/bin/env node
// buoc15-trang.mjs — BƯỚC 15 của "Dòng Dẫn" (docs/research/du-bao-ca-dong-dan-2026-10/15-trang.md):
// độ rọi trăng lúc đánh đêm có giải thích năng suất chuyến theo nghề không, đủ lớn + vững để thành hệ số nhân
// nghề × pha trăng trong dự báo cá?
//   Chuyến: bảng chuyến v3(a) (bang-chuyen.mjs). Trên TỪNG đoạn giờ đánh (móc seg), chia bước ≤ 1 giờ:
//     đêm = Mặt Trời dưới −6°; độ rọi trăng tương đối = phần sáng × sin(độ cao trăng), 0 khi trăng lặn
//     (trang-thien-van.mjs, ~0,5–1°, trời quang — không có mây). Tính ở 31 mốc lệch (0..29 ngày + 14,77 ngày) để kiểm giả.
//   Móc segAny: cùng độ rọi trên MỌI giờ đêm trên biển (đánh + ngoài dải tốc độ) — phòng khi dải tốc độ bỏ sót
//     giờ thả neo câu/chụp.
//   Đích: log kg chuyến (tổng theo nghề, và theo nhóm loài); kiểm soát log giờ đánh, log giờ chuyến; hiệu ứng cố định
//     tàu (≥ 2 chuyến), nghề × lớp dài, tháng × vùng 0,5° (--fe nuathang: nửa tháng × vùng). Chỉ chuyến có ≥ 3 giờ đánh đêm.
//   Nghề con (theo TÀU, kg cả năm — không theo chuyến để khỏi dính chính sản lượng chuyến):
//     câu mực / câu ngừ / câu khác, vây cá nổi nhỏ / vây ngừ / vây khác, chụp, kéo, rê, khác.
//   Kiểm giả: lệch ngẫu nhiên từng chuyến (0–29 ngày, 100 lần) · đường β(lệch Δ) Δ = 0..29 ngày + 14,77 · hai nửa năm.
// CHẠY Ở gpu-desktop (dữ liệu DataLake không rời máy đó). Ra $SDFISH_DATA_DIR/dong-dan/buoc15/buoc15[-nuathang].{json,md}.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { buildTrips, defaultPaths, moonPhase, vnDate, log, variance, feResid, ols } from "./bang-chuyen.mjs";
import { makeRng, quantile as q } from "./chl-gio.mjs";
import { sunAltDeg, moonAt } from "./trang-thien-van.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const P0 = defaultPaths(), OUT = arg("out", join(dataDir(), "dong-dan", "buoc15"));
mkdirSync(OUT, { recursive: true });
const FE = arg("fe", "thang"), NBOOT = Number(arg("boot", 300)), NNULL = Number(arg("null", 100));
const SYN = 29.530588853, SHIFTS = [...Array.from({ length: 30 }, (_, k) => k), SYN / 2], K14 = 30;
const NIGHT_SUN = -6, MIN_NIGHT_H = 3;
const rnd = makeRng(1515);
const lux = (t, lat, lon) => { const m = moonAt(t, lat, lon); return m.alt > 0 ? m.frac * Math.sin((m.alt * Math.PI) / 180) : 0; };

// ── bảng chuyến + đặc trưng trăng trên từng đoạn giờ đánh ───────────────────
const { rows, cov, spName } = buildTrips({ dir: arg("dir", P0.dir), ports: arg("ports", P0.ports), enc: arg("enc", P0.enc), limit: Number(arg("limit", 0)), covExtra: ["itDem"] }, () => {
  const a = { Hn: 0, L: new Float64Array(SHIFTS.length), frac: 0, up: 0, pc: 0, ps: 0, HnS: 0, LS: 0 };
  const steps = (s, f) => { const n = Math.max(1, Math.ceil(s.dtH)), dt = s.dtH / n; for (let i = 0; i < n; i++) f(s.t + ((i + 0.5) / n - 0.5) * s.dtH * 3600, dt); };
  return {
    seg(s) {
      steps(s, (t, dt) => {
        if (sunAltDeg(t, s.lat, s.lon) >= NIGHT_SUN) return;
        a.Hn += dt;
        for (let k = 0; k < SHIFTS.length; k++) {
          const m = moonAt(t + SHIFTS[k] * 86400, s.lat, s.lon), l = m.alt > 0 ? m.frac * Math.sin((m.alt * Math.PI) / 180) : 0;
          a.L[k] += l * dt;
          if (k === 0) { a.frac += m.frac * dt; a.up += (m.alt > 0 ? 1 : 0) * dt; }
        }
        const ph = 2 * Math.PI * moonPhase(t); a.pc += Math.cos(ph) * dt; a.ps += Math.sin(ph) * dt;
      });
    },
    segAny(s, v) {
      if (v !== "fish" && v !== "band") return; // đêm trên biển: đang đánh hoặc ngoài dải tốc độ, không ở cảng/mất tín hiệu
      steps(s, (t, dt) => { if (sunAltDeg(t, s.lat, s.lon) < NIGHT_SUN) { a.HnS += dt; a.LS += lux(t, s.lat, s.lon) * dt; } });
    },
    done(base, c) {
      if (a.Hn < MIN_NIGHT_H) { c.itDem++; return null; }
      const day = vnDate(base.tMid);
      return {
        Hn: a.Hn, night: a.Hn / base.H, L: Array.from(a.L, (x) => x / a.Hn), frac: a.frac / a.Hn, up: a.up / a.Hn,
        pc: a.pc / a.Hn, ps: a.ps / a.Hn, LS: a.HnS > 0 ? a.LS / a.HnS : NaN, HnS: a.HnS, day,
        mo: Number(day.slice(5, 7)), half: Number(day.slice(5, 7)) <= 5 ? 1 : 2,
      };
    },
  };
});

// ── nhóm loài theo TÊN + nghề con theo TÀU ──────────────────────────────────
const codesBy = (re) => new Set([...spName].filter(([, nm]) => re.test(nm ?? "")).map(([c]) => c));
const SP = {
  "mực": codesBy(/mực (ống|giã|xà|lá)/i), "cá nục": codesBy(/cá nục(?! heo)/i), "cá cơm": codesBy(/cá cơm/i), "cá ngừ": codesBy(/cá ngừ/i),
  "nổi nhỏ": codesBy(/cá cơm|cá nục(?! heo)|cá trích|bạc má|chỉ vàng/i),
};
const kgOf = (r, set) => Object.entries(r.sp).reduce((s, [c, v]) => s + (set.has(c) ? v : 0), 0);
const vk = new Map();
for (const r of rows) { const v = vk.get(r.vid) ?? vk.set(r.vid, { all: 0, muc: 0, ngu: 0, nn: 0 }).get(r.vid); v.all += r.kg; v.muc += kgOf(r, SP["mực"]); v.ngu += kgOf(r, SP["cá ngừ"]); v.nn += kgOf(r, SP["nổi nhỏ"]); }
const metier = (r) => {
  const v = vk.get(r.vid), sh = (x) => x / v.all;
  if (r.group === "chup") return "chụp";
  if (r.group === "cau") return sh(v.muc) >= 0.5 ? "câu mực" : sh(v.ngu) >= 0.5 ? "câu ngừ" : "câu khác";
  if (r.group === "vay") return sh(v.ngu) >= 0.5 ? "vây ngừ" : sh(v.nn) >= 0.5 ? "vây cá nổi nhỏ" : "vây khác";
  return { keo: "kéo", re: "rê" }[r.group] ?? "khác";
};
for (const r of rows) r.met = metier(r);
const DEN = new Set(["chụp", "câu mực", "vây cá nổi nhỏ"]);

// ── độ rọi điển hình theo pha (để đổi hệ số thành % và dựng bảng hệ số nhân) — tính thuần thiên văn ────────
const SLOTS = 8, slotOf = (ph) => Math.floor((((ph + 1 / (2 * SLOTS)) % 1) * SLOTS)) % SLOTS; // khe 0 = quanh trăng non
const slotLux = Array.from({ length: SLOTS }, () => [0, 0]);
for (let t = Date.parse("2026-01-01T00:00Z") / 1000; t < Date.parse("2028-01-01T00:00Z") / 1000; t += 1800) {
  if (sunAltDeg(t, 12, 110) >= NIGHT_SUN) continue;
  const s = slotOf(moonPhase(t)); slotLux[s][0] += lux(t, 12, 110); slotLux[s][1]++;
}
const LSLOT = slotLux.map(([a, n]) => a / n), LBAR = LSLOT.reduce((a, b) => a + b, 0) / SLOTS;
const DL = LSLOT[4] - LSLOT[0]; // rằm − không trăng (trung bình giờ đêm, 12°N 110°E)
log("độ rọi trung bình giờ đêm theo khe pha:", LSLOT.map((x) => x.toFixed(3)).join(" "), "Δ rằm−tối", DL.toFixed(3));

// ── mô hình trong-tàu ───────────────────────────────────────────────────────
const kyOf = (r) => (FE === "nuathang" ? `${r.mo}${+r.day.slice(8, 10) <= 15 ? "a" : "b"}` : `${r.mo}`);
function prep(sel, yOf) {
  const R = sel.filter((r) => Number.isFinite(yOf(r)));
  const strat = new Map(); for (const r of R) { const k = `${kyOf(r)}|${r.reg}`; strat.set(k, (strat.get(k) ?? 0) + 1); }
  const vc = new Map(); for (const r of R) vc.set(r.vid, (vc.get(r.vid) ?? 0) + 1);
  const S = R.filter((r) => strat.get(`${kyOf(r)}|${r.reg}`) >= 5 && vc.get(r.vid) >= 2);
  if (S.length < 150) return null;
  const fac = [S.map((r) => `${r.gear}|${r.cls}`), S.map((r) => `${kyOf(r)}|${r.reg}`), S.map((r) => r.vid)];
  const y = feResid(S.map(yOf), fac), C = [S.map((r) => Math.log(r.H)), S.map((r) => Math.log(r.tripH))].map((x) => feResid(x, fac));
  const cl = new Map(); S.forEach((r, i) => { const k = `${r.week}|${r.reg}`; (cl.get(k) ?? cl.set(k, []).get(k)).push(i); });
  return { S, fac, y, C, groups: [...cl.values()], tau: new Set(S.map((r) => r.vid)).size };
}
const fit = (P, X) => ols(P.y, [...P.C, ...X]).beta.slice(P.C.length);
function boot(P, X, nb = NBOOT) {
  const out = [];
  for (let b = 0; b < nb; b++) {
    const ix = []; for (let j = 0; j < P.groups.length; j++) ix.push(...P.groups[Math.floor(rnd() * P.groups.length)]);
    out.push(ols(ix.map((i) => P.y[i]), [...P.C.map((c) => ix.map((i) => c[i])), ...X.map((x) => ix.map((i) => x[i]))]).beta.slice(P.C.length));
  }
  return out;
}
const ci = (a) => [+q(a, 0.05).toFixed(4), +q(a, 0.95).toFixed(4)];
const pct = (b) => +(100 * (Math.exp(b) - 1)).toFixed(1);

function analyse(sel, yOf, full) {
  const P = prep(sel, yOf);
  if (!P) return { n: sel.filter((r) => Number.isFinite(yOf(r))).length, bo: "ít chuyến" };
  const { S } = P;
  const xL = feResid(S.map((r) => r.L[0]), P.fac);
  const conLai = +(variance([...xL]) / variance(S.map((r) => r.L[0]))).toFixed(3);
  const [bL] = fit(P, [xL]), bsL = boot(P, [xL]).map((b) => b[0]);
  const res = {
    n: S.length, tau: P.tau, cum: P.groups.length, conLai, demTB: +(S.reduce((a, r) => a + r.night, 0) / S.length).toFixed(2),
    luxTB: +(S.reduce((a, r) => a + r.L[0], 0) / S.length).toFixed(3),
    lux: { b: +bL.toFixed(4), ci90: ci(bsL), rangTrenToi: pct(bL * DL), rangTrenToiCi: ci(bsL.map((b) => pct(b * DL))) },
  };
  if (!full) return res;
  // phụ: cos/sin pha; độ rọi mọi giờ đêm trên biển
  const xc = feResid(S.map((r) => r.pc), P.fac), xs = feResid(S.map((r) => r.ps), P.fac);
  const bp = fit(P, [xc, xs]), bsp = boot(P, [xc, xs], 200);
  res.pha = { cos: +bp[0].toFixed(4), cosCi: ci(bsp.map((b) => b[0])), sin: +bp[1].toFixed(4), sinCi: ci(bsp.map((b) => b[1])) };
  if (S.every((r) => Number.isFinite(r.LS))) { const x = feResid(S.map((r) => r.LS), P.fac); const [b] = fit(P, [x]); res.luxBien = { b: +b.toFixed(4), ci90: ci(boot(P, [x], 200).map((v) => v[0])) }; }
  // khe pha (mô tả): 7 biến giả so khe 0 (quanh trăng non) theo pha trung bình giờ đêm của chuyến
  const sl = S.map((r) => slotOf((Math.atan2(r.ps, r.pc) / (2 * Math.PI) + 1) % 1));
  const D = Array.from({ length: SLOTS - 1 }, (_, k) => feResid(sl.map((s) => (s === k + 1 ? 1 : 0)), P.fac));
  const bd = fit(P, D), bsd = boot(P, D, 200);
  res.khe = { n: Array.from({ length: SLOTS }, (_, k) => sl.filter((s) => s === k).length), b: [0, ...bd.map((x) => +x.toFixed(4))], ci90: [[0, 0], ...bd.map((_, k) => ci(bsd.map((b) => b[k])))] };
  // kiểm giả 1: đường β(lệch Δ) — thật thì β(Δ) ≈ β₀·cos(2πΔ/29,53), đổi dấu ở 14,77 ngày
  res.lech = SHIFTS.map((d, k) => ({ d: +d.toFixed(2), b: +fit(P, [feResid(S.map((r) => r.L[k]), P.fac)])[0].toFixed(4) }));
  // kiểm giả 2: mỗi chuyến lệch ngẫu nhiên 0..29 ngày
  const nul = [];
  for (let j = 0; j < NNULL; j++) nul.push(fit(P, [feResid(S.map((r) => r.L[Math.floor(rnd() * 30)]), P.fac)])[0]);
  res.ngauNhien = { p: +(nul.filter((b) => Math.abs(b) >= Math.abs(bL)).length / NNULL).toFixed(3), q95: +q(nul.map(Math.abs), 0.95).toFixed(4) };
  // kiểm giả 3: hai nửa năm
  res.nuaNam = [1, 2].map((h) => { const r = analyse(sel.filter((x) => x.half === h), yOf, false); return r.bo ? { n: r.n, bo: r.bo } : { n: r.n, b: r.lux.b, ci90: r.lux.ci90 }; });
  return res;
}

const out = { builtAt: new Date().toISOString(), fe: FE, cov, nightSun: NIGHT_SUN, minNightH: MIN_NIGHT_H, luxKhe: LSLOT.map((x) => +x.toFixed(4)), luxTB: +LBAR.toFixed(4), dRangToi: +DL.toFixed(4), nghe: {}, loai: {}, nhomLoai: Object.fromEntries(Object.entries(SP).map(([g, s]) => [g, [...s].map((c) => `${c} ${spName.get(c)}`)])) };
const METS = ["chụp", "câu mực", "vây cá nổi nhỏ", "kéo", "rê", "câu ngừ", "câu khác", "vây ngừ", "vây khác", "khác"];
for (const m of METS) { log("nghề", m); out.nghe[m] = analyse(rows.filter((r) => r.met === m), (r) => Math.log(r.kg), true); }
const LOAI = [["mực", "nghề đèn", (r) => DEN.has(r.met)], ["mực", "kéo", (r) => r.met === "kéo"], ["mực", "mọi nghề", () => true],
  ["cá nục", "vây cá nổi nhỏ", (r) => r.met === "vây cá nổi nhỏ"], ["cá nục", "mọi nghề", () => true],
  ["cá cơm", "vây cá nổi nhỏ", (r) => r.met === "vây cá nổi nhỏ"], ["cá cơm", "mọi nghề", () => true],
  ["cá ngừ", "câu ngừ + vây ngừ", (r) => r.met === "câu ngừ" || r.met === "vây ngừ"], ["cá ngừ", "mọi nghề", () => true]];
for (const [g, w, f] of LOAI) {
  log("loài", g, w);
  const yOf = (r) => { const k = kgOf(r, SP[g]); return k > 0 ? Math.log(k) : NaN; };
  out.loai[`${g} · ${w}`] = analyse(rows.filter(f), yOf, true);
}
const SUF = FE === "thang" ? "" : `-${FE}`;
writeFileSync(join(OUT, `buoc15${SUF}.json`), JSON.stringify(out, null, 1));

// ── markdown ────────────────────────────────────────────────────────────────
const md = [`# Bước 15 — trăng và sản lượng (${out.builtAt}; hiệu ứng thời gian: ${FE === "thang" ? "tháng" : "nửa tháng"} × vùng 0,5°)\n`,
  `Độ phủ: ${JSON.stringify(cov)}. Đêm = Mặt Trời dưới ${NIGHT_SUN}°; chỉ chuyến ≥ ${MIN_NIGHT_H} giờ đánh đêm. Độ rọi trung bình giờ đêm theo 8 khe pha (khe 0 = trăng non, 4 = rằm; 12°N 110°E): ${out.luxKhe.join(" · ")}; Δ rằm − tối = ${out.dRangToi}.\n`,
  `β = log kg mỗi 1 đơn vị độ rọi (1 = trăng tròn ở thiên đỉnh); "rằm/tối" = % kg đêm rằm so đêm không trăng = e^(β·Δ) − 1; [CI 90 % bootstrap cụm tuần × vùng]. Giả ngẫu nhiên: p = tỉ lệ ${NNULL} lần lệch ngẫu nhiên từng chuyến cho |β| ≥ |β thật|. β(14,77) = hệ số khi lệch nửa chu kỳ (thật thì phải đổi dấu).\n`];
const row = (k, v) => v.bo ? `| ${k} | ${v.n} | bỏ (${v.bo}) | | | | | | | |` :
  `| ${k} | ${v.n} (${v.tau}, ${v.cum}) | ${v.demTB} · ${v.luxTB} · ${v.conLai} | ${v.lux.b} [${v.lux.ci90}] | ${v.lux.rangTrenToi} % [${v.lux.rangTrenToiCi}] | ${v.ngauNhien.p} | ${v.lech[K14].b} | ${v.nuaNam.map((h) => (h.bo ? "bỏ" : `${h.b} [${h.ci90}]`)).join(" / ")} | ${v.luxBien ? `${v.luxBien.b} [${v.luxBien.ci90}]` : "—"} | cos ${v.pha.cos} [${v.pha.cosCi}] · sin ${v.pha.sin} [${v.pha.sinCi}] |`;
const head = `| nhóm | n chuyến (tàu, cụm) | tỉ lệ giờ đêm · độ rọi TB · phương sai còn lại | β độ rọi [CI] | rằm/tối [CI] | giả ngẫu nhiên p | β lệch 14,77 ngày | nửa năm 1–5 / 6–10 | β độ rọi mọi giờ đêm trên biển | pha cos / sin |\n|---|---|---|---|---|---|---|---|---|---|`;
md.push(`## Theo nghề (log kg tổng chuyến)\n\n${head}`); for (const [k, v] of Object.entries(out.nghe)) md.push(row(k, v));
md.push(`\n## Theo nhóm loài (log kg loài, chuyến có loài đó)\n\n${head}`); for (const [k, v] of Object.entries(out.loai)) md.push(row(k, v));
md.push(`\n## Khe pha (mô tả; β so khe 0 = quanh trăng non, theo pha trung bình giờ đêm của chuyến)\n\n| nhóm | ${Array.from({ length: SLOTS }, (_, k) => `khe ${k}`).join(" | ")} |\n|---|${"---|".repeat(SLOTS)}`);
for (const [k, v] of [...Object.entries(out.nghe), ...Object.entries(out.loai)]) if (!v.bo) md.push(`| ${k} | ${v.khe.b.map((b, i) => `${b} (${v.khe.n[i]})`).join(" | ")} |`);
md.push(`\n## Đường β theo độ lệch Δ ngày (kiểm giả; thật thì ≈ β₀·cos(2πΔ/29,53))\n\n| nhóm | ${SHIFTS.map((d) => d.toFixed(0)).join(" | ")} |\n|---|${"---|".repeat(SHIFTS.length)}`);
for (const [k, v] of [...Object.entries(out.nghe), ...Object.entries(out.loai)]) if (!v.bo) md.push(`| ${k} | ${v.lech.map((x) => x.b).join(" | ")} |`);
// hệ số nhân theo khe pha suy từ β độ rọi: e^(β·(L_khe − L̄)), chuẩn hoá trung bình khe ≈ 1 (chỉ là ĐỀ XUẤT, không vào app)
const mult = (b) => LSLOT.map((L) => Math.exp(b * (L - LBAR)).toFixed(3));
md.push(`\n## Hệ số nhân theo khe pha (từ β độ rọi; [cận CI 90 %]) — khe 0 = trăng non … 4 = rằm\n\n| nhóm | ${Array.from({ length: SLOTS }, (_, k) => `khe ${k}`).join(" | ")} |\n|---|${"---|".repeat(SLOTS)}`);
for (const [k, v] of [...Object.entries(out.nghe), ...Object.entries(out.loai)]) if (!v.bo) { const [a, m, z] = [mult(v.lux.ci90[0]), mult(v.lux.b), mult(v.lux.ci90[1])]; md.push(`| ${k} | ${m.map((x, i) => `${x} [${a[i]}–${z[i]}]`).join(" | ")} |`); }
md.push(`\n## Mã loài\n\n${Object.entries(out.nhomLoai).map(([g, c]) => `- ${g}: ${c.join(", ")}`).join("\n")}\n`);
writeFileSync(join(OUT, `buoc15${SUF}.md`), md.join("\n"));
log("xong →", join(OUT, `buoc15${SUF}.md`));
