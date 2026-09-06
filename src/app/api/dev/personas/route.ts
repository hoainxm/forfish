// GET /api/dev/personas — danh sách persona + shop của họ (nếu có). CHỈ file mode.
// Kèm `me` = persona của chuỗi đang gửi (nếu có) để trang /dev xác nhận
// identityFromRequest chạy qua nhánh dev.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";

export async function GET(req: Request) {
  if (!isDevFileMode()) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  try {
    const store = await getMarketStore();
    const personas = await store.devPersonas();
    const items = await Promise.all(
      personas.map(async (p) => {
        const shop = await store.getShopByOwner(p.phone);
        return { ...p, shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug, status: shop.status, paused: shop.paused } : null };
      }),
    );
    const who = await identityFromRequest(req, true);
    const me = who.ok && who.phone ? personas.find((p) => p.phone === who.phone) ?? null : null;
    return NextResponse.json({ ok: true, items, me });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
