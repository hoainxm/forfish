// SDFish — NV7 (ba-spec 10): XEM NHẬT KÝ HOẠT ĐỘNG QUẢN TRỊ. Chỉ ADMIN (trace
// hoạt động tài khoản quản trị — chủ dự án Long). Ghi log do các route /api/admin/*
// tự bơm qua writeAudit (bảng admin_audit, 0027). Lọc tuỳ chọn theo actor/target.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeVnPhone } from "@/lib/phone";

export async function GET(req: Request) {
  const who = await requireAdmin();
  if (!who.ok)
    return NextResponse.json({ ok: false, code: who.code }, { status: who.status });
  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });

  const url = new URL(req.url);
  const actor = url.searchParams.get("actor");
  const target = url.searchParams.get("target");

  let q = admin
    .from("admin_audit")
    .select("id, actor, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (actor) q = q.eq("actor", normalizeVnPhone(actor));
  if (target) q = q.eq("target", normalizeVnPhone(target));

  const { data, error } = await q;
  if (error) {
    // bảng admin_audit chưa có (0027 chưa apply) → trả rỗng, không lỗi
    return NextResponse.json({ ok: true, rows: [], note: "no_table" });
  }
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
