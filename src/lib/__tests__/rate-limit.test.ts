import { describe, it, expect } from "vitest";
import { allowRequest, type RateStore } from "@/lib/rate-limit";

/*  GIỚI HẠN LƯỢT /api/fish-forecast (2026-09-16) — cửa sổ trượt theo SĐT.
    Ca đối chứng đủ ba phía: dưới trần cho qua · chạm trần chặn · qua cửa sổ
    thì mở lại · khoá khác không ảnh hưởng nhau · đầu vào vô lý không ném. */

const W = { limit: 3, windowMs: 1000 };

describe("allowRequest — cửa sổ trượt", () => {
  it("dưới trần thì cho qua, chạm trần thì chặn", () => {
    const s: RateStore = new Map();
    expect(allowRequest(s, "a", 0, W)).toBe(true);
    expect(allowRequest(s, "a", 10, W)).toBe(true);
    expect(allowRequest(s, "a", 20, W)).toBe(true);
    expect(allowRequest(s, "a", 30, W), "lượt 4 trong 1 s phải bị chặn").toBe(false);
  });

  it("lượt bị chặn KHÔNG tính vào cửa sổ — không kéo dài hình phạt", () => {
    const s: RateStore = new Map();
    for (let i = 0; i < 3; i++) allowRequest(s, "a", i, W);
    allowRequest(s, "a", 500, W); // chặn
    // 0,1,2 rơi khỏi cửa sổ tại t=1003; lượt chặn ở 500 không được giữ lại
    expect(allowRequest(s, "a", 1003, W)).toBe(true);
    expect(s.get("a")).toEqual([1003]);
  });

  it("qua cửa sổ thì mở lại", () => {
    const s: RateStore = new Map();
    for (let i = 0; i < 3; i++) allowRequest(s, "a", i, W);
    expect(allowRequest(s, "a", 999, W)).toBe(false);
    expect(allowRequest(s, "a", 1001, W)).toBe(true);
  });

  it("mỗi SĐT một sổ riêng", () => {
    const s: RateStore = new Map();
    for (let i = 0; i < 3; i++) allowRequest(s, "a", i, W);
    expect(allowRequest(s, "a", 5, W)).toBe(false);
    expect(allowRequest(s, "b", 5, W)).toBe(true);
  });

  it("limit/window vô lý → mặc định an toàn, không ném", () => {
    const s: RateStore = new Map();
    expect(allowRequest(s, "a", 0, { limit: NaN, windowMs: -1 })).toBe(true);
    expect(allowRequest(s, "a", 1, { limit: 0, windowMs: 0 })).toBe(false);
  });

  it("kho không phình vô hạn — khoá cũ nhất bị đuổi", () => {
    const s: RateStore = new Map();
    for (let i = 0; i < 5000; i++) allowRequest(s, `k${i}`, i, W);
    expect(s.size).toBe(5000);
    expect(allowRequest(s, "moi", 6000, W)).toBe(true);
    expect(s.size).toBe(5000);
    expect(s.has("k0")).toBe(false);
    expect(s.has("moi")).toBe(true);
  });
});
