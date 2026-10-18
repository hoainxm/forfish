// GET /api/admin/cho/tong-quan — KPI sàn cho tab "Chợ vật tư" ở /quan-tri
// (12 §7.3, 11 §7). Quét settleOverdue TOÀN SÀN trước khi đếm để doanh thu
// không thiếu đơn đã giao quá 7 ngày (LEAD §4 #3 — không cron).
import { NextResponse } from "next/server";
import { marketErrorResponse, settleOverdueForStats } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { requireMarketAdmin } from "../_guard";

export async function GET() {
  const who = await requireMarketAdmin();
  if (!who.ok) return who.res;
  try {
    const store = await getMarketStore();
    await settleOverdueForStats(store, new Date().toISOString());
    const overview = await store.overview();
    return NextResponse.json({ ok: true, overview });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
