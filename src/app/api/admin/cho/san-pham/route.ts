// GET /api/admin/cho/san-pham — món TOÀN SÀN cho admin (12 §7.3).
// ?shopId&q&page — includeHidden=true (admin thấy cả món ẩn, hết hàng, đã bị
// gỡ; món đã xoá mềm thì không ai thấy).
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin();
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const store = await getMarketStore();
    const page = await store.listProducts({
      q: sp.get("q")?.trim() || undefined,
      shopId: sp.get("shopId")?.trim() || undefined,
      page: pageParam(sp),
      includeHidden: true,
    });
    return NextResponse.json({ ok: true, items: page.items, total: page.total, page: page.page });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
