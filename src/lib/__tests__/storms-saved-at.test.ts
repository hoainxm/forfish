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

import {
  fetchStormCheck,
  savedStormAt,
  stormStatus,
  STORM_ID,
  STORM_NS,
} from "../storms";
import { loadForecast, saveForecast } from "../forecast-cache";

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

/*  ═══ TIN BÃO KHÔNG ĐƯỢC ĐI LÙI ═══ (2026-08-02h — an toàn tính mạng)

    Service worker trả bản CŨ kèm `200 + ok:true` theo ba đường (mất sóng, nguồn
    5xx được cứu bằng bản kho, hết hạn đua đồng hồ). Không có cửa này thì bản tin
    TRƯỚC lúc bão hình thành ghi đè lên bản CÓ bão — và `savedStormAt()` lùi theo
    nên lớp bão trong mẻ tải sẵn báo xanh. */
describe("fetchStormCheck — bản CŨ HƠN không được ghi đè", () => {
  it("mốc bản tin lùi → GIỮ bản đang có", async () => {
    localStorage.clear();
    saveForecast(STORM_NS, STORM_ID, { ok: true, storms: [{ id: "bao1" }] }, 12_000);
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ ok: true, checkedAt: new Date(8_000).toISOString() }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    await fetchStormCheck();
    const hit = loadForecast<{ storms?: unknown[] }>(STORM_NS, STORM_ID);
    expect(hit?.savedAt, "mốc bị kéo lùi").toBe(12_000);
    expect(hit?.data?.storms, "bản CÓ bão bị bản cũ đè mất").toHaveLength(1);
  });

  it("mốc bản tin tiến → ghi bình thường", async () => {
    localStorage.clear();
    saveForecast(STORM_NS, STORM_ID, { ok: true, storms: [] }, 8_000);
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          checkedAt: new Date(20_000).toISOString(),
          storms: [{ id: "bao2" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    await fetchStormCheck();
    const hit = loadForecast<{ storms?: unknown[] }>(STORM_NS, STORM_ID);
    expect(hit?.savedAt).toBe(20_000);
    expect(hit?.data?.storms).toHaveLength(1);
  });
});
