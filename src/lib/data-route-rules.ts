// LUẬT GÁC ROUTE DỮ LIỆU — thuần, có test (2026-09-16, chủ dự án: "server mình
// là nguồn cho app load về thì đều bảo vệ").
//
// Mọi route trả dữ liệu biển/bản đồ/giá cho app đều qua middleware: PHẢI có
// tài khoản (chuỗi thiết bị), có rate limit theo SĐT; riêng dự báo cá và lưới
// thời tiết QUÁ 3 NGÀY thêm điều kiện premium (luật tier.ts, nay chặn thật).
//
// Gác ở middleware chứ không trong route để route giữ ISR (đọc header trong
// route là thành dynamic, mỗi request tính lại nguồn ngoài).

import type { RateWindow } from "@/lib/rate-limit";

export type DataRouteRule = {
  /** Cần premium (403 nếu không). */
  premium: boolean;
  /** Xô đếm rate limit (mỗi xô một kho riêng). */
  bucket: "fish" | "data" | "tiles";
  rate: RateWindow;
};

const TEN_MIN = 10 * 60 * 1000;
export const RATES: Record<DataRouteRule["bucket"], RateWindow> = {
  fish: { limit: 60, windowMs: TEN_MIN },
  data: { limit: 600, windowMs: TEN_MIN },
  tiles: { limit: 3000, windowMs: TEN_MIN },
};

/** Tầm ngày tối đa của tài khoản thường (lib/tier.ts: >3 ngày là premium). */
export const FREE_MAX_DAYS = 3;

/**
 * Danh sách matcher cho `middleware.ts` — ĐÍCH DANH, không mẫu bắt-tất-cả
 * (cổng `middleware-matcher.test.ts`). Ô ảnh dùng tham số từng đoạn.
 */
export const DATA_ROUTE_MATCHER = [
  "/api/fish-forecast",
  "/api/weather-snapshot",
  "/api/currents-depth",
  "/api/sea-scalar",
  "/api/salinity",
  "/api/storms",
  "/api/nautical",
  "/api/port-prices",
  "/api/port-prices/history",
  "/api/fuel-price",
  "/api/tiles/:src/:z/:x/:y",
] as const;

/** `grid:d16` / `scalar:cloud:d7` → 16 / 7; không có mốc ngày ⇒ null. */
export function snapshotDays(id: string | null): number | null {
  if (!id) return null;
  const m = /(?:^|:)d(\d{1,3})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * Luật cho một request. null = không phải route dữ liệu (middleware cho qua).
 * Lưới thời tiết `weather-snapshot?id=grid:dN` / `scalar:*:dN` với N > 3 là
 * premium; các id khác (sea:<cảng>, seascalar:*, salinity:dN, curdepth:*) miễn
 * phí cho tài khoản thường — giữ đúng cái UI đang cho họ thấy.
 */
export function dataRouteRule(pathname: string, search: URLSearchParams): DataRouteRule | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/api/fish-forecast") return { premium: true, bucket: "fish", rate: RATES.fish };
  if (p.startsWith("/api/tiles/")) return { premium: false, bucket: "tiles", rate: RATES.tiles };
  if (p === "/api/weather-snapshot") {
    const id = search.get("id");
    const d = snapshotDays(id);
    const isWeatherGrid = !!id && (id.startsWith("grid:") || id.startsWith("scalar:"));
    return {
      premium: isWeatherGrid && d !== null && d > FREE_MAX_DAYS,
      bucket: "data",
      rate: RATES.data,
    };
  }
  const free = new Set([
    "/api/currents-depth",
    "/api/sea-scalar",
    "/api/salinity",
    "/api/storms",
    "/api/nautical",
    "/api/port-prices",
    "/api/port-prices/history",
    "/api/fuel-price",
  ]);
  if (free.has(p)) return { premium: false, bucket: "data", rate: RATES.data };
  return null;
}
