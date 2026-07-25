// Trục 1 — "CHUẨN BỊ ĐI BIỂN": tải sẵn trước khi rời bờ.
//
// Vì sao có file này: máy VẪN giữ dự báo để xem lúc mất sóng, nhưng trước đây
// chỉ giữ được thứ bà con TÌNH CỜ mở ra xem (chạm điểm, bật lớp gió). Ra khơi 5–16
// ngày mà không biết trong máy có gì = may rủi. Nút "Chuẩn bị đi biển" biến việc
// đó thành LỜI HỨA: bấm một lần lúc còn sóng, máy tải đủ và nói rõ giữ được tới
// ngày nào, cho mấy chỗ.
//
// Nguyên tắc: KHÔNG thêm nguồn dữ liệu mới — chỉ gọi đúng những hàm màn Ra khơi
// vẫn gọi (fetchSeaPoint / fetchFishForecast / fetchForecastGrid), vì bản thân
// chúng đã tự lưu vào máy. Chạy TUẦN TỰ cho khỏi dội nguồn miễn phí.

import { fetchSeaPoint, POINT_NS, type SeaPointConditions } from "@/lib/marine-weather";
import { fetchFishForecast } from "@/lib/fish-predict";
import { fetchForecastGrid, savedGridDays } from "@/lib/forecast-grid";
import { coordId, lastStorageFullAt, loadAll } from "@/lib/forecast-cache";
import { formatDateVN } from "@/lib/ocean-map";
import { isoDateVN } from "@/lib/day-labels";

/**
 * Khung ngày lưới gió/sóng tải sẵn: gần (3) · giữa (7) · cả chuyến dài (16).
 * KHÔNG lấy đủ cả 5 khung: mỗi khung là một lưới 80 điểm × mấy chục mốc giờ
 * (~0,2–0,4 MB trong máy, tải về nặng hơn nhiều) — 3 khung đã phủ mọi tầm nhìn,
 * 5 khung chỉ tổ chiếm chỗ và tốn sóng lúc còn ở bờ.
 */
export const PRETRIP_GRID_DAYS = [3, 7, 16] as const;

export interface PretripStep {
  /** câu bà con đọc được, vd "Gió sóng — Cảng nhà" */
  label: string;
  run: () => Promise<void>;
}

export interface PretripProgress {
  /** đã xong mấy việc */
  done: number;
  /** tổng số việc */
  total: number;
  /** đang làm việc gì */
  label: string;
}

export interface PretripResult {
  /** số việc tải được */
  ok: number;
  /** số việc hỏng (mạng chập chờn) */
  failed: number;
  /** máy hết chỗ nhớ — có tải cũng không giữ được */
  full: boolean;
  /** tóm tắt "trong máy đang có gì" sau khi tải */
  saved: SavedSummary;
}

export interface PretripPoint {
  lat: number;
  lon: number;
  /** tên chỗ để hiện trong thanh tiến trình */
  name: string;
}

/* --------------------------------------------------------------------------
   TRONG MÁY ĐANG CÓ GÌ — đọc thẳng bản đã lưu, không đoán
-------------------------------------------------------------------------- */

export interface SavedSummary {
  /** số CHỖ có dự báo gió sóng trong máy */
  places: number;
  /** ngày xa nhất còn dự báo (ISO) — null nếu chưa có gì */
  untilIso: string | null;
  /** các khung ngày lưới gió/sóng đang giữ (3/7/16…) */
  gridDays: number[];
}

/** Đọc localStorage → "trong máy đang có gì" (thuần đọc, không gọi mạng). */
export function savedSummary(): SavedSummary {
  const pts = loadAll<SeaPointConditions>(POINT_NS);
  let untilIso: string | null = null;
  for (const p of pts) {
    const days = p.data?.days ?? [];
    const last = days.length ? days[days.length - 1]?.date : null;
    if (last && (untilIso == null || last > untilIso)) untilIso = last;
  }
  return { places: pts.length, untilIso, gridDays: savedGridDays() };
}

/**
 * Câu thường trực cho bà con biết đang cầm gì trong máy.
 * Chưa có gì thì nói thẳng, KHÔNG hiện ngày rỗng cho có.
 */
export function savedLine(s: SavedSummary, nowMs: number = Date.now()): string {
  if (!s.places || !s.untilIso) return "Trong máy: chưa có dự báo nào";
  const todayIso = isoDateVN(nowMs);
  if (s.untilIso < todayIso) return "Trong máy: dự báo đã qua ngày hết";
  return `Trong máy: dự báo tới ${formatDateVN(s.untilIso)} · ${s.places} chỗ`;
}

/** Câu kết sau khi bấm "Chuẩn bị đi biển" — nói đúng thứ máy giữ được. */
export function doneLine(r: PretripResult): string {
  if (r.full) {
    return "Máy hết chỗ nhớ — xoá bớt điểm đã lưu rồi làm lại.";
  }
  if (!r.saved.places || !r.saved.untilIso) {
    return "Chưa tải được gì — kiểm tra sóng rồi làm lại.";
  }
  const head = `Xong. Máy giữ dự báo tới ngày ${formatDateVN(
    r.saved.untilIso,
  )} cho ${r.saved.places} chỗ.`;
  return r.failed > 0
    ? `${head} Còn ${r.failed} phần chưa tải được — có sóng thì làm lại.`
    : head;
}

/* --------------------------------------------------------------------------
   DANH SÁCH VIỆC + CHẠY
-------------------------------------------------------------------------- */

/** Bỏ các chỗ trùng ô lưới ~0,25° (chạm mấy lần quanh một chỗ = một bản lưu) */
export function dedupePoints(points: PretripPoint[]): PretripPoint[] {
  const seen = new Set<string>();
  const out: PretripPoint[] = [];
  for (const p of points) {
    const id = coordId(p.lat, p.lon);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/** Dựng danh sách việc — tách riêng để test được thứ tự/số việc, không gọi mạng. */
export function pretripSteps(points: PretripPoint[]): PretripStep[] {
  const steps: PretripStep[] = [];
  for (const p of dedupePoints(points)) {
    steps.push({
      label: `Gió sóng — ${p.name}`,
      run: async () => {
        await fetchSeaPoint({ lat: p.lat, lon: p.lon });
      },
    });
  }
  steps.push({
    label: "Bản đồ cá",
    run: async () => {
      const r = await fetchFishForecast();
      if (!r.ok) throw new Error("bản đồ cá chưa tải được");
    },
  });
  for (const d of PRETRIP_GRID_DAYS) {
    steps.push({
      label: `Gió sóng cả vùng biển — ${d} ngày`,
      run: async () => {
        await fetchForecastGrid(d);
      },
    });
  }
  return steps;
}

/**
 * Chạy tuần tự, báo tiến trình từng bước. Một việc hỏng KHÔNG dừng cả mẻ —
 * tải được gì giữ nấy, rồi nói thật còn thiếu bao nhiêu.
 */
export async function runPretrip(
  points: PretripPoint[],
  onProgress?: (p: PretripProgress) => void,
): Promise<PretripResult> {
  const steps = pretripSteps(points);
  const total = steps.length;
  const startedAt = Date.now();
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < total; i++) {
    onProgress?.({ done: i, total, label: steps[i].label });
    try {
      await steps[i].run();
      ok++;
    } catch {
      failed++;
    }
  }
  onProgress?.({ done: total, total, label: "Xong" });
  // Tầng lưu báo HẾT CHỖ trong lúc chạy → nói thật, đừng để bà con tưởng máy đã
  // giữ đủ rồi ra khơi mới biết trống.
  const full = lastStorageFullAt() >= startedAt;
  return { ok, failed, full, saved: savedSummary() };
}
