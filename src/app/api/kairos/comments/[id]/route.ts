// DELETE /api/kairos/comments/[id] — XOÁ BÌNH LUẬN CỦA MÌNH (14 §3.4, §7, AC10).
// Chỉ chủ bình luận; xoá luôn trả lời con (FK cascade). Đang bị cấm vẫn xoá được của mình.
import { NextResponse } from "next/server";
import { auditQuiet, clientIp, kErr, kairosErrorResponse, requireWriter } from "@/lib/kairos/server";
import { isUuid } from "@/lib/kairos/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(404, "not_found");
  const w = await requireWriter(req, { allowBanned: true });
  if (!w.ok) return w.res;
  const { store, phone } = w;
  try {
    const row = await store.getComment(id.toLowerCase());
    if (!row) return kErr(404, "not_found");
    if (row.author_phone !== phone) return kErr(403, "not_owner");
    await store.deleteComment(row.id);
    await auditQuiet(store, { actor: phone, actor_kind: "ba-con", action: "comment_delete", target_type: "comment", target_id: row.id, detail: { postId: row.post_id }, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
