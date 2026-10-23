// /api/kairos/posts/[id]/comments — BÌNH LUẬN DƯỚI MỌI BÀI, kể cả bài báo (14 §3.4, AC10).
//
// GET  khách đọc: trang 30 theo (created_at, id) tăng dần, con trỏ `next`; bỏ người mình chặn.
// POST SĐT + đã đồng ý nội quy: ≤1.000 ký tự, chữ bậy/chủ quyền ⇒ 400, 60/ngày ⇒ 429. Trả lời
//      đúng 1 cấp: trả lời một trả lời ⇒ gắn vào bình luận GỐC (replyRoot; trigger 0065 là lưới
//      cuối). Báo chủ bài + người được trả lời, gộp 1 tin/bài/giờ, không tự báo mình.
import { NextResponse } from "next/server";
import { decodeCursor, encodeCursor } from "@/lib/kairos/cursor";
import {
  auditQuiet, clientIp, hydrateComments, jsonBody, kErr, kairosErrorResponse, notifyComment, postVisible, rateDenied, readerOf,
  requireWriter, storeOr503,
} from "@/lib/kairos/server";
import { LIMITS } from "@/lib/kairos/types";
import { isUuid, replyRoot, validateComment } from "@/lib/kairos/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "gone");
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const blocked = who.phone ? await store.edgesFrom("block", who.phone) : [];
    const post = await store.getPost(id.toLowerCase());
    if (!postVisible(post, who.phone, blocked)) return kErr(404, "gone");
    const cursor = decodeCursor(new URL(req.url).searchParams.get("cursor"));
    const rows = await store.listComments(post.id, cursor, LIMITS.commentPageSize + 1, blocked);
    const page = rows.slice(0, LIMITS.commentPageSize);
    const last = page[page.length - 1];
    const next = rows.length > LIMITS.commentPageSize && last ? encodeCursor({ at: last.created_at, id: last.id }) : null;
    return NextResponse.json({ ok: true, comments: await hydrateComments(store, page, who.phone), next });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "gone");
  const w = await requireWriter(req, { rules: true });
  if (!w.ok) return w.res;
  const { store, phone, profile } = w;
  const body = await jsonBody(req);
  const v = validateComment(body);
  if (!v.ok) return kErr(400, v.code);
  try {
    const limited = await rateDenied(store, "comments", phone);
    if (limited) return limited;
    const blocked = await store.edgesFrom("block", phone);
    const post = await store.getPost(id.toLowerCase());
    if (!postVisible(post, phone, blocked)) return kErr(404, "gone");

    let parentId: string | null = null;
    let parentAuthor: string | null = null;
    if (v.value.parentId) {
      const target = await store.getComment(v.value.parentId.toLowerCase());
      if (!target || target.hidden || target.post_id !== post.id) return kErr(404, "comment_gone");
      parentId = replyRoot({ id: target.id, parentId: target.parent_id });
      parentAuthor = target.author_phone; // báo đúng người được trả lời
    }
    const row = await store.insertComment({ post_id: post.id, parent_id: parentId, author_phone: phone, body: v.value.body });
    await auditQuiet(store, { actor: phone, actor_kind: "ba-con", action: "comment_create", target_type: "comment", target_id: row.id, detail: { postId: post.id, parentId }, ip: clientIp(req) });
    await notifyComment(store, { post, parentAuthor, commenter: phone, commenterHandle: profile.handle });
    const [comment] = await hydrateComments(store, [row], phone);
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
