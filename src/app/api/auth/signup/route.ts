// Đăng ký tài khoản SĐT — route mỏng gọi Edge Function `auth-gateway`
// (tạo user với email ảo ĐÃ CONFIRM sẵn — email ảo không có hòm thư thật
// để bấm link xác nhận, nên không thể dùng signUp thường khi project bật
// "Confirm email"). Xong client tự signInWithPassword.

import { NextResponse } from "next/server";
import { callAuthGateway, isAuthGatewayConfigured } from "@/lib/auth-gateway";

export async function POST(req: Request) {
  if (!isAuthGatewayConfigured()) {
    return NextResponse.json(
      { ok: false, code: "not_configured" },
      { status: 503 },
    );
  }

  let body: { phone?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const { phone, password, fullName } = body;
  if (!phone || !password || password.length < 6) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const r = await callAuthGateway("signup", { phone, password, fullName });
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, code: r.code ?? "create_failed" },
      { status: r.status >= 400 ? r.status : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
