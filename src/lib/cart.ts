"use client";

// GIỎ HÀNG — trạng thái LOCAL trên máy (localStorage forfish.cart.v1). Chỉ là
// bước dựng đơn; POST đặt hàng mới cần mạng (online-only). Thao tác mảng THUẦN
// (add/setQty/remove) tách khỏi phần lưu để test được ở __tests__/cart.test.ts.
//
// CÁCH LY MÁY DÙNG CHUNG: giỏ keyed theo SĐT chuẩn hoá (một máy có thể là tàu
// dùng chung). Đọc thấy ngăn của SĐT KHÁC → coi như giỏ rỗng, KHÔNG lộn giỏ
// người trước sang người sau (cùng bất biến với inbox — xem lib/inbox.ts).

import { normalizeVnPhone } from "@/lib/phone";
import type { ProductListing } from "@/lib/product-catalog";

export const CART_KEY = "forfish.cart.v1";
/** Sự kiện in-tab để các thành phần vẽ lại số lượng giỏ ngay khi đổi. */
export const CART_EVENT = "forfish-cart-changed";

const GUEST = "__khach__";

/** Một dòng trong giỏ — chỉ id + số lượng (giá tra từ danh mục lúc hiện/đặt). */
export interface CartLine {
  listingId: string;
  qty: number;
}

type Stored = { phone: string; items: CartLine[] };

/*  ═══ KHÔNG CÒN "MÃ GIỎ" Ở ĐÂY ═══ (gỡ 2026-08-18, thẩm định P1)

    Bản 2026-08-16 giữ một mã chống-đơn-trùng trong chính khoá giỏ, sinh khi giỏ
    từ rỗng có món và GIỮ NGUYÊN qua mọi lần thêm/bớt. Đó là lỗi: đặt hụt (máy
    chủ đã ghi, phản hồi rơi mất) → sửa giỏ → bấm lại ⇒ máy chủ thấy trùng mã và
    trả ĐƠN CŨ ⇒ màn báo "đã gửi" rồi xoá giỏ ⇒ **mất thay đổi bà con vừa sửa**.

    Nay mã tính từ CHÍNH NỘI DUNG đơn lúc bấm gửi — `orderClientRef` trong
    `lib/catalog-orders.ts`. Giỏ quay lại đúng vai trò của nó: một danh sách
    món. ĐỪNG thêm mã nào vào đây nữa. */

/** Ngăn của một SĐT — khớp inboxBucket để nhất quán cách ly tài khoản. */
export function cartBucket(phone: string | null | undefined): string {
  if (!phone) return GUEST;
  const n = normalizeVnPhone(phone);
  return n && n !== "0" ? n : GUEST;
}

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(999, Math.round(qty)));
}

// ── Thao tác mảng THUẦN (test được) ───────────────────────────────────────

/** Thêm món (cộng dồn nếu đã có). Trả MẢNG MỚI, không đụng mảng cũ. */
export function addToCart(
  items: CartLine[],
  listingId: string,
  qty = 1,
): CartLine[] {
  const add = clampQty(qty);
  const idx = items.findIndex((l) => l.listingId === listingId);
  if (idx === -1) return [...items, { listingId, qty: add }];
  const next = [...items];
  next[idx] = { listingId, qty: clampQty(next[idx].qty + add) };
  return next;
}

/** Đặt số lượng tuyệt đối; qty<=0 = bỏ món. Trả MẢNG MỚI. */
export function setQty(
  items: CartLine[],
  listingId: string,
  qty: number,
): CartLine[] {
  if (qty <= 0) return removeItem(items, listingId);
  const idx = items.findIndex((l) => l.listingId === listingId);
  if (idx === -1) return [...items, { listingId, qty: clampQty(qty) }];
  const next = [...items];
  next[idx] = { listingId, qty: clampQty(qty) };
  return next;
}

/** Bỏ một món khỏi giỏ. Trả MẢNG MỚI. */
export function removeItem(items: CartLine[], listingId: string): CartLine[] {
  return items.filter((l) => l.listingId !== listingId);
}

/** Tổng số món (đếm số lượng) — cho chấm số trên nút giỏ. */
export function cartCount(items: CartLine[]): number {
  return items.reduce((s, l) => s + l.qty, 0);
}

/** Tổng tiền theo danh mục hiện tại (bỏ qua món không còn/không giá). */
export function cartTotalVnd(
  items: CartLine[],
  catalog: ProductListing[],
): number {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  let total = 0;
  for (const l of items) {
    const p = byId.get(l.listingId);
    if (p?.orderable && p.visible && p.priceVnd != null && p.priceVnd > 0) {
      total += p.priceVnd * l.qty;
    }
  }
  return total;
}

// ── Lưu / đọc trên máy (keyed theo SĐT) ────────────────────────────────────

/** Đọc giỏ của SĐT hiện tại. Ngăn của SĐT khác / rác → giỏ rỗng (không lộn). */
export function loadCart(phone: string | null | undefined): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || !Array.isArray(s.items)) return [];
    if (s.phone !== cartBucket(phone)) return [];
    return s.items.filter(
      (l): l is CartLine =>
        !!l && typeof l.listingId === "string" && typeof l.qty === "number",
    );
  } catch {
    return [];
  }
}

/** Ghi giỏ cho SĐT hiện tại. Nuốt lỗi (giỏ không phải dữ liệu sống-còn). */
export function saveCart(
  phone: string | null | undefined,
  items: CartLine[],
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { phone: cartBucket(phone), items };
    window.localStorage.setItem(CART_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    // hết chỗ / bị chặn — giỏ chỉ là tiện ích, không báo đỏ
  }
}

/** Xoá sạch giỏ (sau khi đặt xong / đăng xuất). */
export function clearCart(phone: string | null | undefined): void {
  saveCart(phone, []);
}
