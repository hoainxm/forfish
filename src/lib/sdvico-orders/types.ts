// ĐƠN SDVICO (CRM/SDWork) của khách lẻ — bản sao CHỈ ĐỌC, nạp qua webhook
// `entity: "order"` (bảng crm_orders, migration 0078, ADR 0018). THUẦN — dùng cả
// server (webhook/route) lẫn client (thẻ đơn /cho/don).

/** 4 trạng thái khách thấy — CRM đã chuẩn hoá trước khi gửi (CRM giữ trạng thái gốc). */
export const SDVICO_ORDER_STATUSES = ["dang_chuan_bi", "dang_giao", "da_giao", "da_huy"] as const;
export type SdvicoOrderStatus = (typeof SDVICO_ORDER_STATUSES)[number];

export function isSdvicoOrderStatus(v: unknown): v is SdvicoOrderStatus {
  return typeof v === "string" && (SDVICO_ORDER_STATUSES as readonly string[]).includes(v);
}

export interface SdvicoOrderLine {
  name: string;
  qty: number;
  unit: string | null;
  unitPriceVnd: number;
  lineTotalVnd: number;
}

export interface SdvicoServiceLine {
  name: string;
  qty: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
}

/** Hình dạng trả ra client (camelCase) — KHÔNG có SĐT/tên khách (client đã biết). */
export interface SdvicoOrder {
  id: string;
  code: string;
  status: SdvicoOrderStatus;
  orderedAt: string | null;
  items: SdvicoOrderLine[];
  services: SdvicoServiceLine[];
  subtotalVnd: number;
  discountVnd: number;
  vatVnd: number;
  serviceVnd: number;
  totalVnd: number;
  carrierName: string | null;
  trackingNumber: string | null;
  updatedAt: string;
}
