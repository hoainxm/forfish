// Độ sâu rạn xa bờ vào tính tuyến (2026-10-22): CHỈ THÊM chặn, không mở mặt nạ cũ; dự phòng sai số + ròng.
import { describe, expect, it } from "vitest";
import { planRoute, type BBox, type HourSample, type LatLon, type WeatherField } from "../route-plan";
import { DEPTH_GRID_BYTES, DEPTH_META, type DepthGrid } from "../depth-grid";
import type { ReefDepth } from "../reef-depth";
import { mergeLegPlans } from "../route-multi";

const A: LatLon = { lat: 10.0, lon: 114.0 };
const B: LatLon = { lat: 10.0, lon: 115.2 };
const BB: BBox = { latMin: 9.4, latMax: 10.6, lonMin: 113.6, lonMax: 115.6 };
const calm: HourSample = { waveM: 0.5, waveFromDeg: 90, wavePeriodS: 6, windKmh: 12, windFromDeg: 90, currentKmh: 0, currentToDeg: null };
function field(): WeatherField {
  const n = 8; const cells = [];
  for (let i = 0; i < n * n; i++) cells.push({ onSea: true, hours: Array.from({ length: 72 }, () => calm) });
  return { lat0: BB.latMin, lon0: BB.lonMin, dLat: (BB.latMax - BB.latMin) / (n - 1), dLon: (BB.lonMax - BB.lonMin) / (n - 1), nLat: n, nLon: n, cells };
}
const deep = (): DepthGrid => { const d = new Uint8Array(DEPTH_GRID_BYTES); d.fill(0x55); return { data: d }; };
function setCls(g: DepthGrid, lat: number, lon: number, c: number) {
  const i = Math.round((lat - DEPTH_META.lat0) / DEPTH_META.step), j = Math.round((lon - DEPTH_META.lon0) / DEPTH_META.step);
  const k = i * DEPTH_META.nLon + j; g.data[k >> 1] = k & 1 ? (g.data[k >> 1] & 0x0f) | (c << 4) : (g.data[k >> 1] & 0xf0) | c;
}
/** một "rạn" vệ tinh chắn ngang đường: dải 0,05° × 0,6° quanh lon 114,6, mọi ô sâu `dm` decimet */
function reef(dm: number, extra?: Partial<ReefDepth["features"][number]>): ReefDepth {
  const nLat = 600, nLon = 50; const grid = new Uint8Array(nLat * nLon).fill(dm);
  return { v: 1, sinh: "t", datum: "MSL", credit: [], features: [{ ten: "Đá Thử", nhom: "truong-sa", nguon: "t", lat0: 9.7, lon0: 114.575, dLat: 0.001, dLon: 0.001, nLat, nLon, nongNhatM: dm / 10, trungViM: dm / 10, grid, ...extra }] };
}
/** tuyến có cắt dải rạn (lon 114,575–114,625 · lat 9,7–10,3) không — vĩ độ NỘI SUY tại chỗ cắt kinh tuyến 114,6 */
const crosses = (w: LatLon[]) => w.some((p, i) => {
  if (i === 0) return false;
  const a = w[i - 1];
  if (!(Math.min(p.lon, a.lon) <= 114.6 && Math.max(p.lon, a.lon) >= 114.6) || p.lon === a.lon) return false;
  const lat = a.lat + ((114.6 - a.lon) / (p.lon - a.lon)) * (p.lat - a.lat);
  return lat >= 9.7 && lat <= 10.3;
});
const args = (reefDepth: ReefDepth | null, draftM: number | null = null) =>
  ({ start: A, dest: B, boat: { speedKn: 7, litersPerHour: 20, draftM }, departHourIdx: 6, field: field(), depth: deep(), bbox: BB, reefDepth });

describe("độ sâu rạn vào tính tuyến", () => {
  it("không có file ⇒ như cũ: đi thẳng, reefDepthChecked false", () => {
    const p = planRoute(args(null))!;
    expect(p.reefDepthChecked).toBe(false);
    expect(p.distKm).toBeLessThan(135);
  });
  it("rạn 1,5 m (mặt nạ cũ KHÔNG có) giữa đường ⇒ CHẶN THÊM, tuyến vòng qua đầu dải", () => {
    const p = planRoute(args(reef(15)))!;
    expect(p).not.toBeNull();
    expect(p.reefDepthChecked).toBe(true);
    expect(p.waypoints.some((w) => Math.abs(w.lat - 10.0) > 0.3)).toBe(true);
    expect(p.hasReefShoalLeg).toBe(false);
  });
  it("DỰ PHÒNG: rạn 4,5 m, tàu mớn 1,5 m (cần 2,25 m) — chưa trừ dự phòng thì qua được, có dự phòng 1,8 m ⇒ ngưỡng 4,05 m ⇒ ĐI QUA", () => {
    const p = planRoute(args(reef(45), 1.5))!;
    expect(crosses(p.waypoints)).toBe(true);
  });
  it("DỰ PHÒNG: rạn 3,5 m, tàu mớn 1,5 m ⇒ 3,5 < 4,05 ⇒ CHẶN (không có dự phòng thì đã cho qua)", () => {
    const p = planRoute(args(reef(35), 1.5))!;
    expect(crosses(p.waypoints)).toBe(false);
  });
  it("chưa khai mớn: rạn 5,5 m vẫn chặn (4 + 1,8 = 5,8 m); rạn 6,5 m thì qua", () => {
    expect(crosses(planRoute(args(reef(55)))!.waypoints)).toBe(false);
    expect(crosses(planRoute(args(reef(65)))!.waypoints)).toBe(true);
  });
  it("KHÔNG MỞ mặt nạ cũ: ô lớp 1 (rạn) mà file nói sâu 20 m ⇒ vẫn chặn", () => {
    const g = deep();
    for (let lat = 9.7; lat <= 10.3; lat += DEPTH_META.step) for (let lon = 114.575; lon <= 114.625; lon += DEPTH_META.step) setCls(g, lat, lon, 1);
    const p = planRoute({ ...args(reef(200), 1.5), depth: g })!;
    expect(crosses(p.waypoints)).toBe(false);
  });
  it("cập rạn (điểm đến nằm trên rạn nông) ⇒ vẫn ra tuyến, cắm cờ hasReefShoalLeg", () => {
    const p = planRoute({ ...args(reef(10)), dest: { lat: 10.0, lon: 114.6 } })!;
    expect(p).not.toBeNull();
    expect(p.hasReefShoalLeg).toBe(true);
    expect(p.hasVeryShallowLeg).toBe(true);
  });
  it("ghép chặng: reefDepthChecked AND, hasReefShoalLeg OR", () => {
    const p1 = planRoute(args(reef(10)))!;
    const p2 = planRoute({ ...args(null), start: B, dest: A })!;
    const m = mergeLegPlans([p1, p2])!;
    expect(m.plan.reefDepthChecked).toBe(false);
  });
});
