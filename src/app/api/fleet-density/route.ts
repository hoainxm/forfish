// /api/fleet-density — NỀN MẬT ĐỘ TÀU 16 ngày theo nghề (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #7).
//
// Trước: máy tải cả lưới giờ đánh (7 MB, dựng từ dữ liệu đội tàu) + hàm dựng nền chạy trên máy. Nay MÁY CHỦ dựng nền
// mùa × trăng (chấm theo vùng) cho 16 ngày từ `tu`; máy nhận số, cất cả bộ (offline đủ chuyến), tự nhân gió/bão.
// Gác ở middleware (data-route-rules: tài khoản + gói, như lớp bản đồ cho bán). `tu` sai/xa hôm nay quá 2 ngày ⇒
// dùng hôm nay (máy giờ sai không làm lệch cả bộ). Nguồn/đường file hỏng ⇒ 503 mã chung — máy giữ bản đã cất.
import { DENSITY_GEARS, type DensityGear } from "@/lib/fleet-density";
import { docFleetDensity, nenFleet } from "@/lib/fleet-density-server";
import { daysBetweenISO, isoDateVN } from "@/lib/day-labels";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NGHE = new Set<string>(DENSITY_GEARS.map((g) => g.id));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const nghe = q.get("nghe") ?? "tat";
  if (!NGHE.has(nghe)) return Response.json({ ok: false, code: "bad_query" }, { status: 400 });
  const homNay = isoDateVN(Date.now());
  const xin = q.get("tu") ?? "";
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(xin) && Math.abs(daysBetweenISO(homNay, xin)) <= 2 ? xin : homNay;
  try {
    const body = nenFleet(docFleetDensity(), tu, nghe as DensityGear, new Date().toISOString());
    return Response.json(body, {
      // cùng (nghề, ngày) thì mọi máy cùng một bản — CDN giữ; private vì đã qua cổng gói
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    console.error("[fleet-density] dựng nền hỏng:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
}
