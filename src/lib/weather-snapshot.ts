import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SNAPSHOT_REVALIDATE } from "@/lib/fish-snapshot-policy";

/*
  SNAPSHOT THỜI TIẾT (Open-Meteo) — LƯỚI AN TOÀN, không thay live.

  Khác dự báo cá (snapshot là CHÍNH vì nguồn nặng/hay-treo): Open-Meteo nhanh +
  ổn định nên client vẫn gọi LIVE trực tiếp (tải phân tán theo IP từng máy — tốt
  cho rate-limit). Snapshot server (cron ghi mỗi ngày) CHỈ dùng khi live lỗi và
  máy chưa có bản localStorage. Đọc/ghi qua service-role; đọc phía client đi qua
  /api/weather-snapshot (same-origin, SW cache được).

  Nhiều khoá 1 bảng: id = `sea:<port>` | `grid:d3` (xem weather-snapshot-id.ts).
*/

const TABLE = "weather_snapshot";

/** GHI 1 khoá snapshot (service-role). Luôn ghi đè bản mới nhất — thời tiết
    không có khái niệm "lùi ngày". Trả true nếu ghi được. */
export async function saveWeatherSnapshot(
  id: string,
  payload: unknown,
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin || payload == null) return false;
  const { error } = await admin.from(TABLE).upsert({
    id,
    payload,
    updated_at: new Date().toISOString(),
  });
  return !error;
}

/** ĐỌC 1 khoá — fetch REST + next.revalidate (route đọc giữ được CDN cache).
    null nếu chưa có / lỗi / chưa cấu hình. */
export async function loadWeatherSnapshot(id: string): Promise<unknown | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=payload`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: SNAPSHOT_REVALIDATE },
      },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as { payload?: unknown }[];
    return rows?.[0]?.payload ?? null;
  } catch {
    return null;
  }
}
