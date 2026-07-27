// scripts/fish-predict-wmax-calib.mjs  (chạy: npx tsx scripts/fish-predict-wmax-calib.mjs)
// ─────────────────────────────────────────────────────────────────────────
// CALIBRATE "wMax CỐ ĐỊNH + cổng độ sâu khi THIẾU lưới" trên LƯỚI THẬT.
//
// Khác scripts/fish-predict-viec3-calib.mjs (chép lại lõi chấm điểm để sweep
// hằng): script này gọi THẲNG `buildFishForecast` của src → đo ĐÚNG hành vi
// sản phẩm, không sợ lệch bản sao. Vì vậy phải chạy HAI LẦN:
//     npx tsx scripts/fish-predict-wmax-calib.mjs --out before.json   (code CŨ)
//     …sửa code…
//     npx tsx scripts/fish-predict-wmax-calib.mjs --out after.json --cmp before.json
// Lưới THẬT được CACHE ra đĩa (FISH_CALIB_CACHE hoặc %TMP%/sdfish-wmax-calib)
// nên hai lần chạy dùng CHÍNH XÁC cùng dữ liệu.
//
// Đo, cho mỗi ngày (3 ngày tháng 7 + 1 ngày tháng 1) × mỗi kịch bản nguồn:
//   - phân bố điểm "Mọi loài" (median/p90/p95/max) + %diện tích điểm nóng s≥50
//   - số ô ≥25 (payload) và ≥50 (hiển thị) của loài đại diện MỖI NHÓM
//   - KỊCH BẢN HỎNG NGUỒN (thermo=null / depth=null / anom=null): so TỪNG Ô ×
//     TỪNG LOÀI với bản đủ nguồn → đếm ô ĐIỂM TĂNG khi mất nguồn.
//     Đây là con số quyết định: mất nguồn mà điểm TĂNG là sai logic.
// ─────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  deepWaterFit,
  nearestIndex,
  SPECIES_PROFILES,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";
import { fetchHycomGrids } from "../src/lib/hycom.ts";

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const REGION_REACH_DEG = 2.0;
const KEEP_MIN = 25; // ngưỡng payload
const SHOW_MIN = 50; // sàn hiển thị client
const FETCH_TIMEOUT_MS = 60000;
const N_DAYS_JULY = 3;
const WINTER_DAY = "2026-01-15";
/** loài đại diện MỖI NHÓM — không loài nào được biến mất */
const WATCH = [
  "ngừ vây vàng", // pelagic-large (offshore)
  "ngừ mắt to", // pelagic-large (offshore, thermo NẶNG)
  "cá nục", // pelagic-small
  "cá mối", // demersal
  "ghẹ xanh", // crustacean
  "mực xà", // cephalopod (offshore)
  "cá hồng", // reef
];

const CACHE =
  process.env.FISH_CALIB_CACHE || path.join(os.tmpdir(), "sdfish-wmax-calib");
fs.mkdirSync(CACHE, { recursive: true });

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

async function fetchJsonCached(url, key) {
  const file = path.join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  let data = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON ${r.status}`);
      }
      if (!r.ok) {
        if (r.status === 400 || r.status === 404) { data = null; break; }
        throw new Error(j?.reason || r.status);
      }
      data = j;
      break;
    } catch (e) {
      if (attempt === 2) {
        console.warn(`  ! ${key}: ${String(e).slice(0, 90)}`);
        data = null;
      } else await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

// URL builders theo NGÀY (mirror src, chèn ngày thay (last))
const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T12:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

async function loadDay(d) {
  const [sj, cj, slj, aj, uj, vj] = await Promise.all([
    fetchJsonCached(sstUrl(d), `sst-${d}`),
    fetchJsonCached(chlUrl(d), `chl-${d}`),
    fetchJsonCached(slaUrl(d), `sla-${d}`),
    fetchJsonCached(anomUrl(d), `anom-${d}`),
    fetchJsonCached(curUrl(d, "u"), `u-${d}`),
    fetchJsonCached(curUrl(d, "v"), `v-${d}`),
  ]);
  if (!sj?.table || !cj?.table) return null;
  const sst = parseErddapGrid(sj, { hasAltitude: false, kelvin: true });
  const chl = parseErddapGrid(cj, { hasAltitude: true });
  if (!sst.lats.length || !chl.lats.length) return null;
  const opt = (j) => {
    if (!j?.table) return null;
    const g = parseErddapGrid(j, { hasAltitude: false });
    return g.lats.length ? g : null;
  };
  const sla = opt(slj), anom = opt(aj), u = opt(uj), v = opt(vj);
  const cur = u && v && u.lats.length === v.lats.length ? { u, v } : null;
  return { sst, chl, sla, anom, cur };
}

/** HYCOM (D20 + nhiệt đáy + 250 m) — nowcast MỚI NHẤT, cache ra đĩa.
 *  Ghi chú trung thực: HYCOM ở đây KHÔNG theo từng ngày lịch sử (API nowcast),
 *  dùng chung 1 cube cho mọi ngày — đủ cho việc so TRƯỚC/SAU (cùng dữ liệu). */
async function loadHycom() {
  const file = path.join(CACHE, "hycom.json");
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  const g = await fetchHycomGrids();
  fs.writeFileSync(file, JSON.stringify(g ?? null));
  return g;
}

/** Tổng số ô BIỂN được chấm (mẫu số %điểm nóng) — mirror vòng lặp buildFishForecast */
function totalSeaCells(sst, month) {
  let n = 0;
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      const inSeason = FISH_SEASONS.some(
        (f) => f.months.includes(month) && f.regions.includes(region.id),
      );
      if (inSeason) n++;
    }
  return n;
}

/**
 * CĂN CỨ chọn DEPTH_UNKNOWN_FIT: khi KHÔNG biết độ sâu ô, giá trị "không thiên
 * vị" của cổng độ sâu chính là KỲ VỌNG của `deepWaterFit` trên đúng tập ô mà
 * loài xa bờ được chấm (đo bằng ETOPO THẬT). In mean/median cho từng dải
 * `offshore` đang dùng + gộp chung.
 */
function depthPrior(sst, depth, month) {
  const bands = new Map();
  for (const p of SPECIES_PROFILES)
    if (p.offshore) {
      const k = `${p.offshore[0]}–${p.offshore[1]}m`;
      if (!bands.has(k)) bands.set(k, { band: p.offshore, sp: [], vals: [] });
      bands.get(k).sp.push(p.short);
    }
  const cells = [];
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      if (!FISH_SEASONS.some((f) => f.months.includes(month) && f.regions.includes(region.id)))
        continue;
      const di = nearestIndex(depth.lats, sst.lats[i]);
      const dj = nearestIndex(depth.lons, sst.lons[j]);
      const dv = depth.values[di]?.[dj];
      cells.push(Number.isFinite(dv) ? dv : NaN);
    }
  const nan = cells.filter((v) => !Number.isFinite(v)).length;
  console.log(`\n── CĂN CỨ DEPTH_UNKNOWN_FIT: kỳ vọng deepWaterFit trên ${cells.length} ô biển (tháng ${month}); ô ETOPO NaN = ${nan}`);
  const all = [];
  for (const [k, b] of bands) {
    const vals = cells.filter(Number.isFinite).map((d) => deepWaterFit(d, b.band[0], b.band[1]));
    vals.sort((x, y) => x - y);
    const mean = vals.reduce((a, x) => a + x, 0) / vals.length;
    all.push(mean);
    console.log(`   ${pad(k, 10)} mean=${mean.toFixed(3)} median=${vals[vals.length >> 1].toFixed(3)} %ô đạt ≥0.5: ${(100 * vals.filter((v) => v >= 0.5).length / vals.length).toFixed(0)}%  (${b.sp.join(", ")})`);
  }
  console.log(`   → trung bình các dải = ${(all.reduce((a, x) => a + x, 0) / all.length).toFixed(3)}`);
}

function metrics(fc, total) {
  // s của ô KHÔNG trong payload < KEEP_MIN → coi 0 (chỉ ảnh hưởng median thấp,
  // p90/p95/max và %điểm nóng vẫn CHÍNH XÁC vì các ô đó luôn nằm trong payload)
  const sList = fc.cells.map((c) => c.s);
  while (sList.length < total) sList.push(0);
  sList.sort((a, b) => a - b);
  const q = (p) => sList[Math.min(sList.length - 1, Math.floor(p * sList.length))];
  const hot = fc.cells.filter((c) => c.s >= SHOW_MIN).length;
  const sp = {};
  for (const w of WATCH) sp[w] = { pay: 0, hot: 0 };
  for (const c of fc.cells)
    for (const [k, v] of Object.entries(c.sp)) {
      if (!sp[k]) continue;
      if (v >= KEEP_MIN) sp[k].pay++;
      if (v >= SHOW_MIN) sp[k].hot++;
    }
  return {
    total,
    kept: fc.cells.length,
    median: q(0.5),
    p90: q(0.9),
    p95: q(0.95),
    max: sList[sList.length - 1],
    hotPct: (100 * hot) / total,
    sp,
  };
}

/**
 * SWEEP DEPTH_UNKNOWN_FIT: chạy trên bản `noDepth` (không có cổng độ sâu = ×1)
 * → nhân k rồi đếm ô còn ≥25 (payload) / ≥50 (hiển thị) cho loài XA BỜ. Hợp lệ
 * vì khi thiếu lưới độ sâu, mọi yếu tố khác KHÔNG đổi, chỉ nhân thêm k.
 */
function sweepDepthUnknown(fcNoDepth, fcFull) {
  const offs = SPECIES_PROFILES.filter((p) => p.offshore).map((p) => p.short);
  const full = {}, none = {};
  for (const s of offs) { full[s] = { pay: 0, hot: 0 }; none[s] = []; }
  for (const c of fcFull.cells)
    for (const s of offs) {
      const v = c.sp[s] ?? 0;
      if (v >= KEEP_MIN) full[s].pay++;
      if (v >= SHOW_MIN) full[s].hot++;
    }
  for (const c of fcNoDepth.cells)
    for (const s of offs) if ((c.sp[s] ?? 0) > 0) none[s].push(c.sp[s]);
  console.log(`\n── SWEEP DEPTH_UNKNOWN_FIT (kịch bản MẤT HẲN ETOPO) — số ô ≥25/≥50 mỗi loài xa bờ`);
  console.log("   " + pad("k", 6) + offs.map((s) => pad(s, 15)).join(""));
  console.log("   " + pad("đủ ETOPO", 6) + offs.map((s) => pad(`${full[s].pay}/${full[s].hot}`, 15)).join(""));
  for (const k of [0.4, 0.5, 0.6, 0.7, 1.0]) {
    const row = offs.map((s) => {
      const v = none[s].map((x) => Math.round(x * k));
      return pad(`${v.filter((x) => x >= KEEP_MIN).length}/${v.filter((x) => x >= SHOW_MIN).length}`, 15);
    });
    console.log("   " + pad(k, 6) + row.join(""));
  }
}

/** so TỪNG Ô × TỪNG LOÀI giữa bản ĐỦ NGUỒN và bản MẤT NGUỒN */
function diffVsFull(full, broken) {
  const idx = new Map();
  for (const c of full.cells) idx.set(`${c.lat},${c.lon}`, c.sp);
  let up = 0, down = 0, same = 0, maxUp = 0, sumDelta = 0, n = 0;
  let maxUpWhat = "";
  const upBySpecies = {};
  for (const c of broken.cells) {
    const ref = idx.get(`${c.lat},${c.lon}`) ?? {};
    const keys = new Set([...Object.keys(c.sp), ...Object.keys(ref)]);
    for (const k of keys) {
      const a = ref[k] ?? 0;
      const b = c.sp[k] ?? 0;
      const d = b - a;
      n++; sumDelta += d;
      if (d > 0) {
        up++;
        upBySpecies[k] = (upBySpecies[k] ?? 0) + 1;
        if (d > maxUp) { maxUp = d; maxUpWhat = `${k} @${c.lat},${c.lon} ${a}→${b}`; }
      } else if (d < 0) down++;
      else same++;
    }
  }
  // ô/loài CHỈ có ở bản đủ nguồn (mất nguồn → rơi khỏi payload) = giảm
  for (const c of full.cells) {
    if (broken.cells.some((x) => x.lat === c.lat && x.lon === c.lon)) continue;
    for (const k of Object.keys(c.sp)) { n++; down++; sumDelta -= c.sp[k]; }
  }
  const topUp = Object.entries(upBySpecies).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return { up, down, same, n, maxUp, maxUpWhat, meanDelta: n ? sumDelta / n : 0, topUp };
}

async function main() {
  const outArg = argVal("--out");
  const cmpArg = argVal("--cmp");
  console.log(`cache: ${CACHE}`);
  const probe = await fetchJsonCached(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const END = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ??
    iso(new Date(Date.now() - 2 * 86400000));
  const days = [];
  for (let k = N_DAYS_JULY - 1; k >= 0; k--) days.push(addDays(END, -k));
  days.push(WINTER_DAY);
  console.log(`Ngày: ${days.join(", ")}`);

  const bj = await fetchJsonCached(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;
  console.log(`ETOPO: ${depth ? depth.lats.length + "×" + depth.lons.length : "KHÔNG có"}`);
  const hy = await loadHycom();
  console.log(`HYCOM: ${hy ? `d20=${!!hy.d20} bottom=${!!hy.bottom} deep=${!!hy.deep250}` : "KHÔNG có"}`);

  const report = { days: {}, generatedAt: new Date().toISOString() };
  let priorDone = false;
  for (const d of days) {
    const g = await loadDay(d);
    if (!g) { console.warn(`bỏ ngày ${d}`); continue; }
    const month = Number(d.slice(5, 7));
    if (!priorDone && depth) { depthPrior(g.sst, depth, month); priorDone = true; }
    const total = totalSeaCells(g.sst, month);
    const base = {
      anom: g.anom, cur: g.cur, depth,
      thermo: hy?.d20 ?? null, bottomTemp: hy?.bottom ?? null, deepTemp: hy?.deep250 ?? null,
    };
    const run = (over) =>
      buildFishForecast(g.sst, g.chl, g.sla, month, { ...base, ...over });
    const scen = {
      full: run({}),
      noThermo: run({ thermo: null }),
      noDepth: run({ depth: null }),
      noAnom: run({ anom: null }),
    };
    const m = {};
    for (const [k, fc] of Object.entries(scen)) m[k] = metrics(fc, total);
    if (process.argv.includes("--sweep")) sweepDepthUnknown(scen.noDepth, scen.full);
    const diffs = {
      noThermo: diffVsFull(scen.full, scen.noThermo),
      noDepth: diffVsFull(scen.full, scen.noDepth),
      noAnom: diffVsFull(scen.full, scen.noAnom),
    };
    report.days[d] = { month, total, metrics: m, diffs,
      fields: { sla: !!g.sla, anom: !!g.anom, cur: !!g.cur } };
    printDay(d, report.days[d]);
  }

  if (outArg) {
    fs.writeFileSync(outArg, JSON.stringify(report, null, 1));
    console.log(`\n→ ghi ${outArg}`);
  }
  if (cmpArg && fs.existsSync(cmpArg)) {
    const before = JSON.parse(fs.readFileSync(cmpArg, "utf8"));
    printCompare(before, report);
  }
}

function printDay(d, r) {
  console.log(`\n══ ${d} (tháng ${r.month}) — ${r.total} ô biển, nguồn: sla=${r.fields.sla} anom=${r.fields.anom} cur=${r.fields.cur}`);
  console.log(pad("kịch bản", 10) + pad("med", 5) + pad("p90", 5) + pad("p95", 5) + pad("max", 5) + pad("hot%", 7) + pad("ôPayload", 10) + WATCH.map((w) => pad(w, 13)).join(""));
  for (const [k, m] of Object.entries(r.metrics))
    console.log(pad(k, 10) + pad(m.median, 5) + pad(m.p90, 5) + pad(m.p95, 5) + pad(m.max, 5) +
      pad(m.hotPct.toFixed(1), 7) + pad(m.kept, 10) +
      WATCH.map((w) => pad(`${m.sp[w].pay}/${m.sp[w].hot}`, 13)).join(""));
  console.log("  (mỗi loài: số ô ≥25 / số ô ≥50)");
  console.log("  MẤT NGUỒN → điểm đổi thế nào (ô×loài):");
  for (const [k, x] of Object.entries(r.diffs))
    console.log(`   ${pad(k, 9)} TĂNG=${pad(x.up, 7)} giảm=${pad(x.down, 7)} bằng=${pad(x.same, 7)} Δtb=${x.meanDelta.toFixed(2)} maxTăng=${x.maxUp}${x.maxUp ? " [" + x.maxUpWhat + "]" : ""}${x.topUp.length ? " loài tăng nhiều nhất: " + x.topUp.map(([a, b]) => a + "×" + b).join(", ") : ""}`);
}

function printCompare(before, after) {
  console.log(`\n╔══ TRƯỚC → SAU ══════════════════════════════════════════`);
  for (const d of Object.keys(after.days)) {
    const B = before.days[d], A = after.days[d];
    if (!B) continue;
    console.log(`\n── ${d} (tháng ${A.month})`);
    for (const k of Object.keys(A.metrics)) {
      const b = B.metrics[k], a = A.metrics[k];
      console.log(`  ${pad(k, 9)} med ${b.median}→${a.median}  p90 ${b.p90}→${a.p90}  p95 ${b.p95}→${a.p95}  max ${b.max}→${a.max}  hot% ${b.hotPct.toFixed(1)}→${a.hotPct.toFixed(1)}  payload ${b.kept}→${a.kept}`);
      console.log(`            ` + WATCH.map((w) => `${w} ${b.sp[w].pay}/${b.sp[w].hot}→${a.sp[w].pay}/${a.sp[w].hot}`).join(" · "));
    }
    for (const k of Object.keys(A.diffs))
      console.log(`  MẤT ${pad(k, 9)} ô/loài ĐIỂM TĂNG: ${B.diffs[k].up} → ${A.diffs[k].up}   (maxTăng ${B.diffs[k].maxUp} → ${A.diffs[k].maxUp}, Δtb ${B.diffs[k].meanDelta.toFixed(2)} → ${A.diffs[k].meanDelta.toFixed(2)})`);
  }
}

const pad = (s, n) => String(s).padEnd(n);
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
