import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionKey } from "@/lib/admin-activity";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Ghi một dòng vào admin_activity_log (0019). Trả `true` khi ghi được.
 *
 * KHÔNG CHẶN thao tác chính (log hỏng thì thao tác vẫn xong) NHƯNG cũng KHÔNG
 * IM LẶNG: bản đầu (2026-07-30) chỉ `await ... .insert()` trong try/catch —
 * mà supabase-js KHÔNG ném lỗi, nó TRẢ `{ error }`. Nên mọi lần ghi hỏng đều
 * biến mất không dấu vết: prod chạy một ngày, có thao tác staff thật mà bảng
 * nhật ký vẫn rỗng, không ai biết vì sao (phát hiện 2026-07-31). Với một bảng
 * dựng ra để "chống thao tác bậy" thì im lặng là hỏng nặng nhất.
 *
 * Nay: đọc `error`, in console.error (thấy được ở Vercel runtime logs) kèm mã
 * lỗi PostgREST, và trả cờ để caller nói thật với người dùng.
 * KHÔNG log bí mật (mật khẩu, token) vào `detail`.
 */
export async function logActivity(
  admin: Admin,
  entry: {
    actorPhone: string;
    actorRole: string;
    action: AdminActionKey;
    target?: string | null;
    detail?: Record<string, unknown> | null;
  },
): Promise<boolean> {
  try {
    const { error } = await admin.from("admin_activity_log").insert({
      actor_phone: entry.actorPhone,
      actor_role: entry.actorRole,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
    });
    if (error) {
      console.error("[activity-log] GHI NHẬT KÝ HỎNG", {
        action: entry.action,
        actor: entry.actorPhone,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[activity-log] GHI NHẬT KÝ NÉM LỖI", {
      action: entry.action,
      actor: entry.actorPhone,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
