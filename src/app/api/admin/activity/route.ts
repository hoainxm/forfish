// /api/admin/activity — ĐỌC nhật ký hoạt động admin (bảng admin_activity_log,
// 0019). ADMIN-ONLY (chỉ quản trị viên soát được "ai làm gì"). GET trả tối đa
// 300 dòng mới nhất; lọc tuỳ chọn ?actor= (khớp một phần SĐT) & ?action=.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const url = new URL(req.url);
  const actor = url.searchParams.get("actor")?.trim();
  const action = url.searchParams.get("action")?.trim();

  let q = admin
    .from("admin_activity_log")
    .select("id, actor_phone, actor_role, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (actor) q = q.ilike("actor_phone", `%${actor}%`);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  // bảng chưa có (0019 chưa apply) → trả rỗng + cờ để UI nói thật, không đỏ oan
  if (error) return NextResponse.json({ ok: true, events: [], migrationNeeded: true });

  const events = (data ?? []).map((r) => ({
    id: r.id as string,
    actorPhone: r.actor_phone as string,
    actorRole: (r.actor_role as string) ?? "",
    action: r.action as string,
    target: (r.target as string) ?? null,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
  }));
  return NextResponse.json({ ok: true, events });
}
