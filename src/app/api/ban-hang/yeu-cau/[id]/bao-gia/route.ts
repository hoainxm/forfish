// /api/ban-hang/yeu-cau/[id]/bao-gia — ĐẠI LÝ TỰ BÁO GIÁ một yêu cầu đặt hàng (17 §12.5).
//  POST {goodsVnd, shippingVnd?, etaPreset | etaFrom+etaTo, note?}
//   · Cổng: chủ shop `hoat_dong` (403 shop_not_active), không tạm nghỉ (409 shop_paused).
//     shopId = shop của SĐT đang đăng nhập — KHÔNG nhận từ body (11 R18).
//   · Kiểm báo giá: readQuoteBody — cùng một hàm với chủ sàn (/api/admin/cho/yeu-cau/[id]).
//   · BÁO GIÁ HỢP LỆ ĐẦU TIÊN THẮNG: chỉ khi yêu cầu còn `moi` và chưa gắn shop; ghi có điều kiện
//     `expectStatus = "moi"` (RPC market_patch_request 0064 — một câu UPDATE … WHERE status) nên hai
//     đại lý bấm sát nhau thì người sau nhận 409 `da_co_bao_gia`. Yêu cầu `moi` không bao giờ có
//     quote_shop_id (chỉ applyQuote gắn, và nó chuyển luôn sang da_bao_gia).
//   · Yêu cầu của chính SĐT chủ shop ⇒ 403 `forbidden`. Không có / không còn ⇒ 404.
//   · Báo bà con Y1 (requestNotice — cùng đường với chủ sàn), best-effort. Timeline ghi `seller`.
// Không có nhật ký hoạt động phía người bán (admin có logMarketAdmin) — timeline yêu cầu là dấu vết.
import { NextResponse } from "next/server";
import { isMarketError } from "@/lib/market/errors";
import { vnToday } from "@/lib/market/eta";
import { notifyMarket } from "@/lib/market/notify";
import { requestNotice } from "@/lib/market/notice";
import { applyQuote } from "@/lib/market/request-state";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { sellerQuoteConflict, toSellerRequestView } from "@/lib/market/seller-requests";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { readQuoteBody } from "@/lib/market/validate";
import { invalid, notFound, readJsonBody } from "../../../_helpers";

type Ctx = { params: Promise<{ id: string }> };

const taken = () =>
  NextResponse.json(
    { ok: false, code: "da_co_bao_gia", message: "Đã có nơi báo giá trước — yêu cầu này không còn nhận giá." },
    { status: 409 },
  );

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req, { allow: ["hoat_dong"] });
  if (!gate.ok) return gate.res;
  const { shop, phone } = gate;
  if (shop.paused) return NextResponse.json({ ok: false, code: "shop_paused" }, { status: 409 });
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const read = readQuoteBody(body.body, shop.id, vnToday());
  if (!read.ok) return invalid(read.message);
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const found = await store.getRequest(id);
    if (!found) return notFound();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const [r] = await settleRequests(store, [found], nowIso);
    const conflict = sellerQuoteConflict(r, shop, now);
    if (conflict === "own_request") {
      return NextResponse.json({ ok: false, code: "forbidden", message: "Yêu cầu này do chính số của shop gửi." }, { status: 403 });
    }
    if (conflict) return taken();
    const patch = applyQuote(r, read.quote, shop.id, nowIso, phone, "seller");
    if (!patch) return taken();
    let request;
    try {
      request = await store.patchRequest(r.id, "moi", patch);
    } catch (e) {
      if (isMarketError(e) && e.code === "bad_transition") return taken(); // đại lý khác / chủ sàn vừa báo trước
      throw e;
    }
    await notifyMarket(request.buyerPhone, requestNotice("Y1", request));
    return NextResponse.json({ ok: true, request: toSellerRequestView(request, shop.id) });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
