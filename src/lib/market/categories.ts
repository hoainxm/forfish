// DANH MỤC VẬT TƯ — CỐ ĐỊNH TRONG CODE (chủ dự án chốt: không bảng). Khớp check
// constraint shop_products.category (0054). Icon là TÊN component trong
// components/icons.tsx — cấm emoji (03 §4).
import type { ProductCategory } from "./types";

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  "may-dong-co", "dien-tu-hang-hai", "ngu-cu", "dau-nhot-nhien-lieu",
  "da-bao-quan", "nhu-yeu-pham", "an-toan", "phu-tung", "khac",
] as const;

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  "may-dong-co": "Máy & động cơ",
  "dien-tu-hang-hai": "Điện tử hàng hải",
  "ngu-cu": "Ngư cụ",
  "dau-nhot-nhien-lieu": "Dầu nhớt & nhiên liệu",
  "da-bao-quan": "Đá & bảo quản",
  "nhu-yeu-pham": "Nhu yếu phẩm",
  "an-toan": "An toàn",
  "phu-tung": "Phụ tùng",
  "khac": "Khác",
};

/** Icon — tên trong components/icons.tsx. Đã có: FuelIcon, StarIcon, CartIcon. Thiếu thì Core thêm vào icons.tsx (Core own file này, LEAD §5 #2). */
export const CATEGORY_ICON: Record<ProductCategory, string> = {
  "may-dong-co": "EngineIcon", "dien-tu-hang-hai": "RadarIcon", "ngu-cu": "NetIcon",
  "dau-nhot-nhien-lieu": "FuelIcon", "da-bao-quan": "IceIcon", "nhu-yeu-pham": "BasketIcon",
  "an-toan": "LifebuoyIcon", "phu-tung": "GearIcon", "khac": "BoxIcon",
};

export function isProductCategory(v: unknown): v is ProductCategory {
  return typeof v === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(v);
}
export function categoryLabel(v: unknown): string {
  return isProductCategory(v) ? CATEGORY_LABEL[v] : CATEGORY_LABEL.khac;
}
