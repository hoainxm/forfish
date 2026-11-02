// GET /api/doi-tac/v1/trang-thai — API ĐỐI TÁC: thử khoá + phạm vi license + độ mới bản theo gói (gọi đầu tiên khi kết nối).
import { cuaDoiTac } from "@/lib/doi-tac-cua";
import { banGoiId } from "@/lib/doi-tac";
import { KHU_VUC } from "@/lib/doi-tac-khu-vuc";
import type { TauAisBan } from "@/lib/tau-ais";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: Request) {
  const cua = await cuaDoiTac(req);
  if ("res" in cua) return cua.res;
  const { dt } = cua;
  const { payload, unreachable } = await loadWeatherSnapshot(banGoiId(dt.goi), { noStore: true });
  const ban = payload as TauAisBan | null;
  const luc = ban && typeof ban.luc === "string" ? ban.luc : null;
  return Response.json(
    {
      ok: true,
      partner: dt.ten,
      plan_minutes: dt.goi,
      zones: KHU_VUC.filter((k) => dt.khu.includes(k.n)).map((k) => ({ zone: k.n, name: k.ten })),
      data_available: !unreachable && !!luc,
      updated_at: luc,
      next_update_at: luc ? new Date(Date.parse(luc) + dt.goi * 60_000).toISOString() : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
