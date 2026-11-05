import "server-only";
import { getConfigValue } from "@/lib/app-config";
import { checkIngestKey, effectiveIngestKey } from "@/lib/kairos/ingest-key";

/**
 * Cửa máy đồng bộ S-Tracking (POST /api/stracking/nhap): header `x-stracking-key` so thời-gian-hằng với khoá hiệu
 * lực — env STRACKING_KEY đè, không thì `app_config.stracking_key` (admin đặt ở /quan-tri). Thiếu cả hai ⇒ 503,
 * KHÔNG BAO GIỜ mở. Cùng khuôn lib/tau-ais/khoa.
 */
export const STRACKING_KEY_HEADER = "x-stracking-key";

export async function strackingKeyDenied(req: Request): Promise<Response | null> {
  let dbVal: string | null = null;
  try {
    dbVal = await getConfigValue("stracking_key");
  } catch (e) {
    console.error("[stracking] đọc khoá hỏng:", (e as Error)?.message);
  }
  const v = checkIngestKey(req.headers.get(STRACKING_KEY_HEADER), effectiveIngestKey(process.env.STRACKING_KEY, dbVal));
  if (v === "unconfigured") return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  if (v === "bad") return Response.json({ ok: false, code: "bad_key" }, { status: 401 });
  return null;
}
