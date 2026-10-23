// Nhắc cài app: ≤3 lần, cách ≥1 ngày, tắt là nhớ (2026-08-18, audit S7).
import { describe, expect, it } from "vitest";
import {
  EMPTY_NUDGE,
  INSTALL_NUDGE_GAP_MS,
  INSTALL_NUDGE_MAX,
  markInstallNudgeDismissed,
  markInstallNudgeShown,
  parseInstallNudge,
  shouldShowInstallNudge,
} from "../install-nudge";

const NOW = Date.parse("2026-08-18T08:00:00+07:00");
const DAY = 24 * 3_600_000;

describe("parseInstallNudge", () => {
  it("rỗng / rác → trạng thái rỗng, không ném", () => {
    expect(parseInstallNudge(null, null)).toEqual(EMPTY_NUDGE);
    expect(parseInstallNudge("{bad json", null)).toEqual(EMPTY_NUDGE);
    expect(parseInstallNudge("null", null)).toEqual(EMPTY_NUDGE);
    expect(parseInstallNudge('{"count":"x","lastAt":"y"}', null)).toEqual(EMPTY_NUDGE);
  });
  it("khoá cũ dismissed.v1 = '1' → coi như đã tắt", () => {
    expect(parseInstallNudge(null, "1").dismissed).toBe(true);
    expect(parseInstallNudge('{"count":1}', "1").dismissed).toBe(true);
  });
  it("đọc đúng bản đã lưu", () => {
    const s = parseInstallNudge(
      JSON.stringify({ count: 2, lastAt: NOW - DAY, dismissed: false }),
      null,
    );
    expect(s).toEqual({ count: 2, lastAt: NOW - DAY, dismissed: false });
  });
});

describe("shouldShowInstallNudge", () => {
  it("lần đầu → hiện", () => {
    expect(shouldShowInstallNudge(EMPTY_NUDGE, NOW)).toBe(true);
  });
  it("đã tắt → im vĩnh viễn", () => {
    expect(shouldShowInstallNudge(markInstallNudgeDismissed(EMPTY_NUDGE), NOW)).toBe(false);
  });
  it("vừa hiện chưa đủ 1 ngày → im; qua 1 ngày → hiện lại", () => {
    const shown = markInstallNudgeShown(EMPTY_NUDGE, NOW);
    expect(shouldShowInstallNudge(shown, NOW + 6 * 3_600_000)).toBe(false);
    expect(shouldShowInstallNudge(shown, NOW + INSTALL_NUDGE_GAP_MS - 1)).toBe(false);
    expect(shouldShowInstallNudge(shown, NOW + INSTALL_NUDGE_GAP_MS)).toBe(true);
  });
  it("tối đa 3 lần rồi im hẳn", () => {
    let s = EMPTY_NUDGE;
    let t = NOW;
    for (let i = 0; i < INSTALL_NUDGE_MAX; i++) {
      expect(shouldShowInstallNudge(s, t)).toBe(true);
      s = markInstallNudgeShown(s, t);
      t += DAY;
    }
    expect(s.count).toBe(3);
    expect(shouldShowInstallNudge(s, t + 30 * DAY)).toBe(false);
  });
});

describe("markInstallNudgeSnoozed — bấm Ẩn là hoãn, không tắt vĩnh viễn (2026-10-22)", () => {
  it("trong 7 ngày im, quá 7 ngày nhắc lại (còn trong trần lần)", async () => {
    const m = await import("@/lib/install-nudge");
    const now = 1_000_000_000_000;
    const s = m.markInstallNudgeSnoozed(m.markInstallNudgeShown(m.EMPTY_NUDGE, now), now);
    expect(m.shouldShowInstallNudge(s, now + 2 * 24 * 3600_000)).toBe(false);
    expect(m.shouldShowInstallNudge(s, now + m.INSTALL_NUDGE_SNOOZE_MS + 1)).toBe(true);
    expect(s.dismissed).toBe(false);
  });
  it("đọc lại mốc hoãn từ chuỗi đã lưu; rác thì bỏ qua", async () => {
    const m = await import("@/lib/install-nudge");
    expect(m.parseInstallNudge(JSON.stringify({ count: 1, lastAt: 5, dismissed: false, snoozeUntil: 99 }), null).snoozeUntil).toBe(99);
    expect(m.parseInstallNudge(JSON.stringify({ count: 1, snoozeUntil: "x" }), null).snoozeUntil).toBeUndefined();
  });
  it("hết trần MAX lần thì im dù đã hết hoãn", async () => {
    const m = await import("@/lib/install-nudge");
    const s = { ...m.EMPTY_NUDGE, count: m.INSTALL_NUDGE_MAX, snoozeUntil: 0 };
    expect(m.shouldShowInstallNudge(s, Date.now())).toBe(false);
  });
});
