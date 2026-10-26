import "server-only";
import { getConfigValue } from "@/lib/app-config";
import { checkIngestKey, effectiveIngestKey } from "@/lib/kairos/ingest-key";

/**
 * Cửa máy thu AIS (POST /api/tau-ais/nhap): header `x-tau-ais-key` so thời-gian-hằng với khoá
 * hiệu lực — env TAU_AIS_KEY đè, không thì `app_config.tau_ais_key` (admin đổi ở /quan-tri).
 * Thiếu cả hai ⇒ 503, KHÔNG BAO GIỜ mở. Cùng khuôn lib/kairos/ingest-key.
 */
export const TAU_AIS_KEY_HEADER = "x-tau-ais-key";

export async function tauAisKeyDenied(req: Request): Promise<Response | null> {
  let dbVal: string | null = null;
  try {
    dbVal = await getConfigValue("tau_ais_key");
  } catch (e) {
    console.error("[tau-ais] đọc khoá hỏng:", (e as Error)?.message);
  }
  const v = checkIngestKey(req.headers.get(TAU_AIS_KEY_HEADER), effectiveIngestKey(process.env.TAU_AIS_KEY, dbVal));
  if (v === "unconfigured") return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  if (v === "bad") return Response.json({ ok: false, code: "bad_key" }, { status: 401 });
  return null;
}
