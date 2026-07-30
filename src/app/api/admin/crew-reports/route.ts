// /api/admin/crew-reports — KIỂM DUYỆT cảnh báo thuyền viên (staff SDVICO).
// GET: danh sách theo status (mặc định 'pending' — hàng chờ duyệt). Admin thấy
//   ĐẦY ĐỦ: CCCD thô, tên, SĐT người báo (đối chất) — khác với route tra của
//   chủ tàu (ẩn người báo).
// POST: STAFF TỰ THÊM một thuyền viên có vấn đề → vào thẳng 'approved' (thẩm
//   quyền SDVICO, không qua hàng chờ) — hiện ngay cho chủ tàu khác khi tra.
// PATCH: duyệt/từ chối/rút + ghi PHẢN HỒI của người bị ghi (qua admin, v1).
// Ghi bằng service-role; PHÂN QUYỀN (2026-07-30) qua requirePermission trên tab
// "canh-bao": GET=view · POST=create · PATCH=edit · DELETE=delete.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { cleanReportDetail, isCrewReportCategory } from "@/lib/crew-report";
import { subjectIdentity } from "@/lib/crew-report-hash";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

export async function GET(req: Request) {
  const who = await requirePermission("canh-bao", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const statusParam = new URL(req.url).searchParams.get("status") ?? "pending";
  let q = admin
    .from("crew_reports")
    .select(
      "id, subject_cccd, subject_phone, subject_name, reporter_phone, reporter_boat, category, detail, status, moderated_by, moderated_at, subject_response, subject_responded_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (statusParam !== "all") {
    const s = (STATUSES as readonly string[]).includes(statusParam)
      ? statusParam
      : "pending";
    q = q.eq("status", s);
  }
  const { data, error } = await q;
  if (error) return err(500, "query_failed");

  const reports = (data ?? []).map((r) => ({
    id: r.id as string,
    subjectCccd: (r.subject_cccd as string) ?? null,
    subjectPhone: (r.subject_phone as string) ?? null,
    subjectName: (r.subject_name as string) ?? null,
    reporterPhone: r.reporter_phone as string,
    reporterBoat: (r.reporter_boat as string) ?? null,
    category: r.category as string,
    detail: (r.detail as string) ?? null,
    status: r.status as string,
    moderatedBy: (r.moderated_by as string) ?? null,
    moderatedAt: (r.moderated_at as string) ?? null,
    subjectResponse: (r.subject_response as string) ?? null,
    subjectRespondedAt: (r.subject_responded_at as string) ?? null,
    createdAt: r.created_at as string,
  }));

  return NextResponse.json({ ok: true, me: who, reports });
}

export async function POST(req: Request) {
  // STAFF tự thêm thuyền viên có vấn đề — vào thẳng 'approved' (hiện ngay).
  const who = await requirePermission("canh-bao", "create");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    cccd?: string;
    phone?: string;
    subjectName?: string;
    category?: string;
    detail?: string;
  } | null;
  if (!isCrewReportCategory(body?.category)) return err(400, "bad_category");
  const ident = subjectIdentity(body?.cccd, body?.phone);
  if (!ident.ok) return err(ident.code === "cccd_pepper_missing" ? 503 : 400, ident.code);

  const nowIso = new Date().toISOString();
  const { error } = await admin.from("crew_reports").insert({
    ...ident.fields,
    subject_name: body?.subjectName?.trim() || null,
    reporter_phone: who.phone,
    reporter_boat: "SDVICO", // nguồn: staff SDVICO thêm (không phải chủ tàu)
    category: body?.category,
    detail: cleanReportDetail(body?.detail) || null,
    status: "approved",
    moderated_by: who.phone,
    moderated_at: nowIso,
  });
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true, status: "approved" });
}

export async function PATCH(req: Request) {
  const who = await requirePermission("canh-bao", "edit");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    action?: string;
    subjectResponse?: string;
  } | null;
  if (!body?.id) return err(400, "bad_id");

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (body.action === "approve" || body.action === "reject" || body.action === "withdraw") {
    patch.status =
      body.action === "approve"
        ? "approved"
        : body.action === "reject"
          ? "rejected"
          : "withdrawn";
    patch.moderated_by = who.phone;
    patch.moderated_at = nowIso;
  } else if (body.action !== "respond") {
    return err(400, "bad_action");
  }

  // ghi phản hồi người bị ghi (kèm bất kỳ action nào, hoặc action='respond')
  if (typeof body.subjectResponse === "string") {
    const resp = cleanReportDetail(body.subjectResponse);
    patch.subject_response = resp || null;
    patch.subject_responded_at = resp ? nowIso : null;
  }

  if (Object.keys(patch).length === 0) return err(400, "nothing_to_update");

  const { data, error } = await admin
    .from("crew_reports")
    .update(patch)
    .eq("id", body.id)
    .select("id");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  // XÓA HẲN một cảnh báo khỏi danh sách (khác 'withdraw' vẫn giữ hàng) — dùng
  // khi báo cáo sai/trùng/không còn giá trị. Không hoàn tác được.
  const who = await requirePermission("canh-bao", "delete");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err(400, "bad_id");

  const { data, error } = await admin
    .from("crew_reports")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");

  return NextResponse.json({ ok: true });
}
