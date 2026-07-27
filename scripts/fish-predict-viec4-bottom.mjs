// scripts/fish-predict-viec4-bottom.mjs  (chạy: npx tsx scripts/fish-predict-viec4-bottom.mjs)
// ─────────────────────────────────────────────────────────────────────────
// VIỆC 4 — VALIDATE trên DỮ LIỆU THẬT: cổng nhiệt loài ĐÁY chấm bằng NHIỆT ĐÁY
// (HYCOM) thay vì nhiệt MẶT; cá ngừ mắt to chấm ở tầng ~250 m.
//
// Tái dùng parse HYCOM + lõi buildFishForecast từ src/. KHÔNG ghi vào src/.
// 5 kiểm chứng (task VIỆC 4):
//   1. NEO hải dương học: cube mùa đông (2026-01-15) VỊNH BẮC BỘ — T_đáy < T_mặt?
//   2. Cá đáy có BIẾN THIÊN không gian chưa: std(sp) TRƯỚC (mặt) vs SAU (đáy).
//   3. KHÔNG loài nào biến mất: đếm ô ≥25 (payload) & ≥50 (hiển thị) mỗi loài.
//   4. Cá ngừ mắt to: tFit TRƯỚC ≈1 khắp nơi; SAU (250m) BIẾN THIÊN.
//   5. Tổng thể KHÔNG phình: %ô "Mọi loài" s≥50 TRƯỚC/SAU.
// ─────────────────────────────────────────────────────────────────────────

import {
  parseHycomTempAscii,
  iso20Grid,
  bottomTempGrid,
  tempAtDepthGrid,
  thermoGridUrl,
  hycomHoursToISO,
  DEEP_TUNA_DEPTH_M,
} from "../src/lib/hycom.ts";
import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  trapezoid,
  nearestIndex,
  SPECIES_PROFILES,
} from "../src/lib/fish-predict.ts";
import { FISH_SEASONS, nearestRegionWithin } from "../src/data/fish-seasons.ts";

const UA = "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const DODS = "https://tds.hycom.org/thredds/dodsC/ESPC-D-V02/t3z";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const BATHY = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
const TIMEOUT = 60000;
const WINTER = process.argv[2] || "2026-01-15"; // truyền ngày khác: npx tsx … 2026-07-15
const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const pct = (arr, p) => { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN; };

async function getText(url, label) {
  for (let a = 0; a <= 2; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { "User-Agent": UA } });
      if (!r.ok) { if ([400, 404].includes(r.status)) return null; throw new Error(`HTTP ${r.status}`); }
      return await r.text();
    } catch (e) { if (a === 2) { console.warn(`  ! ${label}: ${String(e).slice(0, 90)}`); return null; } await new Promise((s) => setTimeout(s, 800 * (a + 1))); }
  }
}
async function getJson(url, label) { const t = await getText(url, label); if (!t) return null; try { return JSON.parse(t); } catch { console.warn(`  ! ${label}: non-JSON`); return null; } }

// ── HYCOM: tìm time index cho 1 ngày rồi kéo cube ───────────────────────────
async function hycomCubeForDate(dateISO) {
  const tt = await getText(`${DODS}.ascii?time`, "hycom time");
  if (!tt) return null;
  const hours = tt.split("\n").flatMap((l) => l.split(",")).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v) && v > 100000);
  if (!hours.length) return null;
  const targetMs = Date.parse(dateISO + "T12:00:00Z");
  let bi = 0, bd = Infinity;
  for (let i = 0; i < hours.length; i++) { const ms = Date.UTC(2000, 0, 1) + hours[i] * 3600e3; const d = Math.abs(ms - targetMs); if (d < bd) { bd = d; bi = i; } }
  const gotDate = hycomHoursToISO(hours[bi]);
  const txt = await getText(thermoGridUrl(bi), `hycom cube ${gotDate}`);
  if (!txt) return null;
  const cube = parseHycomTempAscii(txt);
  if (!cube.lats.length || !cube.depths.length) return null;
  return { cube, gotDate };
}

// lưới nhiệt tại tầng NÔNG NHẤT của cube (20 m) — xấp xỉ "gần mặt" tự nhất quán
function topLayerGrid(cube) {
  const values = cube.lats.map((_, la) => cube.lons.map((__, lo) => cube.temp[0][la][lo]));
  return { lats: cube.lats, lons: cube.lons, values, date: cube.date };
}

// ── ERDDAP theo ngày (mirror src) ───────────────────────────────────────────
const sstUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
const chlUrl = (d) => enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
const slaUrl = (d) => enc(`${ERDDAP}/noaacwBLENDEDsshDaily.json?sla[(${d}T12:00:00Z)][(5.0):2:(22.0)][(102.0):2:(118.0)]`);
const anomUrl = (d) => enc(`${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly[(${d}T12:00:00Z)][(22.0):5:(5.0)][(102.0):5:(118.0)]`);
const curUrl = (d, c) => enc(`${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${c}_current[(${d}T12:00:00Z)][(5.0):1:(22.0)][(102.0):1:(118.0)]`);

async function loadErddap(d) {
  const [sj, cj, slj, aj, uj, vj] = await Promise.all([
    getJson(sstUrl(d), `sst ${d}`), getJson(chlUrl(d), `chl ${d}`), getJson(slaUrl(d), `sla ${d}`),
    getJson(anomUrl(d), `anom ${d}`), getJson(curUrl(d, "u"), `u ${d}`), getJson(curUrl(d, "v"), `v ${d}`),
  ]);
  if (!sj?.table || !cj?.table) return null;
  const sst = parseErddapGrid(sj, { hasAltitude: false, kelvin: true });
  const chl = parseErddapGrid(cj, { hasAltitude: true });
  if (!sst.lats.length || !chl.lats.length) return null;
  const opt = (j) => { if (!j?.table) return null; const g = parseErddapGrid(j, { hasAltitude: false }); return g.lats.length ? g : null; };
  const sla = opt(slj), anom = opt(aj), u = opt(uj), v = opt(vj);
  const cur = u && v && u.lats.length === v.lats.length ? { u, v } : null;
  return { sst, chl, sla, anom, cur };
}

const std = (arr) => { const a = arr.filter(Number.isFinite); if (a.length < 2) return NaN; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, y) => s + (y - m) ** 2, 0) / a.length); };
const mean = (arr) => { const a = arr.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };

async function main() {
  console.log(`VIỆC 4 validate — kéo HYCOM cube + ERDDAP (mùa đông ${WINTER})\n`);

  // ── PART 1: NEO — cube mùa đông, Vịnh Bắc Bộ, T_mặt(20m) vs T_đáy ──────────
  const hy = await hycomCubeForDate(WINTER);
  if (!hy) { console.error("Không kéo được cube HYCOM. DỪNG."); process.exitCode = 1; return; }
  const { cube, gotDate } = hy;
  console.log(`── PART 1 · NEO HẢI DƯƠNG HỌC (cube HYCOM ${gotDate}) ──`);
  console.log(`   depths: ${cube.depths.join(", ")} m  |  lưới ${cube.lats.length}×${cube.lons.length}`);
  const surf = topLayerGrid(cube);
  const bott = bottomTempGrid(cube);
  const deep = tempAtDepthGrid(cube, DEEP_TUNA_DEPTH_M);
  const d20 = iso20Grid(cube);
  // ô Vịnh Bắc Bộ: lat 19–21.5, lon 106–108
  const vbbDiffs = [];
  console.log(`   Vịnh Bắc Bộ — vài ô (T_mặt20m → T_đáy, Δ):`);
  let printed = 0;
  for (let i = 0; i < cube.lats.length; i++) {
    for (let j = 0; j < cube.lons.length; j++) {
      const la = cube.lats[i], lo = cube.lons[j];
      if (la < 19 || la > 21.5 || lo < 106 || lo > 108) continue;
      const ts = surf.values[i][j], tb = bott.values[i][j];
      if (!Number.isFinite(ts) || !Number.isFinite(tb)) continue;
      const dlt = tb - ts;
      vbbDiffs.push(dlt);
      if (printed < 10) { console.log(`     ${la.toFixed(2)}N ${lo.toFixed(2)}E:  ${ts.toFixed(2)} → ${tb.toFixed(2)}  Δ=${dlt.toFixed(2)}`); printed++; }
    }
  }
  const mDiff = mean(vbbDiffs);
  console.log(`   VBB: ${vbbDiffs.length} ô | Δ(đáy−mặt20m) TB = ${mDiff.toFixed(2)} °C (thềm nông mùa đông → XÁO TRỘN đều, đáy≈mặt là ĐÚNG)`);
  // NEO đúng nghĩa: cột NƯỚC SÂU (có tầng tới ≥150 m) — phân tầng rõ → đáy lạnh sâu.
  // depth index 13 = 150 m; cột có finite tại đó là cột sâu.
  const iDeepLayer = cube.depths.findIndex((d) => d >= 150);
  const deepDiffs = [];
  for (let i = 0; i < cube.lats.length; i++) for (let j = 0; j < cube.lons.length; j++) {
    const ts = surf.values[i][j];
    if (!Number.isFinite(ts)) continue;
    if (iDeepLayer < 0 || !Number.isFinite(cube.temp[iDeepLayer][i][j])) continue; // chỉ cột sâu
    const tb = bott.values[i][j];
    if (Number.isFinite(tb)) deepDiffs.push(tb - ts);
  }
  const mDeep = mean(deepDiffs);
  console.log(`   Cột NƯỚC SÂU (tới ≥150 m, ${deepDiffs.length} ô toàn VN): Δ(đáy−mặt20m) TB = ${mDeep.toFixed(1)} °C`);
  console.log(`   → ${mDeep < -2 ? "PHÂN TẦNG rõ ở nước sâu: khối nước đáy LẠNH ✓ (cube/độ sâu ĐÚNG)" : "không rõ phân tầng ✗ (kiểm cube)"}`);
  // độ phủ nhiệt đáy toàn VN
  const bottFinite = bott.values.flat().filter(Number.isFinite).length;
  const deepFinite = deep.values.flat().filter(Number.isFinite).length;
  const d20Finite = d20.values.flat().filter(Number.isFinite).length;
  const totCells = cube.lats.length * cube.lons.length;
  console.log(`   Phủ toàn VN: bottom ${bottFinite}/${totCells}, deep250 ${deepFinite}/${totCells}, d20 ${d20Finite}/${totCells}`);
  const allBott = bott.values.flat().filter(Number.isFinite);
  const allDeep = deep.values.flat().filter(Number.isFinite);
  console.log(`   Nhiệt ĐÁY toàn VN: p10 ${pct(allBott, 0.1).toFixed(1)} / p50 ${pct(allBott, 0.5).toFixed(1)} / p90 ${pct(allBott, 0.9).toFixed(1)} °C (min ${Math.min(...allBott).toFixed(1)}, max ${Math.max(...allBott).toFixed(1)})`);
  console.log(`   Nhiệt 250 m toàn VN: p10 ${pct(allDeep, 0.1).toFixed(1)} / p50 ${pct(allDeep, 0.5).toFixed(1)} / p90 ${pct(allDeep, 0.9).toFixed(1)} °C (min ${Math.min(...allDeep).toFixed(1)}, max ${Math.max(...allDeep).toFixed(1)})\n`);

  // ── ERDDAP + ETOPO cùng ngày để chạy buildFishForecast ────────────────────
  const er = await loadErddap(WINTER);
  const bj = await getJson(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;
  if (!er) { console.error("Không kéo được ERDDAP SST/chl. Bỏ PART 2–5."); return; }
  const month = new Date(WINTER + "T00:00:00Z").getUTCMonth() + 1;
  console.log(`── ERDDAP ${WINTER}: SST ${er.sst.lats.length}×${er.sst.lons.length}, sla=${!!er.sla} anom=${!!er.anom} cur=${!!er.cur}, ETOPO=${!!depth}, tháng=${month} ──\n`);

  const common = { anom: er.anom, cur: er.cur, thermo: d20, depth };
  const before = buildFishForecast(er.sst, er.chl, er.sla, month, common); // KHÔNG bottom/deep → fallback mặt
  const after = buildFishForecast(er.sst, er.chl, er.sla, month, { ...common, bottomTemp: bott, deepTemp: deep });

  // ── PART 2: cá đáy có biến thiên không gian chưa (std) ─────────────────────
  console.log(`── PART 2 · BIẾN THIÊN KHÔNG GIAN loài đáy (std điểm ≥25, TRƯỚC→SAU) ──`);
  const spatialStd = (fc, short) => std(fc.cells.map((c) => c.sp[short]).filter((v) => v != null));
  for (const short of ["cá mối", "cá đổng", "tôm bạc", "ghẹ xanh"]) {
    const s0 = spatialStd(before, short), s1 = spatialStd(after, short);
    console.log(`   ${short.padEnd(9)}: std ${Number.isFinite(s0) ? s0.toFixed(1) : "—"} → ${Number.isFinite(s1) ? s1.toFixed(1) : "—"}  ${Number.isFinite(s1) && Number.isFinite(s0) ? (s1 > s0 + 0.5 ? "TĂNG ✓" : s1 < s0 - 0.5 ? "giảm" : "≈") : ""}`);
  }
  console.log();

  // ── PART 3: KHÔNG loài nào biến mất (ô ≥25 payload & ≥50 hiển thị) ─────────
  console.log(`── PART 3 · KHÔNG BIẾN MẤT (số ô ≥25 / ≥50, TRƯỚC→SAU) ──`);
  const bottomSpecies = SPECIES_PROFILES.filter((p) => p.tempSource === "bottom" || p.tempSource === "deep");
  const count = (fc, short, thr) => fc.cells.filter((c) => (c.sp[short] ?? 0) >= thr).length;
  let vanished = 0;
  for (const p of bottomSpecies) {
    const p0 = count(before, p.short, 25), p1 = count(after, p.short, 25);
    const h0 = count(before, p.short, 50), h1 = count(after, p.short, 50);
    // loài có trong vụ vùng nào ở tháng này?
    const inSeasonAnywhere = FISH_SEASONS.some((f) => f.species === p.species && f.months.includes(month));
    const flag = inSeasonAnywhere && p1 === 0 && p0 > 0 ? " ← BIẾN MẤT SAU ✗" : "";
    if (flag) vanished++;
    console.log(`   ${p.short.padEnd(10)} [${p.tempSource}] vụ${inSeasonAnywhere ? "✓" : "·"}: ≥25 ${p0}→${p1}  ≥50 ${h0}→${h1}${flag}`);
  }
  console.log(`   → ${vanished === 0 ? "KHÔNG loài nào trong vụ biến mất ✓" : `${vanished} loài BIẾN MẤT ✗ — cần nới dải nhiệt`}\n`);

  // ── PART 4: cá ngừ mắt to — BẰNG CHỨNG deep-gating bị loại (250 m đồng nhất) ─
  console.log(`── PART 4 · CÁ NGỪ MẮT TO — vì sao KHÔNG chấm bằng 250 m ──`);
  const bigeye = SPECIES_PROFILES.find((p) => p.species === "Cá ngừ mắt to");
  const sfc = bigeye.sst; // dải MẶT hiện dùng
  const frac1 = (arr) => (100 * arr.filter((x) => x >= 0.999).length / arr.length).toFixed(0);
  const frac0 = (arr) => (100 * arr.filter((x) => x <= 0.001).length / arr.length).toFixed(0);
  // tFit MẶT (đang dùng) trên ô-vùng — cho thấy cổng mặt VẪN biến thiên
  const tfSfc = [];
  for (let i = 0; i < er.sst.lats.length; i++) for (let j = 0; j < er.sst.lons.length; j++) {
    const t = er.sst.values[i][j]; if (!Number.isFinite(t)) continue;
    if (!nearestRegionWithin(er.sst.lats[i], er.sst.lons[j], 2.0)) continue;
    tfSfc.push(trapezoid(t, sfc[0], sfc[1], sfc[2], sfc[3]));
  }
  console.log(`   tFit MẶT (đang dùng ${JSON.stringify(sfc)}): TB ${mean(tfSfc).toFixed(2)}, %=1 ${frac1(tfSfc)}%, std ${std(tfSfc).toFixed(2)} (VẪN biến thiên)`);
  // TUNER: thử vài dải sâu ứng viên trên phân bố 250 m THẬT (chỉ ô nước sâu)
  const t250s = [];
  for (let i = 0; i < er.sst.lats.length; i++) for (let j = 0; j < er.sst.lons.length; j++) {
    const t = er.sst.values[i][j]; if (!Number.isFinite(t)) continue;
    const lat = er.sst.lats[i], lon = er.sst.lons[j];
    if (!nearestRegionWithin(lat, lon, 2.0)) continue;
    const di = nearestIndex(deep.lats, lat), dj = nearestIndex(deep.lons, lon);
    const v = deep.values[di]?.[dj]; if (Number.isFinite(v)) t250s.push(v);
  }
  console.log(`   [tuner] phân bố 250 m ô-vùng (n=${t250s.length}): p10 ${pct(t250s, 0.1).toFixed(1)} p50 ${pct(t250s, 0.5).toFixed(1)} p90 ${pct(t250s, 0.9).toFixed(1)}`);
  const cands = [[7, 10, 17, 21], [8, 12, 14, 18], [8, 11.5, 13.5, 17], [9, 12, 13.5, 16.5], [8, 12.5, 13.5, 16]];
  for (const r of cands) {
    const tf = t250s.map((v) => trapezoid(v, r[0], r[1], r[2], r[3]));
    console.log(`   [tuner] ${JSON.stringify(r).padEnd(22)} → TB ${mean(tf).toFixed(2)} %=1 ${frac1(tf)}% %=0 ${frac0(tf)}% std ${std(tf).toFixed(2)}`);
  }
  console.log(`   → 250 m ĐỒNG NHẤT (p10–p90 hẹp) → mọi dải sâu ≈1 (std≈0), KHÔNG hơn cổng mặt → GIỮ MẶT`);
  console.log();

  // ── PART 5: tổng thể KHÔNG phình ──────────────────────────────────────────
  const hotPct = (fc) => (100 * fc.cells.filter((c) => c.s >= 50).length / Math.max(1, fc.cells.length)).toFixed(1);
  const hotOfSea = (fc) => fc.cells.filter((c) => c.s >= 50).length;
  console.log(`── PART 5 · TỔNG THỂ "Mọi loài" ──`);
  console.log(`   ô payload: TRƯỚC ${before.cells.length}, SAU ${after.cells.length}`);
  console.log(`   ô s≥50 (điểm nóng): TRƯỚC ${hotOfSea(before)} (${hotPct(before)}% payload), SAU ${hotOfSea(after)} (${hotPct(after)}% payload)`);
  console.log(`   → ${Math.abs(Number(hotPct(after)) - Number(hotPct(before))) <= 3 ? "KHÔNG phình đáng kể ✓" : "THAY ĐỔI đáng kể — kiểm lại"}`);
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
