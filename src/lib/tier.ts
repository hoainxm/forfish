// Phân hạng tài khoản (logic THUẦN — dùng chung client/middleware/route).
// 'basic' (mặc định) | 'premium'. Premium mở: dự báo cá + thời tiết quá 3 ngày.
// Hạng nằm ở customers.tier + customers.premium_until (migration 0003) — nguồn
// gán: webhook SDWork hoặc web quản trị riêng (admin/). App KHÔNG có luồng
// thanh toán.

export type AccountTier = "basic" | "premium";

/** Nấc truy cập tính năng premium trên UI — mỗi nấc một lời mời khác nhau:
 *  · "checking": đang kiểm tra phiên/hạng — KHÔNG hiện khoá, KHÔNG hiện nội dung
 *    premium (tránh nháy khoá↔mở)
 *  · "login":    chưa đăng nhập → mời Đăng nhập
 *  · "upgrade":  đăng nhập rồi nhưng hạng thường → mời gọi SDVICO nâng cấp
 *  · "open":     premium (hoặc demo mode chưa cấu hình Supabase — mở hết,
 *    cùng nếp với các gate khác trong app) */
export type FeatureAccess = "checking" | "login" | "upgrade" | "open";

/** Thời tiết mở miễn phí đúng 3 ngày (hôm nay + 2 ngày kế) — quá 3 ngày là premium. */
export const FREE_FORECAST_DAYS = 3;

/**
 * Hạng HIỆU LỰC từ dữ liệu DB: tier='premium' và còn hạn (premium_until null =
 * không hạn). Mọi giá trị lạ/hết hạn/ngày hỏng → 'basic' (khoá nhầm còn hơn mở
 * nhầm — fail-closed).
 */
export function resolveTier(
  tier: string | null | undefined,
  premiumUntil: string | null | undefined,
  nowMs: number,
): AccountTier {
  if (tier !== "premium") return "basic";
  if (premiumUntil == null || premiumUntil === "") return "premium";
  const t = Date.parse(premiumUntil);
  if (!Number.isFinite(t)) return "basic";
  return t >= nowMs ? "premium" : "basic";
}
