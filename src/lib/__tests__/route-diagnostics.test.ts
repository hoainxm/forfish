import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_BOAT,
  bboxFor,
  planRoute,
  planRouteWithDiagnostics,
  type PlanArgs,
  type WeatherField,
} from "../route-plan";
import { DEPTH_GRID_BYTES, decodeDepthGrid } from "../depth-grid";

const start = { lat: 12, lon: 110 };
const dest = { lat: 12, lon: 112 };
const bbox = bboxFor(start, dest, 120);
const deep = decodeDepthGrid(new Uint8Array(DEPTH_GRID_BYTES).fill(0x55).buffer);
const land = decodeDepthGrid(new Uint8Array(DEPTH_GRID_BYTES).buffer);

function field(covered = true, waveM = 0.5, box = bbox): WeatherField {
  return {
    lat0: box.latMin, lon0: box.lonMin,
    dLat: (box.latMax - box.latMin) / 4,
    dLon: (box.lonMax - box.lonMin) / 4,
    nLat: 5, nLon: 5,
    cells: Array.from({ length: 25 }, () => ({
      onSea: covered,
      hours: covered ? Array.from({ length: 72 }, () => ({
        waveM, waveFromDeg: 90, wavePeriodS: 6, windKmh: 12,
        windFromDeg: 90, currentKmh: 0, currentToDeg: null,
      })) : [],
    })),
  };
}

const args = (weather = field()): PlanArgs => ({
  start, dest, bbox, field: weather, depth: deep,
  boat: DEFAULT_BOAT, departHourIdx: 0,
});

describe("route diagnostics — phân biệt dữ liệu thiếu với chưa tìm được đường", () => {
  it("hai đầu ngoài khơi nhưng dự báo không phủ: không quy lỗi cho đất", () => {
    expect(planRouteWithDiagnostics(args(field(false)))).toEqual({
      plan: null, failure: "weather-coverage",
    });
  });

  it("đất chặn với dự báo đủ: vẫn không trả tuyến qua đất", () => {
    expect(planRouteWithDiagnostics({ ...args(), depth: land })).toEqual({
      plan: null, failure: "no-route",
    });
  });

  it("có tuyến thì không để lại lý do lỗi và API cũ vẫn nhận được tuyến", () => {
    const input = args();
    const result = planRouteWithDiagnostics(input);
    expect(result.failure).toBeNull();
    expect(result.plan?.waypoints[0]).toEqual(start);
    expect(result.plan?.waypoints.at(-1)).toEqual(dest);
    expect(result.plan?.bestEffortSeas).toBe(false);
    expect(planRoute(input)?.distKm).toBeCloseTo(result.plan!.distKm, 8);
  });

  it("sóng dữ thật vẫn có best-effort và cảnh báo đỏ sau tối ưu retry", () => {
    const result = planRouteWithDiagnostics(args(field(true, 5)));
    expect(result.failure).toBeNull();
    expect(result.plan?.bestEffortSeas).toBe(true);
    expect(result.plan!.maxWaveM).toBeGreaterThanOrEqual(4);
    expect(result.plan?.segRisks).toContain("red");
  });

  it("không cấm cảng class 0: Tam Quang trên lưới thật vẫn có đường ra khơi", () => {
    const raw = fs.readFileSync(path.resolve(__dirname, "../../../public/data/depth-grid.v1.bin"));
    const realDepth = decodeDepthGrid(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    const port = { lat: 15.471714, lon: 108.683238 };
    const offshore = { lat: 8.44, lon: 109.15 };
    const box = bboxFor(port, offshore, 150);
    const result = planRouteWithDiagnostics({
      ...args(field(true, 0.5, box)), start: port, dest: offshore,
      bbox: box, depth: realDepth,
    });
    expect(result.failure).toBeNull();
    expect(result.plan?.waypoints[0]).toEqual(port);
    expect(result.plan?.waypoints.at(-1)).toEqual(offshore);
    expect(result.plan?.hasNearLandLeg).toBe(true);
  });
});
