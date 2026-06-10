import { parseStorms } from "@/lib/storms";

/**
 * Proxy cảnh báo bão: server gọi GDACS (tránh CORS phía trình duyệt),
 * cache 30 phút — tin bão không cần tươi hơn mức đó, đỡ đập nguồn miễn phí.
 * Nguồn fail → trả { ok: false }, client im lặng (không bao giờ nói
 * "không có bão" khi không chắc).
 */
const GDACS_TC_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtypes=TC";

export async function GET() {
  try {
    const r = await fetch(GDACS_TC_URL, {
      next: { revalidate: 1800 },
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return Response.json({ ok: false });
    const json = await r.json();
    const now = new Date();
    return Response.json({
      ok: true,
      storms: parseStorms(json, now),
      checkedAt: now.toISOString(),
    });
  } catch {
    return Response.json({ ok: false });
  }
}
