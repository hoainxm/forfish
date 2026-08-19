/**
 * NHẮC CÀI APP — luật thuần (2026-08-18, audit S7). Trước đây iPhone thấy thẻ
 * "Cài SDFish về máy" MỖI LẦN mở app tới khi bấm X; Android bấm Cài rồi huỷ
 * hộp thoại thì lần sau lại nhắc. Nay: nhắc tối đa MAX lần, mỗi lần cách nhau
 * ít nhất 1 ngày, rồi im hẳn; bấm X hoặc Cài-rồi-huỷ = coi như đã tắt.
 *
 * Khoá mới `forfish.installNudge.v2` = {count, lastAt, dismissed}. Khoá cũ
 * `forfish.installNudge.dismissed.v1` = "1" vẫn được đọc = đã tắt (không bắt bà
 * con tắt lại).
 */

export const INSTALL_NUDGE_KEY = "forfish.installNudge.v2";
export const INSTALL_NUDGE_LEGACY_KEY = "forfish.installNudge.dismissed.v1";
export const INSTALL_NUDGE_MAX = 3;
export const INSTALL_NUDGE_GAP_MS = 24 * 60 * 60 * 1000;

export type InstallNudgeState = {
  /** số lần đã hiện */
  count: number;
  /** mốc lần hiện gần nhất (ms), null = chưa lần nào */
  lastAt: number | null;
  /** bà con đã tắt (X, hoặc Cài rồi huỷ) → im vĩnh viễn */
  dismissed: boolean;
};

export const EMPTY_NUDGE: InstallNudgeState = {
  count: 0,
  lastAt: null,
  dismissed: false,
};

/** Đọc từ chuỗi JSON đã lưu; rác/thiếu → trạng thái rỗng (KHÔNG ném). */
export function parseInstallNudge(
  raw: string | null,
  legacyDismissed: string | null,
): InstallNudgeState {
  if (legacyDismissed === "1") return { ...EMPTY_NUDGE, dismissed: true };
  if (!raw) return EMPTY_NUDGE;
  try {
    const j = JSON.parse(raw) as Partial<InstallNudgeState> | null;
    if (!j || typeof j !== "object") return EMPTY_NUDGE;
    return {
      count:
        typeof j.count === "number" && Number.isFinite(j.count) && j.count >= 0
          ? Math.floor(j.count)
          : 0,
      lastAt:
        typeof j.lastAt === "number" && Number.isFinite(j.lastAt)
          ? j.lastAt
          : null,
      dismissed: j.dismissed === true,
    };
  } catch {
    return EMPTY_NUDGE;
  }
}

/** Lần này có nên hiện không — THUẦN. */
export function shouldShowInstallNudge(
  s: InstallNudgeState,
  now: number,
): boolean {
  if (s.dismissed) return false;
  if (s.count >= INSTALL_NUDGE_MAX) return false;
  if (s.lastAt != null && now - s.lastAt < INSTALL_NUDGE_GAP_MS) return false;
  return true;
}

/** Trạng thái sau khi đã hiện một lần. */
export function markInstallNudgeShown(
  s: InstallNudgeState,
  now: number,
): InstallNudgeState {
  return { ...s, count: s.count + 1, lastAt: now };
}

/** Trạng thái sau khi bà con tắt (X) hoặc Cài-rồi-huỷ. */
export function markInstallNudgeDismissed(
  s: InstallNudgeState,
): InstallNudgeState {
  return { ...s, dismissed: true };
}
