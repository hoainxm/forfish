// ĐƠN ĐẶT HÀNG — logic THUẦN (client-safe, KHÔNG import server-only). Dùng
// chung: client (dựng dòng hàng + tổng để hiện giỏ), route /api/me/orders
// (tính LẠI tổng ở server, không tin client), route /api/admin/orders (chuyển
// trạng thái). Khớp bảng catalog_orders (migration 0033).
//
// Helper tách riêng để test ở src/lib/__tests__/catalog-orders.test.ts.

import { isValidVnPhone } from "@/lib/phone";
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
