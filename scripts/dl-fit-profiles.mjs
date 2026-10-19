// scripts/dl-fit-profiles.mjs  (npx tsx scripts/dl-fit-profiles.mjs --species "ngừ vằn,cá nục")
// ─────────────────────────────────────────────────────────────────────────────
// TỐI ƯU THAM SỐ HỒ SƠ LOÀI bằng SẢN LƯỢNG THẬT (nhật ký eCDT × track VMS — nhãn của scripts/dl-build-labels.mjs).
// KHÔNG đổi dạng mô hình: chỉ dò lại SỐ trong SpeciesProfile (dải nhiệt, dải mồi, mức lệ thuộc mồi, cổng độ sâu,
// cổng cách bờ). Chạy trên CACHE ĐẶC TRƯNG Ô-NGÀY (scripts/fish-features-cache.mjs) bằng đúng `scoreCell` của
// production — không dựng lại lưới, không mạng.
//
// VIẾT LẠI 2026-10-18 (mảnh 2B, rà pipeline docs/app-map/ops/fish-train-review-2026-10-18) — khác bản cũ:
//   1. TỐC ĐỘ  : 1 loài × 61 ngày từ ~17 phút xuống ≤1 phút (cache đặc trưng + habitat tính 1 lần/ô-ngày).
//   2. ĐIỂM    : LIÊN TỤC (không làm tròn nguyên, không cắt KEEP_MIN) — histogram 1024 ngăn.
//   3. KÊNH TĨNH: hai kênh đội tàu + sản lượng BẬT, ở chế độ GIỮ-THÁNG-RA (lưới dựng không có tháng của ngày chấm) —
//      đo "vệ tinh thêm được gì trên nền bãi cá", đúng cấu hình production (bản cũ fit mô hình KHÔNG có hai kênh).
//   4. SỐ ĐO   : AUCeff TRONG-NGHỀ Σ_g w_g·AUC(kg nghề g, giờ nghề g) — bỏ lẫn địa lý nghề (xem README §6).
//   5. KIỂM CHÉO: K nếp theo tháng (mặc định: cặp tháng lịch 01+02…09+10; ≤3 tháng ⇒ mỗi tháng một nếp) có ĐỆM 15 ngày
//      giữa train và test, cộng CHUỖI TIẾN F3 (--forward): tháng M thử bằng fit trên các ngày trước M−15 ngày.
//   6. NGƯỠNG NHẬN: thay MIN_GAIN 0,01 bằng thống kê — chênh AUC (fit − gốc) gộp mọi ngày thử có cận dưới CI 90 %
//      bootstrap KHỐI 7 NGÀY > 0 VÀ qua Benjamini–Hochberg q=0,1 trên các loài chạy chung một lượt.
//
// Ra: <out>/fit-<loài>.json  +  <out>/fit-summary.json (bảng BH)
//
//   --species "a,b,c"   (bắt buộc; nhiều loài chạy chung một lượt để BH có nghĩa; nhãn nạp một lần)
//   --features <dir>    mặc định $SDFISH_DATA_DIR/fc-full/features (xem fish-features-cache.mjs)
//   --labels  a,b,c     thư mục nhãn (effort.csv + catch.csv), gộp theo ngày. Mặc định $SDFISH_DATA_DIR/dl-trk0809/labels-vh
//   --fleet-dir / --catch-dir   lưới tĩnh GIỮ-THÁNG-RA: fleet-ex-<tag>.json / catch-ex-<tag>.json, tag = "2026-08" (một tháng)
//                       hoặc "2026-07+2026-08" (nếp 2 tháng). Dựng bằng build-fleet-effort-grid.mjs / build-species-catch-grid.mjs
//                       --exclude-month 2026-07,2026-08  (in lệnh thiếu bằng --plan)
//   --no-static         tắt hai kênh tĩnh (so sánh với bản cũ)
//   --folds "2026-08,2026-09" | "2026-01+2026-02,…" | auto   --pad 15   --forward   --boot 400
//   --cfg '{"chlShift":-1}'   KHÔNG dò — chỉ đo gốc vs bộ chỉnh này trên các nếp
//   --label-shift N     KIỂM NHẬN-OAN: ghép dự báo ngày d với nhãn ngày d+N (N ≥ 15 ⇒ cá của ngày khác hẳn).
//   --ctrl-shift C      ĐỐI CHỨNG ĐỘNG (mặc định 15): mỗi ngày thử còn được chấm với nhãn lệch thêm ±C ngày. Chênh ĐỘNG =
//                       (fit−gốc | nhãn thật) − (fit−gốc | nhãn lệch). Lý do: bản đo đợt 2B (2026-10-18) cho thấy chênh thô vẫn
//                       "nhận" 5/10 loài khi nhãn lệch 15 ngày — hồ sơ học được HÌNH HỌC BÃI THEO MÙA (nhãn lệch ngày cũng thấy),
//                       không phải "ô nào hôm nay có cá". 0 = tắt.
//   --accept dyn|raw    tiêu chí NHẬN: dyn (mặc định) = CI dưới của chênh ĐỘNG > 0 + BH; raw = chênh thô (kiểu v2.0)
//   --legacy-score      ĐỐI CHỨNG với bản cũ: làm tròn điểm nguyên + cắt KEEP_MIN=25 về 0 (tái hiện số cũ để kiểm bộ đo)
//   --from/--to YYYY-MM-DD   chỉ dùng ngày dự báo trong khoảng (vd nhãn lệch +15 ngày kéo thêm ngày tháng 7 có nhãn nhưng không có lưới tĩnh)
//   --local             thêm hai số đo phụ trên các ngày thử (scripts/fish-metrics-local.mjs): AUC cục bộ 1°×1° và Spearman dị thường ngày×ô,
//                       cho hồ sơ gốc vs hồ sơ đã fit, nhãn thật vs nhãn đối chứng (chỉ ô trong vụ — khối lượng ngoài vụ không có toạ độ)
//   --plan              chỉ in nếp, số ngày, các file lưới tĩnh cần có (và lệnh dựng file thiếu)
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import { SPECIES_PROFILES, cellHabitat, scoreCell, seasonWeights, CATCH_FULL_KG } from "../src/lib/fish-predict.ts";
import { fleetPresenceLookup, FLEET_FULL_HOURS } from "../src/lib/fleet-effort.ts";
import { targetGears, ASFIS_TO_SHORT } from "./dl-eval.mjs";
import { decodeFeatures, readFeatureDay, readSeaMask, dataDir } from "./fish-features-cache.mjs";
import { localAuc, spearmanAnom } from "./fish-metrics-local.mjs";
import { NBF, binOf, recLen, recMetrics, makeFolds, makeForward, blockIds, bootstrapGain, bhAdjust } from "./fish-fit-lib.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const home = (p) => p.replace(/^~/, homedir());
const DD = dataDir();
const FEAT = home(arg("features", join(DD, "fc-full/features")));
const LABS = arg("labels", join(DD, "dl-trk0809/labels-vh")).split(",").map(home);
const OUT = home(arg("out", join(DD, "fit")));
const FLEET_DIR = home(arg("fleet-dir", join(DD, "fleet")));
const CATCH_DIR = home(arg("catch-dir", join(DD, "catch")));
const NO_STATIC = argv.includes("--no-static");
const SPECIES = (arg("species", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const PAD = Number(arg("pad", 15));
const BOOT = Number(arg("boot", 400));
const FORWARD = argv.includes("--forward");
const PLAN = argv.includes("--plan");
const LEGACY = argv.includes("--legacy-score");
const LOCAL = argv.includes("--local");
const LABEL_SHIFT = Number(arg("label-shift", 0));
const CTRL = Number(arg("ctrl-shift", 15));
const ACCEPT = arg("accept", "dyn");
const FIXED_CFG = arg("cfg", null) ? JSON.parse(arg("cfg")) : null;
const shiftDay = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
if (!SPECIES.length) { console.error('cần --species "<tên ngắn>[,<tên ngắn>…]"'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

/* ── cache đặc trưng ──────────────────────────────────────────────────────── */
const MF = JSON.parse(readFileSync(join(FEAT, "manifest.json"), "utf8"));
const { nLat, nLon, lat0, lon0, step } = MF.axis;
const allDates = Object.keys(MF.days).filter((d) => d >= arg("from", "0000") && d <= arg("to", "9999")).sort();
const climo = JSON.parse(readFileSync(new URL("../src/data/sst-climatology.v1.json", import.meta.url), "utf8")).regions;
const monthOf = (d) => Number(d.slice(5, 7));
const f32Cache = new Map(), maskCache = new Map();
const f32Of = (d) => f32Cache.get(d) ?? f32Cache.set(d, readFeatureDay(FEAT, d)).get(d);
const maskOf = (d) => maskCache.get(d) ?? maskCache.set(d, readSeaMask(FEAT, d)).get(d);

/* ── nhãn (nạp một lần cho mọi loài) ─────────────────────────────────────── */
async function eachRow(file, fn) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let col = null;
  for await (const line of rl) {
    if (!line) continue;
    const c = line.split(",");
    if (!col) { col = Object.fromEntries(c.map((n, i) => [n, i])); continue; }
    fn(c, col);
  }
}
const cellKey = (lat, lon) => {
  const i = Math.round((lat - lat0) / step), j = Math.round((lon - lon0) / step);
  return i < 0 || j < 0 || i >= nLat || j >= nLon ? -1 : i * nLon + j;
};
const profs = SPECIES.map((s) => {
  const p = SPECIES_PROFILES.find((x) => x.short === s);
  if (!p) { console.error(`không có hồ sơ "${s}"`); process.exit(2); }
  return p;
});
const labelState = {}; // short → {raw: Map date→Map key→{gear:kg}, gearKg:{gear:kg}, tg:[nghề mục tiêu]}
for (const p of profs) labelState[p.short] = { raw: new Map(), gearKg: {} };
const effRaw = new Map(); // date → Map key → {gear: hours}   (chỉ nghề mục tiêu của một loài nào đó)
async function loadLabels() {
  const want = new Set(SPECIES);
  for (const dir of LABS) {
    await eachRow(join(dir, "catch.csv"), (c, col) => {
      const sp = ASFIS_TO_SHORT[c[col.species]];
      if (!sp || !want.has(sp)) return;
      const k = cellKey(+c[col.lat], +c[col.lon]);
      if (k < 0) return;
      const st = labelState[sp], gear = c[col.gear], kg = +c[col.kg];
      st.gearKg[gear] = (st.gearKg[gear] ?? 0) + kg;
      const dm = st.raw.get(c[col.date]) ?? st.raw.set(c[col.date], new Map()).get(c[col.date]);
      const cm = dm.get(k) ?? dm.set(k, {}).get(k);
      cm[gear] = (cm[gear] ?? 0) + kg;
    });
  }
  const gearsUnion = new Set();
  for (const p of profs) {
    labelState[p.short].tg = targetGears(labelState[p.short].gearKg);
    for (const g of labelState[p.short].tg) gearsUnion.add(g);
  }
  for (const dir of LABS) {
    await eachRow(join(dir, "effort.csv"), (c, col) => {
      const g = c[col.geartype];
      if (!gearsUnion.has(g)) return;
      const k = cellKey(+c[col.lat], +c[col.lon]);
      if (k < 0) return;
      const dm = effRaw.get(c[col.date]) ?? effRaw.set(c[col.date], new Map()).get(c[col.date]);
      const cm = dm.get(k) ?? dm.set(k, {}).get(k);
      cm[g] = (cm[g] ?? 0) + +c[col.hours];
    });
  }
}

/** Nhãn của ngày dự báo d cho loài p: Map key→Float64Array(G) pos/neg (đã lọc ô biển), tổng mỗi nghề */
const dayLabCache = new Map();
function dayLab(p, d, shift = LABEL_SHIFT) {
  const ck = `${p.short}|${d}|${shift}`;
  if (dayLabCache.has(ck)) return dayLabCache.get(ck);
  const tg = labelState[p.short].tg, G = tg.length, ld = shift ? shiftDay(d, shift) : d;
  const mask = maskOf(d);
  const pos = new Map(), neg = new Map(), posTot = new Float64Array(G), negTot = new Float64Array(G);
  for (const [k, gm] of labelState[p.short].raw.get(ld) ?? []) {
    if (!mask[k]) continue;
    const a = new Float64Array(G);
    tg.forEach((g, gi) => { a[gi] = gm[g] ?? 0; posTot[gi] += a[gi]; });
    pos.set(k, a);
  }
  for (const [k, gm] of effRaw.get(ld) ?? []) {
    if (!mask[k]) continue;
    const a = new Float64Array(G);
    tg.forEach((g, gi) => { a[gi] = gm[g] ?? 0; negTot[gi] += a[gi]; });
    neg.set(k, a);
  }
  const out = { pos, neg, posTot, negTot, hasLabel: posTot.some((x) => x > 0), nSea: mask.reduce((a, b) => a + b, 0) };
  dayLabCache.set(ck, out);
  return out;
}

/* ── lưới tĩnh giữ-tháng-ra ───────────────────────────────────────────────── */
const staticGrids = new Map(), lookups = new Map();
const staticPath = (kind, tag) => join(kind === "fleet" ? FLEET_DIR : CATCH_DIR, `${kind}-ex-${tag}.json`);
function staticLookup(kind, tag, month) {
  const lk = `${kind}|${tag}|${month}`;
  if (lookups.has(lk)) return lookups.get(lk);
  const gk = `${kind}|${tag}`;
  if (!staticGrids.has(gk)) {
    const f = staticPath(kind, tag);
    if (!existsSync(f)) throw new Error(`thiếu lưới tĩnh giữ-tháng-ra ${f}\n  dựng: node scripts/${kind === "fleet" ? "build-fleet-effort-grid" : "build-species-catch-grid"}.mjs${kind === "fleet" ? "" : " --labels <các thư mục nhãn>"} --exclude-month ${tag.replace(/\+/g, ",")} --out ${f}`);
    staticGrids.set(gk, JSON.parse(readFileSync(f, "utf8")));
  }
  const fn = fleetPresenceLookup(staticGrids.get(gk), month, kind === "fleet" ? FLEET_FULL_HOURS : CATCH_FULL_KG);
  lookups.set(lk, fn);
  return fn;
}

/* ── chuẩn bị ô-ngày của một loài (không đổi theo cfg) ────────────────────── */
const prepCache = new Map();
function prep(p, d, tag) {
  const ck = `${p.short}|${d}|${tag}`;
  if (prepCache.has(ck)) return prepCache.get(ck);
  const month = monthOf(d);
  const sWm = new Map();
  const F = decodeFeatures(f32Of(d), MF.regions, (rid) => {
    const w = seasonWeights(rid, month).get(p.species);
    if (w == null) return false;
    sWm.set(rid, w);
    return true;
  });
  const n = F.length, sW = new Float64Array(n), fx = new Float64Array(n), cx = new Float64Array(n), hab = new Float64Array(n);
  const k = { month, climo };
  const flk = NO_STATIC ? null : staticLookup("fleet", tag, month), clk = NO_STATIC ? null : staticLookup("catch", tag, month);
  for (let q = 0; q < n; q++) {
    const f = F[q];
    sW[q] = sWm.get(f.regionId);
    if (flk) { fx[q] = flk(p.short, f.lat, f.lon); cx[q] = clk(p.short, f.lat, f.lon); }
    hab[q] = cellHabitat(f, p, fx[q], k);
  }
  const out = { F, sW, fx, cx, hab, k, n };
  prepCache.set(ck, out);
  return out;
}

/** Nhãn của ngày d (lệch `shift` ngày) đặt lên các ô của `P` + khối lượng ở ô ngoài vụ (điểm 0). */
const labAttach = new Map();
function labelsOn(p, d, shift, P, tagKey) {
  const ck = `${p.short}|${d}|${shift}|${tagKey}`;
  if (labAttach.has(ck)) return labAttach.get(ck);
  const G = labelState[p.short].tg.length, n = P.n, lab = dayLab(p, d, shift);
  const posC = new Float64Array(n * G), negC = new Float64Array(n * G), inPos = new Float64Array(G), inNeg = new Float64Array(G);
  for (let q = 0; q < n; q++) {
    const key = P.F[q].i * nLon + P.F[q].j;
    const a = lab.pos.get(key), b = lab.neg.get(key);
    for (let g = 0; g < G; g++) {
      if (a) { posC[q * G + g] = a[g]; inPos[g] += a[g]; }
      if (b) { negC[q * G + g] = b[g]; inNeg[g] += b[g]; }
    }
  }
  const out = { G, posC, negC, outPos: Float64Array.from(lab.posTot, (t, g) => t - inPos[g]), outNeg: Float64Array.from(lab.negTot, (t, g) => t - inNeg[g]), outArea: lab.nSea - n };
  labAttach.set(ck, out);
  return out;
}

/** Cộng một ngày vào bản ghi `rec` với hồ sơ `p` đã áp cfg. */
function scoreDay(p, P, L, rec) {
  const { F, sW, fx, cx, hab, k, n } = P, { G, posC, negC } = L, area = 2 * G * NBF;
  for (let q = 0; q < n; q++) {
    let sc = scoreCell(F[q], p, sW[q], fx[q], cx[q], k, hab[q]);
    if (LEGACY) { const v = Math.round(sc * 100); sc = v >= 25 ? v / 100 : 0; }
    const b = binOf(sc);
    for (let g = 0; g < G; g++) {
      const a = posC[q * G + g], c = negC[q * G + g];
      if (a) rec[2 * g * NBF + b] += a;
      if (c) rec[(2 * g + 1) * NBF + b] += c;
    }
    rec[area + b] += 1;
  }
  for (let g = 0; g < G; g++) { rec[2 * g * NBF] += L.outPos[g]; rec[(2 * g + 1) * NBF] += L.outNeg[g]; }
  rec[area] += L.outArea; // ô ngoài vụ / cổng nhiệt = điểm 0
}

/* ── áp cfg lên hồ sơ (tại chỗ) — giữ nguyên luật bản cũ ─────────────────── */
function makeApply(prof) {
  const base = structuredClone(prof);
  const apply = (cfg) => {
    for (const k of Object.keys(prof)) if (!(k in base)) delete prof[k];
    Object.assign(prof, structuredClone(base));
    const sh = cfg.sstShift ?? 0, wd = cfg.sstWidth ?? 1;
    const tr = (a) => { const c = (a[1] + a[2]) / 2; return a.map((v) => +(c + (v - c) * wd + sh).toFixed(2)); };
    // LUẬT NGHIỆP VỤ (test fish-predict "trần nhiệt", chốt 2026-10-03): nước VN mùa hè 29,5–30,5 °C
    // ⇒ loài TẦNG MẶT không được HẠ phía nóng (sst[2], sst[3]) — chỉ chỉnh phía lạnh hoặc nâng trần.
    const surface = !base.tempSource || base.tempSource === "surface";
    const keepWarm = (a, b0) => {
      if (!surface) return a;
      const w = [a[0], a[1], Math.max(a[2], b0[2]), Math.max(a[3], b0[3])];
      w[1] = Math.min(w[1], w[2]);
      w[0] = Math.min(w[0], w[1]);
      return w;
    };
    prof.sst = keepWarm(tr(base.sst), base.sst);
    if (base.sstFallback) prof.sstFallback = keepWarm(tr(base.sstFallback), base.sstFallback);
    if (cfg.chlShift) prof.chlLog = base.chlLog.map((v) => +(v + cfg.chlShift).toFixed(2));
    if (cfg.food !== undefined) prof.foodDependence = cfg.food;
    if (cfg.depthScale && base.offshore) prof.offshore = base.offshore.map((v) => Math.round(v * cfg.depthScale));
    if (cfg.depthScale && base.inshore) prof.inshore = base.inshore.map((v) => Math.round(v * cfg.depthScale));
    // coastKm khai RIÊNG (ngừ vằn, nục heo [10,25] — nguồn RIMF, test khoá) ⇒ không dò
    if (cfg.coastScale && base.offshore && !base.coastKm) prof.coastKm = (base.coastKm ?? [20, 50]).map((v) => Math.round(v * cfg.coastScale));
  };
  return { base, apply };
}

function gridOf(base) {
  return {
    sstShift: [-2, -1, -0.5, 0.5, 1, 2],
    sstWidth: [0.6, 0.8, 1.25, 1.5],
    // −0,4 là mép ở lượt đầu 2026-10-10 (13/16 loài nhận dừng đúng mép) ⇒ mở rộng tới −1,0
    chlShift: [-1, -0.8, -0.6, -0.4, -0.2, 0.2, 0.4],
    food: [0, 0.25, 0.5, 0.75],
    ...(base.offshore || base.inshore ? { depthScale: [0.5, 0.75, 1.5, 2] } : {}),
    ...(base.offshore && !base.coastKm ? { coastScale: [0.5, 0.75, 1.5] } : {}),
  };
}

/* ── kế hoạch nếp ─────────────────────────────────────────────────────────── */
function parseFolds(dates) {
  const spec = arg("folds", "auto");
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  if (spec !== "auto") return spec.split(",").map((g) => g.split("+"));
  if (months.length <= 3) return months.map((m) => [m]);
  const out = new Map();
  for (const m of months) {
    const pair = Math.floor((Number(m.slice(5, 7)) - 1) / 2);
    const key = `${m.slice(0, 4)}-${pair}`;
    (out.get(key) ?? out.set(key, []).get(key)).push(m);
  }
  return [...out.values()];
}
const FOLDS_M = parseFolds(allDates);

if (PLAN) {
  const folds = makeFolds(allDates, FOLDS_M, PAD);
  const mons = [...new Set(allDates.map((d) => d.slice(0, 7)))].sort();
  console.log(`ngày có cache: ${allDates.length} (${mons.map((m) => `${m}:${allDates.filter((d) => d.startsWith(m)).length}`).join(" ")})`);
  for (const f of folds) console.log(`nếp ${f.name}: thử ${f.test.length} ngày · train ${f.train.length} ngày (đệm ${PAD})`);
  const tags = new Set([...mons, ...folds.map((f) => f.name)]);
  for (const t of tags) for (const kind of ["fleet", "catch"]) {
    const f = staticPath(kind, t);
    console.log(`${existsSync(f) ? "có   " : "THIẾU"} ${f}${existsSync(f) ? "" : `   ← --exclude-month ${t.replace(/\+/g, ",")}`}`);
  }
  process.exit(0);
}

/* ═════════════ chạy ═════════════ */
const T0 = Date.now();
await loadLabels();
console.log(`nhãn nạp xong (${((Date.now() - T0) / 1000).toFixed(1)} s)`);

const monthTag = (d) => d.slice(0, 7);
const results = [];
for (const prof of profs) {
  // bộ nhớ: ô-ngày đã giải mã của loài trước không dùng lại (10 loài × 280 ngày × 2 tag ≈ vài GB nếu giữ)
  prepCache.clear(); labAttach.clear(); dayLabCache.clear();
  const ts = Date.now();
  const { base, apply } = makeApply(prof);
  const G = labelState[prof.short].tg.length;
  const days = allDates.filter((d) => dayLab(prof, d).hasLabel);
  if (days.length < 8) { console.log(`${prof.short}: chỉ ${days.length} ngày có nhãn — bỏ`); continue; }
  const tagFn = (override) => (d) => override?.[d] ?? monthTag(d);

  /** đo cfg trên tập ngày; perDay ⇒ trả thêm bản ghi từng ngày */
  const evaluate = (cfg, ds, tags, perDay = false, shiftOf = () => LABEL_SHIFT) => {
    apply(cfg);
    const tot = new Float64Array(recLen(G)), per = perDay ? [] : null;
    for (const d of ds) {
      const tag = tags(d), P = prep(prof, d, tag), L = labelsOn(prof, d, shiftOf(d), P, tag);
      if (per) { const r = new Float64Array(recLen(G)); scoreDay(prof, P, L, r); per.push(r); for (let i = 0; i < r.length; i++) tot[i] += r[i]; }
      else scoreDay(prof, P, L, tot);
    }
    return { ...recMetrics(tot, G), per };
  };
  /** nhãn ĐỐI CHỨNG của ngày d: lệch thêm +CTRL ngày (hoặc −CTRL nếu hết nhãn); null = không có */
  const ctrlShift = (d) => {
    if (!CTRL) return null;
    for (const c of [CTRL, -CTRL]) if (dayLab(prof, d, LABEL_SHIFT + c).hasLabel) return LABEL_SHIFT + c;
    return null;
  };
  /** hàng ô-ngày {day,cell,lat,lon,score,kg,hours} cho số đo cục bộ (điểm thực 0..1) */
  const rowsFor = (cfg, ds, tags, shiftOf) => {
    apply(cfg);
    const rows = [];
    for (const d of ds) {
      const tag = tags(d), P = prep(prof, d, tag), L = labelsOn(prof, d, shiftOf(d), P, tag), Gn = L.G;
      for (let q = 0; q < P.n; q++) {
        const F = P.F[q];
        let kg = 0, hours = 0;
        for (let g = 0; g < Gn; g++) { kg += L.posC[q * Gn + g]; hours += L.negC[q * Gn + g]; }
        rows.push({ day: d, cell: F.i * nLon + F.j, lat: F.lat, lon: F.lon, score: scoreCell(F, prof, P.sW[q], P.fx[q], P.cx[q], P.k, P.hab[q]), kg, hours });
      }
    }
    return rows;
  };
  const GRID = gridOf(base);
  /** leo toạ độ: mỗi nút thử mọi mức, giữ mức tốt nhất nếu AUC trong-nghề tăng > 0,002; 2 vòng */
  const fit = (ds, tags) => {
    let cfg = {}, best = evaluate(cfg, ds, tags), evals = 1;
    for (let round = 0; round < 2; round++) {
      let moved = false;
      for (const [k, vals] of Object.entries(GRID))
        for (const v of vals) {
          const c = { ...cfg, [k]: v }, r = evaluate(c, ds, tags); evals++;
          if (r.within > best.within + 0.002 && r.area >= best.area - 0.02) { cfg = c; best = r; moved = true; }
        }
      if (!moved) break;
    }
    return { cfg, best, evals };
  };
  const stat = (m) => m.within;

  const foldDefs = makeFolds(days, FOLDS_M, PAD).filter((f) => f.test.length >= 5 && (FIXED_CFG || f.train.length >= 8));
  const foldOut = [], pooled = [], localRows = {};
  let nEval = 0;
  for (const f of foldDefs) {
    const testTags = tagFn(Object.fromEntries(f.test.map((d) => [d, f.name])));
    const tr = FIXED_CFG ? { cfg: FIXED_CFG, best: null, evals: 0 } : fit(f.train, tagFn());
    nEval += tr.evals;
    const b = evaluate({}, f.test, testTags, true);
    const t = evaluate(tr.cfg, f.test, testTags, true);
    // đối chứng: cùng ngày thử, cùng điểm, nhãn lệch thêm ±CTRL ngày (chỉ ngày có nhãn đối chứng)
    const cd = f.test.filter((d) => ctrlShift(d) != null);
    const cmap = Object.fromEntries(cd.map((d) => [d, ctrlShift(d)]));
    const cb = cd.length ? evaluate({}, cd, testTags, true, (d) => cmap[d]) : null;
    const ct = cd.length ? evaluate(tr.cfg, cd, testTags, true, (d) => cmap[d]) : null;
    f.test.forEach((d, i) => {
      const ci = cd.indexOf(d);
      pooled.push({ d, base: b.per[i], fit: t.per[i], cbase: ci >= 0 ? cb.per[ci] : null, cfit: ci >= 0 ? ct.per[ci] : null });
    });
    if (LOCAL) {
      const add = (c, rows) => { const a = (localRows[c] ??= []); for (const r of rows) a.push(r); };
      add("base", rowsFor({}, f.test, testTags, () => LABEL_SHIFT));
      add("fit", rowsFor(tr.cfg, f.test, testTags, () => LABEL_SHIFT));
      if (cd.length) {
        add("cbase", rowsFor({}, cd, testTags, (d) => cmap[d]));
        add("cfit", rowsFor(tr.cfg, cd, testTags, (d) => cmap[d]));
      }
    }
    foldOut.push({
      fold: f.name, test: f.test.length, train: f.train.length, cfg: tr.cfg, testBase: b.within, testFit: t.within, gain: t.within - b.within, kg: Math.round(b.kg),
      ...(cb ? { ctrlDays: cd.length, ctrlGain: ct.within - cb.within } : {}),
    });
  }
  let boot = null, dyn = null;
  if (pooled.length) {
    const ids = blockIds(pooled.map((x) => x.d));
    boot = bootstrapGain(pooled.map((x, i) => ({ block: ids[i], base: x.base, fit: x.fit })), G, stat, BOOT);
    // chênh ĐỘNG chỉ trên ngày có cả nhãn đối chứng; đủ ≥8 ngày mới tính
    const withC = pooled.map((x, i) => ({ x, i })).filter(({ x }) => x.cbase);
    if (CTRL && withC.length >= 8) {
      const idsC = blockIds(withC.map(({ x }) => x.d));
      dyn = bootstrapGain(withC.map(({ x }, k) => ({ block: idsC[k], base: x.base, fit: x.fit, cbase: x.cbase, cfit: x.cfit })), G, stat, BOOT);
    }
  }

  let local = null;
  if (LOCAL) {
    local = {};
    for (const [name, rows] of Object.entries(localRows)) {
      const la = localAuc(rows), sa = spearmanAnom(rows, { boot: 100 });
      local[name] = { localAuc: la.auc, blocks: la.blocks, kgCovered: la.kgTotal ? la.kgUsed / la.kgTotal : null, spearman: sa.rho, spearmanN: sa.n, spearmanCells: sa.cells, spearmanCI90: sa.ci90 };
    }
  }

  // chuỗi tiến F3 (chỉ báo cáo, không tham gia nhận): lưới tĩnh của tháng M dựng không có M (nếu có lưới tiến thì dùng)
  const forwardOut = [];
  if (FORWARD && !FIXED_CFG) {
    for (const f of makeForward(days, PAD)) {
      const fwdTag = existsSync(staticPath("fleet", f.name)) && existsSync(staticPath("catch", f.name)) ? f.name : f.months[0];
      const testTags = tagFn(Object.fromEntries(f.test.map((d) => [d, fwdTag])));
      const tr = fit(f.train, tagFn());
      nEval += tr.evals;
      const b = evaluate({}, f.test, testTags), t = evaluate(tr.cfg, f.test, testTags);
      forwardOut.push({ fold: f.name, test: f.test.length, train: f.train.length, cfg: tr.cfg, testBase: b.within, testFit: t.within, gain: t.within - b.within, staticFuture: fwdTag !== f.name });
    }
  }
  apply({});
  const baseAll = evaluate({}, days, tagFn());
  results.push({ prof, apply, G, days, fit, evaluate, tagFn, foldOut, forwardOut, boot, dyn, local, baseAll, secs: (Date.now() - ts) / 1000, nEval });
  const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
  if (local) console.log(`  cục bộ ${Object.entries(local).map(([k, v]) => `${k}: AUC1° ${fmt(v.localAuc)} ρ${fmt(v.spearman)}(n=${v.spearmanN})`).join(" · ")}`);
  console.log(`${prof.short}: ${days.length} ngày · gốc ${fmt(baseAll.within)} · ${foldOut.map((f) => `${f.fold} ${fmt(f.testBase)}→${fmt(f.testFit)}`).join(" · ")} · gộp ${boot ? `${boot.gain >= 0 ? "+" : ""}${boot.gain.toFixed(3)} CI90[${fmt(boot.lo)}…${fmt(boot.hi)}] p=${boot.p.toFixed(3)}` : "—"} · động ${dyn ? `${dyn.gain >= 0 ? "+" : ""}${dyn.gain.toFixed(3)} CI90[${fmt(dyn.lo)}…${fmt(dyn.hi)}] p=${dyn.p.toFixed(3)}` : "—"} (${((Date.now() - ts) / 1000).toFixed(1)} s, ${nEval} lượt dò)`);
}

/* ── Benjamini–Hochberg trên loài, rồi fit cuối cho loài được NHẬN ─────────── */
const bhRaw = bhAdjust(results.map((r) => r.boot?.p ?? NaN), 0.1);
const bhDyn = bhAdjust(results.map((r) => r.dyn?.p ?? NaN), 0.1);
const bh = ACCEPT === "raw" ? bhRaw : bhDyn;
const summary = [];
results.forEach((r, i) => {
  const { prof } = r;
  const boot = ACCEPT === "raw" ? r.boot : r.dyn; // thống kê quyết định NHẬN
  const rawOk = !!r.boot && Number.isFinite(r.boot.lo) && r.boot.lo > 0 && bhRaw.reject[i];
  const dynOk = !!r.dyn && Number.isFinite(r.dyn.lo) && r.dyn.lo > 0 && bhDyn.reject[i];
  const accepted = ACCEPT === "raw" ? rawOk : rawOk && dynOk; // dyn: phải thắng cả chênh thô lẫn chênh động
  void boot;
  let final = { cfg: {}, best: r.baseAll }, finalProfile = null;
  if (accepted) {
    final = FIXED_CFG ? { cfg: FIXED_CFG, best: r.evaluate(FIXED_CFG, r.days, r.tagFn()) } : r.fit(r.days, r.tagFn());
    r.apply(final.cfg);
    finalProfile = { sst: prof.sst, ...(prof.sstFallback ? { sstFallback: prof.sstFallback } : {}), chlLog: prof.chlLog, foodDependence: prof.foodDependence, offshore: prof.offshore, inshore: prof.inshore, coastKm: prof.coastKm };
  }
  r.apply({});
  const out = {
    species: prof.short,
    builtAt: new Date().toISOString(),
    method: "v2 2026-10-18: cache đặc trưng · điểm liên tục · hai kênh tĩnh giữ-tháng-ra · AUC trong-nghề · nếp tháng có đệm · CI bootstrap khối 7 ngày + BH q=0,1",
    days: r.days.length,
    kg: Math.round(r.baseAll.kg),
    targetGears: labelState[prof.short].tg,
    staticChannels: !NO_STATIC,
    pad: PAD,
    base: { within: r.baseAll.within, eff: r.baseAll.eff, area: r.baseAll.area },
    folds: r.foldOut,
    forward: r.forwardOut,
    pooled: r.boot && { ...r.boot, pBH: bhRaw.adj[i] },
    dynamic: r.dyn && { ...r.dyn, pBH: bhDyn.adj[i], ctrlShift: CTRL },
    ...(r.local ? { local: r.local } : {}),
    acceptRule: ACCEPT,
    acceptedRaw: rawOk,
    acceptedDyn: dynOk,
    accepted,
    cfg: final.cfg,
    fitted: accepted ? { within: final.best.within, eff: final.best.eff, area: final.best.area } : null,
    profile: finalProfile,
    ...(LABEL_SHIFT ? { labelShift: LABEL_SHIFT } : {}),
    caveat: "Chỉ các tháng có lưới vệ tinh cache; tàu có VMS (chủ yếu ≥15 m); sản lượng chia theo giờ đánh suy từ tốc độ VMS — không phải toạ độ mẻ. Lưới lịch sử không có HYCOM/Copernicus. Số 'fitted' là TRONG-MẪU; số trung thực là chênh gộp trên các nếp giữ-ra (pooled).",
    secs: Math.round(r.secs),
  };
  writeFileSync(join(OUT, `fit-${prof.short}.json`), JSON.stringify(out, null, 1));
  summary.push({ species: prof.short, gain: r.boot?.gain, lo: r.boot?.lo, hi: r.boot?.hi, p: r.boot?.p, pBH: bhRaw.adj[i], dynGain: r.dyn?.gain, dynLo: r.dyn?.lo, dynHi: r.dyn?.hi, dynP: r.dyn?.p, dynPBH: bhDyn.adj[i], acceptedRaw: rawOk, acceptedDyn: dynOk, accepted, cfg: final.cfg, secs: Math.round(r.secs) });
});
writeFileSync(join(OUT, "fit-summary.json"), JSON.stringify({ builtAt: new Date().toISOString(), labelShift: LABEL_SHIFT, staticChannels: !NO_STATIC, summary }, null, 1));
const f4 = (x) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(4) : "—");
console.log(`\nNHẬN ${summary.filter((s) => s.accepted).length}/${summary.length} loài [luật ${ACCEPT}: CI90 dưới > 0 và BH q=0,1]  · chỉ chênh thô: ${summary.filter((s) => s.acceptedRaw).length}/${summary.length}` + (LABEL_SHIFT ? `  ← kiểm nhận-oan, nhãn lệch ${LABEL_SHIFT} ngày` : ""));
for (const s of summary) console.log(`  ${s.accepted ? "NHẬN" : "giữ "} ${s.species}: thô ${f4(s.gain)} [${f4(s.lo)}…${f4(s.hi)}] pBH=${s.pBH?.toFixed(3)} · động ${f4(s.dynGain)} [${f4(s.dynLo)}…${f4(s.dynHi)}] pBH=${s.dynPBH?.toFixed(3)}${s.accepted ? " " + JSON.stringify(s.cfg) : ""}`);
console.log(`tổng ${((Date.now() - T0) / 1000).toFixed(1)} s`);
