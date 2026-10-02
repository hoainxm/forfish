// Điều hướng /quan-tri (logic THUẦN — client-safe). 12 tab phẳng trên một dải
// cuộn ngang khó tìm (2026-10-02) ⇒ gom thành 4 NHÓM theo việc người trực làm:
// desktop = cột trái liệt kê nhóm + tab; mobile = hàng nhóm + hàng tab của nhóm.
// Quyền KHÔNG ở đây: danh sách tab được thấy vẫn do vai/bảng quyền tính
// (staff-permissions.visibleTabs) — file này chỉ XẾP chỗ cho chúng.

export type AdminTab =
  | "tai-khoan"
  | "canh-bao"
  | "san-pham"
  | "don-hang"
  | "yeu-cau"
  | "vung-bien"
  | "cho-ban"
  | "thong-bao"
  | "du-lieu"
  | "he-thong"
  | "phan-quyen"
  | "nhat-ky";

/** Nhãn MỘT nguồn cho cả admin lẫn quản lý (trước lệch: "Chỗ bán" vs "Điểm thu mua"). */
export const ADMIN_TAB_LABEL: Record<AdminTab, string> = {
  "tai-khoan": "Tài khoản",
  "don-hang": "Đơn hàng",
  "yeu-cau": "Yêu cầu hỗ trợ",
  "thong-bao": "Thông báo",
  "san-pham": "Sản phẩm",
  "cho-ban": "Điểm thu mua",
  "canh-bao": "Thuyền viên",
  "vung-bien": "Vùng biển",
  "phan-quyen": "Phân quyền",
  "nhat-ky": "Nhật ký hoạt động",
  "du-lieu": "Dữ liệu hệ thống",
  "he-thong": "Cấu hình hệ thống",
};

export type AdminNavGroupId = "khach" | "noi-dung" | "nhan-su" | "he-thong";
export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  tabs: AdminTab[];
};

/** Thứ tự nhóm = tần suất dùng: chăm khách hằng ngày → nội dung → nhân sự → hệ thống. */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "khach",
    label: "Khách hàng",
    tabs: ["tai-khoan", "don-hang", "yeu-cau", "thong-bao"],
  },
  {
    id: "noi-dung",
    label: "Nội dung",
    tabs: ["san-pham", "cho-ban", "canh-bao", "vung-bien"],
  },
  { id: "nhan-su", label: "Nhân sự", tabs: ["phan-quyen", "nhat-ky"] },
  { id: "he-thong", label: "Hệ thống", tabs: ["du-lieu", "he-thong"] },
];

export const ALL_ADMIN_TABS: AdminTab[] = ADMIN_NAV_GROUPS.flatMap((g) => g.tabs);

/** Chỉ giữ tab ĐƯỢC THẤY, bỏ nhóm rỗng (quản lý thường còn 1–2 nhóm). */
export function groupVisibleTabs(visible: readonly AdminTab[]): AdminNavGroup[] {
  const set = new Set(visible);
  return ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => set.has(t)),
  })).filter((g) => g.tabs.length > 0);
}

/** Nhóm chứa tab (null nếu tab không thuộc nhóm nào trong danh sách). */
export function groupOfTab(
  groups: readonly AdminNavGroup[],
  tab: AdminTab,
): AdminNavGroup | null {
  return groups.find((g) => g.tabs.includes(tab)) ?? null;
}

/** Đọc tab từ `#hash` (giữ tab khi tải lại). Lạ → null, để người gọi tự về tab đầu. */
export function tabFromHash(hash: string | null | undefined): AdminTab | null {
  const id = (hash ?? "").replace(/^#/, "");
  return (ALL_ADMIN_TABS as string[]).includes(id) ? (id as AdminTab) : null;
}
