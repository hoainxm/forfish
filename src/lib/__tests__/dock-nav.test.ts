import { describe, expect, it } from "vitest";

import { DOCK, dockActive } from "@/lib/dock-nav";

describe("dock 5 mục — Trang chủ · Bản đồ · Tàu tôi · Chợ cá · Vật tư", () => {
  it("đúng năm mục, đúng thứ tự", () => {
    expect(DOCK.map((d) => d.label)).toEqual(["Trang chủ", "Bản đồ", "Tàu tôi", "Chợ cá", "Vật tư"]);
    expect(DOCK.map((d) => d.href)).toEqual(["/", "/ngu-truong", "/tau", "/tien", "/cho"]);
  });
  it("mỗi việc một chỗ: route nào sáng mục nấy", () => {
    const ky: [string, string][] = [
      ["/", "trang-chu"],
      ["/ngu-truong", "ban-do"], ["/cang", "ban-do"],
      ["/tau", "tau-toi"], ["/nguoi", "tau-toi"], ["/giay-to", "tau-toi"],
      ["/tien", "cho-ca"], ["/gia-ca", "cho-ca"],
      ["/cho", "vat-tu"], ["/cho/sp/1", "vat-tu"], ["/cho/don", "vat-tu"], ["/cho/gio", "vat-tu"], ["/ban-hang", "vat-tu"],
    ];
    for (const [p, id] of ky) expect(dockActive(p), p).toBe(id);
  });
  it("không khớp nhầm tiền tố ('/taubien' ≠ '/tau', '/chokhac' ≠ '/cho'); màn lạ ⇒ không mục nào", () => {
    expect(dockActive("/taubien")).toBeNull();
    expect(dockActive("/chokhac")).toBeNull();
    expect(dockActive("/login")).toBeNull();
  });
});
