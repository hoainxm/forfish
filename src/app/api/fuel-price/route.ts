import { parseDieselDo } from "@/lib/fuel-price";

/**
 * Giá dầu DO 0,05S hôm nay (giaxanghomnay.com → Petrolimex). Cache 6h. Giá
 * điều hành theo kỳ (thứ Năm) nên dùng ngày hôm nay làm khoá; nguồn carry-forward
 * giá kỳ gần nhất. Nguồn fail → { ok:false }, UI ẩn dòng giá dầu.
 */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch(`https://giaxanghomnay.com/api/pvdate/${today}`, {
      next: { revalidate: 21600 },
      headers: { "user-agent": "Mozilla/5.0 (ForFish fuel bot)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return Response.json({ ok: false });
    const fuel = parseDieselDo(await r.json());
    if (!fuel) return Response.json({ ok: false });
    return Response.json({ ok: true, fuel });
  } catch {
    return Response.json({ ok: false });
  }
}
