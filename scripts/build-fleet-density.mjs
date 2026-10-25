#!/usr/bin/env node
// LƯỚI MẬT ĐỘ TÀU ĐÁNH BẮT theo NGÀY · THÁNG · MÙA · TRĂNG → public/data/fleet-density.v1.json (2026-10-25).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: anh Long 25/10 — "dựa vào VMS, phân tích tốc độ / đổi vị trí / khoảng cách điểm trước–sau
// để biết tàu thường đánh bắt ở đâu, rồi dựng bản đồ nhiệt mật độ tàu theo ngày, theo mùa, theo trăng".
// Lớp này là LỊCH SỬ (bãi tàu đã đánh), không phải dự báo; hiện ở panel Ngư trường, cùng trục ô 0,25°
// với lưới cá để chồng được lên nhau.
//
// CÁCH ĐẾM — dùng ĐÚNG một định nghĩa "giờ đánh bắt" của nhãn v2 + lưới đội tàu (scripts/fishing-def.mjs):
//   đoạn giữa 2 điểm VMS liền nhau → khoảng cách haversine / thời gian = tốc độ (hải lý/giờ);
//   "đang đánh" = tốc độ trong DẢI THEO NHÓM NGHỀ (fishing-bands.v2.json; vây ánh sáng ban đêm cho
//   tốc độ 0 — đứng yên giữ đàn), khoảng ≤ maxGapH, trung điểm cách MỌI cảng ≥ 10 km, bỏ tàu thu mua.
//   Giờ của đoạn cộng vào ô 0,25° (trục AXIS của lưới cá) theo 4 khoá:
//     day    "YYYY-MM-DD" (giờ VN)             — mọi nghề gộp (tách nghề theo ngày thì file phình ×7)
//     month  "YYYY-MM"                          — "tat" + từng nhóm nghề
//     season "nam" (T4–T9) | "bac" (T10–T3)     — "tat" + từng nhóm nghề
//     moon   "0".."7" (8 pha, 0 = trăng non)    — "tat" + từng nhóm nghề
//   Mỗi ô ghi [i, j, giờ×10 (nguyên), số tàu khác nhau].
// RIÊNG TƯ (cùng luật fleet-effort-025): chỉ giữ ô có ≥ MIN_VESSELS tàu KHÁC NHAU trong khoá×ô;
//   không ghi số đăng ký, chủ tàu, mã tàu — chỉ số tổng. Ngưỡng áp RIÊNG từng khoá (ô đủ 3 tàu trong
//   tháng vẫn có thể bị bỏ ở ngày — đúng ý: ngày thưa thì không lộ tàu lẻ).
// CHUẨN HOÁ ĐỂ SO: file ghi kèm số NGÀY VMS phủ của từng khoá (`days`) — app chia giờ/ngày.
//
// NGUỒN (ngoài repo, có PII — chỉ đọc): kho DataLake IUU trên gpu-desktop
//   ~/forlife/sdvico-data/data-local/datalake-iuu/{tracks/<YYYY-MM>.ndjson.gz, snapshots/<ngày>/
//   vessels-asof-*.ndjson.gz, snapshots/<ngày>/catalog-ports.json.gz, encounters/vessels.json}
//   + bộ phân loại nghề /mnt/c/Users/admin/sdfish-data/dl-all/gear-map.json.
// CHẠY (có chủ ý, khi thêm tháng VMS — quy tắc dữ liệu trong git):
//   node scripts/build-fleet-density.mjs --root <datalake-iuu> --gear-map <gear-map.json> --out public/data/fleet-density.v1.json
//   File chạy ĐỘC LẬP ngoài repo: chép kèm fishing-def.mjs + fishing-bands.v2.json cùng thư mục.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { hav, gearGroup, GEARS, makePortIndex, nearAnyPort, loadBands, isFishingV2 } from "./fishing-def.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = arg("root", process.env.SDVICO_DATALAKE_ROOT || "../AI Assistant/sdvico-data/data-local/datalake-iuu");
const GEAR_MAP = arg("gear-map", null);
const OUT = arg("out", "public/data/fleet-density.v1.json");
const BANDS = arg("bands", path.join(HERE, "fishing-bands.v2.json"));
const ONLY = (arg("only-months", "") || "").split(",").filter(Boolean); // kiểm nhanh: --only-months 2026-10
// NGÀY BÃO (scripts/build-storm-days.mjs ← IBTrACS): anh Long 25/10 — "có bão thì không ai ra khơi" ⇒ các ngày
// này KHÔNG vào lát tháng/mùa/trăng (kẻo con trăng trùng bão trông "vắng tàu" oan); lát Ngày vẫn giữ + ghi chú.
const STORMS = arg("storms", path.join(HERE, "storm-days-bien-dong.v1.json"));

export const MIN_VESSELS = 3;
export const AXIS = { lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 };
export const SEASON_OF = (m) => (m >= 4 && m <= 9 ? "nam" : "bac");

// Tuần trăng — CÙNG hằng với src/lib/moon.ts (chu kỳ giao hội, mốc trăng non 2000-01-06 18:14 UTC);
// 8 pha, pha 0 lấy tâm ở trăng non [−1/16, 1/16) để khớp nhãn "Trăng non — tối trời" của moon.ts.
const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);
export function moonBin(tSec) {
  const days = (tSec * 1000 - REF_NEW_MOON_UTC) / 86400000;
  const frac = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  return Math.floor(((frac + 1 / 16) % 1) * 8);
}

async function* lines(file) {
  const input = file.endsWith(".gz") ? fs.createReadStream(file).pipe(zlib.createGunzip()) : fs.createReadStream(file);
  for await (const l of readline.createInterface({ input, crlfDelay: Infinity })) if (l) yield JSON.parse(l);
}

/** Bộ cộng dồn một khoá: `${key}|${gear}|${i},${j}` → {h, vs:Set}; kèm ngày phủ theo khoá. */
function makeAcc() {
  return { cells: new Map(), days: new Map() };
}
function add(acc, key, gear, ij, dtH, v, dayKey) {
  const k = `${key}|${gear}|${ij}`;
  const c = acc.cells.get(k) || acc.cells.set(k, { h: 0, vs: new Set() }).get(k);
  c.h += dtH;
  c.vs.add(v);
  (acc.days.get(key) || acc.days.set(key, new Set()).get(key)).add(dayKey);
}
function flush(acc, withGear) {
  const out = {};
  let kept = 0, dropped = 0;
  for (const [k, c] of acc.cells) {
    if (c.vs.size < MIN_VESSELS) { dropped++; continue; }
    const [key, gear, ij] = k.split("|");
    const [i, j] = ij.split(",").map(Number);
    const row = [i, j, Math.round(c.h * 10), c.vs.size];
    if (withGear) ((out[key] ??= {})[gear] ??= []).push(row);
    else (out[key] ??= []).push(row);
    kept++;
  }
  const sortRows = (rows) => rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const keys = Object.keys(out).sort();
  const sorted = {};
  for (const key of keys) {
    if (withGear) sorted[key] = Object.fromEntries(["tat", ...GEARS].filter((g) => out[key][g]).map((g) => [g, sortRows(out[key][g])]));
    else sorted[key] = sortRows(out[key]);
  }
  const days = Object.fromEntries(keys.map((k) => [k, acc.days.get(k)?.size ?? 1]));
  return { data: sorted, days, kept, dropped };
}

async function main() {
  const t0 = Date.now();
  const snapDir = path.join(ROOT, "snapshots");
  const SNAP = arg("snapshot", fs.readdirSync(snapDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1));
  const S = (n) => path.join(snapDir, SNAP, n);

  const cat = JSON.parse(zlib.gunzipSync(fs.readFileSync(S("catalog-ports.json.gz"))).toString("utf8"));
  const portGrid = makePortIndex(cat.items || cat);

  const gearOf = new Map();
  const asof = fs.readdirSync(path.join(snapDir, SNAP)).filter((f) => /^vessels-asof-.*\.ndjson\.gz$/.test(f)).sort().reverse();
  for (const f of asof) for await (const v of lines(S(f))) if (v.vesselId && !gearOf.has(v.vesselId) && v.gear) gearOf.set(v.vesselId, gearGroup(v.gear));

  const table = loadBands(BANDS);
  const ctx = { table, ports: portGrid };
  const inferred = GEAR_MAP ? new Map(Object.entries(JSON.parse(fs.readFileSync(GEAR_MAP, "utf8")).vessels).map(([id, o]) => [id, o.group])) : new Map();
  const encF = path.join(ROOT, "encounters", "vessels.json");
  const carriers = new Set(fs.existsSync(encF) ? Object.entries(JSON.parse(fs.readFileSync(encF, "utf8")).vessels).filter(([, o]) => o.likelyCarrier).map(([id]) => id) : []);
  console.log(`[density] sổ nghề ${gearOf.size} tàu · nghề suy ${inferred.size} · thu mua bỏ ${carriers.size} · bảng dải ${table.date}`);

  const stormDays = fs.existsSync(STORMS) ? JSON.parse(fs.readFileSync(STORMS, "utf8")).days : {};
  console.log(`[density] ngày bão loại khỏi lát gộp: ${Object.keys(stormDays).length} (${STORMS})`);
  const accDay = makeAcc(), accMonth = makeAcc(), accSeason = makeAcc(), accMoon = makeAcc();
  let stormSegs = 0;
  const vessels = new Set();
  let tMin = Infinity, tMax = -Infinity, segs = 0, fishSegs = 0;
  const months = [];
  const tracksDir = path.join(ROOT, "tracks");
  for (const f of fs.readdirSync(tracksDir).filter((x) => /^\d{4}-\d{2}\.ndjson\.gz$/.test(x)).sort()) {
    const ym = f.slice(0, 7);
    if (ONLY.length && !ONLY.includes(ym)) continue;
    months.push(ym);
    let nPts = 0;
    for await (const t of lines(path.join(tracksDir, f))) {
      if (carriers.has(t.v)) continue;
      const g = gearOf.get(t.v) ?? inferred.get(t.v) ?? "khac";
      const pts = t.pts;
      nPts += pts.length;
      for (let k = 1; k < pts.length; k++) {
        const [ta, la0, lo0] = pts[k - 1], [tb, la1, lo1] = pts[k];
        const dt = tb - ta;
        if (dt <= 0) continue;
        segs++;
        const dtH = dt / 3600;
        const kn = hav(la0, lo0, la1, lo1) / 1.852 / dtH;
        const la = (la0 + la1) / 2, lo = (lo0 + lo1) / 2;
        const tm = (ta + tb) / 2;
        if (!isFishingV2({ t: tm, lat: la, lon: lo, dtH, kn }, g, ctx)) continue;
        const i = Math.round((la - AXIS.lat0) / AXIS.step), j = Math.round((lo - AXIS.lon0) / AXIS.step);
        if (i < 0 || j < 0 || i >= AXIS.nLat || j >= AXIS.nLon) continue;
        fishSegs++;
        vessels.add(t.v);
        if (tm < tMin) tMin = tm;
        if (tm > tMax) tMax = tm;
        const vn = new Date((tm + 7 * 3600) * 1000).toISOString();
        const day = vn.slice(0, 10), month = vn.slice(0, 7);
        const season = SEASON_OF(Number(vn.slice(5, 7)));
        const moon = String(moonBin(tm));
        const ij = `${i},${j}`;
        add(accDay, day, "tat", ij, dtH, t.v, day);
        if (stormDays[day]) { stormSegs++; continue; }
        for (const gg of ["tat", g]) {
          add(accMonth, month, gg, ij, dtH, t.v, day);
          add(accSeason, season, gg, ij, dtH, t.v, day);
          add(accMoon, moon, gg, ij, dtH, t.v, day);
        }
      }
    }
    console.log(`[density] ${f}: ${(nPts / 1e6).toFixed(1)} triệu điểm · ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  const day = flush(accDay, false), month = flush(accMonth, true), season = flush(accSeason, true), moon = flush(accMoon, true);
  const iso = (s) => new Date((s + 7 * 3600) * 1000).toISOString().slice(0, 10);
  // FILE RA NGOÀI KHÔNG MANG DẤU VẾT NGUỒN (anh Long 25/10: gọi là "mật độ tàu dự kiến", trình bày như ước từ
  // AIS vệ tinh/ảnh vệ tinh): không snapshot, không số tàu, không tên bảng dải/gear-map/thu mua. Số đo thật in ra log.
  console.log(`[density] (log, không ghi file) snapshot ${SNAP} · tàu ${vessels.size} · đoạn ${segs} · đánh ${fishSegs} · bão loại ${stormSegs} · bands ${table.date} · nghề suy ${inferred.size} · thu mua ${carriers.size}`);
  const res = {
    v: 1,
    unit: "[i, j, giờ ×10, số tàu] — ô 0,25° cùng trục lưới cá",
    builtFrom: { months, from: iso(tMin), to: iso(tMax) },
    rule: { minVessels: MIN_VESSELS, season: { nam: [4, 9], bac: [10, 3] }, moonBins: 8 },
    axis: AXIS,
    gears: ["tat", ...GEARS],
    /** ngày có bão/ATNĐ trên Biển Đông (đệm ±1) → tên — CHỈ ở lát Ngày; lát tháng/mùa/trăng đã loại */
    storms: Object.fromEntries(Object.keys(stormDays).filter((d) => d >= iso(tMin) && d <= iso(tMax)).map((d) => [d, stormDays[d]])),
    days: { day: day.days, month: month.days, season: season.days, moon: moon.days },
    day: day.data,
    month: month.data,
    season: season.data,
    moon: moon.data,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res));
  console.log(
    `[density] ghi ${OUT} — ${months.length} tháng · ${vessels.size} tàu · đoạn đánh ${fishSegs}/${segs} · ô giữ/bỏ: ngày ${day.kept}/${day.dropped} · tháng ${month.kept}/${month.dropped} · mùa ${season.kept}/${season.dropped} · trăng ${moon.kept}/${moon.dropped} · ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB · ${Math.round((Date.now() - t0) / 1000)}s`,
  );
}

if (process.argv[1]?.endsWith("build-fleet-density.mjs")) main();
