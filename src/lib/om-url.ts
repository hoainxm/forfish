// CẦU OPEN-METEO QUA MÁY CHỦ MÌNH (2026-10-27, anh Long: "tất cả tải lưu server đi" + "thường ko có dự báo, chỉ có
// ngày hôm nay thôi" + "t ko bán cái đó, nó đc kèm trong tổng dự báo cá của t cho premium"). Thuần, dùng chung
// client / middleware / route.
//
// Trước đây máy bà con gọi THẲNG api.open-meteo.com — máy chủ không biết, không gác được số ngày. Nay mọi lượt từ máy
// đi `/api/om/<api>?<query>`: middleware gác số ngày (`forecast_days` ≤ FREE_FORECAST_DAYS = ai cũng xin được, quá
// = cần gói), route đọc nguồn rồi trả nguyên văn kèm cache CDN. Cron / route máy chủ vẫn gọi thẳng nguồn (`omUrl`
// tự chọn theo môi trường) — không vòng qua chính mình.
//
// Header: chỗ gọi phía máy tự gắn `tokenHeader()` (file này THUẦN — middleware import, không kéo kho máy vào).
// DANH SÁCH TRẮNG: chỉ ba API, chỉ các tham số app đang dùng, giá trị chỉ ký tự an toàn — route không thành proxy mở.

import { apiUrl } from "@/lib/api-base";

export const OM_HOST = {
  forecast: "https://api.open-meteo.com/v1/forecast",
  marine: "https://marine-api.open-meteo.com/v1/marine",
  ensemble: "https://ensemble-api.open-meteo.com/v1/ensemble",
} as const;
export type OmApi = keyof typeof OM_HOST;

export function isOmApi(s: string): s is OmApi {
  return Object.prototype.hasOwnProperty.call(OM_HOST, s);
}

/** Tham số được chuyển tiếp — đúng bộ app đang dùng (lưới, điểm chạm, cảng, dải màu, độ bất định). */
const OM_PARAMS = new Set([
  "latitude",
  "longitude",
  "timezone",
  "forecast_days",
  "hourly",
  "daily",
  "current",
  "models",
  "wind_speed_unit",
]);
/** Lưới lớn nhất app xin là 156 điểm (scalar-field) — để dư. */
const MAX_POINTS = 200;

/** Số ngày lượt này xin. Thiếu ⇒ 7 (mặc định của Open-Meteo) — tức cần gói; hỏng ⇒ null. */
export function omDays(search: URLSearchParams): number | null {
  const v = search.get("forecast_days");
  if (v == null) return 7;
  return /^\d{1,2}$/.test(v) ? Number(v) : null;
}

const toaDo = (v: string | null) =>
  !!v && v.split(",").length <= MAX_POINTS && v.split(",").every((x) => /^-?\d{1,3}(\.\d{1,16})?$/.test(x));

/**
 * URL nguồn cho một lượt qua cầu, hoặc null nếu lượt đó không hợp lệ (API lạ, tham số lạ, toạ độ hỏng, số ngày ngoài
 * 1–16, giá trị có ký tự lạ).
 */
export function omUpstream(api: string, search: URLSearchParams): string | null {
  if (!isOmApi(api)) return null;
  const d = omDays(search);
  if (d == null || d < 1 || d > 16) return null;
  if (!toaDo(search.get("latitude")) || !toaDo(search.get("longitude"))) return null;
  const q = new URLSearchParams();
  for (const [k, v] of search) {
    if (!OM_PARAMS.has(k) || !/^[A-Za-z0-9_,./-]{1,4000}$/.test(v)) return null;
    q.append(k, v);
  }
  return `${OM_HOST[api]}?${q.toString()}`;
}

/**
 * URL cho MỘT lượt Open-Meteo: trên máy bà con ⇒ cầu `/api/om` (gác ngày ở máy chủ); trong cron / route máy chủ ⇒
 * thẳng nguồn. `query` là chuỗi query như trước đây vẫn nối vào sau dấu "?".
 */
export function omUrl(api: OmApi, query: string): string {
  if (typeof window === "undefined") return `${OM_HOST[api]}?${query}`;
  return apiUrl(`/api/om/${api}?${query}`);
}

