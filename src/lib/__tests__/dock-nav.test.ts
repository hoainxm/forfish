import { describe, expect, it } from "vitest";

import { DOCK, dockActive } from "@/lib/dock-nav";
import { nhanHopLe } from "@/lib/labels";

describe("dock 6 mục — Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư", () => {
  it("đúng sáu mục, đúng thứ tự, tên ≤2 chữ", () => {
    expect(DOCK.map((d) => d.label)).toEqual(["Trang chủ", "Kairos", "Bản đồ", "Tàu tôi", "Chợ cá", "Vật tư"]);
    expect(DOCK.map((d) => d.href)).toEqual(["/", "/kairos", "/ngu-truong", "/tau", "/tien", "/cho"]);
    for (const d of DOCK) expect(nhanHopLe(d.label), d.label).toBe(true);
  });
  it("mỗi việc một chỗ: route nào sáng mục nấy", () => {
    const ky: [string, string][] = [
      ["/", "trang-chu"],
      ["/kairos", "kairos"], ["/kairos/u/x", "kairos"], ["/kairos/ben/sa-huynh", "kairos"], ["/kairos/p/1", "kairos"], ["/k/abc", "kairos"],
      ["/ngu-truong", "ban-do"], ["/cang", "ban-do"],
      ["/tau", "tau-toi"], ["/nguoi", "tau-toi"], ["/giay-to", "tau-toi"],
      ["/tien", "cho-ca"], ["/gia-ca", "cho-ca"],
      ["/cho", "vat-tu"], ["/cho/sp/1", "vat-tu"], ["/cho/don", "vat-tu"], ["/cho/gio", "vat-tu"], ["/ban-hang", "vat-tu"],
    ];
    for (const [p, id] of ky) expect(dockActive(p), p).toBe(id);
  });
  it("không khớp nhầm tiền tố ('/taubien' ≠ '/tau', '/kho' ≠ '/k'); màn lạ ⇒ không mục nào", () => {
    expect(dockActive("/taubien")).toBeNull();
    expect(dockActive("/chokhac")).toBeNull();
    expect(dockActive("/kho")).toBeNull();
    expect(dockActive("/kairosx")).toBeNull();
    expect(dockActive("/login")).toBeNull();
  });
});
