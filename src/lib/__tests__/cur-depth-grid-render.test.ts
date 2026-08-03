import { describe, expect, it } from "vitest";

import { curDepthPoints } from "../copernicus-cur-depth";
import {
  GRID_BOUNDS_DEG,
  GRID_N_LAT,
  GRID_N_LON,
  arrowFeatures,
  arrowStep,
  type GridCell,
} from "../forecast-grid";
import { buildValueTexture, nearestValueFill } from "../scalar-gl";
import type { ScalarGrid } from "../scalar-field";

/*  CỔNG CHO LỖI "LỚP DÒNG CHẢY RENDER THIẾU, BỊ Ô Ô" (2026-08-03).

    Ba mảnh làm nên bàn cờ ô vuông trên máy thật, mỗi mảnh một cổng:
     (1) lưới 13×12 quá thô — ô ≈190×230 km, mà tầng 50 m có 83/156 ô KHÔNG có số
         (đáy nông hơn tầng) ⇒ mỗi lỗ to bằng cả ngư trường;
     (2) ô null mang giá trị 0 = ĐẦU THANG MÀU ⇒ GPU nội suy kéo màu quanh lỗ tụt
         về nhạt;
     (3) mũi tên vẽ mỗi ô một cái ⇒ lưới dày lên là rối màn hình. */

describe("curDepthPoints — lưới riêng, dày hơn, ĐÚNG KHUNG lưới chung", () => {
  it("25×23 = 575 điểm (dày gấp đôi mỗi chiều so với 13×12)", () => {
    expect(curDepthPoints()).toHaveLength(575);
    expect(GRID_N_LON * GRID_N_LAT).toBe(156);
  });

  it("bốn góc TRÙNG khung lưới chung — lệch khung là lệch cả lớp màu", () => {
    const pts = curDepthPoints();
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(first.lat).toBeCloseTo(GRID_BOUNDS_DEG.latMin, 6);
    expect(first.lon).toBeCloseTo(GRID_BOUNDS_DEG.lonMin, 6);
    expect(last.lat).toBeCloseTo(GRID_BOUNDS_DEG.latMax, 6);
    expect(last.lon).toBeCloseTo(GRID_BOUNDS_DEG.lonMax, 6);
  });

  it("xếp row-major: một hàng cùng lat, lat/lon tăng dần, không trùng điểm", () => {
    const pts = curDepthPoints();
    const nLon = pts.filter((p) => p.lat === pts[0].lat).length;
    expect(nLon).toBe(25);
    expect(pts[1].lon).toBeGreaterThan(pts[0].lon);
    expect(pts[nLon].lat).toBeGreaterThan(pts[0].lat);
    expect(new Set(pts.map((p) => `${p.lat},${p.lon}`)).size).toBe(pts.length);
  });

  it("bước lưới ~1° — nhỏ hơn hẳn bước ~2° của lưới chung", () => {
    const pts = curDepthPoints();
    expect(pts[1].lon - pts[0].lon).toBeLessThan(1.1);
    expect(pts[25].lat - pts[0].lat).toBeLessThan(1.1);
  });
});

describe("nearestValueFill — ô null vẫn phải mang số đọc được", () => {
  it("lấy số của ô CÓ SỐ gần nhất, không đụng ô đang có số", () => {
    // 1×3: [5, null, null] → [5, 5, 5]
    expect(nearestValueFill([5, null, null], 1, 3)).toEqual([5, 5, 5]);
  });

  it("lan theo khoảng cách ô (BFS), không phải theo thứ tự mảng", () => {
    // 1×3: [1, null, 9] → ô giữa nhận số của ô TRÁI (vào hàng đợi trước, cùng cự ly)
    const out = nearestValueFill([1, null, 9], 1, 3);
    expect(out[0]).toBe(1);
    expect(out[2]).toBe(9);
    expect(out[1]).not.toBeNull();
  });

  it("lưới TRỐNG HẲN → trả nguyên bản, không ném", () => {
    expect(nearestValueFill([null, null], 1, 2)).toEqual([null, null]);
  });

  it("lưới ĐẦY → không đổi gì", () => {
    expect(nearestValueFill([1, 2, 3, 4], 2, 2)).toEqual([1, 2, 3, 4]);
  });
});

describe("buildValueTexture — cờ hợp lệ vẫn theo lưới GỐC", () => {
  const grid = (values: (number | null)[]): ScalarGrid => ({
    kind: "currentspeed",
    times: ["2026-08-03T12:00"],
    nLat: 1,
    nLon: 3,
    noFill: true, // tầng sâu: vùng nông phải TRỐNG THẬT, cấm lan màu
    cells: values.map((v, i) => ({ lat: 10, lon: 100 + i, values: [v] })),
  });

  it("ô null: cờ = 0 (KHÔNG vẽ) nhưng giá trị KHÔNG còn là 0 đầu thang", () => {
    const tex = buildValueTexture(grid([3, null, null]), 0)!;
    expect(tex).not.toBeNull();
    // ô 0 có số → cờ 255; ô 1,2 null → cờ 0
    expect(tex.data[1]).toBe(255);
    expect(tex.data[4 + 1]).toBe(0);
    expect(tex.data[8 + 1]).toBe(0);
    // …nhưng kênh giá trị của ô null nay MANG SỐ CỦA Ô BÊN CẠNH (hết kéo màu
    // quanh lỗ tụt về đầu thang)
    expect(tex.data[4]).toBe(tex.data[0]);
    expect(tex.data[8]).toBe(tex.data[0]);
  });

  it("lưới sai kích thước → null (không dựng texture rác)", () => {
    const g = grid([1, 2, 3]);
    expect(buildValueTexture({ ...g, nLon: 4 }, 0)).toBeNull();
  });
});

describe("arrowStep / arrowFeatures — mũi tên giữ mật độ cũ khi lưới dày lên", () => {
  const cells = (nLat: number, nLon: number): GridCell[] => {
    const out: GridCell[] = [];
    for (let i = 0; i < nLat; i++)
      for (let j = 0; j < nLon; j++)
        out.push({
          lat: i,
          lon: j,
          hours: [{ curKmh: 2, curDirDeg: 90 }],
        });
    return out;
  };

  it("lưới chung 13×12 → bước 1, vẽ hết (không đổi hành vi cũ)", () => {
    const s = arrowStep(cells(GRID_N_LAT, GRID_N_LON));
    expect(s.lon).toBe(1);
    expect(s.lat).toBe(1);
    const fc = arrowFeatures(
      { cells: cells(GRID_N_LAT, GRID_N_LON), times: ["t"] },
      0,
      "current",
    );
    expect(fc.features).toHaveLength(156);
  });

  it("lưới dày 23×25 → bước 2, số mũi tên về lại cỡ lưới chung", () => {
    const s = arrowStep(cells(23, 25));
    expect(s.lon).toBe(2);
    expect(s.lat).toBe(2);
    const fc = arrowFeatures({ cells: cells(23, 25), times: ["t"] }, 0, "current");
    // 13 cột × 12 hàng lấy được từ 25×23
    expect(fc.features).toHaveLength(13 * 12);
  });

  it("lưới không suy được kích thước → bước 1, vẽ hết (đừng nuốt mũi tên)", () => {
    const l = [
      { lat: 1, lon: 1, hours: [{ curKmh: 1, curDirDeg: 0 }] },
      { lat: 2, lon: 2, hours: [{ curKmh: 1, curDirDeg: 0 }] },
      { lat: 3, lon: 3, hours: [{ curKmh: 1, curDirDeg: 0 }] },
    ];
    expect(arrowStep(l).lon).toBe(1);
    expect(arrowFeatures({ cells: l, times: ["t"] }, 0, "current").features).toHaveLength(3);
  });

  it("ô VẮNG khoá gió/sóng (payload gọn của dòng chảy tầng) vẫn ra mũi tên", () => {
    const fc = arrowFeatures(
      {
        cells: [{ lat: 10, lon: 110, hours: [{ curKmh: 3, curDirDeg: 45 }] }],
        times: ["t"],
      },
      0,
      "current",
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties).toEqual({ v: 3 });
  });

  it("ô RỖNG `{}` (không có số) → bỏ qua, không vẽ mũi tên câm", () => {
    const fc = arrowFeatures(
      { cells: [{ lat: 10, lon: 110, hours: [{}] }], times: ["t"] },
      0,
      "current",
    );
    expect(fc.features).toHaveLength(0);
  });
});
