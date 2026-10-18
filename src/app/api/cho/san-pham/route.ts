// GET /api/cho/san-pham — danh sách món trên chợ (12 §7.1).
// KHÁCH LẠ XEM ĐƯỢC (LEAD §5 #8) ⇒ identityFromRequest(req, true). Adapter tự
// lọc món của shop chưa duyệt / đã xoá / bị gỡ — route không nhớ luật đó.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { isProductCategory } from "@/lib/market/categories";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { ProductQuery } from "@/lib/market/types";

const SORTS = ["moi", "ban_chay", "gia_tang", "gia_giam"] as const;
const isSort = (v: string): v is ProductQuery["sort"] & string =>
  (SORTS as readonly string[]).includes(v);

const bad = (code: string, message?: string, status = 400) =>
  NextResponse.json({ ok: false, code, ...(message ? { message } : {}) }, { status });

export async function GET(req: Request) {
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  try {
    const u = new URL(req.url);
    const q = (u.searchParams.get("q") ?? "").trim();
    const category = u.searchParams.get("category");
    const province = (u.searchParams.get("province") ?? "").trim();
    const shopId = (u.searchParams.get("shopId") ?? "").trim();
    const sort = u.searchParams.get("sort");
    const page = Number(u.searchParams.get("page") ?? "1");
    const pageSize = Number(u.searchParams.get("pageSize") ?? "20");

    if (category && !isProductCategory(category)) return bad("invalid", "Nhóm hàng không có trên chợ.");
    if (sort && !isSort(sort)) return bad("invalid", "Kiểu sắp xếp không có.");

    const query: ProductQuery = {
      ...(q ? { q } : {}),
      ...(category && isProductCategory(category) ? { category } : {}),
      ...(province ? { province } : {}),
      ...(shopId ? { shopId } : {}),
      ...(sort && isSort(sort) ? { sort } : {}),
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      pageSize: Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : 20,
      includeHidden: false,
    };
    const store = await getMarketStore();
    const res = await store.listProducts(query);
    return NextResponse.json({ ok: true, items: res.items, total: res.total, page: res.page, pageSize: res.pageSize });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
