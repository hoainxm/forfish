"use client";

// VIỆC LÀM — MÁY ↔ MÁY CHỦ (spec 17 §6.4, §9). Luật thuần (kiểm, trần bản lưu) ở lib/viec.ts.
//
// MẠNG: chỉ gọi khi mở màn /viec/** (không gọi lúc mở app). Mọi lượt có trần thời gian (authedFetch) và KHÔNG ném —
// trả `{ ok: false }` để màn rẽ nhánh lỗi / mất sóng. Bản lưu `forfish.viec.v1` ghi đè MỖI LẦN tải được (không bao
// giờ ghi rỗng-vì-lỗi); SĐT chủ tàu đã mở giữ lại để Gọi được khi mất sóng (§6.4 "Gọi vẫn bấm được").

import { authedFetch } from "@/lib/device-token-store";
import {
  parseCache,
  parseLuu,
  serializeCache,
  toggleLuu,
  VIEC_KEY,
  VIEC_LUU_KEY,
  VIEC_NHAP_KEY,
  type ViecCache,
  type ViecTin,
} from "@/lib/viec";

const READ_MS = 10_000;
const WRITE_MS = 15_000;

export type KetQua<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; message: string | null };

/** Gọi API có chuỗi. status 0 = không tới được máy chủ (mất sóng / hết giờ). */
export async function goiViec<T>(path: string, init: RequestInit = {}): Promise<KetQua<T>> {
  const ms = init.method && init.method !== "GET" ? WRITE_MS : READ_MS;
  const { res } = await authedFetch(path, { cache: "no-store", ...init }, ms);
  if (!res) return { ok: false, status: 0, code: null, message: null };
  const j = (await res.json().catch(() => null)) as ({ ok?: boolean; code?: string; message?: string } & T) | null;
  if (!res.ok || !j?.ok) return { ok: false, status: res.status, code: j?.code ?? null, message: j?.message ?? null };
  return { ok: true, data: j };
}

export const guiJson = (method: "POST" | "PUT" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/* ── Bản lưu danh sách ───────────────────────────────────────────────────── */

export function docCache(): ViecCache | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCache(window.localStorage.getItem(VIEC_KEY));
  } catch {
    return null;
  }
}

/** Ghi danh sách vừa tải. `false` = máy không ghi được (đầy / riêng tư) — màn vẫn chạy. */
export function ghiCache(tin: readonly ViecTin[], luc: number): boolean {
  try {
    const cu = docCache();
    // gộp tin cũ còn hạn mà lần này không về (vd đang lọc tỉnh khác) — bản lưu là "những gì máy đã thấy", mới trước
    const ids = new Set(tin.map((t) => t.id));
    const gop = [...tin, ...(cu?.tin ?? []).filter((t) => !ids.has(t.id) && Date.parse(t.expiresAt) > Date.now())];
    window.localStorage.setItem(VIEC_KEY, serializeCache(gop, luc));
    return true;
  } catch {
    return false;
  }
}

/* ── Tin đã lưu ──────────────────────────────────────────────────────────── */

export const VIEC_LUU_EVENT = "forfish:viec-luu";

export function docLuu(): ViecTin[] {
  if (typeof window === "undefined") return [];
  try {
    return parseLuu(window.localStorage.getItem(VIEC_LUU_KEY));
  } catch {
    return [];
  }
}

/** Bật/tắt lưu. Trả danh sách mới, hoặc null khi máy không ghi được (màn phải nói ra). */
export function batTatLuu(tin: ViecTin): ViecTin[] | null {
  const next = toggleLuu(docLuu(), tin);
  try {
    window.localStorage.setItem(VIEC_LUU_KEY, JSON.stringify(next));
  } catch {
    return null;
  }
  window.dispatchEvent(new CustomEvent(VIEC_LUU_EVENT));
  return next;
}

/* ── Nháp tin đang đăng ──────────────────────────────────────────────────── */

/** Nháp theo tin (`moi` = tin mới, id = đang sửa tin đó). */
export function docNhap<T>(cho: string): T | null {
  try {
    const raw = window.localStorage.getItem(VIEC_NHAP_KEY);
    const o = raw ? (JSON.parse(raw) as { cho?: string; data?: T }) : null;
    return o && o.cho === cho && o.data ? o.data : null;
  } catch {
    return null;
  }
}

export function ghiNhap(cho: string, data: unknown): void {
  try {
    window.localStorage.setItem(VIEC_NHAP_KEY, JSON.stringify({ cho, data, luc: Date.now() }));
  } catch {
    /* máy đầy — chữ vẫn còn trên màn */
  }
}

export function xoaNhap(): void {
  try {
    window.localStorage.removeItem(VIEC_NHAP_KEY);
  } catch {
    /* thôi */
  }
}
