import { describe, expect, it } from "vitest";
import {
  distanceToPolygonDeg,
  FISH_REGIONS,
  FISH_SEASONS,
  fishInRegion,
  nearestRegionWithin,
  regionAt,
  type FishRegionId,
} from "../../data/fish-seasons";

describe("regionAt", () => {
  it("giữa Vịnh Bắc Bộ → vinh-bac-bo", () => {
    expect(regionAt(19.8, 107.0)?.id).toBe("vinh-bac-bo");
  });

  it("ngoài khơi Phú Yên → nam-trung-bo", () => {
    expect(regionAt(13.0, 110.3)?.id).toBe("nam-trung-bo");
  });

  it("vùng biển Hoàng Sa → hoang-sa", () => {
    expect(regionAt(16.3, 112.0)?.id).toBe("hoang-sa");
  });

  it("vùng biển Trường Sa → truong-sa-dk1", () => {
    expect(regionAt(10.0, 114.0)?.id).toBe("truong-sa-dk1");
  });

  it("đất liền (Hà Nội) → null", () => {
    expect(regionAt(21.0, 105.8)).toBeNull();
  });
});

describe("fishInRegion", () => {
  it("mọi vùng có ít nhất 1 loài ở tháng 6 và tháng 12", () => {
    for (const region of FISH_REGIONS) {
      for (const month of [6, 12]) {
        const fish = fishInRegion(region.id, month);
        expect(
          fish.length,
          `vùng ${region.id} tháng ${month} không có loài nào`
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("chỉ trả về loài đúng vùng và đúng tháng", () => {
    for (const season of fishInRegion("nam-trung-bo", 1)) {
      expect(season.regions).toContain("nam-trung-bo");
      expect(season.months).toContain(1);
    }
  });

  it("cá ngừ vây vàng + mắt to (2 loài riêng) có QUANH NĂM ở khơi, kể cả tháng 7", () => {
    // tách 2 loài 2026-07-25; trước đây gộp + chỉ để T12–6 nên T7 biến mất
    const TUNAS = ["Cá ngừ vây vàng", "Cá ngừ mắt to"];
    const offshore: FishRegionId[] = [
      "truong-sa-dk1",
      "nam-trung-bo",
      "hoang-sa",
      "trung-bo",
    ];
    for (const sp of TUNAS) {
      for (const month of [7, 8, 9]) {
        for (const region of offshore) {
          expect(
            fishInRegion(region, month).some((s) => s.species === sp),
            `${sp} thiếu ở ${region} tháng ${month}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("FISH_REGIONS polygon", () => {
  it("mỗi polygon có ≥4 đỉnh và khép kín logic (điểm đầu ≠ điểm cuối, regionAt tự khép)", () => {
    for (const region of FISH_REGIONS) {
      expect(region.polygon.length).toBeGreaterThanOrEqual(4);
      const first = region.polygon[0];
      const last = region.polygon[region.polygon.length - 1];
      // không lặp lại điểm đầu ở cuối — ray casting tự khép cạnh cuối→đầu
      expect(first[0] !== last[0] || first[1] !== last[1]).toBe(true);
    }
  });

  it("mọi đỉnh nằm trong khung biển VN (lng 102–117.6, lat 6–21.5)", () => {
    for (const region of FISH_REGIONS) {
      for (const [lng, lat] of region.polygon) {
        expect(lng).toBeGreaterThanOrEqual(102);
        expect(lng).toBeLessThanOrEqual(117.6);
        expect(lat).toBeGreaterThanOrEqual(6);
        expect(lat).toBeLessThanOrEqual(21.5);
      }
    }
  });

  it("labelAt nằm trong polygon của chính vùng đó", () => {
    for (const region of FISH_REGIONS) {
      const [lng, lat] = region.labelAt;
      expect(regionAt(lat, lng)?.id, `nhãn vùng ${region.id}`).toBe(region.id);
    }
  });
});

describe("FISH_SEASONS dữ liệu hợp lệ", () => {
  it("months trong khoảng 1–12, regions tồn tại", () => {
    const ids = new Set(FISH_REGIONS.map((r) => r.id));
    for (const season of FISH_SEASONS) {
      expect(season.months.length).toBeGreaterThan(0);
      for (const m of season.months) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      }
      expect(season.regions.length).toBeGreaterThan(0);
      for (const r of season.regions) {
        expect(ids.has(r)).toBe(true);
      }
    }
  });
});

describe("nearestRegionWithin — gán vùng theo CẠNH, không theo ĐỈNH", () => {
  // Sửa 2026-07-26. Trước đây quét từng ĐỈNH đa giác: đa giác vùng chỉ 7–9 đỉnh
  // nên cạnh rất dài, ô sát GIỮA cạnh dài của vùng A bị gán vùng B chỉ vì B có
  // một đỉnh nhô gần hơn. ĐO THẬT trên lưới 0,25° (5–22N / 102–118E, 4485 ô):
  // 96 ô đổi kết quả — 50 ô được CỨU (trước bị bỏ hẳn khỏi bản đồ), 46 ô đổi
  // vùng; 0 ô bị mất. Sai vùng ⇒ sai bộ lọc loài theo mùa.

  it("khơi Vũng Tàu (10,75N;107,75E) → dong-nam-bo, KHÔNG phải nam-trung-bo", () => {
    // cách CẠNH bắc Đông Nam Bộ 0,55° nhưng cách ĐỈNH gần nhất của nó 0,85°;
    // Nam Trung Bộ có một đỉnh cách 0,75° → bản cũ gán nhầm nam-trung-bo
    expect(regionAt(10.75, 107.75)).toBeNull();
    expect(nearestRegionWithin(10.75, 107.75, 2)?.id).toBe("dong-nam-bo");
  });

  it("ô nằm HẲN trong một vùng vẫn ra đúng vùng đó", () => {
    for (const region of FISH_REGIONS) {
      const [lng, lat] = region.labelAt;
      expect(nearestRegionWithin(lat, lng, 2)?.id, region.id).toBe(region.id);
    }
    expect(nearestRegionWithin(20, 107.25, 2)?.id).toBe("vinh-bac-bo");
  });

  it("ô ngoài mọi đa giác nhưng sát một CẠNH → vẫn có vùng (lấp lỗ hổng)", () => {
    // (8,5N;110E) không thuộc đa giác nào, nằm giữa Đông Nam Bộ / Trường Sa
    expect(regionAt(8.5, 110)).toBeNull();
    expect(nearestRegionWithin(8.5, 110, 2)).not.toBeNull();
  });

  it("xa hơn maxDeg tới mọi CẠNH → null", () => {
    expect(nearestRegionWithin(20, 112, 2)).toBeNull(); // đông bắc, nước ngoài
    expect(nearestRegionWithin(3, 110, 2)).toBeNull(); // quá xa về nam
    // cùng một điểm: tầm rộng thì có vùng, tầm hẹp thì không
    expect(nearestRegionWithin(10.75, 107.75, 0.6)?.id).toBe("dong-nam-bo");
    expect(nearestRegionWithin(10.75, 107.75, 0.5)).toBeNull();
  });
});

describe("distanceToPolygonDeg — khoảng cách tới ĐOẠN THẲNG", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("điểm vuông góc GIỮA cạnh: lấy chân đường vuông góc, không lấy đỉnh", () => {
    // đỉnh gần nhất cách hypot(5,3) ≈ 5,83; cạnh dưới chỉ cách 3
    expect(distanceToPolygonDeg(5, -3, square)).toBeCloseTo(3, 9);
  });

  it("điểm ngoài hai đầu mút: kẹp về đỉnh (không dùng đường thẳng vô hạn)", () => {
    expect(distanceToPolygonDeg(-3, -4, square)).toBeCloseTo(5, 9);
  });

  it("cạnh CUỐI nối đỉnh cuối về đỉnh đầu (đa giác tự khép)", () => {
    // bên trái cạnh [0,10]→[0,0] — cạnh này chỉ tồn tại nếu đa giác được khép
    expect(distanceToPolygonDeg(-2, 5, square)).toBeCloseTo(2, 9);
  });

  it("điểm nằm TRONG đa giác → khoảng cách tới cạnh gần nhất (≥ 0)", () => {
    expect(distanceToPolygonDeg(5, 1, square)).toBeCloseTo(1, 9);
    expect(distanceToPolygonDeg(0, 0, square)).toBeCloseTo(0, 9);
  });
});
