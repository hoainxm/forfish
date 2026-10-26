import { describe, expect, it } from "vitest";
import { fracInPlot } from "../use-pointer-scrub";

describe("vị trí ngón tay trong vùng vẽ SVG co giãn", () => {
  it("không lề: tỉ lệ thẳng theo bề ngang hiển thị", () => {
    expect(fracInPlot(150, 100, 200, 320)).toBeCloseTo(0.25);
    expect(fracInPlot(100, 100, 200, 320)).toBe(0);
    expect(fracInPlot(300, 100, 200, 320)).toBe(1);
  });

  it("có lề trục (đơn vị viewBox): mép trái/phải vùng vẽ = 0/1", () => {
    // viewBox 320, lề trái 30, lề phải 8 → vùng vẽ 282; hiển thị 640 px (×2)
    expect(fracInPlot(60, 0, 640, 320, 30, 8)).toBeCloseTo(0);
    expect(fracInPlot(624, 0, 640, 320, 30, 8)).toBeCloseTo(1);
    expect(fracInPlot(342, 0, 640, 320, 30, 8)).toBeCloseTo(0.5);
  });

  it("ra ngoài vùng vẽ thì < 0 / > 1 (người gọi tự kẹp), số hỏng → NaN", () => {
    expect(fracInPlot(0, 0, 640, 320, 30, 8)).toBeLessThan(0);
    expect(fracInPlot(640, 0, 640, 320, 30, 8)).toBeGreaterThan(1);
    expect(fracInPlot(10, 0, 0, 320)).toBeNaN();
    expect(fracInPlot(Number.NaN, 0, 640, 320)).toBeNaN();
    expect(fracInPlot(10, 0, 640, 20, 15, 10)).toBeNaN();
  });
});
