import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FishForecastResult } from "@/lib/fish-predict";
import {
  shouldReplaceSnapshot,
  SNAPSHOT_REVALIDATE,
} from "@/lib/fish-snapshot-policy";

/*
  SNAPSHOT DỰ BÁO CÁ — precompute lưu trên Supabase (2026-07-26).

  Vì sao: /api/fish-forecast tính TẠI CHỖ kéo 7 nguồn (ERDDAP + HYCOM OPeNDAP +
  Copernicus Zarr), nguồn nặng + hay treo → lần tính lạnh chậm/hỏng ("dự báo cá
  chưa tải được"). Nay CRON (/api/cron/refresh-fish) tính sẵn theo lịch rồi ghi
  1 dòng singleton; route chỉ ĐỌC dòng đó (nhanh, không phụ thuộc nguồn treo).

  Bảng `fish_forecast_snapshot` (migration 0005): đọc/ghi CHỈ qua service-role
  (RLS bật, không policy). Chưa apply migration / chưa cấu hình env → mọi hàm
  degrade êm (null / không ghi) và route tự tính fallback = hành vi cũ.
*/

const TABLE = "fish_forecast_snapshot";
const ROW_ID = "latest";

/**
 * GHI snapshot mới (service-role, bypass RLS). Chỉ ghi khi bản mới TỐT NGANG
 * hoặc HƠN bản đang có (`shouldReplaceSnapshot`). Trả `{saved, reason}` để cron
 * nói thật.
 */
export async function saveFishSnapshot(
  payload: FishForecastResult,
): Promise<{ saved: boolean; reason: string }> {
  const admin = createAdminClient();
  if (!admin) return { saved: false, reason: "no-admin-client" };
  if (payload.ok !== true) return { saved: false, reason: "payload-not-ok" };

  const { data: cur } = await admin
    .from(TABLE)
    .select("target_date")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (!shouldReplaceSnapshot(cur?.target_date ?? null, payload)) {
    return { saved: false, reason: "not-newer" };
  }

  const { error } = await admin.from(TABLE).upsert({
    id: ROW_ID,
    payload,
    target_date: payload.targetDate ?? null,
    data_quality: payload.dataQuality ?? null,
    generated_at: payload.generatedAt ?? null,
    updated_at: new Date().toISOString(),
  });
  return { saved: !error, reason: error ? error.message : "ok" };
}

/**
 * ĐỌC snapshot đã lưu — fetch REST + `next.revalidate` để route giữ được ISR
 * (30 phút). Trả payload nếu có và `ok`; null khi chưa có / lỗi / chưa cấu hình
 * (caller tự tính fallback → không bao giờ trắng bản đồ).
 */
export async function loadFishSnapshot(): Promise<FishForecastResult | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=payload`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: SNAPSHOT_REVALIDATE },
      },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as { payload?: FishForecastResult }[];
    const payload = rows?.[0]?.payload;
    return payload && payload.ok === true ? payload : null;
  } catch {
    return null;
  }
}
