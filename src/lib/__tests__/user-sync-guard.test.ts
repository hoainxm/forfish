import { describe, it, expect, beforeEach, vi } from "vitest";

/*  Hai lỗi làm việc ĐÃ XOÁ sống lại (chủ dự án báo 2026-09-01: *"t xoá việc đó
    rồi thì có lý do gì nó hiện lại ko?"*). Cả hai đều ở `user-sync`:

    (1) mốc thời gian ghi hụt mà im lặng ⇒ máy tự khai mình CŨ hơn server ⇒
        server "thắng" ⇒ bản vừa xoá bị ghi đè;
    (2) kéo bản server đè lên sửa đổi CHƯA kịp đẩy (sửa lúc mất sóng).

    Test dựng đúng hai cảnh đó. Không test đường mạng — chỉ test luật quyết
    định, đúng phần đã hỏng. */

// localStorage giả (env node) — cùng khuôn route-stops.test.ts
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

/** Lượt gọi mạng gần nhất — để soi máy đã gửi mốc nào lên server. */
const calls: { url: string; body: unknown }[] = [];
let nextGet: unknown = { ok: true, items: [] };

vi.mock("@/lib/device-token-store", () => ({
  authedFetch: async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if ((init?.method ?? "GET") === "GET") {
      return { res: { ok: true, json: async () => nextGet } };
    }
    return { res: { ok: true, json: async () => ({ ok: true }) } };
  },
}));

const KEY = "forfish.maintenance.v1";
const META = "forfish.sync.v1";

async function freshModule() {
  vi.resetModules();
  return import("../user-sync");
}

beforeEach(() => {
  ls.clear();
  calls.length = 0;
  nextGet = { ok: true, items: [] };
});

describe("mốc ghi hụt KHÔNG được làm máy tự khai mình cũ hơn", () => {
  it("ghi khoá mốc hỏng ⇒ kéo về VẪN không đè bản vừa sửa", async () => {
    const m = await freshModule();
    /*  Cảnh thật: bà con xoá việc cuối ⇒ kho còn []. Dữ liệu ghi được, nhưng
        máy chật đúng lúc ghi sổ bookkeeping nên MỐC không lưu xuống được. */
    ls.setItem(KEY, JSON.stringify([]));
    const goc = ls.setItem.bind(ls);
    ls.setItem = (k: string, v: string) => {
      if (k === META) throw new Error("QuotaExceeded");
      goc(k, v);
    };
    m.markLocalWrite("maintenance"); // mốc = now, chỉ nằm trong bộ nhớ
    await new Promise((r) => setTimeout(r, 0));
    ls.setItem = goc;

    /*  Server vẫn giữ bản CŨ với mốc nhỏ hơn now. Bản lỗi đọc mốc từ
        localStorage (rỗng vì ghi hụt) ⇒ coi máy là at=0 ⇒ 1000 > 0 ⇒ NHẬN về
        ⇒ việc vừa xoá sống lại. Bản đã sửa đọc mốc trong bộ nhớ ⇒ giữ nguyên. */
    nextGet = {
      ok: true,
      items: [
        {
          kind: "maintenance",
          data: [{ id: "bd-1", item: "Thay dầu máy" }],
          clientUpdatedAt: 1000,
        },
      ],
    };
    await m.syncAll();

    expect(JSON.parse(ls.getItem(KEY)!)).toEqual([]); // KHÔNG sống lại
  });
});

describe("KHÔNG đè bản server lên sửa đổi chưa kịp đẩy", () => {
  it("máy đang dirty ⇒ kéo về KHÔNG ghi đè kho ở máy", async () => {
    const m = await freshModule();
    // bà con vừa xoá việc cuối cùng lúc MẤT SÓNG: kho còn [], mốc dirty
    ls.setItem(KEY, JSON.stringify([]));
    ls.setItem(
      META,
      JSON.stringify({ maintenance: { at: 1000, dirty: true } }),
    );
    // server vẫn giữ bản CŨ (còn nguyên việc), mốc lớn hơn
    nextGet = {
      ok: true,
      items: [
        {
          kind: "maintenance",
          data: [{ id: "bd-1", item: "Thay dầu máy" }],
          clientUpdatedAt: 9999,
        },
      ],
    };

    await m.syncAll();

    expect(JSON.parse(ls.getItem(KEY)!)).toEqual([]); // KHÔNG sống lại
  });

  it("máy KHÔNG dirty ⇒ vẫn nhận bản server mới hơn (đồng bộ máy khác không hỏng)", async () => {
    const m = await freshModule();
    ls.setItem(KEY, JSON.stringify([]));
    ls.setItem(
      META,
      JSON.stringify({ maintenance: { at: 1000, dirty: false } }),
    );
    nextGet = {
      ok: true,
      items: [
        {
          kind: "maintenance",
          data: [{ id: "bd-9", item: "Máy khác vừa thêm" }],
          clientUpdatedAt: 9999,
        },
      ],
    };

    await m.syncAll();

    expect(JSON.parse(ls.getItem(KEY)!)).toEqual([
      { id: "bd-9", item: "Máy khác vừa thêm" },
    ]);
  });
});
