/**
 * Demo mode PHẢI tường minh (rà Codex 2026-10-18).
 *
 * Trước đây cổng dữ liệu thấy thiếu env Supabase là mở hết "cho demo" — kể cả
 * trên production. Một lần deploy quên env là mất sạch lớp bảo vệ (401/403/429)
 * mà không ai hay, vì app vẫn chạy bình thường.
 *
 * Luật: thiếu env chỉ được coi là demo khi KHÔNG phải bản production, hoặc khi
 * người chạy bật cờ rõ ràng (SDFISH_DEMO=1, hay E2E_DEMO_BUILD=1 của harness
 * quay video). Còn lại là "misconfigured" ⇒ route dữ liệu trả 503, không mở.
 * 503 chứ không 401: lỗi của máy chủ, không bắt bà con đăng nhập lại.
 */
export type SupabaseMode = "configured" | "demo" | "misconfigured";

export function supabaseMode(env: Record<string, string | undefined> = process.env): SupabaseMode {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "configured";
  if (env.NODE_ENV !== "production") return "demo";
  if (env.SDFISH_DEMO === "1" || env.E2E_DEMO_BUILD === "1") return "demo";
  return "misconfigured";
}
