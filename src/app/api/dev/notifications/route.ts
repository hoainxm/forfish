// GET /api/dev/notifications?phone= — sổ thông báo của file-store (thay push ở dev).
// CHỈ file mode. `phone` ở đây là tham số xem sổ dev, không phải danh tính.
import { NextResponse } from "next/server";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";

export async function GET(req: Request) {
  if (!isDevFileMode()) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const phone = new URL(req.url).searchParams.get("phone")?.trim() ?? "";
  if (!phone) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  try {
    const store = await getMarketStore();
    const items = await store.devNotifications(phone);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
