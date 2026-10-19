// scripts/fish-features-cache.mjs  (npx tsx scripts/fish-features-cache.mjs [--grids <dir>] [--out <dir>] [--force])
// ─────────────────────────────────────────────────────────────────────────────
// CACHE ĐẶC TRƯNG Ô-NGÀY cho fit/đo dự báo cá (rà pipeline 2026-10-18, mảnh 2B).
//
// Vì sao: đo 2026-10-18 — 85 % thời gian mỗi lượt dò hồ sơ loài là dựng lại đặc trưng ô (dị thường
// không gian, front…) KHÔNG đổi theo tham số hồ sơ. Ở đây dựng MỘT lần bằng đúng `buildCellFeatures`
// của production (MỘT nguồn công thức), lưu Float32; fit chỉ chạy `scoreCell` trên cache.
//
// Vào : <grids>/{sst,chl,sla,anom,sstFine,chlFine}-<ngày>.json + etopo.json (scripts/fish-validate-run.mjs --features full)
//       đầu vào GIỐNG hệt dl-fit-profiles cũ: sst, chl, sla, anom, depth, climo, reef, front mịn
//       (KHÔNG có dòng chảy/D20/nhiệt đáy/250 m — lưới lịch sử không có; payload thận trọng hơn production)
// Ra  : <out>/f-<ngày>.f32  Float32 [nCells × NF]  đặc trưng từng ô (chỉ ô có vùng + loài trong vụ)
//       <out>/s-<ngày>.u8   mặt nạ biển nLat×nLon (1 = SST hữu hạn) — để tính khối lượng nhãn ở ô ngoài vụ (điểm 0)
//       <out>/manifest.json trục lưới, danh sách vùng, trường, phiên bản thuật toán, ngày có/thiếu
//
//   --grids  mặc định $SDFISH_DATA_DIR/fc-full/grids      --out mặc định $SDFISH_DATA_DIR/fc-full/features
//   $SDFISH_DATA_DIR mặc định ~/sdfish-data  (PC GPU: /mnt/c/Users/admin/sdfish-data)  — NGOÀI repo (luật dữ liệu)
//   --from/--to  giới hạn ngày   --force  dựng lại cả ngày đã có   --selftest
//
// Độ chính xác: Float32 (≈7 chữ số) — đủ cho fit; điểm lệch so với double ≲1e-5 (chỉ ở ranh giới trapezoid).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  buildCellFeatures, parseErddapGrid, parseBathyGrid, scoreCell, seasonWeights, FISH_ALGO_REV, SPECIES_PROFILES,
} from "../src/lib/fish-predict.ts";

export const FEATURE_FIELDS = [
  "i", "j", "lat", "lon", "region", "t", "tBottom", "tDeep", "c", "fThermFront", "fChlFront", "fEddy",
  "coldStr", "warmStr", "upwTerm", "convTerm", "thermoAnomM", "depthM", "coastKm", "hasReef",
];
export const NF = FEATURE_FIELDS.length;
const NUL = NaN; // null ↔ NaN trong Float32

export { dataDir } from "./lib/data-dir.mjs";

/** CellFeatures[] → Float32Array [n × NF]; `regions` (mảng id) được bổ sung dần. */
export function encodeFeatures(feats, regions) {
  const out = new Float32Array(feats.length * NF);
  feats.forEach((F, n) => {
    let r = regions.indexOf(F.regionId);
    if (r < 0) r = regions.push(F.regionId) - 1;
    const v = [
      F.i, F.j, F.lat, F.lon, r, F.t, F.tBottom ?? NUL, F.tDeep ?? NUL, F.c, F.fThermFront, F.fChlFront, F.fEddy ?? NUL,
      F.coldStr, F.warmStr, F.upwTerm ?? NUL, F.convTerm ?? NUL, F.thermoAnomM ?? NUL, F.depthM ?? NUL, F.coastKm ?? NUL,
      F.hasReef == null ? NUL : F.hasReef ? 1 : 0,
    ];
    out.set(v, n * NF);
  });
  return out;
}

/** Float32Array → CellFeatures[]. `accept(regionId)` (tuỳ chọn) bỏ sớm ô không cần (vd ngoài vụ của loài đang fit). */
export function decodeFeatures(f32, regions, accept) {
  const out = [];
  const nz = (x) => (Number.isNaN(x) ? null : x);
  for (let o = 0; o < f32.length; o += NF) {
    const regionId = regions[f32[o + 4]];
    if (accept && !accept(regionId)) continue;
    out.push({
      i: f32[o], j: f32[o + 1], lat: f32[o + 2], lon: f32[o + 3], regionId, t: f32[o + 5],
      tBottom: nz(f32[o + 6]), tDeep: nz(f32[o + 7]), c: f32[o + 8], fThermFront: f32[o + 9], fChlFront: f32[o + 10],
      fEddy: nz(f32[o + 11]), coldStr: f32[o + 12], warmStr: f32[o + 13], upwTerm: nz(f32[o + 14]), convTerm: nz(f32[o + 15]),
      thermoAnomM: nz(f32[o + 16]), depthM: nz(f32[o + 17]), coastKm: nz(f32[o + 18]),
      hasReef: Number.isNaN(f32[o + 19]) ? null : f32[o + 19] > 0,
    });
  }
  return out;
}

export function readFeatureDay(dir, date) {
  const b = readFileSync(join(dir, `f-${date}.f32`));
  const f32 = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  return f32;
}
export function readSeaMask(dir, date) {
  return new Uint8Array(readFileSync(join(dir, `s-${date}.u8`)));
}

async function selftest() {
  const assert = (c, m) => { if (!c) throw new Error(`selftest: ${m}`); };
  // lưới nhỏ tổng hợp: 2 ô trong vùng biển VN, đủ null/không null
  const feats = [
    { i: 3, j: 4, lat: 12.25, lon: 110.5, regionId: "trung-bo", t: 28.4, tBottom: null, tDeep: 12.5, c: 0.31, fThermFront: 0.2, fChlFront: 0.1, fEddy: 0.3, coldStr: 0.1, warmStr: 0, upwTerm: null, convTerm: 0.4, thermoAnomM: -6, depthM: 850, coastKm: Infinity, hasReef: true },
    { i: 5, j: 6, lat: 12.75, lon: 111, regionId: "vinh-bac-bo", t: 29.1, tBottom: 20, tDeep: null, c: NaN, fThermFront: 0, fChlFront: 0, fEddy: null, coldStr: 0, warmStr: 0, upwTerm: 0.2, convTerm: null, thermoAnomM: null, depthM: null, coastKm: null, hasReef: null },
  ];
  const regions = [];
  const back = decodeFeatures(encodeFeatures(feats, regions), regions);
  assert(back.length === 2 && regions.length === 2, "độ dài");
  for (let n = 0; n < 2; n++) for (const k of Object.keys(feats[n])) {
    const a = feats[n][k], b = back[n][k];
    if (typeof a === "number" && Number.isNaN(a)) assert(Number.isNaN(b), `NaN ${k}`);
    else if (typeof a === "number") assert(a === b || Math.abs(a - b) <= Math.abs(a) * 1e-6 + 1e-6 || (a === Infinity && b === Infinity), `${k}: ${a} vs ${b}`);
    else assert(a === b, `${k}: ${a} vs ${b}`);
  }
  assert(decodeFeatures(encodeFeatures(feats, []), ["trung-bo", "vinh-bac-bo"], (r) => r === "vinh-bac-bo").length === 1, "accept");
  // điểm trên bản giải mã ≈ điểm trên bản gốc (cùng scoreCell)
  const p = SPECIES_PROFILES.find((x) => x.short === "ngừ vằn");
  const rid = ["trung-bo", "nam-trung-bo", "hoang-sa", "dong-nam-bo", "truong-sa-dk1"];
  const month = 8, k = { month, climo: null };
  let maxd = 0, n = 0;
  for (const r of rid) {
    const sW = seasonWeights(r, month).get(p.species);
    if (sW == null) continue;
    for (const f of feats) {
      const F = { ...f, regionId: r };
      const G = decodeFeatures(encodeFeatures([F], []), [r])[0];
      maxd = Math.max(maxd, Math.abs(scoreCell(F, p, sW, 0.3, 0.2, k) - scoreCell(G, p, sW, 0.3, 0.2, k)));
      n++;
    }
  }
  assert(maxd < 1e-4, `điểm lệch ${maxd}`);
  console.log(`selftest OK (${n} ô-vùng so điểm, lệch tối đa ${maxd.toExponential(1)})`);
}

if (process.argv[1]?.endsWith("fish-features-cache.mjs")) {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) { await selftest(); process.exit(0); }
  const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const home = (p) => p.replace(/^~/, homedir());
  const GRIDS = home(arg("grids", join(dataDir(), "fc-full/grids")));
  const OUT = home(arg("out", join(dataDir(), "fc-full/features")));
  const FORCE = argv.includes("--force");
  const FROM = arg("from", "0000"), TO = arg("to", "9999");
  mkdirSync(OUT, { recursive: true });

  const has = new Set(readdirSync(GRIDS));
  const j = (f) => JSON.parse(readFileSync(join(GRIDS, f), "utf8"));
  const dates = [...has].map((f) => /^sst-(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1]).filter((d) => d && d >= FROM && d <= TO).sort();
  const depth = parseBathyGrid(j("etopo.json"));
  const climo = JSON.parse(readFileSync(new URL("../src/data/sst-climatology.v1.json", import.meta.url), "utf8")).regions;
  const reef = JSON.parse(readFileSync(new URL("../src/data/reef-grid-025.v1.json", import.meta.url), "utf8"));
  const g = (name, d, alt) => (has.has(`${name}-${d}.json`) && !j(`${name}-${d}.json`).missing ? parseErddapGrid(j(`${name}-${d}.json`), alt) : null);

  const mfFile = join(OUT, "manifest.json");
  const old = existsSync(mfFile) ? JSON.parse(readFileSync(mfFile, "utf8")) : null;
  const sameAlgo = old && old.algoRev === FISH_ALGO_REV && old.fields.join() === FEATURE_FIELDS.join();
  const mf = {
    v: 1, algoRev: FISH_ALGO_REV, fields: FEATURE_FIELDS, builtAt: new Date().toISOString(),
    inputs: "sst, chl, sla, anom, depth, climo, reef, frontSstFine, frontChlFine (không dòng chảy / D20 / nhiệt đáy / 250 m)",
    regions: sameAlgo ? old.regions : [], axis: sameAlgo ? old.axis : null, days: sameAlgo ? old.days : {}, missing: [],
  };
  const t0 = Date.now();
  let built = 0;
  for (const d of dates) {
    const fresh = !FORCE && mf.days[d] && existsSync(join(OUT, `f-${d}.f32`)) && existsSync(join(OUT, `s-${d}.u8`));
    if (fresh) continue;
    const sst = g("sst", d, { hasAltitude: false, unit: "degC" });
    const chl = g("chl", d, { hasAltitude: true, unit: "mg/m3" });
    if (!sst || !chl) { mf.missing.push({ date: d, why: !sst ? "thiếu SST" : "thiếu phù du" }); delete mf.days[d]; continue; }
    const sla = g("sla", d, { hasAltitude: false, unit: "m" });
    const anom = g("anom", d, { hasAltitude: false, unit: "degC" });
    const sstFine = g("sstFine", d, { hasAltitude: false, unit: "degC" });
    const chlFine = g("chlFine", d, { hasAltitude: true, unit: "mg/m3" });
    const month = Number(d.slice(5, 7));
    const feats = buildCellFeatures(sst, chl, sla, month, { anom, depth, climo, reef, frontSstFine: sstFine, frontChlFine: chlFine });
    const axis = { lat0: sst.lats[0], lon0: sst.lons[0], step: Math.round((sst.lats[1] - sst.lats[0]) * 1e6) / 1e6, nLat: sst.lats.length, nLon: sst.lons.length };
    if (mf.axis && JSON.stringify(mf.axis) !== JSON.stringify(axis)) {
      // trục lệch chỉ được phép sai số làm tròn; lệch thật = nguồn đổi lưới → dừng, đừng trộn
      const d0 = Math.abs(mf.axis.lat0 - axis.lat0) + Math.abs(mf.axis.lon0 - axis.lon0) + Math.abs(mf.axis.step - axis.step);
      if (d0 > 1e-6 || mf.axis.nLat !== axis.nLat || mf.axis.nLon !== axis.nLon) throw new Error(`${d}: lưới SST khác trục với ngày trước (${JSON.stringify(axis)} vs ${JSON.stringify(mf.axis)})`);
    }
    mf.axis ??= axis;
    const mask = new Uint8Array(axis.nLat * axis.nLon);
    for (let i = 0; i < axis.nLat; i++) for (let k = 0; k < axis.nLon; k++) if (Number.isFinite(sst.values[i][k])) mask[i * axis.nLon + k] = 1;
    const f32 = encodeFeatures(feats, mf.regions);
    writeFileSync(join(OUT, `f-${d}.f32`), Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength));
    writeFileSync(join(OUT, `s-${d}.u8`), mask);
    mf.days[d] = { n: feats.length, month, sla: !!sla, anom: !!anom, fine: !!(sstFine && chlFine) };
    built++;
  }
  writeFileSync(mfFile, JSON.stringify(mf, null, 1));
  const nd = Object.keys(mf.days).length;
  console.log(`cache đặc trưng: ${nd} ngày (mới dựng ${built}, thiếu ${mf.missing.length}) → ${OUT}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const m of mf.missing) console.log(`  thiếu ${m.date}: ${m.why}`);
}
