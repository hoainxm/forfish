// POST /api/cho/don/[id]/bao-chuyen — "Tôi đã chuyển khoản" (P1, 12 §7.1).
// Chỉ đơn chuyển khoản; đơn COD ⇒ 400 (không có gì để báo). App KHÔNG xác minh
// tiền — đây là LỜI KHAI của người mua, shop xác nhận sau (P2/P3). N8 báo shop.
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { applyPaymentTransition } from "@/lib/market/order-state";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { openMyOrder } from "../../../_lib/buyer-order";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const gate = await openMyOrder(req, id);
  if (!gate.ok) return gate.res;
  try {
    const { store, order } = gate;
    if (order.paymentMethod !== "chuyen_khoan") {
      return NextResponse.json(
        { ok: false, code: "invalid", message: "Đơn này trả tiền khi nhận hàng — không cần báo chuyển khoản." },
        { status: 400 },
      );
    }
    const patch = applyPaymentTransition(order, "bao_da_chuyen", "buyer", undefined, new Date().toISOString());
    if (!patch) return NextResponse.json({ ok: false, code: "bad_transition" }, { status: 409 });
    const next = await store.transitionOrder(order.id, order.status, patch);
    const shop = await store.getShop(next.shopId).catch(() => null);
    if (shop) {
      await notifyMarket(
        shop.ownerPhone,
        marketNotice("N8", { order: next, shop: { id: shop.id, name: shop.name }, hotline: SDVICO_HOTLINE }),
      );
    }
    return NextResponse.json({ ok: true, order: next });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
