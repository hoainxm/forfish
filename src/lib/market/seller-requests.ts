// ĐẠI LÝ TỰ BÁO GIÁ yêu cầu đặt hàng (17 §12.5, anh Long duyệt 03/11: "mọi gian hàng
// hoat_dong, không tạm nghỉ, đều báo giá được") — THUẦN, route + màn dùng chung.
//
// Hai luật giữ ở đây để route và màn không nói hai câu khác nhau:
//  · ai báo giá được (`sellerQuoteBlock`) — gian hàng hoat_dong và không tạm nghỉ;
//  · đại lý THẤY GÌ của một yêu cầu (`toSellerRequestView`) — món, số lượng, cần trước
//    ngày, TỈNH. KHÔNG BAO GIỜ SĐT, tên hay địa chỉ chi tiết của bà con: thứ đó chỉ tới
//    shop khi bà con đồng ý báo giá và yêu cầu thành ĐƠN (đơn có địa chỉ giao như mọi đơn).
import { REQUEST_IDLE_MS } from "./request-state";
import type { MarketRequest, PaymentMethod, RequestQuote, RequestStatus, Shop } from "./types";

/** Phần yêu cầu đại lý được thấy. `mine` = báo giá đang gắn shop này. */
export interface SellerRequestView {
  id: string;
  code: string;
  title: string;
  qty: number;
  unit: string;
  description?: string;
  images: string[];
  needBy?: string;
  province: string;
  paymentMethod: PaymentMethod;
  status: RequestStatus;
  createdAt: string;
  mine: boolean;
  /** chỉ khi `mine` — giá shop mình đã báo */
  quote?: RequestQuote;
  /** đã thành đơn của shop mình ⇒ mở ở Đơn hàng */
  orderId?: string;
}

export function toSellerRequestView(r: MarketRequest, shopId: string): SellerRequestView {
  const mine = !!r.quoteShopId && r.quoteShopId === shopId;
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    qty: r.qty,
    unit: r.unit,
    ...(r.description ? { description: r.description } : {}),
    images: [...r.images],
    ...(r.needBy ? { needBy: r.needBy } : {}),
    province: r.address?.province ?? "",
    paymentMethod: r.paymentMethod,
    status: r.status,
    createdAt: r.createdAt,
    mine,
    ...(mine && r.quote ? { quote: { ...r.quote } } : {}),
    ...(mine && r.orderId ? { orderId: r.orderId } : {}),
  };
}

/** Vì sao gian hàng CHƯA báo giá được — null = được. Màn đọc mã này để nói rõ, không giấu nút im lặng. */
export type SellerQuoteBlock = "cho_duyet" | "tu_choi" | "tam_khoa" | "tam_nghi";

export function sellerQuoteBlock(shop: Pick<Shop, "status" | "paused">): SellerQuoteBlock | null {
  if (shop.status === "cho_duyet") return "cho_duyet";
  if (shop.status === "tu_choi") return "tu_choi";
  if (shop.status === "tam_khoa") return "tam_khoa";
  if (shop.paused) return "tam_nghi";
  return null;
}

export const SELLER_QUOTE_BLOCK_TEXT: Record<SellerQuoteBlock, string> = {
  cho_duyet: "Shop đang chờ SDVICO duyệt — duyệt xong mới báo giá được.",
  tu_choi: "SDVICO chưa duyệt shop — sửa đăng ký rồi gửi lại, duyệt xong mới báo giá được.",
  tam_khoa: "Shop đang bị tạm khoá — chưa báo giá được. Gọi SDVICO để mở lại.",
  tam_nghi: "Shop đang tạm nghỉ bán — mở bán lại rồi mới báo giá được.",
};

/** Mốc `createdAt` cũ nhất của yêu cầu `moi` còn sống (quá 7 ngày là hết hạn lười — settleRequest). */
export function openRequestsSince(nowMs: number): string {
  return new Date(nowMs - REQUEST_IDLE_MS).toISOString();
}

/**
 * Yêu cầu này đại lý còn báo giá được không — null = được, còn lại là mã lỗi route trả về:
 *  · `own_request` — yêu cầu do chính SĐT chủ shop gửi (không tự báo giá cho mình);
 *  · `da_co_bao_gia` — đã có nơi báo giá / đã đóng / đã hết hạn.
 */
export function sellerQuoteConflict(
  r: Pick<MarketRequest, "status" | "quoteShopId" | "buyerPhone" | "createdAt">,
  shop: Pick<Shop, "ownerPhone">,
  nowMs: number,
): "own_request" | "da_co_bao_gia" | null {
  if (r.buyerPhone === shop.ownerPhone) return "own_request";
  if (r.status !== "moi" || r.quoteShopId) return "da_co_bao_gia";
  const c = Date.parse(r.createdAt);
  if (Number.isFinite(c) && nowMs - c >= REQUEST_IDLE_MS) return "da_co_bao_gia";
  return null;
}
