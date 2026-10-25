// POST /api/admin/kairos/action — THAO TÁC NGƯỜI TRỰC (14 §3.11, §7, AC16).
// { action: hide|unhide|ban|unban|pin|unpin|resolve|verdict, … } — kiểm ở admin-action.ts.
// Quyền tab kairos theo việc (ACTION_PERM: edit = ẩn/hiện/ghim/xử lý/đảo quyết định; delete =
// cấm). NHẬT KÝ TRƯỚC, việc sau: không ghi được nhật ký (giữ 2 năm, NĐ 147) ⇒ 503, KHÔNG làm.
// Ẩn/hiện + đảo quyết định đi qua applyDecision (ghi kairos_mod_decisions decided_by='staff')
// ⇒ agent không đè lại quyết định của người.
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { ACTION_PERM, validateAdminAction } from "@/lib/kairos/admin-action";
import { applyDecision, clientIp, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function POST(req: Request) {
  const raw = await jsonBody(req);
  const now = Date.now();
  const v = validateAdminAction(raw, now);
  if (!v.ok) return kErr(400, v.code);
  const a = v.value;
  const who = await requirePermission("kairos", ACTION_PERM[a.action]);
  if (!who.ok) return kErr(who.status, who.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  const actor = `staff:${who.phone}`;
  const nowIso = new Date(now).toISOString();
  try {
    // Đích phải có thật trước khi ghi nhật ký
    let target: { type: string; id: string } | null = null;
    let decision: Awaited<ReturnType<typeof store.getDecision>> = null;
    let banPhone: string | null = null;
    switch (a.action) {
      case "hide":
      case "unhide":
      case "resolve": {
        const t = a.targetType === "post" ? await store.getPost(a.targetId) : await store.getComment(a.targetId);
        if (!t) return kErr(404, "not_found");
        target = { type: a.targetType, id: a.targetId };
        break;
      }
      case "ban":
      case "unban": {
        const p = await store.profileById(a.profileId);
        if (!p) return kErr(404, "not_found");
        if (p.official) return kErr(400, "official");
        banPhone = p.phone;
        target = { type: "profile", id: a.profileId };
        break;
      }
      case "pin":
      case "unpin": {
        const p = await store.getPost(a.postId);
        if (!p) return kErr(404, "not_found");
        if (p.kind !== "chinh-thuc") return kErr(400, "not_official");
        target = { type: "post", id: a.postId };
        break;
      }
      case "verdict": {
        decision = await store.getDecision(a.decisionId);
        if (!decision) return kErr(404, "not_found");
        target = { type: decision.target_type, id: decision.target_id };
        break;
      }
    }

    try {
      await store.audit({ actor, actor_kind: "staff", action: `admin_${a.action}`, target_type: target.type, target_id: target.id, detail: { ...a }, ip: clientIp(req) });
    } catch {
      return kErr(503, "audit_failed");
    }

    switch (a.action) {
      case "hide":
      case "unhide":
        await applyDecision(store, {
          targetType: a.targetType, targetId: a.targetId, verdict: a.action === "hide" ? "chan" : "dat", reason: a.reason,
          score: null, by: "staff", actor, rulesVersion: null, model: null, overrides: null,
        });
        break;
      case "verdict":
        await applyDecision(store, {
          targetType: decision!.target_type, targetId: decision!.target_id, verdict: a.verdict, reason: a.reason, score: null,
          by: "staff", actor, rulesVersion: decision!.rules_version, model: null, overrides: decision!.id,
        });
        break;
      case "resolve":
        await store.resolveReports(a.targetType, a.targetId, a.status, actor, nowIso);
        break;
      case "ban":
        await store.updateProfile(banPhone!, { banned_until: a.until, ban_reason: a.reason });
        break;
      case "unban":
        await store.updateProfile(banPhone!, { banned_until: null, ban_reason: null });
        break;
      case "pin":
        await store.updatePost(a.postId, { pinned_until: a.until });
        break;
      case "unpin":
        await store.updatePost(a.postId, { pinned_until: null });
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
