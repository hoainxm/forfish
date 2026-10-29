import { describe, expect, it } from "vitest";
import { KHOI_TAU, khoiCuaTab } from "@/lib/tau-khoi";

describe("khoiCuaTab — deep-link /tau?tab= cuộn tới khối", () => {
  it("dich-vu (dải việc gấp Bảo dưỡng/SDVICO, Sen Biển) ⇒ khối Dịch vụ", () => {
    expect(khoiCuaTab("dich-vu")).toBe(KHOI_TAU["dich-vu"]);
  });
  it("san-pham (thông báo đơn cũ) ⇒ khối Thiết bị", () => {
    expect(khoiCuaTab("san-pham")).toBe(KHOI_TAU["san-pham"]);
  });
  it("giay-to / tau-cua-toi / tab lạ / trống ⇒ đứng đầu trang", () => {
    for (const t of ["giay-to", "tau-cua-toi", "toString", "__proto__", "", null, undefined]) {
      expect(khoiCuaTab(t)).toBeNull();
    }
  });
});
