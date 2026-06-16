import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client (SERVICE ROLE) — server-only, BYPASS RLS. Chỉ dùng trong route
 * handler đặc quyền: webhook ingest (ghi customers/devices/supplies), OTP
 * verify (đảm bảo user + cấp link đăng nhập). Trả null khi chưa cấu hình để
 * caller degrade (như demo mode). KHÔNG bao giờ import vào client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
