// scripts/fish-front-composite-val.mjs
// ─────────────────────────────────────────────────────────────────────────
// PHA 0 — KIỂM CHỨNG "FRONT COMPOSITE nhiều ngày" cho Trục 1 (dự báo cá).
//
// CÂU HỎI: Trung bình LÙI độ-mạnh-front N ngày (N=3, N=5) có phải chỉ báo
// TỐT HƠN front-1-ngày không? Đo 2 tiêu chí:
//   (1) DỰ ĐOÁN front tương lai: composite tại D corr cao hơn với front THỰC
//       của D+1, D+2 so với front-1-ngày của D? (giả thuyết: front BỀN VỮNG =
//       cá tụ ổn định → ổn định sang mai/mốt hơn front thoáng qua).
//   (2) BỚT NHẤP NHÁY: giữa 2 ngày liên tiếp, bản đồ composite đổi ít hơn
//       front-1-ngày (ít điểm nóng giả xuất/biến).
// + TRADE-OFF: composite N lớn có làm nhoè front THẬT của chính ngày D không
//   (corr(FN(D), F1(D)) tụt)?
//
// ĐỊNH NGHĨA (bám ĐÚNG lõi src/lib/fish-predict.ts, copy y hệt công thức):
//   F1(D) = gradientStrength(logChl(D), 0.25)            [front mồi, chính]
//           gradientStrength(SST(D), 0.5)                [front nhiệt, phụ]
//   FN(D) = TRUNG BÌNH THEO NGÀY của { F1(D-N+1)..F1(D) } — tính gradient
//           TỪNG NGÀY TRƯỚC rồi mới trung bình (KHÔNG phải blur ảnh rồi gradient).
//           NaN theo ngày: ô thiếu ngày nào bỏ khỏi TB, chuẩn hoá số ngày còn lại.
//   (Biến thể "blur" = gradient của TB ảnh chl N ngày — đo thêm để CHỨNG minh
//    nó nhoè front hơn composite.)
//
// Chạy:  node scripts/fish-front-composite-val.mjs
// Không cần API key. Cần mạng (NOAA ERDDAP). Dữ liệu THẬT ~30 ngày gần nhất.
// KHÔNG ghi vào src/ — chỉ in bảng + ghi báo cáo scratchpad (do agent tổng hợp).
// ─────────────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";

// bbox biển VN + lưới chung 0.25° (khớp lưới 69×65 các script trước)
const LAT0 = 5.0, LAT1 = 22.0, LON0 = 102.0, LON1 = 118.0, STEP = 0.25;
const WINDOW_DAYS = 30;
const FETCH_TIMEOUT_MS = 40000;
const RETRIES = 2;
const CONCURRENCY = 4;

const CHL_FULL = 0.25; // full gradient/ô cho log-chl (khớp fish-predict.ts)
const SST_FULL = 0.5;  // full gradient/ô cho SST

// ── ngày ──────────────────────────────────────────────────────────────────
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const round = (x, p = 4) =>
  x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

// ── lưới chung ──────────────────────────────────────────────────────────────
const GLATS = [];
for (let v = LAT0; v <= LAT1 + 1e-9; v += STEP) GLATS.push(Math.round(v * 100) / 100);
const GLONS = [];
for (let v = LON0; v <= LON1 + 1e-9; v += STEP) GLONS.push(Math.round(v * 100) / 100);
const NLAT = GLATS.length, NLON = GLONS.length;

// ── fetch (mượn từ fish-plankton-advection-backtest.mjs) ─────────────────────
async function fetchJson(url, label) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`non-JSON (${r.status}): ${text.slice(0, 100)}`); }
      if (!r.ok) {
        const reason = data?.reason || `HTTP ${r.status}`;
        if (r.status === 400 || r.status === 404) return { _empty: true, reason };
        throw new Error(reason);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES)
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  console.warn(`    ! lỗi ${label}: ${String(lastErr).slice(0, 90)}`);
  return { _error: true };
}
async function pool(items, worker, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  return out;
}

// ── parse ERDDAP grid → {lats asc, lons asc, values[iLat][iLon]} ─────────────
function parseErddapGrid(json, hasAlt, kelvin) {
  const rows = json?.table?.rows ?? [];
  const iLat = hasAlt ? 2 : 1;
  const iLon = iLat + 1;
  const iVal = iLon + 1;
  const latSet = new Set(), lonSet = new Set();
  for (const r of rows) { latSet.add(r[iLat]); lonSet.add(r[iLon]); }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  const latIdx = new Map(lats.map((v, i) => [v, i]));
  const lonIdx = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  for (const r of rows) {
    const v = r[iVal];
    if (typeof v === "number" && Number.isFinite(v))
      values[latIdx.get(r[iLat])][lonIdx.get(r[iLon])] = kelvin ? v - 273.15 : v;
  }
  return { lats, lons, values };
}
function bilinear(grid, lat, lon) {
  const { lats, lons, values } = grid;
  if (lat < lats[0] || lat > lats[lats.length - 1]) return NaN;
  if (lon < lons[0] || lon > lons[lons.length - 1]) return NaN;
  let i = 0; while (i < lats.length - 2 && lats[i + 1] < lat) i++;
  let j = 0; while (j < lons.length - 2 && lons[j + 1] < lon) j++;
  const t = (lat - lats[i]) / (lats[i + 1] - lats[i]);
  const s = (lon - lons[j]) / (lons[j + 1] - lons[j]);
  const c = [
    [values[i][j], (1 - t) * (1 - s)],
    [values[i][j + 1], (1 - t) * s],
    [values[i + 1][j], t * (1 - s)],
    [values[i + 1][j + 1], t * s],
  ];
  let acc = 0, w = 0;
  for (const [v, ww] of c) if (Number.isFinite(v)) { acc += v * ww; w += ww; }
  return w > 0 ? acc / w : NaN;
}
// resample grid bất kỳ → lưới chung 2D [NLAT][NLON]
function toCommon2D(grid) {
  const out = GLATS.map(() => GLONS.map(() => NaN));
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++)
      out[a][b] = bilinear(grid, GLATS[a], GLONS[b]);
  return out;
}

const enc = (s) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
function chlUrl(d) {
  return enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(${d}T12:00:00Z)][(0.0)][(22.0):3:(5.0)][(102.0):3:(118.0)]`);
}
function sstUrl(d) {
  return enc(`${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst[(${d}T12:00:00Z)][(5.0):5:(22.0)][(102.0):5:(118.0)]`);
}

// ── COPY Y HỆT từ src/lib/fish-predict.ts ─────────────────────────────────────
// gradientStrength: |gradient| sai phân giữa, chuẩn hoá theo `full`, min 1.
// NaN center → giữ 0 (đúng runtime); neighbor thiếu → thành phần đó = 0.
function gradientStrength(values, full) {
  const H = values.length;
  const W = H ? values[0].length : 0;
  const out = values.map((row) => row.map(() => 0));
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      if (!Number.isFinite(values[i][j])) continue;
      const up = i + 1 < H ? values[i + 1][j] : NaN;
      const dn = i - 1 >= 0 ? values[i - 1][j] : NaN;
      const rt = j + 1 < W ? values[i][j + 1] : NaN;
      const lf = j - 1 >= 0 ? values[i][j - 1] : NaN;
      const gy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      const gx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      out[i][j] = Math.min(1, Math.hypot(gx, gy) / full);
    }
  }
  return out;
}
// logChlGrid: log10 (NaN/<=0 giữ NaN)
function logChlGrid2D(values) {
  return values.map((row) =>
    row.map((v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN)),
  );
}

// ── tiện ích lưới 2D ──────────────────────────────────────────────────────────
const zeros2D = () => GLATS.map(() => GLONS.map(() => 0));
const falses2D = () => GLATS.map(() => GLONS.map(() => false));

// composite FN từ danh sách F1 maps + validity masks (mask = ô có DỮ LIỆU ngày đó)
// TB theo ngày, chỉ cộng ô valid, chuẩn hoá số ngày còn lại. Ô 0 ngày → NaN/invalid.
function composite(f1List, maskList) {
  const map = GLATS.map(() => GLONS.map(() => NaN));
  const valid = falses2D();
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      let acc = 0, n = 0;
      for (let k = 0; k < f1List.length; k++)
        if (maskList[k][a][b]) { acc += f1List[k][a][b]; n++; }
      if (n > 0) { map[a][b] = acc / n; valid[a][b] = true; }
    }
  return { map, valid };
}

// Pearson trên các ô mà maskCells true VÀ cả 2 map finite
function corrMasked(mapP, mapA, maskCells) {
  let n = 0, sp = 0, sa = 0, spp = 0, saa = 0, spa = 0;
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      if (!maskCells[a][b]) continue;
      const p = mapP[a][b], q = mapA[a][b];
      if (!Number.isFinite(p) || !Number.isFinite(q)) continue;
      n++; sp += p; sa += q; spp += p * p; saa += q * q; spa += p * q;
    }
  if (n < 3) return { r: null, n };
  const cov = spa / n - (sp / n) * (sa / n);
  const vp = spp / n - (sp / n) ** 2, va = saa / n - (sa / n) ** 2;
  return { r: vp > 0 && va > 0 ? cov / Math.sqrt(vp * va) : null, n };
}

// mean |A - B| trên ô maskCells true & cả 2 finite
function meanAbsDiff(A, B, maskCells) {
  let s = 0, n = 0;
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++) {
      if (!maskCells[a][b]) continue;
      const x = A[a][b], y = B[a][b];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      s += Math.abs(x - y); n++;
    }
  return { m: n ? s / n : null, n };
}

// intersect nhiều mask 2D
function andMasks(...masks) {
  const out = falses2D();
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++)
      out[a][b] = masks.every((m) => m[a][b]);
  return out;
}

// p75 threshold của map trên ô mask true
function percentile(map, maskCells, p) {
  const vals = [];
  for (let a = 0; a < NLAT; a++)
    for (let b = 0; b < NLON; b++)
      if (maskCells[a][b] && Number.isFinite(map[a][b])) vals.push(map[a][b]);
  if (!vals.length) return null;
  vals.sort((x, y) => x - y);
  const idx = Math.min(vals.length - 1, Math.floor((p / 100) * vals.length));
  return vals[idx];
}

const mean = (arr) => {
  const v = arr.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Front composite validation — lưới ${NLAT}×${NLON} @0.25°`);

  // END = ảnh chl mới nhất
  const lastProbe = await fetchJson(
    enc(`${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a[(last)][(0.0)][(13.0)][(111.0)]`),
    "probe last",
  );
  const END = lastProbe?.table?.rows?.[0]?.[0]?.slice(0, 10) ?? iso(new Date(Date.now() - 2 * 86400000));
  const START = addDays(END, -(WINDOW_DAYS - 1));
  const days = [];
  for (let d = START; d <= END; d = addDays(d, 1)) days.push(d);
  console.log(`Cửa sổ: ${START} .. ${END} (${days.length} ngày)\n`);

  // kéo chl + sst theo ngày
  const chlLog = {}, chlMask = {}, sstVal = {}, sstMask = {};
  const chlRaw = {}; // giữ ảnh chl thô (cho biến thể blur)
  console.log("Kéo lưới ngày (chl / sst)...");
  await pool(days, async (d) => {
    const [cj, sj] = await Promise.all([
      fetchJson(chlUrl(d), `chl ${d}`),
      fetchJson(sstUrl(d), `sst ${d}`),
    ]);
    if (cj?.table) {
      const raw = toCommon2D(parseErddapGrid(cj, true, false));
      const lg = logChlGrid2D(raw);
      chlRaw[d] = raw;
      chlLog[d] = lg;
      chlMask[d] = lg.map((row) => row.map((v) => Number.isFinite(v)));
    }
    if (sj?.table) {
      const sv = toCommon2D(parseErddapGrid(sj, false, true));
      sstVal[d] = sv;
      sstMask[d] = sv.map((row) => row.map((v) => Number.isFinite(v)));
    }
    process.stdout.write(".");
  }, CONCURRENCY);
  console.log("");

  const chlDays = days.filter((d) => chlLog[d]);
  const sstDays = days.filter((d) => sstVal[d]);
  const cov = (mask) => {
    let n = 0, t = 0;
    for (let a = 0; a < NLAT; a++) for (let b = 0; b < NLON; b++) { t++; if (mask[a][b]) n++; }
    return n / t;
  };
  const avgChlCov = mean(chlDays.map((d) => cov(chlMask[d])));
  console.log(`Độ phủ: chl ${chlDays.length}/${days.length} ngày (ô hợp lệ TB ${(avgChlCov * 100).toFixed(1)}%), ` +
    `sst ${sstDays.length}/${days.length}\n`);

  // Chạy 1 biến (chl hoặc sst) → trả object kết quả
  function runVariable(name, valMap, maskMap, full, isChl) {
    // F1(D) cho mọi ngày có dữ liệu
    const F1 = {}, F1mask = {};
    for (const d of days) if (valMap[d]) {
      F1[d] = gradientStrength(valMap[d], full);
      F1mask[d] = maskMap[d];
    }
    // composite FN(D) từ F1
    function compAt(D, N) {
      const list = [], masks = [];
      for (let k = N - 1; k >= 0; k--) {
        const dd = addDays(D, -k);
        if (!F1[dd]) return null;
        list.push(F1[dd]); masks.push(F1mask[dd]);
      }
      return composite(list, masks);
    }
    // biến thể BLUR: gradient của TB ẢNH N ngày (chỉ chl có logChl; sst dùng valMap)
    function blurAt(D, N) {
      const src = [];
      for (let k = N - 1; k >= 0; k--) {
        const dd = addDays(D, -k);
        if (!valMap[dd]) return null;
        src.push(isChl ? chlLog[dd] : valMap[dd]);
      }
      const avg = GLATS.map(() => GLONS.map(() => NaN));
      for (let a = 0; a < NLAT; a++)
        for (let b = 0; b < NLON; b++) {
          let acc = 0, n = 0;
          for (const g of src) if (Number.isFinite(g[a][b])) { acc += g[a][b]; n++; }
          if (n > 0) avg[a][b] = acc / n;
        }
      const map = gradientStrength(avg, full);
      const valid = avg.map((row) => row.map((v) => Number.isFinite(v)));
      return { map, valid };
    }

    // ── TIÊU CHÍ 1: dự đoán front tương lai ─────────────────────────────────
    // với mỗi D đủ D-4..D và D+1,D+2
    const c1 = {
      // per-D corr lists cho từng (predictor, targetLead)
      d1: { n1: [], n3: [], n5: [], blur3: [], blur5: [] }, // target D+1
      d2: { n1: [], n3: [], n5: [], blur3: [], blur5: [] }, // target D+2
      nDays: 0,
    };
    for (const D of days) {
      const c1D = compAt(D, 1), c3D = compAt(D, 3), c5D = compAt(D, 5);
      if (!c1D || !c3D || !c5D) continue;
      const b3 = blurAt(D, 3), b5 = blurAt(D, 5);
      const D1 = addDays(D, 1), D2 = addDays(D, 2);
      const t1 = compAt(D1, 1), t2 = compAt(D2, 1); // target = F1 thực
      if (!t1 || !t2) continue;
      c1.nDays++;
      // mask CHUNG cho apples-to-apples (mọi predictor + cả 2 target valid)
      const baseMask = andMasks(c1D.valid, c3D.valid, c5D.valid, b3.valid, b5.valid);
      const m1 = andMasks(baseMask, t1.valid);
      const m2 = andMasks(baseMask, t2.valid);
      c1.d1.n1.push(corrMasked(c1D.map, t1.map, m1).r);
      c1.d1.n3.push(corrMasked(c3D.map, t1.map, m1).r);
      c1.d1.n5.push(corrMasked(c5D.map, t1.map, m1).r);
      c1.d1.blur3.push(corrMasked(b3.map, t1.map, m1).r);
      c1.d1.blur5.push(corrMasked(b5.map, t1.map, m1).r);
      c1.d2.n1.push(corrMasked(c1D.map, t2.map, m2).r);
      c1.d2.n3.push(corrMasked(c3D.map, t2.map, m2).r);
      c1.d2.n5.push(corrMasked(c5D.map, t2.map, m2).r);
      c1.d2.blur3.push(corrMasked(b3.map, t2.map, m2).r);
      c1.d2.blur5.push(corrMasked(b5.map, t2.map, m2).r);
    }

    // ── TIÊU CHÍ 2: nhấp nháy ngày-qua-ngày ────────────────────────────────
    // với mỗi D đủ D-5..D: |Fx(D) - Fx(D-1)| cho x=1,3,5, toàn lưới + p75
    const c2 = {
      all: { n1: [], n3: [], n5: [] },
      strong: { n1: [], n3: [], n5: [] },
      nDays: 0,
    };
    for (const D of days) {
      const Dm = addDays(D, -1);
      const cur = { 1: compAt(D, 1), 3: compAt(D, 3), 5: compAt(D, 5) };
      const prev = { 1: compAt(Dm, 1), 3: compAt(Dm, 3), 5: compAt(Dm, 5) };
      if (!cur[1] || !cur[3] || !cur[5] || !prev[1] || !prev[3] || !prev[5]) continue;
      c2.nDays++;
      // ô front mạnh = p75 của F1(D) trên ô valid
      const thr = percentile(cur[1].map, cur[1].valid, 75);
      const strongMask = falses2D();
      for (let a = 0; a < NLAT; a++)
        for (let b = 0; b < NLON; b++)
          strongMask[a][b] = cur[1].valid[a][b] && thr != null && cur[1].map[a][b] >= thr;
      for (const x of [1, 3, 5]) {
        const m = andMasks(cur[x].valid, prev[x].valid);
        c2.all["n" + x].push(meanAbsDiff(cur[x].map, prev[x].map, m).m);
        const ms = andMasks(m, strongMask);
        c2.strong["n" + x].push(meanAbsDiff(cur[x].map, prev[x].map, ms).m);
      }
    }

    // ── TRADE-OFF: corr(FN(D), F1(D)) — composite nhoè front THẬT ngày D? ────
    const tradeoff = { n3: [], n5: [] };
    for (const D of days) {
      const c1D = compAt(D, 1), c3D = compAt(D, 3), c5D = compAt(D, 5);
      if (!c1D || !c3D || !c5D) continue;
      const m3 = andMasks(c1D.valid, c3D.valid);
      const m5 = andMasks(c1D.valid, c5D.valid);
      tradeoff.n3.push(corrMasked(c3D.map, c1D.map, m3).r);
      tradeoff.n5.push(corrMasked(c5D.map, c1D.map, m5).r);
    }

    return { name, c1, c2, tradeoff };
  }

  const results = [
    runVariable("chlFront (log-chl, full 0.25) — CHÍNH", chlLog, chlMask, CHL_FULL, true),
    runVariable("thermFront (SST, full 0.5) — PHỤ", sstVal, sstMask, SST_FULL, false),
  ];

  for (const R of results) {
    console.log(`\n════════ ${R.name} ════════`);

    console.log(`\n[Tiêu chí 1] Dự đoán front tương lai — corr TB theo ${R.c1.nDays} ngày D`);
    console.log(`  Predictor  | vs F1(D+1) | vs F1(D+2)`);
    const f = (x) => (x == null ? "  —  " : x.toFixed(4));
    const row = (lbl, key) =>
      console.log(`  ${lbl.padEnd(10)} |   ${f(mean(R.c1.d1[key]))}   |   ${f(mean(R.c1.d2[key]))}`);
    row("F1 (N=1)", "n1");
    row("F3 (N=3)", "n3");
    row("F5 (N=5)", "n5");
    row("blur N=3", "blur3");
    row("blur N=5", "blur5");
    const g1n1 = mean(R.c1.d1.n1), g1n3 = mean(R.c1.d1.n3), g1n5 = mean(R.c1.d1.n5);
    const g2n1 = mean(R.c1.d2.n1), g2n3 = mean(R.c1.d2.n3), g2n5 = mean(R.c1.d2.n5);
    console.log(`  Δ(F3−F1): D+1 ${f(g1n3 - g1n1)}  D+2 ${f(g2n3 - g2n1)}`);
    console.log(`  Δ(F5−F1): D+1 ${f(g1n5 - g1n1)}  D+2 ${f(g2n5 - g2n1)}`);

    console.log(`\n[Tiêu chí 2] Nhấp nháy = TB |Fx(D)−Fx(D−1)| theo ${R.c2.nDays} ngày (nhỏ hơn = ổn định hơn)`);
    console.log(`  x   | toàn lưới | ô front mạnh (p75)`);
    const nrow = (lbl, key) =>
      console.log(`  ${lbl.padEnd(3)} |  ${f(mean(R.c2.all[key]))}  |  ${f(mean(R.c2.strong[key]))}`);
    nrow("N=1", "n1");
    nrow("N=3", "n3");
    nrow("N=5", "n5");
    const fa1 = mean(R.c2.all.n1), fa3 = mean(R.c2.all.n3), fa5 = mean(R.c2.all.n5);
    const fs1 = mean(R.c2.strong.n1), fs3 = mean(R.c2.strong.n3), fs5 = mean(R.c2.strong.n5);
    console.log(`  giảm nhấp nháy N=3 vs N=1: toàn lưới ${((1 - fa3 / fa1) * 100).toFixed(1)}%  front mạnh ${((1 - fs3 / fs1) * 100).toFixed(1)}%`);
    console.log(`  giảm nhấp nháy N=5 vs N=1: toàn lưới ${((1 - fa5 / fa1) * 100).toFixed(1)}%  front mạnh ${((1 - fs5 / fs1) * 100).toFixed(1)}%`);

    console.log(`\n[Trade-off] corr(FN(D), F1(D)) — 1.0 = không nhoè front thật ngày D`);
    console.log(`  N=3: ${f(mean(R.tradeoff.n3))}   N=5: ${f(mean(R.tradeoff.n5))}`);
  }

  // ── VERDICT tự động (dựa chlFront chính) ──────────────────────────────────
  const chl = results[0];
  const dPred_D1_N3 = mean(chl.c1.d1.n3) - mean(chl.c1.d1.n1);
  const dPred_D2_N3 = mean(chl.c1.d2.n3) - mean(chl.c1.d2.n1);
  const dPred_D1_N5 = mean(chl.c1.d1.n5) - mean(chl.c1.d1.n1);
  const dPred_D2_N5 = mean(chl.c1.d2.n5) - mean(chl.c1.d2.n1);
  const flickA_N3 = 1 - mean(chl.c2.all.n3) / mean(chl.c2.all.n1);
  const flickS_N3 = 1 - mean(chl.c2.strong.n3) / mean(chl.c2.strong.n1);
  const tradeN3 = mean(chl.tradeoff.n3);
  const tradeN5 = mean(chl.tradeoff.n5);

  console.log(`\n════════ VERDICT (chlFront chính) ════════`);
  const crit1ok = dPred_D1_N3 > 0.003 || dPred_D2_N3 > 0.003;
  const crit2ok = flickA_N3 > 0.05 || flickS_N3 > 0.05;
  console.log(`  Tiêu chí 1 (dự đoán tương lai tốt hơn): ${crit1ok ? "ĐẠT" : "KHÔNG"}`);
  console.log(`    ΔN3 D+1=${round(dPred_D1_N3, 4)} D+2=${round(dPred_D2_N3, 4)} | ΔN5 D+1=${round(dPred_D1_N5, 4)} D+2=${round(dPred_D2_N5, 4)}`);
  console.log(`  Tiêu chí 2 (bớt nhấp nháy): ${crit2ok ? "ĐẠT" : "KHÔNG"}`);
  console.log(`    N3 giảm: toàn lưới ${round(flickA_N3 * 100, 1)}% front mạnh ${round(flickS_N3 * 100, 1)}%`);
  console.log(`  Trade-off corr(FN,F1): N3=${round(tradeN3, 3)} N5=${round(tradeN5, 3)}`);
  const green = crit1ok || crit2ok;
  console.log(`\n  PHA 0: ${green ? "🟢 XANH" : "🔴 ĐỎ"}`);
  console.log(`  (XANH nếu ≥1 tiêu chí đạt; N khuyến nghị cân bằng trade-off — xem báo cáo)\n`);
}

main().catch((e) => { console.error("LỖI:", e); process.exitCode = 1; });
