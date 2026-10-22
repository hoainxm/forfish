#!/usr/bin/env node
// tai-gio-cmems.mjs — gió lưới CMEMS WIND_GLO_PHY_L4_MY_012_006 (scatterometer + ERA5 hiệu chỉnh) cho 5 hộp nước
// trồi Nam VN (hop.mjs), thay Open-Meteo (bị chặn 429). Nguồn + cách tìm: docs/research/du-bao-ca-dong-dan-2026-10/11-so-nguon.md
//   bộ "025"  : 0,25°  theo giờ 1994-06-01 → 2009-10-31
//   bộ "0125" : 0,125° theo giờ 2007-01-11 → 2026-06-20
// Từ gió giờ (u, v): τ = ρa·Cd·|U|·U (ρa 1,22; Cd 1,2e-3 — CÙNG công thức bước C2 dùng cho ERA5) vì ứng suất có sẵn
// của CMEMS chỉ phân giải 0,01 N/m² (quá thô cho tín hiệu hè 0,05–0,15). Curl ứng suất (1e-10 N/m³) dùng thẳng.
// Ra ($SDFISH_DATA_DIR/hindcast-ntb/cmems-gio):
//   <bộ>/ngay-o.f32 + <bộ>/manifest.json  — trung bình NGÀY từng ô trong hộp: [ô × ngày × 4] (τx, τy, |τ|, curl τ)
//   chiso-ngay.json                         — chỉ số NGÀY theo hộp, nối hai bộ (0,25° trước 2007-01-11, 0,125° từ đó)
//   noi-bo.json                             — so hai bộ trên khúc chồng 2007-01-11 → 2009-10-31 (để biết nối có lệch)
// Khối đã tải cất ở <bộ>/cache (chạy lại chỉ tải phần thiếu). Chạy ở gpu-desktop (nối S3 nhanh, Mac chập chờn).
//   node scripts/dong-dan/tai-gio-cmems.mjs [--bo 025|0125|all] [--conc 8] [--chi-dung]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES, COAST_AXIS_DEG, inBox } from "./hop.mjs";
import { openZarr } from "./zarr-cmems.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = join(dataDir(), "hindcast-ntb", "cmems-gio");
const CONC = Number(arg("conc", 8));
const S3 = "https://s3.waw3-1.cloudferro.com";
const BO = {
  "025": `${S3}/mdl-arco-geo-049/arco/WIND_GLO_PHY_L4_MY_012_006/cmems_obs-wind_glo_phy_my_l4_0.25deg_PT1H_202406/geoChunked.zarr`,
  "0125": `${S3}/mdl-arco-geo-062/arco/WIND_GLO_PHY_L4_MY_012_006/cmems_obs-wind_glo_phy_my_l4_0.125deg_PT1H_202211/geoChunked.zarr`,
};
const RHO_A = 1.22, CD = 1.2e-3, RHO_W = 1025, OMEGA = 7.2921e-5;
const fCor = (lat) => 2 * OMEGA * Math.sin((lat * Math.PI) / 180);
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const iso = (s) => new Date(Date.UTC(1990, 0, 1) + s * 1000).toISOString();

async function taiBo(name) {
  const dir = join(OUT, name), cdir = join(dir, "cache");
  mkdirSync(cdir, { recursive: true });
  const z = await openZarr(BO[name]);
  const lat = await z.axis("latitude"), lon = await z.axis("longitude"), time = await z.axis("time");
  const nT = time.length, tch = z.arr("eastward_wind").chunks[0];
  if (Math.round(time[0]) % 86400 !== 0) throw new Error(`${name}: giờ đầu không phải 00:00 (${iso(time[0])})`);
  if (Math.round(time[nT - 1] - time[0]) !== (nT - 1) * 3600) throw new Error(`${name}: trục giờ không liên tục`);
  const day0 = iso(time[0]).slice(0, 10), nDays = Math.floor(nT / 24);
  // ô có tâm trong một hộp bất kỳ
  const cells = [];
  for (let iy = 0; iy < lat.length; iy++) for (let ix = 0; ix < lon.length; ix++) {
    const boxes = Object.entries(BOXES).filter(([, b]) => inBox(b, lat[iy], lon[ix])).map(([k]) => k);
    if (boxes.length) cells.push({ iy, ix, lat: lat[iy], lon: lon[ix], boxes });
  }
  const spatial = [...new Set(cells.map((c) => `${Math.floor(c.iy / 4)}.${Math.floor(c.ix / 4)}`))].map((s) => s.split(".").map(Number));
  const nTC = Math.ceil(nT / tch);
  log(name, `${day0} +${nDays} ngày, ${cells.length} ô, ${spatial.length} khối không gian × ${nTC} khối thời gian`);
  // mỗi việc = (khối thời gian, khối không gian): tải u, v, curl → tổng + đếm theo NGÀY toàn cục cho 16 ô
  const jobs = [];
  for (let tc = 0; tc < nTC; tc++) for (const [cy, cx] of spatial) jobs.push([tc, cy, cx]);
  let done = 0, empty = 0;
  const work = async ([tc, cy, cx]) => {
    const f = join(cdir, `${tc}_${cy}_${cx}.json`);
    if (existsSync(f)) { done++; return; }
    const [u, v, cu] = await Promise.all(["eastward_wind", "northward_wind", "stress_curl"].map((vn) => z.chunk(vn, [tc, cy, cx])));
    const h0 = tc * tch, nh = Math.min(tch, nT - h0);
    const d0 = Math.floor(h0 / 24), d1 = Math.floor((h0 + nh - 1) / 24), nd = d1 - d0 + 1;
    // [16 ô × nd ngày] × {sx, sy, si, nw, sc, nc}
    const acc = Array.from({ length: 6 }, () => new Float64Array(16 * nd));
    if (u && v) for (let h = 0; h < nh; h++) {
      const d = Math.floor((h0 + h) / 24) - d0;
      for (let k = 0; k < 16; k++) {
        const uu = u[h * 16 + k], vv = v[h * 16 + k];
        if (!Number.isFinite(uu) || !Number.isFinite(vv)) continue;
        const s = Math.hypot(uu, vv), c = RHO_A * CD * s, q = k * nd + d;
        acc[0][q] += c * uu; acc[1][q] += c * vv; acc[2][q] += c * s; acc[3][q]++;
      }
    }
    if (cu) for (let h = 0; h < nh; h++) {
      const d = Math.floor((h0 + h) / 24) - d0;
      for (let k = 0; k < 16; k++) { const x = cu[h * 16 + k]; if (Number.isFinite(x)) { acc[4][k * nd + d] += x; acc[5][k * nd + d]++; } }
    }
    if (!u && !v && !cu) empty++;
    writeFileSync(f, JSON.stringify({ d0, nd, acc: acc.map((a) => Array.from(a, (x) => +x.toPrecision(7))) }));
    done++;
    if (done % 50 === 0) log(name, done, "/", jobs.length, "khối trống", empty);
  };
  for (let i = 0; i < jobs.length; i += CONC) await Promise.all(jobs.slice(i, i + CONC).map(work));
  // ráp: ô × ngày × 4
  const pos = new Map(cells.map((c, n) => [`${c.iy}.${c.ix}`, n]));
  const sum = Array.from({ length: 6 }, () => new Float64Array(cells.length * nDays));
  for (const fn of readdirSync(cdir)) {
    const [tc, cy, cx] = fn.replace(".json", "").split("_").map(Number);
    if (tc >= nTC) continue;
    const { d0, nd, acc } = JSON.parse(readFileSync(join(cdir, fn), "utf8"));
    for (let k = 0; k < 16; k++) {
      const n = pos.get(`${cy * 4 + (k >> 2)}.${cx * 4 + (k & 3)}`);
      if (n === undefined) continue;
      for (let d = 0; d < nd; d++) { const g = d0 + d; if (g >= nDays) continue; for (let j = 0; j < 6; j++) sum[j][n * nDays + g] += acc[j][k * nd + d]; }
    }
  }
  const outArr = new Float32Array(cells.length * nDays * 4).fill(NaN);
  for (let n = 0; n < cells.length; n++) for (let g = 0; g < nDays; g++) {
    const q = n * nDays + g, o = q * 4;
    if (sum[3][q] >= 18) { outArr[o] = sum[0][q] / sum[3][q]; outArr[o + 1] = sum[1][q] / sum[3][q]; outArr[o + 2] = sum[2][q] / sum[3][q]; }
    if (sum[5][q] >= 18) outArr[o + 3] = sum[4][q] / sum[5][q];
  }
  writeFileSync(join(dir, "ngay-o.f32"), Buffer.from(outArr.buffer));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ source: BO[name], builtAt: new Date().toISOString(), day0, nDays, vars: ["tx", "ty", "ti", "curl"], units: { tx: "N/m2", ty: "N/m2", ti: "N/m2", curl: "N/m3" }, formula: "tau = 1.22*1.2e-3*|U|*U tu gio theo gio; curl = stress_curl CMEMS; trung binh ngay can >=18 gio", cells: cells.map((c) => [c.lat, c.lon, c.boxes]) }));
  log(name, "xong", cells.length, "ô ×", nDays, "ngày");
}

function docBo(name) {
  const dir = join(OUT, name);
  const man = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const b = readFileSync(join(dir, "ngay-o.f32"));
  return { ...man, a: new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) };
}
/** Chỉ số ngày theo hộp: {<HỘP>_<ti|tE|tN|Mek|wEk>: {ngày: giá trị}} */
function chiSo(bo) {
  const out = {};
  const day = (g) => new Date(Date.parse(bo.day0) + g * 864e5).toISOString().slice(0, 10);
  for (const [bn] of Object.entries(BOXES)) {
    const idx = bo.cells.map((c, n) => [c, n]).filter(([c]) => c[2].includes(bn));
    for (const k of ["ti", "tE", "tN", "Mek", "wEk"]) out[`${bn}_${k}`] = {};
    for (let g = 0; g < bo.nDays; g++) {
      const acc = { ti: [], tE: [], tN: [], Mek: [], wEk: [] };
      for (const [[la], n] of idx) {
        const o = (n * bo.nDays + g) * 4, tx = bo.a[o], ty = bo.a[o + 1], ti = bo.a[o + 2], cu = bo.a[o + 3];
        if (Number.isFinite(tx)) {
          acc.tE.push(tx); acc.tN.push(ty); acc.ti.push(ti);
          if (COAST_AXIS_DEG[bn] !== undefined) { const th = (COAST_AXIS_DEG[bn] * Math.PI) / 180; acc.Mek.push((tx * Math.sin(th) + ty * Math.cos(th)) / (RHO_W * fCor(la))); }
        }
        if (Number.isFinite(cu)) acc.wEk.push((cu / (RHO_W * fCor(la))) * 86400); // m/ngày
      }
      const need = Math.max(4, Math.ceil(0.5 * idx.length));
      for (const [k, v] of Object.entries(acc)) if (v.length >= need) out[`${bn}_${k}`][day(g)] = +(v.reduce((x, y) => x + y, 0) / v.length).toPrecision(6);
    }
  }
  return out;
}
function dung() {
  const A = chiSo(docBo("025")), B = chiSo(docBo("0125")), CUT = "2007-01-11";
  const ghep = {}, noi = {};
  const pr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let xy = 0, xx = 0, yy = 0; for (let i = 0; i < n; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; } return xy / Math.sqrt(xx * yy); };
  // Hai bộ khớp theo ngày (r ~0,99) nhưng LỆCH MỨC ở vài chỉ số (đo 2026-10-22: bơm Ekman ven bờ SCU 0,14 ở 0,25°
  // so với 0,36 m/ngày ở 0,125° — lưới thô bỏ sót curl sát bờ). Nối thẳng sẽ tạo "bậc" giả năm 2007 ⇒ cộng vào bộ
  // 0,25° độ lệch TRUNG BÌNH THEO THÁNG (0,125° − 0,25°) đo trên khúc chồng 2007-01-11 → 2009-10-31.
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (const k of Object.keys(B)) {
    ghep[k] = {};
    const both = Object.keys(B[k]).filter((d) => A[k]?.[d] !== undefined);
    const off = {};
    for (let m = 1; m <= 12; m++) { const ds = both.filter((d) => +d.slice(5, 7) === m); off[m] = ds.length >= 20 ? avg(ds.map((d) => B[k][d] - A[k][d])) : 0; }
    for (const [d, v] of Object.entries(A[k] ?? {})) if (d < CUT) ghep[k][d] = +(v + off[+d.slice(5, 7)]).toPrecision(6);
    for (const [d, v] of Object.entries(B[k])) if (d >= CUT) ghep[k][d] = v;
    if (both.length > 100) {
      const a = both.map((d) => A[k][d]), b = both.map((d) => B[k][d]), ac = both.map((d) => A[k][d] + off[+d.slice(5, 7)]);
      noi[k] = { n: both.length, r: +pr(a, b).toFixed(3), meanA: +avg(a).toPrecision(4), meanB: +avg(b).toPrecision(4), meanAdaChinh: +avg(ac).toPrecision(4), lechThang: Object.fromEntries(Object.entries(off).map(([m, v]) => [m, +v.toPrecision(3)])) };
    }
  }
  writeFileSync(join(OUT, "chiso-ngay.json"), JSON.stringify(ghep));
  writeFileSync(join(OUT, "noi-bo.json"), JSON.stringify({ cut: CUT, note: "025 (đã cộng lechThang theo tháng) trước cut, 0125 từ cut; so trên khúc chồng", noi }, null, 1));
  log("chỉ số ngày →", join(OUT, "chiso-ngay.json"), Object.keys(ghep).length, "chuỗi");
  for (const [k, v] of Object.entries(noi)) console.error(k.padEnd(9), "r", v.r, "TB 0,25°", v.meanA, "→ chỉnh", v.meanAdaChinh, "· 0,125°", v.meanB);
}

if (!argv.includes("--chi-dung")) {
  const bo = arg("bo", "all");
  for (const name of bo === "all" ? ["025", "0125"] : [bo]) await taiBo(name);
}
if (existsSync(join(OUT, "025", "manifest.json")) && existsSync(join(OUT, "0125", "manifest.json"))) dung();
