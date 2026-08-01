// Phân hạng tài khoản (logic THUẦN — dùng chung client/middleware/route).
// 'basic' (mặc định) | 'premium'. Premium mở: dự báo cá + thời tiết quá 3 ngày.
// Hạng nằm ở customers.tier + customers.premium_until (migration 0003) — nguồn
// gán: webhook SDWork hoặc web quản trị /quan-tri. App KHÔNG có luồng
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

/** 1 lần kích hoạt premium = 1 NĂM (chốt 2026-07-26); hết hạn thì gia hạn. */
export const PREMIUM_TERM_DAYS = 365;

/**
 * Hạn premium SAU một lần kích hoạt/gia hạn: còn hạn thì CỘNG NỐI vào hạn cũ
 * (gia hạn sớm không bị thiệt ngày), hết hạn/chưa có thì tính 1 năm từ bây giờ.
 */
export function nextPremiumUntil(
  currentUntil: string | null | undefined,
  nowMs: number,
): string {
  const cur = currentUntil ? Date.parse(currentUntil) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(base + PREMIUM_TERM_DAYS * 24 * 3600 * 1000).toISOString();
}

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

/**
 * Hạn premium → "01/08/2027" theo LỊCH VN. Rỗng/hỏng → null.
 *
 * Ghim `timeZone` chứ không để theo máy: `premium_until` là timestamptz lưu
 * UTC, mà kích hoạt buổi chiều VN thì mốc UTC rơi sang NGÀY HÔM TRƯỚC — máy đọc
 * theo giờ máy sẽ hiện lệch một ngày so với web quản trị. Cùng cách với `fmtD`
 * ở /quan-tri để hai bên nói cùng một con số.
 */
export function formatPremiumUntil(
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(t));
}

/** Dòng "hạng của tôi" bày trong sheet Tài khoản. */
export interface TierBadge {
  tone: "premium" | "basic";
  /** nhãn ngắn trong chip */
  label: string;
  /** một câu giải thích kế bên */
  detail: string;
}

/**
 * HẠNG CỦA TÔI — dòng cho bà con TỰ THẤY mình đang là gì (2026-08-01).
 *
 * VÌ SAO CÓ: premium bán ngoài đời (SDVICO gán tay ở /quan-tri), mà trong app
 * KHÔNG có chỗ nào xác nhận. Khách đã trả tiền chỉ biết bằng cách vào Ra khơi
 * thử bật lớp Cá — không thấy gì đổi thì gọi điện hỏi. Một dòng chữ ở sheet
 * Tài khoản đóng được khoảng trống đó.
 *
 * Trả `null` khi CHƯA CHẮC (đang tra hạng) hoặc chưa đăng nhập — thà không nói
 * gì còn hơn nháy "thường" rồi mới đổi thành "premium", hoặc ngược lại.
 */
export function tierBadge(a: {
  access: FeatureAccess;
  premiumUntil: string | null | undefined;
}): TierBadge | null {
  if (a.access === "checking" || a.access === "login") return null;
  if (a.access === "upgrade") {
    return {
      tone: "basic",
      label: "Tài khoản thường",
      // giọng MỜI, không doạ: nói premium mở thêm gì, không nói bà con đang bị
      // chặn cái gì (luật copy giới hạn — 03-design-system)
      detail: "Gọi SDVICO để mở dự báo cá và thời tiết dài ngày.",
    };
  }
  const until = formatPremiumUntil(a.premiumUntil);
  return {
    tone: "premium",
    label: "Premium",
    detail: until
      ? `Đang mở dự báo cá và thời tiết dài ngày, dùng tới ${until}.`
      : "Đang mở dự báo cá và thời tiết dài ngày.",
  };
}

export interface FeatureAccessInput {
  /** Supabase đã cấu hình chưa — chưa thì demo mode mở hết (cùng nếp gate khác) */
  configured: boolean;
  /** phiên đã kiểm xong chưa (useAuthUser.ready) */
  authReady: boolean;
  /** có user đăng nhập không. LƯU Ý: getUser() cần MẠNG để xác thực → mất sóng
      ngoài khơi trả null DÙ bà con vẫn đang đăng nhập */
  hasUser: boolean;
  /** kết quả tra hạng: true=premium, false=basic, null=chưa tra xong */
  premium: boolean | null;
  /** máy đang có sóng không (navigator.onLine) */
  online: boolean;
  /** lần online gần nhất tra ĐƯỢC hạng có phải premium không (đọc từ máy) */
  cachedPremium: boolean;
  /** getUser() reject/timeout (mất sóng "sống mà chết" — onLine có thể lỡ=true).
      KHÁC hasUser=false do tra ĐƯỢC mà không có ai (đăng xuất thật). */
  authErrored?: boolean;
}

/**
 * Quy trạng thái truy cập premium về đúng một nấc FeatureAccess. Thuần để test
 * được — hook useFeatureAccess chỉ nối state vào đây.
 *
 * MẤT SÓNG NGOÀI KHƠI (lý do có nhánh offline): getUser() cần mạng để xác thực,
 * nên offline trả `hasUser=false` DÙ bà con vẫn đăng nhập → premium đã trả tiền
 * bị coi như đăng xuất, MẤT bản đồ cá đã tải sẵn ở bờ đúng lúc cần nhất. Đã từng
 * là premium (dấu lưu trong máy) + đang mất sóng → cho xem tiếp thứ mình đã tải
 * hợp lệ. KHÔNG phải lỗ hổng: chốt thật vẫn ở middleware/RLS khi có mạng, còn
 * offline thì SW chỉ trả đúng những gì đã tải hợp lệ lúc còn premium.
 */
export function featureAccessDecision(i: FeatureAccessInput): FeatureAccess {
  if (!i.configured) return "open";
  // đã từng xác nhận premium (dấu lưu máy) + đang MẤT SÓNG → cho xem bản đã tải,
  // khỏi kẹt "checking" khi auth chưa tra xong.
  if (!i.online && i.cachedPremium) return "open";
  if (!i.authReady) return "checking";
  // auth ĐÃ tra xong mà KHÔNG ra user: nếu vì mất sóng ("sống mà chết" khiến
  // getUser hỏng dù onLine=true) + đã từng premium → vẫn cho xem bản tải sẵn
  // (chốt thật vẫn ở middleware/RLS khi có mạng). Tra ĐƯỢC mà không có ai
  // (đăng xuất thật, không errored) → mời đăng nhập.
  if (!i.hasUser) {
    return i.cachedPremium && (!i.online || i.authErrored) ? "open" : "login";
  }
  if (i.premium == null) return "checking";
  return i.premium ? "open" : "upgrade";
}
