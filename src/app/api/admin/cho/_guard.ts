import "server-only";
// CỔNG + NHẬT KÝ dùng chung cho /api/admin/cho/* (Chợ vật tư — 12 §7.3).
// Mọi route của khu này đi qua requirePermission("cho-vat-tu", …) — admin luôn
// qua; quản lý theo bảng quyền (2026-10-28 chủ dự án mở cấu hình: GET=view ·
// PATCH=edit; trước đó admin-only, nợ manager 12 §12).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActionKey } from "@/lib/admin-activity";
import type { PermAction } from "@/lib/staff-permissions";
import type { ShopStatus } from "@/lib/market/types";

export type MarketAdminGate =
  | { ok: true; phone: string; role: "admin" | "manager" }
  | { ok: false; res: NextResponse };

/** requirePermission("cho-vat-tu", action) → phone + vai, hoặc phản hồi lỗi ĐÚNG KHUÔN {ok:false, code} + status. */
export async function requireMarketAdmin(action: PermAction): Promise<MarketAdminGate> {
  const who = await requirePermission("cho-vat-tu", action);
  if (who.ok) return { ok: true, phone: who.phone, role: who.role };
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
  who: { phone: string; role: "admin" | "manager" },
  action: AdminActionKey,
  target: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
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
