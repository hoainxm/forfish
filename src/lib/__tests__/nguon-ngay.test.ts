import { describe, expect, it } from "vitest";
import { dayNgay, giaiMaLuoi, laDuongKho, loiGoi, maHoaLuoi, NGUON_NGAY, type GoiNguonNgay } from "../nguon-ngay";

const goiMau = (sua: Partial<GoiNguonNgay> = {}): GoiNguonNgay => {
  const vals = [Math.log10(0.12), Math.log10(3.4), Number.NaN, -1.5, 0, 1.2];
  return {
    v: 1,
    nguon: "chl-olci-s3a",
    ngay: "2026-10-30",
    dataset: "noaacwS3AOLCIchlaDaily",
    bien: "chlor_a",
    donVi: "log10(mg/m3)",
    luoi: { lat0: 5, lon0: 102, buoc: 0.05, nlat: 2, nlon: 3 },
    tiLe: 0.001,
    lech: 0,
    du: maHoaLuoi(vals, 0.001, 0),
    phu: 5 / 6,
    taiLuc: "2026-11-04T14:00:00Z",
    ...sua,
  };
};

describe("lưới int16 — mã/giải đối xứng (Python quet.py mã y hệt)", () => {
  it("giữ số tới tiLe, NaN ⇒ không có", () => {
    const g = goiMau();
    const out = giaiMaLuoi(g);
    expect(out[0]).toBeCloseTo(Math.log10(0.12), 3);
    expect(out[1]).toBeCloseTo(Math.log10(3.4), 3);
    expect(Number.isNaN(out[2])).toBe(true);
    expect(out[5]).toBeCloseTo(1.2, 3);
  });
  it("ngoài dải int16 ⇒ coi là không có, không cắt bừa về trần", () => {
    const out = giaiMaLuoi({ du: maHoaLuoi([40, 1], 0.001, 0), tiLe: 0.001, lech: 0, luoi: { lat0: 0, lon0: 0, buoc: 1, nlat: 1, nlon: 2 } });
    expect(Number.isNaN(out[0])).toBe(true);
    expect(out[1]).toBeCloseTo(1, 3);
  });
});

describe("loiGoi — ranh giới tin cậy của gói GPU gửi lên", () => {
  const HOM_NAY = "2026-11-04";
  it("gói đúng ⇒ null", () => expect(loiGoi(goiMau(), HOM_NAY)).toBeNull());
  it.each([
    ["nguồn lạ", { nguon: "../../x" as never }],
    ["ngày sai định dạng", { ngay: "30/10/2026" }],
    ["ngày ở tương lai", { ngay: "2026-11-05" }],
    ["du lệch cỡ lưới", { du: maHoaLuoi([1, 2], 0.001, 0) }],
    ["lưới quá cỡ", { luoi: { lat0: 5, lon0: 102, buoc: 0.05, nlat: 5000, nlon: 3 } }],
    ["tiLe/lech sai", { tiLe: 0 }],
    ["phu sai", { phu: 2 }],
    ["thanhPhan sai", { thanhPhan: { "khong-co": 3 } }],
  ])("%s", (loi, sua) => expect(loiGoi(goiMau(sua as Partial<GoiNguonNgay>), HOM_NAY)).toBe(loi));
  it("không phải object / sai phiên bản", () => {
    expect(loiGoi(null, HOM_NAY)).toBe("không phải object");
    expect(loiGoi({ ...goiMau(), v: 2 }, HOM_NAY)).toBe("sai phiên bản");
  });
  it("có đủ 7 nguồn phù du + bản ghép", () => {
    expect(Object.keys(NGUON_NGAY).filter((k) => k.startsWith("chl-"))).toHaveLength(8);
  });
});

describe("dayNgay / laDuongKho", () => {
  it("dải ngày bao hai đầu, có trần", () => {
    expect(dayNgay("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(dayNgay("2026-11-02", "2026-10-30")).toBeNull();
    expect(dayNgay("2026-01-01", "2026-12-31")).toBeNull(); // > 62 ngày
    expect(dayNgay("x", "2026-10-30")).toBeNull();
  });
  it("chỉ nhận đường dẫn kho thật, chặn đi ngược thư mục", () => {
    expect(laDuongKho("weather/2026/2026-11-04/grid_d16.json.gz")).toBe(true);
    expect(laDuongKho("nguon-ngay/2026/2026-10-30/chl-ghep.json.gz")).toBe(true);
    expect(laDuongKho("weather/2026/2026-11-04/../../user-docs/a.json.gz")).toBe(false);
    expect(laDuongKho("user-docs/2026/2026-11-04/a.json.gz")).toBe(false);
    expect(laDuongKho("weather/2025/2026-11-04/a.json.gz")).toBe(false); // năm lệch ngày
    expect(laDuongKho("weather/2026/2026-11-04/.json.gz")).toBe(false);
  });
});
