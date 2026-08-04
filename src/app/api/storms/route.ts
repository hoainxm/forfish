import { parseStorms } from "@/lib/storms";
import { timeoutSignal } from "@/lib/abort";

/**
 * Proxy cảnh báo bão: server gọi GDACS (tránh CORS phía trình duyệt),
 * cache 30 phút — tin bão không cần tươi hơn mức đó, đỡ đập nguồn miễn phí.
 * Nguồn fail → trả { ok: false }, client im lặng (không bao giờ nói
 * "không có bão" khi không chắc).
 *
 * NGUỒN HỎNG PHẢI TRẢ 503, KHÔNG PHẢI 200 (sửa 2026-07-31): service worker chỉ
 * cất phản hồi `res.ok` (public/sw.js), mà `Response.json({ok:false})` mặc định
 * là 200 ⇒ một lúc GDACS bảo trì trong khi tàu còn sóng ở cảng là ĐÈ MẤT bản
 * tin bão bà con đã tải — ra khơi không còn đường đi/vùng ảnh hưởng, và cổng
 * chặn tuyến cắt vùng bão cũng tắt theo. Client đã có nhánh `!r.ok → {ok:false}`
 * (lib/storms.ts) nên màn hình KHÔNG đổi: vẫn banner vàng "Chưa hỏi được".
 */
const GDACS_TC_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtypes=TC";

export async function GET() {
  try {
    const r = await fetch(GDACS_TC_URL, {
      next: { revalidate: 1800 },
      headers: { accept: "application/json" },
      signal: timeoutSignal(15000),
    });
    if (!r.ok) return Response.json({ ok: false }, { status: 503 });
    const json = await r.json();
    const now = new Date();
    return Response.json({
      ok: true,
      storms: parseStorms(json, now),
      checkedAt: now.toISOString(),
    });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
