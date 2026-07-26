import { describe, expect, it } from "vitest";
import {
  shouldReplaceSnapshot,
  SNAPSHOT_REVALIDATE,
} from "@/lib/fish-snapshot-policy";

describe("shouldReplaceSnapshot — giữ bản tốt, không lùi ngày", () => {
  const good = { ok: true as const, targetDate: "2026-07-24" };

  it("bản mới HỎNG → KHÔNG ghi đè (đừng thay bản tốt bằng số không)", () => {
    expect(shouldReplaceSnapshot("2026-07-20", { ok: false })).toBe(false);
    expect(shouldReplaceSnapshot(null, { ok: false })).toBe(false);
    expect(shouldReplaceSnapshot(null, null)).toBe(false);
    expect(shouldReplaceSnapshot("2026-07-20", undefined)).toBe(false);
  });

  it("chưa có bản nào + bản mới tốt → GHI", () => {
    expect(shouldReplaceSnapshot(null, good)).toBe(true);
    expect(shouldReplaceSnapshot(undefined, good)).toBe(true);
  });

  it("bản mới thiếu targetDate → KHÔNG (không đủ căn cứ so)", () => {
    expect(shouldReplaceSnapshot("2026-07-20", { ok: true })).toBe(false);
  });

  it("ngày mới < cũ → KHÔNG lùi (cron vồ nhằm lúc nguồn cũ)", () => {
    expect(
      shouldReplaceSnapshot("2026-07-24", { ok: true, targetDate: "2026-07-23" }),
    ).toBe(false);
  });

  it("ngày mới ≥ cũ → GHI (bằng ngày vẫn làm tươi generatedAt)", () => {
    expect(
      shouldReplaceSnapshot("2026-07-24", { ok: true, targetDate: "2026-07-24" }),
    ).toBe(true);
    expect(
      shouldReplaceSnapshot("2026-07-24", { ok: true, targetDate: "2026-07-25" }),
    ).toBe(true);
  });

  it("chu kỳ đọc snapshot = 30 phút", () => {
    expect(SNAPSHOT_REVALIDATE).toBe(1800);
  });
});
