import { describe, it, expect, beforeEach, vi } from "vitest";

/*  ĐỒNG BỘ THEO TÀI KHOẢN — các cảnh làm "đăng nhập máy khác không thấy hồ sơ"
    (user 2026-10-06). Test luật quyết định ở client, mạng giả. Cùng khuôn
    user-sync-guard.test.ts. */

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

const calls: { method: string; body: Record<string, unknown> | null }[] = [];
let nextGet: unknown = { ok: true, items: [] };
let nextPut: (body: Record<string, unknown>) => unknown = () => ({ ok: true });

vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, body });
    const payload = method === "GET" ? nextGet : nextPut(body);
    return { res: { ok: true, json: async () => payload } };
  },
}));

const BOATS = "forfish.boats.v1";
const DOCS = "forfish.documents.v1";
const META = "forfish.sync.v1";
const IDENTITY = "forfish.identity.v1";

async function freshModule() {
  vi.resetModules();
  return import("../user-sync");
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const read = (k: string) => JSON.parse(ls.getItem(k) ?? "null");

beforeEach(() => {
  ls.clear();
  calls.length = 0;
  nextGet = { ok: true, items: [] };
  nextPut = () => ({ ok: true });
});

describe("máy mới đăng nhập ⇒ kéo đủ hồ sơ của tài khoản", () => {
  it("máy trống: nhận tàu + giấy tờ, ghi chủ sổ + base", async () => {
    const m = await freshModule();
    nextGet = {
      ok: true,
      phone: "0901234567",
      items: [
        { kind: "boats", data: [{ id: "b1", name: "Tàu A" }], clientUpdatedAt: 100 },
        { kind: "documents", data: [{ id: "d1", boatId: "b1" }], clientUpdatedAt: 100 },
      ],
    };
    await m.syncAll();
    expect(read(BOATS)).toEqual([{ id: "b1", name: "Tàu A" }]);
    expect(read(DOCS)).toEqual([{ id: "d1", boatId: "b1" }]);
    const meta = read(META);
    expect(meta._owner).toBe("0901234567");
    expect(meta.boats.ids).toEqual(["b1"]);
  });
});

describe("sổ trong máy là của TÀI KHOẢN TRƯỚC (máy bị đá rồi người khác vào)", () => {
  it("chủ sổ khác SĐT server ⇒ dọn sổ người trước, kéo đúng sổ người mới, KHÔNG đẩy sổ cũ", async () => {
    const m = await freshModule();
    // máy A: sổ của X còn dirty (chưa kịp đẩy) — nhánh "bị đá" giữ dữ liệu
    ls.setItem(BOATS, JSON.stringify([{ id: "x1", name: "Tàu của X" }]));
    ls.setItem(
      META,
      JSON.stringify({ _owner: "0911111111", boats: { at: 999_999, dirty: true } }),
    );
    nextGet = {
      ok: true,
      phone: "0922222222",
      items: [{ kind: "boats", data: [{ id: "y1", name: "Tàu của Y" }], clientUpdatedAt: 5 }],
    };
    await m.syncAll();
    expect(read(BOATS)).toEqual([{ id: "y1", name: "Tàu của Y" }]);
    expect(read(META)._owner).toBe("0922222222");
    // không một lượt PUT nào mang sổ của X lên tài khoản Y
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("cùng chủ ⇒ KHÔNG dọn gì", async () => {
    const m = await freshModule();
    ls.setItem(BOATS, JSON.stringify([{ id: "b1" }]));
    ls.setItem(META, JSON.stringify({ _owner: "0901234567", boats: { at: 200, dirty: false } }));
    nextGet = {
      ok: true,
      phone: "0901234567",
      items: [{ kind: "boats", data: [{ id: "b1" }], clientUpdatedAt: 200 }],
    };
    await m.syncAll();
    expect(read(BOATS)).toEqual([{ id: "b1" }]);
  });

  it("đẩy lẻ (markLocalWrite) khi chủ sổ ≠ người đang dùng máy ⇒ không gửi", async () => {
    const m = await freshModule();
    ls.setItem(IDENTITY, JSON.stringify({ phone: "0922222222", key: "0922222222", boundAt: 1 }));
    ls.setItem(META, JSON.stringify({ _owner: "0911111111" }));
    ls.setItem(BOATS, JSON.stringify([{ id: "x1" }]));
    m.markLocalWrite("boats");
    await flush();
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });
});

describe("server CHƯA có dòng tàu ⇒ đẩy lên dù mốc ≠ 0 (ca đo được ở prod)", () => {
  it("máy cũ có tàu, mốc đã ghi, server chỉ có giấy tờ ⇒ seed tàu", async () => {
    const m = await freshModule();
    ls.setItem(BOATS, JSON.stringify([{ id: "b1", name: "Tàu A" }]));
    ls.setItem(META, JSON.stringify({ boats: { at: 500, dirty: false } }));
    nextGet = {
      ok: true,
      phone: "0901234567",
      items: [{ kind: "documents", data: [{ id: "d1", boatId: "b1" }], clientUpdatedAt: 600 }],
    };
    await m.syncAll();
    const put = calls.find((c) => c.method === "PUT" && c.body?.kind === "boats");
    expect(put?.body?.data).toEqual([{ id: "b1", name: "Tàu A" }]);
  });
});

describe("đẩy lên gửi BASE và nhận cuốn ĐÃ GỘP", () => {
  it("gửi baseIds = id lần đồng bộ trước; nhận cuốn gộp (có tàu máy kia thêm)", async () => {
    const m = await freshModule();
    ls.setItem(META, JSON.stringify({ boats: { at: 100, dirty: false, ids: ["b1"] } }));
    ls.setItem(BOATS, JSON.stringify([{ id: "b1" }, { id: "b2" }]));
    nextPut = (body) => ({
      ok: true,
      merged: true,
      server: {
        data: [...(body.data as object[]), { id: "b3" }],
        clientUpdatedAt: Number(body.clientUpdatedAt) + 1,
      },
    });
    m.markLocalWrite("boats");
    await flush();
    await flush();
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.body?.baseIds).toEqual(["b1"]);
    expect(read(BOATS).map((b: { id: string }) => b.id)).toEqual(["b1", "b2", "b3"]);
    expect(read(META).boats.ids).toEqual(["b1", "b2", "b3"]);
    expect(read(META).boats.dirty).toBe(false);
  });

  it("máy đời cũ chưa có base ⇒ baseIds = null (server gộp kiểu hợp)", async () => {
    const m = await freshModule();
    ls.setItem(BOATS, JSON.stringify([{ id: "b1" }]));
    m.markLocalWrite("boats");
    await flush();
    expect(calls.find((c) => c.method === "PUT")?.body?.baseIds).toBeNull();
  });

  it("ghi thêm trong lúc chờ ⇒ KHÔNG nhận cuốn gộp cũ đè lên lần ghi mới", async () => {
    const m = await freshModule();
    ls.setItem(BOATS, JSON.stringify([{ id: "b1" }]));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    nextPut = (body) => ({
      ok: true,
      merged: true,
      server: { data: body.data, clientUpdatedAt: Number(body.clientUpdatedAt) },
    });
    m.markLocalWrite("boats"); // lượt 1 bay đi với [b1]
    // lượt ghi thứ hai xảy ra trước khi lượt 1 về
    await new Promise((r) => setTimeout(r, 2));
    ls.setItem(BOATS, JSON.stringify([{ id: "b1" }, { id: "b2" }]));
    m.markLocalWrite("boats");
    release();
    await gate;
    await flush();
    await flush();
    expect(read(BOATS).map((b: { id: string }) => b.id)).toEqual(["b1", "b2"]);
  });
});
