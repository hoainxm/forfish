// Trục 1 — DÒNG CHẢY MẶT TỔNG HỢP từ Copernicus Marine ARCO (Zarr) cho dự báo cá.
//
// VÌ SAO CÓ FILE NÀY (kiểm chứng 2026-07-26)
// Nguồn dòng chảy đang dùng (NOAA `noaacwBLENDEDNRTcurrentsDaily`) là dòng ĐỊA
// CHUYỂN (geostrophic) suy từ độ cao mặt biển. Dòng địa chuyển về mặt toán học
// gần như KHÔNG PHÂN KỲ (∂u/∂x + ∂v/∂y ≈ 0), nên `convergenceStrength()` chấm
// trên nguồn đó chủ yếu đo NHIỄU số học, không phải nước dồn thật.
// Copernicus phát `utotal`/`vtotal` = dòng TỔNG (Eulerian + sóng Stokes + triều)
// — trường này CÓ phân kỳ thật, mới đo được chỗ nước dồn (gom mồi nổi → cá tụ).
//
// NGUỒN: Copernicus Marine Service (CMEMS), sản phẩm GLOBAL_ANALYSISFORECAST_PHY_001_024,
// dataset `cmems_mod_glo_phy_anfc_merged-uv_PT1H-i`. Kho ARCO (Zarr) trên
// CloudFerro S3 là CÔNG KHAI, KHÔNG cần đăng nhập / KHÔNG cần API key
// (đã fetch thật, HTTP 200). Attribution: xem ops/external-services.md.
//
// ⚠ KHÔNG dùng endpoint MOTU cũ `nrt.cmems-du.eu` — đã ngừng và domain bị
// người khác chiếm (trang rao bán tên miền). Chỉ đi qua STAC/S3 dưới đây.
//
// ĐÃ ĐO THẬT (2026-07-26) trên asset `downsampled4`:
//   utotal/vtotal shape [50448, 1, 511, 1080], chunks [1, 1, 511, 1080]
//   ⇒ MỘT chunk = TOÀN CẦU tại MỘT mốc giờ, độ phân giải 1/3°, ~668 KB trên dây.
//   Nén blosc(lz4, clevel 5, shuffle byte), dtype <f4, order C,
//   fill_value 9.969209968386869e+36 (đất liền/thiếu → NaN).
//   Trục time: "hours since 1950-01-01", bước 1 giờ, chạy 2020-11-01 →
//   khoảng +9/+10 ngày SO VỚI HÔM NAY ⇒ dataset CÓ PHẦN DỰ BÁO tương lai.
//   Trục longitude: hệ -180..180 (KHÔNG phải 0..360) — phải quy đổi.
//
// File này THUẦN đọc dữ liệu: giải nén blosc/lz4 tự viết (không thêm phụ thuộc),
// đọc .zmetadata, chọn mốc giờ gần nhất, cắt về hộp biển VN, trả `ScalarGrid`
// khớp `src/lib/fish-predict.ts`. Fail-fast trả `null` như `hycom.ts` — mọi lỗi
// mạng/giải mã đều nuốt, KHÔNG treo route.

import type { ScalarGrid } from "./fish-predict";

/* ---------------------------------------------------------------------------
   Hằng số nguồn
--------------------------------------------------------------------------- */

const ARCO_ROOT =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-time-015/arco/" +
  "GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
  "cmems_mod_glo_phy_anfc_merged-uv_PT1H-i_202211";

/**
 * Hai asset ARCO của CÙNG dataset (đã đo thật 2026-07-26, xem ops/external-services.md):
 *
 * - `downsampled4` — 1/3° (≈37 km), chunk [1,1,511,1080] = MỘT chunk toàn cầu
 *   mỗi mốc giờ (~668 KB/biến). THÔ HƠN lưới cá 0,25° ⇒ hội tụ bị làm mượt.
 * - `timeChunked` — 1/12° (≈9 km), chunk [1,1,512,2048]; hộp biển VN vắt qua
 *   RANH lat 1024 nên cần 2 chunk lat × 1 chunk lon = 2 chunk/biến.
 *
 * `geoChunked` ĐÃ LOẠI: chunk [4272,1,16,8] gom theo THỜI GIAN — lấy MỘT mốc
 * giờ cho hộp VN phải tải 312 chunk × 2,2 MB. Sai kiểu truy cập, không bàn nữa.
 */
export const COPERNICUS_ASSETS = {
  downsampled4: `${ARCO_ROOT}/downsampled4.zarr`,
  timeChunked: `${ARCO_ROOT}/timeChunked.zarr`,
} as const;

export type CopernicusAsset = keyof typeof COPERNICUS_ASSETS;

/**
 * Asset MẶC ĐỊNH cho runtime = `timeChunked` (1/12°).
 * CĂN CỨ (đo thật, xem ops/external-services.md): trên lưới đã cắt về hộp VN,
 * tự tương quan không gian của trường phân kỳ 1/12° cao hơn hẳn 1/3°, và hội tụ
 * được tính trên lưới MỊN HƠN lưới cá 0,25° (đúng chiều: tính ở lưới gốc rồi
 * lấy mẫu xuống, không phải nội suy lên).
 */
export const COPERNICUS_DEFAULT_ASSET: CopernicusAsset = "timeChunked";

/** Gốc kho Zarr ARCO đang dùng mặc định (giữ tên cũ cho script/probe) */
export const COPERNICUS_ZARR_BASE = COPERNICUS_ASSETS[COPERNICUS_DEFAULT_ASSET];

/** Catalog STAC (chỉ để tra lại href khi Copernicus đổi bucket — không gọi lúc chạy) */
export const COPERNICUS_STAC_DATASET =
  "https://stac.marine.copernicus.eu/metadata/" +
  "GLOBAL_ANALYSISFORECAST_PHY_001_024/" +
  "cmems_mod_glo_phy_anfc_merged-uv_PT1H-i_202211/dataset.stac.json";

/** Hộp vùng biển VN (khớp lưới NOAA đang dùng ở fish-predict) */
export const VN_BBOX = { lat0: 5, lat1: 22, lon0: 102, lon1: 118 } as const;

/** Số chunk trục thời gian tối đa chịu đọc (an toàn khi Copernicus đổi chunking) */
const MAX_TIME_CHUNKS = 16;

const COPERNICUS_UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";

/* ---------------------------------------------------------------------------
   LZ4 block format — giải nén THUẦN TypeScript
--------------------------------------------------------------------------- */

/**
 * Giải nén MỘT block LZ4 (định dạng "block", KHÔNG có frame header) từ
 * `src[sOff, sEnd)` vào `dst` bắt đầu ở `dOff`. Trả về số byte đã ghi.
 *
 * Chuỗi tuần tự LZ4: token(1 byte) = [số byte literal (4 bit cao)][độ dài match
 * (4 bit thấp)]; giá trị 15 = "còn nữa", đọc tiếp các byte 255-cộng-dồn. Sau
 * literal là offset 2 byte little-endian trỏ NGƯỢC vào phần đã giải nén, match
 * dài `ml + 4`. Match có thể CHỒNG LẤN chính nó (offset < ml) nên BẮT BUỘC
 * chép từng byte, không dùng copyWithin/set.
 *
 * Ném lỗi khi dữ liệu hỏng (tràn nguồn/đích, offset không hợp lệ) — người gọi
 * bắt và trả null, KHÔNG để vòng lặp chạy vô hạn.
 */
export function lz4DecompressBlock(
  src: Uint8Array,
  sOff: number,
  sEnd: number,
  dst: Uint8Array,
  dOff: number,
  dEnd: number,
): number {
  let ip = sOff;
  let op = dOff;
  while (ip < sEnd) {
    const token = src[ip++];
    // literal
    let lit = token >> 4;
    if (lit === 15) {
      let s = 255;
      while (s === 255) {
        if (ip >= sEnd) throw new Error("lz4: hụt byte độ dài literal");
        s = src[ip++];
        lit += s;
      }
    }
    if (ip + lit > sEnd || op + lit > dEnd) throw new Error("lz4: literal tràn");
    for (let i = 0; i < lit; i++) dst[op++] = src[ip++];
    // block kết thúc bằng literal — không có match phía sau
    if (ip >= sEnd) break;
    // match
    if (ip + 1 >= sEnd) throw new Error("lz4: hụt byte offset");
    const off = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (off === 0 || op - off < dOff) throw new Error("lz4: offset không hợp lệ");
    let ml = token & 0x0f;
    if (ml === 15) {
      let s = 255;
      while (s === 255) {
        if (ip >= sEnd) throw new Error("lz4: hụt byte độ dài match");
        s = src[ip++];
        ml += s;
      }
    }
    ml += 4;
    if (op + ml > dEnd) throw new Error("lz4: match tràn");
    let mp = op - off;
    for (let i = 0; i < ml; i++) dst[op++] = dst[mp++];
  }
  return op - dOff;
}

/* ---------------------------------------------------------------------------
   Byte-shuffle của blosc
--------------------------------------------------------------------------- */

/**
 * Đảo NGƯỢC byte-shuffle của blosc (shuffle = 1) cho phần tử `typesize` byte.
 *
 * Khi shuffle, blosc gom byte thứ 0 của MỌI phần tử lại thành một dải, rồi byte
 * thứ 1, … (nhờ vậy các byte mũ/dấu giống nhau nằm cạnh nhau → lz4 nén rất tốt).
 * Un-shuffle là phép ngược: `out[i*ts + j] = src[j*n + i]` với `n = ⌊size/ts⌋`.
 * Đuôi lẻ (size không chia hết cho typesize) blosc chép nguyên — giữ nguyên.
 */
export function unshuffleBytes(typesize: number, src: Uint8Array): Uint8Array {
  const size = src.length;
  if (typesize <= 1) return src;
  const n = Math.floor(size / typesize);
  const out = new Uint8Array(size);
  for (let j = 0; j < typesize; j++) {
    const base = j * n;
    for (let i = 0; i < n; i++) out[i * typesize + j] = src[base + i];
  }
  for (let k = n * typesize; k < size; k++) out[k] = src[k];
  return out;
}

/* ---------------------------------------------------------------------------
   Blosc container
--------------------------------------------------------------------------- */

export interface BloscHeader {
  version: number;
  versionlz: number;
  flags: number;
  /** cỡ phần tử (byte) — 4 với <f4 */
  typesize: number;
  /** tổng byte SAU giải nén */
  nbytes: number;
  /** cỡ mỗi block (byte) */
  blocksize: number;
  /** tổng byte của cả buffer nén (kể cả header) */
  cbytes: number;
  /** 0 blosclz · 1 lz4 · 2 lz4hc · 3 snappy · 4 zlib · 5 zstd */
  compcode: number;
  /** dữ liệu chép thẳng, không nén */
  memcpyed: boolean;
  /** có byte-shuffle */
  doShuffle: boolean;
  /** có bit-shuffle (KHÔNG hỗ trợ) */
  bitShuffle: boolean;
}

/** Đọc 16 byte header blosc1 */
export function parseBloscHeader(buf: Uint8Array): BloscHeader {
  if (buf.length < 16) throw new Error("blosc: buffer ngắn hơn header");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const flags = buf[2];
  return {
    version: buf[0],
    versionlz: buf[1],
    flags,
    typesize: buf[3],
    nbytes: dv.getUint32(4, true),
    blocksize: dv.getUint32(8, true),
    cbytes: dv.getUint32(12, true),
    compcode: flags >> 5,
    memcpyed: (flags & 0x02) !== 0,
    doShuffle: (flags & 0x01) !== 0,
    bitShuffle: (flags & 0x04) !== 0,
  };
}

// c-blosc chia MỘT block thành `typesize` luồng con (mỗi luồng = một dải byte
// cùng bậc sau shuffle) khi codec là blosclz/lz4, typesize ≤ 16 và
// blocksize/typesize ≥ 128. Hằng số lấy đúng theo c-blosc (MAX_SPLITS,
// MIN_BUFFERSIZE) — sai một li là lệch cả chunk.
const MAX_SPLITS = 16;
const MIN_BUFFERSIZE = 128;

function splitCount(header: BloscHeader): number {
  const splittable = header.compcode === 0 || header.compcode === 1; // blosclz | lz4
  return splittable &&
    header.typesize <= MAX_SPLITS &&
    Math.floor(header.blocksize / header.typesize) >= MIN_BUFFERSIZE
    ? header.typesize
    : 1;
}

/**
 * Giải nén một buffer blosc1 (lz4 + shuffle) → byte thô.
 *
 * Bố cục: header 16 byte, rồi bảng offset `nblocks` số int32 LE (offset tuyệt
 * đối tính từ đầu buffer), rồi thân từng block. Trong block: `nstreams` luồng,
 * mỗi luồng có int32 LE = số byte nén đứng trước; nếu số đó bằng đúng cỡ luồng
 * thì đó là dữ liệu THÔ (không nén nổi) — chép thẳng.
 *
 * BẪY ĐÃ DÍNH (2026-07-26): block CUỐI khi lẻ (bsize ≠ blocksize) thì c-blosc
 * KHÔNG chia luồng (`leftoverblock` ⇒ nstreams = 1). Bỏ qua chi tiết này thì 4
 * block đầu giải đúng, block cuối vỡ ("got 110368 want 27592").
 */
export function bloscDecompress(buf: Uint8Array): Uint8Array {
  const h = parseBloscHeader(buf);
  if (h.bitShuffle) throw new Error("blosc: bit-shuffle chưa hỗ trợ");
  if (h.memcpyed) return buf.slice(16, 16 + h.nbytes);
  if (h.compcode !== 1) throw new Error(`blosc: codec ${h.compcode} chưa hỗ trợ (chỉ lz4)`);
  if (h.blocksize <= 0) throw new Error("blosc: blocksize = 0");

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const nblocks = Math.ceil(h.nbytes / h.blocksize);
  const out = new Uint8Array(h.nbytes);
  const splits = splitCount(h);

  for (let b = 0; b < nblocks; b++) {
    const bsize = Math.min(h.blocksize, h.nbytes - b * h.blocksize);
    const nstreams = bsize === h.blocksize ? splits : 1; // block lẻ: KHÔNG chia
    const neblock = Math.floor(bsize / nstreams);
    let sp = dv.getInt32(16 + 4 * b, true);
    if (sp < 0 || sp >= buf.length) throw new Error("blosc: offset block hỏng");

    const tmp = new Uint8Array(bsize);
    let tp = 0;
    for (let s = 0; s < nstreams; s++) {
      if (sp + 4 > buf.length) throw new Error("blosc: hụt cỡ luồng");
      const csz = dv.getInt32(sp, true);
      sp += 4;
      if (csz < 0 || sp + csz > buf.length) throw new Error("blosc: cỡ luồng hỏng");
      if (csz === neblock) {
        tmp.set(buf.subarray(sp, sp + csz), tp); // không nén nổi → thô
        tp += csz;
      } else {
        const got = lz4DecompressBlock(buf, sp, sp + csz, tmp, tp, tp + neblock);
        if (got !== neblock) throw new Error(`blosc: luồng ${s} ra ${got}B, cần ${neblock}B`);
        tp += neblock;
      }
      sp += csz;
    }
    out.set(h.doShuffle ? unshuffleBytes(h.typesize, tmp) : tmp, b * h.blocksize);
  }
  return out;
}

/** Buffer chunk Zarr (blosc) → Float32Array (dtype `<f4`, little-endian) */
export function decodeFloat32Chunk(buf: Uint8Array): Float32Array {
  const raw = bloscDecompress(buf);
  if (raw.byteLength % 4 !== 0) throw new Error("chunk: độ dài không chia hết 4");
  // copy vào ArrayBuffer riêng để chắc chắn căn 4 byte
  const aligned = new Uint8Array(raw.byteLength);
  aligned.set(raw);
  return new Float32Array(aligned.buffer);
}

/* ---------------------------------------------------------------------------
   Metadata Zarr v2 (.zmetadata hợp nhất)
--------------------------------------------------------------------------- */

export interface ZarrArrayMeta {
  shape: number[];
  chunks: number[];
  dtype: string;
  /** giá trị "thiếu"; NaN nếu kho ghi "NaN" */
  fillValue: number;
}

interface ZMetadata {
  metadata?: Record<string, unknown>;
}

/** Lấy `.zarray` của một mảng trong `.zmetadata` (null nếu không có / sai kiểu) */
export function readZarrArrayMeta(zmeta: unknown, name: string): ZarrArrayMeta | null {
  const m = (zmeta as ZMetadata)?.metadata?.[`${name}/.zarray`] as
    | Record<string, unknown>
    | undefined;
  if (!m) return null;
  const shape = m.shape as number[] | undefined;
  const chunks = m.chunks as number[] | undefined;
  const dtype = m.dtype as string | undefined;
  if (!Array.isArray(shape) || !Array.isArray(chunks) || typeof dtype !== "string") {
    return null;
  }
  const fv = m.fill_value;
  const fillValue = typeof fv === "number" ? fv : NaN;
  return { shape, chunks, dtype, fillValue };
}

/** Lấy một thuộc tính trong `.zattrs` của mảng (vd `units` của trục time) */
export function readZarrAttr(zmeta: unknown, name: string, attr: string): unknown {
  const a = (zmeta as ZMetadata)?.metadata?.[`${name}/.zattrs`] as
    | Record<string, unknown>
    | undefined;
  return a?.[attr];
}

/* ---------------------------------------------------------------------------
   Trục thời gian CF
--------------------------------------------------------------------------- */

const MS_PER_UNIT: Record<string, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

/**
 * Parse `units` kiểu CF ("hours since 1950-01-01", "days since 1950-01-01 00:00:00").
 * Trả mốc gốc (ms epoch) + số ms mỗi đơn vị; null nếu không hiểu.
 */
export function parseCfTimeUnits(
  units: string,
): { epochMs: number; msPerUnit: number } | null {
  const m = /^\s*(seconds|minutes|hours|days)\s+since\s+(.+?)\s*$/i.exec(units);
  if (!m) return null;
  const msPerUnit = MS_PER_UNIT[m[1].toLowerCase()];
  // "1950-01-01" hoặc "1950-01-01 00:00:00" — coi là UTC (chuẩn CF khi không ghi múi giờ)
  const iso = m[2].replace(" ", "T");
  const epochMs = Date.parse(/[Zz]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(epochMs) ? { epochMs, msPerUnit } : null;
}

/** Giá trị trục thời gian CF → ms epoch */
export function cfTimeToMs(
  value: number,
  u: { epochMs: number; msPerUnit: number },
): number {
  return u.epochMs + value * u.msPerUnit;
}

/**
 * Chỉ số của phần tử GẦN `target` nhất trong mảng số (không cần tăng dần, bỏ
 * qua phần tử không hữu hạn — đuôi chunk cuối của Zarr là NaN đệm). -1 nếu rỗng.
 */
export function nearestIndex(values: ArrayLike<number>, target: number): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    const d = Math.abs(v - target);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/* ---------------------------------------------------------------------------
   Trục toạ độ + hộp cắt
--------------------------------------------------------------------------- */

/**
 * Quy lon (độ Đông, nhận cả 0..360 lẫn âm) về hệ của TRỤC trong kho.
 * Copernicus dùng -180..180 (`signed = true`); ERDDAP/NOAA hay dùng 0..360.
 */
export function lonToAxis(lonEast: number, signed: boolean): number {
  const x = ((lonEast % 360) + 360) % 360; // 0..360
  return signed && x > 180 ? x - 360 : x;
}

/** Lon bất kỳ → độ Đông dương 0..360 (dạng trả ra cho app, khớp lưới NOAA) */
export function lonToEast(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

/**
 * Dải chỉ số của trục TĂNG DẦN nằm trong [lo, hi] (bao gồm hai đầu).
 * `count = 0` khi hộp không giao trục.
 */
export function axisRange(
  coords: ArrayLike<number>,
  lo: number,
  hi: number,
): { start: number; count: number } {
  let start = -1;
  let end = -2;
  for (let i = 0; i < coords.length; i++) {
    const v = coords[i];
    if (!Number.isFinite(v)) continue;
    if (v >= lo && v <= hi) {
      if (start < 0) start = i;
      end = i;
    }
  }
  return start < 0 ? { start: 0, count: 0 } : { start, count: end - start + 1 };
}

/** true nếu ô là "thiếu" theo fill_value của Zarr (so LỎNG — <f4 làm tròn fill) */
export function isFill(v: number, fillValue: number): boolean {
  if (!Number.isFinite(v)) return true;
  if (!Number.isFinite(fillValue)) return false;
  // fill của Copernicus ~1e37; so tương đối 1e-6 để né sai số float32
  return Math.abs(v - fillValue) <= Math.abs(fillValue) * 1e-6;
}

/** true nếu mảng tăng dần THỰC SỰ (dùng để bắt bbox vắt qua kinh tuyến 0/180) */
export function isAscending(a: number[]): boolean {
  for (let i = 1; i < a.length; i++) if (!(a[i] > a[i - 1])) return false;
  return true;
}

/**
 * Cắt MỘT lát 2 chiều (lat × lon toàn cầu, hàng-chính C-order) về hộp bbox →
 * `ScalarGrid`. `fill_value` → NaN. Lon trả ra là độ Đông dương (102..118),
 * KHÔNG phải hệ -180..180 của kho — để khớp các lưới khác trong app.
 *
 * GIỚI HẠN: hộp vắt qua kinh tuyến 0 (vd -5..5) sẽ cho lon 355…,0… KHÔNG tăng
 * dần. Biển VN không dính; người gọi kiểm bằng `isAscending()` rồi bail.
 */
export function sliceToGrid(opts: {
  data: ArrayLike<number>;
  lats: ArrayLike<number>;
  lons: ArrayLike<number>;
  latSel: { start: number; count: number };
  lonSel: { start: number; count: number };
  fillValue: number;
  date: string;
}): ScalarGrid {
  const { data, lats, lons, latSel, lonSel, fillValue, date } = opts;
  const nLon = lons.length;
  const outLats: number[] = [];
  const outLons: number[] = [];
  const values: number[][] = [];
  for (let j = 0; j < lonSel.count; j++) outLons.push(lonToEast(lons[lonSel.start + j]));
  for (let i = 0; i < latSel.count; i++) {
    const li = latSel.start + i;
    outLats.push(lats[li]);
    const row: number[] = [];
    for (let j = 0; j < lonSel.count; j++) {
      const v = data[li * nLon + lonSel.start + j];
      row.push(isFill(v, fillValue) ? NaN : v);
    }
    values.push(row);
  }
  return { lats: outLats, lons: outLons, values, date };
}

/* ---------------------------------------------------------------------------
   Ghép nhiều chunk lat × lon về đúng cửa sổ bbox
--------------------------------------------------------------------------- */

/** Dải CHUNK (theo chỉ số chunk) phủ một dải CHỈ SỐ ô của một trục */
export function chunkSpan(
  sel: { start: number; count: number },
  chunkSize: number,
): { c0: number; c1: number; n: number } {
  if (sel.count <= 0 || chunkSize <= 0) return { c0: 0, c1: -1, n: 0 };
  const c0 = Math.floor(sel.start / chunkSize);
  const c1 = Math.floor((sel.start + sel.count - 1) / chunkSize);
  return { c0, c1, n: c1 - c0 + 1 };
}

/**
 * Ghép các chunk (lat × lon) đã giải nén về `ScalarGrid` CHỈ chứa cửa sổ bbox.
 *
 * Zarr ĐỆM chunk rìa cho đủ cỡ chunk, nên bước nhảy hàng trong chunk LUÔN là
 * `chunkLon` (không phải số cột hữu ích) — sai chỗ này thì ảnh bị xé chéo.
 * `get(ci, cj)` trả về chunk đã decode; `null` = chunk hỏng → ô đó NaN.
 */
export function assembleWindow(opts: {
  get: (ci: number, cj: number) => Float32Array | null;
  lats: ArrayLike<number>;
  lons: ArrayLike<number>;
  latSel: { start: number; count: number };
  lonSel: { start: number; count: number };
  chunkLat: number;
  chunkLon: number;
  fillValue: number;
  date: string;
}): ScalarGrid {
  const { get, lats, lons, latSel, lonSel, chunkLat, chunkLon, fillValue, date } = opts;
  const outLats: number[] = [];
  const outLons: number[] = [];
  for (let i = 0; i < latSel.count; i++) outLats.push(lats[latSel.start + i]);
  for (let j = 0; j < lonSel.count; j++) outLons.push(lonToEast(lons[lonSel.start + j]));
  const values: number[][] = outLats.map(() => new Array<number>(lonSel.count).fill(NaN));

  const latC = chunkSpan(latSel, chunkLat);
  const lonC = chunkSpan(lonSel, chunkLon);
  for (let ci = latC.c0; ci <= latC.c1; ci++) {
    for (let cj = lonC.c0; cj <= lonC.c1; cj++) {
      const data = get(ci, cj);
      if (!data) continue;
      const gi0 = Math.max(latSel.start, ci * chunkLat);
      const gi1 = Math.min(latSel.start + latSel.count - 1, (ci + 1) * chunkLat - 1);
      const gj0 = Math.max(lonSel.start, cj * chunkLon);
      const gj1 = Math.min(lonSel.start + lonSel.count - 1, (cj + 1) * chunkLon - 1);
      for (let gi = gi0; gi <= gi1; gi++) {
        const rowBase = (gi - ci * chunkLat) * chunkLon;
        const outRow = values[gi - latSel.start];
        for (let gj = gj0; gj <= gj1; gj++) {
          const v = data[rowBase + (gj - cj * chunkLon)];
          outRow[gj - lonSel.start] = v === undefined || isFill(v, fillValue) ? NaN : v;
        }
      }
    }
  }
  return { lats: outLats, lons: outLons, values, date };
}

/* ---------------------------------------------------------------------------
   Tải thật
--------------------------------------------------------------------------- */

export interface CopernicusCurrents {
  /** dòng ĐÔNG (m/s) — khớp `CurrentGrids.u` của fish-predict */
  u: ScalarGrid;
  /** dòng BẮC (m/s) — khớp `CurrentGrids.v` */
  v: ScalarGrid;
  /** mốc giờ THẬT đã chọn (ISO UTC, vd 2026-07-26T09:00:00.000Z) */
  timeISO: string;
  /** true nếu mốc này ở TƯƠNG LAI so với lúc gọi (dataset có ~9-10 ngày dự báo) */
  forecast: boolean;
  /** tổng byte đã tải trên dây (để tính ngân sách route) */
  bytes: number;
  /** asset đã dùng (để ghi vào lý lịch nguồn) */
  asset: CopernicusAsset;
  /** bước lưới THẬT theo vĩ độ (độ) — cần để chuẩn hoá hội tụ theo ô */
  stepDeg: number;
}

async function getBuf(
  url: string,
  timeoutMs: number,
  revalidate: number,
): Promise<Uint8Array> {
  const res = await fetch(url, {
    // Chunk vài trăm KB–1 MB/lần — cache lại 1 giờ (dữ liệu bước 1 giờ, không
    // tươi hơn được)
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": COPERNICUS_UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Đọc TOÀN BỘ một mảng 1 chiều (nối các chunk, cắt về đúng `shape`) */
async function readAxis(
  base: string,
  name: string,
  meta: ZarrArrayMeta,
  timeoutMs: number,
): Promise<Float32Array> {
  const n = meta.shape[0];
  const cs = meta.chunks[0];
  const nChunks = Math.ceil(n / cs);
  if (nChunks > MAX_TIME_CHUNKS) throw new Error(`${name}: ${nChunks} chunk — quá nhiều`);
  const parts = await Promise.all(
    Array.from({ length: nChunks }, (_, c) =>
      getBuf(`${base}/${name}/${c}`, timeoutMs, 86400).then(decodeFloat32Chunk),
    ),
  );
  const out = new Float32Array(n);
  for (let c = 0; c < nChunks; c++) {
    const take = Math.min(cs, n - c * cs);
    out.set(parts[c].subarray(0, take), c * cs);
  }
  return out;
}

/**
 * Trần số chunk DỮ LIỆU cho MỘT biến. Hộp VN trên `timeChunked` cần 2 (vắt qua
 * ranh lat 1024); để 6 là dây an toàn phòng Copernicus đổi chunking — vượt thì
 * bail chứ KHÔNG âm thầm tải hàng chục MB trong route 60 s.
 */
const MAX_DATA_CHUNKS = 6;

/**
 * Tải dòng chảy TỔNG mặt (utotal/vtotal) của Copernicus cho hộp biển VN tại mốc
 * giờ GẦN `at` nhất (mặc định: bây giờ). Trả `null` khi bất kỳ khâu nào hỏng —
 * KHÔNG ném, KHÔNG treo (giống `fetchHycomGrids`).
 *
 * NGÂN SÁCH mỗi lần gọi — xem bảng đo thật trong ops/external-services.md.
 * Trục lat/lon/time đặt revalidate 24 h nên các lần sau chỉ còn chunk dữ liệu.
 */
export async function fetchCopernicusCurrents(opts?: {
  at?: Date;
  timeoutMs?: number;
  /** asset ARCO cần đọc (mặc định `COPERNICUS_DEFAULT_ASSET`) */
  asset?: CopernicusAsset;
  /**
   * Cặp biến cần đọc. Mặc định `utotal`/`vtotal` = dòng TỔNG (Eulerian + sóng
   * Stokes + triều) — ĐÂY là cái cho hội tụ có nghĩa. Đổi sang `uo`/`vo` nếu
   * muốn dòng Eulerian thuần (để so sánh/kiểm chứng).
   */
  variables?: { u: string; v: string };
}): Promise<CopernicusCurrents | null> {
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const uName = opts?.variables?.u ?? "utotal";
  const vName = opts?.variables?.v ?? "vtotal";
  const asset = opts?.asset ?? COPERNICUS_DEFAULT_ASSET;
  const base = COPERNICUS_ASSETS[asset];
  try {
    const metaBuf = await fetch(`${base}/.zmetadata`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": COPERNICUS_UA },
    });
    if (!metaBuf.ok) return null;
    const zmeta = await metaBuf.json();

    const uMeta = readZarrArrayMeta(zmeta, uName);
    const vMeta = readZarrArrayMeta(zmeta, vName);
    const latMeta = readZarrArrayMeta(zmeta, "latitude");
    const lonMeta = readZarrArrayMeta(zmeta, "longitude");
    const timeMeta = readZarrArrayMeta(zmeta, "time");
    if (!uMeta || !vMeta || !latMeta || !lonMeta || !timeMeta) return null;
    if (uMeta.dtype !== "<f4" || vMeta.dtype !== "<f4") return null;
    // Một chunk = MỘT mốc giờ (chunks[0] === 1). Asset `geoChunked` gom hàng
    // nghìn mốc giờ vào một chunk → bail ngay, sai kiểu truy cập.
    const [nT, , nLat, nLon] = uMeta.shape;
    const chunkLat = uMeta.chunks[2];
    const chunkLon = uMeta.chunks[3];
    if (uMeta.chunks[0] !== 1 || chunkLat <= 0 || chunkLon <= 0) return null;
    if (vMeta.chunks[2] !== chunkLat || vMeta.chunks[3] !== chunkLon) return null;

    const units = readZarrAttr(zmeta, "time", "units");
    const cf = typeof units === "string" ? parseCfTimeUnits(units) : null;
    if (!cf) return null;

    const [lats, lons, times] = await Promise.all([
      readAxis(base, "latitude", latMeta, timeoutMs),
      readAxis(base, "longitude", lonMeta, timeoutMs),
      readAxis(base, "time", timeMeta, timeoutMs),
    ]);
    if (lats.length < nLat || lons.length < nLon || times.length < 1) return null;

    const targetMs = (opts?.at ?? new Date()).getTime();
    const targetUnits = (targetMs - cf.epochMs) / cf.msPerUnit;
    const ti = nearestIndex(times, targetUnits);
    if (ti < 0 || ti >= nT) return null;
    const pickedMs = cfTimeToMs(times[ti], cf);
    const timeISO = new Date(pickedMs).toISOString();

    // trục lon của Copernicus là -180..180 → quy bbox về đúng hệ trước khi cắt
    const signed = lons[0] < 0;
    const lo0 = lonToAxis(VN_BBOX.lon0, signed);
    const lo1 = lonToAxis(VN_BBOX.lon1, signed);
    if (lo1 < lo0) return null; // hộp vắt qua kinh tuyến 180 — không hỗ trợ (biển VN không dính)
    const latSel = axisRange(lats, VN_BBOX.lat0, VN_BBOX.lat1);
    const lonSel = axisRange(lons, lo0, lo1);
    if (latSel.count === 0 || lonSel.count === 0) return null;

    // CHỈ tải các chunk lat×lon GIAO với hộp VN (asset 1/12° thì hộp vắt qua
    // ranh lat ⇒ 2 chunk/biến; asset 1/3° thì 1 chunk toàn cầu/biến).
    const latC = chunkSpan(latSel, chunkLat);
    const lonC = chunkSpan(lonSel, chunkLon);
    if (latC.n * lonC.n > MAX_DATA_CHUNKS) return null;

    const keys: { ci: number; cj: number }[] = [];
    for (let ci = latC.c0; ci <= latC.c1; ci++)
      for (let cj = lonC.c0; cj <= lonC.c1; cj++) keys.push({ ci, cj });

    let bytes = 0;
    const loadVar = async (name: string) => {
      const bufs = await Promise.all(
        keys.map((k) => getBuf(`${base}/${name}/${ti}.0.${k.ci}.${k.cj}`, timeoutMs, 3600)),
      );
      const map = new Map<string, Float32Array>();
      for (let i = 0; i < keys.length; i++) {
        bytes += bufs[i].byteLength;
        map.set(`${keys[i].ci}.${keys[i].cj}`, decodeFloat32Chunk(bufs[i]));
      }
      return map;
    };
    const [uMap, vMap] = await Promise.all([loadVar(uName), loadVar(vName)]);

    const date = timeISO.slice(0, 10);
    const common = { lats, lons, latSel, lonSel, chunkLat, chunkLon, date };
    const u = assembleWindow({
      ...common,
      get: (ci, cj) => uMap.get(`${ci}.${cj}`) ?? null,
      fillValue: uMeta.fillValue,
    });
    const v = assembleWindow({
      ...common,
      get: (ci, cj) => vMap.get(`${ci}.${cj}`) ?? null,
      fillValue: vMeta.fillValue,
    });
    // lưới toàn NaN (bbox rơi vào đất/thiếu) thì coi như không dùng được
    const anyFinite = (g: ScalarGrid) => g.values.some((r) => r.some(Number.isFinite));
    if (!anyFinite(u) || !anyFinite(v)) return null;
    // trục lon phải tăng dần (hộp không vắt qua kinh tuyến 0) — fish-predict giả định thế
    if (!isAscending(u.lons) || !isAscending(u.lats)) return null;

    const stepDeg =
      u.lats.length > 1 ? Math.abs(u.lats[1] - u.lats[0]) : Math.abs(360 / nLon);
    return { u, v, timeISO, forecast: pickedMs > Date.now(), bytes, asset, stepDeg };
  } catch {
    return null;
  }
}
