// /api/admin/activity — ĐỌC nhật ký hoạt động admin (bảng admin_activity_log,
// 0019). ADMIN-ONLY (chỉ quản trị viên soát được "ai làm gì"). GET trả tối đa
// 300 dòng mới nhất; lọc tuỳ chọn ?actor= (khớp một phần SĐT) & ?action=.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";

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
  // ĐỌC hỏng → trả rỗng + cờ để UI nói thật, KÈM mã lỗi thật (trước chỉ nói
  // "chưa apply migration" cho mọi loại lỗi — sai hướng khi bảng đã có mà lỗi
  // vì lý do khác, 2026-07-31)
  if (error)
    return NextResponse.json({
      ok: true,
      events: [],
      migrationNeeded: true,
      error: { code: error.code, message: error.message, hint: error.hint },
    });

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

/**
 * POST — GHI THỬ một dòng nhật ký ("system.log-probe") rồi đọc lại.
 * Vì sao cần: ghi log là fire-and-forget nên khi nhật ký câm, không có cách
 * nào biết vì sao mà không đợi một thao tác thật (2026-07-31: prod có 2 lần
 * cấp premium mà bảng vẫn rỗng). Nút này cho quản trị viên tự kiểm tra ngay và
 * thấy MÃ LỖI THẬT nếu ghi hỏng. Bản thân lần ghi thử cũng là một dòng nhật ký
 * đàng hoàng (ai bấm, lúc nào) — không giấu.
 */
export async function POST() {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const wrote = await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: "admin",
    action: "system.log-probe",
    target: null,
    detail: { note: "kiểm tra ghi nhật ký từ tab Nhật ký" },
  });
  if (!wrote)
    return NextResponse.json({
      ok: true,
      wrote: false,
      // chi tiết mã lỗi nằm ở Vercel runtime logs (console.error trong
      // logActivity) — ở đây đọc lại để phân biệt "ghi hỏng" vs "đọc hỏng"
      readBack: null,
    });

  const { count, error } = await admin
    .from("admin_activity_log")
    .select("id", { count: "exact", head: true });
  return NextResponse.json({
    ok: true,
    wrote: true,
    readBack: error ? null : (count ?? null),
  });
}
