// /api/admin/health — sức khoẻ hệ thống cho dashboard /quan-tri (admin only).
// Trả: cấu hình env, số tài khoản (tổng/premium/đăng nhập được), nhịp webhook
// gần nhất, migration tier đã apply chưa. TÌNH TRẠNG NGUỒN DỮ LIỆU (cá/bão/
// giá dầu/giá cảng) do CLIENT dashboard tự gọi các API sẵn có — không lặp lại
// logic nguồn ở đây.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) {
    return NextResponse.json(
      { ok: false, code: who.code },
      { status: who.status },
    );
  }
  const admin = createAdminClient();

  const env = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    webhookSecret: Boolean(process.env.SDWORK_WEBHOOK_SECRET),
    adminPhones: (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .filter((s) => s.trim()).length,
  };
  if (!admin) {
    return NextResponse.json({ ok: true, env, db: null });
  }

  const now = new Date().toISOString();
  const countAll = async (table: string) => {
    try {
      const { count: c, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      return error ? null : (c ?? 0);
    } catch {
      return null;
    }
  };
  // premium CÒN HIỆU LỰC (không hạn hoặc còn hạn) — khớp luật resolveTier
  const countPremium = async () => {
    try {
      const { count: c, error } = await admin
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("tier", "premium")
        .or(`premium_until.is.null,premium_until.gte.${now}`);
      return error ? null : (c ?? 0);
    } catch {
      return null;
    }
  };

  const [customers, premium, devices, supplies] = await Promise.all([
    countAll("customers"),
    countPremium(),
    countAll("devices"),
    countAll("supplies"),
  ]);

  // premium=null mà customers đếm được → cột tier chưa có = migration 0003
  // chưa apply (dashboard phải nói to điều này, không im lặng)
  const tierMigrationApplied = !(premium == null && customers != null);

  // nhịp webhook: bản ghi mới nhất trong customers (mọi event customer đều
  // chạm updated_at) — trễ lâu bất thường = webhook SDWork có thể đứt
  let lastIngestAt: string | null = null;
  try {
    const { data } = await admin
      .from("customers")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastIngestAt = (data?.updated_at as string) ?? null;
  } catch {
    /* bảng chưa có → null */
  }

  return NextResponse.json({
    ok: true,
    env,
    db: {
      customers,
      premiumActive: premium,
      devices,
      supplies,
      tierMigrationApplied,
      lastIngestAt,
    },
  });
}
