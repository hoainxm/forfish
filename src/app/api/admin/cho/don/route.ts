// GET /api/admin/cho/don — đơn TOÀN SÀN cho admin (12 §7.3, 11 §7).
// ?status&shopId&buyerPhone&code&page. Áp settleOverdue cho đúng trang vừa đọc
// (LEAD §4 #3) để admin không thấy đơn "đã giao" treo quá 7 ngày.
import { NextResponse } from "next/server";
import { isOrderStatus } from "@/lib/market/order-state";
import { marketErrorResponse, settleOverdueOrders } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const rawStatus = sp.get("status");
    const store = await getMarketStore();
    const page = await store.listAllOrders({
      status: isOrderStatus(rawStatus) ? rawStatus : undefined,
      shopId: sp.get("shopId")?.trim() || undefined,
      buyerPhone: sp.get("buyerPhone")?.trim() || undefined,
      code: sp.get("code")?.trim() || undefined,
      page: pageParam(sp),
    });
    const items = await settleOverdueOrders(store, page.items, new Date().toISOString());
    return NextResponse.json({ ok: true, items, total: page.total, page: page.page });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
