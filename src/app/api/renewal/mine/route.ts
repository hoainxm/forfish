// Danh sách YÊU CẦU GIA HẠN của ngư dân đang đăng nhập (màn theo dõi trạng thái).
// Đọc từ DB chung qua edge function `sdfish-renewal` action=list, lọc theo SĐT
// đã xác thực. Yêu cầu `extended` được ĐỐI CHIẾU hạn S-Tracking (stracking_thiet_bi
// của cùng SĐT) ⇒ `xacNhanST` — CRM báo xong chưa phải xong (anh Long 2026-11-05). Degrade êm (KHÔNG ném 401 ra ngoài) để client lùi về trạng thái
// trống khi chưa đăng nhập / mất sóng.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { locMayTheoSdt, sdtTraCuaTaiKhoan } from "@/lib/stracking/sdt-phu";
import { danhDauTenTrung, laYeuCauCuaMay, xacNhanGiaHan } from "@/lib/renewal";
import { isRenewalConfigured, listRenewalRequests } from "@/lib/renewal-server";

export async function GET(req: Request) {
  if (!(await isRenewalConfigured())) {
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
  // Máy của SĐT chính + SĐT phụ (0084) — yêu cầu gửi cho tàu đứng tên SĐT phụ cũng đối chiếu được hạn.
  const loc = admin ? locMayTheoSdt(await sdtTraCuaTaiKhoan(admin, who.phone)) : null;
  const [requests, tauR] = await Promise.all([
    listRenewalRequests(who.phone),
    admin && loc ? admin.from("stracking_thiet_bi").select("serial, ten_tau, het_han").or(loc).limit(30) : null,
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
