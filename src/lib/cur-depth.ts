// Trục 1 — DÒNG CHẢY THEO TẦNG, phía CLIENT: chip Mặt · 50 m · 150 m · 300 m
// dưới thanh ngày của lớp Dòng chảy. Tầng MẶT (0) vẫn là lưới SMOC theo giờ
// (forecast-grid); file này chỉ lo các TẦNG SÂU — lưới THEO NGÀY từ Copernicus
// (server tính, client không đụng S3).
//
// Thứ tự lấy (đúng luật chung 2026-07-29): bản trong máy còn hiện hành →
// SNAPSHOT server (cron 2 lần/ngày) → route live /api/currents-depth → bản cũ
// trong máy → snapshot cũ. Free 3 ngày, premium 10 (route + snapshot chặn thật).

import { saveForecast, loadForecast } from "@/lib/forecast-cache";
import { apiUrl } from "@/lib/api-base";
import { isCacheCurrent } from "@/lib/source-cadence";
import { curDepthSnapshotId, CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import type { ForecastGrid } from "@/lib/forecast-grid";

export type CurDepthClientGrid = ForecastGrid & {
  tier?: number;
  /** độ sâu THẬT của tầng dữ liệu (m) — hiện lên nhãn cho khỏi nói dối 50 vs 47 */
  depthM?: number;
};

/** Namespace localStorage (chung lib/forecast-cache) */
export const CUR_DEPTH_NS = "curdepth";
const cacheId = (tier: number, days: number) => `t${tier}.d${days}`;

function usable(g: CurDepthClientGrid | null | undefined): g is CurDepthClientGrid {
  return !!g?.cells?.length && !!g?.times?.length;
}

async function fetchJson(url: string, timeoutMs: number): Promise<CurDepthClientGrid | null> {
  try {
    const r = await fetch(apiUrl(url), { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const j = (await r.json()) as CurDepthClientGrid & { ok?: boolean };
    return usable(j) ? j : null;
  } catch {
    return null;
  }
}

/**
 * Lưới dòng chảy tầng sâu `tier` (50/150/300) cho `days` ngày (3 miễn phí /
 * 10 premium). Ném lỗi khi mọi nấc đều trống — UI nói thật.
 */
export async function fetchCurDepthGridClient(
  tier: number,
  days: number = CUR_DEPTH_MAX_DAYS,
): Promise<CurDepthClientGrid> {
  const id = cacheId(tier, days);
  const fresh = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
  if (fresh && usable(fresh.data) && isCacheCurrent(fresh.savedAt, Date.now())) {
    return fresh.data;
  }
  // SNAPSHOT trước (cron 2 lần/ngày, same-origin) — nguồn ngày, tươi là đủ
  const snap = await fetchJson(
    `/api/weather-snapshot?id=${curDepthSnapshotId(tier, days)}`,
    10000,
  );
  if (snap && isCacheCurrent(snap.savedAt ?? null, Date.now())) {
    saveForecast(CUR_DEPTH_NS, id, snap, snap.savedAt ?? undefined);
    return snap;
  }
  // live route (server tự fetch Copernicus, chunk cache 6h)
  const live = await fetchJson(`/api/currents-depth?tier=${tier}&days=${days}`, 45000);
  if (live) {
    saveForecast(CUR_DEPTH_NS, id, live);
    return live;
  }
  // các nấc cũ — thà số cũ (nguồn ngày, đổi chậm) còn hơn trống
  const hit = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
  if (hit && usable(hit.data))
    return { ...hit.data, stale: true, savedAt: hit.savedAt };
  if (snap) return { ...snap, stale: true, savedAt: snap.savedAt ?? null };
  throw new Error("chưa tải được dòng chảy tầng sâu");
}
