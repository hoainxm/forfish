// GET /api/tau-ais — bản vị trí tàu AIS mới nhất quanh biển VN (máy thu ghi ở POST …/nhap).
// Gác ở middleware (data-route-rules: cần tài khoản, xô data, KHÔNG premium — lớp bản đồ miễn phí).
// Đọc thẳng bản mới nhất (noStore) nhưng cho CDN giữ 2 phút — vài nghìn máy bật lớp không dội DB.
// Chưa có bản ⇒ 404 nói thật (client dùng bản máy đã lưu); không hỏi được kho ⇒ 503 (SW cứu bản cũ).
import { TAU_AIS_SNAPSHOT_ID } from "@/lib/tau-ais";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const { payload, unreachable } = await loadWeatherSnapshot(TAU_AIS_SNAPSHOT_ID, { noStore: true });
  if (unreachable) return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  if (payload == null) return Response.json({ ok: false, code: "chua_co" }, { status: 404 });
  return Response.json(payload, {
    headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=900" },
  });
}
