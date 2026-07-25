import { describe, expect, it } from "vitest";
import {
  arrowFeatures,
  gridPoints,
  timeLabelVN,
  stepHourIndices,
  GRID_DAY_OPTIONS,
  TIME_STEP_HOURS,
  FORECAST_GRID_HOURS,
  type ForecastGrid,
} from "../forecast-grid";

describe("gridPoints", () => {
  it("80 điểm (8×10), nằm trong khung biển VN, không trùng nhau", () => {
    const pts = gridPoints();
    expect(pts).toHaveLength(80);
    for (const p of pts) {
      expect(p.lon).toBeGreaterThanOrEqual(102);
      expect(p.lon).toBeLessThanOrEqual(118);
      expect(p.lat).toBeGreaterThanOrEqual(5.5);
      expect(p.lat).toBeLessThanOrEqual(22);
    }
    expect(new Set(pts.map((p) => `${p.lat},${p.lon}`)).size).toBe(80);
  });
});

function makeGrid(hours: ForecastGrid["cells"][0]["hours"]): ForecastGrid {
  return {
    cells: [{ lat: 13, lon: 110, hours }],
    times: hours.map((_, i) => `2026-06-12T${String(i * 3).padStart(2, "0")}:00`),
  };
}

describe("arrowFeatures", () => {
  const calmHour = {
    windKmh: 10,
    windDirDeg: 0, // gió TỪ Bắc → thổi VỀ Nam
    waveM: 0.5,
    waveDirDeg: 90, // sóng TỪ Đông → đi VỀ Tây
  };

  it("gió từ Bắc → mũi tên chỉ về Nam (đầu thấp hơn đuôi)", () => {
    const fc = arrowFeatures(makeGrid([calmHour]), 0, "wind");
    expect(fc.features).toHaveLength(1);
    const coords = (fc.features[0].geometry as GeoJSON.MultiLineString)
      .coordinates;
    const [tail, head] = coords[0];
    expect(head[1]).toBeLessThan(tail[1]); // lat giảm = về Nam
    expect(coords).toHaveLength(3); // thân + 2 ngạnh
  });

  it("sóng từ Đông → mũi tên về Tây (lon giảm); độ lớn nằm trong properties.v", () => {
    const fc = arrowFeatures(makeGrid([calmHour]), 0, "wave");
    const [tail, head] = (
      fc.features[0].geometry as GeoJSON.MultiLineString
    ).coordinates[0];
    expect(head[0]).toBeLessThan(tail[0]);
    expect(fc.features[0].properties?.v).toBe(0.5);
  });

  it("cell thiếu dữ liệu (đất liền với sóng) → bỏ qua, không vỡ", () => {
    const fc = arrowFeatures(
      makeGrid([{ ...calmHour, waveM: null, waveDirDeg: null }]),
      0,
      "wave",
    );
    expect(fc.features).toHaveLength(0);
  });

  it("timeIdx ngoài tầm → rỗng", () => {
    const fc = arrowFeatures(makeGrid([calmHour]), 5, "wind");
    expect(fc.features).toHaveLength(0);
  });
});

describe("timeLabelVN", () => {
  it("hôm nay nói thẳng, ngày khác ra thứ + ngày/tháng + giờ", () => {
    expect(timeLabelVN("2026-06-12T13:00", "2026-06-12")).toBe("Hôm nay · 13h");
    // 2026-06-12 là Thứ sáu
    expect(timeLabelVN("2026-06-12T07:00")).toBe("Th 6 12/6 · 7h");
  });
});

describe("hằng số thanh thời gian", () => {
  it("72 giờ chia hết cho bước 3 giờ → 24 nấc", () => {
    expect(FORECAST_GRID_HOURS % TIME_STEP_HOURS).toBe(0);
    expect(FORECAST_GRID_HOURS / TIME_STEP_HOURS).toBe(24);
  });
});

describe("stepHourIndices (bước tăng dần theo tầm ngày)", () => {
  it("3 ngày = bước 3h đều → 25 mốc (0..72), khớp hành vi cũ", () => {
    const idx = stepHourIndices(3, 96);
    expect(idx[0]).toBe(0);
    expect(idx[1]).toBe(3);
    expect(idx[idx.length - 1]).toBe(72);
    expect(idx).toHaveLength(25);
    // mọi bước trong 3 ngày đều = 3h
    for (let i = 1; i < idx.length; i++) expect(idx[i] - idx[i - 1]).toBe(3);
  });

  it("16 ngày: dày ở gần (3h ≤72), thưa dần (6h ≤168, 12h >168) → chặn số khung", () => {
    const idx = stepHourIndices(16, 384);
    // đơn điệu tăng
    for (let i = 1; i < idx.length; i++)
      expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    // bước theo tầm
    const stepAt = (h: number) => {
      const a = idx.indexOf(h);
      return idx[a + 1] - idx[a];
    };
    expect(stepAt(0)).toBe(3); // gần: 3h
    expect(stepAt(72)).toBe(6); // 3–7 ngày: 6h
    expect(stepAt(168)).toBe(12); // >7 ngày: 12h
    // số khung gọn (không phải 128) và không vượt giờ nguồn
    expect(idx.length).toBeLessThan(70);
    expect(idx[idx.length - 1]).toBeLessThanOrEqual(383);
  });

  it("không lấy quá số giờ nguồn thật trả về", () => {
    const idx = stepHourIndices(16, 100); // nguồn chỉ 100 giờ
    expect(idx[idx.length - 1]).toBeLessThanOrEqual(99);
  });

  it("GRID_DAY_OPTIONS = 3/5/7/10/16", () => {
    expect([...GRID_DAY_OPTIONS]).toEqual([3, 5, 7, 10, 16]);
  });
});
