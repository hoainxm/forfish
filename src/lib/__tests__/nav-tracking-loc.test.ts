import { describe, expect, it } from "vitest";

import { locFix, type LocIn, type LocState } from "@/lib/use-nav-tracking";

const A = { lat: 10, lon: 110 };
const mx = (m: number) => ({ lat: 10, lon: 110 + m / (111_320 * Math.cos((10 * Math.PI) / 180)) });
const fix = (o: Partial<LocIn> & Pick<LocIn, "pos" | "t">): LocIn => ({ speedMps: null, headingDeg: null, accuracyM: 5, ...o });
const dau = (): LocState => ({ pos: A, t: 0, smoothKmh: null, headingDeg: null });

describe("locFix — lọc nhiễu tốc độ/hướng GPS", () => {
  it("trôi 5 m/1 s không ra 18 km/h: đứng, hướng không đổi", () => {
    const r = locFix(dau(), fix({ pos: mx(5), t: 1000 }));
    expect(r.speedKmh).toBeNull();
    expect(r.headingDeg).toBeNull();
  });
  it("sai số lớn nới ngưỡng quãng: dịch 25 m với sai số 30 m là nhiễu", () => {
    expect(locFix(dau(), fix({ pos: mx(25), t: 2000, accuracyM: 30 })).speedKmh).toBeNull();
  });
  it("chạy thật 10 m/s suy từ 2 fix → ~36 km/h, có hướng đông", () => {
    const r = locFix(dau(), fix({ pos: mx(100), t: 10_000 }));
    expect(r.speedKmh).toBeGreaterThan(35);
    expect(r.headingDeg).toBeGreaterThan(89);
    expect(r.headingDeg).toBeLessThan(91);
  });
  it("nhảy vọt > 74 km/h là nhiễu, bỏ mẫu", () => {
    expect(locFix(dau(), fix({ pos: mx(500), t: 5000 })).speedKmh).toBeNull();
  });
  it("EMA: tốc độ nhảy 0 → 20 km/h không vọt ngay", () => {
    let s = locFix(dau(), fix({ pos: A, t: 0, speedMps: 0 }));
    s = locFix(s, fix({ pos: A, t: 1000, speedMps: 20 / 3.6 }));
    expect(s.speedKmh ?? 0).toBeLessThan(5);
    for (let i = 2; i < 80; i++) s = locFix(s, fix({ pos: A, t: i * 1000, speedMps: 20 / 3.6 }));
    expect(s.speedKmh).toBeGreaterThan(19);
  });
  it("heading GPS bị bỏ khi đứng (la bàn quay khi neo)", () => {
    const s = locFix(dau(), fix({ pos: A, t: 1000, speedMps: 0, headingDeg: 200 }));
    expect(s.headingDeg).toBeNull();
  });
  it("heading GPS bị bỏ khi không có tốc độ; nhận khi đang chạy, chuẩn hoá 0–360", () => {
    expect(locFix(dau(), fix({ pos: A, t: 1000, headingDeg: 200 })).headingDeg).toBeNull();
    expect(locFix(dau(), fix({ pos: A, t: 1000, speedMps: 5, headingDeg: -90 })).headingDeg).toBe(270);
  });
});
