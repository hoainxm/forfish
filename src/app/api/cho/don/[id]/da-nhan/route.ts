// POST /api/cho/don/[id]/da-nhan — người mua bấm "Đã nhận hàng" (12 §7.1).
// `da_giao` → `hoan_thanh`; COD ⇒ paymentStatus = da_thanh_toan (applyTransition
// lo tác dụng phụ). Bấm lần hai ⇒ 409 nhờ `expectStatus`. N5 báo shop.
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { applyTransition } from "@/lib/market/order-state";
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
    const patch = applyTransition(order, "hoan_thanh", "buyer", undefined, new Date().toISOString());
    if (!patch) return NextResponse.json({ ok: false, code: "bad_transition" }, { status: 409 });
    const next = await store.transitionOrder(order.id, order.status, patch);
    const shop = await store.getShop(next.shopId).catch(() => null);
    if (shop) {
      await notifyMarket(
        shop.ownerPhone,
        marketNotice("N5", { order: next, shop: { id: shop.id, name: shop.name }, hotline: SDVICO_HOTLINE }),
      );
    }
    return NextResponse.json({ ok: true, order: next });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
