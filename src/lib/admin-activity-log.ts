import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionKey } from "@/lib/admin-activity";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Ghi một dòng vào admin_activity_log (0019). FIRE-AND-FORGET: log hỏng KHÔNG
 * được chặn/ngã thao tác chính — bọc try/catch, không ném ra ngoài. KHÔNG log
 * bí mật (mật khẩu, token) vào `detail`.
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
): Promise<void> {
  try {
    await admin.from("admin_activity_log").insert({
      actor_phone: entry.actorPhone,
      actor_role: entry.actorRole,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    /* bảng chưa có (0019 chưa apply) / lỗi mạng → bỏ qua, không chặn thao tác */
  }
}
