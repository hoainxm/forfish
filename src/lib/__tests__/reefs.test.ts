import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasForbiddenChars,
  coordInVNSea,
  FORBIDDEN_NAME_RE,
} from "../islands";
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
      expect(["reef", "shoal", "rock", "wreck"]).toContain(
        f.properties.kind as string,
      );
      // không thuộc tính chuỗi nào chứa CJK (canh lại nếu ai sửa tay)
      for (const v of Object.values(f.properties)) {
        if (typeof v === "string") expect(hasForbiddenChars(v)).toBe(false);
      }
    }
  });

  it("rạn/bãi = Polygon/LineString; đá ngầm/xác tàu (rock/wreck) = Point", () => {
    for (const f of fc.features) {
      const k = f.properties.kind as string;
      if (k === "rock" || k === "wreck") {
        expect(f.geometry.type).toBe("Point");
      } else {
        expect(["Polygon", "LineString"]).toContain(f.geometry.type);
      }
    }
    expect(fc.features.length).toBeGreaterThanOrEqual(200);
  });

  it("có điểm hiểm hoạ gần bờ (rock/wreck) — lấp lỗ hổng natural=reef thưa ven bờ", () => {
    const hazards = fc.features.filter((f) =>
      ["rock", "wreck"].includes(f.properties.kind as string),
    );
    // 87 = 71 node + 16 way seamark (truy vấn cũ bỏ sót way, vá 2026-08-29)
    expect(hazards.length).toBeGreaterThanOrEqual(80);
  });

  // ── BẤT BIẾN CHỦ QUYỀN + NGÂN SÁCH OFFLINE (đọc file THẬT đang ship) ──────
  // File này sinh từ OSM — vùng tranh chấp gắn tên nước ngoài/chữ Hán (đo
  // 2026-08-29: 160 tên chứa ký tự Hán trong khung). Bốn ca dưới canh cả file
  // thô, không chỉ những field mình nhớ tới.
  const rawText = readFileSync(join(DATA, "reef-shapes.v1.json"), "utf8");

  it("KHÔNG một ký tự Hán/CJK nào trong TOÀN BỘ file (quét chuỗi thô)", () => {
    const hit = rawText.match(FORBIDDEN_NAME_RE);
    expect(
      hasForbiddenChars(rawText),
      hit ? `ký tự "${hit[0]}" ở vị trí ${hit.index}` : "",
    ).toBe(false);
  });

  it("KHÔNG feature nào còn thuộc tính `name` (tag OSM phải bị bỏ lúc sinh)", () => {
    expect(rawText).not.toContain('"name"');
    for (const f of fc.features) {
      expect(f.properties).not.toHaveProperty("name");
    }
  });

  it("MỌI toạ độ nằm trong khung biển VN (relation OSM trả cả phần tràn bbox)", () => {
    for (const f of fc.features) {
      const flat = (f.geometry.coordinates as unknown as number[]).flat(
        Infinity,
      ) as number[];
      for (let i = 0; i < flat.length; i += 2) {
        expect(
          coordInVNSea(flat[i], flat[i + 1]),
          `toạ độ ngoài khung VN [${flat[i]},${flat[i + 1]}]`,
        ).toBe(true);
      }
    }
  });

  it("cỡ file trong ngân sách offline 1,2 MB (SHELL service worker, tier best-effort)", () => {
    const bytes = Buffer.byteLength(rawText);
    expect(
      bytes,
      `${Math.round(bytes / 1024)} KB — vượt trần thì HỎI LEAD, đừng tự nâng`,
    ).toBeLessThanOrEqual(1.2 * 1024 * 1024);
  });

  it("số hình KHÔNG giảm so với bản trước (1.274) — sinh lại không được làm rơi rạn", () => {
    expect(fc.features.length).toBeGreaterThanOrEqual(1274);
  });
});
