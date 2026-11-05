// Ngư dân gửi YÊU CẦU GIA HẠN thiết bị giám sát hành trình (S-Tracking/VMS) →
// edge function `sdfish-renewal` phía DB chung tạo yêu cầu + sinh QR VietQR.
// Yêu cầu ĐĂNG NHẬP: SĐT lấy từ cổng chuỗi đã xác thực (KHÔNG nhận từ body).
//
// KHOÁ = SERIAL máy S-Tracking (2026-11-05, anh Long: "tránh để nhầm info"): máy khách
// chỉ gửi serial + số tháng. Máy chủ tìm serial đó trong `stracking_thiet_bi` của ĐÚNG
// SĐT phiên (chủ tàu hoặc thuyền trưởng) — không thấy ⇒ 422 `khong_co_tren_stracking`
// (bỏ hẳn lối tàu tự khai). Mã tàu, chủ tàu, IMEI, hạn hiện tại đều lấy từ S-Tracking.
// Máy đã có yêu cầu CHƯA XONG (chờ CK / đã nhận tiền mà hạn chưa đổi) ⇒ 409.
// Xem docs/contracts/stracking-renewal.contract.md.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { danhDauTenTrung, isValidRenewalMonths, yeuCauDangMo, type TauStrackingRow } from "@/lib/renewal";
import { createRenewalRequest, isRenewalConfigured, listRenewalRequests } from "@/lib/renewal-server";

/** Tra trùng có đồng hồ riêng 4 s — chậm/hỏng thì bỏ qua tra trùng, tạo vẫn chạy trong đồng hồ 20 s của máy khách. */
const TRA_TRUNG_MS = 4000;
const SDT_HOP_LE = /^0[1-9]\d{8}$/;

export async function POST(req: Request) {
  if (!(await isRenewalConfigured())) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  // Gia hạn gắn với tài khoản ngư dân → BẮT BUỘC đăng nhập (khác kênh "Gọi SDVICO"
  // cho khách lạ). identityFromRequest trả 401/503 đúng luật khi chưa/không tra được.
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;

  let body: { serial?: unknown; monthsCount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const serial = typeof body.serial === "string" ? body.serial.trim() : "";
  if (!serial || serial.length > 60) {
    return NextResponse.json({ ok: false, code: "missing_serial" }, { status: 400 });
  }
  const monthsCount = Number(body.monthsCount);
  if (!isValidRenewalMonths(monthsCount)) {
    return NextResponse.json({ ok: false, code: "invalid_months" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  if (!SDT_HOP_LE.test(who.phone)) {
    return NextResponse.json({ ok: false, code: "khong_co_tren_stracking" }, { status: 422 });
  }

  // Song song: tên khách (để nhân viên xưng hô) · máy S-Tracking của SĐT phiên · yêu cầu đã có (chống trùng).
  const [cust, tauST, daCo] = await Promise.all([
    admin.from("customers").select("name").eq("phone", who.phone).maybeSingle(),
    admin
      .from("stracking_thiet_bi")
      .select("serial, imei, ten_tau, chu_tau, het_han")
      .or(`sdt_chu_tau.eq.${who.phone},sdt_thuyen_truong.eq.${who.phone}`)
      .limit(30),
    listRenewalRequests(who.phone, TRA_TRUNG_MS),
  ]);
  if (tauST.error) {
    console.error("[renewal] đọc máy S-Tracking hỏng:", tauST.error.message);
    return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
  const rows = (tauST.data ?? []) as TauStrackingRow[];
  const st = rows.find((r) => r.serial === serial);
  if (!st) {
    return NextResponse.json({ ok: false, code: "khong_co_tren_stracking" }, { status: 422 });
  }

  const may = danhDauTenTrung(rows.map((r) => ({ serial: r.serial, tenTau: r.ten_tau }))).find(
    (m) => m.serial === serial,
  )!;
  const trung = daCo ? yeuCauDangMo(daCo, may, st.het_han ?? null, Date.now()) : null;
  if (trung) {
    return NextResponse.json(
      { ok: false, code: "da_co_yeu_cau", requestCode: trung.requestCode, status: trung.status },
      { status: 409 },
    );
  }

  const result = await createRenewalRequest({
    phone: who.phone,
    name: (cust.data?.name as string | null) ?? "",
    // Máy chưa có tên tàu trên S-Tracking ⇒ dùng số máy làm mã để nhân viên vẫn tra được.
    maTau: st.ten_tau?.trim() || serial,
    ownerName: st.chu_tau?.trim() || undefined,
    serial,
    imei: st.imei?.trim() || undefined,
    currentExpiry: st.het_han ?? null,
    monthsCount,
  });
  if (!result) {
    return NextResponse.json({ ok: false, code: "crm_error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
