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
