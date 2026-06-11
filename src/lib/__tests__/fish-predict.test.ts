import { describe, expect, it } from "vitest";
import {
  buildFishForecast,
  chlFit,
  convergenceStrength,
  frontStrength,
  gradientStrength,
  nearestIndex,
  parseErddapGrid,
  trapezoid,
  SPECIES_META,
  SPECIES_PROFILES,
  type ScalarGrid,
} from "../fish-predict";
import { FISH_SEASONS } from "../../data/fish-seasons";

describe("trapezoid", () => {
  it("0 ngoài dải, 1 trong lõi, dốc ở mép", () => {
    expect(trapezoid(20, 24, 26, 30, 31.5)).toBe(0);
    expect(trapezoid(28, 24, 26, 30, 31.5)).toBe(1);
    expect(trapezoid(25, 24, 26, 30, 31.5)).toBeCloseTo(0.5, 5);
    expect(trapezoid(31, 24, 26, 30, 31.5)).toBeCloseTo(1 / 3, 5);
    expect(trapezoid(NaN, 24, 26, 30, 31.5)).toBe(0);
  });
});

describe("chlFit", () => {
  it("nước trong quá / đục quá đều kém; trong dải thì 1", () => {
    expect(chlFit(0.2, -1.0, 0.0)).toBe(1); // log10(0.2) ≈ -0.7
    expect(chlFit(0.001, -1.0, 0.0)).toBe(0);
    expect(chlFit(0, -1.0, 0.0)).toBe(0);
    expect(chlFit(NaN, -1.0, 0.0)).toBe(0);
  });
});

function grid(values: number[][], lats?: number[], lons?: number[]): ScalarGrid {
  return {
    lats: lats ?? values.map((_, i) => 10 + i * 0.25),
    lons: lons ?? values[0].map((_, j) => 108 + j * 0.25),
    values,
    date: "2026-06-08",
  };
}

describe("frontStrength", () => {
  it("nước đều màu → 0; ranh nóng-lạnh rõ → tiến tới 1", () => {
    const flat = grid([
      [29, 29, 29],
      [29, 29, 29],
      [29, 29, 29],
    ]);
    expect(frontStrength(flat)[1][1]).toBe(0);

    const edge = grid([
      [27, 27, 27],
      [28, 28, 28],
      [29.5, 29.5, 29.5],
    ]);
    // gradient dọc tại hàng giữa = (29.5-27)/2 = 1.25 ≥ 0.5 → kẹp 1
    expect(frontStrength(edge)[1][1]).toBe(1);
  });
});

describe("parseErddapGrid", () => {
  it("đọc bảng SST (Kelvin) và CHL (lat giảm dần, có altitude) về lưới lat tăng", () => {
    const sstJson = {
      table: {
        rows: [
          ["2026-06-08T12:00:00Z", 12.0, 110.0, 302.15],
          ["2026-06-08T12:00:00Z", 12.25, 110.0, 303.15],
        ],
      },
    };
    const g = parseErddapGrid(sstJson, { hasAltitude: false, kelvin: true });
    expect(g.lats).toEqual([12.0, 12.25]);
    expect(g.values[0][0]).toBeCloseTo(29, 5);
    expect(g.values[1][0]).toBeCloseTo(30, 5);
    expect(g.date).toBe("2026-06-08");

    const chlJson = {
      table: {
        rows: [
          ["2026-06-07T12:00:00Z", 0, 12.25, 110.0, 0.3],
          ["2026-06-07T12:00:00Z", 0, 12.0, 110.0, null],
        ],
      },
    };
    const c = parseErddapGrid(chlJson, { hasAltitude: true });
    expect(c.lats).toEqual([12.0, 12.25]); // sắp lại tăng dần
    expect(Number.isNaN(c.values[0][0])).toBe(true); // null → NaN
    expect(c.values[1][0]).toBeCloseTo(0.3, 5);
  });
});

describe("nearestIndex", () => {
  it("tìm đúng chỉ số gần nhất", () => {
    expect(nearestIndex([1, 2, 3], 2.2)).toBe(1);
    expect(nearestIndex([1, 2, 3], 9)).toBe(2);
  });
});

describe("buildFishForecast", () => {
  // ô trong VỊNH BẮC BỘ (20N, 107.5E) — tháng 6 có mực ống/cá nục/cá cơm…
  const lats = [19.75, 20.0, 20.25];
  const lons = [107.0, 107.25, 107.5];
  const warm = grid(
    [
      [27, 27, 29.5],
      [27, 27, 29.5],
      [27, 27, 29.5],
    ],
    lats,
    lons,
  ); // có ranh nhiệt dọc + nhiệt hợp nhiều loài
  const food = grid(
    [
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
    ],
    lats,
    lons,
  );

  it("vùng hợp loài đang vụ → ra ô có điểm + tên loài + điểm theo loài", () => {
    const out = buildFishForecast(warm, food, null, 6);
    expect(out.cells.length).toBeGreaterThan(0);
    const cell = out.cells[0];
    expect(cell.s).toBeGreaterThanOrEqual(35);
    expect(cell.top.length).toBeGreaterThan(0);
    expect(out.date).toBe("2026-06-08");
    // điểm theo loài để lọc trên bản đồ: loài tốt nhất của ô = điểm tổng ô
    expect(cell.sp[cell.top[0]]).toBe(cell.s);
    // danh sách loài cho bộ chọn — có loài, mỗi loài đều xuất hiện trong sp ô nào đó
    expect(out.species.length).toBeGreaterThan(0);
    for (const sp of out.species) {
      expect(out.cells.some((c) => c.sp[sp] != null)).toBe(true);
    }
    // loài đầu danh sách = loài có điểm cao nhất toàn vùng
    const best = Math.max(
      ...out.cells.flatMap((c) => Object.values(c.sp)),
    );
    expect(out.cells.some((c) => c.sp[out.species[0]] === best)).toBe(true);
  });

  it("ô đất liền (SST NaN) và ô ngoài vùng đánh bắt → bỏ", () => {
    const land = grid([[NaN]], [21.0], [105.8]); // Hà Nội
    const out = buildFishForecast(land, grid([[0.5]], [21.0], [105.8]), null, 6);
    expect(out.cells).toHaveLength(0);
  });

  it("nước lạnh ngoài dải mọi loài → không có ô", () => {
    const cold = grid(
      [
        [15, 15, 15],
        [15, 15, 15],
        [15, 15, 15],
      ],
      lats,
      lons,
    );
    const out = buildFishForecast(cold, food, null, 6);
    expect(out.cells).toHaveLength(0);
  });

  it("thêm SSHA (xoáy lạnh, mực nước lõm) → điểm cá nổi nhỏ TĂNG", () => {
    // nền: cá nục (coldCore) hợp nhiệt + mồi vừa, không front
    const flatChl = grid(
      [
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
      ],
      lats,
      lons,
    );
    const noEddy = buildFishForecast(warm, flatChl, null, 6);
    // SSHA lõm mạnh (nước trồi lạnh) cùng lưới
    const coldSsha = grid(
      [
        [-0.15, -0.15, -0.15],
        [-0.15, -0.15, -0.15],
        [-0.15, -0.15, -0.15],
      ],
      lats,
      lons,
    );
    const withEddy = buildFishForecast(warm, flatChl, coldSsha, 6);
    const nucNo = noEddy.cells.find((c) => c.sp["cá nục"])?.sp["cá nục"] ?? 0;
    const nucYes = withEddy.cells.find((c) => c.sp["cá nục"])?.sp["cá nục"] ?? 0;
    expect(nucYes).toBeGreaterThan(nucNo);
  });

  it("dị thường nhiệt ÂM (nước trồi) → điểm cá nổi nhỏ TĂNG", () => {
    const flatChl = grid(
      [
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
      ],
      lats,
      lons,
    );
    const base = buildFishForecast(warm, flatChl, null, 6);
    const coldAnom = grid(
      [
        [-1.5, -1.5, -1.5],
        [-1.5, -1.5, -1.5],
        [-1.5, -1.5, -1.5],
      ],
      lats,
      lons,
    );
    const withUpw = buildFishForecast(warm, flatChl, null, 6, {
      anom: coldAnom,
    });
    const no = base.cells.find((c) => c.sp["cá cơm"])?.sp["cá cơm"] ?? 0;
    const yes = withUpw.cells.find((c) => c.sp["cá cơm"])?.sp["cá cơm"] ?? 0;
    expect(yes).toBeGreaterThan(no);
  });

  it("dòng chảy HỘI TỤ → điểm tăng so với không có dữ liệu dòng", () => {
    const flatChl = grid(
      [
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
        [0.3, 0.3, 0.3],
      ],
      lats,
      lons,
    );
    const base = buildFishForecast(warm, flatChl, null, 6);
    // nước dồn vào cột giữa (u đổi dấu), v đứng yên
    const u = grid(
      [
        [0.15, 0, -0.15],
        [0.15, 0, -0.15],
        [0.15, 0, -0.15],
      ],
      lats,
      lons,
    );
    const v = grid(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      lats,
      lons,
    );
    const withConv = buildFishForecast(warm, flatChl, null, 6, {
      cur: { u, v },
    });
    const cellNo = base.cells.find((c) => c.lon === 107.25);
    const cellYes = withConv.cells.find((c) => c.lon === 107.25);
    expect(cellYes?.s ?? 0).toBeGreaterThan(cellNo?.s ?? 0);
  });
});

describe("convergenceStrength", () => {
  it("dòng đều → 0; nước dồn vào → 1; toả ra (phân kỳ) → 0", () => {
    const same = [
      [0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2],
      [0.2, 0.2, 0.2],
    ];
    expect(convergenceStrength(same, same, 0.1)[1][1]).toBe(0);

    // u: chảy sang đông bên trái, sang tây bên phải → dồn vào cột giữa
    const uIn = [
      [0.15, 0, -0.15],
      [0.15, 0, -0.15],
      [0.15, 0, -0.15],
    ];
    const vZero = uIn.map((r) => r.map(() => 0));
    // du/dx = (-0.15-0.15)/2 = -0.15 → hội tụ 0.15/0.1 kẹp 1
    expect(convergenceStrength(uIn, vZero, 0.1)[1][1]).toBe(1);

    // đảo chiều = phân kỳ (nước toả ra) → 0, không phạt nhưng không thưởng
    const uOut = uIn.map((r) => r.map((x) => -x));
    expect(convergenceStrength(uOut, vZero, 0.1)[1][1]).toBe(0);
  });
});

describe("gradientStrength", () => {
  it("đều màu → 0; chênh mạnh ≥ full → kẹp 1; full khác nhau cho lớp khác nhau", () => {
    const flat = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    expect(gradientStrength(flat, 0.5)[1][1]).toBe(0);
    const ramp = [
      [0, 0, 0],
      [0.5, 0.5, 0.5],
      [1.2, 1.2, 1.2],
    ];
    // gradient dọc giữa = (1.2-0)/2 = 0.6 ≥ full 0.25 → 1
    expect(gradientStrength(ramp, 0.25)[1][1]).toBe(1);
  });
});

describe("SPECIES_PROFILES khớp FISH_SEASONS", () => {
  it("mọi loài trong mùa vụ đều có khẩu vị (không loài nào bị bỏ rơi)", () => {
    const names = new Set(SPECIES_PROFILES.map((p) => p.species));
    for (const f of FISH_SEASONS) {
      expect(names.has(f.species), `thiếu profile: ${f.species}`).toBe(true);
    }
  });
  it("mọi loài có khẩu vị đều có mùa vụ (không loài nào ẩn khỏi dự báo)", () => {
    const seasons = new Set(FISH_SEASONS.map((f) => f.species));
    for (const p of SPECIES_PROFILES) {
      expect(seasons.has(p.species), `thiếu mùa vụ: ${p.species}`).toBe(true);
    }
  });
  it("đủ rộng (~90% loài bà con đánh) + có nhóm cả 6 loại", () => {
    expect(SPECIES_PROFILES.length).toBeGreaterThanOrEqual(36);
    const cats = new Set(SPECIES_PROFILES.map((p) => p.category));
    expect(cats.size).toBe(6);
  });
  it("SPECIES_META có màu hợp lệ + tên đủ cho mọi loài", () => {
    for (const p of SPECIES_PROFILES) {
      const m = SPECIES_META[p.short];
      expect(m, `thiếu meta: ${p.short}`).toBeTruthy();
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.full).toBe(p.species);
    }
  });
});

describe("trung thực: loài đáy không vẽ điểm nóng giả", () => {
  const lats = [19.75, 20.0, 20.25];
  const lons = [107.0, 107.25, 107.5];
  const warm = grid(
    [
      [27, 27, 29.5],
      [27, 27, 29.5],
      [27, 27, 29.5],
    ],
    lats,
    lons,
  );
  const food = grid(
    [
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
    ],
    lats,
    lons,
  );
  it("điểm 'Mọi loài' (s) chỉ đến từ loài định vị được (không phải loài đáy/rạn)", () => {
    const out = buildFishForecast(warm, food, null, 6);
    const lowShorts = new Set(
      SPECIES_PROFILES.filter((p) => p.surfaceSignal === "low").map((p) => p.short),
    );
    for (const c of out.cells) {
      if (c.s >= 35) {
        // s phải trùng điểm của một loài KHÔNG-low trong ô
        const ok = Object.entries(c.sp).some(
          ([sh, v]) => v === c.s && !lowShorts.has(sh),
        );
        expect(ok, `ô ${c.lat},${c.lon} s=${c.s} không khớp loài nổi`).toBe(true);
      }
    }
  });
});
