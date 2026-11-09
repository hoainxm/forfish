// /api/admin/accounts/vai — NHÂN VIÊN SỬA VAI (spec 17 §3.3, anh Long 03/11: chọn nhầm vai ⇒ "Nhân viên sửa ở /quan-tri").
//
// App KHOÁ vai sau lần chọn đầu (lib/vai lyDoKhongDoiVai) — đây là đường DUY NHẤT đổi được vai tuỳ ý, và chỉ cho nhân
// viên có quyền tab "tai-khoan" (edit). PATCH { phone, vai: Vai | null } (null = trả về "chưa chọn", bà con chọn lại ở
// /chon-vai). Ghi nhật ký `account.doi-vai` kèm vai cũ → mới. Máy của bà con nhận vai mới ở LẦN MỞ APP KẾ TIẾP có sóng
// (vai-store hỏi lại mỗi lần mở, anh Long 09/11 bỏ mốc 12 giờ) hoặc khi app gửi vai cũ lên và bị 409 trả vai máy chủ.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { normalizeVnPhone } from "@/lib/phone";
import { isMissingColumnError } from "@/lib/staff-permissions";
import { isVai } from "@/lib/vai";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

export async function PATCH(req: Request) {
  const who = await requirePermission("tai-khoan", "edit");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as { phone?: unknown; vai?: unknown } | null;
  if (typeof body?.phone !== "string" || !body.phone.trim()) return err(400, "bad_phone");
  if (body.vai !== null && !isVai(body.vai)) return err(400, "bad_vai");
  const phone = normalizeVnPhone(body.phone);

  const { data: cur, error: curErr } = await admin.from("customers").select("vai").eq("phone", phone).maybeSingle();
  if (curErr) return err(500, isMissingColumnError(curErr) ? "migration_needed" : "query_failed");
  if (!cur) return err(404, "not_found");

  const { error } = await admin
    .from("customers")
    .update({ vai: body.vai, vai_doi_luc: new Date().toISOString() })
    .eq("phone", phone);
  if (error) return err(500, "update_failed");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.doi-vai",
    target: phone,
    detail: { tu: cur.vai ?? null, sang: body.vai },
  });
  return NextResponse.json({ ok: true, vai: body.vai });
}
