// /api/admin/cho/yeu-cau/[id] — chủ sàn xử lý MỘT yêu cầu đặt hàng (2026-10-18).
//  GET   : chi tiết (kèm đơn nếu đã đặt)
//  PATCH : {action:"bao_gia", shopId, goodsVnd, shippingVnd, etaFrom, etaTo | etaPreset, note?}
//          {action:"khong_tim_duoc", reason}
// Luật chuyển ở request-state.ts; báo chủ tàu Y1/Y2 best-effort; nhật ký admin.
import { NextResponse } from "next/server";
import { vnToday } from "@/lib/market/eta";
import { notifyMarket } from "@/lib/market/notify";
import { requestNotice } from "@/lib/market/notice";
import { applyQuote, applyReject } from "@/lib/market/request-state";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { NOTE_MAX, readQuoteBody } from "@/lib/market/validate";
import { logMarketAdmin, requireMarketAdmin } from "../../_guard";

type Ctx = { params: Promise<{ id: string }> };
const invalid = (message: string) => NextResponse.json({ ok: false, code: "invalid", message }, { status: 400 });

export async function GET(_req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const store = await getMarketStore();
    const r = await store.getRequest((await params).id);
    if (!r) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    const [request] = await settleRequests(store, [r], new Date().toISOString());
    const order = request.orderId ? await store.getOrder(request.orderId) : null;
    return NextResponse.json({ ok: true, request, order });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("edit");
  if (!who.ok) return who.res;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  try {
    const store = await getMarketStore();
    const found = await store.getRequest((await params).id);
    if (!found) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    const nowIso = new Date().toISOString();
    const [r] = await settleRequests(store, [found], nowIso);
    const conflict = () => NextResponse.json({ ok: false, code: "bad_transition", message: "Yêu cầu đã đổi trạng thái — mở lại xem." }, { status: 409 });

    if (b.action === "bao_gia") {
      // đọc + kiểm báo giá: MỘT hàm với đại lý tự báo (/api/ban-hang/yeu-cau/[id]/bao-gia)
      const read = readQuoteBody(b, b.shopId, vnToday());
      if (!read.ok) return invalid(read.message);
      const shop = await store.getShop(b.shopId as string);
      if (!shop || shop.status !== "hoat_dong") return invalid("Shop này chưa hoạt động — chọn shop khác.");
      const patch = applyQuote(r, read.quote, shop.id, nowIso, who.phone);
      if (!patch) return conflict();
      const request = await store.patchRequest(r.id, r.status, patch);
      await notifyMarket(request.buyerPhone, requestNotice("Y1", request));
      await logMarketAdmin(who, "market.request-quote", request.id, { action: "bao_gia", total: read.quote.goodsVnd + read.quote.shippingVnd, shopId: shop.id });
      return NextResponse.json({ ok: true, request });
    }

    if (b.action === "khong_tim_duoc") {
      const reason = typeof b.reason === "string" ? b.reason.trim() : "";
      if (reason.length < 3 || reason.length > NOTE_MAX) return invalid("Ghi lý do cho bà con (3–300 chữ).");
      const patch = applyReject(r, reason, nowIso, who.phone);
      if (!patch) return conflict();
      const request = await store.patchRequest(r.id, r.status, patch);
      await notifyMarket(request.buyerPhone, requestNotice("Y2", request));
      await logMarketAdmin(who, "market.request-quote", request.id, { action: "khong_tim_duoc", reason });
      return NextResponse.json({ ok: true, request });
    }
    return invalid("Việc này không làm được.");
  } catch (e) {
    return marketErrorResponse(e);
  }
}
