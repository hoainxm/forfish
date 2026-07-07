import { loadFishForecast } from "@/lib/fish-forecast-server";

/**
 * Dự báo cá (PFZ) — tính server: kéo lưới SST + phù du mới nhất từ nguồn
 * công khai (chậm, vài MB) rồi chấm điểm bằng lib thuần, trả về gọn cho app.
 * Cache 6 giờ — ảnh nguồn mỗi ngày một bản, không cần tươi hơn.
 * Nguồn fail → { ok:false }, client im lặng/fallback mùa vụ (không bịa).
 * Builder tách ra lib/fish-forecast-server.ts (dùng chung collector 0005).
 *
 * PHÂN QUYỀN kiểu TEASER (user chốt 2026-06-11): API CÔNG KHAI để lớp cá
 * (heatmap + điểm nóng) HIỆN cho mọi người — thu hút. Việc xem CHI TIẾT một
 * điểm (loài gì, khả năng bao nhiêu, đi hướng nào) mới cần đăng nhập, chặn ở
 * CLIENT (fishing-map-view). Trước đây chặn 401 ở API khiến lớp cá biến mất,
 * không hấp dẫn được khách đăng ký.
 */
export async function GET() {
  const month = new Date().getMonth() + 1;
  const forecast = await loadFishForecast(month);
  return Response.json(forecast ?? { ok: false });
}
