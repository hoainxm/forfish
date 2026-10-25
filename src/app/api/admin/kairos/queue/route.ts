// GET /api/admin/kairos/queue — HÀNG CHỜ NGƯỜI TRỰC: những gì AGENT kiểm duyệt chặn hoặc nghi
// (kèm lý do + điểm + phiên bản luật + mô hình), để đảo lại (14 A17, AC16/AC24). Quyền kairos:view.
// Chỉ giữ quyết định agent còn HIỆU LỰC (chưa bị người trực / lượt agent sau thay).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { adminComments, adminPosts, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function GET() {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const flagged = await store.agentFlagged(200);
    const postIds = flagged.filter((d) => d.target_type === "post").map((d) => d.target_id);
    const commentIds = flagged.filter((d) => d.target_type === "comment").map((d) => d.target_id);
    const [latestP, latestC, posts, comments] = await Promise.all([
      store.latestDecisions("post", postIds),
      store.latestDecisions("comment", commentIds),
      store.getPosts(postIds),
      store.getComments(commentIds),
    ]);
    const live = flagged.filter((d) => (d.target_type === "post" ? latestP : latestC).get(d.target_id)?.id === d.id).slice(0, 100);
    const [pv, cv] = await Promise.all([adminPosts(store, posts), adminComments(store, comments)]);
    const byId = new Map<string, unknown>([...pv.map((p) => [p.id, p] as const), ...cv.map((c) => [c.id, c] as const)]);
    return NextResponse.json({
      ok: true,
      items: live.map((d) => ({
        decisionId: d.id, targetType: d.target_type, targetId: d.target_id, verdict: d.verdict, reason: d.reason, score: d.score,
        rulesVersion: d.rules_version, model: d.model, at: d.created_at, target: byId.get(d.target_id) ?? null,
      })),
    });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
