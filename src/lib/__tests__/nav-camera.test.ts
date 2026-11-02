import { describe, expect, it } from "vitest";
import { lechCamera } from "@/lib/nav-camera";

describe("lechCamera — tàu đặt ngược hướng chạy", () => {
  const W = 400, H = 800;
  it("chưa biết hướng ⇒ như cũ: dồn xuống 22 %", () => {
    expect(lechCamera(null, W, H)).toEqual([0, 176]);
  });
  it("chạy Bắc ⇒ tàu dưới tâm", () => {
    expect(lechCamera(0, W, H)).toEqual([0, 176]);
  });
  it("chạy Đông ⇒ tàu lệch trái, phía Đông rộng", () => {
    const [x, y] = lechCamera(90, W, H);
    expect(x).toBe(-100);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  });
  it("chạy Tây ⇒ tàu lệch phải", () => {
    expect(lechCamera(270, W, H)[0]).toBe(100);
  });
  it("chạy Nam ⇒ tàu lên trên tâm nhưng không quá 5 % (chừa HUD)", () => {
    expect(lechCamera(180, W, H)).toEqual([0, -40]);
  });
});
