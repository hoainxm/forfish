// Danh sách YÊU CẦU GIA HẠN của ngư dân đang đăng nhập (màn theo dõi trạng thái).
// Đọc từ DB chung qua edge function `sdfish-renewal` action=list, lọc theo SĐT
// đã xác thực. Degrade êm (KHÔNG ném 401 ra ngoài) để client lùi về trạng thái
// trống khi chưa đăng nhập / mất sóng.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { isRenewalConfigured, listRenewalRequests } from "@/lib/renewal";

export async function GET(req: Request) {
  if (!isRenewalConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }

  const who = await identityFromRequest(req);
  if (!who.ok) {
    // 503 = hạ tầng chưa tra được (giữ shape, không đá bà con ra); 401 = chưa đăng nhập.
    if (who.res.status === 503) {
      return NextResponse.json({ ok: false, code: "unavailable" });
    }
    return NextResponse.json({ ok: false, code: "not_signed_in" });
  }

  const requests = await listRenewalRequests(who.phone);
  if (requests == null) {
    return NextResponse.json({ ok: false, code: "crm_error" });
  }
  return NextResponse.json(
    { ok: true, requests },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
