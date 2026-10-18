"use client";

// ĐỊA CHỈ NHẬN của Chợ vật tư — localStorage `forfish.maddr.v1`, ngăn theo SĐT
// (cartBucket). Tối đa ADDRESS_MAX (validate.ts). Đơn CHỤP snapshot địa chỉ —
// sửa ở đây không đổi đơn đã đặt (11 §3.4).
import { cartBucket } from "@/lib/cart";
import type { Address } from "./types";
import { ADDRESS_MAX } from "./validate";

export const MARKET_ADDR_KEY = "forfish.maddr.v1";

export interface SavedAddress extends Address { id: string; isDefault: boolean }

type Stored = { phone: string; items: SavedAddress[] };

// ── THUẦN ─────────────────────────────────────────────────────────────────

/** Thêm/sửa theo id; đầy 10 ⇒ thay cái cũ nhất không default. Chỉ một isDefault. */
export function upsertAddress(list: SavedAddress[], a: SavedAddress): SavedAddress[] {
  const idx = list.findIndex((x) => x.id === a.id);
  let next: SavedAddress[];
  if (idx >= 0) {
    next = list.map((x, i) => (i === idx ? { ...a } : x));
  } else {
    next = [...list];
    if (next.length >= ADDRESS_MAX) {
      const victim = next.findIndex((x) => !x.isDefault);
      next.splice(victim >= 0 ? victim : next.length - 1, 1);
    }
    next.push({ ...a });
  }
  if (a.isDefault) next = next.map((x) => (x.id === a.id ? x : { ...x, isDefault: false }));
  else if (!next.some((x) => x.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true };
  return next;
}

export function setDefaultAddress(list: SavedAddress[], id: string): SavedAddress[] {
  if (!list.some((x) => x.id === id)) return list;
  return list.map((x) => ({ ...x, isDefault: x.id === id }));
}

export function removeAddress(list: SavedAddress[], id: string): SavedAddress[] {
  const next = list.filter((x) => x.id !== id);
  if (next.length > 0 && !next.some((x) => x.isDefault)) next[0] = { ...next[0], isDefault: true };
  return next;
}

/** Địa chỉ gợi ý lần đầu: tên/SĐT tài khoản + tỉnh cảng nhà (`loadHome().province`, lib/region.ts) — chỉ thiếu cảng/địa chỉ (11 §5.6). */
export function seedAddress(input: { name?: string; phone: string; province?: string }): Address {
  return {
    name: (input.name ?? "").trim(),
    phone: input.phone,
    province: (input.province ?? "").trim(),
    detail: "",
    isPort: true,
  };
}

// ── Lưu / đọc ─────────────────────────────────────────────────────────────

const clean = (items: unknown[]): SavedAddress[] =>
  items.filter(
    (a): a is SavedAddress =>
      !!a && typeof (a as SavedAddress).id === "string" && typeof (a as SavedAddress).name === "string" &&
      typeof (a as SavedAddress).phone === "string" && typeof (a as SavedAddress).detail === "string",
  );

export function loadAddresses(phone: string | null | undefined): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MARKET_ADDR_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.phone !== "string" || !Array.isArray(s.items)) return [];
    if (s.phone !== cartBucket(phone)) return [];
    return clean(s.items);
  } catch {
    return [];
  }
}

/** Đọc lại xác minh — false ⇒ màn phải nói "máy hết chỗ". */
export function saveAddresses(phone: string | null | undefined, list: SavedAddress[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const json = JSON.stringify({ phone: cartBucket(phone), items: list } satisfies Stored);
    window.localStorage.setItem(MARKET_ADDR_KEY, json);
    return window.localStorage.getItem(MARKET_ADDR_KEY) === json;
  } catch {
    return false;
  }
}
