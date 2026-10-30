// PATCH /api/admin/cho/danh-gia/[id] — ẨN / HIỆN một đánh giá (12 §7.3).
// {hidden: boolean}. Kho tự tính lại ratingAvg/ratingCount của MÓN và của SHOP
// từ các đánh giá KHÔNG ẩn (LEAD §4 #15) — route không tính tay.
import { NextResponse } from "next/server";
import { MarketError } from "@/lib/market/errors";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { logMarketAdmin, requireMarketAdmin } from "../../_guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requireMarketAdmin("edit");
  if (!who.ok) return who.res;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
    if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
    if (typeof body.hidden !== "boolean")
      throw new MarketError("invalid", "Chưa chọn ẩn hay hiện đánh giá.");

    const store = await getMarketStore();
    const review = await store.setReviewHidden(id, body.hidden);
    await logMarketAdmin(who, "market.review-hide", id, {
      hidden: body.hidden,
      productId: review.productId,
    });
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
