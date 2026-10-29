import { describe, expect, it } from "vitest";
import { gridPoints, type ForecastGrid } from "../forecast-grid";
import { buildUVField, fillMissingUV, sampleUV, stepParticle } from "../particle-field";

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

  it("DÒNG CHẢY: hướng nguồn là CHẢY VỀ → dùng thẳng (không +180°), tốc độ nhân hệ số tượng trưng", () => {
    const f = buildUVField(
      makeGrid({ ...northWind, curKmh: 2, curDirDeg: 90 }), // chảy VỀ Đông
      0,
      "current",
    )!;
    const uv = sampleUV(f, 13, 110)!;
    expect(uv[0]).toBeGreaterThan(0); // u dương = trôi về Đông, đúng chiều nước
    expect(Math.abs(uv[1])).toBeLessThan(1e-6);
    expect(Math.hypot(uv[0], uv[1])).toBeCloseTo(2 * 8, 3); // 2 km/h giữ đúng mức cũ
  });

  it("DÒNG CHẢY YẾU vẫn thấy trôi: tốc hạt theo căn, 0,6 km/h không chậm hơn 2,5 km/h tới 4 lần (2026-10-29)", () => {
    const speed = (kmh: number) => {
      const f = buildUVField(makeGrid({ ...northWind, curKmh: kmh, curDirDeg: 0 }), 0, "current")!;
      const uv = sampleUV(f, 13, 110)!;
      return Math.hypot(uv[0], uv[1]);
    };
    // miền Nam 0,6 km/h so với miền Trung 2,5 km/h: nhân thẳng là 4,2 lần
    expect(speed(2.5) / speed(0.6)).toBeLessThan(2.1);
    // mạnh vẫn nhanh hơn yếu — thứ tự giữ nguyên
    expect(speed(2.5)).toBeGreaterThan(speed(0.6));
    expect(speed(0)).toBe(0);
  });

  it("DÒNG CHẢY: bản lưu đời cũ không có trường cur → trường u/v toàn NaN, sample null", () => {
    const f = buildUVField(makeGrid(northWind), 0, "current");
    // mọi ô đều thiếu số → buildUVField vẫn trả field nhưng sample ra null
    expect(f === null || sampleUV(f!, 13, 110) === null).toBe(true);
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

  it("ô thiếu số (đất liền với sóng) → sample SÁT ô đó null, còn lại chia lại trọng số", () => {
    const grid = makeGrid(northWind);
    grid.cells[0] = { ...grid.cells[0], hours: [{ ...northWind, waveM: null, waveDirDeg: null }] };
    const f = buildUVField(grid, 0, "wave")!;
    // sát góc thiếu (trọng số góc còn số < 0,25) → null: hạt vẫn chết trên đất
    expect(sampleUV(f, f.lat0 + 0.1, f.lon0 + 0.1)).toBeNull();
    // giữa lưới vẫn có
    expect(sampleUV(f, 13, 110)).not.toBeNull();
  });

  it("quad chạm ô đất KHÔNG chết cả quad — chia lại trọng số 3 góc còn số (2026-07-29)", () => {
    const grid = makeGrid(northWind);
    grid.cells[0] = { ...grid.cells[0], hours: [{ ...northWind, waveM: null, waveDirDeg: null }] };
    const f = buildUVField(grid, 0, "wave")!;
    // CHÍNH GIỮA quad góc (0,0): 3/4 trọng số còn số → phải có u/v (trước đây null
    // → lớp sóng loang lổ "ô có ô không" quanh mọi bờ/đảo)
    const midLat = f.lat0 + f.dLat / 2;
    const midLon = f.lon0 + f.dLon / 2;
    const uv = sampleUV(f, midLat, midLon)!;
    expect(uv).not.toBeNull();
    // vẫn là sóng TỪ Đông → u âm, độ lớn cỡ 2 m × 12
    expect(uv[0]).toBeLessThan(0);
    expect(Math.hypot(uv[0], uv[1])).toBeCloseTo(24, 1);
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

describe("fillMissingUV — lấp ô đất cho hạt lớp nước (2026-10-29)", () => {
  const curHour = { ...northWind, curKmh: 2, curDirDeg: 90 };
  const landHour = { ...northWind, curKmh: null, curDirDeg: null };

  /** cả hàng lat thứ 6 (11,45°B) là đất — như dải Bình Dương/Ninh Thuận */
  function gridWithLandRow(): ForecastGrid {
    const g = makeGrid(curHour);
    const lats = [...new Set(g.cells.map((c) => c.lat))];
    const landLat = lats[5];
    g.cells = g.cells.map((c) => (c.lat === landLat ? { ...c, hours: [landHour] } : c));
    return g;
  }

  it("trước khi lấp: sát hàng đất hạt chết · sau khi lấp: có u/v cùng hướng ô biển kề", () => {
    const f = buildUVField(gridWithLandRow(), 0, "current")!;
    const landLat = f.lat0 + 5 * f.dLat;
    expect(sampleUV(f, landLat, 110)).toBeNull();
    const filled = fillMissingUV(f, () => true);
    const uv = sampleUV(filled, landLat, 110)!;
    expect(uv).not.toBeNull();
    expect(uv[0]).toBeGreaterThan(0); // vẫn chảy về Đông
    expect(Math.hypot(uv[0], uv[1])).toBeCloseTo(16, 3);
  });

  it("canFill = false ⇒ không lấp (ngoài vùng mặt nạ giữ hành vi cũ)", () => {
    const f = buildUVField(gridWithLandRow(), 0, "current")!;
    const filled = fillMissingUV(f, () => false);
    expect(sampleUV(filled, f.lat0 + 5 * f.dLat, 110)).toBeNull();
  });

  it("không đụng mảng của trường gốc (thuần)", () => {
    const f = buildUVField(gridWithLandRow(), 0, "current")!;
    const before = Array.from(f.u);
    fillMissingUV(f, () => true);
    expect(Array.from(f.u)).toEqual(before);
  });

  it("lưới toàn đất (bản lưu đời cũ không có cur) ⇒ vẫn null, không bịa số", () => {
    const f = buildUVField(makeGrid(northWind), 0, "current")!;
    const filled = fillMissingUV(f, () => true);
    expect(sampleUV(filled, 13, 110)).toBeNull();
  });
});
