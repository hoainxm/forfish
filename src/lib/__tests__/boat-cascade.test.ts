import { describe, it, expect, beforeEach } from "vitest";

// localStorage mock (env node — không có jsdom).
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

import { purgeBoatData } from "../boat-cascade";

const setKey = (k: string, v: unknown) =>
  localStorage.setItem(k, JSON.stringify(v));
const getKey = (k: string) => JSON.parse(localStorage.getItem(k) || "[]");

beforeEach(() => localStorage.clear());

describe("purgeBoatData (cascade xóa tàu)", () => {
  it("xóa hồ sơ cố định của tàu, giữ tàu khác", () => {
    setKey("forfish.documents.v1", [
      { id: "d1", boatId: "A", label: "giấy A" },
      { id: "d2", boatId: "B", label: "giấy B" },
    ]);
    setKey("forfish.maintenance.v1", [{ id: "m1", boatId: "A" }]);
    setKey("forfish.trips.v1", [
      { id: "t1", boatId: "A" },
      { id: "t2", boatId: "B" },
    ]);

    const res = purgeBoatData("A");

    expect(res.removed).toBe(3); // d1 + m1 + t1
    expect(getKey("forfish.documents.v1").map((x: { id: string }) => x.id)).toEqual(
      ["d2"],
    );
    expect(getKey("forfish.maintenance.v1")).toEqual([]);
    expect(getKey("forfish.trips.v1").map((x: { id: string }) => x.id)).toEqual([
      "t2",
    ]);
  });

  it("nhả gán hàng SDVICO (không xóa), giữ động theo chủ", () => {
    setKey("forfish.products.v1", [
      { id: "p1", boatId: "A", name: "máy A" },
      { id: "p2", boatId: "B", name: "máy B" },
      { id: "p3", name: "đồ chung" },
    ]);

    const res = purgeBoatData("A");

    expect(res.unassigned).toBe(1);
    const products = getKey("forfish.products.v1");
    expect(products).toHaveLength(3); // không xóa món nào
    expect(products.find((p: { id: string }) => p.id === "p1").boatId).toBeUndefined();
    expect(products.find((p: { id: string }) => p.id === "p2").boatId).toBe("B");
  });

  it("không đụng gì khi tàu không có hồ sơ", () => {
    setKey("forfish.documents.v1", [{ id: "d1", boatId: "A" }]);
    const res = purgeBoatData("Z");
    expect(res).toEqual({ removed: 0, unassigned: 0 });
    expect(getKey("forfish.documents.v1")).toHaveLength(1);
  });
});
