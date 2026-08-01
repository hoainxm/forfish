import { describe, expect, it } from "vitest";
import {
  featureAccessDecision,
  formatPremiumUntil,
  FREE_FORECAST_DAYS,
  nextPremiumUntil,
  PREMIUM_TERM_DAYS,
  resolveTier,
  tierBadge,
  type FeatureAccessInput,
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

describe("nextPremiumUntil — 1 lần kích = 1 năm", () => {
  const YEAR_MS = PREMIUM_TERM_DAYS * 24 * 3600 * 1000;

  it("chưa có hạn / null → 1 năm từ bây giờ", () => {
    expect(Date.parse(nextPremiumUntil(null, NOW))).toBe(NOW + YEAR_MS);
    expect(Date.parse(nextPremiumUntil(undefined, NOW))).toBe(NOW + YEAR_MS);
  });

  it("ĐÃ hết hạn → 1 năm từ bây giờ (không cộng vào quá khứ)", () => {
    const past = new Date(NOW - 30 * 24 * 3600 * 1000).toISOString();
    expect(Date.parse(nextPremiumUntil(past, NOW))).toBe(NOW + YEAR_MS);
  });

  it("CÒN hạn → cộng nối 1 năm vào hạn cũ (gia hạn sớm không thiệt ngày)", () => {
    const future = NOW + 100 * 24 * 3600 * 1000;
    expect(
      Date.parse(nextPremiumUntil(new Date(future).toISOString(), NOW)),
    ).toBe(future + YEAR_MS);
  });

  it("hạn hỏng (không parse được) → coi như chưa có, 1 năm từ bây giờ", () => {
    expect(Date.parse(nextPremiumUntil("không-phải-ngày", NOW))).toBe(
      NOW + YEAR_MS,
    );
  });

  it("kỳ hạn đúng 365 ngày", () => {
    expect(PREMIUM_TERM_DAYS).toBe(365);
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
    cachedPremium: false,
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
        cachedPremium: true,
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
        cachedPremium: false,
      }),
    ).toBe("login");
  });

  it("nhánh offline-premium ưu tiên hơn cả 'chưa kiểm xong'", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: false,
        authReady: false,
        cachedPremium: true,
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
        cachedPremium: true,
      }),
    ).toBe("open");
  });

  it("onLine=true, auth tra ĐƯỢC mà không có user (đăng xuất thật) + từng premium → login (không rò quyền)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: false,
        cachedPremium: true,
      }),
    ).toBe("login");
  });

  it("auth HỎNG nhưng CHƯA từng premium → login (không mở bừa)", () => {
    expect(
      featureAccessDecision({
        ...base,
        online: true,
        hasUser: false,
        authErrored: true,
        cachedPremium: false,
      }),
    ).toBe("login");
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
