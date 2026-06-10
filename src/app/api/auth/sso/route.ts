// SSO ForFish ↔ SDWork CRM (Supabase ↔ Supabase, không cần endpoint custom).
//
// Bà con nhập SĐT + mật khẩu (của SDWork). Route này:
// 1. Verify trực tiếp qua Supabase Auth của CRM SDViCo (signInWithPassword).
// 2. OK → tìm/tạo user phía ForFish với cùng email ảo {SĐT}@sdvico.local.
// 3. Upsert profiles.sdwork_customer_ref = uuid user phía CRM.
// 4. Sinh magic-link → trả client để chuyển hướng cấp session ForFish.
//
// ForFish KHÔNG lưu mật khẩu SDWork. CRM xác thực, ForFish chỉ cấp session.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSsoConfigured, verifyWithSdwork } from "@/lib/sso-sdwork";

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

  // 1. CRM xác thực
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

  const email = verify.email!;
  const phone0 = verify.phone0!;

  // 2. Tìm user ForFish theo email; tạo nếu chưa có
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list.data?.users?.find((u) => u.email === email) ?? null;

  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(), // không dùng tới — bà con đăng nhập qua SSO
      user_metadata: {
        sdwork_user_id: verify.sdworkUserId,
        full_name: verify.fullName ?? "",
      },
    });
    if (created.error || !created.data.user) {
      return NextResponse.json(
        { ok: false, code: "create_user_failed", detail: created.error?.message },
        { status: 500 },
      );
    }
    user = created.data.user;
  }

  // 3. Upsert profiles (link 2 bên qua sdwork_customer_ref = user.id phía CRM)
  await admin.from("profiles").upsert(
    {
      id: user.id,
      phone: phone0,
      full_name: verify.fullName ?? null,
      sdwork_customer_ref: verify.sdworkUserId ?? null,
      must_change_password: false,
    },
    { onConflict: "id" },
  );

  // 4. Magic-link → client redirect để Supabase set cookie
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data?.properties?.action_link) {
    return NextResponse.json(
      { ok: false, code: "link_failed", detail: link.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    actionLink: link.data.properties.action_link,
    user: { id: user.id, phone: phone0, fullName: verify.fullName ?? "" },
  });
}
