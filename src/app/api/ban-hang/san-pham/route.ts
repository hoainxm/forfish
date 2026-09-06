// /api/ban-hang/san-pham — danh sách + thêm món của CHÍNH shop đang đăng nhập (12 §7.2).
//  GET  ?status=dang_ban|an|het_hang|bi_go &q &page — includeHidden (thấy cả món bị SDVICO gỡ), KHÔNG có món đã xoá
//  POST ProductDraftM — shop `cho_duyet` vẫn soạn món trước (11 §6.2); `tam_khoa`/`tu_choi` ⇒ 403
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { productSearchText } from "@/lib/market/text";
import type { ProductStatusFilter } from "@/lib/market/types";
import { validateMarketProductDraft } from "@/lib/market/validate";
import { invalid, pageOf, readJsonBody } from "../_helpers";
import { productDraftFromBody } from "../_product-body";

const PAGE_SIZE = 20;
/** Giá trị `?status` hợp lệ — `all` không nhận qua URL, bỏ trống là đã "tất cả". */
const FILTERS: readonly ProductStatusFilter[] = ["dang_ban", "an", "het_hang", "bi_go"];

export async function GET(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const url = new URL(req.url);
    const rawStatus = url.searchParams.get("status");
    const status = FILTERS.find((f) => f === rawStatus);
    if (rawStatus && !status) return invalid("Lọc trạng thái không đúng.");
    const q = url.searchParams.get("q")?.trim() || undefined;
    const page = pageOf(url);

    const store = await getMarketStore();
    const res = await store.listShopProducts(gate.shop.id, {
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      page,
      pageSize: PAGE_SIZE,
      includeHidden: true,
    });
    return NextResponse.json({ ok: true, items: res.items, total: res.total, page: res.page, pageSize: res.pageSize });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const gate = await requireShopOwner(req, { allow: ["cho_duyet", "hoat_dong"] });
  if (!gate.ok) return gate.res;
  const body = await readJsonBody(req);
  if (!body.ok) return body.res;
  const draft = productDraftFromBody(body.body);
  const err = validateMarketProductDraft(draft);
  if (err) return invalid(err);
  try {
    const store = await getMarketStore();
    const product = await store.createProduct(gate.shop.id, draft, productSearchText(draft));
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
