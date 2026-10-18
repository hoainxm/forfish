// POST /api/ban-hang/upload — ảnh sản phẩm / logo shop (12 §7.2). multipart
// `file`, jpeg/png/webp ≤ 500 KB (client đã nén ≤ 400 KB). Mọi trạng thái shop
// đều tải được — đăng ký cũng cần logo. Kiểm mime + MAGIC BYTES ở
// `readImageUpload`, không tin `Content-Type` client khai.
import { NextResponse } from "next/server";
import { marketErrorResponse, readImageUpload } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";

export async function POST(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const { bytes, mime } = await readImageUpload(req);
    const store = await getMarketStore();
    const { url } = await store.saveUpload(gate.shop.id, bytes, mime);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
