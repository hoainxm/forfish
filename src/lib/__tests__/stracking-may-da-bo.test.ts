import { describe, expect, it } from "vitest";
import { laMayDaBo } from "@/lib/stracking/may-da-bo.mjs";

describe("máy S-Tracking đã huỷ / thu hồi", () => {
  it("tiền tố DE/de/Thu… hoặc nhóm DELETE ⇒ đã bỏ (mẫu thật kho 05/11)", () => {
    for (const ten of ["DEKG-93388-TS", "DE-93447-TS", "de-92123-TS", "DEA-94093-TS", "dea-1778B-TS", "DEAG-92972-TS", "ThuCM-99433-TS", "ThuhCM-95094-TS", "ThuhoiCM-95994-TS", "THUCM-95223-TS", "thuCM-1-TS"])
      expect(laMayDaBo({ ten_tau: ten }), ten).toBe(true);
    expect(laMayDaBo({ ten_tau: "DE-93621-TS", nhom: "04.DELETE" })).toBe(true);
    expect(laMayDaBo({ tenTau: "KG-1-TS", nhom: "04.DELETE" })).toBe(true);
  });

  it("bỏ đọng: không cập nhật >1 năm VÀ hết hạn / không hạn ⇒ bỏ; còn hạn hoặc mới cập nhật ⇒ giữ", () => {
    const now = Date.parse("2026-11-05T10:00:00Z");
    const cu = "2025-09-25T00:00:00Z"; // > 365 ngày
    expect(laMayDaBo({ ten_tau: "NA-94848-TS", cap_nhat_nguon: cu, het_han: "2025-10-23" }, now)).toBe(true);
    expect(laMayDaBo({ tenTau: "BHC--95722-TS", capNhatNguon: "2021-07-19T00:00:00Z", hetHan: null }, now)).toBe(true);
    // đứng lâu nhưng còn hạn ⇒ giữ (tàu nằm bờ vẫn đóng cước)
    expect(laMayDaBo({ ten_tau: "TB-90018-TS", cap_nhat_nguon: "2024-12-21T00:00:00Z", het_han: "2027-01-31" }, now)).toBe(false);
    // hết hạn nhưng mới cập nhật (< 1 năm) ⇒ giữ — vẫn cần nhắc gia hạn
    expect(laMayDaBo({ ten_tau: "TH-91342-TS", cap_nhat_nguon: "2026-05-21T00:00:00Z", het_han: "2025-04-04" }, now)).toBe(false);
    // không có giờ cập nhật ⇒ không đoán là bỏ
    expect(laMayDaBo({ ten_tau: "KG-1-TS", het_han: null }, now)).toBe(false);
  });

  it("tàu thật không bị nhầm — kể cả mã tỉnh gần giống", () => {
    for (const ten of ["KG-93388-TS", "TH-91342-TS", "TTH-1-TS", "BTh-2-TS", "QNg-3-TS", "BV-91234-TS", null])
      expect(laMayDaBo({ ten_tau: ten, nhom: "Lư Thị Bích Trân" }), String(ten)).toBe(false);
    expect(laMayDaBo(null as never)).toBe(false);
  });
});
