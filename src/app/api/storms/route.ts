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
/*  ⚠️ THAM SỐ LÀ `eventtype`, SỐ ÍT — ĐỪNG ĐỔI (sửa 2026-08-18).
    LỖI ĐÃ SỬA, bắt được từ hiện trường: người của SDVICO báo *"đài dự báo áp
    thấp nhiệt đới trên Biển Đông mà app chưa cập nhật"* (18/8). Đo thẳng vào
    nguồn thì URL cũ dùng `?eventtypes=TC` (số nhiều) và GDACS trả **HTTP 400
    `{"message":"Eventtype is required."}`**, còn `?eventtype=TC` trả 200 với
    565 KB dữ liệu. Nghĩa là `/api/storms` đã KHÔNG lấy được gì suốt từ lúc
    GDACS siết tham số — mọi máy chỉ thấy "Chưa hỏi được tin bão".
    Nhánh `!r.ok` bên dưới xử đúng (503, không nói dối "không có bão"), nên lỗi
    này IM LẶNG: app không sập, không báo đỏ, chỉ là **không bao giờ có tin bão
    nào**. Đúng thứ nguy hiểm nhất với trục 1. Nay log rõ mã lỗi để lần sau có
    dấu vết, và có cổng test canh tham số (`storms-source.test.ts`). */
const GDACS_TC_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC";

export async function GET() {
  try {
    const r = await fetch(GDACS_TC_URL, {
      next: { revalidate: 1800 },
      headers: { accept: "application/json" },
      signal: timeoutSignal(15000),
    });
    if (!r.ok) {
      // ĐỪNG NUỐT IM: nguồn đổi hợp đồng (400/404) trông y hệt nguồn bảo trì
      // (5xx) ở phía client — chỉ log này phân biệt được, và nó là thứ đáng lẽ
      // đã cho biết lỗi `eventtypes` từ ngày đầu.
      console.error("[storms] GDACS trả", r.status, r.statusText, GDACS_TC_URL);
      return Response.json({ ok: false }, { status: 503 });
    }
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
