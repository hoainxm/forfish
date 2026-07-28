// /api/admin/crons — SỨC KHOẺ CRON + PRECOMPUTE cho /quan-tri (admin only,
// 2026-07-26). "Cron chạy hay lỗi" đo bằng SỐ TRONG DB: tuổi bản ghi mới nhất
// so với nhịp kỳ vọng — cron chết thì tuổi phình, không cần hỏi GitHub/Vercel.
// Theo dõi:
// · fish_forecast_snapshot — cron refresh-fish (Vercel 02:00 UTC/ngày + GH
//   Actions 6h/lần dự phòng); tươi = generated_at ≤ SNAPSHOT_MAX_AGE (30h,
//   cùng luật route fallback). Kèm data_quality + target_date (ngày ảnh).
// · weather_snapshot — cron refresh-weather (Vercel 02:30 UTC/ngày): 10 cảng +
//   lưới d3; báo khoá cũ nhất/mới nhất + số khoá.
// · sea_daily / fish_forecast_daily / storm_events — COLLECTOR NGOÀI REPO chạy
//   theo ngày (xem docs/app-map/ops/external-services.md): tươi = collected_on
//   là hôm nay hoặc hôm qua (giờ VN).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  isSnapshotFresh,
  SNAPSHOT_MAX_AGE_MS,
} from "@/lib/fish-snapshot-policy";
import { isoDateVN } from "@/lib/day-labels";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Bảng collector theo NGÀY (collected_on) — bản mới nhất + số dòng của ngày đó */
async function dailyTable(admin: Admin, table: string) {
  try {
    const { data, error } = await admin
      .from(table)
      .select("collected_on")
      .order("collected_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    const latest = (data?.collected_on as string) ?? null;
    let rows = 0;
    if (latest) {
      const { count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("collected_on", latest);
      rows = count ?? 0;
    }
    return { ok: true as const, latest, rows };
  } catch {
    return { ok: false as const, error: "query_failed" };
  }
}

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) {
    return NextResponse.json(
      { ok: false, code: who.code },
      { status: who.status },
    );
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, code: "not_configured" },
      { status: 503 },
    );
  }

  const now = Date.now();
  const todayVN = isoDateVN();
  // "tươi" cho collector ngày: hôm nay hoặc hôm qua (collector chạy 1 lần/ngày,
  // giờ chạy có thể sau giờ xem dashboard)
  const yesterdayVN = new Date(
    new Date(`${todayVN}T00:00:00+07:00`).getTime() - 24 * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const dailyFresh = (latest: string | null) =>
    latest != null && latest >= yesterdayVN;

  // ── snapshot dự báo cá (cron refresh-fish) ─────────────────────────────
  const fish = await (async () => {
    try {
      const { data, error } = await admin
        .from("fish_forecast_snapshot")
        .select("target_date, data_quality, generated_at, updated_at")
        .eq("id", "latest")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message };
      if (!data) return { ok: true as const, exists: false as const };
      const generatedAt = (data.generated_at as string) ?? null;
      return {
        ok: true as const,
        exists: true as const,
        targetDate: (data.target_date as string) ?? null,
        dataQuality: (data.data_quality as number) ?? null,
        generatedAt,
        updatedAt: (data.updated_at as string) ?? null,
        fresh: isSnapshotFresh(generatedAt, now),
      };
    } catch {
      return { ok: false as const, error: "query_failed" };
    }
  })();

  // ── snapshot thời tiết (cron refresh-weather) ──────────────────────────
  const weather = await (async () => {
    try {
      const { data, error } = await admin
        .from("weather_snapshot")
        .select("id, updated_at")
        .order("updated_at", { ascending: false });
      if (error) return { ok: false as const, error: error.message };
      const rows = data ?? [];
      if (rows.length === 0) return { ok: true as const, keys: 0 };
      const newest = rows[0].updated_at as string;
      const oldest = rows[rows.length - 1].updated_at as string;
      // cùng ngưỡng 30h với cá: cron ngày + dư 6h trễ
      const fresh = now - Date.parse(newest) <= SNAPSHOT_MAX_AGE_MS;
      // khoá bị BỎ RƠI: cron mới chạy (newest tươi) mà khoá này vẫn cũ —
      // một cảng/lưới ghi hỏng liên tục
      const staleKeys = rows
        .filter(
          (r) =>
            now - Date.parse(r.updated_at as string) > SNAPSHOT_MAX_AGE_MS,
        )
        .map((r) => r.id as string);
      return {
        ok: true as const,
        keys: rows.length,
        newest,
        oldest,
        fresh,
        staleKeys,
      };
    } catch {
      return { ok: false as const, error: "query_failed" };
    }
  })();

  // ── collector theo ngày (NGOÀI repo) ───────────────────────────────────
  const [seaDaily, fishDaily, stormEvents] = await Promise.all([
    dailyTable(admin, "sea_daily"),
    dailyTable(admin, "fish_forecast_daily"),
    dailyTable(admin, "storm_events"),
  ]);

  return NextResponse.json({
    ok: true,
    now: new Date(now).toISOString(),
    fish,
    weather,
    daily: {
      sea_daily: seaDaily.ok
        ? { ...seaDaily, fresh: dailyFresh(seaDaily.latest) }
        : seaDaily,
      fish_forecast_daily: fishDaily.ok
        ? { ...fishDaily, fresh: dailyFresh(fishDaily.latest) }
        : fishDaily,
      // storm_events CHỈ ghi khi có bão/ATNĐ — ngày biển yên không có dòng mới
      // là BÌNH THƯỜNG, không được phán "trễ" (fresh: null = không chấm)
      storm_events: stormEvents.ok
        ? { ...stormEvents, fresh: null }
        : stormEvents,
    },
  });
}
