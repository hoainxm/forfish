// Gác dữ liệu vms-zones.json (bản giản lược từ 3 file GeoJSON VMS 2026-07-28,
// scripts/convert-vms-zones.py): chạy lại script mà ra ring hở / toạ độ ngoài
// Biển Đông / rỗng lớp thì test đỏ ngay, không đợi bản đồ trắng mới biết.
import { describe, expect, it } from "vitest";
import {
  VMS_ZONES_UPDATED,
  vmsAllowedGeoJSON,
  vmsBottomOnlyGeoJSON,
  vmsCautionGeoJSON,
} from "@/data/vms-fishing-zones";

const ZONES = [
  ["allowed", vmsAllowedGeoJSON()],
  ["caution", vmsCautionGeoJSON()],
  ["bottomOnly", vmsBottomOnlyGeoJSON()],
] as const;

function rings(fc: GeoJSON.FeatureCollection): number[][][] {
  return fc.features.flatMap((ft) => {
    expect(ft.geometry.type).toBe("MultiPolygon");
    return (ft.geometry as GeoJSON.MultiPolygon).coordinates.flat();
  });
}

describe("vms-zones.json", () => {
  it("ngày cập nhật dạng ISO", () => {
    expect(VMS_ZONES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(ZONES)("lớp %s có dữ liệu, ring khép, toạ độ trong Biển Đông", (_id, fc) => {
    expect(fc.features.length).toBeGreaterThan(0);
    const rs = rings(fc);
    expect(rs.length).toBeGreaterThan(0);
    for (const ring of rs) {
      // ring GeoJSON hợp lệ: ≥4 điểm và điểm cuối lặp lại điểm đầu
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      for (const [lng, lat] of ring) {
        expect(lng).toBeGreaterThan(100);
        expect(lng).toBeLessThan(120);
        expect(lat).toBeGreaterThan(4);
        expect(lat).toBeLessThan(24);
      }
    }
  });

  it("vùng cần chú ý nằm quanh Hoàng Sa/Trường Sa (không lệch sang bờ)", () => {
    for (const ring of rings(vmsCautionGeoJSON())) {
      for (const [lng] of ring) expect(lng).toBeGreaterThan(110);
    }
  });
});
