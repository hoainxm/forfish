// OTP — verify mã → đảm bảo user {SĐT}@sdvico.local tồn tại (admin) → cấp
// magic-link token_hash để client set session (supabase.auth.verifyOtp).
// ForFish KHÔNG lưu mã thô; sai/hết hạn → lỗi rõ; quá số lần → vô hiệu.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVnPhone, normalizeVnPhone, phoneToEmail } from "@/lib/phone";
import { isExpired, OTP_MAX_ATTEMPTS, verifyCode } from "@/lib/otp/codes";

export async function POST(req: Request) {
  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  if (!body.phone || !isValidVnPhone(body.phone) || !/^\d{6}$/.test(body.code ?? "")) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const phone = normalizeVnPhone(body.phone);
  const code = body.code as string;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  const { data: row } = await admin
    .from("otp_codes")
    .select("code_hash, expires_at, attempts")
    .eq("phone", phone)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ ok: false, code: "no_code" }, { status: 400 });
  }
  if (isExpired(new Date(row.expires_at).getTime(), Date.now())) {
    await admin.from("otp_codes").delete().eq("phone", phone);
    return NextResponse.json({ ok: false, code: "expired" }, { status: 400 });
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await admin.from("otp_codes").delete().eq("phone", phone);
    return NextResponse.json({ ok: false, code: "too_many" }, { status: 429 });
  }
  if (!verifyCode(code, phone, row.code_hash, process.env.OTP_PEPPER ?? "")) {
    await admin
      .from("otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("phone", phone);
    return NextResponse.json({ ok: false, code: "wrong_code" }, { status: 401 });
  }

  // đúng mã → dọn mã, đảm bảo user, cấp token đăng nhập
  await admin.from("otp_codes").delete().eq("phone", phone);
  const email = phoneToEmail(phone);

  // tạo user nếu chưa có (email ảo đã confirm, mật khẩu random không dùng tới)
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    phone_confirm: false,
  });
  // "đã tồn tại" là bình thường — bỏ qua, chỉ chặn lỗi khác
  if (createErr && !/registered|exist/i.test(createErr.message)) {
    return NextResponse.json({ ok: false, code: "user_failed" }, { status: 500 });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return NextResponse.json({ ok: false, code: "link_failed" }, { status: 500 });
  }

  // client: supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
  return NextResponse.json({
    ok: true,
    email,
    tokenHash: link.properties.hashed_token,
  });
}
