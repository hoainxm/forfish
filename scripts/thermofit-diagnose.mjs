// scripts/thermofit-diagnose.mjs  (chạy: npx tsx scripts/thermofit-diagnose.mjs)
// ─────────────────────────────────────────────────────────────────────────
// CHẨN ĐOÁN "vì sao gần NỬA vùng biển là điểm nóng" — đo trên LƯỚI THẬT,
// KHÔNG sửa gì. Trả lời đúng một câu hỏi: yếu tố nào ĐANG BẬT KHẮP NƠI (mọi
// ô đều cao ⇒ không xếp hạng được ô nào hơn ô nào, chỉ nâng điểm đồng loạt)?
//
// In ra:
//   1) Phân bố D20 (độ sâu đẳng nhiệt 20°C, HYCOM) trên các ô biển VN:
//      min/p10/p25/p50/p75/p90/max + %ô NaN.
//   2) Phân bố `thermoFit(D20)`: %ô ≥0.95, ≥0.8, ≤0.2 + ĐỘ LỆCH CHUẨN KHÔNG
//      GIAN (giữa các ô). std ≈ 0 và phần lớn ô ≈1 ⇒ yếu tố CHẾT như tín hiệu.
//   3) Cùng thống kê đó cho MỌI term soft-OR (front nhiệt, front mồi, rìa xoáy,
//      nước trồi, hội tụ dòng, tầng nhiệt) → so trực tiếp, chỉ đích danh.
//   4) ABLATION trên `buildFishForecast` THẬT: bỏ từng nguồn (thermo/anom/sla/
//      cur/depth) rồi đo lại %diện tích điểm nóng (s≥50). Δhot% lớn nhất =
//      yếu tố đang gánh phần lớn "độ đỏ" của bản đồ.
//
// Dùng chung cache lưới với scripts/fish-predict-wmax-calib.mjs
// (FISH_CALIB_CACHE hoặc %TMP%/sdfish-wmax-calib) để hai script cùng dữ liệu.
// ─────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  nearestIndex,
  gradientStrength,
  logChlGrid,
  convergenceStrength,
  frontStrength,
  spatialAnomaly,
  thermoFit,
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
const SHOW_MIN = 50;
const FETCH_TIMEOUT_MS = 60000;
// hằng phải KHỚP src/lib/fish-predict.ts (chỉ để tái hiện term, không sửa)
const SPATIAL_RADIUS_DEG = 2.5;
const UPW_SCALE = 0.55;
const COLD_SCALE = 0.09;

const CACHE =
  process.env.FISH_CALIB_CACHE || path.join(os.tmpdir(), "sdfish-wmax-calib");
fs.mkdirSync(CACHE, { recursive: true });

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
const iso = (dt) => dt.toISOString().slice(0, 10);
const pad = (s, n) => String(s).padEnd(n);

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

/** Danh sách ô BIỂN được chấm (mirror vòng lặp buildFishForecast) */
function seaCells(sst, month) {
  const out = [];
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      if (!Number.isFinite(sst.values[i][j])) continue;
      const region = nearestRegionWithin(sst.lats[i], sst.lons[j], REGION_REACH_DEG);
      if (!region) continue;
      const inSeason = FISH_SEASONS.some(
        (f) => f.months.includes(month) && f.regions.includes(region.id),
      );
      if (inSeason) out.push({ i, j, lat: sst.lats[i], lon: sst.lons[j] });
    }
  return out;
}

function stats(vals) {
  const v = vals.filter(Number.isFinite).slice().sort((a, b) => a - b);
  const n = v.length;
  if (!n) return null;
  const q = (p) => v[Math.min(n - 1, Math.floor(p * n))];
  const mean = v.reduce((a, x) => a + x, 0) / n;
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
  return { n, min: v[0], p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), max: v[n - 1], mean, sd };
}

const f2 = (x) => (x == null ? "—" : x.toFixed(2));
const f3 = (x) => (x == null ? "—" : x.toFixed(3));

function printTermRow(name, vals) {
  const s = stats(vals);
  if (!s) { console.log(`   ${pad(name, 14)} (không có dữ liệu)`); return; }
  const pct = (f) => ((100 * vals.filter((x) => Number.isFinite(x) && f(x)).length) / s.n).toFixed(0) + "%";
  console.log(
    `   ${pad(name, 14)} n=${pad(s.n, 6)} tb=${f3(s.mean)} STD_KG=${f3(s.sd)}  ` +
    `p10=${f2(s.p10)} p50=${f2(s.p50)} p90=${f2(s.p90)}  ` +
    `≥0.95:${pad(pct((x) => x >= 0.95), 5)} ≥0.8:${pad(pct((x) => x >= 0.8), 5)} ≤0.2:${pct((x) => x <= 0.2)}`,
  );
}

async function main() {
  const probe = await fetchJsonCached(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe",
  );
  const day = probe?.table?.rows?.[0]?.[0]?.slice(0, 10) ??
    iso(new Date(Date.now() - 2 * 86400000));
  console.log(`cache: ${CACHE}\nngày: ${day}`);

  const g = await loadDay(day);
  if (!g) { console.error("không tải được lưới ngày " + day); process.exitCode = 1; return; }
  const month = Number(day.slice(5, 7));
  const bj = await fetchJsonCached(BATHY, "bathy");
  const depth = bj ? parseBathyGrid(bj) : null;
  const hy = await loadHycom();
  console.log(`ETOPO: ${depth ? "có" : "KHÔNG"} · HYCOM: ${hy ? `d20=${!!hy.d20} bottom=${!!hy.bottom} deep=${!!hy.deep250}` : "KHÔNG"}`);
  if (!hy?.d20) { console.error("KHÔNG có lưới D20 → không chẩn được tầng nhiệt"); process.exitCode = 1; return; }

  const cells = seaCells(g.sst, month);
  console.log(`\n══ ${cells.length} ô biển VN (tháng ${month})`);

  /* ── 1+2) D20 và thermoFit ───────────────────────────────────────────── */
  const d20 = [], tf = [];
  let d20Nan = 0;
  for (const c of cells) {
    const ti = nearestIndex(hy.d20.lats, c.lat);
    const tj = nearestIndex(hy.d20.lons, c.lon);
    const v = hy.d20.values[ti]?.[tj];
    if (Number.isFinite(v)) { d20.push(v); tf.push(thermoFit(v)); }
    else d20Nan++;
  }
  const sd20 = stats(d20);
  console.log(`\n── 1) PHÂN BỐ D20 (m) — ô NaN: ${d20Nan}/${cells.length} (${((100 * d20Nan) / cells.length).toFixed(1)}%)`);
  console.log(`   min=${f2(sd20.min)} p10=${f2(sd20.p10)} p25=${f2(sd20.p25)} p50=${f2(sd20.p50)} p75=${f2(sd20.p75)} p90=${f2(sd20.p90)} max=${f2(sd20.max)}  tb=${f2(sd20.mean)} std=${f2(sd20.sd)}`);
  console.log(`   dải thermoFit hiện tại = trapezoid(40, 70, 170, 230) → %ô D20 trong [70,170] = ${((100 * d20.filter((v) => v >= 70 && v <= 170).length) / d20.length).toFixed(1)}%`);
  console.log(`\n── 2) PHÂN BỐ thermoFit`);
  printTermRow("thermoFit", tf);

  /* ── 3) mọi term soft-OR ─────────────────────────────────────────────── */
  console.log(`\n── 3) MỌI TERM SOFT-OR (x∈[0,1]) — STD_KG = độ lệch chuẩn KHÔNG GIAN giữa các ô`);
  const thermFront = frontStrength(g.sst);
  const chlFrontG = gradientStrength(logChlGrid(g.chl), 0.25);
  const eddyEdge = g.sla ? gradientStrength(g.sla.values, 0.08) : null;
  const slaSpatial = g.sla ? spatialAnomaly(g.sla.values, g.sla.lats, g.sla.lons, SPATIAL_RADIUS_DEG) : null;
  const anomSpatial = g.anom ? spatialAnomaly(g.anom.values, g.anom.lats, g.anom.lons, SPATIAL_RADIUS_DEG) : null;
  const convGrid = g.cur ? convergenceStrength(g.cur.u.values, g.cur.v.values, 0.1) : null;

  const T = { thermFront: [], chlFront: [], eddy: [], coldStr: [], upw: [], conv: [] };
  for (const c of cells) {
    T.thermFront.push(thermFront[c.i][c.j]);
    const ci = nearestIndex(g.chl.lats, c.lat), cj = nearestIndex(g.chl.lons, c.lon);
    T.chlFront.push(chlFrontG[ci]?.[cj] ?? 0);
    if (g.sla && eddyEdge) {
      const si = nearestIndex(g.sla.lats, c.lat), sj = nearestIndex(g.sla.lons, c.lon);
      T.eddy.push(eddyEdge[si]?.[sj] ?? 0);
      const sv = slaSpatial?.[si]?.[sj];
      T.coldStr.push(Number.isFinite(sv) ? Math.min(1, Math.max(0, -sv / COLD_SCALE)) : 0);
    }
    if (g.anom) {
      const ai = nearestIndex(g.anom.lats, c.lat), aj = nearestIndex(g.anom.lons, c.lon);
      const a = anomSpatial?.[ai]?.[aj];
      if (Number.isFinite(a)) T.upw.push(Math.min(1, Math.max(0, -a / UPW_SCALE)));
    }
    if (g.cur && convGrid) {
      const ui = nearestIndex(g.cur.u.lats, c.lat), uj = nearestIndex(g.cur.u.lons, c.lon);
      const cv = convGrid[ui]?.[uj];
      if (cv != null && Number.isFinite(g.cur.u.values[ui]?.[uj])) T.conv.push(cv);
    }
  }
  for (const [k, v] of Object.entries(T)) printTermRow(k, v);
  printTermRow("thermoFit", tf);

  /* ── 4) ABLATION trên buildFishForecast THẬT ─────────────────────────── */
  const base = {
    anom: g.anom, cur: g.cur, depth,
    thermo: hy?.d20 ?? null, bottomTemp: hy?.bottom ?? null, deepTemp: hy?.deep250 ?? null,
  };
  const run = (over) => buildFishForecast(g.sst, g.chl, g.sla, month, { ...base, ...over });
  const total = cells.length;
  const hotPct = (fc) => (100 * fc.cells.filter((c) => c.s >= SHOW_MIN).length) / total;
  const full = run({});
  console.log(`\n── 4) ABLATION — %diện tích điểm nóng (s≥50) trên ${total} ô`);
  console.log(`   ${pad("đủ nguồn", 16)} hot% = ${hotPct(full).toFixed(1)}`);
  const scen = {
    "bỏ thermo(D20)": run({ thermo: null }),
    "bỏ anom(trồi)": run({ anom: null }),
    "bỏ cur(hội tụ)": run({ cur: null }),
    "bỏ depth(ETOPO)": run({ depth: null }),
  };
  for (const [k, fc] of Object.entries(scen))
    console.log(`   ${pad(k, 16)} hot% = ${pad(hotPct(fc).toFixed(1), 6)} Δ=${(hotPct(fc) - hotPct(full)).toFixed(1)}`);
  const noSla = buildFishForecast(g.sst, g.chl, null, month, base);
  console.log(`   ${pad("bỏ sla(xoáy)", 16)} hot% = ${pad(hotPct(noSla).toFixed(1), 6)} Δ=${(hotPct(noSla) - hotPct(full)).toFixed(1)}`);

  /* ── 5) ỨNG VIÊN THAY THẾ: DỊ THƯỜNG KHÔNG GIAN của D20 ──────────────── */
  // Cùng cách đã sửa upwTerm (Việc 2) / coldStrength: so D20 với TRUNG VỊ vùng
  // lân cận thay vì mức tuyệt đối. In phân bố để CHỌN SCALE bằng số (p90), và
  // %ô mỗi phía (nêm NÔNG hơn / SÂU hơn lân cận) — hai phía là hai khẩu vị loài.
  const dAnom = spatialAnomaly(hy.d20.values, hy.d20.lats, hy.d20.lons, SPATIAL_RADIUS_DEG);
  const dd = [];
  for (const c of cells) {
    const ti = nearestIndex(hy.d20.lats, c.lat);
    const tj = nearestIndex(hy.d20.lons, c.lon);
    const v = dAnom[ti]?.[tj];
    if (Number.isFinite(v)) dd.push(v);
  }
  const sdd = stats(dd);
  const sabs = stats(dd.map(Math.abs));
  console.log(`\n── 5) DỊ THƯỜNG KHÔNG GIAN của D20 (m, bán kính ${SPATIAL_RADIUS_DEG}°) — n=${sdd.n}`);
  console.log(`   min=${f2(sdd.min)} p10=${f2(sdd.p10)} p25=${f2(sdd.p25)} p50=${f2(sdd.p50)} p75=${f2(sdd.p75)} p90=${f2(sdd.p90)} max=${f2(sdd.max)}  std=${f2(sdd.sd)}`);
  console.log(`   |dị thường|: p50=${f2(sabs.p50)} p75=${f2(sabs.p75)} p90=${f2(sabs.p90)} → SCALE ứng viên ≈ p90`);
  const neg = dd.filter((v) => v < 0), pos = dd.filter((v) => v > 0);
  console.log(`   nêm NÔNG hơn lân cận (âm): ${((100 * neg.length) / dd.length).toFixed(0)}% · SÂU hơn (dương): ${((100 * pos.length) / dd.length).toFixed(0)}%`);
  // HAI PHÍA KHÔNG ĐỐI XỨNG (nêm nhô là cấu trúc nhọn/sâu hơn nêm chìm) → mỗi
  // phía phải lấy mốc theo PHÂN BỐ CỦA CHÍNH NÓ, không lấy gương của phía kia:
  // dải mỗi phía = [p50, p90] của |dị thường| trên phía đó.
  const sNeg = stats(neg.map(Math.abs)), sPos = stats(pos);
  console.log(`   phía NÔNG |dị thường|: p50=${f2(sNeg.p50)} p75=${f2(sNeg.p75)} p90=${f2(sNeg.p90)} → dải [${-Math.round(sNeg.p50)}, ${-Math.round(sNeg.p90)}]`);
  console.log(`   phía SÂU  dị thường:   p50=${f2(sPos.p50)} p75=${f2(sPos.p75)} p90=${f2(sPos.p90)} → dải [${Math.round(sPos.p50)}, ${Math.round(sPos.p90)}]`);
  for (const S of [6, 8, 10, 12]) {
    const shallow = dd.map((v) => Math.min(1, Math.max(0, -v / S)));
    const deep = dd.map((v) => Math.min(1, Math.max(0, v / S)));
    const st = (a) => { const s = stats(a); return `tb=${f2(s.mean)} std=${f2(s.sd)} ≥0.8:${((100 * a.filter((x) => x >= 0.8).length) / a.length).toFixed(0)}%`; };
    console.log(`   SCALE=${pad(S, 3)} ưa NÔNG: ${pad(st(shallow), 32)} ưa SÂU: ${st(deep)}`);
  }

  /* ── phụ: loài nào đang gánh điểm nóng lớp "Mọi loài" ────────────────── */
  const locatable = new Set(SPECIES_PROFILES.filter((p) => p.surfaceSignal !== "low").map((p) => p.short));
  const owner = {};
  for (const c of full.cells) {
    if (c.s < SHOW_MIN) continue;
    const top = c.top.find((s) => locatable.has(s));
    if (top) owner[top] = (owner[top] ?? 0) + 1;
  }
  console.log(`\n── PHỤ: loài đứng đầu ở các ô nóng (lớp "Mọi loài")`);
  for (const [k, v] of Object.entries(owner).sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`   ${pad(k, 16)} ${v} ô`);
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
