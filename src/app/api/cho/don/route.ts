// POST /api/cho/don — ĐẶT HÀNG (12 §7.1) · GET /api/cho/don — đơn của tôi.
//
// Ghi chú: mỗi shop có thể mang `shops[].buyerNote` riêng; thiếu thì dùng
// `buyerNote` chung của cả lần đặt (11 §5.6).
//
// Luật server (12 §7.1, 11 §5.6): (1) validateCheckout; (2) đọc sản phẩm + shop;
// (3) buildMarketLines — có dòng rớt ⇒ shop đó `line_unavailable`, KHÔNG gọi kho;
// (4) chuyển khoản mà có shop không nhận CK ⇒ 400 (lưới — client đã ẩn chip);
// (5) tổng lệch `expectedTotalVnd` ⇒ `price_changed` + `quote` mới; (6) placeOrders
// cho các shop còn lại; (7) N1 cho chủ shop mỗi đơn mới. MỖI SHOP MỘT ĐƠN, shop
// này hỏng không kéo shop kia (LEAD §4 #5).
//
// SĐT người mua LUÔN từ identityFromRequest — không bao giờ từ body (11 R16).
// `address.phone` trong body là SĐT NGƯỜI NHẬN (dữ liệu của đơn).
import { NextResponse } from "next/server";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import { identityFromRequest } from "@/lib/api-identity";
import { isOrderStatus } from "@/lib/market/order-state";
import { marketNotice, notifyMarket } from "@/lib/market/notify";
import { buildMarketLines, computeTotals, shopsForcingCod } from "@/lib/market/pricing";
import { marketErrorResponse, settleOverdueOrders } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { PreparedShopOrder } from "@/lib/market/store";
import type { CheckoutDraft, PlaceOrderResult, Shop } from "@/lib/market/types";
import { validateCheckout } from "@/lib/market/validate";

// ── GET: đơn của tôi ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const u = new URL(req.url);
    const status = u.searchParams.get("status");
    const page = Number(u.searchParams.get("page") ?? "1");
    const store = await getMarketStore();
    const res = await store.listBuyerOrders(who.phone, {
      ...(status && isOrderStatus(status) ? { status } : {}),
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      pageSize: 20,
    });
    // ⏱ đơn da_giao quá 7 ngày về hoan_thanh NGAY LÚC ĐỌC (LEAD §4 #3, không cron)
    const items = await settleOverdueOrders(store, res.items, new Date().toISOString());
    return NextResponse.json({ ok: true, items, total: res.total });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

// ── POST: đặt hàng ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const body = (await req.json().catch(() => null)) as CheckoutDraft | null;
  if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });

  const bad = validateCheckout(body);
  if (bad) return NextResponse.json({ ok: false, code: "invalid", message: bad }, { status: 400 });

  try {
    const store = await getMarketStore();
    const ids = body.shops.flatMap((s) => s.items.map((i) => i.productId));
    const products = await store.getProductsByIds(ids);

    const shops = new Map<string, Shop | null>();
    for (const s of body.shops) shops.set(s.shopId, await store.getShop(s.shopId));

    /*  MỘT CÁCH TRẢ TIỀN CHO CẢ LẦN ĐẶT (LEAD §4 #9): chuyển khoản chỉ chọn
        được khi MỌI shop nhận CK. Client đã ẩn chip — đây là lưới cuối. */
    if (body.paymentMethod === "chuyen_khoan") {
      const live = [...shops.values()].filter((s): s is Shop => !!s);
      const forcing = shopsForcingCod(live);
      if (forcing.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            code: "invalid",
            message: `Shop ${forcing[0]} chỉ nhận tiền mặt — chọn Trả khi nhận hàng cho cả lần đặt.`,
          },
          { status: 400 },
        );
      }
    }

    // Dựng dòng hàng THẬT từng shop; shop nào hỏng thì ghi kết quả hỏng, không gọi kho.
    const failed = new Map<string, PlaceOrderResult>();
    const prepared: PreparedShopOrder[] = [];
    for (const draft of body.shops) {
      const shop = shops.get(draft.shopId) ?? null;
      if (!shop || shop.status !== "hoat_dong") {
        failed.set(draft.shopId, { shopId: draft.shopId, ok: false, code: "shop_not_active", productIds: [] });
        continue;
      }
      if (shop.paused) {
        failed.set(draft.shopId, { shopId: draft.shopId, ok: false, code: "shop_paused", productIds: [] });
        continue;
      }
      const built = buildMarketLines(draft.items, products, shop);
      if (built.dropped.length > 0 || built.lines.length === 0) {
        /*  "Còn bao nhiêu" cho MỌI dòng rớt mà món vẫn còn trên chợ — hết hàng
            là `available: 0`, không phải thiếu trường. Màn Đặt hàng hạ số lượng
            giỏ về đúng số này, nên bỏ trống là bắt bà con tự đoán. */
        const available: Record<string, number> = {};
        for (const d of built.dropped) {
          const p = products.find((x) => x.id === d.productId);
          const n = d.available ?? (p ? Math.max(0, p.stock) : undefined);
          if (n != null) available[d.productId] = n;
        }
        failed.set(draft.shopId, {
          shopId: draft.shopId,
          ok: false,
          code: "line_unavailable",
          productIds: built.dropped.map((d) => d.productId),
          ...(Object.keys(available).length > 0 ? { available } : {}),
        });
        continue;
      }
      const totals = computeTotals(built.lines, shop);
      if (totals.totalVnd !== draft.expectedTotalVnd) {
        failed.set(draft.shopId, {
          shopId: draft.shopId, ok: false, code: "price_changed", productIds: [], quote: totals,
        });
        continue;
      }
      prepared.push({
        shopId: shop.id,
        clientRef: draft.clientRef,
        lines: built.lines,
        ...totals,
        /*  GHI CHÚ THEO TỪNG SHOP (11 §5.6, 2026-09-06): mỗi shop nhận đúng lời
            dặn của mình; shop nào bà con không ghi gì thì adapter rơi về
            `body.buyerNote` chung. */
        ...(draft.buyerNote?.trim() ? { buyerNote: draft.buyerNote.trim() } : {}),
        ...(body.paymentMethod === "chuyen_khoan" && shop.bankName && shop.bankAccount && shop.bankHolder
          ? { bankSnapshot: { bankName: shop.bankName, bankAccount: shop.bankAccount, bankHolder: shop.bankHolder } }
          : {}),
      });
    }

    const placed = prepared.length > 0
      ? await store.placeOrders(who.phone, prepared, {
          address: body.address,
          paymentMethod: body.paymentMethod,
          ...(body.buyerNote ? { buyerNote: body.buyerNote } : {}),
        })
      : [];
    const byShop = new Map(placed.map((r) => [r.shopId, r]));

    // N1 cho chủ shop — best-effort, KHÔNG chặn câu trả lời (đơn đã tạo xong).
    for (const r of placed) {
      if (!r.ok || r.duplicate) continue;
      const shop = shops.get(r.shopId);
      if (!shop) continue;
      await notifyMarket(
        shop.ownerPhone,
        marketNotice("N1", { order: r.order, shop: { id: shop.id, name: shop.name }, hotline: SDVICO_HOTLINE }),
      );
    }

    // Thứ tự kết quả = thứ tự client gửi, để màn Đặt hàng ghép đúng thẻ shop.
    const results: PlaceOrderResult[] = body.shops.map(
      (d) =>
        byShop.get(d.shopId) ??
        failed.get(d.shopId) ?? { shopId: d.shopId, ok: false, code: "insert_failed", productIds: [] },
    );
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
