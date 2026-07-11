import { describe, it, expect, beforeEach, vi } from "vitest";

// localStorage mock (env node — không có jsdom). boats.ts đọc/ghi qua
// window.localStorage nên gắn cả window lẫn globalThis.
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
  addBoat,
  removeBoat,
  setCurrentBoat,
  updateBoat,
  _resetBoatsForTest,
} from "../boat-store";
import type { Boat } from "../boats";

const boat = (id: string, name = id): Boat => ({ id, name });
const ids = () =>
  (JSON.parse(localStorage.getItem("forfish.boats.v1") || "[]") as Boat[]).map(
    (b) => b.id,
  );

beforeEach(() => {
  localStorage.clear();
  _resetBoatsForTest();
});

describe("boat-store actions", () => {
  it("addBoat thêm tàu và đặt làm tàu đang chọn", () => {
    addBoat(boat("a", "Tàu A"));
    addBoat(boat("b", "Tàu B"));
    expect(ids()).toEqual(["a", "b"]);
    expect(localStorage.getItem("forfish.currentBoat.v1")).toBe("b");
  });

  it("removeBoat trả false khi chỉ còn 1 tàu (R7 luôn ≥1)", () => {
    addBoat(boat("solo"));
    expect(removeBoat("solo")).toBe(false);
    expect(ids()).toEqual(["solo"]);
  });

  it("removeBoat gọi cascade và nhảy current sang tàu còn lại", () => {
    addBoat(boat("x"));
    addBoat(boat("y")); // current = y
    const cascade = vi.fn();
    expect(removeBoat("y", cascade)).toBe(true);
    expect(cascade).toHaveBeenCalledWith("y");
    expect(localStorage.getItem("forfish.currentBoat.v1")).toBe("x");
    expect(ids()).toEqual(["x"]);
  });

  it("updateBoat sửa tàu tại chỗ, không đổi current", () => {
    addBoat(boat("p"));
    addBoat(boat("q"));
    setCurrentBoat("p");
    updateBoat({ id: "q", name: "Tàu Q đổi tên", maTau: "BV-9" });
    const list = JSON.parse(
      localStorage.getItem("forfish.boats.v1") || "[]",
    ) as Boat[];
    expect(list.find((b) => b.id === "q")?.name).toBe("Tàu Q đổi tên");
    expect(localStorage.getItem("forfish.currentBoat.v1")).toBe("p");
  });
});
