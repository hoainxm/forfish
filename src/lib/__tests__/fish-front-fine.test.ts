// C2 (2026-10-03): FRONT tính trên LƯỚI GỐC MỊN rồi GỘP KHỐI về ô cá 0,25°.
import { describe, expect, it } from "vitest";
import {
  blockMeanGrid,
  buildFishForecast,
  fineFrontOnto,
  frontStrength,
  isFinerGrid,
  THERM_FRONT_FULL_PER_DEG,
  type ScalarGrid,
} from "../fish-predict";

const axis = (start: number, step: number, n: number) =>
  Array.from({ length: n }, (_, i) => +(start + i * step).toFixed(6));

// Lưới cá 8×8 ở 0,25° (12–13,75N · 110–111,75E) — rơi vào vùng biển VN có vụ
const coarseLats = axis(12, 0.25, 8);
const coarseLons = axis(110, 0.25, 8);
// Lưới mịn 0,05° phủ đúng các ô trên: 40 nút/trục, nút đầu 11,9 (= 12 − 0,1)
const fineLats = axis(11.9, 0.05, 40);
const fineLons = axis(109.9, 0.05, 40);

const grid = (lats: number[], lons: number[], f: (lat: number, lon: number) => number, unit = "degC"): ScalarGrid => ({
  lats,
  lons,
  values: lats.map((la) => lons.map((lo) => f(la, lo))),
  date: "2026-10-01",
  unit: unit as ScalarGrid["unit"],
});

describe("blockMeanGrid — phân hoạch nút mịn vào ô đích", () => {
  it("0,05°→0,25°: mỗi ô = trung bình đúng 5×5 nút; NaN bị bỏ; nút ngoài ô bị bỏ", () => {
    // giá trị = chỉ số hàng mịn (để kiểm trung bình theo khối)
    const fine = fineLats.map((_, i) => fineLons.map(() => i));
    fine[2][2] = NaN; // một nút NaN trong ô (0,0)
    const out = blockMeanGrid(fine, fineLats, fineLons, coarseLats, coarseLons);
    expect(out.length).toBe(8);
    expect(out[0].length).toBe(8);
    // ô vĩ 12,25 (hàng 1) gồm hàng mịn 5..9 (12,15–12,35) → trung bình 7
    expect(out[1][3]).toBeCloseTo(7, 9);
    // ô (0,0) mất nút (2,2): 24 nút, tổng = 5·(0+1+2+3+4) − 2 = 48 → 2
    expect(out[0][0]).toBeCloseTo(2, 9);
    expect(out[0][1]).toBeCloseTo(2, 9);
  });

  it("tỷ lệ KHÔNG nguyên (0,1°→0,25°) vẫn chạy: mọi nút hữu hạn thuộc đúng MỘT ô, trung bình toàn miền giữ nguyên", () => {
    const fl = axis(11.95, 0.1, 20); // 11,95 … 13,85
    const fo = axis(109.95, 0.1, 20);
    const fine = fl.map((la, i) => fo.map((lo, j) => Math.sin(i) + Math.cos(j) + la * 0 + lo * 0));
    const out = blockMeanGrid(fine, fl, fo, coarseLats, coarseLons);
    // dựng lại tổng từ trung bình × số nút: đếm nút theo cùng luật "ô có tâm gần nhất, cách ≤ ½ bước"
    let sumFine = 0;
    let nFine = 0;
    for (let i = 0; i < fl.length; i++)
      for (let j = 0; j < fo.length; j++) {
        const dLa = Math.min(...coarseLats.map((c) => Math.abs(c - fl[i])));
        const dLo = Math.min(...coarseLons.map((c) => Math.abs(c - fo[j])));
        if (dLa <= 0.125 + 1e-9 && dLo <= 0.125 + 1e-9) {
          sumFine += fine[i][j];
          nFine++;
        }
      }
    // mọi ô đích đều có nút (2–3 nút/trục), không ô nào NaN
    expect(out.flat().every(Number.isFinite)).toBe(true);
    // trung bình có trọng số theo số nút = trung bình các nút được nhận — kiểm bằng cách
    // tính lại số nút mỗi ô từ luật phân hoạch
    let sumBack = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const nLa = fl.filter((v) => Math.abs(v - coarseLats[r]) <= 0.125 + 1e-9 && coarseLats.every((o) => Math.abs(o - v) >= Math.abs(coarseLats[r] - v))).length;
        const nLo = fo.filter((v) => Math.abs(v - coarseLons[c]) <= 0.125 + 1e-9 && coarseLons.every((o) => Math.abs(o - v) >= Math.abs(coarseLons[c] - v))).length;
        sumBack += out[r][c] * nLa * nLo;
      }
    expect(sumBack).toBeCloseTo(sumFine, 6);
    expect(nFine).toBeGreaterThan(0);
  });

  it("ô đích không có nút mịn hữu hạn → NaN (caller lùi về giá trị thô)", () => {
    const fine = fineLats.map(() => fineLons.map(() => NaN));
    const out = blockMeanGrid(fine, fineLats, fineLons, coarseLats, coarseLons);
    expect(out.flat().every((v) => Number.isNaN(v))).toBe(true);
  });
});

describe("fineFrontOnto — front 1 ô mịn SỐNG SÓT sau gộp, lưới 0,25° thì MẤT", () => {
  // Sợi nước ấm rộng đúng MỘT cột mịn (0,05°) đặt ở kinh 110,35 — KHÔNG trùng nút nào của lưới 0,25°
  const filamentLon = 110.35;
  const sstFine = grid(fineLats, fineLons, (_, lo) => (Math.abs(lo - filamentLon) < 1e-6 ? 30 : 28));
  const sstCoarse = grid(coarseLats, coarseLons, () => 28); // lấy mẫu stride 5 không chạm sợi

  it("lưới 0,25° không thấy sợi (front = 0 khắp nơi), lưới mịn gộp khối thấy ở đúng ô chứa sợi", () => {
    const coarseFront = frontStrength(sstCoarse);
    expect(coarseFront.flat().every((v) => v === 0)).toBe(true);
    const pooled = fineFrontOnto(sstFine.values, sstFine, THERM_FRONT_FULL_PER_DEG, sstCoarse, coarseFront);
    // sợi ở 110,35 → thuộc ô kinh 110,25 (cột 1): |∇| tại hai nút kề sợi, trung bình trên 5 cột > 0
    expect(pooled[3][1]).toBeGreaterThan(0.1);
    // ô không chứa sợi vẫn 0
    expect(pooled[3][4]).toBe(0);
    expect(pooled[3][0]).toBe(0);
  });

  it("ô không có nút mịn → lùi về front thô (hành vi cũ), không NaN", () => {
    // lưới mịn chỉ phủ nửa Nam (4 ô vĩ đầu)
    const halfLats = axis(11.9, 0.05, 20);
    const half = grid(halfLats, fineLons, (_, lo) => (Math.abs(lo - filamentLon) < 1e-6 ? 30 : 28));
    const coarseWithFront = grid(coarseLats, coarseLons, (la) => (la >= 13 ? 30 : 28));
    const coarseFront = frontStrength(coarseWithFront);
    const pooled = fineFrontOnto(half.values, half, THERM_FRONT_FULL_PER_DEG, coarseWithFront, coarseFront);
    expect(pooled.flat().every(Number.isFinite)).toBe(true);
    // hàng 6–7 (vĩ 13,5–13,75) không có nút mịn → đúng giá trị thô
    expect(pooled[7]).toEqual(coarseFront[7]);
    expect(pooled[6]).toEqual(coarseFront[6]);
  });
});

describe("isFinerGrid", () => {
  it("mịn hơn hẳn (bước ≤ ½) mới tính; cùng cỡ hoặc 0,167° thì không", () => {
    const c = grid(coarseLats, coarseLons, () => 28);
    expect(isFinerGrid(grid(fineLats, fineLons, () => 28), c)).toBe(true);
    expect(isFinerGrid(grid(axis(11.95, 0.1, 20), axis(109.95, 0.1, 20), () => 28), c)).toBe(true);
    expect(isFinerGrid(grid(axis(12, 0.1667, 12), axis(110, 0.1667, 12), () => 28), c)).toBe(false);
    expect(isFinerGrid(c, c)).toBe(false);
  });
});

describe("buildFishForecast — extra.frontSstFine / frontChlFine", () => {
  const shelf = grid(coarseLats, coarseLons, () => 60, "m");
  const sst = grid(coarseLats, coarseLons, (la, lo) => 28 + ((la * 4) % 3) * 0.4 + ((lo * 4) % 2) * 0.3);
  const chl = grid(coarseLats, coarseLons, () => 0.3, "mg/m3");
  const base = () => buildFishForecast(sst, chl, null, 7, { depth: shelf });

  it("không truyền / truyền lưới KHÔNG mịn hơn → y hệt hành vi cũ", () => {
    const a = base();
    const b = buildFishForecast(sst, chl, null, 7, { depth: shelf, frontSstFine: sst, frontChlFine: chl });
    expect(b.cells).toEqual(a.cells);
    expect(a.cells.length).toBeGreaterThan(0);
  });

  it("lưới mịn có front sợi mà lưới 0,25° không thấy → điểm ĐỔI, nhiệt hiển thị KHÔNG đổi", () => {
    const sstFine = grid(fineLats, fineLons, (la, lo) => {
      // nền = nội suy giá trị thô + sợi ấm một cột mịn ở 110,35
      const base = 28 + ((Math.round(la * 4) / 4 * 4) % 3) * 0.4 + ((Math.round(lo * 4) / 4 * 4) % 2) * 0.3;
      return Math.abs(lo - 110.35) < 1e-6 ? base + 2 : base;
    });
    const a = base();
    const b = buildFishForecast(sst, chl, null, 7, { depth: shelf, frontSstFine: sstFine });
    expect(JSON.stringify(b.cells)).not.toBe(JSON.stringify(a.cells));
    // số ô CÓ THỂ đổi (front mạnh hơn kéo thêm ô qua KEEP_MIN — sau khi gộp C5
    // xoáy ấm thì đúng vậy: 57 → 64); bất biến là nhiệt hiển thị của CÙNG ô.
    const tA = new Map(a.cells.map((c) => [`${c.lat},${c.lon}`, c.t]));
    let common = 0;
    for (const c of b.cells) {
      const t = tA.get(`${c.lat},${c.lon}`);
      if (t === undefined) continue;
      common++;
      expect(c.t).toBe(t);
    }
    expect(common).toBeGreaterThan(0);
  });

  it("frontChlFine mịn → front mồi đổi theo lưới mịn", () => {
    const chlFine = grid(fineLats, fineLons, (_, lo) => (Math.abs(lo - 110.35) < 1e-6 ? 3 : 0.3), "mg/m3");
    const a = base();
    const b = buildFishForecast(sst, chl, null, 7, { depth: shelf, frontChlFine: chlFine });
    expect(JSON.stringify(b.cells)).not.toBe(JSON.stringify(a.cells));
  });

  it("đơn vị sai → ném (guard tại ranh giới)", () => {
    const wrong = grid(fineLats, fineLons, () => 300, "K");
    expect(() => buildFishForecast(sst, chl, null, 7, { depth: shelf, frontSstFine: wrong })).toThrow();
  });
});
