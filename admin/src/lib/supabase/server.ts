import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client (route handlers) — đọc session từ cookie của web quản trị. */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // gọi từ Server Component — bỏ qua, middleware lo refresh
        }
      },
    },
  });
}
