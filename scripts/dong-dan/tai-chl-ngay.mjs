#!/usr/bin/env node
// tai-chl-ngay.mjs — chlorophyll HẰNG NGÀY đã lấp mây (Copernicus Marine OCEANCOLOUR_GLO_BGC_L4_MY_009_104, gap-free,
// 4 km, 1997-09-04 → ~2 tuần trước) đọc ẩn danh từ kho Zarr, gộp thành TRUNG BÌNH log10 chl theo hộp (hop.mjs) mỗi ngày.
// Vì sao cần ngoài OC-CCI 8 ngày (tai-chl-occi.mjs): OC-CCI ở ERDDAP dừng 2026-06-26 và thủng vì mây; bước B (mồi → cá)
// cần chl phủ ĐỦ giai đoạn có nhãn chuyến (1–10/2026) theo NGÀY. Hai sản phẩm khác nhau ⇒ không trộn dị thường.
// Ra $SDFISH_DATA_DIR/hindcast-ntb/chl-ngay/{hop-ngay.json, manifest.json}; khối đã tải ở cache/ (chạy lại tải phần thiếu).
// Chạy ở gpu-desktop (nối S3 nhanh). ~700 MB tải về cho 4 hộp, ghi ra vài MB.
//   node scripts/dong-dan/tai-chl-ngay.mjs [--conc 8]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES, inBox } from "./hop.mjs";
import { openZarr } from "./zarr-cmems.mjs";

const argv = process.argv.slice(2);
const CONC = Number(argv.includes("--conc") ? argv[argv.indexOf("--conc") + 1] : 8);
const OUT = join(dataDir(), "hindcast-ntb", "chl-ngay"), CDIR = join(OUT, "cache");
mkdirSync(CDIR, { recursive: true });
const URL = "https://s3.waw3-1.cloudferro.com/mdl-arco-geo-043/arco/OCEANCOLOUR_GLO_BGC_L4_MY_009_104/cmems_obs-oc_glo_bgc-plankton_my_l4-gapfree-multi-4km_P1D_202603/geoChunked.zarr";
const BX = ["SCU", "NCU", "OFU", "MKU"];
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

const z = await openZarr(URL);
const lat = await z.axis("latitude"), lon = await z.axis("longitude"), time = await z.axis("time");
const [tch, cs] = z.arr("CHL").chunks, cc = cs * cs, nT = time.length;
const dayOf = (t) => new Date(Date.UTC(1900, 0, 1) + Math.round(t) * 864e5).toISOString().slice(0, 10);
const days = Array.from(time, dayOf);
// ô thuộc hộp nào; chỉ tải khối có ô trong hộp
const cellBoxes = new Map(); // "iy.ix" → [hộp]
const iyR = [], ixR = [];
for (let iy = 0; iy < lat.length; iy++) if (lat[iy] >= 7.9 && lat[iy] <= 14.6) iyR.push(iy);
for (let ix = 0; ix < lon.length; ix++) if (lon[ix] >= 106.4 && lon[ix] <= 112.6) ixR.push(ix);
for (const iy of iyR) for (const ix of ixR) { const bs = BX.filter((b) => inBox(BOXES[b], lat[iy], lon[ix])); if (bs.length) cellBoxes.set(`${iy}.${ix}`, bs); }
const spatial = [...new Set([...cellBoxes.keys()].map((k) => { const [iy, ix] = k.split(".").map(Number); return `${Math.floor(iy / cs)}.${Math.floor(ix / cs)}`; }))].map((s) => s.split(".").map(Number));
const nTC = Math.ceil(nT / tch);
log(`${days[0]} → ${days.at(-1)} (${nT} ngày), ${cellBoxes.size} ô trong ${BX.length} hộp, ${spatial.length} khối không gian × ${nTC} khối thời gian`);
const jobs = []; for (let tc = 0; tc < nTC; tc++) for (const [cy, cx] of spatial) jobs.push([tc, cy, cx]);
let done = 0;
const work = async ([tc, cy, cx]) => {
  const f = join(CDIR, `${tc}_${cy}_${cx}.json`);
  if (existsSync(f)) { done++; return; }
  const a = await z.chunk("CHL", [tc, cy, cx]);
  const t0 = tc * tch, nt = Math.min(tch, nT - t0);
  const acc = Object.fromEntries(BX.map((b) => [b, { s: new Float64Array(nt), n: new Uint32Array(nt), cells: 0 }]));
  for (let k = 0; k < cc; k++) {
    const bs = cellBoxes.get(`${cy * cs + Math.floor(k / cs)}.${cx * cs + (k % cs)}`);
    if (!bs) continue;
    for (const b of bs) acc[b].cells++;
    if (!a) continue;
    for (let t = 0; t < nt; t++) { const x = a[t * cc + k]; if (Number.isFinite(x) && x > 0) { const l = Math.log10(x); for (const b of bs) { acc[b].s[t] += l; acc[b].n[t]++; } } }
  }
  writeFileSync(f, JSON.stringify({ t0, nt, box: Object.fromEntries(BX.map((b) => [b, { cells: acc[b].cells, s: Array.from(acc[b].s, (x) => +x.toPrecision(8)), n: Array.from(acc[b].n) }])) }));
  if (++done % 50 === 0) log(done, "/", jobs.length);
};
for (let i = 0; i < jobs.length; i += CONC) await Promise.all(jobs.slice(i, i + CONC).map(work));
// ráp: trung bình log10 theo hộp mỗi ngày; cần ≥ 50 % ô biển của hộp có số
const S = Object.fromEntries(BX.map((b) => [b, { s: new Float64Array(nT), n: new Uint32Array(nT), cells: 0 }]));
const cellsSeen = Object.fromEntries(BX.map((b) => [b, 0]));
for (const fn of readdirSync(CDIR)) {
  const j = JSON.parse(readFileSync(join(CDIR, fn), "utf8"));
  for (const b of BX) { const x = j.box[b]; if (j.t0 === 0) cellsSeen[b] += x.cells; for (let t = 0; t < j.nt; t++) { S[b].s[j.t0 + t] += x.s[t]; S[b].n[j.t0 + t] += x.n[t]; } }
}
const out = {}, nOcean = {};
for (const b of BX) {
  nOcean[b] = Math.max(...S[b].n); // số ô biển = số ô có số nhiều nhất trong một ngày (ô đất không bao giờ có số)
  out[b] = {};
  for (let t = 0; t < nT; t++) if (S[b].n[t] >= 0.5 * nOcean[b]) out[b][days[t]] = +(S[b].s[t] / S[b].n[t]).toPrecision(6);
}
writeFileSync(join(OUT, "hop-ngay.json"), JSON.stringify(out));
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ source: URL, builtAt: new Date().toISOString(), from: days[0], to: days.at(-1), value: "trung bình log10(CHL mg/m3) các ô biển trong hộp; ngày cần >= 50 % ô có số", cellsInBox: cellsSeen, oceanCells: nOcean, ngay: Object.fromEntries(BX.map((b) => [b, Object.keys(out[b]).length])) }, null, 1));
log("xong →", join(OUT, "hop-ngay.json"), JSON.stringify(nOcean));
