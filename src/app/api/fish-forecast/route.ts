import { computeFishForecast } from "@/lib/fish-forecast-run";
import { loadFishSnapshot } from "@/lib/fish-snapshot";
import { isSnapshotFresh } from "@/lib/fish-snapshot-policy";

/**
 * Dự báo cá (PFZ) đọc snapshot do cron tính sẵn. Middleware chặn premium trước
 * cache; route không đọc cookie để giữ ISR.
 */
export const maxDuration = 60;
export const revalidate = 1800;

export async function GET() {
  const snap = await loadFishSnapshot();
  if (snap && snap.ok && isSnapshotFresh(snap.generatedAt, Date.now())) {
    return Response.json(snap);
  }

  const live = await computeFishForecast();
  if (live.ok) return Response.json(live);
  if (snap && snap.ok) return Response.json(snap);
  return Response.json(live);
}
