// GET /api/cho/shop/[slug]?page&sort&category — trang shop (12 §7.1).
// slug lạ ⇒ 404; shop có thật nhưng chưa duyệt / bị khoá / bị từ chối ⇒ 403
// shop_not_active — UI nói "Shop này đang tạm đóng", KHÔNG lộ lý do (11 §5.4).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { isProductCategory } from "@/lib/market/categories";
import { marketErrorResponse, toShopPublic } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { ProductQuery } from "@/lib/market/types";

type Ctx = { params: Promise<{ slug: string }> };

const SORTS = ["moi", "ban_chay", "gia_tang", "gia_giam"] as const;
const isSort = (v: string): v is ProductQuery["sort"] & string => (SORTS as readonly string[]).includes(v);

export async function GET(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  try {
    const { slug } = await ctx.params;
    const store = await getMarketStore();
    const shop = await store.getShopBySlug(slug);
    if (!shop) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    if (shop.status !== "hoat_dong") {
      return NextResponse.json({ ok: false, code: "shop_not_active" }, { status: 403 });
    }
    const u = new URL(req.url);
    const category = u.searchParams.get("category");
    const sort = u.searchParams.get("sort");
    if (category && !isProductCategory(category)) {
      return NextResponse.json({ ok: false, code: "invalid", message: "Nhóm hàng không có trên chợ." }, { status: 400 });
    }
    if (sort && !isSort(sort)) {
      return NextResponse.json({ ok: false, code: "invalid", message: "Kiểu sắp xếp không có." }, { status: 400 });
    }
    const page = Number(u.searchParams.get("page") ?? "1");
    const products = await store.listProducts({
      shopId: shop.id,
      ...(category && isProductCategory(category) ? { category } : {}),
      ...(sort && isSort(sort) ? { sort } : {}),
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      pageSize: 20,
      includeHidden: false,
    });
    return NextResponse.json({ ok: true, shop: toShopPublic(shop), products });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
