import { describe, expect, it } from "vitest";
import { LOAI_SIEU_NHANH, mucCanhBao, nenBao } from "@/lib/stracking/muc-canh-bao.mjs";

const GIO = 3600_000;
const NOW = Date.parse("2026-11-06T03:00:00Z");

describe("mức cảnh báo theo loại + vị trí (anh Long 06/11: \"đúng và kịp thời\")", () => {
  it("SOS / Vượt biên ngoài khơi = khẩn, đẩy, nhắc lại sau 1 giờ", () => {
    for (const loai of ["SOS", "Vượt biên"]) {
      expect(mucCanhBao({ loai, muc: "Báo động", trongBo: false })).toMatchObject({ bac: "khan", day: true, chongLapMs: GIO });
    }
  });
  it("chưa rõ vị trí ⇒ coi như ngoài khơi (nghiêng về an toàn)", () => {
    expect(mucCanhBao({ loai: "SOS", muc: "Báo động", trongBo: null }).bac).toBe("khan");
    expect(mucCanhBao({ loai: "SOS", muc: "Báo động" }).bac).toBe("khan");
  });
  it("trong bờ: tắt máy / không nguồn ngoài / sắp vượt biên ⇒ bỏ; SOS trong bờ ⇒ thường (1 lần/ngày)", () => {
    expect(mucCanhBao({ loai: "Thiết bị không sử dụng nguồn ngoài", muc: "Báo động", trongBo: true }).bac).toBe("bo");
    expect(mucCanhBao({ loai: "Tắt thiết bị", muc: "Cảnh cáo", trongBo: true }).bac).toBe("bo");
    expect(mucCanhBao({ loai: "Sắp vượt biên", muc: "Báo động", trongBo: true }).bac).toBe("bo");
    expect(mucCanhBao({ loai: "SOS", muc: "Báo động", trongBo: true })).toMatchObject({ bac: "thuong", day: true, chongLapMs: 24 * GIO });
  });
  it("thường (vd không nguồn ngoài ngoài khơi) ⇒ đẩy lên máy, tối đa 1 lần/ngày (anh Long: \"đẩy lên máy đi, tần suất ngày\")", () => {
    expect(mucCanhBao({ loai: "Thiết bị không sử dụng nguồn ngoài", muc: "Báo động", trongBo: false })).toMatchObject({ bac: "thuong", day: true, chongLapMs: 24 * GIO });
    expect(mucCanhBao({ loai: "Vùng chú ý đánh bắt", muc: "Cảnh cáo", trongBo: false })).toMatchObject({ bac: "thuong", day: true, chongLapMs: 24 * GIO });
  });
  it("loại lạ: theo cột Kiểu", () => {
    expect(mucCanhBao({ loai: "Loại mới", muc: "Báo động", trongBo: false })).toMatchObject({ bac: "cao", day: true });
    expect(mucCanhBao({ loai: "Loại mới", muc: "Cảnh cáo", trongBo: true }).bac).toBe("bo");
  });
  it("xếp nặng: SOS khẩn đứng trước sắp vượt biên, trước không nguồn ngoài", () => {
    const h = (loai: string) => mucCanhBao({ loai, muc: "Báo động", trongBo: false }).hang;
    expect(h("SOS")).toBeLessThan(h("Vượt biên"));
    expect(h("Vượt biên")).toBeLessThan(h("Sắp vượt biên"));
    expect(h("Sắp vượt biên")).toBeLessThan(h("Thiết bị không sử dụng nguồn ngoài"));
  });
});

describe("nên báo — chống lặp theo mức", () => {
  const sos = { loai: "SOS", muc: "Báo động", trongBo: false };
  it("SOS còn bắn: báo lại sau 1 giờ (luật cũ 6 giờ)", () => {
    expect(nenBao(sos, NOW, null)).toBe(true);
    expect(nenBao(sos, NOW, NOW - 30 * 60_000)).toBe(false);
    expect(nenBao(sos, NOW, NOW - GIO)).toBe(true);
  });
  it("bậc bỏ ⇒ không bao giờ báo", () => {
    expect(nenBao({ loai: "Tắt thiết bị", muc: "Cảnh cáo", trongBo: true }, NOW, null)).toBe(false);
  });
  it("lượt siêu nhanh chỉ đọc SOS + Vượt biên", () => {
    expect([...LOAI_SIEU_NHANH].sort()).toEqual(["SOS", "Vượt biên"]);
  });
});
