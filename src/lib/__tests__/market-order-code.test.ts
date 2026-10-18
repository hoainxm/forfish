import { describe, it, expect } from "vitest";
import { isOrderCode, makeOrderCode, ORDER_CODE_ALPHABET } from "@/lib/market/order-code";

describe("makeOrderCode", () => {
  it("khuôn SD + yymmdd + 4 ký tự; rand cố định ⇒ mã cố định", () => {
    const code = makeOrderCode(new Date("2026-09-06T05:00:00Z"), () => 0);
    expect(code).toBe("SD260906AAAA");
    expect(isOrderCode(code)).toBe(true);
    const last = makeOrderCode(new Date("2026-09-06T05:00:00Z"), () => 0.999999);
    expect(last).toBe("SD2609069999");
  });
  it("ngày theo giờ VN: 23:30 UTC = ngày hôm sau", () => {
    expect(makeOrderCode(new Date("2026-09-06T23:30:00Z"), () => 0).slice(2, 8)).toBe("260907");
    expect(makeOrderCode(new Date("2026-09-06T16:59:00Z"), () => 0).slice(2, 8)).toBe("260906");
  });
  it("alphabet 32 ký tự, không có 0/O/1/I; rand ngoài khoảng không ném", () => {
    expect(ORDER_CODE_ALPHABET).toHaveLength(32);
    for (const bad of ["0", "O", "1", "I"]) expect(ORDER_CODE_ALPHABET).not.toContain(bad);
    expect(isOrderCode(makeOrderCode(new Date(), () => 1.5))).toBe(true);
    expect(isOrderCode(makeOrderCode(new Date(), () => -1))).toBe(true);
    expect(isOrderCode(makeOrderCode(new Date(), () => NaN))).toBe(true);
    expect(isOrderCode(makeOrderCode(new Date(), Math.random))).toBe(true);
  });
  it("isOrderCode từ chối khuôn sai", () => {
    expect(isOrderCode("SD260906K7P")).toBe(false);
    expect(isOrderCode("SD260906K7P0")).toBe(false);
    expect(isOrderCode("sd260906k7pq")).toBe(false);
    expect(isOrderCode(123)).toBe(false);
  });
});
