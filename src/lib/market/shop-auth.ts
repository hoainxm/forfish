import "server-only";
// CỔNG CHỦ SHOP cho /api/ban-hang/* (12 §7.2). Chủ shop = SĐT xác thực
// (identityFromRequest) có shop; KHÔNG nhận shopId/SĐT từ body/query (11 R18).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { marketErrorResponse } from "./route-utils";
import { getMarketStore } from "./store";
import type { Shop, ShopStatus } from "./types";

export type ShopGate =
  | { ok: true; phone: string; shop: Shop }
  | { ok: false; res: NextResponse };  // 401/503 từ identityFromRequest · 404 no_shop · 403 shop_not_active

/** `allow`: trạng thái shop được qua (mặc định: tất cả — chủ shop tam_khoa vẫn xử lý đơn treo, 11 §6.2). */
export async function requireShopOwner(req: Request, opts?: { allow?: ShopStatus[] }): Promise<ShopGate> {
  const who = await identityFromRequest(req);
  if (!who.ok) return { ok: false, res: who.res };
  if (!who.phone) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "login_required" }, { status: 401 }) };
  }
  try {
    const store = await getMarketStore();
    const shop = await store.getShopByOwner(who.phone);
    if (!shop) return { ok: false, res: NextResponse.json({ ok: false, code: "no_shop" }, { status: 404 }) };
    if (opts?.allow && !opts.allow.includes(shop.status)) {
      return { ok: false, res: NextResponse.json({ ok: false, code: "shop_not_active" }, { status: 403 }) };
    }
    return { ok: true, phone: who.phone, shop };
  } catch (e) {
    return { ok: false, res: marketErrorResponse(e) };
  }
}
