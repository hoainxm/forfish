// PUT /api/kairos/comments/[id]/hay — Hay (một kiểu) bật/tắt, idempotent (14 §7, AC09). Luật ở lib/kairos/server hayToggle.
import { hayToggle } from "@/lib/kairos/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return hayToggle(req, "comment", id);
}
