// OTP — gửi mã tới SĐT. Lưu hash (otp_codes), gửi qua provider adapter.
// Rate-limit gửi lại 60s/SĐT. Chưa cấu hình env/DB → 503 (UI lùi mật khẩu).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import {
  generateCode,
  hashCode,
  inResendCooldown,
  OTP_TTL_MS,
} from "@/lib/otp/codes";
import { getOtpProvider } from "@/lib/otp/provider";

export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  if (!body.phone || !isValidVnPhone(body.phone)) {
    return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  }
  const phone = normalizeVnPhone(body.phone);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  const now = Date.now();
  const { data: existing } = await admin
    .from("otp_codes")
    .select("last_sent_at")
    .eq("phone", phone)
    .maybeSingle();
  if (
    existing?.last_sent_at &&
    inResendCooldown(new Date(existing.last_sent_at).getTime(), now)
  ) {
    return NextResponse.json({ ok: false, code: "too_soon" }, { status: 429 });
  }

  const code = generateCode();
  const { error } = await admin.from("otp_codes").upsert(
    {
      phone,
      code_hash: hashCode(code, phone, process.env.OTP_PEPPER ?? ""),
      expires_at: new Date(now + OTP_TTL_MS).toISOString(),
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
    },
    { onConflict: "phone" },
  );
  if (error) {
    return NextResponse.json({ ok: false, code: "store_failed" }, { status: 500 });
  }

  try {
    await getOtpProvider().send(phone, code);
  } catch {
    return NextResponse.json({ ok: false, code: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
