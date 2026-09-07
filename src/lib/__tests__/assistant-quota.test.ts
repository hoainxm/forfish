import { describe, expect, it } from "vitest";
import {
  clampDailyLimit, hydrateQuota, nextVnMidnight, serializeQuota, takeQuota, vnDayKey, type QuotaStore,
} from "@/lib/assistant/server/quota";

/*  HẠN MỨC LƯỢT HỎI MẠNG (14 §6.3, 13 AC-T52): 30/ngày/SĐT mặc định, lượt 31
    bị chặn, sang ngày VN mới thì reset, trần kẹp 1..500.  */

const T = Date.parse("2026-09-06T10:00:00+07:00");

describe("assistant-quota", () => {
  it("lượt 1..30 qua, lượt 31 → ok:false remaining 0", () => {
    const store: QuotaStore = new Map();
    let last = takeQuota("0901", 30, T, store);
    for (let i = 1; i < 30; i++) last = takeQuota("0901", 30, T, store);
    expect(last.ok).toBe(true);
    expect(last.remaining).toBe(0);
    const over = takeQuota("0901", 30, T, store);
    expect(over.ok).toBe(false);
    expect(over.remaining).toBe(0);
    // SĐT khác không bị ảnh hưởng
    expect(takeQuota("0902", 30, T, store).ok).toBe(true);
  });

  it("sang ngày VN mới → reset (23:59 VN vs 00:01 VN hôm sau)", () => {
    const store: QuotaStore = new Map();
    const late = Date.parse("2026-09-06T23:59:00+07:00");
    for (let i = 0; i < 2; i++) takeQuota("p", 2, late, store);
    expect(takeQuota("p", 2, late, store).ok).toBe(false);
    const next = Date.parse("2026-09-07T00:01:00+07:00");
    expect(takeQuota("p", 2, next, store).ok).toBe(true);
    expect(vnDayKey(late)).toBe("2026-09-06");
    expect(vnDayKey(next)).toBe("2026-09-07");
  });

  it("resetAt = 0h VN ngày kế", () => {
    expect(nextVnMidnight(T)).toBe(Date.parse("2026-09-07T00:00:00+07:00"));
    const r = takeQuota("x", 5, T, new Map());
    expect(r.resetAt).toBeGreaterThan(T);
  });

  it("clampDailyLimit: mặc định 30, kẹp 1..500", () => {
    expect(clampDailyLimit(null)).toBe(30);
    expect(clampDailyLimit("abc")).toBe(30);
    expect(clampDailyLimit("0")).toBe(1);
    expect(clampDailyLimit("9999")).toBe(500);
    expect(clampDailyLimit("12")).toBe(12);
    expect(clampDailyLimit(7.9)).toBe(7);
  });

  it("serialize/hydrate: chỉ giữ ngày hiện tại, không hạ số đang có", () => {
    const store: QuotaStore = new Map();
    takeQuota("a", 30, T, store);
    takeQuota("a", 30, T, store);
    const flat = serializeQuota(store, T);
    expect(flat).toEqual({ a: 2 });
    const store2: QuotaStore = new Map([["a", { day: vnDayKey(T), n: 5 }]]);
    hydrateQuota(store2, { day: vnDayKey(T), counts: { a: 2, b: 1 } }, vnDayKey(T));
    expect(store2.get("a")?.n).toBe(5);
    expect(store2.get("b")?.n).toBe(1);
    hydrateQuota(store2, { day: "2020-01-01", counts: { c: 9 } }, vnDayKey(T));
    expect(store2.has("c")).toBe(false);
    hydrateQuota(store2, "rác", vnDayKey(T));
  });
});
