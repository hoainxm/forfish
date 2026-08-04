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

/*  ĐỌC 1 khoá — fetch REST + next.revalidate (route đọc giữ được CDN cache).
    PHÂN BIỆT HAI CA (2026-08-02, audit lô B):
     · `{ found: false }` — hỏi được máy chủ, đúng là CHƯA CÓ bản này.
     · `{ found: false, unreachable: true }` — KHÔNG HỎI ĐƯỢC (thiếu env, mạng
       Vercel↔Supabase chập chờn, 5xx).
    Trước đây cả năm nguyên nhân đều gộp thành `null` ⇒ route trả 404 ⇒ mà 404
    KHÔNG nằm trong `isRescuableStatus` của service worker (cố ý: "404 → nói
    thật") ⇒ máy ĐANG CÓ lưới 16 ngày trong kho vẫn nhận 404 thẳng vào mặt khi
    hạ tầng chập chờn. Đây là route duy nhất trong allowlist tự chặn đường cứu
    của chính mình. */
export async function loadWeatherSnapshot(
  id: string,
): Promise<{ payload: unknown | null; unreachable: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  /*  THIẾU CẤU HÌNH ≠ NGUỒN SẬP (2026-08-02b): demo mode / preview không có env
      thì đúng là KHÔNG CÓ bản nào, chứ không phải "không hỏi được". Trả
      `unreachable` ở đây làm route hoá 503 vĩnh viễn và mở đường cho service
      worker "cứu" bằng bản cũ ở môi trường lẽ ra chẳng có gì. */
  if (!url || !key) return { payload: null, unreachable: false };
  try {
    const r = await fetch(
      `${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=payload`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: SNAPSHOT_REVALIDATE },
      },
    );
    if (!r.ok) return { payload: null, unreachable: true };
    const rows = (await r.json()) as { payload?: unknown }[];
    return { payload: rows?.[0]?.payload ?? null, unreachable: false };
  } catch {
    return { payload: null, unreachable: true };
  }
}
