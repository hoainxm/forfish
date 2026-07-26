// scripts/copernicus-tendency-skill.mjs
// ─────────────────────────────────────────────────────────────────────────
// COPERNICUS CÓ BIẾT **XU HƯỚNG** KHÔNG? — "neo vệ tinh + xu hướng mô hình"
//
// VÌ SAO CÓ FILE NÀY (phép đo trước trả lời SAI CÂU HỎI)
//   `scripts/copernicus-skill-backtest.mjs` so GIÁ TRỊ TUYỆT ĐỐI: chl của
//   Copernicus vs chl vệ tinh → lệch ~0,33 log10 (hệ số ~2,1×) ⇒ kết luận
//   "Copernicus không thắng persistence ở mọi tầm".
//   NHƯNG mô hình sinh địa hoá NEMO-PISCES nổi tiếng LỆCH TUYỆT ĐỐI ở ven bờ /
//   cửa sông đục. Lệch tuyệt đối ≠ không biết XU HƯỚNG. Với bản đồ 10 ngày ta
//   KHÔNG cần mô hình khớp con số — ta cần nó biết CÁI GÌ ĐANG ĐỔI, ĐỔI HƯỚNG NÀO.
//
// PHÉP ĐO ĐÚNG (thang log10 cho chl, °C cho SST):
//   DỰ BÁO NEO : pred(D+k)    = obs_sat(D) + [ cop(D+k) − cop(D) ]
//   BASELINE   : persist(D+k) = obs_sat(D)
//   THỰC TẾ    : obs_sat(D+k)
//   ⇒ Mọi lệch hệ thống (bias) của Copernicus TRIỆT TIÊU trong hiệu. Trên thang
//     log10, hiệu = TỈ SỐ ⇒ triệt tiêu cả bias nhân (hệ số 2,1× kia biến mất).
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠ CẢNH BÁO TRUNG THỰC BẮT BUỘC ĐỌC TRƯỚC MỌI CON SỐ
// ─────────────────────────────────────────────────────────────────────────
//   Kho ARCO/native công khai của Copernicus GHI ĐÈ dự báo cũ bằng bản tin mới
//   (mỗi ngày hiệu lực chỉ còn MỘT file; trục Zarr không có
//   `forecast_reference_time`) — đã kiểm thật ở script trước.
//   ⇒ `cop(D+k)` với D+k trong QUÁ KHỨ mà đọc từ kho HÔM NAY là **ANALYSIS**
//     (đã đồng hoá quan trắc của chính ngày đó), KHÔNG phải dự báo phát ngày D.
//   ⇒ Mọi `gain` ở đây là **CẬN TRÊN LẠC QUAN** của kỹ năng dự báo thật.
//
//   LUẬT ĐỌC KẾT QUẢ:
//     · Cận trên này VẪN THUA persistence ⇒ kết luận ÂM **CHẮC CHẮN**
//       (dự báo thật chỉ có thể tệ hơn).
//     · Cận trên này THẮNG ⇒ CHƯA phải bằng chứng để hứa với bà con; chỉ
//       chứng minh "đáng đầu tư đo tiếp bằng snapshot dự báo thật".
//
// ─────────────────────────────────────────────────────────────────────────
// CHỈ SỐ CỐT LÕI: `corrTendency`
//   corr( cop(D+k) − cop(D) , obs(D+k) − obs(D) ) trên MASK CHUNG.
//   Đây là câu hỏi "Copernicus có biết hướng đổi không" ở dạng thuần nhất.
//   Báo hai bản:
//     · `pearson`  — tương quan CÓ TRỪ TRUNG BÌNH, trung bình theo từng cặp ngày
//                    (đúng chữ của yêu cầu), kèm khoảng tin cậy thô theo KHỐI.
//     · `uncentered` — tương quan KHÔNG trừ trung bình, gộp toàn bộ ô của một
//                    tầm. ĐÂY mới là đại lượng quyết định RMSE, vì phép neo
//                    KHÔNG được phép cộng thêm hằng số.
//
//   Đại số (chính xác, không xấp xỉ) với c = xu hướng Copernicus, o = xu hướng
//   quan trắc, trên cùng mask:
//     rmsePersist  = √(Σoo/n)
//     rmsePred     = √((Σcc − 2Σco + Σoo)/n)
//     ⇒ neo THẮNG persistence ⇔ Σco > Σcc/2 ⇔ r_uncentered > ½·√(Σcc/Σoo)
//     alphaOpt     = Σco/Σcc                    (hệ số giảm chấn TỐI ƯU hậu nghiệm)
//     rmsePredOpt  = √((Σoo − Σco²/Σcc)/n) = rmsePersist·√(1 − r_uncentered²)
//   `gainOptPct` do đó là CẬN TRÊN CỦA CẬN TRÊN: giả sử ta biết trước hệ số
//   giảm chấn tốt nhất cho từng tầm. Nếu cả nó cũng ~0 thì hết đường.
//
// ─────────────────────────────────────────────────────────────────────────
// KIỂM TRA TÍNH LÀNH MẠNH (bắt buộc — pipeline rò rỉ thì mọi số vô nghĩa)
//   1. `noise`    — thay `c` bằng nhiễu Gauss trắng cùng RMS. Phải gain ≤ 0.
//   2. `shuffled` — thay `c` bằng xu hướng Copernicus của MỘT NGÀY KHỞI TẠO
//                   KHÁC, cùng tầm k, cùng lưới (lệch ≥5 ngày). Giữ nguyên biên
//                   độ + cấu trúc không gian, chỉ PHÁ đồng bộ thời gian.
//                   Đây là control MẠNH: nếu nó cũng "thắng" thì cái ta đo
//                   không phải kỹ năng dự báo mà là khí hậu/mùa.
//
// BẪY ĐÃ CHỦ ĐỘNG TRÁNH (đã trả giá ở vòng advection + vòng backtest trước)
//   a) MASK CHUNG: ô chỉ được chấm khi obs(D), obs(D+k), cop(D), cop(D+k) đều
//      hữu hạn. pred và persist BẮT BUỘC chấm trên đúng cùng tập ô đó.
//   b) ERDDAP SNAP NGÀY: xin `2026-05-20` mà trống thì ERDDAP lặng lẽ trả ngày
//      gần nhất → obs(D) và obs(D+k) có thể là CÙNG một ảnh ⇒ persistence được
//      thưởng oan. Mọi lưới bị kiểm `date === ngày đã xin`, lệch là VỨT.
//   c) BẬC TỰ DO: trường biển tự tương quan ~0,97/ngày ⇒ số cặp ngày ≠ số mẫu
//      độc lập. Lấy nhiều KHỐI rải nhiều mùa; dof ≈ số KHỐI.
//
// NGUỒN
//   Quan trắc  chl : NOAA `noaacwNPPN20VIIRSDINEOFDaily` (DINEOF vá mây)
//   Quan trắc  SST : NOAA `noaacwBLENDEDsstDaily` (Kelvin → °C)
//   Copernicus chl : GLOBAL_ANALYSISFORECAST_BGC_001_028
//                    cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m (timeChunked.zarr)
//   Copernicus SST : GLOBAL_ANALYSISFORECAST_PHY_001_024
//                    cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m (downsampled4)
//   Copernicus phyc: cùng kho pft — sinh khối thực vật phù du (carbon).
//     `zooc` (động vật phù du) KHÔNG có trong sản phẩm analysis-forecast
//     (đã liệt kê biến kho: chỉ chl + phyc) — chỉ có ở bộ tái phân tích
//     GLOBAL_MULTIYEAR_BGC. Nên dùng `phyc` làm biến "sinh khối mồi" thay thế,
//     và nó CHỈ được chấm bằng thước đo GIÁN TIẾP: tương quan xu hướng phyc với
//     xu hướng chl QUAN TRẮC (không có ảnh vệ tinh phyc để làm sự thật).
//
// CHẠY
//   node scripts/copernicus-tendency-skill.mjs
//   node scripts/copernicus-tendency-skill.mjs --blocks=2 --block-len=12
//   node scripts/copernicus-tendency-skill.mjs --with-phyc
// Ghi ra: src/data/copernicus-tendency-skill.json
// Cache chunk dùng CHUNG thư mục với copernicus-skill-backtest.mjs → chạy lại nhanh.
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  decodeFloat32Chunk,
  readZarrArrayMeta,
  readZarrAttr,
  parseCfTimeUnits,
  cfTimeToMs,
  nearestIndex,
  axisRange,
  isFill,
  lonToAxis,
  lonToEast,
} from "../src/lib/copernicus.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "copernicus-tendency-skill.json");
/** DÙNG CHUNG cache với copernicus-skill-backtest.mjs (cùng khoá, cùng lưới) */
const CACHE_DIR = join(tmpdir(), "sdfish-copernicus-skill-cache");

/** UA bắt buộc — NOAA coastwatch trả 403 cho UA mặc định của undici/node.
 *  Khớp `ERDDAP_UA` trong src/lib/fish-predict.ts. */
const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const S3 = "https://s3.waw3-1.cloudferro.com";

/** Hộp biển VN — khớp lưới đang dùng ở fish-predict */
const VN = { lat0: 5, lat1: 22, lon0: 102, lon1: 118 };

const MAX_LEAD = 9;
const FETCH_TIMEOUT_MS = 120000;
const RETRIES = 2;
/** số ô tối thiểu của mask chung để chấm một cặp ngày */
const MIN_MASK_CELLS = 200;
/** lệch tối thiểu (ngày) giữa D và D' của control `shuffled` */
const SHUFFLE_MIN_SEP = 5;

/* ---------------------------------------------------------------------------
   Tham số dòng lệnh
--------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const N_BLOCKS = flag("blocks", 4);
const BLOCK_LEN = flag("block-len", 15);
const BLOCK_GAP = flag("block-gap", 95);
const NEWEST_END_BACK = flag("newest-end-back", 5);
const WITH_PHYC = has("with-phyc");

/* ---------------------------------------------------------------------------
   Cấu hình nguồn
--------------------------------------------------------------------------- */

const COP = {
  chl: {
    zarr:
      `${S3}/mdl-arco-time-006/arco/GLOBAL_ANALYSISFORECAST_BGC_001_028/` +
      `cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m_202311/timeChunked.zarr`,
    variable: "chl",
  },
  sst: {
    zarr:
      `${S3}/mdl-arco-time-012/arco/GLOBAL_ANALYSISFORECAST_PHY_001_024/` +
      `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406/downsampled4.zarr`,
    variable: "thetao",
  },
  // sinh khối thực vật phù du — CÙNG kho với chl, không có quan trắc vệ tinh
  phyc: {
    zarr:
      `${S3}/mdl-arco-time-006/arco/GLOBAL_ANALYSISFORECAST_BGC_001_028/` +
      `cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m_202311/timeChunked.zarr`,
    variable: "phyc",
  },
};

/** thang đo: chl & phyc trên log10 (như fish-predict), SST trên °C */
const LOG_SCALED = new Set(["chl", "phyc"]);
const UNIT = { chl: "log10(mg/m³)", sst: "°C", phyc: "log10(mmol/m³ C)" };

/** URL quan trắc NOAA cho MỘT ngày cụ thể (KHÔNG dùng `(last)`) */
function obsUrl(kind, date) {
  const t = `(${date}T12:00:00Z)`;
  return kind === "chl"
    ? `${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B${t}%5D%5B(0.0)%5D` +
        `%5B(${VN.lat1}):3:(${VN.lat0})%5D%5B(${VN.lon0}):3:(${VN.lon1})%5D`
    : `${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst%5B${t}%5D` +
        `%5B(${VN.lat0}):5:(${VN.lat1})%5D%5B(${VN.lon0}):5:(${VN.lon1})%5D`;
}

/* ---------------------------------------------------------------------------
   Tiện ích
--------------------------------------------------------------------------- */

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dayDiff = (a, b) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const round = (x, p = 4) =>
  x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

/** PRNG có hạt giống — kết quả control `noise` tái lập được y hệt */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Box–Muller từ PRNG có hạt giống */
function gauss(rnd) {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

function cacheKey(name) {
  return join(CACHE_DIR, `${name.replace(/[^a-z0-9._-]/gi, "_")}.json`);
}
function cacheGet(name) {
  const p = cacheKey(name);
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}
function cacheSet(name, value) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheKey(name), JSON.stringify(value), "utf8");
}

async function fetchWithRetry(url, kind = "buffer") {
  let lastErr;
  for (let a = 0; a <= RETRIES; a++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!r.ok) {
        // 403/404 trên S3 = chunk toàn fill (Zarr bỏ chunk rỗng) hoặc ngày trống
        if (r.status === 403 || r.status === 404) return { missing: true, status: r.status };
        throw new Error(`HTTP ${r.status}`);
      }
      if (kind === "buffer") return { data: new Uint8Array(await r.arrayBuffer()) };
      if (kind === "text") return { data: await r.text() };
      return { data: await r.json() };
    } catch (e) {
      lastErr = e;
      if (a < RETRIES) await new Promise((res) => setTimeout(res, 800 * (a + 1)));
    }
  }
  return { error: String(lastErr).slice(0, 120) };
}

/* ---------------------------------------------------------------------------
   ĐỌC LƯỚI
--------------------------------------------------------------------------- */

/** Bảng ERDDAP .json → lưới VN. Trả null nếu ERDDAP snap sang ngày KHÁC (bẫy b). */
function parseObs(json, kind, wantDate) {
  const cols = json?.table?.columnNames ?? [];
  const rows = json?.table?.rows ?? [];
  if (!rows.length) return null;
  const iLat = cols.indexOf("latitude");
  const iLon = cols.indexOf("longitude");
  const iVal = cols.length - 1;
  if (iLat < 0 || iLon < 0) return null;

  const gotDate = String(rows[0][0] ?? "").slice(0, 10);
  if (gotDate !== wantDate) return null;

  const lats = [...new Set(rows.map((r) => r[iLat]))].sort((a, b) => a - b);
  const lons = [...new Set(rows.map((r) => r[iLon]))].sort((a, b) => a - b);
  const li = new Map(lats.map((v, i) => [v, i]));
  const oi = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  for (const r of rows) {
    const v = r[iVal];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    values[li.get(r[iLat])][oi.get(r[iLon])] = kind === "sst" ? v - 273.15 : v;
  }
  return { lats, lons, values, date: gotDate };
}

async function fetchObs(kind, date) {
  const ck = `obs-${kind}-${date}`;
  const hit = cacheGet(ck);
  if (hit !== undefined) return hit;
  const r = await fetchWithRetry(obsUrl(kind, date), "json");
  const grid = r.data ? parseObs(r.data, kind, date) : null;
  cacheSet(ck, grid);
  return grid;
}

const zarrCache = new Map();

async function zarrHandle(key) {
  if (zarrCache.has(key)) return zarrCache.get(key);
  const cfg = COP[key];
  const meta = await fetchWithRetry(`${cfg.zarr}/.zmetadata`, "json");
  if (!meta.data) throw new Error(`${key}: không đọc được .zmetadata`);
  const zmeta = meta.data;
  const vMeta = readZarrArrayMeta(zmeta, cfg.variable);
  if (!vMeta) throw new Error(`${key}: thiếu .zarray của ${cfg.variable}`);
  const [nT, , nLat, nLon] = vMeta.shape;
  if (vMeta.chunks[0] !== 1 || vMeta.chunks[2] < nLat || vMeta.chunks[3] < nLon) {
    throw new Error(`${key}: chunking đã đổi (${JSON.stringify(vMeta.chunks)}) — dừng`);
  }
  const cf = parseCfTimeUnits(String(readZarrAttr(zmeta, "time", "units")));
  if (!cf) throw new Error(`${key}: không hiểu units trục time`);

  // trục dùng chung theo KHO (chl và phyc cùng kho) → khoá cache theo tên kho
  const store = cfg.zarr.split("/").slice(-2).join("_").replace(/[^a-z0-9._-]/gi, "_");
  const readAxis = async (name) => {
    const am = readZarrArrayMeta(zmeta, name);
    const n = am.shape[0];
    const cs = am.chunks[0];
    const nc = Math.ceil(n / cs);
    const out = new Float32Array(n);
    for (let c = 0; c < nc; c++) {
      // khoá cũ `axis-chl-*` / `axis-sst-*` đã có sẵn từ lần chạy trước → tái dùng
      const legacy = `axis-${key}-${name}-${c}`;
      const ck = `axisstore-${store}-${name}-${c}`;
      let arr = cacheGet(legacy);
      if (arr === undefined) arr = cacheGet(ck);
      if (arr === undefined) {
        const b = await fetchWithRetry(`${cfg.zarr}/${name}/${c}`);
        if (!b.data) throw new Error(`${key}: hỏng trục ${name}`);
        arr = [...decodeFloat32Chunk(b.data)];
        cacheSet(ck, arr);
      }
      out.set(Float32Array.from(arr).subarray(0, Math.min(cs, n - c * cs)), c * cs);
    }
    return out;
  };

  const [times, elev, lats, lons] = await Promise.all([
    readAxis("time"),
    readAxis("elevation"),
    readAxis("latitude"),
    readAxis("longitude"),
  ]);
  // ĐÃ XÁC MINH: trục elevation xếp SÂU → NÔNG (idx 0 ≈ −5727 m, idx 49 ≈ −0,494 m);
  // mặt biển là ô |z| nhỏ nhất. Giữ nguyên cách chọn của script trước.
  let ei = 0;
  for (let i = 1; i < elev.length; i++) {
    if (Math.abs(elev[i]) < Math.abs(elev[ei])) ei = i;
  }
  const signed = lons[0] < 0;
  const latSel = axisRange(lats, VN.lat0, VN.lat1);
  const lonSel = axisRange(lons, lonToAxis(VN.lon0, signed), lonToAxis(VN.lon1, signed));

  const h = { cfg, vMeta, cf, times, nT, nLat, nLon, ei, lats, lons, latSel, lonSel };
  zarrCache.set(key, h);
  return h;
}

/** Lưới Copernicus VN cho MỘT ngày; null nếu kho không có đúng ngày đó */
async function fetchCop(key, date) {
  const ck = `cop-${key}-${date}`;
  const hit = cacheGet(ck);
  if (hit !== undefined) return hit;

  const h = await zarrHandle(key);
  const target = (Date.parse(`${date}T12:00:00Z`) - h.cf.epochMs) / h.cf.msPerUnit;
  const ti = nearestIndex(h.times.subarray(0, h.nT), target);
  let grid = null;
  if (ti >= 0) {
    const pickedMs = cfTimeToMs(h.times[ti], h.cf);
    // trung bình NGÀY đóng dấu 00:00Z ⇒ chấp nhận lệch ≤ 18 h so với 12:00Z
    if (Math.abs(pickedMs - Date.parse(`${date}T12:00:00Z`)) <= 18 * 3600_000) {
      const b = await fetchWithRetry(`${h.cfg.zarr}/${h.cfg.variable}/${ti}.${h.ei}.0.0`);
      if (b.data) {
        const flat = decodeFloat32Chunk(b.data);
        if (flat.length >= h.nLat * h.nLon) {
          const lats = [];
          const lons = [];
          const values = [];
          for (let j = 0; j < h.lonSel.count; j++) {
            lons.push(lonToEast(h.lons[h.lonSel.start + j]));
          }
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
          grid = { lats, lons, values, date: new Date(pickedMs).toISOString().slice(0, 10) };
        }
      }
    }
  }
  cacheSet(ck, grid);
  return grid;
}

/* ---------------------------------------------------------------------------
   CÙNG LƯỚI, CÙNG THANG
--------------------------------------------------------------------------- */

/** Copernicus → lưới của quan trắc, láng giềng gần nhất (obs là lưới chuẩn) */
function regridTo(ref, src) {
  const iMap = ref.lats.map((la) => nearestIndex(src.lats, la));
  const jMap = ref.lons.map((lo) => nearestIndex(src.lons, lo));
  return ref.lats.map((_, i) =>
    ref.lons.map((__, j) => {
      const si = iMap[i];
      const sj = jMap[j];
      if (si < 0 || sj < 0) return NaN;
      if (Math.abs(src.lats[si] - ref.lats[i]) > 0.35) return NaN;
      if (Math.abs(src.lons[sj] - ref.lons[j]) > 0.35) return NaN;
      const v = src.values[si][sj];
      return Number.isFinite(v) ? v : NaN;
    }),
  );
}

/** chl/phyc → log10; SST giữ °C */
function toScale(kind, values) {
  if (!LOG_SCALED.has(kind)) return values;
  return values.map((row) =>
    row.map((v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN)),
  );
}

/**
 * |gradient| sai phân giữa theo CHỈ SỐ Ô — cùng công thức `gradientStrength()`
 * của src/lib/fish-predict.ts nhưng KHÔNG kẹp về [0,1] (kẹp sẽ bão hoà và làm
 * hỏng phép tương quan). Ô thiếu láng giềng → NaN, KHÔNG cho 0.
 */
function gradMag(values) {
  const H = values.length;
  const W = H ? values[0].length : 0;
  const out = values.map((row) => row.map(() => NaN));
  for (let i = 1; i < H - 1; i++) {
    for (let j = 1; j < W - 1; j++) {
      const up = values[i + 1][j];
      const dn = values[i - 1][j];
      const rt = values[i][j + 1];
      const lf = values[i][j - 1];
      if (![up, dn, rt, lf].every(Number.isFinite)) continue;
      out[i][j] = Math.hypot((rt - lf) / 2, (up - dn) / 2);
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   THỐNG KÊ
--------------------------------------------------------------------------- */

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 20) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

const meanOf = (a) => {
  const f = a.filter(Number.isFinite);
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : NaN;
};
const sdOf = (a) => {
  const f = a.filter(Number.isFinite);
  if (f.length < 2) return NaN;
  const m = meanOf(f);
  return Math.sqrt(f.reduce((s, x) => s + (x - m) ** 2, 0) / (f.length - 1));
};

/** t hai phía 95% theo bậc tự do nhỏ (df = số KHỐI − 1) */
const T95 = { 1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306 };
const t95 = (df) => (df <= 0 ? NaN : (T95[df] ?? 1.96));

/** bộ tích luỹ cho MỘT bộ dự đoán ở MỘT tầm */
const newAcc = () => ({ se: 0, n: 0, corrs: [], frontCorrs: [] });

function pushPair(acc, pred, truth, mask) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (!mask[i][j]) continue;
      const p = pred[i][j];
      const t = truth[i][j];
      if (!Number.isFinite(p) || !Number.isFinite(t)) continue;
      xs.push(p);
      ys.push(t);
      acc.se += (p - t) ** 2;
      acc.n += 1;
    }
  }
  if (xs.length >= 20) acc.corrs.push(pearson(xs, ys));
}

function pushFront(acc, predGrad, truthGrad, mask) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (!mask[i][j]) continue;
      const p = predGrad[i][j];
      const t = truthGrad[i][j];
      if (!Number.isFinite(p) || !Number.isFinite(t)) continue;
      xs.push(p);
      ys.push(t);
    }
  }
  if (xs.length >= 20) acc.frontCorrs.push(pearson(xs, ys));
}

const summariseAcc = (a) => ({
  rmse: round(a.n ? Math.sqrt(a.se / a.n) : NaN),
  corr: round(meanOf(a.corrs)),
  frontCorr: round(meanOf(a.frontCorrs)),
  nCells: a.n,
  nPairs: a.corrs.length,
});

/* ---------------------------------------------------------------------------
   NGÀY KHỞI TẠO
--------------------------------------------------------------------------- */

function buildBlocks() {
  const today = iso(new Date());
  const blocks = [];
  for (let b = 0; b < N_BLOCKS; b++) {
    const end = addDays(today, -(NEWEST_END_BACK + b * BLOCK_GAP));
    const days = [];
    for (let i = BLOCK_LEN - 1; i >= 0; i--) days.push(addDays(end, -i));
    blocks.push(days);
  }
  return blocks.reverse();
}

/* ---------------------------------------------------------------------------
   ĐO
--------------------------------------------------------------------------- */

/**
 * Một tầm k gồm:
 *   pred / persist / noise / shuffled  → RMSE + corr không gian + frontCorr
 *   tend: Σcc, Σco, Σoo (gộp ô) + danh sách pearson theo cặp ngày (kèm khối)
 */
const newLead = () => ({
  pred: newAcc(),
  persist: newAcc(),
  noise: newAcc(),
  shuffled: newAcc(),
  Scc: 0,
  Sco: 0,
  Soo: 0,
  nTend: 0,
  /** cùng ba tổng nhưng TÁCH THEO KHỐI → cho phép fit α kiểu leave-one-block-out */
  byBlockSums: new Map(), // bi -> { Scc, Sco, Soo, n }
  tendPearson: [], // { block, r }
  shufPearson: [],
  nPairs: 0,
  blocksSeen: new Set(),
});

/** Tải song song quan trắc (`obsKind`) + Copernicus (`copKey`) cho mọi ngày */
async function loadAll(obsKind, copKey, dates) {
  const obs = new Map();
  const cop = new Map();
  let okObs = 0;
  let okCop = 0;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const [o, c] = await Promise.all([fetchObs(obsKind, d), fetchCop(copKey, d)]);
    if (o) {
      obs.set(d, o);
      okObs++;
    }
    if (c) {
      cop.set(d, c);
      okCop++;
    }
    if ((i + 1) % 15 === 0 || i === dates.length - 1) {
      console.log(`  ${i + 1}/${dates.length} ngày — quan trắc ${okObs}, Copernicus ${okCop}`);
    }
  }
  return { obs, cop };
}

/**
 * Đo "neo vệ tinh + xu hướng Copernicus".
 * `copKey` cho phép chấm phyc trên sự thật chl (thước đo GIÁN TIẾP).
 */
async function measure(kind, blocks, copKey = kind) {
  const indirect = copKey !== kind;
  console.log(
    `\n### ${copKey.toUpperCase()}${indirect ? ` (xu hướng) vs ${kind.toUpperCase()} (quan trắc)` : ""} — tải dữ liệu`,
  );
  const allDates = [...new Set(blocks.flat())];
  const { obs, cop: copMap } = await loadAll(kind, copKey, allDates);

  const rnd = mulberry32(20260726);
  const leads = Array.from({ length: MAX_LEAD }, () => newLead());
  let skipped = 0;

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    for (let a = 0; a < block.length; a++) {
      const D = block[a];
      for (let k = 1; k <= MAX_LEAD; k++) {
        const T = addDays(D, k);
        if (!block.includes(T)) continue;
        const oD = obs.get(D);
        const oT = obs.get(T);
        const cD = copMap.get(D);
        const cT = copMap.get(T);
        if (!oD || !oT || !cD || !cT) {
          skipped++;
          continue;
        }

        // lưới chuẩn = lưới quan trắc ngày ĐÍCH
        const ref = oT;
        const truth = toScale(kind, ref.values);
        const obsD = toScale(kind, regridTo(ref, oD));
        const copD = toScale(copKey, regridTo(ref, cD));
        const copT = toScale(copKey, regridTo(ref, cT));

        // BẪY (a): MASK CHUNG — hữu hạn ở CẢ BỐN trường
        const mask = truth.map((row, i) =>
          row.map(
            (v, j) =>
              Number.isFinite(v) &&
              Number.isFinite(obsD[i][j]) &&
              Number.isFinite(copD[i][j]) &&
              Number.isFinite(copT[i][j]),
          ),
        );
        if (mask.flat().filter(Boolean).length < MIN_MASK_CELLS) continue;

        const L = leads[k - 1];
        L.nPairs += 1;
        L.blocksSeen.add(bi);

        // xu hướng
        const cTend = truth.map((row, i) => row.map((_, j) => copT[i][j] - copD[i][j]));
        const oTend = truth.map((row, i) => row.map((_, j) => truth[i][j] - obsD[i][j]));

        // DỰ BÁO NEO + BASELINE (chỉ có nghĩa khi cùng biến; phyc → bỏ qua RMSE)
        const pred = truth.map((row, i) => row.map((_, j) => obsD[i][j] + cTend[i][j]));

        // control 1: nhiễu Gauss trắng cùng RMS với xu hướng thật
        let ss = 0;
        let sn = 0;
        for (let i = 0; i < mask.length; i++) {
          for (let j = 0; j < mask[i].length; j++) {
            if (!mask[i][j]) continue;
            const c = cTend[i][j];
            if (!Number.isFinite(c)) continue;
            ss += c * c;
            sn += 1;
          }
        }
        const rms = sn ? Math.sqrt(ss / sn) : 0;
        const noiseTend = truth.map((row) => row.map(() => gauss(rnd) * rms));
        const predNoise = truth.map((row, i) =>
          row.map((_, j) => obsD[i][j] + noiseTend[i][j]),
        );

        // control 2: xu hướng Copernicus của MỘT ngày khởi tạo KHÁC, cùng tầm
        // lấy khoảng cách XA NHẤT còn dùng được, dừng ở SHUFFLE_MIN_SEP
        let predShuf = null;
        let sTend = null;
        for (let off = block.length - 1; off >= SHUFFLE_MIN_SEP; off--) {
          for (const sign of [1, -1]) {
            const idx = a + sign * off;
            if (idx < 0 || idx >= block.length) continue;
            const D2 = block[idx];
            if (Math.abs(dayDiff(D2, D)) < SHUFFLE_MIN_SEP) continue;
            const T2 = addDays(D2, k);
            const c2D = copMap.get(D2);
            const c2T = copMap.get(T2);
            if (!c2D || !c2T) continue;
            const s2D = toScale(copKey, regridTo(ref, c2D));
            const s2T = toScale(copKey, regridTo(ref, c2T));
            sTend = truth.map((row, i) => row.map((_, j) => s2T[i][j] - s2D[i][j]));
            predShuf = truth.map((row, i) => row.map((_, j) => obsD[i][j] + sTend[i][j]));
            break;
          }
          if (predShuf) break;
        }

        if (!indirect) {
          pushPair(L.pred, pred, truth, mask);
          pushPair(L.persist, obsD, truth, mask);
          pushPair(L.noise, predNoise, truth, mask);
          if (predShuf) pushPair(L.shuffled, predShuf, truth, mask);

          const gTruth = gradMag(truth);
          pushFront(L.pred, gradMag(pred), gTruth, mask);
          pushFront(L.persist, gradMag(obsD), gTruth, mask);
          pushFront(L.noise, gradMag(predNoise), gTruth, mask);
          if (predShuf) pushFront(L.shuffled, gradMag(predShuf), gTruth, mask);
        }

        // tương quan xu hướng — pearson theo cặp ngày + tổng gộp cho đại số RMSE
        const xs = [];
        const ys = [];
        const xs2 = [];
        if (!L.byBlockSums.has(bi)) L.byBlockSums.set(bi, { Scc: 0, Sco: 0, Soo: 0, n: 0 });
        const B = L.byBlockSums.get(bi);
        for (let i = 0; i < mask.length; i++) {
          for (let j = 0; j < mask[i].length; j++) {
            if (!mask[i][j]) continue;
            const c = cTend[i][j];
            const o = oTend[i][j];
            if (!Number.isFinite(c) || !Number.isFinite(o)) continue;
            xs.push(c);
            ys.push(o);
            if (sTend && Number.isFinite(sTend[i][j])) xs2.push(sTend[i][j]);
            L.Scc += c * c;
            L.Sco += c * o;
            L.Soo += o * o;
            L.nTend += 1;
            B.Scc += c * c;
            B.Sco += c * o;
            B.Soo += o * o;
            B.n += 1;
          }
        }
        if (xs.length >= 20) L.tendPearson.push({ block: bi, r: pearson(xs, ys) });
        if (xs2.length === ys.length && xs2.length >= 20) {
          L.shufPearson.push({ block: bi, r: pearson(xs2, ys) });
        }
      }
    }
  }
  if (skipped) console.log(`  (bỏ ${skipped} cặp vì thiếu lưới một phía)`);

  return leads.map((L, idx) => {
    const n = L.nTend;
    const rmsePersistExact = n ? Math.sqrt(L.Soo / n) : NaN;
    const rmsePredExact = n ? Math.sqrt((L.Scc - 2 * L.Sco + L.Soo) / n) : NaN;
    const rUnc =
      L.Scc > 0 && L.Soo > 0 ? L.Sco / Math.sqrt(L.Scc * L.Soo) : NaN;
    const alphaOpt = L.Scc > 0 ? L.Sco / L.Scc : NaN;
    const rmsePredOpt = Number.isFinite(rUnc)
      ? rmsePersistExact * Math.sqrt(Math.max(0, 1 - rUnc * rUnc))
      : NaN;

    const pred = summariseAcc(L.pred);
    const persist = summariseAcc(L.persist);
    const noise = summariseAcc(L.noise);
    const shuffled = summariseAcc(L.shuffled);

    // gain dùng RMSE ĐẠI SỐ (chính xác, cùng mask, không phụ thuộc thứ tự cộng)
    const gainPct = round((100 * (rmsePersistExact - rmsePredExact)) / rmsePersistExact, 2);
    const gainOptPct = round((100 * (rmsePersistExact - rmsePredOpt)) / rmsePersistExact, 2);
    const gainOf = (a) =>
      a.rmse == null || persist.rmse == null
        ? null
        : round((100 * (persist.rmse - a.rmse)) / persist.rmse, 2);

    // khoảng tin cậy thô cho corrTendency: gộp theo KHỐI rồi lấy se giữa các khối
    const byBlock = new Map();
    for (const { block, r } of L.tendPearson) {
      if (!Number.isFinite(r)) continue;
      if (!byBlock.has(block)) byBlock.set(block, []);
      byBlock.get(block).push(r);
    }
    const blockMeans = [...byBlock.values()].map(meanOf);
    const nb = blockMeans.length;
    const mean = meanOf(blockMeans);
    const se = nb >= 2 ? sdOf(blockMeans) / Math.sqrt(nb) : NaN;
    const half = Number.isFinite(se) ? t95(nb - 1) * se : NaN;

    const shufMean = meanOf(L.shufPearson.map((x) => x.r));

    // ── α tối ưu bị NGHI OVERFIT (fit hậu nghiệm trên chính dữ liệu chấm điểm).
    // Chấm lại kiểu LEAVE-ONE-BLOCK-OUT: α fit trên các khối KHÁC, áp vào khối
    // đang giữ lại. Đây mới là con số dám dùng để quyết.
    const bs = [...L.byBlockSums.values()];
    let cvSE = 0;
    let cvSoo = 0;
    let cvN = 0;
    const alphaByBlock = [];
    for (const b of bs) {
      if (b.Scc > 0) alphaByBlock.push(round(b.Sco / b.Scc, 3));
      const outScc = L.Scc - b.Scc;
      const outSco = L.Sco - b.Sco;
      if (!(outScc > 0) || b.n === 0) continue;
      const aCv = outSco / outScc;
      cvSE += aCv * aCv * b.Scc - 2 * aCv * b.Sco + b.Soo;
      cvSoo += b.Soo;
      cvN += b.n;
    }
    const rmseCv = cvN ? Math.sqrt(cvSE / cvN) : NaN;
    const rmsePersistCv = cvN ? Math.sqrt(cvSoo / cvN) : NaN;
    const gainOptCvPct = round((100 * (rmsePersistCv - rmseCv)) / rmsePersistCv, 2);

    return {
      lead: idx + 1,
      rmsePred: round(rmsePredExact),
      rmsePersist: round(rmsePersistExact),
      gainPct,
      /** giảm chấn TỐI ƯU hậu nghiệm — cận trên của cận trên (NGHI overfit) */
      alphaOpt: round(alphaOpt, 3),
      rmsePredOptimalDamping: round(rmsePredOpt),
      gainOptPct,
      /** α fit trên các KHỐI KHÁC rồi áp vào khối giữ lại — số dám dùng để quyết */
      gainOptCvPct,
      alphaByBlock,
      corrPred: pred.corr,
      corrPersist: persist.corr,
      frontCorrPred: pred.frontCorr,
      frontCorrPersist: persist.frontCorr,
      /** ★ CHỈ SỐ CỐT LÕI — Copernicus có biết hướng đổi không */
      corrTendency: {
        pearson: round(mean),
        ci95: [round(mean - half), round(mean + half)],
        /** không trừ trung bình — đại lượng QUYẾT ĐỊNH gain của phép neo */
        uncentered: round(rUnc),
        /** biên độ xu hướng mô hình / biên độ xu hướng thật */
        amplitudeRatio: round(L.Soo > 0 ? Math.sqrt(L.Scc / L.Soo) : NaN, 3),
        nBlocks: nb,
      },
      sanity: {
        noise: { rmse: noise.rmse, gainPct: gainOf(noise) },
        shuffled: {
          rmse: shuffled.rmse,
          gainPct: gainOf(shuffled),
          corrTendency: round(shufMean),
        },
      },
      n: L.nPairs,
      nCells: n,
      dof: L.blocksSeen.size,
      beatsPersistence: Number.isFinite(gainPct) ? gainPct > 0 : false,
      beatsPersistenceOptimalDamping: Number.isFinite(gainOptPct) ? gainOptPct > 0 : false,
      beatsPersistenceOptimalDampingCv: Number.isFinite(gainOptCvPct)
        ? gainOptCvPct > 0
        : false,
    };
  });
}

/* ---------------------------------------------------------------------------
   IN BẢNG
--------------------------------------------------------------------------- */

function printTable(name, rows) {
  console.log(`\n──────── ${name} — neo vệ tinh + xu hướng Copernicus ────────`);
  console.log(
    "lead | rmsePred rmsePersist |  gain% | gOpt% gOptCV%     α | corrPred/Persist | frontPred/Pers | corrTend  ci95            | SANITY shuf g%/corr | noise g% |  n dof",
  );
  for (const r of rows) {
    const f = (x, w = 6) => String(x ?? "—").padStart(w);
    const ct = r.corrTendency;
    console.log(
      `  ${String(r.lead).padStart(2)} | ${f(r.rmsePred)} ${f(r.rmsePersist, 11)} | ` +
        `${f(r.gainPct)} | ${f(r.gainOptPct, 5)} ${f(r.gainOptCvPct, 6)} ${f(r.alphaOpt, 5)} | ` +
        `${f(r.corrPred)}/${f(r.corrPersist)} | ${f(r.frontCorrPred)}/${f(r.frontCorrPersist)} | ` +
        `${f(ct.pearson)} [${f(ct.ci95[0])},${f(ct.ci95[1])}] | ` +
        `${f(r.sanity.shuffled.gainPct)}/${f(r.sanity.shuffled.corrTendency)} | ` +
        `${f(r.sanity.noise.gainPct)} | ${String(r.n).padStart(2)} ${r.dof}`,
    );
  }
}

/* ---------------------------------------------------------------------------
   MAIN
--------------------------------------------------------------------------- */

async function main() {
  const generatedAt = new Date().toISOString();
  const blocks = buildBlocks();
  console.log(
    `Khối ngày khởi tạo: ${blocks.length} khối × ${BLOCK_LEN} ngày — ` +
      blocks.map((b) => `${b[0]}..${b.at(-1)}`).join(", "),
  );

  const chl = await measure("chl", blocks);
  const sst = await measure("sst", blocks);
  const phyc = WITH_PHYC ? await measure("chl", blocks, "phyc") : null;

  printTable("CHL (log10 mg/m³)", chl);
  printTable("SST (°C)", sst);
  if (phyc) printTable("PHYC→CHL (gián tiếp, chỉ đọc corrTendency)", phyc);

  const result = {
    generatedAt,
    question:
      "Copernicus có biết XU HƯỚNG (cái gì đang đổi, đổi hướng nào) không — kể cả khi " +
      "giá trị tuyệt đối của nó lệch? Đo bằng dự báo NEO: pred(D+k) = obs_sat(D) + " +
      "[cop(D+k) − cop(D)], so với persistence = obs_sat(D), sự thật = obs_sat(D+k).",
    verdictHeadline: null, // điền bên dưới
    honestyWarnings: {
      analysisIsOptimisticUpperBound:
        "TỐI QUAN TRỌNG: kho ARCO/native công khai của Copernicus GHI ĐÈ dự báo cũ bằng " +
        "bản tin mới (mỗi ngày hiệu lực chỉ còn MỘT file; trục Zarr không có " +
        "forecast_reference_time). Vì D+k ở đây đều trong QUÁ KHỨ, `cop(D+k)` là " +
        "ANALYSIS đã đồng hoá quan trắc của chính ngày đó — KHÔNG phải dự báo phát ngày " +
        "D. ⇒ Mọi `gain`/`corrTendency` trong file này là CẬN TRÊN LẠC QUAN của kỹ năng " +
        "dự báo thật. Cận trên VẪN THUA persistence ⇒ kết luận ÂM chắc chắn. Cận trên " +
        "THẮNG ⇒ chỉ đủ để nói 'đáng đo tiếp bằng snapshot dự báo thật', CHƯA đủ để hứa.",
      whyThisDiffersFromTheAbsoluteBacktest:
        "copernicus-skill-backtest.mjs so GIÁ TRỊ TUYỆT ĐỐI (chl mô hình vs chl vệ tinh) " +
        "→ lệch ~0,33 log10 (hệ số ~2,1×) do NEMO-PISCES lệch hệ thống ở ven bờ đục. " +
        "Phép đo này TRỪ hiệu nên bias triệt tiêu (trên log10, hiệu = tỉ số ⇒ triệt tiêu " +
        "cả bias nhân). Hai phép đo trả lời HAI câu hỏi khác nhau: 'giá trị có đúng " +
        "không' vs 'xu hướng có đúng không'.",
      dofCaveat:
        `Trường biển tự tương quan ~0,97/ngày ⇒ ${BLOCK_LEN} ngày liên tiếp trong một ` +
        `khối KHÔNG cho ${BLOCK_LEN} mẫu độc lập. dof thời gian thực tế ≈ số KHỐI ` +
        `(${blocks.length}), không phải số cặp ngày (n). ci95 của corrTendency tính trên ` +
        "trung bình TỪNG KHỐI với t-Student df = số khối − 1 — vẫn rộng. Đừng tuyên bố " +
        "mạnh khi chênh lệch nhỏ.",
      chlTruthCaveat:
        "Sự thật của chl là ảnh DINEOF đã VÁ MÂY bằng nội suy EOF có thành phần THỜI " +
        "GIAN ⇒ chuỗi ảnh bị làm TRƠN theo ngày. Điều này làm xu hướng quan trắc " +
        "(obs(D+k) − obs(D)) nhỏ và trơn hơn xu hướng chl thật, nên vừa (i) giúp " +
        "persistence, vừa (ii) làm khó bất kỳ mô hình nào khớp được xu hướng đó. " +
        "Đọc `corrTendency.amplitudeRatio` để biết biên độ hai bên lệch bao nhiêu.",
      shuffledControlMeaning:
        "`sanity.shuffled` thay xu hướng Copernicus bằng xu hướng của MỘT ngày khởi tạo " +
        "KHÁC (cùng tầm, lệch ≥5 ngày, cùng lưới). Nó giữ nguyên biên độ + cấu trúc " +
        "không gian và chỉ phá đồng bộ thời gian. Nếu `shuffled` cũng thắng thì cái đo " +
        "được KHÔNG phải kỹ năng dự báo mà là khí hậu/mùa/hình học bờ — pipeline rò rỉ.",
      noiseControlMeaning:
        "`sanity.noise` thay xu hướng bằng nhiễu Gauss TRẮNG cùng RMS. Đây là kiểm tra " +
        "tối thiểu: gain phải ≈ 0 hoặc ÂM. Gain dương ở đây = pipeline hỏng, mọi số khác " +
        "vô nghĩa.",
      zoocNotAvailable:
        "`zooc` (động vật phù du) KHÔNG có trong GLOBAL_ANALYSISFORECAST_BGC_001_028 — " +
        "đã liệt kê biến của kho: chỉ `chl` và `phyc`. zooc chỉ có ở bộ tái phân tích " +
        "GLOBAL_MULTIYEAR_BGC (không có phần dự báo ⇒ vô dụng cho bản đồ 10 ngày). " +
        "Thay bằng `phyc` (sinh khối thực vật phù du) và CHỈ chấm GIÁN TIẾP: tương quan " +
        "xu hướng phyc với xu hướng chl QUAN TRẮC — không có ảnh vệ tinh phyc làm sự thật.",
    },
    method:
      "Với mỗi cặp (D, k=1..9) trong mỗi khối: pred(D+k) = obs(D) + [cop(D+k) − cop(D)]; " +
      "persist(D+k) = obs(D); sự thật = obs(D+k). MASK CHUNG bắt buộc — ô chỉ được chấm " +
      "khi obs(D), obs(D+k), cop(D), cop(D+k) đều hữu hạn; pred và persist chấm trên đúng " +
      "cùng tập ô. chl/phyc trên log10, SST trên °C. Copernicus đưa về lưới quan trắc " +
      "bằng láng giềng gần nhất (bỏ nếu lệch >0,35°). corrPred/corrPersist = trung bình " +
      "tương quan KHÔNG GIAN từng cặp ngày. frontCorr = tương quan của |gradient| (mirror " +
      "gradientStrength() trong fish-predict, KHÔNG kẹp [0,1]). RMSE tính đại số từ tổng " +
      "gộp Σcc/Σco/Σoo nên chính xác tuyệt đối trên mask chung. ERDDAP snap sang ngày gần " +
      "nhất khi ngày xin trống → mọi lưới bị kiểm ngày, lệch là vứt.",
    algebra:
      "c = cop(D+k)−cop(D), o = obs(D+k)−obs(D). rmsePersist = √(Σoo/n); " +
      "rmsePred = √((Σcc−2Σco+Σoo)/n) ⇒ neo THẮNG ⇔ Σco > Σcc/2. " +
      "alphaOpt = Σco/Σcc; rmsePredOptimalDamping = rmsePersist·√(1−r_uncentered²).",
    sources: {
      obsChl: "NOAA ERDDAP noaacwNPPN20VIIRSDINEOFDaily (chlor_a, mg/m³, DINEOF vá mây)",
      obsSst: "NOAA ERDDAP noaacwBLENDEDsstDaily (analysed_sst, Kelvin → °C)",
      copChl:
        "GLOBAL_ANALYSISFORECAST_BGC_001_028 / cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m (timeChunked.zarr)",
      copSst:
        "GLOBAL_ANALYSISFORECAST_PHY_001_024 / cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m (downsampled4.zarr)",
      copPhyc: "cùng kho với copChl, biến `phyc` (mmol/m³ C)",
    },
    window: {
      blocks: blocks.map((b) => ({ from: b[0], to: b.at(-1) })),
      blockLenDays: BLOCK_LEN,
      blockGapDays: BLOCK_GAP,
      maxLead: MAX_LEAD,
      dofEstimate: blocks.length,
    },
    perLead: { chl, sst, ...(phyc ? { phycIndirect: phyc } : {}) },
  };

  const wins = (rows) => rows.filter((r) => r.beatsPersistence).map((r) => r.lead);
  const winsOpt = (rows) =>
    rows.filter((r) => r.beatsPersistenceOptimalDamping).map((r) => r.lead);
  const winsCv = (rows) =>
    rows.filter((r) => r.beatsPersistenceOptimalDampingCv).map((r) => r.lead);
  const headline = (rows) => ({
    /** neo THÔ (α = 1): cộng thẳng xu hướng mô hình */
    leadsWhereAnchoredBeatsPersistence: wins(rows),
    /** neo có giảm chấn α fit hậu nghiệm — NGHI overfit */
    leadsWhereOptimalDampingBeats: winsOpt(rows),
    /** neo có giảm chấn α fit LEAVE-ONE-BLOCK-OUT — số dám dùng */
    leadsWhereOptimalDampingBeatsCrossValidated: winsCv(rows),
    /** gain CV lớn nhất đạt được và ở tầm nào */
    bestCvGainPct: Math.max(...rows.map((r) => r.gainOptCvPct ?? -Infinity)),
  });
  result.verdictHeadline = {
    chl: headline(chl),
    sst: headline(sst),
    readAs:
      "Đây là CẬN TRÊN (cop(D+k) là analysis đã đồng hoá quan trắc ngày đó). Tầm nào " +
      "KHÔNG có trong danh sách ⇒ kết luận ÂM chắc chắn cho tầm đó. Tầm CÓ trong danh " +
      "sách ⇒ chỉ đủ để nói 'đáng đo tiếp bằng snapshot dự báo thật', CHƯA đủ để hứa.",
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\n✓ Ghi ${OUT_PATH}`);

  console.log("\n──────── KẾT LUẬN (cận TRÊN lạc quan — cop(D+k) là ANALYSIS) ────────");
  for (const [name, rows] of [
    ["chl", chl],
    ["sst", sst],
  ]) {
    console.log(
      `  ${name}: neo thô (α=1) thắng ở tầm [${wins(rows).join(",") || "—"}] | ` +
        `giảm chấn hậu nghiệm [${winsOpt(rows).join(",") || "—"}] | ` +
        `giảm chấn CV (dám dùng) [${winsCv(rows).join(",") || "—"}]`,
    );
  }
}

main().catch((e) => {
  console.error("LỖI:", e);
  process.exitCode = 1;
});
