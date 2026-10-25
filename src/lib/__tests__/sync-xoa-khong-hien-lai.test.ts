import { describe, it, expect, beforeEach, vi } from "vitest";

/*  XOÁ RỒI THÌ KHÔNG HIỆN LẠI (anh Long 2026-10-24, ảnh dải "Việc cần làm":
    giấy tờ + bạn thuyền đã xoá, mở lại app lại hiện).

    Mô phỏng TRỌN VÒNG: nhiều máy (mỗi máy một kho localStorage + một bản
    module `user-sync` riêng = một lần mở app), server giữ cuốn sổ trong bộ
    nhớ và quyết bằng đúng hàm của route (`decidePut` + `stripDeleted`).
    "Đóng mở app" = nạp lại module (bộ nhớ mốc mất, chỉ còn localStorage). */

type Ls = Map<string, string>;
let cur: Ls = new Map();
const lsProxy = {
  getItem: (k: string) => (cur.has(k) ? cur.get(k)! : null),
  setItem: (k: string, v: string) => void cur.set(k, String(v)),
  removeItem: (k: string) => void cur.delete(k),
  clear: () => cur.clear(),
  key: (i: number) => [...cur.keys()][i] ?? null,
  get length() {
    return cur.size;
  },
} as Storage;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: lsProxy,
  dispatchEvent: () => true,
};
(globalThis as unknown as { localStorage: Storage }).localStorage = lsProxy;

const PHONE = "0901234567";
/** server: kind → hàng user_docs */
const server = new Map<string, { data: unknown; clientUpdatedAt: number }>();
let online = true;
/** giả lập bản app ĐỜI CŨ còn trên máy nào đó: PUT không gửi baseIds */
let stripBase = false;

vi.mock("@/lib/device-token-store", async () => {
  const core = await import("@/lib/user-sync-core");
  const tomb = await import("@/lib/sync-tombstone");
  return {
    authedFetch: async (_url: string, init?: RequestInit) => {
      if (!online) return { res: null };
      const method = init?.method ?? "GET";
      let payload: unknown;
      if (method === "GET") {
        payload = {
          ok: true,
          phone: PHONE,
          items: [...server].map(([kind, r]) => ({
            kind,
            data: tomb.stripDeleted(r.data),
            clientUpdatedAt: r.clientUpdatedAt,
          })),
        };
      } else {
        const b = JSON.parse(String(init!.body));
        if (stripBase) delete b.baseIds;
        const d = core.decidePut(
          server.get(b.kind) ?? null,
          { kind: b.kind, data: b.data, clientUpdatedAt: b.clientUpdatedAt, baseIds: b.baseIds },
          "2026-10-24T00:00:00.000Z",
        );
        if (d.action === "write") server.set(b.kind, d.write);
        payload = d.reply;
      }
      return { res: { ok: true, json: async () => payload } };
    },
  };
});

const DOCS = "forfish.documents.v1";
const CREW = "forfish.crew.v1";
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

/** Một máy = một kho localStorage; `open()` = mở app (module mới). */
function device() {
  const ls: Ls = new Map();
  let mod: typeof import("../user-sync") | null = null;
  const chon = () => (cur = ls);
  return {
    ls,
    async open() {
      chon();
      vi.resetModules();
      mod = await import("../user-sync");
      await mod.syncAll();
      await flush();
    },
    /** bà con bấm Xoá trên màn: ghi kho (như saveDocs/saveCrew) + markLocalWrite */
    async write(key: string, kind: "documents" | "crew", list: unknown[]) {
      chon();
      ls.set(key, JSON.stringify(list));
      mod!.markLocalWrite(kind);
      await flush();
    },
    ids(key: string): string[] {
      return (JSON.parse(ls.get(key) ?? "[]") as { id: string }[]).map((x) => x.id).sort();
    },
    list(key: string): { id: string }[] {
      return JSON.parse(ls.get(key) ?? "[]");
    },
  };
}

const D1 = { id: "doc-1", label: "Đăng kiểm tàu cá", expiresOn: "2026-05-29" };
const D2 = { id: "doc-2", label: "Giấy phép khai thác thủy sản", expiresOn: "2026-06-28" };
const C1 = { id: "crew-1", name: "Nguyễn Văn Hai" };
const C2 = { id: "crew-2", name: "Lê Thành Tâm" };

beforeEach(() => {
  server.clear();
  online = true;
  stripBase = false;
  server.set("documents", { data: [D1, D2], clientUpdatedAt: 1_000 });
  server.set("crew", { data: [C1, C2], clientUpdatedAt: 1_000 });
});

describe("xoá giấy tờ / bạn thuyền ⇒ đóng mở app KHÔNG hiện lại", () => {
  it("có sóng: xoá rồi mở lại (cùng máy)", async () => {
    const a = device();
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-1", "doc-2"]);
    await a.write(DOCS, "documents", []);
    await a.write(CREW, "crew", [C1]);
    await a.open();
    expect(a.ids(DOCS)).toEqual([]);
    expect(a.ids(CREW)).toEqual(["crew-1"]);
  });

  it("mất sóng: xoá ngoài biển, mở lại khi vẫn mất sóng rồi khi có sóng", async () => {
    const a = device();
    await a.open();
    online = false;
    await a.write(DOCS, "documents", [D2]);
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-2"]);
    online = true;
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-2"]);
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-2"]);
  });

  it("đăng nhập máy khác sau khi xoá ⇒ máy kia cũng không thấy", async () => {
    const a = device();
    await a.open();
    await a.write(DOCS, "documents", [D2]);
    const b = device();
    await b.open();
    expect(b.ids(DOCS)).toEqual(["doc-2"]);
  });

  it("máy B còn bản cũ (chưa biết tin xoá) và có sửa chưa đẩy ⇒ mục đã xoá không sống lại ở máy A", async () => {
    const a = device();
    const b = device();
    await a.open();
    await b.open();
    // B sửa giấy 2 lúc mất sóng (dirty, vẫn còn D1 trong máy)
    online = false;
    await b.write(DOCS, "documents", [D1, { ...D2, label: "GP sửa" }]);
    online = true;
    // A xoá D1
    await a.write(DOCS, "documents", [D2]);
    // B có sóng lại ⇒ đẩy cuốn còn D1
    await b.open();
    expect(b.ids(DOCS)).toEqual(["doc-2"]);
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-2"]);
  });

  it("máy chạy BẢN APP CŨ (không gửi baseIds) đẩy sau ⇒ mục đã xoá không sống lại", async () => {
    const a = device();
    const b = device();
    await a.open();
    await b.open();
    await a.write(DOCS, "documents", [D2]);
    // B đời cũ, sửa sau (mốc lớn hơn) mà chưa kéo tin xoá
    stripBase = true;
    online = false;
    await b.write(DOCS, "documents", [D1, D2, { id: "doc-3", label: "mới" }]);
    online = true;
    await b.open();
    stripBase = false;
    await a.open();
    expect(a.ids(DOCS)).toEqual(["doc-2", "doc-3"]);
  });

  it("máy đời trước 2026-10-06 (sổ mốc chưa có base) xoá ⇒ không sống lại", async () => {
    const a = device();
    await a.open();
    // sổ mốc kiểu cũ: có mốc, không có ids
    a.ls.set(
      "forfish.sync.v1",
      JSON.stringify({ documents: { at: 1_000, dirty: false }, crew: { at: 1_000, dirty: false } }),
    );
    await a.open(); // nạp lại sổ mốc kiểu cũ
    await a.write(CREW, "crew", [C1]);
    await a.open();
    expect(a.ids(CREW)).toEqual(["crew-1"]);
  });

  it("ghi thêm khi lượt đẩy trước chưa về, lượt đẩy sau rớt sóng ⇒ vẫn còn cờ chưa đẩy, máy khác không thấy lại", async () => {
    server.delete("crew"); // cuốn chưa có trên server ⇒ lần đẩy đầu trả {ok} trần
    const a = device();
    await a.open();
    cur = a.ls;
    a.ls.set(CREW, JSON.stringify([C1, C2]));
    const m = await import("../user-sync");
    m.markLocalWrite("crew"); // lượt 1 tới server ngay
    online = false;
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 5); // mốc lượt 2 > lượt 1, KHÔNG nhường lượt
    a.ls.set(CREW, JSON.stringify([C1])); // xoá Tâm
    m.markLocalWrite("crew"); // lượt 2 rớt sóng
    spy.mockRestore();
    await flush(); // trả lời lượt 1 về SAU khi đã ghi lượt 2
    online = true;
    await a.open();
    const b = device();
    await b.open();
    expect(b.ids(CREW)).toEqual(["crew-1"]);
  });

  it("xoá tàu kéo theo giấy tờ của tàu đó ⇒ server cũng bỏ, máy khác không thấy", async () => {
    server.set("documents", {
      data: [
        { ...D1, boatId: "tau-cu" },
        { ...D2, boatId: "tau-moi" },
      ],
      clientUpdatedAt: 1_000,
    });
    const a = device();
    await a.open();
    const { purgeBoatData } = await import("../boat-cascade");
    cur = a.ls;
    purgeBoatData("tau-cu");
    await flush();
    const b = device();
    await b.open();
    expect(b.ids(DOCS)).toEqual(["doc-2"]);
  });
});
