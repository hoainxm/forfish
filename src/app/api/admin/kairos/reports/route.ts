// GET /api/admin/kairos/reports?status=moi — HÀNG ĐỢI BÁO XẤU (14 §3.11, AC16). Quyền kairos:view.
// Gộp theo đích, xếp theo số người báo (nhiều trước). Không SĐT: người đăng = profileId + tên gọi.
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { adminComments, adminPosts, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function GET(req: Request) {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  const raw = new URL(req.url).searchParams.get("status") ?? "moi";
  if (raw !== "moi" && raw !== "da-an" && raw !== "bo-qua") return kErr(400, "bad_status");
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const rows = await store.listReports(raw, 500);
    const groups = new Map<string, { targetType: "post" | "comment"; targetId: string; count: number; reasons: Record<string, number>; notes: string[]; latestAt: string }>();
    for (const r of rows) {
      const k = `${r.target_type}:${r.target_id}`;
      const g = groups.get(k) ?? { targetType: r.target_type, targetId: r.target_id, count: 0, reasons: {}, notes: [], latestAt: r.created_at };
      g.count++;
      g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
      if (r.note && g.notes.length < 5) g.notes.push(r.note);
      if (r.created_at > g.latestAt) g.latestAt = r.created_at;
      groups.set(k, g);
    }
    const list = [...groups.values()].sort((a, b) => b.count - a.count || (a.latestAt < b.latestAt ? 1 : -1)).slice(0, 100);
    const postIds = list.filter((g) => g.targetType === "post").map((g) => g.targetId);
    const commentIds = list.filter((g) => g.targetType === "comment").map((g) => g.targetId);
    const [posts, comments] = await Promise.all([store.getPosts(postIds), store.getComments(commentIds)]);
    const [pv, cv] = await Promise.all([adminPosts(store, posts), adminComments(store, comments)]);
    const byId = new Map<string, unknown>([...pv.map((p) => [p.id, p] as const), ...cv.map((c) => [c.id, c] as const)]);
    return NextResponse.json({ ok: true, items: list.map((g) => ({ ...g, target: byId.get(g.targetId) ?? null })) });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
