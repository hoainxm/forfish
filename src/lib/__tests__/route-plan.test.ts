import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOAT,
  KMH_PER_KNOT,
  LATERAL_STEPS,
  bearingDeg,
  buildCorridor,
  formatHoursVN,
  haversineKm,
  kmToNm,
  offsetPoint,
  planRoute,
  vnHourIndex,
  type Corridor,
  type LatLon,
  type RouteCell,
} from "../route-plan";
import { parseRouteWeather } from "../route-weather";

const WIDTH = 2 * LATERAL_STEPS + 1;

const calmHours = Array.from({ length: 48 }, () => ({
  waveM: 0.3,
  windKmh: 10,
  windFromDeg: 0,
}));

function calmCell(point: LatLon): RouteCell {
  return { point, onSea: true, hours: calmHours };
}

/** Lưới biển êm, tuỳ biến từng ô qua mod(i hàng, j cột) */
function makeCells(
  c: Corridor,
  mod?: (i: number, j: number, cell: RouteCell) => RouteCell,
): RouteCell[] {
  return c.points.map((p, idx) => {
    const cell = calmCell(p);
    if (idx === 0 || idx === c.points.length - 1 || !mod) return cell;
    const k = idx - 1;
    return mod(Math.floor(k / WIDTH), k % WIDTH, cell);
  });
}

const START: LatLon = { lat: 12.0, lon: 110.0 };
const DEST: LatLon = { lat: 12.0, lon: 112.0 };

describe("hình học", () => {
  it("haversineKm: Hà Nội → TP.HCM ≈ 1140 km", () => {
    const d = haversineKm(
      { lat: 21.0285, lon: 105.8542 },
      { lat: 10.8231, lon: 106.6297 },
    );
    expect(d).toBeGreaterThan(1110);
    expect(d).toBeLessThan(1160);
  });

  it("bearingDeg: đi lên Bắc = 0°, sang Đông ≈ 90°", () => {
    expect(bearingDeg({ lat: 10, lon: 110 }, { lat: 11, lon: 110 })).toBeCloseTo(
      0,
      0,
    );
    expect(
      bearingDeg({ lat: 10, lon: 110 }, { lat: 10, lon: 111 }),
    ).toBeCloseTo(90, 0);
  });

  it("offsetPoint: dời 111,32 km về Bắc = +1° vĩ", () => {
    const p = offsetPoint({ lat: 10, lon: 110 }, 0, 111.32);
    expect(p.lat).toBeCloseTo(11, 3);
    expect(p.lon).toBeCloseTo(110, 3);
  });

  it("kmToNm: 1,852 km = 1 hải lý", () => {
    expect(kmToNm(1.852)).toBeCloseTo(1, 6);
  });
});

describe("buildCorridor", () => {
  it("lưới đúng cỡ, cột giữa nằm trên đường thẳng, points đúng thứ tự", () => {
    const c = buildCorridor(START, DEST);
    expect(c.steps.length).toBeGreaterThanOrEqual(5);
    expect(c.steps.length).toBeLessThanOrEqual(12);
    for (const row of c.steps) expect(row.length).toBe(WIDTH);
    expect(c.points.length).toBe(c.steps.length * WIDTH + 2);
    expect(c.points[0]).toEqual(START);
    expect(c.points[c.points.length - 1]).toEqual(DEST);
    // cột giữa nội suy thẳng giữa start và dest (cùng vĩ độ → lat giữ nguyên)
    for (const row of c.steps) {
      expect(row[c.center].lat).toBeCloseTo(12.0, 6);
    }
  });
});

describe("planRoute", () => {
  it("biển êm → đi thẳng cột giữa, không tiết kiệm gì thêm", () => {
    const c = buildCorridor(START, DEST);
    const plan = planRoute(c, makeCells(c), DEFAULT_BOAT, 6);
    expect(plan).not.toBeNull();
    // mọi waypoint giữa nằm trên cột giữa
    for (const w of plan!.waypoints.slice(1, -1)) {
      expect(w.lat).toBeCloseTo(12.0, 6);
    }
    expect(plan!.direct).not.toBeNull();
    expect(plan!.savedFuelL).toBeLessThan(0.5);
    expect(plan!.hasRoughLeg).toBe(false);
    // thời gian ~ quãng đường / tốc độ (sóng 0,3 m không làm chậm)
    const expected = plan!.distKm / (DEFAULT_BOAT.speedKn * KMH_PER_KNOT);
    expect(plan!.hours).toBeCloseTo(expected, 1);
  });

  it("dải sóng dữ chắn giữa tuyến → đi vòng, né hết vùng dữ, đỡ dầu so với chạy thẳng", () => {
    const c = buildCorridor(START, DEST);
    const mid = Math.floor(c.steps.length / 2);
    const roughHours = calmHours.map(() => ({
      waveM: 5,
      windKmh: 10,
      windFromDeg: 0,
    }));
    // sóng 5 m trên cột giữa và cột kề ở 3 hàng giữa tuyến
    const cells = makeCells(c, (i, j, cell) =>
      Math.abs(i - mid) <= 1 && Math.abs(j - c.center) <= 1
        ? { ...cell, hours: roughHours }
        : cell,
    );
    const plan = planRoute(c, cells, DEFAULT_BOAT, 6);
    expect(plan).not.toBeNull();
    expect(plan!.hasRoughLeg).toBe(false);
    expect(plan!.maxWaveM).toBeLessThan(2.5);
    expect(plan!.direct).not.toBeNull();
    expect(plan!.savedFuelL).toBeGreaterThan(0);
    // đường vòng dài hơn đường thẳng
    expect(plan!.distKm).toBeGreaterThan(plan!.direct!.distKm);
  });

  it("đảo chắn cột giữa → tuyến né được, hết đường so sánh thẳng (direct=null)", () => {
    const c = buildCorridor(START, DEST);
    const mid = Math.floor(c.steps.length / 2);
    const cells = makeCells(c, (i, j, cell) =>
      i === mid && j === c.center ? { ...cell, onSea: false } : cell,
    );
    const plan = planRoute(c, cells, DEFAULT_BOAT, 6);
    expect(plan).not.toBeNull();
    expect(plan!.direct).toBeNull();
    expect(plan!.savedFuelL).toBe(0);
    // không waypoint nào trùng ô bị chặn
    const blocked = c.steps[mid][c.center];
    for (const w of plan!.waypoints) {
      expect(w.lat !== blocked.lat || w.lon !== blocked.lon).toBe(true);
    }
  });

  it("cả một hàng bị chặn (đất liền ngang đường) → trả null", () => {
    const c = buildCorridor(START, DEST);
    const cells = makeCells(c, (i, _j, cell) =>
      i === 2 ? { ...cell, onSea: false } : cell,
    );
    expect(planRoute(c, cells, DEFAULT_BOAT, 6)).toBeNull();
  });

  it("vùng dữ không tránh nổi → vẫn ra tuyến nhưng cắm cờ cảnh báo", () => {
    const c = buildCorridor(START, DEST);
    const roughHours = calmHours.map(() => ({
      waveM: 4,
      windKmh: 10,
      windFromDeg: 0,
    }));
    const cells = makeCells(c, (i, _j, cell) =>
      i === 2 ? { ...cell, hours: roughHours } : cell,
    );
    const plan = planRoute(c, cells, DEFAULT_BOAT, 6);
    expect(plan).not.toBeNull();
    expect(plan!.hasRoughLeg).toBe(true);
    expect(plan!.maxWaveM).toBeCloseTo(4, 5);
  });

  it("ngược gió tốn dầu hơn xuôi gió, cùng quãng đường", () => {
    const c = buildCorridor(START, DEST); // chạy về hướng Đông (90°)
    const windy = (fromDeg: number) =>
      makeCells(c, (_i, _j, cell) => ({
        ...cell,
        hours: calmHours.map(() => ({
          waveM: 0.3,
          windKmh: 30,
          windFromDeg: fromDeg,
        })),
      }));
    const head = planRoute(c, windy(90), DEFAULT_BOAT, 6)!; // gió từ Đông = ngược
    const tail = planRoute(c, windy(270), DEFAULT_BOAT, 6)!; // gió từ Tây = xuôi
    expect(head.fuelL).toBeGreaterThan(tail.fuelL);
  });
});

describe("helpers hiển thị", () => {
  it("formatHoursVN", () => {
    expect(formatHoursVN(9.58)).toBe("9 giờ 35 phút");
    expect(formatHoursVN(2)).toBe("2 giờ");
    expect(formatHoursVN(0.4)).toBe("25 phút");
  });

  it("vnHourIndex: 03:30 UTC = 10 giờ sáng VN", () => {
    expect(vnHourIndex(new Date("2026-06-10T03:30:00Z"))).toBe(10);
    expect(vnHourIndex(new Date("2026-06-10T17:00:00Z"))).toBe(0);
  });
});

describe("parseRouteWeather (adapter)", () => {
  const points: LatLon[] = [
    { lat: 13, lon: 110.5 },
    { lat: 21.03, lon: 105.85 },
  ];
  const wind = [
    {
      hourly: {
        wind_speed_10m: [12, 14],
        wind_direction_10m: [45, 90],
      },
    },
    {
      hourly: {
        wind_speed_10m: [8, 9],
        wind_direction_10m: [180, 200],
      },
    },
  ];
  const wave = [
    { hourly: { wave_height: [1.2, 1.1] } },
    { hourly: { wave_height: [null, null] } }, // điểm trong đất liền
  ];

  it("ghép gió + sóng theo điểm, nhận ra đất liền qua sóng null", () => {
    const cells = parseRouteWeather(wind, wave, points);
    expect(cells.length).toBe(2);
    expect(cells[0].onSea).toBe(true);
    expect(cells[0].hours[0]).toEqual({
      waveM: 1.2,
      windKmh: 12,
      windFromDeg: 45,
    });
    expect(cells[1].onSea).toBe(false);
    expect(cells[1].hours[1].waveM).toBeNull();
    expect(cells[1].hours[1].windKmh).toBe(9);
  });

  it("thiếu hẳn dữ liệu sóng cho một điểm → không vỡ, coi là đất liền", () => {
    const cells = parseRouteWeather(wind, [wave[0], {}], points);
    expect(cells[1].onSea).toBe(false);
    expect(cells[1].hours.length).toBe(2);
  });
});
