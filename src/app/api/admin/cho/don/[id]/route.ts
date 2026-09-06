// PATCH /api/admin/cho/don/[id] — admin XỬ LÝ ĐƠN THAY SHOP (12 §7.3, LEAD §4 #2).
// Cùng thân request với seller (12 §7.2) nhưng actor = "admin": timeline ghi
// `by = admin:<sđt>` (timelineBy) và admin huỷ được tới `dang_giao` (T7).
// Dùng cho shop SDVICO chưa gán chủ + khiếu nại gọi qua tổng đài.
// Mỗi request MỘT việc: đổi trạng thái · đổi thanh toán · chỉ ghi chú/vận chuyển.
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { MarketError } from "@/lib/market/errors";
import {
  applyPaymentTransition,
  applyTransition,
  isOrderStatus,
  isPaymentStatus,
} from "@/lib/market/order-state";
import { marketNotice, notifyMarket, type MarketEvent } from "@/lib/market/notify";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { OrderPatch } from "@/lib/market/store";
import { validateCancelReason, validatePaymentNote } from "@/lib/market/validate";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/market/types";

import { logMarketAdmin, requireMarketAdmin } from "../../_guard";

type Ctx = { params: Promise<{ id: string }> };

const NOTE_MAX = 300;
const CARRIER_MAX = 40;

/** Sự kiện báo tin theo trạng thái mới (bảng 11 §8) + người nhận. */
const ORDER_EVENT: Record<OrderStatus, { ev: MarketEvent; to: "buyer" | "shop" } | null> = {
  cho_xac_nhan: null,
  da_xac_nhan: { ev: "N2", to: "buyer" },
  dang_giao: { ev: "N3", to: "buyer" },
  da_giao: { ev: "N4", to: "buyer" },
  hoan_thanh: { ev: "N5", to: "shop" },
  da_huy: { ev: "N7", to: "buyer" },
};

const PAYMENT_EVENT: Record<PaymentStatus, MarketEvent | null> = {
  chua_thanh_toan: "N9b", // P3 — shop chưa thấy tiền
  bao_da_chuyen: null, // việc của người mua, admin không làm thay
  da_thanh_toan: "N9",
};

const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin();
  if (!who.ok) return who.res;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      status?: unknown;
      paymentStatus?: unknown;
      note?: unknown;
      sellerNote?: unknown;
      carrier?: unknown;
      trackingCode?: unknown;
    } | null;
    if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });

    const store = await getMarketStore();
    const order = await store.getOrder(id);
    if (!order) throw new MarketError("not_found");

    const now = new Date().toISOString();
    const note = optStr(body.note);
    const carrier = optStr(body.carrier);
    const trackingCode = optStr(body.trackingCode);
    if ((carrier?.length ?? 0) > CARRIER_MAX || (trackingCode?.length ?? 0) > CARRIER_MAX)
      throw new MarketError("invalid", "Tên nhà xe / mã vận đơn tối đa 40 chữ.");

    let updated: Order;
    let event: { ev: MarketEvent; to: "buyer" | "shop" } | null = null;
    let logDetail: Record<string, unknown>;

    if (body.status !== undefined) {
      if (!isOrderStatus(body.status)) throw new MarketError("invalid", "Trạng thái không hợp lệ.");
      if (body.status === "da_huy") {
        const bad = validateCancelReason("admin", note);
        if (bad) throw new MarketError("invalid", bad);
      }
      const patch = applyTransition(order, body.status, "admin", note, now, who.phone);
      if (!patch) throw new MarketError("bad_transition");
      if (body.status === "dang_giao") {
        if (carrier) patch.carrier = carrier;
        if (trackingCode) patch.trackingCode = trackingCode;
      }
      updated = await store.transitionOrder(id, order.status, patch);
      event = ORDER_EVENT[body.status];
      logDetail = { status: body.status, before: order.status, ...(note ? { note } : {}) };
    } else if (body.paymentStatus !== undefined) {
      if (!isPaymentStatus(body.paymentStatus))
        throw new MarketError("invalid", "Trạng thái thanh toán không hợp lệ.");
      if (body.paymentStatus === "chua_thanh_toan") {
        const bad = validatePaymentNote(note);
        if (bad) throw new MarketError("invalid", bad);
      }
      const patch = applyPaymentTransition(order, body.paymentStatus, "admin", note, now, who.phone);
      if (!patch) throw new MarketError("bad_transition");
      updated = await store.transitionOrder(id, order.status, patch);
      const ev = PAYMENT_EVENT[body.paymentStatus];
      event = ev ? { ev, to: "buyer" } : null;
      logDetail = {
        paymentStatus: body.paymentStatus,
        before: order.paymentStatus,
        ...(note ? { note } : {}),
      };
    } else {
      // Chỉ ghi chú / vận chuyển — patch trần, expectStatus = trạng thái hiện tại.
      const sellerNote = typeof body.sellerNote === "string" ? body.sellerNote.trim() : undefined;
      if (sellerNote === undefined && carrier === undefined && trackingCode === undefined)
        throw new MarketError("invalid", "Chưa có gì để cập nhật.");
      if ((sellerNote?.length ?? 0) > NOTE_MAX)
        throw new MarketError("invalid", "Ghi chú tối đa 300 chữ.");
      const patch: OrderPatch = {};
      if (sellerNote !== undefined) patch.sellerNote = sellerNote;
      if (carrier !== undefined) patch.carrier = carrier;
      if (trackingCode !== undefined) patch.trackingCode = trackingCode;
      updated = await store.transitionOrder(id, order.status, patch);
      logDetail = { note: true };
    }

    // Báo tin — BEST-EFFORT (notifyMarket không bao giờ ném; 12 §7.4).
    if (event) {
      const shop = await store.getShop(updated.shopId).catch(() => null);
      const to = event.to === "buyer" ? updated.buyerPhone : (shop?.ownerPhone ?? "");
      await notifyMarket(
        to,
        marketNotice(event.ev, {
          order: updated,
          shop: shop ? { id: shop.id, name: shop.name } : undefined,
          reason: note,
          hotline: SDVICO_HOTLINE_DISPLAY,
        }),
      );
    }

    await logMarketAdmin(who.phone, "market.order-update", id, {
      ...logDetail,
      shopId: updated.shopId,
      code: updated.code,
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
