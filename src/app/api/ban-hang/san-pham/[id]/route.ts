// /api/ban-hang/san-pham/[id] — một món CỦA SHOP đang đăng nhập (12 §7.2).
//  GET    : xem (mọi trạng thái shop) — món của shop khác / đã xoá ⇒ 404
//  PATCH  : sửa (shop cho_duyet|hoat_dong); client gửi `adminHidden` cũng bị bỏ qua (kho lo)
//  DELETE : xoá MỀM (deletedAt) — đơn cũ vẫn giữ tên + giá lúc đặt (11 §6.4)
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { productSearchText } from "@/lib/market/text";
import { validateMarketProductDraft } from "@/lib/market/validate";
import { invalid, notFound, readJsonBody } from "../../_helpers";
import { mergedProductDraft, productPatchFromBody } from "../../_product-body";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const product = await store.getProduct(id);
    if (!product || product.deletedAt || product.shopId !== gate.shop.id) return notFound();
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req, { allow: ["cho_duyet", "hoat_dong"] });
  if (!gate.ok) return gate.res;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    const cur = await store.getProduct(id);
    if (!cur || cur.deletedAt || cur.shopId !== gate.shop.id) return notFound();

    const patch = productPatchFromBody(body.body);
    const full = mergedProductDraft(cur, patch);
    const err = validateMarketProductDraft(full);
    if (err) return invalid(err);
    /*  Trạng thái ghi xuống là bản ĐÃ chuẩn hoá theo tồn (kho về 0 ⇒ het_hang,
        có kho lại ⇒ dang_ban) để một lần lưu không đẻ ra hai bước. */
    if ("status" in patch || "stock" in patch) patch.status = full.status;
    const searchText =
      "title" in patch || "description" in patch ? productSearchText(full) : undefined;
    const product = await store.updateProduct(gate.shop.id, id, patch, searchText);
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requireShopOwner(req, { allow: ["cho_duyet", "hoat_dong"] });
  if (!gate.ok) return gate.res;
  try {
    const { id } = await ctx.params;
    const store = await getMarketStore();
    await store.deleteProduct(gate.shop.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
