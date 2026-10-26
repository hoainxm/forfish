// Cất sẵn ảnh giấy tờ vào kho máy để Xuất trình khi mất sóng (rà UI 2026-10-26, lib/doc-photos luuSanAnhGiay).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kho = new Set<string>();
vi.mock("@/lib/giay-anh-kho", () => ({
  coAnhGiay: vi.fn(async (p: string) => kho.has(p)),
  layAnhGiay: vi.fn(async (p: string) => (kho.has(p) ? new Blob(["x"]) : null)),
  catAnhGiay: vi.fn(async (p: string) => (kho.add(p), true)),
  xoaAnhGiay: vi.fn(async () => {}),
}));
vi.mock("@/lib/device-token-store", () => ({
  authedFetch: vi.fn(async (path: string) => ({ res: new Response(JSON.stringify({ url: `https://kho.test/${encodeURIComponent(path)}` }), { status: 200 }) })),
}));

import { luuSanAnhGiay } from "@/lib/doc-photos";

describe("luuSanAnhGiay", () => {
  beforeEach(() => {
    kho.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["anh"]), { status: 200 })));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ảnh chưa có trong kho thì tải về cất; ảnh đã có thì bỏ qua (không tốn mạng)", async () => {
    kho.add("0901/a/1.jpg");
    const n = await luuSanAnhGiay(["0901/a/1.jpg", "0901/b/2.jpg", "0901/c/3.jpg"]);
    expect(n).toBe(2);
    expect(kho.has("0901/b/2.jpg") && kho.has("0901/c/3.jpg")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2); // không rò blob: URL
  });

  it("bị huỷ (rời màn) ⇒ dừng ngay, không tải thêm", async () => {
    const c = new AbortController();
    c.abort();
    expect(await luuSanAnhGiay(["0901/a/1.jpg"], c.signal)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mất sóng giữa chừng ⇒ dừng; mạng hỏng ⇒ không ném, không đếm", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("network");
    }));
    await expect(luuSanAnhGiay(["0901/a/1.jpg"])).resolves.toBe(0);
    const goc = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    try {
      expect(await luuSanAnhGiay(["0901/b/2.jpg"])).toBe(0);
    } finally {
      if (goc) Object.defineProperty(navigator, "onLine", goc);
      else delete (navigator as unknown as Record<string, unknown>).onLine;
    }
  });
});
