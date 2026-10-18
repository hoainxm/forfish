import { describe, expect, it } from "vitest";
import {
  encodeRouteTile,
  isRouteTile,
  parseRouteTileId,
  ROUTE_FIELD_MAX_AXIS,
  ROUTE_GRID_FRESH_MS,
  ROUTE_TILE_N,
  routeTileId,
  routeTileIdsForBBox,
  routeTileIsFresh,
  routeTilePoints,
  stitchRouteField,
  vnDate,
  type RouteTile,
} from "../route-grid";
import { parseWeatherField } from "../route-weather";
import { isValidSnapshotId, snapshotNeedsPremium } from "../weather-snapshot-id";
import { sampleField } from "../route-plan";

// 10h sáng 16/10/2026 giờ VN
const NOW = new Date("2026-10-16T10:00:00+07:00");

/** Ô giả: mọi mắt biển, gió = 10 + giờ (để soi dịch trục giờ), trừ mắt [0] là đất */
function fakeTile(r: number, c: number, start: string, hours = 96): RouteTile {
  const { lats, lons } = routeTilePoints(r, c);
  const n = lats.length * lons.length;
  const loc = (k: number, sea: boolean) => ({
    wind: {
      hourly: {
        wind_speed_10m: Array.from({ length: hours }, (_, t) => 10 + t),
        wind_direction_10m: Array.from({ length: hours }, () => 45),
      },
    },
    wave: {
      hourly: {
        wave_height: Array.from({ length: hours }, () => (sea ? 1.25 : null)),
        wave_direction: Array.from({ length: hours }, () => 90),
        wave_period: Array.from({ length: hours }, () => 6.4),
        ocean_current_velocity: Array.from({ length: hours }, () => 0.8),
        ocean_current_direction: Array.from({ length: hours }, () => 200),
      },
    },
    k,
  });
  const locs = Array.from({ length: n }, (_, k) => loc(k, k !== 0));
  const field = parseWeatherField(
    locs.map((l) => l.wind),
    locs.map((l) => l.wave),
    lats,
    lons,
  );
  return encodeRouteTile(r, c, field, start, NOW.toISOString());
}

describe("id ô lưới dẫn đường", () => {
  it("id hợp lệ đi qua whitelist snapshot và là hàng MIỄN PHÍ", () => {
    const id = routeTileId(2, 3);
    expect(id).toBe("routegrid:2:3");
    expect(parseRouteTileId(id)).toEqual({ r: 2, c: 3 });
    expect(isValidSnapshotId(id)).toBe(true);
    expect(snapshotNeedsPremium(id)).toBe(false);
  });
  it("id lạ / ngoài lưới bị chặn", () => {
    for (const bad of ["routegrid:6:0", "routegrid:1", "routegrid:a:b", "routegrid:1:2:3"]) {
      expect(parseRouteTileId(bad)).toBeNull();
      expect(isValidSnapshotId(bad)).toBe(false);
    }
  });
});

describe("routeTileIdsForBBox", () => {
  it("khung nhỏ trong một ô → đúng 1 ô", () => {
    expect(routeTileIdsForBBox({ latMin: 10.2, latMax: 10.8, lonMin: 105.5, lonMax: 106.9 })).toEqual([
      "routegrid:1:1",
    ]);
  });
  it("khung vắt qua ranh ô → đủ các ô", () => {
    const ids = routeTileIdsForBBox({ latMin: 8.5, latMax: 9.2, lonMin: 104.5, lonMax: 105.2 });
    expect(ids.sort()).toEqual(["routegrid:0:0", "routegrid:0:1", "routegrid:1:0", "routegrid:1:1"]);
  });
  it("khung nằm ngoài vùng lưới → rỗng", () => {
    expect(routeTileIdsForBBox({ latMin: 1, latMax: 3, lonMin: 100, lonMax: 101 })).toEqual([]);
  });
});

describe("mã hoá / kiểm ô", () => {
  it("ô mã hoá qua được bộ kiểm, mắt đất lưu null", () => {
    const t = fakeTile(1, 1, "2026-10-16");
    expect(isRouteTile(t)).toBe(true);
    expect(t.cells[0]).toBeNull();
    expect(t.cells).toHaveLength(ROUTE_TILE_N * ROUTE_TILE_N);
    // qua JSON (như đi DB/mạng) vẫn hợp lệ
    expect(isRouteTile(JSON.parse(JSON.stringify(t)))).toBe(true);
  });
  it("rác bị loại", () => {
    const t = fakeTile(1, 1, "2026-10-16");
    expect(isRouteTile(null)).toBe(false);
    expect(isRouteTile({ ...t, v: 2 })).toBe(false);
    expect(isRouteTile({ ...t, start: "16/10/2026" })).toBe(false);
    expect(isRouteTile({ ...t, cells: t.cells.slice(1) })).toBe(false);
    const hong = JSON.parse(JSON.stringify(t));
    hong.cells[1].h[3] = "1.2";
    expect(isRouteTile(hong)).toBe(false);
  });
  it("độ tươi: cũ hơn ngưỡng hoặc sang ngày mới là phải lấy lại", () => {
    const t = fakeTile(1, 1, "2026-10-16");
    expect(routeTileIsFresh(t, NOW)).toBe(true);
    expect(routeTileIsFresh(t, new Date(NOW.getTime() + ROUTE_GRID_FRESH_MS + 1))).toBe(false);
    expect(routeTileIsFresh({ ...t, start: "2026-10-15" }, NOW)).toBe(false);
  });
});

describe("stitchRouteField — ghép ô thành lưới tuyến", () => {
  const bbox = { latMin: 9.0, latMax: 10.5, lonMin: 105.0, lonMax: 106.5 };
  const tilesFor = (start: string) =>
    new Map(routeTileIdsForBBox(bbox).map((id) => {
      const rc = parseRouteTileId(id)!;
      return [id, fakeTile(rc.r, rc.c, start)] as const;
    }));

  it("giải mã đúng số: sóng, chu kỳ, dòng chảy, gió giờ 0 = hôm nay 0h", () => {
    const f = stitchRouteField(bbox, tilesFor(vnDate(NOW)), NOW)!;
    expect(f).not.toBeNull();
    expect(f.lat0).toBeLessThanOrEqual(bbox.latMin);
    expect(f.lon0).toBeLessThanOrEqual(bbox.lonMin);
    expect(f.lat0 + (f.nLat - 1) * f.dLat).toBeGreaterThanOrEqual(bbox.latMax - 1e-9);
    const sea = f.cells.find((c) => c.onSea)!;
    expect(sea.hours).toHaveLength(72);
    expect(sea.hours[0]).toEqual({
      waveM: 1.25,
      waveFromDeg: 90,
      wavePeriodS: 6.4,
      windKmh: 10,
      windFromDeg: 45,
      currentKmh: 0.8,
      currentToDeg: 200,
    });
    // bộ tìm đường lấy mẫu được giữa khung
    expect(sampleField(f, 9.7, 105.7, 0)?.waveM).toBeCloseTo(1.25);
  });

  it("ô lấy HÔM QUA tự dịch 24 giờ: giờ 0 hôm nay = giờ 24 của ô", () => {
    const f = stitchRouteField(bbox, tilesFor("2026-10-15"), NOW)!;
    const sea = f.cells.find((c) => c.onSea)!;
    expect(sea.hours[0].windKmh).toBe(34);
    expect(sea.hours).toHaveLength(72);
  });

  it("ô quá cũ (còn < 24 giờ dùng được) → coi như không có số", () => {
    // lấy 12/10, 4 ngày: tới 16/10 chỉ còn 0 giờ dùng được
    expect(stitchRouteField(bbox, tilesFor("2026-10-12"), NOW)).toBeNull();
  });

  it("thiếu ô → mắt onSea=false, không bịa biển lặng; thiếu hết → null", () => {
    // khung vắt qua 4 ô, bỏ một ô
    const cross = { latMin: 8.5, latMax: 9.5, lonMin: 104.5, lonMax: 105.5 };
    const all = new Map(routeTileIdsForBBox(cross).map((id) => {
      const rc = parseRouteTileId(id)!;
      return [id, fakeTile(rc.r, rc.c, vnDate(NOW))] as const;
    }));
    expect(all.size).toBe(4);
    const thieu = new Map(all);
    thieu.delete("routegrid:0:0");
    const f = stitchRouteField(cross, thieu, NOW)!;
    expect(f.cells.some((c) => !c.onSea)).toBe(true);
    expect(f.cells.some((c) => c.onSea)).toBe(true);
    expect(stitchRouteField(bbox, new Map(), NOW)).toBeNull();
  });

  it("khung cả vùng biển vẫn ≤ 24×24 mắt (giữ RAM điện thoại)", () => {
    const big = { latMin: 6, latMax: 22.4, lonMin: 102, lonMax: 118.4 };
    const tiles = new Map(routeTileIdsForBBox(big).map((id) => {
      const rc = parseRouteTileId(id)!;
      return [id, fakeTile(rc.r, rc.c, vnDate(NOW))] as const;
    }));
    expect(tiles.size).toBe(36);
    const f = stitchRouteField(big, tiles, NOW)!;
    expect(f.nLat).toBeLessThanOrEqual(ROUTE_FIELD_MAX_AXIS);
    expect(f.nLon).toBeLessThanOrEqual(ROUTE_FIELD_MAX_AXIS);
    expect(f.cells).toHaveLength(f.nLat * f.nLon);
  });
});
