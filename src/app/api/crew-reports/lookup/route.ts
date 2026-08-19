// GET /api/crew-reports/lookup?cccd=…&phone=… — chủ tàu PREMIUM tra cảnh báo
// theo CCCD HOẶC SĐT (1 trong 2 đủ; có cả hai thì khớp bên nào cũng ra). Chỉ
// trả report ĐÃ DUYỆT (status='approved'); KHÔNG lộ SĐT người báo (giảm trả
// thù/vu khống). Đọc bằng service-role qua khoá HASH (bảng RLS không policy
// client, migration 0007 + 0009).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUser } from "@/lib/premium-guard";
import { hashCccd, hashPhone } from "@/lib/crew-report-hash";
import { isValidCccd } from "@/lib/crew";
import { isValidVnPhone } from "@/lib/phone";
import type { CrewReportPublic } from "@/lib/crew-report";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET(req: Request) {
  const who = await requirePremiumUser(req);
  if (!who.ok) return err(who.status, who.code);

  const url = new URL(req.url);
  const cccd = url.searchParams.get("cccd") ?? "";
  const phone = url.searchParams.get("phone") ?? "";

  // gom khoá hash của các định danh HỢP LỆ được gửi lên (CCCD và/hoặc SĐT)
  const orConds: string[] = [];
  if (cccd) {
    if (!isValidCccd(cccd)) return err(400, "bad_cccd");
    const h = hashCccd(cccd);
    if (!h) return err(503, "cccd_pepper_missing");
    orConds.push(`subject_cccd_hash.eq.${h}`);
  }
  if (phone) {
    if (!isValidVnPhone(phone)) return err(400, "bad_phone");
    const h = hashPhone(phone);
    if (!h) return err(503, "cccd_pepper_missing");
    orConds.push(`subject_phone_hash.eq.${h}`);
  }
  if (orConds.length === 0) return err(400, "bad_input");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("crew_reports")
    .select(
      "id, category, detail, reporter_boat, created_at, subject_response, subject_responded_at",
    )
    .eq("status", "approved")
    .or(orConds.join(","))
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
