// GET /api/ban-hang/don ⏱ — đơn của shop đang đăng nhập (12 §7.2).
// ⏱ = áp `settleOverdueOrders` TRƯỚC khi trả (LEAD §4 #3: đơn `da_giao` quá 7
// ngày tự `hoan_thanh` ngay lượt đọc, không cron). Chủ shop `tam_khoa` vẫn đọc
// được — đơn treo không được bỏ rơi người mua (11 §6.2).
import { NextResponse } from "next/server";
import { choXacNhanTien, isOrderStatus, isPaymentStatus } from "@/lib/market/order-state";
import { normalizeVnPhone } from "@/lib/phone";
import { marketErrorResponse, settleOverdueOrders } from "@/lib/market/route-utils";
import { requireShopOwner } from "@/lib/market/shop-auth";
import { getMarketStore } from "@/lib/market/store";
import { invalid, pageOf } from "../_helpers";

export async function GET(req: Request) {
  const gate = await requireShopOwner(req);
  if (!gate.ok) return gate.res;
  try {
    const url = new URL(req.url);
    const rawStatus = url.searchParams.get("status");
    if (rawStatus && !isOrderStatus(rawStatus)) return invalid("Trạng thái đơn không đúng.");
    const page = pageOf(url);
    /*  TRA ĐƠN (2026-09-07): bà con gọi đọc mã đơn hoặc số điện thoại, chủ shop
        phải tìm ra ngay. Trước đây chỉ admin tra được, chủ shop phải lật từng
        tab. `listShopOrders` GHIM shopId ở tham số bắt buộc nên không có đường
        nào lọt đơn của shop khác. SĐT chuẩn hoá trước khi so, không thì "0901…"
        và "+84901…" thành hai người khác nhau. */
    const rawCode = url.searchParams.get("ma")?.trim();
    const rawPhone = url.searchParams.get("sdt")?.trim();
    const buyerPhone = rawPhone ? normalizeVnPhone(rawPhone) : "";
    /*  `tt=bao_da_chuyen` (BH-08): ô "Báo đã CK" ở Tổng quan mở đúng các đơn được đếm —
        cùng luật `choXacNhanTien` với /thong-ke (tiền đã báo, đơn còn sống), áp NGAY
        trong adapter (`open`) để `total` khớp danh sách, không lọc sau rồi lệch "Xem thêm". */
    const rawTt = url.searchParams.get("tt");
    if (rawTt && !isPaymentStatus(rawTt)) return invalid("Trạng thái thanh toán không đúng.");
    const tt = isPaymentStatus(rawTt) ? rawTt : null;
    const choTien = tt === "bao_da_chuyen";

    const store = await getMarketStore();
    const res = await store.listShopOrders(gate.shop.id, {
      ...(rawStatus && isOrderStatus(rawStatus) ? { status: rawStatus } : {}),
      ...(rawCode ? { code: rawCode } : {}),
      ...(buyerPhone ? { buyerPhone } : {}),
      ...(tt ? { paymentStatus: tt } : {}),
      ...(choTien ? { open: true } : {}),
      page,
      pageSize: 20,
    });
    const settled = await settleOverdueOrders(store, res.items, new Date().toISOString());
    /*  Đơn vừa tự hoàn thành thì không còn thuộc tab đang xem — bỏ khỏi danh
        sách chứ không hiện nhãn cũ (số đếm tab lấy từ /thong-ke, đã settle). */
    let items = rawStatus ? settled.filter((o) => o.status === rawStatus) : settled;
    if (choTien) items = items.filter(choXacNhanTien); // đơn vừa tự huỷ/hoàn thành lượt này thì rời danh sách
    return NextResponse.json({ ok: true, items, total: res.total, page, pageSize: res.pageSize });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
