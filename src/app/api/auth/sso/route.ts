// SSO ForFish ↔ SDWork — endpoint server.
//
// Bà con nhập SĐT + mật khẩu (của SDWork). Route này:
// 1. Gọi SDWork verify (sso-sdwork.verifyWithSdwork).
// 2. Nếu OK + chưa có user Supabase tương ứng → tạo (email ảo) + lưu
//    profiles.sdwork_customer_ref.
// 3. Sinh magic-link → trả URL cho client để client signInWithOtp/exchange.
//    (Cách này không cần lưu mật khẩu SDWork phía ForFish.)
//
// Cấu hình (env): SDWORK_VERIFY_URL, SDWORK_VERIFY_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Khi CHƯA cấu hình → trả 503 "SSO chưa sẵn sàng" để client fallback.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSsoConfigured, verifyWithSdwork } from "@/lib/sso-sdwork";

const PHONE_EMAIL_DOMAIN = "phone.forfish.app";

function emailOf(phone: string): string {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

export async function POST(req: Request) {
  if (!isSsoConfigured()) {
    return NextResponse.json(
      { ok: false, code: "sso_not_configured" },
      { status: 503 },
    );
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, code: "supabase_not_configured" },
      { status: 503 },
    );
  }

  let body: { phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const { phone, password } = body;
  if (!phone || !password) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  // 1. Hỏi SDWork
  const verify = await verifyWithSdwork(phone, password);
  if (!verify.ok) {
    const status =
      verify.errorCode === "service_unavailable" ? 503 :
      verify.errorCode === "not_a_customer" ? 404 : 401;
    return NextResponse.json(
      { ok: false, code: verify.errorCode ?? "invalid_credentials" },
      { status },
    );
  }

  const normalizedPhone = verify.phone!;
  const email = emailOf(normalizedPhone);

  // 2. Tìm user Supabase theo email ảo
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.data?.users?.find((u) => u.email === email) ?? null;

  if (!user) {
    // Tạo user mới — không lưu mật khẩu SDWork ở đây (random); confirm sẵn.
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: {
        sdwork_customer_id: verify.sdworkCustomerId,
        full_name: verify.fullName ?? "",
      },
    });
    if (created.error || !created.data.user) {
      return NextResponse.json(
        { ok: false, code: "create_user_failed" },
        { status: 500 },
      );
    }
    user = created.data.user;
  }

  // 3. Cập nhật profiles.sdwork_customer_ref + full_name (idempotent)
  await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        phone: normalizedPhone,
        full_name: verify.fullName ?? null,
        sdwork_customer_ref: verify.sdworkCustomerId ?? null,
        must_change_password: false, // SSO không dùng mật khẩu local
      },
      { onConflict: "id" },
    );

  // 4. Sinh magic-link để client đổi sang session (không lộ mật khẩu nào)
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data?.properties?.action_link) {
    return NextResponse.json(
      { ok: false, code: "link_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    actionLink: link.data.properties.action_link,
    user: { id: user.id, phone: normalizedPhone, fullName: verify.fullName ?? "" },
  });
}
