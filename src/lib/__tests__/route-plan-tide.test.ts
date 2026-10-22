import { describe, expect, it } from "vitest";
import { bboxFor, planRoute, type HourSample, type LatLon, type WeatherField } from "../route-plan";
import { DEPTH_GRID_BYTES, DEPTH_META, decodeDepthGrid, type DepthClass } from "../depth-grid";

/*  TRIỀU VÀO LUẬT ĐỘ SÂU LỚP 3 TẠI ETA (B4, 2026-10-22). Dải 2–4 m chắn kín
 *  giữa đường; tàu mớn 1,8 m (cần 2,3 m > trần tĩnh 2,0): chỉ qua được khi triều
 *  tại ETA cộng ≥ +0,3 m so z0. Triều KHÔNG vào chi phí — chỉ mở/đóng lớp 3. */

const START: LatLon = { lat: 12.0, lon: 110.0 };
const DEST: LatLon = { lat: 12.0, lon: 112.0 };
const BB = bboxFor(START, DEST, 120);
const HOUR: HourSample = {
  waveM: 0, waveFromDeg: null, wavePeriodS: null, windKmh: 10, windFromDeg: 0, currentKmh: 0, currentToDeg: null,
};

function field(): WeatherField {
  const n = 9;
  const lats = Array.from({ length: n }, (_, i) => BB.latMin + ((BB.latMax - BB.latMin) * i) / (n - 1));
  const lons = Array.from({ length: n }, (_, j) => BB.lonMin + ((BB.lonMax - BB.lonMin) * j) / (n - 1));
  const cells = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) cells.push({ onSea: true, hours: Array.from({ length: 72 }, () => HOUR) });
  return { lat0: lats[0], lon0: lons[0], dLat: lats[1] - lats[0], dLon: lons[1] - lons[0], nLat: n, nLon: n, cells };
}

function depth() {
  const { lon0, step, nLat, nLon } = DEPTH_META;
  const packed = new Uint8Array(DEPTH_GRID_BYTES);
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const lon = lon0 + j * step;
      const cls: DepthClass = lon > 110.9 && lon < 111.1 ? 3 : 5;
      const k = i * nLon + j;
      packed[k >> 1] |= cls << ((k & 1) * 4);
    }
  return decodeDepthGrid(packed.buffer);
}

const Z0 = 2.0;
type Tide = { z0M: number; departMs: number; heightAtMs(ms: number): number; reserveM?: number };
const tideAt = (dh: number, reserveM?: number): Tide => ({
  z0M: Z0, departMs: Date.UTC(2026, 10, 5), heightAtMs: () => Z0 + dh, reserveM,
});
const run = (tide?: Tide) =>
  planRoute({
    start: START, dest: DEST, boat: { speedKn: 7, litersPerHour: 20, draftM: 1.8 },
    departHourIdx: 0, field: field(), depth: depth(), bbox: BB, tide,
  });

describe("planRoute — triều tại ETA mở/đóng dải 2–4 m", () => {
  it("không có triều: dải chắn kín, mớn 1,8 m không qua (như cũ)", () => {
    expect(run()).toBeNull();
  });

  it("nước lớn +1,5 m: qua được, có cờ cạn theo mớn", () => {
    const p = run(tideAt(1.5));
    expect(p).not.toBeNull();
    expect(p!.hasDraftShallowLeg).toBe(true);
  });

  it("nước ròng −0,5 m: đóng", () => {
    expect(run(tideAt(-0.5))).toBeNull();
  });

  it("dự trữ trạm mô hình trừ vào: +0,4 m mở, +0,4 m − 0,2 m dự trữ = +0,2 < 0,3 đóng", () => {
    expect(run(tideAt(0.4))).not.toBeNull();
    expect(run(tideAt(0.4, 0.2))).toBeNull();
  });

  it("số triều hỏng (NaN) ⇒ về trần tĩnh, không mở", () => {
    expect(run({ z0M: Z0, departMs: 0, heightAtMs: () => NaN })).toBeNull();
  });
});
