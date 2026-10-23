// GET /api/admin/kairos/posts?q=  — TÌM BÀI (kể cả bài ẩn) để Ẩn/Hiện (14 §3.11, AC16).
// GET /api/admin/kairos/posts?postId=<uuid> — MỘT bài + MỌI bình luận (kể cả ẩn).
// Quyền kairos:view. Không SĐT.
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { adminComments, adminPosts, kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";
import { isUuid } from "@/lib/kairos/validate";

export async function GET(req: Request) {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  const sp = new URL(req.url).searchParams;
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const postId = sp.get("postId");
    if (postId) {
      if (!isUuid(postId)) return kErr(400, "bad_target");
      const row = await store.getPost(postId.toLowerCase());
      if (!row) return kErr(404, "not_found");
      const [[post], comments] = await Promise.all([adminPosts(store, [row]), store.allComments(row.id, 300).then((c) => adminComments(store, c))]);
      return NextResponse.json({ ok: true, post, comments });
    }
    const q = (sp.get("q") ?? "").slice(0, 80);
    return NextResponse.json({ ok: true, posts: await adminPosts(store, await store.searchPosts(q, 40)) });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
