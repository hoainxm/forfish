// DEEP-LINK `/tau?tab=…` ⇒ KHỐI CẦN CUỘN TỚI (2026-10-29, rà hành trình A-08).
//
// /tau không còn tab từ 2026-10-19 — mọi mục xếp dọc một trang. Link cũ từ dải việc gấp
// (urgent.ts "Bảo dưỡng"/"SDVICO"), chip Sen Biển (assistant/types), thông báo đơn cũ
// (`?tab=san-pham`) trước đây rơi về đầu trang, bà con phải cuộn qua cả tủ giấy tờ.
// Nay mỗi tab cũ trỏ tới `id` của đúng khối trong tau-tabs.tsx. `giay-to` / `tau-cua-toi` / tab lạ ⇒
// null (ở đầu trang — tủ giấy tờ đã ngay dưới bộ chọn tàu, cuộn qua là che mất tàu đang chọn). `cua-hang` / `don` chuyển sang /cho — tau-tabs xử lý trước.

export const KHOI_TAU = {
  "dich-vu": "khoi-dich-vu",
  "san-pham": "khoi-thiet-bi",
} as const;

/** id khối cần cuộn tới cho giá trị `?tab=`; null = không cuộn. */
export function khoiCuaTab(tab: string | null | undefined): string | null {
  if (!tab || !Object.prototype.hasOwnProperty.call(KHOI_TAU, tab)) return null;
  return KHOI_TAU[tab as keyof typeof KHOI_TAU];
}
