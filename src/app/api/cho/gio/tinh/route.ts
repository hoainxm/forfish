// POST /api/cho/gio/tinh — TRA LẠI GIỎ (12 §7.1). Khách lạ tra được: giỏ xem
// được khi chưa đăng nhập (11 §5.5). Giá/phí giao tính lại từ sản phẩm HIỆN TẠI
// bằng pricing.ts — không tin số nào của máy khách.
//
// Ngoài `quote` (kiểu CartQuote của Core) route trả thêm `titles`
// (productId → tên món) để màn giỏ gọi đúng tên món KHÔNG mua được:
// `DroppedLine` chỉ mang id + lý do, mà thẻ mờ "Món này không còn trên chợ" mà
// không có tên thì bà con không biết bỏ cái gì. Thêm ở route, không đụng Core.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import {
  buildMarketLines, computeCartSummary, computeTotals, groupCartByShop, isValidMarketQty,
} from "@/lib/market/pricing";
import type { DroppedLine } from "@/lib/market/pricing";
import { marketErrorResponse, toShopPublic } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { CartQuoteGroup, MarketCartLine } from "@/lib/market/types";
import { CART_MAX_LINES } from "@/lib/market/validate";

function readItems(body: unknown): MarketCartLine[] | string {
  const raw = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) return "Giỏ trống.";
  if (raw.length > CART_MAX_LINES) return `Giỏ tối đa ${CART_MAX_LINES} món.`;
  const out: MarketCartLine[] = [];
  for (const l of raw) {
    const line = l as Partial<MarketCartLine>;
    if (!line || typeof line.productId !== "string" || !line.productId.trim()) return "Có dòng giỏ hỏng.";
    if (!isValidMarketQty(line.qty)) return "Số lượng phải từ 1 đến 999.";
    out.push({
      productId: line.productId,
      qty: line.qty,
      ...(typeof line.variantLabel === "string" && line.variantLabel ? { variantLabel: line.variantLabel } : {}),
    });
  }
  return out;
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  const body = (await req.json().catch(() => null)) as unknown;
  if (body === null) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  const items = readItems(body);
  if (typeof items === "string") {
    return NextResponse.json({ ok: false, code: "invalid", message: items }, { status: 400 });
  }
  try {
    const store = await getMarketStore();
    const products = items.length > 0 ? await store.getProductsByIds(items.map((l) => l.productId)) : [];
    const titles: Record<string, string> = {};
    for (const p of products) titles[p.id] = p.title;

    const { byShop, dropped } = groupCartByShop(items, products);
    const groups: CartQuoteGroup[] = [];
    const allDropped: DroppedLine[] = [...dropped];

    for (const [shopId, lines] of byShop) {
      const shop = await store.getShop(shopId);
      if (!shop) {
        for (const l of lines) allDropped.push({ productId: l.productId, variantLabel: l.variantLabel, reason: "khong_ton_tai" });
        continue;
      }
      const built = buildMarketLines(lines, products, shop);
      allDropped.push(...built.dropped);
      if (built.lines.length === 0) continue;
      const totals = computeTotals(built.lines, shop);
      groups.push({ shop: toShopPublic(shop), lines: built.lines, ...totals });
    }

    const summary = computeCartSummary(groups.map((g) => ({ lines: g.lines, shippingVnd: g.shippingVnd })));
    return NextResponse.json({
      ok: true,
      quote: { at: new Date().toISOString(), groups, dropped: allDropped, summary },
      titles,
    });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
