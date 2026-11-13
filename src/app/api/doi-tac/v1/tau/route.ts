// GET /api/doi-tac/v1/tau — API ĐỐI TÁC: vị trí tàu AIS trong các KHU VỰC đối tác đã mua, ở bản THEO GÓI (60/30 phút,
// `tau-ais:goi-N` — ghi ở POST /api/tau-ais/nhap). Cửa Bearer ở lib/doi-tac-cua; lọc `zone` / `bbox` / `type` / `mmsi` + khuôn
// công khai ở lib/doi-tac (thuần, có test). `zone` ngoài license ⇒ 403. Chưa có bản ⇒ 404 `no_data`; kho hỏng ⇒ 503.
// Không cache CDN (có khoá). Tài liệu gửi khách: docs/integration/api-doi-tac-ais.md.
import { cuaDoiTac } from "@/lib/doi-tac-cua";
import { banGoiId, docLocTau, locTau } from "@/lib/doi-tac";
import type { TauAisBan } from "@/lib/tau-ais";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const cua = await cuaDoiTac(req);
  if ("res" in cua) return cua.res;
  const { dt, maId } = cua;
  const l = docLocTau(new URL(req.url).searchParams, dt.khu);
  if ("loi" in l) return Response.json({ ok: false, code: l.loi }, { status: l.loi === "zone_not_licensed" ? 403 : 400, headers: NO_STORE });
  const { payload, unreachable } = await loadWeatherSnapshot(banGoiId(dt.goi), { noStore: true });
  if (unreachable) return Response.json({ ok: false, code: "source_down" }, { status: 503, headers: NO_STORE });
  const ban = payload as TauAisBan | null;
  if (!ban || typeof ban.luc !== "string" || !Array.isArray(ban.tau))
    return Response.json({ ok: false, code: "no_data" }, { status: 404, headers: NO_STORE });
  const vessels = locTau(ban, l.loc, maId);
  const next = new Date(Date.parse(ban.luc) + dt.goi * 60_000).toISOString();
  return Response.json(
    { ok: true, updated_at: ban.luc, next_update_at: next, plan_minutes: dt.goi, zones: l.loc.khu, count: vessels.length, vessels },
    { headers: NO_STORE },
  );
}
