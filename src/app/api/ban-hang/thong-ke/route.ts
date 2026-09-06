// GET /api/ban-hang/thong-ke?range=today|7d|30d ⏱ — số liệu Tổng quan của shop
// (12 §7.2). ⏱ = quét `settleOverdueForStats` cho RIÊNG shop này trước khi
// tính, để đơn `da_giao` quá 7 ngày rơi đúng vào doanh thu (11 AC-52).
import { NextResponse } from "next/server";
import { marketErrorResponse, settleOverdueForStats } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import type { StatsRange } from "@/lib/market/types";
import { invalid } from "../_helpers";

const RANGES: readonly StatsRange[] = ["today", "7d", "30d"];

export async function GET(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const raw = new URL(req.url).searchParams.get("range");
    const range = raw ? RANGES.find((r) => r === raw) : "7d";
    if (!range) return invalid("Khoảng thời gian không đúng.");

    const store = await getMarketStore();
    const nowIso = new Date().toISOString();
    await settleOverdueForStats(store, nowIso, gate.shop.id);
    const stats = await store.stats(gate.shop.id, range);
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
