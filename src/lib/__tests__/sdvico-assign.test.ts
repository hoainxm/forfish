import { describe, it, expect } from "vitest";
import { unassignedAssetIds, SHARED, type AssignMap } from "../sdvico-assign";

const assets = {
  products: [{ id: "p1" }, { id: "p2" }],
  services: [{ id: "s1" }],
};

describe("unassignedAssetIds (hỏi gán SDVICO — AC-6)", () => {
  it("trả mọi món khi chưa gán gì", () => {
    expect(unassignedAssetIds(assets, {})).toEqual(["p1", "p2", "s1"]);
  });

  it("bỏ qua món đã gán tàu", () => {
    const map: AssignMap = { p1: "A" };
    expect(unassignedAssetIds(assets, map)).toEqual(["p2", "s1"]);
  });

  it("'Dùng chung' (SHARED) coi như đã chọn — không hỏi lại", () => {
    const map: AssignMap = { p1: "A", p2: SHARED, s1: SHARED };
    expect(unassignedAssetIds(assets, map)).toEqual([]);
  });
});
