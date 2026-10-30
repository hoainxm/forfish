// GET /api/admin/cho/san-pham — món TOÀN SÀN cho admin (12 §7.3).
// ?shopId&q&page — includeHidden=true (admin thấy cả món ẩn, hết hàng, đã bị
// gỡ; món đã xoá mềm thì không ai thấy).
import { NextResponse } from "next/server";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin("view");
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const store = await getMarketStore();
    /*  LỌC TRẠNG THÁI (2026-09-07): danh sách này bật `includeHidden` nên trộn
        lẫn đang bán / đã ẩn / hết hàng / ĐÃ BỊ GỠ. Không lọc được thì không rà
        lại được "những món tôi đã gỡ" — mà đó chính là việc kiểm duyệt.
        Giá trị lạ ⇒ bỏ qua, coi như không lọc (không ném lỗi cho một tham số
        hiển thị). */
    const rawStatus = sp.get("status")?.trim();
    const status =
      rawStatus === "dang_ban" || rawStatus === "an" || rawStatus === "het_hang" || rawStatus === "bi_go"
        ? rawStatus
        : undefined;
    const page = await store.listProducts({
      q: sp.get("q")?.trim() || undefined,
      shopId: sp.get("shopId")?.trim() || undefined,
      ...(status ? { status } : {}),
      page: pageParam(sp),
      includeHidden: true,
    });
    return NextResponse.json({ ok: true, items: page.items, total: page.total, page: page.page });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
