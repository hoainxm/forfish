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

  it("đủ bốn nhóm với số lượng hợp lý (khai TT33 2026-09-03 không rơi rớt lúc sinh lại)", () => {
    const byGroup = fc.features.reduce<Record<string, number>>((m, f) => {
      const g = (f.properties as unknown as ReefProps).group;
      m[g] = (m[g] ?? 0) + 1;
      return m;
    }, {});
    // Sau đợt khai Thông tư 33/2024 (A.I ven bờ + B Hoàng Sa + C Trường Sa):
    // tổng nhảy từ 13 lên ~1.374. Trần dưới đặt CÓ BIÊN để chống rơi rớt nhưng
    // không giòn — nếu tụt dưới các mốc này là dấu hiệu pipeline sinh sai/thiếu.
    expect(byGroup["truong-sa"]).toBeGreaterThanOrEqual(90);
    expect(byGroup["hoang-sa"]).toBeGreaterThanOrEqual(20);
    expect(byGroup["them-luc-dia"]).toBeGreaterThanOrEqual(10);
    expect(byGroup["ven-bo"]).toBeGreaterThanOrEqual(1000);
    expect(fc.features.length).toBeGreaterThanOrEqual(1300);
  });

  it("mọi mục ven-bờ có admin = tên tỉnh (không rỗng) — chạm nhãn còn biết vùng", () => {
    for (const f of fc.features) {
      const p = f.properties as unknown as ReefProps;
      if (p.group === "ven-bo") {
        expect(p.admin, `ven-bờ thiếu admin: ${p.name}`).toBeTruthy();
        // ven-bờ KHÔNG dùng admin gán-cứng của Hoàng Sa/Trường Sa/thềm lục địa
        expect(Object.values(EXPECTED_REEF_ADMIN)).not.toContain(p.admin);
      }
    }
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

  it("KHÔNG tên nào có ở CẢ vn-islands lẫn coral-reefs (khử trùng 2026-09-03, review A.5)", () => {
    // Trước: 27 tên (Đá Lớn, Đá Nam, Bãi Thuỷ Tề…) nằm ở cả hai file → cùng một
    // chỗ vừa chấm navy (đảo) vừa chấm teal (rạn), nhãn đổi màu theo zoom.
    // Luật: NGẦM/rạn/bãi → chỉ coral-reefs; NỔI (đảo/hòn/cồn cát) → chỉ islands.
    // Quyết định từng cặp: docs/research/ten-bai-can-2026-09.md §9.
    const islands = readJSON("vn-islands.v1.json");
    const norm = (s: unknown) => String(s).normalize("NFC").trim().toLowerCase();
    const reefNames = new Set(fc.features.map((f) => norm(f.properties.name)));
    const giao = islands.features
      .map((f) => String(f.properties.name))
      .filter((n) => reefNames.has(norm(n)));
    expect(giao, `trùng tên islands ∩ reefs: ${giao.join(", ")}`).toEqual([]);
  });

  it("KHÔNG đá/bãi NGẦM nào còn nằm cạnh bản sao khác tên trong vn-islands (<2,5 km, cùng tên lõi)", () => {
    // Bắt ca "Đá Tây" (islands) ↔ "Bãi đá Tây" (reefs), "Đá Thị" ↔ "Đá Núi Thị"…
    // Cồn cát nổi + Hòn (đảo đá nổi) được phép ở islands; chỉ soi type da/bai.
    const islands = readJSON("vn-islands.v1.json");
    const core = (s: unknown) =>
      String(s)
        .normalize("NFC")
        .toLowerCase()
        .replace(/^(bãi cạn|bãi đá|bãi ngầm|đá ngầm|đá núi|bãi|đá|cồn|rạn)\s+/, "")
        .trim();
    const km = (a: number[], b: number[]) => {
      const R = 6371;
      const t = (x: number) => (x * Math.PI) / 180;
      const dLat = t(b[1] - a[1]);
      const dLon = t(b[0] - a[0]);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(t(a[1])) * Math.cos(t(b[1])) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    const bad: string[] = [];
    for (const i of islands.features) {
      const t = String(i.properties.type);
      if (t !== "da" && t !== "bai") continue;
      if (/^Hòn /.test(String(i.properties.name))) continue; // hòn = đá nổi, hợp lệ ở islands
      const ci = core(i.properties.name);
      for (const r of fc.features) {
        if (core(r.properties.name) !== ci) continue;
        const d = km(i.geometry.coordinates, r.geometry.coordinates);
        if (d < 2.5) bad.push(`${i.properties.name} ↔ ${r.properties.name} (${d.toFixed(1)} km)`);
      }
    }
    expect(bad, bad.join(" · ")).toEqual([]);
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
