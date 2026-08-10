import { describe, expect, it } from "vitest";
import {
  effectivePremiumMark,
  featureAccessDecision,
  formatPremiumUntil,
  FREE_FORECAST_DAYS,
  clampTermMonths,
  nextPremiumUntil,
  premiumMarkHasExpiry,
  premiumMarkWithinGrace,
  premiumTermLabel,
  PREMIUM_TERM_MAX_MONTHS,
  PREMIUM_TERM_MIN_MONTHS,
  PREMIUM_TERM_MONTHS,
  resolveTier,
  shouldQueryOnBackOnline,
  shouldRetryTierQuery,
  tierBadge,
  TIER_MARK_GRACE_DAYS,
  TIER_ONLINE_DEBOUNCE_MS,
  TIER_RETRY_BASE_MS,
  TIER_RETRY_MAX_MS,
  tierRetryDelayMs,
  type FeatureAccess,
  type FeatureAccessInput,
  type PremiumMark,
} from "@/lib/tier";

// Hạng hiệu lực = tier + hạn. Nguyên tắc: mọi ca mờ ám → 'basic' (fail-closed).
const NOW = Date.parse("2026-07-26T12:00:00+07:00");

describe("resolveTier", () => {
  it("premium không hạn (premium_until null/rỗng) → premium", () => {
    expect(resolveTier("premium", null, NOW)).toBe("premium");
    expect(resolveTier("premium", undefined, NOW)).toBe("premium");
    expect(resolveTier("premium", "", NOW)).toBe("premium");
  });

  it("premium còn hạn → premium; hết hạn → basic", () => {
    expect(resolveTier("premium", "2026-12-31T00:00:00Z", NOW)).toBe("premium");
    expect(resolveTier("premium", "2026-01-01T00:00:00Z", NOW)).toBe("basic");
  });

  it("đúng mốc hết hạn vẫn còn premium (>= now)", () => {
    expect(resolveTier("premium", new Date(NOW).toISOString(), NOW)).toBe(
      "premium",
    );
  });

  it("tier lạ / null / basic → basic, kể cả có premium_until", () => {
    expect(resolveTier("basic", null, NOW)).toBe("basic");
    expect(resolveTier(null, "2099-01-01", NOW)).toBe("basic");
    expect(resolveTier(undefined, null, NOW)).toBe("basic");
    expect(resolveTier("vip", "2099-01-01", NOW)).toBe("basic");
    expect(resolveTier("PREMIUM", null, NOW)).toBe("basic"); // phân biệt hoa-thường
  });

  it("premium_until hỏng (không parse được) → basic (fail-closed)", () => {
    expect(resolveTier("premium", "không-phải-ngày", NOW)).toBe("basic");
  });

  it("thời tiết miễn phí đúng 3 ngày", () => {
    expect(FREE_FORECAST_DAYS).toBe(3);
  });
});

// Kỳ hạn tính theo THÁNG LỊCH (khớp addCalendarMonths trong lib/tier: cộng
// tháng qua setUTCMonth). Helper dựng lại đúng phép cộng đó để so.
function addMonthsUTC(ms: number, months: number): number {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}
const until = (
  cur: string | null | undefined,
  now: number,
  months?: number,
) => Date.parse(nextPremiumUntil(cur, now, months));

describe("nextPremiumUntil — kỳ hạn theo tháng lịch, mặc định 1 năm 6 tháng", () => {
  it("chưa có hạn / null → +mặc định (18 tháng) từ bây giờ", () => {
    expect(until(null, NOW)).toBe(addMonthsUTC(NOW, PREMIUM_TERM_MONTHS));
    expect(until(undefined, NOW)).toBe(addMonthsUTC(NOW, PREMIUM_TERM_MONTHS));
  });

  it("ĐÃ hết hạn → +18 tháng từ bây giờ (không cộng vào quá khứ)", () => {
    const past = new Date(NOW - 30 * 24 * 3600 * 1000).toISOString();
    expect(until(past, NOW)).toBe(addMonthsUTC(NOW, PREMIUM_TERM_MONTHS));
  });

  it("CÒN hạn → cộng nối vào hạn cũ (gia hạn sớm không thiệt ngày)", () => {
    const future = NOW + 100 * 24 * 3600 * 1000;
    expect(until(new Date(future).toISOString(), NOW)).toBe(
      addMonthsUTC(future, PREMIUM_TERM_MONTHS),
    );
  });

  it("hạn hỏng (không parse được) → coi như chưa có, +18 tháng từ bây giờ", () => {
    expect(until("không-phải-ngày", NOW)).toBe(
      addMonthsUTC(NOW, PREMIUM_TERM_MONTHS),
    );
  });

  it("kỳ hạn tuỳ chọn: 12 tháng = +1 năm lịch (fix lỗi chỉ có 1 mốc 18 tháng)", () => {
    expect(until(null, NOW, 12)).toBe(addMonthsUTC(NOW, 12));
    expect(until(null, NOW, 18)).toBe(addMonthsUTC(NOW, 18));
    expect(until(null, NOW, 12)).not.toBe(until(null, NOW, 18));
  });

  it("số tháng lạ từ body request → clamp (không phá được hạn)", () => {
    // NaN/chữ → mặc định; 0/âm → tối thiểu; quá lớn → tối đa
    expect(until(null, NOW, Number.NaN)).toBe(
      addMonthsUTC(NOW, PREMIUM_TERM_MONTHS),
    );
    expect(until(null, NOW, 0)).toBe(
      addMonthsUTC(NOW, PREMIUM_TERM_MIN_MONTHS),
    );
    expect(until(null, NOW, 9999)).toBe(
      addMonthsUTC(NOW, PREMIUM_TERM_MAX_MONTHS),
    );
  });
});

describe("clampTermMonths — chặn số tháng lạ", () => {
  it("số hợp lệ giữ nguyên (làm tròn)", () => {
    expect(clampTermMonths(12)).toBe(12);
    expect(clampTermMonths(18)).toBe(18);
    expect(clampTermMonths(7.6)).toBe(8);
    expect(clampTermMonths("24")).toBe(24);
  });
  it("dưới min → min, trên max → max", () => {
    expect(clampTermMonths(0)).toBe(PREMIUM_TERM_MIN_MONTHS);
    expect(clampTermMonths(-5)).toBe(PREMIUM_TERM_MIN_MONTHS);
    expect(clampTermMonths(9999)).toBe(PREMIUM_TERM_MAX_MONTHS);
  });
  it("không phải số → mặc định", () => {
    expect(clampTermMonths(Number.NaN)).toBe(PREMIUM_TERM_MONTHS);
    expect(clampTermMonths("abc")).toBe(PREMIUM_TERM_MONTHS);
    expect(clampTermMonths(undefined)).toBe(PREMIUM_TERM_MONTHS);
    expect(clampTermMonths(null)).toBe(PREMIUM_TERM_MONTHS);
  });
});

describe("premiumTermLabel — nhãn tiếng Việt", () => {
  it("khớp nhãn gói dựng sẵn", () => {
    expect(premiumTermLabel(12)).toBe("1 năm");
    expect(premiumTermLabel(18)).toBe("1 năm 6 tháng");
  });
  it("số tháng ngoài gói → năm/tháng suy ra", () => {
    expect(premiumTermLabel(6)).toBe("6 tháng");
    expect(premiumTermLabel(24)).toBe("2 năm");
    expect(premiumTermLabel(20)).toBe("1 năm 8 tháng");
  });
});

describe("featureAccessDecision — cổng UI, có đường lùi offline cho premium", () => {
  // mặc định: đã cấu hình, đang có sóng, kiểm xong, đã đăng nhập, chưa tra hạng
  const base: FeatureAccessInput = {
    configured: true,
    authReady: true,
    hasUser: true,
    premium: null,
    online: true,
    cachedMark: "basic",
  };

  it("demo mode (chưa cấu hình Supabase) → open, bất kể mọi thứ khác", () => {
    expect(
      featureAccessDecision({ ...base, configured: false, hasUser: false }),
    ).toBe("open");
  });

  it("đang có sóng: chưa kiểm xong → checking; chưa đăng nhập → login", () => {
    expect(featureAccessDecision({ ...base, authReady: false })).toBe("checking");
    expect(featureAccessDecision({ ...base, hasUser: false })).toBe("login");
  });

  it("đang có sóng, đã đăng nhập: tra xong premium → open; basic → upgrade", () => {
    expect(featureAccessDecision({ ...base, premium: true })).toBe("open");
    expect(featureAccessDecision({ ...base, premium: false })).toBe("upgrade");
    // chưa tra xong hạng → checking (tránh nháy khoá↔mở)
    expect(featureAccessDecision({ ...base, premium: null })).toBe("checking");
  });

  it("MẤT SÓNG + từng là premium → open (xem tiếp bản đồ cá đã tải sẵn ở bờ)", () => {
    // getUser() offline trả hasUser=false, nhưng dấu premium đã lưu vẫn mở
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        hasUser: false,
        premium: null,
        cachedMark: "premium",
      }),
    ).toBe("open");
  });

  it("MẤT SÓNG + KHÔNG có dấu premium → theo nhánh thường (không rò quyền)", () => {
    // offline, chưa từng premium, getUser trả null → login (không mở bừa)
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        hasUser: false,
        cachedMark: "basic",
      }),
    ).toBe("login");
  });

  it("nhánh offline-premium ưu tiên hơn cả 'chưa kiểm xong'", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        authReady: false,
        cachedMark: "premium",
      }),
    ).toBe("open");
  });

  // MẤT SÓNG "SỐNG MÀ CHẾT": navigator.onLine lỡ = true nhưng getUser() hỏng
  // (authErrored) → premium đã tải vẫn xem được, KHÔNG bắt đăng nhập lại; đây
  // là gốc lỗi "lớp cá quay hoài không ra" (2026-07-29).
  it("onLine=true nhưng auth HỎNG + từng premium → open (không kẹt, không bắt login)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: true,
        cachedMark: "premium",
      }),
    ).toBe("open");
  });

  /* HAI CA GIỐNG HỆT NHAU TRÊN DÂY, KHÁC NHAU Ở ĐỜI THẬT (tách 2026-08-02, C-7).
     Cả hai đều: có sóng · auth tra được · không có user · dấu premium còn.
     Phân biệt bằng SỔ DANH TÍNH — máy còn nhớ ai từng đăng nhập ở đây không. */
  it("ĐĂNG XUẤT THẬT (máy đã quên người cũ) + từng premium → login (không rò quyền)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: false,
        cachedMark: "premium",
        hasOfflineIdentity: false,
      }),
    ).toBe("login");
  });

  it("MÁY TỰ QUÊN PHIÊN (C-7) + máy CÒN nhớ người + dấu premium CÓ HẠN → open", () => {
    // auth-js `_removeSession()` khi làm mới token gặp lỗi KHÔNG phải mạng
    // (400/401/500, thân HTML của cổng wifi ở cảng) ⇒ authErrored=false; tàu có
    // router wifi nội bộ ⇒ online=true. Không có vế danh tính thì người đã trả
    // tiền tới 2027 rơi xuống "Đăng nhập" và mất quyền CẢ CHUYẾN BIỂN.
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: false,
        cachedMark: "premium",
        hasOfflineIdentity: true,
        premiumMarkUntil: "2027-08-01T00:00:00Z",
      }),
    ).toBe("open");
  });

  /* HỒI QUY 2026-08-02c: `premiumMarkWithinGrace(null) === true`, nên dấu
     KHÔNG HẠN mở nhánh này VĨNH VIỄN — mà ở ca này `hasUser=false` cũng chặn
     luôn đường tra lại (effect tra hạng có dep `userId`). Tài khoản bị hạ hạng
     hay xoá ở `/quan-tri` vẫn giữ cửa "open" tới khi cài lại app. */
  it("còn nhớ người + dấu premium NHƯNG KHÔNG CÓ HẠN → login (cửa phải đóng được)", () => {
    for (const premiumMarkUntil of [null, undefined, "", "không-phải-ngày"]) {
      expect(
        featureAccessDecision({
          ...base,
          online: true,
          hasUser: false,
          authErrored: false,
          cachedMark: "premium",
          hasOfflineIdentity: true,
          premiumMarkUntil,
        }),
      ).toBe("login");
    }
  });

  it("MẤT SÓNG thì dấu không hạn VẪN dùng được (đừng khoá oan giữa biển)", () => {
    // nhánh offline khác hẳn: ở đó không hỏi được ai, thà cho xem tiếp bản đã
    // tải. Chỉ nhánh CÒN SÓNG mới đòi hạn thật.
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        hasUser: false,
        cachedMark: "premium",
        hasOfflineIdentity: true,
        premiumMarkUntil: null,
      }),
    ).toBe("open");
  });

  it("còn nhớ người NHƯNG dấu là basic/unknown → vẫn login, KHÔNG mở bừa", () => {
    for (const cachedMark of ["basic", "unknown"] as const) {
      expect(
        featureAccessDecision({
          ...base,
          online: true,
          hasUser: false,
          authErrored: false,
          cachedMark,
          hasOfflineIdentity: true,
          premiumMarkUntil: "2027-08-01T00:00:00Z",
        }),
      ).toBe("login");
    }
  });

  it("KHÔNG khai `hasOfflineIdentity` → fail-closed như cũ (mặc định là login)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: false,
        cachedMark: "premium",
      }),
    ).toBe("login");
  });

  it("nhánh quyền-đã-lưu KHÔNG đụng ca đang có user (không nháy khoá↔mở)", () => {
    // đã đăng nhập + đang tra hạng: vẫn im lặng chờ câu trả lời tươi, dù dấu
    // trong máy là premium — mở rồi đóng lại còn khó hiểu hơn
    expect(
      featureAccessDecision({
        ...base,
        hasUser: true,
        premium: null,
        cachedMark: "premium",
        hasOfflineIdentity: true,
      }),
    ).toBe("checking");
  });

  it("auth HỎNG nhưng CHƯA từng premium → login (không mở bừa)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: true,
        cachedMark: "basic",
      }),
    ).toBe("login");
  });
});

describe("dấu premium PHẢI mang theo hạn (E4 — premium offline không vĩnh viễn)", () => {
  const DAY = 24 * 3600 * 1000;

  it("không hạn / hạn hỏng → dấu vẫn dùng được (không lấy cớ đó khoá)", () => {
    expect(premiumMarkWithinGrace(null, NOW)).toBe(true);
    expect(premiumMarkWithinGrace(undefined, NOW)).toBe(true);
    expect(premiumMarkWithinGrace("", NOW)).toBe(true);
    expect(premiumMarkWithinGrace("không-phải-ngày", NOW)).toBe(true);
  });

  /* …CHÍNH VÌ THẾ nhánh "quyền đã lưu" lúc CÒN SÓNG phải hỏi thêm câu khác:
     dấu này có hạn ĐỌC ĐƯỢC không? Không thì nó không bao giờ hết. */
  it("premiumMarkHasExpiry: chỉ mốc thời gian ĐỌC ĐƯỢC mới tính là có hạn", () => {
    expect(premiumMarkHasExpiry("2027-08-01T00:00:00Z")).toBe(true);
    expect(premiumMarkHasExpiry("2027-08-01")).toBe(true); // dạng ngày trần
    expect(premiumMarkHasExpiry(null)).toBe(false);
    expect(premiumMarkHasExpiry(undefined)).toBe(false);
    expect(premiumMarkHasExpiry("")).toBe(false);
    expect(premiumMarkHasExpiry("không-phải-ngày")).toBe(false);
  });

  it("còn hạn → dùng được; quá hạn TRONG biên → vẫn dùng được", () => {
    const until = new Date(NOW + 10 * DAY).toISOString();
    expect(premiumMarkWithinGrace(until, NOW)).toBe(true);
    const justPast = new Date(NOW - (TIER_MARK_GRACE_DAYS - 1) * DAY).toISOString();
    expect(premiumMarkWithinGrace(justPast, NOW)).toBe(true);
  });

  it("quá hạn QUÁ biên → hết, dù DB còn ghi tier='premium'", () => {
    const longPast = new Date(NOW - (TIER_MARK_GRACE_DAYS + 1) * DAY).toISOString();
    expect(premiumMarkWithinGrace(longPast, NOW)).toBe(false);
    expect(effectivePremiumMark("premium", longPast, NOW)).toBe("basic");
  });

  it("biên rộng vài ngày — đồng hồ máy ngoài biển hay lệch", () => {
    expect(TIER_MARK_GRACE_DAYS).toBeGreaterThanOrEqual(3);
    // nhưng KHÔNG được rộng hơn tuổi thọ dữ liệu đã tải (≤16 ngày)
    expect(TIER_MARK_GRACE_DAYS).toBeLessThanOrEqual(16);
  });

  it("dấu 'basic'/'unknown' không bị hạn đụng vào", () => {
    const longPast = new Date(NOW - 999 * DAY).toISOString();
    expect(effectivePremiumMark("basic", longPast, NOW)).toBe("basic");
    expect(effectivePremiumMark("unknown", longPast, NOW)).toBe("unknown");
    expect(effectivePremiumMark("unknown", null, NOW)).toBe("unknown");
  });

  it("MẤT SÓNG + dấu premium ĐÃ HẾT HẠN quá biên → KHÔNG còn open", () => {
    // đây là ca hồi quy: dấu ghi theo cột `tier` thô, không xét hạn ⇒ khách hết
    // hạn vẫn "open" offline mọi phiên, không bao giờ hết
    const longPast = new Date(NOW - 60 * DAY).toISOString();
    const mark = effectivePremiumMark("premium", longPast, NOW);
    expect(
      featureAccessDecision({
        configured: true,
        authReady: true,
        hasUser: true,
        premium: null,
        online: false,
        cachedMark: mark,
      }),
    ).not.toBe("open");
  });
});

describe("hạ hạng CHỈ VÌ hạn — đừng tin đồng hồ máy hơn dấu đã lưu", () => {
  const base: FeatureAccessInput = {
    configured: true,
    authReady: true,
    hasUser: true,
    premium: false,
    online: true,
    cachedMark: "premium",
  };

  it("máy lệch giờ (premium===false chỉ vì hạn) + dấu còn premium → open", () => {
    expect(featureAccessDecision({ ...base, premiumExpiredOnly: true })).toBe(
      "open",
    );
  });

  it("hạng thường THẬT (tier='basic') → vẫn upgrade, không có cửa sau", () => {
    expect(
      featureAccessDecision({ ...base, premiumExpiredOnly: false }),
    ).toBe("upgrade");
    // không khai báo gì cũng phải là upgrade (mặc định fail-closed)
    expect(featureAccessDecision(base)).toBe("upgrade");
  });

  it("hết hạn THẬT (quá biên nên dấu đã thành 'basic') → upgrade, mời gia hạn", () => {
    expect(
      featureAccessDecision({
        ...base,
        premiumExpiredOnly: true,
        cachedMark: "basic",
      }),
    ).toBe("upgrade");
  });
});

describe("KHÔNG ĐƯỢC KẸT 'đang kiểm tra' VĨNH VIỄN (hồi quy 2026-08-02)", () => {
  it("ca báo lỗi: có user, chưa tra được hạng, chưa từng có dấu → còn phải hỏi lại", () => {
    const stuck: FeatureAccessInput = {
      configured: true,
      authReady: true,
      hasUser: true,
      premium: null,
      online: true,
      cachedMark: "unknown",
      authErrored: false,
    };
    // nấc UI đúng là "checking" (im lặng còn hơn nói nhầm hạng)…
    expect(featureAccessDecision(stuck)).toBe("checking");
    // …NHƯNG phải có đường ra: hook bắt buộc hẹn giờ hỏi lại
    expect(
      shouldRetryTierQuery({ authReady: true, hasUser: true, answered: false }),
    ).toBe(true);
    // mất sóng cũng vậy
    expect(featureAccessDecision({ ...stuck, online: false })).toBe("checking");
  });

  it("MỌI trạng thái 'checking' khi đã biết là ai đều KÈM đường hỏi lại", () => {
    // Quét cạn tổ hợp. Luật khoá lại: hễ nấc UI là "checking" mà đã kiểm xong
    // phiên và biết là ai, thì (a) chắc chắn chưa có câu trả lời tươi
    // (premium == null) và (b) shouldRetryTierQuery phải bật. Nhờ vậy không tồn
    // tại trạng thái nào vừa im lặng vừa không tự thoát ra được.
    const marks: PremiumMark[] = ["premium", "basic", "unknown"];
    const premiums: (boolean | null)[] = [true, false, null];
    let seen = 0;
    for (const authReady of [true, false])
      for (const hasUser of [true, false])
        for (const premium of premiums)
          for (const online of [true, false])
            for (const cachedMark of marks)
              for (const authErrored of [true, false])
                for (const premiumExpiredOnly of [true, false]) {
                  const i: FeatureAccessInput = {
                    configured: true,
                    authReady,
                    hasUser,
                    premium,
                    online,
                    cachedMark,
                    authErrored,
                    premiumExpiredOnly,
                  };
                  const access: FeatureAccess = featureAccessDecision(i);
                  if (access !== "checking" || !authReady || !hasUser) continue;
                  seen++;
                  expect(premium).toBeNull();
                  expect(
                    shouldRetryTierQuery({
                      authReady,
                      hasUser,
                      answered: premium != null,
                    }),
                  ).toBe(true);
                }
    expect(seen).toBeGreaterThan(0); // đừng để test rỗng mà vẫn xanh
  });

  it("tra ĐƯỢC rồi thì thôi hỏi lại (khỏi quay pin giữa biển)", () => {
    expect(
      shouldRetryTierQuery({ authReady: true, hasUser: true, answered: true }),
    ).toBe(false);
    // chưa biết là ai / chưa kiểm xong phiên → chưa tới lượt tra hạng
    expect(
      shouldRetryTierQuery({ authReady: true, hasUser: false, answered: false }),
    ).toBe(false);
    expect(
      shouldRetryTierQuery({ authReady: false, hasUser: true, answered: false }),
    ).toBe(false);
  });

  it("nhịp hỏi lại giãn dần, có trần, không bao giờ 0 hay vô hạn", () => {
    expect(tierRetryDelayMs(0)).toBe(TIER_RETRY_BASE_MS);
    expect(tierRetryDelayMs(1)).toBe(TIER_RETRY_BASE_MS * 2);
    expect(tierRetryDelayMs(2)).toBeGreaterThan(tierRetryDelayMs(1));
    for (const n of [0, 1, 5, 50, 1e6, -3, NaN]) {
      const d = tierRetryDelayMs(n);
      expect(d).toBeGreaterThanOrEqual(TIER_RETRY_BASE_MS);
      expect(d).toBeLessThanOrEqual(TIER_RETRY_MAX_MS);
    }
  });

  /* R6: thang lùi tra hạng KHÔNG biết máy đang mất sóng, trong khi
     `stormRetryMs` cùng đợt vá đã có vế đó. Chuyến 10 ngày mất sóng = ~1.400
     lượt hỏi, mỗi lượt còn dựng thêm một đồng hồ chặn. */
  it("MẤT SÓNG → nhảy thẳng về trần, mọi lần thử (đừng quay pin giữa biển)", () => {
    expect(tierRetryDelayMs(0, true)).toBe(TIER_RETRY_MAX_MS);
    for (const n of [0, 1, 2, 5, 50, 1e6, -3, NaN]) {
      expect(tierRetryDelayMs(n, true)).toBe(TIER_RETRY_MAX_MS);
    }
  });

  it("KHÔNG dừng hẳn nhịp — trần là con số hữu hạn (WebView cũ không bắn `online`)", () => {
    expect(Number.isFinite(tierRetryDelayMs(0, true))).toBe(true);
    expect(tierRetryDelayMs(0, true)).toBeGreaterThan(0);
  });

  it("có sóng → giữ nguyên thang cũ (mặc định offline=false)", () => {
    expect(tierRetryDelayMs(0, false)).toBe(TIER_RETRY_BASE_MS);
    expect(tierRetryDelayMs(0)).toBe(tierRetryDelayMs(0, false));
  });
});

/* ── SÓNG VỀ THÌ HỎI NGAY, NHƯNG ĐỪNG DỘI (R6) ─────────────────────────────
   `onBackOnline` trước đây gọi thẳng `runQuery()`, bỏ qua mọi độ trễ. Ven bờ
   trình duyệt bắn `online`/`offline` nhấp nháy liên tục ⇒ mỗi cái nhấp là một
   truy vấn 12 giây. Thang lùi dựng lên để chống đúng chuyện đó, mà cửa này lại
   mở toang. */
describe("shouldQueryOnBackOnline — cửa chống dội", () => {
  const T = Date.parse("2026-08-02T08:00:00+07:00");

  it("chưa hỏi lần nào → cho hỏi ngay", () => {
    expect(shouldQueryOnBackOnline(0, T)).toBe(true);
    expect(shouldQueryOnBackOnline(NaN, T)).toBe(true);
  });

  it("vừa hỏi xong → CHẶN (sóng nhấp nháy không thành mưa truy vấn)", () => {
    expect(shouldQueryOnBackOnline(T, T + 1000)).toBe(false);
    expect(shouldQueryOnBackOnline(T, T + TIER_ONLINE_DEBOUNCE_MS - 1)).toBe(
      false,
    );
  });

  it("đủ lâu rồi → cho hỏi lại (sóng về thật thì không phải chờ 10 phút)", () => {
    expect(shouldQueryOnBackOnline(T, T + TIER_ONLINE_DEBOUNCE_MS)).toBe(true);
    expect(shouldQueryOnBackOnline(T, T + 60_000)).toBe(true);
  });

  it("cửa hẹp hơn trần thang lùi — sóng về vẫn nhanh hơn nhịp hẹn giờ", () => {
    expect(TIER_ONLINE_DEBOUNCE_MS).toBeLessThan(TIER_RETRY_MAX_MS);
    expect(TIER_ONLINE_DEBOUNCE_MS).toBeGreaterThanOrEqual(20_000);
  });
});

describe("formatPremiumUntil — cùng con số với web quản trị", () => {
  it("timestamptz UTC buổi chiều VN vẫn ra ĐÚNG ngày VN (không lệch 1 ngày)", () => {
    // 01/08/2027 lúc 00:48 giờ VN = 31/07/2027 17:48 UTC. Đọc theo UTC sẽ ra
    // 31/07 — lệch với chip "Premium đến 01/08/2027" ở /quan-tri.
    expect(formatPremiumUntil("2027-07-31T17:48:00.000Z")).toBe("01/08/2027");
  });

  it("dạng ngày trần yyyy-mm-dd hiểu theo giờ VN", () => {
    expect(formatPremiumUntil("2027-08-01")).toBe("01/08/2027");
  });

  it("rỗng / null / hỏng → null (không bịa ngày)", () => {
    expect(formatPremiumUntil(null)).toBeNull();
    expect(formatPremiumUntil(undefined)).toBeNull();
    expect(formatPremiumUntil("")).toBeNull();
    expect(formatPremiumUntil("không-phải-ngày")).toBeNull();
  });
});

describe("tierBadge — dòng 'hạng của tôi' trong sheet Tài khoản", () => {
  it("CHƯA CHẮC (đang tra / chưa đăng nhập) → không bày gì", () => {
    expect(tierBadge({ access: "checking", premiumUntil: null })).toBeNull();
    expect(tierBadge({ access: "login", premiumUntil: null })).toBeNull();
    // kể cả khi đã có hạn trong máy — chưa chắc thì vẫn im
    expect(tierBadge({ access: "checking", premiumUntil: "2027-08-01" })).toBeNull();
  });

  it("premium có hạn → chip Premium + nói rõ dùng tới ngày nào", () => {
    const b = tierBadge({ access: "open", premiumUntil: "2027-07-31T17:48:00Z" });
    expect(b?.tone).toBe("premium");
    expect(b?.label).toBe("Premium");
    expect(b?.detail).toContain("01/08/2027");
  });

  it("premium KHÔNG hạn → vẫn là Premium, không bịa ngày", () => {
    const b = tierBadge({ access: "open", premiumUntil: null });
    expect(b?.tone).toBe("premium");
    expect(b?.detail).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("hạng thường → giọng MỜI, không doạ (luật copy giới hạn)", () => {
    const b = tierBadge({ access: "upgrade", premiumUntil: null });
    expect(b?.tone).toBe("basic");
    expect(b?.label).toBe("Tài khoản thường");
    // không dùng từ chặn/khoá/không được — chỉ nói premium mở thêm gì
    expect(b?.detail).not.toMatch(/khoá|khóa|bị chặn|không được/i);
  });
});
