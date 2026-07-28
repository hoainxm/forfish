import { describe, expect, it } from "vitest";
import {
  arrowFeatures,
  gridPoints,
  timeLabelVN,
  stepHourIndices,
  groupTimesByDay,
  scrubDayLabel,
  legendStops,
  legendGradientCss,
  legendUnit,
  GRID_DAY_OPTIONS,
  TIME_STEP_HOURS,
  FORECAST_GRID_HOURS,
  GRID_SNAP_MAX_DEG,
  GRID_SNAP_MAX_LAT_DEG,
  GRID_SNAP_MAX_LON_DEG,
  GRID_STEP_LAT_DEG,
  GRID_STEP_LON_DEG,
  nearestGridCell,
  type ForecastGrid,
} from "../forecast-grid";

describe("gridPoints", () => {
  it("156 điểm (13×12), phủ vùng lớn 98–123°Đ / 1–24°B, không trùng nhau", () => {
    const pts = gridPoints();
    expect(pts).toHaveLength(156);
    for (const p of pts) {
      expect(p.lon).toBeGreaterThanOrEqual(98);
      expect(p.lon).toBeLessThanOrEqual(123);
      expect(p.lat).toBeGreaterThanOrEqual(1);
      expect(p.lat).toBeLessThanOrEqual(24);
    }
    expect(new Set(pts.map((p) => `${p.lat},${p.lon}`)).size).toBe(156);
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

describe("groupTimesByDay (thanh ngày kiểu Windy)", () => {
  it("gom theo ngày lịch, GIỮ chỉ số gốc để seek", () => {
    const times = [
      "2026-06-12T00:00",
      "2026-06-12T03:00",
      "2026-06-12T21:00",
      "2026-06-13T00:00",
      "2026-06-13T06:00",
    ];
    const days = groupTimesByDay(times);
    expect(days.map((d) => d.iso)).toEqual(["2026-06-12", "2026-06-13"]);
    expect(days[0].ticks).toEqual([
      { idx: 0, hour: 0 },
      { idx: 1, hour: 3 },
      { idx: 2, hour: 21 },
    ]);
    expect(days[1].ticks).toEqual([
      { idx: 3, hour: 0 },
      { idx: 4, hour: 6 },
    ]);
  });

  it("mảng rỗng → không ngày nào", () => {
    expect(groupTimesByDay([])).toEqual([]);
  });
});

describe("scrubDayLabel", () => {
  it("hôm nay/mai nói thẳng, xa hơn ra thứ + ngày/tháng", () => {
    expect(scrubDayLabel("2026-06-12", "2026-06-12")).toBe("Hôm nay");
    expect(scrubDayLabel("2026-06-13", "2026-06-12")).toBe("Mai");
    // 2026-06-14 là Chủ nhật
    expect(scrubDayLabel("2026-06-14", "2026-06-12")).toBe("CN 14/6");
    // không có mốc hôm nay → luôn ra thứ + ngày
    expect(scrubDayLabel("2026-06-12")).toBe("Th 6 12/6");
  });
});

describe("thang cường độ (thanh màu)", () => {
  it("legendStops suy đúng cặp (value,color) từ color-expr", () => {
    const wind = legendStops("wind");
    expect(wind[0]).toEqual({ value: 5, color: "#74add1" });
    expect(wind[wind.length - 1]).toEqual({ value: 55, color: "#b71d1d" });
    const wave = legendStops("wave");
    expect(wave[0].value).toBe(0.3);
    expect(wave[wave.length - 1].value).toBe(4.5);
  });

  it("gradient đặt chặng theo TỶ LỆ giá trị thật (0% đầu, 100% cuối)", () => {
    const css = legendGradientCss("wind");
    expect(css.startsWith("linear-gradient(90deg,")).toBe(true);
    expect(css).toContain("#74add1 0%");
    expect(css).toContain("#b71d1d 100%");
  });

  it("đơn vị GIỮ của app: gió km/h, sóng m", () => {
    expect(legendUnit("wind")).toBe("km/h");
    expect(legendUnit("wave")).toBe("m");
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

/* Ô lưới GẦN NHẤT — dùng khi mất sóng, chạm điểm chưa từng mở xem. Ràng buộc
   sống còn: chỉ nhận ô CÒN PHỦ chỗ vừa chạm, không nhận ô cách xa. */
describe("nearestGridCell + GRID_SNAP_MAX_DEG", () => {
  const grid: ForecastGrid = {
    cells: gridPoints().map((p) => ({ lat: p.lat, lon: p.lon, hours: [] })),
    times: [],
  };

  it("ngưỡng snap ≈ NỬA BƯỚC LƯỚI từng chiều (chỉ bù 0,01° làm tròn toạ độ ô)", () => {
    // đúng nửa bước, chỉ được nhỉnh hơn tối đa 0,01° (bù làm tròn toạ độ ô)
    expect(GRID_SNAP_MAX_LAT_DEG).toBeGreaterThan(GRID_STEP_LAT_DEG / 2);
    expect(GRID_SNAP_MAX_LAT_DEG).toBeLessThan(GRID_STEP_LAT_DEG / 2 + 0.01);
    expect(GRID_SNAP_MAX_LON_DEG).toBeGreaterThan(GRID_STEP_LON_DEG / 2);
    expect(GRID_SNAP_MAX_LON_DEG).toBeLessThan(GRID_STEP_LON_DEG / 2 + 0.01);
    expect(GRID_SNAP_MAX_DEG).toBeCloseTo(
      Math.max(GRID_SNAP_MAX_LAT_DEG, GRID_SNAP_MAX_LON_DEG),
      6,
    );
    // lưới thưa ~2°: ngưỡng phải đủ rộng để chạm giữa hai mũi tên vẫn ăn
    expect(GRID_SNAP_MAX_DEG).toBeGreaterThan(1);
  });

  it("phủ KÍN cả vùng lưới — quét dày không chỗ nào thủng", () => {
    for (let lat = 6.0; lat <= 21.3; lat += 0.25) {
      for (let lon = 102.5; lon <= 117.25; lon += 0.25) {
        expect(nearestGridCell(grid, lat, lon)).not.toBeNull();
      }
    }
  });

  it("ra ngoài rìa lưới quá nửa bước → null (không nhận ô rìa cho chỗ xa)", () => {
    // rìa dưới lưới = LAT_MIN 1,0 (đã mở rộng 2026-07-28). Ngay trong rìa còn phủ
    expect(nearestGridCell(grid, 1.0 - GRID_SNAP_MAX_LAT_DEG + 0.05, 110)).not.toBeNull();
    // quá nửa bước ra ngoài → từ chối
    expect(nearestGridCell(grid, 1.0 - GRID_SNAP_MAX_LAT_DEG - 0.05, 110)).toBeNull();
    expect(nearestGridCell(grid, 13, 123 + GRID_SNAP_MAX_LON_DEG + 0.05)).toBeNull();
  });

  it("chạm giữa vùng biển → luôn có ô phủ (mũi tên vẽ tới đâu, chạm được tới đó)", () => {
    for (const p of [
      { lat: 16.5, lon: 112.0 }, // Hoàng Sa
      { lat: 8.68, lon: 106.6 }, // Côn Đảo
      { lat: 10.5, lon: 114.0 }, // Trường Sa
      { lat: 13.0, lon: 110.5 }, // điểm mặc định
    ]) {
      expect(nearestGridCell(grid, p.lat, p.lon)).not.toBeNull();
    }
  });

  it("ngoài vùng lưới (Nhật Bản) → null, KHÔNG nhận ô cách hàng nghìn km", () => {
    expect(nearestGridCell(grid, 35.0, 139.0)).toBeNull();
  });

  it("lưới rỗng → null", () => {
    expect(nearestGridCell({ cells: [], times: [] }, 13, 110)).toBeNull();
  });
});
