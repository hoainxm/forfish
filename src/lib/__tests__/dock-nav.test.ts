import { describe, expect, it } from "vitest";

import { DOCK, dockActive, dockBadge, donChoTuCo, nhanBadgeDock, type NguonBadge } from "@/lib/dock-nav";
import { nhanDem } from "@/lib/kairos/chuong";
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

describe("badge số đỏ trên dock (VO-APP-03 — chỉ Kairos + Vật tư)", () => {
  const nguon = (p: Partial<NguonBadge>): NguonBadge => ({ kairosChuaDoc: 0, donChoBan: 0, gioDong: 0, ...p });
  it("0 ⇒ không vẽ (nhanDem rỗng); 1–9 giữ số; ≥10 ⇒ 9+", () => {
    expect(dockBadge("kairos", nguon({}))).toBe(0);
    expect(nhanDem(dockBadge("kairos", nguon({})))).toBe("");
    expect(nhanDem(dockBadge("kairos", nguon({ kairosChuaDoc: 3 })))).toBe("3");
    expect(nhanDem(dockBadge("kairos", nguon({ kairosChuaDoc: 9 })))).toBe("9");
    expect(nhanDem(dockBadge("kairos", nguon({ kairosChuaDoc: 10 })))).toBe("9+");
    expect(nhanDem(dockBadge("kairos", nguon({ kairosChuaDoc: 120 })))).toBe("9+");
  });
  it("Vật tư: đơn chờ của người bán thắng; không có thì số dòng giỏ", () => {
    expect(dockBadge("vat-tu", nguon({ donChoBan: 2, gioDong: 5 }))).toBe(2);
    expect(dockBadge("vat-tu", nguon({ donChoBan: 0, gioDong: 5 }))).toBe(5);
    expect(dockBadge("vat-tu", nguon({}))).toBe(0);
  });
  it("bốn ô còn lại không bao giờ có badge; số âm/NaN ⇒ 0", () => {
    const s = nguon({ kairosChuaDoc: 4, donChoBan: 4, gioDong: 4 });
    for (const id of ["trang-chu", "ban-do", "tau-toi", "cho-ca"] as const) expect(dockBadge(id, s), id).toBe(0);
    expect(dockBadge("kairos", nguon({ kairosChuaDoc: -1 }))).toBe(0);
    expect(dockBadge("vat-tu", nguon({ gioDong: Number.NaN }))).toBe(0);
  });
  it("aria-label nói đúng thứ đang chờ", () => {
    expect(nhanBadgeDock("kairos", nguon({ kairosChuaDoc: 2 }))).toBe(", 2 chưa đọc");
    expect(nhanBadgeDock("vat-tu", nguon({ donChoBan: 1, gioDong: 3 }))).toBe(", 1 đơn chờ");
    expect(nhanBadgeDock("vat-tu", nguon({ gioDong: 3 }))).toBe(", 3 món trong giỏ");
    expect(nhanBadgeDock("cho-ca", nguon({ gioDong: 3 }))).toBe("");
  });
  it("đơn chờ đọc từ cờ mshop thô: đúng ngăn + hasShop + pending; hỏng/lệch ⇒ 0", () => {
    const ok = JSON.stringify({ phone: "0900000777", hasShop: true, at: 1, pending: 4 });
    expect(donChoTuCo(ok, "0900000777")).toBe(4);
    expect(donChoTuCo(ok, "0900000001")).toBe(0);
    expect(donChoTuCo(JSON.stringify({ phone: "0900000777", hasShop: false, at: 1, pending: 4 }), "0900000777")).toBe(0);
    expect(donChoTuCo(JSON.stringify({ phone: "0900000777", hasShop: true, at: 1 }), "0900000777")).toBe(0);
    expect(donChoTuCo("{oops", "0900000777")).toBe(0);
    expect(donChoTuCo(null, "0900000777")).toBe(0);
    expect(donChoTuCo(JSON.stringify({ phone: "0900000777", hasShop: true, at: 1, pending: "7" }), "0900000777")).toBe(0);
  });
});
