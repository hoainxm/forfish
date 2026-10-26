// KAIROS — ÁP QUYẾT ĐỊNH KIỂM DUYỆT (14 A17, AC16/AC24). THUẦN.
//
// Bộ LUẬT chấm (prompt, cách đọc JSON của agent) ở lib/kairos/luat-kiem-duyet; file này chỉ là
// phía MÁY CHỦ: kiểm gói quyết định agent gửi lên /api/kairos/kiem, và đổi một phán quyết
// thành trạng thái bài/bình luận. Cùng một hàm cho agent và người trực ⇒ hai bên không lệch.
//
//   đích              | dat                     | nghi                         | chan
//   bài báo           | lên dòng tin            | KHÔNG lên, vào hàng chờ      | ẩn
//   bà con/Chính thức | giữ hiện                | vẫn hiện, vào hàng chờ       | ẩn + báo người đăng lý do
//   người trực đảo    | dat ⇒ HIỆN lại (bỏ ẩn)  | nghi ⇒ như trên              | chan ⇒ ẩn
// Người trực đã quyết thì agent KHÔNG đè (`agentMayDecide`) — người thắng máy.

import { isUuid } from "./validate";
import type { ModState, TargetType } from "./store";

export type Verdict = "dat" | "nghi" | "chan";
export const MAX_DECISIONS_PER_CALL = 100;

export interface AgentDecision {
  targetType: TargetType;
  targetId: string;
  verdict: Verdict;
  reason: string | null;
  score: number | null;
}

export interface AgentBatch {
  rulesVersion: string;
  model: string;
  decisions: AgentDecision[];
}

const VERDICTS = new Set<string>(["dat", "nghi", "chan"]);
const SHORT = /^[\p{L}\p{N}._:+-]{1,40}$/u;

const cut = (s: unknown, n: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return t ? [...t].slice(0, n).join("") : null;
};

/** Gói agent gửi. Một quyết định hỏng ⇒ CẢ GÓI 400 (agent sửa rồi gửi lại, không áp nửa vời). */
export function validateAgentBatch(raw: unknown): { ok: true; value: AgentBatch } | { ok: false; code: string } {
  if (!raw || typeof raw !== "object") return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  if (typeof r.rulesVersion !== "string" || !SHORT.test(r.rulesVersion)) return { ok: false, code: "bad_rules_version" };
  if (typeof r.model !== "string" || !SHORT.test(r.model)) return { ok: false, code: "bad_model" };
  if (!Array.isArray(r.decisions) || r.decisions.length === 0) return { ok: false, code: "no_decisions" };
  if (r.decisions.length > MAX_DECISIONS_PER_CALL) return { ok: false, code: "too_many" };
  const decisions: AgentDecision[] = [];
  const seen = new Set<string>();
  for (const d of r.decisions as unknown[]) {
    if (!d || typeof d !== "object") return { ok: false, code: "bad_decision" };
    const x = d as Record<string, unknown>;
    if (x.targetType !== "post" && x.targetType !== "comment") return { ok: false, code: "bad_decision" };
    if (!isUuid(x.targetId)) return { ok: false, code: "bad_decision" };
    if (typeof x.verdict !== "string" || !VERDICTS.has(x.verdict)) return { ok: false, code: "bad_decision" };
    let score: number | null = null;
    if (x.score != null) {
      if (typeof x.score !== "number" || !Number.isFinite(x.score) || x.score < 0 || x.score > 1) return { ok: false, code: "bad_decision" };
      score = Math.round(x.score * 1000) / 1000;
    }
    const reason = cut(x.reason, 500);
    // nghi/chan PHẢI có lý do — người trực và người đăng cần biết vì sao
    if (x.verdict !== "dat" && !reason) return { ok: false, code: "reason_required" };
    const key = `${x.targetType}:${(x.targetId as string).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decisions.push({ targetType: x.targetType, targetId: (x.targetId as string).toLowerCase(), verdict: x.verdict as Verdict, reason, score });
  }
  return { ok: true, value: { rulesVersion: r.rulesVersion, model: r.model, decisions } };
}

export interface StatePatch {
  mod_state: ModState;
  /** undefined = không đổi cờ ẩn */
  hidden?: boolean;
  hidden_reason?: string | null;
}

/**
 * Phán quyết ⇒ trạng thái mới. `isPost` + `kind` để biết có cột hidden_reason không (bình luận
 * không có). Agent `dat` KHÔNG bỏ ẩn (bài bị ẩn vì ≥5 báo xấu hay người trực ẩn thì máy không
 * tự mở lại); người trực `dat` thì mở.
 */
export function stateFor(v: Verdict, by: "agent" | "staff", isPost: boolean, reason: string | null): StatePatch {
  if (v === "chan") return isPost ? { mod_state: "chan", hidden: true, hidden_reason: reason?.slice(0, 300) ?? "Vi phạm nội quy" } : { mod_state: "chan", hidden: true };
  if (v === "dat" && by === "staff") return isPost ? { mod_state: "dat", hidden: false, hidden_reason: null } : { mod_state: "dat", hidden: false };
  return { mod_state: v };
}

/**
 * Bài báo chỉ LÊN dòng tin khi được cho `dat` — giờ báo đăng (`published_at`) có thể cũ hơn nhiều.
 * Lần đầu sang `dat` ⇒ đặt `feed_at` = lúc duyệt, để bài nằm đầu dòng tin và được đếm trong
 * "Có N bài mới" (lọc `feed_at > since`). Đã `dat` từ trước (người trực xác nhận lại) ⇒ không đổi,
 * khỏi đẩy bài cũ lên lại. Bài bà con/Chính thức hiện ngay lúc đăng ⇒ không đụng.
 * THÔNG BÁO NHÀ NƯỚC (topic chinh-sach, 14 §21): `feed_at` = NGÀY BAN HÀNH (không quá lúc duyệt) — tab Chính sách xếp văn
 * bản mới nhất lên đầu, không theo giờ máy thu nạp (anh Long 2026-10-26: quyết định hỗ trợ dầu nằm trang 3 vì nạp trước).
 */
export function feedAtOnApprove(
  prev: { kind: string; mod_state: ModState; topic?: string; published_at?: string },
  v: Verdict,
  nowIso: string,
): { feed_at?: string } {
  if (!(prev.kind === "bao" && v === "dat" && prev.mod_state !== "dat")) return {};
  const pub = prev.topic === "chinh-sach" && prev.published_at ? Date.parse(prev.published_at) : NaN;
  return { feed_at: Number.isFinite(pub) && pub < Date.parse(nowIso) ? new Date(pub).toISOString() : nowIso };
}

/** Agent chỉ được quyết khi người trực CHƯA quyết đích này. */
export function agentMayDecide(latest: { decided_by: "agent" | "staff" } | null | undefined): boolean {
  return latest?.decided_by !== "staff";
}

/** Agent tự ẩn bài/bình luận của BÀ CON ⇒ báo người đăng lý do (AC24b). Bài báo không có người đăng. */
export function shouldTellAuthor(v: Verdict, by: "agent" | "staff", kind: string | null): boolean {
  return v === "chan" && by === "agent" && kind !== "bao";
}

/**
 * Đích bị báo xấu có cần agent chấm (lại) không: chỉ khi có báo xấu MỚI HƠN lần chấm cuối
 * (`mod_checked_at`). Không có cổng này thì đích agent cho `dat`/`nghi` (báo vẫn `moi`, chờ
 * người trực) bị gửi lên Claude mỗi 5 phút mãi — đốt hạn mức gói, phình kairos_mod_decisions.
 */
export function reportNeedsCheck(reportTimes: readonly string[], modCheckedAt: string | null): boolean {
  if (!reportTimes.length) return false;
  if (!modCheckedAt) return true;
  const checked = Date.parse(modCheckedAt);
  if (!Number.isFinite(checked)) return true;
  return reportTimes.some((t) => Date.parse(t) > checked);
}
