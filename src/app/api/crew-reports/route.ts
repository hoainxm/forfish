// POST /api/crew-reports — chủ tàu PREMIUM nộp báo cáo vấn đề của một thuyền
// viên (định danh CCCD HOẶC SĐT, 1 trong 2). Vào kho với status 'pending' — im
// lặng tới khi admin duyệt (/api/admin/crew-reports). Ghi bằng service-role
// (bảng RLS không policy client, migration 0007 + 0009). Người báo lấy từ
// PHIÊN — không tin SĐT client gửi.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUser } from "@/lib/premium-guard";
import { subjectIdentity } from "@/lib/crew-report-hash";
import { cleanReportDetail, isCrewReportCategory } from "@/lib/crew-report";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function POST(req: Request) {
  const who = await requirePremiumUser();
  if (!who.ok) return err(who.status, who.code);

  const body = (await req.json().catch(() => null)) as {
    cccd?: string;
    phone?: string;
    subjectName?: string;
    category?: string;
    detail?: string;
    reporterBoat?: string;
  } | null;

  if (!isCrewReportCategory(body?.category)) return err(400, "bad_category");
  const ident = subjectIdentity(body?.cccd, body?.phone);
  if (!ident.ok) return err(ident.code === "cccd_pepper_missing" ? 503 : 400, ident.code);

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { error } = await admin.from("crew_reports").insert({
    ...ident.fields,
    subject_name: body?.subjectName?.trim() || null,
    reporter_phone: who.phone,
    reporter_boat: body?.reporterBoat?.trim() || null,
    category: body?.category,
    detail: cleanReportDetail(body?.detail) || null,
    status: "pending",
  });
  if (error) return err(500, "insert_failed");

  return NextResponse.json({ ok: true, status: "pending" });
}
