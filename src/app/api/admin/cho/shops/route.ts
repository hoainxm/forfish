// GET /api/admin/cho/shops — danh sách gian hàng cho admin (12 §7.3).
// ?status=<ShopStatus>|all (mặc định cho_duyet — việc chính của admin là DUYỆT)
// &page=. Trả kèm ownerPhone (admin được thấy) + productCount (số món đã soạn,
// kể cả món ẩn/bị gỡ — để biết shop có hàng chưa trước khi duyệt).
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { isShopStatus, pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const raw = sp.get("status") ?? "cho_duyet";
    const status = isShopStatus(raw) ? raw : undefined; // 'all' / rác ⇒ không lọc
    const store = await getMarketStore();
    const page = await store.listShops({ status, page: pageParam(sp) });
    const items = await Promise.all(
      page.items.map(async (shop) => {
        const p = await store.listShopProducts(shop.id, { page: 1, pageSize: 1 });
        return { ...shop, productCount: p.total };
      }),
    );
    return NextResponse.json({ ok: true, items, total: page.total, page: page.page });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
