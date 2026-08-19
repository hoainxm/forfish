// ĐƠN ĐẶT HÀNG — logic THUẦN (client-safe, KHÔNG import server-only). Dùng
// chung: client (dựng dòng hàng + tổng để hiện giỏ), route /api/me/orders
// (tính LẠI tổng ở server, không tin client), route /api/admin/orders (chuyển
// trạng thái). Khớp bảng catalog_orders (migration 0033).
//
// Helper tách riêng để test ở src/lib/__tests__/catalog-orders.test.ts.

import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import type { ProductListing } from "@/lib/product-catalog";

export type OrderStatus =
  | "moi"
  | "da_nhan"
  | "dang_giao"
  | "da_giao"
  | "da_huy";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "moi",
  "da_nhan",
  "dang_giao",
  "da_giao",
  "da_huy",
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  moi: "Mới",
  da_nhan: "Đã nhận",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  da_huy: "Đã huỷ",
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** Một dòng hàng đã ĐÓNG BĂNG (snapshot) trong đơn — giá không đổi về sau. */
export interface OrderLine {
  listingId: string;
  title: string;
  unit: string;
  priceVnd: number;
  qty: number;
  lineTotalVnd: number;
}

/** Đơn đầy đủ đọc từ DB. */
export interface CatalogOrder {
  id: string;
  customerPhone: string;
  boatName?: string;
  boatRef?: string;
  items: OrderLine[];
  totalVnd: number;
  deliveryLocation?: string;
  contactName?: string;
  contactPhone: string;
  note?: string;
  status: OrderStatus;
  handledBy?: string;
  handledAt?: string;
  dealerNote?: string;
  createdAt: string;
  updatedAt: string;
}

/** Món trong giỏ mà client gửi lên khi đặt (chỉ id + số lượng — giá do server
 *  tra từ danh mục, KHÔNG tin giá client). */
export interface OrderItemInput {
  listingId: string;
  qty: number;
}

/** Phần client gửi khi đặt đơn. */
export interface OrderDraft {
  items: OrderItemInput[];
  boatName?: string;
  boatRef?: string;
  deliveryLocation?: string;
  contactName?: string;
  contactPhone: string;
  note?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   MÃ CHỐNG ĐƠN TRÙNG — GẮN VỚI NỘI DUNG ĐƠN (2026-08-18, thẩm định P1)
   ══════════════════════════════════════════════════════════════════════════

   ⚠️ LỖI CỦA BẢN TRƯỚC: mã gắn với GIỎ (`forfish.cart.v1.ref`), giữ nguyên qua
   mọi lần thêm/bớt/đổi số lượng. Kịch bản mất dữ liệu:
     1. Bấm Đặt (giỏ A) — máy chủ GHI ĐƯỢC đơn nhưng phản hồi rơi mất;
     2. Bà con sửa giỏ thành B (thêm dầu, bớt đá);
     3. Bấm Đặt lại — vẫn mã cũ ⇒ máy chủ nhận ra "trùng" và trả ĐƠN A;
     4. Màn hình báo "Đã gửi đơn" rồi XOÁ GIỎ B ⇒ **thay đổi bốc hơi**, mà bà
        con tin là đã đặt. Chống trùng đổi lấy mất-đơn là lỗ hổng nặng hơn.

   NAY mã = **dấu vân tay của chính nội dung đơn** (món + số lượng + tàu + điểm
   giao + người nhận + SĐT + ghi chú). Cùng nội dung ⇒ cùng mã ⇒ máy chủ nhận
   ra lần gửi lại và trả đúng đơn cũ. Đổi nội dung ⇒ mã khác ⇒ đơn MỚI, đúng ý
   bà con. Không cần lưu gì trong máy, không cần vòng đời riêng, và sống qua cả
   tắt/mở app vì nó chỉ phụ thuộc thứ đang hiện trên màn.

   Vì mã đã bao hàm nội dung nên máy chủ KHÔNG cần trả 409 "cùng mã khác thân":
   khác thân thì mã đã khác. Đây là lý do chọn hash thay vì cặp {ref, hash}. */

/** Chuỗi mô tả đơn theo thứ tự ỔN ĐỊNH (món sắp theo id — thêm rồi bớt lại
 *  không được đổi mã). Chỉ dùng nội bộ cho `orderClientRef`. */
function orderFingerprint(d: OrderDraft): string {
  const items = [...(d.items ?? [])]
    .filter((i) => i && typeof i.listingId === "string")
    .map((i) => `${i.listingId}:${i.qty}`)
    .sort()
    .join(",");
  return [
    items,
    d.boatRef?.trim() ?? "",
    d.boatName?.trim() ?? "",
    d.deliveryLocation?.trim() ?? "",
    d.contactName?.trim() ?? "",
    d.contactPhone?.trim() ?? "",
    d.note?.trim() ?? "",
  ].join("|");
}

/**
 * Mã chống trùng cho MỘT nội dung đơn. Thuần, không đụng kho, không ngẫu nhiên
 * — hai lần bấm cùng nội dung ra cùng mã trên cùng máy lẫn máy khác.
 * FNV-1a 32-bit hai vòng (khác hạt giống) ⇒ 64 bit; đủ để phân biệt các đơn của
 * MỘT SĐT (unique index là `(customer_phone, client_ref)`), không phải hash
 * mật mã và không cần là mật mã.
 */
export function orderClientRef(d: OrderDraft): string {
  const s = orderFingerprint(d);
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return `v1-${fnv(0x811c9dc5)}${fnv(0x9e3779b9)}`;
}

/** Số lượng hợp lệ: nguyên, 1..999. */
export function isValidQty(qty: unknown): qty is number {
  return typeof qty === "number" && Number.isInteger(qty) && qty >= 1 && qty <= 999;
}

/** Trả câu lỗi tiếng Việt nếu draft chưa đặt được, null nếu OK. Chưa tra giá —
 *  chỉ kiểm hình thức (server còn tra danh mục để dựng dòng hàng thật). */
export function validateOrderDraft(d: OrderDraft): string | null {
  if (!Array.isArray(d.items) || d.items.length === 0)
    return "Giỏ hàng đang trống.";
  for (const it of d.items) {
    if (!it || typeof it.listingId !== "string" || !it.listingId.trim())
      return "Có món trong giỏ bị lỗi — thử thêm lại.";
    if (!isValidQty(it.qty)) return "Số lượng phải là số nguyên từ 1 đến 999.";
  }
  if (!d.contactPhone?.trim() || !isValidVnPhone(d.contactPhone))
    return "Nhập số điện thoại nhận hàng hợp lệ.";
  return null;
}

/**
 * Dựng dòng hàng THẬT từ danh mục hiện tại — dùng CHUNG cho client (hiện giỏ)
 * và server (chốt đơn). Bỏ qua món không tìm thấy / không cho đặt / ẩn. Giá lấy
 * từ danh mục (không tin client). Trả cả danh sách món bị bỏ để báo cho người
 * dùng ("có món vừa ngừng bán").
 */
export function buildOrderLines(
  items: OrderItemInput[],
  catalog: ProductListing[],
): { lines: OrderLine[]; dropped: string[] } {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lines: OrderLine[] = [];
  const dropped: string[] = [];
  for (const it of items) {
    const p = byId.get(it.listingId);
    const qty = it.qty;
    if (
      !p ||
      !p.orderable ||
      !p.visible ||
      p.priceVnd == null ||
      p.priceVnd <= 0 ||
      !p.unit ||
      !isValidQty(qty)
    ) {
      dropped.push(it.listingId);
      continue;
    }
    lines.push({
      listingId: p.id,
      title: p.title,
      unit: p.unit,
      priceVnd: p.priceVnd,
      qty,
      lineTotalVnd: p.priceVnd * qty,
    });
  }
  return { lines, dropped };
}

/** Tổng tiền đơn = tổng dòng hàng. */
export function computeOrderTotal(lines: OrderLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotalVnd, 0);
}

/**
 * Chuyển trạng thái HỢP LỆ (một chiều, không quay lui):
 *   moi → da_nhan | da_huy
 *   da_nhan → dang_giao | da_huy
 *   dang_giao → da_giao | da_huy
 *   da_giao, da_huy = kết thúc (không đổi tiếp).
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const map: Record<OrderStatus, OrderStatus[]> = {
    moi: ["da_nhan", "da_huy"],
    da_nhan: ["dang_giao", "da_huy"],
    dang_giao: ["da_giao", "da_huy"],
    da_giao: [],
    da_huy: [],
  };
  return map[from]?.includes(to) ?? false;
}

type Row = {
  id: string;
  customer_phone: string;
  boat_name: string | null;
  boat_ref: string | null;
  items: unknown;
  total_vnd: number;
  delivery_location: string | null;
  contact_name: string | null;
  contact_phone: string;
  note: string | null;
  status: string;
  handled_by: string | null;
  handled_at: string | null;
  dealer_note: string | null;
  created_at: string;
  updated_at: string;
};

function toLines(v: unknown): OrderLine[] {
  if (!Array.isArray(v)) return [];
  const out: OrderLine[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (
      typeof r.listingId === "string" &&
      typeof r.title === "string" &&
      typeof r.unit === "string" &&
      typeof r.priceVnd === "number" &&
      typeof r.qty === "number" &&
      typeof r.lineTotalVnd === "number"
    ) {
      out.push({
        listingId: r.listingId,
        title: r.title,
        unit: r.unit,
        priceVnd: r.priceVnd,
        qty: r.qty,
        lineTotalVnd: r.lineTotalVnd,
      });
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   BẢN LƯU ĐƠN TRONG MÁY (2026-08-18, chủ dự án chốt)
   ══════════════════════════════════════════════════════════════════════════

   *"Cửa hàng nó ít đổi món và đơn, nên cứ xem bình thường, online lại thì tự
   động tải mới."*

   Đơn của một chủ tàu là vài đơn, đổi trạng thái vài lần trong đời đơn — nhỏ
   và ít đổi. Trước bản này mất sóng là màn "Đơn của tôi" chỉ có câu lỗi + nút
   Thử lại, dù đơn đã tải xong ở cảng mấy phút trước. Nay hiện bản đã lưu kèm
   mốc, sóng về thì tự tải mới đè lên.

   ⚠️ CÁCH LY MÁY DÙNG CHUNG: đơn mang SĐT nhận hàng, điểm giao, tên người nhận
   ⇒ ngăn theo SĐT chuẩn hoá như `inbox`/`cart`; đọc thấy ngăn của SĐT khác thì
   coi như TRỐNG, không lộn đơn người trước sang người sau.
   ⚠️ CẤM SAO LƯU ra tệp (`NEVER_BACKUP_PREFIXES`): dữ liệu cá nhân, và có sóng
   là tải lại được — không có lý do gì để nó đi theo tệp sang máy khác. */

export const ORDERS_CACHE_KEY = "forfish.orders.v1";

const ORDERS_GUEST = "__khach__";

type OrdersCache = { phone: string; savedAt: number; orders: CatalogOrder[] };

/** Ngăn của một SĐT — khớp `cartBucket`/`inboxBucket` để nhất quán cách ly. */
export function ordersBucket(phone: string | null | undefined): string {
  if (!phone) return ORDERS_GUEST;
  const n = normalizeVnPhone(phone);
  return n && n !== "0" ? n : ORDERS_GUEST;
}

/** Đơn đã tải gần nhất CỦA ĐÚNG SĐT NÀY + mốc lưu. `null` = không có/khác ngăn. */
export function loadCachedOrders(
  phone: string | null | undefined,
): { savedAt: number; orders: CatalogOrder[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDERS_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as OrdersCache;
    if (!v || typeof v.savedAt !== "number" || !Array.isArray(v.orders)) return null;
    if (v.phone !== ordersBucket(phone)) return null; // ngăn của người khác
    return { savedAt: v.savedAt, orders: v.orders };
  } catch {
    return null;
  }
}

/** Ghi bản đơn vừa tải. Nuốt lỗi — tải lại được, không phải dữ liệu sống-còn. */
export function saveCachedOrders(
  phone: string | null | undefined,
  orders: CatalogOrder[],
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: OrdersCache = {
      phone: ordersBucket(phone),
      savedAt: Date.now(),
      orders,
    };
    window.localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* hết chỗ / bị chặn — bỏ qua, lần sau có sóng tải lại */
  }
}

/** Xoá bản lưu (đăng xuất / xoá dữ liệu tài khoản khỏi máy). */
export function clearCachedOrders(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ORDERS_CACHE_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Dòng DB → CatalogOrder (khoan dung với giá trị lạ, không ném lỗi). */
export function rowToOrder(r: Row): CatalogOrder {
  return {
    id: r.id,
    customerPhone: r.customer_phone,
    boatName: r.boat_name ?? undefined,
    boatRef: r.boat_ref ?? undefined,
    items: toLines(r.items),
    totalVnd: typeof r.total_vnd === "number" ? r.total_vnd : 0,
    deliveryLocation: r.delivery_location ?? undefined,
    contactName: r.contact_name ?? undefined,
    contactPhone: r.contact_phone,
    note: r.note ?? undefined,
    status: isOrderStatus(r.status) ? r.status : "moi",
    handledBy: r.handled_by ?? undefined,
    handledAt: r.handled_at ?? undefined,
    dealerNote: r.dealer_note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
