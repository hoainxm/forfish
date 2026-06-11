// Gọi auth-gateway (Edge Function chạy BÊN TRONG project ForFish — service
// key tự cấp, env app không giữ key bí mật nào). SERVER ONLY.
//
// signup: tạo tài khoản SĐT (email ảo đã confirm sẵn).
// sso:    verify SĐT+mật khẩu với CRM SDViCo → đồng bộ mật khẩu đó vào tài
//         khoản ForFish → client đăng nhập bằng đường password chuẩn,
//         KHÔNG cần magic-link/redirect, KHÔNG cần SUPABASE_SERVICE_ROLE_KEY.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isAuthGatewayConfigured(): boolean {
  return Boolean(URL && ANON);
}

export interface AuthGatewayResult {
  ok: boolean;
  code?: string;
  status: number;
}

export async function callAuthGateway(
  action: "signup" | "sso",
  payload: { phone: string; password: string; fullName?: string },
): Promise<AuthGatewayResult> {
  if (!isAuthGatewayConfigured()) {
    return { ok: false, code: "not_configured", status: 503 };
  }
  try {
    const r = await fetch(`${URL}/functions/v1/auth-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    return { ok: Boolean(j?.ok), code: j?.code, status: r.status };
  } catch {
    return { ok: false, code: "service_unavailable", status: 503 };
  }
}
