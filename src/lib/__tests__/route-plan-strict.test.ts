import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOAT,
  bboxFor,
  haversineKm,
  planRoute,
  type BBox,
  type HourSample,
  type LatLon,
  type WeatherField,
} from "../route-plan";
import { DEPTH_META, decodeDepthGrid, depthClassAt } from "../depth-grid";

/*  CỔNG CHẶN KHUÔN — MỌI CẠNH TRẢ VỀ PHẢI ĐI ĐƯỢC THẬT (2026-08-16, thẩm định P0)
 *
 *  Lỗi gốc: Dijkstra chứng minh đi được giữa các NÚT LƯỚI, rồi hai đầu bị thay
 *  bằng toạ độ thật của bà con; vòng kéo dây giữ nguyên cạnh khi cạnh gốc
 *  không đi được; và bước tính số liệu cuối chạy `relaxed` (không chặn gì) mà
 *  cờ `ok` của nó KHÔNG AI ĐỌC. Kết quả: tuyến cắt đảo/bãi cạn vẫn được trả về
 *  kèm số liệu đẹp.
 *
 *  Bất biến khoá ở đây phát biểu bằng thứ đo được từ NGOÀI: đi dọc từng cạnh
 *  của tuyến trả về, không điểm nào rơi vào ô ĐẤT (class 0) trừ phần nằm trong
 *  bán kính nới quanh nơi xuất phát/điểm đến — và khi có phần nới đó thì
 *  `hasNearLandLeg` phải bật, không được im.
 */

const HOURS = 72;
const START: LatLon = { lat: 12.0, lon: 110.0 };
const DEST: LatLon = { lat: 12.0, lon: 112.0 };
const BB = bboxFor(START, DEST, 120);
/** khớp VICINITY_LAND_KM trong route-plan.ts (bán kính nới quanh hai đầu) */
const VICINITY_LAND_KM = 5;

function makeField(bbox: BBox, n: number): WeatherField {
  const lats = Array.from(
    { length: n },
    (_, i) => bbox.latMin + ((bbox.latMax - bbox.latMin) * i) / (n - 1),
  );
  const lons = Array.from(
    { length: n },
    (_, j) => bbox.lonMin + ((bbox.lonMax - bbox.lonMin) * j) / (n - 1),
  );
  const hour = (): HourSample => ({
    waveM: 0.3,
    waveFromDeg: null,
    wavePeriodS: null,
    windKmh: 10,
    windFromDeg: 0,
    currentKmh: 0,
    currentToDeg: null,
  });
  const cells = Array.from({ length: lats.length * lons.length }, () => ({
    onSea: true,
    hours: Array.from({ length: HOURS }, hour),
  }));
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

function makeDepth(at: (lat: number, lon: number) => 0 | 1 | 2 | 3) {
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const packed = new Uint8Array(Math.ceil((nLat * nLon) / 4));
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      packed[k >> 2] |= at(lat0 + i * step, lon0 + j * step) << ((k & 3) * 2);
    }
  }
  return decodeDepthGrid(packed.buffer);
}

/** Điểm ĐẤT nằm trên tuyến mà KHÔNG ở gần hai đầu — tức thứ không được phép có */
function landHitsFarFromEnds(
  waypoints: LatLon[],
  depth: ReturnType<typeof makeDepth>,
): LatLon[] {
  const out: LatLon[] = [];
  for (let k = 1; k < waypoints.length; k++) {
    const a = waypoints[k - 1];
    const b = waypoints[k];
    // mẫu dày hơn hẳn bước lấy mẫu 5 km của legCost để không tự lọt khe
    const n = Math.max(4, Math.ceil(haversineKm(a, b) / 1));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const p = {
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
      };
      if (depthClassAt(depth, p.lat, p.lon) !== 0) continue;
      const nearEnd =
        haversineKm(p, START) <= VICINITY_LAND_KM + 1 ||
        haversineKm(p, DEST) <= VICINITY_LAND_KM + 1;
      if (!nearEnd) out.push(p);
    }
  }
  return out;
}

const plan = (depth: ReturnType<typeof makeDepth>) =>
  planRoute({
    start: START,
    dest: DEST,
    boat: DEFAULT_BOAT,
    departHourIdx: 6,
    field: makeField(BB, 9),
    depth,
    bbox: BB,
  });

describe("tuyến trả về đã qua kiểm nghiêm", () => {
  it("đảo giữa đường → tuyến vẽ ra không có điểm nào rơi vào đất", () => {
    const g = makeDepth((la, lo) =>
      Math.abs(la - 12.0) < 0.12 && Math.abs(lo - 111.0) < 0.12 ? 0 : 3,
    );
    const p = plan(g);
    expect(p).not.toBeNull();
    expect(landHitsFarFromEnds(p!.waypoints, g)).toEqual([]);
  });

  it("doi đất chắn kín ngang bbox → NULL, không trả tuyến 'đẹp' cắt qua", () => {
    // dải đất chạy suốt chiều ngang bbox: không có đường nào đi được thật
    const g = makeDepth((la) => (Math.abs(la - 12.0) < 0.25 ? 0 : 3));
    expect(plan(g)).toBeNull();
  });

  it("bờ ôm sát nơi xuất phát → vẫn nối được NHƯNG phải cắm cờ hasNearLandLeg", () => {
    const g = makeDepth((la, lo) =>
      haversineKm({ lat: la, lon: lo }, START) < 3 ? 0 : 3,
    );
    const p = plan(g);
    expect(p).not.toBeNull();
    // trước bản vá: đoạn này đi qua HOÀN TOÀN im lặng — không cờ, không câu chữ
    expect(p!.hasNearLandLeg).toBe(true);
    expect(landHitsFarFromEnds(p!.waypoints, g)).toEqual([]);
  });

  it("biển trống thì không bịa cảnh báo bờ", () => {
    const p = plan(makeDepth(() => 3));
    expect(p).not.toBeNull();
    expect(p!.hasNearLandLeg).toBe(false);
  });
});
