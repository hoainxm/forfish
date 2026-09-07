// TRỢ LÝ — HẠN MỨC LƯỢT HỎI MẠNG / NGÀY / SĐT (thuần, test được; 14 §6.3, 13 §7.2).
//
// Đếm trong bộ nhớ instance (Map trên `globalThis` để sống qua HMR). Ở kho
// file (dev) route ghi thêm ra `assistant-quota.json` qua `quota-file.ts` để
// restart không quên. Ngày tính theo GIỜ VN (`todayIsoVN` tái dùng).
//
// nợ: quota đếm trong bộ nhớ instance, có thể vượt trần khi Vercel chạy nhiều instance/restart; nâng lên bảng assistant_usage(phone, day, n) + RPC tăng nguyên tử khi hoá đơn Anthropic > ngưỡng chủ dự án đặt

import { todayIsoVN } from "@/lib/days";

export interface QuotaTake {
  ok: boolean;
  remaining: number;
  /** epoch ms của 0h VN ngày kế — cho header Retry-After */
  resetAt: number;
}

export type QuotaStore = Map<string, { day: string; n: number }>;

const G = globalThis as unknown as { __forfishAssistantQuota?: QuotaStore };
export const defaultStore: QuotaStore = (G.__forfishAssistantQuota ??= new Map());

export const DEFAULT_DAILY_LIMIT = 30;

/** yyyy-mm-dd theo giờ VN. */
export function vnDayKey(now: number): string {
  return todayIsoVN(now);
}

/** 0h VN của ngày kế tiếp (epoch ms). */
export function nextVnMidnight(now: number): number {
  const day = vnDayKey(now);
  return Date.parse(`${day}T00:00:00+07:00`) + 86_400_000;
}

/** Kẹp trần vào 1..500; không phải số → mặc định 30. */
export function clampDailyLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return DEFAULT_DAILY_LIMIT;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

/**
 * Lấy MỘT lượt. `ok:false` = đã hết (không tăng). Sang ngày VN mới thì reset.
 * `store` truyền vào để test; mặc định là Map toàn cục của instance.
 */
export function takeQuota(phone: string, limit: number, now = Date.now(), store: QuotaStore = defaultStore): QuotaTake {
  const day = vnDayKey(now);
  const cap = clampDailyLimit(limit);
  const cur = store.get(phone);
  const n = cur && cur.day === day ? cur.n : 0;
  const resetAt = nextVnMidnight(now);
  if (n >= cap) return { ok: false, remaining: 0, resetAt };
  store.set(phone, { day, n: n + 1 });
  return { ok: true, remaining: cap - (n + 1), resetAt };
}

/** Bản phẳng để ghi file (chỉ giữ ngày hiện tại). */
export function serializeQuota(store: QuotaStore, now = Date.now()): Record<string, number> {
  const day = vnDayKey(now);
  const out: Record<string, number> = {};
  for (const [phone, v] of store) if (v.day === day) out[phone] = v.n;
  return out;
}

/** Nạp bản phẳng (đã ghi cùng ngày) vào store — chỉ khi store chưa có số lớn hơn. */
export function hydrateQuota(store: QuotaStore, data: unknown, day: string): void {
  if (!data || typeof data !== "object") return;
  const d = data as { day?: unknown; counts?: unknown };
  if (d.day !== day || !d.counts || typeof d.counts !== "object") return;
  for (const [phone, n] of Object.entries(d.counts as Record<string, unknown>)) {
    if (typeof n !== "number" || !Number.isFinite(n)) continue;
    const cur = store.get(phone);
    if (!cur || cur.day !== day || cur.n < n) store.set(phone, { day, n });
  }
}
