// KHOÁ GÓI cho file dữ liệu (2026-10-27, anh Long: "tất cả tải lưu server đi"): file PREMIUM_SDF2 mã bằng khoá gói
// RIÊNG (ngẫu nhiên, app_config.data_key_premium); tài khoản thường không có khoá đó ⇒ file tải về không giải được;
// máy không gọi /api/data-key dồn dập.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hexOf, parseHeader2 } from "@/lib/data-codec.mjs";
import { keyIdOfSync } from "@/lib/data-key-server";
import { PREMIUM_SDF2 } from "@/lib/data-premium-files.mjs";
import { encodeDir } from "../../../scripts/encode-data.mjs";
import { __resetDataKeyCacheForTest, getDataKey } from "@/lib/data-key";

const KEY = new Uint8Array(randomBytes(32));
const GOI = new Uint8Array(randomBytes(32));

describe("khoá gói", () => {
  it("danh sách gói gồm lớp Allen, độ sâu rạn, mùa vụ cá — không gồm nền bản đồ", () => {
    for (const f of ["reef-shapes-aca.v1.pmtiles", "chat-day.v1.pmtiles", "chat-day.v1.json", "reef-depth.v1.bin", "fish-climatology.v1.json"])
      expect(PREMIUM_SDF2.has(f), f).toBe(true);
    for (const f of ["vn-basemap.pmtiles", "seamarks.v1.json", "coral-reefs.v1.json", "depth-grid.v1.bin"]) expect(PREMIUM_SDF2.has(f), f).toBe(false);
  });
  it("encodeDir: file gói mang id khoá gói, file thường mang id khoá chủ", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfish-goi-"));
    try {
      writeFileSync(join(dir, "chat-day.v1.json"), '{"a":1}');
      writeFileSync(join(dir, "vn-coast.v1.json"), '{"b":2}');
      encodeDir(dir, { key: KEY, premiumKey: GOI });
      const id = (n: string) => parseHeader2(new Uint8Array(readFileSync(join(dir, n))))!.keyId;
      expect(id("chat-day.v1.json")).toBe(keyIdOfSync(GOI));
      expect(id("vn-coast.v1.json")).toBe(keyIdOfSync(KEY));
      // thiếu khoá gói ⇒ build ĐỎ (không lặng lẽ mã bằng khoá chủ — tài khoản thường sẽ đọc được)
      writeFileSync(join(dir, "reef-depth.v1.bin"), Buffer.from([1, 2, 3]));
      expect(() => encodeDir(dir, { key: KEY })).toThrow(/KHOÁ GÓI/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("getDataKey — tài khoản thường hỏi khoá gói", () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } });
    mem.clear();
    __resetDataKeyCacheForTest();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("server không trao ⇒ null, và 10 phút sau mới hỏi lại (không đốt trần 30 lượt/ngày)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: keyIdOfSync(KEY), key: hexOf(KEY) }) });
    vi.stubGlobal("fetch", f);
    const idGoi = keyIdOfSync(GOI);
    expect(await getDataKey(idGoi)).toBeNull();
    expect(await getDataKey(idGoi)).toBeNull();
    expect(await getDataKey(idGoi)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("premium: server trả cả khoá gói ⇒ giải được", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, keys: [{ id: keyIdOfSync(KEY), key: hexOf(KEY) }, { id: keyIdOfSync(GOI), key: hexOf(GOI) }] }) }));
    expect(await getDataKey(keyIdOfSync(GOI))).not.toBeNull();
  });
});
