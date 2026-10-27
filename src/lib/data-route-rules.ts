// LUẬT GÁC ROUTE DỮ LIỆU — thuần, có test (2026-09-16, chủ dự án: "server mình
// là nguồn cho app load về thì đều bảo vệ").
//
// ĐỔI 2026-10-27 (anh Long: "Cho bà con xem các tính năng miễn phí, chỉ có vào bản đồ là bắt đăng nhập mua gói"):
//   · KHÁCH (chưa tài khoản) xem được: tin bão, giá cá (+ lịch sử), giá dầu, thời tiết theo cảng (`sea:<cảng>`) —
//     đếm tần suất theo IP (xô `guest`, trần rộng vì nhiều máy chung IP nhà mạng).
//   · BẢN ĐỒ cần TÀI KHOẢN; GÓI chỉ cho dự báo cá + lớp mà NGUỒN CHO BÁN (anh Long: "lớp dự báo, cá, dữ liệu cc by sẽ
//     yêu cầu premium còn lại cho free"): độ sâu EMODnet (/api/tiles/chart, CC-BY), độ mặn + dòng chảy tầng sâu
//     (Copernicus), nước xoáy (NOAA), dẫn đường (routegrid:). MIỄN PHÍ có tài khoản: phao OSM (/api/tiles/seamark),
//     hải đồ OSM (/api/nautical), AIS, lưới gió/sóng/mưa Open-Meteo (grid:/scalar:) — Open-Meteo free không cho bán,
//     quá 3 ngày chỉ cần gói khi THOI_TIET_XA_CAN_GOI (tier.ts) bật.
//
// Gác ở middleware chứ không trong route để route giữ ISR (đọc header trong
// route là thành dynamic, mỗi request tính lại nguồn ngoài).

import type { RateWindow } from "@/lib/rate-limit";
import { THOI_TIET_XA_CAN_GOI } from "@/lib/tier";

export type DataRouteRule = {
  /** Cần tài khoản (401 nếu không). false = khách xem được, đếm theo IP. */
  account: boolean;
  /** Cần premium (403 nếu không). */
  premium: boolean;
  /** Xô đếm rate limit (mỗi xô một kho riêng). */
  bucket: "fish" | "data" | "tiles" | "guest";
  rate: RateWindow;
};

const TEN_MIN = 10 * 60 * 1000;
export const RATES: Record<DataRouteRule["bucket"], RateWindow> = {
  fish: { limit: 60, windowMs: TEN_MIN },
  data: { limit: 600, windowMs: TEN_MIN },
  tiles: { limit: 3000, windowMs: TEN_MIN },
  // khách theo IP: một IP nhà mạng có thể là cả trăm máy (CGNAT) ⇒ trần rộng; route đều ISR/đệm nên rẻ
  guest: { limit: 3000, windowMs: TEN_MIN },
};

/** Tầm ngày tối đa của tài khoản thường (lib/tier.ts: >3 ngày là premium) — giữ cho UI cũ; bản đồ nay cả gói là premium. */
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
  "/api/tau-ais",
  "/api/tiles/:src/:z/:x/:y",
] as const;

/** `grid:d16` / `scalar:cloud:d7` → 16 / 7; không có mốc ngày ⇒ null. */
export function snapshotDays(id: string | null): number | null {
  if (!id) return null;
  const m = /(?:^|:)d(\d{1,3})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Khách xem được — tin bão, giá, giá dầu (Trang chủ, Chợ, Sen Biển dùng). */
const KHACH = new Set(["/api/storms", "/api/port-prices", "/api/port-prices/history", "/api/fuel-price"]);
/** Lớp bản đồ NGUỒN CHO BÁN — cần tài khoản + gói. */
const CAN_GOI = new Set(["/api/currents-depth", "/api/sea-scalar", "/api/salinity"]);
/** Lớp bản đồ miễn phí — chỉ cần tài khoản. */
const TAI_KHOAN = new Set(["/api/nautical", "/api/tau-ais"]);

const khach = (): DataRouteRule => ({ account: false, premium: false, bucket: "guest", rate: RATES.guest });
const banDo = (bucket: "data" | "tiles" | "fish", premium: boolean): DataRouteRule => ({ account: true, premium, bucket, rate: RATES[bucket] });

/**
 * `weather-snapshot`: `sea:<cảng>` khách xem được; `grid:`/`scalar:` (Open-Meteo) chỉ cần tài khoản (quá 3 ngày cần
 * gói khi THOI_TIET_XA_CAN_GOI); `curdepth:`/`salinity:`/`seascalar:` (Copernicus/NOAA) và `routegrid:` (dẫn đường)
 * cần gói. Id lạ ⇒ cần gói (an toàn: route tự trả bad_id).
 */
function snapshotRule(id: string): DataRouteRule {
  if (id.startsWith("sea:")) return khach();
  if (id.startsWith("grid:") || id.startsWith("scalar:")) {
    const d = snapshotDays(id);
    return banDo("data", THOI_TIET_XA_CAN_GOI && d !== null && d > FREE_MAX_DAYS);
  }
  return banDo("data", true);
}

/** Luật cho một request. null = không phải route dữ liệu (middleware cho qua). */
export function dataRouteRule(pathname: string, search: URLSearchParams): DataRouteRule | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/api/fish-forecast") return banDo("fish", true);
  // ô ảnh: `chart` = độ sâu EMODnet (CC-BY, cho bán) cần gói; `seamark` = phao OpenSeaMap (ODbL) chỉ cần tài khoản
  if (p.startsWith("/api/tiles/")) return banDo("tiles", p.split("/")[3] !== "seamark");
  if (p === "/api/weather-snapshot") return snapshotRule(search.get("id") ?? "");
  if (KHACH.has(p)) return khach();
  if (CAN_GOI.has(p)) return banDo("data", true);
  if (TAI_KHOAN.has(p)) return banDo("data", false);
  return null;
}
