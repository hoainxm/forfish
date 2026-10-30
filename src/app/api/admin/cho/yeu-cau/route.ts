// GET /api/admin/cho/yeu-cau — chủ sàn xem yêu cầu đặt hàng (2026-10-18). ?status= &page=
// Trả kèm `counts.moi` để tab hiện số đang chờ báo giá.
import { NextResponse } from "next/server";
import { isRequestStatus } from "@/lib/market/request-state";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status");
    const store = await getMarketStore();
    const res = await store.listAllRequests({ ...(status && isRequestStatus(status) ? { status } : {}), page: pageParam(sp), pageSize: 20 });
    const items = await settleRequests(store, res.items, new Date().toISOString());
    const moi = await store.listAllRequests({ status: "moi", pageSize: 1 });
    return NextResponse.json({ ok: true, items, total: res.total, page: res.page, pageSize: res.pageSize, counts: { moi: moi.total } });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
