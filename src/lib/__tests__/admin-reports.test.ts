import { describe, expect, it } from "vitest";
import {
  bucketLabel,
  bucketStart,
  bucketStarts,
  countSeries,
  devicesByPlatform,
  excludedPhones,
  isCountable,
  parsePeriod,
  PERIOD_LABEL,
  percent,
  rangeStartIso,
  summarize,
  topGranters,
  usageSnapshot,
} from "@/lib/admin-reports";
import { nhanHopLe } from "@/lib/labels";

// 2026-10-28 (thứ Tư) 10:00 giờ VN = 03:00Z
const NOW = Date.parse("2026-10-28T03:00:00Z");

describe("kỳ báo cáo", () => {
  it("tham số lạ ⇒ ngày; nhãn chip ≤2 chữ", () => {
    expect(parsePeriod("month")).toBe("month");
    expect(parsePeriod("constructor")).toBe("day");
    expect(parsePeriod(null)).toBe("day");
    for (const l of Object.values(PERIOD_LABEL)) expect(nhanHopLe(l)).toBe(true);
  });

  it("chia ngày theo GIỜ VN: 23:30Z ngày 27 là sáng 28 ở VN", () => {
    const ms = Date.parse("2026-10-27T23:30:00Z");
    expect(new Date(bucketStart(ms, "day")).toISOString()).toBe("2026-10-27T17:00:00.000Z");
    expect(bucketLabel(bucketStart(ms, "day"), "day")).toBe("28/10");
  });

  it("tuần bắt đầu thứ Hai; tháng/năm đúng mốc VN", () => {
    expect(bucketLabel(bucketStart(NOW, "week"), "week")).toBe("26/10");
    // Chủ nhật 01/11 vẫn thuộc tuần 26/10
    expect(bucketLabel(bucketStart(Date.parse("2026-11-01T10:00:00Z"), "week"), "week")).toBe("26/10");
    expect(bucketLabel(bucketStart(NOW, "month"), "month")).toBe("10/2026");
    // 31/12 18:00Z = 01/01 năm sau ở VN
    expect(bucketLabel(bucketStart(Date.parse("2026-12-31T18:00:00Z"), "year"), "year")).toBe("2027");
  });

  it("n kỳ tăng dần, kỳ cuối = kỳ hiện tại, lùi tháng qua năm", () => {
    const s = bucketStarts(NOW, "month", 12);
    expect(s).toHaveLength(12);
    expect(bucketLabel(s[0], "month")).toBe("11/2025");
    expect(bucketLabel(s[11], "month")).toBe("10/2026");
    expect(rangeStartIso(NOW, "day")).toBe("2026-10-14T17:00:00.000Z");
  });
});

describe("countSeries / summarize", () => {
  it("đếm đúng kỳ, bỏ mốc rỗng/hỏng/tương lai/ngoài khoảng", () => {
    const s = countSeries(
      [
        "2026-10-28T01:00:00Z",
        "2026-10-27T18:00:00Z", // 28/10 ở VN
        "2026-10-27T10:00:00Z", // 27/10
        null,
        "rác",
        "2026-10-29T00:00:00Z", // tương lai
        "2025-01-01T00:00:00Z", // ngoài 14 ngày
      ],
      "day",
      NOW,
    );
    expect(s).toHaveLength(14);
    expect(s.at(-1)).toMatchObject({ label: "28/10", count: 2 });
    expect(s.at(-2)).toMatchObject({ label: "27/10", count: 1 });
    expect(summarize(s)).toEqual({ current: 2, previous: 1, inRange: 3 });
  });
  it("chuỗi rỗng ⇒ 0, không ném", () => {
    expect(summarize([])).toEqual({ current: 0, previous: 0, inRange: 0 });
    expect(percent(1, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33);
  });
});

describe("ai được đếm", () => {
  const customers = [
    { phone: "0901000001", account_kind: "real", role: "customer" },
    { phone: "0901000002", account_kind: "test", role: "customer" },
    { phone: "84901000003", account_kind: "real", role: "manager" },
    { phone: "0901000004", account_kind: null, role: null },
  ];
  const ex = excludedPhones(customers, ["0901000009"]);
  it("loại tài khoản thử + nhân sự (kể cả SĐT dạng 84)", () => {
    expect(isCountable("0901000001", ex)).toBe(true);
    expect(isCountable("0901000002", ex)).toBe(false);
    expect(isCountable("0901000003", ex)).toBe(false);
    expect(isCountable("0901000009", ex)).toBe(false);
  });
  it("chưa có hàng customers / cột trống ⇒ vẫn là khách thật; tên đăng nhập không phải SĐT ⇒ bỏ", () => {
    expect(isCountable("0901000004", ex)).toBe(true);
    expect(isCountable("0901555555", ex)).toBe(true);
    expect(isCountable("admin", ex)).toBe(false);
    expect(isCountable(null, ex)).toBe(false);
  });
});

describe("usageSnapshot", () => {
  it("mở app theo mốc mới nhất của hai kho, premium theo resolveTier", () => {
    const ex = excludedPhones([{ phone: "0901000002", account_kind: "demo" }], []);
    const snap = usageSnapshot(
      [
        { phone: "0901000001", tier: "premium", premium_until: null, pwa_last_open_at: "2026-10-28T01:00:00Z", offline_ready_at: "2026-10-01T00:00:00Z" },
        { phone: "0901000003", tier: "premium", premium_until: "2026-10-01T00:00:00Z", web_last_open_at: "2026-10-25T00:00:00Z", pwa_last_open_at: "2026-09-01T00:00:00Z" },
        { phone: "0901000004", tier: "basic" },
        { phone: "0901000002", tier: "premium", pwa_last_open_at: "2026-10-28T01:00:00Z" },
      ],
      ex,
      NOW,
    );
    expect(snap).toEqual({ customers: 3, premiumActive: 1, open1d: 1, open7d: 2, open30d: 2, offlineReady: 1 });
  });
});

describe("topGranters", () => {
  it("chỉ kích hoạt + gia hạn trong khoảng, bỏ khách thử, che SĐT người cấp", () => {
    const ex = excludedPhones([{ phone: "0901000002", account_kind: "test" }], []);
    const rows = [
      { customer_phone: "0901000001", granted_by: "0912345678", action: "activate", created_at: "2026-10-20T00:00:00Z" },
      { customer_phone: "0901000003", granted_by: "0912345678", action: "renew", created_at: "2026-10-21T00:00:00Z" },
      { customer_phone: "0901000004", granted_by: "admin", action: "activate", created_at: "2026-10-22T00:00:00Z" },
      { customer_phone: "0901000004", granted_by: "admin", action: "downgrade", created_at: "2026-10-23T00:00:00Z" },
      { customer_phone: "0901000002", granted_by: "admin", action: "activate", created_at: "2026-10-23T00:00:00Z" },
      { customer_phone: "0901000005", granted_by: "admin", action: "activate", created_at: "2026-01-01T00:00:00Z" },
      { customer_phone: "0901000006", granted_by: null, action: "activate", created_at: "2026-10-24T00:00:00Z" },
    ];
    expect(topGranters(rows, ex, "2026-10-01T00:00:00Z")).toEqual([
      { who: "0912***678", count: 2 },
      { who: "admin", count: 1 },
      { who: "Không rõ", count: 1 },
    ]);
  });
});

describe("devicesByPlatform", () => {
  it("chỉ máy thấy trong 30 ngày, loại lạ về 'khac'", () => {
    const out = devicesByPlatform(
      [
        { customer_phone: "0901000001", platform: "ios", last_seen_at: "2026-10-27T00:00:00Z" },
        { customer_phone: "0901000001", platform: "android", last_seen_at: "2026-10-27T00:00:00Z" },
        { customer_phone: "0901000003", platform: "windows", last_seen_at: "2026-10-27T00:00:00Z" },
        { customer_phone: "0901000004", platform: "ios", last_seen_at: "2026-08-01T00:00:00Z" },
      ],
      new Set(),
      NOW,
    );
    expect(out).toEqual({ ios: 1, android: 1, khac: 1 });
  });
});
