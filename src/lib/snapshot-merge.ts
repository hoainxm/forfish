// Trục 1 — GHÉP SNAPSHOT NHIỀU NGUỒN (user 2026-07-29: "mỗi lớp lấy 2 nguồn,
// snapshot có backup; final = bản MỚI + ngày thiếu lấy từ bản DÀI").
//
// LUẬT (phát biểu theo TỪNG NGÀY, không chọn cả bản):
//  · đơn vị ghép = (NGÀY, NHÓM BIẾN): gió | sóng | dòng chảy | từng lớp dải màu.
//    KHÔNG trộn hai nguồn TRONG một ngày của cùng nhóm (răng cưa giả); mối nối
//    giữa hai ngày có thể có bậc thang — chấp nhận, nhãn độ-tin đã nói ngày xa
//    chỉ tham khảo, và payload mang `sources[]` để nói thật nguồn nào ngày nào.
//  · mỗi (ngày, nhóm): nguồn MỚI NHẤT có số thắng; ngày chỉ bản dài-ngày cũ hơn
//    có → lấy bản dài (đúng công thức "mới + ngày thiếu từ bản dài").
//  · nguồn quá SOURCE_MAX_AGE_MS (48 h) bị loại — thà trống đuôi còn hơn số ôi.
//  · nguồn `lastResort` (Copernicus WAV/UV — thô hơn: theo ngày/một mốc) CHỈ
//    được chọn khi KHÔNG nguồn thường nào phủ ngày đó, bất kể tươi cũ.
//
// THUẦN — chạy ở CRON (client không biết gì về nhiều nguồn, vẫn đọc 1 id).

import type { ForecastGrid, GridCell, GridHour } from "@/lib/forecast-grid";
import type { ScalarGrid } from "@/lib/scalar-field";
import {
  estimateWaveFromWind,
  levelOf,
  scoreDay,
  type ScoredSeaDay,
} from "@/lib/sea";

/** Nguồn quá tuổi này bị loại khỏi ghép (2 chu kỳ cron GH 6h + dư chấn) */
export const SOURCE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Dấu nguồn ghi vào payload — UI/debug đọc được nguồn nào phủ ngày nào */
export interface SnapshotSourceStamp {
  id: string;
  savedAt: number;
  /** các NGÀY (ISO yyyy-mm-dd) mà nguồn này được chọn cho ít nhất một nhóm */
  days: string[];
}

interface BaseSource {
  id: string;
  savedAt: number;
  /** nguồn vét cuối (thô hơn) — chỉ dùng khi nguồn thường không phủ */
  lastResort?: boolean;
}

export interface GridSource extends BaseSource {
  grid: ForecastGrid;
}

export interface ScalarSource extends BaseSource {
  grid: ScalarGrid;
}

export interface SeaSource extends BaseSource {
  days: ScoredSeaDay[];
}

const dayOf = (iso: string) => String(iso).slice(0, 10);
const coordKey = (lat: number, lon: number) =>
  `${Math.round(lat * 100)},${Math.round(lon * 100)}`;

function validSources<T extends BaseSource>(sources: T[], nowMs: number): T[] {
  return sources
    .filter(
      (s) =>
        Number.isFinite(s.savedAt) &&
        s.savedAt <= nowMs + 5 * 60 * 1000 && // đồng hồ lệch nhẹ thì tha
        nowMs - s.savedAt <= SOURCE_MAX_AGE_MS,
    )
    .map((s, i) => ({ s, i }))
    // MỚI NHẤT trước; hoà savedAt → giữ THỨ TỰ TRUYỀN VÀO (caller xếp nguồn
    // chính trước nguồn dự phòng)
    .sort((a, b) => b.s.savedAt - a.s.savedAt || a.i - b.i)
    .map((x) => x.s);
}

/** Chọn nguồn cho một (ngày, nhóm) trên danh sách ĐÃ SẮP theo độ tươi: nguồn
    thường mới nhất có phủ; không ai phủ → nguồn lastResort đầu tiên có phủ.
    `srcOf` trỏ về BaseSource thật (các hàm ghép bọc nguồn trong object chỉ mục
    — đọc lastResort trên object bọc là bug đã dính lúc viết test). */
function pickSource<T>(
  ordered: T[],
  srcOf: (x: T) => BaseSource,
  covers: (x: T) => boolean,
): T | null {
  for (const x of ordered) if (!srcOf(x).lastResort && covers(x)) return x;
  for (const x of ordered) if (srcOf(x).lastResort && covers(x)) return x;
  return null;
}

function buildStamps(
  used: Map<string, { savedAt: number; days: Set<string> }>,
): SnapshotSourceStamp[] {
  return [...used.entries()].map(([id, u]) => ({
    id,
    savedAt: u.savedAt,
    days: [...u.days].sort(),
  }));
}

/* ---------------------------------------------------------------------------
   LƯỚI GIÓ/SÓNG/DÒNG CHẢY (ForecastGrid)
--------------------------------------------------------------------------- */

type GridGroup = "wind" | "wave" | "current";
const GRID_GROUPS: GridGroup[] = ["wind", "wave", "current"];

/** trường "độ lớn" đại diện nhóm — có số nghĩa là nguồn CÓ dữ liệu nhóm đó */
const GROUP_MAG: Record<GridGroup, (h: GridHour) => number | null> = {
  wind: (h) => h.windKmh ?? null,
  wave: (h) => h.waveM ?? null,
  current: (h) => h.curKmh ?? null,
};

interface IndexedGrid<T extends BaseSource> {
  src: T;
  timeIdx: Map<string, number>;
  cellByCoord: Map<string, GridCell>;
}

function indexGrid<T extends GridSource>(s: T): IndexedGrid<T> {
  const timeIdx = new Map<string, number>();
  s.grid.times.forEach((t, i) => timeIdx.set(t, i));
  const cellByCoord = new Map<string, GridCell>();
  for (const c of s.grid.cells) cellByCoord.set(coordKey(c.lat, c.lon), c);
  return { src: s, timeIdx, cellByCoord };
}

/**
 * Ghép nhiều nguồn lưới về MỘT lưới theo luật đầu file. Trục thời gian + toạ độ
 * ô = của nguồn hợp lệ MỚI NHẤT (các nguồn Open-Meteo dùng chung gridPoints nên
 * trùng nhau; nguồn lệch toạ độ thì ô không khớp → null, không đoán).
 */
export function mergeForecastGrids(
  sources: GridSource[],
  nowMs: number = Date.now(),
): (ForecastGrid & { sources: SnapshotSourceStamp[] }) | null {
  const ordered = validSources(
    sources.filter((s) => s.grid?.cells?.length && s.grid?.times?.length),
    nowMs,
  );
  if (ordered.length === 0) return null;
  const canon = ordered.find((s) => !s.lastResort) ?? ordered[0];
  const times = canon.grid.times;
  const idx = ordered.map((s) => indexGrid(s));

  // các tick thuộc từng ngày trên trục canonical
  const dayTicks = new Map<string, number[]>();
  times.forEach((t, i) => {
    const d = dayOf(t);
    const arr = dayTicks.get(d);
    if (arr) arr.push(i);
    else dayTicks.set(d, [i]);
  });

  // nguồn có PHỦ (ngày, nhóm) không: một ô bất kỳ có số ở một tick của ngày
  const covers = (ig: IndexedGrid<GridSource>, date: string, g: GridGroup) => {
    const ticks = dayTicks.get(date) ?? [];
    for (const c of ig.src.grid.cells) {
      for (const ti of ticks) {
        const si = ig.timeIdx.get(times[ti]);
        if (si == null) continue;
        const h = c.hours[si];
        if (h && GROUP_MAG[g](h) != null) return true;
      }
    }
    return false;
  };

  // chọn nguồn cho từng (ngày, nhóm)
  const choice = new Map<string, IndexedGrid<GridSource>>(); // `${date}|${g}`
  const used = new Map<string, { savedAt: number; days: Set<string> }>();
  for (const date of dayTicks.keys()) {
    for (const g of GRID_GROUPS) {
      const picked = pickSource(
        idx,
        (ig) => ig.src,
        (ig) => covers(ig, date, g),
      );
      if (!picked) continue;
      choice.set(`${date}|${g}`, picked);
      const u = used.get(picked.src.id) ?? {
        savedAt: picked.src.savedAt,
        days: new Set<string>(),
      };
      u.days.add(date);
      used.set(picked.src.id, u);
    }
  }
  if (used.size === 0) return null;

  const cells: GridCell[] = canon.grid.cells.map((cc) => {
    const key = coordKey(cc.lat, cc.lon);
    const hours: GridHour[] = times.map((t) => {
      const date = dayOf(t);
      const read = (g: GridGroup): Partial<GridHour> => {
        const ig = choice.get(`${date}|${g}`);
        const si = ig?.timeIdx.get(t);
        const h = si != null ? ig!.cellByCoord.get(key)?.hours[si] : undefined;
        if (g === "wind")
          return { windKmh: h?.windKmh ?? null, windDirDeg: h?.windDirDeg ?? null };
        if (g === "wave")
          return { waveM: h?.waveM ?? null, waveDirDeg: h?.waveDirDeg ?? null };
        return { curKmh: h?.curKmh ?? null, curDirDeg: h?.curDirDeg ?? null };
      };
      return {
        windKmh: null,
        windDirDeg: null,
        waveM: null,
        waveDirDeg: null,
        ...read("wind"),
        ...read("wave"),
        ...read("current"),
      } as GridHour;
    });
    return { lat: cc.lat, lon: cc.lon, hours };
  });

  return { cells, times, sources: buildStamps(used) };
}

/** Ngày (yyyy-mm-dd) trên trục lưới mà nhóm `g` KHÔNG có số nào — cron dùng để
    quyết định có cần gọi nguồn vét cuối (WAV/UV) hay không. */
export function gridDaysMissing(
  grid: ForecastGrid,
  g: GridGroup,
): string[] {
  const byDay = new Map<string, boolean>();
  grid.times.forEach((t, i) => {
    const d = dayOf(t);
    const has = byDay.get(d) ?? false;
    if (has) return;
    for (const c of grid.cells) {
      const h = c.hours[i];
      if (h && GROUP_MAG[g](h) != null) {
        byDay.set(d, true);
        return;
      }
    }
    if (!byDay.has(d)) byDay.set(d, false);
  });
  return [...byDay.entries()].filter(([, has]) => !has).map(([d]) => d);
}

/* ---------------------------------------------------------------------------
   LỚP DẢI MÀU (ScalarGrid) — một biến/lưới, ghép theo NGÀY nguyên lưới
--------------------------------------------------------------------------- */

export function mergeScalarGrids(
  sources: ScalarSource[],
  nowMs: number = Date.now(),
): (ScalarGrid & { sources: SnapshotSourceStamp[] }) | null {
  const ordered = validSources(
    sources.filter(
      (s) =>
        s.grid?.cells?.length &&
        s.grid?.times?.length &&
        // nguồn TỰ mâu thuẫn (khai nLat/nLon mà số ô lệch) bị loại từ đầu —
        // để nó làm canon là cả bản ghép hỏng theo
        (s.grid.nLat == null ||
          s.grid.nLon == null ||
          s.grid.cells.length === s.grid.nLat * s.grid.nLon),
    ),
    nowMs,
  );
  if (ordered.length === 0) return null;
  const canon = ordered.find((s) => !s.lastResort) ?? ordered[0];
  const times = canon.grid.times;

  interface Idx {
    src: ScalarSource;
    timeIdx: Map<string, number>;
    cellByCoord: Map<string, (number | null)[]>;
  }
  const idx: Idx[] = ordered
    // nguồn lệch cỡ lưới với canon thì bỏ (dựng hình suy kích thước từ cells)
    .filter(
      (s) =>
        s.grid.cells.length === canon.grid.cells.length &&
        (s.grid.nLat ?? null) === (canon.grid.nLat ?? null) &&
        (s.grid.nLon ?? null) === (canon.grid.nLon ?? null),
    )
    .map((s) => {
      const timeIdx = new Map<string, number>();
      s.grid.times.forEach((t, i) => timeIdx.set(t, i));
      const cellByCoord = new Map<string, (number | null)[]>();
      for (const c of s.grid.cells)
        cellByCoord.set(coordKey(c.lat, c.lon), c.values);
      return { src: s, timeIdx, cellByCoord };
    });
  if (idx.length === 0) return null;

  const dayTicks = new Map<string, number[]>();
  times.forEach((t, i) => {
    const d = dayOf(t);
    const arr = dayTicks.get(d);
    if (arr) arr.push(i);
    else dayTicks.set(d, [i]);
  });

  const covers = (x: Idx, date: string) => {
    const ticks = dayTicks.get(date) ?? [];
    for (const values of x.cellByCoord.values()) {
      for (const ti of ticks) {
        const si = x.timeIdx.get(times[ti]);
        if (si != null && values[si] != null) return true;
      }
    }
    return false;
  };

  const choice = new Map<string, Idx>();
  const used = new Map<string, { savedAt: number; days: Set<string> }>();
  for (const date of dayTicks.keys()) {
    const picked =
      idx.find((x) => !x.src.lastResort && covers(x, date)) ??
      idx.find((x) => x.src.lastResort && covers(x, date)) ??
      null;
    if (!picked) continue;
    choice.set(date, picked);
    const u = used.get(picked.src.id) ?? {
      savedAt: picked.src.savedAt,
      days: new Set<string>(),
    };
    u.days.add(date);
    used.set(picked.src.id, u);
  }
  if (used.size === 0) return null;

  const cells = canon.grid.cells.map((cc) => ({
    lat: cc.lat,
    lon: cc.lon,
    values: times.map((t) => {
      const x = choice.get(dayOf(t));
      const si = x?.timeIdx.get(t);
      if (x == null || si == null) return null;
      return x.cellByCoord.get(coordKey(cc.lat, cc.lon))?.[si] ?? null;
    }),
  }));

  return {
    kind: canon.grid.kind,
    times,
    nLat: canon.grid.nLat,
    nLon: canon.grid.nLon,
    cells,
    sources: buildStamps(used),
  };
}

/* ---------------------------------------------------------------------------
   DỰ BÁO CẢNG (ScoredSeaDay[]) — ghép theo NGÀY, gió + sóng có thể khác nguồn
   (biến độc lập — như sổ nguồn fish-forecast), CHẤM LẠI điểm sau khi ghép.
--------------------------------------------------------------------------- */

export function mergeSeaDays(
  sources: SeaSource[],
  nowMs: number = Date.now(),
): { days: ScoredSeaDay[]; sources: SnapshotSourceStamp[] } | null {
  const ordered = validSources(
    sources.filter((s) => Array.isArray(s.days) && s.days.length > 0),
    nowMs,
  );
  if (ordered.length === 0) return null;

  const byDate = ordered.map((s) => {
    const m = new Map<string, ScoredSeaDay>();
    for (const d of s.days) if (d?.date) m.set(d.date, d);
    return { src: s, m };
  });

  const allDates = [...new Set(ordered.flatMap((s) => s.days.map((d) => d.date)))]
    .sort();

  const used = new Map<string, { savedAt: number; days: Set<string> }>();
  const mark = (id: string, savedAt: number, date: string) => {
    const u = used.get(id) ?? { savedAt, days: new Set<string>() };
    u.days.add(date);
    used.set(id, u);
  };

  const days: ScoredSeaDay[] = [];
  for (const date of allDates) {
    // GIÓ (kèm mưa/dông/giật — cùng một request nguồn): nguồn thường mới nhất
    const windSrc = pickSource(
      byDate,
      (x) => x.src,
      (x) => {
        const d = x.m.get(date);
        return d != null && Number.isFinite(d.windMaxKmh);
      },
    );
    if (!windSrc) continue; // không gió thì không chấm nổi điểm — bỏ ngày
    const w = windSrc.m.get(date)!;
    mark(windSrc.src.id, windSrc.src.savedAt, date);

    // SÓNG: ưu tiên nguồn có số sóng THẬT (không phải ước từ gió)
    const waveSrc = pickSource(
      byDate,
      (x) => x.src,
      (x) => {
        const d = x.m.get(date);
        return d != null && Number.isFinite(d.waveMaxM) && d.waveEstimated !== true;
      },
    );
    let waveMaxM: number;
    let waveEstimated: boolean;
    if (waveSrc) {
      waveMaxM = waveSrc.m.get(date)!.waveMaxM;
      waveEstimated = false;
      mark(waveSrc.src.id, waveSrc.src.savedAt, date);
    } else {
      waveMaxM = estimateWaveFromWind(w.windMaxKmh);
      waveEstimated = true;
    }

    const day = {
      date,
      waveMaxM,
      windMaxKmh: w.windMaxKmh,
      gustMaxKmh: w.gustMaxKmh ?? 0,
      precipMm: w.precipMm ?? 0,
      wmoCode: w.wmoCode ?? null,
      waveEstimated,
    };
    // CHẤM LẠI sau ghép — điểm của nguồn gốc tính trên bộ số khác, giữ lại là sai
    const score = scoreDay(day);
    days.push({ ...day, score, level: levelOf(score) });
  }

  if (days.length === 0) return null;
  return { days, sources: buildStamps(used) };
}

/** savedAt của bản ghép = nguồn TƯƠI NHẤT thực sự được dùng — client so nhịp
    phát hành bằng số này (bản toàn đồ cũ thì client tự đi live, đúng ý). */
export function mergedSavedAt(stamps: SnapshotSourceStamp[]): number | null {
  let max: number | null = null;
  for (const s of stamps) if (max == null || s.savedAt > max) max = s.savedAt;
  return max;
}
