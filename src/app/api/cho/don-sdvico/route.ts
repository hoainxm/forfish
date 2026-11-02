// GET /api/cho/don-sdvico — ĐƠN SDVICO (mua qua CRM) của TÔI, chỉ đọc (ADR 0018).
// SĐT LUÔN từ identityFromRequest — không bao giờ từ query/body. Tối đa 50 đơn mới
// nhất (mỗi khách ít đơn — không phân trang).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { listSdvicoOrders } from "@/lib/sdvico-orders/store";

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const items = await listSdvicoOrders(who.phone);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[cho/don-sdvico] đọc đơn SDVICO hỏng:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
}
