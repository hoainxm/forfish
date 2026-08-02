import { beforeEach, describe, expect, it, vi } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-cache.test
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

import { fetchStormCheck, savedStormAt, stormStatus } from "../storms";

/*  CA THẬT (2026-08-02, audit R3 — tin bão bị đóng mốc "vừa xong").

    Service worker trả bản tin bão TRONG KHO với status 200 theo BA đường: mất
    sóng (`.catch` → `caches.match`), nguồn 5xx (isRescuableStatus cứu bằng bản
    kho), và hết `API_STALE_MS` (đua đồng hồ, có bản lưu thì trả ngay). Client
    chỉ thấy `r.ok` ⇒ trước đây đóng `savedAt = Date.now()` cho một bản có thể 6
    giờ tuổi ⇒ popup "đã lưu gì" khoe "Tin bão · vừa xong" và lớp bão trong
    pretrip báo xanh. Nói dối chuyện tính mạng.

    Cả ba đường đều đi qua đúng một chỗ ghi (`fetchStormCheck`), nên khoá ở đây
    là khoá cả ba: mốc lưu phải là `checkedAt` của bản tin.  */

const CHECKED_AT = "2026-08-02T00:00:00.000Z";

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      json: async () => body,
    })) as unknown as typeof fetch,
  );
}

describe("fetchStormCheck — mốc lưu là GIỜ BẢN TIN, không phải giờ máy", () => {
  beforeEach(() => {
    _ls.clear();
    vi.unstubAllGlobals();
  });

  it("checkedAt hợp lệ → savedAt đúng bằng mốc đó", async () => {
    stubFetch({ ok: true, storms: [], checkedAt: CHECKED_AT });
    await fetchStormCheck();
    expect(savedStormAt()).toBe(Date.parse(CHECKED_AT));
  });

  it("SW trả bản 6 giờ tuổi với 200 → kho KHÔNG được nói 'vừa xong'", async () => {
    const sauGio = new Date(Date.now() - 6 * 3600_000).toISOString();
    stubFetch({ ok: true, storms: [], checkedAt: sauGio });
    await fetchStormCheck();
    const at = savedStormAt();
    expect(at).not.toBeNull();
    // ít nhất 6 giờ tuổi — không được là "mấy giây trước"
    expect(Date.now() - (at as number)).toBeGreaterThanOrEqual(
      6 * 3600_000 - 5_000,
    );
  });

  it("checkedAt rác → rơi về giờ máy (vẫn lưu được, không NaN)", async () => {
    stubFetch({ ok: true, storms: [], checkedAt: "khong-phai-ngay" });
    const truoc = Date.now();
    await fetchStormCheck();
    const at = savedStormAt();
    expect(Number.isFinite(at as number)).toBe(true);
    expect(at as number).toBeGreaterThanOrEqual(truoc);
  });

  it("thiếu hẳn checkedAt → rơi về giờ máy", async () => {
    stubFetch({ ok: true, storms: [] });
    const truoc = Date.now();
    await fetchStormCheck();
    const at = savedStormAt();
    expect(Number.isFinite(at as number)).toBe(true);
    expect(at as number).toBeGreaterThanOrEqual(truoc);
  });

  it("mất sóng → lấy bản đã lưu, KHÔNG làm mới mốc lưu", async () => {
    stubFetch({ ok: true, storms: [], checkedAt: CHECKED_AT });
    await fetchStormCheck();
    const truoc = savedStormAt();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("mat song");
      }) as unknown as typeof fetch,
    );
    const lai = await fetchStormCheck();
    expect(lai.ok).toBe(true);
    expect(savedStormAt()).toBe(truoc);
  });

  it("bản tin quá cũ vẫn KHÔNG được nói 'không có bão'", async () => {
    const cu = new Date(Date.now() - 20 * 3600_000).toISOString();
    stubFetch({ ok: true, storms: [], checkedAt: cu });
    const j = await fetchStormCheck();
    expect(stormStatus(j).kind).toBe("khong-hoi-duoc");
  });
});
