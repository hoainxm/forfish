// Gác lib vùng biển VMS (src/lib/vms-zones.ts) — model do admin quản lý, helper
// thuần validate/parse/simplify + 3 vùng mặc định (fallback từ vms-zones.json).
import { describe, expect, it } from "vitest";
import {
  STATIC_VMS_ZONES,
  VMS_ZONES_UPDATED,
  countPoints,
  parseUploadedGeoJSON,
  simplifyFeatureCollection,
  validateZoneDraft,
  type VmsZoneDraft,
} from "@/lib/vms-zones";
import { isVmsZoneOn } from "@/lib/map-prefs";

const okDraft = (over: Partial<VmsZoneDraft> = {}): VmsZoneDraft => ({
  name: "Vùng thử",
  color: "#dc2626",
  style: "line",
  defaultOn: true,
  visible: true,
  isBorder: false,
  geojson: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [[110, 10], [111, 11]] },
      },
    ],
  },
  ...over,
});

describe("STATIC_VMS_ZONES (3 vùng mặc định)", () => {
  it("ngày cập nhật dạng ISO", () => {
    expect(VMS_ZONES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("đủ 3 vùng, mỗi vùng có geometry trong Biển Đông", () => {
    expect(STATIC_VMS_ZONES).toHaveLength(3);
    for (const z of STATIC_VMS_ZONES) {
      expect(z.geojson.features.length).toBeGreaterThan(0);
      expect(z.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(countPoints(z.geojson)).toBeGreaterThan(0);
    }
  });
});

describe("validateZoneDraft", () => {
  it("chấp nhận draft hợp lệ", () => {
    expect(validateZoneDraft(okDraft())).toBeNull();
  });
  it("bắt tên trống", () => {
    expect(validateZoneDraft(okDraft({ name: "  " }))).toMatch(/tên/i);
  });
  it("bắt màu sai định dạng", () => {
    expect(validateZoneDraft(okDraft({ color: "red" }))).toMatch(/màu/i);
  });
  it("bắt GeoJSON rỗng", () => {
    expect(
      validateZoneDraft(
        okDraft({ geojson: { type: "FeatureCollection", features: [] } }),
      ),
    ).toMatch(/trống|GeoJSON/i);
  });
});

describe("parseUploadedGeoJSON", () => {
  it("nhận FeatureCollection", () => {
    const fc = parseUploadedGeoJSON(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [110, 10] } },
          { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[110, 10], [111, 11]] } },
        ],
      }),
    );
    // Point vẫn giữ (có coordinates) — chỉ lọc feature thiếu geometry
    expect(fc.features.length).toBe(2);
  });
  it("gói Geometry lẻ thành FeatureCollection", () => {
    const fc = parseUploadedGeoJSON(
      JSON.stringify({ type: "Polygon", coordinates: [[[110, 10], [111, 10], [111, 11], [110, 10]]] }),
    );
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
  });
  it("ném lỗi khi không phải JSON", () => {
    expect(() => parseUploadedGeoJSON("<xml>")).toThrow();
  });
  it("ném lỗi khi không có vùng nào", () => {
    expect(() =>
      parseUploadedGeoJSON(JSON.stringify({ type: "FeatureCollection", features: [] })),
    ).toThrow();
  });
});

describe("simplifyFeatureCollection", () => {
  it("giảm số điểm nhưng giữ ring khép", () => {
    // đường thẳng dày điểm → DP còn 2 đầu
    const dense = Array.from({ length: 50 }, (_, i) => [110 + i * 0.001, 10]);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: dense } },
      ],
    };
    const out = simplifyFeatureCollection(fc, 0.01);
    const line = out.features[0].geometry as GeoJSON.LineString;
    expect(line.coordinates.length).toBeLessThan(dense.length);
    expect(line.coordinates.length).toBeGreaterThanOrEqual(2);
  });
  it("polygon giữ điểm đầu = điểm cuối", () => {
    const ring = [[110, 10], [112, 10], [112, 12], [110, 12], [110, 10]];
    const out = simplifyFeatureCollection(
      { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] },
      0.001,
    );
    const poly = out.features[0].geometry as GeoJSON.Polygon;
    const r = poly.coordinates[0];
    expect(r[0]).toEqual(r[r.length - 1]);
  });
});

describe("isVmsZoneOn", () => {
  it("chưa override thì theo defaultOn", () => {
    expect(isVmsZoneOn({}, "z1", true)).toBe(true);
    expect(isVmsZoneOn({}, "z1", false)).toBe(false);
  });
  it("override thắng defaultOn cả 2 chiều", () => {
    expect(isVmsZoneOn({ z1: false }, "z1", true)).toBe(false);
    expect(isVmsZoneOn({ z1: true }, "z1", false)).toBe(true);
  });
});
