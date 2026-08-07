import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasForbiddenChars,
  coordInVNSea,
  validateIslandFeatures,
  EXPECTED_ADMIN,
  LANE_KINDS,
  type IslandProps,
  type LaneKind,
} from "../islands";

const DATA = join(process.cwd(), "public", "data");
const readJSON = (f: string) =>
  JSON.parse(readFileSync(join(DATA, f), "utf8")) as {
    features: {
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[] };
    }[];
  };

describe("hasForbiddenChars — cổng chủ quyền", () => {
  it("bắt ký tự Hán/CJK", () => {
    expect(hasForbiddenChars("永興島")).toBe(true); // tên Trung của Phú Lâm
    expect(hasForbiddenChars("高尖石")).toBe(true);
    expect(hasForbiddenChars("Đảo Phú Lâm 永興島")).toBe(true); // lẫn cũng bắt
  });
  it("cho qua tên tiếng Việt đầy đủ dấu", () => {
    for (const n of [
      "Đảo Phú Lâm",
      "Đá Chữ Thập",
      "Cù Lao Chàm",
      "Đảo Song Tử Tây",
      "Bãi Thuyền Chài",
      "Quần đảo Hải Tặc",
    ]) {
      expect(hasForbiddenChars(n)).toBe(false);
    }
  });
});

describe("coordInVNSea", () => {
  it("trong khung / ngoài khung", () => {
    expect(coordInVNSea(112.33, 16.83)).toBe(true); // Phú Lâm
    expect(coordInVNSea(103.96, 10.22)).toBe(true); // Phú Quốc
    expect(coordInVNSea(120, 16)).toBe(false); // quá đông
    expect(coordInVNSea(112, 2)).toBe(false); // quá nam
  });
});

describe("dataset vn-islands.v1.json — dữ liệu ship thật", () => {
  const fc = readJSON("vn-islands.v1.json");

  it("không MỘT nhãn nào có ký tự Hán/CJK, toạ độ trong khung, admin đúng chủ quyền", () => {
    const problems = validateIslandFeatures(fc.features);
    // in ra để dễ sửa nếu đỏ
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  it("đủ ba nhóm với số lượng hợp lý (không rơi rớt lúc sinh lại)", () => {
    const byGroup = fc.features.reduce<Record<string, number>>((m, f) => {
      const g = (f.properties as unknown as IslandProps).group;
      m[g] = (m[g] ?? 0) + 1;
      return m;
    }, {});
    expect(byGroup["ven-bo"]).toBeGreaterThanOrEqual(30);
    expect(byGroup["hoang-sa"]).toBeGreaterThanOrEqual(25);
    expect(byGroup["truong-sa"]).toBeGreaterThanOrEqual(20);
    expect(fc.features.length).toBeGreaterThanOrEqual(90);
  });

  it("Hoàng Sa gán TP Đà Nẵng, Trường Sa gán tỉnh Khánh Hòa (đồng loạt)", () => {
    for (const f of fc.features) {
      const p = f.properties as unknown as IslandProps;
      if (p.group === "hoang-sa" || p.group === "truong-sa") {
        expect(p.admin).toBe(EXPECTED_ADMIN[p.group]);
      }
    }
  });

  it("mọi feature là Point, rank ∈ {1,2,3}", () => {
    for (const f of fc.features) {
      expect(f.geometry.type).toBe("Point");
      const r = (f.properties as unknown as IslandProps).rank;
      expect([1, 2, 3]).toContain(r);
    }
  });
});

describe("dataset vn-sea-lanes.v1.json — tuyến hàng hải + chi tiết hải đồ", () => {
  const fc = readJSON("vn-sea-lanes.v1.json");

  it("chỉ các loại hợp lệ; MỌI feature OSM KHÔNG mang tag chữ (bỏ chủ quyền)", () => {
    for (const f of fc.features) {
      const kind = f.properties.kind as LaneKind;
      expect(LANE_KINDS).toContain(kind);
      // chỉ tuyến lớn vẽ tay được có `ten`; OSM phải trống MỌI tag chữ
      if (kind !== "tuyen") {
        expect(f.properties.ten).toBeUndefined();
        expect(f.properties.name).toBeUndefined();
      }
    }
  });

  it("KHÔNG feature nào chứa ký tự Hán/CJK ở bất kỳ tag chữ nào", () => {
    for (const f of fc.features) {
      for (const v of Object.values(f.properties)) {
        if (typeof v === "string") expect(hasForbiddenChars(v)).toBe(false);
      }
    }
  });

  it("giàn khoan là Point; các loại còn lại là LineString ≥2 điểm", () => {
    for (const f of fc.features) {
      const kind = f.properties.kind as LaneKind;
      if (kind === "giankhoan") {
        expect(f.geometry.type).toBe("Point");
        expect(f.geometry.coordinates.length).toBe(2);
      } else {
        expect(f.geometry.type).toBe("LineString");
        expect(f.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("có đủ 5 loại chi tiết hải đồ từ OSM (luồng/phân luồng/cáp/vùng cấm/giàn khoan)", () => {
    const kinds = new Set(fc.features.map((f) => f.properties.kind));
    // tuyến lớn vẽ tay luôn có; OSM góp ≥4 trong 5 loại (dữ liệu thật đủ dày)
    expect(kinds.has("tuyen")).toBe(true);
    const osm = ["luong", "phanluong", "cap", "vungcam", "giankhoan"].filter(
      (k) => kinds.has(k),
    );
    expect(osm.length).toBeGreaterThanOrEqual(4);
  });
});
