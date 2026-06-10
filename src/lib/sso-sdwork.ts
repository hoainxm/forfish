// SSO với SDWork — verify TRỰC TIẾP qua Supabase Auth của CRM SDViCo.
// CRM lưu khách dưới dạng email ảo {SĐT}@sdvico.local (688/689 user). Cùng
// pattern ForFish sẽ dùng để không lệch.
//
// ForFish không lưu mật khẩu SDWork: chỉ gọi signInWithPassword lên CRM,
// nếu OK lấy customerId → cấp session phía ForFish bằng magic-link.

import { createClient } from "@supabase/supabase-js";

const SDWORK_DOMAIN = "sdvico.local";

const SDWORK_URL = process.env.SDWORK_SUPABASE_URL ?? "";
const SDWORK_ANON = process.env.SDWORK_SUPABASE_ANON_KEY ?? "";

export interface SsoVerifyResult {
  ok: boolean;
  /** Email dùng trên CRM (sẽ cũng dùng làm email ảo phía ForFish — 1-1). */
  email?: string;
  /** Số điện thoại đã chuẩn hóa (đầu 0). */
  phone0?: string;
  /** UUID user phía CRM, lưu làm khóa link `profiles.sdwork_customer_ref`. */
  sdworkUserId?: string;
  /** Tên đầy đủ nếu CRM gửi qua user_metadata. */
  fullName?: string;
  errorCode?: "invalid_credentials" | "not_a_customer" | "service_unavailable";
}

export function isSsoConfigured(): boolean {
  return Boolean(SDWORK_URL && SDWORK_ANON);
}

/** Chuẩn hóa SĐT VN → kiểu phía CRM hay dùng (đầu 0, 10–11 chữ số). */
function toPhone0(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return d;
}

function toPhone84(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) return d;
  if (d.startsWith("0")) return "84" + d.slice(1);
  return "84" + d;
}

/** Mỗi lần gọi tạo client mới để không chia sẻ session (server-only). */
function newCrmClient() {
  return createClient(SDWORK_URL, SDWORK_ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function tryEmail(
  email: string,
  password: string,
): Promise<{ userId: string; fullName?: string } | null> {
  try {
    const c = newCrmClient();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const meta = data.user.user_metadata ?? {};
    // Đăng xuất phiên CRM ngay để không giữ token trên server.
    await c.auth.signOut().catch(() => {});
    return {
      userId: data.user.id,
      fullName:
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined),
    };
  } catch {
    return null;
  }
}

/**
 * Verify credential khách SDWork. CRM lưu mostly đầu `0` (514 user) và một
 * số ít đầu `84` (5 user) → thử cả 2 dạng để chắc.
 */
export async function verifyWithSdwork(
  rawPhone: string,
  password: string,
): Promise<SsoVerifyResult> {
  if (!isSsoConfigured()) {
    return { ok: false, errorCode: "service_unavailable" };
  }
  const phone0 = toPhone0(rawPhone);
  const phone84 = toPhone84(rawPhone);

  // Thử đầu 0 trước (đa số khách); fallback 84 nếu CRM lưu kiểu kia.
  const candidates = phone0 === phone84
    ? [`${phone0}@${SDWORK_DOMAIN}`]
    : [`${phone0}@${SDWORK_DOMAIN}`, `${phone84}@${SDWORK_DOMAIN}`];

  for (const email of candidates) {
    const r = await tryEmail(email, password);
    if (r) {
      return {
        ok: true,
        email,
        phone0,
        sdworkUserId: r.userId,
        fullName: r.fullName,
      };
    }
  }
  return { ok: false, errorCode: "invalid_credentials" };
}

export { SDWORK_DOMAIN };
