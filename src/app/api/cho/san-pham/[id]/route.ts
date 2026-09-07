// GET /api/cho/san-pham/[id] — trang món (12 §7.1). Khách lạ xem được.
// Món đã xoá / bị SDVICO gỡ ⇒ 404 (người mua không phân biệt hai ca). Shop
// ≠ hoat_dong hay paused VẪN 200 — UI đọc shop.status/shop.paused để nói đúng
// câu và tắt nút, chứ không giấu cả món (11 §5.3).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { canReview } from "@/lib/market/order-state";
import { marketErrorResponse, toShopPublic } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { MarketStore } from "@/lib/market/store";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });

/** Đơn hoàn thành MỚI NHẤT còn đánh giá được món này — null khi không có. */
async function findReviewableOrder(
  store: MarketStore,
  phone: string,
  productId: string,
): Promise<{ orderId: string } | null> {
  const page = await store.listBuyerOrders(phone, { status: "hoan_thanh", page: 1, pageSize: 20 });
  const withItem = page.items
    .filter((o) => o.items.some((l) => l.productId === productId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  for (const o of withItem) {
    const done = await store.reviewedProductIds(o.id);
    if (canReview(o, productId, done)) return { orderId: o.id };
  }
  return null;
}

export async function GET(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const product = await store.getProduct(id);
    if (!product || product.deletedAt || product.adminHidden) return notFound();
    const shop = await store.getShop(product.shopId);
    if (!shop) return notFound();

    const latest = await store.listReviews({ productId: id, page: 1, pageSize: 5 });
    /*  canReview cần đọc đơn của người gọi — chỉ chạy khi ĐÃ đăng nhập, và
        hỏng thì coi như "chưa được đánh giá" (màn món không được chết vì một
        truy vấn phụ). */
    let review: { orderId: string } | null = null;
    if (who.phone) review = await findReviewableOrder(store, who.phone, id).catch(() => null);

    return NextResponse.json({
      ok: true,
      product,
      shop: toShopPublic(shop),
      reviews: { avg: product.ratingAvg, count: product.ratingCount, latest: latest.items },
      canReview: review,
    });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
