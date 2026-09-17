import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { brotliCompressSync } from "node:zlib";
import {
  DATA_MAGIC,
  DATA_HEADER_LEN,
  ENC_TABLE,
  DEC_TABLE,
  encodeData,
  decodeData,
  hasDataHeader,
  unsubstitute,
} from "@/lib/data-codec.mjs";
import { encodeDir } from "../../../scripts/encode-data.mjs";
import { fetchDataBytes, fetchDataJson, dataSourceUrl, DATA_PROTOCOL } from "@/lib/data-fetch";
import { DecodingSource, archiveKey } from "@/lib/pmtiles-protocol";
import type { Source } from "pmtiles";

/*  MÃ HOÁ FILE DỮ LIỆU PHÁT RA NGOÀI (2026-09-16) — cổng cho ba lớp:
    (1) bộ mã (data-codec.mjs): hoán vị đúng, vòng tròn, idempotent, nhận dạng;
    (2) đường tải (data-fetch.ts + DecodingSource): bản mã và bản rõ đều đọc ra
        cùng nội dung — dev chạy bản rõ, production chạy bản mã, MỘT đường code;
    (3) dây nối (cổng chữ): không chỗ nào trong src còn `fetch("/data/` trần,
        mọi `<Source data=` GeoJSON tĩnh đi qua `dataSourceUrl(`, script build
        gọi encode trước `next build`.
    Cộng một ĐO THẬT: hoán vị byte không làm nén Brotli tệ đi (lý do chọn nó). */

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public", "data");
const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder().decode(u);

describe("data-codec — bảng hoán vị", () => {
  it("ENC/DEC là hoán vị nghịch đảo của nhau trên đủ 256 giá trị", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 256; i++) {
      seen.add(ENC_TABLE[i]);
      expect(DEC_TABLE[ENC_TABLE[i]]).toBe(i);
    }
    expect(seen.size).toBe(256);
  });

  it("gần như không byte nào đứng yên — không có 'vùng rõ' lộ chữ", () => {
    let fixed = 0;
    for (let i = 0; i < 256; i++) if (ENC_TABLE[i] === i) fixed++;
    expect(fixed).toBeLessThan(8);
    // ký tự JSON hay gặp phải đổi hết
    for (const ch of '{}[]":,0123456789 \n') expect(ENC_TABLE[ch.charCodeAt(0)]).not.toBe(ch.charCodeAt(0));
  });

  it("vòng tròn: encode → decode trả đúng từng byte, kể cả 0x00 và 0xFF", () => {
    const all = new Uint8Array(512);
    for (let i = 0; i < 512; i++) all[i] = i & 0xff;
    const e = encodeData(all);
    expect(e.length).toBe(all.length + DATA_HEADER_LEN);
    expect(Array.from(e.subarray(0, 4))).toEqual([...DATA_MAGIC]);
    expect(Array.from(decodeData(e))).toEqual(Array.from(all));
  });

  it("idempotent: mã hoá bản đã mã thì trả nguyên — script chạy hai lần không mã chồng", () => {
    const e = encodeData(enc('{"a":1}'));
    expect(encodeData(e)).toBe(e);
  });

  it("bản RÕ (không header) đi qua decode thì trả nguyên — dev/test dùng chung đường", () => {
    const plain = enc('{"a":1}');
    expect(decodeData(plain)).toBe(plain);
    expect(hasDataHeader(plain)).toBe(false);
    expect(hasDataHeader(new Uint8Array(0))).toBe(false);
  });

  it("thân mã KHÔNG còn đọc được như JSON", () => {
    const e = encodeData(enc('{"v":1,"lights":[]}'));
    expect(() => JSON.parse(dec(e))).toThrow();
    expect(dec(e)).not.toContain("lights");
  });

  it("unsubstitute thuần vị trí: giải một lát giữa file đúng như giải cả file rồi cắt", () => {
    const body = enc("PMTiles".repeat(50));
    const e = encodeData(body);
    const lat = unsubstitute(e.subarray(DATA_HEADER_LEN + 100, DATA_HEADER_LEN + 140));
    expect(Array.from(lat)).toEqual(Array.from(body.subarray(100, 140)));
  });

  it("không file rõ nào trong public/data trùng 4 byte nhận dạng (bộ dò không nhầm)", () => {
    for (const f of readdirSync(DATA_DIR)) {
      if (!/\.(json|bin|pmtiles)$/.test(f)) continue;
      const head = new Uint8Array(readFileSync(join(DATA_DIR, f)).subarray(0, 4));
      expect(hasDataHeader(head), `${f} bắt đầu bằng SDF1 — bản rõ đang bị coi là bản mã`).toBe(false);
    }
  });

  it("ĐO THẬT: nén Brotli bản mã không tệ hơn bản rõ quá 5 % (lý do chọn hoán vị, không XOR)", () => {
    const plain = readFileSync(join(DATA_DIR, "seamarks.v1.json"));
    const e = encodeData(new Uint8Array(plain));
    const bp = brotliCompressSync(plain).length;
    const be = brotliCompressSync(e).length;
    expect(be / bp).toBeLessThan(1.05);
  });
});

describe("scripts/encode-data.mjs — mã hoá tại chỗ", () => {
  it("mã hoá .json/.bin/.pmtiles, bỏ qua đuôi khác, lần hai không đụng gì", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfish-enc-"));
    try {
      writeFileSync(join(dir, "a.json"), '{"x":1}');
      writeFileSync(join(dir, "b.bin"), Buffer.from([0, 0, 0, 7]));
      writeFileSync(join(dir, "c.pmtiles"), Buffer.from("PMTiles\x03"));
      writeFileSync(join(dir, "README.md"), "# để yên");
      const r1 = encodeDir(dir);
      expect(r1.encoded).toEqual(["a.json", "b.bin", "c.pmtiles"]);
      expect(r1.skipped).toEqual([]);
      expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("# để yên");
      expect(hasDataHeader(new Uint8Array(readFileSync(join(dir, "a.json"))))).toBe(true);
      expect(dec(decodeData(new Uint8Array(readFileSync(join(dir, "a.json")))))).toBe('{"x":1}');
      const r2 = encodeDir(dir);
      expect(r2.encoded).toEqual([]);
      expect(r2.skipped).toEqual(["a.json", "b.bin", "c.pmtiles"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("data-fetch — một cửa đọc, bản mã lẫn bản rõ", () => {
  afterEach(() => vi.unstubAllGlobals());
  const body = '{"v":1,"items":[1,2,3]}';
  const resp = (bytes: Uint8Array, ok = true, status = 200) => ({
    ok,
    status,
    arrayBuffer: async () => bytes.slice().buffer,
  });

  it("bản mã → JSON đúng", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(encodeData(enc(body)))));
    await expect(fetchDataJson("/data/x.json", 1000, "x")).resolves.toEqual({ v: 1, items: [1, 2, 3] });
  });

  it("bản rõ → JSON đúng (cùng đường code)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(enc(body))));
    await expect(fetchDataJson("/data/x.json", 1000, "x")).resolves.toEqual({ v: 1, items: [1, 2, 3] });
  });

  it("HTTP hỏng → ném '<nhãn> <mã>' như hợp đồng cũ của các lib", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(new Uint8Array(0), false, 404)));
    await expect(fetchDataJson("/data/x.json", 1000, "seamarks")).rejects.toThrow(/^seamarks 404$/);
  });

  it("fetchDataBytes trả ArrayBuffer đúng cỡ cho .bin mã hoá", async () => {
    const bin = new Uint8Array([0, 0, 0, 0, 9, 8, 7]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(encodeData(bin))));
    const buf = await fetchDataBytes("/data/x.bin", 1000, "x");
    expect(Array.from(new Uint8Array(buf))).toEqual(Array.from(bin));
  });

  it("dataSourceUrl gắn scheme cho MapLibre", () => {
    expect(dataSourceUrl("/data/isobaths.v1.json")).toBe(`${DATA_PROTOCOL}:///data/isobaths.v1.json`);
  });
});

describe("DecodingSource — lát cắt Range của .pmtiles", () => {
  const plain = enc("PMTiles\x03" + "x".repeat(200));
  const mk = (file: Uint8Array): Source => ({
    getKey: () => "/data/t.pmtiles",
    getBytes: async (o, l) => ({ data: file.slice(o, o + l).buffer as ArrayBuffer }),
  });
  const bytes = async (s: DecodingSource, o: number, l: number) =>
    Array.from(new Uint8Array((await s.getBytes(o, l)).data));

  it("file mã: header xin (0,16384) trả đúng thân rõ, lát sau dời offset qua header", async () => {
    const s = new DecodingSource(mk(encodeData(plain)));
    expect(await bytes(s, 0, 16)).toEqual(Array.from(plain.subarray(0, 16)));
    expect(await bytes(s, 100, 20)).toEqual(Array.from(plain.subarray(100, 120)));
  });

  it("file rõ: trả nguyên, không dời offset", async () => {
    const s = new DecodingSource(mk(plain));
    expect(await bytes(s, 0, 16)).toEqual(Array.from(plain.subarray(0, 16)));
    expect(await bytes(s, 100, 20)).toEqual(Array.from(plain.subarray(100, 120)));
  });

  it("lát đầu tiên KHÔNG ở offset 0 vẫn dò được (không đoán)", async () => {
    const s = new DecodingSource(mk(encodeData(plain)));
    expect(await bytes(s, 50, 10)).toEqual(Array.from(plain.subarray(50, 60)));
  });

  it("archiveKey: tách đường dẫn kho khỏi URL ô và URL tilejson", () => {
    expect(archiveKey("pmtiles:///data/vn-basemap.pmtiles/3/6/3")).toBe("/data/vn-basemap.pmtiles");
    expect(archiveKey("pmtiles:///data/vn-basemap.pmtiles")).toBe("/data/vn-basemap.pmtiles");
    expect(archiveKey("https://x/y.pmtiles")).toBeNull();
  });
});

describe("DÂY NỐI — cổng chữ (kiểu lỗi: file có, hàm có, mà không ai gọi)", () => {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const walk = (dir: string, out: string[] = []) => {
    for (const f of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(f.name) && !p.includes("__tests__")) out.push(p);
    }
    return out;
  };

  it("không còn `fetch(\"/data/` trần trong src — mọi lớp qua data-fetch", () => {
    const hits = walk("src").filter((p) => /fetch\(\s*"\/data\//.test(strip(read(p))));
    expect(hits, "còn tải thẳng file dữ liệu, bản mã sẽ đọc ra rác").toEqual([]);
  });

  it("mọi <Source geojson data=…> tĩnh trong fishing-map-view đi qua dataSourceUrl(", () => {
    const v = strip(read("src/components/fishing-map-view.tsx"));
    const raw = v.match(/data=\{[A-Z_]+_DATA_URL\}/g) ?? [];
    expect(raw, "Source đang để MapLibre tự fetch bản mã").toEqual([]);
    expect(v).toContain("data={dataSourceUrl(COAST_DATA_URL)}");
    expect(strip(read("src/lib/ocean-map.ts"))).toContain('dataSourceUrl("/data/isobaths.v1.json")');
  });

  it("vỏ fishing-map đăng ký cả hai protocol trước khi map dựng", () => {
    const v = strip(read("src/components/fishing-map.tsx"));
    expect(v).toContain("registerPmtilesProtocol()");
    expect(v).toContain("registerDataProtocol()");
  });

  it("`npm run build` mã hoá TRƯỚC `next build`", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: { build: string }; license: string };
    expect(pkg.scripts.build).toBe("node scripts/encode-data.mjs && next build");
    expect(pkg.license).toBe("UNLICENSED");
  });
});
