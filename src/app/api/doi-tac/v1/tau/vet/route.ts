// GET /api/doi-tac/v1/tau/vet?id= | ?mmsi= — API ĐỐI TÁC: đường đi 7 ngày của MỘT tàu (bảng tau_ais_vet, một điểm/giờ),
// CHỈ các điểm nằm trong khu vực đối tác đã mua (lib/doi-tac-khu-vuc). `id` là mã CÔNG KHAI (lib/doi-tac idCongKhai) ⇒ tra ngược
// ra mã nội bộ trong bản theo gói của đối tác, như `mmsi`. Tàu đã rời bản ⇒ 404 (HMAC không đảo được — nợ: cần bảng ánh xạ nếu
// đối tác cần vết tàu đã tắt máy phát quá lâu).
// Id không cố định (mã vệ tinh đổi mỗi bản) ⇒ 400 `track_unavailable`. Chưa có điểm ⇒ 200 mảng rỗng. Kho hỏng ⇒ 503.
import { cuaDoiTac } from "@/lib/doi-tac-cua";
import { banGoiId, timIdNoiBo } from "@/lib/doi-tac";
import { khuVucCua } from "@/lib/doi-tac-khu-vuc";
import { gopVet, idCoDinh } from "@/lib/tau-ais/chuan-hoa.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TauAisBan } from "@/lib/tau-ais";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const NO_STORE = { "cache-control": "no-store" };
const tra = (status: number, body: object) => Response.json(body, { status, headers: NO_STORE });

export async function GET(req: Request) {
  const cua = await cuaDoiTac(req);
  if ("res" in cua) return cua.res;
  const { dt, maId } = cua;
  const sp = new URL(req.url).searchParams;
  const ma = sp.get("id");
  const mmsi = sp.get("mmsi");
  if (!ma && !mmsi) return tra(400, { ok: false, code: "missing_id" });
  if (!ma && !/^\d{9}$/.test(mmsi!)) return tra(400, { ok: false, code: "bad_mmsi" });
  const { payload, unreachable } = await loadWeatherSnapshot(banGoiId(dt.goi), { noStore: true });
  if (unreachable) return tra(503, { ok: false, code: "source_down" });
  const ban = payload as TauAisBan | null;
  const id = ma ? timIdNoiBo(ban, ma, maId) : (ban?.tau?.find((x) => x.mmsi === Number(mmsi))?.id ?? null);
  if (!id) return tra(404, { ok: false, code: "vessel_not_found" });
  if (!idCoDinh(id)) return tra(400, { ok: false, code: "track_unavailable" });
  const admin = createAdminClient();
  if (!admin) return tra(503, { ok: false, code: "source_down" });
  const { data, error } = await admin.from("tau_ais_vet").select("ngay, diem").eq("tau_id", id).order("ngay");
  if (error) {
    console.error("[đối tác] đọc đường đi hỏng:", error.message);
    return tra(503, { ok: false, code: "source_down" });
  }
  const points = [];
  for (const p of gopVet(data) as { t: number; lat: number; lon: number; kn: number | null }[]) {
    const zone = khuVucCua(p.lat, p.lon);
    if (zone == null || !dt.khu.includes(zone)) continue;
    points.push({ time: new Date(p.t * 1000).toISOString(), lat: p.lat, lon: p.lon, speed_kn: p.kn, zone });
  }
  return tra(200, { ok: true, id: maId(id), count: points.length, points });
}
