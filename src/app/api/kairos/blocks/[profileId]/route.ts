// /api/kairos/blocks/[profileId] — CHẶN NGƯỜI (14 §3.8, §3.10, §7, AC15).
// PUT = bật, DELETE = bỏ. `profileId` = id công khai (uuid) — không bao giờ SĐT. Idempotent (PK cặp).
// 100 theo dõi + chặn/ngày (A1).
// Chặn ⇒ máy chủ ẩn mọi bài + bình luận của họ với mình, và bỏ theo dõi HAI chiều.
import { edgeToggle } from "@/lib/kairos/server";

type Ctx = { params: Promise<{ profileId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  return edgeToggle(req, "block", profileId, true);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  return edgeToggle(req, "block", profileId, false);
}
