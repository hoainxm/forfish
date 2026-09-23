import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasForbiddenChars,
  coordInVNSea,
  validateIslandFeatures,
  EXPECTED_ADMIN,
  LANE_KINDS,
  LANE_POINT_KINDS,
  LANE_POLYGON_KINDS,
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
    // Ngưỡng hạ 2026-09-03 sau KHỬ TRÙNG với coral-reefs (review A.5): 31 mục
    // đá/bãi NGẦM (Đá Chữ Thập, Bãi Thuỷ Tề…) rời vn-islands sang coral-reefs
    // (nơi có toạ độ TT33 chính thức). Còn lại: ven-bo 42 · hoang-sa 21 (16 đảo
    // + 4 cồn cát nổi + Hòn Tháp) · truong-sa 9 đảo nổi = 72. Xem
    // docs/research/ten-bai-can-2026-09.md §9.
    expect(byGroup["ven-bo"]).toBeGreaterThanOrEqual(30);
    expect(byGroup["hoang-sa"]).toBeGreaterThanOrEqual(18);
    expect(byGroup["truong-sa"]).toBeGreaterThanOrEqual(8);
    expect(fc.features.length).toBeGreaterThanOrEqual(65);
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

  it("chỉ loại hợp lệ; MỌI feature có ten TIẾNG VIỆT, KHÔNG copy tag name gốc", () => {
    // Việt hoá 2026-09-03 (chỉ đạo chủ dự án): trước đây lớp OSM bỏ trắng tên;
    // NAY mọi feature mang `ten` mô tả loại đối tượng bằng tiếng Việt + vùng
    // biển chủ quyền VN. Vẫn KHÔNG copy `name` gốc của OSM (tránh chữ Hán/tên
    // nước ngoài) — cổng CJK ở test kế bên canh giữ điều đó.
    for (const f of fc.features) {
      const kind = f.properties.kind as LaneKind;
      expect(LANE_KINDS).toContain(kind);
      expect(typeof f.properties.ten).toBe("string");
      expect((f.properties.ten as string).trim().length).toBeGreaterThan(0);
      expect(f.properties.name).toBeUndefined();
    }
  });

  it("KHÔNG feature nào chứa ký tự Hán/CJK ở bất kỳ tag chữ nào", () => {
    for (const f of fc.features) {
      for (const v of Object.values(f.properties)) {
        if (typeof v === "string") expect(hasForbiddenChars(v)).toBe(false);
      }
    }
  });

  it("giàn khoan + cập bờ = Point; vùng cấm = Polygon khép kín (hoặc LineString+hoDang); còn lại LineString ≥2 điểm", () => {
    // 2026-09-03: điểm cập bờ cáp (`cap-bo`) là Point THẬT — bỏ mẹo LineString
    // độ-dài-0 (vô hình trên màn, review A.4-3). Cáp/ống vẫn là LineString.
    // R1: vùng cấm là Polygon để icon/nhãn `symbol-placement: point` rơi vào
    // TÂM (trên LineString MapLibre đặt ở đỉnh đầu từng mảnh cắt ô).
    for (const f of fc.features) {
      const kind = f.properties.kind as LaneKind;
      if (LANE_POINT_KINDS.includes(kind)) {
        expect(f.geometry.type).toBe("Point");
        expect(f.geometry.coordinates.length).toBe(2);
      } else if (LANE_POLYGON_KINDS.includes(kind) && f.properties.hoDang !== true) {
        expect(f.geometry.type).toBe("Polygon");
        const ring = (f.geometry.coordinates as unknown as number[][][])[0];
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      } else {
        expect(f.geometry.type).toBe("LineString");
        expect(f.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("có đủ 6 loại chi tiết hải đồ từ OSM (luồng/phân luồng/cáp/ỐNG/vùng cấm/giàn khoan)", () => {
    const kinds = new Set(fc.features.map((f) => f.properties.kind));
    // tuyến lớn vẽ tay luôn có; OSM góp ≥5 trong 6 loại (dữ liệu thật đủ dày)
    expect(kinds.has("tuyen")).toBe(true);
    const osm = ["luong", "phanluong", "cap", "ong", "vungcam", "giankhoan"].filter(
      (k) => kinds.has(k),
    );
    expect(osm.length).toBeGreaterThanOrEqual(5);
    // cáp và ống PHẢI là hai kind riêng — không gộp lại (an toàn: ống khí ≠ cáp quang)
    expect(kinds.has("cap")).toBe(true);
    expect(kinds.has("ong")).toBe(true);
  });
});
