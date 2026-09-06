// VÂN TAY NỘI DUNG ĐƠN — THUẦN, không đụng kho, không ngẫu nhiên.
//
// Bài học 2026-08-18 (catalog-orders): mã chống trùng phải tính từ CHÍNH NỘI
// DUNG lúc bấm gửi. Cùng nội dung ⇒ cùng mã ⇒ server nhận ra lần gửi lại và trả
// đơn cũ; đổi một chữ ⇒ đơn mới. Không lưu gì trong máy, sống qua tắt/mở app.
import type { Address, PaymentMethod, ShopCheckoutDraft } from "./types";

/**
 * FNV-1a 32-bit hai vòng (hai hạt giống) ⇒ 16 hex. Tách từ catalog-orders.ts
 * (bản đó nay import hàm này — hết hai bản, LEAD §5 #2). Không phải hash mật mã
 * và không cần là mật mã: chỉ để phân biệt các đơn của MỘT SĐT.
 */
export function fnv1a64Hex(s: string): string {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return `${fnv(0x811c9dc5)}${fnv(0x9e3779b9)}`;
}

/** Vân tay NỘI DUNG đơn của MỘT shop (LEAD §4 #6): shopId + món (productId, variantLabel, qty — sắp theo khoá) + địa chỉ (5 trường, trim)
 *  + cách trả + ghi chú (trim). Cùng nội dung ⇒ cùng mã ⇒ server nhận ra lần gửi lại; đổi một chữ ⇒ đơn mới (bài học 2026-08-18).
 *  GHI CHÚ THEO SHOP (2026-09-06): caller truyền `buyerNote` = ghi chú SẼ ĐI VÀO
 *  ĐƠN CỦA SHOP NÀY (ghi chú riêng nếu có, không thì ghi chú chung) — sửa lời
 *  dặn một shop chỉ đổi vân tay của đúng shop đó. */
export function marketOrderClientRef(
  shop: Pick<ShopCheckoutDraft, "shopId" | "items">,
  common: { address: Address; paymentMethod: PaymentMethod; buyerNote?: string },
): string {
  const items = [...(shop.items ?? [])]
    .filter((i) => i && typeof i.productId === "string")
    .map((i) => `${i.productId}:${i.variantLabel ?? ""}:${i.qty}`)
    .sort()
    .join(",");
  const a = common.address ?? ({} as Address);
  const s = [
    shop.shopId,
    items,
    (a.name ?? "").trim(),
    (a.phone ?? "").trim(),
    (a.province ?? "").trim(),
    (a.detail ?? "").trim(),
    a.isPort ? "1" : "0",
    common.paymentMethod,
    (common.buyerNote ?? "").trim(),
  ].join("|");
  return `m1-${fnv1a64Hex(s)}`;
}
