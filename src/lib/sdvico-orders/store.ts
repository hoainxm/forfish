import "server-only";
// ĐỌC đơn SDVICO (crm_orders, 0078) — server-only, service role. Bảng KHOÁ KÍN
// (RLS không policy) nên MỌI truy vấn ở đây BẮT BUỘC lọc theo SĐT PHIÊN mà route
// đưa vào (identityFromRequest) — không bao giờ nhận SĐT từ query/body.
import { createAdminClient } from "@/lib/supabase/admin";
import { isSdvicoOrderStatus, type SdvicoOrder } from "./types";

const COLS =
  "id, code, status, ordered_at, items, services, subtotal_vnd, discount_vnd, vat_vnd, service_vnd, total_vnd, carrier_name, tracking_number, updated_at";
export const SDVICO_LIST_MAX = 50;

type Row = {
  id: string;
  code: string;
  status: string;
  ordered_at: string | null;
  items: unknown;
  services: unknown;
  subtotal_vnd: number | string | null;
  discount_vnd: number | string | null;
  vat_vnd: number | string | null;
  service_vnd: number | string | null;
  total_vnd: number | string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  updated_at: string;
};

// bigint về qua PostgREST là number (≤ 2^53) — Number() để chắc cả khi là chuỗi.
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function toSdvicoOrder(r: Row): SdvicoOrder | null {
  if (!isSdvicoOrderStatus(r.status)) return null;
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    orderedAt: r.ordered_at,
    items: Array.isArray(r.items) ? (r.items as SdvicoOrder["items"]) : [],
    services: Array.isArray(r.services) ? (r.services as SdvicoOrder["services"]) : [],
    subtotalVnd: num(r.subtotal_vnd),
    discountVnd: num(r.discount_vnd),
    vatVnd: num(r.vat_vnd),
    serviceVnd: num(r.service_vnd),
    totalVnd: num(r.total_vnd),
    carrierName: r.carrier_name,
    trackingNumber: r.tracking_number,
    updatedAt: r.updated_at,
  };
}

export class SdvicoOrdersUnavailable extends Error {}

/** ≤ 50 đơn mới nhất của SĐT. Chưa cấu hình service key (máy dev) ⇒ []. */
export async function listSdvicoOrders(phone: string): Promise<SdvicoOrder[]> {
  if (!phone) return [];
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("crm_orders")
    .select(COLS)
    .eq("customer_phone", phone)
    .order("ordered_at", { ascending: false, nullsFirst: false })
    .limit(SDVICO_LIST_MAX);
  if (error) throw new SdvicoOrdersUnavailable(error.message);
  return ((data ?? []) as Row[]).map(toSdvicoOrder).filter((o): o is SdvicoOrder => !!o);
}

/** Một đơn — CHỈ khi đúng của SĐT phiên (khác ⇒ null, route trả 404). */
export async function getSdvicoOrder(phone: string, id: string): Promise<SdvicoOrder | null> {
  if (!phone || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("crm_orders")
    .select(COLS)
    .eq("id", id)
    .eq("customer_phone", phone)
    .maybeSingle();
  if (error) throw new SdvicoOrdersUnavailable(error.message);
  return data ? toSdvicoOrder(data as Row) : null;
}
