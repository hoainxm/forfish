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
  /*  TÍNH THEO HẢI ĐỒ KHI THIẾU DỰ BÁO (2026-10-16). Trước đây ca này trả
      `{ plan: null, failure: "weather-coverage" }` ⇒ dẫn đường chết hẳn lúc
      Open-Meteo từ chối (429). Nay ra tuyến, mang `noWeatherKm` để UI cảnh báo. */
  it("hai đầu ngoài khơi nhưng dự báo không phủ: vẫn ra tuyến THEO HẢI ĐỒ, đếm quãng không có số", () => {
    const r = planRouteWithDiagnostics(args(field(false)));
    expect(r.failure).toBeNull();
    expect(r.plan?.waypoints[0]).toEqual(start);
    expect(r.plan?.waypoints.at(-1)).toEqual(dest);
    // gần trọn tuyến không có số (trừ bán kính sát hai đầu)
    expect(r.plan!.noWeatherKm).toBeGreaterThan(r.plan!.distKm * 0.8);
    expect(r.plan!.noWeatherKm).toBeLessThanOrEqual(r.plan!.distKm + 1e-6);
    // không có số thì không bịa sóng: 0 là "không biết", UI đọc noWeatherKm
    expect(r.plan!.maxWaveM).toBe(0);
    expect(r.plan!.weatherSeen).toBe(false);
    expect(r.plan!.beyondForecastH).toBe(0);
  });

  it("lưới RỖNG hẳn (source 'none', 0 ô) cũng ra tuyến theo hải đồ", () => {
    const rong: WeatherField = {
      lat0: 0, lon0: 0, dLat: 1, dLon: 1, nLat: 0, nLon: 0, cells: [], source: "none",
    };
    const r = planRouteWithDiagnostics(args(rong));
    expect(r.failure).toBeNull();
    expect(r.plan!.noWeatherKm).toBeGreaterThan(r.plan!.distKm * 0.8);
  });

  it("thiếu dự báo KHÔNG được mở đường qua đất: đất + không dự báo ⇒ no-route", () => {
    expect(planRouteWithDiagnostics({ ...args(field(false)), depth: land })).toEqual({
      plan: null, failure: "no-route",
    });
  });

  it("dự báo phủ một nửa: tuyến ra, chỉ đếm phần không có số", () => {
    const half = field(true);
    // bỏ số từ cột j = 2 về đông. Khung có lề 120 km nên đích (112°E) nằm ở
    // x ≈ 2,95: mẫu x ∈ [2, 3) có cả bốn góc không số ⇒ nửa đông chạy mù
    half.cells = half.cells.map((c, k) => (k % 5 >= 2 ? { onSea: false, hours: [] } : c));
    const r = planRouteWithDiagnostics(args(half));
    expect(r.failure).toBeNull();
    expect(r.plan!.noWeatherKm).toBeGreaterThan(0);
    expect(r.plan!.noWeatherKm).toBeLessThan(r.plan!.distKm * 0.8);
    // phần có số vẫn đọc được sóng thật
    expect(r.plan!.maxWaveM).toBeCloseTo(0.5, 5);
    expect(r.plan!.weatherSeen).toBe(true);
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
    // dự báo phủ trọn ⇒ không có đoạn nào chạy mù
    expect(result.plan?.noWeatherKm).toBe(0);
    expect(result.plan?.weatherSeen).toBe(true);
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
