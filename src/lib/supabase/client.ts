import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to import in client components.
 * Returns null when env isn't configured yet, so the app still renders
 * in "demo mode" (local data) before the project is wired up.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
