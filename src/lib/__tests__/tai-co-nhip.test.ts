// Tải có nhịp (2026-10-26): chỉ huỷ khi dữ liệu NGỪNG CHẢY, không cắt file lớn đang về đều trên mạng chậm.
import { afterEach, describe, expect, it, vi } from "vitest";
import { boCanhNhip, NgungChayError, taiCoNhip, taiJsonCoNhip } from "@/lib/tai-co-nhip";

/** Response có thân là các gói về cách nhau `cachMs` (đồng hồ giả). Huỷ signal ⇒ stream lỗi như trình duyệt. */
function phanHoiChay(goi: string[], cachMs: number, signal?: AbortSignal | null): Response {
  const enc = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      return new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          if (i < goi.length) ctrl.enqueue(enc.encode(goi[i++]));
          else ctrl.close();
          resolve();
        }, cachMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    },
  });
  return new Response(stream, { status: 200 });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("taiCoNhip", () => {
  it("file về CHẬM mà ĐỀU (tổng 50 s, mỗi gói 5 s) với trần ngừng chảy 20 s ⇒ tải XONG (trần tổng cũ 20 s sẽ cắt)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: RequestInit) => phanHoiChay(Array.from({ length: 10 }, (_, k) => String(k)), 5000, init?.signal)));
    const p = taiCoNhip("/data/x.bin", {}, 20000);
    await vi.advanceTimersByTimeAsync(60000);
    const { res, body } = await p;
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(body)).toBe("0123456789");
  });

  it("dữ liệu NGỪNG chảy quá trần ⇒ ném NgungChayError, không treo", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: RequestInit) => phanHoiChay(["a", "b"], 30000, init?.signal)));
    const p = taiCoNhip("/data/x.bin", {}, 10000);
    const kq = expect(p).rejects.toBeInstanceOf(NgungChayError);
    await vi.advanceTimersByTimeAsync(15000);
    await kq;
  });

  it("phản hồi đầu không về trong trần ⇒ huỷ (sóng sống mà chết)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: unknown, init?: RequestInit) =>
          new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" })))),
      ),
    );
    const p = taiCoNhip("/api/x", {}, 8000);
    const kq = expect(p).rejects.toBeInstanceOf(NgungChayError);
    await vi.advanceTimersByTimeAsync(9000);
    await kq;
  });

  it("tín hiệu ngoài huỷ (rời màn) ⇒ ném lỗi thường, KHÔNG phải ngừng chảy", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: RequestInit) => phanHoiChay(["a", "b", "c"], 1000, init?.signal)));
    const c = new AbortController();
    const p = taiCoNhip("/data/x.bin", {}, 20000, c.signal);
    const kq = p.then(
      () => "xong",
      (e: Error) => e.name,
    );
    await vi.advanceTimersByTimeAsync(1500);
    c.abort();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await kq).not.toBe("NgungChayError");
    expect(await kq).not.toBe("xong");
  });

  it("taiJsonCoNhip parse JSON; thân hỏng ⇒ json null, không ném", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"a":1}', { status: 200 })));
    expect((await taiJsonCoNhip<{ a: number }>("/api/x", {}, 5000)).json).toEqual({ a: 1 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    const r = await taiJsonCoNhip("/api/x", {}, 5000);
    expect(r.res.status).toBe(502);
    expect(r.json).toBeNull();
  });
});

describe("boCanhNhip", () => {
  it("mỗi nhịp đẩy lùi hạn; im quá hạn ⇒ huỷ; xong() gỡ đồng hồ", () => {
    vi.useFakeTimers();
    const c = boCanhNhip(1000);
    vi.advanceTimersByTime(900);
    c.nhip();
    vi.advanceTimersByTime(900);
    expect(c.signal.aborted).toBe(false);
    vi.advanceTimersByTime(200);
    expect(c.signal.aborted).toBe(true);
    expect(c.daNgung()).toBe(true);
    const d = boCanhNhip(1000);
    d.xong();
    vi.advanceTimersByTime(5000);
    expect(d.signal.aborted).toBe(false);
  });
});
