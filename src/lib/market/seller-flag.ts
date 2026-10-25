"use client";

// CỜ "MÁY NÀY CÓ SHOP" — localStorage `forfish.mshop.v1`, ngăn theo SĐT (LEAD §4
// #16). Để sheet Tài khoản chọn dạng dòng mà KHÔNG gọi mạng lúc mở app; cập nhật
// khi sheet mở + có sóng (`GET /api/ban-hang/shop`). Không có cờ + mất sóng ⇒ ẩn.
import { cartBucket } from "@/lib/cart";
import type { ShopStatus } from "./types";

export const MARKET_SHOP_FLAG_KEY = "forfish.mshop.v1";

export interface ShopFlag {
  hasShop: boolean;
  status?: ShopStatus;
  at: number;
  /** số đơn chờ xác nhận lần Tổng quan tải xong (BH-11) — gợi ý cho badge ở sheet Tài khoản / dock, KHÔNG hứa đúng */
  pending?: number;
  /** mốc ghi `pending` (epoch ms) — nơi đọc tự quyết bản cũ quá thì không bày */
  pendingAt?: number;
}

type Stored = { phone: string } & ShopFlag;

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(MARKET_SHOP_FLAG_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || typeof s.hasShop !== "boolean" || typeof s.at !== "number") return null;
    return s;
  } catch {
    return null;
  }
}
/** `pending`/`pendingAt` chỉ nhận khi là số thật — bản hỏng thì coi như chưa có. */
function pendingOf(s: Partial<ShopFlag>): Pick<ShopFlag, "pending" | "pendingAt"> {
  return typeof s.pending === "number" && typeof s.pendingAt === "number" && s.pending >= 0
    ? { pending: s.pending, pendingAt: s.pendingAt }
    : {};
}

/** Ngăn khác ⇒ null. */
export function loadShopFlag(phone: string | null | undefined): ShopFlag | null {
  if (typeof window === "undefined") return null;
  const s = readStored();
  if (!s || s.phone !== cartBucket(phone)) return null;
  return { hasShop: s.hasShop, ...(s.status ? { status: s.status } : {}), at: s.at, ...pendingOf(s) };
}

/** Nuốt lỗi — cờ là phụ, lần mở sheet có sóng kế tiếp sẽ ghi lại.
 *  Không truyền `pending` thì GIỮ `pending` đang có của cùng SĐT (sheet Tài khoản ghi lại cờ từ
 *  /api/ban-hang/shop không biết số đơn — không được xoá số Tổng quan vừa ghi). Hết shop ⇒ bỏ. */
export function saveShopFlag(phone: string | null | undefined, v: ShopFlag): void {
  if (typeof window === "undefined") return;
  try {
    const bucket = cartBucket(phone);
    const cu = readStored();
    const giu = v.pending == null && v.hasShop && cu && cu.phone === bucket ? pendingOf(cu) : {};
    const payload: Stored = { phone: bucket, ...giu, ...v };
    window.localStorage.setItem(MARKET_SHOP_FLAG_KEY, JSON.stringify(payload));
  } catch {
    /* bỏ qua */
  }
}

/** Tổng quan tải xong ⇒ ghi số đơn chờ vào cờ (BH-11). Chưa có cờ cùng SĐT ⇒ không ghi (cờ `hasShop` do useMyShop ghi trước). */
export function savePendingFlag(phone: string | null | undefined, pending: number, at: number = Date.now()): void {
  if (typeof window === "undefined") return;
  const cu = loadShopFlag(phone);
  if (!cu || !cu.hasShop) return;
  saveShopFlag(phone, { ...cu, pending: Math.max(0, Math.floor(pending)), pendingAt: at });
}

export function clearShopFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MARKET_SHOP_FLAG_KEY);
  } catch {
    /* bỏ qua */
  }
}
