import { describe, expect, it } from "vitest";
import {
  boDau,
  datThamSo,
  docThamSo,
  ghepTuanHienTai,
  tachSdt,
  telHref,
  weekEndIso,
} from "@/lib/cho-ca";

describe("cho-ca — helper thuần khu Chợ cá", () => {
  it("boDau: bỏ dấu + đ→d, hạ chữ thường", () => {
    expect(boDau("Cá Hố")).toBe("ca ho");
    expect(boDau("Đà Nẵng")).toBe("da nang");
  });

  it("tachSdt: tách từng số theo / , ; - hoặc; telHref chỉ giữ số", () => {
    expect(tachSdt("0905 568 899 / 0902 869 888 / 0203 352 5799")).toEqual([
      "0905 568 899",
      "0902 869 888",
      "0203 352 5799",
    ]);
    expect(tachSdt("0901234567 hoặc 0909999999")).toHaveLength(2);
    expect(tachSdt("0901234567")).toEqual(["0901234567"]);
    expect(telHref("028.3759.0001")).toBe("tel:02837590001");
    expect(telHref("+84 905 568 899")).toBe("tel:+84905568899");
  });

  it("docThamSo: chỉ nhận giá trị trong danh sách, lạ thì về mặc định", () => {
    const CHO = ["gia", "tin", "dau-moi"] as const;
    expect(docThamSo("?muc=tin", "muc", CHO, "gia")).toBe("tin");
    expect(docThamSo("?muc=xxx", "muc", CHO, "gia")).toBe("gia");
    expect(docThamSo("", "muc", CHO, "gia")).toBe("gia");
    expect(docThamSo("?a=1&muc=dau-moi", "muc", CHO, "gia")).toBe("dau-moi");
  });

  it("datThamSo: đặt/xoá một tham số, giữ tham số khác, rỗng thì không để '?'", () => {
    expect(datThamSo("", "muc", "tin")).toBe("?muc=tin");
    expect(datThamSo("?muc=tin", "cho", "vua")).toBe("?muc=tin&cho=vua");
    expect(datThamSo("?muc=tin&cho=vua", "cho", null)).toBe("?muc=tin");
    expect(datThamSo("?cho=vua", "cho", null)).toBe("");
  });

  it("weekEndIso: 'dd/m – dd/m/yyyy' → ISO cuối tuần; lạ thì null", () => {
    expect(weekEndIso("30/5 – 05/6/2026")).toBe("2026-06-05");
    expect(weekEndIso("17/10 – 23/10/2026")).toBe("2026-10-23");
    expect(weekEndIso("tuần này")).toBeNull();
    expect(weekEndIso(undefined)).toBeNull();
    expect(weekEndIso("1/1 – 40/13/2026")).toBeNull();
  });

  it("ghepTuanHienTai: chỉ ghép khi tuần bảng MỚI HƠN điểm cuối", () => {
    const pts = [
      { date: "2026-10-02", minVnd: 120_000, maxVnd: 130_000 },
      { date: "2026-10-09", minVnd: 130_000, maxVnd: 140_000 },
    ];
    const moi = { date: "2026-10-23", minVnd: 135_000, maxVnd: 140_000 };
    expect(ghepTuanHienTai(pts, moi)).toHaveLength(3);
    expect(ghepTuanHienTai(pts, moi)[2]).toEqual(moi);
    // trùng tuần cuối → giữ nguyên (không đè điểm thật của kho)
    expect(ghepTuanHienTai(pts, { ...moi, date: "2026-10-09" })).toBe(pts);
    expect(ghepTuanHienTai(pts, { ...moi, date: "2026-09-01" })).toBe(pts);
    expect(ghepTuanHienTai(pts, { ...moi, date: null })).toBe(pts);
    expect(ghepTuanHienTai(pts, null)).toBe(pts);
    // chuỗi rỗng (kho chưa có loài) + tuần bảng → 1 điểm (sheet vẫn báo <2 tuần)
    expect(ghepTuanHienTai([], moi)).toHaveLength(1);
  });
});
