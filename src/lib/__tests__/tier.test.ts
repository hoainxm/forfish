import { describe, expect, it } from "vitest";
import {
  FREE_FORECAST_DAYS,
  nextPremiumUntil,
  PREMIUM_TERM_DAYS,
  resolveTier,
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
