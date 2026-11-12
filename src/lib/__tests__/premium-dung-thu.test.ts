// Dùng thử premium theo ngày — oracle: docs/app-map/20-ba-spec-premium-dung-thu.md
import { describe, expect, it } from "vitest";
import {
  nextPremiumUntil,
  paidGrantAction,
  parsePremiumKind,
  parseTrialDays,
  premiumKindFromGrants,
  resolveTier,
  TIER_MARK_GRACE_DAYS,
  tierBadge,
  TRIAL_DAYS_DEFAULT,
  TRIAL_DAYS_PRESETS,
  trialDenial,
  trialUntil,
} from "@/lib/tier";
import { isSaleGrant, topGranters, trialStats, type GrantRow } from "@/lib/admin-reports";

const vn = (s: string) => Date.parse(`${s}+07:00`);

describe("AC-1 trialUntil — hết cuối ngày giờ VN", () => {
  it("cấp 23:50 VN ngày 12/11, 3 ngày ⇒ hết 15/11 23:59:59 VN", () => {
    expect(trialUntil(vn("2026-11-12T23:50:00"), 3)).toBe("2026-11-15T16:59:59.000Z");
  });
  it("cấp 08:00 VN ngày 12/11, 5 ngày ⇒ hết 17/11 23:59:59 VN", () => {
    expect(trialUntil(vn("2026-11-12T08:00:00"), 5)).toBe("2026-11-17T16:59:59.000Z");
  });
  it("cấp 00:30 VN (vẫn là 11/11 theo UTC) tính theo ngày VN", () => {
    expect(trialUntil(vn("2026-11-12T00:30:00"), 1)).toBe("2026-11-13T16:59:59.000Z");
  });
  it("qua cuối tháng / cuối năm", () => {
    expect(trialUntil(vn("2026-12-30T10:00:00"), 5)).toBe("2027-01-04T16:59:59.000Z");
  });
  it("mức dựng sẵn 3 và 5, mặc định 3", () => {
    expect(TRIAL_DAYS_PRESETS).toEqual([3, 5]);
    expect(TRIAL_DAYS_DEFAULT).toBe(3);
  });
});

describe("AC-3 parseTrialDays — từ chối, KHÔNG ép về khoảng", () => {
  it.each([0, 15, 2.5, -3, "ba", "3", null, undefined, NaN, Infinity])("%s ⇒ null", (v) => {
    expect(parseTrialDays(v)).toBeNull();
  });
  it.each([1, 3, 5, 14])("%s hợp lệ", (v) => {
    expect(parseTrialDays(v)).toBe(v);
  });
});

describe("AC-4/AC-5 trialDenial", () => {
  it("đang premium ⇒ already_premium", () => {
    expect(trialDenial({ effectiveTier: "premium", hasTrial: false })).toBe("already_premium");
  });
  it("đã từng dùng thử ⇒ trial_used", () => {
    expect(trialDenial({ effectiveTier: "basic", hasTrial: true })).toBe("trial_used");
  });
  it("thường, chưa dùng thử ⇒ được", () => {
    expect(trialDenial({ effectiveTier: "basic", hasTrial: false })).toBeNull();
  });
});

describe("premiumKindFromGrants + paidGrantAction (R6, R10)", () => {
  const g = (action: string, created_at: string) => ({ action, created_at });
  it("lượt gần nhất là trial ⇒ trial", () => {
    expect(
      premiumKindFromGrants([g("activate", "2025-01-01T00:00:00Z"), g("downgrade", "2025-06-01T00:00:00Z"), g("trial", "2026-11-12T01:00:00Z")]),
    ).toBe("trial");
  });
  it("mua sau dùng thử ⇒ paid; không có lượt nào ⇒ null", () => {
    expect(premiumKindFromGrants([g("trial", "2026-11-12T01:00:00Z"), g("activate", "2026-11-13T01:00:00Z")])).toBe("paid");
    expect(premiumKindFromGrants([])).toBeNull();
    expect(premiumKindFromGrants([g("downgrade", "2026-11-12T01:00:00Z")])).toBeNull();
  });
  it("AC-9 đang dùng thử mà mua gói ⇒ activate, hạn nối sau dùng thử", () => {
    expect(paidGrantAction(true, "trial")).toBe("activate");
    expect(paidGrantAction(true, "paid")).toBe("renew");
    expect(paidGrantAction(true, null)).toBe("renew");
    expect(paidGrantAction(false, null)).toBe("activate");
    expect(nextPremiumUntil("2026-11-15T16:59:59.000Z", vn("2026-11-13T09:00:00"), 18)).toBe("2028-05-15T16:59:59.000Z");
  });
  it("parsePremiumKind chuỗi lạ ⇒ null", () => {
    expect(parsePremiumKind("trial")).toBe("trial");
    expect(parsePremiumKind("TRIAL")).toBeNull();
    expect(parsePremiumKind(undefined)).toBeNull();
  });
});

describe("AC-10 hết dùng thử về hạng thường", () => {
  it("hạn + 1 giây ⇒ basic; biên lệch đồng hồ vẫn 7 ngày", () => {
    const han = "2026-11-15T16:59:59.000Z";
    expect(resolveTier("premium", han, Date.parse(han) + 1000)).toBe("basic");
    expect(resolveTier("premium", han, Date.parse(han))).toBe("premium");
    expect(TIER_MARK_GRACE_DAYS).toBe(7);
  });
});

describe("AC-13 tierBadge nói đang dùng thử", () => {
  it("trial ⇒ nhãn Dùng thử + ngày hết", () => {
    const b = tierBadge({ access: "open", premiumUntil: "2026-11-15T16:59:59.000Z", kind: "trial" });
    expect(b?.label).toBe("Dùng thử");
    expect(b?.detail).toContain("15/11/2026");
  });
  it("paid / vắng ⇒ như cũ", () => {
    expect(tierBadge({ access: "open", premiumUntil: null, kind: "paid" })?.label).toBe("Gói dự báo");
    expect(tierBadge({ access: "open", premiumUntil: null })?.label).toBe("Gói dự báo");
  });
});

describe("AC-7 lượt dùng thử không tính là bán", () => {
  const rows: GrantRow[] = [
    { customer_phone: "0912000001", granted_by: "0988000001", action: "trial", created_at: "2026-11-01T01:00:00Z" },
    { customer_phone: "0912000002", granted_by: "0988000001", action: "trial", created_at: "2026-11-02T01:00:00Z" },
    { customer_phone: "0912000003", granted_by: "0988000001", action: "activate", created_at: "2026-11-03T01:00:00Z" },
  ];
  it("isSaleGrant(trial) === false, topGranters đếm 1", () => {
    expect(isSaleGrant({ customer_phone: null, granted_by: null, action: "trial", created_at: null })).toBe(false);
    const top = topGranters(rows, new Set(), "2026-10-01T00:00:00Z");
    expect(top).toHaveLength(1);
    expect(top[0].count).toBe(1);
  });
});

describe("AC-14 trialStats — cửa sổ 30 ngày sau ngày hết", () => {
  const end = "2026-10-05T16:59:59.000Z";
  const plus = (d: number) => new Date(Date.parse(end) + d * 86400000).toISOString();
  const rows: GrantRow[] = [
    { customer_phone: "0912000001", granted_by: "s", action: "trial", created_at: "2026-10-02T01:00:00Z", premium_until: end },
    { customer_phone: "0912000002", granted_by: "s", action: "trial", created_at: "2026-10-02T01:00:00Z", premium_until: end },
    { customer_phone: "0912000003", granted_by: "s", action: "trial", created_at: "2026-10-02T01:00:00Z", premium_until: end },
    { customer_phone: "0912000001", granted_by: "s", action: "activate", created_at: plus(10) },
    { customer_phone: "0912000002", granted_by: "s", action: "activate", created_at: plus(40) },
  ];
  it("3 lượt, 1 chuyển đổi", () => {
    expect(trialStats(rows, new Set(), "2026-10-01T00:00:00Z")).toEqual({ count: 3, converted: 1 });
  });
  it("mua NGAY TRONG lúc dùng thử cũng tính", () => {
    const r: GrantRow[] = [rows[0], { ...rows[3], created_at: "2026-10-03T01:00:00Z" }];
    expect(trialStats(r, new Set(), "2026-10-01T00:00:00Z")).toEqual({ count: 1, converted: 1 });
  });
  it("loại khách trong danh sách loại trừ + lượt trước kỳ", () => {
    expect(trialStats(rows, new Set(["0912000001"]), "2026-10-01T00:00:00Z")).toEqual({ count: 2, converted: 0 });
    expect(trialStats(rows, new Set(), "2026-10-03T00:00:00Z")).toEqual({ count: 0, converted: 0 });
  });
});
