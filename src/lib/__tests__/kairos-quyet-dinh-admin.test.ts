import { describe, expect, it } from "vitest";
import { ACTION_PERM, BAN_FOREVER_ISO, banUntil, PIN_MAX_MS, validateAdminAction } from "@/lib/kairos/admin-action";
import { agentMayDecide, feedAtOnApprove, MAX_DECISIONS_PER_CALL, reportNeedsCheck, shouldTellAuthor, stateFor, validateAgentBatch } from "@/lib/kairos/quyet-dinh";

/*  Kiểm duyệt (AC16/AC24): agent và người trực dùng CÙNG hàm áp trạng thái; người thắng máy;
    thao tác quản trị kiểm đầu vào + quyền theo việc. */

const ID = "00000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-10-23T08:00:00.000Z");
const batch = (decisions: unknown[]) => ({ rulesVersion: "kd-2026.10.23", model: "claude-haiku-5-5", decisions });

describe("validateAgentBatch", () => {
  it("gói đúng ⇒ chuẩn hoá id thường, điểm làm tròn, bỏ trùng đích", () => {
    const r = validateAgentBatch(batch([
      { targetType: "post", targetId: ID.toUpperCase(), verdict: "chan", reason: "Lừa đảo vay tiền", score: 0.91234 },
      { targetType: "post", targetId: ID, verdict: "dat" },
    ]));
    expect(r.ok && r.value.decisions).toEqual([{ targetType: "post", targetId: ID, verdict: "chan", reason: "Lừa đảo vay tiền", score: 0.912 }]);
  });
  it("nghi/chan bắt buộc lý do; một quyết định hỏng ⇒ cả gói 400", () => {
    expect(validateAgentBatch(batch([{ targetType: "post", targetId: ID, verdict: "nghi" }]))).toEqual({ ok: false, code: "reason_required" });
    expect(validateAgentBatch(batch([{ targetType: "post", targetId: ID, verdict: "dat" }, { targetType: "user", targetId: ID, verdict: "dat" }]))).toEqual({ ok: false, code: "bad_decision" });
    expect(validateAgentBatch(batch([{ targetType: "post", targetId: ID, verdict: "dat", score: 1.5 }]))).toEqual({ ok: false, code: "bad_decision" });
  });
  it("thiếu phiên bản luật / mô hình / rỗng / quá 100 ⇒ 400", () => {
    expect(validateAgentBatch({ model: "m", decisions: [] }).ok).toBe(false);
    expect(validateAgentBatch({ ...batch([]), rulesVersion: "có khoảng trắng" })).toEqual({ ok: false, code: "bad_rules_version" });
    expect(validateAgentBatch(batch([]))).toEqual({ ok: false, code: "no_decisions" });
    const many = Array.from({ length: MAX_DECISIONS_PER_CALL + 1 }, () => ({ targetType: "post", targetId: ID, verdict: "dat" }));
    expect(validateAgentBatch(batch(many))).toEqual({ ok: false, code: "too_many" });
  });
});

describe("stateFor — một bảng cho agent và người trực", () => {
  it("chan ⇒ ẩn (bài có lý do, bình luận không có cột lý do)", () => {
    expect(stateFor("chan", "agent", true, "Bậy bạ")).toEqual({ mod_state: "chan", hidden: true, hidden_reason: "Bậy bạ" });
    expect(stateFor("chan", "agent", false, "x")).toEqual({ mod_state: "chan", hidden: true });
  });
  it("agent đạt KHÔNG mở bài đang ẩn; người trực đạt thì mở", () => {
    expect(stateFor("dat", "agent", true, null)).toEqual({ mod_state: "dat" });
    expect(stateFor("dat", "staff", true, null)).toEqual({ mod_state: "dat", hidden: false, hidden_reason: null });
  });
  it("nghi chỉ đổi trạng thái (bài bà con vẫn hiện, bài báo chưa lên)", () => {
    expect(stateFor("nghi", "agent", true, "x")).toEqual({ mod_state: "nghi" });
  });
  it("bài báo lần đầu được đạt ⇒ feed_at = lúc duyệt; đã đạt / bài bà con / phán khác ⇒ không đổi", () => {
    const t = "2026-10-23T08:00:00.000Z";
    expect(feedAtOnApprove({ kind: "bao", mod_state: "cho-kiem" }, "dat", t)).toEqual({ feed_at: t });
    expect(feedAtOnApprove({ kind: "bao", mod_state: "nghi" }, "dat", t)).toEqual({ feed_at: t });
    // thông báo nhà nước: feed_at = ngày ban hành (không quá lúc duyệt) ⇒ tab Chính sách xếp theo ngày văn bản
    expect(feedAtOnApprove({ kind: "bao", mod_state: "cho-kiem", topic: "chinh-sach", published_at: "2026-09-14T01:00:00.000Z" }, "dat", t)).toEqual({ feed_at: "2026-09-14T01:00:00.000Z" });
    expect(feedAtOnApprove({ kind: "bao", mod_state: "cho-kiem", topic: "chinh-sach", published_at: "2999-01-01T00:00:00.000Z" }, "dat", t)).toEqual({ feed_at: t });
    expect(feedAtOnApprove({ kind: "bao", mod_state: "dat" }, "dat", t)).toEqual({});
    expect(feedAtOnApprove({ kind: "bao", mod_state: "cho-kiem" }, "nghi", t)).toEqual({});
    expect(feedAtOnApprove({ kind: "ba-con", mod_state: "cho-kiem" }, "dat", t)).toEqual({});
  });
  it("người trực đã quyết ⇒ agent không đè", () => {
    expect(agentMayDecide(null)).toBe(true);
    expect(agentMayDecide({ decided_by: "agent" })).toBe(true);
    expect(agentMayDecide({ decided_by: "staff" })).toBe(false);
  });
  it("chỉ báo người đăng khi AGENT tự ẩn bài/bình luận bà con", () => {
    expect(shouldTellAuthor("chan", "agent", "ba-con")).toBe(true);
    expect(shouldTellAuthor("chan", "agent", "bao")).toBe(false);
    expect(shouldTellAuthor("chan", "staff", "ba-con")).toBe(false);
    expect(shouldTellAuthor("nghi", "agent", "ba-con")).toBe(false);
  });
});

describe("validateAdminAction", () => {
  it("quyền theo việc: cấm = delete, còn lại = edit", () => {
    expect(ACTION_PERM.ban).toBe("delete");
    expect(ACTION_PERM.unban).toBe("delete");
    expect(ACTION_PERM.hide).toBe("edit");
    expect(ACTION_PERM.verdict).toBe("edit");
  });
  it("ẩn/hiện cần đích hợp lệ", () => {
    expect(validateAdminAction({ action: "hide", targetType: "post", targetId: ID, reason: "  Lừa đảo  " }, NOW)).toEqual({
      ok: true, value: { action: "hide", targetType: "post", targetId: ID, reason: "Lừa đảo" },
    });
    expect(validateAdminAction({ action: "hide", targetType: "user", targetId: ID }, NOW)).toEqual({ ok: false, code: "bad_target" });
  });
  it("cấm: 7d / 30d / vĩnh viễn + lý do bắt buộc", () => {
    expect(banUntil("7d", NOW)).toBe(new Date(NOW + 7 * 864e5).toISOString());
    expect(banUntil("forever", NOW)).toBe(BAN_FOREVER_ISO);
    expect(banUntil("1y", NOW)).toBeNull();
    expect(validateAdminAction({ action: "ban", profileId: ID, until: "30d" }, NOW)).toEqual({ ok: false, code: "reason_required" });
    const r = validateAdminAction({ action: "ban", profileId: ID, until: "30d", reason: "Lừa đảo" }, NOW);
    expect(r.ok && r.value).toMatchObject({ action: "ban", reason: "Lừa đảo" });
  });
  it("ghim: tương lai, tối đa 30 ngày", () => {
    expect(validateAdminAction({ action: "pin", postId: ID, until: new Date(NOW - 1).toISOString() }, NOW)).toEqual({ ok: false, code: "bad_until" });
    expect(validateAdminAction({ action: "pin", postId: ID, until: new Date(NOW + PIN_MAX_MS + 1).toISOString() }, NOW)).toEqual({ ok: false, code: "bad_until" });
    expect(validateAdminAction({ action: "pin", postId: ID, until: new Date(NOW + 864e5).toISOString() }, NOW).ok).toBe(true);
  });
  it("đảo quyết định agent: id số dương, nghi/chan cần lý do; việc lạ ⇒ 400", () => {
    expect(validateAdminAction({ action: "verdict", decisionId: 3, verdict: "dat" }, NOW).ok).toBe(true);
    expect(validateAdminAction({ action: "verdict", decisionId: 3, verdict: "chan" }, NOW)).toEqual({ ok: false, code: "reason_required" });
    expect(validateAdminAction({ action: "verdict", decisionId: -1, verdict: "dat" }, NOW)).toEqual({ ok: false, code: "bad_target" });
    expect(validateAdminAction({ action: "drop_table" }, NOW)).toEqual({ ok: false, code: "bad_action" });
    expect(validateAdminAction({ action: "resolve", targetType: "comment", targetId: ID, status: "xong" }, NOW)).toEqual({ ok: false, code: "bad_status" });
  });
});

describe("reportNeedsCheck", () => {
  it("chưa chấm lần nào ⇒ chấm; báo cũ hơn lần chấm ⇒ thôi; có báo mới hơn ⇒ chấm lại", () => {
    expect(reportNeedsCheck([], null)).toBe(false);
    expect(reportNeedsCheck(["2026-10-23T08:00:00.000Z"], null)).toBe(true);
    expect(reportNeedsCheck(["2026-10-23T08:00:00.000Z"], "2026-10-23T08:05:00.000Z")).toBe(false);
    expect(reportNeedsCheck(["2026-10-23T08:00:00.000Z", "2026-10-23T08:06:00.000Z"], "2026-10-23T08:05:00.000Z")).toBe(true);
    expect(reportNeedsCheck(["2026-10-23T08:00:00.000Z"], "hỏng")).toBe(true);
  });
});
