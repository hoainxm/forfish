import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_TAB_LABEL,
  ALL_ADMIN_TABS,
  groupOfTab,
  groupVisibleTabs,
  tabFromHash,
} from "@/lib/admin-nav";
import { MANAGER_TABS } from "@/lib/staff-permissions";

describe("ADMIN_NAV_GROUPS", () => {
  it("mỗi tab có nhãn và nằm ĐÚNG MỘT nhóm (không sót, không trùng)", () => {
    const labels = Object.keys(ADMIN_TAB_LABEL).sort();
    expect([...ALL_ADMIN_TABS].sort()).toEqual(labels);
    expect(new Set(ALL_ADMIN_TABS).size).toBe(ALL_ADMIN_TABS.length);
  });
  it("mọi tab của quản lý đều có chỗ trong điều hướng", () => {
    for (const t of MANAGER_TABS) expect(ALL_ADMIN_TABS).toContain(t);
  });
  it("nhóm không quá 4 tab (hàng tab mobile không phải cuộn)", () => {
    for (const g of ADMIN_NAV_GROUPS) expect(g.tabs.length).toBeLessThanOrEqual(4);
  });
});

describe("groupVisibleTabs", () => {
  it("admin thấy đủ 4 nhóm", () => {
    expect(groupVisibleTabs(ALL_ADMIN_TABS).map((g) => g.id)).toEqual([
      "khach",
      "noi-dung",
      "nhan-su",
      "he-thong",
    ]);
  });
  it("quản lý chỉ có tab nghiệp vụ → bỏ nhóm rỗng, giữ thứ tự", () => {
    const g = groupVisibleTabs(["san-pham", "tai-khoan"]);
    expect(g.map((x) => [x.id, x.tabs])).toEqual([
      ["khach", ["tai-khoan"]],
      ["noi-dung", ["san-pham"]],
    ]);
  });
  it("không tab nào → rỗng", () => {
    expect(groupVisibleTabs([])).toEqual([]);
  });
});

describe("groupOfTab / tabFromHash", () => {
  it("tìm đúng nhóm", () => {
    expect(groupOfTab(ADMIN_NAV_GROUPS, "nhat-ky")?.id).toBe("nhan-su");
    expect(groupOfTab(groupVisibleTabs(["tai-khoan"]), "nhat-ky")).toBeNull();
  });
  it("hash hợp lệ → tab; lạ/trống → null", () => {
    expect(tabFromHash("#phan-quyen")).toBe("phan-quyen");
    expect(tabFromHash("don-hang")).toBe("don-hang");
    expect(tabFromHash("#constructor")).toBeNull();
    expect(tabFromHash("")).toBeNull();
    expect(tabFromHash(undefined)).toBeNull();
  });
});
