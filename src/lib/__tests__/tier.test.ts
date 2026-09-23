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

describe("featureAccessDecision — luật MECE ba đầu vào (viết lại 2026-09-02)", () => {
  /*  LUẬT CŨ nhận CHÍN đầu vào (authReady · hasUser · online · authErrored ·
      hasOfflineIdentity · premium · premiumExpiredOnly · premiumMarkUntil ·
      cachedMark) = 288 tổ hợp, và chính nó đẻ ra chuỗi ngõ cụt phải vá suốt
      tháng 8. Chủ dự án 2026-09-02: *"làm cái logic gì đơn giản, mece"*.

      Toàn bộ không gian trạng thái (12 ca) nay quét CẠN ở
      `premium-lockout-sweep.test.ts`. Khối này giữ lại đúng những CẢNH THẬT
      NGOÀI HIỆN TRƯỜNG đã từng làm bà con mất quyền — để lần sau ai sửa luật
      thì thấy ngay cái giá phải trả, không phải đọc lại lịch sử git.

      Hạn premium KHÔNG còn là đầu vào ở đây: `effectivePremiumMark` hạ dấu
      xuống "basic" TRƯỚC khi tới cửa này (biên 7 ngày cho đồng hồ máy lệch,
      luật E4) — test của nó nằm ngay dưới, không mất chỗ nào. */
  const may = (mark: PremiumMark, hasToken = true): FeatureAccessInput => ({
    configured: true,
    hasToken,
    mark,
  });

  it("demo mode (chưa cấu hình Supabase) → open, bất kể mọi thứ khác", () => {
    expect(
      featureAccessDecision({ configured: false, hasToken: false, mark: "unknown" }),
    ).toBe("open");
  });

  it("CẢNH 1 — mở app nguội, nhịp chưa về: dấu đã lưu quyết định, KHÔNG kẹt checking", () => {
    expect(featureAccessDecision(may("premium"))).toBe("open");
  });

  it("CẢNH 2 — GIỮA BIỂN mất sóng nhiều ngày: vẫn mở", () => {
    /*  Luật mới KHÔNG có đầu vào `online` để mà hỏi — đó chính là lý do nó
        không kẹt được. Mất sóng và có sóng là CÙNG một đầu vào. */
    expect(featureAccessDecision(may("premium"))).toBe("open");
  });

  it("CẢNH 3 — rụng phiên khi bắt wifi ở cảng (auth-js tự xoá phiên): vẫn mở", () => {
    /*  Ca C-7 2026-08-02: người trả tiền tới 2027 từng rơi thẳng xuống "login"
        giữa chuyến biển vì `getUser()` trả null. Nay phiên Supabase không còn
        là đầu vào — chìa là chuỗi cứng, mà chuỗi thì vẫn nằm trong máy. */
    expect(featureAccessDecision(may("premium"))).toBe("open");
  });

  it("CẢNH 4 — ĐỔI MÁY: máy mới không có chuỗi ⇒ đăng nhập lại", () => {
    expect(featureAccessDecision(may("premium", false))).toBe("login");
  });

  it("CẢNH 5 — ĐĂNG XUẤT trên máy dùng chung: người sau KHÔNG thừa hưởng quyền", () => {
    // đăng xuất xoá cả chuỗi lẫn dấu (clearTierMark + forgetTierMarkCache)
    expect(featureAccessDecision(may("unknown", false))).toBe("login");
  });

  it("CẢNH 6 — HẠ HẠNG ở /quan-tri: nhịp ghi dấu 'basic' ⇒ đóng lại được", () => {
    expect(featureAccessDecision(may("basic"))).toBe("upgrade");
  });

  it("CẢNH 7 — chưa từng biết hạng ⇒ 'checking', và PHẢI có đường hỏi lại", () => {
    expect(featureAccessDecision(may("unknown"))).toBe("checking");
    /*  "checking" chỉ chấp nhận được vì có đường ra: `shouldRetryTierQuery`
        hẹn hỏi lại, và `heartbeatNeedsScan` (2026-09-02) cho gửi NGAY khi máy
        có chuỗi mà dấu vẫn unknown, không chờ hết cửa 30 phút. Bỏ đường ra là
        dựng lại đúng ca kẹt vĩnh viễn. */
    expect(
      shouldRetryTierQuery({ authReady: true, hasUser: true, answered: false }),
    ).toBe(true);
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
