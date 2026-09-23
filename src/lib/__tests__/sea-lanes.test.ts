import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LANE_KINDS,
  hasForbiddenChars,
  FORBIDDEN_NAME_RE,
  type LaneKind,
} from "../islands";

/*
 * CỔNG DỮ LIỆU `public/data/vn-sea-lanes.v1.json` (sinh bởi
 * scripts/generate-sea-lanes.mjs). Sau đợt VIỆT HOÁ 2026-09-03: MỌI feature
 * phải có `ten` tiếng Việt (trước đây lớp OSM bỏ trắng tên) và 0 ký tự Hán.
 * Kèm bổ sung hạ tầng VN: trục luồng Cục Hàng hải (src=vn-aids) + vùng cấm neo
 * 500 m quanh công trình biển (src=an-toan).
 */

const FILE = join(process.cwd(), "public", "data", "vn-sea-lanes.v1.json");
const rawText = readFileSync(FILE, "utf8");
const data = JSON.parse(rawText) as {
  type: string;
  features: {
    type: string;
    properties: {
      kind?: string;
      ten?: string;
      src?: string;
      loai?: string;
      tram?: string;
      hoDang?: boolean;
    };
    geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  }[];
};

const KIND_SET = new Set<string>(LANE_KINDS);
const SRC_SET = new Set(["van-tay", "osm", "vn-aids", "an-toan", "cap-vn"]);

// Tên nước ngoài của thực thể VN (bổ sung cho FORBIDDEN_NAME_RE chỉ bắt CJK).
const FORBIDDEN_LATIN =
  /\b(south china sea|nansha|xisha|paracel|spratly|sansha|vanguard bank|ayungin)\b/i;

// hình chiếu mọi đỉnh của một feature → mảng [lng,lat]
function verts(g: {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}): number[][] {
  if (g.type === "Point") return [g.coordinates as number[]];
  if (g.type === "Polygon") return (g.coordinates as number[][][]).flat();
  return g.coordinates as number[][];
}

describe("vn-sea-lanes.v1.json — hải đồ tuyến/luồng đã Việt hoá", () => {
  it("là FeatureCollection, có đủ feature (sinh lại không làm rơi lớp)", () => {
    expect(data.type).toBe("FeatureCollection");
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBeGreaterThanOrEqual(290);
  });

  it("KHÔNG một ký tự Hán/CJK nào trong TOÀN BỘ file (quét chuỗi thô)", () => {
    const hit = rawText.match(FORBIDDEN_NAME_RE);
    expect(
      hasForbiddenChars(rawText),
      hit ? `ký tự "${hit[0]}" ở vị trí ${hit.index}` : "",
    ).toBe(false);
  });

  it("KHÔNG tên nước ngoài của thực thể VN trong toàn file", () => {
    const hit = rawText.match(FORBIDDEN_LATIN);
    expect(hit, hit ? `gặp "${hit[0]}"` : "").toBeNull();
  });

  it("MỌI feature: kind hợp lệ + ten TIẾNG VIỆT không rỗng + src hợp lệ", () => {
    const bad: string[] = [];
    data.features.forEach((f, i) => {
      const p = f.properties ?? {};
      if (!p.kind || !KIND_SET.has(p.kind))
        bad.push(`#${i} kind="${p.kind}" không hợp lệ`);
      if (!p.ten || !String(p.ten).trim())
        bad.push(`#${i} (kind=${p.kind}) thiếu ten`);
      else if (hasForbiddenChars(p.ten))
        bad.push(`#${i} ten="${p.ten}" có ký tự Hán`);
      if (!p.src || !SRC_SET.has(p.src))
        bad.push(`#${i} src="${p.src}" không hợp lệ`);
    });
    expect(bad, bad.join(" · ")).toEqual([]);
  });

  it("MỌI toạ độ hữu hạn + trong dải hàng hải hợp lý (bắt lỗi DMS→decimal)", () => {
    // Dải RỘNG Á–TBD: cáp quốc tế thật (Southeast Asia-Japan Cable) kéo dài tới
    // Nhật (~140,7E / 35N) do OSM `out geom` trả trọn hình học way; tuyến Bắc–
    // Nam vẽ tay chạm ~1,1N. Vẫn bắt lỗi hoán lat/lng hay DMS chưa đổi.
    const bad: string[] = [];
    data.features.forEach((f, i) => {
      for (const c of verts(f.geometry)) {
        const [lng, lat] = c;
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
          bad.push(`#${i} toạ độ không hữu hạn`);
        else if (lng < 95 || lng > 145 || lat < -2 || lat > 40)
          bad.push(`#${i} toạ độ ngoài dải [${lng},${lat}]`);
      }
    });
    expect(bad, bad.slice(0, 8).join(" · ")).toEqual([]);
  });

  it("đếm theo kind: đủ mỗi loại, lớp OSM còn nguyên, CÁP và ỐNG tách riêng", () => {
    const n: Record<string, number> = {};
    for (const f of data.features) n[f.properties.kind!] = (n[f.properties.kind!] ?? 0) + 1;
    // OSM verify 2026-09-03: cable_submarine 78 · pipeline_submarine 25 ·
    // phanluong 108 · giankhoan 41 · tuyến vẽ tay 5 · cap-bo 10 (trạm VN)
    expect(n.cap).toBeGreaterThanOrEqual(78);
    expect(n.ong, "ống dẫn phải là kind riêng, không gộp vào cáp").toBeGreaterThanOrEqual(20);
    expect(n["cap-bo"]).toBe(10);
    expect(n.phanluong).toBeGreaterThanOrEqual(108);
    expect(n.giankhoan).toBeGreaterThanOrEqual(41);
    expect(n.tuyen).toBe(5);
    (LANE_KINDS as LaneKind[]).forEach((k) =>
      expect(n[k] ?? 0, `kind ${k} phải có ít nhất 1`).toBeGreaterThanOrEqual(1),
    );
  });

  it("CÁP vs ỐNG: tên + `loai` khớp kind (bà con đọc ra ngay là ống dẫn hay cáp)", () => {
    // Review A.4 (danh-gia-hai-do-2026-09): ống khí/dầu nguy hiểm hơn cáp
    // (neo/lưới trúng = cháy nổ) — không được để một kind vẽ chung.
    const CAP_LOAI = new Set(["quang", "dien", "chua-ro"]);
    const ONG_LOAI = new Set(["khi", "dau", "nhien-lieu", "nuoc", "xa-thai", "chua-ro"]);
    const bad: string[] = [];
    data.features.forEach((f, i) => {
      const p = f.properties;
      if (p.kind === "cap") {
        if (!/^Cáp /.test(p.ten!)) bad.push(`#${i} cap ten="${p.ten}"`);
        if (!CAP_LOAI.has(p.loai!)) bad.push(`#${i} cap loai="${p.loai}"`);
        if (f.geometry.type !== "LineString") bad.push(`#${i} cap không phải LineString`);
      } else if (p.kind === "ong") {
        if (!/^Ống /.test(p.ten!)) bad.push(`#${i} ong ten="${p.ten}"`);
        if (!ONG_LOAI.has(p.loai!)) bad.push(`#${i} ong loai="${p.loai}"`);
        if (f.geometry.type !== "LineString") bad.push(`#${i} ong không phải LineString`);
      } else if (/^(Ống|Cáp) /.test(p.ten ?? "") && p.kind !== "cap-bo") {
        bad.push(`#${i} ten="${p.ten}" nhưng kind=${p.kind}`);
      }
    });
    expect(bad, bad.join(" · ")).toEqual([]);
    // ống dẫn khí/dầu thật có mặt (không phải toàn cống xả)
    const nguyHiem = data.features.filter(
      (f) => f.properties.kind === "ong" && ["khi", "dau", "nhien-lieu"].includes(f.properties.loai!),
    );
    expect(nguyHiem.length).toBeGreaterThanOrEqual(5);
  });

  it("BỔ SUNG VN: trục luồng Cục Hàng hải lấp chỗ trống fairway", () => {
    const vn = data.features.filter((f) => f.properties.src === "vn-aids");
    expect(vn.length).toBeGreaterThanOrEqual(30);
    // tất cả là luồng, tên bắt đầu bằng "Luồng"/"Tuyến" (tiếng Việt)
    vn.forEach((f) => {
      expect(f.properties.kind).toBe("luong");
      expect(/^(Luồng|Tuyến)/.test(f.properties.ten!)).toBe(true);
      expect((f.geometry.coordinates as number[][]).length).toBeGreaterThanOrEqual(2);
    });
    // tổng luồng = OSM fairway + trục VN → nhiều hơn hẳn 25 OSM ban đầu
    const luong = data.features.filter((f) => f.properties.kind === "luong");
    expect(luong.length).toBeGreaterThanOrEqual(55);
  });

  it("BỔ SUNG VN: cáp quang biển quốc tế cập bờ VN (điểm cập bờ)", () => {
    // Chỉ ĐIỂM CẬP BỜ, không tuyến (hình tuyến chỉ có ở TeleGeography, copyleft
    // CC BY-NC-SA → tránh). Verify ≥2 nguồn từng tuyến: docs/research/cap-ngam-2026-09.md
    const cables = data.features.filter((f) => f.properties.src === "cap-vn");
    // 10 cáp thật cập bờ VN (5 Vũng Tàu · 3 Đà Nẵng · 2 Quy Nhơn)
    expect(cables.length).toBeGreaterThanOrEqual(10);
    // 3 trạm cập bờ VN THẬT (Vũng Tàu / Đà Nẵng / Quy Nhơn) — bắt lỗi lệch toạ độ
    const PORTS: [number, number][] = [
      [107.0792, 10.3418],
      [108.2147, 16.0516],
      [109.2197, 13.782],
    ];
    expect(cables.length).toBe(10);
    const TRAM = new Set(["Vũng Tàu", "Đà Nẵng", "Quy Nhơn"]);
    cables.forEach((f) => {
      // 2026-09-03: Point THẬT `kind: "cap-bo"` (Lead vẽ icon `cable-landing`)
      // — thay mẹo LineString độ-dài-0 vô hình trên màn (review A.4-3).
      expect(f.properties.kind).toBe("cap-bo");
      expect(f.geometry.type).toBe("Point");
      expect(f.properties.loai).toBe("quang");
      expect(TRAM.has(f.properties.tram!), `tram="${f.properties.tram}"`).toBe(true);
      // tên tiếng Việt bắt đầu "Cáp quang biển", có ghi "cập bờ <trạm>"
      expect(f.properties.ten).toMatch(/^Cáp quang biển .+ — cập bờ /);
      expect(f.properties.ten!.endsWith(`cập bờ ${f.properties.tram}`)).toBe(true);
      const [lng, lat] = f.geometry.coordinates as number[];
      const atPort = PORTS.some(
        ([px, py]) => Math.abs(px - lng) < 0.01 && Math.abs(py - lat) < 0.01,
      );
      expect(atPort, `toạ độ ${lng},${lat} không khớp trạm cập bờ VN`).toBe(true);
    });
    // đủ cả 3 trạm cập bờ có mặt
    const ports = new Set(cables.map((f) => (f.geometry.coordinates as number[]).join(",")));
    expect(ports.size).toBe(3);
  });

  it("BỔ SUNG VN: vùng cấm neo 500 m suy từ tâm công trình biển — loai=cam-neo", () => {
    const zones = data.features.filter((f) => f.properties.src === "an-toan");
    // 7 công trình biển vịnh Bắc Bộ (lat<21,2) — sinh lại không được rơi
    expect(zones.length).toBe(7);
    zones.forEach((f) => {
      expect(f.properties.kind).toBe("vungcam");
      // Lead đặt icon `no-anchor` + nhãn "CẤM NEO" theo `loai`, khác khu hạn chế OSM
      expect(f.properties.loai).toBe("cam-neo");
      // R1: Polygon một vòng khép kín (đỉnh đầu == đỉnh cuối) → icon ở TÂM
      expect(f.geometry.type).toBe("Polygon");
      const rings = f.geometry.coordinates as number[][][];
      expect(rings.length).toBe(1);
      const cs = rings[0];
      expect(cs.length).toBeGreaterThanOrEqual(5);
      expect(cs[0]).toEqual(cs[cs.length - 1]);
      expect(f.properties.hoDang).toBeUndefined();
    });
    // MỌI vùng cấm (kể cả OSM restricted_area) đều có `loai` hợp lệ, và là
    // Polygon khép kín — trừ way OSM hở phải mang cờ `hoDang: true` (LineString)
    const LOAI = new Set(["cam-neo", "cam-danh-bat", "cam-vao", "han-che"]);
    const all = data.features.filter((f) => f.properties.kind === "vungcam");
    expect(all.length).toBe(15);
    let hoDang = 0;
    all.forEach((f, i) => {
      expect(LOAI.has(f.properties.loai!), `loai="${f.properties.loai}"`).toBe(true);
      if (f.properties.hoDang === true) {
        hoDang++;
        expect(f.properties.src, `#${i} hoDang chỉ có ở OSM`).toBe("osm");
        expect(f.geometry.type).toBe("LineString");
      } else {
        expect(f.geometry.type, `#${i} vungcam không hoDang phải là Polygon`).toBe("Polygon");
        const ring = (f.geometry.coordinates as number[][][])[0];
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      }
    });
    // Overpass 2026-09-03: 6/8 restricted_area là way hở — không tự khép (bịa
    // diện tích); nếu OSM sửa thành khép kín thì số này chỉ được GIẢM
    expect(hoDang).toBeLessThanOrEqual(6);
    // ≥9 Polygon thật (7 an-toan + 2 OSM khép kín)
    expect(all.length - hoDang).toBeGreaterThanOrEqual(9);
  });
});
