// /api/om/[api] — CẦU OPEN-METEO cho máy bà con (2026-10-27, anh Long: "tất cả tải lưu server đi"; thường chỉ xem
// HÔM NAY, nhiều ngày nằm trong gói). Gác số ngày ở MIDDLEWARE (lib/data-route-rules: `forecast_days` ≤ 1 ai cũng
// xin được, quá thì cần gói); route chỉ kiểm danh sách trắng (lib/om-url), đọc nguồn, trả nguyên văn.
//
// Cache: CDN theo đủ URL (lưới cố định ⇒ mọi máy cùng một URL ⇒ một lượt nguồn cho cả trăm máy — đỡ hẳn hạn ngạch IP
// so với lúc mỗi máy tự gọi). 30 phút + dùng tạm bản cũ tới 1 giờ khi đang lấy bản mới.
// Lỗi: 429/5xx/hết giờ của nguồn ⇒ 503 (client coi là "không hỏi được", rơi về snapshot / bản trong máy);
// 400 của nguồn (vd model không đủ ngày) ⇒ 400 — nói thật, không đổi thành 200.
// nợ: thân phản hồi Vercel ≤ 4,5 MB — lưới dải màu 16 ngày × 156 điểm ~2 MB hôm nay; nâng (cắt gọn ở máy chủ) khi
// lưới dày thêm hoặc Vercel báo FUNCTION_PAYLOAD_TOO_LARGE.
import { omUpstream } from "@/lib/om-url";
import { timeoutSignal } from "@/lib/abort";

export const maxDuration = 30;

type Ctx = { params: Promise<{ api: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { api } = await params;
  const url = omUpstream(api, new URL(req.url).searchParams);
  if (!url) return Response.json({ ok: false, code: "bad_query" }, { status: 400 });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SDFish/1.0 (+forfish)" },
      signal: timeoutSignal(25_000),
    });
    if (res.status === 400) {
      return new Response(await res.text(), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!res.ok) return Response.json({ ok: false, code: "source_down" }, { status: 503 });
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  }
}
