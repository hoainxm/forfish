import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dataGate } from "@/lib/supabase/middleware";
import { DATA_ROUTE_MATCHER, dataRouteRule } from "@/lib/data-route-rules";

/**
 * CỔNG DỮ LIỆU (2026-09-16, mở rộng từ chốt premium /api/fish-forecast 2026-08-02):
 * mọi route trả dữ liệu cho app — dự báo cá, lưới thời tiết, dòng chảy, độ mặn,
 * bão, ô ảnh, giá — đều đòi tài khoản + rate limit; dự báo cá và lưới >3 ngày
 * đòi premium. Luật ở lib/data-route-rules.ts (thuần, có test), cổng ở
 * lib/supabase/middleware.ts (đệm danh tính 10 phút để ô ảnh không tra DB từng ô).
 *
 * Matcher là DANH SÁCH ĐÍCH DANH — không mẫu bắt-tất-cả (cổng
 * middleware-matcher.test.ts): mở matcher rộng là quay lại cỗ máy xoay phiên
 * Supabase từng đá bà con ra khỏi tài khoản giữa biển.
 */
export async function middleware(request: NextRequest) {
  const rule = dataRouteRule(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (!rule) return NextResponse.next({ request });
  return dataGate(request, rule);
}

export const config = {
  /*  Ghi tay lại từ DATA_ROUTE_MATCHER (Next đọc `config` tĩnh — không nhận
      import lúc build); test `middleware-matcher.test.ts` đối chiếu hai bên. */
  matcher: [
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
  ],
};

/** Cho test đối chiếu — cùng nguồn với lib. */
export const MATCHER_SOURCE = DATA_ROUTE_MATCHER;
