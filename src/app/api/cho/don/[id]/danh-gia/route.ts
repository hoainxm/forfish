// POST /api/cho/don/[id]/danh-gia {productId, rating, comment?} (12 §7.1).
// Kho là chốt: chỉ đơn `hoan_thanh` của chính mình, mỗi món một lần
// (review_not_allowed / already_reviewed) — route chỉ kiểm hình dạng.
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { validateReview } from "@/lib/market/validate";
import { openMyOrder } from "../../../_lib/buyer-order";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { productId?: unknown; rating?: unknown; comment?: unknown }
    | null;
  if (!body) return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  if (typeof body.productId !== "string" || !body.productId.trim()) {
    return NextResponse.json({ ok: false, code: "invalid", message: "Chọn món cần đánh giá." }, { status: 400 });
  }
  const comment = typeof body.comment === "string" ? body.comment : undefined;
  const bad = validateReview({ rating: body.rating, comment });
  if (bad) return NextResponse.json({ ok: false, code: "invalid", message: bad }, { status: 400 });

  const gate = await openMyOrder(req, id);
  if (!gate.ok) return gate.res;
  try {
    const review = await gate.store.addReview({
      orderId: gate.order.id,
      productId: body.productId,
      buyerPhone: gate.phone,
      rating: body.rating as 1 | 2 | 3 | 4 | 5,
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    });
    return NextResponse.json({ ok: true, review }, { status: 201 });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
