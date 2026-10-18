// /api/cho/yeu-cau/[id] — một yêu cầu đặt hàng của chủ tàu (2026-10-18).
//  GET   : xem (của người khác ⇒ 404, không lộ tồn tại)
//  PATCH : {action: "dong_y"} đồng ý báo giá ⇒ sinh ĐƠN (shop chủ sàn chọn, đã xác nhận kèm hẹn giao)
//          {action: "huy", note?} huỷ yêu cầu (khi chưa đặt)
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { identityFromRequest } from "@/lib/api-identity";
import { vnToday } from "@/lib/market/eta";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { applyAccept, applyBuyerCancel, requestToOrder } from "@/lib/market/request-state";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { NOTE_MAX } from "@/lib/market/validate";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
const conflict = (message: string) => NextResponse.json({ ok: false, code: "bad_transition", message }, { status: 409 });

async function openMine(req: Request, id: string) {
  const who = await identityFromRequest(req);
  if (!who.ok) return { ok: false as const, res: who.res };
  const store = await getMarketStore();
  const r = await store.getRequest(id);
  if (!r || r.buyerPhone !== who.phone) return { ok: false as const, res: notFound() };
  const [settled] = await settleRequests(store, [r], new Date().toISOString());
  return { ok: true as const, store, request: settled ?? r };
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const g = await openMine(req, (await ctx.params).id);
    if (!g.ok) return g.res;
    const order = g.request.orderId ? await g.store.getOrder(g.request.orderId) : null;
    return NextResponse.json({ ok: true, request: g.request, order });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const body = (await req.json().catch(() => null)) as { action?: unknown; note?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  try {
    const g = await openMine(req, (await ctx.params).id);
    if (!g.ok) return g.res;
    const { store, request: r } = g;
    const nowIso = new Date().toISOString();

    if (body.action === "huy") {
      const note = typeof body.note === "string" ? body.note.trim().slice(0, NOTE_MAX) : undefined;
      const patch = applyBuyerCancel(r, note, nowIso);
      if (!patch) return conflict("Yêu cầu này không huỷ được nữa.");
      const request = await store.patchRequest(r.id, r.status, patch);
      return NextResponse.json({ ok: true, request });
    }

    if (body.action === "dong_y") {
      const patch = applyAccept(r, nowIso);
      if (!patch) return conflict(r.status === "het_han" ? "Báo giá đã hết hạn — gửi lại yêu cầu giúp." : "Yêu cầu này chưa có báo giá để đồng ý.");
      const shop = r.quoteShopId ? await store.getShop(r.quoteShopId) : null;
      if (!shop || shop.status !== "hoat_dong") return conflict("Shop lo hàng đang tạm nghỉ — gọi chủ sàn giúp.");
      const bank = shop.bankAccount && shop.bankName && shop.bankHolder
        ? { bankName: shop.bankName, bankAccount: shop.bankAccount, bankHolder: shop.bankHolder }
        : undefined;
      if (r.paymentMethod === "chuyen_khoan" && !bank) return conflict("Shop lo hàng chỉ nhận tiền mặt — gọi chủ sàn đổi cách trả.");
      const pre = requestToOrder(r, nowIso, bank);
      if (!pre) return conflict("Yêu cầu này chưa có báo giá để đồng ý.");
      const out = await store.acceptRequest(r.id, patch, pre);
      // N1 cho chủ shop lo hàng — best-effort
      await notifyMarket(shop.ownerPhone, marketNotice("N1", { order: out.order, hotline: SDVICO_HOTLINE, today: vnToday() }));
      return NextResponse.json({ ok: true, request: out.request, order: out.order });
    }

    return NextResponse.json({ ok: false, code: "invalid", message: "Việc này không làm được." }, { status: 400 });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
