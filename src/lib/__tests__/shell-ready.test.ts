import { describe, it, expect, afterEach } from "vitest";
import { isShellReady, SHELL_READY_MARK } from "@/lib/shell-ready";

/*  DẤU "VỎ ĐÃ ĐỦ" PHẢI CHỨNG MINH ĐƯỢC (2026-08-02, audit A7/K5).
    Trước đây `isShellReady` chỉ hỏi "có entry đánh dấu không" — mà dấu đó chỉ
    chứng minh MỘT LẦN install nào đó trong quá khứ đã xong. Ba đường làm nó nói
    dối: install hỏng nửa chừng, `trimCache` đuổi chunk khung sườn, chunk mất do
    khe delete/put. Chip "sẵn sàng đi biển" xanh trên một cái vỏ đã gãy là thứ
    bà con dựa vào để quyết định nhổ neo — nên nó phải kiểm lại từng URL.  */

type FakeCaches = { match: (u: string) => Promise<Response | undefined> };

function installFakeCaches(store: Record<string, unknown>): void {
  const fake: FakeCaches = {
    match: async (u: string) => {
      if (!(u in store)) return undefined;
      const v = store[u];
      return new Response(typeof v === "string" ? v : JSON.stringify(v));
    },
  };
  (globalThis as unknown as { caches: FakeCaches }).caches = fake;
}

afterEach(() => {
  delete (globalThis as unknown as { caches?: FakeCaches }).caches;
});

describe("isShellReady", () => {
  it("chưa có Cache Storage (trình duyệt cũ / SSR) → chưa sẵn sàng", async () => {
    expect(await isShellReady()).toBe(false);
  });

  it("chưa có dấu → chưa sẵn sàng", async () => {
    installFakeCaches({});
    expect(await isShellReady()).toBe(false);
  });

  it("đủ dấu + đủ mọi URL kèm theo → sẵn sàng", async () => {
    installFakeCaches({
      [SHELL_READY_MARK]: { at: 1, urls: ["/", "/ngu-truong", "/_next/a.js"] },
      "/": "<html>",
      "/ngu-truong": "<html>",
      "/_next/a.js": "chunk",
    });
    expect(await isShellReady()).toBe(true);
  });

  it("THIẾU MỘT chunk (bị trimCache đuổi) → nói thật là chưa sẵn sàng", async () => {
    installFakeCaches({
      [SHELL_READY_MARK]: { at: 1, urls: ["/", "/ngu-truong", "/_next/a.js"] },
      "/": "<html>",
      "/ngu-truong": "<html>",
      // "/_next/a.js" đã bị đuổi khỏi kho
    });
    expect(await isShellReady()).toBe(false);
  });

  it("dấu ĐỜI CŨ (chỉ có `at`) → giữ nghĩa cũ, không báo động oan", async () => {
    // Máy đã cài service worker bản trước, chưa kịp cài bản mới: vỏ của nó vẫn
    // dùng được, đừng bắt bà con thấy chip đỏ chỉ vì app vừa lên bản mới.
    installFakeCaches({ [SHELL_READY_MARK]: { at: 1 } });
    expect(await isShellReady()).toBe(true);
  });

  it("dấu hỏng (không phải JSON) → coi như vẫn còn dấu, không ném", async () => {
    installFakeCaches({ [SHELL_READY_MARK]: "khong-phai-json" });
    expect(await isShellReady()).toBe(true);
  });
});
