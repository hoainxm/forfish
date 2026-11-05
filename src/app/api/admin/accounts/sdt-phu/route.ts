// /api/admin/accounts/sdt-phu — NHÂN VIÊN GÁN SĐT PHỤ cho tài khoản (migration 0084, anh Long 05/11: "cho phép 1 acc 2 sdt").
//
// Dùng khi tàu trên S-Tracking (Viettel) đứng tên SĐT khác SĐT bà con đăng nhập: gán SĐT đó làm SĐT phụ ⇒ khối "Giám sát
// hành trình" hiện cả máy của SĐT phụ, gia hạn được. App chưa có OTP nên CHỈ nhân viên (quyền tab "tai-khoan" edit) gán —
// bà con tự gõ là xem được máy người khác. PATCH { phone, sdtPhu: string | null } (null = gỡ). Nhật ký `account.sdt-phu`.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { isMissingColumnError } from "@/lib/staff-permissions";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

export async function PATCH(req: Request) {
  const who = await requirePermission("tai-khoan", "edit");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as { phone?: unknown; sdtPhu?: unknown } | null;
  if (typeof body?.phone !== "string" || !body.phone.trim()) return err(400, "bad_phone");
  const phone = normalizeVnPhone(body.phone);
  let sdtPhu: string | null = null;
  if (body.sdtPhu !== null && body.sdtPhu !== "") {
    if (typeof body.sdtPhu !== "string" || !isValidVnPhone(body.sdtPhu)) return err(400, "bad_sdt_phu");
    sdtPhu = normalizeVnPhone(body.sdtPhu);
    if (sdtPhu === phone) return err(400, "trung_sdt_chinh");
  }

  const { data: cur, error: curErr } = await admin.from("customers").select("sdt_phu").eq("phone", phone).maybeSingle();
  if (curErr) return err(500, isMissingColumnError(curErr) ? "migration_needed" : "query_failed");
  if (!cur) return err(404, "not_found");

  const { error } = await admin
    .from("customers")
    .update({ sdt_phu: sdtPhu, sdt_phu_luc: new Date().toISOString() })
    .eq("phone", phone);
  if (error) return err(500, "update_failed");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.sdt-phu",
    target: phone,
    detail: { tu: cur.sdt_phu ?? null, sang: sdtPhu },
  });
  return NextResponse.json({ ok: true, sdtPhu });
}
