// scripts/fish-3day-probe.mjs   (chạy: npx tsx scripts/fish-3day-probe.mjs)
// ─────────────────────────────────────────────────────────────────────────────
// BƯỚC 1 — ĐO TRƯỚC KHI DỰNG: bản đồ cá D+1..D+3 có ĐỔI THẬT không?
//
// Dựng SST cho D+1..D+3 bằng NEO VỆ TINH + XU HƯỚNG COPERNICUS:
//     sst_pred(D+k) = sst_sat(D) + α_k · [ cop_thetao(D+k) − cop_thetao(D) ]
// α_k = `alphaOpt` (cross-validated) trong src/data/copernicus-tendency-skill.json.
// MỌI trường khác (phù du, SSHA, dị thường, dòng, tầng nhiệt, độ sâu) GIỮ NGUYÊN
// bản hôm nay — đo cho thấy phù du KHÔNG có kỹ năng xu hướng ⇒ persistence.
// FRONT nhiệt cũng giữ ảnh vệ tinh gốc (`frontSst`) — neo làm XẤU front.
//
// ĐẦU RA (số quyết định hình dạng sản phẩm):
//   · %điểm nóng (s≥50) từng ngày
//   · Jaccard tập ô ≥50 giữa D+0 và D+k
//   · số/% ô ĐỔI TRẠNG THÁI điểm nóng (qua/dưới 50)
//   · trung bình |Δs| và p95 |Δs|
//   · riêng từng NHÓM LOÀI (nổi lớn / nổi nhỏ / đáy / mực / giáp xác)
//
// NGƯỠNG QUYẾT ĐỊNH (đặt TRƯỚC khi chạy, ghi rõ ở đây):
//   ĐỔI ĐÁNG KỂ ⇔ tại D+3:  Jaccard(ô ≥50) < 0,90  HOẶC  ≥5 % ô đổi trạng thái.
//   → ĐỔI ĐÁNG KỂ: dựng đủ 4 bản (D+0..D+3).
//   → GẦN NHƯ Y HỆT: KHÔNG dựng thanh trượt giả; nói thật "chỗ cá ít đổi".
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildFishForecast,
  parseErddapGrid,
  parseBathyGrid,
  sstGridUrl,
  sstBackupGridUrl,
  chlGridUrl,
  chlBackupGridUrl,
  slaGridUrl,
  anomGridUrl,
  currentGridUrl,
  bathyGridUrl,
  ERDDAP_UA,
  SPECIES_META,
  CATEGORY_LABEL,
} from "../src/lib/fish-predict.ts";
import { fetchHycomGrids } from "../src/lib/hycom.ts";
import {
  decodeFloat32Chunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
  nearestIndex as zNearestIndex,
  axisRange,
  isFill,
  lonToAxis,
  lonToEast,
} from "../src/lib/copernicus.ts";
import {
  anchoredSstGrid,
  sstTendencyAlpha,
  sstLeadSkill,
  MAX_FISH_LEAD,
} from "../src/lib/sst-tendency.ts";

// KIỂM MÙA: `--date=YYYY-MM-DD` chấm lại trên một ngày QUÁ KHỨ (thay `(last)`
// bằng mốc thời gian cụ thể trên ERDDAP). Lúc đó Copernicus trả ANALYSIS chứ
// không phải dự báo ⇒ mức đổi đo được là CẬN TRÊN LẠC QUAN. Cận trên vẫn nhỏ
// ⇒ kết luận "bản đồ ít đổi" chắc chắn hơn. HYCOM bỏ qua ở chế độ này (kho
// ascii chỉ tiện cho bản mới nhất) — có ghi rõ trên màn hình.
const HIST_DATE = (process.argv.find((a) => a.startsWith("--date=")) ?? "").split("=")[1] || null;
const atDate = (url) =>
  HIST_DATE ? url.replace("%5B(last)%5D", `%5B(${HIST_DATE}T12:00:00Z)%5D`) : url;

const TIMEOUT_MS = 90000;
const VN = { lat0: 5, lat1: 22, lon0: 102, lon1: 118 };
const S3 = "https://s3.waw3-1.cloudferro.com";
const COP_THETAO =
  `${S3}/mdl-arco-time-012/arco/GLOBAL_ANALYSISFORECAST_PHY_001_024/` +
  `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406/downsampled4.zarr`;

/** ngưỡng hiển thị điểm nóng của client */
const HOT = 50;

let bytesCop = 0;

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

async function getJson(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": ERDDAP_UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.slice(0, 80)}`);
  return r.json();
}

async function scalar(url, opts) {
  try {
    const g = parseErddapGrid(await getJson(url), opts);
    return g.lats.length && g.date ? g : null;
  } catch {
    return null;
  }
}

/* ── Copernicus thetao (mặt) cho MỘT ngày ─────────────────────────────────── */

let handle = null;
async function copHandle() {
  if (handle) return handle;
  const t0 = Date.now();
  const zmeta = await getJson(`${COP_THETAO}/.zmetadata`);
  const vMeta = readZarrArrayMeta(zmeta, "thetao");
  const [nT, , nLat, nLon] = vMeta.shape;
  if (vMeta.chunks[0] !== 1 || vMeta.chunks[2] < nLat || vMeta.chunks[3] < nLon)
    throw new Error(`chunking đổi: ${JSON.stringify(vMeta.chunks)}`);
  const cf = parseCfTimeUnits(String(readZarrAttr(zmeta, "time", "units")));
  const readAxis = async (name) => {
    const am = readZarrArrayMeta(zmeta, name);
    const n = am.shape[0];
    const cs = am.chunks[0];
    const nc = Math.ceil(n / cs);
    const out = new Float32Array(n);
    for (let c = 0; c < nc; c++) {
      const r = await fetch(`${COP_THETAO}/${name}/${c}`, {
        headers: { "User-Agent": ERDDAP_UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const b = new Uint8Array(await r.arrayBuffer());
      bytesCop += b.byteLength;
      out.set(decodeFloat32Chunk(b).subarray(0, Math.min(cs, n - c * cs)), c * cs);
    }
    return out;
  };
  const [times, elev, lats, lons] = await Promise.all([
    readAxis("time"),
    readAxis("elevation"),
    readAxis("latitude"),
    readAxis("longitude"),
  ]);
  let ei = 0;
  for (let i = 1; i < elev.length; i++)
    if (Math.abs(elev[i]) < Math.abs(elev[ei])) ei = i;
  const signed = lons[0] < 0;
  handle = {
    vMeta,
    cf,
    times,
    nT,
    nLat,
    nLon,
    ei,
    lats,
    lons,
    latSel: axisRange(lats, VN.lat0, VN.lat1),
    lonSel: axisRange(lons, lonToAxis(VN.lon0, signed), lonToAxis(VN.lon1, signed)),
    axisMs: Date.now() - t0,
  };
  return handle;
}

async function fetchCopThetao(date) {
  const h = await copHandle();
  const target = (Date.parse(`${date}T12:00:00Z`) - h.cf.epochMs) / h.cf.msPerUnit;
  const ti = zNearestIndex(h.times.subarray(0, h.nT), target);
  if (ti < 0) return null;
  const pickedMs = cfTimeToMs(h.times[ti], h.cf);
  if (Math.abs(pickedMs - Date.parse(`${date}T12:00:00Z`)) > 18 * 3600_000) return null;
  const r = await fetch(`${COP_THETAO}/thetao/${ti}.${h.ei}.0.0`, {
    headers: { "User-Agent": ERDDAP_UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  bytesCop += buf.byteLength;
  const flat = decodeFloat32Chunk(buf);
  if (flat.length < h.nLat * h.nLon) return null;
  const lats = [];
  const lons = [];
  const values = [];
  for (let j = 0; j < h.lonSel.count; j++) lons.push(lonToEast(h.lons[h.lonSel.start + j]));
  for (let i = 0; i < h.latSel.count; i++) {
    const gi = h.latSel.start + i;
    lats.push(h.lats[gi]);
    const row = [];
    for (let j = 0; j < h.lonSel.count; j++) {
      const v = flat[gi * h.nLon + h.lonSel.start + j];
      row.push(isFill(v, h.vMeta.fillValue) ? NaN : v);
    }
    values.push(row);
  }
  return { lats, lons, values, date: new Date(pickedMs).toISOString().slice(0, 10) };
}

/* ── thống kê ─────────────────────────────────────────────────────────────── */

const key = (c) => `${c.lat},${c.lon}`;
const quant = (sorted, q) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;

function compare(base, other, pick) {
  const a = new Map(base.cells.map((c) => [key(c), pick(c)]));
  const b = new Map(other.cells.map((c) => [key(c), pick(c)]));
  const keys = new Set([...a.keys(), ...b.keys()]);
  let inter = 0;
  let union = 0;
  let flips = 0;
  const diffs = [];
  for (const k of keys) {
    const va = a.get(k) ?? 0;
    const vb = b.get(k) ?? 0;
    const ha = va >= HOT;
    const hb = vb >= HOT;
    if (ha || hb) union++;
    if (ha && hb) inter++;
    if (ha !== hb) flips++;
    if (a.has(k) && b.has(k)) diffs.push(Math.abs(va - vb));
  }
  diffs.sort((x, y) => x - y);
  const mean = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
  return {
    jaccard: union ? inter / union : 1,
    flips,
    flipPct: (100 * flips) / Math.max(1, keys.size),
    nKeys: keys.size,
    meanAbsD: mean,
    p95AbsD: quant(diffs, 0.95),
    hotBase: [...a.values()].filter((v) => v >= HOT).length,
    hotOther: [...b.values()].filter((v) => v >= HOT).length,
  };
}

function hotPct(fc, pick) {
  const vals = fc.cells.map(pick).filter((v) => v > 0);
  const hot = vals.filter((v) => v >= HOT).length;
  return { n: vals.length, hot, pct: vals.length ? (100 * hot) / vals.length : 0 };
}

/* ── chạy ─────────────────────────────────────────────────────────────────── */

const t0 = Date.now();
console.log("── nạp lưới quan trắc (giống route /api/fish-forecast) ──");
if (HIST_DATE) console.log(`  (chế độ KIỂM MÙA: ngày ${HIST_DATE}, KHÔNG dùng HYCOM)`);
const [sstA, sstB, chlA, chlB, sla, anom, cu, cv, hycom, bathyJson] = await Promise.all([
  scalar(atDate(sstGridUrl()), { hasAltitude: false, kelvin: true }),
  scalar(atDate(sstBackupGridUrl()), { hasAltitude: false }),
  scalar(atDate(chlGridUrl()), { hasAltitude: true }),
  scalar(atDate(chlBackupGridUrl()), { hasAltitude: true }),
  scalar(atDate(slaGridUrl()), { hasAltitude: false }),
  scalar(atDate(anomGridUrl()), { hasAltitude: false }),
  scalar(atDate(currentGridUrl("u")), { hasAltitude: false }),
  scalar(atDate(currentGridUrl("v")), { hasAltitude: false }),
  HIST_DATE ? Promise.resolve(null) : fetchHycomGrids().catch(() => null),
  getJson(bathyGridUrl()).catch(() => null),
]);
const newer = (a, b) => (!a ? b : !b ? a : a.date >= b.date ? a : b);
const sst = newer(sstA, sstB);
const chl = newer(chlA, chlB);
if (!sst || !chl) {
  console.error("THIẾU SST/phù du — dừng");
  process.exit(1);
}
const depth = bathyJson ? parseBathyGrid(bathyJson) : null;
const cur = cu && cv && cu.lats.length === cv.lats.length ? { u: cu, v: cv } : null;
const anchorDate = [sst.date, chl.date].sort()[0];
console.log(
  `  SST ${sst.date} (${sst.lats.length}×${sst.lons.length}) · phù du ${chl.date} · ` +
    `SSHA ${sla?.date ?? "—"} · dị thường ${anom?.date ?? "—"} · dòng ${cu?.date ?? "—"} · ` +
    `HYCOM ${hycom?.d20?.date ?? "—"} · độ sâu ${depth ? "có" : "—"}`,
);
console.log(`  NGÀY NEO D+0 = ${anchorDate}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log("\n── Copernicus thetao (mặt) cho D+0..D+3 ──");
const tCop = Date.now();
const copDates = Array.from({ length: MAX_FISH_LEAD + 1 }, (_, k) => addDays(anchorDate, k));
const cops = [];
for (const d of copDates) {
  const g = await fetchCopThetao(d).catch(() => null);
  cops.push(g);
  console.log(`  ${d}: ${g ? `OK (${g.lats.length}×${g.lons.length}, ngày ${g.date})` : "THIẾU"}`);
}
const copMs = Date.now() - tCop;
console.log(`  ${(bytesCop / 1024 / 1024).toFixed(2)} MB / ${(copMs / 1000).toFixed(1)}s`);

const month = Number(anchorDate.slice(5, 7));
const extraBase = {
  anom,
  cur,
  thermo: hycom?.d20 ?? null,
  depth,
  bottomTemp: hycom?.bottom ?? null,
  deepTemp: hycom?.deep250 ?? null,
};

console.log("\n── dựng 4 bản đồ ──");
const days = [];
for (let k = 0; k <= MAX_FISH_LEAD; k++) {
  const alpha = sstTendencyAlpha(k);
  const g = anchoredSstGrid({
    sat: sst,
    copBase: cops[0],
    copLead: cops[k],
    alpha,
    date: copDates[k],
  });
  // biên độ kéo nhiệt thật sự
  let sum = 0;
  let n = 0;
  let mx = 0;
  for (let i = 0; i < sst.lats.length; i++)
    for (let j = 0; j < sst.lons.length; j++) {
      const a = sst.values[i][j];
      const b = g.values[i][j];
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const d = Math.abs(b - a);
        sum += d;
        n++;
        if (d > mx) mx = d;
      }
    }
  const t1 = Date.now();
  const fc = buildFishForecast(g, chl, sla, month, { ...extraBase, frontSst: sst });
  days.push({ k, alpha, fc, dT: n ? sum / n : 0, dTmax: mx, ms: Date.now() - t1 });
  console.log(
    `  D+${k} (${copDates[k]}) α=${alpha.toFixed(3)} |ΔSST| tb=${(n ? sum / n : 0).toFixed(3)}°C ` +
      `max=${mx.toFixed(2)}°C → ${fc.cells.length} ô, ${(Date.now() - t1) / 1000}s`,
  );
}

const base = days[0].fc;
console.log("\n══ (1) %ĐIỂM NÓNG từng ngày — lớp \"Mọi loài\" (s≥50) ══");
for (const d of days) {
  const h = hotPct(d.fc, (c) => c.s);
  console.log(
    `  D+${d.k}: ${h.hot}/${h.n} ô = ${h.pct.toFixed(1)}%  (payload ${d.fc.cells.length} ô, ` +
      `${d.fc.species.length} loài)`,
  );
}

console.log("\n══ (2) BẢN ĐỒ ĐỔI BAO NHIÊU so với D+0 (lớp Mọi loài) ══");
console.log("  tầm | Jaccard(ô≥50) | ô đổi trạng thái | tb|Δs| | p95|Δs|");
const verdictRows = [];
for (const d of days.slice(1)) {
  const m = compare(base, d.fc, (c) => c.s);
  verdictRows.push({ k: d.k, ...m });
  console.log(
    `  D+${d.k} |     ${m.jaccard.toFixed(3)}     | ${String(m.flips).padStart(4)} ` +
      `(${m.flipPct.toFixed(2)}%) |  ${m.meanAbsD.toFixed(2)}  |  ${m.p95AbsD.toFixed(1)}`,
  );
}

console.log("\n══ (3) THEO NHÓM LOÀI (điểm loài `sp`, ô≥50) ══");
const cats = new Map();
for (const [short, meta] of Object.entries(SPECIES_META)) {
  if (!cats.has(meta.category)) cats.set(meta.category, []);
  cats.get(meta.category).push(short);
}
const spScore = (shorts) => (c) => {
  let best = 0;
  for (const s of shorts) {
    const v = c.sp[s];
    if (v != null && v > best) best = v;
  }
  return best;
};
for (const [cat, shorts] of cats) {
  const pick = spScore(shorts);
  const h0 = hotPct(base, pick);
  const parts = days.slice(1).map((d) => {
    const m = compare(base, d.fc, pick);
    const h = hotPct(d.fc, pick);
    return `D+${d.k}: J=${m.jaccard.toFixed(3)} đổi=${m.flipPct.toFixed(2)}% hot=${h.pct.toFixed(1)}%`;
  });
  console.log(
    `  ${(CATEGORY_LABEL[cat] ?? cat).padEnd(22)} hot(D+0)=${h0.pct.toFixed(1)}% | ${parts.join(" | ")}`,
  );
}

console.log("\n══ (4) ĐỘ TIN theo tầm (số THẬT từ copernicus-tendency-skill.json) ══");
for (let k = 1; k <= MAX_FISH_LEAD; k++) {
  const s = sstLeadSkill(k);
  console.log(
    `  D+${k}: corrTendency=${s.corrTendency.toFixed(3)} gainCV=${s.gainPct.toFixed(1)}% ` +
      `α=${sstTendencyAlpha(k).toFixed(3)} dùng-xu-hướng=${s.usesTendency ? "CÓ" : "KHÔNG"}`,
  );
}

console.log("\n══ (5) DUNG LƯỢNG payload (ước, JSON thô) ══");
const full = JSON.stringify(days.map((d) => d.fc));
const one = JSON.stringify(base);
console.log(`  1 bản: ${(one.length / 1024).toFixed(0)} KB · 4 bản đầy đủ: ${(full.length / 1024).toFixed(0)} KB`);
// delta = chỉ ô có s hoặc sp đổi
for (const d of days.slice(1)) {
  const m = new Map(base.cells.map((c) => [key(c), c]));
  const delta = [];
  for (const c of d.fc.cells) {
    const b = m.get(key(c));
    if (!b || b.s !== c.s || JSON.stringify(b.sp) !== JSON.stringify(c.sp))
      delta.push({ lat: c.lat, lon: c.lon, s: c.s, sp: c.sp, t: c.t });
  }
  console.log(
    `  delta D+${d.k}: ${delta.length}/${d.fc.cells.length} ô đổi = ${(JSON.stringify(delta).length / 1024).toFixed(0)} KB`,
  );
}

const worst = verdictRows[verdictRows.length - 1];
console.log("\n══ QUYẾT ĐỊNH (ngưỡng đặt trước: J<0,90 HOẶC ≥5% ô đổi trạng thái ở D+3) ══");
const changed = worst && (worst.jaccard < 0.9 || worst.flipPct >= 5);
console.log(
  `  D+3: Jaccard=${worst?.jaccard.toFixed(3)} · ô đổi=${worst?.flipPct.toFixed(2)}% ` +
    `⇒ ${changed ? "ĐỔI ĐÁNG KỂ → BƯỚC 2A (dựng 4 bản)" : "GẦN NHƯ Y HỆT → BƯỚC 2B (giữ 1 bản, nói thật)"}`,
);
console.log(`\nTổng thời gian probe: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
