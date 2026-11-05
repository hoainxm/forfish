// Danh sách YÊU CẦU GIA HẠN của ngư dân đang đăng nhập (màn theo dõi trạng thái).
// Đọc từ DB chung qua edge function `sdfish-renewal` action=list, lọc theo SĐT
// đã xác thực. Yêu cầu `extended` được ĐỐI CHIẾU hạn S-Tracking (stracking_thiet_bi
// của cùng SĐT) ⇒ `xacNhanST` — CRM báo xong chưa phải xong (anh Long 2026-11-05). Degrade êm (KHÔNG ném 401 ra ngoài) để client lùi về trạng thái
// trống khi chưa đăng nhập / mất sóng.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { danhDauTenTrung, isRenewalConfigured, laYeuCauCuaMay, listRenewalRequests, xacNhanGiaHan } from "@/lib/renewal";

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

  const admin = createAdminClient();
  const [requests, tauR] = await Promise.all([
    listRenewalRequests(who.phone),
    admin && /^0[1-9]\d{8}$/.test(who.phone)
      ? admin
          .from("stracking_thiet_bi")
          .select("serial, ten_tau, het_han")
          .or(`sdt_chu_tau.eq.${who.phone},sdt_thuyen_truong.eq.${who.phone}`)
          .limit(30)
      : null,
  ]);
  if (requests == null) {
    return NextResponse.json({ ok: false, code: "crm_error" });
  }
  // Tra S-Tracking hỏng ⇒ không gắn gì (màn hiện "SDVICO báo đã gia hạn", không khẳng định xong).
  // Ghép theo SERIAL (yêu cầu cũ chưa có serial: theo tên, trừ khi tên trùng) — lib/renewal laYeuCauCuaMay.
  const coDoiChieu = !!tauR && !tauR.error;
  const may = coDoiChieu
    ? danhDauTenTrung(
        (tauR!.data ?? []).map((t) => ({
          serial: t.serial as string,
          tenTau: (t.ten_tau as string | null) ?? null,
          hetHan: (t.het_han as string | null) ?? null,
        })),
      )
    : [];
  const nowMs = Date.now();
  const ra = requests.map((r) => {
    if (r.status !== "extended" || !coDoiChieu) return r;
    const m = may.find((x) => laYeuCauCuaMay(r, x));
    return { ...r, xacNhanST: xacNhanGiaHan(r, m ? m.hetHan : undefined, nowMs) };
  });
  return NextResponse.json(
    { ok: true, requests: ra },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
