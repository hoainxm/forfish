// PATCH /api/admin/cho/san-pham/[id] — admin GỠ / TRẢ LẠI món (12 §7.3, 11 §7).
// {adminHidden: boolean, reason?: string} — gỡ BẮT BUỘC lý do 5..300 (shop phải
// biết vì sao món biến mất). Gỡ ⇒ N13 vào hộp thư người bán (không push).
// Đơn đang treo có món này KHÔNG bị huỷ theo (11 §7).
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { MarketError } from "@/lib/market/errors";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { validateStatusNote } from "@/lib/market/validate";
import { logMarketAdmin, requireMarketAdmin } from "../../_guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("edit");
  if (!who.ok) return who.res;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      adminHidden?: unknown;
      reason?: unknown;
    } | null;
    if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
    if (typeof body.adminHidden !== "boolean")
      throw new MarketError("invalid", "Chưa chọn gỡ hay trả lại món.");

    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    if (body.adminHidden) {
      const bad = validateStatusNote(reason);
      if (bad) throw new MarketError("invalid", bad);
    }

    const store = await getMarketStore();
    const product = await store.setProductAdminHidden(id, body.adminHidden, reason ?? null);
    await logMarketAdmin(who, "market.product-hide", id, {
      adminHidden: body.adminHidden,
      shopId: product.shopId,
      ...(reason ? { reason } : {}),
    });

    if (body.adminHidden) {
      const shop = await store.getShop(product.shopId).catch(() => null);
      await notifyMarket(
        shop?.ownerPhone ?? "",
        marketNotice("N13", {
          product: { id: product.id, title: product.title },
          shop: shop ? { id: shop.id, name: shop.name } : undefined,
          reason,
          hotline: SDVICO_HOTLINE_DISPLAY,
        }),
      );
    }
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
