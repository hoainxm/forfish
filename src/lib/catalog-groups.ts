// NHÓM DANH MỤC CỬA HÀNG (2026-08-11) — logic THUẦN, client-safe. Tách 3 nhóm
// hiện trên tab Sản phẩm/Cửa hàng và trong web quản trị. Dùng chung: UI chủ tàu
// (gom nhóm), form quản trị (chọn nhóm), route (validate). Khớp check constraint
// migration 0032 (product_listings.group).

export type CatalogGroupId = "dien_tu" | "co_dien" | "nhu_yeu_pham";

export const CATALOG_GROUPS: readonly CatalogGroupId[] = [
  "dien_tu",
  "co_dien",
  "nhu_yeu_pham",
] as const;

export const GROUP_LABELS: Record<CatalogGroupId, string> = {
  dien_tu: "Điện tử",
  co_dien: "Cơ điện",
  nhu_yeu_pham: "Nhu yếu phẩm",
};

/** Nhãn cho dòng chưa gán nhóm (group=null) — gom cuối, không giấu đi. */
export const GROUP_OTHER_LABEL = "Khác";

export function isCatalogGroup(v: unknown): v is CatalogGroupId {
  return typeof v === "string" && (CATALOG_GROUPS as readonly string[]).includes(v);
}

/** Nhãn hiển thị của một nhóm (null/không hợp lệ → "Khác"). */
export function groupLabel(v: unknown): string {
  return isCatalogGroup(v) ? GROUP_LABELS[v] : GROUP_OTHER_LABEL;
}
