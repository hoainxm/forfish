import { describe, it, expect } from "vitest";
import {
  binOf, staticBins, fitStaticLift, staticLogLift, medianPositive, irlsLogistic, rankFraction, rankToScore, scoreBase,
  BASE_DEFAULT_KS, BASE_LAT_BINS, type BaseFeatures,
} from "../fish-base";

describe("fish-base", () => {
  it("binOf / staticBins: bậc đúng, thiếu = -1, vĩ kẹp", () => {
    expect(binOf(30, [0, 20, 50, Infinity])).toBe(1);
    expect(binOf(NaN, [0, 20])).toBe(-1);
    expect(staticBins(30, 12, 11.7)).toEqual([1, 2, 11]);
    expect(staticBins(NaN, 12, 99)[2]).toBe(BASE_LAT_BINS - 1);
  });

  it("medianPositive: bỏ 0/âm, rỗng = mặc định", () => {
    expect(medianPositive([0, 10, 30, 20, -5])).toBe(20);
    expect(medianPositive([10, 20])).toBe(15);
    expect(medianPositive([0])).toBe(BASE_DEFAULT_KS);
  });

  it("fitStaticLift: bậc nhiều cá hơn trung bình có log-lift dương, bậc không dữ liệu ~ 0", () => {
    const L = fitStaticLift([[100, 10, 0]], [[50, 50, 0]]);
    expect(L[0][0]).toBeGreaterThan(0);
    expect(L[0][1]).toBeLessThan(0);
    expect(L[0][2]).toBeCloseTo(0, 5);
    const t = { depth: [0.5, -0.2], coast: [0.1], lat: Array(BASE_LAT_BINS).fill(0.3) };
    expect(staticLogLift(t, [0, 0, 5])).toBeCloseTo(0.5 + 0.1 + 0.3);
    expect(staticLogLift(t, [-1, -1, 5])).toBeCloseTo(0.3);
  });

  it("irlsLogistic: tìm lại hệ số dương cho đặc trưng có tín hiệu, ~0 cho nhiễu", () => {
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const rows = [];
    for (let i = 0; i < 4000; i++) {
      const a = rnd(), b = rnd();
      const p = 1 / (1 + Math.exp(-(-1 + 4 * a)));
      rows.push({ x: [1, a, b], y: (rnd() < p ? 1 : 0) as 0 | 1, w: 1 });
    }
    const beta = irlsLogistic(rows, 1e-4);
    expect(beta[1]).toBeGreaterThan(3);
    expect(Math.abs(beta[2])).toBeLessThan(0.6);
    expect(beta[0]).toBeLessThan(-0.4);
  });

  it("rankFraction + rankToScore: đơn điệu, chỉ hotShare ô cao nhất ≥ 50", () => {
    const r = rankFraction([5, 1, 1, 9]);
    expect(r[1]).toBe(r[2]);
    expect(r[3]).toBe(1);
    const vals = Array.from({ length: 1000 }, (_, i) => i);
    const rk = rankFraction(vals);
    const sc = Array.from(rk, (x) => rankToScore(x, 0.2));
    const hot = sc.filter((v) => v >= 50).length / sc.length;
    expect(hot).toBeGreaterThan(0.18);
    expect(hot).toBeLessThan(0.23);
    for (let i = 1; i < sc.length; i++) expect(sc[i]).toBeGreaterThanOrEqual(sc[i - 1]);
    expect(sc[0]).toBe(0);
    expect(sc[999]).toBe(100);
  });

  it("scoreBase: ô có kg + tàu + lift cao xếp trên; thiếu kênh xc vẫn chạy bằng coefNoCatch; không hệ số nhóm = 0", () => {
    const feats: BaseFeatures[] = [[0, 0, -1, 1], [0.9, 0.8, 1, 1], [0.1, 0.1, 0, 1]];
    const p = { coef: { g: [-2, 3, 1, 0.5, 0] }, coefNoCatch: { g: [-2, 1, 0.5, 0] }, hotShare: 0.3, mode: "irls" as const };
    const a = scoreBase(p, "g", feats, true);
    expect(a[1]).toBeGreaterThan(a[2]);
    expect(a[2]).toBeGreaterThan(a[0]);
    const b = scoreBase(p, "g", feats, false);
    expect(b[1]).toBeGreaterThan(b[0]);
    expect(Array.from(scoreBase(p, "khác", feats, true))).toEqual([0, 0, 0]);
    const c = scoreBase({ ...p, mode: "rank" }, "khác", feats, true);
    expect(c[1]).toBeGreaterThan(c[0]);
  });
});
