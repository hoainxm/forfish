"use client";

// BẢN LƯU YÊU CẦU ĐẶT HÀNG của tôi — localStorage `forfish.myc.v1`, ngăn theo SĐT (khuôn
// orders-cache, 2026-10-18). Mất sóng vẫn xem được báo giá + hẹn giao đã nhận. Giữ ≤ 30.
// Nuốt lỗi khi ghi — tải lại được; KHÔNG bao giờ là nguồn sự thật.
import { cartBucket } from "@/lib/cart";
import type { MarketRequest } from "./types";

export const MARKET_REQUESTS_CACHE_KEY = "forfish.myc.v1";
const MAX = 30;
type Stored = { phone: string; savedAt: number; items: MarketRequest[] };

export function loadCachedRequests(phone: string | null | undefined): { savedAt: number; items: MarketRequest[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_REQUESTS_CACHE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || s.phone !== cartBucket(phone) || typeof s.savedAt !== "number" || !Array.isArray(s.items)) return null;
    return { savedAt: s.savedAt, items: s.items.filter((r): r is MarketRequest => !!r && typeof r.id === "string" && typeof r.status === "string") };
  } catch {
    return null;
  }
}

/** Gộp theo id (một yêu cầu vừa mở chi tiết ghi đè bản cũ), mới nhất trước, ≤ 30. */
export function saveCachedRequests(phone: string | null | undefined, items: MarketRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    const old = loadCachedRequests(phone)?.items ?? [];
    const byId = new Map(old.map((r) => [r.id, r]));
    for (const r of items) byId.set(r.id, r);
    const top = [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, MAX);
    window.localStorage.setItem(MARKET_REQUESTS_CACHE_KEY, JSON.stringify({ phone: cartBucket(phone), savedAt: Date.now(), items: top } satisfies Stored));
  } catch {
    /* hết chỗ — bản lưu là phụ */
  }
}
