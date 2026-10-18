"use client";

// BẢN LƯU ĐƠN CỦA TÔI — localStorage `forfish.morders.v1`, ngăn theo SĐT. Để
// mất sóng còn xem đơn đã đặt + số gọi shop (11 §9). Giữ ≤ 50 đơn mới nhất.
// Nuốt lỗi khi ghi — tải lại được; KHÔNG bao giờ là nguồn sự thật.
import { cartBucket } from "@/lib/cart";
import type { Order } from "./types";

export const MARKET_ORDERS_CACHE_KEY = "forfish.morders.v1";
export const ORDERS_CACHE_MAX = 50;

type Stored = { phone: string; savedAt: number; orders: Order[] };

export function loadCachedMarketOrders(phone: string | null | undefined): { savedAt: number; orders: Order[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_ORDERS_CACHE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || typeof s.savedAt !== "number" || !Array.isArray(s.orders)) return null;
    if (s.phone !== cartBucket(phone)) return null;
    return {
      savedAt: s.savedAt,
      orders: s.orders.filter((o): o is Order => !!o && typeof o.id === "string" && typeof o.status === "string"),
    };
  } catch {
    return null;
  }
}

/** Nuốt lỗi — tải lại được; giữ ≤ 50 đơn mới nhất (theo createdAt). */
export function saveCachedMarketOrders(phone: string | null | undefined, orders: Order[]): void {
  if (typeof window === "undefined") return;
  try {
    const top = [...orders]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, ORDERS_CACHE_MAX);
    const payload: Stored = { phone: cartBucket(phone), savedAt: Date.now(), orders: top };
    window.localStorage.setItem(MARKET_ORDERS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* hết chỗ — bản lưu là phụ */
  }
}

export function clearCachedMarketOrders(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MARKET_ORDERS_CACHE_KEY);
  } catch {
    /* bỏ qua */
  }
}
