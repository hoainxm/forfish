import { describe, expect, it } from "vitest";

import { DOCK, dockActive } from "@/lib/dock-nav";

/*  AppShell không vẽ dock khi `dockActive` null (rà FB 2026-10-25, VO-APP-06 — 07 §5 hàng 8–9
    "không dock"): năm màn đăng nhập/pháp lý là luồng tập trung, thoát bằng "‹". Mọi route dock
    (và route cũ redirect) vẫn phải có mục sáng — mất dock ở đó là mất đường đi. */
describe("màn không dock (AppShell gác bằng dockActive)", () => {
  it("năm màn đăng nhập/pháp lý ⇒ null", () => {
    for (const p of ["/login", "/dang-ky", "/quen-mat-khau", "/doi-mat-khau", "/quyen-rieng-tu"])
      expect(dockActive(p), p).toBeNull();
  });
  it("mọi mục dock và route con ⇒ có mục sáng", () => {
    for (const d of DOCK) expect(dockActive(d.href), d.href).toBe(d.id);
    for (const p of ["/cang", "/nguoi", "/giay-to", "/van-hanh", "/thuyen-vien", "/gia-ca", "/ban-hang/don/1", "/cho/yeu-cau/moi", "/kairos/u/1", "/k/abc"])
      expect(dockActive(p), p).not.toBeNull();
  });
});
