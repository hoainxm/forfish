import { describe, it, expect, beforeEach, vi } from "vitest";

/*  `clearSyncMeta` — gọi lúc ĐĂNG XUẤT / GỠ TÀI KHOẢN (xem hero-account +
    lib/user-sync). Bất biến phải giữ: sau khi xoá hồ sơ chủ tàu, mốc đồng bộ
    về 0 CẢ TRONG BỘ NHỚ, để lần đăng nhập lại `syncAll` KÉO ĐỦ bản server về.

    Nếu chỉ xoá localStorage mà quên bản bộ nhớ (`metaCache`), phiên đang chạy
    vẫn so bằng mốc CŨ ⇒ `server.clientUpdatedAt > metaOf().at` hoá false ⇒
    server không được nhận ⇒ CHỦ THẬT đăng nhập lại thấy TRỐNG. Đây là ca đó. */

function makeLs(): Storage {
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
}
const ls = makeLs();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: ls,
  dispatchEvent: () => true,
};
(globalThis as unknown as { localStorage: Storage }).localStorage = ls;

let nextGet: unknown = { ok: true, items: [] };

vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") {
      return { res: { ok: true, json: async () => nextGet } };
    }
    return { res: { ok: true, json: async () => ({ ok: true }) } };
  },
}));

const MAINT_KEY = "forfish.maintenance.v1";
const META = "forfish.sync.v1";

async function freshModule() {
  vi.resetModules();
  return import("../user-sync");
}

beforeEach(() => {
  ls.clear();
  nextGet = { ok: true, items: [] };
});

describe("clearSyncMeta", () => {
  it("xoá khoá mốc trong localStorage", async () => {
    const m = await freshModule();
    ls.setItem(META, JSON.stringify({ maintenance: { at: 5000, dirty: false } }));
    m.clearSyncMeta();
    expect(ls.getItem(META)).toBeNull();
  });

  it("reset CẢ bản bộ nhớ ⇒ đăng nhập lại kéo được bản server có mốc NHỎ hơn", async () => {
    const m = await freshModule();

    // Chủ cũ vừa sửa sổ ⇒ mốc lớn, nằm trong bộ nhớ (metaCache).
    ls.setItem(MAINT_KEY, JSON.stringify([{ id: "bd-1", item: "Thay dầu" }]));
    m.markLocalWrite("maintenance"); // meta.at = Date.now() (rất lớn)
    await new Promise((r) => setTimeout(r, 0));

    // ĐĂNG XUẤT: xoá dữ liệu + mốc.
    ls.removeItem(MAINT_KEY);
    m.clearSyncMeta();

    // Server giữ bản của CHÍNH chủ với mốc nhỏ hơn now. Nếu metaCache còn mốc
    // cũ (lớn), `1000 > at` = false ⇒ KHÔNG nhận ⇒ máy vẫn trống. Sau
    // clearSyncMeta (at=0) thì 1000 > 0 ⇒ NHẬN về.
    nextGet = {
      ok: true,
      items: [
        {
          kind: "maintenance",
          data: [{ id: "bd-1", item: "Thay dầu" }],
          clientUpdatedAt: 1000,
        },
      ],
    };
    await m.syncAll();

    expect(JSON.parse(ls.getItem(MAINT_KEY) ?? "null")).toEqual([
      { id: "bd-1", item: "Thay dầu" },
    ]);
  });
});
