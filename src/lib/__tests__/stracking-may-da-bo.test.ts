import { describe, expect, it } from "vitest";
import { laMayDaBo } from "@/lib/stracking/may-da-bo.mjs";

describe("máy S-Tracking đã huỷ / thu hồi", () => {
  it("tiền tố DE/de/Thu… hoặc nhóm DELETE ⇒ đã bỏ (mẫu thật kho 05/11)", () => {
    for (const ten of ["DEKG-93388-TS", "DE-93447-TS", "de-92123-TS", "DEA-94093-TS", "dea-1778B-TS", "DEAG-92972-TS", "ThuCM-99433-TS", "ThuhCM-95094-TS", "ThuhoiCM-95994-TS", "THUCM-95223-TS", "thuCM-1-TS"])
      expect(laMayDaBo({ ten_tau: ten }), ten).toBe(true);
    expect(laMayDaBo({ ten_tau: "DE-93621-TS", nhom: "04.DELETE" })).toBe(true);
    expect(laMayDaBo({ tenTau: "KG-1-TS", nhom: "04.DELETE" })).toBe(true);
  });

  it("tàu thật không bị nhầm — kể cả mã tỉnh gần giống", () => {
    for (const ten of ["KG-93388-TS", "TH-91342-TS", "TTH-1-TS", "BTh-2-TS", "QNg-3-TS", "BV-91234-TS", null])
      expect(laMayDaBo({ ten_tau: ten, nhom: "Lư Thị Bích Trân" }), String(ten)).toBe(false);
    expect(laMayDaBo(null as never)).toBe(false);
  });
});
