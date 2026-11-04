import { describe, expect, it } from "vitest";
import { bangTheoTroi, cauCpa, doCaoMatTroi, MAU_NONG, mauDaiToNong, nhomTheoMuc } from "../hai-do/lop";
import { tuongPhan } from "../hai-do/bang-mau";
import { DEPTH_BANDS } from "../ocean-map";
import type { MucTieu } from "../ais-cpa";

describe("mức hiển thị", () => {
  it("Cơ bản tắt báo hiệu; Chuẩn có báo hiệu; Đủ thêm luồng + cáp/cấm", () => {
    expect(nhomTheoMuc("co-ban")).toEqual({ baoHieu: false, luong: false, camCap: false });
    expect(nhomTheoMuc("chuan")).toEqual({ baoHieu: true, luong: false, camCap: false });
    expect(nhomTheoMuc("du")).toEqual({ baoHieu: true, luong: true, camCap: true });
  });
});

describe("tô nông theo đường an toàn", () => {
  it("an toàn 10 m: chỉ dải 0–10 tô nông", () => {
    const m = mauDaiToNong(10);
    expect(m["sea-bg"]).toBe(MAU_NONG);
    expect(m["isobath-du-nuoc"]).toBe(DEPTH_BANDS[1].color);
  });
  it("an toàn 20 / 50 m: thêm dải tương ứng", () => {
    expect(mauDaiToNong(20)["isobath-du-nuoc"]).toBe(MAU_NONG);
    expect(mauDaiToNong(20)["isobath-dai-2"]).toBe(DEPTH_BANDS[2].color);
    expect(mauDaiToNong(50)["isobath-dai-2"]).toBe(MAU_NONG);
    expect(mauDaiToNong(50)["isobath-dai-3"]).toBe(DEPTH_BANDS[3].color);
  });
  it("nét đẳng sâu (#3d6e96) trên màu nông vẫn ≥ 3:1", () => {
    expect(tuongPhan(MAU_NONG, "#3d6e96")).toBeGreaterThanOrEqual(3);
  });
});

describe("mặt trời", () => {
  it("trưa Vũng Tàu cao, nửa đêm âm, lúc hoàng hôn quanh 0", () => {
    const trua = Date.parse("2026-11-04T05:00:00Z"); // 12h VN
    const dem = Date.parse("2026-11-04T17:00:00Z"); // 0h VN
    const chieu = Date.parse("2026-11-04T10:30:00Z"); // 17h30 VN
    expect(doCaoMatTroi(10.35, 107.08, trua)).toBeGreaterThan(55);
    expect(doCaoMatTroi(10.35, 107.08, dem)).toBeLessThan(-40);
    expect(Math.abs(doCaoMatTroi(10.35, 107.08, chieu))).toBeLessThan(8);
  });
  it("ngưỡng ngày/chiều/đêm", () => {
    expect(bangTheoTroi(30)).toBe("ngay");
    expect(bangTheoTroi(0)).toBe("chieu");
    expect(bangTheoTroi(-10)).toBe("dem");
  });
});

describe("báo va chạm AIS", () => {
  const mt = (o: Partial<MucTieu>): MucTieu =>
    ({
      tau: { id: "x", ten: "BĐ 1234", loai: 2, co: null, lat: 0, lon: 0, kn: 5, huong: 0, mui: null, phut: 0, dai: null, dich: null },
      pos: { lat: 0, lon: 0 },
      cachNm: 2,
      phuongVi: 0,
      cpaNm: 0.2,
      tcpaPhut: 8,
      muc: "nguy",
      tuoiPhut: 1,
      tinCu: false,
      cpaMinh: null,
      cpaTau: null,
      ...o,
    }) as MucTieu;
  const hl = (nm: number) => `${nm.toFixed(1)} hl`;
  it("tàu sẽ gần dưới ngưỡng trong 12 phút ⇒ câu báo", () => {
    expect(cauCpa([mt({})], hl)).toBe("Tàu BĐ 1234 sẽ cách 0.2 hl sau 8 phút");
  });
  it("xa, đã qua, quá lâu, tin cũ ⇒ im", () => {
    expect(cauCpa([mt({ cpaNm: 0.9 })], hl)).toBeNull();
    expect(cauCpa([mt({ tcpaPhut: -2 })], hl)).toBeNull();
    expect(cauCpa([mt({ tcpaPhut: 30 })], hl)).toBeNull();
    expect(cauCpa([mt({ tinCu: true })], hl)).toBeNull();
  });
  it("nhiều tàu: báo tàu sắp gần SỚM nhất", () => {
    const r = cauCpa([mt({ tcpaPhut: 10 }), mt({ tcpaPhut: 3, tau: { ...mt({}).tau, ten: null } })], hl);
    expect(r).toBe("Một tàu sẽ cách 0.2 hl sau 3 phút");
  });
});
