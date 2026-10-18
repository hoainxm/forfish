import "server-only";
// CỔNG + NHẬT KÝ dùng chung cho /api/admin/cho/* (Chợ vật tư — 12 §7.3).
// Mọi route của khu này đi qua requireAdmin() (LEAD §4 #13: quản lý chưa được
// cấp quyền sàn — nợ manager, xem 12 §12).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionKey } from "@/lib/admin-activity";
import type { ShopStatus } from "@/lib/market/types";

export type MarketAdminGate =
  | { ok: true; phone: string }
  | { ok: false; res: NextResponse };

/** requireAdmin() → phone, hoặc phản hồi lỗi ĐÚNG KHUÔN {ok:false, code} + status. */
export async function requireMarketAdmin(): Promise<MarketAdminGate> {
  const who = await requireAdmin();
  if (who.ok) return { ok: true, phone: who.phone };
  return {
    ok: false,
    res: NextResponse.json({ ok: false, code: who.code }, { status: who.status }),
  };
}

/**
 * Ghi nhật ký admin (bảng admin_activity_log) — BEST-EFFORT, không chặn việc
 * chính. Kho file dev không có service-role ⇒ bỏ qua im lặng (nhật ký là của
 * prod); prod thiếu service-role thì mọi route đã 503 từ trước đó.
 */
export async function logMarketAdmin(
  phone: string,
  action: AdminActionKey,
  target: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await logActivity(admin, {
    actorPhone: phone,
    actorRole: "admin",
    action,
    target,
    detail,
  });
}

export const SHOP_STATUS_VALUES: readonly ShopStatus[] = [
  "cho_duyet",
  "hoat_dong",
  "tam_khoa",
  "tu_choi",
];
export function isShopStatus(v: unknown): v is ShopStatus {
  return typeof v === "string" && (SHOP_STATUS_VALUES as readonly string[]).includes(v);
}

/** ?page= → số trang ≥ 1 (rác ⇒ 1). */
export function pageParam(sp: URLSearchParams): number {
  const n = Number(sp.get("page"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
