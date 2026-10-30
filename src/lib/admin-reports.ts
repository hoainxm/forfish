// BÁO CÁO /quan-tri (logic THUẦN — client-safe). Chủ dự án 2026-10-28: "tab báo
// cáo… xem được lượng người đăng ký tài khoản trong ngày/tuần/tháng/năm… và
// nhiều báo cáo số liệu khác". Route /api/admin/reports đọc DB rồi gọi các hàm
// ở đây; UI tab-bao-cao chỉ vẽ.
//
// LUẬT ĐẾM (một chỗ, có test):
//  · Chỉ KHÁCH THẬT: loại `customers.account_kind` ≠ 'real' (test/demo/reviewer)
//    VÀ loại nhân sự (customers.role ≠ customer, staff_accounts) — số báo cáo là
//    số bà con, không phải số người SDVICO tự tạo để thử.
//  · Tài khoản đăng nhập chưa có hàng customers (tự đăng ký) ⇒ VẪN tính — cột
//    account_kind mặc định 'real'. Email không phải SĐT (admin tổng) ⇒ bỏ.
//  · Mốc thời gian chia theo GIỜ VIỆT NAM (UTC+7, không đổi giờ mùa hè).
//  · KHÔNG số tiền: doanh thu/sổ tiền thuộc SDWork (10-ba-spec §OUT).

import { lastOnlineAt } from "@/lib/app-usage";
import { maskPhone } from "@/lib/market/text";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { resolveTier } from "@/lib/tier";

export type ReportPeriod = "day" | "week" | "month" | "year";
export const REPORT_PERIODS: readonly ReportPeriod[] = ["day", "week", "month", "year"];
export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  year: "Năm",
};
/** Số cột trên biểu đồ mỗi kỳ (cột cuối = kỳ hiện tại, đang chạy dở). */
export const PERIOD_BUCKETS: Record<ReportPeriod, number> = {
  day: 14,
  week: 12,
  month: 12,
  year: 5,
};

/** Tham số lạ ⇒ "day" (mặc định an toàn, không ném). */
export function parsePeriod(v: string | null | undefined): ReportPeriod {
  return (REPORT_PERIODS as readonly string[]).includes(v ?? "") ? (v as ReportPeriod) : "day";
}

const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** Mốc đầu kỳ (UTC ms) chứa `ms`, tính theo lịch Việt Nam. Tuần bắt đầu thứ Hai. */
export function bucketStart(ms: number, period: ReportPeriod): number {
  const d = new Date(ms + VN_OFFSET_MS); // đọc bằng getUTC* = giờ VN
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  let local: number;
  if (period === "year") local = Date.UTC(y, 0, 1);
  else if (period === "month") local = Date.UTC(y, m, 1);
  else {
    local = Date.UTC(y, m, d.getUTCDate());
    if (period === "week") local -= ((d.getUTCDay() + 6) % 7) * DAY_MS;
  }
  return local - VN_OFFSET_MS;
}

/** Lùi `k` kỳ từ mốc đầu kỳ `start`. */
function shiftBucket(start: number, period: ReportPeriod, k: number): number {
  if (period === "day") return start - k * DAY_MS;
  if (period === "week") return start - k * 7 * DAY_MS;
  const d = new Date(start + VN_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const local = period === "month" ? Date.UTC(y, m - k, 1) : Date.UTC(y - k, 0, 1);
  return local - VN_OFFSET_MS;
}

/** Nhãn cột: ngày/tuần "28/10" (tuần = ngày thứ Hai), tháng "10/2026", năm "2026". */
export function bucketLabel(start: number, period: ReportPeriod): string {
  const d = new Date(start + VN_OFFSET_MS);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (period === "year") return String(d.getUTCFullYear());
  if (period === "month") return `${mm}/${d.getUTCFullYear()}`;
  return `${dd}/${mm}`;
}

/** Mốc đầu của `n` kỳ gần nhất, tăng dần; phần tử cuối = kỳ đang chạy. */
export function bucketStarts(nowMs: number, period: ReportPeriod, n = PERIOD_BUCKETS[period]): number[] {
  const cur = bucketStart(nowMs, period);
  const out: number[] = [];
  for (let k = n - 1; k >= 0; k--) out.push(shiftBucket(cur, period, k));
  return out;
}

export type SeriesPoint = { start: string; label: string; count: number };

/** Đếm mốc thời gian vào từng kỳ. Mốc rỗng/hỏng/ngoài khoảng ⇒ bỏ (không ném). */
export function countSeries(
  timestamps: readonly (string | null | undefined)[],
  period: ReportPeriod,
  nowMs: number,
  n = PERIOD_BUCKETS[period],
): SeriesPoint[] {
  const starts = bucketStarts(nowMs, period, n);
  const index = new Map(starts.map((s, i) => [s, i]));
  const counts = starts.map(() => 0);
  for (const ts of timestamps) {
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms) || ms > nowMs) continue;
    const i = index.get(bucketStart(ms, period));
    if (i !== undefined) counts[i]++;
  }
  return starts.map((s, i) => ({
    start: new Date(s).toISOString(),
    label: bucketLabel(s, period),
    count: counts[i],
  }));
}

export type SeriesSummary = {
  /** kỳ đang chạy */
  current: number;
  /** kỳ liền trước (đã trọn) */
  previous: number;
  /** cộng cả khoảng đang xem */
  inRange: number;
};

export function summarize(series: readonly SeriesPoint[]): SeriesSummary {
  const n = series.length;
  return {
    current: n ? series[n - 1].count : 0,
    previous: n > 1 ? series[n - 2].count : 0,
    inRange: series.reduce((s, p) => s + p.count, 0),
  };
}

/** Mốc đầu khoảng đang xem (ISO) — route lọc DB từ đây cho đỡ tải. */
export function rangeStartIso(nowMs: number, period: ReportPeriod): string {
  return new Date(bucketStarts(nowMs, period)[0]).toISOString();
}

/* ── ai được đếm ─────────────────────────────────────────────────────────── */

export type CustomerRow = {
  phone: string | null;
  account_kind?: string | null;
  role?: string | null;
  tier?: string | null;
  premium_until?: string | null;
  pwa_last_open_at?: string | null;
  web_last_open_at?: string | null;
  offline_ready_at?: string | null;
};

/** SĐT (đã chuẩn hoá) KHÔNG được đếm: tài khoản thử + nhân sự. */
export function excludedPhones(
  customers: readonly CustomerRow[],
  staffPhones: Iterable<string>,
): Set<string> {
  const out = new Set<string>();
  for (const p of staffPhones) if (p) out.add(normalizeVnPhone(p));
  for (const c of customers) {
    if (!c.phone) continue;
    const kind = c.account_kind ?? "real";
    const role = c.role ?? "customer";
    if (kind !== "real" || role !== "customer") out.add(normalizeVnPhone(c.phone));
  }
  return out;
}

/** Có tính vào báo cáo không: phải là SĐT VN hợp lệ và không nằm trong danh sách loại. */
export function isCountable(phone: string | null | undefined, excluded: ReadonlySet<string>): boolean {
  if (!phone || !isValidVnPhone(phone)) return false;
  return !excluded.has(normalizeVnPhone(phone));
}

/* ── ảnh chụp hiện tại (không có lịch sử theo ngày — DB chỉ giữ mốc MỚI NHẤT) ── */

export type UsageSnapshot = {
  /** khách thật có hàng customers */
  customers: number;
  premiumActive: number;
  /** mở app (bản cài hoặc web) trong 24 giờ / 7 / 30 ngày qua */
  open1d: number;
  open7d: number;
  open30d: number;
  /** đã tải đủ đồ đi biển (bản cài) */
  offlineReady: number;
};

export function usageSnapshot(
  customers: readonly CustomerRow[],
  excluded: ReadonlySet<string>,
  nowMs: number,
): UsageSnapshot {
  const out: UsageSnapshot = {
    customers: 0,
    premiumActive: 0,
    open1d: 0,
    open7d: 0,
    open30d: 0,
    offlineReady: 0,
  };
  for (const c of customers) {
    if (!isCountable(c.phone, excluded)) continue;
    out.customers++;
    if (resolveTier(c.tier, c.premium_until, nowMs) === "premium") out.premiumActive++;
    if (c.offline_ready_at) out.offlineReady++;
    const last = lastOnlineAt({
      pwaLastOpenAt: c.pwa_last_open_at ?? null,
      webLastOpenAt: c.web_last_open_at ?? null,
    }).any;
    const ms = last ? Date.parse(last) : NaN;
    if (!Number.isFinite(ms)) continue;
    const age = nowMs - ms;
    if (age <= DAY_MS) out.open1d++;
    if (age <= 7 * DAY_MS) out.open7d++;
    if (age <= 30 * DAY_MS) out.open30d++;
  }
  return out;
}

/** Tỉ lệ phần trăm làm tròn; mẫu 0 ⇒ null (UI hiện "—", không chia cho 0). */
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}

/* ── premium theo người cấp ──────────────────────────────────────────────── */

export type GrantRow = {
  customer_phone: string | null;
  granted_by: string | null;
  action: string | null;
  created_at: string | null;
};

/** Lượt BÁN được tính = kích hoạt + gia hạn (hạ hạng không phải lượt bán). */
export function isSaleGrant(g: GrantRow): boolean {
  return g.action === "activate" || g.action === "renew";
}

/** Xếp hạng người cấp trong khoảng từ `sinceIso`; SĐT người cấp CHE giữa. */
export function topGranters(
  grants: readonly GrantRow[],
  excluded: ReadonlySet<string>,
  sinceIso: string,
  limit = 5,
): { who: string; count: number }[] {
  const since = Date.parse(sinceIso);
  const by = new Map<string, number>();
  for (const g of grants) {
    if (!isSaleGrant(g) || !isCountable(g.customer_phone, excluded)) continue;
    const t = g.created_at ? Date.parse(g.created_at) : NaN;
    if (!Number.isFinite(t) || t < since) continue;
    const who = g.granted_by?.trim() || "khong-ro";
    by.set(who, (by.get(who) ?? 0) + 1);
  }
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([who, count]) => ({
      // người cấp qua webhook ghi "sdwork"; còn lại là SĐT nhân sự ⇒ che
      who: who === "khong-ro" ? "Không rõ" : /\d{6,}/.test(who) ? maskPhone(who) : who,
      count,
    }));
}

/* ── máy theo loại ───────────────────────────────────────────────────────── */

export type DeviceRow = { customer_phone: string | null; platform: string | null; last_seen_at: string | null };

/** Số MÁY (không phải số người) còn hoạt động trong 30 ngày, chia theo loại máy. */
export function devicesByPlatform(
  devices: readonly DeviceRow[],
  excluded: ReadonlySet<string>,
  nowMs: number,
): Record<"ios" | "android" | "khac", number> {
  const out = { ios: 0, android: 0, khac: 0 };
  for (const d of devices) {
    if (!isCountable(d.customer_phone, excluded)) continue;
    const t = d.last_seen_at ? Date.parse(d.last_seen_at) : NaN;
    if (!Number.isFinite(t) || nowMs - t > 30 * DAY_MS) continue;
    const p = d.platform === "ios" || d.platform === "android" ? d.platform : "khac";
    out[p]++;
  }
  return out;
}
