// GET /api/cho/san-pham/[id]/danh-gia?page — danh sách đánh giá của món.
// Không bao giờ trả đánh giá bị admin ẩn (adapter lọc, mặc định includeHidden=false).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const product = await store.getProduct(id);
    if (!product || product.deletedAt || product.adminHidden) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
    const res = await store.listReviews({ productId: id,
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      pageSize: 20,
    });
    return NextResponse.json({ ok: true, items: res.items, total: res.total });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
