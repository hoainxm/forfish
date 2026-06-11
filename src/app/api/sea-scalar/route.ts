import { loadSeaScalar, SEA_SCALARS } from "@/lib/sea-scalars";
import type { SeaScalarKind } from "@/lib/sea-scalars";

/**
 * Lớp số liệu biển (nước dâng/xoáy, độ mặn) — proxy nguồn công khai, cache 6h.
 * Nguồn fail → { ok:false }, client im lặng (không bịa dữ liệu).
 */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!(kind in SEA_SCALARS)) return Response.json({ ok: false });
  return Response.json(await loadSeaScalar(kind as SeaScalarKind));
}
