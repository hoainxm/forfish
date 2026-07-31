import { parseDieselDo } from "@/lib/fuel-price";

/**
 * Giá dầu DO 0,05S hôm nay (giaxanghomnay.com → Petrolimex). Cache 6h. Giá
 * điều hành theo kỳ (thứ Năm) nên dùng ngày hôm nay làm khoá; nguồn carry-forward
 * giá kỳ gần nhất.
 *
 * NGUỒN HỎNG → HTTP 503, KHÔNG PHẢI 200 kèm {ok:false} (2026-07-31, chủ dự án:
 * "ra offline thì cứ dùng giá cũ, hiển thị giá cũ thì người ta vẫn biết giá đó
 * ngày nào"). Service worker chỉ cất bản `res.ok`, nên 200-kèm-lỗi cũ ĐÈ MẤT
 * giá tốt đã tải ở bờ — đúng thứ bà con cần lúc mất sóng. Với 503, SW giữ bản
 * cũ và trả lại nó; UI in kèm ngày kỳ giá (price-board.tsx:104) nên không ai
 * nhầm là giá hôm nay. Client `fetchFuelPrice` đã có nhánh `!r.ok → null`.
 */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch(`https://giaxanghomnay.com/api/pvdate/${today}`, {
      next: { revalidate: 21600 },
      headers: { "user-agent": "Mozilla/5.0 (SDFish fuel bot)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return Response.json({ ok: false }, { status: 503 });
    const fuel = parseDieselDo(await r.json());
    if (!fuel) return Response.json({ ok: false }, { status: 503 });
    return Response.json({ ok: true, fuel });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
