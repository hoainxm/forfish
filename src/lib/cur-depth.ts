// Trục 1 — DÒNG CHẢY THEO TẦNG, phía CLIENT: chip Mặt · 50 m · 150 m · 300 m
// dưới thanh ngày của lớp Dòng chảy. Tầng MẶT (0) vẫn là lưới SMOC theo giờ
// (forecast-grid); file này chỉ lo các TẦNG SÂU — lưới THEO NGÀY từ Copernicus
// (server tính, client không đụng S3).
//
// Thứ tự lấy (đúng luật chung 2026-07-29): bản trong máy còn hiện hành →
// SNAPSHOT server (cron 2 lần/ngày) → route live /api/currents-depth → bản cũ
// trong máy → snapshot cũ. Free 3 ngày, premium 10 (route + snapshot chặn thật).

import {
  saveForecast,
  loadForecast,
  loadAll,
  isDefinitelyOffline,
} from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import { apiUrl } from "@/lib/api-base";
import { isDailyCacheCurrent } from "@/lib/source-cadence";
import { curDepthSnapshotId, CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import type { ForecastGrid } from "@/lib/forecast-grid";
import { timeoutSignal } from "@/lib/abort";

export type CurDepthClientGrid = ForecastGrid & {
  tier?: number;
  /** độ sâu THẬT của tầng dữ liệu (m) — hiện lên nhãn cho khỏi nói dối 50 vs 47 */
  depthM?: number;
};

/** Namespace localStorage (chung lib/forecast-cache) */
export const CUR_DEPTH_NS = "curdepth";
const cacheId = (tier: number, days: number) => `t${tier}.d${days}`;

/**
 * KHUNG NGÀY được phép MƯỢN khi khung đang xin chưa có bản lưu — phải khớp các
 * khung mà `pretrip.ts` thật sự tải (`CUR_DEPTH_MAX_DAYS`, và nấc lùi 3 ngày).
 * Ghi ở đây thay vì rải khắp nơi để lần sau đổi nấc lùi thì chỉ sửa một chỗ.
 */
const CUR_DEPTH_FALLBACK_DAYS = [3];

/** Các TẦNG sâu (m) dòng chảy đang giữ trong máy (thuần đọc — cho pretrip-status). */
export function savedCurDepthTiers(): number[] {
  const tiers = new Set<number>();
  for (const e of loadAll<unknown>(CUR_DEPTH_NS)) {
    const m = e.id.match(/^t(\d+)\.d\d+$/);
    if (m) tiers.add(Number(m[1]));
  }
  return Array.from(tiers).sort((a, b) => a - b);
}

/** Số NGÀY xa nhất của dòng chảy tầng đang giữ (3 free / 10 premium). 0 = chưa có. */
export function savedCurDepthDays(): number {
  let max = 0;
  for (const e of loadAll<unknown>(CUR_DEPTH_NS)) {
    const m = e.id.match(/^t\d+\.d(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Ngày (ISO) xa nhất dòng chảy tầng phủ tới (times[] thật của tầng ngày nhiều nhất). */
export function savedCurDepthUntil(): string | null {
  let best: { days: number; until: string | null } | null = null;
  for (const e of loadAll<CurDepthClientGrid>(CUR_DEPTH_NS)) {
    const m = e.id.match(/^t\d+\.d(\d+)$/);
    if (!m) continue;
    const d = Number(m[1]);
    const t = e.data?.times;
    const until = t && t.length ? t[t.length - 1].slice(0, 10) : null;
    if (!best || d > best.days) best = { days: d, until };
  }
  return best?.until ?? null;
}

function usable(g: CurDepthClientGrid | null | undefined): g is CurDepthClientGrid {
  return !!g?.cells?.length && !!g?.times?.length;
}

/* CACHE TRONG BỘ NHỚ theo `t{tier}.d{days}` (2026-07-29) — đổi qua lại giữa các
   tầng (Mặt/50/150/300) mà mỗi lần đọc lại localStorage + JSON.parse lưới 156 ô
   thì GIẬT. Giữ bản đã dựng trong RAM để lần sau về tầng cũ trả NGAY, và cho map
   PEEK đồng bộ (khỏi nháy trống khi chuyển tầng). */
const memCache = new Map<string, CurDepthClientGrid>();

/** Bản dòng chảy tầng đã có SẴN trong máy (RAM trước, rồi localStorage còn dùng
 *  được) — trả ĐỒNG BỘ để map hiện ngay khi chuyển tầng, không nháy trống. */
export function peekCurDepthGrid(
  tier: number,
  days: number = CUR_DEPTH_MAX_DAYS,
): CurDepthClientGrid | null {
  const id = cacheId(tier, days);
  const mem = memCache.get(id);
  if (mem) return mem;
  const hit = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
  return hit && usable(hit.data) ? hit.data : null;
}

async function fetchJson(url: string, timeoutMs: number): Promise<CurDepthClientGrid | null> {
  try {
    const r = await fetch(apiUrl(url), { signal: timeoutSignal(timeoutMs) });
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
  const remember = (g: CurDepthClientGrid): CurDepthClientGrid => {
    memCache.set(id, g);
    return g;
  };
  /*  NHỊP NGÀY, KHÔNG PHẢI NHỊP GFS (2026-08-03). Nguồn là Copernicus `P1D` —
      một ngày đúng một bản. Dùng `isCacheCurrent` (lịch 4 mốc/ngày của
      Open-Meteo) ở đây là ngày bốn lần vứt bản đang có để đi đốt 55 giây lấy về
      đúng con số cũ. Xem `isDailyCacheCurrent`. */
  const fresh = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
  if (fresh && usable(fresh.data) && isDailyCacheCurrent(fresh.savedAt, Date.now())) {
    return remember(fresh.data);
  }
  /* MẤT SÓNG HẲN → ĐỌC BẢN ĐÃ LƯU TRƯỚC (K3, 2026-08-02 — cùng khuôn `sea.ts`).
     Đường thường đốt ~55 giây (10 s snapshot + 45 s route live) rồi mới lấy ra
     bản đã nằm sẵn trong máy — và bà con đổi qua lại 4 chip tầng (Mặt/50/150/
     300) là mỗi chip một lần chờ. Chỉ đi tắt khi máy KHẲNG ĐỊNH mất sóng. */
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC (2026-08-02k — vá lỗi CHẶN).
      Đường tắt này chạy khi máy KHẲNG ĐỊNH mất sóng, tức đúng lúc giữa biển.
      Payload nay nằm ở IndexedDB (nạp bất đồng bộ lúc mở app), nên đọc trước khi
      nạp xong là trượt ⇒ rơi xuống nhánh mạng ⇒ offline thì nhánh đó hỏng TỨC
      THÌ (không có độ trễ mạng che cửa sổ đua) ⇒ màn hình báo "chưa có số nào
      lưu trong máy" trong khi kho còn nguyên. Chờ ở đây là hợp lệ: hàm đã async,
      và `forecastStoreReady()` có trần chờ nên không bao giờ treo. */
  await forecastStoreReady();
  if (isDefinitelyOffline()) {
    const hit = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
    if (hit && usable(hit.data))
      return remember({ ...hit.data, stale: true, savedAt: hit.savedAt });
  }
  // SNAPSHOT trước (cron 2 lần/ngày, same-origin) — nguồn ngày, tươi là đủ
  const snap = await fetchJson(
    `/api/weather-snapshot?id=${curDepthSnapshotId(tier, days)}`,
    10000,
  );
  if (snap && isDailyCacheCurrent(snap.savedAt ?? null, Date.now())) {
    saveForecast(CUR_DEPTH_NS, id, snap, snap.savedAt ?? undefined);
    return remember(snap);
  }
  // live route (server tự fetch Copernicus, chunk cache 6h)
  const live = await fetchJson(`/api/currents-depth?tier=${tier}&days=${days}`, 45000);
  if (live) {
    /*  CHỈ GHI KHI BẢN LIVE THẬT SỰ DÙNG ĐƯỢC (sửa 2026-08-02h).
        Bản cũ ghi trần: một phản hồi `ok` mà lưới rỗng/thiếu ô vẫn đè thẳng lên
        bản đầy đủ đã tải ở bờ, rồi nhánh đọc ngay dưới lại từ chối chính bản vừa
        ghi (`usable(hit.data)`) — mất bản tốt mà cũng chẳng dùng được bản mới.
        Cùng luật với `shouldOverwriteGrid`/`shouldOverwriteScalar`. */
    if (usable(live)) saveForecast(CUR_DEPTH_NS, id, live);
    return remember(live);
  }
  // các nấc cũ — thà số cũ (nguồn ngày, đổi chậm) còn hơn trống
  const hit = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, id);
  if (hit && usable(hit.data))
    return remember({ ...hit.data, stale: true, savedAt: hit.savedAt });
  /*  ⚠️ MƯỢN KHUNG NGẮN HƠN (thêm 2026-08-03, đánh giá tổng thể bắt).
      Hai lớp anh em đều có nấc này — `forecast-grid.layKhungDaiHon` và
      `scalar-field.savedScalarFallback` — riêng dòng chảy tầng sâu thì KHOÁ CỨNG
      đúng `cacheId(tier, days)`. Mà mẻ tải sẵn lưu `d10`, hỏng thì lùi `d3`
      (`pretrip.ts:626,633`), còn bản đồ thì LUÔN xin `d10`. Chặng d10 hỏng ở
      cảng ⇒ máy chỉ có `t50.d3` ⇒ id lệch ⇒ ném ⇒ giữa biển in "máy chưa có bản
      nào" TRONG KHI bản d3 nằm ngay đó. Đúng khuôn ĐỎ DỐI mà mười vòng vừa
      diệt, vào bằng cửa thứ sáu.
      Không nói dối được: thanh ngày vẽ theo `times[]` THẬT của bản mượn, nên bà
      con thấy đúng nó phủ tới ngày nào. */
  for (const d of CUR_DEPTH_FALLBACK_DAYS.filter((x) => x < days).reverse()) {
    const alt = loadForecast<CurDepthClientGrid>(CUR_DEPTH_NS, cacheId(tier, d));
    if (alt && usable(alt.data))
      return remember({ ...alt.data, stale: true, savedAt: alt.savedAt });
  }
  if (snap) {
    // LƯU snapshot khi live 429 (2026-07-29): trước chỉ trả stale mà không ghi
    // → "Tải lại" trong popup coi như hỏng (savedCurDepthTiers vẫn trống).
    saveForecast(CUR_DEPTH_NS, id, snap, snap.savedAt ?? undefined);
    return remember({ ...snap, stale: true, savedAt: snap.savedAt ?? null });
  }
  throw new Error("chưa tải được dòng chảy tầng sâu");
}
