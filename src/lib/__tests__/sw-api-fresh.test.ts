import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// localStorage mock (env node — không jsdom), khớp mẫu storms-saved-at.test
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  SW_API_FRESH_MSG,
  isApiFreshMsg,
  isNewerGeneratedAt,
  onSwApiFresh,
} from "../sw-api-fresh";
import { banDoCaDaLuu, fishForecastTuKhoSW } from "../fish-predict";

/*  CA THẬT (2026-10-05): máy chủ đã có ngừ ồ, máy Quân Bình Định vẫn "không có
    ngừ ồ". Bản đồ cá ~3 MB qua sóng yếu quá API_STALE_MS ⇒ SW trả bản cũ trong
    kho; bản mới về muộn chỉ được CẤT, màn đang mở không ai báo. */

describe("isApiFreshMsg", () => {
  it("đúng tên + đúng path → true", () => {
    expect(
      isApiFreshMsg({ type: SW_API_FRESH_MSG, path: "/api/fish-forecast" }, "/api/fish-forecast"),
    ).toBe(true);
  });
  it("khác path / khác tên / rác → false", () => {
    expect(isApiFreshMsg({ type: SW_API_FRESH_MSG, path: "/api/storms" }, "/api/fish-forecast")).toBe(false);
    expect(isApiFreshMsg({ type: "khac", path: "/api/fish-forecast" }, "/api/fish-forecast")).toBe(false);
    expect(isApiFreshMsg(null, "/api/fish-forecast")).toBe(false);
    expect(isApiFreshMsg("sdfish:api-fresh", "/api/fish-forecast")).toBe(false);
  });
  it("tên tin trùng với public/sw.js", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    expect(sw).toContain(`const API_FRESH_MSG = "${SW_API_FRESH_MSG}"`);
    // nhánh /api trả bản cũ phải báo trang
    expect(sw).toMatch(/notifyApiFresh\(url\.pathname\)/);
  });
});

describe("isNewerGeneratedAt", () => {
  it("mới hơn → thay; bằng/cũ hơn → giữ", () => {
    expect(isNewerGeneratedAt("2026-10-05T05:00:00Z", "2026-10-05T06:00:00Z")).toBe(true);
    expect(isNewerGeneratedAt("2026-10-05T06:00:00Z", "2026-10-05T06:00:00Z")).toBe(false);
    expect(isNewerGeneratedAt("2026-10-05T06:00:00Z", "2026-10-05T05:00:00Z")).toBe(false);
  });
  it("bản mới không rõ tuổi → KHÔNG thay; bản đang hiện không rõ tuổi → thay", () => {
    expect(isNewerGeneratedAt("2026-10-05T05:00:00Z", undefined)).toBe(false);
    expect(isNewerGeneratedAt("2026-10-05T05:00:00Z", "rac")).toBe(false);
    expect(isNewerGeneratedAt(null, "2026-10-05T06:00:00Z")).toBe(true);
  });
});

describe("onSwApiFresh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("không có service worker → không ném, trả hàm huỷ", () => {
    vi.stubGlobal("navigator", {});
    const off = onSwApiFresh("/api/fish-forecast", () => {});
    expect(() => off()).not.toThrow();
  });
  it("gọi cb đúng path, huỷ xong thì thôi nghe", () => {
    const target = new EventTarget();
    vi.stubGlobal("navigator", { serviceWorker: target });
    const cb = vi.fn();
    const off = onSwApiFresh("/api/fish-forecast", cb);
    const send = (data: unknown) =>
      target.dispatchEvent(new MessageEvent("message", { data }));
    send({ type: SW_API_FRESH_MSG, path: "/api/storms" });
    send({ type: SW_API_FRESH_MSG, path: "/api/fish-forecast" });
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    send({ type: SW_API_FRESH_MSG, path: "/api/fish-forecast" });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("fishForecastTuKhoSW — đọc kho SW, không fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  const banMoi = {
    ok: true,
    targetDate: "2026-10-03",
    generatedAt: "2026-10-05T05:12:40Z",
    species: ["ngừ ồ"],
    cells: [],
  };
  it("có bản ok trong kho → trả + ghi kho bền; KHÔNG gọi fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("caches", {
      match: vi.fn(async () => new Response(JSON.stringify(banMoi))),
    });
    const d = await fishForecastTuKhoSW();
    expect(d?.generatedAt).toBe(banMoi.generatedAt);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(banDoCaDaLuu()?.generatedAt).toBe(banMoi.generatedAt);
  });
  it("kho trống / bản không ok / JSON hỏng / không có Cache API → null, không ném", async () => {
    vi.stubGlobal("caches", { match: vi.fn(async () => undefined) });
    expect(await fishForecastTuKhoSW()).toBeNull();
    vi.stubGlobal("caches", {
      match: vi.fn(async () => new Response(JSON.stringify({ ok: false }))),
    });
    expect(await fishForecastTuKhoSW()).toBeNull();
    vi.stubGlobal("caches", { match: vi.fn(async () => new Response("{rac")) });
    expect(await fishForecastTuKhoSW()).toBeNull();
    vi.stubGlobal("caches", undefined);
    expect(await fishForecastTuKhoSW()).toBeNull();
  });
});
