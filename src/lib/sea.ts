// Trục 1 — Đánh bắt. Dự báo biển + điểm đi biển 1–100.
// Nguồn dữ liệu THẬT: Open-Meteo (miễn phí, không cần key, gọi thẳng từ trình duyệt).
//   · marine-api.open-meteo.com  → sóng (wave_height_max)
//   · api.open-meteo.com         → gió, mưa
// Điểm số chỉ để tham khảo — UI phải luôn kèm lời nhắc nghe đài duyên hải.

import type { FishingPort } from "@/data/ports";
import { apiUrl } from "@/lib/api-base";
import { seaSnapshotId } from "@/lib/weather-snapshot-id";
import { isCacheCurrent } from "@/lib/source-cadence";
/* Đồng hồ chặn cho fetch — `AbortSignal.timeout` chưa có trên WebView/Safari
   cũ (máy rẻ của bà con) và gọi thẳng sẽ ném TypeError ĐỒNG BỘ. Ở đây cái ném
   nằm trong hàm async nên chỉ thành promise hỏng, nhưng hậu quả còn tệ hơn
   sập: máy đó KHÔNG BAO GIỜ lấy nổi dự báo mới, cả chuyến biển chỉ xem được
   bản cũ mà chẳng ai hiểu vì sao. Bản dùng chung ở `@/lib/abort` có ĐƯỜNG LÙI
   THẬT (AbortController + setTimeout) nên máy cũ vẫn còn đồng hồ chặn —
   bản riêng cũ ở đây chỉ trả `undefined`, tức là mất trần, đã xoá. */
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, tokenHeader } from "@/lib/device-token-store";

export interface SeaDay {
  date: string; // ISO yyyy-mm-dd
  waveMaxM: number;
  windMaxKmh: number;
  gustMaxKmh: number;
  precipMm: number;
  /** Mã thời tiết WMO (dông/mưa) — dịch sang lời qua lib/weather-codes.ts */
  wmoCode?: number | null;
  /** true = số sóng do THIẾU dữ liệu phải ước từ gió (không để 0 giả thành êm) */
  waveEstimated?: boolean;
}

/**
 * Ước sóng từ gió khi nguồn sóng thủng 1 ngày (hiếm, thường ngày xa) — thà
 * đoán thô còn hơn để wave=0 hoá điểm 100 giả êm. Xấp xỉ vùng biển hở: mỗi
 * 10 km/h gió gây ~0,25 m sóng, nền 0,3 m. THAM KHẢO, UI ghi rõ "ước".
 */
export function estimateWaveFromWind(windKmh: number): number {
  return Math.round((0.3 + Math.max(0, windKmh) * 0.025) * 10) / 10;
}

/**
 * CẢ MẺ đều là sóng ƯỚC (nguồn sóng thủng hẳn) hay không — THUẦN, có test.
 *
 * AN TOÀN TÍNH MẠNG: thà nói "chưa có số sóng thật" còn hơn đưa một con số
 * trông như thật. Sóng ước chỉ suy từ gió, KHÔNG biết sóng lừng từ bão xa —
 * đúng thứ lật tàu nhỏ lúc trời quang. Mẻ như vậy vẫn đáng hiện (gió/mưa/dông
 * trong đó là số thật) nhưng KHÔNG được ngồi vào chỗ của bản có sóng đo thật.
 */
export function allWavesEstimated(days: SeaDay[]): boolean {
  return days.length > 0 && days.every((d) => d.waveEstimated === true);
}

export type SeaLevel = "good" | "caution" | "bad";

export interface ScoredSeaDay extends SeaDay {
  score: number; // 1–100, càng cao càng êm
  level: SeaLevel;
}

// 16 ngày (trần của nguồn): gió/mưa/dông từ mô hình best-match (GFS 16 ngày) và
// SÓNG từ NCEP GFS-Wave 0.25° toàn cầu (`ncep_gfswave025`, cũng 16 ngày) —
// best-match sóng chỉ phủ ~8 ngày nên phải chỉ định model này mới đủ 16. Ngày
// càng xa skill càng thấp — engine KHÔNG giấu điều đó: lớp độ-tin (marine-weather
// forecastConfidence + ensemble spread + bảng skill) nói thật theo từng ngày.
const FORECAST_DAYS = 16;
/** Model sóng phủ đủ 16 ngày (best-match chỉ ~8). Đổi nguồn sửa 1 chỗ này. */
const WAVE_MODEL = "ncep_gfswave025";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ — dự báo ngày không đổi nhanh hơn

/**
 * Điểm đi biển 1–100.
 *
 * CỐ Ý KHÔNG NHẬN CỜ `waveEstimated` (soát chéo 2026-08-02): hạ điểm vì sóng
 * ước sẽ đẻ ra một con số THỨ BA (không phải điểm của sóng thật, cũng không
 * phải điểm của sóng ước) mà chẳng ai giải thích nổi cho bà con. Chỗ xử lý
 * đúng là UI: nơi nào hiện sóng/điểm dựng từ sóng ước thì phải NÓI RA "(ước)"
 * — xem components/fishing-map-view.tsx và components/sea-forecast.tsx.
 */
export function scoreDay(d: SeaDay): number {
  let score = 100;
  // Sóng là yếu tố nặng nhất với tàu cá nhỏ.
  if (d.waveMaxM > 0.8) score -= (d.waveMaxM - 0.8) * 35;
  if (d.windMaxKmh > 20) score -= (d.windMaxKmh - 20) * 1.2;
  if (d.gustMaxKmh > 50) score -= (d.gustMaxKmh - 50) * 0.5;
  if (d.precipMm > 10) score -= (d.precipMm - 10) * 0.8;
  // Dông sét (WMO 95–99) nguy hiểm với tàu nhỏ kể cả khi gió sóng êm.
  if (d.wmoCode != null && d.wmoCode >= 95) score -= 30;
  return Math.max(5, Math.min(100, Math.round(score)));
}

export function levelOf(score: number): SeaLevel {
  if (score >= 75) return "good";
  if (score >= 50) return "caution";
  return "bad";
}

export const LEVEL_LABEL: Record<SeaLevel, string> = {
  good: "Biển êm, đi được",
  caution: "Đi được, cần cẩn thận",
  bad: "Không nên ra khơi",
};

/**
 * LIVE Open-Meteo THẲNG (không cache, không fallback) — tách ra để cron precompute
 * (api/cron/refresh-weather) và client dùng CHUNG đúng một phần tải. Ném lỗi khi
 * nguồn hỏng.
 */
export async function fetchSeaLive(port: FishingPort): Promise<ScoredSeaDay[]> {
  const common = `latitude=${port.lat}&longitude=${port.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_DAYS}`;
  /* HAI NGUỒN, MỘT TRỤC (D-PH11, soát 2026-08-02): trước đây cả hai nằm trong
     `Promise.all` không có lưới, một nhánh hỏng (429 / hết giờ / nguồn sóng
     bảo trì) là VỨT CẢ MẺ — kể cả phần đã tải xong. Nay:
     · GIÓ/MƯA là TRỤC dựng lưới (danh sách ngày lấy từ đó) → hỏng thì đành ném;
     · SÓNG là nguồn PHỤ → hỏng thì vẫn dựng được ngày, sóng ước từ gió và gắn
       cờ `waveEstimated` để UI nói thật "ước", KHÔNG để 0 giả thành biển êm. */
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&daily=wave_height_max&models=${WAVE_MODEL}`,
      { signal: timeoutSignal(15000) },
    ).catch(() => null),
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,weather_code`,
      { signal: timeoutSignal(15000) },
    ),
  ]);
  if (!weatherRes.ok) {
    throw new Error("Không lấy được dự báo");
  }
  const marine =
    marineRes && marineRes.ok ? await marineRes.json().catch(() => null) : null;
  const weather = await weatherRes.json();

  const dates: string[] = weather.daily?.time ?? [];
  const days: ScoredSeaDay[] = dates.map((date, i) => {
    const windMaxKmh = weather.daily?.wind_speed_10m_max?.[i] ?? 0;
    const rawWave = marine?.daily?.wave_height_max?.[i];
    const waveMissing = rawWave == null || !Number.isFinite(rawWave);
    const d: SeaDay = {
      date,
      waveMaxM: waveMissing ? estimateWaveFromWind(windMaxKmh) : rawWave,
      windMaxKmh,
      gustMaxKmh: weather.daily?.wind_gusts_10m_max?.[i] ?? 0,
      precipMm: weather.daily?.precipitation_sum?.[i] ?? 0,
      wmoCode: weather.daily?.weather_code?.[i] ?? null,
      waveEstimated: waveMissing,
    };
    const score = scoreDay(d);
    return { ...d, score, level: levelOf(score) };
  });

  if (days.length === 0) throw new Error("Dự báo trống");
  return days;
}

/**
 * NGUỒN DỰ PHÒNG cho cron ghép snapshot (2026-07-29): ECMWF qua cùng API.
 * Probe thật: daily gió/giật/mưa/weather_code của `ecmwf_ifs025` phủ ~14 ngày,
 * NHƯNG `daily=wave_height_max` của `ecmwf_wam025` trả TOÀN NULL → sóng phải
 * tự gộp MAX theo ngày từ hourly. CHỈ cron gọi.
 */
export async function fetchSeaBackupLive(port: FishingPort): Promise<ScoredSeaDay[]> {
  const common = `latitude=${port.lat}&longitude=${port.lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=${FORECAST_DAYS}`;
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height&models=ecmwf_wam025`,
      { signal: timeoutSignal(15000) },
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?${common}&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,weather_code&models=ecmwf_ifs025`,
      { signal: timeoutSignal(15000) },
    ),
  ]);
  if (!marineRes.ok || !weatherRes.ok) {
    throw new Error("Không lấy được dự báo dự phòng");
  }
  const marine = await marineRes.json();
  const weather = await weatherRes.json();

  // MAX sóng theo ngày từ chuỗi giờ (giờ VN — nguồn xin theo Asia/Ho_Chi_Minh)
  const waveMaxByDate = new Map<string, number>();
  const hTimes: string[] = marine.hourly?.time ?? [];
  const hWave: unknown[] = marine.hourly?.wave_height ?? [];
  for (let i = 0; i < hTimes.length; i++) {
    const v = hWave[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const date = String(hTimes[i]).slice(0, 10);
    const cur = waveMaxByDate.get(date);
    if (cur == null || v > cur) waveMaxByDate.set(date, v);
  }

  const dates: string[] = weather.daily?.time ?? [];
  const days: ScoredSeaDay[] = [];
  for (let i = 0; i < dates.length; i++) {
    const windMaxKmh = weather.daily?.wind_speed_10m_max?.[i];
    // đuôi ECMWF hết tầm (~14 ngày) → ngày null bỏ hẳn, KHÔNG điền 0 giả êm
    if (typeof windMaxKmh !== "number" || !Number.isFinite(windMaxKmh)) continue;
    const rawWave = waveMaxByDate.get(dates[i]);
    const waveMissing = rawWave == null;
    const d: SeaDay = {
      date: dates[i],
      waveMaxM: waveMissing ? estimateWaveFromWind(windMaxKmh) : rawWave,
      windMaxKmh,
      gustMaxKmh: weather.daily?.wind_gusts_10m_max?.[i] ?? 0,
      precipMm: weather.daily?.precipitation_sum?.[i] ?? 0,
      wmoCode: weather.daily?.weather_code?.[i] ?? null,
      waveEstimated: waveMissing,
    };
    const score = scoreDay(d);
    days.push({ ...d, score, level: levelOf(score) });
  }
  if (days.length === 0) throw new Error("Dự báo dự phòng trống");
  return days;
}

/**
 * Dự báo biển theo cảng cho UI. Thứ tự (user 2026-07-29 "luôn ưu tiên snapshot
 * để hạn chế bị lock IP"): bản MỚI trong máy (còn TTL) → SNAPSHOT server còn
 * HIỆN HÀNH theo nhịp phát hành (cron tính sẵn, same-origin — không đụng hạn
 * ngạch Open-Meteo theo IP máy) → LIVE Open-Meteo → snapshot CŨ → bản CŨ trong
 * máy (quá TTL còn hơn không có).
 */
export async function fetchSeaForecast(
  port: FishingPort,
): Promise<ScoredSeaDay[]> {
  const cached = readCache(port.id);
  if (cached) return cached;
  /* MẤT SÓNG HẲN → ĐỌC BẢN ĐÃ LƯU TRƯỚC (K3, soát 2026-08-02).
     Trước đây bản lưu nằm SAU cùng: máy tự biết mình không có mạng mà vẫn vắt
     kiệt 23 giây đồng hồ (8 s snapshot + 15 s live) rồi mới lấy ra thứ đã nằm
     sẵn trong máy từ giây 0. Bà con nhìn màn hình quay 23 giây, mỗi lần mở lại
     màn là 23 giây nữa.
     Chỉ tin `onLine === false` (máy nói CHẮC là không có mạng); ca "sóng sống
     mà chết" onLine vẫn true nên vẫn đi đường thường — không mất bản mới. */
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offlineStale = readCache(port.id, true);
    if (offlineStale) return offlineStale;
  }
  const snap = await loadSeaSnapshotClient(port.id);
  if (snap && isCacheCurrent(snap.savedAt, Date.now())) {
    writeCacheKeepRealWaves(port.id, snap.days); // giữ bản trong máy cho lúc mất sóng
    return snap.days;
  }
  try {
    const days = await fetchSeaLive(port);
    writeCacheKeepRealWaves(port.id, days);
    return days;
  } catch (err) {
    // snapshot đã hỏi ở trên — cũ vẫn hơn không có (không hỏi lại cho đỡ 1 lượt)
    if (snap) return snap.days;
    const stale = readCache(port.id, true);
    if (stale) return stale;
    throw err;
  }
}

/** Snapshot cảng do cron tính sẵn (same-origin) — null nếu chưa có. Nhận CẢ
    hai dạng payload: cũ = mảng ngày trần; mới = { savedAt, days } (cron nhét
    savedAt để client biết bản còn hiện hành không). */
async function loadSeaSnapshotClient(
  portId: string,
): Promise<{ days: ScoredSeaDay[]; savedAt: number | null } | null> {
  try {
    const r = await fetch(apiUrl(`/api/weather-snapshot?id=${seaSnapshotId(portId)}`), {
      headers: tokenHeader(),
      signal: timeoutSignal(8000),
    });
    /* MỘT DÒNG NÀY = chỗ này cũng phát hiện được máy bị đá. Bộ não vẫn
       nằm ở `noteResponse`; ở đây chỉ đưa phản hồi cho nó soi. */
    void noteResponse(r);
    if (!r.ok) return null;
    const j = (await r.json()) as
      | ScoredSeaDay[]
      | { savedAt?: number; days?: ScoredSeaDay[] };
    const days = Array.isArray(j) ? j : j?.days;
    if (!Array.isArray(days) || days.length === 0) return null;
    const savedAt = Array.isArray(j) ? null : (j.savedAt ?? null);
    return { days, savedAt: Number.isFinite(savedAt as number) ? (savedAt as number) : null };
  } catch {
    return null;
  }
}

// ── cache trên máy, đỡ gọi mạng mỗi lần mở app ──────────────────────────
function cacheKey(portId: string) {
  // v3: horizon 10→16 ngày + waveEstimated + model sóng ncep_gfswave025 —
  // đổi version để bỏ cache 10-ngày cũ (thiếu 5 ngày, shape khác)
  return `forfish.sea.${portId}.v3`;
}

function readCache(
  portId: string,
  ignoreTtl = false,
): ScoredSeaDay[] | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(portId));
    if (!raw) return null;
    const { ts, days } = JSON.parse(raw) as {
      ts: number;
      days: ScoredSeaDay[];
    };
    // ignoreTtl = fallback cuối khi live + snapshot đều hỏng (bản cũ còn hơn trống)
    if (!ignoreTtl && Date.now() - ts > CACHE_TTL_MS) return null;
    return days;
  } catch {
    return null;
  }
}

function writeCache(portId: string, days: ScoredSeaDay[]) {
  try {
    window.localStorage.setItem(
      cacheKey(portId),
      JSON.stringify({ ts: Date.now(), days }),
    );
  } catch {
    // storage đầy — bỏ qua, lần sau gọi lại mạng
  }
}

/**
 * Ghi vào máy, NHƯNG mẻ toàn sóng-ước KHÔNG được đè bản còn sóng ĐO THẬT.
 *
 * VÌ SAO (LỖI 2b, soát chéo 2026-08-02): từ lúc nhánh live thôi ném khi nguồn
 * sóng hỏng, một mẻ "gió thật + sóng ước" cũng được lưu đè lên bản cũ có sóng
 * thật. Ra biển mất sóng, thứ duy nhất còn trong máy là số sóng máy tự đoán từ
 * gió — đúng lúc không còn cách nào kiểm chứng. Cái mới ĐANG hiện vẫn là cái
 * vừa lấy về (gió/mưa/dông trong đó là số thật, UI đã gắn "(ước)" cho sóng);
 * chỗ này chỉ lo phần bà con sẽ đọc lúc GIỮA BIỂN.
 *
 * Không có bản cũ, hoặc bản cũ cũng toàn sóng ước → cứ ghi: trống còn tệ hơn.
 */
function writeCacheKeepRealWaves(portId: string, days: ScoredSeaDay[]) {
  if (!allWavesEstimated(days)) {
    writeCache(portId, days);
    return;
  }
  const prev = readCache(portId, true); // kể cả quá hạn — vẫn là sóng đo thật
  if (prev && !allWavesEstimated(prev)) return;
  writeCache(portId, days);
}
