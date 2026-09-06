// GET /api/cho/don/[id] ⏱ — chi tiết đơn của TÔI (12 §7.1).
// Đơn của người khác ⇒ 404 (không lộ là nó có tồn tại). STK hiện trong
// `order.bankSnapshot` — KHÔNG đọc STK hiện tại của shop (11 R11).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { marketErrorResponse, settleOverdueOrders } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const order = await store.getOrder(id);
    if (!order || order.buyerPhone !== who.phone) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }
    const [settled] = await settleOverdueOrders(store, [order], new Date().toISOString());
    return NextResponse.json({ ok: true, order: settled });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
