// GET /api/admin/cho/danh-gia — đánh giá của MỘT món, kể cả bản đã ẩn
// (12 §7.3). ?productId (bắt buộc) &page. Admin xem trong chi tiết món để
// quyết định ẩn/hiện (11 §7 — không có tab riêng).
import { NextResponse } from "next/server";
import { MarketError } from "@/lib/market/errors";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin();
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const productId = sp.get("productId")?.trim();
    if (!productId) throw new MarketError("invalid", "Chọn một món để xem đánh giá.");
    const store = await getMarketStore();
    const page = await store.listProductReviews(productId, {
      page: pageParam(sp),
      includeHidden: true,
    });
    return NextResponse.json({ ok: true, items: page.items, total: page.total, page: page.page });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
