// Collector LỊCH SỬ Ra khơi (yêu cầu 2026-07-02: lưu DB để predict).
// Vercel Cron gọi 1 lần/ngày (vercel.json) với Authorization: Bearer CRON_SECRET.
// Ghi 3 bảng migration 0005 bằng service-role (bypass RLS): sea_daily (10 cảng
// × 10 ngày dự báo, kèm lead_days), fish_forecast_daily (hotspot PFZ s ≥ 60),
// storm_events. Idempotent theo unique key — chạy lại trong ngày = ghi đè.
// Nguồn nào fail thì bỏ qua nguồn đó, các nguồn còn lại vẫn lưu (best-effort,
// KHÔNG bịa số). Response nói rõ từng phần để cron log tự đối soát.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PORTS } from "@/data/ports";
import { scoreDay, levelOf, type SeaDay, type ScoredSeaDay } from "@/lib/sea";
import { parseStorms } from "@/lib/storms";
import { loadFishForecast } from "@/lib/fish-forecast-server";
import {
  toFishDailyRows,
  toSeaDailyRows,
  toStormRows,
  vnToday,
} from "@/lib/sea-history";

export const maxDuration = 300; // NOAA + 10 cảng Open-Meteo — thong thả

const GDACS_TC_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtypes=TC";

/** Dự báo 10 ngày một cảng — bản server của lib/sea (không localStorage). */
async function fetchPortDays(lat: number, lon: number): Promise<ScoredSeaDay[]> {
  const common = `latitude=${lat}&longitude=${lon}&timezone=Asia%2FHo_Chi_Minh&forecast_days=10`;
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?${common}` +
    `&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,weather_code`;
  const waveUrl =
    `https://marine-api.open-meteo.com/v1/marine?${common}&daily=wave_height_max`;
  const [windRes, waveRes] = await Promise.all([
    fetch(windUrl, { signal: AbortSignal.timeout(15000) }),
    fetch(waveUrl, { signal: AbortSignal.timeout(15000) }).catch(() => null),
  ]);
  if (!windRes.ok) throw new Error("wind_source_failed");
  const wind = (await windRes.json()) as {
    daily?: {
      time?: string[];
      wind_speed_10m_max?: (number | null)[];
      wind_gusts_10m_max?: (number | null)[];
      precipitation_sum?: (number | null)[];
      weather_code?: (number | null)[];
    };
  };
  const wave =
    waveRes && waveRes.ok
      ? ((await waveRes.json()) as {
          daily?: { time?: string[]; wave_height_max?: (number | null)[] };
        })
      : null;
  const time = wind.daily?.time ?? [];
  const waveByDate = new Map<string, number | null>();
  (wave?.daily?.time ?? []).forEach((t, i) =>
    waveByDate.set(t, wave?.daily?.wave_height_max?.[i] ?? null),
  );
  return time.map((date, i) => {
    const d: SeaDay = {
      date,
      waveMaxM: waveByDate.get(date) ?? NaN,
      windMaxKmh: wind.daily?.wind_speed_10m_max?.[i] ?? NaN,
      gustMaxKmh: wind.daily?.wind_gusts_10m_max?.[i] ?? NaN,
      precipMm: wind.daily?.precipitation_sum?.[i] ?? NaN,
      wmoCode: wind.daily?.weather_code?.[i] ?? null,
    };
    const score = scoreDay(d);
    return { ...d, score, level: levelOf(score) };
  });
}

export async function GET(req: Request) {
  // Vercel Cron tự gắn Bearer CRON_SECRET; đặt secret là bắt buộc để người
  // ngoài không đập route này cho tốn quota nguồn miễn phí.
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  const now = new Date();
  const collectedOn = vnToday(now);
  const parts: Record<string, { ok: boolean; rows: number; note?: string }> = {};

  // 1) Biển theo cảng — từng cảng độc lập, cảng fail không kéo sập cả mẻ.
  // Giữ lỗi ĐẦU TIÊN vào note — cron log tự nói nó chết vì đâu, khỏi đoán.
  {
    let rows = 0;
    let failed = 0;
    let firstErr = "";
    for (const p of PORTS) {
      try {
        const days = await fetchPortDays(p.lat, p.lon);
        const batch = toSeaDailyRows(collectedOn, p.id, days);
        if (batch.length) {
          const { error } = await admin
            .from("sea_daily")
            .upsert(batch, { onConflict: "collected_on,port_id,date" });
          if (error) throw new Error(error.message);
          rows += batch.length;
        }
      } catch (e) {
        failed++;
        if (!firstErr) firstErr = e instanceof Error ? e.message : String(e);
      }
    }
    parts.sea = {
      ok: failed < PORTS.length,
      rows,
      note: failed
        ? `${failed}/${PORTS.length} cảng fail: ${firstErr.slice(0, 120)}`
        : undefined,
    };
  }

  // 2) Dự báo cá (hotspot).
  {
    const forecast = await loadFishForecast(now.getMonth() + 1);
    if (!forecast) {
      parts.fish = { ok: false, rows: 0, note: "nguồn NOAA fail" };
    } else {
      const batch = toFishDailyRows(collectedOn, forecast);
      const { error } = batch.length
        ? await admin
            .from("fish_forecast_daily")
            .upsert(batch, { onConflict: "collected_on,lat,lon" })
        : { error: null };
      parts.fish = { ok: !error, rows: error ? 0 : batch.length };
    }
  }

  // 3) Bão đang hoạt động.
  try {
    const r = await fetch(GDACS_TC_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("gdacs_failed");
    const storms = parseStorms(await r.json(), now);
    const batch = toStormRows(collectedOn, storms);
    const { error } = batch.length
      ? await admin
          .from("storm_events")
          .upsert(batch, { onConflict: "collected_on,storm_id" })
      : { error: null };
    parts.storms = { ok: !error, rows: error ? 0 : batch.length };
  } catch {
    parts.storms = { ok: false, rows: 0, note: "nguồn GDACS fail" };
  }

  const ok = Object.values(parts).some((p) => p.ok);
  return NextResponse.json({ ok, collectedOn, parts });
}
