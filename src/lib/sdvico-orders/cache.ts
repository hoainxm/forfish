"use client";

// BẢN LƯU ĐƠN SDVICO — localStorage `forfish.sdvico-orders.v1`, ngăn theo SĐT
// (khuôn lib/market/orders-cache.ts). Mất sóng vẫn xem được đơn + tổng tiền.
// Nuốt lỗi khi ghi; KHÔNG bao giờ là nguồn sự thật.
import { cartBucket } from "@/lib/cart";
import type { SdvicoOrder } from "./types";

export const SDVICO_ORDERS_CACHE_KEY = "forfish.sdvico-orders.v1";

type Stored = { phone: string; savedAt: number; orders: SdvicoOrder[] };

export function loadCachedSdvicoOrders(
  phone: string | null | undefined,
): { savedAt: number; orders: SdvicoOrder[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SDVICO_ORDERS_CACHE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || typeof s.savedAt !== "number" || !Array.isArray(s.orders)) return null;
    if (s.phone !== cartBucket(phone)) return null;
    return {
      savedAt: s.savedAt,
      orders: s.orders.filter((o): o is SdvicoOrder => !!o && typeof o.id === "string" && typeof o.status === "string"),
    };
  } catch {
    return null;
  }
}

export function saveCachedSdvicoOrders(phone: string | null | undefined, orders: SdvicoOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { phone: cartBucket(phone), savedAt: Date.now(), orders };
    window.localStorage.setItem(SDVICO_ORDERS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* hết chỗ — bản lưu là phụ */
  }
}
