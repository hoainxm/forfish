import { describe, expect, it } from "vitest";
import {
  arrowFeatures,
  gridPoints,
  timeLabelVN,
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
