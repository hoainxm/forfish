// Phân hạng tài khoản (logic THUẦN — dùng chung client/middleware/route).
// 'basic' (mặc định) | 'premium'. Premium mở: dự báo cá + thời tiết quá 3 ngày.
// Hạng nằm ở customers.tier + customers.premium_until (migration 0003) — nguồn
// gán: webhook SDWork hoặc web quản trị /quan-tri. App KHÔNG có luồng
// thanh toán.

export type AccountTier = "basic" | "premium";

/* ── DẤU HẠNG LƯU TRONG MÁY ────────────────────────────────────────────────
   Khoá đặt ở đây (chứ không ở use-tier.ts) để module THUẦN — offline-identity —
   dùng được mà không phải kéo theo React/Supabase. use-tier.ts xuất lại hai
   hằng này nên chỗ gọi cũ không phải đổi. */

/** Dấu "phiên gần nhất là premium" — quy ước key forfish.* */
export const TIER_CACHE_KEY = "forfish.tier.premium.v1";
/*  Hạn premium lần tra gần nhất — để sheet Tài khoản vẫn nói được "dùng tới
    ngày nào" khi đang mất sóng. Cùng tiền tố `forfish.tier.` nên KHÔNG bị gom
    vào tệp sao lưu (lib/offline-backup.ts SKIP_PREFIXES) — hạn là entitlement,
    không phải dữ liệu dự báo, chia tệp không được kéo theo. */
export const TIER_UNTIL_KEY = "forfish.tier.until.v1";

/**
 * BA trạng thái của dấu hạng — KHÔNG phải hai (sửa 2026-08-02, E5).
 *
 * VÌ SAO: bản cũ đọc dấu ra `boolean`, nên "đã tra được, đúng là hạng thường"
 * và "CHƯA BAO GIỜ tra được" cùng ra `false`. Mất sóng mà chưa từng tra được
 * thì app KHẲNG ĐỊNH "Tài khoản thường · Gọi SDVICO để mở dự báo cá" — nói với
 * người vừa trả tiền rằng họ chưa trả tiền. Trái luật đã ghi ngay dưới đây
 * (tierBadge): thà không nói gì còn hơn nháy nhầm.
 */
export type PremiumMark = "premium" | "basic" | "unknown";

/**
 * Giá trị thô trong localStorage → dấu hạng. THUẦN để test được.
 *
 * Khoá không tồn tại (`null`), giá trị lạ, hoặc localStorage ném (chỗ gọi bắt
 * lỗi rồi truyền `null` vào đây) đều là `"unknown"` — KHÔNG phải `"basic"`.
 */
export function readPremiumMark(
  raw: string | null | undefined,
): PremiumMark {
  if (raw === "1") return "premium";
  if (raw === "0") return "basic";
  return "unknown";
}

/**
 * CÓ ĐƯỢC XOÁ DẤU PREMIUM KHÔNG — THUẦN để test được (2026-08-02, C-8).
 *
 * Trước đây điều kiện xoá có `navigator.onLine`, và đó là thứ DUY NHẤT chặn.
 * Chính repo đã tuyên bố `onLine` không đáng tin (auth-error.ts): tàu có router
 * wifi nội bộ, hay Android báo "đã kết nối 4G" mà gói tin không ra được — cả
 * chuyến biển `onLine === true`. Tệ hơn: khi auth-js đã tự xoá phiên (C-7) thì
 * lần mở app kế `getUser()` trả `AuthSessionMissingError` (400 — KHÔNG phải lỗi
 * mạng) nên `authErrored` = false, và bốn vế của điều kiện cũ thoả hết ⇒ dấu
 * premium bị xoá giữa biển. Nay `onLine` BỊ BỎ HẲN khỏi điều kiện.
 *
 * Chỉ còn MỘT ca được xoá: phiên đã kiểm xong, kiểm KHÔNG lỗi, không có user,
 * VÀ máy cũng không còn nhớ ai từng đăng nhập ở đây (đã bấm Đăng xuất thật).
 */
export function shouldClearPremiumMark(a: {
  /** useAuthUser().ready — đã kiểm xong phiên chưa */
  authReady: boolean;
  /** getUser() reject/timeout — không chắc là đăng xuất thật */
  authErrored: boolean;
  hasUser: boolean;
  /** máy còn nhớ SĐT lần đăng nhập gần nhất không (lib/offline-identity) */
  hasOfflineIdentity: boolean;
}): boolean {
  return a.authReady && !a.authErrored && !a.hasUser && !a.hasOfflineIdentity;
}

/* ── HẠN SỐNG CỦA DẤU PREMIUM ──────────────────────────────────────────────
   Dấu trong máy phải MANG THEO HẠN (sửa 2026-08-02, hồi quy E4).

   VÌ SAO: đường ghi dấu chỉ nhìn cột `tier` THÔ của DB (cố ý — đồng hồ máy lệch
   thì không được lấy đó làm cớ xoá quyền đã trả tiền). Nhưng nếu KHI ĐỌC cũng
   không xét hạn thì khách hết hạn mà DB còn `tier='premium'` sẽ ra "upgrade"
   lúc có sóng (đúng) mà lại "open" VĨNH VIỄN lúc mất sóng — premium offline
   không bao giờ hết.

   BIÊN RỘNG chứ không cắt đúng ngày: đồng hồ điện thoại ngoài biển hay lệch
   (máy hết pin sạch, không có sóng để đồng bộ giờ). Cắt đúng ngày thì một cái
   đồng hồ chạy nhanh cũng đủ khoá người đang còn hạn. Biên 7 ngày mở thêm rất
   ít mà đỡ được đúng ca đó — nhớ luật dự án: premium gác cửa TẢI, không gác cửa
   XEM, còn dữ liệu đã tải thì tự hết giá trị sau ≤16 ngày. */

/** Quá hạn bấy nhiêu ngày mới coi là hết (đệm cho đồng hồ máy lệch). */
export const TIER_MARK_GRACE_DAYS = 7;

/**
 * Hạn của dấu premium còn dùng được không (đã cộng biên). THUẦN để test được.
 *
 * Không có hạn / hạn hỏng → `true`: dấu chỉ bật khi đã tra ĐƯỢC lúc còn sóng,
 * nên "không biết hạn" phải là "cứ cho xem tiếp bản đã tải", không phải cớ để
 * khoá. Chốt thật vẫn ở middleware/RLS khi có mạng.
 */
export function premiumMarkWithinGrace(
  until: string | null | undefined,
  nowMs: number,
): boolean {
  if (until == null || until === "") return true;
  const t = Date.parse(until.length === 10 ? `${until}T00:00:00+07:00` : until);
  if (!Number.isFinite(t)) return true;
  return nowMs <= t + TIER_MARK_GRACE_DAYS * 24 * 3600 * 1000;
}

/**
 * Dấu đã lưu + hạn đã lưu → dấu CÒN HIỆU LỰC để quyết định.
 *
 * Hết hạn (quá biên) thì thành `"basic"` chứ không phải `"unknown"`: mình BIẾT
 * hạng đã lapse, nói thật "Tài khoản thường · gọi SDVICO" mới là câu bà con làm
 * được gì đó với nó.
 */
export function effectivePremiumMark(
  mark: PremiumMark,
  until: string | null | undefined,
  nowMs: number,
): PremiumMark {
  if (mark !== "premium") return mark;
  return premiumMarkWithinGrace(until, nowMs) ? "premium" : "basic";
}

/* ── THỬ LẠI KHI TRA HẠNG CHƯA RA ──────────────────────────────────────────
   VÌ SAO CÓ (sửa 2026-08-02, hồi quy do chính bản vá 2026-08-02 gây ra):
   tổ hợp "đã kiểm xong phiên + có user + chưa tra được hạng + dấu chưa từng có"
   cho ra "checking", và trước đây đường tự thoát DUY NHẤT là effect tra hạng
   chạy lại mỗi lần auth-js bắn TOKEN_REFRESHED (object user mới). Bản vá đổi
   deps sang `user.id` để hết nháy — đúng ý đồ, nhưng CẮT LUÔN đường thoát đó.
   Bà con vừa được gán premium, mở app lần đầu ở cảng sóng "sống mà chết", truy
   vấn hết 12 giây ⇒ kẹt "đang kiểm tra" tới lúc tắt hẳn app: lớp cá im lặng,
   không khoá, không mời nâng cấp, không cả nút thử lại. Nay có đồng hồ thử lại
   (và sóng vừa về là thử ngay) — chống nháy vẫn giữ, nhưng KHÔNG được kẹt. */

/** Lần thử lại đầu cách 30 giây… */
export const TIER_RETRY_BASE_MS = 30_000;
/** …nhân đôi dần, trần 10 phút (đừng quay pin của bà con giữa biển). */
export const TIER_RETRY_MAX_MS = 600_000;

/** Chờ bao lâu trước lần thử thứ `attempt` (0 = lần thử lại đầu tiên). */
export function tierRetryDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(TIER_RETRY_BASE_MS * 2 ** Math.min(n, 20), TIER_RETRY_MAX_MS);
}

/**
 * CÒN PHẢI HỎI LẠI HẠNG KHÔNG — luật hẹn giờ của use-tier. THUẦN để test được.
 *
 * Đã biết là ai mà CHƯA có câu trả lời TƯƠI từ máy chủ trong phiên này thì còn
 * phải hỏi lại — kể cả khi dấu cũ trong máy đã đủ trả lời tạm (bà con vừa được
 * gán premium ở cảng cũng cần lần hỏi sau mới thấy quyền của mình). Mọi trạng
 * thái `featureAccessDecision` trả "checking" khi đã có user đều nằm trong đây,
 * nên "kẹt vĩnh viễn" là không thể — test khoá lại quan hệ đó.
 */
export function shouldRetryTierQuery(a: {
  authReady: boolean;
  hasUser: boolean;
  /** đã tra ĐƯỢC hạng từ máy chủ trong phiên này chưa (không tính dấu đã lưu) */
  answered: boolean;
}): boolean {
  return a.authReady && a.hasUser && !a.answered;
}

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
  /** dấu hạng đã lưu trong máy — BA trạng thái, "unknown" = chưa bao giờ tra
      được, khác hẳn "basic" = đã tra được và đúng là hạng thường */
  cachedMark: PremiumMark;
  /** getUser() reject/timeout (mất sóng "sống mà chết" — onLine có thể lỡ=true).
      KHÁC hasUser=false do tra ĐƯỢC mà không có ai (đăng xuất thật). */
  authErrored?: boolean;
  /** `premium === false` CHỈ VÌ HẠN: máy chủ vẫn ghi tier='premium', chỉ có
      đồng hồ MÁY nói là quá hạn. Khác hẳn tier='basic' (chưa từng trả tiền). */
  premiumExpiredOnly?: boolean;
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
  // 1) CÓ CÂU TRẢ LỜI TƯƠI (vừa tra được hạng của user đang đăng nhập) → dùng
  //    luôn. Đặt trước mọi nhánh offline để một cú getUser() hết giờ lúc mở app
  //    không kéo lùi kết quả đã tra xong về "checking".
  if (i.authReady && i.hasUser && i.premium != null) {
    if (i.premium) return "open";
    // HẠ HẠNG CHỈ VÌ HẠN, mà dấu trong máy vẫn còn premium (tức hạn mới quá
    // trong biên 7 ngày) → cho xem tiếp (sửa 2026-08-02, E4). Vì sao: `premium`
    // được tính bằng ĐỒNG HỒ MÁY; máy hết pin sạch rồi mất đồng bộ giờ là nhảy
    // vài ngày như chơi, và lúc đó máy chủ vẫn coi bà con là premium nên gọi
    // tổng đài cũng không ai giải thích được. Quá biên thì `cachedMark` đã tự
    // thành "basic" (effectivePremiumMark) nên nhánh này tắt — hết hạn thật vẫn
    // ra lời mời gia hạn.
    if (i.premiumExpiredOnly === true && i.cachedMark === "premium") {
      return "open";
    }
    return "upgrade";
  }
  // 2) KHÔNG HỎI ĐƯỢC MÁY CHỦ: mất sóng thật, hoặc sóng "sống mà chết" làm
  //    getUser() hỏng (onLine lỡ = true). Cả hai đều KHÔNG phải đăng xuất, nên
  //    chỉ còn dấu đã lưu để trả lời.
  if (!i.online || i.authErrored === true) {
    // đã từng xác nhận premium → cho xem tiếp bản đã tải hợp lệ ở bờ. KHÔNG
    // phải cửa sau: chốt thật vẫn ở middleware/RLS khi có mạng, còn offline thì
    // SW chỉ trả đúng những gì đã tải lúc còn premium.
    if (i.cachedMark === "premium") return "open";
    // CHƯA BAO GIỜ tra được hạng → IM LẶNG (E5). Thà không nói gì còn hơn
    // khẳng định "Tài khoản thường" với người vừa trả tiền mà máy chưa kịp tra.
    // Ngoại lệ: đã kiểm xong phiên và rõ ràng KHÔNG có ai đăng nhập (máy mới
    // tinh, hoặc vừa đăng xuất) — lúc đó im lặng thành vòng quay vô nghĩa, mời
    // đăng nhập mới là việc làm được.
    if (i.cachedMark === "unknown") {
      return i.authReady && !i.hasUser ? "login" : "checking";
    }
    // "basic": đã tra ĐƯỢC lúc còn sóng, đúng là hạng thường → nói thật.
    if (!i.authReady) return "checking";
    return i.hasUser ? "upgrade" : "login";
  }
  if (!i.authReady) return "checking";
  // có sóng, tra ĐƯỢC mà không có ai → đăng xuất thật → mời đăng nhập
  if (!i.hasUser) return "login";
  // có user, đang tra hạng → chưa kết luận (tránh nháy khoá↔mở)
  return "checking";
}
