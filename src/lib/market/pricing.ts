// GIÁ + DÒNG HÀNG của Chợ vật tư — THUẦN. Server dựng dòng hàng THẬT từ sản
// phẩm hiện tại (không tin giá client), client dùng cùng hàm để hiện giỏ.
import type { MarketCartLine, OrderLine, Product, Shop } from "./types";

export type DropReason =
  | "khong_ton_tai" | "ngung_ban" | "het_hang" | "thieu_hang" | "sai_bien_the" | "shop_dong" | "shop_nghi"
  | "chua_co_gia";
export interface DroppedLine { productId: string; variantLabel?: string; reason: DropReason; available?: number }
export const DROP_LABEL: Record<DropReason, string> = {
  khong_ton_tai: "Món này không còn trên chợ",
  ngung_ban: "Shop đã ngừng bán món này",
  het_hang: "Hết hàng",
  thieu_hang: "Chỉ còn {n}",
  sai_bien_the: "Loại/cỡ này không còn",
  shop_dong: "Shop đang tạm đóng",
  shop_nghi: "Shop đang tạm nghỉ, mở lại sau",
  chua_co_gia: "Món này bán qua tư vấn, chưa có giá sẵn", // giỏ kèm nút "Nhờ báo giá" (VT-02)
};

/** Gom giỏ theo shop — giữ thứ tự xuất hiện; dòng không tìm thấy sản phẩm ⇒ dropped. */
export function groupCartByShop(
  lines: MarketCartLine[],
  products: Product[],
): { byShop: Map<string, MarketCartLine[]>; dropped: DroppedLine[] } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const byShop = new Map<string, MarketCartLine[]>();
  const dropped: DroppedLine[] = [];
  for (const l of lines) {
    const p = byId.get(l.productId);
    if (!p) {
      dropped.push({ productId: l.productId, variantLabel: l.variantLabel, reason: "khong_ton_tai" });
      continue;
    }
    const arr = byShop.get(p.shopId) ?? [];
    arr.push(l);
    byShop.set(p.shopId, arr);
  }
  return { byShop, dropped };
}

/** Đơn giá thật của một dòng: biến thể có priceVnd thì lấy, không thì giá gốc; biến thể không tồn tại
 *  HOẶC món chưa niêm yết giá (liên hệ báo giá) ⇒ null. */
export function unitPriceFor(p: Product, variantLabel?: string): number | null {
  if (variantLabel == null || variantLabel === "") {
    // món có biến thể thì BẮT BUỘC chọn — không có nhãn là sai biến thể
    return p.variants.length > 0 ? null : p.priceVnd;
  }
  const v = p.variants.find((x) => x.label === variantLabel);
  if (!v) return null;
  return v.priceVnd ?? p.priceVnd;
}

/** Dựng dòng hàng THẬT cho MỘT shop. Bỏ + báo lý do: sản phẩm không có / deletedAt / adminHidden / status≠dang_ban (ngung_ban) /
 *  stock=0 (het_hang) / stock<qty (thieu_hang + available) / biến thể sai / shop≠hoat_dong (shop_dong) / shop.paused (shop_nghi). */
export function buildMarketLines(
  items: MarketCartLine[],
  products: Product[],
  shop: Pick<Shop, "id" | "status" | "paused">,
): { lines: OrderLine[]; dropped: DroppedLine[] } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: OrderLine[] = [];
  const dropped: DroppedLine[] = [];
  const drop = (l: MarketCartLine, reason: DropReason, available?: number) =>
    dropped.push({ productId: l.productId, variantLabel: l.variantLabel, reason, ...(available != null ? { available } : {}) });
  for (const l of items) {
    const p = byId.get(l.productId);
    if (!p || p.deletedAt || p.adminHidden || p.shopId !== shop.id) { drop(l, "khong_ton_tai"); continue; }
    if (p.status !== "dang_ban") { drop(l, p.status === "het_hang" ? "het_hang" : "ngung_ban"); continue; }
    /* CHƯA NIÊM YẾT GIÁ xét TRƯỚC tồn kho: món liên hệ báo giá để stock=0, mà
       nói "Hết hàng" là sai hẳn — hàng có, chỉ chưa có giá để tự đặt. */
    if (p.priceVnd == null) { drop(l, "chua_co_gia"); continue; }
    if (p.stock <= 0) { drop(l, "het_hang"); continue; }
    if (!isValidMarketQty(l.qty) || p.stock < l.qty) { drop(l, "thieu_hang", p.stock); continue; }
    const price = unitPriceFor(p, l.variantLabel);
    if (price == null) { drop(l, "sai_bien_the"); continue; }
    if (shop.status !== "hoat_dong") { drop(l, "shop_dong"); continue; }
    if (shop.paused) { drop(l, "shop_nghi"); continue; }
    lines.push({
      productId: p.id,
      ...(l.variantLabel ? { variantLabel: l.variantLabel } : {}),
      title: p.title,
      unit: p.unit,
      priceVnd: price,
      qty: l.qty,
      lineTotalVnd: price * l.qty,
      ...(p.images[0] ? { image: p.images[0] } : {}),
    });
  }
  return { lines, dropped };
}

/** "Mua được" cho UI (11 §3.2) = shop hoat_dong ∧ !paused ∧ status=dang_ban ∧ !adminHidden ∧ !deletedAt ∧ stock ≥ 1
 *  ∧ CÓ GIÁ (món liên hệ báo giá không tự đặt được — gọi shop, xem `Product.priceVnd`). */
export function isPurchasable(
  p: Pick<Product, "status" | "adminHidden" | "deletedAt" | "stock" | "priceVnd">,
  shop: Pick<Shop, "status" | "paused">,
): boolean {
  return (
    shop.status === "hoat_dong" && !shop.paused &&
    p.status === "dang_ban" && !p.adminHidden && !p.deletedAt && p.stock >= 1 &&
    p.priceVnd != null
  );
}

/** Món bán qua tư vấn (chưa niêm yết giá) — hiện "Liên hệ báo giá" + nút gọi shop. */
export function isQuoteOnly(p: Pick<Product, "priceVnd">): boolean {
  return p.priceVnd == null;
}

export function shippingFor(shop: Pick<Shop, "shippingFlatVnd" | "freeShipFromVnd">, subtotalVnd: number): number {
  if (subtotalVnd <= 0) return 0;
  if (shop.freeShipFromVnd != null && subtotalVnd >= shop.freeShipFromVnd) return 0;
  return Math.max(0, shop.shippingFlatVnd || 0);
}

export function computeTotals(
  lines: OrderLine[],
  shop: Pick<Shop, "shippingFlatVnd" | "freeShipFromVnd">,
): { subtotalVnd: number; shippingVnd: number; totalVnd: number } {
  const subtotalVnd = lines.reduce((s, l) => s + l.lineTotalVnd, 0);
  const shippingVnd = shippingFor(shop, subtotalVnd);
  return { subtotalVnd, shippingVnd, totalVnd: subtotalVnd + shippingVnd };
}

/** Tổng cả giỏ nhiều shop cho màn giỏ/đặt hàng. */
export function computeCartSummary(
  groups: { lines: OrderLine[]; shippingVnd: number }[],
): { subtotalVnd: number; shippingVnd: number; totalVnd: number; shopCount: number } {
  let subtotalVnd = 0;
  let shippingVnd = 0;
  for (const g of groups) {
    subtotalVnd += g.lines.reduce((s, l) => s + l.lineTotalVnd, 0);
    shippingVnd += g.shippingVnd;
  }
  return { subtotalVnd, shippingVnd, totalVnd: subtotalVnd + shippingVnd, shopCount: groups.length };
}

/** Số lượng hợp lệ: nguyên 1..999 (cùng ngưỡng catalog-orders isValidQty — KHÔNG import từ đó để tránh kéo ProductListing). */
export function isValidMarketQty(qty: unknown): qty is number {
  return typeof qty === "number" && Number.isInteger(qty) && qty >= 1 && qty <= 999;
}

/** % giảm để hiện "-20%": compareAt > price ⇒ round; < 5% hoặc không có ⇒ null (11 §5). */
export function discountPercent(p: Pick<Product, "priceVnd" | "compareAtVnd">): number | null {
  if (p.priceVnd == null) return null;   // liên hệ báo giá thì không có % giảm
  if (p.compareAtVnd == null || p.compareAtVnd <= p.priceVnd || p.compareAtVnd <= 0) return null;
  const pct = Math.round(((p.compareAtVnd - p.priceVnd) / p.compareAtVnd) * 100);
  return pct < 5 ? null : pct;
}

/** Shop có nhận chuyển khoản không = đủ 3 trường STK. */
export function acceptsBankTransfer(shop: Pick<Shop, "bankName" | "bankAccount" | "bankHolder">): boolean {
  return !!(shop.bankName?.trim() && shop.bankAccount?.trim() && shop.bankHolder?.trim());
}

/** Lần đặt có shop không nhận CK ⇒ ép COD (LEAD §4 #9). Trả tên shop ép, [] = không ép. */
export function shopsForcingCod(shops: Pick<Shop, "name" | "bankName" | "bankAccount" | "bankHolder">[]): string[] {
  return shops.filter((s) => !acceptsBankTransfer(s)).map((s) => s.name);
}
