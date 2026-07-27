import { describe, it, expect } from "vitest";
import raw from "@/data/copernicus-tendency-skill.json";
import {
  anchoredSstGrid,
  sstLeadSkill,
  sstTendencyAlpha,
  MAX_FISH_LEAD,
} from "@/lib/sst-tendency";
import { buildFishForecast, type ScalarGrid } from "@/lib/fish-predict";

/** lưới vuông đơn giản, bước 0,25° quanh biển miền Trung */
function grid(values: number[][], date = "2026-07-24"): ScalarGrid {
  const lats = values.map((_, i) => 10 + i * 0.25);
  const lons = values[0].map((_, j) => 110 + j * 0.25);
  return { lats, lons, values, date };
}

describe("sstTendencyAlpha — chọn hệ số theo TẦM NGÀY", () => {
  it("tầm 1..3 lấy đúng alphaOpt đã đo (cross-validated)", () => {
    const rows = (raw as { perLead: { sst: { lead: number; alphaOpt: number }[] } })
      .perLead.sst;
    for (let k = 1; k <= MAX_FISH_LEAD; k++) {
      const row = rows.find((r) => r.lead === k)!;
      expect(sstTendencyAlpha(k)).toBeCloseTo(row.alphaOpt, 6);
    }
  });

  it("α tăng dần theo tầm ngày và luôn trong (0,1]", () => {
    const a = [1, 2, 3].map(sstTendencyAlpha);
    expect(a[0]).toBeGreaterThan(0);
    expect(a[0]).toBeLessThan(a[1]);
    expect(a[1]).toBeLessThan(a[2]);
    expect(a[2]).toBeLessThanOrEqual(1);
  });

  it("ngoài tầm đã đo / tầm không nguyên → 0 (rơi về persistence)", () => {
    expect(sstTendencyAlpha(0)).toBe(0);
    expect(sstTendencyAlpha(-1)).toBe(0);
    expect(sstTendencyAlpha(MAX_FISH_LEAD + 1)).toBe(0);
    expect(sstTendencyAlpha(1.5)).toBe(0);
    expect(sstTendencyAlpha(NaN)).toBe(0);
  });

  it("sstLeadSkill trả SỐ THẬT trong bảng đo, không bịa", () => {
    const s = sstLeadSkill(3);
    expect(s.usesTendency).toBe(true);
    expect(s.corrTendency).toBeCloseTo(0.4605, 4);
    expect(s.gainPct).toBeGreaterThan(0);
    // tầm chưa đo/ngoài phạm vi cho phép: KHÔNG dùng xu hướng
    expect(sstLeadSkill(MAX_FISH_LEAD + 1).usesTendency).toBe(false);
  });
});

describe("anchoredSstGrid — neo vệ tinh + xu hướng Copernicus", () => {
  const sat = grid([
    [28, 29],
    [30, 31],
  ]);
  const copBase = grid([
    [20, 20],
    [20, 20],
  ]);
  const copLead = grid([
    [21, 22],
    [19, 20],
  ]);

  it("cộng đúng α·(cop_lead − cop_base) tại từng ô", () => {
    const g = anchoredSstGrid({ sat, copBase, copLead, alpha: 0.5 });
    expect(g.values[0][0]).toBeCloseTo(28 + 0.5 * 1, 10);
    expect(g.values[0][1]).toBeCloseTo(29 + 0.5 * 2, 10);
    expect(g.values[1][0]).toBeCloseTo(30 + 0.5 * -1, 10);
    expect(g.values[1][1]).toBeCloseTo(31, 10);
    // trục giữ nguyên của ảnh vệ tinh, KHÔNG regrid ngược
    expect(g.lats).toEqual(sat.lats);
    expect(g.lons).toEqual(sat.lons);
  });

  it("KHÔNG đột biến lưới vệ tinh gốc", () => {
    anchoredSstGrid({ sat, copBase, copLead, alpha: 0.5 });
    expect(sat.values[0][0]).toBe(28);
  });

  it("α = 0 → persistence (y hệt ảnh hôm nay)", () => {
    const g = anchoredSstGrid({ sat, copBase, copLead, alpha: 0 });
    expect(g.values).toEqual(sat.values);
  });

  it("THIẾU Copernicus (một hoặc cả hai mốc) → persistence, KHÔNG vỡ", () => {
    expect(anchoredSstGrid({ sat, copBase: null, copLead, alpha: 0.6 }).values).toEqual(
      sat.values,
    );
    expect(anchoredSstGrid({ sat, copBase, copLead: null, alpha: 0.6 }).values).toEqual(
      sat.values,
    );
    expect(
      anchoredSstGrid({ sat, copBase: null, copLead: null, alpha: 0.6 }).values,
    ).toEqual(sat.values);
  });

  it("ô Copernicus NaN → ô đó giữ ảnh vệ tinh (chỉ ô đó)", () => {
    const holed = grid([
      [NaN, 22],
      [19, 20],
    ]);
    const g = anchoredSstGrid({ sat, copBase, copLead: holed, alpha: 0.5 });
    expect(g.values[0][0]).toBe(28); // giữ nguyên
    expect(g.values[0][1]).toBeCloseTo(30, 10); // ô bên cạnh vẫn được kéo
  });

  it("ô đất liền (SST NaN) vẫn là NaN", () => {
    const land = grid([
      [NaN, 29],
      [30, 31],
    ]);
    const g = anchoredSstGrid({ sat: land, copBase, copLead, alpha: 0.5 });
    expect(Number.isNaN(g.values[0][0])).toBe(true);
  });

  it("biên độ kéo vô lý (>5 °C) → bỏ, giữ ảnh vệ tinh", () => {
    const wild = grid([
      [200, 22],
      [19, 20],
    ]);
    const g = anchoredSstGrid({ sat, copBase, copLead: wild, alpha: 1 });
    expect(g.values[0][0]).toBe(28);
    expect(g.values[0][1]).toBeCloseTo(31, 10);
  });

  it("lưới Copernicus lệch xa (>0,5°) → persistence, KHÔNG lấy nhiệt bậy", () => {
    const far: ScalarGrid = {
      lats: [40, 40.25],
      lons: [200, 200.25],
      values: [
        [21, 22],
        [19, 20],
      ],
      date: "2026-07-25",
    };
    const g = anchoredSstGrid({ sat, copBase: far, copLead: far, alpha: 0.6 });
    expect(g.values).toEqual(sat.values);
  });

  it("gán được ngày của bản dự báo", () => {
    const g = anchoredSstGrid({
      sat,
      copBase,
      copLead,
      alpha: 0.5,
      date: "2026-07-27",
    });
    expect(g.date).toBe("2026-07-27");
    expect(anchoredSstGrid({ sat, copBase, copLead, alpha: 0.5 }).date).toBe(sat.date);
  });
});

describe("buildFishForecast — `frontSst` tách FRONT khỏi GIÁ TRỊ nhiệt", () => {
  // lưới đủ rộng để rơi vào vùng biển VN có mùa vụ
  const mk = (base: number): ScalarGrid => {
    const lats = Array.from({ length: 8 }, (_, i) => 12 + i * 0.25);
    const lons = Array.from({ length: 8 }, (_, j) => 110 + j * 0.25);
    return {
      lats,
      lons,
      values: lats.map((_, i) => lons.map((__, j) => base + (i % 3) * 0.4 + (j % 2) * 0.3)),
      date: "2026-07-24",
    };
  };
  const sstNow = mk(28);
  const sstPred = mk(28.5);
  const chl: ScalarGrid = {
    lats: sstNow.lats,
    lons: sstNow.lons,
    values: sstNow.lats.map(() => sstNow.lons.map(() => 0.3)),
    date: "2026-07-24",
  };

  it("mặc định = dùng chính lưới sst (không đổi hành vi cũ)", () => {
    const a = buildFishForecast(sstNow, chl, null, 7);
    const b = buildFishForecast(sstNow, chl, null, 7, { frontSst: sstNow });
    expect(b.cells).toEqual(a.cells);
  });

  it("frontSst đổi kết quả khi front khác — front lấy từ lưới được chỉ định", () => {
    const flat: ScalarGrid = {
      lats: sstNow.lats,
      lons: sstNow.lons,
      values: sstNow.lats.map(() => sstNow.lons.map(() => 29)),
      date: "2026-07-24",
    };
    const withFront = buildFishForecast(sstPred, chl, null, 7, { frontSst: sstNow });
    const flatFront = buildFishForecast(sstPred, chl, null, 7, { frontSst: flat });
    // cùng GIÁ TRỊ nhiệt (sstPred) nhưng front khác → điểm khác
    expect(JSON.stringify(withFront.cells)).not.toBe(JSON.stringify(flatFront.cells));
    // nhiệt hiển thị luôn lấy từ lưới GIÁ TRỊ, không phải lưới front
    expect(withFront.cells[0].t).toBeCloseTo(flatFront.cells[0].t, 6);
  });

  it("frontSst sai cỡ lưới → bỏ qua (dùng sst), KHÔNG vỡ", () => {
    const wrong: ScalarGrid = {
      lats: [12],
      lons: [110],
      values: [[29]],
      date: "2026-07-24",
    };
    const a = buildFishForecast(sstPred, chl, null, 7);
    const b = buildFishForecast(sstPred, chl, null, 7, { frontSst: wrong });
    expect(b.cells).toEqual(a.cells);
  });
});
