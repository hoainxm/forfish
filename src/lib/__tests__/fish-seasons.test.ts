import { describe, expect, it } from "vitest";
import {
  FISH_REGIONS,
  FISH_SEASONS,
  fishInRegion,
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
