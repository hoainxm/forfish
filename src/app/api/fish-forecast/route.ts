import { computeFishForecast } from "@/lib/fish-forecast-run";
import { loadFishSnapshot } from "@/lib/fish-snapshot";

/**
 * Dự báo cá (PFZ) — nay ĐỌC SNAPSHOT do cron tính sẵn, KHÔNG tự kéo nguồn nữa
 * (trừ fallback). Compute thật đã tách sang `lib/fish-forecast-run.ts`; cron
 * `/api/cron/refresh-fish` (GitHub Actions 6h + Vercel cron) tính rồi ghi
 * Supabase.
 *
 * Vì sao đổi: tính tại chỗ kéo 7 nguồn (ERDDAP + HYCOM OPeNDAP + Copernicus
 * Zarr), nguồn nặng + hay treo → lần lạnh chậm/hỏng, client 35s hủy → "dự báo
 * cá chưa tải được". Đọc snapshot thì nhanh + không phụ thuộc nguồn treo.
 *
 * PHÂN QUYỀN PREMIUM (2026-07-26): chốt THẬT ở MIDDLEWARE (lib/supabase/
 * middleware.ts) — 401 chưa đăng nhập · 403 chưa premium — chặn TRƯỚC cache nên
 * route giữ ISR (đọc cookies ở đây sẽ thành dynamic). ĐỪNG thêm auth vào route.
 */

// Fallback (chưa có snapshot) vẫn kéo nguồn 14–30s → giữ 60s, khỏi 504.
export const maxDuration = 60;
// Đọc snapshot: ISR 30 phút (khớp SNAPSHOT_REVALIDATE ở lib/fish-snapshot-policy;
// để LITERAL vì Next yêu cầu revalidate là hằng biên dịch). Cron ghi mỗi ~6h.
export const revalidate = 1800;

export async function GET() {
  // 1) SNAPSHOT cron tính sẵn — nhanh, không đụng nguồn treo.
  const snap = await loadFishSnapshot();
  if (snap) return Response.json(snap);
  // 2) Chưa có snapshot (lần đầu deploy / cron chưa chạy / bảng chưa tạo) → tự
  //    tính như trước để KHÔNG BAO GIỜ trắng bản đồ. Chậm nhưng đúng.
  return Response.json(await computeFishForecast());
}
