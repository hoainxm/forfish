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

describe("nhanFix — bỏ điểm nhảy ở chỗ nhận vị trí", async () => {
  const { nhanFix, BO_LIEN_MAX } = await import("@/lib/use-nav-tracking");
  const prev = { pos: { lat: 14, lon: 109 }, t: 0 };
  it("fix đầu tiên luôn nhận", () => {
    expect(nhanFix(null, { pos: { lat: 0, lon: 0 }, t: 0, accuracyM: 5000 }, 0)).toEqual({ nhan: true, boLien: 0 });
  });
  it("sai số > 1 km (định vị theo trạm) ⇒ bỏ", () => {
    expect(nhanFix(prev, { pos: prev.pos, t: 1000, accuracyM: 1500 }, 0)).toEqual({ nhan: false, boLien: 1 });
  });
  it("vọt 5 km trong 2 giây ⇒ bỏ; đi 10 m ⇒ nhận", () => {
    expect(nhanFix(prev, { pos: { lat: 14.045, lon: 109 }, t: 2000, accuracyM: 10 }, 0).nhan).toBe(false);
    expect(nhanFix(prev, { pos: { lat: 14.0001, lon: 109 }, t: 2000, accuracyM: 10 }, 0).nhan).toBe(true);
  });
  it("mất GPS 1 giờ rồi có lại cách 20 km ⇒ nhận (tốc độ hợp lý)", () => {
    expect(nhanFix(prev, { pos: { lat: 14.18, lon: 109 }, t: 3_600_000, accuracyM: 10 }, 0).nhan).toBe(true);
  });
  it(`bỏ liền ${BO_LIEN_MAX} lần ⇒ lần sau nhận, không kẹt mãi`, () => {
    expect(nhanFix(prev, { pos: { lat: 15, lon: 109 }, t: 1000, accuracyM: 10 }, BO_LIEN_MAX)).toEqual({ nhan: true, boLien: 0 });
  });
});

describe("nenNhanDiemCho — điểm bị bỏ mà không fix nào cãi lại (tàu neo yên)", async () => {
  const { nenNhanDiemCho, NHAY_CHO_MS } = await import("@/lib/use-nav-tracking");
  it(`chờ đủ ${NHAY_CHO_MS} ms thì nhận; chưa đủ / không có điểm chờ thì không`, () => {
    expect(nenNhanDiemCho(1000, 1000 + NHAY_CHO_MS)).toBe(true);
    expect(nenNhanDiemCho(1000, 1000 + NHAY_CHO_MS - 1)).toBe(false);
    expect(nenNhanDiemCho(null, 99_999)).toBe(false);
  });
});

/* 2026-11-06: điểm chờ KHÔNG còn được nhận thẳng sau 8 s — hỏi lại GPS, chỉ nhận khi fix mới nằm gần điểm chờ. */
describe("diemChoDuocXacNhan — điểm vọt bậy rồi máy im không thành vị trí thật", async () => {
  const { diemChoDuocXacNhan } = await import("@/lib/use-nav-tracking");
  const cho = { lat: 15.05, lon: 109.0 }; // vọt ~5,5 km về bắc
  it("fix mới gần điểm chờ (tàu đi thật) ⇒ xác nhận", () => {
    expect(diemChoDuocXacNhan(cho, { lat: 15.0515, lon: 109.0 })).toBe(true);
  });
  it("fix mới quay về chỗ cũ (điểm chờ là điểm bậy) ⇒ không xác nhận", () => {
    expect(diemChoDuocXacNhan(cho, { lat: 15.0, lon: 109.0 })).toBe(false);
  });
});
