import { getCronSecret } from "@/lib/app-config";
import { lamMoiThoiTiet } from "@/lib/thoi-tiet-lam-moi";

// CRON PRECOMPUTE thời tiết — logic ghép hai nguồn ở lib/thoi-tiet-lam-moi (dùng chung với
// /api/thoi-tiet/nhap: máy nhà tải nguồn Open-Meteo rồi gửi gói lên, 2026-10-30).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = await getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  return Response.json(await lamMoiThoiTiet());
}
