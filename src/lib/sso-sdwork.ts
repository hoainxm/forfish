// SSO với SDWork — KHÔNG seed/copy user. Khách bên SDWork đăng nhập ForFish
// bằng đúng SĐT + mật khẩu SDWork; ForFish gọi endpoint xác thực của SDWork,
// nếu OK thì cấp session bằng tài khoản Supabase ảo (link qua sdwork_customer_ref).
//
// Hợp đồng API: xem docs/integration/sdwork-sso-contract.md.
//
// Adapter này SERVER-ONLY (chứa secret) — chỉ gọi từ route handler.

export interface SsoVerifyResult {
  ok: boolean;
  sdworkCustomerId?: string;
  fullName?: string;
  phone?: string;        // SĐT chuẩn hóa (84xxxxxxxxx)
  errorCode?: "invalid_credentials" | "not_a_customer" | "service_unavailable";
  errorMessage?: string;
}

const VERIFY_URL = process.env.SDWORK_VERIFY_URL ?? "";
const VERIFY_KEY = process.env.SDWORK_VERIFY_KEY ?? "";

export function isSsoConfigured(): boolean {
  return Boolean(VERIFY_URL && VERIFY_KEY);
}

/** Chuẩn hóa SĐT VN về 84xxxxxxxxx — trùng quy ước phía client. */
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return "84" + d;
}

/**
 * Xác thực credential bằng SDWork.
 * Khi chưa cấu hình endpoint → trả service_unavailable (login fallback về auth riêng).
 */
export async function verifyWithSdwork(
  rawPhone: string,
  password: string,
): Promise<SsoVerifyResult> {
  if (!isSsoConfigured()) {
    return { ok: false, errorCode: "service_unavailable" };
  }
  const phone = normalizePhone(rawPhone);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": VERIFY_KEY,
      },
      body: JSON.stringify({ phone, password }),
      // không tin tunnel chậm; nghẽn API SDWork không được phép kéo login lâu
      signal: AbortSignal.timeout(7_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, errorCode: "invalid_credentials" };
    }
    if (res.status === 404) {
      return { ok: false, errorCode: "not_a_customer" };
    }
    if (!res.ok) {
      return { ok: false, errorCode: "service_unavailable" };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      sdworkCustomerId?: string;
      fullName?: string;
      phone?: string;
    };
    if (!json.ok || !json.sdworkCustomerId) {
      return { ok: false, errorCode: "invalid_credentials" };
    }
    return {
      ok: true,
      sdworkCustomerId: json.sdworkCustomerId,
      fullName: json.fullName,
      phone: json.phone ?? phone,
    };
  } catch (e) {
    return {
      ok: false,
      errorCode: "service_unavailable",
      errorMessage: e instanceof Error ? e.message : "unknown",
    };
  }
}
