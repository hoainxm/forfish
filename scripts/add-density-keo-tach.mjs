#!/usr/bin/env node
// THÊM HAI NGHỀ "keo-doi" (cào đôi) + "keo-don" (cào đơn) vào src/data/fleet-density.v1.json (2026-11-08).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: anh Long 08/11 — "mỗi nghề có cách tính riêng, dẫn tới bãi đánh riêng". Sổ đăng kiểm gộp chung "kéo";
// vết VMS tách được cặp kéo đôi (docs/research/vet-tau-pha-nghe-2026-11.md §10). Lộ trình nghề Cào / Cào đôi
// cần bãi của ĐÚNG nhóm đó (cào đơn nhỏ hơn, ven bờ hơn, kéo cả đêm).
//
// CÁCH: KHÔNG dựng lại cả file (giữ nguyên mọi lát cũ + loài + mốc `builtFrom`) — chỉ đọc lại vết các tháng
// `builtFrom.months` trong khoảng [from, to] của file, lấy tàu có nhãn, đếm ĐÚNG luật build-fleet-density.mjs
// (isFishingV2 nghề "keo", bỏ ngày bão ở lát gộp, ô ≥ 3 tàu khác nhau) rồi ghi thêm khoá nghề vào lát
// tháng / mùa / trăng. Lát Ngày gộp mọi nghề — không đụng. Chạy lại thì đè (một lớp = một file).
//
// NGUỒN (ngoài repo, có PII — chỉ đọc):
//   --root <datalake-iuu>  (như build-fleet-density)
//   --nhan <json>          vesselId → "doi" | "don" (sinh ở gpu-desktop: ~/fish-vet/scripts/09_lich_dau.py →
//                          ~/fish-vet/raw/keo-nhan-vid.json; KHÔNG vào repo)
// CHẠY (có chủ ý):
//   node scripts/add-density-keo-tach.mjs --root <datalake-iuu> --nhan <keo-nhan-vid.json> [--file src/data/fleet-density.v1.json]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { hav, makePortIndex, loadBands, isFishingV2 } from "./fishing-def.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = arg("root", process.env.SDVICO_DATALAKE_ROOT || "../AI Assistant/sdvico-data/data-local/datalake-iuu");
const NHAN = arg("nhan", null);
const FILE = arg("file", "src/data/fleet-density.v1.json");
const BANDS = arg("bands", path.join(HERE, "fishing-bands.v2.json"));
const STORMS = arg("storms", path.join(HERE, "storm-days-bien-dong.v1.json"));
export const MIN_VESSELS = 3;
export const GEAR_TACH = { doi: "keo-doi", don: "keo-don" };
const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_S = Date.UTC(2000, 0, 6, 18, 14) / 1000;
const moonBin = (tSec) => {
  const days = (tSec - REF_NEW_MOON_S) / 86400;
  const frac = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  return Math.floor(((frac + 1 / 16) % 1) * 8);
};
const SEASON_OF = (m) => (m >= 4 && m <= 9 ? "nam" : "bac");

async function* lines(file) {
  const input = file.endsWith(".gz") ? fs.createReadStream(file).pipe(zlib.createGunzip()) : fs.createReadStream(file);
  for await (const l of readline.createInterface({ input, crlfDelay: Infinity })) if (l) yield JSON.parse(l);
}

async function main() {
  if (!NHAN) { console.error("thiếu --nhan <vesselId → doi|don>"); process.exit(2); }
  const t0 = Date.now();
  const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const nhan = new Map(Object.entries(JSON.parse(fs.readFileSync(NHAN, "utf8"))).filter(([, x]) => x in GEAR_TACH).map(([id, x]) => [id, GEAR_TACH[x]]));
  const snapDir = path.join(ROOT, "snapshots");
  const SNAP = arg("snapshot", fs.readdirSync(snapDir).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1));
  const cat = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(snapDir, SNAP, "catalog-ports.json.gz"))).toString("utf8"));
  const ctx = { table: loadBands(BANDS), ports: makePortIndex(cat.items || cat) };
  const stormDays = fs.existsSync(STORMS) ? JSON.parse(fs.readFileSync(STORMS, "utf8")).days : {};
  const { from, to, months } = d.builtFrom;
  const AX = d.axis;
  // khoá `${lat}|${gear}|${i},${j}` → {h, vs}
  const acc = { month: new Map(), season: new Map(), moon: new Map() };
  const add = (m, key, gear, ij, dtH, v) => {
    const k = `${key}|${gear}|${ij}`;
    const c = m.get(k) || m.set(k, { h: 0, vs: new Set() }).get(k);
    c.h += dtH;
    c.vs.add(v);
  };
  let seg = 0;
  for (const ym of months) {
    const f = path.join(ROOT, "tracks", `${ym}.ndjson.gz`);
    if (!fs.existsSync(f)) { console.error(`thiếu ${f}`); process.exit(3); }
    for await (const t of lines(f)) {
      const gear = nhan.get(t.v);
      if (!gear) continue;
      const pts = t.pts;
      for (let k = 1; k < pts.length; k++) {
        const [ta, la0, lo0] = pts[k - 1], [tb, la1, lo1] = pts[k];
        const dt = tb - ta;
        if (dt <= 0) continue;
        const dtH = dt / 3600;
        const kn = hav(la0, lo0, la1, lo1) / 1.852 / dtH;
        const la = (la0 + la1) / 2, lo = (lo0 + lo1) / 2, tm = (ta + tb) / 2;
        const vn = new Date((tm + 7 * 3600) * 1000).toISOString();
        const day = vn.slice(0, 10);
        if (day < from || day > to || stormDays[day]) continue;
        if (!isFishingV2({ t: tm, lat: la, lon: lo, dtH, kn }, "keo", ctx)) continue;
        const i = Math.round((la - AX.lat0) / AX.step), j = Math.round((lo - AX.lon0) / AX.step);
        if (i < 0 || j < 0 || i >= AX.nLat || j >= AX.nLon) continue;
        const ij = `${i},${j}`;
        add(acc.month, vn.slice(0, 7), gear, ij, dtH, t.v);
        add(acc.season, SEASON_OF(Number(vn.slice(5, 7))), gear, ij, dtH, t.v);
        add(acc.moon, String(moonBin(tm)), gear, ij, dtH, t.v);
        seg++;
      }
    }
    console.log(`[keo-tach] ${ym} · ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  const gearsMoi = Object.values(GEAR_TACH);
  for (const lat of ["month", "season", "moon"]) {
    // chạy lại thì đè: xoá khoá cũ của hai nghề trước
    for (const key of Object.keys(d[lat])) for (const g of gearsMoi) delete d[lat][key][g];
    let kept = 0, dropped = 0;
    for (const [k, c] of acc[lat]) {
      if (c.vs.size < MIN_VESSELS) { dropped++; continue; }
      const [key, gear, ij] = k.split("|");
      const [i, j] = ij.split(",").map(Number);
      ((d[lat][key] ??= {})[gear] ??= []).push([i, j, Math.round(c.h * 10), c.vs.size]);
      kept++;
    }
    for (const key of Object.keys(d[lat])) for (const g of gearsMoi) d[lat][key][g]?.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    console.log(`[keo-tach] lát ${lat}: ô giữ ${kept} · bỏ ${dropped}`);
  }
  d.gears = [...d.gears.filter((g) => !gearsMoi.includes(g)), ...gearsMoi];
  fs.writeFileSync(FILE, JSON.stringify(d));
  console.log(`[keo-tach] ghi ${FILE} — ${seg} đoạn đánh · ${(fs.statSync(FILE).size / 1024 / 1024).toFixed(1)} MB · ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
