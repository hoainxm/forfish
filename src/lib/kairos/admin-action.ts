// KAIROS — THAO TÁC QUẢN TRỊ (14 §3.11, §7 /api/admin/kairos/action, AC16). THUẦN.
//
// Mỗi thao tác cần MỘT quyền của tab "kairos" (staff-permissions): view = xem · edit = ẩn/hiện,
// ghim, xử lý báo xấu, đảo quyết định agent · delete = cấm SĐT · create = đăng Chính thức
// (route official riêng). Kiểm đầu vào ở đây; route chỉ chạy.

import type { PermAction } from "@/lib/staff-permissions";
import { cleanText } from "./validate";
import { isUuid } from "./validate";
import type { Verdict } from "./quyet-dinh";

export type AdminActionName = "hide" | "unhide" | "ban" | "unban" | "pin" | "unpin" | "resolve" | "verdict";

export type AdminAction =
  | { action: "hide" | "unhide"; targetType: "post" | "comment"; targetId: string; reason: string | null }
  | { action: "ban"; profileId: string; until: string; reason: string }
  | { action: "unban"; profileId: string }
  | { action: "pin"; postId: string; until: string }
  | { action: "unpin"; postId: string }
  | { action: "resolve"; targetType: "post" | "comment"; targetId: string; status: "da-an" | "bo-qua" }
  | { action: "verdict"; decisionId: number; verdict: Verdict; reason: string | null };

export const ACTION_PERM: Record<AdminActionName, PermAction> = {
  hide: "edit",
  unhide: "edit",
  pin: "edit",
  unpin: "edit",
  resolve: "edit",
  verdict: "edit",
  ban: "delete",
  unban: "delete",
};

/** Cấm "vĩnh viễn" = mốc rất xa (cột timestamptz, không có vô cực trong JSON). */
export const BAN_FOREVER_ISO = "9999-12-31T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;
/** Ghim tối đa 30 ngày — bài ghim mãi là dải đầu dòng tin chết. */
export const PIN_MAX_MS = 30 * DAY;

const reasonOf = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = cleanText(v);
  return t ? [...t].slice(0, max).join("") : null;
};

/** `until` của lệnh cấm: "7d" | "30d" | "forever". */
export function banUntil(raw: unknown, now: number): string | null {
  if (raw === "7d") return new Date(now + 7 * DAY).toISOString();
  if (raw === "30d") return new Date(now + 30 * DAY).toISOString();
  if (raw === "forever") return BAN_FOREVER_ISO;
  return null;
}

export function validateAdminAction(raw: unknown, now: number): { ok: true; value: AdminAction } | { ok: false; code: string } {
  if (!raw || typeof raw !== "object") return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  const tt = r.targetType === "post" || r.targetType === "comment" ? r.targetType : null;
  switch (r.action) {
    case "hide":
    case "unhide":
      if (!tt || !isUuid(r.targetId)) return { ok: false, code: "bad_target" };
      return { ok: true, value: { action: r.action, targetType: tt, targetId: r.targetId.toLowerCase(), reason: reasonOf(r.reason, 300) } };
    case "ban": {
      if (!isUuid(r.profileId)) return { ok: false, code: "bad_target" };
      const until = banUntil(r.until, now);
      if (!until) return { ok: false, code: "bad_until" };
      const reason = reasonOf(r.reason, 300);
      if (!reason) return { ok: false, code: "reason_required" };
      return { ok: true, value: { action: "ban", profileId: r.profileId.toLowerCase(), until, reason } };
    }
    case "unban":
      if (!isUuid(r.profileId)) return { ok: false, code: "bad_target" };
      return { ok: true, value: { action: "unban", profileId: r.profileId.toLowerCase() } };
    case "pin": {
      if (!isUuid(r.postId)) return { ok: false, code: "bad_target" };
      const t = typeof r.until === "string" ? Date.parse(r.until) : NaN;
      if (!Number.isFinite(t) || t <= now || t > now + PIN_MAX_MS) return { ok: false, code: "bad_until" };
      return { ok: true, value: { action: "pin", postId: r.postId.toLowerCase(), until: new Date(t).toISOString() } };
    }
    case "unpin":
      if (!isUuid(r.postId)) return { ok: false, code: "bad_target" };
      return { ok: true, value: { action: "unpin", postId: r.postId.toLowerCase() } };
    case "resolve":
      if (!tt || !isUuid(r.targetId)) return { ok: false, code: "bad_target" };
      if (r.status !== "da-an" && r.status !== "bo-qua") return { ok: false, code: "bad_status" };
      return { ok: true, value: { action: "resolve", targetType: tt, targetId: r.targetId.toLowerCase(), status: r.status } };
    case "verdict": {
      const id = r.decisionId;
      if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return { ok: false, code: "bad_target" };
      if (r.verdict !== "dat" && r.verdict !== "nghi" && r.verdict !== "chan") return { ok: false, code: "bad_verdict" };
      const reason = reasonOf(r.reason, 500);
      if (r.verdict !== "dat" && !reason) return { ok: false, code: "reason_required" };
      return { ok: true, value: { action: "verdict", decisionId: id, verdict: r.verdict, reason } };
    }
    default:
      return { ok: false, code: "bad_action" };
  }
}

/** Máy thu tin chạy 15 phút/lần — im quá 2 giờ là máy GPU tắt / hết hạn mức / khoá lệch (AC16). */
export const NEWS_STALE_MS = 2 * 60 * 60 * 1000;

/**
 * Dòng nhắc đầu tab quản trị Kairos khi lâu không có bài báo mới vào kho. null = ổn.
 * Ngày đầu chưa từng có bài ⇒ nhắc luôn (chưa cài máy thu / chưa đặt khoá).
 */
export function newsStaleText(lastBaoAt: string | null, now: number): string | null {
  if (!lastBaoAt) return "Chưa nhận được bài báo nào. Máy thu tin trên máy GPU đã chạy chưa, khoá nhập tin đã khớp chưa?";
  const t = Date.parse(lastBaoAt);
  if (!Number.isFinite(t)) return null;
  const gap = now - t;
  if (gap < NEWS_STALE_MS) return null;
  const h = Math.floor(gap / (60 * 60 * 1000));
  const khi = h >= 48 ? `${Math.floor(h / 24)} ngày` : `${h} giờ`;
  return `Đã ${khi} không có bài báo mới. Kiểm tra máy thu tin trên máy GPU (đang chạy? hết hạn mức Claude? khoá nhập tin khớp?).`;
}
