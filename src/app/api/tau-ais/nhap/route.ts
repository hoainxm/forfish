// POST /api/tau-ais/nhap — MÁY THU AIS (gpu-desktop, scripts/tau-ais-thu.mjs) gửi một BẢN vị trí
// tàu quanh biển VN mỗi ~10 phút. Cửa: `x-tau-ais-key` (lib/tau-ais/khoa). Máy chủ kiểm lại từng
// hàng (lib/tau-ais/chuan-hoa kiemGoi) rồi GHI ĐÈ một khoá snapshot `tau-ais:latest` trong bảng
// snapshot chung (`weather_snapshot`, lib/weather-snapshot — không thêm bảng mới). Client đọc ở
// GET /api/tau-ais. Gói: { luc: iso, tau: [{ id, ten, loai, co, lat, lon, kn, huong, mui, phut, dai, dich }] }.
// THÂN NÉN (2026-10-29, vùng quét cả Biển Đông ~25–30 nghìn tàu): Vercel chặn thân request > 4,5 MB ⇒ máy thu gửi
// `content-encoding: gzip`; ở đây tự giải (vẫn nhận thân thường cho máy thu đời cũ). Trần sau giải nén 40 MB.
import { kiemGoi } from "@/lib/tau-ais/chuan-hoa.mjs";
import { tauAisKeyDenied } from "@/lib/tau-ais/khoa";
import { TAU_AIS_SNAPSHOT_ID } from "@/lib/tau-ais";
import { saveWeatherSnapshot } from "@/lib/weather-snapshot";
import { gunzipSync } from "node:zlib";

const TRAN_GIAI_NEN = 40 * 1024 * 1024;

/** Đọc thân JSON, giải gzip khi máy thu báo nén. Hỏng / quá trần ⇒ null (route trả 400). */
async function docThan(req: Request): Promise<unknown> {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    const raw = nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf;
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: Request) {
  const denied = await tauAisKeyDenied(req);
  if (denied) return denied;
  const body = await docThan(req);
  const r = kiemGoi(body);
  if (!r.ok || !r.ban) return Response.json({ ok: false, code: r.code ?? "bad_body" }, { status: 400 });
  const saved = await saveWeatherSnapshot(TAU_AIS_SNAPSHOT_ID, r.ban);
  if (!saved) return Response.json({ ok: false, code: "store_down" }, { status: 503 });
  return Response.json({ ok: true, soTau: r.ban.soTau, luc: r.ban.luc });
}
