import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { hexOf } from "@/lib/data-codec.mjs";
import { keyIdOfSync } from "@/lib/data-key-server";
import {
  DATA_KEY_STORE,
  fetchDataKey,
  getDataKey,
  prefetchDataKey,
  __resetDataKeyCacheForTest,
} from "@/lib/data-key";

/*  KHO KHOÁ PHÍA MÁY (2026-09-16): xin ở /api/data-key, cất `forfish.datakey.v1`,
    RAM → kho → server; mọi lỗi mạng ⇒ null, KHÔNG ném; id server nói phải khớp
    băm của khoá; kho giữ tối đa 3 khoá; prefetch không tốn lượt khi kho có. */

const KEY = new Uint8Array(randomBytes(32));
const ID = keyIdOfSync(KEY);
const okResp = (body: unknown) => ({ ok: true, json: async () => body });

/*  Chạy ở môi trường Node (WebCrypto thật của Node), KHÔNG jsdom: jsdom vừa thiếu
    `crypto.subtle` vừa tạo ArrayBuffer khác realm làm webcrypto Node từ chối.
    localStorage giả bằng Map — đủ cho hợp đồng getItem/setItem. */
const mem = new Map<string, string>();
const ls = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: ls });
  ls.clear();
  __resetDataKeyCacheForTest();
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchDataKey", () => {
  it("nhận khoá đúng dạng, id khớp băm ⇒ cất vào kho", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResp({ ok: true, id: ID, key: hexOf(KEY) })));
    const got = await fetchDataKey();
    expect(got).toEqual({ id: ID, hex: hexOf(KEY) });
    expect(JSON.parse(ls.getItem(DATA_KEY_STORE)!)).toEqual({ [ID]: hexOf(KEY) });
  });

  it("server trả danh sách keys [hiện hành, trước đó] ⇒ cất cả hai, trả cái đầu; phần tử hỏng bị bỏ", async () => {
    const prev = new Uint8Array(randomBytes(32));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResp({
          ok: true,
          id: ID,
          key: hexOf(KEY),
          keys: [
            { id: ID, key: hexOf(KEY) },
            { id: keyIdOfSync(prev), key: hexOf(prev) },
            { id: "0".repeat(16), key: hexOf(prev) }, // id sai băm — bỏ
          ],
        }),
      ),
    );
    expect(await fetchDataKey()).toEqual({ id: ID, hex: hexOf(KEY) });
    const store = JSON.parse(ls.getItem(DATA_KEY_STORE)!) as Record<string, string>;
    expect(Object.keys(store).sort()).toEqual([ID, keyIdOfSync(prev)].sort());
    // file mã bằng khoá cũ vẫn mở được
    expect(await getDataKey(keyIdOfSync(prev))).not.toBeNull();
  });

  it("id KHÔNG khớp băm ⇒ bỏ (không tin server nói suông)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResp({ ok: true, id: "0".repeat(16), key: hexOf(KEY) })));
    expect(await fetchDataKey()).toBeNull();
    expect(ls.getItem(DATA_KEY_STORE)).toBeNull();
  });

  it("401/503/mất sóng/JSON rác ⇒ null, không ném", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await fetchDataKey()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("mat song")));
    expect(await fetchDataKey()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResp({ ok: true, id: ID, key: "zz" })));
    expect(await fetchDataKey()).toBeNull();
  });

  it("nhiều chỗ gọi cùng lúc ⇒ MỘT lượt mạng", async () => {
    const spy = vi.fn().mockResolvedValue(okResp({ ok: true, id: ID, key: hexOf(KEY) }));
    vi.stubGlobal("fetch", spy);
    await Promise.all([fetchDataKey(), fetchDataKey(), fetchDataKey()]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("getDataKey", () => {
  it("kho có sẵn ⇒ không gọi mạng; trả CryptoKey", async () => {
    ls.setItem(DATA_KEY_STORE, JSON.stringify({ [ID]: hexOf(KEY) }));
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const k = await getDataKey(ID);
    expect(k).not.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("kho trống ⇒ xin server; server trả id KHÁC ⇒ null và lần sau thử lại", async () => {
    const other = new Uint8Array(randomBytes(32));
    const spy = vi
      .fn()
      .mockResolvedValueOnce(okResp({ ok: true, id: keyIdOfSync(other), key: hexOf(other) }))
      .mockResolvedValueOnce(okResp({ ok: true, id: ID, key: hexOf(KEY) }));
    vi.stubGlobal("fetch", spy);
    expect(await getDataKey(ID)).toBeNull();
    expect(await getDataKey(ID), "lần 2 phải gọi lại — không khoá vĩnh viễn").not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("kho hỏng (JSON rác / giá trị lạ) ⇒ coi như trống, không ném", async () => {
    ls.setItem(DATA_KEY_STORE, "{rac");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await getDataKey(ID)).toBeNull();
    ls.setItem(DATA_KEY_STORE, JSON.stringify({ [ID]: 123 }));
    expect(await getDataKey(ID)).toBeNull();
  });

  it("kho giữ tối đa 3 khoá, đuổi khoá cũ nhất", async () => {
    const keys = [0, 1, 2, 3].map(() => new Uint8Array(randomBytes(32)));
    for (const k of keys) {
      __resetDataKeyCacheForTest();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResp({ ok: true, id: keyIdOfSync(k), key: hexOf(k) })));
      await fetchDataKey();
    }
    const store = JSON.parse(ls.getItem(DATA_KEY_STORE)!) as Record<string, string>;
    expect(Object.keys(store)).toHaveLength(3);
    expect(store[keyIdOfSync(keys[0])]).toBeUndefined();
    expect(store[keyIdOfSync(keys[3])]).toBe(hexOf(keys[3]));
  });
});

describe("prefetchDataKey", () => {
  it("kho trống ⇒ xin; kho có ⇒ im", () => {
    const spy = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", spy);
    prefetchDataKey();
    expect(spy).toHaveBeenCalledTimes(1);
    ls.setItem(DATA_KEY_STORE, JSON.stringify({ [ID]: hexOf(KEY) }));
    __resetDataKeyCacheForTest();
    prefetchDataKey();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
