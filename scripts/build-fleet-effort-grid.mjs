#!/usr/bin/env node
// LƯỚI GIỜ ĐÁNH BẮT CỦA ĐỘI TÀU 0,25° cho dự báo cá → src/data/fleet-effort-025.v1.json (2026-10-11).
// ─────────────────────────────────────────────────────────────────────────────
// VÌ SAO: phản hồi thực địa 11/10 (tàu BĐ-95532-TS, 12°52'N 115°38'E, "giữ hơn 20 tấn chờ
// tàu vây") — ô đó nước đều, không ranh nhiệt/xoáy ⇒ mô hình vệ tinh chấm 26–32, dưới cả
// mức Thấp. VMS 1–6/10 có 29 tàu trong ~20 hải lý, nhiều tàu Bình Định nằm 3–4 ngày liền:
// đội tàu BIẾT chỗ có cá mà vệ tinh không thấy (cá tụ dưới đèn/vật nổi). Lưới này đưa cái
// biết đó vào mô hình như MỘT kênh bằng chứng nữa (FLEET trong fish-predict.ts).
//
// CÁCH ĐẾM (giống profiles/grounds.json của sdvico-data/data-local, khác ở dải tốc độ):
//   đoạn giữa 2 điểm VMS liền nhau, khoảng ≤ 3 giờ, tốc độ 0–4,5 hải lý/giờ (GỒM CẢ đứng
//   yên — tàu đèn/vây ánh sáng giữ đàn là đứng yên), trung điểm cách mọi cảng ≥ 10 km
//   (bỏ neo đậu). Giờ của đoạn cộng vào ô 0,25° CÙNG TRỤC lưới cá (tâm x,025 / x,275…)
//   theo THÁNG (giờ VN) × NHÓM NGHỀ của tàu.
// RIÊNG TƯ: chỉ giữ ô có ≥ MIN_VESSELS tàu khác nhau trong tháng×nghề — lưới là số TỔNG,
//   không suy ra được vị trí một tàu nào. Không ghi số đăng ký, chủ tàu, mã tàu.
// LOÀI → NGHỀ: nghề mang về ≥ 10 % sản lượng loài trong nhật ký eCDT (cùng luật targetGears
//   của scripts/dl-eval.mjs), tên loài ghép qua ASFIS_TO_SHORT.
//
// NGUỒN (ngoài repo, có PII — chỉ đọc): ../AI Assistant/sdvico-data/data-local/datalake-iuu/ (dời từ ForFish/data-local 14/10/2026)
//   tracks/<YYYY-MM>.ndjson.gz · snapshots/<ngày>/vessels-asof-*.ndjson.gz ·
//   snapshots/<ngày>/logbooks-all.ndjson.gz · snapshots/<ngày>/catalog-ports.json.gz
// Chạy lại CHỈ KHI có thêm tháng VMS (quy tắc dữ liệu trong git: sinh lại là hành động có chủ ý):
//   node scripts/build-fleet-effort-grid.mjs [--root "../AI Assistant/sdvico-data/data-local/datalake-iuu"] [--snapshot 2026-10-11]
//   node scripts/build-fleet-effort-grid.mjs --exclude-month 2026-09 --out <tạm>   (kiểm định giữ-tháng-ra)
//   … --v2 [--gear-map <gear-map.json>]   ĐỊNH NGHĨA "GIỜ ĐÁNH" CHUNG VỚI NHÃN v2 (scripts/fishing-def.mjs +
//     fishing-bands.v2.json): dải tốc độ theo nghề thay cho 0–4,5 kn, vmin 0 chỉ vây ban đêm, cách MỌI cảng
//     ≥ 10 km, nghề tàu thiếu sổ lấy từ gear-map (bộ phân loại), bỏ tàu thu mua (likelyCarrier). Không cờ ⇒ y nguyên.
//   … --vessel-half A|B   CHỈ tàu thuộc nửa A (xô băm 0–4) hoặc B (5–9) — kiểm "tách theo tàu" (scripts/vessel-bucket.mjs)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { ASFIS_TO_SHORT, targetGears } from "./dl-eval.mjs";
import { vesselHalf } from "./vessel-bucket.mjs";
import { hav, gearGroup, GEARS, makePortIndex, nearAnyPort, loadBands, isFishingV2 } from "./fishing-def.mjs";
export { gearGroup, GEARS };

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
// Bản kéo Data Lake dời khỏi repo 14/10/2026 → repo AI Assistant (sdvico-data, dữ liệu gitignored). Máy khác: --root hoặc SDVICO_DATALAKE_ROOT.
const ROOT = arg("root", process.env.SDVICO_DATALAKE_ROOT || "../AI Assistant/sdvico-data/data-local/datalake-iuu");
export const OUT_DEFAULT = "src/data/fleet-effort-025.v1.json";
const OUT = arg("out", OUT_DEFAULT);
const EXCLUDE = new Set((arg("exclude-month", "") || "").split(",").filter(Boolean));
const HALF = arg("vessel-half", null);
if (HALF && HALF !== "A" && HALF !== "B") { console.error("--vessel-half phải là A hoặc B"); process.exit(2); }
const V2 = argv.includes("--v2");
const GEAR_MAP = arg("gear-map", null);

export const FISH_KN = [0, 4.5];
export const MAX_GAP_S = 3 * 3600;
export const MIN_PORT_KM = 10;
export const MIN_VESSELS = 3;
// Trục lưới cá (fish-forecast: SST blended stride 5 ⇒ 0,25°, tâm 5,025…22,025 × 102,025…118,025)
export const AXIS = { lat0: 5.025, lon0: 102.025, step: 0.25, nLat: 69, nLon: 65 };

async function* lines(file) {
  const input = file.endsWith(".gz") ? fs.createReadStream(file).pipe(zlib.createGunzip()) : fs.createReadStream(file);
  for await (const l of readline.createInterface({ input, crlfDelay: Infinity })) if (l) yield JSON.parse(l);
}

async function main() {
  const t0 = Date.now();
  const snapDir = path.join(ROOT, "snapshots");
  const SNAP = arg("snapshot", fs.readdirSync(snapDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1));
  const S = (n) => path.join(snapDir, SNAP, n);

  // cảng → lưới 0,5° tra nhanh "gần cảng"
  const cat = JSON.parse(zlib.gunzipSync(fs.readFileSync(S("catalog-ports.json.gz"))).toString("utf8"));
  const portGrid = makePortIndex(cat.items || cat);
  const nearPort = (lat, lng) => nearAnyPort(portGrid, lat, lng, MIN_PORT_KM);

  // nghề của tàu: bản sổ MỚI NHẤT thắng, bản cũ lấp chỗ trống
  const gearOf = new Map();
  const asof = fs.readdirSync(path.join(snapDir, SNAP)).filter((f) => /^vessels-asof-.*\.ndjson\.gz$/.test(f)).sort().reverse();
  for (const f of asof) for await (const v of lines(S(f))) if (v.vesselId && !gearOf.has(v.vesselId) && v.gear) gearOf.set(v.vesselId, gearGroup(v.gear));

  // v2: bảng dải dùng chung với nhãn, nghề suy cho tàu thiếu sổ, bỏ tàu thu mua
  let table = null, carriers = null, inferred = null, v2ctx = null;
  if (V2) {
    table = loadBands();
    v2ctx = { table, ports: portGrid };
    inferred = GEAR_MAP ? new Map(Object.entries(JSON.parse(fs.readFileSync(GEAR_MAP, "utf8")).vessels).map(([id, o]) => [id, o.group])) : new Map();
    const encF = path.join(ROOT, "encounters", "vessels.json");
    carriers = new Set(fs.existsSync(encF) ? Object.entries(JSON.parse(fs.readFileSync(encF, "utf8")).vessels).filter(([, o]) => o.likelyCarrier).map(([id]) => id) : []);
    console.log(`[fleet v2] bảng dải ${table.date} · nghề suy ${inferred.size} tàu · thu mua bỏ ${carriers.size} tàu`);
  }

  // loài → nghề (nhật ký eCDT, cùng luật targetGears)
  const kgBy = {};
  let nLog = 0;
  for await (const lb of lines(S("logbooks-all.ndjson.gz"))) {
    const g = gearOf.get(lb.vessel?.id);
    if (!g) continue;
    nLog++;
    for (const c of lb.species?.catch ?? []) {
      const sp = ASFIS_TO_SHORT[c.code];
      if (!sp || !(c.kg > 0)) continue;
      (kgBy[sp] ??= {})[g] = (kgBy[sp][g] ?? 0) + c.kg;
    }
  }
  const speciesGears = Object.fromEntries(Object.keys(kgBy).sort().map((sp) => [sp, targetGears(kgBy[sp]).sort()]));

  // giờ đánh theo tháng × nghề × ô
  const acc = new Map(); // `${month}|${gear}|${i},${j}` → {h, vs:Set}
  const months = [];
  const span = new Map(); // tháng → [giây đầu, giây cuối] có điểm VMS (tháng chưa trọn ⇒ chia theo ngày phủ)
  const tracksDir = path.join(ROOT, "tracks");
  for (const f of fs.readdirSync(tracksDir).filter((x) => /^\d{4}-\d{2}\.ndjson\.gz$/.test(x)).sort()) {
    let nPts = 0;
    for await (const t of lines(path.join(tracksDir, f))) {
      if (HALF && vesselHalf(t.v) !== HALF) continue;
      if (V2 && carriers.has(t.v)) continue;
      const g = gearOf.get(t.v) ?? (V2 ? inferred.get(t.v) : null) ?? "khac";
      const pts = t.pts;
      nPts += pts.length;
      for (let k = 1; k < pts.length; k++) {
        const [ta, la0, lo0] = pts[k - 1], [tb, la1, lo1] = pts[k];
        const dt = tb - ta;
        if (dt <= 0 || (!V2 && dt > MAX_GAP_S)) continue;
        const kn = hav(la0, lo0, la1, lo1) / 1.852 / (dt / 3600);
        const la = (la0 + la1) / 2, lo = (lo0 + lo1) / 2;
        if (V2) { if (!isFishingV2({ t: (ta + tb) / 2, lat: la, lon: lo, dtH: dt / 3600, kn }, g, v2ctx)) continue; }
        else if (kn < FISH_KN[0] || kn > FISH_KN[1]) continue;
        const i = Math.round((la - AXIS.lat0) / AXIS.step), j = Math.round((lo - AXIS.lon0) / AXIS.step);
        if (i < 0 || j < 0 || i >= AXIS.nLat || j >= AXIS.nLon) continue;
        if (!V2 && nearPort(la, lo)) continue;
        // tháng theo GIỜ VN của trung điểm đoạn
        const month = new Date(((ta + tb) / 2 + 7 * 3600) * 1000).toISOString().slice(0, 7);
        if (EXCLUDE.has(month)) continue;
        const sp = span.get(month) || span.set(month, [tb, ta]).get(month);
        if (ta < sp[0]) sp[0] = ta;
        if (tb > sp[1]) sp[1] = tb;
        const key = `${month}|${g}|${i},${j}`;
        const c = acc.get(key) || acc.set(key, { h: 0, vs: new Set() }).get(key);
        c.h += dt / 3600;
        c.vs.add(t.v);
      }
    }
    console.log(`[fleet] ${f}: ${(nPts / 1e6).toFixed(1)} triệu điểm · ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  const out = {};
  let kept = 0, dropped = 0, hours = 0;
  for (const [key, c] of acc) {
    const [month, g, ij] = key.split("|");
    if (c.vs.size < MIN_VESSELS) { dropped++; continue; }
    const [i, j] = ij.split(",").map(Number);
    ((out[month] ??= {})[g] ??= []).push([i, j, Math.round(c.h)]);
    kept++;
    hours += c.h;
  }
  for (const m of Object.keys(out)) { months.push(m); for (const g of Object.keys(out[m])) out[m][g].sort((a, b) => a[0] - b[0] || a[1] - b[1]); }
  months.sort();
  const sorted = Object.fromEntries(months.map((m) => [m, Object.fromEntries(GEARS.filter((g) => out[m][g]).map((g) => [g, out[m][g]]))]));

  const res = {
    v: 1,
    unit: "giờ có mặt-đánh bắt (VMS)",
    builtFrom: { snapshot: SNAP, vessels: gearOf.size, logbooks: nLog, excludedMonths: [...EXCLUDE], ...(HALF ? { vesselHalf: HALF } : {}), ...(V2 ? { v2: { bands: table.date, gearMapVessels: inferred.size, carriersDropped: carriers.size } } : {}) },
    rule: V2 ? { bands: Object.fromEntries(Object.entries(table.bands).map(([g, b]) => [g, b.band])), nightStill: table.nightStill, maxGapH: table.maxGapH, minPortKm: table.minPortKm, minVessels: MIN_VESSELS } : { kn: FISH_KN, maxGapH: MAX_GAP_S / 3600, minPortKm: MIN_PORT_KM, minVessels: MIN_VESSELS },
    axis: AXIS,
    gears: GEARS,
    months,
    /** số ngày VMS phủ của từng tháng — tháng đang chạy (vd 10/2026 tới ngày 6) chia đúng theo ngày */
    days: Object.fromEntries(months.map((m) => [m, Math.max(1, Math.round((span.get(m)[1] - span.get(m)[0]) / 86400))])),
    speciesGears,
    effort: sorted,
  };
  fs.writeFileSync(OUT, JSON.stringify(res));
  console.log(`[fleet] ghi ${OUT} — ${months.join(",")} · ô giữ ${kept} · bỏ (<${MIN_VESSELS} tàu) ${dropped} · ${Math.round(hours)} giờ · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${Math.round((Date.now() - t0) / 1000)}s`);
}

if (process.argv[1]?.endsWith("build-fleet-effort-grid.mjs")) main();
