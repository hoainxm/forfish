#!/usr/bin/env node
// LƯỚI SẢN LƯỢNG THEO LOÀI 0,25° cho dự báo cá → src/data/species-catch-025.v1.json (2026-10-14).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: kênh đội tàu (fleet-effort-025) biết "chỗ NGHỀ vây/câu/kéo hay làm", không biết loài:
// ô tàu vây làm dày vì cá nục vẫn đẩy điểm ngừ vằn lên. Nhật ký eCDT có kg TỪNG LOÀI, VMS có chỗ
// tàu đánh ⇒ biết loài nào ra ở ô nào, tháng nào. Lưới này đưa cái biết đó vào mô hình như một
// kênh bằng chứng nữa (CATCH trong fish-predict.ts).
//
// NGUỒN: nhãn của scripts/dl-build-labels.mjs (kg loài của chuyến chia theo GIỜ ĐÁNH VMS vào ô
// 0,05° × ngày, lời khai đã nhân trọng số tin cậy, kg/giờ vượt p99 nghề kéo về p99), dựng cả năm
// theo từng khúc `--window` ⇒ nhiều thư mục labels-<từ>/ (ngoài repo, có thể gộp nhiều).
// GỘP: kg theo THÁNG (giờ VN) × LOÀI (tên ngắn qua ASFIS_TO_SHORT) × ô 0,25° CÙNG TRỤC lưới cá.
// RIÊNG TƯ: chỉ giữ ô có ≥ MIN_VESSELS tàu khác nhau bắt loài đó trong tháng (catch-vessels-025.csv)
//   — lưới là số TỔNG, không suy ra được sản lượng một tàu nào. Không ghi số đăng ký, chủ tàu.
// SHAPE: CÙNG shape FleetEffortGrid (lib/fleet-effort.ts) với "nghề" = chính loài ⇒ dùng lại
//   fleetPresenceGrid/Lookup, chỉ khác đơn vị (kg thay giờ) và mức bão hoà.
//
// Chạy lại CHỈ KHI có thêm tháng nhật ký/VMS (sinh lại là hành động có chủ ý):
//   node scripts/build-species-catch-grid.mjs --labels ~/sdfish-data/dl-all/labels-2026-01-01,~/sdfish-data/dl-all/labels-2026-03-01,…
//   node scripts/build-species-catch-grid.mjs --labels … --exclude-month 2026-09 --out <tạm>   (kiểm định giữ-tháng-ra)
//   … --vessel-half A|B   CHỈ tàu nửa A/B (cần nhãn dựng với `dl-build-labels --vessel-hash`: cột vh)
//   … --catch-file catch-null.csv   đọc kg từ file khác (ablation triệt tiêu năng suất tàu)
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { homedir } from "node:os";
import { ASFIS_TO_SHORT } from "./dl-eval.mjs";
import { AXIS } from "./build-fleet-effort-grid.mjs";
import { halfOfBucket } from "./vessel-bucket.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
export const OUT_DEFAULT = "src/data/species-catch-025.v1.json";
export const MIN_VESSELS = 3;
/** Loài cần ít nhất chừng này tấn cả kỳ mới vào lưới — ít hơn thì vài chuyến quyết cả bản đồ. */
export const MIN_SPECIES_T = 20;

async function* csvRows(file) {
  let cols = null;
  for await (const l of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    if (!l) continue;
    const v = l.split(",");
    if (!cols) { cols = v; continue; }
    yield Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  }
}

const cellOf = (lat, lon) => {
  const i = Math.round((lat - AXIS.lat0) / AXIS.step), j = Math.round((lon - AXIS.lon0) / AXIS.step);
  return i < 0 || j < 0 || i >= AXIS.nLat || j >= AXIS.nLon ? null : [i, j];
};

async function main() {
  const t0 = Date.now();
  const DIRS = arg("labels", "").split(",").filter(Boolean).map(home);
  if (!DIRS.length) { console.error("thiếu --labels <thư mục,…>"); process.exit(2); }
  const OUT = home(arg("out", OUT_DEFAULT));
  const EXCLUDE = new Set((arg("exclude-month", "") || "").split(",").filter(Boolean));
  const HALF = arg("vessel-half", null);
  if (HALF && HALF !== "A" && HALF !== "B") { console.error("--vessel-half phải là A hoặc B"); process.exit(2); }
  const CATCH_FILE = arg("catch-file", "catch.csv");

  // số tàu theo tháng × ô × loài (cộng dồn qua các khúc: chuyến chỉ thuộc MỘT khúc theo ngày rời,
  // nhưng một tàu có thể ở hai khúc ⇒ lấy MAX thay vì cộng — đếm dưới, an toàn cho cổng riêng tư)
  const ves = new Map();
  for (const d of DIRS) {
    // trong MỘT khúc × MỘT mã ASFIS: cộng số tàu các xô băm (xô rời nhau) của nửa được chọn; rồi lấy MAX
    // qua các mã cùng tên ngắn và qua các khúc (đúng luật cũ — đếm dưới, an toàn cho cổng riêng tư;
    // nhãn không có cột vh thì mỗi dòng đã là tổng cả tàu)
    const inDir = new Map();
    for await (const r of csvRows(path.join(d, "catch-vessels-025.csv"))) {
      const sp = ASFIS_TO_SHORT[r.species];
      if (!sp) continue;
      const c = cellOf(+r.lat, +r.lon);
      if (!c) continue;
      if (HALF && r.vh === undefined) { console.error("--vessel-half cần nhãn có cột vh (dl-build-labels --vessel-hash)"); process.exit(2); }
      if (HALF && halfOfBucket(r.vh) !== HALF) continue;
      const k = `${r.month}|${sp}|${c[0]},${c[1]}`;
      const kc = `${k}#${r.species}`;
      inDir.set(kc, (inDir.get(kc) ?? 0) + +r.vessels);
    }
    for (const [kc, v] of inDir) { const k = kc.slice(0, kc.indexOf("#")); ves.set(k, Math.max(ves.get(k) ?? 0, v)); }
  }
  const nVes = (k) => ves.get(k) ?? 0;

  const acc = new Map(); // tháng|loài|i,j → kg
  const span = new Map(); // tháng → [ngày đầu, ngày cuối] có sản lượng
  const spKg = new Map();
  for (const d of DIRS) {
    for await (const r of csvRows(path.join(d, CATCH_FILE))) {
      const sp = ASFIS_TO_SHORT[r.species];
      const kg = +r.kg;
      if (!sp || !(kg > 0)) continue;
      if (HALF && halfOfBucket(r.vh) !== HALF) continue;
      const month = r.date.slice(0, 7);
      if (EXCLUDE.has(month)) continue;
      const c = cellOf(+r.lat, +r.lon);
      if (!c) continue;
      const s = span.get(month) || span.set(month, [r.date, r.date]).get(month);
      if (r.date < s[0]) s[0] = r.date;
      if (r.date > s[1]) s[1] = r.date;
      const k = `${month}|${sp}|${c[0]},${c[1]}`;
      acc.set(k, (acc.get(k) ?? 0) + kg);
      spKg.set(sp, (spKg.get(sp) ?? 0) + kg);
    }
    console.log(`[catch] ${d} · ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  const species = [...spKg].filter(([, kg]) => kg >= MIN_SPECIES_T * 1000).map(([s]) => s).sort();
  const keepSp = new Set(species);
  const out = {};
  let kept = 0, dropped = 0, kgKept = 0, kgDropped = 0;
  for (const [k, kg] of acc) {
    const [month, sp, ij] = k.split("|");
    if (!keepSp.has(sp)) continue;
    if (nVes(k) < MIN_VESSELS || kg < 1) { dropped++; kgDropped += kg; continue; }
    const [i, j] = ij.split(",").map(Number);
    ((out[month] ??= {})[sp] ??= []).push([i, j, Math.round(kg)]);
    kept++;
    kgKept += kg;
  }
  const months = Object.keys(out).sort();
  for (const m of months) for (const sp of Object.keys(out[m])) out[m][sp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // số ngày tháng: tháng trọn = số ngày lịch; tháng đầu/cuối dữ liệu chưa trọn = số ngày có sản lượng
  const calDays = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  const days = Object.fromEntries(months.map((m) => {
    const [a, b] = span.get(m);
    const n = Math.round((Date.parse(b) - Date.parse(a)) / 86400e3) + 1;
    return [m, Math.min(calDays(m), Math.max(1, n))];
  }));

  const res = {
    v: 1,
    unit: "kg sản lượng loài (nhật ký eCDT × giờ đánh VMS)",
    builtFrom: { labels: DIRS.map((d) => path.basename(d)), excludedMonths: [...EXCLUDE], ...(HALF ? { vesselHalf: HALF } : {}), ...(CATCH_FILE !== "catch.csv" ? { catchFile: CATCH_FILE } : {}) },
    rule: { minVessels: MIN_VESSELS, minSpeciesT: MIN_SPECIES_T },
    axis: AXIS,
    // "nghề" của shape FleetEffortGrid = chính loài
    gears: species,
    months,
    days,
    speciesGears: Object.fromEntries(species.map((s) => [s, [s]])),
    effort: Object.fromEntries(months.map((m) => [m, Object.fromEntries(species.filter((s) => out[m][s]).map((s) => [s, out[m][s]]))])),
  };
  fs.writeFileSync(OUT, JSON.stringify(res));
  console.log(`[catch] ghi ${OUT} — ${months.join(",")} · ${species.length} loài · ô giữ ${kept} (${Math.round(kgKept / 1000)} t) · bỏ (<${MIN_VESSELS} tàu) ${dropped} (${Math.round(kgDropped / 1000)} t) · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (process.argv[1]?.endsWith("build-species-catch-grid.mjs")) main();
