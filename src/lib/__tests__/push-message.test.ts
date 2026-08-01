import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatSentAtVN,
  pushBodyVN,
  staleWarningVN,
  PUSH_FRESH_MS,
} from "@/lib/push-message";

// 01/08/2026 14:30 giờ VN = 07:30 UTC
const SENT = Date.UTC(2026, 7, 1, 7, 30);

describe("formatSentAtVN — luôn giờ Việt Nam, không theo locale máy", () => {
  it("đổi UTC sang UTC+7 và in HH:MM DD/MM", () => {
    expect(formatSentAtVN(SENT)).toBe("14:30 01/08");
  });
  it("qua ngày: 23:30 UTC 31/07 → 06:30 01/08 giờ VN", () => {
    expect(formatSentAtVN(Date.UTC(2026, 6, 31, 23, 30))).toBe("06:30 01/08");
  });
});

describe("staleWarningVN — tin phải tự khai tuổi", () => {
  it("tươi (dưới 2 giờ) → không kêu gì", () => {
    expect(staleWarningVN(SENT, SENT)).toBeNull();
    expect(staleWarningVN(SENT, SENT + PUSH_FRESH_MS - 1)).toBeNull();
  });
  it("trễ vài giờ → đếm GIỜ", () => {
    expect(staleWarningVN(SENT, SENT + 5 * 3600_000)).toBe("TIN CŨ 5 GIỜ TRƯỚC —");
  });
  it("trễ nhiều ngày → đếm NGÀY (ca Apple giữ tin tới 4 tuần)", () => {
    expect(staleWarningVN(SENT, SENT + 3 * 86400_000)).toBe(
      "TIN CŨ 3 NGÀY TRƯỚC —",
    );
    expect(staleWarningVN(SENT, SENT + 28 * 86400_000)).toBe(
      "TIN CŨ 28 NGÀY TRƯỚC —",
    );
  });
  it("đồng hồ máy chạy lùi / mốc hỏng → KHÔNG kêu bừa", () => {
    expect(staleWarningVN(SENT, SENT - 86400_000)).toBeNull();
    expect(staleWarningVN(Number.NaN, SENT)).toBeNull();
  });
});

describe("pushBodyVN — nội dung cuối cùng hiện trên máy", () => {
  const body = "Bão số 5 đang vào Biển Đông";
  it("tin tươi: nội dung + giờ gửi (giờ LUÔN in)", () => {
    expect(pushBodyVN({ body, sentAtMs: SENT, nowMs: SENT })).toBe(
      "Bão số 5 đang vào Biển Đông (tin lúc 14:30 01/08)",
    );
  });
  it("tin cũ: cảnh báo ĐỨNG TRƯỚC — liếc dòng đầu là biết", () => {
    expect(
      pushBodyVN({ body, sentAtMs: SENT, nowMs: SENT + 3 * 86400_000 }),
    ).toBe(
      "TIN CŨ 3 NGÀY TRƯỚC — Bão số 5 đang vào Biển Đông (tin lúc 14:30 01/08)",
    );
  });
  it("thiếu mốc gửi (bản app cũ) → giữ nguyên nội dung, không bịa", () => {
    expect(pushBodyVN({ body, sentAtMs: null, nowMs: SENT })).toBe(body);
  });
});

describe("public/sw.js giữ ĐÚNG bản sao ngưỡng", () => {
  it("PUSH_FRESH_MS trong sw.js khớp bản canonical", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const m = sw.match(/const PUSH_FRESH_MS = ([^;]+);/);
    expect(m, "sw.js phải có const PUSH_FRESH_MS").toBeTruthy();
    // eslint-disable-next-line no-eval
    expect(eval(m![1])).toBe(PUSH_FRESH_MS);
  });
});
