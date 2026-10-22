// zarr-cmems.mjs — đọc kho Zarr ARCO của Copernicus Marine (ẩn danh, không tài khoản) cho script "Dòng Dẫn".
// Giải nén bằng ĐÚNG bộ blosc/lz4 của app (src/lib/copernicus.ts — một nguồn, không chép), nạp qua jiti có sẵn
// trong node_modules (không thêm phụ thuộc). Chạy được ở repo trên Mac và ở thư mục train trên gpu-desktop
// miễn là bố cục giống repo: scripts/dong-dan/ · src/lib/{copernicus,abort}.ts · node_modules/jiti.
// Bẫy đã gặp 2026-10-22: máy chủ S3 trả 403 (không phải 404) cho khối trống/đất liền; từ Mac nối chập chờn
// (1–4 s, có lần hết giờ) ⇒ thử lại có lùi; tải dài nên chạy ở gpu-desktop.
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createJiti } = await import(pathToFileURL(join(ROOT, "node_modules", "jiti", "lib", "jiti.mjs")).href);
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
export const { bloscDecompress } = await jiti.import(join(ROOT, "src", "lib", "copernicus.ts"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPED = { "<i2": Int16Array, "<i4": Int32Array, "<f4": Float32Array, "<f8": Float64Array };

/** Tải byte thô; null nếu 403/404 (khối trống). Thử lại khi lỗi mạng/5xx. */
export async function getBytes(url, { tries = 6, timeoutMs = 120000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 403 || r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) throw new Error(`bỏ cuộc ${url}: ${e.message}`);
      await sleep(2000 * 2 ** i);
    }
  }
}

/** Mở một kho geoChunked.zarr: đọc .zmetadata, trả hàm đọc trục và khối đã giải nén + đổi thang (NaN ở fill). */
export async function openZarr(base) {
  const meta = JSON.parse(new TextDecoder().decode(await getBytes(`${base}/.zmetadata`))).metadata;
  const arr = (v) => {
    const a = meta[`${v}/.zarray`], at = meta[`${v}/.zattrs`] ?? {};
    if (!a) throw new Error(`không có biến ${v}`);
    return { shape: a.shape, chunks: a.chunks, T: TYPED[a.dtype], fill: a.fill_value, scale: at.scale_factor ?? 1, offset: at.add_offset ?? 0, dims: at._ARRAY_DIMENSIONS, units: at.units };
  };
  /** Khối (chỉ số khối theo từng chiều) → Float64Array giá trị thật (NaN = thiếu), hoặc null nếu khối trống.
   Float64 chứ không Float32: trục time là giây từ 1990 (~5e8) — Float32 làm tròn tới 64 s (bẫy đã dính 2026-10-22). */
  async function chunk(v, idx) {
    const a = arr(v);
    const raw = await getBytes(`${base}/${v}/${idx.join(".")}`);
    if (!raw) return null;
    const d = bloscDecompress(raw);
    const src = new a.T(d.buffer, d.byteOffset, d.byteLength / a.T.BYTES_PER_ELEMENT);
    const out = new Float64Array(src.length);
    for (let i = 0; i < src.length; i++) out[i] = src[i] === a.fill || Number.isNaN(src[i]) ? NaN : src[i] * a.scale + a.offset;
    return out;
  }
  /** Cả một trục 1 chiều (lat/lon/time), ghép các khối. */
  async function axis(v) {
    const a = arr(v), n = a.shape[0], c = a.chunks[0], out = new Float64Array(n);
    for (let k = 0; k * c < n; k++) { const x = await chunk(v, [k]); out.set(x.subarray(0, Math.min(c, n - k * c)), k * c); }
    return out;
  }
  return { meta, arr, chunk, axis };
}
