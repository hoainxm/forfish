// GET /api/crew-reports/lookup?cccd=... — chủ tàu PREMIUM tra cảnh báo theo
// CCCD. Chỉ trả report ĐÃ DUYỆT (status='approved'); KHÔNG lộ SĐT người báo
// (giảm trả thù/vu khống — người báo chỉ admin thấy). Đọc bằng service-role
// qua khoá HASH(CCCD) (bảng RLS không policy client, migration 0007).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUser } from "@/lib/premium-guard";
import { hashCccd } from "@/lib/crew-report-hash";
import { isValidCccd } from "@/lib/crew";
import type { CrewReportPublic } from "@/lib/crew-report";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await requirePremiumUser();
  if (!who.ok) return err(who.status, who.code);

  const cccd = new URL(req.url).searchParams.get("cccd") ?? "";
  if (!isValidCccd(cccd)) return err(400, "bad_cccd");

  const hash = hashCccd(cccd);
  if (!hash) return err(503, "cccd_pepper_missing");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("crew_reports")
    .select(
      "id, category, detail, reporter_boat, created_at, subject_response, subject_responded_at",
    )
    .eq("subject_cccd_hash", hash)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return err(500, "query_failed");

  const reports: CrewReportPublic[] = (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as CrewReportPublic["category"],
    detail: (r.detail as string) ?? null,
    reporterBoat: (r.reporter_boat as string) ?? null,
    createdAt: r.created_at as string,
    subjectResponse: (r.subject_response as string) ?? null,
    subjectRespondedAt: (r.subject_responded_at as string) ?? null,
  }));

  return NextResponse.json({
    ok: true,
    checked: true,
    count: reports.length,
    reports,
  });
}
