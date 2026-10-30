import { describe, it, expect, vi, beforeAll } from "vitest";

const goc = vi.fn(async () => new Response("mang", { status: 200 }));
let mod: typeof import("@/lib/goi-nguon-om");

beforeAll(async () => {
  vi.stubGlobal("fetch", goc);
  mod = await import("@/lib/goi-nguon-om");
});

const OM = "https://api.open-meteo.com/v1/forecast?latitude=10&longitude=107&forecast_days=4";

describe("goi-nguon-om — gói nguồn Open-Meteo từ máy nhà", () => {
  it("laUrlOM chỉ nhận https *.open-meteo.com", () => {
    expect(mod.laUrlOM(OM)).toBe(true);
    expect(mod.laUrlOM("https://marine-api.open-meteo.com/v1/marine?x=1")).toBe(true);
    expect(mod.laUrlOM("http://api.open-meteo.com/v1/forecast")).toBe(false);
    expect(mod.laUrlOM("https://open-meteo.com.evil.vn/x")).toBe(false);
    expect(mod.laUrlOM("khong-phai-url")).toBe(false);
  });

  it("docGoiOM kiểm thân: sai hình / URL lạ / thân rỗng ⇒ null", () => {
    expect(mod.docGoiOM(null)).toBeNull();
    expect(mod.docGoiOM({ goi: [] })).toBeNull();
    expect(mod.docGoiOM({ goi: {} })).toBeNull();
    expect(mod.docGoiOM({ goi: { "https://evil.vn/x": "{}" } })).toBeNull();
    expect(mod.docGoiOM({ goi: { [OM]: "" } })).toBeNull();
    expect(mod.docGoiOM({ goi: { [OM]: 5 } })).toBeNull();
    expect(mod.docGoiOM({ goi: { [OM]: "{}" } })?.get(OM)).toBe("{}");
  });

  it("docGoiOM chặn gói quá trần số URL", () => {
    const goi = Object.fromEntries([1, 2, 3].map((n) => [`${OM}&n=${n}`, "{}"]));
    expect(mod.docGoiOM({ goi }, 2)).toBeNull();
    expect(mod.docGoiOM({ goi }, 3)?.size).toBe(3);
  });

  it("ghiUrlOM ghi URL Open-Meteo, trả 503 giả, không ra mạng", async () => {
    goc.mockClear();
    const urls = await mod.ghiUrlOM(async () => {
      const r = await fetch(OM);
      expect(r.status).toBe(503);
      await fetch(`${OM}&b=1`);
      throw new Error("lỗi do 503 giả");
    });
    expect(urls).toEqual([OM, `${OM}&b=1`]);
    expect(goc).not.toHaveBeenCalled();
  });

  it("chayVoiGoiOM: URL có trong gói ⇒ thân trong gói; thiếu ⇒ gọi mạng, đếm trượt", async () => {
    goc.mockClear();
    const { kq, trung, truot } = await mod.chayVoiGoiOM(new Map([[OM, '{"a":1}']]), async () => {
      const a = await (await fetch(OM)).json();
      const b = await (await fetch(`${OM}&thieu=1`)).text();
      return { a, b };
    });
    expect(kq).toEqual({ a: { a: 1 }, b: "mang" });
    expect(trung).toBe(1);
    expect(truot).toBe(1);
    expect(goc).toHaveBeenCalledTimes(1);
  });

  it("ngoài hai chế độ (và URL không phải Open-Meteo) fetch chạy như cũ", async () => {
    goc.mockClear();
    await fetch(OM);
    await mod.chayVoiGoiOM(new Map([[OM, "{}"]]), () => fetch("https://abc.supabase.co/rest/v1/x"));
    expect(goc).toHaveBeenCalledTimes(2);
  });
});
