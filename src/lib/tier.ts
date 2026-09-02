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

/** Dấu hạng vừa được máy chủ xác nhận lại — `use-tier` nghe để vẽ lại ngay */
export const TIER_EVENT = "forfish:tier";

/**
 * GHI DẤU HẠNG vừa nghe được từ máy chủ, rồi báo cho màn hình.
 *
 * VÌ SAO NẰM Ở ĐÂY (2026-08-02g): từ bản này, hạng KHÔNG còn nhịp đi hỏi riêng —
 * nó đi nhờ phản hồi của nhịp "đã mở app" (`/api/me/heartbeat`). Chủ dự án chốt:
 * *"token lúc đăng nhập đã biết hạng rồi, check riêng làm gì"* — đúng, thứ duy
 * nhất còn cần máy chủ là **hạng ĐỔI SAU khi đăng nhập** (nhân viên gán premium
 * ở /quan-tri), và nhịp 30 phút đã nói chuyện với máy chủ về đúng tài khoản đó
 * rồi. Nhịp riêng chỉ là một lượt hỏi lại đúng câu vừa hỏi.
 * Nên chỗ GHI phải nằm ở module thuần, để `lib/heartbeat.ts` dùng được mà không
 * kéo theo React.
 *
 * ⚠️ CHỈ GỌI KHI MÁY CHỦ THẬT SỰ TRẢ LỜI. Mất sóng / 5xx / hết giờ thì tuyệt đối
 * không gọi — ghi bừa ở đây là xoá quyền của người đã trả tiền, giữa biển.
 * KHÔNG BAO GIỜ ném (chế độ riêng tư iOS / kho đầy).
 */
/*  ── DẤU HẠNG GIỮ TRONG BỘ NHỚ, localStorage CHỈ LÀ BẢN LƯU ────────────────
    Sửa 2026-09-02. Chủ dự án chỉ ra chỗ mấu chốt: *"lúc cấp premium thì đã có
    acc, có sdt, lúc user đăng nhập vào thì ngay thời điểm đó đã có token và có
    premium rồi thì các TH lỗi làm sao xảy ra đc"* — đúng, và chính câu đó loại
    hết mấy giả thuyết trước (lệch SĐT, chưa deploy, cửa 30 phút), để lộ ra
    đường duy nhất còn lại: **ghi hụt**.

    LỖI: `writePremiumMark` ghi localStorage rồi NUỐT lỗi, kèm chú thích "nhịp
    sau ghi lại". Nhịp sau gặp đúng cái kho đầy đó ⇒ không bao giờ ghi lại
    được. Mà đường ĐỌC (use-tier) chỉ đọc localStorage. Hệ quả trên máy chật —
    chuyện thường trực với app có bản đồ offline + ảnh giấy tờ:

      đăng nhập ĐÚNG (chuỗi cứng ghi được — `saveToken` có đọc lại để xác minh)
      → dấu hạng ghi HỤT, im lặng
      → `cachedMark` = "unknown" MÃI
      → featureAccessDecision = "checking"
      → rail ẩn sạch Đến điểm · Điểm đã lưu · Dẫn đường

    Bà con trả tiền, đăng nhập được, mà không đặt nổi điểm đến — và không một
    thông báo nào. Khớp đúng báo cáo hiện trường *"dùng đủ cách rồi vẫn ko có
    điểm đến"*.

    NAY: dấu vào BIẾN MODULE trước, localStorage sau. Ghi hụt thì phiên đang
    chạy vẫn đúng hạng. Cùng khuôn đã dùng cho sổ đồng bộ hôm 2026-09-01 —
    cùng một lớp lỗi "hai lần ghi, một lần bị nuốt".

    NỢ CÒN LẠI (nói thẳng): tắt app rồi mở lại trên máy vẫn chật thì mất dấu,
    phải chờ nhịp/đăng nhập lại. Bịt hẳn cần dọn chỗ hoặc báo cho bà con biết
    máy đầy — việc khác, không nhét vào đây. */
let markCache: { marked: boolean; until: string | null } | null = null;

/** Dấu hạng thô: ƯU TIÊN bộ nhớ (ghi hụt vẫn đúng), rồi mới tới kho máy. */
export function readTierMarkRaw(): string | null {
  if (markCache) return markCache.marked ? "1" : "0";
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TIER_CACHE_KEY);
  } catch {
    return null;
  }
}

/** Hạn của dấu — cùng luật ưu tiên với `readTierMarkRaw`. */
export function readTierUntilRaw(): string | null {
  if (markCache) return markCache.until;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TIER_UNTIL_KEY);
  } catch {
    return null;
  }
}

/** Quên dấu trong bộ nhớ — gọi kèm mọi đường xoá dấu ở kho (clearTierMark). */
export function forgetTierMarkCache(): void {
  markCache = null;
}

export function writePremiumMark(
  /** ĐÚNG CỘT `tier` THÔ của DB — KHÔNG phải kết quả đã xét hạn (luật E4) */
  marked: boolean,
  until: string | null,
): void {
  if (typeof window === "undefined") return;
  /*  BỘ NHỚ TRƯỚC, KHO SAU — thứ tự này là toàn bộ bản vá: kho ghi hụt thì
      phiên đang chạy vẫn có câu trả lời đúng. */
  markCache = { marked, until };
  try {
    window.localStorage.setItem(TIER_CACHE_KEY, marked ? "1" : "0");
    if (until) window.localStorage.setItem(TIER_UNTIL_KEY, until);
    else window.localStorage.removeItem(TIER_UNTIL_KEY);
  } catch {
    /* hết chỗ / chế độ riêng tư — bộ nhớ đã giữ, phiên này không mất hạng */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(TIER_EVENT, { detail: { marked, until } }),
    );
  } catch {
    /* CustomEvent không có (WebView rất cũ) — màn hình vẽ lại ở lần mở sau */
  }
}

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
 * DẤU CÓ HẠN THẬT KHÔNG (đọc ra được một mốc thời gian). THUẦN để test được.
 *
 * VÌ SAO CÓ (sửa 2026-08-02c): `premiumMarkWithinGrace` cố ý trả `true` khi
 * không có hạn / hạn hỏng — đúng cho nhánh MẤT SÓNG (thà cho xem tiếp bản đã
 * tải còn hơn khoá oan). Nhưng nhánh "quyền đã lưu" lúc CÒN SÓNG (C-7) thì
 * khác: ở đó máy chủ vẫn tới được, chỉ là phiên đã rụng, và cửa mở bằng dấu
 * KHÔNG HẠN thì KHÔNG BAO GIỜ đóng — tài khoản bị hạ hạng/xoá ở `/quan-tri`
 * vẫn giữ cửa "open" cho tới khi bà con cài lại app. Nên nhánh đó đòi hạn thật.
 */
export function premiumMarkHasExpiry(
  until: string | null | undefined,
): boolean {
  if (until == null || until === "") return false;
  const t = Date.parse(until.length === 10 ? `${until}T00:00:00+07:00` : until);
  return Number.isFinite(t);
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

/**
 * Chờ bao lâu trước lần thử thứ `attempt` (0 = lần thử lại đầu tiên).
 *
 * `offline = true` (máy nói thẳng là mất mạng) → NHẢY LUÔN VỀ TRẦN, cùng khuôn
 * với `stormRetryMs` (lib/storms). Vì sao: thang lùi bắt đầu từ 30 giây, mà một
 * chuyến biển dài 10 ngày mất sóng thì cứ leo tới trần 10 phút là ~1.400 lượt
 * tra — mỗi lượt còn dựng thêm một đồng hồ chặn và một lần đánh thức đài. Máy
 * đã báo không có mạng thì hỏi cũng chỉ tốn pin.
 *
 * KHÔNG dừng hẳn nhịp: có máy (WebView đời cũ) không bắn sự kiện `online`, nên
 * vẫn phải còn một nhịp đều đặn để sóng về là thấy quyền của mình.
 */
export function tierRetryDelayMs(attempt: number, offline = false): number {
  if (offline) return TIER_RETRY_MAX_MS;
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(TIER_RETRY_BASE_MS * 2 ** Math.min(n, 20), TIER_RETRY_MAX_MS);
}

/** Sóng vừa về thì hỏi ngay — nhưng không dày hơn bấy nhiêu (chống dội). */
export const TIER_ONLINE_DEBOUNCE_MS = 30_000;

/**
 * Sự kiện `online` vừa bắn — CÓ được tra lại ngay không? THUẦN để test được.
 *
 * VÌ SAO CÓ: `onBackOnline` trước đây gọi thẳng `runQuery()`, bỏ qua mọi độ
 * trễ. Ven bờ / ở rìa vùng phủ sóng, trình duyệt bắn `online`/`offline` liên
 * tục — mỗi cái nhấp là một truy vấn 12 giây kèm một đồng hồ chặn. Thang lùi
 * dựng lên để chống đúng chuyện đó, mà cửa này lại mở toang.
 *
 * `lastTryAtMs <= 0` = chưa hỏi lần nào ⇒ cho hỏi ngay.
 */
export function shouldQueryOnBackOnline(
  lastTryAtMs: number,
  nowMs: number,
): boolean {
  if (!Number.isFinite(lastTryAtMs) || lastTryAtMs <= 0) return true;
  return nowMs - lastTryAtMs >= TIER_ONLINE_DEBOUNCE_MS;
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

/** SỐ THÁNG mặc định 1 lần kích hoạt/gia hạn premium (gói 500k = 1 năm 6 tháng,
 *  ưu đãi +6 tháng từ 2026-08-04; trước đó 12 tháng). KHÔNG hardcode một mốc cứng
 *  nữa: admin chọn gói dựng sẵn (PREMIUM_TERM_PRESETS) hoặc nhập số tháng tuỳ ý
 *  (clampTermMonths) khi cấp. Đây chỉ là giá trị MẶC ĐỊNH khi không truyền.
 *  (Ngoại lệ 300k = 1 năm chỉ áp cho 2 SĐT cũ qua migration 0032 — không có
 *  luồng cấp 300k trong app.) */
export const PREMIUM_TERM_MONTHS = 18;

/** Các gói kỳ hạn dựng sẵn cho admin bấm nhanh khi cấp premium. Thêm/bớt gói ở
 *  đây là đủ — UI /quan-tri render tự động từ mảng này. Ngoài các gói này admin
 *  còn nhập được số tháng tuỳ ý ("Khác"). */
export const PREMIUM_TERM_PRESETS: { months: number; label: string }[] = [
  { months: 12, label: "1 năm" },
  { months: 18, label: "1 năm 6 tháng" },
];

/** Biên số tháng hợp lệ khi nhập tay (chặn 0/âm/quá lớn = gõ nhầm). */
export const PREMIUM_TERM_MIN_MONTHS = 1;
export const PREMIUM_TERM_MAX_MONTHS = 120;

/**
 * Ép số tháng về khoảng hợp lệ + số nguyên. Giá trị lạ (undefined/NaN/chữ) →
 * mặc định PREMIUM_TERM_MONTHS. THUẦN để test được — dùng chung client + server
 * nên không tin được đầu vào từ body request.
 */
export function clampTermMonths(months: unknown): number {
  // null/undefined/"" = "không truyền" → mặc định (Number(null)=0, Number("")=0
  // sẽ lọt xuống min=1 nếu không chặn ở đây)
  if (months == null || months === "") return PREMIUM_TERM_MONTHS;
  const n = typeof months === "number" ? months : Number(months);
  if (!Number.isFinite(n)) return PREMIUM_TERM_MONTHS;
  return Math.min(
    PREMIUM_TERM_MAX_MONTHS,
    Math.max(PREMIUM_TERM_MIN_MONTHS, Math.round(n)),
  );
}

/** Số tháng → nhãn tiếng Việt ("1 năm", "1 năm 6 tháng", "8 tháng"). Ưu tiên
 *  nhãn gói dựng sẵn để chữ khớp nút bấm. */
export function premiumTermLabel(months: number): string {
  const m = clampTermMonths(months);
  const preset = PREMIUM_TERM_PRESETS.find((p) => p.months === m);
  if (preset) return preset.label;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  if (years > 0 && rem > 0) return `${years} năm ${rem} tháng`;
  if (years > 0) return `${years} năm`;
  return `${m} tháng`;
}

/** Cộng `months` THÁNG LỊCH vào mốc ms. Ngày trong tháng giữ nguyên; tháng đích
 *  ngắn hơn (31→cuối tháng) lùi theo nếp Date chuẩn. Tính theo tháng lịch (thay
 *  vì ×30 ngày) để "1 năm 6 tháng" rơi đúng ngày kỷ niệm, số tháng lạ vẫn đúng. */
function addCalendarMonths(baseMs: number, months: number): number {
  const d = new Date(baseMs);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

/**
 * Hạn premium SAU một lần kích hoạt/gia hạn: còn hạn thì CỘNG NỐI vào hạn cũ
 * (gia hạn sớm không bị thiệt ngày), hết hạn/chưa có thì tính từ bây giờ.
 *
 * `months` = kỳ hạn admin chọn (mặc định PREMIUM_TERM_MONTHS). Luôn qua
 * clampTermMonths nên body request bịa số cũng không phá được.
 */
export function nextPremiumUntil(
  currentUntil: string | null | undefined,
  nowMs: number,
  months: number = PREMIUM_TERM_MONTHS,
): string {
  const cur = currentUntil ? Date.parse(currentUntil) : NaN;
  const base = Number.isFinite(cur) && cur > nowMs ? cur : nowMs;
  return new Date(addCalendarMonths(base, clampTermMonths(months))).toISOString();
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
  /** Supabase chưa cấu hình → demo mode mở hết (cùng nếp mọi gate khác) */
  configured: boolean;
  /*  MÁY NÀY ĐÃ GẮN TÀI KHOẢN CHƯA — đọc chuỗi cứng trong máy.
      Đây là CHÌA của cả app: mọi request đi kèm nó, và server thu hồi được nó.
      KHÔNG hỏi phiên Supabase nữa (app đã bỏ phiên từ 2026-08), không hỏi
      `navigator.onLine` (nói dối cả chuyến biển khi tàu có wifi nội bộ). */
  hasToken: boolean;
  /*  DẤU HẠNG ĐÃ XÉT HẠN (`effectivePremiumMark`) — ba trạng thái:
      "premium" · "basic" · "unknown" (chưa bao giờ biết). */
  mark: PremiumMark;
}

/**
 * MỞ HAY KHOÁ TÍNH NĂNG PREMIUM — luật MECE, đúng NĂM nhánh loại trừ nhau.
 *
 * ── VÌ SAO VIẾT LẠI (chủ dự án 2026-09-02) ────────────────────────────────
 * *"làm cái logic gì đơn giản, mece đảm bảo họ đã là premium nó luôn chạy, đã
 * lưu rồi, đừng có đăng nhập tới lui nếu đã có premium trong máy rồi trừ khi
 * họ đổi máy thôi"*.
 *
 * Bản cũ nhận CHÍN đầu vào (authReady · hasUser · online · authErrored ·
 * hasOfflineIdentity · premium · premiumExpiredOnly · premiumMarkUntil ·
 * cachedMark) = 288 tổ hợp, và chính nó đẻ ra chuỗi ngõ cụt phải vá suốt
 * tháng 8: kẹt "checking" khi mở app nguội; rơi "login" khi phiên rụng lúc bắt
 * wifi ở cảng; mất quyền giữa biển vì `getUser()` trả null. Mỗi lần vá là thêm
 * một nhánh, thêm một tổ hợp chưa ai soi.
 *
 * Gốc của mớ đó: app hỏi SAI CÂU. Nó hỏi "phiên Supabase còn không, mạng còn
 * không, đã kiểm xong chưa" — trong khi app đã BỎ phiên Supabase từ 2026-08 và
 * chạy bằng chuỗi cứng. Chìa thật nằm trong máy, hỏi vòng qua ba thứ hay nói
 * dối ngoài biển là tự chuốc lấy ngõ cụt.
 *
 * ── LUẬT MỚI ──────────────────────────────────────────────────────────────
 *   1. Chưa cấu hình Supabase        → "open"   (demo mode)
 *   2. Máy chưa gắn tài khoản        → "login"
 *   3. Có chìa + dấu "premium"       → "open"
 *   4. Có chìa + dấu "basic"         → "upgrade"
 *   5. Có chìa + dấu "unknown"       → "checking"  (và đi hỏi NGAY, xem
 *                                      `heartbeatNeedsScan`)
 *
 * MECE: mỗi trạng thái rơi vào ĐÚNG MỘT nhánh, năm nhánh phủ hết.
 *
 * ── BỐN BẢO ĐẢM, VÀ VÌ SAO KHÔNG MẤT AN TOÀN ──────────────────────────────
 * · **Đã premium là luôn chạy**: mất sóng, phiên rụng, mở app nguội, hết pin
 *   rồi mở lại — không ca nào hỏi tới mạng nữa. Đúng yêu cầu "đã lưu rồi thì
 *   đừng bắt đăng nhập tới lui".
 * · **Đổi máy thì mất**: máy mới không có chuỗi ⇒ nhánh 2 ⇒ đăng nhập. Đúng
 *   ranh giới chủ dự án đặt ("trừ khi họ đổi máy").
 * · **Đăng xuất / gỡ máy không hở**: cả hai xoá CHUỖI lẫn DẤU ⇒ nhánh 2.
 *   Người sau cầm máy không thừa hưởng quyền của người trước.
 * · **Hạ hạng vẫn đóng được**: dấu KHÔNG phải phỏng đoán — nó do máy chủ ghi
 *   (đăng nhập + mỗi nhịp). Hạ hạng ở /quan-tri ⇒ nhịp sau ghi "basic" ⇒ nhánh
 *   4. Hết hạn ⇒ `effectivePremiumMark` đã hạ dấu trước khi tới đây (biên 7
 *   ngày cho đồng hồ máy lệch, luật E4). Và chốt cuối vẫn là server: chuỗi bị
 *   thu hồi ⇒ mọi cửa trả 401 ⇒ `signOutLocal`.
 *
 * Cái MẤT so với bản cũ: khi máy chủ VỪA nói "basic" mà dấu trong máy còn ghi
 * "premium", bản cũ có một nhánh riêng cân đo hai nguồn. Nay không cần — câu
 * trả lời tươi ĐI THẲNG VÀO DẤU (`writePremiumMark`), nên chỉ còn MỘT nguồn sự
 * thật. Ít nguồn hơn thì hết chỗ cho hai nguồn cãi nhau.
 */
export function featureAccessDecision(i: FeatureAccessInput): FeatureAccess {
  if (!i.configured) return "open";
  if (!i.hasToken) return "login";
  if (i.mark === "premium") return "open";
  if (i.mark === "basic") return "upgrade";
  return "checking";
}
