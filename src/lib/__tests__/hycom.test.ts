import { describe, expect, it } from "vitest";
import {
  decodeTemp,
  hycomHoursToISO,
  iso20Depth,
  iso20Grid,
  parseHycomTempAscii,
  parseTimeCount,
  thermoGridUrl,
} from "../hycom";

describe("decodeTemp", () => {
  it("Int16 → °C = v*0.001+20; fill -30000 → NaN", () => {
    expect(decodeTemp(9432)).toBeCloseTo(29.432, 3);
    expect(decodeTemp(-947)).toBeCloseTo(19.053, 3);
    expect(Number.isNaN(decodeTemp(-30000))).toBe(true);
  });
});

describe("hycomHoursToISO", () => {
  it("giờ-từ-2000-01-01 → ngày", () => {
    expect(hycomHoursToISO(0)).toBe("2000-01-01");
    expect(hycomHoursToISO(231756)).toBe("2026-06-09"); // ~mốc nowcast thật
  });
});

describe("iso20Depth", () => {
  it("nội suy đúng độ sâu cắt 20°C", () => {
    // 70 m: 24.24 → 125 m: 19.05 → cắt 20 ở ~115 m (giống điểm 16N/116E thật)
    const d = iso20Depth([0, 70, 125, 300], [29.4, 24.24, 19.05, 11.6]);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(120);
  });
  it("cột luôn ấm (đáy nông) → NaN", () => {
    expect(Number.isNaN(iso20Depth([0, 40, 70], [29, 28, 25]))).toBe(true);
  });
  it("bỏ qua tầng thiếu (NaN) khi quét", () => {
    const d = iso20Depth([20, 70, 125], [29, NaN, 19]);
    // bắc cầu 20→125 (29 và 19) → cắt 20 ở ~114.5 m
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(120);
  });
});

describe("parseHycomTempAscii + iso20Grid", () => {
  // bản ascii rút gọn: time=1, depth=3 (20,70,125 m), lat=2, lon=2
  const sample = `Dataset {
  Grid {
   ARRAY:
      Int16 water_temp[time = 1][depth = 3][lat = 2][lon = 2];
  } water_temp;
} ESPC-D-V02/t3z;
---------------------------------------------
water_temp.water_temp[1][3][2][2]
[0][0][0], 9300, 9310
[0][0][1], 9320, 9330
[0][1][0], 4200, 4300
[0][1][1], 4400, 4500
[0][2][0], -900, -800
[0][2][1], -700, -30000

water_temp.time[1]
231756.0

water_temp.depth[3]
20.0, 70.0, 125.0

water_temp.lat[2]
12.0, 14.0

water_temp.lon[2]
110.0, 112.0
`;

  it("đọc đúng toạ độ + giải mã ô", () => {
    const cube = parseHycomTempAscii(sample);
    expect(cube.depths).toEqual([20, 70, 125]);
    expect(cube.lats).toEqual([12, 14]);
    expect(cube.lons).toEqual([110, 112]);
    expect(cube.date).toBe("2026-06-09");
    // depth0(20m), lat0(12N), lon0(110E) = 9300 → 29.3°C
    expect(cube.temp[0][0][0]).toBeCloseTo(29.3, 2);
    // depth2(125m), lat1(14N), lon1(112E) = fill → NaN
    expect(Number.isNaN(cube.temp[2][1][1])).toBe(true);
  });

  it("→ lưới D20 hợp lệ (cột có cắt 20°C)", () => {
    const grid = iso20Grid(parseHycomTempAscii(sample));
    expect(grid.lats).toEqual([12, 14]);
    // cột lat0/lon0: 70m 24.2 → 125m 19.1 → cắt 20 trong (70,125)
    const d = grid.values[0][0];
    expect(d).toBeGreaterThan(70);
    expect(d).toBeLessThan(125);
  });
});

describe("parseTimeCount + thermoGridUrl", () => {
  it("đọc số mốc thời gian từ .dds", () => {
    const dds = "Float64 time[time = 5329];\n Grid { } water_temp;";
    expect(parseTimeCount(dds)).toBe(5329);
  });
  it("URL có ?water_temp + index thời gian + dải, brackets đã encode", () => {
    const u = thermoGridUrl(5328);
    expect(u).toContain("t3z.ascii?water_temp"); // OPeNDAP cần ?<biến>
    expect(u).toContain("%5B5328%5D");
    expect(u).not.toContain("[");
  });
});
