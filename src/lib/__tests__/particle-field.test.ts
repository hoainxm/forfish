import { describe, expect, it } from "vitest";
import { gridPoints, type ForecastGrid } from "../forecast-grid";
import { buildUVField, sampleUV, stepParticle } from "../particle-field";

/** Lưới chuẩn đủ 156 ô, mọi ô cùng một giờ dữ liệu */
function makeGrid(hour: ForecastGrid["cells"][0]["hours"][0]): ForecastGrid {
  return {
    cells: gridPoints().map((p) => ({ lat: p.lat, lon: p.lon, hours: [hour] })),
    times: ["2026-07-29T00:00"],
  };
}

const northWind = {
  windKmh: 36,
  windDirDeg: 0, // gió TỪ Bắc → hạt bay VỀ Nam
  waveM: 2,
  waveDirDeg: 90, // sóng TỪ Đông → hạt bay VỀ Tây
};

describe("buildUVField", () => {
  it("gió từ Bắc → v âm (bay về Nam), u ≈ 0", () => {
    const f = buildUVField(makeGrid(northWind), 0, "wind")!;
    expect(f).not.toBeNull();
    // ô giữa lưới
    const uv = sampleUV(f, 13, 110)!;
    expect(uv[1]).toBeLessThan(0);
    expect(Math.abs(uv[0])).toBeLessThan(1e-6);
    expect(Math.hypot(uv[0], uv[1])).toBeCloseTo(36, 3);
  });

  it("lớp SÓNG dùng hướng sóng + độ cao làm tốc độ tượng trưng", () => {
    const f = buildUVField(makeGrid(northWind), 0, "wave")!;
    const uv = sampleUV(f, 13, 110)!;
    // sóng TỪ Đông → bay VỀ Tây = u âm
    expect(uv[0]).toBeLessThan(0);
    expect(Math.abs(uv[1])).toBeLessThan(1e-6);
    expect(Math.hypot(uv[0], uv[1])).toBeCloseTo(2 * 12, 3);
  });

  it("lưới sai kích thước → null, không ném", () => {
    const bad: ForecastGrid = {
      cells: [{ lat: 13, lon: 110, hours: [northWind] }],
      times: ["t"],
    };
    expect(buildUVField(bad, 0, "wind")).toBeNull();
  });

  it("TỰ SUY kích thước lưới từ cells — bản lưu lưới CŨ (cỡ khác) vẫn chạy", () => {
    // lưới 2×3 nhỏ xíu (không khớp hằng số 13×12 hiện tại)
    const cells = [];
    for (const lat of [10, 12]) {
      for (const lon of [105, 107, 109]) {
        cells.push({ lat, lon, hours: [northWind] });
      }
    }
    const f = buildUVField({ cells, times: ["t"] }, 0, "wind")!;
    expect(f).not.toBeNull();
    expect(f.nLat).toBe(2);
    expect(f.nLon).toBe(3);
    const uv = sampleUV(f, 11, 107)!;
    expect(uv[1]).toBeLessThan(0); // gió từ Bắc → về Nam
  });

  it("ô thiếu số (đất liền với sóng) → sample quanh đó null", () => {
    const grid = makeGrid(northWind);
    grid.cells[0] = { ...grid.cells[0], hours: [{ ...northWind, waveM: null, waveDirDeg: null }] };
    const f = buildUVField(grid, 0, "wave")!;
    // góc (lat0,lon0) thiếu → điểm sát góc đó null
    expect(sampleUV(f, f.lat0 + 0.1, f.lon0 + 0.1)).toBeNull();
    // giữa lưới vẫn có
    expect(sampleUV(f, 13, 110)).not.toBeNull();
  });
});

describe("sampleUV biên", () => {
  const f = buildUVField(makeGrid(northWind), 0, "wind")!;
  it("ngoài lưới → null", () => {
    expect(sampleUV(f, 30, 110)).toBeNull();
    expect(sampleUV(f, 13, 90)).toBeNull();
  });
  it("đúng mép lưới vẫn lấy được", () => {
    expect(sampleUV(f, f.lat0, f.lon0)).not.toBeNull();
  });
});

describe("stepParticle", () => {
  const f = buildUVField(makeGrid(northWind), 0, "wind")!;
  it("gió từ Bắc → lat GIẢM, lon đứng yên", () => {
    const next = stepParticle(f, 13, 110, 1 / 60)!;
    expect(next[0]).toBeLessThan(13);
    expect(next[1]).toBeCloseTo(110, 6);
  });
  it("tốc mặc định: một frame 60fps đi cỡ phần trăm độ, không nhảy vọt", () => {
    const next = stepParticle(f, 13, 110, 1 / 60)!;
    const d = Math.abs(next[0] - 13);
    expect(d).toBeGreaterThan(0.005);
    expect(d).toBeLessThan(0.1);
  });
  it("ra ngoài lưới → null (hạt chết, chỗ gọi respawn)", () => {
    expect(stepParticle(f, 30, 110, 1 / 60)).toBeNull();
  });
});
