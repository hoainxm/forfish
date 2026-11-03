// /api/admin/vua-profiles — HÀNG DUYỆT HỒ SƠ VỰA (spec 17 §12.4 + §12.6), khuôn duyệt gian hàng.
//
// GET ?status=cho_duyet|hoat_dong|tu_choi|tam_khoa (mặc định cho_duyet): danh sách, kèm SĐT chủ (nhân viên cần gọi).
// PATCH { phone, action: "duyet" | "tu-choi" | "khoa", note? }: đổi trạng thái theo `chuyenTrangThaiAdmin`
//   (từ chối BẮT lý do 3–300 chữ). Ghi nhật ký `sell.vua-status`.
// Quyền: tab "cho-ban" (cùng chỗ quản danh bạ Đầu mối) — GET=view · PATCH=edit.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { normalizeVnPhone } from "@/lib/phone";
import { chuyenTrangThaiAdmin, isVuaAdminAction, isVuaStatus } from "@/lib/vua-profile";

const TABLE = "vua_profiles";
const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await requirePermission("cho-ban", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const st = new URL(req.url).searchParams.get("status") ?? "cho_duyet";
  if (!isVuaStatus(st)) return err(400, "bad_status");

  const { data, error } = await admin
    .from(TABLE)
    .select("phone,name,kind,province,address,species,hours,contact,status,status_note,approved_at,created_at,updated_at")
    .eq("status", st)
    .order("updated_at", { ascending: st === "cho_duyet" }) // hàng chờ: cũ nhất trước
    .limit(300);
  // bảng chưa có (0079 chưa áp) ⇒ nói rõ, không giả rỗng
  if (error) return err(503, error.code === "42P01" ? "migration_needed" : "query_failed");

  const phones = (data ?? []).map((r) => r.phone as string);
  const xm = new Set<string>();
  if (phones.length > 0) {
    const { data: cs } = await admin
      .from("customers")
      .select("phone")
      .in("phone", phones)
      .not("vai_xac_minh_at", "is", null);
    for (const c of cs ?? []) xm.add((c as { phone: string }).phone);
  }

  return NextResponse.json({
    ok: true,
    profiles: (data ?? []).map((r) => ({
      phone: r.phone as string,
      name: r.name as string,
      kind: r.kind as string,
      province: (r.province as string | null) ?? null,
      address: (r.address as string | null) ?? null,
      species: Array.isArray(r.species) ? (r.species as string[]) : [],
      hours: (r.hours as string | null) ?? null,
      contact: (r.contact as string | null) ?? null,
      status: r.status as string,
      statusNote: (r.status_note as string | null) ?? null,
      approvedAt: (r.approved_at as string | null) ?? null,
      updatedAt: r.updated_at as string,
      xacMinh: xm.has(r.phone as string),
    })),
  });
}

export async function PATCH(req: Request) {
  const who = await requirePermission("cho-ban", "edit");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as { phone?: unknown; action?: unknown; note?: unknown } | null;
  if (typeof body?.phone !== "string" || !body.phone.trim()) return err(400, "bad_phone");
  if (!isVuaAdminAction(body.action)) return err(400, "bad_action");
  const phone = normalizeVnPhone(body.phone);

  const { data: cur, error: curErr } = await admin.from(TABLE).select("status").eq("phone", phone).maybeSingle();
  if (curErr) return err(503, "query_failed");
  if (!cur || !isVuaStatus(cur.status)) return err(404, "not_found");

  const next = chuyenTrangThaiAdmin(cur.status, body.action, body.note);
  if (!next.ok) return err(next.code === "no_change" ? 409 : 400, next.code);

  const patch: Record<string, unknown> = { status: next.status, status_note: next.note };
  if (next.status === "hoat_dong") patch.approved_at = new Date().toISOString();
  // khoá lạc quan: chỉ đổi khi trạng thái vẫn là cái nhân viên vừa thấy (hai người cùng bấm)
  const { data, error } = await admin.from(TABLE).update(patch).eq("phone", phone).eq("status", cur.status).select("phone");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(409, "changed");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "sell.vua-status",
    target: phone,
    detail: { from: cur.status, to: next.status, note: next.note },
  });
  return NextResponse.json({ ok: true, status: next.status });
}
