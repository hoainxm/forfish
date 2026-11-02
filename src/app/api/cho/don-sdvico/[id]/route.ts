// GET /api/cho/don-sdvico/[id] — chi tiết MỘT đơn SDVICO của TÔI (ADR 0018).
// Đơn của người khác ⇒ 404 (không lộ là nó có tồn tại).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { getSdvicoOrder } from "@/lib/sdvico-orders/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const { id } = await ctx.params;
    const order = await getSdvicoOrder(who.phone, id);
    if (!order) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    console.error("[cho/don-sdvico/id] đọc đơn SDVICO hỏng:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
}
