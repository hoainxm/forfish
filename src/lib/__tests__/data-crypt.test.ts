import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, createCipheriv } from "node:crypto";
import { gzipSync, deflateRawSync } from "node:zlib";
import {
  DATA_HEADER2_LEN,
  buildHeader2,
  parseHeader2,
  hasDataHeader2,
  hasDataHeader,
  counterAt,
  hexOf,
  bytesOfHex,
} from "@/lib/data-codec.mjs";
import { gunzip, inflateRaw } from "@/lib/inflate.mjs";
import {
  importAesKey,
  keyIdOf,
  aesCtrDecryptAt,
  gunzipBytes,
  decryptFile,
} from "@/lib/data-crypt";
import { DecodingSource } from "@/lib/pmtiles-protocol";
import { parseDataKeyHex, keyIdOfSync, dataKeyPayload } from "@/lib/data-key-server";
import { encodeCurated, encodeDir, keyIdBytes, CURATED } from "../../../scripts/encode-data.mjs";
import type { Source } from "pmtiles";

/*  SDF2 — NHÓM BIÊN TẬP: gzip + AES-256-CTR, khoá theo tài khoản (2026-09-16).
    Cổng cho: (1) header dựng/đọc đúng; (2) Node mã (script build) → WebCrypto
    giải (app) ra đúng từng byte, cả trọn file lẫn lát Range ở offset lẻ;
    (3) gunzip cả đường DecompressionStream lẫn đường lùi inflate thuần, đối
    chiếu zlib trên FILE THẬT; (4) DecodingSource với file SDF2 (pmtiles);
    (5) script `encodeDir` chia đúng hai nhóm và ĐỎ khi thiếu khoá; (6) key id
    server/script/client cùng một công thức; (7) tide-stations KHÔNG nằm trong
    nhóm biên tập (thẻ Trang chủ cho khách). */

const KEY = new Uint8Array(randomBytes(32));
const enc = (s: string) => new TextEncoder().encode(s);
const eq = (a: Uint8Array, b: Uint8Array) => expect(Array.from(a)).toEqual(Array.from(b));
const DATA_DIR = join(process.cwd(), "public", "data");

describe("header SDF2", () => {
  it("dựng rồi đọc lại đúng cờ, key id, nonce", () => {
    const nonce = new Uint8Array(16);
    nonce.set(randomBytes(8), 0);
    const h = buildHeader2({ gzip: true, keyId: keyIdBytes(KEY), nonce });
    expect(h.length).toBe(DATA_HEADER2_LEN);
    expect(hasDataHeader2(h)).toBe(true);
    expect(hasDataHeader(h), "SDF2 không được nhầm thành SDF1").toBe(false);
    const p = parseHeader2(h)!;
    expect(p.gzip).toBe(true);
    expect(p.keyId).toBe(hexOf(keyIdBytes(KEY)));
    eq(p.nonce, nonce);
    expect(parseHeader2(enc('{"a":1}'))).toBeNull();
  });

  it("counterAt: 8 byte thấp = số khối big-endian, 8 byte cao giữ nguyên", () => {
    const nonce = new Uint8Array(16).fill(0xab, 0, 8);
    const c = counterAt(nonce, 0x0102030405);
    expect(Array.from(c.subarray(0, 8))).toEqual(new Array(8).fill(0xab));
    expect(Array.from(c.subarray(8))).toEqual([0, 0, 0, 1, 2, 3, 4, 5]);
  });

  it("hex ↔ byte", () => {
    expect(hexOf(new Uint8Array([0, 15, 255]))).toBe("000fff");
    eq(bytesOfHex("000fff")!, new Uint8Array([0, 15, 255]));
    expect(bytesOfHex("abc")).toBeNull();
    expect(bytesOfHex("zz")).toBeNull();
  });
});

describe("key id — một công thức ở ba nơi", () => {
  it("script (keyIdBytes) = server (keyIdOfSync) = client (keyIdOf)", async () => {
    expect(hexOf(keyIdBytes(KEY))).toBe(keyIdOfSync(KEY));
    expect(await keyIdOf(KEY)).toBe(keyIdOfSync(KEY));
    expect(keyIdOfSync(KEY)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("parseDataKeyHex: đúng 64 hex, còn lại null", () => {
    const hex = hexOf(KEY);
    eq(parseDataKeyHex(hex)!, KEY);
    eq(parseDataKeyHex(`  ${hex}\n`)!, KEY);
    expect(parseDataKeyHex(hex.slice(2))).toBeNull();
    expect(parseDataKeyHex(undefined)).toBeNull();
    expect(parseDataKeyHex("")).toBeNull();
    const p = dataKeyPayload(KEY);
    expect(p).toEqual({ ok: true, id: keyIdOfSync(KEY), key: hex });
  });
});

describe("AES-CTR: Node mã → WebCrypto giải", () => {
  const nonce = new Uint8Array(16);
  nonce.set(randomBytes(8), 0);
  const plain = new Uint8Array(randomBytes(5000));
  const c = createCipheriv("aes-256-ctr", KEY, nonce);
  const cipher = new Uint8Array(Buffer.concat([c.update(plain), c.final()]));

  it("trọn file", async () => {
    const key = await importAesKey(KEY);
    eq(await aesCtrDecryptAt(key, nonce, cipher, 0), plain);
  });

  it("lát Range ở offset lẻ (không chia hết 16) — đúng như pmtiles xin", async () => {
    const key = await importAesKey(KEY);
    for (const [o, l] of [
      [0, 16],
      [1, 5],
      [15, 40],
      [16, 16],
      [17, 100],
      [4093, 907],
      [4999, 1],
    ] as const) {
      eq(await aesCtrDecryptAt(key, nonce, cipher.subarray(o, o + l), o), plain.subarray(o, o + l));
    }
  });

  it("khoá sai ⇒ ra rác, không ném (CTR không xác thực — tầng trên kiểm cỡ/parse)", async () => {
    const wrong = await importAesKey(new Uint8Array(randomBytes(32)));
    const out = await aesCtrDecryptAt(wrong, nonce, cipher, 0);
    expect(Array.from(out)).not.toEqual(Array.from(plain));
  });
});

describe("gunzip — DecompressionStream và đường lùi inflate thuần, đối chiếu zlib", () => {
  const files = ["soundings.v1.json", "vn-aids.v1.json", "den-bien.v1.json", "fish-climatology.v1.json"];
  for (const f of files) {
    it(`${f}: cả hai đường ra đúng từng byte`, async () => {
      const raw = new Uint8Array(readFileSync(join(DATA_DIR, f)));
      const gz = new Uint8Array(gzipSync(raw, { level: 9 }));
      eq(await gunzipBytes(gz, { native: true }), raw);
      eq(await gunzipBytes(gz, { native: false }), raw);
    });
  }

  it("inflate thuần: khối stored / fixed / dynamic, rỗng, ngẫu nhiên, có FNAME", () => {
    for (const [n, lvl] of [
      [0, 0],
      [3, 1],
      [50, 1],
      [70000, 6],
      [300000, 9],
    ] as const) {
      const rnd = new Uint8Array(randomBytes(n));
      const rep = rnd.slice();
      for (let i = (n / 2) | 0; i < n; i++) rep[i] = rep[i % 97];
      for (const src of [rnd, rep]) {
        eq(gunzip(new Uint8Array(gzipSync(src, { level: lvl }))), src);
      }
    }
    const s = enc("hello hello hello hello");
    eq(inflateRaw(new Uint8Array(deflateRawSync(s)), 0, 0).data, s);
    // gzip có FNAME: dựng tay từ deflateRaw
    const body = deflateRawSync(s);
    const hdr = Buffer.from([0x1f, 0x8b, 8, 8, 0, 0, 0, 0, 0, 3, 0x61, 0x2e, 0x74, 0]);
    const tail = Buffer.alloc(8);
    tail.writeUInt32LE(0, 0);
    tail.writeUInt32LE(s.length, 4);
    eq(gunzip(new Uint8Array(Buffer.concat([hdr, body, tail]))), s);
  });

  it("ISIZE lệch ⇒ ném, không trả dữ liệu cụt câm", () => {
    const gz = Buffer.from(gzipSync(enc("abcabcabc")));
    gz.writeUInt32LE(99, gz.length - 4);
    expect(() => gunzip(new Uint8Array(gz))).toThrow(/ISIZE/);
  });
});

describe("encodeCurated → decryptFile (đường thật của app)", () => {
  const getKey = async (id: string) => (id === keyIdOfSync(KEY) ? importAesKey(KEY) : null);

  it("json: gzip + AES → bản rõ", async () => {
    const raw = new Uint8Array(readFileSync(join(DATA_DIR, "vn-aids.v1.json")));
    const e = encodeCurated(raw, KEY, { gzip: true });
    expect(hasDataHeader2(e)).toBe(true);
    expect(e.length, "thân đã nén — phải nhỏ hơn bản rõ rõ rệt").toBeLessThan(raw.length / 2);
    eq(await decryptFile(e, getKey), raw);
  });

  it("không gzip (pmtiles/bin): AES thuần, cùng cỡ + header", async () => {
    const raw = new Uint8Array(randomBytes(1000));
    const e = encodeCurated(raw, KEY, { gzip: false });
    expect(e.length).toBe(raw.length + DATA_HEADER2_LEN);
    eq(await decryptFile(e, getKey), raw);
  });

  it("thiếu khoá ⇒ Error('no_key') để chỗ gọi xoá đệm, thử lại khi có sóng", async () => {
    const e = encodeCurated(enc('{"x":1}'), KEY, { gzip: true });
    await expect(decryptFile(e, async () => null)).rejects.toThrow(/^no_key$/);
  });
});

describe("DecodingSource với file SDF2 (pmtiles biên tập)", () => {
  const plain = enc("PMTiles\x03" + "x".repeat(300));
  const mk = (file: Uint8Array): Source => ({
    getKey: () => "/data/t.pmtiles",
    getBytes: async (o, l) => ({ data: file.slice(o, o + l).buffer as ArrayBuffer }),
  });
  const getKey = async (id: string) => (id === keyIdOfSync(KEY) ? importAesKey(KEY) : null);
  const bytes = async (s: DecodingSource, o: number, l: number) =>
    Array.from(new Uint8Array((await s.getBytes(o, l)).data));

  it("header rồi lát lẻ — đúng như thư viện pmtiles xin", async () => {
    const s = new DecodingSource(mk(encodeCurated(plain, KEY, { gzip: false })), getKey);
    expect(await bytes(s, 0, 16)).toEqual(Array.from(plain.subarray(0, 16)));
    expect(await bytes(s, 37, 50)).toEqual(Array.from(plain.subarray(37, 87)));
    expect(await bytes(s, 299, 9)).toEqual(Array.from(plain.subarray(299, 308)));
  });

  it("lát đầu không ở offset 0 vẫn dò được", async () => {
    const s = new DecodingSource(mk(encodeCurated(plain, KEY, { gzip: false })), getKey);
    expect(await bytes(s, 100, 10)).toEqual(Array.from(plain.subarray(100, 110)));
  });

  it("không có khoá ⇒ ném no_key (nền SDF1 khác kho, vẫn vẽ)", async () => {
    const s = new DecodingSource(mk(encodeCurated(plain, KEY, { gzip: false })), async () => null);
    await expect(s.getBytes(0, 16)).rejects.toThrow(/no_key/);
  });
});

describe("scripts/encode-data.mjs — hai nhóm", () => {
  it("nhóm biên tập → SDF2, còn lại → SDF1; lần hai bỏ qua hết", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfish-sdf2-"));
    try {
      writeFileSync(join(dir, "soundings.v1.json"), '{"diem":[]}');
      writeFileSync(join(dir, "vn-coast.v1.json"), '{"type":"FeatureCollection"}');
      writeFileSync(join(dir, "chat-day.v1.pmtiles"), Buffer.from("PMTiles\x03"));
      const r = encodeDir(dir, { key: KEY });
      expect(r.curated).toEqual(["chat-day.v1.pmtiles", "soundings.v1.json"]);
      expect(r.encoded).toEqual(["vn-coast.v1.json"]);
      expect(hasDataHeader2(new Uint8Array(readFileSync(join(dir, "soundings.v1.json"))))).toBe(true);
      expect(hasDataHeader(new Uint8Array(readFileSync(join(dir, "vn-coast.v1.json"))))).toBe(true);
      const r2 = encodeDir(dir, { key: KEY });
      expect(r2.curated).toEqual([]);
      expect(r2.encoded).toEqual([]);
      expect(r2.skipped).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("thiếu khoá mà có file biên tập ⇒ NÉM (build đỏ, không lặng lẽ rơi về SDF1)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfish-nokey-"));
    try {
      writeFileSync(join(dir, "vn-aids.v1.json"), '{"v":1}');
      expect(() => encodeDir(dir, { key: null })).toThrow(/SDFISH_DATA_KEY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mọi tên trong CURATED là file có thật, và tide-stations KHÔNG ở đó (thẻ Trang chủ cho khách)", () => {
    for (const f of CURATED) expect(() => readFileSync(join(DATA_DIR, f))).not.toThrow();
    expect(CURATED.has("tide-stations.v1.json")).toBe(false);
    expect(CURATED.has("vn-basemap.pmtiles")).toBe(false);
  });
});
