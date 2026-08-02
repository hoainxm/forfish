import { describe, expect, it, beforeEach } from "vitest";

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
  parseBackup,
  exportOfflineData,
  importOfflineData,
} from "../offline-backup";

beforeEach(() => localStorage.clear());

describe("parseBackup", () => {
  it("nhận đúng định dạng v1", () => {
    const b = parseBackup(JSON.stringify({ v: 1, savedAt: 1, ls: { a: "b" } }));
    expect(b?.ls.a).toBe("b");
  });

  it("từ chối JSON hỏng / sai version / thiếu ls", () => {
    expect(parseBackup("{không phải json")).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 2, ls: {} }))).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 1, ls: null }))).toBeNull();
  });
});

describe("export → import round-trip (localStorage)", () => {
  it("gom dữ liệu forfish.* NHƯNG loại dấu quyền tier, phục hồi lại đúng", async () => {
    localStorage.setItem("forfish.fc.grid.d3", "GRID");
    localStorage.setItem("forfish.tier.premium.v1", "1"); // dấu premium — KHÔNG gom
    localStorage.setItem("khac.khong-lien-quan", "BỎ"); // không phải forfish → không gom

    const json = await exportOfflineData();
    const parsed = parseBackup(json);
    // chỉ dữ liệu dự báo, KHÔNG có forfish.tier.*
    expect(Object.keys(parsed!.ls)).toEqual(["forfish.fc.grid.d3"]);

    // xoá sạch (giả lập máy xoá cache) rồi phục hồi
    localStorage.clear();
    const r = await importOfflineData(json);
    expect(r.ok).toBe(true);
    expect(r.keys).toBe(1);
    expect(localStorage.getItem("forfish.fc.grid.d3")).toBe("GRID");
  });

  it("import tệp có LẪN dấu premium → KHÔNG mở khoá (leo thang quyền)", async () => {
    // tệp do người khác sửa tay, cố nhét dấu premium
    const json = JSON.stringify({
      v: 1,
      savedAt: 1,
      ls: { "forfish.fc.grid.d3": "GRID", "forfish.tier.premium.v1": "1" },
    });
    const r = await importOfflineData(json);
    expect(r.ok).toBe(true);
    expect(r.keys).toBe(1); // chỉ ghi grid, KHÔNG ghi dấu tier
    expect(localStorage.getItem("forfish.tier.premium.v1")).toBeNull();
  });

  it("import tệp hỏng → ok:false, không ghi gì", async () => {
    const r = await importOfflineData("rác");
    expect(r.ok).toBe(false);
    expect(r.keys).toBe(0);
  });
});

/*  BẢN ĐỒ CÁ TRONG TỆP SAO LƯU — chỉ nhận bản CÒN DÙNG ĐƯỢC (audit B7).
    Kho service worker có thể đang giữ một phản hồi `{ok:false}` (từ thời route
    trả 200 kèm lỗi — nay đã sửa thành 503, nhưng máy bà con vẫn còn bản cũ).
    Gói rác vào tệp rồi phục hồi = ghi rác đè lên bản DUY NHẤT của lớp cá.  */
describe("phần bản đồ cá trong tệp", () => {
  type FakeCache = {
    match: (u: unknown) => Promise<Response | undefined>;
    put: (u: unknown, r: Response) => Promise<void>;
  };
  function fakeCaches(initial: unknown): { store: { value: unknown } } {
    const store = { value: initial };
    const cache: FakeCache = {
      match: async () =>
        store.value === undefined
          ? undefined
          : new Response(JSON.stringify(store.value)),
      put: async (_u, r) => {
        store.value = await r.json();
      },
    };
    (globalThis as unknown as { caches: unknown }).caches = {
      open: async () => cache,
    };
    return { store };
  }

  it("XUẤT: bỏ qua bản {ok:false} trong kho", async () => {
    fakeCaches({ ok: false });
    const parsed = parseBackup(await exportOfflineData());
    expect(parsed?.fish).toBeUndefined();
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("XUẤT: gói bản {ok:true}", async () => {
    fakeCaches({ ok: true, cells: [1] });
    const parsed = parseBackup(await exportOfflineData());
    expect(parsed?.fish).toMatchObject({ ok: true });
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("NHẬP: tệp mang {ok:false} KHÔNG được đè lên bản tốt đang có", async () => {
    const { store } = fakeCaches({ ok: true, cells: [1] });
    const r = await importOfflineData(
      JSON.stringify({ v: 1, savedAt: 1, ls: {}, fish: { ok: false } }),
    );
    expect(r.fishRestored).toBe(false);
    expect(store.value).toMatchObject({ ok: true }); // bản tốt còn nguyên
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("NHẬP: tệp mang bản tốt thì ghi vào kho", async () => {
    /*  `new Request("/api/…")` cần base URL: trình duyệt lấy từ document, còn
        môi trường test node thì ném. Thay tạm bằng một lớp tối giản để test đo
        đúng thứ cần đo (có ghi vào kho không), không đo chuyện base URL. */
    const RealRequest = globalThis.Request;
    (globalThis as unknown as { Request: unknown }).Request = class {
      url: string;
      constructor(u: string) {
        this.url = u;
      }
    };
    const { store } = fakeCaches({ ok: true, cells: [1] });
    try {
      const r = await importOfflineData(
        JSON.stringify({
          v: 1,
          savedAt: 1,
          ls: {},
          fish: { ok: true, cells: [9] },
        }),
      );
      expect(r.fishRestored).toBe(true);
      expect(store.value).toMatchObject({ cells: [9] });
    } finally {
      (globalThis as unknown as { Request: unknown }).Request = RealRequest;
      delete (globalThis as unknown as { caches?: unknown }).caches;
    }
  });
});
