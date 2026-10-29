import { describe, expect, it } from "vitest";
import { congNm, cpaTcpa, khungRadar, mucTieuGeoJson, radarGeoJson, demMuc, dongPhuTau, huongChu, lechNm, locMucTieu, quangNgan, quetQuanh, tcpaLabel, tomTatNguyCo, vanToc, xepMuc } from "@/lib/ais-cpa";
import type { TauAis, TauAisBan } from "@/lib/tau-ais";

const GOC = { lat: 10.3, lon: 107.1 };
const LUC = "2026-10-29T03:00:00.000Z";
const NOW = Date.parse(LUC);

function tau(p: Partial<TauAis> & { x: number; y: number }): TauAis {
  const pos = congNm(GOC, p.x, p.y);
  return { id: p.id ?? "t", ten: p.ten ?? "TAU", loai: p.loai ?? 2, co: "VN", lat: pos.lat, lon: pos.lon, kn: p.kn ?? null, huong: p.huong ?? null, mui: null, phut: p.phut ?? 0, dai: null, dich: null };
}
const ban = (tau: TauAis[]): TauAisBan => ({ v: 1, luc: LUC, soTau: tau.length, tau });

describe("ais-cpa — hình học", () => {
  it("lechNm/congNm đi về khớp nhau", () => {
    const p = congNm(GOC, 3, -2);
    const r = lechNm(GOC, p);
    expect(r.x).toBeCloseTo(3, 6);
    expect(r.y).toBeCloseTo(-2, 6);
  });
  it("hướng không rõ hoặc dưới ngưỡng ⇒ coi như đứng", () => {
    expect(vanToc(5, null)).toEqual({ vx: 0, vy: 0 });
    expect(vanToc(0.2, 90)).toEqual({ vx: 0, vy: 0 });
    const v = vanToc(10, 90);
    expect(v.vx).toBeCloseTo(10);
    expect(v.vy).toBeCloseTo(0);
  });
  it("tàu lao thẳng vào: CPA 0, TCPA = cách / tốc độ", () => {
    // cách 2 hải lý phía Bắc, đi về Nam 12 hải lý/giờ ⇒ 10 phút
    const r = cpaTcpa({ x: 0, y: 2 }, { vx: 0, vy: -12 });
    expect(r.cpaNm).toBeCloseTo(0);
    expect(r.tcpaPhut).toBeCloseTo(10);
  });
  it("đi ngang cách 1 hải lý: CPA 1", () => {
    const r = cpaTcpa({ x: -3, y: 1 }, { vx: 6, vy: 0 });
    expect(r.cpaNm).toBeCloseTo(1);
    expect(r.tcpaPhut).toBeCloseTo(30);
  });
  it("cùng vận tốc ⇒ không tính được", () => {
    expect(cpaTcpa({ x: 1, y: 1 }, { vx: 0, vy: 0 })).toEqual({ cpaNm: null, tcpaPhut: null });
  });
});

describe("ais-cpa — xếp mức", () => {
  it("ngưỡng nguy / cảnh / an / đứng", () => {
    expect(xepMuc(0.3, 10, 8, false)).toBe("nguy");
    expect(xepMuc(1.2, 25, 8, false)).toBe("canh");
    expect(xepMuc(3, 10, 8, false)).toBe("an");
    expect(xepMuc(0.3, -5, 8, false)).toBe("an"); // đã qua điểm gần nhất
    expect(xepMuc(null, null, 0, false)).toBe("dung");
  });
  it("tin cũ không bao giờ báo nguy", () => {
    expect(xepMuc(0.1, 5, 8, true)).toBe("an");
  });
});

describe("ais-cpa — quét quanh tàu mình", () => {
  const minh = { pos: GOC, speedKmh: 0, headingDeg: null };
  it("lọc theo bán kính, xếp nguy trước, ước vị trí theo tuổi tin", () => {
    const ds = quetQuanh(
      ban([
        tau({ id: "xa", x: 0, y: 20, kn: 10, huong: 90 }),
        tau({ id: "an", x: 3, y: 0, kn: 10, huong: 90 }),
        // cách 3 hải lý Bắc, tin 6 phút trước, đi Nam 12 hải lý/giờ ⇒ giờ còn ~1,8 hải lý, sắp tới
        tau({ id: "lao", x: 0, y: 3, kn: 12, huong: 180, phut: 6 }),
        tau({ id: "dung", x: -1, y: -1 }),
      ]),
      minh,
      6,
      NOW,
    );
    expect(ds.map((m) => m.tau.id)).toEqual(["lao", "an", "dung"]);
    expect(ds[0].muc).toBe("nguy");
    expect(ds[0].cachNm).toBeCloseTo(1.8, 1);
    expect(ds[0].phuongVi).toBeCloseTo(0, 0);
    expect(ds[0].tcpaPhut).toBeCloseTo(9, 0);
    expect(demMuc(ds)).toEqual({ nguy: 1, canh: 0, an: 1, dung: 1 });
  });
  it("tàu mình chạy thì CPA tính theo vận tốc tương đối", () => {
    // tàu mình đi Bắc 10 hải lý/giờ, tàu kia đứng yên ngay trước 2 hải lý ⇒ 12 phút nữa đụng
    const ds = quetQuanh(ban([tau({ id: "a", x: 0, y: 2, kn: 0 })]), { pos: GOC, speedKmh: 18.52, headingDeg: 0 }, 6, NOW);
    expect(ds[0].cpaNm).toBeCloseTo(0);
    expect(ds[0].tcpaPhut).toBeCloseTo(12, 0);
    // tàu đứng yên nhưng mình đang lao vào ⇒ vẫn báo nguy
    expect(ds[0].muc).toBe("nguy");
  });
  it("tin quá cũ: không đoán quá trần, không báo nguy", () => {
    const ds = quetQuanh(ban([tau({ id: "c", x: 0, y: 5, kn: 12, huong: 180, phut: 90 })]), minh, 6, NOW);
    expect(ds[0].tinCu).toBe(true);
    expect(ds[0].muc).toBe("an");
    expect(ds[0].cachNm).toBeCloseTo(1, 1); // 5 − 12×0,5 giờ (trần 30 phút, không phải 90) = −1 ⇒ cách 1
  });
  it("lọc chip", () => {
    const ds = quetQuanh(
      ban([tau({ id: "lao", x: 0, y: 1, kn: 12, huong: 180 }), tau({ id: "hang", loai: 7, x: 2, y: 0 })]),
      minh,
      6,
      NOW,
    );
    expect(locMucTieu(ds, "gan").map((m) => m.tau.id)).toEqual(["lao"]);
    expect(locMucTieu(ds, "ca").map((m) => m.tau.id)).toEqual(["lao"]);
    expect(locMucTieu(ds, "tat")).toHaveLength(2);
  });
  it("nhãn TCPA", () => {
    expect(tcpaLabel(null)).toBe("không đổi");
    expect(tcpaLabel(-3)).toBe("đã qua");
    expect(tcpaLabel(12.4)).toBe("12 phút");
    expect(tcpaLabel(65)).toBe("1 giờ 05");
  });
});

describe("ais-cpa — câu cho bà con", () => {
  const minh = { pos: GOC, speedKmh: 0, headingDeg: null };
  it("tóm tắt nguy cơ: nguy / cảnh / an / chưa GPS", () => {
    const nguy = quetQuanh(ban([tau({ id: "a", x: 0, y: 1, kn: 12, huong: 180 })]), minh, 6, NOW);
    expect(tomTatNguyCo(nguy, true, 6)).toEqual({ muc: "nguy", cau: "1 tàu sắp đi sát dưới 930 m · trong 20 phút" });
    const canh = quetQuanh(ban([tau({ id: "b", x: 1, y: 4, kn: 10, huong: 180 })]), minh, 6, NOW);
    expect(tomTatNguyCo(canh, true, 6).muc).toBe("canh");
    expect(tomTatNguyCo([], true, 6)).toEqual({ muc: "an", cau: "Không có tàu nào trong 6 hải lý" });
    expect(tomTatNguyCo(nguy, false, 6).muc).toBe("chua-gps");
  });
  it("hướng chữ + quãng ngắn", () => {
    expect(huongChu(0)).toBe("Bắc");
    expect(huongChu(44)).toBe("Đông Bắc");
    expect(huongChu(359)).toBe("Bắc");
    expect(quangNgan(0.14)).toBe("260 m");
    expect(quangNgan(0.001)).toBe("10 m");
    expect(quangNgan(2)).toBe("3,7 km");
  });
  it("dòng phụ: tàu tới gần nói đi sát bao nhiêu sau bao lâu, còn lại nói cách bao xa phía nào", () => {
    const [lao] = quetQuanh(ban([tau({ id: "a", x: 0, y: 1, kn: 12, huong: 180 })]), minh, 6, NOW);
    expect(dongPhuTau(lao, true)).toBe("Đi sát 10 m sau 5 phút");
    expect(dongPhuTau(lao, false)).toBe("Cách 1,0 hải lý · phía Bắc");
    const [dung] = quetQuanh(ban([tau({ id: "d", x: 2, y: 0 })]), minh, 6, NOW);
    expect(dongPhuTau(dung, true)).toBe("Cách 2,0 hải lý · phía Đông · đang đứng");
  });
});

describe("ais-cpa — radar trên nền bản đồ", () => {
  it("ba vòng tầm đúng bán kính, nhãn hải lý + km, vạch mũi khi biết hướng", () => {
    const fc = radarGeoJson(GOC, 6, 90);
    const vong = fc.features.filter((f) => f.properties.kind === "vong");
    expect(vong).toHaveLength(3);
    const ngoai = vong[2].geometry as GeoJSON.LineString;
    for (const [lon, lat] of ngoai.coordinates) expect(Math.hypot(lechNm(GOC, { lat, lon }).x, lechNm(GOC, { lat, lon }).y)).toBeCloseTo(6, 1);
    expect(fc.features.filter((f) => f.properties.kind === "nhan").map((f) => f.properties.nhan)).toEqual(["2 hl · 3,7 km", "4 hl · 7,4 km", "6 hl · 11,1 km"]);
    expect(fc.features.some((f) => f.properties.kind === "mui")).toBe(true);
    expect(radarGeoJson(GOC, 6, null).features.some((f) => f.properties.kind === "mui")).toBe(false);
  });
  it("mục tiêu: chấm + vạch 12 phút cho tàu chạy, đứng yên chỉ có chấm; đánh dấu tàu chọn", () => {
    const ds = quetQuanh(ban([tau({ id: "a", x: 0, y: 1, kn: 10, huong: 180 }), tau({ id: "b", x: 2, y: 0 })]), { pos: GOC, speedKmh: 0, headingDeg: null }, 6, NOW);
    const fc = mucTieuGeoJson(ds, "b");
    expect(fc.features.filter((f) => f.properties.kind === "tau")).toHaveLength(2);
    const vec = fc.features.filter((f) => f.properties.kind === "vec");
    expect(vec).toHaveLength(1);
    const [[lon0, lat0], [lon1, lat1]] = (vec[0].geometry as GeoJSON.LineString).coordinates;
    const d = lechNm({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 });
    expect(d.y).toBeCloseTo(-1, 2); // 10 hải lý/h × 6 phút về Nam
    expect(fc.features.find((f) => f.properties.id === "b" && f.properties.kind === "tau")?.properties.chon).toBe(1);
  });
  it("khung bao ôm đúng vòng ngoài", () => {
    const [[w, s], [e, n]] = khungRadar(GOC, 6);
    expect(lechNm(GOC, { lat: n, lon: e }).y).toBeCloseTo(6, 3);
    expect(lechNm(GOC, { lat: s, lon: w }).x).toBeCloseTo(-6, 2);
  });
});

describe("ais-cpa — điểm gần nhau nhất (CPA) trên bản đồ", () => {
  it("tàu lao vào: điểm CPA của hai tàu trùng chỗ mình; có đường nối + nhãn phút", () => {
    const ds = quetQuanh(ban([tau({ id: "a", x: 0, y: 2, kn: 12, huong: 180 })]), { pos: GOC, speedKmh: 0, headingDeg: null }, 6, NOW);
    const m = ds[0];
    expect(m.cpaMinh).not.toBeNull();
    const d = lechNm(m.cpaMinh!, m.cpaTau!);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(0, 3);
    const fc = mucTieuGeoJson(ds, null);
    expect(fc.features.some((f) => f.properties.kind === "cpa")).toBe(true);
    expect(fc.features.find((f) => f.properties.kind === "cpa-nhan")?.properties.nhan).toBe("10 phút");
  });
  it("tàu an toàn, không chọn ⇒ không vẽ đường CPA; tàu đã qua ⇒ không có điểm CPA", () => {
    const ds = quetQuanh(ban([tau({ id: "b", x: 3, y: 0, kn: 10, huong: 90 })]), { pos: GOC, speedKmh: 0, headingDeg: null }, 6, NOW);
    expect(ds[0].cpaMinh).toBeNull();
    expect(mucTieuGeoJson(ds, null).features.some((f) => f.properties.kind === "cpa")).toBe(false);
  });
});
