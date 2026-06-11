// SSO ForFish ↔ SDWork: route mỏng — việc nặng nằm ở Edge Function
// `auth-gateway` BÊN TRONG project ForFish (service key tự cấp).
//
// Luồng (đổi 2026-06-10, bỏ magic-link): gateway verify SĐT+mật khẩu với
// CRM SDViCo → đúng thì ĐỒNG BỘ mật khẩu đó vào tài khoản ForFish (tạo mới
// nếu chưa có, email ảo {SĐT}@sdvico.local đã confirm) → trả {ok:true} →
// client đăng nhập tiếp bằng signInWithPassword như tài khoản thường.
// ForFish KHÔNG lưu/log mật khẩu; env app KHÔNG cần service key.

import { NextResponse } from "next/server";
import { callAuthGateway, isAuthGatewayConfigured } from "@/lib/auth-gateway";

export async function POST(req: Request) {
  if (!isAuthGatewayConfigured()) {
    return NextResponse.json(
      { ok: false, code: "sso_not_configured" },
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

  const r = await callAuthGateway("sso", { phone, password });
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, code: r.code ?? "invalid_credentials" },
      { status: r.status >= 400 ? r.status : 401 },
    );
  }
  return NextResponse.json({ ok: true });
}
