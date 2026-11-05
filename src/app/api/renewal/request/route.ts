// Ngư dân gửi YÊU CẦU GIA HẠN thiết bị giám sát hành trình (S-Tracking/VMS) →
// edge function `sdfish-renewal` phía DB chung tạo yêu cầu + sinh QR VietQR.
// Yêu cầu ĐĂNG NHẬP: SĐT lấy từ cổng chuỗi đã xác thực (KHÔNG nhận từ body).
// Tàu (maTau/serial) do máy khách gửi: tàu có trên S-Tracking của ĐÚNG SĐT phiên
// (bảng stracking_thiet_bi, máy GPU đồng bộ) ⇒ máy chủ thay bằng serial/chủ tàu/mã
// tàu của S-Tracking; không có ⇒ tàu bà con tự khai, nhân viên xác minh trước khi
// gia hạn. Tàu đã có yêu cầu ĐANG MỞ ⇒ 409, không đẻ yêu cầu + QR thứ hai.
// Xem docs/contracts/stracking-renewal.contract.md.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chonTauStracking,
  createRenewalRequest,
  isRenewalConfigured,
  isValidRenewalMonths,
  listRenewalRequests,
  yeuCauDangMo,
  type TauStrackingRow,
} from "@/lib/renewal";

/** Tra trùng có đồng hồ riêng 4 s — chậm/hỏng thì bỏ qua tra trùng, tạo vẫn chạy trong đồng hồ 20 s của máy khách. */
const TRA_TRUNG_MS = 4000;

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

  let maTau = (body.maTau ?? "").trim();
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

  let ownerName = (body.ownerName ?? "").trim() || undefined;
  let serial = (body.serial ?? "").trim() || undefined;

  // Tên để nhân viên xưng hô — điền hộ từ hồ sơ nếu có; thiếu thì edge fn tự mặc định.
  // Cùng lúc: máy S-Tracking của SĐT phiên (để thay serial/chủ tàu bằng dữ liệu thật)
  // + yêu cầu đã có (chống trùng). Tra hỏng ⇒ đi tiếp như tàu tự khai, KHÔNG chặn.
  let name = "";
  const admin = createAdminClient();
  const [cust, tauST, daCo] = await Promise.all([
    admin
      ? admin.from("customers").select("name").eq("phone", who.phone).maybeSingle()
      : null,
    admin && /^0[1-9]\d{8}$/.test(who.phone)
      ? admin
          .from("stracking_thiet_bi")
          .select("serial, ten_tau, chu_tau, het_han")
          .or(`sdt_chu_tau.eq.${who.phone},sdt_thuyen_truong.eq.${who.phone}`)
          .limit(30)
      : null,
    listRenewalRequests(who.phone, TRA_TRUNG_MS),
  ]);
  name = (cust?.data?.name as string | null) ?? "";

  const st = tauST?.error ? null : chonTauStracking((tauST?.data ?? []) as TauStrackingRow[], { maTau, serial });
  if (st) {
    maTau = st.ten_tau?.trim() || maTau;
    serial = st.serial;
    ownerName = st.chu_tau?.trim() || ownerName;
  }

  // Tàu có trên S-Tracking: yêu cầu SDVICO báo "đã gia hạn" mà hạn S-Tracking chưa đổi VẪN là đang mở.
  const trung = daCo ? yeuCauDangMo(daCo, maTau, Date.now(), st ? (st.het_han ?? null) : undefined) : null;
  if (trung) {
    return NextResponse.json(
      { ok: false, code: "da_co_yeu_cau", requestCode: trung.requestCode, status: trung.status },
      { status: 409 },
    );
  }

  const result = await createRenewalRequest({
    phone: who.phone,
    name,
    maTau,
    ownerName,
    serial,
    monthsCount,
  });
  if (!result) {
    return NextResponse.json({ ok: false, code: "crm_error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
