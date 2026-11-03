// /api/admin/accounts/xac-minh — DẤU "XÁC MINH" THU MUA (spec 17 §5 + §12.6). Chỉ nhân viên gán.
//
// GET: SĐT các khách đang có customers.vai_xac_minh_at — tab Tài khoản tải MỘT lần cho cả danh sách (khỏi hỏi từng hàng).
// PATCH { phone, on: boolean }: bật (ghi giờ hiện tại) / tắt (null). Ghi nhật ký `account.xac-minh-thu-mua`.
// Quyền: tab "tai-khoan" — GET=view · PATCH=edit. Tách route riêng khỏi /api/admin/accounts cho gọn chỗ sửa.
// Dấu KHÔNG đòi vai = thu-mua: vai do người dùng tự đổi, dấu là việc nhân viên đã kiểm người thật (§2 luật 3).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { normalizeVnPhone } from "@/lib/phone";
import { isMissingColumnError } from "@/lib/staff-permissions";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requirePermission("tai-khoan", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");
  const { data, error } = await admin
    .from("customers")
    .select("phone")
    .not("vai_xac_minh_at", "is", null)
    .limit(5000);
  if (error) return err(503, isMissingColumnError(error) ? "migration_needed" : "query_failed");
  return NextResponse.json({ ok: true, phones: (data ?? []).map((r) => r.phone as string) });
}

export async function PATCH(req: Request) {
  const who = await requirePermission("tai-khoan", "edit");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as { phone?: unknown; on?: unknown } | null;
  if (typeof body?.phone !== "string" || !body.phone.trim()) return err(400, "bad_phone");
  if (typeof body.on !== "boolean") return err(400, "bad_value");
  const phone = normalizeVnPhone(body.phone);
  const at = body.on ? new Date().toISOString() : null;

  const { data, error } = await admin
    .from("customers")
    .update({ vai_xac_minh_at: at, updated_at: new Date().toISOString() })
    .eq("phone", phone)
    .select("phone");
  if (error) return err(500, isMissingColumnError(error) ? "migration_needed" : "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.xac-minh-thu-mua",
    target: phone,
    detail: { on: body.on },
  });
  return NextResponse.json({ ok: true, on: body.on, at });
}
