// Trục 1 — Đo ĐỘ BẤT ĐỊNH của dự báo biển bằng Open-Meteo Ensemble API.
//
// Ý tưởng cho bà con: dự báo 16 ngày không phải ngày nào cũng chắc như nhau.
// Ensemble = chạy mô hình nhiều lần với điều kiện đầu vào lệch nhau một chút
// (gfs05 = GFS Ensemble 0.5°, 31 "thành viên": 1 bản chính + 30 bản nhiễu,
// tới ~35 ngày). Nếu các thành viên nói giống nhau → trời dễ đoán, TIN CAO.
// Nếu mỗi bản một phách (độ lệch lớn) → còn mù mờ, TIN THẤP. Module này tính
// độ lệch chuẩn của gió giữa các thành viên rồi quy về mức tin 0–1 cho từng ngày,
// để engine dự báo nói THẬT về độ tin thay vì gán nhãn cứng theo bucket.
//
// Nguồn: https://ensemble-api.open-meteo.com/v1/ensemble (miễn phí, không cần key).
// Shape JSON thực tế (đã xác minh, models=gfs05, hourly=wind_speed_10m):
//   hourly.time            → mảng ISO theo giờ
//   hourly.wind_speed_10m           → thành viên chính (control run)
//   hourly.wind_speed_10m_member01  → thành viên nhiễu 1
//   ...
//   hourly.wind_speed_10m_member30  → thành viên nhiễu 30   (tổng 31 cột gió)
// Đơn vị: km/h.

import { timeoutSignal } from "@/lib/abort";

export type DayUncertainty = {
  /** ISO yyyy-mm-dd */
  date: string;
  /** Độ lệch chuẩn của gió-đỉnh-ngày giữa các thành viên (km/h). Càng lớn càng mù mờ. */
  windSpreadKmh: number;
  /** Mức tin 0–1: 1 = các thành viên đồng thuận (tin cao), 0 = mỗi bản một phách. */
  confidence: number;
  /** Số thành viên góp mặt trong ngày này. */
  members: number;
};

// Hằng số quy đổi độ-lệch-gió → mức tin. Chọn K = 15 km/h vì:
//  · spread ~0        → confidence ≈ 1.00  (các bản đồng thuận, trời dễ đoán)
//  · spread = 15 km/h → confidence = 0.50  (mốc "một nửa": bắt đầu mù mờ ~1 cấp gió Beaufort)
//  · spread = 30 km/h → confidence ≈ 0.20  (mỗi bản một phách, đừng tin xa)
// 15 km/h xấp xỉ một bậc thang gió Beaufort — mốc trực giác với dân đi biển,
// và khớp mức phân tán ensemble thường thấy ở hạn ~10–15 ngày.
export const CONFIDENCE_K_KMH = 15;

/** Độ lệch chuẩn (population std). Mảng rỗng/1 phần tử → 0 (không có phân tán). */
export function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/**
 * Quy đổi độ-lệch-gió (km/h) → mức tin 0–1, mượt và đơn điệu giảm.
 * confidence = 1 / (1 + (spread/K)²). Spread nhỏ → gần 1; spread lớn → gần 0.
 * Kẹp [0,1]; spread âm (không hợp lệ) coi như 0 → trả 1.
 */
export function spreadToConfidence(windSpreadKmh: number): number {
  const spread = Number.isFinite(windSpreadKmh) ? Math.max(0, windSpreadKmh) : 0;
  const c = 1 / (1 + (spread / CONFIDENCE_K_KMH) ** 2);
  return Math.min(1, Math.max(0, c));
}

/**
 * Gom các chuỗi gió theo-giờ của từng thành viên về độ bất định theo NGÀY.
 *
 * @param times  Mảng thời gian ISO theo giờ (vd "2026-07-25T13:00"). Ngày = 10 ký tự đầu.
 * @param memberSeries  Mỗi phần tử là 1 thành viên: mảng gió (km/h) khớp chỉ số với `times`.
 * @returns Mỗi ngày: gió-đỉnh mỗi thành viên → std giữa các thành viên → mức tin.
 *
 * Cách tính: với mỗi ngày, lấy gió-đỉnh (max) của từng thành viên trong ngày đó,
 * rồi tính độ lệch chuẩn giữa các thành viên. Bỏ qua giá trị không hợp lệ (null/NaN).
 */
export function aggregateDailySpread(
  times: string[],
  memberSeries: number[][],
): DayUncertainty[] {
  // date → (member index → gió-đỉnh trong ngày)
  const perDay = new Map<string, number[]>();
  const dayOrder: string[] = [];

  for (const time of times) {
    const date = time.slice(0, 10);
    if (!perDay.has(date)) {
      perDay.set(date, []);
      dayOrder.push(date);
    }
  }

  for (const date of dayOrder) {
    // Với mỗi thành viên, tìm gió-đỉnh của ngày này.
    const peaks: number[] = [];
    for (const series of memberSeries) {
      let peak = -Infinity;
      for (let i = 0; i < times.length; i++) {
        if (times[i].slice(0, 10) !== date) continue;
        const v = series[i];
        if (typeof v === "number" && Number.isFinite(v) && v > peak) peak = v;
      }
      if (peak !== -Infinity) peaks.push(peak);
    }
    perDay.set(date, peaks);
  }

  return dayOrder.map((date) => {
    const peaks = perDay.get(date) ?? [];
    const windSpreadKmh = stdDev(peaks);
    return {
      date,
      windSpreadKmh,
      confidence: spreadToConfidence(windSpreadKmh),
      members: peaks.length,
    };
  });
}

/**
 * Gọi Open-Meteo Ensemble API, đọc các cột thành viên và trả độ bất định theo ngày.
 * Timeout 15s, degrade an toàn: mọi lỗi/timeout/shape lạ → trả null (KHÔNG throw,
 * để UI dự báo vẫn chạy bằng dữ liệu chắc chắn khác).
 *
 * @param days  Số ngày muốn xét (mặc định 15). gfs05 hỗ trợ tới ~35 ngày.
 */
export async function fetchEnsembleUncertainty(
  lat: number,
  lon: number,
  days = 15,
): Promise<DayUncertainty[] | null> {
  try {
    const url =
      `https://ensemble-api.open-meteo.com/v1/ensemble` +
      `?latitude=${lat}&longitude=${lon}` +
      `&models=gfs05&hourly=wind_speed_10m` +
      `&forecast_days=${days}&timezone=Asia%2FHo_Chi_Minh`;

    const res = await fetch(url, {
      // Một số nguồn Open-Meteo chặn request không có User-Agent → gửi kèm cho chắc.
      headers: { "User-Agent": "SDFish/1.0 (+forfish)" },
      signal: timeoutSignal(15000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      hourly?: Record<string, unknown>;
    };
    const hourly = data.hourly;
    if (!hourly) return null;

    const times = hourly.time;
    if (!Array.isArray(times) || times.length === 0) return null;

    // Đọc mọi cột gió của thành viên:
    //  · "wind_speed_10m"           = bản chính (control run)
    //  · "wind_speed_10m_memberNN"  = các bản nhiễu
    const memberSeries: number[][] = [];
    for (const key of Object.keys(hourly)) {
      if (
        key === "wind_speed_10m" ||
        key.startsWith("wind_speed_10m_member")
      ) {
        const series = hourly[key];
        if (Array.isArray(series)) {
          // ép về number, giữ NaN cho ô null để aggregate bỏ qua
          memberSeries.push(series.map((v) => (typeof v === "number" ? v : NaN)));
        }
      }
    }
    if (memberSeries.length === 0) return null;

    return aggregateDailySpread(times as string[], memberSeries);
  } catch {
    // timeout / mạng lỗi / JSON hỏng → coi như không có, để nguồn khác gánh
    return null;
  }
}
