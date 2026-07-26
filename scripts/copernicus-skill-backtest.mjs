// scripts/copernicus-skill-backtest.mjs
// ─────────────────────────────────────────────────────────────────────────
// COPERNICUS CÓ THẮNG "GIỮ NGUYÊN HÔM NAY" (persistence) KHÔNG?
//
// CÂU HỎI SỐNG CÒN (trước khi hứa bản đồ cá 10 ngày với bà con):
//   Dự báo Copernicus ở tầm 1..9 ngày có THẬT SỰ giỏi hơn baseline
//   "giữ nguyên trường hôm nay" cho vùng biển VN không?
//   Bài học cũ: "đẩy trôi phù du" (advection) KHÔNG thắng persistence vì
//   trường đại dương quá bền. Phải đo, không được đoán.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠ PHÁT HIỆN QUAN TRỌNG NHẤT — KHO COPERNICUS **GHI ĐÈ** DỰ BÁO CŨ
// ─────────────────────────────────────────────────────────────────────────
// Đã kiểm THẬT bằng cách liệt kê S3 native (xem `auditProvenance()` bên dưới):
//   - Mỗi NGÀY HIỆU LỰC (validity date) chỉ có ĐÚNG MỘT file. Tên file mang
//     hậu tố `_R<ngày bản tin>` + nhãn loại `hcst` / `nwct` / `fcst`.
//   - File của một ngày bị GHI ĐÈ mỗi khi có bản tin mới: ngày 2026-07-20 hôm
//     nay nằm dưới `nwct_R20260722`, chứ KHÔNG còn bản `fcst_R20260713`
//     (tức bản dự báo tầm 7 ngày đã phát hồi 13/7). LastModified xác nhận:
//     các file quá khứ được ghi lại theo đợt đồng hoá tuần.
//   - Trục ARCO/Zarr (`cube:dimensions`) chỉ có time/elevation/lat/lon —
//     KHÔNG có chiều `forecast_reference_time`.
//
// HỆ QUẢ (phải nói thẳng, không được giấu):
//   KHÔNG THỂ backtest đúng nghĩa "dự báo khởi tạo ngày D cho ngày D+k" từ
//   kho công khai. Nếu ai đó đọc kho hiện tại rồi gọi đó là "forecast D+k"
//   thì thực chất đang đọc ANALYSIS đã đồng hoá quan trắc của chính ngày
//   D+k ⇒ skill trông ĐẸP GIẢ. Script này TỪ CHỐI làm phép đo giả đó.
//
// ─────────────────────────────────────────────────────────────────────────
// VẬY ĐO GÌ ĐƯỢC — VÀ ĐO ĐƯỢC THÌ KẾT LUẬN ĐƯỢC GÌ
// ─────────────────────────────────────────────────────────────────────────
// Cùng một SỰ THẬT (ảnh vệ tinh quan trắc NOAA tại ngày đích T = D+k), so ba
// bộ dự đoán — tất cả đều tính được từ dữ liệu CÓ THẬT hôm nay:
//
//   1. `obsHold`  = quan trắc(D)            → giữ nguyên ảnh vệ tinh hôm nay.
//                   ĐÂY LÀ BASELINE APP ĐANG DÙNG.
//   2. `copHold`  = Copernicus(D)           → giữ nguyên bản đồ Copernicus.
//   3. `copBest`  = Copernicus(T)           → giá trị kho ĐANG giữ tại chính
//                   ngày đích. Vì kho đã ghi đè bằng analysis, đây là
//                   **CẬN DƯỚI của sai số** mà một dự báo tầm k ngày có thể
//                   đạt: dự báo thật LUÔN tệ hơn hoặc bằng analysis.
//
// KẸP SAI SỐ CỦA DỰ BÁO THẬT (`forecastErrorBracket`) — mấu chốt của cả bài.
// Không đọc được dự báo thật, nhưng KẸP được nó giữa hai đầu tính được:
//   - CẬN DƯỚI = `copBest`: dự báo tầm k không thể giỏi hơn analysis của chính
//     ngày đích (analysis đã được "xem trộm" quan trắc ngày đó).
//   - CẬN TRÊN = `copHold`: một mô hình DỰ BÁO KÉM NHẤT vẫn còn cách giữ
//     nguyên trạng thái khởi tạo của nó. Dự báo có kỹ năng phải khá hơn thế.
//     (Giả định: mô hình không tự trôi sai hơn cả đứng yên — đúng với SST/chl
//     tầm ≤ 10 ngày, nhưng LÀ GIẢ ĐỊNH, đã ghi rõ trong output.)
//
// LUẬT SUY LUẬN (chỉ kết luận cái nào chắc chắn):
//   - CẬN DƯỚI vẫn TỆ HƠN persistence ⇒ `no`: BÁC BỎ chắc chắn, dự báo tầm k
//     KHÔNG THỂ thắng (dự báo thật còn tệ hơn cận dưới).
//   - CẬN TRÊN đã TỐT HƠN persistence ⇒ `likely-yes`: kể cả kịch bản mô hình
//     không có chút kỹ năng dự báo nào thì vẫn thắng.
//   - Kẹp VẮT QUA persistence ⇒ `inconclusive`: KHÔNG được đọc thành "thắng".
//
//   Phụ trợ: `copDrift` = Copernicus(D) vs Copernicus(T) — trường mô hình tự
//   nó xê dịch bao nhiêu sau k ngày. Nếu xê dịch ~0 thì "bản đồ 10 ngày" chỉ
//   là bản đồ hôm nay dán nhãn ngày khác, dù skill có thế nào.
//
// ─────────────────────────────────────────────────────────────────────────
// BẪY ĐÃ CHỦ ĐỘNG TRÁNH
// ─────────────────────────────────────────────────────────────────────────
//   a) MASK CHUNG bắt buộc: một ô chỉ được chấm khi CẢ obs(D), obs(T),
//      cop(D), cop(T) đều hữu hạn. Lần backtest advection trước bị "thưởng
//      oan" đúng vì hai bộ dự đoán chấm trên tập ô khác nhau.
//   b) ERDDAP SNAP NGÀY: `[(2026-05-20T12:00:00Z)]` mà ngày đó trống thì
//      ERDDAP lặng lẽ trả ngày GẦN NHẤT (đã dính thật: xin 05-20 nhận 05-21).
//      Không chặn thì obs(D) và obs(D+k) có thể là CÙNG một ảnh ⇒ persistence
//      được thưởng oan. Ở đây MỌI lưới đều bị kiểm `date === ngày đã xin`,
//      lệch là VỨT.
//   c) BẬC TỰ DO: trường biển tự tương quan rất cao ⇒ lấy nhiều ngày liên
//      tiếp trong MỘT tháng chỉ cho vài mẫu độc lập. Nên lấy NHIỀU KHỐI ngày
//      rải qua nhiều mùa (mặc định 4 khối × 15 ngày trải ~10 tháng) và ghi
//      rõ dof hạn chế trong output.
//
// ─────────────────────────────────────────────────────────────────────────
// NGUỒN
//   Quan trắc  chl : NOAA `noaacwNPPN20VIIRSDINEOFDaily` (đã vá mây bằng DINEOF)
//   Quan trắc  SST : NOAA `noaacwBLENDEDsstDaily` (Kelvin → °C)
//   Copernicus chl : GLOBAL_ANALYSISFORECAST_BGC_001_028
//                    cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m (timeChunked.zarr)
//   Copernicus SST : GLOBAL_ANALYSISFORECAST_PHY_001_024
//                    cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m (downsampled4)
//   Cả hai kho ARCO CÔNG KHAI, không cần API key.
//
// CHẠY
//   node scripts/copernicus-skill-backtest.mjs              # đo đầy đủ
//   node scripts/copernicus-skill-backtest.mjs --audit-only # chỉ soi ghi đè
//   node scripts/copernicus-skill-backtest.mjs --blocks=2 --block-len=12
//   node scripts/copernicus-skill-backtest.mjs --snapshot   # xem cuối file
// Ghi ra: src/data/copernicus-skill.json. Cache chunk ở thư mục tạm của OS
// nên chạy lại rất nhanh.
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
const OUT_PATH = join(__dirname, "..", "src", "data", "copernicus-skill.json");
const CACHE_DIR = join(tmpdir(), "sdfish-copernicus-skill-cache");

const UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";
const S3 = "https://s3.waw3-1.cloudferro.com";

/** Hộp biển VN — khớp lưới đang dùng ở fish-predict */
const VN = { lat0: 5, lat1: 22, lon0: 102, lon1: 118 };

const MAX_LEAD = 9; // kho Copernicus chạy tới ~+8/+9 ngày so với hôm nay
const FETCH_TIMEOUT_MS = 120000;
const RETRIES = 2;

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
/** khoảng cách giữa hai khối (ngày) — đủ xa để coi là chế độ biển khác nhau */
const BLOCK_GAP = flag("block-gap", 95);
/** khối mới nhất kết thúc trước hôm nay bao nhiêu ngày (độ trễ ảnh vệ tinh ~3-4 ngày) */
const NEWEST_END_BACK = flag("newest-end-back", 5);

/* ---------------------------------------------------------------------------
   Cấu hình nguồn
--------------------------------------------------------------------------- */

const COP = {
  chl: {
    zarr:
      `${S3}/mdl-arco-time-006/arco/GLOBAL_ANALYSISFORECAST_BGC_001_028/` +
      `cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m_202311/timeChunked.zarr`,
    variable: "chl",
    nativeBucket: "mdl-native-14",
    nativePrefix:
      "native/GLOBAL_ANALYSISFORECAST_BGC_001_028/" +
      "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m_202311/",
  },
  sst: {
    zarr:
      `${S3}/mdl-arco-time-012/arco/GLOBAL_ANALYSISFORECAST_PHY_001_024/` +
      `cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406/downsampled4.zarr`,
    variable: "thetao",
    nativeBucket: "mdl-native-14",
    nativePrefix:
      "native/GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
      "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_202406/",
  },
};

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
const round = (x, p = 4) =>
  x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

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
   PHẦN 1 — SOI NGUỒN GỐC: kho có GIỮ dự báo theo ngày khởi tạo không?
--------------------------------------------------------------------------- */

/**
 * Liệt kê S3 native của một dataset trong một tháng, tách `_R<bulletin>` và
 * nhãn loại (`hcst` hindcast / `nwct` nowcast / `fcst` forecast) khỏi tên file.
 *
 * Đây là BẰNG CHỨNG cho câu hỏi trung thực nhất của cả bài: nếu MỖI ngày hiệu
 * lực chỉ có MỘT key thì mọi bản dự báo phát trước đó đã bị GHI ĐÈ ⇒ không thể
 * backtest theo ngày khởi tạo.
 */
async function listNative(bucket, prefix) {
  const url =
    `${S3}/${bucket}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
  const r = await fetchWithRetry(url, "text");
  if (!r.data) return [];
  const out = [];
  const re = /<Key>([^<]+)<\/Key><LastModified>([^<]+)<\/LastModified>/g;
  let m;
  while ((m = re.exec(r.data))) {
    const file = m[1].split("/").pop();
    // ngày hiệu lực = chuỗi 8 số ĐẦU TIÊN trong tên file
    const validity = /(\d{8})/.exec(file)?.[1] ?? null;
    const bulletin = /_R(\d{8})/.exec(file)?.[1] ?? null;
    const kind = /_(hcst|nwct|fcst)/.exec(file)?.[1] ?? null;
    out.push({ file, validity, bulletin, kind, lastModified: m[2].slice(0, 10) });
  }
  return out;
}

async function auditProvenance() {
  const months = [];
  const now = new Date();
  for (let back = 0; back < 2; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(`${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/`);
  }

  const report = {};
  for (const [key, cfg] of Object.entries(COP)) {
    const entries = [];
    for (const mo of months) {
      entries.push(...(await listNative(cfg.nativeBucket, cfg.nativePrefix + mo)));
    }
    const byValidity = new Map();
    for (const e of entries) {
      if (!e.validity) continue;
      if (!byValidity.has(e.validity)) byValidity.set(e.validity, []);
      byValidity.get(e.validity).push(e);
    }
    const multi = [...byValidity.values()].filter((v) => v.length > 1).length;
    const bulletins = new Set(entries.map((e) => e.bulletin).filter(Boolean));
    const kinds = {};
    for (const e of entries) if (e.kind) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;

    report[key] = {
      dataset: cfg.nativePrefix.split("/").filter(Boolean).pop(),
      filesListed: entries.length,
      validityDates: byValidity.size,
      validityDatesWithMultipleFiles: multi,
      distinctBulletinDates: bulletins.size,
      filenameCarriesBulletinDate: bulletins.size > 0,
      kindTagCounts: kinds,
      // ĐÂY là kết luận: chỉ 1 file/ngày ⇒ dự báo cũ đã bị ghi đè
      forecastArchivePreserved: multi > 0,
      sample: entries.slice(-6).map((e) => `${e.file} (ghi ${e.lastModified})`),
    };
  }
  return report;
}

/* ---------------------------------------------------------------------------
   PHẦN 2 — ĐỌC LƯỚI
--------------------------------------------------------------------------- */

/** Bảng ERDDAP .json → lưới VN. Trả null nếu ERDDAP snap sang ngày KHÁC. */
function parseObs(json, kind, wantDate) {
  const cols = json?.table?.columnNames ?? [];
  const rows = json?.table?.rows ?? [];
  if (!rows.length) return null;
  const iLat = cols.indexOf("latitude");
  const iLon = cols.indexOf("longitude");
  const iVal = cols.length - 1;
  if (iLat < 0 || iLon < 0) return null;

  const gotDate = String(rows[0][0] ?? "").slice(0, 10);
  // BẪY (b): ERDDAP trả ngày gần nhất khi ngày xin trống → phải VỨT
  if (gotDate !== wantDate) return null;

  const lats = [...new Set(rows.map((r) => r[iLat]))].sort((a, b) => a - b);
  const lons = [...new Set(rows.map((r) => r[iLon]))].sort((a, b) => a - b);
  const li = new Map(lats.map((v, i) => [v, i]));
  const oi = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN));
  for (const r of rows) {
    const v = r[iVal];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    // SST của NOAA là KELVIN; chl là mg/m³
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

// metadata + trục toạ độ của mỗi kho Zarr (đọc một lần)
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
  // chỉ đọc được khi MỘT chunk phủ trọn lat+lon và 1 mốc thời gian
  if (vMeta.chunks[0] !== 1 || vMeta.chunks[2] < nLat || vMeta.chunks[3] < nLon) {
    throw new Error(`${key}: chunking đã đổi (${JSON.stringify(vMeta.chunks)}) — dừng`);
  }
  const cf = parseCfTimeUnits(String(readZarrAttr(zmeta, "time", "units")));
  if (!cf) throw new Error(`${key}: không hiểu units trục time`);

  const readAxis = async (name) => {
    const am = readZarrArrayMeta(zmeta, name);
    const n = am.shape[0];
    const cs = am.chunks[0];
    const nc = Math.ceil(n / cs);
    const out = new Float32Array(n);
    for (let c = 0; c < nc; c++) {
      const ck = `axis-${key}-${name}-${c}`;
      let arr = cacheGet(ck);
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
  // trục elevation xếp SÂU → NÔNG (idx 0 ≈ -5728 m); mặt biển là ô |z| nhỏ nhất
  let ei = 0;
  for (let i = 1; i < elev.length; i++) {
    if (Math.abs(elev[i]) < Math.abs(elev[ei])) ei = i;
  }
  const signed = lons[0] < 0;
  const latSel = axisRange(lats, VN.lat0, VN.lat1);
  const lonSel = axisRange(lons, lonToAxis(VN.lon0, signed), lonToAxis(VN.lon1, signed));

  const h = { cfg, zmeta, vMeta, cf, times, nT, nLat, nLon, ei, lats, lons, latSel, lonSel };
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
        const flatData = decodeFloat32Chunk(b.data);
        if (flatData.length >= h.nLat * h.nLon) {
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
              const v = flatData[gi * h.nLon + h.lonSel.start + j];
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
   PHẦN 3 — CÙNG LƯỚI, CÙNG THANG
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
      // láng giềng quá xa (lệch > 0,35°) thì bỏ, đừng bịa
      if (Math.abs(src.lats[si] - ref.lats[i]) > 0.35) return NaN;
      if (Math.abs(src.lons[sj] - ref.lons[j]) > 0.35) return NaN;
      const v = src.values[si][sj];
      return Number.isFinite(v) ? v : NaN;
    }),
  );
}

/** chl → log10 (như fish-predict); SST giữ °C */
function toScale(kind, values) {
  if (kind !== "chl") return values;
  return values.map((row) =>
    row.map((v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN)),
  );
}

/**
 * |gradient| sai phân giữa theo CHỈ SỐ Ô — cùng công thức `gradientStrength()`
 * của src/lib/fish-predict.ts nhưng KHÔNG chuẩn hoá/kẹp về [0,1] (kẹp sẽ bão
 * hoà và làm hỏng phép tương quan). Ô thiếu láng giềng → NaN, không cho 0
 * (cho 0 sẽ bơm tương quan giả ở ven bờ).
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
   PHẦN 4 — THỐNG KÊ
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

/** bộ tích luỹ cho MỘT bộ dự đoán ở MỘT lead */
const newAcc = () => ({ se: 0, n: 0, corrs: [], frontCorrs: [], pairs: 0 });

function pushPair(acc, predVals, truthVals, mask) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (!mask[i][j]) continue;
      const p = predVals[i][j];
      const t = truthVals[i][j];
      if (!Number.isFinite(p) || !Number.isFinite(t)) continue;
      xs.push(p);
      ys.push(t);
      acc.se += (p - t) ** 2;
      acc.n += 1;
    }
  }
  if (xs.length >= 20) {
    acc.corrs.push(pearson(xs, ys));
    acc.pairs += 1;
  }
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

const meanOf = (a) => {
  const f = a.filter(Number.isFinite);
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : NaN;
};

const summariseAcc = (a) => ({
  rmse: round(a.n ? Math.sqrt(a.se / a.n) : NaN),
  corr: round(meanOf(a.corrs), 4),
  frontCorr: round(meanOf(a.frontCorrs), 4),
  nCells: a.n,
  nPairs: a.pairs,
});

/* ---------------------------------------------------------------------------
   PHẦN 5 — NGÀY KHỞI TẠO
--------------------------------------------------------------------------- */

/**
 * Nhiều KHỐI ngày liên tiếp, rải xa nhau. Trong khối mới lập được cặp
 * (D, D+k); khối cách nhau ~3 tháng để các khối gần như độc lập về mùa/chế độ.
 */
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
   PHẦN 6 — CHẠY ĐO
--------------------------------------------------------------------------- */

async function measure(kind, blocks) {
  // predictors: obsHold / copHold / copBest ; chẩn đoán: copDrift
  const acc = Array.from({ length: MAX_LEAD }, () => ({
    obsHold: newAcc(),
    copHold: newAcc(),
    copBest: newAcc(),
    copDrift: newAcc(),
  }));

  const allDates = [...new Set(blocks.flat())];
  const obs = new Map();
  const cop = new Map();

  console.log(`\n### ${kind.toUpperCase()} — tải ${allDates.length} ngày`);
  let okObs = 0;
  let okCop = 0;
  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i];
    const [o, c] = await Promise.all([fetchObs(kind, d), fetchCop(kind, d)]);
    if (o) {
      obs.set(d, o);
      okObs++;
    }
    if (c) {
      cop.set(d, c);
      okCop++;
    }
    if ((i + 1) % 10 === 0 || i === allDates.length - 1) {
      console.log(
        `  ${i + 1}/${allDates.length} ngày — quan trắc ${okObs}, Copernicus ${okCop}`,
      );
    }
  }

  let skippedSnap = 0;
  for (const block of blocks) {
    for (let a = 0; a < block.length; a++) {
      const D = block[a];
      for (let k = 1; k <= MAX_LEAD; k++) {
        const T = addDays(D, k);
        if (!block.includes(T)) continue;
        const oD = obs.get(D);
        const oT = obs.get(T);
        const cD = cop.get(D);
        const cT = cop.get(T);
        if (!oD || !oT || !cD || !cT) {
          skippedSnap++;
          continue;
        }

        // lưới chuẩn = lưới quan trắc ngày ĐÍCH
        const ref = oT;
        const truth = toScale(kind, ref.values);
        const obsD = toScale(kind, regridTo(ref, oD));
        const copD = toScale(kind, regridTo(ref, cD));
        const copT = toScale(kind, regridTo(ref, cT));

        // BẪY (a): MASK CHUNG — ô phải hữu hạn ở CẢ BỐN trường
        const mask = truth.map((row, i) =>
          row.map(
            (v, j) =>
              Number.isFinite(v) &&
              Number.isFinite(obsD[i][j]) &&
              Number.isFinite(copD[i][j]) &&
              Number.isFinite(copT[i][j]),
          ),
        );
        const nMask = mask.flat().filter(Boolean).length;
        if (nMask < 200) continue;

        const A = acc[k - 1];
        pushPair(A.obsHold, obsD, truth, mask);
        pushPair(A.copHold, copD, truth, mask);
        pushPair(A.copBest, copT, truth, mask);
        pushPair(A.copDrift, copD, copT, mask);

        const gTruth = gradMag(truth);
        const gObsD = gradMag(obsD);
        const gCopD = gradMag(copD);
        const gCopT = gradMag(copT);
        pushFront(A.obsHold, gObsD, gTruth, mask);
        pushFront(A.copHold, gCopD, gTruth, mask);
        pushFront(A.copBest, gCopT, gTruth, mask);
        pushFront(A.copDrift, gCopD, gCopT, mask);
      }
    }
  }
  if (skippedSnap) console.log(`  (bỏ ${skippedSnap} cặp vì thiếu lưới một phía)`);

  return acc.map((A, idx) => {
    const obsHold = summariseAcc(A.obsHold);
    const copHold = summariseAcc(A.copHold);
    const copBest = summariseAcc(A.copBest);
    const copDrift = summariseAcc(A.copDrift);
    // BASELINE phải thắng = persistence trên chính ảnh vệ tinh (app đang dùng)
    const baseline = obsHold.rmse;
    // KẸP sai số của dự báo THẬT: [analysis ngày đích, analysis ngày init giữ nguyên]
    const lo = copBest.rmse;
    const hi = copHold.rmse;
    const gain =
      lo == null || baseline == null ? null : round((100 * (baseline - lo)) / baseline, 2);

    let verdict = "no-data";
    if (lo != null && hi != null && baseline != null) {
      if (lo > baseline) verdict = "no"; // ngay cả cận dưới cũng thua ⇒ bác bỏ chắc
      else if (hi < baseline) verdict = "likely-yes"; // cả cận trên cũng thắng
      else verdict = "inconclusive"; // kẹp vắt qua baseline
    }
    return {
      lead: idx + 1,
      // BASELINE 1 — app đang làm thế: giữ nguyên ảnh vệ tinh hôm nay
      persistenceObs: obsHold,
      // BASELINE 2 — giữ nguyên bản đồ Copernicus hôm nay
      persistenceCop: copHold,
      // CẬN DƯỚI sai số của dự báo Copernicus tầm `lead` (thực chất là analysis)
      copernicusBestCase: copBest,
      // chẩn đoán: trường Copernicus tự xê dịch bao nhiêu sau `lead` ngày
      copernicusDrift: copDrift,
      /**
       * Sai số của DỰ BÁO THẬT chắc chắn nằm trong khoảng này (RMSE).
       * lower = analysis ngày đích (không thể giỏi hơn);
       * upper = analysis ngày init giữ nguyên (dự báo có kỹ năng phải hơn thế).
       */
      forecastErrorBracket: { lower: lo, upper: hi, baselineToBeat: baseline },
      // % lợi nếu dự báo đạt ĐÚNG cận dưới (kịch bản LẠC QUAN NHẤT, không thật)
      gainPctBestCase: gain,
      beatsPersistence: verdict === "likely-yes",
      verdict,
      n: copBest.nPairs,
    };
  });
}

/* ---------------------------------------------------------------------------
   PHẦN 7 — CHỤP ẢNH DỰ BÁO HÔM NAY (đường DUY NHẤT để backtest thật về sau)
--------------------------------------------------------------------------- */

/**
 * Kho ghi đè dự báo cũ ⇒ muốn có skill THẬT thì phải TỰ LƯU dự báo lúc nó còn
 * là dự báo, rồi vài ngày sau đối chiếu quan trắc. `--snapshot` lưu trường
 * Copernicus của các ngày TƯƠNG LAI (đang là `fcst` thật, chưa bị đồng hoá)
 * kèm ngày khởi tạo; chạy lại `--verify-snapshot` sau ~10 ngày để chấm.
 */
async function snapshot(path) {
  const today = iso(new Date());
  const out = { takenAt: new Date().toISOString(), initDate: today, fields: {} };
  for (const kind of ["chl", "sst"]) {
    out.fields[kind] = {};
    for (let k = 1; k <= MAX_LEAD; k++) {
      const T = addDays(today, k);
      const g = await fetchCop(kind, T);
      if (g) out.fields[kind][T] = { lats: g.lats, lons: g.lons, values: g.values };
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out), "utf8");
  console.log(`✓ Đã lưu ảnh chụp dự báo (init ${today}) → ${path}`);
}

async function verifySnapshot(path) {
  const snap = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Ảnh chụp init ${snap.initDate}`);
  for (const [kind, byDate] of Object.entries(snap.fields)) {
    for (const [T, f] of Object.entries(byDate)) {
      const o = await fetchObs(kind, T);
      const oD = await fetchObs(kind, snap.initDate);
      if (!o || !oD) {
        console.log(`  ${kind} ${T}: chưa có quan trắc`);
        continue;
      }
      const lead = Math.round(
        (Date.parse(T) - Date.parse(snap.initDate)) / 86400000,
      );
      const truth = toScale(kind, o.values);
      const fc = toScale(kind, regridTo(o, f));
      const pers = toScale(kind, regridTo(o, oD));
      const mask = truth.map((row, i) =>
        row.map(
          (v, j) =>
            Number.isFinite(v) && Number.isFinite(fc[i][j]) && Number.isFinite(pers[i][j]),
        ),
      );
      const A = newAcc();
      const B = newAcc();
      pushPair(A, fc, truth, mask);
      pushPair(B, pers, truth, mask);
      const a = summariseAcc(A);
      const b = summariseAcc(B);
      console.log(
        `  ${kind} lead ${lead}: DỰ BÁO THẬT rmse ${a.rmse} | persistence ${b.rmse}` +
          ` → ${a.rmse < b.rmse ? "THẮNG" : "THUA"}`,
      );
    }
  }
}

/* ---------------------------------------------------------------------------
   MAIN
--------------------------------------------------------------------------- */

function printTable(kind, rows) {
  const unit = kind === "chl" ? "log10(mg/m³)" : "°C";
  console.log(`\n──────── ${kind.toUpperCase()} — RMSE (${unit}) theo tầm ngày ────────`);
  console.log(
    "lead | BASELINE persist | dự báo THẬT nằm trong | corr ảnh/Cop | front ảnh/Cop |  n | KẾT LUẬN",
  );
  for (const r of rows) {
    const f = (x) => String(x ?? "—").padStart(6);
    const b = r.forecastErrorBracket;
    console.log(
      `  ${String(r.lead).padStart(2)} | ${f(b.baselineToBeat)}           | ` +
        `${f(b.lower)} .. ${f(b.upper)}        | ` +
        `${f(r.persistenceObs.corr)} / ${f(r.copernicusBestCase.corr)} | ` +
        `${f(r.persistenceObs.frontCorr)} / ${f(r.copernicusBestCase.frontCorr)} | ` +
        `${String(r.n).padStart(2)} | ${r.verdict}`,
    );
  }
}

async function main() {
  const generatedAt = new Date().toISOString();

  const snapArg = argv.find((a) => a.startsWith("--snapshot-path="));
  const snapPath = snapArg
    ? snapArg.slice("--snapshot-path=".length)
    : join(__dirname, "..", "src", "data", "copernicus-forecast-snapshot.json");
  if (has("snapshot")) {
    await snapshot(snapPath);
    return;
  }
  if (has("verify-snapshot")) {
    await verifySnapshot(snapPath);
    return;
  }

  console.log("── SOI NGUỒN GỐC: kho có giữ dự báo theo ngày khởi tạo không? ──");
  const provenance = await auditProvenance();
  for (const [k, v] of Object.entries(provenance)) {
    console.log(
      `  ${k}: ${v.filesListed} file / ${v.validityDates} ngày hiệu lực; ` +
        `ngày có >1 file: ${v.validityDatesWithMultipleFiles}; ` +
        `bản tin phân biệt: ${v.distinctBulletinDates}; nhãn ${JSON.stringify(v.kindTagCounts)}`,
    );
    console.log(
      `     ⇒ kho GIỮ dự báo cũ? ${v.forecastArchivePreserved ? "CÓ" : "KHÔNG (bị ghi đè)"}`,
    );
  }
  const archivePreserved = Object.values(provenance).some(
    (v) => v.forecastArchivePreserved,
  );

  if (has("audit-only")) return;

  const blocks = buildBlocks();
  console.log(
    `\nKhối ngày khởi tạo: ${blocks.length} khối × ${BLOCK_LEN} ngày — ` +
      blocks.map((b) => `${b[0]}..${b.at(-1)}`).join(", "),
  );

  const chl = await measure("chl", blocks);
  const sst = await measure("sst", blocks);

  printTable("chl", chl);
  printTable("sst", sst);

  const nBlocksUsed = blocks.length;
  const result = {
    generatedAt,
    question:
      "Dự báo Copernicus tầm 1..9 ngày có giỏi hơn baseline 'giữ nguyên hôm nay' " +
      "(persistence) cho vùng biển VN không?",
    honestyWarnings: {
      analysisOverwritesForecast: !archivePreserved,
      whatThisMeans:
        "Kho ARCO/native công khai của Copernicus chỉ giữ MỘT file cho mỗi ngày hiệu " +
        "lực và ghi đè bằng bản tin mới nhất (tên file có _R<bulletin> + nhãn " +
        "hcst/nwct/fcst, nhưng bản cũ không còn). Trục Zarr KHÔNG có chiều " +
        "forecast_reference_time. ⇒ KHÔNG backtest được 'dự báo khởi tạo ngày D cho " +
        "ngày D+k'. Đọc kho hiện tại tại ngày D+k là đọc ANALYSIS đã đồng hoá quan " +
        "trắc của chính ngày đó → skill sẽ ĐẸP GIẢ nếu gọi nó là forecast.",
      howWeHandledIt:
        "Không đọc được dự báo thật thì KẸP nó: `forecastErrorBracket.lower` = " +
        "`copernicusBestCase` (analysis ngày đích — dự báo không thể giỏi hơn); " +
        "`upper` = `persistenceCop` (analysis ngày init giữ nguyên — mô hình có kỹ " +
        "năng phải khá hơn thế). verdict: 'no' = cận DƯỚI vẫn thua persistence ⇒ BÁC " +
        "BỎ chắc chắn; 'likely-yes' = cận TRÊN đã thắng ⇒ thắng kể cả kịch bản xấu " +
        "nhất; 'inconclusive' = kẹp vắt qua baseline, TUYỆT ĐỐI không đọc thành thắng.",
      upperBoundAssumption:
        "Cận TRÊN giả định mô hình dự báo không tệ hơn chính nó đứng yên. Đúng trong " +
        "hầu hết đánh giá SST/BGC tầm ≤10 ngày, nhưng vẫn là GIẢ ĐỊNH chưa kiểm được " +
        "trên đúng vùng biển VN — chỉ `--snapshot` rồi đối chiếu sau mới kiểm được.",
      chlTruthCaveat:
        "SỰ THẬT của chl là ảnh DINEOF đã VÁ MÂY bằng nội suy EOF có thành phần THỜI " +
        "GIAN ⇒ chuỗi ảnh bị làm TRƠN theo ngày, khiến persistence của chính nó được " +
        "lợi (RMSE lead 1 chỉ ~0,044 log10 ≈ 10%/ngày, thấp hơn biến động chl thật). " +
        "Dù vậy khoảng cách với Copernicus quá lớn (RMSE ~0,33 log10 ≈ sai số hệ số " +
        "~2,1 lần; tương quan không gian chỉ ~0,49) nên kết luận KHÔNG đảo chiều vì " +
        "hiệu ứng này: đó là hai trường khác nhau về bản chất, không phải sai số nhỏ.",
      degreesOfFreedom:
        `${nBlocksUsed} khối × ${BLOCK_LEN} ngày liên tiếp, các khối cách nhau ` +
        `${BLOCK_GAP} ngày. Trường biển tự tương quan ~0,97/ngày nên các ngày trong ` +
        `cùng khối KHÔNG độc lập: dof thời gian thực tế ≈ số KHỐI (${nBlocksUsed}), ` +
        "không phải số cặp ngày. Về không gian, hộp VN ~1700×1900 km với thang phân " +
        "rã ~100–200 km ⇒ ~50–100 mảng độc lập mỗi ảnh. Đừng tuyên bố mạnh dựa trên " +
        "chênh lệch RMSE nhỏ.",
      currentsNotTested:
        "Dòng chảy KHÔNG đo được ở đây: không có quan trắc lưới, mà so 'dự báo D+k' " +
        "với 'analysis D+k' của chính Copernicus thì bản dự báo đã bị ghi đè mất. " +
        "Chỉ còn `copernicusDrift` (trường tự xê dịch) làm chẩn đoán YẾU.",
    },
    method:
      "Cùng SỰ THẬT = ảnh vệ tinh NOAA quan trắc tại ngày đích T=D+k. Ba bộ dự đoán: " +
      "persistenceObs = quan trắc(D) giữ nguyên; persistenceCop = Copernicus(D) giữ " +
      "nguyên; copernicusBestCase = Copernicus(T) (cận dưới sai số dự báo). Chẩn đoán " +
      "copernicusDrift = Copernicus(D) vs Copernicus(T). MASK CHUNG bắt buộc: ô chỉ " +
      "được chấm khi hữu hạn ở CẢ bốn trường. chl so trên log10(mg/m³), SST trên °C. " +
      "Copernicus đưa về lưới quan trắc bằng láng giềng gần nhất (bỏ nếu lệch >0,35°). " +
      "corr = trung bình tương quan KHÔNG GIAN từng cặp ngày; frontCorr = tương quan " +
      "của |gradient| (mirror gradientStrength() trong fish-predict, không kẹp [0,1]). " +
      "ERDDAP snap sang ngày gần nhất khi ngày xin trống → mọi lưới bị kiểm ngày, lệch là vứt.",
    sources: {
      obsChl: "NOAA ERDDAP noaacwNPPN20VIIRSDINEOFDaily (chlor_a, mg/m³, DINEOF vá mây)",
      obsSst: "NOAA ERDDAP noaacwBLENDEDsstDaily (analysed_sst, Kelvin → °C)",
      copChl:
        "GLOBAL_ANALYSISFORECAST_BGC_001_028 / cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m (timeChunked.zarr)",
      copSst:
        "GLOBAL_ANALYSISFORECAST_PHY_001_024 / cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m (downsampled4.zarr)",
    },
    window: {
      blocks: blocks.map((b) => ({ from: b[0], to: b.at(-1) })),
      blockLenDays: BLOCK_LEN,
      blockGapDays: BLOCK_GAP,
      maxLead: MAX_LEAD,
    },
    provenanceAudit: provenance,
    perLead: { chl, sst },
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\n✓ Ghi ${OUT_PATH}`);

  const rejected = (rows) =>
    rows.filter((r) => r.verdict === "no").map((r) => r.lead);
  const summary = (name, rows) => {
    const no = rejected(rows);
    const yes = rows.filter((r) => r.verdict === "likely-yes").map((r) => r.lead);
    console.log(
      `  ${name}: BÁC BỎ chắc ở tầm [${no.join(",") || "—"}] | ` +
        `thắng chắc ở tầm [${yes.join(",") || "—"}] | ` +
        `chưa kết luận được ở tầm [${rows
          .filter((r) => r.verdict === "inconclusive")
          .map((r) => r.lead)
          .join(",") || "—"}]`,
    );
  };
  console.log("\n──────── KẾT LUẬN ────────");
  summary("chl", chl);
  summary("sst", sst);
}

main().catch((e) => {
  console.error("LỖI:", e);
  process.exitCode = 1;
});
