// SDFish → SDWork: KH đổi mật khẩu trong SDFish → đẩy mật khẩu mới về SDWork để
// 1 credential đăng nhập được CẢ 2 app (đồng bộ 2 chiều). Định danh KH lấy TỪ
// SESSION (không tin client) → không đẩy mật khẩu hộ người khác. HMAC ký raw body.
// Best-effort: đổi tại SDFish đã xong; lỗi ở đây chỉ là chưa đẩy được sang SDWork.
// Hợp đồng: docs/integration/sdwork-sso-contract.md §5b.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeVnPhone } from "@/lib/phone";
import { signOutbound, type PasswordSyncPayload } from "@/lib/sdwork-outbound";

const TIMEOUT_MS = 6000;

export async function POST(req: Request) {
  const url = process.env.SDWORK_SYNC_URL;
  const secret = process.env.SDWORK_WEBHOOK_SECRET ?? "";
  if (!url || !secret) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  // SĐT lấy từ session (email ảo {SĐT}@sdvico.local), KHÔNG từ body.
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const email = auth?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 6) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const payload: PasswordSyncPayload = {
    phone: normalizeVnPhone(email.split("@")[0]),
    password,
  };
  const raw = JSON.stringify(payload);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sdfish-signature": signOutbound(raw, secret),
      },
      body: raw,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, code: "sdwork_error" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ ok: false, code: "sdwork_unreachable" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  return NextResponse.json({ ok: true });
}
