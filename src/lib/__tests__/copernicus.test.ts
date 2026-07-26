// Test cho bộ ĐỌC Copernicus Marine ARCO (Zarr) — src/lib/copernicus.ts.
//
// Phần thuần (giải nén blosc/lz4, un-shuffle, chọn mốc giờ, cắt bbox, quy đổi
// lon, fill → NaN) test được KHÔNG cần mạng. `fetchCopernicusCurrents()` (có
// mạng) KHÔNG test ở đây — kiểm chứng bằng `node scripts/copernicus-probe.mjs`.

import { describe, expect, it } from "vitest";
import {
  axisRange,
  bloscDecompress,
  cfTimeToMs,
  decodeFloat32Chunk,
  isAscending,
  isFill,
  lonToAxis,
  lonToEast,
  lz4DecompressBlock,
  nearestIndex,
  parseBloscHeader,
  parseCfTimeUnits,
  readZarrArrayMeta,
  readZarrAttr,
  sliceToGrid,
  unshuffleBytes,
} from "@/lib/copernicus";

/* ---------------------------------------------------------------------------
   LZ4 block
--------------------------------------------------------------------------- */

/** Chạy lz4DecompressBlock trên một mảng byte cho sẵn → Uint8Array kết quả */
function lz4(bytes: number[], outLen: number): Uint8Array {
  const src = Uint8Array.from(bytes);
  const dst = new Uint8Array(outLen);
  const n = lz4DecompressBlock(src, 0, src.length, dst, 0, outLen);
  expect(n).toBe(outLen);
  return dst;
}

describe("lz4DecompressBlock", () => {
  it("chuỗi chỉ có literal (block kết thúc bằng literal, không match)", () => {
    // token 0x50 = 5 literal, 0 match
    const out = lz4([0x50, 65, 66, 67, 68, 69], 5);
    expect([...out]).toEqual([65, 66, 67, 68, 69]);
  });

  it("match CHỒNG LẤN chính nó (offset < độ dài) — phải chép từng byte", () => {
    // literal "abc" (3) + match offset 3 dài 9 ⇒ "abcabcabcabc"
    // token = (3 << 4) | (9 - 4) = 0x35
    const out = lz4([0x35, 97, 98, 99, 0x03, 0x00], 12);
    expect(String.fromCharCode(...out)).toBe("abcabcabcabc");
  });

  it("literal ≥ 15 dùng byte 255 cộng dồn", () => {
    // 20 literal: nibble 15 + byte phụ 5
    const lits = Array.from({ length: 20 }, (_, i) => i + 1);
    const out = lz4([0xf0, 5, ...lits], 20);
    expect([...out]).toEqual(lits);
  });

  it("match ≥ 19 dùng byte 255 cộng dồn", () => {
    // literal "ab" (2) + match offset 2, độ dài 15+3+4 = 22 ⇒ tổng 24 byte
    const out = lz4([0x2f, 97, 98, 0x02, 0x00, 3], 24);
    expect(String.fromCharCode(...out)).toBe("abababababababababababab");
  });

  it("dữ liệu hỏng thì NÉM, không lặp vô hạn", () => {
    // khai 200 literal nhưng nguồn chỉ có 3 byte
    const src = Uint8Array.from([0xc0, 1, 2, 3]);
    expect(() => lz4DecompressBlock(src, 0, src.length, new Uint8Array(8), 0, 8)).toThrow();
    // offset 0 (không hợp lệ)
    const bad = Uint8Array.from([0x10, 97, 0x00, 0x00]);
    expect(() => lz4DecompressBlock(bad, 0, bad.length, new Uint8Array(8), 0, 8)).toThrow();
  });
});

/* ---------------------------------------------------------------------------
   Byte shuffle
--------------------------------------------------------------------------- */

/** Nghịch đảo của unshuffleBytes — chỉ dùng để dựng fixture trong test */
function shuffleBytes(typesize: number, src: Uint8Array): Uint8Array {
  const n = Math.floor(src.length / typesize);
  const out = new Uint8Array(src.length);
  for (let j = 0; j < typesize; j++) {
    for (let i = 0; i < n; i++) out[j * n + i] = src[i * typesize + j];
  }
  for (let k = n * typesize; k < src.length; k++) out[k] = src[k];
  return out;
}

describe("unshuffleBytes", () => {
  it("đảo đúng byte-shuffle typesize 4", () => {
    const orig = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // shuffle gom byte cùng bậc: [1,5,9, 2,6,10, 3,7,11, 4,8,12]
    expect([...shuffleBytes(4, orig)]).toEqual([1, 5, 9, 2, 6, 10, 3, 7, 11, 4, 8, 12]);
    expect([...unshuffleBytes(4, shuffleBytes(4, orig))]).toEqual([...orig]);
  });

  it("giữ nguyên đuôi lẻ (độ dài không chia hết typesize)", () => {
    const orig = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // 10 = 2*4 + 2
    expect([...unshuffleBytes(4, shuffleBytes(4, orig))]).toEqual([...orig]);
  });

  it("typesize 1 là phép đồng nhất", () => {
    const a = Uint8Array.from([9, 8, 7]);
    expect(unshuffleBytes(1, a)).toBe(a);
  });
});

/* ---------------------------------------------------------------------------
   Blosc container — fixture TỰ DỰNG (luồng "thô") + fixture THẬT (lz4)
--------------------------------------------------------------------------- */

const TS = 4;
const BLOCKSIZE = 512; // 512/4 = 128 ≥ MIN_BUFFERSIZE ⇒ block đủ lớn thì CHIA 4 luồng

/**
 * Dựng buffer blosc1 hợp lệ, mọi luồng ở dạng THÔ (csz = cỡ luồng ⇒ nhánh
 * memcpy, không cần bộ nén lz4 trong test). Mô phỏng đúng luật của c-blosc:
 * block đủ cỡ ⇒ chia `typesize` luồng; block CUỐI lẻ ⇒ KHÔNG chia (1 luồng).
 */
function buildBlosc(data: Uint8Array, opts?: { shuffle?: boolean }): Uint8Array {
  const shuffle = opts?.shuffle ?? true;
  const nbytes = data.length;
  const nblocks = Math.ceil(nbytes / BLOCKSIZE);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 16 + 4 * nblocks;
  for (let b = 0; b < nblocks; b++) {
    const bsize = Math.min(BLOCKSIZE, nbytes - b * BLOCKSIZE);
    const block = data.subarray(b * BLOCKSIZE, b * BLOCKSIZE + bsize);
    const stored = shuffle ? shuffleBytes(TS, block) : block;
    const nstreams = bsize === BLOCKSIZE ? TS : 1; // ← luật "block lẻ không chia"
    const neblock = Math.floor(bsize / nstreams);
    offsets.push(pos);
    for (let s = 0; s < nstreams; s++) {
      const head = new Uint8Array(4);
      new DataView(head.buffer).setInt32(0, neblock, true); // csz == neblock ⇒ thô
      parts.push(head, stored.slice(s * neblock, (s + 1) * neblock));
      pos += 4 + neblock;
    }
  }
  const out = new Uint8Array(pos);
  const dv = new DataView(out.buffer);
  out[0] = 2; // version
  out[1] = 1; // versionlz
  out[2] = (shuffle ? 0x01 : 0) | (1 << 5); // shuffle + codec lz4
  out[3] = TS;
  dv.setUint32(4, nbytes, true);
  dv.setUint32(8, BLOCKSIZE, true);
  dv.setUint32(12, pos, true);
  for (let b = 0; b < nblocks; b++) dv.setInt32(16 + 4 * b, offsets[b], true);
  let p = 16 + 4 * nblocks;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

const ramp = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0xff);

describe("bloscDecompress", () => {
  it("đọc đúng header 16 byte", () => {
    const h = parseBloscHeader(buildBlosc(ramp(576)));
    expect(h.typesize).toBe(4);
    expect(h.nbytes).toBe(576);
    expect(h.blocksize).toBe(BLOCKSIZE);
    expect(h.compcode).toBe(1); // lz4
    expect(h.doShuffle).toBe(true);
    expect(h.memcpyed).toBe(false);
    expect(h.bitShuffle).toBe(false);
  });

  it("một block tròn (chia 4 luồng) giải đúng", () => {
    const data = ramp(512);
    expect([...bloscDecompress(buildBlosc(data))]).toEqual([...data]);
  });

  it("CHẶN HỒI QUY: block CUỐI lẻ KHÔNG chia luồng", () => {
    // 576 = 512 (chia 4 luồng) + 64 (lẻ ⇒ 1 luồng). Nếu decoder chia 4 cho block
    // lẻ thì neblock = 16 ≠ 64 → vỡ đúng như lỗi đã dính khi dò kho thật.
    const data = ramp(576);
    expect([...bloscDecompress(buildBlosc(data))]).toEqual([...data]);
  });

  it("nhiều block + đuôi lẻ 1 byte", () => {
    const data = ramp(BLOCKSIZE * 3 + 1);
    expect([...bloscDecompress(buildBlosc(data))]).toEqual([...data]);
  });

  it("không shuffle vẫn đúng", () => {
    const data = ramp(576);
    expect([...bloscDecompress(buildBlosc(data, { shuffle: false }))]).toEqual([...data]);
  });

  it("cờ memcpyed → chép thẳng", () => {
    const data = ramp(40);
    const buf = new Uint8Array(16 + data.length);
    const dv = new DataView(buf.buffer);
    buf[2] = 0x02; // memcpyed
    buf[3] = TS;
    dv.setUint32(4, data.length, true);
    dv.setUint32(8, data.length, true);
    dv.setUint32(12, buf.length, true);
    buf.set(data, 16);
    expect([...bloscDecompress(buf)]).toEqual([...data]);
  });

  it("bit-shuffle và codec lạ thì NÉM (không trả rác)", () => {
    const bit = buildBlosc(ramp(512));
    bit[2] |= 0x04;
    expect(() => bloscDecompress(bit)).toThrow(/bit-shuffle/);
    const zstd = buildBlosc(ramp(512));
    zstd[2] = (zstd[2] & 0x1f) | (5 << 5); // codec 5 = zstd
    expect(() => bloscDecompress(zstd)).toThrow(/codec/);
  });

  it("buffer ngắn hơn header thì NÉM", () => {
    expect(() => parseBloscHeader(new Uint8Array(8))).toThrow();
  });
});

/* ---------------------------------------------------------------------------
   Fixture THẬT: chunk `latitude/0` của kho ARCO (826 byte, lz4 + shuffle)
   Tải 2026-07-26. Giải ra 2041 float32: -80 … 90 bước 1/3°, phần dư đệm NaN
   (shape = 511 nhưng chunk = 2041 nên Zarr đệm đuôi).
--------------------------------------------------------------------------- */

const LAT_CHUNK_B64 =
  "AgEhBOQfAADkHwAAOgMAABQAAABiAAAAbwBVqwBVqwYAGF+rVQCrVQYASA+KABcCKgAPkAAFAh4A" +
  "AgYAAiQAcVWrAKurAKsPAAgYAAUeAAIVAAsGAAIeAA8GABcLPwAPDwA+D4oAFw8qABEPAQD/////" +
  "/+dQAAAAAABiAAAAbwBVqgBVqgYAGF+qVQCqVQYASA+KABcCKgAPkAAFAh4AAgYAAiQAcVWqAKqq" +
  "AKoPAAgYAAUeAAIVAAsGAAIeAA8GABcLPwAPDwA+D4oAFw8qABEPAQD//////+dQAAAAAAAWAgAA" +
  "///3oJ+enp2cnJuampmYmJeWlpWUlJOSkpGQkI+Ojo2MjIuKiomIiIeGhoWEhIOCgoGAgH59fHp5" +
  "eHZ1dHJxcG5tbGppaGZlZGJhYF5dXFpZWFZVVFJRUE5NTEpJSEZFREJBQD49PDo5ODY1NDIxMC4t" +
  "LCopKCYlJCIhIB4dHBoZGBYVFBIREA4NDAoJCAYFBAIBAP36+PXy8O3q6OXi4N3a2NXS0M3KyMXC" +
  "wL26uLWysK2qqKWioJ2amJWSkI2KiIWCgHp1cGplYFpVUEpFQDo1MColIBoVEAoFAPXq4NXKwLWq" +
  "oJWKgGpVQCoVANWqgCqqAKoqgKrVABUqQFVqgIqVoKq1wMrV4Or1AAUKEBUaICUqMDU6QEVKUFVa" +
  "YGVqcHV6gIKFiIqNkJKVmJqdoKKlqKqtsLK1uLq9wMLFyMrN0NLV2Nrd4OLl6Ort8PL1+Pr9AAEC" +
  "BAUGCAkKDA0OEBESFBUWGBkaHB0eICEiJCUmKCkqLC0uMDEyNDU2ODk6PD0+QEFCREVGSElKTE1O" +
  "UFFSVFVWWFlaXF1eYGFiZGVmaGlqbG1ucHFydHV2eHl6fH1+gICBgoKDhISFhoaHiIiJioqLjIyN" +
  "jo6PkJCRkpKTlJSVlpaXmJiZmpqbnJydnp6foKChoqKjpKSlpqanqKipqqqrrKytrq6vsLCxsrKz" +
  "tMDAwMDAwAYA///////hUMDAwMDAPAAAAB/CAQB9H8EBADQdwAEA+QG/v7+/vgA+Pz8/P0BAQEBA" +
  "BQAfQQEANB9CAQCbH38BAP//////5lB/f39/fw==";

function b64(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, "base64"));
}

describe("decodeFloat32Chunk trên chunk THẬT của Copernicus", () => {
  const lat = decodeFloat32Chunk(b64(LAT_CHUNK_B64));

  it("giải đúng cỡ chunk khai báo (2041 giá trị f4)", () => {
    expect(lat.length).toBe(2041);
  });

  it("trục vĩ độ -80…90 bước 1/3°", () => {
    expect(lat[0]).toBeCloseTo(-80, 5);
    expect(lat[1] - lat[0]).toBeCloseTo(1 / 3, 4);
    expect(lat[510]).toBeCloseTo(90, 4);
  });

  it("đuôi ngoài shape (511) là NaN đệm — phải bỏ khi chọn chỉ số", () => {
    expect(Number.isNaN(lat[511])).toBe(true);
    expect(Number.isNaN(lat[2040])).toBe(true);
    // nearestIndex bỏ qua NaN nên không bao giờ chọn trúng phần đệm
    expect(nearestIndex(lat, 10)).toBe(270); // lat[270] = -80 + 270/3 = 10
  });
});

/* ---------------------------------------------------------------------------
   Metadata Zarr
--------------------------------------------------------------------------- */

const ZMETA = {
  metadata: {
    "utotal/.zarray": {
      shape: [50448, 1, 511, 1080],
      chunks: [1, 1, 511, 1080],
      dtype: "<f4",
      fill_value: 9.969209968386869e36,
    },
    "time/.zarray": { shape: [3], chunks: [3], dtype: "<f4", fill_value: "NaN" },
    "time/.zattrs": { units: "hours since 1950-01-01", calendar: "gregorian" },
  },
};

describe("metadata Zarr", () => {
  it("đọc .zarray", () => {
    const m = readZarrArrayMeta(ZMETA, "utotal")!;
    expect(m.shape).toEqual([50448, 1, 511, 1080]);
    expect(m.chunks).toEqual([1, 1, 511, 1080]);
    expect(m.dtype).toBe("<f4");
    expect(m.fillValue).toBeCloseTo(9.969209968386869e36, -30);
  });

  it("fill_value dạng chuỗi \"NaN\" → NaN", () => {
    expect(Number.isNaN(readZarrArrayMeta(ZMETA, "time")!.fillValue)).toBe(true);
  });

  it("mảng không có → null (không ném)", () => {
    expect(readZarrArrayMeta(ZMETA, "khongton")).toBeNull();
    expect(readZarrArrayMeta(null, "utotal")).toBeNull();
  });

  it("đọc .zattrs", () => {
    expect(readZarrAttr(ZMETA, "time", "units")).toBe("hours since 1950-01-01");
    expect(readZarrAttr(ZMETA, "time", "khongco")).toBeUndefined();
  });
});

/* ---------------------------------------------------------------------------
   Trục thời gian
--------------------------------------------------------------------------- */

describe("trục thời gian CF", () => {
  it("parse \"hours since 1950-01-01\" (mặc định UTC)", () => {
    const u = parseCfTimeUnits("hours since 1950-01-01")!;
    expect(u.msPerUnit).toBe(3_600_000);
    expect(u.epochMs).toBe(Date.UTC(1950, 0, 1));
  });

  it("chấp nhận dạng có giờ và các đơn vị khác", () => {
    expect(parseCfTimeUnits("days since 1970-01-01 00:00:00")).toEqual({
      epochMs: 0,
      msPerUnit: 86_400_000,
    });
    expect(parseCfTimeUnits("seconds since 1970-01-01T00:00:00Z")!.msPerUnit).toBe(1000);
  });

  it("đơn vị lạ → null", () => {
    expect(parseCfTimeUnits("parsecs since forever")).toBeNull();
    expect(parseCfTimeUnits("hours since khong-phai-ngay")).toBeNull();
  });

  it("giá trị trục → ISO đúng (mốc thật đã đo trên kho)", () => {
    const u = parseCfTimeUnits("hours since 1950-01-01")!;
    // 620928 h = 2020-11-01T00:00Z (giá trị đầu trục của dataset)
    expect(new Date(cfTimeToMs(620928, u)).toISOString()).toBe("2020-11-01T00:00:00.000Z");
  });
});

describe("nearestIndex — chọn mốc giờ GẦN nhất", () => {
  const times = [100, 101, 102, 103, NaN, NaN]; // NaN = đuôi đệm chunk cuối

  it("chọn đúng mốc gần nhất, kể cả khi lệch nửa giờ", () => {
    expect(nearestIndex(times, 102.4)).toBe(2);
    expect(nearestIndex(times, 102.6)).toBe(3);
  });

  it("target ngoài dải thì kẹp về đầu/cuối hữu hạn", () => {
    expect(nearestIndex(times, 0)).toBe(0);
    expect(nearestIndex(times, 9999)).toBe(3);
  });

  it("bỏ qua NaN đệm và mảng rỗng", () => {
    expect(nearestIndex([NaN, NaN], 5)).toBe(-1);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

/* ---------------------------------------------------------------------------
   Toạ độ / bbox / lon convention
--------------------------------------------------------------------------- */

describe("quy ước kinh độ", () => {
  it("hộp biển VN giống nhau ở cả hai hệ", () => {
    expect(lonToAxis(102, true)).toBe(102);
    expect(lonToAxis(118, true)).toBe(118);
    expect(lonToAxis(102, false)).toBe(102);
  });

  it("hệ có dấu (-180..180) của Copernicus", () => {
    expect(lonToAxis(250, true)).toBe(-110);
    expect(lonToAxis(-110, true)).toBe(-110);
    expect(lonToAxis(181, true)).toBe(-179);
  });

  it("hệ 0..360", () => {
    expect(lonToAxis(-110, false)).toBe(250);
    expect(lonToEast(-110)).toBe(250);
    expect(lonToEast(110)).toBe(110);
  });
});

describe("axisRange — cắt bbox", () => {
  const lons = [100, 101, 102, 103, 104, 105];

  it("lấy đúng dải bao gồm hai đầu", () => {
    expect(axisRange(lons, 102, 104)).toEqual({ start: 2, count: 3 });
  });

  it("bbox trùm cả trục", () => {
    expect(axisRange(lons, 0, 400)).toEqual({ start: 0, count: 6 });
  });

  it("bbox không giao trục → count 0", () => {
    expect(axisRange(lons, 200, 210)).toEqual({ start: 0, count: 0 });
  });

  it("bỏ qua NaN đệm cuối chunk", () => {
    expect(axisRange([100, 101, 102, NaN, NaN], 100, 200)).toEqual({ start: 0, count: 3 });
  });
});

describe("isFill / isAscending", () => {
  const FILL = 9.969209968386869e36;

  it("nhận fill_value kể cả sau khi float32 làm tròn", () => {
    expect(isFill(Math.fround(FILL), FILL)).toBe(true);
    expect(isFill(0.25, FILL)).toBe(false);
    expect(isFill(-3.5, FILL)).toBe(false);
  });

  it("NaN luôn là thiếu", () => {
    expect(isFill(NaN, FILL)).toBe(true);
    expect(isFill(NaN, NaN)).toBe(true);
  });

  it("isAscending bắt trục vắt qua kinh tuyến 0", () => {
    expect(isAscending([102, 103, 104])).toBe(true);
    expect(isAscending([358, 359, 0, 1])).toBe(false);
    expect(isAscending([5, 5])).toBe(false);
  });
});

describe("sliceToGrid — cắt lát toàn cầu về ScalarGrid", () => {
  const FILL = 9.969209968386869e36;
  // "thế giới" 3 vĩ × 4 kinh, hàng-chính; ô (1,2) là đất → fill
  const lats = [4, 5, 6];
  const lons = [100, 101, 102, 103];
  const data = [
    0.1, 0.2, 0.3, 0.4, //
    0.5, 0.6, FILL, 0.8, //
    0.9, 1.0, 1.1, 1.2,
  ];
  const grid = sliceToGrid({
    data,
    lats,
    lons,
    latSel: { start: 1, count: 2 },
    lonSel: { start: 1, count: 3 },
    fillValue: FILL,
    date: "2026-07-26",
  });

  it("cắt đúng hộp con", () => {
    expect(grid.lats).toEqual([5, 6]);
    expect(grid.lons).toEqual([101, 102, 103]);
    expect(grid.date).toBe("2026-07-26");
  });

  it("giá trị lấy đúng ô (hàng-chính, không lệch chỉ số)", () => {
    expect(grid.values[0][0]).toBeCloseTo(0.6);
    expect(grid.values[0][2]).toBeCloseTo(0.8);
    expect(grid.values[1]).toEqual([1.0, 1.1, 1.2]);
  });

  it("fill_value → NaN (KHÔNG lọt số 1e37 vào mô hình)", () => {
    expect(Number.isNaN(grid.values[0][1])).toBe(true);
  });

  it("lon âm của kho (-180..180) → độ Đông dương cho app", () => {
    const g = sliceToGrid({
      data: [1, 2, 3],
      lats: [10],
      lons: [-110, -109, -108],
      latSel: { start: 0, count: 1 },
      lonSel: { start: 0, count: 3 },
      fillValue: FILL,
      date: "2026-07-26",
    });
    expect(g.lons).toEqual([250, 251, 252]);
  });

  it("khớp shape ScalarGrid của fish-predict (values[iLat][iLon])", () => {
    expect(grid.values.length).toBe(grid.lats.length);
    expect(grid.values[0].length).toBe(grid.lons.length);
  });
});
