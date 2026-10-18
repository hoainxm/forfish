"use client";

// YÊU THÍCH của Chợ vật tư — localStorage `forfish.mfav.v1`, ngăn theo SĐT.
// Kèm SNAPSHOT (tên/giá/ảnh/shop) để mất sóng còn hiện (11 §3.7); có sóng tra lại.
import { cartBucket } from "@/lib/cart";
import { FAVORITES_MAX } from "./validate";

export const MARKET_FAV_KEY = "forfish.mfav.v1";

export interface FavItem {
  productId: string;
  savedAt: number;
  /** priceVnd null = món liên hệ báo giá lúc lưu (xem `Product.priceVnd`). */
  snapshot: { title: string; priceVnd: number | null; image?: string; shopName: string };
}

type Stored = { phone: string; items: FavItem[] };

/** Có ⇒ bỏ; chưa ⇒ thêm đầu; đầy ⇒ bỏ cũ nhất. */
export function toggleFavorite(list: FavItem[], item: FavItem): FavItem[] {
  if (list.some((x) => x.productId === item.productId)) return list.filter((x) => x.productId !== item.productId);
  const next = [item, ...list];
  if (next.length > FAVORITES_MAX) {
    const oldest = next.reduce((a, b) => (b.savedAt < a.savedAt ? b : a));
    return next.filter((x) => x !== oldest);
  }
  return next;
}

export function isFavorite(list: FavItem[], productId: string): boolean {
  return list.some((x) => x.productId === productId);
}

export function loadFavorites(phone: string | null | undefined): FavItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MARKET_FAV_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || !Array.isArray(s.items)) return [];
    if (s.phone !== cartBucket(phone)) return [];
    return s.items.filter(
      (x): x is FavItem => !!x && typeof x.productId === "string" && typeof x.savedAt === "number" && !!x.snapshot,
    );
  } catch {
    return [];
  }
}

export function saveFavorites(phone: string | null | undefined, list: FavItem[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const json = JSON.stringify({ phone: cartBucket(phone), items: list } satisfies Stored);
    window.localStorage.setItem(MARKET_FAV_KEY, json);
    return window.localStorage.getItem(MARKET_FAV_KEY) === json;
  } catch {
    return false;
  }
}
