// /api/me/market-listings/[id] — ĐÓNG/MỞ LẠI và XOÁ tin của CHÍNH mình.
// Chủ tin = `owner_phone` (device token, 0035). Điều kiện chủ tin nằm NGAY
// TRONG câu lệnh ghi (`.eq("owner_phone", …)` + `.select`), không kiểm ở JS rồi
// ghi mù — cùng khuôn CAS với `/api/me/orders/[id]/cancel`.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityFromRequest } from "@/lib/api-identity";

type Ctx = { params: Promise<{ id: string }> };

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const { id } = await params;
  if (!id) return err(400, "bad_id");

  const body = (await req.json().catch(() => null)) as {
    status?: string;
  } | null;
  const status = body?.status;
  if (status !== "open" && status !== "closed") return err(400, "bad_status");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("market_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_phone", who.phone)
    .select("id");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const { id } = await params;
  if (!id) return err(400, "bad_id");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("market_listings")
    .delete()
    .eq("id", id)
    .eq("owner_phone", who.phone)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  return NextResponse.json({ ok: true });
}
