// Admin client (service_role) — SERVER ONLY. Dùng trong route /api/* để
// tạo/đăng nhập user qua SDWork SSO. KHÔNG bao giờ import từ client component.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
