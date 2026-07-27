// POST /api/crew-reports — chủ tàu PREMIUM nộp báo cáo vấn đề của một thuyền
// viên (định danh CCCD). Vào kho với status 'pending' — im lặng tới khi admin
// duyệt (/api/admin/crew-reports). Ghi bằng service-role (bảng RLS không policy
// client, migration 0007). Người báo lấy từ PHIÊN — không tin SĐT client gửi.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUser } from "@/lib/premium-guard";
import { hashCccd } from "@/lib/crew-report-hash";
import { isValidCccd, normalizeCccd } from "@/lib/crew";
import { cleanReportDetail, isCrewReportCategory } from "@/lib/crew-report";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function POST(req: Request) {
  const who = await requirePremiumUser();
  if (!who.ok) return err(who.status, who.code);

  const body = (await req.json().catch(() => null)) as {
    cccd?: string;
    subjectName?: string;
    category?: string;
    detail?: string;
    reporterBoat?: string;
  } | null;

  if (!body?.cccd || !isValidCccd(body.cccd)) return err(400, "bad_cccd");
  if (!isCrewReportCategory(body.category)) return err(400, "bad_category");

  const hash = hashCccd(body.cccd);
  if (!hash) return err(503, "cccd_pepper_missing");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { error } = await admin.from("crew_reports").insert({
    subject_cccd_hash: hash,
    subject_cccd: normalizeCccd(body.cccd),
    subject_name: body.subjectName?.trim() || null,
    reporter_phone: who.phone,
    reporter_boat: body.reporterBoat?.trim() || null,
    category: body.category,
    detail: cleanReportDetail(body.detail) || null,
    status: "pending",
  });
  if (error) return err(500, "insert_failed");

  return NextResponse.json({ ok: true, status: "pending" });
}
