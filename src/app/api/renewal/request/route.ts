// Ngư dân gửi YÊU CẦU GIA HẠN thiết bị giám sát hành trình (S-Tracking/VMS) →
// edge function `sdfish-renewal` phía DB chung tạo yêu cầu + sinh QR VietQR.
// Yêu cầu ĐĂNG NHẬP: SĐT lấy từ cổng chuỗi đã xác thực (KHÔNG nhận từ body).
// Tàu (maTau/serial) do máy khách gửi = tàu bà con tự khai trong SDFish; nhân
// viên xác minh trước khi gia hạn. Xem docs/contracts/stracking-renewal.contract.md.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createRenewalRequest,
  isRenewalConfigured,
  isValidRenewalMonths,
} from "@/lib/renewal";

export async function POST(req: Request) {
  if (!isRenewalConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  // Gia hạn gắn với tài khoản ngư dân → BẮT BUỘC đăng nhập (khác kênh "Gọi SDVICO"
  // cho khách lạ). identityFromRequest trả 401/503 đúng luật khi chưa/không tra được.
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;

  let body: {
    maTau?: string;
    ownerName?: string;
    serial?: string;
    monthsCount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const maTau = (body.maTau ?? "").trim();
  if (!maTau) {
    return NextResponse.json(
      { ok: false, code: "missing_vessel_code" },
      { status: 400 },
    );
  }
  const monthsCount = Number(body.monthsCount);
  if (!isValidRenewalMonths(monthsCount)) {
    return NextResponse.json({ ok: false, code: "invalid_months" }, { status: 400 });
  }

  // Tên để nhân viên xưng hô — điền hộ từ hồ sơ nếu có; thiếu thì edge fn tự mặc định.
  let name = "";
  const admin = createAdminClient();
  if (admin) {
    const { data: cust } = await admin
      .from("customers")
      .select("name")
      .eq("phone", who.phone)
      .maybeSingle();
    name = (cust?.name as string | null) ?? "";
  }

  const result = await createRenewalRequest({
    phone: who.phone,
    name,
    maTau,
    ownerName: (body.ownerName ?? "").trim() || undefined,
    serial: (body.serial ?? "").trim() || undefined,
    monthsCount,
  });
  if (!result) {
    return NextResponse.json({ ok: false, code: "crm_error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
