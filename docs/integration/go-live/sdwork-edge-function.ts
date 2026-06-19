// SDWork CRM — Edge Function nhận mật khẩu KH đổi từ SDFish (đồng bộ 2 chiều).
// Copy sang repo CRM: supabase/functions/sdfish-password-in/index.ts
//
// Deploy:
//   supabase functions deploy sdfish-password-in --project-ref exueouggmbjtjvsvpfya
//   supabase secrets set SDWORK_WEBHOOK_SECRET=<CHUỖI GIỐNG SDFish> --project-ref exueouggmbjtjvsvpfya
// URL sau deploy → đặt làm SDWORK_SYNC_URL bên SDFish:
//   https://exueouggmbjtjvsvpfya.functions.supabase.co/sdfish-password-in
//
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY có sẵn trong runtime Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = Deno.env.get("SDWORK_WEBHOOK_SECRET")!; // GIỐNG HỆT SDFish
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** HMAC-SHA256 hex của raw body — đối xứng signOutbound() bên SDFish. */
async function hmacHex(raw: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** So sánh an toàn thời gian (chống timing attack). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, code: "method" }, 405);
  if (!SECRET) return json({ ok: false, code: "not_configured" }, 503);

  const raw = await req.text(); // RAW body để verify HMAC (đừng parse trước)
  const sig = req.headers.get("x-sdfish-signature") ?? "";
  if (!safeEqual(await hmacHex(raw, SECRET), sig)) {
    return json({ ok: false, code: "bad_signature" }, 401);
  }

  let body: { phone?: string; password?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, code: "bad_json" }, 400);
  }
  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";
  if (!/^0\d{8,10}$/.test(phone) || password.length < 6) {
    return json({ ok: false, code: "bad_request" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Khách CRM = auth.users email {SĐT}@sdvico.local. Tra id → đặt lại mật khẩu.
  // (Nếu CRM lưu khác → thay đoạn này bằng UPDATE bảng + cột hash của bạn.)
  const { data: uid, error: rpcErr } = await admin.rpc("auth_user_id_by_phone", {
    p_phone: phone,
  });
  if (rpcErr || !uid) return json({ ok: false, code: "user_not_found" }, 404);

  const { error } = await admin.auth.admin.updateUserById(uid as string, { password });
  if (error) return json({ ok: false, code: "update_failed" }, 500);

  return json({ ok: true });
});
