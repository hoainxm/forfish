"use client";

// GIỎ CHỢ VẬT TƯ — localStorage `forfish.mcart.v1`, ngăn theo SĐT (TÁI DÙNG
// `cartBucket` của lib/cart.ts — cùng luật cách ly máy dùng chung). Giỏ chỉ giữ
// id + biến thể + số lượng; giá tra lại từ server (`POST /api/cho/gio/tinh`),
// bản tra gần nhất (`quote`) cất cùng khoá để mất sóng còn hiện "giá lúc HH:MM".
// Thao tác mảng THUẦN (test được), phần lưu tách riêng.
import { cartBucket } from "@/lib/cart";
import type { CartQuote, MarketCartLine } from "./types";
import { CART_MAX_LINES } from "./validate";

export const MARKET_CART_KEY = "forfish.mcart.v1";
export const MARKET_CART_EVENT = "forfish-mcart-changed";

type Stored = { phone: string; items: MarketCartLine[]; quote?: CartQuote };

const same = (l: MarketCartLine, productId: string, variantLabel?: string) =>
  l.productId === productId && (l.variantLabel ?? "") === (variantLabel ?? "");

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(999, Math.round(qty)));
}

// ── Thao tác mảng THUẦN ───────────────────────────────────────────────────

/** Cộng dồn theo (productId, variantLabel); vượt 50 dòng ⇒ items cũ + reason. */
export function addMarketLine(
  items: MarketCartLine[],
  productId: string,
  variantLabel: string | undefined,
  qty = 1,
): { items: MarketCartLine[]; reason?: "gio_day" } {
  const add = clampQty(qty);
  const idx = items.findIndex((l) => same(l, productId, variantLabel));
  if (idx >= 0) {
    const next = items.map((l, i) => (i === idx ? { ...l, qty: clampQty(l.qty + add) } : l));
    return { items: next };
  }
  if (items.length >= CART_MAX_LINES) return { items, reason: "gio_day" };
  const line: MarketCartLine = { productId, qty: add, ...(variantLabel ? { variantLabel } : {}) };
  return { items: [...items, line] };
}

/** qty<=0 = bỏ; clamp 1..999. */
export function setMarketLineQty(
  items: MarketCartLine[],
  productId: string,
  variantLabel: string | undefined,
  qty: number,
): MarketCartLine[] {
  if (!Number.isFinite(qty) || qty <= 0) return removeMarketLine(items, productId, variantLabel);
  return items.map((l) => (same(l, productId, variantLabel) ? { ...l, qty: clampQty(qty) } : l));
}

export function removeMarketLine(items: MarketCartLine[], productId: string, variantLabel?: string): MarketCartLine[] {
  return items.filter((l) => !same(l, productId, variantLabel));
}

/** Xoá đúng dòng đã đặt được (LEAD §4 #5) — mọi biến thể của các productId đó. */
export function removeShopLines(items: MarketCartLine[], productIds: string[]): MarketCartLine[] {
  const set = new Set(productIds);
  return items.filter((l) => !set.has(l.productId));
}

export function marketCartCount(items: MarketCartLine[]): number {
  return items.reduce((s, l) => s + l.qty, 0);
}

// ── Lưu / đọc trên máy (ngăn theo SĐT) ────────────────────────────────────

function readStored(phone: string | null | undefined): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_CART_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || !Array.isArray(s.items)) return null;
    if (s.phone !== cartBucket(phone)) return null;
    return s;
  } catch {
    return null;
  }
}

const cleanLines = (items: unknown[]): MarketCartLine[] =>
  items.filter(
    (l): l is MarketCartLine =>
      !!l && typeof (l as MarketCartLine).productId === "string" && typeof (l as MarketCartLine).qty === "number",
  );

/** Ngăn khác ⇒ []. */
export function loadMarketCart(phone: string | null | undefined): MarketCartLine[] {
  const s = readStored(phone);
  return s ? cleanLines(s.items) : [];
}

/**
 * Đọc lại xác minh; false ⇒ UI băng đỏ "Máy hết chỗ — CHƯA lưu được giỏ"
 * (storageFullCopy). EVENT chỉ khi ok; GIỮ quote đang có.
 */
export function saveMarketCart(phone: string | null | undefined, items: MarketCartLine[]): boolean {
  if (typeof window === "undefined") return false;
  let ok = false;
  try {
    const prev = readStored(phone);
    const payload: Stored = { phone: cartBucket(phone), items, ...(prev?.quote ? { quote: prev.quote } : {}) };
    const json = JSON.stringify(payload);
    window.localStorage.setItem(MARKET_CART_KEY, json);
    ok = window.localStorage.getItem(MARKET_CART_KEY) === json;
  } catch {
    ok = false;
  }
  if (ok) {
    try {
      window.dispatchEvent(new Event(MARKET_CART_EVENT));
    } catch {
      /* WebView rất cũ */
    }
  }
  return ok;
}

export function clearMarketCart(phone: string | null | undefined): void {
  void phone; // xoá cả khoá — ngăn nào cũng bỏ (đăng xuất / xoá dữ liệu tài khoản)
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MARKET_CART_KEY);
    window.dispatchEvent(new Event(MARKET_CART_EVENT));
  } catch {
    /* bỏ qua */
  }
}

/** Bản tra gần nhất (11 §3.3) — mất sóng hiện "giá lúc HH:MM". */
export function loadMarketQuote(phone: string | null | undefined): CartQuote | null {
  const s = readStored(phone);
  const q = s?.quote;
  return q && typeof q.at === "string" && Array.isArray(q.groups) ? q : null;
}

/** Nuốt lỗi — tra lại được. */
export function saveMarketQuote(phone: string | null | undefined, quote: CartQuote): void {
  if (typeof window === "undefined") return;
  try {
    const prev = readStored(phone);
    const payload: Stored = { phone: cartBucket(phone), items: prev ? cleanLines(prev.items) : [], quote };
    window.localStorage.setItem(MARKET_CART_KEY, JSON.stringify(payload));
  } catch {
    /* hết chỗ — bản tra là phụ */
  }
}
