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
  | "cho-vat-tu"
  | "yeu-cau"
  | "vung-bien"
  | "cho-ban"
  | "thong-bao"
  | "du-lieu"
  | "he-thong"
  | "phan-quyen"
  | "nhat-ky"
  | "kairos"
  | "bao-cao";

/** Nhãn MỘT nguồn cho cả admin lẫn quản lý (trước lệch: "Chỗ bán" vs "Điểm thu mua"). */
export const ADMIN_TAB_LABEL: Record<AdminTab, string> = {
  "tai-khoan": "Tài khoản",
  "don-hang": "Đơn hàng",
  // Chợ vật tư (sàn đa người bán, gộp từ feat/san-thuong-mai 2026-10-18) — admin-only
  "cho-vat-tu": "Cửa hàng",
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
  // Kairos — đọc báo + mạng xã hội của bà con (14 §3.11): báo xấu, hàng chờ agent, Chính thức
  kairos: "Kairos",
  // Báo cáo số liệu (2026-10-28) — admin-only: số TOÀN hệ thống, quản lý chỉ thấy khách mình (R3)
  "bao-cao": "Báo cáo",
};

export type AdminNavGroupId = "tong-quan" | "khach" | "cho" | "noi-dung" | "nhan-su" | "he-thong";
export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  tabs: AdminTab[];
};

/** Thứ tự nhóm = tần suất dùng: chăm khách hằng ngày → nội dung → nhân sự → hệ thống.
 *  "Tổng quan" đứng ĐẦU (2026-10-28): báo cáo là chỗ nhìn chung trước khi đi vào việc. */
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  { id: "tong-quan", label: "Tổng quan", tabs: ["bao-cao"] },
  {
    id: "khach",
    label: "Khách hàng",
    tabs: ["tai-khoan", "yeu-cau", "thong-bao"],
  },
  /*  CHỢ VẬT TƯ (gộp feat/san-thuong-mai 2026-10-18): tab "Cửa hàng" là sàn thật;
      "Sản phẩm" + "Đơn hàng" là danh mục/đơn CŨ đã nghỉ từ 07/09 (ADR 0014) — để
      cạnh nhau cho người trực thấy ngay cái nào là chỗ làm việc, cái nào chỉ để tra. */
  { id: "cho", label: "Chợ vật tư", tabs: ["cho-vat-tu", "san-pham", "don-hang"] },
  {
    id: "noi-dung",
    label: "Nội dung",
    tabs: ["cho-ban", "canh-bao", "vung-bien", "kairos"],
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
