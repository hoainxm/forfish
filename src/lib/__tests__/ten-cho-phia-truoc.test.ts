import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { nearestNamedPoint, tenChoPhiaTruoc } from "@/lib/sea-lanes";

// dữ liệu THẬT trong repo — câu đọc phải gọi đúng tên bà con biết
const islands = JSON.parse(readFileSync("public/data/vn-islands.v1.json", "utf8")).features;
const reefs = JSON.parse(readFileSync("public/data/coral-reefs.v1.json", "utf8")).features;

describe("tenChoPhiaTruoc — gọi tên chỗ phía trước", () => {
  it("chạm bờ cạnh Lý Sơn ⇒ 'đảo Lý Sơn'", () => {
    expect(tenChoPhiaTruoc(islands, reefs, { lat: 15.38, lon: 109.13 }, "bo")).toBe("đảo Lý Sơn");
  });
  it("tên có sẵn 'Hòn' thì không thêm 'đảo'", () => {
    expect(tenChoPhiaTruoc(islands, reefs, { lat: 19.37, lon: 105.93 }, "bo")).toBe("Hòn Mê");
  });
  it("rạn ⇒ tên bãi trong 3 km", () => {
    expect(tenChoPhiaTruoc(islands, reefs, { lat: 9.82, lon: 115.87 }, "ran")).toBe("Bãi Cỏ Mây");
  });
  it("giữa biển không tên gần ⇒ null (giữ câu cũ, không đoán)", () => {
    expect(tenChoPhiaTruoc(islands, reefs, { lat: 12, lon: 111 }, "bo")).toBeNull();
    expect(tenChoPhiaTruoc(null, null, { lat: 15.38, lon: 109.13 }, "bo")).toBeNull();
  });
  it("ngoài bán kính thì không lấy", () => {
    expect(nearestNamedPoint(islands, { lat: 15.6, lon: 109.12 }, 6)).toBeNull();
  });
});
