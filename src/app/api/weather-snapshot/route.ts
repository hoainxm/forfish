import { loadWeatherSnapshot } from "@/lib/weather-snapshot";
import { isValidSnapshotId } from "@/lib/weather-snapshot-id";

/**
 * ĐỌC snapshot thời tiết (LƯỚI AN TOÀN) — client gọi khi live Open-Meteo lỗi.
 * Public: dữ liệu thời tiết KHÔNG cá nhân, và client vốn đã tải được từ live
 * trực tiếp (không lộ thêm gì; lưới chỉ snapshot khung miễn phí d3 — xem
 * weather-snapshot-id.ts). Whitelist id để không thành proxy đọc bảng tuỳ ý.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isValidSnapshotId(id)) {
    return Response.json({ ok: false, code: "bad_id" }, { status: 400 });
  }
  const payload = await loadWeatherSnapshot(id);
  if (payload == null) {
    return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  // CDN + SW cache theo từng id (thời tiết đổi chậm; cron làm mới mỗi ngày)
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
