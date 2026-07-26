// Khoá TÍNH CHẤT của cổng kiểm độ phân biệt: yếu tố phẳng/bão hoà/kẹp sàn PHẢI
// báo đỏ. Đây là rào chặn cho lỗi đã dính BA lần (upwTerm · thermoFit ·
// foodLimiter) — xem src/lib/discrimination.ts.

import { describe, expect, it } from "vitest";
import {
  DISCRIMINATION_MIN_STD,
  judgeAll,
  judgeTerm,
  termStats,
} from "../discrimination";

/** lưới n×n giá trị hằng */
const flat = (v: number, n = 20) =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => v));

/** lưới trải đều 0..1 theo cột — yếu tố LÀNH */
const spread = (n = 20) =>
  Array.from({ length: n }, () =>
    Array.from({ length: n }, (_, j) => j / (n - 1)),
  );

describe("termStats", () => {
  it("lưới hằng → std 0", () => {
    expect(termStats("x", flat(0.5)).std).toBe(0);
  });

  it("đếm đúng ô kịch trần và ô sàn", () => {
    const s = termStats("x", [[1, 1, 0, 0.5]]);
    expect(s.n).toBe(4);
    expect(s.satFrac).toBe(0.5); // hai ô ≥0.95
    expect(s.floorFrac).toBe(0.25); // một ô = 0
  });

  it("bỏ ô NaN, không tính vào n", () => {
    const s = termStats("x", [[NaN, 0.5, NaN]]);
    expect(s.n).toBe(1);
  });

  it("lưới rỗng / toàn NaN → n = 0", () => {
    expect(termStats("x", []).n).toBe(0);
    expect(termStats("x", [[NaN, NaN]]).n).toBe(0);
  });
});

describe("judgeTerm — bắt đúng ba khuôn lỗi đã dính", () => {
  it("yếu tố PHẲNG (kiểu thermoFit std 0.028) → báo đỏ", () => {
    const v = judgeTerm(termStats("thermoFit", flat(0.996)));
    expect(v.flat).toBe(true);
    expect(v.ok).toBe(false);
  });

  it("yếu tố BÃO HOÀ (kiểu foodLimiter 83–98% ô kịch trần) → báo đỏ", () => {
    // 19/20 cột = 1, một cột = 0.9 ⇒ std nhỏ VÀ satFrac 95%
    const g = Array.from({ length: 20 }, () =>
      Array.from({ length: 20 }, (_, j) => (j === 0 ? 0.9 : 1)),
    );
    const v = judgeTerm(termStats("foodLimiter", g));
    expect(v.saturated).toBe(true);
    expect(v.ok).toBe(false);
  });

  it("yếu tố KẸP SÀN (kiểu upwTerm mùa hè kẹp 0 khắp nơi) → báo đỏ", () => {
    const v = judgeTerm(termStats("upwTerm", flat(0)));
    expect(v.floored).toBe(true);
    expect(v.ok).toBe(false);
  });

  it("yếu tố TRẢI RỘNG → lành", () => {
    const v = judgeTerm(termStats("chlFront", spread()));
    expect(v.ok).toBe(true);
    expect(v.std).toBeGreaterThan(DISCRIMINATION_MIN_STD);
  });

  it("KHÔNG có dữ liệu hôm nay → KHÔNG tính là lỗi (nguồn tuỳ chọn vắng)", () => {
    const v = judgeTerm(termStats("conv", [[NaN, NaN]]));
    expect(v.n).toBe(0);
    expect(v.ok).toBe(true);
  });
});

describe("judgeAll", () => {
  it("gom đúng danh sách báo đỏ", () => {
    const { verdicts, redFlags } = judgeAll([
      termStats("tot", spread()),
      termStats("phang", flat(0.5)),
      termStats("baohoa", flat(1)),
    ]);
    expect(verdicts).toHaveLength(3);
    expect(redFlags.map((r) => r.key).sort()).toEqual(["baohoa", "phang"]);
  });

  it("mọi yếu tố lành → qua cổng", () => {
    expect(judgeAll([termStats("a", spread()), termStats("b", spread())]).redFlags)
      .toHaveLength(0);
  });
});
