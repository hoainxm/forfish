import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadBoats,
  saveBoats,
  loadCurrentBoatId,
  saveCurrentBoatId,
  type Boat,
} from "@/lib/boats";

// Cùng pattern auth-scope.test.ts — stub window.localStorage (không cần jsdom).
function makeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}
const store = makeStore();
vi.stubGlobal("window", { localStorage: store });

beforeEach(() => store.clear());

describe("loadBoats — KHÔNG seed tàu mẫu (fix data 'dùng chung' 2026-07-02)", () => {
  it("chưa có gì → rỗng (không tạo 'Tàu của tôi' mặc định)", () => {
    expect(loadBoats()).toEqual([]);
  });

  it("mảng rỗng đã lưu → vẫn rỗng", () => {
    store.setItem("forfish.boats.v1", "[]");
    expect(loadBoats()).toEqual([]);
  });

  it("JSON hỏng → rỗng, không crash", () => {
    store.setItem("forfish.boats.v1", "{hỏng");
    expect(loadBoats()).toEqual([]);
  });

  it("có tàu thật đã lưu → trả đúng list", () => {
    const boats: Boat[] = [{ id: "b1", name: "Tàu câu Bình Minh", maTau: "BV-1234-TS" }];
    saveBoats(boats);
    expect(loadBoats()).toEqual(boats);
  });
});

describe("current boat id", () => {
  it("chưa chọn → null", () => {
    expect(loadCurrentBoatId()).toBe(null);
  });

  it("lưu rồi đọc lại", () => {
    saveCurrentBoatId("b1");
    expect(loadCurrentBoatId()).toBe("b1");
  });
});
