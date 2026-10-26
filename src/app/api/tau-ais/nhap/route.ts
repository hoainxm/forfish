// POST /api/tau-ais/nhap — MÁY THU AIS (gpu-desktop, scripts/tau-ais-thu.mjs) gửi một BẢN vị trí
// tàu quanh biển VN mỗi ~10 phút. Cửa: `x-tau-ais-key` (lib/tau-ais/khoa). Máy chủ kiểm lại từng
// hàng (lib/tau-ais/chuan-hoa kiemGoi) rồi GHI ĐÈ một khoá snapshot `tau-ais:latest` trong bảng
// snapshot chung (`weather_snapshot`, lib/weather-snapshot — không thêm bảng mới). Client đọc ở
// GET /api/tau-ais. Gói: { luc: iso, tau: [{ id, ten, loai, co, lat, lon, kn, huong, mui, phut, dai, dich }] }.
import { kiemGoi } from "@/lib/tau-ais/chuan-hoa.mjs";
import { tauAisKeyDenied } from "@/lib/tau-ais/khoa";
import { TAU_AIS_SNAPSHOT_ID } from "@/lib/tau-ais";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: Request) {
  const denied = await tauAisKeyDenied(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const r = kiemGoi(body);
  if (!r.ok || !r.ban) return Response.json({ ok: false, code: r.code ?? "bad_body" }, { status: 400 });
  const saved = await saveWeatherSnapshot(TAU_AIS_SNAPSHOT_ID, r.ban);
  if (!saved) return Response.json({ ok: false, code: "store_down" }, { status: 503 });
  return Response.json({ ok: true, soTau: r.ban.soTau, luc: r.ban.luc });
}
