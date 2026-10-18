// POST /api/cho/don/[id]/huy {reason?} — người mua huỷ đơn (12 §7.1).
// Chỉ ở `cho_xac_nhan` (TRANSITIONS); bước khác ⇒ 409 bad_transition. Kho hoàn
// lại do adapter làm ngay sau khi ghi (store.transitionOrder). N6 báo shop.
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { applyTransition } from "@/lib/market/order-state";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { validateCancelReason } from "@/lib/market/validate";
import { openMyOrder } from "../../../_lib/buyer-order";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  const bad = validateCancelReason("buyer", reason);
  if (bad) return NextResponse.json({ ok: false, code: "invalid", message: bad }, { status: 400 });

  const gate = await openMyOrder(req, id);
  if (!gate.ok) return gate.res;
  try {
    const { store, order } = gate;
    const patch = applyTransition(order, "da_huy", "buyer", reason, new Date().toISOString());
    if (!patch) {
      return NextResponse.json({ ok: false, code: "bad_transition" }, { status: 409 });
    }
    const next = await store.transitionOrder(order.id, order.status, patch);
    const shop = await store.getShop(next.shopId).catch(() => null);
    if (shop) {
      await notifyMarket(
        shop.ownerPhone,
        marketNotice("N6", { order: next, shop: { id: shop.id, name: shop.name }, hotline: SDVICO_HOTLINE }),
      );
    }
    return NextResponse.json({ ok: true, order: next });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
