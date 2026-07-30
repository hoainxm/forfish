import { describe, expect, it } from "vitest";
import {
  can,
  clonePermissions,
  DEFAULT_MANAGER_PERMISSIONS,
  emptyPermissions,
  isManagerTab,
  MANAGER_TABS,
  normalizePermissions,
  PERM_ACTIONS,
  visibleTabs,
  type StaffPermissions,
} from "@/lib/staff-permissions";

describe("normalizePermissions — fail-closed + preset mặc định", () => {
  it("null/undefined → preset mặc định (xem+tạo+sửa, KHÔNG xóa) cả 5 tab", () => {
    for (const raw of [null, undefined]) {
      const p = normalizePermissions(raw);
      for (const tab of MANAGER_TABS) {
        expect(p[tab]).toEqual({
          view: true,
          create: true,
          edit: true,
          delete: false,
        });
      }
    }
  });

  it("rác (số/mảng/JSON hỏng) → preset mặc định", () => {
    for (const raw of [42, [], "{bad json", "null-ish"]) {
      const p = normalizePermissions(raw);
      expect(p["tai-khoan"]).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: false,
      });
    }
  });

  it("object thiếu tab → tab đó tất cả false (fail-closed), không rơi về preset", () => {
    const p = normalizePermissions({ "tai-khoan": { view: true } });
    expect(p["tai-khoan"]).toEqual({
      view: true,
      create: false,
      edit: false,
      delete: false,
    });
    // tab không khai báo → khóa hết
    expect(p["san-pham"]).toEqual({
      view: false,
      create: false,
      edit: false,
      delete: false,
    });
  });

  it("chỉ coi true là true (truthy khác bị ép về false)", () => {
    const p = normalizePermissions({
      "cho-ban": { view: 1, create: "yes", edit: true, delete: null },
    });
    expect(p["cho-ban"]).toEqual({
      view: false,
      create: false,
      edit: true,
      delete: false,
    });
  });

  it("parse được chuỗi JSON hợp lệ (cột jsonb đôi khi trả string)", () => {
    const p = normalizePermissions(
      JSON.stringify({ "thong-bao": { view: true, create: true } }),
    );
    expect(p["thong-bao"].view).toBe(true);
    expect(p["thong-bao"].create).toBe(true);
    expect(p["thong-bao"].delete).toBe(false);
  });

  it("trả object MỚI — không giữ tham chiếu tới hằng đông cứng", () => {
    const p = normalizePermissions(null);
    p["tai-khoan"].delete = true; // không được ném (không phải object đông cứng)
    expect(DEFAULT_MANAGER_PERMISSIONS["tai-khoan"].delete).toBe(false);
  });
});

describe("can — admin bỏ qua, quản lý fail-closed", () => {
  const perms: StaffPermissions = normalizePermissions({
    "tai-khoan": { view: true, edit: true },
  });
  it("có cờ → true; thiếu cờ → false", () => {
    expect(can(perms, "tai-khoan", "view")).toBe(true);
    expect(can(perms, "tai-khoan", "edit")).toBe(true);
    expect(can(perms, "tai-khoan", "delete")).toBe(false);
    expect(can(perms, "san-pham", "view")).toBe(false);
  });
  it("perms null/undefined → false hết", () => {
    for (const action of PERM_ACTIONS) {
      expect(can(null, "tai-khoan", action)).toBe(false);
      expect(can(undefined, "cho-ban", action)).toBe(false);
    }
  });
});

describe("visibleTabs — theo cờ view, giữ thứ tự", () => {
  it("chỉ tab có view, đúng thứ tự MANAGER_TABS", () => {
    const p = normalizePermissions({
      "cho-ban": { view: true },
      "tai-khoan": { view: true },
      "san-pham": { view: false },
    });
    expect(visibleTabs(p)).toEqual(["tai-khoan", "cho-ban"]);
  });
  it("mặc định → cả 5 tab (đều có view)", () => {
    expect(visibleTabs(normalizePermissions(null))).toEqual([...MANAGER_TABS]);
  });
  it("null → rỗng", () => {
    expect(visibleTabs(null)).toEqual([]);
  });
});

describe("helpers", () => {
  it("isManagerTab chỉ nhận 5 tab được phép", () => {
    expect(isManagerTab("tai-khoan")).toBe(true);
    expect(isManagerTab("cho-ban")).toBe(true);
    expect(isManagerTab("vung-bien")).toBe(false); // admin-only cứng
    expect(isManagerTab("he-thong")).toBe(false);
  });
  it("emptyPermissions(true/false) đủ 5 tab × 4 cờ", () => {
    const off = emptyPermissions(false);
    const on = emptyPermissions(true);
    for (const tab of MANAGER_TABS) {
      expect(off[tab]).toEqual({
        view: false,
        create: false,
        edit: false,
        delete: false,
      });
      expect(on[tab]).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: true,
      });
    }
  });
  it("clonePermissions tách tham chiếu", () => {
    const a = normalizePermissions(null);
    const b = clonePermissions(a);
    b["tai-khoan"].view = false;
    expect(a["tai-khoan"].view).toBe(true);
  });
});
