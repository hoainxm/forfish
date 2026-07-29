import { PORTS } from "@/data/ports";
import { fetchSeaLive, fetchSeaBackupLive, type ScoredSeaDay } from "@/lib/sea";
import {
  fetchForecastGridLive,
  fetchForecastGridBackupLive,
  type ForecastGrid,
} from "@/lib/forecast-grid";
import {
  fetchScalarFieldsLive,
  fetchScalarFieldsBackupLive,
  type OMKind,
  type ScalarGrid,
} from "@/lib/scalar-field";
import { saveWeatherSnapshot, loadWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  seaSnapshotId,
  gridSnapshotId,
  scalarSnapshotId,
  rawSourceId,
  SNAPSHOT_DAY_SET,
} from "@/lib/weather-snapshot-id";
import {
  mergeForecastGrids,
  mergeScalarGrids,
  mergeSeaDays,
  mergedSavedAt,
  gridDaysMissing,
  type GridSource,
  type SeaSource,
} from "@/lib/snapshot-merge";
import { fetchWavBackup, type WavBackup } from "@/lib/copernicus-wav";
import { fetchCopernicusCurrents } from "@/lib/copernicus";

/**
 * CRON PRECOMPUTE thời tiết — GHÉP HAI NGUỒN (2026-07-29, user: "mỗi lớp lấy 2
 * nguồn, snapshot có backup; final = bản mới + ngày thiếu từ bản dài").
 *
 * Từ 2026-07-29 client ƯU TIÊN snapshot trước live → snapshot này là đường
 * đọc CHÍNH, không còn chỉ là lưới an toàn. Mỗi lớp:
 *  · nguồn CHÍNH  = như client vẫn live (best_match / gfswave / SMOC)
 *  · nguồn DỰ PHÒNG = ECMWF (ifs025/wam025, cùng API khác model — chống model
 *    hỏng/trễ) — lưới/dải màu fetch MỖI LƯỢT (rẻ), cảng chỉ khi nguồn chính chết
 *  · VÉT CUỐI khác NHÀ CUNG CẤP (chống Open-Meteo sập/khoá): sóng = Copernicus
 *    WAV (2 mốc/ngày ≤6 ngày), dòng chảy = Copernicus merged-uv (ngày hôm nay)
 *    — CHỈ fetch khi bản ghép thật sự trống, thường ngày không tốn một byte.
 *
 * Bản THÔ từng nguồn giữ ở hàng `raw:<id>:<src>` (KHÔNG lọt whitelist đọc
 * public) — nguồn chết một lượt cron thì lượt sau vẫn còn đồ ghép (≤48h).
 * Bản GHÉP ghi vào đúng id client đang đọc, `savedAt` = nguồn TƯƠI NHẤT được
 * dùng (client so nhịp phát hành bằng số này). Luật ghép: lib/snapshot-merge.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const OM_KINDS: OMKind[] = ["cloud", "rain", "airtemp", "storm", "pressure"];
const dayOf = (iso: string) => String(iso).slice(0, 10);

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface RawRow<T> {
  savedAt: number;
  data: T;
}

async function loadRaw<T>(id: string): Promise<RawRow<T> | null> {
  const p = (await loadWeatherSnapshot(id)) as RawRow<T> | null;
  if (!p || p.data == null || !Number.isFinite(p.savedAt)) return null;
  return p;
}

/** WAV theo NGÀY → GridSource vét cuối: gán hằng số ngày vào mọi tick của ngày
    (đúng luật "không trộn trong ngày" — cả ngày một nguồn) */
function wavGridSource(
  wav: WavBackup,
  times: string[],
  coords: { lat: number; lon: number }[],
  savedAt: number,
): GridSource {
  const dayIdx = new Map(wav.days.map((d, i) => [d, i] as const));
  return {
    id: "copernicus-wav",
    savedAt,
    lastResort: true,
    grid: {
      times,
      cells: coords.map(({ lat, lon }) => ({
        lat,
        lon,
        hours: times.map((t) => {
          const di = dayIdx.get(dayOf(t));
          const s = di != null ? wav.sample(lat, lon, di) : null;
          return {
            windKmh: null,
            windDirDeg: null,
            waveM: s?.waveM ?? null,
            waveDirDeg: s?.waveDirDeg ?? null,
          };
        }),
      })),
    },
  };
}

/** Copernicus merged-uv (MỘT mốc gần bây giờ) → GridSource vét cuối cho DÒNG
    CHẢY ngày HÔM NAY. u/v m/s → km/h; hướng CHẢY VỀ = atan2(u,v). */
function uvGridSource(
  cur: NonNullable<Awaited<ReturnType<typeof fetchCopernicusCurrents>>>,
  times: string[],
  coords: { lat: number; lon: number }[],
  savedAt: number,
): GridSource {
  const day0 = dayOf(times[0] ?? "");
  const sample = (lat: number, lon: number) => {
    const g = cur.u;
    let bi = 0;
    for (let i = 1; i < g.lats.length; i++)
      if (Math.abs(g.lats[i] - lat) < Math.abs(g.lats[bi] - lat)) bi = i;
    let bj = 0;
    for (let j = 1; j < g.lons.length; j++)
      if (Math.abs(g.lons[j] - lon) < Math.abs(g.lons[bj] - lon)) bj = j;
    const u = cur.u.values[bi]?.[bj];
    const v = cur.v.values[bi]?.[bj];
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    const kmh = Math.hypot(u!, v!) * 3.6;
    const dir = ((Math.atan2(u!, v!) * 180) / Math.PI + 360) % 360;
    return {
      curKmh: Math.round(kmh * 100) / 100,
      curDirDeg: Math.round(dir),
    };
  };
  return {
    id: "copernicus-uv",
    savedAt,
    lastResort: true,
    grid: {
      times,
      cells: coords.map(({ lat, lon }) => {
        const s = sample(lat, lon);
        return {
          lat,
          lon,
          hours: times.map((t) => ({
            windKmh: null,
            windDirDeg: null,
            waveM: null,
            waveDirDeg: null,
            curKmh: dayOf(t) === day0 ? (s?.curKmh ?? null) : null,
            curDirDeg: dayOf(t) === day0 ? (s?.curDirDeg ?? null) : null,
          })),
        };
      }),
    },
  };
}

/** WAV theo NGÀY tại một cảng → SeaSource vét cuối: CHỈ mang số sóng (gió NaN
    nên không bao giờ được chọn làm nguồn gió — mergeSeaDays tự lo). */
function wavSeaSource(
  wav: WavBackup,
  port: { lat: number; lon: number },
  savedAt: number,
): SeaSource {
  const days: ScoredSeaDay[] = [];
  wav.days.forEach((date, di) => {
    const s = wav.sample(port.lat, port.lon, di);
    if (!s) return;
    days.push({
      date,
      waveMaxM: s.waveM,
      windMaxKmh: Number.NaN, // không có gió — chỉ để mergeSeaDays lấy sóng
      gustMaxKmh: 0,
      precipMm: 0,
      wmoCode: null,
      waveEstimated: false,
      score: 0,
      level: "bad",
    });
  });
  return { id: "copernicus-wav", savedAt, lastResort: true, days };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const savedAt = Date.now();
  // vét cuối khác nhà cung cấp — LAZY + memo: thường ngày không fetch một byte
  let wavP: Promise<WavBackup | null> | null = null;
  const getWav = () => (wavP ??= fetchWavBackup());
  let uvP: ReturnType<typeof fetchCopernicusCurrents> | null = null;
  const getUv = () => (uvP ??= fetchCopernicusCurrents({ timeoutMs: 20000 }));

  /* ── DỰ BÁO CẢNG ─────────────────────────────────────────────────────── */
  let seaOk = 0;
  let seaFail = 0;
  for (const port of PORTS) {
    const baseId = seaSnapshotId(port.id);
    let om: SeaSource | null = null;
    try {
      const days = await fetchSeaLive(port);
      await saveWeatherSnapshot(rawSourceId(baseId, "om"), { savedAt, data: days });
      om = { id: "om", savedAt, days };
    } catch {}

    if (om) {
      // đường nhanh: nguồn chính đủ 16 ngày — khỏi ghép
      if (await saveWeatherSnapshot(baseId, { savedAt, days: om.days })) seaOk++;
      else seaFail++;
      continue;
    }

    // nguồn chính chết → dự phòng ECMWF (chỉ fetch lúc này cho đỡ tốn lượt)
    let ec: SeaSource | null = null;
    try {
      const days = await fetchSeaBackupLive(port);
      await saveWeatherSnapshot(rawSourceId(baseId, "ecmwf"), { savedAt, data: days });
      ec = { id: "ecmwf", savedAt, days };
    } catch {}
    const oldOm = await loadRaw<ScoredSeaDay[]>(rawSourceId(baseId, "om"));
    if (oldOm) {
      // nguồn chính bản CŨ (raw giữ từ lượt trước) — vẫn là ứng viên ≤48h
      om = { id: "om", savedAt: oldOm.savedAt, days: oldOm.data };
    }
    if (!ec) {
      const oldEc = await loadRaw<ScoredSeaDay[]>(rawSourceId(baseId, "ecmwf"));
      if (oldEc) ec = { id: "ecmwf", savedAt: oldEc.savedAt, days: oldEc.data };
    }
    const srcs = [om, ec].filter((s): s is SeaSource => s != null);
    let merged = mergeSeaDays(srcs);
    // ngày phải ƯỚC sóng từ gió mà WAV có số thật → vét
    if (merged && merged.days.some((d) => d.waveEstimated)) {
      const wav = await getWav();
      if (wav && merged.days.some((d) => d.waveEstimated && wav.days.includes(d.date))) {
        merged = mergeSeaDays([...srcs, wavSeaSource(wav, port, savedAt)]) ?? merged;
      }
    }
    if (
      merged &&
      (await saveWeatherSnapshot(baseId, {
        savedAt: mergedSavedAt(merged.sources) ?? savedAt,
        days: merged.days,
        sources: merged.sources,
      }))
    )
      seaOk++;
    else seaFail++;
  }

  /* ── LƯỚI GIÓ/SÓNG/DÒNG CHẢY + LỚP DẢI MÀU, theo khung d3/d16 ─────────── */
  const gridOk: Record<number, boolean> = {};
  const scalarOk: Record<number, number> = {};
  for (const days of SNAPSHOT_DAY_SET) {
    const baseId = gridSnapshotId(days);
    let om: GridSource | null = null;
    try {
      const g = await fetchForecastGridLive(days);
      await saveWeatherSnapshot(rawSourceId(baseId, "om"), { savedAt, data: g });
      om = { id: "om", savedAt, grid: g };
    } catch {}
    let ec: GridSource | null = null;
    try {
      const g = await fetchForecastGridBackupLive(days);
      await saveWeatherSnapshot(rawSourceId(baseId, "ecmwf"), { savedAt, data: g });
      ec = { id: "ecmwf", savedAt, grid: g };
    } catch {}
    if (!om) {
      const r = await loadRaw<ForecastGrid>(rawSourceId(baseId, "om"));
      if (r) om = { id: "om", savedAt: r.savedAt, grid: r.data };
    }
    if (!ec) {
      const r = await loadRaw<ForecastGrid>(rawSourceId(baseId, "ecmwf"));
      if (r) ec = { id: "ecmwf", savedAt: r.savedAt, grid: r.data };
    }
    const srcs = [om, ec].filter((s): s is GridSource => s != null);
    let merged = mergeForecastGrids(srcs);
    if (merged) {
      const extras: GridSource[] = [];
      const coords = merged.cells.map((c) => ({ lat: c.lat, lon: c.lon }));
      // sóng trống ngày nào trong tầm WAV → vét cuối khác nhà cung cấp
      const missWave = gridDaysMissing(merged, "wave");
      if (missWave.length > 0) {
        const wav = await getWav();
        if (wav && missWave.some((d) => wav.days.includes(d)))
          extras.push(wavGridSource(wav, merged.times, coords, savedAt));
      }
      // dòng chảy trống NGAY HÔM NAY (an toàn nhất) → merged-uv một mốc
      if (gridDaysMissing(merged, "current").includes(dayOf(merged.times[0]))) {
        const uv = await getUv();
        if (uv) extras.push(uvGridSource(uv, merged.times, coords, savedAt));
      }
      if (extras.length > 0) merged = mergeForecastGrids([...srcs, ...extras]) ?? merged;
    }
    gridOk[days] = merged
      ? await saveWeatherSnapshot(baseId, {
          ...merged,
          savedAt: mergedSavedAt(merged.sources) ?? savedAt,
        })
      : false;

    // LỚP DẢI MÀU: một fetch/nguồn ra cả 5 lớp; raw giữ NGUYÊN BỘ mỗi nguồn
    let omF: Record<OMKind, ScalarGrid> | null = null;
    try {
      omF = await fetchScalarFieldsLive(days);
      await saveWeatherSnapshot(rawSourceId(`scalar:d${days}`, "om"), {
        savedAt,
        data: omF,
      });
    } catch {}
    let ecF: Record<OMKind, ScalarGrid> | null = null;
    try {
      ecF = await fetchScalarFieldsBackupLive(days);
      await saveWeatherSnapshot(rawSourceId(`scalar:d${days}`, "ecmwf"), {
        savedAt,
        data: ecF,
      });
    } catch {}
    let omAt = savedAt;
    let ecAt = savedAt;
    if (!omF) {
      const r = await loadRaw<Record<OMKind, ScalarGrid>>(rawSourceId(`scalar:d${days}`, "om"));
      if (r) {
        omF = r.data;
        omAt = r.savedAt;
      }
    }
    if (!ecF) {
      const r = await loadRaw<Record<OMKind, ScalarGrid>>(rawSourceId(`scalar:d${days}`, "ecmwf"));
      if (r) {
        ecF = r.data;
        ecAt = r.savedAt;
      }
    }
    let n = 0;
    for (const kind of OM_KINDS) {
      const srcsK = [
        omF?.[kind] ? { id: "om", savedAt: omAt, grid: omF[kind] } : null,
        ecF?.[kind] ? { id: "ecmwf", savedAt: ecAt, grid: ecF[kind] } : null,
      ].filter((s): s is { id: string; savedAt: number; grid: ScalarGrid } => s != null);
      const m = mergeScalarGrids(srcsK);
      if (
        m &&
        (await saveWeatherSnapshot(scalarSnapshotId(kind, days), {
          ...m,
          savedAt: mergedSavedAt(m.sources) ?? savedAt,
        }))
      )
        n++;
    }
    scalarOk[days] = n;
  }

  const anyGrid = Object.values(gridOk).some(Boolean);
  const anyScalar = Object.values(scalarOk).some((n) => n > 0);
  return Response.json({
    ok: seaOk > 0 || anyGrid || anyScalar,
    sea: { ok: seaOk, failed: seaFail, total: PORTS.length },
    grid: gridOk,
    scalar: { ok: scalarOk, perDay: OM_KINDS.length },
    lastResort: { wav: wavP != null, uv: uvP != null },
  });
}
