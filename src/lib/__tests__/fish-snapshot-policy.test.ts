import { describe, expect, it } from "vitest";
import {
  shouldReplaceSnapshot,
  isSnapshotFresh,
  isSnapshotFreshAt,
  SNAPSHOT_MAX_AGE_MS,
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

describe("isSnapshotFresh — bắt cron ĐỨNG để khỏi dọn số cũ như số mới", () => {
  const NOW = Date.parse("2026-07-26T12:00:00Z");

  it("mới tính (trong hạn) → tươi", () => {
    expect(isSnapshotFresh("2026-07-26T06:00:00Z", NOW)).toBe(true); // 6h
    expect(isSnapshotFresh(new Date(NOW).toISOString(), NOW)).toBe(true); // 0h
  });

  it("đúng mốc 30h vẫn tươi; quá 30h → KHÔNG (cron đứng → tính live)", () => {
    expect(isSnapshotFresh(new Date(NOW - SNAPSHOT_MAX_AGE_MS).toISOString(), NOW)).toBe(true);
    expect(
      isSnapshotFresh(new Date(NOW - SNAPSHOT_MAX_AGE_MS - 60_000).toISOString(), NOW),
    ).toBe(false);
  });

  it("bản 3 ngày trước (cron chết mấy hôm) → KHÔNG tươi", () => {
    expect(isSnapshotFresh("2026-07-23T12:00:00Z", NOW)).toBe(false);
  });

  it("thiếu / hỏng generated_at → KHÔNG tươi (đi tính live)", () => {
    expect(isSnapshotFresh(null, NOW)).toBe(false);
    expect(isSnapshotFresh(undefined, NOW)).toBe(false);
    expect(isSnapshotFresh("hôm qua", NOW)).toBe(false);
  });

  it("generated_at ở tương lai xa (đồng hồ lệch) → KHÔNG tin được", () => {
    expect(isSnapshotFresh(new Date(NOW + 3 * 3600_000).toISOString(), NOW)).toBe(false);
  });
});

/* Bản SỐ của cùng luật — client dùng (savedFishMark().dataAt đã parse sẵn).
   Phải KHỚP TỪNG LI với bản chuỗi: lệch nhau là bảng "trong máy có gì" lại nói
   "đã cũ" ở lúc route vẫn phục vụ bản đó, tức nút "Tải mới" thành nút chết. */
describe("isSnapshotFreshAt — cùng luật, nhận mốc dạng số (cho client)", () => {
  const NOW = Date.parse("2026-07-26T12:00:00Z");

  it("khớp bản chuỗi ở mọi mốc", () => {
    for (const ageH of [0, 6, 13, 29, 30, 31, 72]) {
      const t = NOW - ageH * 3600_000;
      expect(isSnapshotFreshAt(t, NOW)).toBe(
        isSnapshotFresh(new Date(t).toISOString(), NOW),
      );
    }
  });

  it("trong 30 giờ → tươi; quá 30 giờ → không", () => {
    expect(isSnapshotFreshAt(NOW - SNAPSHOT_MAX_AGE_MS, NOW)).toBe(true);
    expect(isSnapshotFreshAt(NOW - SNAPSHOT_MAX_AGE_MS - 60_000, NOW)).toBe(false);
  });

  it("thiếu mốc / không phải số / ở tương lai xa → KHÔNG tươi", () => {
    expect(isSnapshotFreshAt(null, NOW)).toBe(false);
    expect(isSnapshotFreshAt(undefined, NOW)).toBe(false);
    expect(isSnapshotFreshAt(NaN, NOW)).toBe(false);
    expect(isSnapshotFreshAt(NOW + 3 * 3600_000, NOW)).toBe(false);
  });
});
