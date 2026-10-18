"use client";

// CỜ "MÁY NÀY CÓ SHOP" — localStorage `forfish.mshop.v1`, ngăn theo SĐT (LEAD §4
// #16). Để sheet Tài khoản chọn dạng dòng mà KHÔNG gọi mạng lúc mở app; cập nhật
// khi sheet mở + có sóng (`GET /api/ban-hang/shop`). Không có cờ + mất sóng ⇒ ẩn.
import { cartBucket } from "@/lib/cart";
import type { ShopStatus } from "./types";

export const MARKET_SHOP_FLAG_KEY = "forfish.mshop.v1";

export interface ShopFlag { hasShop: boolean; status?: ShopStatus; at: number }

type Stored = { phone: string } & ShopFlag;

/** Ngăn khác ⇒ null. */
export function loadShopFlag(phone: string | null | undefined): ShopFlag | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_SHOP_FLAG_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || typeof s.hasShop !== "boolean" || typeof s.at !== "number") return null;
    if (s.phone !== cartBucket(phone)) return null;
    return { hasShop: s.hasShop, ...(s.status ? { status: s.status } : {}), at: s.at };
  } catch {
    return null;
  }
}

/** Nuốt lỗi — cờ là phụ, lần mở sheet có sóng kế tiếp sẽ ghi lại. */
export function saveShopFlag(phone: string | null | undefined, v: ShopFlag): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { phone: cartBucket(phone), ...v };
    window.localStorage.setItem(MARKET_SHOP_FLAG_KEY, JSON.stringify(payload));
  } catch {
    /* bỏ qua */
  }
}

export function clearShopFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MARKET_SHOP_FLAG_KEY);
  } catch {
    /* bỏ qua */
  }
}
