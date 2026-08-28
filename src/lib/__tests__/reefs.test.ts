import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasForbiddenChars } from "../islands";
import {
  validateReefFeatures,
  EXPECTED_REEF_ADMIN,
  type ReefProps,
} from "../reefs";

const DATA = join(process.cwd(), "public", "data");
const readJSON = (f: string) =>
  JSON.parse(readFileSync(join(DATA, f), "utf8")) as {
    features: {
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[] };
    }[];
  };

describe("dataset coral-reefs.v1.json — rạn/đá ngầm ship thật", () => {
  const fc = readJSON("coral-reefs.v1.json");

  it("không MỘT nhãn nào có ký tự Hán/CJK, toạ độ trong khung, admin đúng chủ quyền", () => {
    const problems = validateReefFeatures(fc.features);
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  it("KHÔNG lọt tên nước ngoài quen gặp vào nhãn (Second Thomas, Vanguard, Reef, Bank, Shoal)", () => {
    const FOREIGN = /\b(reef|bank|shoal|cay|island|thomas|vanguard|whitsun)\b/i;
    for (const f of fc.features) {
      const name = String((f.properties as unknown as ReefProps).name);
      expect(hasForbiddenChars(name)).toBe(false);
      expect(name, `nhãn nghi tên nước ngoài: ${name}`).not.toMatch(FOREIGN);
    }
  });

  it("có nhóm Trường Sa + thềm lục địa với số lượng hợp lý (không rơi rớt lúc sinh lại)", () => {
    const byGroup = fc.features.reduce<Record<string, number>>((m, f) => {
      const g = (f.properties as unknown as ReefProps).group;
      m[g] = (m[g] ?? 0) + 1;
      return m;
    }, {});
    expect(byGroup["truong-sa"]).toBeGreaterThanOrEqual(5);
    expect(byGroup["them-luc-dia"]).toBeGreaterThanOrEqual(5);
    expect(fc.features.length).toBeGreaterThanOrEqual(12);
  });

  it("admin gán cứng đúng theo group (chủ quyền VN, đồng loạt)", () => {
    for (const f of fc.features) {
      const p = f.properties as unknown as ReefProps;
      const expected = EXPECTED_REEF_ADMIN[p.group];
      if (expected) expect(p.admin).toBe(expected);
    }
  });

  it("mọi feature là Point, type hợp lệ, rank ∈ {1,2,3}", () => {
    for (const f of fc.features) {
      expect(f.geometry.type).toBe("Point");
      const p = f.properties as unknown as ReefProps;
      expect(["ran", "da", "bai", "con"]).toContain(p.type);
      expect([1, 2, 3]).toContain(p.rank);
    }
  });
});

describe("dataset reef-shapes.v1.json — hình dạng rạn (OSM, bỏ tên)", () => {
  const fc = readJSON("reef-shapes.v1.json");

  it("MỌI feature CHỈ có {kind}, TUYỆT ĐỐI không tag tên (chống lọt tên nước ngoài)", () => {
    for (const f of fc.features) {
      const keys = Object.keys(f.properties);
      expect(keys).toEqual(["kind"]);
      expect(["reef", "shoal"]).toContain(f.properties.kind as string);
      // không thuộc tính chuỗi nào chứa CJK (canh lại nếu ai sửa tay)
      for (const v of Object.values(f.properties)) {
        if (typeof v === "string") expect(hasForbiddenChars(v)).toBe(false);
      }
    }
  });

  it("geometry là Polygon hoặc LineString hợp lệ, đủ nhiều hình", () => {
    for (const f of fc.features) {
      expect(["Polygon", "LineString"]).toContain(f.geometry.type);
    }
    expect(fc.features.length).toBeGreaterThanOrEqual(200);
  });
});
