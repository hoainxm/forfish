// /api/admin/product-inquiries — QUẢN LÝ yêu cầu hỏi mua/tư vấn từ danh mục
// sản phẩm (2026-07-28, Phase 2). GET danh sách theo status · PATCH đổi
// trạng thái/ghi chú (ghi handled_by/handled_at) · DELETE xóa hẳn (dọn
// spam/trùng). ADMIN-ONLY CỨNG (2026-07-30 phân quyền): tab Yêu cầu không nằm
// trong 5 tab cấu hình được cho quản lý → requireAdmin mọi method.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const STATUSES = ["moi", "da_lien_he", "xong"] as const;

export async function GET(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const statusParam = new URL(req.url).searchParams.get("status") ?? "moi";
  let q = admin
    .from("product_inquiries")
    .select(
      "id,listing_id,listing_title,vendor_kind,customer_phone,customer_name,message,status,created_at,handled_by,handled_at,note",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (statusParam !== "all") {
    const s = (STATUSES as readonly string[]).includes(statusParam)
      ? statusParam
      : "moi";
    q = q.eq("status", s);
  }
  const { data, error } = await q;
  if (error) return err(500, "query_failed");

  return NextResponse.json({ ok: true, me: who, inquiries: data ?? [] });
}

export async function PATCH(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    status?: string;
    note?: string;
  } | null;
  if (!body?.id) return err(400, "bad_id");

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(body.status))
      return err(400, "bad_status");
    patch.status = body.status;
    patch.handled_by = who.phone;
    patch.handled_at = new Date().toISOString();
  }
  if (body.note !== undefined) patch.note = body.note.trim() || null;
  if (Object.keys(patch).length === 0) return err(400, "nothing_to_update");

  const { data, error } = await admin
    .from("product_inquiries")
    .update(patch)
    .eq("id", body.id)
    .select("id");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err(400, "bad_id");

  const { data, error } = await admin
    .from("product_inquiries")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}
