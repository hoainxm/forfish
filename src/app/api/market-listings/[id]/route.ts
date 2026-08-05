// /api/market-listings/[id] — SỬA TRẠNG THÁI / XOÁ một tin của CHÍNH MÌNH.
//
// Chủ tin theo SĐT (owner_phone, 0043). Server-role bỏ qua RLS nên quyền sở hữu
// phải TỰ CHỐT ở đây: mọi lệnh đều `.eq("owner_phone", ownerPhone)` — không ai
// sửa/xoá được tin người khác dù đoán trúng id. Xem docs/app-map/02-architecture.md.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";

const TABLE = "market_listings";
const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const ownerPhone = normalizeVnPhone(who.phone);
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status;
  if (status !== "open" && status !== "closed") return err(400, "bad_status");

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { data, error } = await admin
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_phone", ownerPhone)
    .select("id");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const ownerPhone = normalizeVnPhone(who.phone);
  const { id } = await ctx.params;

  const admin = createAdminClient();
  if (!admin) return err(503, "unavailable");

  const { data, error } = await admin
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("owner_phone", ownerPhone)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}
