import { describe, it, expect, beforeEach, vi } from "vitest";

/*  Rà 28/10 mục A1 — nhận bản server mà GHI SỔ HỎNG (máy đầy) thì KHÔNG được nâng mốc / xoá cờ "chưa đẩy".
    Ca tái hiện của bản rà: sổ trong máy `old` mốc 100, server `new` mốc 200, setItem của sổ ném (đầy) nhưng
    setItem của mốc vẫn được. Trước sửa: mốc thành 200 ⇒ giải phóng bộ nhớ rồi sync lại vẫn `old` mãi. */

const MAINT_KEY = "forfish.maintenance.v1";
const META = "forfish.sync.v1";

const m = new Map<string, string>();
let dayKhoa: string | null = null; // khoá đang "đầy" — setItem ném
const ls = {
  getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
  setItem: (k: string, v: string) => {
    if (k === dayKhoa) throw new DOMException("QuotaExceededError", "QuotaExceededError");
    m.set(k, String(v));
  },
  removeItem: (k: string) => void m.delete(k),
  clear: () => m.clear(),
  key: (i: number) => [...m.keys()][i] ?? null,
  get length() {
    return m.size;
  },
} as Storage;
(globalThis as unknown as { window: unknown }).window = { localStorage: ls, dispatchEvent: () => true };
(globalThis as unknown as { localStorage: Storage }).localStorage = ls;

let nextGet: unknown = { ok: true, items: [] };
vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (_url: string, init?: RequestInit) =>
    (init?.method ?? "GET") === "GET"
      ? { res: { ok: true, json: async () => nextGet } }
      : { res: { ok: true, json: async () => ({ ok: true }) } },
}));

async function freshModule() {
  vi.resetModules();
  return import("../user-sync");
}

beforeEach(() => {
  ls.clear();
  dayKhoa = null;
});

describe("user-sync — ghi sổ hỏng khi nhận bản server", () => {
  it("máy đầy lúc ghi sổ ⇒ mốc giữ nguyên; giải phóng rồi sync lại ⇒ nhận đúng bản server", async () => {
    ls.setItem(MAINT_KEY, JSON.stringify([{ id: "a", item: "old" }]));
    ls.setItem(META, JSON.stringify({ maintenance: { at: 100, dirty: false } }));
    nextGet = { ok: true, items: [{ kind: "maintenance", data: [{ id: "a", item: "new" }], clientUpdatedAt: 200 }] };
    const sync = await freshModule();

    dayKhoa = MAINT_KEY;
    await sync.syncAll();
    expect(JSON.parse(ls.getItem(MAINT_KEY)!)).toEqual([{ id: "a", item: "old" }]);
    expect(JSON.parse(ls.getItem(META)!).maintenance.at).toBe(100); // KHÔNG tưởng đã đồng bộ

    dayKhoa = null; // bà con xoá bớt ảnh, máy có chỗ
    await sync.syncAll();
    expect(JSON.parse(ls.getItem(MAINT_KEY)!)).toEqual([{ id: "a", item: "new" }]);
    expect(JSON.parse(ls.getItem(META)!).maintenance).toMatchObject({ at: 200, dirty: false });
  });
});
