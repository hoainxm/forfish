// /api/ban-hang/don/[id] — một đơn của shop đang đăng nhập (12 §7.2).
//  GET   ⏱ : xem đơn (đơn của shop khác ⇒ 404 — không lộ tồn tại)
//  PATCH   : MỘT việc mỗi lần — đổi trạng thái đơn (T1/T2/T3/T6) · đổi thanh
//            toán (P2/P3) · hoặc chỉ ghi chú/vận chuyển. Chủ shop `tam_khoa`
//            VẪN xử lý được đơn treo (11 §6.2) nên cổng không đòi `hoat_dong`.
// Luật chuyển + tác dụng phụ nằm ở `applyTransition`/`applyPaymentTransition`
// (order-state.ts) — route chỉ gọi rồi ghi có điều kiện `expectStatus`.
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { readEta, vnToday } from "@/lib/market/eta";
import {
  applyPaymentTransition, applyTransition, isOrderStatus, isPaymentStatus,
} from "@/lib/market/order-state";
import { marketNotice, notifyMarket, type MarketEvent } from "@/lib/market/notify";
import { marketErrorResponse, settleOverdueOrders } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore, type OrderPatch } from "@/lib/market/store";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/market/types";
import { NOTE_MAX, validateCancelReason, validatePaymentNote } from "@/lib/market/validate";
import { badTransition, invalid, notFound, readJsonBody, str } from "../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

const CARRIER_MAX = 40;

/** Sự kiện báo cho NGƯỜI MUA sau khi shop đổi trạng thái (bảng 11 §8). */
const ORDER_EVENT: Partial<Record<OrderStatus, MarketEvent>> = {
  da_xac_nhan: "N2", dang_giao: "N3", da_giao: "N4", da_huy: "N7",
};
const PAYMENT_EVENT: Partial<Record<PaymentStatus, MarketEvent>> = {
  da_thanh_toan: "N9", chua_thanh_toan: "N9b",
};

/** Best-effort — thông báo hỏng KHÔNG được làm hỏng việc chính (11 AC-58). */
async function tell(ev: MarketEvent | undefined, order: Order): Promise<void> {
  if (!ev) return;
  await notifyMarket(order.buyerPhone, marketNotice(ev, { order, hotline: SDVICO_HOTLINE, today: vnToday() }));
}

export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const order = await store.getOrder(id);
    if (!order || order.shopId !== gate.shop.id) return notFound();
    const [settled] = await settleOverdueOrders(store, [order], new Date().toISOString());
    return NextResponse.json({ ok: true, order: settled ?? order });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const b = body.body;
  const note = str(b.note);
  const carrier = str(b.carrier);
  const trackingCode = str(b.trackingCode);
  if (carrier != null && carrier.length > CARRIER_MAX) return invalid("Tên đơn vị vận chuyển tối đa 40 chữ.");
  if (trackingCode != null && trackingCode.length > CARRIER_MAX) return invalid("Mã vận đơn tối đa 40 chữ.");

  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const found = await store.getOrder(id);
    if (!found || found.shopId !== gate.shop.id) return notFound();
    const nowIso = new Date().toISOString();
    const [settled] = await settleOverdueOrders(store, [found], nowIso);
    const cur = settled ?? found;

    // ── 1. Đổi TRẠNG THÁI ĐƠN ────────────────────────────────────────────
    if (b.status !== undefined) {
      if (!isOrderStatus(b.status)) return invalid("Trạng thái đơn không đúng.");
      const to = b.status;
      if (to === "da_huy") {
        const err = validateCancelReason("seller", note);
        if (err) return invalid(err);
      }
      const patch = applyTransition(cur, to, "seller", note, nowIso);
      if (!patch) return badTransition();
      // XÁC NHẬN = HẸN GIAO (kiểu Shopee, 2026-10-18) — không hẹn thì không xác nhận
      if (to === "da_xac_nhan") {
        const eta = readEta(b, vnToday());
        if (typeof eta === "string") return invalid(eta);
        patch.etaFrom = eta.etaFrom;
        patch.etaTo = eta.etaTo;
        if (patch.timelineAppend && !patch.timelineAppend.note) patch.timelineAppend.note = `Hẹn giao ${eta.etaFrom === eta.etaTo ? eta.etaFrom : `${eta.etaFrom} – ${eta.etaTo}`}`;
      }
      if (to === "dang_giao") {
        if (carrier) patch.carrier = carrier;
        if (trackingCode) patch.trackingCode = trackingCode;
      }
      const order = await store.transitionOrder(cur.id, cur.status, patch);
      await tell(ORDER_EVENT[to], order);
      return NextResponse.json({ ok: true, order });
    }

    // ── 2. Đổi THANH TOÁN (P2 "Đã nhận tiền" / P3 "Chưa thấy tiền") ──────
    if (b.paymentStatus !== undefined) {
      if (!isPaymentStatus(b.paymentStatus)) return invalid("Trạng thái thanh toán không đúng.");
      const to = b.paymentStatus;
      if (to === "chua_thanh_toan") {
        const err = validatePaymentNote(note);
        if (err) return invalid(err);
      }
      const patch = applyPaymentTransition(cur, to, "seller", note, nowIso);
      if (!patch) return badTransition();
      const order = await store.transitionOrder(cur.id, cur.status, patch);
      await tell(PAYMENT_EVENT[to], order);
      return NextResponse.json({ ok: true, order });
    }

    // ── 3. Chỉ ghi chú / vận chuyển (không đổi trạng thái) ───────────────
    const patch: OrderPatch = {};
    if (b.sellerNote !== undefined) {
      const n = str(b.sellerNote) ?? "";
      if (n.length > NOTE_MAX) return invalid("Ghi chú tối đa 300 chữ.");
      patch.sellerNote = n;
    }
    if (carrier != null) patch.carrier = carrier;
    if (trackingCode != null) patch.trackingCode = trackingCode;
    // DỜI HẸN GIAO — chỉ khi đã xác nhận / đang giao
    if (b.etaPreset !== undefined || b.etaFrom !== undefined) {
      if (cur.status !== "da_xac_nhan" && cur.status !== "dang_giao") return badTransition();
      const eta = readEta(b, vnToday());
      if (typeof eta === "string") return invalid(eta);
      patch.etaFrom = eta.etaFrom;
      patch.etaTo = eta.etaTo;
    }
    if (Object.keys(patch).length === 0) return invalid("Chưa có gì để lưu.");
    const order = await store.transitionOrder(cur.id, cur.status, patch);
    return NextResponse.json({ ok: true, order });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
