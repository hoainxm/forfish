// VALIDATE của Chợ vật tư — THUẦN, client + server dùng chung, server là chốt.
// Mọi hàm trả `string | null`: câu tiếng Việt đời thường (CHUẨN ở 11 §3, chép
// nguyên) hoặc null = hợp lệ. Chữ người nhập được trim trước khi đo.
import { isValidVnPhone } from "@/lib/phone";
import { COASTAL_PROVINCES, provinceKey } from "@/lib/region";
import { isProductCategory } from "./categories";
import { isPaymentMethod } from "./order-state";
import { isValidMarketQty } from "./pricing";
import { foldVn } from "./text";
import type {
  Actor, Address, CheckoutDraft, ProductDraftM, ProductStatus, ShopDraft,
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
  if (!isInt(d.priceVnd) || d.priceVnd < PRICE_MIN || d.priceVnd > PRICE_MAX) return "Giá từ 1.000đ đến 1 tỷ.";
  if (d.compareAtVnd != null && (!isInt(d.compareAtVnd) || d.compareAtVnd <= d.priceVnd))
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
export function normalizeProductStatus(status: ProductStatus, stock: number): ProductStatus {
  if (status === "an") return "an";
  if (stock <= 0) return "het_hang";
  if (status === "het_hang") return "dang_ban";
  return status;
}
