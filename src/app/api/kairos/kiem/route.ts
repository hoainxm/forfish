// /api/kairos/kiem — CỬA CỦA AGENT KIỂM DUYỆT (scripts/kairos-kiem.mjs trên gpu-desktop, gói
// Claude) (14 A17, AC24, AC21). Cùng khoá `x-kairos-key` với /nhap (thiếu khoá ⇒ 503, sai ⇒ 401).
//
// GET  ?limit=  hàng chờ: bài + bình luận `cho-kiem` (cũ trước) + mọi đích có báo xấu mới.
//      CHỈ nội dung cần chấm — KHÔNG SĐT, không tên người (agent không cần biết ai).
// POST { rulesVersion, model, decisions: [{ targetType, targetId, verdict: dat|nghi|chan,
//        reason?, score? (0..1) }] } ≤100 — nghi/chan bắt buộc có lý do. Một quyết định hỏng ⇒ cả
//      gói 400. Áp bằng applyDecision: agent KHÔNG đè người trực; bài báo chỉ lên khi `dat`;
//      `chan` bài bà con ⇒ tự ẩn + báo người đăng lý do + nhật ký.
// DELETE ?scope=media  dọn ảnh mồ côi kairos-media (>24 giờ, không thuộc bài nào / không là ảnh
//      đại diện — server.gcOrphanMedia). Agent gọi cuối mỗi lượt; không cần Claude.
// Hết hạn mức / agent lỗi ⇒ agent không gửi gì ⇒ bài báo nằm lại hàng chờ (không tự lên), bài
// bà con vẫn hiện.
import { NextResponse } from "next/server";
import { validateAgentBatch } from "@/lib/kairos/quyet-dinh";
import { applyDecision, gcOrphanMedia, ingestKeyDenied, jsonBody, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";
import type { CommentFull, PostFull } from "@/lib/kairos/store";

const postForAgent = (p: PostFull, reasons: Record<string, string[]>) => ({
  id: p.id, kind: p.kind, outlet: p.outlet, url: p.url, title: p.title, summary: p.summary, body: p.body,
  topic: p.topic, imageCount: Array.isArray(p.images) ? p.images.length : 0, modState: p.mod_state, hidden: p.hidden,
  reports: reasons[`post:${p.id}`] ?? [], createdAt: p.created_at,
});
const commentForAgent = (c: CommentFull, reasons: Record<string, string[]>) => ({
  id: c.id, postId: c.post_id, parentId: c.parent_id, body: c.body, modState: c.mod_state, hidden: c.hidden,
  reports: reasons[`comment:${c.id}`] ?? [], createdAt: c.created_at,
});

export async function GET(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const raw = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 100) : 50;
  try {
    const [q, open] = await Promise.all([s.store.modQueue(limit), s.store.listReports("moi", 500)]);
    const reasons: Record<string, string[]> = {};
    for (const r of open) (reasons[`${r.target_type}:${r.target_id}`] ??= []).push(r.note ? `${r.reason}: ${r.note}` : r.reason);
    return NextResponse.json({
      ok: true,
      posts: [...q.posts, ...q.reportedPosts].map((p) => postForAgent(p, reasons)),
      comments: [...q.comments, ...q.reportedComments].map((c) => commentForAgent(c, reasons)),
    });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const v = validateAgentBatch(await jsonBody(req));
  if (!v.ok) return kErr(400, v.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const tally = { applied: 0, skipped: 0, missing: 0 };
  try {
    for (const d of v.value.decisions) {
      const r = await applyDecision(s.store, {
        ...d, by: "agent", actor: "agent", rulesVersion: v.value.rulesVersion, model: v.value.model, overrides: null,
      });
      tally[r]++;
    }
    return NextResponse.json({ ok: true, ...tally });
  } catch (e) {
    // gói áp dở dang: phần đã áp giữ nguyên (mỗi quyết định độc lập), agent gửi lại phần còn lại
    console.error("[kairos] áp quyết định agent dừng giữa chừng:", tally);
    return kairosErrorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  if (new URL(req.url).searchParams.get("scope") !== "media") return kErr(400, "bad_scope");
  const s = await storeOr503();
  if (!s.ok) return s.res;
  try {
    return NextResponse.json({ ok: true, ...(await gcOrphanMedia(s.store)) });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
