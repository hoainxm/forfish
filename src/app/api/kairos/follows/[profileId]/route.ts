// /api/kairos/follows/[profileId] — THEO DÕI MỘT CHIỀU, không cần duyệt (14 §3.8, §3.10, §7, AC13).
// PUT = bật, DELETE = bỏ. `profileId` = id công khai (uuid) — không bao giờ SĐT. Idempotent (PK cặp).
// 100 theo dõi + chặn/ngày (A1).
import { edgeToggle } from "@/lib/kairos/server";

type Ctx = { params: Promise<{ profileId: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  return edgeToggle(req, "follow", profileId, true);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { profileId } = await ctx.params;
  return edgeToggle(req, "follow", profileId, false);
}
