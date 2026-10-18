// VALIDATE của Chợ vật tư — THUẦN, client + server dùng chung, server là chốt.
// Mọi hàm trả `string | null`: câu tiếng Việt đời thường (CHUẨN ở 11 §3, chép
// nguyên) hoặc null = hợp lệ. Chữ người nhập được trim trước khi đo.
import { isValidVnPhone } from "@/lib/phone";
import { COASTAL_PROVINCES, provinceKey } from "@/lib/region";
import { isProductCategory } from "./categories";
import { validateEta } from "./eta";
import { isPaymentMethod } from "./order-state";
import { isValidMarketQty } from "./pricing";
import { foldVn } from "./text";
import type {
  Actor, Address, CheckoutDraft, ProductDraftM, ProductStatus, RequestDraft, ShopDraft,
} from "./types";

// TRẦN — một nguồn cho cả client lẫn server (11 R8)
export const CART_MAX_LINES = 50;          // dòng/giỏ
export const ORDER_MAX_LINES = 20;         // dòng/đơn-shop
export const CHECKOUT_MAX_SHOPS = 5;       // shop/lần đặt
export const PRODUCT_IMAGE_MAX = 6;
export const IMAGE_MAX_BYTES = 400 * 1024; // client nén; server chặn 500 KB
export const VARIANT_MIN = 2;              // 0 hoặc 2..10
export const VARIANT_MAX = 10;
export const ADDRESS_MAX = 10;
export const FAVORITES_MAX = 100;
export const NOTE_MAX = 300;
export const REVIEW_MAX = 500;
export const PRICE_MIN = 1_000;
export const PRICE_MAX = 1_000_000_000;
export const STOCK_MAX = 99_999;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const len = (s: unknown): number => (typeof s === "string" ? s.trim().length : -1);
/** chuỗi tuỳ chọn: thiếu/rỗng = OK, có thì đo độ dài */
const optLen = (s: unknown): number => (s == null || s === "" ? 0 : len(s));

const IMAGE_OK = /^(https:\/\/|\/api\/dev\/uploads\/|data:image\/svg\+xml)/;

function isCoastalProvince(p: string): boolean {
  const k = provinceKey(p);
  return !!k && COASTAL_PROVINCES.some((c) => provinceKey(c.name) === k);
}

export function validateShopDraft(d: ShopDraft): string | null {
  if (!d) return "Thiếu thông tin shop.";
  const name = len(d.name);
  if (name < 3 || name > 60) return "Tên shop 3–60 chữ.";
  if (d.phone != null && d.phone.trim() !== "" && !isValidVnPhone(d.phone))
    return "Nhập số điện thoại liên hệ hợp lệ.";
  if (len(d.province) < 1 || !isCoastalProvince(d.province)) return "Chọn tỉnh của shop.";
  if (optLen(d.address) > 200) return "Địa chỉ tối đa 200 chữ.";
  if (optLen(d.description) > 1000) return "Giới thiệu tối đa 1000 chữ.";
  if (!isInt(d.shippingFlatVnd) || d.shippingFlatVnd < 0 || d.shippingFlatVnd > 5_000_000)
    return "Phí giao từ 0 đến 5 triệu.";
  if (d.freeShipFromVnd != null && (!isInt(d.freeShipFromVnd) || d.freeShipFromVnd < 0))
    return "Ngưỡng miễn phí giao phải là số tiền.";
  const acct = (d.bankAccount ?? "").trim();
  if (acct) {
    if (!/^\d{6,20}$/.test(acct)) return "Số tài khoản 6–20 số.";
    const bn = optLen(d.bankName);
    const bh = optLen(d.bankHolder);
    if (bn < 2 || bn > 40 || bh < 3 || bh > 60) return "Ghi tên ngân hàng và tên chủ tài khoản.";
  }
  return null;
}

export function validateMarketProductDraft(d: ProductDraftM): string | null {
  if (!d) return "Thiếu thông tin món hàng.";
  const t = len(d.title);
  if (t < 3 || t > 120) return "Tên món 3–120 chữ — ghi rõ loại, cỡ, hãng để bà con tìm ra.";
  if (!isProductCategory(d.category)) return "Chọn nhóm hàng.";
  /* LIÊN HỆ BÁO GIÁ (priceVnd null): món bán qua tư vấn — máy tàu, thiết bị lớn
     báo giá theo từng tàu. Không có giá thì cũng KHÔNG có giá gạch và KHÔNG chia
     loại/cỡ: cả hai đều là con số so với giá gốc, không có gốc thì vô nghĩa. */
  const quoteOnly = d.priceVnd == null;
  if (!quoteOnly && (!isInt(d.priceVnd) || d.priceVnd < PRICE_MIN || d.priceVnd > PRICE_MAX))
    return "Giá từ 1.000đ đến 1 tỷ.";
  if (quoteOnly && d.compareAtVnd != null) return "Món liên hệ báo giá thì bỏ trống giá gạch.";
  if (!quoteOnly && d.compareAtVnd != null && (!isInt(d.compareAtVnd) || d.compareAtVnd <= d.priceVnd!))
    return "Giá gạch phải cao hơn giá bán.";
  const u = len(d.unit);
  if (u < 1 || u > 20) return "Ghi đơn vị tính (lít, cái, bao…).";
  if (!isInt(d.stock) || d.stock < 0 || d.stock > STOCK_MAX) return "Tồn kho là số từ 0 đến 99.999.";
  if (optLen(d.description) > 2000) return "Mô tả tối đa 2000 chữ.";
  if (!Array.isArray(d.images) || d.images.length > PRODUCT_IMAGE_MAX) return "Tối đa 6 ảnh.";
  if (d.images.some((u2) => typeof u2 !== "string" || !IMAGE_OK.test(u2))) return "Ảnh chưa đúng — chọn lại ảnh giúp.";
  const vs = Array.isArray(d.variants) ? d.variants : null;
  if (!vs) return "Có loại/cỡ thì cần ít nhất 2.";
  if (vs.length > 0) {
    if (quoteOnly) return "Món liên hệ báo giá thì chưa chia loại/cỡ được — đặt giá trước đã.";
    if (vs.length < VARIANT_MIN) return "Có loại/cỡ thì cần ít nhất 2.";
    if (vs.length > VARIANT_MAX) return "Tối đa 10 loại.";
    const seen = new Set<string>();
    for (const v of vs) {
      const l = len(v?.label);
      if (l < 1 || l > 40) return "Tên loại/cỡ 1–40 chữ.";
      const k = foldVn(v.label);
      if (seen.has(k)) return "Hai loại trùng tên.";
      seen.add(k);
      if (v.priceVnd != null && (!isInt(v.priceVnd) || v.priceVnd < PRICE_MIN || v.priceVnd > PRICE_MAX))
        return "Giá từ 1.000đ đến 1 tỷ.";
    }
  }
  if (d.status !== "dang_ban" && d.status !== "an" && d.status !== "het_hang") return "Trạng thái món không hợp lệ.";
  return null;
}

export function validateAddress(a: Address): string | null {
  if (!a) return "Thiếu địa chỉ nhận.";
  const n = len(a.name);
  if (n < 2 || n > 60) return "Ghi tên người nhận.";
  if (typeof a.phone !== "string" || !isValidVnPhone(a.phone)) return "Nhập số điện thoại nhận hàng hợp lệ.";
  const p = len(a.province);
  if (p < 2 || p > 40) return "Chọn tỉnh.";
  const d = len(a.detail);
  if (a.isPort) {
    if (d < 2 || d > 80) return "Ghi tên cảng / bến nhận hàng.";
  } else if (d < 5 || d > 200) {
    return "Ghi địa chỉ đủ để người giao tìm được.";
  }
  return null;
}

export function validateCheckout(d: CheckoutDraft): string | null {
  if (!d || !Array.isArray(d.shops)) return "Thiếu thông tin đặt hàng.";
  if (d.shops.length < 1) return "Chưa có món nào để đặt.";
  if (d.shops.length > CHECKOUT_MAX_SHOPS) return "Mỗi lần đặt tối đa 5 shop — tách bớt sang lần đặt sau.";
  const ids = new Set<string>();
  for (const s of d.shops) {
    if (!s || typeof s.shopId !== "string" || !s.shopId) return "Thiếu shop của món hàng.";
    if (ids.has(s.shopId)) return "Một shop chỉ đặt một đơn mỗi lần.";
    ids.add(s.shopId);
    if (!Array.isArray(s.items) || s.items.length < 1) return "Chưa có món nào để đặt.";
    if (s.items.length > ORDER_MAX_LINES) return "Mỗi đơn tối đa 20 món — tách bớt sang lần đặt sau.";
    for (const it of s.items) {
      if (!it || typeof it.productId !== "string" || !it.productId) return "Thiếu món hàng.";
      if (!isValidMarketQty(it.qty)) return "Số lượng phải là số nguyên từ 1 đến 999.";
      if (it.variantLabel != null && typeof it.variantLabel !== "string") return "Loại/cỡ không hợp lệ.";
    }
    const cr = typeof s.clientRef === "string" ? s.clientRef.length : 0;
    if (cr < 8 || cr > 64) return "Thiếu mã chống trùng của đơn — mở lại giỏ rồi đặt lại giúp.";
    if (!isInt(s.expectedTotalVnd) || s.expectedTotalVnd < 0) return "Tổng tiền không hợp lệ — tải lại giỏ giúp.";
    // ghi chú RIÊNG cho shop này (11 §5.6) — cùng trần với ghi chú chung
    if (s.buyerNote != null && typeof s.buyerNote !== "string") return "Ghi chú không hợp lệ.";
    if (optLen(s.buyerNote) > NOTE_MAX) return "Ghi chú tối đa 300 chữ.";
  }
  if (!isPaymentMethod(d.paymentMethod)) return "Chọn cách trả tiền.";
  const addr = validateAddress(d.address);
  if (addr) return addr;
  if (optLen(d.buyerNote) > NOTE_MAX) return "Ghi chú tối đa 300 chữ.";
  return null;
}

/** Ô nào đang sai — để form đặt câu lỗi NGAY DƯỚI ô + focus (F-11). Câu lấy từ `validateAddress`, không đẻ câu thứ hai. */
export type AddressField = "name" | "phone" | "province" | "detail";
export function addressErrorField(a: Address): AddressField | null {
  const n = len(a?.name);
  if (n < 2 || n > 60) return "name";
  if (typeof a.phone !== "string" || !isValidVnPhone(a.phone)) return "phone";
  const p = len(a.province);
  if (p < 2 || p > 40) return "province";
  return validateAddress(a) ? "detail" : null;
}

export function validateReview(r: { rating: unknown; comment?: string }): string | null {
  if (!r || !isInt(r.rating) || r.rating < 1 || r.rating > 5) return "Chọn số sao.";
  if (optLen(r.comment) > REVIEW_MAX) return "Nhận xét tối đa 500 chữ.";
  return null;
}

export function validateCancelReason(actor: Actor, reason?: string): string | null {
  const l = optLen(reason);
  if (actor === "seller" || actor === "admin") {
    if (l < 5 || l > 200) return "Ghi lý do cho người mua biết.";
    return null;
  }
  if (l > 200) return "Lý do tối đa 200 chữ.";
  return null;
}

export function validatePaymentNote(reason?: string): string | null {
  const l = optLen(reason);
  if (l < 5 || l > 200) return "Ghi lý do cho người mua biết.";
  return null;
}

export function validateStatusNote(note?: string): string | null {
  const l = optLen(note);
  if (l < 5 || l > 300) return "Ghi lý do cho shop biết.";
  return null;
}

/** Sản phẩm: kho về 0 ⇒ het_hang; het_hang mà kho > 0 ⇒ dang_ban; 'an' giữ nguyên. */
/*  `priceVnd` là BẮT BUỘC, không phải tuỳ chọn có mặc định: món LIÊN HỆ BÁO GIÁ
    (null) KHÔNG theo dõi tồn kho — nó để `stock = 0` vì không đếm kho, chứ không
    phải vì hết hàng. Cho tham số này một mặc định là để 6 chỗ gọi lặng lẽ gắn
    nhãn "Hết hàng" lên hàng vẫn còn (đã dính thật: thẻ tìm kiếm dán "Hết hàng"
    lên món SEA-40). Bắt buộc ⇒ trình biên dịch ép từng chỗ gọi phải trả lời. */
export function normalizeProductStatus(
  status: ProductStatus,
  stock: number,
  priceVnd: number | null,
): ProductStatus {
  if (status === "an") return "an";
  if (priceVnd == null) return status === "het_hang" ? "dang_ban" : status;
  if (stock <= 0) return "het_hang";
  if (status === "het_hang") return "dang_ban";
  return status;
}

// ── YÊU CẦU ĐẶT HÀNG (2026-10-18) ─────────────────────────────────────────
export const REQUEST_IMAGE_MAX = 3;
export const REQUEST_QTY_MAX = 9_999;
export const SHIPPING_MAX = 5_000_000;

export function validateRequestDraft(d: RequestDraft, today: string): string | null {
  if (!d) return "Thiếu thông tin món cần đặt.";
  const t = len(d.title);
  if (t < 3 || t > 120) return "Ghi tên món cần đặt (3–120 chữ).";
  if (!isInt(d.qty) || d.qty < 1 || d.qty > REQUEST_QTY_MAX) return "Số lượng từ 1 đến 9999.";
  const u = len(d.unit);
  if (u < 1 || u > 20) return "Ghi đơn vị (cái, bộ, thùng…).";
  if (optLen(d.description) > 1000) return "Mô tả tối đa 1000 chữ.";
  if (d.images != null) {
    if (!Array.isArray(d.images) || d.images.length > REQUEST_IMAGE_MAX) return "Tối đa 3 ảnh.";
    if (d.images.some((x) => typeof x !== "string" || !IMAGE_OK.test(x))) return "Ảnh không hợp lệ — chụp lại giúp.";
  }
  if (d.needBy != null && d.needBy !== "") {
    if (typeof d.needBy !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.needBy) || d.needBy < today) return "Ngày cần hàng không được trước hôm nay.";
  }
  if (!isPaymentMethod(d.paymentMethod)) return "Chọn cách trả tiền.";
  return validateAddress(d.address);
}

export function validateQuote(
  q: { goodsVnd: unknown; shippingVnd: unknown; etaFrom: unknown; etaTo: unknown; note?: unknown; shopId: unknown },
  today: string,
): string | null {
  if (!q) return "Thiếu báo giá.";
  if (typeof q.shopId !== "string" || !q.shopId) return "Chọn shop lo hàng.";
  if (!isInt(q.goodsVnd) || q.goodsVnd < PRICE_MIN || q.goodsVnd > PRICE_MAX) return "Tiền hàng từ 1.000đ đến 1 tỷ.";
  if (!isInt(q.shippingVnd) || q.shippingVnd < 0 || q.shippingVnd > SHIPPING_MAX) return "Phí giao từ 0 đến 5 triệu.";
  if (q.note != null && (typeof q.note !== "string" || q.note.trim().length > NOTE_MAX)) return "Ghi chú tối đa 300 chữ.";
  return validateEta(q.etaFrom, q.etaTo, today);
}
