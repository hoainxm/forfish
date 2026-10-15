import { describe, expect, it } from "vitest";

import { haversineKm } from "@/lib/route-plan";
import { routePointRows } from "@/lib/route-points";

const A = { lat: 10.3, lon: 107.08 };
const B = { lat: 10.1, lon: 107.4 };
const C = { lat: 9.9, lon: 107.7 };
const D = { lat: 9.6, lon: 108.0 };
const E = { lat: 9.4, lon: 108.3 };

describe("routePointRows", () => {
  it("tuyến rỗng → không có hàng", () => {
    expect(routePointRows([], [])).toEqual([]);
  });

  it("một chặng: đầu · chỗ đổi hướng · đích, km cộng dồn đúng", () => {
    const rows = routePointRows([A, B, C], [2], [0, 1.5, 3]);
    expect(rows.map((r) => r.kind)).toEqual(["start", "turn", "dest"]);
    expect(rows.map((r) => r.idx)).toEqual([0, 1, 2]);
    expect(rows[0].km).toBe(0);
    expect(rows[1].km).toBeCloseTo(haversineKm(A, B), 6);
    expect(rows[2].km).toBeCloseTo(haversineKm(A, B) + haversineKm(B, C), 6);
    expect(rows.map((r) => r.hours)).toEqual([0, 1.5, 3]);
    expect(rows[2].stopNo).toBe(1);
    expect(rows[1].stopNo).toBeUndefined();
  });

  it("nhiều chặng: chỗ ghé giữa đường mang số ghé, điểm cuối mang số cuối", () => {
    const rows = routePointRows([A, B, C, D, E], [2, 4]);
    expect(rows.map((r) => r.kind)).toEqual(["start", "turn", "stop", "turn", "dest"]);
    expect(rows[2].stopNo).toBe(1);
    expect(rows[4].stopNo).toBe(2);
  });

  it("chỗ đổi hướng đánh số LIỀN MẠCH, chỗ ghé không chiếm số", () => {
    // start · turn · turn · stop · stop · turn · dest — trước đây in idx: 1, 2, 5
    const rows = routePointRows([A, B, C, D, E, A, B], [3, 4, 6]);
    expect(rows.map((r) => r.kind)).toEqual([
      "start", "turn", "turn", "stop", "stop", "turn", "dest",
    ]);
    expect(rows.filter((r) => r.kind === "turn").map((r) => r.turnNo)).toEqual([1, 2, 3]);
    expect(rows.filter((r) => r.kind !== "turn").every((r) => r.turnNo === undefined)).toBe(true);
    expect(rows[3].stopNo).toBe(1);
    expect(rows[4].stopNo).toBe(2);
  });

  it("hoursAt lệch độ dài → bỏ cột giờ, không đoán", () => {
    const rows = routePointRows([A, B, C], [2], [0, 1]);
    expect(rows.every((r) => r.hours === null)).toBe(true);
    expect(routePointRows([A, B], [1]).every((r) => r.hours === null)).toBe(true);
  });

  it("chỉ số ghé trùng/ngoài mảng không làm hỏng hàng", () => {
    const rows = routePointRows([A, B, C], [1, 1, 9]);
    expect(rows.map((r) => r.kind)).toEqual(["start", "stop", "dest"]);
    expect(rows[1].stopNo).toBe(1);
    expect(rows[2].stopNo).toBe(3);
  });

  it("toạ độ giữ nguyên, không làm tròn", () => {
    const rows = routePointRows([A, { lat: 10.123456, lon: 107.654321 }], [1]);
    expect(rows[1]).toMatchObject({ lat: 10.123456, lon: 107.654321 });
  });
});
