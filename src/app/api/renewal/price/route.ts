// Đơn giá/tháng gia hạn S-Tracking hiện hành (bảng giá chung crm/hub) — để
// wizard hiện tổng tiền trước khi tạo yêu cầu. Dữ liệu CHUNG (không cá nhân) nên
// không cần đăng nhập; cache ngắn để không đập DB chung mỗi lần mở wizard.

import { NextResponse } from "next/server";
import { getRenewalMonthlyPrice, isRenewalConfigured } from "@/lib/renewal";

export async function GET() {
  if (!isRenewalConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }
  const monthlyPrice = await getRenewalMonthlyPrice();
  if (monthlyPrice == null) {
    return NextResponse.json({ ok: false, code: "crm_error" });
  }
  return NextResponse.json(
    { ok: true, monthlyPrice },
    { headers: { "Cache-Control": "public, max-age=1800" } },
  );
}
