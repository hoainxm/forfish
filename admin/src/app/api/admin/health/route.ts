// Sức khoẻ hệ thống cho dashboard: env của WEB QUẢN TRỊ + số liệu DB chung
// (customers/premium/devices/supplies), migration tier đã apply chưa, nhịp
// webhook gần nhất. Tình trạng NGUỒN dữ liệu app chính → /api/admin/sources.
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
    appUrl: process.env.FORFISH_APP_URL ?? null,
    adminApiKey: Boolean(process.env.ADMIN_API_KEY),
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
  // premium CÒN HIỆU LỰC — khớp luật resolveTier (lib/tier.ts)
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

  const tierMigrationApplied = !(premium == null && customers != null);

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
