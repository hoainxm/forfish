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
