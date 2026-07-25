// Trục 1 — LỚP ĐỘ TIN của engine dự báo biển 16 ngày. Gộp ba nguồn tín hiệu
// để nói THẬT về độ chắc từng ngày (thay vì mọi ngày trông chắc như nhau):
//
//   1. Tầm ngày (horizon)   — skill khí tượng giảm dần là quy luật vật lý.
//   2. Ensemble spread       — các thành viên mô hình lệch nhau nhiều = khó đoán
//                              (lib/forecast-ensemble.ts, Open-Meteo GFS-EPS).
//   3. Bảng skill backtest    — sai số ĐO ĐƯỢC dự-báo-cũ vs thực-tế theo tầm ngày
//                              (src/data/forecast-skill.json — học thử offline).
//
// Đồng thời hiệu chỉnh BIAS thô của điểm số: nếu backtest cho thấy mô hình hay
// báo gió/sóng thấp/cao hơn thực tế ở một tầm ngày, cộng/trừ lại trước khi chấm
// điểm — đây là phần "tối ưu độ chính xác" từ dữ liệu thật.
//
// TRUNG THỰC: mọi thứ ở đây là hiệu chỉnh THỐNG KÊ tham khảo, không bảo chứng.

import { forecastConfidence, type ForecastConfidence } from "@/lib/marine-weather";
import { scoreDay, levelOf, type ScoredSeaDay } from "@/lib/sea";
import type { DayUncertainty } from "@/lib/forecast-ensemble";

/** Một dòng bảng skill theo tầm ngày (khớp shape src/data/forecast-skill.json) */
export interface SkillLead {
  leadDay: number; // 1..15 (số ngày kể từ hôm nay; hôm nay coi như lead 0/1)
  windMae?: number;
  windBias?: number; // mean(forecast - actual), km/h — >0 = mô hình báo cao hơn thực
  waveMae?: number;
  waveBias?: number; // m — >0 = mô hình báo cao hơn thực
  confidence?: number; // 0..1 suy từ MAE
  n?: number; // số cặp mẫu
}

export interface SkillTable {
  generatedAt?: string;
  method?: string;
  sampleSize?: number;
  perLeadDay: SkillLead[];
}

/** Độ tin + hiệu chỉnh của MỘT ngày dự báo, để UI hiển thị trung thực */
export interface DayQuality {
  date: string;
  /** 0 = hôm nay, 1 = mai… */
  daysAhead: number;
  /** 0..1 độ tin tổng hợp (thấp = mô hình đang khó đoán / tầm xa) */
  confidence: number;
  /** nhãn + tone tiếng Việt cho UI */
  conf: ForecastConfidence;
  /** độ lệch ensemble (km/h) nếu có — null nếu không lấy được */
  ensembleSpreadKmh: number | null;
  /** true nếu skill backtest đủ mẫu cho ngày này */
  skillBacked: boolean;
}

/** Prior độ tin theo tầm ngày khi KHÔNG có ensemble/skill — giảm mượt 1→0.3 */
export function horizonPrior(daysAhead: number): number {
  // ngày 0 ~0.95, ngày 7 ~0.6, ngày 14 ~0.34 — nửa đời ~7 ngày
  const c = 0.95 * Math.exp(-daysAhead / 12);
  return Math.max(0.3, Math.min(1, c));
}

/**
 * Gộp độ tin từ các nguồn có mặt. Ensemble (đo trực tiếp mô hình lệch nhau) tin
 * cậy nhất → trọng số cao; skill (thống kê quá khứ) bổ trợ; horizon là nền.
 * Nguồn nào thiếu thì bỏ, chia lại trọng số — không phạt oan.
 */
export function combineConfidence(
  daysAhead: number,
  ensembleConf?: number | null,
  skillConf?: number | null,
): number {
  const terms: [number, number][] = [[1, horizonPrior(daysAhead)]];
  if (ensembleConf != null && Number.isFinite(ensembleConf))
    terms.push([2.5, clamp01(ensembleConf)]);
  if (skillConf != null && Number.isFinite(skillConf))
    terms.push([1.5, clamp01(skillConf)]);
  let w = 0;
  let acc = 0;
  for (const [wi, v] of terms) {
    w += wi;
    acc += wi * v;
  }
  return clamp01(w > 0 ? acc / w : horizonPrior(daysAhead));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Tra dòng skill cho một lead day (1-based). null nếu bảng trống/thiếu. */
export function skillForLead(
  skill: SkillTable | null | undefined,
  leadDay: number,
): SkillLead | null {
  if (!skill?.perLeadDay?.length) return null;
  const exact = skill.perLeadDay.find((r) => r.leadDay === leadDay);
  if (exact && (exact.n ?? 0) > 0) return exact;
  return null;
}

/**
 * Hiệu chỉnh BIAS điểm số theo backtest + CHẤM LẠI. Trừ bias khỏi giá trị mô
 * hình để về gần thực tế hơn rồi scoreDay lại. Bias thiếu → giữ nguyên ngày đó.
 * Trả MẢNG MỚI (không đụng input).
 */
export function applyBiasCorrection(
  days: ScoredSeaDay[],
  skill: SkillTable | null | undefined,
): ScoredSeaDay[] {
  if (!skill?.perLeadDay?.length) return days;
  return days.map((d, i) => {
    const lead = i + 1; // hôm nay = lead 1
    const row = skillForLead(skill, lead);
    if (!row) return d;
    const windBias = Number.isFinite(row.windBias as number) ? (row.windBias as number) : 0;
    const waveBias = Number.isFinite(row.waveBias as number) ? (row.waveBias as number) : 0;
    if (windBias === 0 && waveBias === 0) return d;
    const windMaxKmh = Math.max(0, d.windMaxKmh - windBias);
    const waveMaxM = Math.max(0, d.waveMaxM - waveBias);
    // giữ nguyên gust/precip/wmo — chỉ nắn 2 biến chi phối điểm số
    const nd = { ...d, windMaxKmh, waveMaxM };
    const score = scoreDay(nd);
    return { ...nd, score, level: levelOf(score) };
  });
}

/**
 * Đánh giá độ tin từng ngày. `ensemble` merge theo `date`; `skill` theo lead.
 * KHÔNG sửa điểm số ở đây — chỉ mô tả độ chắc (dùng applyBiasCorrection nếu
 * muốn nắn điểm). Trả cùng độ dài & thứ tự với `days`.
 */
export function assessForecast(
  days: ScoredSeaDay[],
  ensemble: DayUncertainty[] | null,
  skill?: SkillTable | null,
): DayQuality[] {
  const ensByDate = new Map<string, DayUncertainty>();
  for (const e of ensemble ?? []) ensByDate.set(e.date, e);
  return days.map((d, i) => {
    const daysAhead = i;
    const lead = i + 1;
    const ens = ensByDate.get(d.date) ?? null;
    const row = skillForLead(skill, lead);
    const confidence = combineConfidence(
      daysAhead,
      ens?.confidence ?? null,
      row?.confidence ?? null,
    );
    return {
      date: d.date,
      daysAhead,
      confidence,
      conf: forecastConfidence(daysAhead, ens?.confidence ?? row?.confidence ?? null),
      ensembleSpreadKmh: ens?.windSpreadKmh ?? null,
      skillBacked: row != null,
    };
  });
}
