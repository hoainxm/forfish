import { describe, expect, it } from "vitest";

import { tocDoMuot, etaHours } from "../nav-progress";

describe("tocDoMuot (ETA mượt, EMA 60 s)", () => {
  it("mẫu đầu lấy nguyên; đứng/null ⇒ null", () => {
    expect(tocDoMuot(null, 13, 0)).toEqual({ kmh: 13, t: 0 });
    expect(tocDoMuot({ kmh: 13, t: 0 }, null, 1000)).toBeNull();
    expect(tocDoMuot({ kmh: 13, t: 0 }, 0.3, 1000)).toBeNull();
    expect(tocDoMuot(null, Number.NaN, 0)).toBeNull();
  });

  it("sóng làm tốc độ dao động 9↔17: ETA lệch ít hơn nhiều so với tức thời", () => {
    let s = tocDoMuot(null, 13, 0);
    let maxLech = 0;
    [9, 17, 9, 17, 9, 17, 9, 17].forEach((v, i) => {
      s = tocDoMuot(s, v, (i + 1) * 5000);
      maxLech = Math.max(maxLech, Math.abs(etaHours(26, s!.kmh)! - 2));
    });
    const tucThoi = Math.abs(etaHours(26, 9)! - 2);
    expect(maxLech).toBeLessThan(tucThoi / 3);
  });

  it("tốc độ đổi thật thì theo kịp sau vài phút", () => {
    let s = tocDoMuot(null, 10, 0);
    for (let i = 1; i <= 24; i++) s = tocDoMuot(s, 20, i * 10_000);
    expect(s!.kmh).toBeGreaterThan(19);
  });

  it("cách mẫu quá 3 phút hoặc thời gian lùi ⇒ lấy mẫu mới", () => {
    expect(tocDoMuot({ kmh: 10, t: 0 }, 20, 200_000)).toEqual({ kmh: 20, t: 200_000 });
    expect(tocDoMuot({ kmh: 10, t: 5000 }, 20, 1000)).toEqual({ kmh: 20, t: 1000 });
  });
});
