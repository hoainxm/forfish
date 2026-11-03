// /api/ban-hang/yeu-cau — ĐẠI LÝ xem yêu cầu đặt hàng để TỰ BÁO GIÁ (17 §12.5, anh Long duyệt 03/11).
//  GET ?page            : yêu cầu ĐANG MỞ — còn `moi`, chưa quá 7 ngày, chưa shop nào báo, KHÔNG phải của
//                          chính SĐT chủ shop; mới nhất trước. Chỉ gian hàng `hoat_dong` mới thấy (tạm nghỉ
//                          vẫn thấy, nút Báo giá khoá); trạng thái khác ⇒ danh sách rỗng.
//  GET ?loai=da-bao&page : yêu cầu đang gắn shop này (đại lý tự báo HOẶC SDVICO báo thay), mới nhất trước.
//  Mọi phản hồi: { items: SellerRequestView[], total, page, pageSize, block } — `block` = vì sao chưa báo
//  giá được (màn nói rõ, không giấu nút im lặng), null = được.
// KHÔNG trả SĐT, tên, địa chỉ chi tiết của bà con — chỉ tỉnh (toSellerRequestView).
// Cổng: requireShopOwner (SĐT xác thực có shop — 401/404 no_shop), không nhận shopId từ query.
import { NextResponse } from "next/server";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { openRequestsSince, sellerQuoteBlock, toSellerRequestView } from "@/lib/market/seller-requests";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { invalid, pageOf } from "../_helpers";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  const { shop, phone } = gate;
  try {
    const url = new URL(req.url);
    const loai = url.searchParams.get("loai");
    if (loai && loai !== "da-bao") return invalid("Lọc yêu cầu không đúng.");
    const page = pageOf(url);
    const store = await getMarketStore();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const block = sellerQuoteBlock(shop);
    const empty = { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };

    const res = loai === "da-bao"
      ? await store.listAllRequests({ quoteShopId: shop.id, page, pageSize: PAGE_SIZE })
      : shop.status === "hoat_dong"
        ? await store.listAllRequests({ status: "moi", createdAfter: openRequestsSince(now), notBuyerPhone: phone, page, pageSize: PAGE_SIZE })
        : empty;
    // hết hạn lười (khuôn admin): yêu cầu sát mốc 7 ngày / báo giá quá 3 ngày được chốt ngay khi đọc
    let items = await settleRequests(store, res.items, nowIso);
    if (loai !== "da-bao") items = items.filter((r) => r.status === "moi" && !r.quoteShopId);

    return NextResponse.json({
      ok: true,
      block,
      items: items.map((r) => toSellerRequestView(r, shop.id)),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
    });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
