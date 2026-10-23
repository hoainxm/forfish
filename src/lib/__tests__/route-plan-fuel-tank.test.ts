import { describe, expect, it } from "vitest";
import { DEFAULT_BOAT, fuelReturnCheck, positiveOrNull } from "@/lib/route-plan";

describe("D6 két dầu + chiều dài trong hồ sơ tàu", () => {
  it("hồ sơ mặc định chưa khai két ⇒ không kiểm (im lặng)", () => {
    expect(DEFAULT_BOAT.fuelTankL ?? null).toBeNull();
    expect(fuelReturnCheck(DEFAULT_BOAT, 100)).toBeNull();
  });

  it("đủ dầu đi về ×1,3", () => {
    // 100 L một chiều → cần 260 L
    expect(fuelReturnCheck({ fuelTankL: 300 }, 100)).toEqual({ needL: 260, tankL: 300, enough: true });
    expect(fuelReturnCheck({ fuelTankL: 260 }, 100)?.enough).toBe(true);
  });

  it("thiếu dầu đi về ⇒ enough=false", () => {
    expect(fuelReturnCheck({ fuelTankL: 200 }, 100)).toEqual({ needL: 260, tankL: 200, enough: false });
  });

  it("đầu vào xấu ⇒ null, không đoán", () => {
    expect(fuelReturnCheck({ fuelTankL: 300 }, NaN)).toBeNull();
    expect(fuelReturnCheck({ fuelTankL: 300 }, -5)).toBeNull();
    expect(fuelReturnCheck({ fuelTankL: -1 }, 10)).toBeNull();
    expect(fuelReturnCheck({ fuelTankL: 0 }, 10)).toBeNull();
  });

  it("positiveOrNull chỉ nhận số dương trong trần", () => {
    expect(positiveOrNull(18.5, 200)).toBe(18.5);
    expect(positiveOrNull("18", 200)).toBeNull();
    expect(positiveOrNull(0, 200)).toBeNull();
    expect(positiveOrNull(Infinity, 200)).toBeNull();
    expect(positiveOrNull(500, 200)).toBeNull();
  });
});
