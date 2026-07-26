import { describe, expect, it } from "vitest";
import {
  buildFishForecast,
  chlFit,
  convergenceStrength,
  deepWaterFit,
  frontStrength,
  gradientStrength,
  gridStepDeg,
  nearestIndex,
  parseBathyGrid,
  parseErddapGrid,
  percentileRank,
  softOrHabitat,
  spatialAnomaly,
  speciesWMax,
  trapezoid,
  CONV_FULL_PER_DEG,
  DEPTH_UNKNOWN_FIT,
  SPECIES_META,
  SPECIES_PROFILES,
  thermoFit,
  type ScalarGrid,
} from "../fish-predict";
import {
  FISH_SEASONS,
  nearestRegionWithin,
  regionAt,
} from "../../data/fish-seasons";

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
    // ô có loài ĐỊNH VỊ được (cột front nhiệt mạnh) — soft-OR: cần cơ chế thật
    const cell = out.cells.find((c) => c.top.length > 0);
    expect(cell).toBeTruthy();
    expect(cell!.s).toBeGreaterThanOrEqual(35);
    expect(out.date).toBe("2026-06-08");
    // điểm theo loài để lọc trên bản đồ: loài tốt nhất của ô = điểm tổng ô
    expect(cell!.sp[cell!.top[0]]).toBe(cell!.s);
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

  it("ô đất liền (SST NaN) → bỏ", () => {
    const land = grid([[NaN]], [21.0], [105.8]); // Hà Nội
    const out = buildFishForecast(land, grid([[0.5]], [21.0], [105.8]), null, 6);
    expect(out.cells).toHaveLength(0);
  });

  it("TÍNH TOÀN VÙNG: ô biển NGOÀI 7 đa giác khoanh sẵn vẫn ra dự báo", () => {
    // (8.5°N, 110°E) — biển Đông Nam Bộ ngoài khơi, KHÔNG nằm trong đa giác
    // nào (lon 110 > rìa đông dong-nam-bo 109.6, < rìa tây truong-sa 111.2).
    // Trước đây regionAt → null → bỏ trắng. Nay gán vùng gần nhất → có dự báo.
    const gapLats = [8.25, 8.5, 8.75];
    const gapLons = [109.75, 110.0, 110.25];
    const warmGap = grid(
      [
        [28, 28, 29.5],
        [28, 28, 29.5],
        [28, 28, 29.5],
      ],
      gapLats,
      gapLons,
    );
    const foodGap = grid(
      [
        [0.4, 0.4, 0.4],
        [0.4, 0.4, 0.4],
        [0.4, 0.4, 0.4],
      ],
      gapLats,
      gapLons,
    );
    const out = buildFishForecast(warmGap, foodGap, null, 6);
    expect(out.cells.length).toBeGreaterThan(0);
  });

  it("ô biển XA HẲN mọi vùng (nước ngoài) → bỏ", () => {
    // (20°N, 112°E) — đông bắc, xa >2° mọi đa giác VN
    const far = grid([[28]], [20.0], [112.0]);
    const out = buildFishForecast(far, grid([[0.4]], [20.0], [112.0]), null, 6);
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

  it("SSHA lõm CỤC BỘ (thấp hơn vùng bên cạnh) → điểm cá nổi nhỏ TĂNG", () => {
    // VIỆC 2: chỉ mực nước THẤP HƠN LÂN CẬN mới là xoáy/nước trồi cục bộ. Ô
    // giữa (lon 107.25) lõm so 8 ô quanh → coldStrength cao ở đúng ô đó.
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
    const dipSsha = grid(
      [
        [0.0, 0.0, 0.0],
        [0.0, -0.2, 0.0],
        [0.0, 0.0, 0.0],
      ],
      lats,
      lons,
    );
    const withEddy = buildFishForecast(warm, flatChl, dipSsha, 6);
    const bestNuc = (o: ReturnType<typeof buildFishForecast>) =>
      Math.max(0, ...o.cells.map((c) => c.sp["cá nục"] ?? 0));
    expect(bestNuc(withEddy)).toBeGreaterThan(bestNuc(noEddy));
  });

  it("SSHA lõm ĐỒNG LOẠT cả vùng (mùa cả bồn) → KHÔNG đổi điểm (Việc 2)", () => {
    // nền cả-vùng thấp đều = tín hiệu mùa steric, KHÔNG phải xoáy cục bộ → bỏ.
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
    const uniformLow = grid(
      [
        [-0.15, -0.15, -0.15],
        [-0.15, -0.15, -0.15],
        [-0.15, -0.15, -0.15],
      ],
      lats,
      lons,
    );
    const withUniform = buildFishForecast(warm, flatChl, uniformLow, 6);
    const bestNuc = (o: ReturnType<typeof buildFishForecast>) =>
      Math.max(0, ...o.cells.map((c) => c.sp["cá nục"] ?? 0));
    expect(bestNuc(withUniform)).toBe(bestNuc(noEddy));
  });

  it("dị thường nhiệt ÂM CỤC BỘ (nước trồi lạnh hơn lân cận) → điểm TĂNG", () => {
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
    const dipAnom = grid(
      [
        [0.0, 0.0, 0.0],
        [0.0, -1.5, 0.0],
        [0.0, 0.0, 0.0],
      ],
      lats,
      lons,
    );
    const withUpw = buildFishForecast(warm, flatChl, null, 6, {
      anom: dipAnom,
    });
    const bestCom = (o: ReturnType<typeof buildFishForecast>) =>
      Math.max(0, ...o.cells.map((c) => c.sp["cá cơm"] ?? 0));
    expect(bestCom(withUpw)).toBeGreaterThan(bestCom(base));
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

describe("gridStepDeg + CONV_FULL_PER_DEG — hội tụ KHÔNG lệ thuộc bước lưới", () => {
  it("bước lưới suy từ trục; trục hỏng/quá ngắn → fallback", () => {
    expect(gridStepDeg([5, 5.25, 5.5])).toBeCloseTo(0.25, 10);
    expect(gridStepDeg([5, 5 + 1 / 12])).toBeCloseTo(1 / 12, 10);
    expect(gridStepDeg([5])).toBe(0.25); // <2 điểm → mặc định
    expect(gridStepDeg([5, 5])).toBe(0.25); // bước 0 → mặc định
    expect(gridStepDeg([5], 0.5)).toBe(0.5);
  });

  it("CÙNG một dòng chảy, hai bước lưới khác nhau → CÙNG điểm hội tụ", () => {
    // dòng dồn vào cột giữa với gradient VẬT LÝ 0.6 m/s trên MỘT ĐỘ:
    // lưới 0.25° → chênh 0.15 m/s mỗi ô; lưới 1/12° → chênh 0.05 m/s mỗi ô.
    const build = (perCell: number) => {
      const u = [
        [perCell, 0, -perCell],
        [perCell, 0, -perCell],
        [perCell, 0, -perCell],
      ];
      return { u, v: u.map((r) => r.map(() => 0)) };
    };
    const coarse = build(0.15); // 0.25°
    const fine = build(0.05); // 1/12°
    const sCoarse = convergenceStrength(
      coarse.u,
      coarse.v,
      CONV_FULL_PER_DEG * gridStepDeg([5, 5.25]),
    )[1][1];
    const sFine = convergenceStrength(
      fine.u,
      fine.v,
      CONV_FULL_PER_DEG * gridStepDeg([5, 5 + 1 / 12]),
    )[1][1];
    expect(sFine).toBeCloseTo(sCoarse, 6);
    // …và đó là giá trị THẬT, không phải 0 hay kẹp 1 (0.6 / 0.8 = 0.75)
    expect(sCoarse).toBeCloseTo(0.75, 6);
  });

  it("hằng đã HIỆU CHỈNH LẠI cho dòng TỔNG Copernicus, không giữ mức nhiễu cũ", () => {
    // hằng CŨ 0.1 "mỗi ô 0.25°" = 0.4/độ — đặt khi conv còn chấm NHIỄU địa chuyển
    expect(CONV_FULL_PER_DEG).toBeGreaterThan(0.4);
    expect(CONV_FULL_PER_DEG).toBe(0.8);
  });
});

describe("thermoFit (dị thường KHÔNG GIAN của D20)", () => {
  it("dải MẶC ĐỊNH [-4,-23]: nêm NÔNG hơn lân cận mới được điểm", () => {
    expect(thermoFit(-23)).toBe(1); // nông hơn 23 m → hợp hẳn
    expect(thermoFit(-40)).toBe(1); // nông hơn nữa vẫn 1 (kẹp)
    expect(thermoFit(-4)).toBe(0); // lệch chưa tới trung vị → chưa tính
    expect(thermoFit(-13.5)).toBeCloseTo(0.5, 5);
    expect(thermoFit(0)).toBe(0);
    expect(thermoFit(12)).toBe(0); // nêm SÂU hơn: sai khẩu vị mặc định
    expect(thermoFit(NaN)).toBe(0);
  });

  it("dải NGƯỢC DẤU (cá ngừ mắt to [4,12]): ưa nêm SÂU hơn lân cận", () => {
    expect(thermoFit(12, [4, 12])).toBe(1);
    expect(thermoFit(30, [4, 12])).toBe(1);
    expect(thermoFit(4, [4, 12])).toBe(0);
    expect(thermoFit(8, [4, 12])).toBeCloseTo(0.5, 5);
    expect(thermoFit(-20, [4, 12])).toBe(0); // nêm nông: sai khẩu vị mắt to
  });

  it("BẤT BIẾN chống lỗi cũ: D20 ĐỒNG ĐỀU (dị thường 0) KHÔNG cho điểm", () => {
    // Đây chính là lỗi đã sửa: D20 tuyệt đối ở Biển Đông gần như đồng đều nên
    // cổng tuyệt đối cũ trả ≈1 KHẮP NƠI → yếu tố luôn bật, không xếp hạng được.
    expect(thermoFit(0)).toBe(0);
    expect(thermoFit(0, [4, 12])).toBe(0);
  });

  it("hai loài khẩu vị NGƯỢC NHAU không bao giờ cùng đạt 1 tại một ô", () => {
    for (const d of [-30, -10, 0, 10, 30]) {
      const yellowfin = thermoFit(d); // mặc định — ưa nêm nông
      const bigeye = thermoFit(d, [4, 12]); // ưa nêm sâu
      expect(Math.min(yellowfin, bigeye)).toBe(0);
    }
  });
});

describe("thermoBand theo loài (hồ sơ SPECIES_PROFILES)", () => {
  const find = (short: string) => SPECIES_PROFILES.find((p) => p.short === short)!;

  it("ngừ mắt to khai dải DƯƠNG; ngừ vây vàng dùng mặc định (ÂM)", () => {
    expect(find("ngừ mắt to").thermoBand).toEqual([4, 12]);
    expect(find("ngừ vây vàng").thermoBand).toBeUndefined();
  });

  it("mọi thermoBand khai báo đều CÙNG DẤU hai đầu và hướng ra xa 0", () => {
    for (const p of SPECIES_PROFILES) {
      if (!p.thermoBand) continue;
      const [a, b] = p.thermoBand;
      expect(a).not.toBe(b);
      expect(Math.sign(a)).toBe(Math.sign(b));
      expect(Math.abs(b)).toBeGreaterThan(Math.abs(a));
    }
  });

  it("loài khai thermoBand thì phải CÓ trọng số w.thermo (nếu không dải vô nghĩa)", () => {
    for (const p of SPECIES_PROFILES)
      if (p.thermoBand) expect(p.w.thermo ?? 0).toBeGreaterThan(0);
  });
});

describe("tầng nhiệt HYCOM tăng điểm cá ngừ", () => {
  // ngoài khơi Nam Trung Bộ, tháng 6 — cá ngừ vây vàng đang vụ
  const tlats = [11.5, 11.75, 12.0];
  const tlons = [110.0, 110.25, 110.5];
  const warmOff = grid(
    [
      [28, 28, 28],
      [28, 28, 28],
      [28, 28, 28],
    ],
    tlats,
    tlons,
  );
  const clearChl = grid(
    [
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1],
    ],
    tlats,
    tlons,
  );
  // nước sâu 2500 m: giữ CỔNG ĐỘ SÂU mở hết (×1) để test cô lập ĐÚNG tác dụng
  // của tầng nhiệt — thiếu lưới độ sâu thì loài xa bờ bị nhân DEPTH_UNKNOWN_FIT
  const deepGrid = grid(
    [
      [2500, 2500, 2500],
      [2500, 2500, 2500],
      [2500, 2500, 2500],
    ],
    tlats,
    tlons,
  );
  // NÊM NHIỆT NHÔ (dome) ở ô GIỮA: D20 90 m giữa vùng 120 m → dị thường không
  // gian −30 m ⇒ thermoFit = 1 cho loài ưa nêm nông. Lưới ĐỒNG ĐỀU không còn
  // tác dụng (đó chính là lỗi vừa sửa) nên test phải có CẤU TRÚC.
  const domeD20 = grid(
    [
      [120, 120, 120],
      [120, 90, 120],
      [120, 120, 120],
    ],
    tlats,
    tlons,
  );
  const yellowfinAt = (
    f: ReturnType<typeof buildFishForecast>,
    lat: number,
    lon: number,
  ) => f.cells.find((c) => c.lat === lat && c.lon === lon)?.sp["ngừ vây vàng"] ?? 0;

  it("nêm nhiệt NHÔ hơn lân cận → điểm 'ngừ vây vàng' cao hơn khi KHÔNG có tầng nhiệt", () => {
    const base = buildFishForecast(warmOff, clearChl, null, 6, {
      depth: deepGrid,
    });
    const withT = buildFishForecast(warmOff, clearChl, null, 6, {
      thermo: domeD20,
      depth: deepGrid,
    });
    const no = yellowfinAt(base, 11.75, 110.25);
    const yes = yellowfinAt(withT, 11.75, 110.25);
    expect(yes).toBeGreaterThan(no);
    // tầng nhiệt là MỘT cơ chế trong soft-OR (scale 0.4) → đủ đưa ngừ vào payload
    // (≥ KEEP_MIN 25); muốn cao hơn cần nhiều cơ chế cộng hưởng (front+xoáy+thermo)
    expect(yes).toBeGreaterThanOrEqual(25);
  });

  it("D20 ĐỒNG ĐỀU (không cấu trúc) KHÔNG làm điểm tăng — chống lỗi 'luôn bật'", () => {
    const flat = grid(
      [
        [120, 120, 120],
        [120, 120, 120],
        [120, 120, 120],
      ],
      tlats,
      tlons,
    );
    const base = buildFishForecast(warmOff, clearChl, null, 6, {
      depth: deepGrid,
    });
    const withFlat = buildFishForecast(warmOff, clearChl, null, 6, {
      thermo: flat,
      depth: deepGrid,
    });
    expect(yellowfinAt(withFlat, 11.75, 110.25)).toBe(
      yellowfinAt(base, 11.75, 110.25),
    );
  });

  it("cùng ô: nêm NHÔ có lợi cho vây vàng, nêm CHÌM có lợi cho mắt to (khẩu vị ngược nhau)", () => {
    const sink = grid(
      [
        [120, 120, 120],
        [120, 150, 120],
        [120, 120, 120],
      ],
      tlats,
      tlons,
    );
    const at = (g: ScalarGrid, short: string) =>
      buildFishForecast(warmOff, clearChl, null, 6, {
        thermo: g,
        depth: deepGrid,
      }).cells.find((c) => c.lat === 11.75 && c.lon === 110.25)?.sp[short] ?? 0;
    expect(at(domeD20, "ngừ vây vàng")).toBeGreaterThan(
      at(sink, "ngừ vây vàng"),
    );
    expect(at(sink, "ngừ mắt to")).toBeGreaterThan(at(domeD20, "ngừ mắt to"));
  });
});

describe("deepWaterFit (cổng độ sâu loài xa bờ)", () => {
  it("nông <a → 0, sâu ≥b → 1, dốc tuyến tính ở giữa", () => {
    expect(deepWaterFit(30, 50, 200)).toBe(0);
    expect(deepWaterFit(50, 50, 200)).toBe(0);
    expect(deepWaterFit(125, 50, 200)).toBeCloseTo(0.5, 5);
    expect(deepWaterFit(200, 50, 200)).toBe(1);
    expect(deepWaterFit(2000, 50, 200)).toBe(1);
  });
  it("KHÔNG BIẾT độ sâu (NaN) → hệ số trung tính <1, KHÔNG thưởng đủ như ô đã chứng minh là sâu", () => {
    // hành vi CŨ trả 1 = mất lưới độ sâu lại LÀM ĐIỂM TĂNG (ô cạn ×0 → ×1)
    expect(deepWaterFit(NaN, 50, 200)).toBe(DEPTH_UNKNOWN_FIT);
    expect(DEPTH_UNKNOWN_FIT).toBeGreaterThan(0); // không xoá hẳn loài
    expect(DEPTH_UNKNOWN_FIT).toBeLessThan(1); // không thưởng oan
  });
});

describe("softOrHabitat (soft-OR tổ hợp cơ chế)", () => {
  it("terms rỗng → 0", () => {
    expect(softOrHabitat([], 0.5)).toBe(0);
  });
  it("mọi trọng số ≤ 0 → 0 (không có cơ chế nào)", () => {
    expect(softOrHabitat([[0, 1], [0, 1]], 0.5)).toBe(0);
  });
  it("một cơ chế MẠNH (x=1) ở trọng số lớn nhất → đạt đúng `scale`", () => {
    // wMax term x=1: 1 - (1 - scale·1·1) = scale
    expect(softOrHabitat([[0.3, 1]], 0.4)).toBeCloseTo(0.4, 10);
    expect(softOrHabitat([[0.3, 1], [0.1, 0]], 0.4)).toBeCloseTo(0.4, 10);
  });
  it("KHÔNG bị nén: 1 cơ chế mạnh + nhiều cơ chế yếu vẫn SÁNG (khác TB cộng)", () => {
    // TB cộng của {1,0,0,0} với trọng số đều ≈ 0.25; soft-OR giữ cao hơn hẳn
    const terms: [number, number][] = [[0.3, 1], [0.3, 0], [0.3, 0], [0.3, 0]];
    const so = softOrHabitat(terms, 0.4);
    expect(so).toBeCloseTo(0.4, 10); // chỉ term mạnh quyết
    expect(so).toBeGreaterThan(0.25);
  });
  it("đối xứng theo trọng số: đổi chỗ (w,x) không đổi kết quả", () => {
    const a = softOrHabitat([[0.3, 0.5], [0.1, 0.8]], 0.5);
    const b = softOrHabitat([[0.1, 0.8], [0.3, 0.5]], 0.5);
    expect(a).toBeCloseTo(b, 12);
  });
  it("nhiều cơ chế cùng mạnh → cộng hưởng cao hơn một cơ chế", () => {
    const one = softOrHabitat([[0.3, 1]], 0.4);
    const many = softOrHabitat([[0.3, 1], [0.3, 1], [0.3, 1]], 0.4);
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThanOrEqual(1);
  });
  it("x ngoài [0,1] / NaN → kẹp (không phá kết quả)", () => {
    expect(softOrHabitat([[0.3, 2]], 0.4)).toBeCloseTo(0.4, 10); // kẹp về 1
    expect(softOrHabitat([[0.3, NaN]], 0.4)).toBe(0); // NaN → 0
  });
});

describe("softOrHabitat — wMax CỐ ĐỊNH: nguồn hỏng KHÔNG được làm điểm tăng", () => {
  it("wMax truyền vào thay cho suy-từ-terms; bỏ term có trọng số LỚN NHẤT → điểm GIẢM", () => {
    const full: [number, number][] = [
      [0.5, 0], // cơ chế nặng nhất nhưng hôm nay x=0 (vd D20 không hợp)
      [0.3, 0.8],
      [0.1, 0.5],
    ];
    const W = 0.5;
    const withHeavy = softOrHabitat(full, 0.4, W);
    // nguồn của term nặng CHẾT → term biến khỏi mảng
    const broken = full.slice(1);
    expect(softOrHabitat(broken, 0.4, W)).toBeLessThanOrEqual(withHeavy);
    // hành vi CŨ (tự suy wMax) TĂNG điểm — đây chính là lỗi đã sửa
    expect(softOrHabitat(broken, 0.4)).toBeGreaterThan(withHeavy);
  });
  it("MONOTONIC: bỏ dần từng term (wMax cố định) → agg không bao giờ tăng", () => {
    const terms: [number, number][] = [
      [0.35, 0.6],
      [0.5, 0.2],
      [0.15, 0.9],
      [0.25, 0.4],
      [0.3, 0.75],
    ];
    const W = 0.5;
    let prev = softOrHabitat(terms, 0.4, W);
    for (let k = terms.length - 1; k >= 0; k--) {
      const kept = terms.slice(0, k);
      const now = softOrHabitat(kept, 0.4, W);
      expect(now).toBeLessThanOrEqual(prev + 1e-12);
      prev = now;
    }
    expect(prev).toBe(0); // hết term → 0
  });
  it("wMax cố định = wMax suy-ra khi ĐỦ NGUỒN (không đổi hành vi ngày lành)", () => {
    const terms: [number, number][] = [[0.5, 0.4], [0.3, 0.9], [0.2, 0.1]];
    expect(softOrHabitat(terms, 0.4, 0.5)).toBeCloseTo(
      softOrHabitat(terms, 0.4),
      12,
    );
  });
  it("wMax nhỏ hơn một trọng số lẻ → kẹp tỷ lệ, kết quả vẫn trong [0,1]", () => {
    const v = softOrHabitat([[0.9, 1]], 0.4, 0.3);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe("speciesWMax (mốc chuẩn hoá theo HỒ SƠ loài)", () => {
  it("lấy max các cơ chế KHAI BÁO, KHÔNG tính w.food (mồi là giới hạn mềm)", () => {
    expect(
      speciesWMax({
        food: 0.9,
        thermFront: 0.3,
        chlFront: 0.15,
        eddy: 0.35,
        upw: 0.05,
        conv: 0.15,
        thermo: 0.5,
      }),
    ).toBe(0.5);
    // thermo vắng mặt = 0
    expect(
      speciesWMax({ food: 0.8, thermFront: 0.6, chlFront: 0.65, eddy: 0.25, upw: 0.65, conv: 0.3 }),
    ).toBe(0.65);
  });
  it("MỌI loài có wMax > 0 (nếu không soft-OR trả 0 → loài biến mất)", () => {
    for (const p of SPECIES_PROFILES) expect(speciesWMax(p.w)).toBeGreaterThan(0);
  });
});

describe("percentileRank (hạng phân vị)", () => {
  it("mảng rỗng → trả chính v", () => {
    expect(percentileRank([], 0.7)).toBe(0.7);
    expect(percentileRank([], 42)).toBe(42);
  });
  it("dưới tất cả → ~0; trên tất cả → 1; biên", () => {
    const s = [0.1, 0.2, 0.3, 0.4];
    expect(percentileRank(s, 0)).toBe(0);
    expect(percentileRank(s, 1)).toBe(1);
    expect(percentileRank(s, 0.4)).toBeGreaterThan(0.5); // phần tử lớn nhất
  });
  it("giá trị giữa → midrank ~0.5", () => {
    // 5 phần tử, v = phần tử giữa (index 2): lo=2, hi=3 → (2+3)/10 = 0.5
    expect(percentileRank([1, 2, 3, 4, 5], 3)).toBeCloseTo(0.5, 10);
  });
  it("giá trị trùng lặp → midrank giữa khối trùng", () => {
    // [1,3,3,3,5], v=3: lo=1, hi=4 → (1+4)/10 = 0.5
    expect(percentileRank([1, 3, 3, 3, 5], 3)).toBeCloseTo(0.5, 10);
  });
});

describe("parseBathyGrid (ETOPO lat/lon/z → độ sâu dương)", () => {
  it("z âm → độ sâu dương; đất (z≥0) → NaN; dựng đúng trục", () => {
    const json = {
      table: {
        columnNames: ["latitude", "longitude", "z"],
        rows: [
          [10, 110, -2000], // biển sâu
          [10, 110.25, -50], // biển nông
          [10.25, 110, 30], // đất liền
          [10.25, 110.25, -500],
        ],
      },
    };
    const g = parseBathyGrid(json);
    expect(g.lats).toEqual([10, 10.25]);
    expect(g.lons).toEqual([110, 110.25]);
    expect(g.values[0][0]).toBe(2000); // -(-2000)
    expect(g.values[0][1]).toBe(50);
    expect(Number.isNaN(g.values[1][0])).toBe(true); // đất
    expect(g.values[1][1]).toBe(500);
  });
});

describe("cổng độ sâu: cá xa bờ KHÔNG hiện ở nước cạn sát bờ", () => {
  const tlats = [11.5, 11.75, 12.0];
  const tlons = [110.0, 110.25, 110.5];
  const warm = grid(
    [
      [28, 28, 28],
      [28, 28, 28],
      [28, 28, 28],
    ],
    tlats,
    tlons,
  );
  const clear = grid(
    [
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1],
      [0.1, 0.1, 0.1],
    ],
    tlats,
    tlons,
  );
  const depthGrid = (m: number) =>
    grid(
      [
        [m, m, m],
        [m, m, m],
        [m, m, m],
      ],
      tlats,
      tlons,
    );
  // NÊM NHIỆT NHÔ ở ô giữa (D20 90 m giữa vùng 120 m → dị thường −30 m) cho ngừ
  // vây vàng MỘT cơ chế gom cá thật → điểm nền >0 (soft-OR: ô không cơ chế thì
  // điểm 0); nhờ đó CỔNG ĐỘ SÂU quan sát được. Lưới D20 ĐỒNG ĐỀU không dùng được
  // nữa: dị thường không gian = 0 ⇒ tầng nhiệt không đóng góp gì (đúng theo thiết kế).
  const d20 = grid(
    [
      [120, 120, 120],
      [120, 90, 120],
      [120, 120, 120],
    ],
    tlats,
    tlons,
  );
  const scoreOf = (depthM: number) => {
    const f = buildFishForecast(warm, clear, null, 6, {
      depth: depthGrid(depthM),
      thermo: d20,
    });
    return f.cells.find((c) => c.sp["ngừ vây vàng"])?.sp["ngừ vây vàng"] ?? 0;
  };
  it("'ngừ vây vàng': nước sâu 2000m điểm cao; cạn 30m bị chặn về 0", () => {
    const deep = scoreOf(2000);
    const shallow = scoreOf(30);
    expect(deep).toBeGreaterThan(shallow);
    expect(shallow).toBe(0); // 30m < 50 → deepWaterFit 0 → loại
  });
  it("MẤT lưới độ sâu: điểm ô NƯỚC SÂU bị hạ (không còn coi như đã chứng minh là sâu)", () => {
    const f = buildFishForecast(warm, clear, null, 6, { thermo: d20 });
    const s = f.cells.find((c) => c.sp["ngừ vây vàng"])?.sp["ngừ vây vàng"] ?? 0;
    expect(s).toBeLessThan(scoreOf(2000));
  });
});

describe("MẤT NGUỒN → điểm GIẢM hoặc GIỮ, tuyệt đối KHÔNG TĂNG (buildFishForecast)", () => {
  // lưới 4×4 có cấu trúc (front nhiệt, front mồi, xoáy, nước trồi, hội tụ) để
  // mọi cơ chế đều ĐANG SỐNG ở bản đủ nguồn — bỏ dần từng nguồn mới có nghĩa
  const la = [11.0, 11.25, 11.5, 11.75];
  const lo = [110.0, 110.25, 110.5, 110.75];
  const g4 = (f: (i: number, j: number) => number) =>
    grid(
      la.map((_, i) => lo.map((__, j) => f(i, j))),
      la,
      lo,
    );
  const sst = g4((i, j) => 27 + 0.6 * i + 0.3 * j);
  const chl = g4((i, j) => 0.15 + 0.12 * j + 0.05 * i);
  const sla = g4((i, j) => 0.02 * i - 0.03 * j);
  const anom = g4((i, j) => -0.5 + 0.35 * i - 0.2 * j);
  const cur = {
    u: g4((i, j) => 0.05 - 0.04 * j + 0.01 * i),
    v: g4((i) => 0.06 - 0.05 * i),
  };
  const thermo = g4((i, j) => 60 + 40 * i + 25 * j);
  const depth = g4(() => 2500);
  const base = { anom, cur, thermo, depth };
  const run = (over: Parameters<typeof buildFishForecast>[4]) =>
    buildFishForecast(sst, chl, sla, 6, { ...base, ...over });
  const table = (f: ReturnType<typeof buildFishForecast>) => {
    const m = new Map<string, number>();
    for (const c of f.cells)
      for (const [k, v] of Object.entries(c.sp)) m.set(`${c.lat},${c.lon}|${k}`, v);
    return m;
  };

  const full = table(run({}));
  const scenarios: [string, Parameters<typeof buildFishForecast>[4]][] = [
    ["mất tầng nhiệt (HYCOM)", { thermo: null }],
    ["mất dị thường nhiệt (nước trồi)", { anom: null }],
    ["mất dòng chảy (hội tụ)", { cur: null }],
    ["mất tầng nhiệt + dị thường nhiệt", { thermo: null, anom: null }],
    ["mất tầng nhiệt + dị thường + dòng chảy", { thermo: null, anom: null, cur: null }],
  ];
  it("bản ĐỦ NGUỒN có điểm để so (test không rỗng)", () => {
    expect(full.size).toBeGreaterThan(20);
  });
  for (const [label, over] of scenarios)
    it(`${label}: KHÔNG ô/loài nào tăng điểm`, () => {
      const broken = table(run(over));
      const risen: string[] = [];
      for (const [key, v] of broken)
        if (v > (full.get(key) ?? 0)) risen.push(`${key} ${full.get(key) ?? 0}→${v}`);
      expect(risen).toEqual([]);
    });
  it("mất SSHA (rìa xoáy) — cũng không ô/loài nào tăng", () => {
    const noSla = table(buildFishForecast(sst, chl, null, 6, base));
    const risen: string[] = [];
    for (const [key, v] of noSla)
      if (v > (full.get(key) ?? 0)) risen.push(`${key} ${full.get(key) ?? 0}→${v}`);
    expect(risen).toEqual([]);
  });

  // ── CỔNG ĐỘ SÂU khi MẤT lưới ETOPO ────────────────────────────────────────
  const best = (f: ReturnType<typeof buildFishForecast>, k: string) =>
    Math.max(0, ...f.cells.map((c) => c.sp[k] ?? 0));
  it("mất lưới độ sâu: loài xa bờ KHÔNG biến mất (còn trong payload) nhưng điểm GIẢM", () => {
    const deep = best(run({}), "ngừ vây vàng"); // ô đã chứng minh sâu 2500 m
    const unknown = best(run({ depth: null }), "ngừ vây vàng");
    expect(deep).toBeGreaterThan(50);
    expect(unknown).toBeLessThan(deep);
    expect(unknown).toBeGreaterThanOrEqual(25); // vẫn nằm trong payload
    // TRẦN CỨNG: thiếu độ sâu thì điểm loài xa bờ ≤ 100·DEPTH_UNKNOWN_FIT = 50
    // → mất ETOPO KHÔNG thể tự dựng lại điểm nóng cá ngừ ở sàn hiển thị 50
    expect(unknown).toBeLessThanOrEqual(Math.round(100 * DEPTH_UNKNOWN_FIT));
  });
  it("ô ETOPO khuyết (NaN) xử y như MẤT lưới — không nhảy lên ×1", () => {
    const nan = { ...depth, values: depth.values.map((r) => r.map(() => NaN)) };
    expect(best(run({ depth: nan }), "ngừ vây vàng")).toBe(
      best(run({ depth: null }), "ngừ vây vàng"),
    );
  });
  it("loài KHÔNG có cổng xa bờ không bị ảnh hưởng khi mất lưới độ sâu", () => {
    expect(best(run({ depth: null }), "cá nục")).toBe(best(run({}), "cá nục"));
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

describe("spatialAnomaly (VIỆC 2 — so nước với vùng bên cạnh)", () => {
  // lưới đều 0.5° để bán kính 1.0° gom lân cận
  const lats = [10, 10.5, 11, 11.5, 12];
  const lons = [110, 110.5, 111, 111.5, 112];

  it("trường ĐỒNG ĐỀU → dị thường 0 mọi ô (bỏ nền cả-vùng)", () => {
    const v = lats.map(() => lons.map(() => 3.7));
    const out = spatialAnomaly(v, lats, lons, 1.0);
    for (const row of out) for (const x of row) expect(x).toBeCloseTo(0, 10);
  });

  it("nền dốc ĐỒNG LOẠT cả vùng: tâm vẫn ~0 (chỉ bỏ phần đồng đều, giữ cấu trúc)", () => {
    // gradient tuyến tính theo lat — quanh 1 ô trung vị lân cận ≈ giá trị ô đó
    const v = lats.map((la) => lons.map(() => la));
    const out = spatialAnomaly(v, lats, lons, 1.0);
    // ô giữa (11): median lân cận đối xứng ≈ 11 → dị thường ≈ 0
    expect(out[2][2]).toBeCloseTo(0, 6);
  });

  it("1 ô LẠNH giữa vùng ấm → dị thường ÂM rõ; hàng xóm dương nhẹ", () => {
    const v = lats.map(() => lons.map(() => 4.0));
    v[2][2] = 1.0; // ô lạnh
    const out = spatialAnomaly(v, lats, lons, 1.0);
    expect(out[2][2]).toBeLessThan(-2); // âm rõ (median lân cận ~4)
    expect(out[2][1]).toBeGreaterThanOrEqual(0); // hàng xóm hơi dương
  });

  it("ô NaN GIỮ NaN; NaN bị loại khỏi median", () => {
    const v = lats.map(() => lons.map(() => 5.0));
    v[0][0] = NaN;
    const out = spatialAnomaly(v, lats, lons, 1.0);
    expect(Number.isNaN(out[0][0])).toBe(true);
    // ô kề NaN vẫn tính bình thường (bỏ NaN) → đồng đều còn lại → 0
    expect(out[0][1]).toBeCloseTo(0, 10);
  });

  it("biên mảng: ô góc chỉ có lân cận bên trong, không lỗi", () => {
    const v = lats.map(() => lons.map(() => 2.0));
    v[4][4] = 9.0; // góc nóng
    const out = spatialAnomaly(v, lats, lons, 1.0);
    expect(out[4][4]).toBeGreaterThan(0);
    expect(Number.isFinite(out[0][0])).toBe(true);
  });

  it("bán kính lớn → gom cả lưới; ô lạnh lệch so trung vị TOÀN lưới", () => {
    const v = lats.map(() => lons.map(() => 6.0));
    v[2][2] = 0.0;
    const out = spatialAnomaly(v, lats, lons, 100);
    // median toàn lưới = 6 (24 ô 6 + 1 ô 0) → tâm = 0 - 6 = -6
    expect(out[2][2]).toBeCloseTo(-6, 6);
    expect(out[0][0]).toBeCloseTo(0, 6);
  });
});

describe("nearestRegionWithin — phủ kín vùng biển, không lỗ hổng", () => {
  it("trong đa giác → đúng vùng đó", () => {
    // (20°N, 107.25°E) nằm trong Vịnh Bắc Bộ
    expect(nearestRegionWithin(20, 107.25, 2)?.id).toBe(
      regionAt(20, 107.25)?.id,
    );
    expect(nearestRegionWithin(20, 107.25, 2)?.id).toBe("vinh-bac-bo");
  });
  it("ô biển NGOÀI mọi đa giác nhưng trong tầm → vẫn có vùng (lấp lỗ hổng)", () => {
    // (8.5°N,110°E) không thuộc đa giác nào nhưng gần Đông Nam Bộ / Trường Sa
    expect(regionAt(8.5, 110)).toBeNull();
    expect(nearestRegionWithin(8.5, 110, 2)).not.toBeNull();
  });
  it("xa hẳn mọi vùng → null (ngoài vùng biển VN)", () => {
    expect(nearestRegionWithin(20, 112, 2)).toBeNull(); // đông bắc, nước ngoài
    expect(nearestRegionWithin(3, 110, 2)).toBeNull(); // quá xa về nam
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

describe("VIỆC 4 — cổng nhiệt loài đáy dùng NHIỆT ĐÁY (bottomTemp)", () => {
  // ô VỊNH BẮC BỘ (20N, 107.5E) tháng 6 — cá phèn (tempSource "bottom") đang vụ.
  const lats = [19.75, 20.0, 20.25];
  const lons = [107.0, 107.25, 107.5];
  const warm = grid(
    [
      [27, 27, 27],
      [27, 27, 27],
      [27, 27, 27],
    ],
    lats,
    lons,
  ); // 27°C mặt → cá phèn tFit mặt = 1 (dải [22,25,30,32])
  const food = grid(
    [
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
      [0.8, 0.8, 0.8],
    ],
    lats,
    lons,
  );
  const phen = (o: ReturnType<typeof buildFishForecast>): number =>
    Math.max(0, ...o.cells.map((c) => c.sp["cá phèn"] ?? 0));

  it("KHÔNG bottomTemp → hệt hành vi cũ (chấm bằng SST mặt) — BẤT BIẾN", () => {
    const base = buildFishForecast(warm, food, null, 6);
    // bottomTemp = ĐÚNG BẰNG nhiệt mặt → cổng nhiệt cho kết quả y hệt base
    const same = buildFishForecast(warm, food, null, 6, {
      bottomTemp: grid(
        [
          [27, 27, 27],
          [27, 27, 27],
          [27, 27, 27],
        ],
        lats,
        lons,
      ),
    });
    expect(phen(base)).toBeGreaterThan(0);
    expect(phen(same)).toBe(phen(base));
  });

  it("nhiệt ĐÁY lạnh hơn (rìa dải) → điểm cá phèn GIẢM so với chấm mặt", () => {
    const base = buildFishForecast(warm, food, null, 6);
    // đáy 24°C: tFit = (24−22)/(25−22) ≈ 0.67 < 1 (mặt 27 → tFit 1) → điểm tụt
    const cold = buildFishForecast(warm, food, null, 6, {
      bottomTemp: grid(
        [
          [24, 24, 24],
          [24, 24, 24],
          [24, 24, 24],
        ],
        lats,
        lons,
      ),
    });
    expect(phen(cold)).toBeGreaterThan(0); // KHÔNG biến mất (vẫn ≥ ngưỡng payload)
    expect(phen(cold)).toBeLessThan(phen(base)); // nhưng thấp hơn
  });

  it("ô nhiệt đáy NaN → FALLBACK về SST mặt (không phạt oan)", () => {
    const base = buildFishForecast(warm, food, null, 6);
    const nanBottom = buildFishForecast(warm, food, null, 6, {
      bottomTemp: grid(
        [
          [NaN, NaN, NaN],
          [NaN, NaN, NaN],
          [NaN, NaN, NaN],
        ],
        lats,
        lons,
      ),
    });
    expect(phen(nanBottom)).toBe(phen(base));
  });

  it("nhiệt đáy TẠO cấu trúc không gian: gradient đáy → điểm cá phèn KHÁC nhau giữa ô", () => {
    // gradient đáy 24 → 27 → 30.5°C: tFit 0.67 / 1 / 0.75 → 3 mức điểm ≥ payload
    // (mặt phẳng 27 sẽ ra 1 mức duy nhất) → chứng minh hết "mảng tô đều"
    const gradBottom = grid(
      [
        [24, 24, 24],
        [27, 27, 27],
        [30.5, 30.5, 30.5],
      ],
      lats,
      lons,
    );
    const out = buildFishForecast(warm, food, null, 6, { bottomTemp: gradBottom });
    const vals = out.cells
      .map((c) => c.sp["cá phèn"])
      .filter((v): v is number => v != null);
    expect(vals.length).toBeGreaterThan(1);
    // có ít nhất 2 mức điểm khác nhau (không còn đồng đều)
    expect(new Set(vals).size).toBeGreaterThan(1);
  });
});

describe("VIỆC 4 — cá ngừ mắt to GIỮ cổng nhiệt MẶT (deepTemp không tác động)", () => {
  // Quyết định sau validate: 250 m gần đồng nhất (~13°C) → cổng nhiệt-sâu vô ích
  // + phình điểm nóng. Mắt to giữ tempSource mặc định (mặt). Test khoá quyết định:
  // truyền deepTemp KHÔNG được đổi điểm mắt to (không loài nào tempSource="deep").
  const dlats = [11.5, 11.75, 12.0];
  const dlons = [110.25, 110.5, 110.75];
  const warmOff = grid(
    [
      [28, 28, 28],
      [28, 28, 28],
      [28, 28, 28],
    ],
    dlats,
    dlons,
  );
  const clearChl = grid(
    [
      [0.15, 0.15, 0.15],
      [0.15, 0.15, 0.15],
      [0.15, 0.15, 0.15],
    ],
    dlats,
    dlons,
  );
  const deepBathy = grid(
    [
      [2000, 2000, 2000],
      [2000, 2000, 2000],
      [2000, 2000, 2000],
    ],
    dlats,
    dlons,
  );
  // Mắt to ưa nêm nhiệt CHÌM hơn lân cận (`thermoBand` [4,12]) → lưới phải có
  // CẤU TRÚC: ô giữa D20 150 m giữa vùng 120 m ⇒ dị thường +30 m, thermoFit = 1.
  // (Lưới đồng đều cho dị thường 0 = không tín hiệu — đúng thiết kế mới.)
  const goodThermo = grid(
    [
      [120, 120, 120],
      [120, 150, 120],
      [120, 120, 120],
    ],
    dlats,
    dlons,
  );
  const bigeye = (o: ReturnType<typeof buildFishForecast>): number =>
    Math.max(0, ...o.cells.map((c) => c.sp["ngừ mắt to"] ?? 0));

  it("mắt to chấm bằng SST mặt (28°C ∈ [22,25,29,31]) → có điểm", () => {
    const out = buildFishForecast(warmOff, clearChl, null, 6, {
      depth: deepBathy,
      thermo: goodThermo,
    });
    expect(bigeye(out)).toBeGreaterThan(0);
  });

  it("BẤT BIẾN: truyền deepTemp (kể cả 3°C bất thường) KHÔNG đổi điểm mắt to", () => {
    const base = buildFishForecast(warmOff, clearChl, null, 6, {
      depth: deepBathy,
      thermo: goodThermo,
    });
    const withDeep = buildFishForecast(warmOff, clearChl, null, 6, {
      depth: deepBathy,
      thermo: goodThermo,
      deepTemp: grid(
        [
          [3, 3, 3],
          [3, 3, 3],
          [3, 3, 3],
        ],
        dlats,
        dlons,
      ),
    });
    expect(bigeye(withDeep)).toBe(bigeye(base)); // mắt to KHÔNG là "deep" → bỏ qua deepTemp
    expect(bigeye(base)).toBeGreaterThan(0);
  });
});
