import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOAT,
  bboxFor,
  planRoute,
  type BBox,
  type HourSample,
  type LatLon,
  type WeatherField,
} from "../route-plan";
import {
  DEPTH_GRID_BYTES,
  DEPTH_META,
  decodeDepthGrid,
  type DepthClass,
} from "../depth-grid";

/*  BEST-EFFORT KHI BIỂN QUÁ ĐỘNG (2026-09-09).
 *
 *  Trước đây sóng ≥4 m / gió ≥ cấp 8 là CHẶN CỨNG: mọi đường đều dính thì
 *  `planRoute` trả null và màn nói "chưa tìm được đường an toàn" — bí, không cho
 *  bà con thấy "nếu buộc phải đi thì đường nào ít dữ nhất". Nay lượt nghiêm bí
 *  thì planRoute tự gọi lại với `seaAsPenalty`: hạ chặn-cứng-sóng thành phạt cực
 *  nặng để VẪN ra tuyến, cắm `bestEffortSeas` + tô đỏ khúc ≥4 m trong `segRisks`.
 *  Đất/cạn vẫn chặn cứng ⇒ đất chắn kín thì null như cũ.
 */

const START: LatLon = { lat: 12.0, lon: 110.0 };
const DEST: LatLon = { lat: 12.0, lon: 112.0 };
const BB = bboxFor(START, DEST, 120);

function makeField(
  bbox: BBox,
  n: number,
  at: (lat: number, lon: number) => { waveM: number; windKmh: number },
): WeatherField {
  const lats = Array.from(
    { length: n },
    (_, i) => bbox.latMin + ((bbox.latMax - bbox.latMin) * i) / (n - 1),
  );
  const lons = Array.from(
    { length: n },
    (_, j) => bbox.lonMin + ((bbox.lonMax - bbox.lonMin) * j) / (n - 1),
  );
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const { waveM, windKmh } = at(lats[i], lons[j]);
      const hour = (): HourSample => ({
        waveM,
        waveFromDeg: null,
        wavePeriodS: null,
        windKmh,
        windFromDeg: 0,
        currentKmh: 0,
        currentToDeg: null,
      });
      cells.push({ onSea: true, hours: Array.from({ length: 72 }, hour) });
    }
  }
  return {
    lat0: lats[0],
    lon0: lons[0],
    dLat: lats[1] - lats[0],
    dLon: lons[1] - lons[0],
    nLat: n,
    nLon: n,
    cells,
  };
}

function makeDepth(at: (lat: number, lon: number) => DepthClass) {
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const packed = new Uint8Array(DEPTH_GRID_BYTES);
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      packed[k >> 1] |= at(lat0 + i * step, lon0 + j * step) << ((k & 1) * 4);
    }
  }
  return decodeDepthGrid(packed.buffer);
}

const ALL_DEEP = makeDepth(() => 5);
const CALM = { waveM: 0.4, windKmh: 12 };
const ROUGH = { waveM: 5, windKmh: 20 }; // ≥ HARD_WAVE_M = 4

const plan = (
  field: WeatherField,
  depth = ALL_DEEP,
): ReturnType<typeof planRoute> =>
  planRoute({
    start: START,
    dest: DEST,
    boat: DEFAULT_BOAT,
    departHourIdx: 0,
    field,
    depth,
    bbox: BB,
  });

describe("planRoute — best-effort khi biển động", () => {
  it("biển lặng: tuyến bình thường, bestEffortSeas=false, không khúc đỏ vì sóng", () => {
    const p = plan(makeField(BB, 9, () => CALM));
    expect(p).not.toBeNull();
    expect(p!.bestEffortSeas).toBe(false);
    // segRisks khớp một-một với các cặp waypoint
    expect(p!.segRisks.length).toBe(p!.waypoints.length - 1);
    expect(p!.segRisks.some((r) => r === "red")).toBe(false);
  });

  it("sóng ≥4 m phủ NỬA vùng, không tránh được → VẪN ra tuyến, bestEffortSeas=true", () => {
    // cả nửa phía đông (lon ≥ 110,8, gồm cả đích) sóng 5 m: mọi đường tới đích
    // đều phải dẫm sóng dữ → lượt nghiêm null → best-effort cứu
    const field = makeField(BB, 11, (_, lon) => (lon >= 110.8 ? ROUGH : CALM));
    const p = plan(field);
    expect(p).not.toBeNull();
    expect(p!.bestEffortSeas).toBe(true);
    expect(p!.segRisks.length).toBe(p!.waypoints.length - 1);
    // có ít nhất một khúc ĐỎ (khúc dẫm sóng ≥4 m)
    expect(p!.segRisks.some((r) => r === "red")).toBe(true);
    // maxWave phản ánh sóng dữ thật, không bị giấu
    expect(p!.maxWaveM).toBeGreaterThanOrEqual(4);
  });

  it("ĐẤT chắn kín ngang bbox → NULL kể cả best-effort (đất không phải chuyện liều)", () => {
    // biển lặng nhưng doi đất (class 0) chạy suốt chiều ngang giữa hai đầu
    const field = makeField(BB, 9, () => CALM);
    const wall = makeDepth((la) => (Math.abs(la - 12.0) < 0.25 ? 0 : 5));
    expect(plan(field, wall)).toBeNull();
  });
});
